import type { ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { RequireSession } from "@/components/web/require-session";
import { WebNav, type NavKey } from "@/components/web/web-nav";
import { layoutModeFor, reservesBottomNav, WEB_BOTTOM_NAV_HEIGHT, WEB_SHELL_BACKGROUND } from "@/domain/webLayout";
import { LayoutModeProvider } from "@/hooks/useLayoutMode";

/**
 * Chrome de la app en web.
 *
 * Las pantallas canónicas vienen del nativo, donde la navegación la pone el
 * layout de pestañas (`app/(tabs)/_layout.tsx`). Las rutas web viven FUERA de
 * ese grupo, así que al pasar a servir las pantallas canónicas la web se quedó
 * sin ninguna navegación. Este shell la devuelve, con la MISMA arquitectura que
 * las pestañas nativas.
 *
 * Y es además el ÚNICO lugar del producto que lee el viewport: de acá sale el
 * modo (`mobile` | `desktop`) que consumen las pantallas por contexto. Ninguna
 * de ellas vuelve a preguntar cuánto mide la ventana — los tamaños de rueda,
 * radar y heros siguen saliendo del contenedor medido.
 */
export function WebAppShell({ active, children }: { active: NavKey; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const mode = layoutModeFor(width);
  // La barra inferior es `position: fixed`. El espacio se reserva como PADDING
  // del contenido, no con un `View` suelto al final: ese View no tenía fondo y
  // dejaba una banda BLANCA del documento justo encima de la barra.
  const reserve = reservesBottomNav({ web: true, mode });

  return (
    <LayoutModeProvider mode={mode}>
      <RequireSession>
        <View style={styles.root}>
          <WebNav active={active} />
          <View style={[styles.content, reserve && styles.contentSafeBottom]}>{children}</View>
        </View>
      </RequireSession>
    </LayoutModeProvider>
  );
}

const styles = StyleSheet.create({
  // Un solo negro para el shell y para toda área reservada. El documento lo
  // pinta `global.css`; esto cubre el árbol de React.
  root: { backgroundColor: WEB_SHELL_BACKGROUND, flex: 1 },
  content: { flex: 1 },
  // `calc()` porque la barra suma el área segura del iPhone (barra de gestos de
  // Safari) por debajo de sus 64px.
  contentSafeBottom: {
    paddingBottom: `calc(${WEB_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))` as unknown as number
  }
});
