import { Redirect } from "expo-router";

// Ruta legada: los planes viven en `/paywall`. Se conserva sólo para que las
// navegaciones y los enlaces viejos caigan en la portada en vez de un 404.
export default function PlusScreen() {
  return <Redirect href="/" />;
}
