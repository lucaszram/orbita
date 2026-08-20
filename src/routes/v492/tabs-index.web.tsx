import { HomeScreen } from "@/screens/HomeScreen";

/**
 * Ruta histórica de la Home en web: sigue siendo exactamente lo de siempre, la
 * pantalla canónica `HomeScreen` (la web además la sirve en `/home`).
 *
 * En nativo esta ruta no pinta la Home: redirige a `Hoy` (ver `tabs-index.tsx`,
 * el archivo que Metro resuelve fuera de web).
 */
export default function Route() {
  return <HomeScreen />;
}
