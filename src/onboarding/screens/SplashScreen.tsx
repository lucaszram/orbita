import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Screen } from "../components/Screen";
import { Body } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";

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

/** Entrada estable (estática, comprobable): las dos puertas. */
function EntryDoors({ onNext, onSignIn }: Props) {
  return (
    <Screen bg={A.splashBg} bgOpacity={0.9} wash={0.5}>
      <View style={styles.body}>
        <View style={styles.hero}>
          <Text style={styles.wordmark}>Órbita</Text>
          <Body style={styles.tagline}>Tu cielo, todos los días.</Body>
        </View>
        <View style={styles.doors}>
          <CTA label="Empezar a usar Órbita" onPress={onNext} />
          {onSignIn ? (
            <Pressable
              onPress={onSignIn}
              hitSlop={10}
              style={styles.signInRow}
              accessibilityRole="button"
              accessibilityLabel="Ya tengo cuenta: iniciar sesión"
            >
              <Text style={styles.signInText}>
                Ya tengo cuenta <Text style={styles.signInDot}>·</Text>{" "}
                <Text style={styles.signInLink}>Iniciar sesión</Text>
              </Text>
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
    <View style={StyleSheet.absoluteFill}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
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
  signInDot: { color: orbita.faint },
  signInLink: { color: orbita.copper, fontFamily: font.sansMed },
  signInRow: { alignItems: "center", marginTop: 18 },
  signInText: {
    color: orbita.bone,
    fontFamily: font.sans,
    fontSize: 14,
    textAlign: "center"
  },
  tagline: { marginTop: 10, textAlign: "center" },
  wordmark: {
    color: orbita.bone,
    fontFamily: font.serifReg,
    fontSize: 46,
    letterSpacing: 1,
    // Sin lineHeight explícito RN recorta el acento de la Ó mayúscula
    // (métricas verticales ajustadas de Newsreader).
    lineHeight: 60,
    textAlign: "center"
  }
});
