# Órbita Social Slideshows

Playbook operativo para investigar, analizar y producir slideshows/photo mode de TikTok para Órbita.

Este flujo es deliberadamente liviano: primero se trabaja con LightReel, una tabla y Figma/Canva. Bright Data, Apify o una futura sección del Studio se usan solo si la investigación manual ya demuestra valor.

## Objetivo

Producir carruseles de astrología, luna y autoconocimiento que se sientan:

- personales sin prometer destino;
- editoriales sin volverse fríos;
- visualmente premium sin copiar a Co-Star, Moonly, TikTok ni Pinterest;
- fáciles de repetir durante dos semanas de prueba.

No incluye videos, talking-head, UGC con personas hablando, ni producción compleja.

## Cadencia de dos semanas

### Día 1 - Radar

1. Abrir LightReel.
2. Buscar por grupos de intención:
   - `astrology slideshow`, `zodiac photo mode`, `birth chart carousel`;
   - `moon ritual slideshow`, `full moon photo mode`, `new moon intentions`;
   - `Venus sign compatibility`, `moon sign relationships`, `synastry carousel`;
   - `astrología carrusel`, `carta astral carrusel`, `luna llena ritual`, `qué tenés que soltar`.
3. Guardar 20 referencias en `benchmark-table.csv`.
4. Marcar como prioridad solo si el post es slideshow/photo mode o si su hook puede convertirse a slideshow.

### Día 2 - Extracción

1. Completar metadata disponible desde LightReel.
2. Si LightReel muestra slides, anotar cantidad y tipo de imagen.
3. Si faltan slides o métricas:
   - usar Bright Data TikTok Scraper para post/profile URL;
   - usar Apify TikTok Scraper como alternativa;
   - dejar `needs_scrape` en `notes` si todavía falta.

No usar TikTok Creative Center para extraer slides; sirve para detectar tendencias generales.

### Día 3 - Lectura visual

1. Clasificar cada referencia con `visual-taxonomy.md`.
2. Puntuar `orbita_fit_1_5`.
3. Escribir por qué funciona y qué NO se debe copiar.
4. Seleccionar 5 ganadoras.

### Día 4 - Búsqueda de equivalentes

1. Para cada ganadora, armar query visual en `replicable_image_query`.
2. Buscar referencias en Pinterest, Cosmos, Are.na, Unsplash/Pexels si aplica, y assets propios de Órbita.
3. Guardar solo referencias, nunca assets finales copiados.
4. Si se genera imagen nueva, preservar prompt y output en carpetas de assets con selected/rejected/reference.

### Día 5 - Briefs

1. Elegir un template de `templates-orbita.md`.
2. Convertir 5 referencias en briefs de carrusel.
3. Cada brief debe tener:
   - hook;
   - tema astrológico;
   - slide count;
   - dirección de imagen;
   - CTA suave;
   - guardrail.

### Semana 2 - Producción piloto

Publicar 10 slideshows:

- 2 de Luna;
- 2 de carta natal/placement;
- 2 de vínculos/compatibilidad;
- 2 de tránsito de la semana;
- 2 de interacción/elegí una imagen.

Medir manualmente a las 24 h y 72 h:

- guardados;
- compartidos;
- comentarios;
- follows por post;
- clicks si hay link.

## Criterio de selección

Priorizar un post cuando cumpla al menos 3:

- el primer slide hace sentir "esto me habla a mí";
- se entiende sin audio;
- tiene 5 a 8 slides o puede comprimirse a ese rango;
- el tema se conecta con carta natal, Luna, tránsitos o vínculos;
- la estética puede traducirse al sistema visual de Órbita;
- se puede producir en menos de 40 minutos usando template.

Descartar o bajar prioridad si:

- depende de una cara/personaje;
- promete resultados concretos en amor, salud, dinero o destino;
- requiere copiar un meme visual exacto;
- tiene estética neón/tarot genérico/gurú;
- el formato funciona solo por audio o edición de video.

## Stack recomendado

- Radar: LightReel + TikTok manual.
- Tendencias generales: TikTok Creative Center.
- Extracción avanzada: Bright Data primero; Apify como backup.
- iDrill: opcional si Lucas provee API/base URL/credenciales; usarlo solo para benchmark o scoring, no como dependencia del piloto.
- Moodboard: Figma, Are.na o Pinterest.
- Producción: Figma para templates serios; Canva si se necesita velocidad.
- Publicación: TikTok Photo Mode.
- Analytics: Metricool o planilla manual.

## Archivos

- `benchmark-table.csv`: tabla principal de referencias.
- `visual-taxonomy.md`: tipos de foto, reglas de fit y búsquedas.
- `templates-orbita.md`: 5 formatos base de carrusel.
- `image-bank-plan.csv`: 60 slots de imágenes propias a buscar/generar.
- `piloto-2-semanas.md`: backlog inicial de posts piloto.

## Guardrails Órbita

- Entretenimiento, autoconocimiento y contexto.
- No destino, no certezas, no salud/dinero/legal.
- Voseo argentino cuando el copy sea visible.
- Evitar `NASA/JPL`, astrología védica y claims técnicos sin respaldo.
- Las imágenes de referencia son inspiración; los assets finales deben ser propios, licenciados o generados para Órbita.
