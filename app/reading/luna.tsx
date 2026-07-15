import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useAction } from "convex/react";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Body, Divider, Eyebrow, H2, MonoLine, Pill } from "@/components/orbita/kit";
import { ErrorState, LoadingState } from "@/components/orbita/states";
import { FullBleedHero } from "@/components/orbita/ImmersiveHero";
import { moonPhaseMock } from "@/content/moonPhaseMock";
import { useAppData } from "@/domain/appData";
import { deviceTimezone, useLiveApp } from "@/hooks/useLiveApp";
import { toISODate } from "@/domain/readingEngine";
import { proposedSkyApi, type MoonPhasePayload } from "@/services/skyRefs";
import { orbita } from "@/theme/orbita";

/** Fase lunar (Figma V4.7 · 06 Luna/Calendario) — luna full-bleed + acción lunar. */
export default function LunaScreen() {
  const { status, retrySession } = useLiveApp();
  // Mock SOLO para invitado confirmado; transitorios de sesión = carga estable.
  if (status === "guest") {
    return <LunaView payload={moonPhaseMock} />;
  }
  if (status === "error") {
    return (
      <DetailScreen eyebrow="Luna">
        <ErrorState onRetry={retrySession} />
      </DetailScreen>
    );
  }
  if (status !== "live") {
    return (
      <DetailScreen eyebrow="Luna">
        <LoadingState />
      </DetailScreen>
    );
  }
  return <LunaLive />;
}

function LunaLive() {
  const getMoonPhase = useAction(proposedSkyApi.getMoonPhase);
  // undefined = cargando · null = proveedor no configurado / error → mock
  const [payload, setPayload] = useState<MoonPhasePayload | null | undefined>(undefined);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    getMoonPhase({ localDate: toISODate(), timezone: deviceTimezone() })
      .then((data) => setPayload(data))
      .catch((e) => {
        console.warn("[orbita] sky.getMoonPhase falló:", e?.message ?? e);
        setPayload(null);
      });
  }, [getMoonPhase]);

  // Cargando es cargando: nada de pintar el mock y pisarlo cuando llega lo real.
  if (payload === undefined) {
    return (
      <DetailScreen eyebrow="Luna">
        <LoadingState />
      </DetailScreen>
    );
  }
  return <LunaView payload={payload ?? moonPhaseMock} />;
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
