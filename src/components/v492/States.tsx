import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Touchable } from "@/components/v492/Touchable";
import { Body, Label, Subtitle } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { SIGN_IN_ROUTE } from "@/domain/appRoutes";

/**
 * Estados de pantalla de las capas.
 *
 * Ninguno muestra contenido de ejemplo debajo: si la sesión no resolvió o el
 * cálculo no está, se ve el estado y nada más. Es la regla anti-mock del
 * producto, aplicada al sistema V4.9.2.
 */

export function PrimaryButton({
  label,
  onPress,
  accessibilityLabel,
  /**
   * Bloqueado: además de no responder, se ANUNCIA bloqueado (`accessibilityState`)
   * y se ve apagado. Un botón que existe pero no hace nada, sin decirlo, es una
   * trampa para quien navega con lector de pantalla. Quien lo usa tiene que
   * explicar al lado qué falta para desbloquearlo.
   */
  disabled = false,
  /**
   * Dónde se apoya el botón. Los estados de pantalla lo centran bajo un texto
   * también centrado; dentro de una columna de lectura el canon lo alinea con
   * el margen izquierdo, como cualquier otro bloque de la retícula.
   */
  align = "center",
  /** Qué pasa al tocarlo, cuando el rótulo en mayúsculas no alcanza a decirlo. */
  accessibilityHint
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  align?: "center" | "start";
  accessibilityHint?: string;
}) {
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={[styles.button, align === "start" && styles.buttonStart, disabled && styles.buttonOff]}
      pressedStyle={styles.pressed}
    >
      <Label style={[styles.buttonText, disabled && styles.buttonTextOff]}>{label}</Label>
    </Touchable>
  );
}

export function LoadingBlock({ message = "Leyendo tu cielo…" }: { message?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator color={v492.colors.copper} />
      <View style={{ height: v492.space.lg }} />
      <Body style={styles.centered}>{message}</Body>
    </View>
  );
}

export function ErrorBlock({
  title = "No pudimos traer tus capas.",
  body = "Puede ser la conexión. Tus datos siguen guardados: probá de nuevo en un momento.",
  onRetry
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Subtitle style={styles.centered}>{title}</Subtitle>
      <View style={{ height: v492.space.md }} />
      <Body style={styles.centered}>{body}</Body>
      {onRetry ? (
        <View style={{ marginTop: v492.space.xl }}>
          <PrimaryButton label="REINTENTAR" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

/** Sin sesión confirmada: las capas se calculan sobre TU carta, no hay demo. */
export function GuestBlock() {
  return (
    <View style={styles.center}>
      <Subtitle style={styles.centered}>Estas capas se leen sobre tu carta.</Subtitle>
      <View style={{ height: v492.space.md }} />
      <Body style={styles.centered}>
        Necesitamos tu fecha, hora y lugar de nacimiento para calcularlas. Entrá a tu cuenta y aparecen acá.
      </Body>
      <View style={{ marginTop: v492.space.xl }}>
        <PrimaryButton label="ENTRAR A MI CUENTA" onPress={() => router.push(SIGN_IN_ROUTE as never)} />
      </View>
    </View>
  );
}

/** La cuenta existe pero todavía no hay datos natales guardados. */
export function EmptyBlock() {
  return (
    <View style={styles.center}>
      <Subtitle style={styles.centered}>Todavía no hay una carta para leer.</Subtitle>
      <View style={{ height: v492.space.md }} />
      <Body style={styles.centered}>
        Cuando tus datos de nacimiento estén completos, Órbita calcula tus capas y las vas a ver acá.
      </Body>
      <View style={{ marginTop: v492.space.xl }}>
        <PrimaryButton label="COMPLETAR MIS DATOS" onPress={() => router.push("/editar-datos")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    alignSelf: "center",
    borderColor: v492.colors.copper,
    borderRadius: v492.radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: v492.touch,
    paddingHorizontal: v492.space.xl
  },
  buttonOff: { borderColor: v492.colors.line },
  buttonStart: { alignSelf: "flex-start" },
  buttonText: { color: v492.colors.copperSoft },
  buttonTextOff: { color: v492.colors.textDim },
  center: { alignItems: "center", paddingHorizontal: v492.space.gutter, paddingVertical: v492.space.xxl },
  centered: { textAlign: "center" },
  pressed: { opacity: 0.6 }
});
