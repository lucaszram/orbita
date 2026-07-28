import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Link, Redirect } from "expo-router";
import { sessionPhase } from "@/domain/screenPhase";
import { webRouteDecision } from "@/domain/webSession";
import { useLiveApp } from "@/hooks/useLiveApp";
import { backendConfig } from "@/services/backendProviders";

const colors = {
  black: "#07080A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)",
  line: "rgba(214, 154, 106, 0.2)",
  panel: "rgba(11, 12, 15, 0.62)"
};

/** Spinner estable sobre fondo oscuro. Antes existía para no mostrar el mock
 *  mientras resolvía la sesión; ahora simplemente es el estado de carga. */
export function WebLoading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.copperSoft} />
    </View>
  );
}

/**
 * Envuelve una ruta autenticada de la web. Sin sesión redirige a login; nunca
 * renderiza contenido de demostración ni datos de otra persona.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { isLive, isAuthLoading, userError, retryUser } = useLiveApp();
  const decision = webRouteDecision({
    phase: sessionPhase({ isLive, isAuthLoading, userError }),
    backendConfigured: backendConfig.isConfigured
  });

  switch (decision) {
    case "cargando":
      return <WebLoading />;
    case "sinBackend":
      return (
        <WebNotice
          title="Órbita no está disponible"
          body="No pudimos conectar con el servidor. Volvé a intentar en un momento."
        />
      );
    case "error":
      return (
        <WebNotice
          title="No pudimos abrir tu cuenta"
          body="La sesión quedó a medias. Reintentá; si sigue, cerrá sesión y volvé a entrar."
          action={{ label: "Reintentar", onPress: retryUser }}
        />
      );
    case "aLogin":
      return <Redirect href="/login" />;
    case "render":
      return <>{children}</>;
  }
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
 * Superficie recortada por plan. El backend ya no manda el dato; esto sólo lo
 * nombra, para que un bloque vacío no se lea como una falla.
 *
 * No muestra precios: los precios sólo existen en `/paywall`, que los pide a
 * Stripe vía `getWebOffer`. Con el comercio apagado esa página dice
 * "estará disponible pronto" y no ofrece ningún camino a checkout.
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
      {/* `/paywall` resuelve por sí solo el estado del comercio: con `off`
          muestra "estará disponible pronto" y no ofrece checkout. */}
      <Link href="/paywall" asChild>
        <Pressable style={styles.lockedLink}>
          <Text selectable style={styles.lockedLinkText}>Ver Órbita Plus</Text>
        </Pressable>
      </Link>
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
  lockedLink: { alignSelf: "flex-start", marginTop: 4 },
  lockedLinkText: { color: colors.bone, fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
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
