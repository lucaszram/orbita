import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  DEFAULT_ANALYTICS_HOST,
  INITIAL_PAGE_VIEW_STATE,
  PAGE_VIEW_EVENT,
  REDACTED_SEGMENT,
  nextPageView,
  normalizePagePath,
  resolveAnalyticsConfig,
  sanitizeAnalyticsProperties,
  stripQueryAndHash
} from "../src/domain/pageView";

const read = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8");

describe("page_view — normalización de la ruta", () => {
  it("conserva las rutas reales del producto tal cual", () => {
    assert.equal(normalizePagePath("/"), "/");
    assert.equal(normalizePagePath("/empezar"), "/empezar");
    assert.equal(normalizePagePath("/iniciar-sesion"), "/iniciar-sesion");
    assert.equal(normalizePagePath("/reading/deep-dive"), "/reading/deep-dive");
    assert.equal(normalizePagePath("/checkout/success"), "/checkout/success");
  });

  it("descarta query y fragmento, que es donde viajan los datos personales", () => {
    // El ticket del alta de Clerk, el retorno de Stripe y el email por params.
    assert.equal(normalizePagePath("/empezar?__clerk_ticket=abc123"), "/empezar");
    assert.equal(normalizePagePath("/checkout/success?session_id=cs_test_a1b2"), "/checkout/success");
    assert.equal(normalizePagePath("/iniciar-sesion?email=lucas%40orbita.xyz"), "/iniciar-sesion");
    // El registro de Clerk rutea por hash dentro de /empezar.
    assert.equal(normalizePagePath("/empezar#/create"), "/empezar");
    assert.equal(normalizePagePath("/empezar?resume=datos#/create"), "/empezar");
  });

  it("normaliza barras, espacios y URLs absolutas", () => {
    assert.equal(normalizePagePath("/empezar/"), "/empezar");
    assert.equal(normalizePagePath("//reading//luna//"), "/reading/luna");
    assert.equal(normalizePagePath("  /empezar  "), "/empezar");
    assert.equal(normalizePagePath("empezar"), "/empezar");
    assert.equal(normalizePagePath(""), "/");
    assert.equal(normalizePagePath("https://orbitaastrologia.xyz/terminos?x=1"), "/terminos");
    assert.equal(normalizePagePath("https://orbitaastrologia.xyz"), "/");
  });

  it("redacta segmentos que podrían ser un identificador", () => {
    // Hoy ninguna ruta tiene segmento dinámico; la guarda es para el día que sí.
    assert.equal(normalizePagePath("/reading/lucas@orbita.xyz"), `/reading/${REDACTED_SEGMENT}`);
    assert.equal(normalizePagePath("/reading/lucas%40orbita.xyz"), `/reading/${REDACTED_SEGMENT}`);
    assert.equal(normalizePagePath("/reading/12345"), `/reading/${REDACTED_SEGMENT}`);
    assert.equal(
      normalizePagePath("/reading/3f2504e0-4f89-11d3-9a0c-0305e82c3301"),
      `/reading/${REDACTED_SEGMENT}`
    );
    assert.equal(normalizePagePath("/perfil/user_2abc12345678xyz"), `/perfil/${REDACTED_SEGMENT}`);
  });

  it("no redacta tramos legítimos que se le parecen", () => {
    // Palabras largas sin dígitos, y rutas cortas con número, siguen siendo rutas.
    assert.equal(normalizePagePath("/reading/vinculo-result"), "/reading/vinculo-result");
    assert.equal(normalizePagePath("/preview-alta"), "/preview-alta");
    assert.equal(normalizePagePath("/carta-full"), "/carta-full");
  });

  it("stripQueryAndHash corta en el primer separador", () => {
    assert.equal(stripQueryAndHash("/a?b=1#c"), "/a");
    assert.equal(stripQueryAndHash("/a#c?b=1"), "/a");
    assert.equal(stripQueryAndHash("/a"), "/a");
  });
});

describe("page_view — dedup", () => {
  it("mide la primera pantalla", () => {
    const step = nextPageView(INITIAL_PAGE_VIEW_STATE, "/empezar");
    assert.equal(step.capture, "/empezar");
    assert.equal(step.state.lastPath, "/empezar");
  });

  it("no repite la misma pantalla cuando el efecto se vuelve a disparar", () => {
    // StrictMode monta dos veces en dev y un cambio de params re-renderiza:
    // sin dedup la misma pantalla se contaría de más.
    const first = nextPageView(INITIAL_PAGE_VIEW_STATE, "/empezar");
    const second = nextPageView(first.state, "/empezar");
    assert.equal(second.capture, null);
    assert.equal(second.state.lastPath, "/empezar");
  });

  it("deduplica por ruta normalizada, no por el string crudo", () => {
    const first = nextPageView(INITIAL_PAGE_VIEW_STATE, "/empezar");
    const second = nextPageView(first.state, "/empezar?resume=datos");
    const third = nextPageView(second.state, "/empezar/#/create");
    assert.equal(second.capture, null);
    assert.equal(third.capture, null);
  });

  it("vuelve a medir una pantalla si el usuario navegó a otra en el medio", () => {
    const a = nextPageView(INITIAL_PAGE_VIEW_STATE, "/");
    const b = nextPageView(a.state, "/empezar");
    const c = nextPageView(b.state, "/");
    assert.deepEqual([a.capture, b.capture, c.capture], ["/", "/empezar", "/"]);
  });

  it("no muta el estado que recibe", () => {
    const before = { ...INITIAL_PAGE_VIEW_STATE };
    nextPageView(INITIAL_PAGE_VIEW_STATE, "/empezar");
    assert.deepEqual(INITIAL_PAGE_VIEW_STATE, before);
  });
});

describe("page_view — configuración", () => {
  it("sin clave pública no hay analytics", () => {
    assert.equal(resolveAnalyticsConfig({}), null);
    assert.equal(resolveAnalyticsConfig({ key: "" }), null);
    assert.equal(resolveAnalyticsConfig({ key: "   " }), null);
    assert.equal(resolveAnalyticsConfig({ key: undefined, host: "https://x.example" }), null);
  });

  it("con clave usa el host del deploy, o el default del proyecto", () => {
    assert.deepEqual(resolveAnalyticsConfig({ key: "phc_abc" }), {
      key: "phc_abc",
      host: DEFAULT_ANALYTICS_HOST
    });
    assert.deepEqual(resolveAnalyticsConfig({ key: " phc_abc ", host: " https://ph.orbita.xyz " }), {
      key: "phc_abc",
      host: "https://ph.orbita.xyz"
    });
  });
});

describe("page_view — propiedades que agrega el SDK", () => {
  it("le saca query y fragmento a las propiedades de URL", () => {
    assert.deepEqual(
      sanitizeAnalyticsProperties({
        $current_url: "https://orbitaastrologia.xyz/empezar?__clerk_ticket=abc#/create",
        $initial_current_url: "https://orbitaastrologia.xyz/?utm_source=x",
        $referrer: "https://buscador.example/?q=lucas+ramos",
        $pathname: "/checkout/success?session_id=cs_test_a1b2"
      }),
      {
        $current_url: "https://orbitaastrologia.xyz/empezar",
        $initial_current_url: "https://orbitaastrologia.xyz/",
        $referrer: "https://buscador.example/",
        $pathname: "/checkout/success"
      }
    );
  });

  it("no toca lo que no es una propiedad de URL", () => {
    assert.deepEqual(
      sanitizeAnalyticsProperties({ path: "/empezar", $screen_width: 390, $browser: "Safari" }),
      { path: "/empezar", $screen_width: 390, $browser: "Safari" }
    );
  });

  it("no muta el objeto original", () => {
    const original = { $current_url: "https://x.example/a?b=1" };
    sanitizeAnalyticsProperties(original);
    assert.equal(original.$current_url, "https://x.example/a?b=1");
  });
});

describe("page_view — cableado web/nativo", () => {
  it("la web apaga todo el capture automático de PostHog", () => {
    const web = read("src/services/analytics.web.ts");
    for (const off of [
      "autocapture: false",
      "capture_pageview: false",
      "capture_pageleave: false",
      "capture_heatmaps: false",
      "capture_dead_clicks: false",
      "capture_performance: false",
      "rageclick: false",
      "disable_surveys: true",
      "disable_session_recording: true"
    ]) {
      assert.ok(web.includes(off), `falta \`${off}\` en el init de PostHog`);
    }
    // Sin perfiles de persona y con la limpieza de propiedades enchufada.
    assert.match(web, /person_profiles:\s*"never"/);
    assert.match(web, /sanitize_properties:/);
    // El único evento es el nuestro: nada de `posthog.identify` ni otros capture.
    assert.match(web, /posthog\.capture\(PAGE_VIEW_EVENT/);
    assert.doesNotMatch(web, /posthog\.identify/);
    assert.equal(web.match(/posthog\.capture\(/g)?.length, 1);
  });

  it("sin clave pública el SDK no se inicializa", () => {
    const web = read("src/services/analytics.web.ts");
    // `config === null` es lo único que corta el init; el guard está antes de
    // cualquier llamada al SDK.
    assert.ok(web.indexOf("if (started || config === null) return;") < web.indexOf("posthog.init("));
    assert.match(web, /process\.env\.EXPO_PUBLIC_POSTHOG_KEY/);
    assert.match(web, /process\.env\.EXPO_PUBLIC_POSTHOG_HOST/);
  });

  it("nativo es no-op y no importa PostHog", () => {
    const native = read("src/services/analytics.ts");
    const tracker = read("src/components/PageViewTracker.tsx");
    assert.doesNotMatch(native, /posthog/i);
    assert.doesNotMatch(tracker, /posthog/i);
    assert.match(native, /export const ANALYTICS_ENABLED = false/);
    assert.doesNotMatch(tracker, /usePathname/);
  });

  it("el tracker se monta una vez en el layout raíz", () => {
    const layout = read("app/_layout.tsx");
    assert.match(layout, /import \{ PageViewTracker \} from "@\/components\/PageViewTracker"/);
    assert.equal(layout.match(/<PageViewTracker \/>/g)?.length, 1);
  });

  it("las variables públicas están documentadas en .env.example", () => {
    const env = read(".env.example");
    assert.match(env, /^EXPO_PUBLIC_POSTHOG_KEY=/m);
    assert.match(env, /^EXPO_PUBLIC_POSTHOG_HOST=/m);
  });

  it("el evento se llama page_view", () => {
    assert.equal(PAGE_VIEW_EVENT, "page_view");
  });
});
