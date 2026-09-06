import { StyleSheet, View } from "react-native";
import { MoonDial } from "@/components/v492/Dials";
import { DataRow } from "@/components/v492/Module";
import { SectionHeader } from "@/components/v492/Layout";
import { DetailLayerScreen, Section } from "@/components/v492/Screen";
import { FreshnessNotice, LimitationList, MissingBlock, StatusLine } from "@/components/v492/Status";
import { EmptyBlock, ErrorBlock, GuestBlock, LoadingBlock } from "@/components/v492/States";
import { TraceAccordion } from "@/components/v492/Trace";
import { Body, Mono, Note, Title } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { envelopesFreshness } from "@/domain/layerFreshness";
import { degreeInSign, formatDecimal, formatPercent, latestObservedAt } from "@/domain/layers";
import { METHOD_HEADING, WHY_HEADING, moonWhy } from "@/domain/layerMeaning";
import {
  MOON_TENSION_HEADING,
  READING_NOW_HEADING,
  READING_QUESTION_HEADING,
  READING_THEME_HEADING,
  READING_USE_HEADING,
  moonReading
} from "@/domain/layerReading";
import { useLayers } from "@/hooks/useLayers";

/**
 * La Luna en tu carta — detalle.
 *
 * El signo y la fase son del cielo de hoy; la casa sale de TU carta y sólo
 * aparece si hay hora exacta de nacimiento. Cuando no la hay, el módulo lo dice
 * y no propone una casa probable.
 *
 * ## Qué se lee y en qué orden
 *
 * Encabezado (el disco, el signo y la fase) → la lectura del día —qué marca
 * ahora, qué pone al frente, posibilidad y tensión, cómo usarlo, para observar—
 * → los datos exactos → `POR QUÉ SE MUESTRA` → `MÉTODO`. Primero lo que se
 * entiende sin saber astrología, después el número que lo sostiene, y al final
 * por qué esta capa aparece y cómo se calculó. Es la misma jerarquía que los
 * otros tres detalles de `Tu momento` (`domain/layerReading`).
 *
 * ## Una columna abierta, sin tarjetas
 *
 * El detalle armaba dos tarjetas —`Card`— dentro de una pantalla que ya es una
 * columna angosta sobre fondo plano: el borde y la superficie no separaban nada
 * que la línea fina del canon no separe mejor, y comían 16 pt de margen a cada
 * lado justo donde hay una tabla de datos. Ahora es una sola columna: rótulo,
 * dato, línea.
 *
 * ## La casa se interpreta, no se repite (QA22-026)
 *
 * El primer defecto que cerró esta pantalla: la casa se decía TRES veces
 * seguidas —el resumen del cálculo, las filas `CASA`/`TEMA` y la línea "Activa
 * tu casa 7, asociada a…"—, las tres con las mismas palabras.
 *
 * El segundo, el que cierra esta pasada: lo que quedó en su lugar seguía siendo
 * la ETIQUETA. `Priorizá: lo de tu casa 11: la gente y lo que viene` es el área
 * tal como la nombra la tabla, sin decir nada más; `Probá` traía una sola acción
 * y `Observá` juntaba ideas amplias sin explicar por qué esta Luna, esta fase y
 * esta casa producen esa guía.
 *
 * Ahora las tres piezas del cálculo entran una vez cada una y con un trabajo
 * distinto: signo y fase arman el clima, la casa dice dónde puede notarse, el
 * signo aporta la posibilidad y la fase la tensión, la casa da el gesto y la
 * fase la pregunta (`domain/layerReading`). El número de la casa se IMPRIME una
 * sola vez, entre los datos exactos, que es donde es un dato.
 */
export function LunaDetailScreen({
  fallbackHref = "/hoy"
}: {
  /**
   * Destino de "volver" si no hay historial (entrada por deep link).
   *
   * Lo pone la RUTA, porque es la ruta la que decide de qué stack cuelga este
   * detalle: `/hoy/luna` vuelve a Hoy y `/transitos/capa/luna` vuelve a `Tu
   * momento` (QA22-027). La pantalla es la misma en los dos casos.
   */
  fallbackHref?: string;
}) {
  const layers = useLayers();
  const { phase, bundle, localDate, timezone, refresh, refreshing, refreshFailed } = layers;

  if (phase === "cargando") {
    return (
      <DetailLayerScreen eyebrow="La Luna en tu carta" fallbackHref={fallbackHref}>
        <LoadingBlock />
      </DetailLayerScreen>
    );
  }
  if (phase === "error") {
    return (
      <DetailLayerScreen eyebrow="La Luna en tu carta" fallbackHref={fallbackHref}>
        <ErrorBlock onRetry={layers.retrySession} />
      </DetailLayerScreen>
    );
  }
  if (phase === "invitado") {
    return (
      <DetailLayerScreen eyebrow="La Luna en tu carta" fallbackHref={fallbackHref}>
        <GuestBlock />
      </DetailLayerScreen>
    );
  }
  if (phase === "vacio" || !bundle) {
    return (
      <DetailLayerScreen eyebrow="La Luna en tu carta" fallbackHref={fallbackHref}>
        <EmptyBlock />
      </DetailLayerScreen>
    );
  }

  const envelope = bundle.today.moonOnChart;
  const data = envelope.data;
  // La lectura sale del MISMO dato que los números de abajo: signo, fase y
  // —sólo si el cálculo la publicó— la casa. Sin casa el texto se apoya en el
  // signo y la fase, y lo dice una vez; nunca propone una casa probable.
  const lectura = data
    ? moonReading({ sign: data.sign, phaseKey: data.phaseKey, natalHouse: data.natalHouse })
    : null;

  return (
    <DetailLayerScreen eyebrow="La Luna en tu carta" fallbackHref={fallbackHref}>
      <Section>
        {/* Qué tan de ahora es lo que se ve: una línea si el dato es de hoy y el
            aviso compacto si quedó el de un día anterior.

            Sólo cuando HAY dato. Sin cálculo, lo que corresponde no es "no
            pudimos calcular, probá de nuevo" —que promete una salida que puede
            no existir: sin hora exacta de nacimiento, reintentar no cambia
            nada—, sino el motivo real, que el bloque de abajo explica con las
            palabras del propio sobre. */}
        {data ? (
          <FreshnessNotice
            freshness={envelopesFreshness({
              envelopes: [envelope],
              refreshFailed,
              localDate,
              timezone
            })}
            observedAt={latestObservedAt([envelope])}
            timezone={timezone}
            onRetry={refresh}
            retrying={refreshing}
          />
        ) : null}
        {data && lectura ? (
          <>
            <View style={styles.hero}>
              <MoonDial
                illumination={data.illumination}
                phaseKey={data.phaseKey}
                phaseName={data.phaseName}
                size={120}
              />
              <View style={styles.heroText}>
                <Title>Luna en {data.sign}</Title>
                <Mono style={styles.meta}>
                  {data.phaseName} · {formatPercent(data.illumination)} iluminada
                </Mono>
              </View>
            </View>

            <StatusLine status={envelope.status} precision={envelope.precision} />

            {/* La lectura del día, en la jerarquía canónica de `Tu momento`.
                Cada bloque tiene un trabajo distinto y ninguno repite al otro:
                el clima combina signo y fase, el frente lo pone la casa, la
                tensión sale del signo y de la fase, el gesto de la casa y la
                pregunta de la fase. */}
            <View style={styles.block}>
              <SectionHeader title={READING_NOW_HEADING} cadence="CAMBIA CADA 2–3 DÍAS" rule={false} />
              <Body style={styles.spaced}>{lectura.now}</Body>
            </View>

            <SectionHeader title={READING_THEME_HEADING} />
            <Body style={styles.spaced}>{lectura.theme}</Body>

            <SectionHeader title={MOON_TENSION_HEADING} />
            <Body style={styles.spaced}>{lectura.tension}</Body>

            <SectionHeader title={READING_USE_HEADING} />
            <Body style={styles.spaced}>{lectura.use}</Body>

            <SectionHeader title={READING_QUESTION_HEADING} />
            <Body style={styles.spaced}>{lectura.question}</Body>

            {/* El límite del dato, dicho UNA vez: sin hora exacta no hay casa
                que recorrer y el texto de arriba no nombra ninguna. */}
            {lectura.caveat ? <Note style={styles.limite}>{lectura.caveat}</Note> : null}

            <View style={styles.block}>
              <SectionHeader title="LOS DATOS EXACTOS" />
              <DataRow label="SIGNO" value={<Mono>{data.sign}</Mono>} />
              <DataRow
                label="GRADO"
                value={
                  <Mono>{`${formatDecimal(degreeInSign(data.longitudeDegrees))}° de ${data.sign}`}</Mono>
                }
              />
              <DataRow label="FASE" value={<Mono>{data.phaseName}</Mono>} />
              <DataRow label="ILUMINACIÓN" value={<Mono>{formatPercent(data.illumination)}</Mono>} />
              {/* El número de la casa se IMPRIME acá y en ningún otro lado: es
                  un dato, y arriba ya se dijo qué se nota cuando la Luna pasa
                  por él. */}
              {data.natalHouse !== null ? (
                <DataRow label="CASA" value={<Mono>{`Casa ${data.natalHouse}`}</Mono>} />
              ) : null}
            </View>

            <View style={styles.block}>
              <SectionHeader title={WHY_HEADING} />
              <Body style={styles.spaced}>{moonWhy(data.natalHouse)}</Body>
            </View>

            <LimitationList limitations={envelope.limitations} />
          </>
        ) : (
          <>
            <Title>La Luna en tu carta</Title>
            <View style={styles.block}>
              {/* El estado se declara acá arriba: el bloque de abajo explica el
                  motivo, no lo vuelve a etiquetar. */}
              <StatusLine status={envelope.status} precision={envelope.precision} />
              <MissingBlock envelope={envelope} />
            </View>
          </>
        )}
        <View style={styles.block}>
          <SectionHeader title={METHOD_HEADING} />
          <TraceAccordion
            envelope={envelope}
            timezone={timezone}
            calculatedDatum="La posición de la Luna en el cielo de hoy —signo, grado y porcentaje iluminado— y, si tenés hora exacta de nacimiento, en qué casa de tu carta cae."
            interpretiveRule="Cada casa de la carta se asocia a un área de la vida cotidiana. La Luna pasa dos o tres días por cada una, así que lo que se describe es un clima breve, no una etapa."
          />
        </View>
      </Section>
    </DetailLayerScreen>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: v492.space.xl },
  hero: { alignItems: "center", flexDirection: "row", gap: v492.space.lg, marginBottom: v492.space.xl },
  heroText: { flex: 1 },
  limite: { marginTop: v492.space.lg },
  meta: { marginTop: v492.space.sm },
  spaced: { marginTop: v492.space.md }
});
