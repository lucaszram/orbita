import { type ReactNode, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery } from "convex/react";
import { CartaDelDia } from "@/components/home/CartaDelDia";
import { ContentCanvas } from "@/components/orbita/ContentCanvas";
import { ReadingBlock } from "@/components/orbita/Layout";
import { ErrorState } from "@/components/orbita/states";
import { revealFailureKind } from "@/domain/ritual";
import { useCanonicalLocalDate } from "@/hooks/useDailyContext";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useDailyGuide } from "@/services/dailyGuideStore";
import { proposedApi } from "@/services/appRefs";
import { cardById } from "@/content/tarotDeck";
import { revealErrorNote, umbralTarotHero, umbralTarotView } from "@/components/web/umbral-tarot-state";
import { orbita } from "@/theme/orbita";

// La misma textura que ya usa el Umbral: las dos secciones son una sola
// superficie, no dos pantallas pegadas.
const TEXTURE = require("../../../assets/orbita/optimized/core/orbita_daily_texture_b.jpg");

/**
 * Umbral › Tarot — una carta por día.
 *
 * No es una pantalla nueva de Tarot: es el ritual de siempre (`CartaDelDia`)
 * montado en la web. Por eso no hay botón «Sacar mi carta» ni «Dar vuelta»: la
 * carta boca abajo respira y se da vuelta tocándola en su propio lugar, con su
 * flip 3D y el rótulo encima.
 *
 * Todo el dato es del backend: `daily.getGuide` sortea y redacta, `revealCard`
 * persiste el tirón (idempotente, una vez por día). El cliente no sortea ni
 * redacta nada.
 *
 * La tira de días anteriores y el estado de límite de Free son otras dos
 * tarjetas: acá la carta que falla vuelve al dorso, sin inventar explicación.
 */
export function UmbralTarot({ selector }: { selector: ReactNode }) {
  const { isLive, isAuthLoading, auth } = useLiveApp();
  // El día lo decide el servidor (zona natal), no el reloj del navegador.
  const today = useCanonicalLocalDate();

  const userKey = isLive ? auth?.userId ?? null : null;
  // Misma clave (usuario, fecha) que la Home: abrir el Umbral no dispara una
  // segunda corrida de una action que en frío tarda ~25 segundos.
  const { state: dailyState, retry: retryDaily } = useDailyGuide(
    today ? userKey : null,
    today ?? "",
    isAuthLoading
  );
  const daily = dailyState.status === "ready" ? dailyState.payload : null;
  const carta = daily?.carta;

  // `revealedAt` sale de la misma query reactiva que ya usa la Home: después de
  // `revealCard` la pantalla se entera sola.
  const strip = useQuery(
    proposedApi.dailyStrip,
    isLive && today ? { from: today, to: today } : "skip"
  );
  const revealed = Boolean(strip?.find((d) => d.localDate === today)?.revealed);
  const view = umbralTarotView({
    status: dailyState.status,
    hasCarta: carta != null,
    revealed
  });

  // Revelada, el encabezado nombra la carta en vez de anunciar el ritual (T3).
  const hero = umbralTarotHero({
    mode: view.mode,
    nombre: carta?.nombre,
    roman: carta ? cardById(carta.id)?.roman : undefined
  });

  const revealCard = useMutation(proposedApi.revealCard);
  // El tirón rechazado se NOMBRA. Antes se tragaba en silencio y la carta
  // volvía al dorso sin explicación, indistinguible de un bug.
  const [revealError, setRevealError] = useState<"limite_free" | "desconocido" | null>(null);

  async function pull(): Promise<boolean> {
    if (view.mode !== "cerrada" || !today) return false;
    setRevealError(null);
    try {
      await revealCard({ localDate: today });
      return true;
    } catch (e) {
      // SIEMPRE se loguea, incluido el límite: si no, un rechazo esperable es
      // indistinguible de un bug para quien está mirando la consola.
      const kind = revealFailureKind(e);
      console.warn("[orbita] daily.revealCard rechazó el tirón:", kind, e instanceof Error ? e.message : e);
      setRevealError(kind);
      // La carta vuelve al dorso: nada se muestra como si el giro hubiera salido bien.
      return false;
    }
  }

  return (
    <View style={styles.screen}>
      <Image source={TEXTURE} style={styles.bg} resizeMode="cover" />
      <LinearGradient
        colors={["rgba(10,11,14,0.3)", "rgba(10,11,14,0.55)", "rgba(10,11,14,0.82)"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ContentCanvas variant="immersive">
          <ReadingBlock center>
            <View style={styles.head}>
              <Text style={styles.eyebrow}>EL UMBRAL · TAROT</Text>
              <Text style={styles.tagline}>{hero.tagline}</Text>
              <Text style={styles.micro}>{hero.micro}</Text>
            </View>

            {/* El selector va debajo del encabezado de la sección, como en el frame. */}
            {selector}

            {view.mode === "error" ? (
              <View style={styles.state}>
                <ErrorState onRetry={retryDaily} />
              </View>
            ) : (
              /* `CartaDelDia` es el ritual canónico, compartido con la Home. No
                 se edita ni se reimplementa: se monta. */
              <CartaDelDia
                carta={carta}
                revealed={view.mode === "revelada"}
                onReveal={pull}
                disabled={view.disabled}
                ctaLabel="TOCÁ PARA DARLA VUELTA"
              />
            )}

            {/* El motivo, en una línea. La salida a Plus con su diseño completo
                es otra tarjeta; lo que no puede pasar es que falle en silencio. */}
            {revealErrorNote(revealError) ? (
              <Text style={styles.revealError}>{revealErrorNote(revealError)}</Text>
            ) : null}
          </ReadingBlock>
        </ContentCanvas>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: orbita.colors.background, flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject, height: "100%", opacity: 0.5, width: "100%" },
  scroll: { paddingBottom: orbita.spacing.xxl, paddingTop: orbita.spacing.xl },
  head: { alignItems: "center", marginBottom: orbita.spacing.lg },
  eyebrow: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    textAlign: "center"
  },
  tagline: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.serif,
    fontSize: 26,
    marginTop: orbita.spacing.sm,
    textAlign: "center"
  },
  micro: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    marginTop: orbita.spacing.sm,
    textAlign: "center"
  },
  state: { marginTop: orbita.spacing.xxl },
  revealError: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.body,
    fontSize: 14,
    marginTop: orbita.spacing.lg,
    textAlign: "center"
  }
});
