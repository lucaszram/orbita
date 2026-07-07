import { ComponentType, useMemo, useState } from "react";
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_400Regular, Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import { CloudUpload, FileVideoCamera, LockKeyhole, Play, ShieldCheck, Upload } from "lucide-react-native";
import { useConvexAuth, useQuery_experimental as useQuery } from "convex/react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { webAssets } from "@/content/webAssets";
import { backendConfig } from "@/services/backendProviders";
import { StudioAccess, studioApi } from "@/services/studioRefs";

const colors = {
  black: "#07080A",
  charcoal: "#0D0E12",
  charcoal2: "#14161A",
  copper: "#C46A3A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)",
  line: "rgba(214, 154, 106, 0.24)",
  panel: "rgba(15, 17, 22, 0.8)",
  panelStrong: "rgba(21, 23, 29, 0.94)",
  danger: "#E08B72",
  success: "#BBD8A4"
};

type QueryState<T> =
  | { status: "pending" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

type StudioMockStatus = "draft" | "review" | "published";
type DropVisualState = "idle" | "dragging" | "queued" | "review";

export type StudioMockVideo = {
  id: string;
  name: string;
  status: StudioMockStatus;
  usage: string;
  tags: string[];
  notes: string;
  createdAt: string;
};

type IconComponent = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

const initialVideos: StudioMockVideo[] = [
  {
    id: "orbita-video-01",
    name: "home-daily-atmosphere.mp4",
    status: "review",
    usage: "Home diaria",
    tags: ["daily", "texture", "dark"],
    notes: "Buen tono para transición entre titular diario y módulos Hacé/Evitá.",
    createdAt: "5 jul"
  },
  {
    id: "orbita-video-02",
    name: "payment-orbital-loop.mov",
    status: "draft",
    usage: "Onboarding payment",
    tags: ["plus", "payment", "premium"],
    notes: "Usarlo como atmósfera; no sumar claims comerciales nuevos.",
    createdAt: "5 jul"
  },
  {
    id: "orbita-video-03",
    name: "transits-symbol-test.mp4",
    status: "published",
    usage: "Tránsitos",
    tags: ["transits", "chart", "studio"],
    notes: "Funciona mejor como backplate que como pieza protagonista.",
    createdAt: "4 jul"
  }
];

const dropCopy: Record<DropVisualState, { title: string; body: string; action: string }> = {
  idle: {
    title: "Nuevo material",
    body: "Video, loop o referencia para probar dentro del sistema visual de Órbita.",
    action: "Simular drop"
  },
  dragging: {
    title: "Listo para entrar",
    body: "El Studio prepara metadata local y deja el material en borrador.",
    action: "Soltar mock"
  },
  queued: {
    title: "Material en cola",
    body: "La pieza queda como draft visual. Todavía no se sube ningún archivo.",
    action: "Pasar a review"
  },
  review: {
    title: "En revisión",
    body: "Listo para mirar tono, crop, uso y estado editorial.",
    action: "Agregar otro"
  }
};

export function OrbitaStudio() {
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

  if (process.env.EXPO_OS !== "web") {
    return (
      <StudioSetupPanel title="Studio web">
        <Text selectable style={styles.body}>Esta superficie está pensada para navegador. La app móvil conserva su flujo actual.</Text>
      </StudioSetupPanel>
    );
  }

  if (!backendConfig.isConfigured) {
    return (
      <StudioSetupPanel title="Falta conectar sesión">
        <Text selectable style={styles.body}>
          Configurá Convex y Clerk para habilitar el Studio protegido. La landing pública puede funcionar sin sesión.
        </Text>
      </StudioSetupPanel>
    );
  }

  return <StudioAuthGate />;
}

function StudioAuthGate() {
  const { useAuth, useUser } = require("@clerk/expo") as typeof import("@clerk/expo");
  const auth = useAuth();
  const { user } = useUser();
  const convexAuth = useConvexAuth();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress;

  if (!auth.isLoaded) {
    return (
      <StudioSetupPanel title="Cargando sesión">
        <ActivityIndicator color={colors.copperSoft} />
      </StudioSetupPanel>
    );
  }

  if (!auth.isSignedIn) {
    return <StudioSignInPanel />;
  }

  if (convexAuth.isLoading) {
    return (
      <StudioSetupPanel title="Conectando Studio">
        <ActivityIndicator color={colors.copperSoft} />
        <Text selectable style={styles.body}>Clerk ya tiene sesión. Falta confirmar identidad con Convex.</Text>
      </StudioSetupPanel>
    );
  }

  if (!convexAuth.isAuthenticated) {
    return (
      <StudioSetupPanel title="Sesión incompleta">
        <Text selectable style={styles.body}>
          La cuenta `{email ?? "actual"}` está en Clerk, pero Convex todavía no recibió identidad válida.
        </Text>
        <StudioButton icon={LockKeyhole} label="Cambiar cuenta" onPress={() => void auth.signOut()} variant="secondary" />
      </StudioSetupPanel>
    );
  }

  return <StudioAccessGate onSignOut={() => void auth.signOut()} userEmail={email} />;
}

function StudioSignInPanel() {
  const { SignIn } = require("@clerk/expo/web") as {
    SignIn: ComponentType<Record<string, unknown>>;
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.authWrap}>
      <ImageBackground resizeMode="cover" source={webAssets.paymentField.require} style={styles.authPanel} imageStyle={styles.authPanelImage}>
        <LinearGradient colors={["rgba(7,8,10,0.58)", "rgba(7,8,10,0.96)"]} style={styles.authOverlay}>
          <Text selectable style={styles.eyebrow}>Órbita Studio</Text>
          <Text selectable style={styles.authTitle}>Entrar</Text>
          <Text selectable style={styles.body}>El acceso usa la misma allowlist del backoffice.</Text>
          <View style={styles.clerkPanel}>
            <SignIn
              fallbackRedirectUrl="/studio"
              forceRedirectUrl="/studio"
              routing="hash"
              signUpFallbackRedirectUrl="/studio"
              signUpForceRedirectUrl="/studio"
            />
          </View>
        </LinearGradient>
      </ImageBackground>
    </ScrollView>
  );
}

function StudioAccessGate({ onSignOut, userEmail }: { onSignOut: () => void; userEmail?: string }) {
  const accessState = useQuery({
    query: studioApi.checkAccess,
    args: {},
    throwOnError: false
  }) as QueryState<StudioAccess>;

  if (accessState.status === "pending") {
    return (
      <StudioSetupPanel title="Validando acceso">
        <ActivityIndicator color={colors.copperSoft} />
      </StudioSetupPanel>
    );
  }

  if (accessState.status === "error") {
    return (
      <StudioSetupPanel title="Acceso bloqueado">
        <Text selectable style={styles.body}>
          {accessState.error.message.includes("not allowed")
            ? "La cuenta está autenticada, pero no está habilitada para Órbita Studio."
            : accessState.error.message}
        </Text>
        <StudioButton icon={LockKeyhole} label="Cambiar cuenta" onPress={onSignOut} variant="secondary" />
      </StudioSetupPanel>
    );
  }

  return <StudioWorkspace access={accessState.data} onSignOut={onSignOut} userEmail={userEmail} />;
}

function StudioWorkspace({
  access,
  onSignOut,
  userEmail
}: {
  access: StudioAccess;
  onSignOut: () => void;
  userEmail?: string;
}) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 920;
  const [dropState, setDropState] = useState<DropVisualState>("idle");
  const [videos, setVideos] = useState<StudioMockVideo[]>(initialVideos);
  const [selectedId, setSelectedId] = useState(initialVideos[0].id);
  const selectedVideo = videos.find((video) => video.id === selectedId) ?? videos[0];
  const counts = useMemo(() => {
    return videos.reduce(
      (acc, video) => ({ ...acc, [video.status]: acc[video.status] + 1 }),
      { draft: 0, review: 0, published: 0 } as Record<StudioMockStatus, number>
    );
  }, [videos]);

  function updateVideo(id: string, patch: Partial<StudioMockVideo>) {
    setVideos((current) => current.map((video) => (video.id === id ? { ...video, ...patch } : video)));
  }

  function handleMockDrop() {
    if (dropState === "queued" && selectedVideo) {
      updateVideo(selectedVideo.id, { status: "review" });
      setDropState("review");
      return;
    }

    const nextIndex = videos.length + 1;
    const video: StudioMockVideo = {
      id: `orbita-video-${String(nextIndex).padStart(2, "0")}`,
      name: `orbita-web-drop-${String(nextIndex).padStart(2, "0")}.mp4`,
      status: "draft",
      usage: "Landing / Studio",
      tags: ["mock", "web", "orbita"],
      notes: "Mock local para revisar tono, uso y estado editorial antes de conectar storage.",
      createdAt: "ahora"
    };
    setVideos((current) => [video, ...current]);
    setSelectedId(video.id);
    setDropState("queued");
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.workspace}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text selectable style={styles.eyebrow}>Órbita Studio</Text>
          <Text selectable style={styles.title}>Material visual</Text>
          <Text selectable style={styles.body}>
            Drop visual, estados editoriales y metadata local para probar piezas antes de conectar carga real.
          </Text>
        </View>
        <View style={styles.sessionPanel}>
          <Text selectable style={styles.sessionLabel}>Sesión habilitada</Text>
          <Text selectable style={styles.sessionEmail}>{access.email ?? userEmail ?? "Clerk + Convex"}</Text>
          <StudioButton icon={LockKeyhole} label="Cambiar cuenta" onPress={onSignOut} variant="ghost" />
        </View>
      </View>

      <View style={[styles.metrics, isNarrow && styles.stack]}>
        <MetricCard label="Draft" value={counts.draft} />
        <MetricCard label="Review" value={counts.review} />
        <MetricCard label="Published" value={counts.published} />
      </View>

      <View style={[styles.grid, isNarrow && styles.stack]}>
        <View style={styles.mainColumn}>
          <ImageBackground
            accessibilityLabel={webAssets.studioBackplate.alt}
            imageStyle={styles.dropImage}
            resizeMode="cover"
            source={webAssets.studioBackplate.require}
            style={styles.dropzone}
          >
            <LinearGradient colors={["rgba(7,8,10,0.22)", "rgba(7,8,10,0.92)"]} style={styles.dropOverlay}>
              <Pressable
                accessibilityRole="button"
                onHoverIn={() => setDropState((current) => (current === "idle" ? "dragging" : current))}
                onHoverOut={() => setDropState((current) => (current === "dragging" ? "idle" : current))}
                onPress={handleMockDrop}
                style={[styles.dropCard, dropState === "dragging" && styles.dropCardActive]}
              >
                <View style={styles.dropIcon}>
                  <CloudUpload color={colors.copperSoft} size={28} strokeWidth={1.6} />
                </View>
                <Text selectable style={styles.dropTitle}>{dropCopy[dropState].title}</Text>
                <Text selectable style={styles.dropBody}>{dropCopy[dropState].body}</Text>
                <View style={styles.dropAction}>
                  <Upload color={colors.black} size={16} strokeWidth={2} />
                  <Text selectable style={styles.dropActionText}>{dropCopy[dropState].action}</Text>
                </View>
              </Pressable>
            </LinearGradient>
          </ImageBackground>

          {selectedVideo ? (
            <View style={styles.editorPanel}>
              <View style={styles.panelHeader}>
                <View>
                  <Text selectable style={styles.eyebrow}>Metadata local</Text>
                  <Text selectable style={styles.panelTitle}>{selectedVideo.name}</Text>
                </View>
                <StatusPill status={selectedVideo.status} />
              </View>
              <View style={styles.formGrid}>
                <StudioField label="Nombre">
                  <StudioInput value={selectedVideo.name} onChangeText={(name) => updateVideo(selectedVideo.id, { name })} />
                </StudioField>
                <StudioField label="Uso">
                  <StudioInput value={selectedVideo.usage} onChangeText={(usage) => updateVideo(selectedVideo.id, { usage })} />
                </StudioField>
                <StudioField label="Tags">
                  <StudioInput
                    value={selectedVideo.tags.join(", ")}
                    onChangeText={(value) =>
                      updateVideo(selectedVideo.id, {
                        tags: value
                          .split(",")
                          .map((tag) => tag.trim())
                          .filter(Boolean)
                      })
                    }
                  />
                </StudioField>
                <StudioField label="Estado">
                  <View style={styles.segmented}>
                    {(["draft", "review", "published"] as StudioMockStatus[]).map((status) => (
                      <Pressable
                        key={status}
                        onPress={() => updateVideo(selectedVideo.id, { status })}
                        style={[styles.segment, selectedVideo.status === status && styles.segmentActive]}
                      >
                        <Text selectable style={[styles.segmentText, selectedVideo.status === status && styles.segmentTextActive]}>
                          {status}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </StudioField>
              </View>
              <StudioField label="Notas">
                <StudioInput
                  multiline
                  value={selectedVideo.notes}
                  onChangeText={(notes) => updateVideo(selectedVideo.id, { notes })}
                  style={styles.textarea}
                />
              </StudioField>
            </View>
          ) : null}
        </View>

        <View style={styles.sideColumn}>
          <View style={styles.libraryPanel}>
            <View style={styles.panelHeader}>
              <View>
                <Text selectable style={styles.eyebrow}>Biblioteca</Text>
                <Text selectable style={styles.panelTitle}>Mocks activos</Text>
              </View>
              <FileVideoCamera color={colors.copperSoft} size={21} strokeWidth={1.7} />
            </View>
            <View style={styles.videoList}>
              {videos.map((video) => (
                <Pressable
                  key={video.id}
                  onPress={() => setSelectedId(video.id)}
                  style={[styles.videoRow, selectedId === video.id && styles.videoRowActive]}
                >
                  <View style={styles.videoThumb}>
                    <Play color={colors.bone} size={18} fill={colors.bone} strokeWidth={1.5} />
                  </View>
                  <View style={styles.videoMeta}>
                    <Text selectable style={styles.videoName}>{video.name}</Text>
                    <Text selectable style={styles.videoUsage}>{video.usage} · {video.createdAt}</Text>
                  </View>
                  <StatusPill status={video.status} compact />
                </Pressable>
              ))}
            </View>
          </View>

          <ImageBackground resizeMode="cover" source={webAssets.moonPhase.require} style={styles.symbolPanel} imageStyle={styles.symbolImage}>
            <LinearGradient colors={["rgba(7,8,10,0.08)", "rgba(7,8,10,0.86)"]} style={styles.symbolOverlay}>
              <Text selectable style={styles.eyebrow}>Guía de uso</Text>
              <Text selectable style={styles.symbolTitle}>Los assets son atmósfera, no posters.</Text>
              <Text selectable style={styles.symbolText}>
                Cada pieza se revisa por crop, tono, lectura mobile y vínculo con el módulo donde aparece.
              </Text>
            </LinearGradient>
          </ImageBackground>
        </View>
      </View>
    </ScrollView>
  );
}

function StudioSetupPanel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.authWrap}>
      <ImageBackground resizeMode="cover" source={webAssets.paymentField.require} style={styles.authPanel} imageStyle={styles.authPanelImage}>
        <LinearGradient colors={["rgba(7,8,10,0.58)", "rgba(7,8,10,0.96)"]} style={styles.authOverlay}>
          <Text selectable style={styles.eyebrow}>Órbita Studio</Text>
          <Text selectable style={styles.authTitle}>{title}</Text>
          <View style={styles.setupContent}>{children}</View>
        </LinearGradient>
      </ImageBackground>
    </ScrollView>
  );
}

function StudioButton({
  icon: Icon,
  label,
  onPress,
  variant = "primary"
}: {
  icon: IconComponent;
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.button, variant === "secondary" && styles.buttonSecondary, variant === "ghost" && styles.buttonGhost]}
    >
      <Icon color={variant === "primary" ? colors.black : colors.bone} size={16} strokeWidth={2} />
      <Text selectable style={[styles.buttonText, variant !== "primary" && styles.buttonTextLight]}>{label}</Text>
    </Pressable>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metricCard}>
      <Text selectable style={styles.metricValue}>{value}</Text>
      <Text selectable style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StatusPill({ compact = false, status }: { compact?: boolean; status: StudioMockStatus }) {
  const tone = status === "published" ? colors.success : status === "review" ? colors.copperSoft : colors.boneMuted;
  return (
    <View style={[styles.statusPill, compact && styles.statusPillCompact, { borderColor: tone }]}>
      <ShieldCheck color={tone} size={compact ? 12 : 14} strokeWidth={1.8} />
      <Text selectable style={[styles.statusText, { color: tone }]}>{status}</Text>
    </View>
  );
}

function StudioField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View style={styles.field}>
      <Text selectable style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function StudioInput({
  style,
  ...props
}: Omit<React.ComponentProps<typeof TextInput>, "placeholderTextColor" | "style"> & {
  style?: React.ComponentProps<typeof TextInput>["style"];
}) {
  return <TextInput placeholderTextColor="rgba(244, 238, 228, 0.42)" style={[styles.input, style]} {...props} />;
}

export default OrbitaStudio;

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
  authWrap: {
    alignItems: "center",
    backgroundColor: colors.black,
    flexGrow: 1,
    justifyContent: "center",
    padding: 24
  },
  authPanel: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 760,
    minHeight: 560,
    overflow: "hidden",
    width: "100%"
  },
  authPanelImage: {
    opacity: 0.76
  },
  authOverlay: {
    flex: 1,
    gap: 16,
    justifyContent: "center",
    padding: 28
  },
  clerkPanel: {
    backgroundColor: "rgba(244, 238, 228, 0.96)",
    borderRadius: 8,
    overflow: "hidden",
    padding: 12
  },
  setupContent: {
    gap: 16
  },
  authTitle: {
    color: colors.bone,
    fontFamily: "Newsreader_500Medium",
    fontSize: 54,
    letterSpacing: 0,
    lineHeight: 58
  },
  workspace: {
    alignSelf: "center",
    gap: 18,
    maxWidth: 1240,
    padding: 24,
    width: "100%"
  },
  header: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: 18,
    justifyContent: "space-between"
  },
  headerCopy: {
    flex: 1,
    gap: 10
  },
  eyebrow: {
    color: colors.copperSoft,
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.bone,
    fontFamily: "Newsreader_500Medium",
    fontSize: 58,
    letterSpacing: 0,
    lineHeight: 62
  },
  body: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 680
  },
  sessionPanel: {
    alignSelf: "flex-start",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    minWidth: 280,
    padding: 14
  },
  sessionLabel: {
    color: colors.copperSoft,
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  sessionEmail: {
    color: colors.bone,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    letterSpacing: 0
  },
  button: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.copperSoft,
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 14
  },
  buttonSecondary: {
    backgroundColor: "rgba(244, 238, 228, 0.08)",
    borderColor: "rgba(244, 238, 228, 0.16)",
    borderWidth: 1
  },
  buttonGhost: {
    backgroundColor: "transparent",
    borderColor: "rgba(244, 238, 228, 0.12)",
    borderWidth: 1
  },
  buttonText: {
    color: colors.black,
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 0
  },
  buttonTextLight: {
    color: colors.bone
  },
  metrics: {
    flexDirection: "row",
    gap: 12
  },
  metricCard: {
    backgroundColor: colors.panel,
    borderColor: "rgba(244, 238, 228, 0.1)",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    padding: 16
  },
  metricValue: {
    color: colors.bone,
    fontFamily: "Newsreader_500Medium",
    fontSize: 38,
    letterSpacing: 0,
    lineHeight: 40
  },
  metricLabel: {
    color: colors.boneMuted,
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  grid: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: 18
  },
  stack: {
    flexDirection: "column"
  },
  mainColumn: {
    flex: 1.45,
    gap: 18
  },
  sideColumn: {
    flex: 1,
    gap: 18
  },
  dropzone: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 420,
    overflow: "hidden"
  },
  dropImage: {
    opacity: 0.9
  },
  dropOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 18
  },
  dropCard: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(7, 8, 10, 0.76)",
    borderColor: "rgba(244, 238, 228, 0.18)",
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 12,
    maxWidth: 440,
    padding: 24,
    width: "100%"
  },
  dropCardActive: {
    borderColor: colors.copperSoft,
    backgroundColor: "rgba(15, 17, 22, 0.88)"
  },
  dropIcon: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
    width: 58
  },
  dropTitle: {
    color: colors.bone,
    fontFamily: "Newsreader_500Medium",
    fontSize: 34,
    letterSpacing: 0,
    lineHeight: 38,
    textAlign: "center"
  },
  dropBody: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center"
  },
  dropAction: {
    alignItems: "center",
    backgroundColor: colors.bone,
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 14
  },
  dropActionText: {
    color: colors.black,
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 0
  },
  editorPanel: {
    backgroundColor: colors.panelStrong,
    borderColor: "rgba(244, 238, 228, 0.1)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16
  },
  libraryPanel: {
    backgroundColor: colors.panelStrong,
    borderColor: "rgba(244, 238, 228, 0.1)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  panelTitle: {
    color: colors.bone,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    letterSpacing: 0,
    lineHeight: 24
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  field: {
    flex: 1,
    gap: 7,
    minWidth: 220
  },
  fieldLabel: {
    color: colors.copperSoft,
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  input: {
    backgroundColor: "rgba(244, 238, 228, 0.06)",
    borderColor: "rgba(244, 238, 228, 0.13)",
    borderRadius: 8,
    borderWidth: 1,
    color: colors.bone,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  textarea: {
    minHeight: 110,
    textAlignVertical: "top"
  },
  segmented: {
    backgroundColor: "rgba(244, 238, 228, 0.06)",
    borderColor: "rgba(244, 238, 228, 0.13)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden"
  },
  segment: {
    alignItems: "center",
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 10
  },
  segmentActive: {
    backgroundColor: colors.copperSoft
  },
  segmentText: {
    color: colors.boneMuted,
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 0
  },
  segmentTextActive: {
    color: colors.black
  },
  videoList: {
    gap: 8
  },
  videoRow: {
    alignItems: "center",
    backgroundColor: "rgba(244, 238, 228, 0.05)",
    borderColor: "rgba(244, 238, 228, 0.08)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10
  },
  videoRowActive: {
    borderColor: colors.copperSoft,
    backgroundColor: "rgba(214, 154, 106, 0.12)"
  },
  videoThumb: {
    alignItems: "center",
    backgroundColor: colors.charcoal2,
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  videoMeta: {
    flex: 1,
    gap: 3
  },
  videoName: {
    color: colors.bone,
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 0
  },
  videoUsage: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    letterSpacing: 0
  },
  statusPill: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  statusPillCompact: {
    paddingHorizontal: 7,
    paddingVertical: 4
  },
  statusText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0
  },
  symbolPanel: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 260,
    overflow: "hidden"
  },
  symbolImage: {
    opacity: 0.86
  },
  symbolOverlay: {
    flex: 1,
    gap: 10,
    justifyContent: "flex-end",
    padding: 18
  },
  symbolTitle: {
    color: colors.bone,
    fontFamily: "Newsreader_500Medium",
    fontSize: 30,
    letterSpacing: 0,
    lineHeight: 34
  },
  symbolText: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22
  }
});
