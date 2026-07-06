import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DailyGuide,
  HomeHeader,
  LongReadEnd,
  SignalTop,
  TopicsSection
} from "@/components/home/sections";
import { Eyebrow, InsightRow, Section } from "@/components/orbita/kit";
import { useAppState } from "@/hooks/useAppState";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { useRequireProfile } from "@/hooks/useRequireProfile";
import { HomeTopic, Topic } from "@/domain/types";
import { orbita } from "@/theme/orbita";

export default function HomeScreen() {
  const { isReady, profile } = useRequireProfile();
  const { homeReading, saveTodayReading } = useAppState();
  const fontsLoaded = useOrbitaFonts();
  const insets = useSafeAreaInsets();
  const [activeTopic, setActiveTopic] = useState<Topic>("amor");

  if (!isReady || !profile || !fontsLoaded) {
    return <View style={styles.screen} />;
  }

  function openTopic(topic: HomeTopic) {
    setActiveTopic(topic.topic);
    router.push({ pathname: "/reading/topic", params: { topic: topic.topic } });
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
        <SignalTop reading={homeReading} onProfundizar={() => router.push("/reading/deep-dive")} />
        <DailyGuide reading={homeReading} />
        <TopicsSection
          reading={homeReading}
          activeTopic={activeTopic}
          onSelectTab={setActiveTopic}
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
          <InsightRow title="Una pregunta para hoy" body="El Vacío · una pregunta por día" onPress={() => router.push("/reading/void")} />
          <InsightRow title="Fase lunar y calendario" body="Luna creciente · tu mes en energía" onPress={() => router.push("/reading/luna")} />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: orbita.colors.background, flex: 1 },
  more: { borderTopColor: orbita.colors.line, borderTopWidth: 1 }
});
