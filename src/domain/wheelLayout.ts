/**
 * Contenido de la rueda natal, resuelto como dato puro.
 *
 * Vivía dentro del componente (`NatalWheel`), así que las reglas que definen la
 * carta —rotación al Ascendente, planetas por longitud eclíptica, de-colisión
 * radial, cúspides reales, cuerdas de aspectos, resaltado del planeta
 * seleccionado— no se podían testear sin renderizar React Native. Acá son una
 * función pura y el componente sólo dibuja lo que ésta devuelve.
 *
 * Coordenadas: `viewBox` cuadrado de 640, orientación matemática (0° = derecha,
 * +y = arriba). `screenDeg(λ) = 180 + (λ − ascLon)` → Asc a la izquierda, MC
 * arriba, DSC derecha, IC abajo (ver `wheelGeometry`).
 */
import { arcBetween, norm360, wheelAngle } from "@/components/orbita/wheelGeometry";
import { bodyCode, isWheelBody, signCode } from "@/domain/astroSymbols";
import type { NatalChartPayload } from "@/services/appRefs";

export const WHEEL_VIEWBOX = 640;
export const WHEEL_CENTER = WHEEL_VIEWBOX / 2;
/** Radios sobre el viewBox: externo, banda de signos, banda de planetas, interno. */
export const WHEEL_R_OUT = 306;
export const WHEEL_R_SIGN = 250;
export const WHEEL_R_PLANET = 214;
export const WHEEL_R_INNER = 112;
/** Numerales romanos de casa, en el mismo patrón mono que el resto de la rueda. */
export const HOUSE_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
/** Debajo de esta separación angular dos planetas se pisan: el segundo entra. */
const COLLISION_ARC = 8;
const COLLISION_STEP = 22;

export type WheelSignSector = {
  index: number;
  /** Código monocromo del signo (nunca un glifo dependiente de plataforma). */
  code: string;
  /** Ángulo de la línea divisoria (inicio del signo). */
  boundaryDeg: number;
  /** Ángulo del centro del sector, donde va el código. */
  labelDeg: number;
};

export type WheelHouseCusp = {
  house: number;
  numeral: string;
  deg: number;
  /** Punto medio del arco hacia la casa siguiente: ahí va el numeral. */
  numeralDeg: number;
  /** Casas 1/4/7/10: los ejes, trazo más marcado. */
  angular: boolean;
};

export type WheelPlanet = {
  key: string;
  label: string;
  code: string;
  deg: number;
  /** Radio final tras la de-colisión. */
  radius: number;
  retrograde: boolean;
};

export type WheelAspectChord = {
  from: string;
  to: string;
  fromDeg: number;
  toDeg: number;
  harmony: "harmony" | "tension";
};

export type WheelLayout = {
  /** Longitud del Ascendente usada como ancla (0 si no hay Asc fiable). */
  anchor: number;
  /** Sin Ascendente: la banda de signos y las casas se atenúan / no se dibujan. */
  hasAscendant: boolean;
  signs: WheelSignSector[];
  houses: WheelHouseCusp[];
  planets: WheelPlanet[];
  aspects: WheelAspectChord[];
};

export function buildWheelLayout(payload: NatalChartPayload): WheelLayout {
  const ascLon = payload.ascendantDegree;
  const hasAscendant = typeof ascLon === "number";
  const anchor = hasAscendant ? (ascLon as number) : 0;
  const screenDeg = (lon: number) => wheelAngle(anchor, lon);

  const signs: WheelSignSector[] = Array.from({ length: 12 }, (_, index) => ({
    index,
    code: signCode(index),
    boundaryDeg: screenDeg(index * 30),
    labelDeg: screenDeg(index * 30 + 15)
  }));

  // Planetas con longitud real. Asc/MC quedan afuera: son ejes, no puntos.
  const planets: WheelPlanet[] = (payload.placements ?? [])
    .filter((p) => typeof p.fullDegree === "number" && isWheelBody(p.key))
    .map((p) => ({
      key: p.key as string,
      label: p.planet,
      code: bodyCode({ key: p.key, label: p.planet }),
      deg: screenDeg(p.fullDegree as number),
      radius: WHEEL_R_PLANET,
      retrograde: p.isRetrograde === true
    }))
    .sort((a, b) => a.deg - b.deg);

  // De-colisión radial: si dos planetas caen a <8°, el segundo se empuja adentro.
  for (let i = 1; i < planets.length; i++) {
    for (let j = 0; j < i; j++) {
      if (
        arcBetween(planets[i].deg, planets[j].deg) < COLLISION_ARC &&
        Math.abs(planets[i].radius - planets[j].radius) < COLLISION_STEP - 2
      ) {
        planets[i].radius = planets[j].radius - COLLISION_STEP;
      }
    }
  }

  const degByLabel: Record<string, number> = {};
  planets.forEach((p) => {
    degByLabel[p.label] = p.deg;
  });
  const aspects: WheelAspectChord[] = (payload.mainAspects ?? payload.aspects ?? [])
    .filter((a) => degByLabel[a.from] != null && degByLabel[a.to] != null)
    .map((a) => ({
      from: a.from,
      to: a.to,
      fromDeg: degByLabel[a.from],
      toDeg: degByLabel[a.to],
      harmony: a.harmony === "tension" ? "tension" : "harmony"
    }));

  // Sin Ascendente las cúspides no son fiables: no se dibujan.
  const cusps = hasAscendant
    ? (payload.houses ?? []).filter((h) => typeof h.cusp === "number").slice().sort((a, b) => a.house - b.house)
    : [];
  const houses: WheelHouseCusp[] = cusps.map((h, i) => {
    const deg = screenDeg(h.cusp as number);
    const next = cusps[(i + 1) % cusps.length];
    const numeralDeg = norm360(deg + norm360(screenDeg(next.cusp as number) - deg) / 2);
    return {
      house: h.house,
      numeral: HOUSE_NUMERALS[h.house - 1] ?? String(h.house),
      deg,
      numeralDeg,
      angular: h.house === 1 || h.house === 4 || h.house === 7 || h.house === 10
    };
  });

  return { anchor, hasAscendant, signs, houses, planets, aspects };
}

/** Nombre visible del planeta seleccionado (los aspectos se referencian por nombre). */
export function selectedLabel(layout: WheelLayout, selectedKey?: string): string | undefined {
  if (!selectedKey) return undefined;
  return layout.planets.find((p) => p.key === selectedKey)?.label;
}

/**
 * ¿Esta cuerda se resalta? Sin selección se resaltan todas; con un planeta
 * seleccionado, sólo las suyas (el resto queda tenue, no desaparece).
 */
export function aspectIsActive(aspect: WheelAspectChord, selected: string | undefined): boolean {
  if (!selected) return true;
  return aspect.from === selected || aspect.to === selected;
}

/** Punto cartesiano sobre el viewBox, para un radio y un ángulo de pantalla. */
export function wheelPoint(radius: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [WHEEL_CENTER + radius * Math.cos(a), WHEEL_CENTER - radius * Math.sin(a)];
}
