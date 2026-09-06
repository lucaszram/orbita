import { ConvexHttpClient } from "convex/browser";

import type {
  AnonymousSignupDraftTransport,
  SignupDraftInput
} from "@/domain/anonymousSignupDraft";
import { appApi } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";

/**
 * Canal Convex **explícitamente sin autenticar** para el alta anónima.
 *
 * Es un cliente aparte, a propósito. El de la app (`useConvex()`) lo autentica
 * `ConvexProviderWithAuth` con el token de Clerk apenas Clerk lo resuelve, y ese
 * momento no lo elige el alta: puede caer con `saveDraft` /
 * `confirmSignupDraft` en vuelo. Con identidad, `saveDraft` marca el borrador
 * como `accountState: "created"` y `confirmSignupDraft` ya nunca vuelve a
 * devolver `ready` — ni siquiera cuando la sesión se va. El alta queda trabada
 * sin salida.
 *
 * Sobre este cliente **no se llama `setAuth` en ningún lado**: no tiene de dónde
 * sacar un token, así que el contexto anónimo que exige el backend deja de ser
 * una carrera y pasa a ser una propiedad del canal.
 *
 * Es `ConvexHttpClient`, no un segundo `ConvexReactClient`: son dos mutaciones
 * imperativas e idempotentes, no hay nada reactivo que suscribir, y un POST por
 * llamada evita abrir un segundo WebSocket que viva toda la app.
 *
 * El contrato del backend no cambia. La guardia anónima sigue siendo suya.
 */

let cached: ConvexHttpClient | null = null;

/** Cliente perezoso y compartido. `null` sin Convex configurado. */
function anonymousClient(): ConvexHttpClient | null {
  if (!backendConfig.convexUrl) return null;
  if (!cached) cached = new ConvexHttpClient(backendConfig.convexUrl);
  return cached;
}

/**
 * Transporte anónimo del borrador del alta. `null` sin Convex: sin backend el
 * alta es local y no hay borrador remoto que confirmar.
 */
export function anonymousSignupDraftTransport(): AnonymousSignupDraftTransport | null {
  const client = anonymousClient();
  if (!client) return null;
  return {
    saveDraft: (args: SignupDraftInput) =>
      client.mutation(appApi.onboarding.saveDraft, {
        clientDraftId: args.clientDraftId,
        currentStep: args.currentStep,
        identity: args.identity,
        birthDate: args.birthDate,
        birthTime: args.birthTime,
        birthTimePrecision: args.birthTimePrecision,
        birthPlaceLabel: args.birthPlaceLabel,
        latitude: args.latitude,
        longitude: args.longitude,
        timezone: args.timezone
      }),
    confirmSignupDraft: (args: { clientDraftId: string }) =>
      client.mutation(appApi.onboarding.confirmSignupDraft, { clientDraftId: args.clientDraftId })
  };
}
