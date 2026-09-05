import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useAction } from "convex/react";
import { hasLunaSobreLaCartaData, toLunaSobreLaCarta } from "@/domain/homeAdapter";
import { appApi, type LunaSobreLaCartaPayload } from "@/services/appRefs";

/**
 * La Luna sobre la carta — caché y deduplicación por (usuario, fecha) a NIVEL DE
 * MÓDULO, con el mismo diseño que `dailyGuideStore`.
 *
 * `home.getLunaSobreLaCarta` es una ACTION: pega al proveedor y cachea el cielo
 * del día. Si el estado viviera dentro del componente, cada remontaje de Hoy
 * —handshake de auth, reconexión, volver a la pestaña— dispararía otra
 * ejecución. Acá el resultado y el vuelo viven fuera del árbol de React: un
 * remontaje se suscribe y encuentra lo que ya había.
 *
 * ## Se llama sin argumentos, a propósito
 *
 * `localDate` y `timezone` son opcionales y sólo pueden CONFIRMAR el día que el
 * servidor ya resolvió: cualquier diferencia —incluida la misma zona escrita
 * distinto— devuelve `needs_daily_context` sin medir nada. Mandarlos no aporta
 * nada y agrega una forma de romper la pantalla, así que la action se invoca con
 * `{}`. La fecha canónica sí entra en la CLAVE del caché: es la que decide
 * cuándo el sobre guardado dejó de valer.
 *
 * ## Fallar cerrado
 *
 * La respuesta se adapta SIEMPRE con `toLunaSobreLaCarta`, que valida campo a
 * campo y no rellena nada. Un sobre irreconocible es `error`, no un sobre a
 * medias; un sobre válido pero sin ningún bloque es `empty` y viaja igual,
 * porque sus `missingInputs` son justamente lo que la pantalla necesita para
 * explicar por qué falta cada módulo.
 */
export type LunaCartaState =
  | { status: "loading" }
  | { status: "ready"; payload: LunaSobreLaCartaPayload }
  | { status: "empty"; payload: LunaSobreLaCartaPayload }
  | { status: "error"; message: string };

type Entry = { state: LunaCartaState; runId: number };

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let runSeq = 0;

const LOADING: LunaCartaState = { status: "loading" };

/**
 * Traduce un sobre ya validado al estado visible del módulo.
 *
 * La action expresa algunos fallos como payload —no como promesa rechazada—
 * para conservar un contrato total. `provider_error` y un sobre que afirma
 * `ready`/`partial` pero perdió los dos bloques siguen siendo errores
 * recuperables: tratarlos como `empty` dejaría una explicación gris sin ningún
 * botón para volver a intentar. Las ausencias estables (`needs_natal_chart`,
 * `not_configured`, etc.) sí son `empty` y conservan sus `missingInputs`.
 */
export function lunaCartaStateFromPayload(payload: LunaSobreLaCartaPayload): LunaCartaState {
  const tieneDato = hasLunaSobreLaCartaData(payload);
  if (
    payload.status === "provider_error" ||
    payload.status === "needs_daily_context" ||
    (!tieneDato && (payload.status === "ready" || payload.status === "partial"))
  ) {
    return { status: "error", message: "No pudimos leer la Luna de hoy." };
  }
  return tieneDato ? { status: "ready", payload } : { status: "empty", payload };
}

/**
 * Techo de espera. Más corto que el de la guía diaria (60s) porque acá no hay
 * LLM: es una lectura de efemérides con caché global por (día, zona). Si la
 * acción resuelve DESPUÉS del timeout, el resultado gana igual: llegó, se usa.
 */
const TIMEOUT_MS = 30_000;

function emit() {
  for (const l of [...listeners]) l();
}

function setState(key: string, runId: number, state: LunaCartaState) {
  entries.set(key, { state, runId });
  emit();
}

/** Solo para tests/dev: olvida todo lo cacheado. */
export function resetLunaCartaStore() {
  entries.clear();
  emit();
}

/**
 * Qué clave LEE el hook y qué retiene para el próximo render.
 *
 * Misma regla que la guía diaria: `userKey=null` es ambiguo (reconexión
 * transitoria O signed-out definitivo), así que el caller lo desambigua con
 * `holdLastKey` (= `isAuthLoading`). Con signed-out CONFIRMADO la retención se
 * SUELTA: el sobre de la cuenta anterior no puede renderizarse en modo invitado
 * ni resucitar en una reconexión posterior.
 */
export function resolveLunaReadKey(input: {
  currentKey: string | null;
  lastKey: string | null;
  holdLastKey: boolean;
}): { readKey: string | null; nextLastKey: string | null } {
  if (input.currentKey) return { readKey: input.currentKey, nextLastKey: input.currentKey };
  if (input.holdLastKey) return { readKey: input.lastKey, nextLastKey: input.lastKey };
  return { readKey: null, nextLastKey: null };
}

export function useLunaCarta(
  /** Clave estable del usuario (`auth.userId` de Clerk). `null` = no dispara. */
  userKey: string | null,
  /** Fecha canónica del servidor. Sólo entra en la clave del caché. */
  localDate: string,
  /** true mientras la sesión carga/reconecta: retiene la última clave. */
  holdLastKey: boolean
): { state: LunaCartaState; retry: () => void } {
  const run = useAction(appApi.home.getLunaSobreLaCarta);

  const key = userKey && localDate ? `${userKey}:${localDate}` : null;
  const lastKeyRef = useRef<string | null>(null);
  const resolved = resolveLunaReadKey({ currentKey: key, lastKey: lastKeyRef.current, holdLastKey });
  lastKeyRef.current = resolved.nextLastKey;
  const readKey = resolved.readKey;

  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  const getSnapshot = useCallback(
    () => (readKey ? entries.get(readKey)?.state ?? LOADING : LOADING),
    [readKey]
  );
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const fetchLuna = useCallback(
    (force = false) => {
      if (!key) return;
      const current = entries.get(key);
      // Dedupe: si ya resolvió (con o sin bloques) o hay una ejecución en vuelo,
      // no se dispara otra.
      if (!force && current && current.state.status !== "error") return;
      if (force && current?.state.status === "loading") return;

      const runId = ++runSeq;
      setState(key, runId, LOADING);

      const timeout = setTimeout(() => {
        const e = entries.get(key);
        if (e?.runId === runId && e.state.status === "loading") {
          setState(key, runId, { status: "error", message: "La Luna de hoy está tardando más de lo normal." });
        }
      }, TIMEOUT_MS);

      run({})
        .then((raw) => {
          clearTimeout(timeout);
          // Aislamiento de respuestas tardías: una ejecución vieja no puede
          // pisar el resultado de la que la reemplazó (otro día, otra cuenta,
          // un reintento).
          if (entries.get(key)?.runId !== runId) return;
          const payload = toLunaSobreLaCarta(raw);
          if (!payload) {
            setState(key, runId, { status: "error", message: "No pudimos leer la Luna de hoy." });
            return;
          }
          setState(key, runId, lunaCartaStateFromPayload(payload));
        })
        .catch((e) => {
          clearTimeout(timeout);
          console.warn("[orbita] home.getLunaSobreLaCarta falló:", e?.message ?? e);
          const entry = entries.get(key);
          if (entry?.runId === runId && entry.state.status === "loading") {
            setState(key, runId, { status: "error", message: "No pudimos leer la Luna de hoy." });
          }
        });
    },
    [key, run]
  );

  useEffect(() => {
    if (key) fetchLuna();
  }, [key, fetchLuna]);

  const retry = useCallback(() => fetchLuna(true), [fetchLuna]);

  return { state, retry };
}
