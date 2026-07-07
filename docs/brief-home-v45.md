# Brief — Mejorar la Home de la app (Figma, página V4.5 App Core)

> Brief autocontenido para retomar en otra sesión/terminal. Diseño en **Figma primero**
> (después código). Trabajá **frame por frame**, con **tokens (no hardcode)** y **estados
> completos** (loading/empty/error/success). Regla del proyecto: `docs/ritmo-trabajo.md`.

## 0. Setup y restricción de Figma (leer primero)

- **File key:** `BEB5v6SbgJn2Nipm8Qa0wE` · URL `https://www.figma.com/design/BEB5v6SbgJn2Nipm8Qa0wE/Orbita-UX`
- **Página:** `UX V4.5 - Órbita App Core`.
- El **MCP de Figma solo "ve" la página abierta** en Figma desktop. Para trabajar la Home:
  1. Abrí `UX V4.5` en Figma desktop (panel Pages), o
  2. Pasá un **link a un frame** (`Cmd+L` sobre el frame) y extraé `fileKey` + `node-id`.
- Antes de `use_figma` cargá la skill **`figma-use`** (y `figma-generate-design` si armás secciones
  nuevas). Nunca corras `convex dev` / `convex codegen`.
- Nodo de referencia confirmado: **`92:58` = `01 / Home / Top`** (funciona como ancla).

## 1. Frames de la Home (página V4.5)

- `01 / Home / Top` (`92:58`) — hero orbital diario, tríada, CTA "Profundizar"
- `02 / Home / Daily Guide` — textura diaria, Hacé/Evitá, energía, acción
- `03 / Home / Topics` — tabs Amor/Trabajo/Familia/Vínculos + filas editoriales
- `04 / Home / End` — thumbnail editorial, long read, historial/guardados
- Set de revisión: `Home V1.1 / Top · Daily Guide · Topics · End`
- Boards de apoyo: `00 / App Core Map`, `00B / Local reusable components`,
  `00C / Review Board - Co-Star x Órbita`

Estructura actual de `01 / Home / Top` (`92:58`), ya inspeccionada:
nav brand (`92:63`) + selector (`92:64`) · bottom nav Inicio/Carta/Tránsitos/Vínculo/Perfil
(`92:65`) · tríada `92:73` · hero orbital `92:74` (220×220) · headline `92:82` · body `92:83` ·
divider `92:84` · micro label `92:85` + micro copy `92:86` · CTA "Profundizar" `92:87/88`.

## 2. Lenguaje visual (mantener — ya establecido en el onboarding V4.4)

Dos registros que se alternan:
- **Oscuro inmersivo:** negro/carbón `#07080A` / `#0D0E12`, geometría orbital, acento cobre
  `#C46A3A`, serif **Newsreader Medium** + Inter.
- **Bone editorial:** fondo `#F7F5EF`, titulares **Newsreader Medium**, labels cobre en mayúsculas,
  tiles oscuros, CTA (ver abajo).

**Decisiones de sistema ya tomadas en V4.4 (aplicarlas también en Home):**
- **CTA principal = relleno cobre** `#C46A3A` con texto oscuro (no lavanda, no bone).
- **Titulares = Newsreader Medium** (serif) en ambos registros.
- **Acento = cobre** en labels, ticks, checks, glows.

### Tokens (de `docs/onboarding-v44-react-native-handoff.md` + `src/theme/theme.ts`)
| token | hex |
|---|---|
| bone (bg claro) | `#F7F5EF` |
| bone2 | `#F1E7DA` |
| ink | `#111111` |
| charcoal | `#0D0E12` |
| charcoal2 | `#14161D` |
| copper | `#C46A3A` |
| copperSoft | `#D69A6A` |
| line | `#D8D3C8` |
| muted | `#8E8A82` |
Tipografías: **Newsreader Medium** (titulares), Inter Regular/Medium/Bold (UI/body).
Idealmente bindear a **variables de Figma** (crear la colección si no existe con `figma-generate-library`).

## 3. Patrón de emblema focal (VALIDADO en V4.4 — reusar)

Los assets son **RGB sin alfa real** (fondo oscuro horneado). Sobre pantallas bone **no** van como
cuadrado (se ve una caja oscura pegada). El patrón que funciona (pantalla 06 del onboarding):

1. **Fondo** full-bleed con la imagen a **opacidad ~0.15–0.22** (tenue).
2. **Glow**: elipse con `GRADIENT_RADIAL` cobre `rgba(0.95,0.42,0.16, 0.16)` → `alpha 0`,
   `opacity ~0.72`, ~46px más grande que el emblema.
3. **Emblema**: **elipse** (círculo) con `fills:[{type:"IMAGE", scaleMode:"FILL", imageHash:<hash>}]`,
   `opacity ~0.92`. Reusá el mismo `imageHash` del fondo (mismo asset, enmascarado en círculo).

Para el hero orbital de la Home (`92:74`) aplicá exactamente esto con
`orbita_home_hero_orbital_b`.

## 4. Contenido de la Home (spec: `docs/home-contenidos-personalizados.md`)

La Home es un objeto diario por usuario. Bloques P0 a diseñar:
1. **Header diario** — fecha local, saludo, headline, subheadline.
2. **Base astro visible** — tríada **Sol / Luna / Ascendente** con estado de precisión
   (`calculated` vs `approximate_without_birth_time`) y sus limitaciones **visibles**.
3. **Tránsito destacado** del día.
4. **Módulos principales** — **Hacé / Evitá** (3 + 3), **energía**, **acción**, **pregunta**.
5. **Temas** — Amor / Trabajo / Familia / Vínculos (cada uno: título, one-line, detalle, hacé,
   evitá, pregunta, "basado en", locked-for-Plus).
6. **Long read** (educativo).
7. **Preguntas / The Void.**
8. **Gaps & review** — señalización cuando falta carta/tránsitos reales.

Mapeo a los frames V4.5:
- `Home/Top` → hero orbital + tríada + CTA "Profundizar"
- `Home/Daily Guide` → textura diaria + Hacé/Evitá + energía + acción
- `Home/Topics` → tabs Amor/Trabajo/Familia/Vínculos + filas editoriales
- `Home/End` → thumbnail editorial + long read + historial/guardados

## 5. Assets (base `/Users/lucas/Documents/horoscopo/assets/orbita/`)

**Canónicos `core/` (los "finales", tienen preview `.jpg` en `core/figma-*-previews/`):**
- Hero Home → `core/orbita_home_hero_orbital_b.png` (luna semi-iluminada, 1 anillo cobre)
- Textura diaria → `core/orbita_daily_texture_b.png`
- Long read → `core/orbita_long_read_thumbnail_a.png` (naturaleza muerta editorial)
- Carta natal → `core/orbita_carta_natal_diagram_a.png` (rueda astrológica completa)
- Tránsitos → `core/orbita_transitos_visual_a.png` (planeta + órbitas múltiples, deja lugar a labels)
- Vínculo → `core/orbita_vinculo_symbol_a.png`

**Símbolos `higgsfield/archive-10/selected/`** (RGB sin alfa):
- Zodiaco: 11 emblemas (`zodiac-emblems/…`) — **falta Capricornio** (`needs-review/`, regenerar).
- Fases lunares: 9 (`moon-phases/…`) — buena para una tira lunar / luna del día.
- Tránsito hero (energía): `backgrounds/archive10_transits_dynamic_orbital_body__idx30__…png`.
- Anillos de carta: `backgrounds/archive10_chart_orbital_ring_system__idx15__…png`.
- Ascendente/horizonte: `planetary-symbols/archive10_point_ascendant_horizon__idx27__…png`.
- Sol: `planetary-symbols/…sun_copper_corona…idx25…png`.

Reglas: FILL no FIT; nada de texto horneado; íconos UI se redibujan como **vectores Figma**
(los PNG solo para atmósfera/fondos). Detalle completo en `docs/assets-needed.md` y
`docs/symbolic-asset-library.md`.

## 6. Guardrails de copy (`AGENTS.md`)

Framing **entretenimiento + autoconocimiento + contexto diario**. Prohibido: claims de
destino/resultados/salud/dinero/trabajo/legal; "chat 24/7"; y las frases
"Calculamos tu carta" / "Leemos los tránsitos" / "Cruzamos tu mapa con el cielo del día" /
"Te damos una acción". Para preguntas usar **"Preguntale a Órbita"**. Voseo argentino, editorial.

## 7. Task list sugerida (frame por frame)

1. **Fundaciones**: crear/confirmar variables de Figma (paleta + tipografías) para bindear.
2. **Home/Top**: aplicar patrón de emblema al hero orbital; tríada Sol/Luna/Asc con badge de
   precisión; headline serif; CTA cobre; estados (con carta / sin hora / maqueta).
3. **Home/Daily Guide**: textura diaria + Hacé/Evitá (3+3) + energía + acción; lista editorial con
   ticks cobre (evitar pill-grids).
4. **Home/Topics**: tabs Amor/Trabajo/Familia/Vínculos con filas editoriales + teaser Plus-locked.
5. **Home/End**: long read con thumbnail real + historial/guardados; empty state de guardados.
6. **Estados**: para cada frame, variante loading/empty/error + aviso "datos aproximados".
7. **Checkpoint**: screenshot de cada frame, revisar contra tokens/guardrails/assets.

## 8. Verificación

- Screenshot por frame (`get_screenshot`), revisar FILL de assets, tokens, y copy vs guardrails.
- Cruzar contenido con `docs/home-contenidos-personalizados.md`.
- (Al pasar a código, más adelante) en worktree `../orbita-frontend` (branch `feature/web`):
  `pnpm typecheck` + `pnpm test` en verde, rebase sobre `main`, PR con estados completos.
