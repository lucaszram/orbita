import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { findCurrentUser } from "../convex/lib/users";

function fakeReadContext(args: { identity: null | { tokenIdentifier: string }; user?: unknown }) {
  let queries = 0;
  return {
    get queries() {
      return queries;
    },
    ctx: {
      auth: {
        async getUserIdentity() {
          return args.identity;
        }
      },
      db: {
        query(table: string) {
          assert.equal(table, "users");
          queries += 1;
          return {
            withIndex(index: string, build: (q: { eq: (field: string, value: string) => unknown }) => unknown) {
              assert.equal(index, "by_tokenIdentifier");
              assert.deepEqual(
                build({ eq: (field, value) => ({ field, value }) }),
                { field: "tokenIdentifier", value: args.identity?.tokenIdentifier }
              );
              return {
                async first() {
                  return args.user ?? null;
                }
              };
            }
          };
        }
      }
    }
  };
}

describe("account deletion read race", () => {
  it("treats a signed-out read as empty without querying the database", async () => {
    const fake = fakeReadContext({ identity: null });
    assert.equal(await findCurrentUser(fake.ctx as any), null);
    assert.equal(fake.queries, 0);
  });

  it("treats an authenticated identity whose user row was deleted as empty", async () => {
    const fake = fakeReadContext({ identity: { tokenIdentifier: "clerk|deleted" } });
    assert.equal(await findCurrentUser(fake.ctx as any), null);
    assert.equal(fake.queries, 1);
  });

  it("still returns the existing account during normal reads", async () => {
    const user = { _id: "user_live", tokenIdentifier: "clerk|live" };
    const fake = fakeReadContext({
      identity: { tokenIdentifier: "clerk|live" },
      user
    });
    assert.equal(await findCurrentUser(fake.ctx as any), user);
  });

  it("keeps every public account query on the non-throwing read helper", () => {
    const queryFiles = [
      "birthData.ts",
      "charts.ts",
      "contentModules.ts",
      "daily.ts",
      "journal.ts",
      "notifications.ts",
      "readings.ts",
      "relationships.ts",
      "subscriptions.ts",
      "void.ts"
    ];

    for (const file of queryFiles) {
      const source = readFileSync(`${process.cwd()}/convex/${file}`, "utf8");
      assert.doesNotMatch(
        source,
        /requireExistingUser\(ctx\)/,
        `${file} can throw while Clerk is closing a deleted account`
      );
      assert.match(source, /findCurrentUser\(ctx\)/, `${file} must handle a deleted account as empty`);
    }
  });

  it("preserves the contractual empty shape of the always-live queries", () => {
    const readings = readFileSync(`${process.cwd()}/convex/readings.ts`, "utf8");
    const charts = readFileSync(`${process.cwd()}/convex/charts.ts`, "utf8");
    const birthData = readFileSync(`${process.cwd()}/convex/birthData.ts`, "utf8");
    const subscriptions = readFileSync(`${process.cwd()}/convex/subscriptions.ts`, "utf8");

    assert.match(readings, /const user = await findCurrentUser\(ctx\);\n    if \(!user\) return null;/);
    assert.match(readings, /const user = await findCurrentUser\(ctx\);\n    if \(!user\) return \[\];/);
    assert.match(charts, /if \(!user\) return null;/);
    assert.match(birthData, /if \(!user\) return null;/);
    assert.match(subscriptions, /if \(!user\) return resolveEntitlement\(\[\], Date\.now\(\)\);/);
  });
});
