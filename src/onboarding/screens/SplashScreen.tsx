import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";

import { CTA } from "../components/CTA";
import { font, GUTTER, orbita } from "../theme";

/**
 * 01/01B — Logo splash + entrada. Reproduce el intro animado (Higgsfield, ~1s)
 * a pantalla completa y TERMINA en esta pantalla (no salta): sobre el último
 * frame aparecen las dos puertas — "Empezar a usar Órbita" (onboarding) y
 * "Ya tengo cuenta · Iniciar sesión" (login, sin repetir el onboarding).
 * El texto "Órbita" viene bakeado en el video, así que no se superpone nada.
 */
const SPLASH_VIDEO = require("../../../assets/orbita/video/splash_intro.mp4");
const FALLBACK_MS = 1600; // por si el evento de fin no dispara

type Props = {
  onNext: () => void;
  /** Sin backend configurado no hay login: la puerta no se muestra. */
  onSignIn?: () => void;
};

export function SplashScreen({ onNext, onSignIn }: Props) {
  const [ended, setEnded] = useState(false);
  const endedRef = useRef(false);
  const fade = useRef(new Animated.Value(0)).current;

  const finish = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    setEnded(true);
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

  useEffect(() => {
    if (!ended) return;
    Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [ended, fade]);

  return (
    <View style={styles.root}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      {!ended ? (
        // Tap durante el video = atajo al estado final (no avanza de pantalla).
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={finish}
          accessibilityRole="button"
          accessibilityLabel="Saltar intro"
        />
      ) : (
        <Animated.View style={[styles.doors, { opacity: fade }]}>
          <LinearGradient
            colors={["rgba(10,11,14,0)", "rgba(10,11,14,0.85)", orbita.bg]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView edges={["bottom"]}>
            <View style={styles.doorsInner}>
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
          </SafeAreaView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  doors: { bottom: 0, left: 0, position: "absolute", right: 0 },
  doorsInner: { paddingBottom: 18, paddingHorizontal: GUTTER, paddingTop: 40 },
  root: { backgroundColor: "#0A0B0E", flex: 1 },
  signInDot: { color: orbita.faint },
  signInLink: { color: orbita.copper, fontFamily: font.sansMed },
  signInRow: { alignItems: "center", marginTop: 18 },
  signInText: {
    color: orbita.bone,
    fontFamily: font.sans,
    fontSize: 14,
    textAlign: "center",
  },
});
