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

// --- 1. La entrada es el acceso en las DOS plataformas -----------------------

test("web y nativo arrancan el alta en el acceso (paso 0)", () => {
  assert.match(FLOW, /const IS_WEB = Platform\.OS === "web";/);
  // Con backend, la PRIMERA superficie es "Crear cuenta o ingresar" en las dos
  // plataformas; sin backend (build local) no hay Clerk y se entra en la
  // promesa. La portada vieja (SplashScreen) ya no existe.
  assert.match(FLOW, /const ENTRY_STEP = HAS_BACKEND \? STEP_AUTH : STEP_PROMISE;/);
  assert.match(FLOW, /case STEP_AUTH:[\s\S]{0,400}<AuthScreen/);
  assert.doesNotMatch(FLOW, /SplashScreen/, "la portada vieja no puede volver al flujo");
  // Y la promesa conserva el CTA acordado.
  assert.match(leer("src/onboarding/screens/AlignScreen.tsx"), /Empezar el viaje/);
});

test("volver desde la entrada web regresa a la landing", () => {
  const back = FLOW.slice(FLOW.indexOf("const back = () => {"), FLOW.indexOf("const birthDateISO"));
  assert.match(back, /if \(IS_WEB && !inspeccion && step <= ENTRY_STEP\) \{/, "en web la entrada vuelve a la landing");
  assert.match(back, /router\.replace\("\/"\);/, "y volver sale a la landing");
  // Con sesión activa el acceso quedó atrás: la promesa es el piso del back.
  assert.match(back, /const floor = HAS_BACKEND && !sesionActiva \? STEP_AUTH : STEP_PROMISE;/);
  assert.match(back, /Math\.max\(floor, s - 1\)/, "ningún back vuelve al acceso con sesión activa");
});

test("los saltos de sesión y de resume apuntan al paso de la fecha", () => {
  // Una cuenta con sesión y SIN datos natales continúa por los datos, no por
  // el acceso ni por el tramo inmersivo repetido.
  assert.match(FLOW, /params\.resume === "datos" \? STEP_BIRTHDATE : ENTRY_STEP/);
  assert.match(FLOW, /s === STEP_AUTH \? STEP_BIRTHDATE : s/, "el respaldo del resume salta desde el acceso");
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

test("el hero declara la carta astral base, debajo del CTA y sin regalar la completa", () => {
  // El bloque del hero: desde su apertura hasta la sección del ejemplo.
  const hero = LANDING.slice(LANDING.indexOf("styles.hero,"), LANDING.indexOf('id="tu-carta-de-hoy"'));
  assert.match(hero, /TU CARTA ASTRAL BASE, INCLUIDA AL EMPEZAR/, "la etiqueta acordada vive en el hero");
  assert.match(
    hero,
    /Sol, Luna y ascendente: el mapa personal que da contexto a tu tarot diario y a\s+los tránsitos\./,
    "con su línea de apoyo exacta"
  );
  assert.equal(contar(LANDING, "TU CARTA ASTRAL BASE"), 1, "una sola aparición en la página");
  // Va DESPUÉS del bloque de CTAs: el CTA primario no baja del primer viewport
  // móvil (390×844) por esta línea.
  assert.ok(
    hero.indexOf("<EmpezarCta") < hero.indexOf("TU CARTA ASTRAL BASE"),
    "la línea de valor no empuja el CTA primario"
  );
  // La promesa Plus no cambia: el hero no anuncia la carta natal completa.
  assert.doesNotMatch(hero, /carta natal completa/i);
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
