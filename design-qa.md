# Design QA — PR #57, entrada pública web v2

## Evidencia

- **Verdad visual desktop:** `/var/folders/3y/ds_dx47n3pn8bnq3cpvvpypm0000gn/T/TemporaryItems/NSIRD_screencaptureui_qcUBK5/Screenshot 2026-07-31 at 10.25.36 PM.png` (1916×980 px). Es la dirección de arte aprobada para el fondo panorámico; no es un mock de layout.
- **Verdad visual mobile:** `assets/orbita/optimized/web-entry/entry_bg_mobile.webp` (1170×2532 px), derivado vertical aprobado.
- **Implementación desktop:** `/private/tmp/orbita-landing-1440x900.png` (1440×900 px), viewport CSS 1440×900, densidad 1×.
- **Implementación mobile:** `/private/tmp/orbita-landing-390x844.png` (390×844 px), viewport CSS 390×844, densidad 1×.
- **Entrada mobile:** `/private/tmp/orbita-empezar-390x844.png` (390×844 px), viewport CSS 390×844, densidad 1×.
- **Estado:** landing pública sin sesión; recorrido normal `/` → `/empezar`.

La referencia y la implementación se abrieron juntas en el mismo pase de comparación. La referencia fija la calidad, paleta y arquitectura orbital; la jerarquía, copy y estructura se evaluaron contra el brief aprobado de este PR.

## Comparación full-view

- La implementación conserva el fondo charcoal, las líneas orbitales cobre y el espacio negativo de la referencia, con un scrim suficiente para sostener contraste sin convertir la página en un fondo plano.
- Desktop compone copy a la izquierda y el abanico real a la derecha; mobile apila copy, CTA y mazo dentro del primer viewport.
- La Luna aparece una sola vez, como lectura editorial. El hero y la tira comunican amplitud de mazo sin cargar 78 imágenes simultáneamente.
- No hay desborde horizontal en 320, 390, 768, 900, 1024, 1440 o 1920 px.

## Comparación enfocada

- **Header:** emblema real, un solo acceso `Ya tengo cuenta`, targets legibles y sin colisiones en 390 px.
- **Hero:** H1, bajada, CTA principal y CTA secundario conservan jerarquía y contraste; el abanico usa assets reales y queda completo dentro de 390 y 1440 px.
- **Carta astral como base:** la línea `TU CARTA ASTRAL BASE, INCLUIDA AL EMPEZAR` queda debajo de los CTA, visible en el primer pantallazo sin desplazar el CTA principal. Nombra Sol, Luna y ascendente sin prometer gratis la carta completa de Plus.
- **Entrada `/empezar`:** el recorrido normal muestra inmediatamente `Alineate con el ritmo del universo`; no monta la portada/video nativo. La flecha vuelve a `/`.
- **Mazo:** la fila horizontal tiene 16 cartas representativas, Arcanos Mayores y los cuatro palos, con nombres visibles y semántica de lista.

## Superficies de fidelidad

- **Tipografía:** Newsreader sostiene los títulos editoriales; Inter y Roboto Mono conservan la jerarquía de producto, pesos y tracking. No hay wraps problemáticos en los viewports verificados.
- **Espaciado y ritmo:** hero, lectura, mazo y secciones posteriores mantienen una cadencia deliberada; no hay cortes blancos, superposición ni controles fuera de pantalla.
- **Color y tokens:** fondo `#07080A`, marfil y cobre se mantienen consistentes; botones y links tienen contraste suficiente.
- **Calidad de imagen:** se usan los dos WebP por breakpoint sin estirar; ambos están por debajo de 500 KB. Cartas, dorsos, emblema y La Luna son assets reales del producto.
- **Copy:** coincide con el brief: carta diaria gratis, mazo de 78, lectura de La Luna, Free/Plus sin precios hardcodeados y enlaces legales.

## Findings

No quedan diferencias accionables P0, P1 o P2.

## Historial de comparación

- **Pase 1:** comparación de la referencia orbital con landing desktop 1440×900 y del derivado vertical con landing 390×844. No se detectaron P0/P1/P2; no fue necesaria una iteración visual adicional.

## Interacciones verificadas

- Cuatro CTA `Empezar gratis` apuntan a `/empezar`.
- `/` → `/empezar` entra en AlignScreen.
- `Volver` desde AlignScreen regresa a `/`.
- Logo, anchors, login y enlaces legales están presentes y tienen destinos correctos.
- Un solo `Ya tengo cuenta` y una sola ilustración de La Luna.

## Verificación técnica

- `pnpm typecheck`: passed.
- `pnpm test`: 812/812 passed.
- `pnpm build:web`: passed.
- `pnpm check:web-export`: 36.17 MB; imagen máxima 479.3 KB; JS de app gzip 1.10 MB.
- No se observó overlay de error ni fallo de render en el navegador durante el recorrido.

**final result: passed**
