import { useConvexAuth } from "convex/react";

export type OrbitaAuth = {
  /** Clerk terminó de cargar la sesión. */
  isLoaded: boolean;
  /** Hay sesión de Clerk. */
  isSignedIn: boolean;
  /** Convex confirmó identidad (handshake Clerk→Convex JWT). */
  isAuthenticated: boolean;
  /** Convex todavía confirmando. */
  isConnecting: boolean;
  /** Id estable del usuario Clerk (clave del snapshot local por cuenta). */
  userId?: string;
  email?: string;
  name?: string;
  imageUrl?: string;
  signOut: () => Promise<void>;
};

/**
 * Estado de auth para el consumer web. Extraído del patrón de
 * `orbita-studio.tsx` / `BackofficeLab.tsx` (sin el allowlist `checkAccess`).
 *
 * IMPORTANTE: llamar SOLO desde un componente que se monta cuando
 * `backendConfig.hasClerk` es true (o sea, con `ClerkProvider` montado).
 * Si no, `require("@clerk/expo")`/`useAuth` no tienen provider y tiran error.
 */
export function useOrbitaAuth(): OrbitaAuth {
  const { useAuth, useUser } = require("@clerk/expo") as typeof import("@clerk/expo");
  const auth = useAuth();
  const { user } = useUser();
  const convexAuth = useConvexAuth();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress;
  return {
    isLoaded: auth.isLoaded,
    isSignedIn: !!auth.isSignedIn,
    isAuthenticated: convexAuth.isAuthenticated,
    isConnecting: convexAuth.isLoading,
    userId: auth.userId ?? undefined,
    email,
    name: user?.firstName ?? user?.username ?? undefined,
    imageUrl: user?.hasImage ? user?.imageUrl : undefined,
    signOut: () => auth.signOut()
  };
}
