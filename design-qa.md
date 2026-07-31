# Design QA — landing hero `quiet eclipse v2`

## Evidence

- Source visual truth: `assets/orbita/generated/landing-hero-v2/selected/orbita_landing_hero_quiet_eclipse_v2.png`
- Runtime asset: `assets/orbita/optimized/web/orbita_landing_hero_quiet_eclipse_v2.webp`
- Desktop implementation: `/private/tmp/orbita-hero-qa-20260731/landing-desktop-1512x805.png`
- Mobile implementation: `/private/tmp/orbita-hero-qa-20260731/landing-mobile-390x844.png`
- Combined comparison: `/private/tmp/orbita-hero-qa-20260731/comparison-board.png`
- Route/state: public `/`, signed out, dark theme, first viewport.

## Normalization

- Source: 1254 × 1254 px, square master.
- Desktop: 1512 × 805 CSS px in the connected Chrome content viewport; screenshot normalized by the browser API to 1512 × 805 px. Browser reported DPR 2.
- Mobile: 390 × 844 CSS px and 390 × 844 screenshot pixels at DPR 1.
- The source is intentionally compared as a square art master against the implementation's responsive `cover` crops. No browser chrome or device frame is included.

## Full-view comparison

The combined board shows the source and both rendered crops in one comparison input. Desktop keeps the lunar body in the upper-right, preserves a dark copy-safe region on the left, and lets the copper orbit line enter the composition without crossing the main copy or controls. Mobile retains the lunar texture and rim light above the title while leaving the title, body, both CTAs, and the three-value row readable and unobstructed.

Focused crops were not needed: the complete hero, logo, navigation CTA, title, paragraph, primary/secondary CTAs, and value row are all large enough to inspect in the full-view evidence. The DOM snapshot separately confirmed the image alt and link names.

## Required fidelity surfaces

- Fonts and typography: unchanged from the existing landing; display and body hierarchy remain legible over the new background with no new wrapping or truncation regression.
- Spacing and layout rhythm: unchanged; the square source supports the existing `cover` behavior at desktop and mobile without overlap, horizontal overflow, or displaced controls.
- Colors and visual tokens: the black/copper palette matches Órbita's existing tokens and the existing overlay keeps foreground contrast stable.
- Image quality and asset fidelity: the new photographic lunar surface is visibly sharper and more detailed than the prior background. The 192,710-byte WebP shows no visible block artifacts, halos, stretching, or transparency issues in either crop.
- Copy and content: unchanged. The Spanish alt is accurate: “Eclipse lunar oscuro con órbitas de cobre para la portada de Órbita.”
- Accessibility and interaction: both `Empezar` and `Ya tengo cuenta` remain visible semantic links with stable destinations; no console errors were recorded on the public landing.

## Findings

No actionable P0, P1, or P2 differences. The responsive crops preserve the selected art direction and improve perceived image quality without changing the landing structure.

## Comparison history

- Pass 1: source master compared with desktop and mobile browser renders. No P0/P1/P2 issue found, so no visual correction loop was required.

## Verification

- `pnpm typecheck`: passed.
- Full suite: 803 passed, 0 failed.
- `pnpm build:web`: passed.
- Export limits: 36.05 MB total; largest runtime image 479.3 KB; app JavaScript 1.09 MB gzip.
- New runtime hero: 192,710 bytes.
- `git diff --check`: passed.

final result: passed
