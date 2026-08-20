import { PixelRatio, StyleSheet, View } from "react-native";
import { AstroGlyph } from "@/components/orbita/AstroGlyph";
import { AspectGlyph, MetaRow, StateChip } from "@/components/v492/Layout";
import { MeterBar } from "@/components/v492/Meter";
import { Touchable } from "@/components/v492/Touchable";
import { Body, Label, Mono } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { bodySymbolForName } from "@/domain/astroSymbols";
import {
  exactnessRatio,
  formatDayMonth,
  formatLocalTime,
  formatOrb,
  formatShortDayMonth,
  houseLine,
  orbDeltaLabel,
  relativeDayLabel,
  transitHeadline,
  TRANSIT_STATE_CHIP,
  TRANSIT_STATE_LABEL
} from "@/domain/layers";
import type { TransitRankingItem } from "@/services/layersApi";

/**
 * Una fila de tránsito, en la composición del canon V4.9.2.
 *
 * El frame no la encierra en una tarjeta: es una fila abierta separada por una
 * línea fina, con la notación corta arriba —ordinal, los tres símbolos y el
 * orbe—, la barra de cercanía con el cambio respecto de ayer a su derecha, una
 * línea de metadatos (etapa, pico, casa) y recién después la frase del cálculo.
 * Antes cada tránsito era una tarjeta de 300 pt de alto con el orbe repetido en
 * tres lugares; eso es lo que hacía que la pantalla midiera el doble que el
 * frame.
 *
 * ## La cabecera es notación, no una frase
 *
 * Escribía `Mercurio □ tu Saturno` con el glifo del aspecto entre dos NOMBRES,
 * y esos nombres ya estaban dos veces más abajo en la misma fila —en la frase
 * del cálculo— y una tercera en la etiqueta accesible. La línea quedaba larga,
 * competía con el orbe por el ancho y era lo primero que se rompía con Dynamic
 * Type. Ahora los tres términos son SÍMBOLO: el cuerpo en tránsito en cobre, el
 * aspecto con el color del sistema y el punto natal en marfil. La jerarquía de
 * color es la que dice cuál es cuál —cobre = lo que se mueve, marfil = tu
 * carta— y el orbe queda solo contra el borde derecho.
 *
 * La fila entera es UN botón, así que VoiceOver lee su etiqueta y nada de lo de
 * adentro: por eso la etiqueta dice todo lo que se ve —posición, titular
 * completo CON LOS NOMBRES y el del aspecto, etapa, orbe, cambio respecto de
 * ayer, casa, la frase del cálculo y la fecha del punto más exacto— y no un
 * resumen. Los símbolos comprimen la cabecera; no borran el dato.
 *
 * ## Por qué está en la lista: lo dice el cálculo, no la fila
 *
 * `ORB-TRN-002` publica `rankingReason` por fila —`Exacto hoy`, `Pico mañana`,
 * `Activo hasta el 5 de abril`—: es el criterio con el que el ranking la puso
 * donde la puso. Cuando viene, es el que se muestra. La etiqueta derivada de acá
 * (`picoLabel`) queda como respaldo para los sobres guardados ANTES de que el
 * contrato lo publicara, y no se dibujan las dos: son dos frases del mismo dato
 * y pueden contradecirse —`PICO 16 AGO` al lado de `Exacto hoy`—, con la fila
 * afirmando algo que su propio cálculo no dijo.
 */
export function TransitRow({
  item,
  rank,
  nowMs,
  timezone,
  yesterdayOrb = null,
  onPress,
  first = false
}: {
  item: TransitRankingItem;
  /** Posición en el orden real; no se re-ordena en el front. */
  rank: number;
  nowMs: number;
  timezone: string;
  /** El orbe que este arco tenía ayer, si quedó guardado. `null` = no se dice. */
  yesterdayOrb?: number | null;
  onPress: () => void;
  /** La primera fila de la lista no lleva la línea fina de arriba. */
  first?: boolean;
}) {
  const headline = transitHeadline(item);
  const house = houseLine(item.natalHouse);
  const delta = orbDeltaLabel(item.orbDegrees, yesterdayOrb);
  // El criterio del propio cálculo manda; la fecha derivada es el respaldo de los
  // sobres viejos. Nunca las dos: serían el mismo dato dicho dos veces.
  const motivo = rankingReasonLabel(item.rankingReason) ?? picoLabel(item, nowMs, timezone);
  const glifo = glyphSize();
  const voz = [
    `${rank}. ${headline}.`,
    `${TRANSIT_STATE_LABEL[item.state]}.`,
    `A ${formatOrb(item.orbDegrees)} del punto exacto.`,
    yesterdayOrb !== null ? `Ayer estaba a ${formatOrb(yesterdayOrb)}.` : null,
    motivo ? `${motivo}.` : null,
    item.summary,
    house
  ]
    .filter((linea): linea is string => Boolean(linea))
    .join(" ");

  return (
    <Touchable onPress={onPress} accessibilityLabel={voz} accessibilityHint="Abre el detalle del tránsito" style={[styles.row, first ? styles.rowFirst : null]} pressedStyle={styles.pressed}>
      <View style={styles.head}>
        {/* Una sola línea SIEMPRE: con la columna angosta, `10` y `11` se
            partían en dos renglones —el `1` arriba y el `0` abajo—. */}
        <Mono style={styles.rank} numberOfLines={1}>
          {rank}
        </Mono>
        <View style={styles.shorthand}>
          <BodyMark name={item.transitPlanet} color={v492.colors.copper} size={glifo} />
          <AspectGlyph aspect={item.aspect} size={glifo} />
          <BodyMark name={item.natalPoint} color={v492.colors.text} size={glifo} />
        </View>
        <Mono style={styles.orb}>{formatOrb(item.orbDegrees)}</Mono>
      </View>

      <View style={styles.meterRow}>
        <View style={styles.meterCell}>
          <MeterBar
            value={exactnessRatio(item.orbDegrees)}
            accessibilityLabel={`Cercanía al punto exacto: ${formatOrb(item.orbDegrees)} de distancia`}
          />
        </View>
        {delta ? <Label style={styles.delta}>{delta}</Label> : null}
      </View>

      <View style={styles.metaLine}>
        <StateChip label={TRANSIT_STATE_CHIP[item.state]} />
        <MetaRow
          items={[
            motivo ? motivo.toLocaleUpperCase("es") : null,
            item.natalHouse !== null ? `CASA ${item.natalHouse}` : null
          ]}
        />
      </View>

      <Body style={styles.summary}>{item.summary}</Body>
    </Touchable>
  );
}

/**
 * Un extremo de la notación compacta: el glifo vectorial del cuerpo.
 *
 * El símbolo sale del catálogo propio (`domain/astroGlyphs`, resuelto por
 * `bodySymbolForName`), que es la única presentación de símbolos astrológicos
 * de la app: vectores empaquetados, monocromos e idénticos en web, iOS y
 * Android. Nada de caracteres Unicode —en web y Android caen al font de EMOJI—
 * ni de fuentes nuevas.
 *
 * **El fallback es el punto importante.** Si el nombre NO resuelve a un glifo
 * —un punto que el backend agregue mañana y que el catálogo todavía no
 * dibuje— se imprime el nombre, en el mismo color. Un símbolo que no existe
 * dejaría un hueco mudo justo donde está el dato; preferimos una fila menos
 * compacta antes que una fila que no dice qué punto es.
 */
function BodyMark({ name, color, size }: { name: string; color: string; size: number }) {
  const symbol = bodySymbolForName(name);
  if (symbol === null) return <Body style={[styles.mark, { color }]}>{name}</Body>;
  return <AstroGlyph symbol={symbol} size={size} color={color} strokeWidth={2} />;
}

/**
 * Lado del glifo en la cabecera, escalado a mano con Dynamic Type.
 *
 * Un `<Svg>` mide PUNTOS: no crece con el ajuste tipográfico como sí lo hace el
 * orbe que tiene al lado. Sin esta cuenta, en los tamaños de accesibilidad de
 * iOS la notación quedaría como tres marcas diminutas contra un número al doble
 * de tamaño. Se usa el mismo tope que el rol `Mono` de esta línea
 * (`v492.type.small.maxScale`), así que los dos crecen juntos y la fila sigue
 * entrando en un renglón.
 *
 * La escala se lee en el render —igual que en `DataRow` de `Module.tsx`, por la
 * misma razón: acá el viewport lo lee un solo archivo y el resto consume la
 * decisión—, con lo cual no se reacomoda sola si el ajuste cambia con la app
 * abierta. Es el único punto ciego, y no recorta nada: la cabecera se relee al
 * volver a montarse.
 */
function glyphSize(): number {
  const escala = Math.min(PixelRatio.getFontScale(), v492.type.small.maxScale);
  return Math.round(GLYPH_SIZE * escala);
}

/** Lado del glifo a escala 1. Acompaña al cuerpo de la fila, no al rótulo. */
const GLYPH_SIZE = 15;

/**
 * El criterio con el que el ranking ordenó esta fila, tal como lo publica el
 * sobre. `null` cuando no viene.
 *
 * Se lee defensivamente aunque el contrato lo declare obligatorio: un sobre
 * guardado antes del cambio sigue siendo válido para leer y no lo trae, y una
 * fila con la palabra `undefined` al lado del orbe sería peor que la etiqueta
 * derivada. No se reformula ni se recorta: es una frase del cálculo.
 */
function rankingReasonLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const limpio = value.trim();
  return limpio.length > 0 ? limpio : null;
}

/**
 * `PICO HOY 14:20` · `PICO 16 AGO` · `CIERRE 31 AGO`.
 *
 * El RESPALDO de `rankingReason`, para los sobres guardados antes de que el
 * contrato lo publicara. Cuando el sobre trae su criterio, esta etiqueta no se
 * dibuja.
 *
 * La hora sólo se imprime si el pico cae hoy: es el único caso en que agrega
 * algo, y es también el único que el frame muestra con hora. Un tránsito que ya
 * pasó su pico se rotula por su cierre —que es la fecha que todavía importa—
 * cuando el sobre la publica.
 */
function picoLabel(item: TransitRankingItem, nowMs: number, timezone: string): string | null {
  if (item.exactAt !== null) {
    const cuando = relativeDayLabel(item.exactAt, nowMs, timezone);
    if (cuando === "hoy") {
      const hora = formatLocalTime(item.exactAt, timezone);
      return hora ? `Pico hoy ${hora}` : "Pico hoy";
    }
    if (item.state !== "integrating") return `Pico ${formatShortDayMonth(item.exactAt, timezone)}`;
  }
  if (item.state === "integrating" && item.endsAt !== null) {
    return `Cierre ${formatShortDayMonth(item.endsAt, timezone)}`;
  }
  return item.exactAt !== null ? `Pico ${formatDayMonth(item.exactAt, timezone)}` : null;
}

const styles = StyleSheet.create({
  delta: { color: v492.colors.textDim, flexShrink: 0, textAlign: "right" },
  /**
   * Centrado, no `baseline`: un `<Svg>` no tiene línea base de texto, así que
   * alinear por ella dejaba los tres símbolos colgando contra el ordinal y el
   * orbe. Con `center` los cinco elementos comparten eje vertical.
   */
  head: { alignItems: "center", flexDirection: "row", gap: v492.space.md },
  /** El respaldo textual: puede angostarse, pero nunca se recorta. */
  mark: { flexShrink: 1 },
  meterCell: { flex: 1, justifyContent: "center" },
  meterRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: v492.space.md,
    marginTop: v492.space.md
  },
  metaLine: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: v492.space.md,
    marginTop: v492.space.md
  },
  orb: { color: v492.colors.text, flexShrink: 0, textAlign: "right" },
  pressed: { opacity: 0.6 },
  /**
   * La columna del ordinal tiene que entrar DOS dígitos.
   *
   * Estaba fijada en `width: 14`. Roboto Mono avanza 0,6 em, así que a 13 px un
   * dígito mide 7,8 pt y dos miden 15,6: `10` y `11` no entraban y React Native
   * los partía verticalmente. Ahora es un piso, no un techo —`minWidth`—, así
   * que la columna crece con el contenido y también con Dynamic Type, donde el
   * mismo ancho fijo habría recortado hasta un solo dígito. El piso conserva la
   * alineación de las filas de un dígito, que es lo que el ancho fijo daba.
   */
  rank: { color: v492.colors.copper, flexShrink: 0, minWidth: 18 },
  row: {
    borderTopColor: v492.colors.line,
    borderTopWidth: 1,
    paddingBottom: v492.space.lg,
    paddingTop: v492.space.lg
  },
  rowFirst: { borderTopWidth: 0, paddingTop: v492.space.sm },
  /**
   * Toma todo el ancho libre —`flex: 1`— para EMPUJAR el orbe contra el borde
   * derecho: con tres símbolos la notación mide poco y, sin esto, el orbe
   * quedaría pegado al lado de ellos en vez de alineado con el de las demás
   * filas. Y sin `flexWrap`: la cabecera es una sola línea. Lo único que podría
   * necesitar más de una es el respaldo textual, y para eso `mark` se angosta.
   */
  shorthand: { alignItems: "center", flex: 1, flexDirection: "row", gap: v492.space.sm },
  summary: { marginTop: v492.space.md }
});
