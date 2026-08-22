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

import { orbita } from "../theme";

/**
 * Ancho de la columna de formulario del alta.
 *
 * Cada paso es UNA pregunta con su control y un CTA al pie. A 720 el botón mide
 * media ventana y el paso se lee como una captura de teléfono estirada; a 1200,
 * con el copy a un lado y el control al otro, el título queda a la izquierda y
 * el picker lejos a la derecha, la nota se despega del control y el CTA se cae
 * abajo del pliegue. A 480 es una columna deliberada sobre el fondo full-bleed:
 * título, control, nota y CTA forman UNA secuencia vertical.
 *
 * Debajo de 480 la columna es ancho completo, así que el breakpoint es
 * implícito: el teléfono y el nativo quedan idénticos, sin ninguna rama por
 * ancho de ventana. El alta no vuelve a mirar el viewport para componer.
 */
const FORM_COLUMN = 480;

type Props = {
  /** Full-bleed immersive background asset. */
  bg?: ImageSourcePropType;
  /** Image opacity (kept high; the gradient handles legibility). */
  bgOpacity?: number;
  /** Strength of the dark legibility wash over the asset. */
  wash?: number;
  /** El contenido no entra en viewports bajos: se permite scroll. */
  scroll?: boolean;
  children: ReactNode;
};

/**
 * Shell inmersivo del alta: asset full-bleed + wash de legibilidad + safe area.
 *
 * El fondo ocupa el viewport entero —es atmósfera— y el CONTENIDO viaja en una
 * sola columna editorial centrada (`FORM_COLUMN`). No hay composición de
 * escritorio aparte: ni escenario ancho, ni segunda columna, ni piezas que se
 * muden de lugar según el ancho. Esa era la regresión — en un viewport bajo el
 * CTA quedaba cortado y los controles se separaban de su copy.
 *
 * `scroll` para los pasos densos que NO tienen scroll propio. Una pantalla que
 * ya monta su `ScrollView` con el CTA anclado afuera (Antes/Después, Cuenta,
 * Pago) no debe recibirlo: anidar los dos colapsa las alturas y el CTA termina
 * cientos de píxeles por debajo del viewport, sin que el marco pueda scrollear.
 */
export function Screen({ bg, bgOpacity = 1, wash = 0.55, scroll = false, children }: Props) {
  // Dos niveles a propósito: el externo garantiza el ancho completo y el interno
  // se centra con `alignSelf`. `alignItems: "center"` en el padre sobre un hijo
  // que declara `width: "100%"` deja el ancho a merced de cómo el motor cruce
  // alineación y porcentaje, y en react-native-web esa combinación colapsaba la
  // columna a su contenido: el alta salía como una tira angosta con el texto
  // cortado. Es la misma formulación que usa el lienzo de la app.
  const stage = (
    <View style={styles.stage}>
      <View style={styles.column}>{children}</View>
    </View>
  );

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
          /**
           * Un toque con el teclado abierto TIENE que llegar al control
           * (QA23-008).
           *
           * `keyboardShouldPersistTaps` por defecto es `"never"`: el primer
           * toque fuera del campo cierra el teclado y **no se entrega al hijo**.
           * El paso «¿Dónde naciste?» es exactamente eso —se tipea la ciudad y
           * se toca un resultado de la lista, con el teclado arriba—, así que el
           * primer toque no elegía nada y había que tocar dos veces. El editor
           * natal ya lo declaraba por su cuenta; acá vive el shell que montan los
           * pasos del alta, así que se declara una vez para todos.
           *
           * `"handled"` y no `"always"`: un toque en el fondo, en el título o en
           * el CTA sigue cerrando el teclado como siempre. Sólo se conserva
           * cuando el hijo de verdad atendió el toque.
           */
          <ScrollView
            style={styles.safe}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
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
  // `flexGrow: 1` y no `flex: 1`: el contenido tiene que poder crecer más que el
  // viewport (para eso está el scroll) pero llenarlo cuando sobra alto, que es
  // lo que mantiene el CTA apoyado abajo.
  scrollContent: { flexGrow: 1 },

  // `minHeight: 0` no es decorativo: en CSS un item flex arranca en
  // `min-height: auto` y NO se encoge por debajo de su contenido. Con un
  // `ScrollView` adentro (Antes/Después, Cuenta, Pago) eso hacía que el
  // contenedor creciera con el contenido en vez de acotarlo, y el CTA anclado
  // al pie terminaba fuera del viewport sin que nada pudiera scrollear.
  stage: { flex: 1, minHeight: 0, width: "100%" },
  // La columna del alta: la misma en teléfono y en monitor, centrada sobre el
  // fondo. `flex: 1` para que los pasos que anclan el CTA abajo hereden el alto.
  column: { alignSelf: "center", flex: 1, maxWidth: FORM_COLUMN, minHeight: 0, width: "100%" },
});
