/**
 * **Tu momento · Estación vital** — la fase de la lunación progresada
 * (CORE-209). Frames `1740:2308` (390) y `2023:2900` (1440): el nombre de la
 * fase con su emblema, «ETAPA VITAL · ~3,7 AÑOS», las secciones de lectura
 * (qué marca ahora, qué pone al frente, qué se abre y qué se cierra, cómo
 * usarlo, para observar) y «Los datos de la fase» con la barra de avance y
 * las fechas reales. En escritorio, las tarjetas laterales de Tu momento, «De
 * dónde sale cada capa», «Lo que este cálculo no dice» y el método.
 *
 * Todo sale de `momento.getEstacionVital({ localDate })`: el cálculo publica
 * fase, ángulo, fechas y su precisión; la copy (Build 30, portada de la línea
 * release) sólo pone palabras a la fase que el cálculo certificó. Sin hora
 * exacta, los bordes se muestran como rango y la pantalla lo dice. Free
 * recibe `locked`.
 */
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAction } from "convex/react";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Column, Columns, ReadingBlock } from "@/components/orbita/Layout";
import { GuestState } from "@/components/orbita/GuestState";
import { EmptyState, ErrorState, MinimalLoading } from "@/components/orbita/states";
import { PBoton, PEncabezado, PEnlace, PEtiqueta, PNota, PPlegable, PTarjeta, PTexto } from "@/components/transitos/PanoramaUI";
import {
  READING_NOW_HEADING,
  READING_QUESTION_HEADING,
  READING_THEME_HEADING,
  READING_USE_HEADING,
  SEASON_CYCLE_HEADING,
  SEASON_DATA_HEADING,
  SEASON_TRACE,
  anguloProgresado,
  bordeDeFase,
  copyDeSinDatos,
  decimalEs,
  estadoDeEstacion,
  etiquetaDeEtapa,
  seasonReading,
  type EstacionEstado
} from "@/domain/momento";
import { sessionPhase } from "@/domain/screenPhase";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useCanonicalLocalDate } from "@/hooks/useDailyContext";
import { proposedApi, type EstacionVital, type MomentoEstacionVital } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

const DISCLAIMER = "Órbita es entretenimiento y autoconocimiento.";

export const CAPAS_DE_TU_MOMENTO: ReadonlyArray<{ n: string; label: string }> = [
  { n: "01", label: "TU ESTACIÓN VITAL" },
  { n: "02", label: "TEMA DE TU AÑO" },
  { n: "03", label: "TUS CUATRO RITMOS" }
];

export const DE_DONDE_SALE: ReadonlyArray<{ rotulo: string; texto: string }> = [
  { rotulo: "ESTACIÓN VITAL", texto: "Del ciclo largo entre tu Sol y tu Luna progresados." },
  { rotulo: "TEMA DEL AÑO", texto: "De la casa de tu carta que toca tu edad de hoy, y del planeta que la rige." },
  { rotulo: "CUATRO RITMOS", texto: "De los cuatro ciclos que Órbita mide sobre la misma carta." }
];

export function EstacionVitalScreen() {
  const live = useLiveApp();
  const phase = sessionPhase(live);
  if (phase === "cargando") {
    return (
      <Shell>
        <MinimalLoading />
      </Shell>
    );
  }
  if (phase === "error") {
    return (
      <Shell>
        <ErrorState onRetry={live.retryUser} />
      </Shell>
    );
  }
  if (phase === "invitado") {
    return (
      <Shell>
        <GuestState eyebrow="TU MOMENTO" title={"Los ciclos lentos\nsobre tu carta."} body="Entrá para leer tu estación vital sobre tus datos de nacimiento." />
      </Shell>
    );
  }
  return <EstacionVitalLive />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <DetailScreen eyebrow="Tu momento · Capa 01" canvas="wide">
      {children}
    </DetailScreen>
  );
}

function EstacionVitalLive() {
  const getEstacion = useAction(proposedApi.momentoEstacionVital);
  const [estado, setEstado] = useState<EstacionEstado>({ kind: "cargando" });
  const [intento, setIntento] = useState(0);
  const localDate = useCanonicalLocalDate();

  useEffect(() => {
    if (!localDate) return;
    let vivo = true;
    setEstado({ kind: "cargando" });
    getEstacion({ localDate })
      .then((r: MomentoEstacionVital) => {
        if (vivo) setEstado(estadoDeEstacion(r));
      })
      .catch(() => {
        if (vivo) setEstado({ kind: "error" });
      });
    return () => {
      vivo = false;
    };
  }, [getEstacion, intento, localDate]);

  if (!localDate || estado.kind === "cargando") {
    return (
      <Shell>
        <MinimalLoading />
      </Shell>
    );
  }
  if (estado.kind === "error") {
    return (
      <Shell>
        <ErrorState onRetry={() => setIntento((n) => n + 1)} />
      </Shell>
    );
  }
  if (estado.kind === "bloqueado") {
    return (
      <Shell>
        <EmptyState
          eyebrow="TU MOMENTO · BLOQUEADO"
          title={"Tu estación vital\nse abre con Plus."}
          body="Las capas lentas —tu estación vital, el tema de tu año y tus cuatro ritmos— se calculan sobre tu carta y son parte de Órbita Plus."
          cta="VER ÓRBITA PLUS"
          onCta={() => router.push("/paywall")}
        />
      </Shell>
    );
  }
  if (estado.kind === "sin_datos") {
    const copy = copyDeSinDatos(estado.estacion);
    return (
      <Shell>
        <EmptyState
          eyebrow="TU ESTACIÓN VITAL"
          title={copy.titulo}
          body={copy.cuerpo}
          cta={
            estado.estacion.status === "unavailable" || estado.estacion.status === "not_configured"
              ? "REINTENTAR"
              : estado.estacion.status === "needs_birth_time" || estado.estacion.status === "needs_birth_data"
                ? "COMPLETAR MIS DATOS"
                : "VOLVER"
          }
          onCta={() =>
            estado.estacion.status === "unavailable" || estado.estacion.status === "not_configured"
              ? setIntento((n) => n + 1)
              : estado.estacion.status === "needs_birth_time" || estado.estacion.status === "needs_birth_data"
                ? router.push("/editar-datos")
                : router.canGoBack()
                  ? router.back()
                  : router.replace("/transito")
          }
        />
      </Shell>
    );
  }
  return (
    <Shell>
      <EstacionVitalLista estacion={estado.estacion} timezone={estado.timezone} />
    </Shell>
  );
}

function EstacionVitalLista({ estacion, timezone }: { estacion: Extract<EstacionVital, { status: "ready" }>; timezone: string | null }) {
  const desktop = useIsDesktop();
  const exact = estacion.precision === "exact";
  const lectura = seasonReading({ phaseKey: estacion.phaseKey, phaseName: estacion.name, exact });
  const tz = timezone ?? undefined;
  const empezo = bordeDeFase(estacion.phaseStartedAt, estacion.phaseStartedAtRange, tz);
  const proxima = bordeDeFase(estacion.nextPhaseAt, estacion.nextPhaseAtRange, tz);

  const principal = (
    <ReadingBlock>
      <View style={styles.cabecera}>
        <PEnlace label="TU MOMENTO" href="/transito" />
        <PEtiqueta tono="gris">CAPA 01</PEtiqueta>
      </View>
      <View style={styles.titular}>
        <View style={styles.emblema} accessible accessibilityLabel={`Fase ${estacion.name}`}>
          <View style={[styles.emblemaLuz, { width: `${Math.round(Math.max(8, Math.min(100, (estacion.progressedElongationDegrees / 180) * 100)))}%` }]} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.nombre} accessibilityRole="header">
            {estacion.name}
          </Text>
          <PEtiqueta tono="gris" style={styles.etapa}>
            {etiquetaDeEtapa(estacion)}
          </PEtiqueta>
        </View>
      </View>

      <Seccion titulo={READING_NOW_HEADING}>{lectura.now}</Seccion>
      <Seccion titulo={READING_THEME_HEADING}>{lectura.theme}</Seccion>
      <View style={styles.seccion}>
        <PEtiqueta>· {SEASON_CYCLE_HEADING}</PEtiqueta>
        <View style={desktop ? styles.dosColumnas : undefined}>
          <View style={desktop ? styles.mitad : styles.subseccion}>
            <PEtiqueta style={styles.subrotulo}>SE ABRE</PEtiqueta>
            <PTexto>{lectura.opens}</PTexto>
          </View>
          <View style={desktop ? styles.mitad : styles.subseccion}>
            <PEtiqueta style={styles.subrotulo}>SE CIERRA</PEtiqueta>
            <PTexto>{lectura.closes}</PTexto>
          </View>
        </View>
      </View>
      <Seccion titulo={READING_USE_HEADING}>{lectura.use}</Seccion>
      <Seccion titulo={READING_QUESTION_HEADING}>{lectura.question}</Seccion>
      {lectura.caveat ? <PNota style={styles.nota}>{lectura.caveat}</PNota> : null}

      <View style={styles.seccion}>
        <PEtiqueta>· {SEASON_DATA_HEADING}</PEtiqueta>
        <PEtiqueta tono="gris" style={styles.subrotulo}>
          · CAMBIA CADA ~{decimalEs(estacion.phaseYears)} AÑOS
        </PEtiqueta>
        <View style={styles.pista} accessibilityLabel={`Avance de la fase: ${Math.round(estacion.progress * 100)} por ciento`}>
          <View style={[styles.relleno, { flexGrow: estacion.progress }]} />
          <View style={{ flexGrow: 1 - estacion.progress }} />
        </View>
        <View style={styles.datos}>
          <Dato rotulo="FASE" valor={estacion.name} />
          <Dato rotulo="EMPEZÓ" valor={empezo} />
          <Dato rotulo="PRÓXIMA FASE" valor={proxima} />
          <Dato rotulo="ÁNGULO PROGRESADO" valor={anguloProgresado(estacion)} />
        </View>
        {!exact ? <PNota style={styles.nota}>Sin hora exacta, las fechas son un rango.</PNota> : null}
      </View>
      {!desktop ? (
        <>
          <PNota style={styles.nota}>{estacion.limitations.join(" ")}</PNota>
          <PNota style={styles.nota}>{DISCLAIMER}</PNota>
        </>
      ) : null}
    </ReadingBlock>
  );

  if (!desktop) return principal;

  return (
    <Columns gap={orbita.spacing.xxl * 1.5}>
      <Column weight={2}>{principal}</Column>
      <Column weight={1}>
        <PTarjeta titulo="TU MOMENTO">
          <PTexto>Los ciclos lentos: tu estación vital, el tema de tu año y tus cuatro ritmos.</PTexto>
          {CAPAS_DE_TU_MOMENTO.map((c) => (
            <PEtiqueta key={c.n} tono="hueso" style={styles.capa}>
              {c.n} · {c.label}
            </PEtiqueta>
          ))}
          <PEnlace label="IR A TU MOMENTO" href="/transito" />
        </PTarjeta>
        <PTarjeta titulo="DE DÓNDE SALE CADA CAPA">
          {DE_DONDE_SALE.map((d) => (
            <View key={d.rotulo} style={styles.capa}>
              <PEtiqueta tono="hueso">{d.rotulo}</PEtiqueta>
              <PTexto>{d.texto}</PTexto>
            </View>
          ))}
        </PTarjeta>
        <PTarjeta titulo="LO QUE ESTE CÁLCULO NO DICE">
          {estacion.limitations.map((l) => (
            <PNota key={l}>· {l}</PNota>
          ))}
        </PTarjeta>
        <PPlegable titulo="¿POR QUÉ ÓRBITA TE MUESTRA ESTO?">
          <PEtiqueta tono="hueso">QUÉ SE CALCULÓ</PEtiqueta>
          <PTexto>{SEASON_TRACE.calculatedDatum}</PTexto>
          <PEtiqueta tono="hueso" style={styles.capa}>
            CON QUÉ REGLA SE LEE
          </PEtiqueta>
          <PTexto>{SEASON_TRACE.interpretiveRule}</PTexto>
        </PPlegable>
        <PTarjeta>
          <PNota>{DISCLAIMER}</PNota>
        </PTarjeta>
      </Column>
    </Columns>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: string }) {
  return (
    <View style={styles.seccion}>
      <PEtiqueta>· {titulo}</PEtiqueta>
      <PTexto style={styles.cuerpo}>{children}</PTexto>
    </View>
  );
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.dato}>
      <PEtiqueta tono="gris">{rotulo}</PEtiqueta>
      <Text style={styles.datoValor}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cabecera: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  titular: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.lg, marginTop: orbita.spacing.md },
  emblema: {
    backgroundColor: orbita.colors.surface,
    borderColor: orbita.colors.line,
    borderRadius: 999,
    borderWidth: 1,
    height: 72,
    overflow: "hidden",
    width: 72
  },
  emblemaLuz: { backgroundColor: "rgba(244,238,228,0.14)", height: "100%" },
  nombre: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 36, lineHeight: 42 },
  etapa: { marginTop: orbita.spacing.xs },
  seccion: { borderTopColor: orbita.colors.line, borderTopWidth: 1, marginTop: orbita.spacing.xl, paddingTop: orbita.spacing.lg },
  subseccion: { marginTop: orbita.spacing.md },
  subrotulo: { marginTop: orbita.spacing.sm },
  cuerpo: { marginTop: orbita.spacing.sm },
  dosColumnas: { flexDirection: "row", gap: orbita.spacing.xl },
  mitad: { flex: 1, minWidth: 0 },
  nota: { marginTop: orbita.spacing.lg },
  pista: { backgroundColor: "rgba(244,238,228,0.10)", borderRadius: 2, flexDirection: "row", height: 3, marginTop: orbita.spacing.lg, overflow: "hidden" },
  relleno: { backgroundColor: orbita.colors.copper, height: 3 },
  datos: { flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.xl, marginTop: orbita.spacing.lg },
  dato: { flexBasis: 120, flexGrow: 1 },
  datoValor: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 14, letterSpacing: 1, marginTop: orbita.spacing.xs },
  capa: { marginTop: orbita.spacing.md }
});
