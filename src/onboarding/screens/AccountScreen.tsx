import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CodeInput } from "../components/CodeInput";
import { CTA } from "../components/CTA";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Label, Title } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";
import { SOCIAL_LOGIN_ENABLED, type AccountFlow, type OAuthProvider } from "../useAccount";

type Props = {
  step: number;
  email: string;
  onEmail: (v: string) => void;
  code: string;
  onCode: (v: string) => void;
  account: AccountFlow | null;
  /** `codeOverride`: la auto-verificación del CodeInput pasa el código directo. */
  onNext: (codeOverride?: string) => void;
  onOAuth: (provider: OAuthProvider) => void;
  onSkip: () => void;
  onBack: () => void;
};

/** 14 — Create account (save your chart). Con Clerk: email → código → sesión. */
export function AccountScreen({ step, email, onEmail, code, onCode, account, onNext, onOAuth, onSkip, onBack }: Props) {
  const codePhase = account?.phase === "code" && !account.isSignedIn;
  const subtitle = account?.isSignedIn
    ? "Tu cuenta ya está activa. Tus lecturas quedan guardadas."
    : codePhase
      ? `Te mandamos un código a ${email.trim()}.`
      : "Tu historial, tus lecturas y tus tránsitos quedan en tu cuenta.";
  const ctaLabel = account?.busy ? "Un momento…" : codePhase ? "Verificar código" : "Guardar mi carta";

  return (
    <Screen bg={A.accountBg} bgOpacity={0.9} wash={0.55}>
      <Header step={step} total={15} onBack={codePhase ? () => account?.resetToEmail() : onBack} />
      <View style={styles.body}>
        <Title>Guardá tu carta.</Title>
        <Body style={styles.sub}>{subtitle}</Body>

        <Label style={styles.fieldLabel}>{codePhase ? "Código" : "Email"}</Label>
        {codePhase ? (
          <CodeInput value={code} onChange={onCode} onFilled={(filled) => onNext(filled)} />
        ) : (
          <>
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
          </>
        )}
        {account?.error ? <Text style={styles.error}>{account.error}</Text> : null}

        <View style={styles.primary}>
          <CTA label={ctaLabel} onPress={account?.busy ? () => undefined : () => onNext()} />
        </View>

        {SOCIAL_LOGIN_ENABLED && account && !codePhase ? (
          <>
            <Text style={styles.divider}>O seguir con</Text>
            <View style={styles.socials}>
              <CTA
                label={account.oauthBusy === "apple" ? "Un momento…" : "Continuar con Apple"}
                variant="secondary"
                onPress={() => (account.oauthBusy ? undefined : onOAuth("apple"))}
              />
              <View style={styles.gap} />
              <CTA
                label={account.oauthBusy === "google" ? "Un momento…" : "Continuar con Google"}
                variant="secondary"
                onPress={() => (account.oauthBusy ? undefined : onOAuth("google"))}
              />
            </View>
          </>
        ) : null}

        {account ? (
          <View style={styles.linksZone}>
            {codePhase ? (
              <Pressable onPress={() => account.resetToEmail()} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.quietLink}>Usar otro email</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onSkip} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.quietLink}>Seguir sin cuenta</Text>
            </Pressable>
          </View>
        ) : SOCIAL_LOGIN_ENABLED ? (
          <>
            <Text style={styles.divider}>O seguir con</Text>
            <View style={styles.socials}>
              <CTA label="Continuar con Apple" variant="secondary" onPress={onNext} />
              <View style={styles.gap} />
              <CTA label="Continuar con Google" variant="secondary" onPress={onNext} />
            </View>
          </>
        ) : null}

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
  error: {
    color: "#D07A5A",
    fontFamily: font.sans,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
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
  linksZone: { alignItems: "center", gap: 16, marginTop: 26 },
  primary: { marginTop: 30 },
  quietLink: {
    color: orbita.faint,
    fontFamily: font.sans,
    fontSize: 13,
  },
  socials: { marginTop: 22 },
  spacer: { flex: 1 },
  sub: { marginTop: 10 },
});
