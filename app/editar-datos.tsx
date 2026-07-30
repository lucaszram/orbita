import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from "react-native";
import { Redirect, useRouter } from "expo-router";

import { Text } from "@/components/ui/text";
import {
  applyBirthEdits,
  birthSaveGate,
  birthSyncUx,
  buildBackendBirthPayload,
  dateToIso,
  dateToTime,
  hasBirthChanges,
  isoToDate,
  timeToDate,
  type BirthEdits
} from "@/domain/birthEdits";
import { useAppState } from "@/hooks/useAppState";
import { useLiveApp, useLiveAppDocs } from "@/hooks/useLiveApp";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { BirthDateField, BirthTimeField } from "@/onboarding/components/BirthDateTimeField";
import { CTA } from "@/onboarding/components/CTA";
import { Screen } from "@/onboarding/components/Screen";
import { Body, Label, Title } from "@/onboarding/components/Type";
import { font, GUTTER, orbita } from "@/onboarding/theme";
import { BirthPayloadError, birthPayloadMessage } from "@/domain/birthPayload";
import { useProfileBirthDataPersist } from "@/onboarding/useAccount";
import { searchPlaces, type PlaceHit } from "@/services/geocoding";

/**
 * Perfil → EDITAR DATOS (hotfix build 11): editor independiente y
 * precompletado. Antes esto era `router.push("/onboarding")` — reiniciaba el
 * alta completa y en build 10 quedaba clavado en el splash. Acá: cancelar
 * vuelve a Perfil sin tocar nada; guardar actualiza el perfil local y, con
 * sesión live, persiste al backend (recalcula carta y lectura) preservando
 * las coordenadas remotas si el lugar no cambió. Nunca pasa por el splash,
 * el onboarding ni pide cuenta.
 */
// Tope de la espera del birthData remoto antes de ofrecer reintento.
const SYNC_REMOTE_TIMEOUT_MS = 10000;

export default function EditarDatosRoute() {
  const router = useRouter();
  const fontsLoaded = useOrbitaFonts();
  const { isReady, profile, updateProfile } = useAppState();
  const { isLive, auth, retryUser } = useLiveApp();
  const { birthData: remoteBirthData, birthDataResolved } = useLiveAppDocs(isLive);
  // Editar datos usa el endpoint de PERFIL: `completeBirthData` es create-only
  // y rechazaría un cambio con ONBOARDING_BIRTH_DATA_CONFLICT.
  const persistBackend = useProfileBirthDataPersist();

  const [date, setDate] = useState<Date>(() => isoToDate(profile?.birthDate ?? "1996-01-15"));
  const [time, setTime] = useState<Date>(() => timeToDate(profile?.birthTime));
  const [timeUnknown, setTimeUnknown] = useState(() => !profile?.birthTime);
  const [pickedPlace, setPickedPlace] = useState<PlaceHit | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeHits, setPlaceHits] = useState<PlaceHit[]>([]);
  const [saving, setSaving] = useState(false);
  // Mensaje concreto en vez de un booleano: un documento legado incompleto
  // tiene que decir "elegí el lugar de nuevo", no "revisá tu conexión".
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncTimedOut, setSyncTimedOut] = useState(false);
  const [syncTick, setSyncTick] = useState(0);

  // Con sesión, Guardar espera a que resuelva el birthData remoto: si el lugar
  // no cambió y el doc no llegó, se mandaría timezone undefined y el backend
  // recalcularía la carta con la timezone del teléfono (mal para nacidos en
  // otra zona). El invitado no espera nada. La espera NUNCA es infinita:
  // pasado el timeout se muestra error con reintento (Convex caído, etc.).
  const gate = birthSaveGate({
    signedIn: !!auth?.isSignedIn,
    remoteResolved: birthDataResolved
  });
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

  // Si la ruta se montó antes de hidratar el perfil (deep link), precargar
  // los campos cuando aparece: nunca dejar defaults que pisen datos reales.
  const initializedFor = useRef<string | null>(profile?.id ?? null);
  useEffect(() => {
    if (!profile || initializedFor.current === profile.id) return;
    initializedFor.current = profile.id;
    setDate(isoToDate(profile.birthDate));
    setTime(timeToDate(profile.birthTime));
    setTimeUnknown(!profile.birthTime);
    setPickedPlace(null);
  }, [profile]);

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

  const edits: BirthEdits = useMemo(
    () => ({
      birthDate: dateToIso(date),
      birthTime: timeUnknown ? null : dateToTime(time),
      place: pickedPlace
        ? {
            label: pickedPlace.label,
            latitude: pickedPlace.latitude,
            longitude: pickedPlace.longitude,
            timezone: pickedPlace.timezone,
            changed: true
          }
        : { label: profile?.birthPlace ?? "", changed: false }
    }),
    [date, time, timeUnknown, pickedPlace, profile?.birthPlace]
  );

  if (!fontsLoaded) return <View style={styles.fill} />;
  if (isReady && !profile) return <Redirect href="/" />;
  if (!profile) return <View style={styles.fill} />;

  const dirty = hasBirthChanges(profile, edits);

  const save = async () => {
    if (!dirty || saving || syncState !== "ready") return;
    setSaving(true);
    setSaveError(null);
    try {
      if (auth?.isSignedIn && persistBackend) {
        // Con sesión: esperar la confirmación del backend (recalcula carta y
        // lectura) ANTES de aplicar nada. Si falla, no se guarda ni local:
        // queda el error con reintento y los datos siguen consistentes.
        await persistBackend(buildBackendBirthPayload(edits, remoteBirthData));
      }
      // Invitado: guardado local solamente.
      await updateProfile(applyBirthEdits(profile, edits));
      router.back();
    } catch (e) {
      setSaveError(
        e instanceof BirthPayloadError
          ? birthPayloadMessage(e.problem)
          : "No pudimos guardar en tu cuenta. No cambiamos nada; revisá tu conexión y volvé a intentar."
      );
    } finally {
      setSaving(false);
    }
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
          <Text style={styles.chev}>‹</Text>
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

        {/* Una interfaz, dos implementaciones: rueda nativa y control del
            navegador en web. Las dos escriben el MISMO `date`. */}
        <BirthDateField value={date} onChange={setDate} />

        <View style={styles.timeRow}>
          <Label>Hora</Label>
          <Pressable
            onPress={() => setTimeUnknown((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="No sé la hora"
          >
            <View style={[styles.toggle, timeUnknown && styles.toggleOn]}>
              <Text style={[styles.toggleText, timeUnknown && styles.toggleTextOn]}>
                {timeUnknown ? "✓ No sé la hora" : "No sé la hora"}
              </Text>
            </View>
          </Pressable>
        </View>
        <BirthTimeField value={time} onChange={setTime} disabled={timeUnknown} />
        {timeUnknown ? (
          <Body style={styles.noTimeNote}>Usamos una carta aproximada, sin Ascendente exacto.</Body>
        ) : null}

        <Label style={styles.fieldLabel}>Lugar</Label>
        <Body style={styles.placeCurrent}>{edits.place.label || "Sin especificar"}</Body>
        <TextInput
          value={placeQuery}
          onChangeText={setPlaceQuery}
          placeholder="Buscar otra ciudad…"
          placeholderTextColor={orbita.faint}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <View style={styles.inputLine} />
        {placeHits.map((hit) => (
          <Pressable
            key={hit.label}
            onPress={() => {
              setPickedPlace(hit);
              setPlaceQuery("");
              setPlaceHits([]);
            }}
            style={styles.hit}
            accessibilityRole="button"
          >
            <Text style={styles.hitText}>{hit.label}</Text>
          </Pressable>
        ))}

        <View style={styles.spacer} />

        {/* `alert` + región viva: un lector de pantalla anuncia el fallo sin que
            la persona tenga que ir a buscarlo. Los valores tipeados quedan tal
            cual y no se navega: el error es recuperable en el mismo lugar. */}
        {saveError !== null ? (
          <Body
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={styles.saveError}
          >
            {saveError}
          </Body>
        ) : null}
        {syncState === "retry" ? (
          <Body accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.saveError}>
            No pudimos sincronizar los datos de tu cuenta. No cambiamos nada; podés reintentar o
            cancelar.
          </Body>
        ) : null}
        <CTA
          label={
            saving
              ? "Guardando…"
              : syncState === "waiting"
                ? "Sincronizando tus datos…"
                : syncState === "retry"
                  ? "Reintentar sincronización"
                  : saveError !== null
                    ? "Reintentar"
                    : "Guardar cambios"
          }
          onPress={syncState === "retry" ? retrySync : save}
          disabled={saving || syncState === "waiting" || (syncState === "ready" && !dirty)}
        />
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.cancelRow}
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backBtn: { alignItems: "flex-start", height: 30, justifyContent: "center", width: 28 },
  body: { flexGrow: 1, paddingBottom: 48, paddingHorizontal: GUTTER, paddingTop: 18 },
  cancelRow: { alignItems: "center", marginTop: 16, paddingBottom: 10 },
  cancelText: { color: orbita.faint, fontFamily: font.sans, fontSize: 14 },
  chev: { color: orbita.bone, fontFamily: font.sans, fontSize: 26, lineHeight: 30 },
  fieldLabel: { marginTop: 26 },
  fill: { backgroundColor: orbita.bg, flex: 1 },
  header: { paddingHorizontal: GUTTER, paddingTop: 6 },
  hit: { borderBottomColor: orbita.line, borderBottomWidth: 1, paddingVertical: 12 },
  hitText: { color: orbita.bone, fontFamily: font.sans, fontSize: 15 },
  input: {
    color: orbita.bone,
    fontFamily: font.serifReg,
    fontSize: 18,
    marginTop: 8,
    paddingVertical: 6
  },
  inputLine: { backgroundColor: orbita.lineStrong, height: 1, marginTop: 4 },
  noTimeNote: { marginTop: 8 },
  picker: { alignSelf: "center" },
  placeCurrent: { marginTop: 6 },
  saveError: { color: "#D07A5A", marginBottom: 12 },
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
  toggleOn: { backgroundColor: orbita.copper, borderColor: orbita.copper },
  toggleText: { color: orbita.bone, fontFamily: font.sansMed, fontSize: 13 },
  toggleTextOn: { color: orbita.ink }
});
