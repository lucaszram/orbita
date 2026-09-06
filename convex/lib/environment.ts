/**
 * ¿Este deployment es producción?
 *
 * Se conservan las tres señales que ya usaba el guard del laboratorio, con la
 * misma semántica: cualquiera de ellas alcanza para considerarlo producción.
 * `ORBITA_ENV` se suma como señal adicional (no reemplaza a ninguna), para
 * deployments que declaren su entorno de forma explícita.
 *
 * Deliberadamente NO se mira `NODE_ENV`: un deployment de desarrollo puede
 * traerlo en "production" por el bundler y apagaría el lab sin motivo.
 */
type EnvSource = Record<string, string | undefined>;

export function isProductionEnvironment(env: EnvSource = process.env): boolean {
  const declared = env.ORBITA_ENV?.trim().toLowerCase();

  return (
    env.ORBITA_ENVIRONMENT === "production" ||
    env.COMMERCE_MODE === "live" ||
    env.CONVEX_DEPLOYMENT?.startsWith("prod:") === true ||
    declared === "production" ||
    declared === "prod"
  );
}

export type DeploymentEnvironment = "production" | "development" | "unknown";

/**
 * Entorno DECLARADO del deployment, para las decisiones que deben fallar
 * cerradas.
 *
 * `isProductionEnvironment` contesta una pregunta binaria y trata "no es
 * producción" como development. Eso alcanza para apagar el laboratorio, pero no
 * para decidir qué recibo de la tienda se acepta: un deployment sin configurar
 * terminaría consumiendo recibos Sandbox como si fuera un entorno de prueba.
 * Acá la ausencia de señal es su propio estado, `unknown`, y quien la consulta
 * decide en consecuencia.
 */
export function resolveDeploymentEnvironment(env: EnvSource = process.env): DeploymentEnvironment {
  if (isProductionEnvironment(env)) return "production";

  const declared = env.ORBITA_ENV?.trim().toLowerCase();
  const isDevelopment =
    env.ORBITA_ENVIRONMENT === "development" ||
    env.COMMERCE_MODE === "test" ||
    env.CONVEX_DEPLOYMENT?.startsWith("dev:") === true ||
    env.CONVEX_DEPLOYMENT?.startsWith("local:") === true ||
    declared === "development" ||
    declared === "dev" ||
    declared === "local";

  return isDevelopment ? "development" : "unknown";
}
