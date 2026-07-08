import { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { HomeReading, HomeTopic, Topic } from "@/domain/types";
import { orbita } from "@/theme/orbita";
import { EditorialThumb } from "@/components/orbita/HeroImage";

const HERO_HOME = require("../../../assets/orbita/optimized/core/orbita_home_hero_orbital_b.jpg");
const NEBULA = require("../../../assets/orbita/optimized/core/orbita_daily_texture_b.jpg");

const G = orbita.spacing.gutter;

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

/** Título serif para pantallas de detalle. */
export function SerifTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.headlineMd}>{children}</Text>;
}

/** Párrafo muted para pantallas de detalle. */
export function MutedBody({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

/** Bloque label cobre (mono) + copy bone, con divisor arriba. */
export function LabeledBlock({ label, copy }: { label: string; copy: string }) {
  return (
    <View style={styles.labeledBlock}>
      <View style={styles.guideRowDivider} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.labeledCopy}>{copy}</Text>
    </View>
  );
}

/** Header superior (Figma V4.7): brand mono ÓRBITA + selector HOY, con divisor. */
export function HomeHeader() {
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.brand}>ÓRBITA</Text>
        <Text style={styles.selector}>HOY ˅</Text>
      </View>
      <View style={styles.headerDivider} />
    </View>
  );
}

/** CTA pill bone → texto oscuro. El fondo va en un View interno (el bg directo
 *  sobre Pressable no pinta en iOS con new arch). */
export function PillButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.pillWrap, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button">
      <View style={styles.pill}>
        <Text style={styles.pillText}>{label}</Text>
      </View>
    </Pressable>
  );
}

/** Tramo 01 — Top (Figma V4.7): hero full-bleed con wash, tríada, frase del día, CTA.
 *  `triad` opcional: si se pasa, pisa la de `reading` (para que la Home tome la
 *  tríada de la MISMA fuente que la Carta — el chart, no `createTriad`). */
export function SignalTop({
  reading,
  onProfundizar,
  triad: triadOverride,
  daily,
  name
}: {
  reading: HomeReading;
  onProfundizar: () => void;
  triad?: HomeReading["triad"];
  /** Guía diaria real (análisis del cielo de hoy sobre la carta). Si viene, pisa el
   *  headline/body/clima del engine local (el "Estructura con ventana"). */
  daily?: { headline: string; body: string; clima: string };
  /** Nombre de la persona para la bajada "HOY · PARA {nombre}" (no el signo). */
  name?: string;
}) {
  const triad = triadOverride ?? reading.triad;
  const headline = daily?.headline ?? reading.headline;
  const body = daily?.body ?? reading.body;
  const climaLabel = daily ? "CLIMA DEL DÍA" : reading.signalLabel;
  const climaCopy = daily?.clima ?? reading.signalCopy;
  return (
    <View style={styles.section}>
      {/* Hero full-bleed (Figma V4.7 "Home / Top"): el orbital es el FONDO detrás de
          todo el hero; tríada + frase del día van ENCIMA, sobre el degradé a negro. */}
      <View style={styles.hero}>
        <Image source={HERO_HOME} style={styles.heroImg} resizeMode="cover" />
        <LinearGradient
          colors={["rgba(7,8,10,0)", "rgba(7,8,10,0)", "rgba(7,8,10,0.5)", "#07080A"]}
          locations={[0, 0.42, 0.8, 1]}
          style={styles.heroFade}
        />
        <View style={styles.heroContent}>
          <Text style={[styles.triad, styles.triadCentered]}>
            {`${triad.sun.glyph} ${triad.sun.label}   ${triad.moon.glyph} ${triad.moon.label}   ${triad.ascendant.glyph} ${triad.ascendant.label}`}
          </Text>
          {triad.accuracyNote ? <Text style={[styles.triadNote, styles.triadCentered]}>{triad.accuracyNote}</Text> : null}
          <View style={styles.heroTextGap} />
          <Eyebrow>{`HOY · PARA ${(name?.trim().split(" ")[0] || triad.sun.label).toUpperCase()}`}</Eyebrow>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      </View>

      <View style={styles.divider} />
      <Eyebrow>{climaLabel}</Eyebrow>
      <Text style={styles.signalCopy}>{climaCopy}</Text>
      <View style={{ height: orbita.spacing.xl }} />
      <PillButton label="VER POR QUÉ" onPress={onProfundizar} />
    </View>
  );
}

/** Fila label (mono cobre) + copy (bone) para Hacé/Evitá/Energía. */
function GuideRow({ label, copy }: { label: string; copy: string }) {
  return (
    <View style={styles.guideRow}>
      <View style={styles.guideRowDivider} />
      <View style={styles.guideRowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowCopy}>{copy}</Text>
      </View>
    </View>
  );
}

/** Tramo 02 — Guía diaria: Hacé / Evitá / Energía + banda Acción. */
export function DailyGuide({ reading }: { reading: HomeReading }) {
  return (
    <View style={styles.section}>
      {/* Nebulosa dorada detrás de la guía (como el Figma "Guía de hoy"), sin el radar. */}
      <Image source={NEBULA} style={[styles.guiaNebula, { opacity: 0.55 }]} resizeMode="cover" />
      <LinearGradient
        colors={["#07080A", "rgba(7,8,10,0)", "rgba(7,8,10,0)", "#07080A"]}
        locations={[0, 0.18, 0.82, 1]}
        style={styles.guiaNebula}
        pointerEvents="none"
      />
      <Eyebrow>{reading.guideEyebrow}</Eyebrow>
      <Text style={styles.headlineMd}>{reading.guideHeadline}</Text>
      <Text style={styles.body}>{reading.guideIntro}</Text>

      <View style={{ height: orbita.spacing.xl }} />
      <GuideRow label="HACÉ" copy={reading.hace} />
      <GuideRow label="EVITÁ" copy={reading.evita} />
      <GuideRow label="ENERGÍA" copy={reading.energia} />

      <View style={styles.actionBand}>
        <Text style={styles.rowLabel}>ACCIÓN</Text>
        <Text style={styles.actionCopy}>{reading.accion}</Text>
      </View>
    </View>
  );
}

/** Tramo 03 — Topics: tabs Amor/Trabajo/Familia/Vínculos + filas editoriales. */
export function TopicsSection({
  reading,
  activeTopic,
  onSelectTab,
  onOpenTopic
}: {
  reading: HomeReading;
  activeTopic: Topic;
  onSelectTab: (topic: Topic) => void;
  onOpenTopic: (topic: HomeTopic) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={[styles.tabs, styles.tabsTop]}>
        {reading.topics.map((t) => {
          const active = t.topic === activeTopic;
          return (
            <Pressable key={t.topic} onPress={() => onSelectTab(t.topic)} style={styles.tab} accessibilityRole="tab">
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
              {active ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.divider} />
      <Eyebrow>TU DÍA POR ÁREA</Eyebrow>

      {[...reading.topics]
        .sort((a, b) => (a.topic === activeTopic ? -1 : b.topic === activeTopic ? 1 : 0))
        .map((t) => {
        const active = t.topic === activeTopic;
        return (
          <Pressable
            key={t.topic}
            onPress={() => onOpenTopic(t)}
            style={({ pressed }) => [styles.insightRow, !active && styles.insightRowDim, pressed && styles.pressed]}
          >
            <View style={styles.insightHead}>
              <View style={styles.topicMarker}>
                <Text style={styles.topicGlyph}>{TOPIC_GLYPHS[t.topic] ?? "☉"}</Text>
              </View>
              <Text style={styles.insightTitle}>{t.title}</Text>
              <Text style={styles.arrow}>→</Text>
            </View>
            <Text style={[styles.body, styles.insightBody]}>{t.oneLine}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Glifos por área para los marcadores de fila (Figma V4.7 Topics). */
const TOPIC_GLYPHS: Partial<Record<Topic, string>> = {
  amor: "♀",
  trabajo: "♄",
  familia: "☽",
  vinculos: "☿"
};

/** Tramo 04 — End: lectura larga, módulo educativo, cierre y links. */
export function LongReadEnd({
  reading,
  onLeerAnalisis,
  onGuardar,
  onHistorial
}: {
  reading: HomeReading;
  onLeerAnalisis: () => void;
  onGuardar: () => void;
  onHistorial: () => void;
}) {
  return (
    <View style={styles.section}>
      <Eyebrow>{reading.longReadEyebrow}</Eyebrow>
      <Text style={styles.headlineMd}>{reading.longReadTitle}</Text>

      <View style={{ marginTop: orbita.spacing.lg }}>
        <EditorialThumb height={160} />
      </View>

      <Text style={styles.body}>{reading.longReadBody}</Text>
      <View style={{ height: orbita.spacing.xl }} />
      <PillButton label="LEER AHORA" onPress={onLeerAnalisis} />

      <View style={{ height: orbita.spacing.xxl }} />
      <Eyebrow>{reading.educationalEyebrow}</Eyebrow>
      <Text style={styles.headlineSm}>{reading.educationalTitle}</Text>

      <View style={styles.divider} />
      <Text style={styles.endLine}>{reading.endLine}</Text>
      <View style={styles.linksRow}>
        <Pressable onPress={onGuardar} accessibilityRole="button">
          <Text style={styles.link}>Guardar lectura</Text>
        </Pressable>
        <Text style={styles.linkDot}>·</Text>
        <Pressable onPress={onHistorial} accessibilityRole="button">
          <Text style={styles.link}>Ver lecturas guardadas</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Tramo 05 — Extras (legacy reestilizado): carta del día, color, número, frase. */
export function ExtrasSection({ reading }: { reading: HomeReading }) {
  const { extras } = reading;
  return (
    <View style={[styles.section, styles.extras]}>
      <Eyebrow>EXTRAS</Eyebrow>
      <Text style={styles.headlineSm}>Un cierre lúdico, opcional.</Text>

      <View style={styles.extraCard}>
        <Text style={styles.rowLabel}>CARTA DEL DÍA</Text>
        <Text style={styles.extraTitle}>{extras.tarotCard.name}</Text>
        <Text style={styles.bodyDim}>{extras.tarotCard.meaning}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.rowLabel}>COLOR</Text>
          <Text style={styles.statValue}>{extras.color}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.rowLabel}>NÚMERO</Text>
          <Text style={styles.statValue}>{extras.luckyNumber}</Text>
        </View>
      </View>

      <Text style={styles.mantra}>“{extras.mantra}”</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: G,
    paddingTop: orbita.spacing.md,
    paddingBottom: orbita.spacing.lg
  },
  brand: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 17, letterSpacing: 2 },
  selector: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 14, letterSpacing: 1 },
  headerDivider: { backgroundColor: orbita.colors.line, height: 1 },

  section: { paddingHorizontal: G, paddingTop: orbita.spacing.xl, paddingBottom: orbita.spacing.xxl },
  guiaNebula: { ...StyleSheet.absoluteFillObject },

  eyebrow: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: orbita.spacing.md
  },

  triad: { color: orbita.colors.muted, fontFamily: orbita.fonts.mono, fontSize: 13, lineHeight: 18 },
  triadCentered: { textAlign: "center" },
  triadNote: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.body, fontSize: 12, lineHeight: 16, marginTop: orbita.spacing.sm },
  heroWrap: { alignItems: "center", marginVertical: orbita.spacing.xl },
  hero: {
    marginBottom: orbita.spacing.xl,
    marginHorizontal: -G,
    marginTop: -orbita.spacing.xl,
    overflow: "hidden"
  },
  // La luna entera (asset cuadrado: esfera + anillo) arriba, pegada al header; el degradé
  // la funde a negro y el texto va sobre la parte baja / debajo (como el Figma "Home / Top").
  // Luna fija en la posición del Figma "Home / Top" (entera, borde superior pegado al
  // header). NO se mueve para subir el texto — solo se ajusta paddingTop.
  heroImg: { height: 520, left: -64, position: "absolute", top: -66, width: 520 },
  heroFade: { height: 430, left: 0, position: "absolute", right: 0, top: 0 },
  heroContent: { paddingBottom: orbita.spacing.lg, paddingHorizontal: G, paddingTop: 232 },
  heroTextGap: { height: orbita.spacing.xl },

  headline: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 40, lineHeight: 45 },
  headlineMd: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 34, lineHeight: 41 },
  headlineSm: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 24, lineHeight: 30 },
  body: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 15, lineHeight: 22, marginTop: orbita.spacing.lg },
  bodyDim: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.body, fontSize: 14, lineHeight: 20, marginTop: orbita.spacing.sm },

  divider: { backgroundColor: orbita.colors.line, height: 1, marginVertical: orbita.spacing.xl },
  signalCopy: { color: orbita.colors.bone, fontFamily: orbita.fonts.bodyMedium, fontSize: 15, lineHeight: 21 },

  pillWrap: { alignSelf: "flex-start" },
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

  miniChart: { position: "absolute", right: G - 4, top: orbita.spacing.xl },
  guideRow: { marginBottom: orbita.spacing.md },
  guideRowDivider: { backgroundColor: orbita.colors.line, height: 1, marginBottom: orbita.spacing.lg },
  guideRowBody: { flexDirection: "row", gap: orbita.spacing.xl },
  rowLabel: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 11, letterSpacing: 0.5, width: 72 },
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

  tabs: { flexDirection: "row", gap: orbita.spacing.xl, marginTop: orbita.spacing.xl },
  tabsTop: { marginTop: 0 },
  topicMarker: {
    alignItems: "center",
    borderColor: "rgba(244,238,228,0.28)",
    borderRadius: 13,
    borderWidth: 1,
    height: 26,
    justifyContent: "center",
    marginRight: orbita.spacing.md,
    width: 26
  },
  topicGlyph: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 13 },
  insightBody: { marginLeft: 26 + orbita.spacing.md },
  tab: { alignItems: "center" },
  tabLabel: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 13 },
  tabLabelActive: { color: orbita.colors.copper },
  tabUnderline: { backgroundColor: orbita.colors.copper, borderRadius: 1, height: 2, marginTop: orbita.spacing.sm, width: 34 },

  insightRow: { paddingVertical: 28, borderBottomColor: orbita.colors.line, borderBottomWidth: 1 },
  insightRowDim: { opacity: 0.55 },
  insightHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  insightTitle: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 24, lineHeight: 30, flex: 1 },
  arrow: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 20, marginLeft: orbita.spacing.md },

  thumbnail: {
    alignItems: "center",
    backgroundColor: orbita.colors.surfaceRaised,
    borderRadius: orbita.radius.xl,
    height: 150,
    justifyContent: "center",
    marginTop: orbita.spacing.lg
  },

  endLine: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 20, lineHeight: 26 },
  linksRow: { flexDirection: "row", alignItems: "center", gap: orbita.spacing.md, marginTop: orbita.spacing.md },
  link: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 12 },
  linkDot: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 12 },

  extras: { borderTopColor: orbita.colors.line, borderTopWidth: 1 },
  extraCard: {
    backgroundColor: orbita.colors.surfaceRaised,
    borderRadius: orbita.radius.md,
    marginTop: orbita.spacing.lg,
    padding: orbita.spacing.xl
  },
  extraTitle: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 20, lineHeight: 26, marginTop: orbita.spacing.sm },
  statsRow: { flexDirection: "row", gap: orbita.spacing.md, marginTop: orbita.spacing.md },
  stat: {
    backgroundColor: orbita.colors.surfaceRaised,
    borderRadius: orbita.radius.md,
    flex: 1,
    padding: orbita.spacing.lg
  },
  statValue: { color: orbita.colors.bone, fontFamily: orbita.fonts.bodyMedium, fontSize: 16, marginTop: orbita.spacing.xs },
  mantra: { color: orbita.colors.muted, fontFamily: orbita.fonts.serifRegular, fontSize: 16, lineHeight: 24, marginTop: orbita.spacing.xl },

  labeledBlock: { marginTop: orbita.spacing.xl },
  labeledCopy: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 16, lineHeight: 23, marginTop: orbita.spacing.md }
});
