import { useState, type ReactNode } from "react";
import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FilaVista } from "@/domain/transitosPanorama";
import { orbita } from "@/theme/orbita";

/**
 * Piezas de Tránsitos · AHORA (CORE-207), calcadas de los frames
 * `1731:2158` / `1737:2201` (ranking 390 / 1440), `1732:2179` / `2014:2825`
 * (orden y cierre) y `1729:2109` / `1730:2131` (Free bloqueado): la fila con su
 * línea mono, título, barra de cercanía, chip de fase y meta; el bloque «Por
 * qué este orden»; la tarjeta lateral; el chip de segmento; y la tarjeta
 * bloqueada de Free. Sin datos propios: todo entra por props.
 */

export function PEtiqueta({
  children,
  tono = "cobre",
  style,
  accessibilityRole
}: {
  children: ReactNode;
  tono?: "cobre" | "gris" | "hueso";
  style?: object;
  accessibilityRole?: "header";
}) {
  return (
    <Text
      style={[styles.etiqueta, tono === "gris" && styles.etiquetaGris, tono === "hueso" && styles.etiquetaHueso, style]}
      accessibilityRole={accessibilityRole}
    >
      {children}
    </Text>
  );
}

export function PTexto({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.texto, style]}>{children}</Text>;
}

export function PNota({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.nota, style]}>{children}</Text>;
}

/** Chip de segmento (AHORA · TU MOMENTO): el activo en hueso, el resto en contorno. */
export function PSegmento({ label, activo, onPress, disabled }: { label: string; activo: boolean; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="tab"
      accessibilityState={{ selected: activo, disabled: !!disabled }}
      style={({ pressed }) => [styles.segmento, activo && styles.segmentoActivo, (pressed || disabled) && styles.apagado]}
    >
      <Text style={[styles.segmentoTexto, activo && styles.segmentoTextoActivo]}>{label}</Text>
    </Pressable>
  );
}

/** Encabezado del bloque: rótulo cobre a la izquierda, dato mono gris a la derecha. */
export function PEncabezado({ izquierda, derecha }: { izquierda: string; derecha: string | null }) {
  return (
    <View style={styles.encabezado}>
      <PEtiqueta accessibilityRole="header">{izquierda}</PEtiqueta>
      {derecha ? <PEtiqueta tono="gris" style={styles.encabezadoDerecha}>{derecha}</PEtiqueta> : null}
    </View>
  );
}

/**
 * Una fila del panorama, enlazada a su detalle. La barra mide cercanía al
 * punto exacto EN TIEMPO (ver `convex/lib/transitPanorama.ts`); sin ventana no
 * se dibuja. `conCuerpo` agrega la oración del contacto (móvil).
 */
export function PFila({ fila, conCuerpo, ultima }: { fila: FilaVista; conCuerpo: boolean; ultima: boolean }) {
  const [resaltada, setResaltada] = useState(false);
  const href: Href = { pathname: "/reading/transito", params: { id: fila.transitId } };
  const label = [
    `${fila.rango}. ${fila.titulo}.`,
    fila.chip ? `${fila.chip}.` : null,
    fila.meta ? `${fila.meta}.` : null,
    "Abrir el detalle de este tránsito."
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        onHoverIn={() => setResaltada(true)}
        onHoverOut={() => setResaltada(false)}
        onFocus={() => setResaltada(true)}
        onBlur={() => setResaltada(false)}
        style={({ pressed }) => [styles.fila, !ultima && styles.filaConLinea, (resaltada || pressed) && styles.filaResaltada]}
      >
        <View style={styles.filaLinea}>
          <Text style={styles.filaMono}>
            <Text style={styles.filaRango}>{fila.rango}</Text> {fila.linea}
          </Text>
          {fila.cadencia ? <Text style={styles.filaCadencia}>{fila.cadencia.toLocaleUpperCase("es")}</Text> : null}
        </View>
        <Text style={styles.filaTitulo}>{fila.titulo}</Text>
        {fila.barra !== null ? (
          <View style={styles.barraPista} accessibilityLabel={`Cercanía al punto exacto: ${Math.round(fila.barra * 100)} por ciento`}>
            <View style={[styles.barraRelleno, { flexGrow: fila.barra }]} />
            <View style={{ flexGrow: 1 - fila.barra }} />
          </View>
        ) : null}
        <View style={styles.filaMeta}>
          {fila.chip ? (
            <View style={styles.chip}>
              <Text style={styles.chipTexto}>{fila.chip}</Text>
            </View>
          ) : null}
          {fila.meta ? <Text style={styles.metaTexto}>{fila.meta}</Text> : null}
          {!fila.chip && !fila.meta ? <Text style={styles.metaTexto}>SIN HORA EXACTA PUBLICADA</Text> : null}
        </View>
        {conCuerpo ? <PTexto style={styles.filaCuerpo}>{fila.cuerpo}</PTexto> : null}
      </Pressable>
    </Link>
  );
}

/** Enlace de pie en mono cobre: «VER LOS 16 CONTACTOS ›», «IR A …». */
export function PEnlace({ label, onPress, href }: { label: string; onPress?: () => void; href?: Href }) {
  const inner = (
    <Pressable
      onPress={onPress}
      accessibilityRole={href ? "link" : "button"}
      style={({ pressed }) => [styles.enlace, pressed && styles.apagado]}
    >
      <PEtiqueta>{`${label}  ›`}</PEtiqueta>
    </Pressable>
  );
  return href ? (
    <Link href={href} asChild>
      {inner}
    </Link>
  ) : (
    inner
  );
}

export const POR_QUE_ESTE_ORDEN: ReadonlyArray<{ rotulo: string; texto: string }> = [
  { rotulo: "EXACTITUD", texto: "Cuánto le falta al tránsito para ser exacto." },
  { rotulo: "QUÉ TOCA", texto: "Los contactos con el Sol, la Luna, el Ascendente y el Medio Cielo reciben más peso." },
  { rotulo: "CASA", texto: "Las casas 1, 4, 7 y 10 reciben más peso porque representan áreas centrales de la carta." },
  { rotulo: "CASAS QUE RIGE", texto: "Cada planeta se asocia con una o más casas natales. Si una de esas áreas también está activa, suma peso." }
];

/** «Por qué este orden»: en columna (móvil / tarjeta lateral) o en cuatro columnas (cierre 1440). */
export function PPorQue({ enFila }: { enFila: boolean }) {
  return (
    <View style={enFila ? styles.porQueFila : undefined}>
      {POR_QUE_ESTE_ORDEN.map((item) => (
        <View key={item.rotulo} style={[styles.porQueItem, enFila && styles.porQueItemFila]}>
          <PEtiqueta>{item.rotulo}</PEtiqueta>
          <PTexto style={styles.porQueTexto}>{item.texto}</PTexto>
        </View>
      ))}
    </View>
  );
}

export const NOTA_DEL_ORDEN = "El orden no es un puntaje de importancia: combina cercanía al punto exacto y relevancia del punto natal involucrado.";

/** Tarjeta lateral de escritorio: borde fino, rótulo cobre, contenido. */
export function PTarjeta({ titulo, children, style }: { titulo?: string; children: ReactNode; style?: object }) {
  return (
    <View style={[styles.tarjeta, style]}>
      {titulo ? (
        <PEtiqueta accessibilityRole="header" style={styles.tarjetaTitulo}>
          {titulo}
        </PEtiqueta>
      ) : null}
      {children}
    </View>
  );
}

/** Acordeón mínimo: «¿POR QUÉ ÓRBITA TE MUESTRA ESTO?». */
export function PPlegable({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <View style={styles.tarjeta}>
      <Pressable
        onPress={() => setAbierto((a) => !a)}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        style={styles.plegableCabeza}
      >
        <PEtiqueta tono="hueso">{titulo}</PEtiqueta>
        <Text style={styles.plegableSigno}>{abierto ? "–" : "+"}</Text>
      </Pressable>
      {abierto ? <View style={styles.plegableCuerpo}>{children}</View> : null}
    </View>
  );
}

/** Botón relleno cobre (CTA de Plus). */
export function PBoton({ label, onPress, variante = "cobre" }: { label: string; onPress?: () => void; variante?: "cobre" | "contorno" }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.boton, variante === "contorno" && styles.botonContorno, pressed && styles.apagado]}
    >
      <Text style={[styles.botonTexto, variante === "contorno" && styles.botonTextoContorno]}>{label}</Text>
    </Pressable>
  );
}

/** Líneas grises de un bloque bloqueado (Tu momento en Free). */
export function PEsqueleto({ lineas = 3 }: { lineas?: number }) {
  return (
    <View style={styles.esqueleto} accessibilityLabel="Contenido bloqueado">
      {Array.from({ length: lineas }, (_, i) => (
        <View key={i}>
          <View style={[styles.esqueletoLinea, styles.esqueletoLineaCorta]} />
          <View style={styles.esqueletoLinea} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  etiqueta: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" },
  etiquetaGris: { color: orbita.colors.mutedDim },
  etiquetaHueso: { color: orbita.colors.bone },
  texto: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 15, lineHeight: 22 },
  nota: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.body, fontSize: 13, lineHeight: 18 },
  apagado: { opacity: 0.6 },

  segmento: {
    borderColor: orbita.colors.line,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: orbita.spacing.lg
  },
  segmentoActivo: { backgroundColor: orbita.colors.bone, borderColor: orbita.colors.bone },
  segmentoTexto: { color: orbita.colors.muted, fontFamily: orbita.fonts.monoMedium, fontSize: 11, letterSpacing: 1.2 },
  segmentoTextoActivo: { color: orbita.colors.onLight },

  encabezado: { alignItems: "flex-start", flexDirection: "row", gap: orbita.spacing.md, justifyContent: "space-between" },
  encabezadoDerecha: { flexShrink: 1, textAlign: "right" },

  fila: { paddingVertical: orbita.spacing.lg },
  filaConLinea: { borderBottomColor: orbita.colors.line, borderBottomWidth: 1 },
  filaResaltada: { backgroundColor: "rgba(244,238,228,0.04)" },
  filaLinea: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" },
  filaMono: { color: orbita.colors.muted, fontFamily: orbita.fonts.mono, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" },
  filaRango: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium },
  filaCadencia: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 10, letterSpacing: 1 },
  filaTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 17, lineHeight: 24, marginTop: orbita.spacing.xs },
  barraPista: { backgroundColor: "rgba(244,238,228,0.10)", borderRadius: 2, flexDirection: "row", height: 3, marginTop: orbita.spacing.md, overflow: "hidden" },
  barraRelleno: { backgroundColor: orbita.colors.copper, height: 3 },
  filaMeta: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.md, marginTop: orbita.spacing.md },
  chip: { borderColor: orbita.colors.copper, borderRadius: 999, borderWidth: 1, paddingHorizontal: orbita.spacing.md, paddingVertical: 4 },
  chipTexto: { color: orbita.colors.copper, fontFamily: orbita.fonts.monoMedium, fontSize: 10, letterSpacing: 1.2 },
  metaTexto: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 10, letterSpacing: 1.2 },
  filaCuerpo: { marginTop: orbita.spacing.md },

  enlace: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },

  porQueFila: { flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.xl },
  porQueItem: { marginTop: orbita.spacing.lg },
  porQueItemFila: { flexBasis: 160, flexGrow: 1, minWidth: 140 },
  porQueTexto: { fontSize: 13, lineHeight: 19, marginTop: orbita.spacing.xs },

  tarjeta: {
    backgroundColor: orbita.colors.surface,
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.lg,
    borderWidth: 1,
    marginBottom: orbita.spacing.lg,
    padding: orbita.spacing.xl
  },
  tarjetaTitulo: { marginBottom: orbita.spacing.xs },
  plegableCabeza: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 24 },
  plegableSigno: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 16 },
  plegableCuerpo: { marginTop: orbita.spacing.md },

  boton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: orbita.colors.copper,
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: orbita.spacing.xl
  },
  botonContorno: { backgroundColor: "transparent", borderColor: orbita.colors.line, borderWidth: 1 },
  botonTexto: { color: orbita.colors.onLight, fontFamily: orbita.fonts.monoMedium, fontSize: 13, letterSpacing: 1.2 },
  botonTextoContorno: { color: orbita.colors.bone },

  esqueleto: { gap: orbita.spacing.md, marginTop: orbita.spacing.lg },
  esqueletoLinea: { backgroundColor: "rgba(244,238,228,0.08)", borderRadius: 3, height: 6, marginTop: orbita.spacing.sm },
  esqueletoLineaCorta: { backgroundColor: "rgba(244,238,228,0.16)", width: "48%" }
});
