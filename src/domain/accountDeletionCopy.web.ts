/**
 * La advertencia de la PRIMERA confirmación al eliminar la cuenta, EN WEB.
 *
 * Texto sin cambios: la web sí tiene Diario y guardadas como secciones propias,
 * así que nombrarlas es exacto. El fallback nativo (`accountDeletionCopy.ts`)
 * enumera sólo lo que ese producto muestra.
 */
export const DELETE_ACCOUNT_WARNING =
  "Vas a borrar tu cuenta de Órbita y todos tus datos: tu carta natal, tus lecturas, tu diario y tus guardadas. Esta acción no se puede deshacer.";

/**
 * Aviso comercial, con el canal que corresponde a esta plataforma.
 *
 * El alcance es el mismo que en nativo —borrar la cuenta no cancela el cobro—
 * pero acá la suscripción se contrata y se cancela en el portal web.
 */
export const DELETE_ACCOUNT_SUBSCRIPTION_WARNING =
  "Si tenés Órbita Plus, tu suscripción no se cancela al borrar la cuenta y va a seguir cobrándose. Cancelala primero desde la gestión de tu suscripción y volvé después.";
