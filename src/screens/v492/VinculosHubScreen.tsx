import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
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
  RELATIONSHIP_LEVEL_LABEL,
  RELATIONSHIP_LEVEL_NOTE,
  relationshipBirthLine,
  relationshipEditHref,
  relationshipProfileHref,
  VINCULOS_FORM_ROUTE
} from "@/domain/relationships";
import {
  readRelationshipType,
  RELATIONSHIP_TYPE_DEFINE_CTA,
  RELATIONSHIP_TYPE_DEFINE_HINT,
  relationshipTypeChip,
  relationshipTypeDefineVoice,
  relationshipTypeNeedsDefinition
} from "@/domain/relationshipType";
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
 * cuenta. De ahí sale el `profileId` con el que se abre cada perfil: un id nunca
 * se arma en el front.
 *
 * **Acá NO termina el guardado (QA23-005).** Hasta el build 23 el alta volvía a
 * esta raíz con un `?guardada=`, y esta pantalla confirmaba el guardado y
 * arrancaba sola el cálculo de esa fila. Las dos cosas se mudaron al perfil de la
 * persona: guardar aterriza ahí, la confirmación es de esa persona y ningún
 * cálculo empieza por haber guardado. La raíz vuelve a ser lo que dice ser —tu
 * patrón y tu lista—, y por eso no monta `getComparison` ni `refreshComparison`
 * en ninguna de sus filas.
 *
 * Nada de maqueta. Sin sesión, sin datos natales o con el sobre en vuelo se ve
 * el estado correspondiente y nada más.
 */
export function VinculosHubScreen() {
  const layers = useLayers();
  const { phase, bundle, timezone, refresh, refreshing, refreshFailed } = layers;

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
  onRefresh
}: {
  pattern: RelationshipPatternResult;
  timezone: string;
  refreshing: boolean;
  refreshFailed: boolean;
  onRefresh: () => void;
}) {
  const personas = useQuery(relationshipsApi.list, {});

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
        {/* Las personas primero: lo primero del hub es la ACCIÓN — elegir o
            agregar a alguien. El patrón relacional es contexto natal que no
            cambia, y se lee después (decisión de producto, 2026-08-19). */}
        <ModuleHeader
          module="Personas guardadas"
          cadence="se actualiza al guardar"
          intro="Cada persona guardada abre su perfil, y desde ahí, su comparación. Qué se puede comparar depende de los datos que tengas de ella: con el signo alcanza para el estilo general, con la fecha entran las posiciones del día y con hora y lugar exactos, también las casas."
        />
        <PersonasBlock personas={personas} />
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

function PersonasBlock({ personas }: { personas: RelationshipProfile[] | undefined }) {
  if (personas === undefined) return <LoadingBlock message="Buscando tus personas guardadas…" />;
  if (personas.length === 0) {
    return (
      <Card>
        <Body>
          Todavía no guardaste a nadie. Cuando cargues los datos de una persona, su perfil aparece
          acá.
        </Body>
      </Card>
    );
  }
  return (
    <View>
      {personas.map((persona) => (
        <PersonaRow key={persona.profileId} persona={persona} />
      ))}
    </View>
  );
}

/**
 * Una persona guardada. El nombre y el nivel son los del backend, y el enlace
 * usa su `profileId` real: es el mismo id que el perfil va a validar.
 *
 * **La fila abre su PERFIL (QA23-005)**, no su comparación: es la superficie de
 * esa persona —sus datos y su tipo declarado— y desde ahí salen sus dos
 * acciones. Abrir una lista global directo contra un cálculo era lo que hacía
 * que la lectura empezara antes de que nadie la pidiera.
 *
 * Editar sus datos está SIEMPRE, no sólo cuando falta algo (QA22-023): una hora
 * mal cargada mueve las casas y el Ascendente, y hasta el build 22 la única
 * forma de corregirla era borrar a la persona y volver a crearla. Va como una
 * acción aparte y fuera de la tarjeta: la tarjeta entera abre el perfil, y un
 * botón adentro de otro botón no se puede alcanzar con un lector de pantalla.
 */
function PersonaRow({ persona }: { persona: RelationshipProfile }) {
  const nivel = RELATIONSHIP_LEVEL_LABEL[persona.availableLevel];
  const datos = relationshipBirthLine(persona);
  // El tipo declarado, leído sin exigir que el contrato ya lo publique: un
  // backend sin desplegar y una fila legacy dan lo mismo —`null`, sin definir—
  // y la fila reacciona igual.
  const tipo = readRelationshipType(persona);
  const tipoChip = relationshipTypeChip(tipo);
  return (
    <View style={styles.personaRow}>
      <CardButton
        onPress={() => router.push(relationshipProfileHref(persona.profileId) as never)}
        accessibilityLabel={`${persona.name}. ${nivel}.`}
        hint="Abre el perfil de esta persona, con sus datos y su comparación"
      >
        <Subtitle>{persona.name}</Subtitle>
        {datos ? <Mono style={styles.personaMeta}>{datos}</Mono> : null}
        <View style={styles.personaChips}>
          <ChipRow>
            {/* Lo DECLARADO va primero: es de quién se trata. El nivel, que es
                una consecuencia de los datos, va detrás. */}
            {tipoChip ? <Chip label={tipoChip} /> : null}
            <Chip label={nivel} />
          </ChipRow>
        </View>
        <Note style={styles.personaNote}>{RELATIONSHIP_LEVEL_NOTE[persona.availableLevel]}</Note>
      </CardButton>
      {/* Un perfil legacy —guardado antes de que el tipo existiera, o guardado
          sin contestarlo— ofrece definirlo, y NADA MÁS: la fila sigue abriendo
          su perfil, la comparación se puede abrir igual y la lectura existe
          igual, en su versión neutral (QA23-004). */}
      {relationshipTypeNeedsDefinition(tipo) ? (
        <Touchable
          onPress={() => router.push(relationshipEditHref(persona.profileId) as never)}
          accessibilityRole="button"
          accessibilityLabel={relationshipTypeDefineVoice(persona.name)}
          accessibilityHint={RELATIONSHIP_TYPE_DEFINE_HINT}
          style={styles.personaEditar}
          pressedStyle={styles.pressed}
        >
          <Label style={styles.personaDefinirTexto}>{RELATIONSHIP_TYPE_DEFINE_CTA}</Label>
        </Touchable>
      ) : null}
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

const styles = StyleSheet.create({
  cta: { marginTop: v492.space.xl },
  facet: { marginTop: v492.space.md },
  facetSigns: { marginTop: v492.space.sm },
  facetText: { marginTop: v492.space.md },
  facetTitle: { marginTop: v492.space.xs },
  module: { marginTop: v492.space.xxl },
  personaChips: { marginTop: v492.space.md },
  // El CTA de definir el tipo pesa más que "editar datos": es una invitación a
  // completar algo que falta, no una acción de mantenimiento.
  personaDefinirTexto: { color: v492.colors.copperSoft },
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
