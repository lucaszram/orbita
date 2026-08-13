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
