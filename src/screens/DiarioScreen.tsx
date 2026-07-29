/**
 * Pantalla canónica de Órbita: la misma en nativo y en web.
 *
 * Vivía dentro de `app/reading/diario.tsx`, así que la web tenía que mantener su
 * propia versión en paralelo y las dos derivaban. La ruta ahora es un wrapper
 * fino sobre este módulo; no se duplica ninguna pantalla por plataforma.
 */
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useAction, useQuery } from "convex/react";
import { DetailScreen } from "@/components/home/DetailScreen";
import { RitualReading } from "@/components/home/RitualReading";
import { isRitualComplete } from "@/domain/ritual";
import { Body, Eyebrow, H2 } from "@/components/orbita/kit";
import { MinimalLoading } from "@/components/orbita/states";
import { TarotStrip, type DiaCelda } from "@/components/diario/TarotStrip";
import { CARD_BACK, cardById } from "@/content/tarotDeck";
import { dayLabel, lastNDaysFrom, monthLabel } from "@/domain/dateStrip";
import { useCanonicalLocalDate } from "@/hooks/useDailyContext";
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
export function DiarioScreen() {
  // Mismo guard que la Home (hotfix #6): `isLive` también es false mientras
  // Clerk/Convex cargan o reconectan — invitado es SOLO Clerk resuelto sin
  // sesión. Una cuenta existente nunca ve la carta guest ni "Creá tu cuenta"
  // durante una reconexión: ve carga estable o error con reintento.
  const { isLive, isAuthLoading, userError, retryUser, auth } = useLiveApp();
  const guest = !isAuthLoading && !userError && !auth?.isSignedIn;
  // Mismo criterio que la Home: el día y el rango salen de la fecha canónica
  // del servidor, no del reloj del navegador.
  const today = useCanonicalLocalDate();
  const days = useMemo(() => (today ? lastNDaysFrom(DAYS_SHOWN, today) : []), [today]);

  const strip = useQuery(
    proposedApi.dailyStrip,
    isLive && days.length ? { from: days[0], to: days[days.length - 1] } : "skip"
  );

  // Arranca en hoy (la última celda) y se puede caminar hacia atrás. Se guarda
  // `null` hasta que la persona elige: `days` está vacío mientras no llegó la
  // fecha canónica, así que inicializarlo con `days.length - 1` lo dejaba
  // clavado en -1 para siempre y `selectedDate` quedaba undefined.
  const [sel, setSel] = useState<number | null>(null);
  const selIndex = sel ?? days.length - 1;
  const selectedDate: string | undefined = days[selIndex];

  const byDate = useMemo(
    () => new Map((strip ?? []).map((d) => [d.localDate, d])),
    [strip]
  );

  const celdas: DiaCelda[] = useMemo(
    () =>
      days.map((iso) => {
        const entry = byDate.get(iso);
        const date = new Date(`${iso}T12:00:00`);
        return {
          wd: WEEKDAYS[date.getDay()],
          n: String(date.getDate()),
          image: entry?.cartaId != null ? cardById(entry.cartaId)?.image ?? null : null,
          revealed: Boolean(entry?.revealed),
          inverted: entry?.orientacion === "invertida"
        };
      }),
    [byDate, days]
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
  // La orientación acompaña a la carta: del payload si ya llegó, o de la fila de la tira.
  const orientacion = carta?.orientacion ?? entry?.orientacion ?? null;
  const ritual = carta?.ritual;
  // Sin fecha canónica todavía no se puede afirmar qué día es futuro.
  const isFuture = today && selectedDate ? selectedDate > today : false;

  // La fecha canónica llega por action, no por query: hasta entonces no hay
  // ventana ni día seleccionado. Sin este gate, `monthLabel(undefined)` hacía
  // `.split()` sobre undefined y la pantalla crasheaba en el primer render.
  if (!selectedDate) {
    return (
      <DetailScreen eyebrow="Tu diario">
        <MinimalLoading />
      </DetailScreen>
    );
  }

  return (
    <DetailScreen eyebrow="Tu diario">
      <Eyebrow>{monthLabel(selectedDate)}</Eyebrow>
      <View style={styles.stripWrap}>
        <TarotStrip dias={celdas} sel={selIndex} onSel={setSel} />
      </View>

      <Text style={styles.dayLabel}>{dayLabel(selectedDate, today ?? undefined).toUpperCase()}</Text>

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
        /* Sin cuenta no hay archivo (y la Home guest ya no sortea cartas
           locales): estado honesto, cero datos inventados. */
        <Body>Creá tu cuenta para que tus días se vayan guardando acá.</Body>
      ) : isRevealed && (carta || entryCard) ? (
        <>
          <View style={styles.center}>
            <View style={styles.bigCard}>
              {/* id fuera del mazo local → dorso, nunca el marco vacío */}
              <Image
                source={image ?? CARD_BACK}
                style={[styles.bigImg, orientacion === "invertida" ? styles.bigImgFlipped : null]}
                resizeMode="cover"
              />
            </View>
          </View>
          <H2>Te salió {cardName}.</H2>
          {orientacion ? (
            <Text style={styles.orient}>
              {orientacion === "invertida" ? "SALIÓ INVERTIDA" : "SALIÓ AL DERECHO"}
            </Text>
          ) : null}

          {/* Mismo bloque canónico que la Home: orientación → esencia → significado
              general → en tu día → consejo → cierre. Sin el bloque de cielo/cruce astro
              (no vuelve a la lectura de la carta — handoff v3). Completo o carga/error. */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={orbita.colors.copper} />
            </View>
          ) : isRitualComplete(ritual) ? (
            <RitualReading ritual={ritual} />
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
  bigImgFlipped: { transform: [{ rotate: "180deg" }] },
  orient: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: orbita.spacing.sm
  },
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
