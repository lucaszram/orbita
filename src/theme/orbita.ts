// Órbita — dark editorial theme tokens for the app tabs.
// (Reconstructed: colors / fonts / spacing / radius consumed by app/(tabs) + src/components.)

export const orbita = {
  colors: {
    background: "#0A0B0E",
    surface: "#12141A",
    surfaceRaised: "#181B22",
    bone: "#F4EEE4",
    muted: "#B4AEA6",
    mutedDim: "rgba(244, 238, 228, 0.55)",
    copper: "#C46A3A",
    copperSoft: "#D69A6A",
    line: "rgba(244, 238, 228, 0.14)",
    onLight: "#0B0C0F",
    // Aspectos de la carta natal.
    harmony: "#8CA6C4",
    tension: "#C46A3A",
  },
  fonts: {
    body: "Inter_400Regular",
    bodyMedium: "Inter_500Medium",
    serif: "Newsreader_500Medium",
    serifRegular: "Newsreader_400Regular",
    mono: "RobotoMono_400Regular",
    monoMedium: "RobotoMono_500Medium",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    gutter: 24,
  },
  radius: {
    md: 12,
    lg: 18,
    xl: 24,
  },
} as const;
