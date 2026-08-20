import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AccountGate } from "@/components/orbita/AccountGate";
import { backendConfig } from "@/services/backendProviders";

/**
 * Variante NATIVA del módulo compartido de sesión.
 *
 * Existe por alcance, no por diseño: `require-session.tsx` es el archivo que la
 * web resuelve, y ahí `PlusLocked` enlaza a `/paywall`. Rutas compartidas como
 * `/crear-cuenta`, `/editar-datos` e `/iniciar-sesion` importan `WebLoading` de
 * este mismo módulo, así que ese enlace —y con él todo el comercio web— entraba
 * al bundle nativo aunque ninguna pantalla nativa lo renderizara. Con esta
 * variante, Metro resuelve `.native.tsx` al empaquetar para iOS/Android y el
 * árbol de compra deja de ser alcanzable.
 *
 * Las exportaciones son las MISMAS (`WebLoading`, `RequireSession`,
 * `WebNotice`, `PlusLocked`): quien importa no sabe en qué plataforma está.
 * Lo único que cambia es que acá no hay compra que ofrecer.
 */

const colors = {
  black: "#07080A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)",
  line: "rgba(214, 154, 106, 0.2)",
  panel: "rgba(11, 12, 15, 0.62)"
};

/** Spinner estable sobre fondo oscuro: el estado de carga compartido. */
export function WebLoading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.copperSoft} />
    </View>
  );
}

/**
 * Envuelve una ruta autenticada. Sin sesión redirige a login; nunca renderiza
 * contenido de demostración ni datos de otra persona. El destino lo decide el
 * MISMO resolver que en web: acá no hay una segunda regla de acceso.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  if (!backendConfig.isConfigured) {
    return (
      <WebNotice
        title="Órbita no está disponible"
        body="No pudimos conectar con el servidor. Volvé a intentar en un momento."
      />
    );
  }
  return (
    <AccountGate
      surface="app"
      loading={<WebLoading />}
      error={(retry) => (
        <WebNotice
          title="No pudimos abrir tu cuenta"
          body="La sesión quedó a medias. Reintentá; si sigue, cerrá sesión y volvé a entrar."
          action={{ label: "Reintentar", onPress: retry }}
        />
      )}
    >
      {children}
    </AccountGate>
  );
}

/**
 * Estado honesto compartido: vacío o error, con reintento opcional. Existe
 * para que ninguna pantalla vuelva a caer en contenido de muestra cuando el
 * dato real no está.
 */
export function WebNotice({
  title,
  body,
  action
}: {
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.center}>
      <View style={styles.card}>
        <Text selectable style={styles.title}>
          {title}
        </Text>
        <Text selectable style={styles.body}>
          {body}
        </Text>
        {action ? (
          <Pressable onPress={action.onPress} style={styles.cta}>
            <Text style={styles.ctaText}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Superficie recortada por plan, dicha y nada más.
 *
 * Un bloque vacío se lee como una falla, así que el límite se NOMBRA. Lo que no
 * lleva es salida: en nativo no hay ninguna pantalla a la que mandar a la
 * persona para levantarlo, y un botón que no resuelve nada es peor que no
 * tenerlo. Tampoco se promete nada sobre cómo se levanta el límite: eso sería
 * una promesa que esta plataforma no puede cumplir.
 */
export function PlusLocked({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.locked}>
      <Text selectable style={styles.lockedLabel}>
        ÓRBITA PLUS
      </Text>
      <Text selectable style={styles.lockedTitle}>
        {title}
      </Text>
      <Text selectable style={styles.lockedBody}>
        {body}
      </Text>
      <Text selectable style={styles.lockedNote}>
        Tu cuenta todavía no tiene acceso a esta parte.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", backgroundColor: colors.black, flex: 1, justifyContent: "center", padding: 24 },
  locked: {
    backgroundColor: "rgba(196,106,58,0.08)",
    borderColor: "rgba(214,154,106,0.35)",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 22
  },
  lockedLabel: { color: colors.copperSoft, fontSize: 11, fontWeight: "700", letterSpacing: 1.1 },
  lockedTitle: { color: colors.bone, fontSize: 18, fontWeight: "500" },
  lockedBody: { color: colors.boneMuted, fontSize: 15, lineHeight: 22 },
  lockedNote: { color: colors.boneMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  card: {
    alignItems: "flex-start",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    maxWidth: 420,
    padding: 24
  },
  title: { color: colors.bone, fontSize: 22, fontWeight: "500" },
  body: { color: colors.boneMuted, fontSize: 15, lineHeight: 22 },
  cta: { backgroundColor: colors.bone, borderRadius: 8, marginTop: 4, paddingHorizontal: 18, paddingVertical: 12 },
  ctaText: { color: colors.black, fontSize: 14, fontWeight: "700" }
});
