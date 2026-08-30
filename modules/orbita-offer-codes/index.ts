import OrbitaOfferCodesModule from "./src/OrbitaOfferCodesModule";

/** El build no incluye el módulo nativo (binario viejo, o plataforma sin Apple). */
export const OFFER_CODE_MODULE_UNAVAILABLE = "ORBITA_OFFER_CODE_MODULE_UNAVAILABLE";

/** ¿Este binario trae el puente nativo? */
export function offerCodeRedemptionAvailable(): boolean {
  return OrbitaOfferCodesModule !== null;
}

/**
 * Abre la hoja de canje de códigos de oferta que Apple controla.
 *
 * Resuelve cuando la hoja terminó de presentarse. Eso NO significa que se haya
 * canjeado nada: Apple no devuelve el resultado del canje por este camino, así
 * que quien llama no puede tratar la resolución como un éxito comercial.
 *
 * RECHAZA cuando la hoja no se pudo presentar: sin el módulo nativo en el
 * binario, sin una ventana en primer plano (iOS 16+ necesita la `UIWindowScene`)
 * o si Apple falla la presentación. Un rechazo es "no se abrió nada", nunca "se
 * canjeó y salió mal".
 */
export async function presentOfferCodeRedemptionSheet(): Promise<void> {
  if (!OrbitaOfferCodesModule) throw new Error(OFFER_CODE_MODULE_UNAVAILABLE);
  await OrbitaOfferCodesModule.presentOfferCodeRedemptionSheet();
}
