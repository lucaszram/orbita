import { StyleSheet, View } from "react-native";

import { AuthModeSwitch } from "../components/AuthModeSwitch";
import { ClerkSignUp } from "../components/ClerkSignUp";
import { Screen } from "../components/Screen";
import { Body, Title } from "../components/Type";
import { GUTTER } from "../theme";

type Props = {
  /**
   * Va al login. Es la otra mitad del selector: ya no es un enlace chico al pie
   * sino una de las dos puertas, a la misma altura que la del alta.
   */
  onSignIn: () => void;
  /**
   * Email que llega en el link (`/crear-cuenta?email=`). Sólo PRELLENA el campo
   * de Clerk: acá no hay campo propio que llenar ni nada que validar.
   */
  email?: string;
};

/**
 * `/crear-cuenta` — la ENTRADA auth-first, con la UI OFICIAL de Clerk.
 *
 * Primero la cuenta, después el onboarding. Antes era al revés: los quince
 * pasos arrancaban sin sesión y la cuenta se creaba recién en el paso 13, con
 * todo lo respondido colgando de un borrador local. Ahora esta pantalla es la
 * primera parada —por link directo o por el arranque del alta— y el onboarding
 * continúa con la sesión ya abierta.
 *
 * Acá vivía un segundo formulario propio (email, contraseña, repetir
 * contraseña, código, reenvío, rama "ese email ya tiene cuenta"): una copia del
 * de `AccountScreen` que había que mantener dos veces y que se desfasaba con
 * cada requisito nuevo de la instancia de Clerk. Ahora las dos superficies
 * montan el MISMO componente oficial.
 *
 * El enlace del pie («Ya tengo cuenta · Iniciar sesión») lo reemplaza
 * `AuthModeSwitch`. Siendo esta la primera pantalla, quien ya tiene cuenta no
 * puede depender de encontrar un enlace chico DEBAJO de un formulario de Clerk
 * que scrollea: las dos puertas se ven juntas, arriba, antes de escribir nada.
 *
 * No se piden nombre ni apellido: son opcionales y nunca bloquean el alta.
 */
export function SignUpGateScreen({ onSignIn, email }: Props) {
  return (
    <Screen scroll>
      <View style={styles.body}>
        <Title>Creá tu cuenta.</Title>
        <Body style={styles.sub}>Primero creás tu cuenta y después completás tus datos de nacimiento.</Body>

        <AuthModeSwitch
          mode="signUp"
          // Ya estás en el alta: reingresar a esta misma superficie vaciaría el
          // formulario de Clerk a medio llenar. El selector igual anuncia
          // "seleccionado" y sigue siendo enfocable.
          onSignUp={() => {}}
          onSignIn={onSignIn}
          style={styles.switch}
        />

        <View style={styles.clerkZone}>
          <ClerkSignUp email={email} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 40, paddingHorizontal: GUTTER, paddingTop: 26 },
  clerkZone: { marginTop: 24, minHeight: 380, width: "100%" },
  sub: { marginTop: 10 },
  switch: { marginTop: 22 }
});
