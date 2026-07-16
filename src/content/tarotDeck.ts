import type { ImageSourcePropType } from "react-native";
import { TAROT_CATALOG, type TarotCatalogCard } from "./tarotCatalog";

// El sorteo del invitado es puro (sin assets) y vive en el catálogo; se
// re-exporta acá para que los consumidores sigan importando de tarotDeck.
export { guestCardIdForDate, guestCardOfTheDay } from "./tarotCatalog";

/** El mazo completo con sus ilustraciones. El catálogo (ids, nombres, keys)
 *  vive en `tarotCatalog.ts` (puro, testeable en node); acá solo se le suma
 *  la imagen: Metro exige require() con string literal estático, por eso el
 *  mapa de 78 entradas se escribe a mano, indexado por `key` del catálogo. */
export type TarotDeckCard = TarotCatalogCard & { image: ImageSourcePropType };

const IMAGES: Record<string, ImageSourcePropType> = {
  major_00_el_loco: require("../../assets/orbita/optimized/tarot/major_00_el_loco.jpg"),
  major_01_el_mago: require("../../assets/orbita/optimized/tarot/major_01_el_mago.jpg"),
  major_02_la_sacerdotisa: require("../../assets/orbita/optimized/tarot/major_02_la_sacerdotisa.jpg"),
  major_03_la_emperatriz: require("../../assets/orbita/optimized/tarot/major_03_la_emperatriz.jpg"),
  major_04_el_emperador: require("../../assets/orbita/optimized/tarot/major_04_el_emperador.jpg"),
  major_05_el_hierofante: require("../../assets/orbita/optimized/tarot/major_05_el_hierofante.jpg"),
  major_06_los_enamorados: require("../../assets/orbita/optimized/tarot/major_06_los_enamorados.jpg"),
  major_07_el_carro: require("../../assets/orbita/optimized/tarot/major_07_el_carro.jpg"),
  major_08_la_fuerza: require("../../assets/orbita/optimized/tarot/major_08_la_fuerza.jpg"),
  major_09_el_ermitano: require("../../assets/orbita/optimized/tarot/major_09_el_ermitano.jpg"),
  major_10_la_rueda: require("../../assets/orbita/optimized/tarot/major_10_la_rueda.jpg"),
  major_11_la_justicia: require("../../assets/orbita/optimized/tarot/major_11_la_justicia.jpg"),
  major_12_el_colgado: require("../../assets/orbita/optimized/tarot/major_12_el_colgado.jpg"),
  major_13_la_muerte: require("../../assets/orbita/optimized/tarot/major_13_la_muerte.jpg"),
  major_14_la_templanza: require("../../assets/orbita/optimized/tarot/major_14_la_templanza.jpg"),
  major_15_el_diablo: require("../../assets/orbita/optimized/tarot/major_15_el_diablo.jpg"),
  major_16_la_torre: require("../../assets/orbita/optimized/tarot/major_16_la_torre.jpg"),
  major_17_la_estrella: require("../../assets/orbita/optimized/tarot/major_17_la_estrella.jpg"),
  major_18_la_luna: require("../../assets/orbita/optimized/tarot/major_18_la_luna.jpg"),
  major_19_el_sol: require("../../assets/orbita/optimized/tarot/major_19_el_sol.jpg"),
  major_20_el_juicio: require("../../assets/orbita/optimized/tarot/major_20_el_juicio.jpg"),
  major_21_el_mundo: require("../../assets/orbita/optimized/tarot/major_21_el_mundo.jpg"),
  wands_ace: require("../../assets/orbita/optimized/tarot/wands_ace.jpg"),
  wands_02: require("../../assets/orbita/optimized/tarot/wands_02.jpg"),
  wands_03: require("../../assets/orbita/optimized/tarot/wands_03.jpg"),
  wands_04: require("../../assets/orbita/optimized/tarot/wands_04.jpg"),
  wands_05: require("../../assets/orbita/optimized/tarot/wands_05.jpg"),
  wands_06: require("../../assets/orbita/optimized/tarot/wands_06.jpg"),
  wands_07: require("../../assets/orbita/optimized/tarot/wands_07.jpg"),
  wands_08: require("../../assets/orbita/optimized/tarot/wands_08.jpg"),
  wands_09: require("../../assets/orbita/optimized/tarot/wands_09.jpg"),
  wands_10: require("../../assets/orbita/optimized/tarot/wands_10.jpg"),
  wands_page: require("../../assets/orbita/optimized/tarot/wands_page.jpg"),
  wands_knight: require("../../assets/orbita/optimized/tarot/wands_knight.jpg"),
  wands_queen: require("../../assets/orbita/optimized/tarot/wands_queen.jpg"),
  wands_king: require("../../assets/orbita/optimized/tarot/wands_king.jpg"),
  cups_ace: require("../../assets/orbita/optimized/tarot/cups_ace.jpg"),
  cups_02: require("../../assets/orbita/optimized/tarot/cups_02.jpg"),
  cups_03: require("../../assets/orbita/optimized/tarot/cups_03.jpg"),
  cups_04: require("../../assets/orbita/optimized/tarot/cups_04.jpg"),
  cups_05: require("../../assets/orbita/optimized/tarot/cups_05.jpg"),
  cups_06: require("../../assets/orbita/optimized/tarot/cups_06.jpg"),
  cups_07: require("../../assets/orbita/optimized/tarot/cups_07.jpg"),
  cups_08: require("../../assets/orbita/optimized/tarot/cups_08.jpg"),
  cups_09: require("../../assets/orbita/optimized/tarot/cups_09.jpg"),
  cups_10: require("../../assets/orbita/optimized/tarot/cups_10.jpg"),
  cups_page: require("../../assets/orbita/optimized/tarot/cups_page.jpg"),
  cups_knight: require("../../assets/orbita/optimized/tarot/cups_knight.jpg"),
  cups_queen: require("../../assets/orbita/optimized/tarot/cups_queen.jpg"),
  cups_king: require("../../assets/orbita/optimized/tarot/cups_king.jpg"),
  swords_ace: require("../../assets/orbita/optimized/tarot/swords_ace.jpg"),
  swords_02: require("../../assets/orbita/optimized/tarot/swords_02.jpg"),
  swords_03: require("../../assets/orbita/optimized/tarot/swords_03.jpg"),
  swords_04: require("../../assets/orbita/optimized/tarot/swords_04.jpg"),
  swords_05: require("../../assets/orbita/optimized/tarot/swords_05.jpg"),
  swords_06: require("../../assets/orbita/optimized/tarot/swords_06.jpg"),
  swords_07: require("../../assets/orbita/optimized/tarot/swords_07.jpg"),
  swords_08: require("../../assets/orbita/optimized/tarot/swords_08.jpg"),
  swords_09: require("../../assets/orbita/optimized/tarot/swords_09.jpg"),
  swords_10: require("../../assets/orbita/optimized/tarot/swords_10.jpg"),
  swords_page: require("../../assets/orbita/optimized/tarot/swords_page.jpg"),
  swords_knight: require("../../assets/orbita/optimized/tarot/swords_knight.jpg"),
  swords_queen: require("../../assets/orbita/optimized/tarot/swords_queen.jpg"),
  swords_king: require("../../assets/orbita/optimized/tarot/swords_king.jpg"),
  pentacles_ace: require("../../assets/orbita/optimized/tarot/pentacles_ace.jpg"),
  pentacles_02: require("../../assets/orbita/optimized/tarot/pentacles_02.jpg"),
  pentacles_03: require("../../assets/orbita/optimized/tarot/pentacles_03.jpg"),
  pentacles_04: require("../../assets/orbita/optimized/tarot/pentacles_04.jpg"),
  pentacles_05: require("../../assets/orbita/optimized/tarot/pentacles_05.jpg"),
  pentacles_06: require("../../assets/orbita/optimized/tarot/pentacles_06.jpg"),
  pentacles_07: require("../../assets/orbita/optimized/tarot/pentacles_07.jpg"),
  pentacles_08: require("../../assets/orbita/optimized/tarot/pentacles_08.jpg"),
  pentacles_09: require("../../assets/orbita/optimized/tarot/pentacles_09.jpg"),
  pentacles_10: require("../../assets/orbita/optimized/tarot/pentacles_10.jpg"),
  pentacles_page: require("../../assets/orbita/optimized/tarot/pentacles_page.jpg"),
  pentacles_knight: require("../../assets/orbita/optimized/tarot/pentacles_knight.jpg"),
  pentacles_queen: require("../../assets/orbita/optimized/tarot/pentacles_queen.jpg"),
  pentacles_king: require("../../assets/orbita/optimized/tarot/pentacles_king.jpg")
};

export const TAROT_DECK: ReadonlyArray<TarotDeckCard> = TAROT_CATALOG.map((card) => ({
  ...card,
  image: IMAGES[card.key]
}));

if (__DEV__) {
  // El typecheck no puede garantizar que IMAGES cubra todo el catálogo (las
  // keys de los menores se generan); en dev, un hueco se grita al arrancar.
  for (const card of TAROT_DECK) {
    if (!card.image) console.warn(`[orbita] carta sin asset: ${card.id} ${card.key}`);
  }
}

/** Dorso de la carta (boca abajo). Alternativa: `orbita_card_back_mandala.jpg`. */
export const CARD_BACK: ImageSourcePropType = require("../../assets/orbita/optimized/tarot/orbita_card_back_orbits.jpg");

/** Resolución por id 0–77 (contrato PR #15). Un id fuera de rango (payload
 *  futuro/dañado) devuelve undefined: los consumidores caen al dorso. */
export const cardById = (id: number): TarotDeckCard | undefined => TAROT_DECK[id];
