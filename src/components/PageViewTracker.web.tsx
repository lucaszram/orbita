import { useEffect, useRef } from "react";
import { usePathname } from "expo-router";

import { INITIAL_PAGE_VIEW_STATE, type PageViewState, nextPageView } from "@/domain/pageView";
import { capturePageView, startAnalytics } from "@/services/analytics";

/**
 * Manda un `page_view` por pantalla de la web.
 *
 * Escucha `usePathname` en vez de los eventos del navegador porque la web de
 * Órbita es una SPA: navegar de `/` a `/empezar` no recarga el documento, así
 * que un pageview atado a `load` contaría una sola visita por sesión.
 *
 * Sin estado de React a propósito: la ruta ya vive en el router y el dedup va
 * en un ref, así que el tracker nunca provoca un render. No dibuja nada.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const state = useRef<PageViewState>(INITIAL_PAGE_VIEW_STATE);

  // Declarado primero para que el SDK exista antes del primer capture: en el
  // montaje los efectos corren en orden de declaración.
  useEffect(() => {
    startAnalytics();
  }, []);

  useEffect(() => {
    const step = nextPageView(state.current, pathname);
    state.current = step.state;
    if (step.capture !== null) capturePageView(step.capture);
  }, [pathname]);

  return null;
}
