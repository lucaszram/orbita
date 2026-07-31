// Órbita web — mapa de assets de la superficie pública.
//
// Los masters generados pesados usan siempre derivados de
// `assets/orbita/optimized/**`, nunca los originales de `core/` o `higgsfield/`.
// El preview web existente ya está preparado para runtime y conserva su ruta.
// Los masters se conservan intactos como fuente; los PNG de 2 a 5,7 MB no
// viajan al navegador.
// `scripts/check-web-export.mjs` falla si algún derivado se sale del límite.
import type { ImageSourcePropType } from "react-native";

export type WebAssetRole =
  | "hero"
  | "texture"
  | "module"
  | "symbol"
  | "studio"
  | "payment";

export type WebAssetSlot = {
  key: string;
  role: WebAssetRole;
  source: string;
  require: ImageSourcePropType;
  alt: string;
};

export const webAssets = {
  heroOrbital: {
    key: "heroOrbital",
    role: "hero",
    source: "assets/orbita/optimized/core/orbita_home_hero_orbital_b.jpg",
    require: require("../../assets/orbita/optimized/core/orbita_home_hero_orbital_b.jpg"),
    alt: "Cuerpo orbital oscuro con línea cobre para la portada de Órbita."
  },
  dailyTexture: {
    key: "dailyTexture",
    role: "texture",
    source: "assets/orbita/optimized/core/orbita_daily_texture_b.jpg",
    require: require("../../assets/orbita/optimized/core/orbita_daily_texture_b.jpg"),
    alt: "Textura astral oscura con trazos orbitales para guía diaria."
  },
  longRead: {
    key: "longRead",
    role: "module",
    source: "assets/orbita/optimized/core/orbita_long_read_thumbnail_a.jpg",
    require: require("../../assets/orbita/optimized/core/orbita_long_read_thumbnail_a.jpg"),
    alt: "Composición editorial lunar para lectura larga."
  },
  natalChart: {
    key: "natalChart",
    role: "module",
    source: "assets/orbita/optimized/core/orbita_carta_natal_diagram_a.jpg",
    require: require("../../assets/orbita/optimized/core/orbita_carta_natal_diagram_a.jpg"),
    alt: "Diagrama de carta natal en clave editorial oscura."
  },
  transits: {
    key: "transits",
    role: "module",
    source: "assets/orbita/optimized/core/orbita_transitos_visual_a.jpg",
    require: require("../../assets/orbita/optimized/core/orbita_transitos_visual_a.jpg"),
    alt: "Visual de tránsitos con geometría orbital."
  },
  bond: {
    key: "bond",
    role: "symbol",
    source: "assets/orbita/optimized/core/orbita_vinculo_symbol_a.jpg",
    require: require("../../assets/orbita/optimized/core/orbita_vinculo_symbol_a.jpg"),
    alt: "Símbolo de vínculo entre cuerpos orbitales."
  },
  studioBackplate: {
    key: "studioBackplate",
    role: "studio",
    source: "assets/orbita/optimized/onboarding-v44/identify_bg_idx21.jpg",
    require: require("../../assets/orbita/optimized/onboarding-v44/identify_bg_idx21.jpg"),
    alt: "Atmósfera de eclipse tenue como backplate del Studio."
  },
  homePreview: {
    key: "homePreview",
    role: "studio",
    source: "assets/orbita/web/orbita-home-preview.jpg",
    require: require("../../assets/orbita/web/orbita-home-preview.jpg"),
    alt: "Captura real de la Home diaria de Órbita."
  },
  moduleChartRings: {
    key: "moduleChartRings",
    role: "module",
    source: "assets/orbita/optimized/onboarding-v44/orbital_chart_idx15.jpg",
    require: require("../../assets/orbita/optimized/onboarding-v44/orbital_chart_idx15.jpg"),
    alt: "Anillos orbitales de cobre para la carta base."
  },
  moduleTransitsSwirl: {
    key: "moduleTransitsSwirl",
    role: "module",
    source: "assets/orbita/optimized/onboarding-v44/transits_idx30.jpg",
    require: require("../../assets/orbita/optimized/onboarding-v44/transits_idx30.jpg"),
    alt: "Remolino orbital dinámico para los tránsitos del día."
  },
  moduleHorizon: {
    key: "moduleHorizon",
    role: "module",
    source: "assets/orbita/optimized/onboarding-v44/ascendant_horizon_idx27.jpg",
    require: require("../../assets/orbita/optimized/onboarding-v44/ascendant_horizon_idx27.jpg"),
    alt: "Horizonte cálido al amanecer para el ritmo diario."
  },
  paymentField: {
    key: "paymentField",
    role: "payment",
    source: "assets/orbita/optimized/onboarding-v44/payment_idx62.jpg",
    require: require("../../assets/orbita/optimized/onboarding-v44/payment_idx62.jpg"),
    alt: "Campo oscuro premium usado en la pantalla de pago."
  },
  sunSymbol: {
    key: "sunSymbol",
    role: "symbol",
    source: "assets/orbita/optimized/onboarding-v44/sun_emblem_idx25.jpg",
    require: require("../../assets/orbita/optimized/onboarding-v44/sun_emblem_idx25.jpg"),
    alt: "Emblema solar cobre para módulos simbólicos."
  },
  moonPhase: {
    key: "moonPhase",
    role: "symbol",
    source: "assets/orbita/optimized/archive-10/moon_phase_dark_full_orbital_idx20.jpg",
    require: require("../../assets/orbita/optimized/archive-10/moon_phase_dark_full_orbital_idx20.jpg"),
    alt: "Luna oscura con órbitas finas para el lenguaje simbólico de Órbita."
  },
  zodiacEmblem: {
    key: "zodiacEmblem",
    role: "symbol",
    source: "assets/orbita/optimized/archive-10/zodiac_scorpio_idx08.jpg",
    require: require("../../assets/orbita/optimized/archive-10/zodiac_scorpio_idx08.jpg"),
    alt: "Emblema zodiacal cobre sobre fondo oscuro."
  },
  ringSystem: {
    key: "ringSystem",
    role: "symbol",
    source: "assets/orbita/optimized/archive-10/chart_orbital_ring_system_idx15.jpg",
    require: require("../../assets/orbita/optimized/archive-10/chart_orbital_ring_system_idx15.jpg"),
    alt: "Sistema de anillos orbitales para carta y mapas internos."
  }
} satisfies Record<string, WebAssetSlot>;

export const webAssetSequence: WebAssetSlot[] = [
  webAssets.heroOrbital,
  webAssets.dailyTexture,
  webAssets.natalChart,
  webAssets.transits,
  webAssets.longRead,
  webAssets.bond,
  webAssets.sunSymbol,
  webAssets.moonPhase,
  webAssets.zodiacEmblem,
  webAssets.ringSystem
];
