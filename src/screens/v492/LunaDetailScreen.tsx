import { StyleSheet, View } from "react-native";
import { MoonDial } from "@/components/v492/Dials";
import { DataRow } from "@/components/v492/Module";
import { SectionHeader } from "@/components/v492/Layout";
import { DetailLayerScreen, Section } from "@/components/v492/Screen";
import { FreshnessNotice, LimitationList, MissingBlock, StatusLine } from "@/components/v492/Status";
import { EmptyBlock, ErrorBlock, GuestBlock, LoadingBlock } from "@/components/v492/States";
import { TraceAccordion } from "@/components/v492/Trace";
import { Body, Label, Mono, Title } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { envelopesFreshness } from "@/domain/layerFreshness";
import { degreeInSign, formatDecimal, formatPercent, latestObservedAt } from "@/domain/layers";
import {
  GUIDE_HEADING,
  GUIDE_STEP_LABEL,
  METHOD_HEADING,
  WHY_HEADING,
  moonGuide,
  moonWhy
} from "@/domain/layerMeaning";
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
 * Encabezado (el disco, el signo y la fase) → `TU GUÍA PARA HOY` → los datos
 * exactos → `POR QUÉ SE MUESTRA` → `MÉTODO`. Primero lo que se entiende sin
 * saber astrología, después el número que lo sostiene, y al final por qué esta
 * capa aparece y cómo se calculó.
 *
 * ## Una columna abierta, sin tarjetas
 *
 * El detalle armaba dos tarjetas —`Card`— dentro de una pantalla que ya es una
 * columna angosta sobre fondo plano: el borde y la superficie no separaban nada
 * que la línea fina del canon no separe mejor, y comían 16 pt de margen a cada
 * lado justo donde hay una tabla de datos. Ahora es una sola columna: rótulo,
 * dato, línea.
 *
 * ## La guía en tres pasos, y el área dicha UNA vez
 *
 * El defecto que cierra: la casa se decía TRES veces seguidas —el resumen del
 * cálculo ("Hoy la Luna pasa por tu casa 7, asociada a pareja, sociedades y
 * acuerdos"), las filas `CASA`/`TEMA` y la línea "Activa tu casa 7, asociada
 * a…"—, las tres con las mismas palabras. Y después dos párrafos, significado y
 * acción, que decían lo mismo en otro orden.
 *
 * Ahora el área aparece una sola vez, en `PRIORIZÁ`; el número de la casa vive
 * entre los datos exactos, que es donde es un dato; y la guía son tres líneas
 * con tres trabajos distintos —qué priorizar, qué probar, qué observar— que se
 * recorren de un vistazo (`domain/layerMeaning`).
 */
export function LunaDetailScreen() {
  const layers = useLayers();
  const { phase, bundle, localDate, timezone, refresh, refreshing, refreshFailed } = layers;

  if (phase === "cargando") {
    return (
      <DetailLayerScreen eyebrow="La Luna en tu carta">
        <LoadingBlock />
      </DetailLayerScreen>
    );
  }
  if (phase === "error") {
    return (
      <DetailLayerScreen eyebrow="La Luna en tu carta">
        <ErrorBlock onRetry={layers.retrySession} />
      </DetailLayerScreen>
    );
  }
  if (phase === "invitado") {
    return (
      <DetailLayerScreen eyebrow="La Luna en tu carta">
        <GuestBlock />
      </DetailLayerScreen>
    );
  }
  if (phase === "vacio" || !bundle) {
    return (
      <DetailLayerScreen eyebrow="La Luna en tu carta">
        <EmptyBlock />
      </DetailLayerScreen>
    );
  }

  const envelope = bundle.today.moonOnChart;
  const data = envelope.data;
  // La guía sale del MISMO dato que los números de abajo: signo, fase y —sólo si
  // el cálculo la publicó— la casa. Sin casa el texto se apoya en el signo y la
  // fase, y lo dice; nunca propone una casa probable.
  const guia = data
    ? moonGuide({ sign: data.sign, phaseKey: data.phaseKey, natalHouse: data.natalHouse })
    : null;

  return (
    <DetailLayerScreen eyebrow="La Luna en tu carta">
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
        {data && guia ? (
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

            <View style={styles.block}>
              <SectionHeader title={GUIDE_HEADING} cadence="CAMBIA CADA 2–3 DÍAS" rule={false} />
              <Paso label={GUIDE_STEP_LABEL.prioriza} text={guia.prioriza} />
              <Paso label={GUIDE_STEP_LABEL.proba} text={guia.proba} />
              <Paso label={GUIDE_STEP_LABEL.observa} text={guia.observa} />
            </View>

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
              {/* El número de la casa vive acá y en ningún otro lado: es un
                  dato, y arriba ya se dijo qué priorizar con él. */}
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

/**
 * Un paso de la guía: el rótulo en cobre y su línea.
 *
 * Los tres pasos tienen el mismo peso tipográfico a propósito: no hay uno más
 * importante que otro, hay tres cosas distintas que hacer con el mismo dato. Es
 * un solo elemento para VoiceOver —`Priorizá: lo de tu casa 7…`— porque el
 * rótulo sin su línea no dice nada.
 */
function Paso({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.paso} accessible accessibilityRole="text" accessibilityLabel={`${label}: ${text}`}>
      <Label style={styles.pasoLabel}>{label}</Label>
      <Body style={styles.pasoText}>{text}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: v492.space.xl },
  hero: { alignItems: "center", flexDirection: "row", gap: v492.space.lg, marginBottom: v492.space.xl },
  heroText: { flex: 1 },
  meta: { marginTop: v492.space.sm },
  paso: { marginTop: v492.space.lg },
  pasoLabel: { color: v492.colors.copper },
  pasoText: { marginTop: v492.space.xs },
  spaced: { marginTop: v492.space.md }
});
