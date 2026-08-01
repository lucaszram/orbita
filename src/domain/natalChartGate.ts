/**
 * ¿Se puede dibujar la rueda natal de ESTA persona?
 *
 * La única fuente de la carta es `charts.current`, y esa query es AUTORITATIVA:
 * el backend busca la carta por el cacheKey exacto derivado de los datos
 * natales vigentes y devuelve `null` si no existe. No hay fallback a "la última
 * carta del usuario", así que una carta no nula ES la carta de los datos
 * actuales por construcción.
 *
 * Además, el documento público que devuelve `charts.current` está sanitizado
 * por privacidad: no trae `birthDataId`, `birthDataHash` ni `payload.birth`
 * (el hash era una serialización de los datos natales, no un digest opaco).
 * El cliente no tiene —ni necesita— con qué "verificar" la correspondencia:
 * re-chequearla acá sólo puede producir falsos negativos, como el bug que dejó
 * una carta recién recalculada clavada en recálculo infinito.
 *
 * Por eso el gate hace exactamente dos preguntas:
 * 1. ¿hay datos natales remotos COMPLETOS? (misma regla que el borde de
 *    escritura, vía `resolveBirthInfo` → `validateBirthPayload`), y
 * 2. ¿el backend devolvió una carta? `null` = no hay carta; no nula = listo.
 */
import { resolveBirthInfo } from "@/domain/birthInfo";

export type PersonalChartGate =
  /** Alguna de las dos queries todavía no resolvió. No se afirma nada. */
  | "cargando"
  /** Sin datos natales remotos completos: no hay carta posible. */
  | "datosIncompletos"
  /** Datos completos, el backend confirmó que no hay carta. */
  | "sinCarta"
  /**
   * Legado: `personalChartGate` ya NO devuelve este estado — `charts.current`
   * es autoritativo y no puede entregar una carta de otros datos. Queda en el
   * union porque las superficies conservan la rama defensiva que lo maneja.
   */
  | "desactualizada"
  /** Datos completos + la carta que el backend declaró vigente. */
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

/**
 * Documento público de `charts.current`. Sanitizado: sin `birthDataId`,
 * `birthDataHash` ni `payload.birth`. Acá sólo importa si es nulo o no.
 */
export type ChartDoc = {
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
  return "listo";
}

/** Atajo para las superficies que sólo preguntan "¿dibujo la rueda?". */
export function canRenderPersonalWheel(gate: PersonalChartGate): boolean {
  return gate === "listo";
}
