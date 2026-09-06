import { orbita } from "@/theme/orbita";

/**
 * Sistema V4.9.2 — tokens de la capa nativa.
 *
 * Los colores y las familias vienen del tema de Órbita (`src/theme/orbita`):
 * base `#0A0B0E`, superficie `#12141A`, cobre `#C46A3A`, cobre suave `#D69A6A`
 * y texto `#F4EEE4`. Acá sólo se fija la ESCALA de la retícula de 393 px con
 * gutters de 24 que usan las pantallas de capas.
 *
 * `maxScale` acompaña a cada tamaño: Dynamic Type queda activo (nunca se apaga
 * `allowFontScaling`) y los roles de LECTURA —cuerpo, nota, rótulo— llegan al
 * doble, que es donde empiezan los tamaños de accesibilidad de iOS. Toparlos
 * antes deja fuera justo a quien necesita el ajuste. Los titulares crecen menos
 * porque parten de un tamaño ya grande, pero siguen escalando.
 *
 * `label` es el rol de los CTA y de los rótulos de dato: 12 px es el piso, no un
 * valor de composición.
 */
export const v492 = {
  colors: {
    background: orbita.colors.background,
    surface: orbita.colors.surface,
    surfaceRaised: orbita.colors.surfaceRaised,
    text: orbita.colors.bone,
    textMuted: orbita.colors.muted,
    textDim: orbita.colors.mutedDim,
    copper: orbita.colors.copper,
    copperSoft: orbita.colors.copperSoft,
    /**
     * Azul de lo fluido. Es el MISMO token con el que la rueda natal pinta un
     * contacto armónico (`orbita.colors.harmony`), y por eso lo usan las barras
     * de Vínculos: el azul significa lo mismo en las dos pantallas.
     */
    harmony: orbita.colors.harmony,
    line: orbita.colors.line,
    /** Relleno de barras sin dato: se ve el riel, no un valor inventado. */
    rail: "rgba(244, 238, 228, 0.10)"
  },
  fonts: orbita.fonts,
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    gutter: 24
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 18,
    pill: 999
  },
  type: {
    display: { size: 34, line: 40, maxScale: 1.6 },
    title: { size: 26, line: 32, maxScale: 1.7 },
    subtitle: { size: 20, line: 27, maxScale: 1.8 },
    body: { size: 15, line: 22, maxScale: 2 },
    small: { size: 13, line: 19, maxScale: 2 },
    label: { size: 12, line: 17, maxScale: 2 }
  },
  /** Mínimo táctil accesible en las dos plataformas. */
  touch: 44
} as const;
