# PR 4 — Design QA

## Scope

Responsive composition of the authenticated Órbita app. The canonical native/web screens and data flows remain shared; this pass changes only presentation, shell and navigation.

## Sources

- Figma file `BEB5v6SbgJn2Nipm8Qa0wE`
  - Home desktop `225:10` — `/private/tmp/claude-501/-Users-lucas-Documents-horoscopo--worktrees-orbita-web-p0/72ba7100-aed5-4da8-af2d-21d9e1df39ef/scratchpad/figma-home.png`
  - Tránsitos desktop `271:70` — `/private/tmp/claude-501/-Users-lucas-Documents-horoscopo--worktrees-orbita-web-p0/72ba7100-aed5-4da8-af2d-21d9e1df39ef/scratchpad/figma-transit.png`
  - Carta desktop `252:2` — `/private/tmp/claude-501/-Users-lucas-Documents-horoscopo--worktrees-orbita-web-p0/72ba7100-aed5-4da8-af2d-21d9e1df39ef/scratchpad/figma-carta.png`
  - Valores desktop `260:2` — `/private/tmp/claude-501/-Users-lucas-Documents-horoscopo--worktrees-orbita-web-p0/72ba7100-aed5-4da8-af2d-21d9e1df39ef/scratchpad/figma-valores.png`
- Reported baselines:
  - Home desktop — `/var/folders/3y/ds_dx47n3pn8bnq3cpvvpypm0000gn/T/TemporaryItems/NSIRD_screencaptureui_uNB2vg/Screenshot 2026-07-30 at 1.03.14 PM.png`
  - Tránsitos mobile — `/var/folders/3y/ds_dx47n3pn8bnq3cpvvpypm0000gn/T/TemporaryItems/NSIRD_screencaptureui_9ZernK/Screenshot 2026-07-30 at 1.03.55 PM.png`
  - Follow-up Home desktop (generic header mark and route retained mid-scroll) — `/var/folders/3y/ds_dx47n3pn8bnq3cpvvpypm0000gn/T/TemporaryItems/NSIRD_screencaptureui_nNryzP/Screenshot 2026-07-30 at 2.33.24 PM.png`
  - Follow-up Perfil desktop (hard-edged hero slab) — `/var/folders/3y/ds_dx47n3pn8bnq3cpvvpypm0000gn/T/TemporaryItems/NSIRD_screencaptureui_LPd2mS/Screenshot 2026-07-30 at 2.33.34 PM.png`
  - Follow-up Perfil desktop, wider view — `/var/folders/3y/ds_dx47n3pn8bnq3cpvvpypm0000gn/T/TemporaryItems/NSIRD_screencaptureui_ubmjNc/Screenshot 2026-07-30 at 2.33.41 PM.png`

## Implementation evidence

Chrome, authenticated as Lucas. Screenshots are browser viewport captures at device-pixel ratio 2.

| Screen | 400×774 | 1440×900 |
| --- | --- | --- |
| Home | `/private/tmp/orbita-pr4-qa/home-400x774.png` | `/private/tmp/orbita-pr4-qa/home-1440x900.png` |
| Tránsitos | `/private/tmp/orbita-pr4-qa/transito-400x774.png` | `/private/tmp/orbita-pr4-qa/transito-1440x900.png` |
| Carta | `/private/tmp/orbita-pr4-qa/carta-400x774.png` | `/private/tmp/orbita-pr4-qa/carta-1440x900.png` |
| Valores | `/private/tmp/orbita-pr4-qa/valores-400x774.png` | `/private/tmp/orbita-pr4-qa/valores-1440x900.png` |
| Diario | `/private/tmp/orbita-pr4-qa/diario-400x774.png` | `/private/tmp/orbita-pr4-qa/diario-1440x900.png` |
| Perfil | `/private/tmp/orbita-pr4-qa/perfil-400x774.png` | `/private/tmp/orbita-pr4-qa/perfil-1440x900.png` |
| Umbral | `/private/tmp/orbita-pr4-qa/umbral-400x774.png` | `/private/tmp/orbita-pr4-qa/umbral-1440x900.png` |

The authenticated account has incomplete remote birth-place data, so Carta and Valores correctly show their canonical empty states. No mock data was introduced to force success states.

Follow-up evidence, captured in the same authenticated Chrome session:

- Home desktop after header/scroll correction — `/private/tmp/orbita-pr4-review/home-desktop-after.jpg`
- Perfil desktop after removing the desktop-only hero slab — `/private/tmp/orbita-pr4-review/profile-desktop-after.jpg`
- Perfil mobile at 400×774, proving the hero and bottom navigation remain intact — `/private/tmp/orbita-pr4-review/profile-mobile-400x774-after.jpg`

## Focused checks

- Home at 320, 390, 768, 900, 1024 and 1920 px: `scrollWidth === innerWidth`; the centralized breakpoint switches to desktop exactly at 900 px.
- Tránsitos at 320 px: the real asset is 320×230 at y=52; the main title ends at y=366, inside the 774 px first viewport.
- Tránsitos at 900 px: the asset is 852×360 and the reading moves below it without overflow.
- Document, shell and reserved navigation space resolve to `rgb(7, 8, 10)`.
- Desktop navigation is dark, legible and aligned to the wide canvas; the duplicate internal header is absent.
- Mobile bottom navigation uses content padding instead of a white spacer and does not cover the last content.
- Keyboard focus and 44 px target assertions pass in `test/accessibilityWeb.test.ts`.
- The final Home correction guarantees “También hoy” mounts once: in the desktop reading column only after reveal, otherwise at the end of the scroll.
- The desktop brand now uses the same `assets/icon.png` declared by `app.json`, plus the Órbita wordmark; the generic Lucide orbit glyph is gone.
- The desktop header is a conventional two-ended composition: brand left, primary navigation right, with no empty balancing cell and no duplicate account shortcut.
- Perfil no longer renders its 720 px hero slab on desktop. Mobile web and native still render the same 240 px hero; complete birth data remains visible in desktop content.
- Desktop route changes reset both the document and internal React Native Web scrollers. A live check scrolled Home to “Lectura larga”, opened Perfil, returned to Home, and confirmed the destination began at the calendar strip.

## Comparison and iteration

The implementation keeps the reference direction—dark cosmic field, copper accents, editorial serif/mono hierarchy, asset-led scenes and deliberate desktop columns—while retaining the canonical production data and copy. The initial fixed 720 px desktop canvas, transparent desktop navigation, missing Tránsitos asset, oversized mobile hero and white bottom cut were corrected. A final review found and removed a duplicated mobile “También hoy” section; the regression is covered structurally.

The follow-up comparison put the reported Home and Perfil screenshots beside the new Chrome captures in one review input. The visible regressions were resolved: the real app icon replaces the generic mark; primary navigation is right-aligned; Perfil begins directly with its editorial content instead of a cropped rectangular image; and returning through the desktop navigation no longer restores a stale mid-page offset. At 400×774, Perfil still has its full-width hero and safe bottom navigation, so the desktop fix does not regress mobile/native composition.

## Verification

- `pnpm typecheck` — pass
- `pnpm test` — 703/703
- `npx expo export --platform web --output-dir /private/tmp/orbita-pr4-export-review-2` — pass, 5.3 MB web bundle; the real app icon is included in the export
- `git diff --check` — pass

final result: passed
