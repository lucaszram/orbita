import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import { Card, Chip, ChipRow, DataRow, ModuleHeader } from "@/components/v492/Module";
import { DetailLayerScreen, Section } from "@/components/v492/Screen";
import { Touchable } from "@/components/v492/Touchable";
import {
  EmptyBlock,
  ErrorBlock,
  GuestBlock,
  LoadingBlock,
  PrimaryButton
} from "@/components/v492/States";
import { Body, Label, Mono, Note, Subtitle } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import {
  findRelationshipProfile,
  RELATIONSHIP_LEVEL_HEADLINE,
  RELATIONSHIP_LEVEL_NOTE,
  RELATIONSHIP_SAVED_MODE_PARAM,
  relationshipBirthLine,
  relationshipComparisonHref,
  relationshipEditHref,
  relationshipLevelBadge,
  relationshipSavedConfirmation,
  relationshipSavedMode,
  VINCULOS_ROUTE,
  type RelationshipSaveMode
} from "@/domain/relationships";
import {
  readRelationshipType,
  RELATIONSHIP_TYPE_DEFINE_CTA,
  RELATIONSHIP_TYPE_DEFINE_HINT,
  RELATIONSHIP_TYPE_FIELD_LABEL,
  relationshipTypeChip,
  relationshipTypeDefineVoice,
  relationshipTypeLine,
  relationshipTypeNeedsDefinition
} from "@/domain/relationshipType";
import { useLayers } from "@/hooks/useLayers";
import { relationshipsApi, type RelationshipProfile } from "@/services/relationshipsApi";

/**
 * Vínculos · el PERFIL canónico de una persona (`/vinculos/[profileId]`).
 *
 * ## Qué defecto cierra (QA23-005)
 *
 * Hasta el build 23 esta ruta ERA la comparación, y guardar volvía a la raíz de
 * la sección con un `?guardada=` (QA22-015). Las dos cosas juntas dejaban al alta
 * sin un lugar propio: quien acababa de cargar a alguien aterrizaba en una lista
 * global —donde su persona es una fila más entre otras— y la única superficie que
 * la nombraba era una lectura que todavía se estaba calculando. Encima la raíz
 * arrancaba sola el cálculo de esa fila, así que guardar y calcular volvían a
 * verse como una sola espera.
 *
 * Ahora hay una superficie por cosa:
 *
 * - **El perfil (acá)** — quién es esa persona: sus datos canónicos tal como
 *   quedaron guardados y el tipo de vínculo declarado. Es donde aterrizan el alta
 *   y la edición, con una confirmación breve.
 * - **La comparación** — una ruta HIJA (`/vinculos/[profileId]/comparacion`), que
 *   se abre a mano. Volver de ella cae acá, no en la raíz.
 *
 * ## Tres reglas
 *
 * 1. **El id de la URL no es un id.** Llega como string y sólo vale si aparece en
 *    `relationships.list`, la lista autorizada de la cuenta. Un enlace ajeno o
 *    viejo no muestra NADA de esa persona: ni el nombre, ni el signo, ni la
 *    fecha. Nunca se convierte por conversión de tipos.
 * 2. **Esta pantalla no calcula nada.** No monta `getComparison` ni
 *    `refreshComparison`: guardar no dispara una comparación, y el cálculo
 *    empieza cuando alguien abre la comparación. Es lo que hace que la
 *    confirmación del guardado sea sobre el guardado y sobre nada más.
 * 3. **Dos acciones, y esas dos.** `VER LA COMPARACIÓN` y `EDITAR DATOS`. Un
 *    perfil legacy —sin tipo declarado— suma `DEFINIR TIPO DE VÍNCULO`, que es
 *    una invitación y no una puerta: todo lo demás funciona igual sin ella
 *    (QA23-004).
 */
export function VinculosProfileScreen({ profileId }: { profileId: string }) {
  // Misma fase que el resto de Vínculos: sin sesión no hay lista autorizada y sin
  // carta propia no hay contra qué comparar a nadie.
  const { phase, retrySession } = useLayers();

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
  return <VinculosProfileLive profileId={profileId} />;
}

/**
 * El marco. El respaldo sin historial es la RAÍZ de la sección: el perfil cuelga
 * de ella y un deep link directo no tiene nada debajo.
 */
function Shell({ children }: { children: ReactNode }) {
  return (
    <DetailLayerScreen eyebrow="VÍNCULOS · PERFIL" fallbackHref={VINCULOS_ROUTE}>
      {children}
    </DetailLayerScreen>
  );
}

/**
 * Resuelve a QUIÉN pertenece este perfil ANTES de mostrar un solo dato.
 *
 * Es la misma conversión que usan la comparación y el formulario
 * (`findRelationshipProfile`), y por eso aceptan y rechazan exactamente lo
 * mismo: `undefined` mientras la lista viaja, `null` cuando ese id no está en
 * ella. En los dos casos la pantalla no publica nada de nadie.
 */
function VinculosProfileLive({ profileId }: { profileId: string }) {
  const personas = useQuery(relationshipsApi.list, {});
  const persona = findRelationshipProfile(personas, profileId);
  // Qué guardado acaba de terminar, si es que se viene de guardar uno. Es un
  // string de URL y sólo vale si es uno de los dos modos; un parámetro repetido
  // llega como arreglo y un modo ambiguo no es un modo.
  const params = useLocalSearchParams();
  const modo = relationshipSavedMode(params[RELATIONSHIP_SAVED_MODE_PARAM]);

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
          <View style={styles.cta}>
            <PrimaryButton
              label="VOLVER A TUS PERSONAS"
              accessibilityLabel="Volver a tus personas guardadas"
              onPress={() => router.replace(VINCULOS_ROUTE as never)}
              align="start"
            />
          </View>
        </Section>
      </Shell>
    );
  }

  return <PerfilCanonico persona={persona} modo={modo} />;
}

function PerfilCanonico({
  persona,
  modo
}: {
  persona: RelationshipProfile;
  /** `alta` o `edicion` si se viene de guardar; `null` si se entró por la lista. */
  modo: RelationshipSaveMode | null;
}) {
  // La confirmación se puede cerrar; nada más de la pantalla depende de eso.
  const [confirmacionCerrada, setConfirmacionCerrada] = useState(false);
  // El tipo declarado, leído sin exigir que el contrato ya lo publique: un
  // backend sin desplegar y una fila legacy dan lo mismo —`null`, sin definir—.
  const tipo = readRelationshipType(persona);
  const tipoChip = relationshipTypeChip(tipo);
  const nivel = persona.availableLevel;
  const datos = relationshipBirthLine(persona);
  const nombre = persona.name.trim() || "esta persona";

  const verComparacion = () =>
    router.push(relationshipComparisonHref(persona.profileId) as never);
  const editarDatos = () => router.push(relationshipEditHref(persona.profileId) as never);

  return (
    <Shell>
      <Section>
        {/* Guardar terminó, y se dice ACÁ: en la superficie de la persona que se
            acaba de guardar. La confirmación es breve y no promete un cálculo
            que nadie arrancó (QA23-005). */}
        {modo && !confirmacionCerrada ? (
          <View style={styles.confirmacion} accessibilityLiveRegion="polite">
            <Label style={styles.confirmacionLabel}>
              {modo === "edicion" ? "DATOS ACTUALIZADOS" : "PERSONA GUARDADA"}
            </Label>
            <Body style={styles.confirmacionTexto}>
              {relationshipSavedConfirmation(persona.name, modo)}
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

        <ModuleHeader
          module={`Los datos de ${nombre}`}
          cadence="se actualiza al guardar"
          intro="Esto es lo que quedó guardado de esta persona, tal cual. Lo que no cargaste no se completa solo, y el nivel de la comparación sale de estos datos."
        />

        <Subtitle style={styles.nombre}>{persona.name}</Subtitle>
        <View style={styles.chips}>
          <ChipRow>
            {/* Lo DECLARADO va primero: es de quién se trata. El nivel, que es una
                consecuencia de los datos, va detrás. */}
            {tipoChip ? <Chip label={tipoChip} /> : null}
            <Chip label={`${relationshipLevelBadge(nivel)} · ${RELATIONSHIP_LEVEL_HEADLINE[nivel]}`} />
          </ChipRow>
        </View>

        <Card style={styles.datos}>
          <DataRow
            label={RELATIONSHIP_TYPE_FIELD_LABEL}
            value={<Mono>{tipoChip ?? "SIN DEFINIR"}</Mono>}
          />
          <DataRow
            label="DATOS DE NACIMIENTO"
            value={<Mono>{datos ?? "Todavía no cargaste ninguno."}</Mono>}
          />
          <DataRow
            label="NIVEL DE DATOS"
            value={
              <Mono>{`${relationshipLevelBadge(nivel)} · ${RELATIONSHIP_LEVEL_HEADLINE[nivel]}`}</Mono>
            }
          />
        </Card>
        <Note style={styles.nivelNota}>{RELATIONSHIP_LEVEL_NOTE[nivel]}</Note>

        {/* Qué vínculo se declaró y qué implica. Un perfil legacy ofrece definirlo
            acá mismo, sin bloquear nada: la comparación se abre igual y se lee en
            su versión neutral (QA23-004). */}
        <Note style={styles.tipoLinea}>{relationshipTypeLine(tipo)}</Note>
        {relationshipTypeNeedsDefinition(tipo) ? (
          <Touchable
            onPress={editarDatos}
            accessibilityRole="button"
            accessibilityLabel={relationshipTypeDefineVoice(persona.name)}
            accessibilityHint={RELATIONSHIP_TYPE_DEFINE_HINT}
            style={styles.tipoDefinir}
            pressedStyle={styles.pressed}
          >
            <Label style={styles.tipoDefinirTexto}>{RELATIONSHIP_TYPE_DEFINE_CTA}</Label>
          </Touchable>
        ) : null}

        {/* Las DOS acciones del perfil, y ninguna más. La comparación es una ruta
            hija y se abre a mano: nada se calcula por haber entrado acá. */}
        <View style={styles.cta}>
          <PrimaryButton
            label="VER LA COMPARACIÓN"
            accessibilityLabel={`Ver la comparación con ${nombre}`}
            accessibilityHint="Abre la comparación entre tu carta y la suya. El cálculo empieza al abrirla."
            onPress={verComparacion}
            align="start"
          />
        </View>
        <View style={styles.cta}>
          <PrimaryButton
            label="EDITAR DATOS"
            accessibilityLabel={`Editar los datos de ${nombre}`}
            accessibilityHint="Abre su formulario con los datos que ya cargaste. El nivel de la comparación sale de esos datos."
            onPress={editarDatos}
            align="start"
          />
        </View>
      </Section>
    </Shell>
  );
}

const styles = StyleSheet.create({
  blockTop: { marginTop: v492.space.lg },
  chips: { marginTop: v492.space.md },
  confirmacion: {
    borderColor: v492.colors.copper,
    borderRadius: v492.radius.md,
    borderWidth: 1,
    marginBottom: v492.space.xl,
    marginTop: v492.space.lg,
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
  cta: { marginTop: v492.space.lg },
  datos: { marginTop: v492.space.lg },
  nivelNota: { marginTop: v492.space.md },
  nombre: { marginTop: v492.space.lg },
  pressed: { opacity: 0.7 },
  tipoDefinir: {
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: v492.space.sm,
    minHeight: v492.touch,
    minWidth: v492.touch
  },
  tipoDefinirTexto: { color: v492.colors.copperSoft },
  tipoLinea: { marginTop: v492.space.xl }
});
