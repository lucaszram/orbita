# WS2 · El Vacío real (backend + frontend)

**Objetivo:** que El Vacío responda de verdad según la pregunta del usuario + su carta, en vez de la respuesta fija `ORACLE`. Con límite de 1 pregunta por día.

**Archivos (SOLO estos):** `convex/void.ts` (nuevo), `app/reading/void.tsx`. (La tabla `voidAnswers` y el contrato en `convex/schema.ts` YA fueron agregados por el orquestador — NO toques schema.ts.)

## Backend — `convex/void.ts` (nuevo)

Action pública `ask({ question }) → VoidAnswerPayload` (forma en `src/services/appRefs.ts:190`):
```ts
type VoidAnswerPayload = {
  question: string;      // pregunta normalizada
  answer: string;        // respuesta editorial — NUNCA sí/no
  basadoEn: string[];    // placements en MAYÚSCULAS (ej ["LUNA EN ESCORPIO","ASC ESCORPIO"])
  mejorPregunta: string; // una mejor pregunta
  paso: string;          // un paso concreto y seguro
};
```
Patrón (copiá de `convex/transits.ts`): action autenticada con `requireIdentity`, traé la carta con el helper equivalente a `getCurrentChart` (`transits.ts:28`) y birthData (`transits.ts:20`). De la carta salen los `basadoEn` (Luna/Ascendente/Sol reales).

**LLM:** reusá el transporte del gateway `defaultGatewayGenerateText` (`convex/lib/aiGateway.ts:266`) — hoy es módulo-privado, así que **exportalo** (o cloná el fetch) y escribí un prompt builder + parser NUEVOS para `VoidAnswerPayload` (los de la Home, `buildDailyHomeGatewayPrompt`/`parseLlmDailyHomeText`, son de otra forma; no sirven tal cual). Envs: `ORBITA_LLM_ENABLED`, `AI_GATEWAY_API_KEY`, `ORBITA_LLM_MODEL` (`aiGateway.ts:72-82`). Si el LLM está deshabilitado o falla, devolvé un fallback determinístico decente derivado de la carta (no tires error).

**Guardrails (duros, en el prompt):** NUNCA sí/no; sin claims de destino/salud/dinero/legal; entretenimiento + autoconocimiento; voseo argentino. Reusá los strings de guardrail `aiGateway.ts:149-154`.

**Límite 1/día (tabla `voidAnswers`, índice `by_user_date`):** al entrar, buscá fila `(userId, localDate)`. Si existe → devolvé su `payload` (misma respuesta del día, no re-generás). Si no → generás, guardás `{userId, localDate, question, payload, createdAt}` y devolvés. `localDate` viene del cliente o de la timezone del user.

## Frontend — `app/reading/void.tsx`

Hoy: respuesta mock `ORACLE` (`:15-19`), fase `"escuchando"` con `setTimeout(...,2800)` falso (`:34-48`). Cablear:
- En la transición a `"escuchando"`, llamá `useAction(proposedApi.voidAsk)({ question })` (ref ya existe, `appRefs.ts:344`). Al resolver, pasá a `"respuesta"` con el payload real: `answer`→ lo que hoy es `ORACLE.answer` (`:128`), `mejorPregunta`→`:136`, `paso`→`:138`, y `basadoEn[]` reemplaza el string local `basadoEn` (`:32`, render `:132`).
- Sin sesión (`!useLiveApp().isLive`) o error → mantené el mock actual (no rompas la pantalla).
- El "límite 1/día" ya lo maneja el backend (devuelve la misma respuesta); el front solo muestra lo que llega.

## Reglas
- `AGENTS.md`: voseo, sin claims prohibidos, sin inglés visible. Tokens desde `src/theme/orbita.ts`.
- El backend nuevo lo deploya Lucas (`pnpm exec convex dev --once`); no dependas de `_generated` en el front (usás `proposedApi.voidAsk`, que es `anyApi`).
- **NO corras `pnpm typecheck` ni `pnpm test`.** **NO toques** `convex/schema.ts` ni archivos fuera de la lista.
