# WORKFLOW.md — Desarrollo multi-agente: Codex (backend) + Claude (frontend)

Guía única del flujo de trabajo del repo **Órbita**. Dos agentes de IA laburando **como pares** sobre el mismo proyecto sin pisarse: Codex se ocupa del backend (Convex), Claude del frontend (Expo / React Native + Figma), y se comunican a través del contrato de Convex.

> El proceso operativo de tareas, ramas, Pull Requests, revisión, ambientes, TestFlight, incidentes y releases vive en [`docs/proceso-desarrollo-y-releases.md`](docs/proceso-desarrollo-y-releases.md) y es obligatorio para ambos agentes.

> **Stack real:** Expo SDK 54 (React Native, expo-router, NativeWind) + Convex (funciones serverless + DB) + Clerk (auth). **No es un monorepo** `/apps` + `/packages`: es un solo árbol donde el contrato entre back y front **ya existe de forma nativa** en Convex (schema + tipos autogenerados). Ver sección 4.

---

## Filosofía (por qué así)

- **Pares, no anidados.** No corremos un agente adentro del otro: es frágil y caro en tokens. Cada uno corre en su propia terminal, en su propio worktree.
- **Territorio claro.** Codex es dueño de `convex/`, Claude de `app/` + `src/`. Nadie edita archivos del otro.
- **Un solo canal de comunicación:** el contrato de Convex (`convex/schema.ts` + las firmas `args`/`returns` de cada función). Si un lado necesita algo del otro, lo pide vía un cambio de contrato, no metiendo mano en el código ajeno.
- **Todo entra por PR.** Nadie commitea a `main` directo.
- **Un objetivo, una rama, un PR.** Contrato, implementación, infraestructura y limpieza general no se mezclan salvo que sean inseparables y el PR lo justifique.
- **Merge no significa deploy.** `main` se valida en staging; producción requiere un Release Candidate probado y aprobación explícita de Lucas.

---

## 1. Requisitos e instalación

### Claude Code (frontend)

Método recomendado (instalador nativo, sin Node.js, se auto-actualiza):

```bash
# macOS / Linux
curl -fsSL https://claude.ai/install.sh | bash
```

Alternativa por npm (requiere Node 18+, útil para pinnear versiones):

```bash
npm install -g @anthropic-ai/claude-code
```

Verificar y autenticar:

```bash
claude --version
claude doctor     # chequea instalación, auth y config
claude            # primer launch: OAuth en el browser
```

> **Ojo:** Claude Code necesita un plan pago (Pro, Max, Team, Enterprise) o una cuenta de Console con créditos. El plan gratis de Claude.ai no da acceso.

### Codex CLI (backend)

```bash
# macOS / Linux
curl -fsSL https://chatgpt.com/codex/install.sh | sh
codex             # primer launch: sign-in con ChatGPT o API key
```

Requiere un plan de ChatGPT que incluya Codex (Plus, Pro, Business, Edu, Enterprise) o API key.

### Figma MCP (solo lo usa el frontend)

```bash
claude plugin install figma@claude-plugins-official
```

El plugin trae la config del MCP más Agent Skills. Después: `/plugin` → pestaña *Installed* → autenticar con tu cuenta de Figma.

> El write-to-canvas y el mejor set de features requieren el server **remoto** y un seat **Dev o Full** en Figma. En Starter o seats View/Collab estás limitado a ~6 tool calls por mes.

---

## 2. Estructura del repo

```
/horoscopo
├── AGENTS.md                 ← startup + reglas de Codex (backend)
├── CLAUDE.md                 ← startup + reglas de Claude (frontend)
├── WORKFLOW.md               ← este archivo (canónico para ambos)
├── PROJECT_CONTEXT.md        ← definición estable del proyecto
├── CURRENT_TASK.md           ← estado vivo / handoff
├── /app                      ← territorio de Claude — pantallas (expo-router)
├── /src                      ← territorio de Claude — UI, hooks, domain, theme, services
├── /convex                   ← territorio de Codex — backend
│   ├── schema.ts             ← EL CONTRATO (tablas + validators)
│   ├── *.ts                  ← funciones públicas (queries/mutations/actions)
│   ├── /lib                  ← utilidades internas (orbita, astrologyApi, users…)
│   ├── /_generated           ← tipos autogenerados (los commitea Codex)
│   └── CHANGELOG.md          ← registro de cambios del contrato
├── /docs                     ← documentación (arquitectura, figma, backend-todo…)
└── /assets                   ← territorio de Claude
```

**Cómo carga cada agente sus reglas:**
- Codex lee `AGENTS.md` automáticamente (startup + guardrails), que apunta a este `WORKFLOW.md`.
- Claude lee `CLAUDE.md` automáticamente, que hereda de `AGENTS.md` (guardrails de producto) y de este `WORKFLOW.md`.

---

## 3. Setup de worktrees

Cada agente trabaja en un worktree separado para que nunca compartan working directory. El directorio actual (`horoscopo/`) queda como checkout de `main` / integración.

```bash
cd /Users/lucas/Documents/horoscopo

git branch feature/api
git branch feature/web

git worktree add ../orbita-backend  feature/api
git worktree add ../orbita-frontend feature/web
```

Cada worktree tiene su **propio `node_modules`** (no lo comparten). Instalá una vez en cada uno — pnpm usa un store global con hardlinks, así que es rápido y no duplica disco:

```bash
cd ../orbita-backend  && pnpm install
cd ../orbita-frontend && pnpm install
```

El día a día, dos terminales:

```bash
# Terminal 1 — backend
cd ../orbita-backend && codex

# Terminal 2 — frontend
cd ../orbita-frontend && claude
```

Cada uno commitea en su branch. Mergeás a `main` por PR.

> **Verificado en el setup inicial:** ambas ramas typechequean en verde por separado (`tsc --noEmit`). El frontend no importa `convex/_generated` (referencia el backend por `anyApi` de `convex/server`), así que `feature/web` compila sin el código de `convex/`.

> **Un solo deployment de Convex (`dutiful-viper-815`).** Ver sección 4: **solo el backend** corre `convex dev`/`codegen` contra ese deployment. El frontend nunca lo corre.

---

## 4. El contrato primero (Convex-native)

En este stack **no hay `/packages/shared` que escribir a mano.** El contrato entre backend y frontend ya existe y es:

1. **`convex/schema.ts`** — las tablas y sus validators (la forma de los datos).
2. **Las firmas de cada función Convex** — los `args` y `returns` validators de cada query/mutation/action pública.
3. **`convex/_generated/`** — el puente de tipos que Convex **autogenera** desde 1 y 2. El frontend lo consume con `useQuery(api.x.y)` / `useMutation(api.x.y)`.

**Regla de codegen (crítica con un solo deployment):**
- **Solo el backend** corre `pnpm convex:dev` o `pnpm convex:codegen` (regeneran `convex/_generated/` contra `dutiful-viper-815`) y **commitea `convex/_generated/`**.
- **El frontend nunca corre `convex dev`.** Hace `git pull` de `main` para traer el `_generated/` actualizado y consume esos tipos. Si el backend todavía no mergeó, trabaja contra un **mock tipado** con la forma del contrato.

**Regla de flujo cuando alguien necesita cambiar la interfaz:**

1. Editás el contrato: `convex/schema.ts` y/o los validators `args`/`returns` de la función.
2. Anotás en `convex/CHANGELOG.md`: qué cambió, por qué, quién lo pidió.
3. Commiteás el cambio de contrato **solo**, sin mezclarlo con tu feature.

**Si necesitás algo que todavía no existe del otro lado:** no lo implementes cruzando el límite. Agregá la firma deseada (o un stub) con `// TODO: pendiente de implementar por <backend|frontend>` en `convex/schema.ts` o el módulo correspondiente, trabajá contra el mock, y anotalo en el CHANGELOG. El otro agente lo ve y lo implementa en su turno.

> `convex/schema.ts` es el único archivo de `convex/` que el frontend puede tocar, y **solo** para proponer un cambio de contrato (commit de contrato aislado). El resto de `convex/` es territorio exclusivo de Codex.

---

## 5. Frontend + Figma (workflow del día a día de Claude)

- **Figma es la fuente de verdad del diseño.** Antes de construir, traé el contexto real del frame vía el MCP (copiás el link del frame o lo seleccionás), no lo inventes. Archivo actual y páginas en `docs/figma-context.md`.
- **Frame por frame**, no toda la pantalla de una: más preciso y menos rate limit.
- **Code Connect:** reutilizá los componentes reales del design system (`src/components/`, `src/components/ui/` — RN Reusables / `@rn-primitives`), no reinventes lo que ya existe.
- **Tokens, no valores hardcodeados:** colores, spacing y tipografías salen de los design tokens (`src/theme/` + `tailwind.config.js`). Si falta un token, se propone, no se hardcodea.
- El MCP da el punto de partida; el state, la data real y los edge cases los completás vos. **Estados completos:** loading / empty / error / success.

---

## 6. El loop de una feature típica

1. **Ficha.** Se define objetivo, aceptación, owner, territorio, riesgo, pruebas, rollout, rollback y fuera de alcance.
2. **Contrato.** Si cambia, se actualiza `convex/schema.ts` + firmas de funciones y `convex/CHANGELOG.md` en un PR **solo de contrato**.
3. **Backend (Codex).** En `../orbita-backend`, implementa las funciones Convex validando contra el contrato. Corre `pnpm convex:dev` (regenera `_generated/`), commitea `convex/_generated/`. `pnpm test` + `pnpm typecheck` en verde. PR a `main`.
4. **Frontend (Claude).** En `../orbita-frontend`, actualiza su base desde `main`, trae el diseño de Figma y construye la UI consumiendo los tipos de `api.*` (contra mock si el back todavía no mergeó). Estados completos. PR separado a `main`.
5. **Revisión.** Cada PR demuestra alcance, checks, evidencia y compatibilidad; no incorpora mejoras laterales durante la revisión.
6. **Merge.** Cada rama se actualiza sobre `main` antes del merge. Integración real cuando los PRs necesarios están arriba y staging está verde.
7. **Release.** Un release se corta desde un commit identificable; el RC productivo se prueba en TestFlight y el mismo binario aprobado pasa al App Store.

---

## 7. Cuándo NO conviene anidar (y la alternativa)

Meter un agente adentro de la terminal del otro **no** es el patrón por defecto: es frágil (los TUIs interactivos se pisan) y caro. Solo tiene sentido si querés un **pipeline de orquestación** donde uno dirige al otro programáticamente. En ese caso:

- Forma simple: Codex ejecuta `claude -p "<tarea>"` (modo headless) como un comando más.
- Forma limpia: exponés Claude como MCP server (`claude mcp serve`) y lo registrás en Codex (`codex mcp add`).

> **Caveat de red:** Codex corre comandos en un sandbox con aislamiento de red por defecto. Claude necesita salir a internet para pegarle a la API. Si vas por la vía de orquestación, tenés que habilitar egress de red en el sandbox de Codex, o Claude va a fallar sin explicación clara.

---

## 8. Checklist antes de cada tarea

- [ ] Leí `AGENTS.md` (Codex) o `CLAUDE.md` (Claude) y este `WORKFLOW.md`.
- [ ] Leí `docs/proceso-desarrollo-y-releases.md` y escribí la ficha de tarea.
- [ ] Confirmé mi branch: `git branch --show-current` (¿es la mía? `feature/api` o `feature/web`).
- [ ] El worktree está limpio o entiendo exactamente cada cambio existente; no voy a mezclar trabajo ajeno.
- [ ] Esta tarea tiene un solo objetivo y un fuera-de-alcance explícito.
- [ ] No estoy asumiendo la forma de la API de memoria: la leo del contrato (`convex/schema.ts` + `convex/_generated`).
- [ ] Si necesito cruzar el límite de territorio, lo convierto en un cambio de contrato (+ entrada en `convex/CHANGELOG.md`) en vez de hacerlo yo.
- [ ] (Backend) Si toqué el contrato o funciones, regeneré y commiteé `convex/_generated/`.
- [ ] (Frontend) Hice `git pull` de `main` para tener el `_generated/` al día antes de consumir tipos.
- [ ] `pnpm typecheck` y `pnpm test` en verde antes del PR. *(No hay eslint en este repo: el "lint verde" es el typecheck verde.)*
- [ ] Rebase sobre `main` antes de abrir el PR.
- [ ] Completé el template de PR con riesgo, evidencia, rollout y rollback.

---

## 9. Referencia rápida del stack

| Tema | Valor |
|---|---|
| Frontend | React Native / Expo SDK 54, expo-router, NativeWind + Tailwind |
| API backend | Funciones Convex (queries / mutations / actions) — no REST/tRPC/GraphQL |
| Auth | Clerk (`@clerk/expo`) + `ConvexProviderWithClerk` |
| Deployment Convex | `dutiful-viper-815` (dev, compartido — solo lo corre el backend) |
| Test | `pnpm test` (`tsx --test test/*.test.ts`) |
| Typecheck / "lint" | `pnpm typecheck` (`tsc --noEmit`) — no hay eslint |
| Codegen Convex | `pnpm convex:codegen` / `pnpm convex:dev` (solo backend) |
| Design tokens | `src/theme/` (`text.ts`, `theme.ts`) + `tailwind.config.js` |
| Component library | `src/components/` + `src/components/ui/` (RN Reusables / `@rn-primitives`) |
| Figma | archivo `BEB5v6SbgJn2Nipm8Qa0wE` (ver `docs/figma-context.md`) |
| Package manager | pnpm |
