import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAction } from "convex/react";
import { Body, Divider, Eyebrow, H2, H3, MonoLine, Note, OrbitaScreen, Section } from "@/components/orbita/kit";
import { FullBleedHero } from "@/components/orbita/ImmersiveHero";
import { transitMock } from "@/content/transitMock";
import { useLiveApp } from "@/hooks/useLiveApp";
import { proposedApi, type TransitDetailPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

/** Fecha local YYYY-MM-DD (componentes locales, mismo criterio que la web; no UTC). */
function todayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function TransitosScreen() {
  const { isLive } = useLiveApp();
  if (!isLive) return <TransitosView data={transitMock} />;
  return <TransitosLive />;
}

/**
 * Con sesión: cielo REAL del día vía la action `transits.getToday`. Mientras carga
 * o si falla, se muestra el tránsito mock (`transitMock`); nunca pantalla rota.
 */
function TransitosLive() {
  const getToday = useAction(proposedApi.transitToday);
  const [data, setData] = useState<TransitDetailPayload | null>(null);

  useEffect(() => {
    let alive = true;
    getToday({ localDate: todayLocalDate() })
      .then((r) => {
        if (alive) setData(r as TransitDetailPayload);
      })
      .catch(() => {
        if (alive) setData(null);
      });
    return () => {
      alive = false;
    };
  }, [getToday]);

  return <TransitosView data={data ?? transitMock} />;
}

/**
 * El tab consume el payload REAL completo (mismo contrato que `app/reading/transito.tsx`):
 * escena en el cielo → lectura → cada cuánto pasa → cómo se juega en la Tierra → ventana.
 * "POR ÁREA" se embebe al final cuando el backend la popula (`porArea`); si no viene,
 * se oculta. Antes esta pantalla cortaba en DESTACADO y quedaba a medio terminar.
 */
function TransitosView({ data }: { data: TransitDetailPayload }) {
  const porArea = data.porArea ?? [];
  return (
    <OrbitaScreen>
      <FullBleedHero kind="transitos">
        <Text style={styles.skyLabel}>HOY EN EL CIELO</Text>
        <MonoLine>{`${data.scene.transitingBody.label}  ·  ${data.aspect.type}  ·  ${data.scene.natalPoint.label}`}</MonoLine>
      </FullBleedHero>

      <Section style={{ paddingTop: orbita.spacing.lg }}>
        <Eyebrow>TRÁNSITOS DE HOY</Eyebrow>
        <H2>{data.title}</H2>
        <Body>{data.reading.plain}</Body>
        <Note>Basado en tus datos de nacimiento y el cielo de hoy.</Note>

        <Divider />
        <Eyebrow>CADA CUÁNTO PASA</Eyebrow>
        <View style={styles.timeline}>
          <View style={styles.timelineTrack} />
          {data.frequency.timeline.map((p) => (
            <View key={p.label} style={styles.timelineStop}>
              <View style={[styles.timelineDot, p.current && styles.timelineDotCurrent]} />
              <Text style={[styles.timelineLabel, p.current && styles.timelineLabelCurrent]}>{p.label}</Text>
            </View>
          ))}
        </View>
        <Note>{data.frequency.label}</Note>

        <Divider />
        <Eyebrow>CÓMO SE JUEGA EN LA TIERRA</Eyebrow>
        <H3>{data.earth.headline}</H3>
        <View style={{ height: orbita.spacing.md }} />
        {data.earth.suggestions.map((s) => (
          <View key={s} style={styles.suggestion}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.suggestionText}>{s}</Text>
          </View>
        ))}

        {porArea.length > 0 ? (
          <>
            <Divider />
            <Eyebrow>POR ÁREA</Eyebrow>
            {porArea.map((a) => (
              <View key={a.title} style={styles.areaRow}>
                <Text style={styles.areaTitle}>{a.title}</Text>
                <Body>{a.body}</Body>
              </View>
            ))}
          </>
        ) : null}

        <View style={{ height: orbita.spacing.xl }} />
        <Note>{`Ventana ${data.window.label} · ${data.window.note}`}</Note>
      </Section>
    </OrbitaScreen>
  );
}

const styles = StyleSheet.create({
  skyLabel: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 6,
    textAlign: "center"
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
  suggestionText: { color: orbita.colors.bone, flex: 1, fontFamily: orbita.fonts.body, fontSize: 15, lineHeight: 21 },

  areaRow: { marginTop: orbita.spacing.lg },
  areaTitle: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: orbita.spacing.sm,
    textTransform: "uppercase"
  }
});
