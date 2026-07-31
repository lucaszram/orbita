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
import { CANVAS_MAX_WIDTH } from "../src/domain/webLayout";

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

test("web usa controles del navegador y dibuja EXACTAMENTE el valor del estado", () => {
  const web = sinComentarios(leer("src/onboarding/components/BirthPicker.web.tsx"));
  assert.match(web, /type: "date"/, "fecha con el control nativo del navegador");
  assert.match(web, /type: "time"/, "hora con el control nativo del navegador");
  // LA aserción de esta tanda: el valor mostrado sale de las mismas partes que
  // usa el resto del flujo. Si esto se rompe, vuelve el bug de integridad.
  assert.match(web, /value: partsToDateValue\(args\.value\) \?\? ""/);
  assert.match(web, /value: partsToTimeValue\(args\.value\) \?\? ""/);
  // Y lo que se emite son partes parseadas del control, no un índice de rueda.
  assert.match(web, /dateValueToParts\(event\.currentTarget\.value\)/);
  assert.match(web, /timeValueToParts\(event\.currentTarget\.value\)/);
  // Nadie nació mañana.
  assert.match(web, /max: isoDateFrom\(args\.today\)/);
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

test("una fecha imposible bloquea Continuar y se dice por qué", () => {
  const paso = sinComentarios(leer("src/onboarding/screens/BirthdateScreen.tsx"));
  assert.match(paso, /const real = isRealDateParts\(value\);/);
  assert.match(paso, /disabled=\{!real\}/, "no se puede confirmar un día que no existe");
  assert.match(paso, /accessibilityRole="alert"/, "y se anuncia");
});

// --- 3. Composición responsive del alta -------------------------------------

test("el alta tiene su propia columna de formulario, más angosta que la de lectura", () => {
  assert.equal(CANVAS_MAX_WIDTH.form, 480);
  assert.ok(CANVAS_MAX_WIDTH.form < (CANVAS_MAX_WIDTH.reading ?? Infinity), "más angosta que la lectura");
  const shell = sinComentarios(leer("src/onboarding/components/Screen.tsx"));
  assert.match(shell, /<ContentCanvas fill variant="form">\{children\}<\/ContentCanvas>/);
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
    assert.match(codigo, /<Screen /, `${rel} monta el shell que aplica el lienzo`);
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
  for (const rel of [
    "src/onboarding/screens/SplashScreen.tsx",
    "src/onboarding/screens/SignUpGateScreen.tsx"
  ]) {
    const codigo = sinComentarios(leer(rel));

    // El estilo va en la LÍNEA COMPLETA, en un solo bloque: color legible, peso
    // y subrayado juntos. En react-native-web un `Text` con hijos `Text` se
    // renderiza como div + spans y el color en línea del padre no llega a los
    // hijos — la fila entera terminaba casi negra sobre el fondo casi negro.
    assert.match(
      codigo,
      /signInText: \{\s*color: orbita\.copperSoft,\s*fontFamily: font\.sansBold,\s*fontSize: 15,\s*textAlign: "center",\s*textDecorationLine: "underline"\s*\}/,
      `${rel}: la línea entera tiene que llevar color, peso y subrayado`
    );
    // Una sola línea de texto plano: nada anidado que se pueda perder.
    assert.match(
      codigo,
      /style=\{styles\.signInText\}>Ya tengo cuenta · Iniciar sesión</,
      `${rel}: el enlace es una línea plana, sin Text anidados`
    );
    assert.doesNotMatch(codigo, /signInStrong|signInDot/, `${rel}: los tramos anidados no pueden volver`);

    // Objetivo táctil real: `hitSlop` no existe en web.
    assert.match(codigo, /minHeight: 44/, `${rel}: 44px de alto real`);
    // Nombre y rol accesibles.
    assert.match(codigo, /accessibilityRole="link"/, `${rel}: es un enlace`);
    assert.match(codigo, /accessibilityLabel="Ya tengo cuenta: iniciar sesión"/, `${rel}: con nombre`);
    // Y ya no es gris apagado sobre casi-negro.
    assert.doesNotMatch(codigo, /signInText: \{ color: orbita\.muted \}/, `${rel}: el gris apagado no puede volver`);
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
  assert.match(flow, /<ActivityIndicator color=\{orbita\.copper\} \/>/, "y señal de actividad");
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
