import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { CodeHelp } from "../components/CodeHelp";
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
  password: string;
  onPassword: (v: string) => void;
  confirmPassword: string;
  onConfirmPassword: (v: string) => void;
  /** Error de validación del formulario (contraseñas), aparte del de Clerk. */
  formError: string | null;
  code: string;
  onCode: (v: string) => void;
  account: AccountFlow | null;
  /** `codeOverride`: la auto-verificación del CodeInput pasa el código directo. */
  onNext: (codeOverride?: string) => void;
  onOAuth: (provider: OAuthProvider) => void;
  onBack: () => void;
};

/**
 * 14 — Create account (save your chart). Con Clerk: email → código → sesión.
 *
 * La cuenta es OBLIGATORIA (decisión de producto 2026-07-16: Órbita no tiene
 * Home invitada). Acá vivía "Seguir sin cuenta": terminaba el alta con un
 * perfil sin dueño que, sin sesión, el gate de `(tabs)` rebota — el usuario
 * quedaba dando vueltas entre el onboarding y la entrada, sin poder entrar.
 */
export function AccountScreen({
  step,
  email,
  onEmail,
  password,
  onPassword,
  confirmPassword,
  onConfirmPassword,
  formError,
  code,
  onCode,
  account,
  onNext,
  onOAuth,
  onBack
}: Props) {
  const codePhase = account?.phase === "code" && !account.isSignedIn;
  const subtitle = account?.isSignedIn
    ? "Tu cuenta ya está activa. Tus lecturas quedan guardadas."
    : codePhase
      ? `Te mandamos un código a ${email.trim()}.`
      : "Tu historial, tus lecturas y tus tránsitos quedan en tu cuenta.";
  const ctaLabel = account?.busy ? "Un momento…" : codePhase ? "Verificar código" : "Guardar mi carta";
  // En la fase email mostramos primero el error de validación local (contraseñas)
  // y, si no hay, el de Clerk; en la fase código, el de Clerk (código/faltantes).
  const shownError = codePhase ? account?.error ?? null : formError ?? account?.error ?? null;

  return (
    <Screen bg={A.accountBg} bgOpacity={0.9} wash={0.55}>
      {/* Header FIJO fuera del scroll. El formulario (email + contraseña +
          confirmación) crece más que una pantalla chica con el teclado abierto,
          así que va en KeyboardAvoidingView + ScrollView para poder llegar al
          error y a "Guardar mi carta". keyboardShouldPersistTaps="handled" deja
          tocar el CTA sin que el primer tap solo cierre el teclado. */}
      <Header step={step} total={15} onBack={codePhase ? () => account?.resetToEmail() : onBack} />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <Title>Guardá tu carta.</Title>
          <Body style={styles.sub}>{subtitle}</Body>

        {codePhase && account ? (
          <>
            <Label style={styles.fieldLabel}>Código</Label>
            <CodeInput value={code} onChange={onCode} onFilled={(filled) => onNext(filled)} />
            <CodeHelp onResend={account.resend} />
          </>
        ) : (
          <>
            <Label style={styles.fieldLabel}>Email</Label>
            <TextInput
              value={email}
              onChangeText={onEmail}
              placeholder="tu@email.com"
              placeholderTextColor={orbita.faint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              style={styles.input}
            />
            <View style={styles.inputLine} />

            <Label style={styles.fieldLabelStacked}>Contraseña</Label>
            <TextInput
              value={password}
              onChangeText={onPassword}
              placeholder="Al menos 8 caracteres"
              placeholderTextColor={orbita.faint}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textContentType="newPassword"
              style={styles.input}
            />
            <View style={styles.inputLine} />

            <Label style={styles.fieldLabelStacked}>Repetir contraseña</Label>
            <TextInput
              value={confirmPassword}
              onChangeText={onConfirmPassword}
              placeholder="Repetí la contraseña"
              placeholderTextColor={orbita.faint}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textContentType="newPassword"
              onSubmitEditing={() => onNext()}
              style={styles.input}
            />
            <View style={styles.inputLine} />
          </>
        )}
        {shownError ? <Text style={styles.error}>{shownError}</Text> : null}

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

        {account && codePhase ? (
          <View style={styles.linksZone}>
            <Pressable onPress={() => account.resetToEmail()} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.quietLink}>Usar otro email</Text>
            </Pressable>
          </View>
        ) : !account && SOCIAL_LOGIN_ENABLED ? (
          <>
            <Text style={styles.divider}>O seguir con</Text>
            <View style={styles.socials}>
              <CTA label="Continuar con Apple" variant="secondary" onPress={onNext} />
              <View style={styles.gap} />
              <CTA label="Continuar con Google" variant="secondary" onPress={onNext} />
            </View>
          </>
        ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  fieldLabelStacked: { marginTop: 20 },
  gap: { height: 12 },
  kav: { flex: 1 },
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
  scroll: { flex: 1 },
  // paddingBottom generoso: en iPhone chico, con el teclado abierto, el error y
  // "Guardar mi carta" deben quedar alcanzables scrolleando por encima del teclado.
  scrollContent: { paddingBottom: 56, paddingHorizontal: GUTTER, paddingTop: 26 },
  socials: { marginTop: 22 },
  sub: { marginTop: 10 },
});
