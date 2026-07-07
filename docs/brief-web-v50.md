# Brief — Web de Órbita (Figma, página nueva V5.0): landing + página de datos

> Brief autocontenido para retomar en otra sesión/terminal. Diseño en **Figma primero**
> (después código en Expo Web). **Desktop responsive (1440 → mobile).** Trabajá por secciones,
> con **tokens (no hardcode)** y **estados completos**. Reglas: `docs/ritmo-trabajo.md`.

## 0. Qué es la Web (definición del usuario)

Dos entregables, en una **página nueva de Figma** separada (crear `UX V5.0 - Órbita Web`):

1. **Landing page (marketing).** Formalizar en Figma la landing que **ya está codeada**:
   `../orbita-frontend/src/components/web/orbita-landing.tsx`.
2. **Página de datos (el core del pedido).** Una **sola página con scroll**: arriba cargás
   **fecha, lugar y hora de nacimiento**; a medida que bajás, la página **trae toda la
   información/lecturas** personalizadas. **No** es onboarding multi-paso, **no** es un landing.
   El look va **emparentado con la Home + el onboarding**.

## 1. Setup y restricción de Figma (leer primero)

- **File key:** `BEB5v6SbgJn2Nipm8Qa0wE` · URL `https://www.figma.com/design/BEB5v6SbgJn2Nipm8Qa0wE/Orbita-UX`
- Crear la página `UX V5.0 - Órbita Web` con `use_figma` (`figma.createPage()`), y **dejarla abierta**
  en Figma desktop (el MCP solo ve la página activa). Alternativa: pasar links de frame (`Cmd+L`).
- Cargá la skill **`figma-use`** antes de `use_figma`. Para armar páginas/secciones enteras,
  también `figma-generate-design`. Nunca corras `convex dev`.

## 2. Landing ya codeada — estructura a formalizar en Figma

`../orbita-frontend/src/components/web/orbita-landing.tsx` (React Native Web, responsive
`isNarrow < 760`). Secciones de arriba a abajo:
1. **Hero** full-bleed (`orbita_home_hero_orbital_b`) + nav (wordmark + "Studio"), eyebrow
   "Tu astróloga personal", título gigante "Órbita", 2 CTAs ("Empezar" → /onboarding,
   "Entrar al Studio" → /studio), 3 MiniStats (Base/Carta natal, Hoy/Tránsitos, Modo/Editorial).
2. **"La experiencia"** — 3 tiles: Carta base (natalChart), Tránsitos (transits), Ritmo diario (dailyTexture).
3. **"Home diaria"** — banda full-bleed (dailyTexture) + tabla de 5 módulos
   (Frase del día, Hacé, Evitá, Temas, Deep Dive).
4. **"Studio V0"** — preview a /studio.
5. **Asset strip** — tira de símbolos.
6. **Footer** — wordmark + "Entretenimiento, autoconocimiento y contexto diario."

## 3. Página de datos — estructura a diseñar (nueva)

**Arriba (hero + formulario compacto):**
- Hero orbital + wordmark, título tipo "Tu cielo, en una página".
- **Formulario en una sola vista** (no wizard): fecha de nacimiento, lugar (autocomplete de ciudad),
  hora (con opción "No sé la hora" → carta aproximada). CTA cobre "Ver mi cielo".

**Abajo (resultados, aparecen al enviar / al scrollear) — emparentado con la Home:**
- **Tríada Sol / Luna / Ascendente** (con estado `calculated` vs `approximate_without_birth_time`).
- **Diagrama de carta natal** (emblema `orbita_carta_natal_diagram_a`).
- **Guía diaria**: frase del día, energía, **Hacé / Evitá**, acción, pregunta.
- **Temas**: Amor / Trabajo / Familia / Vínculos (filas editoriales).
- **Long read** (thumbnail editorial).
- **Teasers Plus-locked**.

**Estados (obligatorios):** vacío (sin datos aún) · loading ("calculando…") · success · error ·
aviso visible de **datos aproximados** cuando falta la hora.

## 4. Lenguaje visual y tokens (igual que Home/onboarding)

- Registros: **oscuro inmersivo** (`#07080A`/`#0D0E12`, orbital, cobre) y **bone editorial** (`#F7F5EF`).
- **CTA = cobre `#C46A3A`** con texto oscuro. **Titulares = Newsreader Medium** (serif). Acento cobre.
- Paleta: bone `#F7F5EF` · bone2 `#F1E7DA` · ink `#111` · charcoal `#0D0E12`/`#14161D` ·
  copper `#C46A3A` · copperSoft `#D69A6A` · line `#D8D3C8` · muted `#8E8A82`.
- Tipografías: Newsreader Medium (titulares) · Inter Regular/Medium/Bold (UI/body).
- **Patrón de emblema focal** (para carta/tríada sobre fondo claro): fondo tenue (~0.15) +
  glow radial cobre (`rgba(0.95,0.42,0.16,0.16)`→0, opacity 0.72) + **elipse** con la imagen
  (`scaleMode:"FILL"`, opacity ~0.92). Los assets son RGB sin alfa → siempre enmascarar en círculo,
  nunca cuadrado sobre bone.

## 5. Assets

**Set web-ready (solo en el worktree `../orbita-frontend`):** `assets/orbita/optimized/onboarding-v44/`
(36 JPG limpios) + mapa curado `../orbita-frontend/src/content/webAssets.ts` (roles hero/texture/
module/symbol). Úsalo como fuente principal para la web.

**Canónicos `core/`** (masters, con preview `.jpg`): `orbita_home_hero_orbital_b` (hero),
`orbita_daily_texture_b` (textura), `orbita_carta_natal_diagram_a` (carta), `orbita_transitos_visual_a`
(tránsitos), `orbita_long_read_thumbnail_a` (long read), `orbita_vinculo_symbol_a` (vínculo).

**Símbolos** `higgsfield/archive-10/selected/`: 11 zodiacos (falta Capricornio, `needs-review`),
9 fases lunares, planetas/puntos, fondos orbitales. RGB sin alfa. Detalle: `docs/assets-needed.md`.

## 6. Guardrails de copy (`AGENTS.md`)

Framing entretenimiento + autoconocimiento. Prohibido: claims de destino/salud/dinero/legal;
"chat 24/7"; "Calculamos tu carta" / "Leemos los tránsitos" / "Cruzamos tu mapa con el cielo del
día" / "Te damos una acción". Preguntas → "Preguntale a Órbita". Voseo argentino, editorial.

## 7. Task list sugerida

1. Crear página `UX V5.0 - Órbita Web` + confirmar/crear variables de Figma (tokens).
2. **Landing**: frame desktop 1440 con las 6 secciones (base: `orbita-landing.tsx`) + variante mobile.
3. **Página de datos — hero + form**: layout desktop (form centrado/hero) + mobile.
4. **Página de datos — resultados**: tríada, carta (emblema), guía diaria (Hacé/Evitá/acción/pregunta),
   temas, long read, teasers Plus.
5. **Estados**: vacío / loading / success / error / aviso datos aproximados.
6. **Checkpoint**: screenshots desktop + mobile de cada sección; revisar tokens/guardrails/assets.

## 8. Verificación

- Screenshots desktop (1440) y mobile de cada sección.
- (Al pasar a código) en worktree `../orbita-frontend` (branch `feature/web`, ya tiene NativeWind +
  `src/components/ui/`): `pnpm typecheck` + `pnpm test` en verde; `expo export --platform web` ok;
  rebase sobre `main`; PR con estados completos.
