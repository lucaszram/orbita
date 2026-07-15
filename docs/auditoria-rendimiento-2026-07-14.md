# Auditoría de rendimiento · 2026-07-14

## Resultado

La lentitud percibida no viene de una sola regresión. Hay dos capas que se potencian:

1. **Arranque y navegación local pesados:** el export iOS actual pesa 74 MB, con 65,17 MB de assets y un bundle Hermes de 8,72 MB (3.846 módulos).
2. **Pantallas bloqueadas por red:** desde el arreglo del incidente de sesión, la app ya no muestra mocks durante autenticación/reconexión. Eso evita información falsa, pero deja visible la latencia real de Convex, AstrologyAPI y la generación con IA.

No se modificó código de producto durante esta auditoría.

## Evidencia medida

Comando de medición:

`npx expo export --platform ios --output-dir /private/tmp/orbita-performance-audit-map --dump-assetmap`

Resultado:

- Export total: **74 MB**.
- Assets: **147 archivos / 65,17 MB**.
- Bundle Hermes: **8,72 MB**.
- Módulos Metro: **3.846**.
- Imágenes originales Higgsfield dentro de iOS: **31,48 MB**.
- Imágenes originales `assets/orbita/core`: **16,02 MB**.
- Fuentes de Google empaquetadas: **46 archivos / 8,79 MB**.
- Tarot optimizado: **23 archivos / 2,54 MB**.

Las imágenes originales aparecen aunque ya existen derivados JPG optimizados de 90–300 KB. Parte entra por `src/content/webAssets.ts` y las rutas web/backoffice, que conviven en el bundle nativo de Expo Router. Otra parte entra directamente por `src/onboarding/assets.ts`.

## Causas principales

### P0 · Assets web y originales dentro del bundle nativo

- `app/index.tsx` importa `OrbitaLanding` estáticamente aunque iOS nunca renderice esa rama.
- Las rutas `home`, `lab`, `studio`, `backoffice` y `empezar` también quedan en el grafo nativo.
- `src/content/webAssets.ts` requiere siete PNG core de 2–2,7 MB y tres PNG Higgsfield de 5–6 MB.
- `src/onboarding/assets.ts` todavía requiere tres PNG Higgsfield de 4,6–5,7 MB.

Impacto: descarga/actualización más pesada, mayor trabajo de parseo y registro de assets, más memoria y peor cold start.

### P0 · Generación de Home en el camino crítico

En un día sin caché, `daily.getGuide` ejecuta en secuencia:

1. lectura de usuario/carta/caché;
2. AstrologyAPI para tránsitos;
3. Vercel AI Gateway para generar la guía completa;
4. persistencia final.

El incidente del 13 de julio registró aproximadamente **25 segundos** en frío. Home mantiene el contenido principal en loading hasta que termina esa cadena. La deduplicación evita triples llamadas dentro de una misma sesión, pero no elimina la espera del primer acceso del día.

### P0 · El arreglo de sesión reveló la latencia que antes se ocultaba

Antes, `isLive=false` durante el handshake se interpretaba como invitado y las pantallas mostraban mocks instantáneos. Después eran reemplazados por datos reales. El build 8 corrigió esa inconsistencia con estados `booting | live | reconnecting | error`.

La corrección es conceptualmente correcta, pero hoy `booting` y `reconnecting` bloquean Inicio, Tránsitos y Umbral sin una capa de datos persistidos. El resultado visible es una app más lenta aunque ya no mienta con contenido demo.

### P1 · Fuentes cargadas y bloqueadas por pantalla

- `useOrbitaFonts()` se monta en 11 lugares, incluida la Home, `OrbitaScreen` y la barra inferior.
- Cada gate devuelve una vista vacía hasta que las fuentes están listas.
- El export incluye 46 TTF (8,79 MB), aunque el sistema visual usa siete pesos.

Impacto: pantallas en blanco al primer montaje y bundle innecesariamente grande.

### P1 · Tránsitos vuelve a entrar por una action al montar

`TransitosLive` reinicia su estado en `undefined` y llama `transits.getToday` cada vez que se monta. El backend reutiliza el resultado diario cuando ya existe, pero igual hay roundtrip y loader en cada montaje. En frío también llama AstrologyAPI.

### P2 · Bundle único con superficies que no pertenecen a la app nativa

El bundle Hermes de 8,72 MB contiene componentes y dependencias de landing, studio, lab y backoffice. No es la causa de una espera de 25 segundos, pero sí empeora arranque, parseo y memoria.

## Orden recomendado de arreglo

1. **Separar rutas/entrypoints web y native** con archivos por plataforma; sacar `webAssets`, lab, studio y backoffice del grafo iOS.
2. **Reemplazar los seis PNG Higgsfield usados por native** por derivados optimizados y eliminar PNG core cuando ya existe JPG equivalente.
3. **Cargar solo siete archivos de fuente una vez en RootLayout**; usar imports de archivo/subpath y quitar gates por pantalla.
4. **Sacar la generación diaria del request de Home:** precomputar, devolver último payload inmediatamente y revalidar en segundo plano.
5. **Persistir el último Home/Tránsitos válido en el dispositivo** para que cold start y reconexión tengan contenido real, no mocks ni pantalla vacía.
6. **Convertir Tránsitos a query cache-first + action solo en miss**, con store compartido por usuario/fecha.
7. **Agregar métricas de arranque y acciones:** `app_start`, sesión lista, storage hidratado, primera pantalla pintada, `daily.getGuide` y `transits.getToday`.

## Meta de aceptación

- Primer contenido útil local: menos de 1 segundo en teléfono medio.
- Cambio de pestaña ya visitada: sin loader.
- Home con dato anterior disponible: render inmediato; actualización silenciosa.
- Home sin ningún dato: skeleton estable, con generación fuera del camino crítico.
- Export iOS: bajar de 74 MB a menos de 25 MB; assets originales 0 MB.

