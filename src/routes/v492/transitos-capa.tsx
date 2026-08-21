import type { ReactElement } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import {
  MOMENTO_ROUTE,
  sectionLayerDetail,
  type SectionLayerDetail
} from "@/domain/detailOrigin";
import { AnoDetailScreen } from "@/screens/v492/AnoDetailScreen";
import { CumplelunaDetailScreen } from "@/screens/v492/CumplelunaDetailScreen";
import { EstacionDetailScreen } from "@/screens/v492/EstacionDetailScreen";
import { LunaDetailScreen } from "@/screens/v492/LunaDetailScreen";

/**
 * Qué pantalla abre cada capa.
 *
 * La tabla es exhaustiva por tipo: sumar una capa a `SECTION_LAYER_DETAILS` sin
 * darle pantalla no compila.
 *
 * `cumpleluna` y `luna` son las MISMAS pantallas que abre Hoy —la composición,
 * el copy y los estados siguen viviendo una sola vez en `screens/v492`—; lo
 * único que cambia es de qué stack cuelgan. `estacion` y `ano` son los detalles
 * nuevos de los dos ritmos que sólo esta sección muestra (QA22-024).
 */
const PANTALLA: Record<SectionLayerDetail, (props: { fallbackHref: string }) => ReactElement> = {
  estacion: EstacionDetailScreen,
  ano: AnoDetailScreen,
  cumpleluna: CumplelunaDetailScreen,
  luna: LunaDetailScreen
};

/**
 * El detalle de una capa, dentro del stack de Tránsitos
 * (`/transitos/capa/[layer]`).
 *
 * Ese es todo el punto: un detalle sólo puede volver al stack en el que se
 * apiló, así que abrirlo desde `Tu momento` con la ruta de Hoy cambiaba de
 * sección y `Atrás` caía en Hoy (QA22-027). Acá el `pop` devuelve a `Tu
 * momento` con su instancia y su punto de lectura intactos, porque esa pantalla
 * nunca se desmontó.
 *
 * Cuelga de `capa/` y no de la raíz de la sección por la misma razón que
 * `arco/`: un segmento dinámico suelto en `transitos/` se quedaría también con
 * `/transitos/momento`, y el desempate lo decidiría el router en vez del
 * producto.
 *
 * Una capa que la sección no abre —o una URL inventada— no monta nada: vuelve a
 * `Tu momento`, que es de donde se abren estos detalles.
 */
export default function CapaDetalleRoute() {
  const { layer } = useLocalSearchParams<{ layer?: string }>();
  const capa = sectionLayerDetail(layer);
  if (!capa) return <Redirect href={MOMENTO_ROUTE as never} />;
  const DetalleScreen = PANTALLA[capa];
  // `Tu momento` es el respaldo, no el camino normal: con historial —que es lo
  // que pasa al abrirlo desde la vista— manda el `pop` del stack.
  return <DetalleScreen fallbackHref={MOMENTO_ROUTE} />;
}
