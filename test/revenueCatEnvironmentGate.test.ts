/**
 * Corte de entorno de RevenueCat (P1 2).
 *
 * Tres reglas que hoy no se cumplían:
 *
 * 1. sin entorno de deployment reconocido se falla CERRADO, no se asume
 *    development;
 * 2. producción tiene que aceptar recibos SANDBOX —TestFlight y App Review los
 *    generan con el binario productivo— pero SÓLO para las cuentas de QA/review
 *    allowlisted en un secreto, nunca de forma global;
 * 3. un evento sin `environment` (`TRANSFER`, `TEMPORARY_ENTITLEMENT_GRANT`) no
 *    se descarta antes de resolver, y `undefined` jamás se lee como production.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDeploymentEnvironment } from "../convex/lib/environment";
import {
  isRevenueCatEnvironmentAllowed,
  revenueCatEnvironment,
  revenueCatSandboxReviewers
} from "../convex/lib/revenueCatEvents";

describe("entorno del deployment — explícito o desconocido", () => {
  it("reconoce producción por cualquiera de sus señales", () => {
    assert.equal(resolveDeploymentEnvironment({ ORBITA_ENVIRONMENT: "production" }), "production");
    assert.equal(resolveDeploymentEnvironment({ COMMERCE_MODE: "live" }), "production");
    assert.equal(resolveDeploymentEnvironment({ CONVEX_DEPLOYMENT: "prod:orbita" }), "production");
    assert.equal(resolveDeploymentEnvironment({ ORBITA_ENV: "prod" }), "production");
  });

  it("reconoce development sólo cuando está declarado", () => {
    assert.equal(resolveDeploymentEnvironment({ ORBITA_ENVIRONMENT: "development" }), "development");
    assert.equal(resolveDeploymentEnvironment({ CONVEX_DEPLOYMENT: "dev:dutiful-viper-815" }), "development");
    assert.equal(resolveDeploymentEnvironment({ ORBITA_ENV: "local" }), "development");
  });

  it("sin ninguna señal el entorno es DESCONOCIDO, no development", () => {
    assert.equal(resolveDeploymentEnvironment({}), "unknown");
    assert.equal(resolveDeploymentEnvironment({ NODE_ENV: "production" }), "unknown");
    assert.equal(resolveDeploymentEnvironment({ ORBITA_ENV: "staging" }), "unknown");
  });
});

describe("qué recibo acepta cada deployment", () => {
  const DEV = { ORBITA_ENVIRONMENT: "development" };
  const PROD = { ORBITA_ENVIRONMENT: "production" };

  it("un deployment sin entorno reconocido no acepta NADA", () => {
    assert.equal(isRevenueCatEnvironmentAllowed("sandbox", { env: {} }), false);
    assert.equal(isRevenueCatEnvironmentAllowed("production", { env: {} }), false);
  });

  it("development sólo consume sandbox", () => {
    assert.equal(isRevenueCatEnvironmentAllowed("sandbox", { env: DEV }), true);
    assert.equal(isRevenueCatEnvironmentAllowed("production", { env: DEV }), false);
  });

  it("producción consume production siempre", () => {
    assert.equal(isRevenueCatEnvironmentAllowed("production", { env: PROD }), true);
  });

  it("producción rechaza sandbox de una cuenta cualquiera", () => {
    assert.equal(isRevenueCatEnvironmentAllowed("sandbox", { env: PROD }), false);
    assert.equal(
      isRevenueCatEnvironmentAllowed("sandbox", { env: PROD, clerkUserId: "user_desconocido" }),
      false
    );
  });

  it("producción acepta sandbox SÓLO para las cuentas de review allowlisted", () => {
    // TestFlight y App Review compran en Sandbox con el binario productivo: sin
    // esta puerta, la persona que revisa la app no ve Plus y la rechaza.
    const env = { ...PROD, REVENUECAT_SANDBOX_REVIEW_USER_IDS: "user_review_1, user_qa_2" };
    assert.equal(isRevenueCatEnvironmentAllowed("sandbox", { env, clerkUserId: "user_review_1" }), true);
    assert.equal(isRevenueCatEnvironmentAllowed("sandbox", { env, clerkUserId: "user_qa_2" }), true);
    assert.equal(isRevenueCatEnvironmentAllowed("sandbox", { env, clerkUserId: "user_cualquiera" }), false);
    // Sin identidad resuelta no se abre la puerta.
    assert.equal(isRevenueCatEnvironmentAllowed("sandbox", { env }), false);
  });

  it("la allowlist distingue mayúsculas y descarta vacíos", () => {
    const env = { ...PROD, REVENUECAT_SANDBOX_REVIEW_USER_IDS: " user_A ,, ,user_B " };
    const reviewers = revenueCatSandboxReviewers(env);
    assert.deepEqual([...reviewers].sort(), ["user_A", "user_B"]);
    assert.equal(isRevenueCatEnvironmentAllowed("sandbox", { env, clerkUserId: "user_a" }), false);
    assert.equal(isRevenueCatEnvironmentAllowed("sandbox", { env, clerkUserId: "user_A" }), true);
  });

  it("la allowlist no habilita production cruzada ni afecta a development", () => {
    const env = { ...PROD, REVENUECAT_SANDBOX_REVIEW_USER_IDS: "user_review_1" };
    assert.equal(isRevenueCatEnvironmentAllowed("production", { env, clerkUserId: "user_review_1" }), true);
    const devEnv = { ...DEV, REVENUECAT_SANDBOX_REVIEW_USER_IDS: "user_review_1" };
    assert.equal(
      isRevenueCatEnvironmentAllowed("production", { env: devEnv, clerkUserId: "user_review_1" }),
      false,
      "un allowlist de review no puede meter recibos productivos en development"
    );
  });
});

describe("eventos sin environment declarado", () => {
  it("`undefined` nunca se interpreta como production", () => {
    assert.equal(revenueCatEnvironment({}), undefined);
    assert.equal(revenueCatEnvironment({ environment: null }), undefined);
    assert.equal(revenueCatEnvironment({ environment: "PRODUCTION" }), "production");
    assert.equal(revenueCatEnvironment({ environment: "SANDBOX" }), "sandbox");
  });
});
