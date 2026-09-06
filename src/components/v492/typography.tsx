import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { v492 } from "@/components/v492/tokens";

/**
 * Tipografía del sistema V4.9.2.
 *
 * Newsreader para titulares, Inter para texto y Roboto Mono para rótulos y
 * datos. Todos los roles escalan con Dynamic Type con un tope propio, y los
 * titulares se anuncian como encabezado para VoiceOver.
 */

type TextProps = { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number };

export function Eyebrow({ children, style, numberOfLines }: TextProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[styles.eyebrow, style]}
      maxFontSizeMultiplier={v492.type.label.maxScale}
    >
      {children}
    </Text>
  );
}

/** Rótulo mono apagado (metadatos, cadencias, unidades). */
export function Label({ children, style }: TextProps) {
  return (
    <Text style={[styles.label, style]} maxFontSizeMultiplier={v492.type.label.maxScale}>
      {children}
    </Text>
  );
}

export function Display({ children, style }: TextProps) {
  return (
    <Text
      accessibilityRole="header"
      style={[styles.display, style]}
      maxFontSizeMultiplier={v492.type.display.maxScale}
    >
      {children}
    </Text>
  );
}

export function Title({ children, style, numberOfLines }: TextProps) {
  return (
    <Text
      accessibilityRole="header"
      numberOfLines={numberOfLines}
      style={[styles.title, style]}
      maxFontSizeMultiplier={v492.type.title.maxScale}
    >
      {children}
    </Text>
  );
}

export function Subtitle({ children, style, numberOfLines }: TextProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[styles.subtitle, style]}
      maxFontSizeMultiplier={v492.type.subtitle.maxScale}
    >
      {children}
    </Text>
  );
}

export function Body({ children, style }: TextProps) {
  return (
    <Text style={[styles.body, style]} maxFontSizeMultiplier={v492.type.body.maxScale}>
      {children}
    </Text>
  );
}

/** Texto secundario: explicaciones cortas y notas de límite. */
export function Note({ children, style }: TextProps) {
  return (
    <Text style={[styles.note, style]} maxFontSizeMultiplier={v492.type.small.maxScale}>
      {children}
    </Text>
  );
}

/** Dato en mono (fechas, grados, días de ciclo). */
export function Mono({ children, style, numberOfLines }: TextProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[styles.mono, style]}
      maxFontSizeMultiplier={v492.type.small.maxScale}
    >
      {children}
    </Text>
  );
}

export function Divider({ style }: { style?: object }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  body: {
    color: v492.colors.textMuted,
    fontFamily: v492.fonts.body,
    fontSize: v492.type.body.size,
    lineHeight: v492.type.body.line
  },
  display: {
    color: v492.colors.text,
    fontFamily: v492.fonts.serif,
    fontSize: v492.type.display.size,
    lineHeight: v492.type.display.line
  },
  divider: { backgroundColor: v492.colors.line, height: 1 },
  eyebrow: {
    color: v492.colors.copper,
    fontFamily: v492.fonts.monoMedium,
    fontSize: v492.type.label.size,
    letterSpacing: 1.4,
    lineHeight: v492.type.label.line,
    textTransform: "uppercase"
  },
  label: {
    color: v492.colors.textDim,
    fontFamily: v492.fonts.mono,
    fontSize: v492.type.label.size,
    letterSpacing: 1.2,
    lineHeight: v492.type.label.line,
    textTransform: "uppercase"
  },
  mono: {
    color: v492.colors.textMuted,
    fontFamily: v492.fonts.mono,
    fontSize: v492.type.small.size,
    lineHeight: v492.type.small.line
  },
  note: {
    color: v492.colors.textDim,
    fontFamily: v492.fonts.body,
    fontSize: v492.type.small.size,
    lineHeight: v492.type.small.line
  },
  subtitle: {
    color: v492.colors.text,
    fontFamily: v492.fonts.serif,
    fontSize: v492.type.subtitle.size,
    lineHeight: v492.type.subtitle.line
  },
  title: {
    color: v492.colors.text,
    fontFamily: v492.fonts.serif,
    fontSize: v492.type.title.size,
    lineHeight: v492.type.title.line
  }
});
