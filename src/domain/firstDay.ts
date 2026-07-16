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
 * El control interno REPETIR PRIMER DÍA existe solo apuntando a
 * desarrollo/testing. Producción = Clerk live (`pk_live…`, EAS production):
 * ahí JAMÁS se muestra. Sin key o con `pk_test` es dev/demo.
 */
export function isProductionBackend(clerkPublishableKey: string | undefined): boolean {
  return typeof clerkPublishableKey === "string" && clerkPublishableKey.startsWith("pk_live");
}
