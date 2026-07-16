import type { DailyReading } from "./types";
import { MAX_SAVED_READINGS } from "./accountLocalData";

/**
 * Sync del archivo remoto de guardadas (`readings.listSaved` / `readings.unsave`).
 *
 * Reglas del contrato (PR #12, convex/CHANGELOG.md 2026-07-16):
 * - Lo local va primero; el remoto solo APORTA lo que falta. Un remoto vacío
 *   jamás borra lo local (una escritura offline puede existir solo acá).
 * - Dedupe por `readingPayload.id`; fallback fecha+carta (dos dispositivos
 *   pueden generar ids distintos para la misma lectura del mismo día).
 * - Un borrado local deja una lápida (tombstone) persistida: la lectura no
 *   vuelve a entrar por merge y el `unsave` remoto se reintenta hasta lograrse.
 *   Recién ahí la lápida se levanta (re-guardar después vuelve a ser posible).
 */

export type RemoteSavedReading = {
  savedReadingId: string;
  reading: DailyReading;
};

/** Las lápidas no crecen sin techo: 2 claves por lectura, mismo límite activo. */
export const MAX_TOMBSTONE_KEYS = MAX_SAVED_READINGS * 2;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * ¿El payload remoto alcanza para vivir en la lista local? Pedimos lo que la
 * pantalla de guardadas y el dedupe realmente usan; el resto viaja tal cual.
 * `tarotCard` puede faltar (payloads legados), pero si viene tiene que traer
 * un id real: una carta malformada rompería el dedupe fecha+carta.
 */
export function isDailyReadingPayload(value: unknown): value is DailyReading {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const reading = value as Partial<DailyReading> & { tarotCard?: unknown };
  if (reading.tarotCard != null) {
    const card = reading.tarotCard;
    if (typeof card !== "object" || Array.isArray(card)) return false;
    if (!isNonEmptyString((card as { id?: unknown }).id)) return false;
  }
  return (
    isNonEmptyString(reading.id) &&
    isNonEmptyString(reading.date) &&
    isNonEmptyString(reading.headline) &&
    isNonEmptyString(reading.dateLabel)
  );
}

/** Filtra filas de `readings.listSaved` a lecturas válidas (fila rara → se descarta). */
export function parseRemoteSavedReadings(rows: unknown): RemoteSavedReading[] {
  if (!Array.isArray(rows)) return [];
  const result: RemoteSavedReading[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const { savedReadingId, readingPayload } = row as {
      savedReadingId?: unknown;
      readingPayload?: unknown;
    };
    if (!isNonEmptyString(savedReadingId)) continue;
    if (!isDailyReadingPayload(readingPayload)) continue;
    result.push({
      savedReadingId,
      reading: { ...readingPayload, saved: true }
    });
  }
  return result;
}

/**
 * Claves de identidad de una lectura: id exacto + fecha+carta como fallback.
 * El fallback existe SOLO con carta real: sin `tarotCard.id`, una clave
 * `dc:fecha::` mezclaría lecturas parciales distintas del mismo día.
 */
export function readingMatchKeys(
  reading: Pick<DailyReading, "id" | "date"> & { tarotCard?: { id?: string } }
): string[] {
  const keys: string[] = [];
  if (isNonEmptyString(reading.id)) keys.push(`id:${reading.id}`);
  if (isNonEmptyString(reading.date) && isNonEmptyString(reading.tarotCard?.id)) {
    keys.push(`dc:${reading.date}::${reading.tarotCard.id}`);
  }
  return keys;
}

/**
 * Merge remoto→local: primero RECONCILIA lo local contra las lápidas (una
 * fila remota pudo entrar antes de que las lápidas de la cuenta se
 * restauraran, o el proceso pudo morir con lista-vieja + lápida: acá se
 * retira), después suma lo remoto que no esté repetido ni tenga lápida.
 * Un remoto vacío nunca borra nada que no tenga lápida. Orden final por
 * fecha descendente (estable: ante empate gana lo local). `changed=false`
 * cuando no hay nada que persistir.
 */
export function mergeRemoteSavedReadings(
  local: DailyReading[],
  remote: RemoteSavedReading[],
  tombstoneKeys: Iterable<string>
): { merged: DailyReading[]; changed: boolean } {
  const tombs = new Set(tombstoneKeys);
  const kept = local.filter((reading) => !readingMatchKeys(reading).some((key) => tombs.has(key)));
  const seen = new Set(kept.flatMap((reading) => readingMatchKeys(reading)));

  const additions: DailyReading[] = [];
  for (const { reading } of remote) {
    const keys = readingMatchKeys(reading);
    if (keys.some((key) => tombs.has(key) || seen.has(key))) continue;
    keys.forEach((key) => seen.add(key));
    additions.push(reading);
  }

  if (kept.length === local.length && additions.length === 0) {
    return { merged: local, changed: false };
  }

  const merged = [...kept, ...additions]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, MAX_SAVED_READINGS);
  return { merged, changed: true };
}

/**
 * Borrado coordinado (mismo patrón que `commitProfileCreation`): la intención
 * de borrado (lápida) se persiste ANTES de publicar y persistir la lista sin
 * la lectura. Si el proceso muere o hay logout en el medio, el peor estado
 * posible en disco es lista-vieja + lápida — que la reconciliación de
 * `mergeRemoteSavedReadings` retira — y NUNCA "sin lectura y sin lápida",
 * que dejaría al remoto resucitarla con el `unsave` todavía pendiente.
 */
export async function commitSavedReadingRemoval(ops: {
  /** Escribe las lápidas nuevas (la intención) en disco. */
  persistTombstones: () => Promise<void>;
  /** Publica lista + lápidas juntas en el estado (batch de React). */
  publishState: () => void;
  /** Escribe la lista sin la lectura en disco. */
  persistReadings: () => Promise<void>;
}): Promise<void> {
  await ops.persistTombstones();
  ops.publishState();
  await ops.persistReadings();
}

/** Filas remotas que una lápida marca para `unsave` (borrado pendiente). */
export function remoteRowsToUnsave(
  remote: RemoteSavedReading[],
  tombstoneKeys: Iterable<string>
): RemoteSavedReading[] {
  const tombs = new Set(tombstoneKeys);
  if (tombs.size === 0) return [];
  return remote.filter((row) => readingMatchKeys(row.reading).some((key) => tombs.has(key)));
}

/** Suma las claves de una lectura borrada, sin duplicar y con techo. */
export function addTombstoneKeys(tombstones: string[], keys: string[]): string[] {
  const next = [...keys.filter((key) => !tombstones.includes(key)), ...tombstones];
  return next.slice(0, MAX_TOMBSTONE_KEYS);
}

/** Levanta lápidas (unsave confirmado o re-guardado intencional). */
export function removeTombstoneKeys(tombstones: string[], keys: string[]): string[] {
  const resolved = new Set(keys);
  return tombstones.filter((key) => !resolved.has(key));
}
