import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePressedState } from "@/components/v492/Touchable";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { orbita } from "@/theme/orbita";

/**
 * Barra de pestañas en web: la de siempre, sin cambios.
 *
 * El ajuste de Dynamic Type de V4.9.2 (labels que reflúan a dos líneas y una
 * barra que crece con el tamaño de texto del sistema) es una necesidad de iOS y
 * Android, donde la persona elige el tamaño en Ajustes. En web el zoom del
 * navegador escala todo el layout y esta barra ya está medida para eso: dejarla
 * igual evita mover una pantalla que no se pidió tocar.
 */
const LABELS: Record<string, string> = {
  hoy: "Hoy",
  transitos: "Tránsitos",
  vinculos: "Vínculos",
  umbral: "Umbral",
  perfil: "Perfil"
};

type TabRoute = { key: string; name: string };
type OrbitaTabBarProps = {
  state: { index: number; routes: TabRoute[] };
  navigation: {
    emit: (event: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

export function OrbitaTabBar({ state, navigation }: OrbitaTabBarProps) {
  const insets = useSafeAreaInsets();
  // Sin las fonts cargadas, la fallback del sistema mide distinto y los labels
  // se truncan ("Trán…"); mantenemos la altura del bar pero sin labels.
  const fontsLoaded = useOrbitaFonts();
  if (!fontsLoaded) {
    return <View style={[styles.bar, { paddingBottom: insets.bottom + 10, height: insets.bottom + 62 }]} />;
  }

  const visibles = state.routes.filter((route) => LABELS[route.name]);

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 10 }]} accessibilityRole="tablist">
      {visibles.map((route) => {
        const focused = state.routes[state.index]?.key === route.key;
        const label = LABELS[route.name];
        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return <WebTab key={route.key} label={label} focused={focused} onPress={onPress} />;
      })}
    </View>
  );
}

/**
 * Una pestaña. El estado de "presionado" sale de un hook en vez de la forma
 * función de `style`: en web las dos formas dibujan exactamente lo mismo —la
 * interoperación de NativeWind sólo toca `className` acá—, pero un gate del
 * repo prohíbe la forma función en todo el árbol ejecutable porque en nativo
 * descarta el estilo entero. El aspecto de esta barra no cambia.
 */
function WebTab({ label, focused, onPress }: { label: string; focused: boolean; onPress: () => void }) {
  const { pressed, pressableProps } = usePressedState();
  return (
    <Pressable
      onPress={onPress}
      {...pressableProps}
      style={[styles.item, pressed ? styles.pressed : null]}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
    >
      <Text
        style={[styles.label, focused && styles.labelActive]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        maxFontSizeMultiplier={1.2}
      >
        {label}
      </Text>
      <View style={[styles.underline, focused && styles.underlineActive]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: orbita.colors.surface,
    borderTopColor: orbita.colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 2,
    paddingTop: 10
  },
  item: {
    alignItems: "center",
    flex: 1,
    gap: 6,
    justifyContent: "center",
    // 44px: el mínimo táctil accesible en iOS y Android.
    minHeight: 44,
    paddingHorizontal: 2
  },
  label: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 10, textAlign: "center" },
  labelActive: { color: orbita.colors.bone },
  pressed: { opacity: 0.6 },
  underline: { backgroundColor: "transparent", borderRadius: 1, height: 2, width: 14 },
  underlineActive: { backgroundColor: orbita.colors.copper }
});
