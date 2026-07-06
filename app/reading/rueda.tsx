import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Body, H2, Note } from "@/components/orbita/kit";
import { chartMock } from "@/content/chartMock";
import { orbita } from "@/theme/orbita";

/** Carta / Rueda completa (Figma V4.7 · 335:2), dibujada con react-native-svg. */

const SIZE = 345;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUT = 152;
const R_MID = 120;
const R_IN = 58;
const R_SIGNS = (R_OUT + R_MID) / 2;
const R_PLANETS = 92;
const R_HOUSES = 44;

const SIGNS = ["Aries", "Tauro", "Géminis", "Cáncer", "Leo", "Virgo", "Libra", "Escorpio", "Sagitario", "Capricornio", "Acuario", "Piscis"];
const SIGN_ABBR = ["ARI", "TAU", "GÉM", "CÁN", "LEO", "VIR", "LIB", "ESC", "SAG", "CAP", "ACU", "PIS"];
const GLYPHS: Record<string, string> = {
  Sol: "☉",
  Luna: "☽",
  Mercurio: "☿",
  Venus: "♀",
  Marte: "♂",
  Júpiter: "♃",
  Saturno: "♄"
};
const BLUE = "#8CA6C4";
const COPPER = orbita.colors.copper;
const LINE = "rgba(244,238,228,0.22)";

function pos(angleDeg: number, r: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

/** Ángulo pseudo-estable por placement: centro del signo + corrimiento por casa
 *  e índice (desempata planetas que comparten signo y casa, ej. Sol y Mercurio). */
function planetAngle(p: { planet: string; sign: string; house?: number }, index: number): number {
  const signIdx = Math.max(0, SIGNS.indexOf(p.sign));
  const jitter = ((((p.house ?? 0) + index) % 3) - 1) * 10;
  return signIdx * 30 + 15 + jitter;
}

export default function RuedaScreen() {
  const chart = chartMock;
  const planetPos = new Map<string, { x: number; y: number }>();
  chart.placements.forEach((p, i) => {
    planetPos.set(p.planet, pos(planetAngle(p, i), R_PLANETS));
  });

  return (
    <DetailScreen eyebrow="Carta · Rueda completa">
      <H2>Tu carta natal.</H2>
      <View style={styles.wheelWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={CX} cy={CY} r={R_OUT} stroke={LINE} strokeWidth={1} fill="none" />
          <Circle cx={CX} cy={CY} r={R_MID} stroke={LINE} strokeWidth={1} fill="none" />
          <Circle cx={CX} cy={CY} r={R_IN} stroke="rgba(244,238,228,0.14)" strokeWidth={1} fill="none" />

          {SIGN_ABBR.map((abbr, i) => {
            const a = pos(i * 30, R_MID);
            const b = pos(i * 30, R_OUT);
            const label = pos(i * 30 + 15, R_SIGNS);
            return (
              <G key={abbr}>
                <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={LINE} strokeWidth={1} />
                <SvgText
                  x={label.x}
                  y={label.y + 3}
                  fill={orbita.colors.muted}
                  fontSize={9}
                  fontFamily={orbita.fonts.monoMedium}
                  textAnchor="middle"
                >
                  {abbr}
                </SvgText>
              </G>
            );
          })}

          {chart.aspects.map((a) => {
            const from = planetPos.get(a.from);
            const to = planetPos.get(a.to);
            if (!from || !to) return null;
            return (
              <Line
                key={`${a.from}-${a.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={a.harmony === "tension" ? COPPER : BLUE}
                strokeWidth={1}
                opacity={0.75}
              />
            );
          })}

          {chart.placements.map((p, i) => {
            const c = planetPos.get(p.planet)!;
            return (
              <G key={p.planet}>
                <Circle
                  cx={c.x}
                  cy={c.y}
                  r={11}
                  fill={orbita.colors.background}
                  stroke={i < 2 ? COPPER : LINE}
                  strokeWidth={1}
                />
                <SvgText x={c.x} y={c.y + 4} fill={orbita.colors.bone} fontSize={11} textAnchor="middle">
                  {GLYPHS[p.planet] ?? "•"}
                </SvgText>
              </G>
            );
          })}

          {[1, 4, 7, 10].map((h) => {
            const c = pos((h - 1) * 30 + 15, R_HOUSES);
            return (
              <SvgText
                key={`h${h}`}
                x={c.x}
                y={c.y + 3}
                fill={orbita.colors.mutedDim}
                fontSize={9}
                fontFamily={orbita.fonts.mono}
                textAnchor="middle"
              >
                {["I", "IV", "VII", "X"][[1, 4, 7, 10].indexOf(h)]}
              </SvgText>
            );
          })}
        </Svg>
        <Text style={[styles.axis, styles.asc]}>ASC</Text>
        <Text style={[styles.axis, styles.dsc]}>DSC</Text>
      </View>

      <View style={styles.legend}>
        <View style={[styles.swatch, { backgroundColor: BLUE }]} />
        <Text style={styles.legendLabel}>ARMONÍA</Text>
        <View style={{ width: orbita.spacing.xl }} />
        <View style={[styles.swatch, { backgroundColor: COPPER }]} />
        <Text style={styles.legendLabel}>TENSIÓN</Text>
      </View>
      <Body>Tocá un planeta para leer qué mueve en tu carta. La rueda muestra tus posiciones de nacimiento.</Body>
      <Note>{chart.accuracy}</Note>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  wheelWrap: { alignItems: "center", alignSelf: "center", marginTop: orbita.spacing.xl },
  axis: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 1,
    position: "absolute",
    top: SIZE / 2 - 6
  },
  asc: { left: -6 },
  dsc: { right: -6 },
  legend: { alignItems: "center", flexDirection: "row", marginTop: orbita.spacing.xl },
  swatch: { borderRadius: 1, height: 2, marginRight: orbita.spacing.sm, width: 22 },
  legendLabel: { color: orbita.colors.muted, fontFamily: orbita.fonts.monoMedium, fontSize: 10, letterSpacing: 1 }
});
