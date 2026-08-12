/**
 * Alta lista para lanzar (PR 5).
 *
 * El bloque 1 es el que importa de verdad: en web la rueda MOSTRABA una fecha y
 * el flujo guardaba otra. Todo lo demás de esta tanda es composición y
 * alcanzabilidad; esto es integridad de un dato personal.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  dateValueToParts,
  isRealDateParts,
  partsToDateValue,
  partsToTimeValue,
  timeValueToParts
} from "../src/domain/birthInput";

const ROOT = join(import.meta.dirname, "..");
const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// --- 1. Lo que se VE es lo que se guarda ------------------------------------

test("las partes del alta y el valor del control son el MISMO dato", () => {
  // El caso reportado, exacto: el estado decía 15 de enero de 1996 y la rueda
  // web dibujaba 1 de enero de 2014, que era la primera fila de cada columna.
  assert.equal(partsToDateValue({ day: 15, month: 1, year: 1996 }), "1996-01-15");
  assert.notEqual(partsToDateValue({ day: 15, month: 1, year: 1996 }), "2014-01-01");
  assert.deepEqual(dateValueToParts("1996-01-15"), { day: 15, month: 1, year: 1996 });

  // Ida y vuelta sin pérdida, que es lo que garantiza la paridad.
  for (const parts of [
    { day: 1, month: 1, year: 1925 },
    { day: 29, month: 2, year: 2000 },
    { day: 31, month: 12, year: 2014 },
    { day: 9, month: 8, year: 1978 }
  ]) {
    const shown = partsToDateValue(parts);
    assert.ok(shown, `${JSON.stringify(parts)} es una fecha real`);
    assert.deepEqual(dateValueToParts(shown), parts, "lo mostrado tiene que volver a las mismas partes");
  }
});

test("la hora del alta y el valor del control son el MISMO dato", () => {
  // El caso reportado: se veía 00:00 y la confirmación usaba 12:00.
  assert.equal(partsToTimeValue({ hour: 12, minute: 0 }), "12:00");
  assert.notEqual(partsToTimeValue({ hour: 12, minute: 0 }), "00:00");
  assert.deepEqual(timeValueToParts("12:00"), { hour: 12, minute: 0 });
  for (const parts of [
    { hour: 0, minute: 0 },
    { hour: 23, minute: 59 },
    { hour: 7, minute: 5 }
  ]) {
    const shown = partsToTimeValue(parts);
    assert.ok(shown);
    assert.deepEqual(timeValueToParts(shown), parts);
  }
});

test("un día que no existe no produce un valor mostrable", () => {
  for (const parts of [
    { day: 31, month: 2, year: 1990 },
    { day: 29, month: 2, year: 1999 },
    { day: 31, month: 4, year: 2000 },
    { day: 0, month: 1, year: 1990 },
    { day: 1, month: 13, year: 1990 }
  ]) {
    assert.equal(isRealDateParts(parts), false, `${JSON.stringify(parts)} no existe`);
    // `null` y no una fecha corrida: el control queda vacío y la pantalla puede
    // bloquear "Continuar" en vez de guardar un 3 de marzo por un 31 de febrero.
    assert.equal(partsToDateValue(parts), null);
  }
  assert.equal(isRealDateParts({ day: 29, month: 2, year: 2000 }), true, "2000 sí fue bisiesto");
});

test("una hora imposible tampoco produce valor", () => {
  assert.equal(partsToTimeValue({ hour: 24, minute: 0 }), null);
  assert.equal(partsToTimeValue({ hour: 0, minute: 60 }), null);
  assert.equal(timeValueToParts("24:00"), null);
});

// --- 2. El cableado de los dos pasos ----------------------------------------

test("la web usa una rueda propia y branded, nunca el popup del sistema", () => {
  const web = sinComentarios(leer("src/onboarding/components/BirthPicker.web.tsx"));
  // Ningún control nativo: `<input type="date">` abre el calendario gris del
  // sistema operativo en el medio de una pantalla cósmica.
  assert.doesNotMatch(web, /type: "date"/, "no puede volver el popup del sistema");
  assert.doesNotMatch(web, /type: "time"/, "no puede volver el popup del sistema");
  assert.doesNotMatch(web, /"input"/, "el alta no monta inputs nativos de fecha/hora");
  // Semántica de listbox: es lo que hace la rueda accesible.
  assert.match(web, /role: "listbox"/);
  assert.match(web, /role: "option"/);
  assert.match(web, /"aria-selected": i === clamped/);
  assert.match(web, /"aria-activedescendant"/);
  assert.match(web, /tabIndex: 0/, "cada columna entra en el orden de tabulación");
  assert.match(web, /"aria-label": label/, "y tiene nombre accesible");
});

test("la rueda web no depende de eventos que el navegador no emite", () => {
  const web = sinComentarios(leer("src/onboarding/components/BirthPicker.web.tsx"));
  // El bug original: `contentOffset` (inexistente en RNW) y momentum events
  // (que el navegador no emite). Acá la posición se CALCULA desde el índice.
  assert.doesNotMatch(web, /contentOffset|onMomentumScrollEnd|onScrollEndDrag/);
  assert.match(web, /const target = clamped \* ROW_H;/, "la posición sale del índice");
  assert.match(web, /node\.scrollTop = target/);
  // Y al frenar el scroll se confirma la fila más cercana: rueda de verdad,
  // con dedo y con mouse, sin depender de momentum.
  assert.match(web, /Math\.round\(node\.scrollTop \/ ROW_H\)/);
  assert.match(web, /setTimeout\(commitFromScroll, SETTLE_MS\)/);
});

test("teclado: flechas, Home/End y PageUp/PageDown mueven la rueda", () => {
  const web = sinComentarios(leer("src/onboarding/components/BirthPicker.web.tsx"));
  for (const key of ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"]) {
    assert.match(web, new RegExp(`${key}:`), `falta el manejo de ${key}`);
  }
  assert.match(web, /e\.preventDefault\(\);/, "las flechas no pueden scrollear la página");
});

test("todo camino de entrada emite las MISMAS partes del alta", () => {
  const web = sinComentarios(leer("src/onboarding/components/BirthPicker.web.tsx"));
  // Click, teclado y scroll pasan por el mismo `onChange(i)` de la columna, y
  // la pantalla lo traduce a las partes que usa el resto del flujo. Es lo que
  // garantiza que lo que se ve sea lo que se guarda.
  assert.match(web, /onChange\(\{ \.\.\.value, day: i \+ 1 \}\)/);
  assert.match(web, /onChange\(\{ \.\.\.value, month: i \+ 1 \}\)/);
  assert.match(web, /onChange\(\{ \.\.\.value, year: Number\(years\[i\]\) \}\)/);
  assert.match(web, /onChange\(\{ \.\.\.value, hour: i \}\)/);
  assert.match(web, /onChange\(\{ \.\.\.value, minute: i \}\)/);
  // El índice SIEMPRE viene del estado, nunca de la posición del scroll.
  assert.match(web, /index: value\.day - 1/);
  assert.match(web, /index: value\.hour/);
});

test("la rueda ya no se monta en web, y en nativo queda intacta", () => {
  // La rueda se posiciona con `contentOffset` y confirma con eventos de
  // momentum: en react-native-web no existe ninguno de los dos. Por eso el paso
  // web no puede volver a montarla.
  for (const rel of ["src/onboarding/screens/BirthdateScreen.tsx", "src/onboarding/screens/BirthTimeScreen.tsx"]) {
    const codigo = sinComentarios(leer(rel));
    assert.doesNotMatch(codigo, /from "\.\.\/components\/Wheel"/, `${rel} no puede montar la rueda directamente`);
    assert.match(codigo, /from "\.\.\/components\/BirthPicker"/, `${rel} monta el picker con split de plataforma`);
  }
  // Nativo: la misma rueda, con los mismos anchos de columna de siempre.
  const nativo = sinComentarios(leer("src/onboarding/components/BirthPicker.tsx"));
  assert.match(nativo, /from "\.\/Wheel"/);
  assert.match(nativo, /width=\{64\}/, "día");
  assert.match(nativo, /width=\{150\}/, "mes");
  assert.match(nativo, /width=\{84\}/, "año / hora / minuto");
  // Y existe el archivo por plataforma que Metro resuelve en web.
  assert.ok(statSync(join(ROOT, "src/onboarding/components/BirthPicker.web.tsx")).size > 0);
});

test("«No sé la hora» no deja una hora visible que nadie eligió", () => {
  const web = sinComentarios(leer("src/onboarding/components/BirthPicker.web.tsx"));
  assert.match(web, /if \(unknown\) return null;/, "en web el control se desmonta");
  const nativo = sinComentarios(leer("src/onboarding/components/BirthPicker.tsx"));
  assert.match(nativo, /unknown && styles\.dimmed/, "en nativo la rueda se atenúa, como siempre");
  assert.match(nativo, /pointerEvents=\{unknown \? "none" : "auto"\}/);
  // El interruptor se anuncia como tal y dice en qué estado está.
  const paso = sinComentarios(leer("src/onboarding/screens/BirthTimeScreen.tsx"));
  assert.match(paso, /accessibilityRole="switch"/);
  assert.match(paso, /accessibilityState=\{\{ checked: unknown \}\}/);
  assert.match(paso, /accessibilityLabel="No sé la hora"/);
});

test("una fecha imposible o futura bloquea Continuar y se dice por qué", () => {
  const paso = sinComentarios(leer("src/onboarding/screens/BirthdateScreen.tsx"));
  assert.match(paso, /const real = isRealDateParts\(value\);/);
  // El `max` del control nativo se fue con el control nativo: la regla sigue.
  assert.match(paso, /const future = isFutureDateParts\(value, new Date\(\)\);/);
  assert.match(paso, /const usable = real && !future;/);
  assert.match(paso, /disabled=\{!usable\}/, "no se confirma un día que no existe ni uno que no llegó");
  assert.match(paso, /accessibilityRole="alert"/, "y se anuncia");
  // La columna de años tampoco ofrece el futuro.
  const web = sinComentarios(leer("src/onboarding/components/BirthPicker.web.tsx"));
  assert.match(web, /const top = today\.getFullYear\(\);/, "los años cortan en el año actual");
});

// --- 3. Composición responsive del alta -------------------------------------

test("el alta compone su propio escenario, no una columna de la app", () => {
  // El alta dejó de usar el lienzo: sus quince pasos son pantallas
  // cinematográficas, no columnas de texto. En escritorio montan una escena
  // centrada o dos columnas; en móvil las dos colapsan a la columna de siempre.
  const shell = sinComentarios(leer("src/onboarding/components/Screen.tsx"));
  assert.doesNotMatch(shell, /ContentCanvas/, "el alta no monta el lienzo de la app");
  assert.match(shell, /export type ScreenLayout =/);
  assert.match(shell, /const STAGE_MAX = 1200;/, "el escenario de escritorio es ancho de verdad");
  assert.match(shell, /const COPY_COLUMN = 520;/, "y el copy queda en medida legible");
});

test("el tope del lienzo se centra con alignSelf, no con alignItems del padre", () => {
  // `alignItems: "center"` sobre un hijo que declara `width: "100%"` deja el
  // ancho a merced de cómo el motor cruce alineación y porcentaje; en
  // react-native-web esa combinación colapsaba la columna y el alta de
  // escritorio salía como una tira angosta con el texto cortado.
  const canvas = sinComentarios(leer("src/components/orbita/ContentCanvas.tsx"));
  assert.match(canvas, /canvas: \{ alignSelf: "center", width: "100%" \}/);
  assert.match(canvas, /outer: \{ width: "100%" \}/);
});

test("Splash y Align componen sin leer el viewport", () => {
  // El breakpoint del alta es implícito: debajo de 480 la variante es ancho
  // completo, así que el móvil queda idéntico sin ninguna rama por ancho.
  for (const rel of ["src/onboarding/screens/SplashScreen.tsx", "src/onboarding/screens/AlignScreen.tsx"]) {
    const codigo = sinComentarios(leer(rel));
    assert.doesNotMatch(codigo, /useWindowDimensions|Dimensions\.get|window\.inner/, `${rel} no puede medir la ventana`);
    assert.match(codigo, /<Screen[\s>]/, `${rel} monta el shell que aplica el lienzo`);
  }
});

test("los mosaicos de Align se encogen con su columna y recortan la imagen", () => {
  // Regresión de escritorio: a 1224px el lienzo del alta quedaba centrado en
  // 480, pero la columna derecha crecía hasta el ancho INTRÍNSECO del asset
  // (1024px) y se salía por el borde derecho de la ventana.
  const align = sinComentarios(leer("src/onboarding/screens/AlignScreen.tsx"));

  // En CSS un item flex arranca con `min-width: auto`: no baja de la medida
  // intrínseca de su contenido. Sin esto la columna no puede encogerse.
  assert.match(align, /col: \{ flex: 1, minWidth: 0 \}/, "las columnas tienen que poder encogerse");

  // El mosaico se ata al ancho de SU columna y recorta lo que sobre.
  assert.match(align, /tile: \{ borderRadius: 16, overflow: "hidden", width: "100%" \}/);
  // Grilla PAREJA: cuatro mosaicos del mismo alto, sin escalonado accidental.
  assert.match(align, /const TILE_H = 190;/, "un solo alto para los cuatro");
  assert.doesNotMatch(align, /COL_OFFSET/, "el desfase que leía como error no puede volver");
  // Y la etiqueta va ADENTRO, no en una píldora colgando del borde.
  assert.doesNotMatch(align, /pill:|pillTxt:/, "las píldoras flotantes no pueden volver");
  // La fila de etiqueta (glifo vectorial opcional + texto) va anclada al pie.
  assert.match(align, /tileLabelRow: \{[\s\S]*?position: "absolute"/, "la etiqueta vive dentro del mosaico");
  assert.match(align, /<LinearGradient/, "con degradé de legibilidad debajo");

  // Y el `imageStyle` propio pisa el sizing por defecto de react-native-web:
  // sin width/height/resizeMode explícitos el <img> se va a su tamaño natural.
  // Es el mismo bug ya documentado en `components/Screen.tsx` para el fondo.
  assert.match(align, /tileImg: \{ borderRadius: 16, height: "100%", resizeMode: "cover", width: "100%" \}/);
});

test("la grilla de Align se adapta al alto disponible y nunca pasa su alto natural", () => {
  // Con altos fijos (188/202/208/182) la columna medía ~426px y no entraba en
  // un viewport bajo: se comía el pie y el CTA quedaba fuera.
  const align = sinComentarios(leer("src/onboarding/screens/AlignScreen.tsx"));
  assert.match(align, /onLayout=\{\(e\) => \{/, "la zona de la grilla se mide");
  assert.match(align, /Math\.min\(available, NATURAL_H\)/, "con espacio de sobra no se estira");
  assert.match(align, /const scale = h \/ NATURAL_H;/, "el escalonado del Figma se mantiene como proporción");
  assert.doesNotMatch(align, /h=\{188\}/, "los altos ya no son píxeles fijos");
});

const SPLIT_SCREENS = [
  "src/onboarding/screens/AlignScreen.tsx",
  "src/onboarding/screens/BirthdateScreen.tsx",
  "src/onboarding/screens/BirthTimeScreen.tsx"
];

test("la pieza visual se monta UNA vez, y en móvil en su lugar del flujo", () => {
  // El bug: el shell renderizaba `{column}{aside}`, así que en móvil la grilla
  // de Align y los pickers caían DESPUÉS de la nota y del CTA, dejando un hueco
  // vacío donde tenían que estar. Y montar la pieza dos veces —una inline y
  // otra en el aside— sería peor: dos controles con el mismo nombre accesible
  // para el mismo dato.
  const shell = sinComentarios(leer("src/onboarding/components/Screen.tsx"));
  assert.match(shell, /export function useSplitSlot/, "hace falta el slot que garantiza un solo montaje");
  assert.match(
    shell,
    /return desktop \? \{ inline: null, aside: node \} : \{ inline: node, aside: undefined \};/,
    "inline y aside son mutuamente excluyentes"
  );
  // Fuera de la composición de dos columnas el shell IGNORA `aside`: no puede
  // volver a colgarlo al final de la columna.
  assert.doesNotMatch(shell, /asideStacked/, "el aside apilado al final es exactamente el bug");
  assert.match(shell, /\) : \(\s*column\s*\)/, "sin split, sólo la columna");

  for (const rel of SPLIT_SCREENS) {
    const codigo = sinComentarios(leer(rel));
    assert.match(codigo, /const \{ inline, aside \} = useSplitSlot\(/, `${rel} tiene que usar el slot`);
    assert.match(codigo, /aside=\{aside\}/, `${rel} pasa el aside del slot, no un nodo suelto`);
    assert.match(codigo, /\{inline\}|\{inline \?/, `${rel} tiene que renderizar la pieza en el flujo`);
  }
});

test("el orden móvil de cada paso es el original", () => {
  // El orden del DOM ES el orden de lectura y de tabulación: se verifica por
  // posición en el archivo, no por estilos.
  const orden = (rel: string, hitos: string[]) => {
    const codigo = sinComentarios(leer(rel));
    let prev = -1;
    for (const hito of hitos) {
      const i = codigo.indexOf(hito);
      assert.ok(i > 0, `${rel}: falta ${hito}`);
      assert.ok(i > prev, `${rel}: ${hito} quedó fuera de orden`);
      prev = i;
    }
  };
  // Align: header → título → subtítulo → grilla → nota → CTA.
  orden("src/onboarding/screens/AlignScreen.tsx", [
    "<Header step={1}", "<Title", "<Body", "<View style={styles.gridZone}>{inline}", "<Caption", "<CTA"
  ]);
  // Fecha: header → título → subtítulo → error → picker → privacidad → CTA.
  orden("src/onboarding/screens/BirthdateScreen.tsx", [
    "<Header step={step}", "<Title", "<Body style={styles.sub}", "accessibilityRole=\"alert\"", "{inline}", "<Caption", "<CTA"
  ]);
  // Hora: header → título → subtítulo → picker → "No sé la hora" → nota → CTA.
  orden("src/onboarding/screens/BirthTimeScreen.tsx", [
    "<Header step={step}", "<Title", "<Body style={styles.sub}", "{inline}", "<Pressable", "<Caption", "<CTA"
  ]);
});

test("la escena centrada se CENTRA; la de dos columnas no", () => {
  // El defecto: `columnDesktop` sólo tenía `maxWidth`, así que la columna de
  // 520 quedaba pegada al borde izquierdo de los 1240 y dejaba media pantalla
  // muerta. Medido a 1440: la columna quedaba en x=172 en vez de centrada.
  const shell = sinComentarios(leer("src/onboarding/components/Screen.tsx"));
  assert.match(shell, /desktop && layout === "stage" && styles\.columnCentered/, "la escena centrada se centra");
  assert.match(shell, /columnCentered: \{ alignSelf: "center", maxWidth: STAGE_COLUMN \}/);
  // Y en `split` NO se centra: ahí la columna es la mitad izquierda.
  assert.doesNotMatch(shell, /columnDesktop: \{[^}]*alignSelf/, "la columna de dos columnas no puede centrarse");
});

test("los contenedores flex pueden encogerse para acotar un scroll interno", () => {
  // En CSS un item flex arranca en `min-height: auto` y no baja de su
  // contenido: con un ScrollView adentro, el contenedor crecía en vez de
  // acotarlo y el CTA anclado al pie quedaba fuera del viewport.
  const shell = sinComentarios(leer("src/onboarding/components/Screen.tsx"));
  assert.match(shell, /stage: \{ flex: 1, minHeight: 0, width: "100%" \}/);
  assert.match(shell, /column: \{ flex: 1, minHeight: 0, width: "100%" \}/);
  const denso = sinComentarios(leer("src/onboarding/screens/BeforeAfterScreen.tsx"));
  assert.match(denso, /body: \{ flex: 1, minHeight: 0/);
  assert.match(denso, /scroll: \{ flex: 1, minHeight: 0 \}/);
});

test("la entrada compone de verdad en escritorio", () => {
  // El defecto: post-intro, a 1440x900 la marca quedaba diminuta y centrada con
  // media pantalla muerta — una captura de teléfono en un monitor.
  const splash = sinComentarios(leer("src/onboarding/screens/SplashScreen.tsx"));
  assert.match(splash, /layout=\{desktop \? "scene" : "stage"\}/, "en escritorio la pantalla compone el escenario entero");
  assert.match(splash, /bodyDesktop: \{ justifyContent: "flex-end"/, "hero anclado abajo");
  assert.match(splash, /doorsDesktop: \{ alignItems: "flex-start", maxWidth: 340/, "CTA con ancho de botón, no de columna");
  // Y el móvil no cambia: sigue centrado con las puertas al pie.
  assert.match(splash, /hero: \{ alignItems: "center", flex: 1, justifyContent: "center" \}/);
});

test("la tipografía de la entrada no puede perder contra Tailwind", () => {
  // `StyleSheet.create` de react-native-web compila a CLASES atómicas, y el
  // `Text` compartido agrega `text-base` (16px/24px). Clase contra clase ganaba
  // Tailwind: el wordmark se dibujaba a 16px —no a 46 ni a 96— mientras
  // `textAlign`, que `text-base` no toca, sí se aplicaba. Un literal viaja en
  // el atributo `style` y gana siempre.
  const splash = sinComentarios(leer("src/onboarding/screens/SplashScreen.tsx"));
  assert.match(splash, /const WORDMARK = \{[\s\S]*?fontSize: 46/, "la marca es un literal, no una hoja registrada");
  assert.match(splash, /const WORDMARK_DESKTOP = \{ \.\.\.WORDMARK, fontSize: 96/);
  assert.match(splash, /style=\{desktop \? WORDMARK_DESKTOP : WORDMARK\}/);
  assert.match(splash, /style=\{desktop \? TAGLINE_DESKTOP : TAGLINE\}/);
  // Y ya no quedan en la hoja registrada, donde volverían a perder.
  assert.doesNotMatch(splash, /\n  wordmark: \{/, "el wordmark no puede volver a StyleSheet.create");
  assert.doesNotMatch(splash, /\n  tagline: \{/);
});

test("el intro del splash no puede desbordar el viewport", () => {
  // En web `expo-video` monta un `<video>` que se va a su tamaño intrínseco si
  // no se lo acota: a 1440x900 el intro tapaba las dos puertas y estiraba el
  // documento a 1216px de alto.
  const splash = sinComentarios(leer("src/onboarding/screens/SplashScreen.tsx"));
  assert.match(splash, /intro: \{ overflow: "hidden" \}/, "el overlay tiene que recortar");
  assert.match(splash, /introVideo: \{ height: "100%", left: 0, position: "absolute", top: 0, width: "100%" \}/);
  assert.match(splash, /style=\{styles\.introVideo\}/, "el video usa el estilo acotado, no sólo absoluteFill");
});

test("cada paso declara su composición de escritorio", () => {
  for (const rel of SPLIT_SCREENS) {
    assert.match(sinComentarios(leer(rel)), /layout="split"/, `${rel} no declara dos columnas`);
  }
  // Los pasos densos scrollean: sin eso un viewport de 320x568 esconde el CTA.
  for (const rel of [
    "src/onboarding/screens/BirthplaceSearchScreen.tsx",
    "src/onboarding/screens/BaseChartScreen.tsx",
    "src/onboarding/screens/SignInScreen.tsx",
    "src/onboarding/screens/SignUpGateScreen.tsx"
  ]) {
    assert.match(sinComentarios(leer(rel)), /<Screen[^>]*\sscroll/s, `${rel} tiene que poder scrollear`);
  }
  // Y las que YA tienen scroll propio no pueden recibir el del shell: anidar
  // los dos colapsa las alturas y manda el CTA fuera del viewport — medido a
  // 320x568, el CTA de Antes/Después terminaba 412px por debajo del pliegue.
  for (const rel of [
    "src/onboarding/screens/BeforeAfterScreen.tsx",
    "src/onboarding/screens/AccountScreen.tsx",
    "src/onboarding/screens/PaywallScreen.tsx"
  ]) {
    const codigo = sinComentarios(leer(rel));
    assert.match(codigo, /<ScrollView/, `${rel} maneja su propio scroll`);
    assert.doesNotMatch(codigo, /<Screen[^>]*\sscroll/s, `${rel} no puede anidar el scroll del shell`);
  }
});

test("la vista combinada es interna y de sólo lectura", () => {
  const preview = sinComentarios(leer("app/preview-alta.tsx"));
  // Cerrada en producción, como /studio, /lab y /backoffice.
  assert.match(preview, /if \(!INTERNAL_TOOLS_ENABLED\) return <Redirect href="\/" \/>;/);
  // Monta el alta REAL, no una copia que pueda divergir.
  assert.match(preview, /from "@\/onboarding\/OnboardingFlow"/);
  // Y entra por el MISMO camino de inspección que `debugStep`, que ya bloquea
  // borrador, cálculo, cuenta y persistencia.
  assert.match(preview, /inspectStep=\{step\}/);
  const flow = sinComentarios(leer("src/onboarding/OnboardingFlow.tsx"));
  assert.match(
    flow,
    /raw: inspectStep != null \? String\(inspectStep\) : params\.debugStep/,
    "la inspección no puede tener una segunda puerta sin los guards"
  );
  // El marco manda sobre el viewport: si no, un marco de 400 en una ventana de
  // 1440 mostraría escritorio y la revisión mentiría.
  assert.match(preview, /inspectWidth=\{size\.w\}/);
  const provider = sinComentarios(leer("src/components/web/web-layout-provider.tsx"));
  assert.match(provider, /const effective = width \?\? win\.width;/);
  // Y cubre la matriz de aceptación completa.
  for (const w of [320, 390, 400, 768, 900, 1024, 1440, 1920]) {
    assert.match(preview, new RegExp(`w: ${w},`), `falta el tamaño ${w} en la matriz`);
  }
});

test("«Guardá tu carta»: el sello es una pieza y la cuenta la crea Clerk", () => {
  const cuenta = sinComentarios(leer("src/onboarding/screens/AccountScreen.tsx"));
  // Escritorio: el sello en su propia columna.
  assert.match(cuenta, /layout=\{desktop \? "split" : "stage"\}/);
  assert.match(cuenta, /aside=\{[\s\S]*?styles\.seal/, "en escritorio el sello es la pieza");
  // Móvil: el arte del sobre baja a atmósfera y el sello sube como pieza
  // compacta arriba del título. A 0.9 era el FONDO del formulario.
  assert.match(cuenta, /bgOpacity=\{desktop \? 0\.55 : 0\.32\}/);
  assert.match(cuenta, /wash=\{desktop \? 0\.5 : 0\.74\}/);
  assert.match(cuenta, /\{desktop \? null : \(\s*<View style=\{styles\.sealMobile\}>/, "sello compacto en móvil");
  assert.match(cuenta, /sealMobile: \{[\s\S]*?height: 88,/, "compacto, no un fondo");
  // La cuenta la crea la UI OFICIAL de Clerk.
  assert.match(cuenta, /<ClerkSignUp email=\{email\} \/>/);
  assert.match(cuenta, /Guardá tu carta\./, "la copy del paso se conserva");
});

test("el alta NO tiene formulario propio ni pide nombre", () => {
  const cuenta = sinComentarios(leer("src/onboarding/screens/AccountScreen.tsx"));
  const flow = sinComentarios(leer("src/onboarding/OnboardingFlow.tsx"));
  // El formulario propio reimplementaba la máquina de estados de Clerk
  // (create → prepare → attempt → setActive) y quedaba desfasado con cada
  // requisito nuevo de la instancia.
  for (const prohibido of [
    "TextInput",
    "CodeInput",
    "secureTextEntry",
    "confirmPassword",
    "Repetir contraseña",
    "Verificar código",
    "resetToEmail",
    "codePhase"
  ]) {
    assert.ok(!cuenta.includes(prohibido), `el formulario propio no puede volver: ${prohibido}`);
    assert.ok(!flow.includes(prohibido), `el flujo tampoco puede manejarlo: ${prohibido}`);
  }
  // Nombre y apellido son OPCIONALES: no se piden ni existe un paso para eso.
  for (const rel of [
    "src/onboarding/screens/AccountScreen.tsx",
    "src/onboarding/OnboardingFlow.tsx",
    "src/domain/onboardingReadiness.ts"
  ]) {
    const codigo = sinComentarios(leer(rel));
    assert.doesNotMatch(codigo, /needs_name/, `${rel}: no existe un estado de nombre`);
    assert.doesNotMatch(codigo, /firstName|lastName|Apellido/, `${rel}: el alta no pide nombre`);
  }
  // Y el paso 13 sigue siendo UNO solo: 15 pasos, sin agregados.
  assert.match(flow, /const TOTAL = 15;/);
  assert.match(flow, /const STEP_ACCOUNT = 13;/);
});

test("la UI oficial de Clerk se resuelve por plataforma", () => {
  // Mismo patrón que `BirthPicker`: Metro elige el archivo por plataforma.
  const nativo = sinComentarios(leer("src/onboarding/components/ClerkSignUp.tsx"));
  assert.match(nativo, /from "@clerk\/expo\/native"/);
  assert.match(nativo, /<AuthView mode="signUp"/);
  // El alta va EMBEBIDA en el paso, no presentada como modal: el botón de
  // cierre de `AuthView` no tendría a dónde cerrar y sería un segundo control
  // de salida al lado del `Header`, que sí sabe volver al paso anterior.
  assert.match(nativo, /<AuthView mode="signUp" isDismissible=\{false\} \/>/);
  // `AuthView` sólo acepta `mode`, `isDismissible` y `onDismiss`: no expone
  // prellenado, así que el email no puede colarse como prop inventada.
  assert.doesNotMatch(nativo, /initialValues/, "AuthView no tiene prellenado");

  const web = sinComentarios(leer("src/onboarding/components/ClerkSignUp.web.tsx"));
  assert.match(web, /from "@clerk\/expo\/web"/);
  assert.match(web, /<SignUp\b/);
  assert.ok(statSync(join(ROOT, "src/onboarding/components/ClerkSignUp.web.tsx")).size > 0);
  // Las dos superficies del alta montan el MISMO componente.
  for (const rel of [
    "src/onboarding/screens/AccountScreen.tsx",
    "src/onboarding/screens/SignUpGateScreen.tsx"
  ]) {
    assert.match(sinComentarios(leer(rel)), /from "\.\.\/components\/ClerkSignUp"/, rel);
  }
});

test("el email ya escrito PRELLENA el campo de Clerk, y sólo si es real", () => {
  // Prellenar no es tener un campo propio: el dueño del email sigue siendo
  // Clerk. Lo único que hace Órbita es no obligar a escribirlo dos veces.
  const web = sinComentarios(leer("src/onboarding/components/ClerkSignUp.web.tsx"));
  assert.match(web, /email\?: string;/, "el email es opcional");
  assert.match(web, /const prefill = email\?\.trim\(\) \?\? "";/);
  // Vacío ⇒ NADA. `initialValues: { emailAddress: "" }` es un prellenado que no
  // corresponde a nada escrito, y deja el campo de Clerk en estado "tocado".
  assert.match(
    web,
    /initialValues=\{prefill \? \{ emailAddress: prefill \} : undefined\}/,
    "sólo se prellena con un email real"
  );
  // Y las dos superficies lo cablean hasta Clerk.
  const flow = sinComentarios(leer("src/onboarding/OnboardingFlow.tsx"));
  assert.match(flow, /<AccountScreen[\s\S]{0,200}email=\{email\}/, "el paso 13 recibe el email del flujo");
  assert.match(
    sinComentarios(leer("src/onboarding/screens/AccountScreen.tsx")),
    /<ClerkSignUp email=\{email\} \/>/
  );
  const ruta = sinComentarios(leer("app/crear-cuenta.tsx"));
  assert.match(ruta, /useLocalSearchParams<\{ email\?: string \}>\(\)/, "el link directo trae `?email=`");
  assert.match(ruta, /<SignUpGateScreen email=\{email\}/);
  assert.match(
    sinComentarios(leer("src/onboarding/screens/SignUpGateScreen.tsx")),
    /<ClerkSignUp email=\{email\} \/>/
  );
});

test("el login social es SÓLO Google, y se enciende por configuración", () => {
  const cuenta = sinComentarios(leer("src/onboarding/useAccount.ts"));
  // Una sola estrategia en todo el flujo.
  assert.match(cuenta, /export type OAuthProvider = "google";/);
  assert.match(cuenta, /const strategy = "oauth_google" as const;/);
  assert.doesNotMatch(cuenta, /oauth_apple/, "Apple salió del flujo");
  // El flag sale del entorno: un deploy sin la variable queda cerrado, no roto.
  // Dos condiciones: sólo web, y sólo con la variable puesta. En nativo el SSO
  // vuelve por deep link y arrastra credenciales y reglas de tienda no resueltas.
  assert.match(
    cuenta,
    /export const GOOGLE_AUTH_ENABLED =\s*Platform\.OS === "web" && process\.env\.EXPO_PUBLIC_ORBITA_GOOGLE_AUTH === "true";/
  );
  assert.match(cuenta, /import \{ Platform \} from "react-native";/);
  assert.doesNotMatch(cuenta, /SOCIAL_LOGIN_ENABLED/, "el flag viejo no puede quedar colgando");

  // Ninguna superficie del alta ofrece Apple.
  for (const rel of [
    "src/onboarding/screens/AccountScreen.tsx",
    "src/onboarding/screens/SignInScreen.tsx",
    "src/onboarding/OnboardingFlow.tsx"
  ]) {
    assert.doesNotMatch(sinComentarios(leer(rel)), /"apple"|Continuar con Apple/, `${rel} todavía ofrece Apple`);
  }
});

test("«Continuar con Google» va arriba del divisor, con marca real y accesible", () => {
  const btn = sinComentarios(leer("src/onboarding/components/GoogleButton.tsx"));
  // Marca real de un paquete de íconos que ya está en el proyecto: ni dibujo
  // a mano ni emoji.
  assert.match(btn, /from "@expo\/vector-icons"/);
  assert.match(btn, /<FontAwesome name="google"/);
  // Accesible y tocable.
  assert.match(btn, /accessibilityRole="button"/);
  assert.match(btn, /accessibilityLabel=\{label\}/);
  assert.match(btn, /accessibilityState=\{\{ busy, disabled: busy \}\}/);
  assert.match(btn, /height: 54,/, "muy por encima del mínimo táctil");
  // Literales, no StyleSheet: si no, pierde el color contra las clases.
  assert.doesNotMatch(btn, /StyleSheet/);
  assert.match(btn, /o continuar con email/, "el divisor nombra el camino largo");

  // Queda en el LOGIN. En el alta los proveedores sociales los ofrece la UI
  // oficial de Clerk según la instancia: duplicarlos sería un segundo camino.
  const codigo = sinComentarios(leer("src/onboarding/screens/SignInScreen.tsx"));
  assert.match(codigo, /GOOGLE_AUTH_ENABLED/, "el login respeta el flag");
  assert.match(codigo, /<GoogleButton/, "el login monta el botón");
  assert.match(codigo, /<EmailDivider \/>/, "el login monta el divisor");
  assert.ok(codigo.indexOf("<GoogleButton") < codigo.indexOf("<EmailDivider"), "Google va ARRIBA del divisor");
});

test("la escena centrada usa una columna de lectura ancha, no una tira", () => {
  const shell = sinComentarios(leer("src/onboarding/components/Screen.tsx"));
  assert.match(shell, /const STAGE_COLUMN = 720;/, "la escena centrada lee a 720, no a 520");
  assert.match(shell, /const STAGE_MAX = 1200;/);
  assert.match(shell, /columnCentered: \{ alignSelf: "center", maxWidth: STAGE_COLUMN \}/);
  // `split` mantiene su columna de media composición.
  assert.match(shell, /columnDesktop: \{ justifyContent: "center", maxWidth: COPY_COLUMN \}/);
  assert.match(shell, /const COPY_COLUMN = 520;/);
});

test("el cierre del alta usa la pieza orbital y respeta reducir movimiento", () => {
  const flow = sinComentarios(leer("src/onboarding/OnboardingFlow.tsx"));
  // Ya no es un spinner sobre negro.
  assert.doesNotMatch(flow, /<ActivityIndicator/, "el spinner sobre negro no puede volver");
  assert.match(flow, /source=\{A\.heroEclipse\}/, "el orbe del alta es la pieza del cierre");
  assert.match(flow, /const reduced = useReducedMotion\(\);/);
  assert.match(flow, /if \(reduced\) return;/, "con movimiento reducido no se anima");
  assert.match(flow, /!reduced && \{ transform: \[\{ rotate \}\] \}/, "y la pieza queda quieta");
  // El texto de estado sigue anunciado.
  assert.match(flow, /Guardando tu carta…/);
  assert.match(flow, /accessibilityRole="progressbar"/);
  assert.match(flow, /accessibilityLiveRegion="polite"/);
});

test("el vacío de la búsqueda de ciudad guía en vez de dejar un hueco", () => {
  const paso = sinComentarios(leer("src/onboarding/screens/BirthplaceSearchScreen.tsx"));
  assert.match(paso, /showEmpty \? \(\s*<View style=\{styles\.emptyZone\}>/, "el vacío tiene composición propia");
  assert.match(paso, /<Emblem source=\{A\.rings\}/, "con una pieza del sistema orbital ya existente");
  assert.match(paso, /agregá el país/, "y ayuda concreta");
  // El autocomplete no cambia.
  assert.match(paso, /results\.map\(\(place\)/);
  assert.match(paso, /Sin resultados\./);
});

test("Antes/Después respira y conserva el guardrail de producto", () => {
  const paso = sinComentarios(leer("src/onboarding/screens/BeforeAfterScreen.tsx"));
  const antes = paso.slice(paso.indexOf("const ANTES"), paso.indexOf("const DESPUES"));
  const despues = paso.slice(paso.indexOf("const DESPUES"), paso.indexOf("type Props"));
  assert.equal((antes.match(/"/g) ?? []).length / 2, 3, "tres líneas por lado, no cinco");
  assert.equal((despues.match(/"/g) ?? []).length / 2, 3);
  // Jerarquía y aire.
  assert.match(paso, /cardTitle: \{ color: orbita\.bone, fontFamily: font\.serif, fontSize: 22/);
  assert.match(paso, /gap: 18,/, "más aire entre filas");
  // El guardrail de producto se conserva, palabra por palabra.
  assert.match(paso, /No resuelve por vos\. Te devuelve contexto\./);
  // Y no aparece lenguaje de destino ni de resultado garantizado.
  assert.doesNotMatch(paso, /destino|garantiz|asegura|predice/i);
});

// --- 4. El enlace de vuelta se ve y se alcanza ------------------------------

/** Contraste WCAG entre dos colores hex sólidos. */
function contrast(hexA: string, hexB: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.replace("#", ""), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const a = lum(hexA);
  const b = lum(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("el color del enlace secundario pasa el contraste de texto chico", () => {
  const BG = "#0A0B0E";
  // Medido, no estimado. El cobre de marca pasa el mínimo (5,13:1) pero por
  // poco; el suave da 8,14:1. Lo que NO puede pasar es que el enlace vuelva a
  // quedar por debajo de 4.5:1, ni que el destino se distinga sólo por color
  // (WCAG 1.4.1) — de ahí el subrayado, verificado en el test de abajo.
  assert.ok(contrast("#D69A6A", BG) >= 4.5, `copperSoft da ${contrast("#D69A6A", BG).toFixed(2)}:1`);
  assert.ok(
    contrast("#D69A6A", BG) > contrast("#C46A3A", BG),
    "el cobre suave tiene que ser MÁS legible que el de marca, no menos"
  );
  // El gris apagado del gate quedaba por debajo del cobre suave en presencia
  // visual pese a su ratio: sin peso ni subrayado no se leía como enlace.
  assert.ok(contrast("#B4AEA6", BG) >= 4.5, "el gris tampoco fallaba por contraste puro");
});

test("«Ya tengo cuenta · Iniciar sesión» se ve y se alcanza en las dos superficies", () => {
  // El estilo del enlace es un objeto LITERAL compartido, no una hoja
  // registrada: `StyleSheet.create` se compila a una clase atómica y pierde
  // contra `text-foreground`/`text-base` del `Text` compartido. Por eso el
  // enlace salía casi negro y a 16px mientras el subrayado —que esas clases no
  // tocan— sí se aplicaba. Ya rompió dos veces por este mismo motivo.
  const tema = sinComentarios(leer("src/onboarding/theme.ts"));
  assert.match(
    tema,
    /export const SIGN_IN_LINK_TEXT = \{\s*color: orbita\.copperSoft,\s*fontFamily: font\.sansBold,\s*fontSize: 15,\s*lineHeight: 22,\s*textAlign: "center",\s*textDecorationLine: "underline",\s*\} as const;/,
    "el enlace necesita color, peso y subrayado en un literal compartido"
  );
  assert.match(tema, /export const SIGN_IN_LINK_ROW = \{[\s\S]*?minHeight: 44,/, "44px de alto real");
  // No puede volver a ser una hoja registrada.
  assert.doesNotMatch(tema, /StyleSheet/, "el literal no puede pasar por StyleSheet.create");

  for (const rel of [
    "src/onboarding/screens/SplashScreen.tsx",
    "src/onboarding/screens/SignUpGateScreen.tsx"
  ]) {
    const codigo = sinComentarios(leer(rel));
    // Las dos superficies usan EL MISMO literal: no pueden divergir.
    assert.match(
      codigo,
      /<Text style=\{SIGN_IN_LINK_TEXT\}>Ya tengo cuenta · Iniciar sesión<\/Text>/,
      `${rel}: línea plana con el literal compartido`
    );
    assert.match(codigo, /SIGN_IN_LINK_ROW/, `${rel}: y el objetivo táctil compartido`);
    // Nada anidado ni ninguna hoja registrada que pueda perder contra Tailwind.
    assert.doesNotMatch(codigo, /signInStrong|signInDot/, `${rel}: los tramos anidados no pueden volver`);
    assert.doesNotMatch(codigo, /signInText:|signInLink:|signInRow:/, `${rel}: el enlace no puede volver a StyleSheet.create`);
    // `Body` aplica su propio color en línea y le ganaría al del enlace.
    assert.doesNotMatch(codigo, /<Body style=\{SIGN_IN_LINK_TEXT\}/, `${rel}: Body pisaría el color del enlace`);
    // Nombre y rol accesibles.
    assert.match(codigo, /accessibilityRole="link"/, `${rel}: es un enlace`);
    assert.match(codigo, /accessibilityLabel="Ya tengo cuenta: iniciar sesión"/, `${rel}: con nombre`);
  }
});

// --- 5. El paso más denso: se lee entero y el CTA se alcanza ----------------

test("Antes/Después scrollea y deja el CTA anclado con respiro seguro", () => {
  const codigo = sinComentarios(leer("src/onboarding/screens/BeforeAfterScreen.tsx"));
  assert.match(codigo, /<ScrollView/, "las tarjetas tienen que poder scrollear");
  // El CTA vive FUERA del scroll: no puede depender de llegar al fondo de una
  // lista de diez filas.
  const scrollEnd = codigo.indexOf("</ScrollView>");
  const cta = codigo.indexOf("<CTA label=\"Continuar\"");
  assert.ok(scrollEnd > 0 && cta > scrollEnd, "el CTA queda anclado fuera del scroll");
  assert.match(codigo, /paddingBottom: 12 \+ insets\.bottom/, "respiro del área segura por debajo");
  assert.match(codigo, /useSafeAreaInsets/);
  // Y el espaciador rígido que lo empujaba fuera de pantalla ya no está.
  assert.doesNotMatch(codigo, /spacer: \{ flex: 1/, "el spacer rígido empujaba el CTA fuera del viewport");
});

test("el cierre del alta muestra que está guardando, no una pantalla vacía", () => {
  // Con `PAYWALL_ENABLED=false` el último paso persiste la carta y entra a la
  // app. Mientras tanto se renderizaba un `View` negro y vacío: parecía que la
  // app se había colgado justo en el momento más frágil del alta.
  const flow = sinComentarios(leer("src/onboarding/OnboardingFlow.tsx"));
  assert.match(flow, /function SavingChart\(\)/, "hace falta un estado de guardado con marca");
  assert.match(flow, /<SavingChart \/>/, "y el cierre tiene que montarlo");
  assert.match(flow, /Guardando tu carta…/, "con copy en español");
  assert.match(flow, /source=\{A\.heroEclipse\}/, "y la pieza orbital como señal de actividad");
  // Anunciado: rol de progreso + región viva para un lector de pantalla.
  assert.match(flow, /accessibilityRole="progressbar"/);
  assert.match(flow, /accessibilityLabel="Guardando tu carta"/);
  assert.match(flow, /accessibilityLiveRegion="polite"/);

  // Y el relleno negro vacío ya no se monta en ninguna rama del switch.
  const cierre = flow.slice(flow.indexOf("case FINAL_STEP:"), flow.indexOf("function SavingChart"));
  assert.doesNotMatch(cierre, /<View style=\{styles\.fill\} \/>/, "el relleno vacío no puede volver al cierre");

  // El envío y el paywall no cambian: sólo lo que se dibuja mientras tanto.
  assert.match(flow, /if \(step === FINAL_STEP && !PAYWALL_ENABLED\) void submit\(\);/);
  assert.match(flow, /screen = PAYWALL_ENABLED \? \(/);
});

// --- 6. La inspección interna sigue siendo de sólo lectura ------------------

test("`debugStep` no puede escribir nada", () => {
  // Montar un paso para inspeccionarlo no puede persistir borrador, ni calcular
  // la tríada, ni enviar. Se preserva tal cual de la tanda anterior.
  const flow = sinComentarios(leer("src/onboarding/OnboardingFlow.tsx"));
  assert.match(flow, /const inspeccion = debugStep !== null;/);
  const guards = flow.match(/if \(inspeccion\) return;/g) ?? [];
  assert.ok(guards.length >= 4, `se esperaban los guards de borrador, cálculo y envío, hay ${guards.length}`);
});
