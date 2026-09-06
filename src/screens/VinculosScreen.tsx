/**
 * **Vínculos** — la lista de personas y el alta de la primera (CORE-212).
 *
 * Frames: `1757:2613` / `1757:2383` (lista vacía, 1440 / 390), `1761:2776`,
 * `1761:2893`, `1761:3012` (alta en tres pasos), `1757:2475` (una persona
 * guardada). En escritorio la columna izquierda lleva el rótulo, el titular y
 * la explicación; la derecha la tarjeta que hace el trabajo (lista, alta o
 * persona). En móvil todo se apila en el orden del JSX.
 *
 * ## De dónde sale cada cosa (cero maqueta)
 *
 * - La lista y la comparación salen de `relationships.synastry`, reactiva:
 *   apenas se guarda una persona la pantalla cambia sola.
 * - El alta llama a `relationships.addPerson`, que valida por nivel y calcula
 *   la carta de la persona en el servidor cuando el nivel lo pide.
 * - Nada se guarda hasta el último paso. Un fallo del servidor se muestra en
 *   la tarjeta con reintento, sin perder lo tipeado.
 *
 * Órbita no tiene modo invitado: el gate de sesión vive arriba, en las tabs. Si
 * aun así llega alguien sin sesión (web sin `RequireSession`), la sección lo
 * dice y ofrece entrar.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { Column, Columns } from "@/components/orbita/Layout";
import { OrbitaScreen, Section } from "@/components/orbita/kit";
import { GuestState } from "@/components/orbita/GuestState";
import { ErrorState, MinimalLoading } from "@/components/orbita/states";
import {
  VBoton,
  VCampo,
  VCerco,
  VChip,
  VEtiqueta,
  VNota,
  VOpcion,
  VProgreso,
  VTarjeta,
  VTexto,
  VTitular
} from "@/components/vinculos/VinculosUI";
import {
  type AltaErrores,
  type AltaForm,
  NIVELES,
  SIGNOS,
  TIPOS_DE_VINCULO,
  descripcionDeNivel,
  etiquetaDeNivel,
  fechaIsoDesdeTexto,
  horaNormalizada,
  inicial,
  lineaDePersona,
  numeroDeNivel,
  resumenDeVinculo,
  rotuloDeNivel,
  validarAlta
} from "@/domain/vinculo";
import type { ZodiacSign } from "@/domain/types";
import { signLabels } from "@/domain/zodiac";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useRequireProfile } from "@/hooks/useRequireProfile";
import { appCoreApi, type VinculoBiblioteca, type VinculoComparacion, type VinculoNivel, type VinculoPersona } from "@/services/appCoreRefs";
import { type PlaceHit, searchPlaces } from "@/services/geocoding";
import { orbita } from "@/theme/orbita";

export function VinculosScreen() {
  useRequireProfile();
  const { isLive, isAuthLoading, userError, retryUser, auth } = useLiveApp();
  const guest = !isAuthLoading && !userError && !auth?.isSignedIn;

  return (
    <OrbitaScreen canvas="wide" right="Vínculos">
      <Section>
        {userError ? (
          <ErrorState onRetry={retryUser} />
        ) : guest ? (
          <GuestState
            eyebrow="VÍNCULOS"
            title={"Dos cartas,\nun cielo."}
            body="Vínculos compara tu carta con la de otra persona. Entrá para guardar a la primera."
          />
        ) : !isLive ? (
          <MinimalLoading />
        ) : (
          <VCerco fallback={(reintentar) => <ErrorState onRetry={reintentar} />}>
            <VinculosVivo />
          </VCerco>
        )}
      </Section>
    </OrbitaScreen>
  );
}

/**
 * Con sesión confirmada: la biblioteca (`listPeople`) decide qué se ve. Sin
 * personas → lista vacía o alta; con personas → la biblioteca, con la activa
 * y su comparación (`synastry`, reactiva). Editar reutiliza el alta con los
 * datos cargados (CORE-213).
 */
function VinculosVivo() {
  const biblioteca = useQuery(appCoreApi.relationships.listPeople, {});
  const comparacion = useQuery(appCoreApi.relationships.synastry, {});
  const [modo, setModo] = useState<{ kind: "lista" } | { kind: "alta"; editar?: VinculoPersona }>({ kind: "lista" });
  if (biblioteca === undefined || comparacion === undefined) return <MinimalLoading />;
  if (modo.kind === "alta") {
    return <AltaDePersona editar={modo.editar} onCancelar={() => setModo({ kind: "lista" })} />;
  }
  if (biblioteca.people.length === 0) {
    return <ListaVacia onAgregar={() => setModo({ kind: "alta" })} />;
  }
  return (
    <Biblioteca
      biblioteca={biblioteca}
      comparacion={comparacion}
      onAgregar={() => setModo({ kind: "alta" })}
      onEditar={(persona) => setModo({ kind: "alta", editar: persona })}
    />
  );
}

// ---------------------------------------------------------------------------
// Lista vacía
// ---------------------------------------------------------------------------

function ListaVacia({ onAgregar }: { onAgregar: () => void }) {
  const desktop = useIsDesktop();
  return (
    <Columns>
      <Column weight={1}>
        <View style={styles.encabezado}>
          <VEtiqueta accessibilityRole="header">VÍNCULOS · TU LISTA</VEtiqueta>
          <VEtiqueta tono="gris">{desktop ? "0 DE 1" : "0 de 1 persona"}</VEtiqueta>
        </View>
        <VTitular>{desktop ? "Todavía no guardaste a nadie." : "Vínculos compara tu carta con la de otra persona."}</VTitular>
        <VTexto>
          {desktop
            ? "Vínculos compara tu carta con la de otra persona. Con Órbita Free podés guardar una."
            : "Cada dato que cargues de esa persona abre una capa más de lectura."}
        </VTexto>
        {desktop ? (
          <>
            <View style={styles.cta}>
              <VBoton label="AGREGAR PERSONA" onPress={onAgregar} />
            </View>
            <VNota>
              Necesitás su fecha, hora y lugar de nacimiento. Si no sabés la hora, se puede guardar igual con menos
              precisión.
            </VNota>
          </>
        ) : null}
      </Column>
      <Column weight={1}>
        {desktop ? (
          <VTarjeta style={styles.tarjetaVacia}>
            <View style={styles.anillo}>
              <View style={styles.anilloInterior} />
            </View>
            <Text style={styles.vaciaTitulo}>Tu lista está vacía</Text>
            <Text style={styles.vaciaCuerpo}>Las personas que guardes aparecen acá.</Text>
          </VTarjeta>
        ) : null}
        <TresCapas />
        {!desktop ? (
          <>
            <View style={styles.cta}>
              <VBoton label="AGREGAR UNA PERSONA" variante="cobre" onPress={onAgregar} />
            </View>
            <VNota>Órbita Free incluye una persona.</VNota>
          </>
        ) : null}
      </Column>
    </Columns>
  );
}

/** La tarjeta «Las tres capas de datos», igual en las dos anchuras. */
function TresCapas() {
  const desktop = useIsDesktop();
  const capas = [
    { n: 1, titulo: "Signo con signo", detalle: "SOLO NOMBRE Y SIGNO" },
    { n: 2, titulo: "Fecha con fecha", detalle: "SUMÁ LA FECHA · LUGAR OPCIONAL" },
    { n: 3, titulo: "Carta con carta", detalle: "SUMÁ HORA Y LUGAR · CASAS Y EJES" }
  ];
  const filas = capas.map((c) => (
    <View key={c.n} style={styles.capa}>
      <View style={styles.capaNumero}>
        <Text style={styles.capaNumeroTexto}>{c.n}</Text>
      </View>
      <View style={styles.capaCuerpo}>
        <Text style={styles.capaTitulo}>{c.titulo}</Text>
        <Text style={styles.capaDetalle}>{c.detalle}</Text>
      </View>
    </View>
  ));
  if (desktop) {
    return (
      <VTarjeta style={styles.tarjetaCapas}>
        <VEtiqueta tono="gris" accessibilityRole="header">
          LAS TRES CAPAS DE DATOS
        </VEtiqueta>
        {filas}
      </VTarjeta>
    );
  }
  return (
    <View style={styles.capasMovil}>
      <View style={styles.linea} />
      <VEtiqueta tono="gris" accessibilityRole="header">
        LAS TRES CAPAS DE DATOS
      </VEtiqueta>
      {filas}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Alta en tres pasos
// ---------------------------------------------------------------------------

const FORM_INICIAL: AltaForm = { nombre: "", tipo: null, nivel: "carta", signo: null, fecha: "", hora: "", lugar: null };

/** Los datos guardados de una persona, como formulario, para editarla sin retipear. */
function formDesde(p: VinculoPersona): AltaForm {
  return {
    nombre: p.name,
    tipo: p.relationshipType,
    nivel: p.level,
    signo: (p.zodiacSign as ZodiacSign | null) ?? null,
    fecha: p.birthDate ? p.birthDate.split("-").reverse().join("/") : "",
    hora: p.birthTime ?? "",
    // El lugar guardado no trae coordenadas al cliente: se vuelve a elegir de
    // la lista si el nivel las necesita; el rótulo se muestra como pista.
    lugar: null
  };
}

function AltaDePersona({ editar, onCancelar }: { editar?: VinculoPersona; onCancelar: () => void }) {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<AltaForm>(editar ? formDesde(editar) : FORM_INICIAL);
  const [errores, setErrores] = useState<AltaErrores>({});
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const guardar = useAction(appCoreApi.relationships.addPerson);
  const desktop = useIsDesktop();

  const nombre = form.nombre.trim();
  const patch = (p: Partial<AltaForm>) => setForm((f) => ({ ...f, ...p }));

  const continuar = () => {
    if (paso === 1) {
      const e = validarAlta({ ...form, nivel: "signo", signo: form.signo ?? "aries" });
      if (e.nombre) return setErrores({ nombre: e.nombre });
      setErrores({});
      return setPaso(2);
    }
    if (paso === 2) return setPaso(3);
  };

  const enviar = async () => {
    const e = validarAlta(form);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    setFallo(null);
    try {
      const fecha = form.nivel === "signo" ? undefined : fechaIsoDesdeTexto(form.fecha) ?? undefined;
      const hora = form.hora.trim() ? horaNormalizada(form.hora) ?? undefined : undefined;
      const guardada = await guardar({
        profileId: editar?.id,
        name: nombre,
        level: form.nivel,
        relationshipType: form.tipo ?? undefined,
        zodiacSign: form.nivel === "signo" ? form.signo ?? undefined : undefined,
        birthDate: fecha,
        birthTime: form.nivel === "signo" ? undefined : hora,
        birthPlaceLabel: form.nivel === "signo" ? undefined : form.lugar?.label,
        latitude: form.nivel === "signo" ? undefined : form.lugar?.latitude,
        longitude: form.nivel === "signo" ? undefined : form.lugar?.longitude
      });
      router.push({ pathname: "/reading/vinculo-result", params: { id: guardada.relationshipProfileId } });
    } catch (err) {
      setFallo(err instanceof Error && err.message ? "No pudimos guardar a esta persona. Probá de nuevo en un momento." : "No pudimos guardar a esta persona.");
    } finally {
      setGuardando(false);
    }
  };

  const titulos: Record<1 | 2 | 3, { titular: string; texto: string; nota: string; tarjeta: string; ayuda: string }> = {
    1: {
      titular: editar ? `Los datos de ${editar.name}` : "¿Cómo la llamás?",
      texto: "Empezá por el nombre y qué tipo de vínculo es. Con el nombre y el signo ya hay lectura.",
      nota: "Paso 1 de 3. Nada se guarda hasta el final del alta.",
      tarjeta: "Nombre y tipo de vínculo",
      ayuda: "Este paso no pide fechas. Los datos llegan recién en el paso 3."
    },
    2: {
      titular: "¿Qué querés comparar?",
      texto: "Elegí el nivel. Cada uno pide sus propios datos y cambia lo que la comparación puede ver.",
      nota: "Paso 2 de 3. El nivel elegido define qué datos pide el paso 3.",
      tarjeta: "Nivel de comparación",
      ayuda: "Podés empezar por signo y subir de nivel más adelante, sin perder la persona."
    },
    3: {
      titular: `Los datos de ${nombre || "la persona"}`,
      texto:
        form.nivel === "carta"
          ? "Elegiste carta con carta: para eso hacen falta fecha, hora y lugar de nacimiento."
          : form.nivel === "fecha"
            ? "Elegiste fecha con fecha: alcanza con la fecha de nacimiento. Si sabés la hora, sumá también el lugar para poder usarla."
            : "Elegiste signo con signo: alcanza con su signo solar.",
      nota: "Se usan solo para calcular la comparación. No los compartimos.",
      tarjeta: etiquetaDeNivel(form.nivel),
      ayuda:
        form.nivel === "carta"
          ? "Con hora y lugar la comparación suma casas y ejes."
          : form.nivel === "fecha"
            ? "Con la fecha aparecen los contactos entre planetas. La hora sólo se usa junto con el lugar."
            : "Con el signo se lee el tono. Los contactos necesitan la fecha."
    }
  };
  const t = titulos[paso];

  return (
    <Columns>
      <Column weight={1}>
        <View style={styles.encabezado}>
          <VEtiqueta accessibilityRole="header">{editar ? "VÍNCULOS · EDITAR" : "VÍNCULOS · AGREGAR"}</VEtiqueta>
          <VEtiqueta tono="gris">PASO {paso} DE 3</VEtiqueta>
        </View>
        <VTitular>{t.titular}</VTitular>
        <VTexto>{t.texto}</VTexto>
        <VNota>{t.nota}</VNota>
      </Column>
      <Column weight={1} style={!desktop ? styles.tarjetaMovil : undefined}>
        <VTarjeta>
          <View style={styles.encabezado}>
            <Text style={styles.tarjetaTitulo}>{t.tarjeta}</Text>
            <VEtiqueta tono="gris">PASO {paso} DE 3</VEtiqueta>
          </View>
          <VProgreso paso={paso} />
          <VNota>{t.ayuda}</VNota>

          {paso === 1 ? (
            <>
              <VCampo
                rotulo="NOMBRE"
                value={form.nombre}
                onChangeText={(v) => patch({ nombre: v })}
                placeholder="Cómo la llamás"
                autoCapitalize="words"
                autoFocus
                error={errores.nombre}
                style={styles.campo}
              />
              <VEtiqueta tono="gris" style={styles.rotuloGrupo}>
                TIPO DE VÍNCULO
              </VEtiqueta>
              <View style={styles.chips} accessibilityRole="radiogroup">
                {TIPOS_DE_VINCULO.map((tipo) => (
                  <VChip
                    key={tipo.key}
                    label={tipo.label}
                    activo={form.tipo === tipo.key}
                    onPress={() => patch({ tipo: form.tipo === tipo.key ? null : tipo.key })}
                  />
                ))}
              </View>
            </>
          ) : null}

          {paso === 2 ? (
            <View accessibilityRole="radiogroup" style={styles.opciones}>
              {NIVELES.map((n) => (
                <VOpcion
                  key={n.key}
                  titulo={n.titulo}
                  rotulo={n.pide}
                  detalle={n.detalle}
                  activo={form.nivel === n.key}
                  onPress={() => patch({ nivel: n.key as VinculoNivel })}
                />
              ))}
            </View>
          ) : null}

          {paso === 3 ? (
            <DatosPorNivel form={form} errores={errores} patch={patch} />
          ) : null}

          {fallo ? (
            <Text style={styles.fallo} accessibilityRole="alert">
              {fallo}
            </Text>
          ) : null}

          <View style={styles.botones}>
            {paso < 3 ? (
              <VBoton label="CONTINUAR" onPress={continuar} />
            ) : (
              <VBoton label={guardando ? "GUARDANDO…" : "GUARDAR PERSONA"} onPress={enviar} disabled={guardando} variante={desktop ? "relleno" : "cobre"} />
            )}
            {paso > 1 ? <VBoton label="ATRÁS" variante="contorno" onPress={() => setPaso((p) => (p - 1) as 1 | 2)} disabled={guardando} /> : null}
            <VBoton label="CANCELAR" variante="contorno" onPress={onCancelar} disabled={guardando} />
          </View>
        </VTarjeta>
      </Column>
    </Columns>
  );
}

/** Paso 3: los campos que pide el nivel elegido. */
function DatosPorNivel({
  form,
  errores,
  patch
}: {
  form: AltaForm;
  errores: AltaErrores;
  patch: (p: Partial<AltaForm>) => void;
}) {
  if (form.nivel === "signo") {
    return (
      <>
        <VEtiqueta tono="gris" style={styles.rotuloGrupo}>
          SIGNO SOLAR
        </VEtiqueta>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {SIGNOS.map((s) => (
            <VChip key={s.key} label={s.label} activo={form.signo === s.key} onPress={() => patch({ signo: s.key as ZodiacSign })} />
          ))}
        </View>
        {errores.signo ? (
          <Text style={styles.fallo} accessibilityRole="alert">
            {errores.signo}
          </Text>
        ) : null}
      </>
    );
  }
  const pideHora = form.nivel === "carta";
  return (
    <>
      <VEtiqueta tono="gris" style={styles.rotuloGrupo}>
        DATOS DE LA PERSONA
      </VEtiqueta>
      <View style={styles.filaCampos}>
        <VCampo
          rotulo="FECHA"
          value={form.fecha}
          onChangeText={(v) => patch({ fecha: v })}
          placeholder="DD / MM / AAAA"
          keyboardType="numbers-and-punctuation"
          error={errores.fecha}
          style={styles.campoMitad}
        />
        <VCampo
          rotulo={pideHora ? "HORA" : "HORA · OPCIONAL"}
          value={form.hora}
          onChangeText={(v) => patch({ hora: v })}
          placeholder="HH:MM"
          keyboardType="numbers-and-punctuation"
          error={errores.hora}
          style={styles.campoMitad}
        />
      </View>
      <VEtiqueta tono="gris" style={styles.rotuloGrupo}>
        {pideHora ? "PRECISIÓN · SUMA CASAS Y EJES" : "PRECISIÓN · CON HORA Y LUGAR SUMA CASAS Y EJES"}
      </VEtiqueta>
      <BuscadorDeLugar
        rotulo={pideHora ? "LUGAR" : "LUGAR · OPCIONAL"}
        valor={form.lugar}
        onElegir={(lugar) => patch({ lugar })}
        error={errores.lugar}
      />
    </>
  );
}

/** Autocompletar de lugar sobre `searchPlaces`: elegir de la lista fija las coordenadas. */
function BuscadorDeLugar({
  rotulo,
  valor,
  onElegir,
  error
}: {
  rotulo: string;
  valor: AltaForm["lugar"];
  onElegir: (lugar: AltaForm["lugar"]) => void;
  error?: string;
}) {
  const [texto, setTexto] = useState(valor?.label ?? "");
  const [resultados, setResultados] = useState<PlaceHit[]>([]);
  const [buscando, setBuscando] = useState(false);
  const pedido = useRef(0);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2 || (valor && valor.label === texto)) {
      setResultados([]);
      setBuscando(false);
      return;
    }
    const id = ++pedido.current;
    const control = new AbortController();
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const lugares = await searchPlaces(q, control.signal);
        if (id === pedido.current) setResultados(lugares.slice(0, 5));
      } catch {
        if (id === pedido.current) setResultados([]);
      } finally {
        if (id === pedido.current) setBuscando(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      control.abort();
    };
  }, [texto, valor]);

  const elegir = useCallback(
    (lugar: PlaceHit) => {
      setTexto(lugar.label);
      setResultados([]);
      onElegir({ label: lugar.label, latitude: lugar.latitude, longitude: lugar.longitude });
    },
    [onElegir]
  );

  return (
    <View>
      <VCampo
        rotulo={rotulo}
        value={texto}
        onChangeText={(v) => {
          setTexto(v);
          if (valor) onElegir(null);
        }}
        placeholder="Ciudad, país"
        autoCapitalize="words"
        error={error}
        style={styles.campo}
      />
      {buscando ? <VNota>Buscando…</VNota> : null}
      {resultados.length > 0 ? (
        <View style={styles.resultados} accessibilityRole="list">
          {resultados.map((r) => (
            <Pressable
              key={r.label}
              onPress={() => elegir(r)}
              accessibilityRole="button"
              accessibilityLabel={`Elegir ${r.label}`}
              style={({ pressed }) => [styles.resultado, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.resultadoTexto}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {!buscando && texto.trim().length >= 2 && resultados.length === 0 && !valor ? (
        <VNota>Sin resultados para ese lugar. Probá con la ciudad y el país.</VNota>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Una persona guardada
// ---------------------------------------------------------------------------

/**
 * La biblioteca (frames `2092:2975` / `1757:2475`): a la izquierda «Tu lista»
 * con las acciones; a la derecha cada persona guardada, la tarjeta «Tu vínculo
 * con X» de la activa y su nivel de datos. Tocar a una persona la deja activa
 * y abre su comparación; no se calcula nada nuevo por navegar.
 */
function Biblioteca({
  biblioteca,
  comparacion,
  onAgregar,
  onEditar
}: {
  biblioteca: VinculoBiblioteca;
  comparacion: VinculoComparacion;
  onAgregar: () => void;
  onEditar: (persona: VinculoPersona) => void;
}) {
  const desktop = useIsDesktop();
  const elegir = useMutation(appCoreApi.relationships.selectPerson);
  const [eligiendo, setEligiendo] = useState<string | null>(null);
  const [falloEleccion, setFalloEleccion] = useState<string | null>(null);
  const activa = biblioteca.people.find((p) => p.id === biblioteca.activeId) ?? biblioteca.people[0];
  const n = biblioteca.people.length;

  const abrir = async (persona: VinculoPersona) => {
    setFalloEleccion(null);
    if (persona.id !== biblioteca.activeId) {
      setEligiendo(persona.id);
      try {
        await elegir({ profileId: persona.id });
      } catch {
        setEligiendo(null);
        setFalloEleccion("No pudimos abrir a esa persona. Probá de nuevo en un momento.");
        return;
      }
      setEligiendo(null);
    }
    router.push({ pathname: "/reading/vinculo-result", params: { id: persona.id } });
  };

  const listaOk = comparacion.status === "ready";
  const resumen = listaOk ? comparacion.summary : null;
  const conHoraYLugar = Boolean(activa.birthTime && activa.birthPlaceLabel);

  const personas = (
    <VTarjeta>
      {biblioteca.people.map((p, i) => (
        <Pressable
          key={p.id}
          onPress={() => abrir(p)}
          disabled={eligiendo !== null}
          accessibilityRole="link"
          accessibilityLabel={`${p.name}. ${lineaDePersona(p)}.${p.isActive ? " Persona elegida." : ""} Abrir su comparación.`}
          style={({ pressed }) => [styles.personaFila, i > 0 && styles.personaFilaSiguiente, pressed && { opacity: 0.6 }]}
        >
          <View style={[styles.personaAvatar, p.isActive && styles.personaAvatarActiva]}>
            <Text style={styles.personaAvatarTexto}>{inicial(p.name)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.personaNombre}>{p.name}</Text>
            <Text style={styles.personaDetalle}>{lineaDePersona(p)}</Text>
          </View>
          <Text style={styles.personaFlecha}>{eligiendo === p.id ? "…" : "›"}</Text>
        </Pressable>
      ))}
      {falloEleccion ? (
        <Text style={styles.fallo} accessibilityRole="alert">
          {falloEleccion}
        </Text>
      ) : null}
    </VTarjeta>
  );

  const vinculo = (
    <VTarjeta style={styles.tarjetaSiguiente}>
      <Text style={styles.tarjetaTitulo} accessibilityRole="header">
        Tu vínculo con {activa.name}
      </Text>
      {resumen ? (
        <>
          <VEtiqueta tono="gris" style={styles.resumenLinea}>
            {resumenDeVinculo(resumen)}
          </VEtiqueta>
          {resumen.total > 0 ? (
            <View style={styles.resumenPista} accessibilityLabel={resumenDeVinculo(resumen)}>
              <View style={[styles.resumenSegmento, { backgroundColor: orbita.colors.harmony, flexGrow: resumen.armonicos }]} />
              <View style={[styles.resumenSegmento, { backgroundColor: orbita.colors.tension, flexGrow: resumen.tensos }]} />
              <View style={[styles.resumenSegmento, { backgroundColor: orbita.colors.copperSoft, flexGrow: resumen.fusiones }]} />
            </View>
          ) : null}
        </>
      ) : (
        <VNota>
          {comparacion.status === "needs_natal_chart"
            ? "Para comparar hace falta tu carta natal calculada. Cuando esté, la comparación aparece acá."
            : comparacion.status === "person_chart_unavailable"
              ? "Guardamos a la persona, pero el proveedor no devolvió su carta. Editá sus datos para volver a intentar."
              : "La comparación se calcula con la persona elegida."}
        </VNota>
      )}
      <Pressable
        onPress={() => abrir(activa)}
        accessibilityRole="link"
        accessibilityLabel={`Ver comparación con ${activa.name}`}
        style={({ pressed }) => [styles.verComparacion, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.verComparacionTexto}>Ver comparación  ›</Text>
      </Pressable>
    </VTarjeta>
  );

  const nivel = (
    <VTarjeta style={styles.tarjetaSiguiente}>
      <VEtiqueta tono="gris" accessibilityRole="header">
        NIVEL DE DATOS DE {activa.name.toLocaleUpperCase("es")}
      </VEtiqueta>
      <View style={[styles.encabezado, styles.nivelFila]}>
        <Text style={styles.nivelTitulo}>{etiquetaDeNivel(activa.level)}</Text>
        <VEtiqueta tono="gris">{rotuloDeNivel(activa.level)}</VEtiqueta>
      </View>
      <View style={styles.nivelTramos} accessibilityLabel={rotuloDeNivel(activa.level)}>
        {[1, 2, 3].map((k) => (
          <View key={k} style={[styles.nivelTramo, k <= numeroDeNivel(activa.level) && styles.nivelTramoActivo]} />
        ))}
      </View>
      <VNota>{descripcionDeNivel(activa.level, conHoraYLugar)}</VNota>
    </VTarjeta>
  );

  const acciones = (
    <View style={styles.acciones}>
      <VBoton label="AGREGAR PERSONA" variante={desktop ? "relleno" : "cobre"} onPress={onAgregar} />
      <VBoton label={`EDITAR DATOS DE ${activa.name.toLocaleUpperCase("es")}`} variante="contorno" onPress={() => onEditar(activa)} />
    </View>
  );

  return (
    <Columns>
      <Column weight={1}>
        <View style={styles.encabezado}>
          <VEtiqueta accessibilityRole="header">VÍNCULOS · TU LISTA</VEtiqueta>
          <VEtiqueta tono="gris">{n === 1 ? (desktop ? "1 PERSONA" : "1 persona guardada") : desktop ? `${n} PERSONAS` : `${n} personas guardadas`}</VEtiqueta>
        </View>
        <VTitular>Tu lista</VTitular>
        <VTexto>
          {n === 1
            ? `${activa.name} ya está guardada, con su nivel de datos y su comparación lista.`
            : `${n} personas guardadas. Tocá a una para abrir su comparación; la elegida es ${activa.name}.`}
        </VTexto>
        {desktop ? (
          <>
            {acciones}
            <VNota>Tocá a una persona para abrir su comparación o editá los datos de la elegida.</VNota>
          </>
        ) : null}
      </Column>
      <Column weight={1} style={!desktop ? styles.tarjetaMovil : undefined}>
        {personas}
        {vinculo}
        {nivel}
        {!desktop ? (
          <>
            {acciones}
            <VNota>Tocá a una persona para abrir su comparación.</VNota>
          </>
        ) : null}
      </Column>
    </Columns>
  );
}

const styles = StyleSheet.create({
  encabezado: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.md, justifyContent: "space-between" },
  cta: { marginTop: orbita.spacing.xl },
  linea: { backgroundColor: orbita.colors.line, height: 1, marginBottom: orbita.spacing.lg },

  tarjetaVacia: { alignItems: "center", paddingVertical: orbita.spacing.xxl * 1.5 },
  anillo: {
    alignItems: "center",
    borderColor: orbita.colors.copper,
    borderRadius: 999,
    borderWidth: 2,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  anilloInterior: { borderColor: orbita.colors.copper, borderRadius: 999, borderWidth: 2, height: 16, width: 16 },
  vaciaTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 20, marginTop: orbita.spacing.xl },
  vaciaCuerpo: { color: orbita.colors.muted, fontFamily: orbita.fonts.body, fontSize: 15, marginTop: orbita.spacing.sm },

  tarjetaCapas: { marginTop: orbita.spacing.xl },
  capasMovil: { marginTop: orbita.spacing.xxl },
  capa: {
    alignItems: "center",
    backgroundColor: orbita.colors.surfaceRaised,
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: orbita.spacing.md,
    marginTop: orbita.spacing.md,
    padding: orbita.spacing.lg
  },
  capaNumero: {
    alignItems: "center",
    backgroundColor: "rgba(196,106,58,0.16)",
    borderColor: orbita.colors.copper,
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  capaNumeroTexto: { color: orbita.colors.copperSoft, fontFamily: orbita.fonts.monoMedium, fontSize: 12 },
  capaCuerpo: { flex: 1, minWidth: 0 },
  capaTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 16 },
  capaDetalle: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 10, letterSpacing: 1, marginTop: 2 },

  tarjetaMovil: { marginTop: orbita.spacing.xxl },
  tarjetaTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.serif, fontSize: 20, flexShrink: 1 },
  campo: { marginTop: orbita.spacing.lg },
  campoMitad: { flex: 1, minWidth: 140 },
  filaCampos: { flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.md, marginTop: orbita.spacing.md },
  rotuloGrupo: { marginTop: orbita.spacing.xl },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.sm, marginTop: orbita.spacing.md },
  opciones: { marginTop: orbita.spacing.sm },
  botones: { flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.md, marginTop: orbita.spacing.xl },
  fallo: { color: orbita.colors.danger, fontFamily: orbita.fonts.body, fontSize: 13, lineHeight: 18, marginTop: orbita.spacing.lg },

  resultados: {
    backgroundColor: orbita.colors.surfaceRaised,
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.md,
    borderWidth: 1,
    marginTop: orbita.spacing.sm,
    overflow: "hidden"
  },
  resultado: { borderBottomColor: orbita.colors.line, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 44, justifyContent: "center", paddingHorizontal: orbita.spacing.lg },
  resultadoTexto: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 15 },

  personaFila: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.md, minHeight: 44, paddingVertical: orbita.spacing.sm },
  personaFilaSiguiente: { borderTopColor: orbita.colors.line, borderTopWidth: 1, marginTop: orbita.spacing.sm, paddingTop: orbita.spacing.md },
  personaAvatarActiva: { backgroundColor: "rgba(196,106,58,0.45)" },
  tarjetaSiguiente: { marginTop: orbita.spacing.lg },
  resumenLinea: { marginTop: orbita.spacing.md },
  resumenPista: { backgroundColor: "rgba(244,238,228,0.08)", borderRadius: 3, flexDirection: "row", height: 6, marginTop: orbita.spacing.md, overflow: "hidden" },
  resumenSegmento: { height: 6 },
  verComparacion: { alignSelf: "flex-start", justifyContent: "center", marginTop: orbita.spacing.md, minHeight: 44 },
  verComparacionTexto: { color: orbita.colors.copper, fontFamily: orbita.fonts.body, fontSize: 15 },
  nivelFila: { marginTop: orbita.spacing.md },
  nivelTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 16 },
  nivelTramos: { flexDirection: "row", gap: orbita.spacing.sm, marginTop: orbita.spacing.md },
  nivelTramo: { backgroundColor: "rgba(244,238,228,0.12)", borderRadius: 2, flex: 1, height: 3 },
  nivelTramoActivo: { backgroundColor: orbita.colors.copper },
  acciones: { flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.md, marginTop: orbita.spacing.xl },
  personaAvatar: {
    alignItems: "center",
    backgroundColor: "rgba(196,106,58,0.25)",
    borderColor: orbita.colors.copper,
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  personaAvatarTexto: { color: orbita.colors.bone, fontFamily: orbita.fonts.monoMedium, fontSize: 14 },
  personaNombre: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 16 },
  personaDetalle: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.mono, fontSize: 11, letterSpacing: 0.5, marginTop: 2 },
  personaFlecha: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.body, fontSize: 20 }
});
