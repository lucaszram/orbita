import { StyleSheet, Text, View } from "react-native";

import { HoyEnlace, HoyEtiqueta, HoyMeta, HoyNota, HoyTexto } from "@/components/home/hoy/HoyLayout";
import { NOTA_DEL_ORDEN, PFila, PPorQue } from "@/components/transitos/PanoramaUI";
import { filaDeHoyComoVista, type HoyRankingFila, RUTA_TRANSITOS } from "@/domain/hoyPrincipal";
import type { FilaVista } from "@/domain/transitosPanorama";
import { orbita } from "@/theme/orbita";

/**
 * `RANKING DE TRÁNSITOS`, compuesto como el de Tránsitos (frames WEB V1
 * `1991:2775` / `1718:2052`, CORE-238): cada fila es una `PFila` del panorama
 * —línea mono, título, barra de cercanía, chip de fase, meta y cuerpo—, el pie
 * enlaza a los N contactos activos y cierra «Por qué este orden», con la misma
 * explicación que Tránsitos (los pesos de `transitPriority`).
 *
 * Con Plus (`panorama` listo) las filas SON las del panorama: mismo orden,
 * mismos datos, sin recorte propio más allá de las primeras visibles. Sin Plus
 * las filas salen de la guía del día con la misma composición y **sin barra ni
 * chip**: ese deployment no publica cercanía a Free, y dibujarla sería un
 * puntaje inventado. Una fila de un documento anterior, sin identidad, se
 * muestra igual pero no es tocable y lo dice.
 */
export function HoyRankingBloque({
  filas,
  panorama,
  enlace
}: {
  /** Las filas de la guía (Free, o mientras el panorama no llegó). */
  filas: readonly HoyRankingFila[];
  /** Las filas del panorama (Plus). Si hay, mandan. */
  panorama: readonly FilaVista[];
  /** `VER LOS 16 CONTACTOS ACTIVOS`, o `null` si el total no se conoce. */
  enlace: string | null;
}) {
  const conPanorama = panorama.length > 0;
  return (
    <View>
      {conPanorama ? <HoyEtiqueta style={styles.leyenda}>LAS BARRAS MIDEN CERCANÍA AL PUNTO EXACTO</HoyEtiqueta> : null}
      {conPanorama
        ? panorama.map((fila, index) => <PFila key={fila.transitId} fila={fila} conCuerpo ultima={index === panorama.length - 1} />)
        : filas.map((fila, index) => {
            const vista = filaDeHoyComoVista(fila);
            return vista ? (
              <PFila key={fila.clave} fila={vista} conCuerpo={vista.cuerpo.length > 0} ultima={index === filas.length - 1} sinFase={null} />
            ) : (
              <View key={fila.clave} style={index > 0 && styles.filaSiguiente}>
                <HoyRankingFilaFija fila={fila} />
              </View>
            );
          })}
      <HoyEnlace href={RUTA_TRANSITOS}>{enlace ?? "VER TODOS LOS TRÁNSITOS"}</HoyEnlace>
      <View style={styles.porQue}>
        <HoyEtiqueta style={styles.porQueRotulo}>POR QUÉ ESTE ORDEN</HoyEtiqueta>
        {conPanorama ? (
          <>
            <PPorQue enFila={false} />
            <HoyNota style={styles.porQueTexto}>{NOTA_DEL_ORDEN}</HoyNota>
          </>
        ) : (
          <HoyNota style={styles.porQueTexto}>
            Es el orden de la lectura de hoy: primero el contacto que pone al frente, después el resto de lo activo
            sobre tu carta.
          </HoyNota>
        )}
      </View>
    </View>
  );
}

/** Una fila sin identidad (documentos anteriores al contrato): se lee, no se abre, y lo dice. */
function HoyRankingFilaFija({ fila }: { fila: HoyRankingFila }) {
  return (
    <View style={styles.fila}>
      <HoyRankingFilaCuerpo fila={fila} />
      <HoyEtiqueta style={styles.sinDetalle}>DETALLE NO DISPONIBLE</HoyEtiqueta>
    </View>
  );
}

function HoyRankingFilaCuerpo({ fila }: { fila: HoyRankingFila }) {
  return (
    <>
      {/* `1 LUNA · MARTE`: el número en cobre y, aparte, planeta y punto en gris. */}
      <View style={styles.linea}>
        <HoyEtiqueta style={styles.rango}>{String(fila.rango)}</HoyEtiqueta>
        <HoyMeta
          items={[
            fila.planeta ? fila.planeta.toLocaleUpperCase("es") : null,
            fila.punto ? fila.punto.toLocaleUpperCase("es") : null
          ]}
          style={styles.lineaMeta}
        />
      </View>
      <Text style={styles.contacto}>{fila.titulo}</Text>
      {fila.casa !== null ? <HoyEtiqueta style={styles.casa}>{`CASA ${fila.casa}`}</HoyEtiqueta> : null}
      {fila.lectura ? <HoyTexto style={styles.lectura}>{fila.lectura}</HoyTexto> : null}
    </>
  );
}

const styles = StyleSheet.create({
  leyenda: { color: orbita.colors.mutedDim, marginBottom: orbita.spacing.sm },
  fila: { minHeight: 44 },
  // Separación por línea fina, como el resto del canon: sin tarjetas.
  filaSiguiente: {
    borderTopColor: orbita.colors.line,
    borderTopWidth: 1,
    marginTop: orbita.spacing.lg,
    paddingTop: orbita.spacing.lg
  },
  linea: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.md },
  rango: { color: orbita.colors.copper },
  lineaMeta: { marginTop: 0 },
  contacto: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.body,
    fontSize: 17,
    lineHeight: 24,
    marginTop: orbita.spacing.sm
  },
  casa: { color: orbita.colors.mutedDim, marginTop: orbita.spacing.sm },
  lectura: { marginTop: orbita.spacing.sm },
  sinDetalle: { color: orbita.colors.mutedDim, marginTop: orbita.spacing.md },
  porQue: { borderTopColor: orbita.colors.line, borderTopWidth: 1, marginTop: orbita.spacing.lg, paddingTop: orbita.spacing.lg },
  porQueRotulo: { color: orbita.colors.mutedDim },
  porQueTexto: { marginTop: orbita.spacing.sm }
});
