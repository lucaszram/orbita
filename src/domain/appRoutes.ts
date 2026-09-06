import { Platform } from "react-native";

/**
 * Destinos que dependen de la plataforma.
 *
 * En web, `app/(tabs)/index.tsx` y `app/index.tsx` resuelven los dos a `/`, así
 * que `router.replace("/(tabs)")` después del login caía en la landing pública
 * en vez de en la Home autenticada. La Home web tiene ruta propia (`/home`),
 * que monta exactamente la misma pantalla canónica.
 *
 * Es la ÚNICA diferencia de plataforma del flujo de entrada: misma pantalla de
 * login, mismo onboarding, misma Home.
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

/** Onboarding canónico (auth primero → Carta). */
export const ONBOARDING_ROUTE = IS_WEB ? "/empezar" : "/onboarding";

/**
 * La Carta como pestaña: el destino FINAL del onboarding aprobado.
 *
 * En nativo la Carta vive en la raíz de la última pestaña (`perfil`, con
 * título "Carta"); `/(tabs)/carta` y `/perfil/carta` son redirects legados a
 * esta misma raíz. En web la Carta tiene su ruta propia dentro de las tabs.
 *
 * `/recepcion` ya no participa de ningún camino nuevo: queda sólo por
 * compatibilidad con instalaciones o enlaces anteriores.
 */
export const CARTA_TAB_ROUTE = IS_WEB ? "/(tabs)/carta" : "/perfil";

/** Login canónico (`/iniciar-sesion`), igual en las dos plataformas. */
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
 * Formulario de alta suelto.
 *
 * NO es la entrada del alta: la cuenta se crea DENTRO del onboarding, en su
 * primera superficie ("Crear cuenta o ingresar"). Ni la landing ni el login
 * mandan acá — los dos abren `ONBOARDING_ROUTE`.
 *
 * Queda como ruta directa para quien ya tiene el link: al verificar el email el
 * resolver reevalúa y `AccountGate` manda al onboarding (o a Home si la cuenta
 * ya estuviera completa).
 */
export const SIGN_UP_ROUTE = "/crear-cuenta";
