export const zodiacSigns = [
  "aries",
  "tauro",
  "geminis",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "escorpio",
  "sagitario",
  "capricornio",
  "acuario",
  "piscis"
] as const;

export type ZodiacSign = (typeof zodiacSigns)[number];

export const topics = [
  "amor",
  "trabajo",
  "dinero",
  "energia",
  "familia",
  "decisiones",
  "claridad",
  "proteccion",
  "luna"
] as const;

export type Topic = (typeof topics)[number];

export type GuidanceTone = "suave" | "directa" | "protectora" | "intensa";

export type RelationshipTarget = {
  name: string;
  birthDate?: string;
  zodiacSign?: ZodiacSign;
};

export type UserProfile = {
  id: string;
  name: string;
  birthDate: string;
  birthTime?: string;
  birthPlace?: string;
  zodiacSign: ZodiacSign;
  interests: Topic[];
  guidanceTone: GuidanceTone;
  relationshipTarget?: RelationshipTarget;
  notificationTime: string;
  createdAt: string;
};

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

export type OnboardingProfile = {
  name: string;
  birthDate: string;
  birthTime?: string;
  birthPlace?: string;
  interests: Topic[];
  guidanceTone: GuidanceTone;
  relationshipTarget?: RelationshipTarget;
  notificationTime: string;
};
