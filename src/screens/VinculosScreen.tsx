/**
 * **Vínculos** — la lista de personas y el alta de la primera (CORE-212).
 *
 * Frames: `1757:2613` / `1757:2383` (lista vacía, 1440 / 390), `1761:2776`,
 * `1761:2893`, `1761:3012` (alta en tres pasos), `2092:2975` / `1757:2475`
 * (biblioteca: un solo botón, editar a la elegida; agregar y volver son
 * enlaces mono) y `2096:3027` / `1757:2579` (límite Free). En escritorio la
 * columna izquierda lleva el rótulo, el titular y la explicación; la derecha,
 * más ancha, la tarjeta que hace el trabajo (lista, alta o persona). En móvil
 * todo se apila en el orden del JSX.
 *
 * Compone con el kit compartido de la web (CORE-233): `PEncabezado`,
 * `PEtiqueta`, `PTexto`, `PNota`, `PTarjeta`, `PBoton`, `PBarra` y los
 * titulares `H2` / `H3` son los mismos que usan Hoy, Tránsitos y Carta; en
 * `VinculosUI` quedan sólo el campo, el chip, la opción de nivel, los tramos,
 * el avatar y el cerco de error.
 *
 * ## De dónde sale cada cosa (cero maqueta)
 *
 * - La lista y la comparación salen de `relationships.listPeople` y
 *   `relationships.synastry`, reactivas: apenas se guarda una persona la
 *   pantalla cambia sola.
 * - El alta llama a `relationships.addPerson`, que valida por nivel y calcula
 *   la carta de la persona en el servidor cuando el nivel lo pide.
 * - Nada se guarda hasta el último paso. Un fallo del servidor se muestra en
 *   la tarjeta con reintento, sin perder lo tipeado.
 *
 * Órbita no tiene modo invitado: el gate de sesión vive arriba, en las tabs. Si
 * aun así llega alguien sin sesión (web sin `RequireSession`), la sección lo
 * dice y ofrece entrar.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { Column, Columns } from "@/components/orbita/Layout";
import { H2, H3, OrbitaScreen, Section } from "@/components/orbita/kit";
import { GuestState } from "@/components/orbita/GuestState";
import { ErrorState, MinimalLoading } from "@/components/orbita/states";
import { PBarra, PBoton, PEncabezado, PEnlace, PEtiqueta, PNota, PTarjeta, PTexto } from "@/components/transitos/PanoramaUI";
import { VCampo, VCerco, VChip, VInicial, VOpcion, VTramos } from "@/components/vinculos/VinculosUI";
import {
  type AltaErrores,
  type AltaForm,
  NIVELES,
  SIGNOS,
  TIPOS_DE_VINCULO,
  accionDeAgregar,
  copyDeListaVacia,
  descripcionDeNivel,
  etiquetaDeNivel,
  fechaIsoDesdeTexto,
  fraccionDeBarra,
  horaNormalizada,
  inicial,
  lineaDePersona,
  numeroDeNivel,
  notaDePlan,
  resumenDeVinculo,
  rotuloDeCupo,
  rotuloDeNivel,
  validarAlta
} from "@/domain/vinculo";
import type { ZodiacSign } from "@/domain/types";
import { useIsDesktop } from "@/hooks/useLayoutMode";
import { useLiveApp } from "@/hooks/useLiveApp";
import { useRequireProfile } from "@/hooks/useRequireProfile";
import { appCoreApi, type VinculoAcceso, type VinculoBiblioteca, type VinculoComparacion, type VinculoNivel, type VinculoPersona } from "@/services/appCoreRefs";
import { type PlaceHit, searchPlaces } from "@/services/geocoding";
import { orbita } from "@/theme/orbita";
import { usePressedState } from "@/components/v492/Touchable";

export function VinculosScreen() {
  useRequireProfile();
  const { isLive, isAuthLoading, userError, retryUser, auth } = useLiveApp();
  const guest = !isAuthLoading && !userError && !auth?.isSignedIn;
  // La barra móvil dice qué está pasando en el alta («NUEVA PERSONA», frame
  // `1761:2776`); fuera del alta muestra la fecha, como el resto de la app.
  const [cabecera, setCabecera] = useState<string | undefined>(undefined);

  return (
    <OrbitaScreen canvas="wide" right={cabecera}>
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
            <VinculosVivo onCabecera={setCabecera} />
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
function VinculosVivo({ onCabecera }: { onCabecera: (rotulo: string | undefined) => void }) {
  const biblioteca = useQuery(appCoreApi.relationships.listPeople, {});
  const comparacion = useQuery(appCoreApi.relationships.synastry, {});
  const [modo, setModo] = useState<{ kind: "lista" } | { kind: "limite" } | { kind: "alta"; editar?: VinculoPersona; reemplazar?: boolean }>({ kind: "lista" });
  const rotuloDeCabecera = modo.kind === "alta" ? (modo.reemplazar ? "REEMPLAZAR PERSONA" : modo.editar ? "EDITAR DATOS" : "NUEVA PERSONA") : undefined;
  useEffect(() => {
    onCabecera(rotuloDeCabecera);
    return () => onCabecera(undefined);
  }, [onCabecera, rotuloDeCabecera]);
  if (biblioteca === undefined || comparacion === undefined) return <MinimalLoading />;
  // CORE-214: «Agregar» abre el alta, o el límite cuando Free ya usó su cupo.
  // El cupo lo trae el servidor (`access`), derivado del entitlement real.
  const agregar = () => setModo({ kind: accionDeAgregar(biblioteca.access) });
  if (modo.kind === "alta") {
    return (
      <AltaDePersona
        editar={modo.editar}
        reemplazar={modo.reemplazar}
        onCancelar={() => setModo({ kind: "lista" })}
        // Al guardar, la pantalla vuelve a la biblioteca ANTES de abrir la
        // comparación: al volver del detalle no puede quedar el alta con los
        // datos ya guardados y «GUARDAR» habilitado (duplicaría a la persona).
        onGuardada={() => setModo({ kind: "lista" })}
      />
    );
  }
  if (biblioteca.people.length === 0) {
    return <ListaVacia access={biblioteca.access} onAgregar={agregar} />;
  }
  return (
    <Biblioteca
      biblioteca={biblioteca}
      comparacion={comparacion}
      limite={modo.kind === "limite" && biblioteca.access.atLimit}
      onAgregar={agregar}
      onEditar={(persona) => setModo({ kind: "alta", editar: persona })}
      onReemplazar={(persona) => setModo({ kind: "alta", editar: persona, reemplazar: true })}
      onVolver={() => setModo({ kind: "lista" })}
    />
  );
}

// ---------------------------------------------------------------------------
// Composición compartida por los tres estados
// ---------------------------------------------------------------------------

/**
 * La composición del carril de Vínculos: texto a la izquierda (3), tarjeta a
 * la derecha (4), como los frames 1440. En móvil apila en el orden del JSX y
 * la tarjeta se separa del texto con un margen.
 */
function DosColumnas({ izquierda, derecha }: { izquierda: ReactNode; derecha: ReactNode }) {
  const desktop = useIsDesktop();
  return (
    <Columns gap={orbita.spacing.xxl * 1.5}>
      <Column weight={3}>{izquierda}</Column>
      <Column weight={4} style={!desktop ? styles.columnaMovil : undefined}>
        {derecha}
      </Column>
    </Columns>
  );
}

/** El titular serif de la columna de texto: `H2` en escritorio, `H3` en móvil. */
function Titular({ children }: { children: string }) {
  const desktop = useIsDesktop();
  return <View style={styles.titular}>{desktop ? <H2>{children}</H2> : <H3>{children}</H3>}</View>;
}

// ---------------------------------------------------------------------------
// Lista vacía
// ---------------------------------------------------------------------------

function ListaVacia({ access, onAgregar }: { access: VinculoAcceso; onAgregar: () => void }) {
  const desktop = useIsDesktop();
  const copy = copyDeListaVacia(access);
  const izquierda = (
    <>
      <PEncabezado izquierda="VÍNCULOS · TU LISTA" derecha={rotuloDeCupo(access, 0, desktop)} derechaMinuscula={!desktop} />
      <Titular>{desktop ? "Todavía no guardaste a nadie." : "Vínculos compara tu carta con la de otra persona."}</Titular>
      <PTexto style={styles.texto}>{desktop ? copy.texto : "Cada dato que cargues de esa persona abre una capa más de lectura."}</PTexto>
      {desktop ? (
        <>
          <View style={styles.cta}>
            <PBoton label="AGREGAR PERSONA" variante="hueso" onPress={onAgregar} />
          </View>
          <PNota style={styles.nota}>
            Necesitás su fecha, hora y lugar de nacimiento. Si no sabés la hora, se puede guardar igual con menos precisión.
          </PNota>
        </>
      ) : null}
    </>
  );
  const derecha = (
    <>
      {desktop ? (
        <PTarjeta style={styles.tarjetaVacia}>
          <View style={styles.anillo}>
            <View style={styles.anilloInterior} />
          </View>
          <Text style={styles.vaciaTitulo}>Tu lista está vacía</Text>
          <PTexto style={styles.vaciaCuerpo}>Las personas que guardes aparecen acá.</PTexto>
        </PTarjeta>
      ) : null}
      <TresCapas />
      {!desktop ? (
        <>
          <View style={styles.cta}>
            <PBoton label="AGREGAR UNA PERSONA" onPress={onAgregar} />
          </View>
          <PNota style={styles.nota}>{copy.nota}</PNota>
        </>
      ) : null}
    </>
  );
  return <DosColumnas izquierda={izquierda} derecha={derecha} />;
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
      <VInicial inicial={String(c.n)} />
      <View style={styles.capaCuerpo}>
        <Text style={styles.capaTitulo}>{c.titulo}</Text>
        <PEtiqueta tono="gris" style={styles.capaDetalle}>
          {c.detalle}
        </PEtiqueta>
      </View>
    </View>
  ));
  if (desktop) {
    return (
      <PTarjeta style={styles.tarjetaCapas}>
        <PEtiqueta tono="gris" accessibilityRole="header">
          LAS TRES CAPAS DE DATOS
        </PEtiqueta>
        {filas}
      </PTarjeta>
    );
  }
  return (
    <View style={styles.capasMovil}>
      <View style={styles.linea} />
      <PEtiqueta tono="gris" accessibilityRole="header">
        LAS TRES CAPAS DE DATOS
      </PEtiqueta>
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
    // la lista si el nivel las necesita. El rótulo guardado viaja aparte como
    // pista del buscador (`lugarGuardado`).
    lugar: null
  };
}

function AltaDePersona({
  editar,
  reemplazar,
  onCancelar,
  onGuardada
}: {
  editar?: VinculoPersona;
  /** CORE-214: reemplazar a la persona guardada (mismo perfil, datos nuevos). Borra su comparación. */
  reemplazar?: boolean;
  onCancelar: () => void;
  onGuardada: () => void;
}) {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<AltaForm>(editar && !reemplazar ? formDesde(editar) : FORM_INICIAL);
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
    // Al editar, un lugar que ya estaba guardado no se pierde en silencio: si el
    // nivel lo usa y no se volvió a elegir, se pide antes de guardar.
    if (!reemplazar && editar?.birthPlaceLabel && form.nivel !== "signo" && !form.lugar && !e.lugar) {
      e.lugar = `Volvé a elegir ${editar.birthPlaceLabel} de la lista para conservar el lugar.`;
    }
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
      onGuardada();
      router.push({ pathname: "/reading/vinculo-result", params: { id: guardada.relationshipProfileId } });
    } catch (err) {
      const codigo = err instanceof Error ? err.message : "";
      setFallo(
        /RELATIONSHIP_LIMIT_REACHED/.test(codigo)
          ? "Tu plan ya usó su cupo de personas: otra alta se guardó antes. Volvé a la lista para reemplazar a la persona guardada o ver Órbita Plus."
          : codigo
            ? "No pudimos guardar a esta persona. Probá de nuevo en un momento."
            : "No pudimos guardar a esta persona."
      );
    } finally {
      setGuardando(false);
    }
  };

  const titulos: Record<1 | 2 | 3, { titular: string; texto: string; nota: string; tarjeta: string; ayuda: string }> = {
    1: {
      titular: editar && !reemplazar ? `Los datos de ${editar.name}` : "¿Cómo la llamás?",
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

  const izquierda = (
    <>
      <PEncabezado izquierda={reemplazar ? "VÍNCULOS · REEMPLAZAR" : editar ? "VÍNCULOS · EDITAR" : "VÍNCULOS · AGREGAR"} derecha={`PASO ${paso} DE 3`} />
      <Titular>{t.titular}</Titular>
      <PTexto style={styles.texto}>{t.texto}</PTexto>
      {/* En móvil la nota del paso va al pie, después del botón (frames 390). */}
      {desktop ? <PNota style={styles.nota}>{t.nota}</PNota> : null}
      {reemplazar && editar ? <PNota style={styles.nota}>Reemplazar borra la comparación guardada de {editar.name}.</PNota> : null}
    </>
  );

  // Frames `1761:2776` → `1761:3012`: la tarjeta lleva el título del paso, los
  // tramos y la ayuda; los campos y el botón van DEBAJO de la tarjeta en móvil
  // y dentro de ella en escritorio (donde la tarjeta es la columna de trabajo).
  const campos = (
    <>
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
          <PEtiqueta tono="gris" style={styles.rotuloGrupo}>
            TIPO DE VÍNCULO
          </PEtiqueta>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {TIPOS_DE_VINCULO.map((tipo) => (
              <VChip key={tipo.key} label={tipo.label} activo={form.tipo === tipo.key} onPress={() => patch({ tipo: form.tipo === tipo.key ? null : tipo.key })} />
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
        <DatosPorNivel form={form} errores={errores} patch={patch} lugarGuardado={reemplazar ? null : editar?.birthPlaceLabel ?? null} />
      ) : null}

      {fallo ? (
        <Text style={styles.fallo} accessibilityRole="alert">
          {fallo}
        </Text>
      ) : null}

      <View style={styles.botones}>
        {paso < 3 ? (
          <PBoton label="CONTINUAR" variante={desktop ? "hueso" : "cobre"} onPress={continuar} />
        ) : (
          <PBoton label={guardando ? "GUARDANDO…" : "GUARDAR PERSONA"} onPress={enviar} disabled={guardando} variante={desktop ? "hueso" : "cobre"} />
        )}
        {/* Volver y cancelar son salidas secundarias: enlaces mono, no botones (los frames no los dibujan). */}
        {paso > 1 ? <PEnlace label="ATRÁS" onPress={() => setPaso((p) => (p - 1) as 1 | 2)} disabled={guardando} /> : null}
        <PEnlace label="CANCELAR" onPress={onCancelar} disabled={guardando} />
      </View>
      {!desktop ? <PNota style={styles.nota}>{t.nota}</PNota> : null}
    </>
  );

  const tarjeta = (
    <PTarjeta>
      <View style={styles.tarjetaCabecera}>
        <Text style={styles.tarjetaTitulo}>{t.tarjeta}</Text>
        <PEtiqueta tono="gris">PASO {paso} DE 3</PEtiqueta>
      </View>
      <VTramos activos={paso} accessibilityLabel={`Paso ${paso} de 3`} style={styles.progreso} />
      <PNota style={styles.notaCorta}>{t.ayuda}</PNota>
      {desktop ? campos : null}
    </PTarjeta>
  );

  const derecha = (
    <>
      {tarjeta}
      {!desktop ? campos : null}
    </>
  );

  return <DosColumnas izquierda={izquierda} derecha={derecha} />;
}

/** Paso 3: los campos que pide el nivel elegido. */
function DatosPorNivel({
  form,
  errores,
  patch,
  lugarGuardado
}: {
  form: AltaForm;
  errores: AltaErrores;
  patch: (p: Partial<AltaForm>) => void;
  /** Al editar: el lugar que ya estaba guardado, como pista para volver a elegirlo. */
  lugarGuardado?: string | null;
}) {
  if (form.nivel === "signo") {
    return (
      <>
        <PEtiqueta tono="gris" style={styles.rotuloGrupo}>
          SIGNO SOLAR
        </PEtiqueta>
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
      <PEtiqueta tono="gris" style={styles.rotuloGrupo}>
        DATOS DE LA PERSONA
      </PEtiqueta>
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
      <PEtiqueta tono="gris" style={styles.rotuloGrupo}>
        {pideHora ? "PRECISIÓN · SUMA CASAS Y EJES" : "PRECISIÓN · CON HORA Y LUGAR SUMA CASAS Y EJES"}
      </PEtiqueta>
      <BuscadorDeLugar
        rotulo={pideHora ? "LUGAR" : "LUGAR · OPCIONAL"}
        valor={form.lugar}
        pista={lugarGuardado ?? undefined}
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
  pista,
  onElegir,
  error
}: {
  rotulo: string;
  valor: AltaForm["lugar"];
  /** Lugar guardado antes (sin coordenadas en el cliente): se muestra y hay que volver a elegirlo. */
  pista?: string;
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
        placeholder={pista ?? "Ciudad, país"}
        autoCapitalize="words"
        error={error}
        style={styles.campo}
      />
      {pista && !valor ? <PNota style={styles.notaCorta}>Guardado: {pista}. Volvé a elegirlo de la lista para confirmar las coordenadas.</PNota> : null}
      {buscando ? <PNota style={styles.notaCorta}>Buscando…</PNota> : null}
      {resultados.length > 0 ? (
        <View style={styles.resultados} accessibilityRole="list">
          {resultados.map((r) => (
            <FilaResultado key={r.label} label={r.label} onPress={() => elegir(r)} />
          ))}
        </View>
      ) : null}
      {!buscando && texto.trim().length >= 2 && resultados.length === 0 && !valor ? (
        <PNota style={styles.notaCorta}>Sin resultados para ese lugar. Probá con la ciudad y el país.</PNota>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// La biblioteca: una o más personas guardadas
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
  limite,
  onAgregar,
  onEditar,
  onReemplazar,
  onVolver
}: {
  biblioteca: VinculoBiblioteca;
  comparacion: VinculoComparacion;
  /** CORE-214: mostrar el límite de Free (frames `2096:3027` / `1757:2579`). */
  limite: boolean;
  onAgregar: () => void;
  onEditar: (persona: VinculoPersona) => void;
  onReemplazar: (persona: VinculoPersona) => void;
  onVolver: () => void;
}) {
  const presion = usePressedState();
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
    <PTarjeta>
      {biblioteca.people.map((p, i) => (
        <FilaPersona key={p.id} persona={p} siguiente={i > 0} eligiendo={eligiendo} onPress={() => abrir(p)} />
      ))}
      {falloEleccion ? (
        <Text style={styles.fallo} accessibilityRole="alert">
          {falloEleccion}
        </Text>
      ) : null}
    </PTarjeta>
  );

  const vinculo = (
    <PTarjeta>
      <Text style={styles.tarjetaTitulo} accessibilityRole="header">
        Tu vínculo con {activa.name}
      </Text>
      {resumen ? (
        <>
          <PEtiqueta tono="gris" style={styles.resumenLinea}>
            {resumenDeVinculo(resumen)}
          </PEtiqueta>
          {resumen.total > 0 ? (
            <PBarra
              grosor={4}
              segmentos={[
                { fraccion: fraccionDeBarra(resumen.armonicos, resumen.total), color: orbita.colors.copperSoft },
                { fraccion: fraccionDeBarra(resumen.tensos, resumen.total), color: orbita.colors.tension },
                { fraccion: fraccionDeBarra(resumen.fusiones, resumen.total), color: orbita.colors.harmony }
              ]}
              accessibilityLabel={resumenDeVinculo(resumen)}
              style={styles.resumenBarra}
            />
          ) : null}
        </>
      ) : (
        <PNota style={styles.notaCorta}>
          {comparacion.status === "needs_natal_chart"
            ? "Para comparar hace falta tu carta natal calculada. Cuando esté, la comparación aparece acá."
            : comparacion.status === "person_chart_unavailable"
              ? "Guardamos a la persona, pero el proveedor no devolvió su carta. Editá sus datos para volver a intentar."
              : "La comparación se calcula con la persona elegida."}
        </PNota>
      )}
      <Pressable
        onPress={() => abrir(activa)}
        accessibilityRole="link"
        accessibilityLabel={`Ver comparación con ${activa.name}`}
        {...presion.pressableProps}
        style={[styles.verComparacion, presion.pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.verComparacionTexto}>Ver comparación  ›</Text>
      </Pressable>
    </PTarjeta>
  );

  const nivel = (
    <PTarjeta>
      <PEtiqueta tono="gris" accessibilityRole="header">
        NIVEL DE DATOS DE {activa.name.toLocaleUpperCase("es")}
      </PEtiqueta>
      <View style={[styles.tarjetaCabecera, styles.nivelFila]}>
        <Text style={styles.nivelTitulo}>{etiquetaDeNivel(activa.level)}</Text>
        <PEtiqueta tono="gris">{rotuloDeNivel(activa.level)}</PEtiqueta>
      </View>
      <VTramos activos={numeroDeNivel(activa.level)} accessibilityLabel={rotuloDeNivel(activa.level)} style={styles.nivelTramos} />
      <PNota style={styles.notaCorta}>{descripcionDeNivel(activa.level, conHoraYLugar)}</PNota>
    </PTarjeta>
  );

  const access = biblioteca.access;
  // Los frames (`2092:2975` / `1757:2475`) dibujan un solo botón: editar a la
  // persona elegida. Con el cupo lleno, «agregar» queda como enlace mono que
  // abre el límite; con lugar (Plus, o Free con cupo), vuelve a ser el botón
  // principal porque es la acción que el frame vacío promete.
  const editar = <PBoton label={`EDITAR DATOS DE ${activa.name.toLocaleUpperCase("es")}`} variante="contorno" onPress={() => onEditar(activa)} />;
  const acciones = (
    <View style={styles.acciones}>
      {access.atLimit ? (
        editar
      ) : (
        <>
          <PBoton label="AGREGAR PERSONA" variante={desktop ? "hueso" : "cobre"} onPress={onAgregar} />
          {editar}
        </>
      )}
    </View>
  );
  const agregarComoEnlace = access.atLimit ? (
    <View style={styles.enlaceSecundario}>
      <PEnlace label="AGREGAR OTRA PERSONA" onPress={onAgregar} />
    </View>
  ) : null;

  // El límite de Free: las personas guardadas siguen, sólo no entra una nueva.
  const limiteCuerpo = (
    <>
      <PTexto style={styles.texto}>
        Free guarda {access.limit === 1 ? "una persona" : `${access.limit} personas`} por cuenta. Para agregar a alguien más, activá Plus o reemplazá a la
        persona guardada.
      </PTexto>
      <View style={[styles.acciones, !desktop && styles.accionesApiladas]}>
        <PBoton label="VER ÓRBITA PLUS" onPress={() => router.push("/paywall")} />
        <PBoton label="REEMPLAZAR PERSONA" variante="contorno" onPress={() => onReemplazar(activa)} />
      </View>
      {desktop ? (
        <>
          <PNota style={styles.nota}>Reemplazar borra la comparación guardada de esa persona.</PNota>
          <View style={styles.enlaceSecundario}>
            <PEnlace label="VOLVER A LA LISTA" onPress={onVolver} />
          </View>
        </>
      ) : null}
    </>
  );

  const izquierda = (
    <>
      <PEncabezado izquierda="VÍNCULOS · TU LISTA" derecha={rotuloDeCupo(access, n, desktop)} derechaMinuscula={!desktop} />
      {limite && desktop ? (
        <>
          <Titular>Llegaste al límite de Órbita Free.</Titular>
          {limiteCuerpo}
        </>
      ) : null}
      {desktop && !limite ? <Titular>Tu lista</Titular> : null}
      {desktop && !limite ? (
        <PTexto style={styles.texto}>
          {n === 1
            ? `${access.limit !== null ? `${notaDePlan(access)} ` : ""}${activa.name} ya está guardada${
                listaOk ? ", con su nivel de datos y su comparación lista." : ". Su comparación todavía no se pudo calcular: abajo dice por qué."
              }`
            : `${n} personas guardadas. Tocá a una para abrir su comparación; la elegida es ${activa.name}.`}
        </PTexto>
      ) : null}
      {desktop && !limite ? (
        <>
          {acciones}
          <PNota style={styles.nota}>Tocá a {activa.name} para abrir su perfil o editar sus datos.</PNota>
          {agregarComoEnlace}
        </>
      ) : null}
    </>
  );

  const derecha = (
    <>
      {personas}
      {vinculo}
      {!limite && !desktop ? <View style={styles.separador} /> : null}
      {!limite ? nivel : null}
      {!desktop && limite ? (
        <PTarjeta style={styles.tarjetaLimite}>
          <Text style={styles.tarjetaTitulo} accessibilityRole="header">
            Llegaste al límite de Órbita Free.
          </Text>
          {limiteCuerpo}
        </PTarjeta>
      ) : null}
      {!desktop && limite ? (
        <>
          <PNota style={styles.nota}>Reemplazar borra la comparación guardada de esa persona.</PNota>
          <View style={styles.enlaceSecundario}>
            <PEnlace label="VOLVER A LA LISTA" onPress={onVolver} />
          </View>
        </>
      ) : null}
      {!desktop && !limite ? (
        <>
          {acciones}
          <PNota style={styles.nota}>{notaDePlan(access)}</PNota>
          {agregarComoEnlace}
        </>
      ) : null}
    </>
  );

  return <DosColumnas izquierda={izquierda} derecha={derecha} />;
}

/** Un resultado del buscador de lugar. Con su propio estado de presión (sin `style` función: NativeWind lo descarta). */
function FilaResultado({ label, onPress }: { label: string; onPress: () => void }) {
  const presion = usePressedState();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Elegir ${label}`}
      {...presion.pressableProps}
      style={[styles.resultado, presion.pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.resultadoTexto}>{label}</Text>
    </Pressable>
  );
}

/** Una persona de la biblioteca: avatar, nombre, línea mono y chevron. */
function FilaPersona({
  persona,
  siguiente,
  eligiendo,
  onPress
}: {
  persona: VinculoPersona;
  siguiente: boolean;
  eligiendo: string | null;
  onPress: () => void;
}) {
  const presion = usePressedState();
  return (
    <Pressable
      onPress={onPress}
      disabled={eligiendo !== null}
      accessibilityRole="link"
      accessibilityLabel={`${persona.name}. ${lineaDePersona(persona)}.${persona.isActive ? " Persona elegida." : ""} Abrir su comparación.`}
      {...presion.pressableProps}
      style={[styles.personaFila, siguiente && styles.personaFilaSiguiente, presion.pressed && { opacity: 0.6 }]}
    >
      <VInicial inicial={inicial(persona.name)} tamano={40} activa={persona.isActive} />
      <View style={styles.personaCuerpo}>
        <Text style={styles.personaNombre}>{persona.name}</Text>
        <PEtiqueta tono="gris" mayusculas={false} style={styles.personaDetalle}>
          {lineaDePersona(persona)}
        </PEtiqueta>
      </View>
      <Text style={styles.personaFlecha}>{eligiendo === persona.id ? "…" : "›"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  columnaMovil: { marginTop: orbita.spacing.xxl },
  titular: { marginTop: orbita.spacing.md },
  texto: { marginTop: orbita.spacing.lg },
  nota: { marginTop: orbita.spacing.md },
  notaCorta: { marginTop: orbita.spacing.sm },
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
  vaciaCuerpo: { marginTop: orbita.spacing.sm },

  tarjetaCapas: { marginTop: orbita.spacing.sm },
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
  capaCuerpo: { flex: 1, minWidth: 0 },
  capaTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 16 },
  capaDetalle: { fontSize: 10, marginTop: 2 },

  tarjetaCabecera: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.md, justifyContent: "space-between" },
  tarjetaTitulo: { color: orbita.colors.bone, flexShrink: 1, fontFamily: orbita.fonts.serif, fontSize: 20 },
  tarjetaLimite: { borderColor: orbita.colors.copper },
  progreso: { marginTop: orbita.spacing.md },
  campo: { marginTop: orbita.spacing.lg },
  campoMitad: { flex: 1, minWidth: 140 },
  filaCampos: { flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.md, marginTop: orbita.spacing.md },
  rotuloGrupo: { marginTop: orbita.spacing.xl },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.sm, marginTop: orbita.spacing.md },
  opciones: { marginTop: orbita.spacing.sm },
  botones: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.lg, marginTop: orbita.spacing.xl },
  fallo: { color: orbita.colors.danger, fontFamily: orbita.fonts.body, fontSize: 13, lineHeight: 18, marginTop: orbita.spacing.lg },

  resultados: {
    backgroundColor: orbita.colors.surfaceRaised,
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.md,
    borderWidth: 1,
    marginTop: orbita.spacing.sm,
    overflow: "hidden"
  },
  resultado: { borderBottomColor: orbita.colors.line, borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: "center", minHeight: 44, paddingHorizontal: orbita.spacing.lg },
  resultadoTexto: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 15 },

  personaFila: { alignItems: "center", flexDirection: "row", gap: orbita.spacing.md, minHeight: 44, paddingVertical: orbita.spacing.sm },
  personaFilaSiguiente: { borderTopColor: orbita.colors.line, borderTopWidth: 1, marginTop: orbita.spacing.sm, paddingTop: orbita.spacing.md },
  personaCuerpo: { flex: 1, minWidth: 0 },
  personaNombre: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 16 },
  personaDetalle: { fontFamily: orbita.fonts.mono, letterSpacing: 0.5, marginTop: 2 },
  personaFlecha: { color: orbita.colors.mutedDim, fontFamily: orbita.fonts.body, fontSize: 20 },
  resumenLinea: { marginTop: orbita.spacing.md },
  resumenBarra: { marginTop: orbita.spacing.md },
  verComparacion: { alignSelf: "flex-start", justifyContent: "center", marginTop: orbita.spacing.md, minHeight: 44 },
  verComparacionTexto: { color: orbita.colors.copper, fontFamily: orbita.fonts.body, fontSize: 15 },
  nivelFila: { marginTop: orbita.spacing.sm },
  nivelTitulo: { color: orbita.colors.bone, fontFamily: orbita.fonts.body, fontSize: 16 },
  nivelTramos: { marginTop: orbita.spacing.md },
  acciones: { flexDirection: "row", flexWrap: "wrap", gap: orbita.spacing.md, marginTop: orbita.spacing.xl },
  accionesApiladas: { alignItems: "flex-start", flexDirection: "column" },
  enlaceSecundario: { alignItems: "flex-start", marginTop: orbita.spacing.md },
  separador: { backgroundColor: orbita.colors.line, height: 1, marginTop: orbita.spacing.xl }
});
