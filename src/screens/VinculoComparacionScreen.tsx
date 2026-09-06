/**
 * **Vínculos · Comparación** — la comparación real entre la carta propia y la
 * de la persona guardada (CORE-212). Frames `1757:2674` (1440) y `1757:2515`
 * (390), seguidos frame por frame en CORE-236:
 *
 * - 390: barra «Órbita · FREE» con «‹ VOLVER» a la derecha; chips «TU · Tu
 *   carta» y «M · Mara»; línea de precisión; titular «N contactos entre tu
 *   carta y la de Mara.»; barras Armónicos / Tensos; «POR DIMENSIÓN» con la
 *   barra dual por dimensión; la nota del plan; y debajo las tarjetas de
 *   contactos y el CTA de Plus.
 * - 1440: encabezado «VÍNCULOS · COMPARACIÓN … ‹ VOLVER»; los dos discos
 *   superpuestos con «Tu carta · Mara»; titular «N contactos entre las dos
 *   cartas.»; el texto del plan y «VER ÓRBITA PLUS» en contorno; a la derecha
 *   «Contactos principales» y «Once contactos más, en Plus». Las barras por
 *   tono y por dimensión siguen debajo del CTA, tras una línea: el frame no
 *   las dibuja en escritorio, pero son el mismo dato que ve el móvil.
 *
 * En web la ruta viaja dentro del shell (`WebAppShell`): la nav de la sección
 * y el modo escritorio los pone el shell, como en el resto de la web.
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
import { H2, H3, OrbitaScreen, Section } from "@/components/orbita/kit";
import { Column, Columns } from "@/components/orbita/Layout";
import { GuestState } from "@/components/orbita/GuestState";
import { EmptyState, ErrorState, MinimalLoading } from "@/components/orbita/states";
import { PBarra, PBoton, PEncabezado, PEtiqueta, PNota, PTarjeta, PTexto } from "@/components/transitos/PanoramaUI";
import { VCerco, VDiscos, VPersonaChip } from "@/components/vinculos/VinculosUI";
import { escalaDeDimensiones, fraccionDeBarra, inicial, perfilIdValido, titularDeContactos, titularDeContactosCorto } from "@/domain/vinculo";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import { useLiveApp } from "@/hooks/useLiveApp";
import { appCoreApi, type VinculoComparacion, type VinculoContacto } from "@/services/appCoreRefs";
import { orbita } from "@/theme/orbita";

// Como los frames `1757:2515` / `2092:2975`: los armónicos en cobre claro, los
// tensos en el rojo de tensión y las fusiones en el azul de armonía. Es la
// misma paleta que la barra «Tu vínculo con …» de la biblioteca.
const COLOR_TONO = { armonico: orbita.colors.copperSoft, tenso: orbita.colors.tension, fusion: orbita.colors.harmony } as const;
const NOMBRE_TONO = { armonico: "Armónico", tenso: "Tenso", fusion: "Fusión" } as const;

/** «‹ VOLVER»: a la pantalla anterior, o a la lista si se entró por link directo. */
const ROTULO_VOLVER = "‹ VOLVER";
function volver() {
  if (router.canGoBack()) router.back();
  else router.replace("/vinculo");
}

export function VinculoComparacionScreen() {
  const { isLive, isAuthLoading, userError, retryUser, auth } = useLiveApp();
  const guest = !isAuthLoading && !userError && !auth?.isSignedIn;
  return (
    <OrbitaScreen canvas="wide" right={ROTULO_VOLVER} onRight={volver}>
      <Section>
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
      </Section>
    </OrbitaScreen>
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
  const ofrecePlus = !c.access.isPro && restantes > 0;

  // Las dos cartas: chips en móvil (frame `1757:2515`), discos en escritorio (`1757:2674`).
  const cartas = desktop ? (
    <View style={styles.discos}>
      <VDiscos nombre={nombre} />
    </View>
  ) : (
    <View style={styles.chips}>
      <VPersonaChip inicial="TU" nombre="Tu carta" tono="cobre" />
      <VPersonaChip inicial={inicial(nombre)} nombre={nombre} tono="cobre" />
    </View>
  );

  const precision = (
    <PEtiqueta tono="gris" style={desktop ? undefined : styles.precision}>
      {c.precision.label}
    </PEtiqueta>
  );

  const titular = esSigno ? (c.tone?.headline ?? `${c.pairing}.`) : desktop ? titularDeContactosCorto(total) : titularDeContactos(total, nombre);

  // El texto bajo el titular: en escritorio el frame pone ahí lo del plan; en
  // móvil, la aclaración de que son contactos reales.
  const texto = esSigno
    ? c.tone?.body ?? c.precision.limitations[0]
    : desktop && ofrecePlus
      ? "Con Free ves los contactos principales. El detalle por capas y el resto de la lista son parte de Plus."
      : "Son contactos reales entre las dos cartas, no un porcentaje de compatibilidad.";

  const ctaPlus = ofrecePlus ? (
    <View style={styles.cta}>
      <PBoton label="VER ÓRBITA PLUS" variante="cobreContorno" onPress={() => router.push("/paywall")} />
    </View>
  ) : null;

  const notaDelPlan = (
    <PNota style={styles.nota}>{c.access.isPro ? "Órbita Plus muestra la lista completa." : "Órbita Free compara con la persona que tenés guardada."}</PNota>
  );

  const medidas = esSigno ? (
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
      {c.summary.dimensions.map((d, i) => (
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
          grosor={4}
          separada={i > 0}
        />
      ))}
      {c.precision.limitations.map((l) => (
        <PNota key={l} style={styles.nota}>
          {l}
        </PNota>
      ))}
    </>
  );

  const tarjetas = esSigno ? null : (
    <>
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
      {ofrecePlus ? (
        <PTarjeta>
          <Text style={styles.tarjetaTitulo} accessibilityRole="header">
            {restantes === 1 ? "Un contacto más, en Plus" : `${restantes} contactos más, en Plus`}
          </Text>
          <PTexto style={styles.notaCorta}>La lista completa y la distribución por capas se abren con Órbita Plus.</PTexto>
        </PTarjeta>
      ) : null}
    </>
  );

  const disclaimer = <PNota style={styles.nota}>{c.disclaimer}</PNota>;

  if (desktop) {
    const izquierda = (
      <View>
        <PEncabezado izquierda="VÍNCULOS · COMPARACIÓN" derecha={ROTULO_VOLVER} onDerecha={volver} />
        {cartas}
        <View style={styles.titular}>
          <H2>{titular}</H2>
        </View>
        <PTexto style={styles.texto}>{texto}</PTexto>
        {ctaPlus}
        {esSigno ? (
          medidas
        ) : (
          <>
            <View style={styles.linea} />
            {precision}
            {medidas}
          </>
        )}
        {ofrecePlus ? null : notaDelPlan}
        {disclaimer}
      </View>
    );
    return (
      <Columns gap={orbita.spacing.xxl * 1.5}>
        <Column weight={3}>{izquierda}</Column>
        {tarjetas ? <Column weight={4}>{tarjetas}</Column> : null}
      </Columns>
    );
  }

  return (
    <View>
      {cartas}
      {precision}
      <View style={styles.titular}>
        <H3>{titular}</H3>
      </View>
      <PTexto style={styles.texto}>{texto}</PTexto>
      {medidas}
      {notaDelPlan}
      {tarjetas ? <View style={styles.tarjetasMovil}>{tarjetas}</View> : null}
      {ctaPlus}
      {disclaimer}
    </View>
  );
}

/** Rótulo, valor y la barra compartida debajo: conteo por tono o por dimensión. */
function Conteo({
  rotulo,
  valor,
  segmentos,
  escala,
  grosor = 6,
  separada
}: {
  rotulo: string;
  valor: string;
  segmentos: ReadonlyArray<{ cantidad: number; color: string }>;
  escala: number;
  grosor?: number;
  /** Con una línea fina arriba: las dimensiones van separadas entre sí (frame `1757:2548`). */
  separada?: boolean;
}) {
  return (
    <View style={[styles.conteo, separada && styles.conteoSeparado]}>
      <View style={styles.conteoFila}>
        <Text style={styles.conteoRotulo}>{rotulo}</Text>
        <Text style={styles.conteoValor}>{valor}</Text>
      </View>
      <PBarra
        grosor={grosor}
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
      <Text style={styles.contactoMeta}>
        {NOMBRE_TONO[contacto.tone]} · orbe {contacto.orbLabel}
      </Text>
    </View>
  );
}

function cuenta(n: number): string {
  return n === 1 ? "1 contacto" : `${n} contactos`;
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.lg },
  discos: { marginTop: orbita.spacing.xl },
  tarjetasMovil: { marginTop: orbita.spacing.xl },
  precision: { marginTop: orbita.spacing.lg },
  titular: { marginTop: orbita.spacing.sm },
  texto: { marginTop: orbita.spacing.lg },
  nota: { marginTop: orbita.spacing.md },
  notaCorta: { marginTop: orbita.spacing.sm },
  linea: { backgroundColor: orbita.colors.line, height: 1, marginVertical: orbita.spacing.xl },
  cta: { marginTop: orbita.spacing.lg },
  tarjetaTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 22 },
  conteo: { marginTop: orbita.spacing.lg },
  conteoSeparado: { borderTopColor: orbita.colors.line, borderTopWidth: 1, marginTop: orbita.spacing.md, paddingTop: orbita.spacing.md },
  conteoFila: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" },
  conteoRotulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 16 },
  conteoValor: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 12 },
  conteoBarra: { marginTop: orbita.spacing.sm },
  contacto: { borderBottomColor: orbita.colors.line, borderBottomWidth: 1, paddingVertical: orbita.spacing.lg },
  contactoUltimo: { borderBottomWidth: 0, paddingBottom: 0 },
  contactoTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 17 },
  contactoMeta: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 12, letterSpacing: 0.5, marginTop: orbita.spacing.xs }
});
