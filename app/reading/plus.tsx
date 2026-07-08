import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Body, H2, Note, Pill } from "@/components/orbita/kit";
import { orbita } from "@/theme/orbita";

const BENEFITS = ["Lectura larga y análisis del día", "Tus cuatro áreas completas", "Calendario y lecturas guardadas"];

function Plan({ label, price, per, highlight, badge }: { label: string; price: string; per?: string; highlight?: boolean; badge?: string }) {
  return (
    <View style={[styles.plan, highlight && styles.planActive]}>
      <View>
        <Text style={styles.planLabel}>{label}</Text>
        {per ? <Text style={styles.planPer}>{per}</Text> : null}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
        <Text style={styles.price}>{price}</Text>
      </View>
    </View>
  );
}

export default function PlusScreen() {
  return (
    <DetailScreen eyebrow="Órbita · Plus">
      <H2>Tu cielo,{"\n"}todos los días.</H2>
      <Body>Desbloqueá la lectura completa, tus cuatro áreas, el calendario y tus lecturas guardadas.</Body>
      <View style={{ height: orbita.spacing.xl }} />
      <Plan label="ANUAL" price="$30" per="$0,58 / semana" highlight badge="MEJOR VALOR" />
      <View style={{ height: orbita.spacing.md }} />
      <Plan label="SEMANAL" price="$5" />
      <View style={{ height: orbita.spacing.xl }} />
      {BENEFITS.map((b) => (
        <View key={b} style={styles.benefit}>
          <Text style={styles.benefitDash}>✓</Text>
          <Text style={styles.benefitText}>{b}</Text>
        </View>
      ))}
      <View style={{ height: orbita.spacing.md }} />
      <Note>En esta prueba ya tenés todo Órbita desbloqueado, sin cargo · entretenimiento y autoconocimiento.</Note>
      <View style={{ height: orbita.spacing.lg }} />
      {/* Testeo interno: el CTA no cobra ni simula compra, solo cierra la pantalla (feedback Lucas). */}
      <Pill label="SEGUIR PROBANDO" onPress={() => router.back()} />
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  plan: {
    alignItems: "center",
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: orbita.spacing.xl,
    paddingVertical: orbita.spacing.lg
  },
  planActive: { borderColor: orbita.colors.copper, borderWidth: 1.5 },
  planLabel: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 12, letterSpacing: 1 },
  planPer: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.bodyMedium, fontSize: 14, marginTop: 4 },
  badge: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 9, letterSpacing: 1, marginBottom: 2 },
  price: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 26 },
  benefit: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.md, marginBottom: orbita.spacing.md },
  benefitDash: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 13 },
  benefitText: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 15 }
});
