/**
 * Wrapper de ruta. La implementación vive FUERA de `app/`, en
 * `src/routes/v492/transitos-capa` (`.tsx` nativo / `.web.tsx` web).
 *
 * Expo Router incluye en el grafo TODOS los archivos de `app/`, también las
 * variantes `.web.tsx`: por eso el bundle nativo terminaba empaquetando el
 * árbol web aunque nunca lo renderizara. Con la implementación afuera, la que
 * elige es la resolución por plataforma de Metro y cada bundle sólo ve la suya.
 */
export { default } from "@/routes/v492/transitos-capa";
