import { Redirect } from "expo-router";

import { WebNotice } from "@/components/web/require-session";
import { SIGN_UP_ROUTE } from "@/domain/appRoutes";
import { backendConfig } from "@/services/backendProviders";

/**
 * `/empezar` es la entrada al alta desde la LANDING web.
 *
 * El alta es auth-first: primero la cuenta (`SIGN_UP_ROUTE`, con la UI oficial
 * de Clerk), y recién después los 13 pasos inmersivos de datos natales. Por eso
 * esta ruta ya no monta `OnboardingGate`: montarlo acá abría el onboarding SIN
 * sesión y dejaba la cuenta para el final, con un borrador anónimo que había
 * que confirmar después. Con la cuenta primero, los pasos arrancan con sesión y
 * escriben sobre una cuenta que ya existe.
 *
 * Esta ruta no decide nada sobre la sesión: quien ya la tenga entra igual a
 * `/crear-cuenta`, y ahí `AccountGate` (superficie `auth`) lo manda a donde le
 * corresponda según el estado REMOTO de la cuenta — onboarding, editor de datos
 * natales o Home. Esa decisión vive en un solo lugar y no se duplica acá.
 */
export default function EmpezarRoute() {
  if (process.env.EXPO_OS !== "web") {
    // Metro resuelve este archivo SÓLO en web; el guard está para que un bundle
    // nativo nunca arrastre el aviso de "sin backend" de la web. El destino es
    // el mismo que el de `empezar.tsx`, así que las dos entradas no divergen.
    return <Redirect href={SIGN_UP_ROUTE} />;
  }

  if (!backendConfig.isConfigured) {
    // Sin Convex+Clerk no hay dónde crear la cuenta ni guardar la carta: se
    // dice, en vez de abrir un alta que no puede terminar.
    return (
      <WebNotice
        title="Órbita no está disponible"
        body="No pudimos conectar con el servidor, así que todavía no podemos crear tu carta. Volvé a intentar en un momento."
      />
    );
  }

  return <Redirect href={SIGN_UP_ROUTE} />;
}
