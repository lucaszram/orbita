import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { startSignupGate } from "../authGate";
import { CodeHelp } from "../components/CodeHelp";
import { CodeInput } from "../components/CodeInput";
import { CTA } from "../components/CTA";
import { Screen } from "../components/Screen";
import { Body, Caption, Label } from "../components/Type";
import { font, GUTTER, orbita } from "../theme";
import {
  APPLE_AUTH_ENABLED,
  GOOGLE_AUTH_ENABLED,
  type AccountFlow,
  type OAuthProvider,
  type SignInFlow
} from "../useAccount";

/**
 * 01 — Crear cuenta o ingresar: la PRIMERA superficie del onboarding.
 *
 * Crear cuenta e ingresar son MODOS de esta misma pantalla (selector de
 * puerta); verificación de email, contraseña legacy de ingreso y errores son
 * estados internos y no agregan pasos. Apple, Google y email son vías del acceso oficial de Clerk:
 * los hooks (`useAccountFlow` / `useSignInFlow` / SSO) hablan con Clerk, y los
 * campos son nativos de Órbita — no la tarjeta hospedada.
 *
 * Los botones de proveedor sólo existen si la conexión está habilitada
 * externamente (`GOOGLE_AUTH_ENABLED` / `APPLE_AUTH_ENABLED`): no se simula un
 * proveedor que no está.
 *
 * La pantalla NO navega: cuando la sesión queda activa, el flujo decide con el
 * estado autoritativo (cuenta completa → destino autoritativo; nueva o
 * incompleta → continúa por la promesa y los datos natales).
 */

export type AuthMode = "signup" | "signin";

type Props = {
  signUp: AccountFlow | null;
  signIn: SignInFlow | null;
  /** Email prellenado (el login lo trae por `?email=`, o el borrador). */
  initialEmail?: string;
  /** Sesión ya activa: se espera la autoridad de readiness para decidir. */
  entering: boolean;
  /**
   * Antes de crear la cuenta (email u OAuth en modo alta): siembra el marcador
   * remoto de "alta en curso". Es IMPRESCINDIBLE: si rechaza, Clerk NO se
   * invoca — la pantalla dice el fallo y el reintento vuelve a empezar acá.
   */
  onBeforeSignup?: () => Promise<void> | void;
  /**
   * La persona entra por el camino de INGRESO (modo Ingresar, o el alta que
   * cayó a sign-in porque el email ya tenía cuenta): el flujo descarta el
   * marcador de alta nueva para no reclasificar una cuenta preexistente.
   */
  onSignInPath?: () => void;
  /** Volver (sólo web: a la landing). Sin handler no se dibuja. */
  onBack?: () => void;
};

const MARKER_FAILED_ERROR =
  "No pudimos preparar tu alta. Revisá tu conexión y probá de nuevo: tu cuenta todavía no se creó.";

export function AuthScreen({
  signUp,
  signIn,
  initialEmail,
  entering,
  onBeforeSignup,
  onSignInPath,
  onBack
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const flow = mode === "signup" ? signUp : signIn;
  // Con la sesión ya activa no queda nada que verificar acá: la puerta muestra
  // el estado de entrada mientras la autoridad de readiness decide la salida.
  const sessionLive = Boolean(flow?.isSignedIn);
  const signupCodePhase = mode === "signup" && signUp?.phase === "code" && !sessionLive;
  const signinCodePhase = mode === "signin" && signIn?.phase === "code" && !sessionLive;
  const codePhase = signupCodePhase || signinCodePhase;
  const passwordPhase = mode === "signin" && signIn?.phase === "password" && !sessionLive;
  const busy = Boolean(flow?.busy) || entering;
  const error = localError ?? flow?.error ?? null;
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim().toLowerCase());

  const cambiarModo = (next: AuthMode) => {
    if (busy || next === mode) return;
    setLocalError(null);
    setCode("");
    signUp?.resetToEmail();
    signIn?.resetToEmail();
    setMode(next);
  };

  const empezar = async () => {
    if (busy) return;
    setLocalError(null);
    const trimmed = email.trim().toLowerCase();
    if (!emailValid) {
      setLocalError("Escribí un email válido para continuar.");
      return;
    }
    if (mode === "signup") {
      // El marcador imprescindible va PRIMERO: si no se guardó, Clerk no se
      // invoca y el reintento vuelve a empezar por el marcador.
      const outcome = await startSignupGate({
        seedMarker: onBeforeSignup ? async () => void (await onBeforeSignup()) : undefined,
        createAccount: async () => void (await signUp?.start(trimmed))
      });
      if (outcome === "marker_failed") setLocalError(MARKER_FAILED_ERROR);
      return;
    }
    onSignInPath?.();
    await signIn?.start(trimmed);
  };

  const verificar = async (codeOverride?: string) => {
    if (busy) return;
    const value = (codeOverride ?? code).trim();
    if (!value) return;
    if (signupCodePhase) {
      await signUp?.verify(value);
      return;
    }
    await signIn?.verify(value);
  };

  const entrarConPassword = async () => {
    if (busy || !password) return;
    await signIn?.verifyPassword(password);
  };

  const oauth = async (provider: OAuthProvider) => {
    if (busy || flow?.oauthBusy) return;
    setLocalError(null);
    if (mode === "signup") {
      // Misma puerta que el alta por email: sin marcador guardado no se abre
      // el navegador del proveedor. Y si Clerk resuelve el SSO por el recurso
      // de INGRESO (la cuenta ya existía), el marcador se descarta ANTES de
      // activar la sesión (`onExistingAccount`): la consulta autoritativa
      // clasifica esa cuenta por lo persistido, nunca como alta nueva.
      const outcome = await startSignupGate({
        seedMarker: onBeforeSignup ? async () => void (await onBeforeSignup()) : undefined,
        createAccount: async () =>
          void (await flow?.oauth(provider, { onExistingAccount: onSignInPath }))
      });
      if (outcome === "marker_failed") setLocalError(MARKER_FAILED_ERROR);
      return;
    }
    onSignInPath?.();
    await flow?.oauth(provider);
  };

  const volverAlEmail = () => {
    setCode("");
    setPassword("");
    setLocalError(null);
    flow?.resetToEmail();
  };

  // ---- Estado interno: verificación del email (código de 6 dígitos) --------
  if (codePhase) {
    return (
      <Screen bg={A.dailyTexture} bgOpacity={0.55} wash={0.66} scroll>
        <View style={styles.body}>
          <Wordmark />
          <Label style={styles.kicker}>Verificá tu email</Label>
          <Text style={HERO_TITLE}>Te mandamos{"\n"}un código.</Text>
          <Body style={styles.sub}>Ingresá los seis números que enviamos a {email.trim().toLowerCase()}.</Body>
          {mode === "signup" && signUp?.existingAccount ? (
            <Caption style={styles.existing}>
              Ese email ya tiene una cuenta: el código que te mandamos te hace entrar a ella.
            </Caption>
          ) : null}
          <CodeInput value={code} onChange={setCode} onFilled={(filled) => void verificar(filled)} />
          {flow ? <CodeHelp onResend={flow.resend} /> : null}
          {error ? <ErrorNotice message={error} /> : null}
          <View style={styles.spacer} />
          {entering ? <EnteringNote /> : null}
          <View style={styles.footer}>
            <CTA
              label={busy ? "Un momento…" : "Verificar y continuar"}
              onPress={busy ? undefined : () => void verificar()}
              disabled={busy}
            />
            <Pressable
              onPress={busy ? undefined : volverAlEmail}
              accessibilityRole="button"
              style={styles.quietRow}
            >
              <Text style={styles.quietLink}>Usar otro email</Text>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  // ---- Puerta principal (modos crear cuenta / ingresar) --------------------
  const title = mode === "signup" ? "Creá tu cuenta" : "Bienvenido de nuevo";
  const subtitle = passwordPhase
    ? "Escribí tu contraseña para entrar."
    : mode === "signup"
      ? "Guardamos tu carta en tu cuenta. Así podés entrar desde cualquier teléfono y no perdés nada."
      : "Ingresá para retomar exactamente donde dejaste tu carta.";
  const ctaLabel = busy
    ? "Un momento…"
    : passwordPhase
      ? "Ingresar"
      : mode === "signup"
        ? "Enviarme el código"
        : "Continuar";
  const nota = passwordPhase
    ? null
    : mode === "signup"
      ? "Te mandamos un código de 6 dígitos al email para verificarlo."
      : "Te mandamos un código para entrar, o usás tu contraseña.";

  return (
    <Screen bg={A.dailyTexture} bgOpacity={0.55} wash={0.66} scroll>
      <View style={styles.body}>
        <Wordmark />

        <View
          accessibilityRole="tablist"
          accessibilityLabel="Crear cuenta o ingresar"
          style={styles.selector}
        >
          <SelectorHalf label="Crear cuenta" on={mode === "signup"} onPress={() => cambiarModo("signup")} />
          <SelectorHalf label="Ingresar" on={mode === "signin"} onPress={() => cambiarModo("signin")} />
        </View>

        <Text style={TITLE}>{title}</Text>
        <Body style={styles.sub}>{subtitle}</Body>

        {!passwordPhase ? (
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@email.com"
            accessibilityLabel={mode === "signup" ? "Email para tu cuenta" : "Email de tu cuenta"}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        ) : null}

        {passwordPhase ? (
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="Tu contraseña"
            accessibilityLabel="Contraseña"
            secureTextEntry
            textContentType="password"
            onSubmitEditing={() => void entrarConPassword()}
          />
        ) : null}

        {error ? <ErrorNotice message={error} /> : null}

        <View style={styles.primary}>
          <CTA
            label={ctaLabel}
            onPress={busy ? undefined : passwordPhase ? () => void entrarConPassword() : () => void empezar()}
            disabled={busy || (!passwordPhase && !emailValid) || (passwordPhase && !password)}
          />
        </View>
        {nota ? <Caption style={styles.nota}>{nota}</Caption> : null}

        {passwordPhase ? (
          <View style={styles.linksZone}>
            <Pressable
              onPress={busy ? undefined : () => void signIn?.sendEmailCode()}
              accessibilityRole="button"
              style={styles.quietRow}
            >
              <Text style={styles.quietLink}>Mandame un código por email</Text>
            </Pressable>
            <Pressable onPress={busy ? undefined : volverAlEmail} accessibilityRole="button" style={styles.quietRow}>
              <Text style={styles.quietLink}>Usar otro email</Text>
            </Pressable>
          </View>
        ) : (
          <Providers
            oauthBusy={flow?.oauthBusy ?? null}
            disabled={busy}
            onPress={(p) => void oauth(p)}
          />
        )}

        <View style={styles.spacer} />
        {entering ? <EnteringNote /> : null}

        <View style={styles.pie}>
          {onBack ? (
            <Pressable onPress={busy ? undefined : onBack} accessibilityRole="button" style={styles.quietRow}>
              <Text style={styles.quietLink}>Volver</Text>
            </Pressable>
          ) : null}
          <Caption style={styles.legal}>
            Órbita es entretenimiento y autoconocimiento. Al continuar aceptás los{" "}
            <Text
              accessibilityRole="link"
              onPress={() => router.push("/terminos")}
              style={styles.legalLink}
            >
              Términos
            </Text>{" "}
            y la{" "}
            <Text
              accessibilityRole="link"
              onPress={() => router.push("/privacy")}
              style={styles.legalLink}
            >
              Privacidad
            </Text>
            .
          </Caption>
        </View>
      </View>
    </Screen>
  );
}

/**
 * Tipografía en objetos LITERALES, no `StyleSheet.create`: en react-native-web
 * una hoja registrada se compila a clase y pierde contra `text-base` del `Text`
 * compartido — el wordmark de la entrada ya salió a 16px dos veces por esto.
 */
const WORDMARK = {
  color: orbita.bone,
  fontFamily: font.serif,
  fontSize: 24,
  lineHeight: 30
} as const;
const WORDMARK_O = { ...WORDMARK, color: orbita.copper } as const;
const TITLE = {
  color: orbita.bone,
  fontFamily: font.serif,
  fontSize: 34,
  lineHeight: 41
} as const;
const HERO_TITLE = {
  color: orbita.bone,
  fontFamily: font.serif,
  fontSize: 36,
  lineHeight: 42,
  marginTop: 4
} as const;

/** Wordmark serif "Órbita": la Ó en cobre. Única marca del acceso. */
function Wordmark() {
  return (
    <Text accessibilityRole="header" style={WORDMARK}>
      <Text style={WORDMARK_O}>Ó</Text>
      <Text style={WORDMARK}>rbita</Text>
    </Text>
  );
}

function SelectorHalf({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      style={[styles.selectorHalf, on && styles.selectorHalfOn]}
    >
      <Text style={[styles.selectorTxt, on && styles.selectorTxtOn]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  accessibilityLabel,
  ...input
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Label style={styles.fieldLabel}>{label}</Label>
      <TextInput
        accessibilityLabel={accessibilityLabel ?? label}
        placeholderTextColor={orbita.faint}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.fieldInput}
        {...input}
      />
    </View>
  );
}

/**
 * Aviso de error en español, dentro de la misma pantalla: reintentar o cambiar
 * de vía nunca pierde el progreso, y jamás se muestra una URL técnica.
 */
function ErrorNotice({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorCard}>
      <Text style={styles.errorTitle}>No perdiste nada</Text>
      <Text style={styles.errorBody}>{message}</Text>
    </View>
  );
}

/** UN solo anuncio del estado de carga posterior al acceso. */
function EnteringNote() {
  return (
    <Body accessibilityLiveRegion="polite" style={styles.entering}>
      Entrando a tu cuenta…
    </Body>
  );
}

function Providers({
  oauthBusy,
  disabled,
  onPress
}: {
  oauthBusy: OAuthProvider | null;
  disabled: boolean;
  onPress: (provider: OAuthProvider) => void;
}) {
  if (!APPLE_AUTH_ENABLED && !GOOGLE_AUTH_ENABLED) return null;
  return (
    <>
      <View accessibilityRole="none" style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerTxt}>o</Text>
        <View style={styles.dividerLine} />
      </View>
      {APPLE_AUTH_ENABLED ? (
        <ProviderButton
          icon="apple"
          label="Continuar con Apple"
          busy={oauthBusy === "apple"}
          disabled={disabled}
          onPress={() => onPress("apple")}
        />
      ) : null}
      {GOOGLE_AUTH_ENABLED ? (
        <ProviderButton
          icon="google"
          label="Continuar con Google"
          busy={oauthBusy === "google"}
          disabled={disabled}
          onPress={() => onPress("google")}
        />
      ) : null}
    </>
  );
}

/** Botón de proveedor: contorno hueso silencioso sobre oscuro. Nunca cobre. */
function ProviderButton({
  icon,
  label,
  busy,
  disabled,
  onPress
}: {
  icon: "apple" | "google";
  label: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const off = busy || disabled;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: off }}
      style={[styles.provider, off && styles.providerOff]}
    >
      <FontAwesome name={icon} size={18} color={orbita.bone} />
      <Text style={styles.providerTxt}>{busy ? "Un momento…" : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: 18, paddingBottom: 10, paddingHorizontal: GUTTER, paddingTop: 18 },
  selector: {
    backgroundColor: orbita.bgElev,
    borderColor: orbita.line,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    height: 52,
    padding: 4
  },
  selectorHalf: { alignItems: "center", borderRadius: 22, flex: 1, justifyContent: "center", minHeight: 44 },
  selectorHalfOn: { backgroundColor: "#181B22" },
  selectorTxt: { color: orbita.faint, fontFamily: font.sansBold, fontSize: 13, letterSpacing: 1 },
  selectorTxtOn: { color: orbita.bone },
  kicker: { marginTop: 8 },
  sub: { marginTop: -8 },
  existing: { color: orbita.copperSoft },
  field: {
    backgroundColor: orbita.bgElev,
    borderColor: orbita.line,
    borderRadius: 14,
    borderWidth: 1,
    gap: 3,
    justifyContent: "center",
    minHeight: 62,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  fieldLabel: { color: orbita.faint },
  fieldInput: { color: orbita.bone, fontFamily: font.sans, fontSize: 15, padding: 0, paddingVertical: 2 },
  primary: { marginTop: 2 },
  nota: { marginTop: -8 },
  divider: { alignItems: "center", flexDirection: "row", gap: 12 },
  dividerLine: { backgroundColor: orbita.line, flex: 1, height: 1 },
  dividerTxt: { color: orbita.faint, fontFamily: font.sans, fontSize: 14 },
  provider: {
    alignItems: "center",
    backgroundColor: orbita.bgElev,
    borderColor: orbita.bone,
    borderRadius: 27,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    height: 54,
    justifyContent: "center"
  },
  providerOff: { opacity: 0.55 },
  providerTxt: { color: orbita.bone, fontFamily: font.sansMed, fontSize: 16 },
  errorCard: {
    backgroundColor: "#181B22",
    borderColor: "#E38A62",
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 16
  },
  errorTitle: { color: "#E38A62", fontFamily: font.sansMed, fontSize: 14 },
  errorBody: { color: "#A8A19A", fontFamily: font.sans, fontSize: 13, lineHeight: 19 },
  entering: { textAlign: "center" },
  linksZone: { alignItems: "center", gap: 4, marginTop: 4 },
  quietRow: { alignItems: "center", justifyContent: "center", minHeight: 44, paddingHorizontal: 12 },
  quietLink: { color: orbita.muted, fontFamily: font.sansMed, fontSize: 15 },
  footer: { gap: 4, paddingBottom: 12, paddingTop: 12 },
  pie: { alignItems: "center", gap: 4, paddingBottom: 8 },
  legal: { textAlign: "center" },
  legalLink: {
    color: orbita.copperSoft,
    fontFamily: font.sans,
    fontSize: 12,
    lineHeight: 17,
    textDecorationLine: "underline"
  },
  spacer: { flex: 1, minHeight: 8 }
});
