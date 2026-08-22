/**
 * QA23-003 — el Cumpleluna se lee con UN reloj: el del sobre.
 *
 * ## El defecto medido en el build 23
 *
 * `cumplelunaView` compone en la misma vista dos cosas de naturaleza distinta:
 *
 * - **Escalares del snapshot** — `cycleDay`, `cycleLength`, `daysRemaining` y
 *   `progressBand`. Los calculó el backend en `observedAt` y quedan congelados
 *   hasta el próximo cálculo: no se recalculan porque la pantalla siga abierta.
 * - **Un instante relativo** — `nextWhen`, que sin ventana se arma con
 *   `relativeDayLabel(nextExactAt, <reloj>)` y por lo tanto sí depende de contra
 *   qué momento se cuente.
 *
 * Las dos pantallas que arman esa vista le pasaban el `nowMs` de la sesión —el
 * reloj del aparato— mientras el resto de la fila seguía siendo el del sobre. Es
 * una mezcla de relojes, y no es teórica: basta que el snapshot tenga unas horas
 * y la misma fila dice `Hoy` al lado de `FALTAN 1,2 días`. Con la app abierta
 * cruzando la medianoche, el titular avanza solo y la barra no.
 *
 * El corte es de una idea: **la vista que combina `nextWhen` con los escalares
 * queda anclada al `observedAt` del MISMO sobre que aportó `data`.** El
 * parámetro se llama `observedAtMs` justamente para que un `nowMs` en el call
 * site se lea como lo que es.
 *
 * `nowMs` no desaparece de Hoy: sigue siendo el reloj de la sesión para lo que
 * de verdad depende del día civil de la persona —si hoy es el día del Cumpleluna
 * (`cumplelunaToday`), la fecha del encabezado y las otras capas—. Lo que ya no
 * hace es entrar a `cumplelunaView`.
 *
 * ## Lo que se prueba acá
 *
 * 1. El dominio nombra su contrato: `observedAtMs`, no `nowMs`.
 * 2. La mezcla es reproducible y el ancla la corta.
 * 3. Los dos call sites pasan el `observedAt` del sobre del Cumpleluna, y no
 *    `nowMs` ni `Date.now()`.
 * 4. `cumplelunaToday` conserva `nowMs`: decidir si hoy es el día SÍ es una
 *    pregunta del reloj de la persona.
 * 5. La accesibilidad del bloque y del detalle no se movió.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  cumplelunaInputHash,
  cumplelunaSnapshotValidUntil
} from "../convex/layers";
import { cumplelunaView } from "../src/domain/layers";
import type { CumplelunaData } from "../src/services/layersApi";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
/** Una regla se comprueba sobre el código: los comentarios no ejecutan nada. */
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function seccion(source: string, desde: string, hasta?: string): string {
  const inicio = source.indexOf(desde);
  assert.ok(inicio >= 0, `no se encontró «${desde}»`);
  const fin = hasta ? source.indexOf(hasta, inicio + desde.length) : source.length;
  assert.ok(fin > inicio, hasta ? `no se encontró «${hasta}» después de «${desde}»` : desde);
  return source.slice(inicio, fin);
}

const LAYERS = leer("src/domain/layers.ts");
const BACKEND = sinComentarios(leer("convex/layers.ts"));
const DETALLE = "src/screens/v492/CumplelunaDetailScreen.tsx";
const HOY = "src/screens/v492/HoyScreen.tsx";

// ---------------------------------------------------------------------------
// El fixture: un sobre con raíz exacta, mirado un día después de calculado.

/** Cuándo el backend calculó el sobre. Es el reloj que la vista debe usar. */
const OBSERVED_AT = Date.UTC(2026, 7, 21, 2, 0);
/** Un día civil más tarde: la app quedó abierta, o el snapshot llegó viejo. */
const NOW_MS = Date.UTC(2026, 7, 22, 9, 0);
/** El próximo contacto, a 1,21 días de `OBSERVED_AT` y adentro del día de NOW. */
const NEXT_EXACT_AT = Date.UTC(2026, 7, 22, 7, 0);

// ---------------------------------------------------------------------------
// La identidad y la vigencia del snapshot en el backend

test("QA23-003 · el hash cambia al cambiar el día o la zona y es estable dentro del alcance", () => {
  const baseHash = "carta-canónica";
  const alcance = { localDate: "2026-08-21", timezone: "America/Argentina/Buenos_Aires" };
  const mismo = cumplelunaInputHash(baseHash, alcance);

  assert.equal(cumplelunaInputHash(baseHash, { ...alcance }), mismo);
  assert.notEqual(
    cumplelunaInputHash(baseHash, { ...alcance, localDate: "2026-08-22" }),
    mismo,
    "el snapshot de ayer no puede coincidir con el de hoy"
  );
  assert.notEqual(
    cumplelunaInputHash(baseHash, { ...alcance, timezone: "Europe/Madrid" }),
    mismo,
    "el día civil pertenece a una zona concreta"
  );
});

test("QA23-003 · la vigencia corta en el primer borde: cielo, raíz exacta o ventana", () => {
  const cielo = 10_000;
  assert.equal(cumplelunaSnapshotValidUntil({ skyValidUntil: cielo }), cielo);
  assert.equal(
    cumplelunaSnapshotValidUntil({ skyValidUntil: cielo, nextExactAt: cielo - 1 }),
    cielo - 1,
    "una raíz antes del vencimiento horario abre un snapshot nuevo"
  );
  assert.equal(
    cumplelunaSnapshotValidUntil({
      skyValidUntil: cielo,
      nextExactAt: cielo + 2_000,
      nextExactAtRange: { earliest: cielo - 2, latest: cielo + 1_000 }
    }),
    cielo - 2,
    "en precisión acotada manda el borde temprano de la ventana"
  );
  assert.equal(
    cumplelunaSnapshotValidUntil({ skyValidUntil: cielo, nextExactAt: cielo }),
    cielo,
    "el borde es inclusivo: al alcanzarlo latestMatching lo considera vencido"
  );
});

test("QA23-003 · lectura, refresh y persistencia usan el mismo alcance diario", () => {
  assert.equal(
    (BACKEND.match(/cumplelunaInputHash\(natal\.baseHash, dailyScope\)/g) ?? []).length,
    4,
    "dos usos en getForDate y uno en cada rama de refreshForDate"
  );
  assert.match(
    BACKEND,
    /validUntil: cumplelunaSnapshotValidUntil\(\{\s*skyValidUntil: ephemerisValidUntil,\s*nextExactAtRange: cumpleBuild\.data\?\.nextExactAtRange,\s*nextExactAt: cumpleBuild\.data\?\.nextExactAt,\s*\}\)/
  );
  assert.equal(
    (BACKEND.match(/"ORB-LUN-002"[^\n]*"ORB-LUN-003"/g) ?? []).length,
    2,
    "cacheKey y campos persistidos tratan Cumpleluna como capa diaria"
  );
  assert.doesNotMatch(
    BACKEND,
    /resultHash\(natal\.baseHash, "ORB-LUN-002"\)/,
    "no queda ningún hash natal sin día"
  );
});

/**
 * Cumpleluna con raíz exacta: sin ventanas —el sobre las omite—, que es el caso
 * donde `nextWhen` depende de un reloj. Con ventanas la vista imprime la ventana
 * entera y la pregunta ni se plantea.
 */
function cumplelunaExacto(): CumplelunaData {
  return {
    kind: "cumpleluna",
    natalElongationDegrees: 108,
    currentElongationDegrees: 96.4,
    previousExactAt: Date.UTC(2026, 6, 24, 1, 0),
    nextExactAt: NEXT_EXACT_AT,
    // Escalares congelados del snapshot: los fijó el backend en `OBSERVED_AT` y
    // no se recalculan solos. `daysRemaining` son 1,21 días desde ahí.
    daysRemaining: 1.21,
    cycleDay: 28.3,
    cycleLengthDays: 29.51,
    progress: 0.959,
    summary: "Fixture del reloj del sobre."
  };
}

test("QA23-003 · el dominio nombra su reloj: `observedAtMs`, no `nowMs`", () => {
  const firma = seccion(LAYERS, "export function cumplelunaView(", "): CumplelunaView {");
  assert.match(
    firma,
    /\bobservedAtMs\s*:\s*number\b/,
    "el parámetro instante de `cumplelunaView` se llama `observedAtMs`"
  );
  assert.doesNotMatch(
    sinComentarios(firma),
    /\bnowMs\b/,
    "un `nowMs` en la firma invita a pasar el reloj del aparato"
  );

  // Y adentro no queda otra fuente de tiempo: el único instante que la vista
  // deriva es el que le entra por parámetro.
  const cuerpo = sinComentarios(
    seccion(LAYERS, "export function cumplelunaView(", "\n// ---")
  );
  assert.doesNotMatch(cuerpo, /Date\.now\s*\(/, "la vista no lee el reloj del aparato");
  assert.match(
    cuerpo,
    /relativeDayLabel\s*\(\s*data\.nextExactAt\s*,\s*observedAtMs\s*,/,
    "`nextWhen` se cuenta desde el instante del sobre"
  );
});

test("QA23-003 · anclada al sobre, la vista no mezcla dos relojes", () => {
  const data = cumplelunaExacto();

  // El defecto, reproducido: con el reloj del aparato el titular dice que el
  // contacto es HOY mientras la misma vista sigue diciendo que faltan 1,2 días.
  const mezclada = cumplelunaView(data, "exact", NOW_MS, "UTC");
  assert.match(mezclada.nextWhen, /^hoy\b/, "el fixture reproduce la mezcla");
  assert.match(mezclada.daysRemaining, /1,2 días/, "el escalar del sobre no se movió");

  // Anclada: el mismo dato, contado desde el instante en que se calculó.
  const anclada = cumplelunaView(data, "exact", OBSERVED_AT, "UTC");
  assert.match(anclada.nextWhen, /^mañana\b/, "`nextWhen` se cuenta desde `observedAt`");
  assert.match(anclada.daysRemaining, /1,2 días/, "y concuerda con el escalar de al lado");

  // Y el ancla no puede mover NADA MÁS: el resto de la vista son escalares que
  // el sobre trae resueltos. Si algún otro campo cambia con el reloj, es otra
  // costura mezclada.
  assert.deepEqual(
    { ...anclada, nextWhen: mezclada.nextWhen },
    mezclada,
    "el instante sólo alimenta `nextWhen`; lo demás sale del snapshot"
  );
});

test("QA23-003 · el detalle arma la vista con el `observedAt` de su propio sobre", () => {
  const fuente = sinComentarios(leer(DETALLE));
  assert.match(
    fuente,
    /cumplelunaView\s*\(\s*data\s*,\s*envelope\.precision\s*,\s*envelope\.observedAt\s*,/,
    "precisión y reloj salen del MISMO sobre que aportó `data`"
  );
  assert.doesNotMatch(fuente, /\bnowMs\b/, "el detalle ya no necesita el reloj de la sesión");
  assert.doesNotMatch(fuente, /Date\.now\s*\(/, "ni el del aparato");
});

test("QA23-003 · el bloque de Hoy recibe el reloj del sobre por prop, no el de la sesión", () => {
  const fuente = sinComentarios(leer(HOY));

  const props = seccion(fuente, "function CumplelunaBloque(", "  const view =");
  assert.match(props, /\bobservedAt\s*:\s*number\b/, "la prop declara el instante del sobre");
  assert.doesNotMatch(props, /\bnowMs\b/, "el bloque no toma el reloj de la sesión");

  const cuerpo = seccion(fuente, "  const view = cumplelunaView", "function cumplelunaCuando");
  assert.match(
    cuerpo,
    /cumplelunaView\s*\(\s*data\s*,\s*precision\s*,\s*observedAt\s*,/,
    "la vista del bloque se arma con el instante del sobre"
  );
  assert.doesNotMatch(cuerpo, /Date\.now\s*\(/, "ni con el reloj del aparato");

  // Los DOS call sites —el bloque destacado cuando el Cumpleluna es hoy y el
  // bloque en su lugar del orden cuando no— pasan el `observedAt` del sobre.
  const usos = [...fuente.matchAll(/<CumplelunaBloque[\s\S]*?\/>/g)].map((match) => match[0]);
  assert.equal(usos.length, 2, "Hoy monta el bloque en dos lugares del orden");
  for (const uso of usos) {
    assert.match(
      uso,
      /observedAt=\{cumpleluna\.observedAt\}/,
      "el reloj sale del sobre del Cumpleluna, no de la pantalla"
    );
    assert.doesNotMatch(uso, /\bnowMs=/, "el reloj de la sesión no entra al bloque");
  }
});

test("QA23-003 · si hoy es el día del Cumpleluna lo sigue decidiendo el reloj de la persona", () => {
  const fuente = sinComentarios(leer(HOY));

  // Esta pregunta SÍ es del día civil de quien mira: no se ancla al snapshot.
  assert.match(
    fuente,
    /cumplelunaToday\s*\(\s*cumplelunaData\s*,\s*cumpleluna\.precision\s*,\s*nowMs\s*,/,
    "`cumplelunaToday` se resuelve contra el reloj de la sesión"
  );
  // Y `nowMs` sigue alimentando el resto de la pantalla.
  assert.match(fuente, /nowMs=\{nowMs\}/, "las otras capas y el encabezado conservan su reloj");

  const firma = seccion(
    LAYERS,
    "export function cumplelunaToday(",
    "): CumplelunaToday | null {"
  );
  assert.match(
    sinComentarios(firma),
    /\bnowMs\s*:\s*number\b/,
    "el dominio conserva el reloj de la sesión justo donde corresponde"
  );
});

test("QA23-003 · la accesibilidad del Cumpleluna quedó intacta", () => {
  const hoy = sinComentarios(leer(HOY));
  const bloque = seccion(hoy, "function CumplelunaBloque(", "function cumplelunaCuando");
  // El head anuncia el evento una sola vez, el anillo queda oculto de VoiceOver
  // y la barra anuncia el reloj del ciclo: las tres cosas del canon QA22.
  assert.match(bloque, /accessible\s+accessibilityRole="text"\s+accessibilityLabel=\{voz\}/);
  assert.match(bloque, /accessibilityElementsHidden\s+importantForAccessibility="no-hide-descendants"/);
  assert.match(bloque, /accessibilityLabel=\{`Tu ciclo personal: \$\{view\.cycleClock/);

  const detalle = sinComentarios(leer(DETALLE));
  assert.match(
    detalle,
    /label=\{`Ciclo personal: \$\{view\.cycleClock/,
    "el anillo del detalle sigue anunciando el reloj del ciclo y el avance"
  );
});
