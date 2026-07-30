import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { CodeInput } from "@/onboarding/components/CodeInput";
import { CTA } from "@/onboarding/components/CTA";
import { Screen } from "@/onboarding/components/Screen";
import { Body, Label, Title } from "@/onboarding/components/Type";
import { validateSignupPassword } from "@/onboarding/signup";
import { font, GUTTER, orbita } from "@/onboarding/theme";
import type { AccountFlow } from "@/onboarding/useAccount";

/**
 * Alta de cuenta como PUERTA previa al onboarding.
 *
 * Antes esto era `AccountScreen`, un paso interno del onboarding (el 13). Con
 * auth-first la cuenta se crea antes: el onboarding arranca con sesión activa y
 * el alta no cuenta en su progreso.
 *
 * Reusa la lógica Clerk existente (`useAccountFlow`): email + contraseña +
 * código. La copy es la del handoff, literal.
 */
export function SignUpGateScreen({
  account,
  initialEmail = "",
  onSignIn,
  onVerified
}: {
  account: AccountFlow;
  /**
   * Email que la persona ya venía tipeando en el login (`?email=`): llega
   * cargado para no pedírselo dos veces.
   */
  initialEmail?: string;
  onSignIn: () => void;
  /** La sesión quedó activa: el resolver decide el destino. */
  onVerified: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const codePhase = account.phase === "code" && !account.isSignedIn;
  // En la fase email manda el error de validación local; en la de código, el de Clerk.
  const shownError = codePhase ? account.error : formError ?? account.error;

  const submit = async (codeOverride?: string) => {
    if (account.busy) return;
    setFormError(null);
    if (codePhase) {
      const ok = await account.verify((codeOverride ?? code).trim());
      if (ok) onVerified();
      return;
    }
    const trimmed = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setFormError("Revisá el email.");
      return;
    }
    const pwError = validateSignupPassword(password, confirmPassword);
    if (pwError) {
      setFormError(pwError);
      return;
    }
    await account.start(trimmed, password);
  };

  return (
    <Screen wash={0.62}>
      <View style={styles.body}>
        <Title>Creá tu cuenta.</Title>
        <Body>
          {codePhase
            ? `Te mandamos un código a ${email.trim()}.`
            : "Guardamos tu carta y tus lecturas en un solo lugar."}
        </Body>
        {/* El email ya tenía cuenta: el flujo pasa a iniciar sesión con código.
            Se dice, para que pedir un código no aparezca sin explicación. */}
        {account.existingAccount ? (
          <Body style={styles.notice}>
            Ya existe una cuenta con ese email. Iniciá sesión para continuar.
          </Body>
        ) : null}

        {codePhase ? (
          <View style={styles.field}>
            <CodeInput value={code} onChange={setCode} onFilled={(full) => void submit(full)} />
          </View>
        ) : (
          <>
            <View style={styles.field}>
              <Label>Email</Label>
              <TextInput
                value={email}
                onChangeText={setEmail}
                accessibilityLabel="Email"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="vos@ejemplo.com"
                placeholderTextColor={orbita.muted}
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <Label>Contraseña</Label>
              <TextInput
                value={password}
                onChangeText={setPassword}
                accessibilityLabel="Contraseña"
                autoCapitalize="none"
                autoComplete="new-password"
                secureTextEntry
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <Label>Repetir contraseña</Label>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                accessibilityLabel="Repetir contraseña"
                autoCapitalize="none"
                autoComplete="new-password"
                secureTextEntry
                style={styles.input}
              />
            </View>
          </>
        )}

        {shownError ? (
          <Body accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
            {shownError}
          </Body>
        ) : null}

        <View style={styles.spacer} />
        <CTA
          label={account.busy ? "Un momento…" : codePhase ? "Verificar código" : "Crear mi cuenta"}
          onPress={() => void submit()}
        />
        <Pressable
          onPress={onSignIn}
          hitSlop={10}
          accessibilityRole="link"
          accessibilityLabel="Ya tengo cuenta: iniciar sesión"
          style={styles.signInLink}
        >
          {/* UNA sola línea, sin `Text` anidados: en react-native-web el color
              en línea del padre no llega a los hijos `Text` y la fila entera
              quedaba casi negra sobre el fondo casi negro. */}
          <Body style={styles.signInText}>Ya tengo cuenta · Iniciar sesión</Body>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: 14, justifyContent: "center", paddingHorizontal: GUTTER },
  field: { gap: 6 },
  input: {
    borderBottomColor: orbita.line,
    borderBottomWidth: 1,
    color: orbita.bone,
    fontFamily: font.sans,
    fontSize: 17,
    paddingVertical: 10
  },
  error: { color: "#D07A5A" },
  notice: { color: orbita.muted },
  spacer: { height: 8 },
  // 44px reales de objetivo táctil: `hitSlop` no existe en web.
  signInLink: { alignItems: "center", alignSelf: "center", justifyContent: "center", minHeight: 44, paddingHorizontal: 12 },
  // Era `orbita.muted` entero, sin subrayado y sin peso: leía como una nota al
  // pie y no como el camino de vuelta que es. `copperSoft` da 8,14:1 sobre el
  // fondo, y el subrayado lo hace reconocible como enlace sin depender del
  // color. En la LÍNEA COMPLETA, por el mismo motivo que en el splash.
  signInText: {
    color: orbita.copperSoft,
    fontFamily: font.sansBold,
    fontSize: 15,
    textAlign: "center",
    textDecorationLine: "underline"
  }
});
