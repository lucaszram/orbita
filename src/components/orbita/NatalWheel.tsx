import React from "react";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";

import type { NatalChartPayload } from "@/services/appRefs";
import { orbita } from "@/theme/orbita";
import { arcBetween, norm360, wheelAngle } from "./wheelGeometry";

/**
 * Rueda natal real. A diferencia de la vieja (signos/casas en posiciones fijas),
 * ésta **rota al Ascendente**: `screenDeg(λ) = 180 + (λ − ascLon)` → Asc a la
 * izquierda, MC arriba, DSC derecha, IC abajo. Los planetas caen por longitud
 * eclíptica (`fullDegree`) sobre el arco de su signo real. Tappable vía `onSelect`.
 */

const VB = 640;
const C = VB / 2;
const R_OUT = 306; // círculo externo
const R_SIGN = 250; // borde interno de la banda de signos
const R_PLANET = 214; // banda de planetas
const R_INNER = 112; // círculo interno (convergen aspectos + numerales de casa)

// Glifos del zodíaco por longitud (Aries en 0°). El selector de variación U+FE0E
// fuerza presentación de TEXTO: sin él, ♈–♓ (U+2648–U+2653) salen como emoji a color
// (los "cuadrados violetas") ignorando el fill cobre. Con FE0E respetan el fill fino.
const VS_TEXT = String.fromCharCode(0xfe0e);
const ZODIAC = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"].map((g) => g + VS_TEXT);
const PLANET_GLYPH: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂", jupiter: "♃", saturn: "♄",
  uranus: "♅", neptune: "♆", pluto: "♇", node: "☊", chiron: "⚷", part_of_fortune: "⊕",
};
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function pt(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.cos(a), C - r * Math.sin(a)];
}

export type NatalWheelProps = {
  payload: NatalChartPayload;
  size: number;
  selectedKey?: string;
  onSelect?: (key: string) => void;
};

export function NatalWheel({ payload, size, selectedKey, onSelect }: NatalWheelProps) {
  const ascLon = payload.ascendantDegree;
  const hasAsc = typeof ascLon === "number";
  const anchor = hasAsc ? (ascLon as number) : 0;
  const screenDeg = (lon: number) => wheelAngle(anchor, lon);

  // Planetas con longitud real (excluye Asc/MC: son ejes, no puntos).
  const planets = payload.placements
    .filter((p) => typeof p.fullDegree === "number" && p.key && PLANET_GLYPH[p.key])
    .map((p) => ({ key: p.key as string, label: p.planet, retro: p.isRetrograde, deg: screenDeg(p.fullDegree as number) }))
    .sort((a, b) => a.deg - b.deg);

  // De-colisión radial: si dos planetas caen a <8°, empujo el segundo hacia adentro.
  const placed = planets.map((p) => ({ ...p, r: R_PLANET }));
  for (let i = 1; i < placed.length; i++) {
    for (let j = 0; j < i; j++) {
      if (arcBetween(placed[i].deg, placed[j].deg) < 8 && Math.abs(placed[i].r - placed[j].r) < 20) {
        placed[i].r = placed[j].r - 22;
      }
    }
  }

  const degByLabel: Record<string, number> = {};
  planets.forEach((p) => { degByLabel[p.label] = p.deg; });
  const aspectLines = (payload.mainAspects ?? payload.aspects ?? [])
    .filter((a) => degByLabel[a.from] != null && degByLabel[a.to] != null);

  const houses = hasAsc
    ? payload.houses.filter((h) => typeof h.cusp === "number").slice().sort((a, b) => a.house - b.house)
    : [];

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
      {/* anillos */}
      <Circle cx={C} cy={C} r={R_OUT} stroke={orbita.colors.line} strokeWidth={1} fill="none" />
      <Circle cx={C} cy={C} r={R_SIGN} stroke={orbita.colors.line} strokeWidth={1} fill="none" opacity={hasAsc ? 1 : 0.5} />
      <Circle cx={C} cy={C} r={R_INNER} stroke={orbita.colors.line} strokeWidth={1} fill="none" />

      {/* banda de signos: 12 sectores, rotados al Ascendente */}
      {ZODIAC.map((glyph, k) => {
        const [x1, y1] = pt(R_SIGN, screenDeg(k * 30));
        const [x2, y2] = pt(R_OUT, screenDeg(k * 30));
        const [gx, gy] = pt((R_SIGN + R_OUT) / 2, screenDeg(k * 30 + 15));
        return (
          <G key={`sign-${k}`} opacity={hasAsc ? 1 : 0.55}>
            <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={orbita.colors.line} strokeWidth={1} />
            <SvgText x={gx} y={gy + 7} fill={orbita.colors.copperSoft} fontSize={22} textAnchor="middle">{glyph}</SvgText>
          </G>
        );
      })}

      {/* cúspides de casas reales + numerales */}
      {houses.map((h, i) => {
        const d = screenDeg(h.cusp as number);
        const angular = h.house === 1 || h.house === 4 || h.house === 7 || h.house === 10;
        const [x1, y1] = pt(R_INNER, d);
        const [x2, y2] = pt(R_SIGN, d);
        // numeral en el punto medio del arco (sentido CCW) hacia la cúspide siguiente
        const next = houses[(i + 1) % houses.length];
        const midDeg = norm360(d + norm360(screenDeg(next.cusp as number) - d) / 2);
        const [nx, ny] = pt(R_INNER + 24, midDeg);
        return (
          <G key={`house-${h.house}`}>
            <Line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={angular ? orbita.colors.copperSoft : orbita.colors.line}
              strokeWidth={angular ? 1.5 : 1}
              opacity={angular ? 0.7 : 0.5}
            />
            <SvgText x={nx} y={ny + 4} fill={orbita.colors.mutedDim} fontSize={12} fontFamily={orbita.fonts.mono} textAnchor="middle">
              {ROMAN[h.house - 1]}
            </SvgText>
          </G>
        );
      })}

      {/* aspectos (cuerdas entre planetas) */}
      {aspectLines.map((a, i) => {
        const [x1, y1] = pt(R_INNER, degByLabel[a.from]);
        const [x2, y2] = pt(R_INNER, degByLabel[a.to]);
        const active = !selectedKey || a.from === labelOfKey(planets, selectedKey) || a.to === labelOfKey(planets, selectedKey);
        return (
          <Line
            key={`asp-${i}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={a.harmony === "tension" ? orbita.colors.tension : orbita.colors.harmony}
            strokeWidth={1}
            opacity={active ? 0.5 : 0.12}
          />
        );
      })}

      {/* planetas */}
      {placed.map((p) => {
        const [x, y] = pt(p.r, p.deg);
        const sel = selectedKey === p.key;
        return (
          <G key={`pl-${p.key}`}>
            {/* hit area transparente (más grande) para tap */}
            <Circle cx={x} cy={y} r={22} fill="transparent" onPress={onSelect ? () => onSelect(p.key) : undefined} />
            <Circle cx={x} cy={y} r={sel ? 15 : 13} fill={orbita.colors.background} stroke={sel ? orbita.colors.bone : orbita.colors.copper} strokeWidth={sel ? 2 : 1.5} />
            <SvgText x={x} y={y + 6} fill={sel ? orbita.colors.bone : orbita.colors.copperSoft} fontSize={16} textAnchor="middle">{PLANET_GLYPH[p.key]}</SvgText>
            {p.retro ? <SvgText x={x + 15} y={y - 10} fill={orbita.colors.mutedDim} fontSize={10} textAnchor="middle">℞</SvgText> : null}
          </G>
        );
      })}

      {/* centro */}
      <Circle cx={C} cy={C} r={3} fill={orbita.colors.copper} />
    </Svg>
  );
}

function labelOfKey(planets: Array<{ key: string; label: string }>, key: string): string | undefined {
  return planets.find((p) => p.key === key)?.label;
}
