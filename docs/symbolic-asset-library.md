# Symbolic Asset Library - Orbita

## Estado

Objetivo: construir la libreria canonica de simbolos y fondos de Orbita antes de subirlos a Figma.

Archivos locales:

- Catalogo JSON: `assets/orbita/symbolic-library/symbolic-asset-catalog.json`
- Catalogo CSV: `assets/orbita/symbolic-library/symbolic-asset-catalog.csv`
- Prompts Batch 1 PNG: `assets/orbita/symbolic-library/prompts/batch-1-png-prompts.md`
- Referencias Archive 9: `assets/orbita/higgsfield/archive-9/`
- Intake Archive 10: `assets/orbita/higgsfield/archive-10/`

Totales del catalogo:

- Total: `265` assets planificados.
- Batch 1: `81`.
- Batch 2: `85`.
- Batch 3: `30`.
- Batch 4: `56`.
- Batch 5: `13`.

## Direccion visual

- Base visual: dark premium, charcoal, cobre sutil, geometria orbital, editorial y sobria.
- Referencia propia: `archive-9`, especialmente cuerpos orbitales, diagramas cobre, simbolo libro y backplates verticales.
- Referencias externas: Moonly para onboarding/tarot; Co-Star para ritmo editorial, carta, tabs, listas y simbolos funcionales.
- No copiar assets externos. Solo tomar categorias y modos de uso.

## Reglas de produccion

- Los simbolos funcionales deben terminar como vector editable en Figma cuando sean iconos de UI.
- Los PNGs editoriales son para atmosfera, profundidad, fondos y composicion.
- No asumir transparencia: si el PNG viene `RGB`, se usa como fondo/crop, no como sticker.
- Rechazo automatico: texto horneado, UI, logos, marcos, phone mockup no pedido, checkerboard horneado, clipart zodiacal generico o estetica stock.
- Cada prompt genera un solo asset. No pedir sets combinados.

## Familias

| Familia | Cantidad | Uso principal |
| --- | ---: | --- |
| Zodiaco | 24 | 12 signos como vector editable + emblema PNG editorial |
| Planetas y puntos natales | 34 | carta natal, triada, placements, perfil |
| Casas | 12 | marcadores editables de casas 1-12 |
| Sistema de carta | 7 | rueda natal, tránsitos, sinastria, progresos, grillas |
| Aspectos | 18 | simbolos y diagramas de aspectos |
| Fases lunares | 20 | moon calendar, daily guide, modulos lunares |
| Elementos/modalidades | 18 | resumen de perfil y educacion astrologica |
| Topics de app | 24 | tabs, filas editoriales y modulos |
| Arcanos mayores | 22 | tarot inicial completo |
| Arcanos menores | 56 | tarot completo |
| Tarot UI kit | 8 | reverso, mazo, spreads y estados |
| Simbolos editoriales | 13 | modulos generales, plus, guardadas, perfil |
| Fondos integrables | 9 | home, onboarding, payment, chart, vinculo |

## Batches

- Batch 1: 12 signos, planetas principales, 8 fases lunares base, 4 elementos, 4 topics principales y fondos prioritarios.
- Batch 2: casas 1-12, puntos natales secundarios, aspectos, carta/tránsitos/sinastría, topics secundarios y fondos core.
- Batch 3: 22 Arcanos Mayores + Tarot UI kit.
- Batch 4: 56 Arcanos Menores.
- Batch 5: simbolos editoriales generales para modulos, perfil, plus, historial, guardadas y estados vacios.

## Nomenclatura

Formato de ID:

```text
orbita_{familia}_{nombre}_{variante}
```

Ejemplos:

- `orbita_zodiac_aries_editable_symbol`
- `orbita_zodiac_aries_editorial_emblem_png`
- `orbita_topic_amor_editable_symbol`
- `orbita_tarot_major_el_loco_card_art_png`
- `orbita_integrable_background_payment_plus_background_png`

## Referencias Archive 9

Fuente cruda: `/Users/lucas/Downloads/archive (9)/`.

Destino local:

- `assets/orbita/higgsfield/archive-9/inbox/`
- `assets/orbita/higgsfield/archive-9/style-reference/`
- `assets/orbita/higgsfield/archive-9/contact-sheets/`
- `assets/orbita/higgsfield/archive-9/manifest.json`
- `assets/orbita/higgsfield/archive-9/manifest.csv`

Lectura:

- Total: `10` PNGs.
- Square: `7` assets `2048x2048`.
- Vertical: `3` assets `1536x2752`.
- Alpha real: `0/10`.
- Estado: referencia de estilo, no subida automatica a Figma.

## Intake Archive 10

Fuente cruda: `/Users/lucas/Downloads/archive (10)/`.

Destino local:

- `assets/orbita/higgsfield/archive-10/inbox/`
- `assets/orbita/higgsfield/archive-10/selected/`
- `assets/orbita/higgsfield/archive-10/needs-review/`
- `assets/orbita/higgsfield/archive-10/rejected/`
- `assets/orbita/higgsfield/archive-10/contact-sheets/`
- `assets/orbita/higgsfield/archive-10/manifest.json`
- `assets/orbita/higgsfield/archive-10/manifest.csv`

Lectura:

- Total: `36` PNGs.
- Seleccionados: `35`.
- Needs review: `1`, Capricornio.
- Rechazados: `0`.
- Alpha real: `0/36`.
- Familias cubiertas: zodiaco, fases lunares, planetas/puntos, simbolos de app y fondos/guardas.
- Estado: primera tanda real de la libreria simbolica. Todavia requiere aprobacion visual/semantica antes de subir a Figma.

Uso recomendado:

- Los assets de zodiaco funcionan como emblemas editoriales grandes, no como iconos chicos de UI.
- Las fases lunares y planetas funcionan bien como fondos o modulos visuales integrados.
- Los simbolos funcionales chicos siguen necesitando version vector editable en Figma.
- No tratarlos como PNG transparentes: son fondos RGB y deben entrar con crop, mascara o composicion sobre dark.

## Referencias Mobbin

- Moonly onboarding: `https://mobbin.com/flows/992bc16a-8d0b-4961-8078-98e2e807a32a`
- Co-Star home: `https://mobbin.com/flows/1de820c7-f97c-465d-a5f1-e8d7f68d4276`
- Co-Star home/chart screen: `https://mobbin.com/screens/e4a77b32-e361-4fa0-93fb-fd2bc99982d6`
- Moonly tarot screen: `https://mobbin.com/screens/d97a788b-8007-4181-93ca-b33f8f1c87fc`

## Proxima accion recomendada

Generar primero `assets/orbita/symbolic-library/prompts/batch-1-png-prompts.md`, revisar visualmente, clasificar como `selected/rejected/reference`, y recien despues llevar ganadores a Figma.
