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
    source: "assets/orbita/core/orbita_home_hero_orbital_b.png",
    require: require("../../assets/orbita/core/orbita_home_hero_orbital_b.png"),
    alt: "Cuerpo orbital oscuro con línea cobre para la portada de Órbita."
  },
  dailyTexture: {
    key: "dailyTexture",
    role: "texture",
    source: "assets/orbita/core/orbita_daily_texture_b.png",
    require: require("../../assets/orbita/core/orbita_daily_texture_b.png"),
    alt: "Textura astral oscura con trazos orbitales para guía diaria."
  },
  longRead: {
    key: "longRead",
    role: "module",
    source: "assets/orbita/core/orbita_long_read_thumbnail_a.png",
    require: require("../../assets/orbita/core/orbita_long_read_thumbnail_a.png"),
    alt: "Composición editorial lunar para lectura larga."
  },
  natalChart: {
    key: "natalChart",
    role: "module",
    source: "assets/orbita/core/orbita_carta_natal_diagram_a.png",
    require: require("../../assets/orbita/core/orbita_carta_natal_diagram_a.png"),
    alt: "Diagrama de carta natal en clave editorial oscura."
  },
  transits: {
    key: "transits",
    role: "module",
    source: "assets/orbita/core/orbita_transitos_visual_a.png",
    require: require("../../assets/orbita/core/orbita_transitos_visual_a.png"),
    alt: "Visual de tránsitos con geometría orbital."
  },
  bond: {
    key: "bond",
    role: "symbol",
    source: "assets/orbita/core/orbita_vinculo_symbol_a.png",
    require: require("../../assets/orbita/core/orbita_vinculo_symbol_a.png"),
    alt: "Símbolo de vínculo entre cuerpos orbitales."
  },
  studioBackplate: {
    key: "studioBackplate",
    role: "studio",
    source: "assets/orbita/optimized/onboarding-v44/transits_idx30.jpg",
    require: require("../../assets/orbita/optimized/onboarding-v44/transits_idx30.jpg"),
    alt: "Backplate orbital dinámico para el Studio."
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
    source: "assets/orbita/higgsfield/archive-10/selected/moon-phases/archive10_moon_phase_dark_full_orbital__idx20__hf_20260703_003728_4e8e7813-6891-40d6-afa7-ff54262e8c7d.png",
    require: require("../../assets/orbita/higgsfield/archive-10/selected/moon-phases/archive10_moon_phase_dark_full_orbital__idx20__hf_20260703_003728_4e8e7813-6891-40d6-afa7-ff54262e8c7d.png"),
    alt: "Luna oscura con órbitas finas para el lenguaje simbólico de Órbita."
  },
  zodiacEmblem: {
    key: "zodiacEmblem",
    role: "symbol",
    source: "assets/orbita/higgsfield/archive-10/selected/zodiac-emblems/archive10_zodiac_scorpio__idx08__hf_20260703_003410_e829a6c6-2b8a-4ba9-a6c0-b42e9e3b53a3.png",
    require: require("../../assets/orbita/higgsfield/archive-10/selected/zodiac-emblems/archive10_zodiac_scorpio__idx08__hf_20260703_003410_e829a6c6-2b8a-4ba9-a6c0-b42e9e3b53a3.png"),
    alt: "Emblema zodiacal cobre sobre fondo oscuro."
  },
  ringSystem: {
    key: "ringSystem",
    role: "symbol",
    source: "assets/orbita/higgsfield/archive-10/selected/backgrounds/archive10_chart_orbital_ring_system__idx15__hf_20260703_003620_1a5dde8e-83bb-4467-92aa-05390062a68b.png",
    require: require("../../assets/orbita/higgsfield/archive-10/selected/backgrounds/archive10_chart_orbital_ring_system__idx15__hf_20260703_003620_1a5dde8e-83bb-4467-92aa-05390062a68b.png"),
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
