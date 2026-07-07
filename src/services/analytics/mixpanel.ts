import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Cliente Mixpanel liviano sobre la HTTP API (Ingestion). Sin SDK nativo: anda
// igual en app nativa, web y Expo Go. Si no hay token configurado, todo es no-op
// (no rompe nada en dev/local).
//
// Token: EXPO_PUBLIC_MIXPANEL_TOKEN. Eventos de funnel documentados en
// docs/ (mega plan Fase 5).

const MIXPANEL_TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;
const TRACK_URL = "https://api.mixpanel.com/track";
const ENGAGE_URL = "https://api.mixpanel.com/engage";
const DISTINCT_ID_KEY = "orbita.mixpanel.distinctId";

// Nombres de evento del funnel de lanzamiento. Ampliable.
export type AnalyticsEvent =
  | "app_opened"
  | "onboarding_step_viewed"
  | "onboarding_completed"
  | "sign_in_completed"
  | "paywall_viewed"
  | "purchase_started"
  | "purchase_completed"
  | "purchase_failed"
  | "purchase_restored"
  | "home_viewed"
  | "page_viewed"
  | "checkout_started";

type Props = Record<string, unknown>;

let distinctId: string | null = null;
let identified = false;
let superProps: Props = { platform: Platform.OS };

export function isAnalyticsEnabled(): boolean {
  return Boolean(MIXPANEL_TOKEN);
}

function generateId(): string {
  return `orbita-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function ensureDistinctId(): Promise<string> {
  if (distinctId) return distinctId;
  try {
    const stored = await AsyncStorage.getItem(DISTINCT_ID_KEY);
    if (stored) {
      distinctId = stored;
      return stored;
    }
  } catch {
    // AsyncStorage no disponible (ej. algunos entornos web): id efímero.
  }
  const fresh = generateId();
  distinctId = fresh;
  try {
    await AsyncStorage.setItem(DISTINCT_ID_KEY, fresh);
  } catch {
    // ignorar
  }
  return fresh;
}

async function post(url: string, payload: unknown): Promise<void> {
  if (!MIXPANEL_TOKEN) return;
  try {
    await fetch(`${url}?ip=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/plain" },
      body: JSON.stringify(payload)
    });
  } catch {
    // Analytics nunca debe romper el flujo del usuario.
  }
}

// Llamar una vez al inicio de la app.
export async function initAnalytics(): Promise<void> {
  if (!MIXPANEL_TOKEN) return;
  await ensureDistinctId();
  await track("app_opened");
}

// Props que se adjuntan a todos los eventos (ej. app_version, is_pro).
export function registerSuperProps(props: Props): void {
  superProps = { ...superProps, ...props };
}

// Vincula el usuario anónimo con su identidad (clerkUserId).
export async function identify(userId: string, userProps?: Props): Promise<void> {
  if (!MIXPANEL_TOKEN || !userId) return;
  const anonId = await ensureDistinctId();

  // Alias del id anónimo al userId real vía $identify.
  await post(TRACK_URL, [
    {
      event: "$identify",
      properties: {
        token: MIXPANEL_TOKEN,
        $identified_id: userId,
        $anon_id: anonId,
        distinct_id: userId
      }
    }
  ]);

  distinctId = userId;
  identified = true;

  if (userProps) {
    await setUserProps(userProps);
  }
}

export async function setUserProps(props: Props): Promise<void> {
  if (!MIXPANEL_TOKEN || !distinctId) return;
  await post(ENGAGE_URL, [
    {
      $token: MIXPANEL_TOKEN,
      $distinct_id: distinctId,
      $set: props
    }
  ]);
}

export async function track(event: AnalyticsEvent, props?: Props): Promise<void> {
  if (!MIXPANEL_TOKEN) return;
  const id = await ensureDistinctId();
  await post(TRACK_URL, [
    {
      event,
      properties: {
        token: MIXPANEL_TOKEN,
        distinct_id: id,
        time: Date.now(),
        $insert_id: generateId(),
        ...superProps,
        ...props
      }
    }
  ]);
}

// Al cerrar sesión: volver a un id anónimo nuevo.
export async function resetAnalytics(): Promise<void> {
  identified = false;
  distinctId = generateId();
  try {
    await AsyncStorage.setItem(DISTINCT_ID_KEY, distinctId);
  } catch {
    // ignorar
  }
}

export function isIdentified(): boolean {
  return identified;
}
