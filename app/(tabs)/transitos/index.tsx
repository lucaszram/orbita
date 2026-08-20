/**
 * Wrapper de ruta. La implementación vive FUERA de `app/`, en
 * `src/routes/v492/transitos-index` (`.tsx` nativo / `.web.tsx` web).
 *
 * Expo Router incluye en el grafo TODOS los archivos de `app/`, así que una
 * rama `process.env.EXPO_OS` acá metía la pantalla web en el bundle nativo (y la
 * nativa en el web) aunque nunca se renderizara. Con las dos implementaciones
 * afuera, la que elige es la resolución por plataforma de Metro y cada bundle
 * sólo ve la suya.
 */
export { default } from "@/routes/v492/transitos-index";
