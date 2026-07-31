import { useEffect, useRef, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { usePathname } from "expo-router";
import { RequireSession } from "@/components/web/require-session";
import { WebNav, type NavKey } from "@/components/web/web-nav";
import {
  layoutModeFor,
  reservesBottomNav,
  resetsScrollOnRoute,
  WEB_BOTTOM_NAV_HEIGHT,
  WEB_SHELL_BACKGROUND
} from "@/domain/webLayout";
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
  const pathname = usePathname();
  // La barra inferior es `position: fixed`. El espacio se reserva como PADDING
  // del contenido, no con un `View` suelto al final: ese View no tenía fondo y
  // dejaba una banda BLANCA del documento justo encima de la barra.
  const reserve = reservesBottomNav({ web: true, mode });
  const contentRef = useRef<View>(null);

  useRouteScrollTop({ pathname, enabled: resetsScrollOnRoute({ web: true, mode }), containerRef: contentRef });

  return (
    <LayoutModeProvider mode={mode}>
      <RequireSession>
        <View style={styles.root}>
          <WebNav active={active} />
          <View ref={contentRef} style={[styles.content, reserve && styles.contentSafeBottom]}>
            {children}
          </View>
        </View>
      </RequireSession>
    </LayoutModeProvider>
  );
}

/**
 * Cambiar de destino arranca arriba de todo (sólo escritorio web).
 *
 * El síntoma: hacer click en un destino de la barra y que la pantalla apareciera
 * a media altura, con el contenido cortado debajo del header. Es cómo funciona
 * el stack de navegación —cada pantalla queda montada y conserva su scroll— y
 * en una pestaña de teléfono está bien, pero en la web contradice lo que hace
 * cualquier link.
 *
 * No alcanza con `window.scrollTo`: el documento no scrollea, scrollean los
 * `ScrollView` de cada pantalla, que en react-native-web son divs con
 * `overflow`. Se recorre el subárbol del contenido y se lleva a cero todo lo que
 * quedó scrolleado. Es barato: la pantalla nueva ya está en cero, así que lo
 * único que toca es la que venía con posición vieja.
 */
function useRouteScrollTop({
  pathname,
  enabled,
  containerRef
}: {
  pathname: string;
  enabled: boolean;
  containerRef: { current: View | null };
}) {
  useEffect(() => {
    if (!enabled) return;
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node || typeof node.querySelectorAll !== "function") return;
    for (const el of [node, ...Array.from(node.querySelectorAll("*"))] as HTMLElement[]) {
      if (el.scrollTop) el.scrollTop = 0;
      if (el.scrollLeft) el.scrollLeft = 0;
    }
    // Por si alguna ruta llegara a hacer scrollear el documento.
    if (typeof window !== "undefined" && typeof window.scrollTo === "function") window.scrollTo(0, 0);
  }, [pathname, enabled, containerRef]);
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
