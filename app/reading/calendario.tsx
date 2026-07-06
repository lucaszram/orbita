import { StyleSheet, Text, View } from "react-native";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Eyebrow, H2, Note } from "@/components/orbita/kit";
import { useAppData } from "@/domain/appData";
import { orbita } from "@/theme/orbita";

const WEEK = ["L", "M", "M", "J", "V", "S", "D"];

export default function CalendarioScreen() {
  const { lunar } = useAppData();
  const intense = new Set(lunar.intense);
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
                <Text style={[styles.day, intense.has(d) && styles.dayIntense]}>{d}</Text>
                {intense.has(d) ? <View style={styles.dot} /> : <View style={styles.dotEmpty} />}
              </>
            ) : null}
          </View>
        ))}
      </View>
      <View style={{ height: orbita.spacing.xl }} />
      <Note>•  días de mayor intensidad emocional</Note>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  weekday: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.monoMedium, fontSize: 11, textAlign: "center", width: `${100 / 7}%` },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: orbita.spacing.md },
  cell: { alignItems: "center", height: 54, justifyContent: "center", width: `${100 / 7}%` },
  day: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.body, fontSize: 14 },
  dayIntense: { color: orbita.colors.bone },
  dot: { backgroundColor: orbita.colors.copper, borderRadius: 3, height: 5, marginTop: 5, width: 5 },
  dotEmpty: { height: 5, marginTop: 5, width: 5 }
});
