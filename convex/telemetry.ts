import { mutationGeneric as mutation } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const internalApi = internal as any;

/**
 * Telemetría mínima para el testeo interno: el cliente llama `appOpened` una sola
 * vez por instalación (guardado en AsyncStorage). No requiere sesión, así que
 * cubre también a los invitados. Dispara un aviso al bot de Telegram.
 */
export const appOpened = mutation({
  args: { platform: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const platform = args.platform ? ` (${args.platform})` : "";
    await ctx.scheduler.runAfter(0, internalApi.notify.sendTelegram, {
      text: `📲 Nueva instalación de Órbita${platform}`
    });
    return null;
  }
});
