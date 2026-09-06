/**
 * **Tu momento · Tema del año** — la profección anual (CORE-210). Frames
 * `1741:2289` (390) y `2024:2925` (1440): «Casa N · tema», «MES N DE 12 ·
 * REGENTE DEL AÑO: X», las secciones de lectura (qué marca ahora, qué pone al
 * frente, quién rige este año, cómo usarlo, para observar) y «Los datos del
 * año» con la barra del año personal y los seis datos. En escritorio, las
 * tarjetas laterales compartidas de Tu momento.
 *
 * Todo sale de `momento.getTemaDelAno({ localDate })`: casa, signo, regente,
 * mes y fechas vienen del cálculo (profección Whole Sign desde el Ascendente);
 * la copy (Build 30, portada de la línea release) sólo pone palabras a esa
 * casa. Sin hora exacta no hay Ascendente confiable y la pantalla lo dice.
 * Free recibe `locked`.
 */
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAction } from "convex/react";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Column, Columns, ReadingBlock } from "@/components/orbita/Layout";
import { GuestState } from "@/components/orbita/GuestState";
import { EmptyState, ErrorState, MinimalLoading } from "@/components/orbita/states";
import { PEnlace, PEtiqueta, PNota, PPlegable, PTarjeta, PTexto } from "@/components/transitos/PanoramaUI";
import {
  READING_NOW_HEADING,
  READING_QUESTION_HEADING,
  READING_THEME_HEADING,
  READING_USE_HEADING,
  YEAR_DATA_HEADING,
  YEAR_RULER_HEADING,
  YEAR_TRACE,
  copyDeSinTema,
  diaMes,
  estadoDeTema,
  subtituloDelAno,
  tituloDelAno,
  yearReading,
  type TemaEstado
} from "@/domain/momento";
import { CAPAS_DE_TU_MOMENTO, DE_DONDE_SALE } from "@/screens/EstacionVitalScreen";
import { sessionPhase } from "@/domain/screenPhase";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useCanonicalLocalDate } from "@/hooks/useDailyContext";
import { proposedApi, type MomentoTemaDelAno, type TemaDelAno } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

const DISCLAIMER = "Órbita es entretenimiento y autoconocimiento.";

export function TemaDelAnoScreen() {
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
        <GuestState eyebrow="TU MOMENTO" title={"El tema de tu año,\nsobre tu carta."} body="Entrá para leer tu año personal sobre tus datos de nacimiento." />
      </Shell>
    );
  }
  return <TemaDelAnoLive />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <DetailScreen eyebrow="Tu momento · Capa 02" canvas="wide">
      {children}
    </DetailScreen>
  );
}

function TemaDelAnoLive() {
  const getTema = useAction(proposedApi.momentoTemaDelAno);
  const [estado, setEstado] = useState<TemaEstado>({ kind: "cargando" });
  const [intento, setIntento] = useState(0);
  const localDate = useCanonicalLocalDate();

  useEffect(() => {
    if (!localDate) return;
    let vivo = true;
    setEstado({ kind: "cargando" });
    getTema({ localDate })
      .then((r: MomentoTemaDelAno) => {
        if (vivo) setEstado(estadoDeTema(r));
      })
      .catch(() => {
        if (vivo) setEstado({ kind: "error" });
      });
    return () => {
      vivo = false;
    };
  }, [getTema, intento, localDate]);

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
          title={"El tema de tu año\nse abre con Plus."}
          body="Las capas lentas —tu estación vital, el tema de tu año y tus cuatro ritmos— se calculan sobre tu carta y son parte de Órbita Plus."
          cta="VER ÓRBITA PLUS"
          onCta={() => router.push("/paywall")}
        />
      </Shell>
    );
  }
  if (estado.kind === "sin_datos") {
    const copy = copyDeSinTema(estado.tema);
    const faltanDatos = estado.tema.status === "needs_birth_time" || estado.tema.status === "needs_birth_data";
    return (
      <Shell>
        <EmptyState
          eyebrow="TEMA DE TU AÑO"
          title={copy.titulo}
          body={copy.cuerpo}
          cta={estado.tema.status === "unavailable" ? "REINTENTAR" : faltanDatos ? "COMPLETAR MIS DATOS" : "VOLVER"}
          onCta={() =>
            estado.tema.status === "unavailable"
              ? setIntento((n) => n + 1)
              : faltanDatos
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
      <TemaDelAnoLista tema={estado.tema} timezone={estado.timezone} />
    </Shell>
  );
}

function TemaDelAnoLista({ tema, timezone }: { tema: Extract<TemaDelAno, { status: "ready" }>; timezone: string | null }) {
  const desktop = useIsDesktop();
  const lectura = yearReading({ house: tema.house, ruler: tema.ruler, rulerKey: tema.rulerKey, monthIndex: tema.monthIndex });
  const tz = timezone ?? undefined;

  const principal = (
    <ReadingBlock>
      <View style={styles.cabecera}>
        <PEnlace label="TU MOMENTO" href="/transito" />
        <PEtiqueta tono="gris">CAPA 02</PEtiqueta>
      </View>
      <Text style={styles.titulo} accessibilityRole="header">
        {tituloDelAno(tema)}
      </Text>
      <PEtiqueta tono="gris" style={styles.subtitulo}>
        {subtituloDelAno(tema)}
      </PEtiqueta>

      {lectura ? (
        <>
          <Seccion titulo={READING_NOW_HEADING}>{lectura.now}</Seccion>
          <Seccion titulo={READING_THEME_HEADING}>{lectura.theme}</Seccion>
          <View style={styles.seccion}>
            <PEtiqueta>· {YEAR_RULER_HEADING}</PEtiqueta>
            <PTexto style={styles.cuerpo}>{lectura.ruler}</PTexto>
            <PNota style={styles.nota}>
              Tu casa {tema.house} empieza en {tema.sign}, y por eso el regente de este año es {tema.ruler}.
            </PNota>
          </View>
          <Seccion titulo={READING_USE_HEADING}>{lectura.use}</Seccion>
          <Seccion titulo={READING_QUESTION_HEADING}>{lectura.question}</Seccion>
        </>
      ) : (
        <Seccion titulo={READING_NOW_HEADING}>{tema.summary}</Seccion>
      )}

      <View style={styles.seccion}>
        <PEtiqueta>· {YEAR_DATA_HEADING}</PEtiqueta>
        <PEtiqueta tono="gris" style={styles.subrotulo}>
          · DE CUMPLEAÑOS A CUMPLEAÑOS
        </PEtiqueta>
        <View style={styles.pista} accessible accessibilityLabel={`Avance del año personal: ${Math.round(tema.progress * 100)} por ciento`}>
          <View style={[styles.relleno, { flexGrow: tema.progress }]} />
          <View style={{ flexGrow: 1 - tema.progress }} />
        </View>
        <View style={styles.datos}>
          <Dato rotulo="CASA DEL AÑO" valor={`Casa ${tema.house}`} />
          <Dato rotulo="EMPIEZA EN" valor={tema.sign} />
          <Dato rotulo="REGENTE" valor={tema.ruler} />
          <Dato rotulo="MES DEL AÑO" valor={`${tema.monthIndex} de 12`} />
          <Dato rotulo="DESDE" valor={diaMes(tema.periodStart, tz)} />
          <Dato rotulo="HASTA" valor={diaMes(tema.periodEnd, tz)} />
        </View>
      </View>
      {!desktop ? (
        <>
          {tema.limitations.map((l) => (
            <PNota key={l} style={styles.nota}>
              · {l}
            </PNota>
          ))}
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
          {tema.limitations.map((l) => (
            <PNota key={l}>· {l}</PNota>
          ))}
        </PTarjeta>
        <PPlegable titulo="¿POR QUÉ ÓRBITA TE MUESTRA ESTO?">
          <PEtiqueta tono="hueso">QUÉ SE CALCULÓ</PEtiqueta>
          <PTexto>{YEAR_TRACE.calculatedDatum}</PTexto>
          <PEtiqueta tono="hueso" style={styles.capa}>
            CON QUÉ REGLA SE LEE
          </PEtiqueta>
          <PTexto>{YEAR_TRACE.interpretiveRule}</PTexto>
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
  titulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 32, lineHeight: 38, marginTop: orbita.spacing.md },
  subtitulo: { marginTop: orbita.spacing.md },
  seccion: { borderTopColor: orbita.colors.line, borderTopWidth: 1, marginTop: orbita.spacing.xl, paddingTop: orbita.spacing.lg },
  subrotulo: { marginTop: orbita.spacing.sm },
  cuerpo: { marginTop: orbita.spacing.sm },
  nota: { marginTop: orbita.spacing.md },
  pista: { backgroundColor: "rgba(244,238,228,0.10)", borderRadius: 2, flexDirection: "row", height: 3, marginTop: orbita.spacing.lg, overflow: "hidden" },
  relleno: { backgroundColor: orbita.colors.copper, height: 3 },
  datos: { flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.xl, marginTop: orbita.spacing.lg },
  dato: { flexBasis: 100, flexGrow: 1 },
  datoValor: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 14, letterSpacing: 1, marginTop: orbita.spacing.xs },
  capa: { marginTop: orbita.spacing.md }
});
