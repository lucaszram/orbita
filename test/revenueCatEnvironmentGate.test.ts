/**
 * Corte de entorno de RevenueCat (P1 2).
 *
 * Tres reglas que hoy no se cumplían:
 *
 * 1. sin entorno de deployment reconocido se falla CERRADO, no se asume
 *    development;
 * 2. producción tiene que aceptar recibos SANDBOX —TestFlight y App Review los
 *    generan con el binario productivo— de CUALQUIER cuenta (CORE-1043): la
 *    allowlist por Clerk id hacía que la cuenta de quien revisa se comportara
 *    distinto y perdiera el acceso al vaciarla;
 * 3. un evento sin `environment` (`TRANSFER`, `TEMPORARY_ENTITLEMENT_GRANT`) no
 *    se descarta antes de resolver, y `undefined` jamás se lee como production.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDeploymentEnvironment } from "../convex/lib/environment";
import {
  isRevenueCatEnvironmentAllowed,
  revenueCatEnvironment
} from "../convex/lib/revenueCatEvents";
import * as revenueCatEvents from "../convex/lib/revenueCatEvents";

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

  it("producción acepta sandbox de una cuenta cualquiera", () => {
    // TestFlight y App Review compran en Sandbox con el binario productivo: un
    // recibo Sandbox sólo sale de ahí o de un tester de Sandbox, nunca de la
    // tienda. No hace falta identidad ni lista para aceptarlo.
    assert.equal(isRevenueCatEnvironmentAllowed("sandbox", { env: PROD }), true);
    assert.equal(isRevenueCatEnvironmentAllowed("production", { env: PROD }), true);
  });

  it("producción acepta sandbox SIN allowlist: la variable vieja no abre ni cierra nada", () => {
    // La variable ya no se lee. Vacía, ausente o cargada con otra cuenta, el
    // resultado es el mismo: quien revisa la app no depende de una lista que
    // alguien tiene que cargar antes y vaciar después.
    for (const lista of [undefined, "", "user_review_1, user_qa_2"]) {
      const env = { ...PROD, REVENUECAT_SANDBOX_REVIEW_USER_IDS: lista };
      assert.equal(isRevenueCatEnvironmentAllowed("sandbox", { env }), true, String(lista));
    }
  });

  it("la allowlist de review dejó de existir en el módulo", () => {
    assert.equal("revenueCatSandboxReviewers" in revenueCatEvents, false);
    // La firma tampoco recibe identidad: el corte es del deployment, no de la
    // cuenta, así que ningún llamador puede volver a decidirlo por Clerk id.
    assert.equal(isRevenueCatEnvironmentAllowed.length, 1);
  });

  it("la variable vieja no habilita production cruzada ni afecta a development", () => {
    const devEnv = { ...DEV, REVENUECAT_SANDBOX_REVIEW_USER_IDS: "user_review_1" };
    assert.equal(isRevenueCatEnvironmentAllowed("sandbox", { env: devEnv }), true);
    assert.equal(
      isRevenueCatEnvironmentAllowed("production", { env: devEnv }),
      false,
      "development sigue sin consumir recibos productivos"
    );
    const sinEntorno = { REVENUECAT_SANDBOX_REVIEW_USER_IDS: "user_review_1" };
    assert.equal(isRevenueCatEnvironmentAllowed("sandbox", { env: sinEntorno }), false);
    assert.equal(isRevenueCatEnvironmentAllowed("production", { env: sinEntorno }), false);
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
