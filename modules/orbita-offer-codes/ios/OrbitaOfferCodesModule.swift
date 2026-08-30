import ExpoModulesCore
import StoreKit
import UIKit

/**
 * Puente Apple para el canje de códigos de oferta.
 *
 * Lo único que hace es PRESENTAR la hoja que Apple controla. El código lo tipea
 * la persona ahí adentro: nunca viaja por JavaScript, no se lee, no se valida y
 * no se guarda. Este módulo tampoco concede acceso — el canje aterriza como una
 * transacción de StoreKit, RevenueCat la convierte en `CustomerInfo` y el
 * entitlement lo sigue decidiendo Convex.
 *
 * ## Dos APIs, un solo contrato
 *
 * - **iOS 16+ — `AppStore.presentOfferCodeRedeemSheet(in:)`.** Es la API vigente
 *   de StoreKit 2 y la que Apple documenta hoy. Es `async throws`, así que la
 *   promesa de JavaScript resuelve cuando la presentación TERMINÓ de verdad y
 *   un fallo de presentación llega como error en vez de perderse.
 * - **iOS 15.1 — `SKPaymentQueue.default().presentCodeRedemptionSheet()`.** El
 *   piso real de la app (el mismo que declara ExpoModulesCore en SDK 54) está
 *   por debajo de 16, así que la franja 15.1–15.x conserva la API de StoreKit 1.
 *   No es un camino degradado: presenta exactamente la misma hoja de Apple.
 *
 * La versión se decide en RUNTIME (`#available`), no en compilación: un mismo
 * binario cubre las dos franjas.
 *
 * ## Por qué falla cerrado sin escena
 *
 * StoreKit 2 exige la `UIWindowScene` sobre la que presentar. Se busca la que
 * está en primer plano (`.foregroundActive`); si no hay ninguna —la app quedó
 * en segundo plano entre el toque y la llamada— se RECHAZA. Presentar sobre una
 * escena que no está adelante no muestra nada, y resolver igual le diría a la
 * pantalla que la hoja se abrió cuando nadie la vio.
 *
 * ## Por qué falla cerrado fuera de iOS
 *
 * Ninguna de las dos APIs existe en tvOS, watchOS, macOS ni Mac Catalyst. La
 * guarda es de COMPILACIÓN (`#if os(iOS)`), que es el corte que de verdad puede
 * ocurrir, y es independiente del `#available` de arriba.
 */
public class OrbitaOfferCodesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OrbitaOfferCodes")

    // Presenta la hoja de canje. Resuelve cuando la PRESENTACIÓN terminó, que
    // no es lo mismo que "se canjeó un código": Apple no informa el resultado
    // del canje por este camino, y quien llama no puede inferirlo.
    AsyncFunction("presentOfferCodeRedemptionSheet") { (promise: Promise) in
      #if os(iOS) && !targetEnvironment(macCatalyst)
        // UIKit y StoreKit exigen el hilo principal. `.runOnQueue(.main)` ya
        // deja el cuerpo ahí; el `Task { @MainActor in }` lo vuelve a decir en
        // el sistema de tipos, que es lo que necesita el `await` de StoreKit 2
        // y lo que hace explícito el aislamiento del fallback.
        Task { @MainActor in
          if #available(iOS 16.0, *) {
            guard let scene = foregroundWindowScene() else {
              promise.reject(OfferCodeRedemptionNoSceneException())
              return
            }
            do {
              try await AppStore.presentOfferCodeRedeemSheet(in: scene)
              promise.resolve()
            } catch {
              promise.reject(OfferCodeRedemptionFailedException().causedBy(error))
            }
          } else {
            SKPaymentQueue.default().presentCodeRedemptionSheet()
            promise.resolve()
          }
        }
      #else
        promise.reject(OfferCodeRedemptionUnavailableException())
      #endif
    }
    .runOnQueue(.main)
  }
}

#if os(iOS) && !targetEnvironment(macCatalyst)
  /**
   * La escena de ventana que está EN PRIMER PLANO, o `nil`.
   *
   * `connectedScenes` incluye escenas de fondo e inactivas; presentar sobre una
   * de ésas no muestra la hoja. Sólo sirve `.foregroundActive`, y no hay
   * respaldo: si no está, la llamada se rechaza.
   */
  @MainActor
  private func foregroundWindowScene() -> UIWindowScene? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first { $0.activationState == .foregroundActive }
  }
#endif

internal final class OfferCodeRedemptionUnavailableException: Exception {
  override var reason: String {
    "El canje de códigos de oferta de Apple no está disponible en esta plataforma."
  }
}

internal final class OfferCodeRedemptionNoSceneException: Exception {
  override var reason: String {
    "No hay una ventana de Órbita en primer plano para presentar la hoja de canje."
  }
}

internal final class OfferCodeRedemptionFailedException: Exception {
  override var reason: String {
    "Apple no pudo presentar la hoja de canje de códigos de oferta."
  }
}
