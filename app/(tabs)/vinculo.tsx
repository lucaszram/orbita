
/**
 * Wrapper de ruta. La implementación vive FUERA de `app/`, en
 * `src/routes/v492/tabs-vinculo` (`.tsx` nativo / `.web.tsx` web).
 *
 * Expo Router incluye en el grafo TODOS los archivos de `app/`, también las
 * variantes `.web.tsx`: por eso el bundle nativo terminaba empaquetando el
 * árbol web (landing, Home, tarot) aunque nunca lo renderizara. Con la
 * implementación afuera, la que elige es la resolución por plataforma de Metro
 * y el nativo no llega a ver el módulo web.
 */
export { default } from "@/routes/v492/tabs-vinculo";
