import { useQuery } from "convex/react";
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { useFonts } from "expo-font";
import { Link } from "expo-router";
import { ArrowRight, Heart, Sparkles, Sun } from "lucide-react-native";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { ImmersiveScreen } from "@/components/web/immersive-bg";
import { LiveGate } from "@/components/web/live";
import { WebNav } from "@/components/web/web-nav";
import { personalityMock } from "@/content/personalityMock";
import { proposedApi, type PersonalityReadingPayload, type PersonalitySection } from "@/services/appRefs";

const colors = {
  black: "#07080A",
  copper: "#C46A3A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)",
  boneDim: "rgba(244, 238, 228, 0.5)",
  line: "rgba(214, 154, 106, 0.22)",
  card: "rgba(11, 12, 15, 0.6)"
};

type IconC = React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
const ICONS: Record<string, IconC> = { identidad: Sun, amor: Heart, expansion: Sparkles };

export function OrbitaPersonality() {
  return <LiveGate mock={<PersonalityScreen payload={personalityMock} />} live={() => <PersonalityWithBackend />} />;
}

function PersonalityWithBackend() {
  const data = useQuery(proposedApi.personalityReading, {});
  if (data === undefined || data === null) return <PersonalityScreen payload={personalityMock} />;
  return <PersonalityScreen payload={data} />;
}

export function PersonalityScreen({ payload }: { payload: PersonalityReadingPayload }) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 820;
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_700Bold, Newsreader_500Medium });
  if (!fontsLoaded) return <View style={styles.center}><ActivityIndicator color={colors.copperSoft} /></View>;

  return (
    <ImmersiveScreen asset="ringSystem" opacity={0.22}>
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <WebNav active="carta" />
      <View style={[styles.col, { paddingHorizontal: isNarrow ? 24 : 40 }]}>
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>Horóscopo de personalidad</Text>
          <Text style={[styles.title, isNarrow && styles.titleNarrow]}>{payload.headline}</Text>
          <Text style={styles.sub}>Una lectura de tu carta natal en clave de identidad, vínculos y crecimiento. Es una guía para conocerte, no una etiqueta ni una predicción.</Text>
        </View>

        {payload.sections.map((s, i) => (
          <View key={s.key} style={styles.section}>
            {i > 0 && <Divider />}
            <SectionView section={s} />
          </View>
        ))}

        <Divider />
        <View style={styles.closing}>
          <Text style={styles.disclaimer}>{payload.disclaimer}</Text>
          <Link href="/home" asChild>
            <Pressable style={styles.cta}>
              <Text style={styles.ctaText}>Ver mi día</Text>
              <ArrowRight color={colors.black} size={17} strokeWidth={2.1} />
            </Pressable>
          </Link>
        </View>
      </View>
    </ScrollView>
    </ImmersiveScreen>
  );
}

function SectionView({ section }: { section: PersonalitySection }) {
  const Icon = ICONS[section.key] ?? Sparkles;
  return (
    <View style={styles.sectionInner}>
      <View style={styles.marker}>
        <View style={styles.ring}><Icon color={colors.copperSoft} size={26} strokeWidth={1.6} /></View>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionIntro}>{section.intro}</Text>
      </View>
      <View style={styles.interp}>
        <View style={styles.interpHead}>
          <View style={styles.ringSmall}><Icon color={colors.copperSoft} size={17} strokeWidth={1.7} /></View>
          <Text style={styles.placement}>{section.placement.label}</Text>
        </View>
        <Text style={styles.body}>{section.body}</Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider}><View style={styles.dividerLine} /><View style={styles.dividerDot} /><View style={styles.dividerLine} /></View>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: "transparent", flex: 1 },
  pageContent: { backgroundColor: "transparent", paddingBottom: 110 },
  center: { alignItems: "center", backgroundColor: colors.black, flex: 1, justifyContent: "center" },
  col: { alignItems: "center", alignSelf: "center", gap: 40, maxWidth: 760, paddingTop: 64, width: "100%" },
  headerBlock: { alignItems: "center", gap: 16 },
  eyebrow: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1.4, textAlign: "center", textTransform: "uppercase" },
  title: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 46, lineHeight: 52, textAlign: "center" },
  titleNarrow: { fontSize: 34, lineHeight: 40 },
  sub: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 18, lineHeight: 28, maxWidth: 620, textAlign: "center" },
  section: { alignSelf: "stretch", gap: 24 },
  sectionInner: { alignItems: "center", gap: 24 },
  marker: { alignItems: "center", gap: 14 },
  ring: { alignItems: "center", backgroundColor: "rgba(196,106,58,0.1)", borderColor: colors.line, borderRadius: 30, borderWidth: 1, height: 60, justifyContent: "center", width: 60 },
  ringSmall: { alignItems: "center", backgroundColor: "rgba(196,106,58,0.1)", borderColor: colors.line, borderRadius: 19, borderWidth: 1, height: 38, justifyContent: "center", width: 38 },
  sectionTitle: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 32, lineHeight: 38, textAlign: "center" },
  sectionIntro: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 16, lineHeight: 24, textAlign: "center" },
  interp: { alignSelf: "stretch", backgroundColor: colors.card, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 14, padding: 28 },
  interpHead: { alignItems: "center", flexDirection: "row", gap: 12 },
  placement: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 18 },
  body: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 17, lineHeight: 27 },
  divider: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "center", paddingVertical: 4 },
  dividerLine: { backgroundColor: "rgba(214,154,106,0.35)", height: 1, width: 46 },
  dividerDot: { backgroundColor: colors.copperSoft, height: 6, transform: [{ rotate: "45deg" }], width: 6 },
  closing: { alignItems: "center", gap: 18 },
  disclaimer: { color: colors.boneDim, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 23, maxWidth: 560, textAlign: "center" },
  cta: { alignItems: "center", backgroundColor: colors.bone, borderRadius: 8, flexDirection: "row", gap: 9, paddingHorizontal: 20, paddingVertical: 14 },
  ctaText: { color: colors.black, fontFamily: "Inter_700Bold", fontSize: 14 }
});

export default OrbitaPersonality;
