import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { router } from "expo-router";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Divider, Eyebrow, TabStrip } from "@/components/orbita/kit";
import { ErrorState, LoadingState } from "@/components/orbita/states";
import { GlyphRow } from "@/components/orbita/GlyphRow";
import { useAppData } from "@/domain/appData";
import { useLiveApp } from "@/hooks/useLiveApp";
import { proposedApi, type TransitDetailPayload } from "@/services/appRefs";

type Tab = "amor" | "trabajo" | "vinculos" | "energia";

/** Fecha local YYYY-MM-DD (componentes locales, mismo criterio que la web; no UTC). */
function todayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function TransitosPorAreaScreen() {
  const { status, retrySession } = useLiveApp();
  // Mock SOLO para invitado confirmado; transitorios de sesión = carga estable.
  if (status === "guest") return <TransitosPorAreaMock />;
  if (status === "error") {
    return (
      <DetailScreen eyebrow="Tránsitos">
        <ErrorState onRetry={retrySession} />
      </DetailScreen>
    );
  }
  if (status !== "live") {
    return (
      <DetailScreen eyebrow="Tránsitos">
        <LoadingState />
      </DetailScreen>
    );
  }
  return <TransitosPorAreaLive />;
}

/** Vista mock (invitado / sin sesión / loading / error): cuatro áreas de ejemplo. */
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
 * prominente en vez de inventar cuatro áreas. Mientras carga o si falla, se cae al
 * mock; nunca pantalla rota.
 */
function TransitosPorAreaLive() {
  const getToday = useAction(proposedApi.transitToday);
  // undefined = cargando · null = falló → mock (nunca pantalla rota)
  const [payload, setPayload] = useState<TransitDetailPayload | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getToday({ localDate: todayLocalDate() })
      .then((r) => {
        if (alive) setPayload(r as TransitDetailPayload);
      })
      .catch((e) => {
        console.warn("[orbita] transits.getToday falló:", e?.message ?? e);
        if (alive) setPayload(null);
      });
    return () => {
      alive = false;
    };
  }, [getToday]);

  // Cargando es cargando: el mock solo si la llamada FALLÓ.
  if (payload === undefined) {
    return (
      <DetailScreen eyebrow="Tránsitos">
        <LoadingState
          eyebrow="TRÁNSITOS"
          title={"Leyendo\nel cielo de hoy."}
          body="Cruzamos las posiciones de hoy con tu carta natal. Tarda unos segundos."
        />
      </DetailScreen>
    );
  }
  if (!payload) return <TransitosPorAreaMock />;

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
