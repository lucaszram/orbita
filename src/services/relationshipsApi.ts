import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

/**
 * Capa de datos del front para Vínculos V4.9.2.
 *
 * Mismo criterio que `layersApi.ts`: el contrato ES el generado. `convex/_generated/api`
 * ya conoce estas funciones, así que los argumentos y los resultados se derivan
 * de ahí y no de una copia paralela que se puede desincronizar. Si Codex cambia
 * el contrato, esto deja de compilar: es exactamente lo que queremos.
 *
 * Nada de enlaces sin tipo ni de conversiones forzadas: un `profileId` que llega
 * por deep link es un `string` de URL y sólo se convierte en un id autorizado
 * buscándolo en la lista real de la cuenta.
 *
 * ## La lista y el alta van por `…WithAccess` (build 30)
 *
 * `listWithAccess` devuelve las MISMAS personas más el cupo resuelto en el
 * servidor (`currentCount`, `limit`, `canCreate`), y `savePersonWithAccess` lo
 * hace cumplir: con Free y el cupo tomado rechaza con `RELATIONSHIP_PLUS_REQUIRED`.
 * El front no cuenta personas para decidir —una cuenta histórica puede tener
 * varias con plan Free y las conserva todas—, sólo lee `canCreate`. Las claves
 * espejan el nombre real de cada función para que leer un `useQuery` alcance
 * para saber qué endpoint se pide.
 *
 * Editar, borrar y comparar no cambian: siguen abiertas para todas las personas
 * que la cuenta ya tiene.
 *
 * Regla de la tanda: cero mocks. Ninguna pantalla de Vínculos rellena con datos
 * de maqueta; si el backend no tiene la comparación, la UI explica el límite.
 */
export const relationshipsApi = {
  /**
   * Personas guardadas de la cuenta y su cupo, ya resueltos por el backend.
   * Reactiva.
   */
  listWithAccess: api.relationships.listWithAccess,
  /**
   * Alta o edición de una persona; devuelve el perfil persistido. El alta que
   * excede el cupo Free se rechaza con `RELATIONSHIP_PLUS_REQUIRED`.
   */
  savePersonWithAccess: api.relationships.savePersonWithAccess,
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

/**
 * La lista autorizada con su cupo: `profiles`, `currentCount`, `limit` (`null`
 * con Plus) y `canCreate`. Es lo único que decide si se puede agregar a alguien.
 */
export type RelationshipAccess = FunctionReturnType<typeof api.relationships.listWithAccess>;
export type RelationshipProfileList = RelationshipAccess["profiles"];
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

export type SavePersonArgs = FunctionArgs<typeof api.relationships.savePersonWithAccess>;
export type RemovePersonArgs = FunctionArgs<typeof api.relationships.removePerson>;
export type GetComparisonArgs = FunctionArgs<typeof api.relationships.getComparison>;
export type RefreshComparisonArgs = FunctionArgs<typeof api.relationships.refreshComparison>;
