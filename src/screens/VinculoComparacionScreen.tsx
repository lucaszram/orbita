/**
 * **Vínculos · Comparación** — la comparación real entre la carta propia y la
 * de la persona guardada (CORE-212). Frames `1757:2674` (390) y `1757:2515`
 * (1440): chips de las dos cartas, precisión, titular con el conteo, barras
 * por tono, «Por dimensión», contactos principales y —en Free— cuántos quedan
 * en Plus.
 *
 * Todo sale de `relationships.synastry`. No hay porcentaje de
 * compatibilidad: son contactos reales (aspectos mayores dentro de orbe) y sus
 * conteos. Con nivel «signo» no hay contactos: se lee el tono entre elementos
 * y la pantalla dice qué haría falta para ver más.
 */
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import { DetailScreen } from "@/components/home/DetailScreen";
import { Column, Columns } from "@/components/orbita/Layout";
import { GuestState } from "@/components/orbita/GuestState";
import { EmptyState, ErrorState, MinimalLoading } from "@/components/orbita/states";
import { VBarra, VBoton, VCerco, VEtiqueta, VNota, VPersonaChip, VTarjeta, VTexto, VTitular } from "@/components/vinculos/VinculosUI";
import { escalaDeDimensiones, inicial, perfilIdValido, titularDeContactos } from "@/domain/vinculo";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import { useLiveApp } from "@/hooks/useLiveApp";
import { appCoreApi, type VinculoComparacion, type VinculoContacto } from "@/services/appCoreRefs";
import { orbita } from "@/theme/orbita";

const COLOR_TONO = { armonico: orbita.colors.harmony, tenso: orbita.colors.tension, fusion: orbita.colors.copperSoft } as const;
const NOMBRE_TONO = { armonico: "Armónico", tenso: "Tenso", fusion: "Fusión" } as const;

export function VinculoComparacionScreen() {
  const { isLive, isAuthLoading, userError, retryUser, auth } = useLiveApp();
  const guest = !isAuthLoading && !userError && !auth?.isSignedIn;
  return (
    <DetailScreen eyebrow="Vínculos · Comparación" canvas="wide">
      {userError ? (
        <ErrorState onRetry={retryUser} />
      ) : guest ? (
        <GuestState eyebrow="VÍNCULOS" title={"Dos cartas,\nun cielo."} body="Entrá para comparar tu carta con la de otra persona." />
      ) : !isLive ? (
        <MinimalLoading />
      ) : (
        <VCerco fallback={(reintentar) => <ErrorState onRetry={reintentar} />}>
          <ComparacionViva />
        </VCerco>
      )}
    </DetailScreen>
  );
}

function ComparacionViva() {
  // `?id=` abre la comparación de una persona concreta de la biblioteca
  // (CORE-213); sin id, la activa. Un id que no es de la cuenta responde
  // `no_person`: nunca otra persona en su lugar.
  const params = useLocalSearchParams<{ id?: string }>();
  const profileId = perfilIdValido(params.id);
  const comparacion = useQuery(appCoreApi.relationships.synastry, profileId ? { profileId } : {});
  if (comparacion === undefined) return <MinimalLoading />;
  if (comparacion.status === "no_person") {
    return (
      <EmptyState
        eyebrow="VÍNCULOS"
        title={"Todavía no guardaste\na nadie."}
        body="La comparación necesita una persona. Guardala desde Vínculos y volvé acá."
        cta="IR A VÍNCULOS"
        onCta={() => router.replace("/vinculo")}
      />
    );
  }
  if (comparacion.status === "needs_natal_chart") {
    return (
      <EmptyState
        eyebrow="VÍNCULOS"
        title={"Primero,\ntu carta."}
        body={`Guardamos a ${comparacion.person.name}, pero tu carta natal todavía no está calculada. Cuando esté, la comparación aparece sola.`}
        cta="VOLVER"
        onCta={() => (router.canGoBack() ? router.back() : router.replace("/vinculo"))}
      />
    );
  }
  if (comparacion.status === "person_chart_unavailable") {
    return (
      <EmptyState
        eyebrow="VÍNCULOS"
        title={"Su carta no llegó."}
        body={`Guardamos a ${comparacion.person.name}, pero el cálculo de su carta no respondió. No inventamos contactos: probá de nuevo más tarde.`}
        cta="VOLVER"
        onCta={() => (router.canGoBack() ? router.back() : router.replace("/vinculo"))}
      />
    );
  }
  return <Comparacion c={comparacion} />;
}

function Comparacion({ c }: { c: Extract<VinculoComparacion, { status: "ready" }> }) {
  const desktop = useIsDesktop();
  const nombre = c.person.name;
  const total = c.summary.total;
  const esSigno = c.precision.level === "signo";
  const escalaTono = Math.max(1, total);
  const escalaDim = escalaDeDimensiones(c.summary);
  const restantes = c.hiddenContacts;

  const izquierda = (
    <View>
      <View style={styles.chips}>
        <VPersonaChip inicial="TU" nombre="Tu carta" tono="cobre" />
        <VPersonaChip inicial={inicial(nombre)} nombre={nombre} tono="azul" />
      </View>
      <VEtiqueta tono="gris" style={styles.precision}>
        {c.precision.label}
      </VEtiqueta>
      <VTitular style={styles.titular}>
        {esSigno ? (c.tone?.headline ?? `${c.pairing}.`) : titularDeContactos(total, nombre)}
      </VTitular>
      <VTexto>
        {esSigno
          ? c.tone?.body ?? c.precision.limitations[0]
          : "Son contactos reales entre las dos cartas, no un porcentaje de compatibilidad."}
      </VTexto>
      {esSigno ? (
        c.precision.limitations.map((l) => <VNota key={l}>{l}</VNota>)
      ) : (
        <>
          <VBarra rotulo="Armónicos" valor={cuenta(c.summary.armonicos)} segmentos={[{ cantidad: c.summary.armonicos, color: COLOR_TONO.armonico }]} escala={escalaTono} />
          <VBarra rotulo="Tensos" valor={cuenta(c.summary.tensos)} segmentos={[{ cantidad: c.summary.tensos, color: COLOR_TONO.tenso }]} escala={escalaTono} />
          {c.summary.fusiones > 0 ? (
            <VBarra rotulo="Fusiones" valor={cuenta(c.summary.fusiones)} segmentos={[{ cantidad: c.summary.fusiones, color: COLOR_TONO.fusion }]} escala={escalaTono} />
          ) : null}
          <View style={styles.linea} />
          <VEtiqueta tono="gris" accessibilityRole="header">
            POR DIMENSIÓN
          </VEtiqueta>
          <VNota>Un vínculo puede fluir en un plano y trabarse en otro. No hay un puntaje único.</VNota>
          {c.summary.dimensions.map((d) => (
            <VBarra
              key={d.key}
              rotulo={d.label}
              valor={cuenta(d.total)}
              segmentos={[
                { cantidad: d.armonicos, color: COLOR_TONO.armonico },
                { cantidad: d.tensos, color: COLOR_TONO.tenso },
                { cantidad: d.fusiones, color: COLOR_TONO.fusion }
              ]}
              escala={escalaDim}
            />
          ))}
          {c.precision.limitations.map((l) => (
            <VNota key={l}>{l}</VNota>
          ))}
        </>
      )}
      {!c.access.isPro && restantes > 0 ? (
        <>
          <VTexto>Con Free ves los contactos principales. El detalle por capas y el resto de la lista son parte de Plus.</VTexto>
          <View style={styles.cta}>
            <VBoton label="VER ÓRBITA PLUS" variante="cobreContorno" onPress={() => router.push("/paywall")} />
          </View>
        </>
      ) : (
        <VNota>{c.access.isPro ? "Órbita Plus muestra la lista completa." : "Órbita Free compara con la persona que tenés guardada."}</VNota>
      )}
      <VNota>{c.disclaimer}</VNota>
    </View>
  );

  const derecha = esSigno ? null : (
    <View style={!desktop ? styles.columnaMovil : undefined}>
      <VTarjeta>
        <Text style={styles.tarjetaTitulo} accessibilityRole="header">
          Contactos principales
        </Text>
        {c.contacts.length === 0 ? (
          <VNota>Ningún aspecto mayor entre las dos cartas cae dentro de orbe. Es un resultado real, no un error.</VNota>
        ) : (
          c.contacts.map((k, i) => <FilaContacto key={k.id} contacto={k} ultima={i === c.contacts.length - 1} />)
        )}
      </VTarjeta>
      {!c.access.isPro && restantes > 0 ? (
        <VTarjeta style={styles.tarjetaPlus}>
          <Text style={styles.tarjetaTitulo} accessibilityRole="header">
            {restantes === 1 ? "Un contacto más, en Plus" : `${restantes} contactos más, en Plus`}
          </Text>
          <VTexto>La lista completa y la distribución por capas se abren con Órbita Plus.</VTexto>
        </VTarjeta>
      ) : null}
    </View>
  );

  return (
    <Columns>
      <Column weight={1}>{izquierda}</Column>
      {derecha ? <Column weight={1}>{derecha}</Column> : null}
    </Columns>
  );
}

function FilaContacto({ contacto, ultima }: { contacto: VinculoContacto; ultima: boolean }) {
  return (
    <View
      style={[styles.contacto, ultima && styles.contactoUltimo]}
      accessibilityLabel={`${contacto.from.label} ${contacto.aspectEs} ${contacto.to.label}. ${NOMBRE_TONO[contacto.tone]}, orbe ${contacto.orbLabel}.`}
    >
      <Text style={styles.contactoTitulo}>
        {contacto.from.label} {contacto.symbol} {contacto.to.label}
      </Text>
      <Text style={[styles.contactoMeta, { color: COLOR_TONO[contacto.tone] }]}>
        {NOMBRE_TONO[contacto.tone]} <Text style={styles.contactoMetaGris}>· orbe {contacto.orbLabel}</Text>
      </Text>
    </View>
  );
}

function cuenta(n: number): string {
  return n === 1 ? "1 contacto" : `${n} contactos`;
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.lg },
  precision: { marginTop: orbita.spacing.lg },
  titular: { marginTop: orbita.spacing.sm },
  linea: { backgroundColor: orbita.colors.line, height: 1, marginVertical: orbita.spacing.xl },
  cta: { marginTop: orbita.spacing.lg },
  columnaMovil: { marginTop: orbita.spacing.xxl },
  tarjetaTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 22 },
  tarjetaPlus: { marginTop: orbita.spacing.lg },
  contacto: { borderBottomColor: orbita.colors.line, borderBottomWidth: 1, paddingVertical: orbita.spacing.lg },
  contactoUltimo: { borderBottomWidth: 0, paddingBottom: 0 },
  contactoTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 17 },
  contactoMeta: { fontFamily: orbita.fonts.mono, fontSize: 12, letterSpacing: 0.5, marginTop: orbita.spacing.xs },
  contactoMetaGris: { color: orbita.colors.mutedDim }
});
