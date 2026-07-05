import type { UserIdentity } from "convex/server";
import { findUserByTokenIdentifier, getOrCreateUser } from "./users";

type ConvexCtx = {
  auth: {
    getUserIdentity(): Promise<UserIdentity | null>;
  };
  db: any;
};

type AuthOnlyCtx = {
  auth: {
    getUserIdentity(): Promise<UserIdentity | null>;
  };
};

function parseEmailList(value?: string) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getBackofficeAllowedEmails() {
  return parseEmailList(process.env.ORBITA_BACKOFFICE_ALLOWED_EMAILS ?? process.env.BACKOFFICE_ALLOWED_EMAILS);
}

function getIdentityEmail(identity: UserIdentity) {
  return identity.email?.trim().toLowerCase();
}

function assertEmailAllowed(email: string | undefined, allowedEmails: string[], allowAll: boolean) {
  if (!allowAll && allowedEmails.length === 0) {
    throw new Error("Backoffice allowlist is not configured. Set ORBITA_BACKOFFICE_ALLOWED_EMAILS in Convex.");
  }

  if (!allowAll && (!email || !allowedEmails.includes(email))) {
    throw new Error("This account is not allowed to use the Órbita backoffice.");
  }
}

export async function requireBackofficeIdentity(ctx: AuthOnlyCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required");
  }

  const email = getIdentityEmail(identity);
  const allowedEmails = getBackofficeAllowedEmails();
  const allowAll = process.env.ORBITA_BACKOFFICE_ALLOW_ALL === "true";
  assertEmailAllowed(email, allowedEmails, allowAll);
  return identity;
}

export async function requireBackofficeExistingUser(ctx: ConvexCtx) {
  const identity = await requireBackofficeIdentity(ctx);
  return await findUserByTokenIdentifier(ctx, identity.tokenIdentifier);
}

export async function requireBackofficeUser(ctx: ConvexCtx) {
  await requireBackofficeIdentity(ctx);
  const user = await getOrCreateUser(ctx);
  if (!user) {
    throw new Error("Unable to load backoffice user.");
  }

  return user;
}
