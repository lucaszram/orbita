import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Text } from "@/components/ui/text";
import { shouldOfferSignup } from "@/domain/sessionStart";

import { A } from "../assets";
import { CodeHelp } from "../components/CodeHelp";
import { CodeInput } from "../components/CodeInput";
import { CTA } from "../components/CTA";
import { EmailDivider, GoogleButton } from "../components/GoogleButton";
import { Screen } from "../components/Screen";
import { Body, Label, Title } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";
import { GOOGLE_AUTH_ENABLED, type OAuthProvider, type SignInFlow } from "../useAccount";

type Props = {
  flow: SignInFlow;
  /** La sesión quedó activa: el contenedor decide Home vs onboarding. */
  onSignedIn: () => Promise<void>;
  /** Salida hacia el alta, con el email ya tipeado (si escribió alguno). */
  onCreateAccount: (email: string) => void;
  onBack: () => void;
  /**
   * ¿Se ofrece "Crear una cuenta"? Por defecto sí.
   *
   * El boundary de eliminación pendiente monta esta misma pantalla para que la
   * cuenta que se está borrando vuelva a entrar y termine su eliminación. Ahí
   * crear OTRA cuenta es exactamente lo que no puede pasar: dejaría una cuenta
   * nueva conviviendo con un marcador ajeno vivo en disco.
   */
  allowSignup?: boolean;
  /**
   * ¿Se ofrece Google/SSO? Por defecto sí.
   *
   * El boundary de eliminación pendiente lo apaga: un SSO puede terminar
   * creando una cuenta nueva —o entrando con otra— y eso es exactamente lo que
   * no puede pasar con un marcador ajeno vivo en disco. Ahí sólo vale volver a
   * entrar con la MISMA cuenta por email + código o contraseña.
   */
  allowOAuth?: boolean;
};

/**
 * 01C — Iniciar sesión ("Bienvenido de nuevo"). Puerta para usuarios que ya
 * tienen cuenta: email → contraseña o código (según lo que soporte la cuenta)
 * u OAuth. NO manda al onboarding: con carta en Convex se entra derecho a la
 * Home. La salida al alta ("Crear una cuenta") está siempre a mano.
 */
export function SignInScreen({
  flow,
  onSignedIn,
  onCreateAccount,
  onBack,
  allowSignup = true,
  allowOAuth = true
}: Props) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [entering, setEntering] = useState(false);

  const codePhase = flow.phase === "code" && !flow.isSignedIn;
  const passwordPhase = flow.phase === "password" && !flow.isSignedIn;
  const busy = flow.busy || entering;
  const offerSignup =
    allowSignup && shouldOfferSignup({ phase: flow.phase, isSignedIn: flow.isSignedIn });
  const subtitle = flow.isSignedIn
    ? "Tu sesión ya está activa. Entrá y seguí donde estabas."
    : codePhase
      ? `Te mandamos un código a ${email.trim()}.`
      : passwordPhase
        ? "Escribí tu contraseña para entrar."
        : "Iniciá sesión y volvés directo a tu cielo — sin repetir el onboarding.";
  const ctaLabel = busy
    ? "Un momento…"
    : flow.isSignedIn
      ? "Entrar"
      : codePhase
        ? "Verificar código"
        : passwordPhase
          ? "Entrar"
          : "Continuar";

  const finish = async () => {
    setEntering(true);
    try {
      await onSignedIn();
    } finally {
      setEntering(false);
    }
  };

  // `codeOverride`: la auto-verificación del CodeInput pasa el código recién
  // completado directo (el estado `code` todavía no re-renderizó).
  const submit = async (codeOverride?: string) => {
    if (busy) return;
    if (flow.isSignedIn) {
      await finish();
      return;
    }
    if (flow.phase === "email") {
      const trimmed = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return;
      await flow.start(trimmed);
      return;
    }
    if (flow.phase === "password") {
      if (!password) return;
      const ok = await flow.verifyPassword(password);
      if (ok) await finish();
      return;
    }
    const ok = await flow.verify((codeOverride ?? code).trim());
    if (ok) await finish();
  };

  const oauth = async (provider: OAuthProvider) => {
    // Doble llave: además de no dibujar el botón, tampoco se ejecuta. Un
    // `allowOAuth={false}` tiene que apagar el CAMINO, no sólo el píxel.
    if (!allowOAuth || busy || flow.oauthBusy) return;
    const ok = await flow.oauth(provider);
    if (ok) await finish();
  };

  return (
    <Screen bg={A.splashBg} bgOpacity={0.9} wash={0.55} scroll>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Volver">
          <Text style={styles.chev}>‹</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        <Title>Bienvenido{"\n"}de nuevo.</Title>
        <Body style={styles.sub}>{subtitle}</Body>

        {/* El camino corto primero; el email queda completo debajo. */}
        {allowOAuth && GOOGLE_AUTH_ENABLED && !flow.isSignedIn && flow.phase === "email" ? (
          <>
            <GoogleButton
              busy={flow.oauthBusy === "google"}
              onPress={() => void oauth("google")}
              style={styles.googleTop}
            />
            <EmailDivider />
          </>
        ) : null}

        {!flow.isSignedIn ? (
          <>
            <Label style={styles.fieldLabel}>
              {codePhase ? "Código" : passwordPhase ? "Contraseña" : "Email"}
            </Label>
            {codePhase ? (
              <>
                <CodeInput
                  value={code}
                  onChange={setCode}
                  onFilled={(filled) => void submit(filled)}
                />
                <CodeHelp onResend={flow.resend} />
              </>
            ) : passwordPhase ? (
              <>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  accessibilityLabel="Contraseña"
                  placeholder="Tu contraseña"
                  placeholderTextColor={orbita.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  textContentType="password"
                  onSubmitEditing={() => void submit()}
                  style={styles.input}
                />
                <View style={styles.inputLine} />
              </>
            ) : (
              <>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  accessibilityLabel="Email de tu cuenta"
                  placeholder="tu@email.com"
                  placeholderTextColor={orbita.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  onSubmitEditing={() => void submit()}
                  style={styles.input}
                />
                <View style={styles.inputLine} />
              </>
            )}
          </>
        ) : null}
        {flow.error ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
            {flow.error}
          </Text>
        ) : null}

        <View style={styles.primary}>
          <CTA label={ctaLabel} onPress={busy ? () => undefined : () => void submit()} />
        </View>

        {/* Salida hacia el alta, SIEMPRE visible mientras se escribe el email
            (shouldOfferSignup). Sin esto, "No encontramos una cuenta con ese
            email" dejaba al usuario encerrado en el login: sin cuenta que
            recuperar y sin forma de crear una desde acá. */}
        {offerSignup ? (
          <View style={styles.secondary}>
            <CTA
              label="Crear una cuenta"
              variant="secondary"
              onPress={busy ? undefined : () => onCreateAccount(email.trim().toLowerCase())}
            />
          </View>
        ) : null}

        {codePhase || passwordPhase ? (
          <View style={styles.linksZone}>
            {/* La contraseña nunca es un callejón: siempre se puede entrar por
                código al mail (cuenta sin contraseña, o contraseña olvidada). */}
            {passwordPhase ? (
              <Pressable
                onPress={busy ? undefined : () => void flow.sendEmailCode()}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={styles.quietLink}>Mandame un código por email</Text>
              </Pressable>
            ) : null}
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
  secondary: { marginTop: 12 },
  socials: { marginTop: 22 },
  spacer: { flex: 1 },
  googleTop: { marginTop: 24 },
  sub: { marginTop: 10 },
});
