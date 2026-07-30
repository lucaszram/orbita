import React from "react";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";

import { RETROGRADE_CODE } from "@/domain/astroSymbols";
import {
  aspectIsActive,
  buildWheelLayout,
  selectedLabel,
  wheelPoint,
  WHEEL_CENTER,
  WHEEL_R_INNER,
  WHEEL_R_OUT,
  WHEEL_R_SIGN,
  WHEEL_VIEWBOX
} from "@/domain/wheelLayout";
import type { NatalChartPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";

/**
 * Rueda natal real. **Rota al Ascendente**: Asc a la izquierda, MC arriba, DSC
 * derecha, IC abajo; los planetas caen por longitud eclíptica sobre el arco de su
 * signo real. Tappable vía `onSelect`.
 *
 * Todo el contenido (sectores, cúspides, cuerdas, planetas, de-colisión) lo
 * resuelve `buildWheelLayout` como dato puro: este componente sólo dibuja.
 * Los símbolos son códigos en la mono empaquetada, no glifos Unicode que en web
 * y Android caían al font de emoji (ver `domain/astroSymbols`).
 *
 * `size` es el lado en píxeles y tiene que venir del CONTENEDOR medido
 * (`MeasuredSquare`), nunca del ancho de la ventana.
 */

export type NatalWheelProps = {
  payload: NatalChartPayload;
  size: number;
  selectedKey?: string;
  onSelect?: (key: string) => void;
};

export function NatalWheel({ payload, size, selectedKey, onSelect }: NatalWheelProps) {
  const layout = buildWheelLayout(payload);
  const selected = selectedLabel(layout, selectedKey);
  const C = WHEEL_CENTER;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${WHEEL_VIEWBOX} ${WHEEL_VIEWBOX}`}>
      {/* anillos */}
      <Circle cx={C} cy={C} r={WHEEL_R_OUT} stroke={orbita.colors.line} strokeWidth={1} fill="none" />
      <Circle
        cx={C}
        cy={C}
        r={WHEEL_R_SIGN}
        stroke={orbita.colors.line}
        strokeWidth={1}
        fill="none"
        opacity={layout.hasAscendant ? 1 : 0.5}
      />
      <Circle cx={C} cy={C} r={WHEEL_R_INNER} stroke={orbita.colors.line} strokeWidth={1} fill="none" />

      {/* banda de signos: 12 sectores, rotados al Ascendente */}
      {layout.signs.map((s) => {
        const [x1, y1] = wheelPoint(WHEEL_R_SIGN, s.boundaryDeg);
        const [x2, y2] = wheelPoint(WHEEL_R_OUT, s.boundaryDeg);
        const [gx, gy] = wheelPoint((WHEEL_R_SIGN + WHEEL_R_OUT) / 2, s.labelDeg);
        return (
          <G key={`sign-${s.index}`} opacity={layout.hasAscendant ? 1 : 0.55}>
            <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={orbita.colors.line} strokeWidth={1} />
            <SvgText
              x={gx}
              y={gy + 5}
              fill={orbita.colors.copperSoft}
              fontSize={17}
              fontFamily={orbita.fonts.monoMedium}
              textAnchor="middle"
            >
              {s.code}
            </SvgText>
          </G>
        );
      })}

      {/* cúspides de casas reales + numerales */}
      {layout.houses.map((h) => {
        const [x1, y1] = wheelPoint(WHEEL_R_INNER, h.deg);
        const [x2, y2] = wheelPoint(WHEEL_R_SIGN, h.deg);
        const [nx, ny] = wheelPoint(WHEEL_R_INNER + 24, h.numeralDeg);
        return (
          <G key={`house-${h.house}`}>
            <Line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={h.angular ? orbita.colors.copperSoft : orbita.colors.line}
              strokeWidth={h.angular ? 1.5 : 1}
              opacity={h.angular ? 0.7 : 0.5}
            />
            <SvgText
              x={nx}
              y={ny + 4}
              fill={orbita.colors.mutedDim}
              fontSize={12}
              fontFamily={orbita.fonts.mono}
              textAnchor="middle"
            >
              {h.numeral}
            </SvgText>
          </G>
        );
      })}

      {/* aspectos (cuerdas entre planetas) */}
      {layout.aspects.map((a, i) => {
        const [x1, y1] = wheelPoint(WHEEL_R_INNER, a.fromDeg);
        const [x2, y2] = wheelPoint(WHEEL_R_INNER, a.toDeg);
        return (
          <Line
            key={`asp-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={a.harmony === "tension" ? orbita.colors.tension : orbita.colors.harmony}
            strokeWidth={1}
            opacity={aspectIsActive(a, selected) ? 0.5 : 0.12}
          />
        );
      })}

      {/* planetas */}
      {layout.planets.map((p) => {
        const [x, y] = wheelPoint(p.radius, p.deg);
        const sel = selectedKey === p.key;
        return (
          <G key={`pl-${p.key}`}>
            {/* hit area transparente (más grande) para tap */}
            <Circle cx={x} cy={y} r={22} fill="transparent" onPress={onSelect ? () => onSelect(p.key) : undefined} />
            <Circle
              cx={x}
              cy={y}
              r={sel ? 16 : 14}
              fill={orbita.colors.background}
              stroke={sel ? orbita.colors.bone : orbita.colors.copper}
              strokeWidth={sel ? 2 : 1.5}
            />
            <SvgText
              x={x}
              y={y + 4}
              fill={sel ? orbita.colors.bone : orbita.colors.copperSoft}
              fontSize={12}
              fontFamily={orbita.fonts.monoMedium}
              textAnchor="middle"
            >
              {p.code}
            </SvgText>
            {p.retrograde ? (
              <SvgText
                x={x + 17}
                y={y - 11}
                fill={orbita.colors.mutedDim}
                fontSize={10}
                fontFamily={orbita.fonts.mono}
                textAnchor="middle"
              >
                {RETROGRADE_CODE}
              </SvgText>
            ) : null}
          </G>
        );
      })}

      {/* centro */}
      <Circle cx={C} cy={C} r={3} fill={orbita.colors.copper} />
    </Svg>
  );
}
