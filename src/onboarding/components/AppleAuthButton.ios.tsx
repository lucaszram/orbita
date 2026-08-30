import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";

import { PROVIDER_HEIGHT, PROVIDER_RADIUS } from "./ProviderButton";

/**
 * "Continuar con Apple" en iOS: el botón NATIVO, no uno dibujado por Órbita.
 *
 * ## Por qué el nativo
 *
 * Las Human Interface Guidelines de Sign in with Apple exigen que el botón se
 * vea, se lea y se anuncie como el de Apple. `AppleAuthenticationButton` es ese
 * botón: el sistema pone el texto ("Continuar con Apple" en español, y el de
 * cada idioma sin que la app envíe una traducción), la tipografía, el logo, el
 * espaciado interno y la etiqueta de accesibilidad. La versión custom que vivía
 * acá los aproximaba a mano —un SVG, Inter Medium 16/22 y una traducción
 * propia— y eso es exactamente lo que App Review mira.
 *
 * Por eso este archivo NO dibuja ni un `Svg`, ni un `Text`, ni una familia
 * tipográfica, ni un tinte, ni un borde: no queda nada que pueda divergir del
 * botón oficial. Lo único que Órbita elige son las tres cosas que Apple deja
 * elegir: el tipo (`CONTINUE`, que es el copy que ya usaba la pantalla), el
 * estilo (`WHITE`, uno de los dos que publica la guía y el que ya tenía la
 * pastilla de Apple) y el radio.
 *
 * ## Geometría
 *
 * `PROVIDER_HEIGHT` / `PROVIDER_RADIUS` son los mismos números de la pastilla
 * de Google (54 y 27), importados de su fuente única: la fila de proveedores
 * tiene que medir igual con el botón nativo que sin él. El ancho es el de la
 * columna (`alignSelf: "stretch"` + `width: "100%"`), como el resto de las
 * acciones de la pantalla.
 *
 * ## Disponibilidad, sin salto de layout
 *
 * `isAvailableAsync()` es la única autoridad sobre si este botón puede
 * dibujarse: Apple lo exige, y en un dispositivo donde Sign in with Apple no
 * está disponible el botón nativo no debe aparecer. La respuesta es asíncrona,
 * así que mientras se resuelve se reserva EXACTAMENTE el marco que va a ocupar
 * (`slot`, alto 54): en el caso normal —disponible— el botón aparece dentro de
 * un hueco que ya estaba, y la fila no se mueve. Reservar es lo que evita el
 * salto; no reservar lo garantizaría en el caso común, que es el que se ve.
 *
 * Si NO está disponible el hueco se cierra y no queda un botón muerto. Ese
 * colapso es el único movimiento posible, y ocurre sólo donde el botón no
 * podría haber funcionado.
 *
 * ## Estado ocupado
 *
 * El nativo no tiene "Un momento…": su texto es del sistema y no se toca. Con
 * el acceso en curso el marco baja la opacidad y deja de recibir toques
 * (`pointerEvents`), que es la misma protección que aplica la pastilla custom
 * sin reescribir nada de Apple.
 */
export function AppleAuthButton({
  busy,
  disabled,
  onPress
}: {
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  // `null` = todavía no contestó. No es lo mismo que "no disponible": mientras
  // sea `null` el marco se reserva, y sólo un `false` explícito lo cierra.
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let vigente = true;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => {
        if (vigente) setAvailable(ok);
      })
      // Falla cerrado: si no se puede saber, no se ofrece la vía.
      .catch(() => {
        if (vigente) setAvailable(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  if (available === null) return <View style={styles.slot} />;
  if (!available) return null;

  const off = busy || disabled;
  return (
    <View style={[styles.slot, off && styles.off]} pointerEvents={off ? "none" : "auto"}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
        cornerRadius={PROVIDER_RADIUS}
        style={styles.button}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // El marco reservado: el mismo alto que la pastilla de Google, ancho de la
  // columna. Existe desde el primer frame, así que la fila no salta.
  slot: { alignSelf: "stretch", height: PROVIDER_HEIGHT },
  // El botón nativo necesita alto y ancho explícitos: no se mide solo.
  button: { height: PROVIDER_HEIGHT, width: "100%" },
  off: { opacity: 0.55 }
});
