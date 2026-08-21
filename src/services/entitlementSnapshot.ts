/**
 * Snapshot local del plan (nativo).
 *
 * Guarda SÓLO lo que el backend ya confirmó para una cuenta —Free o Plus— para
 * que el arranque en frío no tenga que decir "Free" mientras
 * `subscriptions.getCurrent` viaja. No es un permiso: el acceso lo sigue
 * resolviendo Convex y el cobro exige el remoto confirmado. Es una etiqueta.
 *
 * Una clave por cuenta, y el dueño también adentro del valor: el plan de A no
 * puede aparecer bajo la sesión de B en el mismo teléfono. La variante `.web.ts`
 * no guarda nada, para que el bundle web no arrastre `AsyncStorage`.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  parsePlanSnapshot,
  serializePlanSnapshot,
  type ConfirmedPlan
} from "@/domain/entitlement";

const snapshotKey = (owner: string) => `orbita:entitlement-snapshot:${owner}`;

/**
 * Lee el snapshot de esta cuenta. NUNCA tira.
 *
 * Un fallo de disco o un JSON roto se leen como "no hay snapshot", que es el
 * estado seguro: la etiqueta cae en Free y el plan real llega igual por la
 * query. Distinguir "ilegible" acá no serviría para nada —no habilita ni
 * bloquea ninguna acción— y sí complicaría al provider.
 */
export async function readEntitlementSnapshot(owner: string): Promise<ConfirmedPlan | null> {
  try {
    return parsePlanSnapshot(await AsyncStorage.getItem(snapshotKey(owner)), owner);
  } catch {
    return null;
  }
}

/** Persiste un plan REMOTO ya confirmado. Sólo el provider debería llamarla. */
export async function writeEntitlementSnapshot(owner: string, plan: ConfirmedPlan): Promise<void> {
  await AsyncStorage.setItem(
    snapshotKey(owner),
    serializePlanSnapshot({ owner, isPro: plan.isPro })
  );
}

/**
 * Retira el snapshot de esta cuenta.
 *
 * Propaga el fallo: quien la llama tiene que poder enterarse de que el disco
 * todavía conserva una etiqueta vieja. Lo peor que puede pasar es un arranque
 * que muestra "Órbita Plus" de más hasta que el remoto conteste —el acceso no
 * cambia—, pero eso se decide arriba y no se simula acá.
 */
export async function clearEntitlementSnapshot(owner: string): Promise<void> {
  await AsyncStorage.removeItem(snapshotKey(owner));
}
