import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

/**
 * Capa de datos del front para Vínculos V4.9.2.
 *
 * Mismo criterio que `layersApi.ts`: el contrato ES el generado. `convex/_generated/api`
 * ya conoce `relationships.list`, `savePerson`, `removePerson`, `getComparison` y
 * `refreshComparison`, así que los argumentos y los resultados se derivan de ahí
 * y no de una copia paralela que se puede desincronizar. Si Codex cambia el
 * contrato, esto deja de compilar: es exactamente lo que queremos.
 *
 * Nada de enlaces sin tipo ni de conversiones forzadas: un `profileId` que llega
 * por deep link es un `string` de URL y sólo se convierte en un id autorizado
 * buscándolo en la lista real de la cuenta.
 *
 * Regla de la tanda: cero mocks. Ninguna pantalla de Vínculos rellena con datos
 * de maqueta; si el backend no tiene la comparación, la UI explica el límite.
 */
export const relationshipsApi = {
  /** Personas guardadas de la cuenta, ya normalizadas por el backend. Reactiva. */
  list: api.relationships.list,
  /** Alta o edición de una persona; devuelve el perfil persistido. */
  savePerson: api.relationships.savePerson,
  /** Baja de una persona y de las comparaciones que tenía cacheadas. */
  removePerson: api.relationships.removePerson,
  /** Última comparación persistida para una persona. Reactiva. */
  getComparison: api.relationships.getComparison,
  /** Recalcula la comparación contra el proveedor, la persiste y la devuelve. */
  refreshComparison: api.relationships.refreshComparison
} as const;

// ---------------------------------------------------------------------------
// Tipos derivados del contrato generado (no se declaran a mano)
// ---------------------------------------------------------------------------

export type RelationshipProfileList = FunctionReturnType<typeof api.relationships.list>;
/** Una persona guardada, con su `profileId` ya tipado como id de la tabla. */
export type RelationshipProfile = RelationshipProfileList[number];
export type RelationshipProfileId = RelationshipProfile["profileId"];
/** `sign_to_sign` · `date_to_date` · `chart_to_chart`, tal como los nombra el contrato. */
export type ComparisonLevel = RelationshipProfile["availableLevel"];
export type BirthTimePrecision = RelationshipProfile["birthTimePrecision"];

export type RelationshipComparisonResult = FunctionReturnType<
  typeof api.relationships.getComparison
>;
export type RelationshipComparisonData = NonNullable<RelationshipComparisonResult["data"]>;
/** Una de las cinco dimensiones reales: rótulo, resumen y contactos que la sostienen. */
export type RelationshipDimension = RelationshipComparisonData["dimensions"][number];

export type SavePersonArgs = FunctionArgs<typeof api.relationships.savePerson>;
export type RemovePersonArgs = FunctionArgs<typeof api.relationships.removePerson>;
export type GetComparisonArgs = FunctionArgs<typeof api.relationships.getComparison>;
export type RefreshComparisonArgs = FunctionArgs<typeof api.relationships.refreshComparison>;
