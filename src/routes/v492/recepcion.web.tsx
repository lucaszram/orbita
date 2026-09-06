import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { HomeBackdrop } from "@/components/home/HomeBackdrop";
import { ContentCanvas, MeasuredSquare } from "@/components/orbita/ContentCanvas";
import { NatalWheel } from "@/components/orbita/NatalWheel";
import { TriadLine, type TriadLineUnit } from "@/components/orbita/TriadLine";
import { HOME_ROUTE } from "@/domain/appRoutes";
import { recepcionCta } from "@/domain/entitlement";
import { safeEntitlement } from "@/domain/nativeCommerce";
import { mapNatalChart } from "@/domain/natalChart";
import { personalChartGate } from "@/domain/natalChartGate";
import { markFirstRun } from "@/services/firstRun";
import { useAppState } from "@/hooks/useAppState";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { useRequireProfile } from "@/hooks/useRequireProfile";
import { appApi, type NatalChartPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

/** La ceremonia de recepción (día 1, una sola vez): la primera entrega del día 1
 *  post-onboarding es la carta natal — el activo por el que se paga — como momento
 *  full-screen propio, no como banner dentro de la Home (Figma App Core, sección
 *  "13 · Primer día · doble entrega", frame 679:2).
 *
 *  El headline es EL DATO (fecha, hora, lugar): la autoridad sale de la
 *  especificidad. La salida principal depende del plan REAL: con Plus,
 *  "ENTRAR A MI CARTA" abre el tab Carta (que explica QUÉ ES la primera vez);
 *  con Free, "DESBLOQUEAR MI CARTA NATAL" va directo a `/paywall` —la carta
 *  parcial en el medio se leía como algo roto, no como una oferta. "VER
 *  DESPUÉS" deja al usuario en la Home, donde la segunda entrega (el tarot
 *  diario) se explica en su lugar de trabajo.
 */

export default function RecepcionScreen() {
  const { isReady, profile } = useRequireProfile();
  const fontsLoaded = useOrbitaFonts();
  const insets = useSafeAreaInsets();
  // La tríada real llega del onboarding (calculada sin login vía previewDailyHome):
  // no dependemos de que la carta ya esté persistida en Convex.
  const { sol, luna, asc } = useLocalSearchParams<{ sol?: string; luna?: string; asc?: string }>();

  const { isLive, auth, isAuthLoading } = useLiveApp();
  const chartDoc = useQuery(appApi.charts.current, isLive ? {} : "skip");
  // La rueda exige datos natales remotos completos Y una carta que corresponda a
  // esos datos (ver `domain/natalChartGate`): recién salido del onboarding, la
  // carta puede estar todavía calculándose.
  const remoteBirth = useQuery(appApi.birthData.getCurrent, isLive ? {} : "skip");
  const chartGate = personalChartGate({ birth: remoteBirth, chart: chartDoc });
  // La salida la decide el entitlement AUTORITATIVO, no una suposición del
  // cliente: Free va derecho a la paywall (la carta parcial en el medio se leía
  // como un error, no como una oferta) y Plus entra a su carta. Mientras la
  // query está en vuelo el botón espera: nunca se afirma que la cuenta es Free.
  const rawEntitlement = useQuery(appApi.subscriptions.getCurrent, isLive ? {} : "skip");
  // Y se correlaciona con el dueño: la query conserva su último valor mientras
  // la nueva resuelve, así que el plan de A podía decidir el CTA de B —mandando
  // a la paywall a alguien que ya pagó, o al revés—. `undefined` = esperando.
  const entitlement = safeEntitlement(rawEntitlement, auth?.isSignedIn ? auth.userId ?? null : null);
  const cta = recepcionCta({
    entitlement,
    live: isLive,
    signedIn: !!auth?.isSignedIn,
    // Mientras Clerk carga, `isSignedIn` es `false` por no saber: sin esta
    // señal el primer render de una cuenta con sesión se leía como "sin sesión".
    authLoading: isAuthLoading
  });

  useEffect(() => {
    void markFirstRun({ recepcionVista: true });
  }, []);

  if (!isReady || !profile || !fontsLoaded) {
    return <View style={styles.screen} />;
  }

  // La rueda: SOLO la real (con sesión, apenas el backend la tenga). Acá no va la
  // demo ni para invitados: el headline y la tríada son datos reales del usuario,
  // y una rueda ajena al lado los desmiente (feedback Lucas 2026-07-15). Mientras
  // no hay carta, el espacio queda en el fondo estelar.
  let payload: NatalChartPayload | null = null;
  if (isLive && chartDoc && chartGate === "listo") {
    try {
      payload = mapNatalChart(chartDoc);
    } catch {
      payload = null;
    }
  }

  // La tríada por unidades enteras (glifo + signo) para que el wrap con nombres
  // largos parta entre unidades y no entre el glifo y su signo.
  const candidatos: Array<TriadLineUnit | null> =
    sol || luna || asc
      ? [
          sol ? { symbol: "sun", label: sol } : null,
          luna ? { symbol: "moon", label: luna } : null,
          asc ? { symbol: "ascendant", label: asc } : null
        ]
      : payload
        ? [
            { symbol: "sun", label: payload.triad.sun.sign },
            { symbol: "moon", label: payload.triad.moon.sign },
            { symbol: "ascendant", label: payload.triad.ascendant.sign }
          ]
        : [];
  const triadItems = candidatos.filter((t): t is TriadLineUnit => t !== null);

  // Solo la ciudad: el label completo del geocoding ("Buenos Aires, Ciudad Autónoma
  // de Buenos Aires, Argentina") vuelve el headline un párrafo.
  const lugar = profile.birthPlace?.split(",")[0]?.trim();
  const partes = [fechaLarga(profile.birthDate), profile.birthTime, lugar]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={styles.screen}>
      <HomeBackdrop />
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + orbita.spacing.xxl,
          paddingBottom: insets.bottom + orbita.spacing.xxl
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Las gutters van DENTRO del lienzo, como en el resto de la app: así
            la columna mide lo mismo acá que en la Carta o en la Home. */}
        <ContentCanvas>
        <View style={styles.content}>
        {/* El lado sale del contenedor medido, nunca del ancho de la ventana.
            El inset conserva el aire lateral que tenía la recepción. */}
        <View style={styles.wheelWrap}>
          <MeasuredSquare max={260} inset={orbita.spacing.gutter * 3}>
            {(size) => (payload ? <NatalWheel payload={payload} size={size} /> : null)}
          </MeasuredSquare>
        </View>

        {triadItems.length ? (
          <TriadLine
            units={triadItems}
            textStyle={styles.triad}
            glyphColor={orbita.colors.muted}
            glyphSize={13}
            gap={12}
            centered
            style={styles.triadRow}
          />
        ) : null}

        <Text style={styles.eyebrow}>TU CARTA NATAL</Text>
        <Text style={styles.headline}>{`El cielo del ${partes}.`}</Text>
        <Text style={styles.body}>
          De ese momento salen tu Sol, tu Luna y tu ascendente. No cambia nunca: todo lo que Órbita te lea se lee
          sobre esta carta.
        </Text>
        {!profile.birthTime ? (
          <Text style={styles.note}>Calculada sin hora exacta: el ascendente y las casas son aproximados.</Text>
        ) : null}

        {/* Un solo botón principal, con tres estados. Mientras el plan carga
            queda inhabilitado: no manda a la carta ni a la paywall antes de
            saber cuál corresponde. */}
        <Pressable
          onPress={() => {
            if (cta === "cargando") return;
            router.replace(cta === "desbloquear" ? "/paywall" : "/(tabs)/carta");
          }}
          accessibilityRole="button"
          accessibilityState={{ disabled: cta === "cargando" }}
          disabled={cta === "cargando"}
          style={[styles.cta, cta === "cargando" && styles.ctaOff]}
        >
          <Text style={styles.ctaLabel}>
            {cta === "cargando"
              ? "UN MOMENTO…"
              : cta === "desbloquear"
                ? "DESBLOQUEAR MI CARTA NATAL"
                : "ENTRAR A MI CARTA"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace(HOME_ROUTE as never)}
          accessibilityRole="button"
          hitSlop={12}
          style={styles.later}
        >
          <Text style={styles.laterLabel}>VER DESPUÉS</Text>
        </Pressable>
        </View>
        </ContentCanvas>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#07080A", flex: 1 },
  // Flujo natural (sin centrado vertical): con textos largos el centrado aplastaba
  // el bloque del CTA contra el borde inferior y los elementos se encimaban.
  content: { paddingHorizontal: orbita.spacing.gutter },
  wheelWrap: { alignItems: "center", justifyContent: "center", marginBottom: orbita.spacing.lg, marginTop: orbita.spacing.md },
  triadRow: { marginBottom: orbita.spacing.xxl },
  triad: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 0.5
  },
  eyebrow: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 1.5
  },
  headline: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.serif,
    fontSize: 30,
    lineHeight: 37,
    marginTop: orbita.spacing.md
  },
  body: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: orbita.spacing.lg
  },
  note: {
    color: orbita.colors.mutedDim,
    fontFamily: orbita.fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: orbita.spacing.md
  },
  cta: {
    alignItems: "center",
    backgroundColor: orbita.colors.bone,
    borderRadius: orbita.radius.lg,
    marginTop: orbita.spacing.xxl,
    paddingVertical: orbita.spacing.lg
  },
  ctaOff: { opacity: 0.5 },
  ctaLabel: { color: "#1A1A1A", fontFamily: orbita.fonts.monoMedium, fontSize: 13, letterSpacing: 1 },
  later: { alignItems: "center", marginTop: orbita.spacing.xl },
  laterLabel: {
    color: orbita.colors.mutedDim,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 1.5
  },
  pressed: { opacity: 0.7 }
});
