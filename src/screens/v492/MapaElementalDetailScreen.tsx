import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Legend, SectionHeader } from "@/components/v492/Layout";
import { MeterBar } from "@/components/v492/Meter";
import { DetailLayerScreen, Section } from "@/components/v492/Screen";
import { StaleNotice } from "@/components/v492/Status";
import { EmptyBlock, ErrorBlock, GuestBlock, LoadingBlock } from "@/components/v492/States";
import { TraceAccordion } from "@/components/v492/Trace";
import { Body, Label, Mono, Note } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import {
  anyStale,
  ELEMENT_LABEL,
  ELEMENT_ORDER,
  elementList,
  elementWithArticle,
  latestObservedAt,
  leastElementCount,
  leastElementTag,
  missingReasons
} from "@/domain/layers";
import { useLayers } from "@/hooks/useLayers";
import type { ElementKey, ElementMapData } from "@/services/layersApi";

/**
 * Mapa elemental — detalle (Figma V4.9.2 `970:979`).
 *
 * La composición del canon: cuatro barras de ancho completo con el nombre
 * arriba, el recuento a la derecha y LOS PLANETAS de ese elemento debajo de su
 * barra. Después `CÓMO SE JUEGA` con las tres lecturas y `POR QUÉ NO HAY
 * PORCENTAJES` al cierre. Sin tarjetas y sin repetir el reparto en una tabla
 * aparte.
 *
 * Es un RECUENTO, no una medida: se mira en qué signo está cada uno de los diez
 * planetas —del Sol a Plutón—, se traduce ese signo a su elemento y se suma. Por
 * eso las barras dicen "6" y no un porcentaje: el porcentaje sugiere una escala
 * continua donde lo que hay son diez posiciones enteras, y con diez puntos un
 * planeta más o menos mueve diez puntos de golpe.
 *
 * Cada planeta pesa igual. Lo que el método no cuenta —Ascendente, casas, nodos,
 * asteroides— queda afuera POR DEFINICIÓN, no por falta de datos: con hora
 * exacta el reparto es el mismo.
 */

/**
 * Los rótulos de la derecha, en el registro del frame.
 *
 * Los tres salen del reparto REAL, no de un texto fijo:
 *
 * - el artículo lo pone `elementWithArticle` —con un `EL` fijo el rótulo decía
 *   `CUANDO EL TIERRA SATURA`—;
 * - el del elemento menos representado lo pone `leastElementTag`, que dice
 *   `SIN PLANETAS` **sólo** con recuento cero y `MENOS PRESENTE` con uno o más.
 *   Con el texto fijo la pantalla se contradecía sola: la barra decía `Aire 1 ·
 *   Urano` y el rótulo, `AIRE SIN PLANETAS`.
 */
const LECTURA_TAG: Record<"resource" | "overuse" | "cultivate", (data: ElementMapData) => string> = {
  resource: (data) => `${elementList(data.dominant).toLocaleUpperCase("es")} MÁS PRESENTE`,
  overuse: (data) => `CUANDO ${elementWithArticle(data.dominant).toLocaleUpperCase("es")} SATURA`,
  cultivate: (data) =>
    leastElementTag(data.leastRepresented, leastElementCount(data.counts, data.leastRepresented) ?? 0)
};

export function MapaElementalDetailScreen() {
  const layers = useLayers();
  const { phase, bundle, timezone, refresh, refreshing, refreshFailed } = layers;

  if (phase === "cargando") {
    return (
      <Shell>
        <LoadingBlock message="Contando tus posiciones…" />
      </Shell>
    );
  }
  if (phase === "error") {
    return (
      <Shell>
        <ErrorBlock onRetry={layers.retrySession} />
      </Shell>
    );
  }
  if (phase === "invitado") {
    return (
      <Shell>
        <GuestBlock />
      </Shell>
    );
  }
  if (phase === "vacio" || !bundle) {
    return (
      <Shell>
        <EmptyBlock />
      </Shell>
    );
  }

  const envelope = bundle.natal.elementMap;
  const data = envelope.data;

  return (
    <Shell>
      <Section>
        {/* El sobre puede llegar `stale` sin que el recálculo de esta sesión
            haya fallado; en los dos casos lo que se lee es el último cálculo
            guardado, así que en los dos se avisa y se lo fecha. */}
        {refreshFailed || anyStale([envelope]) ? (
          <View style={styles.notice}>
            <StaleNotice
              observedAt={latestObservedAt([envelope])}
              timezone={timezone}
              onRetry={refresh}
              retrying={refreshing}
            />
          </View>
        ) : null}

        {data ? (
          <>
            <View style={styles.barras}>
              {ELEMENT_ORDER.map((element) => (
                <BloqueElemento key={element} element={element} data={data} />
              ))}
            </View>
            <Legend>{`TOTAL ${data.total} DE 10 POSICIONES`}</Legend>

            <SectionHeader title="CÓMO SE JUEGA" />
            <Lectura label="RECURSO" tag={LECTURA_TAG.resource(data)} texto={data.resource} />
            <Lectura label="CUANDO SE SATURA" tag={LECTURA_TAG.overuse(data)} texto={data.overuse} />
            <Lectura label="PARA EQUILIBRAR" tag={LECTURA_TAG.cultivate(data)} texto={data.cultivate} />

            <SectionHeader title="POR QUÉ NO HAY PORCENTAJES" />
            <Note>
              {`Un porcentaje daría una precisión que el dato no tiene: son diez posiciones enteras y una sola mueve el reparto de golpe. El método cuenta únicamente las diez posiciones de Sol a Plutón, todas con el mismo peso. No incluye Ascendente, casas, nodos ni asteroides. En este recuento el Sol pesa lo mismo que Plutón, y por eso las barras dicen ${data.total} de 10 y no un porcentaje.`}
            </Note>
          </>
        ) : (
          <View style={styles.falta}>
            {missingReasons(envelope).map((razon) => (
              <Note key={razon} style={styles.faltaLinea}>
                {razon}
              </Note>
            ))}
          </View>
        )}

        <View style={styles.trace}>
          <TraceAccordion
            envelope={envelope}
            timezone={timezone}
            calculatedDatum="En qué elemento cae cada una de las diez posiciones, del Sol a Plutón —agua, tierra, fuego o aire, según el signo en el que está cada una— y cuántas suma cada elemento."
            interpretiveRule="Los elementos más repetidos se leen como recursos disponibles y los menos representados, como algo a cultivar. Es un recuento de posiciones con el mismo peso cada una, no una medida de personalidad ni un pronóstico."
          />
        </View>
      </Section>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  // Se entra desde el hub de la carta: sin historial —un deep link— "volver"
  // tiene que dejar ahí y no en Hoy.
  return (
    <DetailLayerScreen eyebrow="MAPA ELEMENTAL" fallbackHref="/perfil">
      {children}
    </DetailLayerScreen>
  );
}

/**
 * Un elemento: nombre y recuento arriba, barra de ancho completo, y debajo los
 * planetas reales de tu carta que caen ahí. Un elemento vacío lo dice (`SIN
 * PLANETAS`) en vez de desaparecer: el cero es parte de la lectura.
 */
function BloqueElemento({ element, data }: { element: ElementKey; data: ElementMapData }) {
  const count = data.counts[element];
  // El denominador es SIEMPRE el total contado, no diez fijo: si una posición no
  // se pudo calcular, la barra compara contra lo que realmente entró.
  const total = data.total;
  const puntos = data.placements.filter((placement) => placement.element === element);
  const nombre = ELEMENT_LABEL[element].toLocaleLowerCase("es");
  return (
    <View style={styles.elemento}>
      <View style={styles.elementoHead}>
        <Body style={styles.elementoLabel}>{ELEMENT_LABEL[element]}</Body>
        <Mono style={styles.elementoCount}>{String(count)}</Mono>
      </View>
      <MeterBar
        value={total > 0 ? count / total : 0}
        valueText={`${count} de ${total}`}
        accessibilityLabel={`${nombre}: ${count} ${count === 1 ? "planeta" : "planetas"} de ${total} contados.${
          puntos.length > 0 ? ` ${puntos.map((p) => p.body).join(", ")}.` : ""
        }`}
      />
      <Label style={styles.elementoPlanetas}>
        {puntos.length > 0
          ? puntos.map((placement) => placement.body.toLocaleUpperCase("es")).join(" · ")
          : "SIN PLANETAS"}
      </Label>
    </View>
  );
}

function Lectura({ label, tag, texto }: { label: string; tag: string; texto: string }) {
  return (
    <View style={styles.lectura}>
      <View style={styles.lecturaHead}>
        <Label style={styles.lecturaLabel}>{label}</Label>
        <Label style={styles.lecturaTag}>{tag}</Label>
      </View>
      <Body style={styles.lecturaTexto}>{texto}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  barras: { marginTop: v492.space.xl },
  elemento: { marginTop: v492.space.xl },
  elementoCount: { color: v492.colors.text, flexShrink: 0 },
  elementoHead: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: v492.space.md,
    justifyContent: "space-between",
    marginBottom: v492.space.sm
  },
  elementoLabel: { color: v492.colors.text, flexShrink: 1 },
  elementoPlanetas: { color: v492.colors.textDim, marginTop: v492.space.sm },
  falta: { marginTop: v492.space.lg },
  faltaLinea: { marginTop: v492.space.xs },
  lectura: { marginTop: v492.space.lg },
  lecturaHead: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: v492.space.md,
    justifyContent: "space-between"
  },
  lecturaLabel: { color: v492.colors.copper, flexShrink: 1 },
  lecturaTag: { color: v492.colors.textDim, flexShrink: 1, textAlign: "right" },
  lecturaTexto: { marginTop: v492.space.xs },
  notice: { marginTop: v492.space.lg },
  trace: { marginTop: v492.space.xxl }
});
