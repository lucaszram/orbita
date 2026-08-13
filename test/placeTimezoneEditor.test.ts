import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { validateBirthPayload, BirthPayloadError } from "../src/domain/birthPayload";
import { timezoneLookupFor, withResolvedTimezone } from "../src/domain/placeTimezone";

/**
 * "Editar datos": zona horaria resuelta desde las coordenadas del lugar y
 * contraste legible de la pantalla.
 *
 * La decisión de cuándo consultar la zona vive en un módulo puro y se ejecuta
 * de verdad; de la pantalla y del camino de escritura se verifica la ESTRUCTURA
 * (no se puede renderizar React Native en node).
 */
const ROOT = join(import.meta.dirname, "..");
const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const EDITOR = leer("app/editar-datos.tsx");
const EDITOR_CODE = sinComentarios(EDITOR);
const PERSIST = sinComentarios(leer("src/onboarding/useAccount.ts"));
const REFS = sinComentarios(leer("src/services/appRefs.ts"));

/** Un lugar recién elegido en Photon: etiqueta y coordenadas, sin zona. */
const PHOTON = { birthDate: "1994-11-03", birthPlaceLabel: "Córdoba, Argentina", latitude: -31.42, longitude: -64.18 };

// --- Cuándo se resuelve la zona --------------------------------------------

test("una ciudad de Photon (coordenadas sin zona) pide resolución", () => {
  assert.deepEqual(timezoneLookupFor(PHOTON), { latitude: -31.42, longitude: -64.18 });
});

test("una zona ya presente no se vuelve a resolver ni se pisa", () => {
  assert.equal(timezoneLookupFor({ ...PHOTON, timezone: "America/Argentina/Cordoba" }), null);
  // Ni siquiera si viene con espacios alrededor: es un dato vigente.
  assert.equal(timezoneLookupFor({ ...PHOTON, timezone: " America/Argentina/Cordoba " }), null);
});

test("una zona vacía cuenta como faltante", () => {
  assert.deepEqual(timezoneLookupFor({ ...PHOTON, timezone: "   " }), {
    latitude: -31.42,
    longitude: -64.18
  });
});

test("sin coordenadas usables no se consulta nada: el rechazo correcto es 'coordenadas'", () => {
  assert.equal(timezoneLookupFor({ birthDate: "1994-11-03", birthPlaceLabel: "Córdoba" }), null);
  assert.equal(timezoneLookupFor({ ...PHOTON, latitude: Number.NaN }), null);
  assert.equal(timezoneLookupFor({ ...PHOTON, latitude: 91 }), null);
  assert.equal(timezoneLookupFor({ ...PHOTON, longitude: -181 }), null);
  assert.throws(
    () => validateBirthPayload({ ...PHOTON, latitude: undefined, longitude: undefined, timezone: "UTC" }),
    (e: unknown) => e instanceof BirthPayloadError && e.problem === "coordenadasFaltantes"
  );
});

test("la coordenada 0,0 es válida y se resuelve como cualquier otra", () => {
  assert.deepEqual(timezoneLookupFor({ ...PHOTON, latitude: 0, longitude: 0 }), {
    latitude: 0,
    longitude: 0
  });
});

test("con la zona resuelta el payload pasa la validación de escritura", () => {
  const resuelto = withResolvedTimezone(PHOTON, "America/Argentina/Cordoba");
  const payload = validateBirthPayload(resuelto);
  assert.equal(payload.timezone, "America/Argentina/Cordoba");
  assert.equal(payload.latitude, -31.42);
  // El resto del payload viaja intacto.
  assert.equal(payload.birthDate, PHOTON.birthDate);
  assert.equal(payload.birthPlaceLabel, PHOTON.birthPlaceLabel);
});

test("una respuesta vacía del backend NO se escribe: cae en zonaFaltante", () => {
  assert.throws(
    () => validateBirthPayload(withResolvedTimezone(PHOTON, "   ")),
    (e: unknown) => e instanceof BirthPayloadError && e.problem === "zonaFaltante"
  );
});

// --- El contrato nuevo, registrado en el cliente ----------------------------

test("appRefs registra placeTimezone.atCoordinates con su firma real", () => {
  assert.match(REFS, /atCoordinates: anyApi\.placeTimezone\.atCoordinates as FunctionReference<\s*"action",\s*"public",\s*\{ latitude: number; longitude: number \},\s*\{ timezone: string \}\s*>/);
});

// --- El camino estricto de guardado del Perfil ------------------------------

/** El cuerpo exacto de una función, por balance de llaves. */
function bloqueDesde(src: string, ancla: string): string {
  const i = src.indexOf(ancla);
  assert.notEqual(i, -1, `no se encontró el ancla: ${ancla}`);
  let depth = 0;
  for (let j = src.indexOf("{", i); j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) return src.slice(i, j + 1);
  }
  return src.slice(i);
}

const inner = bloqueDesde(PERSIST, "function useProfilePersistInner()");

test("el editor espera la zona ANTES de validar y ANTES de escribir", () => {
  const iResolver = inner.indexOf("await resolveTimezone(lookup)");
  const iValidar = inner.indexOf("validateBirthPayload(resolved)");
  const iEscribir = inner.indexOf("await upsertBirthData({");
  assert.ok(iResolver !== -1, "falta la espera de placeTimezone.atCoordinates");
  assert.ok(iResolver < iValidar, "la zona se resuelve antes de validar");
  assert.ok(iValidar < iEscribir, "y todo antes de escribir");
  assert.match(inner, /useAction\(appApi\.placeTimezone\.atCoordinates\)/);
  assert.match(inner, /timezoneLookupFor\(input\)/);
});

test("si la zona no se resuelve se falla cerrado: nada se escribe", () => {
  // Sin `catch` ni `?? deviceTimezone()`: el rechazo sube al editor, que muestra
  // el error y no toca el perfil local.
  assert.doesNotMatch(inner, /resolveTimezone\([\s\S]{0,80}\)\s*\.catch/);
  assert.doesNotMatch(inner, /deviceTimezone\(\)/);
  assert.doesNotMatch(inner, /Intl\.DateTimeFormat/);
  const save = EDITOR_CODE.slice(EDITOR_CODE.indexOf("const save = async () => {"));
  const iBackend = save.indexOf("await persistBackend(");
  const iLocal = save.indexOf("await updateProfile(");
  assert.ok(iBackend !== -1 && iBackend < iLocal, "el perfil local se toca DESPUÉS del backend");
  assert.match(save, /catch \(e\) \{\s*setSaveError\(/, "el fallo se muestra, no se traga");
});

test("la zona sale del backend por coordenadas: ni del dispositivo ni de una API externa", () => {
  // El cliente no llama a ningún proveedor de timezone: la única fuente es la
  // action de Convex, que usa datos geográficos empaquetados.
  assert.doesNotMatch(EDITOR_CODE, /timezonedb|geonames|googleapis|astrologyapi/i);
  assert.doesNotMatch(EDITOR_CODE, /deviceTimezone/);
  const dominio = leer("src/domain/placeTimezone.ts");
  assert.doesNotMatch(sinComentarios(dominio), /fetch\(|require\(|import .*react/);
});

test("cambiar sólo fecha u hora conserva la zona remota (no se consulta nada)", () => {
  // `buildBackendBirthPayload` arrastra la zona del documento remoto cuando el
  // lugar no cambió; con zona presente el editor no pide resolución.
  assert.equal(
    timezoneLookupFor({ ...PHOTON, birthDate: "1994-11-04", timezone: "America/Argentina/Cordoba" }),
    null
  );
});

// --- Contraste: precedencia de estilos en react-native-web -------------------

test("los textos del editor usan estilos LITERALES, no la hoja registrada", () => {
  // En react-native-web `StyleSheet.create` compila a una clase atómica que
  // pierde contra `text-foreground`/`text-base` del Text compartido: por eso
  // salían casi negros. Un literal viaja inline y gana.
  assert.match(EDITOR_CODE, /const TEXT = \{/);
  assert.match(EDITOR_CODE, /satisfies Record<string, TextStyle>/);
  for (const [tag, style] of [
    ["<Text style={TEXT.chev}>", "chev"],
    ["<Text style={TEXT.hit}>", "hit"],
    ["<Text style={TEXT.cancel}>", "cancel"],
    ["<Text style={[TEXT.toggle, draft.timeUnknown && TEXT.toggleOn]}>", "toggle"]
  ] as const) {
    assert.ok(EDITOR_CODE.includes(tag), `el texto "${style}" no usa su literal`);
  }
  assert.match(EDITOR_CODE, /style=\{TEXT\.saveError\}/);
  assert.match(EDITOR_CODE, /style=\{TEXT\.blockNote\}/);
  // Y ya no quedan las entradas viejas en la hoja registrada.
  const hoja = EDITOR_CODE.slice(EDITOR_CODE.indexOf("StyleSheet.create({"));
  for (const muerto of ["hitText:", "toggleText:", "toggleTextOn:", "cancelText:", "chev:", "saveError:", "blockNote:"]) {
    assert.equal(hoja.includes(muerto), false, `${muerto} volvió a la hoja registrada`);
  }
});

test("ningún estilo de texto registrado vuelve a fijar color o tamaño", () => {
  // Regla general de la pantalla: lo que un <Text>/<Body>/<Label> reciba desde
  // `styles` puede posicionar, pero no puede pintar ni dimensionar — eso lo
  // gana Tailwind y el texto se vuelve ilegible.
  const hoja = EDITOR_CODE.slice(EDITOR_CODE.indexOf("StyleSheet.create({"));
  const usados = new Set<string>();
  for (const etiqueta of EDITOR_CODE.matchAll(/<(?:Text|Body|Label|Title)\b([^>]*)>/g)) {
    for (const ref of etiqueta[1].matchAll(/styles\.(\w+)/g)) usados.add(ref[1]);
  }
  assert.ok(usados.size > 0, "el escaneo no encontró estilos de texto");
  for (const nombre of usados) {
    const decl = new RegExp(`\\b${nombre}:\\s*\\{[^}]*\\}`).exec(hoja);
    assert.ok(decl, `${nombre} no está declarado en la hoja`);
    assert.doesNotMatch(decl[0], /(^|[^-\w])color:/, `${nombre} pinta texto desde la hoja registrada`);
    assert.doesNotMatch(decl[0], /fontSize:|lineHeight:|fontFamily:/, `${nombre} dimensiona texto desde la hoja`);
  }
});

test("la paleta oscura/cobre de la pantalla no cambia", () => {
  const bloque = EDITOR_CODE.slice(EDITOR_CODE.indexOf("const TEXT = {"), EDITOR_CODE.indexOf("const styles ="));
  // Exactamente los colores que la pantalla ya tenía: esto arregla precedencia,
  // no rediseña.
  assert.match(bloque, /cancel: \{ color: orbita\.faint/);
  assert.match(bloque, /chev: \{ color: orbita\.bone/);
  assert.match(bloque, /hit: \{ color: orbita\.bone/);
  assert.match(bloque, /toggle: \{ color: orbita\.bone/);
  assert.match(bloque, /toggleOn: \{ color: orbita\.ink \}/);
  assert.match(bloque, /saveError: \{ color: "#D07A5A"/);
  assert.match(bloque, /blockNote: \{ color: orbita\.muted/);
  // El fondo y el interruptor activo siguen siendo los mismos.
  assert.match(EDITOR_CODE, /fill: \{ backgroundColor: orbita\.bg/);
  assert.match(EDITOR_CODE, /toggleOn: \{ backgroundColor: orbita\.copper, borderColor: orbita\.copper \}/);
});
