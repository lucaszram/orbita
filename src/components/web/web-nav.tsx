import { Link } from "expo-router";
import { Orbit } from "lucide-react-native";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

const colors = {
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)",
  boneDim: "rgba(244, 238, 228, 0.5)",
  line: "rgba(214, 154, 106, 0.22)"
};

export type NavKey = "inicio" | "transitos" | "umbral" | "perfil" | "carta" | "diario";

/**
 * Misma arquitectura de información que el nativo (`app/(tabs)/_layout.tsx`):
 * Inicio · Tránsitos · Umbral · Perfil. La web tenía Hoy/Carta/Tránsitos/Diario,
 * que omitía el Umbral y promovía dos destinos secundarios a sección principal.
 * Carta y Diario siguen siendo destinos contextuales, no secciones.
 */
const items: Array<{ key: NavKey; label: string; href: string }> = [
  { key: "inicio", label: "Inicio", href: "/home" },
  { key: "transitos", label: "Tránsitos", href: "/transito" },
  { key: "umbral", label: "Umbral", href: "/umbral" },
  { key: "perfil", label: "Perfil", href: "/perfil" }
];

/** Debajo de esto no entra la navegación completa arriba. */
export const WEB_NAV_BREAKPOINT = 900;
/** Alto de la barra inferior + respiro; los ScrollView reservan este espacio. */
export const WEB_BOTTOM_NAV_HEIGHT = 64;

/**
 * Navegación de la APP autenticada. No lleva avatar, botón de entrar ni atajo de
 * cuenta: todo lo de la cuenta vive en `/perfil`. Antes la barra tenía un avatar
 * que llevaba al login, así que una persona ya logueada veía un CTA de "Entrar".
 *
 * En móvil no hay barra superior: sólo la inferior fija, como en el nativo.
 */
export function WebNav({ active, meta }: { active: NavKey; meta?: string }) {
  const { width } = useWindowDimensions();
  const isNarrow = width < WEB_NAV_BREAKPOINT;

  if (isNarrow) {
    // Sin topbar en móvil: duplicaba la marca sobre el header de la propia
    // pantalla y comía alto útil.
    return <WebBottomNav active={active} />;
  }

  return (
    <View style={[styles.topbar, { paddingHorizontal: 40 }]}>
      <Link href="/home" asChild>
        <Pressable style={styles.brand}>
          <Orbit color={colors.copperSoft} size={18} strokeWidth={1.7} />
          <Text style={styles.brandText}>Órbita</Text>
        </Pressable>
      </Link>

      <View style={styles.nav}>
        {items.map((it) => (
          <Link key={it.key} href={it.href as never} asChild>
            <Pressable style={styles.navItem}>
              <Text style={active === it.key ? styles.navActive : styles.navLink}>{it.label}</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      <View style={styles.right}>{meta ? <Text style={styles.metaText}>{meta}</Text> : null}</View>
    </View>
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
});

export default WebNav;
