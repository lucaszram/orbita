import { StyleSheet, View } from "react-native";

import { HoyEtiqueta, HoySubtitulo, HoyTexto } from "@/components/home/hoy/HoyLayout";
import type { HoyRankingFila } from "@/domain/hoyPrincipal";
import { orbita } from "@/theme/orbita";

/**
 * `RANKING DE TRÁNSITOS`: el orden que ya trae la generación del día.
 *
 * Cada fila es su número, el contacto y —cuando el backend la escribió— su
 * lectura: el contrato real manda los secundarios sin lectura, y una fila sin
 * ella muestra el contacto solo en vez de inventarle un texto. **No hay barra
 * de cercanía, ni orbe, ni chip de exactitud, ni contador de activos**: este
 * deployment no publica ninguno de esos números, y dibujarlos a partir de lo
 * que hay sería inventar un puntaje. La única jerarquía que se muestra es la
 * posición, que sí es un dato real.
 *
 * Tampoco hay link a la lista completa: no existe una lista completa de
 * tránsitos que abrir desde acá, y el destino Tránsitos ya vive en la
 * navegación.
 */
export function HoyRankingBloque({ filas }: { filas: readonly HoyRankingFila[] }) {
  return (
    <View>
      {filas.map((fila, index) => (
        <View key={fila.clave} style={[styles.fila, index > 0 && styles.filaSiguiente]}>
          <HoyEtiqueta style={styles.rango}>{String(fila.rango).padStart(2, "0")}</HoyEtiqueta>
          <View style={styles.cuerpo}>
            <HoySubtitulo>{fila.aspecto}</HoySubtitulo>
            {fila.lectura ? <HoyTexto style={styles.lectura}>{fila.lectura}</HoyTexto> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: "row", gap: orbita.spacing.md },
  // Separación por línea fina, como el resto del canon: sin tarjetas.
  filaSiguiente: {
    borderTopColor: orbita.colors.line,
    borderTopWidth: 1,
    marginTop: orbita.spacing.lg,
    paddingTop: orbita.spacing.lg
  },
  rango: { color: orbita.colors.mutedDim, marginTop: orbita.spacing.sm, width: 22 },
  cuerpo: { flex: 1, minWidth: 0 },
  lectura: { marginTop: orbita.spacing.sm }
});
