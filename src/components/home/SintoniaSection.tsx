import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Eyebrow, Section } from "@/components/orbita/kit";
import { SignEmblem } from "@/components/orbita/SignEmblem";
import type { ZodiacSign } from "@/domain/types";
import { orbita } from "@/theme/orbita";

type Ventana = "hoy" | "semana" | "mes";
type Fila = { sign: ZodiacSign; label: string; why: string; level: string; strong: boolean };

// TODO: pendiente backend — la sintonía real (qué signos armonizan/tensionan con tu
// carta en cada ventana) la deriva Codex de chart × tránsitos. Hoy: mock tipado.
const MOCK: Record<Ventana, Fila[]> = {
  hoy: [
    { sign: "cancer", label: "Cáncer", why: "Agua, como tu Luna: hoy cuesta menos hablar de lo que pesa.", level: "ALTA", strong: true },
    { sign: "escorpio", label: "Escorpio", why: "Mismo elemento que tu Luna: lo hondo sale con menos esfuerzo.", level: "FUERTE", strong: true },
    { sign: "acuario", label: "Acuario", why: "Hay chispa, pero tu base pide cercanía y ellos, aire.", level: "EN TENSIÓN", strong: false }
  ],
  semana: [
    { sign: "tauro", label: "Tauro", why: "Buen ritmo para lo estable y lo que se sostiene.", level: "ALTA", strong: true },
    { sign: "virgo", label: "Virgo", why: "Se ordenan bien juntos esta semana.", level: "FUERTE", strong: true },
    { sign: "aries", label: "Aries", why: "Empuje, pero cuidá el apuro.", level: "EN TENSIÓN", strong: false }
  ],
  mes: [
    { sign: "piscis", label: "Piscis", why: "Ahí está tu Luna: el clima emocional se entiende más rápido.", level: "ALTA", strong: true },
    { sign: "libra", label: "Libra", why: "Se buscan el equilibrio y los acuerdos.", level: "FUERTE", strong: true },
    { sign: "leo", label: "Leo", why: "Tu mismo Sol: el brillo se entiende; el centro, se negocia.", level: "EN TENSIÓN", strong: false }
  ]
};

const VENTANAS: { key: Ventana; label: string }[] = [
  { key: "hoy", label: "HOY" },
  { key: "semana", label: "SEMANA" },
  { key: "mes", label: "MES" }
];

/** "Con qué signos sintonizás" — funciona sin contactos (deriva de tu carta × el cielo).
 *  Cuando sumás gente, aparece la sintonía persona por persona. */
export function SintoniaSection({ onAgregar }: { onAgregar?: () => void }) {
  const [ventana, setVentana] = useState<Ventana>("hoy");
  const filas = MOCK[ventana];
  return (
    <Section style={styles.section}>
      <Eyebrow>CON QUÉ SIGNOS SINTONIZÁS</Eyebrow>

      <View style={styles.toggle}>
        {VENTANAS.map((v) => {
          const on = v.key === ventana;
          return (
            <Pressable key={v.key} onPress={() => setVentana(v.key)} hitSlop={8} accessibilityRole="tab">
              <Text style={[styles.tab, on && styles.tabOn]}>{v.label}</Text>
              {on ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          );
        })}
      </View>

      {filas.map((f, i) => (
        <View key={f.sign} style={[styles.row, i > 0 && styles.rowBorder]}>
          <SignEmblem sign={f.sign} size={50} />
          <View style={styles.mid}>
            <View style={styles.midTop}>
              <Text style={styles.name}>{f.label}</Text>
              <Text style={[styles.level, f.strong ? styles.levelStrong : styles.levelSoft]}>{f.level}</Text>
            </View>
            <Text style={styles.why}>{f.why}</Text>
          </View>
        </View>
      ))}

      <Pressable onPress={onAgregar} hitSlop={8} accessibilityRole="button">
        <Text style={styles.invite}>＋  Agregar a alguien</Text>
      </Pressable>
      <Text style={styles.note}>Sumá a alguien y ves la sintonía real, persona por persona.</Text>
    </Section>
  );
}

const styles = StyleSheet.create({
  section: { borderTopColor: orbita.colors.line, borderTopWidth: 1 },
  toggle: { flexDirection: "row", gap: orbita.spacing.xl, marginTop: orbita.spacing.sm, marginBottom: orbita.spacing.md },
  tab: { color: orbita.colors.muted, fontFamily: orbita.fonts.mono, fontSize: 12, letterSpacing: 1 },
  tabOn: { color: orbita.colors.copper },
  tabUnderline: { backgroundColor: orbita.colors.copper, borderRadius: 1, height: 2, marginTop: 5, width: 26 },
  row: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.md, paddingVertical: orbita.spacing.lg },
  rowBorder: { borderTopColor: orbita.colors.line, borderTopWidth: 1 },
  mid: { flex: 1, gap: 4 },
  midTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  name: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 20 },
  level: { fontFamily: orbita.fonts.monoMedium, fontSize: 10, letterSpacing: 0.5 },
  levelStrong: { color: orbita.colors.copper },
  levelSoft: { color: orbita.colors.muted },
  why: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 14, lineHeight: 20 },
  invite: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 12, letterSpacing: 0.5, marginTop: orbita.spacing.lg },
  note: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.body, fontSize: 13, lineHeight: 19, marginTop: orbita.spacing.sm }
});
