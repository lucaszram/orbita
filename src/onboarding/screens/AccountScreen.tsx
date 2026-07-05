import { StyleSheet, TextInput, View } from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Label, Title } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";

type Props = {
  step: number;
  email: string;
  onEmail: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
};

/** 14 — Create account (save your chart). */
export function AccountScreen({ step, email, onEmail, onNext, onBack }: Props) {
  return (
    <Screen bg={A.accountBg} bgOpacity={0.9} wash={0.55}>
      <Header step={step} total={15} onBack={onBack} />
      <View style={styles.body}>
        <Title>Guardá tu carta.</Title>
        <Body style={styles.sub}>Tu historial, tus lecturas y tus tránsitos quedan en tu cuenta.</Body>

        <Label style={styles.fieldLabel}>Email</Label>
        <TextInput
          value={email}
          onChangeText={onEmail}
          placeholder="tu@email.com"
          placeholderTextColor={orbita.faint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={styles.input}
        />
        <View style={styles.inputLine} />

        <View style={styles.primary}>
          <CTA label="Guardar mi carta" onPress={onNext} />
        </View>

        <Text style={styles.divider}>O seguir con</Text>

        <View style={styles.socials}>
          <CTA label="Continuar con Apple" variant="secondary" onPress={onNext} />
          <View style={styles.gap} />
          <CTA label="Continuar con Google" variant="secondary" onPress={onNext} />
        </View>

        <View style={styles.spacer} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: GUTTER, paddingTop: 26 },
  divider: {
    color: orbita.faint,
    fontFamily: font.sans,
    fontSize: 13,
    marginTop: 26,
    textAlign: "center",
  },
  fieldLabel: { marginTop: 44 },
  gap: { height: 12 },
  input: {
    color: orbita.bone,
    fontFamily: font.serifReg,
    fontSize: 20,
    marginTop: 8,
    paddingVertical: 6,
  },
  inputLine: { backgroundColor: orbita.lineStrong, height: 1, marginTop: 4 },
  primary: { marginTop: 30 },
  socials: { marginTop: 22 },
  spacer: { flex: 1 },
  sub: { marginTop: 10 },
});
