# Handoff Claude — 2026-07-14 (para retomar en sesión nueva)

Estado al cortar: la terminal andaba mal y reiniciamos. Esto es lo pendiente y cómo
retomar rápido. Contexto largo en `CURRENT_TASK.md` (entradas 2026-07-13/14).

## Hecho y VERIFICADO (no re-trabajar)

- **Entrada + Login (Figma FIX FLUJO, node `540-2`)**: splash termina en pantalla 01B
  (dos puertas) + `SignInScreen` 01C con email→código Clerk real y OAuth. Verificado
  en simulador hasta la fase código. Archivos: `src/onboarding/{OnboardingFlow,useAccount,screens/SplashScreen,screens/SignInScreen}`.
- **Fix tira Home (guest)**: al sacar la carta, la celda de HOY muestra la carta
  revelada (`DiarioStrip` + prop `guestCardId`). Verificado 2 veces en vivo.
- **Fix Diario "desaparece la carta" (logueado)**: la carta grande sale de `cartaId`
  de la tira, no espera a `getGuide`; beats guardados contra payloads viejos.
  Verificado en código (typecheck + tests); visual pendiente con cuenta logueada.
- **Integración + adelgazamiento (Codex, `feature/web`)**: 74→15,25 MB, fuentes 46→7,
  grupos de Claude sincronizados. Sin commits. Detalle en `../orbita-frontend/CURRENT_TASK.md`.

## PENDIENTE de verificar (rápido)

1. **Diario guest post-fix** — faltó UN paso: con la carta ya sacada en Home, entrar
   al Diario. Esperado: MAR con la carta revelada en la tira + "Te salió X." + nota
   "Creá tu cuenta…". (El fix es `src/domain/guestRitual.ts` + Home + Diario; quedó
   aplicado y con typecheck/tests 59/59 verdes. Solo falta verlo en pantalla.)
2. **Hidratación post-login** (01C): meter el código Clerk y confirmar que con carta
   en Convex cae DERECHO a la Home (saltea onboarding); sin carta sigue onboarding
   con sesión activa. Se prueba en el sim "Orbita-Claude" (ahí está la cuenta
   lucaszramos11@gmail.com a mitad de flujo) o desde cero en el Pro Max.
3. **Pasada visual del árbol adelgazado (`feature/web`)** antes del build 9:
   apertura en frío, onboarding completo, tabs, Home/Tránsitos/Carta/Diario,
   reconexión y reapertura.

## PENDIENTE de hacer

- **Capturas App Store 6.9"** en `docs/app-store-screenshots/iphone-6.9/` — hay 2/6:
  `01-home-ritual-velada.png`, `02-home-carta-revelada.png`. Faltan: guía diaria
  (scroll Home), Tránsitos, carta natal, entrada 01B. Specs y captions en
  `docs/app-store-launch-pack.md` (storyboard línea ~107) y
  `docs/app-store-metadata-draft.md`. Si iPad sigue `supportsTablet: true`, faltan
  también las de iPad 13" (o decidir desactivar tablet).
- **Commits + build 9** (decisión Lucas): propuesta = Claude commitea sus 2 grupos
  como commits separados en main; grupo build 8 lo commitea su dueño; después
  `eas build` → build 9 (el 8 en TestFlight NO tiene nada de lo de arriba).
- **Codex: re-sync a `feature/web` de 3 archivos** tocados post-integración:
  `src/domain/guestRitual.ts` (nuevo), `app/(tabs)/index.tsx`, `app/reading/diario.tsx`.
- **Propuesta pendiente de OK**: prefetch de `daily.getGuide` al arrancar la app
  (mitiga los ~25s de la primera generación diaria, que son backend/etapa 2).

## Entorno — cómo retomar

- **Simuladores**: `iPhone 17 Pro Max` = `F006F2EF-7EF9-448A-934D-1B35A0383BF0`
  (build debug + app guest; status bar ya en 9:41/batería llena). "Orbita-Claude" =
  `C4006EB8…` (cuenta real a mitad de login). El `iPhone 17` quedó apagado a propósito
  (la máquina estaba en swap de 12 GB; no bootear 3 sims a la vez).
- **Metro**: correr `pnpm exec expo start --port 8082 --dev-client` desde la raíz
  (muere con la sesión). Si la app muestra "No script URL provided":
  `xcrun simctl spawn <UDID> defaults write com.lucasssram.orbita RCT_jsLocation "127.0.0.1:8082"`
  y relanzar la app.
- **Capturas**: `xcrun simctl io <UDID> screenshot out.png` (resolución nativa
  1320×2868 = 6.9" exacto). El build es DEBUG: no juzgar performance con él.
- **Control de pantalla (computer use)**: lo tiene tomado una sesión vieja de Claude
  (`d4b333fc…`). Cerrarla con `/exit` en su terminal para que la sesión nueva pueda
  tocar el simulador; si no, pedirle los taps a Lucas.
- **Vigía de pantallas** (si hace falta de nuevo): loop de `simctl screenshot` cada 4s
  comparando un hash de franjas superior/inferior (la carta "respira": comparar el
  frame entero da falsos positivos).

## Regla vigente

Territorio Claude = `app/**`, `src/**`, `assets/**` en main. `convex/**` = Codex.
Nadie commitea/publica sin OK de Lucas.
