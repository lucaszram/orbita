import { ZodiacSign } from "../domain/types";

/**
 * Banco editorial por signo para el bloque principal de la Home
 * (titular serif + body + clima del día). Tres variantes por signo que
 * rotan por seed determinístico; cada una escrita desde el arquetipo del
 * signo con la voz Órbita: seca, concreta, voseo, sin claims de destino.
 *
 * Cuando el backend genere contenido real, esta capa queda como fallback
 * y como referencia de tono por signo.
 */
export type SignDayVariant = {
  headline: string;
  body: string;
  clima: string;
};

export const signHomeBank: Record<ZodiacSign, SignDayVariant[]> = {
  aries: [
    {
      headline: "Hoy ganás\nsi no empujás.",
      body: "Tu primer impulso es información, no una orden. Elegí una sola batalla y dale todo a esa.",
      clima: "Arranque fuerte, foco corto."
    },
    {
      headline: "Una cosa,\ncon todo.",
      body: "La energía te alcanza para mucho, pero rinde en una. Cerrá algo hoy y el resto se acomoda.",
      clima: "Impulso alto, dispersión al acecho."
    },
    {
      headline: "Frená\nmedio segundo.",
      body: "Entre lo que sentís y lo que respondés hay un espacio: usalo. Ahí está tu ventaja de hoy.",
      clima: "Fuego estable, mecha corta."
    }
  ],
  tauro: [
    {
      headline: "Tu ritmo\ntiene razón.",
      body: "No es lentitud: es criterio. Lo que hoy construís despacio, mañana no hay que rehacerlo.",
      clima: "Constancia alta, apuro ajeno."
    },
    {
      headline: "No cambies\nde plan.",
      body: "El plan que ya tenés funciona. Hoy la tentación es moverlo; el acierto es sostenerlo.",
      clima: "Tierra firme, ruido afuera."
    },
    {
      headline: "El cuerpo\nmanda hoy.",
      body: "Comé bien, caminá, tocá materia. Las decisiones salen mejor con el cuerpo de tu lado.",
      clima: "Energía física alta, mental en pausa."
    }
  ],
  geminis: [
    {
      headline: "Decilo\nen una frase.",
      body: "Tenés diez ideas por minuto y una sola importa. Encontrala y decila antes de que se mezcle.",
      clima: "Mente rápida, señal única."
    },
    {
      headline: "Menos pestañas\nabiertas.",
      body: "Tu curiosidad hoy es ancha; tu día rinde angosto. Elegí una conversación y llevala hasta el final.",
      clima: "Chispa alta, foco a construir."
    },
    {
      headline: "Escuchá\nel doble.",
      body: "Hoy la información buena llega hablando menos. La pregunta justa vale más que la respuesta rápida.",
      clima: "Palabras de más, datos de menos."
    }
  ],
  cancer: [
    {
      headline: "Lo que sentís\nes un dato.",
      body: "No lo conviertas en drama ni lo escondas: anotalo. Tu sensibilidad hoy lee antes que tu cabeza.",
      clima: "Marea alta, memoria despierta."
    },
    {
      headline: "Cuidá tu\ncasa interna.",
      body: "Hoy rendís más cerca de lo tuyo: tu gente, tu espacio, tu ritmo. Lo de afuera puede esperar un día.",
      clima: "Sensibilidad alta, cáscara fina."
    },
    {
      headline: "No todo\nes personal.",
      body: "Hoy algo te va a rozar que no era para vos. Dejalo pasar y quedate con lo que sí te nombra.",
      clima: "Emoción a flor, filtro necesario."
    }
  ],
  leo: [
    {
      headline: "Brillá sin\npedir permiso.",
      body: "Lo que hacés bien hoy se nota solo. No lo expliques de más: mostralo y bancalo.",
      clima: "Presencia alta, mirada ajena de más."
    },
    {
      headline: "El centro\nno se pide.",
      body: "Hoy no necesitás aplauso: necesitás una cosa hecha con tu sello. Eso vuelve solo.",
      clima: "Orgullo despierto, validación en pausa."
    },
    {
      headline: "Generosidad\ncon borde.",
      body: "Dar es tu idioma, pero hoy dá con medida. Que tu calor no te deje frío a vos.",
      clima: "Corazón grande, reserva justa."
    }
  ],
  virgo: [
    {
      headline: "Perfecto es\nenemigo de hecho.",
      body: "La versión buena de hoy alcanza. Corregís mañana; hoy entregás.",
      clima: "Detalle fino, vara alta."
    },
    {
      headline: "Ordená una\nsola cosa.",
      body: "Tu cabeza quiere sistematizarlo todo. Elegí un rincón —una lista, un cajón, un tema— y listo.",
      clima: "Precisión alta, autocrítica al acecho."
    },
    {
      headline: "Soltá el control\nde a poco.",
      body: "Hoy algo no va a salir como lo planeaste, y va a estar bien igual. Dejá ese margen.",
      clima: "Método firme, sorpresa útil."
    }
  ],
  libra: [
    {
      headline: "Elegí, aunque\nduela poco.",
      body: "Ver los dos lados es tu don; quedarte entre los dos, tu trampa. Hoy una decisión chica te libera.",
      clima: "Balanza sensible, decisión pendiente."
    },
    {
      headline: "Tu paz no\nse negocia.",
      body: "Complacer hoy sale caro. Decí tu preferencia primero y mirá qué pasa: casi siempre pasa nada.",
      clima: "Armonía buscada, voz propia primero."
    },
    {
      headline: "El vínculo\njusto suma.",
      body: "Hoy se nota quién te equilibra y quién te inclina. No hace falta anunciarlo: solo verlo.",
      clima: "Encuentros finos, balance a la vista."
    }
  ],
  escorpio: [
    {
      headline: "Intensidad\ncon dirección.",
      body: "Lo que sentís hoy es fuerte y es tuyo. No lo diluyas, pero elegí dónde lo ponés.",
      clima: "Profundidad alta, control en reposo."
    },
    {
      headline: "No escarbes\ndonde duele.",
      body: "Tu radar hoy encuentra todo. No todo lo encontrado hay que tocarlo hoy.",
      clima: "Radar fino, fondo movido."
    },
    {
      headline: "Transformá,\nno rompas.",
      body: "Algo pide cambio y tenés la fuerza. La diferencia entre crisis y evolución es el ritmo.",
      clima: "Fuego bajo, poder quieto."
    }
  ],
  sagitario: [
    {
      headline: "Apuntá antes\nde disparar.",
      body: "Tu entusiasmo abre puertas; tu puntería las cruza. Hoy elegí una dirección y sostenela.",
      clima: "Horizonte ancho, flecha única."
    },
    {
      headline: "La verdad,\ncon timing.",
      body: "Tenés razón y ganas de decirla. Decila, pero mirá primero si el otro puede escucharla hoy.",
      clima: "Franqueza alta, tacto a mano."
    },
    {
      headline: "Menos mapa,\nmás paso.",
      body: "Planear el viaje entero te frena. Hoy alcanza con el primer tramo caminado de verdad.",
      clima: "Optimismo real, ansia de más."
    }
  ],
  capricornio: [
    {
      headline: "La cima espera;\nvos no.",
      body: "Tu meta no se cae por descansar un día. Hoy rendí sin exprimirte: también es estrategia.",
      clima: "Disciplina alta, exigencia de más."
    },
    {
      headline: "Delegá\nuna piedra.",
      body: "No todo lo pesado es tuyo. Hoy soltá una carga que agarraste por costumbre.",
      clima: "Espalda fuerte, mochila revisable."
    },
    {
      headline: "Dejá una\npuerta abierta.",
      body: "Tu plan funciona, pero hoy no lo cierres del todo: lo que aparece sin agenda puede sumar más que lo previsto.",
      clima: "Orden firme, margen para improvisar."
    }
  ],
  acuario: [
    {
      headline: "Tu rareza\nes el plan.",
      body: "Lo que se te ocurre hoy no es raro: es temprano. Anotalo aunque nadie lo vote todavía.",
      clima: "Ideas propias, tribu opcional."
    },
    {
      headline: "Cerca también\nse piensa.",
      body: "Hoy el gran esquema puede esperar: hay una persona concreta que necesita tu versión simple.",
      clima: "Cabeza lejos, corazón acá."
    },
    {
      headline: "Cambiá una\nregla chica.",
      body: "No hace falta la revolución hoy: alcanza con hacer distinto una cosa de siempre.",
      clima: "Diferencia activa, sistema en uso."
    }
  ],
  piscis: [
    {
      headline: "Ponele borde\nal agua.",
      body: "Tu intuición hoy es exacta; tu límite, difuso. Sentí todo, pero decidí una cosa.",
      clima: "Intuición alta, contorno a definir."
    },
    {
      headline: "No absorbas\nlo ajeno.",
      body: "Hoy sentís lo de todos. Preguntate seguido: ¿esto es mío? La mitad de las veces, no.",
      clima: "Esponja activa, filtro a mano."
    },
    {
      headline: "Soñá\ncon fecha.",
      body: "La idea que te ronda es buena. Bajala a un paso con día y hora, y deja de ser niebla.",
      clima: "Imaginación alta, ancla necesaria."
    }
  ]
};
