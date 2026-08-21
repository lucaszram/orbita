import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAction, useQuery } from "convex/react";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { AstroGlyph } from "@/components/orbita/AstroGlyph";
import { ContentCanvas } from "@/components/orbita/ContentCanvas";
import { ReadingBlock } from "@/components/orbita/Layout";
import { usePressedState } from "@/components/v492/Touchable";
import { bodySymbolForName, type BodyGlyphKey } from "@/domain/astroSymbols";
import { GuestState } from "@/components/orbita/GuestState";
import { ErrorState, MinimalLoading } from "@/components/orbita/states";
import { sessionPhase } from "@/domain/screenPhase";
import {
  resetVoidInteraction,
  shouldGenerateVoidPrompts,
  VOID_NEW_QUESTION_LABEL,
  voidDailyLimitCopy,
  voidSuggestionsState
} from "@/domain/voidSession";
import {
  proposedApi,
  type VoidAnswerPayload,
  type VoidPromptCategory,
  type VoidTodayPayload
} from "@/services/appRefs";
import { VOID_CATEGORIES } from "@/content/voidPrompts";
import { orbita } from "@/theme/orbita";

const TEXTURE = require("../../../assets/orbita/optimized/core/orbita_daily_texture_b.jpg");
const DEFAULT_QUESTION = "¿Qué estás apurando?";

/**
 * Glifo de cada categoría, del catálogo vectorial propio. El `glyph` del
 * payload NO se presenta: es un string libre del backend y en web/Android un
 * carácter Unicode cae al font de emoji (ver `domain/astroGlyphs`). Para una
 * categoría desconocida se intenta por el label y se cae al Sol.
 */
const VOID_TAB_SYMBOL: Record<string, BodyGlyphKey> = {
  yo: "sun",
  amor: "venus",
  trabajo: "saturn",
  vinculos: "mercury"
};
const tabSymbol = (c: VoidPromptCategory): BodyGlyphKey =>
  VOID_TAB_SYMBOL[c.key] ?? bodySymbolForName(c.label) ?? "sun";

type Phase = "entrada" | "escuchando" | "respuesta";

type AskVoid = (args: { question: string }) => Promise<VoidAnswerPayload>;

type VoidViewProps = {
  ask: AskVoid;
  today: VoidTodayPayload | null;
  /** null mientras las sugeridas del día no están: la sección lo dice, la pantalla no espera. */
  categories: VoidPromptCategory[] | null;
  /** El camino de las sugeridas falló (la superficie para preguntar sigue viva). */
  suggestionsFailed: boolean;
  onRetrySuggestions: () => void;
  /** false cuando es raíz de tab (sin botón "volver"). */
  showBack: boolean;
};

/**
 * El Vacío — experiencia completa (entrada → escuchando → respuesta), reutilizada
 * por el tab `app/(tabs)/umbral/index.tsx` (showBack=false) y por la lectura web
 * `src/routes/v492/reading-void.web.tsx` (showBack=true; en nativo esa ruta
 * redirige al tab). Live con sesión (cupo + sugeridas personalizadas); invitado → estado honesto.
 *
 * ## Qué cambió con QA22 (bloque 1)
 *
 * - **La pantalla ya no espera al LLM** (QA22-001). El único gate a pantalla
 *   completa es `void.today`, una query de lectura. Las sugeridas llegan por
 *   `void.suggestedToday` (el set del día, sin generar) y, sólo si ese día
 *   todavía no tiene set, por la action que sí genera — con su carga y su error
 *   acotados a la sección, no a la pantalla.
 * - **`HACER OTRA PREGUNTA` en las cuatro superficies** (QA22-002): respuesta,
 *   error, espera y cupo agotado. Resetea la interacción, nunca la cuota.
 * - **El cupo agotado declara el estado concreto** (QA22-031).
 */
export function VoidExperience({ showBack = true }: { showBack?: boolean }) {
  const live = useLiveApp();
  const phase = sessionPhase(live);
  // Sin mocks: invitado confirmado → estado honesto; sesión resolviendo →
  // carga mínima; sesión rota → error real.
  if (phase === "cargando") {
    return (
      <VoidStateFrame>
        <MinimalLoading />
      </VoidStateFrame>
    );
  }
  if (phase === "error") {
    return (
      <VoidStateFrame>
        <ErrorState onRetry={live.retryUser} />
      </VoidStateFrame>
    );
  }
  if (phase === "invitado") {
    // Sin mocks: el Umbral responde leyendo TU carta — sin cuenta no hay
    // respuesta de maqueta presentada como personalizada.
    return (
      <VoidStateFrame>
        <GuestState
          eyebrow="EL UMBRAL"
          title={"El Umbral responde\ncon tu carta."}
          body="Tus preguntas se contestan leyendo tu carta natal y el cielo del día. Creá tu cuenta o entrá para cruzar."
        />
      </VoidStateFrame>
    );
  }
  return <VoidLive showBack={showBack} />;
}

/** Una pregunta sugerida de la lista. Es su propio componente porque el estado
 *  de "presionado" es un hook y la lista se arma con `map`. */
function PromptRow({ prompt, onPress }: { prompt: string; onPress: () => void }) {
  const { pressed, pressableProps } = usePressedState();
  return (
    <Pressable
      onPress={onPress}
      {...pressableProps}
      style={[styles.promptRow, pressed ? styles.pressed : null]}
      accessibilityRole="button"
    >
      <Text style={styles.promptText}>{prompt}</Text>
    </Pressable>
  );
}

/**
 * Control fantasma del Umbral. Es su propio componente porque el estado de
 * "presionado" es un hook y estos controles aparecen en cuatro superficies
 * distintas (QA22-002: la salida tiene que estar en todas).
 */
function GhostCta({ label, onPress }: { label: string; onPress: () => void }) {
  const { pressed, pressableProps } = usePressedState();
  return (
    <Pressable
      onPress={onPress}
      {...pressableProps}
      style={[styles.ghostCta, pressed ? styles.pressed : null]}
      accessibilityRole="button"
    >
      <Text style={styles.ghostCtaText}>{label}</Text>
    </Pressable>
  );
}

/**
 * La carga de las sugeridas, ACOTADA a su sección.
 *
 * Antes esto era la pantalla entera y tapaba el campo para preguntar y el
 * contador de cupo, que no dependen del LLM (QA22-001). El texto dice qué se
 * está esperando, no "cargando tu cielo".
 */
function SuggestionsLoading() {
  return (
    <View style={styles.suggestionsState}>
      <ActivityIndicator color={orbita.colors.copper} />
      <Text style={styles.microMono}>BUSCANDO TUS PREGUNTAS DE HOY</Text>
    </View>
  );
}

/** El error de las sugeridas también es local: preguntar sigue disponible. */
function SuggestionsError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.suggestionsState}>
      <Text style={styles.microMono}>No pudimos traer tus preguntas de hoy.{"\n"}Podés escribir la tuya igual.</Text>
      <GhostCta label="REINTENTAR" onPress={onRetry} />
    </View>
  );
}

/** Marco mínimo (fondo Órbita) para los estados de carga/error del Umbral. */
function VoidStateFrame({ children }: { children: ReactNode }) {
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {children}
    </View>
  );
}

function VoidLive({ showBack }: { showBack: boolean }) {
  const ask = useAction(proposedApi.voidAsk);
  const today = useQuery(proposedApi.voidToday, {});
  // Query reactiva: el set del día que YA está cacheado. No dispara el LLM, así
  // que una entrada "caliente" dibuja las sugeridas reales de inmediato
  // (QA22-001 pide explícitamente no invalidar esa mejora).
  const cached = useQuery(proposedApi.voidSuggestedToday, {});
  const suggested = useAction(proposedApi.voidSuggested);
  // null = todavía no hay set generado en esta sesión. Nunca las genéricas
  // mientras se espera: se pisarían delante del usuario.
  const [generated, setGenerated] = useState<VoidPromptCategory[] | null>(null);
  const [suggestedError, setSuggestedError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // La decisión de generar es pura y está probada aparte: sin saber (query en
  // vuelo) no se dispara, con el set del día tampoco, y una sola vez por sesión.
  const generar = shouldGenerateVoidPrompts({ cached, generated: generated !== null });

  useEffect(() => {
    if (!generar) return;
    let alive = true;
    setSuggestedError(false);
    suggested({})
      .then((r) => {
        if (!alive) return;
        // Éxito sin personalizadas: las genéricas son contenido curado válido
        // (no se presentan como personalizadas).
        setGenerated(r?.categories?.length ? r.categories : VOID_CATEGORIES);
      })
      .catch(() => {
        if (alive) setSuggestedError(true);
      });
    return () => {
      alive = false;
    };
  }, [generar, suggested, attempt]);

  // Lo generado en esta sesión MANDA sobre lo que publique la query después: la
  // action persiste el set, y sin esta precedencia las pestañas cambiarían solas
  // al volver el mismo contenido por otro camino.
  const categories = generated ?? (cached?.categories?.length ? cached.categories : null);

  // Único gate a pantalla completa: el cupo del día. Es una query de lectura,
  // no la action del LLM — así el contador no arranca en un default que después
  // se pisa, y la superficie para preguntar aparece apenas se sabe la cuota.
  if (today === undefined) {
    return (
      <VoidStateFrame>
        <MinimalLoading />
      </VoidStateFrame>
    );
  }

  return (
    <VoidView
      ask={ask}
      today={today}
      categories={categories}
      suggestionsFailed={suggestedError}
      onRetrySuggestions={() => {
        setSuggestedError(false);
        setAttempt((a) => a + 1);
      }}
      showBack={showBack}
    />
  );
}

function VoidView({ ask, today, categories, suggestionsFailed, onRetrySuggestions, showBack }: VoidViewProps) {
  const insets = useSafeAreaInsets();
  const fontsLoaded = useOrbitaFonts();
  const [phase, setPhase] = useState<Phase>("entrada");
  const [typed, setTyped] = useState("");
  // null = todavía no se eligió categoría: la primera del set manda. No se
  // siembra con una clave inventada, porque las categorías llegan después.
  const [category, setCategory] = useState<string | null>(null);
  const [payload, setPayload] = useState<VoidAnswerPayload | null>(null);
  const [locked, setLocked] = useState(false);
  // La action real falló (solo puede pasar con sesión): respuesta = error con
  // REINTENTAR, jamás el oráculo de maqueta como si fuera la respuesta.
  const [askFailed, setAskFailed] = useState(false);
  const pulse = useRef(new Animated.Value(0.4)).current;
  // El pulso late hasta que llega la respuesta: es la única animación de Órbita
  // que no termina sola, así que es la que la preferencia de menos movimiento
  // tiene que poder apagar.
  const reducedMotion = useReducedMotion();
  // El estado "presionado" vive acá, no en la forma función de `style`: en
  // nativo NativeWind descarta esa forma y el botón se dibuja sin su píldora.
  const askPress = usePressedState();

  const question = typed.trim() || DEFAULT_QUESTION;
  const suggestions = voidSuggestionsState({ categories, failed: suggestionsFailed });
  const activeCategory = categories?.find((c) => c.key === category) ?? categories?.[0] ?? null;
  const noneLeft = !!today && today.remaining <= 0;
  const counterLabel = today
    ? today.remaining > 0
      ? `TE QUEDAN ${today.remaining} DE ${today.limit} HOY`
      : "SIN PREGUNTAS POR HOY"
    : "3 PREGUNTAS POR DÍA";
  // El límite del día sale del backend (3 free / 5 pro); el default es el free,
  // que es el único que se puede afirmar sin la cuota.
  const dailyLimit = today?.limit ?? 3;

  // Manda una pregunta (tocada de la lista o escrita). Si no queda cupo, va
  // directo al estado de límite sin gastar una llamada.
  const askQuestion = (q: string) => {
    setTyped(q);
    setAskFailed(false);
    if (noneLeft) {
      setLocked(true);
      setPhase("respuesta");
      return;
    }
    setLocked(false);
    setPhase("escuchando");
  };
  // Volver al selector (QA22-002). Limpia SÓLO la interacción actual: la cuota
  // no se toca acá ni en ningún lado del cliente — la publica `void.today`, que
  // es reactiva. Si había una respuesta en vuelo, el efecto la descarta al
  // desmontar su fase.
  const resetInteraction = () => {
    const inicial = resetVoidInteraction<VoidAnswerPayload>();
    setPhase(inicial.phase);
    setTyped(inicial.typed);
    setPayload(inicial.payload);
    setLocked(inicial.locked);
    setAskFailed(inicial.askFailed);
  };
  // Respuesta a mostrar: SIEMPRE la real del backend (un fallo cae en
  // askFailed; el invitado ni llega a esta vista).
  const shownQuestion = payload?.question ?? question;
  const shownBasadoEn = payload ? `BASADO EN\n${payload.basadoEn.join("\n")}` : "";

  useEffect(() => {
    if (phase !== "escuchando") return;
    // Con la preferencia activa el punto queda encendido y quieto: la espera se
    // sigue leyendo (el texto lo dice) sin un latido que no se pidió.
    const loop = reducedMotion
      ? null
      : Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 0.4, duration: 900, useNativeDriver: true })
          ])
        );
    if (loop) loop.start();
    else pulse.setValue(1);
    let cancelled = false;

    // Respuesta real; si la action falla → estado de error real con reintento.
    ask({ question })
      .then((res) => {
        if (cancelled) return;
        setLocked(!!res.locked);
        setPayload(res.locked ? null : res);
        setPhase("respuesta");
      })
      .catch(() => {
        if (cancelled) return;
        setLocked(false);
        setPayload(null);
        setAskFailed(true);
        setPhase("respuesta");
      });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [phase, pulse, ask, question, reducedMotion]);

  if (!fontsLoaded) return <View style={styles.screen} />;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Image source={TEXTURE} style={styles.bg} resizeMode="cover" />
      <LinearGradient
        colors={["rgba(10,11,14,0.3)", "rgba(10,11,14,0.55)", "rgba(10,11,14,0.82)"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {showBack && phase !== "escuchando" ? (
        <View style={{ paddingTop: insets.top + orbita.spacing.sm }}>
          {/* La barra es chrome del Umbral: acompaña a la superficie entera, no
              a la columna de lectura. */}
          <ContentCanvas variant="immersive">
            <View style={styles.topbar}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Volver"
                // 44px reales: `hitSlop` no existe en web.
                style={styles.backBtn}
              >
                <Text style={styles.back}>←</Text>
              </Pressable>
            </View>
          </ContentCanvas>
        </View>
      ) : (
        <View style={{ paddingTop: insets.top + orbita.spacing.xl }} />
      )}

      {phase === "entrada" ? (
        <ContentCanvas variant="immersive" fill>
        <ReadingBlock fill center>
        <View style={styles.entrada}>
          <View style={styles.entradaHead}>
            <Text style={styles.eyebrow}>EL UMBRAL</Text>
            <Text style={styles.tagline}>Cruzá con una pregunta.</Text>
            <Text style={[styles.microMono, noneLeft && styles.microMonoCopper]}>{counterLabel}</Text>
          </View>

          {/* Las sugeridas son una SECCIÓN, no la pantalla: su carga y su error
              viven acá adentro y no tapan ni el contador de arriba ni la barra
              de preguntar de abajo (QA22-001). O están las del día, o está el
              estado — nunca categorías genéricas que después cambien. */}
          {suggestions === "listas" && categories && activeCategory ? (
            <>
              <View style={styles.tabs}>
                {categories.map((c) => {
                  const active = c.key === activeCategory.key;
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => setCategory(c.key)}
                      hitSlop={8}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      style={styles.tab}
                    >
                      <View style={[styles.tabGlyphBox, active && styles.tabGlyphBoxActive]}>
                        <AstroGlyph
                          symbol={tabSymbol(c)}
                          size={20}
                          color={active ? orbita.colors.bone : orbita.colors.muted}
                        />
                      </View>
                      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{c.label.toUpperCase()}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <ScrollView
                style={styles.prompts}
                contentContainerStyle={styles.promptsContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {activeCategory.prompts.map((p) => (
                  <PromptRow key={p} prompt={p} onPress={() => askQuestion(p)} />
                ))}
              </ScrollView>
            </>
          ) : suggestions === "error" ? (
            <SuggestionsError onRetry={onRetrySuggestions} />
          ) : (
            <SuggestionsLoading />
          )}

          <View style={[styles.askBar, { paddingBottom: insets.bottom + orbita.spacing.md }]}>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              placeholder="Preguntá lo que quieras"
              placeholderTextColor={orbita.colors.muted}
              // El placeholder no es una etiqueta: desaparece al tipear y un
              // lector de pantalla no tiene después qué anunciar.
              accessibilityLabel="Tu pregunta para el Umbral"
              style={styles.askInput}
              returnKeyType="send"
              onSubmitEditing={() => askQuestion(question)}
            />
            <Pressable
              onPress={() => askQuestion(question)}
              hitSlop={8}
              accessibilityRole="button"
              {...askPress.pressableProps}
              style={[styles.askBtn, askPress.pressed ? styles.pressed : null]}
            >
              <Text style={styles.askBtnText}>PREGUNTAR</Text>
            </Pressable>
          </View>
        </View>
        </ReadingBlock>
        </ContentCanvas>
      ) : null}

      {phase === "escuchando" ? (
        <ContentCanvas variant="immersive" fill>
        <ReadingBlock fill center>
        <View style={styles.center}>
          <View style={styles.listenZone}>
            <Animated.View style={[styles.ring, { opacity: pulse }]} />
            <Animated.View style={[styles.dot, { opacity: pulse }]} />
          </View>
          <View style={{ height: orbita.spacing.xxl * 2 }} />
          <Text style={styles.question}>“{question}”</Text>
          <View style={{ height: orbita.spacing.xl }} />
          <Text style={styles.eyebrow}>EL UMBRAL ESTÁ ESCUCHANDO</Text>
          {/* La salida también durante la espera (QA22-002): esperar no puede
              ser un estado del que no se pueda salir. */}
          <View style={{ height: orbita.spacing.xxl }} />
          <GhostCta label={VOID_NEW_QUESTION_LABEL} onPress={resetInteraction} />
        </View>
        </ReadingBlock>
        </ContentCanvas>
      ) : null}

      {phase === "respuesta" && locked ? (
        <ContentCanvas variant="immersive" fill>
        <ReadingBlock fill center>
        <View style={styles.center}>
          <Text style={styles.eyebrow}>EL UMBRAL · POR HOY</Text>
          <View style={{ height: orbita.spacing.xxl }} />
          {/* Primero el estado concreto, con el límite real del día (QA22-031).
              La frase editorial acompaña abajo; no reemplaza la explicación. */}
          <Text style={styles.answerBody}>{voidDailyLimitCopy(dailyLimit)}</Text>
          <View style={{ height: orbita.spacing.xl }} />
          <Text style={styles.microMono}>Una pregunta bien pensada{"\n"}rinde más que diez apuradas.</Text>
          <View style={{ height: orbita.spacing.xxl }} />
          <GhostCta label={VOID_NEW_QUESTION_LABEL} onPress={resetInteraction} />
          <View style={styles.footer}>
            <Text style={styles.footnote}>El Umbral no contesta sí o no.</Text>
          </View>
        </View>
        </ReadingBlock>
        </ContentCanvas>
      ) : phase === "respuesta" && askFailed ? (
        <ContentCanvas variant="immersive" fill>
        <ReadingBlock fill center>
        <View style={styles.center}>
          <Text style={styles.eyebrow}>EL UMBRAL</Text>
          <View style={{ height: orbita.spacing.xxl }} />
          <Text style={styles.answer}>El Umbral no{"\n"}pudo responder.</Text>
          <View style={{ height: orbita.spacing.xl }} />
          <Text style={styles.microMono}>Parece la conexión.{"\n"}Tu pregunta sigue acá.</Text>
          <View style={{ height: orbita.spacing.xxl }} />
          <GhostCta
            label="REINTENTAR"
            onPress={() => {
              setAskFailed(false);
              setPhase("escuchando");
            }}
          />
          {/* Reintentar la MISMA pregunta y volver al selector son dos salidas
              distintas, y el error necesita las dos (QA22-002). */}
          <View style={{ height: orbita.spacing.lg }} />
          <GhostCta label={VOID_NEW_QUESTION_LABEL} onPress={resetInteraction} />
        </View>
        </ReadingBlock>
        </ContentCanvas>
      ) : phase === "respuesta" ? (
        <ScrollView
          style={styles.answerScroll}
          contentContainerStyle={[
            styles.answerScrollContent,
            { paddingBottom: insets.bottom + orbita.spacing.xxl * 3 }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* El párrafo más largo de la app: el lienzo es inmersivo pero el
              texto queda acotado al ancho de LECTURA, y CENTRADO — el fondo es
              full-bleed y acá no hay composición a la que alinearse, así que
              pegado a la izquierda quedaba amontonado en un rincón. */}
          <ContentCanvas variant="immersive">
          <ReadingBlock center>
          <View style={styles.answerColumn}>
          <Text style={styles.eyebrow}>EL UMBRAL · HOY</Text>
          <View style={{ height: orbita.spacing.sm }} />
          <Text style={styles.questionSmall}>“{shownQuestion}”</Text>
          <View style={{ height: orbita.spacing.xxl * 1.5 }} />
          <Text style={styles.answerBody}>{payload?.answer}</Text>
          <View style={{ height: orbita.spacing.xxl * 1.5 }} />
          <View style={styles.tick} />
          <View style={{ height: orbita.spacing.xl }} />
          <Text style={styles.microMono}>{shownBasadoEn}</Text>
          <View style={{ height: orbita.spacing.xxl }} />
          <Text style={styles.microMonoCopper}>UNA MEJOR PREGUNTA</Text>
          <View style={{ height: orbita.spacing.sm }} />
          <Text style={styles.betterQuestion}>{payload?.mejorPregunta}</Text>
          <View style={{ height: orbita.spacing.xxl }} />
          <Text style={styles.microMono}>{payload?.paso}</Text>
          <View style={{ height: orbita.spacing.xxl }} />
          {/* El defecto exacto de QA22-002: la respuesta no ofrecía ninguna
              acción visible para volver al selector y se quedaba puesta al
              cambiar de pestaña y volver. */}
          <GhostCta label={VOID_NEW_QUESTION_LABEL} onPress={resetInteraction} />
          <View style={{ height: orbita.spacing.xxl }} />
          <Text style={styles.footnote}>El Umbral no contesta sí o no.</Text>
          </View>
          </ReadingBlock>
          </ContentCanvas>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: orbita.colors.background, flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject, height: "100%", opacity: 0.5, width: "100%" },
  topbar: { paddingHorizontal: orbita.spacing.gutter, paddingBottom: orbita.spacing.md },
  backBtn: { alignItems: "flex-start", justifyContent: "center", minHeight: 44, minWidth: 44 },
  back: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 26, width: 40 },
  center: { alignItems: "center", flex: 1, paddingHorizontal: orbita.spacing.gutter, paddingTop: orbita.spacing.xxl * 2 },
  answerScroll: { flex: 1 },
  answerScrollContent: { flexGrow: 1, paddingTop: orbita.spacing.xxl * 2 },
  // La respuesta es el párrafo más largo de la app: sin la columna acotada,
  // en escritorio se leía a lo ancho de la ventana.
  answerColumn: { alignItems: "center", paddingHorizontal: orbita.spacing.gutter },

  eyebrow: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 12,
    letterSpacing: 2.5,
    textAlign: "center"
  },
  microMono: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.5,
    lineHeight: 18,
    textAlign: "center"
  },
  microMonoCopper: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 2,
    textAlign: "center"
  },
  ghostCta: {
    alignItems: "center",
    borderColor: "rgba(244,238,228,0.35)",
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 220
  },
  ghostCtaText: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 12, letterSpacing: 2 },
  pressed: { opacity: 0.6 },

  listenZone: { alignItems: "center", height: 180, justifyContent: "center", marginTop: orbita.spacing.xxl * 2, width: 180 },
  ring: {
    borderColor: "rgba(244,238,228,0.18)",
    borderRadius: 70,
    borderWidth: 1,
    height: 140,
    position: "absolute",
    width: 140
  },
  dot: {
    backgroundColor: orbita.colors.bone,
    borderRadius: 5,
    height: 10,
    shadowColor: orbita.colors.copper,
    shadowOpacity: 0.9,
    shadowRadius: 18,
    width: 10
  },
  question: { color: orbita.colors.bone, fontFamily: orbita.fonts.serifRegular, fontSize: 22, textAlign: "center" },
  questionSmall: { color: orbita.colors.muted, fontFamily: orbita.fonts.serifRegular, fontSize: 16, textAlign: "center" },
  answer: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.serif,
    fontSize: 34,
    lineHeight: 40,
    textAlign: "center"
  },
  // Respuesta real (párrafo largo): tamaño de lectura, no de titular.
  answerBody: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.serifRegular,
    fontSize: 20,
    lineHeight: 29,
    textAlign: "center"
  },
  tick: { backgroundColor: "rgba(196,106,58,0.7)", height: 1, width: 24 },
  betterQuestion: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 22, textAlign: "center" },
  footer: { alignItems: "center", bottom: 0, left: 0, paddingBottom: 48, position: "absolute", right: 0 },
  footnote: {
    color: orbita.colors.mutedDim,
    fontFamily: orbita.fonts.body,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center"
  },

  // Fase entrada (estructura tipo Void de Co-Star, en estilo Órbita).
  entrada: { flex: 1, paddingHorizontal: orbita.spacing.gutter },
  entradaHead: { alignItems: "center", gap: orbita.spacing.sm, paddingBottom: orbita.spacing.xl, paddingTop: orbita.spacing.md },
  tagline: { color: orbita.colors.bone, fontFamily: orbita.fonts.serifRegular, fontSize: 20, textAlign: "center" },
  tabs: { flexDirection: "row", justifyContent: "space-between", paddingBottom: orbita.spacing.xl, paddingHorizontal: orbita.spacing.sm },
  tab: { alignItems: "center", flex: 1, gap: orbita.spacing.sm },
  tabGlyphBox: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 10,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  tabGlyphBoxActive: { borderColor: "rgba(244,238,228,0.35)" },
  tabGlyph: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 20 },
  tabGlyphActive: { color: orbita.colors.bone },
  tabLabel: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.monoMedium, fontSize: 10, letterSpacing: 1.5 },
  tabLabelActive: { color: orbita.colors.copper },

  prompts: { flex: 1 },
  // La carga y el error de las sugeridas ocupan el mismo hueco que las
  // pestañas + la lista: la barra de preguntar no se mueve entre estados.
  suggestionsState: {
    alignItems: "center",
    flex: 1,
    gap: orbita.spacing.xl,
    justifyContent: "center",
    paddingVertical: orbita.spacing.xl
  },
  promptsContent: { alignItems: "center", gap: orbita.spacing.xxl, paddingVertical: orbita.spacing.xl },
  promptRow: { paddingVertical: orbita.spacing.sm },
  promptText: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 14,
    letterSpacing: 0.5,
    lineHeight: 22,
    textAlign: "center",
    textDecorationLine: "underline"
  },

  askBar: {
    alignItems: "center",
    borderTopColor: orbita.colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: orbita.spacing.md,
    paddingTop: orbita.spacing.md
  },
  // `minWidth: 0`: en web un item flex no baja de su ancho intrínseco
  // (min-width:auto), así que a 320 el input no encogía y empujaba el botón
  // PREGUNTAR fuera de la pantalla. En nativo el flex ya encoge sin esto.
  askInput: {
    color: orbita.colors.bone,
    flex: 1,
    fontFamily: orbita.fonts.serifRegular,
    fontSize: 18,
    minWidth: 0,
    paddingVertical: orbita.spacing.sm
  },
  askBtn: {
    borderColor: "rgba(244,238,228,0.35)",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: orbita.spacing.lg,
    paddingVertical: orbita.spacing.sm
  },
  askBtnText: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 12, letterSpacing: 1.5 }
});
