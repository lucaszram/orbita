import { StyleSheet, View } from "react-native";

import { isFutureDateParts, isRealDateParts } from "@/domain/birthInput";

import { A } from "../assets";
import { BirthDatePicker } from "../components/BirthPicker";
import { CTA } from "../components/CTA";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Caption, Title } from "../components/Type";
import { GUTTER } from "../theme";

export type BirthDateParts = { day: number; month: number; year: number };

type Props = {
  step: number;
  value: BirthDateParts;
  onChange: (v: BirthDateParts) => void;
  onNext: () => void;
  onBack: () => void;
};

/**
 * 05 — Fecha de nacimiento.
 *
 * El control lo pone `BirthDatePicker`, que tiene una implementación por
 * plataforma: rueda en nativo, `<input type="date">` en web. La pantalla no
 * sabe cuál está montada — sólo conoce las partes `{day, month, year}`, que son
 * las mismas que usa el resto del flujo. Eso es lo que garantiza que lo que se
 * VE y lo que se confirma sean el mismo valor.
 */
export function BirthdateScreen({ step, value, onChange, onNext, onBack }: Props) {
  // Un día que no existe (31 de febrero) se puede armar con la rueda nativa.
  // No se confirma: se avisa y "Continuar" queda bloqueado.
  const real = isRealDateParts(value);
  // El `max` del control nativo se fue con el control nativo: la regla sigue.
  const future = isFutureDateParts(value, new Date());
  const usable = real && !future;
  return (
    <Screen bg={A.dailyTexture} wash={0.52}>
      <Header step={step} total={13} onBack={onBack} />
      <View style={styles.body}>
        <Title>¿Cuándo naciste?</Title>
        <Body style={styles.sub}>Tu fecha ubica el Sol en tu carta.</Body>

        {usable ? null : (
          <Body accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.invalid}>
            {future
              ? "Esa fecha todavía no llegó. Elegí tu fecha de nacimiento."
              : "Ese día no existe en el mes que elegiste. Ajustá la fecha para continuar."}
          </Body>
        )}

        {/* El control se monta UNA vez y en su lugar del flujo: después del
            aviso, antes de la privacidad y del CTA. Dos montajes serían dos
            controles con el mismo nombre accesible para la misma fecha. */}
        <BirthDatePicker value={value} onChange={onChange} />

        <View style={styles.spacer} />
        <Caption style={styles.privacy}>
          La usamos para armar tu carta. Nunca vendemos ni compartimos tus datos.
        </Caption>
        <View style={styles.footer}>
          <CTA label="Continuar" onPress={onNext} disabled={!usable} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: GUTTER, paddingTop: 26 },
  footer: { paddingBottom: 12, paddingTop: 12 },
  invalid: { color: "#D07A5A", marginTop: 14 },
  privacy: { marginBottom: 8, textAlign: "center" },
  spacer: { flex: 1, minHeight: 16 },
  sub: { marginTop: 10 },
});
