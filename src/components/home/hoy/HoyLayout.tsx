import type { ReactNode } from "react";
import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { orbita } from "@/theme/orbita";
import { usePressedState } from "@/components/v492/Touchable";

/**
 * Las piezas de composición de la sección **Hoy** (canon Build 30).
 *
 * El frame no usa tarjetas: es una columna de bloques separados por una línea
 * fina, con un encabezado numerado a la izquierda y la cadencia del cálculo a la
 * derecha. Estas piezas SON ese sistema, para que ningún bloque lo vuelva a
 * inventar con márgenes propios.
 *
 * Todo sale de los tokens de `theme/orbita`, incluida la gutter: Hoy apila con
 * la misma gutter que Tránsitos, Vínculos y Carta (CORE-237), así los rótulos
 * de las cinco secciones arrancan en la misma vertical.
 */
export const HOY_GUTTER = orbita.spacing.gutter;

// ---------------------------------------------------------------------------
// Tipografía
// ---------------------------------------------------------------------------

/** Mono cobre en versalitas: rótulos, índices y cadencias. */
export function HoyEtiqueta({
  children,
  style,
  accessibilityRole
}: {
  children: ReactNode;
  style?: object;
  /** `header` cuando el rótulo ES el título de su bloque (rotor de títulos). */
  accessibilityRole?: "header";
}) {
  return (
    <Text style={[styles.etiqueta, style]} accessibilityRole={accessibilityRole}>
      {children}
    </Text>
  );
}

/** Serif grande: el titular de «lo principal» y el de cada bloque. */
export function HoyTitular({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.titular, style]}>{children}</Text>;
}

/** Serif mediana: el titular de un bloque. */
export function HoySubtitulo({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.subtitulo, style]}>{children}</Text>;
}

/** Cuerpo de lectura. */
export function HoyTexto({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.texto, style]}>{children}</Text>;
}

/** Línea gris: limitaciones, ausencias y notas al pie. Nunca compite con el dato. */
export function HoyNota({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.nota, style]}>{children}</Text>;
}

// ---------------------------------------------------------------------------
// Encabezado de la sección y de cada bloque
// ---------------------------------------------------------------------------

/**
 * Encabezado de Hoy, como lo componen los frames (Build 30 `1688:109`, WEB V1
 * `1718:2136` y `1718:1997`): una sola fila mono con `HOY · LO ACTIVO AHORA` a
 * la izquierda y la fecha canónica con el contador de capas a la derecha, la
 * introducción debajo y una línea fina que cierra. No hay un título grande
 * «Hoy»: la sección se nombra en la navegación.
 *
 * La fecha viene ya formateada desde el contexto canónico del servidor: esta
 * pantalla no mira el reloj del dispositivo en ningún punto.
 */
export function HoyEncabezado({
  eyebrow,
  fecha,
  contador,
  intro
}: {
  eyebrow: string;
  /** Día canónico ya en palabras (`viernes 4 de septiembre`), o `null`. */
  fecha: string | null;
  /** `4 CAPAS`, o `null` cuando no hay ninguna con dato. */
  contador: string | null;
  intro: string | null;
}) {
  const meta = [fecha ? fecha.toLocaleUpperCase("es") : null, contador].filter(
    (item): item is string => item !== null
  );
  return (
    <View style={styles.encabezado}>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${eyebrow}. ${meta.join(". ")}`}
        style={styles.encabezadoFila}
      >
        <HoyEtiqueta style={styles.encabezadoEyebrow}>{eyebrow}</HoyEtiqueta>
        {meta.length > 0 ? <HoyMeta items={meta} style={styles.encabezadoMeta} /> : null}
      </View>
      {intro ? <HoyTexto style={styles.encabezadoIntro}>{intro}</HoyTexto> : null}
      <View style={styles.encabezadoLinea} />
    </View>
  );
}

/**
 * Un bloque numerado: `01 RANKING DE TRÁNSITOS · CAMBIA A DIARIO`.
 *
 * El número ordena la lectura —el frame numera lo que se ve, en el orden en que
 * se ve— y la cadencia es parte del dato: un tránsito que dura semanas y una
 * Luna que cambia cada dos o tres días no se leen igual.
 *
 * Para lectores de pantalla es UN encabezado con las dos cosas dichas, así que
 * el rotor de títulos permite saltar de bloque en bloque.
 */
export function HoyBloque({
  indice,
  titulo,
  cadencia,
  intro,
  children
}: {
  indice: string;
  titulo: string;
  cadencia: string;
  intro?: string;
  children: ReactNode;
}) {
  // La cadencia va a la derecha si entra en el renglón y debajo si no. Se decide
  // por largo de texto —lo único que se conoce sin medir—: una etiqueta mono
  // partida en dos a la derecha se lee como un error de maquetación. El frame
  // móvil (`1718:1997`, 390 de ancho) muestra `01 RANKING DE TRÁNSITOS · CAMBIA
  // A DIARIO` en un solo renglón: 35 caracteres entran; el corte va más arriba.
  const apilada = titulo.length + cadencia.length > 44;
  return (
    <View style={styles.bloque}>
      <View style={styles.linea} />
      <View accessible accessibilityRole="header" accessibilityLabel={`${titulo}. ${cadencia}.`}>
        <View style={styles.bloqueFila}>
          <View style={styles.bloqueTituloWrap}>
            <HoyEtiqueta style={styles.bloqueIndice}>{indice}</HoyEtiqueta>
            <HoyEtiqueta style={styles.bloqueTitulo}>{titulo}</HoyEtiqueta>
          </View>
          {apilada ? null : <HoyEtiqueta style={styles.bloqueCadencia}>{cadencia}</HoyEtiqueta>}
        </View>
        {apilada ? <HoyEtiqueta style={styles.bloqueCadenciaAbajo}>{cadencia}</HoyEtiqueta> : null}
      </View>
      {intro ? <HoyTexto style={styles.bloqueIntro}>{intro}</HoyTexto> : null}
      <View style={styles.bloqueCuerpo}>{children}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Metadatos, leyendas y medidores
// ---------------------------------------------------------------------------

/** Fila mono separada por `·`, con repliegue en vez de recorte. */
export function HoyMeta({ items, style }: { items: readonly (string | null)[]; style?: object }) {
  const visibles = items.filter((item): item is string => Boolean(item));
  if (visibles.length === 0) return null;
  return (
    <View style={[styles.meta, style]}>
      {visibles.map((item, index) => (
        <View key={`${index}-${item}`} style={styles.metaCelda}>
          {index > 0 ? <HoyEtiqueta style={styles.metaSep}>·</HoyEtiqueta> : null}
          <HoyEtiqueta style={styles.metaTexto}>{item}</HoyEtiqueta>
        </View>
      ))}
    </View>
  );
}

/**
 * Barra de proporción.
 *
 * La barra ILUSTRA un dato que siempre está escrito al lado; no es el dato. Por
 * eso el lector de pantalla nunca recibe un 0–100 armado acá: se anuncia como
 * medidor con `valueText`, el valor en sus unidades reales (`DÍA 18,5 DE 29,5`).
 *
 * `banda`: cuando el cálculo no puede fijar un punto, se dibuja la franja
 * posible y NADA adentro. Un relleno desde cero afirmaría un avance exacto que
 * el sobre no tiene.
 */
export function HoyMedidor({
  valor,
  banda,
  valueText,
  accessibilityLabel
}: {
  valor: number | null;
  banda?: { desde: number; hasta: number } | null;
  valueText: string;
  accessibilityLabel: string;
}) {
  const relleno = valor === null ? null : Math.max(0, Math.min(1, valor));
  // El riel es una fila y los tramos se reparten con `flex`, no con porcentajes:
  // un ancho en `%` depende de que el motor resuelva el porcentaje contra un
  // padre medido, y acá el padre es una barra de 6px dentro de una columna que
  // en web puede no tener ancho resuelto en el primer layout.
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: valueText }}
      style={styles.riel}
    >
      {banda ? (
        <>
          <View style={{ flex: banda.desde }} />
          <View style={[styles.banda, { flex: Math.max(banda.hasta - banda.desde, 0.02) }]} />
          <View style={{ flex: Math.max(1 - banda.hasta, 0) }} />
        </>
      ) : relleno === null ? null : (
        <>
          <View style={[styles.relleno, { flex: relleno }]} />
          <View style={{ flex: 1 - relleno }} />
        </>
      )}
    </View>
  );
}

/**
 * Enlace mono cobre con la flecha del canon: `VER TODOS LOS TRÁNSITOS ›`.
 *
 * Sólo apunta a rutas que existen en la navegación canónica (CORE-113): un
 * enlace a una pantalla que no está sería una promesa rota. «Ver tu momento»
 * (CORE-237) abre Tránsitos pidiendo el segmento de Tu momento.
 */
export function HoyEnlace({ href, children }: { href: Href; children: string }) {
  const presion = usePressedState();
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        {...presion.pressableProps}
        style={[styles.enlace, presion.pressed && styles.presionado]}
      >
        <HoyEtiqueta>{`${children}  ›`}</HoyEtiqueta>
      </Pressable>
    </Link>
  );
}

/**
 * Tarjeta lateral de WEB V1 (`1718:2136`): un rótulo mono y su contenido, con
 * borde fino y esquinas suaves. Es la única pieza de Hoy con borde: la columna
 * de lectura sigue separando bloques con líneas, como el canon nativo. En
 * móvil no se monta —el frame `1718:1997` no la tiene—.
 */
export function HoyTarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={styles.tarjeta}>
      <HoyEtiqueta accessibilityRole="header">{titulo}</HoyEtiqueta>
      <View style={styles.tarjetaCuerpo}>{children}</View>
    </View>
  );
}

/** Un ítem de la tarjeta «Las cuatro capas de hoy»: nombre y cadencia. */
export function HoyTarjetaItem({ nombre, detalle }: { nombre: string; detalle: string }) {
  return (
    <View style={styles.tarjetaItem}>
      <Text style={styles.tarjetaNombre}>{nombre}</Text>
      <HoyNota>{detalle}</HoyNota>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Estados por módulo
// ---------------------------------------------------------------------------

/**
 * Por qué falta un bloque, sin caja ni chips.
 *
 * El canon resuelve la ausencia en una línea gris pegada al bloque: el estado y
 * la precisión no se anuncian con píldoras encima de cada módulo.
 */
export function HoyFalta({ lineas }: { lineas: readonly string[] }) {
  return (
    <View style={styles.falta}>
      {lineas.map((linea) => (
        <HoyNota key={linea} style={styles.faltaLinea}>
          {linea}
        </HoyNota>
      ))}
    </View>
  );
}

/**
 * Carga de UN módulo. Cada fuente carga por separado: que la Luna todavía esté
 * en vuelo no puede dejar en blanco el ranking, que ya llegó.
 */
export function HoyCargando({ etiqueta }: { etiqueta: string }) {
  return (
    <View style={styles.falta} accessibilityLiveRegion="polite">
      <HoyNota style={styles.faltaLinea}>{etiqueta}</HoyNota>
    </View>
  );
}

/**
 * Fallo de UN módulo, con su propio reintento.
 *
 * `modulo` no es decorativo y por eso es obligatorio: la pantalla puede mostrar
 * hasta tres de estos a la vez y dos de ellos reintentan fuentes distintas. Con
 * la etiqueta genérica el rotor de botones de un lector de pantalla listaba
 * «Reintentar este módulo» tres veces, sin forma de saber cuál era cuál.
 */
export function HoyError({
  mensaje,
  onRetry,
  modulo
}: {
  mensaje: string;
  onRetry: () => void;
  /** Qué se reintenta, en palabras (`RANKING DE TRÁNSITOS`). */
  modulo: string;
}) {
  const presion = usePressedState();
  return (
    <View style={styles.falta}>
      {/* El fallo aparece SIN mover el foco, así que se anuncia solo. */}
      <Text style={[styles.nota, styles.faltaLinea]} accessibilityRole="alert" accessibilityLiveRegion="polite">
        {mensaje}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={`Reintentar ${modulo.toLocaleLowerCase("es")}`}
        {...presion.pressableProps}
        style={[styles.reintentar, presion.pressed && styles.presionado]}
      >
        <HoyEtiqueta>REINTENTAR</HoyEtiqueta>
      </Pressable>
    </View>
  );
}

/**
 * La ficha del cálculo: sobre qué se armó la lectura del día y su descargo.
 *
 * Es lo que ocupa la composición lateral en escritorio. No agrega ningún dato:
 * son `basadoEn` y `disclaimer` de la MISMA generación que alimenta «lo
 * principal» y el ranking. En móvil vive al final de la única columna.
 */
export function HoyFicha({
  titulo,
  lineas,
  nota
}: {
  titulo: string;
  lineas: readonly string[];
  nota: string | null;
}) {
  return (
    <View style={styles.ficha}>
      <View style={styles.linea} />
      <HoyEtiqueta>{titulo}</HoyEtiqueta>
      {lineas.length > 0 ? (
        <View style={styles.fichaLista}>
          {/* La clave lleva el índice: el backend puede repetir una línea de
              `basadoEn` y dos claves iguales rompen la lista en React. */}
          {lineas.map((linea, index) => (
            <HoyEtiqueta key={`${index}-${linea}`} style={styles.fichaLinea}>
              {linea}
            </HoyEtiqueta>
          ))}
        </View>
      ) : null}
      {nota ? <HoyNota style={styles.fichaNota}>{nota}</HoyNota> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // --- tipografía ---------------------------------------------------------
  etiqueta: {
    color: orbita.colors.copper,
    fontFamily: orbita.fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.2
  },
  titular: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.serif,
    fontSize: 27,
    lineHeight: 34
  },
  subtitulo: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.serif,
    fontSize: 21,
    lineHeight: 27
  },
  texto: {
    color: orbita.colors.muted,
    fontFamily: orbita.fonts.body,
    fontSize: 15,
    lineHeight: 22
  },
  nota: {
    color: orbita.colors.mutedDim,
    fontFamily: orbita.fonts.body,
    fontSize: 13,
    lineHeight: 19
  },

  // --- encabezado ---------------------------------------------------------
  encabezado: { paddingHorizontal: HOY_GUTTER, paddingTop: orbita.spacing.xl },
  encabezadoFila: {
    alignItems: "flex-start",
    columnGap: orbita.spacing.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: orbita.spacing.xs
  },
  encabezadoEyebrow: { flexShrink: 1 },
  encabezadoMeta: { marginTop: 0 },
  encabezadoIntro: { marginTop: orbita.spacing.md },
  encabezadoLinea: { backgroundColor: orbita.colors.line, height: 1, marginTop: orbita.spacing.xl },

  // --- enlaces y tarjetas -------------------------------------------------
  enlace: { alignSelf: "flex-start", justifyContent: "center", marginTop: orbita.spacing.xl, minHeight: 44 },
  tarjeta: {
    backgroundColor: orbita.colors.surface,
    borderColor: orbita.colors.line,
    borderRadius: orbita.radius.md,
    borderWidth: 1,
    marginTop: orbita.spacing.xl,
    padding: orbita.spacing.lg
  },
  tarjetaCuerpo: { marginTop: orbita.spacing.md },
  tarjetaItem: { marginTop: orbita.spacing.md },
  tarjetaNombre: {
    color: orbita.colors.bone,
    fontFamily: orbita.fonts.body,
    fontSize: 15,
    lineHeight: 21
  },

  // --- bloques ------------------------------------------------------------
  bloque: { marginTop: orbita.spacing.xxl, paddingHorizontal: HOY_GUTTER },
  // La separación del canon es una línea fina, no un borde de tarjeta.
  linea: { backgroundColor: orbita.colors.line, height: 1, marginBottom: orbita.spacing.lg },
  bloqueFila: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  bloqueTituloWrap: { flexDirection: "row", flexShrink: 1, gap: orbita.spacing.md },
  bloqueIndice: { color: orbita.colors.mutedDim },
  bloqueTitulo: { color: orbita.colors.bone, flexShrink: 1 },
  bloqueCadencia: { color: orbita.colors.mutedDim, marginLeft: orbita.spacing.md },
  bloqueCadenciaAbajo: { color: orbita.colors.mutedDim, marginTop: orbita.spacing.xs },
  bloqueIntro: { marginTop: orbita.spacing.md },
  bloqueCuerpo: { marginTop: orbita.spacing.lg },

  // --- metadatos ----------------------------------------------------------
  meta: { flexDirection: "row", flexWrap: "wrap", marginTop: orbita.spacing.md },
  metaCelda: { alignItems: "center", flexDirection: "row" },
  metaSep: { color: orbita.colors.mutedDim, marginHorizontal: orbita.spacing.sm },
  metaTexto: { color: orbita.colors.mutedDim },

  // --- medidor ------------------------------------------------------------
  riel: {
    backgroundColor: orbita.colors.line,
    borderRadius: 3,
    flexDirection: "row",
    height: 6,
    overflow: "hidden",
    width: "100%"
  },
  relleno: { backgroundColor: orbita.colors.copper, height: 6 },
  banda: { backgroundColor: orbita.colors.copperSoft, height: 6 },

  // --- estados ------------------------------------------------------------
  falta: { marginTop: orbita.spacing.xs },
  faltaLinea: { marginTop: orbita.spacing.xs },
  reintentar: {
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: orbita.spacing.md,
    minHeight: 44,
    minWidth: 44
  },
  presionado: { opacity: 0.6 },

  // --- ficha lateral ------------------------------------------------------
  ficha: { marginTop: orbita.spacing.xxl, paddingHorizontal: HOY_GUTTER },
  fichaLista: { marginTop: orbita.spacing.md },
  fichaLinea: { color: orbita.colors.mutedDim, lineHeight: 18, marginTop: orbita.spacing.xs },
  fichaNota: { marginTop: orbita.spacing.md }
});
