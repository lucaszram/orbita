import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storageKeys } from "@/domain/storageKeys";

/** Hitos de primera vez del "día 1" (Bloque B del plan Hook, 2026-07-14).
 *
 *  Son flags de DISPOSITIVO, no de cuenta: enseñan la app una sola vez por
 *  instalación. El estado del ritual real (qué carta salió, qué día se reveló)
 *  vive en el backend; esto solo recuerda qué explicaciones ya se mostraron.
 */
export type FirstRunFlags = {
  /** Ya pasó por la ceremonia de recepción de la carta natal. */
  recepcionVista?: boolean;
  /** Ya sacó su primera carta: la intro del tarot y el bloque EL RITUAL cumplieron. */
  ritualExplicado?: boolean;
  /** Ya vio el bloque QUÉ ES del tab Carta. */
  cartaQueEsVisto?: boolean;
};

const KEY = storageKeys.firstRun;

// Cache de módulo + suscriptores: todas las pantallas ven el mismo estado sin
// recargar de AsyncStorage, y un mark en la Home actualiza al tab Carta montado.
let cache: FirstRunFlags | null = null;
let inflight: Promise<FirstRunFlags> | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<FirstRunFlags> {
  if (cache) return cache;
  if (!inflight) {
    inflight = AsyncStorage.getItem(KEY).then((raw) => {
      if (cache) return cache;
      try {
        cache = raw ? (JSON.parse(raw) as FirstRunFlags) : {};
      } catch {
        cache = {};
      }
      return cache;
    });
  }
  return inflight;
}

export async function markFirstRun(patch: Partial<FirstRunFlags>): Promise<void> {
  const current = await load();
  cache = { ...current, ...patch };
  listeners.forEach((notify) => notify());
  await AsyncStorage.setItem(KEY, JSON.stringify(cache));
}

export async function clearFirstRunFlags(): Promise<void> {
  cache = {};
  inflight = null;
  listeners.forEach((notify) => notify());
  await AsyncStorage.removeItem(KEY);
}

/** Flags reactivos. `ready` en false hasta hidratar: no decidir visibilidad antes. */
export function useFirstRun(): { ready: boolean; flags: FirstRunFlags } {
  const [ready, setReady] = useState(cache != null);
  const [, setVersion] = useState(0);

  useEffect(() => {
    let mounted = true;
    void load().then(() => {
      if (mounted) setReady(true);
    });
    const notify = () => setVersion((n) => n + 1);
    listeners.add(notify);
    return () => {
      mounted = false;
      listeners.delete(notify);
    };
  }, []);

  return { ready, flags: cache ?? {} };
}
