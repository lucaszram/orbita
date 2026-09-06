import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { orbita } from "@/theme/orbita";
import { fraccionDeBarra } from "@/domain/vinculo";

/**
 * Piezas de la sección Vínculos (CORE-212), calcadas de los frames
 * `1757:2613` / `1757:2383` (lista), `1761:2776`→`1761:3012` (alta) y
 * `1757:2515` / `1757:2674` (comparación): tarjeta de superficie, rótulo mono
 * cobre, botones relleno/contorno, campo de texto con rótulo, barra de conteo
 * y el chip de persona. Sin lógica de datos: todo lo que se ve entra por props.
 */

export function VTarjeta({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.tarjeta, style]}>{children}</View>;
}

export function VEtiqueta({
  children,
  tono = "cobre",
  style,
  accessibilityRole
}: {
  children: ReactNode;
  tono?: "cobre" | "gris";
  style?: object;
  accessibilityRole?: "header";
}) {
  return (
    <Text style={[styles.etiqueta, tono === "gris" && styles.etiquetaGris, style]} accessibilityRole={accessibilityRole}>
      {children}
    </Text>
  );
}

export function VTitular({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <Text style={[styles.titular, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function VTexto({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.texto, style]}>{children}</Text>;
}

export function VNota({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.nota, style]}>{children}</Text>;
}

/** Botón: `relleno` (hueso), `contorno` (línea), `cobre` (relleno cobre, el CTA móvil). */
export function VBoton({
  label,
  onPress,
  variante = "relleno",
  disabled,
  accessibilityLabel
}: {
  label: string;
  onPress?: () => void;
  variante?: "relleno" | "contorno" | "cobre" | "cobreContorno";
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
        variante === "contorno" && styles.botonContorno,
        variante === "cobre" && styles.botonCobre,
        variante === "cobreContorno" && styles.botonCobreContorno,
        (pressed || disabled) && styles.botonApagado
      ]}
    >
      <Text
        style={[
          styles.botonTexto,
          variante === "contorno" && styles.botonTextoContorno,
          variante === "cobre" && styles.botonTextoCobre,
          variante === "cobreContorno" && styles.botonTextoCobreContorno
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Campo de texto con rótulo mono y error debajo. */
export function VCampo({
  rotulo,
  error,
  style,
  ...input
}: TextInputProps & { rotulo: string; error?: string; style?: object }) {
  return (
    <View style={style}>
      <VEtiqueta tono="gris" style={styles.campoRotulo}>
        {rotulo}
      </VEtiqueta>
      <TextInput
        placeholderTextColor={orbita.colors.mutedDim}
        accessibilityLabel={rotulo}
        {...input}
        style={[styles.campo, error ? styles.campoError : null]}
      />
      {error ? (
        <Text style={styles.campoErrorTexto} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Chip seleccionable (tipo de vínculo, signo). */
export function VChip({ label, activo, onPress }: { label: string; activo: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: activo }}
      style={({ pressed }) => [styles.chip, activo && styles.chipActivo, pressed && styles.botonApagado]}
    >
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{label}</Text>
    </Pressable>
  );
}

/** Opción grande con título, rótulo derecho y detalle (los tres niveles del paso 2). */
export function VOpcion({
  titulo,
  rotulo,
  detalle,
  activo,
  onPress
}: {
  titulo: string;
  rotulo: string;
  detalle: string;
  activo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: activo }}
      accessibilityLabel={`${titulo}. ${rotulo}. ${detalle}`}
      style={({ pressed }) => [styles.opcion, activo && styles.opcionActiva, pressed && styles.botonApagado]}
    >
      <View style={styles.opcionFila}>
        <Text style={styles.opcionTitulo}>{titulo}</Text>
        <Text style={[styles.opcionRotulo, activo && styles.opcionRotuloActivo]}>{rotulo}</Text>
      </View>
      <Text style={styles.opcionDetalle}>{detalle}</Text>
    </Pressable>
  );
}

/** Barra de conteo: rótulo, valor y una pista con uno o varios segmentos. */
export function VBarra({
  rotulo,
  valor,
  segmentos,
  escala
}: {
  rotulo: string;
  valor: string;
  /** Cada segmento es {cantidad, color}; se dibujan en orden sobre la escala común. */
  segmentos: ReadonlyArray<{ cantidad: number; color: string }>;
  escala: number;
}) {
  return (
    <View style={styles.barra} accessibilityLabel={`${rotulo}: ${valor}`}>
      <View style={styles.barraFila}>
        <Text style={styles.barraRotulo}>{rotulo}</Text>
        <Text style={styles.barraValor}>{valor}</Text>
      </View>
      <View style={styles.barraPista}>
        {segmentos.map((s, i) =>
          s.cantidad > 0 ? (
            <View
              key={i}
              style={{ backgroundColor: s.color, flexGrow: fraccionDeBarra(s.cantidad, escala), height: 6 }}
            />
          ) : null
        )}
        <View style={{ flexGrow: 1 - fraccionDeBarra(segmentos.reduce((a, s) => a + s.cantidad, 0), escala) }} />
      </View>
    </View>
  );
}

/** Chip redondo con inicial + nombre (encabezado de la comparación). */
export function VPersonaChip({ inicial, nombre, tono }: { inicial: string; nombre: string; tono: "cobre" | "azul" }) {
  return (
    <View style={styles.personaChip}>
      <View style={[styles.personaInicial, tono === "azul" && styles.personaInicialAzul]}>
        <Text style={styles.personaInicialTexto}>{inicial}</Text>
      </View>
      <Text style={styles.personaNombre}>{nombre}</Text>
    </View>
  );
}

/** Barra de progreso del alta: tres tramos, los cumplidos en cobre. */
export function VProgreso({ paso }: { paso: 1 | 2 | 3 }) {
  return (
    <View style={styles.progreso} accessibilityLabel={`Paso ${paso} de 3`}>
      {[1, 2, 3].map((n) => (
        <View key={n} style={[styles.progresoTramo, n <= paso && styles.progresoTramoActivo]} />
      ))}
    </View>
  );
}

/**
 * Cerco de error para las queries de Convex: `useQuery` lanza cuando el
 * servidor falla y sin esto se cae la pantalla entera. Muestra lo que reciba
 * en `fallback` y deja reintentar con `key`.
 */
export class VCerco extends Component<
  { fallback: (reintentar: () => void) => ReactNode; children: ReactNode },
  { error: boolean; intento: number }
> {
  state = { error: false, intento: 0 };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error) {
      return this.props.fallback(() => this.setState((s) => ({ error: false, intento: s.intento + 1 })));
    }
    return <View key={this.state.intento}>{this.props.children}</View>;
  }
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: orbita.colors.surface,
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.lg,
    borderWidth: 1,
    padding: orbita.spacing.xl
  },
  etiqueta: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  etiquetaGris: { color: orbita.colors.mutedDim },
  titular: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 32, lineHeight: 38, marginTop: orbita.spacing.md },
  texto: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 15, lineHeight: 22, marginTop: orbita.spacing.lg },
  nota: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.body, fontSize: 13, lineHeight: 18, marginTop: orbita.spacing.md },

  boton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: orbita.colors.bone,
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: orbita.spacing.xl
  },
  botonContorno: { backgroundColor: "transparent", borderColor: orbita.colors.line, borderWidth: 1 },
  botonCobre: { backgroundColor: orbita.colors.copper },
  botonCobreContorno: { backgroundColor: "transparent", borderColor: orbita.colors.copper, borderWidth: 1 },
  botonApagado: { opacity: 0.55 },
  botonTexto: { color: orbita.colors.onLight, fontFamily: orbita.fonts.monoMedium, fontSize: 13, letterSpacing: 1 },
  botonTextoContorno: { color: orbita.colors.bone },
  botonTextoCobre: { color: orbita.colors.onLight },
  botonTextoCobreContorno: { color: orbita.colors.copper },

  campoRotulo: { marginBottom: orbita.spacing.sm },
  campo: {
    backgroundColor: orbita.colors.background,
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.md,
    borderWidth: 1,
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.body,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: orbita.spacing.lg,
    paddingVertical: orbita.spacing.md
  },
  campoError: { borderColor: orbita.colors.danger },
  campoErrorTexto: { color: orbita.colors.danger, fontFamily: orbita.fonts.body, fontSize: 12, marginTop: orbita.spacing.xs },

  chip: {
    borderColor: orbita.colors.line,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: orbita.spacing.lg
  },
  chipActivo: { backgroundColor: "rgba(196,106,58,0.16)", borderColor: orbita.colors.copper },
  chipTexto: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 15 },
  chipTextoActivo: { color: orbita.colors.bone },

  opcion: {
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.md,
    borderWidth: 1,
    marginTop: orbita.spacing.md,
    padding: orbita.spacing.lg
  },
  opcionActiva: { backgroundColor: "rgba(196,106,58,0.10)", borderColor: orbita.colors.copper },
  opcionFila: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.md, justifyContent: "space-between" },
  opcionTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 16, flexShrink: 1 },
  opcionRotulo: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.monoMedium, fontSize: 10, letterSpacing: 1, textAlign: "right" },
  opcionRotuloActivo: { color: orbita.colors.copper },
  opcionDetalle: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 14, lineHeight: 20, marginTop: orbita.spacing.xs },

  barra: { marginTop: orbita.spacing.lg },
  barraFila: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" },
  barraRotulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 16 },
  barraValor: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 12 },
  barraPista: {
    backgroundColor: "rgba(244,238,228,0.08)",
    borderRadius: 3,
    flexDirection: "row",
    height: 6,
    marginTop: orbita.spacing.sm,
    overflow: "hidden"
  },

  personaChip: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.sm },
  personaInicial: {
    alignItems: "center",
    backgroundColor: "rgba(196,106,58,0.25)",
    borderColor: orbita.colors.copper,
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  personaInicialAzul: { backgroundColor: "rgba(140,166,196,0.22)", borderColor: orbita.colors.harmony },
  personaInicialTexto: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 12 },
  personaNombre: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 15 },

  progreso: { flexDirection: "row", gap: orbita.spacing.sm, marginTop: orbita.spacing.md },
  progresoTramo: { backgroundColor: "rgba(244,238,228,0.12)", borderRadius: 2, flex: 1, height: 3 },
  progresoTramoActivo: { backgroundColor: orbita.colors.copper }
});
