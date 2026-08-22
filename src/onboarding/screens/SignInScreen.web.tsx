import { Pressable, StyleSheet, View } from "react-native";
import { SignIn } from "@clerk/expo/web";

import { Text } from "@/components/ui/text";
import { SIGN_UP_ROUTE } from "@/domain/appRoutes";

import { A } from "../assets";
import { AuthModeSwitch } from "../components/AuthModeSwitch";
import { Screen } from "../components/Screen";
import { Body, Title } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";
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
  /**
   * Salida al alta, y en web la ÚNICA: la monta el `AuthModeSwitch`, con el
   * email siempre VACÍO —acá el input es de Clerk y esta pantalla no tiene
   * ningún campo propio que leer—. El nativo sí pasa lo tipeado.
   */
  onCreateAccount: (email: string) => void;
  onBack: () => void;
};

/**
 * La ÚNICA excepción al "no se toca la UI de Clerk": se oculta SU salida al
 * alta, porque el `AuthModeSwitch` que va sobre la tarjeta ya es esa salida y
 * dos controles con el mismo destino no son dos ayudas. No es un tema.
 *
 * Por qué esto no tematiza ni recrea nada: no hay `baseTheme`, ni `variables`,
 * ni `layout`, ni un color, ni una tipografía — nada de lo que ya se rompió una
 * vez cuando esas variables internas cambiaron. Es UNA regla de visibilidad
 * sobre UN elemento. Todo lo demás lo sigue pintando y resolviendo Clerk:
 * campos, Google, errores, pasos, y el RESTO de los pies de tarjeta (probar
 * otro método, tengo problemas, passkey), que son parte del flujo y se quedan
 * — por eso el selector lleva modificador y no es `footerAction` a secas.
 *
 * El modificador es `__signIn` y no `__signUp`: nombra la tarjeta que EMITE el
 * pie, no el destino del link. En el DOM que renderiza `@clerk/expo` 3.6.5 ese
 * pie es `cl-footerAction cl-footerAction__signIn` (y su link,
 * `cl-footerActionLink`); con `__signUp` la regla no engancha con ningún
 * elemento y el link al alta sigue a la vista. Ya pasó una vez.
 *
 * `display: "none"` y no `visibility`/`opacity`: saca el link del orden de
 * tabulación y del árbol de accesibilidad. Escondido pero enfocable sería peor
 * que dejarlo visible — un control que un lector de pantalla anuncia y un ojo
 * no encuentra. Lo que queda accesible es el selector, que es un `Pressable`
 * real, enfocable, con rol, etiqueta y `accessibilityState.selected`.
 *
 * Constante de módulo: identidad estable entre renders, para no reconfigurar el
 * componente montado en cada uno.
 */
const SIN_PIE_DE_ALTA = { elements: { footerAction__signIn: { display: "none" } } } as const;

/**
 * 01C — Iniciar sesión, con la UI OFICIAL de Clerk (web).
 *
 * La otra mitad de la superficie `auth`, ahora que el alta es auth-first:
 * `/crear-cuenta` para quien todavía no tiene cuenta, `/iniciar-sesion` para
 * quien vuelve. Las dos montan el mismo componente oficial y las dos ofrecen el
 * mismo selector arriba, así que entrar por la puerta equivocada nunca deja a
 * nadie encerrado.
 *
 * `SignIn` de `@clerk/expo/web` es el componente alojado por Clerk: email,
 * contraseña, código, recuperación y los proveedores sociales que la instancia
 * tenga habilitados. Es la misma decisión que ya tomó el alta en
 * `ClerkSignUp.web.tsx` (`SignUp`), ahora del lado de la entrada.
 *
 * Acá corría un formulario propio (email → contraseña o código, reenvío, botón
 * de Google, mensajes de error) que reimplementaba la máquina de estados de
 * Clerk paso por paso: cada requisito nuevo de la instancia lo dejaba fuera de
 * sincronía y sin poder decirlo. El nativo lo conserva —`SignInScreen.tsx`, con
 * su propia superficie— porque ahí la oficial es otra.
 *
 * El subtítulo tampoco promete más «volvés directo a tu cielo, sin repetir el
 * onboarding». Con la cuenta creada ANTES de los pasos, entrar y que falte el
 * alta natal es un estado normal —se abandonó el onboarding a mitad— y ahí el
 * resolver manda a los pasos, no a Home. Lo que esta pantalla puede prometer es
 * seguir donde estabas, sea donde sea que eso caiga.
 *
 * Sin `routing` ni `path`: el login vive en una ruta única (`/iniciar-sesion`)
 * y no tiene sub-rutas propias, así que se usa el modo por defecto. Declarar un
 * `path` obligaría a un catch-all en el router.
 *
 * El tema NO se toca: es el que Clerk resuelve para la instancia. Pisarlo desde
 * acá acoplaba la pantalla a variables internas del componente, que ya
 * cambiaron una vez. La única `appearance` que existe no es tema — es UNA regla
 * de visibilidad sobre UN elemento (`SIN_PIE_DE_ALTA`, justificada arriba).
 *
 * ---
 *
 * UNA sola salida al alta, y visible: el `AuthModeSwitch`.
 *
 * Va arriba, debajo del subtítulo y a la misma altura que "Ingresar": se ve
 * antes de escribir nada y sin scrollear la tarjeta oficial. Es el mismo
 * selector que muestra `SignUpGateScreen`, visto desde el otro lado, así que
 * entrar por la puerta equivocada se corrige en el mismo gesto en las dos.
 *
 * `SIN_PIE_DE_ALTA` oculta el pie «¿No tenés cuenta? Registrate» de la
 * tarjeta. No es que sobrara por feo: con el selector arriba eran DOS controles
 * con el mismo destino, uno visible de entrada y otro al final de un formulario
 * que scrollea. Esa duplicación ya se observó al revés —pie oculto + enlace
 * propio de Órbita debajo— y el problema nunca fue cuál de los dos se dejaba,
 * sino que hubiera dos. Ahora hay uno, arriba, donde se lo busca.
 *
 * `signUpUrl={SIGN_UP_ROUTE}` SIGUE puesto aunque ese pie no se vea, por dos
 * razones distintas. Primero: `signUpUrl` no es sólo el href del pie — Clerk lo
 * usa para navegar al alta desde adentro del propio flujo, y esas navegaciones
 * no las tapa ninguna regla de CSS. Segundo: si la regla dejara de enganchar
 * (Clerk renombra la clase, la hoja no carga), lo que reaparece es un link a
 * `/crear-cuenta` y no a la instancia alojada (`…accounts.dev/sign-up`), que
 * crea la cuenta AFUERA de la app. O sea que el prop es el piso, no la
 * decoración: sacarlo convierte una falla de estilo en una fuga de alta.
 *
 * Y ya NO apunta a `ONBOARDING_ROUTE`: los 13 pasos hoy se abren con la sesión
 * ya activa —la cuenta va primero—, así que mandar ahí a alguien sin cuenta lo
 * devolvía a `sign-in`: la puerta del alta rebotando contra la de entrada.
 *
 * `transferable={false}` cierra el alta OPACA por el lado social. El contrato
 * instalado lo dice textual (`TransferableOption` en `@clerk/shared` 4.23.0,
 * que es lo que resuelve `@clerk/expo` 3.6.5 → `@clerk/react` 6.11.3): por
 * defecto es `true`, y en `false` «prevents opaque sign-ups when a user
 * attempts to sign in via OAuth with an email that doesn't exist». Sin esto,
 * "Continuar con Google" con un email desconocido crea la cuenta en silencio
 * desde la pantalla de login: quien vino a entrar queda registrado sin haberlo
 * pedido y sin haber visto el alta. Con `false`, Clerk resuelve qué decir y la
 * salida sigue siendo el selector, que va al alta de verdad.
 *
 * Por lo mismo NO se pasa `withSignUp`: el flujo combinado "iniciar sesión o
 * registrarse" haría el alta acá adentro, bajo el título y el copy de la
 * entrada. El alta tiene su superficie y su texto, y es a un clic del selector.
 *
 * Lo que estos props NO hacen: archivar los datos del dueño anterior de este
 * equipo. Eso no vive acá — está centralizado en `AccountGate` →
 * `runAccountBootstrap`, que al activarse la sesión archiva bajo SU dueño lo
 * local y lo limpia ANTES de decidir cualquier destino, incluso cuando la
 * cuenta nueva todavía no tiene `birthData`. Que es, además, el único momento
 * en que hay una cuenta real a la cual atribuir lo que sigue. No duplicar ni
 * debilitar ese paso desde esta pantalla.
 *
 * ---
 *
 * Lo que SÍ es de Órbita se conserva: el escenario full-bleed oscuro (`Screen`
 * con `A.splashBg`) y el control de volver, que pasa por `onBack` →
 * `leaveWithoutSignIn`. La sesión y el bootstrap siguen siendo de `AccountGate`,
 * y el destino de después lo decide el resolver sobre el estado REMOTO de la
 * cuenta, no esta pantalla.
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
        <Body style={styles.sub}>Iniciá sesión y seguí donde estabas.</Body>

        {/* Las dos puertas juntas y arriba, antes de la tarjeta: quien llega
            acá sin cuenta —o cae en "No encontramos una cuenta con ese email"—
            sale sin scrollear. Es la ÚNICA salida al alta de la pantalla: el
            pie de Clerk, que ofrecía la misma, queda oculto (ver arriba). */}
        <AuthModeSwitch
          mode="signIn"
          // Sin email: el campo lo dibuja Clerk y esta pantalla no lo lee. El
          // alta abre limpia en vez de prellenarse con algo inventado.
          onSignUp={() => onCreateAccount("")}
          // Ya estás en el login: reingresar a esta misma superficie reiniciaría
          // el paso de Clerk que estuviera a medio hacer.
          onSignIn={() => {}}
          style={styles.switch}
        />

        {/* Por qué estos tres props, en los bloques de arriba. */}
        <View style={styles.clerkZone}>
          <SignIn appearance={SIN_PIE_DE_ALTA} signUpUrl={SIGN_UP_ROUTE} transferable={false} />
        </View>
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
  switch: { marginTop: 22 },
});
