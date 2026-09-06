/**
 * **Vínculos · Comparación** — la comparación real entre la carta propia y la
 * de la persona guardada (CORE-212). Frames `1757:2674` (1440) y `1757:2515`
 * (390): chips de las dos cartas, precisión, titular con el conteo, barras
 * por tono, «Por dimensión», contactos principales y —en Free— cuántos quedan
 * en Plus.
 *
 * Compone con el kit compartido de la web (CORE-233): rótulos, textos, notas,
 * tarjetas, botones y barras son los de Tránsitos y Hoy; la columna de lectura
 * queda a la izquierda y las tarjetas a la derecha, como en el resto.
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
import { H2, H3 } from "@/components/orbita/kit";
import { Column, Columns } from "@/components/orbita/Layout";
import { GuestState } from "@/components/orbita/GuestState";
import { EmptyState, ErrorState, MinimalLoading } from "@/components/orbita/states";
import { PBarra, PBoton, PEtiqueta, PNota, PTarjeta, PTexto } from "@/components/transitos/PanoramaUI";
import { VCerco, VPersonaChip } from "@/components/vinculos/VinculosUI";
import { escalaDeDimensiones, fraccionDeBarra, inicial, perfilIdValido, titularDeContactos } from "@/domain/vinculo";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import { useLiveApp } from "@/hooks/useLiveApp";
import { appCoreApi, type VinculoComparacion, type VinculoContacto } from "@/services/appCoreRefs";
import { orbita } from "@/theme/orbita";

// Como los frames `1757:2515` / `2092:2975`: los armónicos en cobre claro, los
// tensos en el rojo de tensión y las fusiones en el azul de armonía. Es la
// misma paleta que la barra «Tu vínculo con …» de la biblioteca.
const COLOR_TONO = { armonico: orbita.colors.copperSoft, tenso: orbita.colors.tension, fusion: orbita.colors.harmony } as const;
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
  const Titulo = desktop ? H2 : H3;

  const izquierda = (
    <View>
      <View style={styles.chips}>
        <VPersonaChip inicial="TU" nombre="Tu carta" tono="cobre" />
        <VPersonaChip inicial={inicial(nombre)} nombre={nombre} tono="azul" />
      </View>
      <PEtiqueta tono="gris" style={styles.precision}>
        {c.precision.label}
      </PEtiqueta>
      <View style={styles.titular}>
        <Titulo>{esSigno ? (c.tone?.headline ?? `${c.pairing}.`) : titularDeContactos(total, nombre)}</Titulo>
      </View>
      <PTexto style={styles.texto}>
        {esSigno
          ? c.tone?.body ?? c.precision.limitations[0]
          : "Son contactos reales entre las dos cartas, no un porcentaje de compatibilidad."}
      </PTexto>
      {esSigno ? (
        c.precision.limitations.map((l) => (
          <PNota key={l} style={styles.nota}>
            {l}
          </PNota>
        ))
      ) : (
        <>
          <Conteo rotulo="Armónicos" valor={cuenta(c.summary.armonicos)} segmentos={[{ cantidad: c.summary.armonicos, color: COLOR_TONO.armonico }]} escala={escalaTono} />
          <Conteo rotulo="Tensos" valor={cuenta(c.summary.tensos)} segmentos={[{ cantidad: c.summary.tensos, color: COLOR_TONO.tenso }]} escala={escalaTono} />
          {c.summary.fusiones > 0 ? (
            <Conteo rotulo="Fusiones" valor={cuenta(c.summary.fusiones)} segmentos={[{ cantidad: c.summary.fusiones, color: COLOR_TONO.fusion }]} escala={escalaTono} />
          ) : null}
          <View style={styles.linea} />
          <PEtiqueta tono="gris" accessibilityRole="header">
            POR DIMENSIÓN
          </PEtiqueta>
          <PNota style={styles.notaCorta}>Un vínculo puede fluir en un plano y trabarse en otro. No hay un puntaje único.</PNota>
          {c.summary.dimensions.map((d) => (
            <Conteo
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
            <PNota key={l} style={styles.nota}>
              {l}
            </PNota>
          ))}
        </>
      )}
      {!c.access.isPro && restantes > 0 ? (
        <>
          <PTexto style={styles.texto}>Con Free ves los contactos principales. El detalle por capas y el resto de la lista son parte de Plus.</PTexto>
          <View style={styles.cta}>
            <PBoton label="VER ÓRBITA PLUS" variante="cobreContorno" onPress={() => router.push("/paywall")} />
          </View>
        </>
      ) : (
        <PNota style={styles.nota}>{c.access.isPro ? "Órbita Plus muestra la lista completa." : "Órbita Free compara con la persona que tenés guardada."}</PNota>
      )}
      <PNota style={styles.nota}>{c.disclaimer}</PNota>
    </View>
  );

  const derecha = esSigno ? null : (
    <View style={!desktop ? styles.columnaMovil : undefined}>
      <PTarjeta>
        <Text style={styles.tarjetaTitulo} accessibilityRole="header">
          Contactos principales
        </Text>
        {c.contacts.length === 0 ? (
          <PNota style={styles.notaCorta}>Ningún aspecto mayor entre las dos cartas cae dentro de orbe. Es un resultado real, no un error.</PNota>
        ) : (
          c.contacts.map((k, i) => <FilaContacto key={k.id} contacto={k} ultima={i === c.contacts.length - 1} />)
        )}
      </PTarjeta>
      {!c.access.isPro && restantes > 0 ? (
        <PTarjeta>
          <Text style={styles.tarjetaTitulo} accessibilityRole="header">
            {restantes === 1 ? "Un contacto más, en Plus" : `${restantes} contactos más, en Plus`}
          </Text>
          <PTexto style={styles.notaCorta}>La lista completa y la distribución por capas se abren con Órbita Plus.</PTexto>
        </PTarjeta>
      ) : null}
    </View>
  );

  return (
    <Columns gap={orbita.spacing.xxl * 1.5}>
      <Column weight={3}>{izquierda}</Column>
      {derecha ? <Column weight={4}>{derecha}</Column> : null}
    </Columns>
  );
}

/** Rótulo, valor y la barra compartida debajo: conteo por tono o por dimensión. */
function Conteo({
  rotulo,
  valor,
  segmentos,
  escala
}: {
  rotulo: string;
  valor: string;
  segmentos: ReadonlyArray<{ cantidad: number; color: string }>;
  escala: number;
}) {
  return (
    <View style={styles.conteo}>
      <View style={styles.conteoFila}>
        <Text style={styles.conteoRotulo}>{rotulo}</Text>
        <Text style={styles.conteoValor}>{valor}</Text>
      </View>
      <PBarra
        grosor={6}
        segmentos={segmentos.map((s) => ({ fraccion: fraccionDeBarra(s.cantidad, escala), color: s.color }))}
        accessibilityLabel={`${rotulo}: ${valor}`}
        style={styles.conteoBarra}
      />
    </View>
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
  texto: { marginTop: orbita.spacing.lg },
  nota: { marginTop: orbita.spacing.md },
  notaCorta: { marginTop: orbita.spacing.sm },
  linea: { backgroundColor: orbita.colors.line, height: 1, marginVertical: orbita.spacing.xl },
  cta: { marginTop: orbita.spacing.lg },
  columnaMovil: { marginTop: orbita.spacing.xxl },
  tarjetaTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 22 },
  conteo: { marginTop: orbita.spacing.lg },
  conteoFila: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" },
  conteoRotulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 16 },
  conteoValor: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 12 },
  conteoBarra: { marginTop: orbita.spacing.sm },
  contacto: { borderBottomColor: orbita.colors.line, borderBottomWidth: 1, paddingVertical: orbita.spacing.lg },
  contactoUltimo: { borderBottomWidth: 0, paddingBottom: 0 },
  contactoTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 17 },
  contactoMeta: { fontFamily: orbita.fonts.mono, fontSize: 12, letterSpacing: 0.5, marginTop: orbita.spacing.xs },
  contactoMetaGris: { color: orbita.colors.mutedDim }
});
