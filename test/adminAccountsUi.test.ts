/**
 * Pestaña `Cuentas` del backoffice — frontend.
 *
 * Dos mitades:
 *
 *  · **Decisiones puras** (`src/domain/adminAccounts.ts`): validar un grant,
 *    decidir cuándo una query paginada tiene permiso para salir, y —la que más
 *    importa— qué se le dice a la persona después de revocar. Se prueban sin
 *    renderizar nada.
 *
 *  · **Cableado estructural**: que el shell tenga las dos pestañas, que las
 *    queries salgan contra las funciones del contrato, que las paginadas estén
 *    gateadas, que no entre otra librería de fetching y que los controles sean
 *    alcanzables con teclado y lector de pantalla.
 *
 * El invariante que este archivo existe para proteger: **el backoffice no
 * adivina el acceso**. Todo lo que se muestra sobre Pro sale de
 * `effectiveAccess`, que es lo único autoritativo.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ADMIN_GRANT_PRESETS,
  ADMIN_RANGES,
  ADMIN_REASON_MAX,
  ADMIN_REASON_MIN,
  ADMIN_REVOKE_WARNING,
  ADMIN_SEGMENTS,
  ADMIN_SORTS,
  type AdminAccount,
  type AdminDashboard,
  type AdminEffectiveAccess,
  adminBackfillNotice,
  adminDashboardMetrics,
  adminDaysSince,
  adminEventLabel,
  adminProControls,
  adminProviderLabel,
  adminQueriesUnlocked,
  adminSearchIsActive,
  buildAdminGrantDraft,
  checkAdminReason,
  describeAdminAccess,
  describeAdminError,
  describeAdminGrantOutcome,
  describeAdminManualGrant,
  describeAdminRevokeOutcome,
  formatAdminLastActivity,
  gatedArgs,
  normalizeAdminSearch,
  parseAdminExpiryDate,
  resolveAdminGrantWindow
} from "../src/domain/adminAccounts";
import { ROOT, importsOf } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sinComentarios = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** Los archivos NUEVOS del backoffice. El Lab queda afuera: no se tocó. */
const NUEVOS = [
  "src/components/backoffice/BackofficeGate.tsx",
  "src/components/backoffice/BackofficeScreen.tsx",
  "src/components/backoffice/AdminDialog.tsx",
  "src/components/backoffice/kit.tsx",
  "src/components/backoffice/accounts/AccountsWorkspace.tsx",
  "src/components/backoffice/accounts/AccountsFilters.tsx",
  "src/components/backoffice/accounts/AccountsList.tsx",
  "src/components/backoffice/accounts/AccountDetailPanel.tsx",
  "src/components/backoffice/accounts/ProAccessDialogs.tsx"
];

const DEL_BACKOFFICE = [...NUEVOS, "src/components/backoffice/BackofficeLab.tsx"];

// ============================================================================
// 1. Gate de queries: nada sale antes que el dashboard
// ============================================================================

test("las queries del backoffice esperan a que `getDashboard` conteste OK", () => {
  assert.equal(adminQueriesUnlocked("pending"), false);
  assert.equal(adminQueriesUnlocked("error"), false);
  assert.equal(adminQueriesUnlocked("success"), true);
});

test("`gatedArgs` devuelve el literal `skip`, que es lo que Convex entiende", () => {
  assert.equal(gatedArgs(false, { segment: "all" }), "skip");
  assert.deepEqual(gatedArgs(true, { segment: "all" }), { segment: "all" });
  // Sin cuenta elegida tampoco sale, aunque el gate esté abierto: el detalle y
  // la actividad necesitan un `userId`.
  assert.equal(gatedArgs(true, null), "skip");
});

test("buscar sólo cuenta con texto real: los espacios no son una búsqueda", () => {
  assert.equal(adminSearchIsActive(""), false);
  assert.equal(adminSearchIsActive("   "), false);
  assert.equal(adminSearchIsActive("  mica  "), true);
  assert.equal(normalizeAdminSearch("  mica@orbita.app  "), "mica@orbita.app");
});

// ============================================================================
// 2. Filtros y orden expuestos
// ============================================================================

test("se ofrecen los tres rangos, los tres segmentos y los tres órdenes del contrato", () => {
  assert.deepEqual(ADMIN_RANGES.map((r) => r.value), ["7d", "30d", "90d"]);
  assert.deepEqual(ADMIN_SEGMENTS.map((s) => s.value), ["all", "pro", "free"]);
  assert.deepEqual(ADMIN_SORTS.map((s) => s.value), ["newest", "last_activity", "streak"]);
});

test("los presets del grant son los cuatro pedidos, con la fecha exacta entre medio", () => {
  assert.deepEqual(ADMIN_GRANT_PRESETS.map((p) => p.value), ["7d", "30d", "custom", "permanent"]);
});

// ============================================================================
// 3. Razón: recortada, 3–240
// ============================================================================

test("la razón se recorta antes de medirse y respeta 3–240", () => {
  assert.equal(ADMIN_REASON_MIN, 3);
  assert.equal(ADMIN_REASON_MAX, 240);

  const ok = checkAdminReason("   soporte   ");
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.reason, "soporte", "se guarda recortada: la auditoría no lleva espacios");

  // El borde inferior INCLUYE su número: 3 entra, 2 no.
  assert.equal(checkAdminReason("abc").ok, true);
  assert.equal(checkAdminReason("ab").ok, false);
  // Y un texto de espacios no es una razón por más largo que sea.
  assert.equal(checkAdminReason("        ").ok, false);

  // El borde superior también incluye su número.
  assert.equal(checkAdminReason("x".repeat(240)).ok, true);
  const largo = checkAdminReason("x".repeat(241));
  assert.equal(largo.ok, false);
  assert.equal(largo.ok === false && /240/.test(largo.error), true);
});

// ============================================================================
// 4. Ventana del grant
// ============================================================================

test("los presets de días se resuelven a un vencimiento futuro exacto", () => {
  const now = Date.parse("2026-08-04T12:00:00.000Z");
  const dia = 24 * 60 * 60 * 1000;

  const siete = resolveAdminGrantWindow({ preset: "7d", now });
  assert.equal(siete.ok && siete.mode, "until");
  assert.equal(siete.ok && siete.mode === "until" && siete.expiresAt, now + 7 * dia);

  const treinta = resolveAdminGrantWindow({ preset: "30d", now });
  assert.equal(treinta.ok && treinta.mode === "until" && treinta.expiresAt, now + 30 * dia);
});

test("permanente no lleva vencimiento: es el `isLifetime` del backend", () => {
  const permanente = resolveAdminGrantWindow({ preset: "permanent", now: 1000 });
  assert.equal(permanente.ok && permanente.mode, "permanent");
  assert.equal(permanente.ok && permanente.expiresAt, undefined);
});

test("una fecha exacta vence al final de ese día UTC y tiene que ser futura", () => {
  assert.equal(parseAdminExpiryDate("2026-12-31"), Date.parse("2026-12-31T23:59:59.999Z"));
  // Formatos que NO son una fecha.
  assert.equal(parseAdminExpiryDate("31/12/2026"), null);
  assert.equal(parseAdminExpiryDate("2026-12"), null);
  assert.equal(parseAdminExpiryDate(""), null);
  // Y un día que no existe: `Date.parse` lo desborda a marzo, el round-trip lo caza.
  assert.equal(parseAdminExpiryDate("2026-02-31"), null);

  const now = Date.parse("2026-08-04T12:00:00.000Z");
  const pasado = resolveAdminGrantWindow({ preset: "custom", customDate: "2026-08-03", now });
  assert.equal(pasado.ok, false);
  assert.equal(pasado.ok === false && /futura/.test(pasado.error), true);

  // El mismo día TODAVÍA es futuro: vence a las 23:59:59.999.
  const hoy = resolveAdminGrantWindow({ preset: "custom", customDate: "2026-08-04", now });
  assert.equal(hoy.ok, true);
});

test("el borrador junta TODOS los errores en vez de pedirlos de a uno", () => {
  const draft = buildAdminGrantDraft({
    userId: "user_1",
    preset: "custom",
    customDate: "ayer",
    reason: " ",
    now: 1000
  });
  assert.equal(draft.ok, false);
  assert.equal(draft.ok === false && draft.errors.length, 2, "fecha y razón, las dos juntas");
});

test("el borrador válido arma exactamente los `args` de `grantPro`", () => {
  const now = Date.parse("2026-08-04T12:00:00.000Z");
  const temporal = buildAdminGrantDraft({ userId: "user_1", preset: "7d", reason: "  soporte  ", now });
  assert.deepEqual(temporal.ok && temporal.args, {
    userId: "user_1",
    mode: "until",
    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
    reason: "soporte"
  });

  const permanente = buildAdminGrantDraft({ userId: "user_1", preset: "permanent", reason: "fundador", now });
  assert.deepEqual(permanente.ok && permanente.args, {
    userId: "user_1",
    mode: "permanent",
    reason: "fundador"
  });
  assert.equal(
    permanente.ok && "expiresAt" in permanente.args,
    false,
    "un grant permanente no puede mandar `expiresAt`, ni siquiera `undefined`"
  );
});

// ============================================================================
// 5. `canManagePro`: deshabilitar CON motivo, nunca esconder
// ============================================================================

test("sin permiso de escritura los controles quedan deshabilitados y explicados", () => {
  assert.deepEqual(adminProControls(true), { disabled: false });
  const sin = adminProControls(false);
  assert.equal(sin.disabled, true);
  assert.match(sin.explanation ?? "", /ORBITA_ADMIN_PRO_WRITES_ENABLED/);
});

// ============================================================================
// 6. La verdad después de la mutación
// ============================================================================

const accesoPro = (over: Partial<AdminEffectiveAccess> = {}): AdminEffectiveAccess => ({
  entitlement: "orbita_pro",
  isPro: true,
  status: "active",
  provider: "admin",
  isLifetime: false,
  canManageInStripePortal: false,
  ...over
});

const accesoFree: AdminEffectiveAccess = {
  entitlement: "free",
  isPro: false,
  status: "expired",
  isLifetime: false,
  canManageInStripePortal: false
};

test("el aviso de revocar dice, antes de tocar nada, que no cancela ningún cobro", () => {
  assert.match(ADMIN_REVOKE_WARNING, /NO cancela/);
  assert.match(ADMIN_REVOKE_WARNING, /Stripe/);
  assert.match(ADMIN_REVOKE_WARNING, /RevenueCat/);
});

test("revocar con Stripe vigente NO dice «quedó Free»: nombra al proveedor que sigue mandando", () => {
  // El caso que este mensaje existe para no tapar: el grant manual se borró de
  // verdad (`manualGrantRemoved: true`) y aun así la cuenta sigue siendo Pro.
  const outcome = describeAdminRevokeOutcome({
    manualGrantRemoved: true,
    auditEventId: "audit_1",
    effectiveAccess: accesoPro({ provider: "stripe", canManageInStripePortal: true })
  });
  assert.equal(outcome.tone, "warning");
  assert.match(outcome.title, /sigue Pro/);
  assert.match(outcome.detail, /Stripe/);
  assert.doesNotMatch(outcome.detail, /quedó Free/);
});

test("revocar con RevenueCat vigente nombra a RevenueCat", () => {
  const outcome = describeAdminRevokeOutcome({
    manualGrantRemoved: true,
    auditEventId: "audit_1",
    effectiveAccess: accesoPro({ provider: "revenuecat" })
  });
  assert.equal(outcome.tone, "warning");
  assert.match(outcome.detail, /RevenueCat/);
});

test("revocar sin nada más vigente sí dice que quedó Free", () => {
  const outcome = describeAdminRevokeOutcome({
    manualGrantRemoved: true,
    auditEventId: "audit_1",
    effectiveAccess: accesoFree
  });
  assert.equal(outcome.tone, "ok");
  assert.match(outcome.title, /revocado/i);
  assert.match(outcome.detail, /Free/);
});

test("revocar cuando no había grant lo dice, en vez de fingir que hizo algo", () => {
  const outcome = describeAdminRevokeOutcome({
    manualGrantRemoved: false,
    auditEventId: "audit_1",
    effectiveAccess: accesoFree
  });
  assert.equal(outcome.tone, "ok");
  assert.match(outcome.title, /No había grant manual/);
});

test("dar Pro también se cuenta por el acceso devuelto, no por el click", () => {
  const feliz = describeAdminGrantOutcome({
    manualGrantApplied: true,
    auditEventId: "audit_1",
    effectiveAccess: accesoPro()
  });
  assert.equal(feliz.tone, "ok");

  // Ya pagaba: el grant se guardó pero quien manda es Stripe.
  const otro = describeAdminGrantOutcome({
    manualGrantApplied: true,
    auditEventId: "audit_1",
    effectiveAccess: accesoPro({ provider: "stripe" })
  });
  assert.equal(otro.tone, "warning");
  assert.match(otro.detail, /Stripe/);

  // Y si el backend devolvió un acceso que NO es Pro, no se canta victoria.
  const raro = describeAdminGrantOutcome({
    manualGrantApplied: true,
    auditEventId: "audit_1",
    effectiveAccess: accesoFree
  });
  assert.equal(raro.tone, "warning");
  assert.match(raro.title, /sigue Free/);
});

// ============================================================================
// 7. Lectura del acceso y de las métricas
// ============================================================================

test("el acceso efectivo se describe con proveedor, plan y vencimiento", () => {
  const resumen = describeAdminAccess(
    accesoPro({ provider: "stripe", plan: "monthly", currentPeriodEnd: Date.parse("2026-09-01T00:00:00.000Z"), willRenew: true })
  );
  assert.equal(resumen.label, "Pro");
  assert.match(resumen.detail, /Estado activa/);
  assert.match(resumen.detail, /Stripe/);
  assert.match(resumen.detail, /plan mensual/);
  assert.match(resumen.detail, /renueva/);

  assert.equal(describeAdminAccess(accesoFree).label, "Free");
  // Permanente: se dice "sin vencimiento", no una fecha inventada.
  assert.match(describeAdminAccess(accesoPro({ isLifetime: true })).detail, /sin vencimiento/);
});

test("el grant manual se describe distinto según sea permanente o con fecha", () => {
  assert.match(describeAdminManualGrant(undefined), /Sin grant manual/);
  assert.match(describeAdminManualGrant({ mode: "permanent", updatedAt: 1 }), /permanente/);
  assert.match(describeAdminManualGrant({ mode: "until", expiresAt: 2, updatedAt: 1 }), /hasta/);
});

test("los proveedores tienen nombre propio: el mensaje honesto necesita nombrarlos", () => {
  assert.equal(adminProviderLabel("stripe"), "Stripe");
  assert.equal(adminProviderLabel("revenuecat"), "RevenueCat");
  assert.equal(adminProviderLabel("admin"), "grant manual");
  assert.equal(adminProviderLabel(undefined), "sin proveedor");
});

const dashboard: AdminDashboard = {
  range: "7d",
  totalAccounts: 7,
  newAccounts: 2,
  proAccounts: 1,
  freeAccounts: 6,
  activeToday: 3,
  activeStreaks: 2,
  contentCreated: 96,
  voidAnswers: 8,
  backfillStatus: "complete",
  canManagePro: false
};

test("las métricas separan lo global de lo que depende del rango", () => {
  const metrics = adminDashboardMetrics(dashboard);
  assert.equal(metrics.length, 8);
  const porClave = new Map(metrics.map((m) => [m.key, m]));
  assert.equal(porClave.get("totalAccounts")?.detail, "Total histórico");
  assert.match(porClave.get("newAccounts")?.detail ?? "", /7 días/);
  assert.match(porClave.get("voidAnswers")?.detail ?? "", /7 días/);
  // Cambiar el rango cambia la etiqueta, no la métrica global.
  const noventa = adminDashboardMetrics({ ...dashboard, range: "90d" });
  assert.match(noventa.find((m) => m.key === "contentCreated")?.detail ?? "", /90 días/);
  assert.equal(noventa.find((m) => m.key === "totalAccounts")?.detail, "Total histórico");
});

test("un backfill incompleto se avisa; uno completo no molesta", () => {
  assert.equal(adminBackfillNotice("complete"), null);
  assert.match(adminBackfillNotice("not_started") ?? "", /todavía no corrió/);
  assert.match(adminBackfillNotice("running") ?? "", /corriendo/);
  assert.match(adminBackfillNotice("error") ?? "", /error/);
});

const cuenta: AdminAccount = {
  userId: "user_1",
  clerkUserId: "clerk_1",
  createdAt: 0,
  isPro: false,
  status: "inactive",
  isLifetime: false,
  currentStreak: 0,
  longestStreak: 3,
  activeDayCount: 5,
  contentCreatedCount: 9
};

test("la última actividad se lee en días, y «sin actividad» no se disfraza de hoy", () => {
  const now = Date.parse("2026-08-04T12:00:00.000Z");
  const dia = 24 * 60 * 60 * 1000;
  assert.equal(formatAdminLastActivity(cuenta, now), "Sin actividad");
  assert.equal(formatAdminLastActivity({ ...cuenta, lastActivityAt: now }, now), "Hoy");
  assert.equal(formatAdminLastActivity({ ...cuenta, lastActivityAt: now - dia }, now), "Ayer");
  assert.equal(formatAdminLastActivity({ ...cuenta, lastActivityAt: now - 5 * dia }, now), "Hace 5 días");
  // Un reloj adelantado no puede devolver días negativos.
  assert.equal(adminDaysSince(now + dia, now), 0);
});

test("cada evento del contrato tiene etiqueta en castellano", () => {
  assert.equal(adminEventLabel("void_answer_created"), "Pregunta al Umbral");
  assert.equal(adminEventLabel("daily_card_revealed"), "Sacó la carta del día");
  // La lista sale del contrato, no de una copia: si el backend suma un evento,
  // este test lo reclama en vez de dejarlo salir con su nombre técnico.
  const contrato = leer("convex/adminAccounts.ts");
  const bloque = /const productEventValidator = v\.union\(([\s\S]*?)\n\);/.exec(contrato);
  assert.ok(bloque, "cambió la forma del validador de eventos en el contrato");
  const eventos = [...bloque[1].matchAll(/v\.literal\("([a-z_]+)"\)/g)].map((m) => m[1]);
  assert.ok(eventos.length >= 19, `se esperaban los eventos del contrato, hay ${eventos.length}`);
  const sinEtiqueta = eventos.filter((name) => adminEventLabel(name as never) === name);
  assert.deepEqual(sinEtiqueta, [], "hay eventos del contrato que se mostrarían con su nombre técnico");
});

// ============================================================================
// 8. Errores: acceso denegado vs. fallo puntual
// ============================================================================

test("los errores de acceso se marcan `denied`: no se ofrece reintentar lo que no va a cambiar", () => {
  for (const message of [
    "ADMIN_ACCOUNTS_DISABLED",
    "not allowed",
    "allowlist is not configured",
    "Authentication required"
  ]) {
    assert.equal(describeAdminError(message).denied, true, message);
  }
  // Un rechazo puntual del formulario no es un acceso denegado.
  for (const message of ["ADMIN_PRO_REASON_REQUIRED", "ADMIN_PRO_EXPIRY_INVALID", "ADMIN_ACCOUNT_NOT_FOUND"]) {
    assert.equal(describeAdminError(message).denied, false, message);
  }
  // Y un error desconocido se muestra tal cual, sin inventar diagnóstico.
  assert.equal(describeAdminError("boom").detail, "boom");
});

// ============================================================================
// 9. Cableado: el shell, sus dos pestañas y el gate de siempre
// ============================================================================

test("el shell del backoffice tiene las dos pestañas y monta el Lab sin tocarlo", () => {
  const shell = sinComentarios(leer("src/components/backoffice/BackofficeScreen.tsx"));
  assert.match(shell, /\{ value: "accounts", label: "Cuentas" \}/);
  assert.match(shell, /\{ value: "lab", label: "Lab" \}/);
  assert.match(shell, /accessibilityRole="tablist"/, "la navegación interna se anuncia como pestañas");
  assert.match(shell, /accessibilityRole="tab"/);
  assert.match(shell, /accessibilityState=\{\{ selected \}\}/, "la pestaña activa no se comunica sólo con el color");
  assert.match(shell, /<AccountsWorkspace wide=\{wide\} \/>/);
  assert.match(shell, /<BackofficeLabWorkspace \/>/);
});

test("la sesión se dibuja UNA vez, en la barra del shell: el Lab no la repite", () => {
  // El shell ya muestra el email y `Cambiar cuenta` arriba, para las dos
  // pestañas. El Lab traía ese mismo bloque adentro, de cuando era el
  // backoffice entero: en la pestaña `Lab` el email y el botón aparecían dos
  // veces. Se saca por API —el workspace ya no recibe la sesión—, no
  // escondiéndolo con estilos.
  const shell = sinComentarios(leer("src/components/backoffice/BackofficeScreen.tsx"));
  assert.match(shell, /<AdminButton label="Cambiar cuenta" onPress=\{onSignOut\} variant="secondary" \/>/);
  assert.match(shell, /\{userEmail \?\? "Clerk conectado"\}/, "el email vive en la barra del shell");

  const lab = sinComentarios(leer("src/components/backoffice/BackofficeLab.tsx"));
  assert.match(lab, /export function BackofficeLabWorkspace\(\)/, "el Lab ya no recibe la sesión");
  assert.match(lab, /function BackofficeHeader\(\)/, "y su header es sólo el título");
  for (const prohibido of ["Cambiar cuenta", "userEmail", "onSignOut", "Clerk conectado"]) {
    assert.doesNotMatch(lab, new RegExp(prohibido), `el Lab vuelve a dibujar la sesión: ${prohibido}`);
  }
});

test("el Lab sigue siendo el mismo workspace, sin nada de cuentas adentro", () => {
  const lab = sinComentarios(leer("src/components/backoffice/BackofficeLab.tsx"));
  assert.match(lab, /export function BackofficeLabWorkspace\(/, "el Lab se exporta como workspace");
  assert.match(lab, /<BackofficeHeader \/>/, "conserva su header");
  assert.match(lab, /Órbita Backoffice/, "con su kicker");
  assert.match(lab, /Lab de modelo/, "y su título");
  assert.match(lab, /backofficeApi\.listSubjects/, "y sus queries de siempre");
  for (const prohibido of ["adminAccountsApi", "AccountsWorkspace", "grantPro", "revokePro"]) {
    assert.doesNotMatch(lab, new RegExp(prohibido), `el Lab no puede arrastrar ${prohibido}`);
  }
});

test("la ruta `/backoffice` conserva su gate de herramientas internas", () => {
  const ruta = sinComentarios(leer("app/backoffice.tsx"));
  assert.match(ruta, /INTERNAL_TOOLS_ENABLED/, "el flag de superficies internas no se puede perder");
  assert.match(ruta, /if \(!INTERNAL_TOOLS_ENABLED\) return <Redirect href="\/" \/>;/);
  assert.match(ruta, /from "@\/components\/backoffice\/BackofficeGate"/, "la ruta entra por la puerta, no por una pestaña");
});

test("la puerta sigue exigiendo Clerk + Convex antes de montar cualquier pestaña", () => {
  const gate = sinComentarios(leer("src/components/backoffice/BackofficeGate.tsx"));
  // La cadena completa: config → Clerk cargado → Clerk con sesión → Convex.
  assert.match(gate, /backendConfig\.isConfigured/);
  assert.match(gate, /if \(!auth\.isLoaded\)/);
  assert.match(gate, /if \(!auth\.isSignedIn\)/);
  assert.match(gate, /if \(convexAuth\.isLoading\)/);
  assert.match(gate, /if \(!convexAuth\.isAuthenticated\)/);
  // Y el shell se monta al final de esa cadena, no antes.
  const shell = gate.indexOf("<BackofficeScreen");
  assert.ok(shell > gate.indexOf("if (!convexAuth.isAuthenticated)"), "el shell no puede montarse antes del handshake");
  // La allowlist real es del servidor: la puerta del cliente no la replica.
  assert.doesNotMatch(gate, /ALLOWED_EMAILS\s*=/, "la allowlist no se hardcodea en el cliente");
});

// ============================================================================
// 10. Cableado de datos: contrato, gate y nada de otra librería de fetching
// ============================================================================

test("cada query y cada mutación sale contra la función del contrato", () => {
  const refs = sinComentarios(leer("src/services/adminAccountsRefs.ts"));
  const contrato = leer("convex/adminAccounts.ts");
  for (const fn of ["getDashboard", "listAccounts", "searchAccounts", "getAccount", "listActivity", "grantPro", "revokePro"]) {
    assert.match(contrato, new RegExp(`export const ${fn} = `), `el contrato ya no expone ${fn}`);
    assert.match(refs, new RegExp(`anyApi\\.adminAccounts\\.${fn}\\b`), `falta la referencia a ${fn}`);
  }
  // Las dos paginadas declaran su forma para poder ir a `usePaginatedQuery`.
  assert.match(refs, /listAccounts[\s\S]*?paginationOpts: PaginationOptions[\s\S]*?PaginationResult<AdminAccount>/);
  assert.match(refs, /listActivity[\s\S]*?paginationOpts: PaginationOptions[\s\S]*?PaginationResult<AdminActivityEvent>/);
});

test("el frontend no importa los tipos generados de Convex", () => {
  for (const rel of [...DEL_BACKOFFICE, "src/services/adminAccountsRefs.ts", "src/domain/adminAccounts.ts"]) {
    for (const spec of importsOf(join(ROOT, rel))) {
      assert.doesNotMatch(spec, /_generated/, `${rel} importa \`convex/_generated\``);
    }
  }
});

test("las dos queries paginadas están gateadas: sin dashboard OK no sale ninguna", () => {
  const ws = sinComentarios(leer("src/components/backoffice/accounts/AccountsWorkspace.tsx"));

  // El dashboard es el único que sale sin condición, y con `throwOnError: false`
  // para poder DIBUJAR el error en vez de romper el render.
  assert.match(ws, /query: adminAccountsApi\.getDashboard,\s*\n\s*args: \{ range \},\s*\n\s*throwOnError: false/);
  assert.match(ws, /const unlocked = adminQueriesUnlocked\(dashboardState\.status\);/);

  // `usePaginatedQuery` no tiene `throwOnError`: si saliera sin permiso, el
  // error explotaría en el render. Por eso las dos pasan por `gatedArgs`.
  const paginadas = [...ws.matchAll(/usePaginatedQuery\(\s*adminAccountsApi\.(\w+),\s*([\s\S]*?)\)\s*,\s*\{ initialNumItems/g)];
  assert.equal(paginadas.length, 2, "se esperaban listAccounts y listActivity paginadas");
  for (const [, nombre, args] of paginadas) {
    assert.match(args, /gatedArgs\(unlocked/, `${nombre} sale sin gate`);
  }
  assert.deepEqual(paginadas.map((m) => m[1]).sort(), ["listAccounts", "listActivity"]);

  // Y las dos queries no paginadas también.
  assert.match(ws, /query: adminAccountsApi\.searchAccounts,\s*\n\s*args: gatedArgs\(unlocked && searching/);
  assert.match(ws, /query: adminAccountsApi\.getAccount,\s*\n\s*args: gatedArgs\(unlocked,/);
});

test("listado y búsqueda son excluyentes: no se paginan resultados de búsqueda", () => {
  const ws = sinComentarios(leer("src/components/backoffice/accounts/AccountsWorkspace.tsx"));
  assert.match(ws, /gatedArgs\(unlocked && !searching, \{ segment, sort \}\)/, "el listado se apaga mientras se busca");
  assert.match(ws, /gatedArgs\(unlocked && searching,/, "y la búsqueda sólo sale con texto");
  assert.match(ws, /sortDisabled=\{searching\}/, "buscar deshabilita el orden: el backend devuelve relevancia");
});

test("las mutaciones reportan lo que devolvió el backend, no lo que se pidió", () => {
  const ws = sinComentarios(leer("src/components/backoffice/accounts/AccountsWorkspace.tsx"));
  assert.match(ws, /useMutation\(adminAccountsApi\.grantPro\)/);
  assert.match(ws, /useMutation\(adminAccountsApi\.revokePro\)/);
  // El mensaje se deriva del resultado `await`-eado, no de los args.
  assert.match(ws, /describeAdminGrantOutcome\(await grantPro\(args\)\)/);
  assert.match(ws, /describeAdminRevokeOutcome\(await revokePro\(args\)\)/);
});

test("no entra otra librería de fetching: sólo los hooks reactivos de Convex", () => {
  const PROHIBIDAS = /@tanstack\/react-query|react-query|\bswr\b|axios|\bofetch\b/;
  for (const rel of [...NUEVOS, "src/services/adminAccountsRefs.ts", "src/domain/adminAccounts.ts"]) {
    const codigo = sinComentarios(leer(rel));
    assert.doesNotMatch(codigo, PROHIBIDAS, `${rel} trae otra librería de datos`);
    assert.doesNotMatch(codigo, /\bfetch\(/, `${rel} sale por HTTP a mano en vez de por Convex`);
  }
  const ws = sinComentarios(leer("src/components/backoffice/accounts/AccountsWorkspace.tsx"));
  assert.match(ws, /from "convex\/react"/);
  assert.match(ws, /usePaginatedQuery/, "la paginación por cursor es la de Convex");
});

// ============================================================================
// 11. Estados completos
// ============================================================================

test("`Cuentas` dibuja carga, vacío, error, denegado y éxito", () => {
  const ws = sinComentarios(leer("src/components/backoffice/accounts/AccountsWorkspace.tsx"));
  assert.match(ws, /dashboardState\.status === "pending"[\s\S]*?<AdminLoading/, "carga del panel");
  assert.match(ws, /dashboardState\.status === "error"[\s\S]*?copy\.denied \? "Acceso denegado"/, "denegado");
  assert.match(ws, /listLoading \?[\s\S]*?<AdminLoading/, "carga del listado");
  assert.match(ws, /accounts\.length === 0 \?[\s\S]*?<AdminEmpty>/, "vacío del listado");
  assert.match(ws, /searchState\.status === "error"[\s\S]*?<AdminNotice tone="danger"/, "error de búsqueda");
  assert.match(ws, /outcome \?[\s\S]*?<AdminNotice/, "éxito visible después de mutar");

  const detalle = sinComentarios(leer("src/components/backoffice/accounts/AccountDetailPanel.tsx"));
  assert.match(detalle, /state\.status === "pending"[\s\S]*?<AdminLoading/);
  assert.match(detalle, /state\.status === "error"[\s\S]*?<AdminNotice tone="danger"/);
  assert.match(detalle, /if \(!detail\)[\s\S]*?<AdminEmpty>/, "la cuenta sin proyección tiene su propio vacío");
  assert.match(detalle, /activity\.status === "LoadingFirstPage"[\s\S]*?<AdminLoading/);
  assert.match(detalle, /activity\.results\.length === 0[\s\S]*?<AdminEmpty>/);
  assert.match(detalle, /recentVoid\.length === 0[\s\S]*?<AdminEmpty>/);
});

test("el detalle muestra la actividad del backend y las preguntas del Umbral textuales", () => {
  const detalle = sinComentarios(leer("src/components/backoffice/accounts/AccountDetailPanel.tsx"));
  assert.match(detalle, /adminEventLabel\(event\.eventName\)/);
  assert.match(detalle, /event\.backfilled \? " · backfill" : ""/, "un evento reconstruido se marca como tal");
  assert.match(detalle, /activity\.loadMore/, "la actividad se pagina por cursor");
  // La pregunta se imprime tal cual: sin `numberOfLines`, sin recorte, sin resumen.
  assert.match(detalle, /\{answer\.question\}/);
  assert.doesNotMatch(detalle, /answer\.question\.slice/, "las preguntas del Umbral no se recortan");
  assert.match(detalle, /90 días/, "se dice que el Umbral se borra a los 90 días");
  // El acceso que se muestra es el efectivo, no el grant.
  assert.match(detalle, /describeAdminAccess\(effectiveAccess\)/);
});

// ============================================================================
// 12. Accesibilidad
// ============================================================================

test("todo control nuevo del backoffice declara rol y nombre accesible", () => {
  for (const rel of NUEVOS) {
    const codigo = sinComentarios(leer(rel));
    for (const control of codigo.matchAll(/<Pressable\b([\s\S]*?)>/g)) {
      assert.match(control[1], /accessibilityRole=/, `${rel}: un Pressable sin rol`);
      assert.match(control[1], /accessibilityLabel=/, `${rel}: un Pressable sin nombre accesible`);
    }
    for (const campo of codigo.matchAll(/<TextInput\b([\s\S]*?)\/>/g)) {
      assert.match(campo[1], /accessibilityLabel=/, `${rel}: un campo de texto sin etiqueta`);
    }
  }
});

test("los objetivos táctiles del backoffice miden 44px", () => {
  // En web no hay `hitSlop`: el tamaño tiene que estar declarado.
  const CONTROLES: Array<[string, string]> = [
    ["src/components/backoffice/kit.tsx", "button"],
    ["src/components/backoffice/kit.tsx", "choice"],
    ["src/components/backoffice/BackofficeScreen.tsx", "tab"],
    ["src/components/backoffice/BackofficeGate.tsx", "secondaryButton"]
  ];
  for (const [rel, estilo] of CONTROLES) {
    const decl = new RegExp(`\\n  ${estilo}: \\{[^}]*\\}`).exec(sinComentarios(leer(rel)));
    assert.ok(decl, `${rel} no declara el estilo ${estilo}`);
    assert.match(decl[0], /minHeight: 44/, `${rel} · ${estilo}: alto táctil insuficiente`);
    assert.match(decl[0], /minWidth: 44/, `${rel} · ${estilo}: ancho táctil insuficiente`);
  }
  // Y las filas del listado, que también se tocan.
  const lista = sinComentarios(leer("src/components/backoffice/accounts/AccountsList.tsx"));
  assert.match(lista, /row: \{[^}]*minHeight: 5\d/s);
  assert.match(lista, /card: \{[^}]*minHeight: 44/s);
});

test("los diálogos de Pro son diálogos de verdad: modales, con Escape y sin movimiento si se pidió", () => {
  const dialog = sinComentarios(leer("src/components/backoffice/AdminDialog.tsx"));
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /accessibilityViewIsModal/, "el resto de la pantalla queda fuera del lector");
  assert.match(dialog, /aria-modal/);
  assert.match(dialog, /accessibilityLabel=\{title\}/, "el diálogo se anuncia con su título");
  assert.match(dialog, /onRequestClose=\{onClose\}/, "Escape cierra");
  assert.match(dialog, /animationType=\{reducedMotion \? "none" : "fade"\}/, "menos movimiento apaga la animación");
  assert.match(dialog, /useReducedMotion\(\)/);
});

test("los avisos de error se anuncian solos: aparecen sin mover el foco", () => {
  const kit = sinComentarios(leer("src/components/backoffice/kit.tsx"));
  assert.match(kit, /const live = tone === "danger" \|\| tone === "warning";/);
  assert.match(kit, /accessibilityLiveRegion=\{live \? "polite" : "none"\}/);
  assert.match(kit, /role=\{live \? "alert" : undefined\}/);
});

test("los grupos de opciones son un radiogroup, no botones que cambian de color", () => {
  const kit = sinComentarios(leer("src/components/backoffice/kit.tsx"));
  assert.match(kit, /accessibilityRole="radiogroup"/);
  assert.match(kit, /accessibilityRole="radio"/);
  assert.match(kit, /accessibilityState=\{\{ disabled, selected \}\}/);
});

// ============================================================================
// 13. Los diálogos respetan `canManagePro` y avisan lo que revocar NO hace
// ============================================================================

test("sin permiso, los botones de Pro quedan deshabilitados con su explicación al lado", () => {
  const dialogos = sinComentarios(leer("src/components/backoffice/accounts/ProAccessDialogs.tsx"));
  const detalle = sinComentarios(leer("src/components/backoffice/accounts/AccountDetailPanel.tsx"));
  // En el detalle: los dos botones, deshabilitados y con el motivo como hint.
  assert.match(detalle, /disabled=\{proControls\.disabled\}[\s\S]*?label="Dar Pro"/);
  assert.match(detalle, /disabled=\{proControls\.disabled\}[\s\S]*?label="Revocar"/);
  assert.match(detalle, /accessibilityHint=\{proControls\.explanation\}/);
  assert.match(detalle, /proControls\.explanation \?[\s\S]*?<AdminNotice tone="warning"/, "el motivo se ve, no sólo se anuncia");
  // En los diálogos: mismo trato, más el aviso de que revocar no cancela nada.
  assert.match(dialogos, /disabled=\{!canManagePro \|\| submitting\}/);
  assert.match(dialogos, /ADMIN_REVOKE_WARNING/);
  assert.match(dialogos, /tone="warning" title="Esto no cancela ningún cobro"/);
});

test("el formulario del grant se limpia en cada apertura", () => {
  // Un formulario que recuerda la razón anterior es la forma más fácil de
  // auditar un grant con el motivo equivocado.
  const dialogos = sinComentarios(leer("src/components/backoffice/accounts/ProAccessDialogs.tsx"));
  assert.match(dialogos, /if \(!visible\) return;\s*\n\s*setPreset\("7d"\);/);
  assert.match(dialogos, /buildAdminGrantDraft\(\{/, "la validación es la del dominio, no una copia en la UI");
  assert.match(dialogos, /checkAdminReason\(reason\)/);
});

// ============================================================================
// 14. Responsive: la ventana se mide UNA vez
// ============================================================================

test("dentro del backoffice sólo el shell mira el viewport", () => {
  const miran = DEL_BACKOFFICE.filter((rel) => /useWindowDimensions|window\.innerWidth/.test(sinComentarios(leer(rel))));
  assert.deepEqual(
    miran.sort(),
    ["src/components/backoffice/BackofficeLab.tsx", "src/components/backoffice/BackofficeScreen.tsx"],
    "el Lab ya medía la ventana (no se tocó); lo nuevo lo hace una sola vez, en el shell"
  );
  // Y el modo baja por prop hasta la tabla.
  const lista = sinComentarios(leer("src/components/backoffice/accounts/AccountsList.tsx"));
  assert.match(lista, /wide: boolean;/, "el modo llega por prop, no medido de nuevo");
  assert.match(lista, /if \(wide\) \{/, "la tabla es la forma ancha de la MISMA fila");
});

test("las ocho métricas caen en una grilla pareja: ninguna queda sola de punta a punta", () => {
  // El bug: con `flexGrow: 1` y sólo `minWidth: 150`, en ~1280px entraban siete
  // tarjetas en la primera fila y la octava —Umbral— se estiraba sola. El basis
  // porcentual limita la fila a cuatro (5 × 22% pasa el 100%), así que ocho se
  // reparten 4 + 4; en angosto sigue mandando `minWidth`.
  assert.equal(adminDashboardMetrics(dashboard).length, 8);
  const kit = sinComentarios(leer("src/components/backoffice/kit.tsx"));
  const stat = /\n  stat: \{[^}]*\}/.exec(kit);
  assert.ok(stat, "el kit ya no declara el estilo de la métrica");
  const basis = /flexBasis: "(\d+)%"/.exec(stat[0]);
  assert.ok(basis, "sin basis la última tarjeta vuelve a estirarse sola");
  const porFila = Math.floor(100 / Number(basis[1]));
  assert.ok(porFila >= 2 && porFila <= 4, `entran ${porFila} tarjetas por fila`);
  assert.notEqual(8 % porFila, 1, "una fila final de UNA tarjeta es exactamente el bug");
  assert.match(stat[0], /minWidth: 150/, "y en pantallas angostas el ancho mínimo sigue mandando");
});
