/**
 * Geocoding real de ciudades para el autocomplete de lugar de nacimiento
 * (onboarding nativo y web). Fuente única.
 *
 * Provider: **Photon** (Komoot, sobre OpenStreetMap) — gratis, sin API key,
 * pensado para autocomplete: tolera parciales/minúsculas/acentos y nombres
 * administrativos ("ciudad autónoma de bu" → Buenos Aires).
 *
 * Español: Photon devuelve nombres en idioma local (español para lugares
 * hispanos). El **país** lo traducimos con `Intl.DisplayNames(['es'])` para que
 * salga "Japón/Alemania/Estados Unidos" y no "日本/Deutschland".
 *
 * Ruido: filtramos a lugares poblados (ciudad/pueblo/municipio) para descartar
 * calles, comercios y monumentos.
 *
 * Timezone: Photon no lo da. Se resuelve aguas abajo:
 *  - web: `places.resolve` (AstrologyAPI) en `complete()` trae coords + tz reales.
 *  - nativo: se pasan las coords; el tz cae al del dispositivo si no se resolvió.
 */

export type PlaceHit = {
  /** "Córdoba, Andalucía, España" */
  label: string;
  latitude?: number;
  longitude?: number;
  /** Timezone IANA si el provider lo trae (Photon no; queda undefined). */
  timezone?: string;
};

type PhotonFeature = {
  properties: {
    name?: string;
    city?: string;
    state?: string;
    county?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
  };
  geometry: { coordinates: [number, number] };
};

// Tipos de lugar poblado que nos interesan.
const SETTLEMENT = new Set(["city", "town", "village", "municipality", "hamlet", "borough"]);

function isSettlement(f: PhotonFeature): boolean {
  const p = f.properties;
  if (p.osm_key === "place" && p.osm_value && SETTLEMENT.has(p.osm_value)) return true;
  // Capitales/distritos que OSM modela como límite administrativo (ej. CABA).
  return (
    p.osm_key === "boundary" &&
    p.osm_value === "administrative" &&
    (p.type === "city" || p.type === "district" || p.type === "state")
  );
}

// Traducción de país al español vía Intl (fallback: el país que trae Photon).
let esRegion: { of(code: string): string | undefined } | null = null;
let esRegionTried = false;
function countryInSpanish(code?: string, fallback?: string): string | undefined {
  if (!code) return fallback;
  if (!esRegion && !esRegionTried) {
    esRegionTried = true;
    try {
      const DN = (Intl as unknown as { DisplayNames?: new (l: string[], o: object) => { of(c: string): string | undefined } })
        .DisplayNames;
      if (DN) esRegion = new DN(["es"], { type: "region" });
    } catch {
      esRegion = null;
    }
  }
  try {
    return esRegion?.of(code.toUpperCase()) || fallback;
  } catch {
    return fallback;
  }
}

function toHit(f: PhotonFeature): PlaceHit | null {
  const p = f.properties;
  const primary = p.name || p.city;
  if (!primary) return null;
  const parts = [primary];
  const region = p.state || p.county;
  if (region && region !== primary) parts.push(region);
  const country = countryInSpanish(p.countrycode, p.country);
  if (country) parts.push(country);
  const [lon, lat] = f.geometry.coordinates;
  return { label: parts.join(", "), latitude: lat, longitude: lon };
}

/** Busca ciudades reales por nombre (autocomplete, español). Lanza si la red falla. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceHit[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=20`;
  // Photon honra Accept-Language: sin esto usa el locale del browser (inglés →
  // "Autonomous City of Buenos Aires"). Forzamos español. Es header safelisted (sin preflight).
  const res = await fetch(url, { headers: { "Accept-Language": "es" }, ...(signal ? { signal } : {}) });
  if (!res.ok) throw new Error(`geocoding ${res.status}`);
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const features = data.features ?? [];

  // Preferimos poblados; si el filtro deja todo afuera, usamos el crudo.
  const preferred = features.filter(isSettlement);
  const source = preferred.length > 0 ? preferred : features;

  const seen = new Set<string>();
  const out: PlaceHit[] = [];
  for (const f of source) {
    const hit = toHit(f);
    if (!hit || seen.has(hit.label)) continue;
    seen.add(hit.label);
    out.push(hit);
    if (out.length >= 5) break; // pocas opciones, relevantes
  }
  return out;
}
