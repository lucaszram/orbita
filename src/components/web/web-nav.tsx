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

/** Debajo de esto no entra la navegación completa arriba. */
export const WEB_NAV_BREAKPOINT = 900;
/** Alto de la barra inferior + respiro; los ScrollView reservan este espacio. */
export const WEB_BOTTOM_NAV_HEIGHT = 64;

export function WebNav({ active, meta }: { active: NavKey; meta?: string }) {
  const { width } = useWindowDimensions();
  const isNarrow = width < WEB_NAV_BREAKPOINT;
  return (
    <>
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
                <Pressable style={styles.navItem}>
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

      {/* En móvil la navegación superior no entra. Antes simplemente se ocultaba
          y no quedaba NINGÚN modo de moverse entre secciones: la web era
          inusable en teléfono. Ahora baja a una barra fija, como en el nativo. */}
      {isNarrow ? <WebBottomNav active={active} /> : null}
    </>
  );
}

function WebBottomNav({ active }: { active: NavKey }) {
  return (
    <View style={styles.bottombar}>
      {items.map((it) => (
        <Link key={it.key} href={it.href as never} asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityState={{ selected: active === it.key }}
            style={styles.bottomItem}
          >
            <Text style={active === it.key ? styles.bottomActive : styles.bottomLink}>{it.label}</Text>
          </Pressable>
        </Link>
      ))}
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
  // 44px de alto mínimo: es el tamaño táctil accesible, y en desktop no cambia
  // nada visualmente porque el texto queda centrado.
  navItem: { justifyContent: "center", minHeight: 44 },
  navActive: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 14 },
  navLink: { color: colors.boneDim, fontFamily: "Inter_500Medium", fontSize: 14 },

  bottombar: {
    // `fixed` es de react-native-web: la barra queda pegada al viewport aunque
    // se renderice dentro del ScrollView de cada pantalla.
    position: "fixed" as unknown as "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "rgba(7,8,10,0.96)",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    // Área segura del iPhone (barra de gestos de Safari).
    paddingBottom: "env(safe-area-inset-bottom)" as unknown as number,
    zIndex: 50
  },
  bottomItem: { alignItems: "center", flex: 1, justifyContent: "center", minHeight: 56, paddingVertical: 10 },
  bottomActive: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 13 },
  bottomLink: { color: colors.boneDim, fontFamily: "Inter_500Medium", fontSize: 13 },
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
