// Subpath por locale a propósito. Importar desde la raíz (`@clerk/localizations`)
// mete los ~40 idiomas del paquete: el bundle web pasaba de 4,9 MB a 10,1 MB.
import { esES } from "@clerk/localizations/es-ES";

/**
 * Localización de Clerk para Órbita.
 *
 * `esES` cubre los flujos que usamos (entrar, crear cuenta, verificación por
 * código, recuperación, errores de validación, botones y textos de carga). De
 * las 837 claves sólo 12 coinciden con `enUS`, y todas son nombres propios
 * ("SAML", "Okta", "Logo", "Plan") o pertenecen a organizaciones/SSO/billing de
 * Clerk, que Órbita no usa.
 *
 * `OVERRIDES` queda para lo que aparezca en inglés en pantalla y sí nos toque:
 * se sobrescriben SOLO esas claves, no se reescribe la traducción.
 */
const OVERRIDES = {
  // Verificado en navegador contra el flujo real: no quedó ningún string en
  // inglés dentro de los componentes que montamos. Lo único corregido son dos
  // interrogaciones sin signo de apertura que trae `esES`.
  formFieldAction__forgotPassword: "¿Olvidaste tu contraseña?",

  // Voz de Órbita. `esES` es español peninsular y mezcla registros: "¿No tienes
  // cuenta?" (tú) junto a "Regístrese" e "Ingrese su dirección" (usted),
  // mientras la marca escribe en voseo ("Entrá", "Guardá"). Se ajustan SOLO las
  // claves visibles en el alta y el login montados; el resto de la traducción
  // queda como viene.
  formFieldInputPlaceholder__emailAddress: "Ingresá tu dirección de correo electrónico",
  formFieldInputPlaceholder__password: "Ingresá tu contraseña",
  // `esES` no traduce 550 claves que sí existen en `enUS`. Casi todas son de
  // passkeys, SSO empresarial, API keys y proveedores de código por teléfono,
  // que Órbita no usa. Se traducen SOLO las alcanzables en el flujo real de
  // email + contraseña; el resto queda como viene.
  formFieldInputPlaceholder__signUpPassword: "Creá una contraseña",
  formFieldInput__emailAddress_format: "Formato de ejemplo: nombre@ejemplo.com",
  signIn: {
    ...esES.signIn,
    start: {
      ...esES.signIn?.start,
      // Ausente en `esES`: con `withSignUp` el formulario combinado mostraba
      // "Continue to Orbita" en inglés.
      titleCombined: "Entrá a {{applicationName}}",
      actionText: "¿No tenés cuenta?",
      actionLink: "Registrate"
    },
    passwordCompromised: { ...esES.signIn?.passwordCompromised, title: "Contraseña comprometida" },
    passwordUntrusted: { ...esES.signIn?.passwordUntrusted, title: "Contraseña no confiable" },
    protectCheck: {
      title: "Verificando tu pedido",
      subtitle: "Esperá un momento mientras lo verificamos.",
      loading: "Cargando…",
      retryButton: "Probá de nuevo"
    }
  },
  signUp: {
    ...esES.signUp,
    start: {
      ...esES.signUp?.start,
      title: "Creá tu cuenta",
      titleCombined: "Creá tu cuenta",
      actionText: "¿Ya tenés cuenta?"
    },
    protectCheck: {
      title: "Verificando tu pedido",
      subtitle: "Esperá un momento mientras lo verificamos.",
      loading: "Cargando…",
      retryButton: "Probá de nuevo"
    }
  },
  reverification: {
    ...esES.reverification,
    alternativeMethods: {
      ...esES.reverification?.alternativeMethods,
      getHelp: {
        ...esES.reverification?.alternativeMethods?.getHelp,
        title: "¿Necesitás ayuda con la verificación?"
      }
    }
  }
} satisfies Partial<typeof esES>;

export const orbitaEsES = { ...esES, ...OVERRIDES };
