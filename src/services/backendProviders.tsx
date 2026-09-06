import Constants from "expo-constants";
import { ConvexProvider, ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { ReactNode, useCallback, useMemo, useRef } from "react";
import { orbitaEsES } from "@/services/clerkLocalization";

const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL ?? extra?.convexUrl;
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? extra?.clerkPublishableKey;

export const backendConfig = {
  convexUrl,
  clerkPublishableKey,
  hasConvex: Boolean(convexUrl),
  hasClerk: Boolean(clerkPublishableKey),
  isConfigured: Boolean(convexUrl && clerkPublishableKey)
};

/**
 * Estado de auth para Convex, con la identidad del token atada al **userId**.
 *
 * ## Por qué no se usa `ConvexProviderWithClerk`
 *
 * La versión instalada memoiza su `fetchAccessToken` con `[orgId, orgRole]` —y
 * nada más—: ignora deliberadamente `getToken` (el hook de Clerk Expo no lo
 * memoiza) y nunca mira el `userId`. En un cambio de cuenta A → B dentro de la
 * misma sesión y la misma organización —logout + login rápido, un token que se
 * refresca sobre otra cuenta— ninguna de sus dependencias cambia, así que no
 * vuelve a llamar `client.setAuth()`: Convex sigue autenticado como A mientras
 * la app ya es B, y las queries devuelven los datos de la cuenta anterior.
 *
 * Envolver su `useAuth` no alcanzaba por lo mismo: la envoltura devolvía una
 * `getToken` nueva por dueño, y esa referencia no entra en sus deps.
 *
 * Acá se implementa el contrato de `ConvexProviderWithAuth` a mano:
 * `fetchAccessToken` cambia de identidad con el `userId` (y con la sesión, la
 * org y el rol), que es exactamente lo que dispara un `setAuth` real. `getToken`
 * se lee de una ref viva porque su referencia es inestable en Expo.
 */
function useConvexAuthFromClerk() {
  const { useAuth } = require("@clerk/expo") as typeof import("@clerk/expo");
  const { isLoaded, isSignedIn, getToken, orgId, orgRole, sessionClaims, userId, sessionId } =
    useAuth();

  // `getToken` no está memoizada en Clerk Expo: si entrara en las deps, la
  // identidad de `fetchAccessToken` cambiaría en cada render y Convex
  // reautenticaría todo el tiempo. Se lee del presente, no del closure.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  // Una sesión cuyo JWT ya viene con `aud: "convex"` no necesita template.
  const usaTemplate = (sessionClaims as { aud?: unknown } | null | undefined)?.aud !== "convex";

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        return usaTemplate
          ? await getTokenRef.current({ template: "convex", skipCache: forceRefreshToken })
          : await getTokenRef.current({ skipCache: forceRefreshToken });
      } catch {
        return null;
      }
    },
    // El DUEÑO es la dependencia que faltaba. La sesión, la org y el rol siguen
    // adentro: son las que el contrato de Clerk quiere reactivas.
    [userId, sessionId, orgId, orgRole, usaTemplate]
  );

  return useMemo(
    () => ({
      isLoading: !isLoaded,
      // Sin `userId` no hay identidad que pedir: se trata como no autenticado.
      isAuthenticated: Boolean(isSignedIn) && Boolean(userId),
      fetchAccessToken
    }),
    [isLoaded, isSignedIn, userId, fetchAccessToken]
  );
}

export function BackendProviders({ children }: { children: ReactNode }) {
  const convex = useMemo(() => (convexUrl ? new ConvexReactClient(convexUrl) : null), []);

  if (!convex) {
    return <>{children}</>;
  }

  if (!clerkPublishableKey) {
    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
  }

  const { ClerkProvider } = require("@clerk/expo");
  const { tokenCache } = require("@clerk/expo/token-cache");

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      tokenCache={tokenCache}
      localization={orbitaEsES}
    >
      {/* `ConvexProviderWithAuth` + hook propio, NO `ConvexProviderWithClerk`:
          el suyo sólo reautentica cuando cambian org/rol, así que un cambio de
          cuenta A → B dejaba a Convex hablando como A. */}
      <ConvexProviderWithAuth client={convex} useAuth={useConvexAuthFromClerk}>
        {children}
      </ConvexProviderWithAuth>
    </ClerkProvider>
  );
}
