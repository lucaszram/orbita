export const CHART_CALCULATION_VERSION = "orbita-stub-v1";
export const DAILY_READING_CONTENT_VERSION = "orbita-daily-stub-v1";

export type AuthIdentityLike = {
  tokenIdentifier: string;
  subject: string;
  email?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  nickname?: string;
  preferredUsername?: string;
};

export type BirthChartInput = {
  birthDate: string;
  birthTime?: string;
  birthTimePrecision: "known" | "approximate" | "unknown";
  birthPlaceLabel: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
};

const zodiacRanges = [
  { sign: "capricornio", element: "tierra", start: [12, 22], end: [1, 19] },
  { sign: "acuario", element: "aire", start: [1, 20], end: [2, 18] },
  { sign: "piscis", element: "agua", start: [2, 19], end: [3, 20] },
  { sign: "aries", element: "fuego", start: [3, 21], end: [4, 19] },
  { sign: "tauro", element: "tierra", start: [4, 20], end: [5, 20] },
  { sign: "geminis", element: "aire", start: [5, 21], end: [6, 20] },
  { sign: "cancer", element: "agua", start: [6, 21], end: [7, 22] },
  { sign: "leo", element: "fuego", start: [7, 23], end: [8, 22] },
  { sign: "virgo", element: "tierra", start: [8, 23], end: [9, 22] },
  { sign: "libra", element: "aire", start: [9, 23], end: [10, 22] },
  { sign: "escorpio", element: "agua", start: [10, 23], end: [11, 21] },
  { sign: "sagitario", element: "fuego", start: [11, 22], end: [12, 21] }
] as const;

export function userFieldsFromIdentity(identity: AuthIdentityLike, now: number) {
  return {
    tokenIdentifier: identity.tokenIdentifier,
    clerkUserId: identity.subject,
    email: identity.email,
    name: identity.name ?? identity.givenName ?? identity.nickname ?? identity.preferredUsername,
    updatedAt: now
  };
}

export function getZodiacPlacement(birthDate: string) {
  const [, month, day] = birthDate.split("-").map(Number);
  const validDate = Number.isFinite(month) && Number.isFinite(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31;

  if (!validDate) {
    return { sign: "aries", element: "fuego" };
  }

  const matching = zodiacRanges.find((range) => {
    const [startMonth, startDay] = range.start;
    const [endMonth, endDay] = range.end;

    if (startMonth > endMonth) {
      return (month === startMonth && day >= startDay) || (month === endMonth && day <= endDay);
    }

    return (
      (month === startMonth && day >= startDay) ||
      (month === endMonth && day <= endDay) ||
      (month > startMonth && month < endMonth)
    );
  });

  return {
    sign: matching?.sign ?? "aries",
    element: matching?.element ?? "fuego"
  };
}

export function normalizeBirthTime(value?: string) {
  if (!value) {
    return undefined;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return undefined;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return undefined;
  }

  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

export function buildNatalChartSnapshot(input: BirthChartInput) {
  const solar = getZodiacPlacement(input.birthDate);
  const timeKnown = input.birthTimePrecision === "known" && Boolean(input.birthTime);

  return {
    version: CHART_CALCULATION_VERSION,
    source: "stub",
    disclaimer: "Calculo simbolico inicial para desarrollo; reemplazar por motor astrologico real antes de produccion.",
    birth: {
      date: input.birthDate,
      time: input.birthTime,
      timePrecision: input.birthTimePrecision,
      place: input.birthPlaceLabel,
      latitude: input.latitude,
      longitude: input.longitude,
      timezone: input.timezone
    },
    placements: {
      sun: {
        sign: solar.sign,
        element: solar.element,
        degree: null
      },
      moon: {
        sign: "pendiente",
        element: "pendiente",
        degree: null
      },
      ascendant: {
        sign: timeKnown ? "pendiente" : "aproximado",
        degree: null
      }
    },
    houses: timeKnown ? { status: "pending_real_calculation" } : { status: "approximate_without_birth_time" },
    aspects: [],
    summary: {
      title: "Estos son tus puntos de partida.",
      solarSign: solar.sign,
      solarElement: solar.element,
      accuracy: timeKnown ? "ready_for_real_calculation" : "approximate_without_birth_time"
    }
  };
}

export function buildDailyReadingPayload(args: {
  localDate: string;
  timezone: string;
  chart: ReturnType<typeof buildNatalChartSnapshot> | null;
}) {
  const sign = args.chart?.summary.solarSign ?? "aries";
  const element = args.chart?.summary.solarElement ?? "fuego";

  return {
    version: DAILY_READING_CONTENT_VERSION,
    localDate: args.localDate,
    timezone: args.timezone,
    sign,
    modules: {
      headline: `Tu cielo de hoy parte de ${sign}.`,
      do: "Elegir una accion chica y concreta.",
      avoid: "Convertir una sensacion en una conclusion definitiva.",
      energy: `Elemento de base: ${element}.`,
      action: "Anota una pregunta simple antes de responder en automatico."
    },
    topics: [
      { topic: "amor", title: "Vinculos", body: "Mira presencia y cuidado, no solo intensidad." },
      { topic: "trabajo", title: "Foco", body: "Una prioridad ordena mejor que diez pendientes abiertos." },
      { topic: "familia", title: "Raiz", body: "Podes cuidar sin absorber todo lo que pasa alrededor." },
      { topic: "vinculos", title: "Ritmo", body: "La claridad aparece cuando baja la interpretacion." }
    ],
    longRead: {
      title: "Contexto para volver al centro",
      body: "Esta lectura es una guia simbolica para mirar el dia con mas contexto. No decide por vos."
    }
  };
}
