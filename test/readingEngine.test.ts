import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createActiveTransit,
  createDailyReading,
  createRelationshipReading,
  createWeeklyEnergy,
  createWeeklyReading
} from "../src/domain/readingEngine";
import { UserProfile } from "../src/domain/types";
import { getZodiacSign } from "../src/domain/zodiac";

const baseProfile: UserProfile = {
  id: "lucia-1990-03-21",
  name: "Lucia",
  birthDate: "1990-03-21",
  zodiacSign: "aries",
  interests: ["amor", "energia"],
  guidanceTone: "protectora",
  notificationTime: "09:00",
  createdAt: "2026-01-01T00:00:00.000Z"
};

describe("zodiac", () => {
  it("calculates signs at boundary dates", () => {
    assert.equal(getZodiacSign("1990-03-21"), "aries");
    assert.equal(getZodiacSign("1990-04-20"), "tauro");
    assert.equal(getZodiacSign("1990-12-22"), "capricornio");
    assert.equal(getZodiacSign("1990-01-19"), "capricornio");
    assert.equal(getZodiacSign("1990-02-19"), "piscis");
  });
});

describe("daily reading engine", () => {
  it("keeps the same reading for the same profile and date", () => {
    const first = createDailyReading(baseProfile, "2026-07-01");
    const second = createDailyReading(baseProfile, "2026-07-01");

    assert.deepEqual(first, second);
  });

  it("changes the reading when the date changes", () => {
    const first = createDailyReading(baseProfile, "2026-07-01");
    const second = createDailyReading(baseProfile, "2026-07-02");

    assert.notEqual(first.id, second.id);
    assert.notEqual(first.luckyNumber, second.luckyNumber);
  });

  it("uses selected interests to alter recommendations", () => {
    const loveReading = createDailyReading(
      {
        ...baseProfile,
        interests: ["amor"]
      },
      "2026-07-01"
    );
    const workReading = createDailyReading(
      {
        ...baseProfile,
        interests: ["trabajo"]
      },
      "2026-07-01"
    );

    assert.equal(loveReading.recommendation.topic, "amor");
    assert.equal(workReading.recommendation.topic, "trabajo");
  });

  it("adds the acquisition hook and share card to the daily reading", () => {
    const reading = createDailyReading(baseProfile, "2026-07-01");

    assert.ok(reading.hook.length > 10);
    assert.equal(reading.shareCard.type, "daily");
    assert.equal(reading.pickCards.length, 3);
  });

  it("creates a full weekly calendar and weekly reading", () => {
    const energy = createWeeklyEnergy(baseProfile, "2026-07-01");
    const reading = createWeeklyReading(baseProfile, "2026-07-01");

    assert.equal(energy.days.length, 7);
    assert.equal(energy.weekStart, "2026-06-29");
    assert.equal(reading.weekStart, "2026-06-29");
    assert.ok(reading.luckyNumber >= 1 && reading.luckyNumber <= 99);
  });

  it("creates transit and relationship readings with safe bounded scores", () => {
    const transit = createActiveTransit(baseProfile, "2026-07-01");
    const relationship = createRelationshipReading(
      {
        ...baseProfile,
        relationshipTarget: {
          name: "Alex",
          zodiacSign: "libra"
        }
      },
      "2026-07-01"
    );

    assert.ok(transit.affectedSigns.length > 0);
    assert.equal(relationship.partnerName, "Alex");
    assert.equal(relationship.partnerSign, "libra");
    assert.ok(relationship.chemistryScore >= 54 && relationship.chemistryScore <= 96);
  });
});
