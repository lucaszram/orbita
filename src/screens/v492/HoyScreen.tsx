import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { CycleRing, MoonDial } from "@/components/v492/Dials";
import { Legend, LinkRow, MetaRow, SectionHeader } from "@/components/v492/Layout";
import { MeterBar } from "@/components/v492/Meter";
import { LayerScreen, Section } from "@/components/v492/Screen";
import { FreshnessNotice } from "@/components/v492/Status";
import { EmptyBlock, ErrorBlock, GuestBlock, LoadingBlock } from "@/components/v492/States";
import { TransitRow } from "@/components/v492/TransitCard";
import { Body, Label, Note, Subtitle, Title } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { envelopesFreshness } from "@/domain/layerFreshness";
import {
  anyDataReady,
  countReady,
  cumplelunaToday,
  cumplelunaView,
  formatDayMonthRange,
  formatLocalTime,
  formatPercent,
  formatWeekdayDate,
  hasData,
  houseTheme,
  latestObservedAt,
  missingReasons,
  orbsByArc,
  topTransits,
  type CumplelunaToday
} from "@/domain/layers";
import { useLayers } from "@/hooks/useLayers";
import type {
  AnalysisEnvelope,
  AnalysisPrecision,
  CumplelunaData,
  LayerBundle,
  MoonOnChartData,
  TransitRankingData,
  TransitRankingItem
} from "@/services/layersApi";

/**
 * Hoy · lo activo ahora (Figma V4.9.2 `938:289` / `961:712`).
 *
 * La pantalla del canon: encabezado con el contador de capas, `LO PRINCIPAL
 * HOY` con el titular del día, y después TRES bloques numerados —ranking, Luna
 * sobre la carta y Cumpleluna— separados por línea fina, sin tarjetas. Cuando el
 * Cumpleluna cae hoy sube al primer lugar: es el único evento personal que
 * reordena la pantalla, y se explica por qué. Si no cae hoy, lo principal es el
 * primero del ranking.
 *
 * ## Por qué ya no hay un bloque de arco
 *
 * `ARCO DEL TRÁNSITO` mostraba, en Hoy, la ventana del MISMO tránsito que el
 * ranking ya ponía primero: la fila de arriba decía el contacto y el bloque de
 * abajo repetía su titular con tres fechas. Dos bloques para un solo tránsito,
 * y el segundo con la palabra "arco", que es jerga. Ahora la ventana vive donde
 * se la puede leer con su significado: en el detalle, que se abre tocando la
 * fila —por `arcId`— o desde `/transitos`. `VER TODOS LOS TRÁNSITOS` y la
 * pestaña llegan a la misma lista (`/transitos`, vista `Ahora`), y `/hoy/arco`
 * sigue viva para los links que ya existen.
 *
 * Todo sale del sobre real de `layers.getForDate`. Si una capa no tiene datos,
 * el bloque se retira y explica la limitación: no hay valores de maqueta.
 */

export function HoyScreen() {
  const layers = useLayers();
  const { phase, bundle, yesterday, nowMs, timezone, refresh, refreshing, refreshFailed } = layers;

  if (phase === "cargando") {
    return (
      <Shell timezone={timezone} nowMs={nowMs}>
        <LoadingBlock />
      </Shell>
    );
  }
  if (phase === "error") {
    return (
      <Shell timezone={timezone} nowMs={nowMs}>
        <ErrorBlock onRetry={layers.retrySession} />
      </Shell>
    );
  }
  if (phase === "invitado") {
    return (
      <Shell timezone={timezone} nowMs={nowMs}>
        <GuestBlock />
      </Shell>
    );
  }
  if (phase === "vacio" || !bundle) {
    return (
      <Shell timezone={timezone} nowMs={nowMs}>
        <EmptyBlock />
      </Shell>
    );
  }
  // Primera carga real: no hay nada persistido todavía y el recálculo está en
  // vuelo. Mostrar los módulos vacíos por un segundo diría "sin datos" de algo
  // que sí va a estar.
  if (refreshing && !anyDataReady([...Object.values(bundle.today), ...Object.values(bundle.moment)])) {
    return (
      <Shell timezone={timezone} nowMs={nowMs}>
        <LoadingBlock />
      </Shell>
    );
  }

  return (
    <HoyContent
      bundle={bundle}
      yesterday={yesterday}
      nowMs={nowMs}
      localDate={layers.localDate}
      timezone={timezone}
      refreshing={refreshing}
      refreshFailed={refreshFailed}
      onRefresh={refresh}
    />
  );
}

function Shell({
  children,
  timezone,
  nowMs,
  capas,
  intro,
  onRefresh,
  refreshing
}: {
  children: ReactNode;
  timezone: string;
  nowMs: number;
  capas?: string;
  intro?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <LayerScreen
      eyebrow="HOY · LO ACTIVO AHORA"
      title="Hoy"
      meta={nowMs > 0 && timezone ? formatWeekdayDate(nowMs, timezone).toLocaleUpperCase("es") : undefined}
      capas={capas}
      intro={intro}
      refreshHint="Hoy se actualiza sola al abrir la app y cuando volvés a ella; este gesto la actualiza ahora mismo."
      onRefresh={onRefresh}
      refreshing={refreshing}
    >
      {children}
    </LayerScreen>
  );
}

function HoyContent({
  bundle,
  yesterday,
  nowMs,
  localDate,
  timezone,
  refreshing,
  refreshFailed,
  onRefresh
}: {
  bundle: LayerBundle;
  yesterday: LayerBundle | null;
  nowMs: number;
  /** Día civil con el que se pidió el sobre: es el "hoy" con el que se compara. */
  localDate: string;
  timezone: string;
  refreshing: boolean;
  refreshFailed: boolean;
  onRefresh: () => void;
}) {
  const { transitRanking, moonOnChart, cumpleluna } = bundle.today;
  const rankingData = transitRanking.data;
  const moonData = moonOnChart.data;
  const cumplelunaData = cumpleluna.data;
  const orbesDeAyer = orbsByArc(yesterday?.today.transitRanking.data?.items);
  // El evento de hoy, ya resuelto con la precisión del sobre: instante exacto
  // —que puede haber caído a la madrugada, porque el día del Cumpleluna es el
  // día entero— sólo cuando la raíz del cálculo lo es; si no, la certeza que la
  // ventana publicada sostiene. `null` es "hoy no es su día": no se destaca.
  const cumplelunaHoyAt = cumplelunaData
    ? cumplelunaToday(cumplelunaData, cumpleluna.precision, nowMs, timezone)
    : null;

  // Qué tan de ahora es lo que se ve, y con cuánto ruido decirlo. El sobre puede
  // llegar `stale` sin que el recálculo de esta sesión haya fallado —el backend
  // ya lo había marcado—, así que se miran las dos cosas; y de cuándo es el
  // último cálculo decide si alcanza una línea o hace falta el aviso.
  const sobres = Object.values(bundle.today);
  const frescura = envelopesFreshness({
    envelopes: sobres,
    refreshFailed,
    localDate,
    timezone
  });
  const capas = `${countReady(sobres)} CAPAS`;

  // El orden del canon. Con Cumpleluna hoy el evento sube al primer lugar y la
  // numeración lo acompaña: el frame numera lo que se ve, en el orden en que se
  // ve, no un catálogo fijo de capas.
  const bloques: BloqueHoy[] = [];
  if (cumplelunaHoyAt !== null) {
    bloques.push({
      key: "cumpleluna",
      title: "CUMPLELUNA",
      cadence: "CICLO LUNAR · ~29,5 DÍAS",
      envelope: cumpleluna,
      body: cumplelunaData ? (
        <CumplelunaBloque
          data={cumplelunaData}
          precision={cumpleluna.precision}
          hoy={cumplelunaHoyAt}
          nowMs={nowMs}
          timezone={timezone}
        />
      ) : null,
      intro: "Repetición de tu fase natal"
    });
  }
  bloques.push({
    key: "ranking",
    title: "RANKING DE TRÁNSITOS",
    cadence: "CAMBIA A DIARIO",
    envelope: transitRanking,
    // El orden real de la lista, dicho en una línea: no es sólo cercanía al
    // punto exacto. Primero lo que se hace exacto hoy, después lo que cruza su
    // punto exacto cerca —antes o después— y recién ahí el resto de lo activo.
    intro:
      "Primero los tránsitos que se hacen exactos hoy, después los que pasan por su punto exacto en los próximos tres días o acaban de pasarlo, y al final el resto de los activos.",
    body: rankingData ? (
      <RankingBloque data={rankingData} orbesDeAyer={orbesDeAyer} nowMs={nowMs} timezone={timezone} />
    ) : null
  });
  bloques.push({
    key: "luna",
    title: "LA LUNA EN TU CARTA",
    cadence: "CADA 2–3 DÍAS",
    envelope: moonOnChart,
    intro:
      "Muestra por qué parte de tu carta está pasando la Luna y qué tema cotidiano activa durante estos días.",
    body: moonData ? (
      <LunaBloque data={moonData} yesterday={yesterday?.today.moonOnChart.data ?? null} />
    ) : null
  });
  if (cumplelunaHoyAt === null) {
    bloques.push({
      key: "cumpleluna",
      title: "CUMPLELUNA",
      cadence: "CICLO LUNAR · ~29,5 DÍAS",
      envelope: cumpleluna,
      intro: "Repetición de tu fase natal",
      body: cumplelunaData ? (
        <CumplelunaBloque
          data={cumplelunaData}
          precision={cumpleluna.precision}
          hoy={null}
          nowMs={nowMs}
          timezone={timezone}
        />
      ) : null
    });
  }

  return (
    <Shell
      timezone={timezone}
      nowMs={nowMs}
      capas={capas}
      intro={
        cumplelunaHoyAt !== null
          ? cumplelunaHoyTexto(cumplelunaHoyAt, cumpleluna.precision, timezone)
          : "Lo que se está moviendo sobre tu carta. Cada capa cambia a su propio ritmo."
      }
      onRefresh={onRefresh}
      refreshing={refreshing}
    >
      <Section>
        <FreshnessNotice
          freshness={frescura}
          observedAt={latestObservedAt(sobres)}
          timezone={timezone}
          onRetry={onRefresh}
          retrying={refreshing}
        />
      </Section>

      <Section>
        <Principal
          ranking={rankingData}
          cumpleluna={cumplelunaHoyAt !== null ? cumplelunaData : null}
          bundle={bundle}
        />

        {bloques.map((bloque, index) => (
          <View key={bloque.key} style={styles.bloque}>
            <SectionHeader
              index={String(index + 1).padStart(2, "0")}
              title={bloque.title}
              cadence={bloque.cadence}
            />
            {bloque.intro ? <Body style={styles.intro}>{bloque.intro}</Body> : null}
            {hasData(bloque.envelope) ? (
              bloque.body
            ) : (
              <FaltaBloque envelope={bloque.envelope} />
            )}
          </View>
        ))}
      </Section>
    </Shell>
  );
}

type BloqueHoy = {
  key: string;
  title: string;
  cadence: string;
  envelope: AnalysisEnvelope;
  intro?: string;
  body: ReactNode;
};

/**
 * Por qué falta un bloque, sin caja ni chips repetidos.
 *
 * El canon resuelve la ausencia en una línea gris. El estado y la precisión ya
 * no se anuncian con dos píldoras encima de cada bloque: cuando hay dato, la
 * limitación viaja pegada al dato que condiciona; cuando no lo hay, se dice acá.
 */
function FaltaBloque({ envelope }: { envelope: AnalysisEnvelope }) {
  return (
    <View style={styles.falta}>
      {missingReasons(envelope).map((razon) => (
        <Note key={razon} style={styles.faltaLinea}>
          {razon}
        </Note>
      ))}
    </View>
  );
}

/**
 * `LO PRINCIPAL HOY`: el titular del día en serif grande, el contexto del año y
 * la puerta a Tu momento.
 *
 * El titular no se inventa: es el tránsito que el propio ranking puso primero,
 * dicho con su frase calculada. Si hoy hay Cumpleluna, el titular es el evento.
 * El contexto sale de la profección anual sólo cuando existe; sin hora de
 * nacimiento esa línea no aparece en vez de mostrar una casa falsa.
 */
function Principal({
  ranking,
  cumpleluna,
  bundle
}: {
  ranking: TransitRankingData | null;
  cumpleluna: CumplelunaData | null;
  bundle: LayerBundle;
}) {
  const profeccion = bundle.moment.annualProfection.data;
  const tema = profeccion ? houseTheme(profeccion.house) : null;
  const primero = ranking ? topTransits(ranking.items, 1)[0] ?? null : null;
  const titular = cumpleluna
    ? "Hoy se repite el ángulo entre el Sol y la Luna de tu nacimiento. Se completa tu ciclo personal y empieza el siguiente."
    : primero
      ? primero.summary
      : null;
  if (!titular) return null;

  return (
    <View style={styles.principal}>
      <SectionHeader title="LO PRINCIPAL HOY" rule={false} bullet={false} />
      <Title style={styles.principalTitular}>{titular}</Title>
      {tema && profeccion ? (
        <Label style={styles.principalContexto}>
          {`CONTEXTO · TU AÑO DE ${tema.toLocaleUpperCase("es")}`}
        </Label>
      ) : null}
      <LinkRow
        label="VER TU MOMENTO"
        accessibilityLabel="Ver tu momento: los ciclos largos que enmarcan el día"
        onPress={() => router.push("/transitos/momento" as never)}
      />
    </View>
  );
}

/**
 * Por qué el Cumpleluna subió al primer lugar, con la certeza que hay.
 *
 * Con raíz exacta se dice en pasado cuando el instante ya ocurrió hoy: el módulo
 * de abajo muestra el próximo, que en ese caso cae dentro de un mes, y afirmar
 * "ocurre hoy" a la noche haría que las dos cosas se contradigan. Sin raíz
 * exacta no hay ni instante ni tiempo verbal que sostener: el evento ocurre hoy
 * si la ventana entera cae hoy, y sólo PUEDE caer hoy si la ventana la cruza.
 */
function cumplelunaHoyTexto(
  hoy: CumplelunaToday,
  precision: AnalysisPrecision,
  timezone: string
): string {
  const cierre = "Debajo vas a encontrar los otros movimientos destacados del día.";
  if (hoy.certainty === "exact") {
    // La hora sale del instante y el instante sólo existe con raíz exacta: se
    // pide la precisión del sobre acá también, para que la condición se lea en
    // el mismo renglón que la imprime.
    const hora = precision === "exact" ? formatLocalTime(hoy.at, timezone) : null;
    const cuando = hoy.past ? "fue hoy" : "es hoy";
    return `Tu cumpleluna ${hora ? `${cuando} a las ${hora}` : cuando}, por eso aparece primero. ${cierre}`;
  }
  if (hoy.certainty === "today") {
    return `Tu cumpleluna ocurre hoy, por eso aparece primero. El cálculo no puede fijar la hora, pero la ventana posible entra entera en el día de hoy. ${cierre}`;
  }
  return `Tu cumpleluna puede caer hoy, por eso aparece primero: el cálculo lo acota a una ventana —${formatDayMonthRange(
    hoy.range,
    timezone
  )}— que incluye el día de hoy. ${cierre}`;
}

function RankingBloque({
  data,
  orbesDeAyer,
  nowMs,
  timezone
}: {
  data: TransitRankingData;
  orbesDeAyer: Map<string, number>;
  nowMs: number;
  timezone: string;
}) {
  const destacados = topTransits(data.items);

  if (destacados.length === 0) {
    return <Body style={styles.intro}>{data.summary}</Body>;
  }

  return (
    <View>
      <Legend>LAS BARRAS MIDEN CERCANÍA AL PUNTO EXACTO</Legend>
      <View style={styles.lista}>
        {destacados.map((item: TransitRankingItem, index: number) => (
          <TransitRow
            key={item.arcId + item.natalPoint + item.aspect}
            item={item}
            rank={index + 1}
            first={index === 0}
            nowMs={nowMs}
            timezone={timezone}
            yesterdayOrb={orbesDeAyer.get(item.arcId) ?? null}
            onPress={() => router.push(`/transitos/arco/${encodeURIComponent(item.arcId)}` as never)}
          />
        ))}
      </View>
      {/* La lista completa vive en la pestaña Tránsitos, vista `Ahora`: es la
          misma que abre la pestaña, así que llegar por acá o por la barra deja
          a la persona en el mismo lugar. El detalle de UN tránsito se abre
          tocando su fila, por `arcId`. */}
      <LinkRow
        label="VER TODOS LOS TRÁNSITOS"
        accessibilityLabel={`Ver la lista completa: ${data.activeCount} tránsitos activos`}
        accessibilityHint="Abre Tránsitos en la vista Ahora"
        onPress={() => router.push("/transitos" as never)}
      />
    </View>
  );
}

/**
 * La Luna sobre la carta: disco, titular y una sola línea de metadatos con el
 * cambio de casa desde ayer cuando hay con qué compararlo.
 *
 * El resumen del cálculo se dice UNA vez, en el `Body` de abajo: es texto
 * visible y su propio elemento para VoiceOver, así que la etiqueta compuesta del
 * hero no lo vuelve a decir. Cuando lo hacía, el lector anunciaba el mismo
 * párrafo dos veces seguidas y con las mismas palabras.
 */
function LunaBloque({ data, yesterday }: { data: MoonOnChartData; yesterday: MoonOnChartData | null }) {
  const casaAyer =
    yesterday && yesterday.natalHouse !== null && yesterday.natalHouse !== data.natalHouse
      ? `${yesterday.natalHouse < (data.natalHouse ?? 0) ? "↑" : "↓"} AYER CASA ${yesterday.natalHouse}`
      : null;
  // El hero anuncia lo que DIBUJA: signo, fase, iluminación y casa. El resumen
  // es del `Body`.
  const voz = [
    `Luna en ${data.sign}.`,
    `${data.phaseName}, ${formatPercent(data.illumination)} iluminada.`,
    data.natalHouse !== null ? `Casa ${data.natalHouse} de tu carta.` : null
  ]
    .filter((linea): linea is string => Boolean(linea))
    .join(" ");

  return (
    <View>
      <View
        style={styles.heroRow}
        accessible
        accessibilityLabel={voz}
        accessibilityRole="text"
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <MoonDial illumination={data.illumination} phaseKey={data.phaseKey} phaseName={data.phaseName} size={72} />
        </View>
        <View style={styles.heroText}>
          <Subtitle>{`${data.phaseName} en ${data.sign}`}</Subtitle>
          <MetaRow
            items={[
              formatPercent(data.illumination),
              data.natalHouse !== null ? `TU CASA ${data.natalHouse}` : null,
              casaAyer
            ]}
          />
        </View>
      </View>
      <Body style={styles.summary}>{data.summary}</Body>
      <LinkRow
        label="VER DETALLE"
        accessibilityLabel="Ver el detalle de la Luna sobre tu carta"
        onPress={() => router.push("/hoy/luna" as never)}
      />
    </View>
  );
}

/**
 * Tu ciclo personal, y el evento de HOY cuando lo hay.
 *
 * En el canon el número manda: `en 11 días` (o `Es hoy`) en serif grande, con la
 * comparación contra ayer al lado, la barra del ciclo y la fila `DÍA x · DÍA
 * 29,5 · CUMPLELUNA`.
 *
 * Los números del ciclo salen de `cumplelunaView`, que con una raíz estimada
 * dice la ventana entera en vez de su centro.
 *
 * ## Cada pieza anuncia lo suyo
 *
 * El bloque tiene tres cosas que decir —el resumen del cálculo, el evento y el
 * día del ciclo— y tres piezas para decirlas, así que va una en cada una: el
 * `Body` de arriba dice el resumen, la etiqueta del head dice el evento y la
 * barra dice el día. Las tres decían las tres, y VoiceOver leía el mismo
 * resumen y el mismo reloj del ciclo dos y tres veces seguidas.
 */
function CumplelunaBloque({
  data,
  precision,
  hoy,
  nowMs,
  timezone
}: {
  data: CumplelunaData;
  precision: AnalysisPrecision;
  /** El Cumpleluna de hoy con su certeza, o `null` si hoy no es su día. */
  hoy: CumplelunaToday | null;
  nowMs: number;
  timezone: string;
}) {
  const view = cumplelunaView(data, precision, nowMs, timezone);
  const horaDeHoy =
    precision === "exact" && hoy?.certainty === "exact" ? formatLocalTime(hoy.at, timezone) : null;
  const titular = hoy ? cumplelunaCuando(hoy) : view.nextWhen;
  // El head dice EL EVENTO, que es lo que su titular imprime: ni el resumen —lo
  // dice el `Body` de arriba— ni el reloj del ciclo —lo dice la barra—.
  const voz = hoy
    ? `Tu cumpleluna ${cumplelunaCuando(hoy)}${horaDeHoy ? ` a las ${horaDeHoy}` : ""}.`
    : `Próximo cumpleluna ${view.nextWhen}.`;

  return (
    <View>
      <Body style={styles.intro}>{data.summary}</Body>
      <View style={styles.cicloHead} accessible accessibilityRole="text" accessibilityLabel={voz}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <CycleRing progress={data.progress} label="" size={56} />
        </View>
        {/* Sin comparación contra ayer: el Cumpleluna es la única capa de Hoy
            que el contrato NO indexa por día civil, así que pedir el día
            anterior devuelve exactamente el mismo cálculo. Un "ayer" armado con
            ese número sería siempre igual —o peor, una flecha inventada—. */}
        <View style={styles.heroText}>
          <Subtitle style={styles.cicloTitular}>{capitalize(titular)}</Subtitle>
        </View>
      </View>
      <View style={styles.cicloMeter}>
        <MeterBar
          value={data.progress}
          valueText={view.cycleClock}
          accessibilityLabel={`Tu ciclo personal: ${view.cycleClock.toLocaleLowerCase("es")}.`}
        />
      </View>
      {/* El pie visible de la barra. No se vuelve a leer: repite en mayúscula el
          reloj del ciclo que la barra acaba de anunciar, la hora que ya dijo el
          head y el nombre de la capa, que es el título del bloque. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <MetaRow
          items={[
            view.cycleClock.toLocaleUpperCase("es"),
            horaDeHoy ? `EXACTA ${horaDeHoy}` : null,
            "CUMPLELUNA"
          ]}
        />
      </View>
      <LinkRow
        label="VER DETALLE"
        accessibilityLabel="Ver el detalle de tu cumpleluna"
        onPress={() => router.push("/hoy/cumpleluna" as never)}
      />
    </View>
  );
}

/**
 * Cómo se nombra el evento de hoy: "fue hoy" · "es hoy" · "ocurre hoy" · "puede
 * caer hoy".
 *
 * Los dos tiempos verbales necesitan un instante y por eso son sólo del caso
 * exacto. Una ventana no fue ni será: cae —entera o parcialmente— en el día, y
 * eso es todo lo que se puede decir sin fingir una precisión que no hay.
 */
function cumplelunaCuando(hoy: CumplelunaToday): string {
  if (hoy.certainty === "exact") return hoy.past ? "fue hoy" : "es hoy";
  return hoy.certainty === "today" ? "ocurre hoy" : "puede caer hoy";
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase("es") + value.slice(1);
}

const styles = StyleSheet.create({
  bloque: { marginTop: v492.space.sm },
  cicloHead: { alignItems: "center", flexDirection: "row", gap: v492.space.lg, marginTop: v492.space.lg },
  cicloMeter: { marginTop: v492.space.lg },
  cicloTitular: { color: v492.colors.text },
  falta: { marginTop: v492.space.sm },
  faltaLinea: { marginTop: v492.space.xs },
  heroRow: { alignItems: "center", flexDirection: "row", gap: v492.space.lg, marginTop: v492.space.lg },
  heroText: { flex: 1 },
  intro: { marginTop: v492.space.xs },
  lista: { marginTop: v492.space.lg },
  principal: { paddingTop: v492.space.lg },
  principalContexto: { color: v492.colors.textDim, marginTop: v492.space.lg },
  principalTitular: { marginTop: v492.space.md },
  summary: { marginTop: v492.space.lg }
});
