/**
 * Identidad previamente confirmada, en el llavero del sistema (QA23-007).
 *
 * Adaptador nativo de `@/domain/secureIdentity`: `expo-secure-store` (Keychain
 * en iOS, Keystore en Android) para un único registro con el `clerkUserId` de la
 * última sesión que la app confirmó entera.
 *
 * Tres decisiones:
 *
 * 1. **Ni una sola lectura de Clerk.** No se abre su almacén, no se busca su
 *    clave y no se toca su token. Lo que se guarda es un identificador público
 *    de cuenta —el mismo que ya vive en claro en `orbita:profile-owner`— y va al
 *    llavero porque de él depende qué datos se muestran, no porque sea secreto.
 * 2. **Ninguna función tira.** Un llavero que no contesta es una respuesta
 *    válida y es la más restrictiva: `readSecureIdentity` devuelve `ok: false` y
 *    quien la consume no abre nada. Convertir eso en una excepción sólo movería
 *    la decisión a un `catch` lejos de la política.
 * 3. **Escribir es borrar y después escribir.** Si el proceso muere en el medio
 *    queda el registro vacío —que no abre nada— y nunca el dueño anterior, que
 *    abriría lo que no debe. Ver la secuencia fail-closed del dominio.
 *
 * La variante `.web.ts` hermana no importa nada de esto: en el navegador no hay
 * almacenamiento seguro y el bloque falla cerrado.
 */
import * as SecureStore from "expo-secure-store";

import {
  parseSecureIdentity,
  SECURE_IDENTITY_KEY,
  serializeSecureIdentity
} from "@/domain/secureIdentity";

/** Hay llavero nativo en esta plataforma. La web declara `false`. */
export const SECURE_IDENTITY_SUPPORTED = true;

export type SecureIdentityRead = {
  /** La lectura se pudo hacer. `false` = el llavero falló: no se abre nada. */
  ok: boolean;
  /** Dueño leído, o `null` si no había registro (o no se entendió). */
  owner: string | null;
};

export async function readSecureIdentity(): Promise<SecureIdentityRead> {
  try {
    const raw = await SecureStore.getItemAsync(SECURE_IDENTITY_KEY);
    return { ok: true, owner: parseSecureIdentity(raw) };
  } catch {
    return { ok: false, owner: null };
  }
}

/** `true` si el registro quedó escrito. `false` deja la identidad en nada. */
export async function writeSecureIdentity(owner: string): Promise<boolean> {
  try {
    // Borrar primero: ver la secuencia fail-closed del dominio.
    await SecureStore.deleteItemAsync(SECURE_IDENTITY_KEY);
    await SecureStore.setItemAsync(SECURE_IDENTITY_KEY, serializeSecureIdentity(owner));
    return true;
  } catch {
    return false;
  }
}

/** `true` si el registro quedó retirado. */
export async function clearSecureIdentity(): Promise<boolean> {
  try {
    await SecureStore.deleteItemAsync(SECURE_IDENTITY_KEY);
    return true;
  } catch {
    return false;
  }
}
