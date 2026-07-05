import { Pressable, StyleSheet, View } from "react-native";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Caption, Title } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";

export type Identity = "ella" | "el" | "prefiero-no-decirlo";

const OPTIONS: { value: Identity; label: string }[] = [
  { value: "ella", label: "Ella" },
  { value: "el", label: "Él" },
  { value: "prefiero-no-decirlo", label: "Prefiero no decirlo" },
];

type Props = {
  step: number;
  identity: Identity;
  onSelect: (v: Identity) => void;
  onNext: () => void;
  onBack: () => void;
};

/** 03 — Identity (tone personalization). */
export function IdentifyScreen({ step, identity, onSelect, onNext, onBack }: Props) {
  return (
    <Screen bg={A.identifyBg} wash={0.58}>
      <Header step={step} total={15} onBack={onBack} />
      <View style={styles.body}>
        <Title>¿Cómo te identificás?</Title>
        <Body style={styles.sub}>Elegí cómo preferís que te hablemos.</Body>

        <RadioGroup value={identity} onValueChange={(v) => onSelect(v as Identity)} className="gap-3" style={styles.group}>
          {OPTIONS.map((o) => {
            const selected = identity === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => onSelect(o.value)}
                style={[styles.row, { borderColor: selected ? orbita.copper : orbita.line }]}
              >
                <Text style={styles.label}>{o.label}</Text>
                <RadioGroupItem
                  value={o.value}
                  style={[styles.radio, { borderColor: selected ? orbita.copper : orbita.faint }]}
                  indicatorStyle={styles.radioDot}
                />
              </Pressable>
            );
          })}
        </RadioGroup>

        <View style={styles.spacer} />
        <Caption style={styles.note}>Solo cambia el tono de tus lecturas.</Caption>
        <View style={styles.footer}>
          <CTA label="Continuar" onPress={onNext} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: GUTTER, paddingTop: 26 },
  footer: { paddingBottom: 12, paddingTop: 12 },
  group: { marginTop: 30 },
  label: { color: orbita.bone, fontFamily: font.sansBold, fontSize: 16 },
  note: { marginBottom: 8, textAlign: "center" },
  radio: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  radioDot: { backgroundColor: orbita.copper, borderRadius: 4, height: 8, width: 8 },
  row: {
    alignItems: "center",
    backgroundColor: "rgba(18,20,26,0.55)",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    height: 66,
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  spacer: { flex: 1, minHeight: 16 },
  sub: { marginTop: 10 },
});
