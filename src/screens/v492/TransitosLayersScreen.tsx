import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { MoonDial, TemporalMandalaDial } from "@/components/v492/Dials";
import { MANDALA_SIZE } from "@/components/v492/mandalaGeometry";
import { Legend, LinkRow, MetaRow, SectionHeader } from "@/components/v492/Layout";
import { MeterBar } from "@/components/v492/Meter";
import { LayerScreen, Section } from "@/components/v492/Screen";
import { Segmented } from "@/components/v492/Segmented";
import { FreshnessNotice } from "@/components/v492/Status";
import { EmptyBlock, ErrorBlock, GuestBlock, LoadingBlock, PrimaryButton } from "@/components/v492/States";
import { TraceAccordion } from "@/components/v492/Trace";
import { TransitRow } from "@/components/v492/TransitCard";
import { Body, Label, Mono, Note, Subtitle, Title } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { layerDetailHref } from "@/domain/detailOrigin";
import { envelopesFreshness } from "@/domain/layerFreshness";
import {
  anyDataReady,
  formatPercent,
  formatShortDayMonth,
  formatShortMonthYear,
  formatWeekdayDate,
  hasData,
  houseTheme,
  illuminatedFractionAt,
  latestObservedAt,
  layerCountLabel,
  LUNAR_CYCLE,
  missingReasons,
  orbsByArc,
  windowProgress
} from "@/domain/layers";
import { ACTION_HEADING, seasonMeaning, yearMeaning } from "@/domain/layerMeaning";
import { MANDALA_TRACE, SEASON_TRACE, YEAR_TRACE } from "@/domain/layerReading";
import { useLayers } from "@/hooks/useLayers";
import type {
  AnalysisEnvelope,
  AnalysisPrecision,
  AnnualProfectionData,
  LayerBundle,
  ProgressedLunationData,
  TemporalMandalaData,
  TransitRankingData
} from "@/services/layersApi";

/**
 * Tránsitos (Figma V4.9.2 `965:934` + `943:356`).
 *
 * Dos vistas de la misma pantalla, elegidas por dos PÍLDORAS: `Ahora` es la
 * lista completa de tránsitos activos —la de Hoy son sus tres primeros— y `Tu
 * momento` reúne los ciclos lentos, que se miden en años y no en días.
 *
 * Cuál se está viendo lo dice la RUTA, no un estado local: `/transitos` y
 * `/transitos/momento`. Como estado local, "estoy mirando mis ciclos largos" se
 * perdía en cada deep link y en cada restauración de navegación de iOS, y no se
 * podía enlazar. El selector navega con `replace`, así que las dos vistas no se
 * apilan.
 *
 * `Tu momento` son TRES análisis distintos —estación vital, tema del año y
 * mandala temporal—, cada uno con su propio sobre, su propio estado y su propia
 * trazabilidad. Reunirlos bajo una sola respuesta de "por qué te muestro esto"
 * haría creer que salen del mismo cálculo: uno puede faltar por hora de
 * nacimiento mientras los otros dos están completos.
 */

export type VistaTransitos = "ahora" | "momento";

const VISTAS = [
  { key: "ahora" as const, label: "AHORA" },
  { key: "momento" as const, label: "TU MOMENTO" }
];

const RUTA_VISTA: Record<VistaTransitos, string> = {
  ahora: "/transitos",
  momento: "/transitos/momento"
};

export function TransitosLayersScreen({ mode = "ahora" }: { mode?: VistaTransitos }) {
  const layers = useLayers();
  const { phase, bundle, yesterday, nowMs, localDate, timezone, refresh, refreshing, refreshFailed } =
    layers;
  const irAVista = (vista: VistaTransitos) => {
    if (vista === mode) return;
    router.replace(RUTA_VISTA[vista] as never);
  };
  const pills = (
    <Segmented
      options={VISTAS}
      value={mode}
      onChange={irAVista}
      accessibilityLabel="Elegí qué ver: los tránsitos de ahora o tus ciclos largos"
    />
  );

  if (phase === "cargando") {
    return (
      <Shell nowMs={nowMs} timezone={timezone} mode={mode} pills={pills}>
        <LoadingBlock />
      </Shell>
    );
  }
  if (phase === "error") {
    return (
      <Shell nowMs={nowMs} timezone={timezone} mode={mode} pills={pills}>
        <ErrorBlock onRetry={layers.retrySession} />
      </Shell>
    );
  }
  if (phase === "invitado") {
    return (
      <Shell nowMs={nowMs} timezone={timezone} mode={mode} pills={pills}>
        <GuestBlock />
      </Shell>
    );
  }
  if (phase === "vacio" || !bundle) {
    return (
      <Shell nowMs={nowMs} timezone={timezone} mode={mode} pills={pills}>
        <EmptyBlock />
      </Shell>
    );
  }
  // Primera carga real: nada persistido todavía y el recálculo en vuelo.
  if (refreshing && !anyDataReady([...Object.values(bundle.today), ...Object.values(bundle.moment)])) {
    return (
      <Shell nowMs={nowMs} timezone={timezone} mode={mode} pills={pills}>
        <LoadingBlock />
      </Shell>
    );
  }

  // Qué tan de ahora es lo que se ve, y con cuánto ruido decirlo. El sobre puede
  // llegar `stale` sin que el recálculo de esta sesión haya fallado —el backend
  // ya lo había marcado—, así que se miran las dos cosas; y de cuándo es el
  // último cálculo decide si alcanza una línea o hace falta el aviso.
  const sobres =
    mode === "ahora" ? [bundle.today.transitRanking] : Object.values(bundle.moment);
  const frescura = envelopesFreshness({ envelopes: sobres, refreshFailed, localDate, timezone });
  // Sin hora de nacimiento el año personal no se puede calcular: el contador lo
  // dice con la forma `2/3 CAPAS` en vez de esconderlo en un chip.
  const capas = mode === "momento" ? layerCountLabel(Object.values(bundle.moment)) : undefined;

  return (
    <Shell
      nowMs={nowMs}
      timezone={timezone}
      mode={mode}
      pills={pills}
      capas={capas}
      intro={
        mode === "ahora"
          ? "Acá están todos los tránsitos activos de hoy, ordenados por cercanía al punto exacto y por la parte de tu carta que activan."
          : introMomento(bundle)
      }
      onRefresh={refresh}
      refreshing={refreshing}
    >
      <Section>
        <FreshnessNotice
          freshness={frescura}
          observedAt={latestObservedAt(sobres)}
          timezone={timezone}
          onRetry={refresh}
          retrying={refreshing}
        />
      </Section>
      {mode === "ahora" ? (
        <AhoraView bundle={bundle} yesterday={yesterday} nowMs={nowMs} timezone={timezone} />
      ) : (
        <MomentoView bundle={bundle} nowMs={nowMs} timezone={timezone} />
      )}
    </Shell>
  );
}

/**
 * La bajada de `Tu momento` dice, cuando corresponde, POR QUÉ falta una capa.
 *
 * Sin hora de nacimiento la profección no tiene de dónde salir —el recorrido
 * empieza en el Ascendente y el Ascendente depende de la hora—, y eso es lo
 * primero que hay que leer, no un chip al costado.
 */
function introMomento(bundle: LayerBundle): string {
  if (bundle.moment.annualProfection.status === "needs_birth_time") {
    return "Sin tu hora de nacimiento el año personal no se puede calcular: la profección se apoya en las casas.";
  }
  return "Acá se reúnen los ciclos que cambian lentamente: tu etapa vital, el tema del año y cómo se superponen con los movimientos más breves.";
}

function Shell({
  children,
  nowMs,
  timezone,
  mode,
  pills,
  capas,
  intro,
  onRefresh,
  refreshing
}: {
  children: ReactNode;
  nowMs: number;
  timezone: string;
  mode: VistaTransitos;
  pills: ReactNode;
  capas?: string;
  intro?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <LayerScreen
      eyebrow={mode === "ahora" ? "TRÁNSITOS · AHORA" : "TU MOMENTO · EL CAPÍTULO ACTUAL"}
      title={mode === "ahora" ? "Tránsitos" : "Tu momento"}
      meta={nowMs > 0 && timezone ? formatWeekdayDate(nowMs, timezone).toLocaleUpperCase("es") : undefined}
      capas={capas ?? (mode === "ahora" ? "CAMBIA A DIARIO" : undefined)}
      pills={pills}
      intro={intro}
      refreshHint={
        mode === "ahora"
          ? "El orden se actualiza al abrir la app y cuando volvés a ella; este gesto lo actualiza ahora mismo."
          : "Tu momento se actualiza al abrir la app y cuando volvés a ella; este gesto lo actualiza ahora mismo."
      }
      onRefresh={onRefresh}
      refreshing={refreshing}
    >
      {children}
    </LayerScreen>
  );
}

function AhoraView({
  bundle,
  yesterday,
  nowMs,
  timezone
}: {
  bundle: LayerBundle;
  yesterday: LayerBundle | null;
  nowMs: number;
  timezone: string;
}) {
  const ranking = bundle.today.transitRanking;
  const data = ranking.data;
  const orbesDeAyer = orbsByArc(yesterday?.today.transitRanking.data?.items);
  return (
    <Section>
      {hasData(ranking) && data ? (
        <ListaCompleta data={data} orbesDeAyer={orbesDeAyer} nowMs={nowMs} timezone={timezone} />
      ) : (
        <Falta envelope={ranking} />
      )}
      <OrdenExplicado />
      <TraceAccordion
        envelope={ranking}
        timezone={timezone}
        calculatedDatum="Los contactos entre los planetas de hoy y los puntos de tu carta que están a menos de 3° del ángulo exacto, con el orbe real de cada uno."
        interpretiveRule="El orden combina cuatro cosas: qué tan cerca está del ángulo exacto, qué punto de tu carta toca, cuánto tarda ese planeta en pasar y si la casa activada es angular. Es el criterio para decidir qué mostrar primero, no una medida de importancia."
      />
    </Section>
  );
}

/** Por qué falta un bloque, en una línea gris y sin caja. */
function Falta({ envelope }: { envelope: AnalysisEnvelope }) {
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

function ListaCompleta({
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
  if (data.items.length === 0) {
    return <Body style={styles.intro}>{data.summary}</Body>;
  }
  return (
    <View>
      <Legend>LAS BARRAS MIDEN CERCANÍA AL PUNTO EXACTO</Legend>
      <View style={styles.lista}>
        {data.items.map((item, index) => (
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
    </View>
  );
}

/**
 * Cómo se arma el orden.
 *
 * Describe el MÉTODO, no el día: por eso es texto fijo y no un dato del sobre.
 * Los valores concretos de cada tránsito (a cuánto está del punto exacto, qué
 * casa activa) se leen en su detalle, con el número real.
 */
function OrdenExplicado() {
  return (
    <View style={styles.orden}>
      <SectionHeader title="POR QUÉ ESTE ORDEN" cadence="CAMBIA A DIARIO" />
      {CRITERIOS.map((criterio) => (
        <View key={criterio.label} style={styles.criterio}>
          <Label style={styles.criterioLabel}>{criterio.label}</Label>
          <Note style={styles.criterioBody}>{criterio.body}</Note>
        </View>
      ))}
      <Note style={styles.ordenCierre}>
        El orden no es un puntaje de importancia: combina cercanía al punto exacto y relevancia del punto
        natal involucrado.
      </Note>
    </View>
  );
}

const CRITERIOS = [
  {
    label: "EXACTITUD",
    body: "Cuánto le falta al tránsito para ser exacto."
  },
  {
    label: "QUÉ TOCA",
    body: "Los contactos con el Sol, la Luna, el Ascendente y el Medio Cielo reciben más peso en el orden."
  },
  {
    label: "CASA",
    body: "Las casas 1, 4, 7 y 10 reciben más peso porque representan áreas centrales de la carta."
  },
  {
    label: "CASAS QUE RIGE",
    body: "Cada planeta se asocia con una o más casas natales. Si una de esas áreas también está activa, suma peso en el orden."
  }
];

/**
 * Tu momento: TRES módulos hermanos, tres cálculos separados, numerados como el
 * frame (`01 TU ESTACIÓN VITAL`…).
 *
 * Cada bloque trae su sobre, su acceso y su trazabilidad propia, en el orden en
 * que se leen: primero la etapa de varios años, después el año en curso y al
 * final el dibujo que los pone a todos en la misma imagen.
 *
 * ## El método va DESPUÉS
 *
 * Los dos primeros bloques se leen: estado actual → qué significa → qué hacer →
 * fechas y datos → acceso al detalle → método → acordeón técnico. El párrafo que
 * explica el cálculo —"la profección recorre una casa por año…"— estaba arriba,
 * antes de la visual, y era lo primero que se leía en las capas seguidas:
 * explicaciones de método antes de un solo dato propio. Sigue estando, entero,
 * pero relegado a su lugar: cuando ya se sabe qué se está mirando.
 *
 * El mandala no lleva ese bloque. Debajo del dibujo van sus cuatro líneas —una
 * por ritmo—, su acceso y la trazabilidad: qué es cada anillo lo dice ahora su
 * detalle integral, y un `Metodo` en el medio era la tercera explicación del
 * mismo dibujo.
 *
 * ## Un acceso por módulo, y ninguno más (QA23-002)
 *
 * Cada uno de los tres módulos tiene UN acceso a su propio detalle:
 * `VER TU ESTACIÓN`, `VER TU AÑO` y `VER TUS CUATRO RITMOS`.
 *
 * Antes el mandala repartía CUATRO enlaces —uno por anillo— hacia la estación,
 * el año, el ciclo lunar y el tránsito. Dos de esos destinos son los módulos que
 * la misma pantalla ya muestra arriba y los otros dos viven en otra sección, así
 * que el dibujo funcionaba como un índice de cosas que ya estaban a la vista y
 * lo único que no tenía lectura era el mandala mismo. Ahora el módulo abre su
 * detalle integral y ahí adentro no hay enlaces a esos cuatro ritmos.
 *
 * Los tres detalles se abren DENTRO de esta sección: `Tu momento` vive en el
 * stack de Tránsitos, así que un detalle apilado en el stack de Hoy cambiaba de
 * pestaña y "volver" caía en Hoy (QA22-027). Acá el `pop` devuelve a esta
 * pantalla, que nunca se desmontó y conserva su punto de lectura.
 *
 * El acceso aparece sólo cuando ese módulo se puede calcular hoy: una lectura
 * que va a abrir "no pudimos calcular esto" no es una salida.
 */
function MomentoView({
  bundle,
  nowMs,
  timezone
}: {
  bundle: LayerBundle;
  nowMs: number;
  timezone: string;
}) {
  const { progressedLunation, annualProfection, temporalMandala } = bundle.moment;
  const sinHora = annualProfection.status === "needs_birth_time";
  return (
    <Section>
      {sinHora ? (
        <View style={styles.cta}>
          <PrimaryButton
            label="AGREGAR O CORREGIR HORA"
            accessibilityLabel="Agregar o corregir tu hora de nacimiento"
            onPress={() => router.push("/editar-datos" as never)}
          />
        </View>
      ) : null}

      <SectionHeader index="01" title="TU ESTACIÓN VITAL" cadence="ETAPA VITAL · ~3,7 AÑOS" />
      {progressedLunation.data ? (
        <>
          <EstacionVital
            data={progressedLunation.data}
            precision={progressedLunation.precision}
            timezone={timezone}
          />
          <AccesoDetalle acceso={DETALLES.estacion} />
        </>
      ) : (
        <Falta envelope={progressedLunation} />
      )}
      <Metodo nombre="Lunación progresada">
        Tu estación vital se basa en la relación progresada entre el Sol y la Luna. Recorre ocho fases en un
        ciclo de unos 30 años; cada fase dura alrededor de 3,7 años.
      </Metodo>
      {/* El mismo texto que monta el detalle de esta capa: qué se calculó y con
          qué regla se lee es una propiedad del ANÁLISIS, no de la pantalla.
          Escrito en los dos lados, corregir uno y no el otro dejaría al producto
          explicando el mismo cálculo de dos maneras. */}
      <TraceAccordion
        envelope={progressedLunation}
        timezone={timezone}
        calculatedDatum={SEASON_TRACE.calculatedDatum}
        interpretiveRule={SEASON_TRACE.interpretiveRule}
      />

      <SectionHeader index="02" title="TEMA DE TU AÑO" cadence="DE CUMPLEAÑOS A CUMPLEAÑOS" />
      {annualProfection.data ? (
        <>
          <TemaDelAno data={annualProfection.data} nowMs={nowMs} timezone={timezone} />
          <AccesoDetalle acceso={DETALLES.ano} />
        </>
      ) : (
        <View>
          <Title style={styles.sinDato}>Necesita tu hora</Title>
          <Label style={styles.metodo}>LA PROFECCIÓN SE APOYA EN LAS CASAS</Label>
          <Body style={styles.intro}>
            Con tu hora de nacimiento podemos decirte qué casa se activa este año y quién la rige.
          </Body>
          {/* Y la razón que declaró el sobre, no sólo la que suponemos: la
              profección puede faltar por la hora, pero también porque el cálculo
              no llegó. Escribir siempre "necesita tu hora" mandaría a corregir un
              dato que ya está bien. */}
          <Falta envelope={annualProfection} />
        </View>
      )}
      <Metodo nombre="Profección anual">
        La profección anual recorre una casa de tu carta por cada año de vida. Esa casa señala el área que
        este método pone en primer plano.
      </Metodo>
      <TraceAccordion
        envelope={annualProfection}
        timezone={timezone}
        calculatedDatum={YEAR_TRACE.calculatedDatum}
        interpretiveRule={YEAR_TRACE.interpretiveRule}
      />

      <SectionHeader index="03" title="TUS CUATRO RITMOS" cadence="MULTICAPA · DE DIARIO A MULTIANUAL" />
      {temporalMandala.data ? (
        <>
          <Mandala data={temporalMandala.data} precision={temporalMandala.precision} />
          <AccesoDetalle acceso={DETALLES.mandala} />
        </>
      ) : (
        <Falta envelope={temporalMandala} />
      )}
      {/* El mandala NO lleva `Metodo`: debajo del dibujo se leen las cuatro
          líneas —una por ritmo—, su único acceso y nada más hasta la
          trazabilidad. Qué es cada anillo y a qué ritmo avanza lo dice ahora su
          detalle integral, y repetirlo en el medio era la tercera explicación
          del mismo dibujo. */}
      <TraceAccordion
        envelope={temporalMandala}
        timezone={timezone}
        calculatedDatum={MANDALA_TRACE.calculatedDatum}
        interpretiveRule={MANDALA_TRACE.interpretiveRule}
      />
    </Section>
  );
}

/** Un acceso: qué dice el enlace y a qué detalle de la sección lleva. */
type AccesoDetalleDestino = { label: string; accessibilityLabel: string; href: string };

/**
 * El acceso de cada módulo de `Tu momento`, uno por módulo.
 *
 * Los tres destinos salen del helper de rutas y cuelgan del stack de Tránsitos,
 * así que "volver" es un `pop` que devuelve a esta pantalla con su punto de
 * lectura. El rótulo dice adónde va —no "ver más"— y la etiqueta accesible lo
 * dice entero, porque `VER TU AÑO` en mayúsculas no le informa nada a VoiceOver.
 */
const DETALLES: Record<"estacion" | "ano" | "mandala", AccesoDetalleDestino> = {
  estacion: {
    label: "VER TU ESTACIÓN",
    accessibilityLabel: "Ver el detalle de tu estación vital",
    href: layerDetailHref("estacion")
  },
  ano: {
    label: "VER TU AÑO",
    accessibilityLabel: "Ver el detalle del tema de tu año",
    href: layerDetailHref("ano")
  },
  mandala: {
    label: "VER TUS CUATRO RITMOS",
    accessibilityLabel: "Ver el detalle integral de tus cuatro ritmos",
    href: layerDetailHref("mandala")
  }
};

function AccesoDetalle({ acceso }: { acceso: AccesoDetalleDestino }) {
  return (
    <LinkRow
      label={acceso.label}
      accessibilityLabel={acceso.accessibilityLabel}
      onPress={() => router.push(acceso.href as never)}
    />
  );
}

/**
 * El método de una capa, relegado: qué es este cálculo, dicho DESPUÉS del dato.
 *
 * Es el mismo texto que antes abría cada bloque. Lo que cambia es el lugar y el
 * peso: el nombre del método sigue en su línea y la explicación pasa a gris de
 * nota, porque describe cómo se llega al dato y no el dato en sí.
 */
function Metodo({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <View style={styles.metodoBloque}>
      <Label style={styles.metodo}>{nombre}</Label>
      <Note style={styles.metodoTexto}>{children}</Note>
    </View>
  );
}

/**
 * Estación vital: la fase progresada, con sus fechas y su avance dichos como el
 * cálculo los conoce, en la composición abierta del frame (disco a la izquierda,
 * nombre en serif, barra ancha y las dos fechas a los costados).
 *
 * Con hora exacta de nacimiento el cambio de fase cae en un día y se escribe ese
 * día. Sin ella el sobre no elige una hora: manda el INTERVALO en el que ese
 * cambio puede caer y acá se muestra la precisión INLINE (`PRECISIÓN ±2 MESES
 * SIN HORA`), como el frame, en vez de dos chips y dos descargos.
 *
 * El avance sale del sobre, no de una cuenta hecha acá: `progress` existe SÓLO
 * cuando la fase tiene un punto exacto y `progressRange` es la franja entera en
 * la que ese avance puede caer.
 */
function EstacionVital({
  data,
  precision,
  timezone
}: {
  data: ProgressedLunationData;
  /** Precisión del sobre: decide si las fechas y el avance se dicen sueltos o como rango. */
  precision: AnalysisPrecision;
  timezone: string;
}) {
  const exacto = precision === "exact";
  // Mes y AÑO, como el frame: una fase dura ~3,7 años y sus bordes caen en años
  // distintos. `EMPEZÓ 17 DIC` / `PRÓXIMA FASE 8 NOV` se leían como fechas de
  // este año. El rango sin hora colapsa cuando los dos bordes caen en el mismo
  // mes: repetir `DIC 2024–DIC 2024` no informa nada.
  const rangoMesAno = (r: { earliest: number; latest: number }) => {
    const desde = formatShortMonthYear(r.earliest, timezone);
    const hasta = formatShortMonthYear(r.latest, timezone);
    return desde === hasta ? desde : `${desde}–${hasta}`;
  };
  const inicio =
    data.phaseStartedAtRange && !exacto
      ? rangoMesAno(data.phaseStartedAtRange)
      : formatShortMonthYear(data.phaseStartedAt, timezone);
  const cierre =
    data.nextPhaseAtRange && !exacto
      ? rangoMesAno(data.nextPhaseAtRange)
      : formatShortMonthYear(data.nextPhaseAt, timezone);
  const avance =
    exacto && typeof data.progress === "number" && Number.isFinite(data.progress)
      ? Math.max(0, Math.min(1, data.progress))
      : null;
  const franja = exacto ? null : (data.progressRange ?? null);
  const faseEnMinuscula = data.name.toLocaleLowerCase("es");
  const anos = `AÑO ${anoDeFase(data)} DE 3,7`;
  // Las ocho fases traducidas a un tema y a un movimiento prudente. Sale de la
  // MISMA `phaseKey` que dibuja el disco, así que el texto y la imagen no pueden
  // contar fases distintas.
  const lectura = seasonMeaning(data.phaseKey);

  return (
    <View>
      <View style={styles.hero}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Disco de la fase ${faseEnMinuscula}, dibujado con el ángulo progresado entre el Sol y la Luna.`}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <MoonDial
              illumination={illuminatedFractionAt(data.progressedElongationDegrees)}
              phaseKey={data.phaseKey}
              phaseName={data.name}
              size={72}
              approximate={!exacto}
            />
          </View>
        </View>
        <View style={styles.heroTexto}>
          <Title>{data.name}</Title>
          <MetaRow items={[anos, exacto ? null : "PRECISIÓN ±2 MESES SIN HORA"]} />
        </View>
      </View>

      {/* Qué significa esta fase y qué hacer con ella, antes de la barra y de
          las fechas: `Gibosa` es el nombre que le pone el cálculo, no una
          respuesta. El verbo y el tema traducen ese nombre en un renglón; el
          párrafo lo desarrolla. */}
      <Subtitle style={styles.tema}>
        {`Etapa de ${lectura.verb}: ${lectura.theme}.`}
      </Subtitle>
      <Body style={styles.significado}>{lectura.meaning}</Body>
      <Label style={styles.accionLabel}>{ACTION_HEADING}</Label>
      <Body style={styles.accion}>{lectura.action}</Body>

      {avance !== null ? (
        <View style={styles.meter}>
          <MeterBar
            value={avance}
            valueText={`${formatPercent(avance)} de esta fase`}
            accessibilityLabel={`Fase ${faseEnMinuscula}: llevás recorrido el ${formatPercent(
              avance
            )} de esta etapa. Empezó ${inicio}. Sigue hasta ${cierre}.`}
          />
        </View>
      ) : franja ? (
        <View style={styles.meter}>
          <MeterBar
            value={(franja.from + franja.to) / 2}
            tone="soft"
            accessibilityLabel={`Fase ${faseEnMinuscula}: el avance está entre ${formatPercent(
              franja.from
            )} y ${formatPercent(franja.to)} de la etapa.`}
          />
          <Legend>{`AVANCE ENTRE ${formatPercent(franja.from)} Y ${formatPercent(franja.to)} · SIN HORA NO HAY UN PUNTO`}</Legend>
        </View>
      ) : null}

      <View style={styles.fechas}>
        <Mono style={styles.fechaIzq}>{`EMPEZÓ ${inicio}`}</Mono>
        <Mono style={styles.fechaDer}>{`PRÓXIMA FASE ${cierre}`}</Mono>
      </View>
      {/* Sin hora, las fechas de arriba pueden venir como `MAY 2024–JUN 2024`.
          Esta línea nombra lo que ese guion significa: sin nombrarlo, un rango
          se lee como un período. Cuando los dos bordes caen en el mismo mes el
          rango no se dibuja, así que la línea dice lo que sí pasa: el borde
          está estimado. */}
      {!exacto ? (
        <Legend>
          {inicio.includes("–") || cierre.includes("–")
            ? "LAS DOS FECHAS SON UN RANGO · SIN HORA NO HAY UN MES ÚNICO"
            : "FECHAS ESTIMADAS · SIN HORA EL BORDE DE LA FASE NO ES EXACTO"}
        </Legend>
      ) : null}
    </View>
  );
}

/** En qué año de la fase estamos, con un decimal, a partir de sus fechas. */
function anoDeFase(data: ProgressedLunationData): string {
  const total = data.nextPhaseAt - data.phaseStartedAt;
  if (!Number.isFinite(total) || total <= 0) return "—";
  const recorrido = typeof data.progress === "number" && data.progress >= 0 ? data.progress : 0;
  const anos = (total / (365.25 * 86_400_000)) * recorrido;
  return anos.toFixed(1).replace(".", ",");
}

/**
 * Tema del año: la casa que toca, dicha por su número Y por lo que trata.
 *
 * "Casa 7" no le dice nada a quien no estudió astrología, así que el número
 * siempre va acompañado del área de la vida a la que esa casa se asocia, con la
 * misma tabla que usa el resto del producto.
 */
function TemaDelAno({
  data,
  nowMs,
  timezone
}: {
  data: AnnualProfectionData;
  nowMs: number;
  timezone: string;
}) {
  const tema = houseTheme(data.house);
  const progreso = windowProgress(data.periodStart, data.periodEnd, nowMs);
  const desde = formatShortDayMonth(data.periodStart, timezone);
  const hasta = formatShortDayMonth(data.periodEnd, timezone);
  // La casa traducida a un área de todos los días, con su acción. Una casa fuera
  // de 1–12 no existe en el método: ahí el bloque muestra sólo sus datos en vez
  // de inventar un área.
  const lectura = yearMeaning(data.house);

  return (
    <View>
      <Title style={styles.casaTitulo}>{tema ? `Casa ${data.house} · ${tema}` : `Casa ${data.house}`}</Title>
      <MetaRow items={[`MES ${data.monthIndex} DE 12`, `REGENTE DEL AÑO: ${data.ruler.toLocaleUpperCase("es")}`]} />

      {/* Qué significa ese título en lo cotidiano y qué hacer con él, antes de
          la barra y de las dos fechas del año. */}
      {lectura ? (
        <>
          <Body style={styles.significado}>{lectura.meaning}</Body>
          <Label style={styles.accionLabel}>{ACTION_HEADING}</Label>
          <Body style={styles.accion}>{lectura.action}</Body>
        </>
      ) : null}

      <View style={styles.meter}>
        <MeterBar
          value={progreso}
          valueText={`mes ${data.monthIndex} de 12`}
          accessibilityLabel={`Vas por el mes ${data.monthIndex} de 12 del año que corre entre ${desde} y ${hasta}.`}
        />
      </View>
      <View style={styles.fechas}>
        <Mono style={styles.fechaIzq}>{desde}</Mono>
        <Mono style={styles.fechaDer}>{hasta}</Mono>
      </View>
      {/* De dónde sale el regente que dice la línea de arriba. Es el único tramo
          del resumen del cálculo que no está ya escrito en otro lado: la casa y
          su área están en el título y el significado está arriba, en palabras
          de todos los días. */}
      <Note style={styles.regente}>
        {`Tu casa ${data.house} empieza en ${data.sign}, así que el regente de este año es ${data.ruler}.`}
      </Note>
    </View>
  );
}

/**
 * Mandala temporal: el dibujo y, debajo, UNA línea por ritmo.
 *
 * La lista no es un pie de figura: es la versión leíble del dibujo y por eso
 * nombra los cuatro anillos SIEMPRE, tengan cálculo o no. Un ritmo que hoy no se
 * puede calcular se marca como tal; si se lo salteara, el anillo apagado del
 * dibujo quedaría sin explicación.
 *
 * ## Una línea, un dato
 *
 * Cada ritmo es `RÓTULO · estado`, y el estado ES el dato de ese ciclo: la fase
 * de la estación vital, la casa y el mes del año personal, el día del ciclo
 * lunar y el contacto del tránsito activo. Nada más.
 *
 * `ring.detail` NO se muestra cuando el ritmo está disponible: ahí el contrato
 * manda el resumen entero del análisis —el mismo párrafo que ya se lee completo
 * en su propio bloque de esta pantalla— y repetirlo cuatro veces debajo del
 * dibujo convertía una leyenda de cuatro renglones en cuatro párrafos. Se usa
 * una sola vez y sólo cuando un ritmo NO se puede calcular, porque ahí el
 * `detail` es la única explicación que hay de un anillo apagado.
 *
 * El avance tampoco se repite en texto: lo dibuja el anillo y lo dice la
 * etiqueta accesible del dibujo, que es donde el modo (`point`, `range`,
 * `unavailable`) significa algo.
 *
 * ## Acá no sale ningún enlace (QA23-002)
 *
 * Cada renglón era, además, la puerta de salida de su ritmo: cuatro enlaces
 * debajo del dibujo hacia la estación, el año, el ciclo lunar y el tránsito.
 * Dos de esos destinos son los módulos que esta misma pantalla ya muestra
 * arriba y los otros dos viven en otra sección, así que el mandala funcionaba
 * como un índice de cosas que ya estaban a la vista mientras lo único sin
 * lectura propia era el dibujo mismo. La salida ahora es UNA y la pone el
 * módulo —`VER TUS CUATRO RITMOS`, debajo de estas líneas—, así que acá adentro
 * la lista vuelve a ser lo que dice ser: la versión leíble del dibujo.
 */
function Mandala({
  data,
  precision
}: {
  data: TemporalMandalaData;
  precision: AnalysisPrecision;
}) {
  return (
    <View>
      <View style={styles.mandala}>
        <TemporalMandalaDial rings={data.rings} precision={precision} size={MANDALA_SIZE} />
      </View>

      {data.rings.map((ring) => (
        <View
          key={ring.key}
          style={styles.ring}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${ring.label}: ${ring.available ? ring.state : ring.detail}`}
        >
          <Label style={styles.ringLabel}>{`${ring.label.toLocaleUpperCase("es")} ·`}</Label>
          {ring.available ? (
            <Body style={styles.ringState}>{ring.state}</Body>
          ) : (
            <Note style={styles.ringState}>{ring.detail}</Note>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  accion: { marginTop: v492.space.xs },
  accionLabel: { color: v492.colors.copper, marginTop: v492.space.lg },
  casaTitulo: { marginTop: v492.space.lg },
  criterio: { marginTop: v492.space.md },
  criterioBody: { marginTop: 2 },
  criterioLabel: { color: v492.colors.copper },
  cta: { alignItems: "flex-start", marginTop: v492.space.lg },
  falta: { marginTop: v492.space.sm },
  faltaLinea: { marginTop: v492.space.xs },
  fechaDer: { color: v492.colors.textDim, flex: 1, textAlign: "right" },
  fechaIzq: { color: v492.colors.textDim, flex: 1 },
  fechas: { flexDirection: "row", gap: v492.space.md, marginTop: v492.space.sm },
  hero: { alignItems: "center", flexDirection: "row", gap: v492.space.lg, marginTop: v492.space.lg },
  heroTexto: { flex: 1 },
  intro: { marginTop: v492.space.xs },
  lista: { marginTop: v492.space.lg },
  mandala: { alignItems: "center", paddingVertical: v492.space.lg },
  meter: { marginTop: v492.space.lg },
  metodo: { color: v492.colors.textMuted, textTransform: "none" },
  metodoBloque: { marginTop: v492.space.xl },
  metodoTexto: { marginTop: v492.space.xs },
  orden: { marginTop: v492.space.sm },
  ordenCierre: { marginTop: v492.space.lg },
  regente: { marginTop: v492.space.lg },
  /**
   * Una línea por ritmo: el rótulo y su estado en el mismo renglón, con
   * `flexWrap` para que un estado largo baje entero en vez de recortarse.
   */
  ring: {
    alignItems: "baseline",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: v492.space.sm,
    marginTop: v492.space.md
  },
  ringLabel: { color: v492.colors.copper, flexShrink: 0 },
  ringState: { flexShrink: 1 },
  significado: { marginTop: v492.space.md },
  sinDato: { marginTop: v492.space.lg },
  tema: { marginTop: v492.space.lg }
});
