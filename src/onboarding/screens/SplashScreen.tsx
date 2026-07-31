import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { useIsDesktop } from "@/hooks/useLayoutMode";

import { A } from "../assets";
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
 * se dibujaba a 16px —no a 46, ni a 96— mientras que `textAlign`, que
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
const WORDMARK_DESKTOP = { ...WORDMARK, fontSize: 96, lineHeight: 112, textAlign: "left" } as const;

const TAGLINE = { color: orbita.muted, fontFamily: font.sans, fontSize: 15, lineHeight: 22, marginTop: 10, textAlign: "center" } as const;
const TAGLINE_DESKTOP = { ...TAGLINE, fontSize: 21, lineHeight: 30, marginTop: 6, maxWidth: 520, textAlign: "left" } as const;

/**
 * Entrada estable (estática, comprobable): las dos puertas.
 *
 * **Escritorio.** En móvil la marca va centrada y las puertas al pie: es una
 * pantalla de teléfono y funciona. Estirada a 1440x900 eso mismo se vuelve una
 * marca diminuta flotando en el medio de una foto enorme, con el CTA perdido
 * abajo — una captura de teléfono en un monitor.
 *
 * En escritorio se compone entonces como el hero editorial que Órbita ya usa en
 * web: tipografía grande anclada ABAJO A LA IZQUIERDA, el asset cósmico dueño
 * del resto del cuadro, y las dos puertas juntas debajo de la bajada con el CTA
 * en ancho de botón y no de columna. Misma copy, mismo paso 0, misma secuencia:
 * cambia la composición, no el flujo.
 */
function EntryDoors({ onNext, onSignIn }: Props) {
  const desktop = useIsDesktop();
  return (
    <Screen
      bg={A.splashBg}
      bgOpacity={0.9}
      wash={desktop ? 0.44 : 0.5}
      layout={desktop ? "scene" : "stage"}
    >
      <View style={[styles.body, desktop && styles.bodyDesktop]}>
        <View style={[styles.hero, desktop && styles.heroDesktop]}>
          <Text style={desktop ? WORDMARK_DESKTOP : WORDMARK}>Órbita</Text>
          <Text style={desktop ? TAGLINE_DESKTOP : TAGLINE}>Tu cielo, todos los días.</Text>
        </View>
        <View style={[styles.doors, desktop && styles.doorsDesktop]}>
          <CTA label="Empezar a usar Órbita" onPress={onNext} />
          {onSignIn ? (
            <Pressable
              onPress={onSignIn}
              hitSlop={10}
              style={[SIGN_IN_LINK_ROW, desktop && styles.signInRowDesktop]}
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
  introVideo: { height: "100%", left: 0, position: "absolute", top: 0, width: "100%" },
  // 44px de alto real: `hitSlop` no existe en web.

  // --- Escritorio: hero editorial anclado abajo a la izquierda -------------
  // El contenido ocupa el escenario completo (layout `scene`) y se apoya en el
  // borde inferior; el aire de arriba y de la derecha queda para el asset, que
  // pasa a ser parte de la composición en vez de espacio muerto.
  bodyDesktop: { justifyContent: "flex-end", paddingBottom: 72, paddingHorizontal: 0 },
  heroDesktop: { alignItems: "flex-start", flex: 0, justifyContent: "flex-end" },
  // 96px: la marca es LA pieza tipográfica de la entrada, no una etiqueta.
  // Las dos puertas juntas, alineadas a la marca. CTA con ancho de BOTÓN: a 520
  // se leía como una barra cruzando la pantalla.
  doorsDesktop: { alignItems: "flex-start", maxWidth: 340, paddingBottom: 0, paddingTop: 36 },
  signInRowDesktop: { alignSelf: "flex-start", justifyContent: "flex-start", marginTop: 12 }
});
