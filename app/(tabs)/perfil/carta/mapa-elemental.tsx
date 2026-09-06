/**
 * Wrapper de ruta. La implementación vive FUERA de `app/`, en
 * `src/routes/v492/perfil-carta-mapa-elemental` (`.tsx` nativo / `.web.tsx` web).
 *
 * Expo Router incluye en el grafo TODOS los archivos de `app/`, también las
 * variantes `.web.tsx`: con la implementación afuera, la que elige es la
 * resolución por plataforma de Metro y el nativo no llega a ver el módulo web.
 */
export { default } from "@/routes/v492/perfil-carta-mapa-elemental";
