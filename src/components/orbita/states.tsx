import { StyleSheet, View } from "react-native";
import { EditorialThumb, HeroImage } from "@/components/orbita/HeroImage";
import { orbita } from "@/theme/orbita";
import { Body, Eyebrow, H2, Pill } from "./kit";

/**
 * Content-only state blocks (drop inside an OrbitaScreen / DetailScreen).
 * Match the Órbita V4.7 "Estados" section: Cargando / Vacío / Error / Bloqueado.
 */

export function LoadingState() {
  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <HeroImage kind="home" size={200} />
      </View>
      <Eyebrow>CALCULANDO</Eyebrow>
      <H2>Leyendo tu{"\n"}cielo de hoy.</H2>
      <Body>Cruzamos tu carta natal con los tránsitos de hoy. Un momento.</Body>
      <View style={styles.track}>
        <View style={styles.fill} />
      </View>
    </View>
  );
}

export function EmptyState({ title, body, cta, onCta }: { title: string; body: string; cta?: string; onCta?: () => void }) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.hero, { opacity: 0.12 }]}>
        <HeroImage kind="home" size={200} />
      </View>
      <H2>{title}</H2>
      <Body>{body}</Body>
      {cta ? (
        <>
          <View style={{ height: orbita.spacing.xl }} />
          <Pill label={cta} onPress={onCta} />
        </>
      ) : null}
    </View>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.hero, { opacity: 0.22 }]}>
        <HeroImage kind="home" size={200} />
      </View>
      <Eyebrow>SIN SEÑAL DEL CIELO</Eyebrow>
      <H2>No pudimos{"\n"}leer tu día.</H2>
      <Body>Hubo un problema al calcular los tránsitos. Probá de nuevo en un momento.</Body>
      <View style={{ height: orbita.spacing.xl }} />
      <Pill label="REINTENTAR" onPress={onRetry} />
    </View>
  );
}

export function LockedState({ onUnlock }: { onUnlock?: () => void }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.thumb}>
        <EditorialThumb height={150} />
      </View>
      <H2>El análisis{"\n"}completo de hoy.</H2>
      <Body>Ves el resumen. La lectura completa, tus cuatro áreas y el calendario son parte de Órbita Plus.</Body>
      <View style={{ height: orbita.spacing.xl }} />
      <Pill label="DESBLOQUEAR · PLUS" onPress={onUnlock} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: orbita.spacing.xl },
  hero: { alignItems: "center", marginBottom: orbita.spacing.xxl },
  thumb: {
    alignItems: "center",
    backgroundColor: orbita.colors.surfaceRaised,
    borderRadius: orbita.radius.xl,
    height: 150,
    justifyContent: "center",
    marginBottom: orbita.spacing.xl
  },
  track: { backgroundColor: orbita.colors.line, borderRadius: 2, height: 4, marginTop: orbita.spacing.xxl, width: "100%" },
  fill: { backgroundColor: orbita.colors.copper, borderRadius: 2, height: 4, width: "38%" }
});
