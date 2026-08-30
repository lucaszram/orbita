import { NativeModule, requireOptionalNativeModule } from "expo";

declare class OrbitaOfferCodesModule extends NativeModule {
  /**
   * Presenta la hoja de canje de Apple. Resuelve cuando la presentación
   * terminó — NO cuando se canjeó un código. Apple no informa ese resultado.
   */
  presentOfferCodeRedemptionSheet(): Promise<void>;
}

/**
 * `requireOptionalNativeModule`, no `requireNativeModule`.
 *
 * La versión estricta tira en el momento del IMPORT, así que un binario sin
 * este módulo —el build 28, que se compiló antes de que existiera— rompería la
 * app entera al cargar el grafo de comercio, no al tocar el botón. La opcional
 * devuelve `null` y deja que la capa de servicio falle cerrado, con un error
 * nombrado, sólo si alguien realmente intenta canjear.
 */
export default requireOptionalNativeModule<OrbitaOfferCodesModule>("OrbitaOfferCodes");
