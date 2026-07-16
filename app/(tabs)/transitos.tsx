import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAction } from "convex/react";
import { Body, Divider, Eyebrow, H2, H3, MonoLine, Note, OrbitaScreen, Section } from "@/components/orbita/kit";
import { FullBleedHero } from "@/components/orbita/ImmersiveHero";
import { ErrorState, MinimalLoading } from "@/components/orbita/states";
import { transitMock } from "@/content/transitMock";
import { sessionPhase } from "@/domain/screenPhase";
import { useLiveApp } from "@/hooks/useLiveApp";
import { proposedApi, type TransitDetailPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

/** Fecha local YYYY-MM-DD (componentes locales, mismo criterio que la web; no UTC). */
function todayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * El backend (`convex/lib/orbita.ts`) a veces filtra labels placeholder del
 * proveedor ("Ventana del proveedor", "Pico estimado", "La ventana exacta tiene
 * que venir del proveedor…"). Viola el guardrail de voz Órbita, así que el front
 * los oculta. Cuando Codex los humanice, el copy real pasa el filtro y se muestra.
 * Ver convex/CHANGELOG.md (2026-07-09).
 */
const PROVIDER_JUNK = /proveedor|fecha local|estimad/i;
/** Limpia sufijos colgados ("Pico -" → "Pico"). */
function cleanLabel(s?: string): string {
  return (s ?? "").replace(/[\s·\-–—]+$/u, "").trim();
}
/** Devuelve el copy solo si NO es placeholder del proveedor; si no, "" (se oculta). */
function humanCopy(s?: string): string {
  const t = cleanLabel(s);
  return t && !PROVIDER_JUNK.test(t) ? t : "";
}

export default function TransitosScreen() {
  const live = useLiveApp();
  const phase = sessionPhase(live);
  // Demo (transitMock) SOLO invitado confirmado; sesión resolviendo → carga
  // mínima; sesión rota → error real. Nunca el mock como fallback.
  if (phase === "cargando") {
    return (
      <OrbitaScreen>
        <MinimalLoading />
      </OrbitaScreen>
    );
  }
  if (phase === "error") {
    return (
      <OrbitaScreen>
        <ErrorState onRetry={live.retryUser} />
      </OrbitaScreen>
    );
  }
  if (phase === "invitado") return <TransitosView data={transitMock} />;
  return <TransitosLive />;
}

/**
 * Con sesión: cielo REAL del día vía la action `transits.getToday`. Mientras
 * carga → pantalla mínima; si falla o el backend no tiene tránsito → error
 * real con REINTENTAR. El mock quedó solo para la demo de invitado.
 */
function TransitosLive() {
  const getToday = useAction(proposedApi.transitToday);
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "error" } | { kind: "ok"; data: TransitDetailPayload }
  >({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ kind: "loading" });
    getToday({ localDate: todayLocalDate() })
      .then((r) => {
        if (!alive) return;
        setState(r ? { kind: "ok", data: r as TransitDetailPayload } : { kind: "error" });
      })
      .catch(() => {
        if (alive) setState({ kind: "error" });
      });
    return () => {
      alive = false;
    };
  }, [getToday, attempt]);

  if (state.kind === "loading") {
    return (
      <OrbitaScreen>
        <MinimalLoading />
      </OrbitaScreen>
    );
  }
  if (state.kind === "error") {
    return (
      <OrbitaScreen>
        <ErrorState onRetry={() => setAttempt((a) => a + 1)} />
      </OrbitaScreen>
    );
  }
  return <TransitosView data={state.data} />;
}

/**
 * El tab consume el payload REAL completo (mismo contrato que `app/reading/transito.tsx`):
 * escena en el cielo → lectura → cada cuánto pasa → cómo se juega en la Tierra → ventana.
 * "POR ÁREA" se embebe al final cuando el backend la popula (`porArea`); si no viene,
 * se oculta. Antes esta pantalla cortaba en DESTACADO y quedaba a medio terminar.
 */
function TransitosView({ data }: { data: TransitDetailPayload }) {
  const porArea = data.porArea ?? [];
  const cadenceCaption = humanCopy(data.frequency.label);
  const windowNote = humanCopy(data.window.note);
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
              <Text style={[styles.timelineLabel, p.current && styles.timelineLabelCurrent]}>
                {cleanLabel(p.label)}
              </Text>
            </View>
          ))}
        </View>
        {cadenceCaption ? <Note>{cadenceCaption}</Note> : null}

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

        {windowNote ? (
          <>
            <View style={{ height: orbita.spacing.xl }} />
            <Note>{`Ventana ${cleanLabel(data.window.label)} · ${windowNote}`}</Note>
          </>
        ) : null}
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
