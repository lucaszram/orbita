/**
 * Carta V4.9.2: rutas por plataforma, procedencia de datos y lenguaje visible.
 *
 * Estas pruebas miran el mismo grafo que Metro. No alcanza con que exista una
 * pantalla nueva: la ruta nativa tiene que llegar a ella, la variante web debe
 * seguir redirigiendo a `/carta` y ningún mock puede quedar alcanzable por un
 * import indirecto.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

import { resolveBirthInfo } from "../src/domain/birthInfo";
import { readingBlockPhase } from "../src/domain/cartaNatalCarga";
import { natalChapters } from "../src/domain/lecturaNatal";
import {
  elementWithArticle,
  leastElementCount,
  leastElementTag,
  LUNAR_CYCLE
} from "../src/domain/layers";
import {
  ASCENDENTE_INICIO_CASA,
  ASCENDENTE_INICIO_CASA_VOZ,
  CALCULANDO_EJE,
  NECESITA_HORA,
  angleRowView,
  positionView
} from "../src/domain/natalChartBase";
import {
  natalAspectsAccess,
  natalChartState,
  natalHousesAccess
} from "../src/domain/natalChartState";
import type { NatalChartBase, NatalPosition } from "../src/services/layersApi";
import {
  ROOT,
  pathTo,
  reachableFrom,
  resolveEntryForPlatform
} from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const relativo = (absolute: string) => relative(ROOT, absolute);

const CARTA_ROUTES = [
  {
    // Desde 2026-08-19 el hub ES la raíz de la pestaña (decisión de producto:
    // la carta dejó de estar a dos taps). En web, /perfil sigue siendo el
    // Perfil administrativo — por eso su webImpl no redirige a /carta y se
    // excluye del assert de redirect del loop.
    entry: "app/(tabs)/perfil/index.tsx",
    nativeImpl: "src/routes/v492/perfil-index.tsx",
    webImpl: "src/routes/v492/perfil-index.web.tsx",
    screen: "src/screens/v492/CartaHubScreen.tsx",
    webRedirectsToCarta: false
  },
  {
    entry: "app/(tabs)/perfil/carta/tipo-lunar.tsx",
    nativeImpl: "src/routes/v492/perfil-carta-tipo-lunar.tsx",
    webImpl: "src/routes/v492/perfil-carta-tipo-lunar.web.tsx",
    screen: "src/screens/v492/TipoLunarDetailScreen.tsx"
  },
  {
    entry: "app/(tabs)/perfil/carta/mapa-elemental.tsx",
    nativeImpl: "src/routes/v492/perfil-carta-mapa-elemental.tsx",
    webImpl: "src/routes/v492/perfil-carta-mapa-elemental.web.tsx",
    screen: "src/screens/v492/MapaElementalDetailScreen.tsx"
  },
  {
    entry: "app/(tabs)/perfil/carta/completa.tsx",
    nativeImpl: "src/routes/v492/perfil-carta-completa.tsx",
    webImpl: "src/routes/v492/perfil-carta-completa.web.tsx",
    screen: "src/screens/v492/CartaCompletaV492Screen.tsx"
  }
] as const;

test("las rutas de Carta resuelven a pantallas V4.9.2 en nativo y a /carta en web", () => {
  for (const route of CARTA_ROUTES) {
    assert.equal(relativo(resolveEntryForPlatform(route.entry, "native")), route.nativeImpl, route.entry);
    assert.equal(relativo(resolveEntryForPlatform(route.entry, "web")), route.webImpl, route.entry);

    const nativeGraph = reachableFrom([route.entry], "native");
    const webGraph = reachableFrom([route.entry], "web");
    assert.ok(nativeGraph.has(route.screen), `${route.entry} no llega a ${route.screen} en nativo`);
    assert.ok(!webGraph.has(route.screen), `${route.entry} arrastra ${route.screen} al paquete web`);
    assert.ok(
      !webGraph.has("src/services/layersApi.ts"),
      `${route.entry} arrastra el cliente nativo de capas al paquete web`
    );
    if (("webRedirectsToCarta" in route ? route.webRedirectsToCarta : true)) {
      assert.match(sinComentarios(leer(route.webImpl)), /<Redirect\s+href="\/carta"\s*\/>/);
    } else {
      // La raíz web conserva el Perfil administrativo canónico, sin redirect.
      const webGraphPerfil = reachableFrom([route.webImpl], "web");
      assert.ok(
        webGraphPerfil.has("src/screens/PerfilScreen.tsx"),
        `${route.webImpl} tiene que seguir montando el Perfil web`
      );
    }
  }
});

test("ninguna entrada nativa de Carta alcanza datos de maqueta", () => {
  for (const route of CARTA_ROUTES) {
    const camino = pathTo(
      route.entry,
      (rel) => /(?:^|\/)(?:content|domain)\/[^/]*(?:mock|fixture|sample|demo)/i.test(rel),
      "native"
    );
    assert.equal(camino, null, camino ? `${route.entry}: ${camino.join(" -> ")}` : route.entry);
  }
});

test("el hub y la carta completa consumen el read-model canónico mediante el cliente generado", () => {
  const hub = sinComentarios(leer("src/screens/v492/CartaHubScreen.tsx"));
  const completa = sinComentarios(leer("src/screens/v492/CartaCompletaV492Screen.tsx"));
  const services = sinComentarios(leer("src/services/layersApi.ts"));

  assert.match(
    services,
    /getNatalChartBase:\s*api\.layers\.getNatalChartBase/,
    "el cliente de Carta tiene que enlazar el binding generado"
  );
  assert.match(
    services,
    /FunctionReturnType<typeof api\.layers\.getNatalChartBase>/,
    "la forma pública de Carta se deriva del contrato generado"
  );
  assert.doesNotMatch(services, /\banyApi\b|\bas unknown as\b/, "el cliente no puede borrar los tipos del contrato");

  for (const [nombre, screen] of [["hub", hub], ["completa", completa]] as const) {
    assert.match(
      screen,
      /useQuery\(layersApi\.getNatalChartBase,\s*\{\}\)/,
      `${nombre}: posiciones, grados y acceso salen de layers.getNatalChartBase`
    );
  }
  assert.match(hub, /const natal = bundle\?\.natal/, "tipo lunar y mapa elemental salen del sobre real");
  assert.match(services, /api\.layers\.getNatalBase/);
  assert.match(services, /api\.layers\.getForDate/);
  assert.doesNotMatch(`${hub}\n${completa}\n${services}`, /chartMock|natalMock|payloadMock|createFallbackProfile/);
});

test("Carta no vuelve a usar charts.current ni el mapper del payload legacy para posiciones o grados", () => {
  const files = [
    "src/screens/v492/CartaHubScreen.tsx",
    "src/screens/v492/CartaCompletaV492Screen.tsx"
  ] as const;

  for (const rel of files) {
    const source = sinComentarios(leer(rel));
    assert.doesNotMatch(source, /appApi\.charts\.current/, `${rel}: no debe consultar la carta legacy`);
    // `birthData.getCurrent` se permite SÓLO en la carta completa y SÓLO para
    // la fila DATOS: mostrar textual lo que la persona guardó (fecha · hora ·
    // lugar), que el read-model no trae. La PRECISIÓN sigue saliendo del
    // read-model (`birthTimePrecisionLabel(chart)`) y las posiciones también:
    // eso es lo que este gate protege de verdad. (2026-08-19: tras editar con
    // un error en el medio no había forma de verificar qué datos usó la carta.)
    if (rel !== "src/screens/v492/CartaCompletaV492Screen.tsx") {
      assert.doesNotMatch(source, /appApi\.birthData\.getCurrent/, `${rel}: la precisión ya viene en el read-model`);
    }
    assert.doesNotMatch(source, /\bmapNatalChart\s*\(/, `${rel}: no debe mapear el payload legacy`);
    assert.doesNotMatch(source, /\bpersonalChartGate\s*\(/, `${rel}: no debe gatear el documento legacy`);
    assert.doesNotMatch(
      source,
      /\b(?:NatalChartPayload|NatalChartDocument)\b/,
      `${rel}: no debe tipar el contenido con el contrato legacy`
    );
  }
});

test("hora aproximada o desconocida nunca habilita Ascendente ni casas", () => {
  const base = {
    birthDate: "1994-05-04",
    birthTime: "08:37",
    birthPlaceLabel: "Buenos Aires",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires"
  };

  const exactBirth = { ...base, birthTimePrecision: "known" as const };
  const exacta = resolveBirthInfo({ doc: exactBirth, resolved: true });
  assert.equal(exacta.status, "complete");
  if (exacta.status === "complete") assert.equal(exacta.hasTime, true);

  for (const birthTimePrecision of ["approximate", "unknown"] as const) {
    const impreciseBirth = { ...base, birthTimePrecision };
    const info = resolveBirthInfo({
      // Una fila histórica puede conservar un texto de hora. La precisión, no
      // la mera presencia de ese texto, decide si existen ángulos y casas.
      doc: impreciseBirth,
      resolved: true
    });
    assert.equal(info.status, "complete", birthTimePrecision);
    if (info.status === "complete") {
      assert.equal(info.hasTime, false, `${birthTimePrecision}: no habilita geometría sensible a la hora`);
    }
  }
});

test("el hub cuenta sólo los diez planetas canónicos y no suma Ascendente ni puntos legacy", () => {
  const hub = sinComentarios(leer("src/screens/v492/CartaHubScreen.tsx"));
  const completa = sinComentarios(leer("src/screens/v492/CartaCompletaV492Screen.tsx"));
  const source = `${hub}\n${completa}`;

  assert.match(hub, /\.positions\.length\b/, "el recuento visible sale de las posiciones canónicas Sol–Plutón");
  assert.doesNotMatch(hub, /\.placements\.length\b/, "no debe contar la lista legacy que incluía otros puntos");
  assert.doesNotMatch(source, /\bmainAspects\b/, "no debe contar el recorte legacy de aspectos principales");
  assert.doesNotMatch(
    source,
    /positions\s*=\s*\[[\s\S]{0,600}\b(?:ascendant|midheaven|mc)\b/i,
    "Ascendente y Medio Cielo son ángulos, no planetas"
  );
});

/**
 * La carta base del contrato, con todo en su mejor caso. Cada prueba cambia
 * SÓLO el campo que está probando, así que un fallo señala ese campo y no una
 * combinación armada a mano.
 */
function cartaBase(patch: Partial<NatalChartBase> = {}): NatalChartBase {
  return {
    methodVersion: "orbita-natal-1",
    providerVersion: "prov-1",
    inputHash: "hash",
    status: "ready",
    observedAt: 1_700_000_000_000,
    birthTimePrecision: "known",
    calculationTimeSource: "exact_birth_time",
    access: { isPro: true, positions: true, angles: true, houses: true, aspects: true },
    positions: [],
    angles: [],
    houses: [],
    aspects: [],
    missingInputs: [],
    limitations: [],
    ...patch
  } as NatalChartBase;
}

test("`access.positions` es el snapshot canónico, NO un entitlement", () => {
  // El defecto que cierra esta prueba: las dos pantallas leían
  // `access.positions` como si fuera acceso. En `convex/layers.ts` ese campo
  // vale `snapshot !== null` —dice si existe el cálculo canónico— y el
  // entitlement es `access.isPro`. Una cuenta pagando podía ver un muro de pago
  // por un cálculo que todavía no había terminado.
  const sinSnapshot = cartaBase({
    status: "unavailable",
    access: { isPro: true, positions: false, angles: false, houses: false, aspects: false },
    missingInputs: ["canonical_natal_ephemeris"],
    limitations: ["Todavía no hay posiciones canónicas calculadas para estos datos."]
  });

  // Con una corrida activa: se está calculando, y no se ofrece relanzar nada.
  const calculando = natalChartState({ chart: sinSnapshot, refreshing: true });
  assert.equal(calculando.phase, "calculando");
  assert.equal(calculando.canRetry, false);

  // Sin corrida activa: NO se puede seguir diciendo que se está calculando.
  const detenido = natalChartState({ chart: sinSnapshot, refreshing: false });
  assert.equal(detenido.phase, "sin-calculo");
  assert.equal(detenido.canRetry, true, "el estado recuperable ofrece comprobar de nuevo");
  assert.match(detenido.reason ?? "", /posiciones canónicas/);

  // Y en ninguno de los dos el estado depende del plan: con Plus y sin Plus, un
  // snapshot ausente da exactamente lo mismo.
  const sinPlus = { ...sinSnapshot, access: { ...sinSnapshot.access, isPro: false } };
  assert.deepEqual(natalChartState({ chart: sinPlus, refreshing: false }), detenido);
});

test("los siete estados de la Carta se resuelven por el hecho que los produce", () => {
  // 1 · la query todavía viaja
  assert.equal(natalChartState({ chart: undefined, refreshing: false }).phase, "cargando");
  assert.equal(natalChartState({ chart: undefined, refreshing: true }).phase, "cargando");

  // 2 · faltan los datos natales: no hay nada que calcular ni que reintentar
  const sinDatos = natalChartState({
    chart: cartaBase({
      status: "unavailable",
      access: { isPro: false, positions: false, angles: false, houses: false, aspects: false },
      missingInputs: ["birth_data"],
      limitations: ["Cargá tus datos de nacimiento para calcular la carta."]
    }),
    refreshing: false
  });
  assert.equal(sinDatos.phase, "sin-datos");
  assert.equal(sinDatos.canRetry, false);
  // Aunque haya una corrida en vuelo: sin datos no se está calculando ninguna carta.
  assert.equal(
    natalChartState({
      chart: cartaBase({
        access: { isPro: false, positions: false, angles: false, houses: false, aspects: false },
        missingInputs: ["birth_data"]
      }),
      refreshing: true
    }).phase,
    "sin-datos"
  );

  // 3 y 4 · sin read-model publicado, con y sin corrida
  assert.equal(natalChartState({ chart: null, refreshing: true }).phase, "calculando");
  const nuloDetenido = natalChartState({ chart: null, refreshing: false, refreshFailed: true });
  assert.equal(nuloDetenido.phase, "sin-calculo");
  assert.match(nuloDetenido.reason ?? "", /no llegó a completarse/i);

  // 5 · parcial: hay carta, y lo que falta se nombra
  const parcial = natalChartState({
    chart: cartaBase({
      status: "partial",
      access: { isPro: true, positions: true, angles: false, houses: false, aspects: true },
      missingInputs: ["verified_ascendant_mc_geometry"],
      limitations: [
        "Las posiciones planetarias son canónicas, pero la carta vigente no trae Ascendente y Medio Cielo verificables."
      ]
    }),
    refreshing: false
  });
  assert.equal(parcial.phase, "parcial");
  assert.match(parcial.reason ?? "", /Ascendente y Medio Cielo verificables/);

  // Sin hora exacta el cálculo está COMPLETO para los datos que hay: el sobre
  // llega `partial`, pero eso no es algo que se pueda reintentar, y el estado no
  // inventa un motivo pendiente.
  const sinHora = natalChartState({
    chart: cartaBase({
      status: "partial",
      birthTimePrecision: "unknown",
      calculationTimeSource: "full_civil_day",
      access: { isPro: false, positions: true, angles: false, houses: false, aspects: false },
      missingInputs: ["exact_birth_time"],
      limitations: ["Sin hora exacta, cada posición se comprueba sobre todo el día civil."]
    }),
    refreshing: false
  });
  assert.equal(sinHora.phase, "parcial");
  assert.equal(sinHora.reason, null, "la hora no es un cálculo pendiente");

  // 6 · listo
  assert.equal(natalChartState({ chart: cartaBase(), refreshing: false }).phase, "listo");
});

test("el límite de Plus es por superficie y sólo cuando `isPro` es falso", () => {
  // Cuenta con Plus y todo publicado.
  const conPlus = cartaBase();
  assert.equal(natalHousesAccess(conPlus), "disponible");
  assert.equal(natalAspectsAccess(conPlus), "disponible");

  // Cuenta SIN Plus: casas y aspectos se cierran por plan, y sólo ellos.
  const sinPlus = cartaBase({
    access: { isPro: false, positions: true, angles: true, houses: false, aspects: false }
  });
  assert.equal(natalHousesAccess(sinPlus), "plus");
  assert.equal(natalAspectsAccess(sinPlus), "plus");

  // Sin hora exacta las casas no existen para NADIE: el motivo es la hora, no el
  // plan. Decir "Plus" acá vendería algo que el plan tampoco puede dar.
  const sinHora = cartaBase({
    birthTimePrecision: "unknown",
    calculationTimeSource: "full_civil_day",
    access: { isPro: false, positions: true, angles: false, houses: false, aspects: false }
  });
  assert.equal(natalHousesAccess(sinHora), "sin-hora");

  // Con Plus y sin casas publicadas todavía: es un cálculo pendiente, no un
  // límite de plan. Cobrarle a quien ya pagó era el otro lado del mismo defecto.
  const pendiente = cartaBase({
    status: "partial",
    access: { isPro: true, positions: true, angles: true, houses: false, aspects: true },
    missingInputs: ["verified_twelve_house_geometry"]
  });
  assert.equal(natalHousesAccess(pendiente), "pendiente");
});

/**
 * La superficie de la lectura larga dentro de la Carta completa.
 *
 * Es UNA de las tres superficies que el plan cierra —capítulos, contactos y
 * casas—, y la única cuyo CTA nombra lo que la compra abre entero. El corte se
 * mide por su función: lo de adentro ofrece la compra con su rótulo propio.
 */
function bloqueDeLectura(completa: string): { lectura: string; resto: string } {
  const inicio = completa.indexOf("function LecturaNatal");
  assert.ok(inicio >= 0, "la carta completa tiene que montar el bloque de lectura");
  const fin = completa.indexOf("\nfunction ", inicio + 1);
  assert.ok(fin > inicio, "el bloque de lectura tiene que estar acotado a su función");
  return {
    lectura: completa.slice(inicio, fin),
    resto: completa.slice(0, inicio) + completa.slice(fin)
  };
}

/** Un módulo de la carta completa, acotado entre dos encabezados. */
function modulo(completa: string, desde: string, hasta: string): string {
  const inicio = completa.indexOf(`module="${desde}"`);
  const fin = completa.indexOf(`module="${hasta}"`);
  assert.ok(inicio >= 0, `no encontré el módulo «${desde}»`);
  assert.ok(fin > inicio, `el módulo «${desde}» tiene que cerrar antes de «${hasta}»`);
  return completa.slice(inicio, fin);
}

/**
 * Parte un módulo en su rama cerrada por PLAN y todo lo demás.
 *
 * El resto son los estados técnicos del mismo módulo —pendiente, sin hora, el
 * cálculo que no publicó—: ninguno de ellos puede ofrecer la compra, porque
 * ninguno se destraba pagando.
 */
function ramaDePlan(seccion: string, apertura: string, cierre: string): { plan: string; resto: string } {
  const inicio = seccion.indexOf(apertura);
  assert.ok(inicio >= 0, `no encontré la rama de plan «${apertura}»`);
  const fin = seccion.indexOf(cierre, inicio + apertura.length);
  assert.ok(fin > inicio, `la rama de plan tiene que cerrar en «${cierre}»`);
  return { plan: seccion.slice(inicio, fin), resto: seccion.slice(0, inicio) + seccion.slice(fin) };
}

/** El cuerpo de una función suelta del archivo, hasta la siguiente. */
function funcion(completa: string, nombre: string): string {
  const inicio = completa.indexOf(`function ${nombre}(`);
  assert.ok(inicio >= 0, `no encontré \`${nombre}\``);
  const fin = completa.indexOf("\nfunction ", inicio + 1);
  assert.ok(fin > inicio, `\`${nombre}\` tiene que estar acotada`);
  return completa.slice(inicio, fin);
}

test("Carta: cada superficie cerrada por plan ofrece su salida; ningún estado técnico la ofrece", () => {
  const hub = sinComentarios(leer("src/screens/v492/CartaHubScreen.tsx"));
  const completa = sinComentarios(leer("src/screens/v492/CartaCompletaV492Screen.tsx"));
  const source = `${hub}\n${completa}`;

  // Las dos pantallas resuelven su estado con el MISMO resolvedor: mientras cada
  // una interpretaba el contrato por su cuenta, contaban cosas distintas.
  for (const [nombre, pantalla] of [
    ["hub", hub],
    ["carta completa", completa]
  ] as const) {
    assert.match(pantalla, /natalChartState\(/, `${nombre} tiene que usar el resolvedor compartido`);
    assert.doesNotMatch(
      pantalla,
      /access\.positions/,
      `${nombre} no puede volver a interpretar access.positions por su cuenta`
    );
  }

  // El acceso se pregunta por superficie, y esas funciones son las únicas que
  // miran `isPro`.
  assert.match(source, /natalHousesAccess\(/);
  assert.match(source, /natalAspectsAccess\(/);

  const PAYWALL = /(?:router\.(?:push|navigate)\(\s*["']\/paywall["']\s*\)|href=["']\/paywall["'])/;
  const cuenta = (texto: string, re: RegExp) => (texto.match(new RegExp(re.source, "g")) ?? []).length;

  // El hub sigue sin muro de pago: dice en una línea del resumen lo que la
  // cuenta no puede ver hoy, y de ahí se pasa a la carta completa.
  assert.doesNotMatch(hub, PAYWALL, "el hub de la carta no abre el paywall");

  // La carta completa tiene EXACTAMENTE tres salidas, una por superficie que el
  // plan cierra (decisión de Lucas, 2026-08-20): capítulos, contactos y casas.
  // Ni una menos —un bloque cerrado sin acción no dice qué hacer con él— ni una
  // más, que convertiría la pantalla en un muro de venta.
  assert.equal(cuenta(completa, PAYWALL), 3, "tres salidas al paywall: capítulos, contactos y casas");
  assert.equal(cuenta(completa, /<PlusBlock/), 3, "y exactamente tres bloques de Plus");
  assert.equal(
    cuenta(completa, /DESBLOQUEAR MI CARTA NATAL/),
    1,
    "el rótulo que nombra la carta entera es sólo el de los capítulos"
  );
  assert.equal(cuenta(completa, /VER ÓRBITA PLUS/), 2, "contactos y casas ofrecen la etiqueta corta");

  // 1 · los siete capítulos, con su rótulo propio.
  const { lectura } = bloqueDeLectura(completa);
  assert.match(lectura, PAYWALL, "el bloqueo de los capítulos ofrece la salida");
  assert.match(lectura, /DESBLOQUEAR MI CARTA NATAL/);

  // 2 · los contactos: la salida vive DENTRO de la rama de plan, y el resto del
  // módulo —el cálculo pendiente, la lista publicada— no la ofrece.
  const contactos = modulo(completa, "Los contactos entre tus puntos", "Tus doce casas");
  const aspectos = ramaDePlan(
    contactos,
    'natalAspectsAccess(chart) === "plus" ? (',
    'natalAspectsAccess(chart) === "pendiente" ?'
  );
  assert.match(aspectos.plan, /<PlusBlock/);
  assert.match(aspectos.plan, PAYWALL, "los contactos cerrados por plan ofrecen su salida");
  assert.match(aspectos.plan, /VER ÓRBITA PLUS/);
  assert.doesNotMatch(aspectos.resto, PAYWALL, "un cálculo pendiente de contactos no manda a pagar");
  assert.doesNotMatch(aspectos.resto, /<PlusBlock/);

  // 3 · las casas: igual, y el estado sin hora sigue sin salida a la compra
  // porque la hora no se compra.
  const casas = modulo(completa, "Tus doce casas", "Cómo se calculó");
  const doce = ramaDePlan(casas, 'natalHousesAccess(chart) === "plus" ? (', ") : (");
  assert.match(doce.plan, /<PlusBlock/);
  assert.match(doce.plan, PAYWALL, "las casas cerradas por plan ofrecen su salida");
  assert.match(doce.plan, /VER ÓRBITA PLUS/);
  assert.doesNotMatch(doce.resto, PAYWALL, "sin hora, o sin las doce verificadas, no se manda a pagar");
  assert.doesNotMatch(doce.resto, /<PlusBlock/);
  assert.match(casas, /natalHousesAccess\(chart\) === "sin-hora"/, "el estado sin hora sigue siendo suyo");

  // Y ningún estado técnico —cálculo en curso, cálculo que no publicó, parte
  // que falta— ofrece la compra: no se destraban pagando.
  for (const nombre of ["Calculando", "SinCalculo", "FaltaCalculo"]) {
    const cuerpo = funcion(completa, nombre);
    assert.doesNotMatch(cuerpo, PAYWALL, `${nombre} no es un límite de plan`);
    assert.doesNotMatch(cuerpo, /<PlusBlock|ÓRBITA PLUS/, `${nombre} no puede vestirse de bloqueo de plan`);
  }

  // El bloque de Plus se usa SÓLO donde el límite es de plan, y siempre con
  // acción: el CTA es obligatorio en su API, no un opcional que alguien olvide.
  assert.match(completa, /DISPONIBLE CON ÓRBITA PLUS/);
  const plusBlock = funcion(completa, "PlusBlock");
  assert.match(
    plusBlock,
    /cta: \{ label: string; voz: string; onPress: \(\) => void \};/,
    "el CTA del bloque de Plus es obligatorio"
  );
  assert.doesNotMatch(plusBlock, /cta \?/, "y por eso no queda una rama sin botón");

  // …y el estado recuperable dice que se puede comprobar de nuevo sin afirmar
  // que algo se rompió para siempre.
  assert.match(source, /COMPROBAR DE NUEVO/);

  for (const frase of [
    /Este cálculo no publicó las doce casas completas/i,
    /Esta carta no trae contactos calculados/i,
    /No hay nada que completar de nuestro lado/i
  ]) {
    assert.doesNotMatch(
      source,
      frase,
      "una sección cerrada por acceso no puede leerse como un cálculo roto"
    );
  }
});

// ---------------------------------------------------------------------------
// "Tu carta, explicada" dentro de la Carta completa V4.9.2
//
// La pantalla nativa mostraba la carta entera como datos y dejaba afuera la
// única parte ESCRITA que el backend ya genera: los siete capítulos. Se
// recupera ahí, con el mismo dato y el mismo cableado que la carta legada
// (`@/hooks/useNatalReading`), sin tocar contrato ni backend.
// ---------------------------------------------------------------------------

const COMPLETA_SRC = sinComentarios(leer("src/screens/v492/CartaCompletaV492Screen.tsx"));

/** Los siete capítulos tal como los publica el backend. */
const LECTURA_7 = {
  headline: "h",
  disclaimer: "Órbita es entretenimiento y autoconocimiento.",
  sections: Array.from({ length: 7 }, (_, i) => ({
    key: `s${i}`,
    title: `Capítulo ${i + 1}`,
    intro: "i",
    body: `Primer párrafo del ${i + 1}.\n\nSegundo párrafo del ${i + 1}.`,
    placement: { label: "Sol", planet: "Sol", sign: "Cáncer", house: 4 },
    questions: ["¿Qué te empuja?"]
  }))
};

test("el bloque de capítulos va inmediatamente después de «Tus diez posiciones»", () => {
  const modulos = [...COMPLETA_SRC.matchAll(/module="([^"]+)"/g)].map((m) => m[1]);
  const desde = modulos.indexOf("Tus diez posiciones");
  assert.ok(desde >= 0, "la carta completa tiene que seguir listando las diez posiciones");
  assert.deepEqual(
    modulos.slice(desde, desde + 3),
    ["Tus diez posiciones", "Tu carta, explicada", "Los contactos entre tus puntos"],
    "los capítulos entran entre las posiciones y los contactos, sin nada en el medio"
  );
  // El rótulo se dibuja con `ModuleHeader`, que lo pone en mayúsculas: lo que
  // se ve es "TU CARTA, EXPLICADA".
  assert.match(COMPLETA_SRC, /module="Tu carta, explicada"/i);
});

test("Free: el bloque de los capítulos, con el CTA que desbloquea la carta natal entera", () => {
  // El backend cierra la lectura larga server-side y la señal remota llega
  // `locked`: no es un error y por eso no se ofrece REINTENTAR.
  assert.equal(readingBlockPhase({ reading: null, failed: false, state: "locked" }), "bloqueado");
  // Ni siquiera un reject local de la ronda anterior lo convierte en error.
  assert.equal(readingBlockPhase({ reading: null, failed: true, state: "locked" }), "bloqueado");

  const { lectura } = bloqueDeLectura(COMPLETA_SRC);
  const bloqueado = lectura.slice(
    lectura.indexOf('lectura.phase === "bloqueado"'),
    lectura.indexOf('lectura.phase === "cargando"')
  );
  assert.ok(bloqueado.length > 0, "falta la rama bloqueada");
  assert.match(bloqueado, /<PlusBlock/, "el bloqueo se dice con el bloque de Plus del sistema");
  assert.match(bloqueado, /siete capítulos/, "hay que decir qué desbloquea exactamente");
  assert.match(bloqueado, /label: "DESBLOQUEAR MI CARTA NATAL"/);
  assert.match(bloqueado, /router\.push\("\/paywall"\)/);
  assert.doesNotMatch(bloqueado, /REINTENTAR/, "un límite de plan no es un error que se reintente");
  // Y lo que ya está calculado sigue a la vista: el bloqueo nombra lo que queda.
  assert.match(bloqueado, /rueda/i);
  assert.match(bloqueado, /posiciones/i);
});

test("Free: la rueda, los datos y las posiciones no dependen de la fase de la lectura", () => {
  // El bloqueo vive DENTRO de su módulo: ninguna sección de datos se envuelve
  // en la fase de la lectura. Si lo hiciera, una cuenta Free perdería la carta.
  const antes = COMPLETA_SRC.slice(0, COMPLETA_SRC.indexOf('module="Tu carta, explicada"'));
  assert.doesNotMatch(antes, /lectura\.phase/, "los datos de arriba no pueden mirar la lectura");
  for (const pieza of [/<NatalWheel/, /posiciones\.map\(/, /module="Tus datos natales y su precisión"/]) {
    assert.match(antes, pieza, "la carta calculada se dibuja antes y entera");
  }
});

test("Plus listo: los siete capítulos, en orden, con número, placement, párrafos y preguntas", () => {
  assert.equal(readingBlockPhase({ reading: LECTURA_7, failed: false }), "listo");
  const capitulos = natalChapters(LECTURA_7);
  assert.equal(capitulos.length, 7);
  assert.deepEqual(capitulos.map((c) => c.numero)[0], "Capítulo 01");
  assert.deepEqual(capitulos.map((c) => c.numero)[6], "Capítulo 07");
  assert.equal(capitulos[0].placement, "SOL EN CÁNCER · CASA 4", "el placement va completo");
  assert.deepEqual(capitulos[0].paragraphs, ["Primer párrafo del 1.", "Segundo párrafo del 1."]);
  assert.deepEqual(capitulos[0].questions, ["¿Qué te empuja?"]);

  // Y la pantalla los dibuja todos, sin recortar ni colapsar.
  const { lectura } = bloqueDeLectura(COMPLETA_SRC);
  assert.match(lectura, /natalChapters\(lectura\.reading\)/, "los capítulos salen del módulo compartido");
  assert.match(lectura, /capitulos\.map\(\(capitulo\) => \(\s*<Capitulo key=\{capitulo\.key\} capitulo=\{capitulo\} \/>/);
  assert.doesNotMatch(lectura, /\.slice\(0,\s*\d/, "no se recorta la lista de capítulos");

  const capitulo = COMPLETA_SRC.slice(
    COMPLETA_SRC.indexOf("function Capitulo("),
    COMPLETA_SRC.indexOf("function PlusBlock(")
  );
  assert.match(capitulo, /<Label>\{capitulo\.numero\}<\/Label>/, "el número");
  assert.match(capitulo, /\{capitulo\.placement\}/, "el placement");
  assert.match(capitulo, /<Subtitle style=\{styles\.spaced\}>\{capitulo\.title\}<\/Subtitle>/, "el título");
  assert.match(capitulo, /capitulo\.paragraphs\.map\(/, "el cuerpo, párrafo por párrafo");
  assert.match(capitulo, /capitulo\.questions\.map\(/, "y sus preguntas");
  // El disclaimer que viaja en la lectura se publica; no se escribe uno nuevo.
  assert.match(lectura, /\{lectura\.reading\.disclaimer\}/);
});

test("Plus cargando o con error: estado inline que no tapa el resto, y un solo REINTENTAR", () => {
  // Cargando: el prewarm del backend tiene el claim y la query sigue null.
  assert.equal(readingBlockPhase({ reading: null, failed: false, state: "pending" }), "cargando");
  // Error: el generador rechazó, o el prewarm que tenía el claim falló.
  assert.equal(readingBlockPhase({ reading: null, failed: true }), "error");
  assert.equal(readingBlockPhase({ reading: null, failed: false, generating: false, state: "error" }), "error");

  const { lectura } = bloqueDeLectura(COMPLETA_SRC);
  const cargando = lectura.slice(
    lectura.indexOf('lectura.phase === "cargando"'),
    lectura.indexOf('lectura.phase === "error"')
  );
  // Inline: una tarjeta del sistema, nunca el estado de pantalla completa que
  // reemplazaría la carta entera.
  assert.match(cargando, /<Card>/);
  assert.doesNotMatch(cargando, /<LoadingBlock|<ErrorBlock|<EmptyBlock/);
  assert.match(cargando, /accessibilityLiveRegion="polite"/, "el cambio de estado se anuncia");
  assert.doesNotMatch(cargando, /REINTENTAR/, "mientras se escribe no hay nada que reintentar");

  const error = lectura.slice(lectura.indexOf('lectura.phase === "error"'), lectura.indexOf("natalChapters("));
  assert.match(error, /<Card>/);
  assert.doesNotMatch(error, /<LoadingBlock|<ErrorBlock|<EmptyBlock/);
  assert.match(error, /accessibilityLiveRegion="polite"/);
  assert.match(error, /onPress=\{lectura\.retry\}/, "el reintento es el del hook compartido");
  assert.equal((error.match(/label="REINTENTAR"/g) ?? []).length, 1, "un solo REINTENTAR");
  assert.doesNotMatch(error, /\/paywall/, "un error no es un límite de plan");
});

test("la lectura recibida MANDA sobre cualquier señal vieja", () => {
  // Un reject local de la ronda anterior no tapa la lectura que ya llegó…
  assert.equal(readingBlockPhase({ reading: LECTURA_7, failed: true }), "listo");
  // …ni un `state` remoto stale en error, ni uno bloqueado que quedó atrás.
  assert.equal(readingBlockPhase({ reading: LECTURA_7, failed: true, state: "error" }), "listo");
  assert.equal(readingBlockPhase({ reading: LECTURA_7, failed: false, state: "locked" }), "listo");
  // Y la pantalla lo respeta por construcción: pregunta la fase, no el dato
  // crudo, y el hook sólo entrega la lectura cuando la fase es "listo".
  const { lectura } = bloqueDeLectura(COMPLETA_SRC);
  assert.ok(
    lectura.indexOf('lectura.phase === "bloqueado"') < lectura.indexOf("natalChapters("),
    "la fase se resuelve antes de dibujar"
  );
  assert.match(sinComentarios(leer("src/hooks/useNatalReading.ts")), /phase === "listo" \? reading! : null/);
});

test("los contactos conservan su lista técnica y remiten a los capítulos sin interpretar por aspecto", () => {
  const contactos = COMPLETA_SRC.slice(
    COMPLETA_SRC.indexOf('module="Los contactos entre tus puntos"'),
    COMPLETA_SRC.indexOf('module="Tus doce casas"')
  );
  // La lista técnica sigue intacta: línea del contacto y orbe.
  assert.match(contactos, /contactos\.map\(/);
  assert.match(contactos, /\{view\.line\}/);
  assert.match(contactos, /\{view\.orb\}/);
  assert.match(contactos, /El orbe es cuánto le falta a ese ángulo para ser exacto/);
  // Y una frase corta que dice dónde se leen esos cruces. Sólo cuando los
  // capítulos están efectivamente a la vista: prometerlos mientras cargan o
  // están bloqueados sería mandar a un texto que no está.
  assert.match(contactos, /lectura\.phase === "listo"/);
  assert.match(contactos, /cada capítulo integra los contactos de su punto/);
  // Lo que NO aparece: una lectura escrita por aspecto.
  assert.doesNotMatch(contactos, /natalChapters\(|<Capitulo/, "no se genera interpretación por contacto");
});

test("el bloque de capítulos usa sólo el sistema V4.9.2 y conserva voz y targets", () => {
  const { lectura } = bloqueDeLectura(COMPLETA_SRC);
  const capitulo = COMPLETA_SRC.slice(
    COMPLETA_SRC.indexOf("function Capitulo("),
    COMPLETA_SRC.indexOf("function PlusBlock(")
  );
  // Tokens y componentes del sistema, nunca el tema legado ni valores a mano.
  assert.doesNotMatch(`${lectura}\n${capitulo}`, /\borbita\.(colors|spacing|fonts)\b/);
  assert.match(capitulo, /v492\.colors\.copperSoft/);
  // El CTA es el botón del sistema, que ya garantiza el mínimo táctil de 44 pt.
  assert.match(COMPLETA_SRC, /<PrimaryButton label=\{cta\.label\} accessibilityLabel=\{cta\.voz\} onPress=\{cta\.onPress\} \/>/);
  assert.match(sinComentarios(leer("src/components/v492/States.tsx")), /minHeight: v492\.touch/);
  // VoiceOver: el encabezado del capítulo es UN nodo con su etiqueta propia
  // —el placement visible va en mayúsculas y se deletrearía— y cada pregunta
  // se anuncia por su texto.
  assert.match(capitulo, /accessible accessibilityRole="header" accessibilityLabel=\{capitulo\.voice\}/);
  assert.match(capitulo, /accessibilityLabel=\{pregunta\}/);
});

test("el deep link legado /carta conserva web y redirige nativo al nuevo hub", () => {
  const entry = "app/(tabs)/carta.tsx";
  const nativeImpl = relativo(resolveEntryForPlatform(entry, "native"));
  const webImpl = relativo(resolveEntryForPlatform(entry, "web"));

  assert.equal(nativeImpl, "src/routes/v492/tabs-carta.tsx");
  assert.equal(webImpl, "src/routes/v492/tabs-carta.web.tsx");
  assert.match(sinComentarios(leer(nativeImpl)), /<Redirect\s+href="\/perfil"\s*\/>/);
  assert.match(sinComentarios(leer(webImpl)), /<CartaScreen\s*\/>/);
});

test("tipo lunar muestra phaseIndex humano y el ciclo completo de ocho fases", () => {
  assert.equal(LUNAR_CYCLE.length, 8);
  assert.deepEqual(
    LUNAR_CYCLE.map((phase) => [phase.startDegrees, phase.endDegrees]),
    [
      [0, 45],
      [45, 90],
      [90, 135],
      [135, 180],
      [180, 225],
      [225, 270],
      [270, 315],
      [315, 360]
    ]
  );

  const screen = sinComentarios(leer("src/screens/v492/TipoLunarDetailScreen.tsx"));
  // El frame V4.9.2 (`969:907`) dibuja `EL CICLO COMPLETO` como UNA fila de ocho
  // discos, no como dos filas de cuatro, y dice el lugar en el ciclo UNA sola vez
  // —en el hero—, porque la tabla `LOS NÚMEROS DE TU FASE` que lo repetía no está
  // en el canon. Lo que se sigue exigiendo es lo que importaba: que el índice
  // visible empiece en uno y que se rendericen las ocho fases del catálogo.
  assert.match(screen, /data\.phaseIndex\s*\+\s*1/, "el índice visible empieza en uno");
  assert.match(screen, /LUNAR_CYCLE\.map\s*\(/, "se dibuja el ciclo entero, no un recorte");
  assert.doesNotMatch(
    screen,
    /LUNAR_CYCLE\.slice\s*\(/,
    "el ciclo se muestra completo: recortarlo dejaría fases fuera de la fila"
  );
  assert.match(screen, /indice\s*\+\s*1/, "VoiceOver también anuncia fases desde uno");
  assert.match(screen, /LUNAR_CYCLE\.length/, "la UI deriva el total del catálogo de ocho fases");
});

test("mapa elemental muestra recuentos de Sol a Plutón, nunca porcentajes", () => {
  const screen = sinComentarios(leer("src/screens/v492/MapaElementalDetailScreen.tsx"));
  const hub = sinComentarios(leer("src/screens/v492/CartaHubScreen.tsx"));

  assert.match(screen, /Sol pesa lo mismo que Plutón/);
  assert.match(screen, /diez posiciones, del Sol a Plutón/);
  assert.match(screen, /\$\{count\} de \$\{total\}/, "cada barra etiqueta el recuento entero");
  assert.match(screen, /\$\{data\.total\} de 10/, "el resumen etiqueta posiciones contadas");
  assert.match(hub, /\$\{data\.counts\[element\]\} de \$\{data\.total\}/);
  assert.doesNotMatch(screen, /formatPercent|toFixed\([^)]*\)\s*\+\s*["']%|["'`]\s*%\s*["'`]/);
});

test("la trazabilidad conserva seis bloques, edición y límites sin repetir", () => {
  const trace = sinComentarios(leer("src/components/v492/Trace.tsx"));
  const headings = [
    "DATO CALCULADO",
    "REGLA INTERPRETATIVA",
    "MÉTODO Y VERSIÓN",
    "LIBRO, AUTOR Y LOCALIZADOR",
    "TIPO DE ELABORACIÓN",
    "LIMITACIÓN"
  ];

  for (const heading of headings) {
    assert.equal(trace.match(new RegExp(`titulo="${heading}"`, "g"))?.length, 1, `${heading} debe ser un bloque único`);
  }
  assert.match(trace, /source\.edition\s*\?\s*` · \$\{source\.edition\}`/);
  assert.match(trace, /uniqueLines\(envelope\.limitations\)/, "un mismo límite no se presenta dos veces");
});

test("Carta no expone frases de maqueta, códigos internos ni jerga sin explicar", () => {
  const visibleSurfaces = [
    "src/screens/v492/CartaHubScreen.tsx",
    "src/screens/v492/TipoLunarDetailScreen.tsx",
    "src/screens/v492/MapaElementalDetailScreen.tsx",
    "src/screens/v492/CartaCompletaV492Screen.tsx",
    "src/components/v492/Trace.tsx"
  ];
  const source = visibleSurfaces.map((rel) => sinComentarios(leer(rel))).join("\n");

  for (const phrase of [
    /se recalcula todos los días/i,
    /tres,\s*no una enciclopedia/i,
    /toca una luminaria/i,
    /toca el eje que te representa/i,
    /entra por regencia/i,
    /ya pasó el pico[\s\S]{0,120}no abrir algo nuevo/i,
    /cómo se te nota/i,
    /\befeméride\b/i,
    /\bcúspide(?:s)?\b/i
  ]) {
    assert.doesNotMatch(source, phrase);
  }

  assert.doesNotMatch(
    source,
    /["'`](?:inputHash|providerVersion|orbita_synthesis|exact_birth_time|complete_natal_houses|natal_[a-z_]+)["'`]/,
    "los códigos del contrato no son copy"
  );

  const completa = sinComentarios(leer("src/screens/v492/CartaCompletaV492Screen.tsx"));
  if (/\borbe\b/i.test(completa)) {
    assert.match(
      completa,
      /El orbe es cuánto le falta a ese ángulo para ser exacto/,
      "si la carta usa «orbe», lo traduce en la misma pantalla"
    );
  }
});

test("el rótulo del mapa elemental concuerda el artículo con el elemento", () => {
  // El defecto medido en el simulador: `CUANDO EL TIERRA SATURA`. El artículo
  // no se deriva del género —`tierra` y `agua` son femeninos y sólo `tierra`
  // lleva `la`, porque `agua` empieza con /a/ tónica—, así que va declarado.
  assert.equal(elementWithArticle(["earth"]), "la tierra");
  assert.equal(elementWithArticle(["water"]), "el agua");
  assert.equal(elementWithArticle(["fire"]), "el fuego");
  assert.equal(elementWithArticle(["air"]), "el aire");
  // Empate: no existe un artículo singular para dos elementos.
  assert.equal(elementWithArticle(["earth", "water"]), "los tierra · agua");
  assert.equal(elementWithArticle([]), "—");

  // Y la pantalla lo usa: sin esto el gate pasaría con el `EL` fijo intacto.
  const pantalla = sinComentarios(leer("src/screens/v492/MapaElementalDetailScreen.tsx"));
  assert.match(pantalla, /CUANDO \$\{elementWithArticle\(data\.dominant\)/);
  assert.doesNotMatch(pantalla, /CUANDO EL \$\{/);
});

test("`SIN PLANETAS` sólo con recuento cero: con uno o más, `MENOS PRESENTE`", () => {
  // La contradicción medida en el estado 08: la barra decía `Aire 1 · Urano` y
  // el rótulo de al lado, `AIRE SIN PLANETAS`, en la misma pantalla. El rótulo
  // era un literal; ahora sale del recuento real.
  assert.equal(leastElementTag(["air"], 0), "AIRE SIN PLANETAS");
  assert.equal(leastElementTag(["air"], 1), "AIRE MENOS PRESENTE");
  assert.equal(leastElementTag(["air"], 2), "AIRE MENOS PRESENTE");
  assert.equal(leastElementTag(["earth"], 0), "TIERRA SIN PLANETAS");

  // Empate: se nombran los dos y no se elige uno, ni con cero ni con más.
  assert.equal(leastElementTag(["air", "fire"], 0), "AIRE · FUEGO SIN PLANETAS");
  assert.equal(leastElementTag(["air", "fire"], 1), "AIRE · FUEGO MENOS PRESENTE");
  // Sin dato no se inventa un cero.
  assert.equal(leastElementTag([], 0), "SIN DATO");

  // El recuento sale del reparto, y con empate los empatados comparten número.
  const counts = { fire: 1, earth: 3, air: 1, water: 5 } as const;
  assert.equal(leastElementCount(counts, ["air", "fire"]), 1);
  assert.equal(leastElementCount(counts, ["water"]), 5);
  assert.equal(leastElementCount(counts, []), null);

  // Y la pantalla usa el rótulo derivado, no el literal de antes.
  const pantalla = sinComentarios(leer("src/screens/v492/MapaElementalDetailScreen.tsx"));
  assert.match(pantalla, /leastElementTag\(data\.leastRepresented,/);
  assert.doesNotMatch(
    pantalla,
    /elementList\(data\.leastRepresented\)\.toLocaleUpperCase\("es"\)\} SIN PLANETAS/,
    "el rótulo no puede volver a afirmar ausencia sin mirar el recuento"
  );
});

// ---------------------------------------------------------------------------
// El eje pendiente: un solo hecho para la vista y para el lector de pantalla
// ---------------------------------------------------------------------------

/** Un Ascendente publicado, tal como lo trae el contrato. */
function ascendente(): NatalChartBase["angles"][number] {
  return {
    key: "ascendant",
    label: "Ascendente",
    source: "verified_legacy_geometry",
    precision: "exact",
    sign: "Scorpio",
    signEs: "Escorpio",
    degree: 28.4,
    fullDegree: 238.4,
    house: 1
  };
}

test("con la hora exacta guardada, un eje que todavía no llegó dice `Calculando…` y no `Necesita tu hora`", () => {
  // El defecto: la fila visible mandaba a corregir la hora —que ya estaba
  // guardada y era exacta— mientras VoiceOver decía la verdad, que el cálculo no
  // había publicado los ejes. Dos ramas para el mismo hecho.
  const calculandose = cartaBase({
    status: "partial",
    birthTimePrecision: "known",
    calculationTimeSource: "exact_birth_time",
    access: { isPro: true, positions: true, angles: false, houses: false, aspects: true },
    angles: [],
    missingInputs: ["verified_ascendant_mc_geometry"],
    limitations: [
      "Las posiciones planetarias son canónicas, pero la carta vigente no trae Ascendente y Medio Cielo verificables."
    ]
  });
  const pendiente = angleRowView(calculandose, "ascendant", "Ascendente");
  assert.equal(pendiente.state, "calculando");
  assert.equal(pendiente.value, CALCULANDO_EJE);
  assert.equal(pendiente.value, "Calculando…");
  assert.doesNotMatch(pendiente.value, /hora/i, "la hora exacta ya está: no se puede pedir de nuevo");
  assert.match(pendiente.voice, /no publicó los ejes verificados/);
  assert.doesNotMatch(pendiente.voice, /necesita tu hora/i);

  // Hora desconocida: ahí sí el límite es la hora, y se dice igual en los dos lados.
  const sinHora = cartaBase({
    status: "partial",
    birthTimePrecision: "unknown",
    calculationTimeSource: "full_civil_day",
    access: { isPro: true, positions: true, angles: false, houses: false, aspects: true },
    angles: [],
    missingInputs: ["exact_birth_time"]
  });
  const faltaHora = angleRowView(sinHora, "ascendant", "Ascendente");
  assert.equal(faltaHora.state, "sin-hora");
  assert.equal(faltaHora.value, NECESITA_HORA);
  assert.match(faltaHora.voice, /necesita tu hora de nacimiento/i);
  assert.doesNotMatch(faltaHora.voice, /ejes verificados/);

  // Eje listo: el dato, con su grado, en la vista y en la voz.
  const listo = cartaBase({ angles: [ascendente()] });
  const publicado = angleRowView(listo, "ascendant", "Ascendente");
  assert.equal(publicado.state, "listo");
  assert.equal(publicado.value, "Escorpio 28°");
  assert.match(publicado.voice, /Ascendente en Escorpio, 28 grados/);

  // Y las tres salidas son coherentes entre sí: cada estado dice una sola cosa.
  const valores = [pendiente.value, faltaHora.value, publicado.value];
  assert.equal(new Set(valores).size, 3);
});

// ---------------------------------------------------------------------------
// La casa, en un solo lugar de la fila
// ---------------------------------------------------------------------------

/** Una posición canónica del contrato. Cada prueba cambia SÓLO lo suyo. */
function posicion(patch: Partial<NatalPosition> = {}): NatalPosition {
  return {
    key: "sun",
    label: "Sol",
    source: "planets/tropical",
    precision: "exact",
    sign: "Cancer",
    signEs: "Cáncer",
    possibleSigns: ["Cancer"],
    possibleSignsEs: ["Cáncer"],
    degree: 12.4,
    fullDegree: 102.4,
    house: 4,
    isRetrograde: false,
    limitation: null,
    ...patch
  } as NatalPosition;
}

/**
 * El recorte del hub, ejecutando la función QUE ESTÁ EN LA PANTALLA.
 *
 * `CartaHubScreen.tsx` importa React Native y no se puede cargar en este runner,
 * así que se lee su fuente y se corre ese cuerpo con el `positionView` real
 * inyectado. Es la única forma de probar el comportamiento y no una copia: si
 * alguien cambia el helper, cambia lo que corre acá; si lo borra, esto falla.
 */
const valorDeTriada = (() => {
  const hub = leer("src/screens/v492/CartaHubScreen.tsx");
  const desde = hub.indexOf("function valorDeTriada(");
  assert.ok(desde >= 0, "el hub tiene que definir su propio recorte de casa");
  // Del `{` de la firma al `}` en columna cero que la cierra.
  const cuerpo = hub.slice(hub.indexOf("{", desde), hub.indexOf("\n}", desde) + 2);
  const separador = /const SEPARADOR = ("(?:[^"\\]|\\.)*");/.exec(hub);
  assert.ok(separador, "el hub tiene que declarar el separador con el que recorta");
  const construir = new Function(
    "positionView",
    "SEPARADOR",
    `return function valorDeTriada(position) ${cuerpo}`
  ) as (
    view: typeof positionView,
    separador: string
  ) => (position: NatalPosition) => string;
  return construir(positionView, JSON.parse(separador[1]) as string);
})();

test("en el hub la casa se lee UNA vez: la columna la imprime y el valor no la repite", () => {
  // El hecho que crea el riesgo, y la razón por la que el recorte NO puede vivir
  // en `positionView`: esa vista cierra su valor con la casa porque la Carta
  // completa no tiene columna donde ponerla, y ahí ese segmento es el único
  // lugar donde la casa se lee. Su firma exacta —separador ` · `, rótulo
  // `Casa N`— es lo que el hub recorta, así que se fija acá.
  const conCasa = posicion({ house: 4, isRetrograde: true });
  assert.equal(positionView(conCasa).value, "Cáncer 12° · Rx · Casa 4");

  // Plus, con casa publicada: el valor conserva signo, grado y Rx, y suelta la
  // casa. La columna `CASA 4` es la única que la imprime.
  assert.equal(valorDeTriada(conCasa), "Cáncer 12° · Rx");
  assert.doesNotMatch(valorDeTriada(conCasa), /casa/i, "la casa la dice la columna, no el valor");

  // Sin Rx el recorte tampoco se come el grado: saca el SEGMENTO de casa, no el
  // último pedazo del valor. Y una casa de dos dígitos es una casa igual.
  const casaOnce = posicion({ house: 11 });
  assert.equal(positionView(casaOnce).value, "Cáncer 12° · Casa 11");
  assert.equal(valorDeTriada(casaOnce), "Cáncer 12°");

  // Free / sin hora: el contrato no publica casa. Ni el valor la nombra ni la
  // celda se dibuja, y en ningún lado queda un guion ocupando su lugar.
  const sinCasa = posicion({ house: null });
  assert.equal(positionView(sinCasa).value, "Cáncer 12°");
  assert.equal(valorDeTriada(sinCasa), "Cáncer 12°");
  assert.doesNotMatch(valorDeTriada(sinCasa), /casa|[–—-]/i, "sin casa no se dice nada, ni un guion");

  // Los valores donde la casa NO se imprime pasan intactos, incluso si el
  // contrato trae el número: se saca el segmento de casa, no el último pedazo
  // del valor. Recortar a ciegas dejaría estas filas vacías.
  const sinGrado = posicion({ precision: "estimated", degree: null, fullDegree: null, house: 4 });
  assert.equal(positionView(sinGrado).value, "Cáncer");
  assert.equal(valorDeTriada(sinGrado), "Cáncer");
  const rango = posicion({
    precision: "range",
    signEs: null,
    possibleSignsEs: ["Cáncer", "Leo"],
    degree: null,
    fullDegree: null,
    house: 4
  });
  assert.equal(valorDeTriada(rango), positionView(rango).value);
  assert.match(valorDeTriada(rango), /Cáncer o Leo/, "el rango de signos queda entero");

  // VoiceOver lee la fila entera —el hub le pasa la voz de `positionView`— y ahí
  // la casa se dice una sola vez, con el Rx incluido.
  const dichas = positionView(conCasa).voice.match(/casa 4/gi) ?? [];
  assert.equal(dichas.length, 1, "la voz dice la casa, y una sola vez");
  assert.match(positionView(conCasa).voice, /retrógrado/, "la voz conserva el Rx");
  assert.doesNotMatch(positionView(sinCasa).voice, /casa/i, "sin casa la voz tampoco la inventa");
});

test("la tríada del hub no dibuja una casa que no existe", () => {
  const hub = sinComentarios(leer("src/screens/v492/CartaHubScreen.tsx"));
  const triada = hub.slice(
    hub.indexOf("<View style={styles.triada}>"),
    hub.indexOf("<Legend>{resumenCarta(chart)}</Legend>")
  );
  assert.ok(triada.length > 0, "el hub tiene que montar la tríada tabular");

  // La celda es OPCIONAL y no se dibuja sin casa real. El guion que había antes
  // ocupaba una columna rotulada `CASA N`: no se leía como "no aplica" sino como
  // un dato que la carta tiene y no muestra.
  const fila = hub.slice(hub.indexOf("function Fila("), hub.indexOf("function resumenCarta("));
  assert.ok(fila.length > 0, "no encontré el componente de fila");
  assert.match(fila, /casa\?: string \| null;/, "la casa es opcional en la fila");
  assert.match(
    fila,
    /\{casa \? <Label style=\{styles\.filaCasa\}>\{casa\}<\/Label> : null\}/,
    "sin casa no se renderiza la celda, ni vacía ni con guion"
  );

  // Cero guiones en la columna: ni fijos ni como respaldo del ternario. El
  // recorte es por PROP, no por línea suelta: el guion largo del valor —«—», lo
  // que dice un grado retirado— es otro dato y no se toca.
  const propsDeCasa = triada.split("\n").filter((linea) => linea.trim().startsWith("casa="));
  assert.equal(propsDeCasa.length, 3, "Sol, Luna y el Ascendente declaran su celda");
  for (const prop of propsDeCasa) {
    assert.doesNotMatch(prop, /["'`][–—-]["'`]/, `una casa no puede caer a un guion: ${prop.trim()}`);
    assert.match(prop, /: null\}$/, "sin casa real, la prop es null y la celda no se dibuja");
  }

  // Sol y Luna conservan la casa REAL cuando el cálculo la publica, y caen a
  // `null` —no a un guion— cuando no.
  for (const cuerpo of ["sol", "luna"]) {
    assert.match(
      triada,
      new RegExp(
        String.raw`casa=\{${cuerpo}\?\.house !== null && ${cuerpo}\?\.house !== undefined \? \`CASA \$\{${cuerpo}\.house\}\` : null\}`
      ),
      `${cuerpo} tiene que conservar CASA N cuando existe y no dibujar nada cuando no`
    );
  }

  // El Ascendente es un eje: no CAE en ninguna casa, pero es la cúspide con la
  // que la casa 1 empieza, y eso es lo que dice su celda. `CASA 1` a secas lo
  // trataría como una ubicación —el mismo error del guion fijo que hubo antes—
  // y la celda vacía dejaba en blanco justo la fila del eje del que sale todo el
  // sistema de casas.
  const filaAscendente = triada.slice(triada.indexOf('glifo="\u2191"'));
  assert.ok(filaAscendente.length > 0, "la fila del Ascendente sigue marcada con la flecha");
  assert.equal(ASCENDENTE_INICIO_CASA, "INICIO CASA 1");
  assert.match(
    filaAscendente,
    /casa=\{ascendente\.state === "listo" \? ASCENDENTE_INICIO_CASA : null\}/,
    "el Ascendente anuncia el inicio de la casa 1, y sólo con el eje ya publicado"
  );
  assert.doesNotMatch(
    filaAscendente,
    /["'`]CASA 1["'`]/,
    "el Ascendente no puede declarar `CASA 1`: no está en la casa 1, la empieza"
  );

  // Tres filas traen celda: las dos posiciones con su casa real y el eje con la
  // cúspide que inicia.
  assert.equal((triada.match(/casa=/g) ?? []).length, 3);

  // El valor pasa por el recorte del hub y NO por el valor crudo de dominio, que
  // cierra con `\u00b7 Casa N` y repetiria la casa que la columna ya imprime.
  for (const cuerpo of ["sol", "luna"]) {
    assert.match(triada, new RegExp(String.raw`valor=\{${cuerpo} \? valorDeTriada\(${cuerpo}\) : "\u2014"\}`));
    assert.doesNotMatch(
      triada,
      new RegExp(String.raw`valor=\{[^}]*positionView\(${cuerpo}\)\.value`),
      `${cuerpo} no puede imprimir el valor con casa adentro: la columna ya la dibuja`
    );
  }

  // La voz sí sale entera de dominio: dice la fila completa, casa incluida, una
  // sola vez, y es lo único que VoiceOver lee de la fila.
  assert.match(triada, /voz=\{sol \? positionView\(sol\)\.voice/);
  assert.match(triada, /voz=\{luna \? positionView\(luna\)\.voice/);

  // Lo de abajo no se toca: el eje sigue saliendo de su resolvedor y el resumen
  // sigue contando lo que la carta tiene.
  assert.match(triada, /valor=\{ascendente\.value\}/);
  assert.match(hub, /<Legend>\{resumenCarta\(chart\)\}<\/Legend>/);
});

test("la vista y la accesibilidad del Ascendente salen del mismo resolvedor", () => {
  const hub = sinComentarios(leer("src/screens/v492/CartaHubScreen.tsx"));

  assert.match(hub, /angleRowView\(chart, "ascendant", "Ascendente"\)/);
  assert.doesNotMatch(
    hub,
    /Necesita tu hora/,
    "el copy del eje sin hora vive en el dominio, no en una rama de la pantalla"
  );
  assert.doesNotMatch(
    hub,
    /no publicó los ejes verificados/,
    "la voz del eje pendiente también sale del dominio"
  );
  // La fila y la etiqueta de la rueda tienen que preguntar lo mismo: cuando eran
  // dos ramas, la rueda podía describir un motivo distinto del que mostraba la
  // tríada.
  assert.equal((hub.match(/angleRowView\(/g) ?? []).length, 2);
  assert.doesNotMatch(
    hub,
    /chart\.angles\.find\(/,
    "ninguna pantalla lee la lista de ejes por su cuenta"
  );

  // La cúspide se dice UNA sola vez por elemento accesible: la fila del eje la
  // agrega a su voz —la celda `INICIO CASA 1` no la lee VoiceOver, porque la
  // fila entera es un solo elemento con su etiqueta— y la etiqueta de la rueda
  // NO la repite: describe el dibujo, no la tabla.
  const cuerpoDelHub = hub.slice(hub.indexOf("export function CartaHubScreen"));
  assert.equal((cuerpoDelHub.match(/ASCENDENTE_INICIO_CASA_VOZ/g) ?? []).length, 1);
  assert.equal(ASCENDENTE_INICIO_CASA_VOZ, "Es el grado con el que empieza tu casa 1.");
  const rueda = hub.slice(hub.indexOf("function etiquetaRueda("));
  assert.doesNotMatch(
    rueda,
    /ASCENDENTE_INICIO_CASA/,
    "la rueda no vuelve a anunciar el inicio de la casa 1: ya lo dijo la fila"
  );
  // Y en ningún caso se afirma que el eje esté DENTRO de la casa 1.
  assert.doesNotMatch(hub, /Ascendente[^.]{0,60}en (?:la )?casa 1/i);
});

// ---------------------------------------------------------------------------
// Reintentar sólo cuando reintentar resuelve algo
// ---------------------------------------------------------------------------

test("un parcial cuyo único límite es la hora no se puede reintentar: se completa la hora", () => {
  // El defecto: `canRetry` valía `true` para CUALQUIER `parcial`. Sin hora, la
  // carta está completa para los datos que hay; el botón prometía un final que
  // ningún recálculo puede dar.
  const sinHora = natalChartState({
    chart: cartaBase({
      status: "partial",
      birthTimePrecision: "unknown",
      calculationTimeSource: "full_civil_day",
      access: { isPro: false, positions: true, angles: false, houses: false, aspects: false },
      missingInputs: ["exact_birth_time"],
      limitations: ["Sin hora exacta, cada posición se comprueba sobre todo el día civil."]
    }),
    refreshing: false
  });
  assert.equal(sinHora.phase, "parcial");
  assert.equal(sinHora.canRetry, false, "reintentar no inventa una hora de nacimiento");
  assert.equal(sinHora.recovery, "completar-hora");
  assert.equal(sinHora.reason, null, "la hora no es un cálculo pendiente");

  // Una hora aproximada se trata igual: el contrato la declara con el mismo código.
  const aproximada = natalChartState({
    chart: cartaBase({
      status: "partial",
      birthTimePrecision: "approximate",
      calculationTimeSource: "full_civil_day",
      access: { isPro: true, positions: true, angles: false, houses: false, aspects: true },
      missingInputs: ["exact_birth_time"]
    }),
    refreshing: false
  });
  assert.equal(aproximada.canRetry, false);
  assert.equal(aproximada.recovery, "completar-hora");
});

test("un parcial al que le falta cálculo sí se puede reintentar", () => {
  // Ejes pendientes con hora exacta: eso lo resuelve otra corrida.
  const ejes = natalChartState({
    chart: cartaBase({
      status: "partial",
      access: { isPro: true, positions: true, angles: false, houses: false, aspects: true },
      missingInputs: ["verified_ascendant_mc_geometry"],
      limitations: [
        "Las posiciones planetarias son canónicas, pero la carta vigente no trae Ascendente y Medio Cielo verificables."
      ]
    }),
    refreshing: false
  });
  assert.equal(ejes.phase, "parcial");
  assert.equal(ejes.canRetry, true);
  assert.equal(ejes.recovery, "reintentar");
  assert.match(ejes.reason ?? "", /Ascendente y Medio Cielo verificables/);

  // Doce casas pendientes con Plus: mismo caso.
  const casas = natalChartState({
    chart: cartaBase({
      status: "partial",
      access: { isPro: true, positions: true, angles: true, houses: false, aspects: true },
      missingInputs: ["verified_twelve_house_geometry"],
      limitations: ["No se publican casas incompletas: hacen falta las doce cúspides verificadas."]
    }),
    refreshing: false
  });
  assert.equal(casas.canRetry, true);
  assert.equal(casas.recovery, "reintentar");

  // Sin hora, pero además con algo del cálculo pendiente: la parte recuperable
  // manda, porque esa sí la puede resolver otra corrida.
  const mixto = natalChartState({
    chart: cartaBase({
      status: "partial",
      birthTimePrecision: "unknown",
      calculationTimeSource: "full_civil_day",
      access: { isPro: true, positions: true, angles: false, houses: false, aspects: true },
      missingInputs: ["exact_birth_time", "verified_twelve_house_geometry"]
    }),
    refreshing: false
  });
  assert.equal(mixto.canRetry, true);
  assert.equal(mixto.recovery, "reintentar");

  // Un `refreshFailed` sí deja recuperable al parcial que YA tenía algo
  // pendiente del lado del cálculo: ahí reintentar puede terminar el trabajo.
  const falladoConPendiente = natalChartState({
    chart: cartaBase({
      status: "partial",
      birthTimePrecision: "unknown",
      calculationTimeSource: "full_civil_day",
      access: { isPro: true, positions: true, angles: false, houses: false, aspects: true },
      missingInputs: ["exact_birth_time", "verified_twelve_house_geometry"]
    }),
    refreshing: false,
    refreshFailed: true
  });
  assert.equal(falladoConPendiente.canRetry, true);
  assert.equal(falladoConPendiente.recovery, "reintentar");
});

test("un refresco fallido no vuelve reintentable a la carta limitada SÓLO por la hora", () => {
  // Corrección de la pasada anterior, que afirmaba lo contrario: "lo que falló
  // fue el intento, no el dato". Es verdad y no alcanza. Lo que `refreshFailed`
  // reporta es que no se pudo traer el cielo de HOY, y el cielo de hoy no tiene
  // nada que ver con la hora a la que naciste: por más veces que se recalcule,
  // esa hora no va a aparecer. Ofrecer "comprobar de nuevo" acá promete un final
  // que ningún recálculo puede dar, y tapa la única salida real.
  for (const birthTimePrecision of ["unknown", "approximate"] as const) {
    const soloLaHora = natalChartState({
      chart: cartaBase({
        status: "partial",
        birthTimePrecision,
        calculationTimeSource: "full_civil_day",
        access: { isPro: false, positions: true, angles: false, houses: false, aspects: false },
        missingInputs: ["exact_birth_time"],
        limitations: ["Sin hora exacta, cada posición se comprueba sobre todo el día civil."]
      }),
      refreshing: false,
      refreshFailed: true
    });
    assert.equal(soloLaHora.phase, "parcial", birthTimePrecision);
    assert.equal(soloLaHora.recovery, "completar-hora", birthTimePrecision);
    assert.equal(soloLaHora.canRetry, false, birthTimePrecision);
    assert.equal(soloLaHora.reason, null, "la hora no es un cálculo pendiente");
  }

  // Y el fallo del refresco no cambia NADA de este estado: con y sin él, la
  // salida es la misma.
  const chart = cartaBase({
    status: "partial",
    birthTimePrecision: "unknown",
    calculationTimeSource: "full_civil_day",
    access: { isPro: false, positions: true, angles: false, houses: false, aspects: false },
    missingInputs: ["exact_birth_time"]
  });
  assert.deepEqual(
    natalChartState({ chart, refreshing: false, refreshFailed: true }),
    natalChartState({ chart, refreshing: false, refreshFailed: false })
  );
});

test("`canRetry` se deriva de la salida real en los seis estados, y los estados D7 no cambian", () => {
  const sinSnapshot = cartaBase({
    status: "unavailable",
    access: { isPro: true, positions: false, angles: false, houses: false, aspects: false },
    missingInputs: ["canonical_natal_ephemeris"],
    limitations: ["Todavía no hay posiciones canónicas calculadas para estos datos."]
  });
  const estados = {
    cargando: natalChartState({ chart: undefined, refreshing: false }),
    sinDatos: natalChartState({
      chart: cartaBase({
        status: "unavailable",
        access: { isPro: false, positions: false, angles: false, houses: false, aspects: false },
        missingInputs: ["birth_data"],
        limitations: ["Cargá tus datos de nacimiento para calcular la carta."]
      }),
      refreshing: false
    }),
    // D7: con corrida activa se está calculando y no hay nada que relanzar…
    calculando: natalChartState({ chart: sinSnapshot, refreshing: true }),
    // …y sin corrida activa el estado es recuperable y ofrece comprobar de nuevo.
    sinCalculo: natalChartState({ chart: sinSnapshot, refreshing: false }),
    listo: natalChartState({ chart: cartaBase(), refreshing: false })
  };

  assert.deepEqual(
    Object.fromEntries(
      Object.entries(estados).map(([nombre, estado]) => [nombre, [estado.phase, estado.recovery, estado.canRetry]])
    ),
    {
      cargando: ["cargando", "ninguna", false],
      sinDatos: ["sin-datos", "cargar-datos", false],
      calculando: ["calculando", "ninguna", false],
      sinCalculo: ["sin-calculo", "reintentar", true],
      listo: ["listo", "ninguna", false]
    }
  );

  for (const [nombre, estado] of Object.entries(estados)) {
    assert.equal(estado.canRetry, estado.recovery === "reintentar", nombre);
  }
});

test("la Carta ofrece cada salida donde corresponde, y ninguna donde no resuelve nada", () => {
  const hub = sinComentarios(leer("src/screens/v492/CartaHubScreen.tsx"));

  // El botón de reintentar del parcial está atado a `canRetry`, no a la fase.
  assert.match(hub, /estado\.phase === "parcial" && estado\.canRetry/);
  // Y el de la hora, a la salida que el dominio declaró.
  assert.match(hub, /estado\.recovery === "completar-hora"/);
  assert.match(hub, /AGREGAR O CORREGIR HORA/);
});

test("la carta completa NO descarta el estado: ofrece la salida que el dominio declaró", () => {
  // El defecto: `CartaCompletaLive` resolvía `estado` y al pasar al contenido se
  // quedaba con `chart` y `timezone`. Un parcial con los ejes o las casas
  // pendientes —que el dominio declara recuperable— no ofrecía nada, y la
  // pantalla contaba algo distinto que el hub sobre el mismo contrato.
  const completa = sinComentarios(leer("src/screens/v492/CartaCompletaV492Screen.tsx"));

  // 1 · el estado viaja al contenido, que es donde se perdía.
  assert.match(
    completa,
    /<CartaCompletaContent[\s\S]{0,240}estado=\{estado\}/,
    "el contenido tiene que recibir la salida del resolvedor"
  );
  assert.match(
    completa,
    /function CartaCompletaContent\(\{[\s\S]{0,400}\bestado\b/,
    "y declararla como prop, no volver a deducirla"
  );

  // 2 · cálculo pendiente recuperable → el botón correcto, atado a `canRetry` y
  // no a la fase.
  assert.match(completa, /estado\.phase === "parcial" && estado\.canRetry/);
  assert.match(completa, /COMPROBAR DE NUEVO/);
  // 3 · falta de hora → completar hora, y esa rama la decide el dominio.
  assert.match(completa, /estado\.recovery !== "completar-hora"/);
  assert.match(completa, /AGREGAR MI HORA DE NACIMIENTO/);
  // 4 · cálculo en curso → espera, sin botón duplicado.
  const enCurso = completa.match(/function Calculando\(\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.ok(enCurso.length > 0, "la pantalla tiene que resolver el estado en curso");
  assert.doesNotMatch(enCurso, /PrimaryButton/, "mientras la corrida vive no hay nada que relanzar");

  // Y no aparece ningún muro de Plus por disponibilidad de efeméride: el límite
  // de plan se sigue preguntando por superficie.
  assert.doesNotMatch(
    completa,
    /estado\.(?:phase|recovery|canRetry)[^\n]{0,80}PlusBlock/,
    "un cálculo pendiente no es un límite de acceso"
  );

  // Las dos salidas que esas ramas leen, resueltas por el dominio.
  const pendiente = natalChartState({
    chart: cartaBase({
      status: "partial",
      access: { isPro: true, positions: true, angles: false, houses: false, aspects: true },
      missingInputs: ["verified_ascendant_mc_geometry"],
      limitations: [
        "Las posiciones planetarias son canónicas, pero la carta vigente no trae Ascendente y Medio Cielo verificables."
      ]
    }),
    refreshing: false
  });
  assert.deepEqual(
    [pendiente.phase, pendiente.recovery, pendiente.canRetry],
    ["parcial", "reintentar", true]
  );

  const sinHora = natalChartState({
    chart: cartaBase({
      status: "partial",
      birthTimePrecision: "unknown",
      calculationTimeSource: "full_civil_day",
      access: { isPro: false, positions: true, angles: false, houses: false, aspects: false },
      missingInputs: ["exact_birth_time"]
    }),
    refreshing: false,
    refreshFailed: true
  });
  assert.deepEqual(
    [sinHora.phase, sinHora.recovery, sinHora.canRetry],
    ["parcial", "completar-hora", false]
  );

  // Y una carta lista no ofrece ninguna de las dos.
  const listo = natalChartState({ chart: cartaBase(), refreshing: false });
  assert.deepEqual([listo.phase, listo.recovery, listo.canRetry], ["listo", "ninguna", false]);
});

test("el hub y la carta completa dicen lo mismo del cálculo pendiente", () => {
  // Mismo estado, misma salida y la misma voz: mientras el bloque vivía en una
  // sola pantalla, la otra no lo ofrecía.
  const hub = sinComentarios(leer("src/screens/v492/CartaHubScreen.tsx"));
  const completa = sinComentarios(leer("src/screens/v492/CartaCompletaV492Screen.tsx"));

  for (const [nombre, pantalla] of [
    ["hub", hub],
    ["carta completa", completa]
  ] as const) {
    assert.match(pantalla, /FALTA UNA PARTE DEL CÁLCULO/, nombre);
    assert.match(
      pantalla,
      /"Calcular de nuevo la parte que falta de tu carta"/,
      `${nombre}: la voz del botón también tiene que coincidir`
    );
    assert.match(
      pantalla,
      /"Calculando la parte que falta de tu carta"/,
      `${nombre}: en curso, la voz dice qué se está haciendo`
    );
    assert.match(pantalla, /estado\.phase === "parcial" && estado\.canRetry/, nombre);
    assert.match(pantalla, /disabled=\{refreshing\}/, `${nombre}: no se apilan pedidos`);
  }
});
