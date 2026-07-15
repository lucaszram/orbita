import { ZodiacSign } from "../domain/types";

/**
 * Banco editorial por signo para el bloque principal de la Home
 * (titular serif + body + clima del día). Tres variantes por signo que
 * rotan por seed determinístico; cada una escrita desde el arquetipo del
 * signo con la voz Órbita y el registro del benchmark
 * (`docs/benchmark-voz-miss-astrologica.md`): gancho hablado → escena
 * reconocible → matiz honesto → acción concreta, 35-55 palabras, texto
 * llevado — no aforismos sueltos.
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
      body: "Lo primero que te sale hoy es empujar: contestar ya, definir ya. Ese impulso es información — te muestra qué te importa —, pero no es una orden. Elegí la única batalla que vale la pena y dale todo a esa; el resto aguanta hasta mañana.",
      clima: "Arranque fuerte, foco corto."
    },
    {
      headline: "Una cosa,\ncon todo.",
      body: "Hoy te alcanza el envión para abrir cinco frentes, y ahí está la trampa: cinco abiertos, ninguno cerrado. Agarrá el que más te pesa y llevalo hasta el final antes de tocar otro. Una sola cosa terminada ordena el día entero.",
      clima: "Impulso alto, dispersión al acecho."
    },
    {
      headline: "Frená\nmedio segundo.",
      body: "Entre lo que sentís y lo que respondés hay un espacio chiquito, y hoy vale oro. Escribí la respuesta si querés, pero no la mandes en caliente. Releela después de caminar hasta la cocina; si sigue pareciendo justa, mandala.",
      clima: "Fuego estable, mecha corta."
    }
  ],
  tauro: [
    {
      headline: "Tu ritmo\ntiene razón.",
      body: "Hoy alguien va a querer apurarte, y tu instinto va a ser plantarte. Hacele caso: lo que estás armando despacio queda bien armado, y lo apurado se rehace el jueves. Ir a tu ritmo acá es criterio, no demora. Avisá cuándo llegás y sostenelo.",
      clima: "Constancia alta, apuro ajeno."
    },
    {
      headline: "No cambies\nde plan.",
      body: "A mitad del día va a aparecer una idea nueva y brillante, con ganas de pisar el plan que venía funcionando. Anotala para mirarla mañana — si es buena, va a seguir siéndolo — y terminá hoy lo que empezaste. Casi siempre era ansiedad con buen marketing.",
      clima: "Tierra firme, ruido afuera."
    },
    {
      headline: "Decidí\ncaminando.",
      body: "Si hay una decisión dando vueltas, no la pelees sentado frente a la pantalla. Salí a caminar, comé bien, tocá algo concreto. El cuerpo en movimiento acomoda lo que la cabeza venía rumiando, y a la vuelta la respuesta suele estar más clara.",
      clima: "Cuerpo despierto, cabeza en pausa."
    }
  ],
  geminis: [
    {
      headline: "Decilo\nen una frase.",
      body: "Hoy tenés diez ideas por minuto y todas piden micrófono. Una sola importa de verdad. Antes de la reunión o del mensaje largo, probá esto: resumí lo que querés decir en una frase. Si no entra en una frase, todavía no lo tenés claro.",
      clima: "Mente rápida, señal única."
    },
    {
      headline: "Menos pestañas\nabiertas.",
      body: "Tu curiosidad hoy abre pestañas más rápido de lo que las cerrás — en el navegador y en la cabeza. No está mal; es tu manera de pensar. Pero elegí una conversación, una sola, y llevala hasta el final. Ahí está el rendimiento del día.",
      clima: "Chispa alta, foco a construir."
    },
    {
      headline: "Escuchá\nel doble.",
      body: "La información buena de hoy no llega hablando: aparece en lo que el otro suelta cuando terminás de preguntar y te quedás callado. Probalo una vez — la pregunta justa, y después silencio — y fijate cuánto más te cuentan.",
      clima: "Palabras de más, datos de menos."
    }
  ],
  cancer: [
    {
      headline: "Lo que sentís\nes un dato.",
      body: "Algo te va a mover el ánimo hoy antes de que sepas por qué. No lo tapes ni lo conviertas en drama: anotalo tal como vino. Tu sensibilidad suele leer antes que tu cabeza; el dato es bueno, aunque la interpretación pueda esperar hasta mañana.",
      clima: "Marea alta, memoria despierta."
    },
    {
      headline: "Hoy rendís\nen lo tuyo.",
      body: "Hay días para salir a buscar y días para volver a la base. Este es de los segundos: tu gente, tu espacio, tu ritmo. Lo de afuera aguanta 24 horas sin vos. Cociná algo, ordená tu rincón, escribile a quien extrañás — eso también es avanzar.",
      clima: "Sensibilidad alta, cáscara fina."
    },
    {
      headline: "No todo\nes personal.",
      body: "Hoy algo te va a rozar que no era para vos: un tono seco, una respuesta corta, un visto. Antes de rebobinar la relación entera, considerá la opción más simple — el otro estaba apurado. Quedate con lo que sí te nombra y dejá pasar el resto.",
      clima: "Emoción a flor, filtro necesario."
    }
  ],
  leo: [
    {
      headline: "Mostralo\nsin preámbulo.",
      body: "Cuando algo te sale bien, te dan ganas de presentarlo con introducción, contexto y defensa. Hoy no hace falta: lo que hiciste bien se defiende solo. Mandalo como está, sin el párrafo de disculpas adelante, y fijate qué vuelve.",
      clima: "Presencia alta, mirada ajena de más."
    },
    {
      headline: "El centro\nno se pide.",
      body: "Hoy puede picar que nadie aplauda lo que estás haciendo. En vez de salir a buscar la mirada, terminá una cosa con tu sello bien puesto y dejala donde se vea. El reconocimiento que llega solo dura bastante más que el que se pide.",
      clima: "Orgullo despierto, validación en pausa."
    },
    {
      headline: "Generosidad\ncon borde.",
      body: "Dar es tu idioma: el tiempo, la escucha, la mano que ofrecés sin que te la pidan. Hoy solo mirá la medida, porque tu calor rinde más en dosis que en incendio. Antes de ofrecerte para algo más, chequeá cuánto te queda en el tanque a vos.",
      clima: "Corazón grande, reserva justa."
    }
  ],
  virgo: [
    {
      headline: "Perfecto es\nenemigo de hecho.",
      body: "La versión de hoy ya está bien, aunque vos le veas los hilos. Nadie más se los ve. Entregala como está y anotá los ajustes para la próxima ronda: corregir sobre algo entregado rinde el doble que pulir en secreto.",
      clima: "Detalle fino, vara alta."
    },
    {
      headline: "Ordená una\nsola cosa.",
      body: "Tu cabeza hoy quiere sistematizarlo todo: la bandeja de entrada, el placard, la vida. Es mucha obra para un solo día. Elegí un rincón — una lista, un cajón, un tema — y dejalo impecable. El resto del caos aguanta hasta el finde.",
      clima: "Precisión alta, autocrítica al acecho."
    },
    {
      headline: "Dejá margen\npara el desvío.",
      body: "Algo hoy no va a salir según el plan, y el primer instinto va a ser corregirlo rápido. Antes de hacerlo, miralo un minuto: a veces el desvío resuelve algo que el plan no había visto. Si no, lo corregís igual — pero ya lo miraste.",
      clima: "Método firme, sorpresa útil."
    }
  ],
  libra: [
    {
      headline: "Elegí, aunque\nduela poco.",
      body: "Ver los dos lados de todo es tu don, y quedarte a vivir entre los dos, tu trampa. Hoy hay una decisión chica esperándote — el lugar, el día, el sí o el no — que se resuelve en un minuto. Tomala temprano y mirá cómo se libera el resto del día.",
      clima: "Balanza sensible, decisión pendiente."
    },
    {
      headline: "Decí primero\nlo que preferís.",
      body: "Cuando te pregunten dónde, cuándo o cuál, hoy contestá con tu preferencia antes de averiguar la del resto. Suena mínimo, pero cambia el día: complacer de entrada sale caro y casi nunca hacía falta. Probalo una vez y mirá qué pasa. Spoiler: nada.",
      clima: "Armonía buscada, voz propia primero."
    },
    {
      headline: "Con quién\nrendís mejor.",
      body: "Fijate hoy con quién terminás las conversaciones con más claridad y con quién salís más enredado que al entrar. No hace falta anunciarlo ni cortar nada: es información, y sirve para decidir la próxima reunión, el próximo café, la próxima consulta.",
      clima: "Encuentros finos, cuentas claras."
    }
  ],
  escorpio: [
    {
      headline: "Intensidad\ncon dirección.",
      body: "Lo que sentís hoy es fuerte, y no hay nada que arreglar ahí: es tu manera de estar en las cosas. La única decisión es dónde lo ponés. Elegí un solo destino para esa intensidad — un proyecto, una conversación pendiente — y no la desparrames.",
      clima: "Profundidad alta, control en reposo."
    },
    {
      headline: "No escarbes\ndonde duele.",
      body: "Tu radar hoy está más fino que de costumbre y va a encontrar de todo: el detalle raro, el mensaje ambiguo, la pieza que no cierra. Encontrar no obliga a excavar. Anotá el hallazgo y elegí con calma si es tema de hoy o de otro día.",
      clima: "Radar fino, fondo movido."
    },
    {
      headline: "El cambio,\na tu ritmo.",
      body: "Hay algo que venís queriendo cambiar y hoy la fuerza te sobra para hacerlo de un saque. Partilo en dos: hoy el primer movimiento, la semana que viene el segundo. Lo que se cambia por etapas queda cambiado; lo que se rompe de un golpe, a veces hay que pegarlo.",
      clima: "Fuego bajo, poder quieto."
    }
  ],
  sagitario: [
    {
      headline: "Apuntá antes\nde disparar.",
      body: "Tu entusiasmo hoy abre puertas solo, sin esfuerzo. El tema es cuál cruzar: si corrés hacia todas, no llegás a ninguna. Elegí una dirección a la mañana — una sola — y sostenela hasta la noche. Mañana podés cambiar; hoy toca profundidad.",
      clima: "Horizonte ancho, flecha única."
    },
    {
      headline: "La verdad,\ncon timing.",
      body: "Tenés razón y tenés ganas de decirla: se nota. Decila — callarte no es tu estilo ni hace falta —, pero mirá primero si el otro está en condiciones de escucharla hoy. La misma frase, dicha mañana temprano, puede aterrizar el doble de bien.",
      clima: "Franqueza alta, tacto a mano."
    },
    {
      headline: "Menos mapa,\nmás paso.",
      body: "Planear el viaje entero es la parte que más te gusta, y también la que te frena: el mapa crece y el primer paso nunca llega. Hoy invertí la proporción. Un tramo corto, caminado de verdad, te enseña más del camino que otra tarde de planificación.",
      clima: "Optimismo real, ansia de más."
    }
  ],
  capricornio: [
    {
      headline: "La cima espera;\nvos no.",
      body: "Tu meta no se cae por descansar un día: está construida mejor que eso. Hoy rendí sin exprimirte — trabajo bueno, jornada normal, corte a horario. Sostener el ritmo sin fundirte también es estrategia, y es la que llega más lejos.",
      clima: "Disciplina alta, exigencia de más."
    },
    {
      headline: "Delegá\nuna piedra.",
      body: "De todo lo que estás cargando hoy, hay al menos una cosa que agarraste por costumbre y que nadie te pidió. Encontrala y pasala: delegala, devolvela o avisá que no llegás. Tenés espalda de sobra; usala para lo que sí es tuyo.",
      clima: "Espalda fuerte, mochila revisable."
    },
    {
      headline: "Dejá una\npuerta abierta.",
      body: "Tu plan de hoy funciona, y justamente por eso podés permitirte no cerrarlo del todo. Dejá un hueco en la agenda sin nada adentro. Lo que aparece sin cita — la llamada, la idea, el encuentro — a veces suma más que lo previsto.",
      clima: "Orden firme, margen para improvisar."
    }
  ],
  acuario: [
    {
      headline: "Anotá la idea\nsin público.",
      body: "Se te va a ocurrir algo hoy que todavía no tiene público, y el silencio alrededor puede hacerlo parecer una mala idea. Las ideas tempranas se juzgan mal el primer día. Anotala completa, con fecha, y volvé a leerla en dos semanas.",
      clima: "Ideas propias, tribu opcional."
    },
    {
      headline: "Cerca también\nse piensa.",
      body: "Tu cabeza hoy tira hacia el esquema grande: el sistema, el futuro, el cómo debería ser todo. Mientras tanto hay una persona concreta, cerca tuyo, que necesita tu versión simple — un mensaje, una mano, media hora. Empezá por ahí; el esquema espera.",
      clima: "Cabeza lejos, corazón acá."
    },
    {
      headline: "Cambiá una\nregla chica.",
      body: "No hace falta la revolución hoy. Alcanza con agarrar una cosa que hacés en automático — el camino, el horario, el orden de la mañana — y hacerla distinta una vez. Ese cambio chiquito te muestra el sistema entero desde otro ángulo, que es lo que te gusta.",
      clima: "Diferencia activa, sistema en uso."
    }
  ],
  piscis: [
    {
      headline: "Ponele borde\nal agua.",
      body: "Tu intuición hoy está afinada: vas a captar el clima de cada lugar antes de que nadie diga una palabra. El riesgo es quedarte nadando en todo eso que sentís. Sentilo entero, y después elegí una sola cosa para hacer con lo que captaste.",
      clima: "Intuición alta, contorno a definir."
    },
    {
      headline: "No absorbas\nlo ajeno.",
      body: "Hoy vas a sentir lo de todos: el mal día del otro, la tensión de la reunión, el ánimo del grupo entero. Preguntate seguido, en serio: ¿esto que estoy sintiendo es mío? La mitad de las veces la respuesta es no, y con notarlo alcanza.",
      clima: "Esponja activa, filtro a mano."
    },
    {
      headline: "Soñá\ncon fecha.",
      body: "La idea que te viene rondando es buena; por algo vuelve. Hoy bajala del cielo a la agenda: definí el primer paso concreto y ponele día y hora. En cuanto tiene fecha deja de ser niebla y empieza a ser plan — y vos seguís soñando, pero con avances.",
      clima: "Imaginación alta, ancla necesaria."
    }
  ]
};
