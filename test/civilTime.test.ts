import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveZonedCivilTime } from "../convex/lib/civilTime";

describe("civil time resolution", () => {
  it("resuelve una hora normal con el desplazamiento vigente en ese instante", () => {
    const result = resolveZonedCivilTime({
      localDate: "2024-03-10",
      localTime: "03:30",
      timezone: "America/New_York",
    });

    assert.equal(result.status, "exact");
    if (result.status !== "exact") return;
    assert.equal(new Date(result.instantMs).toISOString(), "2024-03-10T07:30:00.000Z");
    assert.equal(result.offsetMinutes, -240);
  });

  it("rechaza la hora que no existió durante el salto del reloj", () => {
    assert.deepEqual(
      resolveZonedCivilTime({
        localDate: "2024-03-10",
        localTime: "02:30",
        timezone: "America/New_York",
      }),
      { status: "gap", candidates: [] },
    );
  });

  it("expone las dos ocurrencias de una hora repetida sin elegir por la persona", () => {
    const result = resolveZonedCivilTime({
      localDate: "2024-11-03",
      localTime: "01:30",
      timezone: "America/New_York",
    });

    assert.equal(result.status, "fold");
    if (result.status !== "fold") return;
    assert.deepEqual(
      result.candidates.map((candidate) => ({
        instant: new Date(candidate.instantMs).toISOString(),
        offsetMinutes: candidate.offsetMinutes,
      })),
      [
        { instant: "2024-11-03T05:30:00.000Z", offsetMinutes: -240 },
        { instant: "2024-11-03T06:30:00.000Z", offsetMinutes: -300 },
      ],
    );
  });

  it("distingue una zona desconocida de un salto o una repetición", () => {
    assert.deepEqual(
      resolveZonedCivilTime({
        localDate: "2024-03-10",
        localTime: "12:00",
        timezone: "America/No_Existe",
      }),
      { status: "invalid", reason: "timezone", candidates: [] },
    );
  });

  it("rechaza fechas y horas civiles inválidas antes de resolver la zona", () => {
    assert.equal(
      resolveZonedCivilTime({
        localDate: "2023-02-29",
        localTime: "12:00",
        timezone: "UTC",
      }).status,
      "invalid",
    );
    assert.equal(
      resolveZonedCivilTime({
        localDate: "2024-02-29",
        localTime: "24:00",
        timezone: "UTC",
      }).status,
      "invalid",
    );
  });
});
