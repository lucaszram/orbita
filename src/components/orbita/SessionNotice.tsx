import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  DEGRADED_SESSION_A11Y_HINT,
  DEGRADED_SESSION_BODY,
  DEGRADED_SESSION_COVERAGE,
  DEGRADED_SESSION_TITLE,
  SESSION_RETRY_LABEL,
  TRANSIENT_SESSION_BODY,
  TRANSIENT_SESSION_TITLE,
  UNCONFIRMED_SESSION_BODY,
  UNCONFIRMED_SESSION_TITLE
} from "@/domain/sessionResilience";
import { BOOT_ACCENT, BOOT_BACKGROUND, BOOT_TEXT, BOOT_TEXT_MUTED } from "@/theme/boot";

/**
 * Las dos superficies de una sesión sin confirmar (QA23-007).
 *
 * Son las MISMAS dos decisiones que toma `AccountGate`, dibujadas: una franja
 * cuando el shell igual abre —identidad local segura, últimos datos de esta
 * misma cuenta— y una pantalla de bloqueo cuando no puede abrir (una ruta que
 * existe para cobrar, o una identidad que no se puede atribuir).
 *
 * El copy vive en el dominio, no acá: lo que se promete y lo que se niega es una
 * decisión de producto, y tenerlo en un módulo puro deja que las pruebas lo
 * fijen sin renderizar nada. Los colores salen de `@/theme/boot`, el mismo
 * módulo que pinta el arranque (QA23-006): un aviso de sesión es todavía la app
 * antes de tener datos, no una superficie con paleta propia.
 */

function RetryButton({ onPress, hint }: { onPress: () => void; hint: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={SESSION_RETRY_LABEL}
      accessibilityHint={hint}
      hitSlop={8}
      style={styles.retry}
    >
      <Text style={styles.retryText}>{SESSION_RETRY_LABEL}</Text>
    </Pressable>
  );
}

/**
 * La franja del shell degradado.
 *
 * Va ARRIBA del contenido y no lo tapa: lo que hay debajo son datos reales de
 * esta cuenta —los últimos confirmados— y esconderlos sería peor que mostrarlos
 * con su aviso. Es una región viva `polite` para que un lector de pantalla la
 * anuncie sin interrumpir lo que se esté leyendo.
 */
export function DegradedSessionBanner({ onRetry }: { onRetry: () => void }) {
  // La franja se dibuja por ENCIMA del shell, que empieza en el borde de la
  // pantalla (`headerShown: false`): sin el inset superior quedaría debajo del
  // notch y de la hora.
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.banner, { paddingTop: insets.top + 14 }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${DEGRADED_SESSION_TITLE} ${DEGRADED_SESSION_BODY} ${DEGRADED_SESSION_COVERAGE}`}
    >
      <View style={styles.bannerCopy}>
        <Text style={styles.bannerTitle}>{DEGRADED_SESSION_TITLE}</Text>
        <Text style={styles.bannerBody}>{DEGRADED_SESSION_BODY}</Text>
        {/* Qué se ve y qué no, enumerado. Sin esto la franja decía "lo último que
            guardamos" y cada sección vacía se leía como una falla del producto y
            no como lo que es: un dato que se calcula en la cuenta y que este
            teléfono nunca tuvo guardado. */}
        <Text style={styles.bannerBody}>{DEGRADED_SESSION_COVERAGE}</Text>
      </View>
      <View style={styles.bannerAction}>
        <RetryButton onPress={onRetry} hint={DEGRADED_SESSION_A11Y_HINT} />
      </View>
    </View>
  );
}

/**
 * La pantalla de bloqueo.
 *
 * `variant="confirmed-session"` es una ruta que existe para una operación
 * sensible (el pago): la sesión degradada no la abre, y el motivo es que no se
 * puede cobrar sin confirmar a quién. `variant="unattributable"` es el caso más
 * duro: no hay identidad local segura, así que no se muestra un solo dato — es
 * la regla de no publicar nunca datos de otra cuenta.
 */
export function UnconfirmedSessionScreen({
  onRetry,
  variant
}: {
  onRetry: () => void;
  variant: "confirmed-session" | "unattributable";
}) {
  const confirmada = variant === "confirmed-session";
  return (
    <View style={styles.screen}>
      <Text
        style={styles.title}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        {confirmada ? UNCONFIRMED_SESSION_TITLE : TRANSIENT_SESSION_TITLE}
      </Text>
      <Text style={styles.body}>
        {confirmada ? UNCONFIRMED_SESSION_BODY : TRANSIENT_SESSION_BODY}
      </Text>
      <View style={styles.screenAction}>
        <RetryButton onPress={onRetry} hint={DEGRADED_SESSION_A11Y_HINT} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: BOOT_BACKGROUND,
    borderBottomColor: BOOT_ACCENT,
    borderBottomWidth: 1,
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14
  },
  bannerAction: { alignItems: "flex-start" },
  bannerBody: { color: BOOT_TEXT_MUTED, fontSize: 13, lineHeight: 19, marginTop: 4 },
  bannerCopy: { flexShrink: 1 },
  bannerTitle: { color: BOOT_TEXT, fontSize: 15, fontWeight: "600" },
  body: {
    color: BOOT_TEXT_MUTED,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center"
  },
  retry: {
    borderColor: BOOT_ACCENT,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    // 44 reales: `hitSlop` no existe en web, así que sin esto el objetivo era
    // la altura del texto.
    minHeight: 44,
    paddingHorizontal: 24,
    paddingVertical: 10
  },
  retryText: {
    color: BOOT_ACCENT,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1
  },
  screen: {
    alignItems: "center",
    backgroundColor: BOOT_BACKGROUND,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32
  },
  screenAction: { marginTop: 24 },
  title: {
    color: BOOT_TEXT,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center"
  }
});
