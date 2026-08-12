import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { useIsDesktop } from "@/hooks/useLayoutMode";

import { entryBackground } from "../entryBackground";
import { CTA } from "../components/CTA";
import { Screen } from "../components/Screen";

import { font, GUTTER, orbita, SIGN_IN_LINK_ROW, SIGN_IN_LINK_TEXT } from "../theme";

/**
 * 01 — Splash + entrada estable (hotfix build 11).
 *
 * La pantalla de ENTRADA es estática y está montada SIEMPRE: puertas
 * "Empezar a usar Órbita" y "Ya tengo cuenta · Iniciar sesión". El intro
 * animado (Higgsfield, ~1s) se reproduce como overlay encima y se descarta
 * al terminar (playToEnd, timeout de respaldo o tap). Nunca dependemos de
 * eventos de video para poder avanzar: si el video falla, la entrada ya
 * está abajo. En build 10 el usuario quedó clavado en el frame "Órbita".
 */
const SPLASH_VIDEO = require("../../../assets/orbita/video/splash_intro.mp4");
const FALLBACK_MS = 1600; // por si el evento de fin no dispara

// El intro se reproduce UNA vez por proceso: al volver a la entrada (logout,
// back) va directo a la pantalla estática, sin remontar expo-video.
let introPlayed = false;

type Props = {
  onNext: () => void;
  /** Sin backend configurado no hay login: la puerta no se muestra. */
  onSignIn?: () => void;
};

export function SplashScreen({ onNext, onSignIn }: Props) {
  const [showIntro, setShowIntro] = useState(() => !introPlayed);
  const dismissIntro = () => {
    introPlayed = true;
    setShowIntro(false);
  };

  return (
    <View style={styles.root}>
      <EntryDoors onNext={onNext} onSignIn={onSignIn} />
      {showIntro ? <IntroVideo onDone={dismissIntro} /> : null}
    </View>
  );
}

/**
 * Tipografía de la entrada, en objetos LITERALES a propósito.
 *
 * `StyleSheet.create` de react-native-web no produce estilos en línea: compila
 * cada regla a una CLASE atómica. El `Text` compartido (`components/ui/text`)
 * agrega además la clase `text-base` de Tailwind, que fija `font-size: 16px` y
 * `line-height: 24px`. Clase contra clase ganaba Tailwind, así que el wordmark
 * se dibujaba a 16px —no a 46— mientras que `textAlign`, que
 * `text-base` no toca, sí se aplicaba. Un literal viaja en el atributo `style`
 * y le gana a cualquier clase. Es el mismo mecanismo que ya rompió el enlace de
 * "Ya tengo cuenta".
 */
const WORDMARK = {
  color: orbita.bone,
  fontFamily: font.serifReg,
  fontSize: 46,
  letterSpacing: 1,
  // Sin lineHeight explícito RN recorta el acento de la Ó mayúscula.
  lineHeight: 60,
  textAlign: "center"
} as const;

const TAGLINE = { color: orbita.muted, fontFamily: font.sans, fontSize: 15, lineHeight: 22, marginTop: 10, textAlign: "center" } as const;

/**
 * Entrada estable (estática, comprobable): las dos puertas.
 *
 * Una sola composición: la marca centrada sobre el fondo full-bleed y las dos
 * puertas al pie, dentro de la columna del alta. El hero editorial anclado
 * abajo a la izquierda ocupaba el escenario ANCHO —1200px— y con eso volvía
 * todo lo que había que sacar: en un viewport bajo la marca de 96px empujaba
 * las puertas fuera del pliegue y el CTA quedaba cortado. El fondo sigue siendo
 * dueño del cuadro entero; lo que se acota es el contenido.
 */
function EntryDoors({ onNext, onSignIn }: Props) {
  // ÚNICO uso del modo de layout en todo el alta, y no compone nada: elige el
  // MASTER del fondo full-bleed. En web hay un derivado por breakpoint
  // (candidato 3): el panorámico de 2560×1440 para una ventana ancha y el
  // vertical de 1170×2532 para un teléfono — el mismo par que usa la landing.
  // En nativo `entryBackground` devuelve siempre el asset V4.4 de siempre.
  const desktop = useIsDesktop();
  return (
    <Screen bg={entryBackground(desktop)} bgOpacity={0.9} wash={0.5}>
      <View style={styles.body}>
        <View style={styles.hero}>
          <Text style={WORDMARK}>Órbita</Text>
          <Text style={TAGLINE}>Tu cielo, todos los días.</Text>
        </View>
        <View style={styles.doors}>
          <CTA label="Empezar a usar Órbita" onPress={onNext} />
          {onSignIn ? (
            <Pressable
              onPress={onSignIn}
              hitSlop={10}
              style={SIGN_IN_LINK_ROW}
              accessibilityRole="link"
              accessibilityLabel="Ya tengo cuenta: iniciar sesión"
            >
              {/* UNA sola línea, sin `Text` anidados. En react-native-web un
                  `Text` con hijos `Text` se renderiza como div + spans y el
                  color en línea del padre no llega a los hijos: la fila entera
                  terminaba casi negra sobre el fondo casi negro. El estilo va
                  en el nodo que tiene el texto, así no hay nada que perder. */}
              <Text style={SIGN_IN_LINK_TEXT}>Ya tengo cuenta · Iniciar sesión</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

/** Overlay del intro: se descarta solo (fin de video, timeout o tap). */
function IntroVideo({ onDone }: { onDone: () => void }) {
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  const player = useVideoPlayer(SPLASH_VIDEO, (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener("playToEnd", () => finish());
    const t = setTimeout(finish, FALLBACK_MS);
    return () => {
      sub.remove();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // `overflow: hidden` + tamaño explícito: en web `expo-video` monta un
    // `<video>` que se va a su tamaño INTRÍNSECO si no se lo acota. A 1440x900
    // el intro se dibujaba a su medida real, tapaba las dos puertas y estiraba
    // el documento a 1216px de alto — lo que se veía era el primer frame del
    // video (planeta + orbe + wordmark), no la pantalla de entrada.
    <View style={[StyleSheet.absoluteFill, styles.intro]} pointerEvents="box-none">
      <VideoView
        player={player}
        style={styles.introVideo}
        contentFit="cover"
        nativeControls={false}
      />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={finish}
        accessibilityRole="button"
        accessibilityLabel="Saltar intro"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: GUTTER },
  doors: { paddingBottom: 18 },
  hero: { alignItems: "center", flex: 1, justifyContent: "center" },
  root: { backgroundColor: "#0A0B0E", flex: 1 },
  intro: { overflow: "hidden" },
  // Ancho y alto explícitos, no sólo `absoluteFill`: `absoluteFill` fija los
  // cuatro lados pero no impide que el elemento reporte su tamaño natural.
  introVideo: { height: "100%", left: 0, position: "absolute", top: 0, width: "100%" }
});
