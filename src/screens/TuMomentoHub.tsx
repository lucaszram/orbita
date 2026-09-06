/**
 * **Tránsitos · Tu momento** — el capítulo actual: las tres capas lentas
 * (CORE-209 abre la primera). Frames `1740:2247` (390) y `2022:2875` (1440).
 *
 *     TU MOMENTO · EL CAPÍTULO ACTUAL                     3 CAPAS
 *     01 · TU ESTACIÓN VITAL   Nueva · año 0,6 de 3,7   VER TU ESTACIÓN ›
 *     02 · EL TEMA DE TU AÑO   (CORE-210)
 *     03 · TUS CUATRO RITMOS   (CORE-211)
 *
 * La tarjeta 01 muestra lo que `momento.getEstacionVital` certificó: fase,
 * año dentro de la fase, la acción de la etapa y las fechas reales. La 02
 * (CORE-210) muestra la profección anual de `momento.getTemaDelAno`: casa,
 * mes del año y regente. La 03 todavía no tiene cálculo en esta línea y lo
 * dice: no se dibuja una cifra que no exista. Free recibe `locked`.
 */
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAction } from "convex/react";
import { Column, Columns, ReadingBlock } from "@/components/orbita/Layout";
import { ErrorState, MinimalLoading } from "@/components/orbita/states";
import { PBoton, PEncabezado, PEnlace, PEsqueleto, PEtiqueta, PNota, PPlegable, PTarjeta, PTexto } from "@/components/transitos/PanoramaUI";
import { CAPAS_DE_TU_MOMENTO, DE_DONDE_SALE } from "@/screens/EstacionVitalScreen";
import { anoDeFase, bordeDeFase, copyDeSinDatos, copyDeSinTema, decimalEs, diaMes, estadoDeEstacion, estadoDeTema, SEASON_TRACE, seasonHeadline, seasonMeaning, subtituloDelAno, tituloDelAno, type EstacionEstado, type TemaEstado, YEAR_TRACE, yearMeaning } from "@/domain/momento";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import { proposedApi, type MomentoEstacionVital, type MomentoTemaDelAno } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

const DISCLAIMER = "Órbita es entretenimiento y autoconocimiento.";

export function TuMomentoHub({ localDate }: { localDate: string }) {
  const getEstacion = useAction(proposedApi.momentoEstacionVital);
  const getTema = useAction(proposedApi.momentoTemaDelAno);
  const [estado, setEstado] = useState<EstacionEstado>({ kind: "cargando" });
  const [tema, setTema] = useState<TemaEstado>({ kind: "cargando" });
  const [intento, setIntento] = useState(0);
  const desktop = useIsDesktop();

  useEffect(() => {
    let vivo = true;
    setTema({ kind: "cargando" });
    getTema({ localDate })
      .then((r: MomentoTemaDelAno) => {
        if (vivo) setTema(estadoDeTema(r));
      })
      .catch(() => {
        if (vivo) setTema({ kind: "error" });
      });
    return () => {
      vivo = false;
    };
  }, [getTema, intento, localDate]);

  useEffect(() => {
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

  if (estado.kind === "cargando") return <MinimalLoading />;
  if (estado.kind === "error") return <ErrorState onRetry={() => setIntento((n) => n + 1)} />;

  const capa01 = (
    <View style={styles.tarjeta}>
      <View style={styles.tarjetaCabecera}>
        <PEtiqueta>01 · TU ESTACIÓN VITAL</PEtiqueta>
        {estado.kind === "listo" ? <PEtiqueta tono="gris">~{decimalEs(estado.estacion.phaseYears)} AÑOS</PEtiqueta> : null}
      </View>
      {estado.kind === "listo" ? (
        <>
          <Text style={styles.tarjetaTitulo}>
            {estado.estacion.name} · {anoDeFase(estado.estacion)}
          </Text>
          <Text style={styles.tarjetaSerif}>{seasonHeadline(estado.estacion.phaseKey)}</Text>
          <PTexto style={styles.tarjetaCuerpo}>{seasonMeaning(estado.estacion.phaseKey).meaning}</PTexto>
          {desktop ? (
            <View style={styles.aTierra}>
              <PEtiqueta>PARA BAJARLO A TIERRA</PEtiqueta>
              <PTexto style={styles.tarjetaCuerpo}>{seasonMeaning(estado.estacion.phaseKey).action}</PTexto>
              <View style={styles.pista} accessible accessibilityLabel={`Avance de la fase: ${Math.round(estado.estacion.progress * 100)} por ciento`}>
                <View style={[styles.relleno, { flexGrow: estado.estacion.progress }]} />
                <View style={{ flexGrow: 1 - estado.estacion.progress }} />
              </View>
              <View style={styles.fechas}>
                <PEtiqueta tono="gris">EMPEZÓ {bordeDeFase(estado.estacion.phaseStartedAt, estado.estacion.phaseStartedAtRange, estado.timezone ?? undefined)}</PEtiqueta>
                <PEtiqueta tono="gris">PRÓXIMA FASE {bordeDeFase(estado.estacion.nextPhaseAt, estado.estacion.nextPhaseAtRange, estado.timezone ?? undefined)}</PEtiqueta>
              </View>
            </View>
          ) : (
            <PNota>La fase del ciclo largo entre tu Sol y tu Luna progresados.</PNota>
          )}
          <PEnlace label="VER TU ESTACIÓN" href="/reading/estacion-vital" />
        </>
      ) : estado.kind === "bloqueado" ? (
        <>
          <Text style={styles.tarjetaTitulo}>Se abre con Órbita Plus.</Text>
          <PNota>La fase del ciclo largo entre tu Sol y tu Luna progresados se calcula sobre tu carta.</PNota>
          <PEsqueleto lineas={2} />
          <View style={styles.cta}>
            <PBoton label="VER ÓRBITA PLUS" onPress={() => router.push("/paywall")} />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.tarjetaTitulo}>{copyDeSinDatos(estado.estacion).titulo}</Text>
          <PNota>{copyDeSinDatos(estado.estacion).cuerpo}</PNota>
          {estado.estacion.status === "unavailable" || estado.estacion.status === "not_configured" ? (
            <PEnlace label="REINTENTAR" onPress={() => setIntento((n) => n + 1)} />
          ) : null}
        </>
      )}
    </View>
  );

  const capa02 = (
    <View style={styles.tarjeta}>
      <View style={styles.tarjetaCabecera}>
        <PEtiqueta>02 · EL TEMA DE TU AÑO</PEtiqueta>
        {tema.kind === "listo" ? (
          <PEtiqueta tono="gris">{desktop ? "· DE CUMPLEAÑOS A CUMPLEAÑOS" : `MES ${tema.tema.monthIndex} DE 12`}</PEtiqueta>
        ) : tema.kind === "cargando" ? (
          <PEtiqueta tono="gris">CALCULANDO</PEtiqueta>
        ) : null}
      </View>
      {tema.kind === "listo" ? (
        <>
          <Text style={styles.tarjetaTitulo}>{tituloDelAno(tema.tema)}</Text>
          {desktop ? (
            <>
              <PEtiqueta tono="gris" style={styles.tarjetaCuerpo}>
                {subtituloDelAno(tema.tema)}
              </PEtiqueta>
              <PTexto style={styles.tarjetaCuerpo}>{yearMeaning(tema.tema.house)?.meaning ?? tema.tema.summary}</PTexto>
              <PNota>
                Tu casa {tema.tema.house} empieza en {tema.tema.sign}, así que el regente de este año es {tema.tema.ruler}.
              </PNota>
            </>
          ) : null}
          {desktop ? (
            <View style={styles.aTierra}>
              <PEtiqueta>PARA BAJARLO A TIERRA</PEtiqueta>
              <PTexto style={styles.tarjetaCuerpo}>{yearMeaning(tema.tema.house)?.action ?? ""}</PTexto>
              <View style={styles.pista} accessible accessibilityLabel={`Avance del año personal: ${Math.round(tema.tema.progress * 100)} por ciento`}>
                <View style={[styles.relleno, { flexGrow: tema.tema.progress }]} />
                <View style={{ flexGrow: 1 - tema.tema.progress }} />
              </View>
              <View style={styles.fechas}>
                <PEtiqueta tono="gris">{diaMes(tema.tema.periodStart, tema.timezone ?? undefined)}</PEtiqueta>
                <PEtiqueta tono="gris">{diaMes(tema.tema.periodEnd, tema.timezone ?? undefined)}</PEtiqueta>
              </View>
            </View>
          ) : (
            <PNota>La casa de tu carta que toca tu edad de hoy, y el planeta que la rige.</PNota>
          )}
          <PEnlace label={desktop ? "VER TU AÑO" : "VER EL TEMA DEL AÑO"} href="/reading/tema-del-ano" />
        </>
      ) : tema.kind === "cargando" ? (
        <PEsqueleto lineas={2} />
      ) : tema.kind === "bloqueado" ? (
        <>
          <Text style={styles.tarjetaTitulo}>Se abre con Órbita Plus.</Text>
          <PNota>La casa de tu carta que toca tu edad de hoy, y el planeta que la rige.</PNota>
          <PBoton label="VER ÓRBITA PLUS" onPress={() => router.push("/paywall")} />
        </>
      ) : tema.kind === "error" ? (
        <>
          <Text style={styles.tarjetaTitulo}>No pudimos calcular tu año personal.</Text>
          <PEnlace label="REINTENTAR" onPress={() => setIntento((n) => n + 1)} />
        </>
      ) : (
        <>
          <Text style={styles.tarjetaTitulo}>{copyDeSinTema(tema.tema).titulo}</Text>
          <PNota>{copyDeSinTema(tema.tema).cuerpo}</PNota>
          {tema.tema.status === "unavailable" ? <PEnlace label="REINTENTAR" onPress={() => setIntento((n) => n + 1)} /> : null}
        </>
      )}
    </View>
  );

  const pendiente = (n: string, titulo: string, detalle: string, tarjeta: string) => (
    <View style={styles.tarjeta}>
      <View style={styles.tarjetaCabecera}>
        <PEtiqueta>
          {n} · {titulo}
        </PEtiqueta>
        <PEtiqueta tono="gris">PRÓXIMAMENTE</PEtiqueta>
      </View>
      <Text style={styles.tarjetaTitulo}>{detalle}</Text>
      <PNota>{tarjeta}</PNota>
    </View>
  );

  const lista = (
    <ReadingBlock>
      <PEncabezado izquierda="TU MOMENTO · EL CAPÍTULO ACTUAL" derecha="3 CAPAS" />
      <PTexto style={styles.intro}>
        Acá se reúnen los ciclos que cambian lentamente: tu etapa vital, el tema del año y cómo se superponen con los
        movimientos más breves.
      </PTexto>
      {capa01}
      {capa02}
      {pendiente("03", "TUS CUATRO RITMOS", "Cuatro anillos en un solo dibujo.", "De diario a multianual: se dibujan cuando las cuatro capas tengan cálculo. No se estima ninguna.")}
      {!desktop ? (
        <View style={styles.cierre}>
          <PEtiqueta tono="gris">CÓMO SE RELACIONAN</PEtiqueta>
          <PTexto style={styles.tarjetaCuerpo}>
            Las tres capas corren a la vez y a distinta velocidad: la estación vital dura años y el tema del año, doce meses.
          </PTexto>
          <PNota style={styles.nota}>{DISCLAIMER}</PNota>
        </View>
      ) : null}
    </ReadingBlock>
  );

  if (!desktop) return lista;

  return (
    <Columns gap={orbita.spacing.xxl * 1.5}>
      <Column weight={2}>{lista}</Column>
      <Column weight={1}>
        <PTarjeta titulo="CÓMO SE RELACIONAN">
          <PTexto>Las tres capas corren a la vez y a distinta velocidad: la estación vital dura años y el tema del año, doce meses.</PTexto>
        </PTarjeta>
        <PTarjeta titulo="DE DÓNDE SALE CADA CAPA">
          {DE_DONDE_SALE.map((d) => (
            <View key={d.rotulo} style={styles.item}>
              <PEtiqueta tono="hueso">{d.rotulo}</PEtiqueta>
              <PTexto>{d.texto}</PTexto>
            </View>
          ))}
        </PTarjeta>
        <PTarjeta titulo="· MÉTODO DE CADA CAPA">
          <Text style={styles.metodoTitulo}>Lunación progresada</Text>
          <PTexto>
            Tu estación vital se basa en la relación progresada entre el Sol y la Luna. Recorre ocho fases en un ciclo de unos 30
            años; cada fase dura alrededor de 3,7 años.
          </PTexto>
          <PNota style={styles.nota}>{SEASON_TRACE.interpretiveRule}</PNota>
          <Text style={[styles.metodoTitulo, styles.item]}>Profección anual</Text>
          <PTexto>
            La profección anual recorre una casa de tu carta por cada año de vida. Esa casa señala el área que este método pone en
            primer plano.
          </PTexto>
          <PNota style={styles.nota}>{YEAR_TRACE.interpretiveRule}</PNota>
        </PTarjeta>
        <PPlegable titulo="¿POR QUÉ ÓRBITA TE MUESTRA ESTO?">
          <PEtiqueta tono="hueso">ESTACIÓN VITAL</PEtiqueta>
          <PTexto>{SEASON_TRACE.calculatedDatum}</PTexto>
          <PEtiqueta tono="hueso" style={styles.item}>
            TEMA DEL AÑO
          </PEtiqueta>
          <PTexto>{YEAR_TRACE.calculatedDatum}</PTexto>
        </PPlegable>
        <PTarjeta>
          <PNota>{DISCLAIMER}</PNota>
        </PTarjeta>
      </Column>
    </Columns>
  );
}

export const CAPAS = CAPAS_DE_TU_MOMENTO;

const styles = StyleSheet.create({
  intro: { marginTop: orbita.spacing.md },
  tarjeta: {
    backgroundColor: orbita.colors.surface,
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.lg,
    borderWidth: 1,
    marginTop: orbita.spacing.lg,
    padding: orbita.spacing.xl
  },
  tarjetaCabecera: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.md, justifyContent: "space-between" },
  tarjetaTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 18, lineHeight: 24, marginTop: orbita.spacing.md },
  tarjetaSerif: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 20, lineHeight: 26, marginTop: orbita.spacing.sm },
  tarjetaCuerpo: { marginTop: orbita.spacing.sm },
  aTierra: { marginTop: orbita.spacing.lg },
  pista: { backgroundColor: "rgba(244,238,228,0.10)", borderRadius: 2, flexDirection: "row", height: 3, marginTop: orbita.spacing.lg, overflow: "hidden" },
  relleno: { backgroundColor: orbita.colors.copper, height: 3 },
  fechas: { flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.lg, justifyContent: "space-between", marginTop: orbita.spacing.sm },
  cta: { marginTop: orbita.spacing.lg },
  cierre: { marginTop: orbita.spacing.xl },
  nota: { marginTop: orbita.spacing.md },
  item: { marginTop: orbita.spacing.md },
  metodoTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 16, marginBottom: orbita.spacing.xs }
});
