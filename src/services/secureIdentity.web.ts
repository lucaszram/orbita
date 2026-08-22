/**
 * En web NO hay identidad previamente confirmada (QA23-007).
 *
 * `localStorage` y `sessionStorage` son legibles y escribibles por cualquier
 * script del origen, así que guardar ahí «el último dueño confirmado» no sería
 * una prueba de identidad: sería un valor que decide qué datos se muestran y que
 * cualquiera puede poner. Un mecanismo así es peor que no tener ninguno, porque
 * el resto del sistema lo trataría como prueba.
 *
 * Entonces la web falla cerrada, y lo hace sin fingir un error: la lectura
 * termina bien y no hay registro (`ok: true`, `owner: null`), y
 * `SECURE_IDENTITY_SUPPORTED = false` le dice a la política que por esta vía no
 * se abre nada. Sin un `userId` vivo de Clerk, el navegador conserva el gate — el
 * mismo comportamiento que tenía antes de este bloque.
 *
 * Este stub existe además para que el bundle web no arrastre `expo-secure-store`.
 */

export const SECURE_IDENTITY_SUPPORTED = false;

export type SecureIdentityRead = { ok: boolean; owner: string | null };

export async function readSecureIdentity(): Promise<SecureIdentityRead> {
  return { ok: true, owner: null };
}

/** No-op: en web no se escribe una identidad que después no se podría creer. */
export async function writeSecureIdentity(): Promise<boolean> {
  return true;
}

export async function clearSecureIdentity(): Promise<boolean> {
  return true;
}
