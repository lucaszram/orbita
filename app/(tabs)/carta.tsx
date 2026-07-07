import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Body, Divider, Eyebrow, H2, OrbitaScreen, Pill, Section, Triad } from "@/components/orbita/kit";
import { FullBleedHero } from "@/components/orbita/ImmersiveHero";
import { useAppData } from "@/domain/appData";
import { orbita } from "@/theme/orbita";

export default function CartaScreen() {
  const { carta } = useAppData();
  return (
    <OrbitaScreen>
      <FullBleedHero kind="carta">
        <Triad triad={carta.triad} />
      </FullBleedHero>
      <Section style={{ paddingTop: orbita.spacing.lg }}>
        <Eyebrow>TU CARTA BASE</Eyebrow>
        <H2>Tus puntos{"\n"}de partida.</H2>
        <Body>{carta.intro}</Body>
        <Divider />
        <Eyebrow>{carta.casaDestacada.label}</Eyebrow>
        <Body bone>{carta.casaDestacada.copy}</Body>
        <View style={{ height: orbita.spacing.xl }} />
        <Body>Tu carta natal completa, leída como carácter y sector por sector.</Body>
        <View style={{ height: orbita.spacing.md }} />
        <Pill label="LEER MI CARTA COMPLETA" onPress={() => router.push("/reading/personalidad")} />
        <View style={styles.secondaryLinks}>
          <Pressable
            onPress={() => router.push("/reading/carta")}
            accessibilityRole="button"
            style={({ pressed }) => pressed && { opacity: 0.6 }}
          >
            <Text style={styles.wheelLinkText}>VER POSICIONES →</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/reading/rueda")}
            accessibilityRole="button"
            style={({ pressed }) => pressed && { opacity: 0.6 }}
          >
            <Text style={styles.wheelLinkText}>VER LA RUEDA COMPLETA →</Text>
          </Pressable>
        </View>
      </Section>
    </OrbitaScreen>
  );
}

const styles = StyleSheet.create({
  secondaryLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: orbita.spacing.lg,
    marginTop: orbita.spacing.lg
  },
  wheelLinkText: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1
  }
});
