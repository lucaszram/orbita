import { StyleSheet, View } from "react-native";

import { CycleRing, MoonDial } from "@/components/home/hoy/HoyDials";
import { HoyMedidor, HoyMeta, HoyNota, HoySubtitulo, HoyTexto } from "@/components/home/hoy/HoyLayout";
import type { CumplelunaVista, LunaVista } from "@/domain/lunaCarta";
import { orbita } from "@/theme/orbita";

/**
 * Los dos módulos que salen del mismo sobre (`home.getLunaSobreLaCarta`):
 * `LA LUNA EN TU CARTA` y `CUMPLELUNA`.
 *
 * Ninguno de los dos abre un detalle: `/hoy/luna` y `/hoy/cumpleluna` no existen
 * en este producto, y un link a una pantalla que no está es una promesa rota.
 * Todo lo que hay para decir de cada capa está acá.
 *
 * Reparto de voces (una cosa se dice UNA vez): el disco anuncia lo que dibuja,
 * el resumen es su propio elemento de texto, y la barra del ciclo anuncia el
 * reloj con su `valueText`. Cuando las tres piezas decían las tres cosas, el
 * lector de pantalla repetía el mismo párrafo dos y tres veces seguidas.
 */

/**
 * La Luna de hoy medida sobre la carta: disco, titular, metadatos y el resumen
 * del cálculo. Sin casa natal el bloque no se cae: sigue mostrando signo y fase
 * —que son datos del día— y explica en gris por qué la casa no está.
 */
export function HoyLunaBloque({ vista }: { vista: LunaVista }) {
  return (
    <View>
      <View style={styles.hero}>
        <MoonDial
          iluminacion={vista.iluminacion}
          phaseKey={vista.phaseKey}
          etiqueta={vista.voz}
          size={72}
        />
        <View style={styles.heroTexto}>
          <HoySubtitulo>{vista.titular}</HoySubtitulo>
          <HoyMeta items={vista.meta} />
        </View>
      </View>
      {vista.resumen ? <HoyTexto style={styles.resumen}>{vista.resumen}</HoyTexto> : null}
      {vista.tema ? <HoyTexto style={styles.tema}>{vista.tema}</HoyTexto> : null}
      <Limitaciones lineas={vista.limitaciones} />
    </View>
  );
}

/**
 * El ciclo personal y, cuando corresponde, el evento de hoy.
 *
 * El titular dice el evento con la certeza que la ventana sostiene —`Ocurre
 * hoy`, `Puede caer hoy` o la ventana entera—; nunca una fecha suelta ni una
 * hora, porque este cálculo no publica un instante exacto. La barra dibuja el
 * avance del snapshot, o su franja posible cuando el día del ciclo viene con
 * ventana.
 */
export function HoyCumplelunaBloque({ vista }: { vista: CumplelunaVista }) {
  return (
    <View>
      {vista.resumen ? <HoyTexto style={styles.resumenArriba}>{vista.resumen}</HoyTexto> : null}
      <View style={styles.hero}>
        <CycleRing avance={vista.avance} banda={vista.banda} etiqueta={vista.voz} size={60} />
        <View style={styles.heroTexto}>
          <HoySubtitulo>{vista.titular}</HoySubtitulo>
          <HoyMeta items={vista.meta} />
        </View>
      </View>
      {vista.relojDelCiclo ? (
        <View style={styles.medidor}>
          <HoyMedidor
            valor={vista.avance}
            banda={vista.banda}
            valueText={vista.relojDelCiclo}
            accessibilityLabel={`Tu ciclo personal: ${vista.relojDelCiclo.toLocaleLowerCase("es")}.`}
          />
          {/* El pie visible de la barra. Queda fuera del recorrido del lector:
              repite en versalitas el mismo reloj que la barra acaba de anunciar. */}
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <HoyMeta items={[vista.relojDelCiclo]} />
          </View>
        </View>
      ) : null}
      <Limitaciones lineas={vista.limitaciones} />
    </View>
  );
}

/** Qué NO afirma el bloque, pegado al dato que condiciona. */
function Limitaciones({ lineas }: { lineas: readonly string[] }) {
  if (lineas.length === 0) return null;
  return (
    <View style={styles.limitaciones}>
      {lineas.map((linea) => (
        <HoyNota key={linea} style={styles.limitacion}>
          {linea}
        </HoyNota>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.lg },
  heroTexto: { flex: 1, minWidth: 0 },
  resumen: { marginTop: orbita.spacing.lg },
  resumenArriba: { marginBottom: orbita.spacing.lg },
  tema: { marginTop: orbita.spacing.md },
  medidor: { marginTop: orbita.spacing.lg },
  limitaciones: { marginTop: orbita.spacing.lg },
  limitacion: { marginTop: orbita.spacing.xs }
});
