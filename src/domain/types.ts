/**
 * Vocabulario de LECTURAS del ritual legado (web): la lectura del día, el
 * tarot, las semanales, el vínculo y las piezas para compartir.
 *
 * Las formas base del alta y del perfil —signos, intereses, `UserProfile`,
 * la tríada— se mudaron a `./profileTypes` y se reexportan acá: importarlas
 * desde este archivo arrastraba todo el vocabulario del ritual al bundle
 * nativo, que no muestra ninguna de esas pantallas. Quien sólo necesita el
 * perfil debe importar de `./profileTypes`; este reexport existe para que la
 * web y las pruebas que ya apuntaban acá no cambien.
 */
export * from "./profileTypes";
import type { Topic, Triad, ZodiacSign } from "./profileTypes";

/** Topics que muestra la Home V4.5 en sus tabs, en orden. */
export const homeTopicOrder = ["amor", "trabajo", "familia", "vinculos"] as const;

export type Recommendation = {
  id: string;
  topic: Topic;
  title: string;
  body: string;
  action: string;
};

export type Ritual = {
  id: string;
  title: string;
  minutes: number;
  steps: string[];
};

export type TarotCard = {
  id: string;
  name: string;
  arcana: "mayor" | "menor";
  keywords: string[];
  meaning: string;
  ritual: string;
};

export type ContentTemplate = {
  id: string;
  kind: "daily-message" | "recommendation" | "micro-feed" | "weekly" | "transit" | "relationship";
  zodiacSign?: ZodiacSign;
  topic?: Topic;
  tone: "suave" | "directo" | "protector" | "expansivo";
  title: string;
  body: string;
  action: string;
};

export type DailyReading = {
  id: string;
  date: string;
  sign: ZodiacSign;
  greeting: string;
  headline: string;
  message: string;
  energyScore: number;
  energyLabel: string;
  color: string;
  luckyNumber: number;
  mantra: string;
  recommendation: Recommendation;
  ritual: Ritual;
  tarotCard: TarotCard;
  hook: string;
  dateLabel: string;
  action: string;
  transitEvent: TransitEvent;
  pickCards: PickCardOption[];
  shareCard: ShareCard;
  saved?: boolean;
};

export type JournalEntry = {
  id: string;
  readingId: string;
  date: string;
  title: string;
  note: string;
  reading: DailyReading;
  createdAt: string;
};

export type WeeklyEnergyDay = {
  id: string;
  dayIndex: number;
  dayName: string;
  date: string;
  color: string;
  symbol: string;
  focus: Topic;
  meaning: string;
  action: string;
};

export type WeeklyEnergy = {
  id: string;
  weekStart: string;
  sign: ZodiacSign;
  theme: string;
  days: WeeklyEnergyDay[];
};

export type WeeklyReading = {
  id: string;
  weekStart: string;
  sign: ZodiacSign;
  energy: string;
  love: string;
  workMoney: string;
  advice: string;
  color: string;
  luckyNumber: number;
  tarotCard: TarotCard;
};

export type TransitEvent = {
  id: string;
  title: string;
  eventType: "luna" | "mercurio" | "venus" | "temporada" | "cultura";
  date: string;
  affectedSigns: ZodiacSign[];
  summary: string;
  doThis: string;
  avoid: string;
  intensity: number;
};

export type RelationshipReading = {
  id: string;
  date: string;
  userSign: ZodiacSign;
  partnerName: string;
  partnerSign: ZodiacSign;
  chemistryScore: number;
  userEnergy: string;
  partnerEnergy: string;
  sharedEnergy: string;
  advice: string;
  shareLine: string;
};

export type ShareCard = {
  id: string;
  type: "daily" | "weekly-color" | "relationship" | "transit" | "tarot";
  title: string;
  subtitle: string;
  body: string;
  accent: string;
  meta: string;
};

export type PickCardOption = {
  id: string;
  position: number;
  prompt: string;
  card: TarotCard;
  reveal: string;
};

// --- Home V4.5 (App Core) ---

export type HomeTopic = {
  topic: Topic;
  label: string;
  title: string;
  oneLine: string;
  detail: string;
  hace: string;
  evita: string;
  question: string;
};

export type HomeExtras = {
  tarotCard: TarotCard;
  color: string;
  luckyNumber: number;
  mantra: string;
};

export type HomeReading = {
  id: string;
  date: string;
  dateLabel: string;
  sign: ZodiacSign;
  greeting: string;
  triad: Triad;
  // Top
  headline: string;
  body: string;
  signalLabel: string;
  signalCopy: string;
  // Guía diaria
  guideEyebrow: string;
  guideHeadline: string;
  guideIntro: string;
  hace: string;
  evita: string;
  energia: string;
  accion: string;
  // Topics
  topics: HomeTopic[];
  // Lectura larga / cierre
  longReadEyebrow: string;
  longReadTitle: string;
  longReadBody: string;
  educationalEyebrow: string;
  educationalTitle: string;
  endLine: string;
  question: string;
  // Extras (legacy reestilizado)
  extras: HomeExtras;
};
