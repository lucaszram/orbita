import type { ImageSourcePropType } from "react-native";

/** Un Arcano Mayor: número, nombre, correspondencia astrológica VERIFICADA
 *  (Golden Dawn / RWS — el LLM alucina las correspondencias, por eso van a mano)
 *  y la ilustración del mazo Órbita. */
export type MajorArcana = {
  id: number; // 0–21
  roman: string;
  nombre: string;
  correspondencia: string;
  image: ImageSourcePropType;
};

// require() con string literal estático (Metro no resuelve template strings).
export const MAJOR_ARCANA: MajorArcana[] = [
  { id: 0, roman: "0", nombre: "El Loco", correspondencia: "Aire ♅", image: require("../../assets/orbita/optimized/tarot/major_00_el_loco.jpg") },
  { id: 1, roman: "I", nombre: "El Mago", correspondencia: "Mercurio ☿", image: require("../../assets/orbita/optimized/tarot/major_01_el_mago.jpg") },
  { id: 2, roman: "II", nombre: "La Sacerdotisa", correspondencia: "Luna ☽", image: require("../../assets/orbita/optimized/tarot/major_02_la_sacerdotisa.jpg") },
  { id: 3, roman: "III", nombre: "La Emperatriz", correspondencia: "Venus ♀", image: require("../../assets/orbita/optimized/tarot/major_03_la_emperatriz.jpg") },
  { id: 4, roman: "IV", nombre: "El Emperador", correspondencia: "Aries ♈", image: require("../../assets/orbita/optimized/tarot/major_04_el_emperador.jpg") },
  { id: 5, roman: "V", nombre: "El Hierofante", correspondencia: "Tauro ♉", image: require("../../assets/orbita/optimized/tarot/major_05_el_hierofante.jpg") },
  { id: 6, roman: "VI", nombre: "Los Enamorados", correspondencia: "Géminis ♊", image: require("../../assets/orbita/optimized/tarot/major_06_los_enamorados.jpg") },
  { id: 7, roman: "VII", nombre: "El Carro", correspondencia: "Cáncer ♋", image: require("../../assets/orbita/optimized/tarot/major_07_el_carro.jpg") },
  { id: 8, roman: "VIII", nombre: "La Fuerza", correspondencia: "Leo ♌", image: require("../../assets/orbita/optimized/tarot/major_08_la_fuerza.jpg") },
  { id: 9, roman: "IX", nombre: "El Ermitaño", correspondencia: "Virgo ♍", image: require("../../assets/orbita/optimized/tarot/major_09_el_ermitano.jpg") },
  { id: 10, roman: "X", nombre: "La Rueda de la Fortuna", correspondencia: "Júpiter ♃", image: require("../../assets/orbita/optimized/tarot/major_10_la_rueda.jpg") },
  { id: 11, roman: "XI", nombre: "La Justicia", correspondencia: "Libra ♎", image: require("../../assets/orbita/optimized/tarot/major_11_la_justicia.jpg") },
  { id: 12, roman: "XII", nombre: "El Colgado", correspondencia: "Neptuno ♆", image: require("../../assets/orbita/optimized/tarot/major_12_el_colgado.jpg") },
  { id: 13, roman: "XIII", nombre: "La Muerte", correspondencia: "Escorpio ♏", image: require("../../assets/orbita/optimized/tarot/major_13_la_muerte.jpg") },
  { id: 14, roman: "XIV", nombre: "La Templanza", correspondencia: "Sagitario ♐", image: require("../../assets/orbita/optimized/tarot/major_14_la_templanza.jpg") },
  { id: 15, roman: "XV", nombre: "El Diablo", correspondencia: "Capricornio ♑", image: require("../../assets/orbita/optimized/tarot/major_15_el_diablo.jpg") },
  { id: 16, roman: "XVI", nombre: "La Torre", correspondencia: "Marte ♂", image: require("../../assets/orbita/optimized/tarot/major_16_la_torre.jpg") },
  { id: 17, roman: "XVII", nombre: "La Estrella", correspondencia: "Acuario ♒", image: require("../../assets/orbita/optimized/tarot/major_17_la_estrella.jpg") },
  { id: 18, roman: "XVIII", nombre: "La Luna", correspondencia: "Piscis ♓", image: require("../../assets/orbita/optimized/tarot/major_18_la_luna.jpg") },
  { id: 19, roman: "XIX", nombre: "El Sol", correspondencia: "Sol ☉", image: require("../../assets/orbita/optimized/tarot/major_19_el_sol.jpg") },
  { id: 20, roman: "XX", nombre: "El Juicio", correspondencia: "Plutón ♇", image: require("../../assets/orbita/optimized/tarot/major_20_el_juicio.jpg") },
  { id: 21, roman: "XXI", nombre: "El Mundo", correspondencia: "Saturno ♄", image: require("../../assets/orbita/optimized/tarot/major_21_el_mundo.jpg") }
];

/** Dorso de la carta (boca abajo). Alternativa: `orbita_card_back_mandala.jpg`. */
export const CARD_BACK: ImageSourcePropType = require("../../assets/orbita/optimized/tarot/orbita_card_back_orbits.jpg");

export const majorById = (id: number) => MAJOR_ARCANA.find((c) => c.id === id);

/** Carta del dÃ­a para el modo INVITADO (sin backend que sortee ni recuerde):
 *  sorteo determinÃ­stico por fecha (FNV-1a) â la misma carta para todos los
 *  invitados ese dÃ­a, estable durante todo el dÃ­a. Los beats son la versiÃ³n
 *  genÃ©rica: la ontologÃ­a editorial curada por carta llega en una tanda
 *  aparte, y la lectura completa (carta + tu cielo) es del backend. */
export function guestCardOfTheDay(localDate: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < localDate.length; i += 1) {
    hash ^= localDate.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const card = MAJOR_ARCANA[(hash >>> 0) % MAJOR_ARCANA.length];
  return {
    id: card.id,
    nombre: card.nombre,
    correspondencia: card.correspondencia,
    beats: [
      {
        label: "QUÉ ES",
        body: `${card.nombre} es uno de los 22 Arcanos Mayores del tarot. Su correspondencia astrológica es ${card.correspondencia}.`
      },
      {
        label: "CÓMO INFLUYE HOY",
        body: `Usala como lente del día: qué de ${card.nombre} aparece hoy en lo que tenés entre manos.`
      },
      {
        label: "CÓMO SE CONECTA CON TU CIELO",
        body: "Creá tu cuenta para que la carta se lea sobre tu carta natal y los tránsitos de hoy."
      }
    ]
  };
}
