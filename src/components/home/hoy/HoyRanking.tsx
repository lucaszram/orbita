import { StyleSheet, Text, View } from "react-native";

import { HoyEnlace, HoyEtiqueta, HoyMeta, HoyNota, HoyTexto } from "@/components/home/hoy/HoyLayout";
import type { HoyRankingFila } from "@/domain/hoyPrincipal";
import { orbita } from "@/theme/orbita";

/**
 * `RANKING DE TRÁNSITOS`: el orden que ya trae la generación del día, compuesto
 * como en los frames (Build 30 `1688:112`, WEB V1 `1991:2775`): cada fila abre
 * con su línea mono —el número en cobre, el planeta en tránsito y el punto
 * natal—, sigue con el contacto en cuerpo claro, y cierra con la casa en mono
 * y la lectura cuando el backend escribió una.
 *
 * **No hay barra de cercanía, ni orbe, ni chip de exactitud, ni contador de
 * activos**: este deployment no publica ninguno de esos números, y dibujarlos a
 * partir de lo que hay sería inventar un puntaje. La única jerarquía que se
 * muestra es la posición, que sí es un dato real. El enlace del pie va a
 * Tránsitos, que existe en la navegación canónica.
 */
export function HoyRankingBloque({ filas }: { filas: readonly HoyRankingFila[] }) {
  return (
    <View>
      {filas.map((fila, index) => (
        <View key={fila.clave} style={[styles.fila, index > 0 && styles.filaSiguiente]}>
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
        </View>
      ))}
      <HoyEnlace href="/transito">VER TODOS LOS TRÁNSITOS</HoyEnlace>
      <View style={styles.porQue}>
        <HoyEtiqueta style={styles.porQueRotulo}>POR QUÉ ESTE ORDEN</HoyEtiqueta>
        <HoyNota style={styles.porQueTexto}>
          Es el orden de la lectura de hoy: primero el contacto que pone al frente, después el resto de lo activo
          sobre tu carta.
        </HoyNota>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {},
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
  porQue: { borderTopColor: orbita.colors.line, borderTopWidth: 1, marginTop: orbita.spacing.lg, paddingTop: orbita.spacing.lg },
  porQueRotulo: { color: orbita.colors.mutedDim },
  porQueTexto: { marginTop: orbita.spacing.sm }
});
