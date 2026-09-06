import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";

import { OnboardingFlow } from "@/onboarding/OnboardingFlow";
import { ONBOARDING_TOTAL } from "@/onboarding/steps";
import { font, orbita } from "@/onboarding/theme";
import { INTERNAL_TOOLS_ENABLED } from "@/services/internalTools";

/**
 * Vista combinada del alta para revisión visual. SÓLO herramientas internas.
 *
 * Monta el alta REAL —no una copia— dentro de marcos del tamaño exacto de la
 * matriz de aceptación, para poder comparar el mismo paso en móvil y escritorio
 * de un vistazo, sin redimensionar la ventana una vez por paso.
 *
 * El flujo se monta con `debugStep`, que es de SÓLO LECTURA: no persiste
 * borrador, no calcula carta, no crea cuenta y no escribe nada remoto. Por eso
 * esta ruta puede recorrer todos los pasos sin tocar ninguna cuenta.
 *
 * Con `EXPO_PUBLIC_ORBITA_INTERNAL_TOOLS` sin setear (producción) redirige a
 * `/`, igual que `/studio`, `/lab` y `/backoffice`.
 */

/** Matriz de aceptación: los dos tamaños obligatorios + los de control. */
const SIZES = [
  { label: "320 × 568", w: 320, h: 568 },
  { label: "390 × 844", w: 390, h: 844 },
  { label: "400 × 774", w: 400, h: 774 },
  { label: "768 × 1024", w: 768, h: 1024 },
  { label: "900 × 800", w: 900, h: 800 },
  { label: "1024 × 768", w: 1024, h: 768 },
  { label: "1440 × 900", w: 1440, h: 900 },
  { label: "1920 × 1080", w: 1920, h: 1080 }
] as const;

const STEPS = Array.from({ length: ONBOARDING_TOTAL }, (_, i) => i);

const STEP_NAMES = [
  "00 Crear cuenta o ingresar",
  "01 Promesa",
  "02 Identidad",
  "03 Guía diaria",
  "04 Fecha",
  "05 Lugar",
  "06 Hora",
  "07 Estos son tus datos",
  "08 Tríada",
  "09 Antes / después",
  "10 Paywall"
];

export default function PreviewAltaRoute() {
  if (!INTERNAL_TOOLS_ENABLED) return <Redirect href="/" />;
  return <PreviewAlta />;
}

function PreviewAlta() {
  const [step, setStep] = useState(0);
  const [size, setSize] = useState<(typeof SIZES)[number]>(SIZES[2]);

  return (
    <View style={styles.root}>
      <View style={styles.bar}>
        <Text style={styles.title}>Alta · vista combinada</Text>
        <Text style={styles.note}>Sólo lectura · no escribe nada</Text>
      </View>

      <View style={styles.controls}>
        <Text style={styles.legend}>PASO</Text>
        <View style={styles.chips}>
          {STEPS.map((i) => (
            <Chip key={i} label={String(i).padStart(2, "0")} on={i === step} onPress={() => setStep(i)} />
          ))}
        </View>
      </View>

      <View style={styles.controls}>
        <Text style={styles.legend}>TAMAÑO</Text>
        <View style={styles.chips}>
          {SIZES.map((s) => (
            <Chip key={s.label} label={s.label} on={s.label === size.label} onPress={() => setSize(s)} />
          ))}
        </View>
      </View>

      <Text style={styles.current}>{STEP_NAMES[step]}</Text>

      <ScrollView contentContainerStyle={styles.stageWrap} horizontal={false}>
        <ScrollView horizontal contentContainerStyle={styles.hstage}>
          {/* El marco tiene el tamaño exacto del viewport a revisar. El alta
              adentro mide SU contenedor, así que la composición que se ve es la
              que se vería a ese ancho real. */}
          <View style={[styles.frame, { height: size.h, width: size.w }]}>
            <OnboardingFlow key={`${step}-${size.label}`} inspectStep={step} inspectWidth={size.w} />
          </View>
        </ScrollView>
      </ScrollView>

      <Text style={styles.hint}>
        El paso entra por el mismo camino que `debugStep`: sólo lectura. Para el flujo real, `/empezar`.
      </Text>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.chip, on && styles.chipOn]}
    >
      <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#07080A", flex: 1, padding: 16 },
  bar: { alignItems: "baseline", flexDirection: "row", gap: 12 },
  title: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 16 },
  note: { color: orbita.copperSoft, fontFamily: font.sans, fontSize: 12 },
  controls: { gap: 6, marginTop: 12 },
  legend: { color: orbita.copper, fontFamily: font.sansBold, fontSize: 10, letterSpacing: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderColor: orbita.lineStrong,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 10
  },
  chipOn: { backgroundColor: orbita.copper, borderColor: orbita.copper },
  chipTxt: { color: orbita.muted, fontFamily: font.sans, fontSize: 12 },
  chipTxtOn: { color: orbita.ink, fontFamily: font.sansBold },
  current: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 13, marginTop: 14 },
  stageWrap: { paddingVertical: 12 },
  hstage: { paddingRight: 16 },
  frame: { borderColor: orbita.lineStrong, borderWidth: 1, overflow: "hidden" },
  hint: { color: orbita.muted, fontFamily: font.sans, fontSize: 11, marginTop: 8 }
});
