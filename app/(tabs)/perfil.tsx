import { useRef, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation } from "convex/react";
import { Body, Divider, Eyebrow, H2, MonoLine, Note, OrbitaScreen, Pill, Section } from "@/components/orbita/kit";
import { FullBleedHero } from "@/components/orbita/ImmersiveHero";
import { CartaCard } from "@/components/home/CartaCard";
import { useAppData } from "@/domain/appData";
import { requestAccountDeletion } from "@/domain/accountDeletion";
import { useAppState } from "@/hooks/useAppState";
import { useLiveApp } from "@/hooks/useLiveApp";
import type { OrbitaAuth } from "@/hooks/useOrbitaAuth";
import { appApi } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";
import {
  clearAccountSnapshot,
  clearPendingAccountDeletion,
  storePendingAccountDeletion
} from "@/services/storage";
import { orbita } from "@/theme/orbita";

const PRIVACY_URL = "https://orbitaastrologia.xyz/privacy";
const SUPPORT_URL = "https://orbitaastrologia.xyz/support";

/** Alert nativo como promesa; cerrar sin elegir cuenta como cancelar. */
function askConfirm(opts: {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    Alert.alert(
      opts.title,
      opts.message,
      [
        { text: "Cancelar", style: "cancel", onPress: () => settle(false) },
        {
          text: opts.confirmLabel,
          style: opts.destructive ? "destructive" : "default",
          onPress: () => settle(true)
        }
      ],
      { cancelable: true, onDismiss: () => settle(false) }
    );
  });
}

export default function PerfilScreen() {
  const { perfil } = useAppData();
  const { auth, isAuthLoading, userError, retryUser } = useLiveApp();

  return (
    <OrbitaScreen>
      <FullBleedHero kind="perfil">
        <MonoLine>{perfil.birthLine}</MonoLine>
      </FullBleedHero>
      <CartaCard />
      <Section style={{ paddingTop: orbita.spacing.lg }}>
        <Eyebrow>PERFIL</Eyebrow>
        <H2>Tu carta,{"\n"}tus datos.</H2>
        <Body>Tus datos de nacimiento afinan toda la lectura. Editá tu cuenta y tus datos cuando quieras.</Body>
        <Note>{perfil.privacy}</Note>
        <Divider />
        <Eyebrow>CUENTA</Eyebrow>
        {auth?.isSignedIn ? (
          // Solo se monta con sesión: los providers de Convex/Clerk existen.
          <AccountSignedIn auth={auth} isAuthLoading={isAuthLoading} userError={userError} retryUser={retryUser} />
        ) : isAuthLoading ? (
          // Clerk/Convex todavía cargando: estado neutro, NUNCA afirmar invitado.
          <Body bone>Conectando tu cuenta…</Body>
        ) : (
          <View>
            <Body bone>Modo invitado · datos solo en este teléfono.</Body>
            {backendConfig.isConfigured ? (
              <Pressable
                onPress={() => router.push("/iniciar-sesion")}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Note>¿Ya tenés cuenta? Iniciá sesión para recuperar tu carta y tus lecturas.</Note>
              </Pressable>
            ) : null}
          </View>
        )}
        <Divider />
        <Eyebrow>LEGAL</Eyebrow>
        <Pressable
          onPress={() => Linking.openURL(PRIVACY_URL)}
          accessibilityRole="link"
          hitSlop={8}
          style={styles.legalLink}
        >
          <Body bone>Política de privacidad</Body>
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL(SUPPORT_URL)}
          accessibilityRole="link"
          hitSlop={8}
          style={styles.legalLink}
        >
          <Body bone>Soporte</Body>
        </Pressable>
        <View style={{ height: orbita.spacing.xl }} />
        <Pill label="EDITAR DATOS" onPress={() => router.push("/editar-datos")} />
      </Section>
    </OrbitaScreen>
  );
}

function AccountSignedIn({
  auth,
  isAuthLoading,
  userError,
  retryUser
}: {
  auth: OrbitaAuth;
  isAuthLoading: boolean;
  userError: boolean;
  retryUser: () => void;
}) {
  const { archiveAccountData, resetApp } = useAppState();
  const deleteConvexAccount = useMutation(appApi.users.deleteAccount);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<"convex" | "marker" | "clerk" | null>(null);
  // Lock SINCRÓNICO de reentrada: `deleting` (estado React) recién se refleja
  // en el próximo render, así que dos taps rápidos abrirían dos flujos
  // destructivos en paralelo (dos cadenas de alerts, dos user.delete()). El
  // ref se toma en la PRIMERA línea del handler, se libera al cancelar o
  // fallar, y en el éxito queda tomado (ya navegamos fuera del Perfil).
  const deletionInFlight = useRef(false);

  async function handleLogout() {
    if (loggingOut || deleting || deletionInFlight.current) return;
    setLoggingOut(true);
    setLogoutError(false);
    try {
      // 1. Archivar PRIMERO, con la sesión todavía viva: el diario y las
      //    lecturas guardadas NO están en Convex; si el snapshot no se puede
      //    escribir (o hay datos sin userId), se aborta el logout — nunca
      //    pérdida silenciosa.
      await archiveAccountData(auth.userId ?? null);
      // 2. Cerrar Clerk. Un fallo acá también mantiene la sesión y muestra
      //    reintento: no fingimos que salió bien.
      await auth.signOut();
    } catch {
      setLogoutError(true);
      setLoggingOut(false);
      return;
    }
    // 3. Recién ahora limpiar el estado activo (nada visible para el próximo
    //    usuario; reingresar con esta cuenta en este teléfono lo restaura) y
    //    volver a la entrada estable, sin repetir el video. El invitado puro
    //    nunca ve este botón.
    try {
      await resetApp();
    } catch {
      // El snapshot ya se escribió y el perfil quedó marcado con su dueño en
      // disco (archiveAccountData): aunque esta limpieza falle, el arranque ve
      // "perfil con dueño y sin sesión" y pide login en vez de mostrarlo (ya
      // no existe la purga automática). Si entra OTRA cuenta, el login archiva
      // lo del dueño anterior y limpia antes de restaurar: nadie ve datos ajenos.
    }
    router.replace("/onboarding");
  }

  async function handleDeleteAccount() {
    if (deletionInFlight.current || loggingOut) return;
    deletionInFlight.current = true;
    const userId = auth.userId ?? null;
    setDeleteError(null);
    const result = await requestAccountDeletion(
      {
        confirmWarning: () =>
          askConfirm({
            title: "Eliminar tu cuenta",
            message:
              "Vas a borrar tu cuenta de Órbita y todos tus datos: tu carta natal, tus lecturas, tu diario y tus guardadas. Esta acción no se puede deshacer.",
            confirmLabel: "Continuar"
          }),
        confirmDestructive: () =>
          askConfirm({
            title: "¿Eliminar definitivamente?",
            message: "Última confirmación: tu cuenta y tus datos se borran para siempre.",
            confirmLabel: "Eliminar mi cuenta",
            destructive: true
          })
      },
      {
        // Orden estricto Convex → marcador → Clerk → limpieza local → retirar
        // marcador (ver domain/accountDeletion). El marcador es lo único que
        // autoriza al arranque a completar la purga si la limpieza falla acá.
        deleteConvexAccount: async () => {
          setDeleting(true);
          return await deleteConvexAccount({});
        },
        markPendingCleanup: () => storePendingAccountDeletion(userId),
        deleteClerkUser: () => auth.deleteUser(),
        clearLocalData: async () => {
          await resetApp();
          // A diferencia del logout, acá también se borra el snapshot por
          // cuenta: la cuenta ya no existe y no hay nada que restaurar.
          if (userId) await clearAccountSnapshot(userId);
        },
        clearPendingCleanup: () => clearPendingAccountDeletion(),
        goToEntry: () => router.replace("/onboarding")
      }
    );
    if (result.status === "error") setDeleteError(result.step);
    if (result.status !== "success") {
      setDeleting(false);
      deletionInFlight.current = false;
    }
  }

  return (
    <View>
      <Body bone>{auth.name ?? auth.email ?? "Tu cuenta"}</Body>
      {auth.email ? (
        <Note>
          {auth.email.includes("privaterelay.appleid.com") ? "Conectada con Apple" : auth.email}
        </Note>
      ) : null}
      {userError ? (
        <Pressable onPress={retryUser} accessibilityRole="button" hitSlop={8}>
          <Note>No pudimos sincronizar tu cuenta. Tocá para reintentar.</Note>
        </Pressable>
      ) : isAuthLoading ? (
        <Note>Sincronizando con tu cielo…</Note>
      ) : null}
      {logoutError ? (
        <Note>
          No pudimos cerrar sesión de forma segura. Tus datos siguen acá; probá de nuevo.
        </Note>
      ) : null}
      <Pressable onPress={handleLogout} accessibilityRole="button" style={styles.logoutBtn} hitSlop={8}>
        <Text style={styles.logoutText}>
          {loggingOut ? "Un momento…" : logoutError ? "Reintentar cerrar sesión" : "Cerrar sesión"}
        </Text>
      </Pressable>
      {deleteError ? (
        <Note>
          {deleteError === "convex"
            ? "No pudimos eliminar tu cuenta. Todo sigue como estaba; probá de nuevo."
            : "La eliminación quedó incompleta. Tu sesión sigue acá; probá de nuevo para terminarla."}
          {/* "marker" y "clerk" comparten copy: en ambos la sesión sigue viva
              y el reintento re-corre el flujo completo (Convex es idempotente). */}
        </Note>
      ) : null}
      <Pressable
        onPress={handleDeleteAccount}
        accessibilityRole="button"
        style={styles.deleteBtn}
        hitSlop={8}
      >
        <Text style={styles.deleteText}>
          {deleting ? "Eliminando tu cuenta…" : deleteError ? "Reintentar eliminación" : "Eliminar mi cuenta"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  deleteBtn: {
    alignSelf: "flex-start",
    borderColor: orbita.colors.danger,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: orbita.spacing.md,
    paddingHorizontal: orbita.spacing.lg,
    paddingVertical: orbita.spacing.sm
  },
  deleteText: {
    color: orbita.colors.danger,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 1
  },
  legalLink: {
    marginTop: orbita.spacing.sm
  },
  logoutBtn: {
    alignSelf: "flex-start",
    borderColor: orbita.colors.line,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: orbita.spacing.md,
    paddingHorizontal: orbita.spacing.lg,
    paddingVertical: orbita.spacing.sm
  },
  logoutText: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 1
  }
});
