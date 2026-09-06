/**
 * **Carta completa** — la carta natal, punto por punto (CORE-215). Frames
 * `1825:3302` / `1842:3744` (tu rueda), `1826:3387` / `1843:3837` (precisión
 * natal y ejes), `1827:3413` / `1844:3862` (diez posiciones), `1875:4238` /
 * `1875:4335` (siete capítulos), `1873:4193` / `1873:4317` (aspectos con
 * orbe), `1872:4512` / `1872:4672` (doce casas). Una sola ruta con seis
 * bloques, más el mapa de valores que la ficha pide conservar.
 *
 * Todo sale de la misma carta que el hub (`useCartaNatal`): `charts.current`,
 * `birthData.getCurrent`, la lectura larga y su estado. Lo que el payload no
 * trae —casas y ejes sin hora exacta, contactos en Free— se declara con
 * palabras; nunca se rellena. Free ve el bloque de Plus, no una carta a medias.
 */
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Column, Columns, ReadingBlock } from "@/components/orbita/Layout";
import { MeasuredSquare } from "@/components/orbita/ContentCanvas";
import { AstroGlyph } from "@/components/orbita/AstroGlyph";
import { GuestState } from "@/components/orbita/GuestState";
import { NatalWheel } from "@/components/orbita/NatalWheel";
import { Radar } from "@/components/orbita/Radar";
import { EmptyState, ErrorState, MinimalLoading } from "@/components/orbita/states";
import { PEnlace, PEtiqueta, PNota, PTarjeta, PTexto } from "@/components/transitos/PanoramaUI";
import { bodySymbol, RETROGRADE_CODE } from "@/domain/astroSymbols";
import {
  BLOQUES_DE_CARTA_COMPLETA,
  aspectosPorOrbe,
  casasConTema,
  datosNatales,
  ejes,
  posicionesPlanetarias,
  ultimoCalculo
} from "@/domain/cartaCompleta";
import { mapNatalChart } from "@/domain/natalChart";
import { sessionPhase } from "@/domain/screenPhase";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import { useLiveApp } from "@/hooks/useLiveApp";
import { RecalculateChart, useCartaNatal } from "@/screens/CartaScreen";
import type { NatalChartPayload, PersonalitySection } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";
import { appApi } from "@/services/appRefs";

const DISCLAIMER = "Órbita es entretenimiento y autoconocimiento.";

export function CartaCompletaScreen() {
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
        <GuestState eyebrow="CARTA COMPLETA" title={"Tu carta se calcula\ncon tu cuenta."} body="Órbita usa tu fecha, hora y lugar de nacimiento reales para dibujar tu carta natal completa y explicártela." />
      </Shell>
    );
  }
  return <CartaCompletaLive />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <DetailScreen eyebrow="Carta completa" canvas="wide">
      {children}
    </DetailScreen>
  );
}

function CartaCompletaLive() {
  const carta = useCartaNatal();
  // La señal remota de la lectura (pending/ready/error/locked) se lee acá, no
  // en `useCartaNatal`: la generación vive en `useNatalReading` (CORE-247).
  // Va ANTES de cualquier return condicional: es un hook.
  const readingState = useQuery(appApi.charts.personalityReadingState, {});
  const { doc, remoteBirth, reading, readingPhase, values, gate, chartGate } = carta;
  if (gate === "cargando" || chartGate === "cargando") {
    return (
      <Shell>
        <MinimalLoading />
      </Shell>
    );
  }
  if (chartGate === "datosIncompletos") {
    return (
      <Shell>
        <EmptyState eyebrow="CARTA COMPLETA" title="Faltan tus datos de nacimiento" body="Tu carta se calcula con tu fecha, tu hora y tu lugar de nacimiento. Completalos y la dibujamos." cta="EDITAR DATOS" onCta={() => router.push("/editar-datos")} />
      </Shell>
    );
  }
  if (gate === "vacio" || chartGate === "sinCarta") {
    return (
      <Shell>
        <RecalculateChart reason="missing" />
      </Shell>
    );
  }
  if (chartGate === "desactualizada") {
    return (
      <Shell>
        <RecalculateChart reason="stale" />
      </Shell>
    );
  }
  if (readingState === undefined) {
    // Hasta saber si la lectura está bloqueada por plan, no se dibuja una
    // carta a medias con el payload Free (sin casas ni aspectos).
    return (
      <Shell>
        <MinimalLoading />
      </Shell>
    );
  }
  if (readingPhase === "bloqueado") {
    // Free: la carta completa es Plus. El hub ya mostró la base natal; acá no
    // se dibuja una carta a medias.
    return (
      <Shell>
        <EmptyState
          eyebrow="CARTA COMPLETA · SOLO CON ÓRBITA PLUS"
          title={"La carta completa\nse abre con Plus."}
          body="Diez posiciones con lo que cada una permite afirmar, siete capítulos, aspectos con orbe y doce casas. Tu rueda y tu tríada siguen en Carta."
          cta="VER ÓRBITA PLUS"
          onCta={() => router.push("/paywall")}
        />
      </Shell>
    );
  }
  let payload: NatalChartPayload;
  try {
    payload = mapNatalChart(doc);
  } catch {
    return (
      <Shell>
        <ErrorState />
      </Shell>
    );
  }
  return (
    <Shell>
      <CartaCompletaLista
        payload={payload}
        birth={remoteBirth ?? null}
        calculadaEn={typeof doc?.updatedAt === "number" ? doc.updatedAt : typeof doc?.createdAt === "number" ? doc.createdAt : undefined}
        sections={readingPhase === "listo" ? reading?.sections ?? [] : null}
        readingPhase={readingPhase}
        onRetryReading={carta.retryReading}
        disclaimer={reading?.disclaimer ?? null}
        values={values ?? null}
      />
    </Shell>
  );
}

function CartaCompletaLista({
  payload,
  birth,
  calculadaEn,
  sections,
  readingPhase,
  onRetryReading,
  disclaimer,
  values
}: {
  payload: NatalChartPayload;
  birth: ReturnType<typeof useCartaNatal>["remoteBirth"] | null;
  calculadaEn?: number;
  /** `null` mientras la lectura no está lista (carga o error). */
  sections: PersonalitySection[] | null;
  readingPhase: ReturnType<typeof useCartaNatal>["readingPhase"];
  onRetryReading: () => void;
  disclaimer: string | null;
  values: ReturnType<typeof useCartaNatal>["values"] | null;
}) {
  const desktop = useIsDesktop();
  const datos = datosNatales(birth);
  const listaEjes = ejes(payload);
  const posiciones = posicionesPlanetarias(payload);
  const aspectos = aspectosPorOrbe(payload);
  const casas = casasConTema(payload);
  const conHora = listaEjes.length > 0;
  const calculo = ultimoCalculo(calculadaEn, birth?.timezone);

  const cuerpo = (
    <ReadingBlock>
      <PEnlace label="CARTA" href="/carta" />
      <Text style={styles.titulo} accessibilityRole="header">
        Tu carta completa
      </Text>
      <PTexto style={styles.intro}>
        El cielo del momento en que naciste, punto por punto: la rueda, cada posición con lo que se puede afirmar de ella, los
        contactos entre ellas y —cuando tu hora lo permite— las doce casas.
      </PTexto>
      <PEtiqueta tono="gris" style={styles.nota}>
        {conHora ? "CALCULADA CON TU HORA EXACTA DE NACIMIENTO" : "CALCULADA SIN HORA EXACTA · SIN EJES NI CASAS"}
      </PEtiqueta>

      {/* 01 · Tu rueda */}
      <Bloque rotulo="TU RUEDA" derecha="NATAL · NO CAMBIA">
        <PTexto style={styles.cuerpo}>
          Cada punto está dibujado en su grado real{conHora ? ", y la rueda está girada a tu Ascendente: queda a la izquierda, con el Medio Cielo arriba." : "."}
        </PTexto>
        <View style={styles.rueda}>
          <MeasuredSquare max={420}>{(size) => <NatalWheel payload={payload} size={size} />}</MeasuredSquare>
        </View>
        <PNota>Las líneas del centro son los contactos entre tus puntos. Están explicados más abajo.</PNota>
      </Bloque>

      {/* 02 · Tus datos natales y su precisión */}
      <Bloque rotulo="TUS DATOS NATALES Y SU PRECISIÓN" derecha="NATAL · NO CAMBIA">
        <PTexto style={styles.cuerpo}>La precisión de una carta depende de un solo dato: qué tan exacta es la hora de nacimiento con la que se calculó.</PTexto>
        {datos ? (
          <View style={styles.datos}>
            <Dato rotulo="DATOS" valor={datos.linea} />
            <Dato rotulo="PRECISIÓN" valor={datos.precision} />
            {calculo ? <Dato rotulo="ÚLTIMO CÁLCULO" valor={calculo} /> : null}
          </View>
        ) : null}
        <PNota style={styles.nota}>{datos?.nota ?? payload.accuracy}</PNota>
        <PEtiqueta tono="gris" style={styles.subrotulo}>
          TUS EJES
        </PEtiqueta>
        {listaEjes.length > 0 ? (
          listaEjes.map((e) => (
            <View key={e.codigo} style={styles.fila}>
              <Text style={styles.filaNombre}>{e.nombre}</Text>
              <Text style={styles.filaValorMono}>{e.valor}</Text>
            </View>
          ))
        ) : (
          <PNota>Sin hora exacta no se trazan el Ascendente ni el Medio Cielo: dependen del minuto y del lugar.</PNota>
        )}
        <PNota style={styles.nota}>
          El Ascendente es el grado que asomaba por el horizonte en tu lugar y a tu hora; el Medio Cielo, el punto más alto del cielo en
          ese mismo instante. Los dos dependen de la hora.
        </PNota>
      </Bloque>

      {/* 03 · Tus diez posiciones */}
      <Bloque rotulo="TUS DIEZ POSICIONES" derecha="NATAL · NO CAMBIA">
        <PTexto style={styles.cuerpo}>
          Del Sol a Plutón: {posiciones.length} posiciones, con lo que cada una permite afirmar. El Ascendente y el Medio Cielo no
          están acá porque son ejes, no planetas.
        </PTexto>
        {posiciones.map((p) => (
          <View key={p.key} style={styles.fila} accessible accessibilityLabel={`${p.nombre}, ${p.valor}${p.retro ? ", retrógrado" : ""}${p.casa ? `, ${p.casa}` : ""}`}>
            <Text style={styles.filaCodigo}>{p.codigo}</Text>
            <Text style={styles.filaNombre}>{p.nombre}</Text>
            <Text style={styles.filaValorMono}>
              {p.valor}
              {p.retro ? ` · ${RETROGRADE_CODE}` : ""}
              {p.casa ? ` · ${p.casa}` : ""}
            </Text>
          </View>
        ))}
        <PNota style={styles.nota}>
          Cada signo mide 30°, así que el número es la posición dentro del signo: «Leo 12°» es doce grados adentro de Leo. Rx marca
          los planetas que, vistos desde la Tierra, se movían hacia atrás sobre el cielo el día que naciste.
        </PNota>
      </Bloque>

      {/* 04 · Tu carta, explicada */}
      <Bloque rotulo="TU CARTA, EXPLICADA" derecha="NATAL · NO CAMBIA">
        <PTexto style={styles.cuerpo}>
          La lectura escrita sobre tu carta, capítulo por capítulo: qué dice cada posición y un par de preguntas para pensarla. Se
          escribe una sola vez y no cambia con el día.
        </PTexto>
        {sections ? (
          sections.map((s, i) => (
            <View key={s.key} style={styles.capitulo}>
              <PEtiqueta tono="gris">CAPÍTULO {String(i + 1).padStart(2, "0")}</PEtiqueta>
              <View style={styles.capituloHead}>
                <View style={styles.capituloMarker}>
                  <AstroGlyph symbol={bodySymbol({ label: s.placement.label })} size={16} color={orbita.colors.bone} strokeWidth={2} />
                </View>
                <PEtiqueta>
                  {`${s.placement.planet} en ${s.placement.sign ?? ""}${s.placement.house ? ` · Casa ${s.placement.house}` : ""}`.toLocaleUpperCase("es")}
                </PEtiqueta>
              </View>
              <Text style={styles.capituloTitulo} accessibilityRole="header">
                {s.title}
              </Text>
              <PTexto style={styles.cuerpo}>{s.body}</PTexto>
              {s.questions?.length ? (
                <View style={styles.preguntas}>
                  <PEtiqueta>PARA PENSAR</PEtiqueta>
                  {s.questions.map((q) => (
                    <Text key={q} style={styles.pregunta}>{`— ${q}`}</Text>
                  ))}
                </View>
              ) : null}
              <PNota style={styles.nota}>
                Capítulo {String(i + 1).padStart(2, "0")} de {sections.length}. {disclaimer ?? "Esta lectura es contenido de entretenimiento, autoconocimiento y contexto simbólico: no predice hechos ni reemplaza acompañamiento profesional."}
              </PNota>
            </View>
          ))
        ) : readingPhase === "error" ? (
          <>
            <PNota style={styles.nota}>Tu lectura no llegó. La carta sigue acá: probá de nuevo.</PNota>
            <PEnlace label="REINTENTAR" onPress={onRetryReading} />
          </>
        ) : (
          <PNota style={styles.nota}>Preparando tu lectura… Puede tardar un minuto la primera vez.</PNota>
        )}
      </Bloque>

      {/* Mapa de valores (se conserva de la Carta anterior) */}
      {values ? (
        <Bloque rotulo="MAPA DE VALORES" derecha="NATAL · NO CAMBIA">
          <PTexto style={styles.cuerpo}>Qué te impulsa y qué te pesa, leído desde tu carta.</PTexto>
          <View style={styles.rueda}>
            <MeasuredSquare max={340}>{(size) => <Radar payload={values} size={size} />}</MeasuredSquare>
          </View>
          <PNota>{values.note}</PNota>
        </Bloque>
      ) : null}

      {/* 05 · Los contactos entre tus puntos */}
      <Bloque rotulo="LOS CONTACTOS ENTRE TUS PUNTOS" derecha="NATAL · NO CAMBIA">
        <PTexto style={styles.cuerpo}>
          Un aspecto es la distancia entre dos puntos de tu carta cuando esa distancia forma un ángulo señalado: 0°, 60°, 90°, 120°, 150° o
          180°.
        </PTexto>
        {aspectos.length > 0 ? (
          aspectos.map((a) => (
            <View key={a.clave} style={styles.fila}>
              <View style={[styles.punto, { backgroundColor: a.tono === "tension" ? orbita.colors.tension : orbita.colors.harmony }]} />
              <Text style={styles.filaNombreFlex}>{a.texto}</Text>
              {a.orbe ? <Text style={styles.filaValorMono}>{a.orbe}</Text> : null}
            </View>
          ))
        ) : (
          <PNota>Esta carta no trae contactos publicados. No se estima ninguno.</PNota>
        )}
        <PNota style={styles.nota}>
          Van del contacto más ajustado al menos ajustado. Estos cruces ya están leídos arriba: cada capítulo integra los contactos
          de su punto, así que acá quedan como dato y no se repiten como lectura suelta.
        </PNota>
      </Bloque>

      {/* 06 · Tus doce casas */}
      <Bloque rotulo="TUS DOCE CASAS" derecha="NATAL · NO CAMBIA">
        <PTexto style={styles.cuerpo}>
          Las doce zonas en las que se reparte el cielo visto desde el lugar y la hora exactos en que naciste. Cada una nombra un área
          de la vida.
        </PTexto>
        {casas.length > 0 ? (
          casas.map((c) => (
            <View key={c.casa} style={styles.casa}>
              <View style={styles.casaFila}>
                <PEtiqueta tono="gris">CASA {c.casa}</PEtiqueta>
                <Text style={styles.filaValorMono}>{c.valor}</Text>
              </View>
              <Text style={styles.casaTema}>{c.tema}</Text>
            </View>
          ))
        ) : (
          <PNota>Sin hora exacta las casas no se trazan: dependen del minuto y del lugar de nacimiento.</PNota>
        )}
      </Bloque>

      <View style={styles.cierre}>
        <PNota>{payload.accuracy}</PNota>
        {payload.limitations.map((l) => (
          <PNota key={l}>{l}</PNota>
        ))}
        {!desktop ? <PNota>{DISCLAIMER}</PNota> : null}
      </View>
    </ReadingBlock>
  );

  if (!desktop) return cuerpo;

  return (
    <Columns gap={orbita.spacing.xxl * 1.5}>
      <Column weight={2}>{cuerpo}</Column>
      <Column weight={1}>
        <PTarjeta titulo="EN ESTA PANTALLA">
          {BLOQUES_DE_CARTA_COMPLETA.map((b) => (
            <PEtiqueta key={b.n} tono="hueso" style={styles.indice}>
              {b.n} · {b.label}
            </PEtiqueta>
          ))}
          <PEnlace label="VOLVER A CARTA" href="/carta" />
        </PTarjeta>
        <PTarjeta titulo="QUÉ ES NATAL">
          <PTexto>Lo que está en esta pantalla no se mueve: es el cielo del momento en que naciste. Lo que cambia con el día vive en Hoy y en Tránsitos.</PTexto>
        </PTarjeta>
        <PTarjeta>
          <PNota>{DISCLAIMER}</PNota>
        </PTarjeta>
      </Column>
    </Columns>
  );
}

function Bloque({ rotulo, derecha, children }: { rotulo: string; derecha: string; children: React.ReactNode }) {
  return (
    <View style={styles.bloque}>
      <View style={styles.bloqueHead}>
        <PEtiqueta accessibilityRole="header">{rotulo}</PEtiqueta>
        <PEtiqueta tono="gris">{derecha}</PEtiqueta>
      </View>
      {children}
    </View>
  );
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.dato}>
      <PEtiqueta tono="gris" style={styles.datoRotulo}>
        {rotulo}
      </PEtiqueta>
      <Text style={styles.datoValor}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 34, lineHeight: 40, marginTop: orbita.spacing.md },
  intro: { marginTop: orbita.spacing.md },
  nota: { marginTop: orbita.spacing.md },
  cuerpo: { marginTop: orbita.spacing.sm },
  subrotulo: { marginTop: orbita.spacing.xl },
  bloque: { borderTopColor: orbita.colors.line, borderTopWidth: 1, marginTop: orbita.spacing.xl, paddingTop: orbita.spacing.lg },
  bloqueHead: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.md, justifyContent: "space-between" },
  rueda: { alignItems: "center", marginVertical: orbita.spacing.lg },
  datos: { borderTopColor: orbita.colors.line, borderTopWidth: 1, marginTop: orbita.spacing.lg },
  dato: { borderBottomColor: orbita.colors.line, borderBottomWidth: 1, flexDirection: "row", gap: orbita.spacing.lg, paddingVertical: orbita.spacing.md },
  datoRotulo: { width: 120 },
  datoValor: { color: orbita.colors.bone, flex: 1, fontFamily: orbita.fonts.mono, fontSize: 12, lineHeight: 18, letterSpacing: 0.5 },
  fila: { alignItems: "center", borderBottomColor: orbita.colors.line, borderBottomWidth: 1, flexDirection: "row", gap: orbita.spacing.md, minHeight: 44, paddingVertical: orbita.spacing.sm },
  filaCodigo: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 10, letterSpacing: 1, width: 24 },
  filaNombre: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 16, width: 120 },
  filaNombreFlex: { color: orbita.colors.bone, flex: 1, fontFamily: orbita.fonts.body, fontSize: 15 },
  filaValorMono: { color: orbita.colors.bone, flex: 1, fontFamily: orbita.fonts.mono, fontSize: 12, letterSpacing: 0.5, textAlign: "right" },
  punto: { borderRadius: 3, height: 6, width: 6 },
  capitulo: { borderTopColor: orbita.colors.line, borderTopWidth: 1, marginTop: orbita.spacing.xl, paddingTop: orbita.spacing.lg },
  capituloHead: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.md, marginTop: orbita.spacing.sm },
  capituloMarker: { alignItems: "center", borderColor: "rgba(214,154,106,0.5)", borderRadius: 16, borderWidth: 1, height: 32, justifyContent: "center", width: 32 },
  capituloTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 26, lineHeight: 32, marginTop: orbita.spacing.md },
  preguntas: { marginTop: orbita.spacing.lg },
  pregunta: { color: orbita.colors.bone, fontFamily: orbita.fonts.serifRegular, fontSize: 16, lineHeight: 24, marginTop: orbita.spacing.sm },
  casa: { borderBottomColor: orbita.colors.line, borderBottomWidth: 1, paddingVertical: orbita.spacing.md },
  casaFila: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  casaTema: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 14, marginTop: 2 },
  cierre: { marginTop: orbita.spacing.xl },
  indice: { marginTop: orbita.spacing.sm }
});
