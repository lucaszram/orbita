// Órbita — configuración dinámica de Expo.
//
// Envuelve `app.json` y NO cambia ninguno de sus campos: Expo lee primero el
// estático, lo pasa acá como `config` y este archivo le agrega una sola cosa,
// `extra.environment`. Todo lo demás —nombre, esquema, íconos, plugins, EAS,
// `expo.web`— sigue viviendo en `app.json`, que es donde se lee y se firma.
//
// ## Por qué hace falta
//
// El contrato de eventos exige que `environment` salga del scope de despliegue y
// NUNCA del hostname ni del proyecto de destino (`docs/analytics/event-contract.md`,
// sección 2). Vercel expone ese scope en el build como `VERCEL_ENV`
// (`production` | `preview` | `development`), pero Metro sólo embebe en el
// bundle las variables que empiezan con `EXPO_PUBLIC_`: `VERCEL_ENV` existe
// durante el build y desaparece en el navegador.
//
// El puente que el repo ya usa para pasar valores del build al bundle es
// `extra` + `expo-constants` (`src/services/backendProviders.tsx` lee así
// `convexUrl` y `clerkPublishableKey`). Esto es lo mismo, para un valor más.
//
// ## Por qué la lista de entornos está escrita acá
//
// La versión ejecutable del contrato (`src/analytics/eventContract.ts`) es un
// módulo TypeScript con `import`/`export`, y este archivo lo evalúa Node durante
// el build de Vercel, sin transpilar y con la versión de Node que elija la
// plataforma. Requerirlo desde acá haría que el build entero dependa de que ese
// Node sepa cargar TypeScript. La lista se repite, y `test/webPageviewTelemetry.test.ts`
// recorre `ENVIRONMENTS` del contrato exigiendo que este archivo devuelva cada
// uno de sus valores: si un día no coinciden, falla la suite y no el deploy.
//
// Sin `VERCEL_ENV` —una corrida local, CI— el entorno es `development`.
const ENVIRONMENTS = ["production", "preview", "development"];

/** El scope del despliegue, o `development` si no hay ninguno declarado. */
function resolveEnvironment(value) {
  return ENVIRONMENTS.includes(value) ? value : "development";
}

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    environment: resolveEnvironment(process.env.VERCEL_ENV)
  }
});
