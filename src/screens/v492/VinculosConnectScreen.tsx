import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ActivityIndicator, Keyboard, StyleSheet, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { Card, ModuleHeader } from "@/components/v492/Module";
import { DetailLayerScreen, Section } from "@/components/v492/Screen";
import { Touchable } from "@/components/v492/Touchable";
import {
  EmptyBlock,
  ErrorBlock,
  GuestBlock,
  LoadingBlock,
  PrimaryButton
} from "@/components/v492/States";
import { Body, Label, Mono, Note, Subtitle } from "@/components/v492/typography";
import { v492 } from "@/components/v492/tokens";
import { timezoneLookupFor } from "@/domain/placeTimezone";
import {
  createRelationshipIdempotencyKey,
  emptyRelationshipDraft,
  findRelationshipProfile,
  RELATIONSHIP_LEVEL_FORM,
  RELATIONSHIP_LEVEL_LABEL,
  RELATIONSHIP_READING_LIMITS_LABEL,
  RELATIONSHIP_SIGNS,
  RELATIONSHIP_WHAT_YOU_SEE_LABEL,
  relationshipDataLevelLine,
  relationshipDraftBlock,
  relationshipDraftFromProfile,
  relationshipLevelFromDraft,
  relationshipSaveArgs,
  relationshipSavedHref,
  relationshipSaveSignature,
  VINCULOS_FORM_ROUTE,
  VINCULOS_ROUTE,
  type RelationshipDraft,
  type RelationshipSaveIntent,
  type RelationshipSignKey
} from "@/domain/relationships";
import { useLayers } from "@/hooks/useLayers";
import { BirthDateField, BirthTimeField } from "@/onboarding/components/BirthDateTimeField";
import { appApi } from "@/services/appRefs";
import { searchPlaces, type PlaceHit } from "@/services/geocoding";
import {
  relationshipsApi,
  type ComparisonLevel,
  type RelationshipProfile
} from "@/services/relationshipsApi";

/**
 * Vínculos · cargar los datos de una persona (`/vinculos/conectar`).
 *
 * La misma pantalla hace el alta y la edición, porque son la misma decisión:
 * QUÉ datos hay de esa persona. Con `?profileId=` abre los datos ya guardados
 * —validados contra la lista autorizada de la cuenta, nunca contra la URL— y
 * guarda SOBRE ella; sin parámetro, da de alta a alguien nuevo. Es lo que evita
 * que "completar sus datos" termine creando una segunda copia de la misma
 * persona.
 *
 * **El nivel no se elige dos veces (QA22-018).** El nivel de comparación es una
 * CONSECUENCIA de la precisión de los datos, no una preferencia: se deriva con
 * `relationshipLevelFromDraft` y la pantalla lo ANUNCIA. Por eso "Completar sus
 * datos" y "Editar datos de …" entran directo al formulario precompletado, con
 * todos los campos a la vista y sin volver a pasar por el selector de modalidad.
 *
 * En el ALTA el selector sigue existiendo, porque ahí cumple otra función: no
 * guarda un nivel, decide QUÉ datos se van a pedir. Elegir una modalidad no
 * navega por sí solo y no esconde el CTA — `CONTINUAR` queda inmediatamente
 * debajo de las tres opciones y siempre accionable (QA22-013).
 *
 * Cada dato se guarda por lo que es, sin completar lo que falta:
 * - **Signo**: uno de los doce, elegido a mano. Se guarda el signo y nada más;
 *   no se inventa una fecha ni una hora para completar el perfil.
 * - **Fecha**: el día. `birthTimePrecision` queda en `unknown` —no hay hora que
 *   declarar— y el signo NO se deriva de la fecha: un dato que la persona no
 *   cargó no puede aparecer guardado como si lo hubiera cargado. La ciudad es
 *   opcional y sirve para una sola cosa: acotar la franja del día a esa zona
 *   horaria. No habilita casas ni Ascendente, porque eso lo define la hora.
 * - **Carta completa**: día, hora exacta y una ciudad elegida en el buscador
 *   real (Photon). Antes de guardar, la zona horaria se resuelve en el backend
 *   a partir de las COORDENADAS de esa ciudad. Si no se resuelve, no se guarda
 *   nada: la zona del teléfono es la equivocada para alguien nacido en otra, y
 *   una carta calculada en la zona equivocada no es la carta de nadie.
 *
 * **Guardar no es calcular (QA22-016).** Al terminar se vuelve a la raíz de
 * Vínculos con la persona a la vista y una confirmación de que quedó guardada;
 * la comparación se prepara en SU fila, no reemplazando la pantalla, y abrir la
 * lectura es una acción explícita (QA22-015).
 *
 * Cero maqueta: la persona guardada sale de `relationships.savePerson` y el id
 * que se confirma es el que devolvió el backend.
 */

/** Los tres niveles del contrato, del que menos pide al que más lee. */
const LEVELS: readonly ComparisonLevel[] = ["sign_to_sign", "date_to_date", "chart_to_chart"];

/** Debajo de tres letras no se consulta al buscador de ciudades. */
const PLACE_QUERY_MIN = 3;
const PLACE_DEBOUNCE_MS = 300;

export function VinculosConnectScreen() {
  // Misma fase que la raíz de Vínculos: sin sesión no hay cuenta donde guardar,
  // y sin carta propia no hay contra qué comparar a nadie. Guardar personas en
  // cualquiera de esos dos estados sería juntar datos que no se pueden leer.
  const { phase, retrySession } = useLayers();
  // Lo que llega por la URL es un string, no un id: acá sólo se lee, y quien lo
  // convierte en una persona es la lista autorizada de la cuenta.
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  const pedido = typeof profileId === "string" ? profileId.trim() : "";

  if (phase === "cargando") {
    return (
      <Shell editando={Boolean(pedido)}>
        <LoadingBlock message="Buscando tu carta…" />
      </Shell>
    );
  }
  if (phase === "error") {
    return (
      <Shell editando={Boolean(pedido)}>
        <ErrorBlock onRetry={retrySession} />
      </Shell>
    );
  }
  if (phase === "invitado") {
    return (
      <Shell editando={Boolean(pedido)}>
        <GuestBlock />
      </Shell>
    );
  }
  if (phase === "vacio") {
    return (
      <Shell editando={Boolean(pedido)}>
        <EmptyBlock />
      </Shell>
    );
  }
  return <ConnectFlow pedido={pedido ? pedido : null} />;
}

/** Un único shell para todos los estados: la pantalla no cambia de marco. */
function Shell({ children, editando }: { children: ReactNode; editando: boolean }) {
  return (
    <DetailLayerScreen
      eyebrow={editando ? "VÍNCULOS · SUS DATOS" : "VÍNCULOS · AGREGAR PERSONA"}
      fallbackHref={VINCULOS_ROUTE}
      keyboardAware
    >
      {children}
    </DetailLayerScreen>
  );
}

/**
 * Resuelve a QUIÉN se está editando antes de montar el formulario.
 *
 * La lista sólo se pide cuando hay un id para validar: un alta común no
 * necesita saber a quién más tenés guardado. Si el id no está en tu lista no se
 * abre un formulario vacío como si nada hubiera pasado —eso guardaría una
 * persona nueva en lugar de editar la que se pidió—: se dice qué pasó y se
 * ofrece el alta explícitamente.
 */
function ConnectFlow({ pedido }: { pedido: string | null }) {
  const personas = useQuery(relationshipsApi.list, pedido ? {} : "skip");
  const persona = findRelationshipProfile(personas, pedido);

  if (!pedido) return <ConnectForm persona={null} />;
  if (persona === undefined) {
    return (
      <Shell editando>
        <LoadingBlock message="Buscando esta persona…" />
      </Shell>
    );
  }
  if (persona === null) {
    return (
      <Shell editando>
        <Section>
          <Card>
            <Body>
              Este enlace no corresponde a ninguna persona guardada en tu cuenta. Puede haberse
              borrado, o pertenecer a otra cuenta. No abrimos un formulario vacío: guardarlo
              crearía una persona nueva en vez de completar la que buscabas.
            </Body>
          </Card>
          <View style={styles.cta}>
            <PrimaryButton
              label="AGREGAR UNA PERSONA NUEVA"
              accessibilityLabel="Agregar una persona nueva"
              onPress={() => router.replace(VINCULOS_FORM_ROUTE as never)}
            />
          </View>
        </Section>
      </Shell>
    );
  }
  // La clave remonta el formulario si cambia la persona: el borrador se siembra
  // una sola vez, al montar, y no se pisa mientras se está escribiendo.
  return <ConnectForm key={persona.profileId} persona={persona} />;
}

function ConnectForm({ persona }: { persona: RelationshipProfile | null }) {
  const savePerson = useMutation(relationshipsApi.savePerson);
  // La zona horaria del LUGAR, derivada de sus coordenadas en el backend. El
  // buscador devuelve etiqueta y coordenadas, nunca la zona.
  const resolveTimezone = useAction(appApi.placeTimezone.atCoordinates);

  const [draft, setDraft] = useState<RelationshipDraft>(() =>
    persona ? relationshipDraftFromProfile(persona) : emptyRelationshipDraft()
  );
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeHits, setPlaceHits] = useState<PlaceHit[]>([]);
  const [placeSearching, setPlaceSearching] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const editando = Boolean(persona);
  /**
   * El ALTA es un FLUJO: 1 nombre → 2 qué comparar → 3 los datos de ese nivel.
   *
   * La pantalla única pedía decidir todo a la vez y la consecuencia de elegir
   * quedaba fuera de la vista (decisión de producto, 2026-08-19).
   *
   * La EDICIÓN entra directo a los datos, con TODOS los campos precompletados y
   * SIN el selector de modalidad: ahí el nivel ya no es una decisión, es lo que
   * los datos permiten, y volver a preguntarlo era pedir dos veces lo mismo
   * (QA22-018).
   */
  const [paso, setPaso] = useState<"nombre" | "nivel" | "datos">(persona ? "datos" : "nombre");
  /**
   * Qué datos dijo que iba a cargar, SÓLO en el alta. Es intención de pantalla
   * —decide qué campos se piden— y no se guarda en ningún lado: lo que queda
   * persistido es el nivel derivado de los datos.
   */
  const [objetivo, setObjetivo] = useState<ComparisonLevel>("sign_to_sign");
  const intencion = editando ? null : objetivo;
  const visible = (bloque: "nombre" | "nivel" | "datos") =>
    editando ? bloque !== "nivel" : paso === bloque;

  // El guardado en vuelo vive en un ref y no en `saving`: `saving` recién
  // existe en el render SIGUIENTE, así que dos toques en el mismo tick entran
  // los dos al handler y guardan dos veces. El ref cierra la puerta en el
  // mismo tick; `saving` sigue siendo sólo lo que se ve en pantalla.
  const enVuelo = useRef(false);
  // Y una vez que el backend confirmó, la puerta queda cerrada: entre la
  // respuesta y el desmonte de la pantalla hay varios frames, y un segundo
  // toque ahí mandaría un pedido más sobre una persona que ya existe.
  const guardado = useRef(false);
  // El último pedido que salió: su huella y la clave con la que salió. Es lo
  // que permite reconocer un reintento del MISMO pedido —y reusar su clave— sin
  // reusarla cuando se cambió un dato, que sería otro pedido con la marca del
  // anterior.
  const intento = useRef<RelationshipSaveIntent | null>(null);

  const patch = useCallback(
    (next: Partial<RelationshipDraft>) => setDraft((current) => ({ ...current, ...next })),
    []
  );

  /**
   * El nivel que permiten los datos cargados: la ÚNICA derivación, la misma que
   * se va a guardar y la misma que el backend publica sobre el perfil.
   */
  const nivelDerivado = relationshipLevelFromDraft(draft);
  const conFecha = nivelDerivado !== "sign_to_sign";

  // Qué campos pide esta pantalla. Al editar los deciden los DATOS —el signo
  // sólo mientras no haya fecha, la hora y la ciudad sólo cuando sí—; en el alta
  // los decide la modalidad elegida, que es justamente lo que esa elección hace.
  const pideSigno = editando ? !conFecha : objetivo === "sign_to_sign";
  const pideFecha = editando || objetivo !== "sign_to_sign";
  const pideHora = editando ? conFecha : objetivo === "chart_to_chart";
  // La ciudad entra en los dos casos que pueden usarla: con hora exacta —de ahí
  // salen las casas— y con la fecha sola, donde acota la franja del día.
  const admiteCiudad = editando ? conFecha : objetivo !== "sign_to_sign";

  // Buscador de ciudades real, con debounce y cancelación — el mismo Photon del
  // alta y del editor de datos propios.
  useEffect(() => {
    const query = placeQuery.trim();
    if (!admiteCiudad || query.length < PLACE_QUERY_MIN) {
      setPlaceHits([]);
      setPlaceSearching(false);
      return;
    }
    const controller = new AbortController();
    setPlaceSearching(true);
    const timer = setTimeout(() => {
      searchPlaces(query, controller.signal)
        .then((hits) => {
          if (controller.signal.aborted) return;
          setPlaceHits(hits);
          setPlaceSearching(false);
          setPlaceError(null);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setPlaceHits([]);
          setPlaceSearching(false);
          setPlaceError("No pudimos buscar ciudades ahora. Revisá tu conexión y probá de nuevo.");
        });
    }, PLACE_DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [placeQuery, admiteCiudad]);

  /**
   * Sólo una elección explícita del buscador fija el lugar, y sólo si vino con
   * coordenadas usables: `timezoneLookupFor` es el mismo borde que decide si se
   * puede pedir la zona. Un resultado sin coordenadas no se acepta acá, en vez
   * de morir al guardar.
   */
  const choosePlace = (hit: PlaceHit) => {
    const coordinates = timezoneLookupFor({ latitude: hit.latitude, longitude: hit.longitude });
    if (!coordinates) {
      setPlaceError(
        "Esa ciudad llegó sin coordenadas y sin ellas no podemos resolver su zona horaria. Probá con otra."
      );
      return;
    }
    patch({
      place: {
        label: hit.label,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude
      }
    });
    setPlaceQuery("");
    setPlaceHits([]);
    setPlaceError(null);
    Keyboard.dismiss();
  };

  /**
   * Quitar la fecha se lleva la hora y la ciudad con ella.
   *
   * Sin fecha esos dos datos no se guardan, y dejarlos escritos en pantalla
   * mostraría como cargado algo que el guardado va a descartar. Bajar de nivel
   * tiene que ser tan explícito como subirlo (QA22-023).
   */
  const quitarFecha = () => patch({ birthDate: null, birthTime: null, place: null });

  const block = relationshipDraftBlock(draft, intencion);

  const save = async () => {
    // Dos puertas, cada una para un momento distinto: lo que YA se guardó no se
    // vuelve a mandar, y lo que está saliendo —o todavía no puede salir— tampoco.
    if (guardado.current) return;
    if (enVuelo.current || block !== null) return;
    enVuelo.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      // Fallar cerrado: la zona se resuelve ANTES de escribir. Si el backend no
      // la devuelve, no se guarda la persona a medias ni se cae a la zona del
      // dispositivo — se dice el problema y los datos cargados quedan intactos.
      // Sólo se pide para la ciudad que efectivamente se va a guardar: con el
      // nivel derivado en signo, el lugar no viaja.
      let timezone: string | null = null;
      if (conFecha && draft.place) {
        const resolved = await resolveTimezone({
          latitude: draft.place.latitude,
          longitude: draft.place.longitude
        }).catch(() => null);
        timezone = resolved ? resolved.timezone.trim() : null;
        if (!timezone) {
          setSaveError(
            nivelDerivado === "chart_to_chart"
              ? "No pudimos resolver la zona horaria de esa ciudad. Sin ella la carta se calcularía en la hora equivocada, así que no guardamos nada: probá de nuevo o elegí otra ciudad."
              : "No pudimos resolver la zona horaria de esa ciudad. Sin ella no podríamos acotar la franja del día, así que no guardamos nada: probá de nuevo, elegí otra ciudad o quitala y guardá sólo la fecha."
          );
          return;
        }
      }
      // El `profileId` viaja sólo cuando se está editando: es lo que hace que
      // esta persona se actualice —y suba de nivel— en vez de duplicarse.
      const perfilEditado = persona ? persona.profileId : null;
      // Una clave por INTENCIÓN, no por toque. Si el pedido es idéntico al que
      // ya salió —misma persona, mismos datos— viaja con la misma clave y el
      // backend devuelve la que ya guardó en vez de crear una segunda copia
      // cuando la respuesta anterior se perdió. Si cambió cualquier dato es
      // otra intención y estrena clave: reusarla ahí sería mandar un pedido
      // nuevo con la marca del anterior.
      const firma = relationshipSaveSignature(draft, timezone, perfilEditado);
      const previo = intento.current;
      const idempotencyKey =
        previo && previo.signature === firma
          ? previo.idempotencyKey
          : createRelationshipIdempotencyKey();
      const args = relationshipSaveArgs(draft, timezone, perfilEditado, idempotencyKey);
      // Las dos condiciones son el mismo hecho: sin pedido posible no hay huella.
      if (!args || firma === null) {
        setSaveError("Faltan datos para guardar a esta persona en el nivel elegido.");
        return;
      }
      // Recién acá queda anotado el intento: es la clave que efectivamente sale.
      intento.current = { signature: firma, idempotencyKey };
      const saved = await savePerson(args);
      // Guardar no es calcular. Se vuelve a la RAÍZ de Vínculos con el id que
      // devolvió el backend, para confirmar el alta con la persona a la vista;
      // la comparación se prepara en su fila y su lectura se abre a mano.
      guardado.current = true;
      router.dismissTo(
        relationshipSavedHref(saved.profileId, persona ? "edicion" : "alta") as never
      );
    } catch {
      setSaveError(
        persona
          ? "No pudimos guardar los datos de esta persona. No se cambió nada: revisá tu conexión y probá de nuevo."
          : "No pudimos guardar a esta persona. No se guardó nada: revisá tu conexión y probá de nuevo."
      );
    } finally {
      enVuelo.current = false;
      setSaving(false);
    }
  };

  // El paso 2 describe la MODALIDAD elegida —lo hace `QueVasAVer`, que toma el
  // nivel y busca su propia forma—; el de los campos, el nivel que los datos ya
  // permiten.
  const formaCampos = RELATIONSHIP_LEVEL_FORM[editando ? nivelDerivado : objetivo];
  const objetivoLabel = RELATIONSHIP_LEVEL_LABEL[objetivo];
  const nivelLabel = RELATIONSHIP_LEVEL_LABEL[nivelDerivado].toLowerCase();

  return (
    <Shell editando={Boolean(persona)}>
      <Section>
        <ModuleHeader
          module={persona ? `Los datos de ${persona.name}` : "Agregar una persona"}
          cadence={persona ? "se recalcula al guardar" : "se guarda en tu cuenta"}
          intro={
            persona
              ? "Estos son los datos que ya cargaste de esta persona. Completá o corregí lo que quieras: el nivel de la comparación sale de estos datos, no hay que elegirlo. Se guarda sobre la misma persona, no se crea otra."
              : paso === "nombre"
                ? "Primero, cómo la llamás. Después elegís qué querés comparar, y recién ahí cargás los datos que ese nivel necesita."
                : paso === "nivel"
                  ? "Cuanto más preciso es el dato, más cosas puede leer el cálculo: con el signo alcanza para el estilo general, con la fecha entran las posiciones que se mantienen durante todo ese día, y con la hora exacta y la ciudad entran además las casas y los Ascendentes."
                  : "Los datos que este nivel necesita. Lo que no cargues no se inventa."
          }
        />
        {!editando ? (
          <Label style={styles.pasoLabel}>
            {paso === "nombre" ? "PASO 1 DE 3 · NOMBRE" : paso === "nivel" ? "PASO 2 DE 3 · QUÉ COMPARAR" : "PASO 3 DE 3 · SUS DATOS"}
          </Label>
        ) : null}

        {visible("nombre") ? (
        <View style={styles.field}>
          <Label>NOMBRE</Label>
          <TextInput
            value={draft.name}
            onChangeText={(text) => patch({ name: text })}
            placeholder="Cómo la llamás"
            placeholderTextColor={v492.colors.textDim}
            accessibilityLabel="Nombre de la persona"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={60}
            returnKeyType="done"
            style={styles.input}
          />
          <View style={styles.inputLine} />
          <Note style={styles.hint}>
            Es para reconocerla en tu lista. No entra en ningún cálculo.
          </Note>
          {!editando ? (
            <View style={styles.cta}>
              <PrimaryButton
                label="CONTINUAR"
                accessibilityLabel="Continuar al paso siguiente"
                onPress={() => setPaso("nivel")}
                disabled={draft.name.trim().length === 0}
              />
            </View>
          ) : null}
        </View>
        ) : null}

        {visible("nivel") ? (
        <View style={styles.field}>
          <Label>QUÉ QUERÉS COMPARAR</Label>
          <View
            style={styles.levels}
            accessibilityRole="radiogroup"
            accessibilityLabel="Nivel de comparación"
          >
            {LEVELS.map((level) => (
              <LevelOption
                key={level}
                level={level}
                selected={level === objetivo}
                // Elegir NO navega: sólo elige. La pantalla no decide por vos
                // apenas tocás una opción (QA22-013).
                onSelect={() => setObjetivo(level)}
              />
            ))}
          </View>
          {/* Elegir tiene que acusar recibo. Sin esta línea la selección cambiaba
              un borde y nada más, y con el CTA fuera de la vista parecía que la
              elección no había habilitado nada (QA22-013). VoiceOver la anuncia
              sin que haya que ir a buscarla. */}
          <View style={styles.eleccion} accessibilityLiveRegion="polite">
            <Note>{`Elegiste ${objetivoLabel.toLocaleLowerCase("es")}. CONTINUAR, acá abajo, carga los datos que ese nivel necesita.`}</Note>
          </View>
          {/* El CTA va PEGADO a las opciones y nunca se apaga: hay una modalidad
              elegida desde el primer render, así que siempre hay algo que
              continuar. El límite del nivel queda debajo —se sigue leyendo antes
              de cargar ningún dato— en vez de empujar la acción fuera de la
              pantalla, que era el defecto exacto. */}
          <View style={styles.cta}>
            <PrimaryButton
              label="CONTINUAR"
              accessibilityLabel={`Continuar y cargar los datos para comparar ${objetivoLabel.toLocaleLowerCase("es")}`}
              onPress={() => setPaso("datos")}
            />
          </View>
          <QueVasAVer level={objetivo} />
          <Pressable
            onPress={() => setPaso("nombre")}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.pasoBack}
          >
            <Note>VOLVER AL PASO ANTERIOR</Note>
          </Pressable>
        </View>
        ) : null}

        {visible("datos") && pideFecha ? (
          <View style={styles.field}>
            <BirthDateField
              value={draft.birthDate}
              onChange={(birthDate) => patch({ birthDate })}
              label="Fecha de nacimiento"
            />
            {editando && draft.birthDate ? (
              <Touchable
                onPress={quitarFecha}
                accessibilityRole="button"
                accessibilityLabel="Quitar la fecha de nacimiento de esta persona"
                accessibilityHint="También se quitan la hora y la ciudad, y la comparación vuelve a signo con signo"
                style={styles.quitar}
                pressedStyle={styles.pressed}
              >
                <Label style={styles.quitarTexto}>QUITAR LA FECHA</Label>
              </Touchable>
            ) : null}
          </View>
        ) : null}

        {visible("datos") && pideSigno ? (
          <View style={styles.field}>
            <Label>SIGNO</Label>
            <SignPicker
              value={draft.zodiacSign}
              onChange={(zodiacSign) => patch({ zodiacSign })}
            />
            <Note style={styles.hint}>
              Guardamos sólo el signo. No inventamos una fecha ni una hora para completar el perfil.
            </Note>
          </View>
        ) : null}

        {visible("datos") && nivelDerivado === "date_to_date" ? (
          <Note style={styles.hint}>
            Guardamos el día y, si la cargás, la ciudad. No deducimos el signo desde la fecha ni
            suponemos una hora: lo que no cargaste no queda guardado como si lo hubieras cargado.
          </Note>
        ) : null}

        {visible("datos") && pideHora ? (
          <View style={styles.field}>
            <Label>HORA EXACTA</Label>
            <BirthTimeField
              value={draft.birthTime}
              onChange={(birthTime) => patch({ birthTime })}
              label="Hora exacta"
            />
            <Note style={styles.hint}>
              Tiene que ser la hora real de nacimiento. Una hora aproximada mueve las casas y el
              Ascendente, que son justo lo que este nivel agrega.
            </Note>
            {editando && draft.birthTime ? (
              <Touchable
                onPress={() => patch({ birthTime: null })}
                accessibilityRole="button"
                accessibilityLabel="Quitar la hora de nacimiento de esta persona"
                accessibilityHint="La comparación baja a fecha con fecha: sin hora no hay casas ni Ascendente"
                style={styles.quitar}
                pressedStyle={styles.pressed}
              >
                <Label style={styles.quitarTexto}>QUITAR LA HORA</Label>
              </Touchable>
            ) : null}
          </View>
        ) : null}

        {visible("datos") && admiteCiudad ? (
          <View style={styles.field}>
            <Label>
              {draft.birthTime ? "CIUDAD DE NACIMIENTO" : "CIUDAD DE NACIMIENTO (OPCIONAL)"}
            </Label>
            <PlaceField
              chosen={draft.place ? draft.place.label : null}
              query={placeQuery}
              hits={placeHits}
              searching={placeSearching}
              problem={placeError}
              clearLabel={draft.birthTime ? "ELEGIR OTRA" : "QUITAR O CAMBIAR"}
              onQuery={setPlaceQuery}
              onChoose={choosePlace}
              onClear={() => patch({ place: null })}
            />
            <Note style={styles.hint}>
              {formaCampos.optional ??
                "La zona horaria sale de las coordenadas de esa ciudad y la resolvemos al guardar. Nunca usamos la zona de tu teléfono: para alguien nacido en otra, sería la equivocada."}
            </Note>
          </View>
        ) : null}

        {/* El nivel que estos datos permiten, DICHO y no pedido. Es el mismo
            cálculo que se va a guardar, así que la pantalla no puede prometer un
            escalón que el perfil persistido no dé (QA22-018).

            En el alta aparece recién cuando los datos del nivel elegido están
            completos: con el formulario todavía vacío diría "signo con signo"
            —que es cierto de la nada cargada— y se leería como si la modalidad
            elegida se hubiera ignorado. */}
        {visible("datos") && (editando || block === null) ? (
          <View style={styles.nivel} accessibilityLiveRegion="polite">
            <Label style={styles.nivelLabel}>NIVEL QUE PERMITEN ESTOS DATOS</Label>
            <Mono style={styles.nivelValor}>{RELATIONSHIP_LEVEL_LABEL[nivelDerivado]}</Mono>
            <Note style={styles.hint}>{relationshipDataLevelLine(nivelDerivado)}</Note>
          </View>
        ) : null}

        {/* Una sola región viva para los tres estados del guardado: en curso,
            fallido o bloqueado. Un lector de pantalla la anuncia sin que haya
            que ir a buscarla, y nunca dicen dos cosas a la vez. */}
        {visible("datos") ? (
        <>
        <View style={styles.status} accessibilityLiveRegion="polite">
          {saving ? <Note>Guardando estos datos en tu cuenta…</Note> : null}
          {!saving && saveError !== null ? (
            <View style={styles.alert} accessibilityRole="alert">
              <Body style={styles.alertText}>{saveError}</Body>
            </View>
          ) : null}
          {!saving && saveError === null && block !== null ? <Note>{block}</Note> : null}
        </View>

        <View style={styles.cta}>
          <PrimaryButton
            label={
              saving
                ? "GUARDANDO…"
                : saveError !== null
                  ? "REINTENTAR"
                  : persona
                    ? "GUARDAR SUS DATOS"
                    : "GUARDAR PERSONA"
            }
            accessibilityLabel={
              persona
                ? `Guardar los datos de ${persona.name} para comparar ${nivelLabel}`
                : `Guardar esta persona para comparar ${nivelLabel}`
            }
            onPress={save}
            disabled={saving || block !== null}
          />
        </View>
        {!editando ? (
          <Pressable
            onPress={() => setPaso("nivel")}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.pasoBack}
          >
            <Note>VOLVER AL PASO ANTERIOR</Note>
          </Pressable>
        ) : null}
        </>
        ) : null}
      </Section>
    </Shell>
  );
}

/**
 * Qué va a ver, y —a un toque— qué esta lectura no puede afirmar (QA22-014).
 *
 * En el build 22 acá había un bloque titulado `LO QUE ESTE CÁLCULO NO DICE`, en
 * medio del alta y sin relación visible con la decisión de arriba: no se
 * entendía si explicaba qué compara la lectura, una limitación del cálculo o una
 * advertencia legal. Ahora son dos piezas con jerarquía:
 *
 * 1. **`QUÉ VAS A VER`** — siempre visible, y es lo primero: qué información usa
 *    esta lectura, en la voz del nivel elegido.
 * 2. **`LÍMITES DE ESTA LECTURA`** — detrás de un toque, porque es lo que hay
 *    que poder consultar sin que interrumpa la acción principal. Está cerrado
 *    por omisión, pero el rótulo se ve siempre: nunca es una letra chica.
 *
 * Los dos rótulos son copy literal y viven en el dominio; acá sólo se muestran.
 */
function QueVasAVer({ level }: { level: ComparisonLevel }) {
  const [abierto, setAbierto] = useState(false);
  const form = RELATIONSHIP_LEVEL_FORM[level];
  return (
    <View style={styles.queVasAVer}>
      <Label style={styles.queVasAVerLabel}>{RELATIONSHIP_WHAT_YOU_SEE_LABEL}</Label>
      <Note style={styles.queVasAVerTexto}>{form.adds}</Note>
      <Touchable
        onPress={() => setAbierto((valor) => !valor)}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        accessibilityLabel={RELATIONSHIP_READING_LIMITS_LABEL.toLocaleLowerCase("es")}
        accessibilityHint={abierto ? "Toca para ocultarlos" : "Toca para leer qué no puede afirmar esta lectura"}
        style={styles.limites}
        pressedStyle={styles.pressed}
      >
        <Label style={styles.limitesTexto}>{RELATIONSHIP_READING_LIMITS_LABEL}</Label>
      </Touchable>
      {abierto ? <Note style={styles.queVasAVerTexto}>{form.cannot}</Note> : null}
    </View>
  );
}

/**
 * Una opción de nivel: cómo se llama, qué pide y qué agrega. Es un `radio` real
 * para VoiceOver y toda la tarjeta es el objetivo táctil.
 */
function LevelOption({
  level,
  selected,
  onSelect
}: {
  level: ComparisonLevel;
  selected: boolean;
  onSelect: () => void;
}) {
  const form = RELATIONSHIP_LEVEL_FORM[level];
  const label = RELATIONSHIP_LEVEL_LABEL[level];
  return (
    <Touchable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}. Pide: ${form.asks} ${form.adds}`}
      style={[styles.level, selected ? styles.levelOn : null]}
      pressedStyle={styles.pressed}
    >
      <Subtitle>{label}</Subtitle>
      <Mono style={styles.levelAsks}>{form.asks}</Mono>
      <Note style={styles.levelAdds}>{form.adds}</Note>
    </Touchable>
  );
}

/** Los doce signos, elegidos a mano. No hay ninguno preseleccionado. */
function SignPicker({
  value,
  onChange
}: {
  value: RelationshipSignKey | null;
  onChange: (sign: RelationshipSignKey) => void;
}) {
  return (
    <View style={styles.signs} accessibilityRole="radiogroup" accessibilityLabel="Signo">
      {RELATIONSHIP_SIGNS.map((sign) => {
        const selected = sign.key === value;
        return (
          <Touchable
            key={sign.key}
            onPress={() => onChange(sign.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={sign.label}
            style={[styles.sign, selected ? styles.signOn : null]}
            pressedStyle={styles.pressed}
          >
            <Body style={selected ? styles.signTextOn : styles.signText}>{sign.label}</Body>
          </Touchable>
        );
      })}
    </View>
  );
}

/**
 * Buscador de ciudades. Mientras no haya una elegida, el campo queda abierto;
 * elegida una, se muestra cuál y se puede cambiar o quitar. Nunca se acepta lo
 * tipeado como lugar: sin coordenadas no hay zona horaria que resolver.
 */
function PlaceField({
  chosen,
  query,
  hits,
  searching,
  problem,
  clearLabel,
  onQuery,
  onChoose,
  onClear
}: {
  chosen: string | null;
  query: string;
  hits: PlaceHit[];
  searching: boolean;
  problem: string | null;
  clearLabel: string;
  onQuery: (text: string) => void;
  onChoose: (hit: PlaceHit) => void;
  onClear: () => void;
}) {
  if (chosen !== null) {
    return (
      <Card style={styles.placeCard}>
        <Mono>{chosen}</Mono>
        <Touchable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Quitar esta ciudad o elegir otra"
          style={styles.placeChange}
          pressedStyle={styles.pressed}
        >
          <Label style={styles.placeChangeText}>{clearLabel}</Label>
        </Touchable>
      </Card>
    );
  }
  return (
    <View>
      <TextInput
        value={query}
        onChangeText={onQuery}
        placeholder="Buscar la ciudad…"
        placeholderTextColor={v492.colors.textDim}
        accessibilityLabel="Buscar la ciudad de nacimiento"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <View style={styles.inputLine} />
      {searching ? (
        <View style={styles.placeSearching}>
          <ActivityIndicator color={v492.colors.copper} />
        </View>
      ) : null}
      {problem !== null ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Note style={styles.placeProblem}>{problem}</Note>
        </View>
      ) : null}
      <View accessibilityLiveRegion="polite">
        {hits.map((hit) => (
          <Touchable
            key={hit.label}
            onPress={() => onChoose(hit)}
            accessibilityRole="button"
            accessibilityLabel={hit.label}
            style={styles.hit}
            pressedStyle={styles.pressed}
          >
            <Body>{hit.label}</Body>
          </Touchable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pasoBack: { alignItems: "center", marginTop: v492.space.md, minHeight: 44, justifyContent: "center" },
  pasoLabel: { color: v492.colors.copper, marginTop: v492.space.md },
  alert: {
    borderColor: v492.colors.copper,
    borderRadius: v492.radius.md,
    borderWidth: 1,
    padding: v492.space.lg
  },
  alertText: { color: v492.colors.copperSoft },
  cta: { marginTop: v492.space.xl },
  eleccion: { marginTop: v492.space.md },
  field: { marginTop: v492.space.xxl },
  hint: { marginTop: v492.space.md },
  hit: {
    borderBottomColor: v492.colors.line,
    borderBottomWidth: 1,
    justifyContent: "center",
    minHeight: v492.touch,
    paddingVertical: v492.space.md
  },
  input: {
    color: v492.colors.text,
    fontFamily: v492.fonts.serif,
    fontSize: v492.type.subtitle.size,
    lineHeight: v492.type.subtitle.line,
    marginTop: v492.space.sm,
    minHeight: v492.touch,
    paddingVertical: v492.space.sm
  },
  inputLine: { backgroundColor: v492.colors.line, height: 1 },
  level: {
    backgroundColor: v492.colors.surface,
    borderColor: v492.colors.line,
    borderRadius: v492.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: v492.touch,
    padding: v492.space.lg
  },
  levelAdds: { marginTop: v492.space.sm },
  levelAsks: { marginTop: v492.space.xs },
  levelOn: { backgroundColor: v492.colors.surfaceRaised, borderColor: v492.colors.copper },
  levels: { gap: v492.space.md, marginTop: v492.space.md },
  nivel: { marginTop: v492.space.xxl },
  nivelLabel: { color: v492.colors.copperSoft },
  nivelValor: { color: v492.colors.text, marginTop: v492.space.xs },
  placeCard: { marginTop: v492.space.md },
  placeChange: {
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: v492.space.md,
    minHeight: v492.touch,
    minWidth: v492.touch
  },
  placeChangeText: { color: v492.colors.copperSoft },
  placeProblem: { color: v492.colors.copperSoft, marginTop: v492.space.md },
  placeSearching: { alignItems: "flex-start", paddingVertical: v492.space.md },
  pressed: { opacity: 0.7 },
  queVasAVer: { marginTop: v492.space.xl },
  queVasAVerLabel: { color: v492.colors.copperSoft },
  queVasAVerTexto: { marginTop: v492.space.sm },
  limites: {
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: v492.space.md,
    minHeight: v492.touch,
    minWidth: v492.touch
  },
  limitesTexto: { color: v492.colors.textMuted },
  quitar: {
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: v492.space.md,
    minHeight: v492.touch,
    minWidth: v492.touch
  },
  quitarTexto: { color: v492.colors.textDim },
  sign: {
    alignItems: "center",
    borderColor: v492.colors.line,
    borderRadius: v492.radius.pill,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    justifyContent: "center",
    minHeight: v492.touch,
    paddingHorizontal: v492.space.md,
    paddingVertical: v492.space.sm
  },
  signOn: { backgroundColor: v492.colors.surfaceRaised, borderColor: v492.colors.copper },
  signText: { color: v492.colors.textMuted, textAlign: "center" },
  signTextOn: { color: v492.colors.text, textAlign: "center" },
  signs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: v492.space.sm,
    marginTop: v492.space.md
  },
  status: { marginTop: v492.space.xxl }
});
