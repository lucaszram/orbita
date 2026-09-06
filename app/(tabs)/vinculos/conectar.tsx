/**
 * Wrapper de ruta. La implementación vive FUERA de `app/`, en
 * `src/routes/v492/vinculos-conectar` (`.tsx` nativo / `.web.tsx` web).
 *
 * Es un segmento estático: gana siempre contra el dinámico `[profileId]`, así
 * que "conectar" no puede confundirse con el id de una persona.
 */
export { default } from "@/routes/v492/vinculos-conectar";
