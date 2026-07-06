/**
 * Definición del onboarding web (gamification) — MISMAS preguntas y copy que el
 * onboarding de la app (`app/onboarding.tsx`, flujo V4.4). Fuente de verdad del
 * contenido para que web y app no diverjan.
 */

export type Identity = "ella" | "el" | "prefiero_no_decirlo";
export type PlanId = "weekly" | "annual";

export type OnboardingStepKind =
  | "intro"
  | "promise"
  | "identity"
  | "date"
  | "place"
  | "time"
  | "calc"
  | "reveal"
  | "beforeafter"
  | "account"
  | "payment";

export type OnboardingStep = {
  id: string;
  kind: OnboardingStepKind;
  /** Cuenta para la barra de progreso (los intros/reveal no suman). */
  counts: boolean;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: "intro", kind: "intro", counts: false },
  { id: "promise-1", kind: "promise", counts: false },
  { id: "identity", kind: "identity", counts: true },
  { id: "promise-2", kind: "promise", counts: false },
  { id: "date", kind: "date", counts: true },
  { id: "place", kind: "place", counts: true },
  { id: "time", kind: "time", counts: true },
  { id: "calc", kind: "calc", counts: false },
  { id: "reveal", kind: "reveal", counts: false },
  { id: "beforeafter", kind: "beforeafter", counts: false },
  { id: "account", kind: "account", counts: true },
  { id: "payment", kind: "payment", counts: true }
];

export const IDENTITY_OPTIONS: Array<{ value: Identity; label: string }> = [
  { value: "ella", label: "Ella" },
  { value: "el", label: "Él" },
  { value: "prefiero_no_decirlo", label: "Prefiero no decirlo" }
];

export const PLACE_SUGGESTIONS = [
  "Buenos Aires, Argentina",
  "Córdoba, Argentina",
  "Rosario, Argentina",
  "Montevideo, Uruguay",
  "Santiago, Chile",
  "Ciudad de México, México",
  "Madrid, España"
];

export const PLANS: Array<{ id: PlanId; name: string; price: string; per: string; note?: string; badge?: string }> = [
  { id: "weekly", name: "Semanal", price: "$5", per: "por semana" },
  { id: "annual", name: "Anual", price: "$30", per: "por año", note: "$0.58 por semana", badge: "MEJOR VALOR" }
];

export const PLAN_BENEFITS = [
  "Carta natal completa",
  "Guía diaria personalizada",
  "Tránsitos en tu carta"
];

export const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];
