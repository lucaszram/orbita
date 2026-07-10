# Órbita · Mazo de tarot — prompts de generación (78 cartas)

Spec para generar el mazo completo con IA (Higgsfield / Midjourney), en el
lenguaje visual de Órbita. Es la fuente para la **carta del día** de la Home
(`src/components/home/CartaDelDia.tsx`).

## Qué es "el mazo": 78 cartas

- **22 Arcanos Mayores** (0–XXI) — los arquetipos. **Prioridad**: son los que
  usa la carta del día y los que tienen correspondencia astrológica.
- **56 Arcanos Menores** — 4 palos × 14 cartas:
  - Palos: **Bastos** (fuego), **Copas** (agua), **Espadas** (aire), **Oros/Pentáculos** (tierra).
  - Cada palo: **As, 2, 3, 4, 5, 6, 7, 8, 9, 10** + **Sota, Caballero, Reina, Rey**.

> Empezá por los 22 Mayores. Los 56 Menores se pueden dejar para una v2.

---

## Cómo usarlo (consistencia = todo)

1. Generá **primero el dorso** → es el ancla de estilo del mazo.
2. Usalo como **referencia de estilo** (`--sref` en MJ / "style reference" o
   imagen semilla en Higgsfield) para TODAS las demás.
3. Pegá el **bloque de estilo base** en cada prompt y solo cambiás el `SUJETO`.
4. **Sin texto en la imagen** — el número y el nombre los pone la app encima
   (evita las letras deformes de la IA).
5. Exportar en **2:3 portrait** (~832×1248 o más). La app las muestra a 150×224
   y las recorta con `resizeMode: cover`.

## Estilo base (pegar en TODAS)

```
Órbita tarot card. Engraved copper line-art on deep near-black background
(#0A0B0D). Luminous burnished copper (#C46A3A) and pale bone linework,
sparse gold-leaf accents. Single soft moonlight source, deep chiaroscuro,
fine starfield grain and subtle cosmic texture. Minimalist celestial
editorial illustration — symmetrical, one iconic centered subject, thin
double copper frame with slightly rounded corners. Premium, restrained,
mystical. No color beyond copper/gold/bone on black. Portrait 2:3.
SUJETO: {…}
```

**Parámetros:** `--ar 2:3 --style raw` (MJ) · Higgsfield: aspecto **2:3**.

**Negativo:** `text, letters, numbers, watermark, signature, bright
Rider-Waite colors, rainbow, cluttered busy background, photorealism,
modern clothing, cartoon, low contrast`

## Dorso (generar primero = ancla)

```
SUJETO: card back — a centered copper concentric-orbit mandala (a small
solar dot with two thin orbital rings), a faint ring of constellations,
perfectly symmetrical, empty margins, no figures.
```

---

## 22 Arcanos Mayores

`estilo base` + `SUJETO`. Entre `[ ]` la **correspondencia astrológica
verificada** (Golden Dawn / RWS) — poné el glifo chico en el marco.

| # | Carta | Correspondencia | SUJETO |
|---|-------|-----------------|--------|
| 0 | El Loco | Aire ♅ (Urano) | a carefree youth mid-step at a cliff's edge, white rose in hand, a bundle on a staff, a small dog leaping at the heels, open luminous sky, the abyss below |
| I | El Mago | Mercurio ☿ | a standing figure, one arm raised to sky one to earth, infinity lemniscate overhead, a table with cup/sword/wand/pentacle, roses and lilies |
| II | La Sacerdotisa | **Luna ☽** | a veiled priestess seated between a dark and a light pillar, a crescent moon at her feet, a half-hidden scroll, a pomegranate veil |
| III | La Emperatriz | Venus ♀ | a serene crowned woman on a cushioned throne in a field of wheat, a Venus-marked shield, a river, a crown of twelve stars |
| IV | El Emperador | Aries ♈ | a stern crowned ruler on a stone throne carved with ram heads, orb and scepter, barren mountains |
| V | El Hierofante | Tauro ♉ | a religious elder between two pillars, triple crown, hand raised in blessing, two acolytes below, crossed keys |
| VI | Los Enamorados | Géminis ♊ | two figures beneath a radiant winged angel, a tree of flame and a tree of fruit, a mountain, the sun above |
| VII | El Carro | Cáncer ♋ | an armored victor in a chariot drawn by two sphinxes (one dark one light), a starry canopy, a walled city, crescent moons on the shoulders |
| VIII | La Fuerza | Leo ♌ | a calm woman gently closing the jaws of a lion, an infinity lemniscate overhead, a garland of flowers |
| IX | El Ermitaño | Virgo ♍ | a cloaked old man on a peak holding a lantern with a six-pointed star inside, a staff, alone in the night |
| X | La Rueda de la Fortuna | Júpiter ♃ | a great cosmic wheel inscribed with symbols, a sphinx atop, a serpent descending, four winged creatures in the corners |
| XI | La Justicia | Libra ♎ | a crowned enthroned figure, an upright sword in one hand, balanced scales in the other, between two pillars |
| XII | El Colgado | Agua ♆ (Neptuno) | a serene figure suspended upside-down by one foot from a living T-tree, hands behind back, a radiant halo, calm surrender |
| XIII | La Muerte | Escorpio ♏ | a skeletal rider in black armor on a pale horse, a black banner with a white rose, a fallen king, a sun rising between two towers |
| XIV | La Templanza | Sagitario ♐ | a winged angel pouring liquid between two cups, one foot on land one in water, a path to distant mountains crowned with light |
| XV | El Diablo | Capricornio ♑ | a horned goat-headed figure on a pedestal, an inverted torch, two loosely chained figures below, bat wings, a dark cavern |
| XVI | La Torre | Marte ♂ | a tall tower struck by lightning, its crown blasted off, two figures falling, flames from the windows, a storm |
| XVII | La Estrella | Acuario ♒ | a kneeling figure by a pool pouring water from two jugs (one to land one to water), one large eight-pointed star and seven smaller, a bird on a tree |
| XVIII | La Luna | **Piscis ♓** | a full moon with a face shedding dew between two towers, a dog and a wolf howling, a crayfish emerging from a pool, a winding path |
| XIX | El Sol | Sol ☉ | a radiant sun with a face, a joyful child on a white horse, sunflowers over a wall, a red banner |
| XX | El Juicio | Fuego ♇ (Plutón) | an angel blowing a trumpet with a banner from the clouds, figures rising from tombs with raised arms, mountains and sea |
| XXI | El Mundo | Saturno ♄ | a dancing figure inside a great laurel-wreath oval holding two wands, four winged creatures in the corners |

> **Las dos que confunden a todos** (y que van bien): **II La Sacerdotisa = Luna**
> y **XVIII La Luna = Piscis** (no la Luna). El resto de Mayores planeta/signo
> según Golden Dawn.

---

## 56 Arcanos Menores

Mismo `estilo base`; cada palo suma **un acento de color chico** para
distinguirse sin romper el mazo. Emblema del palo = el objeto que se repite.

| Palo | Elemento | Emblema | Acento |
|------|----------|---------|--------|
| Bastos | Fuego | a budding wooden staff | brasa cobre-naranja |
| Copas | Agua | a chalice | plata azulada tenue |
| Espadas | Aire | an upright blade | acero pálido / bone |
| Oros | Tierra | a golden pentacle coin | pan de oro |

### Bastos (Fuego)

| Carta | SUJETO |
|-------|--------|
| As | a hand from a cloud holding a sprouting wand, a castle on a distant hill |
| 2 | a figure on a castle wall holding a globe, one wand fixed one in hand, looking out to sea |
| 3 | a figure on a cliff watching three ships sail, three wands planted |
| 4 | four wands garlanded with flowers, two figures celebrating before a castle |
| 5 | five youths brandishing wands in playful mock combat |
| 6 | a laurel-crowned rider on horseback carrying a wand, a cheering crowd |
| 7 | a figure on high ground defending with a wand against six wands rising below |
| 8 | eight wands flying through the air over a landscape toward the ground |
| 9 | a weary wounded figure leaning on a wand, eight wands behind like a fence |
| 10 | a burdened figure carrying ten heavy wands toward a distant town |
| Sota | a youth in the desert examining a sprouting wand |
| Caballero | an armored rider on a rearing horse holding a wand, salamander motifs |
| Reina | a queen enthroned with a wand and a sunflower, a black cat at her feet |
| Rey | a king enthroned with a wand, salamanders and lions on the throne |

### Copas (Agua)

| Carta | SUJETO |
|-------|--------|
| As | a hand from a cloud holding an overflowing chalice, a dove descending, five streams |
| 2 | two figures exchanging cups, a caduceus with a winged lion's head above |
| 3 | three women raising cups in a toast among fruits |
| 4 | a figure under a tree, arms crossed, three cups before and a fourth offered from a cloud |
| 5 | a cloaked figure mourning over three spilled cups, two upright behind, a bridge to a castle |
| 6 | two children among six cups filled with white flowers in a courtyard |
| 7 | a figure facing seven cups floating in cloud, each holding a vision (castle, jewels, wreath, dragon, veiled figure, snake, face) |
| 8 | a figure walking away from eight stacked cups toward mountains under a moon |
| 9 | a satisfied figure seated with arms crossed before nine cups arched behind |
| 10 | a couple with raised arms before a rainbow of ten cups, two children dancing |
| Sota | a youth by the sea holding a cup with a fish emerging from it |
| Caballero | a rider advancing slowly holding out a cup, a winged helmet, a river |
| Reina | a queen enthroned at the water's edge gazing into an ornate lidded cup |
| Rey | a king enthroned on a throne floating on a turbulent sea, holding a cup |

### Espadas (Aire)

| Carta | SUJETO |
|-------|--------|
| As | a hand from a cloud gripping an upright sword crowned with a laurel wreath |
| 2 | a blindfolded figure seated holding two crossed swords, a crescent moon, a calm sea |
| 3 | a heart pierced by three swords under rain clouds |
| 4 | a knight lying in repose like a tomb effigy, three swords on the wall and one beneath |
| 5 | a figure gathering swords smirking while two others walk away defeated, a stormy sky |
| 6 | a ferryman poling a boat with six swords aboard, carrying a cloaked figure and child to a far shore |
| 7 | a figure sneaking away carrying five swords, leaving two behind, a camp |
| 8 | a bound and blindfolded figure surrounded by eight upright swords, water and a castle |
| 9 | a figure sitting up in bed in anguish, nine swords on the wall |
| 10 | a figure fallen face-down with ten swords in the back, a dark sky and a dawning horizon |
| Sota | a youth on a windswept hilltop wielding a raised sword |
| Caballero | an armored knight charging at full gallop, sword raised, wind and storm |
| Reina | a queen enthroned in clouds holding an upright sword, one hand extended |
| Rey | a king enthroned holding an upright sword, butterflies and birds on the throne, clouds |

### Oros / Pentáculos (Tierra)

| Carta | SUJETO |
|-------|--------|
| As | a hand from a cloud holding a golden pentacle, a garden gate opening to mountains |
| 2 | a figure dancing juggling two pentacles bound by an infinity lemniscate, ships on rolling waves |
| 3 | a mason at work in a cathedral, two figures reviewing plans, three pentacles |
| 4 | a miser clutching one pentacle to the chest, one on the crown, two under the feet, a town behind |
| 5 | two destitute figures passing a lit stained-glass window in the snow, five pentacles |
| 6 | a merchant weighing coins on scales, giving alms to two kneeling beggars, six pentacles |
| 7 | a farmer leaning on a hoe contemplating a bush laden with seven pentacles |
| 8 | an artisan at a bench carving pentacles, six finished displayed, a town in the distance |
| 9 | an elegant figure in a lush vineyard garden with nine pentacles and a falcon on the wrist |
| 10 | an elder with dogs, a couple and a child under an archway, ten pentacles, a manor |
| Sota | a youth in a field gazing at a pentacle held aloft, tilled earth |
| Caballero | an armored knight on a stationary heavy horse holding a pentacle, plowed fields |
| Reina | a queen enthroned in a garden of roses gazing at a pentacle in her lap, a rabbit |
| Rey | a king enthroned amid grapevines holding a pentacle, bull carvings, a castle |

---

## Integración en la app (cuando estén las imágenes)

- Guardar cada cara en `assets/orbita/optimized/tarot/` con slug estable
  (`major_18_la_luna.jpg`, `wands_03.jpg`, `cups_queen.jpg`…).
- La carta del día la **baraja el backend** (endpoint `tarot`, sembrado por
  `usuario + fecha`) — ver contrato en `convex/CHANGELOG.md`. Hoy `CartaDelDia.tsx`
  usa un mock ("La Luna").
- El **puente honesto** (cómo la carta se conecta con tu tránsito de hoy) lo
  escribe el LLM, pero la **correspondencia** de cada carta sale de este archivo
  (diccionario verificado), no del LLM — el LLM alucina las correspondencias.
