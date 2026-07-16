/**
 * Catálogo canónico de las 78 cartas — espejo EXACTO de `convex/lib/tarot.ts`
 * (PR #15, contrato 2026-07-16). Módulo PURO (sin require() de assets) para
 * poder verificarlo en node contra los archivos del mazo.
 *
 * Reglas del contrato:
 * - Los ids 0–21 de los mayores son históricos y NO se cambian.
 * - Los menores ocupan ids estables 22–77 en orden Bastos, Copas, Espadas,
 *   Oros (As, 2–10, Paje, Caballero, Reina, Rey). No reordenar ni reciclar.
 * - `key` = nombre del asset sin extensión en `assets/orbita/optimized/tarot/`.
 */

export type TarotArcana = "major" | "minor";
export type TarotSuit = "wands" | "cups" | "swords" | "pentacles";
export type TarotRank =
  | "ace" | "02" | "03" | "04" | "05" | "06" | "07"
  | "08" | "09" | "10" | "page" | "knight" | "queen" | "king";

export type TarotCatalogCard = {
  /** 0–77. Los ids 0–21 conservan exactamente el contrato anterior. */
  id: number;
  /** Slug estable, alineado con el nombre del asset sin extensión. */
  key: string;
  nombre: string;
  arcana: TarotArcana;
  suit?: TarotSuit;
  rank?: TarotRank;
  /** Numeración histórica — solo mayores. */
  roman?: string;
  /** Dato editorial controlado (mismo string que recibe el generador backend). */
  correspondencia: string;
};

const MAJORS: TarotCatalogCard[] = [
  { id: 0, key: "major_00_el_loco", roman: "0", nombre: "El Loco", arcana: "major", correspondencia: "Urano ♅ (aire)" },
  { id: 1, key: "major_01_el_mago", roman: "I", nombre: "El Mago", arcana: "major", correspondencia: "Mercurio ☿" },
  { id: 2, key: "major_02_la_sacerdotisa", roman: "II", nombre: "La Sacerdotisa", arcana: "major", correspondencia: "Luna ☽" },
  { id: 3, key: "major_03_la_emperatriz", roman: "III", nombre: "La Emperatriz", arcana: "major", correspondencia: "Venus ♀" },
  { id: 4, key: "major_04_el_emperador", roman: "IV", nombre: "El Emperador", arcana: "major", correspondencia: "Aries ♈" },
  { id: 5, key: "major_05_el_hierofante", roman: "V", nombre: "El Hierofante", arcana: "major", correspondencia: "Tauro ♉" },
  { id: 6, key: "major_06_los_enamorados", roman: "VI", nombre: "Los Enamorados", arcana: "major", correspondencia: "Géminis ♊" },
  { id: 7, key: "major_07_el_carro", roman: "VII", nombre: "El Carro", arcana: "major", correspondencia: "Cáncer ♋" },
  { id: 8, key: "major_08_la_fuerza", roman: "VIII", nombre: "La Fuerza", arcana: "major", correspondencia: "Leo ♌" },
  { id: 9, key: "major_09_el_ermitano", roman: "IX", nombre: "El Ermitaño", arcana: "major", correspondencia: "Virgo ♍" },
  { id: 10, key: "major_10_la_rueda", roman: "X", nombre: "La Rueda de la Fortuna", arcana: "major", correspondencia: "Júpiter ♃" },
  { id: 11, key: "major_11_la_justicia", roman: "XI", nombre: "La Justicia", arcana: "major", correspondencia: "Libra ♎" },
  { id: 12, key: "major_12_el_colgado", roman: "XII", nombre: "El Colgado", arcana: "major", correspondencia: "Neptuno ♆" },
  { id: 13, key: "major_13_la_muerte", roman: "XIII", nombre: "La Muerte", arcana: "major", correspondencia: "Escorpio ♏" },
  { id: 14, key: "major_14_la_templanza", roman: "XIV", nombre: "La Templanza", arcana: "major", correspondencia: "Sagitario ♐" },
  { id: 15, key: "major_15_el_diablo", roman: "XV", nombre: "El Diablo", arcana: "major", correspondencia: "Capricornio ♑" },
  { id: 16, key: "major_16_la_torre", roman: "XVI", nombre: "La Torre", arcana: "major", correspondencia: "Marte ♂" },
  { id: 17, key: "major_17_la_estrella", roman: "XVII", nombre: "La Estrella", arcana: "major", correspondencia: "Acuario ♒" },
  { id: 18, key: "major_18_la_luna", roman: "XVIII", nombre: "La Luna", arcana: "major", correspondencia: "Piscis ♓" },
  { id: 19, key: "major_19_el_sol", roman: "XIX", nombre: "El Sol", arcana: "major", correspondencia: "Sol ☉" },
  { id: 20, key: "major_20_el_juicio", roman: "XX", nombre: "El Juicio", arcana: "major", correspondencia: "Plutón ♇" },
  { id: 21, key: "major_21_el_mundo", roman: "XXI", nombre: "El Mundo", arcana: "major", correspondencia: "Saturno ♄" }
];

const RANKS: ReadonlyArray<{ key: TarotRank; label: string }> = [
  { key: "ace", label: "As" },
  { key: "02", label: "Dos" },
  { key: "03", label: "Tres" },
  { key: "04", label: "Cuatro" },
  { key: "05", label: "Cinco" },
  { key: "06", label: "Seis" },
  { key: "07", label: "Siete" },
  { key: "08", label: "Ocho" },
  { key: "09", label: "Nueve" },
  { key: "10", label: "Diez" },
  { key: "page", label: "Paje" },
  { key: "knight", label: "Caballero" },
  { key: "queen", label: "Reina" },
  { key: "king", label: "Rey" }
];

export const SUITS: ReadonlyArray<{ key: TarotSuit; label: string; element: string }> = [
  { key: "wands", label: "Bastos", element: "Fuego" },
  { key: "cups", label: "Copas", element: "Agua" },
  { key: "swords", label: "Espadas", element: "Aire" },
  { key: "pentacles", label: "Oros", element: "Tierra" }
];

const MINORS: TarotCatalogCard[] = SUITS.flatMap((suit, suitIndex) =>
  RANKS.map((rank, rankIndex) => ({
    id: 22 + suitIndex * RANKS.length + rankIndex,
    key: `${suit.key}_${rank.key}`,
    nombre: `${rank.label} de ${suit.label}`,
    arcana: "minor" as const,
    suit: suit.key,
    rank: rank.key,
    correspondencia: `${suit.label} · ${suit.element}`
  }))
);

/** Las 78 cartas, posicionales: `TAROT_CATALOG[id].id === id`. */
export const TAROT_CATALOG: ReadonlyArray<TarotCatalogCard> = Object.freeze([...MAJORS, ...MINORS]);
