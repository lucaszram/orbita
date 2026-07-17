import { useEffect, useRef } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import { Eyebrow, Section } from "@/components/orbita/kit";
import { RitualReading, isRitualComplete } from "@/components/home/RitualReading";
import { LoadingState } from "@/components/orbita/states";
import { CARD_BACK, cardById } from "@/content/tarotDeck";
import type { DailyCarta } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** "Tu carta de hoy" — el ritual.
 *
 *  El gesto es el producto: la carta está boca abajo y RESPIRA (está viva antes de que
 *  la toques), la das vuelta con un flip 3D real, y el texto entra en
 *  cascada detrás. No es un swap de estado: es un tirón de carta.
 *
 *  Y es IRREVERSIBLE. Se saca una vez por día y queda sacada (el backend guarda
 *  `revealedAt`). El mock viejo dejaba volver a taparla, lo cual la convertía en un
 *  juguete: si la podés esconder y volver a sacar, no es un ritual, es un botón.
 */
export function CartaDelDia({
  carta,
  revealed,
  onReveal,
  disabled,
  ctaLabel,
  ctaSub
}: {
  /** Carta del día, del backend. `undefined` mientras carga o sin sesión. */
  carta?: DailyCarta;
  /** Ya la dio vuelta (persistido) Y hay carta válida para mostrar — el caller es
   *  responsable de NO pasar true sin carta (regla del incidente 2026-07-13). */
  revealed: boolean;
  /** Dispara el reveal. Devuelve si el backend lo persistió: con `false` el flip
   *  optimista se revierte en vez de quedar mintiendo. */
  onReveal: () => boolean | Promise<boolean>;
  /** No se puede sacar todavía (sin sesión, o la guía del día aún no llegó). */
  disabled?: boolean;
  /** Eyebrow de la carta boca abajo. Default "TOCÁ PARA SACARLA"; del día 2 en
   *  adelante la Home pasa "HAY UNA CARTA NUEVA" (reconocimiento del regreso). */
  ctaLabel?: string;
  /** Línea bajo el eyebrow ("La segunda de tu tira." / variante del hueco). */
  ctaSub?: string;
}) {
  // 0 = boca abajo, 1 = dada vuelta. Es la fuente de verdad de TODA la animación.
  const flip = useSharedValue(revealed && carta ? 1 : 0);
  // Loop de respiración de la carta boca abajo.
  const breath = useSharedValue(0);
  // Tirón en curso (optimista, esperando confirmación del backend).
  const pulling = useRef(false);

  // Sincronizar el flip con el estado persistido — SOLO si hay carta que mostrar.
  // Defensa en profundidad contra la carrera del incidente: aunque llegara
  // `revealed=true` con carta ausente, jamás giramos hacia una cara vacía. Y si
  // `revealed` vuelve a false (dato transitorio), la carta se tapa de nuevo.
  useEffect(() => {
    if (pulling.current) return; // el gesto en vuelo es dueño de la animación
    if (revealed && carta && flip.value === 0) flip.value = 1;
    if (!revealed && flip.value === 1) flip.value = 0;
  }, [revealed, carta, flip]);

  useEffect(() => {
    if (revealed || disabled) {
      cancelAnimation(breath);
      breath.value = 0;
      return;
    }
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(breath);
  }, [revealed, disabled, breath]);

  async function pull() {
    // Sin carta no hay tirón: girar hacia una cara vacía era el bug del marco cobre.
    if (revealed || disabled || pulling.current || !carta) return;
    pulling.current = true;
    // Sin háptico: `expo-haptics` rompe el build de iOS. Sumarlo cambia el conjunto de pods,
    // eso corre la asignación de uuids determinísticos de CocoaPods, y un paquete SPM de Clerk
    // termina pisando el uuid del PBXProject → `Pods.xcodeproj` sale sin objeto raíz y el build
    // muere con un engañoso "no such module 'Expo'". Confirmado con un A/B.
    // Ver docs/ios-build-local-roto.md. No reintroducir sin resolver eso primero.
    flip.value = withTiming(1, { duration: 620, easing: Easing.inOut(Easing.cubic) });
    let ok = false;
    try {
      ok = await Promise.resolve(onReveal());
    } catch {
      ok = false;
    }
    if (!ok) {
      // El backend no lo persistió: la carta se vuelve a tapar en vez de quedar en un
      // estado optimista falso (mañana amanecería boca abajo igual).
      flip.value = withTiming(0, { duration: 420, easing: Easing.inOut(Easing.cubic) });
    }
    pulling.current = false;
  }

  // Las dos caras comparten el mismo eje. Cada una se esconde en su mitad del giro.
  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [
      { perspective: 900 },
      { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` },
      { scale: interpolate(breath.value, [0, 1], [1, 1.028]) }
    ]
  }));

  const faceStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 0 : 1,
    transform: [
      { perspective: 900 },
      // Arranca espejada (-180°) para que al llegar a 0° quede derecha justo cuando
      // el dorso terminó de irse.
      { rotateY: `${interpolate(flip.value, [0, 1], [-180, 0])}deg` }
    ]
  }));

  // El halo cobre late con la respiración: la carta "tira" de vos antes de tocarla.
  const glowStyle = useAnimatedStyle(() => ({
    opacity: flip.value > 0.5 ? 0 : interpolate(breath.value, [0, 1], [0.12, 0.4]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [1, 1.08]) }]
  }));

  // Carta con id fuera del mazo local (payload futuro/dañado): la cara cae
  // al dorso, nunca queda sin imagen.
  const image = carta ? cardById(carta.id)?.image ?? CARD_BACK : undefined;

  return (
    <Section style={styles.section}>
      <Eyebrow>TU CARTA DE HOY</Eyebrow>

      <View style={styles.center}>
        <View style={styles.stage}>
          <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />

          <AnimatedPressable
            onPress={pull}
            accessibilityRole="button"
            accessibilityLabel={revealed && carta ? `Tu carta de hoy: ${carta.nombre}` : "Tocá para sacar tu carta de hoy"}
            accessibilityState={{ disabled: Boolean(disabled) || revealed }}
            style={[styles.cardBack, backStyle]}
          >
            <Image source={CARD_BACK} style={styles.cardImg} resizeMode="cover" />
          </AnimatedPressable>

          <Animated.View style={[styles.cardFace, faceStyle]} pointerEvents="none">
            {image ? (
              <Image
                source={image}
                style={[styles.cardImg, carta?.orientacion === "invertida" ? styles.cardImgFlipped : null]}
                resizeMode="cover"
              />
            ) : null}
            <View style={styles.faceScrim} />
            <Text style={styles.faceLabel}>{carta?.nombre ?? ""}</Text>
          </Animated.View>
        </View>

        {!revealed ? (
          <>
            <Text style={styles.revealCta}>{disabled ? "PREPARANDO TU CARTA…" : ctaLabel ?? "TOCÁ PARA SACARLA"}</Text>
            {!disabled && ctaSub ? <Text style={styles.revealSub}>{ctaSub}</Text> : null}
          </>
        ) : null}
      </View>

      {/* La lectura entra DESPUÉS del giro (620ms). Ya NO cruza con el cielo: es el
          análisis intrínseco de la carta. Regla del handoff v3: completa o carga —
          nunca una lectura parcial (esa fue la captura de La Sacerdotisa). */}
      {revealed && carta ? (
        <Animated.View entering={FadeInDown.delay(520).duration(420)}>
          <Text style={styles.leadIn}>Te salió {carta.nombre}.</Text>
          {isRitualComplete(carta.ritual) ? (
            <>
              <Text style={styles.orient}>
                {carta.orientacion === "invertida" ? "SALIÓ INVERTIDA" : "SALIÓ AL DERECHO"}
              </Text>
              <RitualReading ritual={carta.ritual} />
            </>
          ) : (
            <View style={styles.loading}>
              <LoadingState />
            </View>
          )}
        </Animated.View>
      ) : null}
    </Section>
  );
}

const CARD_W = 150;
const CARD_H = 224;

const styles = StyleSheet.create({
  section: { borderTopColor: orbita.colors.line, borderTopWidth: 1 },
  center: { alignItems: "center", marginTop: orbita.spacing.lg },

  // Las dos caras se apilan en el mismo lugar; el escenario les reserva el espacio.
  stage: { alignItems: "center", height: CARD_H, justifyContent: "center", width: CARD_W },
  glow: {
    backgroundColor: orbita.colors.copper,
    borderRadius: 20,
    height: CARD_H,
    position: "absolute",
    width: CARD_W
  },

  cardBack: {
    backfaceVisibility: "hidden",
    borderRadius: 14,
    height: CARD_H,
    overflow: "hidden",
    position: "absolute",
    width: CARD_W
  },
  cardFace: {
    backfaceVisibility: "hidden",
    borderColor: "rgba(196,106,58,0.7)",
    borderRadius: 14,
    borderWidth: 1.5,
    height: CARD_H,
    justifyContent: "flex-end",
    overflow: "hidden",
    position: "absolute",
    width: CARD_W
  },
  cardImg: { height: CARD_H, width: CARD_W, ...StyleSheet.absoluteFillObject },
  cardImgFlipped: { transform: [{ rotate: "180deg" }] },

  faceScrim: { backgroundColor: "rgba(7,8,10,0.55)", bottom: 0, height: 68, left: 0, position: "absolute", right: 0 },
  faceLabel: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.serif,
    fontSize: 19,
    paddingBottom: orbita.spacing.md,
    textAlign: "center"
  },

  revealCta: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 1.5,
    marginTop: orbita.spacing.xl,
    textAlign: "center"
  },
  revealSub: {
    color: orbita.colors.mutedDim,
    fontFamily: orbita.fonts.body,
    fontSize: 13,
    marginTop: orbita.spacing.sm,
    textAlign: "center"
  },
  note: {
    color: orbita.colors.mutedDim,
    fontFamily: orbita.fonts.body,
    fontSize: 12,
    marginTop: orbita.spacing.sm,
    textAlign: "center"
  },

  leadIn: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 24, lineHeight: 29, marginTop: orbita.spacing.xl },
  orient: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: orbita.spacing.sm
  },
  loading: { marginTop: orbita.spacing.xl }
});
