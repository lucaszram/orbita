/**
 * Una reafirmación natal NO puede abortar un refresco de capas en vuelo.
 *
 * ## De dónde sale esta prueba
 *
 * El handoff dejó abierta una pregunta: si el arreglo de la reafirmación
 * (`identidadYaVigente`, ver `natalReaffirmNoOp.test.ts`) también mataba los
 * errores de `layers:refreshForDate`. La respuesta, medida contra el código, es
 * que son dos cosas distintas y que la de capas ya era inmune — pero **nadie lo
 * estaba fijando**, y esa inmunidad es exactamente lo que se pierde con una
 * línea:
 *
 * - `convex/relationships.ts` mete `natalChartUpdatedAt` en el `inputHash` de la
 *   comparación. Por eso el patch incondicional de la reafirmación la rompía:
 *   cada refresh tocaba `updatedAt` y `RELATIONSHIP_INPUT_CHANGED_DURING_REFRESH`
 *   entraba en loop.
 * - `buildLayerRefreshInputFingerprint` NO lo mete. Su huella es identidad
 *   (`userId`, `birthDataId`, `natalChartId`), los datos natales
 *   (`natalEphemerisInputHash`, que sí incluye `birthData.updatedAt`) y la
 *   geometría verificada. Un timestamp de la carta no es un insumo.
 *
 * ## La regla
 *
 * Copiar la huella de Vínculos —agregarle `natalChartUpdatedAt` "por
 * simetría"— convertiría CADA refresco de fondo en un
 * `LAYER_INPUT_CHANGED_DURING_REFRESH`: el ciclo de capas reusa la carta varias
 * veces por minuto. Sería el mismo defecto que ya costó una noche, mudado de
 * tabla.
 *
 * Lo que sí es un insumo se sigue exigiendo: si la carta vigente pasa a ser
 * OTRA fila, el refresco viejo no puede persistir.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { buildLayerRefreshInputFingerprint, persistRefresh } from "../convex/layers";
import type { BirthDataSnapshot } from "../convex/lib/layerContract";
import { buildBirthDataHash, buildNatalChartCacheKey } from "../convex/lib/birthDataConsistency";
import { chartSnapshotFromPayload } from "../convex/lib/natalGeometry";
import { ROOT } from "./moduleGraph";

const BIRTH: BirthDataSnapshot = {
  birthDate: "1994-05-04",
  birthTime: "08:37",
  birthTimePrecision: "known",
  birthPlaceLabel: "Rosario",
  latitude: -32.95,
  longitude: -60.65,
  timezone: "America/Argentina/Cordoba",
  updatedAt: 10,
};

const SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
] as const;

/** Carta legada con las doce cúspides: la huella lee geometría verificada. */
const PAYLOAD = {
  summary: {},
  placements: [
    { key: "sun", label: "Sol", sign: "taurus", signEs: "Tauro", degree: 13.5, fullDegree: 43.5, house: 10 },
    { key: "moon", label: "Luna", sign: "virgo", signEs: "Virgo", degree: 2.25, fullDegree: 152.25, house: 2 },
  ],
  houses: SIGNS.map((sign, index) => ({
    house: index + 1,
    sign,
    signEs: sign,
    degree: index * 30 + 7,
    theme: "",
  })),
};

const USER_ID = "user-fixture";
const BIRTH_ID = "birth-fixture";
const CHART_ID = "chart-fixture";
/** Misma fila natal, en la forma que hashea `findExactNatalChart` (sin `null`). */
const CACHE_KEY = buildNatalChartCacheKey(
  USER_ID,
  buildBirthDataHash({
    birthDate: BIRTH.birthDate,
    birthTime: BIRTH.birthTime ?? undefined,
    birthTimePrecision: BIRTH.birthTimePrecision,
    birthPlaceLabel: BIRTH.birthPlaceLabel,
    latitude: BIRTH.latitude ?? undefined,
    longitude: BIRTH.longitude ?? undefined,
    timezone: BIRTH.timezone,
  })
);

/** Fila natal viva: `updatedAt` mutable, todo lo demás fijo. */
function contexto(chart: Record<string, unknown>) {
  const escrituras: unknown[] = [];
  const birthDocument = { _id: BIRTH_ID, userId: USER_ID, ...BIRTH };
  return {
    escrituras,
    ctx: {
      db: {
        async get(id: string) {
          if (id === USER_ID) return { _id: id };
          if (id === BIRTH_ID) return birthDocument;
          if (id === chart._id) return chart;
          return null;
        },
        query(table: string) {
          const chain = {
            withIndex(_name: string, callback: (value: { eq: () => unknown }) => unknown) {
              callback({ eq: () => chain });
              return chain;
            },
            order() {
              return chain;
            },
            async first() {
              if (table === "birthData") return birthDocument;
              if (table === "natalCharts") return chart;
              return null;
            },
          };
          return chain;
        },
        async patch(...args: unknown[]) {
          escrituras.push(["patch", ...args]);
        },
        async insert(...args: unknown[]) {
          escrituras.push(["insert", ...args]);
        },
      },
    },
  };
}

/** El mismo snapshot que arma el handler (`snapshotChart` delega acá). */
const SNAPSHOT = chartSnapshotFromPayload(PAYLOAD);

function huella(chart: { _id: string }, birthData: BirthDataSnapshot = BIRTH) {
  return buildLayerRefreshInputFingerprint({
    userId: USER_ID,
    birthDataId: BIRTH_ID,
    natalChartId: chart._id,
    birthData,
    chart: SNAPSHOT,
  });
}

const ARGS_BASE = {
  userId: USER_ID,
  birthDataId: BIRTH_ID,
  natalChartId: CHART_ID,
  localDate: "2026-08-15",
  timezone: "UTC",
  results: [],
  sky: null,
  natalEphemeris: null,
};

describe("refresco de capas — la reafirmación natal no es un cambio de insumo", () => {
  it("bumpear sólo `natalCharts.updatedAt` deja válido el refresco en vuelo", async () => {
    // Estado al SALIR el refresco.
    const chart: Record<string, unknown> = {
      _id: CHART_ID,
      userId: USER_ID,
      birthDataId: BIRTH_ID,
      cacheKey: CACHE_KEY,
      payload: PAYLOAD,
      updatedAt: 100,
    };
    const esperada = huella({ _id: CHART_ID });

    // …y la reafirmación corre en el medio: misma fila, mismo payload, misma
    // identidad; sólo el timestamp se mueve.
    chart.updatedAt = 500;

    const { ctx } = contexto(chart);
    assert.deepEqual(
      await (persistRefresh as any)._handler(ctx, {
        ...ARGS_BASE,
        expectedInputFingerprint: esperada,
      }),
      { written: 0 },
      "un timestamp que se movió no puede tirar LAYER_INPUT_CHANGED_DURING_REFRESH"
    );

    // Y la huella es literalmente la misma antes y después.
    assert.equal(huella({ _id: CHART_ID }), esperada);
  });

  it("cambiar de FILA natal sí invalida el refresco", async () => {
    // Contraste necesario: la inmunidad es al timestamp, no a la identidad. Una
    // carta recalculada en otra fila es otro insumo y el refresco viejo no puede
    // persistir sobre ella.
    const vieja = huella({ _id: CHART_ID });
    const chart: Record<string, unknown> = {
      _id: "chart-recalculada",
      userId: USER_ID,
      birthDataId: BIRTH_ID,
      cacheKey: CACHE_KEY,
      payload: PAYLOAD,
      updatedAt: 500,
    };
    const { ctx, escrituras } = contexto(chart);

    await assert.rejects(
      () =>
        (persistRefresh as any)._handler(ctx, {
          ...ARGS_BASE,
          natalChartId: "chart-recalculada",
          expectedInputFingerprint: vieja,
        }),
      /LAYER_INPUT_CHANGED_DURING_REFRESH/
    );
    assert.equal(escrituras.length, 0, "con insumos obsoletos no se escribe nada");
  });

  it("`natalChartUpdatedAt` es de Vínculos y sólo de Vínculos", () => {
    // La prueba de comportamiento no alcanza sola: pasaría igual si alguien
    // agregara el campo y el fixture lo dejara quieto. Esto fija la causa.
    const layers = readFileSync(join(ROOT, "convex/layers.ts"), "utf8");
    const cuerpo = layers.slice(
      layers.indexOf("export function buildLayerRefreshInputFingerprint"),
      layers.indexOf("function houseNumberForLongitude")
    );
    assert.ok(cuerpo.length > 0, "no se encontró la huella");
    assert.doesNotMatch(cuerpo, /updatedAt/, "la huella de capas no lee ningún timestamp");
    assert.match(
      readFileSync(join(ROOT, "convex/relationships.ts"), "utf8"),
      /natalChartUpdatedAt/,
      "el campo existe, pero es del inputHash de la comparación"
    );

    // Lo que SÍ mueve la huella es un dato natal de verdad.
    assert.notEqual(
      huella({ _id: CHART_ID }, { ...BIRTH, birthTime: "09:12", updatedAt: 11 }),
      huella({ _id: CHART_ID }),
      "editar la hora sí es un cambio de insumo"
    );
  });
});
