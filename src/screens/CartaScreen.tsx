/**
 * Pantalla canónica de Órbita: la misma en nativo y en web.
 *
 * Vivía dentro de `app/(tabs)/carta.tsx`, así que la web tenía que mantener su
 * propia versión en paralelo y las dos derivaban. La ruta ahora es un wrapper
 * fino sobre este módulo; no se duplica ninguna pantalla por plataforma.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAction, useQuery } from "convex/react";

import { Body, Divider, Eyebrow, H2, Note, OrbitaScreen, Pill, Section, TabStrip } from "@/components/orbita/kit";
import { Column, Columns, ReadingBlock } from "@/components/orbita/Layout";
import { MeasuredSquare } from "@/components/orbita/ContentCanvas";
import { GuestState } from "@/components/orbita/GuestState";
import { NatalWheel } from "@/components/orbita/NatalWheel";
import { EmptyState, ErrorState, MinimalLoading } from "@/components/orbita/states";
import { AstroGlyph } from "@/components/orbita/AstroGlyph";
import { bodySymbol, RETROGRADE_CODE, type BodyGlyphKey } from "@/domain/astroSymbols";
import { mapNatalChart } from "@/domain/natalChart";
import { personalChartGate } from "@/domain/natalChartGate";
import { cartaGate, type ReadingBlockPhase } from "@/domain/cartaNatalCarga";
import { useNatalReading } from "@/hooks/useNatalReading";
import { filasDeTriada, resumenDeBase } from "@/domain/cartaCompleta";
import { sessionPhase } from "@/domain/screenPhase";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import { useLiveApp } from "@/hooks/useLiveApp";
import {
  appApi,
  type NatalChartPayload,
  type PersonalityReadingPayload,
  type SignPlacement
} from "@/services/appRefs";
import { orbita } from "@/theme/orbita";
import { usePressedState } from "@/components/v492/Touchable";

/**
 * En web, Perfil dejó de ser una sección de la barra: vive dentro de la Carta,
 * y el cierre de esta pantalla es su única entrada desde el chrome. En nativo
 * Perfil sigue siendo una pestaña, así que ahí ese enlace no se dibuja: la
 * pantalla compartida no cambia en nada más.
 */
const IS_WEB = Platform.OS === "web";

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
    <OrbitaScreen canvas="wide">
      {children}
    </OrbitaScreen>
  );
}

/**
 * Estado de la carta natal de la cuenta, compartido por el hub (`CartaLive`) y
 * por la carta completa (`CartaCompletaScreen`): las mismas queries, el mismo
 * gate de datos natales, la misma generación de la lectura larga. Una sola
 * fuente para que las dos pantallas nunca discrepen sobre qué carta es la
 * vigente.
 */
export function useCartaNatal() {
  const doc = useQuery(appApi.charts.current, {});
  // La carta se dibuja sólo si corresponde a los datos natales REMOTOS
  // vigentes. `charts.current` cae a la última carta del usuario cuando no
  // encuentra la exacta, así que después de editar fecha/hora/lugar puede
  // devolver la carta VIEJA (ver `domain/natalChartGate`). Sin esta verificación
  // se presentaba la carta de otros datos como si fuera la actual.
  const remoteBirth = useQuery(appApi.birthData.getCurrent, {});
  const values = useQuery(appApi.charts.valuesMap, {});
  // La lectura larga —query, señal remota, generación, fallo y reintento— vive
  // en UN solo lugar (`@/hooks/useNatalReading`), compartido con la Carta
  // completa V4.9.2 (reconciliación CORE-247).
  const lectura = useNatalReading();

  const gate = cartaGate({ doc, values });
  const chartGate = personalChartGate({ birth: remoteBirth, chart: doc });
  return {
    doc,
    remoteBirth,
    lectura,
    reading: lectura.reading,
    values,
    gate,
    chartGate,
    readingPhase: lectura.phase,
    retryReading: lectura.retry
  };
}

function CartaLive() {
  const carta = useCartaNatal();
  const { doc, remoteBirth, lectura, values, gate, chartGate } = carta;
  if (gate === "cargando" || chartGate === "cargando") {
    return (
      <CartaShell>
        <MinimalLoading />
      </CartaShell>
    );
  }
  if (chartGate === "datosIncompletos") {
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
    return (
      <CartaShell>
        <RecalculateChart reason="missing" />
      </CartaShell>
    );
  }
  if (chartGate === "desactualizada") {
    return (
      <CartaShell>
        <RecalculateChart reason="stale" />
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
  return (
    <CartaView
      payload={payload}
      reading={lectura.reading}
      readingPhase={lectura.phase}
      onRetryReading={lectura.retry}
    />
  );
}

/**
 * Carta que no corresponde a los datos vigentes: se recalcula, no se muestra.
 * `calculateOrCreateNatalChart` devuelve la carta exacta si ya existe y la crea
 * si no, así que reintentar es seguro.
 */
export function RecalculateChart({ reason }: { reason: "missing" | "stale" }) {
  const calculate = useAction(appApi.charts.calculateOrCreateNatalChart);
  const [state, setState] = useState<"idle" | "working" | "failed">("idle");
  const running = useRef(false);
  const autoAttempted = useRef(false);
  const run = useCallback(() => {
    if (running.current) return;
    running.current = true;
    setState("working");
    calculate({})
      .then(() => setState("idle"))
      .catch(() => setState("failed"))
      .finally(() => {
        running.current = false;
      });
  }, [calculate]);

  useEffect(() => {
    if (autoAttempted.current) return;
    autoAttempted.current = true;
    run();
  }, [run]);

  const missing = reason === "missing";
  return (
    <Section>
      <Eyebrow>Tu carta natal</Eyebrow>
      <H2>{missing ? "Estamos preparando tu carta." : "Tu carta tiene que recalcularse."}</H2>
      <Body>
        {state === "failed"
          ? "No pudimos calcularla ahora. Tus datos están guardados: probá de nuevo cuando quieras."
          : missing
            ? "Tus datos de nacimiento ya están guardados. El cálculo puede tardar unos segundos."
            : "Tus datos de nacimiento cambiaron desde el último cálculo. Recalculamos tu carta con los datos actuales."}
      </Body>
      <View style={{ height: orbita.spacing.lg }} />
      <Pill
        label={state === "working" ? "CALCULANDO…" : state === "failed" ? "REINTENTAR" : "CALCULAR MI CARTA"}
        onPress={run}
      />
    </Section>
  );
}

/** Glifo vectorial del cuerpo (ver `domain/astroSymbols`): nunca un carácter
 *  que en web o Android caiga al font de emoji. */
const symbolOf = (p: { key?: string; planet: string }): BodyGlyphKey => bodySymbol({ key: p.key, label: p.planet });
const deg = (n?: number) => (typeof n === "number" ? `${Math.round(n)}°` : "");

const DISCLAIMER = "Órbita es entretenimiento y autoconocimiento.";

/**
 * El hub de Carta (CORE-215): «CARTA · TU BASE», la rueda con la tríada y el
 * resumen de la base natal, y la puerta a la carta completa. Frames
 * `1839:3622` / `1821:3186` (hub, 1440 / 390) y `1837:3524` / `1834:3432`
 * (Free). Una sola carta repartida de dos maneras: en móvil se apila en el
 * orden del frame; en escritorio la base va a la izquierda y las tarjetas de
 * «La carta completa», «Sigue en esta pantalla» y el disclaimer a la derecha.
 *
 * La lectura larga (siete capítulos), los contactos con orbe, las doce casas
 * y el mapa de valores viven en `/reading/carta-completa`; acá el bloque 02
 * dice en qué estado está esa lectura (Plus, preparando, error, lista) y la
 * abre. Nada se maqueta: el resumen cuenta lo que el payload trae.
 */
/** Rótulo derecho y tono de la cabecera del bloque 02 según la fase de la lectura. */
function cabeceraDelBloque(fase: ReadingBlockPhase): { rotulo: string; cobre: boolean } {
  if (fase === "bloqueado") return { rotulo: "SOLO CON ÓRBITA PLUS", cobre: true };
  return { rotulo: fase === "listo" ? "SEIS BLOQUES" : "PREPARANDO", cobre: false };
}

function CartaView({
  payload,
  reading,
  readingPhase,
  onRetryReading
}: {
  payload: NatalChartPayload;
  /** Solo no-null cuando `readingPhase === "listo"`. */
  reading: PersonalityReadingPayload | null;
  readingPhase: ReadingBlockPhase;
  onRetryReading: () => void;
}) {
  const desktop = useIsDesktop();
  const [view, setView] = useState<"circulo" | "tabla">("circulo");
  const [selected, setSelected] = useState<string | undefined>();
  const sel = payload.placements.find((p) => p.key === selected);
  const resumen = resumenDeBase(payload);
  const abrirCompleta = () => router.push("/reading/carta-completa");
  const chapters = reading?.sections.length ?? 0;
  const cabecera = cabeceraDelBloque(readingPhase);
  const bloqueada = cabecera.cobre;

  // --- Piezas -------------------------------------------------------------

  const encabezado = (
    <Section style={{ paddingBottom: orbita.spacing.lg }}>
      <View style={styles.hubHead}>
        <Eyebrow>Carta · Tu base</Eyebrow>
        <Text style={styles.hubHeadRight}>{bloqueada ? "PLAN FREE" : "BASE NATAL"}</Text>
      </View>
      <Body bone>
        {bloqueada
          ? "Tu base natal está completa en Free: la rueda y el trío Sol, Luna y Ascendente. La lectura larga de la carta se abre con Órbita Plus."
          : "Lo que no se mueve. Es el punto de partida contra el que se lee todo lo demás."}
      </Body>
      <Divider style={{ marginBottom: 0 }} />
      <View style={styles.bloqueHead}>
        <Text style={styles.bloqueTitulo}>
          <Text style={styles.bloqueNum}>01 </Text>TU CARTA
        </Text>
        <Text style={styles.hubHeadRight}>{bloqueada ? "DISPONIBLE EN FREE" : "· BASE NATAL"}</Text>
      </View>
    </Section>
  );

  const rueda = (
    <>
      <Section style={{ paddingTop: 0, paddingBottom: 0 }}>
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
            <View style={styles.selLine}>
              <AstroGlyph symbol={symbolOf(sel)} size={17} color={orbita.colors.bone} />
              <Text style={styles.selLineText}>
                {`${sel.planet} en ${sel.sign}${sel.house ? ` · Casa ${sel.house}` : ""}${sel.normDegree != null ? ` · ${deg(sel.normDegree)}` : ""}${sel.isRetrograde ? ` ${RETROGRADE_CODE}` : ""}`}
              </Text>
            </View>
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

  const triada = <CartaTriad triad={payload.triad} />;

  const baseResumen = (
    <Section style={{ paddingTop: orbita.spacing.lg, paddingBottom: 0 }}>
      <Text style={styles.resumenMono}>{resumen}</Text>
      {readingPhase !== "bloqueado" ? (
        <View style={{ marginTop: orbita.spacing.md }}>
          <LinkRow label="VER CARTA COMPLETA" onPress={abrirCompleta} />
        </View>
      ) : null}
    </Section>
  );

  /** Bloque 02: en qué estado está la carta completa (Plus, preparando, error, lista). */
  const completa = (
    <Section style={{ paddingTop: orbita.spacing.xl }}>
      <Divider style={{ marginTop: 0, marginBottom: orbita.spacing.lg }} />
      <View style={styles.bloqueHead}>
        <Text style={styles.bloqueTitulo}>
          <Text style={styles.bloqueNum}>02 </Text>LA CARTA COMPLETA
        </Text>
        <Text style={[styles.hubHeadRight, cabecera.cobre && styles.hubHeadCobre]}>
          {cabecera.rotulo}
        </Text>
      </View>
      {readingPhase !== "listo" ? (
        readingPhase === "cargando" ? (
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
              Diez posiciones con lo que cada una permite afirmar, siete capítulos, aspectos con orbe y doce casas.
            </Text>
            <Text style={styles.readingStatusText}>
              Los siete capítulos de tu carta son parte de Órbita Plus. Tu rueda, tu tríada y tus posiciones siguen acá.
            </Text>
            <View style={styles.skeleton} accessibilityLabel="Contenido bloqueado">
              {[0.55, 0.42, 0.34].map((w) => (
                <View key={w} style={[styles.skeletonLine, { width: `${Math.round(w * 100)}%` }]} />
              ))}
            </View>
            <View style={{ marginTop: orbita.spacing.lg }}>
              <Pill label="DESBLOQUEAR MI CARTA NATAL" onPress={() => router.push("/paywall")} />
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
        )
      ) : (
        <View style={styles.readingStatus}>
          <Text style={styles.readingStatusText}>
            Una sola ruta con seis bloques: la rueda, la precisión natal y los ejes, las diez posiciones, los{" "}
            {chapters > 0 ? `${chapters} capítulos` : "capítulos"}, los aspectos con orbe y las doce casas.
          </Text>
          <View style={{ marginTop: orbita.spacing.md }}>
            <LinkRow label="VER CARTA COMPLETA" onPress={abrirCompleta} />
          </View>
        </View>
      )}
    </Section>
  );

  const cierre = (
    <Section style={{ paddingTop: orbita.spacing.xxl }}>
      <Divider style={{ marginTop: 0 }} />
      <View style={styles.links}>
        <LinkRow label="TRÁNSITOS DE HOY" onPress={() => router.push("/(tabs)/transitos")} />
        {IS_WEB ? <LinkRow label="PERFIL Y CUENTA" onPress={() => router.push("/perfil")} /> : null}
      </View>
      <Note>{payload.accuracy}</Note>
      {payload.limitations.map((l) => (
        <Note key={l}>{l}</Note>
      ))}
      <Note>{DISCLAIMER}</Note>
    </Section>
  );

  // --- Composición --------------------------------------------------------

  if (!desktop) {
    // Móvil y nativo: el orden del frame `1821:3186` (encabezado, rueda,
    // tríada, resumen, la carta completa, cierre). La composición de
    // escritorio no reordena esta pantalla.
    return (
      <CartaShell>
        {encabezado}
        {rueda}
        {triada}
        {baseResumen}
        {completa}
        {cierre}
      </CartaShell>
    );
  }

  // Escritorio (frame `1839:3622`): la base natal —rueda y tríada enfrentadas— a
  // la izquierda a dos tercios; las tarjetas de la carta completa, «sigue en
  // esta pantalla» y el disclaimer a la derecha. Los textos largos quedan a
  // ancho de LECTURA.
  return (
    <CartaShell>
      <Columns gap={orbita.spacing.xxl}>
        <Column weight={2}>
          {encabezado}
          <Columns gap={orbita.spacing.xl} align="center">
            <Column weight={1}>{rueda}</Column>
            <Column weight={1}>
              {triada}
              {baseResumen}
            </Column>
          </Columns>
          {completa}
          <ReadingBlock>{cierre}</ReadingBlock>
        </Column>
        <Column weight={1}>
          <View style={styles.tarjeta}>
            <Text style={styles.tarjetaRotulo}>{bloqueada ? "QUÉ ABRE ÓRBITA PLUS EN CARTA" : "LA CARTA COMPLETA"}</Text>
            <Text style={styles.tarjetaTexto}>
              {bloqueada
                ? "La carta completa: diez posiciones, siete capítulos, aspectos con orbe y doce casas. Tu día y tus tránsitos leídos sobre esta misma carta."
                : "Una sola ruta con seis bloques: la rueda, la precisión natal y los ejes, las diez posiciones, los siete capítulos, los aspectos con orbe y las doce casas."}
            </Text>
            <View style={{ marginTop: orbita.spacing.lg }}>
              {bloqueada ? (
                <Pill label="DESBLOQUEAR MI CARTA NATAL" onPress={() => router.push("/paywall")} />
              ) : (
                <LinkRow label="VER CARTA COMPLETA" onPress={abrirCompleta} />
              )}
            </View>
          </View>
          <View style={styles.tarjeta}>
            <Text style={styles.tarjetaRotulo}>{bloqueada ? "TAMBIÉN EN FREE" : "SIGUE EN ESTA PANTALLA"}</Text>
            <View style={styles.tarjetaFila}>
              <Text style={styles.tarjetaFilaTitulo}>Tu base natal</Text>
              <Text style={styles.tarjetaFilaTexto}>La rueda y el trío Sol, Luna y Ascendente, con signo, grado y casa.</Text>
            </View>
            {IS_WEB ? <FilaPerfil /> : null}
          </View>
          <View style={styles.tarjeta}>
            <Note>{DISCLAIMER}</Note>
          </View>
        </Column>
      </Columns>
    </CartaShell>
  );
}

function CartaTriad({ triad }: { triad: NatalChartPayload["triad"] }) {
  const filas = filasDeTriada({ triad });
  return (
    <View style={styles.triadCard}>
      {filas.map((f, i) => (
        <View key={f.codigo} style={[styles.triadRow, i > 0 && styles.triadRowLinea]}>
          <Text style={styles.triadCodigo}>{f.codigo}</Text>
          <Text style={styles.triadNombre}>{f.nombre}</Text>
          <Text style={styles.triadValor}>{f.valor}</Text>
          <Text style={styles.triadMeta}>{f.meta ?? ""}</Text>
        </View>
      ))}
    </View>
  );
}

function PositionRow({ p }: { p: SignPlacement }) {
  return (
    <View style={styles.posRow}>
      <View style={styles.posMarker}>
        <AstroGlyph symbol={symbolOf(p)} size={16} color={orbita.colors.bone} strokeWidth={2} />
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

/** El acceso a Perfil desde la tarjeta de la Carta (sólo web). */
function FilaPerfil() {
  const presion = usePressedState();
  return (
    <Pressable
      onPress={() => router.push("/perfil")}
      accessibilityRole="link"
      {...presion.pressableProps}
      style={[styles.tarjetaFila, styles.tarjetaFilaLinea, presion.pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.tarjetaFilaTitulo}>Perfil y ajustes</Text>
      <Text style={styles.tarjetaFilaTexto}>Tus datos, tu plan y la eliminación de la cuenta. Se abre desde el avatar, arriba a la derecha.</Text>
    </Pressable>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress?: () => void }) {
  const presion = usePressedState();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" {...presion.pressableProps} style={presion.pressed && { opacity: 0.6 }}>
      <Text style={styles.linkText}>{`${label} →`}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wheelWrap: { alignItems: "center", paddingHorizontal: orbita.spacing.gutter, paddingTop: orbita.spacing.lg },
  selLine: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center", marginTop: orbita.spacing.lg },
  selLineText: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 17, textAlign: "center" },

  triadCard: { marginHorizontal: orbita.spacing.gutter, marginTop: orbita.spacing.lg },
  triadRow: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.md, minHeight: 48, paddingVertical: orbita.spacing.sm },
  triadRowLinea: { borderTopColor: orbita.colors.line, borderTopWidth: 1 },
  triadCodigo: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 10, letterSpacing: 1, width: 24 },
  triadNombre: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 17, width: 110 },
  triadValor: { color: orbita.colors.bone, flex: 1, fontFamily: orbita.fonts.body, fontSize: 15 },
  triadMeta: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 10, letterSpacing: 1, textAlign: "right" },

  hubHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  hubHeadRight: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.monoMedium, fontSize: 10, letterSpacing: 1.2 },
  hubHeadCobre: { color: orbita.colors.copper },
  bloqueHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: orbita.spacing.lg },
  bloqueTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 11, letterSpacing: 1.2 },
  bloqueNum: { color: orbita.colors.copper },
  resumenMono: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 10, letterSpacing: 1.2 },
  skeleton: { marginTop: orbita.spacing.lg, width: "100%" },
  skeletonLine: { backgroundColor: "rgba(244,238,228,0.12)", borderRadius: 3, height: 6, marginBottom: orbita.spacing.md },
  tarjeta: { backgroundColor: orbita.colors.surface, borderColor: orbita.colors.line, borderRadius: orbita.radius.lg, borderWidth: 1, marginBottom: orbita.spacing.lg, padding: orbita.spacing.xl },
  tarjetaRotulo: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 11, letterSpacing: 1.2 },
  tarjetaTexto: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 15, lineHeight: 22, marginTop: orbita.spacing.md },
  tarjetaFila: { paddingVertical: orbita.spacing.md, minHeight: 44 },
  tarjetaFilaLinea: { borderTopColor: orbita.colors.line, borderTopWidth: 1 },
  tarjetaFilaTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 16 },
  tarjetaFilaTexto: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 13, lineHeight: 18, marginTop: 2 },

  posRow: { alignItems: "center", borderBottomColor: orbita.colors.line, borderBottomWidth: 1, flexDirection: "row", paddingVertical: orbita.spacing.md },
  posMarker: { alignItems: "center", borderColor: "rgba(214,154,106,0.5)", borderRadius: 15, borderWidth: 1, height: 30, justifyContent: "center", marginRight: orbita.spacing.md, width: 30 },
  posName: { color: orbita.colors.bone, flex: 1, fontFamily: orbita.fonts.serif, fontSize: 16 },
  posSign: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 13, textAlign: "right", width: 108 },
  posHouse: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 11, textAlign: "right", width: 58 },

  // Estado inline del bloque "Tu carta, explicada" (carga / error+reintento).
  readingStatus: { alignItems: "flex-start", marginTop: orbita.spacing.xl },
  readingStatusText: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 15, lineHeight: 23, marginTop: orbita.spacing.md },

  links: { flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.xl, marginTop: orbita.spacing.xl, marginBottom: orbita.spacing.lg },
  linkText: { color: orbita.colors.muted, fontFamily: orbita.fonts.monoMedium, fontSize: 11, letterSpacing: 1 }
});
