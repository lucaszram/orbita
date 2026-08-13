import { Image, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";

import { A } from "../assets";
import { ClerkSignUp } from "../components/ClerkSignUp";
import { CTA } from "../components/CTA";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { Body, Title } from "../components/Type";
import { font, GUTTER } from "../theme";

/** En qué estado está el borrador remoto que habilita abrir Clerk. */
export type SignupDraftPhase = "preparing" | "error" | "ready";

type Props = {
  step: number;
  phase: SignupDraftPhase;
  error: string | null;
  /**
   * Email que la persona ya escribió antes de llegar al paso (lo trae el login
   * en `?email=`, o el borrador). Sólo PRELLENA el campo de Clerk: la pantalla
   * no tiene campo propio ni lo valida.
   */
  email?: string;
  onRetry: () => void;
  onBack: () => void;
};

/**
 * 14 — Create account (save your chart).
 *
 * La cuenta se crea con la UI OFICIAL de Clerk: `SignUp` en web y `AuthView
 * mode="signUp"` en nativo (`../components/ClerkSignUp`). Acá vivía un
 * formulario propio —email, contraseña, repetir contraseña, código, reenvío,
 * rama "ese email ya tiene cuenta"— que reimplementaba la máquina de estados de
 * Clerk y quedaba desfasado con cada requisito nuevo de la instancia.
 *
 * NO se piden nombre ni apellido, y NO se agrega ningún paso: si Clerk los
 * aporta se conservan, y si no, el alta cierra igual.
 *
 * Antes de montar Clerk, el borrador del alta ya tiene que estar PERSISTIDO y
 * confirmado en el backend (`phase === "ready"`). Crear la identidad primero es
 * lo que produce cuentas sin datos que ninguna pantalla sabe recuperar.
 */
export function AccountScreen({ step, phase, error, email, onRetry, onBack }: Props) {
  return (
    // El arte del sobre queda como atmósfera detrás del formulario: a más
    // opacidad competía con los campos de Clerk. El sello sube como pieza
    // compacta arriba del título, dentro de la MISMA columna.
    <Screen bg={A.accountBg} bgOpacity={0.32} wash={0.74}>
      <Header step={step} total={15} onBack={onBack} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.seal}>
          <Image source={A.accountBg} style={styles.sealImg} resizeMode="cover" />
        </View>
        <Title>Guardá tu carta.</Title>
        <Body style={styles.sub}>Tu historial, tus lecturas y tus tránsitos quedan en tu cuenta.</Body>

        {phase === "ready" ? (
          <View style={styles.clerkZone}>
            <ClerkSignUp email={email} />
          </View>
        ) : phase === "error" ? (
          // No se abre Clerk: sin el borrador confirmado, la cuenta nueva
          // quedaría sin datos. Los datos cargados siguen intactos.
          <View style={styles.stateZone}>
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
              {error ?? "No pudimos guardar tus datos. Probá de nuevo."}
            </Text>
            <CTA label="Reintentar" onPress={onRetry} />
          </View>
        ) : (
          <View style={styles.stateZone}>
            <Body accessibilityLiveRegion="polite" style={styles.preparing}>
              Guardando tus datos…
            </Body>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  clerkZone: { marginTop: 22, minHeight: 380, width: "100%" },
  error: {
    color: "#D07A5A",
    fontFamily: font.sans,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18
  },
  preparing: { textAlign: "center" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 56, paddingHorizontal: GUTTER, paddingTop: 26 },
  // El sello, compacto y deliberado, arriba del título. Un disco de 420px en
  // una segunda columna empujaba el formulario contra el borde y dejaba el
  // botón de Clerk fuera de alcance en cualquier viewport bajo.
  seal: {
    alignSelf: "center",
    borderColor: "rgba(214,154,106,0.55)",
    borderRadius: 44,
    borderWidth: 1,
    height: 88,
    marginBottom: 20,
    overflow: "hidden",
    width: 88
  },
  sealImg: { height: "100%", width: "100%" },
  stateZone: { justifyContent: "center", marginTop: 32, minHeight: 160 },
  sub: { marginTop: 10 }
});
