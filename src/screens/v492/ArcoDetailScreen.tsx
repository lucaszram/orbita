import { StyleSheet, View } from "react-native";
import { ArcTimeline, SectionHeader, StateChip } from "@/components/v492/Layout";
import { DetailLayerScreen, Section } from "@/components/v492/Screen";
import { FreshnessNotice } from "@/components/v492/Status";
import {
  EmptyBlock,
  ErrorBlock,
  GuestBlock,
  LoadingBlock,
  PrimaryButton
} from "@/components/v492/States";
import { TraceAccordion } from "@/components/v492/Trace";
import { Body, Label, Mono, Note, Title } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { envelopesFreshness } from "@/domain/layerFreshness";
import {
  formatFullDate,
  formatShortDayMonth,
  latestObservedAt,
  missingReasons,
  transitArcPending,
  transitHeadline,
  TRANSIT_STATE_CHIP
} from "@/domain/layers";
import {
  ACTION_HEADING,
  METHOD_HEADING,
  TRANSIT_DETAIL_EYEBROW,
  TRANSIT_MEANING_HEADING,
  TRANSIT_TIMING_HEADING,
  WHY_HEADING,
  transitMeaning
} from "@/domain/layerMeaning";
import { transitDetailExtras } from "@/domain/transitDetail";
import { useLayers } from "@/hooks/useLayers";
import { useTransitArc } from "@/hooks/useTransitArc";
import type { AnalysisEnvelope, LayerBundle, TransitArcData } from "@/services/layersApi";

/**
 * Detalle del tránsito (Figma V4.9.2 `966:975`).
 *
 * Se llama `DETALLE DEL TRÁNSITO`. Se llamaba `ARCO DEL TRÁNSITO`, y "arco" es
 * jerga interna: nombra la forma del cálculo (`ORB-TRN-001`, la ventana entre el
 * primer y el último contacto) y no lo que la persona abrió, que es un tránsito.
 *
 * La composición del canon: chip de etapa ARRIBA, titular serif y después los
 * bloques con bullet, más el acordeón técnico intacto. Sin tarjetas ni chips
 * repetidos.
 *
 * **El orden es editorial:** `QUÉ SIGNIFICA PARA VOS` y `PARA BAJARLO A TIERRA`
 * van ANTES de `DURACIÓN Y MOMENTOS CLAVE`, porque el titular es notación
 * —`Saturno en cuadratura con tu Sol`— y las fechas no significan nada hasta
 * saber de qué habla ese contacto. Después viene la cronología, con la línea de
 * tiempo y su explicación juntas.
 *
 * **Y no hay tabla debajo de la línea.** Las tres celdas `INICIO / PICO /
 * CIERRE` repetían, en tipografía mono, exactamente las fechas que la línea de
 * tiempo ya rotula debajo de cada marca: la misma información dos veces, con la
 * segunda copia sin la posición que le daba sentido. La lista de contactos
 * también se retira cuando hay UNO solo —la línea ya lo marca como `EXACTO`— y
 * se conserva cuando hay varios, porque ahí sí agrega algo que la línea no
 * dibuja: si el planeta iba directo o retrógrado en cada pasada.
 *
 * Sirve para los dos caminos: el tránsito principal desde Hoy (`/hoy/arco`, sin
 * `arcId`) y cualquier tránsito de la lista (`/transitos/arco/[arcId]`).
 *
 * **Todo el cuerpo sale de UN solo sobre `ORB-TRN-001`.** El sobre del día trae
 * el tránsito principal; cualquier otro `arcId` se lee y se calcula por su cuenta
 * con `useTransitArc`, que devuelve el `ORB-TRN-001` de ESE tránsito. El ranking
 * del día (`ORB-TRN-002`) es otro análisis, con otro método y otras fechas: no se
 * usa como detalle, ni como cronología, ni como trazabilidad. Como mucho da el
 * nombre del tránsito mientras su cálculo específico todavía no llegó, y eso se
 * dice.
 *
 * Los cinco campos que `ORB-TRN-001` publica además de la ventana —`natalHouse`,
 * `previousExactAt`, `nextExactAt`, `rankingWindow`, `rankingReason`— se leen
 * como opcionales del MISMO sobre (`transitDetailExtras`), aunque el contrato ya
 * los declare obligatorios: lo que se dibuja es un sobre PERSISTIDO, y uno
 * guardado antes del cambio sigue siendo válido para leer sin traerlos. Cuando
 * falta alguno, su bloque simplemente no se dibuja. Lo que NO se hace es tomarlos
 * prestados del ranking, que publica su propia casa y sus propias razones: con la
 * trazabilidad del tránsito abajo, eso sería afirmar con un método lo que calculó
 * otro.
 *
 * Qué se AFIRMA depende de la precisión del sobre, no de la estética: con
 * `exact` las tres fechas son contactos verificados y el bloque se titula
 * `DURACIÓN REGISTRADA`; con `estimated` o `range` son bordes calculados, la
 * línea va punteada y se dice que acotan una ventana. Ni se llama estimada a una
 * cronología verificada ni al revés.
 */
export function ArcoDetailScreen({
  arcId,
  fallbackHref = "/hoy"
}: {
  arcId?: string;
  /** Destino de "volver" si no hay historial. */
  fallbackHref?: string;
}) {
  const layers = useLayers();
  const { phase, bundle } = layers;

  if (phase === "cargando") {
    return (
      <DetailLayerScreen eyebrow={TRANSIT_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        <LoadingBlock />
      </DetailLayerScreen>
    );
  }
  if (phase === "error") {
    return (
      <DetailLayerScreen eyebrow={TRANSIT_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        <ErrorBlock onRetry={layers.retrySession} />
      </DetailLayerScreen>
    );
  }
  if (phase === "invitado") {
    return (
      <DetailLayerScreen eyebrow={TRANSIT_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        <GuestBlock />
      </DetailLayerScreen>
    );
  }
  if (phase === "vacio" || !bundle) {
    return (
      <DetailLayerScreen eyebrow={TRANSIT_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        <EmptyBlock />
      </DetailLayerScreen>
    );
  }

  return (
    <ArcoResolver
      bundle={bundle}
      arcId={arcId}
      fallbackHref={fallbackHref}
      nowMs={layers.nowMs}
      localDate={layers.localDate}
      timezone={layers.timezone}
      refreshing={layers.refreshing}
      refreshFailed={layers.refreshFailed}
      onRefreshBundle={layers.refresh}
    />
  );
}

/**
 * Decide de qué sobre `ORB-TRN-001` sale la pantalla.
 *
 * Un `arcId` que coincide con el tránsito principal del día ya tiene su sobre en
 * el bundle: pedirlo de nuevo sería recalcular lo mismo. Cualquier otro se lee y
 * se calcula por su propio alcance. `useTransitArc` se llama siempre —con `null`
 * cuando no hace falta— para que el orden de hooks no dependa de los datos.
 */
function ArcoResolver({
  bundle,
  arcId,
  fallbackHref,
  nowMs,
  localDate,
  timezone,
  refreshing,
  refreshFailed,
  onRefreshBundle
}: {
  bundle: LayerBundle;
  arcId?: string;
  fallbackHref: string;
  nowMs: number;
  localDate: string;
  timezone: string;
  refreshing: boolean;
  refreshFailed: boolean;
  onRefreshBundle: () => void;
}) {
  const principal = bundle.today.transitArc;
  const esPrincipal = !arcId || principal.data?.arcId === arcId;
  const especifico = useTransitArc(esPrincipal ? null : arcId ?? null);

  if (esPrincipal) {
    return (
      <ArcoContent
        envelope={principal}
        fallbackHref={fallbackHref}
        nowMs={nowMs}
        localDate={localDate}
        timezone={timezone}
        refreshing={refreshing}
        refreshFailed={refreshFailed}
        onRefresh={onRefreshBundle}
        // El nombre del tránsito de respaldo sólo aplica al camino con `arcId`.
        nombreDeRespaldo={null}
      />
    );
  }

  // Mientras el cálculo específico no llegó, el ranking del día alcanza para
  // nombrar el tránsito que se abrió —es un dato suyo, no una cronología— y la
  // pantalla dice que la línea de tiempo se está calculando.
  const enRanking = bundle.today.transitRanking.data?.items.find((item) => item.arcId === arcId) ?? null;
  const nombreDeRespaldo = enRanking ? transitHeadline(enRanking) : null;

  if (especifico.envelope === null) {
    return (
      <DetailLayerScreen eyebrow={TRANSIT_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        {especifico.loading ? <LoadingBlock /> : <EmptyBlock />}
      </DetailLayerScreen>
    );
  }

  return (
    <ArcoContent
      envelope={especifico.envelope}
      fallbackHref={fallbackHref}
      nowMs={nowMs}
      localDate={localDate}
      timezone={timezone}
      refreshing={especifico.refreshing}
      refreshFailed={especifico.refreshFailed}
      onRefresh={especifico.refresh}
      nombreDeRespaldo={nombreDeRespaldo}
    />
  );
}

function ArcoContent({
  envelope,
  fallbackHref,
  nowMs,
  localDate,
  timezone,
  refreshing,
  refreshFailed,
  onRefresh,
  nombreDeRespaldo
}: {
  /** El único sobre del que sale todo lo que se afirma: `ORB-TRN-001`. */
  envelope: AnalysisEnvelope & { data: TransitArcData | null };
  fallbackHref: string;
  nowMs: number;
  /** Día civil del sobre: con él se decide si lo visible es de hoy. */
  localDate: string;
  timezone: string;
  refreshing: boolean;
  refreshFailed: boolean;
  onRefresh: () => void;
  /**
   * El nombre del tránsito según la lista de hoy, para no dejar la pantalla sin
   * titular mientras su cálculo específico viaja. Nunca aporta fechas.
   */
  nombreDeRespaldo: string | null;
}) {
  const arco = envelope.data;

  if (!arco) {
    // Sin dato, lo que se dice sale de lo que el sobre DECLARA. "Ya no está entre
    // los activos" es una respuesta final y sólo corresponde cuando el cálculo se
    // hizo y no encontró el tránsito; un cálculo pendiente o un proveedor caído
    // son otra cosa y se dicen distinto.
    const calculando = transitArcPending(envelope);
    const fueraDeLaLista = envelope.missingInputs.includes("requested_transit_arc");
    // Un sobre pendiente no es una respuesta. Mientras ese cálculo no haya fallado
    // —esté en vuelo o esperando que la lectura reactiva traiga el resultado— lo
    // honesto es decir que está en curso; el texto de fallo aparece sólo cuando
    // falló de verdad.
    const esperando = calculando && !refreshFailed;
    return (
      <DetailLayerScreen eyebrow={TRANSIT_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        <Section>
          {nombreDeRespaldo ? <Title style={styles.tituloEspera}>{nombreDeRespaldo}</Title> : null}
          {esperando ? (
            <View style={styles.bloque}>
              <LoadingBlock message="Calculando la línea de tiempo de este tránsito…" />
              <Note style={styles.centrado}>
                Órbita busca cuándo entró en el margen que usa para considerarlo activo, cuándo llega a
                su punto más exacto y hasta cuándo sigue.
              </Note>
            </View>
          ) : fueraDeLaLista ? (
            <View style={styles.bloque}>
              <Body>Ese tránsito ya no está entre los activos de hoy.</Body>
              <Note style={styles.spaced}>
                La lista se rehace cada vez que se actualizan los datos: cuando un contacto sale del
                margen que Órbita usa para considerarlo activo, deja de aparecer.
              </Note>
            </View>
          ) : (
            // El único bloque de error grande de esta pantalla, y está donde
            // corresponde: no hay ningún cálculo que leer.
            <View style={styles.bloque}>
              {calculando ? <Body>Todavía no pudimos calcular este tránsito.</Body> : null}
              {missingReasons(envelope).map((razon) => (
                <Note key={razon} style={styles.spaced}>
                  {razon}
                </Note>
              ))}
              <View style={styles.reintento}>
                <PrimaryButton
                  label={refreshing ? "CALCULANDO…" : "PROBAR DE NUEVO"}
                  accessibilityLabel="Volver a calcular este tránsito"
                  onPress={onRefresh}
                  disabled={refreshing}
                  align="start"
                />
              </View>
            </View>
          )}
        </Section>
      </DetailLayerScreen>
    );
  }

  // Con la cronología estimada, las fechas acotan una ventana: no son contactos
  // confirmados y la pantalla no los cuenta como tales.
  const esExacto = envelope.precision === "exact";
  const inicio = arco.startsAt;
  const pico = arco.peakAt;
  const cierre = arco.endsAt;
  // Los cinco campos que el contrato publica además de la ventana, leídos del
  // MISMO sobre y como opcionales: un sobre guardado antes del cambio no los
  // trae, y ahí su bloque no se dibuja en vez de mostrar un hueco.
  const extra = transitDetailExtras(arco);
  // Los contactos que la línea de tiempo marca: las pasadas verificadas y, si el
  // sobre las trae, las dos repeticiones exactas alrededor de hoy. Sin nada de
  // eso, el pico es el único contacto (lo resuelve `transitTimeline`).
  const contactos = [
    ...arco.passes.map((pass) => pass.exactAt),
    extra.previousExactAt,
    extra.nextExactAt
  ].filter((at): at is number => typeof at === "number");
  // El significado se compone con lo que ESTE sobre publica: el planeta que se
  // mueve, el punto natal que toca, el aspecto, la etapa y la casa activada. Esta
  // pantalla no toma datos prestados de otro sobre: si la casa no está —un sobre
  // guardado antes del cambio de contrato—, el texto se arma con las cuatro
  // piezas que sí son suyas y no nombra ninguna casa.
  const lectura = transitMeaning({
    transitPlanet: arco.transitPlanet,
    natalPoint: arco.natalPoint,
    aspect: arco.aspect,
    state: arco.state,
    natalHouse: extra.natalHouse
  });

  return (
    <DetailLayerScreen eyebrow={TRANSIT_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
      <Section>
        <FreshnessNotice
          freshness={envelopesFreshness({
            envelopes: [envelope],
            refreshFailed,
            localDate,
            timezone
          })}
          observedAt={latestObservedAt([envelope])}
          timezone={timezone}
          onRetry={onRefresh}
          retrying={refreshing}
        />

        <View style={styles.chipTop}>
          <StateChip label={TRANSIT_STATE_CHIP[arco.state]} />
        </View>
        <Title>{transitHeadline(arco)}</Title>

        {/* Qué significa, antes que cuándo pasa: el titular de arriba es
            notación —`Saturno en cuadratura con tu Sol`— y no se entiende sin
            traducir. La línea de tiempo y las fechas vienen después, cuando ya
            se sabe de qué se está hablando. */}
        <SectionHeader title={TRANSIT_MEANING_HEADING} />
        <Body style={styles.spaced}>{lectura.meaning}</Body>

        <SectionHeader title={ACTION_HEADING} />
        <Body style={styles.spaced}>{lectura.action}</Body>

        <SectionHeader title={TRANSIT_TIMING_HEADING} />
        <View style={styles.timeline}>
          <ArcTimeline
            startsAt={inicio}
            peakAt={pico}
            endsAt={cierre}
            timezone={timezone}
            nowMs={nowMs}
            contacts={contactos}
            estimated={!esExacto}
          />
        </View>
        <Label style={styles.duracion}>{esExacto ? "DURACIÓN REGISTRADA" : "VENTANA ESTIMADA"}</Label>
        <Body style={styles.spaced}>
          {esExacto
            ? `Órbita registra este tránsito entre el ${formatFullDate(
                inicio,
                timezone
              )} y el ${formatFullDate(cierre, timezone)}. El contacto más exacto de esta ventana ${
                pico > nowMs ? "va a ser" : "fue"
              } el ${formatFullDate(pico, timezone)}.`
            : `Estas fechas acotan cuándo el contacto está activo: van del ${formatFullDate(
                inicio,
                timezone
              )} al ${formatFullDate(
                cierre,
                timezone
              )}, con el punto más cercano alrededor del ${formatFullDate(
                pico,
                timezone
              )}. Son bordes calculados, no contactos confirmados.`}
        </Body>
        {/* Las dos repeticiones exactas alrededor de hoy, cuando el sobre las
            trae. La línea de tiempo ya las marca; esta línea las FECHA en
            palabras, que es lo que hace falta para agendar algo. */}
        {extra.previousExactAt !== null || extra.nextExactAt !== null ? (
          <Note style={styles.spaced}>
            {[
              extra.previousExactAt !== null
                ? `Contacto exacto anterior: ${formatFullDate(extra.previousExactAt, timezone)}.`
                : null,
              extra.nextExactAt !== null
                ? `Próximo contacto exacto: ${formatFullDate(extra.nextExactAt, timezone)}.`
                : null
            ]
              .filter((linea): linea is string => Boolean(linea))
              .join(" ")}
          </Note>
        ) : null}
        <Body style={styles.spaced}>{arco.summary}</Body>

        {/* Por qué este tránsito aparece en tu lista. Sale del propio sobre
            —nunca de las razones del ranking, que es otro análisis— y por eso el
            bloque existe sólo cuando este cálculo lo trae. */}
        {extra.rankingReason || extra.rankingWindow ? (
          <>
            <SectionHeader title={WHY_HEADING} />
            {extra.rankingReason ? (
              <Body style={styles.spaced}>
                {extra.rankingReason.label
                  ? `${extra.rankingReason.label}: ${extra.rankingReason.explanation}`
                  : extra.rankingReason.explanation}
              </Body>
            ) : null}
            {extra.rankingWindow ? (
              <Note style={styles.spaced}>
                {`La lista de hoy lo considera activo entre el ${formatFullDate(
                  extra.rankingWindow.earliest,
                  timezone
                )} y el ${formatFullDate(extra.rankingWindow.latest, timezone)}.`}
              </Note>
            ) : null}
          </>
        ) : null}

        {/* Las pasadas, sólo cuando son varias: con una sola, la línea de tiempo
            ya la marca como `EXACTO` y repetirla acá era la tercera vez que la
            pantalla decía la misma fecha. */}
        {arco.passes.length > 1 ? (
          <>
            <SectionHeader title={tituloContactos(arco.passes.length, esExacto)} />
            {arco.passes.map((pass, index) => (
              <View key={`${pass.exactAt}-${pass.direction}`} style={styles.contacto}>
                <View style={styles.contactoHead}>
                  <View
                    style={[styles.punto, index === 1 ? styles.puntoActivo : null]}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                  <Mono style={styles.contactoFecha}>{formatShortDayMonth(pass.exactAt, timezone)}</Mono>
                  <Label style={styles.contactoSep}>·</Label>
                  <Label style={pass.direction === "retrograde" ? styles.retro : styles.directo}>
                    {pass.direction === "retrograde" ? "RETRÓGRADO" : "DIRECTO"}
                  </Label>
                </View>
                <Body style={styles.contactoTexto}>{pass.label}</Body>
              </View>
            ))}
            <Body style={styles.spaced}>
              {esExacto
                ? `${arco.transitPlanet} retrogradó y pasó ${arco.passes.length} veces por el mismo punto. Órbita reúne esos contactos como etapas de un solo tránsito.`
                : `Con esta ventana estimada, ${arco.transitPlanet} podría volver sobre el mismo punto si retrograda. Órbita todavía no confirma cada pasada por separado: las muestra como etapas posibles de un mismo tránsito.`}
            </Body>
          </>
        ) : null}

        <SectionHeader title={METHOD_HEADING} />
        <View style={styles.trace}>
          <TraceAccordion
            envelope={envelope}
            timezone={timezone}
            calculatedDatum="La distancia en grados entre el planeta que transita y el punto de tu carta que toca, y las fechas en que ese contacto entra en el margen de 3°, llega a su punto más exacto y sale."
            interpretiveRule="Un tránsito se lee como una ventana y no como un día suelto: cuanto más cerca del ángulo exacto, más nítido el tema. El punto de tu carta y la casa que activa indican en qué área se nota."
          />
        </View>
      </Section>
    </DetailLayerScreen>
  );
}

/** `LOS TRES CONTACTOS` cuando son tres; si no, el número real, sin redondear. */
function tituloContactos(cantidad: number, exacto: boolean): string {
  const palabras: Record<number, string> = { 1: "EL CONTACTO", 2: "LOS DOS CONTACTOS", 3: "LOS TRES CONTACTOS" };
  const base = palabras[cantidad] ?? `LOS ${cantidad} CONTACTOS`;
  return exacto ? base : `${base} · ESTIMADOS`;
}

const styles = StyleSheet.create({
  bloque: { marginTop: v492.space.lg },
  centrado: { marginTop: v492.space.md, textAlign: "center" },
  chipTop: { marginBottom: v492.space.md, marginTop: v492.space.lg },
  contacto: { marginTop: v492.space.lg },
  contactoFecha: { color: v492.colors.text },
  contactoHead: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: v492.space.sm },
  contactoSep: { color: v492.colors.textDim },
  contactoTexto: { marginTop: 2 },
  directo: { color: v492.colors.textDim },
  duracion: { color: v492.colors.copper, marginTop: v492.space.lg },
  punto: { backgroundColor: v492.colors.textDim, borderRadius: 4, height: 8, width: 8 },
  puntoActivo: { backgroundColor: v492.colors.copper },
  reintento: { marginTop: v492.space.xl },
  retro: { color: v492.colors.copper },
  spaced: { marginTop: v492.space.md },
  timeline: { marginTop: v492.space.lg },
  tituloEspera: { marginTop: v492.space.lg },
  trace: { marginTop: v492.space.md }
});
