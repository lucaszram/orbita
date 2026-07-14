import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Body, Divider, Eyebrow, H2 } from "@/components/orbita/kit";
import { TarotStrip, type DiaCelda } from "@/components/diario/TarotStrip";
import { CARD_BACK, majorById } from "@/content/tarotDeck";
import { orbita } from "@/theme/orbita";

// TODO: pendiente backend — el diario real (carta + tránsito guardados por
// usuario+día). Hoy: mock tipado para ver la tira de cartas.
type Dia = {
  wd: string;
  n: string;
  id: number | null;
  revealed: boolean;
  nombre?: string;
  cielo?: string;
  body?: string;
};

const DIAS: Dia[] = [
  { wd: "SÁB", n: "5", id: 17, revealed: true, nombre: "La Estrella", cielo: "Venus armoniza con tu Luna", body: "Ese día Venus hizo trígono a tu Luna: un rato más suave, con ganas de cercanía." },
  { wd: "DOM", n: "6", id: 19, revealed: true, nombre: "El Sol", cielo: "La Luna llena te ilumina", body: "Un día para mostrarte sin tanto filtro; algo tuyo se dejó ver." },
  { wd: "LUN", n: "7", id: 14, revealed: true, nombre: "La Templanza", cielo: "Mercurio ordena tu semana", body: "Dosis justas: ni de más ni de menos. El día pedía equilibrio." },
  { wd: "MAR", n: "8", id: 18, revealed: true, nombre: "La Luna", cielo: "Saturno enfrenta tu Venus", body: "Hoy Saturno se pone enfrente de tu Venus: el tono en tus vínculos se vuelve más consciente." },
  { wd: "MIÉ", n: "9", id: null, revealed: false },
  { wd: "JUE", n: "10", id: null, revealed: false },
  { wd: "VIE", n: "11", id: null, revealed: false }
];

export default function DiarioScreen() {
  const [sel, setSel] = useState(3); // hoy = MAR 8

  const celdas: DiaCelda[] = DIAS.map((d) => ({
    wd: d.wd,
    n: d.n,
    image: d.id != null ? majorById(d.id)?.image ?? null : null,
    revealed: d.revealed
  }));

  const dia = DIAS[sel];
  const carta = dia.id != null ? majorById(dia.id) : null;

  return (
    <DetailScreen eyebrow="Tu diario">
      <Eyebrow>JULIO 2026</Eyebrow>
      <View style={{ marginHorizontal: -orbita.spacing.gutter, marginTop: orbita.spacing.sm }}>
        <TarotStrip dias={celdas} sel={sel} onSel={setSel} />
      </View>

      <Text style={styles.dayLabel}>
        {dia.wd === "MAR" ? "MARTES 8 · HOY" : `${dia.wd} ${dia.n} · TU DÍA`}
      </Text>

      {dia.revealed && carta ? (
        <>
          <View style={styles.center}>
            <View style={styles.bigCard}>
              <Image source={carta.image} style={styles.bigImg} resizeMode="cover" />
            </View>
          </View>
          <H2>Te salió {carta.nombre}.</H2>
          <View style={{ height: orbita.spacing.md }} />
          <Eyebrow>EL CIELO DE ESE DÍA</Eyebrow>
          <H2>{dia.cielo}</H2>
          <Body>{dia.body}</Body>
          <Divider />
          <Eyebrow>POR QUÉ ESTA CARTA</Eyebrow>
          <Body bone>
            {carta.nombre} · {carta.correspondencia}. La carta del día se conecta con tu tránsito.
          </Body>
        </>
      ) : (
        <>
          <View style={styles.center}>
            <View style={styles.bigCard}>
              <Image source={CARD_BACK} style={styles.bigImg} resizeMode="cover" />
            </View>
          </View>
          <Text style={styles.locked}>Se abre a las 9:00</Text>
        </>
      )}
      <View style={{ height: orbita.spacing.xl }} />
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  dayLabel: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: orbita.spacing.md,
    marginTop: orbita.spacing.lg
  },
  center: { alignItems: "center", marginBottom: orbita.spacing.lg },
  bigCard: {
    borderColor: "rgba(196,106,58,0.7)",
    borderRadius: 14,
    borderWidth: 1.5,
    height: 234,
    overflow: "hidden",
    width: 156
  },
  bigImg: { height: 234, width: 156 },
  locked: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.body, fontSize: 13, textAlign: "center" }
});
