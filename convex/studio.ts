import { queryGeneric as query } from "convex/server";
import { requireBackofficeIdentity } from "./lib/backoffice";

export const checkAccess = query({
  handler: async (ctx) => {
    const identity = await requireBackofficeIdentity(ctx);

    return {
      allowed: true,
      email: identity.email,
      name: identity.name ?? identity.givenName ?? identity.nickname ?? identity.preferredUsername
    };
  }
});
