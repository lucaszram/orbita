import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { ClerkSignUp } from "../components/ClerkSignUp";
import { Screen } from "../components/Screen";
import { Body, Title } from "../components/Type";
import { GUTTER, SIGN_IN_LINK_ROW, SIGN_IN_LINK_TEXT } from "../theme";

type Props = {
  /** Vuelve al login. La única salida lateral de esta pantalla. */
  onSignIn: () => void;
  /**
   * Email que llega en el link (`/crear-cuenta?email=`). Sólo PRELLENA el campo
   * de Clerk: acá no hay campo propio que llenar ni nada que validar.
   */
  email?: string;
};

/**
 * `/crear-cuenta` — alta suelta, con la UI OFICIAL de Clerk.
 *
 * NO es la entrada del alta: el camino canónico crea la cuenta DENTRO del
 * onboarding, en su primera superficie ("Crear cuenta o ingresar"). Esta ruta
 * sobrevive para quien llegue con el link directo.
 *
 * Acá vivía un segundo formulario propio (email, contraseña, repetir
 * contraseña, código, reenvío, rama "ese email ya tiene cuenta"): una copia
 * que había que mantener dos veces y que se desfasaba con cada requisito nuevo
 * de la instancia de Clerk. Esta superficie monta el componente oficial.
 *
 * No se piden nombre ni apellido: son opcionales y nunca bloquean el alta.
 */
export function SignUpGateScreen({ onSignIn, email }: Props) {
  return (
    <Screen scroll>
      <View style={styles.body}>
        <Title>Creá tu cuenta.</Title>
        <Body style={styles.sub}>Guardamos tu carta y tus lecturas en un solo lugar.</Body>

        <View style={styles.clerkZone}>
          <ClerkSignUp email={email} />
        </View>

        <Pressable
          onPress={onSignIn}
          accessibilityRole="link"
          accessibilityLabel="Ya tengo cuenta: iniciar sesión"
          hitSlop={8}
          style={SIGN_IN_LINK_ROW}
        >
          <Text style={SIGN_IN_LINK_TEXT}>Ya tengo cuenta · Iniciar sesión</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 40, paddingHorizontal: GUTTER, paddingTop: 26 },
  clerkZone: { marginTop: 24, minHeight: 380, width: "100%" },
  sub: { marginTop: 10 }
});
