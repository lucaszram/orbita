import { StyleSheet, View } from "react-native";
import { SignUp } from "@clerk/expo/web";

type Props = {
  /**
   * Email que la persona ya escribió antes de llegar acá (`?email=` del login,
   * o el borrador del alta). Es un PRELLENADO, no un dato del alta: Clerk sigue
   * siendo el dueño del campo y la persona puede cambiarlo.
   */
  email?: string;
};

/**
 * Alta de cuenta — UI OFICIAL de Clerk (web).
 *
 * `SignUp` de `@clerk/expo/web` es el componente alojado por Clerk: email,
 * clave, verificación y los proveedores sociales de la instancia. Órbita no
 * agrega campos ni pasos, y en particular NO pide nombre ni apellido: son
 * opcionales y su ausencia nunca bloquea el alta.
 *
 * Sin `routing` ni `path`: el alta vive DENTRO del flujo (paso 13) y no tiene
 * rutas propias, así que se usa el modo por defecto del componente. Declarar un
 * `path` obligaría a un catch-all en el router.
 *
 * Tampoco se pisa la `appearance`: el tema es el que Clerk resuelve para la
 * instancia. Personalizarlo desde acá acoplaba el alta a variables internas del
 * componente, que ya cambiaron una vez.
 */
export function ClerkSignUp({ email }: Props) {
  // Sólo se prellena con un email REAL. `initialValues: { emailAddress: "" }`
  // es un prellenado vacío: le entrega a Clerk un valor que no existe y deja el
  // campo en un estado "tocado" que no corresponde a nada que se haya escrito.
  const prefill = email?.trim() ?? "";

  return (
    <View style={styles.host}>
      <SignUp initialValues={prefill ? { emailAddress: prefill } : undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: { alignSelf: "center", maxWidth: 460, width: "100%" }
});
