/**
 * La advertencia de la PRIMERA confirmación al eliminar la cuenta (fallback
 * nativo; la web usa `accountDeletionCopy.web.ts`).
 *
 * Es la única frase del Perfil que enumera lo que se borra, y por eso es la
 * única que cambia por plataforma: enumerar de más promete una sección que este
 * producto no tiene. El Diario vive en la web; la app nativa V4.9.2 no lo
 * muestra en ninguna pantalla, así que nombrarlo acá le anunciaría a la persona
 * —justo cuando le pedimos que confirme un borrado irreversible— que está por
 * perder algo que nunca vio.
 *
 * Lo que sí guarda el producto nativo se dice completo: la carta, las lecturas
 * y los datos guardados. Nada de eso queda afuera del borrado, y el borrado
 * sigue siendo exactamente el mismo en las dos plataformas: lo que se separa es
 * el inventario visible, no el alcance de la operación.
 */
export const DELETE_ACCOUNT_WARNING =
  "Vas a borrar tu cuenta de Órbita y todos tus datos: tu carta, tus lecturas y tus datos guardados. Esta acción no se puede deshacer.";

/**
 * Aviso comercial de la misma confirmación.
 *
 * Borrar la cuenta de Órbita **no cancela** la suscripción: Apple es explícito
 * en que una suscripción de la App Store sobrevive al borrado de la cuenta de
 * la app y sigue cobrando hasta que la persona la cancele desde su Apple ID.
 * Lo mismo vale para Stripe en la web. Callarlo acá sería dejar a alguien
 * pagando por una cuenta que ya no existe, sin ninguna pantalla donde verlo.
 */
export const DELETE_ACCOUNT_SUBSCRIPTION_WARNING =
  "Si tenés Órbita Plus, tu suscripción no se cancela al borrar la cuenta y va a seguir cobrándose. Cancelala primero desde la gestión de tu suscripción y volvé después.";
