import { ComponentType } from "react";
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_400Regular, Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { ArrowRight, LockKeyhole, Orbit, ShieldCheck, Sparkles } from "lucide-react-native";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { webAssets, webAssetSequence, WebAssetSlot } from "@/content/webAssets";

const colors = {
  black: "#07080A",
  charcoal: "#0D0E12",
  charcoal2: "#14161A",
  copper: "#C46A3A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)",
  line: "rgba(214, 154, 106, 0.25)",
  panel: "rgba(15, 17, 22, 0.76)"
};

type IconComponent = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

const dailyModules = [
  ["Frase del día", "Una línea para entrar al día con menos ruido."],
  ["Hacé", "Tres gestos concretos para acompañar el clima simbólico."],
  ["Evitá", "Tres fricciones posibles, escritas sin dramatismo."],
  ["Temas", "Amor, trabajo, familia y vínculos con lectura propia."],
  ["Deep Dive", "Una pieza editorial para mirar el tránsito con más contexto."]
];

const featureTiles = [
  {
    title: "Carta base",
    body: "Fecha, lugar y hora como punto de partida para una lectura personal.",
    asset: webAssets.natalChart
  },
  {
    title: "Tránsitos",
    body: "El día leído contra tu carta, con prioridad editorial y límites claros.",
    asset: webAssets.transits
  },
  {
    title: "Ritmo diario",
    body: "Hacé, evitá, acción y pregunta: breve, concreto, revisable.",
    asset: webAssets.dailyTexture
  }
];

export function OrbitaLanding() {
  const { width } = useWindowDimensions();
  const isNarrow = width < 760;
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Newsreader_400Regular,
    Newsreader_500Medium
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.copperSoft} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <ImageBackground
        accessibilityLabel={webAssets.heroOrbital.alt}
        imageStyle={styles.heroImage}
        resizeMode="cover"
        source={webAssets.heroOrbital.require}
        style={[styles.hero, isNarrow ? styles.heroNarrow : styles.heroWide]}
      >
        <LinearGradient colors={["rgba(7,8,10,0.26)", "rgba(7,8,10,0.78)", "#07080A"]} style={styles.heroOverlay}>
          <View style={styles.nav}>
            <View style={styles.brandMark}>
              <Orbit color={colors.copperSoft} size={18} strokeWidth={1.7} />
              <Text selectable style={styles.brandText}>Órbita</Text>
            </View>
            <View style={[styles.navActions, isNarrow && styles.navActionsNarrow]}>
              <Link href="/studio" asChild>
                <Pressable style={styles.navLink}>
                  <LockKeyhole color={colors.boneMuted} size={15} strokeWidth={1.8} />
                  <Text selectable style={styles.navLinkText}>Studio</Text>
                </Pressable>
              </Link>
            </View>
          </View>

          <View style={[styles.heroCopy, isNarrow && styles.heroCopyNarrow]}>
            <Text selectable style={styles.eyebrow}>Tu astróloga personal</Text>
            <Text selectable style={[styles.heroTitle, isNarrow && styles.heroTitleNarrow]}>Órbita</Text>
            <Text selectable style={[styles.heroSubtitle, isNarrow && styles.heroSubtitleNarrow]}>
              Tu día con contexto astrológico. Carta natal, tránsitos y guía diaria con tono editorial, sin promesas raras.
            </Text>
            <View style={[styles.ctaRow, isNarrow && styles.ctaRowNarrow]}>
              <WebLinkButton href="/onboarding" icon={ArrowRight} label="Empezar" />
              <WebLinkButton href="/studio" icon={LockKeyhole} label="Entrar al Studio" variant="secondary" />
            </View>
          </View>

          <View style={[styles.heroStats, isNarrow && styles.heroStatsNarrow]}>
            <MiniStat label="Base" value="Carta natal" />
            <MiniStat label="Hoy" value="Tránsitos" />
            <MiniStat label="Modo" value="Editorial" />
          </View>
        </LinearGradient>
      </ImageBackground>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text selectable style={styles.eyebrow}>La experiencia</Text>
          <Text selectable style={[styles.sectionTitle, isNarrow && styles.sectionTitleNarrow]}>
            Un producto oscuro, sobrio y personal.
          </Text>
        </View>
        <View style={[styles.featureGrid, isNarrow && styles.stack]}>
          {featureTiles.map((tile) => (
            <FeatureTile key={tile.title} asset={tile.asset} body={tile.body} title={tile.title} />
          ))}
        </View>
      </View>

      <ImageBackground
        accessibilityLabel={webAssets.dailyTexture.alt}
        imageStyle={styles.dailyImage}
        resizeMode="cover"
        source={webAssets.dailyTexture.require}
        style={styles.dailyBand}
      >
        <LinearGradient colors={["rgba(7,8,10,0.92)", "rgba(7,8,10,0.68)", "rgba(7,8,10,0.96)"]} style={styles.dailyOverlay}>
          <View style={[styles.dailyLayout, isNarrow && styles.stack]}>
            <View style={styles.dailyCopy}>
              <Text selectable style={styles.eyebrow}>Home diaria</Text>
              <Text selectable style={[styles.sectionTitle, isNarrow && styles.sectionTitleNarrow]}>
                El backend devuelve texto editable. La pantalla lo vuelve ritmo.
              </Text>
              <Text selectable style={styles.body}>
                Cada módulo nace de carta, fecha local y revisión editorial de Órbita. La lectura se mantiene como entretenimiento,
                autoconocimiento y contexto.
              </Text>
            </View>
            <View style={styles.moduleTable}>
              {dailyModules.map(([label, value]) => (
                <View key={label} style={styles.moduleRow}>
                  <Text selectable style={styles.moduleLabel}>{label}</Text>
                  <Text selectable style={styles.moduleValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>

      <View style={styles.section}>
        <View style={[styles.studioPreview, isNarrow && styles.stack]}>
          <ImageBackground
            accessibilityLabel={webAssets.studioBackplate.alt}
            imageStyle={styles.studioPreviewImage}
            resizeMode="cover"
            source={webAssets.studioBackplate.require}
            style={styles.studioVisual}
          >
            <LinearGradient colors={["rgba(7,8,10,0.2)", "rgba(7,8,10,0.82)"]} style={styles.studioVisualOverlay}>
              <View style={styles.dropMini}>
                <Sparkles color={colors.copperSoft} size={18} strokeWidth={1.6} />
                <Text selectable style={styles.dropMiniTitle}>video-daily-cut.mp4</Text>
                <Text selectable style={styles.dropMiniMeta}>draft / review / published</Text>
              </View>
            </LinearGradient>
          </ImageBackground>
          <View style={styles.studioCopy}>
            <Text selectable style={styles.eyebrow}>Studio V0</Text>
            <Text selectable style={[styles.sectionTitle, isNarrow && styles.sectionTitleNarrow]}>
              Un lugar para probar material sin ensuciar producción.
            </Text>
            <Text selectable style={styles.body}>
              El primer Studio es visual: drop de videos, metadata local, estados editoriales y acceso protegido. Cuando el flujo
              cierre, se conecta storage real.
            </Text>
            <Link href="/studio" asChild>
              <Pressable style={styles.inlineButton}>
                <ShieldCheck color={colors.black} size={17} strokeWidth={2} />
                <Text selectable style={styles.inlineButtonText}>Abrir Studio</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>

      <View style={styles.assetStrip}>
        {webAssetSequence.slice(5).map((asset) => (
          <View key={asset.key} style={styles.assetThumbWrap}>
            <Image accessibilityLabel={asset.alt} resizeMode="cover" source={asset.require} style={styles.assetThumb} />
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text selectable style={styles.footerBrand}>Órbita</Text>
        <Text selectable style={styles.footerText}>Entretenimiento, autoconocimiento y contexto diario.</Text>
      </View>
    </ScrollView>
  );
}

function WebLinkButton({
  href,
  icon: Icon,
  label,
  variant = "primary"
}: {
  href: "/onboarding" | "/studio";
  icon: IconComponent;
  label: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link href={href} asChild>
      <Pressable style={[styles.ctaButton, variant === "secondary" && styles.ctaButtonSecondary]}>
        <Text selectable style={[styles.ctaText, variant === "secondary" && styles.ctaTextSecondary]}>{label}</Text>
        <Icon color={variant === "secondary" ? colors.bone : colors.black} size={17} strokeWidth={2} />
      </Pressable>
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text selectable style={styles.miniStatLabel}>{label}</Text>
      <Text selectable style={styles.miniStatValue}>{value}</Text>
    </View>
  );
}

function FeatureTile({ asset, body, title }: { asset: WebAssetSlot; body: string; title: string }) {
  return (
    <View style={styles.featureTile}>
      <ImageBackground
        accessibilityLabel={asset.alt}
        imageStyle={styles.featureImage}
        resizeMode="cover"
        source={asset.require}
        style={styles.featureMedia}
      >
        <LinearGradient colors={["rgba(7,8,10,0.04)", "rgba(7,8,10,0.68)"]} style={styles.featureMediaOverlay} />
      </ImageBackground>
      <View style={styles.featureCopy}>
        <Text selectable style={styles.featureTitle}>{title}</Text>
        <Text selectable style={styles.featureBody}>{body}</Text>
      </View>
    </View>
  );
}

export default OrbitaLanding;

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: colors.black,
    flex: 1,
    justifyContent: "center"
  },
  page: {
    backgroundColor: colors.black,
    flex: 1
  },
  pageContent: {
    backgroundColor: colors.black
  },
  hero: {
    backgroundColor: colors.black,
    width: "100%"
  },
  heroWide: {
    minHeight: 720
  },
  heroNarrow: {
    minHeight: 690
  },
  heroImage: {
    opacity: 0.92
  },
  heroOverlay: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 24
  },
  nav: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%"
  },
  brandMark: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  brandText: {
    color: colors.bone,
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    letterSpacing: 0
  },
  navActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  navActionsNarrow: {
    gap: 6
  },
  navLink: {
    alignItems: "center",
    borderColor: "rgba(244, 238, 228, 0.18)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  navLinkText: {
    color: colors.boneMuted,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    letterSpacing: 0
  },
  heroCopy: {
    gap: 18,
    maxWidth: 760,
    paddingBottom: 18
  },
  heroCopyNarrow: {
    gap: 14,
    paddingBottom: 0
  },
  eyebrow: {
    color: colors.copperSoft,
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  heroTitle: {
    color: colors.bone,
    fontFamily: "Newsreader_500Medium",
    fontSize: 112,
    letterSpacing: 0,
    lineHeight: 112
  },
  heroTitleNarrow: {
    fontSize: 72,
    lineHeight: 76
  },
  heroSubtitle: {
    color: colors.bone,
    fontFamily: "Inter_400Regular",
    fontSize: 22,
    lineHeight: 32,
    maxWidth: 660
  },
  heroSubtitleNarrow: {
    fontSize: 18,
    lineHeight: 27
  },
  ctaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  ctaRowNarrow: {
    alignItems: "stretch"
  },
  ctaButton: {
    alignItems: "center",
    backgroundColor: colors.bone,
    borderRadius: 8,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 18
  },
  ctaButtonSecondary: {
    backgroundColor: "rgba(244, 238, 228, 0.08)",
    borderColor: "rgba(244, 238, 228, 0.18)",
    borderWidth: 1
  },
  ctaText: {
    color: colors.black,
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    letterSpacing: 0
  },
  ctaTextSecondary: {
    color: colors.bone
  },
  heroStats: {
    borderColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 32,
    paddingTop: 18
  },
  heroStatsNarrow: {
    justifyContent: "space-between",
    gap: 8
  },
  miniStat: {
    gap: 4
  },
  miniStatLabel: {
    color: colors.copperSoft,
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  miniStatValue: {
    color: colors.bone,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    letterSpacing: 0
  },
  section: {
    alignSelf: "center",
    gap: 32,
    maxWidth: 1180,
    paddingHorizontal: 24,
    paddingVertical: 76,
    width: "100%"
  },
  sectionHeader: {
    gap: 12,
    maxWidth: 720
  },
  sectionTitle: {
    color: colors.bone,
    fontFamily: "Newsreader_500Medium",
    fontSize: 48,
    letterSpacing: 0,
    lineHeight: 54
  },
  sectionTitleNarrow: {
    fontSize: 34,
    lineHeight: 40
  },
  featureGrid: {
    flexDirection: "row",
    gap: 14
  },
  stack: {
    flexDirection: "column"
  },
  featureTile: {
    backgroundColor: colors.panel,
    borderColor: "rgba(244, 238, 228, 0.1)",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 390,
    overflow: "hidden"
  },
  featureMedia: {
    flex: 1,
    minHeight: 250
  },
  featureImage: {
    opacity: 0.92
  },
  featureMediaOverlay: {
    flex: 1
  },
  featureCopy: {
    gap: 8,
    padding: 18
  },
  featureTitle: {
    color: colors.bone,
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    letterSpacing: 0,
    lineHeight: 22
  },
  featureBody: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21
  },
  dailyBand: {
    backgroundColor: colors.black,
    minHeight: 560,
    width: "100%"
  },
  dailyImage: {
    opacity: 0.78
  },
  dailyOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 82
  },
  dailyLayout: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 42,
    maxWidth: 1180,
    width: "100%"
  },
  dailyCopy: {
    flex: 1,
    gap: 16
  },
  body: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 25
  },
  moduleTable: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    overflow: "hidden"
  },
  moduleRow: {
    borderBottomColor: "rgba(244, 238, 228, 0.1)",
    borderBottomWidth: 1,
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 16
  },
  moduleLabel: {
    color: colors.copperSoft,
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  moduleValue: {
    color: colors.bone,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22
  },
  studioPreview: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: 18
  },
  studioVisual: {
    borderRadius: 8,
    flex: 1,
    minHeight: 430,
    overflow: "hidden"
  },
  studioPreviewImage: {
    opacity: 0.92
  },
  studioVisualOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 18
  },
  dropMini: {
    backgroundColor: "rgba(7, 8, 10, 0.74)",
    borderColor: "rgba(214, 154, 106, 0.28)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 16
  },
  dropMiniTitle: {
    color: colors.bone,
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    letterSpacing: 0
  },
  dropMiniMeta: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    letterSpacing: 0
  },
  studioCopy: {
    flex: 1,
    gap: 16,
    justifyContent: "center"
  },
  inlineButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.copperSoft,
    borderRadius: 8,
    flexDirection: "row",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 16
  },
  inlineButtonText: {
    color: colors.black,
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    letterSpacing: 0
  },
  assetStrip: {
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    maxWidth: 1180,
    paddingHorizontal: 24,
    paddingBottom: 48,
    width: "100%"
  },
  assetThumbWrap: {
    borderColor: "rgba(214, 154, 106, 0.2)",
    borderRadius: 8,
    borderWidth: 1,
    height: 104,
    overflow: "hidden",
    width: 104
  },
  assetThumb: {
    height: "100%",
    width: "100%"
  },
  footer: {
    alignItems: "center",
    borderTopColor: "rgba(244, 238, 228, 0.08)",
    borderTopWidth: 1,
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 42
  },
  footerBrand: {
    color: colors.bone,
    fontFamily: "Newsreader_500Medium",
    fontSize: 28,
    letterSpacing: 0
  },
  footerText: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    letterSpacing: 0
  }
});
