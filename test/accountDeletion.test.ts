import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  deleteAccountData,
  USER_SCOPED_DELETION_STEPS
} from "../convex/lib/accountDeletion";

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
        withIndex(index: string, build: (q: { eq: (field: string, value: unknown) => unknown }) => any) {
          const condition = build({
            eq(field: string, value: unknown) {
              return { field, value };
            }
          });
          indexReads.push({ table, index, field: condition.field, value: condition.value });
          return {
            async collect() {
              return (rows.get(table) ?? []).filter(
                (row) => row[condition.field] === condition.value
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
    assert.deepEqual(db.rows.get("contentModules"), [
      { _id: "editorial", kind: "education" }
    ]);

    for (const step of USER_SCOPED_DELETION_STEPS) {
      assert.deepEqual(db.rows.get(step.table), [
        { _id: `${step.table}_other`, [step.field]: "user_other" }
      ]);
    }
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
    assert.equal(db.indexReads.length, 2);
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
});
