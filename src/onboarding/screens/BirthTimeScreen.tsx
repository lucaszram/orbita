import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { BirthTimePicker } from "../components/BirthPicker";
import { CTA } from "../components/CTA";
import { Header } from "../components/Header";
import { Screen, useSplitSlot } from "../components/Screen";
import { Body, Caption, Title } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";

export type BirthTime = { hour: number; minute: number };

type Props = {
  step: number;
  value: BirthTime;
  onChange: (v: BirthTime) => void;
  unknown: boolean;
  onToggleUnknown: () => void;
  onNext: () => void;
  onBack: () => void;
};

/**
 * 09 — Hora de nacimiento + "No sé la hora".
 *
 * El control lo pone `BirthTimePicker`, con implementación por plataforma:
 * rueda en nativo, `<input type="time">` en web. Con "No sé la hora" activo el
 * control web NO se dibuja (una hora visible que nadie eligió es justamente el
 * problema que este cambio arregla) y la rueda nativa se atenúa, como siempre.
 */
export function BirthTimeScreen({ step, value, onChange, unknown, onToggleUnknown, onNext, onBack }: Props) {
  // El control se monta UNA vez (ver `useSplitSlot`): en móvil entre el
  // subtítulo y el interruptor de "No sé la hora", que es su orden original.
  const { inline, aside } = useSplitSlot(
    <BirthTimePicker value={value} onChange={onChange} unknown={unknown} />
  );
  return (
    <Screen bg={A.dailyTexture} wash={0.52} layout="split" aside={aside}>
      <Header step={step} total={15} onBack={onBack} />
      <View style={styles.body}>
        <Title>¿A qué hora naciste?</Title>
        <Body style={styles.sub}>La hora afina tu ascendente y tus casas.</Body>

        {inline}

        <Pressable
          onPress={onToggleUnknown}
          accessibilityRole="switch"
          accessibilityLabel="No sé la hora"
          accessibilityHint="Usamos una carta aproximada, sin ascendente afinado."
          accessibilityState={{ checked: unknown }}
          style={[styles.unknownCard, { borderColor: unknown ? orbita.copper : "rgba(214,154,106,0.45)" }]}
        >
          <View style={styles.unknownTxts}>
            <Text style={styles.unknownTitle}>No sé la hora</Text>
            <Text style={styles.unknownSub}>Usamos una carta aproximada.</Text>
          </View>
          <View style={[styles.check, unknown && styles.checkOn]}>
            {unknown ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
        </Pressable>

        <View style={styles.spacer} />
        <Caption style={styles.note}>
          Podés continuar sin hora exacta. La lectura será menos precisa.
        </Caption>
        <View style={styles.footer}>
          <CTA label="Continuar" onPress={onNext} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: GUTTER, paddingTop: 26 },
  check: {
    alignItems: "center",
    borderColor: orbita.lineStrong,
    borderRadius: 11,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  checkMark: { color: orbita.ink, fontFamily: font.sansBold, fontSize: 12 },
  checkOn: { backgroundColor: orbita.copper, borderColor: orbita.copper },
  footer: { paddingBottom: 12, paddingTop: 12 },
  note: { marginBottom: 8, textAlign: "center" },
  spacer: { flex: 1, minHeight: 12 },
  sub: { marginTop: 10 },
  unknownCard: {
    alignItems: "center",
    backgroundColor: "rgba(18,20,26,0.6)",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 26,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  unknownSub: { color: orbita.muted, fontFamily: font.sans, fontSize: 12, marginTop: 3 },
  unknownTitle: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 14 },
  unknownTxts: { flex: 1 },
});
