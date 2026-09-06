import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Body, H2, Note } from "@/components/orbita/kit";
import { MeasuredSquare } from "@/components/orbita/ContentCanvas";
import { NatalWheel } from "@/components/orbita/NatalWheel";
import { GuestState } from "@/components/orbita/GuestState";
import { EmptyState, ErrorState, LoadingState, MinimalLoading } from "@/components/orbita/states";
import { mapNatalChart } from "@/domain/natalChart";
import { personalChartGate } from "@/domain/natalChartGate";
import { sessionPhase } from "@/domain/screenPhase";
import { useLiveApp } from "@/hooks/useLiveApp";
import { appApi, type NatalChartPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

/**
 * Carta · Rueda completa: vista "zoom" de la rueda natal a pantalla ancha.
 * Reusa la `NatalWheel` compartida (misma geometría correcta que el hub), con
 * data real si hay sesión; invitado → estado honesto. No re-dibuja nada propio.
 */
export default function RuedaScreen() {
  const live = useLiveApp();
  const phase = sessionPhase(live);
  // Sin mocks: invitado confirmado → estado honesto; sesión resolviendo → carga mínima.
  if (phase === "cargando") {
    return (
      <DetailScreen eyebrow="Carta · Rueda completa">
        <MinimalLoading />
      </DetailScreen>
    );
  }
  if (phase === "error") {
    return (
      <DetailScreen eyebrow="Carta · Rueda completa">
        <ErrorState onRetry={live.retryUser} />
      </DetailScreen>
    );
  }
  if (phase === "invitado") {
    // Sin mocks: estado honesto de invitado, nunca la rueda demo como si fuera tuya.
    return (
      <DetailScreen eyebrow="Carta · Rueda completa">
        <GuestState
          eyebrow="TU CARTA NATAL"
          title={"Tu carta se calcula\ncon tu cuenta."}
          body="Órbita usa tu fecha, hora y lugar de nacimiento reales para dibujar tu carta natal completa y explicártela."
        />
      </DetailScreen>
    );
  }
  return <RuedaLive />;
}

function RuedaLive() {
  const chartDoc = useQuery(appApi.charts.current, {});
  // Una rueda personal exige datos natales remotos completos Y una carta que
  // corresponda a esos datos (ver `domain/natalChartGate`).
  const remoteBirth = useQuery(appApi.birthData.getCurrent, {});
  const chartGate = personalChartGate({ birth: remoteBirth, chart: chartDoc });
  if (chartGate === "cargando") {
    return (
      <DetailScreen eyebrow="Carta · Rueda completa">
        <LoadingState />
      </DetailScreen>
    );
  }
  if (chartGate !== "listo") {
    // Sin datos completos, sin carta, o con una carta que no es la de estos
    // datos: se manda al lugar donde se resuelve, nunca se dibuja la rueda.
    return (
      <DetailScreen eyebrow="Carta · Rueda completa">
        <EmptyState
          title={chartGate === "desactualizada" ? "Tu carta tiene que recalcularse" : "Todavía no hay carta"}
          body={
            chartGate === "desactualizada"
              ? "Tus datos de nacimiento cambiaron desde el último cálculo. Abrí tu carta para recalcularla."
              : "Completá tu fecha, hora y lugar de nacimiento para calcular tu carta natal."
          }
          cta={chartGate === "desactualizada" ? "VER MI CARTA" : "COMPLETAR MIS DATOS"}
          onCta={() => router.push(chartGate === "desactualizada" ? "/(tabs)/carta" : "/(tabs)/perfil")}
        />
      </DetailScreen>
    );
  }
  let payload: NatalChartPayload;
  try {
    payload = mapNatalChart(chartDoc);
  } catch {
    return (
      <DetailScreen eyebrow="Carta · Rueda completa">
        <ErrorState />
      </DetailScreen>
    );
  }
  return <RuedaView payload={payload} />;
}

function RuedaView({ payload }: { payload: NatalChartPayload }) {
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);

  return (
    <DetailScreen eyebrow="Carta · Rueda completa">
      <H2>Tu carta natal.</H2>
      <View style={styles.wheelWrap}>
        {/* El lado sale del contenedor medido, nunca del ancho de la ventana. */}
        <MeasuredSquare max={360}>
          {(size) => (
            <NatalWheel payload={payload} size={size} selectedKey={selectedKey} onSelect={setSelectedKey} />
          )}
        </MeasuredSquare>
      </View>
      <Body>Tocá un planeta para resaltarlo y ver sus aspectos. La rueda muestra tus posiciones de nacimiento con el Ascendente a la izquierda.</Body>
      <Note>{payload.accuracy}</Note>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  wheelWrap: { alignItems: "center", alignSelf: "center", marginTop: orbita.spacing.xl }
});
