import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { DetailScreen } from "@/components/home/DetailScreen";
import { H2, Note } from "@/components/orbita/kit";
import { EmptyState, LoadingState } from "@/components/orbita/states";
import { Radar } from "@/components/web/orbita-values";
import { valuesMock } from "@/content/valuesMock";
import { useLiveApp } from "@/hooks/useLiveApp";
import { appApi, type ValuesMapPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

/**
 * Mapa de valores (nativo): radar de 8 ejes + impulsa/pesa. Con sesión, data
 * real (`charts.valuesMap`); sin sesión, mock. Reusa el `Radar` compartido —
 * una sola implementación del radar para web y nativo.
 */
export default function ValoresScreen() {
  const { isLive } = useLiveApp();
  if (!isLive) return <ValoresView payload={valuesMock} />;
  return <ValoresLive />;
}

function ValoresLive() {
  const values = useQuery(appApi.charts.valuesMap, {});
  if (values === undefined) {
    return (
      <DetailScreen eyebrow="Mapa de valores">
        <LoadingState />
      </DetailScreen>
    );
  }
  if (values === null) {
    return (
      <DetailScreen eyebrow="Mapa de valores">
        <EmptyState
          title="Todavía no hay mapa"
          body="Completá tu fecha, hora y lugar de nacimiento para calcular tu mapa de valores."
          cta="COMPLETAR MIS DATOS"
          onCta={() => router.push("/(tabs)/perfil")}
        />
      </DetailScreen>
    );
  }
  return <ValoresView payload={values} />;
}

const COPPER = orbita.colors.copper;
const BLUE = "#8CA6C4";

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { backgroundColor: color, width: `${Math.round(value * 100)}%` }]} />
    </View>
  );
}

function ValoresView({ payload }: { payload: ValuesMapPayload }) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - orbita.spacing.gutter * 2, 345);

  return (
    <DetailScreen eyebrow="Mapa de valores">
      <H2>Qué te impulsa,{"\n"}qué te pesa.</H2>

      <View style={styles.radarWrap}>
        <Radar payload={payload} size={size} />
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
          {payload.topDrivers.map((d) => (
            <View key={d.label} style={styles.cardRow}>
              <Text style={styles.cardItem}>{d.label}</Text>
              <MiniBar value={d.value} color={COPPER} />
            </View>
          ))}
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>TE PESA</Text>
          {payload.topStressors.map((d) => (
            <View key={d.label} style={styles.cardRow}>
              <Text style={styles.cardItem}>{d.label}</Text>
              <MiniBar value={d.value} color={BLUE} />
            </View>
          ))}
        </View>
      </View>

      <Note>{payload.note}</Note>
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
