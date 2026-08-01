/**
 * Entrada pública web v2 — corrección final.
 *
 * Dos invariantes de producto:
 * 1. El flujo web normal (`/` → `/empezar`) entra DIRECTO en AlignScreen
 *    (paso 1, CTA "Empezar el viaje"): la portada nativa (SplashScreen, con su
 *    video y "Órbita · Tu cielo, todos los días") nunca se monta en web fuera
 *    de la inspección interna. El nativo conserva su paso 0 intacto.
 * 2. La landing extiende el fondo orbital aprobado a toda la página, muestra el
 *    mazo real (abanico en el hero + sección "El mazo de Órbita" de 16 cartas)
 *    y la ilustración de La Luna aparece UNA sola vez, en la lectura editorial.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const FLOW = sinComentarios(leer("src/onboarding/OnboardingFlow.tsx"));
const LANDING = sinComentarios(leer("src/components/web/orbita-landing.tsx"));

const contar = (src: string, needle: string) => src.split(needle).length - 1;

// --- 1. La entrada web es AlignScreen, la portada queda para nativo ----------

test("la web arranca el alta en el paso 1 y el nativo conserva su paso 0", () => {
  assert.match(FLOW, /const IS_WEB = Platform\.OS === "web";/);
  assert.match(FLOW, /const ENTRY_STEP = IS_WEB \? 1 : 0;/, "la entrada es por plataforma");
  // El estado inicial pasa por la normalización: un borrador web viejo guardado
  // en el paso 0 se levanta en el 1, nunca en la portada.
  assert.match(FLOW, /const normalizeEntryStep = \(s: number\) => \(IS_WEB && s === 0 \? ENTRY_STEP : s\);/);
  assert.match(FLOW, /normalizeEntryStep\(saved\?\.step \?\? ENTRY_STEP\)/, "el borrador restaurado también se normaliza");
  // La portada sigue existiendo para nativo (y para `debugStep=0`, que ya pasa
  // por la guarda de herramientas internas de `resolveDebugStep`).
  assert.match(FLOW, /case 0:\s*screen = \(\s*<SplashScreen/);
  assert.match(FLOW, /case 1:\s*screen = <AlignScreen/);
  // Y la pantalla de entrada web tiene el CTA acordado.
  assert.match(leer("src/onboarding/screens/AlignScreen.tsx"), /Empezar el viaje/);
});

test("volver desde el paso 1 web regresa a la landing, no a la portada", () => {
  const back = FLOW.slice(FLOW.indexOf("const back = () => {"), FLOW.indexOf("const birthDateISO"));
  assert.match(back, /if \(IS_WEB && !inspeccion && step <= ENTRY_STEP\) \{/, "en web el paso 1 ES la entrada");
  assert.match(back, /router\.replace\("\/"\);/, "y volver sale a la landing");
  assert.match(back, /Math\.max\(ENTRY_STEP, s - 1\)/, "ningún back del flujo normal baja del paso de entrada");
});

test("los saltos de sesión y de resume apuntan a la entrada por plataforma", () => {
  // Antes comparaban contra el 0 literal: en web (entrada = 1) una cuenta
  // incompleta se habría quedado mirando AlignScreen en vez de seguir el alta.
  assert.equal(contar(FLOW, 's === ENTRY_STEP ? STEP_BIRTHDATE : s'), 2);
  assert.doesNotMatch(FLOW, /s === 0 \? STEP_BIRTHDATE/, "la comparación contra 0 literal no puede volver");
});

// --- 2. La landing: fondo, mazo y una sola Luna ------------------------------

test("el fondo orbital aprobado cubre toda la landing sin estirarse", () => {
  // Los MISMOS derivados que la entrada del alta, por el seam de plataforma.
  assert.match(LANDING, /from "@\/onboarding\/entryBackground"/);
  assert.match(LANDING, /source=\{entryBackground\(!isNarrow\)\}/, "panorámico en escritorio, vertical en móvil");
  assert.match(LANDING, /resizeMode="cover"[\s\S]{0,200}importantForAccessibility="no-hide-descendants"/, "cover (recorta, no estira) y decorativo");
  assert.match(LANDING, /bgScrim/, "con scrim oscuro para la legibilidad");
  // El scroll es transparente: sin fondos sólidos por sección no hay cortes.
  assert.doesNotMatch(LANDING, /page: \{\s*backgroundColor/, "el ScrollView no puede tapar el fondo");
  assert.doesNotMatch(LANDING, /pageContent: \{\s*backgroundColor/);
});

test("la ilustración de La Luna aparece UNA sola vez: en la lectura editorial", () => {
  assert.equal(contar(LANDING, "source={LA_LUNA.image}"), 1, "una sola aparición del arte de La Luna");
  assert.doesNotMatch(LANDING, /major_18_la_luna/, "ni el abanico ni la muestra del mazo la incluyen");
});

test("el hero muestra un abanico accesible de cartas reales del mazo", () => {
  const fan = LANDING.slice(LANDING.indexOf("const FAN"), LANDING.indexOf("const FAN_LABEL"));
  // Contamos solo dentro del literal del array (después del `= [`): la
  // anotación de tipo también dice `source:` y no es una carta.
  const inicioArray = fan.search(/=\s*\[/);
  assert.ok(inicioArray >= 0, "FAN se declara como array literal");
  assert.equal(contar(fan.slice(inicioArray), "source:"), 7, "cinco cartas reales más los dos dorsos");
  assert.match(fan, /CARD_BACK_MANDALA/, "el dorso mandala está");
  assert.match(fan, /source: CARD_BACK/, "y el dorso de órbitas también");
  // Para accesibilidad el abanico es UNA imagen con nombre; las cartas
  // solapadas no se anuncian una por una.
  assert.match(LANDING, /accessibilityRole="image"\s*accessibilityLabel=\{FAN_LABEL\}/);
  assert.match(LANDING, /<CardFan narrow=\{isNarrow\}/, "y el hero lo monta");
  // El abanico se dimensiona por el ancho disponible: no puede desbordar a 320.
  assert.match(LANDING, /Math\.floor\(\(maxWidth - 28\) \/ \(1 \+ \(FAN\.length - 1\) \* SPREAD\)\)/);
});

test("«El mazo de Órbita»: 16 cartas, los cuatro palos y el 78 explícito", () => {
  const muestra = LANDING.slice(LANDING.indexOf("const MAZO_MUESTRA"), LANDING.indexOf("].map(byKey)"));
  const keys = muestra.match(/"[a-z0-9_]+"/g) ?? [];
  assert.equal(keys.length, 16, "dieciséis cartas representativas");
  assert.ok(keys.some((k) => k.startsWith('"major_')), "hay Arcanos Mayores");
  for (const palo of ["wands_", "cups_", "swords_", "pentacles_"]) {
    assert.ok(keys.some((k) => k.startsWith(`"${palo}`)), `falta el palo ${palo}`);
  }
  assert.match(LANDING, /El mazo de Órbita\./, "la sección tiene su título");
  assert.match(
    LANDING,
    /mazo completo de 78 cartas/,
    "se dice explícitamente que el producto usa el mazo completo de 78"
  );
  assert.match(LANDING, /los 22 Arcanos\s+Mayores y los 56 Arcanos Menores/);
  // Fila horizontal accesible: lista con nombre visible por carta.
  assert.match(LANDING, /horizontal\s+showsHorizontalScrollIndicator/);
  assert.match(LANDING, /role="list"/);
  assert.match(LANDING, /role="listitem"/);
});

test("los invariantes de conversión de la landing no cambian", () => {
  assert.equal(contar(LANDING, "Ya tengo cuenta"), 1, "una sola acción de cuenta, en el header");
  assert.equal(contar(LANDING, "<EmpezarCta"), 4, "cuatro CTAs de arranque");
  assert.equal(contar(LANDING, "Empezar gratis"), 1, "definidos una sola vez");
  assert.match(LANDING, /href="\/empezar"/);
  for (const ancla of ["como-funciona", "carta-hoy", "que-incluye"]) {
    assert.ok(LANDING.includes(`"${ancla}"`), `falta el ancla ${ancla}`);
  }
  for (const href of ["/privacy", "/terminos", "/support"]) {
    assert.ok(LANDING.includes(`href="${href}"`), `falta el enlace legal ${href}`);
  }
});
