import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import {
  resendButton,
  resendFeedback,
  SPAM_HINT,
  type ResendResult
} from "../resend";
import { font, orbita } from "../theme";

type Props = {
  /** Reenvía el código; el hook decide alta vs login. */
  onResend: () => Promise<ResendResult>;
};

/**
 * Ayuda bajo el campo de código (build 13). Clerk manda el código pero Gmail lo
 * puede tirar a Spam, así que: (1) recordamos revisar Spam, y (2) ofrecemos
 * reenviar con cooldown de 30 s. La lógica (rótulo, cooldown, feedback) vive en
 * `../resend` (pura, con tests); acá solo el reloj y el estado de React.
 */
export function CodeHelp({ onResend }: Props) {
  // El primer código se acaba de enviar al entrar a la pantalla: el cooldown
  // arranca ya, para no ofrecer "Reenviar" en el mismo instante.
  const [lastSentAt, setLastSentAt] = useState<number>(() => Date.now());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Evita taps solapados aunque el re-render del botón llegue tarde.
  const inFlight = useRef(false);

  const btn = resendButton({ nowMs, lastSentAtMs: lastSentAt, sending });

  // Tic de 1 s para la cuenta regresiva del botón.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const onPress = async () => {
    if (btn.disabled || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setStatus("idle");
    setErrorMessage(null);
    try {
      const result = await onResend();
      if (result.ok) {
        setStatus("sent");
        setLastSentAt(Date.now()); // reinicia el cooldown solo si funcionó
      } else {
        setStatus("error");
        setErrorMessage(result.error); // error REAL, permite reintentar
      }
    } finally {
      setSending(false);
      inFlight.current = false;
    }
  };

  const feedback = resendFeedback(status, errorMessage);

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>{SPAM_HINT}</Text>
      <Pressable
        onPress={btn.disabled ? undefined : () => void onPress()}
        accessibilityRole="button"
        accessibilityState={{ disabled: btn.disabled }}
        hitSlop={8}
      >
        <Text style={[styles.resend, btn.disabled && styles.resendDisabled]}>{btn.label}</Text>
      </Pressable>
      {feedback ? (
        <Text style={status === "error" ? styles.error : styles.ok}>{feedback}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  error: { color: "#D07A5A", fontFamily: font.sans, fontSize: 13, marginTop: 8 },
  hint: { color: orbita.muted, fontFamily: font.sans, fontSize: 13, lineHeight: 18 },
  ok: { color: orbita.muted, fontFamily: font.sans, fontSize: 13, marginTop: 8 },
  resend: { color: orbita.copper, fontFamily: font.sansMed, fontSize: 14, marginTop: 14 },
  resendDisabled: { color: orbita.faint },
  wrap: { marginTop: 18 }
});
