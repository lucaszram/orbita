import { useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { useAppData } from "@/domain/appData";
import { orbita } from "@/theme/orbita";

const TEXTURE = require("../../assets/orbita/optimized/core/orbita_daily_texture_b.jpg");
const DEFAULT_QUESTION = "¿Qué estás apurando?";

/** Respuesta editorial de maqueta (contrato pendiente backend: void.ask). */
const ORACLE = {
  answer: "Lo que apurás\nno es la respuesta:\nes el alivio.",
  mejorPregunta: "¿Qué cambiaría si esperás 24 horas?",
  paso: "UN PASO · ESCRIBÍ LA DECISIÓN\nY DEJALA DORMIR HASTA MAÑANA"
};

type Phase = "entrada" | "escuchando" | "respuesta";

export default function VoidScreen() {
  const insets = useSafeAreaInsets();
  const fontsLoaded = useOrbitaFonts();
  const { carta } = useAppData();
  const [phase, setPhase] = useState<Phase>("entrada");
  const [typed, setTyped] = useState("");
  const pulse = useRef(new Animated.Value(0.4)).current;

  const question = typed.trim() || DEFAULT_QUESTION;
  const basadoEn = `BASADO EN TU LUNA EN ${carta.triad.moon.label.toUpperCase()}\nY TU ASCENDENTE EN ${carta.triad.ascendant.label.toUpperCase()}`;

  useEffect(() => {
    if (phase !== "escuchando") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 900, useNativeDriver: true })
      ])
    );
    loop.start();
    const t = setTimeout(() => setPhase("respuesta"), 2800);
    return () => {
      loop.stop();
      clearTimeout(t);
    };
  }, [phase, pulse]);

  if (!fontsLoaded) return <View style={styles.screen} />;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Image source={TEXTURE} style={styles.bg} resizeMode="cover" />
      <LinearGradient
        colors={["rgba(10,11,14,0.75)", "rgba(10,11,14,0.9)", orbita.colors.background]}
        locations={[0, 0.5, 0.85]}
        style={StyleSheet.absoluteFill}
      />

      {phase !== "escuchando" ? (
        <View style={[styles.topbar, { paddingTop: insets.top + orbita.spacing.sm }]}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
            hitSlop={12}
            accessibilityRole="button"
          >
            <Text style={styles.back}>←</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ paddingTop: insets.top + orbita.spacing.xl }} />
      )}

      {phase === "entrada" ? (
        <View style={styles.center}>
          <Text style={styles.eyebrow}>EL VACÍO</Text>
          <Text style={styles.h1}>Preguntale{"\n"}al Vacío.</Text>
          <View style={{ height: orbita.spacing.xxl * 2 }} />
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder="Escribí tu pregunta"
            placeholderTextColor={orbita.colors.muted}
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={() => setPhase("escuchando")}
          />
          <View style={styles.inputLine} />
          <View style={{ height: orbita.spacing.xl }} />
          <Text style={styles.microMono}>UNA PREGUNTA POR DÍA</Text>
          <View style={{ height: orbita.spacing.xxl }} />
          <Pressable
            onPress={() => setPhase("escuchando")}
            style={({ pressed }) => [pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <View style={styles.ghostCta}>
              <Text style={styles.ghostCtaText}>PREGUNTAR</Text>
            </View>
          </Pressable>
          <View style={styles.footer}>
            <Text style={styles.footnote}>El Vacío no contesta sí o no.{"\n"}Te ordena la pregunta.</Text>
          </View>
        </View>
      ) : null}

      {phase === "escuchando" ? (
        <View style={styles.center}>
          <View style={styles.listenZone}>
            <Animated.View style={[styles.ring, { opacity: pulse }]} />
            <Animated.View style={[styles.dot, { opacity: pulse }]} />
          </View>
          <View style={{ height: orbita.spacing.xxl * 2 }} />
          <Text style={styles.question}>“{question}”</Text>
          <View style={{ height: orbita.spacing.xl }} />
          <Text style={styles.eyebrow}>EL VACÍO ESTÁ ESCUCHANDO</Text>
        </View>
      ) : null}

      {phase === "respuesta" ? (
        <View style={styles.center}>
          <Text style={styles.eyebrow}>EL VACÍO · HOY</Text>
          <View style={{ height: orbita.spacing.sm }} />
          <Text style={styles.questionSmall}>“{question}”</Text>
          <View style={{ height: orbita.spacing.xxl * 1.5 }} />
          <Text style={styles.answer}>{ORACLE.answer}</Text>
          <View style={{ height: orbita.spacing.xxl * 1.5 }} />
          <View style={styles.tick} />
          <View style={{ height: orbita.spacing.xl }} />
          <Text style={styles.microMono}>{basadoEn}</Text>
          <View style={{ height: orbita.spacing.xxl }} />
          <Text style={styles.microMonoCopper}>UNA MEJOR PREGUNTA</Text>
          <View style={{ height: orbita.spacing.sm }} />
          <Text style={styles.betterQuestion}>{ORACLE.mejorPregunta}</Text>
          <View style={{ height: orbita.spacing.xxl }} />
          <Text style={styles.microMono}>{ORACLE.paso}</Text>
          <View style={styles.footer}>
            <Text style={styles.footnote}>El Vacío no contesta sí o no.</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: orbita.colors.background, flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject, height: "100%", opacity: 0.5, width: "100%" },
  topbar: { paddingHorizontal: orbita.spacing.gutter, paddingBottom: orbita.spacing.md },
  back: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 26, width: 40 },
  center: { alignItems: "center", flex: 1, paddingHorizontal: orbita.spacing.gutter, paddingTop: orbita.spacing.xxl * 2 },

  eyebrow: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 2.5,
    textAlign: "center"
  },
  h1: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.serif,
    fontSize: 40,
    lineHeight: 47,
    marginTop: orbita.spacing.xl,
    textAlign: "center"
  },
  input: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.serifRegular,
    fontSize: 20,
    minWidth: 240,
    paddingBottom: orbita.spacing.sm,
    textAlign: "center"
  },
  inputLine: { backgroundColor: "rgba(244,238,228,0.25)", height: 1, width: 220 },
  microMono: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.5,
    lineHeight: 18,
    textAlign: "center"
  },
  microMonoCopper: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 2,
    textAlign: "center"
  },
  ghostCta: {
    alignItems: "center",
    borderColor: "rgba(244,238,228,0.35)",
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 180
  },
  ghostCtaText: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 12, letterSpacing: 2 },
  pressed: { opacity: 0.6 },

  listenZone: { alignItems: "center", height: 180, justifyContent: "center", marginTop: orbita.spacing.xxl * 2, width: 180 },
  ring: {
    borderColor: "rgba(244,238,228,0.18)",
    borderRadius: 70,
    borderWidth: 1,
    height: 140,
    position: "absolute",
    width: 140
  },
  dot: {
    backgroundColor: orbita.colors.bone,
    borderRadius: 5,
    height: 10,
    shadowColor: orbita.colors.copper,
    shadowOpacity: 0.9,
    shadowRadius: 18,
    width: 10
  },
  question: { color: orbita.colors.bone, fontFamily: orbita.fonts.serifRegular, fontSize: 22, textAlign: "center" },
  questionSmall: { color: orbita.colors.muted, fontFamily: orbita.fonts.serifRegular, fontSize: 16, textAlign: "center" },
  answer: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.serif,
    fontSize: 34,
    lineHeight: 40,
    textAlign: "center"
  },
  tick: { backgroundColor: "rgba(196,106,58,0.7)", height: 1, width: 24 },
  betterQuestion: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 22, textAlign: "center" },
  footer: { alignItems: "center", bottom: 0, left: 0, paddingBottom: 48, position: "absolute", right: 0 },
  footnote: {
    color: orbita.colors.mutedDim,
    fontFamily: orbita.fonts.body,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center"
  }
});
