import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { useConfirm } from "@/components/orbita/ConfirmHost";
import { Legend, SectionHeader } from "@/components/v492/Layout";
import { MeterBar } from "@/components/v492/Meter";
import { Touchable } from "@/components/v492/Touchable";
import { DetailLayerScreen, Section } from "@/components/v492/Screen";
import { StaleNotice, StatusLine } from "@/components/v492/Status";
import {
  EmptyBlock,
  ErrorBlock,
  GuestBlock,
  LoadingBlock,
  PrimaryButton
} from "@/components/v492/States";
import { TraceAccordion } from "@/components/v492/Trace";
import { Body, Label, Mono, Note } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { createExclusiveGate, runExclusive } from "@/domain/exclusive";
import { formatDateTime, latestObservedAt, uniqueLines } from "@/domain/layers";
import {
  findRelationshipProfile,
  RELATIONSHIP_DATE_UNLOCKS,
  RELATIONSHIP_DIMENSION_LABEL,
  RELATIONSHIP_DIMENSION_ORDER,
  RELATIONSHIP_GENERAL_ONLY_DISCLAIMER,
  RELATIONSHIP_LEVEL_COUNT,
  RELATIONSHIP_LEVEL_HEADLINE,
  RELATIONSHIP_LEVEL_RANK,
  RELATIONSHIP_READABLE_COUNT,
  RELATIONSHIP_TIME_UNLOCK_DIMENSIONS,
  RELATIONSHIP_TIME_UNLOCKS,
  RELATIONSHIP_UNLOCK_LABEL,
  relationshipBirthLine,
  relationshipDimensionsLock,
  relationshipComparisonSummary,
  relationshipDimensionTone,
  relationshipSummaryLine,
  relationshipDisclaimer,
  relationshipDriverShare,
  relationshipGaps,
  relationshipGapsBlameOther,
  relationshipGapsBlameOwn,
  relationshipGeneralOnlyShare,
  relationshipHeadline,
  relationshipLevelBadge,
  relationshipLevelSentence,
  relationshipLockedDimensionsNote,
  relationshipLevelShare,
  relationshipModeHasCalculation,
  relationshipModeIsGeneral,
  relationshipResultMode,
  relationshipSignLabel,
  relationshipToneVoice,
  type RelationshipDimensionTone,
  type RelationshipGap
} from "@/domain/relationships";
import { useLayers } from "@/hooks/useLayers";
import {
  relationshipsApi,
  type ComparisonLevel,
  type RelationshipComparisonData,
  type RelationshipComparisonResult,
  type RelationshipDimension,
  type RelationshipProfile
} from "@/services/relationshipsApi";

/**
 * Vínculos · el resultado de una persona (`/vinculos/[profileId]`).
 *
 * Composición canónica V4.9.2 — frames `09 · carta contra carta` y
 * `10 · signo contra signo`. Los dos frames son la MISMA pantalla con distinto
 * material, y por eso son un solo componente: `NIVEL DE DATOS` con su barra y
 * su frase, `POR DIMENSIÓN` con la leyenda de la barra y las filas, la lista de
 * lo que falta con su botón, y `LO QUE ESTO NO DICE` al cierre. Sin tarjetas:
 * la columna del canon separa bloques con una línea fina, no con cajas.
 *
 * Tres reglas sostienen toda la pantalla:
 *
 * 1. **El id de la URL no es un id.** Llega como string y sólo vale si aparece
 *    en `relationships.list`, la lista autorizada de la cuenta. De ahí sale el
 *    `profileId` ya tipado con el que se pide la comparación: un enlace ajeno o
 *    viejo no abre nada y se dice por qué. Nunca se convierte por conversión de
 *    tipos.
 * 2. **El resultado es el del backend.** `relationships.getComparison` es
 *    reactiva y `relationships.refreshComparison` es la única que recalcula. La
 *    pantalla no deriva, no promedia ni completa.
 * 3. **Contar contactos no es medir compatibilidad.** No hay puntaje global ni
 *    porcentaje: las barras comparan CUÁNTOS contactos reunió cada dimensión
 *    frente a la que más reunió, que es exactamente lo que dice la leyenda del
 *    frame, y eso es todo lo que dicen.
 *
 * **De dónde sale el texto de cada dimensión.** Del contacto real, no del
 * resumen. `dimension.summary` es una plantilla del backend por tono —"En cómo
 * se hablan aparecen más recursos de fluidez…"— y las cinco dimensiones la
 * repetían cambiando el nombre: la certificación lo registró como texto
 * genérico. `dimension.drivers` viene ordenado por peso y cada entrada YA es la
 * oración del contacto ("Mercurio de … y Mercurio de … forman un contacto de
 * 120° llamado trígono; a 0°06′ del punto exacto. …"). Se muestra ese texto tal
 * cual, sin reescribirlo: cualquier arreglo de strings sobre una oración
 * astrológica corre el riesgo de afirmar algo que el cálculo no dijo. El
 * `summary` queda para el único caso donde ES el dato: cuando no hay ningún
 * contacto que mostrar.
 *
 * Nada de esto es de hoy: una comparación no cambia con el día, cambia cuando
 * cambian los datos guardados o la versión del método. Por eso el pie no habla
 * del cielo de este momento sino de la última comparación verificada.
 */
export function VinculosResultScreen({ profileId }: { profileId: string }) {
  // Misma fase que el resto de Vínculos: sin sesión no hay lista autorizada y
  // sin carta propia no hay contra qué comparar a nadie.
  const { phase, timezone, retrySession } = useLayers();

  if (phase === "cargando") {
    return (
      <Shell>
        <LoadingBlock message="Buscando esta persona…" />
      </Shell>
    );
  }
  if (phase === "error") {
    return (
      <Shell>
        <ErrorBlock onRetry={retrySession} />
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
  if (phase === "vacio") {
    return (
      <Shell>
        <EmptyBlock />
      </Shell>
    );
  }
  return <VinculosResultLive profileId={profileId} timezone={timezone} />;
}

/**
 * El encabezado del canon es `VOS Y …`: nombra el vínculo, no la sección.
 *
 * Va en una sola línea —partirlo en dos fue una de las diferencias registradas—
 * y un nombre largo se recorta con puntos suspensivos, no envuelve: el nombre
 * completo está entero en la línea de datos y en la confirmación de borrado.
 */
function Shell({ children, eyebrow = "VÍNCULOS · COMPARACIÓN" }: { children: ReactNode; eyebrow?: string }) {
  return (
    <DetailLayerScreen eyebrow={eyebrow} fallbackHref="/vinculos" eyebrowLines={1}>
      {children}
    </DetailLayerScreen>
  );
}

/**
 * El id del deep link vale lo que valga en TU lista. Acá se resuelve —con la
 * misma función que valida el `?profileId=` del formulario— y recién con la
 * persona encontrada, y su `profileId` ya tipado, se pide la comparación.
 */
function VinculosResultLive({ profileId, timezone }: { profileId: string; timezone: string }) {
  const personas = useQuery(relationshipsApi.list, {});
  // Al borrar, la lista reactiva deja de traer a esta persona un instante antes
  // de que la navegación ocurra. Sin esta marca, ese instante mostraría "este
  // enlace no corresponde a ninguna persona", que es exactamente lo contrario de
  // lo que acaba de pasar.
  const [borrada, setBorrada] = useState(false);
  const persona = findRelationshipProfile(personas, profileId);

  if (borrada) {
    return (
      <Shell>
        <LoadingBlock message="Volviendo a tus personas…" />
      </Shell>
    );
  }
  if (persona === undefined) {
    return (
      <Shell>
        <LoadingBlock message="Buscando esta persona…" />
      </Shell>
    );
  }
  if (persona === null) {
    return (
      <Shell>
        <Section>
          <Body style={styles.blockTop}>
            Este enlace no corresponde a ninguna persona guardada en tu cuenta. Puede haberse
            borrado, o pertenecer a otra cuenta.
          </Body>
        </Section>
      </Shell>
    );
  }

  return (
    <ComparisonScreen persona={persona} timezone={timezone} onRemoved={() => setBorrada(true)} />
  );
}

/**
 * Los estados del sobre en los que volver a pedir el cálculo puede cambiar algo.
 *
 * `needs_birth_time` queda deliberadamente afuera: ahí no falta una corrida,
 * falta un dato, y reintentar contra el proveedor devolvería exactamente lo
 * mismo. Para eso está el botón que lleva a completar los datos.
 */
const ESTADOS_A_RECALCULAR: readonly RelationshipComparisonResult["status"][] = [
  "partial",
  "stale",
  "unavailable",
  "error"
];

/**
 * ¿Hay que volver a pedirle el cálculo al backend?
 *
 * Es puro a propósito: la condición que dispara el recálculo automático, la que
 * muestra el botón de reintento y la que lo esconde cuando el cálculo está listo
 * tienen que ser el MISMO hecho. Cuando el sobre está `ready` y con datos no hay
 * nada que recalcular, y ofrecerlo igual haría creer que lo visible es viejo.
 */
function necesitaRecalculo(comparison: RelationshipComparisonResult): boolean {
  if (!comparison.data) return true;
  return ESTADOS_A_RECALCULAR.includes(comparison.status);
}

function ComparisonScreen({
  persona,
  timezone,
  onRemoved
}: {
  persona: RelationshipProfile;
  timezone: string;
  onRemoved: () => void;
}) {
  // El nivel pedido NO se manda: el backend lo deriva del perfil guardado y es
  // exactamente `availableLevel`.
  const comparison = useQuery(relationshipsApi.getComparison, { profileId: persona.profileId });
  const refreshComparison = useAction(relationshipsApi.refreshComparison);
  const removePerson = useMutation(relationshipsApi.removePerson);
  const confirm = useConfirm();

  const [recalculando, setRecalculando] = useState(false);
  const [recalculoFallido, setRecalculoFallido] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null);
  // El candado REAL del borrado. `borrando` recién se enciende DESPUÉS de la
  // confirmación, así que dos toques del mismo render abrían dos alertas —y dos
  // "Borrar" seguidos, dos mutations—. Ver `@/domain/exclusive`.
  const borradoEnCurso = useRef(createExclusiveGate()).current;

  // Una sola corrida a la vez, y una sola por cada estado del sobre.
  //
  // `enVuelo` guarda la promesa en curso: el automático y el botón entran por la
  // misma puerta, así que tocar REINTENTAR mientras el efecto ya está pidiendo
  // no dispara una segunda acción. Y como el fin del "cargando" cuelga de esa
  // promesa —y no de la vida del efecto—, la query puede volver a emitir en el
  // medio sin dejar el botón girando para siempre.
  const enVuelo = useRef<Promise<void> | null>(null);
  // Qué estado ya pidió recálculo solo: persona, nivel que permiten sus datos y
  // la huella de las entradas del cálculo. Mientras esos tres no cambien, un
  // resultado que sigue corto —el proveedor caído— no reabre el ciclo.
  const pedidoAutomatico = useRef<string | null>(null);

  const recalcular = useCallback(() => {
    const enCurso = enVuelo.current;
    if (enCurso) return enCurso;
    setRecalculando(true);
    // `recalculoFallido` no se limpia al empezar: mientras el reintento está en
    // vuelo, lo que se ve sigue siendo el cálculo anterior.
    const corrida = refreshComparison({ profileId: persona.profileId })
      .then(() => setRecalculoFallido(false))
      .catch(() => setRecalculoFallido(true))
      .finally(() => {
        enVuelo.current = null;
        setRecalculando(false);
      });
    enVuelo.current = corrida;
    return corrida;
  }, [persona.profileId, refreshComparison]);

  useEffect(() => {
    if (comparison === undefined) return;
    if (!necesitaRecalculo(comparison)) return;
    const clave = `${persona.profileId}|${persona.availableLevel}|${comparison.inputHash}`;
    if (pedidoAutomatico.current === clave) return;
    pedidoAutomatico.current = clave;
    void recalcular();
  }, [comparison, persona.profileId, persona.availableLevel, recalcular]);

  /**
   * Borrar es destructivo e irreversible, así que pasa por la confirmación del
   * sistema —el `Alert` nativo, que VoiceOver anuncia y que se cancela con un
   * gesto—. Sin un "sí" explícito no se llama a la mutation.
   *
   * El candado se toma ANTES de esperar la confirmación: `borrando` se enciende
   * recién después del "sí", así que sin candado dos toques del mismo render
   * abrían dos alertas encimadas y podían disparar dos borrados. Se libera al
   * cancelar, al fallar y al terminar (lo hace `runExclusive`).
   */
  const borrar = async () => {
    if (borrando) return;
    await runExclusive(borradoEnCurso, async () => {
      const confirmado = await confirm({
        title: `¿Borrar a ${persona.name}?`,
        message:
          "Se borran los datos que cargaste de esta persona y la comparación calculada. No se puede deshacer. Tu carta no cambia.",
        confirmLabel: "Borrar",
        destructive: true
      });
      if (!confirmado) return;
      setBorrando(true);
      setErrorBorrado(null);
      try {
        await removePerson({ profileId: persona.profileId });
        onRemoved();
        router.replace("/vinculos");
      } catch {
        setBorrando(false);
        setErrorBorrado(
          "No pudimos borrar a esta persona. Sigue guardada: revisá tu conexión y probá de nuevo."
        );
      }
    });
  };

  const completarDatos = () =>
    router.push(`/vinculos/conectar?profileId=${persona.profileId}` as never);

  /** Cuando el dato que falta es TUYO, la salida es tu editor, no el de ella. */
  const completarMisDatos = () => router.push("/editar-datos" as never);

  const eyebrow = relationshipHeadline(persona);

  if (comparison === undefined) {
    return (
      <Shell eyebrow={eyebrow}>
        <Section>
          <NivelDeDatos persona={persona} />
          <LoadingBlock message="Buscando la comparación…" />
        </Section>
      </Shell>
    );
  }

  const data = comparison.data;
  const nivel = persona.availableLevel;
  const verificada =
    data && timezone && Number.isFinite(comparison.observedAt)
      ? formatDateTime(comparison.observedAt, timezone, { withYear: true })
      : null;
  // El aviso de "esto no se pudo actualizar" se muestra tanto cuando el backend
  // marcó el sobre viejo como cuando el recálculo de esta pantalla falló: en los
  // dos casos lo visible es la última comparación verificada.
  const viejo = comparison.status === "stale" || recalculoFallido;
  // El botón sólo existe mientras haya algo que reintentar. Con el cálculo listo
  // desaparece: ofrecer "recalcular" sobre un resultado vigente sugiere que lo
  // que se está viendo quedó viejo.
  const puedeRecalcular = recalculando || recalculoFallido || necesitaRecalculo(comparison);
  // El modo sale del NIVEL guardado y de si hubo cálculo, no sólo de
  // `data.generalOnly`: sin cálculo ese campo no existe y un nivel 01 caía en la
  // rama de las cinco dimensiones, con cinco barras en cero y la leyenda de las
  // dos cartas.
  const modo = relationshipResultMode({ level: nivel, data });
  const soloGeneral = relationshipModeIsGeneral(modo);
  const calculado = relationshipModeHasCalculation(modo);
  // Las causas reales, con DE QUIÉN es cada dato que falta. Se calculan una sola
  // vez: las lee el cuerpo sin cálculo y también el botón de completar datos.
  const huecos = calculado ? [] : relationshipGaps(comparison, persona);

  return (
    <Shell eyebrow={eyebrow}>
      <Section>
        {viejo ? (
          <View style={styles.notice}>
            <StaleNotice
              observedAt={latestObservedAt([comparison])}
              timezone={timezone}
              onRetry={recalculando ? undefined : recalcular}
              retrying={recalculando}
            />
          </View>
        ) : null}

        <NivelDeDatos persona={persona} />

        {/* El cálculo llegó más abajo que el dato guardado. Va PEGADO al nivel,
            porque corrige lo que el rótulo de arriba acaba de afirmar: sin esto,
            `03 · CARTA CONTRA CARTA` prometería una lectura que esta corrida no
            produjo. No es un estado del sobre —eso lo dice `StatusLine`—, es la
            distancia entre lo que los datos permiten y lo que se pudo calcular. */}
        {data && data.resolvedLevel !== data.requestedLevel ? (
          <Note style={styles.corto}>
            {`Los datos guardados permiten comparar ${RELATIONSHIP_LEVEL_HEADLINE[
              data.requestedLevel
            ].toLocaleLowerCase("es")}, pero este cálculo llegó hasta ${RELATIONSHIP_LEVEL_HEADLINE[
              data.resolvedLevel
            ].toLocaleLowerCase("es")}. Abajo está por qué; podés volver a intentarlo.`}
          </Note>
        ) : null}

        {/* Estado y precisión: con el cálculo listo y exacto no dibuja NADA —ni
            un margen—, así que en los dos estados canónicos la pantalla queda
            igual al frame y sólo aparece cuando hay algo real que declarar. */}
        <StatusLine status={comparison.status} precision={comparison.precision} />

        {/* La lectura GENERAL antes del detalle (2026-08-19): cuántos contactos
            hay, qué pesa más y dónde está el material. Es factual a propósito —
            un resumen con nota sería el puntaje global que este producto
            prohíbe—, y por eso sale del dominio, no de un copy suelto. */}
        {(() => {
          const resumen = data ? relationshipComparisonSummary(data) : null;
          if (!resumen) return null;
          return (
            <>
              <SectionHeader title="EN RESUMEN" bullet={false} tone="accent" />
              <Body>{relationshipSummaryLine(resumen)}</Body>
            </>
          );
        })()}

        <SectionHeader title="POR DIMENSIÓN" bullet={false} tone="accent" />
        <Body>
          {soloGeneral
            ? relationshipLockedDimensionsNote()
            : "No hay un puntaje único. Un vínculo puede fluir en un plano y trabarse en otro."}
        </Body>
        {/* La leyenda sólo describe una barra que EXISTE. Sin cálculo no hay
            barras, y decir qué muestran sería describir algo que no está. */}
        {calculado ? (
          <Legend>
            {soloGeneral
              ? "LA BARRA MUESTRA CUÁNTO SE PUEDE LEER CON UN SIGNO · NO ES UN PORCENTAJE DE COMPATIBILIDAD"
              : "LAS BARRAS CUENTAN CONTACTOS REALES ENTRE LAS DOS CARTAS · NO SON UN PORCENTAJE DE COMPATIBILIDAD · EL COLOR DICE SI PESAN MÁS LOS CONTACTOS FLUIDOS O LOS DE TENSIÓN"}
          </Legend>
        ) : null}

        {data ? (
          <CuerpoComparacion data={data} />
        ) : (
          <SinComparacion
            nivel={nivel}
            huecos={huecos}
            // El nivel 03 no dibuja la escalera de desbloqueo, así que si el
            // faltante es de esa persona el único lugar donde ofrecerlo es acá.
            onCompletarSusDatos={
              nivel === "chart_to_chart" && relationshipGapsBlameOther(huecos)
                ? completarDatos
                : undefined
            }
            onCompletarMisDatos={
              relationshipGapsBlameOwn(huecos) ? completarMisDatos : undefined
            }
          />
        )}

        {nivel !== "chart_to_chart" ? (
          <QueFalta nivel={nivel} soloGeneral={soloGeneral} onCompletar={completarDatos} persona={persona} />
        ) : null}

        <SectionHeader title="LO QUE ESTO NO DICE" bullet={false} tone="muted" />
        <Note>
          {soloGeneral
            ? RELATIONSHIP_GENERAL_ONLY_DISCLAIMER
            : relationshipDisclaimer(data?.disclaimer)}
        </Note>
        {/* Los límites que declaró ESTE cálculo van bajo el mismo rótulo, no en
            una caja aparte: dos títulos casi iguales ("lo que esto no dice" y
            "lo que este cálculo no dice") se leían como dos descargos. */}
        {uniqueLines(comparison.limitations).map((limitacion) => (
          <Note key={limitacion} style={styles.limite}>
            · {limitacion}
          </Note>
        ))}

        {recalculando || recalculoFallido ? (
          <View style={styles.estado} accessibilityLiveRegion="polite">
            {recalculando ? <Note>Recalculando con los datos guardados…</Note> : null}
            {!recalculando && recalculoFallido ? (
              <View accessibilityRole="alert">
                <Note style={styles.alerta}>
                  No pudimos recalcular la comparación. Lo que ves es la última comparación
                  verificada.
                </Note>
              </View>
            ) : null}
          </View>
        ) : null}

        {puedeRecalcular ? (
          <View style={styles.cta}>
            <PrimaryButton
              label={recalculando ? "RECALCULANDO…" : "RECALCULAR LA COMPARACIÓN"}
              accessibilityLabel={`Recalcular la comparación con ${persona.name}`}
              onPress={recalcular}
              disabled={recalculando}
              align="start"
            />
          </View>
        ) : null}

        <View style={styles.trace}>
          <TraceAccordion
            envelope={comparison}
            timezone={timezone}
            calculatedDatum={datoCalculado(data?.resolvedLevel ?? nivel)}
            interpretiveRule="Cada contacto se nombra por lo que es —qué punto de una carta toca qué punto de la otra y con qué aspecto— y se agrupa en la dimensión que ese contacto suele describir. La suma de contactos no se convierte en un puntaje: el cálculo muestra dónde las dos cartas coinciden y dónde difieren, no cómo va a funcionar la relación."
          />
        </View>

        {/* Cuándo se calculó lo que estás viendo. Una comparación se mueve cuando
            se mueven los datos guardados, no con el día, y decirlo con fecha es lo
            único que lo demuestra.

            El método y su versión NO van acá: son trazabilidad y su lugar es el
            acordeón, que ya los publica en `MÉTODO Y VERSIÓN` con el título del
            análisis al lado. Repetir el identificador crudo en el pie lo mostraba
            dos veces, y la copia sin contexto se leía como ruido de desarrollo. */}
        <View style={styles.pie}>
          <Label style={styles.pieLabel}>
            {verificada ? `ÚLTIMA COMPARACIÓN VERIFICADA · ${verificada}` : "TODAVÍA SIN COMPARACIÓN VERIFICADA"}
          </Label>
        </View>

        <View style={styles.estado} accessibilityLiveRegion="polite">
          {borrando ? <Note>Borrando a esta persona…</Note> : null}
          {!borrando && errorBorrado !== null ? (
            <View accessibilityRole="alert">
              <Note style={styles.alerta}>{errorBorrado}</Note>
            </View>
          ) : null}
        </View>
        <Touchable
          onPress={borrar}
          disabled={borrando}
          accessibilityLabel={`Borrar a ${persona.name} de tus vínculos`}
          accessibilityHint="Se borran sus datos y la comparación. No se puede deshacer."
          accessibilityState={{ disabled: borrando }}
          style={styles.borrar}
          pressedStyle={styles.pressed}
        >
          <Label style={styles.borrarTexto}>
            {borrando ? "BORRANDO…" : "BORRAR A ESTA PERSONA"}
          </Label>
        </Touchable>
      </Section>
    </Shell>
  );
}

/**
 * `NIVEL DE DATOS` · `03 · CARTA CONTRA CARTA`, la barra de ancho completo y la
 * frase que dice qué cargó esta persona.
 *
 * La barra es una POSICIÓN dentro de tres, no una medida: con el signo se ve un
 * tercio, con la fecha dos, con la carta completa entera. Debajo van los datos
 * guardados en una sola línea de ancho completo —partidos en una columna
 * angosta eran ilegibles— para que se pueda verificar de un vistazo que la
 * persona comparada es la que se cargó.
 */
function NivelDeDatos({ persona }: { persona: RelationshipProfile }) {
  const nivel = persona.availableLevel;
  const rango = RELATIONSHIP_LEVEL_RANK[nivel];
  const datos = relationshipBirthLine(persona);
  return (
    <View style={styles.nivel}>
      <View style={styles.nivelHead}>
        <Label style={styles.nivelLabel}>NIVEL DE DATOS</Label>
        <Mono style={styles.nivelValor}>
          {`${relationshipLevelBadge(nivel)} · ${RELATIONSHIP_LEVEL_HEADLINE[nivel]}`}
        </Mono>
      </View>
      <View style={styles.nivelBarra}>
        <MeterBar
          value={relationshipLevelShare(nivel)}
          accessibilityLabel={`Nivel de datos ${rango} de ${RELATIONSHIP_LEVEL_COUNT}: ${RELATIONSHIP_LEVEL_HEADLINE[
            nivel
          ].toLocaleLowerCase("es")}.`}
        />
      </View>
      <Body>{relationshipLevelSentence(nivel, persona.name)}</Body>
      {datos ? <Mono style={styles.datos}>{datos}</Mono> : null}
    </View>
  );
}

/** Qué se calculó, en palabras, según el nivel que el cálculo alcanzó. */
function datoCalculado(level: ComparisonLevel): string {
  if (level === "sign_to_sign") {
    return "El elemento y la modalidad de los dos signos solares: el tuyo y el de esta persona. Ninguna posición personal de ella entra en este cálculo.";
  }
  if (level === "date_to_date") {
    return "Los contactos entre las posiciones de las dos fechas de nacimiento que se mantienen durante toda la franja de cada día; lo que puede moverse dentro de esa franja se toma como rango o se retira. Van agrupados en las cinco dimensiones. Sin hora exacta no entran casas ni Ascendentes.";
  }
  return "Los contactos entre las dos cartas completas: aspectos entre planetas, los dos Ascendentes y en qué casa de una carta cae cada planeta de la otra, agrupados en las cinco dimensiones.";
}

/**
 * El cuerpo del resultado. Dos formas, porque son dos cosas distintas: una
 * lectura general de dos signos —una sola fila, `Estilo general`— o las cinco
 * dimensiones con los contactos reales entre dos cartas.
 */
function CuerpoComparacion({ data }: { data: RelationshipComparisonData }) {
  if (data.generalOnly || data.dimensions.length === 0) {
    return (
      <FilaDimension
        nombre="Estilo general"
        // Lo único legible de cinco: la barra dice ESO y la leyenda de arriba lo
        // escribe. No es un puntaje del vínculo ni una medida de afinidad.
        proporcion={relationshipGeneralOnlyShare()}
        // Tono "fluido" (cobre, la marca): este riel no cuenta contactos —no hay
        // ninguno con un signo solo—, marca cuánto de la escalera se puede leer.
        // El azul acero queda para la evidencia de tensión de una dimensión real
        // (mapeo invertido el 2026-08-19: cálido = fluye, frío = tensión).
        tono="fluido"
        texto={data.summary}
        accessibilityLabel={`Estilo general: la única lectura disponible de ${RELATIONSHIP_READABLE_COUNT} con el signo solo.`}
      />
    );
  }

  const maximo = data.dimensions.reduce(
    (mayor, dimension) => Math.max(mayor, dimension.drivers.length),
    0
  );
  return (
    <>
      {data.dimensions.map((dimension) => (
        <DimensionConContactos key={dimension.key} dimension={dimension} maximo={maximo} />
      ))}
    </>
  );
}

/** "3 contactos" — el recuento real que produce la barra. */
function contactosLabel(total: number): string {
  if (total === 0) return "sin contactos principales";
  return total === 1 ? "1 contacto" : `${total} contactos`;
}

/**
 * Una dimensión con sus contactos reales: el rótulo y la barra en el mismo
 * renglón —como el frame—, y debajo el contacto que más pesa, dicho con sus
 * nombres y su distancia al punto exacto.
 *
 * Cuando hay más de uno, el resto se abre a pedido en vez de estirar la
 * pantalla: están todos, no se esconde ninguno, pero la lectura de arriba no se
 * convierte en una lista técnica de veinte líneas.
 */
function DimensionConContactos({
  dimension,
  maximo
}: {
  dimension: RelationshipDimension;
  maximo: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const contactos = dimension.drivers.length;
  const principal = dimension.drivers[0];
  const resto = dimension.drivers.slice(1);
  // El color sale del balance apoyo/tensión de ESTA dimensión (`dimension.value`
  // del sobre), no de un puntaje global ni de un tono fijo. El largo sigue
  // contando contactos: son dos hechos distintos y cada uno se dice.
  const tono = relationshipDimensionTone(dimension.value);

  return (
    <FilaDimension
      nombre={dimension.label}
      proporcion={relationshipDriverShare(contactos, maximo)}
      tono={tono}
      // Sin un solo contacto el `summary` del backend SÍ es el dato: dice que no
      // aparece un contacto principal y que eso no equivale a ausencia de
      // vínculo. Con contactos, el dato es el contacto.
      texto={principal ?? dimension.summary}
      accessibilityLabel={`${dimension.label}: ${contactosLabel(
        contactos
      )}, sobre un máximo de ${maximo} en esta comparación.${
        contactos > 0 ? ` ${relationshipToneVoice(tono)}.` : ""
      }`}
      precision={dimension.precision}
    >
      {resto.length > 0 ? (
        <>
          <Touchable
            onPress={() => setAbierto((valor) => !valor)}
            accessibilityState={{ expanded: abierto }}
            accessibilityLabel={`${resto.length === 1 ? "Otro contacto" : `Otros ${resto.length} contactos`} de ${dimension.label}`}
            accessibilityHint={abierto ? "Toca para ocultarlos" : "Toca para verlos"}
            style={styles.masContactos}
            pressedStyle={styles.pressed}
          >
            <Label style={styles.masContactosTexto}>
              {abierto
                ? "OCULTAR LOS OTROS CONTACTOS"
                : `+ ${resto.length} ${resto.length === 1 ? "CONTACTO MÁS" : "CONTACTOS MÁS"}`}
            </Label>
          </Touchable>
          {abierto
            ? resto.map((contacto) => (
                <Note key={contacto} style={styles.contactoExtra}>
                  · {contacto}
                </Note>
              ))
            : null}
        </>
      ) : null}
    </FilaDimension>
  );
}

/**
 * La fila del canon: nombre a la izquierda, barra a la derecha en el MISMO
 * renglón, y el texto debajo en el gris de lectura secundaria.
 *
 * La barra ocupa poco más de la mitad del ancho, como en el frame, y nunca
 * empuja al nombre fuera de la pantalla: el nombre encoge y envuelve antes que
 * la barra, así que con Dynamic Type grande la fila crece hacia abajo en vez de
 * recortarse.
 */
function FilaDimension({
  nombre,
  proporcion,
  tono,
  texto,
  accessibilityLabel,
  precision,
  children
}: {
  nombre: string;
  proporcion: number;
  /** El tono de la barra, derivado de la evidencia de esta dimensión. */
  tono: RelationshipDimensionTone;
  texto: string;
  accessibilityLabel: string;
  precision?: RelationshipDimension["precision"];
  children?: ReactNode;
}) {
  return (
    <View style={styles.fila}>
      <View style={styles.filaHead}>
        <Body style={styles.filaNombre}>{nombre}</Body>
        <View style={styles.filaBarra}>
          <MeterBar
            value={proporcion}
            tone={tono === "fluido" ? "copper" : "harmony"}
            accessibilityLabel={accessibilityLabel}
          />
        </View>
      </View>
      <Note style={styles.filaTexto}>{texto}</Note>
      {precision === "range" ? (
        <Note style={styles.filaTexto}>
          Alguno de estos contactos se apoya en una posición que puede moverse dentro del día: se
          acota a un rango, no a un valor único.
        </Note>
      ) : null}
      {precision === "estimated" ? (
        <Note style={styles.filaTexto}>
          Alguno de estos contactos sale de una posición estimada, no de un dato exacto.
        </Note>
      ) : null}
      {children}
    </View>
  );
}

/**
 * Qué habilita el dato que falta, con el botón que lleva a cargarlo.
 *
 * Es la ESCALERA CANÓNICA del frame `10`, exactamente: con la fecha se agregan
 * `Cómo se cuidan`, `Deseo` y `Fricción`; con la hora y el lugar se agrega
 * `Proyecto en común`, además de las casas y los ascendentes. Son cuatro
 * dimensiones —no cinco—, las mismas cuatro que cuenta la frase de arriba.
 *
 * Nombrarlas no adelanta ningún resultado —no hay un número ni un contacto en
 * pantalla— y es lo contrario de esconderlas: quien está en el nivel 01 ve
 * exactamente qué gana si carga la fecha, en vez de descubrirlo después.
 *
 * El botón lleva a los datos de ESA persona, y aparece sólo acá: el nivel lo
 * decide su propio perfil guardado, así que en este bloque el faltante es suyo
 * por definición.
 */
function QueFalta({
  nivel,
  soloGeneral,
  onCompletar,
  persona
}: {
  nivel: ComparisonLevel;
  soloGeneral: boolean;
  onCompletar: () => void;
  persona: RelationshipProfile;
}) {
  const faltaFecha = nivel === "sign_to_sign";
  return (
    <View style={styles.falta}>
      {faltaFecha ? (
        <>
          <Label style={styles.faltaLabel}>{RELATIONSHIP_UNLOCK_LABEL.withDate}</Label>
          {RELATIONSHIP_DATE_UNLOCKS.map((clave) => (
            <Note key={clave} style={styles.faltaItem}>
              {RELATIONSHIP_DIMENSION_LABEL[clave]}
            </Note>
          ))}
        </>
      ) : null}
      <Label style={[styles.faltaLabel, faltaFecha ? styles.faltaLabelSiguiente : undefined]}>
        {RELATIONSHIP_UNLOCK_LABEL.withTime}
      </Label>
      <Note style={styles.faltaItem}>
        {`${RELATIONSHIP_TIME_UNLOCK_DIMENSIONS.map((clave) => RELATIONSHIP_DIMENSION_LABEL[clave]).join(
          " · "
        )} · ${RELATIONSHIP_TIME_UNLOCKS.toLocaleLowerCase("es")}`}
      </Note>
      <View style={styles.cta}>
        <PrimaryButton
          label="COMPLETAR SUS DATOS"
          accessibilityLabel={`Completar los datos de ${persona.name || "esta persona"}`}
          accessibilityHint={
            soloGeneral
              ? "Abre sus datos guardados para agregar la fecha de nacimiento"
              : "Abre sus datos guardados para agregar la hora y el lugar"
          }
          onPress={onCompletar}
          align="start"
        />
      </View>
    </View>
  );
}

/**
 * Todavía no hay comparación calculada.
 *
 * Tres reglas, las tres corregidas después de la auditoría independiente:
 *
 * 1. **Lo que se nombra es lo que ese nivel podía leer.** Con el signo solo la
 *    lectura que falta es `Estilo general`, una; no las cinco dimensiones. Antes
 *    esto se decidía por `data.generalOnly`, que sin cálculo no existe, así que
 *    el nivel 01 listaba cinco dimensiones que ese nivel nunca produce.
 * 2. **Ningún cero se dibuja.** Una barra en cero es un resultado calculado —"no
 *    hay ni un contacto"— y acá no se calculó nada. Va el nombre apagado con la
 *    marca `SIN CALCULAR`, sin riel.
 * 3. **La causa es la real, con dueño.** El texto dice de quién es el dato que
 *    falta, y el botón que se ofrece es el de ESE dueño.
 */
function SinComparacion({
  nivel,
  huecos,
  onCompletarSusDatos,
  onCompletarMisDatos
}: {
  nivel: ComparisonLevel;
  huecos: readonly RelationshipGap[];
  onCompletarSusDatos?: () => void;
  onCompletarMisDatos?: () => void;
}) {
  const pendientes =
    nivel === "sign_to_sign" ? ["Estilo general"] : RELATIONSHIP_DIMENSION_ORDER.map((clave) => RELATIONSHIP_DIMENSION_LABEL[clave]);
  return (
    <View>
      <Note style={styles.blockTop}>{relationshipDimensionsLock(nivel)}</Note>
      {huecos.map((hueco) => (
        <Note key={hueco.reason} style={styles.limite}>
          · {hueco.reason}
        </Note>
      ))}
      {pendientes.map((nombre) => (
        <View key={nombre} style={styles.filaPendiente}>
          <View style={styles.filaHead}>
            <Body style={[styles.filaNombre, styles.filaNombreApagada]}>{nombre}</Body>
            <Label style={styles.sinCalcular}>SIN CALCULAR</Label>
          </View>
        </View>
      ))}
      {onCompletarMisDatos ? (
        <View style={styles.cta}>
          <PrimaryButton
            label="REVISAR MIS DATOS DE NACIMIENTO"
            accessibilityLabel="Revisar mis datos de nacimiento"
            accessibilityHint="Abre tus datos guardados: lo que falta para esta comparación es tuyo"
            onPress={onCompletarMisDatos}
            align="start"
          />
        </View>
      ) : null}
      {onCompletarSusDatos ? (
        <View style={styles.cta}>
          <PrimaryButton
            label="COMPLETAR SUS DATOS"
            accessibilityLabel="Completar los datos de esta persona"
            onPress={onCompletarSusDatos}
            align="start"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  alerta: { color: v492.colors.copperSoft },
  blockTop: { marginTop: v492.space.lg },
  borrar: {
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: v492.space.xl,
    minHeight: v492.touch,
    minWidth: v492.touch
  },
  borrarTexto: { color: v492.colors.textDim },
  contactoExtra: { marginTop: v492.space.sm },
  corto: { color: v492.colors.copperSoft, marginTop: v492.space.md },
  cta: { marginTop: v492.space.lg },
  datos: { color: v492.colors.textDim, marginTop: v492.space.sm },
  estado: { marginTop: v492.space.md },
  falta: { marginTop: v492.space.xl },
  faltaItem: { marginTop: v492.space.sm },
  faltaLabel: { color: v492.colors.textMuted },
  faltaLabelSiguiente: { marginTop: v492.space.lg },
  fila: { marginTop: v492.space.xl },
  // La barra es del ancho del frame (179 de 345 en 393 pt) y se expresa en
  // proporción para que sea el mismo bloque en 375 y en 440.
  filaBarra: { flexGrow: 0, flexShrink: 0, maxWidth: 179, width: "52%" },
  // Una fila SIN cálculo respira menos que una con texto: es un nombre y una
  // marca, no una lectura.
  filaPendiente: { marginTop: v492.space.lg },
  sinCalcular: { color: v492.colors.textDim, flexShrink: 0, textAlign: "right" },
  filaHead: {
    alignItems: "center",
    flexDirection: "row",
    gap: v492.space.md,
    justifyContent: "space-between"
  },
  filaNombre: { color: v492.colors.text, flexShrink: 1 },
  filaNombreApagada: { color: v492.colors.textDim },
  filaTexto: { marginTop: v492.space.md },
  limite: { marginTop: v492.space.sm },
  masContactos: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: v492.touch,
    minWidth: v492.touch
  },
  masContactosTexto: { color: v492.colors.copperSoft },
  nivel: { marginTop: v492.space.lg },
  nivelBarra: { marginBottom: v492.space.lg, marginTop: v492.space.md },
  nivelHead: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: v492.space.md,
    justifyContent: "space-between"
  },
  nivelLabel: { color: v492.colors.copperSoft, flexShrink: 0 },
  nivelValor: { color: v492.colors.text, flexShrink: 1, textAlign: "right" },
  notice: { marginTop: v492.space.lg },
  pie: { marginTop: v492.space.xl },
  pieLabel: { marginTop: v492.space.xs },
  pressed: { opacity: 0.6 },
  trace: { marginTop: v492.space.xxl }
});
