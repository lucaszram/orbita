import type { BirthDataDoc, NatalChartAspect, NatalChartPayload, SignPlacement } from "@/services/appRefs";

/**
 * Carta — cómo se lee el mapa natal en el hub y en la carta completa
 * (CORE-215). Módulo puro sobre `NatalChartPayload` (lo que `charts.current`
 * ya publica): códigos de dos letras, filas de la tríada, las diez posiciones
 * en orden, los ejes, los contactos ordenados por orbe, las doce casas con su
 * tema corto y los datos natales con su precisión. Nada se calcula de nuevo:
 * lo que el payload no trae (casas sin hora, aspectos en Free) se declara.
 * Ver `test/cartaCompleta.test.ts`.
 */

export const CODIGO_DE_CUERPO: Record<string, string> = {
  sun: "SO",
  moon: "LU",
  mercury: "ME",
  venus: "VE",
  mars: "MA",
  jupiter: "JU",
  saturn: "SA",
  uranus: "UR",
  neptune: "NE",
  pluto: "PL",
  ascendant: "AC",
  midheaven: "MC"
};

/** Del Sol a Plutón: el orden canónico de las diez posiciones. */
export const ORDEN_DE_PLANETAS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;

const SIGNOS_ES = ["Aries", "Tauro", "Géminis", "Cáncer", "Leo", "Virgo", "Libra", "Escorpio", "Sagitario", "Capricornio", "Acuario", "Piscis"];

/** Temas cortos de las doce casas, como los escribe el frame `1872:4512`. */
export const TEMA_CORTO_DE_CASA: Record<number, string> = {
  1: "identidad y forma de entrar al mundo",
  2: "recursos, cuerpo y valor propio",
  3: "mente, palabra y entorno cercano",
  4: "raíz, casa e intimidad",
  5: "deseo, juego y expresión",
  6: "hábitos, cuidado y trabajo cotidiano",
  7: "vínculos, acuerdos y espejo",
  8: "profundidad, confianza y cambio",
  9: "sentido, búsqueda y expansión",
  10: "dirección, vocación y exposición",
  11: "redes, futuro y pertenencia",
  12: "cierre, descanso y vida interior"
};

export function codigoDe(p: Pick<SignPlacement, "key" | "planet">): string {
  if (p.key && CODIGO_DE_CUERPO[p.key]) return CODIGO_DE_CUERPO[p.key];
  const limpio = p.planet
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleUpperCase("es");
  return limpio.slice(0, 2);
}

/** `"Escorpio 19°"` — el signo y el grado dentro del signo, si lo hay. */
export function signoYGrado(p: Pick<SignPlacement, "sign" | "normDegree">): string {
  if (!p.sign || p.sign === "—") return "—";
  return typeof p.normDegree === "number" && Number.isFinite(p.normDegree) ? `${p.sign} ${Math.round(p.normDegree)}°` : p.sign;
}

export type FilaDeTriada = { codigo: string; nombre: string; valor: string; meta: string | null };

/** Las tres filas del hub: Sol, Luna y Ascendente con signo, grado y casa. */
export function filasDeTriada(payload: Pick<NatalChartPayload, "triad">): FilaDeTriada[] {
  const { sun, moon, ascendant } = payload.triad;
  const casa = (p: SignPlacement) => (typeof p.house === "number" ? `CASA ${p.house}` : null);
  const sinAsc = !ascendant.sign || ascendant.sign === "—";
  return [
    { codigo: "SO", nombre: "Sol", valor: signoYGrado(sun), meta: casa(sun) },
    { codigo: "LU", nombre: "Luna", valor: signoYGrado(moon), meta: casa(moon) },
    { codigo: "AC", nombre: "Ascendente", valor: sinAsc ? "—" : signoYGrado(ascendant), meta: sinAsc ? "SIN HORA EXACTA" : "INICIO CASA 1" }
  ];
}

export type PosicionFila = { key: string; codigo: string; nombre: string; valor: string; casa: string | null; retro: boolean };

/** Las diez posiciones, del Sol a Plutón; los ejes quedan fuera (no son planetas). */
export function posicionesPlanetarias(payload: Pick<NatalChartPayload, "placements">): PosicionFila[] {
  const porClave = new Map(payload.placements.map((p) => [p.key ?? "", p] as const));
  const filas: PosicionFila[] = [];
  for (const key of ORDEN_DE_PLANETAS) {
    const p = porClave.get(key);
    if (!p) continue;
    filas.push({
      key,
      codigo: codigoDe(p),
      nombre: p.planet,
      valor: signoYGrado(p),
      casa: typeof p.house === "number" ? `Casa ${p.house}` : null,
      retro: Boolean(p.isRetrograde)
    });
  }
  return filas;
}

export type Eje = { codigo: string; nombre: string; valor: string };

/** Ascendente y Medio Cielo, sólo con hora exacta (sin ella el payload no los trae). */
export function ejes(payload: Pick<NatalChartPayload, "triad" | "mc">): Eje[] {
  const asc = payload.triad.ascendant;
  if (!asc.sign || asc.sign === "—") return [];
  const lista: Eje[] = [{ codigo: "AC", nombre: "Ascendente", valor: signoYGrado(asc) }];
  if (typeof payload.mc === "number" && Number.isFinite(payload.mc)) {
    const norm = ((payload.mc % 360) + 360) % 360;
    lista.push({ codigo: "MC", nombre: "Medio Cielo", valor: `${SIGNOS_ES[Math.floor(norm / 30)]} ${Math.round(norm % 30)}°` });
  }
  return lista;
}

export type AspectoFila = { clave: string; texto: string; orbe: string | null; tono: NatalChartAspect["harmony"] };

/** Los contactos entre puntos, del más ajustado al menos ajustado. */
export function aspectosPorOrbe(payload: Pick<NatalChartPayload, "aspects">): AspectoFila[] {
  return [...payload.aspects]
    .sort((a, b) => (a.orb ?? Number.POSITIVE_INFINITY) - (b.orb ?? Number.POSITIVE_INFINITY))
    .map((a, i) => ({
      clave: `${a.from}-${a.type}-${a.to}-${i}`,
      texto: `${a.from} ${a.typeEs ?? a.type} ${a.to}`,
      orbe: typeof a.orb === "number" && Number.isFinite(a.orb) ? `orbe ${a.orb.toFixed(1).replace(".", ",")}°` : null,
      tono: a.harmony
    }));
}

export type CasaFila = { casa: number; valor: string; tema: string };

/** Las doce casas con signo, grado y tema corto; vacío si el payload no las trae. */
export function casasConTema(payload: Pick<NatalChartPayload, "houses">): CasaFila[] {
  return [...payload.houses]
    .filter((h) => Number.isInteger(h.house) && h.house >= 1 && h.house <= 12)
    .sort((a, b) => a.house - b.house)
    .map((h) => ({
      casa: h.house,
      valor: typeof h.cusp === "number" && Number.isFinite(h.cusp) ? `${h.sign} ${Math.round(((h.cusp % 360) + 360) % 360) % 30}°` : h.sign,
      tema: TEMA_CORTO_DE_CASA[h.house] ?? h.theme ?? ""
    }));
}

/** `"10 POSICIONES · 12 CASAS · 11 ASPECTOS MAYORES"` — sólo cuenta lo que el payload trae. */
export function resumenDeBase(payload: Pick<NatalChartPayload, "placements" | "houses" | "aspects">): string {
  const posiciones = posicionesPlanetarias(payload).length;
  const casas = casasConTema(payload).length;
  const mayores = payload.aspects.filter((a) => a.isMajor !== false).length;
  const partes = [`${posiciones} ${posiciones === 1 ? "POSICIÓN" : "POSICIONES"}`];
  if (casas > 0) partes.push(`${casas} CASAS`);
  if (mayores > 0) partes.push(`${mayores} ${mayores === 1 ? "ASPECTO MAYOR" : "ASPECTOS MAYORES"}`);
  return partes.join(" · ");
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export type DatosNatales = { linea: string; precision: string; nota: string };

/** `"11 Nov 1996 · 10:32 · Ciudad Autónoma de Buenos Aires"` y qué precisión sostiene la carta. */
export function datosNatales(birth: Pick<BirthDataDoc, "birthDate" | "birthTime" | "birthTimePrecision" | "birthPlaceLabel"> | null | undefined): DatosNatales | null {
  if (!birth) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth.birthDate);
  const fecha = m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1] ?? "—"} ${m[1]}` : birth.birthDate;
  const partes = [fecha];
  if (birth.birthTime && birth.birthTimePrecision !== "unknown") partes.push(birth.birthTime);
  if (birth.birthPlaceLabel) partes.push(birth.birthPlaceLabel);
  const precision = birth.birthTimePrecision === "known" ? "Hora exacta" : birth.birthTimePrecision === "approximate" ? "Hora aproximada" : "Sin hora";
  const nota =
    birth.birthTimePrecision === "known"
      ? "Con tu hora, las posiciones son las del instante exacto y se pueden trazar los ejes y las casas."
      : "Sin hora exacta, las posiciones se calculan al mediodía: la Luna puede variar unos grados y los ejes y las casas no se trazan.";
  return { linea: partes.join(" · "), precision, nota };
}

/** `"20 de agosto de 2026, 02:56"` en la zona dada. */
export function ultimoCalculo(ms: number | undefined, timeZone?: string): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone ?? "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms));
    const read = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const mes = MESES_LARGOS[Number(read("month")) - 1];
    if (!mes) return null;
    return `${Number(read("day"))} de ${mes} de ${read("year")}, ${read("hour")}:${read("minute")}`;
  } catch {
    return new Date(ms).toISOString().slice(0, 16).replace("T", ", ");
  }
}

export const BLOQUES_DE_CARTA_COMPLETA: ReadonlyArray<{ n: string; label: string }> = [
  { n: "01", label: "TU RUEDA" },
  { n: "02", label: "TUS DATOS NATALES Y SU PRECISIÓN" },
  { n: "03", label: "TUS DIEZ POSICIONES" },
  { n: "04", label: "TU CARTA, EXPLICADA" },
  { n: "05", label: "LOS CONTACTOS ENTRE TUS PUNTOS" },
  { n: "06", label: "TUS DOCE CASAS" }
];
