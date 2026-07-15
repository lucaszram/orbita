/**
 * Carta del día — sorteo determinístico por (usuario, fecha).
 *
 * La misma persona, el mismo día, saca SIEMPRE la misma carta: la carta no se
 * "tira" en el cliente, se deriva. Así sobrevive a un reload, a un reinstall y a
 * dos dispositivos, sin guardar nada extra.
 *
 * El sorteo es AZAR PURO (no está sesgado por los tránsitos). Eso es a propósito:
 * es un ritual, no un diagnóstico. Lo que hace honesto al texto no es que la carta
 * "sepa" tu cielo, sino que el LLM la lea AL LADO de tu tránsito real — ver la regla
 * del puente en `buildDailyPrompt` (convex/daily.ts).
 *
 * OJO: este archivo duplica nombre + correspondencia de `src/content/tarotDeck.ts`.
 * No se puede importar de ahí: ese módulo hace `require()` de las imágenes, que no
 * existe en el runtime de Convex. El front resuelve la imagen por `id`; acá solo
 * viajan los datos. Si tocás uno, tocá el otro.
 */

export type TarotDraw = {
  /** 0–21. El front resuelve la ilustración con `majorById(id)`. */
  id: number;
  nombre: string;
  /** Correspondencia astrológica verificada a mano (Golden Dawn / RWS).
   *  Es lo que le permite al LLM cruzar carta × tránsito sin inventar. */
  correspondencia: string;
};

const MAJORS: TarotDraw[] = [
  { id: 0, nombre: "El Loco", correspondencia: "Urano ♅ (aire)" },
  { id: 1, nombre: "El Mago", correspondencia: "Mercurio ☿" },
  { id: 2, nombre: "La Sacerdotisa", correspondencia: "Luna ☽" },
  { id: 3, nombre: "La Emperatriz", correspondencia: "Venus ♀" },
  { id: 4, nombre: "El Emperador", correspondencia: "Aries ♈" },
  { id: 5, nombre: "El Hierofante", correspondencia: "Tauro ♉" },
  { id: 6, nombre: "Los Enamorados", correspondencia: "Géminis ♊" },
  { id: 7, nombre: "El Carro", correspondencia: "Cáncer ♋" },
  { id: 8, nombre: "La Fuerza", correspondencia: "Leo ♌" },
  { id: 9, nombre: "El Ermitaño", correspondencia: "Virgo ♍" },
  { id: 10, nombre: "La Rueda de la Fortuna", correspondencia: "Júpiter ♃" },
  { id: 11, nombre: "La Justicia", correspondencia: "Libra ♎" },
  { id: 12, nombre: "El Colgado", correspondencia: "Neptuno ♆" },
  { id: 13, nombre: "La Muerte", correspondencia: "Escorpio ♏" },
  { id: 14, nombre: "La Templanza", correspondencia: "Sagitario ♐" },
  { id: 15, nombre: "El Diablo", correspondencia: "Capricornio ♑" },
  { id: 16, nombre: "La Torre", correspondencia: "Marte ♂" },
  { id: 17, nombre: "La Estrella", correspondencia: "Acuario ♒" },
  { id: 18, nombre: "La Luna", correspondencia: "Piscis ♓" },
  { id: 19, nombre: "El Sol", correspondencia: "Sol ☉" },
  { id: 20, nombre: "El Juicio", correspondencia: "Plutón ♇" },
  { id: 21, nombre: "El Mundo", correspondencia: "Saturno ♄" }
];

/** FNV-1a de 32 bits. Barato, sin deps, y dispersa bien cadenas cortas y parecidas
 *  (que es exactamente nuestro caso: el mismo userId con fechas consecutivas). */
function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** La carta de esa persona ese día. Determinística: misma entrada → misma carta. */
export function drawCard(args: { userId: string; localDate: string }): TarotDraw {
  const seed = hashSeed(`${args.userId}:${args.localDate}`);
  return MAJORS[seed % MAJORS.length];
}

export function cardById(id: number): TarotDraw | null {
  return MAJORS.find((c) => c.id === id) ?? null;
}
