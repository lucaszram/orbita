import { useAction } from "convex/react";
import { ComponentType, ReactNode, useMemo, useState } from "react";
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { Newsreader_500Medium } from "@expo-google-fonts/newsreader";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import { Activity, AlertCircle, ArrowRight, KeyRound, Layers3, LocateFixed, Orbit, Sparkles } from "lucide-react-native";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { webAssets } from "@/content/webAssets";
import { backendConfig } from "@/services/backendProviders";
import {
  CompleteHoroscopeFeature,
  CompleteHoroscopeProfile,
  PublicDailyHome,
  PublicLabBirthTimePrecision,
  PublicLabInput,
  PublicLabPlaceLookup,
  publicLabApi
} from "@/services/publicLabRefs";

const colors = {
  black: "#07080A",
  charcoal: "#0D0F13",
  panel: "rgba(15, 17, 22, 0.82)",
  panelStrong: "rgba(20, 22, 27, 0.94)",
  copper: "#C46A3A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)",
  boneDim: "rgba(244, 238, 228, 0.52)",
  line: "rgba(214, 154, 106, 0.24)",
  lineQuiet: "rgba(244, 238, 228, 0.12)",
  danger: "#F2A7A0",
  success: "#BBD3C7",
  blue: "#AFC4D7"
};

type IconComponent = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
type LabTab = "complete" | "summary" | "home" | "chart" | "transits" | "questions" | "gaps";

type LabForm = {
  displayName: string;
  birthDate: string;
  birthTime: string;
  birthTimePrecision: PublicLabBirthTimePrecision;
  birthPlaceLabel: string;
  latitude: string;
  longitude: string;
  timezone: string;
  localDate: string;
  runTimezone: string;
  accessKey: string;
};

const tabs: Array<[LabTab, string]> = [
  ["complete", "Completo"],
  ["summary", "Resumen"],
  ["home", "Home"],
  ["chart", "Carta"],
  ["transits", "Tránsitos"],
  ["questions", "Preguntas"],
  ["gaps", "Gaps"]
];

function todayLocalDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const defaultForm: LabForm = {
  displayName: "Lucas",
  birthDate: "1996-11-11",
  birthTime: "10:48",
  birthTimePrecision: "known",
  birthPlaceLabel: "Buenos Aires, Argentina",
  latitude: "-34.6037",
  longitude: "-58.3816",
  timezone: "America/Argentina/Buenos_Aires",
  localDate: todayLocalDate(),
  runTimezone: "America/Argentina/Buenos_Aires",
  accessKey: ""
};

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown, fallback = "Sin dato") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readDisplay(value: unknown, fallback = "Sin dato") {
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  const record = asRecord(value);
  if (record) {
    return readString(record.text, readString(record.label, fallback));
  }

  return readString(value, fallback);
}

function stringItems(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
}

function buildPreviewInput(form: LabForm): PublicLabInput {
  return {
    displayName: form.displayName.trim() || undefined,
    birthDate: form.birthDate.trim(),
    birthTime: form.birthTimePrecision === "unknown" ? undefined : form.birthTime.trim() || undefined,
    birthTimePrecision: form.birthTimePrecision,
    birthPlaceLabel: form.birthPlaceLabel.trim(),
    latitude: parseOptionalNumber(form.latitude),
    longitude: parseOptionalNumber(form.longitude),
    timezone: form.timezone.trim(),
    localDate: form.localDate.trim(),
    runTimezone: form.runTimezone.trim() || undefined,
    accessKey: form.accessKey.trim() || undefined
  };
}

function SetupState() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.centerWrap}>
      <View style={styles.setupPanel}>
        <View style={styles.brandMark}>
          <Orbit color={colors.copperSoft} size={19} strokeWidth={1.7} />
          <Text style={styles.brandText}>Órbita</Text>
        </View>
        <Text style={styles.title}>Lab Órbita</Text>
        <Text selectable style={styles.body}>
          Falta `EXPO_PUBLIC_CONVEX_URL` para conectar el lab con Convex. El acceso no usa login, pero sí necesita el
          backend dev.
        </Text>
      </View>
    </ScrollView>
  );
}

export function OrbitaLab() {
  if (!backendConfig.hasConvex) {
    return <SetupState />;
  }

  return <OrbitaLabWithBackend />;
}

function OrbitaLabWithBackend() {
  const { width } = useWindowDimensions();
  const isNarrow = width < 980;
  const previewDailyHome = useAction(publicLabApi.previewDailyHome);
  const previewCompleteHoroscope = useAction(publicLabApi.previewCompleteHoroscope);
  const resolvePlace = useAction(publicLabApi.resolvePlace);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Newsreader_500Medium
  });
  const [form, setForm] = useState<LabForm>(defaultForm);
  const [activeTab, setActiveTab] = useState<LabTab>("summary");
  const [result, setResult] = useState<PublicDailyHome | null>(null);
  const [completeResult, setCompleteResult] = useState<CompleteHoroscopeProfile | null>(null);
  const [placeResult, setPlaceResult] = useState<PublicLabPlaceLookup | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);

  const inputPreview = useMemo(() => buildPreviewInput(form), [form]);

  function updateForm<K extends keyof LabForm>(key: K, value: LabForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleResolvePlace() {
    setIsResolvingPlace(true);
    setError(null);
    setStatus("Buscando lugar...");
    try {
      const lookup = await resolvePlace({
        query: form.birthPlaceLabel,
        accessKey: form.accessKey.trim() || undefined
      });
      setPlaceResult(lookup);
      const firstPlace = lookup.places[0];
      if (firstPlace) {
        setForm((current) => ({
          ...current,
          birthPlaceLabel: firstPlace.label || current.birthPlaceLabel,
          latitude: firstPlace.latitude === undefined ? current.latitude : String(firstPlace.latitude),
          longitude: firstPlace.longitude === undefined ? current.longitude : String(firstPlace.longitude),
          timezone: firstPlace.timezone || current.timezone,
          runTimezone: firstPlace.timezone || current.runTimezone
        }));
      }
      setStatus(lookup.status === "success" ? "Lugar resuelto." : lookup.error ?? "Lookup de lugar no configurado.");
    } catch (lookupError) {
      setPlaceResult(null);
      setStatus(null);
      setError(lookupError instanceof Error ? lookupError.message : "No se pudo resolver el lugar.");
    } finally {
      setIsResolvingPlace(false);
    }
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    setStatus("Generando Home diaria...");
    try {
      const preview = await previewDailyHome(inputPreview);
      setResult(preview);
      setActiveTab("summary");
      setStatus("Home diaria generada.");
    } catch (previewError) {
      setResult(null);
      setStatus(null);
      setError(previewError instanceof Error ? previewError.message : "No se pudo generar la Home diaria.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerateComplete() {
    setIsGenerating(true);
    setError(null);
    setStatus("Generando horóscopo completo...");
    try {
      const preview = await previewCompleteHoroscope(inputPreview);
      setCompleteResult(preview);
      setResult(preview.dailyHome);
      setActiveTab("complete");
      setStatus("Horóscopo completo generado.");
    } catch (previewError) {
      setCompleteResult(null);
      setResult(null);
      setStatus(null);
      setError(previewError instanceof Error ? previewError.message : "No se pudo generar el horóscopo completo.");
    } finally {
      setIsGenerating(false);
    }
  }

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.copperSoft} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <ImageBackground
        accessibilityLabel={webAssets.dailyTexture.alt}
        imageStyle={styles.headerImage}
        resizeMode="cover"
        source={webAssets.dailyTexture.require}
        style={styles.header}
      >
        <LinearGradient colors={["rgba(7,8,10,0.22)", "rgba(7,8,10,0.9)"]} style={styles.headerOverlay}>
          <View style={styles.topLine}>
            <View style={styles.brandMark}>
              <Orbit color={colors.copperSoft} size={19} strokeWidth={1.7} />
              <Text style={styles.brandText}>Órbita</Text>
            </View>
            <View style={styles.modePill}>
              <Sparkles color={colors.copperSoft} size={15} strokeWidth={1.7} />
              <Text style={styles.modePillText}>público-dev</Text>
            </View>
          </View>
          <View style={styles.headerCopy}>
            <Text selectable style={styles.kicker}>Lab Órbita</Text>
            <Text selectable style={[styles.title, isNarrow && styles.titleNarrow]}>Lab Órbita</Text>
            <Text selectable style={styles.subtitle}>Cargá datos natales y mirá cómo responde la Home diaria.</Text>
            <Text selectable style={styles.disclaimer}>Lab de desarrollo. Entretenimiento, autoconocimiento y contexto.</Text>
          </View>
        </LinearGradient>
      </ImageBackground>

      <View style={[styles.workspace, isNarrow && styles.workspaceNarrow]}>
        <View style={styles.formPanel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Entrada natal</Text>
            <Text selectable style={styles.panelHint}>No guarda sujetos ni runs. Para aprobar contenido usá `/backoffice`.</Text>
          </View>

          <View style={styles.formGrid}>
            <Field label="Nombre opcional">
              <Input value={form.displayName} onChangeText={(value) => updateForm("displayName", value)} placeholder="Lucas" />
            </Field>
            <Field label="Fecha de nacimiento">
              <Input value={form.birthDate} onChangeText={(value) => updateForm("birthDate", value)} placeholder="YYYY-MM-DD" />
            </Field>
            <Field label="Lugar de nacimiento">
              <Input value={form.birthPlaceLabel} onChangeText={(value) => updateForm("birthPlaceLabel", value)} placeholder="Ciudad, país" />
            </Field>
            <Field label="Código lab">
              <Input
                icon={KeyRound}
                value={form.accessKey}
                onChangeText={(value) => updateForm("accessKey", value)}
                placeholder="Si Convex lo pide"
              />
            </Field>
            <Field label="Latitud">
              <Input value={form.latitude} onChangeText={(value) => updateForm("latitude", value)} placeholder="-34.6037" />
            </Field>
            <Field label="Longitud">
              <Input value={form.longitude} onChangeText={(value) => updateForm("longitude", value)} placeholder="-58.3816" />
            </Field>
            <Field label="Timezone natal">
              <Input value={form.timezone} onChangeText={(value) => updateForm("timezone", value)} placeholder="America/Argentina/Buenos_Aires" />
            </Field>
            <Field label="Fecha de lectura">
              <Input value={form.localDate} onChangeText={(value) => updateForm("localDate", value)} placeholder="YYYY-MM-DD" />
            </Field>
            <Field label="Timezone lectura">
              <Input value={form.runTimezone} onChangeText={(value) => updateForm("runTimezone", value)} placeholder="America/Argentina/Buenos_Aires" />
            </Field>
            <Field label="Hora">
              <Input
                editable={form.birthTimePrecision !== "unknown"}
                value={form.birthTime}
                onChangeText={(value) => updateForm("birthTime", value)}
                placeholder="10:48"
              />
            </Field>
          </View>

          <View style={styles.precisionGroup}>
            <Text style={styles.label}>Precisión de hora</Text>
            <View style={styles.segmented}>
              <Segment label="Exacta" selected={form.birthTimePrecision === "known"} onPress={() => updateForm("birthTimePrecision", "known")} />
              <Segment label="Aprox." selected={form.birthTimePrecision === "approximate"} onPress={() => updateForm("birthTimePrecision", "approximate")} />
              <Segment label="No sé" selected={form.birthTimePrecision === "unknown"} onPress={() => updateForm("birthTimePrecision", "unknown")} />
            </View>
          </View>

          <View style={styles.actions}>
            <ActionButton
              icon={LocateFixed}
              label={isResolvingPlace ? "Buscando..." : "Resolver lugar"}
              onPress={handleResolvePlace}
              variant="secondary"
              disabled={isResolvingPlace}
            />
            <ActionButton
              icon={ArrowRight}
              label={isGenerating ? "Generando..." : "Generar Home diaria"}
              onPress={handleGenerate}
              disabled={isGenerating}
            />
            <ActionButton
              icon={Layers3}
              label={isGenerating ? "Generando..." : "Generar horóscopo completo"}
              onPress={handleGenerateComplete}
              disabled={isGenerating}
            />
          </View>

          {placeResult ? (
            <Notice tone={placeResult.status === "success" ? "success" : "neutral"} title="Lookup de lugar">
              {placeResult.status === "success"
                ? `${placeResult.places.length} resultado(s). Se aplicó el primero si había coordenadas.`
                : placeResult.error ?? "El lookup no está configurado; podés seguir con lat/lon manual."}
            </Notice>
          ) : null}
          {status ? (
            <Notice tone="neutral" title="Estado">
              {status}
            </Notice>
          ) : null}
          {error ? (
            <Notice tone="danger" title="No se pudo generar">
              {error}
            </Notice>
          ) : null}
        </View>

        <View style={styles.outputPanel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Salida del lab</Text>
            <Text selectable style={styles.panelHint}>
              {result ? `${result.localDate} · ${result.timezone}` : "Generá un preview para ver módulos y gaps."}
            </Text>
          </View>

          {result ? (
            <>
              <View style={styles.tabBar}>
                {tabs.map(([tab, label]) => (
                  <Pressable
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
                  >
                    <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <LabResult complete={completeResult} tab={activeTab} result={result} />
            </>
          ) : (
            <EmptyPreview input={inputPreview} />
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function LabResult({ complete, tab, result }: { complete: CompleteHoroscopeProfile | null; tab: LabTab; result: PublicDailyHome }) {
  if (tab === "complete") {
    return complete ? <CompleteProfileResult complete={complete} /> : (
      <View style={styles.resultStack}>
        <Block title="Horóscopo completo">
          <Text selectable style={styles.body}>
            Usá `Generar horóscopo completo` para ver todos los bloques del spec por persona.
          </Text>
        </Block>
      </View>
    );
  }

  if (tab === "summary") {
    return (
      <View style={styles.resultStack}>
        <View style={styles.summaryGrid}>
          <Metric label="Modo" value={result.mode} detail={result.source} />
          <Metric label="Provider" value={result.provider.status} detail={result.provider.providerVersion ?? "sin version"} />
          <Metric label="Review" value={result.reviewStatus} detail={`${result.modelGaps.length} gap(s)`} />
          <Metric label="Versión" value={result.contentVersion || "sin version"} detail={result.calculationVersion || "sin calculo"} />
        </View>
        <Block title="Titular">
          <Text selectable style={styles.heroLine}>{result.header.headline}</Text>
          <Text selectable style={styles.body}>{result.header.subheadline}</Text>
        </Block>
        <Block title="Personalización">
          <Text selectable style={styles.body}>{readString(result.personalization.explanation)}</Text>
          <BulletList items={stringItems(result.personalization.basedOn)} />
          <Text selectable style={styles.metaLine}>Confianza: {readString(result.personalization.confidence, "pendiente")}</Text>
        </Block>
      </View>
    );
  }

  if (tab === "home") {
    return (
      <View style={styles.resultStack}>
        <Block title="Hacé">
          <BulletList items={result.modules.do} />
        </Block>
        <Block title="Evitá">
          <BulletList items={result.modules.avoid} />
        </Block>
        <Block title="Acción">
          <Text selectable style={styles.body}>{result.modules.action}</Text>
        </Block>
        <Block title="Pregunta">
          <Text selectable style={styles.heroLine}>{result.modules.question}</Text>
        </Block>
        <Block title="Temas">
          <View style={styles.topicGrid}>
            {result.topics.map((topic, index) => {
              const record = asRecord(topic);
              return (
                <View key={`${readString(record?.topic, "topic")}-${index}`} style={styles.topicCell}>
                  <Text selectable style={styles.topicTitle}>{readString(record?.title, "Tema")}</Text>
                  <Text selectable style={styles.body}>{readString(record?.oneLine, readString(record?.body))}</Text>
                  <Text selectable style={styles.metaLine}>{readString(record?.question, "")}</Text>
                </View>
              );
            })}
          </View>
        </Block>
      </View>
    );
  }

  if (tab === "chart") {
    const chartProfile = result.chartProfile ?? {};
    return (
      <View style={styles.resultStack}>
        <Block title="Base natal">
          <View style={styles.summaryGrid}>
            <Metric label="Sol" value={readDisplay(result.natalBase.sun)} detail="base" />
            <Metric label="Luna" value={readDisplay(result.natalBase.moon)} detail="emocional" />
            <Metric label="Ascendente" value={readDisplay(result.natalBase.ascendant)} detail={result.natalBase.accuracy} />
          </View>
        </Block>
        <Block title="Carta">
          <Text selectable style={styles.heroLine}>{readString(chartProfile.title, "Carta natal pendiente")}</Text>
          <BulletList items={stringItems(result.natalBase.limitations)} />
        </Block>
        <JsonBlock
          value={{
            triad: chartProfile.triad,
            placements: chartProfile.placements,
            houses: chartProfile.houses,
            mainAspects: chartProfile.mainAspects
          }}
        />
      </View>
    );
  }

  if (tab === "transits") {
    const highlighted = asRecord(result.transits.highlighted);
    return (
      <View style={styles.resultStack}>
        <Block title="Tránsito destacado">
          <Text selectable style={styles.heroLine}>{readString(highlighted?.displayText, "Sin tránsito destacado disponible.")}</Text>
          <Text selectable style={styles.body}>{result.transits.explanation}</Text>
        </Block>
        <Block title="Secundarios">
          {result.transits.secondary.length > 0 ? (
            <View style={styles.topicGrid}>
              {result.transits.secondary.map((transit, index) => {
                const record = asRecord(transit);
                return (
                  <View key={`${readString(record?.displayText, "transit")}-${index}`} style={styles.topicCell}>
                    <Text selectable style={styles.body}>{readString(record?.displayText)}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text selectable style={styles.body}>Sin tránsitos secundarios para este preview.</Text>
          )}
        </Block>
      </View>
    );
  }

  if (tab === "questions") {
    const voidPreview = asRecord(result.void);
    const futureSelf = asRecord(result.futureSelf);
    const longRead = asRecord(result.longRead);
    return (
      <View style={styles.resultStack}>
        <Block title="Pregunta del día">
          <Text selectable style={styles.heroLine}>{readString(voidPreview?.questionOfDay, result.modules.question)}</Text>
        </Block>
        <Block title="Void prompts">
          <View style={styles.topicGrid}>
            {(Array.isArray(voidPreview?.suggestedQuestions) ? voidPreview.suggestedQuestions : []).map((item, index) => {
              const record = asRecord(item);
              return (
                <View key={`${readString(record?.id, "question")}-${index}`} style={styles.topicCell}>
                  <Text selectable style={styles.topicTitle}>{readString(record?.category, "pregunta")}</Text>
                  <Text selectable style={styles.body}>{readString(record?.text)}</Text>
                </View>
              );
            })}
          </View>
        </Block>
        <Block title="Future Self">
          <Text selectable style={styles.body}>{readString(futureSelf?.prompt)}</Text>
          <Text selectable style={styles.metaLine}>{readString(futureSelf?.placeholder, "")}</Text>
        </Block>
        <Block title="Lectura larga">
          <Text selectable style={styles.heroLine}>{readString(longRead?.title)}</Text>
          <Text selectable style={styles.body}>{readString(longRead?.body)}</Text>
        </Block>
      </View>
    );
  }

  return (
    <View style={styles.resultStack}>
      <Block title="Gaps">
        <BulletList items={result.modelGaps} />
      </Block>
      <Block title="Provider">
        <Text selectable style={styles.body}>Estado: {result.provider.status}</Text>
        <BulletList items={result.provider.warnings} />
        {result.provider.error ? <Text selectable style={styles.errorText}>{result.provider.error}</Text> : null}
      </Block>
      <JsonBlock value={{ modelVersions: result.modelVersions, personalization: result.personalization }} />
    </View>
  );
}

function CompleteProfileResult({ complete }: { complete: CompleteHoroscopeProfile }) {
  return (
    <View style={styles.resultStack}>
      <View style={styles.summaryGrid}>
        <Metric label="Versión" value={complete.version} detail="preview" />
        <Metric label="Provider" value={complete.provider.status} detail={complete.provider.providerVersion ?? "sin version"} />
        <Metric label="Bloques" value={String(Object.keys(complete.blocks).length)} detail="spec completo" />
        <Metric label="Raw" value={complete.rawPolicy.returnsProviderRaw ? "visible" : "oculto"} detail="solo backoffice" />
      </View>
      <Block title="Fuentes">
        <View style={styles.topicGrid}>
          {Object.entries(complete.sourceModel).map(([key, value]) => (
            <View key={key} style={styles.topicCell}>
              <Text selectable style={styles.topicTitle}>{key}</Text>
              <Text selectable style={styles.body}>{value}</Text>
            </View>
          ))}
        </View>
      </Block>
      <FeatureSection title="Big Three / identidad" features={complete.blocks.identity} />
      <FeatureSection title="Carta natal e interpretaciones" features={complete.blocks.natalChart} />
      <FeatureSection title="Daily tips" features={complete.blocks.daily} />
      <FeatureSection title="Cielo actual / tránsitos" features={complete.blocks.currentSky} />
      <FeatureSection title="Futuro" features={complete.blocks.future} />
      <FeatureSection title="Extras" features={complete.blocks.extras} />
      <Block title="Qué necesitamos para hacerlo real">
        <BulletList items={complete.nextBackendNeeds} />
      </Block>
      <JsonBlock
        value={{
          input: complete.input,
          cachePlan: complete.cachePlan,
          chartPayloadSummary: complete.chartPayloadSummary,
          modelGaps: complete.modelGaps
        }}
      />
    </View>
  );
}

function FeatureSection({ features, title }: { features: CompleteHoroscopeFeature[]; title: string }) {
  return (
    <Block title={title}>
      <View style={styles.featureGrid}>
        {features.map((item) => (
          <View key={item.id} style={styles.featureCell}>
            <View style={styles.featureTopline}>
              <Text selectable style={styles.featureId}>{item.id}</Text>
              <StatusPill status={item.status} />
            </View>
            <Text selectable style={styles.topicTitle}>{item.title}</Text>
            <Text selectable style={styles.metaLine}>Fuente: {item.source.join(" + ")} · {item.entitlement}</Text>
            {item.summary ? <Text selectable style={styles.body}>{item.summary}</Text> : null}
            {item.missing && item.missing.length > 0 ? (
              <Text selectable style={styles.metaLine}>Falta: {item.missing.slice(0, 3).join(", ")}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </Block>
  );
}

function StatusPill({ status }: { status: CompleteHoroscopeFeature["status"] }) {
  return (
    <View style={[styles.statusPill, status === "ready" && styles.statusReady, status === "stub" && styles.statusStub]}>
      <Text style={styles.statusText}>{status}</Text>
    </View>
  );
}

function EmptyPreview({ input }: { input: PublicLabInput }) {
  return (
    <View style={styles.emptyPreview}>
      <Activity color={colors.copperSoft} size={26} strokeWidth={1.6} />
      <Text selectable style={styles.emptyTitle}>Listo para generar</Text>
      <Text selectable style={styles.body}>
        El primer preview usa {input.birthDate || "fecha pendiente"} · {input.birthPlaceLabel || "lugar pendiente"}.
      </Text>
      <JsonBlock value={input} compact />
    </View>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Input({
  editable = true,
  icon: Icon,
  onChangeText,
  placeholder,
  value
}: {
  editable?: boolean;
  icon?: IconComponent;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={[styles.inputWrap, !editable && styles.inputDisabled]}>
      {Icon ? <Icon color={colors.boneDim} size={15} strokeWidth={1.8} /> : null}
      <TextInput
        editable={editable}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(244,238,228,0.36)"
        selectionColor={colors.copperSoft}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function Segment({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.segment, selected && styles.segmentSelected]}>
      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function ActionButton({
  disabled,
  icon: Icon,
  label,
  onPress,
  variant = "primary"
}: {
  disabled?: boolean;
  icon: IconComponent;
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, variant === "secondary" && styles.actionButtonSecondary, disabled && styles.actionButtonDisabled]}
    >
      <Icon color={variant === "secondary" ? colors.bone : colors.black} size={17} strokeWidth={2} />
      <Text style={[styles.actionButtonText, variant === "secondary" && styles.actionButtonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

function Notice({ children, title, tone }: { children: string; title: string; tone: "danger" | "neutral" | "success" }) {
  return (
    <View style={[styles.notice, tone === "danger" && styles.noticeDanger, tone === "success" && styles.noticeSuccess]}>
      <AlertCircle color={tone === "danger" ? colors.danger : tone === "success" ? colors.success : colors.copperSoft} size={16} strokeWidth={1.8} />
      <View style={styles.noticeCopy}>
        <Text style={styles.noticeTitle}>{title}</Text>
        <Text selectable style={styles.noticeBody}>{children}</Text>
      </View>
    </View>
  );
}

function Metric({ detail, label, value }: { detail?: string; label: string; value: string; }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text selectable style={styles.metricValue}>{value}</Text>
      {detail ? <Text selectable style={styles.metaLine}>{detail}</Text> : null}
    </View>
  );
}

function Block({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      {children}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) {
    return <Text selectable style={styles.body}>Sin datos para mostrar.</Text>;
  }

  return (
    <View style={styles.bulletList}>
      {safeItems.map((item, index) => (
        <Text selectable key={`${item}-${index}`} style={styles.bulletItem}>- {item}</Text>
      ))}
    </View>
  );
}

function JsonBlock({ compact, value }: { compact?: boolean; value: unknown }) {
  return (
    <ScrollView style={[styles.jsonBlock, compact && styles.jsonBlockCompact]}>
      <Text selectable style={styles.jsonText}>{formatJson(value)}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.black,
    flex: 1
  },
  pageContent: {
    paddingBottom: 52
  },
  loading: {
    alignItems: "center",
    backgroundColor: colors.black,
    flex: 1,
    justifyContent: "center"
  },
  centerWrap: {
    alignItems: "center",
    minHeight: "100%",
    justifyContent: "center",
    padding: 24
  },
  setupPanel: {
    backgroundColor: colors.panelStrong,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 560,
    padding: 24,
    width: "100%"
  },
  header: {
    minHeight: 360
  },
  headerImage: {
    opacity: 0.7
  },
  headerOverlay: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingVertical: 24
  },
  topLine: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16
  },
  brandMark: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  brandText: {
    color: colors.bone,
    fontFamily: "Inter_700Bold",
    fontSize: 15
  },
  modePill: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  modePillText: {
    color: colors.boneMuted,
    fontFamily: "Inter_500Medium",
    fontSize: 12
  },
  headerCopy: {
    maxWidth: 760
  },
  kicker: {
    color: colors.copperSoft,
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0,
    marginBottom: 10,
    textTransform: "uppercase"
  },
  title: {
    color: colors.bone,
    fontFamily: "Newsreader_500Medium",
    fontSize: 76,
    letterSpacing: 0,
    lineHeight: 78
  },
  titleNarrow: {
    fontSize: 48,
    lineHeight: 52
  },
  subtitle: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 18,
    lineHeight: 28,
    marginTop: 14,
    maxWidth: 650
  },
  disclaimer: {
    color: colors.boneDim,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 16
  },
  workspace: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 18,
    maxWidth: 1280,
    paddingHorizontal: 24,
    paddingTop: 22,
    width: "100%"
  },
  workspaceNarrow: {
    flexDirection: "column"
  },
  formPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.lineQuiet,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 420,
    gap: 16,
    padding: 18
  },
  outputPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.lineQuiet,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 640,
    padding: 18
  },
  panelHeader: {
    borderBottomColor: colors.lineQuiet,
    borderBottomWidth: 1,
    gap: 5,
    paddingBottom: 14
  },
  panelTitle: {
    color: colors.bone,
    fontFamily: "Inter_700Bold",
    fontSize: 17
  },
  panelHint: {
    color: colors.boneDim,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  field: {
    flexBasis: 190,
    flexGrow: 1,
    gap: 7,
    minWidth: 0
  },
  label: {
    color: colors.boneDim,
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  inputWrap: {
    alignItems: "center",
    backgroundColor: "rgba(7,8,10,0.58)",
    borderColor: colors.lineQuiet,
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12
  },
  inputDisabled: {
    opacity: 0.48
  },
  input: {
    color: colors.bone,
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    minHeight: 42,
    outlineStyle: "none" as never,
    padding: 0
  },
  precisionGroup: {
    gap: 8
  },
  segmented: {
    backgroundColor: "rgba(7,8,10,0.54)",
    borderColor: colors.lineQuiet,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    padding: 4
  },
  segment: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    minHeight: 36,
    justifyContent: "center"
  },
  segmentSelected: {
    backgroundColor: colors.bone
  },
  segmentText: {
    color: colors.boneMuted,
    fontFamily: "Inter_700Bold",
    fontSize: 12
  },
  segmentTextSelected: {
    color: colors.black
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.bone,
    borderRadius: 7,
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 15
  },
  actionButtonSecondary: {
    backgroundColor: "rgba(244,238,228,0.08)",
    borderColor: colors.line,
    borderWidth: 1
  },
  actionButtonDisabled: {
    opacity: 0.55
  },
  actionButtonText: {
    color: colors.black,
    fontFamily: "Inter_700Bold",
    fontSize: 13
  },
  actionButtonTextSecondary: {
    color: colors.bone
  },
  notice: {
    alignItems: "flex-start",
    backgroundColor: "rgba(214,154,106,0.08)",
    borderColor: colors.line,
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12
  },
  noticeDanger: {
    backgroundColor: "rgba(242,167,160,0.09)",
    borderColor: "rgba(242,167,160,0.28)"
  },
  noticeSuccess: {
    backgroundColor: "rgba(187,211,199,0.08)",
    borderColor: "rgba(187,211,199,0.28)"
  },
  noticeCopy: {
    flex: 1,
    gap: 3
  },
  noticeTitle: {
    color: colors.bone,
    fontFamily: "Inter_700Bold",
    fontSize: 12
  },
  noticeBody: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18
  },
  tabBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 16
  },
  tabButton: {
    borderColor: colors.lineQuiet,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  tabButtonActive: {
    backgroundColor: colors.bone,
    borderColor: colors.bone
  },
  tabText: {
    color: colors.boneMuted,
    fontFamily: "Inter_700Bold",
    fontSize: 12
  },
  tabTextActive: {
    color: colors.black
  },
  resultStack: {
    gap: 14
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metric: {
    backgroundColor: "rgba(7,8,10,0.46)",
    borderColor: colors.lineQuiet,
    borderRadius: 7,
    borderWidth: 1,
    flexGrow: 1,
    flexBasis: 170,
    gap: 5,
    padding: 12
  },
  metricLabel: {
    color: colors.boneDim,
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  metricValue: {
    color: colors.bone,
    fontFamily: "Inter_700Bold",
    fontSize: 14
  },
  block: {
    backgroundColor: "rgba(7,8,10,0.34)",
    borderColor: colors.lineQuiet,
    borderRadius: 7,
    borderWidth: 1,
    gap: 10,
    padding: 14
  },
  blockTitle: {
    color: colors.copperSoft,
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  heroLine: {
    color: colors.bone,
    fontFamily: "Newsreader_500Medium",
    fontSize: 26,
    letterSpacing: 0,
    lineHeight: 31
  },
  body: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21
  },
  metaLine: {
    color: colors.boneDim,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 18
  },
  errorText: {
    color: colors.danger,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 19
  },
  bulletList: {
    gap: 6
  },
  bulletItem: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20
  },
  topicGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  topicCell: {
    backgroundColor: "rgba(244,238,228,0.05)",
    borderColor: colors.lineQuiet,
    borderRadius: 7,
    borderWidth: 1,
    flexBasis: 220,
    flexGrow: 1,
    gap: 7,
    padding: 12
  },
  topicTitle: {
    color: colors.bone,
    fontFamily: "Inter_700Bold",
    fontSize: 14
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  featureCell: {
    backgroundColor: "rgba(244,238,228,0.045)",
    borderColor: colors.lineQuiet,
    borderRadius: 7,
    borderWidth: 1,
    flexBasis: 240,
    flexGrow: 1,
    gap: 8,
    padding: 12
  },
  featureTopline: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between"
  },
  featureId: {
    color: colors.copperSoft,
    fontFamily: "Inter_700Bold",
    fontSize: 11
  },
  statusPill: {
    borderColor: colors.lineQuiet,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  statusReady: {
    backgroundColor: "rgba(187,211,199,0.12)",
    borderColor: "rgba(187,211,199,0.34)"
  },
  statusStub: {
    backgroundColor: "rgba(214,154,106,0.11)",
    borderColor: "rgba(214,154,106,0.34)"
  },
  statusText: {
    color: colors.boneMuted,
    fontFamily: "Inter_700Bold",
    fontSize: 10
  },
  emptyPreview: {
    alignItems: "flex-start",
    gap: 14,
    paddingTop: 20
  },
  emptyTitle: {
    color: colors.bone,
    fontFamily: "Newsreader_500Medium",
    fontSize: 28
  },
  jsonBlock: {
    backgroundColor: "rgba(7,8,10,0.66)",
    borderColor: colors.lineQuiet,
    borderRadius: 7,
    borderWidth: 1,
    maxHeight: 340,
    padding: 12
  },
  jsonBlockCompact: {
    maxHeight: 220,
    width: "100%"
  },
  jsonText: {
    color: colors.blue,
    fontFamily: "Courier",
    fontSize: 12,
    lineHeight: 17
  }
});

export default OrbitaLab;
