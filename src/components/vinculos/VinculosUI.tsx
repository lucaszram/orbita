import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { PEtiqueta } from "@/components/transitos/PanoramaUI";
import { orbita } from "@/theme/orbita";
import { usePressedState } from "@/components/v492/Touchable";

/**
 * Lo que Vínculos necesita y el kit compartido no tiene (CORE-233).
 *
 * Rótulos, textos, notas, tarjetas, botones, enlaces y barras salen de
 * `src/components/transitos/PanoramaUI.tsx` y `src/components/orbita/kit.tsx`,
 * los mismos que usan Hoy, Tránsitos y Carta: Vínculos no vuelve a definir su
 * propia escala ni su propio ritmo vertical. Acá quedan sólo las piezas de
 * formulario y de identidad de los frames `1761:2776`→`1761:3012` (alta) y
 * `1757:2515` / `1757:2674` (comparación): campo con rótulo, chip
 * seleccionable, opción de nivel, tramos de progreso, avatar con inicial y el
 * cerco de error de las queries. Sin datos propios: todo entra por props.
 */

/** Campo de texto con rótulo mono y error debajo. */
export function VCampo({
  rotulo,
  error,
  style,
  ...input
}: TextInputProps & { rotulo: string; error?: string; style?: object }) {
  return (
    <View style={style}>
      <PEtiqueta tono="gris" style={styles.campoRotulo}>
        {rotulo}
      </PEtiqueta>
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
  const presion = usePressedState();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: activo }}
      {...presion.pressableProps}
      style={[styles.chip, activo && styles.chipActivo, presion.pressed && styles.apagado]}
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
  const presion = usePressedState();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: activo }}
      accessibilityLabel={`${titulo}. ${rotulo}. ${detalle}`}
      {...presion.pressableProps}
      style={[styles.opcion, activo && styles.opcionActiva, presion.pressed && styles.apagado]}
    >
      <View style={styles.opcionFila}>
        <Text style={styles.opcionTitulo}>{titulo}</Text>
        <PEtiqueta tono={activo ? "cobre" : "gris"} style={styles.opcionRotulo}>
          {rotulo}
        </PEtiqueta>
      </View>
      <Text style={styles.opcionDetalle}>{detalle}</Text>
    </Pressable>
  );
}

/**
 * Tramos de progreso: `activos` de `total`, los cumplidos en cobre. Es la
 * misma pieza para «PASO 2 DE 3» del alta y «NIVEL 3 DE 3» de la biblioteca.
 */
export function VTramos({
  activos,
  total = 3,
  accessibilityLabel,
  style
}: {
  activos: number;
  total?: number;
  accessibilityLabel: string;
  style?: object;
}) {
  return (
    <View style={[styles.tramos, style]} accessible accessibilityLabel={accessibilityLabel}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.tramo, i < activos && styles.tramoActivo]} />
      ))}
    </View>
  );
}

/** Avatar redondo con inicial: `cobre` (la persona) o `azul` (la otra carta). */
export function VInicial({
  inicial,
  tono = "cobre",
  tamano = 32,
  activa
}: {
  inicial: string;
  tono?: "cobre" | "azul";
  tamano?: number;
  activa?: boolean;
}) {
  return (
    <View style={[styles.inicial, { height: tamano, width: tamano }, tono === "azul" && styles.inicialAzul, activa && styles.inicialActiva]}>
      <Text style={styles.inicialTexto}>{inicial}</Text>
    </View>
  );
}

/**
 * Los dos discos superpuestos de la comparación en escritorio (frame
 * `1757:2674`): la carta propia en cobre, la de la persona en el azul de
 * armonía, y debajo «Tu carta · Mara» en mono. Ilustra; los nombres van en
 * el texto, así que para el lector de pantalla es una imagen con rótulo.
 */
export function VDiscos({ nombre }: { nombre: string }) {
  return (
    <View style={styles.discos} accessible accessibilityRole="image" accessibilityLabel={`Tu carta y la de ${nombre}`}>
      <View style={styles.discosPar}>
        <View style={[styles.disco, styles.discoPropio]} />
        <View style={[styles.disco, styles.discoOtro]} />
      </View>
      <Text style={styles.discosRotulo}>{`Tu carta · ${nombre}`}</Text>
    </View>
  );
}

/** Chip con inicial + nombre (encabezado de la comparación). */
export function VPersonaChip({ inicial, nombre, tono }: { inicial: string; nombre: string; tono: "cobre" | "azul" }) {
  return (
    <View style={styles.personaChip}>
      <VInicial inicial={inicial} tono={tono} />
      <Text style={styles.personaNombre}>{nombre}</Text>
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
  apagado: { opacity: 0.55 },

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
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: orbita.spacing.lg
  },
  chipActivo: { backgroundColor: orbita.colors.copperTint16, borderColor: orbita.colors.copper },
  chipTexto: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 15 },
  chipTextoActivo: { color: orbita.colors.bone },

  opcion: {
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.md,
    borderWidth: 1,
    marginTop: orbita.spacing.md,
    padding: orbita.spacing.lg
  },
  opcionActiva: { backgroundColor: orbita.colors.copperTint10, borderColor: orbita.colors.copper },
  opcionFila: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.md, justifyContent: "space-between" },
  opcionTitulo: { color: orbita.colors.bone, flexShrink: 1, fontFamily: orbita.fonts.body, fontSize: 16 },
  opcionRotulo: { fontSize: 10, textAlign: "right" },
  opcionDetalle: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 14, lineHeight: 20, marginTop: orbita.spacing.xs },

  tramos: { flexDirection: "row", gap: orbita.spacing.sm },
  tramo: { backgroundColor: orbita.colors.boneTint12, borderRadius: 2, flex: 1, height: 3 },
  tramoActivo: { backgroundColor: orbita.colors.copper },

  inicial: {
    alignItems: "center",
    backgroundColor: orbita.colors.copperTint25,
    borderColor: orbita.colors.copper,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center"
  },
  inicialAzul: { backgroundColor: orbita.colors.harmonyTint22, borderColor: orbita.colors.harmony },
  inicialActiva: { backgroundColor: orbita.colors.copperTint45 },
  inicialTexto: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 12 },

  personaChip: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.sm },

  discos: { alignItems: "center" },
  discosPar: { flexDirection: "row", height: 64, width: 112 },
  disco: { borderRadius: 999, borderWidth: 1, height: 64, position: "absolute", top: 0, width: 64 },
  discoPropio: { backgroundColor: orbita.colors.copperTint45, borderColor: orbita.colors.copper, left: 0 },
  discoOtro: { backgroundColor: orbita.colors.harmonyTint22, borderColor: orbita.colors.harmony, left: 48 },
  discosRotulo: { color: orbita.colors.muted, fontFamily: orbita.fonts.mono, fontSize: 12, letterSpacing: 0.5, marginTop: orbita.spacing.md },
  personaNombre: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 15 }
});
