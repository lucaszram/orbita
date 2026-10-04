import {
  resolveEntitlement,
  type EntitlementContext,
  type ResolvedEntitlement,
  type SubscriptionRow
} from "./entitlements";
import { v, type Infer } from "convex/values";
import {
  layerBundleValidator,
  relationshipComparisonResultValidator,
  transitArcResultValidator,
  type AnalysisResult,
  type LayerBundle,
  type RelationshipComparisonResult,
  type TransitRankingResult,
} from "./layerContract";
import { isRevenueCatEnvironmentAllowed } from "./revenueCatEvents";
import { FREE_CONTACT_LIMIT } from "./synastry";

/**
 * Contexto de resolución del deployment.
 *
 * Se calcula acá, en un único lugar, para que todos los consumidores del
 * entitlement usen el mismo criterio en vez de repetirlo (o de olvidarlo, que
 * era el defecto).
 *
 * Los DOS entornos se autorizan explícitamente y con la misma función que usa
 * el webhook, así que el corte es idéntico venga por donde venga:
 *
 * - `development` acepta Sandbox y **no** Production;
 * - `production` acepta Production y Sandbox, de cualquier cuenta (CORE-1043:
 *   sin allowlist de review, ver `isRevenueCatEnvironmentAllowed`);
 * - un deployment sin entorno declarado (`unknown`) no acepta **ninguna** fila.
 *
 * El corte ya no depende de la identidad: es el mismo para todas las cuentas.
 */
export function entitlementContextFor(
  env: Record<string, string | undefined> = process.env
): EntitlementContext {
  return {
    sandboxAllowed: isRevenueCatEnvironmentAllowed("sandbox", { env }),
    productionAllowed: isRevenueCatEnvironmentAllowed("production", { env })
  };
}

/**
 * Resolución canónica a partir de las filas de un usuario, con el corte de
 * entorno de ESTE deployment.
 */
export function resolveRowsForUser(
  rows: SubscriptionRow[],
  now: number = Date.now(),
  env: Record<string, string | undefined> = process.env
): ResolvedEntitlement {
  return resolveEntitlement(rows, now, entitlementContextFor(env));
}

export async function isUserPro(
  ctx: { db: any },
  userId: string
): Promise<boolean> {
  const rows = (await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect()) as SubscriptionRow[];
  return resolveRowsForUser(rows).isPro;
}

// ---------------------------------------------------------------------------
// Qué abre cada plan en la app nativa (CORE-1043)
// ---------------------------------------------------------------------------

/**
 * La regla Free/Plus de la app nativa, aplicada EN EL SERVIDOR (CORE-1043).
 *
 * Es la misma regla que ya aplica la web, función por función:
 *
 * | Sección                         | Free                    | Plus     |
 * | ------------------------------- | ----------------------- | -------- |
 * | Hoy                             | abierto                 | abierto  |
 * | Tránsitos (panorama y arco)     | bloqueado               | abierto  |
 * | Tu momento (estación, año,      | bloqueado               | abierto  |
 * |   cuatro ritmos y sus capas)    |                         |          |
 * | Vínculos                        | 1 persona, 3 contactos  | sin tope |
 *
 * La app nativa lee TODO eso de un solo sobre (`layers.getForDate`), que
 * alimenta a la vez Hoy, Tránsitos y Tu momento. Por eso el corte se define acá
 * capa por capa, y no pantalla por pantalla:
 *
 * - **Hoy (abierto):** `today.moonOnChart`, `today.cumpleluna` y los primeros
 *   `FREE_HOY_TRANSIT_LIMIT` contactos de `today.transitRanking` —el titular de
 *   «Lo principal hoy» y las tres filas que dibuja la pantalla—. Es el mismo
 *   alcance que la web deja abierto: la Luna sobre la carta, el Cumpleluna y el
 *   ranking corto de la guía diaria. `activeCount` y `summary` no se recortan:
 *   son conteos, igual que `hiddenContacts` en la comparación.
 * - **Tránsitos (Plus):** el resto de `today.transitRanking` (el panorama) y
 *   `today.transitArc` (la línea de tiempo del arco), más cualquier arco pedido
 *   por `arcId`.
 * - **Tu momento (Plus):** `moment.progressedLunation` (estación vital),
 *   `moment.annualProfection` (tema del año) y `moment.temporalMandala` (cuatro
 *   ritmos). La línea «CONTEXTO · TU AÑO DE…» de Hoy sale de la profección: en
 *   Free no viaja, igual que en la web, donde `momento.getTemaDelAno` responde
 *   `locked`.
 * - **Natal (abierto):** `natal.lunarType`, `natal.elementMap` y
 *   `natal.relationshipPattern` no dependen del día y la regla no los nombra;
 *   quedan como en `layers.getNatalBase`.
 *
 * Una capa bloqueada conserva la FORMA del sobre —para que el cliente no tenga
 * que tipar dos contratos— pero viaja sin `data`, con `status: "unavailable"` y
 * `missingInputs: ["orbita_plus"]`. El cliente no adivina: `access` lo dice.
 */

/** Marca de una capa cerrada por plan dentro de `missingInputs`. */
export const PLUS_REQUIRED_INPUT = "orbita_plus";
export const PLUS_REQUIRED_LIMITATION = "Esta capa está disponible con Órbita Plus.";

/** Cuántos contactos del ranking quedan abiertos en Hoy para Free. */
export const FREE_HOY_TRANSIT_LIMIT = 3;

const sectionAccessValidator = v.union(v.literal("open"), v.literal("locked"));

export const layerAccessValidator = v.object({
  isPro: v.boolean(),
  /** Hoy es abierto para todos; se publica para que la tabla esté completa. */
  hoy: v.literal("open"),
  transitos: sectionAccessValidator,
  momento: sectionAccessValidator,
});

export const layerBundleWithAccessValidator = v.object({
  access: layerAccessValidator,
  bundle: layerBundleValidator,
});

export const transitArcWithAccessValidator = v.union(
  v.object({
    status: v.literal("locked"),
    access: v.object({ isPro: v.literal(false) }),
  }),
  v.object({
    status: v.literal("ready"),
    access: v.object({ isPro: v.literal(true) }),
    arc: transitArcResultValidator,
  }),
);

export const relationshipComparisonWithAccessValidator = v.object({
  access: v.object({
    isPro: v.boolean(),
    /** `null` sin tope. */
    contactLimit: v.union(v.number(), v.null()),
  }),
  /** Cuántos contactos de la comparación no viajan por el plan. */
  hiddenContacts: v.number(),
  comparison: relationshipComparisonResultValidator,
});

export type LayerAccess = Infer<typeof layerAccessValidator>;
export type LayerBundleWithAccess = Infer<typeof layerBundleWithAccessValidator>;
export type TransitArcWithAccess = Infer<typeof transitArcWithAccessValidator>;
export type RelationshipComparisonWithAccess = Infer<
  typeof relationshipComparisonWithAccessValidator
>;

export function layerAccess(isPro: boolean): LayerAccess {
  return {
    isPro,
    hoy: "open",
    transitos: isPro ? "open" : "locked",
    momento: isPro ? "open" : "locked",
  };
}

/**
 * El mismo sobre, cerrado por plan: conserva la identidad del análisis (id,
 * versión de método, hash, fuentes) y no lleva NADA calculado. Ni el dato, ni
 * las limitaciones del cálculo, ni la versión del proveedor: una limitación
 * puede nombrar el contacto que el plan no abre.
 */
function lockedLayer<T extends AnalysisResult>(envelope: T): T {
  const { providerVersion: _providerVersion, ...identity } = envelope;
  return {
    ...identity,
    status: "unavailable",
    precision: "not_applicable",
    validUntil: null,
    data: null,
    missingInputs: [PLUS_REQUIRED_INPUT],
    limitations: [PLUS_REQUIRED_LIMITATION],
  } as T;
}

/** El ranking que Hoy dibuja: los primeros contactos, en el orden del backend. */
function hoyTransitRanking(ranking: TransitRankingResult): TransitRankingResult {
  if (!ranking.data || ranking.data.items.length <= FREE_HOY_TRANSIT_LIMIT) return ranking;
  return {
    ...ranking,
    data: { ...ranking.data, items: ranking.data.items.slice(0, FREE_HOY_TRANSIT_LIMIT) },
  };
}

/**
 * Aplica la regla al sobre del día. Plus recibe el sobre intacto —la misma
 * referencia, sin copia—; Free recibe Hoy y lo natal, y sobres cerrados para
 * Tránsitos y Tu momento. Es pura: el plan se resuelve afuera, con
 * `isUserPro`, y acá sólo se decide qué viaja.
 */
export function layerBundleForPlan(bundle: LayerBundle, isPro: boolean): LayerBundleWithAccess {
  const access = layerAccess(isPro);
  if (isPro) return { access, bundle };
  return {
    access,
    bundle: {
      natal: bundle.natal,
      today: {
        transitRanking: hoyTransitRanking(bundle.today.transitRanking),
        transitArc: lockedLayer(bundle.today.transitArc),
        moonOnChart: bundle.today.moonOnChart,
        cumpleluna: bundle.today.cumpleluna,
      },
      moment: {
        progressedLunation: lockedLayer(bundle.moment.progressedLunation),
        annualProfection: lockedLayer(bundle.moment.annualProfection),
        temporalMandala: lockedLayer(bundle.moment.temporalMandala),
      },
    },
  };
}

type ComparisonDimension = NonNullable<RelationshipComparisonResult["data"]>["dimensions"][number];

/**
 * Los contactos únicos de una comparación, del que más pesa al que menos.
 *
 * La identidad es el `id` de `driverDetails` (qué toca a qué); el mismo
 * contacto puede sostener más de una dimensión y cuenta UNA vez, con su peso
 * más alto. Un sobre anterior a `driverDetails` sólo trae la oración: ahí la
 * identidad es el texto y el orden es el de aparición, que es el que el motor
 * ya publicaba por peso dentro de cada dimensión.
 */
function rankedComparisonContacts(dimensions: readonly ComparisonDimension[]) {
  const contacts = new Map<string, { weight: number; order: number }>();
  let order = 0;
  for (const dimension of dimensions) {
    const entries = dimension.driverDetails
      ? dimension.driverDetails.map((detail) => ({ id: detail.id, weight: detail.weight }))
      : dimension.drivers.map((text) => ({ id: text, weight: 0 }));
    for (const entry of entries) {
      const seen = contacts.get(entry.id);
      if (!seen) {
        contacts.set(entry.id, { weight: entry.weight, order });
        order += 1;
      } else if (entry.weight > seen.weight) {
        seen.weight = entry.weight;
      }
    }
  }
  return Array.from(contacts.entries())
    .sort(([, left], [, right]) => right.weight - left.weight || left.order - right.order)
    .map(([id]) => id);
}

/**
 * La comparación de Vínculos con el tope de contactos del plan.
 *
 * Misma regla que `relationships.synastry` en la web, con las mismas
 * constantes (`FREE_CONTACT_LIMIT`): en Free viajan los tres contactos que más
 * pesan y `hiddenContacts` dice cuántos faltan. Los valores y los resúmenes de
 * cada dimensión no se recortan —se calcularon sobre la lista entera, igual
 * que los conteos de la web—; lo que no viaja es la evidencia de los contactos
 * ocultos: ni su oración en `drivers` ni su entrada en `driverDetails`.
 *
 * La comparación sólo por signo (`generalOnly`) no tiene contactos entre
 * planetas: es la lectura de tono que la web deja abierta, y no se recorta.
 */
export function relationshipComparisonForPlan(
  comparison: RelationshipComparisonResult,
  isPro: boolean,
): RelationshipComparisonWithAccess {
  const access = { isPro, contactLimit: isPro ? null : FREE_CONTACT_LIMIT };
  const data = comparison.data;
  if (isPro || !data || data.generalOnly) {
    return { access, hiddenContacts: 0, comparison };
  }
  const ranked = rankedComparisonContacts(data.dimensions);
  if (ranked.length <= FREE_CONTACT_LIMIT) {
    return { access, hiddenContacts: 0, comparison };
  }
  const visible = new Set(ranked.slice(0, FREE_CONTACT_LIMIT));
  const dimensions = data.dimensions.map((dimension) => {
    if (!dimension.driverDetails) {
      return { ...dimension, drivers: dimension.drivers.filter((text) => visible.has(text)) };
    }
    const driverDetails = dimension.driverDetails.filter((detail) => visible.has(detail.id));
    const visibleTexts = new Set(driverDetails.map((detail) => detail.text));
    return {
      ...dimension,
      drivers: dimension.drivers.filter((text) => visibleTexts.has(text)),
      driverDetails,
    };
  });
  return {
    access,
    hiddenContacts: ranked.length - FREE_CONTACT_LIMIT,
    comparison: { ...comparison, data: { ...data, dimensions } },
  };
}
