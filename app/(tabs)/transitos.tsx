import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAction } from "convex/react";
import { router } from "expo-router";
import { Body, Divider, Eyebrow, H2, MonoLine, Note, OrbitaScreen, Pill, Section } from "@/components/orbita/kit";
import { FullBleedHero } from "@/components/orbita/ImmersiveHero";
import { useAppData, type TransitosData } from "@/domain/appData";
import { useLiveApp } from "@/hooks/useLiveApp";
import { proposedApi, type TransitDetailPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

/** Fecha local YYYY-MM-DD (componentes locales, mismo criterio que la web; no UTC). */
function todayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Deriva la forma-resumen del tab a partir del payload real de detalle. El backend
 * hoy trae UN tránsito principal (no una lista por área): `porArea` queda vacía a
 * propósito y el tab no la usa.
 */
function transitosFromPayload(p: TransitDetailPayload): TransitosData {
  return {
    skyLabel: "HOY EN EL CIELO",
    planetsRow: `${p.scene.transitingBody.label}  ·  ${p.aspect.type}  ·  ${p.scene.natalPoint.label}`,
    headline: p.title,
    intro: p.reading.plain,
    destacado: p.earth.headline,
    porArea: []
  };
}

export default function TransitosScreen() {
  const { isLive } = useLiveApp();
  const { transitos } = useAppData();
  if (!isLive) return <TransitosView data={transitos} />;
  return <TransitosLive fallback={transitos} />;
}

/**
 * Con sesión: cielo REAL del día vía la action `transits.getToday`. Mientras carga
 * o si falla, se muestra el resumen mock (`useAppData().transitos`); nunca pantalla rota.
 */
function TransitosLive({ fallback }: { fallback: TransitosData }) {
  const getToday = useAction(proposedApi.transitToday);
  const [data, setData] = useState<TransitosData | null>(null);

  useEffect(() => {
    let alive = true;
    getToday({ localDate: todayLocalDate() })
      .then((r) => {
        if (alive) setData(transitosFromPayload(r as TransitDetailPayload));
      })
      .catch(() => {
        if (alive) setData(null);
      });
    return () => {
      alive = false;
    };
  }, [getToday]);

  return <TransitosView data={data ?? fallback} />;
}

function TransitosView({ data }: { data: TransitosData }) {
  return (
    <OrbitaScreen>
      <FullBleedHero kind="transitos">
        <Text style={styles.skyLabel}>{data.skyLabel}</Text>
        <MonoLine>{data.planetsRow}</MonoLine>
      </FullBleedHero>
      <Section style={{ paddingTop: orbita.spacing.lg }}>
        <Eyebrow>TRÁNSITOS DE HOY</Eyebrow>
        <H2>{data.headline}</H2>
        <Body>{data.intro}</Body>
        <Note>Basado en tus datos de nacimiento y el cielo de hoy.</Note>
        <Divider />
        <Eyebrow>DESTACADO</Eyebrow>
        <Body bone>{data.destacado}</Body>
        <View style={{ height: orbita.spacing.xl }} />
        <Pill label="VER POR ÁREA" onPress={() => router.push("/reading/transitos")} />
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
  }
});
