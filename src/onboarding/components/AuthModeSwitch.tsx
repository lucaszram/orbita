import { Text as RNText, View, type StyleProp, type ViewStyle } from "react-native";

import { Touchable } from "@/components/v492/Touchable";

import { font, orbita } from "../theme";

export type AuthMode = "signUp" | "signIn";

/**
 * "Crear cuenta · Ingresar" — el selector de las superficies de auth.
 *
 * Las dos puertas viven a la misma altura y se ven de una: quien llega al alta
 * sin haber entendido que ya tiene cuenta no depende de encontrar un enlace
 * chico al fondo de la pantalla.
 *
 * La opción activa cambia en CUATRO ejes a la vez —fondo, borde cobre, color de
 * texto y peso tipográfico—, no sólo de tono. Un segmentado en el que el activo
 * apenas se tiñe ya fue observado en la certificación de V4.9.2: se lee como
 * dos opciones apagadas, no como una elección hecha.
 *
 * Todo se mantiene oscuro: nada de superficies claras, que acá pertenecen a los
 * botones de proveedor (`GoogleButton`) y romperían la jerarquía si un selector
 * las usara.
 *
 * Estilos en objetos LITERALES, no `StyleSheet.create`: en react-native-web una
 * hoja registrada se compila a clase atómica y pierde contra las clases de
 * Tailwind que viajan con los componentes compartidos. Es el mismo mecanismo
 * que ya dejó el enlace de "Ya tengo cuenta" casi negro.
 *
 * Y el toque va por `Touchable`, no por un `Pressable` con `style` en forma
 * función: NativeWind recorre `style` con `collectInlineRules`, que sólo entiende
 * arreglos y objetos, así que una función se descarta entera y en nativo el
 * selector se dibujaría SIN fondo, sin borde y sin su alto mínimo de 44 —justo
 * los cuatro ejes que hacen visible la opción activa—. `Touchable` saca el
 * estado de presionado del render y deja `style` como valor.
 */

const TRACK = {
  alignSelf: "stretch",
  backgroundColor: orbita.bgElev,
  borderColor: orbita.line,
  borderRadius: 27,
  borderWidth: 1,
  flexDirection: "row",
  gap: 4,
  padding: 4,
} as const;

const OPTION = {
  alignItems: "center",
  borderRadius: 23,
  borderWidth: 1,
  flex: 1,
  justifyContent: "center",
  // 44: mínimo táctil real. `hitSlop` no existe en web.
  minHeight: 44,
  paddingHorizontal: 16,
} as const;

/** Cobre sobre cobre: relleno tenue + borde pleno, sin superficie clara. */
const OPTION_ON = {
  ...OPTION,
  backgroundColor: orbita.copperGlow,
  borderColor: orbita.copper,
} as const;

const OPTION_OFF = {
  ...OPTION,
  backgroundColor: "transparent",
  borderColor: "transparent",
} as const;

/** Sólo para la opción que SÍ navega: la ya elegida no responde al toque. */
const OPTION_PRESSED = { opacity: 0.7 } as const;

/** Hueso sobre el cobre apagado: 12,7:1. */
const LABEL_ON = {
  color: orbita.bone,
  fontFamily: font.sansBold,
  fontSize: 15,
  lineHeight: 20,
  textAlign: "center",
} as const;

/** Muted sobre la superficie elevada: 8,1:1. Apagado, nunca ilegible. */
const LABEL_OFF = {
  ...LABEL_ON,
  color: orbita.muted,
  fontFamily: font.sansMed,
} as const;

type Props = {
  mode: AuthMode;
  onSignUp: () => void;
  onSignIn: () => void;
  /** Para acomodarlo en cada superficie (márgenes), sin tocar su forma. */
  style?: StyleProp<ViewStyle>;
};

export function AuthModeSwitch({ mode, onSignUp, onSignIn, style }: Props) {
  const options = [
    { key: "signUp", label: "Crear cuenta", onPress: onSignUp },
    { key: "signIn", label: "Ingresar", onPress: onSignIn },
  ] as const;

  return (
    <View style={[TRACK, style]}>
      {options.map((option) => {
        const selected = option.key === mode;
        return (
          <Touchable
            key={option.key}
            // Tocar la opción ya elegida no reingresa a la misma superficie: eso
            // vaciaría un formulario a medio llenar. El control sigue enfocable
            // y sigue anunciando "seleccionado".
            onPress={selected ? () => {} : option.onPress}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            style={selected ? OPTION_ON : OPTION_OFF}
            // Nada de atenuar lo que no se mueve: apagar la opción activa al
            // tocarla parecería que algo pasó cuando no pasó nada.
            pressedStyle={selected ? null : OPTION_PRESSED}
          >
            <RNText style={selected ? LABEL_ON : LABEL_OFF}>{option.label}</RNText>
          </Touchable>
        );
      })}
    </View>
  );
}
