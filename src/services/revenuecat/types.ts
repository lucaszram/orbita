import type { NativeStorePlan } from "@/domain/nativeCommerce";

export type RevenueCatPhase =
  | "waiting_for_session"
  | "configuring"
  | "loading_offering"
  | "ready"
  | "unavailable"
  | "no_offering"
  | "error";

export type RevenueCatActionResult = "active" | "inactive" | "cancelled";

export type RevenueCatContextValue = {
  phase: RevenueCatPhase;
  plans: readonly NativeStorePlan[];
  storeIsPro: boolean;
  identifiedUserId: string | null;
  /**
   * Identificador del Offering publicado, o null si no hay ninguno.
   *
   * Lo consume la pantalla del paywall para contar UNA impresión por vista,
   * dueño y oferta. Es un id opaco de RevenueCat: no es un product id ni entra
   * en ninguna decisión de cobro.
   */
  offeringId: string | null;
  purchase: (planId: string) => Promise<RevenueCatActionResult>;
  restore: () => Promise<Exclude<RevenueCatActionResult, "cancelled">>;
  presentCustomerCenter: () => Promise<void>;
  /**
   * Abre la hoja de canje de códigos de oferta de Apple.
   *
   * Resuelve cuando la hoja se presentó — NO cuando se canjeó algo. Apple no
   * informa el resultado del canje, así que la pantalla no puede leer esta
   * resolución como acceso concedido: espera al `CustomerInfo` y a Convex.
   */
  redeemOfferCode: () => Promise<void>;
  retry: () => Promise<void>;
  refreshCustomerInfo: () => Promise<boolean>;
  /**
   * Registra UNA impresión del paywall. Devuelve si REALMENTE se emitió.
   *
   * Se invoca desde la pantalla, no desde la carga del Offering: cargarlo pasa
   * en el arranque de cualquier sesión con la app en la Home, y contarlo como
   * impresión inflaba la métrica con vistas que nadie vio. Va serializada en la
   * cola del SDK y cercada por dueño y generación; si la cuenta cambió mientras
   * esperaba su turno, devuelve `false` y la pantalla no la da por contada.
   */
  trackPaywallImpression: () => Promise<boolean>;
};
