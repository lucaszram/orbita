import assert from "node:assert/strict";
import test from "node:test";
import { runAccountBootstrap, type BootstrapDeps } from "../src/domain/accountBootstrap";

/**
 * Doble instrumentado: registra el ORDEN real de las operaciones y cuántas veces
 * corrió cada una. Antes había un test que sólo miraba que dos archivos
 * mencionaran `useAccountBootstrap`, lo que no probaba ninguna conducta.
 */
function makeDeps(
  over: Partial<BootstrapDeps> & { remoteBirthData?: unknown; remoteClerkUserId?: string | null } = {}
) {
  const calls: string[] = [];
  const conteo: Record<string, number> = {};
  const registrar = (nombre: string) => {
    calls.push(nombre);
    conteo[nombre] = (conteo[nombre] ?? 0) + 1;
  };
  const deps: BootstrapDeps = {
    hydrate: async () => {
      registrar("hydrate");
      return {
        status: "ok" as const,
        clerkUserId: "remoteClerkUserId" in over ? over.remoteClerkUserId! : "user_B",
        birthData: (over.remoteBirthData ?? null) as never
      };
    },
    profileOwner: null,
    hasLocalProfile: false,
    archiveAccountData: async () => registrar("archive"),
    resetApp: async () => registrar("reset"),
    restoreAccountData: async () => {
      registrar("restore");
      return { profileRestored: false };
    },
    createProfile: async () => registrar("createProfile"),
    adoptLocalProfile: async () => registrar("adopt"),
    ...over
  };
  return { deps, calls, conteo };
}

const BIRTH_DATA = {
  birthDate: "1996-11-11",
  birthTime: "10:32",
  birthPlaceLabel: "Ciudad Autónoma de Buenos Aires, Argentina",
  latitude: -34.6,
  longitude: -58.44,
  timezone: "America/Argentina/Buenos_Aires"
};

// --- Cuenta completa: hidrata y queda lista ---------------------------------

test("cuenta completa sin perfil local → hidrata una vez y queda lista", async () => {
  const { deps, calls, conteo } = makeDeps({ remoteBirthData: BIRTH_DATA });
  assert.deepEqual(await runAccountBootstrap(deps), { status: "ready" });
  assert.equal(conteo.createProfile, 1, "el perfil se hidrata exactamente una vez");
  assert.ok(!calls.includes("archive"), "sin datos ajenos no hay nada que archivar");
});

// --- Aislamiento de datos ajenos --------------------------------------------

test("cuenta A local con cuenta B activa → archiva, limpia y RECIÉN restaura", async () => {
  const { deps, calls } = makeDeps({
    profileOwner: "user_A",
    hasLocalProfile: true,
    remoteBirthData: BIRTH_DATA
  });
  assert.deepEqual(await runAccountBootstrap(deps), { status: "ready" });
  assert.deepEqual(
    calls,
    ["hydrate", "archive", "reset", "restore", "createProfile"],
    "limpiar antes de restaurar: si no, se mezclan las dos cuentas"
  );
});

test("el aislamiento corre TAMBIÉN cuando la cuenta activa no tiene birthData", async () => {
  // Sin esto, quien entra con otra cuenta arrancaba el onboarding llevándose el
  // diario y las guardadas del dueño anterior.
  const { deps, calls } = makeDeps({ profileOwner: "user_A", hasLocalProfile: true });
  const outcome = await runAccountBootstrap(deps);
  assert.deepEqual(outcome, { status: "incomplete" });
  assert.deepEqual(calls.slice(0, 3), ["hydrate", "archive", "reset"]);
});

test("un perfil sin dueño (guest) con sesión activa también se aísla", async () => {
  // Es el caso de una cuenta creada desde /crear-cuenta en un dispositivo que ya
  // tenía datos locales de un uso anterior sin cuenta.
  const { deps, calls } = makeDeps({ profileOwner: null, hasLocalProfile: true, remoteBirthData: BIRTH_DATA });
  await runAccountBootstrap(deps);
  // Sin dueño no hay cambio de cuenta que archivar, pero lo remoto pisa el
  // perfil y queda marcado con su dueño: no se adopta lo ajeno en silencio.
  assert.ok(calls.includes("createProfile"));
  assert.ok(!calls.includes("adopt"), "con datos remotos no se adopta el perfil local");
});

// --- Cuenta incompleta: onboarding, NO error --------------------------------

test("cuenta incompleta con aislamiento exitoso → incomplete, no error", async () => {
  const { deps } = makeDeps({ profileOwner: "user_A", hasLocalProfile: true });
  const outcome = await runAccountBootstrap(deps);
  assert.equal(outcome.status, "incomplete", "el onboarding es el destino, no una pantalla de error");
  assert.notEqual(outcome.status, "error");
});

test("cuenta incompleta con perfil local propio → lo adopta y sigue incomplete", async () => {
  const { deps, conteo } = makeDeps({ profileOwner: null, hasLocalProfile: true });
  const outcome = await runAccountBootstrap(deps);
  assert.equal(outcome.status, "incomplete");
  assert.equal(conteo.adopt, 1, "guest-upgrade: la cuenta adopta el perfil explícitamente");
});

// --- Fallos: siempre error, nunca "listo" a medias --------------------------

test("hidratación fallida no toca nada local", async () => {
  const { deps, calls } = makeDeps({ hydrate: async () => ({ status: "error" as const }) });
  assert.deepEqual(await runAccountBootstrap(deps), { status: "error" });
  assert.deepEqual(calls, [], "no se archiva ni restaura sin saber quién es");
});

test("si archivar falla, NO se limpia ni se restaura", async () => {
  const { deps, calls } = makeDeps({
    profileOwner: "user_A",
    hasLocalProfile: true,
    archiveAccountData: async () => {
      throw new Error("disco lleno");
    }
  });
  assert.deepEqual(await runAccountBootstrap(deps), { status: "error" });
  assert.ok(!calls.includes("reset"), "limpiar sin haber archivado destruiría datos ajenos");
  assert.ok(!calls.includes("restore"));
});

test("un fallo al hidratar el perfil es error, no 'listo'", async () => {
  const { deps } = makeDeps({
    remoteBirthData: BIRTH_DATA,
    createProfile: async () => {
      throw new Error("storage");
    }
  });
  assert.deepEqual(await runAccountBootstrap(deps), { status: "error" });
});

// --- Concurrencia: el lock del provider ------------------------------------

test("dos llamadas concurrentes hacen UN solo archive/reset/restore", async () => {
  // Reproduce el lock del provider: una corrida en vuelo se comparte.
  const { deps, conteo } = makeDeps({
    profileOwner: "user_A",
    hasLocalProfile: true,
    remoteBirthData: BIRTH_DATA
  });
  let enVuelo: Promise<unknown> | null = null;
  const run = () => {
    if (enVuelo) return enVuelo;
    enVuelo = runAccountBootstrap(deps).finally(() => {
      enVuelo = null;
    });
    return enVuelo;
  };

  const [a, b] = await Promise.all([run(), run()]);
  assert.deepEqual(a, b, "las dos llamadas comparten el mismo resultado");
  assert.equal(conteo.hydrate, 1);
  assert.equal(conteo.archive, 1, "archivar dos veces duplicaría el snapshot");
  assert.equal(conteo.reset, 1);
  assert.equal(conteo.restore, 1);
  assert.equal(conteo.createProfile, 1);
});

test("sin lock, dos llamadas SÍ duplican: el test anterior mide algo real", async () => {
  const { deps, conteo } = makeDeps({
    profileOwner: "user_A",
    hasLocalProfile: true,
    remoteBirthData: BIRTH_DATA
  });
  await Promise.all([runAccountBootstrap(deps), runAccountBootstrap(deps)]);
  assert.equal(conteo.archive, 2, "confirma que el lock es lo que evita el duplicado");
});

// --- Identidad sin confirmar: nada local se toca ----------------------------
// Con `clerkUserId` nulo, `isAccountSwitch` no detecta cambio de cuenta,
// `restoreAccountData` se saltea y `createProfile` escribiría los datos remotos
// en un perfil SIN dueño: el arranque no lo reconocería como propio y quedaría a
// la vista de quien use el dispositivo después.

test("sin clerkUserId y CON datos remotos → error y cero operaciones locales", async () => {
  const { deps, calls } = makeDeps({
    remoteClerkUserId: null,
    remoteBirthData: BIRTH_DATA,
    profileOwner: "user_A",
    hasLocalProfile: true
  });
  assert.deepEqual(await runAccountBootstrap(deps), { status: "error" });
  assert.deepEqual(calls, ["hydrate"], `no debería haber tocado nada local: ${calls.join(", ")}`);
});

test("sin clerkUserId y SIN datos remotos → error y cero operaciones locales", async () => {
  const { deps, calls } = makeDeps({
    remoteClerkUserId: null,
    profileOwner: "user_A",
    hasLocalProfile: true
  });
  assert.deepEqual(await runAccountBootstrap(deps), { status: "error" });
  assert.deepEqual(calls, ["hydrate"], `no debería haber tocado nada local: ${calls.join(", ")}`);
});

test("un clerkUserId vacío o en blanco cuenta como ausente", async () => {
  for (const remoteClerkUserId of ["", "   "]) {
    const { deps, calls } = makeDeps({
      remoteClerkUserId,
      remoteBirthData: BIRTH_DATA,
      profileOwner: "user_A",
      hasLocalProfile: true
    });
    assert.deepEqual(await runAccountBootstrap(deps), { status: "error" }, JSON.stringify(remoteClerkUserId));
    assert.deepEqual(calls, ["hydrate"]);
  }
});
