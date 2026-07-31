import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from "react-native";

import { Text } from "@/components/ui/text";
import { useIsDesktop } from "@/hooks/useLayoutMode";

import { A } from "../assets";
import { CodeHelp } from "../components/CodeHelp";
import { CodeInput } from "../components/CodeInput";
import { CTA } from "../components/CTA";
import { EmailDivider, GoogleButton } from "../components/GoogleButton";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Label, Title } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";
import { GOOGLE_AUTH_ENABLED, type AccountFlow, type OAuthProvider } from "../useAccount";

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
  const desktop = useIsDesktop();

  return (
    // El sello es INTENCIONAL: en escritorio ocupa su propia columna como la
    // pieza del momento "guardá tu carta", en vez de quedar de fondo lavado
    // detrás del formulario. En móvil sigue siendo la atmósfera de la pantalla,
    // con el wash un poco más fuerte para que los campos tengan contraste.
    <Screen
      bg={A.accountBg}
      // En móvil el arte del sobre baja a atmósfera: a 0.9 era el fondo del
      // formulario y los campos quedaban pegados encima de una imagen. El sello
      // pasa a ser una pieza compacta y deliberada arriba del título.
      bgOpacity={desktop ? 0.55 : 0.32}
      wash={desktop ? 0.5 : 0.74}
      layout={desktop ? "split" : "stage"}
      aside={desktop ? <View style={styles.seal}><Image source={A.accountBg} style={styles.sealImg} resizeMode="cover" /></View> : undefined}
    >
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
          {/* Móvil: el sello como PIEZA, separada del formulario. En
              escritorio ya vive en su propia columna (`aside`). */}
          {desktop ? null : (
            <View style={styles.sealMobile}>
              <Image source={A.accountBg} style={styles.sealMobileImg} resizeMode="cover" />
            </View>
          )}
          <Title>Guardá tu carta.</Title>
          <Body style={styles.sub}>{subtitle}</Body>

          {/* El camino corto primero: un tap y la carta queda guardada. El alta
              por email sigue completa debajo del divisor. */}
          {GOOGLE_AUTH_ENABLED && account && !codePhase ? (
            <>
              <GoogleButton
                busy={account.oauthBusy === "google"}
                onPress={() => (account.oauthBusy ? undefined : onOAuth("google"))}
                style={styles.googleTop}
              />
              <EmailDivider />
            </>
          ) : null}

          {/* Superficie del formulario: panel oscuro translúcido con borde. Los
              campos sueltos sobre el asset perdían las líneas de subrayado
              contra la textura y no se leían como formulario. */}
          <View style={desktop ? undefined : styles.panel}>
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
              accessibilityLabel="Email"
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
              accessibilityLabel="Contraseña"
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
              accessibilityLabel="Repetir contraseña"
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
          </View>
        {shownError ? (
          /* `alert` + región viva: un lector de pantalla anuncia el fallo sin
             que la persona tenga que ir a buscarlo. */
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
            {shownError}
          </Text>
        ) : null}

        <View style={styles.primary}>
          <CTA label={ctaLabel} onPress={account?.busy ? () => undefined : () => onNext()} />
        </View>

        {account && codePhase ? (
          <View style={styles.linksZone}>
            <Pressable onPress={() => account.resetToEmail()} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.quietLink}>Usar otro email</Text>
            </Pressable>
          </View>
        ) : !account && GOOGLE_AUTH_ENABLED ? (
          // Sin backend configurado no hay proveedor real: el botón sólo
          // adelanta el paso, como el resto del alta en modo local.
          <GoogleButton onPress={onNext} style={styles.googleTop} />
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
  fieldLabel: { marginTop: 0 },
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
  inputLine: { backgroundColor: "rgba(214,154,106,0.55)", height: 1, marginTop: 4 },
  // Escritorio: el sello como pieza de la escena, no como fondo.
  seal: {
    aspectRatio: 1,
    alignSelf: "center",
    borderColor: orbita.lineStrong,
    borderRadius: 220,
    borderWidth: 1,
    maxWidth: 420,
    overflow: "hidden",
    width: "100%",
  },
  sealImg: { height: "100%", width: "100%" },
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
  // El formulario en una superficie propia: panel oscuro translúcido con
  // borde. Es lo que lo despega del arte del sobre.
  panel: {
    backgroundColor: "rgba(10,11,15,0.86)",
    borderColor: orbita.lineStrong,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  // Móvil: el sello, compacto y deliberado, arriba del título.
  sealMobile: {
    alignSelf: "center",
    borderColor: "rgba(214,154,106,0.55)",
    borderRadius: 44,
    borderWidth: 1,
    height: 88,
    marginBottom: 20,
    overflow: "hidden",
    width: 88,
  },
  sealMobileImg: { height: "100%", width: "100%" },
  googleTop: { marginTop: 22 },
  socials: { marginTop: 22 },
  sub: { marginTop: 10 },
});
