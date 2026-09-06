/**
 * Qué pasa cuando se toca una pestaña de la barra.
 *
 * Vivía dentro del `onPress` de `OrbitaTabBar`, entre el `emit` y el `navigate`,
 * así que lo único verificable era que las dos llamadas existieran. La decisión
 * —re-tocar la activa no navega, el navegador puede vetar el toque, y una
 * sección puede necesitar abrirse SIEMPRE en su raíz— no se probaba.
 *
 * ## El defecto que cierra
 *
 * `Ahora` y `Tu momento` no son una pantalla y su detalle: son DOS VISTAS de la
 * misma sección, y el selector cambia de ruta con `replace`. Como `navigate` a
 * secas devuelve la sección tal como quedó, después de mirar `Tu momento` tocar
 * `Tránsitos` en la barra devolvía a `Tu momento`: la pestaña se llamaba como la
 * vista que no abría y no había forma de llegar a `Ahora` desde la barra.
 *
 * Por eso Tránsitos declara su raíz y el destino se pide explícito. Las demás
 * pestañas no la declaran y siguen navegando como siempre, que es lo correcto:
 * volver a Vínculos y encontrar el vínculo que estabas mirando es lo esperado.
 *
 * Es un módulo puro —entra el nombre de la ruta y el estado del toque, sale qué
 * hacer— así que se prueba entero sin montar la barra ni el navegador.
 */

/**
 * Las pestañas que SIEMPRE se abren en su raíz, con la pantalla a la que van.
 *
 * Es una tabla y no un `if` para que agregar una sección con el mismo problema
 * sea una línea, y para que la lista de excepciones se pueda leer de un vistazo.
 */
export const TAB_ROOT_SCREEN: Record<string, string> = {
  transitos: "index"
};

/** Qué hacer con el toque. `none` = no se navega a ningún lado. */
export type TabPressAction =
  | { kind: "none" }
  | {
      kind: "navigate";
      /** La pestaña de destino. */
      name: string;
      /**
       * La pantalla del stack anidado que hay que abrir, o `null` para dejar la
       * sección donde estaba.
       */
      screen: string | null;
    };

const NO_NAVEGAR: TabPressAction = { kind: "none" };

/**
 * La decisión, en el orden en que importa:
 *
 * 1. **La pestaña activa no navega.** Re-tocarla ya la maneja el navegador
 *    —vuelve al principio del stack de esa sección— y navegar además duplicaría
 *    el gesto.
 * 2. **Un `tabPress` vetado gana.** Si algo llamó a `preventDefault`, la barra
 *    no lo pisa: el veto existe justamente para que una pantalla pueda quedarse.
 * 3. **La raíz declarada manda.** Con una raíz en la tabla el destino es
 *    explícito, así que no importa en qué vista de esa sección se había quedado
 *    la persona. Sin raíz, se navega a la pestaña y la sección decide.
 */
export function tabPressAction(input: {
  /** Nombre de la ruta de la pestaña (`hoy`, `transitos`, …). */
  name: string;
  /** Es la pestaña que ya está abierta. */
  focused: boolean;
  /** El evento `tabPress` fue vetado. */
  defaultPrevented: boolean;
}): TabPressAction {
  if (input.focused || input.defaultPrevented) return NO_NAVEGAR;
  return {
    kind: "navigate",
    name: input.name,
    screen: TAB_ROOT_SCREEN[input.name] ?? null
  };
}
