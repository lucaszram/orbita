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
 * ## Sólo `…WithAccess` (CORE-1043)
 *
 * La lista, el alta y la comparación van por las variantes que aplican la regla
 * Free/Plus EN EL SERVIDOR: `listWithAccess` devuelve las mismas personas más el
 * cupo (`access.atLimit`), `savePersonWithAccess` lo hace cumplir —crear con el
 * cupo Free lleno falla con `RELATIONSHIP_LIMIT_REACHED`— y la comparación llega
 * con los contactos que el plan muestra y `hiddenContacts` con los que faltan.
 * El front no cuenta personas ni contactos para decidir: una cuenta histórica
 * puede tener varias personas con plan Free y las conserva todas. Las versiones
 * sin sufijo siguen publicadas para el build ya instalado, pero este bundle no
 * las enlaza. Borrar no tiene variante: no la necesita.
 *
 * Regla de la tanda: cero mocks. Ninguna pantalla de Vínculos rellena con datos
 * de maqueta; si el backend no tiene la comparación, la UI explica el límite.
 */
export const relationshipsApi = {
  /** `{ profiles, access }`: las personas guardadas y el cupo del plan. Reactiva. */
  listWithAccess: api.relationships.listWithAccess,
  /**
   * Alta o edición de una persona; devuelve el perfil persistido. El alta que
   * excede el cupo Free se rechaza con `RELATIONSHIP_LIMIT_REACHED`.
   */
  savePersonWithAccess: api.relationships.savePersonWithAccess,
  /** Baja de una persona y de las comparaciones que tenía cacheadas. */
  removePerson: api.relationships.removePerson,
  /**
   * `{ access, hiddenContacts, comparison }`: la última comparación persistida,
   * con los contactos que el plan muestra. Reactiva.
   */
  getComparisonWithAccess: api.relationships.getComparisonWithAccess,
  /** Recalcula la comparación contra el proveedor, la persiste y la devuelve con el mismo corte. */
  refreshComparisonWithAccess: api.relationships.refreshComparisonWithAccess
} as const;

// ---------------------------------------------------------------------------
// Tipos derivados del contrato generado (no se declaran a mano)
// ---------------------------------------------------------------------------

/** Lo que publica `listWithAccess`: las personas y el cupo del plan. */
export type RelationshipListWithAccess = FunctionReturnType<
  typeof api.relationships.listWithAccess
>;
/** `{ isPro, limit, remaining, atLimit }`: Free `limit: 1`, Plus `limit: null`. */
export type RelationshipPersonAccess = RelationshipListWithAccess["access"];
export type RelationshipProfileList = RelationshipListWithAccess["profiles"];
/** Una persona guardada, con su `profileId` ya tipado como id de la tabla. */
export type RelationshipProfile = RelationshipProfileList[number];
export type RelationshipProfileId = RelationshipProfile["profileId"];
/** `sign_to_sign` · `date_to_date` · `chart_to_chart`, tal como los nombra el contrato. */
export type ComparisonLevel = RelationshipProfile["availableLevel"];
export type BirthTimePrecision = RelationshipProfile["birthTimePrecision"];

/**
 * Lo que publica `getComparisonWithAccess`: el sobre, cuántos contactos muestra
 * el plan (`access.contactLimit`, `null` con Plus) y cuántos quedaron afuera.
 */
export type RelationshipComparisonWithAccess = FunctionReturnType<
  typeof api.relationships.getComparisonWithAccess
>;
export type RelationshipComparisonResult = RelationshipComparisonWithAccess["comparison"];
export type RelationshipComparisonData = NonNullable<RelationshipComparisonResult["data"]>;
/** Una de las cinco dimensiones reales: rótulo, resumen y contactos que la sostienen. */
export type RelationshipDimension = RelationshipComparisonData["dimensions"][number];

export type SavePersonArgs = FunctionArgs<typeof api.relationships.savePersonWithAccess>;
export type RemovePersonArgs = FunctionArgs<typeof api.relationships.removePerson>;
export type GetComparisonArgs = FunctionArgs<typeof api.relationships.getComparisonWithAccess>;
export type RefreshComparisonArgs = FunctionArgs<
  typeof api.relationships.refreshComparisonWithAccess
>;
