# Subir la app hoy — handoff (sesión 2026-07-08)

Estado para lanzar el testeo interno iOS. Todo el código está en `main` local
(commiteado, `pnpm typecheck` + `pnpm test` 58/58 verdes), **sin push** (el push
dispara Vercel). Los motores backend están **deployados** en el Convex dev
(`dutiful-viper-815`).

## Lo que quedó hecho esta sesión (código, commiteado)

**Motores reales (LLM) — backend deployado + front cableado:**
- **Guía diaria** (`convex/daily.ts`): análisis del cielo de hoy × tu carta, interpretado con LLM, cache 1/día/usuario. La Home lo consume. Spec: `docs/guia-diaria-personalizada.md`.
- **Interpretación natal** (`charts.generatePersonalityReading`): la explicación de cada punto de la carta, con LLM. La sirve `charts.personalityReading`.
- **El Umbral** (`convex/void.ts`): respuesta LLM + guardrails, **cupo 3 free / 5 pro**, preguntas sugeridas personalizadas.
- **Luna** (`convex/sky.ts`): fase lunar real del día.

**Producto / UI:**
- **Carta unificada y explicada**: la Carta = el ex "horóscopo de personalidad". Círculo/Tabla arriba; **abajo toda la explicación visible** (sector por sector), mapa de valores en el medio, aspectos + casas. `/reading/personalidad` → redirect a la carta.
- **Home**: dos modos — normal (uso diario) y **post-onboarding** (`fresh=1`) con la **carta de héroe full-bleed** arriba (VER MI CARTA) + el día abajo. Tríada/signo salen de la MISMA fuente que la Carta (coherencia).
- **Tabs**: `Inicio · Umbral · Tránsitos · Perfil` (la Carta vive en el Perfil; Vínculo parkeado "Próximamente").
- **Tránsitos** cableado al cielo real; **Vínculo/Calendario** "Próximamente" (sin data falsa).
- **Paywall** visible pero siempre pasable (testeo interno).
- **Bot de Telegram** (altas/instalaciones) — `docs/handoff-telegram-bot.md`.
- Rueda inmersiva `/carta-full`; barrido de bugs; estados loading/empty.

**Figma:** inicio post-onboarding armado en el file canónico `BEB5v6SbgJn2Nipm8Qa0wE` → frame "Home / Post-onboarding" (node 432:2).

## Lo que falta para subir hoy — NECESITA A LUCAS

### 1. Flags de Convex (para que el contenido sea LLM real, no fallback)
```
npx convex env set ORBITA_LLM_ENABLED true
npx convex env set AI_GATEWAY_API_KEY <tu key del gateway>
npx convex env set ORBITA_LLM_MODEL <modelo, ej. openai/gpt-4o-mini>
npx convex env set ALLOW_DEV_STUB true          # para el "desbloquear 5" del Umbral
# confirmar que ASTROLOGY_API_USER_ID / KEY están (carta + tránsitos + luna)
# opcional bot: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID (ver docs/handoff-telegram-bot.md)
```
Sin estos, los 4 motores caen al fallback determinístico (andan, pero no son el análisis LLM).

### 2. Verificación logueada (10 min) — lo único que ninguno de los dos vio con data real
Entrás a la app con una cuenta (onboarding → "Guardá tu carta", con tu mail; código dev `424242`). Con sesión + carta real, chequear en vivo:
- **Home**: la guía diaria analiza de verdad ("Venus pasa por tu Sol…"), no "Estructura con ventana".
- **Carta** (desde Perfil → VER MI CARTA): la explicación de cada punto es real (LLM), no plantilla.
- **Umbral**: contador 3/5, preguntas personalizadas, respuesta según tu carta.
- **Luna**: fase real del día.
- **Post-onboarding**: al salir del onboarding, la Home arranca con la carta de héroe.

### 3. Build iOS
- **Ícono 1024×1024 + splash** — NO existen (`icon: None` en app.json). Bloqueante para la store; para test interno EAS pone uno por defecto.
- **Env del build**: el build necesita `EXPO_PUBLIC_CONVEX_URL` + `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (hoy solo en `.env.local`, que EAS no lee). Setearlos como **EAS env** (o `app.json` → `extra.convexUrl` / `extra.clerkPublishableKey`, que `src/services/backendProviders.tsx` ya lee de fallback).
- **Apple Developer / App Store Connect** (lo arrancaste) → para TestFlight.
- **Correr el build**: `eas build -p ios --profile preview` (EAS gestiona credenciales con tu login).
- ✅ Ya corregido: `app.json userInterfaceStyle` pasó de `"light"` a `"dark"` (app siempre oscura).

## Caveats (modo invitado)
- Sin sesión, todo usa mocks/plantilla (chartMock Leo/Piscis/Libra). El contenido LLM real es solo logueado.
- En el Perfil invitado, la fecha ("15 Ene 1996") no coincide con la carta demo (Leo) — es limitación del invitado; con datos reales coincide solo.

## Orden sugerido para subir hoy
1. Setear los flags de Convex (#1).
2. Loguearte y verificar los 4 motores (#2). Si algún texto no cierra, me decís y lo afino.
3. Ícono + env del build (#3).
4. `eas build -p ios --profile preview` → TestFlight interno.
