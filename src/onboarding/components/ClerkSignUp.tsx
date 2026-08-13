import { StyleSheet, View } from "react-native";
import { AuthView } from "@clerk/expo/native";

import { orbita } from "../theme";

type Props = {
  /**
   * Email ya escrito antes de llegar acá. En nativo se ACEPTA pero no se usa:
   * `AuthView` no expone prellenado —sus únicas props son `mode`,
   * `isDismissible` y `onDismiss`— y la firma tiene que ser la misma que la de
   * `ClerkSignUp.web.tsx`, porque quien elige el archivo es Metro y las
   * pantallas montan el componente sin saber en qué plataforma corren.
   */
  email?: string;
};

/**
 * Alta de cuenta — UI OFICIAL de Clerk (nativo).
 *
 * `AuthView mode="signUp"` es la pantalla prearmada de Clerk: email, clave,
 * verificación y los proveedores sociales que la instancia tenga habilitados.
 * Órbita no monta ningún campo propio: el formulario custom que vivía acá
 * duplicaba la máquina de estados de Clerk (create → prepare → attempt →
 * setActive) y cada requisito nuevo de la instancia lo dejaba en
 * `missing_requirements` sin poder decirlo.
 *
 * `isDismissible={false}`: el alta está EMBEBIDA en el paso 13, no presentada
 * como modal. El botón de cierre que trae por defecto no tendría a dónde
 * cerrar —la vista es el contenido del paso— y dejaría un segundo control de
 * salida al lado del `Header`, que es el que sabe volver al paso anterior.
 *
 * NO se piden nombre ni apellido y NO se agrega ningún paso: si Clerk los
 * aporta (por ejemplo con Google) se conservan, y si no, el alta cierra igual.
 * Ver `src/domain/onboardingReadiness.ts`.
 *
 * La web usa `ClerkSignUp.web.tsx` (`SignUp` de `@clerk/expo/web`); Metro elige
 * el archivo por plataforma, igual que con `BirthPicker`.
 */
export function ClerkSignUp(_props: Props) {
  return (
    <View style={styles.host}>
      <AuthView mode="signUp" isDismissible={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: { backgroundColor: orbita.bg, flex: 1, minHeight: 0, width: "100%" }
});
