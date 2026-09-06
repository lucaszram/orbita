import { v492 } from "@/components/v492/tokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Opciones comunes de los stacks de pestaña V4.9.2.
 *
 * El deslizamiento lateral al abrir un detalle es una animación como cualquier
 * otra: si el sistema pidió "Reducir movimiento", la transición se apaga y el
 * cambio de pantalla es inmediato. Sin esto, la única parte de la app que
 * ignoraría la preferencia sería justo la navegación.
 */
export function useLayerStackScreenOptions() {
  const reducedMotion = useReducedMotion();
  return {
    headerShown: false as const,
    contentStyle: { backgroundColor: v492.colors.background },
    animation: reducedMotion ? ("none" as const) : ("slide_from_right" as const)
  };
}
