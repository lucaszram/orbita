import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextStyle,
  View
} from "react-native";
import { Redirect, useRouter } from "expo-router";

import { AccountGate } from "@/components/orbita/AccountGate";
import { WebLoading } from "@/components/web/require-session";
import { Text } from "@/components/ui/text";
import { HOME_ROUTE } from "@/domain/appRoutes";
import { onboardingInputFromBirthData } from "@/domain/sessionStart";
import {
  applyBirthEdits,
  birthSaveGate,
  birthSyncUx,
  buildBackendBirthPayload
} from "@/domain/birthEdits";
import {
  birthEditorBlockMessage,
  birthEditorReadiness,
  canSaveBirthEditor,
  draftFromSeed,
  draftToEdits,
  resolveBirthEditorSeed,
  type BirthEditorDraft,
  type BirthEditorSeed
} from "@/domain/birthEditorSeed";
import { createExclusiveGate, runExclusive } from "@/domain/exclusive";
import { useAppState } from "@/hooks/useAppState";
import { useLiveApp, useLiveAppDocs } from "@/hooks/useLiveApp";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { BirthDateField, BirthTimeField } from "@/onboarding/components/BirthDateTimeField";
import { CTA } from "@/onboarding/components/CTA";
import { WebLayoutProvider } from "@/components/web/web-layout-provider";
import { Screen } from "@/onboarding/components/Screen";
import { Body, Label, Title } from "@/onboarding/components/Type";
import { font, GUTTER, orbita } from "@/onboarding/theme";
import { BirthPayloadError, birthPayloadMessage } from "@/domain/birthPayload";
import { useProfileBirthDataPersist } from "@/onboarding/useAccount";
import { backendConfig } from "@/services/backendProviders";
import { searchPlaces, type PlaceHit } from "@/services/geocoding";

/**
 * Perfil → EDITAR DATOS (hotfix build 11): editor independiente y
 * precompletado. Antes esto era `router.push("/onboarding")` — reiniciaba el
 * alta completa y en build 10 quedaba clavado en el splash. Acá: cancelar
 * vuelve a Perfil sin tocar nada; guardar actualiza el perfil local y, con
 * sesión live, persiste al backend (recalcula carta y lectura) preservando
 * las coordenadas remotas si el lugar no cambió. Nunca pasa por el splash,
 * el onboarding ni pide cuenta.
 *
 * De dónde salen los valores iniciales: `resolveBirthEditorSeed`. Con sesión,
 * SOLO del documento remoto — nunca del perfil local, ni de una fecha fija, ni
 * de la zona del aparato, ni de un mediodía inventado. Hasta que el remoto
 * resuelve no hay formulario: hay carga o reintento, y cero escrituras.
 */
// Tope de la espera del birthData remoto antes de ofrecer reintento.
const SYNC_REMOTE_TIMEOUT_MS = 10000;

export default function EditarDatosRoute() {
  // Misma razón que en `/iniciar-sesion`: esta ruta monta el shell del alta
  // fuera de `OnboardingFlow` y necesita el modo responsive.
  //
  // El gate declara `edit-birth-data`: es el destino de recuperación de una
  // cuenta que ya existía y quedó incompleta, y también la ruta normal de
  // "Editar datos" desde Perfil con la cuenta completa. Las dos entran; una
  // cuenta sin sesión no.
  //
  // Sin envs no hay cuenta que resolver (builds locales): el editor guarda sólo
  // en el teléfono y no pasa por el gate.
  return (
    <WebLayoutProvider>
      {backendConfig.isConfigured ? (
        <AccountGate surface="edit-birth-data" loading={<WebLoading />}>
          <EditarDatosSurface />
        </AccountGate>
      ) : (
        <EditarDatosSurface />
      )}
    </WebLayoutProvider>
  );
}

function EditarDatosSurface() {
  const router = useRouter();
  const fontsLoaded = useOrbitaFonts();
  const { isReady, profile, createProfile, updateProfile } = useAppState();
  const { isLive, isAuthLoading, auth, retryUser } = useLiveApp();
  const { birthData: remoteBirthData, birthDataResolved } = useLiveAppDocs(isLive);
  // Editar datos usa el endpoint de PERFIL: `completeBirthData` es create-only
  // y rechazaría un cambio con ONBOARDING_BIRTH_DATA_CONFLICT.
  const persistBackend = useProfileBirthDataPersist();
  const signedIn = !!auth?.isSignedIn;

  // La semilla se congela una vez, cuando el origen autoritativo resuelve. El
  // borrador se compara SIEMPRE contra ella: es el dato real de la persona.
  const [seed, setSeed] = useState<BirthEditorSeed | null>(null);
  const [draft, setDraft] = useState<BirthEditorDraft | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeHits, setPlaceHits] = useState<PlaceHit[]>([]);
  const [saving, setSaving] = useState(false);
  // Mensaje concreto en vez de un booleano: un documento legado incompleto
  // tiene que decir "elegí el lugar de nuevo", no "revisá tu conexión".
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncTimedOut, setSyncTimedOut] = useState(false);
  const [syncTick, setSyncTick] = useState(0);
  // El candado REAL del guardado. `saving` sirve para pintar el botón, pero se
  // aplica recién en el render siguiente: dos toques del mismo render lo leen
  // los dos en `false` y los dos entran. Ver `@/domain/exclusive`.
  const guardando = useRef(createExclusiveGate()).current;

  // Con sesión, Guardar espera a que resuelva el birthData remoto: si el lugar
  // no cambió y el doc no llegó, se mandaría timezone undefined y el backend
  // recalcularía la carta con la timezone del teléfono (mal para nacidos en
  // otra zona). El invitado no espera nada. La espera NUNCA es infinita:
  // pasado el timeout se muestra error con reintento (Convex caído, etc.).
  // La identidad todavía sin confirmar espera igual que un remoto sin resolver:
  // no se puede afirmar todavía si esta persona tiene cuenta o es invitada, así
  // que tampoco de dónde salen sus datos.
  const gate = isAuthLoading
    ? "wait-remote"
    : birthSaveGate({ signedIn, remoteResolved: birthDataResolved });
  const syncState = birthSyncUx(gate, syncTimedOut);

  // La espera del birthData remoto tiene tope: si Convex no conecta o la
  // query sigue undefined, pasa a "retry" (nunca "Sincronizando…" eterno).
  useEffect(() => {
    if (gate !== "wait-remote") {
      setSyncTimedOut(false);
      return;
    }
    const t = setTimeout(() => setSyncTimedOut(true), SYNC_REMOTE_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, syncTick]);

  const retrySync = () => {
    // Re-dispara ensureUser (si la sesión quedó en error) y re-arma la espera.
    retryUser();
    setSyncTimedOut(false);
    setSyncTick((t) => t + 1);
  };

  // Origen autoritativo de los valores iniciales. Se recalcula en cada render
  // (es puro) pero se SIEMBRA una sola vez: una vez abierto el formulario, un
  // cambio remoto no puede pisar lo que la persona está tipeando.
  const seedState = useMemo(
    () =>
      resolveBirthEditorSeed({
        authLoading: isAuthLoading,
        signedIn,
        remoteResolved: birthDataResolved,
        remote: remoteBirthData,
        // El perfil local es semilla SOLO de invitado; con sesión se ignora.
        profile: profile ? { birthDate: profile.birthDate, birthTime: profile.birthTime, birthPlace: profile.birthPlace } : null
      }),
    [isAuthLoading, signedIn, birthDataResolved, remoteBirthData, profile]
  );

  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || seedState.status !== "ready") return;
    seeded.current = true;
    setSeed(seedState.seed);
    setDraft(draftFromSeed(seedState.seed));
  }, [seedState]);

  // Búsqueda de lugar (Photon, igual que el onboarding) con debounce.
  useEffect(() => {
    const query = placeQuery.trim();
    if (query.length < 3) {
      setPlaceHits([]);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(() => {
      searchPlaces(query, controller.signal)
        .then((hits) => setPlaceHits(hits.slice(0, 5)))
        .catch(() => {});
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [placeQuery]);

  const readiness = birthEditorReadiness({ sync: syncState, seed, draft });
  const blockMessage = birthEditorBlockMessage(readiness);

  if (!fontsLoaded) return <View style={styles.fill} />;
  // Sin sesión, sin perfil local no hay nada que editar. CON sesión sí lo hay:
  // una cuenta que quedó incompleta llega acá justamente para completarse, y en
  // un navegador nuevo todavía no tiene perfil local. Rebotarla a "/" era un
  // bucle — el gate la devolvía acá en el render siguiente.
  if (isReady && !profile && !signedIn) return <Redirect href="/" />;
  if (!isReady) return <View style={styles.fill} />;

  const patchDraft = (patch: Partial<BirthEditorDraft>) =>
    setDraft((current) => (current ? { ...current, ...patch } : current));

  const save = async () => {
    if (!draft || saving || !canSaveBirthEditor(readiness)) return;
    // Último borde: si al borrador le falta algo, no se completa nada por él.
    const edits = draftToEdits(draft);
    if (!edits) return;
    // El candado se toma ACÁ, antes del primer `await`: es lo único que ven
    // igual los dos toques de un mismo render, y se libera en el `finally` de
    // `runExclusive` aunque el guardado falle.
    await runExclusive(guardando, async () => {
      setSaving(true);
      setSaveError(null);
      try {
        if (signedIn && persistBackend) {
          // Con sesión: esperar la confirmación del backend (recalcula carta y
          // lectura) ANTES de aplicar nada. Si falla, no se guarda ni local:
          // queda el error con reintento y los datos siguen consistentes.
          await persistBackend(buildBackendBirthPayload(edits, remoteBirthData));
        }
        if (profile) {
          // Invitado o cuenta con perfil local: se actualiza lo que ya existe.
          await updateProfile(applyBirthEdits(profile, edits));
        } else {
          // Cuenta incompleta en un dispositivo/navegador sin perfil local: el
          // remoto ya quedó escrito y acá se crea la copia local marcada con su
          // dueño, en vez de dejar la cuenta sin nada que mostrar.
          await createProfile(
            onboardingInputFromBirthData({
              birthDate: edits.birthDate,
              birthTime: edits.birthTime ?? undefined,
              birthPlaceLabel: edits.place.label
            }),
            auth?.userId ?? null
          );
        }
        // Sin perfil local previo se llegó acá por una recuperación, no desde
        // Perfil: no hay pantalla atrás a la cual volver.
        if (profile) router.back();
        else router.replace(HOME_ROUTE as never);
      } catch (e) {
        setSaveError(
          e instanceof BirthPayloadError
            ? birthPayloadMessage(e.problem)
            : "No pudimos guardar en tu cuenta. No cambiamos nada; revisá tu conexión y volvé a intentar."
        );
      } finally {
        setSaving(false);
      }
    });
  };

  return (
    <Screen wash={0.62}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Cancelar y volver al Perfil"
        >
          <Text style={TEXT.chev}>‹</Text>
        </Pressable>
      </View>

      {/* Header fijo; el formulario scrollea (en pantallas chicas "Lugar",
          los resultados y Guardar/Cancelar quedaban fuera de pantalla) y
          esquiva el teclado en iOS. keyboardShouldPersistTaps: se puede
          elegir una ciudad de la lista con el teclado abierto. */}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <Title>Tus datos{"\n"}de nacimiento.</Title>
        <Body style={styles.sub}>Afinan toda la lectura. Guardá solo si cambiaste algo.</Body>

        {/* Sin semilla no hay formulario: mostrar campos antes de que resuelva
            el origen autoritativo obliga a rellenarlos con algo, y ese algo
            sería inventado. Carga o reintento, y cero escrituras. */}
        {draft === null ? (
          <View style={styles.loadingBlock}>
            {readiness === "retry-remote" ? (
              <Body accessibilityRole="alert" accessibilityLiveRegion="polite" style={TEXT.saveError}>
                {blockMessage}
              </Body>
            ) : (
              <Body accessibilityLiveRegion="polite">Cargando tus datos de nacimiento…</Body>
            )}
          </View>
        ) : (
          <>
            {/* Una interfaz, dos implementaciones: rueda nativa y controles del
                navegador (`<input type="date">` / `type="time"`) en web. Las
                dos escriben los MISMOS strings del dominio. */}
            <BirthDateField
              value={draft.birthDate}
              onChange={(next) => patchDraft({ birthDate: next })}
            />

            <View style={styles.timeRow}>
              <Label>Hora</Label>
              <Pressable
                // Sólo cambia el interruptor. Al apagarlo NO se propone un
                // mediodía: si no había hora, el campo queda vacío y Guardar
                // sigue bloqueado hasta que la persona elija una.
                onPress={() => patchDraft({ timeUnknown: !draft.timeUnknown })}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="No sé la hora"
              >
                <View style={[styles.toggle, draft.timeUnknown && styles.toggleOn]}>
                  <Text style={[TEXT.toggle, draft.timeUnknown && TEXT.toggleOn]}>
                    {draft.timeUnknown ? "✓ No sé la hora" : "No sé la hora"}
                  </Text>
                </View>
              </Pressable>
            </View>
            <BirthTimeField
              value={draft.birthTime}
              onChange={(next) => patchDraft({ birthTime: next })}
              disabled={draft.timeUnknown}
            />
            {draft.timeUnknown ? (
              <Body style={styles.noTimeNote}>Usamos una carta aproximada, sin Ascendente exacto.</Body>
            ) : null}

            <Label style={styles.fieldLabel}>Lugar</Label>
            <Body style={styles.placeCurrent}>
              {draft.place.label || "Todavía no elegiste tu lugar de nacimiento."}
            </Body>
            <TextInput
              value={placeQuery}
              onChangeText={setPlaceQuery}
              placeholder="Buscar otra ciudad…"
              placeholderTextColor={orbita.faint}
              // El placeholder desaparece al tipear: la etiqueta es aparte.
              accessibilityLabel="Buscar tu lugar de nacimiento"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <View style={styles.inputLine} />
            {placeHits.map((hit) => (
              <Pressable
                key={hit.label}
                onPress={() => {
                  // Sólo una elección real del autocompletado cambia el lugar:
                  // trae etiqueta, coordenadas y zona juntas.
                  patchDraft({
                    place: {
                      label: hit.label,
                      latitude: hit.latitude,
                      longitude: hit.longitude,
                      timezone: hit.timezone,
                      changed: true
                    }
                  });
                  setPlaceQuery("");
                  setPlaceHits([]);
                }}
                style={styles.hit}
                accessibilityRole="button"
              >
                <Text style={TEXT.hit}>{hit.label}</Text>
              </Pressable>
            ))}

            <View style={styles.spacer} />
          </>
        )}

        {/* `alert` + región viva: un lector de pantalla anuncia el fallo sin que
            la persona tenga que ir a buscarlo. Los valores tipeados quedan tal
            cual y no se navega: el error es recuperable en el mismo lugar. */}
        {saveError !== null ? (
          <Body
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={TEXT.saveError}
          >
            {saveError}
          </Body>
        ) : null}
        {/* Qué falta para poder guardar, dicho en el mismo lugar donde se
            resuelve. Sin esto, un Guardar deshabilitado no se explica. */}
        {draft !== null && blockMessage !== null ? (
          <Body accessibilityLiveRegion="polite" style={TEXT.blockNote}>
            {blockMessage}
          </Body>
        ) : null}
        <CTA
          label={
            saving
              ? "Guardando…"
              : readiness === "loading-remote"
                ? "Sincronizando tus datos…"
                : readiness === "retry-remote"
                  ? "Reintentar sincronización"
                  : saveError !== null
                    ? "Reintentar"
                    : "Guardar cambios"
          }
          onPress={readiness === "retry-remote" ? retrySync : save}
          disabled={saving || (readiness !== "retry-remote" && !canSaveBirthEditor(readiness))}
        />
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.cancelRow}
          accessibilityRole="button"
        >
          <Text style={TEXT.cancel}>Cancelar</Text>
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/**
 * Estilos de TEXTO en objetos LITERALES, no en `StyleSheet.create`.
 *
 * Es el mismo mecanismo ya documentado en `@/onboarding/theme` para
 * `SIGN_IN_LINK_TEXT`: en react-native-web una hoja registrada se compila a una
 * CLASE atómica, y el `Text` compartido (`components/ui/text`) ya trae las
 * clases `text-foreground` y `text-base` de Tailwind, que fijan color, tamaño y
 * altura de línea. Clase contra clase ganaba Tailwind, así que los resultados
 * de ciudades, "No sé la hora" y "Cancelar" salían casi negros —y a 16px—
 * sobre el fondo casi negro de la pantalla. Un literal viaja en el atributo
 * `style` y le gana a cualquier clase.
 *
 * `saveError` tenía la misma falla por otro camino: `Body` aplica su propio
 * color como literal (inline) y recibía el color del error como clase, así que
 * el mensaje se pintaba del gris de cuerpo en vez del cobre de alerta. Dos
 * literales sí compiten entre sí, y gana el último del array.
 *
 * Los colores son EXACTAMENTE los que ya tenía la pantalla: esto arregla la
 * precedencia, no rediseña nada.
 */
const TEXT = {
  cancel: { color: orbita.faint, fontFamily: font.sans, fontSize: 14, lineHeight: 20 },
  chev: { color: orbita.bone, fontFamily: font.sans, fontSize: 26, lineHeight: 30 },
  hit: { color: orbita.bone, fontFamily: font.sans, fontSize: 15, lineHeight: 21 },
  toggle: { color: orbita.bone, fontFamily: font.sansMed, fontSize: 13, lineHeight: 18 },
  toggleOn: { color: orbita.ink },
  saveError: { color: "#D07A5A", marginBottom: 12 },
  blockNote: { color: orbita.muted, marginBottom: 12 }
} satisfies Record<string, TextStyle>;

const styles = StyleSheet.create({
  // 44px reales: `hitSlop` no existe en web, así que el objetivo de "cancelar"
  // eran los 28×30 del chevron.
  backBtn: { alignItems: "flex-start", justifyContent: "center", minHeight: 44, minWidth: 44 },
  body: { flexGrow: 1, paddingBottom: 48, paddingHorizontal: GUTTER, paddingTop: 18 },
  cancelRow: { alignItems: "center", marginTop: 16, paddingBottom: 10 },
  fieldLabel: { marginTop: 26 },
  fill: { backgroundColor: orbita.bg, flex: 1 },
  header: { paddingHorizontal: GUTTER, paddingTop: 6 },
  hit: { borderBottomColor: orbita.line, borderBottomWidth: 1, paddingVertical: 12 },
  input: {
    color: orbita.bone,
    fontFamily: font.serifReg,
    fontSize: 18,
    marginTop: 8,
    paddingVertical: 6
  },
  inputLine: { backgroundColor: orbita.lineStrong, height: 1, marginTop: 4 },
  loadingBlock: { paddingVertical: 40 },
  noTimeNote: { marginTop: 8 },
  placeCurrent: { marginTop: 6 },
  spacer: { height: 24 },
  sub: { marginTop: 10 },
  timeRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 26
  },
  toggle: {
    borderColor: orbita.lineStrong,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7
  },
  toggleOn: { backgroundColor: orbita.copper, borderColor: orbita.copper }
});
