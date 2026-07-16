import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { router } from "expo-router";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Divider, Eyebrow, TabStrip } from "@/components/orbita/kit";
import { GlyphRow } from "@/components/orbita/GlyphRow";
import { ErrorState, MinimalLoading } from "@/components/orbita/states";
import { useAppData } from "@/domain/appData";
import { sessionPhase } from "@/domain/screenPhase";
import { useLiveApp } from "@/hooks/useLiveApp";
import { proposedApi, type TransitDetailPayload } from "@/services/appRefs";

type Tab = "amor" | "trabajo" | "vinculos" | "energia";

/** Fecha local YYYY-MM-DD (componentes locales, mismo criterio que la web; no UTC). */
function todayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function TransitosPorAreaScreen() {
  const live = useLiveApp();
  const phase = sessionPhase(live);
  // Demo (cuatro áreas de ejemplo) SOLO invitado confirmado.
  if (phase === "cargando") {
    return (
      <DetailScreen eyebrow="Tránsitos">
        <MinimalLoading />
      </DetailScreen>
    );
  }
  if (phase === "error") {
    return (
      <DetailScreen eyebrow="Tránsitos">
        <ErrorState onRetry={live.retryUser} />
      </DetailScreen>
    );
  }
  if (phase === "invitado") return <TransitosPorAreaMock />;
  return <TransitosPorAreaLive />;
}

/** Vista demo del INVITADO: cuatro áreas de ejemplo (nunca fallback de carga/error). */
function TransitosPorAreaMock() {
  const { transitos } = useAppData();
  const [tab, setTab] = useState<Tab>("amor");
  return (
    <DetailScreen eyebrow="Tránsitos">
      <TabStrip
        tabs={[
          { key: "amor", label: "Amor" },
          { key: "trabajo", label: "Trabajo" },
          { key: "vinculos", label: "Vínculos" },
          { key: "energia", label: "Energía" }
        ]}
        active={tab}
        onChange={setTab}
      />
      <Divider />
      <Eyebrow>TRÁNSITOS POR ÁREA</Eyebrow>
      {transitos.porArea.map((t) => (
        <GlyphRow key={t.title} title={t.title} body={t.body} onPress={() => router.push("/reading/transito")} />
      ))}
    </DetailScreen>
  );
}

/**
 * Con sesión: cielo REAL del día vía la action `transits.getToday`. El backend hoy
 * devuelve UN tránsito principal, no una lista por área, así que lo mostramos
 * prominente en vez de inventar cuatro áreas. Mientras carga → pantalla mínima;
 * si falla → error real con REINTENTAR (nunca las áreas demo como si fueran tuyas).
 */
function TransitosPorAreaLive() {
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
      <DetailScreen eyebrow="Tránsitos">
        <MinimalLoading />
      </DetailScreen>
    );
  }
  if (state.kind === "error") {
    return (
      <DetailScreen eyebrow="Tránsitos">
        <ErrorState onRetry={() => setAttempt((a) => a + 1)} />
      </DetailScreen>
    );
  }
  const payload = state.data;

  return (
    <DetailScreen eyebrow="Tránsitos">
      <Eyebrow>EL TRÁNSITO DE HOY</Eyebrow>
      <GlyphRow
        title={payload.title}
        body={payload.earth.headline}
        onPress={() => router.push("/reading/transito")}
      />
    </DetailScreen>
  );
}
