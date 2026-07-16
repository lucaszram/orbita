import type { FirstRunFlags } from "@/services/firstRun";
import { storageKeys } from "./storageKeys";

/**
 * Reglas puras del "primer día" (Bloque B del plan Hook, Figma sección 13).
 * Viven acá — sin AsyncStorage ni React — para poder testearlas en node:
 * qué muestra el tab Carta la primera vez y qué toca (y qué NO toca) el
 * control interno REPETIR PRIMER DÍA.
 */

/** El bloque QUÉ ES del tab Carta se muestra solo si nunca se presentó. */
export function shouldShowCartaQueEs(flags: FirstRunFlags): boolean {
  return !flags.cartaQueEsVisto;
}

/**
 * QUÉ ES se decide POR VISITA (ciclo de foco del tab), no por montaje: los
 * tabs quedan montados, y con una decisión por montaje REPETIR PRIMER DÍA no
 * re-mostraba el bloque al volver a Carta. Reglas:
 * - al ganar foco, con flags hidratados, se decide UNA vez para toda la visita;
 * - marcar `cartaQueEsVisto` durante la visita no esconde el bloque en curso;
 * - al perder el foco, la próxima visita decide de nuevo.
 */
export type CartaQueEsVisita = { decidida: boolean; mostrar: boolean };

export const QUE_ES_VISITA_INICIAL: CartaQueEsVisita = { decidida: false, mostrar: false };

export function decidirCartaQueEs(
  visita: CartaQueEsVisita,
  flagsReady: boolean,
  flags: FirstRunFlags
): { visita: CartaQueEsVisita; marcarVisto: boolean } {
  if (!flagsReady || visita.decidida) return { visita, marcarVisto: false };
  const mostrar = shouldShowCartaQueEs(flags);
  return { visita: { decidida: true, mostrar }, marcarVisto: mostrar };
}

/** Al perder el foco: la visita se cierra y la próxima vuelve a decidir. */
export function cerrarVisitaCartaQueEs(): CartaQueEsVisita {
  return QUE_ES_VISITA_INICIAL;
}

/** Claves de AsyncStorage que son DATA del usuario: perfil, dueño, lecturas
 *  guardadas (+ lápidas de borrado pendiente) y diario. */
export const USER_DATA_STORAGE_KEYS = [
  storageKeys.profile,
  storageKeys.profileOwner,
  storageKeys.savedReadings,
  storageKeys.savedReadingTombstones,
  storageKeys.journal
] as const;

/** La única clave que borra REPETIR PRIMER DÍA: los hitos de primera vez. */
export const FIRST_DAY_REPLAY_CLEARS = [storageKeys.firstRun] as const;

/**
 * Producción = Clerk live (`pk_live…`, EAS production).
 */
export function isProductionBackend(clerkPublishableKey: string | undefined): boolean {
  return typeof clerkPublishableKey === "string" && clerkPublishableKey.startsWith("pk_live");
}

/**
 * El control REPETIR PRIMER DÍA falla CERRADO: exige la bandera pública
 * explícita `EXPO_PUBLIC_ENABLE_FIRST_DAY_REPLAY === "true"` (opt-in por
 * .env.local, nunca en EAS production) Y que la build no use Clerk live.
 * `pk_test` solo NO alcanza: ya hubo un environment de production apuntando
 * a dev por accidente; el default (bandera ausente/otra cosa) lo oculta en
 * TODA build.
 */
export function firstDayReplayEnabled(opts: {
  enableFlag: string | undefined;
  clerkPublishableKey: string | undefined;
}): boolean {
  return opts.enableFlag === "true" && !isProductionBackend(opts.clerkPublishableKey);
}
