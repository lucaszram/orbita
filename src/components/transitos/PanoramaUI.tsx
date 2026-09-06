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
  mayusculas = true,
  style,
  accessibilityRole
}: {
  children: ReactNode;
  tono?: "cobre" | "gris" | "hueso";
  /** `false` para rótulos que el frame escribe en minúscula («0 de 1 persona»). */
  mayusculas?: boolean;
  style?: object;
  accessibilityRole?: "header";
}) {
  return (
    <Text
      style={[
        styles.etiqueta,
        tono === "gris" && styles.etiquetaGris,
        tono === "hueso" && styles.etiquetaHueso,
        !mayusculas && styles.etiquetaMinuscula,
        style
      ]}
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

/**
 * Chip de segmento (AHORA · TU MOMENTO). Con `onPress` es una pestaña real
 * (rol `tab`, estado seleccionado); sin él, un rótulo.
 */
export function PSegmento({ label, activo, onPress }: { label: string; activo: boolean; onPress?: () => void }) {
  if (!onPress) {
    return (
      <View style={[styles.segmento, activo && styles.segmentoActivo]} accessibilityRole="header">
        <Text style={[styles.segmentoTexto, activo && styles.segmentoTextoActivo]}>{label}</Text>
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: activo }}
      style={({ pressed }) => [styles.segmento, activo && styles.segmentoActivo, pressed && styles.apagado]}
    >
      <Text style={[styles.segmentoTexto, activo && styles.segmentoTextoActivo]}>{label}</Text>
    </Pressable>
  );
}

/** Encabezado del bloque: rótulo cobre a la izquierda, dato mono gris a la derecha. */
export function PEncabezado({
  izquierda,
  derecha,
  derechaMinuscula
}: {
  izquierda: string;
  derecha: string | null;
  /** El dato de la derecha tal cual, sin versalitas («0 de 1 persona» en el frame móvil de Vínculos). */
  derechaMinuscula?: boolean;
}) {
  return (
    <View style={styles.encabezado}>
      <PEtiqueta accessibilityRole="header">{izquierda}</PEtiqueta>
      {derecha ? (
        <PEtiqueta tono="gris" mayusculas={!derechaMinuscula} style={styles.encabezadoDerecha}>
          {derecha}
        </PEtiqueta>
      ) : null}
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

/**
 * Lo que la pantalla explica del orden tiene que ser lo que el backend hace:
 * `selectRelevantTransits` suma pesos fijos por planeta en tránsito, punto
 * natal y aspecto, más uno si el proveedor publicó la hora exacta
 * (`transitPriority`, convex/lib/orbita.ts). No mide cercanía al exacto ni
 * mira la casa: eso lo dicen la barra y la meta de cada fila, no el orden.
 */
export const POR_QUE_ESTE_ORDEN: ReadonlyArray<{ rotulo: string; texto: string }> = [
  { rotulo: "QUÉ PLANETA PASA", texto: "Saturno pesa más; Sol, Venus y Marte siguen; la Luna, que pasa rápido, pesa menos." },
  { rotulo: "QUÉ PUNTO TOCA", texto: "Los contactos con tu Sol y tu Luna reciben más peso; después el Ascendente, Mercurio, Venus y Marte." },
  { rotulo: "QUÉ ASPECTO", texto: "La conjunción pesa más que la oposición y la cuadratura; el trígono y el sextil, menos." },
  { rotulo: "HORA EXACTA", texto: "Un contacto con hora exacta publicada suma un punto." }
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

export const NOTA_DEL_ORDEN =
  "El orden no es un puntaje de importancia ni mide cuánto falta para el exacto: suma pesos fijos por planeta, punto y aspecto. La cercanía en el tiempo la muestra la barra de cada fila.";

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

/**
 * Botón de píldora: `cobre` (el CTA de Plus y el CTA principal en móvil),
 * `hueso` (el CTA principal de escritorio: «AGREGAR PERSONA», «CONTINUAR»),
 * `contorno` (secundario) y `cobreContorno` (la entrada a Plus en contexto).
 */
export function PBoton({
  label,
  onPress,
  variante = "cobre",
  disabled,
  accessibilityLabel
}: {
  label: string;
  onPress?: () => void;
  variante?: "cobre" | "hueso" | "contorno" | "cobreContorno";
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.boton,
        variante === "hueso" && styles.botonHueso,
        variante === "contorno" && styles.botonContorno,
        variante === "cobreContorno" && styles.botonCobreContorno,
        (pressed || disabled) && styles.apagado
      ]}
    >
      <Text
        style={[
          styles.botonTexto,
          variante === "contorno" && styles.botonTextoContorno,
          variante === "cobreContorno" && styles.botonTextoCobreContorno
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Pista de proporción con uno o varios segmentos (`fraccion` 0–1 cada uno,
 * en orden). Es la misma barra de las filas del panorama, disponible para las
 * tarjetas de Vínculos: conteo por tono, por dimensión y el resumen del vínculo.
 * Ilustra un dato que siempre está escrito al lado; el lector de pantalla
 * recibe `accessibilityLabel`, nunca un porcentaje inventado.
 */
export function PBarra({
  segmentos,
  grosor = 3,
  accessibilityLabel,
  style
}: {
  segmentos: ReadonlyArray<{ fraccion: number; color: string }>;
  grosor?: number;
  accessibilityLabel: string;
  style?: object;
}) {
  const usado = segmentos.reduce((a, s) => a + Math.max(0, Math.min(1, s.fraccion)), 0);
  return (
    <View style={[styles.barraPista, { height: grosor }, style]} accessible accessibilityLabel={accessibilityLabel}>
      {segmentos.map((s, i) =>
        s.fraccion > 0 ? <View key={i} style={{ backgroundColor: s.color, flexGrow: Math.max(0, Math.min(1, s.fraccion)), height: grosor }} /> : null
      )}
      <View style={{ flexGrow: Math.max(0, 1 - usado) }} />
    </View>
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
  etiquetaMinuscula: { textTransform: "none" },
  texto: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 15, lineHeight: 22 },
  nota: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.body, fontSize: 13, lineHeight: 18 },
  apagado: { opacity: 0.6 },

  segmento: {
    borderColor: orbita.colors.line,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
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
  barraPista: { backgroundColor: orbita.colors.boneTint08, borderRadius: 3, flexDirection: "row", height: 3, marginTop: orbita.spacing.md, overflow: "hidden" },
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
  plegableCabeza: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 44 },
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
  botonHueso: { backgroundColor: orbita.colors.bone },
  botonContorno: { backgroundColor: "transparent", borderColor: orbita.colors.line, borderWidth: 1 },
  botonCobreContorno: { backgroundColor: "transparent", borderColor: orbita.colors.copper, borderWidth: 1 },
  botonTexto: { color: orbita.colors.onLight, fontFamily: orbita.fonts.monoMedium, fontSize: 13, letterSpacing: 1.2 },
  botonTextoContorno: { color: orbita.colors.bone },
  botonTextoCobreContorno: { color: orbita.colors.copper },

  esqueleto: { gap: orbita.spacing.md, marginTop: orbita.spacing.lg },
  esqueletoLinea: { backgroundColor: "rgba(244,238,228,0.08)", borderRadius: 3, height: 6, marginTop: orbita.spacing.sm },
  esqueletoLineaCorta: { backgroundColor: "rgba(244,238,228,0.16)", width: "48%" }
});
