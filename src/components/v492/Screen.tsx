import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ContentCanvas } from "@/components/orbita/ContentCanvas";
import { Touchable } from "@/components/v492/Touchable";
import { Body, Eyebrow, Mono } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";

/**
 * Pantalla oscura del sistema V4.9.2.
 *
 * Fondo plano `#0A0B0E` (sin textura): las capas son datos y fechas, y la
 * imagen de fondo de las pantallas anteriores bajaba el contraste justo donde
 * hay más números.
 *
 * El encabezado es el del Figma y tiene tres piezas en dos líneas: la marca a la
 * izquierda, la fecha o el contexto a la derecha, y debajo el rótulo de sección.
 * NO lleva un titular gigante: "Hoy" o "Tránsitos" ya están en la barra de
 * pestañas, y repetirlos a 34 px se comía la primera pantalla entera sin agregar
 * un dato. `title` sigue en el contrato porque es el nombre de la pantalla:
 * ahora se dice donde sirve —la etiqueta de VoiceOver, que la barra de pestañas
 * no le da a quien ya está adentro—.
 *
 * El scroll trae "tirar para actualizar", que es el mismo camino que usa la app
 * al volver al frente.
 */
export function LayerScreen({
  eyebrow,
  title,
  meta,
  action,
  capas,
  pills,
  intro,
  children,
  onRefresh,
  refreshing = false,
  refreshHint
}: {
  eyebrow: string;
  /** Nombre de la pantalla. No se dibuja: acompaña a la marca para VoiceOver. */
  title: string;
  /** Contexto a la derecha de la marca (fecha civil, precisión de la carta…). */
  meta?: string;
  /**
   * Acción a la derecha de la marca, en el lugar de la meta (nunca ambas).
   *
   * Existe para el engranaje de ajustes de "Tu carta": la raíz de esa pestaña
   * necesita una salida hacia lo administrativo, y la fecha ahí era ruido — la
   * base natal es justamente lo que no se mueve. El caller trae su propio
   * Touchable con label; esta pantalla sólo le reserva el lugar.
   */
  action?: ReactNode;
  /**
   * Contador de capas a la derecha del rótulo (`4 CAPAS`, `2/3 CAPAS`, `BASE
   * NATAL`). Es del frame y dice, de un vistazo, cuántos cálculos sostienen la
   * pantalla — y cuántos faltan cuando falta un dato de nacimiento.
   */
  capas?: string;
  /** Píldoras de vista (Ahora · Tu momento), debajo de la marca. */
  pills?: ReactNode;
  /** Una a tres frases que explican qué es esta pantalla. */
  intro?: string;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /**
   * Cuándo se renuevan estos datos, dicho en el control que los renueva.
   *
   * El frame no imprime esta frase en ningún lado —y agregarle un párrafo a Hoy
   * sería justo la densidad de más que el canon evita—, pero la cadencia real de
   * la app es un dato que quien lee tiene derecho a conocer. Va como descripción
   * del gesto de "tirar para actualizar": lo anuncia VoiceOver al llegar al
   * control, y no ocupa un solo punto de alto.
   */
  refreshHint?: string;
}) {
  const insets = useSafeAreaInsets();
  const fontsLoaded = useOrbitaFonts();
  /**
   * El spinner del pull es LOCAL a esta pantalla.
   *
   * `refreshing` es el flag compartido del ciclo de capas: enchufado directo al
   * RefreshControl, un recálculo de fondo —volver al frente, cambio de hora
   * civil, reintento tras un fallo— dejaba a cualquier pestaña recién montada
   * con el control expandido y el contenido clavado hacia abajo hasta que el
   * recálculo terminara (defecto real, iPhone físico 2026-08-19). El control
   * refleja el GESTO; el refresco de fondo es invisible.
   *
   * `sawBusy`: el pull se libera cuando el ciclo baja DESPUÉS de haber estado
   * alto. Sin esto, si la cola tarda un render en marcar busy, el spinner se
   * apagaría en el acto y el gesto parpadearía.
   */
  const [pulled, setPulled] = useState(false);
  const sawBusy = useRef(false);
  useEffect(() => {
    if (!pulled) return;
    if (refreshing) {
      sawBusy.current = true;
      return;
    }
    if (sawBusy.current) {
      sawBusy.current = false;
      setPulled(false);
    }
  }, [pulled, refreshing]);
  if (!fontsLoaded) return <View style={styles.screen} />;
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + v492.space.lg,
          paddingBottom: insets.bottom + v492.space.xxl
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={pulled}
              onRefresh={() => {
                setPulled(true);
                onRefresh();
              }}
              accessibilityLabel="Actualizar estos datos"
              accessibilityHint={refreshHint}
              tintColor={v492.colors.copper}
              colors={[v492.colors.copper]}
              progressBackgroundColor={v492.colors.surface}
            />
          ) : undefined
        }
      >
        {/* Misma columna de lectura que el resto del producto: en un teléfono
            ningún tope se alcanza, así que no cambia nada acá, y evita que esta
            familia de pantallas sea la excepción que se olvida del lienzo. */}
        <ContentCanvas variant="reading">
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Text
                style={styles.brand}
                accessibilityLabel={`Órbita · ${title}`}
                maxFontSizeMultiplier={v492.type.subtitle.maxScale}
              >
                Órbita
              </Text>
              {action ? (
                <View style={styles.headerAction}>{action}</View>
              ) : meta ? (
                <Mono style={styles.headerMeta}>{meta}</Mono>
              ) : null}
            </View>
            {pills ? <View style={styles.pillsRow}>{pills}</View> : null}
            <View
              accessible
              accessibilityRole="header"
              accessibilityLabel={capas ? `${eyebrow}. ${capas}.` : eyebrow}
              style={styles.eyebrowRow}
            >
              <Eyebrow style={styles.eyebrowText}>{eyebrow}</Eyebrow>
              {capas ? <Mono style={styles.capas}>{capas}</Mono> : null}
            </View>
            {intro ? <Body style={styles.intro}>{intro}</Body> : null}
          </View>
          {children}
        </ContentCanvas>
      </ScrollView>
    </View>
  );
}

/**
 * Pantalla de detalle: misma base oscura con un "volver" real de 44×44 y el
 * rótulo del módulo que abrió el detalle.
 */
export function DetailLayerScreen({
  eyebrow,
  children,
  fallbackHref = "/hoy",
  keyboardAware = false,
  eyebrowLines
}: {
  eyebrow: string;
  children: ReactNode;
  /**
   * Tope de líneas del rótulo. Los detalles de una capa tienen un rótulo fijo y
   * corto; los que llevan un dato de la persona adentro —`VOS Y …`— lo fijan en
   * una para que un nombre largo se recorte con puntos suspensivos en vez de
   * partir el encabezado en dos, que fue una de las diferencias registradas
   * contra el frame. El nombre completo siempre está en el cuerpo.
   */
  eyebrowLines?: number;
  /** Destino si no hay historial (entrada por deep link). */
  fallbackHref?: string;
  /**
   * El detalle contiene un formulario. Cambia dos cosas y sólo para quien lo
   * pide: el contenido esquiva el teclado en iOS, y un toque sobre una opción
   * de la pantalla la elige aunque el teclado esté abierto —sin esto, el primer
   * toque sólo cierra el teclado y el resultado del buscador no se selecciona—.
   */
  keyboardAware?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const fontsLoaded = useOrbitaFonts();
  if (!fontsLoaded) return <View style={styles.screen} />;
  const scroll = (
    <ScrollView
      contentContainerStyle={{ paddingBottom: insets.bottom + v492.space.xxl }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps={keyboardAware ? "handled" : "never"}
      keyboardDismissMode={keyboardAware ? "on-drag" : "none"}
    >
      <ContentCanvas variant="reading">{children}</ContentCanvas>
    </ScrollView>
  );
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ContentCanvas variant="reading">
        <View style={[styles.detailBar, { paddingTop: insets.top + v492.space.sm }]}>
          <Touchable
            onPress={() => (router.canGoBack() ? router.back() : router.replace(fallbackHref as never))}
            accessibilityLabel="Volver"
            hitSlop={8}
            style={styles.back}
            pressedStyle={styles.pressed}
          >
            <Text style={styles.backGlyph} allowFontScaling={false}>
              ←
            </Text>
          </Touchable>
          <Eyebrow style={styles.detailEyebrow} numberOfLines={eyebrowLines}>
            {eyebrow}
          </Eyebrow>
          <View style={styles.backSpacer} />
        </View>
      </ContentCanvas>
      {keyboardAware ? (
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {scroll}
        </KeyboardAvoidingView>
      ) : (
        scroll
      )}
    </View>
  );
}

/** Bloque con las gutters de 24 de la retícula. */
export function Section({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.section, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  back: {
    alignItems: "flex-start",
    height: v492.touch,
    justifyContent: "center",
    width: v492.touch
  },
  backGlyph: { color: v492.colors.text, fontFamily: v492.fonts.body, fontSize: 24 },
  backSpacer: { width: v492.touch },
  brand: {
    color: v492.colors.text,
    fontFamily: v492.fonts.serif,
    fontSize: v492.type.subtitle.size,
    lineHeight: v492.type.subtitle.line
  },
  // `baseline` alinea la marca serif con la fecha mono por su línea de escritura
  // y no por su caja, que es lo que hace que se lean como una sola línea.
  brandRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: v492.space.md,
    justifyContent: "space-between"
  },
  detailBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: v492.space.sm,
    paddingHorizontal: v492.space.gutter
  },
  capas: { color: v492.colors.textDim, flexShrink: 0, textAlign: "right" },
  detailEyebrow: { flex: 1, textAlign: "center" },
  eyebrowRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: v492.space.md,
    justifyContent: "space-between",
    marginTop: v492.space.lg
  },
  eyebrowText: { flexShrink: 1 },
  header: { paddingHorizontal: v492.space.gutter, paddingBottom: v492.space.lg },
  // El slot de acción mide 44×44 (v492.touch) pero la fila de la marca alinea
  // por baseline: el margen vertical negativo absorbe el alto extra para que el
  // header no crezca cuando hay engranaje en vez de fecha.
  headerAction: {
    alignItems: "flex-end",
    height: v492.touch,
    justifyContent: "center",
    marginVertical: -((v492.touch - 40) / 2),
    width: v492.touch
  },
  headerMeta: { flexShrink: 1, textAlign: "right" },
  intro: { marginTop: v492.space.md },
  pillsRow: { marginTop: v492.space.lg },
  pressed: { opacity: 0.6 },
  screen: { backgroundColor: v492.colors.background, flex: 1 },
  section: { paddingHorizontal: v492.space.gutter }
});
