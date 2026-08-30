import { Pressable, StyleSheet, View } from "react-native";

import { AppleMark, GoogleMark } from "@/components/brand/ProviderMarks";
import { Text } from "@/components/ui/text";

import { font, orbita } from "../theme";

/**
 * Botón de proveedor DIBUJADO POR ÓRBITA: cada uno en la superficie que pide SU
 * guía de marca.
 *
 * ## Quién lo usa (y quién ya no)
 *
 * - **Google**, siempre y en todas las plataformas: es el único botón de Google
 *   del acceso.
 * - **Apple, sólo fuera de iOS.** En iOS la vía es el botón NATIVO
 *   (`AppleAuthButton.ios.tsx`, `AppleAuthenticationButton` de
 *   `expo-apple-authentication`): ahí el texto, la localización, la tipografía,
 *   el logo y la accesibilidad los pone el sistema, y este archivo no participa.
 *   Acá queda el camino web, donde `APPLE_AUTH_ENABLED` puede encenderse por
 *   env y Apple se resuelve por navegador (`oauth_apple`), no por la hoja del
 *   sistema.
 *
 * Vive fuera de `AuthScreen` justamente por eso: la variante no-iOS de
 * `AppleAuthButton` lo necesita, y la pantalla no puede ser su dueña sin un
 * ciclo de imports.
 *
 * ## La marca
 *
 * En el slot va el vector OFICIAL del proveedor
 * (`@/components/brand/ProviderMarks`, copiado de los archivos de
 * `assets/orbita/auth/vendor/`), no una tipografía de íconos: FontAwesome
 * dibujaba una "G" monocroma que no es la marca de Google.
 *
 * **Apple va en blanco.** Sign in with Apple publica dos botones —blanco con la
 * manzana y el texto en negro, o negro con los dos en blanco— y hay que usar uno
 * de esos dos. La manzana blanca sobre la pastilla `bgElev` de Órbita no era
 * ninguno: parecía el botón negro sin serlo. Queda el blanco: `#FFFFFF` de
 * fondo, `#000000` en el logo (`tone="black"`, el archivo Black del DMG) y en el
 * texto.
 *
 * **Google queda oscuro.** Su guía sí admite la superficie oscura, y la G de
 * cuatro colores se sostiene mejor sobre ella.
 *
 * Todo lo demás es lo que ya había: 54 de alto, radio 27, el contorno de 1 pt,
 * la fila de 220x54 con el slot de 40x44 —así Apple y Google arrancan el logo y
 * el texto en la misma x aunque los vectores midan distinto— y el texto en Inter
 * Medium 16/22. Sin offset óptico: el margen ya viene adentro del canvas oficial
 * y moverlo sería retocar el vector. Callbacks, estados y accesibilidad no
 * cambian.
 */

/**
 * Geometría de la pastilla, en UNA sola fuente.
 *
 * El botón nativo de Apple toma exactamente estos dos números (`height` de su
 * marco, `cornerRadius` de su dibujo) para que la fila de proveedores mida lo
 * mismo en iOS que en el resto. Si alguien mueve uno, se mueven los dos.
 */
export const PROVIDER_HEIGHT = 54;
export const PROVIDER_RADIUS = 27;

/**
 * Texto de los botones de proveedor: Inter Medium 16/22, LITERAL y no
 * `StyleSheet.create` — en react-native-web una hoja registrada se compila a
 * clase y pierde contra `text-base` y `text-foreground` del `Text` compartido.
 * Acá pesa el doble: si la clase ganara, el negro de Apple saldría claro sobre
 * el fondo blanco y el botón quedaría ilegible.
 */
export const PROVIDER_TXT = {
  color: orbita.bone,
  fontFamily: font.sansMed,
  fontSize: 16,
  lineHeight: 22
} as const;
/** Apple en blanco: la manzana y el texto van en el negro de la guía. */
export const PROVIDER_TXT_APPLE = { ...PROVIDER_TXT, color: "#000000" } as const;

export function ProviderButton({
  icon,
  label,
  busy,
  disabled,
  onPress
}: {
  icon: "apple" | "google";
  label: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const off = busy || disabled;
  const apple = icon === "apple";
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: off }}
      style={[styles.provider, apple && styles.providerApple, off && styles.providerOff]}
    >
      <View style={styles.providerContent}>
        <View style={styles.providerIcon}>
          {apple ? <AppleMark tone="black" /> : <GoogleMark />}
        </View>
        <Text style={apple ? PROVIDER_TXT_APPLE : PROVIDER_TXT}>{busy ? "Un momento…" : label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  provider: {
    alignItems: "center",
    backgroundColor: orbita.bgElev,
    borderColor: orbita.bone,
    borderRadius: PROVIDER_RADIUS,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    height: PROVIDER_HEIGHT,
    justifyContent: "center"
  },
  // Apple en blanco: es uno de los dos botones que publica su guía. Sólo cambia
  // el fondo; alto, radio y contorno de 1 pt siguen siendo los de la pastilla.
  providerApple: { backgroundColor: "#FFFFFF" },
  // Fila fija de 220x54 con slot de marca de 40x44: Apple y Google arrancan el
  // logo en la misma x y el texto en la misma x, aunque los vectores midan
  // distinto. El slot es el canvas del vector, sin desplazamiento óptico.
  providerContent: { alignItems: "center", flexDirection: "row", gap: 10, height: PROVIDER_HEIGHT, width: 220 },
  providerIcon: { alignItems: "center", height: 44, justifyContent: "center", width: 40 },
  providerOff: { opacity: 0.55 }
});
