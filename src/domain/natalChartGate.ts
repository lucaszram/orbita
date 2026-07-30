/**
 * ¿Se puede dibujar la rueda natal de ESTA persona?
 *
 * La única fuente de la carta es `charts.current`. El problema es que esa query
 * no garantiza que la carta corresponda a los datos natales vigentes: el backend
 * busca primero la carta exacta (`by_cacheKey`, derivada del hash de los datos)
 * y, si no la encuentra, **cae a la última carta del usuario**
 * (`by_user` / `by_user_version`). O sea que después de editar fecha, hora o
 * lugar —`birthData.upsertForCurrentUser` PATCHEA la misma fila, así que el
 * `birthDataId` no cambia— `charts.current` sigue devolviendo la carta VIEJA
 * hasta que se recalcule. Dibujarla sería presentar la carta de otros datos como
 * si fuera la actual: exactamente el tipo de dato inventado que este trabajo
 * elimina.
 *
 * Por eso una rueda personal exige DOS cosas, no una:
 * 1. datos natales remotos COMPLETOS (misma regla que el borde de escritura,
 *    vía `resolveBirthInfo` → `validateBirthPayload`), y
 * 2. una carta que **coincida** con esos datos.
 *
 * La coincidencia se prueba con lo que el documento trae:
 * - `birthDataHash` (lo escribe `persistCalculatedNatalChart`) contra el mismo
 *   hash recalculado acá — es el criterio que usa el backend para el cacheKey; y
 * - `payload.birth`, el eco de los datos normalizados con los que el proveedor
 *   calculó la carta (`normalizeAstrologyApiNatalChart` guarda `birth: input`).
 *
 * Si no se puede probar la coincidencia con ninguno de los dos, la respuesta es
 * NO. Sin fallback, sin placeholder, sin rueda "aproximada".
 */
import { resolveBirthInfo } from "@/domain/birthInfo";

export type PersonalChartGate =
  /** Alguna de las dos queries todavía no resolvió. No se afirma nada. */
  | "cargando"
  /** Sin datos natales remotos completos: no hay carta posible. */
  | "datosIncompletos"
  /** Datos completos, el backend confirmó que no hay carta. */
  | "sinCarta"
  /** Hay carta, pero no es la de estos datos (o no se puede probar que lo sea). */
  | "desactualizada"
  /** Datos completos + carta que coincide: se puede dibujar. */
  | "listo";

/** Documento de `birthData.getCurrent` (los campos que importan acá). */
export type BirthDataDoc = {
  _id?: string;
  birthDate?: string;
  birthTime?: string;
  birthTimePrecision?: string;
  birthPlaceLabel?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
} | null;

/** Documento de `charts.current` (los campos que importan acá). */
export type ChartDoc = {
  birthDataId?: string;
  birthDataHash?: string;
  payload?: unknown;
} | null;

export function personalChartGate(input: {
  /** `undefined` = query en vuelo. */
  birth: BirthDataDoc | undefined;
  /** `undefined` = query en vuelo; `null` = el backend confirmó que no hay carta. */
  chart: ChartDoc | undefined;
}): PersonalChartGate {
  if (input.birth === undefined || input.chart === undefined) return "cargando";
  const info = resolveBirthInfo({ doc: input.birth ?? null, resolved: true });
  if (info.status !== "complete") return "datosIncompletos";
  if (input.chart === null) return "sinCarta";
  return chartMatchesBirthData(input.chart, input.birth) ? "listo" : "desactualizada";
}

/** Atajo para las superficies que sólo preguntan "¿dibujo la rueda?". */
export function canRenderPersonalWheel(gate: PersonalChartGate): boolean {
  return gate === "listo";
}

/**
 * ¿La carta corresponde a estos datos natales?
 *
 * Se exige al menos UNA prueba positiva (hash o eco del payload). Un documento
 * que no trae ninguna de las dos no se puede verificar, y "no verificable" se
 * trata como "no coincide": es la dirección segura.
 */
export function chartMatchesBirthData(chart: ChartDoc, birth: BirthDataDoc): boolean {
  if (!chart || !birth) return false;
  // Fila distinta = otra persona o otro registro natal. Cortocircuito.
  if (chart.birthDataId && birth._id && chart.birthDataId !== birth._id) return false;

  let proof = false;

  const expectedHash = birthDataHash(birth);
  if (chart.birthDataHash != null) {
    if (expectedHash === null || chart.birthDataHash !== expectedHash) return false;
    proof = true;
  }

  const echo = birthEchoOf(chart.payload);
  if (echo) {
    if (!echoMatches(echo, birth)) return false;
    proof = true;
  }

  return proof;
}

/**
 * Mismo hash que `convex/lib/birthDataConsistency.buildBirthDataHash`.
 *
 * Está duplicado a propósito: `convex/**` no es territorio del frontend y el
 * cliente necesita poder VERIFICAR, no confiar. El orden de las claves importa
 * (es un `JSON.stringify`), así que se replica tal cual. `null` = faltan datos
 * para calcularlo (p. ej. sin `birthTimePrecision`), y entonces el hash no
 * puede servir de prueba.
 */
export function birthDataHash(birth: BirthDataDoc): string | null {
  if (!birth || !birth.birthDate || !birth.birthPlaceLabel || !birth.timezone) return null;
  if (!birth.birthTimePrecision) return null;
  return JSON.stringify({
    birthDate: birth.birthDate,
    birthTime: birth.birthTime ?? null,
    birthTimePrecision: birth.birthTimePrecision,
    birthPlaceLabel: birth.birthPlaceLabel,
    latitude: roundedCoordinate(birth.latitude),
    longitude: roundedCoordinate(birth.longitude),
    timezone: birth.timezone
  });
}

function roundedCoordinate(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(6)) : null;
}

type BirthEcho = {
  birthDate?: unknown;
  birthTime?: unknown;
  birthTimePrecision?: unknown;
  birthPlaceLabel?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  timezone?: unknown;
};

/** `payload.birth`: los datos normalizados con los que se calculó la carta. */
function birthEchoOf(payload: unknown): BirthEcho | null {
  const birth = (payload as { birth?: unknown } | null | undefined)?.birth;
  if (!birth || typeof birth !== "object") return null;
  const echo = birth as BirthEcho;
  // Sin fecha no hay eco útil que comparar.
  return typeof echo.birthDate === "string" ? echo : null;
}

function echoMatches(echo: BirthEcho, birth: BirthDataDoc): boolean {
  if (!birth) return false;
  if (str(echo.birthDate) !== str(birth.birthDate)) return false;
  if (str(echo.birthPlaceLabel) !== str(birth.birthPlaceLabel)) return false;
  if (str(echo.timezone) !== str(birth.timezone)) return false;
  if (!sameCoordinate(echo.latitude, birth.latitude)) return false;
  if (!sameCoordinate(echo.longitude, birth.longitude)) return false;
  // El proveedor descarta la hora cuando la precisión es `unknown`
  // (`normalizeBirthInput`): la comparación replica esa normalización.
  const precision = str(echo.birthTimePrecision) || str(birth.birthTimePrecision);
  const expectedTime = precision === "unknown" ? null : normalizedTime(birth.birthTime);
  if (normalizedTime(typeof echo.birthTime === "string" ? echo.birthTime : undefined) !== expectedTime) return false;
  return true;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Misma normalización que `normalizeBirthTime` del backend: `H:MM` → `HH:MM`. */
function normalizedTime(value: string | undefined): string | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function sameCoordinate(a: unknown, b: unknown): boolean {
  const x = roundedCoordinate(a);
  const y = roundedCoordinate(b);
  if (x === null || y === null) return x === y;
  return Math.abs(x - y) < 1e-6;
}
