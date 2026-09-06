import { StyleSheet, View } from "react-native";
import { MoonDial } from "@/components/v492/Dials";
import { Legend, MetaRow, SectionHeader } from "@/components/v492/Layout";
import { MeterBar } from "@/components/v492/Meter";
import { DataRow } from "@/components/v492/Module";
import { DetailLayerScreen, Section } from "@/components/v492/Screen";
import { FreshnessNotice, LimitationList, MissingBlock, StatusLine } from "@/components/v492/Status";
import { EmptyBlock, ErrorBlock, GuestBlock, LoadingBlock } from "@/components/v492/States";
import { TraceAccordion } from "@/components/v492/Trace";
import { Body, Label, Mono, Note, Title } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { envelopesFreshness } from "@/domain/layerFreshness";
import {
  formatDecimal,
  formatPercent,
  formatShortMonthYear,
  illuminatedFractionAt,
  latestObservedAt
} from "@/domain/layers";
import { METHOD_HEADING } from "@/domain/layerMeaning";
import {
  READING_NOW_HEADING,
  READING_QUESTION_HEADING,
  READING_THEME_HEADING,
  READING_USE_HEADING,
  SEASON_CYCLE_HEADING,
  SEASON_DATA_HEADING,
  SEASON_DETAIL_EYEBROW,
  SEASON_TRACE,
  seasonReading
} from "@/domain/layerReading";
import { useLayers } from "@/hooks/useLayers";
import type { AnalysisPrecision, ProgressedLunationData } from "@/services/layersApi";

/**
 * Tu estación vital — detalle (QA22-024).
 *
 * El ritmo más lento de `Tu momento` no tenía a dónde profundizar: la portada
 * decía el nombre de la fase, una frase y una acción, y el resto de la pantalla
 * eran desplegables que explican el CÁLCULO. Éste es su destino canónico, y vive
 * en el stack de Tránsitos (`/transitos/capa/estacion`) para que "volver"
 * devuelva a `Tu momento` con su punto de lectura (QA22-027).
 *
 * ## El orden, que es el de los cuatro detalles de la sección
 *
 * qué marca ahora → qué pone al frente → qué se abre y qué se cierra → cómo
 * usarlo → para observar → los datos → método y trazabilidad.
 *
 * El texto sale entero de `domain/layerReading`, que es determinístico: la misma
 * fase devuelve las mismas palabras hoy y dentro de un año. No hay llamada
 * generativa, no hay azar y no hay una función de backend nueva: esta pantalla
 * lee el MISMO sobre `ORB-CYC-002` que la portada ya trae en el bundle del día.
 *
 * ## Qué cambia sin hora exacta de nacimiento
 *
 * La fase se sostiene; sus bordes, no. Con `exact` el avance es un punto y las
 * dos fechas son meses concretos; sin ella el sobre publica ventanas
 * (`phaseStartedAtRange`, `nextPhaseAtRange`, `progressRange`) y acá se dicen
 * como ventanas. El límite se declara UNA vez, en la lectura, y los números de
 * abajo lo repiten con su forma —no con otra afirmación—.
 */
export function EstacionDetailScreen({
  fallbackHref = "/transitos/momento"
}: {
  /** Destino de "volver" si no hay historial (entrada por deep link). */
  fallbackHref?: string;
}) {
  const layers = useLayers();
  const { phase, bundle, localDate, timezone, refresh, refreshing, refreshFailed } = layers;

  if (phase === "cargando") {
    return (
      <DetailLayerScreen eyebrow={SEASON_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        <LoadingBlock />
      </DetailLayerScreen>
    );
  }
  if (phase === "error") {
    return (
      <DetailLayerScreen eyebrow={SEASON_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        <ErrorBlock onRetry={layers.retrySession} />
      </DetailLayerScreen>
    );
  }
  if (phase === "invitado") {
    return (
      <DetailLayerScreen eyebrow={SEASON_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        <GuestBlock />
      </DetailLayerScreen>
    );
  }
  if (phase === "vacio" || !bundle) {
    return (
      <DetailLayerScreen eyebrow={SEASON_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        <EmptyBlock />
      </DetailLayerScreen>
    );
  }

  const envelope = bundle.moment.progressedLunation;
  const data = envelope.data;
  const exacto = envelope.precision === "exact";
  const lectura = data ? seasonReading({ phaseKey: data.phaseKey, phaseName: data.name, exact: exacto }) : null;

  return (
    <DetailLayerScreen eyebrow={SEASON_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
      <Section>
        {/* El aviso de frescura, sólo cuando HAY dato: sin cálculo, lo que
            corresponde no es "probá de nuevo" —sin hora exacta reintentar no
            cambia nada— sino el motivo real, que el bloque de abajo explica con
            las palabras del propio sobre. */}
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
            <View style={styles.hero}>
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={`Disco de la fase ${data.name.toLocaleLowerCase(
                  "es"
                )}, dibujado con el ángulo progresado entre el Sol y la Luna.`}
              >
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <MoonDial
                    illumination={illuminatedFractionAt(data.progressedElongationDegrees)}
                    phaseKey={data.phaseKey}
                    phaseName={data.name}
                    size={96}
                    approximate={!exacto}
                  />
                </View>
              </View>
              <View style={styles.heroTexto}>
                <Title>{data.name}</Title>
                <MetaRow
                  items={["ETAPA VITAL · ~3,7 AÑOS", exacto ? null : "PRECISIÓN ±2 MESES SIN HORA"]}
                />
              </View>
            </View>

            <StatusLine status={envelope.status} precision={envelope.precision} />

            {/* La lectura, en el orden canónico de los cuatro detalles. */}
            <SectionHeader title={READING_NOW_HEADING} />
            <Body style={styles.spaced}>{lectura.now}</Body>

            <SectionHeader title={READING_THEME_HEADING} />
            <Body style={styles.spaced}>{lectura.theme}</Body>

            {/* Lo que esta capa desarrolla y ninguna otra: una fase larga se
                entiende por sus dos bordes —qué habilita y qué deja atrás—, no
                por su nombre. */}
            <SectionHeader title={SEASON_CYCLE_HEADING} />
            <Label style={styles.borde}>SE ABRE</Label>
            <Body style={styles.spaced}>{lectura.opens}</Body>
            <Label style={styles.bordeSiguiente}>SE CIERRA</Label>
            <Body style={styles.spaced}>{lectura.closes}</Body>

            <SectionHeader title={READING_USE_HEADING} />
            <Body style={styles.spaced}>{lectura.use}</Body>

            <SectionHeader title={READING_QUESTION_HEADING} />
            <Body style={styles.spaced}>{lectura.question}</Body>

            {/* El límite del dato, dicho UNA vez y donde cambia lo que se
                afirma: entre la lectura y los números que la sostienen. */}
            {lectura.caveat ? <Note style={styles.limite}>{lectura.caveat}</Note> : null}

            <Datos data={data} precision={envelope.precision} timezone={timezone} />

            <LimitationList limitations={envelope.limitations} />
          </>
        ) : (
          <View style={styles.bloque}>
            <Title>Tu estación vital</Title>
            <StatusLine status={envelope.status} precision={envelope.precision} />
            <MissingBlock envelope={envelope} />
          </View>
        )}

        <View style={styles.bloque}>
          <SectionHeader title={METHOD_HEADING} />
          <TraceAccordion
            envelope={envelope}
            timezone={timezone}
            calculatedDatum={SEASON_TRACE.calculatedDatum}
            interpretiveRule={SEASON_TRACE.interpretiveRule}
          />
        </View>
      </Section>
    </DetailLayerScreen>
  );
}

/**
 * Los números de la fase: avance, bordes y el ángulo que los produce.
 *
 * Van DESPUÉS de la lectura porque son su fundamento, no su reemplazo. Cada uno
 * se dice con la forma que el cálculo sostiene: con raíz exacta, un punto y dos
 * meses; sin ella, la franja entera del avance y las dos ventanas de mes y año.
 * El punto medio de una ventana no se imprime solo.
 */
function Datos({
  data,
  precision,
  timezone
}: {
  data: ProgressedLunationData;
  precision: AnalysisPrecision;
  timezone: string;
}) {
  const exacto = precision === "exact";
  // Mes y AÑO: una fase dura ~3,7 años y sus bordes caen en años distintos. El
  // rango colapsa cuando los dos bordes caen en el mismo mes, porque repetir
  // `DIC 2024–DIC 2024` no informa nada.
  const rangoMesAno = (r: { earliest: number; latest: number }) => {
    const desde = formatShortMonthYear(r.earliest, timezone);
    const hasta = formatShortMonthYear(r.latest, timezone);
    return desde === hasta ? desde : `${desde}–${hasta}`;
  };
  const inicio =
    data.phaseStartedAtRange && !exacto
      ? rangoMesAno(data.phaseStartedAtRange)
      : formatShortMonthYear(data.phaseStartedAt, timezone);
  const cierre =
    data.nextPhaseAtRange && !exacto
      ? rangoMesAno(data.nextPhaseAtRange)
      : formatShortMonthYear(data.nextPhaseAt, timezone);
  const avance =
    exacto && typeof data.progress === "number" && Number.isFinite(data.progress)
      ? Math.max(0, Math.min(1, data.progress))
      : null;
  const franja = exacto ? null : (data.progressRange ?? null);
  const faseEnMinuscula = data.name.toLocaleLowerCase("es");

  return (
    <View style={styles.bloque}>
      <SectionHeader title={SEASON_DATA_HEADING} cadence="CAMBIA CADA ~3,7 AÑOS" />
      {avance !== null ? (
        <View style={styles.meter}>
          <MeterBar
            value={avance}
            valueText={`${formatPercent(avance)} de esta fase`}
            accessibilityLabel={`Fase ${faseEnMinuscula}: llevás recorrido el ${formatPercent(
              avance
            )} de esta etapa. Empezó ${inicio}. Sigue hasta ${cierre}.`}
          />
        </View>
      ) : franja ? (
        <View style={styles.meter}>
          <MeterBar
            value={(franja.from + franja.to) / 2}
            tone="soft"
            accessibilityLabel={`Fase ${faseEnMinuscula}: el avance está entre ${formatPercent(
              franja.from
            )} y ${formatPercent(franja.to)} de la etapa.`}
          />
          <Legend>{`AVANCE ENTRE ${formatPercent(franja.from)} Y ${formatPercent(
            franja.to
          )} · SIN HORA NO HAY UN PUNTO`}</Legend>
        </View>
      ) : null}

      <View style={styles.tabla}>
        <DataRow label="FASE" value={<Mono>{data.name}</Mono>} />
        <DataRow label={exacto ? "EMPEZÓ" : "EMPEZÓ (ESTIMADO)"} value={<Mono>{inicio}</Mono>} />
        <DataRow
          label={exacto ? "PRÓXIMA FASE" : "PRÓXIMA FASE (ESTIMADA)"}
          value={<Mono>{cierre}</Mono>}
        />
        <DataRow
          label="ÁNGULO PROGRESADO"
          value={<Mono>{`${formatDecimal(data.progressedElongationDegrees)}°`}</Mono>}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { marginTop: v492.space.xl },
  borde: { color: v492.colors.copper, marginTop: v492.space.md },
  bordeSiguiente: { color: v492.colors.copper, marginTop: v492.space.lg },
  hero: { alignItems: "center", flexDirection: "row", gap: v492.space.lg, marginTop: v492.space.lg },
  heroTexto: { flex: 1 },
  limite: { marginTop: v492.space.lg },
  meter: { marginTop: v492.space.md },
  spaced: { marginTop: v492.space.md },
  tabla: { marginTop: v492.space.lg }
});
