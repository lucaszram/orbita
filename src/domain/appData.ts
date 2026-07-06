/**
 * MOCK TIPADO del App Core V4.7. Alimenta las pantallas mientras el backend
 * implementa el contrato. Cada builder mapea a una función Convex:
 *   carta     → charts.current (NatalChartPayload)
 *   transitos → transits.getToday (TransitDetailPayload) + PublicDailyHome
 *   vinculo   → relationships.synastry (SynastryPayload)      [propuesta]
 *   perfil    → users.current / subscriptions.getCurrent
 *   lunar     → calendar.getMonth (CalendarMonthPayload)      [propuesta]
 * Contrato y estado: `docs/app-core-backend-map.md`, `src/services/appCoreRefs.ts`,
 * `convex/CHANGELOG.md`. Para conectar: reemplazar `buildAppData` por `useQuery(api.x.y)`.
 */
import { useMemo } from "react";
import { useAppState } from "@/hooks/useAppState";
import { createFallbackProfile, createTriad, toISODate } from "./readingEngine";
import { Triad, UserProfile } from "./types";

// --- Types ---

export type ListItem = { title: string; body: string };

export type CartaData = {
  triad: Triad;
  casaDestacada: { label: string; copy: string };
  intro: string;
  positions: ListItem[];
};

export type TransitosData = {
  planetsRow: string;
  headline: string;
  intro: string;
  destacado: string;
  porArea: ListItem[];
};

export type VinculoData = {
  headline: string;
  body: string;
  energiaCompartida: string;
  result: {
    pairing: string;
    headline: string;
    fluye: string;
    fricciona: string;
    energia: string;
    accion: string;
  };
};

export type PerfilData = {
  birthLine: string;
  privacy: string;
  plan: string;
};

export type LunarData = {
  phase: string;
  weekStrip: string;
  copy: string;
  accion: string;
  monthLabel: string;
  startCol: number;
  daysInMonth: number;
  intense: number[];
};

export type AppData = {
  carta: CartaData;
  transitos: TransitosData;
  vinculo: VinculoData;
  perfil: PerfilData;
  lunar: LunarData;
};

// --- Helpers ---

const monthsShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatBirthLine(profile: UserProfile): string {
  const [y, m, d] = profile.birthDate.split("-").map(Number);
  const date = `${d} ${monthsShort[Math.max(0, Math.min(11, m - 1))]} ${y}`;
  const parts = [date];
  if (profile.birthTime) parts.push(profile.birthTime);
  if (profile.birthPlace) parts.push(profile.birthPlace);
  return parts.join("  ·  ");
}

// --- Builders (local stub, matches Figma V4.7) ---

export function buildCarta(profile: UserProfile, date = toISODate()): CartaData {
  const triad = createTriad(profile, date);
  return {
    triad,
    intro: "Sol, Luna y Ascendente arman tu base. Todo lo demás se lee sobre esto.",
    casaDestacada: { label: "CASA DESTACADA", copy: "Casa 7 · vínculos y acuerdos." },
    positions: [
      { title: `Sol en ${triad.sun.label}`, body: "Casa 7 · te definís a través del vínculo y la intensidad." },
      { title: `Luna en ${triad.moon.label}`, body: "Casa 7 · emoción profunda, privada, leal." },
      { title: `Ascendente ${triad.ascendant.label}`, body: "Te mostrás distinto, mental, con aire propio." },
      { title: "Mercurio en Sagitario", body: "Casa 10 · pensás en grande y hablás directo." }
    ]
  };
}

export function buildTransitos(): TransitosData {
  return {
    planetsRow: "☿ Mercurio    ♀ Venus    ☾ Luna",
    headline: "El cielo se\nmueve hoy.",
    intro: "El tránsito destacado marca el clima. Los secundarios matizan trabajo, vínculos y energía.",
    destacado: "Venus armoniza tu Sol · deseo y valor.",
    porArea: [
      { title: "Venus armoniza al Sol", body: "Amor: se nota lo que ya funciona sin esfuerzo." },
      { title: "Mercurio roza la Luna", body: "Trabajo: cuidá el mensaje mandado en caliente." },
      { title: "Marte en Casa 7", body: "Vínculos: impulso alto; nombrá lo que querés." },
      { title: "Luna en Tauro", body: "Energía: el cuerpo pide un ritmo más lento hoy." }
    ]
  };
}

export function buildVinculo(): VinculoData {
  return {
    headline: "Dos cartas,\nun cielo.",
    body: "La energía entre dos personas se lee, no se promete. Mirá dónde hay acuerdo y dónde hay fricción.",
    energiaCompartida: "Diálogo alto · ritmos distintos.",
    result: {
      pairing: "VÍNCULO · ESCORPIO + LIBRA",
      headline: "Atracción con\nritmos distintos.",
      fluye: "El deseo y la conversación: hay chispa real.",
      fricciona: "El tiempo: uno acelera, el otro procesa.",
      energia: "Alta al inicio; pide acuerdos claros para sostenerse.",
      accion: "Bajá una expectativa a una frase concreta."
    }
  };
}

export function buildPerfil(profile: UserProfile): PerfilData {
  return {
    birthLine: formatBirthLine(profile),
    privacy: "Se usan solo para calcular tu carta. No los compartimos con nadie.",
    plan: "Órbita Plus · activo."
  };
}

export function buildLunar(): LunarData {
  // Julio 2026 — 1 = miércoles (startCol 2, semana empieza en L)
  return {
    phase: "Luna creciente\nen Tauro.",
    weekStrip: "L  M  M  J  V  S  D   ·   esta semana",
    copy: "La luna marca el clima emocional del día. En creciente conviene sumar, sostener y construir de a poco.",
    accion: "Regá algo que empezaste. No lo apures.",
    monthLabel: "JULIO 2026",
    startCol: 2,
    daysInMonth: 31,
    intense: [3, 8, 14, 20, 27]
  };
}

export function buildAppData(profile: UserProfile, date = toISODate()): AppData {
  return {
    carta: buildCarta(profile, date),
    transitos: buildTransitos(),
    vinculo: buildVinculo(),
    perfil: buildPerfil(profile),
    lunar: buildLunar()
  };
}

/** Hook: app-core screen data derived from the current profile. */
export function useAppData(): AppData {
  const { profile } = useAppState();
  return useMemo(() => buildAppData(profile ?? createFallbackProfile(), toISODate()), [profile]);
}
