/**
 * Preguntas sugeridas de El Vacío, por categoría (estructura inspirada en el Void
 * de Co-Star: tabs + lista de prompts). Copy propio de Órbita, voseo, framing de
 * autoconocimiento — sin claims de destino/salud/dinero/legal (ver AGENTS.md).
 * Neutro de género a propósito (la identidad del usuario puede ser cualquiera).
 */

export type VoidCategory = "yo" | "amor" | "trabajo" | "vinculos";

export type VoidCategoryDef = {
  key: VoidCategory;
  label: string;
  /**
   * Emblema de la categoría, como clave del catálogo vectorial propio
   * (`domain/astroGlyphs`). Antes era un carácter Unicode (`☉ ♀ ♄ ☍`) que en
   * web y Android caía al font de emoji; la vista dibuja `AstroGlyph`, nunca
   * este string como texto.
   */
  glyph: string;
  prompts: string[];
};

export const VOID_CATEGORIES: VoidCategoryDef[] = [
  {
    key: "yo",
    label: "Yo",
    glyph: "sun",
    prompts: [
      "¿Qué estoy evitando?",
      "¿Qué necesito soltar?",
      "¿Qué parte mía pide atención?",
      "¿Dónde me estoy escondiendo?",
      "¿Qué me estoy exigiendo de más?"
    ]
  },
  {
    key: "amor",
    label: "Amor",
    glyph: "venus",
    prompts: [
      "¿Qué patrón repito en el amor?",
      "¿Qué busco afuera que no me doy?",
      "¿Qué me cuesta pedir?",
      "¿De qué me estoy protegiendo?"
    ]
  },
  {
    key: "trabajo",
    label: "Trabajo",
    glyph: "saturn",
    prompts: [
      "¿Qué estoy postergando?",
      "¿Qué me está pidiendo foco?",
      "¿Qué dejé a medias?",
      "¿Qué me da miedo empezar?"
    ]
  },
  {
    key: "vinculos",
    label: "Vínculos",
    glyph: "mercury",
    prompts: [
      "¿Qué conversación estoy esquivando?",
      "¿A quién necesito escuchar?",
      "¿Qué límite me falta poner?",
      "¿Qué vínculo estoy descuidando?"
    ]
  }
];
