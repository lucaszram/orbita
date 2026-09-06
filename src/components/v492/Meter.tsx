import { StyleSheet, View } from "react-native";
import { Label, Mono } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { formatDayMonth, windowProgress } from "@/domain/layers";

/**
 * Barras del sistema V4.9.2.
 *
 * Todas dibujan una proporción REAL del sobre (cercanía al punto exacto,
 * avance dentro de una ventana, día del ciclo). Ninguna se anima: además de
 * respetar "Reducir movimiento" sin excepciones, una barra que crece sugiere
 * un progreso que el dato no afirma.
 */

/**
 * Barra de proporción.
 *
 * La barra ILUSTRA un dato que siempre está escrito al lado; no es el dato. Por
 * eso VoiceOver nunca recibe un 0–100 armado acá: "3 de 10 planetas" leído como
 * "30 por ciento" convierte un recuento de diez posiciones enteras en una escala
 * continua, y "a 1°12′ del punto exacto" leído como "60 por ciento" inventa una
 * unidad que el cálculo no usa.
 *
 * Quien llama puede pasar `valueText` con el dato EN SUS PROPIAS UNIDADES: ahí
 * la barra se anuncia como indicador con ese valor. Sin ese texto se anuncia
 * como imagen con su etiqueta, que ya dice todo lo que la barra representa.
 *
 * `tone` no decora: es el mismo par de colores con el que la carta natal
 * distingue un contacto fluido de uno tenso (`harmony` / `tension` del tema).
 * Sólo lo usa quien tiene esa evidencia por barra, y quien lo usa lo declara
 * también en palabras — un color que dijera algo que el texto no dice sería un
 * puntaje escondido.
 */
export function MeterBar({
  value,
  accessibilityLabel,
  valueText,
  tone = "copper"
}: {
  /** Proporción 0–1 ya calculada. */
  value: number;
  accessibilityLabel: string;
  /** El valor en las unidades reales del dato ("3 de 10", "mes 4 de 12"). */
  valueText?: string;
  tone?: "copper" | "soft" | "harmony";
}) {
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  return (
    <View
      accessible
      accessibilityRole={valueText ? "progressbar" : "image"}
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={valueText ? { text: valueText } : undefined}
      style={styles.rail}
    >
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%` },
          tone === "soft" ? styles.fillSoft : tone === "harmony" ? styles.fillHarmony : styles.fillCopper
        ]}
      />
    </View>
  );
}

/**
 * Ventana de un tránsito: inicio, contacto más exacto y fin, con la posición
 * de hoy. Las tres fechas son las que registró el cálculo; no se extrapola ni
 * se promete nada fuera de esa ventana.
 *
 * Para VoiceOver es una imagen con las tres fechas dichas: el avance dentro de
 * la ventana no tiene una unidad que anunciar —un "70 por ciento" de un tránsito
 * no significa nada— y las fechas sí.
 */
export function WindowTimeline({
  startsAt,
  peakAt,
  endsAt,
  nowMs,
  timezone
}: {
  startsAt: number;
  peakAt: number;
  endsAt: number;
  nowMs: number;
  timezone: string;
}) {
  const progress = windowProgress(startsAt, endsAt, nowMs);
  const span = endsAt - startsAt;
  const peakRatio = span > 0 ? Math.max(0, Math.min(1, (peakAt - startsAt) / span)) : 0;
  const label = `Ventana del tránsito: empieza el ${formatDayMonth(startsAt, timezone)}, contacto más exacto el ${formatDayMonth(
    peakAt,
    timezone
  )} y termina el ${formatDayMonth(endsAt, timezone)}.`;

  return (
    <View>
      <View accessible accessibilityRole="image" accessibilityLabel={label} style={styles.rail}>
        <View style={[styles.fill, styles.fillCopper, { width: `${progress * 100}%` }]} />
        <View style={[styles.peak, { left: `${peakRatio * 100}%` }]} />
      </View>
      <View style={styles.timelineLabels} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={styles.timelineCell}>
          <Label>INICIO</Label>
          <Mono>{formatDayMonth(startsAt, timezone)}</Mono>
        </View>
        <View style={[styles.timelineCell, styles.timelineCenter]}>
          <Label>MÁS EXACTO</Label>
          <Mono>{formatDayMonth(peakAt, timezone)}</Mono>
        </View>
        <View style={[styles.timelineCell, styles.timelineEnd]}>
          <Label>FIN</Label>
          <Mono>{formatDayMonth(endsAt, timezone)}</Mono>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { borderRadius: 3, height: 6 },
  fillCopper: { backgroundColor: v492.colors.copper },
  fillHarmony: { backgroundColor: v492.colors.harmony },
  fillSoft: { backgroundColor: v492.colors.copperSoft },
  peak: {
    backgroundColor: v492.colors.text,
    borderRadius: 1,
    height: 14,
    marginLeft: -1,
    position: "absolute",
    top: -4,
    width: 2
  },
  rail: {
    backgroundColor: v492.colors.rail,
    borderRadius: 3,
    height: 6,
    justifyContent: "center",
    overflow: "visible",
    width: "100%"
  },
  timelineCell: { flex: 1, gap: 2 },
  timelineCenter: { alignItems: "center" },
  timelineEnd: { alignItems: "flex-end" },
  timelineLabels: { flexDirection: "row", marginTop: v492.space.md }
});
