import {
  colors,
  contentTemplates,
  dailyHooks,
  dayNames,
  mantras,
  relationshipLines,
  rituals,
  tarotCards,
  transitEvents,
  weeklyColorMeanings,
  weeklyReadingCopy
} from "../content/catalog";
import {
  DailyReading,
  HomeReading,
  HomeTopic,
  PickCardOption,
  Placement,
  Recommendation,
  RelationshipReading,
  ShareCard,
  Topic,
  Triad,
  TransitEvent,
  UserProfile,
  WeeklyEnergy,
  WeeklyReading,
  ZodiacSign,
  zodiacSigns
} from "./types";
import {
  dailyQuestions,
  educationalTitles,
  energiaFromLabel,
  guideHeadlines,
  guideIntros,
  homeEndLines,
  homeTopicCopy,
  homeTopicKeys,
  longReadBodies,
  longReadTitles,
  signalBodies,
  signalCopies,
  signalHeadlines
} from "../content/homeCatalog";
import { numberInRange, pickStable } from "./random";
import { formatSign } from "./zodiac";

const homeTopicLabels: Record<string, string> = {
  amor: "Amor",
  trabajo: "Trabajo",
  familia: "Familia",
  vinculos: "Vínculos"
};

const energyLabels = ["Baja suave", "Estable", "Intuitiva", "Movida", "Expansiva"] as const;

export function toISODate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function formatDateLabel(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre"
  ];

  return `${day} de ${months[Math.max(0, Math.min(11, month - 1))]}`;
}

export function getWeekStart(date: string): string {
  const current = new Date(`${date}T12:00:00.000Z`);
  const day = current.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  current.setUTCDate(current.getUTCDate() + mondayOffset);
  return toISODate(current);
}

function addDays(date: string, days: number): string {
  const current = new Date(`${date}T12:00:00.000Z`);
  current.setUTCDate(current.getUTCDate() + days);
  return toISODate(current);
}

export function buildSeed(profile: Pick<UserProfile, "id" | "zodiacSign" | "interests">, date: string): string {
  return `${profile.id}:${profile.zodiacSign}:${profile.interests.join(",")}:${date}`;
}

function resolveTopic(profile: Pick<UserProfile, "interests">, seed: string): Topic {
  const preferred: Topic[] = profile.interests.length > 0 ? profile.interests : ["claridad"];
  return pickStable(preferred, `${seed}:topic`);
}

function resolveDailyMessage(sign: ZodiacSign, seed: string) {
  const signMessages = contentTemplates.filter((template) => template.kind === "daily-message" && template.zodiacSign === sign);
  const fallbackMessages = contentTemplates.filter((template) => template.kind === "daily-message");
  return pickStable(signMessages.length > 0 ? signMessages : fallbackMessages, `${seed}:message`);
}

function resolveRecommendation(topic: Topic, seed: string): Recommendation {
  const topicRecommendations = contentTemplates.filter(
    (template) => template.kind === "recommendation" && template.topic === topic
  );
  const fallbackRecommendations = contentTemplates.filter((template) => template.kind === "recommendation");
  const selected = pickStable(
    topicRecommendations.length > 0 ? topicRecommendations : fallbackRecommendations,
    `${seed}:recommendation`
  );

  return {
    id: selected.id,
    topic: selected.topic ?? "claridad",
    title: selected.title,
    body: selected.body,
    action: selected.action
  };
}

export function createActiveTransit(profile: UserProfile, date = toISODate()): TransitEvent {
  const direct = transitEvents.find((event) => event.date === date && event.affectedSigns.includes(profile.zodiacSign));

  if (direct) {
    return direct;
  }

  const signRelevant = transitEvents.filter((event) => event.affectedSigns.includes(profile.zodiacSign));
  return pickStable(signRelevant.length > 0 ? signRelevant : transitEvents, `${buildSeed(profile, date)}:transit`);
}

export function createWeeklyEnergy(profile: UserProfile, date = toISODate()): WeeklyEnergy {
  const weekStart = getWeekStart(date);
  const seed = `${buildSeed(profile, weekStart)}:weekly-energy`;
  const startIndex = numberInRange(`${seed}:start`, 0, weeklyColorMeanings.length - 1);

  const days = dayNames.map((dayName, index) => {
    const source = weeklyColorMeanings[(startIndex + index) % weeklyColorMeanings.length];

    return {
      id: `${weekStart}-${index}`,
      dayIndex: index,
      dayName,
      date: addDays(weekStart, index),
      color: source.color,
      symbol: source.symbol,
      focus: source.focus,
      meaning: source.meaning,
      action: source.action
    };
  });

  return {
    id: `${profile.id}-${weekStart}-colors`,
    weekStart,
    sign: profile.zodiacSign,
    theme: pickStable(
      [
        "Una semana para elegir señales simples y no ruido.",
        "Tu energia se acomoda cuando cuidas el ritmo.",
        "Lo importante no llega gritando: llega repitiendose.",
        "Esta semana tu color funciona como recordatorio, no como regla."
      ],
      `${seed}:theme`
    ),
    days
  };
}

export function createWeeklyReading(profile: UserProfile, date = toISODate()): WeeklyReading {
  const weekStart = getWeekStart(date);
  const seed = `${buildSeed(profile, weekStart)}:weekly-reading`;

  return {
    id: `${profile.id}-${weekStart}-reading`,
    weekStart,
    sign: profile.zodiacSign,
    energy: pickStable(weeklyReadingCopy.energy, `${seed}:energy`),
    love: pickStable(weeklyReadingCopy.love, `${seed}:love`),
    workMoney: pickStable(weeklyReadingCopy.workMoney, `${seed}:work-money`),
    advice: pickStable(weeklyReadingCopy.advice, `${seed}:advice`),
    color: pickStable(colors, `${seed}:color`),
    luckyNumber: numberInRange(`${seed}:number`, 1, 99),
    tarotCard: pickStable(tarotCards, `${seed}:tarot`)
  };
}

export function createPickCards(profile: UserProfile, date = toISODate()): PickCardOption[] {
  const seed = `${buildSeed(profile, date)}:pick-card`;
  const prompts = [
    "Lo que necesitas mirar",
    "Lo que conviene soltar",
    "Lo que se abre si elegis calma"
  ];

  return prompts.map((prompt, index) => {
    const card = pickStable(tarotCards, `${seed}:${index}`);

    return {
      id: `${date}-pick-${index}`,
      position: index + 1,
      prompt,
      card,
      reveal: `${card.name} aparece para recordarte: ${card.meaning}`
    };
  });
}

export function createRelationshipReading(profile: UserProfile, date = toISODate()): RelationshipReading {
  const seed = `${buildSeed(profile, date)}:relationship`;
  const target = profile.relationshipTarget;
  const partnerName = target?.name?.trim() || "esa persona";
  const partnerSign = target?.zodiacSign ?? pickStable(
    ["aries", "tauro", "geminis", "cancer", "leo", "virgo", "libra", "escorpio", "sagitario", "capricornio", "acuario", "piscis"] as const,
    `${seed}:partner-sign`
  );
  const copy = pickStable(relationshipLines, `${seed}:copy`);
  const chemistryScore = numberInRange(`${seed}:chemistry`, 54, 96);

  return {
    id: `${profile.id}-${date}-relationship`,
    date,
    userSign: profile.zodiacSign,
    partnerName,
    partnerSign,
    chemistryScore,
    userEnergy: copy.userEnergy,
    partnerEnergy: copy.partnerEnergy,
    sharedEnergy: copy.sharedEnergy,
    advice: copy.advice,
    shareLine: `${formatSign(profile.zodiacSign)} + ${formatSign(partnerSign)}: ${chemistryScore}% de energia para mirar con calma.`
  };
}

export function createDailyShareCard(reading: Omit<DailyReading, "shareCard" | "saved">): ShareCard {
  return {
    id: `${reading.id}-share`,
    type: "daily",
    title: "Si este mensaje te encontro hoy...",
    subtitle: `${reading.dateLabel} - ${formatSign(reading.sign)}`,
    body: `${reading.message} Accion: ${reading.action}`,
    accent: reading.color,
    meta: `Carta: ${reading.tarotCard.name} - Numero ${reading.luckyNumber}`
  };
}

export function createDailyReading(profile: UserProfile, date = toISODate()): DailyReading {
  const seed = buildSeed(profile, date);
  const topic = resolveTopic(profile, seed);
  const message = resolveDailyMessage(profile.zodiacSign, seed);
  const energyScore = numberInRange(`${seed}:energy`, 42, 96);
  const energyLabel = energyLabels[Math.min(energyLabels.length - 1, Math.floor((energyScore - 1) / 20))];
  const luckyNumber = numberInRange(`${seed}:number`, 1, 99);
  const recommendation = resolveRecommendation(topic, seed);
  const tarotCard = pickStable(tarotCards, `${seed}:tarot`);
  const baseReading = {
    id: `${profile.id}-${date}`,
    date,
    sign: profile.zodiacSign,
    greeting: `Hola, ${profile.name}`,
    headline: `${formatSign(profile.zodiacSign)}: ${message.title}`,
    message: message.body,
    energyScore,
    energyLabel,
    color: pickStable(colors, `${seed}:color`),
    luckyNumber,
    mantra: pickStable(mantras, `${seed}:mantra`),
    recommendation,
    ritual: pickStable(rituals, `${seed}:ritual`),
    tarotCard,
    hook: pickStable(dailyHooks, `${seed}:hook`),
    dateLabel: formatDateLabel(date),
    action: recommendation.action,
    transitEvent: createActiveTransit(profile, date),
    pickCards: createPickCards(profile, date)
  };

  return {
    ...baseReading,
    shareCard: createDailyShareCard(baseReading)
  };
}

function buildPlacement(body: Placement["body"], glyph: string, sign: ZodiacSign): Placement {
  return { body, glyph, sign, label: formatSign(sign) };
}

/**
 * Tríada natal. El Sol sale real de la fecha; Luna y Ascendente son un stub
 * determinístico (todavía no hay cálculo astronómico real). Si falta hora o
 * lugar, la tríada queda marcada como aproximada.
 */
export function createTriad(profile: UserProfile, date = toISODate()): Triad {
  const seed = `${buildSeed(profile, date)}:triad`;
  const moonSign = pickStable(zodiacSigns, `${seed}:moon`);
  const ascSign = pickStable(zodiacSigns, `${seed}:asc`);
  const hasFullData = Boolean(profile.birthTime && profile.birthPlace);

  return {
    sun: buildPlacement("sol", "☉", profile.zodiacSign),
    moon: buildPlacement("luna", "☽", moonSign),
    ascendant: buildPlacement("ascendente", "↑", ascSign),
    accuracy: hasFullData ? "calculated" : "approximate",
    accuracyNote: hasFullData ? null : "Lectura aproximada: sumá tu hora de nacimiento para afinar Luna y Ascendente."
  };
}

function buildHomeTopics(seed: string): HomeTopic[] {
  return homeTopicKeys.map((topic) => {
    const copy = homeTopicCopy[topic as keyof typeof homeTopicCopy];
    return {
      topic,
      label: homeTopicLabels[topic] ?? formatSign(topic as ZodiacSign),
      title: copy.title,
      oneLine: copy.oneLine,
      detail: copy.detail,
      hace: copy.hace,
      evita: copy.evita,
      question: copy.question
    };
  });
}

export function createHomeReading(profile: UserProfile, date = toISODate()): HomeReading {
  const seed = `${buildSeed(profile, date)}:home`;
  const topic = resolveTopic(profile, seed);
  const recommendation = resolveRecommendation(topic, seed);
  const transit = createActiveTransit(profile, date);
  const energyScore = numberInRange(`${seed}:energy`, 42, 96);
  const energyLabel = energyLabels[Math.min(energyLabels.length - 1, Math.floor((energyScore - 1) / 20))];

  return {
    id: `${profile.id}-${date}-home`,
    date,
    dateLabel: formatDateLabel(date),
    sign: profile.zodiacSign,
    greeting: `Hola, ${profile.name}`,
    triad: createTriad(profile, date),
    headline: pickStable(signalHeadlines, `${seed}:headline`),
    body: pickStable(signalBodies, `${seed}:body`),
    signalLabel: "CLIMA DEL DÍA",
    signalCopy: pickStable(signalCopies, `${seed}:signal`),
    guideEyebrow: "GUÍA DE HOY",
    guideHeadline: pickStable(guideHeadlines, `${seed}:guide-headline`),
    guideIntro: pickStable(guideIntros, `${seed}:guide-intro`),
    hace: transit.doThis,
    evita: transit.avoid,
    energia: energiaFromLabel(energyLabel),
    accion: recommendation.action,
    topics: buildHomeTopics(seed),
    longReadEyebrow: "LECTURA LARGA",
    longReadTitle: pickStable(longReadTitles, `${seed}:long-title`),
    longReadBody: pickStable(longReadBodies, `${seed}:long-body`),
    educationalEyebrow: "MÓDULO EDUCATIVO",
    educationalTitle: pickStable(educationalTitles, `${seed}:edu`),
    endLine: pickStable(homeEndLines, `${seed}:end`),
    question: pickStable(dailyQuestions, `${seed}:question`),
    extras: {
      tarotCard: pickStable(tarotCards, `${seed}:tarot`),
      color: pickStable(colors, `${seed}:color`),
      luckyNumber: numberInRange(`${seed}:number`, 1, 99),
      mantra: pickStable(mantras, `${seed}:mantra`)
    }
  };
}

export function createFallbackProfile(): UserProfile {
  return {
    id: "guest",
    name: "Visitante",
    birthDate: "1994-04-12",
    zodiacSign: "aries",
    interests: ["amor", "claridad", "energia"],
    guidanceTone: "protectora",
    relationshipTarget: {
      name: "esa persona",
      zodiacSign: "libra"
    },
    notificationTime: "09:00",
    createdAt: new Date(0).toISOString()
  };
}
