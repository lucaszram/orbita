import { ComponentType } from "react";
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { ArrowRight, Check, Orbit } from "lucide-react-native";
import { ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { webAssets } from "@/content/webAssets";
import { backendConfig } from "@/services/backendProviders";
import { useOrbitaAuth } from "@/hooks/useOrbitaAuth";

const colors = {
  black: "#07080A",
  copper: "#C46A3A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)",
  boneDim: "rgba(244, 238, 228, 0.5)",
  line: "rgba(214, 154, 106, 0.24)",
  panel: "rgba(12, 13, 17, 0.82)"
};

export function OrbitaLogin() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_700Bold, Newsreader_500Medium });
  if (!fontsLoaded) {
    return <View style={styles.center}><ActivityIndicator color={colors.copperSoft} /></View>;
  }
  if (!backendConfig.isConfigured) {
    return (
      <Shell>
        <Text style={styles.title}>Login no configurado</Text>
        <Text style={styles.body}>
          Falta `EXPO_PUBLIC_CONVEX_URL` y/o `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. La web sigue andando en modo demo.
        </Text>
        <HomeLink label="Ir a la demo" />
      </Shell>
    );
  }
  return <LoginGate />;
}

function LoginGate() {
  const { isLoaded, isSignedIn, isAuthenticated, isConnecting, email, signOut } = useOrbitaAuth();

  if (!isLoaded) {
    return <Shell><ActivityIndicator color={colors.copperSoft} /><Text style={styles.body}>Cargando sesión…</Text></Shell>;
  }
  if (!isSignedIn) {
    return <SignInPanel />;
  }
  if (isConnecting) {
    return <Shell><ActivityIndicator color={colors.copperSoft} /><Text style={styles.body}>Conectando con Órbita…</Text></Shell>;
  }
  return (
    <Shell>
      <View style={styles.okBadge}><Check color={colors.black} size={22} strokeWidth={2.4} /></View>
      <Text style={styles.title}>{isAuthenticated ? "Sesión iniciada" : "Casi listo"}</Text>
      <Text style={styles.body}>
        {isAuthenticated
          ? `Estás dentro como ${email ?? "tu cuenta"}. Tu carta y tu día ya son tuyos.`
          : `Clerk tiene tu sesión (${email ?? "tu cuenta"}), pero Convex todavía no confirmó identidad. Probá de nuevo en un momento.`}
      </Text>
      <HomeLink label="Ir a mi día" />
      <Pressable onPress={signOut} style={styles.linkBtn}><Text style={styles.linkBtnText}>Cerrar sesión</Text></Pressable>
    </Shell>
  );
}

function SignInPanel() {
  const { SignIn } = require("@clerk/expo/web") as { SignIn: ComponentType<Record<string, unknown>> };
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.authWrap} showsVerticalScrollIndicator={false}>
      <ImageBackground source={webAssets.heroOrbital.require} resizeMode="cover" style={styles.authPanel} imageStyle={styles.authPanelImage}>
        <LinearGradient colors={["rgba(7,8,10,0.55)", "rgba(7,8,10,0.9)"]} style={styles.authOverlay}>
          <View style={styles.brand}><Orbit color={colors.copperSoft} size={20} strokeWidth={1.7} /><Text style={styles.brandText}>Órbita</Text></View>
          <Text style={styles.authTitle}>Entrá a tu cielo.</Text>
          <Text style={styles.body}>Guardá tu carta, tus lecturas y tus tránsitos en tu cuenta.</Text>
          <View style={styles.clerkPanel}>
            <SignIn
              fallbackRedirectUrl="/home"
              forceRedirectUrl="/home"
              routing="hash"
              signUpFallbackRedirectUrl="/home"
              signUpForceRedirectUrl="/home"
            />
          </View>
          <HomeLink label="Seguir en modo demo" subtle />
        </LinearGradient>
      </ImageBackground>
    </ScrollView>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.page}>
      <View style={styles.center}>
        <View style={styles.panel}>{children}</View>
      </View>
    </View>
  );
}

function HomeLink({ label, subtle }: { label: string; subtle?: boolean }) {
  return (
    <Link href="/home" asChild>
      <Pressable style={StyleSheet.flatten([styles.cta, subtle && styles.ctaSubtle])}>
        <Text style={[styles.ctaText, subtle && styles.ctaTextSubtle]}>{label}</Text>
        <ArrowRight color={subtle ? colors.bone : colors.black} size={17} strokeWidth={2.1} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.black, flex: 1 },
  center: { alignItems: "center", flex: 1, justifyContent: "center", padding: 24 },
  panel: { alignItems: "flex-start", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, maxWidth: 460, padding: 30, width: "100%" },
  title: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 30, lineHeight: 36 },
  body: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 16, lineHeight: 24 },
  okBadge: { alignItems: "center", backgroundColor: colors.copperSoft, borderRadius: 22, height: 44, justifyContent: "center", width: 44 },

  authWrap: { flexGrow: 1, justifyContent: "center", minHeight: "100%", padding: 24 },
  authPanel: { alignSelf: "center", borderRadius: 20, maxWidth: 520, overflow: "hidden", width: "100%" },
  authPanelImage: { borderRadius: 20, opacity: 0.9 },
  authOverlay: { gap: 14, padding: 32 },
  brand: { alignItems: "center", flexDirection: "row", gap: 8 },
  brandText: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 16 },
  authTitle: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 38, lineHeight: 44, marginTop: 4 },
  clerkPanel: { backgroundColor: "rgba(244,238,228,0.02)", borderRadius: 12, marginTop: 8 },

  cta: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.bone, borderRadius: 9, flexDirection: "row", gap: 9, marginTop: 6, paddingHorizontal: 18, paddingVertical: 13 },
  ctaSubtle: { backgroundColor: "transparent", borderColor: colors.line, borderWidth: 1 },
  ctaText: { color: colors.black, fontFamily: "Inter_700Bold", fontSize: 14 },
  ctaTextSubtle: { color: colors.bone },
  linkBtn: { paddingVertical: 6 },
  linkBtnText: { color: colors.boneDim, fontFamily: "Inter_500Medium", fontSize: 14, textDecorationLine: "underline" }
});

export default OrbitaLogin;
