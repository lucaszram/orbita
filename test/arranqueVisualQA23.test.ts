/**
 * QA23-006 — el arranque tiene un solo color y ningún movimiento.
 *
 * ## El defecto medido en el build 23
 *
 * Abrir la app mostraba, antes de que hubiera producto, tres cosas que no son
 * Órbita:
 *
 * 1. **El splash blanco.** `app.json` no declaraba ni el fondo del splash ni el
 *    del root view, así que el color lo ponía el template nativo: blanco.
 * 2. **Frames claros.** Los tres gates que se dibujan antes que nada —el
 *    boundary de eliminación pendiente, la raíz que decide el destino y la
 *    espera del gate de las tabs— pintaban `theme.colors.background`, que es el
 *    crema `#fff8f0` del MVP legado y no el `#0A0B0E` del producto; y el `Stack`
 *    raíz no declaraba `contentStyle`, así que cada hueco entre gates lo llenaba
 *    el fondo claro del tema por defecto del navegador de rutas.
 * 3. **Un deslizamiento lateral.** `<Redirect>` es un `replace`, y el stack
 *    nativo anima un replace como un `pop`: la primera pantalla real entraba
 *    desde el costado, como si alguien hubiera tocado "volver".
 *
 * ## Lo que se prueba acá
 *
 * 1. **Un solo color, y es el del shell.** El token del arranque y el de las
 *    pantallas V4.9.2 son el MISMO valor, así que entrar al producto no puede
 *    cambiar el fondo.
 * 2. **Ningún gate vuelve al tema claro**, y ninguno declara un color propio:
 *    todos los sacan del mismo módulo. Se mide además el contraste real del
 *    texto y de las acciones sobre el fondo nuevo — repintar el fondo sin
 *    repintar el texto habría dejado oscuro sobre oscuro, que es peor que el
 *    defecto original.
 * 3. **Las opciones del arranque:** fondo del splash, del root view, de la barra
 *    de estado y de la barra de navegación de Android, todas declaradas y todas
 *    del mismo color.
 * 4. **Los redirects de gate reemplazan sin animación**, y sólo ellos: la
 *    navegación normal posterior conserva su deslizamiento.
 * 5. **Los deep links no se tocan:** el `Stack` raíz declara exactamente las
 *    mismas rutas y el esquema sigue siendo `orbita`.
 * 6. **Regresión de QA23-001:** no se nombra `Free` mientras el entitlement no
 *    resuelve, y ningún gate del arranque nombra un plan siquiera.
 *
 * Lo que estos gates NO reemplazan: mirar el arranque en un iPhone. El color del
 * launch screen lo produce `prebuild` a partir de esta configuración, así que
 * sólo se ve con un build nuevo.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { v492 } from "../src/components/v492/tokens";
import {
  PLAN_FREE_LABEL,
  PLAN_PLUS_LABEL,
  planLabel,
  planMark,
  resolvePlanView
} from "../src/domain/entitlement";
import {
  BOOT_ACCENT,
  BOOT_BACKGROUND,
  BOOT_GATE_ROUTES,
  BOOT_SCREEN_ANIMATION,
  BOOT_SCREEN_OPTIONS,
  BOOT_STATUS_BAR_STYLE,
  BOOT_TEXT,
  BOOT_TEXT_MUTED
} from "../src/theme/boot";
import { orbita } from "../src/theme/orbita";
import { theme } from "../src/theme/theme";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
/** Una regla se comprueba sobre el código: los comentarios no dibujan nada. */
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const LAYOUT_RAIZ = "app/_layout.tsx";

/**
 * Las seis superficies que pueden ocupar la pantalla ANTES de que haya producto.
 *
 * No es una lista de archivos bonitos: es el recorrido real del arranque. El
 * boundary tapa todo mientras lee el disco; la raíz decide el destino; el gate
 * de las tabs espera a `onboarding.getCompletionStatus`; y `AccountGate` es la
 * puerta compartida por el alta, el login y las rutas de app. Cada plataforma
 * tiene su variante y las dos cuentan.
 */
const GATES = [
  "src/components/PendingDeletionBoundary.tsx",
  "src/components/orbita/AccountGate.tsx",
  "src/routes/v492/index.tsx",
  "src/routes/v492/index.web.tsx",
  "src/routes/v492/tabs-layout.tsx",
  "src/routes/v492/tabs-layout.web.tsx"
] as const;

const LAYOUT = sinComentarios(leer(LAYOUT_RAIZ));
const FUENTE_GATES = new Map<string, string>(
  GATES.map((rel) => [rel, sinComentarios(leer(rel))] as const)
);

const APP_JSON = JSON.parse(leer("app.json")) as {
  expo: {
    version: string;
    scheme: string;
    userInterfaceStyle: string;
    backgroundColor: string;
    splash: { backgroundColor: string; resizeMode: string };
    androidNavigationBar: { barStyle: string; backgroundColor: string };
    runtimeVersion: { policy: string };
    plugins: unknown[];
    extra: { router: { origin: boolean } };
    ios: {
      buildNumber: string;
      backgroundColor: string;
      splash: { backgroundColor: string; resizeMode: string };
    };
    android: {
      backgroundColor: string;
      splash: { backgroundColor: string; resizeMode: string };
      adaptiveIcon: { backgroundColor: string };
    };
  };
};

// ---------------------------------------------------------------------------
// Contraste: la medida, no la impresión
// ---------------------------------------------------------------------------

/** Luminancia relativa de un `#rrggbb`, tal como la define WCAG 2.x. */
function luminancia(hex: string): number {
  const canal = (valor: number) => {
    const c = valor / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const limpio = hex.replace("#", "");
  const componentes = [0, 2, 4].map((desde) => parseInt(limpio.slice(desde, desde + 2), 16));
  return (
    0.2126 * canal(componentes[0]!) +
    0.7152 * canal(componentes[1]!) +
    0.0722 * canal(componentes[2]!)
  );
}

/** Razón de contraste entre dos colores opacos (1:1 … 21:1). */
function contraste(uno: string, otro: string): number {
  const a = luminancia(uno);
  const b = luminancia(otro);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// ---------------------------------------------------------------------------
// 1 · Un solo color de arranque, y es el del shell
// ---------------------------------------------------------------------------

test("el arranque y el producto comparten exactamente el mismo fondo", () => {
  assert.equal(BOOT_BACKGROUND, "#0A0B0E");
  // El token del arranque no es un valor nuevo: es el del tema de Órbita, el
  // mismo que ya usan las pantallas V4.9.2 y el `sceneStyle` de las tabs. Si
  // divergieran, entrar al producto se vería como un parpadeo de fondo.
  assert.equal(BOOT_BACKGROUND, orbita.colors.background);
  assert.equal(BOOT_BACKGROUND, v492.colors.background);
});

test("el fondo que pintaban los gates era, literalmente, un frame claro", () => {
  // El defecto exacto: `theme.colors.background` es el crema del MVP legado.
  // Contra el fondo de Órbita da 18:1 — es un flash blanco, no un matiz.
  assert.equal(theme.colors.background, "#fff8f0");
  assert.ok(
    contraste(theme.colors.background, BOOT_BACKGROUND) > 15,
    "si esto bajara, el defecto habría sido un matiz y no un frame claro"
  );
});

test("repintar sólo el fondo habría dejado el texto y el spinner invisibles", () => {
  // Por qué el arreglo tiene que traer sus propios colores de texto: los del
  // tema legado están pensados PARA el crema. Sobre `#0A0B0E` no se ven.
  assert.ok(contraste(theme.colors.ink, BOOT_BACKGROUND) < 3, "el titular legado");
  assert.ok(contraste(theme.colors.plum, BOOT_BACKGROUND) < 3, "el spinner legado");
});

test("el texto y las acciones del arranque son legibles sobre el fondo nuevo", () => {
  const medidas = [
    { nombre: "titular", color: BOOT_TEXT },
    { nombre: "cuerpo", color: BOOT_TEXT_MUTED },
    { nombre: "spinner y reintento", color: BOOT_ACCENT }
  ];
  for (const { nombre, color } of medidas) {
    const razon = contraste(color, BOOT_BACKGROUND);
    assert.ok(razon >= 4.5, `${nombre}: ${razon.toFixed(2)}:1 no alcanza el mínimo de WCAG AA`);
  }
});

// ---------------------------------------------------------------------------
// 2 · Ningún gate vuelve al tema claro, y ninguno inventa un color
// ---------------------------------------------------------------------------

test("ningún gate del arranque lee el tema claro legado", () => {
  for (const [rel, fuente] of FUENTE_GATES) {
    assert.doesNotMatch(fuente, /from "@\/theme\/theme"/, `${rel}: vuelve al tema del MVP`);
    assert.doesNotMatch(fuente, /\btheme\.colors\./, `${rel}: vuelve a los colores del MVP`);
  }
  // Y el layout raíz tampoco lo importa: el arranque entero tiene una fuente.
  assert.doesNotMatch(LAYOUT, /from "@\/theme\/theme"/);
});

test("ningún gate declara un color propio: todos salen del módulo del arranque", () => {
  const literal = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/g;
  for (const [rel, fuente] of FUENTE_GATES) {
    const encontrados = fuente.match(literal) ?? [];
    assert.deepEqual(
      encontrados,
      [],
      `${rel}: un color escrito a mano puede divergir del fondo del arranque`
    );
    assert.match(fuente, /from "@\/theme\/boot"/, `${rel}: tiene que tomar el color del arranque`);
  }
});

test("cada gate pinta su superficie con el fondo del arranque", () => {
  // No alcanza con importar el token: hay que USARLO como fondo de la
  // superficie que ocupa la pantalla. Sin esto, el color de un gate lo pondría
  // lo que hubiera detrás.
  for (const [rel, fuente] of FUENTE_GATES) {
    assert.match(fuente, /backgroundColor: BOOT_BACKGROUND/, `${rel}: falta el fondo`);
  }
  // El layout raíz lo declara DOS veces a propósito: en el nodo más alto del
  // árbol —lo que se ve entre el splash y el primer gate— y en el `Stack`, que
  // es lo que llena los huecos entre pantallas.
  assert.match(LAYOUT, /<SafeAreaProvider style=\{styles\.root\}>/);
  assert.match(LAYOUT, /root: \{ backgroundColor: BOOT_BACKGROUND, flex: 1 \}/);
  assert.match(LAYOUT, /contentStyle: \{ backgroundColor: BOOT_BACKGROUND \}/);
});

test("los estados por defecto del gate compartido tienen superficie propia", () => {
  const gate = FUENTE_GATES.get("src/components/orbita/AccountGate.tsx")!;
  // `MinimalLoading` y `ErrorState` son bloques de contenido: montados sueltos
  // no traen fondo, y el alta y el login no le pasan un `loading` propio.
  assert.match(gate, /<BootSurface>\s*<MinimalLoading \/>\s*<\/BootSurface>/);
  assert.match(gate, /<BootSurface>\s*<ErrorState onRetry=\{onRetry\} \/>\s*<\/BootSurface>/);
  assert.match(gate, /bootSurface: \{ backgroundColor: BOOT_BACKGROUND, flex: 1 \}/);
  // Y la superficie que YA trae su fondo sigue mandando: `WebLoading` y la
  // espera de las tabs no pasan por acá.
  assert.match(gate, /loading \?\? \(/);
});

// ---------------------------------------------------------------------------
// 3 · Splash, barra de estado y barra de navegación
// ---------------------------------------------------------------------------

test("la barra de estado del arranque es clara, y el shell no puede divergir", () => {
  assert.equal(BOOT_STATUS_BAR_STYLE, "light");
  assert.match(LAYOUT, /<StatusBar style=\{BOOT_STATUS_BAR_STYLE\} \/>/);
  // El default del layout raíz era `dark`: glifos oscuros, coherentes con los
  // gates crema e invisibles sobre `#0A0B0E`.
  assert.doesNotMatch(LAYOUT, /<StatusBar style="dark"/);
  // El shell repite el MISMO token, así que raíz y producto no pueden decir
  // cosas distintas sobre la misma barra.
  const shell = FUENTE_GATES.get("src/routes/v492/tabs-layout.tsx")!;
  assert.match(shell, /<StatusBar style=\{BOOT_STATUS_BAR_STYLE\} \/>/);
  assert.doesNotMatch(shell, /<StatusBar style="light"/);
});

test("app.json declara el arranque oscuro en todas sus superficies", () => {
  const { expo } = APP_JSON;
  assert.equal(expo.userInterfaceStyle, "dark");
  // Root view: lo que se ve entre que el splash se retira y React dibuja.
  assert.equal(expo.backgroundColor, BOOT_BACKGROUND);
  assert.equal(expo.ios.backgroundColor, BOOT_BACKGROUND);
  assert.equal(expo.android.backgroundColor, BOOT_BACKGROUND);
  // Splash: el primer frame de todos, el que era blanco.
  assert.equal(expo.splash.backgroundColor, BOOT_BACKGROUND);
  assert.equal(expo.ios.splash.backgroundColor, BOOT_BACKGROUND);
  assert.equal(expo.android.splash.backgroundColor, BOOT_BACKGROUND);
  // Barra de navegación de Android: el otro borde del shell.
  assert.deepEqual(expo.androidNavigationBar, {
    barStyle: "light-content",
    backgroundColor: BOOT_BACKGROUND
  });
});

test("no queda un solo color de arranque distinto del canónico", () => {
  const { expo } = APP_JSON;
  const declarados = new Set([
    expo.backgroundColor,
    expo.splash.backgroundColor,
    expo.androidNavigationBar.backgroundColor,
    expo.ios.backgroundColor,
    expo.ios.splash.backgroundColor,
    expo.android.backgroundColor,
    expo.android.splash.backgroundColor
  ]);
  assert.deepEqual([...declarados], [BOOT_BACKGROUND], "el arranque tiene UN color");
  // El ícono adaptativo de Android no es arranque —es el lanzador— y queda como
  // estaba: cambiarlo sería rediseñar el ícono, no arreglar el arranque.
  assert.equal(expo.android.adaptiveIcon.backgroundColor, "#0D0E12");
});

test("la promoción autorizada conserva 1.0.0 y prepara exactamente el build 24", () => {
  // Esta tanda toca `app.json`, así que el efecto nativo aparece recién con un
  // build nuevo — y la política de runtime es `fingerprint`, o sea que el
  // fingerprint cambió. Lucas autorizó explícitamente la promoción: se conserva
  // la versión comercial y se fija el número exacto del nuevo RC.
  assert.equal(APP_JSON.expo.runtimeVersion.policy, "fingerprint");
  assert.equal(APP_JSON.expo.version, "1.0.0");
  assert.equal(APP_JSON.expo.ios.buildNumber, "24");
});

// ---------------------------------------------------------------------------
// 4 · Los redirects de gate reemplazan sin animación (y sólo ellos)
// ---------------------------------------------------------------------------

/** Cada `<Stack.Screen>` del layout raíz, con lo que declara después del nombre. */
const PANTALLAS_RAIZ = new Map<string, string>(
  [...LAYOUT.matchAll(/<Stack\.Screen\s+name="([^"]+)"([^/]*)\/>/g)].map(
    (m) => [m[1], m[2]] as const
  )
);

test("las cuatro rutas del arranque reemplazan sin animación", () => {
  assert.equal(BOOT_SCREEN_ANIMATION, "none");
  assert.equal(BOOT_SCREEN_OPTIONS.animation, "none");
  assert.equal(BOOT_SCREEN_OPTIONS.contentStyle.backgroundColor, BOOT_BACKGROUND);

  // Son los cuatro extremos de las decisiones de arranque: la raíz que decide,
  // el alta, el login y el producto.
  assert.deepEqual([...BOOT_GATE_ROUTES], ["index", "onboarding", "iniciar-sesion", "(tabs)"]);
  for (const nombre of BOOT_GATE_ROUTES) {
    assert.ok(PANTALLAS_RAIZ.has(nombre), `el layout raíz no declara «${nombre}»`);
    assert.match(
      PANTALLAS_RAIZ.get(nombre) ?? "",
      /options=\{BOOT_SCREEN_OPTIONS\}/,
      `${nombre}: un redirect de gate no puede deslizar`
    );
  }
});

test("la navegación normal posterior conserva su animación", () => {
  // Todo lo que NO es arranque se abre DESDE el producto: el pago, las
  // lecturas, la carta completa, el editor de datos, la recepción del día 1.
  // Ninguna lleva opciones propias, así que ninguna perdió su transición.
  const arranque = new Set<string>(BOOT_GATE_ROUTES);
  for (const [nombre, opciones] of PANTALLAS_RAIZ) {
    if (arranque.has(nombre)) continue;
    assert.doesNotMatch(
      opciones,
      /options=/,
      `${nombre}: no es una ruta de arranque y no debería declarar opciones`
    );
  }
  // Y los stacks de pestaña siguen deslizando, con su propio respeto por
  // "Reducir movimiento": el corte del arranque no se derramó hacia adentro.
  const opcionesStack = sinComentarios(leer("src/components/v492/stackOptions.ts"));
  assert.match(
    opcionesStack,
    /animation: reducedMotion \? \("none" as const\) : \("slide_from_right" as const\)/
  );
  assert.match(opcionesStack, /contentStyle: \{ backgroundColor: v492\.colors\.background \}/);
  assert.doesNotMatch(opcionesStack, /@\/theme\/boot/, "el arranque no decide la navegación interna");
});

test("un gate del arranque sale reemplazando, nunca apilando", () => {
  // `<Redirect>` es un `replace`: no deja el gate debajo en el historial, así
  // que "volver" nunca puede devolver a una pantalla de espera. Un `push` sí lo
  // haría, y además volvería a traer la animación por la ventana.
  for (const [rel, fuente] of FUENTE_GATES) {
    assert.doesNotMatch(fuente, /router\.push\(/, `${rel}: un gate no apila`);
    assert.doesNotMatch(fuente, /<Link\b/, `${rel}: un gate no ofrece navegación`);
  }
});

// ---------------------------------------------------------------------------
// 5 · Los deep links no se tocan
// ---------------------------------------------------------------------------

test("el Stack raíz declara exactamente las mismas rutas de antes", () => {
  // Una ruta que desaparece de acá es un deep link roto. La lista se fija
  // entera —y en orden— para que agregar opciones de arranque no pueda tapar un
  // borrado ni un renombre.
  assert.deepEqual(
    [...PANTALLAS_RAIZ.keys()],
    [
      "index",
      "onboarding",
      "recepcion",
      "iniciar-sesion",
      "editar-datos",
      "lab",
      "backoffice",
      "studio",
      "reading",
      "paywall",
      "checkout/success",
      "profile",
      "carta-full",
      "(tabs)"
    ]
  );
});

test("el esquema y el enrutador de app.json quedan intactos", () => {
  assert.equal(APP_JSON.expo.scheme, "orbita");
  assert.ok(APP_JSON.expo.plugins.includes("expo-router"), "los deep links salen de acá");
  assert.equal(APP_JSON.expo.extra.router.origin, false);
});

// ---------------------------------------------------------------------------
// 6 · Regresión QA23-001: el arranque no dice `Free`
// ---------------------------------------------------------------------------

test("con el entitlement sin resolver no hay plan que nombrar", () => {
  // El estado exacto del arranque en frío: el disco ya se leyó, no había nada
  // guardado y la única `subscriptions.getCurrent` sigue en vuelo.
  const decision = resolvePlanView({ remote: undefined, lastConfirmed: null, hydrated: true });
  assert.equal(decision.view, undefined);
  assert.equal(decision.resolved, false);
  // `planLabel` cae en Free por diseño, así que la única defensa es no llamarlo.
  assert.equal(planLabel(decision.view), PLAN_FREE_LABEL);
  assert.equal(planMark(decision.view), "FREE");

  const provider = sinComentarios(leer("src/hooks/useLiveApp.tsx"));
  assert.match(provider, /const labelReady = view !== undefined;/);

  const pantalla = sinComentarios(leer("src/components/v492/Screen.tsx"));
  const badge = pantalla.slice(
    pantalla.indexOf("export function PlanBadge("),
    pantalla.indexOf("export function LayerScreen(")
  );
  const guarda = badge.indexOf("if (!labelReady) return null;");
  assert.ok(guarda > 0, "el chip tiene que poder no dibujarse");
  assert.ok(guarda < badge.search(/<Text(?:\s|>)/), "y la guarda va antes de cualquier texto");
  // Y un Plus confirmado sí se nombra: el corte es la espera, no el chip.
  assert.equal(planLabel({ isPro: true }), PLAN_PLUS_LABEL);
});

test("ninguna superficie del arranque nombra un plan siquiera", () => {
  // La defensa más barata contra el parpadeo: los gates no tienen por qué saber
  // qué plan tiene la cuenta. Si ninguno lo lee, ninguno puede adivinarlo.
  const prohibidos = [/\buseEntitlement\b/, /\bPlanBadge\b/, /\bplanLabel\b/, /\bplanMark\b/, /\bFREE\b/];
  const superficies: Array<[string, string]> = [...FUENTE_GATES, [LAYOUT_RAIZ, LAYOUT]];
  for (const [rel, fuente] of superficies) {
    for (const patron of prohibidos) {
      assert.doesNotMatch(fuente, patron, `${rel}: el arranque no puede nombrar un plan`);
    }
  }
});

// ---------------------------------------------------------------------------
// 7 · Accesibilidad intacta
// ---------------------------------------------------------------------------

test("las acciones de los gates siguen anunciándose igual que antes", () => {
  // El repintado es de color: ni un rol, ni un objetivo táctil, ni un `hitSlop`
  // cambian. Se cuentan para que "sigue estando" no se confunda con "quedó una".
  for (const rel of ["src/routes/v492/index.tsx", "src/routes/v492/index.web.tsx"] as const) {
    const fuente = FUENTE_GATES.get(rel)!;
    assert.equal(
      (fuente.match(/accessibilityRole="button"/g) ?? []).length,
      2,
      `${rel}: reintento de recuperación y reintento de sesión`
    );
    assert.equal((fuente.match(/hitSlop=\{8\}/g) ?? []).length, 2, rel);
  }

  const boundary = FUENTE_GATES.get("src/components/PendingDeletionBoundary.tsx")!;
  assert.equal((boundary.match(/accessibilityRole="button"/g) ?? []).length, 1);
  assert.equal((boundary.match(/accessibilityRole="link"/g) ?? []).length, 1);
  assert.match(boundary, /minHeight: 44/, "el bloqueo conserva su objetivo táctil real");
});
