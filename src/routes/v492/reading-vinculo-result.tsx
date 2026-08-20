import { Redirect } from "expo-router";

/**
 * `/reading/vinculo-result` es el aviso de «Próximamente» del vínculo, que sólo
 * existe en web (ver `reading-vinculo-result.web.tsx`, que Metro resuelve ahí).
 *
 * En nativo V4.9.2 los vínculos ya son una pestaña con lecturas reales, así que
 * este archivo sólo redirige y no importa `DetailScreen` para no arrastrar el
 * árbol del ritual al bundle nativo.
 */
export default function Route() {
  return <Redirect href="/vinculos" />;
}
