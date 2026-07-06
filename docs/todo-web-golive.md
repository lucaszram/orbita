# Órbita Web — TODO para ir de demo → live

**Estado hoy:** web B0 completa y **deployada** en https://orbita-lac-three.vercel.app (modo demo/mock, todo verificado). Login web con Clerk funciona en vivo. Falta el handshake backend + el wiring de escritura para que muestre **datos reales**.

Leyenda de dueño: 🧑 = vos · 🤖 = Claude (frontend) · 🛰️ = Codex/backend.

---

## 1. Handshake Clerk ↔ Convex (lo imprescindible para "live")

- [ ] 🧑 **Clerk dashboard** (instancia `golden-urchin-96`): crear **JWT Template llamado `convex`**
      (Configure → JWT Templates → New template → Convex → Save). Sin esto Convex no recibe identidad.
- [ ] 🧑/🛰️ **Convex env** (en `../orbita-backend`):
      ```bash
      cd /Users/lucas/Documents/orbita-backend
      npx convex env set CLERK_JWT_ISSUER_DOMAIN https://golden-urchin-96.clerk.accounts.dev
      npx convex dev --once --typecheck disable
      ```
      ⚠️ Tiene que ser la **misma instancia** que el publishable key (`golden-urchin-96`). Si antes lo seteaste con otra app de Clerk (backoffice), pisalo con este valor.
- [ ] 🧑 **Verificar:** entrá a https://orbita-lac-three.vercel.app/login, logueate. Si te redirige a `/home` y NO ves "sesión incompleta", el handshake anda.

## 2. Wiring de escritura del onboarding (frontend)

- [ ] 🤖 En `orbita-onboarding.tsx`: al avanzar, `onboarding.saveDraft` (anónimo con `clientDraftId`); en el paso de cuenta, sign-in Clerk; al terminar: `onboarding.completeBirthData` → `charts.calculateOrCreateNatalChart` → `readings.generateToday`.
- [ ] 🤖 Activar `?live` real: cuando hay sesión Convex autenticada, las pantallas (home/carta/valores/personalidad/transito) consumen las funciones reales en vez del mock.
- [ ] 🤖 Redeploy a Vercel (`vercel deploy --prod`).

> Con 1 + 2 hechos: te logueás → hacés el onboarding → se escribe **tu carta real** → `/home`, `/carta`, etc. muestran datos tuyos. **No hace falta "sembrar" nada a mano.**

## 3. Backend — opcionales (no bloquean el primer live)

- [ ] 🛰️ **AstrologyAPI creds** en Convex (para efemérides reales / `places.resolve`). Hoy la carta usa un stub → anda sin esto.
      ```bash
      npx convex env set ASTROLOGY_API_USER_ID ...   # (nombres exactos en .env.example del backend)
      npx convex env set ASTROLOGY_API_KEY ...
      ```
- [ ] 🛰️ **CLERK_SECRET_KEY** en Convex — SOLO si algún action llama a la Clerk backend API. Para el handshake NO se necesita. La `sk_test_...` va acá, **nunca** en el frontend/Vercel.
- [ ] 🛰️ Consolidar backend: PR/merge de `feature/api` (`9aa6080`) cuando corresponda.

## 4. Deploy / repo — higiene y prolijidad

- [ ] 🧑/🤖 **GitHub `main` está desfasado** (snapshot viejo, antes de los fixes). Los deploys de hoy los hace Claude por CLI (`vercel deploy --prod`, sube el working tree). Para auto-deploy por push: reconciliar `main` con el estado actual (Claude arma el snapshot, vos pusheás — el push necesita tu OK por el guardrail).
- [ ] 🤖 WS6 higiene de repo: untrack de `assets/orbita/higgsfield` pesado (ya está en `.vercelignore`; falta el `git rm --cached` + `.gitignore` en el commit coordinado).
- [ ] 🧑 (opcional) Dominio propio en Vercel (Project → Settings → Domains).

## 5. Pulido web (frontend, follow-ups)

- [ ] 🤖 Estados loading/empty/error consistentes en todas las pantallas.
- [ ] 🤖 Variante mobile/narrow afinada (hoy ya apila, pero se puede pulir).
- [ ] 🤖 Bug de RNW (`Link asChild` + array de estilos) ya arreglado en landing/login — revisar que no reaparezca en pantallas nuevas (usar estilo único o `StyleSheet.flatten`).

---

## Cómo testear el "live" completo (tu checklist final)
1. 🧑 `/login` → sign in (email o Google) → redirige a `/home` sin "sesión incompleta". (valida handshake)
2. 🧑 Hacé el onboarding completo desde `/empezar`. (escribe carta real)
3. 🧑 Abrí `/home?live=1`, `/carta?live=1`, etc. → tienen que mostrar TUS datos, no el mock.

## Referencias
- Handoff backend detallado: `docs/ws-backend.md`
- Mapa pantalla→función: `docs/web-b0-backend-map.md`
- Capa de datos front: `src/services/appRefs.ts`
- URL live: https://orbita-lac-three.vercel.app
