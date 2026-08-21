import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { Touchable } from "@/components/v492/Touchable";
import { Label, Mono, Note } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { transitTimeline, type TimelineMark } from "@/domain/transitDetail";

/**
 * Piezas de composición del canon V4.9.2.
 *
 * El frame no usa tarjetas: usa una columna de bloques separados por una línea
 * fina, con un encabezado numerado a la izquierda y la cadencia del cálculo a la
 * derecha. Estas piezas son ese sistema, para que ninguna pantalla lo vuelva a
 * inventar con márgenes propios.
 */

/**
 * Encabezado de bloque: `01 RANKING DE TRÁNSITOS` · `• CAMBIA A DIARIO`.
 *
 * El número ordena la lectura de la pantalla —el frame los numera— y la cadencia
 * de la derecha es parte del dato: un tránsito que dura semanas y una Luna que
 * cambia cada dos días no se leen igual. Los detalles usan la variante sin
 * número, con el bullet delante (`· LA VENTANA DE HOY`).
 *
 * Para VoiceOver es UN encabezado con las dos cosas dichas, así que el rotor de
 * títulos permite saltar de bloque en bloque.
 */
export function SectionHeader({
  index,
  title,
  cadence,
  rule = true,
  bullet = true,
  tone = "default"
}: {
  /** Número del bloque, ya formateado (`"01"`). Sin él va el bullet del canon. */
  index?: string;
  title: string;
  /** Qué tan seguido cambia el cálculo. Va a la derecha, o debajo si no entra. */
  cadence?: string;
  /** La línea fina de arriba. El primer bloque de una pantalla no la lleva. */
  rule?: boolean;
  /** El bullet del canon delante del título cuando no hay número. */
  bullet?: boolean;
  /**
   * Peso del rótulo dentro de la página, medido sobre los frames.
   *
   * El canon usa tres: `default` para los bloques numerados de una capa,
   * `accent` (cobre suave) para el rótulo que abre una sección de lectura
   * —`POR DIMENSIÓN`— y `muted` para el cierre que RESTA en vez de sumar
   * —`LO QUE ESTO NO DICE`—, que va en el mismo gris que su propio texto para
   * no competir con el contenido que acaba de leerse.
   */
  tone?: "default" | "accent" | "muted";
}) {
  // El frame pone la cadencia a la derecha cuando entra en el renglón y DEBAJO,
  // alineada a la izquierda, cuando no. No se deja al azar del wrap: una
  // etiqueta mono a la derecha que se parte en dos líneas fue una de las
  // diferencias registradas por la certificación. El corte se decide por largo
  // de texto, que es lo único que se conoce sin medir.
  const apilada = Boolean(cadence) && title.length + (cadence?.length ?? 0) > 38;
  return (
    <View style={styles.sectionHeader}>
      {rule ? <View style={styles.rule} /> : null}
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={cadence ? `${title}. ${cadence}.` : title}
      >
        <View style={styles.sectionRow}>
          <View style={styles.sectionTitleWrap}>
            {index ? (
              <Label style={styles.sectionIndex}>{index}</Label>
            ) : bullet ? (
              <Label style={styles.sectionBullet}>·</Label>
            ) : null}
            <Label
              style={[
                styles.sectionTitle,
                tone === "accent" ? styles.sectionTitleAccent : undefined,
                tone === "muted" ? styles.sectionTitleMuted : undefined
              ]}
            >
              {title}
            </Label>
          </View>
          {cadence && !apilada ? <Label style={styles.sectionCadence}>{`• ${cadence}`}</Label> : null}
        </View>
        {cadence && apilada ? (
          <Label style={styles.sectionCadenceBelow}>{`• ${cadence}`}</Label>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Leyenda de una barra: qué mide, en una línea, con el gris de metadato.
 *
 * El frame la usa en vez de un descargo de dos frases: la barra ilustra un dato
 * que está escrito al lado, y decirlo una vez alcanza.
 */
export function Legend({ children }: { children: string }) {
  return <Label style={styles.legend}>{children}</Label>;
}

/** Acción de texto del canon: `VER TU MOMENTO ›` en cobre, con 44 pt de alto. */
export function LinkRow({
  label,
  onPress,
  accessibilityLabel,
  accessibilityHint
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  return (
    <Touchable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      style={styles.link}
      pressedStyle={styles.pressed}
    >
      <Label style={styles.linkLabel}>{label}</Label>
      <Text style={styles.linkChevron} allowFontScaling={false}>
        ›
      </Text>
    </Touchable>
  );
}

/** Fila de metadatos en mono, separados por `·`, con repliegue en vez de recorte. */
export function MetaRow({ items }: { items: readonly (string | null)[] }) {
  const visibles = items.filter((item): item is string => Boolean(item));
  if (visibles.length === 0) return null;
  return (
    <View style={styles.metaRow}>
      {visibles.map((item, index) => (
        <View key={item} style={styles.metaCell}>
          {index > 0 ? <Label style={styles.metaSep}>·</Label> : null}
          <Label style={styles.metaText}>{item}</Label>
        </View>
      ))}
    </View>
  );
}

/** Chip de una sola palabra, contorneado, como el `EXACTO` del frame. */
export function StateChip({ label }: { label: string }) {
  return (
    <View style={styles.stateChip}>
      <Label style={styles.stateChipText}>{label}</Label>
    </View>
  );
}

/**
 * La ventana de un tránsito: una línea fina con una marca por momento y, debajo,
 * la misma secuencia como lista cronológica.
 *
 * Qué dice el dibujo, y por qué así:
 *
 * - **inicio y cierre**, en gris y HUECOS: son los bordes de la ventana, o sea
 *   contexto. Un punto lleno en cada extremo los ponía al mismo nivel que el
 *   contacto exacto, que es el dato;
 * - **cada contacto exacto**, lleno y en hueso. Son todos: un tránsito
 *   retrógrado pasa dos o tres veces por el mismo punto y dibujar sólo el "pico"
 *   borraba los otros;
 * - **HOY**, lleno y en cobre, en la posición del instante actual. Sin esta marca
 *   no había forma de ver de un vistazo si el contacto ya pasó o todavía falta.
 *
 * ## Por qué los rótulos son una lista y no una fila (QA22-012)
 *
 * Estaban debajo de la línea, en una fila con `flexWrap`. Con tres contactos
 * —Saturno–Júpiter tiene tres— los seis hitos no entraban en un renglón: `INICIO`,
 * dos `EXACTO` y `HOY` quedaban arriba, y el tercer `EXACTO` y `CIERRE` saltaban a
 * una segunda fila **empezando desde la izquierda**, aunque sus marcas estuvieran
 * casi al final de la línea. El orden espacial de los rótulos contradecía al de
 * los puntos y las fechas dejaban de poder asociarse con seguridad.
 *
 * La línea proporcional se conserva —es la que muestra las distancias reales— y
 * los rótulos pasan a una lista vertical, un hito por renglón y en orden
 * cronológico. Una lista no puede reordenarse sola al envolver: es el mismo orden
 * que el anuncio de VoiceOver y que el modelo.
 *
 * El año aparece en todas las fechas cuando la ventana cruza un cambio de año, y
 * en ninguna cuando no lo cruza.
 *
 * Es un dibujo estático —no hay animación que "Reducir movimiento" deba apagar—
 * y para VoiceOver es UNA sola imagen con la ventana dicha en palabras, en orden
 * cronológico: la lista de abajo queda oculta para el lector, así que no se leen
 * doce fragmentos sueltos (`INICIO`, `12 SEP`, `EXACTO`…) sin decir de qué son.
 *
 * `estimated` cambia lo que se AFIRMA, no sólo el dibujo: con una cronología
 * estimada la línea va punteada y el anuncio lo dice. Si el cálculo verificó las
 * fechas, no se las llama estimadas.
 *
 * Qué momentos hay y dónde caen NO se decide acá: lo resuelve
 * `transitTimeline` (`@/domain/transitDetail`), que es puro y se prueba entero.
 */
export function ArcTimeline({
  startsAt,
  peakAt,
  endsAt,
  timezone,
  nowMs,
  contacts,
  estimated = false
}: {
  startsAt: number;
  peakAt: number;
  endsAt: number;
  timezone: string;
  /** Ahora, para ubicar la marca de HOY. Sin instante no se dibuja. */
  nowMs?: number;
  /** Los contactos exactos verificados. Sin ellos, el pico es el único contacto. */
  contacts?: readonly number[];
  estimated?: boolean;
}) {
  const timeline = transitTimeline({
    startsAt,
    peakAt,
    endsAt,
    contacts,
    // Sin instante compartido no se puede ubicar HOY sin inventarlo: se pasa 0,
    // que cae fuera de cualquier ventana real y deja la marca afuera.
    nowMs: nowMs ?? 0,
    timezone,
    estimated
  });

  return (
    <View>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={timeline.voice}
        style={styles.timelineDraw}
      >
        <Svg width="100%" height={14} viewBox="0 0 100 14" preserveAspectRatio="none">
          <Line
            x1={1}
            y1={7}
            x2={99}
            y2={7}
            stroke={v492.colors.line}
            strokeWidth={0.6}
            strokeDasharray={estimated ? "2 2" : undefined}
          />
          {timeline.marks.map((mark) => (
            <Marca key={`${mark.kind}-${mark.atMs}`} mark={mark} />
          ))}
        </Svg>
      </View>
      <View
        style={styles.timelineList}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {timeline.marks.map((mark) => (
          <View key={`${mark.kind}-${mark.atMs}`} style={styles.timelineItem}>
            <View style={[styles.timelineBullet, puntoColor(mark)]} />
            <Label style={[styles.timelineItemLabel, etiquetaColor(mark)]}>{mark.label}</Label>
            <Mono style={fechaColor(mark)}>{mark.dateLabel}</Mono>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Una marca sobre la línea. La forma la decide el tipo: los bordes son círculos
 * huecos —contexto— y los momentos son puntos llenos.
 */
function Marca({ mark }: { mark: TimelineMark }) {
  const x = 2 + mark.ratio * 96;
  if (mark.kind === "start" || mark.kind === "end") {
    return <Circle cx={x} cy={7} r={1.6} fill="none" stroke={v492.colors.textDim} strokeWidth={0.6} />;
  }
  return (
    <Circle
      cx={x}
      cy={7}
      r={mark.kind === "today" ? 2.6 : 2.2}
      fill={mark.kind === "today" ? v492.colors.copper : v492.colors.text}
    />
  );
}

/** Gris para los bordes, hueso para un contacto, cobre para hoy. */
function etiquetaColor(mark: TimelineMark) {
  if (mark.kind === "today") return styles.timelineLabelToday;
  if (mark.kind === "contact") return styles.timelineLabelContact;
  return styles.timelineLabel;
}

/**
 * El punto de la lista, con la MISMA jerarquía de color que la marca de la línea:
 * es lo que permite emparejar cada renglón con su punto sobre el dibujo, que es
 * exactamente lo que la fila con reflujo había roto.
 */
function puntoColor(mark: TimelineMark) {
  if (mark.kind === "today") return styles.timelineBulletToday;
  if (mark.kind === "contact") return styles.timelineBulletContact;
  return styles.timelineBulletEdge;
}

function fechaColor(mark: TimelineMark) {
  if (mark.kind === "today") return styles.timelineDateToday;
  if (mark.kind === "contact") return styles.timelineDateContact;
  return styles.timelineDate;
}

/**
 * Glifo del aspecto, dibujado en vector.
 *
 * El frame escribe los tránsitos en notación corta —`Venus △ tu Luna`— y el
 * glifo va en el medio. Se dibuja con `react-native-svg`, no con un carácter
 * Unicode: la app ya resuelve así el resto de sus símbolos astrológicos
 * (`src/domain/astroGlyphs`) para no depender de qué tipografía tiene el
 * sistema. El nombre completo del aspecto sigue estando en la etiqueta accesible
 * de la fila, así que el dibujo nunca es el único portador del dato.
 */
export function AspectGlyph({ aspect, size = 13 }: { aspect: string; size?: number }) {
  const color = v492.colors.text;
  const stroke = 1.5;
  const draw = () => {
    switch (aspect) {
      case "trine":
        return <Path d="M12 4 L20 18 L4 18 Z" fill="none" stroke={color} strokeWidth={stroke} />;
      case "square":
        return <Path d="M5 5 H19 V19 H5 Z" fill="none" stroke={color} strokeWidth={stroke} />;
      case "opposition":
        return (
          <>
            <Circle cx={6} cy={12} r={3.4} fill="none" stroke={color} strokeWidth={stroke} />
            <Circle cx={18} cy={12} r={3.4} fill="none" stroke={color} strokeWidth={stroke} />
            <Line x1={9.4} y1={12} x2={14.6} y2={12} stroke={color} strokeWidth={stroke} />
          </>
        );
      case "conjunction":
        return (
          <>
            <Circle cx={13} cy={13} r={4} fill="none" stroke={color} strokeWidth={stroke} />
            <Line x1={4} y1={4} x2={11} y2={11} stroke={color} strokeWidth={stroke} />
          </>
        );
      case "sextile":
      default:
        return (
          <>
            <Line x1={12} y1={4} x2={12} y2={20} stroke={color} strokeWidth={stroke} />
            <Line x1={5} y1={8} x2={19} y2={16} stroke={color} strokeWidth={stroke} />
            <Line x1={5} y1={16} x2={19} y2={8} stroke={color} strokeWidth={stroke} />
          </>
        );
    }
  };
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {draw()}
      </Svg>
    </View>
  );
}

/** Nota de límite del canon: una línea gris, sin caja ni título propio. */
export function InlineNote({ children }: { children: ReactNode }) {
  return <Note style={styles.inlineNote}>{children}</Note>;
}

const styles = StyleSheet.create({
  inlineNote: { marginTop: v492.space.md },
  legend: { color: v492.colors.textDim, marginTop: v492.space.md },
  link: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: v492.space.sm,
    justifyContent: "flex-start",
    marginTop: v492.space.lg,
    minHeight: v492.touch,
    minWidth: v492.touch
  },
  linkChevron: {
    color: v492.colors.copper,
    fontFamily: v492.fonts.mono,
    fontSize: v492.type.label.size
  },
  linkLabel: { color: v492.colors.copper },
  metaCell: { alignItems: "center", flexDirection: "row", gap: v492.space.sm },
  metaRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: v492.space.sm },
  metaSep: { color: v492.colors.textDim },
  metaText: { color: v492.colors.textDim },
  pressed: { opacity: 0.6 },
  rule: { backgroundColor: v492.colors.line, height: 1, marginBottom: v492.space.lg },
  sectionBullet: { color: v492.colors.copper },
  sectionCadence: { color: v492.colors.textDim, flexShrink: 1, textAlign: "right" },
  sectionCadenceBelow: { color: v492.colors.textDim, marginTop: 2 },
  sectionHeader: { marginBottom: v492.space.md, marginTop: v492.space.xl },
  sectionIndex: { color: v492.colors.copper },
  sectionRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: v492.space.md,
    justifyContent: "space-between"
  },
  sectionTitle: { color: v492.colors.text, flexShrink: 1 },
  sectionTitleAccent: { color: v492.colors.copperSoft },
  sectionTitleMuted: { color: v492.colors.textDim },
  sectionTitleWrap: { flexDirection: "row", flexShrink: 1, gap: v492.space.sm },
  stateChip: {
    alignSelf: "flex-start",
    borderColor: v492.colors.copper,
    borderRadius: v492.radius.pill,
    borderWidth: 1,
    paddingHorizontal: v492.space.md,
    paddingVertical: 3
  },
  stateChipText: { color: v492.colors.copperSoft },
  /** El punto de cada renglón: el mismo tamaño para todos, distinto color. */
  timelineBullet: { borderRadius: 3, height: 6, marginTop: 5, width: 6 },
  timelineBulletContact: { backgroundColor: v492.colors.text },
  timelineBulletEdge: { backgroundColor: v492.colors.textDim },
  timelineBulletToday: { backgroundColor: v492.colors.copper },
  timelineDate: { color: v492.colors.textDim },
  timelineDateContact: { color: v492.colors.text },
  timelineDateToday: { color: v492.colors.text },
  timelineDraw: { width: "100%" },
  timelineItem: { flexDirection: "row", gap: v492.space.md },
  /**
   * El rótulo toma el ancho libre y empuja la fecha contra el borde derecho, así
   * que las fechas quedan en columna y se pueden comparar de un vistazo.
   */
  timelineItemLabel: { flex: 1 },
  timelineLabel: { color: v492.colors.textDim },
  timelineLabelContact: { color: v492.colors.textMuted },
  timelineLabelToday: { color: v492.colors.copper },
  /**
   * Vertical y sin `flexWrap`: un hito por renglón, en orden cronológico. La fila
   * que se repliega es justo lo que QA22-012 registró rompiéndose con tres
   * contactos.
   */
  timelineList: { marginTop: v492.space.md, rowGap: v492.space.sm }
});
