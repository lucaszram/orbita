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
 * cambiaron una vez. La única `appearance` que existe es `SIN_ALTA_DE_CLERK`,
 * y no es tema: ver ahí por qué.
 *
 * Lo que SÍ es de Órbita se conserva: el escenario full-bleed del alta (el
 * mismo `Screen` con `A.splashBg`), el control de volver y la salida al alta.
 * Los dos pasan por `onBack`/`onCreateAccount`, que archivan los datos del
 * dueño anterior antes de dejar el equipo. La sesión y el bootstrap siguen
 * siendo de `AccountGate`, no de esta pantalla.
 */
/**
 * La ÚNICA excepción al "no se toca la UI de Clerk": se oculta su salida al
 * alta. No es un tema.
 *
 * La tarjeta oficial cierra con su propio pie «¿No tenés cuenta? Registrate»
 * apuntando a la instancia alojada (`…accounts.dev/sign-up`). Ese link es una
 * SEGUNDA salida al alta, y encima una insegura: se va de la pantalla sin pasar
 * por `onCreateAccount` → `leaveWithoutSignIn`, que archiva bajo su cuenta lo
 * del dueño anterior de este equipo y lo limpia antes de soltarlo. Quien toca
 * "crear cuenta" es, justamente, el que no pudo entrar como ese dueño: por ahí
 * el alta nueva heredaba guardadas y diario ajenos, y además salía del
 * onboarding canónico. Con el link propio de Órbita debajo, el pie de Clerk
 * quedaba encima duplicado.
 *
 * `signUpUrl` NO alcanza: cambia el destino del link, no el hecho de que sea
 * una salida que no ejecuta el callback. Sigue siendo la salida insegura, ahora
 * hacia adentro de Órbita.
 *
 * Por qué esto no tematiza ni recrea nada: no hay `baseTheme`, ni `variables`,
 * ni `layout`, ni un color, ni una tipografía — nada de lo que ya se rompió una
 * vez cuando esas variables internas cambiaron. Es UNA regla de visibilidad
 * sobre UN elemento, el que Órbita reemplaza por su propia salida. Todo lo
 * demás lo sigue pintando y resolviendo Clerk: campos, Google, errores, pasos,
 * y el resto de los pies de tarjeta (probar otro método, tengo problemas,
 * passkey), que son parte del flujo y no se tocan — por eso el selector lleva
 * modificador y no es `footerAction` a secas.
 *
 * El modificador es `__signIn` y no `__signUp`: nombra la tarjeta que emite el
 * pie, no el destino del link. En el DOM que renderiza `@clerk/expo` 3.6.5 ese
 * pie es `cl-footerAction cl-footerAction__signIn` (y su link,
 * `cl-footerActionLink`); con `__signUp` la regla no enganchaba con ningún
 * elemento y el link al alta seguía a la vista.
 *
 * `display: "none"` y no `visibility`/`opacity`: saca el link del orden de
 * tabulación y del árbol de accesibilidad. Escondido pero enfocable seguiría
 * siendo alcanzable con teclado o lector de pantalla, o sea seguiría siendo la
 * salida que se quiere sacar.
 *
 * Constante de módulo: identidad estable entre renders, para no reconfigurar el
 * componente montado en cada uno.
 */
const SIN_ALTA_DE_CLERK = { elements: { footerAction__signIn: { display: "none" } } } as const;

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
          <SignIn appearance={SIN_ALTA_DE_CLERK} />
        </View>

        {/* La ÚNICA salida al alta (la de Clerk queda oculta, ver arriba): es la
            que archiva y limpia lo del dueño anterior y entra al onboarding
            canónico. Va sin email: el campo ahora es de Clerk, así que no hay
            nada tipeado que Órbita pueda leer para no pedirlo dos veces. */}
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
