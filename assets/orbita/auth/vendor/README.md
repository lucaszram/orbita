# Marcas de proveedor del acceso — procedencia

Los tres archivos de este directorio son **originales de Apple y de Google, sin
editar**. No se redibujaron, no se re-exportaron y no se les cambió un color.
Están acá para que la marca que dibuja el acceso de Órbita tenga una fuente
verificable y para que cualquiera pueda comparar el vector contra el oficial.

Fecha de obtención: **2026-08-28** (los dos Apple **Large**) y **2026-08-27**
(Google). Los dos archivos de Apple salen del **mismo DMG** y se copiaron
**verbatim** desde el volumen oficial `/Volumes/Logo-Sign-in-with-Apple`, que
Lucas montó personalmente en su máquina, sin descarga adicional durante esta
pasada.

## Apple — dos archivos, uno por tono

Apple publica **un archivo por tono** y su guía no permite recolorear la
manzana: el logo negro es para el botón blanco y el logo blanco para el botón
negro. Por eso están los dos y `AppleMark` exige `tone`; ninguno se obtiene
tocándole el `fill` al otro.

Origen común de los dos:

| | |
|---|---|
| Origen | Apple Design Resources → "Sign in with Apple" (DMG `Logo-Sign-in-with-Apple.dmg`) |
| Descarga | <https://devimages-cdn.apple.com/design/resources/download/Logo-Sign-in-with-Apple.dmg> |
| Página | <https://developer.apple.com/design/resources/> |
| Guía | <https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple> |
| Volumen montado | `/Volumes/Logo-Sign-in-with-Apple` |

### `apple/Logo - SIWA - Left-aligned - Black - Large.svg`

| | |
|---|---|
| Ruta dentro del DMG | `Sign in with Apple - Left Aligned/SVG/Logo - SIWA - Left-aligned - Black - Large.svg` |
| SHA-256 | `038d2940e825dfb07101f6611f163b8954b9cf37b21bf2818e04b581b44442b1` |
| `viewBox` | `0 0 39 44` |
| `fill` del `<path>` | `#000000` |

Es el que dibuja el acceso: el botón de Apple de Órbita es **blanco**, así que
le corresponde la manzana negra. `tone="black"` en `AppleMark`.

### `apple/Logo - SIWA - Left-aligned - White - Large.svg`

| | |
|---|---|
| Ruta dentro del DMG | `Sign in with Apple - Left Aligned/SVG/Logo - SIWA - Left-aligned - White - Large.svg` |
| SHA-256 | `996d5f3d027eb0761da7b3e8a57921bf2205fca82b667070e7cb7edede4dd564` |
| `viewBox` | `0 0 39 44` |
| `fill` del `<path>` | `#FFFFFF` |

El tono para una superficie oscura. Hoy ninguna pantalla lo usa; queda como la
otra mitad oficial del par, y como la fuente de la que sale `tone="white"`.

### Lo que los dos comparten

`viewBox` `0 0 39 44`, el mismo `<path>` `d` carácter por carácter,
`fill-rule="nonzero"` y el canvas de 39x44 pt. Lo **único** que los distingue es
el color: el `<path>` y el `<rect>` de fondo están invertidos entre uno y otro.
La regresión compara los dos archivos entre sí y contra el componente.

### Por qué la variante Large y no la Medium

Apple publica el mismo dibujo en varias medidas dentro del DMG, todas con la
misma altura de canvas —44 pt— y distinto ancho. La primera pasada portó la
**Medium** (`0 0 31 44`), cuya manzana visible mide ~15.46 de ancho, y la
inspección en el simulador mostró que se leía notoriamente más chica que la G de
Google, que mide 20 visibles dentro de su canvas de 40. La **Large** es el mismo
vector oficial en la medida de al lado: canvas `0 0 39 44`, manzana visible de
~19.53 de ancho, que queda pareja con esos 20 en el mismo slot de 40x44.

El cambio fue de **archivo de origen**, no de dibujo: los Medium se eliminaron
de este directorio, los Large entraron byte por byte desde el DMG, y no se
escaló, deformó ni desplazó nada. El espacio libre alrededor del glifo es parte
del archivo, por eso el `viewBox` se conserva entero en vez de recortarse al
glifo.

## Google — `google/g_dk_sq_sl.svg`

| | |
|---|---|
| Origen | Google Identity — bundle oficial de branding `signin-assets.zip`, variante dark / square / standard logo |
| Descarga | <https://developers.google.com/static/identity/images/signin-assets.zip> |
| Guía | <https://developers.google.com/identity/branding-guidelines> |
| SHA-256 | `6f86c254e64569987684191e6669e2f96093b6d59ac9b2c35153e6f95a3c5d39` |
| `viewBox` | `0 0 40 40` |

La "G" de cuatro colores ocupa el recuadro `10,10 → 30,30` del `viewBox`; los
cuatro `<path>` llevan los hexadecimales exactos de Google (`#4285F4`,
`#34A853`, `#FBBC04`, `#E94235`). El archivo trae además un tile cuadrado —el
`<rect>` `#131314` de fondo y otro igual con borde `#8E918F`, radio 3.5— que es
el botón que Google publica, no la marca.

## Cómo se consumen

Los dibuja `src/components/brand/ProviderMarks.tsx` con `react-native-svg`,
copiando `viewBox`, `d` y los `fill` **verbatim** desde estos archivos (hay una
regresión que compara las tres cosas contra los SVG:
`test/authProviderBrandMarks.test.ts`).

Lo único que el componente NO dibuja es el **tile propio de cada archivo** —el
`<rect>` de fondo de Apple y el `<rect>` `#131314` con borde `#8E918F` de
Google—, porque ese rectángulo es el chrome del botón del proveedor y en Órbita
el botón ya existe: pastilla de 54 pt, radio 27, con su fondo y su contorno de
1 pt (blanca en Apple, oscura en Google). Portar además el tile de Google dejaba
un botón adentro del botón —un cuadrado oscuro con su propio contorno sobre la
pastilla, desparejo contra la manzana de al lado—. El archivo aporta la marca;
el shell de Órbita aporta la superficie.

Omitir el tile no recorta ni reescala nada: el componente conserva los canvas de
los archivos —Apple `0 0 39 44` a 44 pt de alto, Google `0 0 40 40` a 40 pt—,
así que la G se dibuja donde Google la dibuja (20x20 visibles dentro del canvas
de 40) y ese aire de 10 pt es el espacio libre de la guía. La geometría y los
colores del glifo quedan intactos.

Estos SVG no se importan como asset de Metro (no hay transformer de SVG en el
proyecto): son la **fuente de verdad** de los datos que viven en el componente y
lo que la regresión usa para verificarlos.
