import { StyleSheet, Text, View } from "react-native";
import { Body, Eyebrow, H2, OrbitaScreen, Section } from "@/components/orbita/kit";
import { FullBleedHero } from "@/components/orbita/ImmersiveHero";
import { orbita } from "@/theme/orbita";

/** Vínculo (sinastría) — estado Próximamente honesto: sin par ni textos inventados. */
export default function VinculoScreen() {
  return (
    <OrbitaScreen>
      <FullBleedHero kind="vinculo" />
      <Section style={{ paddingTop: orbita.spacing.lg }}>
        <Eyebrow>VÍNCULO · PRÓXIMAMENTE</Eyebrow>
        <H2>Dos cartas,{"\n"}un cielo.</H2>
        <Body>
          Vas a poder comparar tu carta con la de otra persona: dónde fluyen, dónde chocan y qué energía comparten.
        </Body>
        <Body>
          Lo estamos afinando para que lea de verdad, sin adivinar de más. Te avisamos apenas esté.
        </Body>
        <View style={{ height: orbita.spacing.xl }} />
        <View style={styles.comingPill}>
          <Text style={styles.comingPillText}>TE AVISAMOS CUANDO ESTÉ</Text>
        </View>
      </Section>
    </OrbitaScreen>
  );
}

const styles = StyleSheet.create({
  comingPill: {
    alignSelf: "flex-start",
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.lg,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    paddingHorizontal: orbita.spacing.xxl
  },
  comingPillText: {
    color: orbita.colors.mutedDim,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 13,
    letterSpacing: 1
  }
});
