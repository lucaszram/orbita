import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/v492/States";
import { Body, Divider, Label, Note, Title } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import {
  PLUS_CTA_HINT,
  PLUS_CTA_LABEL,
  PLUS_ONLY_LABEL,
  PLUS_PAYWALL_ROUTE,
  type PlanWallCopy
} from "@/domain/planAccess";

/**
 * Las superficies cerradas por plan (CORE-1043).
 *
 * Dos composiciones y ninguna más, hechas con piezas que ya existen (`Label`,
 * `Title`, `Body`, `Note`, `Divider`, `PrimaryButton`), sin color, tarjeta ni
 * candado propios:
 *
 * - `PlanWall`: el muro de PANTALLA. Reemplaza el cuerpo entero de una sección
 *   que Free no abre (Tránsitos, Tu momento, sus detalles, la carta completa).
 * - `PlanLockBlock`: el aviso DENTRO de una pantalla abierta, donde lo cerrado
 *   es una acción o una parte (el cupo de personas, los contactos que faltan).
 *
 * La acción es OBLIGATORIA y siempre la misma —`VER ÓRBITA PLUS` → `/paywall`—:
 * una superficie cerrada por plan sin salida visible deja a quien la mira sin
 * nada que hacer con ella. Por eso el botón no se recibe por props: ninguna
 * pantalla puede armar un muro que lleve a otro lado.
 *
 * Lo que esto NO cubre: los estados técnicos —sin datos natales, cálculo en
 * curso, sesión sin confirmar—. No son límites de plan y siguen resolviéndose
 * con sus propios bloques (`@/components/v492/States`), sin salida a la compra.
 */

function irAPlus() {
  router.push(PLUS_PAYWALL_ROUTE as never);
}

/**
 * El muro de pantalla: rótulo, titular, qué abre Plus y el botón.
 *
 * El rótulo y el titular se anuncian JUNTOS y como encabezado: es lo primero que
 * VoiceOver dice al llegar, y `SOLO CON ÓRBITA PLUS` suelto no dice de qué. El
 * contenedor no es `accessible` —eso volvería inalcanzable al botón de adentro—.
 */
export function PlanWall({ copy }: { copy: PlanWallCopy }) {
  // El salto de línea del titular es tipográfico; leído en voz alta es una pausa
  // que parte la frase al medio.
  const titularDeVoz = copy.title.replace(/\n/g, " ");
  return (
    <View style={styles.wall}>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${PLUS_ONLY_LABEL}. ${titularDeVoz}`}
      >
        <Label style={styles.wallLabel}>{PLUS_ONLY_LABEL}</Label>
        <Title style={styles.wallTitle}>{copy.title}</Title>
      </View>
      <Body style={styles.wallBody}>{copy.body}</Body>
      {copy.bullets && copy.bullets.length > 0 ? (
        <View style={styles.bullets}>
          {copy.bullets.map((linea) => (
            <View
              key={linea}
              style={styles.bullet}
              accessible
              accessibilityRole="text"
              accessibilityLabel={linea}
            >
              <Label style={styles.bulletMark}>■</Label>
              <Body style={styles.bulletText}>{linea}</Body>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.wallCta}>
        <PrimaryButton
          label={PLUS_CTA_LABEL}
          accessibilityLabel={copy.ctaVoice}
          accessibilityHint={PLUS_CTA_HINT}
          onPress={irAPlus}
          align="start"
        />
      </View>
      {copy.note ? (
        <>
          <Divider style={styles.noteRule} />
          <Note>{copy.note}</Note>
        </>
      ) : null}
    </View>
  );
}

/**
 * El aviso de plan dentro de una pantalla abierta: una línea fina, qué abre
 * Plus y el botón.
 *
 * `title` es opcional porque no todos lo necesitan: el cupo de personas se dice
 * en una frase, y los contactos que faltan llevan su número adelante.
 */
export function PlanLockBlock({
  title,
  line,
  ctaVoice
}: {
  title?: string;
  /** Qué está cerrado y qué lo abre. */
  line: string;
  /** Etiqueta de VoiceOver del botón: el rótulo en mayúsculas no dice qué abre. */
  ctaVoice: string;
}) {
  return (
    <View style={styles.block}>
      <Divider style={styles.blockRule} />
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={title ? `${PLUS_ONLY_LABEL}. ${title}` : PLUS_ONLY_LABEL}
      >
        <Label style={styles.wallLabel}>{PLUS_ONLY_LABEL}</Label>
        {title ? <Body style={styles.blockTitle}>{title}</Body> : null}
      </View>
      <Note style={styles.blockLine}>{line}</Note>
      <View style={styles.blockCta}>
        <PrimaryButton
          label={PLUS_CTA_LABEL}
          accessibilityLabel={ctaVoice}
          accessibilityHint={PLUS_CTA_HINT}
          onPress={irAPlus}
          align="start"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: v492.space.xl },
  blockCta: { marginTop: v492.space.lg },
  blockLine: { marginTop: v492.space.sm },
  blockRule: { marginBottom: v492.space.lg },
  blockTitle: { marginTop: v492.space.sm },
  bullet: { alignItems: "flex-start", flexDirection: "row", marginTop: v492.space.sm },
  bulletMark: { color: v492.colors.copper, marginRight: v492.space.sm },
  bulletText: { flex: 1 },
  bullets: { marginTop: v492.space.md },
  noteRule: { marginBottom: v492.space.lg, marginTop: v492.space.xl },
  wall: { paddingTop: v492.space.xl },
  wallBody: { marginTop: v492.space.md },
  wallCta: { marginTop: v492.space.xl },
  wallLabel: { color: v492.colors.copperSoft },
  wallTitle: { marginTop: v492.space.sm }
});
