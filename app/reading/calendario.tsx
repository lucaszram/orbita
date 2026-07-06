import { StyleSheet, Text, View } from "react-native";
import { DetailScreen } from "@/components/home/DetailScreen";
import { H2, Note } from "@/components/orbita/kit";
import { useAppData } from "@/domain/appData";
import { orbita } from "@/theme/orbita";

const WEEK = ["L", "M", "M", "J", "V", "S", "D"];

/** Calendario mensual (Figma V4.7 · 271:2): intensidad, fases clave y anillo de hoy. */
export default function CalendarioScreen() {
  const { lunar } = useAppData();
  const intense = new Set(lunar.intense);
  const phases = new Set(lunar.moonPhases);
  const cells: (number | null)[] = [];
  for (let i = 0; i < lunar.startCol; i++) cells.push(null);
  for (let d = 1; d <= lunar.daysInMonth; d++) cells.push(d);

  return (
    <DetailScreen eyebrow={`Calendario · ${lunar.monthLabel}`}>
      <H2>Tu mes{"\n"}en energía.</H2>
      <View style={{ height: orbita.spacing.xl }} />
      <View style={styles.row}>
        {WEEK.map((d, i) => (
          <Text key={i} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((d, i) => (
          <View key={i} style={styles.cell}>
            {d != null ? (
              <>
                <View style={[styles.dayWrap, d === lunar.today && styles.todayRing]}>
                  <Text style={[styles.day, intense.has(d) && styles.dayIntense, d === lunar.today && styles.dayToday]}>
                    {d}
                  </Text>
                </View>
                <View style={styles.under}>
                  {intense.has(d) ? <View style={styles.dot} /> : null}
                  {phases.has(d) ? <Text style={styles.phase}>☾</Text> : null}
                </View>
              </>
            ) : null}
          </View>
        ))}
      </View>
      <View style={{ height: orbita.spacing.xl }} />
      <Note>•  días de mayor intensidad emocional</Note>
      <Note>☾  fases clave de la luna   ·   ○  hoy</Note>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  weekday: {
    color: orbita.colors.mutedDim,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    textAlign: "center",
    width: `${100 / 7}%`
  },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: orbita.spacing.md },
  cell: { alignItems: "center", height: 56, justifyContent: "flex-start", paddingTop: 6, width: `${100 / 7}%` },
  dayWrap: { alignItems: "center", borderRadius: 15, height: 30, justifyContent: "center", width: 30 },
  todayRing: { borderColor: orbita.colors.copper, borderWidth: 1 },
  day: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.body, fontSize: 14 },
  dayIntense: { color: orbita.colors.bone },
  dayToday: { color: orbita.colors.bone, fontFamily: orbita.fonts.bodyMedium },
  under: { alignItems: "center", flexDirection: "row", gap: 3, height: 12, marginTop: 2 },
  dot: { backgroundColor: orbita.colors.copper, borderRadius: 3, height: 5, width: 5 },
  phase: { color: orbita.colors.muted, fontSize: 9 }
});
