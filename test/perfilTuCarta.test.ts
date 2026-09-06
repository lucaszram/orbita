/**
 * Pestaña 5: de "Perfil" a "Tu carta".
 *
 * ## La decisión de producto (Lucas, 2026-08-19, probando en iPhone físico)
 *
 * La carta natal es el corazón de la app y estaba enterrada a dos taps
 * (Perfil → tarjeta → hub). La 5ª pestaña pasa a mostrar el hub de la carta
 * directamente, y lo administrativo (editar datos, cuenta, suscripción,
 * legales, eliminar cuenta) queda detrás de un engranaje arriba a la derecha —
 * donde antes iba la fecha, que en una base natal es ruido: la base es lo que
 * no se mueve.
 *
 * Bonus estructural: el defecto "entro a mi carta y no puedo volver" muere por
 * diseño. El hub usaba el chrome de raíz (`LayerScreen`, sin back) siendo un
 * detalle; al pasar a SER la raíz de la pestaña, ese chrome es el correcto.
 *
 * ## Regla dura: cero regresiones web
 *
 * `/perfil` en web sigue mostrando el PerfilScreen administrativo actual. La
 * divergencia es por wrappers de plataforma (`perfil-index.tsx` / `.web.tsx`),
 * el mismo patrón que ya usa `perfil-carta`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { ROOT, reachableFrom, resolveEntryForPlatform } from "./moduleGraph";
import { relative } from "node:path";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const relativo = (absolute: string) => relative(ROOT, absolute);

describe("corte 1 — LayerScreen gana un slot de acción en el header", () => {
  const fuente = leer("src/components/v492/Screen.tsx");

  it("declara `action?: ReactNode` en el contrato de LayerScreen", () => {
    const layer = fuente.slice(
      fuente.indexOf("export function LayerScreen"),
      fuente.indexOf("export function DetailLayerScreen")
    );
    assert.match(layer, /action\?: ReactNode/, "el prop existe y es opcional");
  });

  it("la acción se dibuja en la fila de marca, con prioridad sobre la meta", () => {
    // La pantalla es dueña de la geometría (el View con styles.headerAction);
    // el caller trae la semántica (su Touchable con label). Y conserva `{meta}`
    // dentro de <Mono> — que es lo que fija v492CopyA11y — haciendo imposible
    // dibujar fecha y engranaje a la vez.
    assert.match(
      fuente,
      /\{action \? \(\s*<View style=\{styles\.headerAction\}>\{action\}<\/View>\s*\) : meta \? \(\s*<Mono style=\{styles\.headerMeta\}>\{meta\}<\/Mono>\s*\) : null\}/,
      "action (envuelto en su geometría) reemplaza a meta cuando está presente"
    );
  });

  it("el área táctil del slot cumple 44×44", () => {
    // El estilo del slot usa el token de toque, igual que el back de
    // DetailLayerScreen. Sin esto el engranaje sería un target de lupa.
    assert.match(
      fuente,
      /headerAction: \{[^}]*height: v492\.touch[^}]*width: v492\.touch|headerAction: \{[^}]*width: v492\.touch[^}]*height: v492\.touch/s,
      "styles.headerAction fija alto y ancho al token v492.touch (44)"
    );
  });
});

describe("corte 2 — la pantalla de ajustes existe y el engranaje la abre", () => {
  it("la ruta /perfil/ajustes resuelve por plataforma", () => {
    assert.equal(
      relativo(resolveEntryForPlatform("app/(tabs)/perfil/ajustes.tsx", "native")),
      "src/routes/v492/perfil-ajustes.tsx"
    );
    assert.equal(
      relativo(resolveEntryForPlatform("app/(tabs)/perfil/ajustes.tsx", "web")),
      "src/routes/v492/perfil-ajustes.web.tsx"
    );
  });

  it("en nativo es un detalle con ← que monta el cuerpo administrativo", () => {
    const impl = sinComentarios(leer("src/routes/v492/perfil-ajustes.tsx"));
    assert.match(impl, /<DetailLayerScreen[^>]*eyebrow="AJUSTES"/s, "chrome de detalle con back");
    assert.match(impl, /fallbackHref="\/perfil"/, "el back cae a la raíz de la pestaña");
    assert.match(impl, /<PerfilAjustesBody\s*\/>/, "monta el cuerpo compartido");
  });

  it("en web redirige a /perfil sin arrastrar el chrome nativo al grafo", () => {
    const impl = sinComentarios(leer("src/routes/v492/perfil-ajustes.web.tsx"));
    assert.match(impl, /<Redirect href="\/perfil" \/>/);
    const grafo = reachableFrom(["src/routes/v492/perfil-ajustes.web.tsx"], "web");
    assert.ok(
      ![...grafo].some((file) => file.endsWith("components/v492/Screen.tsx")),
      "la web no debe cargar el chrome V4.9.2 por esta ruta"
    );
  });

  it("PerfilAjustesBody: administrativo puro, sin hero ni tarjeta ni shell propio", () => {
    const perfil = sinComentarios(leer("src/screens/PerfilScreen.tsx"));
    assert.match(perfil, /export function PerfilAjustesBody/, "el cuerpo se exporta desde el archivo canónico");
    const cuerpo = perfil.slice(perfil.indexOf("export function PerfilAjustesBody"));
    const bloque = cuerpo.slice(0, cuerpo.indexOf("\n}") + 2);
    assert.doesNotMatch(bloque, /FullBleedHero|<CartaCard|<OrbitaScreen/, "nada visual del Perfil web");
  });

  it("el Shell de la carta lleva el engranaje en TODAS las fases, y ya no la fecha", () => {
    const hub = sinComentarios(leer("src/screens/v492/CartaHubScreen.tsx"));
    // El engranaje vive en el Shell — que envuelve cargando/error/invitado/live —
    // así el invitado también puede llegar a ajustes para iniciar sesión.
    const shell = hub.slice(hub.indexOf("function Shell"));
    assert.match(shell, /action=\{/, "el Shell pasa la acción al LayerScreen");
    assert.match(hub, /router\.push\("\/perfil\/ajustes"\)/, "el engranaje abre ajustes");
    assert.match(hub, /accessibilityLabel="Ajustes de tu cuenta"/, "con label de VoiceOver");
    // La fecha de hoy no tiene lugar en la base natal: es lo que no se mueve.
    assert.doesNotMatch(hub, /formatWeekdayDate/, "la meta-fecha sale del hub");
  });

  it("los redirects administrativos apuntan a ajustes", () => {
    for (const ruta of ["privacy", "support", "terminos", "checkout-success"]) {
      assert.match(
        sinComentarios(leer(`src/routes/v492/${ruta}.tsx`)),
        /<Redirect href="\/perfil\/ajustes" \/>/,
        `${ruta} es administrativo: aterriza en ajustes, no en la carta`
      );
    }
  });
});

describe("corte 3 — el hub ES la raíz de la pestaña", () => {
  it("/perfil resuelve al hub en nativo y al PerfilScreen actual en web", () => {
    assert.equal(
      relativo(resolveEntryForPlatform("app/(tabs)/perfil/index.tsx", "native")),
      "src/routes/v492/perfil-index.tsx"
    );
    assert.equal(
      relativo(resolveEntryForPlatform("app/(tabs)/perfil/index.tsx", "web")),
      "src/routes/v492/perfil-index.web.tsx"
    );
    assert.match(
      sinComentarios(leer("src/routes/v492/perfil-index.tsx")),
      /<CartaHubScreen\s*\/>/,
      "nativo monta el hub"
    );
  });

  it("GARANTÍA anti-regresión web: /perfil web llega a PerfilScreen y nunca al hub", () => {
    const grafo = reachableFrom(["app/(tabs)/perfil/index.tsx"], "web");
    const archivos = [...grafo].map((file) => relativo(file));
    assert.ok(
      archivos.includes("src/screens/PerfilScreen.tsx"),
      "la web conserva el Perfil administrativo tal cual"
    );
    assert.ok(
      !archivos.includes("src/screens/v492/CartaHubScreen.tsx"),
      "el hub V4.9.2 no puede entrar al bundle web por /perfil"
    );
  });

  it("los deep links legados aterrizan en el hub con UN salto", () => {
    // /perfil/carta fue el hub hasta hoy; ahora el hub es /perfil.
    assert.match(
      sinComentarios(leer("src/routes/v492/perfil-carta.tsx")),
      /<Redirect href="\/perfil" \/>/
    );
    // La web de esa ruta no cambia: sigue yendo a su carta legada.
    assert.match(
      sinComentarios(leer("src/routes/v492/perfil-carta.web.tsx")),
      /<Redirect href="\/carta" \/>/
    );
    // Y /(tabs)/carta ya no encadena dos redirects: va directo a la raíz.
    assert.match(
      sinComentarios(leer("src/routes/v492/tabs-carta.tsx")),
      /<Redirect href="\/perfil" \/>/
    );
  });

  it("los tres detalles de la carta caen a /perfil si no hay historial", () => {
    for (const rel of [
      "src/screens/v492/TipoLunarDetailScreen.tsx",
      "src/screens/v492/MapaElementalDetailScreen.tsx",
      "src/screens/v492/CartaCompletaV492Screen.tsx"
    ]) {
      assert.match(
        sinComentarios(leer(rel)),
        /fallbackHref="\/perfil"/,
        `${rel}: el back sin historial vuelve a la raíz de la pestaña`
      );
    }
  });
});

describe("corte 4 — el título de la pestaña y su doble fuente de verdad", () => {
  it("LABELS (TabBar) y Tabs.Screen (tabs-layout) dicen exactamente lo mismo", () => {
    // La barra dibuja desde su propio mapa LABELS; el layout declara los
    // Tabs.Screen. Son dos fuentes del mismo hecho y hasta hoy nadie fijaba que
    // coincidieran — este cambio de título lo reveló como riesgo.
    const layout = sinComentarios(leer("src/routes/v492/tabs-layout.tsx"));
    const bar = sinComentarios(leer("src/components/orbita/TabBar.tsx"));
    const declaradas = [...layout.matchAll(/<Tabs\.Screen name="(\w+)" options=\{\{ title: "([^"]+)" \}\} \/>/g)]
      .map((m) => [m[1], m[2]]);
    assert.ok(declaradas.length === 5, "cinco pestañas declaradas");
    for (const [name, title] of declaradas) {
      assert.match(
        bar,
        new RegExp(`${name}: "${title}"`),
        `TabBar.LABELS[${name}] tiene que decir "${title}" igual que el layout`
      );
    }
    assert.match(layout, /name="perfil" options=\{\{ title: "Carta" \}\}/, "la 5ª pestaña se llama Carta");
  });
});
