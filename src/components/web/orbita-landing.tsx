import { useRef } from "react";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  Image,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { CARD_BACK, cardById, TAROT_DECK, type TarotDeckCard } from "@/content/tarotDeck";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { entryBackground } from "@/onboarding/entryBackground";

const colors = {
  black: "#07080A",
  charcoal: "#0D0E12",
  copper: "#C46A3A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  boneMuted: "rgba(244, 238, 228, 0.72)",
  boneDim: "rgba(244, 238, 228, 0.5)",
  line: "rgba(214, 154, 106, 0.25)",
  hairline: "rgba(244, 238, 228, 0.12)",
  panel: "rgba(15, 17, 22, 0.76)"
};

/**
 * El emblema REAL de la app (la misma arte que firma el ícono de iOS), en su
 * derivado web de 192px. Mismo tratamiento que la barra de la app autenticada
 * (`web-nav.tsx`): cuadrado redondeado chico con hairline. Nunca un glifo
 * genérico de librería.
 */
const APP_ICON = require("../../../assets/orbita/optimized/brand/orbita_app_icon_web.png");

/**
 * La Luna (Arcano Mayor XVIII, id 18): la MISMA arte del mazo real de Órbita.
 * Su ilustración aparece UNA sola vez en la página, en la lectura editorial de
 * ejemplo — ni en el abanico del hero ni en la muestra del mazo.
 */
const LA_LUNA = cardById(18)!;

/** Relación de aspecto real de las cartas del mazo (603×900). */
const CARD_RATIO = 603 / 900;

/** El segundo dorso del mazo (el mandala). El de órbitas ya lo exporta el mazo. */
const CARD_BACK_MANDALA = require("../../../assets/orbita/optimized/tarot/orbita_card_back_mandala.jpg");

/** Carta real por `key` del catálogo: si falta, es un error de build, no un hueco. */
function byKey(key: string): TarotDeckCard {
  const card = TAROT_DECK.find((c) => c.key === key);
  if (!card) throw new Error(`carta faltante en el mazo: ${key}`);
  return card;
}

/**
 * Abanico del hero: cinco cartas REALES del mazo más los dos dorsos, en el
 * orden visual izquierda → derecha. La Luna no está a propósito: su arte queda
 * reservado para la lectura de ejemplo.
 */
const FAN: ReadonlyArray<{ key: string; source: TarotDeckCard["image"]; nombre: string }> = [
  { key: "back_mandala", source: CARD_BACK_MANDALA, nombre: "el dorso mandala" },
  { key: "major_17_la_estrella", source: byKey("major_17_la_estrella").image, nombre: "La Estrella" },
  { key: "major_01_el_mago", source: byKey("major_01_el_mago").image, nombre: "El Mago" },
  { key: "major_19_el_sol", source: byKey("major_19_el_sol").image, nombre: "El Sol" },
  { key: "cups_ace", source: byKey("cups_ace").image, nombre: "el As de Copas" },
  { key: "wands_queen", source: byKey("wands_queen").image, nombre: "la Reina de Bastos" },
  { key: "back_orbits", source: CARD_BACK, nombre: "el dorso de órbitas" }
];

const FAN_LABEL = `Abanico de cartas del mazo de Órbita: ${FAN.map((c) => c.nombre).join(", ")}.`;

/**
 * Muestra del mazo para la sección "El mazo de Órbita": dieciséis cartas que
 * cubren los Arcanos Mayores y los cuatro palos (dos por palo). El producto usa
 * el mazo COMPLETO de 78; esto es una vidriera, no el inventario.
 */
const MAZO_MUESTRA: ReadonlyArray<TarotDeckCard> = [
  "major_00_el_loco",
  "major_01_el_mago",
  "major_02_la_sacerdotisa",
  "major_03_la_emperatriz",
  "major_10_la_rueda",
  "major_17_la_estrella",
  "major_19_el_sol",
  "major_21_el_mundo",
  "wands_ace",
  "wands_king",
  "cups_ace",
  "cups_queen",
  "swords_ace",
  "swords_knight",
  "pentacles_ace",
  "pentacles_10"
].map(byKey);

type SectionKey = "carta-hoy" | "como-funciona" | "que-incluye";

const ANCHORS: Array<{ key: SectionKey; label: string }> = [
  { key: "como-funciona", label: "Cómo funciona" },
  { key: "carta-hoy", label: "Tu carta de hoy" },
  { key: "que-incluye", label: "Qué incluye" }
];

/**
 * Ritual de La Luna — versión abreviada FIEL del ritual aprobado (Figma
 * sección 14, nodo 727:127). Es contenido de MUESTRA editorial, hardcodeado a
 * propósito: la landing es pública y no puede pedir lecturas personalizadas.
 * La estructura es la canónica de `RitualReading`: esencia → SIGNIFICADO
 * GENERAL → EN TU DÍA → EL CONSEJO → cierre.
 */
const LA_LUNA_RITUAL = {
  esencia:
    "Que te salga La Luna —Arcano Mayor XVIII— es una invitación a explorar tu intuición: simboliza el mundo de los sueños, lo inconsciente y las verdades ocultas.",
  significadoGeneral: [
    ["Confusión y misterio", "no ves todo con claridad, como caminar de noche; hay incertidumbre."],
    ["Intuición", "no te guíes sólo por la lógica: seguí lo que sentís y tus corazonadas."],
    ["Miedos y sombras", "un llamado a mirar de frente los temores o lo que te genera ansiedad."]
  ],
  enTuDia:
    "En los vínculos, mirá lo que se dice a medias; en el trabajo, no cierres ni firmes sin tener toda la información; en lo creativo, tu sensibilidad está afinada como pocas veces.",
  consejo:
    "Confiá en tu intuición por encima del miedo. Hoy no es día de decisiones apuradas: observá y dejá que esa luz interior te oriente.",
  pregunta: "¿Querés leerla para algo puntual —el amor, una decisión, el trabajo?"
} as const;

const HOW_IT_WORKS: Array<[string, string, string]> = [
  [
    "01",
    "Tus datos de nacimiento",
    "Fecha, lugar y hora. Con eso queda dibujada tu carta natal: Sol, Luna, ascendente y casas."
  ],
  [
    "02",
    "Tu carta, como base",
    "Tu carta natal no cambia nunca: es el mapa sobre el que Órbita lee todo lo demás."
  ],
  [
    "03",
    "Contexto para tu día",
    "Cada día sacás una carta y Órbita la lee junto con los tránsitos del momento: qué significa para vos, hoy."
  ]
];

const INCLUDES: Array<[string, string]> = [
  ["Carta natal", "Sol, Luna, ascendente, casas y aspectos: tu mapa de base."],
  ["Tránsitos", "El cielo del momento, cruzado con tu carta y por área: amor, trabajo, vínculos y energía."],
  ["Carta del día", "Una carta del mazo de 78 con su lectura entera: significado, tu día y un consejo."],
  ["El Umbral", "Cuando la carta te deja pensando, preguntale a Órbita: responde leyendo tu carta y el cielo del día."],
  ["Diario", "Tus cartas y tus lecturas quedan guardadas para volver cuando quieras."]
];

/**
 * Copy de exhibición de Órbita Plus para la landing. Espeja los `BENEFITS` del
 * paywall (`orbita-paywall.tsx`) SIN importarlos: la superficie pública no
 * arrastra el módulo del paywall, y este PR no toca esa pantalla. Si la oferta
 * cambia, actualizar los dos lugares.
 */
const PLUS_BENEFITS: ReadonlyArray<string> = [
  "Tu carta natal completa: casas, aspectos y los siete capítulos de interpretación.",
  "La lectura diaria cruzada con tu carta, no sólo el clima general.",
  "Tránsitos por área: amor, trabajo, vínculos y energía.",
  "Cinco preguntas por día en El Umbral, en vez de tres.",
  "Tu Diario completo, sin límite de siete días."
];

const FREE_INCLUDES: ReadonlyArray<string> = [
  "El ritual diario entero: significado, tu día y un consejo.",
  "Tu tríada: Sol, Luna y ascendente.",
  "Tres preguntas por día en El Umbral.",
  "Tu Diario de los últimos siete días."
];

export function OrbitaLanding() {
  const { width } = useWindowDimensions();
  const isNarrow = width < 760;
  const fontsLoaded = useOrbitaFonts();
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Partial<Record<SectionKey, number>>>({});

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.copperSoft} />
      </View>
    );
  }

  // Anclas del header: las secciones son hijas directas del ScrollView, así que
  // su `layout.y` ya es la posición dentro del contenido.
  const rememberY = (key: SectionKey) => (e: LayoutChangeEvent) => {
    sectionY.current[key] = e.nativeEvent.layout.y;
  };
  const jumpTo = (key: SectionKey) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current[key] ?? 0) - 12), animated: true });
  };

  return (
    <View style={styles.root}>
      {/* Fondo orbital aprobado — los MISMOS derivados que la entrada del alta
          (`entryBackground`): panorámico 2560×1440 en escritorio, vertical
          1170×2532 en móvil. Queda fijo al viewport (el scroll vive en el
          ScrollView, no en el documento) y con `cover` se recorta según el
          viewport: nunca se estira. El scrim oscuro de arriba mantiene la
          legibilidad y hace que las secciones transicionen sin cortes. */}
      <Image
        source={entryBackground(!isNarrow)}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        importantForAccessibility="no-hide-descendants"
      />
      <View pointerEvents="none" style={styles.bgScrim} />
      <ScrollView
        ref={scrollRef}
        style={styles.page}
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
      >
      {/* ---------------------------------------------------------- header */}
      <View style={styles.nav}>
        <Link href="/" asChild>
          <Pressable style={styles.brand} accessibilityRole="link" accessibilityLabel="Órbita · Inicio">
            <View style={styles.markFrame}>
              <Image
                accessibilityLabel="Emblema de Órbita"
                source={APP_ICON}
                style={styles.mark}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.brandText}>Órbita</Text>
          </Pressable>
        </Link>
        {!isNarrow ? (
          <View style={styles.anchorRow}>
            {ANCHORS.map((a) => (
              <Pressable
                key={a.key}
                accessibilityRole="button"
                accessibilityLabel={`Ir a la sección ${a.label}`}
                onPress={() => jumpTo(a.key)}
                style={styles.anchorItem}
              >
                <Text style={styles.anchorText}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {/* La ÚNICA acción de cuenta de la página: no se repite en el hero. */}
        <Link href="/iniciar-sesion" asChild>
          <Pressable style={styles.navLink} accessibilityRole="link">
            <Text style={styles.navLinkText}>Ya tengo cuenta</Text>
          </Pressable>
        </Link>
      </View>

      {/* ------------------------------------------------------------ hero */}
      <View style={[styles.hero, isNarrow && styles.heroNarrow]}>
        <View style={[styles.heroInner, isNarrow ? styles.stack : styles.heroRow]}>
          <View style={[styles.heroCopy, isNarrow && styles.heroCopyNarrow]}>
            <Text selectable style={styles.eyebrow}>
              TU ASTRÓLOGA PERSONAL
            </Text>
            <Text
              selectable
              role="heading"
              aria-level={1}
              style={[styles.heroTitle, isNarrow && styles.heroTitleNarrow]}
            >
              Una carta para hoy. Contexto para todos los días.
            </Text>
            <Text selectable style={[styles.heroBody, isNarrow && styles.heroBodyNarrow]}>
              Sacá tu carta diaria y entendé qué significa para vos junto con tu carta natal y los
              tránsitos del momento.
            </Text>
            <View style={[styles.ctaRow, isNarrow && styles.ctaRowNarrow]}>
              <EmpezarCta stretch={isNarrow} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver una lectura de ejemplo"
                onPress={() => jumpTo("carta-hoy")}
                style={[styles.ctaGhost, isNarrow && styles.ctaStretch]}
              >
                <Text style={styles.ctaGhostText}>Ver una lectura</Text>
              </Pressable>
            </View>
            {/* La carta astral es fundacional, no un extra: queda dicho en el
                primer pantallazo. Va DEBAJO de los CTAs para que el primario no
                baje del primer viewport móvil. "Base" y la tríada a propósito:
                la carta natal completa (casas, aspectos, lectura) es Plus. */}
            <View style={styles.heroBase}>
              <Text selectable style={styles.heroBaseLabel}>
                TU CARTA ASTRAL BASE, INCLUIDA AL EMPEZAR
              </Text>
              <Text selectable style={styles.heroBaseBody}>
                Sol, Luna y ascendente: el mapa personal que da contexto a tu tarot diario y a
                los tránsitos.
              </Text>
            </View>
          </View>
          <View style={[styles.heroVisual, isNarrow && styles.heroVisualNarrow]}>
            {/* En móvil el abanico entra en el ancho de la columna (gutters de
                24); en escritorio se acota a su porción del hero para no
                aplastar la copy en anchos intermedios. */}
            <CardFan narrow={isNarrow} maxWidth={isNarrow ? width - 48 : Math.min(560, (width - 48) * 0.46)} />
            <Text selectable style={styles.cardCaption}>
              HOY · UNA CARTA DEL MAZO DE 78
            </Text>
          </View>
        </View>
      </View>

      {/* ------------------------------------------- ejemplo: Te salió La Luna */}
      <View id="tu-carta-de-hoy" onLayout={rememberY("carta-hoy")} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text selectable style={styles.eyebrow}>
            TU CARTA DE HOY
          </Text>
          <Text
            selectable
            role="heading"
            aria-level={2}
            style={[styles.sectionTitle, isNarrow && styles.sectionTitleNarrow]}
          >
            Te salió La Luna.
          </Text>
          <Text selectable style={styles.orientationTag}>
            SALIÓ AL DERECHO
          </Text>
        </View>

        <View style={[styles.exampleLayout, isNarrow && styles.stack]}>
          <View style={[styles.exampleArt, isNarrow && styles.exampleArtNarrow]}>
            <View style={[styles.cardFrame, styles.cardFrameExample]}>
              <Image
                accessibilityLabel="La Luna, ilustrada para el mazo de Órbita"
                source={LA_LUNA.image}
                style={styles.cardImg}
                resizeMode="cover"
              />
            </View>
          </View>

          {/* Orden canónico de `RitualReading`, con la copy aprobada del nodo 727:127. */}
          <View style={styles.exampleText}>
            <Text selectable style={styles.esencia}>
              {LA_LUNA_RITUAL.esencia}
            </Text>
            <View style={styles.ritualSection}>
              <Text selectable style={styles.ritualLabel}>
                SIGNIFICADO GENERAL
              </Text>
              {LA_LUNA_RITUAL.significadoGeneral.map(([titulo, texto]) => (
                <Text key={titulo} selectable style={styles.facet}>
                  <Text style={styles.facetTitulo}>{titulo}</Text>
                  {" — "}
                  {texto}
                </Text>
              ))}
            </View>
            <View style={styles.ritualSection}>
              <Text selectable style={styles.ritualLabel}>
                EN TU DÍA
              </Text>
              <Text selectable style={styles.ritualBody}>
                {LA_LUNA_RITUAL.enTuDia}
              </Text>
            </View>
            <View style={styles.ritualSection}>
              <Text selectable style={styles.ritualLabel}>
                EL CONSEJO
              </Text>
              <Text selectable style={styles.ritualBody}>
                {LA_LUNA_RITUAL.consejo}
              </Text>
            </View>
            <View style={styles.ritualClose}>
              <Text selectable style={styles.pregunta}>
                {LA_LUNA_RITUAL.pregunta}
              </Text>
              {/* Parte de la MUESTRA, no un control: en el producto este remate
                  abre El Umbral, que pide cuenta. */}
              <Text selectable style={styles.umbralHint}>
                PREGUNTALE AL UMBRAL ›
              </Text>
            </View>
          </View>
        </View>

        <Text selectable style={styles.exampleNote}>
          Un ejemplo del ritual diario. El tuyo se lee junto con tu carta natal y el cielo del día,
          como entretenimiento y autoconocimiento.
        </Text>
        <EmpezarCta stretch={isNarrow} />
      </View>

      {/* ------------------------------------------------ el mazo de Órbita */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text selectable style={styles.eyebrow}>
            EL MAZO
          </Text>
          <Text
            selectable
            role="heading"
            aria-level={2}
            style={[styles.sectionTitle, isNarrow && styles.sectionTitleNarrow]}
          >
            El mazo de Órbita.
          </Text>
          <Text selectable style={styles.mazoBody}>
            Órbita usa un mazo completo de 78 cartas, ilustrado para la app: los 22 Arcanos
            Mayores y los 56 Arcanos Menores de los cuatro palos — Bastos, Copas, Espadas y Oros.
            Estas son dieciséis.
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          accessibilityLabel="Dieciséis cartas del mazo de Órbita"
          contentContainerStyle={styles.mazoRow}
        >
          <View role="list" style={styles.mazoList}>
            {MAZO_MUESTRA.map((card) => (
              <View key={card.key} role="listitem" style={styles.mazoItem}>
                {/* La ilustración es decorativa: el nombre visible de abajo es
                    lo que lee un lector de pantalla, sin repetirse. */}
                <View style={[styles.cardFrame, styles.mazoCard]} importantForAccessibility="no-hide-descendants">
                  <Image source={card.image} style={styles.cardImg} resizeMode="cover" />
                </View>
                <Text selectable style={styles.mazoNombre}>
                  {card.nombre}
                </Text>
                <Text selectable style={styles.mazoMeta}>
                  {card.arcana === "major" ? `ARCANO MAYOR · ${card.roman}` : card.correspondencia.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* --------------------------------------------------- cómo funciona */}
      {/* La banda dibuja los hairlines a todo el ancho; adentro va la sección
          normal, alineada al mismo lienzo de 1180 que el resto. */}
      <View id="como-funciona" onLayout={rememberY("como-funciona")} style={styles.band}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text selectable style={styles.eyebrow}>
              CÓMO FUNCIONA
            </Text>
            <Text
              selectable
              role="heading"
              aria-level={2}
              style={[styles.sectionTitle, isNarrow && styles.sectionTitleNarrow]}
            >
              Todo se lee sobre tu carta.
            </Text>
          </View>
          <View style={[styles.stepsRow, isNarrow && styles.stack]}>
            {HOW_IT_WORKS.map(([num, title, body]) => (
              <View key={num} style={styles.step}>
                <Text selectable style={styles.stepNum}>
                  {num}
                </Text>
                <Text selectable role="heading" aria-level={3} style={styles.stepTitle}>
                  {title}
                </Text>
                <Text selectable style={styles.stepBody}>
                  {body}
                </Text>
              </View>
            ))}
          </View>
          <EmpezarCta stretch={isNarrow} />
        </View>
      </View>

      {/* ----------------------------------------------------- qué incluye */}
      <View id="que-incluye" onLayout={rememberY("que-incluye")} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text selectable style={styles.eyebrow}>
            QUÉ INCLUYE
          </Text>
          <Text
            selectable
            role="heading"
            aria-level={2}
            style={[styles.sectionTitle, isNarrow && styles.sectionTitleNarrow]}
          >
            Tu cielo, todos los días.
          </Text>
        </View>

        <View style={styles.moduleTable}>
          {INCLUDES.map(([label, value]) => (
            <View key={label} style={styles.moduleRow}>
              <Text selectable style={styles.moduleLabel}>
                {label.toUpperCase()}
              </Text>
              <Text selectable style={styles.moduleValue}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        {/* Gratis vs. Plus, sin precios: los montos viven en el backend y se
            muestran recién en el paywall de la cuenta. */}
        <View style={[styles.planRow, isNarrow && styles.stack]}>
          <View style={styles.planPanel}>
            <Text selectable style={styles.planTag}>
              GRATIS
            </Text>
            <Text selectable role="heading" aria-level={3} style={styles.planTitle}>
              La carta del día, todos los días.
            </Text>
            {FREE_INCLUDES.map((item) => (
              <Text key={item} selectable style={styles.planItem}>
                · {item}
              </Text>
            ))}
          </View>
          <View style={[styles.planPanel, styles.planPanelPlus]}>
            <Text selectable style={[styles.planTag, styles.planTagPlus]}>
              ÓRBITA PLUS
            </Text>
            <Text selectable role="heading" aria-level={3} style={styles.planTitle}>
              Las capas profundas, leídas desde tu carta.
            </Text>
            {PLUS_BENEFITS.map((item) => (
              <Text key={item} selectable style={styles.planItem}>
                · {item}
              </Text>
            ))}
          </View>
        </View>
        <Text selectable style={styles.planNote}>
          El ritual de la carta diaria es gratis y sigue siendo gratis: Plus desbloquea la lectura
          personalizada sobre tu carta.
        </Text>
      </View>

      {/* ------------------------------------------------------- cierre */}
      <View style={[styles.section, styles.finalSection]}>
        <Text selectable style={styles.eyebrow}>
          GRATIS PARA EMPEZAR
        </Text>
        <Text
          selectable
          role="heading"
          aria-level={2}
          style={[styles.sectionTitle, isNarrow && styles.sectionTitleNarrow, styles.finalTitle]}
        >
          Tu primera carta te espera.
        </Text>
        <Text selectable style={styles.finalBody}>
          Creá tu cuenta, cargá tu fecha, tu lugar y tu hora de nacimiento, y ya tenés tu carta
          natal y la carta de hoy.
        </Text>
        <EmpezarCta center stretch={isNarrow} />
      </View>

      {/* ------------------------------------------------------- footer */}
      <View style={styles.footer}>
        <Text selectable style={styles.footerBrand}>
          Órbita
        </Text>
        <Text selectable style={styles.footerText}>
          Entretenimiento, autoconocimiento y contexto diario.
        </Text>
        <View style={styles.footerLinks}>
          <FooterLink href="/privacy" label="Privacidad" />
          <FooterLink href="/terminos" label="Términos" />
          <FooterLink href="/support" label="Soporte" />
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

/**
 * Abanico del hero: las siete piezas de `FAN` (cinco cartas reales + los dos
 * dorsos) desplegadas en arco. Para accesibilidad es UNA imagen: el contenedor
 * lleva el nombre (`FAN_LABEL`) y las cartas individuales quedan ocultas del
 * árbol accesible — siete imágenes solapadas anunciadas una por una serían
 * ruido, no información.
 *
 * Los hijos absolutos sin `left/top` se alinean con el `alignItems` /
 * `justifyContent` del padre (Yoga): cada carta nace centrada abajo y se
 * despliega sólo con transforms, así el abanico queda simétrico a cualquier
 * ancho sin medir nada.
 */
function CardFan({ narrow, maxWidth }: { narrow: boolean; maxWidth: number }) {
  // El despliegue horizontal por carta es una fracción del ancho de carta; el
  // ancho de carta sale de cuánto lugar hay, con tope por breakpoint. Así el
  // abanico NUNCA desborda: a 320 se achica, a 1440 no se agranda de más.
  const SPREAD = 0.42;
  const cardW = Math.min(narrow ? 96 : 140, Math.floor((maxWidth - 28) / (1 + (FAN.length - 1) * SPREAD)));
  const cardH = Math.round(cardW / CARD_RATIO);
  const spread = Math.round(cardW * SPREAD);
  const lift = narrow ? 8 : 12;
  const mid = (FAN.length - 1) / 2;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={FAN_LABEL}
      style={{ height: cardH + lift * mid + 18, width: cardW + spread * (FAN.length - 1) + 28 }}
    >
      <View importantForAccessibility="no-hide-descendants" style={styles.fanStage}>
        {FAN.map((card, i) => {
          const c = i - mid;
          return (
            <View
              key={card.key}
              style={[
                styles.cardFrame,
                styles.fanCard,
                {
                  bottom: (mid - Math.abs(c)) * lift,
                  height: cardH,
                  transform: [{ translateX: c * spread }, { rotate: `${c * 7}deg` }],
                  width: cardW,
                  zIndex: 10 - Math.abs(c)
                }
              ]}
            >
              <Image source={card.source} style={styles.cardImg} resizeMode="cover" />
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * El único CTA de arranque de la página: SIEMPRE `/empezar`.
 *
 * `stretch` (móvil) gana sobre `center`; sin ninguno, el botón se ancla al
 * inicio para no estirarse al ancho de la sección (los hijos de un flex column
 * arrancan en `stretch`).
 */
function EmpezarCta({ stretch, center }: { stretch?: boolean; center?: boolean }) {
  return (
    <Link href="/empezar" asChild>
      {/* `StyleSheet.flatten` y no un array: `Link asChild` clona el hijo y el
          estilo termina en el <a> del DOM tal cual llegó. Un array ahí revienta
          React DOM ("Indexed property setter is not supported" sobre
          CSSStyleDeclaration) y la página queda negra. Mismo patrón que ya
          usaba esta landing antes de la reescritura. */}
      <Pressable
        accessibilityRole="link"
        style={StyleSheet.flatten([
          styles.ctaPrimary,
          center && styles.ctaCenter,
          stretch && styles.ctaStretch
        ])}
      >
        <Text style={styles.ctaPrimaryText}>Empezar gratis</Text>
      </Pressable>
    </Link>
  );
}

function FooterLink({ href, label }: { href: "/privacy" | "/terminos" | "/support"; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" style={styles.footerLink}>
        <Text style={styles.footerLinkText}>{label}</Text>
      </Pressable>
    </Link>
  );
}

export default OrbitaLanding;

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: colors.black,
    flex: 1,
    justifyContent: "center"
  },
  root: {
    // El negro de base queda DEBAJO de la imagen: si el fondo tarda un frame en
    // decodificar, no hay flash claro.
    backgroundColor: colors.black,
    flex: 1
  },
  bgScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7, 8, 10, 0.74)"
  },
  // El scroll es transparente: el fondo orbital fijo se ve a través de TODA la
  // landing, sin cortes de color entre secciones.
  page: {
    flex: 1
  },
  pageContent: {},
  stack: {
    flexDirection: "column"
  },

  // ------------------------------------------------------------- header
  nav: {
    alignItems: "center",
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 14,
    width: "100%"
  },
  brand: { alignItems: "center", flexDirection: "row", gap: 10, minHeight: 44 },
  markFrame: {
    borderColor: "rgba(244, 238, 228, 0.18)",
    borderRadius: 7,
    borderWidth: 1,
    height: 28,
    overflow: "hidden",
    width: 28
  },
  mark: { height: 26, width: 26 },
  brandText: { color: colors.bone, fontFamily: "Inter_700Bold", fontSize: 16 },
  anchorRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  anchorItem: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 10
  },
  anchorText: { color: colors.boneMuted, fontFamily: "Inter_500Medium", fontSize: 14 },
  navLink: {
    alignItems: "center",
    borderColor: "rgba(244, 238, 228, 0.18)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14
  },
  navLinkText: { color: colors.boneMuted, fontFamily: "Inter_500Medium", fontSize: 13 },

  // --------------------------------------------------------------- hero
  hero: {
    paddingHorizontal: 24,
    paddingVertical: 84
  },
  heroNarrow: {
    paddingVertical: 48
  },
  heroInner: {
    alignSelf: "center",
    maxWidth: 1180,
    width: "100%"
  },
  heroRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 64
  },
  heroCopy: {
    flex: 1,
    gap: 18,
    // En una fila flex el mínimo intrínseco no deja encoger la columna.
    minWidth: 0
  },
  heroCopyNarrow: {
    gap: 14
  },
  eyebrow: {
    color: colors.copperSoft,
    fontFamily: "RobotoMono_500Medium",
    fontSize: 12,
    letterSpacing: 1
  },
  heroTitle: {
    color: colors.bone,
    fontFamily: "Newsreader_500Medium",
    fontSize: 62,
    letterSpacing: 0,
    lineHeight: 68,
    maxWidth: 640
  },
  heroTitleNarrow: {
    fontSize: 38,
    lineHeight: 44
  },
  heroBody: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 19,
    lineHeight: 29,
    maxWidth: 560
  },
  heroBodyNarrow: {
    fontSize: 16,
    lineHeight: 25
  },
  ctaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 8
  },
  ctaRowNarrow: {
    alignItems: "stretch",
    flexDirection: "column"
  },
  ctaPrimary: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.copper,
    borderRadius: 27,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 28
  },
  ctaCenter: {
    alignSelf: "center"
  },
  ctaPrimaryText: {
    color: "#0B0C0F",
    fontFamily: "Inter_700Bold",
    fontSize: 16
  },
  ctaGhost: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: "rgba(244, 238, 228, 0.22)",
    borderRadius: 27,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 24
  },
  ctaGhostText: {
    color: colors.bone,
    fontFamily: "Inter_700Bold",
    fontSize: 15
  },
  ctaStretch: {
    alignSelf: "stretch"
  },
  // Línea de valor bajo los CTAs: hairline arriba y tipografías ya existentes
  // (mono cobre + Inter muted). Integrada a la columna de copy, no un panel.
  heroBase: {
    borderTopColor: colors.hairline,
    borderTopWidth: 1,
    gap: 6,
    marginTop: 6,
    maxWidth: 560,
    paddingTop: 14
  },
  heroBaseLabel: {
    color: colors.copperSoft,
    fontFamily: "RobotoMono_500Medium",
    fontSize: 11,
    letterSpacing: 1
  },
  heroBaseBody: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21
  },
  heroVisual: {
    alignItems: "center",
    gap: 14
  },
  heroVisualNarrow: {
    paddingTop: 36
  },
  cardFrame: {
    backgroundColor: colors.charcoal,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    // Sombra cobre suave: la carta es una pieza, no una foto pegada.
    shadowColor: colors.copper,
    shadowOpacity: 0.35,
    shadowRadius: 42
  },
  cardFrameWide: { width: 300 },
  cardFrameNarrow: { width: 210 },
  cardFrameExample: { width: 240 },
  cardImg: {
    aspectRatio: CARD_RATIO,
    height: undefined,
    width: "100%"
  },
  cardCaption: {
    color: colors.boneDim,
    fontFamily: "RobotoMono_500Medium",
    fontSize: 11,
    letterSpacing: 1
  },
  fanStage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  // Sin `left/top`: la carta nace centrada por el `alignItems` del escenario y
  // se despliega sólo con transforms.
  fanCard: {
    position: "absolute"
  },

  // ----------------------------------------------------------- secciones
  section: {
    alignSelf: "center",
    gap: 32,
    maxWidth: 1180,
    paddingHorizontal: 24,
    paddingVertical: 72,
    width: "100%"
  },
  band: {
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    borderTopColor: colors.hairline,
    borderTopWidth: 1,
    width: "100%"
  },
  sectionHeader: {
    alignSelf: "center",
    gap: 12,
    maxWidth: 1180,
    width: "100%"
  },
  sectionTitle: {
    color: colors.bone,
    fontFamily: "Newsreader_500Medium",
    fontSize: 46,
    letterSpacing: 0,
    lineHeight: 52,
    maxWidth: 720
  },
  sectionTitleNarrow: {
    fontSize: 32,
    lineHeight: 38
  },
  orientationTag: {
    color: colors.copper,
    fontFamily: "RobotoMono_500Medium",
    fontSize: 11,
    letterSpacing: 1
  },

  // ------------------------------------------------ ejemplo (La Luna)
  exampleLayout: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 56,
    maxWidth: 1180,
    width: "100%"
  },
  exampleArt: {
    alignItems: "flex-start"
  },
  exampleArtNarrow: {
    alignItems: "center"
  },
  exampleText: {
    flex: 1,
    minWidth: 0
  },
  esencia: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 25
  },
  ritualSection: { marginTop: 22 },
  ritualLabel: {
    color: colors.copper,
    fontFamily: "RobotoMono_500Medium",
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 8
  },
  facet: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 25,
    marginBottom: 8
  },
  facetTitulo: { color: colors.bone },
  ritualBody: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 25
  },
  ritualClose: {
    borderTopColor: colors.hairline,
    borderTopWidth: 1,
    marginTop: 26,
    paddingTop: 20
  },
  pregunta: {
    color: colors.bone,
    fontFamily: "Newsreader_500Medium",
    fontSize: 20,
    lineHeight: 28
  },
  umbralHint: {
    color: colors.copper,
    fontFamily: "RobotoMono_500Medium",
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 14
  },
  exampleNote: {
    color: colors.boneDim,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 560
  },

  // --------------------------------------------------- el mazo de Órbita
  mazoBody: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 25,
    maxWidth: 640
  },
  mazoRow: {
    paddingBottom: 14
  },
  mazoList: {
    flexDirection: "row",
    gap: 20
  },
  mazoItem: {
    gap: 8,
    width: 132
  },
  mazoCard: {
    width: 132
  },
  mazoNombre: {
    color: colors.bone,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4
  },
  mazoMeta: {
    color: colors.boneDim,
    fontFamily: "RobotoMono_500Medium",
    fontSize: 10,
    letterSpacing: 0.5
  },

  // ------------------------------------------------------ cómo funciona
  stepsRow: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 40,
    maxWidth: 1180,
    width: "100%"
  },
  step: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flex: 1,
    gap: 10,
    minWidth: 0,
    paddingTop: 18
  },
  stepNum: {
    color: colors.copperSoft,
    fontFamily: "RobotoMono_500Medium",
    fontSize: 12,
    letterSpacing: 1
  },
  stepTitle: {
    color: colors.bone,
    fontFamily: "Newsreader_500Medium",
    fontSize: 24,
    lineHeight: 30
  },
  stepBody: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 23
  },

  // -------------------------------------------------------- qué incluye
  moduleTable: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden"
  },
  moduleRow: {
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 16
  },
  moduleLabel: {
    color: colors.copperSoft,
    fontFamily: "RobotoMono_500Medium",
    fontSize: 11,
    letterSpacing: 1
  },
  moduleValue: {
    color: colors.bone,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22
  },
  planRow: {
    flexDirection: "row",
    gap: 14
  },
  planPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.hairline,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 10,
    minWidth: 0,
    padding: 22
  },
  planPanelPlus: {
    borderColor: colors.line
  },
  planTag: {
    color: colors.boneDim,
    fontFamily: "RobotoMono_500Medium",
    fontSize: 11,
    letterSpacing: 1
  },
  planTagPlus: {
    color: colors.copperSoft
  },
  planTitle: {
    color: colors.bone,
    fontFamily: "Newsreader_500Medium",
    fontSize: 22,
    lineHeight: 28
  },
  planItem: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22
  },
  planNote: {
    color: colors.boneDim,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 560
  },

  // ------------------------------------------------------------- cierre
  finalSection: {
    alignItems: "center",
    paddingBottom: 96
  },
  finalTitle: {
    textAlign: "center"
  },
  finalBody: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 25,
    maxWidth: 520,
    textAlign: "center"
  },

  // ------------------------------------------------------------- footer
  footer: {
    alignItems: "center",
    borderTopColor: colors.hairline,
    borderTopWidth: 1,
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 42
  },
  footerBrand: {
    color: colors.bone,
    fontFamily: "Newsreader_500Medium",
    fontSize: 28,
    letterSpacing: 0
  },
  footerText: {
    color: colors.boneMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 14
  },
  footerLinks: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    justifyContent: "center",
    paddingTop: 8
  },
  footerLink: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12
  },
  footerLinkText: {
    color: colors.boneMuted,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    textDecorationLine: "underline"
  }
});
