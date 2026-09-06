/**
 * **Tránsitos** — el panorama del cielo de hoy, la misma pantalla en nativo y
 * en web (CORE-207).
 *
 * Frames del carril de Tránsitos del tablero `02 · WEB — PARIDAD PROPUESTA`:
 * `1731:2158` / `1737:2201` (AHORA · ranking, 390 / 1440), `1732:2179` /
 * `2014:2825` (orden y cierre) y `1729:2109` / `1730:2131` (Free bloqueado).
 *
 *     AHORA                              ← el único segmento de esta tarjeta
 *     TRÁNSITOS · AHORA     8 DE 16 CONTACTOS ACTIVOS · CAMBIA A DIARIO
 *     Los contactos principales de hoy, ordenados por el peso del contacto…
 *     LAS BARRAS MIDEN CERCANÍA AL PUNTO EXACTO EN EL TIEMPO, DESDE AHORA
 *     1 LUNA · MARTE ── Luna trígono tu Marte ── ▇▇▇▇▇▇▇──── ── INTEGRÁNDOSE · CASA 4
 *     …
 *     VER LOS 16 CONTACTOS ›
 *     POR QUÉ ESTE ORDEN
 *
 * ## De dónde sale cada cosa (cero maqueta)
 *
 * - Todo sale de `transits.getPanorama({ localDate })`: la MISMA lectura
 *   persistida del día que alimenta `getToday` y `getDetail`. Cada fila trae
 *   su `transitId` y abre `/reading/transito?id=…` (CORE-208).
 * - El día lo decide el SERVIDOR (`useCanonicalLocalDate`).
 * - La barra mide cercanía al punto exacto **en tiempo** (`exactTime` contra la
 *   ventana del contacto, desde «ahora» en la zona de la lectura). El
 *   proveedor no publica el orbe en grados, así que no hay `0°43'` ni puntaje:
 *   sin ventana, la fila no dibuja barra.
 * - El ORDEN es el del backend (pesos fijos por planeta, punto y aspecto, más
 *   uno con hora exacta): «Por qué este orden» describe exactamente eso, no el
 *   criterio del frame, que el código no implementa.
 * - El encabezado dice «8 de 16» cuando la lectura guardó el total de aspectos
 *   mayores del proveedor y «principales» cuando no lo sabe: nunca «todos» sin
 *   saberlo.
 * - Free recibe `locked`: el ranking se calcula con la carta y es Plus. La
 *   pantalla lo dice con el frame bloqueado, sin filas de relleno.
 *
 * El segmento «Tu momento» (CORE-209) abre el capítulo actual: la estación
 * vital con cálculo real y las capas 02/03 declaradas pendientes hasta
 * CORE-210/211. El segmento elegido se conserva en la pantalla; la URL sólo
 * lo pide al entrar (`?segmento=momento` desde «Ver tu momento» en Hoy,
 * CORE-240) y cada nuevo pedido vuelve a aplicarlo.
 */
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAction } from "convex/react";
import { OrbitaScreen, Section } from "@/components/orbita/kit";
import { segmentoDeRuta } from "@/domain/hoyPrincipal";
import { Column, Columns, ReadingBlock } from "@/components/orbita/Layout";
import { GuestState } from "@/components/orbita/GuestState";
import { EmptyState, ErrorState, MinimalLoading } from "@/components/orbita/states";
import {
  NOTA_DEL_ORDEN,
  PBoton,
  PEncabezado,
  PEnlace,
  PEsqueleto,
  PEtiqueta,
  PFila,
  PNota,
  PPlegable,
  PPorQue,
  PSegmento,
  PTarjeta,
  PTexto
} from "@/components/transitos/PanoramaUI";
import { sessionPhase } from "@/domain/screenPhase";
import {
  encabezadoDeAhora,
  estadoDelPanorama,
  etiquetaDeDespliegue,
  filasParaMostrar,
  introDeAhora,
  type PanoramaEstado
} from "@/domain/transitosPanorama";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useCanonicalLocalDate } from "@/hooks/useDailyContext";
import { proposedApi, type TransitPanorama } from "@/services/appRefs";
import { TuMomentoHub } from "@/screens/TuMomentoHub";
import { orbita } from "@/theme/orbita";

const DISCLAIMER = "Órbita es entretenimiento y autoconocimiento.";

export function TransitosScreen() {
  const live = useLiveApp();
  const phase = sessionPhase(live);
  if (phase === "cargando") {
    return (
      <TransitosShell>
        <MinimalLoading />
      </TransitosShell>
    );
  }
  if (phase === "error") {
    return (
      <TransitosShell>
        <ErrorState onRetry={live.retryUser} />
      </TransitosShell>
    );
  }
  if (phase === "invitado") {
    return (
      <TransitosShell>
        <GuestState
          eyebrow="TRÁNSITOS"
          title={"El cielo se lee\nsobre tu carta."}
          body="Los tránsitos de hoy se cruzan con tu carta natal real. Creá tu cuenta o entrá para leer el cielo sobre tus datos."
        />
      </TransitosShell>
    );
  }
  return <TransitosLive />;
}

/** Shell único: todos los estados pasan por acá, dentro del lienzo `wide`. */
function TransitosShell({ children }: { children: React.ReactNode }) {
  return (
    <OrbitaScreen canvas="wide">
      <Section>{children}</Section>
    </OrbitaScreen>
  );
}

/** Con sesión: el panorama REAL del día. Carga mínima; fallo → error con reintento. */
type Segmento = "ahora" | "momento";

function TransitosLive() {
  const getPanorama = useAction(proposedApi.transitPanorama);
  const [estado, setEstado] = useState<PanoramaEstado>({ kind: "cargando" });
  const [intento, setIntento] = useState(0);
  const params = useLocalSearchParams<{ segmento?: string | string[] }>();
  // El pedido ya normalizado: expo-router devuelve un array NUEVO en cada
  // render cuando el parámetro se repite, y con él como dependencia el efecto
  // volvería a imponer «momento» después de que el usuario toque Ahora.
  const pedido = params.segmento === undefined ? undefined : segmentoDeRuta(params.segmento);
  const [segmento, setSegmento] = useState<Segmento>(pedido ?? "ahora");
  const localDate = useCanonicalLocalDate();

  // «Ver tu momento» desde Hoy llega con `?segmento=momento`; si la pantalla ya
  // estaba abierta en Ahora, el nuevo pedido también la cambia.
  useEffect(() => {
    if (pedido !== undefined) setSegmento(pedido);
  }, [pedido]);

  useEffect(() => {
    if (!localDate) return;
    let vivo = true;
    setEstado({ kind: "cargando" });
    getPanorama({ localDate })
      .then((r: TransitPanorama) => {
        if (vivo) setEstado(estadoDelPanorama(r));
      })
      .catch(() => {
        if (vivo) setEstado({ kind: "error" });
      });
    return () => {
      vivo = false;
    };
  }, [getPanorama, intento, localDate]);

  if (!localDate || estado.kind === "cargando") {
    return (
      <TransitosShell>
        <MinimalLoading />
      </TransitosShell>
    );
  }
  if (estado.kind === "error") {
    return (
      <TransitosShell>
        <ErrorState onRetry={() => setIntento((n) => n + 1)} />
      </TransitosShell>
    );
  }
  const segmentos = (
    <View style={styles.segmentos} accessibilityRole="tablist">
      <PSegmento label="AHORA" activo={segmento === "ahora"} onPress={() => setSegmento("ahora")} />
      <PSegmento label="TU MOMENTO" activo={segmento === "momento"} onPress={() => setSegmento("momento")} />
    </View>
  );
  if (segmento === "momento") {
    return (
      <TransitosShell>
        {segmentos}
        <TuMomentoHub localDate={localDate} />
      </TransitosShell>
    );
  }
  if (estado.kind === "bloqueado") {
    return (
      <TransitosShell>
        <PanoramaBloqueado />
      </TransitosShell>
    );
  }
  if (estado.kind === "vacio") {
    return (
      <TransitosShell>
        <EmptyState
          eyebrow="TRÁNSITOS · AHORA"
          title={"Hoy no hay contactos\nactivos sobre tu carta."}
          body="El proveedor no publicó ningún tránsito dentro de orbe para hoy. No es un error: es un cielo tranquilo sobre tus puntos. Volvé mañana."
          cta="REINTENTAR"
          onCta={() => setIntento((n) => n + 1)}
        />
      </TransitosShell>
    );
  }
  return (
    <TransitosShell>
      {segmentos}
      <PanoramaAhora panorama={estado.panorama} onTuMomento={() => setSegmento("momento")} />
    </TransitosShell>
  );
}

// ---------------------------------------------------------------------------
// AHORA · el ranking del día
// ---------------------------------------------------------------------------

function PanoramaAhora({ panorama, onTuMomento }: { panorama: Extract<TransitPanorama, { status: "ready" }>; onTuMomento: () => void }) {
  const desktop = useIsDesktop();
  const [desplegado, setDesplegado] = useState(false);
  const filas = filasParaMostrar(panorama.rows, desplegado);
  const despliegue = etiquetaDeDespliegue(panorama.rows.length, desplegado);

  const lista = (
    <ReadingBlock>
      <PEncabezado izquierda="TRÁNSITOS · AHORA" derecha={encabezadoDeAhora(panorama)} />
      <PTexto style={styles.intro}>{introDeAhora(panorama)}</PTexto>
      <PEtiqueta tono="gris" style={styles.leyenda}>
        LAS BARRAS MIDEN CERCANÍA AL PUNTO EXACTO EN EL TIEMPO, DESDE AHORA
      </PEtiqueta>
      <View style={styles.lineaSuperior} />
      {filas.map((fila, i) => (
        <PFila key={fila.transitId} fila={fila} conCuerpo={!desktop} ultima={i === filas.length - 1} />
      ))}
      <View style={styles.lineaInferior} />
      {despliegue ? <PEnlace label={despliegue} onPress={() => setDesplegado(true)} /> : null}
      {!desktop ? (
        <View style={styles.porQueMovil}>
          <PEncabezado izquierda="POR QUÉ ESTE ORDEN" derecha="CAMBIA A DIARIO" />
          <PPorQue enFila={false} />
          <PNota style={styles.notaOrden}>{NOTA_DEL_ORDEN}</PNota>
          <PNota style={styles.notaOrden}>{DISCLAIMER}</PNota>
        </View>
      ) : null}
    </ReadingBlock>
  );

  if (!desktop) return lista;

  return (
    <Columns gap={orbita.spacing.xxl * 1.5}>
      <Column weight={2}>{lista}</Column>
      <Column weight={1}>
        <PTarjeta titulo="POR QUÉ ESTE ORDEN">
          <PPorQue enFila={false} />
          <PNota style={styles.notaOrden}>{NOTA_DEL_ORDEN}</PNota>
        </PTarjeta>
        {/* La tarjeta «TU MOMENTO» del frame `1737:2201`: las tres capas y el salto al segmento. */}
        <PTarjeta titulo="TU MOMENTO">
          <PTexto>Los ciclos lentos: tu estación vital, el tema de tu año y tus cuatro ritmos.</PTexto>
          <View style={styles.capasDeMomento}>
            {["01 · TU ESTACIÓN VITAL", "02 · EL TEMA DE TU AÑO", "03 · TUS CUATRO RITMOS"].map((capa) => (
              <PEtiqueta key={capa} tono="gris" style={styles.capaDeMomento}>
                {capa}
              </PEtiqueta>
            ))}
          </View>
          <PEnlace label="IR A TU MOMENTO" onPress={onTuMomento} />
        </PTarjeta>
        <PPlegable titulo="¿POR QUÉ ÓRBITA TE MUESTRA ESTO?">
          <PTexto>
            Un tránsito es un planeta de hoy tocando un punto de tu carta natal. Órbita los ordena por el peso del
            contacto —qué planeta pasa, qué punto de tu carta toca y qué aspecto forma— y cada fila muestra, aparte,
            cuánto falta para su punto exacto.
          </PTexto>
        </PPlegable>
        <PTarjeta>
          <PNota>{DISCLAIMER}</PNota>
        </PTarjeta>
      </Column>
    </Columns>
  );
}

// ---------------------------------------------------------------------------
// Free · bloqueado
// ---------------------------------------------------------------------------

function PanoramaBloqueado() {
  const desktop = useIsDesktop();
  const irAPlus = () => router.push("/paywall");

  const principal = (
    <ReadingBlock>
      <PEncabezado izquierda="TRÁNSITOS" derecha="REQUIERE PLUS" />
      <PTexto style={styles.intro}>
        {desktop
          ? "Un tránsito es un planeta de hoy tocando un punto de tu carta natal. Ordenarlos sobre tu carta —qué punto tocan y cuánto pesa cada contacto— es parte de Plus."
          : "Un tránsito es un planeta de hoy tocando un punto de tu carta natal."}
      </PTexto>
      <View style={styles.lineaSuperior} />
      <PEtiqueta tono="gris" style={styles.leyenda}>
        AHORA · EL RANKING DEL DÍA
      </PEtiqueta>
      <View style={styles.bloqueada}>
        <View style={styles.chipPlus}>
          <PEtiqueta>SOLO CON ÓRBITA PLUS</PEtiqueta>
        </View>
        <PTexto style={styles.bloqueadaTitulo}>El ranking de hoy se calcula con tu carta.</PTexto>
        <PTexto style={styles.bloqueadaCuerpo}>
          Con Plus, Órbita cruza el cielo de hoy con tu carta natal: qué contactos están activos, cuánto les falta
          para ser exactos y qué casa de tu carta tocan.
        </PTexto>
        {!desktop ? (
          <View style={styles.vinetas}>
            {["Los contactos principales de hoy, ordenados por su peso", "La barra de cercanía al punto exacto", "El detalle de arco de cada tránsito"].map((t) => (
              <PTexto key={t} style={styles.vineta}>
                <PEtiqueta>■</PEtiqueta> {t}
              </PTexto>
            ))}
          </View>
        ) : null}
        <View style={styles.bloqueadaAcciones}>
          <PBoton label="VER ÓRBITA PLUS" onPress={irAPlus} />
          {desktop ? <PEnlace label="VER QUÉ ABRE PLUS" onPress={irAPlus} /> : null}
        </View>
      </View>
      <View style={styles.lineaInferior} />
      <PEncabezado izquierda="02 TU MOMENTO" derecha="BLOQUEADO" />
      <PTexto style={styles.intro}>
        {desktop
          ? "El capítulo actual y sus tres capas —tu estación vital, el tema de tu año y tus cuatro ritmos— también se abren con Plus."
          : "Tu momento y sus tres capas también se abren con Plus."}
      </PTexto>
      <PEsqueleto lineas={desktop ? 3 : 2} />
      <View style={styles.lineaInferior} />
      {!desktop ? (
        <>
          <PEnlace label="VER QUÉ ABRE PLUS" onPress={irAPlus} />
          <PNota style={styles.notaOrden}>También en Free: tu carta base y tres preguntas por día en El Umbral.</PNota>
        </>
      ) : (
        <>
          <PEtiqueta tono="gris">TAMBIÉN EN FREE</PEtiqueta>
          <View style={styles.freeTarjetas}>
            <PTarjeta style={styles.freeTarjeta}>
              <PTexto style={styles.freeTitulo}>Tu carta base</PTexto>
              <PTexto>Sol, Luna y Ascendente con signo y grado. No se mueve.</PTexto>
              <PEnlace label="IR A CARTA" href="/carta" />
            </PTarjeta>
            <PTarjeta style={styles.freeTarjeta}>
              <PTexto style={styles.freeTitulo}>El Umbral</PTexto>
              <PTexto>Tres preguntas por día. Con Plus son cinco.</PTexto>
              <PEnlace label="IR AL UMBRAL" href="/umbral" />
            </PTarjeta>
          </View>
        </>
      )}
    </ReadingBlock>
  );

  if (!desktop) return principal;

  return (
    <Columns gap={orbita.spacing.xxl * 1.5}>
      <Column weight={2}>{principal}</Column>
      <Column weight={1}>
        <PTarjeta titulo="QUÉ ABRE PLUS EN TRÁNSITOS">
          {[
            "Ahora: los contactos principales del día, ordenados por el peso de cada contacto sobre tu carta.",
            "El detalle de arco de cada tránsito: inicio, punto exacto y cierre.",
            "Tu momento: tu estación vital, el tema de tu año y tus cuatro ritmos."
          ].map((t) => (
            <PTexto key={t} style={styles.vineta}>
              <PEtiqueta>■</PEtiqueta> {t}
            </PTexto>
          ))}
          <View style={styles.lineaInferior} />
          <PBoton label="VER ÓRBITA PLUS" onPress={irAPlus} />
          <PNota style={styles.notaOrden}>El precio y la prueba gratis, si aplica, se muestran al entrar a Órbita Plus.</PNota>
        </PTarjeta>
        <PTarjeta titulo="CÓMO LEER UN TRÁNSITO">
          {[
            ["TRÁNSITO", "Un planeta de hoy tocando un punto de tu carta natal."],
            ["VENTANA", "Cuánto le falta al contacto para ser exacto y cuándo se cierra."],
            ["CASA", "El área de tu carta donde cae ese contacto."],
            ["ESTADO", "Acercándose antes del exacto; integrándose después."]
          ].map(([r, t]) => (
            <View key={r} style={styles.porQueItem}>
              <PEtiqueta tono="hueso">{r}</PEtiqueta>
              <PTexto>{t}</PTexto>
            </View>
          ))}
        </PTarjeta>
        <PTarjeta>
          <PNota>{DISCLAIMER}</PNota>
        </PTarjeta>
      </Column>
    </Columns>
  );
}

const styles = StyleSheet.create({
  segmentos: { flexDirection: "row", gap: orbita.spacing.sm, marginBottom: orbita.spacing.lg },
  capasDeMomento: { marginTop: orbita.spacing.md },
  capaDeMomento: { marginTop: orbita.spacing.sm },
  intro: { marginTop: orbita.spacing.md },
  leyenda: { marginTop: orbita.spacing.lg },
  lineaSuperior: { backgroundColor: orbita.colors.line, height: 1, marginTop: orbita.spacing.lg },
  lineaInferior: { backgroundColor: orbita.colors.line, height: 1, marginVertical: orbita.spacing.lg },
  porQueMovil: { marginTop: orbita.spacing.xl },
  notaOrden: { marginTop: orbita.spacing.lg },
  cierre: { marginTop: orbita.spacing.xl },
  porQueItem: { marginTop: orbita.spacing.lg },

  bloqueada: {
    backgroundColor: orbita.colors.surface,
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.lg,
    borderWidth: 1,
    marginTop: orbita.spacing.lg,
    padding: orbita.spacing.xl
  },
  chipPlus: { alignSelf: "flex-start", borderColor: orbita.colors.copper, borderRadius: 999, borderWidth: 1, paddingHorizontal: orbita.spacing.md, paddingVertical: 5 },
  bloqueadaTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 30, lineHeight: 36, marginTop: orbita.spacing.lg },
  bloqueadaCuerpo: { marginTop: orbita.spacing.md },
  vinetas: { marginTop: orbita.spacing.lg },
  vineta: { marginTop: orbita.spacing.sm },
  bloqueadaAcciones: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.lg, marginTop: orbita.spacing.xl },
  freeTarjetas: { flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.lg, marginTop: orbita.spacing.lg },
  freeTarjeta: { flexBasis: 240, flexGrow: 1, marginBottom: 0 },
  freeTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 20, marginBottom: orbita.spacing.sm }
});
