import type { ReactNode } from "react";
import { PixelRatio, StyleSheet, View } from "react-native";
import { MissingBlock, StatusLine } from "@/components/v492/Status";
import { Touchable } from "@/components/v492/Touchable";
import { Body, Divider, Eyebrow, Label } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { hasData } from "@/domain/layers";
import type { AnalysisEnvelope } from "@/services/layersApi";

/**
 * Encabezado de módulo: qué es y cada cuánto cambia.
 *
 * La cadencia es parte del dato, no decoración: un tránsito que dura semanas y
 * una Luna que cambia cada dos días no se leen igual, y decirlo evita que la
 * persona espere novedades donde no las va a haber.
 *
 * Para VoiceOver el rótulo y la cadencia son UN encabezado: con el rotor de
 * títulos se puede saltar de módulo en módulo, que es como se recorre una
 * pantalla larga de capas sin escucharla entera. La etiqueta dice las dos cosas
 * visibles —nunca sólo el rótulo— y la introducción queda aparte, como texto.
 */
export function ModuleHeader({
  module,
  cadence,
  intro
}: {
  module: string;
  cadence: string;
  /** Una a tres frases que explican qué muestra el módulo. */
  intro?: string;
}) {
  return (
    <View style={styles.header}>
      <Divider style={styles.headerRule} />
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${module}. ${cadence}.`}
        style={styles.headerRow}
      >
        <Eyebrow style={styles.module}>{module}</Eyebrow>
        <Label style={styles.cadence}>{cadence}</Label>
      </View>
      {intro ? (
        <View style={{ marginTop: v492.space.md }}>
          <Body>{intro}</Body>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Módulo completo: encabezado, estado y contenido — o la explicación de por qué
 * no hay contenido. Es el patrón que repiten todas las pantallas de capas, así
 * que ninguna puede olvidarse de declarar el estado ni la precisión del cálculo.
 */
export function LayerModule({
  envelope,
  module,
  cadence,
  intro,
  children
}: {
  envelope: AnalysisEnvelope;
  module: string;
  cadence: string;
  intro?: string;
  /** Sólo se monta cuando el sobre trae datos. */
  children?: ReactNode;
}) {
  return (
    <View style={styles.moduleBlock}>
      <ModuleHeader module={module} cadence={cadence} intro={intro} />
      <StatusLine status={envelope.status} precision={envelope.precision} />
      {hasData(envelope) ? children : <MissingBlock envelope={envelope} />}
    </View>
  );
}

/** Superficie del sistema: `#12141A` con hairline. */
export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * Tarjeta que abre un detalle. El objetivo táctil es toda la tarjeta (muy por
 * encima de 44×44) y VoiceOver la anuncia con su título y su acción.
 */
export function CardButton({
  children,
  onPress,
  accessibilityLabel,
  hint = "Abre el detalle"
}: {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  hint?: string;
}) {
  return (
    <Touchable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={hint}
      style={[styles.card, styles.cardButton]}
      pressedStyle={styles.pressed}
    >
      {children}
    </Touchable>
  );
}

/**
 * Fila de dato: rótulo mono a la izquierda, valor a la derecha.
 *
 * Con Dynamic Type grande las dos columnas no entran en la misma línea, y un
 * dato es justo lo que no se puede recortar: "12 de mayo de 2026" cortado a una
 * línea se lee como otra fecha. Por eso la fila se REPLIEGA —el rótulo arriba,
 * el valor completo abajo— en vez de truncar.
 *
 * El repliegue no mira la ventana: en este repo el viewport lo lee un solo
 * archivo (el shell web) y el resto consume esa decisión, así que acá la escala
 * sale de `PixelRatio.getFontScale()`, que es el ajuste tipográfico y no el
 * tamaño de pantalla. Se lee en el render, con lo cual la fila no se reacomoda
 * sola si el ajuste cambia con la app abierta; para ese hueco está la segunda
 * capa, que es puro layout: el `flexWrap` de la fila más el `minWidth` del
 * valor lo bajan de línea apenas las dos columnas no entran, y el texto envuelve
 * en las líneas que haga falta en vez de recortarse.
 */
export function DataRow({ label, value }: { label: string; value: ReactNode }) {
  const apilada = PixelRatio.getFontScale() >= 1.35;
  return (
    <View style={[styles.dataRow, apilada ? styles.dataRowStacked : null]}>
      <Label style={[styles.dataLabel, apilada ? styles.dataLabelStacked : null]}>{label}</Label>
      <View style={[styles.dataValue, apilada ? styles.dataValueStacked : null]}>{value}</View>
    </View>
  );
}

/** Chip de contexto (criterio de orden, etapa del tránsito). */
export function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Label style={styles.chipText}>{label}</Label>
    </View>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

const styles = StyleSheet.create({
  cadence: { flexShrink: 1, textAlign: "right" },
  card: {
    backgroundColor: v492.colors.surface,
    borderColor: v492.colors.line,
    borderRadius: v492.radius.md,
    borderWidth: 1,
    padding: v492.space.lg
  },
  cardButton: { minHeight: v492.touch },
  chip: {
    borderColor: v492.colors.line,
    borderRadius: v492.radius.pill,
    borderWidth: 1,
    paddingHorizontal: v492.space.md,
    paddingVertical: 4
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: v492.space.sm },
  chipText: { color: v492.colors.textMuted },
  dataLabel: { paddingTop: 2, width: 116 },
  dataLabelStacked: { paddingTop: 0, width: "100%" },
  dataRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: v492.space.md,
    marginTop: v492.space.md
  },
  dataRowStacked: { flexDirection: "column", gap: v492.space.xs },
  // El mínimo es lo que hace que el valor BAJE en vez de comprimirse en una
  // columna de dos caracteres cuando el rótulo se lleva el ancho.
  dataValue: { flex: 1, minWidth: 140 },
  dataValueStacked: { minWidth: 0, width: "100%" },
  header: { marginBottom: v492.space.lg },
  headerRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: v492.space.md,
    justifyContent: "space-between"
  },
  headerRule: { marginBottom: v492.space.lg },
  module: { flexShrink: 1 },
  moduleBlock: { paddingTop: v492.space.xl },
  pressed: { opacity: 0.7 }
});
