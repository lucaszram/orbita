# Brief — Onboarding V4.4: pendientes (retomar)

> Estado: se aplicó una primera tanda de mejoras (ver "Ya hecho"). Se **frenó acá** por feedback
> del usuario: varias piezas están **desfasadas de posición** y hay pantallas flojas que **no usan
> los assets** disponibles. Este MD lista lo que falta. Mismas reglas/tokens/patrón que
> `docs/brief-home-v45.md` (leer sección 2, 3, 5, 6 de ese archivo).

- **File key:** `BEB5v6SbgJn2Nipm8Qa0wE` · Página `UX V4.4 - Órbita Onboarding Immersive Pass`.
- Ancla: `151:33` = `01 / Logo Splash`. Frames `01–15` = `151:33 … 151:610`.
- MCP solo ve la página activa → abrir V4.4 o pasar link de frame (`Cmd+L`).

## Ya hecho (no repetir)

- CTA lavanda → **cobre** en 02/03/04/13. Titular → **Newsreader Medium** en 02/03/04/12/13.
- Paywall (15): copy prohibido → seguro ("Cómo te acompaña").
- Banda de picker suavizada en 05 (realce cobre) y 09 (bone cálido).
- Emblema focal integrado en 08 (horizonte idx27), 10 (anillos idx15), 11 (carta core-chart-a),
  patrón = fondo tenue + glow radial cobre + elipse-imagen 0.92.
- 13: checks en cobre + símbolos alineados como par.
- 12: barra de "Tránsitos" arranca en 15% (no parece colgado).
- 07: creadas variantes Empty / Loading / No results (fila y=4300). **Revisar/pulir.**

## Pendientes (feedback del usuario) — por prioridad

1. **Posiciones desfasadas (bug de layout).** Varios recuadros quedaron fuera de lugar respecto al
   contenido:
   - **05 Birthdate**: el recuadro/banda de selección de fecha está corrido respecto a la fila
     seleccionada. Alinear la banda exactamente a la fila activa (revisar `date-selected-band`
     `151:144` vs las filas de la rueda).
   - **09 Birth Time**: el recuadro de selección del dial está **totalmente desfasado** respecto a
     los valores `08 30 AM`. Reposicionar la banda (`151:369`) y la columna AM/PM (`151:380`) para
     que enmarquen la fila activa. El bloque **"No sé la hora"** (`151:384`) ocupa un espacio feo:
     rediseñar (mejor jerarquía, menos aire muerto, integrarlo al ritmo de la pantalla).
2. **07 Birthplace — con/sin resultados.** Las 3 ciudades son un **ejemplo**, no opciones reales.
   Dejar claras las dos situaciones: **con resultados** (autocomplete real) y **sin resultados** /
   estado inicial. Ya hay variantes creadas (Empty/Loading/No results) → revisarlas y dejar la
   principal con un solo resultado destacado sin "pre-selección" en negrita.
3. **04 Daily Guidance — floja, sin usar assets.** Se ve pobre y **no usa los assets** de la carpeta.
   Subirle nivel con material real del banco (`assets/orbita/…`): fondo inmersivo fuerte
   (`core/orbita_daily_texture_a` o `home_hero_orbital_a`), y reemplazar el "teléfono dibujado" +
   badges sueltos por una composición orbital integrada (patrón de emblema). Regularizar los 4
   badges (Amor/Cuidado/Decisiones/Energía) en una órbita pareja.
4. **Copy "calcular/calculamos".** Revisar frases borderline con el guardrail "no calculamos tu carta":
   05 ("La usamos para calcular tu carta natal"), 08 ("para precisar tu carta natal"),
   11 ("Con esto calculamos tu Sol, ascendente y casas"). Suavizar a descripción, no claim de cálculo.
   (La CTA "Calcular mi carta" como acción del usuario está OK.)
5. **Otros del diagnóstico** (menor): 01 splash composición (zona muerta abajo); 02 bordes de tiles
   inconsistentes; separar/unificar el indicador de progreso entre pantallas; reconciliar los chips
   de beneficios del paywall (15) al set aprobado y pasarlos de pill-grid a lista con ticks cobre.

## Assets recomendados por pantalla (del catálogo)

- 04 Daily Guidance: `core/orbita_daily_texture_a` (fondo calmo) o `home_hero_orbital_a` (dramático).
- 09 dial: anillos `archive-10/.../chart_orbital_ring_system__idx15`.
- Tránsitos (si se suma pantalla): `archive-10/.../transits_dynamic_orbital_body__idx30` (hero) o
  `core/orbita_transitos_visual_a` (diagramático, deja lugar a labels).

## Verificación

Screenshot por frame; chequear alineación banda↔fila activa, FILL de assets, tokens y copy vs
guardrails (`AGENTS.md`).
