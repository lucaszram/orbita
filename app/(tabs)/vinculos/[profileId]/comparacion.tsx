/**
 * Wrapper de ruta. La implementación vive FUERA de `app/`, en
 * `src/routes/v492/vinculos-comparacion` (`.tsx` nativo / `.web.tsx` web).
 *
 * Cuelga del perfil (`/vinculos/[profileId]/comparacion`) y no de la raíz de la
 * sección: la comparación es una de las cosas que se pueden hacer con una persona
 * guardada, así que su "volver" tiene que caer en el perfil de esa persona
 * (QA23-005). El segmento dinámico es el mismo `profileId`, y que sea de TU cuenta
 * lo decide la lista autorizada, no la URL.
 */
export { default } from "@/routes/v492/vinculos-comparacion";
