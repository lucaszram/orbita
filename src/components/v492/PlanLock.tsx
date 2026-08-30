import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/v492/States";
import { Body, Divider } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { PLUS_CTA_LABEL, PLUS_PAYWALL_ROUTE } from "@/domain/planAccess";

/**
 * Línea fina → texto, en los bloqueos de PANTALLA: 20.
 *
 * Es una medida del frame, no una composición: `1248:1617` pone la línea en 231
 * y el texto en 252; `1249:1633`, en 253 y 274. La escala de la retícula salta
 * de 16 a 24 y no tiene este paso, así que el valor vive acá —con su origen
 * escrito— en vez de agregarle un escalón nuevo a todo el sistema por un solo
 * bloque.
 */
const RULE_TO_TEXT = 20;

/**
 * Una superficie cerrada por plan (frames `1248:1617`, `1249:1633`, `1250:1651`
 * y `1253:1665`).
 *
 * Es UNA sola composición para los cuatro bloqueos del build 30 —Hoy,
 * Tránsitos, el cupo de personas y el patrón relacional— y no un componente
 * nuevo por pantalla: el frame dibuja siempre lo mismo, una línea fina, una
 * frase que dice qué se abre con Plus y una única acción centrada. Tres piezas
 * que ya existen (`Divider`, `Body`, `PrimaryButton`), sin color, tarjeta ni
 * candado propios.
 *
 * La acción es OBLIGATORIA y siempre la misma —`VER ÓRBITA PLUS` →
 * `/paywall`—: una superficie cerrada por plan sin salida visible deja a quien
 * la mira sin nada que hacer con ella (decisión de Lucas, 2026-08-20, ya
 * aplicada en Carta).
 *
 * Lo que este bloque NO cubre: los estados técnicos —sin datos natales, cálculo
 * en curso, sesión sin confirmar—. Esos no son límites de plan y siguen
 * resolviéndose con sus propios estados, sin salida a la compra.
 */
export function PlanLockBlock({
  line,
  ctaVoice,
  rule = true
}: {
  /** Qué se abre con Plus, en la frase exacta del frame. */
  line: string;
  /** Etiqueta de VoiceOver: el rótulo en mayúsculas no dice qué desbloquea. */
  ctaVoice: string;
  /**
   * La línea fina de arriba, y con ella la geometría del bloque.
   *
   * Encendida es el bloqueo de PANTALLA: abre su propia sección, así que se
   * despega 24 del encabezado, dibuja la línea y deja 20 hasta el texto y 24
   * hasta la acción (frames `1248:1617` y `1249:1633`).
   *
   * Apagada es el bloqueo DENTRO de un módulo: el encabezado ya trajo su línea
   * y ya dejó su aire, así que acá no se agrega ni separación de arriba ni una
   * segunda línea seguida, y del texto a la acción quedan 16 —el frame la
   * acerca porque el bloque completo es más corto— (`1250:1651`, `1253:1665`).
   */
  rule?: boolean;
}) {
  return (
    <View style={rule ? styles.screenBlock : null}>
      {rule ? <Divider style={styles.rule} /> : null}
      <Body>{line}</Body>
      <View style={rule ? styles.cta : styles.ctaInModule}>
        <PrimaryButton
          label={PLUS_CTA_LABEL}
          accessibilityLabel={ctaVoice}
          onPress={() => router.push(PLUS_PAYWALL_ROUTE as never)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cta: { marginTop: v492.space.xl },
  ctaInModule: { marginTop: v492.space.lg },
  rule: { marginBottom: RULE_TO_TEXT },
  // El encabezado de la pantalla ya cierra con sus 16; estos 24 son los que el
  // frame agrega antes de la línea del bloqueo (207 → 231 en Hoy, 229 → 253 en
  // Tránsitos).
  screenBlock: { paddingTop: v492.space.xl }
});
