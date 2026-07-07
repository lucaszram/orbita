import { actionGeneric as action } from "convex/server";
import { v } from "convex/values";
import { resolvePlaceWithAstrologyApi } from "./lib/astrologyApi";
import { toSerializable } from "./lib/orbita";

export const resolve = action({
  args: {
    query: v.string()
  },
  handler: async (_ctx, args) => {
    const query = args.query.trim();

    if (query.length < 2) {
      return {
        status: "error" as const,
        places: [],
        error: "query_too_short"
      };
    }

    const result = await resolvePlaceWithAstrologyApi(query);
    return toSerializable({
      status: result.status,
      places: result.places.map((place) => ({
        label: place.label,
        placeId: place.placeId,
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: place.timezone
      })),
      error: result.error
    });
  }
});
