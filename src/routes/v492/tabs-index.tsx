import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { CARTA_TAB_ROUTE } from "@/domain/appRoutes";
import { startTab } from "@/domain/planAccess";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { useSessionResilience } from "@/hooks/useSessionResilience";
import { backendConfig } from "@/services/backendProviders";
import { BOOT_ACCENT, BOOT_BACKGROUND } from "@/theme/boot";

/**
 * Ruta histórica de la Home: la que abre el shell de pestañas.
 *
 * A esta ruta llegan `router.replace("/(tabs)")` —el destino de `AccountGate`
 * cuando la cuenta ya está completa— y la restauración de navegación de iOS.
 * No dibuja nada propio: elige la pestaña con la que arranca la app.
 *
 * **Qué cambia en el build 30.** El arranque dejó de ser fijo en `Hoy`: esa
 * pestaña no se calcula con Órbita Free, así que abrir la app ahí dejaba a la
 * mitad de las cuentas mirando un bloqueo como primera pantalla. La regla vive
 * en `@/domain/planAccess` (`startTab`, con pruebas) y es una sola: Plus entra
 * por `Hoy`, Free por su carta, el plan sin resolver espera y la sesión
 * degradada —que nunca va a resolver el plan— cae también en la carta, que es
 * lo que el shell degradado puede sostener con los últimos datos de esta misma
 * cuenta.
 *
 * La espera es un instante y ocurre con el shell ya montado, así que se pinta
 * con el fondo del shell: un frame claro acá sería el mismo parpadeo que se
 * corrigió en QA23-006.
 *
 * En web sigue siendo exactamente lo de siempre: ver `tabs-index.web.tsx`.
 */
export default function Route() {
  const acceso = usePlanAccess();
  const { confidence } = useSessionResilience();
  const destino = startTab({
    access: acceso,
    degraded: confidence === "degraded-local",
    backendConfigured: backendConfig.isConfigured
  });

  if (destino === "esperar") {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={BOOT_ACCENT} />
      </View>
    );
  }
  return <Redirect href={(destino === "hoy" ? "/hoy" : CARTA_TAB_ROUTE) as never} />;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: BOOT_BACKGROUND,
    flex: 1,
    justifyContent: "center"
  }
});
