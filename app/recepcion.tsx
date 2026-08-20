/**
 * Wrapper de ruta. La implementación vive FUERA de `app/`, en
 * `src/routes/v492/recepcion` (`.tsx` nativo → marca la primera vez y entra a
 * la Carta del Perfil, `.web.tsx` web → la ceremonia del día 1 de siempre).
 *
 * Expo Router incluye en el grafo TODOS los archivos de `app/`, también las
 * variantes `.web.tsx`: con la implementación afuera, la que elige es la
 * resolución por plataforma de Metro y cada bundle ve sólo la suya.
 */
export { default } from "@/routes/v492/recepcion";
