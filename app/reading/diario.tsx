import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useAction, useQuery } from "convex/react";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Body, Divider, Eyebrow, H2 } from "@/components/orbita/kit";
import { TarotStrip, type DiaCelda } from "@/components/diario/TarotStrip";
import { CARD_BACK, guestCardOfTheDay, cardById } from "@/content/tarotDeck";
import { dayLabel, lastNDays, monthLabel, toLocalDate } from "@/domain/dateStrip";
import { guestRitual } from "@/domain/guestRitual";
import { useLiveApp } from "@/hooks/useLiveApp";
import { proposedApi, type DailyGuidePayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

const WEEKDAYS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const DAYS_SHOWN = 14;

/** El archivo del Diario: tu cielo día a día.
 *
 *  Cada día que abriste la app dejó una fila en `dailyGuides` — su carta y su lectura.
 *  Esta pantalla las recorre hacia atrás. Los días que no abriste no tienen fila: salen
 *  boca abajo, y ese hueco en la tira es a propósito (es lo que se siente al romper la
 *  racha). No se puede "recuperar" un día perdido: la carta era de ese día.
 */
export default function DiarioScreen() {
  // Mismo guard que la Home (hotfix #6): `isLive` también es false mientras
  // Clerk/Convex cargan o reconectan — invitado es SOLO Clerk resuelto sin
  // sesión. Una cuenta existente nunca ve la carta guest ni "Creá tu cuenta"
  // durante una reconexión: ve carga estable o error con reintento.
  const { isLive, isAuthLoading, userError, retryUser, auth } = useLiveApp();
  const guest = !isAuthLoading && !userError && !auth?.isSignedIn;
  const days = useMemo(() => lastNDays(DAYS_SHOWN), []);
  const today = toLocalDate();

  const strip = useQuery(
    proposedApi.dailyStrip,
    isLive ? { from: days[0], to: days[days.length - 1] } : "skip"
  );

  // Arranca en hoy (la última celda) y se puede caminar hacia atrás.
  const [sel, setSel] = useState(days.length - 1);
  const selectedDate = days[sel];

  const byDate = useMemo(
    () => new Map((strip ?? []).map((d) => [d.localDate, d])),
    [strip]
  );

  // Invitado: el reveal de HOY vive en memoria de sesión (guestRitual) — la tira y el
  // detalle lo reflejan para no contradecir a la Home; el resto de los días no tiene
  // archivo sin cuenta y queda boca abajo.
  const guestToday = guest && guestRitual.isRevealed(today) ? guestCardOfTheDay(today) : null;

  const celdas: DiaCelda[] = useMemo(
    () =>
      days.map((iso) => {
        const entry = byDate.get(iso);
        const date = new Date(`${iso}T12:00:00`);
        const isGuestToday = guestToday != null && iso === today;
        return {
          wd: WEEKDAYS[date.getDay()],
          n: String(date.getDate()),
          image: isGuestToday
            ? cardById(guestToday.id)?.image ?? null
            : entry?.cartaId != null
              ? cardById(entry.cartaId)?.image ?? null
              : null,
          revealed: isGuestToday || Boolean(entry?.revealed)
        };
      }),
    [byDate, days, guestToday, today]
  );

  // La lectura del día elegido. `getGuide` es cache-first por (usuario, fecha): para un
  // día pasado devuelve lo que se generó ESE día, no una lectura nueva. Por eso el diario
  // es un archivo real y no una regeneración.
  const getGuide = useAction(proposedApi.dailyGuide);
  const [guide, setGuide] = useState<DailyGuidePayload | null>(null);
  const [loading, setLoading] = useState(false);

  const entry = byDate.get(selectedDate);
  const isRevealed = Boolean(entry?.revealed);

  useEffect(() => {
    if (!isLive || !isRevealed) {
      setGuide(null);
      return;
    }
    let alive = true;
    setLoading(true);
    getGuide({ localDate: selectedDate })
      .then((payload) => {
        if (alive) setGuide(payload);
      })
      .catch(() => {
        if (alive) setGuide(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [getGuide, isLive, isRevealed, selectedDate]);

  // La identidad de la carta NO depende de getGuide: ya está en la fila de la tira
  // (cartaId). Así la carta nunca "desaparece" mientras la lectura carga o si la
  // action falla — solo el texto espera.
  const entryCard = entry?.cartaId != null ? cardById(entry.cartaId) : undefined;
  const carta = guide?.carta;
  const image = carta ? cardById(carta.id)?.image : entryCard?.image;
  const cardName = carta?.nombre ?? entryCard?.nombre;
  const isFuture = selectedDate > today;

  return (
    <DetailScreen eyebrow="Tu diario">
      <Eyebrow>{monthLabel(selectedDate)}</Eyebrow>
      <View style={styles.stripWrap}>
        <TarotStrip dias={celdas} sel={sel} onSel={setSel} />
      </View>

      <Text style={styles.dayLabel}>{dayLabel(selectedDate, today).toUpperCase()}</Text>

      {isAuthLoading ? (
        /* Sesión resolviéndose: carga estable, nunca el estado guest. */
        <View style={styles.center}>
          <ActivityIndicator color={orbita.colors.copper} />
        </View>
      ) : userError ? (
        <>
          <Body>No pudimos abrir tu sesión.</Body>
          <Pressable onPress={retryUser} accessibilityRole="button" style={styles.retryBtn} hitSlop={8}>
            <Text style={styles.retryText}>REINTENTAR</Text>
          </Pressable>
        </>
      ) : guest ? (
        guestToday && selectedDate === today ? (
          <>
            <View style={styles.center}>
              <View style={styles.bigCard}>
                <Image source={cardById(guestToday.id)?.image ?? CARD_BACK} style={styles.bigImg} resizeMode="cover" />
              </View>
            </View>
            <H2>Te salió {guestToday.nombre}.</H2>
            <View style={{ height: orbita.spacing.md }} />
            <Body>Creá tu cuenta para que tus días se vayan guardando acá.</Body>
          </>
        ) : (
          <Body>Creá tu cuenta para que tus días se vayan guardando acá.</Body>
        )
      ) : isRevealed && (carta || entryCard) ? (
        <>
          <View style={styles.center}>
            <View style={styles.bigCard}>
              {image ? <Image source={image} style={styles.bigImg} resizeMode="cover" /> : null}
            </View>
          </View>
          <H2>Te salió {cardName}.</H2>

          <View style={{ height: orbita.spacing.md }} />
          <Eyebrow>{selectedDate === today ? "EL CIELO DE HOY" : "EL CIELO DE ESE DÍA"}</Eyebrow>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={orbita.colors.copper} />
            </View>
          ) : guide ? (
            <>
              <H2>{guide.headline}</H2>
              <Body>{guide.body}</Body>

              <Divider />
              {(carta?.beats ?? []).map((beat) => (
                <View key={beat.label} style={styles.beat}>
                  <Eyebrow>{beat.label}</Eyebrow>
                  <Body>{beat.body}</Body>
                </View>
              ))}
            </>
          ) : (
            <Body>No pudimos traer la lectura de ese día. Volvé a entrar para reintentar.</Body>
          )}
        </>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={orbita.colors.copper} />
        </View>
      ) : (
        <>
          <View style={styles.center}>
            <View style={styles.bigCard}>
              <Image source={CARD_BACK} style={styles.bigImg} resizeMode="cover" />
            </View>
          </View>
          <Text style={styles.locked}>
            {isFuture
              ? "Ese día todavía no llegó."
              : selectedDate === today
                ? "Todavía no sacaste tu carta de hoy."
                : "Ese día no abriste la app. Esa carta ya no se saca."}
          </Text>
        </>
      )}
      <View style={{ height: orbita.spacing.xl }} />
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  stripWrap: { marginHorizontal: -orbita.spacing.gutter, marginTop: orbita.spacing.sm },
  dayLabel: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: orbita.spacing.md,
    marginTop: orbita.spacing.lg
  },
  center: { alignItems: "center", marginBottom: orbita.spacing.lg, marginTop: orbita.spacing.md },
  bigCard: {
    borderColor: "rgba(196,106,58,0.7)",
    borderRadius: 14,
    borderWidth: 1.5,
    height: 234,
    overflow: "hidden",
    width: 156
  },
  bigImg: { height: 234, width: 156 },
  beat: { marginTop: orbita.spacing.lg },
  locked: {
    color: orbita.colors.mutedDim,
    fontFamily: orbita.fonts.body,
    fontSize: 13,
    textAlign: "center"
  },
  retryBtn: {
    alignSelf: "flex-start",
    borderColor: orbita.colors.line,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: orbita.spacing.md,
    paddingHorizontal: orbita.spacing.lg,
    paddingVertical: orbita.spacing.sm
  },
  retryText: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 1
  }
});
