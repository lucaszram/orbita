/**
 * El mandala de Tu momento (CORE-211): cuatro anillos concéntricos, del ritmo
 * más lento afuera al más rápido adentro. Cada anillo dibuja sólo lo que su
 * fuente certificó: un arco desde arriba con el avance en punto, una franja
 * entre dos avances posibles con precisión en rango, y nada —sólo la pista
 * punteada— cuando el ritmo no tiene cálculo. No hay anillo estimado.
 */
import Svg, { Circle } from "react-native-svg";
import { View } from "react-native";
import { arcoDeAnillo, MANDALA_RING_ORDER } from "@/domain/momento";
import type { Anillo } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

export function Mandala({ rings, size = 112, testID }: { rings: readonly Anillo[]; size?: number; testID?: string }) {
  const centro = size / 2;
  const grosor = Math.max(4, size * 0.075);
  const paso = grosor + Math.max(2, size * 0.03);
  const radioExterior = centro - grosor / 2 - 1;
  const porClave = new Map(rings.map((r) => [r.key, r] as const));
  const resumen = MANDALA_RING_ORDER.map((key) => {
    const r = porClave.get(key);
    return r ? `${r.label}: ${r.available ? r.state : "sin cálculo"}` : key;
  }).join(". ");

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Mandala de tus cuatro ritmos. ${resumen}.`} testID={testID}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {MANDALA_RING_ORDER.map((key, i) => {
          const anillo = porClave.get(key);
          const radio = radioExterior - i * paso;
          const circunferencia = 2 * Math.PI * radio;
          const arco = anillo ? arcoDeAnillo(anillo) : { modo: "vacio" as const };
          const pista = (
            <Circle
              key={`${key}-pista`}
              cx={centro}
              cy={centro}
              r={radio}
              fill="none"
              stroke={orbita.colors.copper}
              strokeOpacity={arco.modo === "vacio" ? 0.22 : 0.16}
              strokeWidth={grosor}
              strokeDasharray={arco.modo === "vacio" ? `${grosor * 0.6} ${grosor * 0.6}` : undefined}
            />
          );
          if (arco.modo === "vacio") return pista;
          const largo = Math.max(0, arco.to - arco.from) * circunferencia;
          const desplazamiento = -arco.from * circunferencia;
          return [
            pista,
            <Circle
              key={`${key}-arco`}
              cx={centro}
              cy={centro}
              r={radio}
              fill="none"
              stroke={orbita.colors.copper}
              strokeOpacity={arco.modo === "franja" ? 0.55 : 1}
              strokeWidth={grosor}
              strokeLinecap="butt"
              strokeDasharray={`${largo} ${Math.max(0, circunferencia - largo)}`}
              strokeDashoffset={desplazamiento}
              transform={`rotate(-90 ${centro} ${centro})`}
            />
          ];
        })}
        <Circle cx={centro} cy={centro} r={Math.max(2, size * 0.035)} fill={orbita.colors.copper} />
      </Svg>
    </View>
  );
}
