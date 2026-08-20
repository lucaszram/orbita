import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  deleteAccountData,
  USER_SCOPED_DELETION_STEPS
} from "../convex/lib/accountDeletion";
import { buildRateLimitBucketKey, rateLimitSubjectHash } from "../convex/lib/rateLimit";
import { RECONCILE_COOLDOWN } from "../convex/lib/revenueCatRetry";

type Row = {
  _id: string;
  [key: string]: unknown;
};

function fakeDb(initialRows: Record<string, Row[]>) {
  const rows = new Map(
    Object.entries(initialRows).map(([table, values]) => [
      table,
      values.map((value) => ({ ...value }))
    ])
  );
  const indexReads: Array<{ table: string; index: string; field: string; value: unknown }> = [];

  return {
    rows,
    indexReads,
    query(table: string) {
      return {
        // `eq` es ENCADENABLE, igual que en Convex: los índices de dos campos
        // (`by_scope_subjectHash`) se recorren con dos igualdades seguidas.
        withIndex(index: string, build: (q: any) => any) {
          const conditions: Array<{ field: string; value: unknown }> = [];
          const builder: any = {
            eq(field: string, value: unknown) {
              conditions.push({ field, value });
              return builder;
            }
          };
          build(builder);
          for (const condition of conditions) {
            indexReads.push({ table, index, field: condition.field, value: condition.value });
          }
          return {
            async collect() {
              return (rows.get(table) ?? []).filter((row) =>
                conditions.every((condition) => row[condition.field] === condition.value)
              );
            }
          };
        }
      };
    },
    async delete(id: string) {
      for (const [table, values] of rows) {
        rows.set(
          table,
          values.filter((row) => row._id !== id)
        );
      }
    }
  };
}

describe("deleteAccountData", () => {
  it("covers every user-owned table in the current schema", () => {
    assert.deepEqual(
      USER_SCOPED_DELETION_STEPS.map((step) => step.table),
      [
        "productEvents",
        "productActors",
        "labRuns",
        "labSubjects",
        "savedReadings",
        "journalEntries",
        "natalInterpretations",
        "profileAstrologyCaches",
        "dailyLlmReadings",
        "dailyReadings",
        "transitReadings",
        "transitTimelineCaches",
        "analysisSnapshotsV492",
        "natalEphemerisCachesV492",
        "relationshipComparisonCachesV492",
        "dailyGuides",
        "voidAnswers",
        "voidPromptSets",
        "relationshipProfiles",
        "notificationPreferences",
        "devices",
        "subscriptions",
        "natalCharts",
        "birthData",
        "onboardingDrafts"
      ]
    );

    const schema = readFileSync(`${process.cwd()}/convex/schema.ts`, "utf8");
    const userIdFields = schema.match(/^\s+userId:\s+v\./gm)?.length ?? 0;
    const createdByFields = schema.match(/^\s+createdByUserId:\s+v\./gm)?.length ?? 0;
    assert.equal(
      USER_SCOPED_DELETION_STEPS.filter((step) => step.field === "userId").length,
      userIdFields,
      "a userId table was added to schema.ts without joining the deletion plan"
    );
    assert.equal(
      USER_SCOPED_DELETION_STEPS.filter((step) => step.field === "createdByUserId").length,
      createdByFields,
      "a createdByUserId table was added to schema.ts without joining the deletion plan"
    );
    assert.match(schema, /paymentEvents:[\s\S]*?\.index\("by_clerkUserId", \["clerkUserId"\]\)/);
  });

  it("deletes the current user's complete graph without touching another user or global data", async () => {
    const initialRows: Record<string, Row[]> = {
      users: [
        { _id: "user_current", clerkUserId: "clerk_current" },
        { _id: "user_other", clerkUserId: "clerk_other" }
      ],
      paymentEvents: [
        { _id: "payment_current", clerkUserId: "clerk_current" },
        { _id: "payment_other", clerkUserId: "clerk_other" }
      ],
      globalSkyCaches: [{ _id: "global_sky", localDate: "2026-07-18" }],
      globalSkySnapshotsV492: [{ _id: "global_sky_v492", localDate: "2026-07-18" }],
      contentModules: [{ _id: "editorial", kind: "education" }]
    };

    for (const step of USER_SCOPED_DELETION_STEPS) {
      initialRows[step.table] = [
        { _id: `${step.table}_current`, [step.field]: "user_current" },
        { _id: `${step.table}_other`, [step.field]: "user_other" }
      ];
    }

    const db = fakeDb(initialRows);
    const deleted = await deleteAccountData(
      { db },
      { userId: "user_current", clerkUserIds: ["clerk_current"] }
    );

    assert.equal(deleted, USER_SCOPED_DELETION_STEPS.length + 2);
    assert.deepEqual(db.rows.get("users"), [
      { _id: "user_other", clerkUserId: "clerk_other" }
    ]);
    assert.deepEqual(db.rows.get("paymentEvents"), [
      { _id: "payment_other", clerkUserId: "clerk_other" }
    ]);
    assert.deepEqual(db.rows.get("globalSkyCaches"), [
      { _id: "global_sky", localDate: "2026-07-18" }
    ]);
    assert.deepEqual(db.rows.get("globalSkySnapshotsV492"), [
      { _id: "global_sky_v492", localDate: "2026-07-18" }
    ]);
    assert.deepEqual(db.rows.get("contentModules"), [
      { _id: "editorial", kind: "education" }
    ]);

    for (const step of USER_SCOPED_DELETION_STEPS) {
      assert.deepEqual(db.rows.get(step.table), [
        { _id: `${step.table}_other`, [step.field]: "user_other" }
      ]);
    }
  });

  it("REPRO (P1 11): se lleva el trabajo de reconciliación y su cupo, y cancela el watchdog", async () => {
    // Sin esto quedaba una fila `reconcileJobs` con el Clerk id y un watchdog
    // agendado que, al despertar, salía a preguntarle a RevenueCat por una
    // cuenta que ya no existe. Y el contador del cupo sobrevivía con el sujeto
    // pegado a su `bucketKey`.
    const db = fakeDb({
      users: [{ _id: "user_current", clerkUserId: "clerk_current" }],
      reconcileJobs: [
        { _id: "job_current", clerkUserId: "clerk_current", status: "pending", watchdogId: "sched_1" },
        { _id: "job_other", clerkUserId: "clerk_other", status: "pending" }
      ],
      publicRateLimits: [
        {
          _id: "cupo_current",
          scope: RECONCILE_COOLDOWN.scope,
          subjectHash: rateLimitSubjectHash("clerk_current"),
          bucketKey: "revenuecat_reconcile:60000:1:hash"
        },
        {
          _id: "cupo_other",
          scope: RECONCILE_COOLDOWN.scope,
          subjectHash: rateLimitSubjectHash("clerk_other"),
          bucketKey: "revenuecat_reconcile:60000:1:otro"
        },
        {
          _id: "cupo_otro_scope",
          scope: "onboarding_triad:draft",
          subjectHash: rateLimitSubjectHash("clerk_current"),
          bucketKey: "onboarding:1"
        }
      ]
    });

    const cancelados: unknown[] = [];
    await deleteAccountData(
      { db, scheduler: { cancel: async (id: unknown) => void cancelados.push(id) } },
      { userId: "user_current", clerkUserIds: ["clerk_current"] }
    );

    assert.deepEqual(
      (db.rows.get("reconcileJobs") ?? []).map((row) => row._id),
      ["job_other"],
      "el trabajo de la cuenta borrada no sobrevive"
    );
    assert.deepEqual(cancelados, ["sched_1"], "y su watchdog se cancela");
    // Comparación estable: lo que importa es el CONJUNTO que sobrevive, no el
    // orden en que la base los devuelve.
    assert.deepEqual(
      [...(db.rows.get("publicRateLimits") ?? []).map((row) => row._id)].sort(),
      ["cupo_other", "cupo_otro_scope"].sort(),
      "sólo se borra el cupo de reconciliación de esta cuenta"
    );
  });

  it("el `bucketKey` del rate limit no lleva el sujeto en claro", () => {
    // P1 11: esta tabla puede sobrevivir a un borrado que falle a mitad.
    const key = buildRateLimitBucketKey(RECONCILE_COOLDOWN.scope, "clerk_abc123", 0, 60_000);
    assert.equal(key.includes("clerk_abc123"), false);
    assert.equal(key.includes(rateLimitSubjectHash("clerk_abc123")), true);
    // Y sigue siendo determinístico y distinto por sujeto.
    assert.equal(key, buildRateLimitBucketKey(RECONCILE_COOLDOWN.scope, "clerk_abc123", 0, 60_000));
    assert.notEqual(key, buildRateLimitBucketKey(RECONCILE_COOLDOWN.scope, "clerk_otro", 0, 60_000));
  });

  it("is idempotent and cleans Clerk-scoped payment data when the user row is absent", async () => {
    const db = fakeDb({
      paymentEvents: [
        { _id: "payment_current", clerkUserId: "clerk_current" },
        { _id: "payment_other", clerkUserId: "clerk_other" }
      ]
    });

    const first = await deleteAccountData(
      { db },
      { clerkUserIds: ["clerk_current", "clerk_current"] }
    );
    const second = await deleteAccountData(
      { db },
      { clerkUserIds: ["clerk_current"] }
    );

    assert.equal(first, 1);
    assert.equal(second, 0);
    assert.deepEqual(db.rows.get("paymentEvents"), [
      { _id: "payment_other", clerkUserId: "clerk_other" }
    ]);
    // La garantía es que TODA lectura va por índice y con el id ya
    // deduplicado; nunca un scan. El número absoluto de lecturas cambia cuando
    // se suma una tabla al plan (reconcileJobs, los contadores del cupo), así
    // que fijarlo convertía una ampliación legítima en un fallo.
    assert.ok(
      db.indexReads.every((read) => read.index.startsWith("by_")),
      "toda lectura tiene que ir por un índice"
    );
    assert.equal(
      db.indexReads.filter((read) => read.table === "paymentEvents").length,
      2,
      "una lectura de paymentEvents por llamada: el Clerk id duplicado no la repite"
    );
  });

  it("deduplicates Clerk ids while still deleting the Convex user graph", async () => {
    const initialRows: Record<string, Row[]> = {
      users: [{ _id: "user_current", clerkUserId: "clerk_current" }],
      paymentEvents: [{ _id: "payment_current", clerkUserId: "clerk_current" }]
    };
    for (const step of USER_SCOPED_DELETION_STEPS) initialRows[step.table] = [];

    const db = fakeDb(initialRows);
    const deleted = await deleteAccountData(
      { db },
      { userId: "user_current", clerkUserIds: ["clerk_current", "clerk_current", ""] }
    );

    assert.equal(deleted, 2);
    assert.deepEqual(db.rows.get("users"), []);
    assert.equal(db.indexReads.filter((read) => read.table === "paymentEvents").length, 1);
  });

  it("deletes anonymous events linked through the user's installation actor", async () => {
    const db = fakeDb({
      users: [{ _id: "user_current", clerkUserId: "clerk_current" }],
      productActors: [
        { _id: "actor_current", userId: "user_current", installationId: "install_current" },
        { _id: "actor_other", userId: "user_other", installationId: "install_other" }
      ],
      productEvents: [
        { _id: "anonymous_current", actorId: "actor_current" },
        { _id: "backend_current", userId: "user_current" },
        { _id: "anonymous_other", actorId: "actor_other" }
      ],
      paymentEvents: []
    });
    for (const step of USER_SCOPED_DELETION_STEPS) {
      if (!db.rows.has(step.table)) db.rows.set(step.table, []);
    }

    await deleteAccountData(
      { db },
      { userId: "user_current", clerkUserIds: ["clerk_current"] }
    );

    assert.deepEqual(db.rows.get("productEvents"), [
      { _id: "anonymous_other", actorId: "actor_other" }
    ]);
    assert.deepEqual(db.rows.get("productActors"), [
      { _id: "actor_other", userId: "user_other", installationId: "install_other" }
    ]);
  });
});
