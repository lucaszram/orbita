import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { MetaRow, SectionHeader } from "@/components/v492/Layout";
import { MeterBar } from "@/components/v492/Meter";
import { DataRow } from "@/components/v492/Module";
import { DetailLayerScreen, Section } from "@/components/v492/Screen";
import { FreshnessNotice, LimitationList, MissingBlock, StatusLine } from "@/components/v492/Status";
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
import { formatShortDayMonth, houseTheme, latestObservedAt, windowProgress } from "@/domain/layers";
import { METHOD_HEADING } from "@/domain/layerMeaning";
import {
  READING_NOW_HEADING,
  READING_QUESTION_HEADING,
  READING_THEME_HEADING,
  READING_USE_HEADING,
  YEAR_DATA_HEADING,
  YEAR_DETAIL_EYEBROW,
  YEAR_RULER_HEADING,
  YEAR_TRACE,
  yearReading
} from "@/domain/layerReading";
import { useLayers } from "@/hooks/useLayers";
import type { AnnualProfectionData } from "@/services/layersApi";

/**
 * Tema de tu año — detalle (QA22-024).
 *
 * El segundo ritmo de `Tu momento` sin destino propio: la portada decía `Casa 11
 * · redes, futuro y pertenencia`, una frase y una acción, y para "profundizar"
 * sólo quedaba el acordeón que explica la profección. Éste es su detalle
 * canónico, dentro del stack de Tránsitos (`/transitos/capa/ano`), así que
 * "volver" devuelve a `Tu momento` (QA22-027).
 *
 * ## El orden, que es el de los cuatro detalles de la sección
 *
 * qué marca ahora → qué pone al frente → quién rige este año → cómo usarlo →
 * para observar → los datos → método y trazabilidad.
 *
 * Los tres desarrollos que pide el registro —casa, regente y mes dentro del
 * año— entran una vez cada uno y con un trabajo distinto: la casa abre, el
 * regente dice con qué se lee ese año, y el mes ubica en qué tramo del recorrido
 * estás. El texto sale de `domain/layerReading`, que es determinístico.
 *
 * ## Sin hora de nacimiento no hay año personal
 *
 * La profección se apoya en las casas y las casas se apoyan en el Ascendente,
 * que depende de la hora. Cuando el sobre viene `needs_birth_time` la pantalla
 * no inventa una casa probable: dice el motivo con las palabras del sobre y
 * ofrece la única salida que existe, que es cargar o corregir la hora. Si el
 * sobre llega con precisión no exacta, la lectura declara que los bordes del año
 * tienen margen.
 */
export function AnoDetailScreen({
  fallbackHref = "/transitos/momento"
}: {
  /** Destino de "volver" si no hay historial (entrada por deep link). */
  fallbackHref?: string;
}) {
  const layers = useLayers();
  const { phase, bundle, nowMs, localDate, timezone, refresh, refreshing, refreshFailed } = layers;

  if (phase === "cargando") {
    return (
      <DetailLayerScreen eyebrow={YEAR_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        <LoadingBlock />
      </DetailLayerScreen>
    );
  }
  if (phase === "error") {
    return (
      <DetailLayerScreen eyebrow={YEAR_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        <ErrorBlock onRetry={layers.retrySession} />
      </DetailLayerScreen>
    );
  }
  if (phase === "invitado") {
    return (
      <DetailLayerScreen eyebrow={YEAR_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        <GuestBlock />
      </DetailLayerScreen>
    );
  }
  if (phase === "vacio" || !bundle) {
    return (
      <DetailLayerScreen eyebrow={YEAR_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
        <EmptyBlock />
      </DetailLayerScreen>
    );
  }

  const envelope = bundle.moment.annualProfection;
  const data = envelope.data;
  const sinHora = envelope.status === "needs_birth_time";
  // La casa la publica el sobre, así que puede venir una que el método editorial
  // no tenga (fuera de 1–12). Ahí `yearReading` devuelve `null` y la pantalla
  // muestra los datos sin inventar un área.
  const lectura = data
    ? yearReading({
        house: data.house,
        ruler: data.ruler,
        monthIndex: data.monthIndex,
        exact: envelope.precision === "exact"
      })
    : null;
  const area = data ? houseTheme(data.house) : null;

  return (
    <DetailLayerScreen eyebrow={YEAR_DETAIL_EYEBROW} fallbackHref={fallbackHref}>
      <Section>
        {data ? (
          <FreshnessNotice
            freshness={envelopesFreshness({ envelopes: [envelope], refreshFailed, localDate, timezone })}
            observedAt={latestObservedAt([envelope])}
            timezone={timezone}
            onRetry={refresh}
            retrying={refreshing}
          />
        ) : null}

        {data ? (
          <>
            <Title>{area ? `Casa ${data.house} · ${area}` : `Casa ${data.house}`}</Title>
            <MetaRow
              items={[
                `MES ${data.monthIndex} DE 12`,
                `REGENTE DEL AÑO: ${data.ruler.toLocaleUpperCase("es")}`
              ]}
            />
            <StatusLine status={envelope.status} precision={envelope.precision} />

            {lectura ? (
              <>
                <SectionHeader title={READING_NOW_HEADING} />
                <Body style={styles.spaced}>{lectura.now}</Body>
                {/* El mes dentro del año va pegado a la apertura: es la misma
                    pregunta —"¿en qué punto del recorrido estoy?"— dicha con el
                    tramo en vez de con el número. */}
                <Body style={styles.spaced}>{lectura.month}</Body>

                <SectionHeader title={READING_THEME_HEADING} />
                <Body style={styles.spaced}>{lectura.theme}</Body>

                {/* El regente, que es lo que este método agrega a la casa: con
                    qué planeta se lee el año. La línea de arriba lo nombra en
                    mayúsculas como dato; acá dice qué pone en primer plano. */}
                <SectionHeader title={YEAR_RULER_HEADING} />
                <Body style={styles.spaced}>{lectura.ruler}</Body>
                <Note style={styles.spaced}>
                  {`Tu casa ${data.house} empieza en ${data.sign}, y por eso el regente de este año es ${data.ruler}.`}
                </Note>

                <SectionHeader title={READING_USE_HEADING} />
                <Body style={styles.spaced}>{lectura.use}</Body>

                <SectionHeader title={READING_QUESTION_HEADING} />
                <Body style={styles.spaced}>{lectura.question}</Body>

                {lectura.caveat ? <Note style={styles.limite}>{lectura.caveat}</Note> : null}
              </>
            ) : (
              // Una casa que el método editorial no tiene: se muestran sus datos
              // y no se inventa un área ni una lectura.
              <Note style={styles.limite}>
                Este año llega a una casa que todavía no tiene lectura escrita. Los datos del cálculo se
                leen igual, acá abajo.
              </Note>
            )}

            <Datos data={data} nowMs={nowMs} timezone={timezone} />

            <LimitationList limitations={envelope.limitations} />
          </>
        ) : (
          <View style={styles.bloque}>
            <Title>{sinHora ? "Necesita tu hora" : "Tema de tu año"}</Title>
            <StatusLine status={envelope.status} precision={envelope.precision} />
            {sinHora ? (
              <>
                <Label style={styles.metodo}>LA PROFECCIÓN SE APOYA EN LAS CASAS</Label>
                <Body style={styles.spaced}>
                  El recorrido del año personal empieza en tu Ascendente, y el Ascendente depende de la
                  hora en que naciste. Con ese dato podemos decirte qué casa se activa este año y quién la
                  rige.
                </Body>
              </>
            ) : null}
            {/* Y la razón que declaró el sobre, no sólo la que suponemos: la
                profección puede faltar por la hora, pero también porque el
                cálculo no llegó. */}
            <MissingBlock envelope={envelope} />
            {sinHora ? (
              <View style={styles.cta}>
                <PrimaryButton
                  label="AGREGAR O CORREGIR HORA"
                  accessibilityLabel="Agregar o corregir tu hora de nacimiento"
                  onPress={() => router.push("/editar-datos" as never)}
                  align="start"
                />
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.bloque}>
          <SectionHeader title={METHOD_HEADING} />
          <TraceAccordion
            envelope={envelope}
            timezone={timezone}
            calculatedDatum={YEAR_TRACE.calculatedDatum}
            interpretiveRule={YEAR_TRACE.interpretiveRule}
          />
        </View>
      </Section>
    </DetailLayerScreen>
  );
}

/**
 * Los números del año: el tramo que corre, en qué mes estás y de dónde sale el
 * regente. Van después de la lectura porque son su fundamento.
 */
function Datos({
  data,
  nowMs,
  timezone
}: {
  data: AnnualProfectionData;
  nowMs: number;
  timezone: string;
}) {
  const progreso = windowProgress(data.periodStart, data.periodEnd, nowMs);
  const desde = formatShortDayMonth(data.periodStart, timezone);
  const hasta = formatShortDayMonth(data.periodEnd, timezone);
  return (
    <View style={styles.bloque}>
      <SectionHeader title={YEAR_DATA_HEADING} cadence="DE CUMPLEAÑOS A CUMPLEAÑOS" />
      <View style={styles.meter}>
        <MeterBar
          value={progreso}
          valueText={`mes ${data.monthIndex} de 12`}
          accessibilityLabel={`Vas por el mes ${data.monthIndex} de 12 del año que corre entre ${desde} y ${hasta}.`}
        />
      </View>
      <View style={styles.tabla}>
        <DataRow label="CASA DEL AÑO" value={<Mono>{`Casa ${data.house}`}</Mono>} />
        <DataRow label="EMPIEZA EN" value={<Mono>{data.sign}</Mono>} />
        <DataRow label="REGENTE" value={<Mono>{data.ruler}</Mono>} />
        <DataRow label="MES DEL AÑO" value={<Mono>{`${data.monthIndex} de 12`}</Mono>} />
        <DataRow label="DESDE" value={<Mono>{desde}</Mono>} />
        <DataRow label="HASTA" value={<Mono>{hasta}</Mono>} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { marginTop: v492.space.xl },
  cta: { alignItems: "flex-start", marginTop: v492.space.lg },
  limite: { marginTop: v492.space.lg },
  meter: { marginTop: v492.space.md },
  metodo: { color: v492.colors.textMuted, marginTop: v492.space.lg, textTransform: "none" },
  spaced: { marginTop: v492.space.md },
  tabla: { marginTop: v492.space.lg }
});
