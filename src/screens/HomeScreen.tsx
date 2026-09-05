/**
 * **Hoy** — la sección canónica de Órbita, la misma en nativo y en web.
 *
 * La jerarquía es la de los frames vigentes (Build 30 `1688:109` / `1688:112`
 * / `1688:115` / `1720:2050` para contenido y jerarquía; WEB V1 `1718:2136` /
 * `1991:2775` / `1718:1997` / `1718:2052` para la composición): cuatro
 * módulos, con la síntesis arriba sin número y tres bloques numerados.
 *
 *     HOY · LO ACTIVO AHORA   ·   SÁBADO 5 DE SEPTIEMBRE · 4 CAPAS
 *     LO PRINCIPAL HOY             ← la frase del día y su contacto
 *     01 RANKING DE TRÁNSITOS
 *     02 LA LUNA EN TU CARTA
 *     03 CUMPLELUNA
 *
 * Cuando el Cumpleluna cae hoy —o puede caer hoy— sube a la posición 01 y los
 * otros dos corren: el frame numera lo que se ve, en el orden en que se ve. En
 * escritorio, WEB V1 acompaña la columna de lectura con dos tarjetas —las
 * cuatro capas y «Tu momento»— más la ficha del cálculo.
 *
 * ## De dónde sale cada cosa (cero maqueta)
 *
 * - `LO PRINCIPAL` y `RANKING` salen de `daily.getGuide`, la misma generación
 *   que ya alimentaba la Home (`services/dailyGuideStore`). Esa acción contesta
 *   primero con un payload genérico marcado `enrichment.status: "pending"` y
 *   recién después con la lectura real: el genérico se trata como carga, nunca
 *   como dato, y la sección vuelve a consultar hasta que deje de estar
 *   pendiente (`guiaPendiente`).
 * - `LA LUNA EN TU CARTA` y `CUMPLELUNA` salen de `home.getLunaSobreLaCarta`
 *   (CORE-192) por `services/lunaCartaStore`.
 * - El día lo decide el SERVIDOR (`useCanonicalLocalDate`); el reloj del
 *   dispositivo no participa en ninguna decisión de esta pantalla.
 *
 * Las dos fuentes cargan, fallan y se reintentan POR SEPARADO: que la Luna esté
 * en vuelo no deja en blanco el ranking, y un fallo del proveedor no se lleva
 * puesta la síntesis del día. Cada módulo resuelve también por su cuenta el
 * estado invitado: la sección entera se ve, con cada bloque diciendo qué
 * necesita, y un solo CTA para entrar.
 *
 * ## Responsive
 *
 * Un solo lienzo `wide` para las dos superficies. En escritorio la columna
 * principal queda a medida de lectura (`ReadingBlock`, 720) y la ficha del
 * cálculo acompaña al costado; en móvil y en nativo `Columns` no hace nada y
 * todo apila en el orden del JSX, con la gutter de 20 de WEB V1 y la barra
 * inferior que ya reserva el shell. La ficha se monta UNA sola vez: la misma
 * condición se usa invertida en los dos puntos de montaje.
 *
 * El ritual del Tarot (tira del Diario, carta boca abajo, velo y lectura larga)
 * ya no se dibuja acá. Sus componentes, sus datos y sus rutas siguen intactos
 * —el Umbral los monta— pero Hoy es la sección de lo que se está moviendo sobre
 * la carta, no el ritual.
 */
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeBackdrop } from "@/components/home/HomeBackdrop";
import { HomeHeader } from "@/components/home/sections";
import {
  HoyBloque,
  HoyCargando,
  HoyEncabezado,
  HoyEnlace,
  HoyError,
  HoyFalta,
  HoyFicha,
  HoyTarjeta,
  HoyTarjetaItem,
  HoyTexto
} from "@/components/home/hoy/HoyLayout";
import { HoyCumplelunaBloque, HoyLunaBloque } from "@/components/home/hoy/HoyLuna";
import { HoyPrincipalBloque, HoyPrincipalEstado } from "@/components/home/hoy/HoyPrincipal";
import { HoyRankingBloque } from "@/components/home/hoy/HoyRanking";
import { ContentCanvas } from "@/components/orbita/ContentCanvas";
import { Column, Columns, ReadingBlock } from "@/components/orbita/Layout";
import { GuestState } from "@/components/orbita/GuestState";
import { LoadingState } from "@/components/orbita/states";
import {
  contarModulos,
  etiquetaDeModulos,
  guiaPendiente,
  hoyBloques,
  hoyPrincipal,
  hoyRanking,
  numeroDeBloque,
  type HoyBloqueKey
} from "@/domain/hoyPrincipal";
import {
  cumplelunaHoy,
  cumplelunaIntroDeHoy,
  cumplelunaVista,
  fechaCivilLarga,
  lineasDeFalta,
  lunaVista
} from "@/domain/lunaCarta";
import { showsScreenHeader } from "@/domain/webLayout";
import { useDailyContext } from "@/hooks/useDailyContext";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useOrbitaFonts } from "@/hooks/useOrbitaFonts";
import { useRequireProfile } from "@/hooks/useRequireProfile";
import { useDailyGuide } from "@/services/dailyGuideStore";
import { useLunaCarta } from "@/services/lunaCartaStore";
import { orbita } from "@/theme/orbita";

const IS_WEB = process.env.EXPO_OS === "web";

/**
 * Reconsultas ya hechas por (usuario, día) mientras la guía estuvo pendiente.
 * Vive fuera del árbol para que un remontaje no reinicie la cuenta ni dispare
 * una tanda nueva.
 */
const reintentosDeEspera = new Map<string, number>();

/** Qué tan seguido cambia cada capa. Es parte del dato, no decoración. */
const CADENCIA: Record<HoyBloqueKey, string> = {
  ranking: "CAMBIA A DIARIO",
  luna: "CADA 2–3 DÍAS",
  cumpleluna: "CICLO LUNAR"
};

const TITULO: Record<HoyBloqueKey, string> = {
  ranking: "RANKING DE TRÁNSITOS",
  luna: "LA LUNA EN TU CARTA",
  cumpleluna: "CUMPLELUNA"
};

const INTRO: Record<HoyBloqueKey, string> = {
  ranking: "Primero el contacto que la lectura pone al frente, después el resto de lo activo sobre tu carta.",
  luna: "Muestra por qué parte de tu carta está pasando la Luna y qué tema cotidiano activa durante estos días.",
  cumpleluna: "Repetición de tu fase natal: cuándo vuelve la distancia entre el Sol y la Luna que había cuando naciste."
};

/** Qué le falta a cada módulo cuando no hay sesión: cada uno lo dice por su cuenta. */
const INVITADO: Record<HoyBloqueKey | "principal", string> = {
  principal: "La síntesis del día se escribe sobre tu carta natal: necesita una sesión iniciada.",
  ranking: "El ranking ordena los tránsitos sobre tu carta natal: necesita una sesión iniciada.",
  luna: "La Luna se mide sobre tu carta natal: necesita una sesión iniciada.",
  cumpleluna: "El cumpleluna sale del ángulo Sol–Luna de tu nacimiento: necesita una sesión iniciada."
};

/** La tarjeta lateral «Las cuatro capas de hoy» de WEB V1: nombre y cadencia de cada una. */
const CAPAS: ReadonlyArray<{ nombre: string; detalle: string }> = [
  { nombre: "Lo principal hoy", detalle: "Una frase, el contacto más fuerte." },
  { nombre: "Ranking de tránsitos", detalle: "Cambia a diario." },
  { nombre: "La Luna en tu carta", detalle: "Cada 2–3 días." },
  { nombre: "Cumpleluna", detalle: "Cada ~29,5 días." }
];

const INTRO_SECCION = "Lo que se está moviendo sobre tu carta. Cada módulo cambia a su propio ritmo.";
const INTRO_INVITADO = "Los cuatro módulos se calculan sobre tu carta natal real. Entrá para abrir el día.";

/**
 * Cuánto se espera entre reconsultas mientras el backend declara la guía
 * pendiente, y cuántas antes de decirlo y dejar el reintento en manos de la
 * persona. Doce por diez segundos: dos minutos, el techo en frío del
 * enriquecimiento con margen. No es un reloj de pared —no decide ningún dato—,
 * es sólo la cadencia de la espera.
 */
const REINTENTO_PENDIENTE_MS = 10_000;
const REINTENTOS_PENDIENTE_MAX = 12;

export function HomeScreen() {
  const { isReady, profile } = useRequireProfile();
  const { isLive, isAuthLoading, userError, retryUser, auth } = useLiveApp();
  // Invitado CONFIRMADO (Clerk resuelto y sin sesión) → estado honesto, sin
  // datos inventados. Mientras la sesión carga o reconecta (`isAuthLoading`) la
  // sección muestra carga estable: nunca contenido de otra cuenta.
  const guest = !isAuthLoading && !userError && !auth?.isSignedIn;
  const fontsLoaded = useOrbitaFonts();
  const insets = useSafeAreaInsets();
  const mode = useLayoutMode();
  const desktop = mode === "desktop";
  // En escritorio web la navegación del shell ya pone la marca: el header
  // interno sería una segunda barra ÓRBITA debajo de la primera.
  const showHeader = showsScreenHeader({ web: IS_WEB, mode });

  // El día lo decide el SERVIDOR desde la zona natal (`daily.getTodayContext`).
  // `null` mientras resuelve o si falló: sin fecha canónica no se consulta nada.
  const dailyContext = useDailyContext();
  // Se deriva del MISMO snapshot que gobierna los estados de abajo. Leer el
  // contexto una segunda vez mediante otro hook no agrega autoridad y deja una
  // rendija para que el encabezado y las queries observen fases distintas del
  // refresco en un render concurrente.
  const today = dailyContext.status === "listo" ? dailyContext.context.localDate : null;
  // Clave estable del usuario: el clerkUserId (el email puede cambiar).
  const userKey = isLive ? auth?.userId ?? null : null;
  const claveDelDia = today ? userKey : null;

  const { state: dailyState, retry: retryDaily } = useDailyGuide(claveDelDia, today ?? "", isAuthLoading);
  const { state: lunaState, retry: retryLuna } = useLunaCarta(claveDelDia, today ?? "", isAuthLoading);

  const daily = dailyState.status === "ready" ? dailyState.payload : null;
  // La primera respuesta de `getGuide` es genérica y viene marcada pendiente:
  // no es el dato de hoy. Se muestra como carga y se vuelve a consultar.
  const dailyPendiente = daily !== null && guiaPendiente(daily);
  // `empty` también trae sobre: sus `missingInputs` son justamente lo que
  // explica por qué falta cada bloque.
  const sobre = lunaState.status === "ready" || lunaState.status === "empty" ? lunaState.payload : null;

  const principal = hoyPrincipal(daily);
  const ranking = hoyRanking(daily);
  const luna = sobre?.moonOnChart ? lunaVista(sobre.moonOnChart, sobre) : null;
  // El día con el que se compara es el del PROPIO sobre: es el día que ese
  // cálculo midió. Sin él (sobre vacío) no hay evento que resolver.
  const evento = sobre?.cumpleluna ? cumplelunaHoy(sobre.cumpleluna, sobre.localDate, sobre.timezone) : null;
  const cumple = sobre?.cumpleluna ? cumplelunaVista(sobre.cumpleluna, sobre, evento) : null;

  // Reconsulta mientras el backend siga declarando la guía pendiente. Es la
  // única situación en que esta pantalla vuelve a pedir la misma fuente el
  // mismo día: ni el remonte ni el cambio de ancho disparan otra (el store
  // deduplica), y el reintento humano queda en el propio módulo si se agota.
  const claveDeEspera = dailyPendiente ? `${claveDelDia ?? ""}:${today ?? ""}` : null;
  useEffect(() => {
    if (!claveDeEspera) return;
    if (reintentosDeEspera.get(claveDeEspera) === undefined) reintentosDeEspera.set(claveDeEspera, 0);
    const hechos = reintentosDeEspera.get(claveDeEspera) ?? 0;
    if (hechos >= REINTENTOS_PENDIENTE_MAX) return;
    const timer = setTimeout(() => {
      reintentosDeEspera.set(claveDeEspera, hechos + 1);
      retryDaily();
    }, REINTENTO_PENDIENTE_MS);
    return () => clearTimeout(timer);
  }, [claveDeEspera, retryDaily]);
  const esperaAgotada =
    dailyPendiente && (reintentosDeEspera.get(claveDeEspera ?? "") ?? 0) >= REINTENTOS_PENDIENTE_MAX;

  const contador = etiquetaDeModulos(
    contarModulos({
      principal: principal !== null,
      ranking: ranking.length > 0,
      luna: luna !== null,
      cumpleluna: cumple !== null
    })
  );
  const orden = hoyBloques(evento !== null);
  const intro = evento && sobre ? cumplelunaIntroDeHoy(evento, sobre.timezone) : INTRO_SECCION;

  // La ficha del cálculo: `basadoEn` y `disclaimer` de la MISMA generación que
  // alimenta «lo principal» y el ranking. No agrega ningún dato nuevo, y por eso
  // puede acompañar en escritorio sin inventar una segunda columna de contenido.
  const basadoEn = (daily && Array.isArray(daily.basadoEn) ? daily.basadoEn : [])
    .map((linea) => (typeof linea === "string" ? linea.trim() : ""))
    .filter((linea) => linea.length > 0);
  const disclaimer =
    typeof daily?.disclaimer === "string" && daily.disclaimer.trim().length > 0 ? daily.disclaimer.trim() : null;
  const hayFicha = basadoEn.length > 0 || disclaimer !== null;
  // UNA sola condición, usada invertida en los dos puntos de montaje: por
  // construcción la ficha no puede duplicarse (en móvil `Column` es
  // transparente y saldría dos veces) ni desaparecer.
  const fichaEnColumna = desktop && hayFicha;
  const ficha = hayFicha ? (
    <HoyFicha titulo="SOBRE ESTE CÁLCULO" lineas={basadoEn} nota={disclaimer} />
  ) : null;
  // Las dos tarjetas de WEB V1 viven sólo en la columna lateral de escritorio:
  // el frame móvil (`1718:1997`) no las tiene. Son texto fijo del producto, no
  // datos: no agregan ninguna afirmación personal.
  const tarjetas = desktop ? (
    <>
      <HoyTarjeta titulo="LAS CUATRO CAPAS DE HOY">
        {CAPAS.map((capa) => (
          <HoyTarjetaItem key={capa.nombre} nombre={capa.nombre} detalle={capa.detalle} />
        ))}
      </HoyTarjeta>
      <HoyTarjeta titulo="TU MOMENTO">
        <HoyTexto>Los ciclos lentos: tu estación vital, el tema de tu año y tus cuatro ritmos.</HoyTexto>
        <HoyEnlace href="/transito">IR A TRÁNSITOS</HoyEnlace>
      </HoyTarjeta>
    </>
  ) : null;

  if (!isReady || !profile || !fontsLoaded) {
    return <View style={styles.screen} />;
  }

  const sessionPending = isAuthLoading;
  // La fecha es una dependencia de TODA la sección, no de un módulo. Mientras
  // el proveedor canónico está idle/cargando mostramos una sola carga estable:
  // no aparece por un instante un encabezado sin fecha con cuatro módulos en
  // vuelo, ni se dispara una consulta con una fecha vacía.
  const contextPending =
    !sessionPending && !userError && !guest &&
    (dailyContext.status === "idle" || dailyContext.status === "cargando");
  // La fecha canónica falló: sin día no hay Hoy que pedir, y dejar los módulos
  // «cargando» para siempre sería mentir sobre lo que está pasando.
  const sinFecha = !sessionPending && !userError && !guest && dailyContext.status === "error";

  /** El estado de la guía diaria para «lo principal» y el ranking, o `null` si hay dato. */
  function estadoDeLaGuia(key: HoyBloqueKey | "principal") {
    // Invitado confirmado: cada módulo dice qué le falta. Cero datos inventados.
    if (guest) return <HoyFalta lineas={[INVITADO[key]]} />;
    const modulo = key === "principal" ? "LO PRINCIPAL HOY" : TITULO[key];
    if (dailyState.status === "error")
      return <HoyError mensaje={dailyState.message} onRetry={retryDaily} modulo={modulo} />;
    if (esperaAgotada)
      return <HoyError mensaje="La lectura de hoy está tardando más de lo normal." onRetry={retryDaily} modulo={modulo} />;
    if (dailyState.status !== "ready" || dailyPendiente)
      return (
        <HoyCargando
          etiqueta={key === "principal" ? "Escribiendo la síntesis de hoy…" : "Leyendo los tránsitos de hoy…"}
        />
      );
    return null;
  }

  function cuerpoDe(key: HoyBloqueKey) {
    if (key === "ranking") {
      const estado = estadoDeLaGuia("ranking");
      if (estado) return estado;
      if (ranking.length === 0) return <HoyFalta lineas={["La lectura de hoy no trajo tránsitos para ordenar."]} />;
      return <HoyRankingBloque filas={ranking} />;
    }
    if (guest) return <HoyFalta lineas={[INVITADO[key]]} />;
    if (lunaState.status === "error")
      return <HoyError mensaje={lunaState.message} onRetry={retryLuna} modulo={TITULO[key]} />;
    if (lunaState.status === "loading") return <HoyCargando etiqueta="Midiendo la Luna sobre tu carta…" />;
    if (key === "luna") {
      return luna ? <HoyLunaBloque vista={luna} /> : <HoyFalta lineas={lineasDeFalta(sobre, "luna")} />;
    }
    return cumple ? <HoyCumplelunaBloque vista={cumple} /> : <HoyFalta lineas={lineasDeFalta(sobre, "cumpleluna")} />;
  }

  return (
    <View style={styles.screen}>
      <HomeBackdrop />
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + orbita.spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* El mismo lienzo que el resto de la app autenticada: ancho completo en
            móvil, columna de composición de 1200 en escritorio. El fondo
            (`HomeBackdrop`) queda full-bleed detrás. */}
        <ContentCanvas variant="wide">
          {showHeader ? <HomeHeader /> : null}
          {sessionPending ? (
            /* Sesión resolviéndose (arranque o reconexión): carga estable.
               NUNCA mocks — una sesión existente no ve datos demo ni un segundo. */
            <View style={styles.estado}>
              <LoadingState />
            </View>
          ) : userError ? (
            /* ensureUser falló de verdad: error recuperable, no «listo» de mentira. */
            <View style={styles.estado}>
              <Text style={styles.errorTitle}>No pudimos abrir tu sesión.</Text>
              <Pressable onPress={retryUser} accessibilityRole="button" style={styles.retryBtn}>
                <Text style={styles.retryText}>REINTENTAR</Text>
              </Pressable>
            </View>
          ) : contextPending ? (
            <View style={styles.estado}>
              <LoadingState />
            </View>
          ) : sinFecha ? (
            <View style={styles.estado}>
              <Text style={styles.errorTitle}>No pudimos resolver el día de hoy.</Text>
              <Pressable onPress={dailyContext.refresh} accessibilityRole="button" style={styles.retryBtn}>
                <Text style={styles.retryText}>REINTENTAR</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Columns gap={orbita.spacing.xxl}>
                <Column weight={3}>
                  {/* En escritorio el lienzo mide 1200: sin esto los párrafos
                      —incluida la introducción del encabezado— se leerían a
                      ancho de monitor. */}
                  <ReadingBlock>
                    <HoyEncabezado
                      eyebrow="HOY · LO ACTIVO AHORA"
                      fecha={today ? fechaCivilLarga(today) : null}
                      contador={contador}
                      intro={guest ? INTRO_INVITADO : intro}
                    />
                    {guest ? (
                      /* Invitado confirmado: la sección se ve entera, cada
                         módulo dice qué necesita, y hay UN solo CTA para entrar. */
                      <View style={styles.estado}>
                        <GuestState
                          eyebrow="HOY"
                          title={"Hoy se lee\nsobre tu carta."}
                          body="Creá tu cuenta o entrá para abrir el día sobre tu carta natal real."
                        />
                      </View>
                    ) : null}
                    {(() => {
                      const estado = estadoDeLaGuia("principal");
                      if (estado) return <HoyPrincipalEstado>{estado}</HoyPrincipalEstado>;
                      return principal ? (
                        <HoyPrincipalBloque principal={principal} />
                      ) : (
                        <HoyPrincipalEstado>
                          <HoyFalta lineas={["La lectura de hoy no trajo una síntesis principal."]} />
                        </HoyPrincipalEstado>
                      );
                    })()}
                    {orden.map((key, index) => (
                      <HoyBloque
                        key={key}
                        indice={numeroDeBloque(index)}
                        titulo={TITULO[key]}
                        cadencia={CADENCIA[key]}
                        intro={INTRO[key]}
                      >
                        {cuerpoDe(key)}
                      </HoyBloque>
                    ))}
                  </ReadingBlock>
                </Column>
                {/* En móvil `Column` es transparente: si esto no fuera
                    condicional, la ficha saldría acá Y otra vez al final. */}
                <Column weight={2}>
                  {tarjetas}
                  {fichaEnColumna ? ficha : null}
                </Column>
              </Columns>
              {/* Cierre del scroll. Exactamente la negación de la condición de
                  la columna: la ficha se monta una sola vez, siempre. */}
              {fichaEnColumna ? null : ficha}
            </>
          )}
        </ContentCanvas>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#07080A", flex: 1 },
  estado: { paddingVertical: orbita.spacing.xxl },
  errorTitle: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.serif,
    fontSize: 20,
    lineHeight: 26,
    paddingHorizontal: orbita.spacing.gutter,
    textAlign: "center"
  },
  retryBtn: {
    alignSelf: "center",
    borderColor: "rgba(244,238,228,0.35)",
    borderRadius: orbita.radius.lg,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: orbita.spacing.xl,
    minHeight: 44,
    paddingHorizontal: orbita.spacing.xxl,
    paddingVertical: orbita.spacing.md
  },
  retryText: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 12, letterSpacing: 1.5 }
});
