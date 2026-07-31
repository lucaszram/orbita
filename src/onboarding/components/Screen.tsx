import { type ReactNode } from "react";
import {
  ImageBackground,
  type ImageSourcePropType,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { useIsDesktop } from "@/hooks/useLayoutMode";

import { orbita } from "../theme";

/**
 * Ancho de la columna de lectura del alta en escritorio.
 *
 * No es "el móvil centrado": es la medida de una columna editorial. El resto
 * del viewport no queda vacío — lo ocupa la escena (`aside`) o el aire
 * deliberado de una composición centrada.
 */
const COPY_COLUMN = 520;
/**
 * Ancho de la columna en una escena CENTRADA. Más ancha que la de `split`
 * (520): ahí la columna es media composición y el resto lo ocupa la pieza; acá
 * es la composición entera y a 520 quedaba una tira angosta en el medio de un
 * monitor, con el aire repartido a los costados en vez de servir a algo.
 */
const STAGE_COLUMN = 720;
/** Tope de la composición completa en escritorio (columna + escena + aire). */
const STAGE_MAX = 1200;

export type ScreenLayout =
  /**
   * Escena centrada: la pantalla ES una pieza (splash, confirmaciones,
   * cálculo, cierre). En escritorio la columna se centra sobre el fondo
   * full-bleed con aire arriba y abajo; en móvil ocupa el ancho completo.
   */
  | "stage"
  /**
   * Dos columnas: copy y controles a un lado, la pieza visual/interactiva al
   * otro. En móvil `aside` cae DEBAJO del copy, que es exactamente el orden
   * que ya tenía la pantalla de teléfono.
   */
  | "split"
  /**
   * La pantalla compone el escenario ENTERO. Sin columna de 520: el contenido
   * usa todo el ancho del escenario y se ancla donde quiera.
   *
   * Es para la entrada: una marca chiquita centrada sobre un fondo cósmico de
   * 1440 se lee como una captura de teléfono en un monitor. La entrada se
   * compone como el hero editorial de Órbita —tipografía grande anclada abajo,
   * el asset dueño del resto del cuadro— y para eso necesita el ancho completo.
   */
  | "scene";

/**
 * Coloca la pieza visual de un paso UNA sola vez.
 *
 * En móvil vuelve como `inline`, para que la pantalla la renderice en su lugar
 * exacto del flujo (después del subtítulo, antes de la nota y del CTA). En
 * escritorio vuelve como `aside`, para la segunda columna. Las dos nunca son
 * no-nulas a la vez: un picker montado dos veces sería dos controles con el
 * mismo nombre accesible y dos fuentes de verdad para el mismo dato.
 *
 * Se resuelve en el árbol de React, no con CSS: el orden del DOM —y por lo
 * tanto el del lector de pantalla y el del tabulador— es el orden real de cada
 * composición, no un `order` que sólo mueve píxeles.
 */
export function useSplitSlot(node: ReactNode): { inline: ReactNode; aside: ReactNode | undefined } {
  const desktop = useIsDesktop();
  return desktop ? { inline: null, aside: node } : { inline: node, aside: undefined };
}

type Props = {
  /** Full-bleed immersive background asset. */
  bg?: ImageSourcePropType;
  /** Image opacity (kept high; the gradient handles legibility). */
  bgOpacity?: number;
  /** Strength of the dark legibility wash over the asset. */
  wash?: number;
  /** Composición de escritorio. En móvil las dos apilan igual. */
  layout?: ScreenLayout;
  /** Pieza visual/interactiva de la composición `split`. */
  aside?: ReactNode;
  /** El contenido no entra en viewports bajos: se permite scroll. */
  scroll?: boolean;
  children: ReactNode;
};

/**
 * Shell inmersivo del alta: asset full-bleed + wash de legibilidad + safe area.
 *
 * **La composición de escritorio es real, no un teléfono centrado.** El fondo
 * ocupa el viewport entero (es atmósfera), y encima se monta una de dos
 * composiciones: una escena centrada con aire deliberado, o dos columnas donde
 * el copy queda en una medida legible (520) y la pieza visual toma el resto.
 * En móvil las dos colapsan a la columna única de siempre, con las gutters
 * nativas: el teléfono y el nativo no cambian.
 *
 * `scroll` para los pasos densos que NO tienen scroll propio. Una pantalla que
 * ya monta su `ScrollView` con el CTA anclado afuera (Antes/Después, Cuenta,
 * Pago) no debe recibirlo: anidar los dos colapsa las alturas y el CTA termina
 * cientos de píxeles por debajo del viewport, sin que el marco pueda scrollear.
 */
export function Screen({
  bg,
  bgOpacity = 1,
  wash = 0.55,
  layout = "stage",
  aside,
  scroll = false,
  children,
}: Props) {
  const desktop = useIsDesktop();

  // En una escena centrada la columna se centra en el escenario. Antes sólo
  // tenía `maxWidth`, así que quedaba pegada al borde IZQUIERDO de los 1240 y
  // dejaba media pantalla muerta a la derecha: exactamente el "móvil metido en
  // un monitor" que había que sacar. En `split` no se centra — ahí la columna
  // ES la mitad izquierda de la composición.
  const column = (
    <View
      style={[
        styles.column,
        desktop && layout !== "scene" && styles.columnDesktop,
        desktop && layout === "stage" && styles.columnCentered
      ]}
    >
      {children}
    </View>
  );

  // `aside` SÓLO existe en escritorio. En móvil la pieza visual la coloca la
  // propia pantalla, en su lugar del flujo (ver `useSplitSlot`).
  //
  // Antes esto era `{column}{aside}`: en móvil la grilla de Align y los pickers
  // de fecha y hora caían DESPUÉS de la nota y del CTA, con un hueco vacío en
  // el lugar donde tenían que estar. El shell ya no puede volver a hacer eso:
  // fuera de la composición de dos columnas, `aside` se ignora.
  const composed =
    desktop && layout === "split" && aside ? (
      <View style={styles.split}>
        {column}
        <View style={styles.aside}>{aside}</View>
      </View>
    ) : (
      column
    );

  const stage = <View style={[styles.stage, desktop && styles.stageDesktop]}>{composed}</View>;

  return (
    <View style={styles.root}>
      {bg ? (
        <ImageBackground
          source={bg}
          style={StyleSheet.absoluteFill}
          // width/height/resizeMode van EXPLÍCITOS en `imageStyle`: en
          // react-native-web, pasar un imageStyle propio pisa el sizing por
          // defecto y el <img> queda a su tamaño intrínseco. Acá el fondo salía
          // a 393px dentro de un viewport de 318 y desbordaba el alta en móvil.
          imageStyle={{ height: "100%", opacity: bgOpacity, resizeMode: "cover", width: "100%" }}
          resizeMode="cover"
        >
          <LinearGradient
            colors={[
              `rgba(6,7,10,${Math.max(0, wash - 0.38)})`,
              `rgba(6,7,10,${Math.max(0, wash - 0.12)})`,
              `rgba(6,7,10,${wash})`,
              "rgba(6,7,10,0.88)",
            ]}
            locations={[0, 0.42, 0.68, 1]}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
      ) : null}
      <SafeAreaView style={styles.safe}>
        {scroll ? (
          <ScrollView
            style={styles.safe}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {stage}
          </ScrollView>
        ) : (
          stage
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: orbita.bg, flex: 1 },
  safe: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // Móvil: ancho completo, sin tope. Es la pantalla de teléfono de siempre.
  //
  // `minHeight: 0` no es decorativo: en CSS un item flex arranca en
  // `min-height: auto` y NO se encoge por debajo de su contenido. Con un
  // `ScrollView` adentro (Antes/Después, Cuenta, Pago) eso hacía que el
  // contenedor creciera con el contenido en vez de acotarlo, y el CTA anclado
  // al pie terminaba fuera del viewport sin que nada pudiera scrollear.
  stage: { flex: 1, minHeight: 0, width: "100%" },
  // Escritorio: la composición se centra y respira, con un tope generoso que
  // NO es el ancho de una columna de móvil.
  stageDesktop: { alignSelf: "center", maxWidth: STAGE_MAX, paddingHorizontal: 48, paddingVertical: 32 },

  // La columna de copy y controles.
  column: { flex: 1, minHeight: 0, width: "100%" },
  columnDesktop: { justifyContent: "center", maxWidth: COPY_COLUMN },
  // Escena centrada: columna de lectura ancha, centrada en el escenario.
  columnCentered: { alignSelf: "center", maxWidth: STAGE_COLUMN },

  // Dos columnas de escritorio: copy a la izquierda, escena a la derecha, con
  // el aire entre las dos como parte de la composición.
  split: { flex: 1, flexDirection: "row", gap: 64 },
  // `minWidth: 0`: un item flex arranca en `min-width: auto` y no baja de la
  // medida intrínseca de su contenido — una imagen adentro desbordaría la fila.
  aside: { flex: 1, justifyContent: "center", minHeight: 0, minWidth: 0 },
});
