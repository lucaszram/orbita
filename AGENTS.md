# Codex Startup Instructions

At the start of every new thread in this project:

1. Read `PROJECT_CONTEXT.md`.
2. Read `CURRENT_TASK.md` if it exists.
3. Read `docs/contexto-actual.md`.
4. Read `WORKFLOW.md` and `docs/proceso-desarrollo-y-releases.md` before planning or changing files.
5. If the task touches Figma, design, onboarding, Home, copy, or assets, read `docs/figma-context.md`, `docs/ritmo-trabajo.md`, and `docs/assets-needed.md`.
6. Inspect the current workspace state before changing files. Try `git status --short`; if this folder is not a git checkout, say that plainly and continue with file inspection.
7. Briefly summarize what you understand: project, current goal, relevant files, and next step.
8. Do not assume old thread history. Treat these markdown files as the source of truth.

## Project Rules

- Keep changes scoped.
- Follow **one objective, one branch, one PR**. If a second independent objective appears, split it into another task/PR.
- Start every task with the brief defined in `docs/proceso-desarrollo-y-releases.md`: objective, acceptance criteria, owner, allowed territory, risk, tests, rollout, rollback, and out-of-scope.
- Prefer existing project patterns, documents, and naming.
- First define exact copy and screen structure; then touch Figma or code.
- For Figma work, use the current file and pages listed in `docs/figma-context.md`.
- For assets, preserve raw inputs and create selected/rejected/reference folders instead of overwriting originals.
- Update `CURRENT_TASK.md` whenever the plan, status, decisions, next steps, or handoff context changes.
- If the task gets too large or the thread gets noisy, write a clear handoff into `CURRENT_TASK.md`.

## Multi-agent workflow

- Este repo se trabaja con dos agentes como pares: **Codex = backend**, **Claude = frontend**. Ver `WORKFLOW.md` (canónico).
- **Tu territorio (Codex):** `convex/**` (schema, funciones, `lib/`). Sos el **único** que corre `pnpm convex:dev` / `pnpm convex:codegen` y el que **commitea `convex/_generated/`**. No edités `app/**` ni `src/**` (territorio de Claude).
- **El contrato** entre back y front es `convex/schema.ts` + las firmas `args`/`returns` de cada función. Todo cambio de contrato se anota en `convex/CHANGELOG.md` y se commitea **solo**, sin mezclarlo con una feature.
- Trabajás en el worktree `../orbita-backend` (branch `feature/api`). Todo entra por PR a `main`; rebase antes del PR.
- Antes del PR: `pnpm test` + `pnpm typecheck` en verde (no hay eslint).
- Ningún agente despliega o publica producción sin aprobación explícita de Lucas y los gates de `docs/proceso-desarrollo-y-releases.md`.

## Product Guardrails

- Current brand is `Órbita`.
- Previous project names are technical legacy only.
- Intermediate visual/copy explorations are historical only.
- Keep the product framed as entertainment, self-knowledge, and daily context.
- Do not make claims about destiny, guaranteed results, health, money, legal decisions, or psychological advice.
- Do not mention `NASA/JPL` or `astrología védica` unless there is an explicit product decision and real backing.

## Expected Opening Summary

When you start, answer in a short Spanish summary:

- what Órbita is,
- what the current task appears to be,
- which docs/files you read,
- whether the repo has git status available,
- what you will do next.
