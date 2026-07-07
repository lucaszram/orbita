import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";

import { Body, Divider, Eyebrow, H2, Note, OrbitaScreen, Pill, Section, TabStrip } from "@/components/orbita/kit";
import { glyphFor } from "@/components/orbita/GlyphRow";
import { NatalWheel } from "@/components/orbita/NatalWheel";
import { EmptyState, ErrorState, LoadingState } from "@/components/orbita/states";
import { mapNatalChart } from "@/components/web/orbita-chart";
import { chartMock } from "@/content/chartMock";
import { useLiveApp } from "@/hooks/useLiveApp";
import { appApi, type NatalChartAspect, type NatalChartPayload, type SignPlacement } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

/**
 * Carta natal — hub de entrada post-onboarding. Junta la carta (rueda real +
 * tríada + posiciones + aspectos + casas) y conecta a las partes distribuidas de
 * la app. Con sesión, data real de `charts.current`; invitado → demo (chartMock).
 */
export default function CartaScreen() {
  const { isLive } = useLiveApp();
  if (!isLive) return <CartaView payload={chartMock} />;
  return <CartaLive />;
}

function CartaLive() {
  const doc = useQuery(appApi.charts.current, {});
  if (doc === undefined) {
    return (
      <OrbitaScreen right="Carta">
        <LoadingState />
      </OrbitaScreen>
    );
  }
  if (doc === null) {
    return (
      <OrbitaScreen right="Carta">
        <EmptyState
          title="Todavía no hay carta"
          body="Completá tu fecha, hora y lugar de nacimiento para calcular tu carta natal."
          cta="COMPLETAR MIS DATOS"
          onCta={() => router.push("/(tabs)/perfil")}
        />
      </OrbitaScreen>
    );
  }
  let payload: NatalChartPayload;
  try {
    payload = mapNatalChart(doc);
  } catch {
    return (
      <OrbitaScreen right="Carta">
        <ErrorState />
      </OrbitaScreen>
    );
  }
  return <CartaView payload={payload} />;
}

// --- Vista ---------------------------------------------------------------

const PLANET_GLYPH: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂", jupiter: "♃", saturn: "♄",
  uranus: "♅", neptune: "♆", pluto: "♇", ascendant: "↑", node: "☊", chiron: "⚷"
};
const glyphOf = (p: { key?: string; planet: string }) => (p.key && PLANET_GLYPH[p.key]) || glyphFor(p.planet);
const deg = (n?: number) => (typeof n === "number" ? `${Math.round(n)}°` : "");

function CartaView({ payload }: { payload: NatalChartPayload }) {
  const { width } = useWindowDimensions();
  const [view, setView] = useState<"circulo" | "tabla">("circulo");
  const [selected, setSelected] = useState<string | undefined>();
  const wheelSize = Math.min(width - orbita.spacing.gutter * 2, 360);
  const sel = payload.placements.find((p) => p.key === selected);
  const aspects = payload.mainAspects ?? payload.aspects ?? [];
  const angular = payload.houses.filter((h) => [1, 4, 7, 10].includes(h.house)).sort((a, b) => a.house - b.house);

  return (
    <OrbitaScreen right="Carta">
      <Section style={{ paddingBottom: orbita.spacing.lg }}>
        <Eyebrow>Tu carta natal</Eyebrow>
        <H2>Tu mapa de origen.</H2>
      </Section>

      <CartaTriad triad={payload.triad} />

      <Section style={{ paddingTop: orbita.spacing.lg, paddingBottom: 0 }}>
        <TabStrip
          tabs={[{ key: "circulo", label: "CÍRCULO" }, { key: "tabla", label: "TABLA" }]}
          active={view}
          onChange={setView}
        />
      </Section>

      {view === "circulo" ? (
        <View style={styles.wheelWrap}>
          <NatalWheel
            payload={payload}
            size={wheelSize}
            selectedKey={selected}
            onSelect={(k) => setSelected((cur) => (cur === k ? undefined : k))}
          />
          {sel ? (
            <Text style={styles.selLine}>
              {`${glyphOf(sel)}  ${sel.planet} en ${sel.sign}${sel.house ? ` · Casa ${sel.house}` : ""}${sel.normDegree != null ? ` · ${deg(sel.normDegree)}` : ""}${sel.isRetrograde ? " ℞" : ""}`}
            </Text>
          ) : (
            <Note>Tocá un planeta para ver su posición.</Note>
          )}
        </View>
      ) : (
        <Section style={{ paddingTop: orbita.spacing.lg }}>
          {payload.placements.map((p) => (
            <PositionRow key={p.key ?? p.planet} p={p} />
          ))}
        </Section>
      )}

      {aspects.length > 0 ? (
        <Section style={{ paddingTop: orbita.spacing.xxl }}>
          <Eyebrow>Aspectos principales</Eyebrow>
          {aspects.map((a, i) => (
            <AspectRow key={i} a={a} />
          ))}
        </Section>
      ) : null}

      {angular.length > 0 ? (
        <Section style={{ paddingTop: orbita.spacing.xxl }}>
          <Eyebrow>Casas angulares</Eyebrow>
          {angular.map((h) => (
            <View key={h.house} style={styles.houseRow}>
              <Text style={styles.houseNum}>{`Casa ${h.house}`}</Text>
              <View style={styles.houseBody}>
                <Text style={styles.houseSign}>{h.sign}</Text>
                {h.theme ? <Text style={styles.houseTheme}>{h.theme}</Text> : null}
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      <Section style={{ paddingTop: orbita.spacing.xxl }}>
        <Divider style={{ marginTop: 0 }} />
        <Body bone>Tu carta se lee en toda la app.</Body>
        <View style={{ height: orbita.spacing.lg }} />
        <Pill label="LEER MI HORÓSCOPO DE PERSONALIDAD" onPress={() => router.push("/reading/personalidad")} />
        <View style={styles.links}>
          <LinkRow label="MAPA DE VALORES" onPress={() => router.push("/reading/valores")} />
          <LinkRow label="TRÁNSITOS DE HOY" onPress={() => router.push("/(tabs)/transitos")} />
        </View>
        <Note>{payload.accuracy}</Note>
        {payload.limitations.map((l) => (
          <Note key={l}>{l}</Note>
        ))}
      </Section>
    </OrbitaScreen>
  );
}

function CartaTriad({ triad }: { triad: NatalChartPayload["triad"] }) {
  const cells: Array<{ role: string; p: SignPlacement }> = [
    { role: "Sol", p: triad.sun },
    { role: "Luna", p: triad.moon },
    { role: "Ascendente", p: triad.ascendant }
  ];
  return (
    <View style={styles.triadCard}>
      {cells.map(({ role, p }, i) => (
        <View key={role} style={[styles.triadCell, i > 0 && styles.triadCellBorder]}>
          <Text style={styles.triadGlyph}>{glyphOf(p)}</Text>
          <Text style={styles.triadRole}>{role.toUpperCase()}</Text>
          <Text style={styles.triadSign}>{p.sign}</Text>
          {p.house ? <Text style={styles.triadHouse}>{`Casa ${p.house}`}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function PositionRow({ p }: { p: SignPlacement }) {
  return (
    <View style={styles.posRow}>
      <View style={styles.posMarker}>
        <Text style={styles.posGlyph}>{glyphOf(p)}</Text>
      </View>
      <Text style={styles.posName}>{p.planet}</Text>
      <Text style={styles.posSign}>
        {p.sign}
        {p.normDegree != null ? ` ${deg(p.normDegree)}` : ""}
        {p.isRetrograde ? " ℞" : ""}
      </Text>
      <Text style={styles.posHouse}>{p.house ? `Casa ${p.house}` : "—"}</Text>
    </View>
  );
}

function AspectRow({ a }: { a: NatalChartAspect }) {
  return (
    <View style={styles.aspRow}>
      <View style={[styles.aspDot, { backgroundColor: a.harmony === "tension" ? orbita.colors.tension : orbita.colors.harmony }]} />
      <Text style={styles.aspText}>{`${a.from} ${a.typeEs ?? a.type} ${a.to}`}</Text>
      {a.orb != null ? <Text style={styles.aspOrb}>{`orbe ${deg(a.orb)}`}</Text> : null}
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <Text style={styles.linkText}>{`${label} →`}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wheelWrap: { alignItems: "center", paddingHorizontal: orbita.spacing.gutter, paddingTop: orbita.spacing.lg },
  selLine: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 17, marginTop: orbita.spacing.lg, textAlign: "center" },

  triadCard: {
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    marginHorizontal: orbita.spacing.gutter,
    paddingVertical: orbita.spacing.xl
  },
  triadCell: { alignItems: "center", flex: 1, paddingHorizontal: 4 },
  triadCellBorder: { borderLeftColor: orbita.colors.line, borderLeftWidth: 1 },
  triadGlyph: { color: orbita.colors.copperSoft, fontSize: 22 },
  triadRole: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 10, letterSpacing: 0.6, marginTop: orbita.spacing.sm },
  triadSign: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 18, marginTop: 4 },
  triadHouse: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 11, marginTop: 2 },

  posRow: { alignItems: "center", borderBottomColor: orbita.colors.line, borderBottomWidth: 1, flexDirection: "row", paddingVertical: orbita.spacing.md },
  posMarker: { alignItems: "center", borderColor: "rgba(214,154,106,0.5)", borderRadius: 15, borderWidth: 1, height: 30, justifyContent: "center", marginRight: orbita.spacing.md, width: 30 },
  posGlyph: { color: orbita.colors.bone, fontSize: 14 },
  posName: { color: orbita.colors.bone, flex: 1, fontFamily: orbita.fonts.serif, fontSize: 16 },
  posSign: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 13, textAlign: "right", width: 108 },
  posHouse: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 11, textAlign: "right", width: 58 },

  aspRow: { alignItems: "center", flexDirection: "row", paddingVertical: orbita.spacing.sm },
  aspDot: { borderRadius: 3, height: 6, marginRight: orbita.spacing.md, width: 6 },
  aspText: { color: orbita.colors.bone, flex: 1, fontFamily: orbita.fonts.body, fontSize: 14 },
  aspOrb: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 11 },

  houseRow: { alignItems: "center", borderBottomColor: orbita.colors.line, borderBottomWidth: 1, flexDirection: "row", paddingVertical: orbita.spacing.md },
  houseNum: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 11, letterSpacing: 0.5, width: 64 },
  houseBody: { flex: 1 },
  houseSign: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 16 },
  houseTheme: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 13, marginTop: 1 },

  links: { flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.xl, marginTop: orbita.spacing.xl, marginBottom: orbita.spacing.lg },
  linkText: { color: orbita.colors.muted, fontFamily: orbita.fonts.monoMedium, fontSize: 11, letterSpacing: 1 }
});
