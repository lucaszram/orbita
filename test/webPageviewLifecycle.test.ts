/**
 * Una visita por navegación real, ejecutada — CORE-183.
 *
 * `webPageviewTelemetry.test.ts` prueba QUÉ se emite (la decisión pura) y CÓMO
 * está cableado el borde. Este archivo prueba lo único que esas dos cosas no
 * pueden probar: el CICLO DE VIDA. Que un remount no cuente dos veces, que el
 * doble efecto de StrictMode no cuente dos veces y que una ruta intermedia no
 * cuente nunca no son afirmaciones sobre el texto de un archivo: son
 * afirmaciones sobre qué pasa cuando React monta, desmonta y vuelve a montar.
 *
 * ## El arnés, y qué es honestamente
 *
 * Órbita no tiene `react-test-renderer` (no está en el árbol de dependencias, y
 * esta tarjeta no agrega ninguna), y el componente real no se puede importar en
 * Node: arrastra `expo-router` y el SDK. Lo que sí se puede ejecutar es el
 * cuerpo de los efectos, que es donde vive TODA la lógica de esta tarjeta —el
 * componente es una línea— y que este archivo corre a través de un arnés que
 * implementa el contrato de efectos de React:
 *
 *   · los efectos de los hijos corren ANTES que los del padre;
 *   · al desmontar, las limpiezas corren en el mismo orden;
 *   · un efecto se rehace sólo si cambian sus dependencias;
 *   · StrictMode monta, limpia y vuelve a montar, todo seguido.
 *
 * Lo que el arnés NO ejecuta es el `useEffect` de React en sí: que el componente
 * declare estos efectos —y con estas dependencias— lo fija
 * `webPageviewTelemetry.test.ts` sobre la fuente. Acá se ejecuta lo que esos
 * efectos hacen.
 *
 * Nada de esto inspecciona texto.
 */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  closeBootSurface,
  openBootSurface,
  resetBootState,
  settleBootSurface,
  unsettleBootSurface,
  bootPhase,
  type BootSurfaceId
} from "../src/analytics/bootState";
import {
  lastPageview,
  resetPageviewStream,
  trackRoute,
  type PageviewPort
} from "../src/analytics/pageviewStream";
import type { PageviewEventProperties } from "../src/analytics/eventContract";

// --- El arnés -----------------------------------------------------------------

/** Un efecto declarado por un componente. */
type Efecto = {
  /** Identidad dentro del árbol: dos instancias distintas, dos ids distintos. */
  readonly id: string;
  readonly deps: readonly unknown[];
  readonly setup: () => (() => void) | void;
};

/**
 * Un árbol de efectos con el contrato de React.
 *
 * Los efectos se pasan en el orden en el que React los corre —hijos primero—, y
 * el arnés hace lo mismo que el reconciliador con ellos: monta los nuevos, deja
 * quietos los que no cambiaron de dependencias, rehace los que sí y limpia los
 * que desaparecieron.
 */
class Arbol {
  private montados = new Map<string, { deps: readonly unknown[]; cleanup: (() => void) | void }>();

  /** Un commit: se renderiza el árbol y React corre lo que corresponda. */
  render(efectos: readonly Efecto[]): void {
    const vivos = new Set(efectos.map((e) => e.id));
    for (const [id, montado] of [...this.montados]) {
      if (vivos.has(id)) continue;
      montado.cleanup?.();
      this.montados.delete(id);
    }
    for (const efecto of efectos) {
      const montado = this.montados.get(efecto.id);
      if (montado && mismasDeps(montado.deps, efecto.deps)) continue;
      montado?.cleanup?.();
      this.montados.set(efecto.id, { deps: efecto.deps, cleanup: efecto.setup() });
    }
  }

  /** El árbol se va: limpieza de todo, hijos primero. */
  unmount(): void {
    this.render([]);
  }

  /**
   * El doble efecto de desarrollo: React monta, limpia TODO y vuelve a montar,
   * para que un efecto que no se pueda repetir se note en el acto.
   */
  strictMode(efectos: readonly Efecto[]): void {
    this.render(efectos);
    for (const [id, montado] of [...this.montados]) {
      montado.cleanup?.();
      this.montados.delete(id);
    }
    this.render(efectos);
  }
}

function mismasDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((valor, i) => Object.is(valor, b[i]));
}

/** El microtask de la comprobación se encoló antes que éste: corre antes. */
const tick = () => new Promise<void>((listo) => queueMicrotask(listo));

// --- Las piezas reales, tal como las monta la app ------------------------------

const capturas: Array<{ event: string; properties: PageviewEventProperties }> = [];
const avisos: string[] = [];

/** El puerto del navegador, con el referrer de una visita que llega de Google. */
const puerto = (referrer = "https://www.google.com/search?q=orbita"): PageviewPort => ({
  capture: (event, properties) => {
    capturas.push({ event, properties });
  },
  referrer: () => referrer,
  currentHost: () => "orbitaastrologia.xyz",
  environment: () => "production",
  warn: (mensaje) => {
    avisos.push(mensaje);
  }
});

/** El efecto de `WebPageviewTelemetry`: avisa qué ruta muestra el router. */
const telemetria = (pathname: string | null, port = puerto()): Efecto => ({
  id: "telemetria",
  deps: [pathname],
  setup: () => {
    trackRoute(pathname, port);
  }
});

/**
 * Los efectos de un `AccountGate`: la superficie mientras está montada, y la
 * marca de "llegué a mi destino" mientras muestra el contenido de su ruta.
 *
 * Se devuelven en el orden de React —el hijo (`AtDestination`) primero—, que es
 * justamente lo que hace que la superficie no se pise a sí misma al montarse.
 */
const gate = (id: string, estado: "resolviendo" | "en-destino"): Efecto[] => {
  const superficie = superficies(id);
  const propios: Efecto[] = [
    {
      id: `gate:${id}`,
      deps: [superficie],
      setup: () => {
        openBootSurface(superficie);
        return () => closeBootSurface(superficie);
      }
    }
  ];
  if (estado === "resolviendo") return propios;
  return [
    {
      id: `destino:${id}`,
      deps: [superficie],
      setup: () => {
        settleBootSurface(superficie);
        return () => unsettleBootSurface(superficie);
      }
    },
    ...propios
  ];
};

/** Identidad estable por instancia de gate, como el `useRef` del hook real. */
const ids = new Map<string, BootSurfaceId>();
function superficies(id: string): BootSurfaceId {
  const existente = ids.get(id);
  if (existente) return existente;
  const nuevo = Symbol(id);
  ids.set(id, nuevo);
  return nuevo;
}

beforeEach(() => {
  capturas.length = 0;
  avisos.length = 0;
  ids.clear();
  resetBootState();
  resetPageviewStream();
});

const rutas = () => capturas.map((c) => c.properties.path);

// --- 1. El arranque manda -----------------------------------------------------

test("mientras un gate resuelve no se emite nada", async () => {
  const arbol = new Arbol();
  arbol.render([...gate("app", "resolviendo"), telemetria("/hoy")]);
  await tick();

  assert.equal(bootPhase(), "resolving");
  assert.deepEqual(capturas, []);
  assert.equal(lastPageview(), null);
});

test("al resolverse el arranque se emite la ruta que quedó, una sola vez", async () => {
  const arbol = new Arbol();
  arbol.render([...gate("app", "resolviendo"), telemetria("/hoy")]);
  await tick();
  arbol.render([...gate("app", "en-destino"), telemetria("/hoy")]);
  await tick();

  assert.deepEqual(rutas(), ["/hoy"]);
  assert.equal(lastPageview()?.path, "/hoy");

  // Un commit más, sin cambios: no hay una segunda visita.
  arbol.render([...gate("app", "en-destino"), telemetria("/hoy")]);
  await tick();
  assert.deepEqual(rutas(), ["/hoy"]);
});

test("una redirección del arranque no cuenta la ruta intermedia", async () => {
  // `/iniciar-sesion` con sesión activa: el gate resuelve y devuelve un
  // `<Redirect>` a Home. La ruta intermedia existió en el router y no se vio.
  const arbol = new Arbol();
  arbol.render([...gate("login", "resolviendo"), telemetria("/iniciar-sesion")]);
  await tick();
  // El gate resolvió a otro destino: sigue sin mostrar su ruta.
  arbol.render([...gate("login", "resolviendo"), telemetria("/iniciar-sesion")]);
  await tick();
  assert.deepEqual(rutas(), []);

  // El router navega: el gate de `/iniciar-sesion` se desmonta y monta el de Home.
  arbol.render([...gate("home", "resolviendo"), telemetria("/home")]);
  await tick();
  assert.deepEqual(rutas(), []);

  arbol.render([...gate("home", "en-destino"), telemetria("/home")]);
  await tick();
  assert.deepEqual(rutas(), ["/home"]);
});

test("una ruta pública sin gate se emite sin esperar a nadie", async () => {
  // `/privacy`, `/terminos` y `/support` no montan ningún gate: son su propio
  // destino. Sin esto, una ruta pública no se mediría jamás.
  const arbol = new Arbol();
  arbol.render([telemetria("/privacy")]);
  await tick();

  assert.equal(bootPhase(), "resolved");
  assert.deepEqual(rutas(), ["/privacy"]);
});

// --- 2. Un evento por navegación, pase lo que pase con el árbol ---------------

test("un remount de la telemetría NO cuenta la misma navegación otra vez", async () => {
  const arbol = new Arbol();
  arbol.render([...gate("app", "en-destino"), telemetria("/hoy")]);
  await tick();
  assert.deepEqual(rutas(), ["/hoy"]);

  // El árbol entero se desmonta y se vuelve a montar en la misma ruta: cambio de
  // layout, error boundary que se recupera, o React que decide rehacer el
  // subárbol. El estado de la instancia se pierde; el del módulo no.
  arbol.unmount();
  const otro = new Arbol();
  otro.render([...gate("app", "en-destino"), telemetria("/hoy")]);
  await tick();

  assert.deepEqual(rutas(), ["/hoy"], "el remount contó una visita de más");
});

test("el doble efecto de StrictMode emite una sola vez", async () => {
  const arbol = new Arbol();
  // Monta, limpia todo y vuelve a montar: exactamente lo que hace React en
  // desarrollo para delatar un efecto que no se puede repetir.
  arbol.strictMode([...gate("app", "en-destino"), telemetria("/hoy")]);
  await tick();

  assert.deepEqual(rutas(), ["/hoy"]);
  assert.equal(bootPhase(), "resolved", "el gate quedó marcado como resolviendo");
});

test("StrictMode sobre una navegación posterior tampoco duplica", async () => {
  const arbol = new Arbol();
  arbol.strictMode([...gate("app", "en-destino"), telemetria("/hoy")]);
  await tick();
  arbol.strictMode([...gate("app", "en-destino"), telemetria("/diario")]);
  await tick();

  assert.deepEqual(rutas(), ["/hoy", "/diario"]);
});

test("cada navegación real emite, sin ventana de tiempo que la cancele", async () => {
  const arbol = new Arbol();
  arbol.render([...gate("app", "en-destino"), telemetria("/hoy")]);
  await tick();
  // Dos navegaciones seguidas, en el mismo instante: con la ventana de 200 ms de
  // la primera versión, la del medio se perdía.
  arbol.render([...gate("app", "en-destino"), telemetria("/diario")]);
  await tick();
  arbol.render([...gate("app", "en-destino"), telemetria("/vinculos")]);
  await tick();

  assert.deepEqual(rutas(), ["/hoy", "/diario", "/vinculos"]);
});

test("volver a una ruta ya visitada cuenta de nuevo", async () => {
  const arbol = new Arbol();
  for (const ruta of ["/hoy", "/diario", "/hoy"]) {
    arbol.render([...gate("app", "en-destino"), telemetria(ruta)]);
    await tick();
  }
  assert.deepEqual(rutas(), ["/hoy", "/diario", "/hoy"]);
});

test("un re-render sin cambio de ruta no emite", async () => {
  const arbol = new Arbol();
  const efectos = [...gate("app", "en-destino"), telemetria("/hoy")];
  arbol.render(efectos);
  await tick();
  for (let i = 0; i < 5; i += 1) arbol.render(efectos);
  await tick();

  assert.deepEqual(rutas(), ["/hoy"]);
});

// --- 3. La adquisición se lee una sola vez por carga --------------------------

test("sólo la primera visita EMITIDA lee el referrer", async () => {
  const arbol = new Arbol();
  arbol.render([...gate("app", "en-destino"), telemetria("/hoy")]);
  await tick();
  arbol.render([...gate("app", "en-destino"), telemetria("/diario")]);
  await tick();

  assert.equal(capturas[0].properties.acquisition_source, "organic_search");
  assert.equal(capturas[1].properties.acquisition_source, "direct");
});

test("un remount antes de la primera visita no convierte la adquisición en interna", async () => {
  // El referrer lo lee la primera visita EMITIDA, no el primer montaje: si un
  // remount contara como "ya hubo una", la persona que llega de Google se
  // registraría como navegación interna.
  const arbol = new Arbol();
  arbol.render([...gate("app", "resolviendo"), telemetria("/hoy")]);
  await tick();
  arbol.unmount();

  const otro = new Arbol();
  otro.render([...gate("app", "en-destino"), telemetria("/hoy")]);
  await tick();

  assert.deepEqual(rutas(), ["/hoy"]);
  assert.equal(capturas[0].properties.acquisition_source, "organic_search");
});

// --- 4. Lo que no se emite, se explica sin datos adentro ----------------------

test("una ruta fuera del catálogo avisa una vez y no emite", async () => {
  const arbol = new Arbol();
  arbol.render([telemetria("/no-existe")]);
  await tick();
  arbol.render([telemetria("/no-existe")]);
  await tick();

  assert.deepEqual(capturas, []);
  assert.deepEqual(avisos, ["[orbita] $pageview no emitido: unknown_route (unsanitized_path)"]);
});

test("las herramientas internas no se miden y el aviso no lleva la ruta", async () => {
  const arbol = new Arbol();
  arbol.render([...gate("app", "en-destino"), telemetria("/backoffice")]);
  await tick();

  assert.deepEqual(capturas, []);
  assert.deepEqual(avisos, ["[orbita] $pageview no emitido: unmeasured_route"]);
});

// --- 5. El store del arranque, en sus propios términos ------------------------

test("dos superficies montadas: hasta que las dos llegan, no hay visita", async () => {
  // El layout de tabs y la pantalla de adentro montan un gate cada uno.
  const arbol = new Arbol();
  arbol.render([...gate("tabs", "en-destino"), ...gate("pantalla", "resolviendo"), telemetria("/hoy")]);
  await tick();
  assert.equal(bootPhase(), "resolving");
  assert.deepEqual(rutas(), []);

  arbol.render([...gate("tabs", "en-destino"), ...gate("pantalla", "en-destino"), telemetria("/hoy")]);
  await tick();
  assert.deepEqual(rutas(), ["/hoy"]);
});

test("una superficie que vuelve a resolver frena la visita siguiente", async () => {
  const arbol = new Arbol();
  arbol.render([...gate("app", "en-destino"), telemetria("/hoy")]);
  await tick();
  assert.deepEqual(rutas(), ["/hoy"]);

  // Navegación a una ruta cuyo gate vuelve a esperar (sesión que se reconfirma).
  arbol.render([...gate("app", "resolviendo"), telemetria("/perfil")]);
  await tick();
  assert.deepEqual(rutas(), ["/hoy"]);

  arbol.render([...gate("app", "en-destino"), telemetria("/perfil")]);
  await tick();
  assert.deepEqual(rutas(), ["/hoy", "/perfil"]);
});

test("el desmontaje de un gate lo saca del arranque", () => {
  const arbol = new Arbol();
  arbol.render(gate("app", "resolviendo"));
  assert.equal(bootPhase(), "resolving");
  arbol.unmount();
  assert.equal(bootPhase(), "resolved");
});

test("una superficie cerrada no revive: el arranque no queda colgado", () => {
  // Al desmontar, la limpieza del hijo desmarca y la del padre cierra. Si el
  // orden se diera al revés, una entrada muerta dejaría el arranque resolviendo
  // para siempre y la web no volvería a contar una visita.
  const id = Symbol("cerrada");
  openBootSurface(id);
  settleBootSurface(id);
  closeBootSurface(id);
  unsettleBootSurface(id);
  assert.equal(bootPhase(), "resolved");
});

test("marcar el destino no depende del orden en el que corran los efectos", () => {
  // El hijo marca "llegué" antes de que el padre registre la superficie: si el
  // registro pisara ese valor, la primera visita de cada carga se perdería.
  const id = Symbol("orden");
  settleBootSurface(id);
  openBootSurface(id);
  assert.equal(bootPhase(), "resolved");
});
