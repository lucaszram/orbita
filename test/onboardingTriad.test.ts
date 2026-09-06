import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  computeOnboardingTriad,
  extractTriadFromChart,
  getOnboardingTriadRateLimits,
  getOnboardingTriadTimeoutMs,
  ONBOARDING_TRIAD_TIMEOUT_DEFAULT_MS,
  ONBOARDING_TRIAD_TIMEOUT_MAX_MS,
  onboardingTriadRateSubject,
  OnboardingTriadError,
  runWithProviderDeadline,
  validateClientDraftId,
  validateOnboardingTriadInput,
  type OnboardingTriadArgs
} from "../convex/lib/onboardingTriad";
import { observeTriadComputation, triadAutoAdvances } from "../src/onboarding/triadSurface";
import { buildRateLimitBucketKey, evaluateRateLimit, resolvePositiveInt } from "../convex/lib/rateLimit";
import { isProductionEnvironment } from "../convex/lib/environment";
import { assertPublicLabAccess } from "../convex/publicLab";
import {
  TRIAD_CLIENT_TIMEOUT_CODE,
  TRIAD_CLIENT_TIMEOUT_MS,
  withTriadTimeout
} from "../src/domain/triadTimeout";

const NOW = Date.UTC(2026, 7, 13, 15, 0, 0);
const TZ = "America/Argentina/Buenos_Aires";
const DRAFT = "orbita-signup-1a2b3c4-5d6e7f8";

const VALID: OnboardingTriadArgs = {
  birthDate: "1996-01-15",
  birthTime: "07:30",
  birthTimePrecision: "known",
  birthPlaceLabel: "Buenos Aires, Argentina",
  latitude: -34.6037,
  longitude: -58.3816,
  clientDraftId: DRAFT
};

/** Una promesa que jamás se asienta: el caso que colgaba la pantalla. */
const NEVER = new Promise<never>(() => {});

function chartWith(args: {
  sun?: string;
  moon?: string;
  ascendant?: string | null;
  accuracy?: "calculated" | "approximate_without_birth_time";
}) {
  return {
    summary: {
      accuracy: args.accuracy ?? "calculated",
      sun: args.sun === undefined ? null : { signEs: args.sun },
      moon: args.moon === undefined ? null : { signEs: args.moon },
      ascendant: args.ascendant === undefined || args.ascendant === null ? null : { signEs: args.ascendant }
    }
  } as any;
}

function successfulProvider(chart: any) {
  const calls: Array<{ input: any; localDate: string; signal: AbortSignal }> = [];
  const run = async (input: { input: any; localDate: string; signal: AbortSignal }) => {
    calls.push(input);
    return { status: "success", normalized: { chart } };
  };
  return { run, calls };
}

/** Resolver de zona server-side simulado (en producción es `geo-tz`). */
function timezoneResolver(timezone = TZ) {
  const calls: Array<[number, number]> = [];
  return {
    calls,
    resolve: (latitude: number, longitude: number) => {
      calls.push([latitude, longitude]);
      return timezone;
    }
  };
}

const okTriad = () => successfulProvider(chartWith({ sun: "capricornio", moon: "leo", ascendant: "libra" }));

/** Ejecuta `fn` con env parcheado y restaura siempre los valores previos. */
function withEnv<T>(patch: Record<string, string | undefined>, fn: () => T): T {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(patch)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe("validateOnboardingTriadInput — validación estricta", () => {
  const options = { now: NOW, timezone: TZ };

  it("acepta una entrada válida y normaliza hora y lugar", () => {
    const input = validateOnboardingTriadInput({ ...VALID, birthTime: "7:30" }, options);
    assert.equal(input.birthTime, "07:30");
    assert.equal(input.birthPlaceLabel, "Buenos Aires, Argentina");
    assert.equal(input.timezone, TZ);
  });

  it("usa un lugar por defecto cuando no viene etiqueta", () => {
    const input = validateOnboardingTriadInput({ ...VALID, birthPlaceLabel: "  " }, options);
    assert.equal(input.birthPlaceLabel, "Sin especificar");
  });

  for (const [caso, birthDate] of [
    ["formato inválido", "15/01/1996"],
    ["fecha inexistente", "1996-02-31"],
    ["mes fuera de rango", "1996-13-01"],
    ["anterior a 1900", "1899-12-31"]
  ] as const) {
    it(`rechaza la fecha: ${caso}`, () => {
      assert.throws(
        () => validateOnboardingTriadInput({ ...VALID, birthDate }, options),
        /ONBOARDING_TRIAD_INVALID_BIRTH_DATE/
      );
    });
  }

  it("rechaza una fecha futura", () => {
    assert.throws(
      () => validateOnboardingTriadInput({ ...VALID, birthDate: "2026-08-14" }, options),
      /ONBOARDING_TRIAD_INVALID_BIRTH_DATE/
    );
  });

  it("rechaza hora ausente o mal formada cuando la precisión no es unknown", () => {
    for (const birthTime of [undefined, "25:00", "07:99", "mediodía"]) {
      assert.throws(
        () => validateOnboardingTriadInput({ ...VALID, birthTime }, options),
        /ONBOARDING_TRIAD_INVALID_BIRTH_TIME:/
      );
    }
  });

  it("rechaza una hora contradictoria con precision=unknown", () => {
    assert.throws(
      () => validateOnboardingTriadInput({ ...VALID, birthTimePrecision: "unknown" }, options),
      /ONBOARDING_TRIAD_INVALID_BIRTH_TIME_PRECISION/
    );
  });

  it("acepta precision=unknown sin hora", () => {
    const input = validateOnboardingTriadInput(
      { ...VALID, birthTime: undefined, birthTimePrecision: "unknown" },
      options
    );
    assert.equal(input.birthTime, undefined);
  });

  for (const [caso, patch] of [
    ["latitud fuera de rango", { latitude: 91 }],
    ["longitud fuera de rango", { longitude: -181 }],
    ["latitud no finita", { latitude: Number.NaN }],
    ["coordenadas ausentes", { latitude: undefined as unknown as number, longitude: undefined as unknown as number }]
  ] as const) {
    it(`rechaza coordenadas: ${caso}`, () => {
      assert.throws(
        () => validateOnboardingTriadInput({ ...VALID, ...patch }, options),
        /ONBOARDING_TRIAD_INVALID_COORDINATES/
      );
    });
  }

  for (const [caso, timezone] of [
    ["vacía", ""],
    ["offset numérico", "-3"],
    ["no IANA", "Hora de Buenos Aires"],
    ["inexistente para el runtime", "America/Atlantis"]
  ] as const) {
    it(`rechaza la zona derivada: ${caso}`, () => {
      assert.throws(
        () => validateOnboardingTriadInput(VALID, { now: NOW, timezone }),
        /ONBOARDING_TRIAD_TIMEZONE_UNRESOLVED/
      );
    });
  }

  it("rechaza una etiqueta de lugar desmedida", () => {
    assert.throws(
      () => validateOnboardingTriadInput({ ...VALID, birthPlaceLabel: "x".repeat(161) }, options),
      /ONBOARDING_TRIAD_INVALID_PLACE_LABEL/
    );
  });
});

describe("extractTriadFromChart", () => {
  it("devuelve los tres signos canónicos", () => {
    const triad = extractTriadFromChart(chartWith({ sun: "capricornio", moon: "leo", ascendant: "libra" }), "known");
    assert.deepEqual(triad, { sun: "capricornio", moon: "leo", ascendant: "libra" });
  });

  it("descarta un signo desconocido en vez de inventarlo", () => {
    const triad = extractTriadFromChart(chartWith({ sun: "capricornio", moon: "gemini", ascendant: "" }), "known");
    assert.deepEqual(triad, { sun: "capricornio", moon: null, ascendant: null });
  });

  it("no devuelve ascendente sin hora natal (el proveedor usa mediodía)", () => {
    const triad = extractTriadFromChart(
      chartWith({ sun: "capricornio", moon: "leo", ascendant: "libra", accuracy: "approximate_without_birth_time" }),
      "unknown"
    );
    assert.equal(triad.ascendant, null);
  });
});

describe("computeOnboardingTriad — acción pública mínima", () => {
  it("devuelve SOLO sun, moon y ascendant", async () => {
    const provider = okTriad();
    const triad = await computeOnboardingTriad({
      args: VALID,
      now: NOW,
      resolveTimezone: timezoneResolver().resolve,
      runNatalChart: provider.run
    });

    assert.deepEqual(Object.keys(triad).sort(), ["ascendant", "moon", "sun"]);
    assert.deepEqual(triad, { sun: "capricornio", moon: "leo", ascendant: "libra" });
  });

  it("deriva la zona de las coordenadas y se la pasa al proveedor", async () => {
    const provider = okTriad();
    const resolver = timezoneResolver("Europe/Madrid");
    await computeOnboardingTriad({
      args: { ...VALID, birthTime: "7:30" },
      now: NOW,
      resolveTimezone: resolver.resolve,
      runNatalChart: provider.run
    });

    assert.deepEqual(resolver.calls, [[VALID.latitude, VALID.longitude]]);
    assert.equal(provider.calls[0].input.timezone, "Europe/Madrid");
    assert.equal(provider.calls[0].input.birthTime, "07:30");
    assert.equal(provider.calls[0].localDate, "2026-08-13");
  });

  it("si la zona no se puede resolver, falla con recuperación y no llama al proveedor", async () => {
    const provider = okTriad();
    await assert.rejects(
      computeOnboardingTriad({
        args: VALID,
        now: NOW,
        resolveTimezone: () => {
          throw new Error("TIMEZONE_NOT_FOUND");
        },
        runNatalChart: provider.run
      }),
      /ONBOARDING_TRIAD_TIMEZONE_UNRESOLVED/
    );
    assert.equal(provider.calls.length, 0);
  });

  it("no resuelve zona ni llama al proveedor si faltan coordenadas", async () => {
    const provider = okTriad();
    const resolver = timezoneResolver();
    await assert.rejects(
      computeOnboardingTriad({
        args: { ...VALID, latitude: undefined as unknown as number },
        now: NOW,
        resolveTimezone: resolver.resolve,
        runNatalChart: provider.run
      }),
      /ONBOARDING_TRIAD_INVALID_COORDINATES/
    );
    assert.equal(resolver.calls.length, 0);
    assert.equal(provider.calls.length, 0);
  });

  it("no llama al proveedor si la entrada es inválida", async () => {
    const provider = okTriad();
    await assert.rejects(
      computeOnboardingTriad({
        args: { ...VALID, birthDate: "nope" },
        now: NOW,
        resolveTimezone: timezoneResolver().resolve,
        runNatalChart: provider.run
      }),
      /ONBOARDING_TRIAD_INVALID_BIRTH_DATE/
    );
    assert.equal(provider.calls.length, 0);
  });

  it("falla con PROVIDER_UNAVAILABLE si el proveedor no trae carta", async () => {
    await assert.rejects(
      computeOnboardingTriad({
        args: VALID,
        now: NOW,
        resolveTimezone: timezoneResolver().resolve,
        runNatalChart: async () => ({
          status: "not_configured",
          warnings: ["astrologyapi_credentials_not_configured"]
        })
      }),
      /ONBOARDING_TRIAD_PROVIDER_UNAVAILABLE/
    );
  });

  it("falla con PROVIDER_UNAVAILABLE si la carta llega sin Sol o sin Luna", async () => {
    const provider = successfulProvider(chartWith({ sun: "capricornio" }));
    await assert.rejects(
      computeOnboardingTriad({
        args: VALID,
        now: NOW,
        resolveTimezone: timezoneResolver().resolve,
        runNatalChart: provider.run
      }),
      /ONBOARDING_TRIAD_PROVIDER_UNAVAILABLE/
    );
  });

  it("corta con RATE_LIMITED antes de gastar una llamada al proveedor", async () => {
    const provider = okTriad();
    await assert.rejects(
      computeOnboardingTriad({
        args: VALID,
        now: NOW,
        resolveTimezone: timezoneResolver().resolve,
        runNatalChart: provider.run,
        consumeRateLimit: async () => ({ allowed: false, retryAfterMs: 12_000 })
      }),
      (error: unknown) => {
        assert.ok(error instanceof OnboardingTriadError);
        assert.equal(error.code, "RATE_LIMITED");
        assert.match(error.message, /12s/);
        return true;
      }
    );
    assert.equal(provider.calls.length, 0);
  });

  it("le cobra la llamada al borrador del alta", async () => {
    const provider = okTriad();
    const subjects: string[] = [];
    await computeOnboardingTriad({
      args: VALID,
      now: NOW,
      resolveTimezone: timezoneResolver().resolve,
      runNatalChart: provider.run,
      consumeRateLimit: async (subject) => {
        subjects.push(subject);
        return { allowed: true, retryAfterMs: 0 };
      }
    });

    assert.deepEqual(subjects, [`draft:${DRAFT}`]);
    assert.equal(provider.calls.length, 1);
  });

  it("sin borrador válido no se resuelve zona ni se llama al proveedor", async () => {
    const provider = okTriad();
    const resolver = timezoneResolver();
    await assert.rejects(
      computeOnboardingTriad({
        args: { ...VALID, clientDraftId: "" },
        now: NOW,
        resolveTimezone: resolver.resolve,
        runNatalChart: provider.run
      }),
      /ONBOARDING_TRIAD_INVALID_DRAFT_ID/
    );
    assert.equal(resolver.calls.length, 0);
    assert.equal(provider.calls.length, 0);
  });
});

describe("sujeto del rate limit: el borrador del alta", () => {
  it("es el id tal cual, sin hash que finja anonimato", () => {
    assert.equal(onboardingTriadRateSubject(DRAFT), `draft:${DRAFT}`);
  });

  it("dos borradores no comparten cupo", () => {
    assert.notEqual(
      onboardingTriadRateSubject(DRAFT),
      onboardingTriadRateSubject("orbita-signup-9z8y7x6-5w4v3u2")
    );
  });

  for (const [caso, value] of [
    ["vacío", ""],
    ["sin prefijo", "1a2b3c4-5d6e7f8"],
    ["demasiado corto", "orbita-signup-1"],
    ["demasiado largo", `orbita-signup-${"a".repeat(60)}`],
    ["con espacios", "orbita-signup-1a2b 3c4"],
    ["con caracteres raros", "orbita-signup-1a2b/../3c4"],
    ["no string", 42 as unknown as string]
  ] as const) {
    it(`rechaza un id ${caso}`, () => {
      assert.throws(() => validateClientDraftId(value), /ONBOARDING_TRIAD_INVALID_DRAFT_ID/);
    });
  }

  it("acepta el formato que emite el cliente", () => {
    assert.equal(validateClientDraftId(`  ${DRAFT}  `), DRAFT);
  });
});

describe("timeout del proveedor natal (servidor)", () => {
  it("aborta la llamada y falla con PROVIDER_TIMEOUT en vez de colgarse", async () => {
    let received: AbortSignal | undefined;
    const started = Date.now();

    await assert.rejects(
      runWithProviderDeadline((signal) => {
        received = signal;
        return NEVER;
      }, 40),
      (error: unknown) => {
        assert.ok(error instanceof OnboardingTriadError);
        assert.equal(error.code, "PROVIDER_TIMEOUT");
        return true;
      }
    );

    assert.equal(received?.aborted, true, "el fetch natal recibe la señal abortada");
    assert.ok(Date.now() - started < 2_000, "no espera al proveedor colgado");
  });

  it("deja pasar la respuesta si llega a tiempo y limpia el timer", async () => {
    let cleared = 0;
    const timers = {
      setTimeout: globalThis.setTimeout,
      clearTimeout: ((id: any) => {
        cleared += 1;
        return globalThis.clearTimeout(id);
      }) as typeof clearTimeout
    };

    const value = await runWithProviderDeadline(async () => "ok", 5_000, timers);
    assert.equal(value, "ok");
    assert.equal(cleared, 1);
  });

  it("el cálculo completo corta por deadline y aborta al proveedor", async () => {
    let received: AbortSignal | undefined;

    await assert.rejects(
      computeOnboardingTriad({
        args: VALID,
        now: NOW,
        timeoutMs: 40,
        resolveTimezone: timezoneResolver().resolve,
        runNatalChart: ({ signal }) => {
          received = signal;
          return NEVER;
        },
        consumeRateLimit: async () => ({ allowed: true, retryAfterMs: 0 })
      }),
      /ONBOARDING_TRIAD_PROVIDER_TIMEOUT/
    );

    assert.equal(received?.aborted, true);
  });

  it("el techo es configurable por env, con default y máximo acotados", () => {
    assert.equal(getOnboardingTriadTimeoutMs({}), ONBOARDING_TRIAD_TIMEOUT_DEFAULT_MS);
    assert.equal(getOnboardingTriadTimeoutMs({ ORBITA_ONBOARDING_TRIAD_TIMEOUT_MS: "8000" }), 8_000);
    assert.equal(
      getOnboardingTriadTimeoutMs({ ORBITA_ONBOARDING_TRIAD_TIMEOUT_MS: "0" }),
      ONBOARDING_TRIAD_TIMEOUT_DEFAULT_MS
    );
    assert.equal(
      getOnboardingTriadTimeoutMs({ ORBITA_ONBOARDING_TRIAD_TIMEOUT_MS: "999999" }),
      ONBOARDING_TRIAD_TIMEOUT_MAX_MS
    );
  });
});

describe("timeout del cliente", () => {
  it("una acción encolada para siempre termina en error, no en espera eterna", async () => {
    const started = Date.now();
    await assert.rejects(withTriadTimeout(NEVER, 40), new RegExp(TRIAD_CLIENT_TIMEOUT_CODE));
    assert.ok(Date.now() - started < 2_000);
  });

  it("no interfiere con una respuesta normal y limpia el timer", async () => {
    let cleared = 0;
    const timers = {
      setTimeout: globalThis.setTimeout,
      clearTimeout: ((id: any) => {
        cleared += 1;
        return globalThis.clearTimeout(id);
      }) as typeof clearTimeout
    };

    assert.equal(await withTriadTimeout(Promise.resolve("triada"), 5_000, timers), "triada");
    assert.equal(cleared, 1);

    await assert.rejects(
      withTriadTimeout(Promise.reject(new Error("ONBOARDING_TRIAD_PROVIDER_UNAVAILABLE: x")), 5_000, timers),
      /PROVIDER_UNAVAILABLE/
    );
    assert.equal(cleared, 2, "también se limpia cuando el error es del backend");
  });

  // Invariante, no preferencia: si el servidor pudiera pasarse del techo del
  // cliente, el usuario vería "sin respuesta" en vez del error real.
  it("el cliente es más ancho que el MÁXIMO configurable del servidor", () => {
    assert.ok(
      TRIAD_CLIENT_TIMEOUT_MS > ONBOARDING_TRIAD_TIMEOUT_MAX_MS,
      `cliente ${TRIAD_CLIENT_TIMEOUT_MS}ms debe superar el máximo server ${ONBOARDING_TRIAD_TIMEOUT_MAX_MS}ms`
    );
  });

  it("ninguna configuración válida del servidor alcanza el techo del cliente", () => {
    const configuraciones = [
      undefined,
      "0",
      "-1",
      "no-es-un-numero",
      "1",
      "8000",
      "15000",
      "15001",
      "20000",
      "999999",
      String(Number.MAX_SAFE_INTEGER)
    ];

    for (const value of configuraciones) {
      const resolved = getOnboardingTriadTimeoutMs({ ORBITA_ONBOARDING_TRIAD_TIMEOUT_MS: value });
      assert.ok(
        resolved <= ONBOARDING_TRIAD_TIMEOUT_MAX_MS && resolved < TRIAD_CLIENT_TIMEOUT_MS,
        `con ORBITA_ONBOARDING_TRIAD_TIMEOUT_MS=${value} el servidor resolvió ${resolved}ms`
      );
    }
  });
});

describe("rate limit: cupo por borrador + fusible global", () => {
  const config = { scope: "onboarding_triad:draft", windowMs: 60_000, max: 3 };

  it("la clave separa ventana y sujeto", () => {
    const first = buildRateLimitBucketKey(config.scope, "draft:a", NOW, config.windowMs);
    assert.equal(first, buildRateLimitBucketKey(config.scope, "draft:a", NOW + 59_000, config.windowMs));
    assert.notEqual(first, buildRateLimitBucketKey(config.scope, "draft:a", NOW + 61_000, config.windowMs));
    assert.notEqual(first, buildRateLimitBucketKey(config.scope, "draft:b", NOW, config.windowMs));
  });

  it("permite hasta el máximo y después rechaza con retryAfter", () => {
    const windowStartedAt = Math.floor(NOW / config.windowMs) * config.windowMs;

    const first = evaluateRateLimit({ existing: null, now: NOW, config });
    assert.equal(first.allowed, true);
    assert.equal(first.nextCount, 1);

    const atMax = evaluateRateLimit({ existing: { count: 3, windowStartedAt }, now: NOW, config });
    assert.equal(atMax.allowed, false);
    assert.ok(atMax.retryAfterMs > 0 && atMax.retryAfterMs <= config.windowMs);
  });

  it("reinicia el contador de un documento de una ventana anterior", () => {
    const stale = { count: 99, windowStartedAt: NOW - 10 * config.windowMs };
    const decision = evaluateRateLimit({ existing: stale, now: NOW, config });
    assert.equal(decision.allowed, true);
    assert.equal(decision.nextCount, 1);
  });

  it("el cupo por borrador es chico y el fusible global mucho más alto", () => {
    const limits = getOnboardingTriadRateLimits({});
    assert.equal(limits.perDraft.max, 12);
    assert.equal(limits.globalFuse.max, 3_000);
    assert.ok(limits.globalFuse.max > limits.perDraft.max * 100);
    assert.notEqual(limits.perDraft.scope, limits.globalFuse.scope);
  });

  it("ambos límites se configuran por env con defaults seguros", () => {
    const limits = getOnboardingTriadRateLimits({
      ORBITA_ONBOARDING_TRIAD_MAX_PER_DRAFT_PER_MINUTE: "5",
      ORBITA_ONBOARDING_TRIAD_GLOBAL_FUSE_PER_MINUTE: "9000"
    });
    assert.equal(limits.perDraft.max, 5);
    assert.equal(limits.globalFuse.max, 9_000);

    assert.equal(resolvePositiveInt(undefined, 12, 1_000), 12);
    assert.equal(resolvePositiveInt("0", 12, 1_000), 12);
    assert.equal(resolvePositiveInt("-5", 12, 1_000), 12);
    assert.equal(resolvePositiveInt("no", 12, 1_000), 12);
    assert.equal(resolvePositiveInt("999999", 12, 1_000), 1_000);
  });
});

describe("guards de producción", () => {
  const SIGNALS: Array<[string, Record<string, string | undefined>]> = [
    ["ORBITA_ENVIRONMENT=production", { ORBITA_ENVIRONMENT: "production" }],
    ["COMMERCE_MODE=live", { COMMERCE_MODE: "live" }],
    ["CONVEX_DEPLOYMENT=prod:*", { CONVEX_DEPLOYMENT: "prod:exciting-bat-311" }],
    ["ORBITA_ENV=production", { ORBITA_ENV: "production" }]
  ];

  const CLEAN = {
    ORBITA_ENVIRONMENT: undefined,
    COMMERCE_MODE: undefined,
    CONVEX_DEPLOYMENT: undefined,
    ORBITA_ENV: undefined
  };

  it("cada señal, por sí sola, marca producción", () => {
    for (const [nombre, patch] of SIGNALS) {
      assert.equal(isProductionEnvironment({ ...patch }), true, nombre);
    }
    assert.equal(isProductionEnvironment({}), false);
    // Un deployment dev con NODE_ENV=production NO es producción: el bundler lo
    // pone y apagaría el lab sin motivo.
    assert.equal(isProductionEnvironment({ NODE_ENV: "production", CONVEX_DEPLOYMENT: "dev:dutiful-viper-815" }), false);
  });

  for (const [nombre, patch] of SIGNALS) {
    it(`el lab sigue rechazado con ${nombre}, aun habilitado y con key correcta`, () => {
      withEnv(
        { ...CLEAN, ...patch, ORBITA_PUBLIC_LAB_ENABLED: "true", ORBITA_PUBLIC_LAB_KEY: "lab-secret" },
        () => {
          assert.throws(() => assertPublicLabAccess(), /Public lab is not available in production/);
          assert.throws(() => assertPublicLabAccess("lab-secret"), /Public lab is not available in production/);
        }
      );
    });

    it(`la tríada del onboarding SÍ funciona con ${nombre}`, async () => {
      const provider = okTriad();
      const triad = await withEnv({ ...CLEAN, ...patch }, async () => {
        assert.equal(isProductionEnvironment(), true);
        return await computeOnboardingTriad({
          args: VALID,
          now: NOW,
          resolveTimezone: timezoneResolver().resolve,
          runNatalChart: provider.run,
          consumeRateLimit: async () => ({ allowed: true, retryAfterMs: 0 })
        });
      });
      assert.deepEqual(triad, { sun: "capricornio", moon: "leo", ascendant: "libra" });
    });
  }

  it("fuera de producción el lab conserva su guard original", () => {
    withEnv({ ...CLEAN, ORBITA_PUBLIC_LAB_ENABLED: undefined, ORBITA_PUBLIC_LAB_KEY: undefined }, () => {
      assert.throws(() => assertPublicLabAccess(), /Public lab is disabled/);
      process.env.ORBITA_PUBLIC_LAB_ENABLED = "true";
      assert.doesNotThrow(() => assertPublicLabAccess());
      process.env.ORBITA_PUBLIC_LAB_KEY = "lab-secret";
      assert.throws(() => assertPublicLabAccess("wrong"), /access key is invalid/);
      assert.doesNotThrow(() => assertPublicLabAccess("lab-secret"));
    });
  });
});

/** Timers manuales para las pruebas conductuales de la superficie de tríada. */
function makeManualTimers() {
  let pending: { fn: () => void; ms: number } | null = null;
  return {
    setTimeout(fn: () => void, ms: number) {
      pending = { fn, ms };
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout() {
      pending = null;
    },
    pendingDelay() {
      return pending?.ms ?? null;
    },
    fire() {
      const actual = pending;
      pending = null;
      actual?.fn();
    }
  };
}

/** Deja correr las microtareas pendientes (then/catch encadenados). */
const drain = () => new Promise<void>((r) => setTimeout(r, 0));

describe("el onboarding no depende del laboratorio", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

  /** Código sin comentarios: la nota histórica puede nombrar al lab; el código no. */
  const code = (file: string) =>
    read(file)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

  /** Todos los .ts/.tsx bajo un directorio, recursivo. */
  function sourcesUnder(dir: string): string[] {
    const root = path.join(process.cwd(), dir);
    const out: string[] = [];
    const walk = (current: string) => {
      for (const entry of readdirSync(current)) {
        const full = path.join(current, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry)) out.push(path.relative(process.cwd(), full));
      }
    };
    walk(root);
    return out;
  }

  it("la acción pública no importa publicLab", () => {
    const src = read("convex/publicOnboarding.ts");
    assert.equal(/from "\.\/publicLab"/.test(src), false);
    assert.match(src, /runAstrologyApiNatalChart/);
    assert.match(src, /timezoneAtCoordinates/);
  });

  it("la llamada natal viaja con AbortSignal hasta el fetch", () => {
    const provider = read("convex/lib/astrologyApi.ts");
    const natal = provider.slice(
      provider.indexOf("export async function runAstrologyApiNatalChart"),
      provider.indexOf("export async function runAstrologyApiDailyTransits")
    );
    assert.match(natal, /signal\?: AbortSignal/);
    // Los tres endpoints natales (preferido + fallback legacy) lo reciben.
    assert.equal(natal.match(/signal: args\.signal/g)?.length, 3);
    assert.match(natal, /if \(args\.signal\?\.aborted\) throw error;/);

    const accion = read("convex/publicOnboarding.ts");
    assert.match(accion, /runAstrologyApiNatalChart\(\{ input, localDate, signal \}\)/);
  });

  it("el borrador es obligatorio en el contrato de la acción", () => {
    const src = read("convex/publicOnboarding.ts");
    assert.match(src, /clientDraftId: v\.string\(\)/);
    assert.equal(/clientDraftId: v\.optional/.test(src), false);
  });

  it("el hook del cliente corta la espera con withTriadTimeout", () => {
    const src = read("src/onboarding/useAccount.ts");
    assert.match(src, /withTriadTimeout\(\s*computeTriad\(/);
    assert.match(src, /ONBOARDING_TRIAD_INVALID_DRAFT_ID/);
  });

  it("la acción declara returns y devuelve exactamente la tríada", () => {
    const src = read("convex/publicOnboarding.ts");
    assert.match(src, /returns: v\.object\(\{\s*sun: signValidator,\s*moon: signValidator,\s*ascendant: signValidator\s*\}\)/);
  });

  // Regresión del bug productivo: el alta —nativa y web, que comparten
  // `OnboardingFlow` vía `/empezar`— no puede volver a colgarse del lab, que
  // está bloqueado en producción.
  it("ningún archivo del onboarding usa publicLab (ni nativo ni web)", () => {
    const onboardingSources = [
      ...sourcesUnder("src/onboarding"),
      "app/empezar.tsx",
      "app/onboarding.tsx",
      "src/services/publicOnboardingRefs.ts"
    ];

    for (const file of onboardingSources) {
      const src = code(file);
      assert.equal(/publicLabApi/.test(src), false, `${file} no debe usar publicLabApi`);
      assert.equal(/publicLabRefs/.test(src), false, `${file} no debe importar publicLabRefs`);
      assert.equal(/previewDailyHome/.test(src), false, `${file} no debe llamar previewDailyHome`);
    }
  });

  it("el laboratorio es el ÚNICO consumidor de publicLabApi en el front", () => {
    const consumers = sourcesUnder("src")
      .concat(sourcesUnder("app"))
      .filter((file) => /publicLabApi/.test(code(file)))
      .filter((file) => !file.endsWith("publicLabRefs.ts"));

    assert.deepEqual(consumers, ["src/components/web/orbita-lab.tsx"]);
  });

  it("el hook del onboarding usa publicOnboarding.computeTriad sin zona del dispositivo", () => {
    const src = read("src/onboarding/useAccount.ts");
    assert.match(src, /publicOnboardingApi\.computeTriad/);
    assert.equal(/deviceTimezone/.test(src), false);
  });

  it("CONDUCTA · el cálculo que llega antes del techo revela la carta", async () => {
    const timers = makeManualTimers();
    let resolve!: (v: string) => void;
    const events: string[] = [];
    const cancel = observeTriadComputation({
      computation: new Promise<string>((r) => (resolve = r)),
      visibleWaitMs: 8000,
      timers,
      onReady: (v) => events.push(`ready:${v}`),
      onTimedOut: () => events.push("timed_out"),
      onError: () => events.push("error")
    });
    resolve("triada");
    await drain();
    // El timer visible quedó limpio: no dispara después del revelado.
    timers.fire();
    await drain();
    assert.deepEqual(events, ["ready:triada"]);
    cancel();
  });

  it("CONDUCTA · a los 8 segundos se emite timed_out y el flujo AVANZA solo", async () => {
    const timers = makeManualTimers();
    let resolve!: (v: string) => void;
    const events: string[] = [];
    observeTriadComputation({
      computation: new Promise<string>((r) => (resolve = r)),
      visibleWaitMs: 8000,
      timers,
      onReady: (v) => events.push(`ready:${v}`),
      onTimedOut: () => events.push("timed_out"),
      onError: () => events.push("error")
    });
    assert.equal(timers.pendingDelay(), 8000, "el techo visible es de 8 segundos");
    timers.fire();
    await drain();
    assert.deepEqual(events, ["timed_out"]);
    // timed_out avanza SOLO: no exige interacción ni una pantalla técnica.
    assert.equal(triadAutoAdvances("timed_out"), true);
    // Y una respuesta TARDÍA se descarta: la superficie ya avanzó.
    resolve("tarde");
    await drain();
    assert.deepEqual(events, ["timed_out"], "el resultado tardío no re-emite nada");
  });

  it("CONDUCTA · un error del proveedor también avanza solo, sin pantalla técnica", async () => {
    const timers = makeManualTimers();
    let reject!: (e: unknown) => void;
    const events: string[] = [];
    observeTriadComputation({
      computation: new Promise<string>((_r, rj) => (reject = rj)),
      visibleWaitMs: 8000,
      timers,
      onReady: () => events.push("ready"),
      onTimedOut: () => events.push("timed_out"),
      onError: () => events.push("error")
    });
    reject(new Error("ONBOARDING_TRIAD_PROVIDER_TIMEOUT"));
    await drain();
    assert.deepEqual(events, ["error"]);
    assert.equal(triadAutoAdvances("error"), true);
    // Los estados que NO avanzan solos: la carga espera y el revelado espera
    // el Continuar de la persona.
    assert.equal(triadAutoAdvances("idle"), false);
    assert.equal(triadAutoAdvances("loading"), false);
    assert.equal(triadAutoAdvances("ready"), false);
  });

  it("CONDUCTA · cancelar (volver atrás / editar datos) silencia todo", async () => {
    const timers = makeManualTimers();
    let resolve!: (v: string) => void;
    const events: string[] = [];
    const cancel = observeTriadComputation({
      computation: new Promise<string>((r) => (resolve = r)),
      visibleWaitMs: 8000,
      timers,
      onReady: () => events.push("ready"),
      onTimedOut: () => events.push("timed_out"),
      onError: () => events.push("error")
    });
    cancel();
    timers.fire();
    resolve("tarde");
    await drain();
    assert.deepEqual(events, []);
  });

  it("el flujo cablea la orquestación pura y el auto-avance", () => {
    // Cableado (no copy): el efecto de la tríada usa la orquestación probada
    // arriba, y el avance automático pasa por la misma regla pura.
    const flow = read("src/onboarding/OnboardingFlow.tsx");
    assert.match(flow, /observeTriadComputation\(\{/);
    assert.match(flow, /if \(!triadAutoAdvances\(triadStatus\)\) return;\s*setStep\(STEP_BEFORE_AFTER\);/);
    // Mientras carga NO hay CTA para saltarla: el único CTA de la superficie
    // aparece con la carta revelada.
    const screen = read("src/onboarding/screens/TriadScreen.tsx");
    assert.match(screen, /\{ready \? <CTA label="Continuar" onPress=\{onContinue\} \/> : null\}/);
    // El techo visible sigue siendo menor que el techo duro del cliente.
    const timeoutSrc = read("src/domain/triadTimeout.ts");
    assert.match(timeoutSrc, /export const TRIAD_VISIBLE_WAIT_MS = 8_000;/);
  });
});
