import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { VoidExperience } from "@/components/void/VoidExperience";
import { UmbralSelector, type UmbralSection } from "@/components/web/umbral-selector";
import { UmbralTarot } from "@/components/web/umbral-tarot";

/**
 * El Umbral de la web, con sus dos formas de cruzarlo.
 *
 * Antes `/umbral` montaba `VoidExperience` directo, así que el mazo real de 78
 * cartas no tenía superficie propia en el navegador. El selector envuelve lo que
 * ya había —Preguntar no cambia en nada, ni su cupo diario— y le da su lugar a
 * Tarot al lado.
 *
 * Arranca en Preguntar: es lo que el Umbral venía siendo, y Tarot se elige.
 *
 * El selector no se dibuja acá arriba: cada sección lo recibe y lo pone debajo
 * de SU encabezado, que es donde va en el diseño. Por eso Preguntar lo toma como
 * `belowHeader` y nombra su pestaña con `sectionLabel`.
 *
 * Las dos secciones quedan MONTADAS y se alternan con `display: none`. Cambiar
 * de pestaña desmontando perdería una respuesta del Umbral ya generada, y ese
 * cupo es diario: no se vuelve a pedir.
 */
export function UmbralSections() {
  const [section, setSection] = useState<UmbralSection>("preguntar");
  const selector = <UmbralSelector active={section} onChange={setSection} />;

  return (
    <View style={styles.root}>
      <View style={[styles.pane, section === "preguntar" ? null : styles.hidden]}>
        <VoidExperience showBack={false} sectionLabel="PREGUNTAR" belowHeader={selector} />
      </View>
      <View style={[styles.pane, section === "tarot" ? null : styles.hidden]}>
        <UmbralTarot selector={selector} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pane: { flex: 1 },
  hidden: { display: "none" }
});
