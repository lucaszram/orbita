/**
 * Wrapper de ruta. La implementación vive FUERA de `app/`, en
 * `src/routes/v492/preview-alta` (`.tsx` nativo → redirección a Hoy,
 * `.web.tsx` web → la vista combinada del alta, con su interruptor).
 *
 * Expo Router incluye en el grafo TODOS los archivos de `app/`, también las
 * variantes `.web.tsx`: con la implementación afuera, la que elige es la
 * resolución por plataforma de Metro y cada bundle ve sólo la suya.
 */
export { default } from "@/routes/v492/preview-alta";
