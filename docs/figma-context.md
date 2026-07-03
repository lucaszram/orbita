# Figma Context - Órbita

## Fuente vigente

- Archivo Figma: `BEB5v6SbgJn2Nipm8Qa0wE`.
- Pagina principal: `UX V4.3 - Órbita Onboarding Copy`.
- Pagina app core: `UX V4.5 - Órbita App Core`.
- Pagina asset library core: `UX V4.6 - Órbita Asset Library`.
- Prompts/assets: los prompts viven en docs/chat handoff; no usar una pagina Figma de prompts como fuente vigente.
- Páginas anteriores como V2, V3, V5 o exploraciones intermedias son históricas salvo que el usuario pida revisarlas explícitamente.

## Flujo vigente `01-15`

1. `01 / Logo Splash`: logo Órbita + tagline final `tu astróloga personal`.
2. `02 / Align With Universe`: promesa general dark premium. Copy: `Alineate con el ritmo del universo`.
3. `03 / Identify`: `¿Cómo te identificás?` + opciones `Ella`, `Él`, `Prefiero no decirlo`.
4. `04 / Daily Guidance`: guia diaria con telefono central y badges `♡ Amor`, `☾ Cuidado`, `◇ Decisiones`, `✦ Energía`.
5. `05 / Birthdate Empty`: pregunta fecha de nacimiento.
6. `06 / Birthdate Selected`: estado de confirmacion, no picker.
7. `07 / Birthplace Search`: busqueda de ciudad/lugar de nacimiento.
8. `08 / Birthplace Selected`: lugar confirmado; copy correcto sobre ascendente y casas.
9. `09 / Birth Time Picker`: selector hora/minuto + AM/PM editable.
10. `10 / Birth Time Selected`: hora confirmada.
11. `11 / Your Base Chart`: titulo vigente `Estos son tus puntos de partida.`
12. `12 / Personalizing`: calculo/progreso dark premium.
13. `13 / Before After / Órbita`: before/after seguro, sin claims falsos.
14. `14 / Create Account`: guardar carta/cuenta.
15. `15 / Onboarding Payment / Scroll`: payment de onboarding, no paywall in-app extendido.

## Payment vigente

El payment vigente dentro del onboarding es una sola pantalla:

- Marca: `Órbita` + badge `PLUS`.
- Titulo: `Tu cielo, todos los días.`
- Planes: `Semanal` `$5` por semana y `Anual` `$30` / `$0.58 por semana`.
- Plan default: `Anual`.
- Badge: `MEJOR VALOR`.
- Legal: `Cancelás cuando quieras. Entretenimiento y autoconocimiento.`

El flujo V5 de paywall extendido queda como exploracion historica para un paywall in-app futuro.

## Reglas al editar Figma

- Revisar la pagina vigente antes de tocar nodos.
- Trabajar pantalla por pantalla.
- Mantener copy editable, no dentro de imagenes.
- No recrear AM/PM como bitmap.
- Verificar con screenshots de las pantallas tocadas.
- Si una imagen queda como poster vertical dentro de un square, descartarla o regenerarla.

## App core V4.5

Pagina creada para empezar las pantallas post-onboarding sin tocar el onboarding V4.3.

Frames actuales:

- `00 / App Core Map`: mapa de pantallas core y assets de Home.
- `00B / Local reusable components`: fuentes de componentes locales para app core.
- `00C / Review Board - Co-Star x Órbita`: notas de comparacion Co-Star x Órbita.
- `01 / Home / Top`: inicio diario con triada natal, frase principal y CTA.
- `02 / Home / Daily Guide`: guia diaria con Hacé, Evitá, Energía y Acción.
- `03 / Home / Topics`: tabs por tema y lista editorial.
- `04 / Home / End`: lectura larga, modulo educativo y cierre.
- `Home V1.1 / Top`: revision con hero orbital, triada visible y CTA `Profundizar`.
- `Home V1.1 / Daily Guide`: revision con textura diaria, Hacé/Evitá, energia y accion.
- `Home V1.1 / Topics`: revision con tabs `Amor`, `Trabajo`, `Familia`, `Vínculos` y filas editoriales.
- `Home V1.1 / End`: revision con thumbnail editorial, lectura larga e historial/guardadas.

Assets aplicados en `Home V1.1`:

- `asset-slot/orbita_home_hero_orbital_b`
- `asset-slot/orbita_daily_texture_b`
- `asset-slot/orbita_long_read_thumbnail_a`

## Asset Library V4.6

Pagina creada para reunir assets propios de Home y pantallas core, sin copiar assets de Co-Star.

Board actual:

- `00 / Asset Library - Home + Core`

Slots con imagen `FILL` aplicada:

- `asset-preview/orbita_home_hero_orbital_a`
- `asset-preview/orbita_home_hero_orbital_b`
- `asset-preview/orbita_daily_texture_a`
- `asset-preview/orbita_daily_texture_b`
- `asset-preview/orbita_long_read_thumbnail_a`
- `asset-preview/orbita_carta_natal_diagram_a`
- `asset-preview/orbita_transitos_visual_a`
- `asset-preview/orbita_vinculo_symbol_a`

Seleccion inicial para Home V1.1:

- Hero: `orbita_home_hero_orbital_b`
- Guia diaria: `orbita_daily_texture_b`
- Lectura larga: `orbita_long_read_thumbnail_a`

## Higgsfield Archive 7

Intake local listo para revision visual, sin aplicar todavia en Figma:

- Carpeta raiz: `assets/orbita/higgsfield/archive-7/`
- Inbox crudo: `assets/orbita/higgsfield/archive-7/inbox/`
- Seleccion onboarding: `assets/orbita/higgsfield/archive-7/selected/onboarding/`
- Seleccion home: `assets/orbita/higgsfield/archive-7/selected/home/`
- Rechazos: `assets/orbita/higgsfield/archive-7/rejected/`
- Contact sheets: `assets/orbita/higgsfield/archive-7/contact-sheets/`
- Manifest: `assets/orbita/higgsfield/archive-7/manifest.json`

Lectura importante:

- Los 83 PNGs son `1856x2304`, `RGB`, sin alpha real.
- No hay que tratarlos como stickers transparentes; hay que integrarlos como fondos/visuales con crop, mascara y composicion.
- `01`, `32` y `33` fueron removidos de `selected` y enviados a rechazo por checkerboard horneado.
- `75, 76, 78` sirven solo como referencia para regenerar topic symbols. No son assets finales para Home.
- La proxima pasada de onboarding/core debe elegir desde `selected/`, no desde la carpeta cruda ni desde nombres manuales.
- Figma no fue modificado en este intake.

## Symbolic Asset Library

Libreria canonica planificada, todavia local y sin aplicar a Figma:

- Documento: `docs/symbolic-asset-library.md`
- Catalogo JSON: `assets/orbita/symbolic-library/symbolic-asset-catalog.json`
- Catalogo CSV: `assets/orbita/symbolic-library/symbolic-asset-catalog.csv`
- Prompts Batch 1: `assets/orbita/symbolic-library/prompts/batch-1-png-prompts.md`
- Referencia Archive 9: `assets/orbita/higgsfield/archive-9/`

Lectura importante:

- Total catalogado: `265` assets.
- Los simbolos funcionales deben terminar como vectores editables en Figma.
- Los PNGs editoriales son para atmosfera, profundidad, fondos y composicion.
- No copiar assets de Co-Star ni Moonly; usar solo sus categorias y patrones de uso.
- Los topic symbols de Archive 7 (`75`, `76`, `78`) quedan reemplazados por la nueva familia `topic`.
- Figma no fue modificado para esta libreria.

## Higgsfield Archive 10

Intake local de simbolos/guardas listo para revision visual, sin aplicar todavia en Figma:

- Carpeta raiz: `assets/orbita/higgsfield/archive-10/`
- Inbox crudo: `assets/orbita/higgsfield/archive-10/inbox/`
- Seleccion: `assets/orbita/higgsfield/archive-10/selected/`
- Needs review: `assets/orbita/higgsfield/archive-10/needs-review/`
- Rechazos: `assets/orbita/higgsfield/archive-10/rejected/`
- Contact sheets: `assets/orbita/higgsfield/archive-10/contact-sheets/`
- Manifest: `assets/orbita/higgsfield/archive-10/manifest.json`

Lectura importante:

- Total: `36` PNGs copiados desde `/Users/lucas/Downloads/archive (10)/`.
- Seleccionados: `35`.
- Needs review: `1`, el candidato de Capricornio.
- Rechazados: `0`.
- Alpha real: `0/36`; son RGB, no stickers transparentes.
- Usarlos como guardas simbolicas, fondos integrables, crops o backplates sobre dark.
- No asumir que el signo/planeta detectado por nombre es definitivo cuando la forma es ambigua; confirmar antes de llevarlo a Figma.
- Figma no fue modificado en este intake.

## Referencias

- Co-Star: referencia principal de tono editorial, aire, tablas, diagramas y autoridad.
- Moonly: referencia secundaria de onboarding, before/after, claridad de beneficio y payment.
- Astra/Zodiac Astra: referencias historicas para entender lo que se rechazo y lo que se rescato de apps mas actuales.
