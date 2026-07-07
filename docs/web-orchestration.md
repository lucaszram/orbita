# Órbita Web B0 — Orquestación (índice)

Plan maestro: `~/.claude/plans/fluffy-questing-adleman.md`. Este doc es el índice para trabajar en paralelo.

## Operativo (2 terminales)
- **FRONT (Claude, `../orbita-frontend`, `feature/web`):** todo el frontend + deploy-prep, secuencial. Orden: WS6 → WS1 → WS2 → WS3 → WS4.
- **BACKEND (Codex, `../orbita-backend`, `feature/api`):** `docs/ws-backend.md` en paralelo (merge, verificar 4 fns, sembrar datos, creds AstrologyAPI).
- **Humano:** Clerk publishable key → Claude; crear repo GitHub + proyecto Vercel + env vars.

## Workstreams / MDs
| MD | Qué | Dueño |
|---|---|---|
| `ws-onboarding.md` | Onboarding full-bleed + cards + responsive | FRONT |
| `ws-screens.md` | Mapa de valores + Personalidad + nav | FRONT |
| `ws-integration.md` | Promover refs, auth hook, Clerk key, wiring | FRONT |
| `ws-deploy.md` | GitHub + Vercel (rewrite SPA, build, env) | FRONT (+ humano para cuentas) |
| `ws-backend.md` | Consolidar backend + sembrar datos | Codex |

## Territorio (no colisionar con App Core V4.7)
- **Web B0 (nuestro):** `src/components/web/**`, `src/content/*Mock.ts`+`onboarding*.ts`, `src/services/appRefs.ts`/`publicLabRefs.ts`, rutas web `app/{index,home,carta,transito,diario,empezar,valores,personalidad}.tsx`, `docs/**`, deploy config.
- **App Core (NO tocar):** `app/(tabs)/**`, `app/reading/**`, `src/components/orbita/**`, `src/domain/appData.ts`, `src/services/appCoreRefs.ts`.

## Puntos de encuentro
1. **Deploy demo** a Vercel apenas WS1–WS4 estén verdes (no espera backend; mock-first).
2. **Ir live:** cuando Codex sembró datos + está el Clerk key → activar `?live`/sign-in.

## Verificación global (Vercel-ready)
1. `tsc --noEmit` verde. 2. `expo export --platform web` sin errores. 3. `dist` servido con fallback SPA carga todas las rutas. 4. Demo sin env se ve completa. 5. Con env+sign-in, `?live` trae datos reales. 6. Vercel verde + URL.
