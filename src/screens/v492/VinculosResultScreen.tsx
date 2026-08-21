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
import { relationshipCalcKey, relationshipNeedsCalculation } from "@/domain/relationshipCalc";
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
  relationshipDisclaimer,
  relationshipEditHref,
  relationshipGaps,
  relationshipGapsBlameOther,
  relationshipGapsBlameOwn,
  relationshipHeadline,
  relationshipLevelBadge,
  relationshipLevelSentence,
  relationshipLockedDimensionsNote,
  relationshipLevelShare,
  relationshipModeHasCalculation,
  relationshipModeIsGeneral,
  relationshipResultMode,
  relationshipSignLabel,
  type RelationshipGap
} from "@/domain/relationships";
import {
  relationshipBalanceWord,
  relationshipContactRole,
  relationshipContactsCollapseLabel,
  relationshipContactsCount,
  relationshipContactsLine,
  relationshipContactsToggleLabel,
  relationshipContactsToggleVoice,
  relationshipDimensionRowVoice,
  relationshipDynamicRole,
  relationshipDynamicsLead,
  relationshipReading,
  type RelationshipDimensionReading,
  type RelationshipReading
} from "@/domain/relationshipReading";
import { useLayers } from "@/hooks/useLayers";
import {
  relationshipsApi,
  type ComparisonLevel,
  type RelationshipComparisonData,
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
 * 3. **Contar contactos no es medir compatibilidad.** No hay puntaje global, no
 *    hay porcentaje y —desde QA22-020— tampoco hay barra: cada dimensión dice EN
 *    TEXTO cuántos contactos reunió y hacia dónde se inclinan. Un riel con
 *    largos distintos se leía como una nota del vínculo por más que la leyenda
 *    lo negara, y el color solo no le decía nada a quien no lo distingue.
 *
 * **De dónde sale el texto de cada dimensión.** Del contacto real, no del
 * resumen. `dimension.summary` es una plantilla del backend por tono —"En cómo
 * se hablan aparecen más recursos de fluidez…"— y las cinco dimensiones la
 * repetían cambiando el nombre: la certificación lo registró como texto
 * genérico. Ahora cada dimensión declara TRES cosas —qué se facilita, qué puede
 * tensarse y una acción o una pregunta—, armadas en
 * `src/domain/relationshipReading.ts` sobre la evidencia real que publica
 * `driverDetails`: qué contactos apoyan, cuáles tensan y cuánto pesa cada uno.
 * Las oraciones de los contactos se muestran tal cual, sin reescribirlas:
 * cualquier arreglo de strings sobre una oración astrológica corre el riesgo de
 * afirmar algo que el cálculo no dijo.
 *
 * **Los sobres del build 22 siguen abriendo.** `driverDetails` es aditivo y
 * opcional: si no está, la lectura no inventa calidad, peso ni precisión —lo
 * dice— y muestra los contactos igual, con el orden que el sobre ya traía.
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
    if (!relationshipNeedsCalculation(comparison)) return;
    const clave = relationshipCalcKey({
      profileId: persona.profileId,
      level: persona.availableLevel,
      inputHash: comparison.inputHash
    });
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

  /**
   * Los datos de ESTA persona, precompletados.
   *
   * Es el mismo destino para "Completar sus datos" y para "Editar datos de …":
   * son la misma pantalla y la misma persona, y el formulario ya no vuelve a
   * preguntar qué comparar (QA22-018).
   */
  const completarDatos = () => router.push(relationshipEditHref(persona.profileId) as never);

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
  const puedeRecalcular =
    recalculando || recalculoFallido || relationshipNeedsCalculation(comparison);
  // El modo sale del NIVEL guardado y de si hubo cálculo, no sólo de
  // `data.generalOnly`: sin cálculo ese campo no existe y un nivel 01 caía en la
  // rama de las cinco dimensiones, con cinco barras en cero y la leyenda de las
  // dos cartas.
  const modo = relationshipResultMode({ level: nivel, data });
  const soloGeneral = relationshipModeIsGeneral(modo);
  const calculado = relationshipModeHasCalculation(modo);
  // La lectura entera —dinámicas principales, las tres explicaciones por
  // dimensión y la reutilización de un contacto— se arma una sola vez, en el
  // dominio. `null` cuando no hay dimensiones que leer.
  const lectura = data ? relationshipReading(data) : null;
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

        {/* La síntesis abre con las DINÁMICAS reales: dos o tres contactos del
            cálculo, elegidos por fuerza, calidad y precisión. No es un veredicto
            —no hay nota ni puntaje— y no es una estadística: cada dinámica es un
            contacto con su propia oración y sus dimensiones nombradas
            (QA22-017). */}
        {lectura && lectura.dynamics.length > 0 ? (
          <>
            <SectionHeader title="EN RESUMEN" bullet={false} tone="accent" />
            <Body>{relationshipDynamicsLead(lectura)}</Body>
            {lectura.dynamics.map((dinamica) => (
              <View key={dinamica.id} style={styles.dinamica}>
                <Body>{dinamica.text}</Body>
                <Note style={styles.dinamicaPapel}>{relationshipDynamicRole(dinamica)}</Note>
              </View>
            ))}
            <Note style={styles.resumenCuenta}>{relationshipContactsLine(lectura)}</Note>
          </>
        ) : null}

        <SectionHeader title="POR DIMENSIÓN" bullet={false} tone="accent" />
        <Body>
          {soloGeneral
            ? relationshipLockedDimensionsNote()
            : "No hay un puntaje único. Un vínculo puede fluir en un plano y trabarse en otro."}
        </Body>
        {/* La leyenda describe lo que la fila DICE, no una barra: cuántos
            contactos reunió la dimensión y hacia dónde se inclinan, escrito.
            Sin cálculo no hay filas, y describirlas sería describir algo que no
            está. */}
        {calculado ? (
          <Legend>
            {soloGeneral
              ? `CON UN SIGNO SOLO HAY UNA LECTURA POSIBLE DE ${RELATIONSHIP_READABLE_COUNT} · NO ES UN PORCENTAJE DE COMPATIBILIDAD`
              : "CADA DIMENSIÓN DICE CUÁNTOS CONTACTOS REÚNE Y HACIA DÓNDE SE INCLINAN · NO ES UN PORCENTAJE DE COMPATIBILIDAD · NO HAY PUNTAJE"}
          </Legend>
        ) : null}

        {/* Las advertencias de precisión, UNA vez y no cinco.
            Repetidas dimensión por dimensión —"alguno de estos contactos se
            apoya en una posición que puede moverse dentro del día"— ocupaban más
            lugar que la lectura misma (QA22-017). El dato no se pierde: la
            oración de cada contacto sigue diciendo su rango cuando lo tiene. */}
        {lectura ? <NotaDePrecision lectura={lectura} /> : null}

        {data ? (
          <CuerpoComparacion data={data} lectura={lectura} />
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

        {/* Editar SIEMPRE, no sólo cuando falta un dato (QA22-023).
            `COMPLETAR SUS DATOS` desaparecía en cuanto el nivel llegaba a 03, y
            desde adentro sólo quedaba borrar: una hora mal cargada —que es
            justo lo que mueve las casas y el Ascendente— no se podía corregir
            sin eliminar a la persona y volver a crearla. Abre el MISMO
            formulario precompletado y guarda sobre la misma persona. */}
        <View style={styles.cta}>
          <PrimaryButton
            label={`EDITAR DATOS DE ${(persona.name || "ESTA PERSONA").toLocaleUpperCase("es")}`}
            accessibilityLabel={`Editar datos de ${persona.name || "esta persona"}`}
            accessibilityHint="Abre su formulario con los datos que ya cargaste. El nivel de la comparación sale de esos datos."
            onPress={completarDatos}
            align="start"
          />
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
 * Las advertencias de precisión de TODA la comparación, dichas una vez.
 *
 * Antes cada dimensión repetía la suya y el bloque de advertencias terminaba
 * pesando más que la lectura (QA22-017). Se agrupan por la peor precisión
 * presente: si algún contacto se apoya en un rango, eso es lo que hay que decir,
 * y decirlo cinco veces no lo vuelve más cierto.
 */
function NotaDePrecision({ lectura }: { lectura: RelationshipReading }) {
  const precisiones = lectura.dimensions.map((dimension) => dimension.precision);
  if (precisiones.includes("range")) {
    return (
      <Note style={styles.precision}>
        Algunos de estos contactos se apoyan en posiciones que pueden moverse dentro del día: se
        acotan a un rango, no a un valor único. Cada contacto dice el suyo cuando lo abrís.
      </Note>
    );
  }
  if (precisiones.includes("estimated")) {
    return (
      <Note style={styles.precision}>
        Algunos de estos contactos salen de posiciones estimadas, no de datos exactos.
      </Note>
    );
  }
  return null;
}

/**
 * El cuerpo del resultado. Dos formas, porque son dos cosas distintas: una
 * lectura general de dos signos —una sola fila, `Estilo general`— o las cinco
 * dimensiones con los contactos reales entre dos cartas.
 */
function CuerpoComparacion({
  data,
  lectura
}: {
  data: RelationshipComparisonData;
  lectura: RelationshipReading | null;
}) {
  if (!lectura || data.generalOnly || data.dimensions.length === 0) {
    return (
      <View style={styles.fila}>
        <View style={styles.filaHead}>
          <Body style={styles.filaNombre}>Estilo general</Body>
        </View>
        {/* Lo único legible de cinco, dicho como cuenta y no como riel: con un
            signo solo no hay ningún contacto que contar, y una barra ahí se leía
            como una medida de afinidad. */}
        <View
          accessible
          style={styles.filaDato}
          accessibilityLabel={`Estilo general: la única lectura disponible de ${RELATIONSHIP_READABLE_COUNT} con el signo solo.`}
        >
          <Mono style={styles.filaConteo}>{`1 LECTURA DE ${RELATIONSHIP_READABLE_COUNT}`}</Mono>
        </View>
        <Note style={styles.filaTexto}>{data.summary}</Note>
      </View>
    );
  }

  return (
    <>
      {lectura.dimensions.map((dimension) => (
        <DimensionLeida key={dimension.key} dimension={dimension} />
      ))}
    </>
  );
}

/**
 * Una dimensión leída: el rótulo, la fila textual con su cantidad y su balance,
 * las tres cosas que tiene que explicar —qué se facilita, qué puede tensarse y
 * una acción o una pregunta— y, detrás de una acción inequívoca, los contactos
 * que la forman.
 *
 * Tres decisiones del registro físico viven acá:
 *
 * - **Sin barra (QA22-020).** La cantidad y el balance van escritos. El color
 *   acompaña la palabra del balance, nunca la reemplaza: quien no lo distingue
 *   lee exactamente lo mismo.
 * - **La divulgación se nombra (QA22-019).** `+ 1 CONTACTO MÁS` no decía a qué
 *   dimensión pertenecía lo plegado ni cuántos había en total. Ahora el control
 *   dice los dos: `VER LOS 2 CONTACTOS QUE FORMAN DESEO`.
 * - **Un contacto reutilizado se explica (QA22-021).** Si el mismo id alimenta
 *   otra dimensión, se dice ahí mismo. No se duplica el detalle como si fueran
 *   dos contactos distintos, y tampoco se borra de una de las dos.
 */
function DimensionLeida({ dimension }: { dimension: RelationshipDimensionReading }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <View style={styles.fila}>
      <View style={styles.filaHead}>
        <Body style={styles.filaNombre}>{dimension.label}</Body>
      </View>
      {/* La fila del dato, sin riel: la cantidad y el balance en palabras. El
          color va SÓLO sobre la palabra del balance y nunca solo — quien no lo
          distingue lee el mismo texto (QA22-020). */}
      <View
        accessible
        style={styles.filaDato}
        accessibilityLabel={relationshipDimensionRowVoice(dimension)}
      >
        <Mono style={styles.filaConteo}>
          {relationshipContactsCount(dimension.contacts).toLocaleUpperCase("es")}
        </Mono>
        {relationshipBalanceWord(dimension) ? (
          <Mono
            style={[
              styles.filaBalance,
              dimension.balance === "mas_fluido"
                ? styles.balanceFluido
                : dimension.balance === "mas_exigente"
                  ? styles.balanceExigente
                  : undefined
            ]}
          >
            {`· ${relationshipBalanceWord(dimension)!.toLocaleUpperCase("es")}`}
          </Mono>
        ) : null}
      </View>

      <Note style={styles.filaTexto}>{dimension.facilitates}</Note>
      <Note style={styles.filaTexto}>{dimension.strains}</Note>
      <Note style={styles.invitacion}>{dimension.invitation}</Note>

      {dimension.contacts > 0 ? (
        <>
          <Touchable
            onPress={() => setAbierto((valor) => !valor)}
            accessibilityState={{ expanded: abierto }}
            accessibilityLabel={relationshipContactsToggleVoice(dimension)}
            accessibilityHint={
              abierto
                ? "Toca para plegarlos otra vez"
                : "Toca para verlos, ordenados por cuánto pesan"
            }
            style={styles.masContactos}
            pressedStyle={styles.pressed}
          >
            <Label style={styles.masContactosTexto}>
              {abierto
                ? relationshipContactsCollapseLabel(dimension)
                : relationshipContactsToggleLabel(dimension)}
            </Label>
          </Touchable>
          {abierto
            ? dimension.contactsList.map((contacto) => {
                // Qué aporta acá y —si es el mismo id— dónde más cuenta.
                const papel = relationshipContactRole(contacto);
                return (
                  <View key={contacto.id} style={styles.contactoExtra}>
                    <Note>· {contacto.text}</Note>
                    {papel ? <Note style={styles.contactoPapel}>{papel}</Note> : null}
                  </View>
                );
              })
            : null}
        </>
      ) : null}
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
  // El color ACOMPAÑA a la palabra del balance; la palabra ya está escrita, así
  // que quien no distingue cobre de azul lee exactamente lo mismo (QA22-020).
  balanceExigente: { color: v492.colors.harmony },
  balanceFluido: { color: v492.colors.copperSoft },
  blockTop: { marginTop: v492.space.lg },
  borrar: {
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: v492.space.xl,
    minHeight: v492.touch,
    minWidth: v492.touch
  },
  borrarTexto: { color: v492.colors.textDim },
  contactoExtra: { marginTop: v492.space.md },
  contactoPapel: { color: v492.colors.textDim, marginTop: v492.space.xs },
  corto: { color: v492.colors.copperSoft, marginTop: v492.space.md },
  cta: { marginTop: v492.space.lg },
  datos: { color: v492.colors.textDim, marginTop: v492.space.sm },
  dinamica: { marginTop: v492.space.lg },
  dinamicaPapel: { color: v492.colors.textDim, marginTop: v492.space.sm },
  estado: { marginTop: v492.space.md },
  falta: { marginTop: v492.space.xl },
  faltaItem: { marginTop: v492.space.sm },
  faltaLabel: { color: v492.colors.textMuted },
  faltaLabelSiguiente: { marginTop: v492.space.lg },
  fila: { marginTop: v492.space.xl },
  // La fila del dato: cantidad y balance en texto, en el renglón siguiente al
  // rótulo. Sin riel, así que con Dynamic Type grande envuelve hacia abajo y
  // nada compite por el ancho.
  filaBalance: { color: v492.colors.text },
  filaConteo: { color: v492.colors.text },
  filaDato: {
    columnGap: v492.space.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: v492.space.sm
  },
  // Una fila SIN cálculo respira menos que una con texto: es un nombre y una
  // marca, no una lectura.
  filaPendiente: { marginTop: v492.space.lg },
  invitacion: { color: v492.colors.copperSoft, marginTop: v492.space.md },
  precision: { color: v492.colors.textDim, marginTop: v492.space.md },
  resumenCuenta: { marginTop: v492.space.lg },
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
