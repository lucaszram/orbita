import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Eyebrow, Section } from "@/components/orbita/kit";
import { orbita } from "@/theme/orbita";

// Cara revelada (mock: La Luna). El tarot real lo baraja el backend.
const CARD_IMG = require("../../../assets/orbita/optimized/core/orbita_home_hero_orbital_a.jpg");

// TODO: pendiente backend — la carta del día (endpoint `tarot` sembrado por
// usuario+fecha) + diccionario verificado de arquetipos (correspondencia
// astrológica) + prompt del puente honesto (carta × tránsito). Hoy: mock tipado.
const MOCK = {
  nombre: "La Luna",
  beats: [
    { label: "QUÉ ES", body: "La carta de la intuición y de lo que se mueve por debajo: eso que sabés sin poder explicarlo del todo." },
    { label: "CÓMO INFLUYE HOY", body: "Te pide fiarte de la corazonada antes que de la excusa, y no apurar una lectura de lo que sentís." },
    { label: "CÓMO SE CONECTA CON TU CIELO", body: "Encaja con tu tránsito: Saturno sobre tu Venus en casa 3 pone el foco en lo que callás en los vínculos." }
  ]
};

/** "Tu carta de hoy": ritual de revelar. Primero boca abajo (sin ver) → tocás →
 *  se revela la carta + los 3 beats (qué es / cómo influye / con tu cielo). */
export function CartaDelDia() {
  const [revealed, setRevealed] = useState(false);
  const reveal = () => setRevealed(true);
  const hide = () => setRevealed(false);
  return (
    <Section style={styles.section}>
      <Eyebrow>TU CARTA DE HOY</Eyebrow>

      {!revealed ? (
        <View style={styles.center}>
          <Pressable onPress={reveal} style={({ pressed }) => pressed && styles.pressed} accessibilityRole="button">
            <View style={styles.cardBack}>
              <View style={styles.inset} />
              <View style={[styles.ring, styles.ring1]} />
              <View style={[styles.ring, styles.ring2]} />
              <View style={styles.dot} />
              <Text style={styles.backTop}>ÓRBITA</Text>
              <Text style={styles.backBottom}>· HOY ·</Text>
            </View>
          </Pressable>
          <Text style={styles.revealCta}>Tocá para revelar</Text>
          <Text style={styles.note}>Una carta por día · se abre a las 9:00</Text>
        </View>
      ) : (
        <View>
          <View style={styles.center}>
            <Pressable onPress={hide} style={({ pressed }) => pressed && styles.pressed} accessibilityRole="button">
              <View style={styles.cardFace}>
                <Image source={CARD_IMG} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={styles.faceScrim} />
                <Text style={styles.faceLabel}>{MOCK.nombre}</Text>
              </View>
            </Pressable>
            <Text style={styles.hideCta}>Tocá la carta para ocultarla</Text>
          </View>
          <Text style={styles.leadIn}>Te salió {MOCK.nombre}.</Text>
          {MOCK.beats.map((b) => (
            <View key={b.label} style={styles.beat}>
              <Text style={styles.beatLabel}>{b.label}</Text>
              <Text style={styles.beatBody}>{b.body}</Text>
            </View>
          ))}
        </View>
      )}
    </Section>
  );
}

const CARD_W = 150;
const CARD_H = 224;
const styles = StyleSheet.create({
  section: { borderTopColor: orbita.colors.line, borderTopWidth: 1 },
  center: { alignItems: "center", marginTop: orbita.spacing.lg },
  pressed: { opacity: 0.75 },

  // --- carta boca abajo ---
  cardBack: {
    alignItems: "center",
    backgroundColor: "#11121A",
    borderColor: "rgba(196,106,58,0.55)",
    borderRadius: 14,
    borderWidth: 1,
    height: CARD_H,
    justifyContent: "center",
    width: CARD_W
  },
  inset: {
    borderColor: "rgba(196,106,58,0.22)",
    borderRadius: 8,
    borderWidth: 1,
    bottom: 10,
    left: 10,
    position: "absolute",
    right: 10,
    top: 10
  },
  ring: { borderColor: orbita.colors.copper, borderRadius: 999, position: "absolute" },
  ring1: { borderWidth: 1, height: 78, opacity: 0.4, width: 78 },
  ring2: { borderWidth: 1, height: 50, opacity: 0.7, width: 50 },
  dot: { backgroundColor: orbita.colors.copper, borderRadius: 4, height: 8, width: 8 },
  backTop: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 9, letterSpacing: 2, position: "absolute", top: 26 },
  backBottom: { bottom: 26, color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 9, letterSpacing: 2, position: "absolute" },
  revealCta: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 12, letterSpacing: 1.5, marginTop: orbita.spacing.xl, textAlign: "center" },
  note: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.body, fontSize: 12, marginTop: orbita.spacing.sm, textAlign: "center" },

  // --- carta revelada ---
  cardFace: {
    borderColor: "rgba(196,106,58,0.7)",
    borderRadius: 14,
    borderWidth: 1.5,
    height: CARD_H,
    justifyContent: "flex-end",
    overflow: "hidden",
    width: CARD_W
  },
  faceScrim: { backgroundColor: "rgba(7,8,10,0.5)", bottom: 0, height: 70, left: 0, position: "absolute", right: 0 },
  faceLabel: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 20, paddingBottom: orbita.spacing.md, textAlign: "center" },
  hideCta: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 11, letterSpacing: 0.5, marginTop: orbita.spacing.md, textAlign: "center" },
  leadIn: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 24, lineHeight: 29, marginTop: orbita.spacing.xl },
  beat: { marginTop: orbita.spacing.lg },
  beatLabel: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 11, letterSpacing: 0.5 },
  beatBody: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 15, lineHeight: 21, marginTop: orbita.spacing.xs }
});
