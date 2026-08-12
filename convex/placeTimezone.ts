"use node";

import { actionGeneric as action } from "convex/server";
import { v } from "convex/values";
import { timezoneAtCoordinates } from "./lib/placeTimezone";

/**
 * Convierte las coordenadas ya elegidas por la persona en una zona IANA.
 * Es una operación local sobre datos empaquetados: cero llamadas externas.
 */
export const atCoordinates = action({
  args: {
    latitude: v.number(),
    longitude: v.number()
  },
  handler: async (_ctx, args) => ({
    timezone: timezoneAtCoordinates(args.latitude, args.longitude)
  })
});
