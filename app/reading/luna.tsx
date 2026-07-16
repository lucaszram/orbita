import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useAction } from "convex/react";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Body, Divider, Eyebrow, H2, MonoLine, Pill } from "@/components/orbita/kit";
import { FullBleedHero } from "@/components/orbita/ImmersiveHero";
import { ErrorState, MinimalLoading } from "@/components/orbita/states";
import { moonPhaseMock } from "@/content/moonPhaseMock";
import { useAppData } from "@/domain/appData";
import { sessionPhase } from "@/domain/screenPhase";
import { deviceTimezone, useLiveApp } from "@/hooks/useLiveApp";
import { toISODate } from "@/domain/readingEngine";
import { proposedSkyApi, type MoonPhasePayload } from "@/services/skyRefs";
import { orbita } from "@/theme/orbita";

/** Fase lunar (Figma V4.7 · 06 Luna/Calendario) — luna full-bleed + acción lunar. */
export default function LunaScreen() {
  const live = useLiveApp();
  const phase = sessionPhase(live);
  // Demo (mock tipado) SOLO invitado confirmado; sesión resolviendo → carga mínima.
  if (phase === "cargando") {
    return (
      <DetailScreen eyebrow="Fase lunar">
        <MinimalLoading />
      </DetailScreen>
    );
  }
  if (phase === "error") {
    return (
      <DetailScreen eyebrow="Fase lunar">
        <ErrorState onRetry={live.retryUser} />
      </DetailScreen>
    );
  }
  if (phase === "invitado") return <LunaView payload={moonPhaseMock} />;
  return <LunaLive />;
}

function LunaLive() {
  const getMoonPhase = useAction(proposedSkyApi.getMoonPhase);
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "error" } | { kind: "ok"; data: MoonPhasePayload }
  >({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ kind: "loading" });
    getMoonPhase({ localDate: toISODate(), timezone: deviceTimezone() })
      // El backend devuelve null si el proveedor no está configurado o falla:
      // error real con reintento — nunca la luna demo como si fuera la de hoy.
      .then((data) => {
        if (!alive) return;
        setState(data ? { kind: "ok", data } : { kind: "error" });
      })
      .catch(() => {
        if (alive) setState({ kind: "error" });
      });
    return () => {
      alive = false;
    };
  }, [getMoonPhase, attempt]);

  if (state.kind === "loading") {
    return (
      <DetailScreen eyebrow="Fase lunar">
        <MinimalLoading />
      </DetailScreen>
    );
  }
  if (state.kind === "error") {
    return (
      <DetailScreen eyebrow="Fase lunar">
        <ErrorState onRetry={() => setAttempt((a) => a + 1)} />
      </DetailScreen>
    );
  }
  return <LunaView payload={state.data} />;
}

function LunaView({ payload }: { payload: MoonPhasePayload }) {
  // `weekStrip` no viene del payload de fase lunar → lo tomamos del mock de `lunar`.
  const { lunar } = useAppData();
  return (
    <DetailScreen eyebrow="Fase lunar">
      <View style={{ marginHorizontal: -orbita.spacing.gutter }}>
        <FullBleedHero kind="luna" height={280}>
          <MonoLine>{lunar.weekStrip}</MonoLine>
        </FullBleedHero>
      </View>
      <View style={{ height: orbita.spacing.lg }} />
      <Eyebrow>FASE LUNAR</Eyebrow>
      <H2>{payload.phase}</H2>
      <Body>{payload.copy}</Body>
      <Divider />
      <Eyebrow>ACCIÓN LUNAR</Eyebrow>
      <Body bone>{payload.action}</Body>
      <View style={{ height: orbita.spacing.xl }} />
      <Pill label="VER CALENDARIO" onPress={() => router.push("/reading/calendario")} />
    </DetailScreen>
  );
}
