// Órbita onboarding — dark immersive design tokens.
// Single source of truth for the rebuilt onboarding flow.
// Mirrors the Figma V4.4 "Immersive Pass" (all-dark) palette.

export const orbita = {
  // surfaces
  bg: "#0A0B0E", // base near-black
  bgElev: "#12141A", // elevated cards / glass
  ink: "#0B0C0F", // deepest ink (text on copper)
  wash: "rgba(6, 7, 10, 0.55)", // legibility wash over immersive assets

  // text
  bone: "#F4EEE4", // primary light text
  boneSoft: "#EFE7DA",
  muted: "#B4AEA6", // secondary text on dark
  faint: "rgba(244, 238, 228, 0.55)",

  // accent
  copper: "#C46A3A",
  copperSoft: "#D69A6A",
  copperGlow: "rgba(242, 122, 56, 0.16)",

  // lines / hairlines
  line: "rgba(244, 238, 228, 0.14)",
  lineStrong: "rgba(244, 238, 228, 0.22)",
} as const;

export const font = {
  serif: "Newsreader_500Medium",
  serifReg: "Newsreader_400Regular",
  sans: "Inter_400Regular",
  sansMed: "Inter_500Medium",
  sansBold: "Inter_700Bold",
} as const;

// Consistent horizontal gutter for onboarding content.
export const GUTTER = 24;
