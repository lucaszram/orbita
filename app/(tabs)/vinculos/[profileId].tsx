/**
 * Wrapper de ruta. La implementación vive FUERA de `app/`, en
 * `src/routes/v492/vinculos-perfil` (`.tsx` nativo / `.web.tsx` web).
 *
 * Es el PERFIL canónico de una persona guardada (QA23-005): dónde aterrizan el
 * alta y la edición, y lo que abren las filas de la raíz. Su comparación cuelga
 * de acá, en `[profileId]/comparacion`.
 *
 * El segmento es el `profileId` real de una persona guardada, así que el enlace
 * sobrevive a recálculos de la comparación. Que ese id sea de TU cuenta lo
 * decide la lista autorizada, no la URL.
 */
export { default } from "@/routes/v492/vinculos-perfil";
