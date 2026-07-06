import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { orbita } from "@/theme/orbita";
import type { Triad as TriadData } from "@/domain/types";

const G = orbita.spacing.gutter;

/** Dark editorial screen shell: bg #111, top bar, scroll, font gate. */
export function OrbitaScreen({ children, right = "Hoy  ˅" }: { children: ReactNode; right?: string }) {
  const insets = useSafeAreaInsets();
  const fontsLoaded = useOrbitaFonts();
  if (!fontsLoaded) return <View style={styles.screen} />;
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top }}>
        <TopBar right={right} />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + orbita.spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function TopBar({ right = "HOY ˅" }: { right?: string }) {
  return (
    <View>
      <View style={styles.topbar}>
        <Text style={styles.brand}>ÓRBITA</Text>
        <Text style={styles.selector}>{right}</Text>
      </View>
      <View style={styles.topbarDivider} />
    </View>
  );
}

/** Section wrapper with horizontal gutter + vertical rhythm. */
export function Section({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.section, style]}>{children}</View>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}
export function H1({ children }: { children: ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}
export function H2({ children }: { children: ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}
export function H3({ children }: { children: ReactNode }) {
  return <Text style={styles.h3}>{children}</Text>;
}
export function Body({ children, bone }: { children: ReactNode; bone?: boolean }) {
  return <Text style={[styles.body, bone && styles.bodyBone]}>{children}</Text>;
}
export function Divider({ style }: { style?: object }) {
  return <View style={[styles.divider, style]} />;
}
/** Mono muted line (planet rows, week strip, birth line). */
export function MonoLine({ children }: { children: ReactNode }) {
  return <Text style={styles.triad}>{children}</Text>;
}
/** Small dim note (privacy microcopy, accuracy notes). */
export function Note({ children }: { children: ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

export function Triad({ triad }: { triad: TriadData }) {
  return (
    <Text style={styles.triad}>
      {`${triad.sun.glyph} ${triad.sun.label}   ${triad.moon.glyph} ${triad.moon.label}   ${triad.ascendant.glyph} ${triad.ascendant.label}`}
    </Text>
  );
}

export function Pill({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.pill, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button">
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}

/** Copper mono label + bone copy row (Hacé / Evitá / Energía). */
export function GuideRow({ label, copy }: { label: string; copy: string }) {
  return (
    <View style={styles.guideRow}>
      <Divider style={styles.guideRowDivider} />
      <View style={styles.guideRowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowCopy}>{copy}</Text>
      </View>
    </View>
  );
}

export function ActionBand({ label, copy }: { label: string; copy: string }) {
  return (
    <View style={styles.actionBand}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.actionCopy}>{copy}</Text>
    </View>
  );
}

/** Tappable editorial insight row: serif title + arrow + body. */
export function InsightRow({
  title,
  body,
  onPress,
  active,
  first
}: {
  title: string;
  body: string;
  onPress?: () => void;
  active?: boolean;
  first?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.insightRow, pressed && styles.pressed]}>
      <View style={styles.insightHead}>
        <View style={styles.marker}>
          <View style={[styles.markerDot, active ? styles.markerActive : undefined]} />
        </View>
        <Text style={styles.insightTitle}>{title}</Text>
        <Text style={styles.arrow}>→</Text>
      </View>
      <Text style={styles.insightBody}>{body}</Text>
    </Pressable>
  );
}

/** Topic/category tab strip with copper underline on active. */
export function TabStrip<T extends string>({
  tabs,
  active,
  onChange
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.tabs}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Pressable key={t.key} onPress={() => onChange(t.key)} style={styles.tab} accessibilityRole="tab">
            <Text style={[styles.tabLabel, on && styles.tabLabelActive]}>{t.label}</Text>
            {on ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { backgroundColor: orbita.colors.background, flex: 1 },
  topbar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: G,
    paddingTop: orbita.spacing.md,
    paddingBottom: orbita.spacing.lg
  },
  brand: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 17, letterSpacing: 2 },
  selector: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 14, letterSpacing: 1 },
  topbarDivider: { backgroundColor: orbita.colors.line, height: 1 },

  section: { paddingHorizontal: G, paddingTop: orbita.spacing.xl, paddingBottom: orbita.spacing.xxl },
  eyebrow: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: orbita.spacing.md
  },
  h1: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 40, lineHeight: 45 },
  h2: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 34, lineHeight: 41 },
  h3: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 24, lineHeight: 30 },
  body: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 15, lineHeight: 22, marginTop: orbita.spacing.lg },
  bodyBone: { color: orbita.colors.bone },
  divider: { backgroundColor: orbita.colors.line, height: 1, marginVertical: orbita.spacing.xl },

  triad: { color: orbita.colors.muted, fontFamily: orbita.fonts.mono, fontSize: 13, lineHeight: 18 },
  note: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.body, fontSize: 12, lineHeight: 17, marginTop: orbita.spacing.sm },

  pill: {
    alignSelf: "flex-start",
    backgroundColor: orbita.colors.bone,
    borderRadius: orbita.radius.lg,
    height: 52,
    justifyContent: "center",
    paddingHorizontal: orbita.spacing.xxl
  },
  pillText: { color: orbita.colors.onLight, fontFamily: orbita.fonts.monoMedium, fontSize: 13 },
  pressed: { opacity: 0.6 },

  guideRow: { marginBottom: orbita.spacing.md },
  guideRowDivider: { marginVertical: 0, marginBottom: orbita.spacing.lg },
  guideRowBody: { flexDirection: "row", gap: orbita.spacing.xl },
  rowLabel: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 11, letterSpacing: 0.5, width: 78 },
  rowCopy: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 15, flex: 1, lineHeight: 21 },

  actionBand: {
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: orbita.spacing.lg,
    marginTop: orbita.spacing.lg,
    padding: orbita.spacing.xl
  },
  actionCopy: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 15, flex: 1, lineHeight: 21 },

  insightRow: { paddingVertical: orbita.spacing.xl, borderBottomColor: orbita.colors.line, borderBottomWidth: 1 },
  insightHead: { alignItems: "center", flexDirection: "row" },
  marker: { width: 20, alignItems: "flex-start", justifyContent: "center" },
  markerDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: orbita.colors.mutedDim },
  markerActive: { backgroundColor: orbita.colors.copper, borderColor: orbita.colors.copper },
  insightTitle: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 24, lineHeight: 30, flex: 1 },
  arrow: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 20, marginLeft: orbita.spacing.md },
  insightBody: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 14, lineHeight: 20, marginTop: orbita.spacing.sm, marginLeft: 20 },

  tabs: { flexDirection: "row", gap: orbita.spacing.xl, marginTop: orbita.spacing.md },
  tab: { alignItems: "center" },
  tabLabel: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 13 },
  tabLabelActive: { color: orbita.colors.copper },
  tabUnderline: { backgroundColor: orbita.colors.copper, borderRadius: 1, height: 2, marginTop: orbita.spacing.sm, width: 34 }
});
