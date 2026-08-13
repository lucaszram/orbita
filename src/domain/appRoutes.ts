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
 * Es una ruta propia (`app/recepcion.tsx`), igual en las dos plataformas — no
 * vive dentro de `(tabs)`, así que no tiene el problema de `/(tabs)` en web.
 * Sólo la abre la salida del alta; desde ahí se sigue a la carta, a la paywall
 * o a `HOME_ROUTE`.
 */
export const RECEPTION_ROUTE = "/recepcion";

/** Onboarding canónico de 15 pasos. */
export const ONBOARDING_ROUTE = IS_WEB ? "/empezar" : "/onboarding";

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
 * paso canónico de la secuencia V4.4 (`14 / Create Account`, índice 13), cuando
 * ya hay una carta que guardar. Ni la landing ni el login mandan acá — los dos
 * abren `ONBOARDING_ROUTE`.
 *
 * Queda como ruta directa para quien ya tiene el link: al verificar el email el
 * resolver reevalúa y `AccountGate` manda al onboarding (o a Home si la cuenta
 * ya estuviera completa).
 */
export const SIGN_UP_ROUTE = "/crear-cuenta";
