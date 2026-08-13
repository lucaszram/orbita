import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  canRevealNewTarotCard,
  FREE_TAROT_REVEAL_LIMIT,
  FREE_TAROT_REVEAL_LIMIT_REACHED
} from "../convex/lib/tarotAccess";

test("Free puede revelar exactamente siete cartas", () => {
  for (let count = 0; count < FREE_TAROT_REVEAL_LIMIT; count += 1) {
    assert.equal(canRevealNewTarotCard({ isPro: false, revealedCount: count }), true);
  }
});

test("Free necesita Plus para revelar la octava carta y las siguientes", () => {
  assert.equal(canRevealNewTarotCard({ isPro: false, revealedCount: FREE_TAROT_REVEAL_LIMIT }), false);
  assert.equal(canRevealNewTarotCard({ isPro: false, revealedCount: FREE_TAROT_REVEAL_LIMIT + 20 }), false);
});

test("Plus no tiene límite de revelaciones", () => {
  assert.equal(canRevealNewTarotCard({ isPro: true, revealedCount: 0 }), true);
  assert.equal(canRevealNewTarotCard({ isPro: true, revealedCount: 10_000 }), true);
});

test("el backend publica un marcador estable para que el cliente abra la paywall", () => {
  assert.equal(FREE_TAROT_REVEAL_LIMIT_REACHED, "FREE_TAROT_REVEAL_LIMIT_REACHED");
  const daily = readFileSync(join(process.cwd(), "convex/daily.ts"), "utf8");
  assert.match(daily, /new ConvexError\(\{ code: FREE_TAROT_REVEAL_LIMIT_REACHED \}\)/);
  assert.doesNotMatch(daily, /new Error\(FREE_TAROT_REVEAL_LIMIT_REACHED\)/);
});

test("reabrir la carta ya revelada gana antes de contar el límite Free", () => {
  const daily = readFileSync(join(process.cwd(), "convex/daily.ts"), "utf8");
  const reveal = daily.slice(daily.indexOf("export const revealCard = mutation({"));
  const idempotentReturn = reveal.indexOf("if (doc.revealedAt) return doc.revealedAt;");
  const entitlementCheck = reveal.indexOf("const pro = await isUserPro(ctx, user._id);");
  const patch = reveal.indexOf("await ctx.db.patch(doc._id, { revealedAt });");

  assert.ok(idempotentReturn >= 0, "falta la salida idempotente");
  assert.ok(entitlementCheck > idempotentReturn, "el límite no puede bloquear una carta ya revelada");
  assert.ok(patch > entitlementCheck, "la revelación nueva se persiste sólo después de autorizarla");
});
