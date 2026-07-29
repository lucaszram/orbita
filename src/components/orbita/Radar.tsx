/**
 * Radar del mapa de valores.
 *
 * Vivía en `src/components/web/orbita-values.tsx` y lo importaban pantallas
 * nativas (`app/(tabs)/carta.tsx`, `app/reading/valores.tsx`). Es un SVG puro
 * sin nada específico de plataforma: su lugar es el kit compartido.
 */
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import type { ValuesMapPayload } from "@/services/appRefs";

const colors = {
  copper: "#C46A3A",
  copperSoft: "#D69A6A",
  bone: "#F4EEE4",
  blue: "#8CA6C4"
};

function pt(r: number, i: number, n: number, c = 320): [number, number] {
  const deg = 90 - (i * 360) / n;
  const a = (deg * Math.PI) / 180;
  return [c + r * Math.cos(a), c - r * Math.sin(a)];
}

export function Radar({ payload, size }: { payload: ValuesMapPayload; size: number }) {
  const rMax = 250;
  const n = payload.axes.length;
  const poly = (fn: (i: number) => number) =>
    payload.axes.map((_, i) => { const [x, y] = pt(fn(i), i, n); return `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`; }).join(" ");
  return (
    <Svg width={size} height={size} viewBox="0 0 640 640">
      {[0.25, 0.5, 0.75, 1].map((t, k) => (
        <Polygon key={`g${k}`} points={poly(() => rMax * t)} fill="none" stroke={colors.bone} strokeOpacity={0.11} strokeWidth={1} />
      ))}
      {payload.axes.map((_, i) => { const [x, y] = pt(rMax, i, n); return <Line key={`s${i}`} x1={320} y1={320} x2={x} y2={y} stroke={colors.bone} strokeOpacity={0.09} strokeWidth={1} />; })}
      <Polygon points={poly((i) => payload.axes[i].tension * rMax)} fill={colors.blue} fillOpacity={0.16} stroke={colors.blue} strokeOpacity={0.9} strokeWidth={1.4} />
      <Polygon points={poly((i) => payload.axes[i].harmony * rMax)} fill={colors.copper} fillOpacity={0.2} stroke={colors.copperSoft} strokeOpacity={0.95} strokeWidth={1.6} />
      {payload.axes.map((ax, i) => { const [x, y] = pt(ax.tension * rMax, i, n); return <Circle key={`td${i}`} cx={x} cy={y} r={3.5} fill={colors.blue} />; })}
      {payload.axes.map((ax, i) => { const [x, y] = pt(ax.harmony * rMax, i, n); return <Circle key={`hd${i}`} cx={x} cy={y} r={3.5} fill={colors.copperSoft} />; })}
      {payload.axes.map((ax, i) => {
        const [x, y] = pt(292, i, n);
        return <SvgText key={`l${i}`} x={x} y={y + 4} fill={colors.bone} fillOpacity={0.82} fontFamily="Inter_700Bold" fontSize={11} textAnchor="middle">{ax.label.toUpperCase()}</SvgText>;
      })}
    </Svg>
  );
}
