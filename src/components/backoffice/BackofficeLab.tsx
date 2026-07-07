import { useAction, useConvexAuth, useMutation, useQuery_experimental as useQuery } from "convex/react";
import { ComponentProps, ComponentType, ReactNode, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { backendConfig } from "@/services/backendProviders";
import {
  backofficeApi,
  BirthTimePrecision,
  LabRun,
  LabRunDetail,
  LabRunPayload,
  LabReviewStatus,
  LabSubject,
  LabSubjectInput
} from "@/services/backofficeRefs";

const staleCodeAccessStorageKey = "orbita:backoffice-lab-access";

type QueryState<T> =
  | { status: "pending" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

type SubjectForm = {
  displayName: string;
  birthDate: string;
  birthTime: string;
  birthTimePrecision: BirthTimePrecision;
  birthPlaceLabel: string;
  latitude: string;
  longitude: string;
  timezone: string;
  notes: string;
};

const defaultSubjectForm: SubjectForm = {
  displayName: "Mica prueba",
  birthDate: "1996-01-15",
  birthTime: "08:30",
  birthTimePrecision: "known",
  birthPlaceLabel: "Buenos Aires, Argentina",
  latitude: "-34.6037",
  longitude: "-58.3816",
  timezone: "America/Argentina/Buenos_Aires",
  notes: "Caso base para probar Sol, hora conocida y coordenadas."
};

function todayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function subjectToForm(subject: LabSubject): SubjectForm {
  return {
    displayName: subject.displayName,
    birthDate: subject.birthDate,
    birthTime: subject.birthTime ?? "",
    birthTimePrecision: subject.birthTimePrecision,
    birthPlaceLabel: subject.birthPlaceLabel,
    latitude: subject.latitude === undefined ? "" : String(subject.latitude),
    longitude: subject.longitude === undefined ? "" : String(subject.longitude),
    timezone: subject.timezone,
    notes: subject.notes ?? ""
  };
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function getQueryData<T>(state: QueryState<T>, fallback: T) {
  return state.status === "success" ? state.data : fallback;
}

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown, fallback = "Sin dato") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readDisplayValue(value: unknown, fallback = "Sin dato") {
  if (Array.isArray(value)) {
    const lines = value
      .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      .map((item) => item.trim());
    return lines.length > 0 ? lines.join("\n") : fallback;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return readString(value, fallback);
}

function stringList(value: unknown, fallback?: unknown, minLength = 3) {
  const list = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? [value]
      : typeof fallback === "string"
        ? [fallback]
        : Array.isArray(fallback)
          ? fallback.filter((item): item is string => typeof item === "string")
          : [];

  while (list.length < minLength) {
    list.push("");
  }

  return list.slice(0, minLength);
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
}

function friendlyBackofficeError(message: string) {
  if (message.includes("e.db.insert is not a function")) {
    return {
      detail:
        "Tu sesión Google/Clerk está bien. Convex Cloud todavía está corriendo una versión vieja del backoffice; falta sincronizar las funciones con `pnpm exec convex dev --once --typecheck disable`.",
      title: "Convex necesita sincronizarse"
    };
  }

  if (message.includes("Authentication required")) {
    return {
      detail:
        "Clerk ya tiene una sesión, pero Convex todavía no recibe un JWT válido. Revisá que el JWT template de Clerk se llame `convex` y tenga audience/application id `convex`.",
      title: "Convex no recibió tu sesión"
    };
  }

  if (message.includes("not allowed")) {
    return {
      detail: "La sesión está autenticada, pero el email no está incluido en `ORBITA_BACKOFFICE_ALLOWED_EMAILS`.",
      title: "Email no habilitado"
    };
  }

  if (message.includes("allowlist is not configured")) {
    return {
      detail: "Falta configurar `ORBITA_BACKOFFICE_ALLOWED_EMAILS` en el deployment de Convex.",
      title: "Allowlist no configurada"
    };
  }

  return {
    detail: message,
    title: "Acceso bloqueado"
  };
}

function clearStoredLabAccess() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(staleCodeAccessStorageKey);
}

function SetupPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.setupWrap}>
      <View style={styles.setupPanel}>
        <Text style={styles.kicker}>Órbita Backoffice</Text>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.copyBlock}>{children}</View>
      </View>
    </ScrollView>
  );
}

export function BackofficeRoute() {
  if (!backendConfig.isConfigured) {
    return (
      <SetupPanel title="Falta conectar Convex y Clerk">
        <Text selectable style={styles.body}>
          Configurá `EXPO_PUBLIC_CONVEX_URL` y `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` para montar el laboratorio.
        </Text>
        <Text selectable style={styles.body}>
          En Convex también falta `ORBITA_BACKOFFICE_ALLOWED_EMAILS` con los emails habilitados.
        </Text>
      </SetupPanel>
    );
  }

  return <BackofficeAuthGate />;
}

function BackofficeAuthGate() {
  const { useAuth, useUser } = require("@clerk/expo") as typeof import("@clerk/expo");
  const auth = useAuth();
  const { user } = useUser();
  const convexAuth = useConvexAuth();
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress;

  useEffect(() => {
    clearStoredLabAccess();
  }, []);

  if (!auth.isLoaded) {
    return (
      <SetupPanel title="Cargando sesión">
        <ActivityIndicator color="#D8B46A" />
      </SetupPanel>
    );
  }

  if (!auth.isSignedIn) {
    return <ClerkWebSignInPanel />;
  }

  if (convexAuth.isLoading) {
    return (
      <SetupPanel title="Conectando Convex">
        <ActivityIndicator color="#D8B46A" />
        <Text selectable style={styles.body}>
          Ya estás en Clerk como `{userEmail ?? "tu cuenta"}`. Estoy esperando el token de Convex para habilitar el lab.
        </Text>
      </SetupPanel>
    );
  }

  if (!convexAuth.isAuthenticated) {
    return (
      <SetupPanel title="Falta conectar Clerk con Convex">
        <Text selectable style={styles.body}>
          Clerk inició sesión con `{userEmail ?? "tu cuenta"}`, pero Convex no recibió identidad. Configurá el JWT template
          `convex` en Clerk con application id `convex`.
        </Text>
        <View style={styles.setupActions}>
          <Pressable accessibilityRole="button" onPress={() => void auth.signOut()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Cambiar cuenta</Text>
          </Pressable>
        </View>
      </SetupPanel>
    );
  }

  return <BackofficeLab onSignOut={() => void auth.signOut()} userEmail={userEmail} />;
}

function ClerkWebSignInPanel() {
  if (process.env.EXPO_OS !== "web") {
    return (
      <SetupPanel title="Necesitás iniciar sesión">
        <Text selectable style={styles.body}>
          El backoffice exige una sesión Clerk allowlisted. Abrilo desde Expo Web e iniciá sesión con
          `lucaszramos11@gmail.com`.
        </Text>
      </SetupPanel>
    );
  }

  const { SignIn } = require("@clerk/expo/web") as {
    SignIn: ComponentType<Record<string, unknown>>;
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.setupWrap}>
      <View style={styles.setupPanel}>
        <Text style={styles.kicker}>Órbita Backoffice</Text>
        <Text style={styles.title}>Iniciar sesión</Text>
        <Text selectable style={styles.body}>
          Entrá con `lucaszramos11@gmail.com`. El acceso se valida con Clerk y la allowlist de Convex.
        </Text>
        <View style={styles.clerkPanel}>
          <SignIn
            fallbackRedirectUrl="/backoffice"
            forceRedirectUrl="/backoffice"
            routing="hash"
            signUpFallbackRedirectUrl="/backoffice"
            signUpForceRedirectUrl="/backoffice"
          />
        </View>
      </View>
    </ScrollView>
  );
}

function BackofficeLab({ onSignOut, userEmail }: { onSignOut: () => void; userEmail?: string }) {
  const { width } = useWindowDimensions();
  const isWide = width >= 1020;
  const [form, setForm] = useState<SubjectForm>(defaultSubjectForm);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [runDate, setRunDate] = useState(todayLocalDate());
  const [runTimezone, setRunTimezone] = useState(defaultSubjectForm.timezone);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [placeLookup, setPlaceLookup] = useState<Record<string, unknown> | null>(null);
  const listRunsArgs = useMemo(() => (editingSubjectId ? { subjectId: editingSubjectId } : {}), [editingSubjectId]);

  const subjectsState = useQuery({
    query: backofficeApi.listSubjects,
    args: {},
    throwOnError: false
  }) as QueryState<LabSubject[]>;
  const runsState = useQuery({
    query: backofficeApi.listRuns,
    args: listRunsArgs,
    throwOnError: false
  }) as QueryState<LabRun[]>;

  const subjects = getQueryData(subjectsState, []);
  const runs = getQueryData(runsState, []);
  const activeRunId = selectedRunId ?? runs[0]?._id ?? null;
  const runDetailState = useQuery({
    query: backofficeApi.getRun,
    args: activeRunId ? { runId: activeRunId } : "skip",
    throwOnError: false
  }) as QueryState<LabRunDetail>;

  const upsertSubject = useMutation(backofficeApi.upsertSubject);
  const runModel = useMutation(backofficeApi.runModel);
  const seedSubjects = useMutation(backofficeApi.seedSubjects);
  const previewAstrologyRun = useAction(backofficeApi.previewAstrologyRun);
  const saveLabRun = useMutation(backofficeApi.saveLabRun);
  const reviewRun = useMutation(backofficeApi.reviewRun);
  const resolvePlace = useAction(backofficeApi.resolvePlace);

  const activeSubject = useMemo(
    () => subjects.find((subject) => subject._id === editingSubjectId) ?? null,
    [editingSubjectId, subjects]
  );
  const detail = runDetailState.status === "success" ? runDetailState.data : null;

  useEffect(() => {
    if (!editingSubjectId && subjects.length > 0) {
      const firstSubject = subjects[0];
      setEditingSubjectId(firstSubject._id);
      setForm(subjectToForm(firstSubject));
      setRunTimezone(firstSubject.timezone);
    }
  }, [editingSubjectId, subjects]);

  function updateForm<Key extends keyof SubjectForm>(key: Key, value: SubjectForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function buildSubjectPayload(): LabSubjectInput {
    return {
      subjectId: editingSubjectId ?? undefined,
      displayName: form.displayName,
      birthDate: form.birthDate,
      birthTime: form.birthTimePrecision === "unknown" ? undefined : form.birthTime.trim() || undefined,
      birthTimePrecision: form.birthTimePrecision,
      birthPlaceLabel: form.birthPlaceLabel,
      latitude: parseOptionalNumber(form.latitude),
      longitude: parseOptionalNumber(form.longitude),
      timezone: form.timezone,
      notes: form.notes.trim() || undefined
    };
  }

  async function handleSaveSubject() {
    setMutationError(null);
    setStatusMessage("Guardando persona...");

    try {
      const subjectId = await upsertSubject(buildSubjectPayload());
      setEditingSubjectId(subjectId);
      setRunTimezone(form.timezone);
      setStatusMessage("Persona guardada para laboratorio.");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "No se pudo guardar la persona.");
      setStatusMessage(null);
    }
  }

  async function handleRunModel() {
    if (!editingSubjectId) {
      setMutationError("Guardá o seleccioná una persona antes de correr el modelo.");
      return;
    }

    setMutationError(null);
    setStatusMessage("Corriendo proveedor astrológico...");

    try {
      const payload = (await previewAstrologyRun({
        ...buildSubjectPayload(),
        localDate: runDate,
        runTimezone: runTimezone.trim() || form.timezone
      })) as LabRunPayload;
      const run = await saveLabRun({
        subjectId: editingSubjectId,
        localDate: runDate,
        timezone: runTimezone.trim() || form.timezone,
        normalizedInput: payload.normalizedInput,
        chartPayload: payload.chart,
        dailyReadingPayload: payload.dailyReading,
        modelVersions: payload.modelVersions,
        modelGaps: payload.modelGaps
      });
      setSelectedRunId(run._id);
      setStatusMessage("Ejecución astrológica guardada para revisión.");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "No se pudo correr el modelo.");
      setStatusMessage(null);
    }
  }

  async function handleRunStubModel() {
    if (!editingSubjectId) {
      setMutationError("Guardá o seleccioná una persona antes de correr el modelo.");
      return;
    }

    setMutationError(null);
    setStatusMessage("Corriendo stub local...");

    try {
      const run = await runModel({
        subjectId: editingSubjectId,
        localDate: runDate,
        timezone: runTimezone.trim() || form.timezone
      });
      setSelectedRunId(run._id);
      setStatusMessage("Ejecución stub guardada.");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "No se pudo correr el stub.");
      setStatusMessage(null);
    }
  }

  async function handleSeedSubjects() {
    setMutationError(null);
    setStatusMessage("Creando fixtures P0...");

    try {
      const result = await seedSubjects({});
      setStatusMessage(`Fixtures listos: ${result.created} nuevos de ${result.total}.`);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "No se pudieron crear los fixtures.");
      setStatusMessage(null);
    }
  }

  async function handleResolvePlace() {
    setMutationError(null);
    setStatusMessage("Resolviendo lugar con proveedor...");
    setPlaceLookup(null);

    try {
      const result = (await resolvePlace({ query: form.birthPlaceLabel })) as Record<string, unknown>;
      setPlaceLookup(result);
      const places = Array.isArray(result.places) ? result.places : [];
      const firstPlace = places[0] as Record<string, unknown> | undefined;
      if (firstPlace) {
        updateForm("birthPlaceLabel", typeof firstPlace.label === "string" ? firstPlace.label : form.birthPlaceLabel);
        if (typeof firstPlace.latitude === "number") {
          updateForm("latitude", String(firstPlace.latitude));
        }
        if (typeof firstPlace.longitude === "number") {
          updateForm("longitude", String(firstPlace.longitude));
        }
        if (typeof firstPlace.timezone === "string") {
          updateForm("timezone", firstPlace.timezone);
          setRunTimezone(firstPlace.timezone);
        }
      }
      setStatusMessage(firstPlace ? "Lugar resuelto y aplicado al formulario." : "Lookup ejecutado; revisá la respuesta raw.");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "No se pudo resolver el lugar.");
      setStatusMessage(null);
    }
  }

  async function handleReviewRun(reviewStatus: LabReviewStatus) {
    if (!activeRunId) {
      setMutationError("Seleccioná un run antes de revisar.");
      return;
    }

    setMutationError(null);
    setStatusMessage("Guardando revisión...");

    try {
      await reviewRun({
        runId: activeRunId,
        reviewStatus,
        reviewNote: reviewNote.trim() || undefined
      });
      setStatusMessage("Revisión guardada.");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "No se pudo guardar la revisión.");
      setStatusMessage(null);
    }
  }

  function handleNewSubject() {
    setEditingSubjectId(null);
    setSelectedRunId(null);
    setForm(defaultSubjectForm);
    setRunTimezone(defaultSubjectForm.timezone);
    setStatusMessage("Nueva persona de prueba.");
    setMutationError(null);
    setPlaceLookup(null);
  }

  function handleSelectSubject(subject: LabSubject) {
    setEditingSubjectId(subject._id);
    setSelectedRunId(null);
    setForm(subjectToForm(subject));
    setRunTimezone(subject.timezone);
    setStatusMessage(null);
    setMutationError(null);
    setPlaceLookup(null);
  }

  const blockedError = subjectsState.status === "error" ? subjectsState.error.message : null;
  const blockedCopy = blockedError ? friendlyBackofficeError(blockedError) : null;

  if (blockedCopy) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <BackofficeHeader onSignOut={onSignOut} userEmail={userEmail} />
        <Notice tone="danger" title={blockedCopy.title}>
          {blockedCopy.detail}
        </Notice>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <BackofficeHeader onSignOut={onSignOut} userEmail={userEmail} />
      {mutationError ? (
        <Notice tone="danger" title="No se pudo completar">
          {friendlyBackofficeError(mutationError).detail}
        </Notice>
      ) : null}
      {statusMessage ? (
        <Notice tone="neutral" title="Estado">
          {statusMessage}
        </Notice>
      ) : null}

      <View style={[styles.grid, isWide ? styles.gridWide : styles.gridNarrow]}>
        <View style={styles.columnMain}>
          <Panel title="Persona de prueba" action={<SmallButton label="Nueva" onPress={handleNewSubject} tone="ghost" />}>
            <View style={styles.formGrid}>
              <Field label="Nombre">
                <Input value={form.displayName} onChangeText={(value) => updateForm("displayName", value)} />
              </Field>
              <Field label="Fecha de nacimiento">
                <Input value={form.birthDate} onChangeText={(value) => updateForm("birthDate", value)} placeholder="YYYY-MM-DD" />
              </Field>
              <Field label="Lugar">
                <Input value={form.birthPlaceLabel} onChangeText={(value) => updateForm("birthPlaceLabel", value)} />
                <View style={styles.inlineActions}>
                  <SmallButton label="Resolver API" onPress={handleResolvePlace} tone="ghost" />
                  <Text selectable style={styles.hint}>Usa Location API si está configurada.</Text>
                </View>
              </Field>
              <Field label="Timezone">
                <Input value={form.timezone} onChangeText={(value) => updateForm("timezone", value)} />
              </Field>
              <Field label="Hora">
                <Input
                  editable={form.birthTimePrecision !== "unknown"}
                  value={form.birthTime}
                  onChangeText={(value) => updateForm("birthTime", value)}
                  placeholder="HH:mm"
                />
              </Field>
              <Field label="Precisión">
                <Segmented
                  value={form.birthTimePrecision}
                  options={[
                    ["known", "Conocida"],
                    ["approximate", "Aprox."],
                    ["unknown", "No sé"]
                  ]}
                  onChange={(value) => updateForm("birthTimePrecision", value)}
                />
              </Field>
              <Field label="Latitud">
                <Input value={form.latitude} onChangeText={(value) => updateForm("latitude", value)} />
              </Field>
              <Field label="Longitud">
                <Input value={form.longitude} onChangeText={(value) => updateForm("longitude", value)} />
              </Field>
            </View>
            <Field label="Notas">
              <Input
                multiline
                value={form.notes}
                onChangeText={(value) => updateForm("notes", value)}
                style={styles.textarea}
              />
            </Field>
            <View style={styles.actions}>
              <PrimaryButton label={editingSubjectId ? "Guardar cambios" : "Guardar persona"} onPress={handleSaveSubject} />
            </View>
            {placeLookup ? (
              <View style={styles.inspectorBlock}>
                <Text style={styles.blockTitle}>Último lookup de lugar</Text>
                <JsonBlock value={placeLookup} />
              </View>
            ) : null}
          </Panel>

          <Panel title="Ejecución del modelo">
            <View style={styles.runControls}>
              <Field label="Fecha local">
                <Input value={runDate} onChangeText={setRunDate} placeholder="YYYY-MM-DD" />
              </Field>
              <Field label="Timezone de lectura">
                <Input value={runTimezone} onChangeText={setRunTimezone} />
              </Field>
            </View>
            <View style={styles.actions}>
              <PrimaryButton label="Generar Home Lab" onPress={handleRunModel} disabled={!editingSubjectId} />
              <Pressable
                onPress={editingSubjectId ? handleRunStubModel : undefined}
                style={[styles.secondaryButton, !editingSubjectId && styles.disabledButton]}
              >
                <Text style={styles.secondaryButtonText}>Correr stub</Text>
              </Pressable>
              <Text selectable style={styles.hint}>
                {activeSubject
                  ? `Sujeto activo: ${activeSubject.displayName}`
                  : "Guardá una persona para habilitar la ejecución."}
              </Text>
            </View>
          </Panel>
        </View>

        <View style={styles.columnSide}>
          <Panel title="Personas" action={<SmallButton label="Fixtures P0" onPress={handleSeedSubjects} tone="ghost" />}>
            {subjectsState.status === "pending" ? <LoadingLine label="Cargando personas" /> : null}
            {subjects.length === 0 && subjectsState.status === "success" ? (
              <Text selectable style={styles.emptyText}>Todavía no hay personas de prueba.</Text>
            ) : null}
            <View style={styles.list}>
              {subjects.map((subject) => (
                <Pressable
                  key={subject._id}
                  onPress={() => handleSelectSubject(subject)}
                  style={[styles.listItem, subject._id === editingSubjectId && styles.listItemActive]}
                >
                  <Text selectable style={styles.listTitle}>{subject.displayName}</Text>
                  <Text selectable style={styles.listMeta}>{subject.birthDate} · {subject.birthPlaceLabel}</Text>
                  <Text selectable style={styles.listMeta}>Actualizado {formatTime(subject.updatedAt)}</Text>
                </Pressable>
              ))}
            </View>
          </Panel>

          <Panel title="Runs recientes">
            {runsState.status === "pending" ? <LoadingLine label="Cargando ejecuciones" /> : null}
            {runs.length === 0 && runsState.status === "success" ? (
              <Text selectable style={styles.emptyText}>Sin ejecuciones todavía.</Text>
            ) : null}
            <View style={styles.list}>
              {runs.map((run) => (
                <Pressable
                  key={run._id}
                  onPress={() => setSelectedRunId(run._id)}
                  style={[styles.listItem, run._id === activeRunId && styles.listItemActive]}
                >
                  <Text selectable style={styles.listTitle}>{run.localDate}</Text>
                  <Text selectable style={styles.listMeta}>
                    {run.modelVersions.chart} · {run.modelGaps.length} pendientes
                  </Text>
                  <Text selectable style={styles.listMeta}>{formatTime(run.createdAt)}</Text>
                </Pressable>
              ))}
            </View>
          </Panel>
        </View>
      </View>

      <InspectorPanel
        detail={detail}
        state={runDetailState}
        reviewNote={reviewNote}
        onReviewNoteChange={setReviewNote}
        onReview={handleReviewRun}
      />
    </ScrollView>
  );
}

function BackofficeHeader({ onSignOut, userEmail }: { onSignOut: () => void; userEmail?: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.kicker}>Órbita Backoffice</Text>
        <Text style={styles.title}>Lab de modelo</Text>
        <Text selectable style={styles.subtitle}>
          Personas de prueba, ejecuciones versionadas y gaps visibles antes de llevar el backend a la app.
        </Text>
      </View>
      <View style={styles.headerMeta}>
        <Text selectable style={styles.metaLabel}>Sesión</Text>
        <Text selectable style={styles.metaValue}>{userEmail ?? "Clerk conectado"}</Text>
        <Text selectable style={styles.metaMode}>Clerk + Convex listo</Text>
        <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.sessionButton}>
          <Text style={styles.sessionButtonText}>Cambiar cuenta</Text>
        </Pressable>
      </View>
    </View>
  );
}

function InspectorPanel({
  detail,
  state,
  reviewNote,
  onReviewNoteChange,
  onReview
}: {
  detail: LabRunDetail | null;
  state: QueryState<LabRunDetail>;
  reviewNote: string;
  onReviewNoteChange: (value: string) => void;
  onReview: (status: LabReviewStatus) => void;
}) {
  const run = detail?.run ?? null;
  const modules = run?.dailyReadingPayload?.modules as Record<string, string> | undefined;
  const chartPayload = run?.chartPayload as Record<string, unknown> | undefined;
  const chartNormalized = chartPayload?.normalized as Record<string, unknown> | undefined;
  const chartProvider = chartPayload?.provider as Record<string, unknown> | undefined;
  const readableChart = chartNormalized ?? chartPayload;
  const placements = asRecord(readableChart?.placements);
  const summary = asRecord(readableChart?.summary);
  const sun = asRecord(placements?.sun);
  const moon = asRecord(placements?.moon);
  const ascendant = asRecord(placements?.ascendant);
  const providerStatus = readString(chartProvider?.status, "sin proveedor");
  const providerWarningCount = Array.isArray(chartProvider?.warnings) ? chartProvider.warnings.length : 0;
  const dailySource = readString(run?.dailyReadingPayload?.source, "sin fuente");
  const topics = Array.isArray(run?.dailyReadingPayload?.topics) ? run.dailyReadingPayload.topics : [];

  return (
    <Panel title="Inspector">
      {state.status === "pending" ? <LoadingLine label="Cargando detalle" /> : null}
      {state.status === "error" ? (
        <Notice tone="danger" title="No se pudo abrir el run">
          {state.error.message}
        </Notice>
      ) : null}
      {!run && state.status !== "pending" && state.status !== "error" ? (
        <Text selectable style={styles.emptyText}>Corré un modelo para inspeccionar el resultado.</Text>
      ) : null}
      {run ? (
        <View style={styles.inspectorGrid}>
          <HomeLabEditor run={run} />

          <View style={styles.summaryGrid}>
            <SummaryCard label="Run" value={run.localDate} detail={run.timezone} />
            <SummaryCard label="Proveedor" value={providerStatus} detail={`${providerWarningCount} warnings`} />
            <SummaryCard label="Carta" value={run.modelVersions.chart} detail={readString(chartPayload?.source, "sin fuente")} />
            <SummaryCard label="Lectura" value={run.modelVersions.dailyReading} detail={dailySource} />
            <SummaryCard label="Revisión" value={run.reviewStatus ?? "needs_review"} detail={`${run.modelGaps.length} pendientes`} />
          </View>

          <View style={styles.inspectorBlock}>
            <Text style={styles.blockTitle}>Revisión editorial</Text>
            <View style={styles.reviewSummary}>
              <Text selectable style={styles.reviewStatus}>
                Estado: {run.reviewStatus ?? "needs_review"}
              </Text>
              {run.reviewedAt ? (
                <Text selectable style={styles.listMeta}>Revisado {formatTime(run.reviewedAt)}</Text>
              ) : null}
              {run.reviewNote ? <Text selectable style={styles.moduleValue}>{run.reviewNote}</Text> : null}
            </View>
            <Input
              multiline
              value={reviewNote}
              onChangeText={onReviewNoteChange}
              placeholder="Nota interna de revisión"
              style={styles.textarea}
            />
            <View style={styles.actions}>
              <SmallButton label="A revisar" onPress={() => onReview("needs_review")} tone="ghost" />
              <SmallButton label="Aprobar" onPress={() => onReview("approved")} tone="ghost" />
              <SmallButton label="Rechazar" onPress={() => onReview("rejected")} tone="ghost" />
            </View>
          </View>

          <View style={styles.inspectorBlock}>
            <Text style={styles.blockTitle}>Carta legible</Text>
            <View style={styles.modules}>
              <View style={styles.moduleRow}>
                <Text selectable style={styles.moduleKey}>Sol</Text>
                <Text selectable style={styles.moduleValue}>
                  {readString(sun?.sign)}{sun?.degree !== null && sun?.degree !== undefined ? ` · ${sun.degree}°` : ""}
                </Text>
              </View>
              <View style={styles.moduleRow}>
                <Text selectable style={styles.moduleKey}>Luna</Text>
                <Text selectable style={styles.moduleValue}>
                  {readString(moon?.sign)}{moon?.degree !== null && moon?.degree !== undefined ? ` · ${moon.degree}°` : ""}
                </Text>
              </View>
              <View style={styles.moduleRow}>
                <Text selectable style={styles.moduleKey}>Ascendente</Text>
                <Text selectable style={styles.moduleValue}>
                  {readString(ascendant?.sign)}
                  {ascendant?.degree !== null && ascendant?.degree !== undefined ? ` · ${ascendant.degree}°` : ""}
                </Text>
              </View>
              <View style={styles.moduleRow}>
                <Text selectable style={styles.moduleKey}>Resumen</Text>
                <Text selectable style={styles.moduleValue}>{readString(summary?.title)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.inspectorBlock}>
            <Text style={styles.blockTitle}>Input normalizado</Text>
            <JsonBlock value={run.normalizedInput} maxHeight={220} />
          </View>

          <View style={styles.inspectorBlock}>
            <Text style={styles.blockTitle}>Proveedor</Text>
            {chartProvider ? (
              <View style={styles.modules}>
                {Object.entries(chartProvider).map(([key, value]) => (
                  <View key={key} style={styles.moduleRow}>
                    <Text selectable style={styles.moduleKey}>{providerLabel(key)}</Text>
                    {typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null ? (
                      <Text selectable style={styles.moduleValue}>{String(value)}</Text>
                    ) : (
                      <JsonBlock value={value} maxHeight={150} />
                    )}
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.inspectorBlock}>
            <Text style={styles.blockTitle}>Lectura diaria</Text>
            {modules ? (
              <View style={styles.modules}>
                {Object.entries(modules).map(([key, value]) => (
                  <View key={key} style={styles.moduleRow}>
                    <Text selectable style={styles.moduleKey}>{dailyModuleLabel(key)}</Text>
                    <Text selectable style={styles.moduleValue}>{readDisplayValue(value)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {topics.length > 0 ? (
              <View style={styles.topicGrid}>
                {topics.map((topic, index) => {
                  const topicRecord = asRecord(topic);
                  return (
                    <View key={`${readString(topicRecord?.topic, "topic")}-${index}`} style={styles.topicPill}>
                      <Text selectable style={styles.moduleKey}>{readString(topicRecord?.title, "Tema")}</Text>
                      <Text selectable style={styles.moduleValue}>{readString(topicRecord?.body)}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>

          <View style={styles.inspectorBlock}>
            <Text style={styles.blockTitle}>Pendientes del modelo</Text>
            <View style={styles.gaps}>
              {run.modelGaps.map((gap) => (
                <Text selectable key={gap} style={styles.gapPill}>{gap}</Text>
              ))}
            </View>
            <JsonBlock value={{ modelVersions: run.modelVersions, modelGaps: run.modelGaps }} maxHeight={180} />
          </View>

          <View style={styles.inspectorBlock}>
            <Text style={styles.blockTitle}>Raw carta</Text>
            <JsonBlock value={chartNormalized ?? run.chartPayload} />
          </View>

          <View style={styles.inspectorBlock}>
            <Text style={styles.blockTitle}>Raw lectura diaria</Text>
            <JsonBlock value={run.dailyReadingPayload} />
          </View>
        </View>
      ) : null}
    </Panel>
  );
}

type HomeLabTab = "summary" | "chart" | "home" | "deepDive" | "transits" | "void" | "futureSelf" | "raw";

const homeLabTabs: Array<[HomeLabTab, string]> = [
  ["summary", "Resumen"],
  ["chart", "Chart"],
  ["home", "Home"],
  ["deepDive", "Deep Dive"],
  ["transits", "Transits"],
  ["void", "Void"],
  ["futureSelf", "Future Self"],
  ["raw", "Raw"]
];

function editableString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function cloneRecord(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;
}

function setPayloadPath(source: Record<string, unknown>, path: Array<string | number>, value: string) {
  const draft = cloneRecord(source);
  let cursor: any = draft;

  path.forEach((key, index) => {
    const isLast = index === path.length - 1;
    if (isLast) {
      cursor[key] = value;
      return;
    }

    const nextKey = path[index + 1];
    if (cursor[key] === undefined || cursor[key] === null) {
      cursor[key] = typeof nextKey === "number" ? [] : {};
    }
    cursor = cursor[key];
  });

  return draft;
}

function HomeLabEditor({ run }: { run: LabRun }) {
  const [activeTab, setActiveTab] = useState<HomeLabTab>("summary");
  const [editablePayload, setEditablePayload] = useState<Record<string, unknown>>(
    (run.editorialPayload ?? run.dailyReadingPayload) as Record<string, unknown>
  );
  const [futureSelfNote, setFutureSelfNote] = useState(run.futureSelfNote ?? "");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const updateRunEditorialPayload = useMutation(backofficeApi.updateRunEditorialPayload);
  const saveFutureSelfNote = useMutation(backofficeApi.saveFutureSelfNote);

  useEffect(() => {
    setEditablePayload((run.editorialPayload ?? run.dailyReadingPayload) as Record<string, unknown>);
    setFutureSelfNote(run.futureSelfNote ?? "");
    setSaveStatus(null);
    setSaveError(null);
  }, [run._id, run.editorialUpdatedAt]);

  const homePayload = asRecord(editablePayload.home) ?? asRecord(editablePayload.modules);
  const chartProfile = asRecord(editablePayload.chartProfile);
  const deepDive = asRecord(editablePayload.deepDive);
  const transitsPayload = asRecord(editablePayload.transits);
  const highlightedTransit = asRecord(transitsPayload?.highlighted);
  const voidPreview = asRecord(editablePayload.voidPreview);
  const futureSelf = asRecord(editablePayload.futureSelf);
  const longRead = asRecord(editablePayload.longRead);
  const personalization = asRecord(editablePayload.personalization);
  const topics = Array.isArray(editablePayload.topics) ? editablePayload.topics : [];
  const doItems = stringList(homePayload?.doList, homePayload?.do);
  const avoidItems = stringList(homePayload?.avoidList, homePayload?.avoid);

  function updateEditable(path: Array<string | number>, value: string) {
    setEditablePayload((current) => setPayloadPath(current, path, value));
  }

  async function handleSaveEditorialPayload() {
    setSaveStatus("Guardando edicion editorial...");
    setSaveError(null);
    try {
      await updateRunEditorialPayload({
        runId: run._id,
        editorialPayload: editablePayload
      });
      setSaveStatus("Edicion editorial guardada.");
    } catch (error) {
      setSaveStatus(null);
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar la edicion.");
    }
  }

  async function handleSaveFutureSelfNote() {
    setSaveStatus("Guardando nota al futuro...");
    setSaveError(null);
    try {
      await saveFutureSelfNote({
        runId: run._id,
        futureSelfNote: futureSelfNote.trim() || undefined
      });
      setSaveStatus("Nota al futuro guardada.");
    } catch (error) {
      setSaveStatus(null);
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar la nota.");
    }
  }

  return (
    <View style={styles.homeLab}>
      <View style={styles.homeLabHeader}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Home Lab</Text>
          <Text style={styles.panelTitle}>Salida editorial interactiva</Text>
          <Text selectable style={styles.hint}>
            Generado para {run.localDate}. Edita textos sin pisar el raw del proveedor.
          </Text>
        </View>
        <View style={styles.actions}>
          <SmallButton label="Guardar edicion" onPress={handleSaveEditorialPayload} tone="ghost" />
        </View>
      </View>

      {saveError ? (
        <Notice tone="danger" title="No se pudo guardar">
          {saveError}
        </Notice>
      ) : null}
      {saveStatus ? (
        <Notice tone="neutral" title="Home Lab">
          {saveStatus}
        </Notice>
      ) : null}

      <View style={styles.tabBar}>
        {homeLabTabs.map(([tab, label]) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
          >
            <Text selectable style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {activeTab === "summary" ? (
        <View style={styles.inspectorBlock}>
          <Text style={styles.blockTitle}>Resumen de salida</Text>
          <View style={styles.summaryGrid}>
            <SummaryCard label="Modo" value={readString(editablePayload.mode, "sin modo")} detail={readString(editablePayload.source, "sin fuente")} />
            <SummaryCard label="Fecha" value={run.localDate} detail={run.timezone} />
            <SummaryCard label="Version" value={readString(editablePayload.contentVersion, run.modelVersions.dailyReading)} detail={run.modelVersions.chart} />
            <SummaryCard label="Review" value={run.reviewStatus ?? "needs_review"} detail={`${run.modelGaps.length} pendientes`} />
          </View>
          <View style={styles.personalizationBox}>
            <Text selectable style={styles.moduleKey}>Base de personalizacion</Text>
            <Text selectable style={styles.moduleValue}>{readString(personalization?.explanation, "Este run no trae base de personalizacion explicita; probablemente fue generado antes del Home Lab nuevo.")}</Text>
            <View style={styles.bulletList}>
              {stringList(personalization?.basedOn, undefined, 0).map((item, index) => (
                <Text selectable key={`${item}-${index}`} style={styles.bulletItem}>- {item}</Text>
              ))}
            </View>
            <Text selectable style={styles.listMeta}>Confianza: {readString(personalization?.confidence, "pendiente")}</Text>
          </View>
          <View style={styles.modules}>
            <View style={styles.moduleRow}>
              <Text selectable style={styles.moduleKey}>Titular</Text>
              <Text selectable style={styles.moduleValue}>{readDisplayValue(homePayload?.headline)}</Text>
            </View>
            <View style={styles.moduleRow}>
              <Text selectable style={styles.moduleKey}>Hacé</Text>
              <BulletList items={doItems} />
            </View>
            <View style={styles.moduleRow}>
              <Text selectable style={styles.moduleKey}>Evitá</Text>
              <BulletList items={avoidItems} />
            </View>
            <View style={styles.moduleRow}>
              <Text selectable style={styles.moduleKey}>Acción</Text>
              <Text selectable style={styles.moduleValue}>{readDisplayValue(homePayload?.action)}</Text>
            </View>
            <View style={styles.moduleRow}>
              <Text selectable style={styles.moduleKey}>Pregunta</Text>
              <Text selectable style={styles.moduleValue}>{readDisplayValue(homePayload?.question)}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {activeTab === "chart" ? (
        <>
          <View style={styles.inspectorBlock}>
            <Text style={styles.blockTitle}>Chart natal estable</Text>
            <Text selectable style={styles.moduleValue}>{readString(chartProfile?.title, "Carta natal pendiente")}</Text>
            <View style={styles.topicGrid}>
              {(Array.isArray(chartProfile?.triad) ? chartProfile.triad : []).map((item, index) => {
                const itemRecord = asRecord(item);
                return (
                  <View key={`${readString(itemRecord?.key, "triad")}-${index}`} style={styles.topicPill}>
                    <Text selectable style={styles.moduleKey}>{readString(itemRecord?.label)}</Text>
                    <Text selectable style={styles.moduleValue}>{readString(itemRecord?.text)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          <View style={styles.inspectorBlock}>
            <Text style={styles.blockTitle}>Placements, casas y aspectos</Text>
            <JsonBlock
              value={{
                placements: chartProfile?.placements,
                houses: chartProfile?.houses,
                mainAspects: chartProfile?.mainAspects,
                limitations: chartProfile?.limitations
              }}
              maxHeight={360}
            />
          </View>
        </>
      ) : null}

      {activeTab === "home" ? (
        <View style={styles.inspectorBlock}>
          <Text style={styles.blockTitle}>Home diaria editable</Text>
          <View style={styles.editGrid}>
            {["headline", "energy", "action", "question"].map((key) => (
              <EditableTextArea
                key={key}
                label={dailyModuleLabel(key)}
                value={editableString(homePayload?.[key])}
                onChangeText={(value) => updateEditable(["home", key], value)}
              />
            ))}
          </View>
          <View style={styles.topicGrid}>
            <EditableStringList
              label="Hacé"
              items={doItems}
              onChangeItem={(index, value) => {
                updateEditable(["home", "doList", index], value);
                if (index === 0) {
                  updateEditable(["home", "do"], value);
                }
              }}
            />
            <EditableStringList
              label="Evitá"
              items={avoidItems}
              onChangeItem={(index, value) => {
                updateEditable(["home", "avoidList", index], value);
                if (index === 0) {
                  updateEditable(["home", "avoid"], value);
                }
              }}
            />
          </View>
          <Text style={styles.blockTitle}>Topics</Text>
          <View style={styles.topicGrid}>
            {topics.map((topic, index) => {
              const topicRecord = asRecord(topic);
              return (
                <View key={`${readString(topicRecord?.topic, "topic")}-${index}`} style={styles.topicEditor}>
                  <Text selectable style={styles.topicEditorTitle}>{readString(topicRecord?.title, "Tema")}</Text>
                  <EditableTextArea
                    label="Frase corta"
                    value={editableString(topicRecord?.oneLine)}
                    onChangeText={(value) => updateEditable(["topics", index, "oneLine"], value)}
                  />
                  <EditableTextArea
                    label="Detalle"
                    value={editableString(topicRecord?.detail ?? topicRecord?.body)}
                    onChangeText={(value) => {
                      updateEditable(["topics", index, "detail"], value);
                      updateEditable(["topics", index, "body"], value);
                    }}
                  />
                  <EditableTextArea
                    label="Hace"
                    value={editableString(topicRecord?.do)}
                    onChangeText={(value) => updateEditable(["topics", index, "do"], value)}
                  />
                  <EditableTextArea
                    label="Evita"
                    value={editableString(topicRecord?.avoid)}
                    onChangeText={(value) => updateEditable(["topics", index, "avoid"], value)}
                  />
                  <EditableTextArea
                    label="Pregunta"
                    value={editableString(topicRecord?.question)}
                    onChangeText={(value) => updateEditable(["topics", index, "question"], value)}
                  />
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {activeTab === "deepDive" ? (
        <View style={styles.inspectorBlock}>
          <Text style={styles.blockTitle}>Deep Dive editable</Text>
          <View style={styles.editGrid}>
            {["title", "intro", "why", "do", "avoid", "reflection", "disclaimer"].map((key) => (
              <EditableTextArea
                key={key}
                label={deepDiveLabel(key)}
                value={editableString(deepDive?.[key])}
                onChangeText={(value) => updateEditable(["deepDive", key], value)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {activeTab === "transits" ? (
        <>
          <View style={styles.inspectorBlock}>
            <Text style={styles.blockTitle}>Transito destacado</Text>
            <Text selectable style={styles.moduleValue}>{readString(highlightedTransit?.displayText, "Sin transito destacado.")}</Text>
            <Text selectable style={styles.hint}>{readString(transitsPayload?.explanation)}</Text>
          </View>
          <View style={styles.inspectorBlock}>
            <Text style={styles.blockTitle}>Transitos secundarios y raw normalizado</Text>
            <JsonBlock value={transitsPayload ?? { selectedTransits: editablePayload.selectedTransits }} maxHeight={420} />
          </View>
        </>
      ) : null}

      {activeTab === "void" ? (
        <View style={styles.inspectorBlock}>
          <Text style={styles.blockTitle}>Void preview</Text>
          <EditableTextArea
            label="Pregunta del dia"
            value={editableString(voidPreview?.questionOfDay)}
            onChangeText={(value) => updateEditable(["voidPreview", "questionOfDay"], value)}
          />
          <View style={styles.topicGrid}>
            {(Array.isArray(voidPreview?.suggestedQuestions) ? voidPreview.suggestedQuestions : []).map((question, index) => {
              const questionRecord = asRecord(question);
              return (
                <View key={`${readString(questionRecord?.id, "question")}-${index}`} style={styles.topicEditor}>
                  <Text selectable style={styles.topicEditorTitle}>{readString(questionRecord?.category, "Categoria")}</Text>
                  <EditableTextArea
                    label="Pregunta sugerida"
                    value={editableString(questionRecord?.text)}
                    onChangeText={(value) => updateEditable(["voidPreview", "suggestedQuestions", index, "text"], value)}
                  />
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {activeTab === "futureSelf" ? (
        <View style={styles.inspectorBlock}>
          <Text style={styles.blockTitle}>Sending Note To Your Future Self</Text>
          <EditableTextArea
            label="Prompt"
            value={editableString(futureSelf?.prompt)}
            onChangeText={(value) => updateEditable(["futureSelf", "prompt"], value)}
          />
          <EditableTextArea label="Nota guardada" value={futureSelfNote} onChangeText={setFutureSelfNote} />
          <View style={styles.actions}>
            <SmallButton label="Guardar prompt" onPress={handleSaveEditorialPayload} tone="ghost" />
            <SmallButton label="Guardar nota" onPress={handleSaveFutureSelfNote} tone="ghost" />
          </View>
        </View>
      ) : null}

      {activeTab === "raw" ? (
        <>
          <View style={styles.inspectorBlock}>
            <Text style={styles.blockTitle}>Long Read editorial</Text>
            <JsonBlock value={longRead ?? {}} maxHeight={240} />
          </View>
          <View style={styles.inspectorBlock}>
            <Text style={styles.blockTitle}>Payload generado original</Text>
            <JsonBlock value={run.dailyReadingPayload} maxHeight={420} />
          </View>
          <View style={styles.inspectorBlock}>
            <Text style={styles.blockTitle}>Payload editorial editable</Text>
            <JsonBlock value={editablePayload} maxHeight={420} />
          </View>
        </>
      ) : null}
    </View>
  );
}

function EditableTextArea({
  label,
  value,
  onChangeText
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Input multiline value={value} onChangeText={onChangeText} style={styles.editTextarea} />
    </Field>
  );
}

function EditableStringList({
  label,
  items,
  onChangeItem
}: {
  label: string;
  items: string[];
  onChangeItem: (index: number, value: string) => void;
}) {
  return (
    <View style={styles.topicEditor}>
      <Text selectable style={styles.topicEditorTitle}>{label}</Text>
      {items.map((item, index) => (
        <EditableTextArea
          key={`${label}-${index}`}
          label={`${index + 1}`}
          value={item}
          onChangeText={(value) => onChangeItem(index, value)}
        />
      ))}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <Text selectable style={styles.moduleValue}>Sin dato</Text>;
  }

  return (
    <View style={styles.bulletList}>
      {items.map((item, index) => (
        <Text selectable key={`${item}-${index}`} style={styles.bulletItem}>
          {index + 1}. {item.trim() || "Sin definir todavia"}
        </Text>
      ))}
    </View>
  );
}

function deepDiveLabel(key: string) {
  const labels: Record<string, string> = {
    avoid: "Evita",
    disclaimer: "Disclaimer",
    do: "Hace",
    intro: "Intro",
    reflection: "Pregunta",
    title: "Titulo",
    why: "Por que"
  };

  return labels[key] ?? key;
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function Notice({ title, children, tone }: { title: string; children: string; tone: "danger" | "neutral" }) {
  return (
    <View style={[styles.notice, tone === "danger" ? styles.noticeDanger : styles.noticeNeutral]}>
      <Text selectable style={styles.noticeTitle}>{title}</Text>
      <Text selectable style={styles.noticeText}>{children}</Text>
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Input(props: ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="rgba(241, 232, 215, 0.38)"
      style={[styles.input, props.style]}
    />
  );
}

function Segmented({
  value,
  options,
  onChange
}: {
  value: BirthTimePrecision;
  options: [BirthTimePrecision, string][];
  onChange: (value: BirthTimePrecision) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map(([option, label]) => (
        <Pressable
          key={option}
          onPress={() => onChange(option)}
          style={[styles.segment, value === option && styles.segmentActive]}
        >
          <Text selectable style={[styles.segmentText, value === option && styles.segmentTextActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} style={[styles.primaryButton, disabled && styles.disabledButton]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SmallButton({ label, onPress, tone }: { label: string; onPress: () => void; tone: "ghost" }) {
  return (
    <Pressable onPress={onPress} style={[styles.smallButton, tone === "ghost" && styles.ghostButton]}>
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text selectable style={styles.summaryLabel}>{label}</Text>
      <Text selectable numberOfLines={2} style={styles.summaryValue}>{value}</Text>
      {detail ? <Text selectable numberOfLines={2} style={styles.summaryDetail}>{detail}</Text> : null}
    </View>
  );
}

function LoadingLine({ label }: { label: string }) {
  return (
    <View style={styles.loadingLine}>
      <ActivityIndicator color="#D8B46A" />
      <Text style={styles.hint}>{label}</Text>
    </View>
  );
}

function dailyModuleLabel(key: string) {
  const labels: Record<string, string> = {
    action: "Acción",
    avoid: "Evitá",
    do: "Hacé",
    energy: "Energía",
    headline: "Titular",
    question: "Pregunta"
  };

  return labels[key] ?? key;
}

function providerLabel(key: string) {
  const labels: Record<string, string> = {
    error: "Error",
    houseSystem: "Sistema de casas",
    providerVersion: "Versión",
    request: "Request",
    status: "Estado",
    warnings: "Warnings"
  };

  return labels[key] ?? key;
}

function JsonBlock({ value, maxHeight = 300 }: { value: unknown; maxHeight?: number }) {
  return (
    <View style={styles.jsonFrame}>
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        style={[styles.jsonVerticalScroll, { maxHeight }]}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.jsonHorizontalContent}>
          <Text selectable style={styles.jsonText}>{formatJson(value)}</Text>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const colors = {
  background: "#111111",
  panel: "#1A1A18",
  panelSoft: "#22211E",
  ink: "#F4EEE3",
  muted: "#AFA698",
  faint: "rgba(244, 238, 227, 0.12)",
  copper: "#D8B46A",
  copperDark: "#7B5B2A",
  dangerBg: "rgba(226, 142, 123, 0.12)",
  okBg: "rgba(216, 180, 106, 0.11)"
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.background,
    flex: 1
  },
  content: {
    alignSelf: "center",
    gap: 16,
    maxWidth: 1280,
    padding: 20,
    paddingBottom: 48,
    width: "100%"
  },
  setupWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100%",
    padding: 20
  },
  setupPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    maxWidth: 720,
    padding: 24,
    width: "100%"
  },
  copyBlock: {
    gap: 10
  },
  setupActions: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  clerkPanel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    overflow: "hidden",
    padding: 4
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "space-between"
  },
  headerCopy: {
    flex: 1,
    gap: 6,
    minWidth: 280
  },
  headerMeta: {
    backgroundColor: colors.panel,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 12,
    width: 320
  },
  kicker: {
    color: colors.copper,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontFamily: "Newsreader_600SemiBold",
    fontSize: 28,
    letterSpacing: 0,
    lineHeight: 32
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 760
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  metaValue: {
    color: colors.ink,
    fontSize: 14
  },
  metaMode: {
    color: colors.copper,
    fontSize: 12,
    fontWeight: "700"
  },
  sessionButton: {
    alignItems: "center",
    backgroundColor: colors.panelSoft,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 12
  },
  sessionButtonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700"
  },
  grid: {
    gap: 16
  },
  gridWide: {
    alignItems: "flex-start",
    flexDirection: "row"
  },
  gridNarrow: {
    flexDirection: "column"
  },
  columnMain: {
    flex: 1.4,
    gap: 16,
    minWidth: 0
  },
  columnSide: {
    flex: 1,
    gap: 16,
    minWidth: 0
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    overflow: "hidden",
    padding: 16
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  field: {
    flexGrow: 1,
    gap: 6,
    minWidth: 220
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0
  },
  input: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  textarea: {
    minHeight: 84,
    textAlignVertical: "top"
  },
  segmented: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 44,
    overflow: "hidden"
  },
  segment: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8
  },
  segmentActive: {
    backgroundColor: colors.copper
  },
  segmentText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  segmentTextActive: {
    color: "#15120E"
  },
  runControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  inlineActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.copper,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16
  },
  disabledButton: {
    opacity: 0.42
  },
  primaryButtonText: {
    color: "#15120E",
    fontSize: 14,
    fontWeight: "800"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.panelSoft,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 14
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  smallButton: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 12
  },
  ghostButton: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.faint,
    borderWidth: 1
  },
  smallButtonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700"
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  notice: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12
  },
  noticeNeutral: {
    backgroundColor: colors.okBg,
    borderColor: "rgba(216, 180, 106, 0.28)"
  },
  noticeDanger: {
    backgroundColor: colors.dangerBg,
    borderColor: "rgba(226, 142, 123, 0.35)"
  },
  noticeTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  noticeText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19
  },
  list: {
    gap: 8
  },
  listItem: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12
  },
  listItemActive: {
    borderColor: colors.copper
  },
  listTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  listMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19
  },
  loadingLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  inspectorGrid: {
    gap: 12
  },
  homeLab: {
    backgroundColor: "#151512",
    borderColor: "rgba(216, 180, 106, 0.25)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
    width: "100%"
  },
  homeLabHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between"
  },
  tabBar: {
    backgroundColor: colors.panel,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: 6
  },
  tabButton: {
    alignItems: "center",
    borderRadius: 6,
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 10
  },
  tabButtonActive: {
    backgroundColor: colors.copper
  },
  tabButtonText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  tabButtonTextActive: {
    color: "#15120E"
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    width: "100%"
  },
  summaryCard: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    gap: 4,
    minWidth: 180,
    padding: 12
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  summaryValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18
  },
  summaryDetail: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16
  },
  inspectorBlock: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    minWidth: 0,
    overflow: "hidden",
    padding: 12,
    width: "100%"
  },
  blockTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  reviewSummary: {
    backgroundColor: "#151512",
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 10
  },
  reviewStatus: {
    color: colors.copper,
    fontSize: 13,
    fontWeight: "800"
  },
  modules: {
    gap: 8
  },
  moduleRow: {
    borderBottomColor: colors.faint,
    borderBottomWidth: 1,
    gap: 2,
    minWidth: 0,
    paddingBottom: 8
  },
  moduleKey: {
    color: colors.copper,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  moduleValue: {
    color: colors.ink,
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18
  },
  topicGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  topicPill: {
    backgroundColor: "#151512",
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    gap: 4,
    minWidth: 220,
    padding: 10
  },
  personalizationBox: {
    backgroundColor: "#10100E",
    borderColor: "rgba(216, 180, 106, 0.28)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 10
  },
  bulletList: {
    gap: 5
  },
  bulletItem: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18
  },
  editGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  editTextarea: {
    minHeight: 96,
    textAlignVertical: "top"
  },
  topicEditor: {
    backgroundColor: "#151512",
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    gap: 10,
    minWidth: 280,
    padding: 10
  },
  topicEditorTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  gaps: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  gapPill: {
    backgroundColor: "rgba(216, 180, 106, 0.14)",
    borderColor: "rgba(216, 180, 106, 0.3)",
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    flexShrink: 1,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  jsonFrame: {
    backgroundColor: "#10100E",
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    width: "100%"
  },
  jsonVerticalScroll: {
    width: "100%"
  },
  jsonHorizontalContent: {
    padding: 10
  },
  jsonText: {
    color: "#D7D0C3",
    fontFamily: "Courier",
    fontSize: 11,
    lineHeight: 16
  }
});
