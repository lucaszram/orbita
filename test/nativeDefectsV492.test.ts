/**
 * Los siete defectos funcionales que registró la certificación nativa V4.9.2
 * (`.local/audits/native-v492-certification-2026-08-16/README.md`, sección 6).
 *
 * Cada bloque nombra el defecto, lo que se midió en el simulador y qué impide
 * que vuelva. Donde la garantía es una REGLA se prueba la regla —esas funciones
 * viven en `src/domain` justamente para poder verificarlas sin simulador—; donde
 * es composición se prueba la composición, y se dice cuál es cuál.
 *
 * Lo que estos gates NO reemplazan: el recorrido real con VoiceOver, el gesto de
 * arrastre y la comparación visual contra los frames. Eso se hace en el
 * simulador y se registra en la auditoría.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  birthEditorBlockMessage,
  birthEditorReadiness,
  canSaveBirthEditor,
  type BirthEditorReadiness
} from "../src/domain/birthEditorSeed";
import {
  canConfirmBirthWheel,
  WHEEL_HOURS,
  WHEEL_MINUTES,
  WHEEL_MONTHS,
  wheelYears
} from "../src/domain/birthWheels";
import { createExclusiveGate, runExclusive } from "../src/domain/exclusive";
import { tabPressAction } from "../src/domain/tabPress";
import { isTransientLayerError, LAYER_RACE_ERROR, layerRetryDelay } from "../src/domain/layerRetry";
import { createRefreshQueue } from "../src/domain/refreshQueue";
import { natalChartState } from "../src/domain/natalChartState";
import type { NatalChartBase } from "../src/services/layersApi";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const TAB_BAR = "src/components/orbita/TabBar.tsx";
const CAMPO = "src/onboarding/components/BirthDateTimeField.tsx";
const RUEDA = "src/onboarding/components/Wheel.tsx";
const EDITOR = "app/editar-datos.tsx";
const CARTA_HUB = "src/screens/v492/CartaHubScreen.tsx";
const CARTA_COMPLETA = "src/screens/v492/CartaCompletaV492Screen.tsx";

// ---------------------------------------------------------------------------
// D1 — la barra de pestañas se amontonaba a la izquierda
//
// Medido con el árbol de accesibilidad de iOS, IDÉNTICO en 375, 393 y 440 pt:
// los cinco ítems ocupaban de x=2 a x=195 y "Hoy" medía 18 pt de ancho contra el
// mínimo accesible de 44. Un toque destinado a "Perfil" abrió "Umbral".
// ---------------------------------------------------------------------------

test("D1 · las cinco pestañas se reparten todo el ancho y ninguna baja de 44 pt", () => {
  const source = sinComentarios(leer(TAB_BAR));

  // La fila declara su ancho: sin esto queda del tamaño de su contenido, que es
  // exactamente cómo se amontonaron a la izquierda.
  assert.match(source, /width:\s*"100%"/, "la barra tiene que ocupar el ancho de la pantalla");
  // Y cada ítem crece desde base cero: `flex: 1` dependía de un ancho ya
  // resuelto en el contenedor y ahí es donde fallaba.
  assert.match(source, /flexBasis:\s*0/, "cada pestaña reparte desde base cero");
  assert.match(source, /flexGrow:\s*1/, "cada pestaña crece a un quinto del ancho");
  assert.match(source, /minHeight:\s*44/, "mínimo táctil accesible");
  assert.match(source, /minWidth:\s*44/, "mínimo táctil accesible");

  // El `style` NO puede volver a la forma función: la interoperación de
  // NativeWind la descarta entera, y ese fue el otro motivo del amontonamiento.
  assert.doesNotMatch(
    source,
    /style=\{\s*\(\s*\{[^}]*\}\s*\)\s*=>/,
    "un style en forma función se pierde y la pestaña queda sin su ancho"
  );
});

test("D1 · cada pestaña se anuncia como pestaña y re-tocar la activa no navega", () => {
  const source = sinComentarios(leer(TAB_BAR));

  assert.match(source, /accessibilityRole="tablist"/);
  assert.match(source, /accessibilityRole="tab"/);
  assert.match(source, /accessibilityState=\{\{\s*selected:\s*focused\s*\}\}/);
  // Re-tocar la pestaña activa lo resuelve el navegador (vuelve al principio de
  // ese stack); navegar de nuevo por nuestra cuenta rompería ese historial. La
  // regla se ejecuta —vive en `@/domain/tabPress`, sin React— en vez de buscar
  // la forma del `if` en el archivo.
  assert.deepEqual(
    tabPressAction({ name: "transitos", focused: true, defaultPrevented: false }),
    { kind: "none" },
    "re-tocar la pestaña activa no puede relanzar la navegación"
  );
  assert.deepEqual(
    tabPressAction({ name: "transitos", focused: false, defaultPrevented: true }),
    { kind: "none" },
    "y un `tabPress` vetado tampoco"
  );
  // Y la barra usa esa decisión: sin esto el gate juzgaría un módulo que nadie
  // llama. El resto de la regla se prueba en `tabPressV492`.
  assert.match(source, /const accion = tabPressAction\(\{/);
  assert.match(source, /if \(accion\.kind === "none"\) return;/);
});

test("D1 · Dynamic Type reflowea el label en vez de encogerlo o recortarlo", () => {
  const source = sinComentarios(leer(TAB_BAR));

  assert.match(source, /numberOfLines=\{2\}/, "el label envuelve a dos líneas");
  assert.match(source, /maxFontSizeMultiplier=\{2\}/, "llega al rango accesible de iOS");

  // Ni la barra ni la pestaña pueden fijar su alto: con el texto escalado tienen
  // que crecer. (El subrayado sí lo fija: son 2 pt de línea, no una caja de
  // texto, así que se mira sólo dentro de los dos bloques que contienen texto.)
  for (const bloque of ["bar", "item"]) {
    const estilo = new RegExp(`\\b${bloque}:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`).exec(source)?.[1] ?? "";
    assert.ok(estilo.length > 0, `no se encontró el estilo «${bloque}»`);
    assert.doesNotMatch(
      estilo,
      /(?:^|[^n])\bheight:\s*\d/,
      `${bloque}: un alto fijo recorta el label escalado`
    );
  }
});

// ---------------------------------------------------------------------------
// D2 — las ruedas capturaban cualquier arrastre y corrompían el dato
//
// Medido tres veces: `4 de mayo` → `27 de mayo`, `1994` → `1992`, `09:12` →
// `09:24`, y en el editor propio `16 de agosto` → `23 de agosto`. Para llegar a
// GUARDAR hay que scrollear, y ese scroll cambiaba el valor. Una vez se guardó
// efectivamente mal y hubo que borrar la persona y rehacerla.
// ---------------------------------------------------------------------------

test("D2 · la rueda vive en una hoja modal, fuera del scroll del formulario", () => {
  const source = sinComentarios(leer(CAMPO));

  assert.match(source, /<Modal\b/, "la rueda no puede compartir el gesto con la página");
  // Y lo que queda en el formulario es una fila que se toca, no una superficie
  // que se arrastra: sobre ella un arrastre scrollea la página.
  assert.match(source, /accessibilityRole="button"/, "el formulario muestra un botón, no una rueda");
  // La rueda del sistema no vuelve: además del inglés, era la que capturaba el
  // arrastre por ocupar casi todo el viewport.
  assert.doesNotMatch(source, /DateTimePicker/, "la rueda del sistema capturaba el arrastre");
});

test("D2 · mover la rueda no toca el valor guardado hasta confirmar", () => {
  const source = sinComentarios(leer(CAMPO));

  // La hoja edita un borrador propio; `onChange` del campo sólo se llama desde
  // la confirmación. Si `onChange` apareciera dentro de las columnas, arrastrar
  // volvería a escribir el dato sin que nadie lo confirme.
  assert.match(source, /onConfirm=\{\(borrador\)\s*=>\s*\{[\s\S]{0,160}onChange\(/);
  assert.match(source, /onCancel=\{\(\)\s*=>\s*setAbierto\(false\)\}/, "cancelar deja todo como estaba");
});

// ---------------------------------------------------------------------------
// D3 — el picker estaba en inglés y sin etiquetas accesibles
//
// `January…December` y `AM/PM` en una app íntegramente en español con voseo, y
// las tres columnas expuestas como `AXSlider` con `AXLabel: null`.
// ---------------------------------------------------------------------------

test("D3 · los meses están en español y la hora es de 24 horas", () => {
  assert.equal(WHEEL_MONTHS.length, 12);
  assert.equal(WHEEL_MONTHS[0], "Enero");
  assert.equal(WHEEL_MONTHS[11], "Diciembre");
  for (const mes of WHEEL_MONTHS) {
    assert.doesNotMatch(mes, /^(January|February|March|April|May|June|July|August|September|October|November|December)$/);
  }

  assert.equal(WHEEL_HOURS.length, 24, "24 h, no 12 con AM/PM");
  assert.equal(WHEEL_HOURS[0], "00");
  assert.equal(WHEEL_HOURS[23], "23");
  assert.equal(WHEEL_MINUTES.length, 60);
  assert.equal(WHEEL_MINUTES[0], "00");
  assert.equal(WHEEL_MINUTES[59], "59");
  for (const hora of WHEEL_HOURS) {
    assert.doesNotMatch(hora, /AM|PM/i);
  }
});

test("D3 · los años van del actual hacia atrás y no ofrecen el futuro", () => {
  const anios = wheelYears(2026, 5);
  assert.deepEqual([...anios], ["2026", "2025", "2024", "2023", "2022"]);
});

test("D3 · cada columna se nombra y se opera con el gesto de VoiceOver", () => {
  const rueda = sinComentarios(leer(RUEDA));

  // El defecto exacto era `AXLabel: null`: la columna existía como control pero
  // sin nombre, y tres seguidas sonaban idénticas.
  assert.match(rueda, /accessibilityLabel=\{label\}/, "la columna se nombra");
  // `adjustable` es el rol que VoiceOver opera deslizando arriba/abajo, y las
  // acciones lo hacen usable sin arrastrar sobre una fila de 40 pt.
  assert.match(rueda, /accessibilityRole="adjustable"/);
  assert.match(rueda, /accessibilityValue=\{\{\s*text:\s*items\[index\]\s*\}\}/, "anuncia el valor, no el índice");
  assert.match(rueda, /name:\s*"increment"/);
  assert.match(rueda, /name:\s*"decrement"/);
  // Las 60 filas de minutos no pueden ser 60 paradas del foco antes del botón.
  assert.match(rueda, /accessibilityElementsHidden/);

  const campo = sinComentarios(leer(CAMPO));
  assert.match(
    campo,
    /label:\s*"Día"[\s\S]*label:\s*"Mes"[\s\S]*label:\s*"Año"/,
    "la fecha nombra sus tres columnas"
  );
  assert.match(campo, /label:\s*"Hora"[\s\S]*label:\s*"Minuto"/, "la hora nombra sus dos columnas");
});

// ---------------------------------------------------------------------------
// D4 — "Guardar cambios" no respondía y no decía por qué
//
// Se tocó cuatro veces sin navegación, sin cambio visible y sin una sola llamada
// al backend. Recién guardó después de volver a elegir la ciudad.
// ---------------------------------------------------------------------------

const ESTADOS: readonly BirthEditorReadiness[] = [
  "loading-remote",
  "retry-remote",
  "missing-date",
  "missing-time",
  "missing-place",
  "place-needs-refresh",
  "unchanged",
  "ready"
];

test("D4 · ningún estado bloqueado deja el botón mudo", () => {
  for (const estado of ESTADOS) {
    const mensaje = birthEditorBlockMessage(estado);
    if (canSaveBirthEditor(estado)) {
      assert.equal(mensaje, null, `${estado}: si se puede guardar no hay nada que avisar`);
    } else {
      assert.ok(
        mensaje && mensaje.trim().length > 0,
        `${estado}: un botón apagado sin explicación se lee como un botón roto`
      );
    }
  }
});

test("D4 · un lugar guardado y completo sigue siendo válido; uno incompleto dice qué le falta", () => {
  const seedCompleto = {
    birthDate: "1996-08-16",
    birthTime: "12:00",
    placeLabel: "Buenos Aires, Argentina",
    placeUsable: true
  };
  const draft = {
    birthDate: "1996-11-12",
    birthTime: "12:00",
    timeUnknown: false,
    place: { label: "Buenos Aires, Argentina", changed: false }
  };

  // No hay que volver a elegir la ciudad para poder guardar otro dato.
  assert.equal(birthEditorReadiness({ sync: "ready", seed: seedCompleto, draft }), "ready");

  // Con el lugar guardado pero incompleto, el bloqueo se nombra distinto de
  // "no elegiste ninguno": la ciudad está a la vista y lo que falta es lo de
  // atrás. Decir lo mismo en los dos casos mandaba a buscar una ciudad ya cargada.
  const seedIncompleto = { ...seedCompleto, placeUsable: false };
  const estado = birthEditorReadiness({ sync: "ready", seed: seedIncompleto, draft });
  assert.equal(estado, "place-needs-refresh");
  assert.match(birthEditorBlockMessage(estado)!, /zona horaria/i);

  // Y sin ningún lugar guardado, el mensaje es el de elegir uno.
  const seedVacio = { ...seedCompleto, placeLabel: "", placeUsable: false };
  assert.equal(birthEditorReadiness({ sync: "ready", seed: seedVacio, draft }), "missing-place");
});

test("D4 · sin cambios el botón se apaga, pero lo dice", () => {
  const seed = {
    birthDate: "1996-08-16",
    birthTime: "12:00",
    placeLabel: "Buenos Aires, Argentina",
    placeUsable: true
  };
  const draft = { birthDate: "1996-08-16", birthTime: "12:00", timeUnknown: false, place: { label: "Buenos Aires, Argentina", changed: false } };
  assert.equal(birthEditorReadiness({ sync: "ready", seed, draft }), "unchanged");
  assert.match(birthEditorBlockMessage("unchanged")!, /no cambiaste nada/i);
});

test("D4 · el botón bloqueado se ve y se anuncia bloqueado", () => {
  const cta = sinComentarios(leer("src/onboarding/components/CTA.tsx"));
  assert.match(cta, /accessibilityState=\{\{\s*disabled:\s*Boolean\(disabled\)\s*\}\}/);
  assert.match(cta, /disabled\s*\?\s*orbita\.copperOff/, "un CTA apagado no puede verse igual que uno activo");
});

test("D4 · no hay submits dobles: la guarda cierra en el mismo tick", () => {
  const editor = sinComentarios(leer(EDITOR));
  assert.match(editor, /if\s*\(!draft\s*\|\|\s*saving\s*\|\|\s*!canSaveBirthEditor\(readiness\)\)\s*return/);
  const conectar = sinComentarios(leer("src/screens/v492/VinculosConnectScreen.tsx"));
  // `saving` recién existe en el render siguiente: el ref es lo que evita que
  // dos toques del mismo tick entren los dos.
  assert.match(conectar, /if\s*\(enVuelo\.current\s*\|\|\s*block\s*!==\s*null\)\s*return/);
});

// ---------------------------------------------------------------------------
// D9 — el candado del guardado y del borrado era estado de React
//
// `saving` y `borrando` son `useState`: se aplican en el render SIGUIENTE. Dos
// toques dentro del mismo render leen los dos el valor viejo, los dos pasan la
// guarda y los dos llegan al backend. En el borrado era peor: `borrando` se
// encendía DESPUÉS de la confirmación, así que dos toques abrían dos alertas.
//
// Estas pruebas ejercitan el coordinador REAL, no buscan una palabra: el mismo
// `createExclusiveGate` que usan las pantallas, con dos entradas en el mismo
// tick, contando cuántas veces corrió el trabajo.
// ---------------------------------------------------------------------------

/** Cede el turno al bucle de eventos, como haría cualquier `await` real. */
const cede = () => new Promise((resolve) => setTimeout(resolve, 0));

test("D9 · el candado es sincrónico: dos entradas del mismo tick, una sola corrida", async () => {
  const gate = createExclusiveGate();
  let corridas = 0;
  const tarea = async () => {
    corridas += 1;
    await cede();
    return corridas;
  };

  // Las dos llamadas salen ANTES de que la primera llegue a su primer await:
  // es exactamente el doble toque del mismo render.
  const [a, b] = await Promise.all([runExclusive(gate, tarea), runExclusive(gate, tarea)]);
  assert.equal(corridas, 1, "la segunda entrada no puede correr");
  assert.equal(a.ran, true);
  assert.equal(b.ran, false);
  assert.equal(b.value, null);

  // Y con el candado libre otra vez, el reintento SÍ corre: un candado que no
  // se suelta deja la acción muerta hasta remontar la pantalla.
  assert.equal(gate.held(), false);
  const c = await runExclusive(gate, tarea);
  assert.equal(c.ran, true);
  assert.equal(corridas, 2);
});

test("D9 · el candado se suelta también cuando la acción falla", async () => {
  const gate = createExclusiveGate();
  await assert.rejects(
    runExclusive(gate, async () => {
      await cede();
      throw new Error("backend caído");
    }),
    /backend caído/
  );
  assert.equal(gate.held(), false, "un error no puede dejar el botón muerto");
});

test("D9 · dos toques de BORRAR abren una sola confirmación y una sola mutation", async () => {
  // El handler real de `VinculosResultScreen`, con su forma exacta: el candado
  // se toma ANTES de esperar la confirmación, se pregunta, y recién con el "sí"
  // se llama a la mutation.
  const gate = createExclusiveGate();
  let confirmaciones = 0;
  let borrados = 0;
  const confirm = async () => {
    confirmaciones += 1;
    await cede();
    return true;
  };
  const borrar = () =>
    runExclusive(gate, async () => {
      if (!(await confirm())) return;
      borrados += 1;
    });

  await Promise.all([borrar(), borrar()]);
  assert.equal(confirmaciones, 1, "dos alertas encimadas era el defecto exacto");
  assert.equal(borrados, 1);

  // Cancelar suelta el candado: si no, la persona no podría volver a intentarlo.
  const gate2 = createExclusiveGate();
  let preguntas = 0;
  const cancelar = () =>
    runExclusive(gate2, async () => {
      preguntas += 1;
      await cede();
      return;
    });
  await cancelar();
  assert.equal(gate2.held(), false);
  await cancelar();
  assert.equal(preguntas, 2, "después de cancelar se puede volver a borrar");
});

test("D9 · las dos pantallas toman el candado ANTES de su primer await", () => {
  const editor = sinComentarios(leer(EDITOR));
  const vinculo = sinComentarios(leer("src/screens/v492/VinculosResultScreen.tsx"));

  for (const [nombre, source] of [
    ["editar-datos", editor],
    ["VinculosResultScreen", vinculo]
  ] as const) {
    assert.match(source, /createExclusiveGate\(\)/, `${nombre} necesita el candado real`);
    assert.match(source, /useRef\(createExclusiveGate\(\)\)\.current/, `${nombre}: uno por montaje`);
    assert.match(source, /runExclusive\(/, `${nombre} tiene que correr dentro del candado`);
  }

  // Y en el borrado, la confirmación queda ADENTRO: si quedara afuera, el
  // candado se tomaría después del hueco que abre el `await`.
  const borrar = /const borrar = async \(\) => \{[\s\S]*?\n  \};/.exec(vinculo)?.[0] ?? "";
  assert.ok(borrar, "no se encontró el handler de borrado");
  assert.ok(
    borrar.indexOf("runExclusive(") < borrar.indexOf("await confirm("),
    "el candado se toma antes de esperar la confirmación"
  );
});

// ---------------------------------------------------------------------------
// D5 — el primer refresh después del alta fallaba y REINTENTAR no lo recuperaba
//
// `LAYER_INPUT_CHANGED_DURING_REFRESH`: el refresh sale mientras los datos
// natales del alta todavía se escriben. Se tocó REINTENTAR dos veces, 20-25 s,
// sin una sola llamada nueva al backend. Sólo relanzar la app lo recuperó.
// ---------------------------------------------------------------------------

test("D5 · la carrera del alta se reconoce aunque Convex envuelva el mensaje", () => {
  assert.ok(isTransientLayerError(new Error(LAYER_RACE_ERROR)));
  // Convex antepone su encabezado; comparar por igualdad no reconocería nada.
  assert.ok(
    isTransientLayerError(
      new Error(`[Request ID: abc123] Server Error\nUncaught Error: ${LAYER_RACE_ERROR} at convex/layers.ts:2991`)
    )
  );
  assert.ok(isTransientLayerError(`${LAYER_RACE_ERROR}`));

  // Y NO se traga cualquier otro fallo: un backend caído no puede reintentarse
  // solo para siempre, tiene que decirse.
  assert.equal(isTransientLayerError(new Error("Network request failed")), false);
  assert.equal(isTransientLayerError(null), false);
  assert.equal(isTransientLayerError(undefined), false);
});

test("D5 · el reintento automático es finito y creciente", () => {
  const esperas = [1, 2, 3].map((intento) => layerRetryDelay(intento));
  assert.ok(esperas.every((espera) => typeof espera === "number" && espera > 0));
  for (let i = 1; i < esperas.length; i += 1) {
    assert.ok(esperas[i]! > esperas[i - 1]!, "cada espera es mayor que la anterior");
  }
  // Cuatro intentos ya no: un backend caído dejaría de ser un bucle.
  assert.equal(layerRetryDelay(4), null);
  assert.equal(layerRetryDelay(0), null);
  assert.equal(layerRetryDelay(-1), null);
  assert.equal(layerRetryDelay(1.5), null);
});

test("D5 · el reintento explícito vuelve a lanzar de verdad y devuelve el crédito", async () => {
  // La política vive en la cola (`src/domain/refreshQueue.ts`), así que ahora se
  // prueba corriéndola en vez de buscando nombres en el hook: la carrera del
  // alta se reintenta sola hasta agotar el crédito, y un reintento explícito lo
  // devuelve. Sin eso, el segundo fallo real dejaría el botón sin reintentos
  // disponibles y sin decirlo.
  const corridas: Array<(error: unknown) => void> = [];
  const esperas: number[] = [];
  let fallo: boolean | null = null;
  const cola = createRefreshQueue({
    run: () => new Promise<void>((_resolve, reject) => corridas.push(reject)),
    alive: () => true,
    onBusyChange: () => undefined,
    onFailedChange: (valor) => {
      fallo = valor;
    },
    sleep: async (ms) => {
      esperas.push(ms);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
  const carrera = () => new Error(`[Request ID: x] Server Error ${LAYER_RACE_ERROR}`);
  const cae = async (indice: number) => {
    corridas[indice](carrera());
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  };

  cola.request({ localDate: "2026-08-17", timezone: "UTC" });
  for (let intento = 0; intento < 4; intento += 1) await cae(intento);
  assert.deepEqual(esperas, [1500, 4500, 9000], "tres reintentos automáticos, crecientes");
  assert.equal(fallo, true, "agotado el crédito, se dice");

  // El reintento explícito del hook devuelve el crédito antes de volver a pedir.
  cola.resetRetries();
  cola.request({ localDate: "2026-08-17", timezone: "UTC" });
  await cae(4);
  assert.deepEqual(esperas, [1500, 4500, 9000, 1500], "vuelve a tener reintentos automáticos");

  // Y el hook es el que llama a ese reset en su reintento explícito.
  const hook = sinComentarios(leer("src/hooks/useLayers.tsx"));
  assert.match(hook, /createRefreshQueue\(/, "la cola es la compartida, no una copia");
  assert.match(hook, /cola\.resetRetries\(\)/);
});

// ---------------------------------------------------------------------------
// D6 — el editor proponía medianoche cuando no había hora guardada
//
// La rueda arrancaba en 12:00 AM. Quien reactivara "sí sé la hora" y guardara
// sin tocarla, guardaba las 00:00 en silencio.
// ---------------------------------------------------------------------------

test("D6 · sin valor previo no se puede confirmar sin elegir", () => {
  // Éste es el caso exacto que se midió: campo vacío, nadie tocó la rueda.
  assert.equal(
    canConfirmBirthWheel({ requiresChoice: true, touched: false, problem: null }),
    false,
    "el ancla de la rueda no es una propuesta"
  );
  assert.equal(canConfirmBirthWheel({ requiresChoice: true, touched: true, problem: null }), true);
});

test("D6 · con un valor previo, confirmarlo tal cual sí es una elección", () => {
  assert.equal(canConfirmBirthWheel({ requiresChoice: false, touched: false, problem: null }), true);
});

test("D6 · un valor inválido nunca se confirma, se haya tocado o no", () => {
  for (const requiresChoice of [true, false]) {
    for (const touched of [true, false]) {
      assert.equal(
        canConfirmBirthWheel({ requiresChoice, touched, problem: "Ese día no existe en ese mes." }),
        false
      );
    }
  }
});

test("D6 · el campo declara que no propone ninguna hora", () => {
  const campo = sinComentarios(leer(CAMPO));
  assert.match(campo, /No suponemos ninguna/i, "la falta de hora se dice, no se rellena");
  assert.match(campo, /No proponemos ningún valor/i, "la hoja lo repite donde se elige");
  // El ancla existe sólo para dibujar la rueda, y es explícita.
  assert.match(campo, /ANCLA_HORA/);
  assert.match(campo, /requiereEleccion=\{parts === null\}/);
});

// ---------------------------------------------------------------------------
// D7 — el recálculo natal se leía como una falla terminal
//
// Tras quitar la hora, `/perfil/carta` mostró "TU CARTA TODAVÍA NO ESTÁ
// CALCULADA" durante ~2-3 minutos antes de resolver bien. No era un error
// —resolvía solo— pero se leía como uno mientras duraba.
// ---------------------------------------------------------------------------

test("D7 · el recálculo se presenta en curso, no como una carta que no existe", () => {
  for (const rel of [CARTA_HUB, CARTA_COMPLETA]) {
    const source = sinComentarios(leer(rel));
    assert.match(
      source,
      /SE ESTÁ CALCULANDO|CALCULANDO TU CARTA/,
      `${rel}: el estado tiene que nombrar el trabajo en curso`
    );
    assert.doesNotMatch(
      source,
      /TODAVÍA NO ESTÁ CALCULADA/,
      `${rel}: "no está calculada" se lee como que algo se rompió`
    );
    // Y se dice cuánto puede tardar: sin eso, dos minutos de espera son
    // indistinguibles de una pantalla colgada.
    assert.match(source, /puede tardar un par de minutos/i, `${rel}: falta decir cuánto tarda`);
    // Los datos no se perdieron, y no se rellena con una carta vieja ni de ejemplo.
    assert.match(source, /Tus datos siguen guardados/, `${rel}: falta conservar el contexto útil`);
    assert.match(source, /COMPROBAR DE NUEVO|COMPROBANDO…/, `${rel}: tiene que ser recuperable sin salir`);
  }
});

test("D7 · «se está calculando» sólo con una corrida VIVA; sin ella, estado recuperable", () => {
  // La corrección que pide la auditoría independiente: la pantalla decía "TU
  // CARTA SE ESTÁ CALCULANDO" mirando `access.positions`, un campo que no habla
  // de corridas. Sin ninguna corrida activa esa frase promete un final que no
  // va a llegar solo.
  const sinSnapshot = {
    methodVersion: "m",
    providerVersion: null,
    inputHash: "h",
    status: "unavailable" as const,
    observedAt: 0,
    birthTimePrecision: "known" as const,
    calculationTimeSource: "exact_birth_time" as const,
    access: { isPro: false, positions: false, angles: false, houses: false, aspects: false },
    positions: [],
    angles: [],
    houses: [],
    aspects: [],
    missingInputs: ["canonical_natal_ephemeris"],
    limitations: ["Todavía no hay posiciones canónicas calculadas para estos datos."]
  } as unknown as NatalChartBase;

  const enCurso = natalChartState({ chart: sinSnapshot, refreshing: true });
  assert.equal(enCurso.phase, "calculando");
  assert.equal(enCurso.canRetry, false, "mientras la corrida vive no hay nada que relanzar");

  const detenido = natalChartState({ chart: sinSnapshot, refreshing: false });
  assert.equal(detenido.phase, "sin-calculo");
  assert.equal(detenido.canRetry, true);

  // La transición real de D7, en orden: se guarda la hora → arranca la corrida →
  // llega el snapshot. Ningún paso vuelve atrás ni se queda colgado.
  const secuencia = [
    natalChartState({ chart: undefined, refreshing: false }).phase,
    natalChartState({ chart: sinSnapshot, refreshing: true }).phase,
    natalChartState({
      chart: { ...sinSnapshot, status: "ready", access: { ...sinSnapshot.access, positions: true } },
      refreshing: false
    }).phase
  ];
  assert.deepEqual(secuencia, ["cargando", "calculando", "listo"]);

  // Y si la corrida termina sin publicar, se pasa al estado recuperable en vez
  // de seguir prometiendo un cálculo.
  assert.equal(
    natalChartState({ chart: sinSnapshot, refreshing: false, refreshFailed: true }).phase,
    "sin-calculo"
  );
});

test("D7 · el estado en curso se anuncia solo a quien usa lector de pantalla", () => {
  for (const rel of [CARTA_HUB, CARTA_COMPLETA]) {
    const source = sinComentarios(leer(rel));
    assert.match(source, /accessibilityLiveRegion/, `${rel}: el cambio de estado tiene que anunciarse`);
  }
});
