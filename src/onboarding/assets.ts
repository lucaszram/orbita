// Órbita onboarding — asset require map (rebuilt flow).
// Paths are relative to this file (src/onboarding/) → repo assets/ at ../../.
// Optimized JPGs are preferred; core PNGs / archive symbols where needed.

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
  heroEclipse: require("../../assets/orbita/core/orbita_home_hero_orbital_a.png"),
  chartDiagram: require("../../assets/orbita/core/orbita_carta_natal_diagram_a.png"),
  sun: require("../../assets/orbita/optimized/onboarding-v44/sun_emblem_idx25.jpg"),
  ascendant: require("../../assets/orbita/optimized/onboarding-v44/ascendant_horizon_idx27.jpg"),
  rings: require("../../assets/orbita/optimized/onboarding-v44/orbital_chart_idx15.jpg"),
  globe: require("../../assets/orbita/optimized/onboarding-v44/birth_data_idx34.jpg"),
  moon: require("../../assets/orbita/higgsfield/archive-10/selected/moon-phases/archive10_moon_phase_first_quarter_copper__idx18__hf_20260703_003720_cd8f386a-ae56-43a2-befd-3c0349168199.png"),
  saturn: require("../../assets/orbita/higgsfield/archive-10/selected/planetary-symbols/archive10_planet_saturn_close_ring__idx31__hf_20260703_004047_d9c80e5f-05a1-43a4-899e-1b338900705f.png"),
  heart: require("../../assets/orbita/higgsfield/archive-10/selected/app-symbols/archive10_topic_love_or_vinculo_heart_orbit__idx16__hf_20260703_003624_d05c1e75-2bbe-4074-84ab-0a3205f4f5aa.png"),

  // benefit tiles (screen 02)
  tileLunar: require("../../assets/orbita/optimized/onboarding-v44/benefit_lunar_idx68.jpg"),
  tileGuide: require("../../assets/orbita/optimized/onboarding-v44/benefit_guide_idx27.jpg"),
  tilePractice: require("../../assets/orbita/optimized/onboarding-v44/benefit_practice_idx38.jpg"),
  tileDecisions: require("../../assets/orbita/optimized/onboarding-v44/benefit_decisions_idx13.jpg"),
} as const;

export type AssetKey = keyof typeof A;
