import type { PersonalityReadingPayload } from "@/services/appRefs";

/**
 * Mock tipado del Horóscopo de personalidad (forma = charts.personalityReading).
 * Es la lectura larga por sectores — target de calidad editorial (extenso,
 * explicativo, que "lleva" al lector). Cuando Codex cablee el LLM natal, este
 * nivel de texto lo genera el motor desde la carta real, con estos guardrails.
 * Ejemplo armado sobre una carta de referencia (Sol Géminis, Luna Piscis, Asc Libra).
 */
export const personalityMock: PersonalityReadingPayload = {
  headline: "Tu carta, leída de principio a fin.",
  sections: [
    {
      key: "identidad",
      title: "Tu identidad",
      intro: "Quién sos cuando dejás de actuar para los demás.",
      placement: { label: "Sol en Géminis · Casa 9", planet: "Sol", sign: "Géminis", house: 9 },
      body:
        "El Sol es el corazón de tu carta: representa tu identidad central, eso que sos más allá de los roles, y lo que te da vitalidad cuando lo expresás. No es todo lo que sos, pero es el eje sobre el que gira el resto.\n\nEl tuyo está en Géminis, el signo de la curiosidad y la palabra. Eso te da una identidad ágil, mental y conversadora: te encendés cuando aprendés algo nuevo, cuando conectás ideas que parecían lejanas y cuando podés ponerlo en palabras. Necesitás variedad y estímulo; la rutina fija, sin nada nuevo que masticar, te apaga. No sos una sola cosa, y está bien: tu naturaleza es múltiple.\n\nEse Sol cae en tu casa 9, la casa del sentido, los viajes y las ideas grandes. Ahí tu curiosidad busca horizonte: no te alcanza con saber cómo funcionan las cosas, querés saber para qué. Te mueve entender el mapa completo, salir de lo conocido, encontrarle un significado a lo que vivís.\n\nCon el Ascendente en Libra, hacia afuera aparecés amable, diplomático y atento al otro — la primera impresión que das es de alguien que busca el equilibrio. Tu aprendizaje de vida es no perderte a vos mismo tratando de que todos estén cómodos: brillás más cuando decís lo que pensás sin pedir permiso.",
      questions: ["¿Qué idea te está pidiendo más espacio del que le das?", "¿Dónde estás cediendo para evitar la incomodidad?"]
    },
    {
      key: "emocional",
      title: "Tu mundo emocional",
      intro: "Cómo sentís cuando nadie mira.",
      placement: { label: "Luna en Piscis · Casa 6", planet: "Luna", sign: "Piscis", house: 6 },
      body:
        "Si el Sol es lo que mostrás, la Luna es lo que sentís: tu mundo interno, tus necesidades emocionales, aquello que te da seguridad y contención. Es la parte tuya que aparece en la intimidad, cuando bajás la guardia.\n\nTu Luna está en Piscis, el signo más sensible del zodíaco. Sos una esponja emocional: captás climas, estados de ánimo y cosas no dichas que la mayoría ni registra. Esa sensibilidad es un don —te vuelve empático, imaginativo, capaz de conmoverte y de acompañar— pero tiene su reverso: te cuesta distinguir lo que es tuyo de lo que absorbiste del ambiente. A veces cargás angustias que ni siquiera te pertenecen.\n\nEn casa 6, la de la rutina y el cuerpo, todo eso se cuela en lo cotidiano: en cómo dormís, en tu energía del día, en cuánto te afecta el desorden o el ruido. Tu estado emocional y tu estado físico están más conectados de lo que parece.\n\nLo que más te ordena es tener rituales simples que te aterricen —algo del cuerpo, algo repetido, algo tuyo—. Y aprender a nombrar lo que sentís, aunque sea en una nota para vos: cuando lo ponés en palabras, dejás de estar a merced de la marea. Cuando te sobrecargás, no es que estés fallando; es que sentiste de más, y necesitás vaciar.",
      questions: ["¿Qué emoción venís cargando que quizá ni siquiera es tuya?", "¿Qué ritual simple te devuelve el eje cuando te sobrecargás?"]
    },
    {
      key: "mente",
      title: "Cómo pensás y comunicás",
      intro: "La forma en que tu mente ordena el mundo.",
      placement: { label: "Mercurio en Géminis · Casa 8", planet: "Mercurio", sign: "Géminis", house: 8 },
      body:
        "Mercurio es cómo pensás, aprendés y te comunicás: la manera en que tu mente procesa la información y la devuelve al mundo. Marca tu estilo mental y tu forma de hablar.\n\nEl tuyo está en Géminis, su signo por excelencia — así que juega de local. Tenés una mente rápida, flexible y con hambre de datos: aprendés jugando, saltando de un tema a otro, conectando puntos que a otros les parecen inconexos. Podés sostener varias ideas a la vez y cambiar de opinión sin drama cuando aparece información nueva. Tu riesgo es la dispersión: mil pestañas abiertas y ninguna cerrada.\n\nEse Mercurio cae en tu casa 8, la de lo profundo, lo íntimo y lo que se transforma. Por eso tu curiosidad no se queda en la superficie: querés entender lo que está debajo —lo que la gente calla, los motivos ocultos, lo que se juega en serio—. Sos buen observador de lo no dicho, y te atraen las conversaciones que otros evitan.\n\nEl desafío es no quedarte solo en la idea brillante que se te dispersa: tu mente rinde el doble cuando bajás lo que pensás a una frase concreta, o cuando lo escribís antes de que se te escape. Pensar es tu superpoder; terminar la idea es tu tarea.",
      questions: ["¿Qué idea das vueltas hace días sin bajarla a una frase concreta?", "¿Qué conversación honesta estás postergando?"]
    },
    {
      key: "amor",
      title: "Amor y vínculos",
      intro: "Qué buscás y cómo te acercás.",
      placement: { label: "Venus en Tauro · Casa 7", planet: "Venus", sign: "Tauro", house: 7 },
      body:
        "Venus habla de cómo amás, qué te atrae y qué te da placer: tu manera de vincularte, de disfrutar y de valorar. No es solo el amor romántico, es tu forma de decir \"esto me importa, esto quiero cerca\".\n\nTu Venus está en Tauro, y eso le da los pies en la tierra. Amás con constancia y presencia: buscás estabilidad, gestos concretos más que promesas lindas, y disfrutás de lo simple y sensorial —la comida rica, la piel, el tiempo compartido sin apuro—. Valorás la lealtad y te cuesta lo que es volátil o inseguro. Cuando querés, querés en serio y para quedarte.\n\nEn casa 7, la casa de los vínculos uno-a-uno, el otro ocupa un lugar central en tu vida: aprendés muchísimo de vos a través de tus relaciones, casi como si el espejo del otro te revelara partes propias. Los vínculos no son un accesorio para vos, son un lugar de crecimiento.\n\nHay un matiz interesante: con Marte en Aries de fondo, tu deseo aparece directo, impaciente, con ganas de iniciar ya. Ahí vive tu tensión más rica —entre el impulso (querer ahora) y tu Venus (querer que dure)—. Tu mejor puente es nombrar lo que querés: sin rodeos, pero sin apuro. Esto describe tendencias tuyas, no garantiza nada sobre ninguna relación puntual.",
      questions: ["¿Qué necesitás pedir en claro que hoy estás esperando que adivinen?", "¿Dónde confundís intensidad con compatibilidad?"]
    },
    {
      key: "impulso",
      title: "Tu impulso",
      intro: "Cómo actuás y dónde ponés la energía.",
      placement: { label: "Marte en Aries · Casa 6", planet: "Marte", sign: "Aries", house: 6 },
      body:
        "Marte es tu motor: cómo actuás, cómo peleás por lo que querés y dónde ponés la energía cuando decidís avanzar. Es el impulso que te saca de la duda y te mete en la acción.\n\nEl tuyo está en Aries, su signo natural, así que es fuego puro y directo: arrancás rápido, sin dar tantas vueltas, y tenés coraje para empezar lo que otros posponen. No necesitás que todo esté perfecto para largarte; de hecho, esperar demasiado te frustra. Sos de los que prenden la mecha.\n\nEse Marte cae en tu casa 6, la del trabajo y lo cotidiano, así que tu energía rinde de verdad cuando la aplicás a algo concreto: una tarea entre manos, un problema para resolver, un cuerpo en movimiento. Sos productivo cuando tenés dónde canalizar el fuego.\n\nEl riesgo es la impaciencia: querer todo ya, encender diez frentes a la vez y quedarte sin nafta antes de terminar ninguno. Tu fuerza se multiplica cuando elegís una cosa a la vez y la sostenés hasta el final. No te falta arranque; te sirve elegir mejor dónde lo gastás.",
      questions: ["¿En qué estás gastando energía que te convendría concentrar en una sola cosa?", "¿Qué querés empezar que venís frenando por impaciencia?"]
    },
    {
      key: "expansion",
      title: "Dónde te expandís",
      intro: "Las áreas donde crecés y te sentís más vos.",
      placement: { label: "Júpiter en Cáncer · Casa 9", planet: "Júpiter", sign: "Cáncer", house: 9 },
      body:
        "Júpiter señala dónde te expandís, dónde te sentís generoso y en confianza, y qué tipo de experiencias te hacen crecer. Es la parte de tu carta que se abre y da lugar cuando la habitás.\n\nEl tuyo está en Cáncer, el signo del cuidado y la pertenencia. Crecés a través del vínculo emocional: te expandís cuando te sentís parte de algo, cuando podés cuidar y dejarte cuidar, cuando hay un \"nosotros\" que te sostiene. La calidez no es un lujo para vos, es el suelo desde el que te animás a más.\n\nEse Júpiter cae en tu casa 9, la del horizonte y el sentido, así que tu crecimiento pasa por ampliar el mapa: aprender, viajar, conocer mundos distintos al tuyo, buscarle un para qué a lo que vivís. Te hace bien salir de lo conocido sin perder la raíz que te da seguridad —esa mezcla de aventura y hogar es muy tuya—.\n\nUna aclaración importante, porque acá muchos horóscopos mienten: esto no habla de suerte garantizada ni de que \"todo te va a salir bien\". Habla de dónde tu naturaleza tiende a florecer cuando le das lugar y trabajo. La expansión no cae del cielo; se cultiva en las áreas donde ya tenés facilidad.",
      questions: ["¿Qué experiencia nueva te está llamando y venís posponiendo?", "¿Dónde te cuesta salir de lo conocido, aun sabiendo que te haría crecer?"]
    },
    {
      key: "estructura",
      title: "Estructura y madurez",
      intro: "Dónde construís de a poco y en serio.",
      placement: { label: "Saturno en Capricornio · Casa 4", planet: "Saturno", sign: "Capricornio", house: 4 },
      body:
        "Si Júpiter expande, Saturno estructura: marca dónde construís de a poco, ponés límites y madurás. No es la parte divertida de la carta, pero suele ser la más sólida: lo que Saturno toca, si le ponés trabajo, se vuelve tu mayor fortaleza.\n\nTu Saturno está en Capricornio, su propio signo, y eso te da una capacidad real de sostener en el tiempo. Podés hacer las cosas bien aunque cuesten, aguantar procesos largos, poner el límite que hay que poner. Tenés una madurez de fondo, a veces más de la que sentís — como si por dentro fueras más grande que tu edad.\n\nEse Saturno cae en tu casa 4, la de la familia, el hogar y tu sensación de base. Es probable que hayas sentido temprano una responsabilidad grande en lo doméstico, o que el terreno familiar haya sido más exigente que liviano. No es un castigo: es el área donde vas a construir algo firme, a tu manera.\n\nTu tarea de madurez es esa: armar tu propia base —la que elegís vos— sin repetir en automático lo que heredaste. Lleva tiempo y no da resultados de un día para el otro, pero lo que construís despacio, con Saturno, se queda. Es tu cimiento, no tu techo.",
      questions: ["¿Qué base tuya querés construir este año, distinta a la que heredaste?"]
    }
  ],
  disclaimer:
    "Esta lectura describe tendencias de tu carta natal, en clave de autoconocimiento y entretenimiento. No es una predicción ni un diagnóstico, y no reemplaza consejo profesional de ningún tipo. Sos vos quien las habita, las trabaja y las cambia."
};
