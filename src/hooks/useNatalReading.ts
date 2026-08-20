/**
 * "Tu carta, explicada" — el ÚNICO cableado de la lectura natal larga.
 *
 * Las dos pantallas que muestran el bloque —la canónica
 * (`src/screens/CartaScreen.tsx`) y la V4.9.2
 * (`src/screens/v492/CartaCompletaV492Screen.tsx`)— consumen la misma lectura,
 * y mientras cada una montaba su propio efecto de generación las dos podían
 * derivar: una disparando la action donde la otra no, una tratando un `pending`
 * como error, una sin escuchar la señal remota. El efecto vive acá una sola vez.
 *
 * Las reglas —todas probadas en `test/cartaNatalCarga.test.ts`— son:
 *
 * - La LECTURA RECIBIDA MANDA. Si la query trajo la lectura se muestra, aunque
 *   un fallo local viejo o un `state` remoto stale digan otra cosa.
 * - `locked` NUNCA dispara la action. El gating es server-side: para una cuenta
 *   Free la action rechaza por diseño, y dispararla igual sólo producía un
 *   Server Error por montaje.
 * - Una resolución `{ status: "pending" }` NO es un error: significa que el
 *   prewarm del backend ya tiene el claim. Sólo un REJECT marca fallo.
 * - El error ofrece reintento, y el reintento limpia el fallo local y vuelve a
 *   disparar la action; `generating` cubre la ventana hasta que el backend pise
 *   el `error` remoto de la ronda anterior.
 *
 * La FASE la decide `readingBlockPhase` (`@/domain/cartaNatalCarga`), que es
 * pura. Este hook sólo le da sus entradas.
 */
import { useCallback, useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";

import { readingBlockPhase, type ReadingBlockPhase } from "@/domain/cartaNatalCarga";
import { appApi, type PersonalityReadingPayload } from "@/services/appRefs";

export type NatalReading = {
  phase: ReadingBlockPhase;
  /** Sólo no-null cuando `phase === "listo"`: el tipo impide dibujar a medias. */
  reading: PersonalityReadingPayload | null;
  /** Limpia el fallo local y vuelve a disparar la generación. */
  retry: () => void;
};

export function useNatalReading(): NatalReading {
  const reading = useQuery(appApi.charts.personalityReading, {});
  // Señal reactiva de la generación (pending/ready/error/locked): si el prewarm
  // del backend tomó el claim y FALLÓ, acá llega `error` y el bloque ofrece
  // reintento en vez de quedar en "Preparando…" para siempre.
  const readingState = useQuery(appApi.charts.personalityReadingState, {});
  // Genera (LLM) + cachea la lectura rica; la query de arriba la devuelve
  // reactiva. No-opea si ya está cacheada o si no hay carta.
  const generate = useAction(appApi.charts.generatePersonalityReading);
  const [generateFailed, setGenerateFailed] = useState(false);
  const [generating, setGenerating] = useState(true);
  const [attempt, setAttempt] = useState(0);
  // La action es Plus-only: con `locked` el backend la rechaza por diseño. Se
  // espera la señal remota (`undefined` = query en vuelo) y se dispara sólo si
  // no está bloqueada. La dependencia es este booleano —no el status crudo—
  // para que pending→ready/error no re-dispare la generación.
  const canGenerate = readingState !== undefined && readingState.status !== "locked";
  useEffect(() => {
    if (!canGenerate) return;
    let alive = true;
    setGenerateFailed(false);
    setGenerating(true);
    generate({})
      .catch(() => {
        if (alive) setGenerateFailed(true);
      })
      .finally(() => {
        if (alive) setGenerating(false);
      });
    return () => {
      alive = false;
    };
  }, [generate, attempt, canGenerate]);

  const phase = readingBlockPhase({
    reading,
    failed: generateFailed,
    generating,
    state: readingState?.status
  });
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { phase, reading: phase === "listo" ? reading! : null, retry };
}
