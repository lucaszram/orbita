import { StyleSheet, Text, View } from "react-native";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Body, Eyebrow, H2 } from "@/components/orbita/kit";
import { orbita } from "@/theme/orbita";

/** Resultado de Vínculo — Próximamente: no mostramos un par ni una lectura inventada. */
export default function VinculoResultadoScreen() {
  return (
    <DetailScreen eyebrow="Vínculo · Próximamente">
      <Eyebrow>PRÓXIMAMENTE</Eyebrow>
      <H2>La lectura del{"\n"}vínculo, en camino.</H2>
      <Body>
        Cuando esté, vas a comparar tu carta con la de otra persona: qué fluye, qué fricciona y qué energía comparten.
      </Body>
      <Body>Todavía no la abrimos porque queremos que lea de verdad, no que invente un resultado.</Body>
      <View style={{ height: orbita.spacing.xl }} />
      <View style={styles.comingPill}>
        <Text style={styles.comingPillText}>TE AVISAMOS CUANDO ESTÉ</Text>
      </View>
    </DetailScreen>
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
