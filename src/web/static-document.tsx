import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { usePathname } from "expo-router";

import { OrbitaLanding } from "@/components/web/orbita-landing";
import { OrbitaPrivacy, OrbitaSupport, OrbitaTerms } from "@/components/web/orbita-legal";
import { BOOT_BACKGROUND } from "@/theme/boot";
import { RouteHead } from "@/web/route-head";
import { normalizePath } from "@/web/seo.mjs";

/**
 * ¿Este render es el del EXPORT ESTÁTICO?
 *
 * El render estático corre en Node: no hay `window`, no hay `document` y no hay
 * `localStorage`. En el navegador —y en nativo, donde React Native define
 * `global.window`— siempre es `false`, así que el árbol real de la app no
 * cambia en nada.
 */
export function isStaticRender(): boolean {
  return typeof window === "undefined";
}

/**
 * Las superficies públicas que el export puede dibujar sin sesión. Son los
 * componentes REALES —los mismos que monta el navegador—, no una copia del
 * texto: por eso el HTML emitido no puede decir algo distinto de lo que se ve.
 */
const PUBLIC_SURFACES: Record<string, () => React.ReactElement> = {
  "/": OrbitaLanding,
  "/privacy": OrbitaPrivacy,
  "/support": OrbitaSupport,
  "/terminos": OrbitaTerms
};

/**
 * La cáscara PÚBLICA que se emite a HTML (CORE-272).
 *
 * ## Por qué existe
 *
 * Con `expo.web.output: "static"` cada ruta se renderiza en Node al exportar. El
 * árbol real de la app no sobrevive ese render: `PendingDeletionBoundary` tapa
 * todo mientras lee el disco —y en Node esa lectura no resuelve nunca—, así que
 * las 91 páginas salían con el mismo spinner y sin un solo `<Head>` adentro. Y
 * un escalón más arriba, `BackendProviders` montaría Clerk y Convex en Node
 * cuando el build tiene las variables de entorno (Vercel las tiene; CI no).
 *
 * Por eso el layout raíz, y sólo durante ese render, monta esto en lugar del
 * árbol completo: la ficha de buscador de la ruta más la superficie pública que
 * le corresponde, sin proveedores, sin sesión y sin backend. Es exactamente lo
 * que ve alguien que llega sin cuenta, y es el MISMO componente que después
 * dibuja el navegador — no una copia del texto, así que no puede decir algo
 * distinto de lo que se ve.
 *
 * ## Qué pasa en el navegador
 *
 * Nada de esto se hidrata: `app/+html.tsx` apaga la hidratación de Expo Router,
 * así que el cliente arranca con `createRoot`, vacía `#root` y monta el árbol
 * real desde cero — igual que antes de esta tarjeta, cuando el documento traía
 * el bloque plano `#orbita-pre-js`. El comportamiento con sesión no cambia: el
 * gate resuelve y redirige como siempre.
 *
 * ## Las dos rutas públicas que NO traen cuerpo
 *
 * `/empezar` y `/iniciar-sesion` son puertas de cuenta: su contenido vive detrás
 * de `AccountGate`, que necesita la sesión para decidir qué mostrar. Emiten su
 * ficha completa —título, descripción, canónica, Open Graph— y el cuerpo lo
 * monta el navegador. Inventarles un HTML de relleno sería decir algo que la
 * página no muestra.
 */
export function WebStaticDocument() {
  const Surface = PUBLIC_SURFACES[normalizePath(usePathname())];

  return (
    // Mismo nodo y mismo color que el árbol real: el HTML estático ya se pinta
    // oscuro y el reemplazo del cliente no da un salto de blanco a negro.
    <SafeAreaProvider style={styles.root}>
      <RouteHead />
      {Surface ? <Surface /> : null}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: BOOT_BACKGROUND, flex: 1 }
});
