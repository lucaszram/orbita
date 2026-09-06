import { Children, Fragment, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { AstroGlyph } from "@/components/orbita/AstroGlyph";
import { MeasuredSquare } from "@/components/orbita/ContentCanvas";
import { NatalWheel } from "@/components/orbita/NatalWheel";
import { Card, DataRow, ModuleHeader } from "@/components/v492/Module";
import { DetailLayerScreen, Section } from "@/components/v492/Screen";
import { LimitationList } from "@/components/v492/Status";
import { EmptyBlock, ErrorBlock, GuestBlock, LoadingBlock, PrimaryButton } from "@/components/v492/States";
import { Body, Divider, Eyebrow, Label, Mono, Note, Subtitle, Title } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { bodySymbol, RETROGRADE_CODE } from "@/domain/astroSymbols";
import { resolveBirthInfo } from "@/domain/birthInfo";
import { natalChapters, type NatalChapterView } from "@/domain/lecturaNatal";
import { appApi } from "@/services/appRefs";
import { formatDateTime } from "@/domain/layers";
import {
  angleView,
  aspectViews,
  birthTimePrecisionLabel,
  birthTimePrecisionNote,
  drawablePositions,
  hasExactBirthTime,
  houseView,
  natalWheelPayload,
  positionLimitations,
  positionView,
  publishedAngle,
  timeSourceLine
} from "@/domain/natalChartBase";
import {
  natalAspectsAccess,
  natalChartState,
  natalHousesAccess,
  type NatalChartState
} from "@/domain/natalChartState";
import { sessionPhase } from "@/domain/screenPhase";
import { useLayers } from "@/hooks/useLayers";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useNatalChartRecovery } from "@/hooks/useNatalChartRecovery";
import { useNatalReading, type NatalReading } from "@/hooks/useNatalReading";
import { layersApi, type NatalChartBase } from "@/services/layersApi";

/**
 * Carta completa — detalle del Perfil (`/perfil/carta/completa`).
 *
 * El hub muestra la puerta; acá está tu carta entera en el orden en que se lee:
 * la rueda, tus datos natales con su precisión, las diez posiciones —Sol a
 * Plutón—, los contactos mayores, las casas cuando existen y cómo se calculó
 * todo eso.
 *
 * Casi todo acá es una VISTA DE DATOS: las posiciones y los ángulos que salen
 * del cálculo, con lo que cada uno permite afirmar. Fuente única:
 * `layers.getNatalChartBase`.
 *
 * La única parte ESCRITA es "Tu carta, explicada": los siete capítulos que ya
 * genera el backend (`charts.personalityReading`) y que la carta legada muestra
 * desde siempre. No se escribe nada acá y no se interpreta nada por aspecto: se
 * dibuja la lectura recibida, tal cual, o el estado que explica por qué todavía
 * no está. Ver `@/hooks/useNatalReading`.
 *
 * Dos cosas se dicen distinto y no se confunden: lo que falta porque el cálculo
 * no lo permite —sin hora exacta no hay grados, ni ejes, ni casas— y lo que está
 * cerrado por acceso, que se abre con Órbita Plus y se ofrece como tal.
 *
 * ## La forma: una columna editorial, no una pila de tarjetas (QA22-030)
 *
 * Lo NORMAL de esta pantalla —los datos natales, los ejes, las diez posiciones,
 * los contactos, las doce casas y cómo se calculó— vive en una columna de
 * títulos, pares rótulo/valor y filetes: es el canon V4.9.2, que no encajona los
 * datos (ver `@/components/v492/Layout`). Metida en una `Card`, cada tabla se
 * leía como un objeto aparte y la carta entera quedaba como una pila de cajas
 * grises en vez de un texto que se recorre de arriba abajo. Los capítulos de "Tu
 * carta, explicada" ya eran editoriales y por eso nunca se envolvieron.
 *
 * La `Card` queda para lo EXCEPCIONAL, que es justamente lo que tiene que
 * despegarse de la columna: el cálculo en curso, el que no se pudo publicar, la
 * parte que falta, lo cerrado por plan y las ramas sin dato —sin hora, pendiente,
 * sin resultado— con su explicación y, cuando corresponde, su botón.
 */
export function CartaCompletaV492Screen() {
  const live = useLiveApp();
  const phase = sessionPhase(live);

  if (phase === "cargando") {
    return (
      <Shell>
        <LoadingBlock message="Abriendo tu carta…" />
      </Shell>
    );
  }
  if (phase === "error") {
    return (
      <Shell>
        <ErrorBlock onRetry={live.retryUser} />
      </Shell>
    );
  }
  if (phase === "invitado") {
    // Sin mocks: la carta se calcula sobre TUS datos, no hay una de ejemplo.
    return (
      <Shell>
        <GuestBlock />
      </Shell>
    );
  }
  return <CartaCompletaLive />;
}

function Shell({ children }: { children: ReactNode }) {
  // Se entra desde el hub de la carta: sin historial —un deep link— "volver"
  // tiene que dejar ahí y no en Hoy.
  return (
    <DetailLayerScreen eyebrow="Carta completa" fallbackHref="/perfil">
      {children}
    </DetailLayerScreen>
  );
}

/**
 * La query sólo se monta con sesión confirmada. El read-model puede tardar: el
 * snapshot canónico se rearma con el mismo ciclo de datos que las capas, así que
 * el reintento honesto es ése y no una carta anterior.
 */
function CartaCompletaLive() {
  const chart = useQuery(layersApi.getNatalChartBase, {});
  /**
   * Los datos GUARDADOS, textuales. "Hora exacta / el instante que guardaste"
   * describía la precisión sin mostrar el dato, y después de editar con un
   * error en el medio no había forma de verificar QUÉ usó la carta (Lucas,
   * iPhone, 2026-08-19). La fila DATOS muestra fecha · hora · lugar tal cual
   * están en la cuenta.
   */
  const remoteBirth = useQuery(appApi.birthData.getCurrent, {});
  const birth = resolveBirthInfo({ doc: remoteBirth ?? null, resolved: remoteBirth !== undefined });
  const layers = useLayers();
  const { timezone, refreshing, refreshFailed } = layers;
  // Mismo resolvedor que el hub: las dos pantallas leen el mismo contrato y
  // tienen que contar lo mismo. Ver `@/domain/natalChartState`.
  const estado = natalChartState({ chart, refreshing, refreshFailed });
  // Y el MISMO mecanismo de recuperación que el hub, no una copia: el botón
  // llama a `charts.recoverNatalChart` —la operación que escribe los ejes y las
  // casas, y que además dice si de verdad quedaron publicables— y recién
  // después espera el recálculo del día. El alcance del estado es esta carta:
  // el fallo de otra cuenta o de otra carta no se hereda.
  // Ver `@/hooks/useNatalChartRecovery`.
  const recuperacion = useNatalChartRecovery({ recovery: estado.recovery, chart });

  if (estado.phase === "cargando") {
    return (
      <Shell>
        <LoadingBlock message="Abriendo tu carta…" />
      </Shell>
    );
  }
  if (estado.phase === "sin-datos") {
    return (
      <Shell>
        <EmptyBlock />
      </Shell>
    );
  }
  if (estado.phase === "calculando") {
    return (
      <Shell>
        <Section>
          <Calculando motivo={estado.reason} />
        </Section>
      </Shell>
    );
  }
  // NO hay snapshot canónico y NO hay corrida activa.
  //
  // Esto era un muro de Órbita Plus, y era un error de lectura del contrato:
  // `access.positions` vale `snapshot !== null` —dice si existe el cálculo
  // canónico—, no si la cuenta tiene acceso. El entitlement es `access.isPro` y
  // sólo cierra casas y aspectos. Una cuenta pagando podía ver un muro de pago
  // por un cálculo que todavía no había terminado.
  if (estado.phase === "sin-calculo" || !chart) {
    return (
      <Shell>
        <Section>
          <SinCalculo
            onRetry={recuperacion.recuperar}
            refreshing={recuperacion.ocupado}
            fallo={recuperacion.fallo}
            motivo={estado.reason}
          />
          {chart ? <LimitationList limitations={chart.limitations} /> : null}
        </Section>
      </Shell>
    );
  }
  // `parcial` y `listo` muestran la carta entera. La diferencia entre los dos no
  // se vuelve a deducir acá: viaja en `estado`, que es lo que decide qué salida
  // se ofrece. Antes se perdía en este pasaje, y un parcial con los ejes o las
  // casas pendientes —recuperable según el dominio— no ofrecía nada.
  return (
    <CartaCompletaContent
      chart={chart}
      timezone={timezone}
      estado={estado}
      onRetry={recuperacion.recuperar}
      refreshing={recuperacion.ocupado}
      fallo={recuperacion.fallo}
    />
  );
}

/**
 * Hay una corrida ACTIVA y todavía no hay posiciones (D7).
 *
 * Después de cargar o corregir los datos natales el cálculo tarda un par de
 * minutos. Se nombra el trabajo en curso y se dice cuánto puede tardar; no hay
 * botón, porque mientras la corrida vive no hay nada que relanzar.
 */
function Calculando({ motivo }: { motivo: string | null }) {
  return (
    <Card>
      <View accessibilityLiveRegion="polite">
        <Label>TU CARTA SE ESTÁ CALCULANDO</Label>
      </View>
      <Note style={styles.spaced}>
        Tus datos siguen guardados. Las posiciones se calculan y se verifican del lado de Órbita, y eso
        puede tardar un par de minutos; hasta que termine no mostramos una carta anterior ni una de
        ejemplo. Podés salir de esta pantalla: el cálculo sigue igual.
      </Note>
      {motivo ? <Note style={styles.spaced}>{motivo}</Note> : null}
    </Card>
  );
}

/**
 * El último intento terminó sin publicar la carta y no hay ninguno corriendo.
 *
 * Es RECUPERABLE, no terminal: se dice qué pasó con el texto del propio cálculo
 * y el botón COMPRUEBA de nuevo. Lo que no hace es afirmar que algo se está
 * calculando cuando no hay nada corriendo, ni presentar el pendiente como un
 * límite de acceso.
 */
function SinCalculo({
  onRetry,
  refreshing,
  fallo,
  motivo
}: {
  onRetry: () => void;
  refreshing: boolean;
  fallo: boolean;
  motivo: string | null;
}) {
  return (
    <Card>
      <View accessibilityLiveRegion="polite">
        <Label>TU CARTA TODAVÍA NO SE PUDO PUBLICAR</Label>
      </View>
      <Note style={styles.spaced}>
        Tus datos siguen guardados y no se perdió nada. El último intento de calcular tus posiciones no
        llegó a completarse, así que no hay carta nueva para mostrar; tampoco mostramos una anterior ni
        una de ejemplo. Podés calcularla de nuevo ahora.
      </Note>
      {motivo ? <Note style={styles.spaced}>{motivo}</Note> : null}
      {fallo ? <FalloDeRecuperacion /> : null}
      <View style={styles.actionRow}>
        <PrimaryButton
          label={refreshing ? "CALCULANDO…" : fallo ? "REINTENTAR" : "CALCULAR MI CARTA"}
          accessibilityLabel={
            refreshing ? "Calculando tu carta natal" : "Calcular tu carta natal de nuevo"
          }
          onPress={onRetry}
          disabled={refreshing}
        />
      </View>
    </Card>
  );
}

/**
 * Lo que se dice cuando el intento de recuperación falló.
 *
 * El mismo texto y la misma voz que el hub: las dos pantallas comparten el
 * mecanismo y tienen que contar lo mismo. No borra ni tapa la carta parcial que
 * ya estaba publicada.
 */
function FalloDeRecuperacion() {
  return (
    <View accessibilityLiveRegion="polite">
      <Note style={styles.spaced}>
        No pudimos completar el cálculo ahora. Tus datos siguen guardados y lo que ya estaba publicado
        no se toca: podés volver a intentarlo.
      </Note>
    </View>
  );
}

/**
 * Hay carta, y le falta una parte que SÍ depende del cálculo.
 *
 * Es el mismo bloque que el hub, con el mismo texto y la misma voz: las dos
 * pantallas leen el mismo estado y tienen que ofrecer la misma salida. Se
 * distingue de `SinCalculo` en que acá hay carta para mostrar, y de la carta sin
 * hora en que esto se resuelve del lado de Órbita.
 */
function FaltaCalculo({
  onRetry,
  refreshing,
  fallo,
  motivo
}: {
  onRetry: () => void;
  refreshing: boolean;
  fallo: boolean;
  motivo: string | null;
}) {
  return (
    <Card>
      <Label>FALTA UNA PARTE DEL CÁLCULO</Label>
      <Note style={styles.spaced}>
        {motivo ??
          "Tu carta está publicada, pero una parte del cálculo todavía no llegó. Tus datos están completos: lo que falta es de nuestro lado."}
      </Note>
      {fallo ? <FalloDeRecuperacion /> : null}
      <View style={styles.actionRow}>
        <PrimaryButton
          label={refreshing ? "CALCULANDO…" : fallo ? "REINTENTAR" : "COMPROBAR DE NUEVO"}
          accessibilityLabel={
            refreshing
              ? "Calculando la parte que falta de tu carta"
              : "Calcular de nuevo la parte que falta de tu carta"
          }
          onPress={onRetry}
          disabled={refreshing}
        />
      </View>
    </Card>
  );
}

/**
 * Lista editorial: una columna de filas separadas por un filete de verdad.
 *
 * Es la forma que reemplaza a la `Card` en todo lo normal de la carta. El
 * separador es un `Divider` —el mismo hairline del sistema— y no un margen: un
 * margen deja de leerse como retícula apenas dos filas miden distinto, y acá
 * miden distinto todo el tiempo (una casa trae su tema debajo, una posición
 * puede traer su etiqueta, un contacto puede no traer orbe).
 *
 * Los hijos nulos se caen solos, así que una fila condicional no deja un filete
 * colgando ni abre la lista con una línea suelta.
 */
function EditorialList({ children }: { children: ReactNode }) {
  const filas = Children.toArray(children);
  if (filas.length === 0) return null;
  return (
    <View>
      {filas.map((fila, index) => (
        <Fragment key={index}>
          {index > 0 ? <Divider /> : null}
          <View style={styles.editorialItem}>{fila}</View>
        </Fragment>
      ))}
    </View>
  );
}

/**
 * La misma columna, para pares rótulo/valor (`DataRow`).
 *
 * Se separa de `EditorialList` por el ritmo vertical y por nada más: `DataRow`
 * ya trae su propio aire arriba, así que el renglón sólo agrega el de abajo. Con
 * el `paddingVertical` de `EditorialList` el par quedaría con el doble de aire
 * arriba que abajo, y una tabla de datos con el ritmo torcido se lee peor que
 * una caja.
 */
function EditorialRows({ children }: { children: ReactNode }) {
  const filas = Children.toArray(children);
  if (filas.length === 0) return null;
  return (
    <View>
      {filas.map((fila, index) => (
        <Fragment key={index}>
          {index > 0 ? <Divider /> : null}
          <View style={styles.editorialPair}>{fila}</View>
        </Fragment>
      ))}
    </View>
  );
}

function CartaCompletaContent({
  chart,
  timezone,
  estado,
  onRetry,
  refreshing,
  fallo
}: {
  chart: NatalChartBase;
  timezone: string;
  estado: NatalChartState;
  onRetry: () => void;
  refreshing: boolean;
  /** El último intento de recuperación falló. */
  fallo: boolean;
}) {
  /**
   * Los datos GUARDADOS, textuales. "Hora exacta / el instante que guardaste"
   * describía la precisión sin mostrar el dato, y después de editar con un
   * error en el medio no había forma de verificar QUÉ usó la carta (Lucas,
   * iPhone, 2026-08-19). La fila DATOS muestra fecha · hora · lugar tal cual
   * están en la cuenta.
   */
  const remoteBirth = useQuery(appApi.birthData.getCurrent, {});
  const birth = resolveBirthInfo({ doc: remoteBirth ?? null, resolved: remoteBirth !== undefined });
  /**
   * "Tu carta, explicada". El MISMO cableado que la carta legada —una sola
   * query, una sola action, una sola regla de fase— vive en el hook compartido:
   * dos efectos de generación en paralelo era exactamente lo que hacía derivar
   * a las dos superficies sobre el mismo dato.
   */
  const lectura = useNatalReading();
  const posiciones = chart.positions.map(positionView);
  const contactos = aspectViews(chart);
  const limitesDePosicion = positionLimitations(chart);
  const dibujables = drawablePositions(chart);
  const calculada = timezone ? formatDateTime(chart.observedAt, timezone, { withYear: true }) : null;
  const notaDeHora = birthTimePrecisionNote(chart);

  return (
    <Shell>
      <Section>
        <Title>Tu carta completa</Title>
        <View style={styles.intro}>
          <Body>
            El cielo del momento en que naciste, punto por punto: la rueda, cada posición con lo que se puede
            afirmar de ella, los contactos entre ellas y —cuando tu hora lo permite— las doce casas.
          </Body>
          <Mono style={styles.introMeta}>{timeSourceLine(chart)}</Mono>
        </View>

        {/* La salida del estado, arriba de todo y una sola vez. Un parcial que SÍ
            se puede recuperar —le falta cálculo, no un dato de la persona—
            ofrece pedirlo otra vez; el parcial por hora desconocida no, y su
            botón vive abajo, junto a la precisión que explica por qué. Mientras
            hay una corrida en vuelo el botón se anuncia bloqueado en vez de
            apilar pedidos. */}
        {estado.phase === "parcial" && estado.canRetry ? (
          <View style={styles.module}>
            <FaltaCalculo
              onRetry={onRetry}
              refreshing={refreshing}
              fallo={fallo}
              motivo={estado.reason}
            />
          </View>
        ) : null}

        {/* --- La rueda ---------------------------------------------------- */}

        <ModuleHeader module="Tu rueda" cadence="natal · no cambia" intro={introRueda(chart)} />
        {dibujables > 0 ? (
          <>
            <View
              style={styles.wheel}
              accessible
              accessibilityRole="image"
              accessibilityLabel={etiquetaRueda(chart)}
            >
              {/* El lado sale del contenedor medido, nunca del ancho de la ventana. */}
              <MeasuredSquare max={320}>
                {(size) => <NatalWheel payload={natalWheelPayload(chart)} size={size} />}
              </MeasuredSquare>
            </View>
            <Note>{notaDeCuerdas(chart, contactos.length)}</Note>
          </>
        ) : (
          <Card>
            <Note>
              Sin tu hora exacta no se publica ningún grado, así que no hay dónde ubicar tus puntos y la
              rueda no se dibuja. Ubicarlos en el mediodía sería inventar tu hora de nacimiento.
            </Note>
          </Card>
        )}

        {/* --- Datos natales y precisión ------------------------------------ */}

        <View style={styles.module}>
          <ModuleHeader
            module="Tus datos natales y su precisión"
            cadence="natal · no cambia"
            intro="La precisión de una carta depende de un solo dato: qué tan exacta es la hora de nacimiento con la que se calculó."
          />
          <EditorialRows>
            {birth.status === "complete" ? (
              <DataRow label="DATOS" value={<Mono>{birth.line}</Mono>} />
            ) : null}
            <DataRow label="PRECISIÓN" value={<Mono>{birthTimePrecisionLabel(chart)}</Mono>} />
            {/* Con hora exacta, "se calculó con el instante que guardaste" es
                redundancia pura al lado de DATOS. La fila sólo aparece cuando el
                sustituto informa algo: sin hora, el cálculo cubre todo el día. */}
            {!hasExactBirthTime(chart) ? (
              <DataRow label="SE CALCULÓ CON" value={<Mono>{origenDeCalculo(chart)}</Mono>} />
            ) : null}
            {calculada ? <DataRow label="ÚLTIMO CÁLCULO" value={<Mono>{calculada}</Mono>} /> : null}
          </EditorialRows>
          {/* Lo que explica la tabla queda al pie de la tabla, en la columna: es
              texto sobre los datos de arriba, no otra fila de datos. */}
          <Note style={styles.spaced}>
            {hasExactBirthTime(chart)
              ? "Con tu hora, las posiciones son las del instante exacto y se pueden trazar los ejes y las casas."
              : "El Sol, la Luna y los planetas se comprueban sobre todo el día: se conserva lo que no cambia en esas horas y se retira lo que sí. El Ascendente cambia cada dos horas, y por eso no aparece."}
          </Note>
          {notaDeHora ? <Note style={styles.spaced}>{notaDeHora}</Note> : null}
          {/* La misma condición que el hub: la hora se ofrece cuando falta, y
              también cuando el dominio declara que completarla es LA salida de
              este estado. */}
          {hasExactBirthTime(chart) && estado.recovery !== "completar-hora" ? null : (
            <View style={styles.actionRow}>
              <PrimaryButton
                label="AGREGAR MI HORA DE NACIMIENTO"
                accessibilityLabel="Agregar mi hora de nacimiento"
                onPress={() => router.push("/editar-datos")}
              />
            </View>
          )}

          <View style={styles.block}>
            <Label>TUS EJES</Label>
            <View style={{ height: v492.space.md }} />
            {chart.access.angles ? (
              <>
                <EditorialList>
                  {chart.angles.map((angle) => {
                    const view = angleView(angle);
                    return (
                      <View
                        key={angle.key}
                        style={styles.row}
                        accessible
                        accessibilityRole="text"
                        accessibilityLabel={view.voice}
                      >
                        <Body style={styles.rowName}>{view.label}</Body>
                        <Mono style={styles.rowValue}>{view.value}</Mono>
                      </View>
                    );
                  })}
                </EditorialList>
                <Note style={styles.spaced}>
                  El Ascendente es el grado que asomaba por el horizonte en tu lugar y a tu hora; el Medio
                  Cielo, el punto más alto del cielo en ese mismo instante. Los dos dependen de la hora.
                </Note>
              </>
            ) : (
              <Card>
                <Note>{textoSinEjes(chart)}</Note>
              </Card>
            )}
          </View>
        </View>

        {/* --- Las diez posiciones ------------------------------------------ */}

        <View style={styles.module}>
          <ModuleHeader
            module="Tus diez posiciones"
            cadence="natal · no cambia"
            intro={`Del Sol a Plutón: ${chart.positions.length} posiciones, con lo que cada una permite afirmar. El Ascendente y el Medio Cielo no están acá porque son ejes, no planetas.`}
          />
          <EditorialList>
            {posiciones.map((view) => (
              <View
                key={view.key}
                style={styles.row}
                accessible
                accessibilityRole="text"
                accessibilityLabel={view.voice}
              >
                <AstroGlyph
                  symbol={bodySymbol({ key: view.key, label: view.label })}
                  size={16}
                  color={v492.colors.copperSoft}
                  strokeWidth={2}
                  style={styles.rowGlyph}
                />
                <Body style={styles.rowName}>{view.label}</Body>
                <View style={styles.rowData}>
                  <Mono style={styles.rowValue}>{view.value}</Mono>
                  {view.tag ? <Label style={styles.rowTag}>{view.tag}</Label> : null}
                </View>
              </View>
            ))}
          </EditorialList>
          <Note style={styles.spaced}>
            {hasExactBirthTime(chart)
              ? `Cada signo mide 30°, así que el número es la posición dentro del signo: "Leo 12°" es doce grados adentro de Leo.`
              : "Sin tu hora exacta no se publica el grado de ninguna posición: se dice el signo cuando se mantiene todo el día, los dos signos posibles cuando puede cambiar, y se retira la posición cuando no se puede acotar."}
            {posiciones.some((view) => view.value.includes(RETROGRADE_CODE))
              ? ` ${RETROGRADE_CODE} marca los planetas que, vistos desde la Tierra, se movían hacia atrás sobre el cielo el día que naciste.`
              : ""}
          </Note>
          {limitesDePosicion.length > 0 ? (
            <View style={styles.block}>
              {limitesDePosicion.map((limitation) => (
                <Note key={limitation} style={styles.rowSpaced}>
                  · {limitation}
                </Note>
              ))}
            </View>
          ) : null}
          {chart.access.houses ? null : (
            <Note style={styles.spaced}>
              No hay columna de casas: {motivoSinCasas(chart)}
            </Note>
          )}
        </View>

        {/* --- Tu carta, explicada ------------------------------------------ */}

        <View style={styles.module}>
          <ModuleHeader
            module="Tu carta, explicada"
            cadence="natal · no cambia"
            intro="La lectura escrita sobre tu carta, capítulo por capítulo: qué dice cada posición y un par de preguntas para pensarla. Se escribe una sola vez y no cambia con el día."
          />
          <LecturaNatal lectura={lectura} />
        </View>

        {/* --- Los contactos mayores ---------------------------------------- */}

        <View style={styles.module}>
          <ModuleHeader
            module="Los contactos entre tus puntos"
            cadence="natal · no cambia"
            intro="Un aspecto es la distancia entre dos puntos de tu carta cuando esa distancia forma un ángulo señalado: 0°, 60°, 90°, 120° o 180°."
          />
          {natalAspectsAccess(chart) === "plus" ? (
            <PlusBlock
              linea="Los contactos entre tus puntos —qué puntos se tocan, con qué ángulo y con cuánta precisión— están disponibles con Órbita Plus."
              cta={{
                label: "VER ÓRBITA PLUS",
                voz: "Ver Órbita Plus para desbloquear los contactos entre tus puntos",
                onPress: () => router.push("/paywall")
              }}
            />
          ) : natalAspectsAccess(chart) === "pendiente" ? (
            // Con Plus y sin contactos publicados no es un límite de acceso: es
            // un cálculo que todavía no llegó. Decir "Plus" acá le cobraría a la
            // cuenta algo que ya tiene.
            <Card>
              <Note>
                Tus contactos todavía no están publicados. Tu acceso los incluye: lo que falta es el
                cálculo, y tus posiciones de arriba no dependen de él.
              </Note>
            </Card>
          ) : contactos.length > 0 ? (
            <>
              <EditorialList>
                {contactos.map((view) => (
                  <View
                    key={view.key}
                    style={styles.row}
                    accessible
                    accessibilityRole="text"
                    accessibilityLabel={view.voice}
                  >
                    <Body style={styles.rowName}>{view.line}</Body>
                    {view.orb ? <Mono style={styles.rowValue}>{view.orb}</Mono> : null}
                  </View>
                ))}
              </EditorialList>
              <Note style={styles.spaced}>
                El orbe es cuánto le falta a ese ángulo para ser exacto: 0° sería exacto, y cuanto más chico,
                más ajustado el contacto. Están ordenados del más ajustado al menos ajustado.
                {hasExactBirthTime(chart)
                  ? ""
                  : " Sin tu hora exacta el orbe se publica como rango: es lo que el ángulo pudo medir a lo largo del día."}
                {/* No se escribe una lectura por contacto: los cruces ya están
                    leídos dentro del punto al que pertenecen, arriba. Sólo se
                    dice cuando los capítulos están efectivamente a la vista. */}
                {lectura.phase === "listo"
                  ? " Estos cruces ya están leídos arriba: cada capítulo integra los contactos de su punto, así que acá quedan como dato y no se repiten como lectura suelta."
                  : ""}
              </Note>
            </>
          ) : (
            <Card>
              <Note>
                Ninguno de tus puntos quedó dentro de los ángulos y los orbes que este método reconoce. Es un
                resultado del cálculo, no una parte que falte: tus posiciones de arriba no dependen de esto.
              </Note>
            </Card>
          )}
        </View>

        {/* --- Las doce casas ----------------------------------------------- */}

        <View style={styles.module}>
          <ModuleHeader
            module="Tus doce casas"
            cadence="natal · no cambia"
            intro="Las casas son las doce zonas en las que se reparte el cielo visto desde el lugar y la hora exactos en que naciste. Cada una nombra un área de la vida, y para trazarlas hace falta esa hora."
          />
          {chart.access.houses ? (
            <>
              <EditorialList>
                {chart.houses.map((house) => {
                  const view = houseView(house);
                  return (
                    <View key={house.house}>
                      <View
                        style={styles.row}
                        accessible
                        accessibilityRole="text"
                        accessibilityLabel={view.voice}
                      >
                        <Label style={styles.rowName}>{view.label}</Label>
                        <Mono style={styles.rowValue}>{view.value}</Mono>
                      </View>
                      <Note style={styles.rowTheme}>{view.theme}</Note>
                    </View>
                  );
                })}
              </EditorialList>
              <Note style={styles.spaced}>
                Cada línea es el comienzo de una casa: el signo y el grado donde arranca. Los puntos de tu
                carta caen adentro de la casa que empieza antes que ellos.
              </Note>
            </>
          ) : natalHousesAccess(chart) === "sin-hora" ? (
            <Card>
              <Note>{textoSinEjes(chart)}</Note>
            </Card>
          ) : natalHousesAccess(chart) === "plus" ? (
            <PlusBlock
              linea="Tus doce casas —dónde empieza cada una y qué área nombra— están disponibles con Órbita Plus."
              cta={{
                label: "VER ÓRBITA PLUS",
                voz: "Ver Órbita Plus para desbloquear tus doce casas",
                onPress: () => router.push("/paywall")
              }}
            />
          ) : (
            <Card>
              <Note>
                Todavía no están las doce casas verificadas, y no se muestran a medias: media rejilla
                ubicaría mal tus puntos. Tus posiciones y tus contactos no dependen de esto.
              </Note>
            </Card>
          )}
        </View>

        {/* --- Cómo se calculó ---------------------------------------------- */}

        <View style={styles.module}>
          <ModuleHeader
            module="Cómo se calculó"
            cadence="natal · no cambia"
            intro="Tu carta se calcula con la fecha, la hora y el lugar que guardaste. No cambia con el día ni con lo que pase en el cielo: si corregís esos datos, se calcula de nuevo entera."
          />
          <EditorialRows>
            <DataRow label="A PARTIR DE" value={<Mono>Tus datos de nacimiento guardados</Mono>} />
            <DataRow label="POSICIONES" value={<Mono>Del Sol a Plutón, medidas sobre la banda de signos</Mono>} />
            <DataRow label="VERSIÓN DEL MÉTODO" value={<Mono>{chart.methodVersion}</Mono>} />
          </EditorialRows>
          <Note style={styles.spaced}>
            La versión del método identifica con qué reglas se calculó esta carta: sirve para saber si dos
            cartas se calcularon igual. Todo lo de arriba, salvo los capítulos, son las posiciones y los
            ángulos que salen del cálculo: no hay nada estimado ni redondeado en el medio.
          </Note>
          <LimitationList limitations={chart.limitations} />
        </View>
      </Section>
    </Shell>
  );
}

/**
 * "Tu carta, explicada" — los capítulos, o el estado que explica por qué no
 * están todavía.
 *
 * Los tres estados que no son la lectura resuelven INLINE: la rueda, los datos,
 * los ejes y las diez posiciones ya se dibujaron arriba y no dependen de esto,
 * así que ninguno de ellos puede tapar la pantalla.
 *
 * - `bloqueado` — el plan no incluye la lectura larga y el backend la cierra
 *   server-side. No es un error: no se ofrece REINTENTAR, se ofrece la salida.
 * - `cargando` — se está generando (acá o en el prewarm del backend).
 * - `error` — el generador falló o venció el lease: un solo REINTENTAR.
 * - `listo` — los capítulos recibidos, en orden y completos.
 */
function LecturaNatal({ lectura }: { lectura: NatalReading }) {
  if (lectura.phase === "bloqueado") {
    // El CTA propio de los capítulos: es la superficie que la compra abre
    // entera, y por eso su rótulo lo nombra ("DESBLOQUEAR MI CARTA NATAL") en
    // vez del genérico. Los contactos y las casas también ofrecen su salida,
    // cada uno en su bloque y con la etiqueta corta — decisión de Lucas
    // (2026-08-20): una superficie cerrada por plan sin acción visible deja a
    // quien la mira sin nada que hacer.
    return (
      <PlusBlock
        linea="Los siete capítulos que explican tu carta —uno por cada punto, con su título, su lectura y sus preguntas— se desbloquean con Órbita Plus. Tu rueda, tus datos y tus diez posiciones siguen acá."
        cta={{
          label: "DESBLOQUEAR MI CARTA NATAL",
          voz: "Desbloquear los siete capítulos de mi carta natal",
          onPress: () => router.push("/paywall")
        }}
      />
    );
  }
  if (lectura.phase === "cargando") {
    return (
      <Card>
        <View accessibilityLiveRegion="polite">
          <Label>ESTAMOS ESCRIBIENDO TUS CAPÍTULOS</Label>
        </View>
        <Note style={styles.spaced}>
          Se escriben una sola vez sobre tu carta y eso puede tardar un minuto. Podés salir de esta
          pantalla: el trabajo sigue igual y el resto de tu carta ya está acá arriba.
        </Note>
      </Card>
    );
  }
  if (lectura.phase === "error") {
    return (
      <Card>
        <View accessibilityLiveRegion="polite">
          <Label>TUS CAPÍTULOS NO LLEGARON</Label>
        </View>
        <Note style={styles.spaced}>
          No pudimos escribirlos ahora. Tus datos siguen guardados y tu carta sigue entera acá arriba:
          podés volver a intentarlo.
        </Note>
        <View style={styles.actionRow}>
          <PrimaryButton
            label="REINTENTAR"
            accessibilityLabel="Volver a pedir los capítulos de tu carta"
            onPress={lectura.retry}
          />
        </View>
      </Card>
    );
  }
  const capitulos = natalChapters(lectura.reading);
  if (capitulos.length === 0) {
    // Lectura recibida y sin capítulos adentro: es un resultado del generador,
    // no un límite de plan ni un cálculo que falte. No se ofrece reintento
    // porque la lectura YA está cacheada y volver a pedirla no la cambia.
    return (
      <Card>
        <Note>
          Tu lectura llegó sin capítulos. Es un resultado de cómo se escribió, no una parte cerrada: tu
          rueda, tus posiciones y tus contactos no dependen de ella.
        </Note>
      </Card>
    );
  }
  return (
    <>
      {capitulos.map((capitulo) => (
        <Capitulo key={capitulo.key} capitulo={capitulo} />
      ))}
      {lectura.reading ? <Note style={styles.block}>{lectura.reading.disclaimer}</Note> : null}
    </>
  );
}

/**
 * Un capítulo: su número, el punto que lee, su título, su cuerpo con los
 * párrafos que trajo y sus preguntas.
 *
 * Para VoiceOver el encabezado es UN solo nodo —orden, placement y título— y el
 * cuerpo queda párrafo por párrafo, que es como se recorre un texto largo. El
 * placement se dice en voz normal: la línea visible va en mayúsculas por estilo
 * y en mayúsculas un lector de pantalla puede deletrearla letra por letra.
 */
function Capitulo({ capitulo }: { capitulo: NatalChapterView }) {
  return (
    <View style={styles.chapter}>
      <View accessible accessibilityRole="header" accessibilityLabel={capitulo.voice}>
        <Label>{capitulo.numero}</Label>
        <View style={styles.chapterHead}>
          <AstroGlyph
            symbol={capitulo.glyph}
            size={16}
            color={v492.colors.copperSoft}
            strokeWidth={2}
            style={styles.rowGlyph}
          />
          <Eyebrow style={styles.rowName}>{capitulo.placement}</Eyebrow>
        </View>
        <Subtitle style={styles.spaced}>{capitulo.title}</Subtitle>
      </View>
      {capitulo.paragraphs.map((parrafo, index) => (
        <Body key={index} style={styles.spaced}>
          {parrafo}
        </Body>
      ))}
      {capitulo.questions.length > 0 ? (
        <View style={styles.chapterQuestions}>
          <Label>PARA PENSAR</Label>
          {capitulo.questions.map((pregunta) => (
            <View
              key={pregunta}
              accessible
              accessibilityRole="text"
              accessibilityLabel={pregunta}
              style={styles.spaced}
            >
              <Body style={styles.question}>{`— ${pregunta}`}</Body>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Una sección cerrada por acceso: se nombra, se explica qué contiene y se ofrece
 * la acción que la abre, para que no se lea como un cálculo roto ni como un
 * callejón sin salida.
 *
 * El botón es OBLIGATORIO (decisión de Lucas, 2026-08-20): una superficie
 * cerrada por PLAN sin acción visible deja a quien la mira sin saber qué hacer
 * con ella, y hacerlo un parámetro requerido impide que un bloque futuro se
 * quede mudo. Cada bloque nombra lo suyo: los siete capítulos ofrecen
 * `DESBLOQUEAR MI CARTA NATAL` —lo que la compra abre entero— y los contactos y
 * las casas ofrecen `VER ÓRBITA PLUS`, cada uno en su propio bloque. Son tres,
 * y son exactamente las tres superficies que el plan cierra.
 *
 * Lo que este bloque NO cubre: los estados técnicos —pendiente, sin hora, error
 * o cálculo en curso— que no son límites de plan y siguen resolviéndose con una
 * `Card` explicativa, sin salida a la compra. El resto de la carta —posiciones,
 * ejes, rueda— se muestra entero igual en todos los casos.
 */
function PlusBlock({
  linea,
  cta
}: {
  linea: string;
  /** `voz` es la etiqueta de VoiceOver: el rótulo en mayúsculas no dice qué abre. */
  cta: { label: string; voz: string; onPress: () => void };
}) {
  return (
    <Card>
      <Label>DISPONIBLE CON ÓRBITA PLUS</Label>
      <Note style={styles.spaced}>{linea}</Note>
      <View style={styles.actionRow}>
        <PrimaryButton label={cta.label} accessibilityLabel={cta.voz} onPress={cta.onPress} />
      </View>
    </Card>
  );
}

function introRueda(chart: NatalChartBase): string {
  if (drawablePositions(chart) === 0) {
    return "La rueda ubica cada punto en su grado. Sin tu hora exacta no hay grados publicados, así que no se dibuja.";
  }
  return chart.access.angles
    ? "Cada punto está dibujado en su grado real, y la rueda está girada a tu Ascendente: queda a la izquierda, con el Medio Cielo arriba."
    : "Cada punto está dibujado en su grado real. Sin Ascendente la rueda no se puede girar ni dividir en casas, así que se ve sólo la banda de signos y tus planetas.";
}

/** Qué son las líneas del centro — o por qué no hay ninguna. */
function notaDeCuerdas(chart: NatalChartBase, contactos: number): string {
  const aspectos = natalAspectsAccess(chart);
  if (aspectos === "plus") {
    return "La rueda no dibuja las líneas de los contactos: esa parte de la carta está disponible con Órbita Plus.";
  }
  if (aspectos === "pendiente") {
    return "La rueda todavía no dibuja las líneas de los contactos: tu acceso los incluye, pero el cálculo no los publicó.";
  }
  return contactos > 0
    ? "Las líneas del centro son los contactos entre tus puntos. Están explicados más abajo."
    : "No hay líneas en el centro: ningún par de puntos quedó dentro de los ángulos que este método reconoce.";
}

/** Con qué hora se calculó, dicho como dato de una fila. */
function origenDeCalculo(chart: NatalChartBase): string {
  return hasExactBirthTime(chart) ? "El instante exacto que guardaste" : "Todo tu día de nacimiento";
}

/** Por qué no hay Ascendente, Medio Cielo ni casas: los motivos no se dicen igual. */
function textoSinEjes(chart: NatalChartBase): string {
  return hasExactBirthTime(chart)
    ? "Tu Ascendente y tu Medio Cielo aparecen cuando el cálculo publique la geometría verificada de tu carta. Tus posiciones y tus contactos no dependen de eso."
    : "Sin tu hora exacta no se calculan el Ascendente, el Medio Cielo ni las casas, así que no aparecen. El Ascendente cambia cada dos horas: estimarlo sería inventarlo.";
}

/** El motivo corto, para la nota al pie de la tabla de posiciones. */
function motivoSinCasas(chart: NatalChartBase): string {
  const acceso = natalHousesAccess(chart);
  if (acceso === "sin-hora") return "sin tu hora exacta no se puede saber en qué casa cae cada punto.";
  if (acceso === "plus") return "las casas están disponibles con Órbita Plus.";
  return "todavía no están las doce casas verificadas de tu carta.";
}

function etiquetaRueda(chart: NatalChartBase): string {
  const dichas = [`Tu rueda natal, con ${drawablePositions(chart)} puntos ubicados.`];
  // Un solo lector de la lista de ejes, en el dominio: `access.angles` vale
  // `angles.length > 0`, y preguntarlo por separado invita a que dos pantallas
  // contesten distinto sobre el mismo eje.
  const ascendente = publishedAngle(chart, "ascendant");
  if (ascendente) dichas.push(angleView(ascendente).voice);
  dichas.push("Todas las posiciones están en la lista de abajo.");
  return dichas.join(" ");
}

const styles = StyleSheet.create({
  actionRow: { marginTop: v492.space.lg },
  block: { marginTop: v492.space.xl },
  // Un capítulo de "Tu carta, explicada": número, placement, título, párrafos.
  chapter: { marginTop: v492.space.xl },
  chapterHead: { alignItems: "center", flexDirection: "row", gap: v492.space.sm, marginTop: v492.space.sm },
  chapterQuestions: {
    borderTopColor: v492.colors.line,
    borderTopWidth: 1,
    marginTop: v492.space.lg,
    paddingTop: v492.space.lg
  },
  // El renglón de `EditorialList`: el aire de arriba y el de abajo son suyos,
  // porque sus filas no traen margen propio.
  editorialItem: { paddingVertical: v492.space.md },
  // El renglón de `EditorialRows` sólo pone el aire de ABAJO: el de arriba ya lo
  // trae `DataRow`. Ver la nota del helper.
  editorialPair: { paddingBottom: v492.space.md },
  intro: { marginBottom: v492.space.xl, marginTop: v492.space.lg },
  introMeta: { marginTop: v492.space.md },
  module: { marginTop: v492.space.xxl },
  question: { color: v492.colors.text },
  row: { alignItems: "baseline", flexDirection: "row", gap: v492.space.md },
  rowData: { alignItems: "flex-end", flexShrink: 1 },
  rowGlyph: { alignSelf: "center" },
  rowName: { flex: 1 },
  rowSpaced: { marginTop: v492.space.md },
  rowTag: { color: v492.colors.textDim, marginTop: 2, textAlign: "right" },
  rowTheme: { marginTop: v492.space.xs },
  rowValue: { color: v492.colors.text, flexShrink: 1, textAlign: "right" },
  spaced: { marginTop: v492.space.md },
  // La caja de la rueda necesita ancho PROPIO: `MeasuredSquare` mide su
  // contenedor y sin medida real no dibuja nada (misma nota que en el hub).
  wheel: { alignSelf: "stretch", marginBottom: v492.space.lg, width: "100%" }
});
