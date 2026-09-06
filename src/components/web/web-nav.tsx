import { Link } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { PlanBadge } from "@/components/web/plan-badge";
import { CANVAS_MAX_WIDTH, WEB_SHELL_BACKGROUND } from "@/domain/webLayout";
import { useIsDesktop } from "@/hooks/useLayoutMode";

const colors = {
  shell: WEB_SHELL_BACKGROUND,
  copper: "#C46A3A",
  bone: "#F4EEE4",
  // 0.72 y no 0.5: sobre el negro del shell, el 0.5 de antes quedaba al borde de
  // lo ilegible en los links inactivos.
  boneMuted: "rgba(244, 238, 228, 0.72)",
  boneDim: "rgba(244, 238, 228, 0.5)",
  line: "rgba(244, 238, 228, 0.12)"
};

/**
 * El ícono REAL de la app (la misma arte que se firma en iOS), no un glifo
 * genérico de librería. Antes acá había un `Orbit` de lucide: un anillo dibujado
 * que no es la marca y que en la barra leía como un ícono de sistema.
 *
 * Se importa el derivado web, no `assets/icon.png`. El original es el master de
 * 1024px que declara `app.json` y pesa 1,72 MB: montarlo acá lo metía tal cual
 * en el export web para dibujarlo a 28px. El derivado es el mismo arte a 192px
 * (61 KB), que a 28 sigue bajando limpio hasta 6x de densidad. El ícono nativo
 * no se toca.
 */
const APP_ICON = require("../../../assets/orbita/optimized/brand/orbita_app_icon_web.png");

export type NavKey = "inicio" | "transitos" | "vinculo" | "umbral" | "carta" | "perfil" | "diario";

/**
 * Las CINCO secciones de la web, en este orden: Hoy · Tránsitos · Vínculos ·
 * Umbral · Carta.
 *
 * No copian la barra nativa (`app/(tabs)/_layout.tsx`), que responde a otras
 * restricciones: ahí Vínculo está parkeado (`href: null`) y Perfil es pestaña.
 * En web Vínculo ya tiene una ruta que se puede abrir, y Perfil dejó de ser
 * sección: se entra desde el cierre de la Carta (`src/screens/CartaScreen.tsx`)
 * y el layout marca Carta cuando la ruta es `/perfil`.
 *
 * La clave de la primera sección sigue siendo `inicio` porque es la que declaran
 * las rutas web que montan el shell por su cuenta (`app/home.tsx`); la etiqueta
 * aprobada es «Hoy». `perfil` y `diario` siguen en `NavKey` sin item: son
 * destinos contextuales que un shell puede pasar como activo (`app/diario.tsx`).
 */
/** El atajo de cuenta de la cabecera. No es una sección: no entra en `items`. */
const CUENTA_HREF = "/perfil";

const items: Array<{ key: NavKey; label: string; href: string }> = [
  { key: "inicio", label: "Hoy", href: "/home" },
  { key: "transitos", label: "Tránsitos", href: "/transito" },
  { key: "vinculo", label: "Vínculos", href: "/vinculo" },
  { key: "umbral", label: "Umbral", href: "/umbral" },
  { key: "carta", label: "Carta", href: "/carta" }
];

/**
 * Navegación de la APP autenticada (`Web/Nav · Desktop` del tablero `1308:2`,
 * CORE-239): la marca con la píldora de plan a la izquierda, las cinco
 * secciones en mono al centro-derecha y el atajo `PERFIL` a `/perfil` en el
 * extremo. No lleva botón de entrar ni ninguna salida al login: la cuenta
 * sigue viviendo en `/perfil`, y Perfil sigue sin ser una sección.
 *
 * En escritorio es una barra OPACA sobre el negro del shell, alineada al mismo
 * lienzo ancho que el contenido. Antes no tenía fondo: se veía el blanco del
 * documento y los links quedaban en cobre sobre blanco, prácticamente
 * invisibles. En móvil no hay barra superior: sólo la inferior fija, como en el
 * nativo; la barra móvil con la fecha la pone cada pantalla (`TopBar`).
 */
export function WebNav({ active, meta }: { active: NavKey; meta?: string }) {
  const desktop = useIsDesktop();

  if (!desktop) {
    // Sin topbar en móvil: duplicaba la marca sobre el header de la propia
    // pantalla y comía alto útil.
    return <WebBottomNav active={active} />;
  }

  return (
    <View style={styles.topbar}>
      <View style={styles.topbarInner}>
        <View style={styles.marca}>
          <Link href="/home" asChild>
            <Pressable style={styles.brand} accessibilityRole="link" accessibilityLabel="Órbita · Inicio">
              {/* Tratamiento de ícono de app: cuadrado redondeado chico con
                  hairline, como se ve en una barra de tareas. El derivado web es
                  de 192px, así que a 28 baja limpio en cualquier densidad. */}
              <View style={styles.markFrame}>
                <Image source={APP_ICON} style={styles.mark} resizeMode="cover" />
              </View>
              <Text style={styles.brandText}>Órbita</Text>
            </Pressable>
          </Link>
          <PlanBadge />
        </View>

        {/* La navegación va arriba a la DERECHA, como cualquier header web.
            Antes quedaba centrada por un `space-between` de tres celdas cuya
            tercera celda estaba siempre vacía: leía como un menú suelto en el
            medio de la barra. */}
        <View style={styles.actions}>
          <View style={styles.nav}>
            {items.map((it) => {
              const on = active === it.key;
              return (
                <Link key={it.key} href={it.href as never} asChild>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityState={{ selected: on }}
                    style={styles.navItem}
                  >
                    <Text style={on ? styles.navActive : styles.navLink}>{it.label}</Text>
                    {/* El estado activo no puede ser sólo un peso de fuente: se
                        perdía a simple vista. Subrayado cobre, como los tabs. */}
                    <View style={[styles.navUnderline, on && styles.navUnderlineOn]} />
                  </Pressable>
                </Link>
              );
            })}
          </View>
          {meta ? <Text style={styles.metaText}>{meta}</Text> : null}
          <Link href={CUENTA_HREF} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel="Perfil y cuenta" style={styles.perfil}>
              <View style={styles.perfilPunto} />
              <Text style={styles.perfilTexto}>PERFIL</Text>
            </Pressable>
          </Link>
        </View>
      </View>
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
    // Opaca: sin esto se veía el fondo blanco del documento detrás de la barra.
    backgroundColor: colors.shell,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    width: "100%"
  },
  // Alineada al MISMO lienzo ancho que el contenido: la marca queda a plomo con
  // el título de la pantalla, no pegada al borde de la ventana.
  topbarInner: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    maxWidth: CANVAS_MAX_WIDTH.wide,
    paddingHorizontal: 24,
    paddingVertical: 14,
    width: "100%"
  },
  marca: { alignItems: "center", flexDirection: "row", gap: 12 },
  brand: { alignItems: "center", flexDirection: "row", gap: 10, minHeight: 44 },
  // El ícono trae su propio fondo azul-noche, así que el marco redondeado lo
  // separa del negro del shell y lo hace leer como ícono, no como una foto.
  markFrame: {
    borderColor: "rgba(244, 238, 228, 0.18)",
    borderRadius: 7,
    borderWidth: 1,
    height: 28,
    overflow: "hidden",
    width: 28
  },
  mark: { height: 26, width: 26 },
  brandText: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 22 },
  // Grupo derecho del header: la navegación (y el meta si algún día se usa).
  actions: { alignItems: "center", flexDirection: "row", gap: 24 },
  nav: { flexDirection: "row", gap: 26 },
  // 44px de alto mínimo: es el tamaño táctil accesible, y en escritorio no
  // cambia nada visualmente porque el texto queda centrado.
  navItem: { alignItems: "center", justifyContent: "center", minHeight: 44 },
  // Las secciones van en mono, como el tablero: la marca serif y el resto mono.
  navActive: { color: colors.bone, fontFamily: "RobotoMono_500Medium", fontSize: 13, letterSpacing: 1 },
  navLink: { color: colors.boneMuted, fontFamily: "RobotoMono_400Regular", fontSize: 13, letterSpacing: 1 },
  navUnderline: { backgroundColor: "transparent", borderRadius: 1, height: 2, marginTop: 6, width: 20 },
  navUnderlineOn: { backgroundColor: colors.copper },

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
  // El atajo de cuenta: píldora de contorno con el punto cobre y PERFIL en mono.
  perfil: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 14
  },
  perfilPunto: { backgroundColor: colors.copper, borderRadius: 999, height: 18, width: 18 },
  perfilTexto: { color: colors.bone, fontFamily: "RobotoMono_500Medium", fontSize: 11, letterSpacing: 1.2 }
});

export default WebNav;
