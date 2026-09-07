/**
 * Una visita por navegación real, contada a nivel de MÓDULO (CORE-183).
 *
 * Acá vive lo único que no puede vivir en un componente: qué ruta se emitió por
 * última vez. La primera versión de esta tarjeta guardaba eso en la instancia
 * del componente, y bastaba un remount —un cambio de layout, el doble efecto de
 * StrictMode en desarrollo, un árbol que React descarta y vuelve a montar— para
 * que la misma navegación se contara dos veces. El estado de módulo vive lo que
 * vive el documento, que es exactamente lo que dura una carga de la web.
 *
 * ## Por qué desapareció la ventana de 200 ms
 *
 * Antes se esperaba un plazo fijo y se emitía lo que quedara. Eso apostaba dos
 * veces contra el reloj: una redirección más lenta que la ventana contaba la
 * ruta intermedia —`/iniciar-sesion` de alguien que ya tiene sesión— y una
 * navegación real más rápida que la ventana se cancelaba sin emitir nada.
 *
 * El reemplazo no es un plazo mejor sino otra pregunta: ¿el arranque llegó a su
 * destino? La contesta `bootState.ts`, que los gates marcan al mostrar el
 * contenido de su ruta. Mientras alguna superficie siga resolviendo no se emite
 * nada; cuando todas llegaron se emite la ruta que quedó, una sola vez; y a
 * partir de ahí cada cambio de `pathname` se emite sin esperar nada.
 *
 * ## El único diferido que queda, y no es un plazo
 *
 * La comprobación se hace en un `queueMicrotask`, que corre cuando React
 * terminó la tanda de efectos de ESTE commit —los ejecuta en una sola pasada
 * síncrona—. Es lo que permite leer el árbol ya montado: los efectos de este
 * módulo corren antes que los de los gates (son hermanos y están más arriba en
 * el layout), así que preguntar en el acto sería preguntar antes de que las
 * superficies existan. No hay milisegundos que elegir, no hay navegación que se
 * pierda y no hay nada que cancelar.
 *
 * Este módulo es puro: sin React, sin expo y sin el SDK. Lo que lo ata al
 * navegador entra por `PageviewPort`, que `webTelemetry.tsx` completa.
 */
import type { Environment, PageviewEventProperties } from "@/analytics/eventContract";
import { bootPhase, subscribeBootPhase } from "@/analytics/bootState";
import { PAGEVIEW_EVENT, decidePageview, pageviewWarning } from "@/analytics/routeClassification";

/**
 * Todo lo que este módulo necesita del navegador y del SDK, y nada más.
 *
 * Es un puerto y no un import por dos razones: la decisión se prueba sin
 * navegador, y el SDK no entra en el grafo de un módulo que sólo cuenta.
 */
export type PageviewPort = {
  /** El único envío de la tarjeta. */
  readonly capture: (event: string, properties: PageviewEventProperties) => void;
  /** `document.referrer` crudo: entra acá y no sale (`classifyReferrer`). */
  readonly referrer: () => string | null;
  /** El host del sitio, sólo para distinguir la navegación interna. */
  readonly currentHost: () => string | null;
  /** El entorno del build, nunca el hostname. */
  readonly environment: () => Environment;
  /** Dónde se avisa que una navegación no produjo evento. */
  readonly warn: (message: string) => void;
};

/** La visita que sí se emitió, para poder afirmar que hubo UNA. */
export type EmittedPageview = {
  /** La plantilla del catálogo que salió, no la ruta cruda que entró. */
  readonly path: string;
  /** Cuándo se emitió. Se REGISTRA; nunca se espera ni se compara con un plazo. */
  readonly at: number;
};

/** La ruta que el router está mostrando ahora. */
let route: string | null = null;
let port: PageviewPort | null = null;

/**
 * La última ruta que ya pasó por la decisión —emitida o descartada—.
 *
 * `undefined` es "todavía no se decidió nada", que no es lo mismo que `null`
 * ("se decidió sobre una ruta vacía"): sin esa diferencia, una carga sin
 * `pathname` se saltearía el aviso en silencio.
 *
 * Es lo que hace que un remount no cuente de nuevo: la ruta no cambió, así que
 * no hay nada que decidir.
 */
let decided: string | null | undefined;

/** La última visita EMITIDA. Nada la lee para decidir: se lee para verificar. */
let emitted: EmittedPageview | null = null;

let scheduled = false;
let unsubscribe: (() => void) | null = null;

/**
 * El cuerpo del efecto de `WebPageviewTelemetry`: "el router muestra esta ruta".
 *
 * No emite: anota y programa la comprobación. Quien decide si esto se convierte
 * en un `$pageview` es el arranque, y puede resolverse en este commit o tres
 * commits después, cuando Convex conteste.
 */
export function trackRoute(pathname: string | null | undefined, active: PageviewPort): void {
  port = active;
  route = typeof pathname === "string" ? pathname : null;
  // La suscripción no se corta al desmontar: el arranque es de la aplicación,
  // no del componente, y este módulo vive lo que vive el documento.
  unsubscribe ??= subscribeBootPhase(schedule);
  schedule();
}

function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    emitSettledRoute();
  });
}

function emitSettledRoute(): void {
  if (!port) return;
  // Todavía hay una superficie resolviendo: la ruta de ahora puede no ser la
  // que quede. No se emite y no se descarta nada — cuando el arranque cambie de
  // fase se vuelve a preguntar.
  if (bootPhase() !== "resolved") return;

  const path = route;
  if (path === decided) return;
  decided = path;

  const decision = decidePageview({
    pathname: path,
    referrer: port.referrer(),
    currentHost: port.currentHost(),
    // Sólo la PRIMERA visita emitida de esta carga lee el referrer; las
    // siguientes son navegación interna. Se mira lo emitido y no un contador de
    // montajes: un remount no convierte una navegación interna en adquisición.
    firstOfSession: emitted === null,
    environment: port.environment()
  });

  if (!decision.emit) {
    const aviso = pageviewWarning(decision);
    if (aviso) port.warn(aviso);
    return;
  }

  port.capture(PAGEVIEW_EVENT, decision.properties);
  emitted = { path: decision.properties.path, at: Date.now() };
}

/** La última visita emitida, o `null` si esta carga todavía no emitió ninguna. */
export function lastPageview(): EmittedPageview | null {
  return emitted;
}

/**
 * Vuelve al estado de una carga nueva. Existe para las pruebas: en el navegador
 * esto se reinicia recargando la página, que es lo que se quiere medir.
 */
export function resetPageviewStream(): void {
  route = null;
  port = null;
  decided = undefined;
  emitted = null;
  scheduled = false;
  unsubscribe?.();
  unsubscribe = null;
}
