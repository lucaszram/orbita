/**
 * En nativo no hay telemetría web: `WebPageviewTelemetry` (`webTelemetry.tsx`)
 * es exclusivamente del navegador. Esta variante existe para que el layout raíz
 * —que es COMPARTIDO— pueda montarla sin condicionales y sin arrastrar
 * `posthog-js` al bundle de la app, que es el mismo motivo por el que
 * `src/web/route-head.native.tsx` no renderiza nada.
 *
 * La app nativa mide por otro canal (`docs/handoff-claude-product-events.md`) y
 * medirla con este contrato es una tarjeta que todavía no existe.
 */
export function WebPageviewTelemetry() {
  return null;
}
