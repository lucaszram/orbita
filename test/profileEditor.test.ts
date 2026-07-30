import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDateInput, parseTimeInput } from "../src/domain/birthInput";
import {
  INCOMPLETE_BIRTH_MESSAGE,
  canRenderWheel,
  formatBirthLine,
  resolveBirthInfo
} from "../src/domain/birthInfo";
import { buildBackendBirthPayload } from "../src/domain/birthEdits";
import { BirthPayloadError, validateBirthPayload } from "../src/domain/birthPayload";

const ROOT = join(import.meta.dirname, "..");
const sinComentarios = (x: string) =>
  x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const CAMPO = readFileSync(join(ROOT, "src/onboarding/components/BirthDateTimeField.tsx"), "utf8");
const CAMPO_NATIVO = CAMPO;
const CAMPO_WEB = CAMPO;
const EDITOR = readFileSync(join(ROOT, "app/editar-datos.tsx"), "utf8");
const PERFIL = readFileSync(join(ROOT, "app/(tabs)/perfil.tsx"), "utf8");
const CARTA_CARD = readFileSync(join(ROOT, "src/components/home/CartaCard.tsx"), "utf8");

const COMPLETO = {
  birthDate: "1996-11-11",
  birthTime: "10:32",
  birthPlaceLabel: "Ciudad Autónoma de Buenos Aires, Argentina",
  latitude: -34.6,
  longitude: -58.44,
  timezone: "America/Argentina/Buenos_Aires"
};

// --- Datos remotos incompletos NUNCA dibujan rueda ---------------------------

test("hasta que el remoto resuelve no se afirma nada", () => {
  const info = resolveBirthInfo({ doc: null, resolved: false });
  assert.equal(info.status, "loading");
  assert.ok(!canRenderWheel(info), "sin resolver no se dibuja rueda");
});

test("documento ausente o incompleto → incompleto, con la copy exacta y sin rueda", () => {
  const casos: Array<[string, unknown]> = [
    ["sin documento", null],
    ["lugar sin especificar", { ...COMPLETO, birthPlaceLabel: "Sin especificar" }],
    ["sin coordenadas", { ...COMPLETO, latitude: undefined, longitude: undefined }],
    ["sin zona", { ...COMPLETO, timezone: "" }],
    ["sin fecha", { ...COMPLETO, birthDate: "" }]
  ];
  for (const [nombre, doc] of casos) {
    const info = resolveBirthInfo({ doc: doc as never, resolved: true });
    assert.equal(info.status, "incomplete", nombre);
    assert.equal(info.status === "incomplete" && info.message, INCOMPLETE_BIRTH_MESSAGE, nombre);
    assert.ok(!canRenderWheel(info), `${nombre}: no puede dibujar rueda`);
  }
});

test("documento completo → línea válida y rueda permitida", () => {
  const info = resolveBirthInfo({ doc: COMPLETO, resolved: true });
  assert.equal(info.status, "complete");
  assert.ok(canRenderWheel(info));
  assert.ok(info.status === "complete" && info.line.includes("11 Nov 1996"));
  assert.ok(info.status === "complete" && info.line.includes("10:32"));
});

test("sin hora la línea no inventa una", () => {
  const info = resolveBirthInfo({ doc: { ...COMPLETO, birthTime: undefined }, resolved: true });
  assert.equal(info.status, "complete");
  assert.ok(info.status === "complete" && !info.hasTime);
  assert.ok(info.status === "complete" && !/\d{2}:\d{2}/.test(info.line), "no debe aparecer ninguna hora");
});

test("la regla de completitud es la MISMA que la del borde de escritura", () => {
  // Si difirieran, se podría guardar algo que después no se puede mostrar.
  const incompleto = { ...COMPLETO, birthPlaceLabel: "Sin especificar" };
  assert.throws(() => validateBirthPayload(incompleto), BirthPayloadError);
  assert.equal(resolveBirthInfo({ doc: incompleto, resolved: true }).status, "incomplete");
});

// --- Perfil ------------------------------------------------------------------

test("el Perfil toma la línea del REMOTO, no del perfil local", () => {
  const codigo = sinComentarios(PERFIL);
  assert.ok(/birthData\.getCurrent/.test(codigo), "debe consultar el documento remoto");
  assert.ok(/resolveBirthInfo/.test(codigo));
  assert.ok(!/perfil\.birthLine/.test(codigo), "la línea local venía de createFallbackProfile()");
});

test("el Perfil no monta la rueda con datos incompletos y ofrece EDITAR DATOS", () => {
  const codigo = sinComentarios(PERFIL);
  assert.ok(
    /birth\.status === "complete" \? <CartaCard \/> : null/.test(codigo),
    "la rueda sólo con datos completos"
  );
  assert.ok(/birth\.message/.test(codigo), "y el mensaje de incompleto");
  const editar = codigo.match(/EDITAR DATOS/g) ?? [];
  assert.equal(editar.length, 1, "un solo EDITAR DATOS: no se duplica la superficie");
});

test("el Perfil conserva la estructura pedida", () => {
  for (const bloque of ["CUENTA", "LEGAL", "EDITAR DATOS", "ManageSubscriptionBlock", "Eliminar mi cuenta", "Cerrar sesión"]) {
    assert.ok(PERFIL.includes(bloque), `falta el bloque: ${bloque}`);
  }
});

test("la CartaCard tampoco dibuja rueda con datos remotos incompletos", () => {
  const codigo = sinComentarios(CARTA_CARD);
  assert.ok(/birthData\.getCurrent/.test(codigo));
  const guarda = codigo.indexOf('birth.status === "incomplete"');
  const mapea = codigo.indexOf("mapNatalChart(doc)");
  assert.ok(guarda !== -1 && guarda < mapea, "la guarda va ANTES de mapear la carta");
});

// --- Controles de fecha y hora en web ---------------------------------------

test("en web los campos de fecha y hora son visibles y etiquetados", () => {
  assert.ok(/accessibilityLabel="Fecha de nacimiento/.test(CAMPO_WEB));
  assert.ok(/accessibilityLabel=\{`\$\{label\} de nacimiento/.test(CAMPO_WEB));
  assert.ok(/accessibilityHint/.test(CAMPO_WEB), "el formato esperado se explica");
  assert.ok(/minHeight: 44/.test(CAMPO_WEB), "alto táctil accesible");
  assert.ok(/placeholder="1996-11-11"/.test(CAMPO_WEB), "el formato se muestra de ejemplo");
});

test("un texto que no es fecha válida NO llega al estado", () => {
  for (const malo of ["", "  ", "1996", "11/11/1996", "1996-13-01", "1996-02-30", "abcd-ef-gh"]) {
    assert.equal(parseDateInput(malo), null, JSON.stringify(malo));
  }
  assert.deepEqual(parseDateInput("1996-11-11"), { y: 1996, m: 11, d: 11 });
  // Año bisiesto real vs inventado.
  assert.ok(parseDateInput("2028-02-29"));
  assert.equal(parseDateInput("2027-02-29"), null);
});

test("un texto que no es hora válida NO llega al estado", () => {
  for (const malo of ["", "10", "10:6", "24:00", "10:60", "aa:bb"]) {
    assert.equal(parseTimeInput(malo), null, JSON.stringify(malo));
  }
  assert.deepEqual(parseTimeInput("10:32"), { h: 10, m: 32 });
  assert.deepEqual(parseTimeInput("00:00"), { h: 0, m: 0 }, "la medianoche es válida");
});

test("el formato inválido se anuncia sin descartar el valor vigente", () => {
  assert.ok(/accessibilityRole="alert"/.test(CAMPO_WEB));
  assert.ok(/accessibilityLiveRegion="polite"/.test(CAMPO_WEB));
  // El `onChange` sólo se llama con un parseo exitoso.
  assert.ok(/if \(!parsed\) return;/.test(CAMPO_WEB), "sin parseo válido no se toca el estado");
});

test("las dos plataformas comparten interfaz y el nativo conserva su picker", () => {
  assert.ok(/DateTimePicker/.test(CAMPO_NATIVO), "el nativo conserva su picker");
  assert.ok(/Platform\.OS === "web"/.test(CAMPO), "la rama web es explícita");
  // Misma firma en las dos: `value: Date` y `onChange(next: Date)`.
  for (const [nombre, src] of [["nativo", CAMPO_NATIVO], ["web", CAMPO_WEB]] as const) {
    assert.ok(/value: Date;/.test(src), `${nombre}: value: Date`);
    assert.ok(/onChange: \(next: Date\) => void;/.test(src), `${nombre}: onChange`);
    assert.ok(/export function BirthDateField/.test(src), `${nombre}: BirthDateField`);
    assert.ok(/export function BirthTimeField/.test(src), `${nombre}: BirthTimeField`);
  }
  const editor = sinComentarios(EDITOR);
  assert.ok(/<BirthDateField value=\{date\} onChange=\{setDate\} \/>/.test(editor));
  assert.ok(/<BirthTimeField value=\{time\} onChange=\{setTime\} disabled=\{timeUnknown\} \/>/.test(editor));
  assert.ok(!/DateTimePicker/.test(editor), "el editor no conoce la implementación");
});

test("las fechas se serializan en componentes LOCALES, no UTC", () => {
  // Con UTC, alguien en UTC-3 vería el día anterior en el input.
  assert.ok(/getFullYear\(\)/.test(CAMPO_WEB) && /getDate\(\)/.test(CAMPO_WEB));
  assert.ok(!/toISOString/.test(CAMPO_WEB), "toISOString correría el día");
});

// --- `No sé la hora` --------------------------------------------------------

test("con la hora desconocida el control se oculta y no se guarda hora", () => {
  for (const [nombre, src] of [["nativo", CAMPO_NATIVO], ["web", CAMPO_WEB]] as const) {
    assert.ok(/if \(disabled\) return null;/.test(src), `${nombre}: el control no se renderiza`);
  }
  const editor = sinComentarios(EDITOR);
  assert.ok(/disabled=\{timeUnknown\}/.test(editor));
  // Y el payload no lleva hora inventada.
  const dominio = readFileSync(join(ROOT, "src/domain/birthEdits.ts"), "utf8");
  assert.ok(/birthTime: edits\.birthTime \?\? undefined/.test(dominio));
});

test("No sé la hora sigue existiendo como control", () => {
  assert.ok(EDITOR.includes("No sé la hora"));
});

// --- Lugar: sólo desde autocompletado ---------------------------------------

test("texto libre sin elegir de la lista no cambia el lugar", () => {
  // `changed: false` → se arrastra el documento remoto, no lo tipeado.
  const payload = buildBackendBirthPayload(
    { birthDate: "1996-11-11", birthTime: "10:32", place: { label: "Rosar", changed: false } },
    COMPLETO
  );
  assert.equal(payload.birthPlaceLabel, COMPLETO.birthPlaceLabel, "no se guarda el texto tipeado");
  assert.equal(payload.latitude, COMPLETO.latitude);
});

test("texto libre con un documento remoto incompleto no se puede guardar", () => {
  const payload = buildBackendBirthPayload(
    { birthDate: "1996-11-11", birthTime: "10:32", place: { label: "Rosar", changed: false } },
    { birthPlaceLabel: "Sin especificar", latitude: undefined, longitude: undefined, timezone: "America/Argentina/Buenos_Aires" }
  );
  assert.throws(() => validateBirthPayload(payload), BirthPayloadError);
});

test("un lugar elegido de la lista trae etiqueta, coordenadas y zona", () => {
  const payload = buildBackendBirthPayload(
    {
      birthDate: "1996-11-11",
      birthTime: "10:32",
      place: {
        label: "Rosario, Santa Fe, Argentina",
        latitude: -32.95,
        longitude: -60.65,
        timezone: "America/Argentina/Cordoba",
        changed: true
      }
    },
    COMPLETO
  );
  const valido = validateBirthPayload(payload);
  assert.equal(valido.birthPlaceLabel, "Rosario, Santa Fe, Argentina");
  assert.equal(valido.timezone, "America/Argentina/Cordoba");
});

// --- Guardado: orden, fallo y sesión no lista -------------------------------

test("se navega SÓLO después de confirmar backend y actualizar lo local", () => {
  const save = sinComentarios(EDITOR);
  // El fin del bloque se busca DESDE el inicio, no desde 0: había un `return (`
  // anterior en el archivo y la porción salía vacía (el test pasaba en falso).
  const desde = save.indexOf("const save = async");
  const bloque = save.slice(desde, save.indexOf("};", save.indexOf("finally", desde)));
  const iBackend = bloque.indexOf("await persistBackend(");
  const iLocal = bloque.indexOf("await updateProfile(");
  const iNav = bloque.indexOf("router.back()");
  assert.ok(iBackend !== -1 && iBackend < iLocal, "backend antes que lo local");
  assert.ok(iLocal < iNav, "navegar recién después de actualizar lo local");
});

test("un guardado fallido conserva los valores, no navega y muestra el error", () => {
  const bloque = sinComentarios(EDITOR);
  const catchBlock = bloque.slice(bloque.indexOf("} catch (e) {"), bloque.indexOf("} finally {"));
  assert.ok(/setSaveError\(/.test(catchBlock), "el error es visible");
  assert.ok(!/router\./.test(catchBlock), "no se navega");
  assert.ok(!/setDate\(|setTime\(|setPickedPlace\(/.test(catchBlock), "los valores tipeados no se tocan");
  // Y se anuncia para lectores de pantalla.
  assert.ok(/accessibilityRole="alert"/.test(EDITOR));
  assert.ok(/accessibilityLiveRegion="polite"/.test(EDITOR));
});

test("sesión no lista → cero escrituras, con reintento", () => {
  const persist = sinComentarios(readFileSync(join(ROOT, "src/onboarding/useAccount.ts"), "utf8"));
  const inner = persist.slice(persist.indexOf("function useProfilePersistInner()"));
  assert.ok(/throw new Error\("PROFILE_SESSION_NOT_READY"\)/.test(inner.slice(0, 900)));
  // El editor sólo aplica lo local DESPUÉS de esperar el backend, así que un
  // rechazo impide también la escritura local.
  const editor = sinComentarios(EDITOR);
  assert.ok(editor.indexOf("await persistBackend(") < editor.indexOf("await updateProfile("));
});

test("se conservan birthSaveGate y el arrastre del documento remoto", () => {
  assert.ok(/birthSaveGate\(/.test(EDITOR), "sigue esperando el documento remoto");
  const dominio = readFileSync(join(ROOT, "src/domain/birthEdits.ts"), "utf8");
  assert.ok(/keepRemotePlace/.test(dominio), "el arrastre sigue siendo útil");
});
