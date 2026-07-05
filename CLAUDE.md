# Claude Code — Frontend agent (Órbita)

Reglas del agente **frontend**. Heredá primero:
- **`AGENTS.md`** — guardrails de producto (marca `Órbita`; sin claims de destino/salud/dinero/legal; framing entertainment + autoconocimiento).
- **`WORKFLOW.md`** — flujo multi-agente, territorio, contrato Convex-native y loop de feature. Es canónico; ante duda, gana `WORKFLOW.md`.

## Al iniciar un thread

1. Leé `PROJECT_CONTEXT.md` y `CURRENT_TASK.md`.
2. Leé `docs/contexto-actual.md`.
3. Si la tarea toca Figma / diseño / onboarding / Home / copy / assets, leé `docs/figma-context.md`, `docs/onboarding-v44-react-native-handoff.md`, `docs/home-contenidos-personalizados.md` y `docs/ritmo-trabajo.md`.
4. Para tipos de dominio del front: `src/domain/types.ts`.
5. `git branch --show-current` — confirmá que estás en `feature/web` (tu worktree `../orbita-frontend`).
6. Resumí en español corto: qué es Órbita, la tarea actual, qué docs leíste, estado de git, próximo paso.

## Territorio

- **Sos dueño de:** `app/**`, `src/**`, `assets/**`, `global.css`, `tailwind.config.js`, `src/theme/**`.
- **Consumís read-only:** `convex/_generated/**` (tipos de `api.*`). No lo edités ni lo regeneres.
- **No editás `convex/**`** salvo un cambio de contrato en `convex/schema.ts` (ver abajo). El resto de `convex/` es de Codex.
- **Config gris** (`package.json`, `babel.config.js`, `metro.config.js`, `tsconfig.json`, `app.json`): tocá solo si es imprescindible y coordiná por PR.

## Contrato y datos (Convex)

- **Nunca corras `convex dev` ni `convex codegen`.** Un solo deployment lo maneja el backend.
- Para consumir data: `git pull` de `main` para traer el `convex/_generated/` al día, y usá `useQuery(api.x.y)` / `useMutation(api.x.y)`.
- Si necesitás una función o campo que el backend todavía no expone: agregá la firma deseada / un stub con `// TODO: pendiente backend` en `convex/schema.ts`, anotalo en `convex/CHANGELOG.md`, commiteá **solo el contrato**, y mientras tanto trabajá contra un **mock tipado** con esa forma.

## Figma (workflow diario)

- Figma es la fuente de verdad del diseño; traé el frame real vía MCP, no lo inventes. Archivo/páginas en `docs/figma-context.md`.
- **Frame por frame.** Reutilizá componentes reales (`src/components/`, `src/components/ui/` — RN Reusables / `@rn-primitives`).
- **Tokens, no hardcode:** colores/spacing/tipografías desde `src/theme/` + `tailwind.config.js`. Si falta un token, se propone.
- **Estados completos** en cada pantalla: loading / empty / error / success.

## Antes del PR

- `pnpm typecheck` y `pnpm test` en verde (no hay eslint: el "lint" es el typecheck).
- Rebase sobre `main`.
- Actualizá `CURRENT_TASK.md` si cambió el plan, estado, decisiones o handoff.
