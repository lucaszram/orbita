import { createContext, useContext, type ReactNode } from "react";

import type { LayoutMode } from "@/domain/webLayout";

/**
 * Modo de layout compartido (`mobile` | `desktop`).
 *
 * El valor lo publica el shell web —el único que lee el viewport— y lo consumen
 * las pantallas canónicas. El default es `mobile`, así que sin provider (o sea:
 * en nativo, y en cualquier ruta web fuera del shell) el comportamiento es
 * exactamente el de siempre.
 */
const LayoutModeContext = createContext<LayoutMode>("mobile");

export function LayoutModeProvider({ mode, children }: { mode: LayoutMode; children: ReactNode }) {
  return <LayoutModeContext.Provider value={mode}>{children}</LayoutModeContext.Provider>;
}

export function useLayoutMode(): LayoutMode {
  return useContext(LayoutModeContext);
}

/** Azúcar para las composiciones: `useLayoutMode() === "desktop"`. */
export function useIsDesktop(): boolean {
  return useContext(LayoutModeContext) === "desktop";
}
