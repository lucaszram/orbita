import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Divider, Eyebrow, Note, TabStrip } from "@/components/orbita/kit";
import { GlyphRow } from "@/components/orbita/GlyphRow";
import { EmptyState, ErrorState, LoadingState } from "@/components/orbita/states";
import { mapNatalChart } from "@/components/web/orbita-chart";
import { chartMock } from "@/content/chartMock";
import { useLiveApp } from "@/hooks/useLiveApp";
import { appApi, type NatalChartPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

type Tab = "planetas" | "casas" | "aspectos";

/**
 * Carta · Posiciones (tabla): planetas, casas y aspectos reales de `charts.current`.
 * Con sesión, data real; sin sesión, mock. Es la versión detallada de lo que el
 * hub muestra en el toggle TABLA.
 */
export default function CartaPosicionesScreen() {
  const { isLive } = useLiveApp();
  if (!isLive) return <CartaTablaView payload={chartMock} />;
  return <CartaTablaLive />;
}

function CartaTablaLive() {
  const chartDoc = useQuery(appApi.charts.current, {});
  if (chartDoc === undefined) {
    return (
      <DetailScreen eyebrow="Carta">
        <LoadingState />
      </DetailScreen>
    );
  }
  if (chartDoc === null) {
    return (
      <DetailScreen eyebrow="Carta">
        <EmptyState
          eyebrow="TU CARTA NATAL"
          title="Todavía no hay carta"
          body="Completá tu fecha, hora y lugar de nacimiento para calcular tu carta natal."
          cta="COMPLETAR MIS DATOS"
          onCta={() => router.push("/(tabs)/perfil")}
        />
      </DetailScreen>
    );
  }
  let payload: NatalChartPayload;
  try {
    payload = mapNatalChart(chartDoc);
  } catch {
    return (
      <DetailScreen eyebrow="Carta">
        <ErrorState />
      </DetailScreen>
    );
  }
  return <CartaTablaView payload={payload} />;
}

function deg(n?: number): string {
  return n === undefined ? "" : `${Math.round(n)}°`;
}

function CartaTablaView({ payload }: { payload: NatalChartPayload }) {
  const [tab, setTab] = useState<Tab>("planetas");
  const aspects = payload.mainAspects ?? payload.aspects;

  return (
    <DetailScreen eyebrow="Carta">
      <TabStrip
        tabs={[
          { key: "planetas", label: "Planetas" },
          { key: "casas", label: "Casas" },
          { key: "aspectos", label: "Aspectos" }
        ]}
        active={tab}
        onChange={(k) => setTab(k as Tab)}
      />
      <Divider />

      {tab === "planetas" ? (
        <>
          <Eyebrow>POSICIONES</Eyebrow>
          {payload.placements.map((p) => (
            <GlyphRow
              key={p.key ?? p.planet}
              title={`${p.planet} en ${p.sign}`}
              body={`Casa ${p.house} · ${deg(p.normDegree)}${p.isRetrograde ? " · retrógrado ℞" : ""}`}
            />
          ))}
        </>
      ) : null}

      {tab === "casas" ? (
        <>
          <Eyebrow>CASAS</Eyebrow>
          {payload.houses.map((h) => (
            <View key={h.house} style={styles.row}>
              <Text style={styles.rowNum}>Casa {h.house}</Text>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{h.sign}</Text>
                {h.theme ? <Text style={styles.rowSub}>{h.theme}</Text> : null}
              </View>
            </View>
          ))}
        </>
      ) : null}

      {tab === "aspectos" ? (
        <>
          <Eyebrow>ASPECTOS</Eyebrow>
          {aspects.map((a, i) => (
            <View key={`${a.from}-${a.to}-${i}`} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: a.harmony === "tension" ? orbita.colors.tension : orbita.colors.harmony }]} />
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{`${a.from} ${a.typeEs ?? a.type} ${a.to}`}</Text>
              </View>
              {a.orb !== undefined ? <Text style={styles.rowSub}>{`orbe ${deg(a.orb)}`}</Text> : null}
            </View>
          ))}
        </>
      ) : null}

      <Note>{payload.accuracy}</Note>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    borderBottomColor: orbita.colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingVertical: orbita.spacing.lg
  },
  rowNum: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1,
    marginRight: orbita.spacing.lg,
    width: 64
  },
  rowMain: { flex: 1 },
  rowTitle: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 18, lineHeight: 24 },
  rowSub: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 13, marginTop: 2 },
  dot: { borderRadius: 4, height: 8, marginRight: orbita.spacing.md, width: 8 }
});
