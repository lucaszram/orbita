import { StyleSheet, View } from "react-native";
import { TemporalMandalaDial } from "@/components/v492/Dials";
import { MANDALA_SIZE } from "@/components/v492/mandalaGeometry";
import { MetaRow, SectionHeader } from "@/components/v492/Layout";
import { DetailLayerScreen, Section } from "@/components/v492/Screen";
import { FreshnessNotice, LimitationList, MissingBlock, StatusLine } from "@/components/v492/Status";
import { EmptyBlock, ErrorBlock, GuestBlock, LoadingBlock } from "@/components/v492/States";
import { TraceAccordion } from "@/components/v492/Trace";
import { Body, Label, Note, Title } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { envelopesFreshness } from "@/domain/layerFreshness";
import { latestObservedAt } from "@/domain/layers";
import { METHOD_HEADING } from "@/domain/layerMeaning";
import {
  MANDALA_COMBINATION_HEADING,
  MANDALA_CONCEPT_HEADING,
  MANDALA_DETAIL_EYEBROW,
  MANDALA_METHOD,
  MANDALA_NOW_HEADING,
  MANDALA_RINGS,
  MANDALA_RINGS_HEADING,
  MANDALA_TRACE,
  READING_QUESTION_HEADING,
  READING_USE_HEADING,
  mandalaReading
} from "@/domain/layerReading";
import { useLayers } from "@/hooks/useLayers";
import type { AnalysisPrecision, TemporalMandalaData } from "@/services/layersApi";

/**
 * Tus cuatro ritmos — el detalle integral del mandala (QA23-002).
 *
 * ## El defecto que cierra
 *
 * El mandala era el único módulo de `Tu momento` sin lectura propia. Debajo del
 * dibujo había CUATRO salidas —una por anillo— y ninguna explicaba el dibujo:
 * llevaban a la estación, al año, al ciclo lunar y al tránsito, que son los
 * análisis que la misma pantalla ya muestra arriba o que viven en otra sección.
 * Lo único que esos cuatro enlaces no contaban era justamente lo que el mandala
 * agrega: qué significa ver los cuatro ciclos en la misma imagen.
 *
 * Ahora el módulo tiene UN acceso y abre acá. Adentro no hay enlaces a esos
 * cuatro ritmos: cada uno tiene su propio módulo hermano en `Tu momento`, y
 * repetirlos acá reconstruiría el mismo laberinto en un nivel más abajo.
 *
 * ## El orden
 *
 * concepto → los cuatro anillos → tu configuración de hoy → cómo se combinan →
 * cómo usarlo → para observar → método y trazabilidad.
 *
 * Es el orden de los otros cuatro detalles con una diferencia de objeto: acá la
 * lectura no es la de un ciclo sino la de la RELACIÓN entre ellos, así que la
 * teoría de los anillos va antes del estado —sin saber qué mide cada anillo, la
 * configuración de hoy es una lista de cuatro frases sueltas—.
 *
 * ## Determinístico
 *
 * Todo el texto sale de `domain/layerReading`, que es puro: el concepto, el uso,
 * la pregunta y el método son fijos, y lo único que cambia con el día es qué
 * anillos tienen cálculo. La misma configuración devuelve las mismas palabras.
 * No hay llamada generativa, no hay azar y no hay una función de backend nueva:
 * esta pantalla lee el MISMO sobre `ORB-CYC-003` que la portada ya trae en el
 * bundle del día.
 */
export function MandalaDetailScreen({
  fallbackHref = "/transitos/momento"
}: {
  /** Destino de "volver" si no hay historial (entrada por deep link). */
  fallbackHref?: string;
}) {
  const layers = useLayers();
  const { phase, bundle, localDate, timezone, refresh, refreshing, refreshFailed } = layers;

  if (phase === "cargando") {
    return (
      <DetailLayerScreen eyebrow={MANDALA_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        <LoadingBlock />
      </DetailLayerScreen>
    );
  }
  if (phase === "error") {
    return (
      <DetailLayerScreen eyebrow={MANDALA_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        <ErrorBlock onRetry={layers.retrySession} />
      </DetailLayerScreen>
    );
  }
  if (phase === "invitado") {
    return (
      <DetailLayerScreen eyebrow={MANDALA_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        <GuestBlock />
      </DetailLayerScreen>
    );
  }
  if (phase === "vacio" || !bundle) {
    return (
      <DetailLayerScreen eyebrow={MANDALA_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        <EmptyBlock />
      </DetailLayerScreen>
    );
  }

  const envelope = bundle.moment.temporalMandala;
  const data = envelope.data;
  const exacto = envelope.precision === "exact";
  const lectura = data ? mandalaReading({ rings: data.rings, exact: exacto }) : null;

  return (
    <DetailLayerScreen eyebrow={MANDALA_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
      <Section>
        {/* El aviso de frescura, sólo cuando HAY dibujo: sin cálculo lo que
            corresponde no es "probá de nuevo" sino el motivo real, que el bloque
            de abajo explica con las palabras del propio sobre. */}
        {data ? (
          <FreshnessNotice
            freshness={envelopesFreshness({ envelopes: [envelope], refreshFailed, localDate, timezone })}
            observedAt={latestObservedAt([envelope])}
            timezone={timezone}
            onRetry={refresh}
            retrying={refreshing}
          />
        ) : null}

        {data && lectura ? (
          <>
            <View style={styles.encabezado}>
              <Title>Tus cuatro ritmos</Title>
              <MetaRow
                items={[
                  "MULTICAPA · DE DIARIO A MULTIANUAL",
                  exacto ? null : "AVANCES ACOTADOS SIN HORA"
                ]}
              />
            </View>

            <StatusLine status={envelope.status} precision={envelope.precision} />

            <SectionHeader title={MANDALA_CONCEPT_HEADING} />
            <Body style={styles.spaced}>{lectura.concept}</Body>

            {/* La teoría va ANTES del estado: qué mide cada anillo y a qué
                velocidad avanza es lo que convierte las cuatro frases de abajo en
                una comparación de escalas y no en una lista. */}
            <SectionHeader title={MANDALA_RINGS_HEADING} />
            {MANDALA_RINGS.map((anillo) => (
              <View
                key={anillo.key}
                accessible
                accessibilityRole="text"
                accessibilityLabel={`${anillo.label}. ${anillo.position} ${anillo.measures} ${anillo.pace}`}
                style={styles.anillo}
              >
                <Label style={styles.anilloLabel}>{anillo.label.toLocaleUpperCase("es")}</Label>
                <Note style={styles.anilloPosicion}>{anillo.position}</Note>
                <Body style={styles.anilloTexto}>{anillo.measures}</Body>
                <Note style={styles.anilloTexto}>{anillo.pace}</Note>
              </View>
            ))}

            <SectionHeader title={MANDALA_NOW_HEADING} />
            <Configuracion data={data} precision={envelope.precision} />

            <SectionHeader title={MANDALA_COMBINATION_HEADING} />
            <Body style={styles.spaced}>{lectura.combination}</Body>

            <SectionHeader title={READING_USE_HEADING} />
            <Body style={styles.spaced}>{lectura.use}</Body>

            <SectionHeader title={READING_QUESTION_HEADING} />
            <Body style={styles.spaced}>{lectura.question}</Body>

            {/* El límite del dato, dicho UNA vez y donde cambia lo que se
                afirma: entre la lectura y el método que la sostiene. */}
            {lectura.caveat ? <Note style={styles.limite}>{lectura.caveat}</Note> : null}

            <LimitationList limitations={envelope.limitations} />
          </>
        ) : (
          <View style={styles.bloque}>
            <Title>Tus cuatro ritmos</Title>
            <StatusLine status={envelope.status} precision={envelope.precision} />
            <MissingBlock envelope={envelope} />
          </View>
        )}

        <View style={styles.bloque}>
          <SectionHeader title={METHOD_HEADING} />
          {/* El método del dibujo se dice acá, en el cuerpo: el acordeón de abajo
              responde por el CÁLCULO de cada análisis, que es otra pregunta. */}
          <Body style={styles.spaced}>{MANDALA_METHOD}</Body>
          <TraceAccordion
            envelope={envelope}
            timezone={timezone}
            calculatedDatum={MANDALA_TRACE.calculatedDatum}
            interpretiveRule={MANDALA_TRACE.interpretiveRule}
          />
        </View>
      </Section>
    </DetailLayerScreen>
  );
}

/**
 * La configuración de hoy: el dibujo y, debajo, UNA línea por ritmo.
 *
 * Es la misma regla que la portada —el estado ES el dato de ese ciclo, y
 * `ring.detail` sólo aparece cuando el ritmo NO se puede calcular, porque ahí es
 * la única explicación que hay de un anillo apagado—. El avance no se repite en
 * texto: lo dibuja el anillo y lo dice la etiqueta accesible del dibujo, que es
 * donde el modo (`point`, `range`, `unavailable`) significa algo.
 *
 * Acá no hay enlaces: los cuatro ritmos tienen su propio módulo en `Tu momento`
 * y este detalle explica la imagen, no vuelve a repartir hacia ellos.
 */
function Configuracion({
  data,
  precision
}: {
  data: TemporalMandalaData;
  /** Precisión del sobre: decide si un anillo dibuja un punto o su franja. */
  precision: AnalysisPrecision;
}) {
  return (
    <View>
      <View style={styles.mandala}>
        <TemporalMandalaDial rings={data.rings} precision={precision} size={MANDALA_SIZE} />
      </View>
      {data.rings.map((ring) => (
        <View
          key={ring.key}
          style={styles.ring}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${ring.label}: ${ring.available ? ring.state : ring.detail}`}
        >
          <Label style={styles.ringLabel}>{`${ring.label.toLocaleUpperCase("es")} ·`}</Label>
          {ring.available ? (
            <Body style={styles.ringState}>{ring.state}</Body>
          ) : (
            <Note style={styles.ringState}>{ring.detail}</Note>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  anillo: { marginTop: v492.space.lg },
  anilloLabel: { color: v492.colors.copper },
  anilloPosicion: { color: v492.colors.textDim, marginTop: 2 },
  anilloTexto: { marginTop: v492.space.xs },
  bloque: { marginTop: v492.space.xl },
  encabezado: { marginTop: v492.space.lg },
  limite: { marginTop: v492.space.lg },
  mandala: { alignItems: "center", paddingVertical: v492.space.lg },
  /**
   * Una línea por ritmo: el rótulo y su estado en el mismo renglón, con
   * `flexWrap` para que un estado largo baje entero en vez de recortarse.
   */
  ring: {
    alignItems: "baseline",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: v492.space.sm,
    marginTop: v492.space.md
  },
  ringLabel: { color: v492.colors.copper, flexShrink: 0 },
  ringState: { flexShrink: 1 },
  spaced: { marginTop: v492.space.md }
});
