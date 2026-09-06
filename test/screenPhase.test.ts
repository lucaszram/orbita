import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { dataPhase, liveAppGate, sessionPhase, userRowForOwner } from "../src/domain/screenPhase";
import { ROOT } from "./moduleGraph";

const AUTH_OK = { isLoaded: true, isConnecting: false, isSignedIn: true, isAuthenticated: true };

describe("liveAppGate — la carrera del primer render (userRow='idle')", () => {
  it("Clerk isSignedIn=true con Convex isAuthenticated=false → cargando, JAMÁS invitado", () => {
    // Sesión restaurada por Clerk, token todavía sin validar en Convex:
    // isConnecting puede ser false y userRow 'idle' — sigue siendo carga.
    const handshake = liveAppGate(
      { isLoaded: true, isConnecting: false, isSignedIn: true, isAuthenticated: false },
      "idle"
    );
    assert.equal(handshake.isLive, false);
    assert.equal(handshake.isAuthLoading, true);
    assert.equal(sessionPhase(handshake), "cargando");
    assert.notEqual(sessionPhase(handshake), "invitado");
  });
  it("sesión ya autenticada con la fila users SIN resolver (idle) → SIEMPRE cargando", () => {
    // Clerk restauró la sesión pero el efecto de ensureUser todavía no corrió:
    // el gate viejo daba isLive=false + isAuthLoading=false → 'invitado' → mocks.
    const idle = liveAppGate(AUTH_OK, "idle");
    assert.equal(idle.isLive, false);
    assert.equal(idle.isAuthLoading, true);
    assert.equal(sessionPhase(idle), "cargando");
  });

  it("pending → cargando; ready → live; error → error", () => {
    assert.equal(sessionPhase(liveAppGate(AUTH_OK, "pending")), "cargando");
    assert.equal(sessionPhase(liveAppGate(AUTH_OK, "ready")), "live");
    assert.equal(sessionPhase(liveAppGate(AUTH_OK, "error")), "error");
  });

  it("Clerk sin cargar o reconectando → cargando, incluso sin autenticación", () => {
    assert.equal(
      sessionPhase(
        liveAppGate({ isLoaded: false, isConnecting: false, isSignedIn: false, isAuthenticated: false }, "idle")
      ),
      "cargando"
    );
    assert.equal(
      sessionPhase(
        liveAppGate({ isLoaded: true, isConnecting: true, isSignedIn: false, isAuthenticated: false }, "idle")
      ),
      "cargando"
    );
  });

  it("invitado CONFIRMADO: Clerk resuelto, sin sesión (isSignedIn=false), sin conexión en curso", () => {
    assert.equal(
      sessionPhase(
        liveAppGate({ isLoaded: true, isConnecting: false, isSignedIn: false, isAuthenticated: false }, "idle")
      ),
      "invitado"
    );
  });
});

/**
 * Regla anti-flash de mocks: "invitado" es la ÚNICA fase que puede renderizar
 * la experiencia demo/mock. Estas regresiones fijan que ninguna otra
 * combinación de sesión/dato cae ahí.
 */

describe("sessionPhase — la sesión decide antes que nada", () => {
  it("1 · auth sin resolver → cargando, jamás la fase que muestra mocks", () => {
    assert.equal(sessionPhase({ isAuthLoading: true, userError: false, isLive: false }), "cargando");
    // reconexión: isLive puede seguir true mientras auth revalida — sigue siendo carga
    assert.equal(sessionPhase({ isAuthLoading: true, userError: false, isLive: true }), "cargando");
  });

  it("3 · sesión rota → error con reintento, no mock", () => {
    assert.equal(sessionPhase({ isAuthLoading: false, userError: true, isLive: false }), "error");
  });

  it("invitado CONFIRMADO (Clerk resuelto, sin sesión) → recién ahí la demo", () => {
    assert.equal(sessionPhase({ isAuthLoading: false, userError: false, isLive: false }), "invitado");
  });

  it("sesión viva → live (el dato decide el resto)", () => {
    assert.equal(sessionPhase({ isAuthLoading: false, userError: false, isLive: true }), "live");
  });
});

describe("dataPhase — con sesión viva, el dato decide", () => {
  it("2 · query/action pendiente → cargando, no mock", () => {
    assert.equal(dataPhase({ pending: true }), "cargando");
  });

  it("3 · action falló → error (aunque también esté pendiente un reintento)", () => {
    assert.equal(dataPhase({ pending: false, failed: true }), "error");
    assert.equal(dataPhase({ pending: true, failed: true }), "error");
  });

  it("4 · el backend confirmó que no hay datos → vacío real, no demo", () => {
    assert.equal(dataPhase({ pending: false, empty: true }), "vacio");
  });

  it("dato presente → listo", () => {
    assert.equal(dataPhase({ pending: false }), "listo");
    assert.equal(dataPhase({ pending: false, failed: false, empty: false }), "listo");
  });
});

describe("userRowForOwner — el `ready` de A no vale para B (B10)", () => {
  it("REPRO A→B: la fila cae a `idle` SINCRÓNICAMENTE, sin esperar al efecto", () => {
    const deA = { owner: "user_a", state: "ready" } as const;
    // Mismo dueño: vale.
    assert.equal(userRowForOwner(deA, "user_a"), "ready");
    assert.equal(liveAppGate(AUTH_OK, userRowForOwner(deA, "user_a")).isLive, true);
    // Cambió la cuenta: el `ready` de A no puede dar por viva la sesión de B.
    assert.equal(userRowForOwner(deA, "user_b"), "idle");
    const comoB = liveAppGate(AUTH_OK, userRowForOwner(deA, "user_b"));
    assert.equal(comoB.isLive, false);
    assert.equal(comoB.isAuthLoading, true, "es carga, nunca invitado");
    assert.equal(sessionPhase(comoB), "cargando");
  });

  it("sin dueño publicado o sin sesión, siempre `idle`", () => {
    assert.equal(userRowForOwner({ owner: null, state: "ready" }, "user_a"), "idle");
    assert.equal(userRowForOwner({ owner: "user_a", state: "ready" }, null), "idle");
    assert.equal(userRowForOwner({ owner: null, state: "error" }, null), "idle");
  });

  it("el provider lo usa: el estado viaja con su dueño", () => {
    const provider = readFileSync(join(ROOT, "src/hooks/useLiveApp.tsx"), "utf8");
    assert.match(provider, /userRowForOwner\(rowSlot, owner\)/);
    assert.match(provider, /setRowSlot\(\{ owner, state: "ready" \}\)/);
    // Y el efecto se re-dispara con el dueño, no sólo con `isAuthenticated`.
    assert.match(provider, /\[auth\.isAuthenticated, owner, attempt\]/);
  });

  it("`ready` sólo si la fila que volvió es de ESTE dueño", () => {
    // No alcanza con que `ensureUser` no haya tirado: si el handshake de Convex
    // todavía estaba autenticado como A, la fila que vuelve es la de A.
    const provider = readFileSync(join(ROOT, "src/hooks/useLiveApp.tsx"), "utf8");
    assert.match(provider, /const fila = await ensureUser\(\{\}\);/);
    assert.match(provider, /if \(fila\?\.clerkUserId === owner\) \{/);
    const publica = provider.indexOf('setRowSlot({ owner, state: "ready" })');
    const chequeo = provider.indexOf("fila?.clerkUserId === owner");
    assert.ok(chequeo > 0 && publica > chequeo, "se inspecciona ANTES de publicar");
  });

  it("Convex vuelve a autenticar cuando cambia el userId de Clerk (D)", () => {
    // La versión instalada de `ConvexProviderWithClerk` memoiza su
    // `fetchAccessToken` con `[orgId, orgRole]` y NADA más: ignora `getToken` y
    // no mira el `userId`. Un cambio A → B en la misma org no disparaba
    // `setAuth`, así que Convex seguía hablando como A. Por eso acá se usa
    // `ConvexProviderWithAuth` con un hook propio.
    const providers = readFileSync(join(ROOT, "src/services/backendProviders.tsx"), "utf8");
    // Lo que se verifica es el RUNTIME —import y JSX—, no la palabra: el
    // adapter viejo se puede nombrar en un comentario para explicar por qué no
    // se usa, y eso no es un cableado.
    const codigo = providers.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.match(codigo, /import \{[^}]*ConvexProviderWithAuth[^}]*\} from "convex\/react"/);
    assert.match(codigo, /<ConvexProviderWithAuth\b/);
    assert.equal(
      /ConvexProviderWithClerk/.test(codigo),
      false,
      "su memoización ignora el userId: no puede importarse ni montarse"
    );
    assert.equal(
      /convex\/react-clerk/.test(codigo),
      false,
      "el adapter viejo no puede quedar en el grafo"
    );
    assert.match(providers, /function useConvexAuthFromClerk/);
    assert.match(codigo, /useAuth=\{useConvexAuthFromClerk\}/);

    const hook = providers.slice(
      providers.indexOf("function useConvexAuthFromClerk"),
      providers.indexOf("export function BackendProviders")
    );
    // El contrato de `ConvexProviderWithAuth`.
    assert.match(hook, /isLoading: !isLoaded/);
    assert.match(hook, /isAuthenticated: Boolean\(isSignedIn\) && Boolean\(userId\)/);
    assert.match(hook, /fetchAccessToken/);
    // La identidad del token cambia con el DUEÑO, y respeta sesión/org/rol.
    assert.match(hook, /\[userId, sessionId, orgId, orgRole, usaTemplate\]/);
    // `getToken` es inestable en Expo: se lee de una ref viva, no de las deps.
    assert.match(hook, /getTokenRef\.current/);
    // Y se respeta el `aud` actual: sin template si el JWT ya viene para Convex.
    assert.match(hook, /aud\?: unknown/);
  });
});
