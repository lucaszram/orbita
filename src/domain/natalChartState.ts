/**
 * En qué estado está la Carta, resuelto en un solo lugar y sin React.
 *
 * ## El defecto que esto cierra
 *
 * Las dos pantallas de Carta preguntaban `chart.access.positions` y, si era
 * falso, una mostraba "TU CARTA SE ESTÁ CALCULANDO" para siempre y la otra un
 * bloque de **Órbita Plus**. Las dos estaban mal, por el mismo motivo:
 *
 * > `access.positions` **no es un entitlement**. En `convex/layers.ts` vale
 * > `snapshot !== null`: dice que existe el snapshot canónico de efemérides.
 * > El entitlement es `access.isPro`, y sólo cierra **casas** y **aspectos**.
 *
 * Con `positions` en falso la cuenta podía ver un muro de pago por un cálculo
 * que todavía no había terminado —o que había terminado mal—, y podía quedarse
 * mirando "se está calculando" sin que hubiera ninguna corrida activa.
 *
 * ## Los siete estados
 *
 * En el orden en que se resuelven, que es el orden en que un dato tapa al
 * siguiente:
 *
 * 1. `cargando` — la query inicial todavía viaja. No se sabe nada.
 * 2. `sin-datos` — faltan los datos de nacimiento. No hay nada que calcular y la
 *    salida es cargarlos, no reintentar.
 * 3. `calculando` — no hay snapshot y HAY una corrida activa. Es el único estado
 *    que puede decir "se está calculando", porque es el único en el que algo se
 *    está calculando de verdad.
 * 4. `sin-calculo` — no hay snapshot y NO hay corrida activa. Recuperable: se
 *    explica qué pasó y se ofrece comprobar de nuevo. No se afirma que falló
 *    para siempre y no se cae a una carta anterior.
 * 5. `parcial` — hay snapshot, pero el cálculo no llegó a todo lo que los datos
 *    permiten (faltan los ejes verificados, o las doce casas de una cuenta Plus).
 *    Se muestra lo que hay y se nombra lo que falta. **La salida depende de la
 *    causa:** si falta cálculo, se puede volver a pedirlo; si el único límite
 *    honesto es que no hay hora de nacimiento, la salida es completar la hora y
 *    NO reintentar —eso no lo arregla ningún recálculo—.
 * 6. `listo` — el cálculo llegó hasta donde estos datos permiten.
 *
 * El séptimo —el **límite de acceso Plus**— no es un estado de la pantalla: es
 * una propiedad de CADA superficie, y por eso se pregunta por superficie
 * (`natalSurfaceAccess`). Una cuenta sin Plus ve su carta entera: lo que no ve
 * son las casas y los aspectos.
 */
import type { NatalChartBase } from "@/services/layersApi";

export type NatalChartPhase =
  | "cargando"
  | "sin-datos"
  | "calculando"
  | "sin-calculo"
  | "parcial"
  | "listo";

/**
 * Qué puede hacer la persona para que esto avance. Es la salida del estado, y no
 * siempre existe: hay estados en los que lo único correcto es esperar.
 */
export type NatalChartRecovery =
  /** Nada: o ya está, o hay una corrida en curso y hay que dejarla terminar. */
  | "ninguna"
  /** Cargar los datos de nacimiento. */
  | "cargar-datos"
  /** Completar la hora de nacimiento. Reintentar no la inventa. */
  | "completar-hora"
  /** Volver a pedir el cálculo: lo que falta es del lado de Órbita. */
  | "reintentar";

export type NatalChartState = {
  phase: NatalChartPhase;
  /**
   * El motivo real, en las palabras del backend, cuando lo hay. Es el límite que
   * declaró ESTE cálculo —no una frase inventada acá— y sólo se publica en los
   * estados que necesitan explicar algo.
   */
  reason: string | null;
  /** La salida real de este estado. */
  recovery: NatalChartRecovery;
  /**
   * ¿Tiene sentido ofrecer "comprobar de nuevo"?
   *
   * Se deriva de `recovery`, nunca del estado a secas: un `parcial` cuyo único
   * límite honesto es que no hay hora de nacimiento NO se arregla reintentando, y
   * ofrecer el botón ahí promete un final que ningún recálculo puede dar.
   */
  canRetry: boolean;
};

/** Códigos del contrato. No se escriben en ningún otro lado del front. */
const FALTAN_DATOS = "birth_data";
const FALTA_SNAPSHOT = "canonical_natal_ephemeris";
const FALTA_HORA = "exact_birth_time";
/**
 * Lo único que un recálculo NO puede resolver: datos que aporta la persona.
 * Cualquier otro faltante declarado es trabajo pendiente del lado de Órbita.
 */
const APORTA_LA_PERSONA = new Set(["birth_data", "exact_birth_time"]);

/**
 * El estado de la Carta a partir del read-model y del ciclo de datos.
 *
 * `chart === undefined` es la query en vuelo; `chart === null`, la cuenta sin
 * read-model publicado. Los dos son "todavía no llegó", y se separan de "llegó y
 * dice que no hay snapshot" porque el segundo SÍ trae motivos que se pueden
 * mostrar.
 *
 * `refreshing` es lo único que autoriza a decir que algo se está calculando: es
 * el `refreshForDate` real de `useLayers`, no una suposición sobre el tiempo que
 * pasó.
 */
export function natalChartState(args: {
  chart: NatalChartBase | null | undefined;
  /** Hay una corrida de datos activa ahora mismo. */
  refreshing: boolean;
  /** La última corrida terminó en error. */
  refreshFailed?: boolean;
}): NatalChartState {
  const { chart, refreshing } = args;
  const refreshFailed = args.refreshFailed === true;

  if (chart === undefined) return estado("cargando", null, "ninguna");

  if (chart === null) {
    // Sin read-model no hay `missingInputs` que leer: lo único honesto es
    // distinguir si hay una corrida viva o no.
    return refreshing
      ? estado("calculando", null, "ninguna")
      : estado(
          "sin-calculo",
          refreshFailed ? "El último intento de actualizar tus datos no llegó a completarse." : null,
          "reintentar"
        );
  }

  if (chart.missingInputs.includes(FALTAN_DATOS)) {
    return estado("sin-datos", chart.limitations[0] ?? null, "cargar-datos");
  }

  // `positions` es el snapshot canónico, no el acceso. Sin snapshot no hay carta
  // que mostrar, y lo que decide qué decir es si hay una corrida activa.
  if (!chart.access.positions) {
    const motivo = motivoDelSnapshot(chart);
    if (refreshing) return estado("calculando", motivo, "ninguna");
    return estado("sin-calculo", motivo, "reintentar");
  }

  if (chart.status === "partial") {
    // Un `partial` no es una sola cosa. Puede ser un cálculo que todavía no
    // publicó los ejes o las doce casas —eso lo resuelve otra corrida— o puede
    // ser la carta completa que estos datos permiten, limitada sólo por la hora
    // que no está. Reintentar lo segundo no cambia nada: la hora la aporta la
    // persona, y el botón prometía un final que ningún recálculo puede dar.
    const pendienteDeCalculo = chart.missingInputs.some((code) => !APORTA_LA_PERSONA.has(code));
    if (pendienteDeCalculo) return estado("parcial", motivoParcial(chart), "reintentar");
    // Un `refreshFailed` NO convierte esto en reintentable. Lo que falló fue
    // traer el cielo de hoy, y el cielo de hoy no tiene nada que ver con la hora
    // a la que naciste: ofrecer "comprobar de nuevo" acá prometería que un
    // recálculo puede aparecer un dato que sólo aporta la persona. El fallo del
    // refresco ya se avisa donde corresponde, en las capas del día.
    if (chart.missingInputs.includes(FALTA_HORA)) {
      return estado("parcial", null, "completar-hora");
    }
    // Con la hora exacta guardada no queda nada que la persona pueda aportar: lo
    // que falte es del lado del cálculo, aunque el sobre no lo haya nombrado.
    return estado("parcial", motivoParcial(chart), "reintentar");
  }

  return estado("listo", null, "ninguna");
}

/** El estado, con `canRetry` derivado de la salida real y de ninguna otra cosa. */
function estado(
  phase: NatalChartPhase,
  reason: string | null,
  recovery: NatalChartRecovery
): NatalChartState {
  return { phase, reason, recovery, canRetry: recovery === "reintentar" };
}

/**
 * Por qué no hay snapshot, con el texto del propio sobre.
 *
 * Se busca el límite que habla del snapshot y no el primero de la lista: la
 * lista mezcla los límites de la hora, del acceso y del cálculo, y el primero
 * puede ser cualquiera de ellos.
 */
function motivoDelSnapshot(chart: NatalChartBase): string | null {
  const propio = chart.limitations.find((linea) => linea.includes("posiciones canónicas"));
  if (propio) return propio;
  return chart.limitations[0] ?? null;
}

/**
 * Qué le falta a un cálculo parcial, en el texto del sobre.
 *
 * Los límites de la HORA no cuentan: sin hora exacta el cálculo está completo
 * para los datos que hay, y esa explicación ya vive en la bajada de la pantalla
 * y en el bloque de precisión. Lo que este estado tiene que nombrar es lo que el
 * cálculo no publicó pudiendo hacerlo — los ejes o las doce casas.
 */
function motivoParcial(chart: NatalChartBase): string | null {
  const pendientes = ["verified_ascendant_mc_geometry", "verified_twelve_house_geometry"];
  if (!chart.missingInputs.some((code) => pendientes.includes(code))) return null;
  const propio = chart.limitations.find(
    (linea) => linea.includes("Ascendente y Medio Cielo verificables") || linea.includes("casas incompletas")
  );
  return propio ?? null;
}

/**
 * Acceso por superficie, que es la única forma en que el acceso existe.
 *
 * `houses` y `aspects` del contrato ya vienen multiplicados por `isPro`, así que
 * en falso no distinguen "no tenés Plus" de "el cálculo todavía no las publicó".
 * Acá se separan, porque las dos cosas se dicen distinto y una de ellas no es
 * culpa de nadie.
 */
export type NatalSurfaceAccess =
  /** La superficie está disponible y con dato. */
  | "disponible"
  /** Cerrada por plan: se abre con Órbita Plus. */
  | "plus"
  /** Con acceso, pero el cálculo todavía no la publicó. */
  | "pendiente"
  /** No se puede calcular con los datos guardados (sin hora exacta). */
  | "sin-hora";

export function natalHousesAccess(chart: NatalChartBase): NatalSurfaceAccess {
  if (chart.access.houses) return "disponible";
  if (chart.calculationTimeSource !== "exact_birth_time") return "sin-hora";
  if (!chart.access.isPro) return "plus";
  return "pendiente";
}

export function natalAspectsAccess(chart: NatalChartBase): NatalSurfaceAccess {
  if (chart.access.aspects) return "disponible";
  if (!chart.access.isPro) return "plus";
  // Con Plus y sin snapshot no se llega hasta acá: la pantalla ya resolvió
  // `sin-calculo` antes de dibujar el cuerpo.
  return "pendiente";
}
