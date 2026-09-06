import type { ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { MeasuredSquare } from "@/components/orbita/ContentCanvas";
import { NatalWheel } from "@/components/orbita/NatalWheel";
import { MoonDial } from "@/components/v492/Dials";
import { Legend, LinkRow, MetaRow, SectionHeader } from "@/components/v492/Layout";
import { MeterBar } from "@/components/v492/Meter";
import { LayerScreen, Section } from "@/components/v492/Screen";
import { Touchable } from "@/components/v492/Touchable";
import { StaleNotice } from "@/components/v492/Status";
import { EmptyBlock, ErrorBlock, GuestBlock, LoadingBlock, PrimaryButton } from "@/components/v492/States";
import { TraceAccordion } from "@/components/v492/Trace";
import { Body, Label, Mono, Note, Title } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import {
  anyStale,
  ELEMENT_LABEL,
  ELEMENT_ORDER,
  formatDecimal,
  hasData,
  latestObservedAt,
  missingReasons,
  phaseShapeIllumination
} from "@/domain/layers";
import {
  angleRowView,
  ASCENDENTE_INICIO_CASA,
  ASCENDENTE_INICIO_CASA_VOZ,
  birthTimePrecisionNote,
  drawablePositions,
  hasExactBirthTime,
  natalWheelPayload,
  positionByKey,
  positionView
} from "@/domain/natalChartBase";
import {
  natalAspectsAccess,
  natalChartState,
  natalHousesAccess,
  type NatalChartState
} from "@/domain/natalChartState";
import { sessionPhase } from "@/domain/screenPhase";
import { useLayers } from "@/hooks/useLayers";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useNatalChartRecovery } from "@/hooks/useNatalChartRecovery";
import {
  layersApi,
  type AnalysisEnvelope,
  type ElementMapData,
  type LunarTypeData,
  type NatalChartBase,
  type NatalPosition
} from "@/services/layersApi";

/**
 * Carta · tu base — hub del Perfil (Figma V4.9.2 `935:247` / `976:1041`).
 *
 * Tres bloques numerados sobre línea fina: `01 TU CARTA` con el dibujo, la
 * tríada tabular y el resumen de lo que la carta tiene; `02 TIPO LUNAR NATAL`;
 * `03 MAPA ELEMENTAL`. Sin tarjetas, sin chips repetidos y sin muro de pago: lo
 * que la cuenta no puede ver hoy se dice en una línea del resumen.
 *
 * UNA sola fuente para la carta: `layers.getNatalChartBase`. Ese read-model trae
 * las diez posiciones canónicas —Sol a Plutón—, los ejes y las casas cuando la
 * hora lo permite, los aspectos mayores, la precisión declarada y el acceso de
 * la cuenta. Las dos capas natales siguen saliendo del sobre compartido de
 * `useLayers()`: son otro cálculo, con su propio estado, y que una falte no
 * apaga a la otra.
 *
 * **Decisión sobre el dibujo.** El frame V4.9.2 usa una ILUSTRACIÓN rotulada
 * "no codifica tus grados". Acá se sigue esa decisión sólo donde corresponde:
 * cuando la carta publica longitudes reales se dibuja la rueda REAL —es el dato,
 * no arte aproximado, y sustituirla por una lámina sería perder información—, y
 * cuando no hay ni un grado que ubicar (sin hora de nacimiento) se usa el asset
 * canónico con su rótulo exacto, que es justamente lo que el frame muestra en el
 * estado sin hora. En ningún caso se dibujan puntos inventados.
 *
 * Sin hora exacta no hay Ascendente, ni Medio Cielo, ni casas, ni grados: el
 * contrato los retira a propósito, la pantalla lo dice en su bajada y ofrece la
 * única acción que lo cambia — cargar la hora.
 */

/** El asset canónico de la carta, para el estado sin grados que ubicar. */
const ILUSTRACION = require("../../../assets/orbita/core/orbita_carta_natal_diagram_a.png");

export function CartaHubScreen() {
  const live = useLiveApp();
  const phase = sessionPhase(live);

  if (phase === "cargando") {
    return (
      <Shell>
        <LoadingBlock />
      </Shell>
    );
  }
  if (phase === "error") {
    return (
      <Shell>
        <ErrorBlock onRetry={live.retryUser} />
      </Shell>
    );
  }
  if (phase === "invitado") {
    // Sin mocks: la carta se calcula sobre TUS datos, no hay rueda de ejemplo.
    return (
      <Shell>
        <GuestBlock />
      </Shell>
    );
  }
  return <CartaHubLive />;
}

function Shell({
  children,
  intro,
  onRefresh,
  refreshing
}: {
  children: ReactNode;
  intro?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <LayerScreen
      eyebrow="CARTA · TU BASE"
      title="Tu carta"
      /* El engranaje vive en el Shell — que envuelve cargando, error, invitado
         y live — así el invitado también llega a ajustes para iniciar sesión.
         Reemplaza a la fecha del día: la base natal es lo que no se mueve, y
         esta pestaña necesita su salida hacia lo administrativo. */
      action={
        <Touchable
          onPress={() => router.push("/perfil/ajustes")}
          accessibilityRole="button"
          accessibilityLabel="Ajustes de tu cuenta"
        >
          <Mono style={styles.gearGlyph}>{"\u2699\uFE0E"}</Mono>
        </Touchable>
      }
      capas="BASE NATAL"
      intro={intro}
      onRefresh={onRefresh}
      refreshing={refreshing}
    >
      {children}
    </LayerScreen>
  );
}

/**
 * Las queries sólo se montan con sesión confirmada: el read-model de la carta y
 * el sobre de capas necesitan la fila `users` creada.
 */
function CartaHubLive() {
  const chart = useQuery(layersApi.getNatalChartBase, {});
  const layers = useLayers();
  const { bundle, nowMs, timezone, refresh, refreshing, refreshFailed } = layers;
  const natal = bundle?.natal ?? null;
  const lunarType = natal?.lunarType ?? null;
  const elementMap = natal?.elementMap ?? null;
  // El sobre de capas todavía no resolvió: es carga, no ausencia de dato.
  const cargandoCapas = layers.phase === "cargando";
  const sinHora = chart ? !hasExactBirthTime(chart) : false;
  // Un solo resolvedor para los siete estados, compartido con la carta completa.
  const estado = natalChartState({ chart, refreshing, refreshFailed });
  // Y un solo mecanismo de recuperación, también compartido: el botón de la
  // carta llama a `charts.recoverNatalChart` y recién después ESPERA el
  // recálculo del día. `refresh` a secas rearma las capas y NO genera la carta,
  // que es de donde salen los ejes y las casas que este estado dice que faltan.
  // El alcance es esta carta de esta cuenta, no la app entera.
  const recuperacion = useNatalChartRecovery({ recovery: estado.recovery, chart });

  return (
    <Shell
      intro={
        sinHora
          ? "Sin tu hora de nacimiento se retiran las casas y el Ascendente. Lo que queda visible se sostiene sin casas ni ángulos."
          : "Lo que no se mueve. Es el punto de partida contra el que se lee todo lo demás."
      }
      onRefresh={refresh}
      refreshing={refreshing}
    >
      {/* El sobre puede llegar `stale` sin que el recálculo de esta sesión haya
          fallado; en los dos casos lo que se lee es el último cálculo guardado,
          así que en los dos se avisa y se lo fecha. */}
      {natal && (refreshFailed || anyStale([natal.lunarType, natal.elementMap])) ? (
        <Section>
          <StaleNotice
            observedAt={latestObservedAt([natal.lunarType, natal.elementMap])}
            timezone={timezone}
            onRetry={refresh}
            retrying={refreshing}
          />
        </Section>
      ) : null}

      <Section>
        {/* La salida del estado, no una suposición de la pantalla: la hora se
            ofrece cuando completarla es lo que destraba la carta. */}
        {sinHora || estado.recovery === "completar-hora" ? (
          <View style={styles.cta}>
            <PrimaryButton
              label="AGREGAR O CORREGIR HORA"
              accessibilityLabel="Agregar o corregir tu hora de nacimiento"
              onPress={() => router.push("/editar-datos" as never)}
            />
          </View>
        ) : null}

        <SectionHeader index="01" title="TU CARTA" cadence="BASE NATAL" />
        <CartaBase
          chart={chart}
          estado={estado}
          onRetry={recuperacion.recuperar}
          refreshing={recuperacion.ocupado}
          fallo={recuperacion.fallo}
        />

        <SectionHeader index="02" title="TIPO LUNAR NATAL" cadence="BASE NATAL" />
        <LayerBody envelope={lunarType} loading={cargandoCapas}>
          {lunarType?.data ? (
            <TipoLunarBloque data={lunarType.data} exacto={lunarType.precision === "exact"} />
          ) : null}
        </LayerBody>
        {lunarType && hasData(lunarType) ? (
          <LinkRow
            label="VER DETALLE"
            accessibilityLabel="Ver mi tipo lunar"
            accessibilityHint="Abre la fase lunar de tu nacimiento"
            onPress={() => router.push("/perfil/carta/tipo-lunar" as never)}
          />
        ) : null}
        {lunarType ? (
          <TraceAccordion
            envelope={lunarType}
            timezone={timezone}
            calculatedDatum="El ángulo entre el Sol y la Luna en tu nacimiento, la fracción iluminada que le corresponde y la fase del ciclo en la que cae."
            interpretiveRule="El ciclo Sol–Luna se divide en ocho fases. La fase de nacimiento describe una manera de empezar y de cerrar procesos; no anticipa hechos."
          />
        ) : null}

        <SectionHeader index="03" title="MAPA ELEMENTAL" cadence="BASE NATAL" />
        <Body style={styles.intro}>
          Distribución elemental simple: los 10 planetas, cada uno con el mismo peso. Sin Ascendente, casas
          ni asteroides.
        </Body>
        <LayerBody envelope={elementMap} loading={cargandoCapas}>
          {elementMap?.data ? <MapaElementalBloque data={elementMap.data} sinHora={sinHora} /> : null}
        </LayerBody>
        {elementMap && hasData(elementMap) ? (
          <LinkRow
            label="VER DETALLE"
            accessibilityLabel="Ver mi mapa elemental"
            accessibilityHint="Abre el reparto de fuego, tierra, aire y agua"
            onPress={() => router.push("/perfil/carta/mapa-elemental" as never)}
          />
        ) : null}
        {elementMap ? (
          <TraceAccordion
            envelope={elementMap}
            timezone={timezone}
            calculatedDatum="En qué elemento cae cada una de las diez posiciones de tu carta —agua, tierra, fuego o aire— y cuántas suma cada uno."
            interpretiveRule="Los elementos más repetidos señalan recursos disponibles y los menos representados, algo a equilibrar. Es un recuento de posiciones, no una medida de personalidad."
          />
        ) : null}

        {chart && sinHora ? <PrecisionDeTuHora chart={chart} /> : null}
      </Section>
    </Shell>
  );
}

/**
 * La carta, o el motivo por el que todavía no está.
 *
 * Los estados los resuelve `natalChartState`, no esta pantalla: el hub y la
 * carta completa tienen que contar exactamente lo mismo, y antes cada una
 * interpretaba `access.positions` por su cuenta —una decía "se está calculando"
 * para siempre y la otra mostraba un muro de Plus por un cálculo pendiente—.
 */
function CartaBase({
  chart,
  estado,
  onRetry,
  refreshing,
  fallo
}: {
  chart: NatalChartBase | null | undefined;
  estado: NatalChartState;
  onRetry: () => void;
  refreshing: boolean;
  /** El último intento de recuperación falló. */
  fallo: boolean;
}) {
  if (estado.phase === "cargando") return <LoadingBlock message="Abriendo tu carta…" />;
  if (estado.phase === "sin-datos") return <EmptyBlock />;
  if (estado.phase === "calculando") {
    return <Calculando motivo={estado.reason} />;
  }
  if (estado.phase === "sin-calculo") {
    return <SinCalculo onRetry={onRetry} refreshing={refreshing} fallo={fallo} motivo={estado.reason} />;
  }
  // `parcial` y `listo` muestran la carta: lo que un cálculo parcial no publicó
  // ya se nombra donde falta (la tríada, el resumen y el bloque de precisión).
  if (!chart) return <SinCalculo onRetry={onRetry} refreshing={refreshing} fallo={fallo} motivo={null} />;
  return (
    <>
      <CartaResumen chart={chart} />
      {/* Un parcial que SÍ se puede recuperar —le falta cálculo, no un dato de la
          persona— ofrece pedirlo otra vez. El parcial por hora desconocida no:
          esa salida es completar la hora, y su botón ya está arriba. */}
      {estado.phase === "parcial" && estado.canRetry ? (
        <FaltaCalculo onRetry={onRetry} refreshing={refreshing} fallo={fallo} motivo={estado.reason} />
      ) : null}
    </>
  );
}

/**
 * Lo que se dice cuando el intento de recuperación falló.
 *
 * No borra ni tapa la carta parcial que ya estaba publicada: sólo agrega el
 * hecho de que ESTE intento no salió, en región viva para que un lector de
 * pantalla no se quede esperando en silencio.
 */
function FalloDeRecuperacion() {
  return (
    <View accessibilityLiveRegion="polite">
      <Note style={styles.spaced}>
        No pudimos completar el cálculo ahora. Tus datos siguen guardados y lo que ya estaba publicado
        no se toca: podés volver a intentarlo.
      </Note>
    </View>
  );
}

/**
 * Hay carta, y le falta una parte que SÍ depende del cálculo.
 *
 * Se distingue de `SinCalculo` en que acá hay carta para mostrar, y de la carta
 * sin hora en que esto se resuelve del lado de Órbita. El defecto que cierra:
 * `canRetry` valía `true` para cualquier `parcial`, así que la carta sin hora
 * —completa para los datos que hay— quedaba marcada como reintentable.
 */
function FaltaCalculo({
  onRetry,
  refreshing,
  fallo,
  motivo
}: {
  onRetry: () => void;
  refreshing: boolean;
  fallo: boolean;
  motivo: string | null;
}) {
  return (
    <View style={styles.pendiente}>
      <Label style={styles.pendienteLabel}>FALTA UNA PARTE DEL CÁLCULO</Label>
      <Note style={styles.spaced}>
        {motivo ??
          "Tu carta está publicada, pero una parte del cálculo todavía no llegó. Tus datos están completos: lo que falta es de nuestro lado."}
      </Note>
      {fallo ? <FalloDeRecuperacion /> : null}
      <View style={styles.action}>
        <PrimaryButton
          label={refreshing ? "CALCULANDO…" : fallo ? "REINTENTAR" : "COMPROBAR DE NUEVO"}
          accessibilityLabel={
            refreshing
              ? "Calculando la parte que falta de tu carta"
              : "Calcular de nuevo la parte que falta de tu carta"
          }
          onPress={onRetry}
          disabled={refreshing}
        />
      </View>
    </View>
  );
}

/**
 * Hay una corrida ACTIVA y todavía no hay posiciones.
 *
 * Es el único estado que puede decir que la carta se está calculando, porque es
 * el único en el que algo se está calculando. No ofrece botón: no hay nada que
 * relanzar mientras la corrida vive, y un botón acá invitaría a apilar pedidos.
 */
function Calculando({ motivo }: { motivo: string | null }) {
  return (
    <View style={styles.pendiente}>
      {/* El estado cambia solo cuando el cálculo termina; sin región viva, quien
          usa lector de pantalla se queda esperando en silencio. */}
      <View accessibilityLiveRegion="polite">
        <Label style={styles.pendienteLabel}>TU CARTA SE ESTÁ CALCULANDO</Label>
      </View>
      <Note style={styles.spaced}>
        Tus datos siguen guardados. Las posiciones se calculan y se verifican del lado de Órbita, y eso
        puede tardar un par de minutos; hasta que termine no mostramos una carta anterior ni una de ejemplo.
      </Note>
      {motivo ? <Note style={styles.spaced}>{motivo}</Note> : null}
    </View>
  );
}

/**
 * NO hay corrida activa y tampoco posiciones: el último intento terminó sin
 * publicar la carta.
 *
 * Es RECUPERABLE, no un fallo permanente: se dice qué pasó con el texto del
 * propio cálculo y se ofrece comprobar de nuevo. Lo que ya no hace es afirmar
 * que algo se está calculando cuando no hay nada corriendo — eso dejaba a la
 * pantalla prometiendo un final que no iba a llegar solo.
 */
function SinCalculo({
  onRetry,
  refreshing,
  fallo,
  motivo
}: {
  onRetry: () => void;
  refreshing: boolean;
  fallo: boolean;
  /** El límite que el propio cálculo declaró, cuando lo hay. */
  motivo: string | null;
}) {
  return (
    <View style={styles.pendiente}>
      <View accessibilityLiveRegion="polite">
        <Label style={styles.pendienteLabel}>TU CARTA TODAVÍA NO SE PUDO PUBLICAR</Label>
      </View>
      <Note style={styles.spaced}>
        Tus datos siguen guardados y no se perdió nada. El último intento de calcular tus posiciones no
        llegó a completarse, así que no hay carta nueva para mostrar; tampoco mostramos una anterior ni
        una de ejemplo. Podés calcularla de nuevo ahora.
      </Note>
      {motivo ? <Note style={styles.spaced}>{motivo}</Note> : null}
      {fallo ? <FalloDeRecuperacion /> : null}
      <View style={styles.action}>
        <PrimaryButton
          label={refreshing ? "CALCULANDO…" : fallo ? "REINTENTAR" : "CALCULAR MI CARTA"}
          accessibilityLabel={
            refreshing ? "Calculando tu carta natal" : "Calcular tu carta natal de nuevo"
          }
          onPress={onRetry}
          disabled={refreshing}
        />
      </View>
    </View>
  );
}

function CartaResumen({ chart }: { chart: NatalChartBase }) {
  const sol = positionByKey(chart, "sun");
  const luna = positionByKey(chart, "moon");
  // El Ascendente es un eje, no un planeta: sale de `angles` y sólo existe con
  // hora conocida y geometría verificada. Su estado —listo, calculándose o sin
  // hora— lo resuelve el dominio una sola vez, y de ahí salen el valor visible y
  // la voz: mientras eran dos ramas distintas, la fila decía "Necesita tu hora"
  // con la hora exacta ya guardada.
  const ascendente = angleRowView(chart, "ascendant", "Ascendente");
  const dibujables = drawablePositions(chart);

  return (
    <>
      {dibujables > 0 ? (
        <View
          style={styles.wheel}
          accessible
          accessibilityRole="image"
          accessibilityLabel={etiquetaRueda(chart)}
        >
          {/* El lado sale del contenedor medido, nunca del ancho de la ventana. */}
          <MeasuredSquare max={345}>
            {(size) => <NatalWheel payload={natalWheelPayload(chart)} size={size} />}
          </MeasuredSquare>
        </View>
      ) : (
        <View style={styles.wheel}>
          <Image
            source={ILUSTRACION}
            style={styles.ilustracion}
            resizeMode="cover"
            accessible
            accessibilityRole="image"
            accessibilityLabel="Ilustración de una carta natal. No codifica tus grados: sin tu hora de nacimiento no hay posiciones que ubicar."
          />
          <Legend>ILUSTRACIÓN · NO CODIFICA TUS GRADOS</Legend>
        </View>
      )}

      <View style={styles.triada}>
        {/* La casa se imprime SÓLO cuando existe, y en UN solo lugar: esta
            columna. Un guion en ella se leía como una casa que la carta tiene y
            no publica. Y el valor la repetía —«Cáncer 12° · Casa 4» junto a
            «CASA 4»—, por eso pasa por `valorDeTriada`. La voz sí dice la fila
            entera, casa incluida, una sola vez.

            El Ascendente es el único que no dice una casa donde CAE, porque no
            cae en ninguna: es la cúspide con la que empieza la casa 1. Por eso
            su celda dice `INICIO CASA 1` —y no `CASA 1`, que lo trataría como
            una ubicación— y sólo cuando el eje está publicado. */}
        <Fila
          glifo="⊙"
          label="Sol"
          valor={sol ? valorDeTriada(sol) : "—"}
          casa={sol?.house !== null && sol?.house !== undefined ? `CASA ${sol.house}` : null}
          voz={sol ? positionView(sol).voice : "Sol: dato retirado."}
        />
        <Fila
          glifo="☾"
          label="Luna"
          valor={luna ? valorDeTriada(luna) : "—"}
          casa={luna?.house !== null && luna?.house !== undefined ? `CASA ${luna.house}` : null}
          voz={luna ? positionView(luna).voice : "Luna: dato retirado."}
        />
        <Fila
          glifo="↑"
          label={ascendente.label}
          valor={ascendente.value}
          casa={ascendente.state === "listo" ? ASCENDENTE_INICIO_CASA : null}
          voz={
            ascendente.state === "listo"
              ? `${ascendente.voice} ${ASCENDENTE_INICIO_CASA_VOZ}`
              : ascendente.voice
          }
          apagado={ascendente.state !== "listo"}
        />
      </View>

      <Legend>{resumenCarta(chart)}</Legend>

      <LinkRow
        label="VER CARTA COMPLETA"
        accessibilityLabel="Ver la carta completa"
        accessibilityHint="Abre tus posiciones, tus contactos y tus casas"
        onPress={() => router.push("/perfil/carta/completa" as never)}
      />
    </>
  );
}

/** El separador con el que `positionView` une signo, grado, Rx y casa. */
const SEPARADOR = " · ";

/**
 * El valor central de la tríada: signo, grado y Rx — SIN la casa.
 *
 * `positionView` cierra su valor con `· Casa N` porque la Carta completa no
 * tiene columna de casa y ahí ese segmento es el único lugar donde la casa se
 * lee. En el hub sí hay columna, así que el mismo dato se imprimía dos veces en
 * la misma fila: «Cáncer 12° · Casa 4    CASA 4». Se recorta acá, en el único
 * consumidor que tiene esa columna, y `positionView` queda intacta.
 *
 * Recorta el SEGMENTO de casa, no el último: si el punto es retrógrado el `Rx`
 * queda. Y no toca los valores donde la casa nunca se imprime —signo sin grado,
 * rango de signos, dato retirado—, que no traen ese segmento.
 */
function valorDeTriada(position: NatalPosition): string {
  const { value } = positionView(position);
  if (position.house === null || position.house === undefined) return value;
  const casa = `Casa ${position.house}`;
  return value
    .split(SEPARADOR)
    .filter((parte) => parte !== casa)
    .join(SEPARADOR);
}

/**
 * Una fila de la tríada: glifo, nombre, valor y casa sólo cuando corresponde.
 *
 * `casa` es OPCIONAL y sin casa real no se dibuja la celda. Antes ese hueco se
 * rellenaba con un guion, que en una columna rotulada `CASA N` no se lee como
 * "no aplica" sino como un dato retenido: el Sol y la Luna lo mostraban en toda
 * carta sin hora, donde las casas ni siquiera se calculan.
 *
 * La celda admite dos clases de texto y no son lo mismo: `CASA N` es dónde CAE
 * un punto, y `INICIO CASA 1` es dónde EMPIEZA una casa, que es lo único que se
 * puede decir de un eje. La distinción se decide en quien llama; acá sólo se
 * dibuja lo que llega.
 */
function Fila({
  glifo,
  label,
  valor,
  casa,
  voz,
  apagado = false
}: {
  glifo: string;
  label: string;
  valor: string;
  casa?: string | null;
  voz: string;
  apagado?: boolean;
}) {
  return (
    <View style={styles.fila} accessible accessibilityRole="text" accessibilityLabel={voz}>
      <Body style={styles.filaGlifo}>{glifo}</Body>
      <Body style={styles.filaLabel}>{label}</Body>
      <Body style={[styles.filaValor, apagado ? styles.filaApagada : null]}>{valor}</Body>
      {casa ? <Label style={styles.filaCasa}>{casa}</Label> : null}
    </View>
  );
}

/**
 * `10 POSICIONES · 12 CASAS · 8 ASPECTOS MAYORES`.
 *
 * Es una línea, no un muro: lo que la cuenta o la hora no habilitan se nombra
 * en el mismo renglón, con el motivo REAL. Los motivos son tres y no se
 * confunden: sin hora, `SIN CASAS`; cerrado por plan, `CASAS EN PLUS`; con plan
 * y todavía sin publicar, `CASAS PENDIENTES`. Nunca un número inventado, y
 * nunca "EN PLUS" por algo que el plan ya incluye.
 */
function resumenCarta(chart: NatalChartBase): string {
  const partes = [`${chart.positions.length} POSICIONES`];
  const casas = natalHousesAccess(chart);
  if (casas === "disponible") partes.push(`${chart.houses.length} CASAS`);
  else if (casas === "sin-hora") partes.push("SIN CASAS");
  else if (casas === "plus") partes.push("CASAS EN PLUS");
  else partes.push("CASAS PENDIENTES");
  const aspectos = natalAspectsAccess(chart);
  if (aspectos === "disponible") partes.push(`${chart.aspects.length} ASPECTOS MAYORES`);
  else if (aspectos === "plus") partes.push("ASPECTOS EN PLUS");
  else partes.push("ASPECTOS PENDIENTES");
  return partes.join(" · ");
}

/** El bloque de precisión del estado sin hora, tal cual el frame lo resuelve. */
function PrecisionDeTuHora({ chart }: { chart: NatalChartBase }) {
  const nota = birthTimePrecisionNote(chart);
  return (
    <View style={styles.precision}>
      <Label style={styles.precisionLabel}>PRECISIÓN DE TU HORA</Label>
      <Note style={styles.spaced}>
        {nota ??
          "Sin tu hora, ocultamos las casas y el Ascendente. Las posiciones que se mantienen estables durante todo el día siguen visibles; las sensibles a la hora muestran un margen o se ocultan."}
      </Note>
    </View>
  );
}

function etiquetaRueda(chart: NatalChartBase): string {
  const dichas = [`Tu rueda natal, con ${drawablePositions(chart)} puntos ubicados.`];
  const sol = positionByKey(chart, "sun");
  const luna = positionByKey(chart, "moon");
  if (sol) dichas.push(positionView(sol).voice);
  if (luna) dichas.push(positionView(luna).voice);
  // El mismo hecho que la fila de la tríada: la rueda no puede describir un
  // Ascendente ausente por un motivo distinto del que muestra la lista.
  dichas.push(angleRowView(chart, "ascendant", "Ascendente").voice);
  return dichas.join(" ");
}

/**
 * Cuerpo de una capa natal: o el dato, o la explicación de por qué no está.
 * Mientras el sobre viaja es carga; si el sobre no existe —sin cuenta con datos,
 * o el día todavía no se pudo armar— se dice eso y no se rellena con nada.
 */
function LayerBody({
  envelope,
  loading,
  children
}: {
  envelope: AnalysisEnvelope | null;
  loading: boolean;
  children: ReactNode;
}) {
  if (loading) return <LoadingBlock message="Calculando tus capas natales…" />;
  if (!envelope) {
    return <Note style={styles.spaced}>Todavía no hay un cálculo verificable para esta parte.</Note>;
  }
  if (hasData(envelope)) return <>{children}</>;
  return (
    <View style={styles.spaced}>
      {missingReasons(envelope).map((razon) => (
        <Note key={razon} style={styles.faltaLinea}>
          {razon}
        </Note>
      ))}
    </View>
  );
}

/**
 * El tipo lunar en el hub, con el mismo criterio que su detalle: la fase se
 * sostiene con la hora abierta, el ángulo y la iluminación no. Sin hora exacta
 * el disco dibuja la forma de la fase y los dos números no se imprimen: en su
 * lugar el margen va INLINE (`SOL–LUNA 108° · ±6° SIN HORA`), como el frame.
 */
function TipoLunarBloque({ data, exacto }: { data: LunarTypeData; exacto: boolean }) {
  return (
    <View>
      <View style={styles.moonRow}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <MoonDial
            illumination={exacto ? data.illumination : phaseShapeIllumination(data.phaseKey)}
            phaseKey={data.phaseKey}
            phaseName={data.name}
            size={72}
            approximate={!exacto}
          />
        </View>
        <View style={styles.moonText}>
          <Title>{data.name}</Title>
          <MetaRow
            items={[
              exacto
                ? `SOL–LUNA AL NACER ${formatDecimal(data.elongationDegrees)}°`
                : `SOL–LUNA ${formatDecimal(data.elongationDegrees)}°`,
              exacto ? null : "±6° SIN HORA"
            ]}
          />
        </View>
      </View>
      <Body style={styles.summary}>{data.summary}</Body>
    </View>
  );
}

/**
 * Mapa elemental del hub: una barra ancha por elemento con su recuento a la
 * derecha, y el total debajo. Los planetas de cada elemento se listan en el
 * detalle, que es donde el frame los pone.
 */
function MapaElementalBloque({ data, sinHora }: { data: ElementMapData; sinHora: boolean }) {
  return (
    <View>
      {ELEMENT_ORDER.map((element) => (
        <View key={element} style={styles.elemento}>
          <Body style={styles.elementoLabel}>{ELEMENT_LABEL[element]}</Body>
          <View style={styles.elementoBar}>
            <MeterBar
              value={data.total > 0 ? data.counts[element] / data.total : 0}
              accessibilityLabel={`${ELEMENT_LABEL[element]}: ${data.counts[element]} de ${data.total} posiciones.`}
            />
          </View>
          <Mono style={styles.elementoCount}>{String(data.counts[element])}</Mono>
        </View>
      ))}
      <Legend>{`TOTAL ${data.total} DE ${data.total} POSICIONES`}</Legend>
      <Lectura label="RECURSO" texto={sinHora ? "El mapa elemental sale de los signos de tus planetas: no depende de la hora." : data.resource} />
      <Lectura label="CUANDO SE SATURA" texto={data.overuse} />
      <Lectura label="PARA EQUILIBRAR" texto={data.cultivate} />
    </View>
  );
}

function Lectura({ label, texto }: { label: string; texto: string }) {
  return (
    <View style={styles.lectura}>
      <Label style={styles.lecturaLabel}>{label}</Label>
      <Body style={styles.lecturaTexto}>{texto}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  // El glifo del engranaje, en forma de TEXTO (U+2699 U+FE0E), no emoji: hereda
  // el color del sistema tipográfico en vez de traer su propio render de color.
  // lineHeight EXPLÍCITO: el glifo hereda la línea del Mono (más chica que el
  // cuerpo del engranaje) y sin esto el dibujo se recorta contra su propio techo.
  gearGlyph: { color: v492.colors.text, fontSize: 32, lineHeight: 40 },
  action: { marginTop: v492.space.lg },
  cta: { alignItems: "flex-start", marginTop: v492.space.md },
  elemento: { alignItems: "center", flexDirection: "row", gap: v492.space.md, marginTop: v492.space.md },
  elementoBar: { flex: 1 },
  elementoCount: { color: v492.colors.text, textAlign: "right", width: 24 },
  elementoLabel: { color: v492.colors.text, width: 64 },
  faltaLinea: { marginTop: v492.space.xs },
  fila: { alignItems: "baseline", flexDirection: "row", gap: v492.space.md, paddingVertical: v492.space.sm },
  filaApagada: { color: v492.colors.textDim },
  filaCasa: { color: v492.colors.textDim, textAlign: "right", width: 62 },
  filaGlifo: { color: v492.colors.copper, width: 16 },
  filaLabel: { color: v492.colors.text, width: 96 },
  filaValor: { color: v492.colors.textMuted, flex: 1 },
  ilustracion: { borderRadius: v492.radius.sm, height: 220, width: "100%" },
  intro: { marginTop: v492.space.xs },
  lectura: { marginTop: v492.space.lg },
  lecturaLabel: { color: v492.colors.copper },
  lecturaTexto: { marginTop: v492.space.xs },
  moonRow: { alignItems: "center", flexDirection: "row", gap: v492.space.lg, marginTop: v492.space.lg },
  moonText: { flex: 1 },
  pendiente: { marginTop: v492.space.md },
  pendienteLabel: { color: v492.colors.copperSoft },
  precision: {
    borderColor: v492.colors.line,
    borderRadius: v492.radius.md,
    borderWidth: 1,
    marginTop: v492.space.xxl,
    padding: v492.space.lg
  },
  precisionLabel: { color: v492.colors.textMuted },
  spaced: { marginTop: v492.space.md },
  summary: { marginTop: v492.space.lg },
  triada: { marginTop: v492.space.lg },
  // La caja de la rueda necesita ancho PROPIO: `MeasuredSquare` mide su
  // contenedor y sin medida real no dibuja nada (misma nota que en `CartaCard`).
  wheel: { alignSelf: "stretch", marginTop: v492.space.lg, width: "100%" }
});
