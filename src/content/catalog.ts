import { ContentTemplate, Ritual, TarotCard, Topic, TransitEvent, ZodiacSign } from "../domain/types";

export const colors = [
  "Amatista",
  "Dorado suave",
  "Azul noche",
  "Rosa cuarzo",
  "Verde salvia",
  "Blanco lunar",
  "Coral",
  "Lavanda"
] as const;

export const mantras = [
  "Lo que hoy cuido, mañana crece con más calma.",
  "Puedo escuchar mi intuición sin apurar la respuesta.",
  "Mi energía merece dirección, no exigencia.",
  "Hoy elijo claridad antes que reacción.",
  "No todo mensaje llega fuerte; algunos llegan en paz.",
  "Me permito avanzar con suavidad y firmeza."
] as const;

export const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

export const weeklyColorMeanings = [
  {
    color: "Rojo coral",
    symbol: "fuego",
    focus: "decisiones" as Topic,
    meaning: "Activa valentía sin empujar de más.",
    action: "Usalo cuando necesites dar un primer paso concreto."
  },
  {
    color: "Verde salvia",
    symbol: "hoja",
    focus: "dinero" as Topic,
    meaning: "Ordena lo material y baja la ansiedad.",
    action: "Usalo para revisar gastos, casa o prioridades."
  },
  {
    color: "Rosa cuarzo",
    symbol: "corazon",
    focus: "amor" as Topic,
    meaning: "Abre ternura sin perder límites.",
    action: "Usalo para hablar con honestidad y cuidado."
  },
  {
    color: "Azul noche",
    symbol: "luna",
    focus: "claridad" as Topic,
    meaning: "Invita a pensar antes de responder.",
    action: "Usalo si tenés que elegir palabras con calma."
  },
  {
    color: "Dorado suave",
    symbol: "sol",
    focus: "trabajo" as Topic,
    meaning: "Trae presencia, foco y visibilidad.",
    action: "Usalo para mostrar una idea o cerrar una tarea."
  },
  {
    color: "Lavanda",
    symbol: "estrella",
    focus: "proteccion" as Topic,
    meaning: "Suaviza energía cargada sin apagar tu intuición.",
    action: "Usalo cuando necesites filtrar ruido ajeno."
  },
  {
    color: "Blanco lunar",
    symbol: "agua",
    focus: "energia" as Topic,
    meaning: "Limpia el exceso y devuelve centro.",
    action: "Usalo para descansar, escribir o cerrar la semana."
  }
] as const;

export const dailyHooks = [
  "Si este mensaje te encontró hoy, no es casualidad.",
  "Tu signo tiene algo que decirte antes de que termine el día.",
  "Hoy tu energía cambia de dirección si escuchás esta señal.",
  "No abras mil caminos: hoy hay una señal pequeña esperando.",
  "Esto no viene a asustarte, viene a ordenarte el día."
] as const;

export const relationshipLines = [
  {
    userEnergy: "Estás buscando claridad, pero también una respuesta que no te obligue a perder ternura.",
    partnerEnergy: "La otra energía aparece intermitente: se acerca cuando baja la presión y se aleja si siente demanda.",
    sharedEnergy: "Hay química, pero necesita ritmo. Si todo se acelera, la conexión se vuelve confusa.",
    advice: "No empujes una definición hoy. Hacé una pregunta simple y observá si hay presencia real."
  },
  {
    userEnergy: "Tu parte sensible quiere señales concretas, no promesas sueltas.",
    partnerEnergy: "La otra energía está más mental que emocional; puede necesitar tiempo para procesar.",
    sharedEnergy: "El vínculo tiene espejo: muestra dónde cada uno pide seguridad de formas distintas.",
    advice: "Bajá la interpretación y subí la honestidad. Lo que no se pregunta se convierte en fantasía."
  },
  {
    userEnergy: "Ya podés elegirte, incluso si todavía hay curiosidad por esa persona.",
    partnerEnergy: "La otra energía trae deseo, pero no siempre trae estructura.",
    sharedEnergy: "La conexión prende rápido, aunque necesita límites para no volverse desgaste.",
    advice: "No confundas intensidad con dirección. Mirá si sus acciones sostienen lo que dice."
  }
] as const;

export const transitEvents: TransitEvent[] = [
  {
    id: "mercurio-revision",
    title: "Mercurio pide revisar antes de contestar",
    eventType: "mercurio",
    date: "2026-07-01",
    affectedSigns: ["geminis", "virgo", "sagitario", "piscis"],
    summary: "La energía mental está más rápida que clara. No todo mensaje necesita respuesta inmediata.",
    doThis: "Releé, guardá borradores y confirmá datos antes de cerrar algo.",
    avoid: "Prometer desde la ansiedad o discutir por suposiciones.",
    intensity: 74
  },
  {
    id: "luna-llena-cuidado",
    title: "Luna llena: lo emocional sube a la superficie",
    eventType: "luna",
    date: "2026-07-02",
    affectedSigns: ["cancer", "capricornio", "aries", "libra"],
    summary: "Una emoción vieja puede pedir lugar, pero no necesariamente una decisión urgente.",
    doThis: "Escribí lo que sentís antes de convertirlo en conversación.",
    avoid: "Tomar distancia dramática para probar si alguien te busca.",
    intensity: 86
  },
  {
    id: "venus-vinculo",
    title: "Venus mueve deseo, ternura y comparaciones",
    eventType: "venus",
    date: "2026-07-03",
    affectedSigns: ["tauro", "libra", "leo", "acuario"],
    summary: "El amor pide menos performance y más reciprocidad visible.",
    doThis: "Mirá dónde hay calma, no solo dónde hay chispa.",
    avoid: "Medirte con historias ajenas o romantizar migajas.",
    intensity: 68
  },
  {
    id: "temporada-cancer",
    title: "Temporada de Cáncer: casa, raíz y sensibilidad",
    eventType: "temporada",
    date: "2026-07-04",
    affectedSigns: ["cancer", "escorpio", "piscis", "capricornio"],
    summary: "La energía colectiva pide volver al cuerpo y cuidar los espacios donde descansás.",
    doThis: "Ordená una esquina de tu casa como si ordenaras una emoción.",
    avoid: "Confundir nostalgia con señal de volver.",
    intensity: 62
  }
];

export const weeklyReadingCopy = {
  energy: [
    "Esta semana no pide correr: pide elegir dónde ponés tu fuego.",
    "La energía se ordena cuando hacés menos cosas, pero con más intención.",
    "Hay una puerta abierta, aunque no se abre desde el ruido.",
    "Tu intuición está fuerte; dale estructura para que no se vuelva ansiedad."
  ],
  love: [
    "En amor, una conversación simple puede mostrar más que una señal enorme.",
    "No confundas silencio con misterio. Mirá presencia, cuidado y continuidad.",
    "La ternura vuelve cuando dejás de actuar desde la prueba.",
    "Si alguien te da calma, no lo descartes por no parecer intenso."
  ],
  workMoney: [
    "En trabajo y dinero, orden pequeño antes de expansión grande.",
    "Una tarea atrasada puede liberar energía mental si la cerrás esta semana.",
    "Tu valor no necesita justificarse de más, pero sí necesita una acción clara.",
    "Revisá números sin castigarte: mirar también es recuperar poder."
  ],
  advice: [
    "Hacé una cosa que tu yo de mañana pueda agradecer.",
    "Elegir lento también es elegir.",
    "No abras una puerta solo porque alguien golpeó fuerte.",
    "Tu límite no arruina el vínculo correcto."
  ]
} as const;

export const rituals: Ritual[] = [
  {
    id: "ritual-agua",
    title: "Agua con intención",
    minutes: 3,
    steps: [
      "Serví un vaso de agua.",
      "Pensá una palabra guía para tu día.",
      "Tomalo despacio antes de mirar el celular."
    ]
  },
  {
    id: "ritual-vela",
    title: "Luz corta",
    minutes: 5,
    steps: [
      "Prendé una vela o una luz pequeña.",
      "Respirá tres veces con la mano en el pecho.",
      "Anotá una decisión que no querés tomar desde el miedo."
    ]
  },
  {
    id: "ritual-puerta",
    title: "Puerta limpia",
    minutes: 4,
    steps: [
      "Antes de salir, quedate un momento en la puerta.",
      "Nombrá lo que dejás afuera por hoy.",
      "Cruzá con una acción concreta en mente."
    ]
  },
  {
    id: "ritual-luna",
    title: "Nota lunar",
    minutes: 6,
    steps: [
      "Escribí una pregunta simple.",
      "Respondé sin editarte durante un minuto.",
      "Subrayá la frase que te trajo más paz."
    ]
  }
];

export const tarotCards: TarotCard[] = [
  {
    id: "la-estrella",
    name: "La Estrella",
    arcana: "mayor",
    keywords: ["calma", "guía", "renovación"],
    meaning: "Hay una señal de alivio cuando dejás de forzar una respuesta. Mirá lo que vuelve a sentirse posible.",
    ritual: "Hacé una lista de tres cosas que ya están mejorando, aunque sean pequeñas."
  },
  {
    id: "la-templanza",
    name: "La Templanza",
    arcana: "mayor",
    keywords: ["balance", "paciencia", "medida"],
    meaning: "El día pide mezcla justa: menos impulso, más escucha. Una conversación puede ordenarse si bajás el volumen.",
    ritual: "Antes de responder algo importante, esperá diez respiraciones."
  },
  {
    id: "el-mago",
    name: "El Mago",
    arcana: "mayor",
    keywords: ["acción", "recursos", "inicio"],
    meaning: "Tenés más herramientas de las que estás usando. El primer paso no tiene que ser perfecto, solo real.",
    ritual: "Elegí una tarea de diez minutos y cerrala hoy."
  },
  {
    id: "la-luna",
    name: "La Luna",
    arcana: "mayor",
    keywords: ["intuición", "sombra", "sueño"],
    meaning: "No todo está listo para verse completo. Tu intuición puede acompañar, pero no reemplaza la calma.",
    ritual: "Anotá un sueño, una sensación o una coincidencia sin sacar conclusiones todavía."
  },
  {
    id: "seis-de-oros",
    name: "Seis de Oros",
    arcana: "menor",
    keywords: ["intercambio", "ayuda", "merecimiento"],
    meaning: "Dar y recibir necesitan volver a equilibrarse. Observá dónde estás entregando de más.",
    ritual: "Pedí una ayuda concreta o poné un límite pequeño."
  }
];

const signVoice: Record<ZodiacSign, string> = {
  aries: "Tu fuego necesita una dirección amable: hoy no todo se gana empujando.",
  tauro: "Tu calma vuelve cuando ordenás lo simple y respetás tus tiempos.",
  geminis: "Tu mente trae respuestas, pero el cuerpo te marca cuáles son sostenibles.",
  cancer: "Tu sensibilidad no es exceso: es brújula cuando la escuchás con límites.",
  leo: "Tu brillo se nota más cuando no busca permiso.",
  virgo: "La claridad aparece cuando dejás de corregirte y empezás a elegir.",
  libra: "Tu equilibrio no pide complacer a todos; pide escucharte primero.",
  escorpio: "Lo profundo puede moverse sin romperlo todo. Hoy alcanza con reconocerlo.",
  sagitario: "Tu expansión necesita una promesa concreta, no diez caminos abiertos.",
  capricornio: "Tu disciplina se vuelve más poderosa cuando también te cuida.",
  acuario: "Tu diferencia puede ordenar el día si no la escondés para encajar.",
  piscis: "Tu intuición está despierta; dale tierra con una acción pequeña."
};

const topicCopy: Record<Topic, Omit<ContentTemplate, "id" | "kind" | "topic">> = {
  amor: {
    tone: "suave",
    title: "Amor con presencia",
    body: "No leas entre líneas si podés pedir una palabra clara. La ternura también necesita acuerdos.",
    action: "Mandá un mensaje honesto y breve, sin buscar controlar la respuesta."
  },
  trabajo: {
    tone: "directo",
    title: "Trabajo con foco",
    body: "Una prioridad bien elegida vale más que una lista perfecta. Hoy tu energía rinde mejor en una sola cosa.",
    action: "Marcá la tarea que desbloquea el resto y empezala por veinte minutos."
  },
  dinero: {
    tone: "protector",
    title: "Dinero con orden",
    body: "La abundancia también se entrena mirando de frente. Un número claro puede bajarte la ansiedad.",
    action: "Revisá un gasto, una deuda o una meta sin juzgarte."
  },
  energia: {
    tone: "expansivo",
    title: "Energía disponible",
    body: "Tu cuerpo sabe antes que tu agenda. Si baja la fuerza, no significa fracaso: significa ajuste.",
    action: "Hacé una pausa de tres minutos sin pantalla."
  },
  familia: {
    tone: "suave",
    title: "Familia y raíz",
    body: "Una dinámica vieja no necesita repetirse para pertenecer. Podés amar con un límite.",
    action: "Respondé desde lo que hoy podés sostener, no desde la culpa."
  },
  vinculos: {
    tone: "suave",
    title: "Vínculos con claridad",
    body: "La conexión se ordena cuando bajás la expectativa a una frase simple. Menos interpretación, más presencia.",
    action: "Decí lo que necesitás en una línea, sin adornar ni exigir."
  },
  decisiones: {
    tone: "directo",
    title: "Decisión limpia",
    body: "La señal no siempre llega como certeza absoluta. A veces llega como menos ruido interno.",
    action: "Escribí dos opciones y elegí la que te deja respirar mejor."
  },
  claridad: {
    tone: "protector",
    title: "Claridad sin apuro",
    body: "No fuerces una conclusión cuando todavía estás juntando piezas. La calma también informa.",
    action: "Anotá qué dato te falta antes de decidir."
  },
  proteccion: {
    tone: "protector",
    title: "Protección diaria",
    body: "Cuidarte no es cerrarte. Es elegir dónde sí y dónde no poner tu energía.",
    action: "Cancelá o posponé una cosa que hoy no te corresponde."
  },
  luna: {
    tone: "expansivo",
    title: "Pulso lunar",
    body: "Hay emociones que solo piden ser vistas. No las conviertas todas en tareas.",
    action: "Dale nombre a lo que sentís y dejalo escrito."
  }
};

export const contentTemplates: ContentTemplate[] = [
  ...Object.entries(signVoice).map(([sign, body]) => ({
    id: `daily-${sign}`,
    kind: "daily-message" as const,
    zodiacSign: sign as ZodiacSign,
    tone: "suave" as const,
    title: "Tu mensaje de hoy",
    body,
    action: "Elegí una acción pequeña y cumplila antes del mediodía."
  })),
  ...Object.entries(topicCopy).map(([topic, template]) => ({
    id: `recommendation-${topic}`,
    kind: "recommendation" as const,
    topic: topic as Topic,
    ...template
  })),
  {
    id: "feed-mercurio",
    kind: "micro-feed",
    topic: "claridad",
    tone: "directo",
    title: "Cuando todo se mezcla",
    body: "Si una conversación se repite, cambiá la pregunta. A veces la llave no es insistir, es precisar.",
    action: "Preguntá qué necesitás saber, no lo que temés escuchar."
  },
  {
    id: "feed-proteccion",
    kind: "micro-feed",
    topic: "proteccion",
    tone: "protector",
    title: "Energía prestada",
    body: "No cargues emociones ajenas como si fueran prueba de amor. Acompañar no es absorber.",
    action: "Devolvé con cariño una responsabilidad que no es tuya."
  },
  {
    id: "feed-luna",
    kind: "micro-feed",
    topic: "luna",
    tone: "expansivo",
    title: "La luna también baja",
    body: "No todos los días piden manifestar. Algunos piden limpiar, descansar y escuchar.",
    action: "Cerrá una pequeña deuda emocional con vos."
  }
];
