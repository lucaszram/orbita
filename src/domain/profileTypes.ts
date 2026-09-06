/**
 * Tipos y datos base del alta y del perfil.
 *
 * Existe por ALCANCE, no por gusto: `domain/types.ts` es el archivo histórico
 * donde conviven estas formas con TODO el vocabulario del ritual legado
 * (`DailyReading`, `TarotCard`, `PickCardOption`, las lecturas semanales…). El
 * producto nativo V4.9.2 necesita lo primero —un signo, unos intereses, la
 * tríada— y no muestra nada de lo segundo; pero como el alta y el storage
 * importaban valores REALES de ese archivo (`topics`, `zodiacSigns`), Metro lo
 * metía entero en el bundle nativo y el grafo de rutas quedaba tocando el
 * vocabulario del tarot.
 *
 * Acá vive sólo lo neutral. `domain/types.ts` lo reexporta, así que la web y
 * las pruebas que ya importaban de ahí siguen funcionando sin cambios: lo que
 * cambia es a dónde apunta el consumidor nativo, no qué tipo recibe.
 */

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
  "vinculos",
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

// --- Tríada (Sol, Luna, Ascendente) ---------------------------------------

export type PlacementBody = "sol" | "luna" | "ascendente";

export type Placement = {
  body: PlacementBody;
  sign: ZodiacSign;
  label: string;
};

export type Triad = {
  sun: Placement;
  moon: Placement;
  ascendant: Placement;
  /** `calculated` requiere hora y lugar; si faltan, es `approximate`. */
  accuracy: "calculated" | "approximate";
  /** Copy visible cuando la tríada es aproximada (o null si es exacta). */
  accuracyNote: string | null;
};
