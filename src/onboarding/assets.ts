// Órbita onboarding — asset require map (rebuilt flow).
// Paths are relative to this file (src/onboarding/) → repo assets/ at ../../.
//
// Heavy reusable masters point at `assets/orbita/optimized/**`. The small Figma
// splash asset stays in place. Masters under `core/` (2–2,6 MB) and
// `higgsfield/archive-10/` (4,5–5,8 MB) remain untouched as source material and
// do not ship in the web export.
// `scripts/check-web-export.mjs` falla si alguno se cuela.

export const A = {
  // immersive backgrounds
  splashBg: require("../../assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_01_background__152-2.png"),
  dailyTexture: require("../../assets/orbita/optimized/onboarding-v44/daily_texture_b.jpg"),
  guidanceBg: require("../../assets/orbita/optimized/onboarding-v44/daily_backplate_idx66.jpg"),
  identifyBg: require("../../assets/orbita/optimized/onboarding-v44/identify_bg_idx21.jpg"),
  transitsBg: require("../../assets/orbita/optimized/onboarding-v44/transits_idx30.jpg"),
  accountBg: require("../../assets/orbita/optimized/onboarding-v44/account_seal_idx58.jpg"),
  paymentBg: require("../../assets/orbita/optimized/onboarding-v44/payment_idx62.jpg"),
  beforeAfterBg: require("../../assets/orbita/optimized/onboarding-v44/before_after_idx53.jpg"),

  // focal emblems (circular)
  heroEclipse: require("../../assets/orbita/optimized/core/orbita_home_hero_orbital_a.jpg"),
  chartDiagram: require("../../assets/orbita/optimized/core/orbita_carta_natal_diagram_a.jpg"),
  sun: require("../../assets/orbita/optimized/onboarding-v44/sun_emblem_idx25.jpg"),
  ascendant: require("../../assets/orbita/optimized/onboarding-v44/ascendant_horizon_idx27.jpg"),
  rings: require("../../assets/orbita/optimized/onboarding-v44/orbital_chart_idx15.jpg"),
  globe: require("../../assets/orbita/optimized/onboarding-v44/birth_data_idx34.jpg"),
  moon: require("../../assets/orbita/optimized/archive-10/moon_phase_first_quarter_copper_idx18.jpg"),
  saturn: require("../../assets/orbita/optimized/archive-10/planet_saturn_close_ring_idx31.jpg"),
  heart: require("../../assets/orbita/optimized/archive-10/topic_love_heart_orbit_idx16.jpg"),

  // benefit tiles (screen 02)
  tileLunar: require("../../assets/orbita/optimized/onboarding-v44/benefit_lunar_idx68.jpg"),
  tileGuide: require("../../assets/orbita/optimized/onboarding-v44/benefit_guide_idx27.jpg"),
  tilePractice: require("../../assets/orbita/optimized/onboarding-v44/benefit_practice_idx38.jpg"),
  tileDecisions: require("../../assets/orbita/optimized/onboarding-v44/benefit_decisions_idx13.jpg"),
} as const;

export type AssetKey = keyof typeof A;
