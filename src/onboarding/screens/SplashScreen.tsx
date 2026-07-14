import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";

/**
 * 01 — Logo splash. Reproduce el intro animado (Higgsfield, ~1s) a pantalla
 * completa y auto-avanza al terminar; el tap sigue como atajo. El texto "Órbita"
 * viene bakeado en el video, así que no se superpone nada.
 */
const SPLASH_VIDEO = require("../../../assets/orbita/video/splash_intro.mp4");
const FALLBACK_MS = 1600; // por si el evento de fin no dispara

export function SplashScreen({ onNext }: { onNext: () => void }) {
  const advanced = useRef(false);
  const go = () => {
    if (advanced.current) return;
    advanced.current = true;
    onNext();
  };

  const player = useVideoPlayer(SPLASH_VIDEO, (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener("playToEnd", () => go());
    const t = setTimeout(go, FALLBACK_MS);
    return () => {
      sub.remove();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={go}
        accessibilityRole="button"
        accessibilityLabel="Entrar a Órbita"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#0A0B0E", flex: 1 },
});
