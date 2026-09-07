/**
 * En nativo no hay documento HTML y no hay buscador: la ficha de `RouteHead`
 * (`route-head.tsx`) es exclusivamente web. Esta variante existe para que el
 * layout raíz —que es COMPARTIDO— pueda montarla sin condicionales y sin
 * arrastrar `expo-router/head` al bundle nativo.
 */
export function RouteHead(_props: { path?: string; privateOnly?: boolean }) {
  return null;
}
