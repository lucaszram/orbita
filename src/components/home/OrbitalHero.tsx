import Svg, { Circle, Ellipse, Line } from "react-native-svg";
import { orbita } from "@/theme/orbita";

/**
 * Hero orbital de la Home V4.5 (`visual / daily orbital hero`, 220.5x220.5).
 * Órbita elíptica cobre, anillos concéntricos oscuros, centro bone y un punto
 * cobre sobre la órbita. Dibujado en SVG para nitidez y editabilidad.
 */
export function OrbitalHero({ size = 220 }: { size?: number }) {
  const c = size / 2;
  const rx = size * 0.43;
  const ry = size * 0.25;
  // Punto sobre la órbita, arriba a la derecha (~40°).
  const angle = (40 * Math.PI) / 180;
  const dotX = c + rx * Math.cos(angle);
  const dotY = c - ry * Math.sin(angle);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* anillos concéntricos oscuros */}
      <Circle cx={c} cy={c} r={size * 0.24} fill="#1e1a17" />
      <Circle cx={c} cy={c} r={size * 0.16} fill="#241f1a" />
      <Circle cx={c} cy={c} r={size * 0.09} fill="#2c2620" />
      {/* ejes */}
      <Line x1={c - rx} y1={c} x2={c + rx} y2={c} stroke={orbita.colors.line} strokeWidth={1} />
      <Line x1={c} y1={c - ry} x2={c} y2={c + ry} stroke={orbita.colors.line} strokeWidth={1} />
      {/* órbita */}
      <Ellipse cx={c} cy={c} rx={rx} ry={ry} stroke={orbita.colors.copper} strokeWidth={1} fill="none" opacity={0.85} />
      {/* centro bone */}
      <Circle cx={c} cy={c} r={size * 0.045} fill={orbita.colors.bone} />
      {/* punto cobre sobre la órbita */}
      <Circle cx={dotX} cy={dotY} r={size * 0.032} fill={orbita.colors.copper} />
    </Svg>
  );
}

/** Mini chart de la Guía diaria (`visual / daily guide chart`, 112x112). */
export function MiniChart({ size = 112 }: { size?: number }) {
  const c = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} opacity={0.55}>
      <Circle cx={c} cy={c} r={size * 0.43} stroke={orbita.colors.line} strokeWidth={1} fill="none" />
      <Circle cx={c} cy={c} r={size * 0.24} stroke={orbita.colors.line} strokeWidth={1} fill="none" />
      <Line x1={size * 0.16} y1={c} x2={size * 0.84} y2={c} stroke={orbita.colors.line} strokeWidth={1} />
      <Line x1={c} y1={size * 0.16} x2={c} y2={size * 0.84} stroke={orbita.colors.line} strokeWidth={1} />
      <Circle cx={size * 0.74} cy={size * 0.26} r={5} fill={orbita.colors.copper} />
      <Circle cx={size * 0.3} cy={size * 0.66} r={4} fill={orbita.colors.muted} />
    </Svg>
  );
}
