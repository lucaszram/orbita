import type { AuthConfig } from "convex/server";

const clerkJwtIssuerDomain =
  process.env.CLERK_JWT_ISSUER_DOMAIN;

if (!clerkJwtIssuerDomain) {
  console.warn("CLERK_JWT_ISSUER_DOMAIN is not set; Convex auth providers are disabled until Clerk is configured.");
}

export default {
  providers: clerkJwtIssuerDomain
    ? [
        {
          domain: clerkJwtIssuerDomain,
          applicationID: "convex"
        }
      ]
    : []
} satisfies AuthConfig;
