import { internalActionGeneric as internalAction } from "convex/server";
import { v } from "convex/values";

/**
 * Notificaciones operativas a un bot de Telegram (reemplaza analytics para el
 * testeo interno). Se dispara desde mutations vía `ctx.scheduler.runAfter(0, ...)`
 * porque las mutations no pueden hacer `fetch` — las actions sí.
 *
 * Config (env de Convex): `TELEGRAM_BOT_TOKEN` (de @BotFather) y `TELEGRAM_CHAT_ID`
 * (tu chat/grupo). Sin ambos, es no-op silencioso.
 */
export const sendTelegram = internalAction({
  args: { text: v.string() },
  handler: async (_ctx, args) => {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
    if (!token || !chatId) {
      return null;
    }

    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: args.text })
      });
    } catch {
      // Best-effort: nunca romper el flujo del usuario por una notificación.
    }
    return null;
  }
});
