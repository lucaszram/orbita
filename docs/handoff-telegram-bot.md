# Handoff — Bot de Telegram (altas + instalaciones)

Reemplaza analytics (Mixpanel) para el testeo interno: un bot de Telegram avisa
cuando alguien **instala** la app o **crea una cuenta**. El código ya está
implementado y deployado por el front; **falta solo la config** (token + chat id).

## Ya implementado (no rehacer)

- **`convex/notify.ts`** — `internalAction sendTelegram({ text })`: hace `fetch` a
  `https://api.telegram.org/bot<TOKEN>/sendMessage`. Gateado por env; sin config, no-op.
- **`convex/telemetry.ts`** — `mutation appOpened({ platform? })` (pública, sin sesión):
  programa `sendTelegram` con "📲 Nueva instalación de Órbita (<platform>)".
- **`convex/users.ts`** — `getOrCreateCurrentUser`: la **primera** vez que se crea el
  user (alta), programa `sendTelegram` con "🪐 Nueva cuenta en Órbita — <email>".
- **`src/components/InstallPing.tsx`** — el cliente llama `appOpened` **una vez por
  instalación** (flag en AsyncStorage `orbita_install_pinged_v1`). Montado en
  `app/_layout.tsx` bajo el ConvexProvider (corre también para invitados).

Las mutations no pueden hacer `fetch`; por eso el envío va por
`ctx.scheduler.runAfter(0, internal.notify.sendTelegram, …)` (patrón correcto).

## Lo que falta (Lucas / Codex) — solo config

1. **Crear el bot:** en Telegram, hablale a **@BotFather** → `/newbot` → seguí los
   pasos → te da un **token** (`123456789:ABC-DEF...`).
2. **Chat id de destino:** hablale a **@userinfobot** y te devuelve tu `id` (un número).
   - Para un **grupo**: creá el grupo, agregá el bot, y usá el id del grupo (negativo,
     ej. `-1001234567890`). Podés obtenerlo con @userinfobot dentro del grupo o
     leyendo `getUpdates`.
3. **Setear en el env de Convex** (dev y prod):
   ```
   npx convex env set TELEGRAM_BOT_TOKEN 123456789:ABC-DEF...
   npx convex env set TELEGRAM_CHAT_ID 987654321
   ```
   (o desde el dashboard de Convex → Settings → Environment Variables)
4. **Probar:** abrí la app (o creá una cuenta) → debería llegar el mensaje al chat.
   Si no llega: revisar que el bot no esté bloqueado, que el chat id sea correcto, y
   los logs de la action `notify:sendTelegram` en el dashboard de Convex.

## Ideas para después (opcionales)
- Sumar evento de **onboarding completado** (`onboarding.completeBirthData`) con el
  signo/lugar, para distinguir "abrió" de "cargó sus datos".
- Rate-limit / de-dup si el volumen molesta.
- Formato más rico (Markdown) o botones inline.
