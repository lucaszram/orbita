# iOS: `expo-haptics` dispara una colisión de UUID con Clerk SPM

**Estado:** causa confirmada con una prueba A/B controlada. El arreglo de producto es retirar
`expo-haptics` y conservar el flip visual sin golpe háptico.

**Fecha:** 2026-07-13 · Xcode 26.6 (17F113) · CocoaPods 1.17.0 · Expo SDK 54 · RN 0.81

## Corrección de conclusiones anteriores

La versión anterior de este documento decía dos cosas incorrectas:

- que el problema era solo local y EAS funcionaba;
- que los builds de TestFlight nunca se habían visto afectados.

El build de EAS también falló con el mismo proyecto de Pods dañado. Además, TestFlight había
compilado correctamente pocos días antes. El cambio relevante entre ambos estados fue la adición
de `expo-haptics`.

## Síntoma engañoso

El build muestra:

```text
ios/rbita/AppDelegate.swift:1:8: error: no such module 'Expo'
```

`Expo` no es la causa. El proyecto `Pods.xcodeproj` queda sin su objeto raíz `PBXProject`, Xcode
omite las dependencias y después falla al importar Expo.

La comprobación directa es:

```bash
grep -c "isa = PBXProject" ios/Pods/Pods.xcodeproj/project.pbxproj
```

Un proyecto válido devuelve `1`; el estado roto devuelve `0`.

## Prueba A/B decisiva

Se tomó una copia temporal del mismo estado del repo. La única variable fue la presencia de
`expo-haptics` en `package.json` y su import/llamada en `CartaDelDia.tsx`. En ambos casos se corrió
`expo prebuild --clean --platform ios --no-install` y después `pod install`.

### A. Sin `expo-haptics`

- `ExpoHaptics` no apareció en autolinking.
- CocoaPods instaló 99 dependencias del Podfile / 108 pods totales.
- El paquete SPM de Clerk recibió UUID `46EB2E0002BA30`.
- `grep -c "isa = PBXProject" ...` devolvió **`1`**.
- `rootObject = 46EB2E00000000` volvió a apuntar a `Project object`.

### B. Con `expo-haptics@15.0.8`

- CocoaPods instaló `ExpoHaptics`.
- CocoaPods instaló 100 dependencias del Podfile / 109 pods totales.
- El paquete SPM de Clerk recibió UUID `46EB2E0002BBE0`.
- `grep -c "isa = PBXProject" ...` devolvió **`0`**.
- El archivo conservó `rootObject = 46EB2E00000000`, pero no serializó ningún `PBXProject`.

## Causa precisa

`ClerkExpo` declara `ClerkKit` y `ClerkKitUI` como paquetes Swift. CocoaPods/xcodeproj les asigna
UUID determinísticos dentro del mismo espacio usado por el proyecto. Agregar `ExpoHaptics` cambia
el conjunto y el orden de Pods; eso desplaza la asignación y hace que un objeto SPM de Clerk
colisione con el UUID del `PBXProject`.

`expo-haptics` no contiene el bug de serialización, pero sí es el disparador reproducible en este
grafo de dependencias. Clerk SPM + CocoaPods/xcodeproj forman la condición estructural.

## Arreglo elegido

1. Quitar el import de `expo-haptics` y la llamada `Haptics.impactAsync(...)` de
   `src/components/home/CartaDelDia.tsx`.
2. Quitar `expo-haptics` de `package.json` y regenerar `pnpm-lock.yaml`.
3. Mantener intactos la respiración, el flip 3D y la cascada de beats.
4. Regenerar iOS y verificar que el conteo de `PBXProject` sea `1` antes de compilar.

No reintroducir `plugins/withClerkSpmUuidFix.js`: fue probado y no resuelve la colisión.

## Alcance de la verificación

La retirada conjunta ya fue aplicada al árbol final: no quedan la dependencia, el import ni la
llamada háptica. `pnpm typecheck`, los 58 tests y el export web pasan; `expo prebuild --clean
--platform ios --no-install` también termina sin autolinkear `ExpoHaptics`.

La integridad de `Pods.xcodeproj` quedó demostrada por el A/B completo (`PBXProject = 1`) sobre el
mismo árbol sin Haptics. Un `pod install` redundante sobre el `ios/` regenerado se interrumpió
durante una descarga de Hermes extremadamente lenta, por lo que esa segunda copia no llegó a la
serialización final ni se usó para afirmar un build completo de Xcode.
