# Assets Needed - Órbita

## Reglas generales

- Formato principal: `1:1`, `2048x2048`.
- Estilo: dark editorial premium, negro/charcoal, luz suave, acentos cobre.
- Composicion: sujeto centrado, ocupa 70-80% del canvas.
- Debe funcionar con `FILL` en Figma, no `FIT`.
- Sin texto, labels, logos, UI, emojis, phone mockups, marcos blancos, poster frames ni sidebars borrosos.
- Si el resultado parece un 9:16 metido dentro de un square, no usarlo.

## Slots vigentes

- `02 / Align With Universe`: 4 tiles visuales.
  - `Influencia lunar`
  - `Guía personal`
  - `Práctica diaria`
  - `Decisiones`
- `04 / Daily Guidance`: imagen interna opcional del telefono, `9:16`, `1080x1920`.
- `12 / Personalizing`: visual dark de calculo/orbita/carta natal.
- `13 / Before After / Órbita`: dos simbolos circulares chicos, no avatars falsos.
- `15 / Onboarding Payment / Scroll`: hero dark full-bleed para pago.

## App Core / Home V1.1

Pagina Figma: `UX V4.6 - Órbita Asset Library`.

Objetivo: armar una libreria inicial de assets propios para Home y pantallas core. Co-Star se usa solo como referencia de ritmo, jerarquia y composicion; no se copian assets.

Archivos fuente generados:

| Slot | Archivo | Uso | Estado |
| --- | --- | --- | --- |
| Home hero orbital A | `assets/orbita/core/orbita_home_hero_orbital_a.png` | opcion hero alternativa | cargado en V4.6 |
| Home hero orbital B | `assets/orbita/core/orbita_home_hero_orbital_b.png` | hero de `Home V1.1 / Top` | seleccionado |
| Daily texture A | `assets/orbita/core/orbita_daily_texture_a.png` | opcion textura/diagrama | cargado en V4.6 |
| Daily texture B | `assets/orbita/core/orbita_daily_texture_b.png` | textura de `Home V1.1 / Daily Guide` | seleccionado |
| Long read thumbnail A | `assets/orbita/core/orbita_long_read_thumbnail_a.png` | thumbnail de `Home V1.1 / End` | seleccionado |
| Carta natal diagram A | `assets/orbita/core/orbita_carta_natal_diagram_a.png` | futura pantalla `Carta` | cargado en V4.6 |
| Tránsitos visual A | `assets/orbita/core/orbita_transitos_visual_a.png` | futura pantalla `Tránsitos` | cargado en V4.6 |
| Vínculo symbol A | `assets/orbita/core/orbita_vinculo_symbol_a.png` | futura pantalla `Vínculo` | cargado en V4.6 |

Slots Figma:

- `asset-slot/orbita_home_hero_orbital_b`
- `asset-slot/orbita_daily_texture_b`
- `asset-slot/orbita_long_read_thumbnail_a`
- `asset-preview/orbita_home_hero_orbital_a`
- `asset-preview/orbita_home_hero_orbital_b`
- `asset-preview/orbita_daily_texture_a`
- `asset-preview/orbita_daily_texture_b`
- `asset-preview/orbita_long_read_thumbnail_a`
- `asset-preview/orbita_carta_natal_diagram_a`
- `asset-preview/orbita_transitos_visual_a`
- `asset-preview/orbita_vinculo_symbol_a`

Prompts base por slot:

```text
Home hero orbital: Square 1:1 image, 2048x2048. Dark editorial orbital body for a premium astrology app called Órbita. A single celestial object or eclipse-like body centered, black charcoal space, subtle copper orbital lines, cinematic grain, expensive minimal composition, enough negative space for mobile copy nearby. No text, no zodiac wheel cliches, no UI, no logos.
```

```text
Daily texture: Square 1:1 image, 2048x2048. Abstract astral texture for a daily guidance module, dark charcoal background, faint orbital interference, copper dust, layered chart-like geometry, quiet and atmospheric, works cropped as a wide mobile band. No text, no labels, no interface, no poster frame.
```

```text
Topic symbols: Square 1:1 image, 2048x2048. Small symbolic visual for one life area in Órbita, dark premium editorial, centered object, subtle copper highlight, simple silhouette readable at small size, no text, no logos, no generic zodiac icons.
```

```text
Long read thumbnail: Square 1:1 image, 2048x2048. Editorial astrology thumbnail, dark paper/stone/celestial texture, horizontal-croppable composition, refined monochrome with subtle copper, subject centered, no text, no UI, no stock-photo feeling.
```

```text
Carta natal diagram / Tránsitos / Vínculo: Square 1:1 image, 2048x2048. Abstract orbital diagram for astrology product UI, dark premium, thin copper and bone-white lines, central composition, sophisticated chart geometry, no text, no labels, no fake data, no generic zodiac wheel clipart.
```

Criterios de aceptacion:

- Funciona con crop `FILL` en rectangulos mobile sin tapar texto.
- Se lee como asset editorial propio, no como poster ni stock.
- No contiene texto, marcas, UI, logos, ni simbolos zodiacales genericos.
- Mantiene dark premium con cobre sutil y suficiente aire.

Criterios de rechazo:

- Parece un poster vertical recortado dentro de square.
- Trae texto, etiquetas, UI, logos o marcas inventadas.
- Es demasiado literal, mistico generico o copia composicion/asset de Co-Star.
- No mejora la pantalla o compite con el copy editable.

## Higgsfield Archive 7 / Intake

Fuente cruda: `/Users/lucas/Downloads/archive (7)/`.

Biblioteca local:

- `assets/orbita/higgsfield/archive-7/inbox/`
- `assets/orbita/higgsfield/archive-7/selected/onboarding/`
- `assets/orbita/higgsfield/archive-7/selected/home/`
- `assets/orbita/higgsfield/archive-7/rejected/`
- `assets/orbita/higgsfield/archive-7/contact-sheets/`
- `assets/orbita/higgsfield/archive-7/manifest.json`
- `assets/orbita/higgsfield/archive-7/manifest.csv`

Estado del intake:

- Total copiado a inbox: `83` PNGs, sin renombrar.
- Copias seleccionadas para onboarding: `57`.
- Copias seleccionadas para home: `15`.
- Copias en `rejected/`: `28`.
- Orden de indices: nombre de archivo ordenado alfabeticamente, base `01-83`.
- Dimensiones detectadas: `1856x2304`.
- Modo detectado: `RGB`.
- Alpha real detectado: `0/83`.
- Importante: son PNGs, pero no son recortes transparentes reales. Hay que tratarlos como fondos/visuales integrados con crop, mascara o mezcla de layout; no como stickers limpios.

Seleccion inicial por uso:

- Onboarding `01 Logo`: `04, 08, 12`. `01` queda rechazado por checkerboard horneado.
- Onboarding `02 Benefits`: lunar `04, 08, 68`; guia `22, 27, 41`; practica `17, 38, 39`; decisiones `13, 14, 16, 65`.
- Onboarding `03 Identify`: `21, 22, 27`.
- Onboarding `04 Daily Guidance`: bases `20, 21, 22`; backplates `61, 62, 65, 66`.
- Onboarding `05-10 Datos natales`: `34, 35, 36, 38, 39, 40, 41, 77, 83`. `32` y `33` quedan rechazados por checkerboard horneado.
- Onboarding `11 Base Chart`: `44, 45, 46, 47`.
- Onboarding `12 Personalizing`: `51, 55, 71, 72, 73, 74, 82`.
- Onboarding `13 Before/After`: `53, 81`.
- Onboarding `14 Account`: `58, 59`.
- Onboarding `15 Payment`: `61, 62, 66, 69, 79, 80, 83`.
- Home `Top`: `62, 66, 68, 69, 83`.
- Home `Daily`: `65, 71, 72, 73, 74, 82`.
- Home `End`: `79, 80, 83, 61`.
- Home `Topics`: no hay simbolos finales buenos. `75, 76, 78` quedan como referencia visual solamente, rechazados como asset final.

Descartes iniciales:

- Rechazados obvios: `02, 03, 05, 06, 09, 10, 15, 23, 24, 25, 28, 29, 30, 37, 49, 52, 56, 57, 63, 64, 67, 70`.
- Rechazados despues de revision visual por checkerboard horneado: `01, 32, 33`.
- Referencia, no final: `75, 76, 78`.

Criterios usados para rechazar:

- Texto horneado, por ejemplo `HEADLINE`.
- UI, phone mockup, card ya disenada o borde blanco.
- Checkerboard horneado que simula transparencia pero no tiene alpha real.
- Glyph zodiacal literal o simbolo demasiado generico.
- Imagen que funciona como poster aislado, no como parte del layout.

Contact sheets utiles:

- `contact-sheets/selected-onboarding-01.jpg`
- `contact-sheets/selected-onboarding-02.jpg`
- `contact-sheets/selected-onboarding-03.jpg`
- `contact-sheets/selected-home-01.jpg`
- `contact-sheets/rejected-obvious-01.jpg`
- `contact-sheets/rejected-obvious-02.jpg`
- `contact-sheets/shortlist-strong-01.jpg`
- `contact-sheets/shortlist-strong-02.jpg`
- `contact-sheets/shortlist-strong-03.jpg`
- `contact-sheets/flagged-checkerboard-01.jpg`

## Symbolic Asset Library

Fuente vigente:

- Documento humano: `docs/symbolic-asset-library.md`
- Catalogo JSON: `assets/orbita/symbolic-library/symbolic-asset-catalog.json`
- Catalogo CSV: `assets/orbita/symbolic-library/symbolic-asset-catalog.csv`
- Prompts Batch 1 PNG: `assets/orbita/symbolic-library/prompts/batch-1-png-prompts.md`
- Referencia visual Archive 9: `assets/orbita/higgsfield/archive-9/`

Estado:

- Total planificado: `265` assets.
- Familias: zodiaco, puntos natales, casas, carta natal, aspectos, fases lunares, elementos/modalidades, topics, tarot completo, tarot UI kit, simbolos editoriales y fondos integrables.
- Batch 1: `81` assets, prioriza signos, planetas principales, fases lunares base, elementos, topics principales y fondos prioritarios.
- Archive 9 contiene `10` PNGs de referencia visual: `7` square `2048x2048`, `3` verticales `1536x2752`, todos `RGB` sin alpha real.

Regla clave:

- Los simbolos de UI deben terminar como vector editable en Figma.
- Los PNGs sirven para atmosfera, composicion y fondos integrados.
- `75, 76, 78` de Archive 7 quedan reemplazados por la nueva familia `topic`.
- No subir nada a Figma hasta generar/revisar/clasificar Batch 1.

## Higgsfield Archive 10 / Guardas Simbolicas

Fuente cruda: `/Users/lucas/Downloads/archive (10)/`.

Biblioteca local:

- `assets/orbita/higgsfield/archive-10/inbox/`
- `assets/orbita/higgsfield/archive-10/selected/zodiac-emblems/`
- `assets/orbita/higgsfield/archive-10/selected/zodiac-alternates/`
- `assets/orbita/higgsfield/archive-10/selected/moon-phases/`
- `assets/orbita/higgsfield/archive-10/selected/planetary-symbols/`
- `assets/orbita/higgsfield/archive-10/selected/app-symbols/`
- `assets/orbita/higgsfield/archive-10/selected/backgrounds/`
- `assets/orbita/higgsfield/archive-10/needs-review/zodiac-emblems/`
- `assets/orbita/higgsfield/archive-10/rejected/`
- `assets/orbita/higgsfield/archive-10/contact-sheets/`
- `assets/orbita/higgsfield/archive-10/manifest.json`
- `assets/orbita/higgsfield/archive-10/manifest.csv`

Estado del intake:

- Total copiado a inbox: `36` PNGs, originales intactos y sin renombrar.
- Copias seleccionadas: `35`.
- Copias en `needs-review`: `1`.
- Copias en `rejected`: `0`.
- Alpha real detectado: `0/36`.
- Importante: aunque son PNG, no son stickers transparentes. Usarlos como guardas, fondos, crops editoriales o simbolos integrados sobre dark; no como iconos con alpha.

Seleccion inicial por familia:

- Zodiaco seleccionado: Aries, Tauro, Geminis, Cancer, Leo, Virgo, Libra, Escorpio, Sagitario, Acuario y Piscis.
- Zodiaco en revision: Capricornio, porque el candidato actual lee demasiado como monograma/logo y conviene regenerarlo o vectorizarlo a mano.
- Alternativa de signo: Sagitario 3D.
- Fases lunares: nueva/crescente, cuarto creciente, gibosa creciente, full/dark, luna llena brillante, gibosa menguante, cuarto menguante, menguante final y luna nueva dark.
- Planetas y puntos: Sol, Ascendente, Saturno, Pluto minimo, posibles Urano/Neptuno y un punto natal tipo Quiron/Lilith/Fortuna a confirmar.
- App symbols: vinculo entre dos cuerpos y amor/vinculo con corazon orbital.
- Backgrounds: sistema orbital de carta, transitos dinamicos y backplate de planeta anillado.

Contact sheets utiles:

- `contact-sheets/archive-10-all.jpg`
- `contact-sheets/zodiac-emblems.jpg`
- `contact-sheets/moon-phases.jpg`
- `contact-sheets/planetary-symbols.jpg`
- `contact-sheets/app-symbols-backgrounds.jpg`
- `contact-sheets/needs-review.jpg`

Pendientes antes de Figma:

- Confirmar semanticamente Leo, Acuario, Quiron/Lilith/Fortuna, Urano/Neptuno/Pluton.
- Regenerar Capricornio o tratarlo como vector editable.
- Decidir si los emblemas zodiacales se usan como guardas editoriales, porque los simbolos funcionales chicos siguen necesitando version vector editable.

## Naming esperado

- `orbita_01_logo_symbol.png`
- `orbita_04_daily_phone_inner.png`
- `orbita_05_birthdate_sun.png`
- `orbita_06_birthdate_selected.png`
- `orbita_07_birthplace_search.png`
- `orbita_08_birthplace_selected.png`
- `orbita_09_birthtime_picker.png`
- `orbita_10_birthtime_selected.png`
- `orbita_11_base_chart.png`
- `orbita_12_personalizing.png`
- `orbita_13_before_icon.png`
- `orbita_13_after_icon.png`
- `orbita_14_account_seal.png`
- `orbita_15_payment_hero.png`

## AM/PM

AM/PM no es asset. Debe ser UI editable en Figma.

Especificacion vigente:

- Contenedor `72x84`.
- Radio `18`.
- Fondo `#EFECE4`.
- Borde `#D8D3C8`.
- Dos opciones verticales: `AM` arriba, `PM` abajo.
- `AM` seleccionado: pill negro `52x32`, texto blanco.
- `PM` no seleccionado: texto gris, sin pill.
- Alineado a la derecha del wheel.
- Sin crop, mascara ni bitmap.

## Prompts base

Prompt base para assets square:

```text
Square 1:1 image, 2048x2048. Premium dark editorial astrology aesthetic for a mobile app called Órbita. Deep black and charcoal background, soft cinematic lighting, subtle copper accents, elegant orbital geometry, minimal and expensive. Main subject centered, fills 70-80% of the canvas, readable when cropped into a small rounded rectangle. No text, no labels, no logos, no UI, no emojis, no phone mockup, no poster frame, no blurred sidebars, no white borders, no generic zodiac cliches.
```

Prompt base para telefono interno de `04`:

```text
Vertical 9:16 image, 1080x1920. Premium dark mobile astrology reading screen background, designed to sit inside a phone mockup. A soft orbit symbol in the upper third, subtle copper linework, calm dark card-like depth, tiny abstract chart details, no readable text. Leave center and lower area calm for editable UI copy overlay. Elegant, minimal, cinematic, black charcoal and copper. No real UI buttons, no labels, no logos, no human figures.
```
