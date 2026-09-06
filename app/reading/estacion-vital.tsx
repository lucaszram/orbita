/**
 * Wrapper de ruta. La implementación vive FUERA de `app/`, en
 * `src/routes/v492/reading-estacion-vital` (`.tsx` nativo → redirección a la pantalla
 * V4.9.2 equivalente, `.web.tsx` web → la pantalla de la web). Así el binario
 * nativo no empaqueta la pantalla web (CORE-247).
 */
export { default } from "@/routes/v492/reading-estacion-vital";
