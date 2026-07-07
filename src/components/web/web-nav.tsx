import { Link } from "expo-router";
import { Orbit } from "lucide-react-native";
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { backendConfig } from "@/services/backendProviders";
import { useOrbitaAuth } from "@/hooks/useOrbitaAuth";

const colors = {
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)",
  boneDim: "rgba(244, 238, 228, 0.5)",
  line: "rgba(214, 154, 106, 0.22)"
};

type NavKey = "hoy" | "carta" | "transitos" | "diario";

const items: Array<{ key: NavKey; label: string; href: string }> = [
  { key: "hoy", label: "Hoy", href: "/home" },
  { key: "carta", label: "Carta", href: "/carta" },
  { key: "transitos", label: "Tránsitos", href: "/transito" },
  { key: "diario", label: "Diario", href: "/diario" }
];

export function WebNav({ active, meta }: { active: NavKey; meta?: string }) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 900;
  return (
    <View style={[styles.topbar, { paddingHorizontal: isNarrow ? 20 : 40 }]}>
      <Link href="/home" asChild>
        <Pressable style={styles.brand}>
          <Orbit color={colors.copperSoft} size={18} strokeWidth={1.7} />
          <Text style={styles.brandText}>Órbita</Text>
        </Pressable>
      </Link>

      {!isNarrow && (
        <View style={styles.nav}>
          {items.map((it) => (
            <Link key={it.key} href={it.href as never} asChild>
              <Pressable>
                <Text style={active === it.key ? styles.navActive : styles.navLink}>{it.label}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      )}

      <View style={styles.right}>
        {meta && !isNarrow ? <Text style={styles.metaText}>{meta}</Text> : null}
        <AuthArea />
      </View>
    </View>
  );
}

function EnterButton() {
  return (
    <Link href="/login" asChild>
      <Pressable style={styles.enterBtn}>
        <Text style={styles.enterText}>Entrar</Text>
      </Pressable>
    </Link>
  );
}

function AuthArea() {
  // useOrbitaAuth requiere ClerkProvider montado → solo cuando hay Clerk configurado.
  if (!backendConfig.hasClerk) return <EnterButton />;
  return <AuthPill />;
}

function AuthPill() {
  const { isLoaded, isSignedIn, imageUrl, name, email } = useOrbitaAuth();
  if (!isLoaded) return <View style={styles.avatarSpinner} />;
  if (!isSignedIn) return <EnterButton />;
  const initial = (name || email || "?").trim().slice(0, 1).toUpperCase();
  return (
    <Link href="/login" asChild>
      <Pressable style={styles.avatarWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{initial}</Text></View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  topbar: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 20
  },
  brand: { alignItems: "center", flexDirection: "row", gap: 8 },
  brandText: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 16 },
  nav: { flexDirection: "row", gap: 26 },
  navActive: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 14 },
  navLink: { color: colors.boneDim, fontFamily: "Inter_500Medium", fontSize: 14 },
  metaText: { color: colors.boneMuted, fontFamily: "Inter_500Medium", fontSize: 13 },
  right: { alignItems: "center", flexDirection: "row", gap: 14 },
  enterBtn: { borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  enterText: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 13 },
  avatarSpinner: { backgroundColor: "rgba(244,238,228,0.08)", borderRadius: 16, height: 32, width: 32 },
  avatarWrap: { borderColor: colors.copperSoft, borderRadius: 17, borderWidth: 1, height: 34, overflow: "hidden", width: 34 },
  avatar: { height: "100%", width: "100%" },
  avatarFallback: { alignItems: "center", backgroundColor: "rgba(196,106,58,0.25)", flex: 1, justifyContent: "center" },
  avatarInitial: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 14 }
});

export default WebNav;
