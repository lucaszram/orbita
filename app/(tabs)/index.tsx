import { useMemo, useRef, useState } from "react";
import { Alert, LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { HomeBackdrop } from "@/components/home/HomeBackdrop";
import {
  DailyGuide,
  HomeHeader,
  LongReadEnd,
  SignalTop,
  TopicsSection
} from "@/components/home/sections";
import { useMutation, useQuery } from "convex/react";
import { Eyebrow, InsightRow, Section } from "@/components/orbita/kit";
import { LoadingState } from "@/components/orbita/states";
import { mapNatalChart } from "@/components/web/orbita-chart";
import { chartMock } from "@/content/chartMock";
import { guestCardOfTheDay } from "@/content/tarotDeck";
import { guestRitual } from "@/domain/guestRitual";
import { lastNDays, toLocalDate } from "@/domain/dateStrip";
import { useDailyGuide } from "@/services/dailyGuideStore";
import { markFirstRun, useFirstRun } from "@/services/firstRun";
import { CartaDelDia } from "@/components/home/CartaDelDia";
import { DiarioStrip } from "@/components/diario/DiarioStrip";
import { SintoniaSection } from "@/components/home/SintoniaSection";
import { useAppState } from "@/hooks/useAppState";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { useRequireProfile } from "@/hooks/useRequireProfile";
import { HomeTopic, Topic, Triad, ZodiacSign } from "@/domain/types";
import { signHomeBank } from "@/content/signHomeBank";
import { appApi, proposedApi, type DailyGuidePayload, type NatalChartPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

const TRIAD_GLYPH = { sol: "☉", luna: "☽", ascendente: "↑" } as const;

/** Tríada de la Home tomada de la MISMA fuente que la Carta (el chart), para que
 *  Home y Carta muestren exactamente lo mismo. */
function triadFromChart(payload: NatalChartPayload): Triad {
  const t = payload.triad;
  return {
    sun: { body: "sol", glyph: TRIAD_GLYPH.sol, sign: t.sun.sign as Triad["sun"]["sign"], label: t.sun.sign },
    moon: { body: "luna", glyph: TRIAD_GLYPH.luna, sign: t.moon.sign as Triad["moon"]["sign"], label: t.moon.sign },
    ascendant: {
      body: "ascendente",
      glyph: TRIAD_GLYPH.ascendente,
      sign: t.ascendant.sign as Triad["ascendant"]["sign"],
      label: t.ascendant.sign
    },
    accuracy: "calculated",
    accuracyNote: null
  };
}

export default function HomeScreen() {
  const { isReady, profile } = useRequireProfile();
  const { homeReading, saveTodayReading } = useAppState();
  const { isLive, isAuthLoading, userError, retryUser, auth } = useLiveApp();
  // Mock SOLO para invitado CONFIRMADO (Clerk resuelto y sin sesión). Mientras la
  // sesión carga o reconecta (`isAuthLoading`) la Home muestra carga estable: una
  // sesión existente no ve datos demo ni un segundo (incidente 2026-07-13).
  const guest = !isAuthLoading && !userError && !auth?.isSignedIn;
  const chartDoc = useQuery(appApi.charts.current, isLive ? {} : "skip");
  // La query se saltea durante una reconexión; recordamos el último doc para no
  // degradar la Home ya renderizada a "cargando" por un parpadeo de red.
  const chartDocRef = useRef<typeof chartDoc>(undefined);
  if (chartDoc !== undefined) chartDocRef.current = chartDoc;
  const knownChartDoc = chartDoc !== undefined ? chartDoc : chartDocRef.current;
  const fontsLoaded = useOrbitaFonts();
  const insets = useSafeAreaInsets();
  const [activeTopic, setActiveTopic] = useState<Topic | null>("amor");

  // Guía diaria real, deduplicada por (usuario, fecha) FUERA del componente: un
  // remontaje de la Home reutiliza la misma ejecución/resultado en vez de volver a
  // disparar una acción de ~25s (ver src/services/dailyGuideStore.ts).
  const today = toLocalDate();
  // Clave estable del usuario: el clerkUserId (el email puede cambiar).
  const userKey = isLive ? auth?.userId ?? null : null;
  const { state: dailyState, retry: retryDaily } = useDailyGuide(userKey, today);
  const daily: DailyGuidePayload | null = dailyState.status === "ready" ? dailyState.payload : null;

  // El ritual. `revealedAt` vive en el server, así que sobrevive a cerrar la app: la
  // carta se saca UNA vez por día. La tira es una query reactiva. El rango es la
  // MISMA ventana de 7 días que DiarioStrip (mismos args → una sola query real):
  // de ahí salen también los estados de regreso (día 2, hueco, vuelta completa).
  const revealCard = useMutation(proposedApi.revealCard);
  const stripDays = useMemo(() => lastNDays(7), []);
  const stripQ = useQuery(proposedApi.dailyStrip, isLive ? { from: stripDays[0], to: stripDays[stripDays.length - 1] } : "skip");
  const stripRef = useRef<typeof stripQ>(undefined);
  if (stripQ !== undefined) stripRef.current = stripQ;
  const strip = stripQ !== undefined ? stripQ : stripRef.current;
  // Invitado: no hay backend que recuerde nada, así que el ritual es solo de esta
  // sesión. Vive en guestRitual (módulo) para que el Diario cuente lo mismo.
  const [guestRevealed, setGuestRevealed] = useState(() => guestRitual.isRevealed(today));

  // LA regla del incidente: `revealedAt` (getStrip) puede llegar ANTES que la carta
  // (getGuide). "Revelada" sin carta válida es CARGA inconsistente, no una carta dada
  // vuelta — si no, el flip gira hacia una cara vacía (solo el marco cobre).
  const stripRevealed = Boolean(strip?.find((d) => d.localDate === today)?.revealed);
  const revealed = guest ? guestRevealed : stripRevealed && daily?.carta != null;

  // Primera vez (Bloque B): la intro del tarot vive hasta el primer reveal de la
  // vida; el bloque EL RITUAL aparece solo el día en que ese primer reveal ocurre.
  const { ready: flagsReady, flags } = useFirstRun();
  const [primerRitualHoy, setPrimerRitualHoy] = useState(false);
  function marcarPrimerRitual() {
    if (!flags.ritualExplicado) {
      setPrimerRitualHoy(true);
      void markFirstRun({ ritualExplicado: true });
    }
  }

  async function pullCard(): Promise<boolean> {
    if (guest) {
      guestRitual.markRevealed(today);
      setGuestRevealed(true);
      marcarPrimerRitual();
      return true;
    }
    if (dailyState.status !== "ready" || !daily?.carta) {
      if (dailyState.status === "error") retryDaily();
      return false;
    }
    try {
      await revealCard({ localDate: today });
      marcarPrimerRitual();
      return true;
    } catch (e) {
      console.warn("[orbita] daily.revealCard falló:", e instanceof Error ? e.message : e);
      return false;
    }
  }

  // Estados de la tira para el reconocimiento del regreso (solo con archivo real).
  const prevRevealed = (strip ?? []).filter((d) => d.localDate !== today && d.revealed).length;
  const ayer = stripDays[stripDays.length - 2];
  const huecoAyer = prevRevealed > 0 && !(strip ?? []).find((d) => d.localDate === ayer)?.revealed;
  const vueltaCompleta =
    !guest && stripDays.every((iso) => (iso === today ? revealed : (strip ?? []).find((d) => d.localDate === iso)?.revealed));
  const totalRevealed = prevRevealed + (revealed ? 1 : 0);

  // Día 2+: el eyebrow de la carta boca abajo reconoce el regreso (B3).
  let cartaCtaLabel: string | undefined;
  let cartaCtaSub: string | undefined;
  if (!guest && prevRevealed > 0) {
    cartaCtaLabel = "HAY UNA CARTA NUEVA";
    cartaCtaSub = huecoAyer
      ? "Las de ayer no se recuperan. La de hoy sí."
      : prevRevealed === 1
        ? "La segunda de tu tira."
        : "Tocá para abrir el día.";
  }

  // Día 1 (nunca sacó una carta): la intro explica el tarot EN su lugar de trabajo,
  // no en otra pantalla (decisión 2026-07-14: la ceremonia es solo la carta natal).
  const introTarot = flagsReady && !flags.ritualExplicado && !revealed && (guest || prevRevealed === 0);

  // Con sesión, la carta la sortea y la escribe el backend. Sin sesión, sorteo local
  // (misma carta para todos los invitados ese día) para que el ritual no quede muerto.
  const carta = guest ? guestCardOfTheDay(today) : daily?.carta;

  // La tríada del hero: mock SOLO para invitado. Una Home autenticada espera su carta
  // real (gate de render más abajo) — nunca arranca mostrando la tríada de la demo.
  let chartPayload: NatalChartPayload = chartMock;
  if (isLive && knownChartDoc) {
    try {
      chartPayload = mapNatalChart(knownChartDoc);
    } catch {
      chartPayload = chartMock;
    }
  }
  const heroTriad = triadFromChart(chartPayload);
  const chartReady = guest || knownChartDoc !== undefined;

  // Invitado: el texto del día sale del MISMO signo que la tríada (el chart), no del
  // profile — así "PARA LEO" no choca con una frase de otro signo. Logueado usa el LLM.
  const guestDaily = guest
    ? (() => {
        const key = chartPayload.triad.sun.sign.toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
        const v = signHomeBank[key as ZodiacSign]?.[0];
        return v ? { headline: v.headline, body: v.body, clima: v.clima } : null;
      })()
    : null;

  // ¿Qué se puede mostrar? Invitado: siempre (es la demo). Live: cuando la guía Y la
  // carta natal llegaron. booting/reconnecting/error de sesión: nunca contenido demo.
  const sessionPending = isAuthLoading;
  const dayReady = guest || (dailyState.status === "ready" && chartReady);

  if (!isReady || !profile || !fontsLoaded) {
    return <View style={styles.screen} />;
  }

  function selectTab(topic: Topic) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTopic((prev) => (prev === topic ? null : topic));
  }

  async function guardar() {
    await saveTodayReading();
    Alert.alert("Guardado", "Tu lectura de hoy quedó en guardadas.");
  }

  return (
    <View style={styles.screen}>
      <HomeBackdrop />
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + orbita.spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader />
        {/* La recepción de la carta natal ya no es un banner acá: es la ceremonia
            full-screen (/recepcion) a la que el onboarding entra antes de la Home. */}

        {sessionPending ? (
          /* Sesión resolviéndose (arranque o reconexión): carga estable. NUNCA mocks —
             una sesión existente no ve datos demo ni siquiera un segundo. */
          <View style={styles.loadingBlock}>
            <LoadingState />
          </View>
        ) : userError ? (
          /* ensureUser falló de verdad: error recuperable, no "listo" de mentira. */
          <View style={styles.loadingBlock}>
            <Text style={styles.errorTitle}>No pudimos abrir tu sesión.</Text>
            <Pressable onPress={retryUser} accessibilityRole="button" style={styles.retryBtn}>
              <Text style={styles.retryText}>REINTENTAR</Text>
            </Pressable>
          </View>
        ) : (
          <>
        {/* El ritual es la puerta de entrada: la tira de días (tu racha) y la carta boca
            abajo. Recién cuando la sacás se abre el día. */}
        <DiarioStrip isLive={isLive} guestCardId={guest && guestRevealed ? carta?.id ?? null : null} />

        {/* Bajo la tira: el hito de la vuelta completa (7 de 7) o, los primeros días,
            la explicación de qué es la tira (B2/B4). Nunca los dos a la vez. */}
        {vueltaCompleta ? (
          <Text style={styles.stripHito}>Siete cartas. La primera vuelta completa de tu tira.</Text>
        ) : flagsReady && flags.ritualExplicado && totalRevealed > 0 && totalRevealed < 3 ? (
          <Text style={styles.stripCaption}>Cada día deja su carta.</Text>
        ) : null}

        {/* Día 1: el tarot se explica acá, pegado a la acción (Figma sección 13). */}
        {introTarot ? (
          <View style={styles.introTarot}>
            <Text style={styles.introEyebrow}>TU TAROT DIARIO</Text>
            <Text style={styles.introBody}>
              Tu carta de hoy ya está en el mazo. Sacala y Órbita te la explica: qué es, qué significa que te haya
              salido, y cómo se cruza con tu carta natal y el cielo del día.
            </Text>
          </View>
        ) : null}

        <CartaDelDia
          carta={carta}
          revealed={revealed}
          onReveal={pullCard}
          disabled={!guest && dailyState.status !== "ready"}
          cielo={daily?.destacado}
          ctaLabel={cartaCtaLabel}
          ctaSub={cartaCtaSub}
        />

        {/* EL RITUAL (B1): una vez en la vida, después del primer reveal — nombra el
            método que el usuario acaba de leer en los beats. */}
        {revealed && primerRitualHoy ? (
          <Animated.View entering={FadeInDown.delay(1150).duration(420)} style={styles.ritualBlock}>
            <Text style={styles.introEyebrow}>EL RITUAL</Text>
            <Text style={styles.ritualTitle}>Qué significa que te haya salido esta carta.</Text>
            <Text style={styles.introBody}>
              Cada día sale una para vos, y la leemos en tres pasos: qué es la carta, qué te muestra que te haya
              salido justo hoy, y cómo se cruza con tu carta natal y el cielo del día.
            </Text>
            <Text style={styles.ritualCadencia}>
              Una por día. Queda en tu tira; la de mañana se abre a medianoche.
            </Text>
          </Animated.View>
        ) : null}

        {/* Guía del día en vuelo o caída: carga estable / error con reintento. Nunca el
            texto del engine local pisado después por el real ("flash de maqueta"). */}
        {!dayReady ? (
          dailyState.status === "error" ? (
            <View style={styles.loadingBlock}>
              <Text style={styles.errorTitle}>{dailyState.message}</Text>
              <Pressable onPress={retryDaily} accessibilityRole="button" style={styles.retryBtn}>
                <Text style={styles.retryText}>REINTENTAR</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.loadingBlock}>
              <LoadingState />
            </View>
          )
        ) : (
          <>
        {/* El velo: hasta que no sacás la carta, la lectura del día está atenuada. Eso es
            lo que hace que el gesto pese — si podés leer todo sin tirar la carta, el ritual
            es decorativo. Sigue siendo scrolleable (no bloqueamos, atenuamos). */}
        {!revealed ? (
          <View style={styles.veilNote}>
            <Text style={styles.veilText}>Sacá tu carta para abrir el día</Text>
          </View>
        ) : null}

        <View style={revealed ? undefined : styles.veiled} pointerEvents={revealed ? "auto" : "none"}>
          <SignalTop
            reading={homeReading}
            triad={heroTriad}
            daily={daily ?? guestDaily ?? undefined}
            name={auth?.name}
            onProfundizar={() => router.push("/reading/deep-dive")}
            onVerCarta={() => router.push("/(tabs)/carta")}
          />
          {/* Guía, áreas y lectura larga salen de la MISMA generación que el hero (una tesis
              del día, cuatro ángulos). Si el LLM no respondió, `daily` viene sin esos bloques
              y cada sección cae al engine local — la Home nunca queda a medio llenar. */}
          <DailyGuide reading={homeReading} guia={daily?.guia} />
          <TopicsSection
            reading={homeReading}
            activeTopic={activeTopic}
            onSelectTab={selectTab}
            topics={daily?.topics}
          />
          <LongReadEnd
            reading={homeReading}
            onLeerAnalisis={() => router.push("/reading/long-read")}
            onGuardar={guardar}
            onHistorial={() => router.push("/reading/saved")}
            lecturaLarga={daily?.lecturaLarga}
            cierre={daily?.cierre}
          />
          <SintoniaSection />
        </View>
          </>
        )}
          </>
        )}

        <Section style={styles.more}>
          <Eyebrow>TAMBIÉN HOY</Eyebrow>
          <InsightRow title="Fase lunar y calendario" body="El calendario lunar · el clima del mes, día a día" onPress={() => router.push("/reading/luna")} />
          <InsightRow
            title="Tu carta, leída como carácter"
            body="Tu carta natal · qué significa cada planeta"
            onPress={() => router.push("/(tabs)/carta")}
          />
          <InsightRow
            title="Qué te impulsa, qué te pesa"
            body="Mapa de valores · una foto, no una sentencia"
            onPress={() => router.push("/reading/valores")}
          />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#07080A", flex: 1 },
  more: { borderTopColor: orbita.colors.line, borderTopWidth: 1 },

  // El velo. Sin `expo-blur` (dep nativa que no vale la pena por esto): con opacidad
  // alcanza para que se lea "hay algo, pero todavía no es tuyo".
  veiled: { opacity: 0.12 },
  loadingBlock: { paddingVertical: orbita.spacing.xxl },

  // Primera vez (Bloque B): intro del tarot (día 1), captions de la tira y EL RITUAL.
  introTarot: { paddingHorizontal: orbita.spacing.gutter, paddingTop: orbita.spacing.xl },
  introEyebrow: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 11, letterSpacing: 1.5 },
  introBody: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: orbita.spacing.sm
  },
  stripCaption: {
    color: orbita.colors.mutedDim,
    fontFamily: orbita.fonts.body,
    fontSize: 13,
    marginTop: orbita.spacing.md,
    paddingHorizontal: orbita.spacing.gutter,
    textAlign: "center"
  },
  stripHito: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.serif,
    fontSize: 16,
    marginTop: orbita.spacing.md,
    paddingHorizontal: orbita.spacing.gutter,
    textAlign: "center"
  },
  ritualBlock: {
    borderTopColor: orbita.colors.line,
    borderTopWidth: 1,
    marginHorizontal: orbita.spacing.gutter,
    marginTop: orbita.spacing.xl,
    paddingTop: orbita.spacing.lg
  },
  ritualTitle: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.serif,
    fontSize: 21,
    lineHeight: 26,
    marginTop: orbita.spacing.sm
  },
  ritualCadencia: {
    color: orbita.colors.mutedDim,
    fontFamily: orbita.fonts.body,
    fontSize: 13,
    marginTop: orbita.spacing.md
  },
  errorTitle: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.serif,
    fontSize: 20,
    lineHeight: 26,
    paddingHorizontal: orbita.spacing.gutter,
    textAlign: "center"
  },
  retryBtn: {
    alignSelf: "center",
    borderColor: "rgba(244,238,228,0.35)",
    borderRadius: orbita.radius.lg,
    borderWidth: 1,
    marginTop: orbita.spacing.xl,
    paddingHorizontal: orbita.spacing.xxl,
    paddingVertical: orbita.spacing.md
  },
  retryText: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 12, letterSpacing: 1.5 },
  veilNote: {
    alignItems: "center",
    borderTopColor: orbita.colors.line,
    borderTopWidth: 1,
    paddingHorizontal: orbita.spacing.gutter,
    paddingVertical: orbita.spacing.xxl
  },
  veilText: {
    color: orbita.colors.mutedDim,
    fontFamily: orbita.fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
    textAlign: "center",
    textTransform: "uppercase"
  }
});
