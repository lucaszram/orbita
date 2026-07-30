/**
 * Nombres de los meses del alta.
 *
 * Vive aparte del picker a propósito: `BirthPicker` tiene implementación por
 * plataforma (`.tsx` nativo con la rueda, `.web.tsx` con el control del
 * navegador), así que exportar esta lista desde ahí la volvía inalcanzable en
 * web — Metro resuelve el archivo `.web.tsx`, que no la tiene. `OnboardingFlow`
 * la usa para el rótulo de confirmación ("15 de enero de 1996"), y ese rótulo
 * tiene que existir en las dos plataformas.
 */
export const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;
