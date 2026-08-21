import { Redirect } from "expo-router";

/**
 * La web no tiene los detalles de capa: sus lecturas del día viven en `/home`.
 *
 * Es la misma decisión que toma el stack de Hoy —`app/(tabs)/hoy/_layout.tsx`
 * manda a `/home` en web— y es una redirección y nada más: sin importar las
 * pantallas nativas, el bundle web no las arrastra.
 */
export default function CapaDetalleRoute() {
  return <Redirect href="/home" />;
}
