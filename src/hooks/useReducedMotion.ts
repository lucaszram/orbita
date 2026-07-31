import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

import { reducedMotionInitialState } from "@/domain/reducedMotion";

/**
 * ¿La persona pidió menos movimiento? (iOS/Android: "Reducir movimiento";
 * navegador: `prefers-reduced-motion`).
 *
 * Órbita tiene animaciones que NO terminan solas —el pulso del Umbral late
 * mientras espera la respuesta—, y una animación infinita es justamente lo que
 * esta preferencia existe para apagar. `AccessibilityInfo` funciona igual en
 * nativo y en react-native-web (que lo mapea a la media query), así que no hay
 * dos caminos.
 *
 * El valor inicial es "no reducir": mientras la consulta asíncrona resuelve, la
 * animación arranca y se detiene en el siguiente render si corresponde. Nunca al
 * revés (arrancar detenido y saltar a animado se ve como un salto).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(reducedMotionInitialState());

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduced(value);
      })
      .catch(() => {
        // Sin respuesta del sistema se mantiene el default (animar).
      });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      if (alive) setReduced(value);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
