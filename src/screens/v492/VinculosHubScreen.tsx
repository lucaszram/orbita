import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { Card, CardButton, Chip, ChipRow, DataRow, ModuleHeader } from "@/components/v492/Module";
import { LayerScreen, Section } from "@/components/v492/Screen";
import { LimitationList, MissingBlock, StaleNotice, StatusLine } from "@/components/v492/Status";
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
  relationshipBirthLine
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
          intro="Cada persona guardada abre su comparación. Qué se puede comparar depende de los datos que tengas de ella: con el signo alcanza para el estilo general, con la fecha entran las posiciones del día y con hora y lugar exactos, también las casas."
        />
        <PersonasBlock personas={personas} />
        <View style={styles.cta}>
          <PrimaryButton
            label="AGREGAR UNA PERSONA"
            accessibilityLabel="Agregar una persona a Vínculos"
            onPress={() => router.push("/vinculos/conectar" as never)}
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
          Todavía no guardaste a nadie. Cuando cargues los datos de una persona, su comparación
          aparece acá.
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
 * usa su `profileId` real: es el mismo id que la comparación va a validar.
 */
function PersonaRow({ persona }: { persona: RelationshipProfile }) {
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
          </ChipRow>
        </View>
        <Note style={styles.personaNote}>{RELATIONSHIP_LEVEL_NOTE[persona.availableLevel]}</Note>
      </CardButton>
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
  personaMeta: { marginTop: v492.space.xs },
  personaNote: { marginTop: v492.space.md },
  personaRow: { marginTop: v492.space.md },
  scope: { marginTop: v492.space.lg },
  scopeNote: { marginTop: v492.space.md }
});
