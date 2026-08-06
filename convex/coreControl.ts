import {
  internalActionGeneric as internalAction,
  internalQueryGeneric as internalQuery,
  makeFunctionReference
} from "convex/server";
import { v } from "convex/values";

const signupPayloadRef = makeFunctionReference<"query">("coreControl:signupPayload");
const sendSignupRef = makeFunctionReference<"action">("coreControl:sendSignup");
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000] as const;

export const signupPayload = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user?.email) return null;
    return {
      appSlug: "orbita",
      email: user.email.trim().toLowerCase(),
      eventId: user.clerkUserId,
      occurredAt: user.createdAt
    };
  }
});

export const sendSignup = internalAction({
  args: { userId: v.id("users"), attempt: v.optional(v.number()) },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const signup = await ctx.runQuery(signupPayloadRef, { userId: args.userId }) as {
      appSlug: string;
      email: string;
      eventId: string;
      occurredAt: number;
    } | null;
    if (!signup) return false;

    const endpoint = process.env.CORE_CONTROL_SIGNUP_URL?.trim();
    const secret = process.env.CORE_CONTROL_SIGNUP_SECRET?.trim();
    if (!endpoint || !secret || !endpoint.startsWith("https://")) return false;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(signup),
        signal: AbortSignal.timeout(8_000)
      });
      if (response.ok) return true;
    } catch {
      // Best-effort; the durable scheduler below retries without blocking signup.
    }

    const attempt = args.attempt ?? 0;
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay !== undefined) {
      await ctx.scheduler.runAfter(delay, sendSignupRef, {
        userId: args.userId,
        attempt: attempt + 1
      });
    }
    return false;
  }
});
