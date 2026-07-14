# WS6 · Paywall pasable (frontend)

**Objetivo (feedback Lucas):** dejar las paywalls **visibles** pero **siempre pasables** — tocar cualquier plan o el CTA de pago simplemente continúa, sin cobrar. Es para testeo interno gratis. "Si alguien toca para pagar, pasa de una."

**Archivos (SOLO estos):** `src/onboarding/screens/PaywallScreen.tsx`, `app/reading/plus.tsx`.

## Onboarding — `src/onboarding/screens/PaywallScreen.tsx`

- El CTA "Desbloquear Órbita" ya llama `onUnlock` = `submit()` en el flow (crea perfil local y navega a `/(tabs)/carta`), o sea **ya pasa sin cobrar**. Verificá que así sea y que ningún plan seleccionado bloquee el avance.
- La selección de plan (Semanal/Anual) queda **cosmética** — tocar cualquiera no debe frenar; el CTA continúa igual.
- "Restaurar" (`:66`) es texto sin handler: dejalo como no-op explícito o ocultalo (no debe romper).
- No cambies el diseño ni la tríada de arriba (recién aprobado). Cambios mínimos, solo asegurar que nada bloquee.

## Paywall interno — `app/reading/plus.tsx`

- Hoy "EMPEZAR PLUS" hace `router.back()` (`:43`) — o sea no compra, "pasa". Para testeo interno está bien que no cobre; dejalo con un cierre limpio o un copy honesto de "gracias por probar" / "ya tenés acceso en el test". 
- Precios hardcodeados: podés dejarlos (es la pantalla de info), pero que el botón no simule una compra real ni tire error.

## Reglas
- No hace falta tocar `src/onboarding/OnboardingFlow.tsx` salvo que encuentres un bloqueo real; si lo tocás, avisá en el resumen (puede colisionar con otros WS — evitalo).
- `AGENTS.md`: voseo, sin claims prohibidos, sin inglés visible. Tokens desde `src/theme/orbita.ts`.
- **NO corras `pnpm typecheck` ni `pnpm test`.** **NO toques** archivos fuera de la lista.
