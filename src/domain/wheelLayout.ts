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
import {
  bodySymbol,
  isWheelBody,
  signGlyphKey,
  type BodyGlyphKey,
  type SignGlyphKey
} from "@/domain/astroSymbols";
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
  /**
   * Clave del glifo del signo en el catálogo propio (`domain/astroGlyphs`):
   * vectores empaquetados, nunca un carácter que dependa de una fuente.
   */
  symbol: SignGlyphKey;
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
  /** Clave del glifo del cuerpo en el catálogo propio. */
  symbol: BodyGlyphKey;
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
  const hasAscendant = Number.isFinite(ascLon);
  const anchor = hasAscendant ? (ascLon as number) : 0;
  const screenDeg = (lon: number) => wheelAngle(anchor, lon);

  const signs: WheelSignSector[] = Array.from({ length: 12 }, (_, index) => ({
    index,
    symbol: signGlyphKey(index),
    boundaryDeg: screenDeg(index * 30),
    labelDeg: screenDeg(index * 30 + 15)
  }));

  // Planetas con longitud real. Asc/MC quedan afuera: son ejes, no puntos.
  const planets: WheelPlanet[] = (payload.placements ?? [])
    .filter((p) => Number.isFinite(p.fullDegree) && isWheelBody(p.key))
    .map((p) => ({
      key: p.key as string,
      label: p.planet,
      symbol: bodySymbol({ key: p.key, label: p.planet }),
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

  const houses = hasAscendant ? buildHouses(payload.houses, screenDeg) : [];

  return { anchor, hasAscendant, signs, houses, planets, aspects };
}

/**
 * Cúspides SÓLO si el payload trae un juego de doce coherente.
 *
 * Cada numeral se ubica en el punto medio del arco hacia la cúspide SIGUIENTE, o
 * sea que cada casa depende de su vecina. Con un array parcial o malformado
 * —menos de doce casas, números repetidos, casas fuera de 1–12, cúspides `null`,
 * `NaN` o no numéricas— ese "siguiente" no existe o no significa nada, y los
 * numerales caen en cualquier lado. Antes se dibujaba lo que hubiera; ahora se
 * exige el juego completo y, si no está, se devuelve vacío: la rueda conserva
 * planetas y aspectos y omite las casas en vez de mostrar una rejilla falsa.
 *
 * Nunca se desreferencia una cúspide ausente: si el juego no es coherente, no se
 * entra al `map`.
 */
function buildHouses(
  input: NatalChartPayload["houses"],
  screenDeg: (lon: number) => number
): WheelHouseCusp[] {
  if (!Array.isArray(input)) return [];

  const byHouse = new Map<number, number>();
  for (const h of input) {
    const house = h?.house;
    const cusp = h?.cusp;
    // Casa válida (entero 1–12, sin repetir) y cúspide numérica finita.
    if (!Number.isInteger(house) || (house as number) < 1 || (house as number) > 12) continue;
    if (!Number.isFinite(cusp)) continue;
    if (byHouse.has(house as number)) continue;
    byHouse.set(house as number, cusp as number);
  }
  if (byHouse.size !== 12) return [];

  const cusps = Array.from({ length: 12 }, (_, i) => byHouse.get(i + 1) as number);
  return cusps.map((cusp, i) => {
    const deg = screenDeg(cusp);
    const next = screenDeg(cusps[(i + 1) % 12]);
    const house = i + 1;
    return {
      house,
      numeral: HOUSE_NUMERALS[i],
      deg,
      numeralDeg: norm360(deg + norm360(next - deg) / 2),
      angular: house === 1 || house === 4 || house === 7 || house === 10
    };
  });
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
