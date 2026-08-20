import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { resolveEntryForPlatform } from "./moduleGraph";

// Verificación ESTRUCTURAL de los requisitos de App Review en Perfil: no se
// puede renderizar RN en node; se valida la estructura del fuente (mismo patrón
// que accountScreenLayout.test.ts).
const PERFIL = readFileSync(path.join(process.cwd(), "src/screens/PerfilScreen.tsx"), "utf8");
const PLUS = readFileSync(path.join(process.cwd(), "app/reading/plus.tsx"), "utf8");
const VOID_SRC = readFileSync(path.join(process.cwd(), "src/components/void/VoidExperience.tsx"), "utf8");
const APP_STATE = readFileSync(path.join(process.cwd(), "src/hooks/useAppState.tsx"), "utf8");
const INDEX_WRAPPER = readFileSync(path.join(process.cwd(), "app/index.tsx"), "utf8");
const INDEX_NATIVE_PATH = resolveEntryForPlatform("app/index.tsx", "native");
const INDEX_WEB_PATH = resolveEntryForPlatform("app/index.tsx", "web");
const INDEXES = [
  ["native", readFileSync(INDEX_NATIVE_PATH, "utf8")],
  ["web", readFileSync(INDEX_WEB_PATH, "utf8")]
] as const;

describe("Perfil — eliminar cuenta (App Review)", () => {
  it("ofrece 'Eliminar mi cuenta' con el flujo de doble confirmación del dominio", () => {
    assert.match(PERFIL, /Eliminar mi cuenta/);
    assert.match(PERFIL, /requestAccountDeletion/);
    assert.match(PERFIL, /confirmWarning/);
    assert.match(PERFIL, /confirmDestructive/);
    assert.match(PERFIL, /destructive:\s*true/);
  });

  it("la pantalla sólo deja la INTENCIÓN escrita y entrega el control", () => {
    const marcador = PERFIL.indexOf('storePendingAccountDeletion(userId, "deletion_requested")');
    const entrega = PERFIL.indexOf("publishPendingDeletion(result.marker)");
    assert.ok(marcador > 0, "falta la fase previa `deletion_requested`");
    assert.ok(entrega > marcador, "el control se entrega DESPUÉS de persistir la intención");
    // TODO lo destructivo —incluida la mutación de Convex— vive en el boundary
    // global: mientras estuvo acá, el camino feliz era una carrera A → B y la
    // app quedaba navegable con un marcador ajeno en disco.
    for (const retirado of [
      "appApi.users.deleteAccount",
      "auth.deleteUser",
      'storePendingAccountDeletion(userId, "backend_deleted")',
      'storePendingAccountDeletion(userId, "identity_deleted")',
      "clearLocalData:",
      "clearAccountSnapshot",
      "clearPendingCleanup",
      "goToEntry"
    ]) {
      assert.equal(PERFIL.includes(retirado), false, `el Perfil no puede cablear ${retirado}`);
    }
  });

  it("el dueño capturado viaja en el marcador", () => {
    assert.match(PERFIL, /ownerUserId: userId \?\? ""/);
  });

  it("falla cerrado sin userId: no se crea un marcador sin dueño", () => {
    assert.match(PERFIL, /if \(!userId\) throw new Error/);
  });

  it("bloquea la reentrada con un lock SINCRÓNICO desde la primera línea del handler", () => {
    // useRef, no estado React: dos taps rápidos no deben abrir dos flujos.
    assert.match(PERFIL, /const deletionInFlight = useRef\(false\)/);
    assert.match(
      PERFIL,
      /if \(deletionInFlight\.current \|\| loggingOut\) return;\s*\n\s*deletionInFlight\.current = true;/
    );
    // El logout también respeta el lock (no corre en paralelo con la eliminación).
    assert.match(PERFIL, /if \(loggingOut \|\| deleting \|\| deletionInFlight\.current\) return;/);
    // Se libera al cancelar o fallar (el éxito navega y no vuelve).
    assert.match(PERFIL, /deletionInFlight\.current = false;/);
  });

  it("muestra error con reintento sin fingir éxito", () => {
    assert.match(PERFIL, /Reintentar eliminación/);
    // El copy dice lo que de verdad pasó: el único corte posible en esta
    // pantalla es no poder dejar la marca, y ahí NADA se borró todavía. Decir
    // "no pudimos eliminar tu cuenta" sugería que algo se había intentado.
    assert.match(PERFIL, /No pudimos empezar a eliminar tu cuenta/);
  });
});

describe("Arranque — la eliminación pendiente se resuelve ANTES de montar el producto", () => {
  it("el boundary envuelve sesión, bootstrap, AppState y Stack", () => {
    const layout = readFileSync(path.join(process.cwd(), "app/_layout.tsx"), "utf8");
    const boundary = layout.indexOf("<PendingDeletionBoundary>");
    assert.ok(boundary > 0, "falta el boundary global");
    for (const dentro of [
      "<OrbitaSessionProvider>",
      "<AppStateProvider>",
      "<AccountBootstrapProvider>",
      "<Stack"
    ]) {
      const posicion = layout.indexOf(dentro);
      assert.ok(posicion > boundary, `${dentro} tiene que montarse DENTRO del boundary`);
    }
    // Y el boundary vive dentro de BackendProviders: necesita Clerk para saber
    // quién está logueado antes de decidir nada.
    assert.ok(layout.indexOf("<BackendProviders>") < boundary);
  });

  it("el AppState ya no mira el marcador: un solo dueño de esa decisión", () => {
    for (const retirado of [
      "inspectPendingAccountDeletion",
      "pendingAccountDeletion",
      "completePendingDeletionPurge",
      "publishPendingDeletion"
    ]) {
      assert.equal(APP_STATE.includes(retirado), false, `useAppState no puede tener ${retirado}`);
    }
  });

  it("el boundary decide con Clerk cargado y dueño verificado, y es el único que borra", () => {
    const boundary = readFileSync(
      path.join(process.cwd(), "src/components/PendingDeletionBoundary.tsx"),
      "utf8"
    );
    assert.match(boundary, /resolvePendingDeletionBoot\(/);
    assert.match(boundary, /currentUserId: auth\?\.userId \?\? null/);
    assert.match(boundary, /attemptPendingDeletionFinalize\(\{/);
    assert.match(boundary, /deleteUser\(marker\.userId\)/);
    assert.match(boundary, /runGuardedPendingDeletionPurge\(/);
    // Estado bloqueante visible + reintento que RELEE el disco.
    assert.match(boundary, /Finalizando la eliminación/);
    assert.match(boundary, /REINTENTAR/);
    assert.match(boundary, /setTick\(\(t\) => t \+ 1\)/);

    // Y las rutas ya no corren nada destructivo.
    for (const [plataforma, index] of INDEXES) {
      assert.match(index, /usePendingDeletionGate\(\)/, plataforma);
      assert.doesNotMatch(index, /attemptPendingDeletionFinalize/, plataforma);
      assert.doesNotMatch(index, /deleteUser\(/, plataforma);
    }
    assert.match(INDEX_WRAPPER, /export \{ default \} from "@\/routes\/v492\/index"/);
    assert.equal(INDEX_NATIVE_PATH, path.join(process.cwd(), "src/routes/v492/index.tsx"));
    assert.equal(INDEX_WEB_PATH, path.join(process.cwd(), "src/routes/v492/index.web.tsx"));
  });

  it("en web el bloqueo se dibuja ANTES de la landing y su AccountGate", () => {
    const web = INDEXES[1][1];
    const bloqueo = web.indexOf('if (surface === "pending-deletion")');
    const landing = web.indexOf("<AccountGate");
    assert.ok(bloqueo > 0 && landing > 0, "faltan el bloqueo o la landing");
    assert.ok(bloqueo < landing, "REPRO: el AccountGate no puede adelantarse al bloqueo");
  });

  it("signed-out ofrece un LOGIN real, sin crear otra cuenta y sin OAuth", () => {
    const boundary = readFileSync(
      path.join(process.cwd(), "src/components/PendingDeletionBoundary.tsx"),
      "utf8"
    );
    // El flujo canónico de email + código, reutilizado tal cual.
    assert.match(boundary, /import \{ SignInScreen \} from "@\/onboarding\/screens\/SignInScreen"/);
    assert.match(boundary, /useSignInFlow\(\)/);
    assert.match(boundary, /allowSignup=\{false\}/);
    // Ni SSO: puede terminar creando una cuenta nueva o entrando con otra, y eso
    // es exactamente lo que no puede pasar con un marcador ajeno vivo.
    assert.match(boundary, /allowOAuth=\{false\}/);
    assert.match(boundary, /recovery === "sign-in-owner"/);

    // Y el `SignInScreen` respeta los dos flags: no dibuja Y no ejecuta.
    const signIn = readFileSync(
      path.join(process.cwd(), "src/onboarding/screens/SignInScreen.tsx"),
      "utf8"
    );
    assert.match(signIn, /allowSignup && shouldOfferSignup/);
    assert.match(signIn, /allowOAuth && GOOGLE_AUTH_ENABLED/);
    assert.match(signIn, /if \(!allowOAuth \|\| busy \|\| flow\.oauthBusy\) return;/);
  });

  it("WEB: el boundary no purga datos locales, ni siquiera con `identity_deleted`", () => {
    // `localStorage` es GLOBAL del origen y `clearLocalData` borra por clave sin
    // dueño: entre revalidar y borrar, otra pestaña con la sesión de B puede
    // escribir su perfil. Es un TOCTOU real y ningún "claim" escrito en el mismo
    // storage lo cierra. Fail-closed: producto bloqueado y soporte.
    const boundary = readFileSync(
      path.join(process.cwd(), "src/components/PendingDeletionBoundary.tsx"),
      "utf8"
    );
    const purga = boundary.indexOf("purge: async () => {");
    const cuerpo = boundary.slice(purga, boundary.indexOf("}).then((resultado)", purga));
    const corte = cuerpo.indexOf('if (IS_WEB) {');
    const borrado = cuerpo.indexOf("runGuardedPendingDeletionPurge(");
    assert.ok(corte > 0, "falta el corte por plataforma");
    assert.ok(borrado > corte, "el corte va ANTES de cualquier borrado");
    assert.match(cuerpo, /setPurgeBlocked\("web-unsupported"\)/);
    // Y el producto sigue bloqueado: `web-unsupported` no libera nada.
    assert.match(boundary, /purgeBlocked === "web-unsupported"/);
    // El claim best-effort ya no existe: no se documenta como exclusión fuerte.
    assert.equal(/claimPendingDeletionPurge/.test(boundary), false);
  });
});

describe("Perfil — links legales visibles", () => {
  it("Privacidad y Soporte apuntan a las URLs correctas", () => {
    assert.match(PERFIL, /https:\/\/orbitaastrologia\.xyz\/privacy/);
    assert.match(PERFIL, /https:\/\/orbitaastrologia\.xyz\/support/);
    assert.match(PERFIL, /Política de privacidad/);
    assert.match(PERFIL, /Soporte/);
    assert.match(PERFIL, /Linking\.openURL/);
  });
});

// La prohibición histórica ("Primera versión gratuita — Plus no aparece") ya no
// aplica: Órbita Plus se vende y Perfil es la única superficie de la app
// autenticada donde una cuenta Free puede activarlo (tarea 2026-08-12). Lo que
// sí se conserva es que la pantalla no invente precios ni planes: eso vive
// exclusivamente en `/paywall`, que los pide a Stripe.
describe("Perfil — el plan se ofrece por el bloque autoritativo, sin precios", () => {
  it("Perfil no escribe precios, planes ni un camino propio a checkout", () => {
    assert.equal(PERFIL.includes("reading/plus"), false);
    assert.equal(PERFIL.includes("ANUAL"), false);
    assert.equal(PERFIL.includes("SEMANAL"), false);
    // Lo que no puede haber es un IMPORTE. Buscar un `$` suelto también
    // prohibía cualquier interpolación de template literal, que no tiene nada
    // que ver con escribir un precio.
    assert.equal(
      /[$€]\s?\d|\d+[.,]\d{2}\s*(USD|ARS|€)?/.test(PERFIL),
      false,
      "el Perfil no puede escribir un importe: los precios los da la tienda"
    );
    assert.equal(/createCheckoutSession|getWebOffer/.test(PERFIL), false);
  });

  it("con sesión monta el bloque de plan, que decide con el entitlement", () => {
    assert.match(PERFIL, /\{auth\?\.isSignedIn \? <ManageSubscriptionBlock \/> : null\}/);
  });

  it("/reading/plus redirige sin mostrar planes ni precios", () => {
    assert.match(PLUS, /<Redirect href="\/" \/>/);
    assert.equal(PLUS.includes("ANUAL"), false);
    assert.equal(PLUS.includes("SEMANAL"), false);
    assert.equal(PLUS.includes("$"), false);
  });

  it("El Umbral no ofrece desbloqueo con el plan semanal", () => {
    assert.equal(VOID_SRC.includes("DESBLOQUEAR"), false);
    assert.equal(VOID_SRC.includes("SEMANAL"), false);
    assert.equal(VOID_SRC.includes("setStubPro"), false);
  });
});
