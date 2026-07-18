import { Redirect } from "expo-router";

// Órbita arranca gratuita (App Review): sin Plan Plus, precios ni suscripción.
// La ruta se conserva para navegaciones viejas, pero nunca muestra planes.
export default function PlusScreen() {
  return <Redirect href="/" />;
}
