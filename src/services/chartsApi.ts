import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

/**
 * Capa de datos del front para la Carta natal V4.9.2.
 *
 * Mismo criterio que `layersApi.ts` y `relationshipsApi.ts`: **el contrato ES el
 * generado**. `convex/_generated/api` conoce `charts.recoverNatalChart` porque
 * `fullApi` ya enumera el módulo `charts`, y `ApiFromModules` deriva de él sus
 * funciones: por eso una FUNCIÓN nueva dentro de un módulo ya enumerado aparece
 * sin regenerar nada, y de ahí salen sus argumentos y su desenlace.
 *
 * **Lo que sí exige codegen es un MÓDULO nuevo.** `fullApi` es una tabla que
 * escribe el codegen, archivo por archivo: sin su entrada no existen
 * `api.<módulo>` ni `internal.<módulo>`. Las pasadas anteriores dijeron acá que
 * "no hace falta regenerar nada" sin esa distinción, y era falso: el árbol tenía
 * módulos que el artifact no enumeraba.
 *
 * **Cerrado el 2026-08-18.** **Codex** corrió `pnpm convex:codegen --typecheck
 * disable` —el workflow del repo le reserva ese comando al backend— y el
 * artifact pasó a enumerar los módulos que faltaban, entre ellos
 * `lib/natalGeometry` y `lib/natalRevision`. `convex/_generated/**` no se editó
 * a mano. El gate (`test/convexGeneratedApiGate.test.ts`) quedó **7/7 en
 * verde**, y sigue vivo: el próximo módulo nuevo lo va a exigir igual.
 *
 * ## Por qué esta action no vive en `appRefs.ts`
 *
 * `appRefs` enlaza por `anyApi` y declara las firmas **a mano**: un patrón
 * heredado de cuando este árbol no consumía `convex/_generated/`. Una firma
 * escrita a mano no es un contrato: es una copia que se puede desincronizar en
 * silencio. Si el backend cambiara el `returns` de esta action —otro `status`,
 * otro `reason`— el cast seguiría compilando y el error aparecería recién en
 * runtime, sobre el botón de recuperación de la Carta.
 *
 * Con la referencia generada eso no puede pasar: un cambio de contrato del
 * backend **rompe el typecheck acá**, que es exactamente lo que queremos. No hay
 * `FunctionReference` escrito a mano, ni `anyApi`, ni `any`, ni casts.
 *
 * Las superficies legacy de `appRefs` no se migran en esta tanda; lo que no
 * puede volver a pasar es que una superficie NUEVA nazca con firma manual.
 */
export const chartsApi = {
  /**
   * Recupera la carta natal y dice CÓMO terminó.
   *
   * `recovered` significa una sola cosa: el read-model puede publicar la
   * geometría que estos datos natales permiten. `failed` deja la carta anterior
   * intacta y visible, con el reintento disponible. Rechaza cuando los datos
   * natales cambiaron mientras el proveedor calculaba: lo que volvió describe a
   * la persona natal anterior.
   */
  recoverNatalChart: api.charts.recoverNatalChart
} as const;

// ---------------------------------------------------------------------------
// Tipos derivados del contrato generado (no se declaran a mano)
// ---------------------------------------------------------------------------

/** El desenlace cerrado y discriminado de la recuperación. */
export type NatalRecoveryOutcome = FunctionReturnType<typeof api.charts.recoverNatalChart>;
/** De dónde salió la carta publicable: el cache que ya alcanzaba, o el proveedor. */
export type NatalRecoverySource = Extract<NatalRecoveryOutcome, { status: "recovered" }>["source"];
/** Por qué el intento no dejó nada publicable. */
export type NatalRecoveryFailure = Extract<NatalRecoveryOutcome, { status: "failed" }>["reason"];
