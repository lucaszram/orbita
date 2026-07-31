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

/**
 * "Ya tengo cuenta · Iniciar sesión" — el único camino de vuelta para alguien
 * que ya tiene cuenta. Vive acá para que el splash y la puerta de alta usen
 * exactamente el mismo tratamiento.
 *
 * **Objeto LITERAL, no `StyleSheet.create`.** En react-native-web una hoja
 * registrada se compila a una CLASE atómica, y el `Text` compartido
 * (`components/ui/text`) ya trae las clases `text-foreground` y `text-base` de
 * Tailwind, que fijan `color`, `font-size` y `line-height`. Clase contra clase
 * ganaba Tailwind: el enlace salía casi negro y a 16px sobre el fondo casi
 * negro, mientras que el subrayado —que esas clases no tocan— sí se aplicaba.
 * Un literal viaja en el atributo `style` y le gana a cualquier clase.
 *
 * Es el mismo mecanismo que dejaba el wordmark de la entrada en 16px.
 *
 * `copperSoft` da 8,14:1 sobre el fondo de Órbita (el cobre de marca da 5,13:1,
 * que pasa el mínimo pero justo) y el subrayado hace que se lea como enlace sin
 * depender del color (WCAG 1.4.1).
 */
export const SIGN_IN_LINK_TEXT = {
  color: orbita.copperSoft,
  fontFamily: font.sansBold,
  fontSize: 15,
  lineHeight: 22,
  textAlign: "center",
  textDecorationLine: "underline",
} as const;

/** 44px de alto real: `hitSlop` no existe en web. */
export const SIGN_IN_LINK_ROW = {
  alignItems: "center",
  alignSelf: "center",
  justifyContent: "center",
  minHeight: 44,
  paddingHorizontal: 12,
} as const;
