import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { HOY_GUTTER, HoyEtiqueta, HoyMeta, HoyTitular } from "@/components/home/hoy/HoyLayout";
import type { HoyPrincipal } from "@/domain/hoyPrincipal";
import { orbita } from "@/theme/orbita";

/**
 * `LO PRINCIPAL HOY`: la síntesis editorial que encabeza la sección, como en
 * los frames (Build 30 `1688:109`, WEB V1 `1718:2136`): rótulo mono, la frase
 * grande en serif y debajo una fila mono con el contacto que la sostiene.
 *
 * El titular no se inventa: es la lectura que el backend escribió para el
 * contacto que él mismo puso primero. Va arriba y sin número —los tres bloques
 * numerados empiezan después—, y sin el enlace «Ver tu momento» del frame,
 * porque ese destino no existe todavía como ruta.
 */
export function HoyPrincipalBloque({ principal }: { principal: HoyPrincipal }) {
  return (
    <HoyPrincipalEstado>
      <HoyTitular style={styles.titular}>{principal.titular}</HoyTitular>
      {principal.aspecto ? (
        <HoyMeta items={["CONTACTO", principal.aspecto.toLocaleUpperCase("es")]} style={styles.contacto} />
      ) : null}
    </HoyPrincipalEstado>
  );
}

/**
 * Marco estable del módulo. El rótulo no desaparece cuando su fuente carga,
 * falla o llega sin una síntesis utilizable: sólo cambia el cuerpo.
 */
export function HoyPrincipalEstado({ children }: { children: ReactNode }) {
  return (
    <View style={styles.principal}>
      <HoyEtiqueta accessibilityRole="header" style={styles.rotulo}>
        LO PRINCIPAL HOY
      </HoyEtiqueta>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  principal: { paddingHorizontal: HOY_GUTTER, paddingTop: orbita.spacing.xl },
  rotulo: { color: orbita.colors.mutedDim },
  titular: { fontSize: 30, lineHeight: 38, marginTop: orbita.spacing.md },
  contacto: { marginTop: orbita.spacing.lg }
});
