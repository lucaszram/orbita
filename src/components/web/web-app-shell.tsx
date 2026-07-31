import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { RequireSession } from "@/components/web/require-session";
import { WEB_BOTTOM_NAV_HEIGHT, WebNav, type NavKey } from "@/components/web/web-nav";

/**
 * Chrome de la app en web.
 *
 * Las pantallas canónicas vienen del nativo, donde la navegación la pone el
 * layout de pestañas (`app/(tabs)/_layout.tsx`). Las rutas web viven FUERA de
 * ese grupo, así que al pasar a servir las pantallas canónicas la web se quedó
 * sin ninguna navegación: se podía entrar a Inicio y no había forma de ir a
 * Tránsitos, Umbral o Perfil. Antes esa barra la traía cada pantalla web
 * duplicada, que es justamente lo que se retiró.
 *
 * Este shell la devuelve, con la MISMA arquitectura que las pestañas nativas.
 */
export function WebAppShell({ active, children }: { active: NavKey; children: ReactNode }) {
  return (
    <RequireSession>
      <View style={styles.root}>
        <WebNav active={active} />
        {/* La barra inferior es `position: fixed`: sin este colchón tapaba el
            final del contenido en móvil. */}
        <View style={styles.content}>{children}</View>
        <View style={styles.bottomSpacer} />
      </View>
    </RequireSession>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  bottomSpacer: { height: WEB_BOTTOM_NAV_HEIGHT }
});
