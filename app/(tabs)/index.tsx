import { useEffect, useRef, useState } from "react";
import { Alert, LayoutAnimation, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CartaCard } from "@/components/home/CartaCard";
import {
  DailyGuide,
  HomeHeader,
  LongReadEnd,
  SignalTop,
  TopicsSection
} from "@/components/home/sections";
import { useAction, useQuery } from "convex/react";
import { Eyebrow, InsightRow, Section } from "@/components/orbita/kit";
import { mapNatalChart } from "@/components/web/orbita-chart";
import { chartMock } from "@/content/chartMock";
import { useAppState } from "@/hooks/useAppState";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { useRequireProfile } from "@/hooks/useRequireProfile";
import { HomeTopic, Topic, Triad } from "@/domain/types";
import { appApi, proposedApi, type DailyGuidePayload, type NatalChartPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

const TRIAD_GLYPH = { sol: "☉", luna: "☽", ascendente: "↑" } as const;

/** Tríada de la Home tomada de la MISMA fuente que la Carta (el chart), para que
 *  Home y Carta muestren exactamente lo mismo. */
function triadFromChart(payload: NatalChartPayload): Triad {
  const t = payload.triad;
  return {
    sun: { body: "sol", glyph: TRIAD_GLYPH.sol, sign: t.sun.sign as Triad["sun"]["sign"], label: t.sun.sign },
    moon: { body: "luna", glyph: TRIAD_GLYPH.luna, sign: t.moon.sign as Triad["moon"]["sign"], label: t.moon.sign },
    ascendant: {
      body: "ascendente",
      glyph: TRIAD_GLYPH.ascendente,
      sign: t.ascendant.sign as Triad["ascendant"]["sign"],
      label: t.ascendant.sign
    },
    accuracy: "calculated",
    accuracyNote: null
  };
}

export default function HomeScreen() {
  const { isReady, profile } = useRequireProfile();
  const { homeReading, saveTodayReading } = useAppState();
  // `fresh=1` lo pasa el onboarding al terminar → Home "primera impresión" con la
  // carta arriba. Al cambiar de tab y volver, el param se limpia → Home normal.
  const { fresh } = useLocalSearchParams<{ fresh?: string }>();
  const justOnboarded = fresh === "1";
  const { isLive } = useLiveApp();
  const chartDoc = useQuery(appApi.charts.current, isLive ? {} : "skip");
  const fontsLoaded = useOrbitaFonts();
  const insets = useSafeAreaInsets();
  const [activeTopic, setActiveTopic] = useState<Topic>("amor");

  // Guía diaria real (análisis del cielo de hoy sobre la carta), con sesión. Sin
  // sesión, la Home usa el engine local (fallback). Reemplaza "Estructura con ventana".
  const dailyGuide = useAction(proposedApi.dailyGuide);
  const [daily, setDaily] = useState<DailyGuidePayload | null>(null);
  const firedDaily = useRef(false);
  useEffect(() => {
    if (!isLive || firedDaily.current) return;
    firedDaily.current = true;
    dailyGuide({}).then(setDaily).catch(() => {});
  }, [isLive, dailyGuide]);

  // La tríada del hero sale del chart (mismo lugar que la Carta): mock para
  // invitado, chart real con sesión. Así Home y Carta nunca se contradicen.
  let chartPayload: NatalChartPayload = chartMock;
  if (isLive && chartDoc) {
    try {
      chartPayload = mapNatalChart(chartDoc);
    } catch {
      chartPayload = chartMock;
    }
  }
  const heroTriad = triadFromChart(chartPayload);

  if (!isReady || !profile || !fontsLoaded) {
    return <View style={styles.screen} />;
  }

  function openTopic(topic: HomeTopic) {
    setActiveTopic(topic.topic);
    router.push({ pathname: "/reading/topic", params: { topic: topic.topic } });
  }

  function selectTab(topic: Topic) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTopic(topic);
  }

  async function guardar() {
    await saveTodayReading();
    Alert.alert("Guardado", "Tu lectura de hoy quedó en guardadas.");
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + orbita.spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader />
        {/* Home post-onboarding: la primera impresión es tu carta natal (el mismo
            recuadro que después vive en el Perfil). En la Home normal no aparece. */}
        {justOnboarded ? <CartaCard /> : null}
        <SignalTop
          reading={homeReading}
          triad={heroTriad}
          daily={daily ?? undefined}
          onProfundizar={() => router.push("/reading/deep-dive")}
        />
        <DailyGuide reading={homeReading} />
        <TopicsSection
          reading={homeReading}
          activeTopic={activeTopic}
          onSelectTab={selectTab}
          onOpenTopic={openTopic}
        />
        <LongReadEnd
          reading={homeReading}
          onLeerAnalisis={() => router.push("/reading/long-read")}
          onGuardar={guardar}
          onHistorial={() => router.push("/reading/saved")}
        />
        <Section style={styles.more}>
          <Eyebrow>TAMBIÉN HOY</Eyebrow>
          <InsightRow title="Fase lunar y calendario" body="El calendario lunar · el clima del mes, día a día" onPress={() => router.push("/reading/luna")} />
          <InsightRow
            title="Tu carta, leída como carácter"
            body="Tu carta natal · qué significa cada planeta"
            onPress={() => router.push("/(tabs)/carta")}
          />
          <InsightRow
            title="Qué te impulsa, qué te pesa"
            body="Mapa de valores · una foto, no una sentencia"
            onPress={() => router.push("/reading/valores")}
          />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: orbita.colors.background, flex: 1 },
  more: { borderTopColor: orbita.colors.line, borderTopWidth: 1 }
});
