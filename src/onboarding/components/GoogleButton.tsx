import { FontAwesome } from "@expo/vector-icons";
import { Pressable, Text as RNText, View, type StyleProp, type ViewStyle } from "react-native";

import { font, orbita } from "../theme";

/**
 * "Continuar con Google" — el camino más corto para guardar la carta.
 *
 * La marca sale de `@expo/vector-icons` (FontAwesome `google`), que ya está en
 * el proyecto: no se dibuja un logo a mano ni se usa un emoji como ícono.
 *
 * Estilos en objetos LITERALES, no `StyleSheet.create`: en react-native-web una
 * hoja registrada se compila a clase y pierde contra las clases de Tailwind que
 * trae el `Text` compartido. Es el mismo mecanismo que ya dejó el enlace de
 * "Ya tengo cuenta" casi negro y el wordmark en 16px.
 *
 * Superficie clara a propósito: es el botón de un proveedor y tiene que
 * reconocerse como tal contra el fondo oscuro de Órbita, sin competir con el
 * CTA cobre de la pantalla.
 */

const ROW = {
  alignItems: "center",
  alignSelf: "stretch",
  backgroundColor: orbita.bone,
  borderRadius: 27,
  flexDirection: "row",
  gap: 12,
  // 54: mismo alto que el CTA principal, muy por encima del mínimo táctil.
  height: 54,
  justifyContent: "center",
  paddingHorizontal: 20,
} as const;

const ROW_DISABLED = { ...ROW, opacity: 0.55 } as const;

const LABEL = {
  color: orbita.ink,
  fontFamily: font.sansBold,
  fontSize: 16,
  textAlign: "center",
} as const;

export function GoogleButton({
  label = "Continuar con Google",
  onPress,
  busy = false,
  style,
}: {
  label?: string;
  onPress: () => void;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={busy ? undefined : onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      style={[busy ? ROW_DISABLED : ROW, style]}
    >
      <FontAwesome name="google" size={18} color={orbita.ink} />
      <RNText style={LABEL}>{busy ? "Un momento…" : label}</RNText>
    </Pressable>
  );
}

/** "o continuar con email" — la separación entre el camino corto y el largo. */
export function EmailDivider({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      accessibilityRole="none"
      style={[{ alignItems: "center", flexDirection: "row", gap: 12, marginVertical: 20 }, style]}
    >
      <View style={{ backgroundColor: orbita.line, flex: 1, height: 1 }} />
      <RNText style={{ color: orbita.faint, fontFamily: font.sans, fontSize: 13 }}>
        o continuar con email
      </RNText>
      <View style={{ backgroundColor: orbita.line, flex: 1, height: 1 }} />
    </View>
  );
}
