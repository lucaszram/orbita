import { Image, type ImageSourcePropType, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { ONBOARDING_TOTAL } from "../steps";
import { Body, Caption, Title } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";

/**
 * Tres líneas por lado, no cinco.
 *
 * Con cinco ítems de dos renglones cada uno las tarjetas eran dos listas
 * apretadas y el paso se leía como un checklist. Tres frases con aire alrededor
 * se leen; el contenido es el mismo material del Figma, recortado a lo que
 * sostiene la idea. Sin lenguaje de destino ni de resultado garantizado: dice
 * cómo se mira el día, no lo que va a pasar.
 */
const ANTES = ["Vivía en automático", "No sabía qué priorizar", "Vínculos poco claros"];

const DESPUES = ["Con calma y confianza", "Enfocada en lo que importa", "Me vinculo con más claridad"];

type Props = { step: number; onNext: () => void; onBack: () => void };

/**
 * 13 — Antes / después de Órbita.
 *
 * Es el paso más denso del alta: dos tarjetas de cinco filas cada una. Con
 * altura fija no entraba —a 400x774 el CTA quedaba cortado contra el borde
 * inferior, y a 320x568 directamente fuera de pantalla— porque el cuerpo era un
 * `View` rígido. Ahora las tarjetas viven en un `ScrollView` y el CTA queda
 * ANCLADO fuera de él: se puede leer todo bajando, y el botón está siempre
 * visible y alcanzable, con el respiro del área segura por debajo.
 */
export function BeforeAfterScreen({ step, onNext, onBack }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Screen bg={A.beforeAfterBg} bgOpacity={0.8} wash={0.6}>
      <Header step={step} total={ONBOARDING_TOTAL} onBack={onBack} />
      <View style={styles.body}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Title style={styles.title}>Antes y después{"\n"}de Órbita</Title>
          <Body style={styles.sub}>Una guía diaria puede cambiar cómo mirás tu día.</Body>

          <View style={styles.columns}>
            <Column icon={A.moon} title="Antes" items={ANTES} positive={false} />
            <Column icon={A.sun} title="Después" items={DESPUES} positive />
          </View>

          <Caption style={styles.note}>No resuelve por vos. Te devuelve contexto.</Caption>
        </ScrollView>

        {/* Fuera del scroll: el CTA no puede depender de que alguien llegue al
            fondo de una lista de diez filas. */}
        <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
          <CTA label="Continuar" onPress={onNext} />
        </View>
      </View>
    </Screen>
  );
}

function Column({
  icon,
  title,
  items,
  positive,
}: {
  icon: ImageSourcePropType;
  title: string;
  items: string[];
  positive: boolean;
}) {
  return (
    <View style={[styles.card, positive && styles.cardAfter]}>
      <Image source={icon} style={styles.icon} resizeMode="cover" />
      <Text style={styles.cardTitle}>{title}</Text>
      {items.map((item) => (
        <View key={item} style={styles.row}>
          <View style={[styles.chip, positive ? styles.chipAfter : styles.chipBefore]}>
            <Text style={[styles.mark, { color: positive ? orbita.copper : orbita.muted }]}>
              {positive ? "✓" : "✕"}
            </Text>
          </View>
          <Text style={styles.rowTxt}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // `minHeight: 0` en los dos: sin eso el ScrollView crece con su contenido en
  // vez de acotarse, y el CTA anclado al pie queda fuera del viewport.
  body: { flex: 1, minHeight: 0, paddingHorizontal: GUTTER, paddingTop: 22 },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { paddingBottom: 8 },
  card: {
    alignItems: "center",
    backgroundColor: "rgba(18,20,26,0.82)",
    borderColor: orbita.line,
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    // Más aire entre filas: es lo que separa un checklist de una pieza editorial.
    gap: 18,
    paddingHorizontal: 14,
    paddingVertical: 24,
  },
  cardAfter: { borderColor: "rgba(196,106,58,0.55)" },
  // El título de cada lado es la jerarquía: serif, más grande, con su propio aire.
  cardTitle: { color: orbita.bone, fontFamily: font.serif, fontSize: 22, marginTop: 2 },
  chip: {
    alignItems: "center",
    borderRadius: 11,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    marginTop: 1,
    width: 22,
  },
  chipAfter: { backgroundColor: "rgba(196,106,58,0.16)", borderColor: "rgba(196,106,58,0.5)" },
  chipBefore: { backgroundColor: "rgba(140,136,128,0.12)", borderColor: "rgba(140,136,128,0.4)" },
  columns: { flexDirection: "row", gap: 12, marginTop: 24 },
  footer: { paddingTop: 12 },
  icon: { borderRadius: 20, height: 40, width: 40 },
  mark: { fontFamily: font.sansBold, fontSize: 11 },
  note: { marginTop: 16, textAlign: "center" },
  row: { alignSelf: "stretch", flexDirection: "row", gap: 8 },
  rowTxt: { color: orbita.bone, flex: 1, fontFamily: font.sans, fontSize: 13.5, lineHeight: 19 },
  sub: { marginTop: 10, textAlign: "center" },
  title: { textAlign: "center" },
});
