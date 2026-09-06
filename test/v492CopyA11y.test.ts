/**
 * Cierre editorial y de accesibilidad de las capas nativas V4.9.2.
 *
 * Estos gates son deliberadamente estructurales: no fijan la composición
 * visual completa, pero impiden que vuelvan el copy de trabajo, los topes de
 * Dynamic Type y las representaciones que confunden "sin dato" con un valor.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

import { transitHeadline, transitShortTitle } from "../src/domain/layers";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function archivosTs(dir: string): string[] {
  const salida: string[] = [];
  const raiz = join(ROOT, dir);
  if (!statSync(raiz).isDirectory()) return salida;
  (function recorrer(actual: string) {
    for (const nombre of readdirSync(actual)) {
      const absoluto = join(actual, nombre);
      if (statSync(absoluto).isDirectory()) recorrer(absoluto);
      else if (/\.tsx?$/.test(nombre)) salida.push(relative(ROOT, absoluto));
    }
  })(raiz);
  return salida;
}

const SUPERFICIES_V492 = [
  ...archivosTs("src/components/v492"),
  ...archivosTs("src/screens/v492"),
  "src/domain/layers.ts",
  // La capa editorial escribe texto que se lee en pantalla, así que entra al
  // mismo gate que las pantallas: es donde vive el copy, no una utilidad.
  "src/domain/layerMeaning.ts",
  // Y la jerarquía de lectura de los cuatro ritmos de `Tu momento`, por lo
  // mismo: es el texto de cuatro detalles enteros.
  "src/domain/layerReading.ts",
  // Y lo mismo los dos modelos que escriben texto visible: el aviso de frescura
  // y los rótulos y el anuncio de la línea de tiempo.
  "src/domain/layerFreshness.ts",
  "src/domain/transitDetail.ts"
] as const;

test("las capas V4.9.2 no muestran notas internas ni copy descartado", () => {
  const prohibidas = [
    { patron: /módulo\s+queda\s+vacío/i, nombre: "módulo queda vacío" },
    { patron: /completarse\s+con\s+una\s+aproximación/i, nombre: "completarse con una aproximación" },
    { patron: /ciclo\s+de\s+la\s+Luna\s+de\s+hoy/i, nombre: "ciclo de la Luna de hoy" },
    { patron: /EDAD\s+USADA/i, nombre: "EDAD USADA" },
    { patron: /contrato\s+de\s+contenido/i, nombre: "contrato de contenido" },
    { patron: /cuántos\s+cae\s+en\s+cada\s+elemento/i, nombre: "cuántos cae" },
    { patron: /se\s+recalcula\s+(?:cada|todos\s+los)\s+días/i, nombre: "se recalcula cada día" }
  ];

  for (const rel of SUPERFICIES_V492) {
    const source = sinComentarios(leer(rel));
    for (const { patron, nombre } of prohibidas) {
      assert.doesNotMatch(source, patron, `${rel} todavía expone «${nombre}»`);
    }
  }
});

test("la precisión estimada usa una explicación neutral y no habla de contactos en todos los módulos", () => {
  const layers = sinComentarios(leer("src/domain/layers.ts"));
  const inicio = layers.indexOf('case "estimated"');
  const fin = layers.indexOf('case "range"', inicio);
  assert.ok(inicio >= 0 && fin > inicio, "precisionChip debe conservar el caso estimated");
  const estimated = layers.slice(inicio, fin);

  assert.doesNotMatch(
    estimated,
    /contacto/i,
    "una explicación compartida por carta, ciclos y tránsitos no puede asumir que el dato es un contacto"
  );
  assert.match(
    estimated,
    /Las fechas y valores son una aproximación calculada; pueden variar dentro del margen indicado\./,
    "la estimación compartida debe explicar el margen con lenguaje neutral"
  );
});

test("encabezados, acciones y texto secundario conservan semántica y Dynamic Type accesible", () => {
  const module = sinComentarios(leer("src/components/v492/Module.tsx"));
  const typography = sinComentarios(leer("src/components/v492/typography.tsx"));
  const tokens = sinComentarios(leer("src/components/v492/tokens.ts"));

  const headerStart = module.indexOf("export function ModuleHeader");
  const headerEnd = module.indexOf("export function LayerModule", headerStart);
  const header = module.slice(headerStart, headerEnd);
  assert.match(
    header,
    /accessibilityRole=["']header["']/,
    "VoiceOver debe anunciar cada ModuleHeader como encabezado"
  );

  const typeStart = tokens.indexOf("type:");
  const typeTokens = tokens.slice(typeStart);
  const labelSize = /label:\s*\{[^}]*size:\s*(\d+(?:\.\d+)?)/s.exec(typeTokens);
  assert.ok(labelSize, "la escala tipográfica debe declarar el tamaño de label");
  assert.ok(Number(labelSize[1]) >= 12, "los CTA que usan Label no pueden bajar de 12 px");

  for (const role of ["body", "small", "label"] as const) {
    const match = new RegExp(`${role}:\\s*\\{[^}]*maxScale:\\s*(\\d+(?:\\.\\d+)?)`, "s").exec(typeTokens);
    if (match) {
      assert.ok(
        Number(match[1]) >= 2,
        `${role}.maxScale no puede quedar capado a ${match[1]}: debe acompañar tamaños de accesibilidad`
      );
    }
  }
  assert.doesNotMatch(
    typography,
    /allowFontScaling=\{false\}|maxFontSizeMultiplier=\{(?:1\.[3-6]|[01])\}/,
    "Body, Note y Label no deben apagar ni recortar Dynamic Type en los tamaños habituales"
  );
});

test("DataRow puede reordenar rótulo y valor cuando el texto crece", () => {
  const module = sinComentarios(leer("src/components/v492/Module.tsx"));
  const dataRowStart = module.indexOf("export function DataRow");
  const dataRowEnd = module.indexOf("export function Chip", dataRowStart);
  const implementation = module.slice(dataRowStart, dataRowEnd);
  const stylesStart = module.indexOf("const styles");
  const styles = module.slice(stylesStart);

  const adaptativo = /useWindowDimensions|useFontScale|PixelRatio|getFontScale/.test(implementation);
  const apilado = /dataRow:\s*\{[^}]*flexDirection:\s*["']column["']/s.test(styles);
  const conReflujo =
    /dataRow:\s*\{[^}]*flexWrap:\s*["']wrap["']/s.test(styles) &&
    /dataValue:\s*\{[^}]*(?:flexBasis|minWidth|width):/s.test(styles);

  assert.ok(
    adaptativo || apilado || conReflujo,
    "DataRow necesita layout adaptativo, apilado o wrap con un mínimo para que el valor baje de línea"
  );
  assert.doesNotMatch(implementation, /numberOfLines=\{?1\}?/, "el dato no puede truncarse a una línea");
});

test("la columna del ordinal entra dos dígitos: 10 y 11 no se parten", () => {
  // El defecto del estado 03: la implementación lista 11 tránsitos reales y los
  // ordinales `10` y `11` se partían verticalmente —el `1` arriba, el `0`
  // abajo— porque la columna estaba fijada en `width: 14`.
  const card = sinComentarios(leer("src/components/v492/TransitCard.tsx"));
  const tokens = sinComentarios(leer("src/components/v492/tokens.ts"));

  // El tamaño real del rol `Mono`, del sistema tipográfico: la columna se
  // dimensiona contra ESTE número, no contra uno copiado a mano. Si mañana el
  // sistema sube a 14 px, este gate falla en vez de dejar el recorte.
  const small = /small:\s*\{[^}]*size:\s*(\d+(?:\.\d+)?)/s.exec(tokens.slice(tokens.indexOf("type:")));
  assert.ok(small, "la escala tipográfica debe declarar el tamaño de `small`");
  const fontSize = Number(small[1]);
  // Roboto Mono avanza 0,6 em por glifo: todos sus dígitos miden lo mismo.
  const AVANCE_MONO = 0.6;
  // La lista más larga que se midió en el simulador tiene 11 filas; el ancho lo
  // fija el ordinal más largo de esa lista.
  const FILAS = 11;
  const digitos = String(FILAS).length;
  assert.equal(digitos, 2, "con 11 filas el ordinal más largo tiene dos dígitos");
  const anchoNecesario = fontSize * AVANCE_MONO * digitos;

  const rank = /rank:\s*\{([^}]*)\}/s.exec(card)?.[1] ?? "";
  assert.ok(rank, "no se encontró el estilo de la columna del ordinal");
  assert.doesNotMatch(
    rank,
    /(?:^|[^n])\bwidth:\s*\d/,
    "un ancho FIJO recorta o parte el ordinal, y con Dynamic Type lo hace antes"
  );
  const minWidth = /minWidth:\s*(\d+(?:\.\d+)?)/.exec(rank);
  assert.ok(minWidth, "la columna necesita un piso que entre dos dígitos");
  assert.ok(
    Number(minWidth[1]) >= anchoNecesario,
    `la columna mide ${minWidth[1]} pt y ${FILAS} filas necesitan ${anchoNecesario.toFixed(1)} pt`
  );

  // Y aunque la columna crezca, el ordinal nunca envuelve.
  assert.match(card, /<Mono style=\{styles\.rank\} numberOfLines=\{1\}>/);
  // `Mono` tiene que propagar la prop: sin eso el `numberOfLines` de arriba no
  // llega al `Text` y el gate quedaría celebrando algo que no pasa.
  const typography = sinComentarios(leer("src/components/v492/typography.tsx"));
  const mono = /export function Mono\(\{[\s\S]*?\n\}/.exec(typography)?.[0] ?? "";
  assert.ok(mono, "no se encontró el componente Mono");
  assert.match(mono, /numberOfLines/, "Mono debe aceptar y propagar numberOfLines");
  assert.match(mono, /numberOfLines=\{numberOfLines\}/);
});

test("la cabecera del tránsito es simbólica y los nombres siguen enteros en la voz", () => {
  // La cabecera escribía `Mercurio □ tu Saturno`: dos nombres que la misma fila
  // ya repite en la frase del cálculo y una tercera vez en la etiqueta
  // accesible. Ahora son símbolos; los nombres NO pueden desaparecer con ellos.
  const card = sinComentarios(leer("src/components/v492/TransitCard.tsx"));

  const cabecera = card.slice(card.indexOf("styles.head"), card.indexOf("styles.meterRow"));
  assert.ok(cabecera.length > 0, "no se encontró la cabecera compacta");
  assert.doesNotMatch(
    cabecera,
    /<Body style=\{styles\.(planet|natal)\}/,
    "los nombres redundantes no vuelven a la cabecera"
  );
  assert.doesNotMatch(cabecera, /tu \$\{item\.natalPoint\}/, "«tu Saturno» sale de la cabecera, no de la voz");
  assert.match(cabecera, /<BodyMark name=\{item\.transitPlanet\}/);
  assert.match(cabecera, /<BodyMark name=\{item\.natalPoint\}/);
  assert.match(cabecera, /<AspectGlyph aspect=\{item\.aspect\}/);
  assert.match(cabecera, /<Mono style=\{styles\.orb\}>\{formatOrb\(item\.orbDegrees\)\}<\/Mono>/, "el orbe se queda");

  // Y junto a los símbolos, el título corto legible de QA22-008: la cabecera
  // simbólica sola no dejaba elegir un tránsito sin conocer los glifos.
  assert.match(cabecera, /<Body style=\{styles\.titulo\}>\{titulo\}<\/Body>/, "falta el título corto");
  assert.match(card, /const titulo = transitShortTitle\(item\);/, "y se compone en el dominio");

  // VoiceOver: la etiqueta de la fila abre con el titular COMPLETO, que es el
  // que nombra planeta, aspecto y punto natal.
  const voz = /const voz = \[[\s\S]*?\.join\(" "\);/.exec(card)?.[0] ?? "";
  assert.ok(voz, "no se encontró la etiqueta accesible de la fila");
  assert.match(card, /const headline = transitHeadline\(item\);/);
  assert.match(voz, /\$\{headline\}/, "la voz dice el titular completo, no un resumen");
  assert.match(voz, /resumen/, "y también la frase del cálculo, que vuelve a nombrarlos");
  assert.match(card, /accessibilityLabel=\{voz\}/);
  // El título corto NO entra en la voz: la etiqueta ya abre con el titular
  // completo y repetir la forma corta sería decir dos veces lo mismo.
  assert.ok(!voz.includes("titulo"), "la forma corta no se repite en la voz");

  // El titular sigue construyéndose con los nombres reales, y la forma corta es
  // el mismo dato sin la preposición ni el conector.
  assert.equal(
    transitHeadline({ transitPlanet: "Mercurio", aspect: "square", natalPoint: "Saturno" }),
    "Mercurio en cuadratura con tu Saturno"
  );
  assert.equal(
    transitShortTitle({ transitPlanet: "Mercurio", aspect: "square", natalPoint: "Saturno" }),
    "Mercurio cuadratura tu Saturno"
  );

  // Y la frase del cálculo —el otro portador visible del nombre— sigue saliendo
  // del sobre: `summaryWithCanonicalState` sólo pone al día su frase de etapa.
  assert.match(card, /const resumen = summaryWithCanonicalState\(item\.summary, estado\.state\);/);
  assert.match(card, /<Body style=\{styles\.summary\}>\{resumen\}<\/Body>/);
});

test("la fila del tránsito dice el criterio del cálculo, y nunca dos etiquetas que se contradigan", () => {
  // `ORB-TRN-002` publica `rankingReason` por fila —`Exacto hoy`, `Pico mañana`,
  // `Activo hasta el 5 de abril`—: es POR QUÉ la lista la puso donde la puso. La
  // fila derivaba su propia etiqueta de fecha en el mismo lugar, así que podían
  // aparecer las dos y decir cosas distintas del mismo dato.
  const card = sinComentarios(leer("src/components/v492/TransitCard.tsx"));

  // Una sola etiqueta, con el criterio del sobre primero y la derivada de
  // respaldo. El `??` es lo que garantiza que nunca se dibujen las dos.
  assert.match(
    card,
    /const motivo = rankingReasonLabel\(item\.rankingReason\) \?\? picoLabel\(item, nowMs, timezone\);/,
    "el criterio del cálculo manda; la fecha derivada es el respaldo"
  );

  // Y la derivada se usa exactamente ahí: en ningún otro lado de la fila. Se
  // cuentan las LLAMADAS, no su declaración.
  const usos = card.match(/(?<!function )picoLabel\(/g) ?? [];
  assert.equal(usos.length, 1, "la etiqueta derivada sólo puede entrar como respaldo");

  // Lo que se dibuja y lo que se dice son el mismo valor: si la línea visible y
  // la voz salieran de fuentes distintas, VoiceOver podría afirmar otra cosa.
  assert.match(card, /motivo \? motivo\.toLocaleUpperCase\("es"\) : null/, "la línea de metadatos usa el motivo");
  const voz = /const voz = \[[\s\S]*?\.join\(" "\);/.exec(card)?.[0] ?? "";
  assert.ok(voz, "no se encontró la etiqueta accesible de la fila");
  assert.match(voz, /motivo \? `\$\{motivo\}\.` : null/, "y la voz dice exactamente lo mismo");
  assert.ok(!voz.includes("picoLabel"), "la voz no puede derivar su propia versión");

  // El criterio se lee defensivamente: un sobre guardado antes del cambio de
  // contrato no lo trae, y la palabra `undefined` al lado del orbe sería peor
  // que la etiqueta derivada.
  const lector = /function rankingReasonLabel\(value: unknown\): string \| null \{[\s\S]*?\n\}/.exec(card)?.[0] ?? "";
  assert.ok(lector, "no se encontró el lector del criterio");
  assert.match(lector, /typeof value !== "string"/, "un campo ausente no es un texto");
  assert.match(lector, /limpio\.length > 0 \? limpio : null/, "una frase vacía tampoco dice nada");

  // La casa sale del MISMO sobre del ranking, que ya la publica por fila.
  assert.match(card, /item\.natalHouse !== null \? `CASA \$\{item\.natalHouse\}` : null/);
});

test("la notación del tránsito entra en un renglón, crece con Dynamic Type y deja el orbe a la derecha", () => {
  const card = sinComentarios(leer("src/components/v492/TransitCard.tsx"));

  const shorthand = /shorthand:\s*\{([^}]*)\}/s.exec(card)?.[1] ?? "";
  assert.ok(shorthand, "no se encontró el estilo de la notación compacta");
  assert.doesNotMatch(shorthand, /flexWrap/, "la notación es UNA línea: con wrap los símbolos bajan de renglón");
  assert.match(shorthand, /flex:\s*1/, "la notación toma el ancho libre y empuja el orbe contra el borde");

  const orb = /\borb:\s*\{([^}]*)\}/s.exec(card)?.[1] ?? "";
  assert.ok(orb, "no se encontró el estilo del orbe");
  assert.match(orb, /flexShrink:\s*0/, "el orbe no se comprime");
  assert.match(orb, /textAlign:\s*"right"/);

  // Un <Svg> no tiene línea base de texto: alinear por ella deja los símbolos
  // colgando respecto del ordinal y del orbe.
  const head = /\bhead:\s*\{([^}]*)\}/s.exec(card)?.[1] ?? "";
  assert.ok(head, "no se encontró el estilo de la cabecera");
  assert.match(head, /alignItems:\s*"center"/);

  // Y el glifo no queda en puntos fijos mientras el texto de al lado crece: se
  // escala con el MISMO tope que el rol `Mono` de esa línea.
  assert.match(card, /PixelRatio\.getFontScale\(\)/, "el lado del glifo sale del ajuste tipográfico");
  assert.match(card, /v492\.type\.small\.maxScale/, "con el tope del rol Mono que tiene al lado");
  assert.match(card, /<AstroGlyph symbol=\{symbol\} size=\{size\}/);
  assert.match(card, /<AspectGlyph aspect=\{item\.aspect\} size=\{glifo\}/, "los tres símbolos escalan juntos");
});

test("el mandala dibuja sólo ritmos disponibles pero describe los cuatro del contrato", () => {
  const dials = sinComentarios(leer("src/components/v492/Dials.tsx"));
  const start = dials.indexOf("export function TemporalMandalaDial");
  const end = dials.indexOf("function mandalaLabel", start);
  const mandala = dials.slice(start, end);
  const geometria = sinComentarios(leer("src/components/v492/mandalaGeometry.ts"));
  const screen = sinComentarios(leer("src/screens/v492/TransitosLayersScreen.tsx"));

  // La selección de anillos vive en UNA sola función pura, y filtra por
  // `available`: un ritmo sin cálculo no ocupa anillo. Antes el filtro estaba
  // dentro del componente y exigía ADEMÁS un avance ubicable, así que el disco
  // dibujaba menos anillos que los que la lista declaraba disponibles.
  assert.match(mandala, /mandalaDrawnRings\(rings, size\)/);
  assert.match(
    geometria,
    /\.filter\(\(anillo\)\s*=>\s*anillo\.ring\.available/,
    "un ritmo no disponible no debe ocupar un anillo en el dibujo"
  );
  assert.doesNotMatch(
    mandala,
    /strokeDasharray=\{ring\.available\s*\?/,
    "la ausencia se explica en texto, no con un anillo que parece un valor"
  );
  // La etiqueta recibe el recuento ya calculado por la misma función que dibuja.
  assert.match(mandala, /accessibilityLabel=\{mandalaLabel\(rings,\s*anillos\.length\)\}/);
  assert.doesNotMatch(
    dials.slice(dials.indexOf("function mandalaLabel")),
    /rings\.filter\(\(ring\)\s*=>\s*ring\.progressMode\s*!==\s*"unavailable"\)\.length/,
    "la etiqueta no puede recontar por su cuenta: ahí nacía la divergencia con el SVG"
  );
  assert.match(
    screen,
    /data\.rings\.map\(\(ring\)\s*=>/,
    "la lista textual debe conservar los cuatro ritmos aunque el disco dibuje menos"
  );
});

test("la trazabilidad deduplica fuentes además de limitaciones", () => {
  const trace = sinComentarios(leer("src/components/v492/Trace.tsx"));
  assert.match(trace, /uniqueLines\(envelope\.limitations\)/);
  const helper =
    /const\s+\w+\s*=\s*(?:unique|dedup)\w*\(\s*envelope\.sourceRefs\s*\)/i.test(trace);
  const mapa =
    /const\s+\w+\s*=\s*\[\s*\.\.\.\s*new\s+Map\(\s*envelope\.sourceRefs\.map\(/i.test(trace);
  const filtro =
    /const\s+\w+\s*=\s*envelope\.sourceRefs\.(?:filter|reduce)\(/i.test(trace);
  assert.ok(helper || mapa || filtro, "sourceRefs necesita una deduplicación explícita antes de renderizarse");
  assert.doesNotMatch(
    trace,
    /envelope\.sourceRefs\.map\(/,
    "el acordeón no debe renderizar directamente una lista de fuentes que puede venir repetida"
  );
});

test("Tipo lunar y Mapa elemental conservan el lenguaje editorial canónico", () => {
  const lunar = sinComentarios(leer("src/screens/v492/TipoLunarDetailScreen.tsx"));
  const elemental = sinComentarios(leer("src/screens/v492/MapaElementalDetailScreen.tsx"));

  for (const copy of [
    /CÓMO PUEDE APARECER EN VOS/,
    /Estas son tendencias posibles, no rasgos fijos\./,
    /AL EMPEZAR/,
    /ANTE UN OBSTÁCULO/,
    /AL CERRAR/
  ]) {
    assert.match(lunar, copy);
  }

  for (const copy of [/CUANDO SE SATURA/, /PARA EQUILIBRAR/, /POR QUÉ NO HAY PORCENTAJES/]) {
    assert.match(elemental, copy);
  }
  assert.match(
    elemental,
    /El método cuenta únicamente las diez posiciones de Sol a Plutón,\s*todas con el mismo peso\.\s*No incluye Ascendente, casas, nodos ni asteroides\./,
    "el método elemental excluye esos puntos por definición, no por falta de hora"
  );
});

test("Hoy y Tránsitos explican cuándo se renuevan los datos sin copy de implementación", () => {
  for (const rel of [
    "src/screens/v492/HoyScreen.tsx",
    "src/screens/v492/TransitosLayersScreen.tsx"
  ]) {
    const source = sinComentarios(leer(rel));
    assert.match(source, /(?:actualiza|renueva)[\s\S]{0,100}(?:abrir|abrís)/i, `${rel}: falta explicar la apertura`);
    assert.match(
      source,
      /(?:actualiza|renueva)[\s\S]{0,180}(?:volvés|retom(?:ar|ás)|vuelve\s+al\s+frente)/i,
      `${rel}: falta explicar la actualización al retomar la app`
    );
    assert.doesNotMatch(source, /se\s+recalcula\s+(?:cada|todos\s+los)\s+días/i);
  }
});

test("LayerScreen recupera marca y fecha sin repetir un título de portada", () => {
  const screen = sinComentarios(leer("src/components/v492/Screen.tsx"));
  assert.match(screen, />\s*Órbita\s*</, "el encabezado editorial debe recuperar la marca");
  assert.match(screen, /<Eyebrow[^>]*>\{eyebrow\}<\/Eyebrow>/, "el rótulo de sección sigue visible");
  assert.match(screen, /<Mono[^>]*>\{meta\}<\/Mono>/, "la fecha acompaña a la marca en el encabezado");
  assert.doesNotMatch(
    screen,
    /<(?:Display|Title|Subtitle)[^>]*>\{title\}<\/(?:Display|Title|Subtitle)>/,
    "Hoy/Tránsitos no deben duplicar la navegación con un titular enorme"
  );
});

test("los bloques de Hoy no dicen dos veces lo mismo: cada pieza anuncia lo suyo", () => {
  // El defecto, medido sobre el árbol de accesibilidad del bundle en curso: la
  // Luna anunciaba `data.summary` en la etiqueta compuesta del hero y otra vez
  // en el `Body` de abajo, y el Cumpleluna repartía summary y reloj del ciclo
  // entre la voz del head, el `Body` y la barra. VoiceOver leía el mismo párrafo
  // dos veces seguidas, y el mismo "día 12 de 29,5", tres.
  const hoy = sinComentarios(leer("src/screens/v492/HoyScreen.tsx"));

  // La Luna: el hero anuncia lo que DIBUJA —signo, fase, iluminación, casa— y
  // el resumen lo dice el `Body`, que ya es su propio elemento accesible.
  const luna = hoy.slice(hoy.indexOf("function LunaBloque"), hoy.indexOf("function CumplelunaBloque"));
  assert.ok(luna.length > 0, "no se encontró el bloque de la Luna");
  const vozLuna = /const voz = \[[\s\S]*?\.join\(" "\);/.exec(luna)?.[0] ?? "";
  assert.ok(vozLuna, "no se encontró la etiqueta compuesta del hero");
  assert.ok(
    !vozLuna.includes("data.summary"),
    "el hero no puede repetir el resumen que el Body ya anuncia por su cuenta"
  );
  assert.match(vozLuna, /data\.sign/, "pero sí dice lo que el hero dibuja");
  assert.match(vozLuna, /data\.phaseName/);
  assert.match(luna, /accessibilityLabel=\{voz\}/);
  assert.equal(
    (luna.match(/data\.summary/g) ?? []).length,
    1,
    "el resumen de la Luna aparece una sola vez, y es el texto visible"
  );
  assert.match(luna, /<Body style=\{styles\.summary\}>\{data\.summary\}<\/Body>/);

  // El Cumpleluna reparte: `Body` → resumen, head → el evento, barra → el día.
  const cumple = hoy.slice(hoy.indexOf("function CumplelunaBloque"), hoy.indexOf("function cumplelunaCuando"));
  assert.ok(cumple.length > 0, "no se encontró el bloque del Cumpleluna");
  const inicioVoz = cumple.indexOf("const voz =");
  assert.ok(inicioVoz > 0, "no se encontró la etiqueta accesible del head");
  const vozCumple = cumple.slice(inicioVoz, cumple.indexOf("return (", inicioVoz));
  assert.ok(!vozCumple.includes("data.summary"), "el head no repite el resumen: lo dice el Body de arriba");
  assert.ok(!vozCumple.includes("cycleClock"), "ni el reloj del ciclo: lo dice la barra");
  assert.match(vozCumple, /cumplelunaCuando\(hoy\)|view\.nextWhen/, "el head anuncia el evento, que es lo que imprime");

  assert.equal(
    (cumple.match(/data\.summary/g) ?? []).length,
    1,
    "el resumen del Cumpleluna aparece una sola vez, y es el texto visible"
  );
  assert.match(cumple, /<Body style=\{styles\.intro\}>\{data\.summary\}<\/Body>/);
  assert.match(
    cumple,
    /<MeterBar[\s\S]{0,320}?accessibilityLabel=\{`Tu ciclo personal: \$\{view\.cycleClock/,
    "la barra es la que anuncia el día y el avance del ciclo"
  );

  // La fila de metadatos dibuja el pie de la barra —el mismo reloj en mayúscula,
  // la hora que el head ya dijo y el nombre de la capa— así que se ve y no se
  // vuelve a leer. Sin esto, el reloj del ciclo se anuncia dos veces igual.
  const meta = cumple.indexOf("<MetaRow");
  assert.ok(meta > 0, "el pie de la barra sigue dibujándose");
  assert.match(
    cumple.slice(Math.max(0, meta - 220), meta),
    /accessibilityElementsHidden[\s\S]{0,120}no-hide-descendants/,
    "el pie visible de la barra no puede volver a anunciar lo que la barra ya dijo"
  );
});

test("el ranking de Hoy explica el orden real: exactos hoy, cercanos y después el resto", () => {
  // El intro decía sólo "cercanía al punto exacto", que era el orden viejo. El
  // ranking v2 pone adelante lo que se hace exacto HOY, después lo que cruza su
  // punto exacto cerca —antes o después— y recién ahí el resto de lo activo.
  const hoy = sinComentarios(leer("src/screens/v492/HoyScreen.tsx"));
  const bloque = hoy.slice(hoy.indexOf('key: "ranking"'), hoy.indexOf('key: "luna"'));
  assert.ok(bloque.length > 0, "no se encontró el bloque del ranking");

  const intro = /intro:\s*"([^"]+)"/.exec(bloque)?.[1] ?? "";
  assert.ok(intro, "el bloque del ranking conserva su intro");
  assert.match(intro, /exactos hoy/i, "el primer criterio es el contacto que se hace exacto hoy");
  assert.match(
    intro,
    /(?:próximos|acaban de pasarlo|recientes)/i,
    "el segundo son los que cruzan su punto exacto cerca, antes o después"
  );
  assert.match(intro, /(?:el resto|los demás)/i, "y al final el resto de los que siguen activos");
  assert.doesNotMatch(
    intro,
    /ordenados por cercanía al punto exacto/i,
    "ése era el orden viejo: la cercanía sola ya no explica por qué la lista quedó así"
  );
});
