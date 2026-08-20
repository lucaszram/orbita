import { StyleSheet, View } from "react-native";
import { CycleRing } from "@/components/v492/Dials";
import { SectionHeader } from "@/components/v492/Layout";
import { DataRow } from "@/components/v492/Module";
import { DetailLayerScreen, Section } from "@/components/v492/Screen";
import { FreshnessNotice, LimitationList, MissingBlock, StatusLine } from "@/components/v492/Status";
import { EmptyBlock, ErrorBlock, GuestBlock, LoadingBlock } from "@/components/v492/States";
import { TraceAccordion } from "@/components/v492/Trace";
import { Body, Label, Mono, Note, Title } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { envelopesFreshness } from "@/domain/layerFreshness";
import {
  cumplelunaView,
  formatDayMonth,
  formatDecimal,
  formatPercent,
  latestObservedAt
} from "@/domain/layers";
import {
  METHOD_HEADING,
  cumplelunaStage,
  cumplelunaTransition,
  type CumplelunaStage
} from "@/domain/layerMeaning";
import { useLayers, useNatalBase } from "@/hooks/useLayers";

/**
 * Cumpleluna — tu ciclo lunar personal.
 *
 * El Cumpleluna es la repetición del ÁNGULO que había entre el Sol y la Luna
 * cuando naciste, no un retorno de la Luna a su signo natal. Por eso el detalle
 * muestra el ángulo natal (de `layers.getNatalBase`) junto al ángulo de hoy: es
 * el dato que define el ciclo.
 *
 * Sin una hora de nacimiento exacta el método no puede fijar ese ángulo, y con
 * él quedan sin fijar las dos repeticiones que abren y cierran el ciclo. El
 * sobre publica entonces cada número con su ventana, y la pantalla dice la
 * ventana: el centro existe para poder seguir operando, no es una afirmación
 * sobre tu ciclo.
 *
 * ## Qué se lee y en qué orden
 *
 * El tramo del ciclo —en qué etapa estás, qué significa, el gesto y la
 * pregunta— → el día y el avance, con el próximo cumpleluna → los números →
 * `MÉTODO`.
 *
 * La etapa va PRIMERO porque es lo único de esta pantalla que se entiende sin
 * saber qué es el ángulo Sol–Luna. Abría con el anillo y el resumen del
 * cálculo: dos formas del mismo número —"día 12 de 29,5"— antes de decir qué
 * significa estar ahí, y un párrafo que explicaba cómo se llegó a ese número.
 * El número sigue estando, ahora debajo de su lectura; la explicación del
 * cálculo vive entera en `MÉTODO`, al pie.
 *
 * ## Una columna abierta y cuatro tramos
 *
 * Sin `Card`: la pantalla ya es una columna angosta sobre fondo plano, y dos
 * superficies con borde adentro no separaban nada que la línea fina del canon no
 * separe mejor.
 *
 * Los tramos son cuatro —`INICIO`, `DESARROLLO`, `REVISIÓN`, `CIERRE`— con
 * fronteras en 0, 25, 50, 75 y 100 % del recorrido, y cada uno trae tres cosas:
 * de qué se trata, un gesto y una pregunta. La tabla de esos textos y las
 * fronteras viven en `domain/layerMeaning`, así que se prueban sin montar la
 * pantalla.
 *
 * **La fecha de la transición al tramo siguiente sólo se dice con raíz exacta.**
 * Se deriva de las dos repeticiones del ángulo natal: sin hora exacta esas dos
 * fechas son ventanas, y una frontera calculada sobre el centro de dos ventanas
 * sería una fecha agendable que el método nunca afirmó.
 */

/** Qué son esos intervalos y por qué el cálculo no puede cerrar un número. */
const SIN_RAIZ_EXACTA =
  "Cada valor se dice como un intervalo porque falta el dato de partida exacto: son los bordes que el cálculo sí sostiene, no un día ni un número confirmado.";

export function CumplelunaDetailScreen() {
  const layers = useLayers();
  const natal = useNatalBase();
  const { phase, bundle, nowMs, localDate, timezone, refresh, refreshing, refreshFailed } = layers;

  if (phase === "cargando") {
    return (
      <DetailLayerScreen eyebrow="Cumpleluna">
        <LoadingBlock />
      </DetailLayerScreen>
    );
  }
  if (phase === "error") {
    return (
      <DetailLayerScreen eyebrow="Cumpleluna">
        <ErrorBlock onRetry={layers.retrySession} />
      </DetailLayerScreen>
    );
  }
  if (phase === "invitado") {
    return (
      <DetailLayerScreen eyebrow="Cumpleluna">
        <GuestBlock />
      </DetailLayerScreen>
    );
  }
  if (phase === "vacio" || !bundle) {
    return (
      <DetailLayerScreen eyebrow="Cumpleluna">
        <EmptyBlock />
      </DetailLayerScreen>
    );
  }

  const envelope = bundle.today.cumpleluna;
  const data = envelope.data;
  const tipoLunar = natal.bundle?.lunarType.data ?? null;
  // Con la raíz exacta los números del ciclo SON el dato. Sin ella cada uno es
  // el centro de una ventana que el sobre publica junto al valor, y lo que se
  // muestra es la ventana entera: el centro solo se leería como una fecha
  // agendable que el método nunca afirmó.
  const exacto = envelope.precision === "exact";
  const view = data ? cumplelunaView(data, envelope.precision, nowMs, timezone) : null;
  // El anillo dibuja UN arco, así que con el avance acotado el dibujo pasa a ser
  // una referencia: la franja posible se dice en palabras, en la nota que va
  // debajo del anillo y otra vez en la tabla de números.
  const franja = view?.progressBand ?? null;
  const avance = franja
    ? `avance entre ${formatPercent(franja.from)} y ${formatPercent(franja.to)}`
    : data
      ? `avance ${formatPercent(data.progress)}`
      : "";
  // En qué tramo del ciclo estás. Con el avance acotado se toma el centro de la
  // franja para elegir el tramo —es una etiqueta cualitativa, no un número que se
  // afirme—, y la pantalla ya dice arriba y abajo que hoy el avance sólo se puede
  // acotar.
  const avanceDelTramo = data ? (franja ? (franja.from + franja.to) / 2 : data.progress) : null;
  const tramo = avanceDelTramo === null ? null : cumplelunaStage(avanceDelTramo);
  // Cuándo entrás en el tramo siguiente. Sólo con raíz exacta: es una frontera
  // derivada de las dos repeticiones del ángulo, y sin hora exacta esas dos son
  // ventanas. En el tramo de cierre no hay transición que decir —lo que viene es
  // el próximo cumpleluna, que la pantalla fecha justo debajo—.
  const transicion =
    exacto && data && avanceDelTramo !== null
      ? cumplelunaTransition({
          progress: avanceDelTramo,
          previousExactAt: data.previousExactAt,
          nextExactAt: data.nextExactAt
        })
      : null;

  return (
    <DetailLayerScreen eyebrow="Cumpleluna">
      <Section>
        {/* El aviso de frescura, sólo cuando HAY dato: sin cálculo, lo que
            corresponde no es "no pudimos calcular, probá de nuevo" —sin hora
            exacta de nacimiento reintentar no cambia nada— sino el motivo real,
            que el bloque de abajo explica con las palabras del propio sobre. */}
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
        <Title>Tu ciclo lunar personal</Title>

        {/* Sin párrafo de método arriba: lo primero que se lee es en qué etapa
            del ciclo estás, y recién al final el acordeón dice cómo se
            calcula. La explicación del ángulo Sol-Luna vive entera en
            `TraceAccordion`, al pie de esta pantalla. */}
        <StatusLine status={envelope.status} precision={envelope.precision} />

        {data && view ? (
          <>
            {/* En qué tramo del ciclo estás y qué hacer con eso. Son cuatro
                tramos —inicio, desarrollo, revisión y cierre—, uno por cuarto de
                recorrido, y un solo gesto: el ciclo dura unos 29 días y una lista
                de tareas no se sostiene tanto tiempo. */}
            {tramo ? <Tramo tramo={tramo} transicion={transicion} timezone={timezone} /> : null}

            {/* Y recién ahora el número: en qué día del ciclo cae eso que acabás
                de leer y cuándo vuelve a empezar. Sin el resumen del cálculo al
                lado —era la explicación del método, y el método está al pie—. */}
            <View style={styles.ringRow}>
              <CycleRing
                progress={data.progress}
                size={110}
                label={`Ciclo personal: ${view.cycleClock.toLocaleLowerCase("es")}, ${avance}.`}
              />
              <View style={styles.ringText}>
                <Mono style={styles.cycleLabel}>{view.cycleClock}</Mono>
                <Label style={styles.next}>
                  {exacto ? "PRÓXIMO" : "PRÓXIMO, EN RANGO"} {view.nextWhen.toLocaleUpperCase("es")}
                </Label>
              </View>
            </View>
            {franja ? (
              <Note style={styles.spaced}>
                El anillo dibuja una referencia: hoy tu avance sólo se puede acotar, y está entre{" "}
                {formatPercent(franja.from)} y {formatPercent(franja.to)} del ciclo.
              </Note>
            ) : null}

            <View style={styles.block}>
              <SectionHeader title="LOS NÚMEROS DEL CICLO" cadence="CADA ~29,5 DÍAS" />
              <DataRow
                label={exacto ? "PRÓXIMO CUMPLELUNA" : "PRÓXIMO CUMPLELUNA (RANGO)"}
                value={<Mono>{view.nextExact}</Mono>}
              />
              <DataRow label="FALTAN" value={<Mono>{view.daysRemaining}</Mono>} />
              <DataRow label="DÍA DEL CICLO" value={<Mono>{view.cycleDay}</Mono>} />
              <DataRow label="LARGO DEL CICLO" value={<Mono>{view.cycleLength}</Mono>} />
              <DataRow label="ÁNGULO NATAL" value={<Mono>{view.natalAngle}</Mono>} />
              <DataRow
                label="ÁNGULO DE HOY"
                value={<Mono>{`${formatDecimal(data.currentElongationDegrees)}°`}</Mono>}
              />
              {exacto ? null : <Note style={styles.spaced}>{SIN_RAIZ_EXACTA}</Note>}
              {tipoLunar ? (
                <Note style={styles.spaced}>
                  Ese ángulo natal de {view.natalAngle} es el que define tu tipo lunar de nacimiento:{" "}
                  {tipoLunar.name.toLocaleLowerCase("es")}.
                </Note>
              ) : null}
            </View>

            <LimitationList limitations={envelope.limitations} />
          </>
        ) : (
          <View style={styles.block}>
            <MissingBlock envelope={envelope} />
          </View>
        )}

        <View style={styles.block}>
          <SectionHeader title={METHOD_HEADING} />
          <TraceAccordion
            envelope={envelope}
            timezone={timezone}
            calculatedDatum="El ángulo entre el Sol y la Luna del día que naciste, el ángulo que hay hoy entre los dos, y las dos fechas —la anterior y la próxima— en que ese ángulo natal vuelve a repetirse."
            interpretiveRule="Cuando el ángulo se repite empieza tu ciclo lunar personal, y el día del ciclo se cuenta desde ahí. Por eso no coincide con la Luna nueva del calendario: es tu propio punto de partida."
          />
        </View>
      </Section>
    </DetailLayerScreen>
  );
}

/**
 * El tramo del ciclo: su rótulo con las fronteras, de qué se trata, el gesto y
 * la pregunta.
 *
 * Las fronteras se imprimen (`50–75 % DEL CICLO`) porque son lo que convierte el
 * rótulo en un dato: sin ellas, "REVISIÓN" es una palabra elegida por alguien. El
 * porcentaje que se afirma es el del TRAMO, no el avance de la persona, que se
 * dice debajo con la precisión que el sobre sostenga.
 */
function Tramo({
  tramo,
  transicion,
  timezone
}: {
  tramo: CumplelunaStage;
  /** El cambio de tramo, sólo cuando el cálculo tiene raíz exacta. */
  transicion: ReturnType<typeof cumplelunaTransition>;
  timezone: string;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.tramoHead}>
        <Label style={styles.tramoLabel}>{tramo.label}</Label>
        <Label style={styles.tramoRango}>
          {`${tramo.range.fromPercent}–${tramo.range.toPercent} % DEL CICLO`}
        </Label>
      </View>
      <Body style={styles.spaced}>{tramo.focus}</Body>

      <Label style={styles.tramoRotulo}>PARA BAJARLO A TIERRA</Label>
      <Body style={styles.spaced}>{tramo.action}</Body>

      <Label style={styles.tramoRotulo}>PARA PREGUNTARTE HOY</Label>
      <Body style={styles.spaced}>{tramo.question}</Body>

      {transicion ? (
        <Note style={styles.spaced}>
          {`Entrás en ${transicion.label.toLocaleLowerCase("es")} el ${formatDayMonth(
            transicion.atMs,
            timezone
          )}.`}
        </Note>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: v492.space.xl },
  cycleLabel: { color: v492.colors.text },
  next: { marginTop: v492.space.sm },
  ringRow: { alignItems: "center", flexDirection: "row", gap: v492.space.lg, marginTop: v492.space.lg },
  ringText: { flex: 1 },
  spaced: { marginTop: v492.space.md },
  tramoHead: { alignItems: "baseline", flexDirection: "row", flexWrap: "wrap", gap: v492.space.md },
  tramoLabel: { color: v492.colors.copper },
  tramoRango: { color: v492.colors.textDim },
  tramoRotulo: { color: v492.colors.copper, marginTop: v492.space.lg }
});
