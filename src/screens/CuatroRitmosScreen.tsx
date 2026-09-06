/**
 * **Tu momento · Tus cuatro ritmos** — el mandala temporal (CORE-211). Frames
 * `transitos-cuatro-ritmos-390/1440`: «Tus cuatro ritmos», «MULTICAPA · DE
 * DIARIO A MULTIANUAL», qué es este dibujo, cómo usarlo, los cuatro anillos
 * (qué mide cada uno y a qué velocidad), tu configuración de hoy (el mandala y
 * las cuatro líneas reales), para observar y lo que este cálculo no dice, por
 * ritmo. En escritorio, las tarjetas laterales de Tu momento más «Cómo se
 * combinan hoy» y «Método».
 *
 * Todo sale de `momento.getCuatroRitmos({ localDate })`, que compone los
 * cuatro sobres ya existentes: el mandala no calcula nada por su cuenta y un
 * ritmo sin cálculo queda vacío con su motivo. La copy (Build 30, portada de la
 * línea release) es fija salvo la combinación de hoy. Free recibe `locked`.
 */
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAction } from "convex/react";
import { Column, Columns, ReadingBlock } from "@/components/orbita/Layout";
import { OrbitaScreen, Section } from "@/components/orbita/kit";
import { GuestState } from "@/components/orbita/GuestState";
import { EmptyState, ErrorState, MinimalLoading } from "@/components/orbita/states";
import { Mandala } from "@/components/transitos/Mandala";
import { PEnlace, PEtiqueta, PNota, PPlegable, PTarjeta, PTexto } from "@/components/transitos/PanoramaUI";
import {
  MANDALA_COMBINATION_HEADING,
  MANDALA_CONCEPT_HEADING,
  MANDALA_METHOD,
  MANDALA_NOW_HEADING,
  MANDALA_RINGS,
  MANDALA_RINGS_HEADING,
  MANDALA_TRACE,
  READING_QUESTION_HEADING,
  READING_USE_HEADING,
  estadoDeRitmos,
  mandalaReading,
  type RitmosEstado
} from "@/domain/momento";
import { CAPAS_DE_TU_MOMENTO, DE_DONDE_SALE } from "@/screens/EstacionVitalScreen";
import { sessionPhase } from "@/domain/screenPhase";
import { RUTA_TU_MOMENTO } from "@/domain/hoyPrincipal";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useCanonicalLocalDate } from "@/hooks/useDailyContext";
import { proposedApi, type Anillo, type CuatroRitmos, type MomentoCuatroRitmos } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

const DISCLAIMER = "Órbita es entretenimiento y autoconocimiento.";

export function CuatroRitmosScreen() {
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
        <GuestState eyebrow="TU MOMENTO" title={"Tus cuatro ritmos,\nsobre tu carta."} body="Entrá para ver las cuatro escalas de tu momento sobre tus datos de nacimiento." />
      </Shell>
    );
  }
  return <CuatroRitmosLive />;
}

function Shell({ children }: { children: React.ReactNode }) {
  // En web la barra lleva la fecha (frame `1740:2308`) y la vuelta es la nav;
  // en nativo la pantalla vive en un stack sin pestañas, así que la barra
  // ofrece «‹ VOLVER» (CORE-240, revisión r1).
  return (
    <OrbitaScreen canvas="wide" right={IS_WEB ? undefined : "‹ VOLVER"} onRight={IS_WEB ? undefined : volverAlHub}>
      <Section>
        {children}
      </Section>
    </OrbitaScreen>
  );
}

const IS_WEB = process.env.EXPO_OS === "web";
function volverAlHub() {
  if (router.canGoBack()) router.back();
  else router.replace(RUTA_TU_MOMENTO);
}

function CuatroRitmosLive() {
  const getRitmos = useAction(proposedApi.momentoCuatroRitmos);
  const [estado, setEstado] = useState<RitmosEstado>({ kind: "cargando" });
  const [intento, setIntento] = useState(0);
  const localDate = useCanonicalLocalDate();

  useEffect(() => {
    if (!localDate) return;
    let vivo = true;
    setEstado({ kind: "cargando" });
    getRitmos({ localDate })
      .then((r: MomentoCuatroRitmos) => {
        if (vivo) setEstado(estadoDeRitmos(r));
      })
      .catch(() => {
        if (vivo) setEstado({ kind: "error" });
      });
    return () => {
      vivo = false;
    };
  }, [getRitmos, intento, localDate]);

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
          title={"Tus cuatro ritmos\nse abren con Plus."}
          body="Las capas lentas —tu estación vital, el tema de tu año y tus cuatro ritmos— se calculan sobre tu carta y son parte de Órbita Plus."
          cta="VER ÓRBITA PLUS"
          onCta={() => router.push("/paywall")}
        />
      </Shell>
    );
  }
  return (
    <Shell>
      <CuatroRitmosLista ritmos={estado.ritmos} onRetry={() => setIntento((n) => n + 1)} />
    </Shell>
  );
}

function CuatroRitmosLista({ ritmos, onRetry }: { ritmos: CuatroRitmos; onRetry: () => void }) {
  const desktop = useIsDesktop();
  const lectura = mandalaReading({ rings: ritmos.rings, exact: ritmos.exact });
  const vacios = ritmos.rings.filter((r) => !r.available);

  const anillos = (
    <View style={styles.seccion}>
      <PEtiqueta>· {MANDALA_RINGS_HEADING}</PEtiqueta>
      <View style={[styles.anillos, desktop && styles.anillosFila]}>
        {MANDALA_RINGS.map((teoria) => (
          <View key={teoria.key} style={[styles.anillo, desktop && styles.anilloColumna]}>
            <PEtiqueta>{teoria.label.toLocaleUpperCase("es")}</PEtiqueta>
            <PEtiqueta tono="gris" style={styles.subrotulo}>
              {teoria.position.replace(/\.$/, "").toLocaleUpperCase("es")}
            </PEtiqueta>
            <PTexto style={styles.cuerpo}>{teoria.measures}</PTexto>
            {desktop ? <PNota style={styles.notaCorta}>{teoria.pace}</PNota> : null}
          </View>
        ))}
      </View>
    </View>
  );

  const configuracion = (
    <View style={styles.seccion}>
      <PEtiqueta>· {MANDALA_NOW_HEADING}</PEtiqueta>
      <View style={styles.tablero}>
        <Mandala rings={ritmos.rings} size={desktop ? 96 : 88} testID="mandala" />
        <View style={styles.lineas}>
          {ritmos.rings.map((r) => (
            <LineaDeAnillo key={r.key} anillo={r} />
          ))}
        </View>
      </View>
      {vacios.length > 0 ? (
        <View style={styles.motivos}>
          {vacios.map((r) => (
            <PNota key={r.key} style={styles.nota}>
              · {r.label}: {r.detail}
            </PNota>
          ))}
          {vacios.some((r) => r.failed) ? <PEnlace label="REINTENTAR" onPress={onRetry} /> : null}
        </View>
      ) : null}
    </View>
  );

  const noDice = (
    <View style={styles.seccion}>
      <PEtiqueta tono="gris">LO QUE ESTE CÁLCULO NO DICE</PEtiqueta>
      <View style={[styles.anillos, desktop && styles.anillosFila]}>
        {ritmos.rings.map((r) => (
          <View key={r.key} style={[styles.anillo, desktop && styles.anilloColumna]}>
            {!desktop ? <PEtiqueta tono="hueso">{r.label.toLocaleUpperCase("es")}</PEtiqueta> : null}
            {r.limitations.length > 0 ? (
              r.limitations.map((l) => (
                <PNota key={l} style={styles.notaCorta}>
                  · {l}
                </PNota>
              ))
            ) : (
              <PNota style={styles.notaCorta}>· Sin límites declarados hoy para este ritmo.</PNota>
            )}
          </View>
        ))}
      </View>
      {lectura.caveat ? <PNota style={styles.nota}>{lectura.caveat}</PNota> : null}
    </View>
  );

  const principal = (
    <ReadingBlock>
      <View style={styles.cabecera}>
        <PEnlace label="TU MOMENTO" href={RUTA_TU_MOMENTO} />
        <PEtiqueta tono="gris">CAPA 03</PEtiqueta>
      </View>
      <Text style={styles.titulo} accessibilityRole="header">
        Tus cuatro ritmos
      </Text>
      <PEtiqueta tono="gris" style={styles.subtitulo}>
        MULTICAPA · DE DIARIO A MULTIANUAL
      </PEtiqueta>

      {desktop ? (
        <View style={styles.dosColumnas}>
          <View style={styles.mitad}>
            <Seccion titulo={MANDALA_CONCEPT_HEADING}>{lectura.concept}</Seccion>
          </View>
          <View style={styles.mitad}>
            <Seccion titulo={READING_USE_HEADING}>{lectura.use}</Seccion>
          </View>
        </View>
      ) : (
        <Seccion titulo={MANDALA_CONCEPT_HEADING}>{lectura.concept}</Seccion>
      )}

      {anillos}

      {desktop ? (
        <View style={styles.dosColumnas}>
          <View style={styles.mitadAncha}>{configuracion}</View>
          <View style={styles.mitad}>
            <Seccion titulo={READING_QUESTION_HEADING}>{lectura.question}</Seccion>
          </View>
        </View>
      ) : (
        <>
          {configuracion}
          <Seccion titulo={MANDALA_COMBINATION_HEADING}>{lectura.combination}</Seccion>
          <Seccion titulo={READING_USE_HEADING}>{lectura.use}</Seccion>
          <Seccion titulo={READING_QUESTION_HEADING}>{lectura.question}</Seccion>
        </>
      )}

      {noDice}

      {!desktop ? (
        <>
          <View style={styles.seccion}>
            <PEtiqueta>· MÉTODO</PEtiqueta>
            <PTexto style={styles.cuerpo}>{MANDALA_METHOD}</PTexto>
          </View>
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
          <PEnlace label="IR A TU MOMENTO" href={RUTA_TU_MOMENTO} />
        </PTarjeta>
        <PTarjeta titulo="DE DÓNDE SALE CADA CAPA">
          {DE_DONDE_SALE.map((d) => (
            <View key={d.rotulo} style={styles.capa}>
              <PEtiqueta tono="hueso">{d.rotulo}</PEtiqueta>
              <PTexto>{d.texto}</PTexto>
            </View>
          ))}
        </PTarjeta>
        <PTarjeta titulo={`· ${MANDALA_COMBINATION_HEADING}`}>
          <PTexto>{lectura.combination}</PTexto>
        </PTarjeta>
        <PTarjeta titulo="· MÉTODO">
          <PTexto>{MANDALA_METHOD}</PTexto>
          <View style={styles.capa}>
            <PPlegable titulo="¿POR QUÉ ÓRBITA TE MUESTRA ESTO?">
              <PEtiqueta tono="hueso">QUÉ SE CALCULÓ</PEtiqueta>
              <PTexto>{MANDALA_TRACE.calculatedDatum}</PTexto>
              <PEtiqueta tono="hueso" style={styles.capa}>
                CON QUÉ REGLA SE LEE
              </PEtiqueta>
              <PTexto>{MANDALA_TRACE.interpretiveRule}</PTexto>
            </PPlegable>
          </View>
        </PTarjeta>
        <PTarjeta>
          <PNota>{DISCLAIMER}</PNota>
        </PTarjeta>
      </Column>
    </Columns>
  );
}

/** `ESTACIÓN VITAL · Nueva`, en gris cuando el ritmo no tiene cálculo. */
function LineaDeAnillo({ anillo }: { anillo: Anillo }) {
  return (
    <View style={styles.linea} accessible accessibilityLabel={`${anillo.label}: ${anillo.available ? anillo.state : "sin cálculo"}`}>
      <PEtiqueta tono={anillo.available ? "cobre" : "gris"}>{anillo.label.toLocaleUpperCase("es")}</PEtiqueta>
      <Text style={[styles.lineaValor, !anillo.available && styles.lineaVacia]}>· {anillo.available ? anillo.state : "Sin cálculo"}</Text>
    </View>
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

const styles = StyleSheet.create({
  cabecera: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  titulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 32, lineHeight: 38, marginTop: orbita.spacing.md },
  subtitulo: { marginTop: orbita.spacing.md },
  seccion: { borderTopColor: orbita.colors.line, borderTopWidth: 1, marginTop: orbita.spacing.xl, paddingTop: orbita.spacing.lg },
  subrotulo: { marginTop: orbita.spacing.xs },
  cuerpo: { marginTop: orbita.spacing.sm },
  nota: { marginTop: orbita.spacing.md },
  notaCorta: { marginTop: orbita.spacing.sm },
  dosColumnas: { flexDirection: "row", gap: orbita.spacing.xxl },
  mitad: { flex: 1 },
  mitadAncha: { flex: 1.6 },
  anillos: { marginTop: orbita.spacing.sm },
  anillosFila: { flexDirection: "row", gap: orbita.spacing.xl },
  anillo: { marginTop: orbita.spacing.md },
  anilloColumna: { flex: 1 },
  tablero: {
    alignItems: "center",
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: orbita.spacing.xl,
    marginTop: orbita.spacing.md,
    padding: orbita.spacing.lg
  },
  lineas: { flex: 1, gap: orbita.spacing.sm },
  linea: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.sm },
  lineaValor: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 14, lineHeight: 20 },
  lineaVacia: { color: orbita.colors.muted },
  motivos: { marginTop: orbita.spacing.sm },
  capa: { marginTop: orbita.spacing.md }
});
