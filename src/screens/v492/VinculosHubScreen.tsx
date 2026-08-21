import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAction, useQuery } from "convex/react";
import { Card, CardButton, Chip, ChipRow, DataRow, ModuleHeader } from "@/components/v492/Module";
import { LayerScreen, Section } from "@/components/v492/Screen";
import { LimitationList, MissingBlock, StaleNotice, StatusLine } from "@/components/v492/Status";
import { Touchable } from "@/components/v492/Touchable";
import {
  EmptyBlock,
  ErrorBlock,
  GuestBlock,
  LoadingBlock,
  PrimaryButton
} from "@/components/v492/States";
import { TraceAccordion } from "@/components/v492/Trace";
import { Body, Label, Mono, Note, Subtitle } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { anyStale, hasData, latestObservedAt } from "@/domain/layers";
import {
  relationshipCalcKey,
  relationshipCalcNote,
  relationshipCalcPhase,
  relationshipNeedsCalculation,
  relationshipRowCanRetry
} from "@/domain/relationshipCalc";
import {
  findRelationshipProfile,
  RELATIONSHIP_LEVEL_LABEL,
  RELATIONSHIP_LEVEL_NOTE,
  RELATIONSHIP_SAVED_MODE_PARAM,
  RELATIONSHIP_SAVED_PARAM,
  relationshipBirthLine,
  relationshipEditHref,
  relationshipSavedConfirmation,
  relationshipSavedMode,
  VINCULOS_FORM_ROUTE
} from "@/domain/relationships";
import { useLayers } from "@/hooks/useLayers";
import type {
  RelationshipAxis,
  RelationshipPatternData,
  RelationshipPatternFacet,
  RelationshipPatternResult
} from "@/services/layersApi";
import { relationshipsApi, type RelationshipProfile } from "@/services/relationshipsApi";

/**
 * Vínculos — raíz de la pestaña (sistema V4.9.2).
 *
 * Dos cosas, en este orden: TU patrón relacional y las personas que guardaste.
 *
 * El patrón es la capa natal `ORB-REL-001` del sobre compartido
 * (`useLayers().bundle.natal.relationshipPattern`): tres facetas reales —Luna,
 * Venus y Marte— y, sólo cuando la hora de nacimiento es exacta y hay doce
 * casas verificadas, el eje relacional (Descendente y casa 7). Si el eje no
 * existe no se estima ni se deja el hueco: el módulo declara su estado y la
 * lista de límites dice por qué falta.
 *
 * Las personas salen de `relationships.list`, que es la lista autorizada de la
 * cuenta. De ahí sale el `profileId` con el que se abre cada comparación: un id
 * nunca se arma en el front.
 *
 * **Acá termina el guardado (QA22-015).** Guardar una persona vuelve a esta
 * pantalla con su nombre confirmado y su fila a la vista; abrir la comparación
 * es una acción explícita. Y si esa comparación todavía se está generando, lo
 * dice SU fila —no la pantalla— con su propio reintento acotado (QA22-016): la
 * lista, el patrón y el botón de agregar siguen usables todo el tiempo.
 *
 * Nada de maqueta. Sin sesión, sin datos natales o con el sobre en vuelo se ve
 * el estado correspondiente y nada más.
 */
export function VinculosHubScreen() {
  const layers = useLayers();
  const { phase, bundle, timezone, refresh, refreshing, refreshFailed } = layers;
  // Qué persona se acaba de guardar, si es que se viene de guardar una. Es un
  // string de URL: sólo vale si aparece en la lista autorizada de la cuenta.
  // Un parámetro repetido llega como arreglo, y un id ambiguo no es un id: cae
  // en `null` y la pantalla es la de siempre.
  const params = useLocalSearchParams();
  const guardadaCruda = params[RELATIONSHIP_SAVED_PARAM];
  const modoCrudo = params[RELATIONSHIP_SAVED_MODE_PARAM];

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
  // Sin carta propia no hay patrón relacional ni comparación posible: guardar
  // personas antes de eso sería juntar datos que no se pueden leer.
  if (phase === "vacio" || !bundle) {
    return (
      <Shell>
        <EmptyBlock />
      </Shell>
    );
  }

  return (
    <VinculosHubLive
      pattern={bundle.natal.relationshipPattern}
      timezone={timezone}
      refreshing={refreshing}
      refreshFailed={refreshFailed}
      onRefresh={refresh}
      guardada={typeof guardadaCruda === "string" ? guardadaCruda.trim() : null}
      modo={relationshipSavedMode(modoCrudo)}
    />
  );
}

function Shell({
  children,
  meta,
  onRefresh,
  refreshing
}: {
  children: ReactNode;
  meta?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <LayerScreen
      eyebrow="VÍNCULOS · TU PATRÓN Y TUS PERSONAS"
      title="Vínculos"
      meta={meta}
      onRefresh={onRefresh}
      refreshing={refreshing}
    >
      {children}
    </LayerScreen>
  );
}

/**
 * La lista de personas sólo se pide con sesión confirmada: `relationships.list`
 * necesita la fila `users` creada, y la fase ya la garantizó.
 */
function VinculosHubLive({
  pattern,
  timezone,
  refreshing,
  refreshFailed,
  onRefresh,
  guardada,
  modo
}: {
  pattern: RelationshipPatternResult;
  timezone: string;
  refreshing: boolean;
  refreshFailed: boolean;
  onRefresh: () => void;
  /** El `profileId` que acaba de guardarse, tal como llegó por la URL. */
  guardada: string | null;
  modo: "alta" | "edicion" | null;
}) {
  const personas = useQuery(relationshipsApi.list, {});
  // La confirmación se puede cerrar; el estado de SU lectura no depende de eso.
  const [confirmacionCerrada, setConfirmacionCerrada] = useState(false);
  // El id de la URL vale lo que valga en TU lista: es la misma conversión que
  // usan el formulario y la comparación.
  const reciente = findRelationshipProfile(personas, guardada);

  return (
    <Shell meta={metaPersonas(personas)} onRefresh={onRefresh} refreshing={refreshing}>
      {/* El patrón puede llegar `stale` sin que el recálculo de esta sesión
          haya fallado: el backend ya lo había marcado. En los dos casos lo que
          se lee es el último cálculo guardado, así que en los dos se avisa y se
          lo fecha. */}
      {refreshFailed || anyStale([pattern]) ? (
        <Section>
          <StaleNotice
            observedAt={latestObservedAt([pattern])}
            timezone={timezone}
            onRetry={onRefresh}
          />
        </Section>
      ) : null}

      <Section>
        {/* Guardar terminó, y se dice. Antes el alta saltaba directo a la
            lectura y no había ningún momento en el que constara que la persona
            había quedado en la lista (QA22-015). */}
        {reciente && !confirmacionCerrada ? (
          <View style={styles.confirmacion} accessibilityLiveRegion="polite">
            <Label style={styles.confirmacionLabel}>
              {modo === "edicion" ? "DATOS ACTUALIZADOS" : "PERSONA GUARDADA"}
            </Label>
            <Body style={styles.confirmacionTexto}>
              {relationshipSavedConfirmation(reciente.name, modo ?? "alta")}
            </Body>
            <Touchable
              onPress={() => setConfirmacionCerrada(true)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar esta confirmación"
              style={styles.confirmacionCerrar}
              pressedStyle={styles.pressed}
            >
              <Label style={styles.confirmacionCerrarTexto}>ENTENDIDO</Label>
            </Touchable>
          </View>
        ) : null}

        {/* Las personas primero: lo primero del hub es la ACCIÓN — elegir o
            agregar a alguien. El patrón relacional es contexto natal que no
            cambia, y se lee después (decisión de producto, 2026-08-19). */}
        <ModuleHeader
          module="Personas guardadas"
          cadence="se actualiza al guardar"
          intro="Cada persona guardada abre su comparación. Qué se puede comparar depende de los datos que tengas de ella: con el signo alcanza para el estilo general, con la fecha entran las posiciones del día y con hora y lugar exactos, también las casas."
        />
        <PersonasBlock personas={personas} recienteId={reciente?.profileId ?? null} />
        <View style={styles.cta}>
          <PrimaryButton
            label="AGREGAR UNA PERSONA"
            accessibilityLabel="Agregar una persona a Vínculos"
            onPress={() => router.push(VINCULOS_FORM_ROUTE as never)}
          />
        </View>

        <View style={styles.module}>
          <ModuleHeader
            module="Tu patrón relacional"
            cadence="natal · no cambia"
            intro="Reúne los tres puntos de tu carta que describen cómo te vinculás: la Luna, Venus y Marte. Con hora de nacimiento exacta suma el Descendente y la casa 7."
          />
          <StatusLine status={pattern.status} precision={pattern.precision} />
          {hasData(pattern) && pattern.data ? (
            <>
              <PatternBody data={pattern.data} />
              <LimitationList limitations={pattern.limitations} />
            </>
          ) : (
            <MissingBlock envelope={pattern} />
          )}
          <TraceAccordion
            envelope={pattern}
            timezone={timezone}
            calculatedDatum="El signo de tu Luna, de tu Venus y de tu Marte y, sólo con hora exacta y doce casas verificadas, el signo de tu Descendente y los planetas que caen en tu casa 7."
            interpretiveRule="Cada punto describe una tendencia distinta: la Luna, cómo procesás lo emocional; Venus, cómo das y recibís afecto; Marte, cómo vas hacia el deseo. Es un mapa de tendencias de tu carta, no un diagnóstico de tu forma de vincularte."
          />
        </View>
      </Section>
    </Shell>
  );
}

/** "3 personas guardadas" — el recuento real, o nada mientras la lista viaja. */
function metaPersonas(personas: RelationshipProfile[] | undefined): string | undefined {
  if (personas === undefined) return undefined;
  if (personas.length === 0) return undefined;
  return personas.length === 1 ? "1 persona guardada" : `${personas.length} personas guardadas`;
}

function PatternBody({ data }: { data: RelationshipPatternData }) {
  return (
    <View>
      {data.facets.map((facet) => (
        <FacetCard key={facet.key} facet={facet} />
      ))}
      {/* El eje relacional se muestra SÓLO cuando existe. Sin hora exacta el
          backend no lo publica, y una casa 7 estimada no es una casa 7. */}
      {data.relationshipAxis ? <AxisCard axis={data.relationshipAxis} /> : null}
      <Card style={styles.scope}>
        <DataRow label="ENTRA EN EL MAPA" value={<Mono>{data.includedPoints.join(" · ")}</Mono>} />
        {data.excludedPoints.length > 0 ? (
          <DataRow label="QUEDA AFUERA" value={<Mono>{data.excludedPoints.join(" · ")}</Mono>} />
        ) : null}
        <Note style={styles.scopeNote}>{data.summary}</Note>
      </Card>
    </View>
  );
}

/**
 * Una faceta: el punto, qué describe y en qué signo está.
 *
 * Los signos van en plural cuando el sobre trae más de uno: sin hora exacta la
 * Luna puede haber cambiado de signo durante el día y el método conserva las
 * dos posibilidades en vez de elegir una. El texto del sobre ya lo explica.
 */
function FacetCard({ facet }: { facet: RelationshipPatternFacet }) {
  return (
    <Card style={styles.facet}>
      <Label>{facet.label}</Label>
      <Subtitle style={styles.facetTitle}>{facet.title}</Subtitle>
      {facet.signs.length > 0 ? (
        <Mono style={styles.facetSigns}>{facet.signs.join(" o ")}</Mono>
      ) : null}
      <Body style={styles.facetText}>{facet.summary}</Body>
    </Card>
  );
}

function AxisCard({ axis }: { axis: RelationshipAxis }) {
  return (
    <Card style={styles.facet}>
      <Label>EJE RELACIONAL</Label>
      <Subtitle style={styles.facetTitle}>Descendente en {axis.descendantSign}</Subtitle>
      {/* Una casa 7 verificada y vacía es un dato, no un hueco: se dice. */}
      {axis.house7Planets.length > 0 ? (
        <Mono style={styles.facetSigns}>{`En tu casa 7: ${axis.house7Planets.join(" · ")}`}</Mono>
      ) : (
        <Mono style={styles.facetSigns}>No hay planetas en tu casa 7.</Mono>
      )}
      <Body style={styles.facetText}>{axis.summary}</Body>
    </Card>
  );
}

function PersonasBlock({
  personas,
  recienteId
}: {
  personas: RelationshipProfile[] | undefined;
  /** La persona que se acaba de guardar: es la única cuya lectura se vigila. */
  recienteId: RelationshipProfile["profileId"] | null;
}) {
  if (personas === undefined) return <LoadingBlock message="Buscando tus personas guardadas…" />;
  if (personas.length === 0) {
    return (
      <Card>
        <Body>
          Todavía no guardaste a nadie. Cuando cargues los datos de una persona, su comparación
          aparece acá.
        </Body>
      </Card>
    );
  }
  return (
    <View>
      {personas.map((persona) => (
        <PersonaRow
          key={persona.profileId}
          persona={persona}
          reciente={persona.profileId === recienteId}
        />
      ))}
    </View>
  );
}

/**
 * Una persona guardada. El nombre y el nivel son los del backend, y el enlace
 * usa su `profileId` real: es el mismo id que la comparación va a validar.
 *
 * Editar sus datos está SIEMPRE, no sólo cuando falta algo (QA22-023): una hora
 * mal cargada mueve las casas y el Ascendente, y hasta el build 22 la única
 * forma de corregirla era borrar a la persona y volver a crearla. Va como una
 * acción aparte y fuera de la tarjeta: la tarjeta entera abre la comparación, y
 * un botón adentro de otro botón no se puede alcanzar con un lector de pantalla.
 */
function PersonaRow({ persona, reciente }: { persona: RelationshipProfile; reciente: boolean }) {
  const nivel = RELATIONSHIP_LEVEL_LABEL[persona.availableLevel];
  const datos = relationshipBirthLine(persona);
  return (
    <View style={styles.personaRow}>
      <CardButton
        onPress={() => router.push(`/vinculos/${persona.profileId}` as never)}
        accessibilityLabel={`${persona.name}. ${nivel}.`}
        hint="Abre la comparación con esta persona"
      >
        <Subtitle>{persona.name}</Subtitle>
        {datos ? <Mono style={styles.personaMeta}>{datos}</Mono> : null}
        <View style={styles.personaChips}>
          <ChipRow>
            <Chip label={nivel} />
            {reciente ? <Chip label="RECIÉN GUARDADA" /> : null}
          </ChipRow>
        </View>
        <Note style={styles.personaNote}>{RELATIONSHIP_LEVEL_NOTE[persona.availableLevel]}</Note>
      </CardButton>
      {reciente ? <EstadoLectura persona={persona} /> : null}
      <Touchable
        onPress={() => router.push(relationshipEditHref(persona.profileId) as never)}
        accessibilityRole="button"
        accessibilityLabel={`Editar datos de ${persona.name}`}
        accessibilityHint="Abre su formulario con los datos que ya cargaste"
        style={styles.personaEditar}
        pressedStyle={styles.pressed}
      >
        <Label style={styles.personaEditarTexto}>{`EDITAR DATOS DE ${persona.name.toLocaleUpperCase("es")}`}</Label>
      </Touchable>
    </View>
  );
}

/**
 * El estado del CÁLCULO de una persona, dicho en su fila (QA22-016).
 *
 * Guardar y calcular son dos cosas: la persona ya está guardada —está acá, con
 * sus datos— y lo único que puede faltar es su comparación. Por eso este bloque
 * es del tamaño de una fila y no reemplaza nada: la raíz sigue entera y usable
 * mientras el proveedor trabaja.
 *
 * El reintento automático es UNO por estado del sobre (`relationshipCalcKey`), y
 * el manual está acotado: si dos intentos no alcanzaron, la salida es su lectura
 * —que tiene el estado completo, los límites y de quién es el dato que falta—,
 * no un botón que se puede tocar para siempre.
 */
function EstadoLectura({ persona }: { persona: RelationshipProfile }) {
  const comparison = useQuery(relationshipsApi.getComparison, { profileId: persona.profileId });
  const refreshComparison = useAction(relationshipsApi.refreshComparison);

  const [corriendo, setCorriendo] = useState(false);
  const [ultimo, setUltimo] = useState<{ clave: string; fallo: boolean } | null>(null);
  const [reintentos, setReintentos] = useState(0);
  // Una sola corrida a la vez: el automático y el botón entran por la misma
  // puerta, así que tocar REINTENTAR mientras el efecto ya está pidiendo no
  // dispara una segunda acción.
  const enVuelo = useRef<Promise<void> | null>(null);
  const automatico = useRef<string | null>(null);

  const clave =
    comparison === undefined
      ? null
      : relationshipCalcKey({
          profileId: persona.profileId,
          level: persona.availableLevel,
          inputHash: comparison.inputHash
        });

  const calcular = useCallback(
    (claveActual: string) => {
      const enCurso = enVuelo.current;
      if (enCurso) return enCurso;
      setCorriendo(true);
      const corrida = refreshComparison({ profileId: persona.profileId })
        .then(() => setUltimo({ clave: claveActual, fallo: false }))
        .catch(() => setUltimo({ clave: claveActual, fallo: true }))
        .finally(() => {
          enVuelo.current = null;
          setCorriendo(false);
        });
      enVuelo.current = corrida;
      return corrida;
    },
    [persona.profileId, refreshComparison]
  );

  useEffect(() => {
    if (clave === null || comparison === undefined) return;
    if (!relationshipNeedsCalculation(comparison)) return;
    if (automatico.current === clave) return;
    automatico.current = clave;
    void calcular(clave);
  }, [clave, comparison, calcular]);

  const intento = ultimo !== null && ultimo.clave === clave ? ultimo : null;
  const fase = relationshipCalcPhase({
    comparison,
    running: corriendo,
    failed: intento?.fallo === true,
    attempted: intento !== null
  });
  const nota = relationshipCalcNote(fase);
  // Lista es el estado normal y no se anuncia: la fila ya abre la comparación.
  if (nota === null) return null;

  const detenida = fase === "error" || fase === "pendiente";
  const puedeReintentar = detenida && relationshipRowCanRetry(reintentos);
  return (
    <View style={styles.lectura} accessibilityLiveRegion="polite">
      <Note style={styles.lecturaNota}>{nota}</Note>
      {puedeReintentar && clave !== null ? (
        <Touchable
          onPress={() => {
            setReintentos((valor) => valor + 1);
            void calcular(clave);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Reintentar la lectura de ${persona.name}`}
          style={styles.lecturaReintento}
          pressedStyle={styles.pressed}
        >
          <Label style={styles.lecturaReintentoTexto}>REINTENTAR SU LECTURA</Label>
        </Touchable>
      ) : null}
      {detenida && !puedeReintentar ? (
        <Note style={styles.lecturaNota}>
          Abrí su comparación para volver a intentarlo: ahí está el estado completo del cálculo y
          qué dato falta.
        </Note>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  confirmacion: {
    borderColor: v492.colors.copper,
    borderRadius: v492.radius.md,
    borderWidth: 1,
    marginBottom: v492.space.xl,
    padding: v492.space.lg
  },
  confirmacionCerrar: {
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: v492.space.md,
    minHeight: v492.touch,
    minWidth: v492.touch
  },
  confirmacionCerrarTexto: { color: v492.colors.copperSoft },
  confirmacionLabel: { color: v492.colors.copperSoft },
  confirmacionTexto: { marginTop: v492.space.sm },
  cta: { marginTop: v492.space.xl },
  facet: { marginTop: v492.space.md },
  facetSigns: { marginTop: v492.space.sm },
  facetText: { marginTop: v492.space.md },
  facetTitle: { marginTop: v492.space.xs },
  lectura: { marginTop: v492.space.md },
  lecturaNota: { marginTop: v492.space.xs },
  lecturaReintento: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: v492.touch,
    minWidth: v492.touch
  },
  lecturaReintentoTexto: { color: v492.colors.copperSoft },
  module: { marginTop: v492.space.xxl },
  personaChips: { marginTop: v492.space.md },
  personaEditar: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: v492.touch,
    minWidth: v492.touch
  },
  personaEditarTexto: { color: v492.colors.textDim },
  personaMeta: { marginTop: v492.space.xs },
  personaNote: { marginTop: v492.space.md },
  personaRow: { marginTop: v492.space.md },
  pressed: { opacity: 0.7 },
  scope: { marginTop: v492.space.lg },
  scopeNote: { marginTop: v492.space.md }
});
