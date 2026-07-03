# Decision Log - Órbita

## 2026-07-03

- **Archive 10 ingestado:** se copio `/Users/lucas/Downloads/archive (10)/` a `assets/orbita/higgsfield/archive-10/inbox/` con 36 PNGs intactos.
- **Manifest y contact sheets creados:** `manifest.json`, `manifest.csv` y laminas de revision en `assets/orbita/higgsfield/archive-10/contact-sheets/`.
- **Clasificacion inicial:** quedaron 35 assets seleccionados y 1 en `needs-review` para Capricornio; no hubo rechazos automáticos en esta tanda.
- **Familias detectadas:** zodiaco, fases lunares, planetas/puntos, simbolos de app y fondos/guardas integrables.
- **Decision tecnica de assets:** los 36 PNGs son RGB y no tienen alpha real. Se usan como guardas, fondos, crops y backplates integrados, no como stickers transparentes.
- **Decision de Figma:** no se toca Figma hasta confirmar semantica visual y elegir ganadores por pantalla.
- **Pendiente:** regenerar o resolver Capricornio y crear versiones vector editables para los simbolos funcionales chicos.

## 2026-07-02

- **Symbolic Asset Library creada:** se documento la libreria canonica en `docs/symbolic-asset-library.md` y se genero un catalogo de `265` assets en `assets/orbita/symbolic-library/`.
- **Archive 9 ingestado como referencia:** se copio `/Users/lucas/Downloads/archive (9)/` a `assets/orbita/higgsfield/archive-9/` con manifest y contact sheet; queda como referencia de estilo, no como subida automatica a Figma.
- **Batches definidos:** Batch 1 prioriza signos, planetas principales, fases lunares base, elementos, topics principales y fondos prioritarios; Batch 3/4 cubren tarot completo.
- **Decision de simbolos:** los iconos funcionales deben ser vector editable en Figma; los PNGs quedan para atmosfera/fondos/composicion.
- **Topics reemplazados:** `75`, `76`, `78` de Archive 7 quedan solo como referencia vieja y son reemplazados por la familia `topic` del nuevo catalogo.
- **No se toco Figma:** esta pasada fue inventario, prompts e intake local.

## 2026-07-02

- **Archive 7 ingestado:** se copio `/Users/lucas/Downloads/archive (7)/` a `assets/orbita/higgsfield/archive-7/inbox/` con 83 PNGs intactos y sin renombrar.
- **Manifest y contact sheets creados:** `manifest.json`, `manifest.csv` y 16 laminas de revision en `assets/orbita/higgsfield/archive-7/contact-sheets/`.
- **Clasificacion inicial:** se crearon copias renombradas por pantalla en `selected/onboarding/` y `selected/home/`; los descartes quedaron en `rejected/`.
- **Decision tecnica de assets:** los PNGs son `1856x2304`, `RGB`, sin alpha real. Se usan como fondos/visuales integrados, no como recortes transparentes.
- **Checkerboard fuera de selected:** `01`, `32` y `33` salieron de `selected` y pasaron a rechazo por checkerboard horneado.
- **Topic symbols pendientes:** `75, 76, 78` quedan como referencia solamente; hay que regenerar simbolos finales editables/limpios para Home Topics.
- **No se toco Figma:** este paso fue solo limpieza de libreria visual local antes de aplicar assets en onboarding o app core.

## 2026-07-02

- **Home V1.1 creada:** se duplico la base V1 en `UX V4.5 - Órbita App Core` como segunda pasada de revision.
- **Review board agregado:** `00C / Review Board - Co-Star x Órbita` documenta que se toma de Co-Star ritmo vertical, aire, serif editorial, tabs, filas con flecha y cierre de scroll; se mantiene de Órbita cobre sutil, dark premium, voseo argentino y tono menos cinico.
- **Asset Library V4.6 creada:** nueva pagina Figma `UX V4.6 - Órbita Asset Library` con slots iniciales para Home, Carta, Tránsitos y Vínculo.
- **Assets generados:** se crearon 8 PNG fuente en `assets/orbita/core/` y se cargaron como fills `IMAGE/FILL` en Figma.
- **Seleccion inicial Home V1.1:** `orbita_home_hero_orbital_b`, `orbita_daily_texture_b` y `orbita_long_read_thumbnail_a`.
- **Pulido visual Home V1.1:** se ajusto `Clima del día` para evitar choque con CTA, se corrigio el bottom nav para que `Tránsitos` no corte en dos lineas y se subio el cierre de `Home V1.1 / End`.
- **Verificación:** Home V1.1 y V4.6 no tienen términos históricos visibles ni placeholders de marca anterior, exploraciones intermedias, `Shop`, `Void`, `NASA`, `JPL` o `Lorem`.

## 2026-07-02

- **App core V4.5 creada:** nueva pagina Figma `UX V4.5 - Órbita App Core`.
- **Entregable inicial post-onboarding:** sitemap core + componentes locales + cuatro frames de Home.
- **Nav V1:** `Inicio`, `Carta`, `Tránsitos`, `Vínculo`, `Perfil`.
- **No se usa Shop/Void literal:** suscripción queda asociada a `Perfil` o entradas Plus futuras; preguntas tipo Void quedan como feature futura si se decide.
- **Home V1:** `Home / Top`, `Home / Daily Guide`, `Home / Topics`, `Home / End`.
- **Verificación:** no quedaron términos históricos visibles en la página nueva: marca anterior, exploraciones intermedias, `Shop`, `Void`, `NASA` o `JPL`.

## 2026-07-02

- **Marca vigente:** `Órbita`.
- **Marca vieja:** el nombre técnico inicial queda como contexto heredado, no como dirección actual.
- **Exploración histórica:** una etapa intermedia de Figma/copy queda como referencia, no como marca vigente.
- **Figma vigente:** `BEB5v6SbgJn2Nipm8Qa0wE`.
- **Pagina vigente:** `UX V4.3 - Órbita Onboarding Copy`.
- **Prompts/assets:** la pagina `UX V4.4 - Órbita Asset Prompts` fue una etapa historica; los prompts vigentes deben vivir en docs/chat handoff, no como fuente primaria dentro de Figma.
- **Flujo vigente:** onboarding `01-15`.
- **Payment vigente:** pantalla unica al final del onboarding. El paywall in-app extendido queda para futuro.
- **Estilo:** 70% Co-Star / 30% Moonly.
- **Visual:** dark premium, charcoal, cobre sutil, editorial astrologico, geometria orbital.
- **Copy:** voseo argentino, breve, preciso y sin traducciones literales.
- **Splash tagline final:** `tu astróloga personal`.
- **Screen 11:** titulo vigente `Estos son tus puntos de partida.`
- **AM/PM:** debe ser UI editable, no imagen ni control recortado.

## Decisiones negativas

- No usar claims falsos, reviews inventadas, logos de prensa ni metricas sin fuente.
- No prometer predicciones, destino ni resultados garantizados.
- No decir `NASA/JPL` salvo integracion real con JPL/Horizons.
- No usar `astrologia védica` salvo decision explicita.
- No llenar pantallas con cards, placeholders o grillas por default.
- No usar nombres anteriores ni exploraciones intermedias como marca actual.

## Historico util

- V2 sirvio para detectar que el producto no podia verse como tablero con muchas cards.
- V3 Co-Star Editorial fijo una direccion: aire, monocromo/editorial, tablas y diagramas.
- V4/V4.3 consolido Órbita y el onboarding actual.
- V5 paywall extendido sirve como exploracion futura, pero no reemplaza el payment unico del onboarding vigente.
