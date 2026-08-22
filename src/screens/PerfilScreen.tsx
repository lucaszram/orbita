import { useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Body, Divider, Eyebrow, H2, MonoLine, Note, OrbitaScreen, Pill, Section } from "@/components/orbita/kit";
import { ManageSubscriptionBlock } from "@/components/orbita/ManageSubscription";
import { usePendingDeletionGate } from "@/components/PendingDeletionBoundary";
import { useConfirm } from "@/components/orbita/ConfirmHost";
import { FullBleedHero } from "@/components/orbita/ImmersiveHero";
import { CartaCard } from "@/components/home/CartaCard";
import { useQuery } from "convex/react";
import { resolveBirthInfo } from "@/domain/birthInfo";
import { requestAccountDeletion } from "@/domain/accountDeletion";
// El inventario de lo que se borra es lo único que cambia por plataforma: la
// web nombra su Diario, nativo no (no lo tiene). Metro resuelve la variante.
import {
  DELETE_ACCOUNT_SUBSCRIPTION_WARNING,
  DELETE_ACCOUNT_WARNING
} from "@/domain/accountDeletionCopy";
import { sensitiveOperationBlockMessage } from "@/domain/sessionResilience";
import { useAppState } from "@/hooks/useAppState";
import { useSensitiveOperation } from "@/hooks/useSessionResilience";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import { useLiveApp } from "@/hooks/useLiveApp";
import type { OrbitaAuth } from "@/hooks/useOrbitaAuth";
import { appApi } from "@/services/appRefs";
import { backendConfig } from "@/services/backendProviders";
import { storePendingAccountDeletion } from "@/services/storage";
import { orbita } from "@/theme/orbita";

const PRIVACY_URL = "https://orbitaastrologia.xyz/privacy";
const SUPPORT_URL = "https://orbitaastrologia.xyz/support";
/**
 * Microcopy de privacidad. Salía de `useAppData().perfil.privacy` — el mock
 * tipado del App Core, que para entregar esta constante armaba de paso una
 * carta, unos tránsitos y un calendario inventados sobre un perfil de relleno.
 * Es una frase fija: vive acá, y el mock ya no existe.
 */
const PRIVACY_NOTE = "Se usan solo para calcular tu carta. No los compartimos con nadie.";

/**
 * Perfil — la pantalla administrativa canónica.
 *
 * Desde 2026-08-19 tiene dos superficies: en WEB sigue siendo `/perfil` tal
 * cual (hero + tarjeta de carta + cuerpo administrativo). En NATIVO la pestaña
 * "Tu carta" muestra el hub de la carta, y este cuerpo vive detrás del
 * engranaje, en `/perfil/ajustes` (ver `PerfilAjustesBody` más abajo).
 */
export function PerfilScreen() {
  const { auth, isAuthLoading, userError, retryUser } = useLiveApp();
  // `useIsDesktop` sólo puede ser true bajo el shell web: en nativo el contexto
  // no está montado y vale siempre "mobile".
  const desktop = useIsDesktop();
  const isLive = !!auth?.isSignedIn;
  // La autoridad de los datos natales es el documento REMOTO, no el perfil
  // local: el perfil local cae a `createFallbackProfile()` y así se llegó a
  // mostrar "12 Abr 1994" —una fecha inventada— como si fuera de la persona.
  const remote = useQuery(appApi.birthData.getCurrent, isLive ? {} : "skip");
  const birth = resolveBirthInfo({ doc: remote ?? null, resolved: !isLive || remote !== undefined });

  return (
    // El Perfil es una columna de LECTURA, no una pantalla de composición: son
    // datos, ajustes y links, no una pieza visual que quiera 1200px. El lienzo
    // lo monta `OrbitaScreen` (y en escritorio web se queda sin el header
    // interno, que duplicaba la marca de la navegación).
    <OrbitaScreen canvas="reading">
      <>
        {/* Hero medido: alto fijo y ancho real del contenedor. Antes se
            dimensionaba en porcentaje y en web podía quedar un rectángulo
            negro del alto del hero, sin imagen.

            En escritorio NO se dibuja. El Perfil es una columna de lectura de
            720 sobre un fondo cósmico full-bleed: la banda quedaba como una
            lámina rectangular con los bordes duros cortados contra ese fondo, y
            leía como un error de maquetación más que como una portada. Sin
            ella, el contenido editorial arranca limpio debajo de la
            navegación. En móvil web y en nativo el hero sigue igual: ahí ocupa
            el ancho completo y es el arranque de la pantalla. */}
        {desktop ? null : (
          <FullBleedHero kind="perfil" height={240}>
            {/* Sólo se muestra la línea con datos remotos COMPLETOS y verificados. */}
            {birth.status === "complete" ? <MonoLine>{birth.line}</MonoLine> : null}
          </FullBleedHero>
        )}
        {/* Con datos incompletos no se dibuja rueda ni se afirma que hay carta. */}
        {birth.status === "complete" ? <CartaCard /> : null}
        <CuerpoAdministrativo
          desktop={desktop}
          birth={birth}
          auth={auth}
          isAuthLoading={isAuthLoading}
          userError={userError}
          retryUser={retryUser}
        />
      </>
    </OrbitaScreen>
  );
}

/**
 * El cuerpo administrativo del Perfil: editar datos, cuenta, suscripción y
 * legales. Extraído para servir a dos superficies sin duplicar una línea:
 *
 * - `PerfilScreen` (web): igual que siempre, debajo del hero y la tarjeta.
 * - `PerfilAjustesBody` (nativo): detrás del engranaje de "Tu carta", dentro de
 *   un `DetailLayerScreen` con ← que vive en `src/routes/v492/perfil-ajustes.tsx`.
 *
 * El texto de este archivo está fijado por varios tests que lo leen como
 * fuente (eliminación de cuenta, suscripción, App Review): la extracción
 * conserva el JSX byte a byte.
 */
function CuerpoAdministrativo({
  desktop,
  birth,
  auth,
  isAuthLoading,
  userError,
  retryUser
}: {
  desktop: boolean;
  birth: ReturnType<typeof resolveBirthInfo>;
  auth: OrbitaAuth | null;
  isAuthLoading: boolean;
  userError: boolean;
  retryUser: () => void;
}) {
  return (
        <Section style={{ paddingTop: orbita.spacing.lg }}>
          <Eyebrow>PERFIL</Eyebrow>
          <H2>Tu carta,{"\n"}tus datos.</H2>
          {/* La línea de nacimiento vivía SOLO dentro del hero. Al sacarlo del
              escritorio hay que conservar el dato acá — y sólo acá, para no
              repetirlo en móvil, donde ya se lee al pie del hero. */}
          {desktop && birth.status === "complete" ? (
            <View style={styles.birthLine}>
              <MonoLine>{birth.line}</MonoLine>
            </View>
          ) : null}
          {birth.status === "incomplete" ? (
            <Body bone>{birth.message}</Body>
          ) : (
            <Body>Tus datos de nacimiento afinan toda la lectura. Editá tu cuenta y tus datos cuando quieras.</Body>
          )}
          {/* Un ÚNICO `EDITAR DATOS`, acá arriba: con datos incompletos es la
              acción a tomar, y con datos completos sigue siendo su lugar natural.
              Antes vivía al final de la pantalla, lejos del estado que lo pide. */}
          <View style={{ height: orbita.spacing.md }} />
          <Pill label="EDITAR DATOS" onPress={() => router.push("/editar-datos")} />
          <View style={{ height: orbita.spacing.md }} />
          <Note>{PRIVACY_NOTE}</Note>
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
        </Section>
  );
}

/**
 * Lo administrativo del Perfil, para la pantalla nativa de ajustes.
 *
 * En nativo la pestaña "Tu carta" muestra el hub de la carta; esto queda
 * detrás del engranaje. Sin `OrbitaScreen`, sin hero y sin `CartaCard`: el
 * shell (scroll + lienzo + ←) lo pone el `DetailLayerScreen` del wrapper.
 */
export function PerfilAjustesBody() {
  const { auth, isAuthLoading, userError, retryUser } = useLiveApp();
  const isLive = !!auth?.isSignedIn;
  const remote = useQuery(appApi.birthData.getCurrent, isLive ? {} : "skip");
  const birth = resolveBirthInfo({ doc: remote ?? null, resolved: !isLive || remote !== undefined });
  return (
    <CuerpoAdministrativo
      desktop={false}
      birth={birth}
      auth={auth ?? null}
      isAuthLoading={isAuthLoading}
      userError={userError}
      retryUser={retryUser}
    />
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
  /**
   * Borrar la cuenta exige sesión CONFIRMADA (QA23-007).
   *
   * El shell puede estar abierto en modo degradado —últimos datos de esta misma
   * cuenta, con la sesión sin confirmar— y ahí este botón no puede existir: la
   * eliminación arranca escribiendo un marcador con un dueño y sigue con una
   * mutación destructiva en Convex y un `user.delete()` en Clerk. Sin poder
   * confirmar QUIÉN es la sesión viva, ninguna de las tres cosas se puede
   * atribuir. El bloqueo es de la ACCIÓN además de la vista: `allowed` se
   * revalida dentro del handler, porque entre el render y el tap puede cambiar.
   */
  const eliminacion = useSensitiveOperation("account-delete");
  // El boundary global de eliminación pendiente: si la eliminación queda a
  // medias, publicarle el marcador desmonta el producto entero.
  const { publish: publishPendingDeletion } = usePendingDeletionGate();
  // `Alert.alert` es no-op en react-native-web: en la web la confirmación
  // nunca resolvía y el flujo de borrado quedaba colgado con el lock tomado.
  const askConfirm = useConfirm();
  // Acá NO se llama a Convex: la mutación destructiva (`deleteAccountV2`) la
  // dispara el boundary global, con el producto ya desmontado.
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // El único error de pantalla que queda es no poder escribir el marcador: ahí
  // no se borró nada. Todo lo destructivo vive en el boundary.
  const [deleteError, setDeleteError] = useState<"marker" | null>(null);
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
    // Fail closed en el instante del tap, no sólo al dibujar.
    if (!eliminacion.allowed) return;
    deletionInFlight.current = true;
    const userId = auth.userId ?? null;
    setDeleteError(null);
    const result = await requestAccountDeletion(
      {
        confirmWarning: () =>
          askConfirm({
            title: "Eliminar tu cuenta",
            // El aviso comercial va en la PRIMERA confirmación, con tiempo de
            // salir a cancelar: borrar la cuenta no detiene el cobro.
            message: `${DELETE_ACCOUNT_WARNING}\n\n${DELETE_ACCOUNT_SUBSCRIPTION_WARNING}`,
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
        // La pantalla NO borra nada. Deja escrita la intención —fase
        // `deletion_requested`, con el dueño capturado— y entrega el control.
        //
        // Hasta la pasada anterior la mutación destructiva de Convex salía de
        // acá, con la app entera montada: entre la segunda confirmación y esa
        // llamada Clerk podía entregar otra sesión, así que el camino FELIZ era
        // una carrera A → B. Y si el proceso moría en ese hueco, no quedaba nada
        // en disco que dijera que esta cuenta se estaba borrando.
        ownerUserId: userId ?? "",
        markDeletionRequested: async () => {
          setDeleting(true);
          // Fallar cerrado: sin userId el marcador no tendría dueño, y sin
          // marcador válido no se le entrega el control a nadie.
          if (!userId) throw new Error("userId requerido para el marcador de eliminación");
          await storePendingAccountDeletion(userId, "deletion_requested");
        }
      }
    );
    if (result.status === "error") setDeleteError(result.step);
    // La intención está persistida: se entrega el control AHORA, antes de que
    // se haya borrado nada.
    //
    // `publish` es sincrónico: el producto —sesión, AppState, bootstrap, Stack—
    // se desmonta en este mismo render. No se navega ni se libera la pantalla:
    // dejar el Perfil usable permitía cerrar sesión o entrar con otra cuenta con
    // el marcador de ésta vivo en disco.
    if (result.status === "handoff") {
      publishPendingDeletion(result.marker);
      return;
    }
    setDeleting(false);
    deletionInFlight.current = false;
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
      {/* La suscripción es parte de la identidad de la cuenta —qué plan tenés,
          dónde se gestiona—, así que se lee junto al email y ANTES de las
          acciones. Montado acá adentro sólo existe con sesión: es el mismo
          `auth.isSignedIn` que decide montar `AccountSignedIn`. */}
      <ManageSubscriptionBlock />
      {/* Corte editorial: lo de arriba es información; lo de abajo, acciones
          sobre la cuenta —cerrar sesión y, al final de todo, eliminarla. */}
      <Divider />
      <Eyebrow>ACCIONES DE CUENTA</Eyebrow>
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
          {/* El único corte posible pasa ANTES de borrar nada: no se pudo dejar
              la marca en este dispositivo. Todo sigue como estaba. */}
          No pudimos empezar a eliminar tu cuenta. Todo sigue como estaba; probá de nuevo.
        </Note>
      ) : null}
      {/* Por qué no se puede, dicho donde se intenta y ANTES del botón: un
          botón apagado sin explicación se lee como un error de la app. */}
      {eliminacion.allowed ? null : (
        <View accessibilityLiveRegion="polite">
          <Note>{sensitiveOperationBlockMessage("account-delete")}</Note>
        </View>
      )}
      <Pressable
        onPress={handleDeleteAccount}
        accessibilityRole="button"
        disabled={!eliminacion.allowed}
        accessibilityState={{ disabled: !eliminacion.allowed }}
        style={[styles.deleteBtn, eliminacion.allowed ? null : styles.deleteBtnDisabled]}
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
  // Escritorio: la línea de nacimiento que en móvil va al pie del hero.
  birthLine: { marginTop: orbita.spacing.md },
  deleteBtn: {
    alignSelf: "flex-start",
    borderColor: orbita.colors.danger,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: orbita.spacing.md,
    paddingHorizontal: orbita.spacing.lg,
    paddingVertical: orbita.spacing.sm
  },
  // Sesión sin confirmar: el borde baja de intensidad para que se lea apagado,
  // sin cambiar el color del texto (el contraste tiene que seguir siendo real).
  deleteBtnDisabled: { opacity: 0.45 },
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
