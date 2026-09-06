import { StyleSheet, View } from "react-native";
import { PrimaryButton } from "@/components/v492/States";
import { Touchable } from "@/components/v492/Touchable";
import { Body, Label, Note } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { freshnessNotice, type LayerFreshness } from "@/domain/layerFreshness";
import {
  formatDateTime,
  formatLocalTime,
  missingReasons,
  precisionChip,
  statusChip,
  uniqueLines,
  type StatusChip,
  type StatusTone
} from "@/domain/layers";
import type { AnalysisEnvelope, AnalysisPrecision, AnalysisStatus } from "@/services/layersApi";

/**
 * Estado honesto de cada capa.
 *
 * Un cálculo `ready` y exacto no se anuncia: lo esperado no necesita etiqueta.
 * Todo lo demás sí —el estado y también la precisión—, y siempre con la razón
 * traducida: nunca el código interno del backend (`current_ephemeris`,
 * `exact_birth_time`…), que no significa nada para quien lee.
 */

function Pill({ chip, kind }: { chip: StatusChip; kind: string }) {
  return (
    <View
      style={[styles.pill, toneStyle(chip.tone)]}
      accessibilityRole="text"
      accessibilityLabel={`${kind}: ${chip.label}. ${chip.note}`}
    >
      <Label style={[styles.pillText, chip.tone === "warn" ? styles.pillTextWarn : undefined]}>
        {chip.label}
      </Label>
    </View>
  );
}

export function StatusPill({ status }: { status: AnalysisStatus }) {
  const chip = statusChip(status);
  if (!chip) return null;
  return <Pill chip={chip} kind="Estado" />;
}

/**
 * Estado y precisión del cálculo, con su explicación de una línea.
 *
 * Van juntos porque se leen juntos: "PARCIAL" dice que falta algo y "DATO
 * ESTIMADO" dice qué tan firme es lo que quedó. Es el único lugar donde se
 * declara el estado de un módulo — `MissingBlock` ya no lo repite debajo.
 */
export function StatusLine({
  status,
  precision
}: {
  status: AnalysisStatus;
  precision: AnalysisPrecision;
}) {
  const estado = statusChip(status);
  const exactitud = precisionChip(precision, status);
  if (!estado && !exactitud) return null;
  return (
    <View style={styles.line}>
      <View style={styles.pillRow}>
        {estado ? <Pill chip={estado} kind="Estado" /> : null}
        {exactitud ? <Pill chip={exactitud} kind="Precisión" /> : null}
      </View>
      {estado ? <Note style={styles.lineNote}>{estado.note}</Note> : null}
      {exactitud ? <Note style={styles.lineNote}>{exactitud.note}</Note> : null}
    </View>
  );
}

/**
 * Módulo sin dato: se retira el contenido y se explica por qué. Nunca se deja
 * una tarjeta vacía ni se completa con un ejemplo.
 *
 * El chip de estado no va acá: lo declara el `StatusLine` que va arriba del
 * bloque. Cuando los dos lo dibujaban, la misma pantalla decía "SIN DATOS" dos
 * veces seguidas y parecían dos problemas distintos.
 */
export function MissingBlock({ envelope }: { envelope: AnalysisEnvelope }) {
  const reasons = missingReasons(envelope);
  return (
    <View style={styles.missing}>
      {reasons.map((reason) => (
        <Note key={reason} style={styles.missingLine}>
          {reason}
        </Note>
      ))}
    </View>
  );
}

/** Límites declarados del método, visibles junto al dato que condicionan. */
export function LimitationList({ limitations }: { limitations: readonly string[] }) {
  const lineas = uniqueLines(limitations);
  if (lineas.length === 0) return null;
  return (
    <View style={styles.limits}>
      <Label>LO QUE ESTE CÁLCULO NO DICE</Label>
      <View style={{ height: v492.space.sm }} />
      {lineas.map((limitation) => (
        <Note key={limitation} style={styles.missingLine}>
          · {limitation}
        </Note>
      ))}
    </View>
  );
}

/**
 * La actualización no se pudo hacer: lo que se ve es el último cálculo guardado.
 * Se avisa arriba de todo, con la fecha de ese cálculo y con reintento.
 *
 * La FECHA es la mitad del aviso: sin ella, "no pudimos actualizar" puede
 * significar hace diez minutos o anteayer, y la persona no tiene cómo decidir si
 * le sirve igual. Si no hay ningún dato calculado que fechar, se da el aviso sin
 * inventar una hora.
 *
 * El texto sirve para CUALQUIER capa y por eso no nombra el cielo ni "este
 * momento": el mismo aviso encabeza el tipo lunar y el mapa elemental, que son
 * natales y no cambian con el día, pero se vuelven a pedir en el mismo sobre. Lo
 * único que se afirma es que la actualización no se pudo hacer y desde cuándo.
 */
export function StaleNotice({
  observedAt,
  timezone,
  onRetry,
  retrying = false
}: {
  /** Cuándo se calculó el último dato visible (`latestObservedAt`). */
  observedAt: number | null;
  timezone: string;
  onRetry?: () => void;
  /** Hay un reintento en vuelo: el botón lo dice y no admite un segundo toque. */
  retrying?: boolean;
}) {
  const calculado = observedAt && timezone ? formatDateTime(observedAt, timezone) : null;
  return (
    <View style={styles.stale} accessibilityRole="alert">
      <Label style={styles.pillTextWarn}>NO PUDIMOS ACTUALIZAR ESTOS DATOS</Label>
      <View style={{ height: v492.space.sm }} />
      <Note>
        {calculado
          ? `Estás viendo el último cálculo verificado, del ${calculado}. Todavía no pudimos rehacerlo.`
          : "Estás viendo el último cálculo verificado. Todavía no pudimos rehacerlo."}
      </Note>
      {onRetry ? (
        <Touchable
          onPress={onRetry}
          disabled={retrying}
          accessibilityLabel={retrying ? "Reintentando la actualización" : "Reintentar la actualización"}
          accessibilityState={{ disabled: retrying }}
          style={styles.retry}
          pressedStyle={styles.pressed}
        >
          <Label style={styles.pillTextWarn}>{retrying ? "REINTENTANDO…" : "REINTENTAR"}</Label>
        </Touchable>
      ) : null}
    </View>
  );
}

/**
 * Qué tan de ahora es lo que estás leyendo — con el peso que le corresponde.
 *
 * El defecto que cierra: cualquier recálculo que no salía bien pintaba el MISMO
 * cartel grande con borde de cobre arriba de todo. Pero "no pudimos rehacer el
 * cálculo de hace veinte minutos" es un dato de contexto, "lo único que hay es de
 * anteayer" es un aviso, y "todavía no hay ningún cálculo" es lo único que
 * justifica un bloque. Los tres se anunciaban igual, así que el caso más leve
 * —el más frecuente— se leía como una falla del producto.
 *
 * Cuál es cuál lo decide `layerFreshness` (`@/domain/layerFreshness`), que es
 * puro; acá sólo se dibuja:
 *
 * - `fresh` → nada. El estado normal no se anuncia;
 * - `cachedToday` → una línea gris con la hora del cálculo. Mientras el reintento
 *   automático corre dice `intentando actualizar` y no ofrece control; cuando se
 *   agota dice `no se pudo actualizar` y aparece `REINTENTAR`. Nunca se anuncia
 *   como alerta: robarle el foco al lector para decir "esto se calculó a las
 *   14:05" convierte el caso más leve en el más ruidoso;
 * - `stale` → aviso compacto, con la fecha de lo que se está leyendo;
 * - `unavailable` → bloque, con el botón grande. Es el único caso en el que no
 *   hay contenido que leer.
 *
 * La FECHA es la mitad del aviso: sin ella, "no pudimos actualizar" puede
 * significar hace diez minutos o anteayer, y la persona no tiene cómo decidir si
 * le sirve igual. Cuando el dato es de hoy alcanza la hora; cuando es de otro día
 * hace falta la fecha entera. Si no hay ningún cálculo que fechar, el aviso se da
 * sin inventar una hora.
 *
 * El texto sirve para CUALQUIER capa y por eso no nombra el cielo ni "este
 * momento": el mismo aviso encabeza el tipo lunar y el mapa elemental, que son
 * natales y no cambian con el día pero se vuelven a pedir en el mismo sobre.
 */
export function FreshnessNotice({
  freshness,
  observedAt,
  timezone,
  onRetry,
  retrying = false
}: {
  freshness: LayerFreshness;
  /** Cuándo se calculó el último dato visible (`latestObservedAt`). */
  observedAt: number | null;
  timezone: string;
  onRetry?: () => void;
  /** Hay un reintento en vuelo: el control lo dice y no admite un segundo toque. */
  retrying?: boolean;
}) {
  const fechado =
    observedAt && timezone
      ? freshness === "cachedToday"
        ? formatLocalTime(observedAt, timezone)
        : formatDateTime(observedAt, timezone)
      : null;
  const aviso = freshnessNotice(freshness, fechado, { retrying });
  if (!aviso) return null;

  if (aviso.weight === "line") {
    return (
      <View style={styles.freshLine}>
        <Note style={styles.freshLineText}>{aviso.body}</Note>
        {/* El control aparece cuando hay algo que decidir: mientras el reintento
            automático corre, la línea ya dice que se está intentando y un botón
            al lado sería el mismo estado escrito dos veces. */}
        {onRetry && aviso.retryable ? (
          <Touchable
            onPress={onRetry}
            accessibilityLabel="Reintentar la actualización"
            style={styles.freshLineRetry}
            pressedStyle={styles.pressed}
          >
            <Label style={styles.pillTextWarn}>{aviso.retryLabel}</Label>
          </Touchable>
        ) : null}
      </View>
    );
  }

  const bloque = aviso.weight === "block";
  return (
    <View
      style={bloque ? styles.freshBlock : styles.freshCompact}
      accessibilityRole={aviso.alert ? "alert" : undefined}
    >
      {aviso.label ? <Label style={styles.pillTextWarn}>{aviso.label}</Label> : null}
      <View style={{ height: v492.space.sm }} />
      {bloque ? <Body>{aviso.body}</Body> : <Note>{aviso.body}</Note>}
      {onRetry ? (
        bloque ? (
          <View style={styles.freshBlockButton}>
            <PrimaryButton
              label={retrying ? "REINTENTANDO…" : aviso.retryLabel}
              accessibilityLabel={retrying ? "Reintentando el cálculo" : "Volver a calcular estos datos"}
              onPress={onRetry}
              disabled={retrying}
              align="start"
            />
          </View>
        ) : (
          <Touchable
            onPress={onRetry}
            disabled={retrying}
            accessibilityLabel={retrying ? "Reintentando la actualización" : "Reintentar la actualización"}
            accessibilityState={{ disabled: retrying }}
            style={styles.retry}
            pressedStyle={styles.pressed}
          >
            <Label style={styles.pillTextWarn}>{retrying ? "REINTENTANDO…" : aviso.retryLabel}</Label>
          </Touchable>
        )
      ) : null}
    </View>
  );
}

function toneStyle(tone: StatusTone) {
  if (tone === "warn") return styles.pillWarn;
  if (tone === "muted") return styles.pillMuted;
  return styles.pillNeutral;
}

const styles = StyleSheet.create({
  limits: {
    borderColor: v492.colors.line,
    borderRadius: v492.radius.md,
    borderWidth: 1,
    marginTop: v492.space.lg,
    padding: v492.space.lg
  },
  line: { marginBottom: v492.space.lg },
  lineNote: { marginTop: v492.space.sm },
  missing: {
    borderColor: v492.colors.line,
    borderRadius: v492.radius.md,
    borderWidth: 1,
    padding: v492.space.lg
  },
  missingLine: { marginTop: v492.space.xs },
  pill: {
    alignSelf: "flex-start",
    borderRadius: v492.radius.pill,
    borderWidth: 1,
    paddingHorizontal: v492.space.md,
    paddingVertical: 5
  },
  pillMuted: { borderColor: v492.colors.line },
  pillNeutral: { borderColor: v492.colors.line },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: v492.space.sm },
  pillText: { color: v492.colors.textMuted },
  pillTextWarn: { color: v492.colors.copperSoft },
  pillWarn: { borderColor: v492.colors.copper },
  pressed: { opacity: 0.6 },
  retry: {
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: v492.space.sm,
    minHeight: v492.touch,
    minWidth: v492.touch
  },
  // El bloque: el peso visual del error, y sólo para cuando no hay contenido.
  freshBlock: {
    borderColor: v492.colors.copper,
    borderRadius: v492.radius.md,
    borderWidth: 1,
    marginBottom: v492.space.xl,
    padding: v492.space.lg
  },
  freshBlockButton: { marginTop: v492.space.lg },
  // El aviso compacto: mismo borde, la mitad del aire y sin botón grande.
  freshCompact: {
    borderColor: v492.colors.copper,
    borderRadius: v492.radius.md,
    borderWidth: 1,
    marginBottom: v492.space.lg,
    paddingHorizontal: v492.space.md,
    paddingVertical: v492.space.md
  },
  // La línea discreta: sin caja y sin borde. Es un dato de contexto.
  freshLine: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: v492.space.md,
    marginBottom: v492.space.lg
  },
  freshLineRetry: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: v492.touch,
    minWidth: v492.touch
  },
  freshLineText: { flexShrink: 1 },
  stale: {
    borderColor: v492.colors.copper,
    borderRadius: v492.radius.md,
    borderWidth: 1,
    marginBottom: v492.space.xl,
    padding: v492.space.lg
  }
});
