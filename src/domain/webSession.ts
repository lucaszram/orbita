import type { SessionPhase } from "@/domain/screenPhase";

/**
 * Qué hace una ruta autenticada de la web con la sesión actual.
 *
 * Reemplaza al viejo `LiveGate`, que ante "sin sesión" renderizaba un mock:
 * cualquiera que abriera /home sin cuenta veía una lectura inventada como si
 * fuera suya. Acá "sin sesión" tiene una sola salida: login.
 *
 * `sinBackend` es honesto a propósito. Si falta Convex o Clerk, la web no
 * puede mostrar datos reales, y la respuesta correcta es decirlo, no rellenar
 * con contenido de demostración.
 */
export type WebRouteDecision = "cargando" | "error" | "sinBackend" | "aLogin" | "render";

export function webRouteDecision(input: {
  phase: SessionPhase;
  backendConfigured: boolean;
}): WebRouteDecision {
  if (!input.backendConfigured) return "sinBackend";
  switch (input.phase) {
    case "cargando":
      return "cargando";
    case "error":
      return "error";
    case "invitado":
      return "aLogin";
    case "live":
      return "render";
  }
}

/**
 * Rutas que se sirven sin sesión. Todo lo demás es app y exige cuenta.
 * La lista es cerrada a propósito: agregar una superficie pública es una
 * decisión explícita, no el default de haber olvidado un guard.
 */
export const PUBLIC_WEB_ROUTES = [
  "/",
  "/empezar",
  // `/login` es un alias legado: redirige a `/iniciar-sesion`, el login
  // canónico. Sigue en la lista para no romper enlaces viejos.
  "/login",
  "/iniciar-sesion",
  "/privacy",
  "/terminos",
  "/support"
] as const;

export function isPublicWebRoute(pathname: string): boolean {
  const clean = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  return (PUBLIC_WEB_ROUTES as readonly string[]).includes(clean);
}
