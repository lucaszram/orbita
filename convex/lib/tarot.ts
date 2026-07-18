/**
 * Carta del día — mazo completo y sorteo determinístico por (usuario, fecha).
 *
 * La misma persona, el mismo día y con el mismo historial reciente saca SIEMPRE
 * la misma carta. El backend excluye las cartas de los seis días calendario
 * anteriores: una carta puede volver a aparecer recién al octavo día.
 *
 * Los ids 0–21 de los arcanos mayores son históricos y NO se cambian. Los
 * menores ocupan 22–77 en el mismo orden estable que los assets del frontend.
 * El cliente debe mantener un mapa estático id→imagen porque Metro no admite
 * require() dinámico.
 */

export type TarotArcana = "major" | "minor";
export type TarotSuit = "wands" | "cups" | "swords" | "pentacles";
export type TarotRank = "ace" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "page" | "knight" | "queen" | "king";

export type TarotOrientation = "derecho" | "invertida";

export type TarotCard = {
  /** 0–77. Los ids 0–21 conservan exactamente el contrato anterior. */
  id: number;
  /** Slug estable, alineado con el nombre del asset sin extensión. */
  key: string;
  nombre: string;
  arcana: TarotArcana;
  suit?: TarotSuit;
  rank?: TarotRank;
  /** Dato editorial controlado que recibe el generador de la guía. */
  correspondencia: string;
};

export type TarotDraw = TarotCard & {
  /** Segunda tirada deterministica e independiente de la carta. */
  orientacion: TarotOrientation;
};

const MAJORS: TarotCard[] = [
  { id: 0, key: "major_00_el_loco", nombre: "El Loco", arcana: "major", correspondencia: "Urano ♅ (aire)" },
  { id: 1, key: "major_01_el_mago", nombre: "El Mago", arcana: "major", correspondencia: "Mercurio ☿" },
  { id: 2, key: "major_02_la_sacerdotisa", nombre: "La Sacerdotisa", arcana: "major", correspondencia: "Luna ☽" },
  { id: 3, key: "major_03_la_emperatriz", nombre: "La Emperatriz", arcana: "major", correspondencia: "Venus ♀" },
  { id: 4, key: "major_04_el_emperador", nombre: "El Emperador", arcana: "major", correspondencia: "Aries ♈" },
  { id: 5, key: "major_05_el_hierofante", nombre: "El Hierofante", arcana: "major", correspondencia: "Tauro ♉" },
  { id: 6, key: "major_06_los_enamorados", nombre: "Los Enamorados", arcana: "major", correspondencia: "Géminis ♊" },
  { id: 7, key: "major_07_el_carro", nombre: "El Carro", arcana: "major", correspondencia: "Cáncer ♋" },
  { id: 8, key: "major_08_la_fuerza", nombre: "La Fuerza", arcana: "major", correspondencia: "Leo ♌" },
  { id: 9, key: "major_09_el_ermitano", nombre: "El Ermitaño", arcana: "major", correspondencia: "Virgo ♍" },
  { id: 10, key: "major_10_la_rueda", nombre: "La Rueda de la Fortuna", arcana: "major", correspondencia: "Júpiter ♃" },
  { id: 11, key: "major_11_la_justicia", nombre: "La Justicia", arcana: "major", correspondencia: "Libra ♎" },
  { id: 12, key: "major_12_el_colgado", nombre: "El Colgado", arcana: "major", correspondencia: "Neptuno ♆" },
  { id: 13, key: "major_13_la_muerte", nombre: "La Muerte", arcana: "major", correspondencia: "Escorpio ♏" },
  { id: 14, key: "major_14_la_templanza", nombre: "La Templanza", arcana: "major", correspondencia: "Sagitario ♐" },
  { id: 15, key: "major_15_el_diablo", nombre: "El Diablo", arcana: "major", correspondencia: "Capricornio ♑" },
  { id: 16, key: "major_16_la_torre", nombre: "La Torre", arcana: "major", correspondencia: "Marte ♂" },
  { id: 17, key: "major_17_la_estrella", nombre: "La Estrella", arcana: "major", correspondencia: "Acuario ♒" },
  { id: 18, key: "major_18_la_luna", nombre: "La Luna", arcana: "major", correspondencia: "Piscis ♓" },
  { id: 19, key: "major_19_el_sol", nombre: "El Sol", arcana: "major", correspondencia: "Sol ☉" },
  { id: 20, key: "major_20_el_juicio", nombre: "El Juicio", arcana: "major", correspondencia: "Plutón ♇" },
  { id: 21, key: "major_21_el_mundo", nombre: "El Mundo", arcana: "major", correspondencia: "Saturno ♄" }
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

const SUITS: ReadonlyArray<{ key: TarotSuit; label: string; element: string }> = [
  { key: "wands", label: "Bastos", element: "Fuego" },
  { key: "cups", label: "Copas", element: "Agua" },
  { key: "swords", label: "Espadas", element: "Aire" },
  { key: "pentacles", label: "Oros", element: "Tierra" }
];

const MINORS: TarotCard[] = SUITS.flatMap((suit, suitIndex) =>
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

/** Catálogo canónico de 78 cartas. Solo lectura: no reordenar ni reciclar ids. */
export const TAROT_DECK: ReadonlyArray<TarotCard> = Object.freeze([...MAJORS, ...MINORS]);

/** Mitad del mazo sale invertido. Es una decision editorial tuneable, no azar de cliente. */
export const REVERSED_PCT = 50;

/** FNV-1a de 32 bits. Barato, sin deps y estable entre runtimes. */
function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Sorteo estable sobre el mazo permitido. `excludedIds` normalmente contiene las
 * cartas persistidas en los seis días anteriores. Si el caller excluyera las 78
 * por error, se cae al mazo completo para no dejar a la persona sin guía.
 */
export function drawCard(args: {
  userId: string;
  localDate: string;
  excludedIds?: Iterable<number>;
}): TarotDraw {
  const excluded = new Set(args.excludedIds ?? []);
  const allowed = TAROT_DECK.filter((card) => !excluded.has(card.id));
  const pool = allowed.length > 0 ? allowed : TAROT_DECK;
  const seed = hashSeed(`${args.userId}:${args.localDate}`);
  const orientationSeed = hashSeed(`${args.userId}:${args.localDate}:orientacion`);
  const orientacion: TarotOrientation = orientationSeed % 100 < REVERSED_PCT ? "invertida" : "derecho";
  return { ...pool[seed % pool.length], orientacion };
}

export function cardById(id: number): TarotCard | null {
  return TAROT_DECK[id] ?? null;
}
