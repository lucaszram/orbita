import assert from "node:assert/strict";
import test from "node:test";
import { isPublicWebRoute, webRouteDecision } from "../src/domain/webSession";
import { sessionPhase } from "../src/domain/screenPhase";

// La regresión que motiva estos tests: el viejo `LiveGate` respondía a "sin
// sesión" renderizando un mock. Cualquiera que abriera /home sin cuenta veía
// una lectura inventada presentada como propia.

test("sin sesión la web manda a login, nunca a contenido de muestra", () => {
  const decision = webRouteDecision({
    phase: sessionPhase({ isLive: false, isAuthLoading: false, userError: false }),
    backendConfigured: true
  });
  assert.equal(decision, "aLogin");
});

test("mientras la sesión resuelve se muestra carga, no invitado", () => {
  const decision = webRouteDecision({
    phase: sessionPhase({ isLive: false, isAuthLoading: true, userError: false }),
    backendConfigured: true
  });
  assert.equal(decision, "cargando");
});

test("una fila users que no se pudo crear es error con reintento, no login silencioso", () => {
  const decision = webRouteDecision({
    phase: sessionPhase({ isLive: false, isAuthLoading: false, userError: true }),
    backendConfigured: true
  });
  assert.equal(decision, "error");
});

test("con sesión viva se renderiza la ruta", () => {
  const decision = webRouteDecision({
    phase: sessionPhase({ isLive: true, isAuthLoading: false, userError: false }),
    backendConfigured: true
  });
  assert.equal(decision, "render");
});

test("sin Convex/Clerk se dice que no está disponible en vez de rellenar con demo", () => {
  // Antes este era exactamente el camino al mock: `!hasConvex` → mock.
  for (const phase of ["cargando", "error", "invitado", "live"] as const) {
    assert.equal(webRouteDecision({ phase, backendConfigured: false }), "sinBackend");
  }
});

test("ninguna ruta de app es pública", () => {
  for (const route of ["/home", "/carta", "/personalidad", "/valores", "/transito", "/diario", "/studio", "/lab", "/backoffice"]) {
    assert.equal(isPublicWebRoute(route), false, `${route} no debe ser pública`);
  }
});

test("las rutas públicas son sólo landing, alta, login y legales", () => {
  for (const route of ["/", "/empezar", "/login", "/iniciar-sesion", "/privacy", "/terminos", "/support"]) {
    assert.equal(isPublicWebRoute(route), true, `${route} debe ser pública`);
  }
});

test("la barra final y el query string no abren una ruta privada", () => {
  assert.equal(isPublicWebRoute("/login/"), true);
  assert.equal(isPublicWebRoute("/home/"), false);
  assert.equal(isPublicWebRoute("/home?live=1"), false);
});
