import { internalMutationGeneric as internalMutation } from "convex/server";
import { v } from "convex/values";

// Migración de un solo uso: renombra el entitlement legacy `plus` a `orbita_pro`
// en `subscriptions` y `contentModules`. Después de correrla, un commit posterior
// saca `plus` del validator `entitlement` en schema.ts.
//
// Correr con: pnpm exec convex run migrations:renamePlusToOrbitaPro --deployment <dep>
export const renamePlusToOrbitaPro = internalMutation({
  args: {},
  returns: v.object({
    subscriptions: v.number(),
    contentModules: v.number()
  }),
  handler: async (ctx) => {
    let subscriptions = 0;
    for (const row of await ctx.db.query("subscriptions").collect()) {
      if (row.entitlement === "plus") {
        await ctx.db.patch(row._id, { entitlement: "orbita_pro" });
        subscriptions += 1;
      }
    }

    let contentModules = 0;
    for (const row of await ctx.db.query("contentModules").collect()) {
      if (row.entitlement === "plus") {
        await ctx.db.patch(row._id, { entitlement: "orbita_pro" });
        contentModules += 1;
      }
    }

    return { subscriptions, contentModules };
  }
});
