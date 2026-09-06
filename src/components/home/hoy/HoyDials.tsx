import { View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

import { orbita } from "@/theme/orbita";
import type { LunarPhaseKey } from "@/services/appRefs";

/**
 * Los dos discos de Hoy, dibujados con `react-native-svg`: **sin assets**.
 *
 * Los dos pintan el valor exacto que trae el sobre —la iluminación real, el
 * avance real del ciclo— y son estáticos: además de respetar «Reducir
 * movimiento» sin excepciones, un disco que crece sugiere un progreso que el
 * dato no afirma. Para lectores de pantalla son UNA etiqueta con el dato en
 * palabras; el texto que va al lado no se vuelve a leer.
 */

/** Fases en las que la Luna crece: la zona iluminada va del lado derecho. */
const CRECIENTES: readonly LunarPhaseKey[] = ["new", "waxing_crescent", "first_quarter", "waxing_gibbous"];

/**
 * Fase lunar real.
 *
 * La zona iluminada se construye con el terminador —una elipse cuyo semieje
 * depende de la iluminación—, así que un 5% se ve como un 5% y no como un ícono
 * genérico de «luna».
 *
 * `iluminacion` es `null` cuando el sobre no publicó una fracción utilizable: el
 * disco queda vacío, con su contorno, en vez de dibujar una luna nueva que
 * afirmaría un 0% que nadie midió.
 */
export function MoonDial({
  iluminacion,
  phaseKey,
  etiqueta,
  size = 72
}: {
  /** Fracción iluminada 0–1 del sobre, o `null` si no hay dato. */
  iluminacion: number | null;
  phaseKey: LunarPhaseKey | null;
  /** Etiqueta accesible completa, ya en palabras. */
  etiqueta: string;
  size?: number;
}) {
  const centro = size / 2;
  const radio = centro - 1;
  const lit = iluminacion === null ? null : Math.max(0, Math.min(1, iluminacion));
  const creciente = phaseKey !== null && CRECIENTES.includes(phaseKey);

  let path: string | null = null;
  if (lit !== null) {
    const terminador = radio * Math.abs(1 - 2 * lit);
    const barridoExterno = creciente ? 1 : 0;
    const barridoInterno = lit < 0.5 ? (creciente ? 0 : 1) : creciente ? 1 : 0;
    path = [
      `M ${centro} ${centro - radio}`,
      `A ${radio} ${radio} 0 0 ${barridoExterno} ${centro} ${centro + radio}`,
      `A ${terminador} ${radio} 0 0 ${barridoInterno} ${centro} ${centro - radio}`,
      "Z"
    ].join(" ");
  }

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={etiqueta}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={centro}
          cy={centro}
          r={radio}
          fill={orbita.colors.surfaceRaised}
          stroke={orbita.colors.line}
          strokeWidth={1}
        />
        {path ? <Path d={path} fill={orbita.colors.copperSoft} /> : null}
      </Svg>
    </View>
  );
}

/**
 * Reloj del ciclo personal: cuánto se recorrió del intervalo entre dos
 * repeticiones del ángulo natal.
 *
 * `avance` traza el arco desde las doce y en el sentido de las agujas del reloj.
 * `banda` reemplaza al arco cuando el cálculo no puede fijar un punto: se dibuja
 * únicamente la franja posible, con los extremos a tope recto para que se lean
 * como los bordes de una zona y no como la punta de un valor. Sin ninguno de los
 * dos el riel queda vacío, que dice exactamente lo que hay para decir: el ciclo
 * existe, su posición de hoy no se puede ubicar.
 */
export function CycleRing({
  avance,
  banda,
  etiqueta,
  size = 60
}: {
  avance: number | null;
  banda?: { desde: number; hasta: number } | null;
  etiqueta: string;
  size?: number;
}) {
  const trazo = 5;
  const centro = size / 2;
  const radio = centro - trazo / 2;
  const circunferencia = 2 * Math.PI * radio;
  const valor = avance === null ? null : Math.max(0, Math.min(1, avance));

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={etiqueta}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={centro} cy={centro} r={radio} fill="none" stroke={orbita.colors.line} strokeWidth={trazo} />
        <G rotation={-90} originX={centro} originY={centro}>
          {banda ? (
            <Circle
              cx={centro}
              cy={centro}
              r={radio}
              fill="none"
              stroke={orbita.colors.copperSoft}
              strokeWidth={trazo}
              strokeLinecap="butt"
              strokeDasharray={`0 ${circunferencia * banda.desde} ${Math.max(
                circunferencia * (banda.hasta - banda.desde),
                2
              )} ${circunferencia}`}
            />
          ) : valor === null ? null : (
            <Circle
              cx={centro}
              cy={centro}
              r={radio}
              fill="none"
              stroke={orbita.colors.copper}
              strokeWidth={trazo}
              strokeLinecap="round"
              strokeDasharray={`${circunferencia * valor} ${circunferencia}`}
            />
          )}
        </G>
      </Svg>
    </View>
  );
}
