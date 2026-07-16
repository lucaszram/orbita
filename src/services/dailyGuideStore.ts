import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useAction } from "convex/react";
import { proposedApi, type DailyGuidePayload } from "@/services/appRefs";

/**
 * Guía diaria — cache y deduplicación por (usuario, fecha) a NIVEL DE MÓDULO.
 *
 * Antes esto era un `useState` + `useRef` locales a HomeScreen: cada remontaje de la
 * Home (handshake de auth, reconexión, cambio de tab con unmount) perdía el estado y
 * volvía a disparar `daily.getGuide` — se observaron 3 ejecuciones en paralelo de una
 * acción que en frío tarda ~25 segundos. Acá el resultado y el vuelo viven fuera del
 * árbol de React: un remontaje se suscribe y encuentra lo que ya había.
 *
 * Estados: `loading | ready | error` (+ reintento explícito y timeout de 60s).
 * Si la acción resuelve DESPUÉS del timeout, el resultado gana igual (llegó, se usa).
 */
export type DailyGuideState =
  | { status: "loading" }
  | { status: "ready"; payload: DailyGuidePayload }
  | { status: "error"; message: string };

type Entry = { state: DailyGuideState; runId: number };

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let runSeq = 0;

const LOADING: DailyGuideState = { status: "loading" };
const TIMEOUT_MS = 60_000;

function emit() {
  for (const l of [...listeners]) l();
}

function setState(key: string, runId: number, state: DailyGuideState) {
  entries.set(key, { state, runId });
  emit();
}

/** Solo para tests/dev: olvida todo lo cacheado. */
export function resetDailyGuideStore() {
  entries.clear();
  emit();
}

export function useDailyGuide(
  /** Clave estable del usuario (`auth.userId` de Clerk; el email puede cambiar).
   *  `null` = sin sesión live confirmada: no dispara. */
  userKey: string | null,
  localDate: string
): { state: DailyGuideState; retry: () => void } {
  const run = useAction(proposedApi.dailyGuide);

  const key = userKey ? `${userKey}:${localDate}` : null;
  // Durante una reconexión `userKey` se vuelve null transitoriamente; recordamos la
  // última clave para seguir MOSTRANDO lo que ya había en vez de volver a "cargando".
  const lastKeyRef = useRef<string | null>(null);
  if (key) lastKeyRef.current = key;
  const readKey = key ?? lastKeyRef.current;

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

  const fetchGuide = useCallback(
    (force = false) => {
      if (!key) return;
      const current = entries.get(key);
      // Dedupe: si ya está lista, o hay una ejecución en vuelo, no se dispara otra.
      if (!force && current && current.state.status !== "error") return;
      if (force && current?.state.status === "loading") return;

      const runId = ++runSeq;
      setState(key, runId, LOADING);

      const timeout = setTimeout(() => {
        const e = entries.get(key);
        if (e?.runId === runId && e.state.status === "loading") {
          setState(key, runId, { status: "error", message: "La lectura está tardando más de lo normal." });
        }
      }, TIMEOUT_MS);

      run({ localDate })
        .then((payload) => {
          clearTimeout(timeout);
          // El resultado gana aunque el timeout haya marcado error: la data llegó.
          if (entries.get(key)?.runId === runId) setState(key, runId, { status: "ready", payload });
        })
        .catch((e) => {
          clearTimeout(timeout);
          console.warn("[orbita] daily.getGuide falló:", e?.message ?? e);
          const entry = entries.get(key);
          if (entry?.runId === runId && entry.state.status === "loading") {
            setState(key, runId, { status: "error", message: "No pudimos leer tu cielo de hoy." });
          }
        });
    },
    [key, run, localDate]
  );

  useEffect(() => {
    if (key) fetchGuide();
  }, [key, fetchGuide]);

  const retry = useCallback(() => fetchGuide(true), [fetchGuide]);

  return { state, retry };
}
