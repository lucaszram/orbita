import { StyleSheet, Text, View } from "react-native";
import Svg, { Polygon, Line, Text as SvgText } from "react-native-svg";
import { DetailScreen } from "@/components/home/DetailScreen";
import { H2, Note } from "@/components/orbita/kit";
import { valuesMock } from "@/content/valuesMock";
import { orbita } from "@/theme/orbita";

/** Mapa de valores (Figma V4.7 · 338:2): radar de 8 ejes + impulsa/pesa. */

const SIZE = 345;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 118;
const R_LABEL = 140;
const BLUE = "#8CA6C4";
const COPPER = orbita.colors.copper;

function pos(i: number, total: number, r: number): { x: number; y: number } {
  const rad = ((i * 360) / total - 90) * (Math.PI / 180);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function polygonPoints(values: number[], r = R): string {
  return values
    .map((v, i) => {
      const p = pos(i, values.length, r * v);
      return `${p.x},${p.y}`;
    })
    .join(" ");
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { backgroundColor: color, width: `${Math.round(value * 100)}%` }]} />
    </View>
  );
}

export default function ValoresScreen() {
  const v = valuesMock;
  const n = v.axes.length;
  return (
    <DetailScreen eyebrow="Mapa de valores">
      <H2>Qué te impulsa,{"\n"}qué te pesa.</H2>

      <View style={styles.radarWrap}>
        <Svg width={SIZE} height={SIZE}>
          {[1 / 3, 2 / 3, 1].map((ring) => (
            <Polygon
              key={ring}
              points={polygonPoints(new Array(n).fill(ring))}
              stroke="rgba(244,238,228,0.14)"
              strokeWidth={1}
              fill="none"
            />
          ))}
          {v.axes.map((a, i) => {
            const p = pos(i, n, R);
            return <Line key={a.key} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="rgba(244,238,228,0.1)" strokeWidth={1} />;
          })}
          <Polygon
            points={polygonPoints(v.axes.map((a) => a.tension))}
            stroke={BLUE}
            strokeWidth={1.5}
            fill="rgba(140,166,196,0.12)"
          />
          <Polygon
            points={polygonPoints(v.axes.map((a) => a.harmony))}
            stroke={COPPER}
            strokeWidth={1.5}
            fill="rgba(196,106,58,0.14)"
          />
          {v.axes.map((a, i) => {
            const p = pos(i, n, R_LABEL);
            return (
              <SvgText
                key={`l${a.key}`}
                x={p.x}
                y={p.y + 3}
                fill={orbita.colors.muted}
                fontSize={9}
                fontFamily={orbita.fonts.monoMedium}
                textAnchor="middle"
              >
                {a.label.toUpperCase()}
              </SvgText>
            );
          })}
        </Svg>
      </View>

      <View style={styles.legend}>
        <View style={[styles.swatch, { backgroundColor: COPPER }]} />
        <Text style={styles.legendLabel}>ARMONÍA</Text>
        <View style={{ width: orbita.spacing.xl }} />
        <View style={[styles.swatch, { backgroundColor: BLUE }]} />
        <Text style={styles.legendLabel}>TENSIÓN</Text>
      </View>

      <View style={styles.cards}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>TE IMPULSA</Text>
          {v.topDrivers.map((d) => (
            <View key={d.label} style={styles.cardRow}>
              <Text style={styles.cardItem}>{d.label}</Text>
              <MiniBar value={d.value} color={COPPER} />
            </View>
          ))}
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>TE PESA</Text>
          {v.topStressors.map((d) => (
            <View key={d.label} style={styles.cardRow}>
              <Text style={styles.cardItem}>{d.label}</Text>
              <MiniBar value={d.value} color={BLUE} />
            </View>
          ))}
        </View>
      </View>

      <Note>{v.note}</Note>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  radarWrap: { alignItems: "center", alignSelf: "center", marginTop: orbita.spacing.lg },
  legend: { alignItems: "center", flexDirection: "row", marginTop: orbita.spacing.lg },
  swatch: { borderRadius: 1, height: 2, marginRight: orbita.spacing.sm, width: 22 },
  legendLabel: { color: orbita.colors.muted, fontFamily: orbita.fonts.monoMedium, fontSize: 10, letterSpacing: 1 },

  cards: { flexDirection: "row", gap: orbita.spacing.md, marginTop: orbita.spacing.xl },
  card: {
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.md,
    borderWidth: 1,
    flex: 1,
    padding: orbita.spacing.lg
  },
  cardLabel: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: orbita.spacing.md
  },
  cardRow: { marginBottom: orbita.spacing.md },
  cardItem: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 14, marginBottom: 4 },
  barTrack: { backgroundColor: orbita.colors.line, borderRadius: 2, height: 3, width: "100%" },
  barFill: { borderRadius: 2, height: 3 }
});
