# `orbita-offer-codes`

Módulo local de Expo (autolinking desde `modules/`). Un solo puente: presentar
la **hoja de canje de códigos de oferta que Apple controla**.

## Qué NO hace

No lee, valida, transporta ni guarda el código — lo tipea la persona dentro de
la hoja de Apple. No concede acceso: el canje aterriza como transacción de
StoreKit, RevenueCat la convierte en `CustomerInfo` y el entitlement lo sigue
decidiendo Convex. No hay tabla de cupones, validador ni calculadora de
descuento en el cliente.

## Cómo se generó

Scaffold oficial, reducido después:

```bash
CI=1 npx create-expo-module@latest --local \
  --source <expo-module-template@57.0.9> \
  --name OrbitaOfferCodes --platform apple --features AsyncFunction \
  orbita-offer-codes
```

`--source` apunta a una copia intacta de la plantilla publicada porque
`create-expo-module` descarga una versión anterior en la que la plantilla del
podspec interpola `<%- repo %>` sin guarda, y `buildSubstitutionData` **no**
provee `repo` para módulos locales (devuelve `{project, type: "local"}`). Con la
plantilla publicada 57.0.9 —que ya envuelve esa línea en `if (type ===
'remote')`— el scaffold corre limpio.

Después del scaffold se retiraron: el stub web (`platforms` es sólo `apple`), el
placeholder de tipos vacío y el `LICENSE` de plantilla (módulo local, no
publicado). No se generó vista de ejemplo ni Android: los flags `--platform
apple --features AsyncFunction` ya los excluyen.

Cambios sobre el podspec generado: `:ios => '15.1'` en vez de `16.4` (es el piso
real de ExpoModulesCore en SDK 54 y el mínimo de la app), sin tvOS, más
`swift_version` y la descripción real.

## Qué API presenta la hoja

Dos, elegidas en **runtime** con `#available` — un solo binario cubre las dos
franjas:

| Versión | API | Notas |
| --- | --- | --- |
| iOS 16+ | `AppStore.presentOfferCodeRedeemSheet(in:)` | StoreKit 2, la API vigente. Es `async throws`: la promesa de JS resuelve cuando la presentación terminó y un fallo llega como error. Necesita una `UIWindowScene`. |
| iOS 15.1–15.x | `SKPaymentQueue.default().presentCodeRedemptionSheet()` | StoreKit 1. Presenta exactamente la misma hoja de Apple; no es un camino degradado. |

La escena de StoreKit 2 se busca entre `UIApplication.shared.connectedScenes`
y tiene que estar `.foregroundActive`. Si no hay ninguna, la llamada **rechaza**:
presentar sobre una escena que no está adelante no muestra nada, y resolver
igual le diría a la pantalla que la hoja se abrió cuando nadie la vio.

Las dos ramas corren en `@MainActor`, además del `.runOnQueue(.main)` del
módulo: UIKit y StoreKit lo exigen.

## Requiere un build nativo nuevo

El binario en TestFlight (build 28) se compiló antes de que este módulo
existiera. Ninguna OTA lo agrega: hace falta un build nativo. Por eso el lado JS
usa `requireOptionalNativeModule` y falla cerrado en vez de tirar al importar.
