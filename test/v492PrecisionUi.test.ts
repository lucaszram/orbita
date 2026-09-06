/**
 * Precisión visible V4.9.2.
 *
 * El backend ya publica valores centrales y, cuando corresponde, intervalos.
 * Estos gates impiden que la capa nativa presente el centro de un intervalo
 * como si fuera exacto, que oculte un sobre stale o que cambie de ciclo el
 * mismo día de un Cumpleluna ya ocurrido.
 *
 * Son pruebas puras/estructurales: no fijan la composición visual ni los
 * nombres de helpers de implementación.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { cumplelunaExactToday } from "../src/domain/layers";
import type { CumplelunaData } from "../src/services/layersApi";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const HOY = "src/screens/v492/HoyScreen.tsx";
const CUMPLELUNA = "src/screens/v492/CumplelunaDetailScreen.tsx";
const TIPO_LUNAR = "src/screens/v492/TipoLunarDetailScreen.tsx";
const ARCO = "src/screens/v492/ArcoDetailScreen.tsx";
const MOMENTO = "src/screens/v492/TransitosLayersScreen.tsx";

function seccion(source: string, desde: string, hasta?: string): string {
  const inicio = source.indexOf(desde);
  assert.ok(inicio >= 0, `no se encontró «${desde}»`);
  const fin = hasta ? source.indexOf(hasta, inicio + desde.length) : source.length;
  assert.ok(fin > inicio, hasta ? `no se encontró «${hasta}» después de «${desde}»` : desde);
  return source.slice(inicio, fin);
}

test("Cumpleluna estimado o en rango consume las ventanas publicadas, no sólo sus puntos medios", () => {
  const detail = sinComentarios(leer(CUMPLELUNA));
  const hoy = sinComentarios(leer(HOY));
  const presentation = sinComentarios(leer("src/domain/layers.ts"));
  const recorridoVisible = `${detail}\n${hoy}\n${presentation}`;

  for (const campo of [
    "natalElongationRangeDegrees",
    "nextExactAtRange",
    "daysRemainingRange",
    "cycleDayRange",
    "cycleLengthDaysRange",
    "progressRange"
  ]) {
    assert.match(
      recorridoVisible,
      new RegExp(`\\b${campo}\\b`),
      `la presentación de Cumpleluna todavía ignora ${campo}`
    );
  }

  assert.match(
    detail,
    /envelope\.precision\s*(?:===|!==)\s*["']exact["']/,
    "el detalle debe separar el camino exacto del estimado/en rango"
  );
  assert.match(
    hoy,
    /<CumplelunaBloque[\s\S]{0,500}?\bprecision=\{cumpleluna\.precision\}/,
    "el bloque de Hoy necesita la precisión del sobre para elegir punto o intervalo"
  );
});

test("un Cumpleluna exacto que ya ocurrió hoy sigue mostrando el evento de hoy", () => {
  const previousExactAt = Date.UTC(2026, 7, 15, 3, 10);
  const nowMs = Date.UTC(2026, 7, 15, 22, 0);
  const nextExactAt = Date.UTC(2026, 8, 13, 16, 30);
  const data: CumplelunaData = {
    kind: "cumpleluna",
    natalElongationDegrees: 108,
    currentElongationDegrees: 111,
    previousExactAt,
    nextExactAt,
    daysRemaining: 28.77,
    cycleDay: 0.78,
    cycleLengthDays: 29.55,
    progress: 0.026,
    summary: "Fixture de presentación."
  };

  assert.equal(
    cumplelunaExactToday(data, nowMs, "UTC"),
    previousExactAt,
    "el evento civil de hoy no debe saltar a la repetición del mes siguiente"
  );

  // El canon reordenó Hoy en bloques (`BloqueHoy[]`) en vez de módulos sueltos,
  // así que el ancla ya no es `const cumplelunaModule`. Lo que se sigue exigiendo
  // es lo mismo: que el evento de hoy resuelto por el dominio llegue al bloque
  // visible y participe del texto, no que quede como prop ignorada.
  const hoy = sinComentarios(leer(HOY));
  const prop = /<CumplelunaBloque[\s\S]{0,500}?\b([A-Za-z][A-Za-z0-9]*)=\{cumplelunaHoyAt\}/.exec(
    hoy
  )?.[1];
  assert.ok(
    prop,
    "el bloque visible debe recibir el evento de hoy que ya resolvió el dominio"
  );

  const bloque = seccion(hoy, "function CumplelunaBloque", "\nfunction cumplelunaCuando");
  const usos = bloque.match(new RegExp(`\\b${prop}\\b`, "g"))?.length ?? 0;
  assert.ok(
    usos >= 3,
    "el evento de hoy debe participar del rótulo/fecha visible, no quedar como prop ignorada"
  );
});

test("Tipo lunar no imprime un ángulo ni una iluminación singular cuando la precisión no es exacta", () => {
  const source = sinComentarios(leer(TIPO_LUNAR));
  const exactFlag = /const\s+([A-Za-z][A-Za-z0-9]*)\s*=\s*envelope\.precision\s*===\s*["']exact["']/.exec(
    source
  )?.[1];
  assert.ok(exactFlag, "Tipo lunar necesita una rama visible para la precisión exacta");

  // El canon V4.9.2 retiró la tabla `LOS NÚMEROS DE TU FASE`, que era donde
  // vivían los rótulos `ÁNGULO SOL–LUNA` e `ILUMINACIÓN`. La garantía no era esa
  // tabla sino la regla: la iluminación es un número del INSTANTE y sin hora
  // exacta no existe, así que no puede llegar a pantalla sin pasar por la rama
  // exacta. Se verifica sobre cada uso de `data.illumination`, que es más fuerte
  // que exigir dos rótulos dentro de un ternario.
  const usosIluminacion = [...source.matchAll(/data\.illumination\b/g)];
  assert.ok(usosIluminacion.length > 0, "la iluminación exacta tiene que usarse en algún lado");
  for (const uso of usosIluminacion) {
    const contexto = source.slice(Math.max(0, uso.index - 160), uso.index);
    assert.match(
      contexto,
      new RegExp(`\\b${exactFlag}\\b[\\s\\S]{0,120}\\?`),
      "cada uso de la iluminación medida tiene que colgar de la rama exacta"
    );
  }
  // Y el ángulo, cuando la hora no es exacta, sólo puede publicarse con su margen
  // a la vista: un valor puntual sin margen sería una precisión que nadie midió.
  assert.match(
    source,
    /±\s*\d+°\s*SIN HORA/i,
    "sin hora exacta el ángulo se publica con su margen inline"
  );
  assert.match(
    source,
    /sin (?:una|tu) hora exacta[\s\S]{0,260}(?:fase|día)[\s\S]{0,260}(?:ángulo|iluminación|valor exacto)/i,
    "el camino estimado debe explicar qué sí se sabe sin fingir un número exacto"
  );

  const moon = /<MoonDial[\s\S]{0,320}?illumination=\{([^}]+)\}/.exec(source)?.[1] ?? "";
  assert.match(
    moon,
    new RegExp(`\\b${exactFlag}\\b`),
    "el disco tampoco puede dibujar la iluminación central estimada como si fuera exacta"
  );
});

test("Arco distingue una ventana verificada de una estimada en título y explicación", () => {
  const source = sinComentarios(leer(ARCO));

  // El canon (`04-arco`) rotula la ventana verificada `DURACIÓN REGISTRADA` y no
  // "ventana exacta", así que el gate ya no pide esas dos palabras sueltas ni los
  // helpers `VentanaArco`/`VentanaItem` que el rediseño fusionó. Lo que sí se
  // exige —y es lo que la certificación reclamaba— es que la distinción exista y
  // cuelgue de la precisión del sobre en los tres lugares donde se afirma algo:
  // el rótulo, el dibujo de la línea de tiempo y el recuento de contactos.
  const exactFlag = /const\s+([A-Za-z][A-Za-z0-9]*)\s*=\s*envelope\.precision\s*===\s*["']exact["']/.exec(
    source
  )?.[1];
  assert.ok(exactFlag, "Arco necesita una rama visible para la cronología verificada");

  assert.match(
    source,
    new RegExp(`${exactFlag}\\s*\\?\\s*["'\`]DURACIÓN REGISTRADA["'\`]\\s*:\\s*["'\`]VENTANA ESTIMADA["'\`]`),
    "el rótulo de la ventana tiene que cambiar con la precisión, no ser fijo"
  );
  assert.match(
    source,
    new RegExp(`<ArcTimeline[\\s\\S]{0,400}?estimated=\\{!\\s*${exactFlag}\\}`),
    "la línea de tiempo se dibuja punteada cuando las fechas son estimadas"
  );
  assert.match(
    source,
    new RegExp(`tituloContactos\\([^)]*,\\s*${exactFlag}\\s*\\)`),
    "el recuento de contactos no puede llamarlos confirmados con una ventana estimada"
  );
  assert.match(source, /ESTIMADOS/, "un contacto sin confirmar se rotula estimado");
  assert.match(
    source,
    /Órbita registra este tránsito entre el/,
    "la ventana verificada afirma fechas registradas"
  );
  assert.match(
    source,
    /bordes calculados, no contactos confirmados/,
    "la ventana estimada dice explícitamente que no son contactos confirmados"
  );
});

test("todo sobre stale se anuncia con su fecha aunque refreshFailed sea false", () => {
  // La garantía no cambia: ninguna pantalla puede pintar como de ahora un sobre
  // que el backend ya marcó `stale`, y el aviso siempre lleva la fecha del
  // último dato visible. Lo que cambió es CÓMO se dibuja: las capas del día
  // pasaron a `FreshnessNotice`, que además elige el peso del aviso según de
  // cuándo sea el dato (línea si es de hoy, aviso si es de otro día, bloque si
  // no hay dato). Las pantallas natales siguen con `StaleNotice`, que no
  // depende del día civil.
  const screens = [
    "src/screens/v492/CartaHubScreen.tsx",
    TIPO_LUNAR,
    "src/screens/v492/MapaElementalDetailScreen.tsx",
    "src/screens/v492/LunaDetailScreen.tsx",
    CUMPLELUNA,
    ARCO,
    HOY,
    MOMENTO,
    "src/screens/v492/VinculosHubScreen.tsx",
    "src/screens/v492/VinculosResultScreen.tsx"
  ] as const;

  const helpers = [
    sinComentarios(leer("src/domain/layers.ts")),
    sinComentarios(leer("src/domain/layerFreshness.ts")),
    sinComentarios(leer("src/components/v492/Status.tsx"))
  ].join("\n");
  const sharedStaleHelper = /(?:function|const)\s+([A-Za-z][A-Za-z0-9]*stale[A-Za-z0-9]*)\b[\s\S]{0,500}?\.status\s*===\s*["']stale["']/i.exec(
    helpers
  )?.[1];
  assert.ok(sharedStaleHelper, "el dominio tiene que conservar el helper que mira `status === stale`");

  // El camino nuevo: el modelo de frescura mira las DOS cosas —el fallo de esta
  // sesión y la marca del backend— y lo hace en un solo lugar.
  const frescura = sinComentarios(leer("src/domain/layerFreshness.ts"));
  assert.match(frescura, /markedStale/, "la frescura considera el sobre marcado por el backend");
  assert.match(
    frescura,
    new RegExp(`markedStale: [\\s\\S]{0,40}${sharedStaleHelper}\\(`),
    "y esa marca sale del mismo helper del dominio, no de una condición copiada"
  );
  assert.match(
    frescura,
    /if \(!input\.refreshFailed && !input\.markedStale\) return "fresh"/,
    "un sobre marcado stale no se puede publicar como fresco"
  );

  for (const rel of screens) {
    const source = sinComentarios(leer(rel));
    const aviso = /<StaleNotice\b/.test(source) || /<FreshnessNotice\b/.test(source);
    assert.ok(aviso, `${rel} debe conservar el aviso visible`);
    assert.match(
      source,
      /observedAt=\{[^}]+\}/,
      `${rel} debe fechar el último dato que deja visible`
    );
    const inline = /\.status\s*===\s*["']stale["']/.test(source);
    const shared = new RegExp(`\\b${sharedStaleHelper}\\s*\\(`).test(source);
    const porFrescura = /envelopesFreshness\(\{/.test(source);
    assert.ok(
      inline || shared || porFrescura,
      `${rel} condiciona el aviso sólo al fallo de refresh y oculta sobres que ya llegan stale`
    );
    // Y quien usa el modelo nuevo tiene que pasarle las dos entradas que lo
    // hacen honesto: el fallo de la sesión y el día civil con el que se pidió el
    // sobre. Sin el día, "de hoy" no se puede decidir.
    if (porFrescura) {
      assert.match(source, /refreshFailed,/, `${rel}: la frescura necesita el fallo de esta sesión`);
      assert.match(source, /localDate,/, `${rel}: la frescura necesita el día civil del sobre`);
    }
  }
});

test("la estación vital estimada rotula sus fechas como aproximadas o en rango", () => {
  const source = sinComentarios(leer(MOMENTO));
  const station = seccion(source, "function EstacionVital", "function anoDeFase");

  assert.match(station, /phaseStartedAtRange/);
  assert.match(station, /nextPhaseAtRange/);

  const exactFlag = /const\s+([A-Za-z][A-Za-z0-9]*)\s*=\s*precision\s*===\s*["']exact["']/.exec(
    station
  )?.[1];
  assert.ok(exactFlag, "la estación vital necesita una rama visible para la precisión exacta");

  // El canon no rotula la fila con "APROX.": IMPRIME EL RANGO. Una fecha escrita
  // `12 MAY–18 MAY` dice sola que no es un día, y es más informativa que un día
  // suelto con una etiqueta al lado. Lo que se exige es que las dos fechas caigan
  // en el rango publicado siempre que la precisión no sea exacta.
  for (const campo of ["phaseStartedAtRange", "nextPhaseAtRange"]) {
    assert.match(
      station,
      new RegExp(`data\\.${campo}\\s*&&\\s*!\\s*${exactFlag}`),
      `${campo} tiene que reemplazar a la fecha suelta cuando la precisión no es exacta`
    );
  }
  // Y el avance dentro de la fase: sin hora no hay un punto, hay una franja.
  assert.match(
    station,
    /PRECISIÓN ±\d+ MESES SIN HORA/,
    "la falta de hora se declara inline, junto al dato que condiciona"
  );
  assert.match(
    station,
    /AVANCE ENTRE[\s\S]{0,120}SIN HORA NO HAY UN PUNTO/,
    "el avance estimado se publica como franja y dice por qué no es un punto"
  );
});
