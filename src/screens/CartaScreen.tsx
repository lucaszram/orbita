/**
 * Pantalla canónica de Órbita: la misma en nativo y en web.
 *
 * Vivía dentro de `app/(tabs)/carta.tsx`, así que la web tenía que mantener su
 * propia versión en paralelo y las dos derivaban. La ruta ahora es un wrapper
 * fino sobre este módulo; no se duplica ninguna pantalla por plataforma.
 */
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAction, useQuery } from "convex/react";

import { Body, Divider, Eyebrow, H2, Note, OrbitaScreen, Pill, Section, TabStrip } from "@/components/orbita/kit";
import { Column, Columns, ReadingBlock } from "@/components/orbita/Layout";
import { MeasuredSquare } from "@/components/orbita/ContentCanvas";
import { GuestState } from "@/components/orbita/GuestState";
import { NatalWheel } from "@/components/orbita/NatalWheel";
import { EmptyState, ErrorState, MinimalLoading } from "@/components/orbita/states";
import { bodyCode, RETROGRADE_CODE } from "@/domain/astroSymbols";
import { mapNatalChart } from "@/domain/natalChart";
import { personalChartGate } from "@/domain/natalChartGate";
import { Radar } from "@/components/orbita/Radar";
import { cartaGate, readingBlockPhase, type ReadingBlockPhase } from "@/domain/cartaNatalCarga";
import { sessionPhase } from "@/domain/screenPhase";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import { useLiveApp } from "@/hooks/useLiveApp";
import {
  appApi,
  type NatalChartAspect,
  type NatalChartPayload,
  type PersonalityReadingPayload,
  type PersonalitySection,
  type SignPlacement,
  type ValuesMapPayload
} from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

/**
 * Carta natal — hub de entrada post-onboarding. Junta la carta (rueda real +
 * tríada + posiciones + aspectos + casas) y conecta a las partes distribuidas de
 * la app. Con sesión, data real de `charts.current`; invitado → estado honesto.
 */
export function CartaScreen() {
  const live = useLiveApp();
  const phase = sessionPhase(live);
  // Sin mocks: invitado confirmado → estado honesto. Mientras la sesión
  // resuelve o reconecta → carga mínima; sesión rota → error + retry.
  if (phase === "cargando") {
    return (
      <CartaShell>
        <MinimalLoading />
      </CartaShell>
    );
  }
  if (phase === "error") {
    return (
      <CartaShell>
        <ErrorState onRetry={live.retryUser} />
      </CartaShell>
    );
  }
  if (phase === "invitado") {
    // Sin mocks: estado honesto de invitado, nunca la carta demo como si fuera tuya.
    return (
      <CartaShell>
        <GuestState
          eyebrow="TU CARTA NATAL"
          title={"Tu carta se calcula\ncon tu cuenta."}
          body="Órbita usa tu fecha, hora y lugar de nacimiento reales para dibujar tu carta natal completa y explicártela."
        />
      </CartaShell>
    );
  }
  return <CartaLive />;
}

/**
 * Shell de la pantalla. El lienzo de contenido lo monta `OrbitaScreen` para
 * TODAS sus pantallas, así que acá ya no se repite. Variante `wide`: en
 * escritorio la rueda y la interpretación se enfrentan en dos columnas
 * (Figma `252:2`); en móvil apilan igual que hoy.
 */
function CartaShell({ children }: { children: ReactNode }) {
  return (
    <OrbitaScreen right="Carta" canvas="wide">
      {children}
    </OrbitaScreen>
  );
}

function CartaLive() {
  const doc = useQuery(appApi.charts.current, {});
  // La carta se dibuja sólo si corresponde a los datos natales REMOTOS
  // vigentes. `charts.current` cae a la última carta del usuario cuando no
  // encuentra la exacta, así que después de editar fecha/hora/lugar puede
  // devolver la carta VIEJA (ver `domain/natalChartGate`). Sin esta verificación
  // se presentaba la carta de otros datos como si fuera la actual.
  const remoteBirth = useQuery(appApi.birthData.getCurrent, {});
  const reading = useQuery(appApi.charts.personalityReading, {});
  // Señal reactiva de la generación (pending/ready/error): si el prewarm del
  // backend tomó el claim y FALLÓ, acá llega `error` y el bloque de lectura
  // ofrece reintento en vez de quedar en "Preparando…" para siempre.
  const readingState = useQuery(appApi.charts.personalityReadingState, {});
  const values = useQuery(appApi.charts.valuesMap, {});
  // Dispara la generación LLM natal (no-opea si ya está cacheada o no hay
  // carta; una resolución `{ status: "pending" }` significa que el prewarm del
  // backend ya la está generando y NO es error). Si REJECTA, el bloque de
  // lectura lo dice inline con REINTENTAR — sin esto, "reading" quedaría null
  // para siempre y la carga sería eterna. El reintento limpia el fallo local y
  // vuelve a disparar la action; `generating` cubre la ventana hasta que el
  // backend pise el `error` remoto de la ronda anterior.
  const generate = useAction(appApi.charts.generatePersonalityReading);
  const [generateFailed, setGenerateFailed] = useState(false);
  const [generating, setGenerating] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setGenerateFailed(false);
    setGenerating(true);
    generate({})
      .catch(() => {
        if (alive) setGenerateFailed(true);
      })
      .finally(() => {
        if (alive) setGenerating(false);
      });
    return () => {
      alive = false;
    };
  }, [generate, attempt]);

  // Gate GENERAL: solo carta + mapa de valores (llegan en <1 s). La lectura
  // larga (40–61 s) NO participa: nunca devuelve la pantalla a MinimalLoading.
  const gate = cartaGate({ doc, values });
  // Gate de IDENTIDAD de la carta: datos remotos completos + carta que coincide.
  const chartGate = personalChartGate({ birth: remoteBirth, chart: doc });
  if (gate === "cargando" || chartGate === "cargando") {
    return (
      <CartaShell>
        <MinimalLoading />
      </CartaShell>
    );
  }
  if (chartGate === "datosIncompletos") {
    // Sin datos natales completos no hay carta posible: se pide el dato que
    // falta, no se dibuja una rueda aproximada.
    return (
      <CartaShell>
        <EmptyState
          eyebrow="TU CARTA NATAL"
          title="Faltan tus datos de nacimiento"
          body="Tu carta se calcula con tu fecha, tu hora y tu lugar de nacimiento. Completalos y la dibujamos."
          cta="EDITAR DATOS"
          onCta={() => router.push("/editar-datos")}
        />
      </CartaShell>
    );
  }
  if (gate === "vacio" || chartGate === "sinCarta") {
    // El backend confirmó que no hay carta: vacío real.
    return (
      <CartaShell>
        <EmptyState
          eyebrow="TU CARTA NATAL"
          title="Todavía no hay carta"
          body="Completá tu fecha, hora y lugar de nacimiento para calcular tu carta natal."
          cta="COMPLETAR MIS DATOS"
          onCta={() => router.push("/(tabs)/perfil")}
        />
      </CartaShell>
    );
  }
  if (chartGate === "desactualizada") {
    // Hay una carta, pero no es la de estos datos (o no se puede probar que lo
    // sea). Se ofrece recalcularla —la action es idempotente por cacheKey— en
    // vez de mostrar la vieja como si fuera la actual.
    return (
      <CartaShell>
        <RecalculateChart />
      </CartaShell>
    );
  }
  let payload: NatalChartPayload;
  try {
    payload = mapNatalChart(doc);
  } catch {
    return (
      <CartaShell>
        <ErrorState />
      </CartaShell>
    );
  }
  // La lectura larga resuelve INLINE dentro de "Tu carta, explicada":
  // pendiente → carga inline; reject del generador o `error` remoto → error
  // inline con REINTENTAR; lista → los siete capítulos intactos.
  const readingPhase = readingBlockPhase({
    reading,
    failed: generateFailed,
    generating,
    state: readingState?.status
  });
  return (
    <CartaView
      payload={payload}
      reading={readingPhase === "listo" ? reading! : null}
      readingPhase={readingPhase}
      onRetryReading={() => setAttempt((a) => a + 1)}
      values={values ?? null}
    />
  );
}

/**
 * Carta que no corresponde a los datos vigentes: se recalcula, no se muestra.
 * `calculateOrCreateNatalChart` devuelve la carta exacta si ya existe y la crea
 * si no, así que reintentar es seguro.
 */
function RecalculateChart() {
  const calculate = useAction(appApi.charts.calculateOrCreateNatalChart);
  const [state, setState] = useState<"idle" | "working" | "failed">("idle");
  const run = () => {
    if (state === "working") return;
    setState("working");
    calculate({})
      .then(() => setState("idle"))
      .catch(() => setState("failed"));
  };
  return (
    <Section>
      <Eyebrow>Tu carta natal</Eyebrow>
      <H2>Tu carta tiene que recalcularse.</H2>
      <Body>
        {state === "failed"
          ? "No pudimos recalcularla. Tus datos están guardados: probá de nuevo."
          : "Tus datos de nacimiento cambiaron desde el último cálculo. Recalculamos tu carta con los datos actuales."}
      </Body>
      <View style={{ height: orbita.spacing.lg }} />
      <Pill
        label={state === "working" ? "RECALCULANDO…" : state === "failed" ? "REINTENTAR" : "RECALCULAR MI CARTA"}
        onPress={run}
      />
    </Section>
  );
}

// --- Vista ---------------------------------------------------------------

/** Código monocromo del cuerpo (ver `domain/astroSymbols`): nunca un glifo que
 *  en web o Android cae al font de emoji. */
const glyphOf = (p: { key?: string; planet: string }) => bodyCode({ key: p.key, label: p.planet });
const deg = (n?: number) => (typeof n === "number" ? `${Math.round(n)}°` : "");

function CartaView({
  payload,
  reading,
  readingPhase,
  onRetryReading,
  values
}: {
  payload: NatalChartPayload;
  /** Solo no-null cuando `readingPhase === "listo"`. */
  reading: PersonalityReadingPayload | null;
  readingPhase: ReadingBlockPhase;
  onRetryReading: () => void;
  values: ValuesMapPayload | null;
}) {
  const desktop = useIsDesktop();
  const [view, setView] = useState<"circulo" | "tabla">("circulo");
  const [selected, setSelected] = useState<string | undefined>();
  const sel = payload.placements.find((p) => p.key === selected);
  const aspects = payload.mainAspects ?? payload.aspects ?? [];
  const angular = payload.houses.filter((h) => [1, 4, 7, 10].includes(h.house)).sort((a, b) => a.house - b.house);
  // La explicación completa va VISIBLE (sector por sector). En móvil el mapa de
  // valores se intercala en el medio, como hasta ahora.
  const sections = reading?.sections ?? [];
  const mid = Math.ceil(sections.length / 2);
  const sectionsA = sections.slice(0, mid);
  const sectionsB = sections.slice(mid);

  // --- Piezas -------------------------------------------------------------
  // Las mismas en las dos composiciones: no hay una Carta de web y otra de
  // teléfono, hay una sola carta repartida de dos maneras.

  const encabezado = (
    <Section style={{ paddingBottom: orbita.spacing.lg }}>
      <Eyebrow>Tu carta natal</Eyebrow>
      <H2>Tu mapa de origen.</H2>
    </Section>
  );

  const triada = <CartaTriad triad={payload.triad} />;

  const rueda = (
    <>
      <Section style={{ paddingTop: orbita.spacing.lg, paddingBottom: 0 }}>
        <TabStrip
          tabs={[{ key: "circulo", label: "CÍRCULO" }, { key: "tabla", label: "TABLA" }]}
          active={view}
          onChange={setView}
        />
      </Section>

      {view === "circulo" ? (
        <View style={styles.wheelWrap}>
          {/* El lado sale del CONTENEDOR medido, nunca del ancho de la ventana:
              en escritorio ese contenedor es esta columna, no el lienzo. */}
          <MeasuredSquare max={360}>
            {(size) => (
              <NatalWheel
                payload={payload}
                size={size}
                selectedKey={selected}
                onSelect={(k) => setSelected((cur) => (cur === k ? undefined : k))}
              />
            )}
          </MeasuredSquare>
          {sel ? (
            <Text style={styles.selLine}>
              {`${glyphOf(sel)}  ${sel.planet} en ${sel.sign}${sel.house ? ` · Casa ${sel.house}` : ""}${sel.normDegree != null ? ` · ${deg(sel.normDegree)}` : ""}${sel.isRetrograde ? ` ${RETROGRADE_CODE}` : ""}`}
            </Text>
          ) : (
            <Note>Tocá un planeta para verlo en la tabla.</Note>
          )}
        </View>
      ) : (
        <Section style={{ paddingTop: orbita.spacing.lg }}>
          {payload.placements.map((p) => (
            <PositionRow key={p.key ?? p.planet} p={p} />
          ))}
        </Section>
      )}
    </>
  );

  const mapaDeValores = values ? (
    <Section style={{ paddingTop: orbita.spacing.xl }}>
      <Eyebrow>Mapa de valores</Eyebrow>
      <Body>Qué te impulsa y qué te pesa, leído desde tu carta.</Body>
      <View style={styles.radarWrap}>
        <MeasuredSquare max={340}>{(size) => <Radar payload={values} size={size} />}</MeasuredSquare>
      </View>
      <Body>{values.note}</Body>
    </Section>
  ) : null;

  /** "Tu carta, explicada": estado inline (carga / plan / error) o los capítulos. */
  const explicada = (chapters: PersonalitySection[], from: number, titled: boolean) => {
    if (readingPhase !== "listo") {
      if (!titled) return null;
      return (
        <Section style={{ paddingTop: orbita.spacing.xxl }}>
          <Eyebrow>Tu carta, explicada</Eyebrow>
          {readingPhase === "cargando" ? (
            <View style={styles.readingStatus}>
              <ActivityIndicator color={orbita.colors.copper} />
              <Text style={styles.readingStatusText}>Preparando tu lectura…</Text>
            </View>
          ) : readingPhase === "bloqueado" ? (
            // El plan no incluye la lectura larga. Sin esto quedaba en
            // "Preparando…" para siempre o pedía REINTENTAR sobre una action
            // que el backend rechaza por diseño. La rueda, la tríada y las
            // posiciones ya se dibujaron arriba: este bloque solo nombra lo
            // que falta y da la salida a Plus, nunca REINTENTAR (no es un error).
            <View style={styles.readingStatus}>
              <Text style={styles.readingStatusText}>
                Los siete capítulos de tu carta son parte de Órbita Plus. Tu rueda, tu tríada y tus
                posiciones siguen acá.
              </Text>
              <View style={{ marginTop: orbita.spacing.lg }}>
                <Pill label="VER ÓRBITA PLUS" onPress={() => router.push("/paywall")} />
              </View>
            </View>
          ) : (
            <View style={styles.readingStatus}>
              <Text style={styles.readingStatusText}>
                Tu lectura no llegó. La carta sigue acá: probá de nuevo.
              </Text>
              <View style={{ marginTop: orbita.spacing.lg }}>
                <Pill label="REINTENTAR" onPress={onRetryReading} />
              </View>
            </View>
          )}
        </Section>
      );
    }
    if (chapters.length === 0) return null;
    return (
      <Section style={{ paddingTop: titled ? orbita.spacing.xxl : orbita.spacing.xl }}>
        {titled ? <Eyebrow>Tu carta, explicada</Eyebrow> : null}
        {chapters.map((s, i) => (
          <SectorBlock key={s.key} s={s} n={from + i} />
        ))}
      </Section>
    );
  };

  const aspectos =
    aspects.length > 0 ? (
      <Section style={{ paddingTop: orbita.spacing.xxl }}>
        <Eyebrow>Aspectos principales</Eyebrow>
        {aspects.map((a, i) => (
          <AspectRow key={i} a={a} />
        ))}
      </Section>
    ) : null;

  const casas =
    angular.length > 0 ? (
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
    ) : null;

  const cierre = (
    <Section style={{ paddingTop: orbita.spacing.xxl }}>
      <Divider style={{ marginTop: 0 }} />
      <View style={styles.links}>
        <LinkRow label="TRÁNSITOS DE HOY" onPress={() => router.push("/(tabs)/transitos")} />
      </View>
      <Note>{payload.accuracy}</Note>
      {payload.limitations.map((l) => (
        <Note key={l}>{l}</Note>
      ))}
      {reading ? <Note>{reading.disclaimer}</Note> : null}
    </Section>
  );

  // --- Composición --------------------------------------------------------

  if (!desktop) {
    // Móvil y nativo: EXACTAMENTE el mismo orden de siempre. La composición de
    // escritorio no reordena la pantalla aprobada del teléfono.
    return (
      <CartaShell>
        {encabezado}
        {triada}
        {rueda}
        {explicada(sectionsA, 1, true)}
        {mapaDeValores}
        {explicada(sectionsB, mid + 1, false)}
        {aspectos}
        {casas}
        {cierre}
      </CartaShell>
    );
  }

  // Escritorio (Figma `252:2`): la carta dibujada a la izquierda —rueda/tabla y
  // radar, las dos piezas medidas por su contenedor—, la interpretación a la
  // derecha. Los capítulos largos van abajo, a ancho de LECTURA: a 1200px de
  // ancho un párrafo de siete líneas no se lee.
  return (
    <CartaShell>
      {encabezado}
      <Columns gap={0}>
        <Column>
          {rueda}
          {mapaDeValores}
        </Column>
        <Column>
          {triada}
          {aspectos}
          {casas}
          {cierre}
        </Column>
      </Columns>
      <ReadingBlock>
        {explicada(sectionsA, 1, true)}
        {explicada(sectionsB, mid + 1, false)}
      </ReadingBlock>
    </CartaShell>
  );
}

/** Bloque de explicación por punto de la carta (sector): glifo + placement + título
 *  + lectura + preguntas. Visible, sin colapsar. */
function SectorBlock({ s, n }: { s: PersonalitySection; n: number }) {
  return (
    <View style={styles.sector}>
      <Text style={styles.sectorNum}>{`Sector ${String(n).padStart(2, "0")}`}</Text>
      <View style={styles.sectorHead}>
        <View style={styles.sectorMarker}>
          <Text style={styles.sectorGlyph}>{bodyCode({ label: s.placement.label })}</Text>
        </View>
        <Text style={styles.sectorPlacement}>
          {`${s.placement.planet} en ${s.placement.sign ?? ""}${s.placement.house ? ` · Casa ${s.placement.house}` : ""}`.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.sectorTitle}>{s.title}</Text>
      <Text style={styles.sectorBody}>{s.body}</Text>
      {s.questions?.length ? (
        <View style={styles.sectorQuestions}>
          {s.questions.map((q) => (
            <Text key={q} style={styles.sectorQ}>{`— ${q}`}</Text>
          ))}
        </View>
      ) : null}
    </View>
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
        {p.isRetrograde ? ` ${RETROGRADE_CODE}` : ""}
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
  triadGlyph: { color: orbita.colors.copperSoft, fontFamily: orbita.fonts.monoMedium, fontSize: 15, letterSpacing: 1 },
  triadRole: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 10, letterSpacing: 0.6, marginTop: orbita.spacing.sm },
  triadSign: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 18, marginTop: 4 },
  triadHouse: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 11, marginTop: 2 },

  posRow: { alignItems: "center", borderBottomColor: orbita.colors.line, borderBottomWidth: 1, flexDirection: "row", paddingVertical: orbita.spacing.md },
  posMarker: { alignItems: "center", borderColor: "rgba(214,154,106,0.5)", borderRadius: 15, borderWidth: 1, height: 30, justifyContent: "center", marginRight: orbita.spacing.md, width: 30 },
  // Los símbolos son códigos de dos letras en la mono empaquetada.
  posGlyph: { color: orbita.colors.bone, fontFamily: orbita.fonts.mono, fontSize: 11, letterSpacing: 0.5 },
  posName: { color: orbita.colors.bone, flex: 1, fontFamily: orbita.fonts.serif, fontSize: 16 },
  posSign: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 13, textAlign: "right", width: 108 },
  posHouse: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 11, textAlign: "right", width: 58 },
  radarWrap: { alignItems: "center", marginVertical: orbita.spacing.lg },

  // Estado inline del bloque "Tu carta, explicada" (carga / error+reintento).
  readingStatus: { alignItems: "flex-start", marginTop: orbita.spacing.xl },
  readingStatusText: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 15, lineHeight: 23, marginTop: orbita.spacing.md },

  // Bloque de explicación por sector (visible, sin colapsar).
  sector: { marginTop: orbita.spacing.xl },
  sectorNum: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 11, letterSpacing: 1.5 },
  sectorHead: { alignItems: "center", flexDirection: "row", marginTop: orbita.spacing.md },
  sectorMarker: { alignItems: "center", borderColor: "rgba(214,154,106,0.5)", borderRadius: 16, borderWidth: 1, height: 32, justifyContent: "center", marginRight: orbita.spacing.md, width: 32 },
  sectorGlyph: { color: orbita.colors.bone, fontFamily: orbita.fonts.mono, fontSize: 11, letterSpacing: 0.5 },
  sectorPlacement: { color: orbita.colors.copperSoft, flex: 1, fontFamily: orbita.fonts.monoMedium, fontSize: 11, letterSpacing: 1 },
  sectorTitle: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 22, lineHeight: 28, marginTop: orbita.spacing.md },
  sectorBody: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 15, lineHeight: 23, marginTop: orbita.spacing.sm },
  sectorQuestions: { borderTopColor: orbita.colors.line, borderTopWidth: 1, marginTop: orbita.spacing.lg, paddingTop: orbita.spacing.lg },
  sectorQ: { color: orbita.colors.bone, fontFamily: orbita.fonts.serifRegular, fontSize: 16, lineHeight: 24, marginBottom: orbita.spacing.sm },

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
