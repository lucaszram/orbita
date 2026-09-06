import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { MoonDial } from "@/components/v492/Dials";
import { Legend, MetaRow, SectionHeader } from "@/components/v492/Layout";
import { DetailLayerScreen, Section } from "@/components/v492/Screen";
import { StaleNotice } from "@/components/v492/Status";
import { EmptyBlock, ErrorBlock, GuestBlock, LoadingBlock } from "@/components/v492/States";
import { TraceAccordion } from "@/components/v492/Trace";
import { Body, Label, Note, Title } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import {
  anyStale,
  degreeRangeLabel,
  formatDecimal,
  illuminatedFractionAt,
  latestObservedAt,
  LUNAR_CYCLE,
  missingReasons,
  phaseShapeIllumination,
  uniqueLines
} from "@/domain/layers";
import { useLayers } from "@/hooks/useLayers";
import type { LunarTypeData } from "@/services/layersApi";

/**
 * Tipo lunar — detalle (Figma V4.9.2 `969:907`).
 *
 * La composición del canon: hero centrado —disco grande, nombre en serif y la
 * línea `SOL–LUNA AL NACER 108° · FASE 3 DE 8`—, `EL CICLO COMPLETO` con las
 * ocho fases en una fila, y después `QUÉ SIGNIFICA`, `CÓMO PUEDE APARECER EN
 * VOS` y `LO QUE NO DICE`. Sin tablas de números repetidos: el ángulo y el lugar
 * en el ciclo se dicen UNA vez, en el hero.
 *
 * El tipo lunar es la fase en la que estaba la Luna cuando naciste, y se define
 * con UN dato: el ángulo que había entre el Sol y la Luna. El ciclo entero son
 * 360°, repartidos en ocho fases de 45°, así que decir "fase 3 de 8" no es una
 * escala inventada: es dónde cae tu ángulo.
 *
 * Sin hora exacta de nacimiento el ángulo del instante no se puede fijar. La
 * fase sí —fue la misma todo el día—, así que se afirma la fase y el margen va
 * INLINE en la misma línea del ángulo (`±6° SIN HORA`) en vez de imprimir un
 * valor puntual que nadie midió.
 */

/**
 * Los tres momentos con los que se lee una fase, siempre los mismos y en este
 * orden. El sobre trae la clave del momento y su texto; el rótulo es de la
 * pantalla. Si apareciera una clave que todavía no está acá, se usa el rótulo
 * del sobre en vez de perder el bloque.
 */
const MOMENTO_TITULO: Record<string, string> = {
  starting: "AL EMPEZAR",
  learning: "ANTE UN OBSTÁCULO",
  closing: "AL CERRAR"
};

/** Qué son estos textos y qué no son. Va antes de leerlos, no después. */
const AVISO_TENDENCIAS = "Estas son tendencias posibles, no rasgos fijos.";

/**
 * Lo que la fase no dice, cuando el sobre no declara límites propios. Es el
 * texto del frame y describe el método, no el día.
 */
const NO_DICE =
  "La fase describe un modo de moverte, no tu carácter entero ni lo que te va a pasar. Dos personas con la misma fase pueden vivirla de maneras opuestas.";

export function TipoLunarDetailScreen() {
  const layers = useLayers();
  const { phase, bundle, timezone, refresh, refreshing, refreshFailed } = layers;

  if (phase === "cargando") {
    return (
      <Shell>
        <LoadingBlock message="Calculando tu tipo lunar…" />
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

  const envelope = bundle.natal.lunarType;
  const data = envelope.data;
  // La fase se sostiene con la hora abierta; el ángulo y la iluminación, no.
  // Todo número del instante vive dentro de esta rama.
  const exacto = envelope.precision === "exact";
  const limites = uniqueLines(envelope.limitations);

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
            <View style={styles.hero}>
              {/* Sin hora exacta el disco dibuja la FORMA de la fase, no una
                  fracción medida, y `approximate` lo declara en el dibujo y
                  en su etiqueta. */}
              <MoonDial
                illumination={exacto ? data.illumination : phaseShapeIllumination(data.phaseKey)}
                phaseKey={data.phaseKey}
                phaseName={data.name}
                size={132}
                approximate={!exacto}
              />
              <Title style={styles.heroTitulo}>{data.name}</Title>
              <View style={styles.heroMeta}>
                <MetaRow
                  items={[
                    exacto
                      ? `SOL–LUNA AL NACER ${formatDecimal(data.elongationDegrees)}°`
                      : `SOL–LUNA ${formatDecimal(data.elongationDegrees)}°`,
                    exacto ? null : "±6° SIN HORA",
                    `FASE ${data.phaseIndex + 1} DE ${LUNAR_CYCLE.length}`
                  ]}
                />
              </View>
            </View>

            {/* Qué se sabe y qué no, cuando falta la hora. Va pegado al hero
                porque corrige el número que está justo arriba: la fase se
                afirma —fue la misma todo el día—, el ángulo del instante no. */}
            {!exacto ? (
              <Note style={styles.margen}>
                Sin tu hora exacta no podemos fijar el ángulo del instante en que naciste. La fase sí:
                fue la misma durante todo el día, así que el ángulo se publica con su margen y no como
                un valor exacto.
              </Note>
            ) : null}

            <SectionHeader title="EL CICLO COMPLETO" bullet={false} />
            <CicloDeFases data={data} exacto={exacto} />
            <Body style={styles.cicloTexto}>
              El tipo lunar natal no cambia: surge del ángulo entre el Sol y la Luna en el momento de tu
              nacimiento.
            </Body>

            <SectionHeader title="QUÉ SIGNIFICA" />
            <Body>{data.summary}</Body>

            <SectionHeader title="CÓMO PUEDE APARECER EN VOS" />
            <Body style={styles.aviso}>{AVISO_TENDENCIAS}</Body>
            {data.traits.length > 0 ? (
              data.traits.map((trait) => (
                <View key={trait.key} style={styles.trait}>
                  <Label style={styles.traitLabel}>
                    {MOMENTO_TITULO[trait.key] ?? trait.label.toLocaleUpperCase("es")}
                  </Label>
                  <Body style={styles.traitBody}>{trait.body}</Body>
                </View>
              ))
            ) : (
              <Note style={styles.aviso}>Todavía no hay una lectura escrita para esta fase.</Note>
            )}

            <SectionHeader title="LO QUE NO DICE" />
            {limites.length > 0 ? (
              limites.map((limite) => (
                <Body key={limite} style={styles.limite}>
                  {limite}
                </Body>
              ))
            ) : (
              <Body>{NO_DICE}</Body>
            )}
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
            calculatedDatum="El ángulo entre el Sol y la Luna en el momento de tu nacimiento, la fracción iluminada que le corresponde y en cuál de las ocho fases del ciclo cae."
            interpretiveRule="El ciclo Sol–Luna se divide en ocho fases de 45°. La fase de nacimiento describe una manera de empezar, de sostener y de cerrar procesos; no anticipa hechos ni describe tu personalidad entera."
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
    <DetailLayerScreen eyebrow="TIPO LUNAR NATAL" fallbackHref="/perfil">
      {children}
    </DetailLayerScreen>
  );
}

/**
 * El ciclo completo: las ocho fases en UNA fila, con la tuya resaltada.
 *
 * Los siete discos que no son tuyos se dibujan en el punto medio de su fase
 * —que es lo que representan— y el tuyo, con la iluminación real del sobre. La
 * leyenda de abajo lo dice: un disco de referencia no es un dato de tu carta.
 *
 * Sin hora exacta el tuyo tampoco es una medición, así que se dibuja como los
 * otros siete —en el punto medio de la fase— y la leyenda deja de prometer una
 * iluminación real que el cálculo no tiene.
 */
function CicloDeFases({ data, exacto }: { data: LunarTypeData; exacto: boolean }) {
  return (
    <View>
      <View style={styles.ciclo}>
        {LUNAR_CYCLE.map((fase, indice) => {
          const propia = fase.key === data.phaseKey;
          const medida = propia && exacto;
          const iluminacion = medida
            ? data.illumination
            : illuminatedFractionAt((fase.startDegrees + fase.endDegrees) / 2);
          return (
            <View
              key={fase.key}
              style={[styles.cicloCelda, propia ? styles.cicloCeldaPropia : null]}
              accessible
              accessibilityLabel={etiquetaDeFase({ fase, indice, propia, medida, iluminacion })}
            >
              {/* El disco ya se anuncia dentro de la etiqueta de la celda: sin
                  esto, VoiceOver leería la luna y el nombre por separado. */}
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <MoonDial
                  illumination={iluminacion}
                  phaseKey={fase.key}
                  phaseName={fase.name}
                  size={34}
                  approximate={propia && !medida}
                />
              </View>
            </View>
          );
        })}
      </View>
      <Legend>{`TU FASE: ${data.name.toLocaleUpperCase("es")} · ${degreeRangeLabel(
        LUNAR_CYCLE[data.phaseIndex]?.startDegrees ?? 0,
        LUNAR_CYCLE[data.phaseIndex]?.endDegrees ?? 0
      )}`}</Legend>
    </View>
  );
}

function etiquetaDeFase({
  fase,
  indice,
  propia,
  medida,
  iluminacion
}: {
  fase: (typeof LUNAR_CYCLE)[number];
  indice: number;
  propia: boolean;
  /** El disco dibuja la iluminación medida de tu nacimiento, no la de la fase. */
  medida: boolean;
  iluminacion: number;
}): string {
  const base = `Fase ${indice + 1} de ${LUNAR_CYCLE.length}: ${fase.name.toLocaleLowerCase("es")}, de ${
    fase.startDegrees
  } a ${fase.endDegrees} grados`;
  if (!propia) return `${base}.`;
  return medida
    ? `${base}. Es tu fase de nacimiento, con ${Math.round(iluminacion * 100)} por ciento iluminada.`
    : `${base}. Es tu fase de nacimiento, dibujada en el punto medio de la fase: no se afirma cuánto estaba iluminada.`;
}

const styles = StyleSheet.create({
  aviso: { marginTop: v492.space.xs },
  ciclo: { alignItems: "center", flexDirection: "row", gap: v492.space.xs, marginTop: v492.space.sm },
  cicloCelda: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: v492.radius.sm,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 3
  },
  cicloCeldaPropia: { borderColor: v492.colors.copper },
  cicloTexto: { marginTop: v492.space.lg },
  falta: { marginTop: v492.space.lg },
  faltaLinea: { marginTop: v492.space.xs },
  hero: { alignItems: "center", marginTop: v492.space.xl },
  heroMeta: { alignItems: "center", marginTop: v492.space.sm },
  heroTitulo: { marginTop: v492.space.lg, textAlign: "center" },
  limite: { marginTop: v492.space.sm },
  margen: { marginTop: v492.space.lg },
  notice: { marginTop: v492.space.lg },
  trace: { marginTop: v492.space.xl },
  trait: { marginTop: v492.space.lg },
  traitBody: { marginTop: v492.space.xs },
  traitLabel: { color: v492.colors.copper }
});
