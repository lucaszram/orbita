import { useEffect, useRef } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useAction, useQuery } from "convex/react";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Body, Divider, H2, H3, Note } from "@/components/orbita/kit";
import { glyphFor } from "@/components/orbita/GlyphRow";
import { NatalWheel, mapNatalChart } from "@/components/web/orbita-chart";
import { Radar } from "@/components/web/orbita-values";
import { chartMock } from "@/content/chartMock";
import { personalityMock } from "@/content/personalityMock";
import { valuesMock } from "@/content/valuesMock";
import { useLiveApp } from "@/hooks/useLiveApp";
import {
  appApi,
  type NatalChartPayload,
  type PersonalityReadingPayload,
  type ValuesMapPayload
} from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

/**
 * Horóscopo de personalidad (nativo): lectura editorial por 7 sectores —
 * rueda natal real + secciones interpretativas (LLM `charts.personalityReading`)
 * + mapa de valores. Con sesión, data real; sin sesión, mock (mismo patrón que web).
 */
export default function PersonalidadScreen() {
  const { isLive } = useLiveApp();
  if (!isLive) {
    return <PersonalidadView payload={personalityMock} chart={chartMock} values={valuesMock} />;
  }
  return <PersonalidadLive />;
}

function PersonalidadLive() {
  const reading = useQuery(appApi.charts.personalityReading, {});
  const chartDoc = useQuery(appApi.charts.current, {});
  const values = useQuery(appApi.charts.valuesMap, {});
  // Dispara la generación LLM una vez; el backend no-opea si ya está cacheada o
  // si no hay carta. La query `reading` se actualiza reactiva al cachearse.
  const generate = useAction(appApi.charts.generatePersonalityReading);
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    generate({}).catch(() => {});
  }, [generate]);

  return (
    <PersonalidadView
      payload={reading ?? personalityMock}
      chart={chartDoc ? mapNatalChart(chartDoc) : chartMock}
      values={values ?? valuesMock}
    />
  );
}

function PersonalidadView({
  payload,
  chart,
  values
}: {
  payload: PersonalityReadingPayload;
  chart: NatalChartPayload;
  values: ValuesMapPayload;
}) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - orbita.spacing.gutter * 2, 340);

  return (
    <DetailScreen eyebrow="Horóscopo de personalidad">
      <H2>{payload.headline}</H2>
      <Body>Una lectura completa de tu carta, sector por sector. No es una etiqueta ni una predicción: es un mapa para conocerte.</Body>

      <View style={styles.figure}>
        <NatalWheel payload={chart} size={size} />
      </View>

      {payload.sections.map((s, i) => (
        <View key={s.key}>
          <Divider />
          <Text style={styles.sector}>{`Sector ${String(i + 1).padStart(2, "0")}`}</Text>
          <View style={styles.placementRow}>
            <View style={styles.marker}>
              <Text style={styles.glyph}>{glyphFor(s.placement.label)}</Text>
            </View>
            <Text style={styles.placementLabel}>{s.placement.label.toUpperCase()}</Text>
          </View>
          <H3>{s.title}</H3>
          <Body>{s.body}</Body>
          {s.questions && s.questions.length > 0 ? (
            <View style={styles.questions}>
              {s.questions.map((q) => (
                <View key={q} style={styles.qRow}>
                  <Text style={styles.qMark}>—</Text>
                  <Text style={styles.qText}>{q}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}

      <Divider />
      <Text style={styles.sector}>Sector · Mapa de valores</Text>
      <H3>Qué te impulsa y qué te pesa</H3>
      <View style={styles.figure}>
        <Radar payload={values} size={size} />
      </View>
      <Body>{values.note}</Body>

      <View style={{ height: orbita.spacing.xl }} />
      <Note>{payload.disclaimer}</Note>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  figure: { alignItems: "center", marginVertical: orbita.spacing.lg },
  sector: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: orbita.spacing.sm,
    textTransform: "uppercase"
  },
  placementRow: { alignItems: "center", flexDirection: "row", marginBottom: orbita.spacing.md },
  marker: {
    alignItems: "center",
    borderColor: "rgba(196,106,58,0.5)",
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    marginRight: orbita.spacing.md,
    width: 32
  },
  glyph: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 14 },
  placementLabel: {
    color: orbita.colors.copper,
    flex: 1,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.5
  },
  questions: {
    borderTopColor: "rgba(244,238,228,0.1)",
    borderTopWidth: 1,
    marginTop: orbita.spacing.lg,
    paddingTop: orbita.spacing.lg
  },
  qRow: { flexDirection: "row", marginBottom: orbita.spacing.sm },
  qMark: { color: orbita.colors.copper, fontFamily: orbita.fonts.body, fontSize: 15, marginRight: orbita.spacing.sm },
  qText: { color: orbita.colors.bone, flex: 1, fontFamily: orbita.fonts.serif, fontSize: 16, lineHeight: 24 }
});
