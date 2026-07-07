# Órbita — Todo lo que falta (estado al 2026-07-06)

Mapa de pendientes después de cerrar: app core V4.7 completo en código (5 tabs +
detalles + Void + Estados + Exploración), onboarding inmersivo como flujo oficial,
capa live Convex (local-first) y cuenta Clerk cableada en el onboarding.

Leyenda de dueño: **[Lucas]** decisión/acción tuya · **[Front]** esta sesión (Claude)
· **[Backend]** territorio `convex/` (Codex, o Claude con tu OK ya dado de palabra).

---

## 1. Activar cuentas y modo live (bloqueado por una key)

- [ ] **[Lucas] Pegar la publishable key de Clerk** en `.env.local`:
      `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…` (dashboard Clerk → app "Orbita"
      → API Keys). Hoy está **vacía** y sin ella no montan las cuentas.
      Alternativa: correr `clerk env pull` en la raíz del worktree.
- [ ] **[Front] E2E del flujo de cuenta** una vez que esté la key: reiniciar Metro,
      onboarding → "Guardá tu carta" con mail `algo+clerk_test@example.com`
      (código fijo `424242` en dev) → verificar `birthData` + carta + lectura en
      Convex y Home con `homeSource: "live"`.
- [ ] **[Front] Login para usuarios existentes fuera del onboarding** (hoy la
      entrada es solo la pantalla de cuenta del onboarding; Perfil muestra estado
      pero no tiene sign-in directo).

## 2. Motor astrológico real (para que cada texto sea personalizado)

Hoy TODO el contenido backend es stub: la carta solo deriva el signo solar y la
lectura diaria es texto fijo. Decisión pendiente:

- [ ] **[Lucas] Elegir motor**:
      **(a) `astronomy-engine`** (recomendado): posiciones planetarias reales
      calculadas dentro de Convex, gratis, sin API externa ni credenciales.
      **(b) AstrologyAPI**: requiere cuenta + `ASTROLOGY_API_USER_ID/KEY` como
      env de Convex; data más pro (casas/sistemas), costo por request.
- [ ] **[Backend] Carta natal real**: reemplazar `buildNatalChartSnapshot`
      (`convex/lib/orbita.ts`) — Sol/Luna/planetas por signo y grado; ascendente
      y casas si hay hora + lat/lng.
- [ ] **[Backend] Tránsitos del día**: posiciones de hoy vs carta natal →
      aspectos activos (conjunción/oposición/trígono/cuadratura) con orbes.
- [ ] **[Backend] `places.resolve`**: geocoding + timezone real del lugar de
      nacimiento (hoy el onboarding guarda solo el label, sin lat/lng).
- [ ] **[Lucas] Deploy**: cada vez que cambie `convex/`, correr
      `pnpm exec convex dev --once` (Claude tiene prohibido deployar).

## 3. Funciones backend faltantes (contratos ya escritos, front ya consume mocks)

Todas propuestas en `convex/schema.ts` (bloques TODO) + `convex/CHANGELOG.md`;
payloads tipados en `src/services/appRefs.ts` y `appCoreRefs.ts`:

- [ ] **[Backend]** `transits.getToday({ localDate })` → TransitDetailPayload — pantalla Tránsito/En el cielo.
- [ ] **[Backend]** `charts.valuesMap()` → ValuesMapPayload — radar Qué te impulsa.
- [ ] **[Backend]** `charts.personalityReading()` → PersonalityReadingPayload — Horóscopo de personalidad.
- [ ] **[Backend]** `void.ask({ question })` → VoidAnswerPayload — El Vacío (guardrail: nunca sí/no; 1 pregunta/día).
- [ ] **[Backend]** `relationships.synastry(...)` → SynastryPayload — Vínculo real (la otra persona sale del onboarding, sin capa social).
- [ ] **[Backend]** `calendar.getMonth({ month })` → CalendarMonthPayload — calendario con intensidad/fases reales.
- [ ] **[Front]** Cablear cada pantalla nativa a su función cuando exista (patrón live+fallback ya montado).

## 4. Contenido personalizado (la capa editorial sobre el motor)

- [ ] **[Backend] `generateToday` real**: componer headline/hacé/evitá/energía/
      acción/topics/lectura larga desde los placements y tránsitos REALES del
      usuario + banco editorial (tabla `contentModules` ya existe, está vacía).
      Regla del Home Lab: hacé/evitá de 3 ítems; bloque `personalization` visible.
- [ ] **[Front→Backend] Migrar los bancos editoriales** que hoy viven en el front
      (`signHomeBank.ts` 12×3 por signo, `homeCatalog.ts`, `catalog.ts`) a
      `contentModules`, manteniéndolos como fallback offline.
- [ ] **[Lucas] Decidir si entra LLM** para redacción variada sobre datos reales
      (guardrails duros ya documentados en AGENTS.md) o si alcanza el banco
      editorial parametrizado para el MVP.
- [ ] **[Backend] Notificación diaria** con contenido real (banco críptico/práctico/
      cariñoso ya diseñado en Figma sección 09) — hoy el recordatorio es local y fijo.

## 5. Producto / diseño pendiente

- [ ] **[Front] Onboarding**: el paso 14 quedó con Clerk; falta que "Continuar con
      Apple/Google" reales (OAuth requiere dev build, hoy son mock) — decidir si
      se ocultan hasta tener build nativa.
- [ ] **[Front] Paywall real**: StoreKit/Play Billing (hoy `subscriptions` es stub;
      el botón EMPEZAR PLUS no cobra). Requiere dev build + cuentas de las stores.
- [ ] **[Front] Widget iOS y notificaciones crípticas** (diseñados en Figma 09):
      widget necesita dev build con extensión nativa — no funciona en Expo Go.
- [ ] **[Figma→Front] Extras** (tarot/color/número/mantra reestilizados) — diseño
      pendiente de tanda propia; el código legacy existe (`ExtrasSection`).
- [ ] **[Figma] Tokens/variables** en el archivo (tarea #1 del tablero): colores/
      tipografías del V4.7 como variables Figma para que diseño y código no driften.
- [ ] **[Lucas] Revisión visual fina** de las pantallas nuevas en el teléfono
      (Void, Estados, Exploración) — hasta ahora gates por simulador.

## 6. Web (frente de la otra sesión / Codex)

- [ ] **[Codex] Arreglar el tsc roto**: `src/components/web/orbita-transit.tsx`
      tiene un error de tipos en su WIP sin commitear (rompe `pnpm typecheck`
      global; los archivos del app core typechequean limpios).
- [ ] **[Codex] Landing + página de datos** (V5.0) — en curso en su worktree.
- [ ] Cuando exista `transits.getToday` real, la web hereda gratis (ya consume
      `proposedApi` con mock-first).

## 7. Infra / distribución

- [ ] **[Front] EAS Update** del app core V4.7 + onboarding nuevo al canal
      `preview` para probar en tu iPhone (la última publicada es anterior a todo
      esto). Ojo: publish histórico necesitó `@babel/plugin-transform-react-jsx`.
- [ ] **[Lucas] Build iOS instalable**: sigue bloqueada por credenciales de Apple
      Developer (ad hoc provisioning). Sin eso: Expo Go + EAS Update.
- [ ] **[Front] Tests**: los 14 actuales cubren el engine local; falta cobertura
      del adapter live (`toHomeReading`) y del merge de `appData`.
- [ ] **[Front] Limpiar rutas web viejas de la app** si ya no aplican
      (`app/home.tsx`, `app/lab.tsx`, etc. son del frente web — coordinar con Codex).

---

**Orden sugerido**: 1 (key, 2 min) → e2e cuentas → 2 con `astronomy-engine` →
4 (`generateToday` real) → 3 (funciones restantes) → 7 (EAS update a tu teléfono).
Con eso, un usuario nuevo crea cuenta y TODO lo que ve sale de su carta real.
