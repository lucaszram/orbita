import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { HOY_GUTTER, HoyEnlace, HoyEtiqueta, HoyMeta, HoyTitular } from "@/components/home/hoy/HoyLayout";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import type { HoyPrincipal } from "@/domain/hoyPrincipal";
import { RUTA_TU_MOMENTO } from "@/domain/hoyPrincipal";
import { orbita } from "@/theme/orbita";

/**
 * `LO PRINCIPAL HOY`: la síntesis editorial que encabeza la sección, como en
 * los frames WEB V1 `1718:2136` / `1718:1997` (CORE-237): rótulo mono, la
 * frase completa de la lectura en serif, debajo una fila mono con el contexto
 * y el enlace «VER TU MOMENTO ›».
 *
 * El titular no se inventa: es la lectura que el backend escribió para el
 * contacto que él mismo puso primero. La fila de contexto es el tema del año
 * (`CONTEXTO · TU AÑO DE …`, de `momento.getTemaDelAno`) cuando la cuenta lo
 * tiene calculado; si no —Free, sin hora exacta, o todavía en vuelo— es el
 * contacto que sostiene la frase (`CONTACTO · …`). Nunca las dos, nunca una
 * inventada.
 */
export function HoyPrincipalBloque({ principal, contexto }: { principal: HoyPrincipal; contexto: string | null }) {
  // El frame 1440 (`1718:2136`) sube la frase a 36/44: es la síntesis del día,
  // no un bloque. En 390 (`1718:1997`) queda en 30/38.
  const desktop = useIsDesktop();
  return (
    <HoyPrincipalEstado>
      <HoyTitular style={[styles.titular, desktop && styles.titularAncho]}>{principal.titular}</HoyTitular>
      {contexto ? (
        <HoyMeta items={["CONTEXTO", contexto.toLocaleUpperCase("es")]} style={styles.contacto} />
      ) : principal.aspecto ? (
        <HoyMeta items={["CONTACTO", principal.aspecto.toLocaleUpperCase("es")]} style={styles.contacto} />
      ) : null}
      <HoyEnlace href={RUTA_TU_MOMENTO}>VER TU MOMENTO</HoyEnlace>
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
  titularAncho: { fontSize: 36, lineHeight: 44 },
  contacto: { marginTop: orbita.spacing.lg }
});
