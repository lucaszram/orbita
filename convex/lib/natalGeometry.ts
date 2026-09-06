/**
 * La geometría natal verificable —los ejes y las doce cúspides— resuelta en un
 * solo lugar.
 *
 * Existe porque dos módulos tienen que estar de acuerdo sobre lo MISMO y no lo
 * estaban:
 *
 * - `layers.getNatalChartBase` decide si publica el Ascendente, el Medio Cielo y
 *   las casas, y cuando no puede lo declara con `verified_ascendant_mc_geometry`
 *   y `verified_twelve_house_geometry`.
 * - `charts.calculateOrCreateNatalChart` decide si la carta guardada alcanza o
 *   si hay que volver a pedírsela al proveedor.
 *
 * Con las dos reglas separadas quedaba un borde cerrado: el `cacheKey` de una
 * carta se arma con los DATOS natales, no con lo que el cálculo llegó a
 * publicar. Una corrida que devolvió posiciones pero no las casas —el proveedor
 * responde `houses: []` y entonces tampoco hay Ascendente— deja una fila que la
 * Carta declara `partial` y que la action reutilizaba para siempre: el botón de
 * recuperación pedía el cálculo, la action encontraba esa fila por `cacheKey` y
 * la volvía a persistir igual. Reintentar tiene que poder cambiar algo.
 *
 * Nada de esto es una regla nueva: es la de `layers.ts`, movida acá para que
 * `charts.ts` pueda preguntarle exactamente lo mismo.
 */
import type { NormalizedChartSnapshot } from "./layerContract";
import { extractNormalizedChartFromPayload } from "./orbita";

/** Alias con los que una carta legada puede nombrar un punto. */
const INTERVAL_POINT_ALIASES: Record<string, string> = {
  sol: "sun",
  luna: "moon",
  mercurio: "mercury",
  venus: "venus",
  marte: "mars",
  jupiter: "jupiter",
  saturno: "saturn",
  urano: "uranus",
  neptuno: "neptune",
  pluton: "pluto",
  asc: "ascendant",
  ascendente: "ascendant",
  descendente: "descendant",
  midheaven: "mc",
  medio_cielo: "mc",
  fondo_del_cielo: "ic",
};

/** Clave canónica de un punto, venga en inglés, en español o con acentos. */
export function intervalPointKey(value: string) {
  const normalized = value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return INTERVAL_POINT_ALIASES[normalized] ?? normalized;
}

/** Los cuatro ángulos que una carta legada puede traer como "planeta". */
export const LEGACY_ANGLE_KEYS = new Set(["ascendant", "descendant", "mc", "ic"]);

/** El payload guardado en `natalCharts`, estrechado a la forma del contrato. */
export function chartSnapshotFromPayload(payload: unknown): NormalizedChartSnapshot | null {
  const chart = extractNormalizedChartFromPayload(payload);
  if (!chart) return null;
  return {
    placements: chart.placements.map((placement) => ({
      key: placement.key,
      label: placement.label,
      sign: placement.sign,
      signEs: placement.signEs,
      degree: placement.degree,
      fullDegree: placement.fullDegree,
      house: placement.house,
      isRetrograde: placement.isRetrograde,
    })),
    houses: chart.houses.map((house) => ({
      house: house.house,
      sign: house.sign,
      signEs: house.signEs,
      degree: house.degree,
      theme: house.theme,
    })),
  };
}

/**
 * Lo que de una carta legada se puede VERIFICAR: los ángulos con longitud finita
 * y las doce cúspides sólo si están las doce, numeradas 1–12 y con grados
 * distintos. Una casa repetida o un grado repetido no es un juego de cúspides:
 * es un cálculo a medias, y publicarlo sería inventar.
 */
export function verifiedChartGeometry(
  chart: NormalizedChartSnapshot | null,
): NormalizedChartSnapshot | null {
  if (!chart) return null;
  const houses = [...chart.houses]
    .filter(
      (house) =>
        Number.isInteger(house.house) &&
        house.house >= 1 &&
        house.house <= 12 &&
        typeof house.degree === "number" &&
        Number.isFinite(house.degree) &&
        house.degree >= 0 &&
        house.degree < 360,
    )
    .sort((left, right) => left.house - right.house);
  const uniqueHouses = new Set(houses.map((house) => house.house));
  const uniqueCusps = new Set(houses.map((house) => house.degree));
  const hasTwelveCusps = houses.length === 12 && uniqueHouses.size === 12 && uniqueCusps.size === 12;
  const angles = chart.placements.filter((placement) => {
    const key = intervalPointKey(placement.key || placement.label);
    return (
      LEGACY_ANGLE_KEYS.has(key) &&
      typeof placement.fullDegree === "number" &&
      Number.isFinite(placement.fullDegree)
    );
  });
  if (!hasTwelveCusps && angles.length === 0) return null;
  return {
    placements: angles,
    houses: hasTwelveCusps ? houses : [],
  };
}

/**
 * El grado del Ascendente y del Medio Cielo que la carta permite publicar.
 *
 * Cada uno sale del ángulo declarado o, si no está, de la cúspide de su casa
 * (1 y 10). `null` significa que ese eje no se puede afirmar: no hay
 * aproximación que valga.
 */
export function verifiedAngleDegrees(geometry: NormalizedChartSnapshot | null): {
  ascendant: number | null;
  mc: number | null;
} {
  if (!geometry) return { ascendant: null, mc: null };
  const degree = (key: "ascendant" | "mc", houseNumber: 1 | 10) => {
    const placement = geometry.placements.find(
      (candidate) => intervalPointKey(candidate.key || candidate.label) === key,
    );
    const cusp = geometry.houses.find((candidate) => candidate.house === houseNumber);
    const raw = placement?.fullDegree ?? cusp?.degree;
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw >= 360) return null;
    return raw;
  };
  return { ascendant: degree("ascendant", 1), mc: degree("mc", 10) };
}

/**
 * ¿Esta carta trae TODA la geometría que una hora exacta permite calcular?
 *
 * Es decir: los dos ejes y las doce cúspides verificadas. Es exactamente la
 * condición con la que `layers.getNatalChartBase` deja de declarar
 * `verified_ascendant_mc_geometry` y `verified_twelve_house_geometry`, que son
 * los dos faltantes que hacen aparecer el botón de recuperación de la Carta.
 */
export function natalGeometryIsComplete(chart: NormalizedChartSnapshot | null): boolean {
  const geometry = verifiedChartGeometry(chart);
  if (!geometry) return false;
  if (geometry.houses.length !== 12) return false;
  const angles = verifiedAngleDegrees(geometry);
  return angles.ascendant !== null && angles.mc !== null;
}

/**
 * ¿La carta guardada alcanza para los datos con los que se calculó?
 *
 * Sin hora exacta no hay geometría que exigir —el contrato la retira a
 * propósito—, así que cualquier payload guardado es suficiente y el cache sano
 * no se toca. Con hora exacta, suficiente significa completo: si falta
 * geometría, volver a pedirle lo mismo al cache no puede cambiar nada.
 */
export function storedNatalChartIsSufficient(args: {
  birthTimePrecision: string | null | undefined;
  payload: unknown;
}): boolean {
  if (args.birthTimePrecision !== "known") return true;
  return natalGeometryIsComplete(chartSnapshotFromPayload(args.payload));
}
