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
  "Lo que hoy cuido, manana crece con mas calma.",
  "Puedo escuchar mi intuicion sin apurar la respuesta.",
  "Mi energia merece direccion, no exigencia.",
  "Hoy elijo claridad antes que reaccion.",
  "No todo mensaje llega fuerte; algunos llegan en paz.",
  "Me permito avanzar con suavidad y firmeza."
] as const;

export const dayNames = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"] as const;

export const weeklyColorMeanings = [
  {
    color: "Rojo coral",
    symbol: "fuego",
    focus: "decisiones" as Topic,
    meaning: "Activa valentia sin empujar de mas.",
    action: "Usalo cuando necesites dar un primer paso concreto."
  },
  {
    color: "Verde salvia",
    symbol: "hoja",
    focus: "dinero" as Topic,
    meaning: "Ordena lo material y baja ansiedad.",
    action: "Usalo para revisar gastos, casa o prioridades."
  },
  {
    color: "Rosa cuarzo",
    symbol: "corazon",
    focus: "amor" as Topic,
    meaning: "Abre ternura sin perder limites.",
    action: "Usalo para hablar con honestidad y cuidado."
  },
  {
    color: "Azul noche",
    symbol: "luna",
    focus: "claridad" as Topic,
    meaning: "Invita a pensar antes de responder.",
    action: "Usalo si tenes que elegir palabras con calma."
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
    meaning: "Suaviza energia cargada sin apagar tu intuicion.",
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
  "Si este mensaje te encontro hoy, no es casualidad.",
  "Tu signo tiene algo que decirte antes de que termine el dia.",
  "Hoy tu energía cambia de dirección si escuchás esta señal.",
  "No abras mil caminos: hoy hay una señal pequeña esperando.",
  "Esto no viene a asustarte, viene a ordenarte el dia."
] as const;

export const relationshipLines = [
  {
    userEnergy: "Estas buscando claridad, pero tambien una respuesta que no te obligue a perder ternura.",
    partnerEnergy: "La otra energia aparece intermitente: se acerca cuando baja la presion y se aleja si siente demanda.",
    sharedEnergy: "Hay quimica, pero necesita ritmo. Si todo se acelera, la conexion se vuelve confusa.",
    advice: "No empujes una definicion hoy. Hace una pregunta simple y observa si hay presencia real."
  },
  {
    userEnergy: "Tu parte sensible quiere señales concretas, no promesas sueltas.",
    partnerEnergy: "La otra energia esta mas mental que emocional; puede necesitar tiempo para procesar.",
    sharedEnergy: "El vinculo tiene espejo: muestra donde cada uno pide seguridad de formas distintas.",
    advice: "Baja la interpretacion y sube la honestidad. Lo que no se pregunta se convierte en fantasia."
  },
  {
    userEnergy: "Estas lista para elegirte, incluso si todavia hay curiosidad por esa persona.",
    partnerEnergy: "La otra energia trae deseo, pero no siempre trae estructura.",
    sharedEnergy: "La conexion prende rapido, aunque necesita limites para no volverse desgaste.",
    advice: "No confundas intensidad con direccion. Mira si sus acciones sostienen lo que dice."
  }
] as const;

export const transitEvents: TransitEvent[] = [
  {
    id: "mercurio-revision",
    title: "Mercurio pide revisar antes de contestar",
    eventType: "mercurio",
    date: "2026-07-01",
    affectedSigns: ["geminis", "virgo", "sagitario", "piscis"],
    summary: "La energia mental esta mas rapida que clara. No todo mensaje necesita respuesta inmediata.",
    doThis: "Relee, guarda borradores y confirma datos antes de cerrar algo.",
    avoid: "Prometer desde la ansiedad o discutir por suposiciones.",
    intensity: 74
  },
  {
    id: "luna-llena-cuidado",
    title: "Luna llena: lo emocional sube a la superficie",
    eventType: "luna",
    date: "2026-07-02",
    affectedSigns: ["cancer", "capricornio", "aries", "libra"],
    summary: "Una emocion vieja puede pedir lugar, pero no necesariamente una decision urgente.",
    doThis: "Escribi lo que sentis antes de convertirlo en conversacion.",
    avoid: "Tomar distancia dramatica para probar si alguien te busca.",
    intensity: 86
  },
  {
    id: "venus-vinculo",
    title: "Venus mueve deseo, ternura y comparaciones",
    eventType: "venus",
    date: "2026-07-03",
    affectedSigns: ["tauro", "libra", "leo", "acuario"],
    summary: "El amor pide menos performance y mas reciprocidad visible.",
    doThis: "Mira donde hay calma, no solo donde hay chispa.",
    avoid: "Medirte con historias ajenas o romantizar migajas.",
    intensity: 68
  },
  {
    id: "temporada-cancer",
    title: "Temporada Cancer: casa, raiz y sensibilidad",
    eventType: "temporada",
    date: "2026-07-04",
    affectedSigns: ["cancer", "escorpio", "piscis", "capricornio"],
    summary: "La energia colectiva pide volver al cuerpo y cuidar los espacios donde descansas.",
    doThis: "Ordena una esquina de tu casa como si ordenaras una emocion.",
    avoid: "Confundir nostalgia con señal de volver.",
    intensity: 62
  }
];

export const weeklyReadingCopy = {
  energy: [
    "Esta semana no pide correr: pide elegir donde pones tu fuego.",
    "La energia se ordena cuando haces menos cosas, pero con mas intencion.",
    "Hay una puerta abierta, aunque no se abre desde el ruido.",
    "Tu intuicion esta fuerte; dale estructura para que no se vuelva ansiedad."
  ],
  love: [
    "En amor, una conversación simple puede mostrar más que una señal enorme.",
    "No confundas silencio con misterio. Mira presencia, cuidado y continuidad.",
    "La ternura vuelve cuando dejas de actuar desde la prueba.",
    "Si alguien te da calma, no lo descartes por no parecer intenso."
  ],
  workMoney: [
    "En trabajo y dinero, orden pequeno antes de expansion grande.",
    "Una tarea atrasada puede liberar energia mental si la cierras esta semana.",
    "Tu valor no necesita justificarse de mas, pero si necesita una accion clara.",
    "Revisa numeros sin castigarte: mirar tambien es recuperar poder."
  ],
  advice: [
    "Hace una cosa que tu yo de manana pueda agradecer.",
    "Elegir lento tambien es elegir.",
    "No abras una puerta solo porque alguien golpeo fuerte.",
    "Tu limite no arruina el vinculo correcto."
  ]
} as const;

export const rituals: Ritual[] = [
  {
    id: "ritual-agua",
    title: "Agua con intencion",
    minutes: 3,
    steps: [
      "Servi un vaso de agua.",
      "Pensa una palabra guia para tu dia.",
      "Tomalo despacio antes de mirar el celular."
    ]
  },
  {
    id: "ritual-vela",
    title: "Luz corta",
    minutes: 5,
    steps: [
      "Prende una vela o una luz pequena.",
      "Respira tres veces con la mano en el pecho.",
      "Anota una decision que no queres tomar desde el miedo."
    ]
  },
  {
    id: "ritual-puerta",
    title: "Puerta limpia",
    minutes: 4,
    steps: [
      "Antes de salir, quedate un momento en la puerta.",
      "Nombra lo que dejas afuera por hoy.",
      "Cruza con una accion concreta en mente."
    ]
  },
  {
    id: "ritual-luna",
    title: "Nota lunar",
    minutes: 6,
    steps: [
      "Escribi una pregunta simple.",
      "Responde sin editarte durante un minuto.",
      "Subraya la frase que te trajo mas paz."
    ]
  }
];

export const tarotCards: TarotCard[] = [
  {
    id: "la-estrella",
    name: "La Estrella",
    arcana: "mayor",
    keywords: ["calma", "guia", "renovacion"],
    meaning: "Hay una señal de alivio cuando dejás de forzar una respuesta. Mirá lo que vuelve a sentirse posible.",
    ritual: "Hace una lista de tres cosas que ya estan mejorando, aunque sean pequenas."
  },
  {
    id: "la-templanza",
    name: "La Templanza",
    arcana: "mayor",
    keywords: ["balance", "paciencia", "medida"],
    meaning: "El dia pide mezcla justa: menos impulso, mas escucha. Una conversacion puede ordenarse si bajas el volumen.",
    ritual: "Antes de responder algo importante, espera diez respiraciones."
  },
  {
    id: "el-mago",
    name: "El Mago",
    arcana: "mayor",
    keywords: ["accion", "recursos", "inicio"],
    meaning: "Tenes mas herramientas de las que estas usando. El primer paso no tiene que ser perfecto, solo real.",
    ritual: "Elegi una tarea de diez minutos y cerrala hoy."
  },
  {
    id: "la-luna",
    name: "La Luna",
    arcana: "mayor",
    keywords: ["intuicion", "sombra", "sueno"],
    meaning: "No todo esta listo para verse completo. Tu intuicion puede acompanar, pero no reemplaza la calma.",
    ritual: "Anota un sueno, una sensacion o una coincidencia sin sacar conclusiones todavia."
  },
  {
    id: "seis-de-oros",
    name: "Seis de Oros",
    arcana: "menor",
    keywords: ["intercambio", "ayuda", "merecimiento"],
    meaning: "Dar y recibir necesitan volver a equilibrarse. Observa donde estas entregando de mas.",
    ritual: "Pedi una ayuda concreta o pone un limite pequeno."
  }
];

const signVoice: Record<ZodiacSign, string> = {
  aries: "Tu fuego necesita una direccion amable: hoy no todo se gana empujando.",
  tauro: "Tu calma vuelve cuando ordenas lo simple y respetas tus tiempos.",
  geminis: "Tu mente trae respuestas, pero el cuerpo te marca cuales son sostenibles.",
  cancer: "Tu sensibilidad no es exceso: es brujula cuando la escuchas con limites.",
  leo: "Tu brillo se nota mas cuando no busca permiso.",
  virgo: "La claridad aparece cuando dejas de corregirte y empiezas a elegir.",
  libra: "Tu equilibrio no pide complacer a todos; pide escucharte primero.",
  escorpio: "Lo profundo puede moverse sin romperlo todo. Hoy alcanza con reconocerlo.",
  sagitario: "Tu expansion necesita una promesa concreta, no diez caminos abiertos.",
  capricornio: "Tu disciplina se vuelve mas poderosa cuando tambien te cuida.",
  acuario: "Tu diferencia puede ordenar el dia si no la escondes para encajar.",
  piscis: "Tu intuicion esta despierta; dale tierra con una accion pequena."
};

const topicCopy: Record<Topic, Omit<ContentTemplate, "id" | "kind" | "topic">> = {
  amor: {
    tone: "suave",
    title: "Amor con presencia",
    body: "No leas entre lineas si podes pedir una palabra clara. La ternura tambien necesita acuerdos.",
    action: "Manda un mensaje honesto y breve, sin buscar controlar la respuesta."
  },
  trabajo: {
    tone: "directo",
    title: "Trabajo con foco",
    body: "Una prioridad bien elegida vale mas que una lista perfecta. Hoy tu energia rinde mejor en una sola cosa.",
    action: "Marca la tarea que desbloquea el resto y empezala por veinte minutos."
  },
  dinero: {
    tone: "protector",
    title: "Dinero con orden",
    body: "La abundancia tambien se entrena mirando de frente. Un numero claro puede bajarte ansiedad.",
    action: "Revisa un gasto, una deuda o una meta sin juzgarte."
  },
  energia: {
    tone: "expansivo",
    title: "Energia disponible",
    body: "Tu cuerpo sabe antes que tu agenda. Si baja la fuerza, no significa fracaso: significa ajuste.",
    action: "Hace una pausa de tres minutos sin pantalla."
  },
  familia: {
    tone: "suave",
    title: "Familia y raiz",
    body: "Una dinamica vieja no necesita repetirse para pertenecer. Podes amar con un limite.",
    action: "Responde desde lo que hoy podes sostener, no desde la culpa."
  },
  vinculos: {
    tone: "suave",
    title: "Vinculos con claridad",
    body: "La conexion se ordena cuando bajas la expectativa a una frase simple. Menos interpretacion, mas presencia.",
    action: "Deci lo que necesitas en una linea, sin adornar ni exigir."
  },
  decisiones: {
    tone: "directo",
    title: "Decision limpia",
    body: "La señal no siempre llega como certeza absoluta. A veces llega como menos ruido interno.",
    action: "Escribi dos opciones y elegi la que te deja respirar mejor."
  },
  claridad: {
    tone: "protector",
    title: "Claridad sin apuro",
    body: "No fuerces una conclusion cuando todavia estas juntando piezas. La calma tambien informa.",
    action: "Anota que dato te falta antes de decidir."
  },
  proteccion: {
    tone: "protector",
    title: "Proteccion diaria",
    body: "Cuidarte no es cerrarte. Es elegir donde si y donde no poner tu energia.",
    action: "Cancela o pospone una cosa que hoy no te corresponde."
  },
  luna: {
    tone: "expansivo",
    title: "Pulso lunar",
    body: "Hay emociones que solo piden ser vistas. No las conviertas todas en tareas.",
    action: "Dale nombre a lo que sentis y dejalo escrito."
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
    action: "Elegi una accion pequena y cumplila antes del mediodia."
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
    body: "Si una conversacion se repite, cambia la pregunta. A veces la llave no es insistir, es precisar.",
    action: "Pregunta que necesitas saber, no lo que temes escuchar."
  },
  {
    id: "feed-proteccion",
    kind: "micro-feed",
    topic: "proteccion",
    tone: "protector",
    title: "Energia prestada",
    body: "No cargues emociones ajenas como si fueran prueba de amor. Acompanar no es absorber.",
    action: "Devuelve con carino una responsabilidad que no es tuya."
  },
  {
    id: "feed-luna",
    kind: "micro-feed",
    topic: "luna",
    tone: "expansivo",
    title: "La luna tambien baja",
    body: "No todos los dias piden manifestar. Algunos piden limpiar, descansar y escuchar.",
    action: "Cierra una pequena deuda emocional contigo."
  }
];
