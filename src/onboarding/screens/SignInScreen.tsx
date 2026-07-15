import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CTA } from "../components/CTA";
import { Screen } from "../components/Screen";
import { Body, Label, Title } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";
import { SOCIAL_LOGIN_ENABLED, type AccountFlow, type OAuthProvider } from "../useAccount";

type Props = {
  flow: AccountFlow;
  /** La sesión quedó activa: el contenedor decide Home vs onboarding. */
  onSignedIn: () => Promise<void>;
  onBack: () => void;
};

/**
 * 01C — Iniciar sesión ("Bienvenido de nuevo"). Puerta para usuarios que ya
 * tienen cuenta: email → código (Clerk) u OAuth. NO manda al onboarding: con
 * carta en Convex se entra derecho a la Home.
 */
export function SignInScreen({ flow, onSignedIn, onBack }: Props) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [entering, setEntering] = useState(false);

  const codePhase = flow.phase === "code" && !flow.isSignedIn;
  const busy = flow.busy || entering;
  const subtitle = flow.isSignedIn
    ? "Tu sesión ya está activa. Entrá y seguí donde estabas."
    : codePhase
      ? `Te mandamos un código a ${email.trim()}.`
      : "Iniciá sesión y volvés directo a tu cielo — sin repetir el onboarding.";
  const ctaLabel = busy ? "Un momento…" : flow.isSignedIn ? "Entrar" : codePhase ? "Verificar código" : "Iniciar sesión";

  const finish = async () => {
    setEntering(true);
    try {
      await onSignedIn();
    } finally {
      setEntering(false);
    }
  };

  const submit = async () => {
    if (busy) return;
    if (flow.isSignedIn) {
      await finish();
      return;
    }
    const trimmed = email.trim().toLowerCase();
    if (flow.phase === "email") {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return;
      await flow.start(trimmed);
      return;
    }
    const ok = await flow.verify(code.trim());
    if (ok) await finish();
  };

  const oauth = async (provider: OAuthProvider) => {
    if (busy || flow.oauthBusy) return;
    const ok = await flow.oauth(provider);
    if (ok) await finish();
  };

  return (
    <Screen bg={A.splashBg} bgOpacity={0.9} wash={0.55}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Volver">
          <Text style={styles.chev}>‹</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        <Title>Bienvenido{"\n"}de nuevo.</Title>
        <Body style={styles.sub}>{subtitle}</Body>

        {!flow.isSignedIn ? (
          <>
            <Label style={styles.fieldLabel}>{codePhase ? "Código" : "Email"}</Label>
            {codePhase ? (
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={orbita.faint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="number-pad"
                style={styles.input}
              />
            ) : (
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="tu@email.com"
                placeholderTextColor={orbita.faint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.input}
              />
            )}
            <View style={styles.inputLine} />
          </>
        ) : null}
        {flow.error ? <Text style={styles.error}>{flow.error}</Text> : null}

        <View style={styles.primary}>
          <CTA label={ctaLabel} onPress={busy ? () => undefined : () => void submit()} />
        </View>

        {SOCIAL_LOGIN_ENABLED && !flow.isSignedIn && !codePhase ? (
          <>
            <Text style={styles.divider}>O seguir con</Text>
            <View style={styles.socials}>
              <CTA
                label={flow.oauthBusy === "apple" ? "Un momento…" : "Continuar con Apple"}
                variant="secondary"
                onPress={() => void oauth("apple")}
              />
              <View style={styles.gap} />
              <CTA
                label={flow.oauthBusy === "google" ? "Un momento…" : "Continuar con Google"}
                variant="secondary"
                onPress={() => void oauth("google")}
              />
            </View>
          </>
        ) : null}

        {codePhase ? (
          <View style={styles.linksZone}>
            <Pressable onPress={() => flow.resetToEmail()} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.quietLink}>Usar otro email</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.spacer} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backBtn: { alignItems: "flex-start", height: 30, justifyContent: "center", width: 28 },
  body: { flex: 1, paddingHorizontal: GUTTER, paddingTop: 26 },
  chev: { color: orbita.bone, fontFamily: font.sans, fontSize: 26, lineHeight: 30 },
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
  header: { paddingHorizontal: GUTTER, paddingTop: 6 },
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
