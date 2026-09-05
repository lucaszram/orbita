import { StyleSheet } from "react-native";

import { HoyEtiqueta, HoyTitular } from "@/components/home/hoy/HoyLayout";
import type { HoyPrincipal } from "@/domain/hoyPrincipal";
import { orbita } from "@/theme/orbita";

/**
 * `LO PRINCIPAL HOY`: la síntesis editorial del día.
 *
 * El titular no se inventa: es la lectura que el backend escribió para el
 * contacto que él mismo puso primero. Debajo, el contacto en mono, para que se
 * vea de dónde sale la frase.
 *
 * Es uno de los cuatro módulos numerados de Hoy: su encabezado (`01 LO
 * PRINCIPAL HOY · CAMBIA A DIARIO`), su línea y su intro los pone `HoyBloque`,
 * igual que a los otros tres, y por eso acá sólo vive el cuerpo. Tampoco lleva
 * link — «Tu momento» y los detalles de capa no existen como rutas en este
 * producto, y un link a una pantalla que no está sería una promesa rota.
 */
export function HoyPrincipalBloque({ principal }: { principal: HoyPrincipal }) {
  return (
    <>
      <HoyTitular>{principal.titular}</HoyTitular>
      {principal.aspecto ? (
        <HoyEtiqueta style={styles.aspecto}>{principal.aspecto.toLocaleUpperCase("es")}</HoyEtiqueta>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  aspecto: { color: orbita.colors.mutedDim, marginTop: orbita.spacing.lg }
});
