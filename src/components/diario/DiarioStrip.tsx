import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { TarotStrip, type DiaCelda } from "@/components/diario/TarotStrip";
import { majorById } from "@/content/tarotDeck";
import { lastNDays, monthLabel, toLocalDate } from "@/domain/dateStrip";
import { proposedApi } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

/** La tira del Diario en la Home: los últimos 7 días, con la carta que sacaste cada uno.
 *
 *  Es la razón para volver mañana. Un día sin carta es un hueco visible en la tira — y
 *  eso se siente. Los datos salen de `daily.getStrip`, que lee `dailyGuides` (una fila
 *  por usuario/día): el archivo del Diario ya se venía escribiendo solo.
 *
 *  Sin sesión (`isLive` false) la query se saltea y la tira aparece toda boca abajo;
 *  `guestCardId` refleja el reveal local de HOY para que la tira no contradiga el
 *  ritual recién hecho (el resto de los días queda boca abajo: no hay archivo). */
export function DiarioStrip({ isLive, guestCardId }: { isLive: boolean; guestCardId?: number | null }) {
  const days = useMemo(() => lastNDays(7), []);
  const from = days[0];
  const to = days[days.length - 1];

  const strip = useQuery(proposedApi.dailyStrip, isLive ? { from, to } : "skip");

  const celdas: DiaCelda[] = useMemo(() => {
    const byDate = new Map((strip ?? []).map((d) => [d.localDate, d]));
    return days.map((iso, i) => {
      const entry = byDate.get(iso);
      let image = entry?.cartaId != null ? majorById(entry.cartaId)?.image ?? null : null;
      let revealed = Boolean(entry?.revealed);
      if (!isLive && guestCardId != null && i === days.length - 1) {
        image = majorById(guestCardId)?.image ?? null;
        revealed = true;
      }
      const date = new Date(`${iso}T12:00:00`);
      return {
        wd: WEEKDAYS[date.getDay()],
        n: String(date.getDate()),
        image,
        revealed
      };
    });
  }, [days, strip, isLive, guestCardId]);

  // Hoy siempre es la última celda: la tira mira hacia atrás, no hacia adelante.
  const selected = celdas.length - 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.month}>{monthLabel(to)}</Text>
        <Pressable onPress={() => router.push("/reading/diario")} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.more}>MES ›</Text>
        </Pressable>
      </View>

      <TarotStrip dias={celdas} sel={selected} onSel={() => router.push("/reading/diario")} fit />
    </View>
  );
}

const WEEKDAYS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

const styles = StyleSheet.create({
  wrap: { paddingTop: orbita.spacing.lg },
  head: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: orbita.spacing.gutter
  },
  month: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  more: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 12, letterSpacing: 0.5 }
});

export { toLocalDate };
