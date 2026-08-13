import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidPersistedProfileNamePart,
  normalizeProfileNamePart,
  normalizedProfileName
} from "../convex/lib/userProfile";

describe("optional profile names supplied by Clerk", () => {
  it("normalizes unicode names and repeated whitespace", () => {
    assert.deepEqual(normalizedProfileName("  María   José ", " O’Connor  Pérez "), {
      firstName: "María José",
      lastName: "O’Connor Pérez",
      name: "María José O’Connor Pérez"
    });
  });

  it("rejects blank, oversized and control-character values", () => {
    assert.throws(() => normalizeProfileNamePart("   ", "First name"), /required/);
    assert.throws(() => normalizeProfileNamePart("a".repeat(81), "First name"), /too long/);
    assert.throws(() => normalizeProfileNamePart("Lu\u0000cas", "First name"), /unsupported/);
  });

  it("returns the same canonical payload when an onboarding retry repeats", () => {
    const first = normalizedProfileName("Lucas", "Ramos");
    const retry = normalizedProfileName(" Lucas ", " Ramos ");
    assert.deepEqual(retry, first);
  });

  it("uses the same rules when readiness validates persisted names", () => {
    assert.equal(isValidPersistedProfileNamePart("María José"), true);
    assert.equal(isValidPersistedProfileNamePart("  "), false);
    assert.equal(isValidPersistedProfileNamePart("a".repeat(81)), false);
    assert.equal(isValidPersistedProfileNamePart("Lu\u0000cas"), false);
  });
});
