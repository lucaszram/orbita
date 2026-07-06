import { useQuery } from "convex/react";
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_400Regular, Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import { AlertCircle, ArrowRight, Sparkles } from "lucide-react-native";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { LiveGate } from "@/components/web/live";
import { WebNav } from "@/components/web/web-nav";
import { webAssets } from "@/content/webAssets";
import { homeMock } from "@/content/homeMock";
import { appApi } from "@/services/appRefs";
import type { PublicDailyHome } from "@/services/publicLabRefs";

const colors = {
  black: "#07080A",
  charcoal: "#0D0F13",
  panel: "rgba(18, 20, 26, 0.72)",
  copper: "#C46A3A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)",
  boneDim: "rgba(244, 238, 228, 0.5)",
  line: "rgba(214, 154, 106, 0.22)",
  lineQuiet: "rgba(244, 238, 228, 0.1)"
};

// ---------------------------------------------------------------------------
// View model — normaliza el payload suelto de PublicDailyHome a algo tipado.
// ---------------------------------------------------------------------------

type HomeView = {
  dateLabel: string;
  place: string;
  greeting: string;
  headline: string;
  subheadline: string;
  triad: Array<{ role: string; sign: string }>;
  accuracy: string;
  do: string[];
  avoid: string[];
  energy: string;
  action: string;
  question: string;
  transit: { headline: string; explanation: string; secondary: string[] };
  topics: Array<{ title: string; oneLine: string; question: string }>;
  deepDive: { title: string; body: string };
  closing: { prompt: string; placeholder: string };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  const r = asRecord(value);
  if (r) return readString(r.text ?? r.label ?? r.displayText ?? r.sign, fallback);
  return fallback;
}

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS[date.getDay()]} ${d} de ${MONTHS[m - 1]}`;
}

function placeFromTz(tz: string): string {
  const last = tz.split("/").pop() ?? tz;
  return last.replace(/_/g, " ");
}

export function toHomeView(payload: PublicDailyHome): HomeView {
  const secondary = Array.isArray(payload.transits.secondary)
    ? payload.transits.secondary.map((t) => readString(t)).filter(Boolean)
    : [];
  const topics = Array.isArray(payload.topics)
    ? payload.topics.map((t) => {
        const r = asRecord(t);
        return {
          title: readString(r?.title, "Tema"),
          oneLine: readString(r?.oneLine ?? r?.body),
          question: readString(r?.question)
        };
      })
    : [];
  const longRead = asRecord(payload.longRead);
  const futureSelf = asRecord(payload.futureSelf);
  const voidBlock = asRecord(payload.void);
  return {
    dateLabel: formatDate(payload.header.localDate),
    place: placeFromTz(payload.header.timezone),
    greeting: payload.header.greeting,
    headline: payload.header.headline,
    subheadline: payload.header.subheadline,
    triad: [
      { role: "Sol", sign: readString(payload.natalBase.sun, "—") },
      { role: "Luna", sign: readString(payload.natalBase.moon, "—") },
      { role: "Asc", sign: readString(payload.natalBase.ascendant, "—") }
    ],
    accuracy: payload.natalBase.accuracy,
    do: payload.modules.do,
    avoid: payload.modules.avoid,
    energy: payload.modules.energy,
    action: payload.modules.action,
    question: payload.modules.question,
    transit: {
      headline: readString(payload.transits.highlighted, "Sin tránsito destacado."),
      explanation: payload.transits.explanation,
      secondary
    },
    topics,
    deepDive: {
      title: readString(longRead?.title, "Deep Dive"),
      body: readString(longRead?.body)
    },
    closing: {
      prompt: readString(futureSelf?.prompt ?? voidBlock?.questionOfDay, "¿Qué te movió hoy?"),
      placeholder: readString(futureSelf?.placeholder, "Hoy noto que…")
    }
  };
}

// ---------------------------------------------------------------------------
// Container — mock (sin Convex) vs backend (con estados).
// ---------------------------------------------------------------------------

function todayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function OrbitaHome() {
  // Autenticado → datos reales; si no, demo mock. Ver LiveGate.
  return <LiveGate mock={<HomeScreen view={toHomeView(homeMock)} source="demo" />} live={() => <HomeWithBackend />} />;
}

function HomeWithBackend() {
  const data = useQuery(appApi.readings.getToday, { localDate: todayLocalDate() });

  if (data === undefined) {
    return <StatusScreen kind="loading" />;
  }
  if (data === null) {
    return <StatusScreen kind="empty" />;
  }
  return <HomeScreen view={toHomeView(data.payload)} source="live" />;
}

function StatusScreen({ kind }: { kind: "loading" | "empty" | "error" }) {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_700Bold, Newsreader_500Medium });
  if (!fontsLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.copperSoft} />
      </View>
    );
  }
  if (kind === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.copperSoft} />
        <Text selectable style={styles.statusText}>Leyendo tu cielo de hoy…</Text>
      </View>
    );
  }
  const empty = kind === "empty";
  return (
    <View style={styles.center}>
      <View style={styles.statusCard}>
        <AlertCircle color={colors.copperSoft} size={22} strokeWidth={1.7} />
        <Text selectable style={styles.statusTitle}>
          {empty ? "Todavía no hay lectura para hoy" : "No pudimos leer tu día"}
        </Text>
        <Text selectable style={styles.statusBody}>
          {empty
            ? "Completá tu carta base y generamos tu Home diaria."
            : "Probá de nuevo en un momento. Si sigue, revisá tu conexión."}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Presentational
// ---------------------------------------------------------------------------

export function HomeScreen({ view, source }: { view: HomeView; source: "demo" | "live" }) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 900;
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Newsreader_400Regular,
    Newsreader_500Medium
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.copperSoft} />
      </View>
    );
  }

  const pad = isNarrow ? 24 : 120;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      {/* Top bar */}
      <WebNav active="hoy" meta={`${view.dateLabel.split(" ").slice(0, 3).join(" ")} · ${view.place}`} />

      {/* Hero */}
      <ImageBackground
        source={webAssets.dailyTexture.require}
        resizeMode="cover"
        imageStyle={styles.heroImage}
        style={[styles.hero, { minHeight: isNarrow ? 560 : 680 }]}
      >
        <LinearGradient
          colors={["rgba(7,8,10,0.55)", "rgba(7,8,10,0.78)", "rgba(7,8,10,0.94)"]}
          style={[styles.heroOverlay, { paddingHorizontal: pad }]}
        >
          <Text selectable style={styles.eyebrow}>{`${view.dateLabel} · ${view.place}`}</Text>
          <Text selectable style={[styles.greeting, isNarrow && styles.greetingNarrow]}>{view.greeting}</Text>
          <Text selectable style={[styles.headline, isNarrow && styles.headlineNarrow]}>{view.headline}</Text>
          <Text selectable style={styles.heroSub}>{view.subheadline}</Text>
          <View style={styles.chips}>
            {view.triad.map((t) => (
              <View key={t.role} style={styles.chip}>
                <Text selectable style={styles.chipRole}>{t.role.toUpperCase()}</Text>
                <Text selectable style={styles.chipSign}>{t.sign}</Text>
              </View>
            ))}
          </View>
          <Text selectable style={styles.accuracy}>{view.accuracy}</Text>
        </LinearGradient>
      </ImageBackground>

      {/* Guía diaria */}
      <Section pad={pad}>
        <SectionHeader eyebrow="Guía diaria" title="Cómo se siente hoy, en concreto." />
        <View style={[styles.twoCol, isNarrow && styles.stack]}>
          <View style={styles.col}>
            <ListCard title="Hacé" items={view.do} />
            <ListCard title="Evitá" items={view.avoid} />
          </View>
          <View style={styles.col}>
            <TextCard title="Energía del día" body={view.energy} />
            <TextCard title="Acción simple" body={view.action} />
            <TextCard title="Pregunta del día" body={view.question} highlight />
          </View>
        </View>
      </Section>

      {/* Tránsito */}
      <ImageBackground
        source={webAssets.dailyTexture.require}
        resizeMode="cover"
        imageStyle={styles.bandImage}
        style={styles.band}
      >
        <LinearGradient colors={["rgba(7,8,10,0.9)", "rgba(7,8,10,0.7)", "rgba(7,8,10,0.92)"]} style={[styles.bandOverlay, { paddingHorizontal: pad }]}>
          <Text selectable style={styles.eyebrow}>Tránsito destacado</Text>
          <Text selectable style={[styles.bandTitle, isNarrow && styles.bandTitleNarrow]}>{view.transit.headline}</Text>
          <Text selectable style={styles.bandBody}>{view.transit.explanation}</Text>
          {view.transit.secondary.length > 0 && (
            <View style={styles.cells}>
              {view.transit.secondary.map((s) => (
                <View key={s} style={styles.cell}>
                  <Text selectable style={styles.cellText}>{s}</Text>
                </View>
              ))}
            </View>
          )}
        </LinearGradient>
      </ImageBackground>

      {/* Temas */}
      <Section pad={pad}>
        <SectionHeader eyebrow="Temas" title="Cuatro frentes, una lectura para cada uno." />
        <View style={[styles.topicsGrid, isNarrow && styles.stack]}>
          {view.topics.map((t) => (
            <View key={t.title} style={styles.topicCard}>
              <Text selectable style={styles.topicTitle}>{t.title}</Text>
              <Text selectable style={styles.topicLine}>{t.oneLine}</Text>
              {!!t.question && <Text selectable style={styles.topicQuestion}>{t.question}</Text>}
            </View>
          ))}
        </View>
      </Section>

      {/* Deep Dive */}
      <Section pad={pad}>
        <View style={[styles.deep, isNarrow && styles.stack]}>
          <ImageBackground source={webAssets.longRead.require} resizeMode="cover" imageStyle={styles.deepImage} style={styles.deepVisual}>
            <LinearGradient colors={["rgba(7,8,10,0.1)", "rgba(7,8,10,0.8)"]} style={styles.deepVisualOverlay}>
              <Sparkles color={colors.copperSoft} size={20} strokeWidth={1.6} />
              <Text selectable style={styles.deepCaption}>LECTURA DE HOY · 4 MIN</Text>
            </LinearGradient>
          </ImageBackground>
          <View style={styles.deepCopy}>
            <Text selectable style={styles.eyebrow}>Deep Dive</Text>
            <Text selectable style={[styles.deepTitle, isNarrow && styles.deepTitleNarrow]}>{view.deepDive.title}</Text>
            <Text selectable style={styles.body}>{view.deepDive.body}</Text>
            <Pressable style={styles.cta}>
              <Text selectable style={styles.ctaText}>Seguir leyendo</Text>
              <ArrowRight color={colors.black} size={17} strokeWidth={2.1} />
            </Pressable>
          </View>
        </View>
      </Section>

      {/* Cierre */}
      <Section pad={pad}>
        <Text selectable style={styles.eyebrow}>Antes de cerrar</Text>
        <Text selectable style={[styles.closeTitle, isNarrow && styles.closeTitleNarrow]}>{view.closing.prompt}</Text>
        <Text selectable style={styles.body}>Anotá una frase, una señal o una decisión. No hace falta escribir perfecto.</Text>
        <View style={styles.input}>
          <Text selectable style={styles.inputPlaceholder}>{view.closing.placeholder}</Text>
        </View>
        <Pressable style={styles.saveBtn}>
          <Text selectable style={styles.saveBtnText}>Guardar nota</Text>
        </Pressable>
        <Text selectable style={styles.disclaimer}>
          Entretenimiento, autoconocimiento y contexto. No sustituye decisiones de salud, dinero o legales.
        </Text>
      </Section>

      {/* Footer */}
      <View style={[styles.footer, { paddingHorizontal: pad }]}>
        <Text selectable style={styles.footerBrand}>Órbita</Text>
        <Text selectable style={styles.footerText}>
          {source === "demo" ? "Vista demo · contenido de maqueta." : "Entretenimiento, autoconocimiento y contexto diario."}
        </Text>
      </View>
    </ScrollView>
  );
}

function Section({ children, pad }: { children: React.ReactNode; pad: number }) {
  return <View style={[styles.section, { paddingHorizontal: pad }]}>{children}</View>;
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text selectable style={styles.eyebrow}>{eyebrow}</Text>
      <Text selectable style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.card}>
      <Text selectable style={styles.cardLabel}>{title.toUpperCase()}</Text>
      <View style={styles.list}>
        {items.map((it) => (
          <View key={it} style={styles.itemRow}>
            <Text selectable style={styles.itemMark}>—</Text>
            <Text selectable style={styles.itemText}>{it}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TextCard({ title, body, highlight }: { title: string; body: string; highlight?: boolean }) {
  return (
    <View style={[styles.card, highlight && styles.cardHighlight]}>
      <Text selectable style={styles.cardLabel}>{title.toUpperCase()}</Text>
      <Text selectable style={highlight ? styles.cardBig : styles.cardBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.black, flex: 1 },
  pageContent: { backgroundColor: colors.black },
  center: { alignItems: "center", backgroundColor: colors.black, flex: 1, gap: 14, justifyContent: "center", padding: 24 },
  statusText: { color: colors.boneMuted, fontFamily: "Inter_500Medium", fontSize: 14 },
  statusCard: { alignItems: "flex-start", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 8, maxWidth: 420, padding: 24 },
  statusTitle: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 24 },
  statusBody: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },

  topbar: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: 20 },
  brand: { alignItems: "center", flexDirection: "row", gap: 8 },
  brandText: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 16 },
  nav: { flexDirection: "row", gap: 26 },
  navActive: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 14 },
  navLink: { color: colors.boneDim, fontFamily: "Inter_500Medium", fontSize: 14 },
  metaText: { color: colors.boneMuted, fontFamily: "Inter_500Medium", fontSize: 13 },

  hero: { backgroundColor: colors.black, width: "100%" },
  heroImage: { opacity: 0.9 },
  heroOverlay: { flex: 1, gap: 16, justifyContent: "flex-end", paddingBottom: 72, paddingTop: 100 },
  eyebrow: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  greeting: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 66, lineHeight: 70 },
  greetingNarrow: { fontSize: 44, lineHeight: 48 },
  headline: { color: colors.bone, fontFamily: "Newsreader_400Regular", fontSize: 32, lineHeight: 40, maxWidth: 720, opacity: 0.92 },
  headlineNarrow: { fontSize: 26, lineHeight: 33 },
  heroSub: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 18, lineHeight: 28, maxWidth: 600 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  chip: { alignItems: "center", borderColor: "rgba(214,154,106,0.32)", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 15, paddingVertical: 9 },
  chipRole: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 0.6 },
  chipSign: { color: colors.bone, fontFamily: "Inter_500Medium", fontSize: 13 },
  accuracy: { color: colors.boneDim, fontFamily: "Inter_500Medium", fontSize: 12 },

  section: { alignSelf: "center", gap: 28, maxWidth: 1440, paddingVertical: 64, width: "100%" },
  sectionHeader: { gap: 10 },
  sectionTitle: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 30, lineHeight: 36, maxWidth: 720 },

  twoCol: { flexDirection: "row", gap: 20 },
  stack: { flexDirection: "column" },
  col: { flex: 1, gap: 14 },
  card: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 10, borderWidth: 1, gap: 14, padding: 20 },
  cardHighlight: { backgroundColor: "rgba(196,106,58,0.1)", borderColor: "rgba(214,154,106,0.3)" },
  cardLabel: { color: colors.copperSoft, fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1 },
  cardBody: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  cardBig: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 24, lineHeight: 30 },
  list: { gap: 11 },
  itemRow: { flexDirection: "row", gap: 11 },
  itemMark: { color: "rgba(214,154,106,0.85)", fontFamily: "Inter_700Bold", fontSize: 15 },
  itemText: { color: colors.boneMuted, flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },

  band: { backgroundColor: colors.charcoal, width: "100%" },
  bandImage: { opacity: 0.5 },
  bandOverlay: { gap: 18, paddingVertical: 72 },
  bandTitle: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 38, lineHeight: 46, maxWidth: 860 },
  bandTitleNarrow: { fontSize: 28, lineHeight: 34 },
  bandBody: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 17, lineHeight: 26, maxWidth: 720 },
  cells: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  cell: { backgroundColor: "rgba(7,8,10,0.55)", borderColor: "rgba(244,238,228,0.18)", borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  cellText: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 13 },

  topicsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  topicCard: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexBasis: "47%", flexGrow: 1, gap: 10, minWidth: 260, padding: 22 },
  topicTitle: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 17 },
  topicLine: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  topicQuestion: { color: colors.copperSoft, fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 19 },

  deep: { alignItems: "center", flexDirection: "row", gap: 44 },
  deepVisual: { borderRadius: 12, height: 300, overflow: "hidden", width: 460 },
  deepImage: { opacity: 0.95 },
  deepVisualOverlay: { flex: 1, gap: 8, justifyContent: "flex-end", padding: 22 },
  deepCaption: { color: colors.boneMuted, fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 0.5 },
  deepCopy: { flex: 1, gap: 16 },
  deepTitle: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 32, lineHeight: 39 },
  deepTitleNarrow: { fontSize: 26, lineHeight: 32 },
  body: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 17, lineHeight: 27 },
  cta: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.bone, borderRadius: 8, flexDirection: "row", gap: 9, paddingHorizontal: 18, paddingVertical: 13 },
  ctaText: { color: colors.black, fontFamily: "Inter_700Bold", fontSize: 14 },

  closeTitle: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 30, lineHeight: 36 },
  closeTitleNarrow: { fontSize: 26, lineHeight: 32 },
  input: { backgroundColor: colors.panel, borderColor: "rgba(244,238,228,0.12)", borderRadius: 10, borderWidth: 1, marginTop: 4, minHeight: 120, padding: 18, width: "100%" },
  inputPlaceholder: { color: colors.boneDim, fontFamily: "Inter_400Regular", fontSize: 16 },
  saveBtn: { alignSelf: "flex-start", borderColor: "rgba(244,238,228,0.22)", borderRadius: 8, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 12 },
  saveBtnText: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 14 },
  disclaimer: { color: colors.boneDim, fontFamily: "Inter_500Medium", fontSize: 12, lineHeight: 18, marginTop: 4 },

  footer: { alignItems: "flex-start", borderTopColor: colors.line, borderTopWidth: 1, gap: 6, paddingVertical: 40 },
  footerBrand: { color: colors.bone, fontFamily: "Newsreader_500Medium", fontSize: 24 },
  footerText: { color: colors.boneMuted, fontFamily: "Inter_400Regular", fontSize: 13 }
});

export default OrbitaHome;
