import { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { useAction } from "convex/react";
import Svg, { Line } from "react-native-svg";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Body, Divider, Eyebrow, H2, H3, Note } from "@/components/orbita/kit";
import { transitMock } from "@/content/transitMock";
import { useLiveApp } from "@/hooks/useLiveApp";
import { proposedApi, type TransitDetailPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

const PLANET_IMG = require("../../assets/orbita/optimized/core/orbita_home_hero_orbital_b.jpg");
const VENUS_IMG = require("../../assets/orbita/optimized/core/orbita_moon_phase_waxing.jpg");

/** Fecha local YYYY-MM-DD (componentes locales, mismo criterio que la web; no UTC). */
function todayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Tránsito / En el cielo (Figma V4.7 · 334:2): escena espacial + frecuencia + en la Tierra. */
export default function TransitoDetalleScreen() {
  const { isLive } = useLiveApp();
  if (!isLive) return <TransitoDetalle t={transitMock} />;
  return <TransitoDetalleLive />;
}

/**
 * Con sesión: el cielo REAL del día vía la action `transits.getToday` (patrón
 * imperativo useState/useEffect + flag `alive`, como en la web). El payload calza
 * 1:1 con la forma que ya renderiza la vista; sin remapeo.
 */
function TransitoDetalleLive() {
  const getToday = useAction(proposedApi.transitToday);
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "error" } | { kind: "ok"; data: TransitDetailPayload }
  >({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    getToday({ localDate: todayLocalDate() })
      .then((r) => {
        if (alive) setState({ kind: "ok", data: r as TransitDetailPayload });
      })
      .catch(() => {
        if (alive) setState({ kind: "error" });
      });
    return () => {
      alive = false;
    };
  }, [getToday]);

  if (state.kind === "loading") {
    return (
      <DetailScreen eyebrow="Tránsito · Hoy">
        <View style={styles.loading}>
          <ActivityIndicator color={orbita.colors.copper} />
          <Text style={styles.loadingText}>Leyendo el cielo de hoy…</Text>
        </View>
      </DetailScreen>
    );
  }
  // Error o dato ausente: caemos al mock; nunca pantalla rota.
  if (state.kind === "error") return <TransitoDetalle t={transitMock} />;
  return <TransitoDetalle t={state.data ?? transitMock} />;
}

function TransitoDetalle({ t }: { t: TransitDetailPayload }) {
  return (
    <DetailScreen eyebrow="Tránsito · Hoy">
      <H2>{t.title}</H2>

      <View style={{ height: orbita.spacing.xl }} />
      <Eyebrow>CÓMO SE VE EN EL CIELO</Eyebrow>
      <View style={styles.scene}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Line
            x1="26%"
            y1="78%"
            x2="78%"
            y2="26%"
            stroke={orbita.colors.copper}
            strokeWidth={1}
            strokeDasharray="4 5"
            opacity={0.8}
          />
        </Svg>
        <Text style={styles.aspectLabel}>{`${t.aspect.type.toUpperCase()} · ${t.aspect.angleLabel}`}</Text>

        <View style={[styles.bodyWrap, styles.vos]}>
          <Image source={PLANET_IMG} style={styles.vosImg} />
          <Text style={styles.bodyLabel}>VOS</Text>
        </View>
        <View style={[styles.bodyWrap, styles.transiting]}>
          <View style={styles.transitingDot} />
          <Text style={styles.bodyLabel}>{t.scene.transitingBody.label}</Text>
        </View>
        <View style={[styles.bodyWrap, styles.natal]}>
          <Image source={VENUS_IMG} style={styles.natalImg} />
          <Text style={styles.bodyLabel}>{t.scene.natalPoint.label}</Text>
        </View>
      </View>
      <Body>{t.reading.plain}</Body>

      <Divider />
      <Eyebrow>CADA CUÁNTO PASA</Eyebrow>
      <View style={styles.timeline}>
        <View style={styles.timelineTrack} />
        {t.frequency.timeline.map((p) => (
          <View key={p.label} style={styles.timelineStop}>
            <View style={[styles.timelineDot, p.current && styles.timelineDotCurrent]} />
            <Text style={[styles.timelineLabel, p.current && styles.timelineLabelCurrent]}>{p.label}</Text>
          </View>
        ))}
      </View>
      <Note>{t.frequency.label}</Note>

      <Divider />
      <Eyebrow>CÓMO SE JUEGA EN LA TIERRA</Eyebrow>
      <H3>{t.earth.headline}</H3>
      <View style={{ height: orbita.spacing.md }} />
      {t.earth.suggestions.map((s) => (
        <View key={s} style={styles.suggestion}>
          <Text style={styles.check}>✓</Text>
          <Text style={styles.suggestionText}>{s}</Text>
        </View>
      ))}
      <View style={{ height: orbita.spacing.lg }} />
      <Note>{`Ventana ${t.window.label} · ${t.window.note}`}</Note>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", paddingTop: orbita.spacing.xxl * 2 },
  loadingText: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.bodyMedium,
    fontSize: 14,
    marginTop: orbita.spacing.md
  },
  scene: {
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.lg,
    borderWidth: 1,
    height: 240,
    marginTop: orbita.spacing.sm,
    marginBottom: orbita.spacing.lg,
    overflow: "hidden"
  },
  aspectLabel: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 10,
    left: "30%",
    letterSpacing: 1,
    position: "absolute",
    top: "44%"
  },
  bodyWrap: { alignItems: "center", position: "absolute" },
  bodyLabel: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 6
  },
  vos: { bottom: 18, left: 22 },
  vosImg: { borderRadius: 22, height: 44, opacity: 0.95, width: 44 },
  transiting: { left: "44%", top: "58%" },
  transitingDot: {
    backgroundColor: orbita.colors.bone,
    borderRadius: 7,
    height: 14,
    shadowColor: orbita.colors.copper,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    width: 14
  },
  natal: { right: 24, top: 20 },
  natalImg: {
    borderColor: "rgba(196,106,58,0.5)",
    borderRadius: 19,
    borderWidth: 1,
    height: 38,
    width: 38
  },

  timeline: { flexDirection: "row", justifyContent: "space-between", marginTop: orbita.spacing.lg },
  timelineTrack: {
    backgroundColor: orbita.colors.line,
    height: 1,
    left: 12,
    position: "absolute",
    right: 12,
    top: 4
  },
  timelineStop: { alignItems: "center", width: 70 },
  timelineDot: {
    backgroundColor: orbita.colors.background,
    borderColor: orbita.colors.mutedDim,
    borderRadius: 5,
    borderWidth: 1,
    height: 9,
    width: 9
  },
  timelineDotCurrent: { backgroundColor: orbita.colors.copper, borderColor: orbita.colors.copper },
  timelineLabel: {
    color: orbita.colors.mutedDim,
    fontFamily: orbita.fonts.mono,
    fontSize: 10,
    marginTop: orbita.spacing.sm
  },
  timelineLabelCurrent: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium },

  suggestion: { flexDirection: "row", gap: orbita.spacing.md, marginTop: orbita.spacing.md },
  check: { color: orbita.colors.copper, fontFamily: orbita.fonts.body, fontSize: 14 },
  suggestionText: { color: orbita.colors.bone, flex: 1, fontFamily: orbita.fonts.body, fontSize: 15, lineHeight: 21 }
});
