import type { ImageSourcePropType } from "react-native";

/** Un Arcano Mayor: número, nombre, correspondencia astrológica VERIFICADA
 *  (Golden Dawn / RWS — el LLM alucina las correspondencias, por eso van a mano),
 *  perfil editorial curado y la ilustración del mazo Órbita.
 *
 *  `queEs` y `hoy` son la ontología editorial de `docs/carta-dia-modelo-editorial.md`:
 *  qué ES la carta (movimiento + exceso, sin esoterismo de manual) y cómo usarla
 *  como lente HOY (mirada concreta, nunca predicción). Los usa el modo invitado y
 *  deben migrar también al prompt productivo (backend) para que el LLM parta de
 *  la carta real y no solo de nombre + correspondencia. */
export type MajorArcana = {
  id: number; // 0–21
  roman: string;
  nombre: string;
  correspondencia: string;
  /** Qué es la carta: el movimiento que nombra y su exceso. 2 frases. */
  queEs: string;
  /** La carta como lente de hoy: una mirada o pregunta concreta. 1-2 frases. */
  hoy: string;
  image: ImageSourcePropType;
};

// require() con string literal estático (Metro no resuelve template strings).
export const MAJOR_ARCANA: MajorArcana[] = [
  {
    id: 0, roman: "0", nombre: "El Loco", correspondencia: "Aire ♅",
    queEs: "El pie ya está en el aire antes de que el camino exista: eso es El Loco. Su fuerza es no cargar historia — puede empezar cualquier cosa; su exceso, saltar para no mirar dónde está parado.",
    hoy: "Mirá dónde conviene arrancar hoy algo chico sin esperar la certeza completa.",
    image: require("../../assets/orbita/optimized/tarot/major_00_el_loco.jpg")
  },
  {
    id: 1, roman: "I", nombre: "El Mago", correspondencia: "Mercurio ☿",
    queEs: "Las herramientas sobre la mesa y la mano que las usa. Habla de concretar con lo que ya tenés; su trampa es el truco que solo impresiona.",
    hoy: "¿Qué podés resolver hoy con lo que ya está a mano, sin sumar nada nuevo?",
    image: require("../../assets/orbita/optimized/tarot/major_01_el_mago.jpg")
  },
  {
    id: 2, roman: "II", nombre: "La Sacerdotisa", correspondencia: "Luna ☽",
    queEs: "Lo que se sabe sin decirse todavía. Pide leer antes de actuar; su exceso es guardar tanto que nadie entra.",
    hoy: "Hoy vale más lo que notás que lo que declarás. Anotalo antes de compartirlo.",
    image: require("../../assets/orbita/optimized/tarot/major_02_la_sacerdotisa.jpg")
  },
  {
    id: 3, roman: "III", nombre: "La Emperatriz", correspondencia: "Venus ♀",
    queEs: "Lo que crece cuando lo alimentás. Habla de cuidar lo que está vivo; su exceso, ahogarlo de atención.",
    hoy: "Elegí una sola cosa — un proyecto, un vínculo, tu cuerpo — y dale de comer hoy, sin apuro.",
    image: require("../../assets/orbita/optimized/tarot/major_03_la_emperatriz.jpg")
  },
  {
    id: 4, roman: "IV", nombre: "El Emperador", correspondencia: "Aries ♈",
    queEs: "El orden que sostiene. Poner marco, decidir, hacerse cargo; su exceso es el control que no escucha.",
    hoy: "¿Qué necesita hoy una regla clara en vez de otra conversación?",
    image: require("../../assets/orbita/optimized/tarot/major_04_el_emperador.jpg")
  },
  {
    id: 5, roman: "V", nombre: "El Hierofante", correspondencia: "Tauro ♉",
    queEs: "Lo aprendido que ordena: el método probado, el que ya pasó por acá. Su exceso, obedecer el manual sin revisarlo.",
    hoy: "Antes de inventar de cero, fijate si alguien ya resolvió esto — y qué parte de ese manual ya no te sirve.",
    image: require("../../assets/orbita/optimized/tarot/major_05_el_hierofante.jpg")
  },
  {
    id: 6, roman: "VI", nombre: "Los Enamorados", correspondencia: "Géminis ♊",
    queEs: "La elección que define. Dos caminos que valen y una decisión que no se puede tercerizar.",
    hoy: "¿Qué elección venís empatando para no perder ninguna de las dos opciones?",
    image: require("../../assets/orbita/optimized/tarot/major_06_los_enamorados.jpg")
  },
  {
    id: 7, roman: "VII", nombre: "El Carro", correspondencia: "Cáncer ♋",
    queEs: "Dirección con las riendas en la mano: avanzar juntando fuerzas que tiran para lados distintos. Su exceso, ganar la carrera equivocada.",
    hoy: "Definí adónde vas hoy antes de acelerar. Velocidad sin dirección es solo ruido.",
    image: require("../../assets/orbita/optimized/tarot/major_07_el_carro.jpg")
  },
  {
    id: 8, roman: "VIII", nombre: "La Fuerza", correspondencia: "Leo ♌",
    queEs: "La fuerza que no aprieta: sostener un impulso sin estrangularlo. Su exceso, la paciencia que se vuelve aguante infinito.",
    hoy: "Lo que te desborda hoy no se doma a los gritos: bajá la intensidad y quedate.",
    image: require("../../assets/orbita/optimized/tarot/major_08_la_fuerza.jpg")
  },
  {
    id: 9, roman: "IX", nombre: "El Ermitaño", correspondencia: "Virgo ♍",
    queEs: "El paso al costado para ver mejor: silencio elegido, criterio propio. Su exceso, esconderse y llamarlo profundidad.",
    hoy: "Reservá hoy un rato a solas con el tema que más ruido te hace. Sin pantalla y sin consultarlo.",
    image: require("../../assets/orbita/optimized/tarot/major_09_el_ermitano.jpg")
  },
  {
    id: 10, roman: "X", nombre: "La Rueda de la Fortuna", correspondencia: "Júpiter ♃",
    queEs: "El giro que no controlás: las condiciones cambian solas. Lo tuyo es cómo te agarra el cambio.",
    hoy: "¿Qué cambió alrededor tuyo que seguís tratando como si fuera igual que antes?",
    image: require("../../assets/orbita/optimized/tarot/major_10_la_rueda.jpg")
  },
  {
    id: 11, roman: "XI", nombre: "La Justicia", correspondencia: "Libra ♎",
    queEs: "El fiel de la balanza: medir con la misma vara, decir lo que es. Su exceso, la exactitud sin ninguna piedad.",
    hoy: "Revisá hoy un trato desparejo — aunque quien sale ganando seas vos.",
    image: require("../../assets/orbita/optimized/tarot/major_11_la_justicia.jpg")
  },
  {
    id: 12, roman: "XII", nombre: "El Colgado", correspondencia: "Neptuno ♆",
    queEs: "La pausa que cambia el ángulo: soltar el control un rato para ver desde otro lado. Su exceso, quedarse colgado y llamarlo espera.",
    hoy: "Lo que no avanza hoy quizás no pide más empuje: pide mirarlo al revés.",
    image: require("../../assets/orbita/optimized/tarot/major_12_el_colgado.jpg")
  },
  {
    id: 13, roman: "XIII", nombre: "La Muerte", correspondencia: "Escorpio ♏",
    queEs: "El final que hace lugar: cerrar lo que ya terminó para que entre lo que sigue. Su exceso, cortar todo apenas incomoda.",
    hoy: "¿Qué cosa ya terminó y sigue abierta solo porque nadie la cerró?",
    image: require("../../assets/orbita/optimized/tarot/major_13_la_muerte.jpg")
  },
  {
    id: 14, roman: "XIV", nombre: "La Templanza", correspondencia: "Sagitario ♐",
    queEs: "La mezcla justa: combinar opuestos sin apurar el resultado. Su exceso, diluirlo todo para no elegir.",
    hoy: "Hoy el punto medio no es tibio: es preciso. Ajustá la dosis, no la dirección.",
    image: require("../../assets/orbita/optimized/tarot/major_14_la_templanza.jpg")
  },
  {
    id: 15, roman: "XV", nombre: "El Diablo", correspondencia: "Capricornio ♑",
    queEs: "El acuerdo que ata: lo que te tiene agarrado lleva tu firma abajo. Su fuerza es mostrar la cadena que elegiste.",
    hoy: "¿Qué costumbre de hoy elegiste hace tiempo y nunca volviste a revisar?",
    image: require("../../assets/orbita/optimized/tarot/major_15_el_diablo.jpg")
  },
  {
    id: 16, roman: "XVI", nombre: "La Torre", correspondencia: "Marte ♂",
    queEs: "Lo construido sobre base floja, cayendo. Corta de golpe lo que ya venía rajado; después del ruido se ve el terreno.",
    hoy: "Si algo se desarma hoy, antes de reconstruirlo rápido preguntate si la base valía.",
    image: require("../../assets/orbita/optimized/tarot/major_16_la_torre.jpg")
  },
  {
    id: 17, roman: "XVII", nombre: "La Estrella", correspondencia: "Acuario ♒",
    queEs: "El cielo despejado después de la tormenta: orientarse por algo lejano y limpio. Su exceso, mirar tan lejos que hoy no pasa nada.",
    hoy: "Elegí una referencia de largo plazo y hacé hoy el gesto mínimo hacia ahí.",
    image: require("../../assets/orbita/optimized/tarot/major_17_la_estrella.jpg")
  },
  {
    id: 18, roman: "XVIII", nombre: "La Luna", correspondencia: "Piscis ♓",
    queEs: "El terreno a media luz: la imaginación llena los huecos que el dato deja. A veces es intuición; a veces, miedo disfrazado de información.",
    hoy: "Antes de reaccionar hoy, separá: ¿qué viste de verdad y qué completaste vos?",
    image: require("../../assets/orbita/optimized/tarot/major_18_la_luna.jpg")
  },
  {
    id: 19, roman: "XIX", nombre: "El Sol", correspondencia: "Sol ☉",
    queEs: "Lo que funciona a la vista: claridad, juego, lo simple que rinde. Su exceso, un brillo que no deja preguntar.",
    hoy: "Mostrá hoy lo que ya funciona en vez de seguir puliendo lo que falta.",
    image: require("../../assets/orbita/optimized/tarot/major_19_el_sol.jpg")
  },
  {
    id: 20, roman: "XX", nombre: "El Juicio", correspondencia: "Plutón ♇",
    queEs: "El llamado a levantarse distinto: revisar lo hecho y responder por eso. Su exceso, el veredicto eterno sobre uno mismo.",
    hoy: "Mirá el último ciclo que cerraste: ¿qué aprendiste ahí que todavía no aplicaste ni una vez?",
    image: require("../../assets/orbita/optimized/tarot/major_20_el_juicio.jpg")
  },
  {
    id: 21, roman: "XXI", nombre: "El Mundo", correspondencia: "Saturno ♄",
    queEs: "La vuelta completa: algo se termina entero y te deja más grande. Su exceso, estirar la vuelta olímpica.",
    hoy: "Cerrá hoy formalmente algo que ya está logrado: nombralo y archivalo.",
    image: require("../../assets/orbita/optimized/tarot/major_21_el_mundo.jpg")
  }
];

/** Dorso de la carta (boca abajo). Alternativa: `orbita_card_back_mandala.jpg`. */
export const CARD_BACK: ImageSourcePropType = require("../../assets/orbita/optimized/tarot/orbita_card_back_orbits.jpg");

export const majorById = (id: number) => MAJOR_ARCANA.find((c) => c.id === id);

/** Carta del día para el modo INVITADO (sin sesión).
 *
 *  Con sesión, la carta la sortea el backend por (userId, fecha) y la escribe el LLM —
 *  ver `convex/lib/tarot.ts`. Acá no hay usuario, así que sembramos solo con la fecha:
 *  todos los invitados sacan la misma carta ese día, y no hay lectura personalizada.
 *  Es una vidriera del ritual, no el ritual. */
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
      { label: "QUÉ ES", body: `${card.queEs} Su correspondencia astrológica es ${card.correspondencia}.` },
      { label: "CÓMO INFLUYE HOY", body: card.hoy },
      {
        label: "CÓMO SE CONECTA CON TU CIELO",
        body: "Creá tu cuenta para que la carta se lea sobre tu carta natal y los tránsitos de hoy."
      }
    ]
  };
}
