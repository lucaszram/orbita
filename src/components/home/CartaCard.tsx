import { type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { MeasuredSquare } from "@/components/orbita/ContentCanvas";
import { NatalWheel } from "@/components/orbita/NatalWheel";
import { TriadLine } from "@/components/orbita/TriadLine";
import { usePressedState } from "@/components/v492/Touchable";
import { INCOMPLETE_BIRTH_MESSAGE } from "@/domain/birthInfo";
import { mapNatalChart } from "@/domain/natalChart";
import { personalChartGate } from "@/domain/natalChartGate";
import { dataPhase, sessionPhase } from "@/domain/screenPhase";
import { useLiveApp } from "@/hooks/useLiveApp";
import { appApi, type NatalChartPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

/**
 * Carta natal en la Home/Perfil: mini-rueda real + tríada + CTA al hub de la Carta
 * (`/(tabs)/carta`). `variant="card"` (default) = recuadro con borde (Perfil).
 * `variant="hero"` = full-bleed sin borde, primera impresión post-onboarding.
 * Sin mocks: invitado → mensaje honesto; con sesión, carga / vacío / error se
 * distinguen de verdad (nunca spinner infinito ni rueda demo como tuya).
 */
export function CartaCard({ variant = "card" }: { variant?: "card" | "hero" }) {
  const live = useLiveApp();
  const phase = sessionPhase(live);
  const doc = useQuery(appApi.charts.current, phase === "live" ? {} : "skip");
  // Los datos natales REMOTOS mandan sobre la existencia de una carta: una carta
  // calculada sobre datos incompletos —o sobre datos que ya cambiaron— no es
  // válida y no se dibuja. Sin esto, un documento legado (lugar "Sin
  // especificar", sin coordenadas) o la carta anterior a una edición igual
  // producían una rueda que se leía como propia.
  const remoteBirth = useQuery(appApi.birthData.getCurrent, phase === "live" ? {} : "skip");
  const chartGate = personalChartGate({ birth: remoteBirth, chart: doc });
  const hero = variant === "hero";
  // Antes de las salidas tempranas: el estado de presionado es un hook y el
  // orden de los hooks no puede depender de la fase.
  const { pressed, pressableProps } = usePressedState();

  if (phase === "cargando") {
    return (
      <CardFrame hero={hero}>
        <View style={[styles.wheelWrap, styles.stateZone]}>
          <ActivityIndicator color={orbita.colors.copper} />
        </View>
      </CardFrame>
    );
  }
  if (phase === "error") {
    return (
      <CardFrame hero={hero} onPress={live.retryUser} ctaLabel="REINTENTAR">
        <Text style={styles.stateText}>No pudimos abrir tu sesión.</Text>
      </CardFrame>
    );
  }
  if (phase === "invitado") {
    return (
      <CardFrame hero={hero} onPress={() => router.push("/iniciar-sesion")} ctaLabel="INICIAR SESIÓN">
        <Text style={styles.stateText}>
          Tu carta se calcula con tu cuenta, con tu fecha, hora y lugar de nacimiento reales.
        </Text>
      </CardFrame>
    );
  }

  if (chartGate === "cargando") {
    return (
      <CardFrame hero={hero}>
        <View style={[styles.wheelWrap, styles.stateZone]}>
          <ActivityIndicator color={orbita.colors.copper} />
        </View>
      </CardFrame>
    );
  }
  if (chartGate === "datosIncompletos") {
    return (
      <CardFrame hero={hero} onPress={() => router.push("/editar-datos")} ctaLabel="EDITAR DATOS">
        <Text style={styles.stateText}>{INCOMPLETE_BIRTH_MESSAGE}</Text>
      </CardFrame>
    );
  }
  if (chartGate === "desactualizada") {
    // Hay carta, pero es la de datos anteriores: se abre la Carta, que ofrece
    // recalcularla. Nunca se dibuja la rueda vieja como si fuera la actual.
    return (
      <CardFrame hero={hero} onPress={() => router.push("/(tabs)/carta")} ctaLabel="VER MI CARTA →">
        <Text style={styles.stateText}>
          Tus datos cambiaron desde el último cálculo. Abrí tu carta para recalcularla.
        </Text>
      </CardFrame>
    );
  }

  let payload: NatalChartPayload | null = null;
  let mapFailed = false;
  if (doc) {
    try {
      payload = mapNatalChart(doc);
    } catch {
      mapFailed = true;
    }
  }
  const chartPhase = dataPhase({ pending: doc === undefined, failed: mapFailed, empty: doc === null });

  if (chartPhase === "cargando") {
    return (
      <CardFrame hero={hero}>
        <View style={[styles.wheelWrap, styles.stateZone]}>
          <ActivityIndicator color={orbita.colors.copper} />
        </View>
      </CardFrame>
    );
  }
  if (chartPhase === "vacio") {
    return (
      <CardFrame hero={hero} onPress={() => router.push("/(tabs)/carta")} ctaLabel="VER MI CARTA →">
        <Text style={styles.stateText}>
          Tus datos están guardados. Abrí tu carta para terminar de calcularla.
        </Text>
      </CardFrame>
    );
  }
  if (chartPhase === "error" || !payload) {
    return (
      <CardFrame hero={hero} onPress={() => router.push("/(tabs)/carta")} ctaLabel="VER MI CARTA →">
        <Text style={styles.stateText}>No pudimos leer tu carta. Abrila para ver qué pasa.</Text>
      </CardFrame>
    );
  }
  const t = payload.triad;

  return (
    <View style={hero ? styles.heroSection : styles.section}>
      <Pressable
        onPress={() => router.push("/(tabs)/carta")}
        {...pressableProps}
        style={[hero ? styles.hero : styles.card, pressed ? styles.pressed : null]}
        accessibilityRole="button"
        accessibilityLabel="Ver mi carta natal"
      >
        <Text style={styles.eyebrow}>TU CARTA NATAL</Text>
        {/* El lado sale del CONTENEDOR medido, con 232 como tope. */}
        <View style={styles.wheelWrap} pointerEvents="none">
          <MeasuredSquare max={232}>{(size) => <NatalWheel payload={payload!} size={size} />}</MeasuredSquare>
        </View>
        <TriadLine
          units={[
            { symbol: "sun", label: t.sun.sign },
            { symbol: "moon", label: t.moon.sign },
            // El Ascendente se marca con la MISMA flecha ascendente que usa el
            // hub de la Carta, no con su monograma: a 14 px, al lado de dos
            // glifos planetarios, `Ac` se lee como una sigla suelta. El glifo
            // del catálogo sigue siendo el de la rueda y el de las tablas de
            // datos; acá cambia sólo la marca de esta tríada.
            { symbol: "ascendant", marker: "↑", label: t.ascendant.sign }
          ]}
          textStyle={styles.triadText}
          glyphColor={orbita.colors.bone}
          glyphSize={14}
          centered
          style={styles.triad}
        />
        <View style={styles.cta}>
          <Text style={styles.ctaText}>VER MI CARTA →</Text>
        </View>
      </Pressable>
    </View>
  );
}

/** Marco compartido de la tarjeta para los estados (carga / vacío / error /
 *  invitado): mismo recuadro y eyebrow que la tarjeta real, con CTA opcional. */
function CardFrame({
  hero,
  onPress,
  ctaLabel,
  children
}: {
  hero: boolean;
  onPress?: () => void;
  ctaLabel?: string;
  children: ReactNode;
}) {
  const { pressed, pressableProps } = usePressedState();
  return (
    <View style={hero ? styles.heroSection : styles.section}>
      <Pressable
        onPress={onPress ?? (() => router.push("/(tabs)/carta"))}
        {...pressableProps}
        style={[hero ? styles.hero : styles.card, pressed ? styles.pressed : null]}
        accessibilityRole="button"
        accessibilityLabel="Tu carta natal"
      >
        <Text style={styles.eyebrow}>TU CARTA NATAL</Text>
        {children}
        {ctaLabel ? (
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: orbita.spacing.gutter, paddingTop: orbita.spacing.xl },
  card: {
    alignItems: "center",
    backgroundColor: "rgba(14,16,20,0.55)",
    borderColor: orbita.colors.line,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: orbita.spacing.lg,
    paddingVertical: orbita.spacing.xl
  },
  // Variante héroe (post-onboarding): full-bleed, sin borde ni recuadro.
  heroSection: { paddingHorizontal: orbita.spacing.gutter, paddingTop: orbita.spacing.lg },
  hero: { alignItems: "center", paddingVertical: orbita.spacing.lg },
  pressed: { opacity: 0.7 },
  eyebrow: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 12, letterSpacing: 2.5 },
  // El contenedor de la rueda tiene que tener ANCHO PROPIO. `MeasuredSquare`
  // mide su contenedor con `onLayout` y sin medida real no dibuja nada; adentro
  // de una tarjeta con `alignItems: "center"`, una caja sin ancho se encoge a su
  // contenido —que arranca vacío— y el ancho medido queda en 0. La rueda no
  // aparecía nunca y sólo quedaba el alto reservado: el hueco de 232 que se veía
  // en Perfil. `alignSelf: "stretch"` + `width: "100%"` le dan un ancho definido
  // contra el que el porcentaje del cuadrado resuelve, en web y en nativo.
  //
  // El centrado NO va acá: lo pone `MeasuredSquare`, que ya centra su contenido.
  // `alignItems: "center"` sobre un hijo que declara `width: "100%"` es
  // exactamente la combinación que colapsa en react-native-web (misma nota que
  // en `ContentCanvas`).
  wheelWrap: { alignSelf: "stretch", marginVertical: orbita.spacing.lg, width: "100%" },
  // Mismo alto que la rueda (232) para que el placeholder no salte al resolver.
  // Centra su propio contenido, porque el wrap ya no lo hace.
  stateZone: { alignItems: "center", height: 232, justifyContent: "center" },
  stateText: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginVertical: orbita.spacing.xl,
    textAlign: "center"
  },
  triad: { marginBottom: orbita.spacing.lg },
  triadText: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 13,
    letterSpacing: 1
  },
  cta: {
    alignItems: "center",
    borderColor: "rgba(244,238,228,0.35)",
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: orbita.spacing.xl,
    paddingVertical: orbita.spacing.md
  },
  ctaText: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 12, letterSpacing: 1.5 }
});
