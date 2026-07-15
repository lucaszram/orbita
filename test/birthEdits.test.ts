import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyBirthEdits,
  buildBackendBirthPayload,
  dateToIso,
  dateToTime,
  hasBirthChanges,
  isoToDate,
  timeToDate,
  type BirthEdits
} from "../src/domain/birthEdits";
import type { UserProfile } from "../src/domain/types";

const profile: UserProfile = {
  id: "visitante-1996-01-15",
  name: "Visitante",
  birthDate: "1996-01-15",
  birthTime: "12:30",
  birthPlace: "Buenos Aires, Argentina",
  zodiacSign: "capricornio",
  interests: ["claridad", "energia"],
  guidanceTone: "protectora",
  notificationTime: "09:00",
  createdAt: "2026-01-01T00:00:00.000Z"
};

function edits(overrides: Partial<BirthEdits> = {}): BirthEdits {
  return {
    birthDate: profile.birthDate,
    birthTime: profile.birthTime ?? null,
    place: { label: profile.birthPlace ?? "", changed: false },
    ...overrides
  };
}

describe("hasBirthChanges — Guardar solo cuando hay cambios", () => {
  it("sin cambios → false (cancelar/guardar no hace nada)", () => {
    assert.equal(hasBirthChanges(profile, edits()), false);
  });

  it("detecta cambio de fecha, hora y lugar", () => {
    assert.equal(hasBirthChanges(profile, edits({ birthDate: "1996-02-15" })), true);
    assert.equal(hasBirthChanges(profile, edits({ birthTime: "08:00" })), true);
    assert.equal(hasBirthChanges(profile, edits({ birthTime: null })), true);
    assert.equal(
      hasBirthChanges(profile, edits({ place: { label: "Córdoba, Argentina", changed: true } })),
      true
    );
  });

  it("perfil sin hora + editor sin hora → sin cambios", () => {
    const noTime = { ...profile, birthTime: undefined };
    assert.equal(hasBirthChanges(noTime, edits({ birthTime: null })), false);
  });
});

describe("applyBirthEdits — lo que se guarda en el perfil local", () => {
  it("aplica fecha nueva y recalcula el signo", () => {
    const updates = applyBirthEdits(profile, edits({ birthDate: "1996-04-25" }));
    assert.equal(updates.birthDate, "1996-04-25");
    assert.equal(updates.zodiacSign, "tauro");
  });

  it('"No sé la hora" limpia la hora guardada', () => {
    const updates = applyBirthEdits(profile, edits({ birthTime: null }));
    assert.equal(updates.birthTime, undefined);
  });

  it("lugar nuevo reemplaza el label local", () => {
    const updates = applyBirthEdits(
      profile,
      edits({ place: { label: "Córdoba, Argentina", changed: true } })
    );
    assert.equal(updates.birthPlace, "Córdoba, Argentina");
  });
});

describe("buildBackendBirthPayload — persistencia sin pisar datos remotos", () => {
  const remote = {
    birthPlaceLabel: "Lomas de Zamora, Buenos Aires, Argentina",
    latitude: -34.76,
    longitude: -58.4,
    timezone: "America/Argentina/Buenos_Aires"
  };

  it("lugar sin cambio → preserva label y coordenadas remotas", () => {
    const payload = buildBackendBirthPayload(edits({ birthTime: "08:00" }), remote);
    assert.equal(payload.birthTime, "08:00");
    assert.equal(payload.birthPlaceLabel, remote.birthPlaceLabel);
    assert.equal(payload.latitude, remote.latitude);
    assert.equal(payload.longitude, remote.longitude);
    assert.equal(payload.timezone, remote.timezone);
  });

  it("lugar nuevo → usa el label y las coordenadas del lugar elegido", () => {
    const payload = buildBackendBirthPayload(
      edits({
        place: {
          label: "Córdoba, Argentina",
          latitude: -31.42,
          longitude: -64.18,
          timezone: "America/Argentina/Cordoba",
          changed: true
        }
      }),
      remote
    );
    assert.equal(payload.birthPlaceLabel, "Córdoba, Argentina");
    assert.equal(payload.latitude, -31.42);
    assert.equal(payload.timezone, "America/Argentina/Cordoba");
  });

  it("sin doc remoto (primera persistencia) → manda lo del editor", () => {
    const payload = buildBackendBirthPayload(edits(), null);
    assert.equal(payload.birthPlaceLabel, profile.birthPlace);
    assert.equal(payload.latitude, undefined);
  });

  it('"No sé la hora" → birthTime undefined (precision unknown aguas abajo)', () => {
    const payload = buildBackendBirthPayload(edits({ birthTime: null }), remote);
    assert.equal(payload.birthTime, undefined);
  });
});

describe("helpers fecha/hora del editor", () => {
  it("iso ↔ Date roundtrip estable (sin corrimiento de timezone)", () => {
    assert.equal(dateToIso(isoToDate("1996-01-15")), "1996-01-15");
    assert.equal(dateToIso(isoToDate("2002-12-31")), "2002-12-31");
  });

  it("hora ↔ Date roundtrip", () => {
    assert.equal(dateToTime(timeToDate("08:05")), "08:05");
    assert.equal(dateToTime(timeToDate("23:59")), "23:59");
    assert.equal(dateToTime(timeToDate(undefined)), "12:00");
  });
});
