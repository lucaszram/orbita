import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { orbita } from "@/theme/orbita";

const LABELS: Record<string, string> = {
  index: "Inicio",
  carta: "Carta",
  transitos: "Tránsitos",
  vinculo: "Vínculo",
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

/** Bottom nav matching the Órbita V4.7 Figma: dark bar, mono labels, copper active underline. */
export function OrbitaTabBar({ state, navigation }: OrbitaTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 10 }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const label = LABELS[route.name] ?? route.name;
        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable key={route.key} onPress={onPress} style={styles.item} accessibilityRole="tab" accessibilityState={{ selected: focused }}>
            <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1} allowFontScaling={false}>
              {label}
            </Text>
            <View style={[styles.underline, focused && styles.underlineActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: orbita.colors.surface,
    borderTopColor: orbita.colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 4,
    paddingTop: 14
  },
  item: { alignItems: "center", flex: 1, gap: 6 },
  label: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 10 },
  labelActive: { color: orbita.colors.bone },
  underline: { backgroundColor: "transparent", borderRadius: 1, height: 2, width: 14 },
  underlineActive: { backgroundColor: orbita.colors.copper }
});
