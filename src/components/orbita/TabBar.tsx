import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Touchable } from "@/components/v492/Touchable";
import { tabPressAction } from "@/domain/tabPress";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { orbita } from "@/theme/orbita";

/**
 * Barra de pestañas nativa V4.9.2: Hoy · Tránsitos · Vínculos · Umbral · Perfil.
 *
 * Las cinco pestañas se reparten TODO el ancho: la fila lo declara (`width:
 * "100%"`) y cada ítem crece desde base cero (`flexBasis: 0` + `flexGrow: 1`),
 * así que en 375, 393 o 440 pt cada objetivo mide un quinto de la pantalla y
 * nunca menos de 44 pt. Antes esto no pasaba por dos motivos, los dos
 * corregidos: `flex: 1` dependía de que el contenedor tuviera un ancho ya
 * resuelto, y sobre todo el `style` venía en FORMA FUNCIÓN, que la
 * interoperación de NativeWind descarta entera (ver `Touchable`). El resultado
 * medido era una barra de 195 pt con "Hoy" en 18 pt de ancho.
 *
 * Cada pestaña se anuncia como `tab` dentro de un `tablist` con su estado
 * seleccionado, así que VoiceOver dice "Hoy, pestaña, seleccionada".
 *
 * Dynamic Type manda sobre el diseño: el label crece hasta 2× —el rango
 * accesible de iOS— y REFLUYE hasta dos líneas en vez de encogerse. La barra no
 * tiene alto fijo: crece con el texto y el layout la acompaña.
 *
 * Las rutas fuera de la barra (`index`, `vacio`, `vinculo`, `carta`) existen
 * como redirecciones históricas y no tienen label: no se dibujan.
 *
 * Adónde va cada toque lo decide `@/domain/tabPress` —puro, y por eso probado
 * sin montar el navegador—: `Tránsitos` se abre SIEMPRE en su raíz (`Ahora`)
 * aunque la sección hubiera quedado en `Tu momento`, y las demás pestañas
 * vuelven donde estaban.
 */
const LABELS: Record<string, string> = {
  hoy: "Hoy",
  transitos: "Tránsitos",
  vinculos: "Vínculos",
  umbral: "Umbral",
  perfil: "Carta"
};

type TabRoute = { key: string; name: string };
type OrbitaTabBarProps = {
  state: { index: number; routes: TabRoute[] };
  navigation: {
    emit: (event: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    /** `screen` apunta a una pantalla del stack anidado de esa pestaña. */
    navigate: (name: string, params?: { screen: string }) => void;
  };
};

export function OrbitaTabBar({ state, navigation }: OrbitaTabBarProps) {
  const insets = useSafeAreaInsets();
  // Sin las fonts cargadas, la fallback del sistema mide distinto y los labels
  // se ven mal; reservamos el alto del bar (mínimo, no fijo) pero sin labels.
  const fontsLoaded = useOrbitaFonts();
  if (!fontsLoaded) {
    return <View style={[styles.bar, { paddingBottom: insets.bottom + 10, minHeight: insets.bottom + 62 }]} />;
  }

  const visibles = state.routes.filter((route) => LABELS[route.name]);

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 10 }]} accessibilityRole="tablist">
      {visibles.map((route) => {
        const focused = state.routes[state.index]?.key === route.key;
        const label = LABELS[route.name];
        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          // Qué hacer con el toque lo decide `@/domain/tabPress`, que es puro:
          // re-tocar la activa no navega, un `tabPress` vetado gana, y una
          // sección con raíz declarada se abre SIEMPRE ahí.
          const accion = tabPressAction({
            name: route.name,
            focused,
            defaultPrevented: event.defaultPrevented
          });
          if (accion.kind === "none") return;
          if (accion.screen !== null) navigation.navigate(accion.name, { screen: accion.screen });
          else navigation.navigate(accion.name);
        };
        return (
          <Touchable
            key={route.key}
            onPress={onPress}
            style={styles.item}
            pressedStyle={styles.pressed}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
          >
            <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={2} maxFontSizeMultiplier={2}>
              {label}
            </Text>
            <View style={[styles.underline, focused && styles.underlineActive]} />
          </Touchable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignSelf: "stretch",
    backgroundColor: orbita.colors.surface,
    borderTopColor: orbita.colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 2,
    paddingTop: 10,
    // El ancho se declara: sin él la fila queda del tamaño de su contenido y las
    // cinco pestañas se amontonan a la izquierda (D1 de la certificación).
    width: "100%"
  },
  item: {
    alignItems: "center",
    // `flexBasis: 0` + `flexGrow: 1` reparte el ancho en cinco columnas iguales
    // sin importar cuánto mide cada label.
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    gap: 6,
    justifyContent: "center",
    // 44px: el mínimo táctil accesible en iOS y Android.
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 2
  },
  label: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 10, textAlign: "center" },
  labelActive: { color: orbita.colors.bone },
  pressed: { opacity: 0.6 },
  underline: { backgroundColor: "transparent", borderRadius: 1, height: 2, width: 14 },
  underlineActive: { backgroundColor: orbita.colors.copper }
});
