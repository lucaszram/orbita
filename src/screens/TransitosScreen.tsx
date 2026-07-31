/**
 * Pantalla canónica de Órbita: la misma en nativo y en web.
 *
 * Vivía dentro de `app/(tabs)/transitos.tsx`, así que la web tenía que mantener su
 * propia versión en paralelo y las dos derivaban. La ruta ahora es un wrapper
 * fino sobre este módulo; no se duplica ninguna pantalla por plataforma.
 */
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAction } from "convex/react";
import { Body, Divider, Eyebrow, H2, H3, MonoLine, Note, OrbitaScreen, Section } from "@/components/orbita/kit";
import { Column, Columns, ReadingBlock } from "@/components/orbita/Layout";
import { FullBleedHero } from "@/components/orbita/ImmersiveHero";
import { GuestState } from "@/components/orbita/GuestState";
import { ErrorState, MinimalLoading } from "@/components/orbita/states";
import { sessionPhase } from "@/domain/screenPhase";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useCanonicalLocalDate } from "@/hooks/useDailyContext";
import { proposedApi, type TransitDetailPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";


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

export function TransitosScreen() {
  const live = useLiveApp();
  const phase = sessionPhase(live);
  // Sin mocks: invitado confirmado → estado honesto; sesión resolviendo →
  // carga mínima; sesión rota → error real.
  if (phase === "cargando") {
    return (
      <TransitosShell>
        <MinimalLoading />
      </TransitosShell>
    );
  }
  if (phase === "error") {
    return (
      <TransitosShell>
        <ErrorState onRetry={live.retryUser} />
      </TransitosShell>
    );
  }
  if (phase === "invitado") {
    return (
      <TransitosShell>
        <GuestState
          eyebrow="TRÁNSITOS"
          title={"El cielo se lee\nsobre tu carta."}
          body="Los tránsitos de hoy se cruzan con tu carta natal real. Creá tu cuenta o entrá para leer el cielo sobre tus datos."
        />
      </TransitosShell>
    );
  }
  return <TransitosLive />;
}

/**
 * Shell único de la pantalla: TODOS los estados (carga, error, invitado, cielo
 * real) pasan por acá, así que ninguno se queda fuera del lienzo. El lienzo es
 * `wide`: en escritorio la escena va full-bleed y la lectura se compone en dos
 * columnas (Figma `271:70`).
 */
function TransitosShell({ children }: { children: React.ReactNode }) {
  return <OrbitaScreen canvas="wide">{children}</OrbitaScreen>;
}

/**
 * Con sesión: cielo REAL del día vía la action `transits.getToday`. Mientras
 * carga → pantalla mínima; si falla o el backend no tiene tránsito → error
 * real con REINTENTAR.
 */
function TransitosLive() {
  const getToday = useAction(proposedApi.transitToday);
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "error" } | { kind: "ok"; data: TransitDetailPayload }
  >({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  // La fecha la resuelve el servidor desde la zona natal; `transits.getToday`
  // rechaza cualquier otra. Null = todavía no llegó → seguimos en carga.
  const localDate = useCanonicalLocalDate();

  useEffect(() => {
    if (!localDate) return;
    let alive = true;
    setState({ kind: "loading" });
    getToday({ localDate })
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
  }, [getToday, attempt, localDate]);

  if (!localDate || state.kind === "loading") {
    return (
      <TransitosShell>
        <MinimalLoading />
      </TransitosShell>
    );
  }
  if (state.kind === "error") {
    return (
      <TransitosShell>
        <ErrorState onRetry={() => setAttempt((a) => a + 1)} />
      </TransitosShell>
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
  const desktop = useIsDesktop();
  const porArea = data.porArea ?? [];
  const cadenceCaption = humanCopy(data.frequency.label);
  const windowNote = humanCopy(data.window.note);

  // El mismo contenido, una sola vez. Lo único que cambia entre móvil y
  // escritorio es CÓMO se reparte: en móvil las cuatro piezas van una debajo de
  // otra (idéntico a hoy y al nativo); en escritorio la lectura + la cadencia
  // quedan enfrentadas a la Tierra + la ventana (Figma `271:70`).
  const lectura = (
    <ReadingBlock>
      <Body>{data.reading.plain}</Body>
      <Note>Basado en tus datos de nacimiento y el cielo de hoy.</Note>
    </ReadingBlock>
  );

  const cadencia = (
    <>
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
    </>
  );

  const tierra = (
    <>
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
    </>
  );

  const ventana = (
    <>
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
    </>
  );

  return (
    <TransitosShell>
      {/* La escena: banda full-bleed en móvil, tarjeta contenida en escritorio
          (como el frame). El asset se dibuja con ancho y alto MEDIDOS. */}
      <View style={desktop ? styles.sceneWrap : undefined}>
        <FullBleedHero kind="transitos" rounded={desktop}>
          <Text style={styles.skyLabel}>HOY EN EL CIELO</Text>
          <MonoLine>{`${data.scene.transitingBody.label}  ·  ${data.aspect.type}  ·  ${data.scene.natalPoint.label}`}</MonoLine>
        </FullBleedHero>
      </View>

      <Section style={{ paddingTop: orbita.spacing.lg }}>
        <Eyebrow>TRÁNSITOS DE HOY</Eyebrow>
        <H2>{data.title}</H2>
        <Columns>
          <Column>
            {lectura}
            {cadencia}
          </Column>
          <Column>
            {tierra}
            {ventana}
          </Column>
        </Columns>
      </Section>
    </TransitosShell>
  );
}

const styles = StyleSheet.create({
  // En escritorio la escena es una tarjeta contenida (Figma `271:70`), con las
  // mismas gutters que el texto que la rodea.
  sceneWrap: { paddingHorizontal: orbita.spacing.gutter, paddingTop: orbita.spacing.xl },
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
