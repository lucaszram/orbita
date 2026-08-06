/**
 * Analytics de producto — variante WEB (PostHog).
 *
 * Mide una sola cosa: `page_view`, con una única propiedad `path`. Todo el
 * capture automático del SDK está apagado explícitamente, uno por uno, y no por
 * confiar en los defaults del vendor: autocapture de clicks, pageviews por
 * historial, pageleave, heatmaps, dead clicks, rageclicks, encuestas, session
 * replay y métricas de performance. Cada una de esas features lee el DOM del
 * usuario, y el DOM de Órbita tiene fecha de nacimiento, ciudad y correo.
 *
 * Sin `EXPO_PUBLIC_POSTHOG_KEY` el SDK no se inicializa: un build sin la
 * variable no manda nada. Default cerrado, igual que las herramientas internas.
 *
 * La lógica pura (normalizar, deduplicar, limpiar propiedades) vive en
 * `@/domain/pageView` y está testeada; acá sólo queda el cableado con el SDK.
 */
import posthog from "posthog-js";

import {
  PAGE_VIEW_EVENT,
  normalizePagePath,
  resolveAnalyticsConfig,
  sanitizeAnalyticsProperties
} from "@/domain/pageView";

// `process.env.EXPO_PUBLIC_*` tiene que escribirse literal: Expo lo reemplaza
// por su valor en tiempo de build sólo si lo ve escrito así.
const config = resolveAnalyticsConfig({
  key: process.env.EXPO_PUBLIC_POSTHOG_KEY,
  host: process.env.EXPO_PUBLIC_POSTHOG_HOST
});

/** ¿Este build tiene clave pública configurada? */
export const ANALYTICS_ENABLED = config !== null;

let started = false;

export function startAnalytics(): void {
  if (started || config === null) return;
  // El export web se puede prerenderizar: sin `window` no hay nada que medir.
  if (typeof window === "undefined") return;
  started = true;

  posthog.init(config.key, {
    api_host: config.host,
    // Fija el set de defaults del vendor en una fecha conocida, para que una
    // actualización del SDK no encienda features nuevas por su cuenta.
    defaults: "2026-06-25",

    // ── Nada automático. `page_view` se manda a mano, desde el tracker. ──
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_performance: false,
    rageclick: false,
    disable_surveys: true,
    disable_session_recording: true,

    // Nunca llamamos a `identify`: sin perfiles de persona, el evento queda
    // agregado y no se ata a una cuenta de Órbita.
    person_profiles: "never",

    // Los parámetros de campaña que PostHog levanta de la URL por su cuenta.
    // No corremos campañas y son texto libre que viene de afuera.
    property_denylist: [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "gclid",
      "fbclid"
    ],

    // Red de seguridad sobre las propiedades que el SDK arma solo
    // (`$current_url`, `$referrer`, `$pathname`, `$initial_*`): les saca query
    // y fragmento antes de que salgan.
    sanitize_properties: (properties) => sanitizeAnalyticsProperties(properties)
  });
}

export function capturePageView(path: string): void {
  if (!started) return;
  posthog.capture(PAGE_VIEW_EVENT, { path: normalizePagePath(path) });
}
