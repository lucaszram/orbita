import { useCallback, useState, type ReactNode } from "react";
import {
  Pressable,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle
} from "react-native";

/**
 * El estado "presionado" fuera de `Pressable`, para que `style` sea un VALOR.
 *
 * Por qué existe: el proyecto compila el JSX con `jsxImportSource: "nativewind"`
 * (ver `babel.config.js`), así que cada elemento pasa por la interoperación de
 * NativeWind. En nativo esa capa recorre `style` con `collectInlineRules`, que
 * sólo entiende arreglos y objetos: la FORMA FUNCIÓN de `Pressable`
 * —`style={({ pressed }) => [...]}`— entra por la rama de "objeto", se empuja
 * cruda al arreglo final y React Native la aplana a nada. El componente se
 * dibuja **sin ninguno de sus estilos**.
 *
 * No es teórico: era la causa de que la barra de pestañas amontonara sus cinco
 * ítems a la izquierda (perdía `flex`), de que las tarjetas que abren un detalle
 * no dibujaran su superficie ni su borde, y de que los botones primarios
 * aparecieran como texto suelto sin su píldora ni su alto mínimo de 44. Medido
 * en el simulador: con la forma función, un `backgroundColor` de prueba sobre el
 * ítem de la barra no llegaba a pintarse; con el estilo como valor, sí.
 *
 * En web la interoperación sólo toca `className` y deja `style` intacto, así que
 * allá la forma función funcionaba. Este hook reproduce exactamente el mismo
 * resultado visual en las dos plataformas —base siempre aplicada, `pressed`
 * mientras el dedo está apoyado— sin ramificar por plataforma.
 *
 * Uso:
 * ```tsx
 * const { pressed, pressableProps } = usePressedState();
 * <Pressable {...pressableProps} style={[styles.row, pressed && styles.pressed]} />
 * ```
 */
export function usePressedState() {
  const [pressed, setPressed] = useState(false);
  const onPressIn = useCallback((_: GestureResponderEvent) => setPressed(true), []);
  const onPressOut = useCallback((_: GestureResponderEvent) => setPressed(false), []);
  return { pressed, pressableProps: { onPressIn, onPressOut } } as const;
}

/**
 * El `Pressable` del sistema V4.9.2 — con el estilo SIEMPRE como valor.
 *
 * Envuelve `usePressedState` para las superficies que sólo necesitan rol,
 * etiqueta, estado y un estilo de presionado. El contrato de accesibilidad no
 * cambia: quien llama sigue dando rol, etiqueta y estado.
 */
export function Touchable({
  children,
  onPress,
  style,
  pressedStyle,
  disabled = false,
  accessibilityRole = "button",
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  accessibilityValue,
  hitSlop,
  testID
}: {
  children: ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  /** Lo que se agrega mientras el dedo está apoyado (opacidad, fondo…). */
  pressedStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** `radio` para las opciones de un grupo excluyente: VoiceOver dice "1 de 3". */
  accessibilityRole?: "button" | "tab" | "link" | "radio";
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: {
    selected?: boolean;
    disabled?: boolean;
    expanded?: boolean;
    /** El estado de un `radio`: es el que anuncia "seleccionado" en un grupo. */
    checked?: boolean;
  };
  /** El valor actual del control, cuando el botón RESUME un dato ("4 de mayo de 1994"). */
  accessibilityValue?: { text?: string };
  hitSlop?: number;
  testID?: string;
}) {
  const { pressed, pressableProps } = usePressedState();

  return (
    <Pressable
      onPress={onPress}
      {...pressableProps}
      disabled={disabled}
      accessible
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
      accessibilityValue={accessibilityValue}
      hitSlop={hitSlop}
      testID={testID}
      style={[style, pressed && !disabled ? pressedStyle : null]}
    >
      {children}
    </Pressable>
  );
}
