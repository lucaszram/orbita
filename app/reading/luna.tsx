/**
 * Wrapper de ruta. La implementación vive FUERA de `app/`, en
 * `src/routes/v492/reading-luna` (`.tsx` nativo → redirección a `/hoy/luna`,
 * `.web.tsx` web → la fase lunar de siempre).
 *
 * Expo Router incluye en el grafo TODOS los archivos de `app/`, también las
 * variantes `.web.tsx`: con la implementación afuera, la que elige es la
 * resolución por plataforma de Metro y cada bundle ve sólo la suya.
 */
export { default } from "@/routes/v492/reading-luna";
