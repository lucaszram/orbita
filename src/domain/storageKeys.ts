/**
 * Claves de AsyncStorage de la app — módulo PURO (sin react-native) para que
 * los tests de node puedan razonar sobre qué borra cada flujo sin duplicar
 * strings. `storage.ts` y `firstRun.ts` consumen de acá; no redefinir claves
 * en otro lado.
 */
export const storageKeys = {
  profile: "orbita:profile",
  profileOwner: "orbita:profile-owner",
  savedReadings: "orbita:saved-readings",
  savedReadingTombstones: "orbita:saved-readings-tombstones",
  journal: "orbita:journal",
  /** Hitos de primera vez (ver services/firstRun.ts) — NO es data del usuario. */
  firstRun: "orbita:first-run"
} as const;

/** Prefijo de los snapshots por cuenta (logout sin pérdida). */
export const accountSnapshotKeyPrefix = "orbita:account-snapshot:";
