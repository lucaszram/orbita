import { Pressable, StyleSheet, View } from "react-native";
import { SignIn } from "@clerk/expo/web";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { Screen } from "../components/Screen";
import { Body, Title } from "../components/Type";
import { font, GUTTER, orbita, SIGN_IN_LINK_ROW, SIGN_IN_LINK_TEXT } from "../theme";
import { type SignInFlow } from "../useAccount";

type Props = {
  /**
   * La máquina de estados del login propio. En web se ACEPTA pero no se usa:
   * identificar el email, elegir el factor, verificarlo y activar la sesión es
   * trabajo del componente oficial. La firma tiene que ser la MISMA que la de
   * `SignInScreen.tsx`, porque quien elige el archivo es Metro y la ruta monta
   * la pantalla sin saber en qué plataforma corre.
   */
  flow: SignInFlow;
  /**
   * Idem: la sesión la activa Clerk por su cuenta y `AccountGate` reevalúa el
   * destino y desmonta esta pantalla. No hay nada que avisar a mano.
   */
  onSignedIn: () => Promise<void>;
  /** Salida al alta. Archiva lo del dueño anterior antes de soltar el equipo. */
  onCreateAccount: (email: string) => void;
  onBack: () => void;
};

/**
 * 01C — Iniciar sesión, con la UI OFICIAL de Clerk (web).
 *
 * `SignIn` de `@clerk/expo/web` es el componente alojado por Clerk: email,
 * contraseña, código, recuperación y los proveedores sociales que la instancia
 * tenga habilitados. Es la misma decisión que ya tomó el alta en
 * `ClerkSignUp.web.tsx` (`SignUp`), ahora del lado de la entrada.
 *
 * Acá corría un formulario propio (email → contraseña o código, reenvío, botón
 * de Google, mensajes de error) que reimplementaba la máquina de estados de
 * Clerk paso por paso: cada requisito nuevo de la instancia lo dejaba fuera de
 * sincronía y sin poder decirlo. El nativo lo conserva —`SignInScreen.tsx`, sin
 * cambios— porque ahí la superficie oficial es otra.
 *
 * Sin `routing` ni `path`: el login vive en una ruta única (`/iniciar-sesion`)
 * y no tiene sub-rutas propias, así que se usa el modo por defecto. Declarar un
 * `path` obligaría a un catch-all en el router.
 *
 * Tampoco se pisa el tema: el que Clerk resuelve para la instancia. Ajustarlo
 * desde acá acoplaba la pantalla a variables internas del componente, que ya
 * cambiaron una vez.
 *
 * Lo que SÍ es de Órbita se conserva: el escenario full-bleed del alta (el
 * mismo `Screen` con `A.splashBg`), el control de volver y la salida al alta.
 * Los dos pasan por `onBack`/`onCreateAccount`, que archivan los datos del
 * dueño anterior antes de dejar el equipo. La sesión y el bootstrap siguen
 * siendo de `AccountGate`, no de esta pantalla.
 */
export function SignInScreen({ onCreateAccount, onBack }: Props) {
  return (
    <Screen bg={A.splashBg} bgOpacity={0.9} wash={0.55} scroll>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Text style={styles.chev}>‹</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        <Title>Bienvenido{"\n"}de nuevo.</Title>
        <Body style={styles.sub}>
          Iniciá sesión y volvés directo a tu cielo — sin repetir el onboarding.
        </Body>

        <View style={styles.clerkZone}>
          <SignIn />
        </View>

        {/* Salida al alta. Va sin email: el campo ahora es de Clerk, así que no
            hay nada tipeado que Órbita pueda leer para no pedirlo dos veces. */}
        <Pressable
          onPress={() => onCreateAccount("")}
          accessibilityRole="link"
          accessibilityLabel="Todavía no tengo cuenta: crear una cuenta"
          style={SIGN_IN_LINK_ROW}
        >
          <Text style={SIGN_IN_LINK_TEXT}>Todavía no tengo cuenta · Crear una cuenta</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // 44px reales y no `hitSlop`: en web ese prop no agranda nada.
  backBtn: { alignItems: "flex-start", justifyContent: "center", minHeight: 44, minWidth: 44 },
  // Sin `flex: 1`, igual que la puerta de alta: el contenido crece con el
  // componente oficial y scrollea el shell. Un hijo `flex: 1` dentro del
  // contenido de un ScrollView puede encogerse por debajo de su contenido en
  // react-native-web y recortar justo lo que hay que ver.
  body: { paddingBottom: 40, paddingHorizontal: GUTTER, paddingTop: 26 },
  chev: { color: orbita.bone, fontFamily: font.sans, fontSize: 26, lineHeight: 30 },
  // Alto mínimo mientras Clerk carga: sin él la franja colapsa y el resto de la
  // pantalla salta cuando el componente aparece.
  clerkZone: { marginTop: 24, minHeight: 380, width: "100%" },
  header: { paddingHorizontal: GUTTER, paddingTop: 6 },
  sub: { marginTop: 10 },
});
