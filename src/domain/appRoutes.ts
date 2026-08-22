import { Platform } from "react-native";

/**
 * Único destino que depende de la plataforma: `HOME_ROUTE`.
 *
 * En web, `app/(tabs)/index.tsx` y `app/index.tsx` resuelven los dos a `/`, así
 * que `router.replace("/(tabs)")` después del login caía en la landing pública
 * en vez de en la Home autenticada. La Home web tiene ruta propia (`/home`),
 * que monta exactamente la misma pantalla canónica.
 *
 * Es la ÚNICA diferencia de plataforma del flujo de entrada: misma pantalla de
 * alta, misma de login, mismo onboarding, misma Home.
 */
const IS_WEB = Platform.OS === "web";

/** Home autenticada después de entrar. */
export const HOME_ROUTE = IS_WEB ? "/home" : "/(tabs)";

/**
 * Ceremonia de recepción del día 1: la primera entrega después del alta.
 *
 * Es una ruta propia (`app/recepcion.tsx`), con la MISMA URL en las dos
 * plataformas — no vive dentro de `(tabs)`, así que no tiene el problema de
 * `/(tabs)` en web. Sólo la abre la salida del alta.
 *
 * Lo que hay del otro lado sí depende de la plataforma, y lo resuelve Metro
 * (`src/routes/v492/recepcion`): en web es la ceremonia completa, con su salida
 * a la carta o al pago; en nativo se marca la primera vez y se entra derecho a
 * la Carta del Perfil, que es donde vive ese activo.
 */
export const RECEPTION_ROUTE = "/recepcion";

/**
 * Onboarding canónico de 13 pasos, con la MISMA URL en las dos plataformas.
 *
 * Ya no es la entrada de quien no tiene sesión: se abre DESPUÉS de crear la
 * cuenta o de ingresar, cuando el resolver ve una cuenta sin alta natal. Sin
 * sesión el destino es `sign-in` y la entrada es `SIGN_UP_ROUTE`.
 *
 * En web ya no apunta a `/empezar`: esa ruta quedó como entrada auth-first
 * (manda al alta o al login), no como los pasos inmersivos. Mandar el
 * onboarding ahí cerraba un loop — el resolver pedía onboarding, `/empezar`
 * devolvía a la entrada y volvía a empezar.
 */
export const ONBOARDING_ROUTE = "/onboarding";

/**
 * Login canónico (`/iniciar-sesion`), igual en las dos plataformas.
 *
 * La otra mitad de la superficie `auth`, junto a `SIGN_UP_ROUTE`: acá vuelve
 * quien YA tiene cuenta. Después del login no decide esta ruta, decide el
 * resolver — onboarding, editor de datos natales o Home, según el estado remoto.
 */
export const SIGN_IN_ROUTE = "/iniciar-sesion";

/**
 * Editor de datos natales, igual en las dos plataformas.
 *
 * Es el destino de recuperación de una cuenta que YA existía y quedó incompleta
 * (`recovery: "edit_birth_data"`). No se la manda al alta: `completeBirthData`
 * es create-only y una cuenta existente volvería con conflicto. Acá se completa
 * y se recalcula sin borrar ni recrear nada.
 */
export const EDIT_BIRTH_DATA_ROUTE = "/editar-datos";

/**
 * Alta de cuenta (`/crear-cuenta`), igual en las dos plataformas.
 *
 * Es la ENTRADA canónica de quien no tiene sesión: el alta es auth-first, así
 * que la cuenta se crea ACÁ, con la UI oficial de Clerk, ANTES del onboarding.
 * Cuando empiezan los pasos inmersivos ya hay sesión y una cuenta donde
 * persistir; no hay borrador anónimo que confirmar después.
 *
 * Es una superficie `auth`, igual que `SIGN_IN_ROUTE`: sólo se muestra mientras
 * el destino resuelto es `sign-in` (ver `destinationAllows` en
 * `@/domain/accountDestination`). Con la sesión activa deja de decidir esta
 * ruta y decide el resolver, sobre el estado REMOTO de la cuenta: al onboarding
 * si falta el alta natal (`ONBOARDING_ROUTE`), al editor si la cuenta ya existía
 * y quedó incompleta (`EDIT_BIRTH_DATA_ROUTE`), o a Home si ya está completa
 * (`HOME_ROUTE`). Por eso el alta no puede sobrescribir una cuenta terminada.
 *
 * Acepta `?email=` para PRELLENAR el campo de Clerk cuando se llega desde un
 * link; no cambia el destino, que lo sigue resolviendo `AccountGate`.
 */
export const SIGN_UP_ROUTE = "/crear-cuenta";
