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
