import { View } from "react-native";
import Svg, { Circle, G, Line, Path } from "react-native-svg";
import {
  MANDALA_SIZE,
  MANDALA_STROKE,
  mandalaDrawnRings
} from "@/components/v492/mandalaGeometry";
import { v492 } from "@/components/v492/tokens";
import { formatPercent } from "@/domain/layers";
import type { AnalysisPrecision, TemporalMandalaRing } from "@/services/layersApi";

export { MANDALA_SIZE, mandalaDrawnRings } from "@/components/v492/mandalaGeometry";

/**
 * Discos del sistema V4.9.2: fase lunar, reloj de ciclo y mandala temporal.
 *
 * Todos dibujan el valor exacto que trae el sobre —iluminación real, día del
 * ciclo real, avance real de cada anillo— y son estáticos: no hay animación que
 * "Reducir movimiento" tenga que apagar. Para VoiceOver son una sola etiqueta
 * con el dato en palabras.
 */

const WAXING_PHASES = ["new", "crescent", "first_quarter", "gibbous"];

/**
 * Fase lunar real.
 *
 * La zona iluminada se construye con el terminador (una elipse cuyo semieje
 * depende de la iluminación), así que un 5% se ve como un 5% y no como un icono
 * genérico de "luna".
 *
 * Con `approximate` el disco deja de afirmar un valor: la zona iluminada se
 * dibuja apenas insinuada y con el borde punteado, porque lo que se está
 * mostrando es la FORMA de la fase y no una fracción medida. Un disco lleno se
 * lee como un dato, y sin hora exacta de nacimiento ese dato no existe.
 */
export function MoonDial({
  illumination,
  phaseKey,
  phaseName,
  size = 88,
  approximate = false
}: {
  /** Fracción iluminada 0–1 del sobre. */
  illumination: number;
  phaseKey: string;
  phaseName: string;
  size?: number;
  /** `true` cuando el dibujo representa la fase y no una iluminación medida. */
  approximate?: boolean;
}) {
  const center = size / 2;
  const radius = center - 1;
  const lit = Number.isFinite(illumination) ? Math.max(0, Math.min(1, illumination)) : 0;
  const waxing = WAXING_PHASES.includes(phaseKey);
  const terminator = radius * Math.abs(1 - 2 * lit);
  const outerSweep = waxing ? 1 : 0;
  const innerSweep = lit < 0.5 ? (waxing ? 0 : 1) : waxing ? 1 : 0;
  const path = [
    `M ${center} ${center - radius}`,
    `A ${radius} ${radius} 0 0 ${outerSweep} ${center} ${center + radius}`,
    `A ${terminator} ${radius} 0 0 ${innerSweep} ${center} ${center - radius}`,
    "Z"
  ].join(" ");

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        approximate
          ? `Forma de la luna ${phaseName.toLocaleLowerCase(
              "es"
            )}, dibujada como referencia de la fase: no se afirma cuánto estaba iluminada`
          : `Luna ${phaseName.toLocaleLowerCase("es")}, ${formatPercent(lit)} iluminada`
      }
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill={v492.colors.surfaceRaised}
          stroke={v492.colors.line}
          strokeWidth={1}
        />
        <Path
          d={path}
          fill={v492.colors.copperSoft}
          fillOpacity={approximate ? 0.3 : 1}
          stroke={approximate ? v492.colors.copperSoft : undefined}
          strokeWidth={approximate ? 1 : 0}
          strokeDasharray={approximate ? "3 3" : undefined}
        />
      </Svg>
    </View>
  );
}

/** Cómo se puede dibujar el avance de un anillo, ya resuelto y sin `undefined`. */
export type RingProgressMode = NonNullable<TemporalMandalaRing["progressMode"]>;

/** Un anillo del sobre con su modo de avance ya decidido. */
type AnilloResuelto = TemporalMandalaRing & { progressMode: RingProgressMode };

/**
 * En qué modo se puede dibujar —y decir— el avance de un ritmo.
 *
 * El contrato manda cuando publica `progressMode`: `point` es el ÚNICO modo que
 * autoriza a leer `ring.progress`, porque en los otros dos ese campo v1 trae un
 * sentinel (`-1`) para no romper a los clientes viejos. `range` no tiene punto y
 * sólo se sostiene si además llegó la franja; `unavailable` es no dibujar nada.
 *
 * Un snapshot del primer contrato V4.9.2 no publica el modo. Ahí se degrada con
 * la precisión —la del propio anillo si la trae, la del sobre si no—: el avance
 * de un cálculo que no es exacto es el centro de una ventana, y dibujarlo como
 * punto afirma una exactitud que ese cálculo nunca tuvo.
 *
 * Lo usa el disco y también la lista de Tránsitos, para que el dibujo y el texto
 * cuenten exactamente lo mismo.
 */
export function ringProgressMode(
  ring: TemporalMandalaRing,
  precision?: AnalysisPrecision
): RingProgressMode {
  if (!ring.available) return "unavailable";
  const franja = franjaVisible(ring.progressRange);
  if (ring.progressMode === "point") return puntoVisible(ring.progress) === null ? "unavailable" : "point";
  if (ring.progressMode === "range") return franja ? "range" : "unavailable";
  if (ring.progressMode === "unavailable") return "unavailable";
  const efectiva = ring.precision ?? precision;
  if (efectiva === "exact" && puntoVisible(ring.progress) !== null) return "point";
  return franja ? "range" : "unavailable";
}

/** La fracción 0–1 que se puede dibujar como punto, o `null` si no hay ninguna. */
function puntoVisible(progress: number): number | null {
  if (!Number.isFinite(progress) || progress < 0) return null;
  return Math.min(1, progress);
}

/** La franja 0–1 que se puede dibujar entera, o `null` si no está publicada u ordenada. */
function franjaVisible(range: TemporalMandalaRing["progressRange"]): { from: number; to: number } | null {
  if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return null;
  const from = Math.max(0, Math.min(1, range.from));
  const to = Math.max(0, Math.min(1, range.to));
  return to >= from ? { from, to } : null;
}

/**
 * Mandala temporal: los ciclos del momento, uno por anillo.
 *
 * Cada anillo es un ciclo distinto y su arco es lo que declara el sobre,
 * dibujado desde arriba y en el sentido de las agujas del reloj. El orden es el
 * del sobre —del ciclo más lento afuera al más rápido adentro— y no se reordena
 * acá.
 *
 * **Qué anillos hay** lo decide `ring.available` y nada más, para que el disco,
 * la lista de abajo y el pie de figura no puedan contar distinto: si la lista
 * declara dos ritmos disponibles, el disco dibuja dos. Un ritmo SIN cálculo no
 * tiene anillo, y su ausencia se dice con palabras.
 *
 * **Qué se dibuja adentro** lo decide `progressMode`: `point` traza el arco del
 * avance; `range` traza únicamente la franja entre `progressRange.from` y
 * `progressRange.to`, sin marcar un valor adentro; `unavailable` deja el riel
 * vacío. Un riel vacío dice justo lo que hay para decir —el ritmo existe, su
 * posición de hoy no se puede ubicar— y no afirma "este ciclo recién empieza",
 * que es lo que diría un arco en cero.
 *
 * Los ciclos no se suman ni se promedian: el dibujo los pone en la misma imagen
 * para poder compararlos, no para combinarlos en un resultado único.
 */
export function TemporalMandalaDial({
  rings: publicados,
  precision,
  size = MANDALA_SIZE
}: {
  /** Los anillos del sobre, en su orden: el primero es el de afuera. */
  rings: readonly TemporalMandalaRing[];
  /** Precisión del sobre: con ella se degradan los snapshots sin `progressMode`. */
  precision?: AnalysisPrecision;
  size?: number;
}) {
  const center = size / 2;
  // El modo se resuelve UNA sola vez, acá: el dibujo y su etiqueta tienen que
  // contar lo mismo, y un snapshot viejo sin `progressMode` no puede quedar
  // librado a que cada uno lo interprete por su cuenta.
  const rings: readonly AnilloResuelto[] = publicados.map((ring) => ({
    ...ring,
    progressMode: ringProgressMode(ring, precision)
  }));
  const anillos = mandalaDrawnRings(rings, size);
  const exterior = anillos[0];
  const interior = anillos[anillos.length - 1];

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={mandalaLabel(rings, anillos.length)}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* La marca de las doce: todos los arcos empiezan ahí. */}
        {exterior && interior ? (
          <Line
            x1={center}
            y1={center - exterior.radius - MANDALA_STROKE / 2}
            x2={center}
            y2={center - interior.radius + MANDALA_STROKE / 2}
            stroke={v492.colors.line}
            strokeWidth={1}
          />
        ) : null}
        {anillos.map(({ ring, radius }) => {
          const circumference = 2 * Math.PI * radius;
          const punto = ring.progressMode === "point" ? puntoVisible(ring.progress) : null;
          const franja = ring.progressMode === "range" ? franjaVisible(ring.progressRange) : null;
          return (
            <G key={ring.key}>
              <Circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={v492.colors.rail}
                strokeWidth={MANDALA_STROKE}
              />
              <G rotation={-90} originX={center} originY={center}>
                {punto !== null ? (
                  <Circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={v492.colors.copper}
                    strokeWidth={MANDALA_STROKE}
                    strokeLinecap="round"
                    strokeDasharray={`${circumference * punto} ${circumference}`}
                  />
                ) : franja ? (
                  // La franja empieza donde empieza el intervalo: el primer tramo
                  // del patrón es un hueco de largo `from`, después viene la banda
                  // y después el resto de la vuelta. Los extremos van a tope
                  // recto —no redondeados— para que se lean como los bordes de una
                  // zona posible y no como la punta de un valor. Una franja
                  // angosta conserva un mínimo visible: si se borrara, el anillo
                  // parecería un ritmo sin cálculo.
                  <Circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={v492.colors.copperSoft}
                    strokeWidth={MANDALA_STROKE}
                    strokeLinecap="butt"
                    strokeDasharray={`0 ${circumference * franja.from} ${Math.max(
                      circumference * (franja.to - franja.from),
                      2
                    )} ${circumference}`}
                  />
                ) : null}
              </G>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

/**
 * Qué es el dibujo, para VoiceOver.
 *
 * El número que anuncia es el de anillos DIBUJADOS —el que devuelve
 * `mandalaDrawnRings`—, no uno recalculado acá: el defecto anterior era
 * exactamente ése, la etiqueta contaba los ritmos con avance ubicable y el disco
 * dibujaba los disponibles, así que podían no coincidir.
 *
 * **La etiqueta dice lo que el DIBUJO agrega, no lo que la leyenda ya dice.**
 * Debajo del mandala hay una línea por ritmo —`ESTACIÓN VITAL · Gibosa`— y cada
 * una es un elemento accesible propio: si acá se volviera a nombrar ritmo por
 * ritmo, VoiceOver leería los cuatro nombres dos veces seguidas antes de llegar
 * al primer dato. Así que lo que se anuncia es lo que sólo el dibujo sabe:
 * cuántos ritmos tienen anillo, en qué orden están y cuántos de esos anillos
 * quedaron vacíos porque hoy su avance no se puede ubicar. Los nombres y los
 * valores se leen una sola vez, en la leyenda.
 */
function mandalaLabel(rings: readonly AnilloResuelto[], dibujados: number): string {
  const sinAvance = rings.filter(
    (ring) => ring.available && ring.progressMode === "unavailable"
  ).length;
  const acotados = rings.filter((ring) => ring.progressMode === "range").length;
  const franja =
    acotados > 0
      ? ` ${acotados === 1 ? "Un anillo dibuja" : `${acotados} anillos dibujan`} la franja en la que puede caer su avance, sin marcar un punto.`
      : "";
  const vacio =
    sinAvance > 0
      ? ` ${sinAvance === 1 ? "Un ritmo tiene" : `${sinAvance} ritmos tienen`} anillo, pero hoy su avance no se puede ubicar dentro de él.`
      : "";
  return `Mandala temporal: ${dibujados} de ${rings.length} ritmos se dibujan como anillos concéntricos, del ciclo más lento afuera al más rápido adentro.${franja}${vacio} Cada ritmo, con su nombre y su estado de hoy, se lee en las líneas que siguen.`;
}

/**
 * Reloj del ciclo personal: cuánto recorrió el intervalo entre dos repeticiones
 * del ángulo natal. El arco es la proporción del sobre, no una estimación.
 */
export function CycleRing({
  progress,
  size = 96,
  label
}: {
  /** Proporción 0–1 recorrida del ciclo. */
  progress: number;
  size?: number;
  /** Etiqueta accesible completa (ya en palabras). */
  label: string;
}) {
  const stroke = 6;
  const center = size / 2;
  const radius = center - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={center} cy={center} r={radius} fill="none" stroke={v492.colors.rail} strokeWidth={stroke} />
        <G rotation={-90} originX={center} originY={center}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={v492.colors.copper}
            strokeWidth={MANDALA_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${circumference * value} ${circumference}`}
          />
        </G>
      </Svg>
    </View>
  );
}
