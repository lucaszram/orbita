import { useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAction, useMutation, useQuery } from "convex/react";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useAppData } from "@/domain/appData";
import {
  proposedApi,
  type VoidAnswerPayload,
  type VoidPromptCategory,
  type VoidTodayPayload
} from "@/services/appRefs";
import { VOID_CATEGORIES } from "@/content/voidPrompts";
import { orbita } from "@/theme/orbita";

const TEXTURE = require("../../assets/orbita/optimized/core/orbita_daily_texture_b.jpg");
const DEFAULT_QUESTION = "¿Qué estás apurando?";

/** Respuesta editorial de maqueta (sin sesión o si el backend falla). */
const ORACLE = {
  answer: "Lo que apurás\nno es la respuesta:\nes el alivio.",
  mejorPregunta: "¿Qué cambiaría si esperás 24 horas?",
  paso: "UN PASO · ESCRIBÍ LA DECISIÓN\nY DEJALA DORMIR HASTA MAÑANA"
};

type Phase = "entrada" | "escuchando" | "respuesta";

type AskVoid = (args: { question: string }) => Promise<VoidAnswerPayload>;

type VoidViewProps = {
  ask: AskVoid | null;
  today: VoidTodayPayload | null;
  categories: VoidPromptCategory[];
  onUnlock: (() => void) | null;
};

export default function VoidScreen() {
  const { isLive } = useLiveApp();
  if (!isLive) {
    return <VoidView ask={null} today={null} categories={VOID_CATEGORIES} onUnlock={null} />;
  }
  return <VoidLive />;
}

/**
 * Sub-componente live: los hooks Convex solo se montan con sesión. Trae el cupo
 * del día (contador), las preguntas sugeridas personalizadas (fallback estático)
 * y expone el "desbloqueo" a Pro para el testeo interno.
 */
function VoidLive() {
  const ask = useAction(proposedApi.voidAsk);
  const today = useQuery(proposedApi.voidToday, {}) ?? null;
  const suggested = useAction(proposedApi.voidSuggested);
  const setPro = useMutation(proposedApi.setStubPro);
  const [categories, setCategories] = useState<VoidPromptCategory[]>(VOID_CATEGORIES);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    suggested({})
      .then((r) => {
        if (r?.categories?.length) setCategories(r.categories);
      })
      .catch(() => {});
  }, [suggested]);

  const onUnlock = () => {
    setPro({}).catch(() => {});
  };

  return <VoidView ask={ask} today={today} categories={categories} onUnlock={onUnlock} />;
}

function VoidView({ ask, today, categories, onUnlock }: VoidViewProps) {
  const insets = useSafeAreaInsets();
  const fontsLoaded = useOrbitaFonts();
  const { carta } = useAppData();
  const [phase, setPhase] = useState<Phase>("entrada");
  const [typed, setTyped] = useState("");
  const [category, setCategory] = useState<string>(categories[0]?.key ?? "yo");
  const [payload, setPayload] = useState<VoidAnswerPayload | null>(null);
  const [locked, setLocked] = useState(false);
  const pulse = useRef(new Animated.Value(0.4)).current;

  const question = typed.trim() || DEFAULT_QUESTION;
  const activeCategory = categories.find((c) => c.key === category) ?? categories[0];
  const noneLeft = !!today && today.remaining <= 0;
  const counterLabel = today
    ? today.remaining > 0
      ? `TE QUEDAN ${today.remaining} DE ${today.limit} HOY`
      : "SIN PREGUNTAS POR HOY"
    : "UNA PREGUNTA POR DÍA";

  // Manda una pregunta (tocada de la lista o escrita). Si no queda cupo, va
  // directo al estado de límite sin gastar una llamada.
  const askQuestion = (q: string) => {
    setTyped(q);
    if (noneLeft) {
      setLocked(true);
      setPhase("respuesta");
      return;
    }
    setLocked(false);
    setPhase("escuchando");
  };
  const basadoEn = `BASADO EN TU LUNA EN ${carta.triad.moon.label.toUpperCase()}\nY TU ASCENDENTE EN ${carta.triad.ascendant.label.toUpperCase()}`;

  // Respuesta a mostrar: la real del backend cuando llegó; si no, la maqueta.
  const shownQuestion = payload?.question ?? question;
  const shownAnswer = payload?.answer ?? ORACLE.answer;
  const shownBasadoEn = payload ? `BASADO EN\n${payload.basadoEn.join("\n")}` : basadoEn;
  const shownMejorPregunta = payload?.mejorPregunta ?? ORACLE.mejorPregunta;
  const shownPaso = payload?.paso ?? ORACLE.paso;

  useEffect(() => {
    if (phase !== "escuchando") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 900, useNativeDriver: true })
      ])
    );
    loop.start();
    let cancelled = false;

    // Con sesión: respuesta real (el límite 1/día lo maneja el backend). Sin
    // sesión o ante error: se mantiene la maqueta y la cadencia falsa.
    if (ask) {
      ask({ question })
        .then((res) => {
          if (cancelled) return;
          setLocked(!!res.locked);
          setPayload(res.locked ? null : res);
          setPhase("respuesta");
        })
        .catch(() => {
          if (cancelled) return;
          setLocked(false);
          setPayload(null);
          setPhase("respuesta");
        });
      return () => {
        cancelled = true;
        loop.stop();
      };
    }

    const t = setTimeout(() => setPhase("respuesta"), 2800);
    return () => {
      cancelled = true;
      loop.stop();
      clearTimeout(t);
    };
  }, [phase, pulse, ask, question]);

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
        <View style={styles.entrada}>
          <View style={styles.entradaHead}>
            <Text style={styles.eyebrow}>EL VACÍO</Text>
            <Text style={[styles.microMono, noneLeft && styles.microMonoCopper]}>{counterLabel}</Text>
          </View>

          <View style={styles.tabs}>
            {VOID_CATEGORIES.map((c) => {
              const active = c.key === category;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  hitSlop={8}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={styles.tab}
                >
                  <View style={[styles.tabGlyphBox, active && styles.tabGlyphBoxActive]}>
                    <Text style={[styles.tabGlyph, active && styles.tabGlyphActive]}>{c.glyph}</Text>
                  </View>
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{c.label.toUpperCase()}</Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            style={styles.prompts}
            contentContainerStyle={styles.promptsContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {activeCategory.prompts.map((p) => (
              <Pressable
                key={p}
                onPress={() => askQuestion(p)}
                style={({ pressed }) => [styles.promptRow, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.promptText}>{p}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={[styles.askBar, { paddingBottom: insets.bottom + orbita.spacing.md }]}>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              placeholder="Preguntá lo que quieras"
              placeholderTextColor={orbita.colors.muted}
              style={styles.askInput}
              returnKeyType="send"
              onSubmitEditing={() => askQuestion(question)}
            />
            <Pressable
              onPress={() => askQuestion(question)}
              hitSlop={8}
              accessibilityRole="button"
              style={({ pressed }) => [styles.askBtn, pressed && styles.pressed]}
            >
              <Text style={styles.askBtnText}>PREGUNTAR</Text>
            </Pressable>
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

      {phase === "respuesta" && locked ? (
        <View style={styles.center}>
          <Text style={styles.eyebrow}>EL VACÍO · POR HOY</Text>
          <View style={{ height: orbita.spacing.xxl }} />
          <Text style={styles.answer}>Por hoy{"\n"}alcanzó.</Text>
          <View style={{ height: orbita.spacing.xl }} />
          <Text style={styles.microMono}>Una pregunta bien pensada rinde más{"\n"}que diez apuradas. Volvé mañana.</Text>
          {onUnlock ? (
            <>
              <View style={{ height: orbita.spacing.xxl }} />
              <Pressable
                onPress={() => {
                  onUnlock();
                  setLocked(false);
                  setPhase("entrada");
                }}
                style={({ pressed }) => [pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <View style={styles.ghostCta}>
                  <Text style={styles.ghostCtaText}>DESBLOQUEAR 5 CON EL SEMANAL</Text>
                </View>
              </Pressable>
            </>
          ) : null}
          <View style={styles.footer}>
            <Text style={styles.footnote}>El Vacío no contesta sí o no.</Text>
          </View>
        </View>
      ) : phase === "respuesta" ? (
        <View style={styles.center}>
          <Text style={styles.eyebrow}>EL VACÍO · HOY</Text>
          <View style={{ height: orbita.spacing.sm }} />
          <Text style={styles.questionSmall}>“{shownQuestion}”</Text>
          <View style={{ height: orbita.spacing.xxl * 1.5 }} />
          <Text style={styles.answer}>{shownAnswer}</Text>
          <View style={{ height: orbita.spacing.xxl * 1.5 }} />
          <View style={styles.tick} />
          <View style={{ height: orbita.spacing.xl }} />
          <Text style={styles.microMono}>{shownBasadoEn}</Text>
          <View style={{ height: orbita.spacing.xxl }} />
          <Text style={styles.microMonoCopper}>UNA MEJOR PREGUNTA</Text>
          <View style={{ height: orbita.spacing.sm }} />
          <Text style={styles.betterQuestion}>{shownMejorPregunta}</Text>
          <View style={{ height: orbita.spacing.xxl }} />
          <Text style={styles.microMono}>{shownPaso}</Text>
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
  },

  // Fase entrada (estructura tipo Void de Co-Star, en estilo Órbita).
  entrada: { flex: 1, paddingHorizontal: orbita.spacing.gutter },
  entradaHead: { alignItems: "center", gap: orbita.spacing.sm, paddingBottom: orbita.spacing.xl, paddingTop: orbita.spacing.md },
  tabs: { flexDirection: "row", justifyContent: "space-between", paddingBottom: orbita.spacing.xl, paddingHorizontal: orbita.spacing.sm },
  tab: { alignItems: "center", flex: 1, gap: orbita.spacing.sm },
  tabGlyphBox: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 10,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  tabGlyphBoxActive: { borderColor: "rgba(244,238,228,0.35)" },
  tabGlyph: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 20 },
  tabGlyphActive: { color: orbita.colors.bone },
  tabLabel: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.monoMedium, fontSize: 10, letterSpacing: 1.5 },
  tabLabelActive: { color: orbita.colors.copper },

  prompts: { flex: 1 },
  promptsContent: { alignItems: "center", gap: orbita.spacing.xxl, paddingVertical: orbita.spacing.xl },
  promptRow: { paddingVertical: orbita.spacing.sm },
  promptText: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 14,
    letterSpacing: 0.5,
    lineHeight: 22,
    textAlign: "center",
    textDecorationLine: "underline"
  },

  askBar: {
    alignItems: "center",
    borderTopColor: orbita.colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: orbita.spacing.md,
    paddingTop: orbita.spacing.md
  },
  askInput: { color: orbita.colors.bone, flex: 1, fontFamily: orbita.fonts.serifRegular, fontSize: 18, paddingVertical: orbita.spacing.sm },
  askBtn: {
    borderColor: "rgba(244,238,228,0.35)",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: orbita.spacing.lg,
    paddingVertical: orbita.spacing.sm
  },
  askBtnText: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 12, letterSpacing: 1.5 }
});
