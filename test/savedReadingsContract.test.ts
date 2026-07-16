import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_SAVED_READINGS_LIMIT,
  listSavedReadingsForUser,
  resolveSavedReadingsLimit,
  savedReadingListItem
} from "../convex/readings";

describe("readings.listSaved — recuperación remota", () => {
  it("acota el tamaño pedido y usa el límite activo por defecto", () => {
    assert.equal(resolveSavedReadingsLimit(), DEFAULT_SAVED_READINGS_LIMIT);
    assert.equal(resolveSavedReadingsLimit(Number.NaN), DEFAULT_SAVED_READINGS_LIMIT);
    assert.equal(resolveSavedReadingsLimit(0), 1);
    assert.equal(resolveSavedReadingsLimit(12.8), 12);
    assert.equal(resolveSavedReadingsLimit(500), 120);
  });

  it("devuelve el payload legado completo y normaliza opcionales", () => {
    const payload = { id: "lucas-2026-07-10", tarotCard: { name: "La Luna" } };
    assert.deepEqual(
      savedReadingListItem({
        _id: "saved_1",
        readingDate: "2026-07-10",
        readingPayload: payload,
        createdAt: 123
      }),
      {
        savedReadingId: "saved_1",
        readingId: null,
        readingDate: "2026-07-10",
        readingPayload: payload,
        note: null,
        createdAt: 123
      }
    );
  });

  it("consulta únicamente el índice del usuario autenticado y respeta el límite", async () => {
    const calls: Array<unknown> = [];
    const rows = [
      {
        _id: "saved_1",
        readingId: "reading_1",
        readingDate: "2026-07-10",
        readingPayload: { id: "lucas-2026-07-10" },
        createdAt: 123
      }
    ];
    const ctx = {
      db: {
        query: (table: string) => {
          calls.push(["table", table]);
          return {
            withIndex: (index: string, build: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
              calls.push(["index", index]);
              build({
                eq: (field, value) => {
                  calls.push(["eq", field, value]);
                  return {};
                }
              });
              return {
                order: (direction: string) => {
                  calls.push(["order", direction]);
                  return {
                    take: async (limit: number) => {
                      calls.push(["take", limit]);
                      return rows;
                    }
                  };
                }
              };
            }
          };
        }
      }
    };

    const result = await listSavedReadingsForUser(ctx, "user_lucas", 12.8);

    assert.deepEqual(calls, [
      ["table", "savedReadings"],
      ["index", "by_user"],
      ["eq", "userId", "user_lucas"],
      ["order", "desc"],
      ["take", 12]
    ]);
    assert.equal(result[0]?.savedReadingId, "saved_1");
  });
});
