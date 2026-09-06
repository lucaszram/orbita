import { useState, type ReactNode } from "react";
import { LayoutAnimation, Platform, StyleSheet, View } from "react-native";
import { Touchable } from "@/components/v492/Touchable";
import { Body, Divider, Label, Note } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import {
  ANALYSIS_TITLE,
  elaborationNote,
  formatDateTime,
  PRECISION_LABEL,
  SOURCE_RELATION_LABEL,
  sourcePages,
  uniqueLines,
  uniqueSources
} from "@/domain/layers";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { AnalysisEnvelope } from "@/services/layersApi";

/**
 * Trazabilidad: de dónde sale lo que estás viendo.
 *
 * Seis bloques, siempre los mismos y siempre separados, para que la respuesta se
 * pueda recorrer sin leerla entera:
 *
 * 1. DATO CALCULADO — qué número o qué hecho se calculó, cuándo y con qué
 *    precisión;
 * 2. REGLA INTERPRETATIVA — con qué criterio ese dato se convierte en lo que
 *    dice la pantalla;
 * 3. MÉTODO Y VERSIÓN — el identificador del análisis y de su método;
 * 4. LIBRO, AUTOR Y LOCALIZADOR — la bibliografía con capítulo y páginas;
 * 5. TIPO DE ELABORACIÓN — si es cálculo directo, síntesis de Órbita o lectura
 *    experimental;
 * 6. LIMITACIÓN — lo que este cálculo declara que NO dice.
 *
 * Ninguno se salta cuando está vacío: se dice que está vacío. Lo que NO se
 * muestra: el proveedor de efemérides, los hashes internos ni los puntajes del
 * orden — nada de eso le sirve a quien lee y varias de esas cosas son ruido de
 * desarrollo.
 *
 * Arranca plegado: la persona decide si quiere el detalle.
 */
export function TraceAccordion({
  envelope,
  timezone,
  calculatedDatum,
  interpretiveRule
}: {
  envelope: AnalysisEnvelope;
  timezone: string;
  /** Qué se calculó, en palabras de todos los días (no la fórmula). */
  calculatedDatum: string;
  /** Con qué criterio ese dato se lee como lo que dice la pantalla. */
  interpretiveRule: string;
}) {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  function toggle() {
    // La transición de alto sólo se pide cuando el sistema no pidió menos
    // movimiento. En Android no se usa LayoutAnimation (necesita un flag
    // experimental): el cambio es instantáneo y no hay nada que apagar.
    if (!reducedMotion && Platform.OS === "ios") {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpen((value) => !value);
  }

  const calculado = timezone ? formatDateTime(envelope.observedAt, timezone, { withYear: true }) : null;
  // Una capa que se arma en dos pasos puede declarar el mismo límite dos veces;
  // repetido en la lista se lee como dos límites distintos.
  const limitaciones = uniqueLines(envelope.limitations);
  // Lo mismo con la bibliografía: la misma obra citada por los dos pasos se lee
  // como dos respaldos donde hay uno. Se deduplica por obra Y localizador —dos
  // capítulos distintos del mismo libro son dos citas legítimas— y se conserva
  // la primera entera, con su edición y su nota de localizador.
  const fuentes = uniqueSources(envelope.sourceRefs);

  return (
    <View style={styles.wrap}>
      <Touchable
        onPress={toggle}
        accessibilityState={{ expanded: open }}
        accessibilityLabel="¿Por qué Órbita te muestra esto?"
        accessibilityHint={open ? "Toca para ocultar las fuentes" : "Toca para ver método y fuentes"}
        style={styles.head}
        pressedStyle={styles.pressed}
      >
        <Label style={styles.headLabel}>¿POR QUÉ ÓRBITA TE MUESTRA ESTO?</Label>
        <Label style={styles.sign}>{open ? "−" : "+"}</Label>
      </Touchable>

      {open ? (
        <View style={styles.body}>
          <Bloque titulo="DATO CALCULADO" primero>
            <Body style={styles.value}>{calculatedDatum}</Body>
            <Note style={styles.value}>
              Precisión del cálculo: {PRECISION_LABEL[envelope.precision]}.
            </Note>
            {calculado ? <Note style={styles.value}>Calculado el {calculado}.</Note> : null}
          </Bloque>

          <Bloque titulo="REGLA INTERPRETATIVA">
            <Body style={styles.value}>{interpretiveRule}</Body>
          </Bloque>

          <Bloque titulo="MÉTODO Y VERSIÓN">
            <Body style={styles.value}>
              {ANALYSIS_TITLE[envelope.analysisId]} · {envelope.analysisId}
            </Body>
            <Note style={styles.value}>{envelope.methodVersion}</Note>
          </Bloque>

          <Bloque titulo="LIBRO, AUTOR Y LOCALIZADOR">
            {fuentes.length > 0 ? (
              fuentes.map((source, index) => (
                <View key={`${source.sourceId}-${index}`} style={styles.source}>
                  <Body style={styles.sourceTitle}>{source.title}</Body>
                  {/* La edición es parte del localizador: las páginas que se
                      citan sólo se pueden encontrar en la edición usada. */}
                  <Note>
                    {source.author}
                    {source.edition ? ` · ${source.edition}` : ""}
                  </Note>
                  <Note>
                    {source.chapter}
                    {source.section ? ` · ${source.section}` : ""} · {sourcePages(source)}
                  </Note>
                  <Note style={styles.relation}>
                    {SOURCE_RELATION_LABEL[source.relation] ?? source.relation} · {source.locatorNote}
                  </Note>
                </View>
              ))
            ) : (
              <Note style={styles.value}>Este cálculo no cita ninguna obra: es aritmética del método.</Note>
            )}
          </Bloque>

          <Bloque titulo="TIPO DE ELABORACIÓN">
            <Body style={styles.value}>{elaborationNote(envelope)}</Body>
          </Bloque>

          <Bloque titulo="LIMITACIÓN">
            {limitaciones.length > 0 ? (
              limitaciones.map((limitation) => (
                <Note key={limitation} style={styles.value}>
                  · {limitation}
                </Note>
              ))
            ) : (
              <Note style={styles.value}>
                Este cálculo no declara límites propios más allá de los del método.
              </Note>
            )}
          </Bloque>
        </View>
      ) : null}
    </View>
  );
}

/** Cada bloque va separado por su regla: seis unidades, no una lista corrida. */
function Bloque({
  titulo,
  primero = false,
  children
}: {
  titulo: string;
  primero?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={primero ? undefined : styles.block}>
      {primero ? null : <Divider style={styles.rule} />}
      <Label>{titulo}</Label>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: v492.space.lg },
  body: { paddingBottom: v492.space.lg, paddingHorizontal: v492.space.lg },
  head: {
    alignItems: "center",
    flexDirection: "row",
    gap: v492.space.md,
    justifyContent: "space-between",
    minHeight: v492.touch,
    paddingHorizontal: v492.space.lg
  },
  headLabel: { color: v492.colors.textMuted, flex: 1 },
  pressed: { opacity: 0.7 },
  relation: { color: v492.colors.textDim, marginTop: 2 },
  rule: { marginBottom: v492.space.lg },
  sign: { color: v492.colors.copper, fontSize: 16 },
  source: { marginTop: v492.space.md },
  sourceTitle: { color: v492.colors.text },
  value: { marginTop: v492.space.xs },
  wrap: {
    borderColor: v492.colors.line,
    borderRadius: v492.radius.md,
    borderWidth: 1,
    marginTop: v492.space.xl
  }
});
