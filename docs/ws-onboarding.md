# WS1 · Onboarding inmersivo (full-bleed + cards)

**Dueño:** FRONT. **Archivos:** `src/components/web/orbita-onboarding.tsx`, `src/content/onboardingSteps.ts`, `app/empezar.tsx`.

## Problema
Hoy la imagen inmersiva vive solo dentro del frame de 430px y el resto del desktop es negro puro; el scrim es 0.62→0.82→**0.96** (aplasta la imagen). Impresentable.

## Fix (frame mobile + fondo full-bleed)
- **Fondo full-viewport:** el `ImageBackground` del paso pasa a `styles.stage` (cover, `absoluteFill`) con scrim global suave (~0.45–0.6) + viñeta. Se elimina el negro alrededor.
- **Frame mobile glass encima:** ~430px desktop / full-width mobile, translúcido, borde cobre + glow, deja ver el fondo alrededor.
- **Scrim interno del frame** bajado (0.96 → ~0.5) para que la imagen respire.
- **Responsive:** mobile = frame full width; desktop = fondo full + columna centrada.
- **Cards intactas:** opciones identidad, tiles de beneficio con imagen, planes, antes/después, tríada, inputs-en-card; chips con íconos lucide.
- **Sol real** ya sale de la fecha (`getZodiacSign`); Luna/Asc honestos.
- Pulir validación/deshabilitado/foco + microtransiciones (opacity).
- **Prep escritura (flag, sin hard-dep de auth):** `onboarding.saveDraft` anónimo por paso; secuencia real documentada para WS3.

## Verificación
`tsc` limpio; dev bundlea; screenshot mobile + desktop (fondo lleno, cards legibles).
