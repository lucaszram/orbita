import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  dateToIsoValue,
  isoDateFrom,
  normalizeDateValue,
  normalizeTimeValue,
  parseDateInput,
  parseTimeInput,
  timeToIsoValue
} from "../src/domain/birthInput";
import {
  INCOMPLETE_BIRTH_MESSAGE,
  canRenderWheel,
  formatBirthLine,
  resolveBirthInfo
} from "../src/domain/birthInfo";
import { buildBackendBirthPayload } from "../src/domain/birthEdits";
import {
  birthEditorReadiness,
  canSaveBirthEditor,
  draftFromSeed,
  draftToEdits,
  isDraftDirty,
  remotePlaceUsable,
  resolveBirthEditorSeed,
  type BirthEditorDraft,
  type BirthEditorSeed
} from "../src/domain/birthEditorSeed";
import { BirthPayloadError, validateBirthPayload } from "../src/domain/birthPayload";

const ROOT = join(import.meta.dirname, "..");
const sinComentarios = (x: string) =>
  x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const CAMPO_NATIVO = readFileSync(join(ROOT, "src/onboarding/components/BirthDateTimeField.tsx"), "utf8");
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

/** Perfil LOCAL con datos DISTINTOS del remoto: si se filtra, se nota. */
const PERFIL_LOCAL = {
  birthDate: "1994-04-12",
  birthTime: "12:00",
  birthPlace: "Sin especificar"
};

const conSesion = (remote: unknown, remoteResolved = true) =>
  resolveBirthEditorSeed({
    authLoading: false,
    signedIn: true,
    remoteResolved,
    remote: remote as never,
    profile: PERFIL_LOCAL
  });

const semilla = (state: ReturnType<typeof resolveBirthEditorSeed>): BirthEditorSeed => {
  assert.equal(state.status, "ready", "se esperaba una semilla resuelta");
  return (state as { status: "ready"; seed: BirthEditorSeed }).seed;
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
  assert.equal(formatBirthLine({ birthDate: "1996-11-11", birthPlaceLabel: "Rosario" }).includes("11 Nov 1996"), true);
});

// --- Semilla del editor: con sesión, SOLO el documento remoto ----------------

test("con sesión la semilla sale del remoto y NO del perfil local", () => {
  const seed = semilla(conSesion(COMPLETO));
  assert.equal(seed.birthDate, "1996-11-11");
  assert.equal(seed.birthTime, "10:32");
  assert.equal(seed.placeLabel, COMPLETO.birthPlaceLabel);
  assert.ok(seed.placeUsable, "el lugar remoto completo se puede arrastrar");
  // Nada del perfil local se filtró.
  assert.notEqual(seed.birthDate, PERFIL_LOCAL.birthDate);
  assert.notEqual(seed.birthTime, PERFIL_LOCAL.birthTime);
  assert.notEqual(seed.placeLabel, PERFIL_LOCAL.birthPlace);
});

test("remoto sin resolver → no hay semilla (ni fecha fija, ni perfil local)", () => {
  const state = conSesion(undefined, false);
  assert.equal(state.status, "loading");
  assert.ok(!("seed" in state), "no se expone ningún valor mientras carga");
  // Y sin semilla no hay borrador, así que no se puede guardar nada.
  const readiness = birthEditorReadiness({ sync: "waiting", seed: null, draft: null });
  assert.equal(readiness, "loading-remote");
  assert.ok(!canSaveBirthEditor(readiness), "cero escrituras con el remoto sin resolver");
});

test("identidad sin confirmar → tampoco se elige origen de datos", () => {
  const state = resolveBirthEditorSeed({
    authLoading: true,
    signedIn: false,
    remoteResolved: true,
    remote: null,
    profile: PERFIL_LOCAL
  });
  assert.equal(state.status, "loading", "no se puede sembrar del perfil local sin saber si hay cuenta");
});

test("la fecha fija 1996-01-15 y el mediodía inventado ya no existen en ningún camino", () => {
  // Antes: `isoToDate(profile?.birthDate ?? "1996-01-15")` y `timeToDate(undefined)` = 12:00.
  const sinNada = semilla(conSesion(null));
  assert.equal(sinNada.birthDate, null, "sin fecha remota la fecha arranca VACÍA");
  assert.equal(sinNada.birthTime, null, "sin hora remota no se inventa un mediodía");
  assert.equal(sinNada.placeLabel, "");
  assert.equal(sinNada.placeUsable, false);
  const draft = draftFromSeed(sinNada);
  assert.equal(draft.birthDate, null);
  assert.equal(draft.timeUnknown, true, "sin hora remota `No sé la hora` arranca activo");
  assert.equal(draftToEdits(draft), null, "un borrador sin fecha no produce payload");
  assert.ok(!EDITOR.includes("1996-01-15"), "la fecha inventada no vuelve al editor");
  assert.ok(!/timeToDate/.test(EDITOR), "el mediodía inventado no vuelve al editor");
});

test("un remoto con fecha basura se trata como ausente, no como dato", () => {
  for (const basura of ["", "  ", "12/04/1994", "1994-4-12", "1994-02-30"]) {
    const seed = semilla(conSesion({ ...COMPLETO, birthDate: basura }));
    assert.equal(seed.birthDate, null, JSON.stringify(basura));
  }
  for (const basura of ["", "24:00", "10", "aa:bb"]) {
    const seed = semilla(conSesion({ ...COMPLETO, birthTime: basura }));
    assert.equal(seed.birthTime, null, JSON.stringify(basura));
  }
});

test("`Sin especificar` remoto no es un lugar elegido", () => {
  const seed = semilla(conSesion({ ...COMPLETO, birthPlaceLabel: "Sin especificar" }));
  assert.equal(seed.placeLabel, "", "el relleno viejo no se muestra como lugar");
  assert.equal(seed.placeUsable, false);
});

test("un lugar remoto sin coordenadas o sin zona no se puede arrastrar", () => {
  assert.equal(remotePlaceUsable(COMPLETO), true);
  assert.equal(remotePlaceUsable(null), false);
  assert.equal(remotePlaceUsable({ ...COMPLETO, latitude: undefined }), false);
  assert.equal(remotePlaceUsable({ ...COMPLETO, timezone: "" }), false);
  // Es la MISMA regla que el borde de escritura: sin fecha no se pronuncia.
  assert.equal(remotePlaceUsable({ ...COMPLETO, birthDate: "" }), true);
});

test("el invitado sí usa el perfil local", () => {
  const seed = semilla(
    resolveBirthEditorSeed({
      authLoading: false,
      signedIn: false,
      remoteResolved: false,
      remote: null,
      profile: { birthDate: "1994-04-12", birthTime: "09:15", birthPlace: "Rosario, Argentina" }
    })
  );
  assert.equal(seed.birthDate, "1994-04-12");
  assert.equal(seed.birthTime, "09:15");
  assert.equal(seed.placeLabel, "Rosario, Argentina");
  assert.ok(seed.placeUsable, "de invitado alcanza la etiqueta: el guardado es local");
});

test("el invitado sin perfil hidratado todavía no siembra", () => {
  const state = resolveBirthEditorSeed({
    authLoading: false,
    signedIn: false,
    remoteResolved: false,
    remote: null,
    profile: null
  });
  assert.equal(state.status, "loading");
});

// --- Base de comparación (dirty) --------------------------------------------

test("con sesión, `cambiado` se mide contra el REMOTO y no contra el perfil local", () => {
  const seed = semilla(conSesion(COMPLETO));
  const draft = draftFromSeed(seed);
  assert.equal(isDraftDirty(seed, draft), false, "recién abierto no hay cambios");
  // El perfil local dice otra cosa: eso NO puede marcar el editor como sucio.
  assert.notEqual(draft.birthDate, PERFIL_LOCAL.birthDate);
  assert.equal(
    birthEditorReadiness({ sync: "ready", seed, draft }),
    "unchanged",
    "Guardar arranca deshabilitado aunque lo local difiera"
  );
});

test("cada campo tocado marca el editor como cambiado", () => {
  const seed = semilla(conSesion(COMPLETO));
  const base = draftFromSeed(seed);
  assert.ok(isDraftDirty(seed, { ...base, birthDate: "1996-11-12" }), "fecha");
  assert.ok(isDraftDirty(seed, { ...base, birthTime: "11:00" }), "hora");
  assert.ok(isDraftDirty(seed, { ...base, timeUnknown: true }), "pasar a `No sé la hora`");
  assert.ok(
    isDraftDirty(seed, {
      ...base,
      place: { label: "Rosario", latitude: -32.95, longitude: -60.65, timezone: "America/Argentina/Cordoba", changed: true }
    }),
    "lugar elegido de la lista"
  );
  // Volver al valor original deja de estar sucio.
  const idaYVuelta: BirthEditorDraft = { ...base, birthDate: "1996-11-12" };
  assert.equal(isDraftDirty(seed, { ...idaYVuelta, birthDate: seed.birthDate }), false);
});

// --- ¿Se puede guardar? ------------------------------------------------------

test("sin fecha, Guardar sigue inválido hasta que la persona elija una", () => {
  const seed = semilla(conSesion({ ...COMPLETO, birthDate: undefined }));
  let draft = draftFromSeed(seed);
  assert.equal(birthEditorReadiness({ sync: "ready", seed, draft }), "missing-date");
  assert.equal(draftToEdits(draft), null);
  // La persona elige una fecha: recién ahí se puede guardar.
  draft = { ...draft, birthDate: "1996-11-11" };
  assert.equal(birthEditorReadiness({ sync: "ready", seed, draft }), "ready");
  assert.deepEqual(draftToEdits(draft)?.birthDate, "1996-11-11");
});

test("sin hora remota queda `No sé la hora`; al apagarlo hace falta elegir una", () => {
  const seed = semilla(conSesion({ ...COMPLETO, birthTime: undefined }));
  const abierto = draftFromSeed(seed);
  assert.equal(abierto.timeUnknown, true);
  assert.equal(abierto.birthTime, null);
  // Recién abierto no hay cambios: nada que guardar.
  assert.equal(birthEditorReadiness({ sync: "ready", seed, draft: abierto }), "unchanged");

  // Apaga `No sé la hora` y no elige nada: no se puede guardar…
  const apagado: BirthEditorDraft = { ...abierto, timeUnknown: false };
  assert.equal(birthEditorReadiness({ sync: "ready", seed, draft: apagado }), "missing-time");
  assert.equal(draftToEdits(apagado), null, "…y no hay payload: nunca un 12:00 silencioso");

  // Elige una hora: ahora sí.
  const elegido: BirthEditorDraft = { ...apagado, birthTime: "06:45" };
  assert.equal(birthEditorReadiness({ sync: "ready", seed, draft: elegido }), "ready");
  assert.equal(draftToEdits(elegido)?.birthTime, "06:45");
});

test("`No sé la hora` activo guarda la hora en null, no un mediodía", () => {
  const seed = semilla(conSesion(COMPLETO));
  const draft: BirthEditorDraft = { ...draftFromSeed(seed), timeUnknown: true };
  assert.equal(birthEditorReadiness({ sync: "ready", seed, draft }), "ready");
  assert.equal(draftToEdits(draft)?.birthTime, null);
  assert.equal(buildBackendBirthPayload(draftToEdits(draft)!, COMPLETO).birthTime, undefined);
});

test("un lugar remoto incompleto exige una elección real del autocompletado", () => {
  const seed = semilla(conSesion({ ...COMPLETO, latitude: undefined, longitude: undefined }));
  const draft = draftFromSeed(seed);
  // Aunque haya fecha y hora, el lugar bloquea.
  assert.equal(birthEditorReadiness({ sync: "ready", seed, draft }), "missing-place");

  // Tipear texto libre no alcanza: `changed` sigue en false.
  const tipeado: BirthEditorDraft = { ...draft, place: { label: "Rosar", changed: false } };
  assert.equal(birthEditorReadiness({ sync: "ready", seed, draft: tipeado }), "missing-place");

  // Elegir de la lista trae etiqueta + coordenadas + zona.
  const elegido: BirthEditorDraft = {
    ...draft,
    place: {
      label: "Rosario, Santa Fe, Argentina",
      latitude: -32.95,
      longitude: -60.65,
      timezone: "America/Argentina/Cordoba",
      changed: true
    }
  };
  assert.equal(birthEditorReadiness({ sync: "ready", seed, draft: elegido }), "ready");
  const payload = buildBackendBirthPayload(draftToEdits(elegido)!, { ...COMPLETO, latitude: undefined, longitude: undefined });
  assert.equal(validateBirthPayload(payload).timezone, "America/Argentina/Cordoba");
});

test("el remoto sin resolver o en reintento gana sobre cualquier otro estado", () => {
  const seed = semilla(conSesion(COMPLETO));
  const draft: BirthEditorDraft = { ...draftFromSeed(seed), birthDate: "1996-11-12" };
  assert.equal(birthEditorReadiness({ sync: "waiting", seed, draft }), "loading-remote");
  assert.equal(birthEditorReadiness({ sync: "retry", seed, draft }), "retry-remote");
  for (const estado of ["loading-remote", "retry-remote", "missing-date", "missing-time", "missing-place", "unchanged"] as const) {
    assert.ok(!canSaveBirthEditor(estado), `${estado} no puede guardar`);
  }
  assert.ok(canSaveBirthEditor("ready"));
});

test("el arrastre del lugar remoto se conserva cuando el lugar no cambió", () => {
  const seed = semilla(conSesion(COMPLETO));
  const draft: BirthEditorDraft = { ...draftFromSeed(seed), birthDate: "1996-11-12" };
  const payload = buildBackendBirthPayload(draftToEdits(draft)!, COMPLETO);
  assert.equal(payload.birthPlaceLabel, COMPLETO.birthPlaceLabel);
  assert.equal(payload.latitude, COMPLETO.latitude);
  assert.equal(payload.timezone, COMPLETO.timezone, "no se cae a la zona del aparato");
});

// --- Formatos de intercambio de los controles --------------------------------

test("un valor que no es fecha válida NO llega al estado", () => {
  for (const malo of ["", "  ", "1996", "11/11/1996", "1996-13-01", "1996-02-30", "abcd-ef-gh"]) {
    assert.equal(parseDateInput(malo), null, JSON.stringify(malo));
    assert.equal(normalizeDateValue(malo), null, JSON.stringify(malo));
  }
  assert.deepEqual(parseDateInput("1996-11-11"), { y: 1996, m: 11, d: 11 });
  assert.equal(normalizeDateValue("1996-11-11"), "1996-11-11");
  // Año bisiesto real vs inventado.
  assert.ok(parseDateInput("2028-02-29"));
  assert.equal(parseDateInput("2027-02-29"), null);
});

test("un valor que no es hora válida NO llega al estado", () => {
  for (const malo of ["", "10", "10:6", "24:00", "10:60", "aa:bb"]) {
    assert.equal(parseTimeInput(malo), null, JSON.stringify(malo));
    assert.equal(normalizeTimeValue(malo), null, JSON.stringify(malo));
  }
  assert.deepEqual(parseTimeInput("10:32"), { h: 10, m: 32 });
  assert.deepEqual(parseTimeInput("00:00"), { h: 0, m: 0 }, "la medianoche es válida");
  // Firefox manda `HH:MM:SS` en `<input type="time">`: los segundos se descartan.
  assert.equal(normalizeTimeValue("10:32:00"), "10:32");
});

test("las fechas se serializan en componentes LOCALES, no UTC", () => {
  // Con UTC, alguien en UTC-3 vería el día anterior. 1 de enero a las 00:30
  // local es el mismo 1 de enero para el control, no el 31 de diciembre.
  const medianoche = new Date(1996, 0, 1, 0, 30, 0, 0);
  assert.equal(dateToIsoValue(medianoche), "1996-01-01");
  assert.equal(isoDateFrom(medianoche), "1996-01-01");
  assert.equal(timeToIsoValue(new Date(1996, 0, 1, 6, 5, 0, 0)), "06:05");
  assert.ok(!/toISOString/.test(CAMPO_NATIVO), "toISOString correría el día");
});

// --- El control de web es del NAVEGADOR (DOM real) ---------------------------

const renderWeb = async (
  pick: "date" | "time",
  props: Record<string, unknown>
): Promise<string> => {
  const { createElement } = await import("react");
  // `react-dom/server` no trae declaraciones y no vale la pena sumar `@types`
  // al proyecto sólo para un test: el retorno se acota abajo, en la firma.
  // @ts-expect-error módulo sin tipos
  const { renderToStaticMarkup } = await import("react-dom/server");
  const mod = await import("../src/onboarding/components/BirthDateTimeField.web");
  const Field = pick === "date" ? mod.BirthDateField : mod.BirthTimeField;
  return renderToStaticMarkup(createElement(Field as never, props as never));
};

test('en web el campo de fecha es un <input type="date"> del navegador', async () => {
  const html = await renderWeb("date", { value: null, onChange: () => undefined });
  assert.match(html, /<input[^>]*type="date"/, "tiene que ser el control del navegador");
  assert.match(html, /<input[^>]*value=""/, "sin valor autoritativo el campo arranca VACÍO");
  assert.match(html, /max="\d{4}-\d{2}-\d{2}"/, "nadie nació mañana");
  assert.match(html, /<label[^>]*for="birth-[^"]*"[^>]*>Fecha<\/label>/, "etiqueta asociada al control");
  assert.match(html, /min-height:44px/, "alto táctil accesible");
  assert.match(html, /aria-describedby="birth-[^"]*-hint"/);
  // El valor autoritativo se muestra tal cual.
  const conValor = await renderWeb("date", { value: "1996-11-11", onChange: () => undefined });
  assert.match(conValor, /<input[^>]*value="1996-11-11"/);
});

test('en web el campo de hora es un <input type="time"> y desaparece con `No sé la hora`', async () => {
  const conValor = await renderWeb("time", { value: "10:32", onChange: () => undefined });
  assert.match(conValor, /<input[^>]*type="time"/);
  assert.match(conValor, /<input[^>]*value="10:32"/);
  assert.match(conValor, /<label[^>]*for="birth-[^"]*"/, "etiqueta asociada al control");
  assert.match(conValor, /min-height:44px/);

  const vacio = await renderWeb("time", { value: null, onChange: () => undefined });
  assert.match(vacio, /<input[^>]*value=""/, "sin hora autoritativa el campo arranca VACÍO");

  const oculto = await renderWeb("time", { value: "10:32", onChange: () => undefined, disabled: true });
  assert.equal(oculto, "", "con `No sé la hora` el control no se renderiza");
});

test("el control web devuelve ausencia cuando lo vacían, no un relleno", async () => {
  const { birthDateInputProps, birthTimeInputProps } = await import(
    "../src/onboarding/components/BirthDateTimeField.web"
  );
  const fechas: Array<string | null> = [];
  const fecha = birthDateInputProps({
    id: "x",
    value: "1996-11-11",
    onChange: (v) => fechas.push(v),
    today: new Date(2026, 6, 30)
  });
  assert.equal(fecha.type, "date");
  assert.equal(fecha.max, "2026-07-30");
  assert.equal(fecha.value, "1996-11-11");
  fecha.onChange!({ currentTarget: { value: "" } } as never);
  fecha.onChange!({ currentTarget: { value: "1996-02-30" } } as never);
  fecha.onChange!({ currentTarget: { value: "1996-11-12" } } as never);
  assert.deepEqual(fechas, [null, null, "1996-11-12"], "vacío y fecha inexistente vuelven como ausencia");
  assert.equal(birthDateInputProps({ id: "x", value: null, onChange: () => undefined, today: new Date() }).value, "");

  const horas: Array<string | null> = [];
  const hora = birthTimeInputProps({ id: "y", value: null, onChange: (v) => horas.push(v) });
  assert.equal(hora.type, "time");
  assert.equal(hora.value, "");
  hora.onChange!({ currentTarget: { value: "" } } as never);
  hora.onChange!({ currentTarget: { value: "06:45" } } as never);
  assert.deepEqual(horas, [null, "06:45"]);
});

test("nativo y web comparten interfaz; el nativo conserva su rueda", () => {
  assert.ok(/DateTimePicker/.test(CAMPO_NATIVO), "el nativo conserva su picker");
  assert.ok(/display="spinner"/.test(CAMPO_NATIVO), "la rueda sigue siendo la rueda");
  assert.ok(/maximumDate/.test(CAMPO_NATIVO));
  assert.ok(/if \(disabled\) return null;/.test(CAMPO_NATIVO), "`No sé la hora` oculta el control");
  const editor = sinComentarios(EDITOR);
  assert.ok(!/DateTimePicker/.test(editor), "el editor no conoce la implementación");
  assert.ok(!/Platform\.OS === "web"/.test(editor), "la plataforma la resuelve Metro, no un if");
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
  // La guarda pasó a ser el gate compartido (`personalChartGate`), que además de
  // exigir datos completos exige que la carta CORRESPONDA a esos datos.
  const guarda = codigo.indexOf('chartGate === "datosIncompletos"');
  const mapea = codigo.indexOf("mapNatalChart(doc)");
  assert.ok(guarda !== -1 && guarda < mapea, "la guarda va ANTES de mapear la carta");
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
  assert.ok(!/setDraft\(|setSeed\(|setPlaceQuery\(/.test(catchBlock), "los valores elegidos no se tocan");
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
