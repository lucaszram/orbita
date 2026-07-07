# WS4 · Deploy GitHub + Vercel

**Dueño:** FRONT (+ humano para cuentas). **Archivos:** `vercel.json` (nuevo), `package.json` (script), `app.json` (sección `web`), `.gitignore`.

## Contexto
- `app.json` no tiene `web.output` → default **`single` (SPA)** → Vercel necesita rewrite catch-all a `index.html`.
- Sin remoto git; ~20 archivos web sin commitear. El árbol incluye WIP de App Core (otra sesión).
- Env vars build-time (inlined): `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.

## Tareas
1. **`vercel.json`:** `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`.
2. **Build:** command `npx expo export --platform web`, output dir `dist`, install `pnpm install`. (Opcional: script `"build:web"` en package.json.)
3. **Git:** el humano crea repo GitHub → `git remote add origin ...` → commitear archivos web (coordinar: commit conjunto con WIP de App Core, o branch `deploy` con solo Web B0) → push.
4. **Vercel:** conectar repo, setear env vars (`EXPO_PUBLIC_CONVEX_URL=https://dutiful-viper-815.convex.cloud`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=<key>`), root = `../orbita-frontend` si aplica.
5. **Verificar local** antes: `expo export --platform web` verde + servir `dist` con fallback SPA → rutas cargan.

## Verificación
Export local sin errores; URL Vercel sirve `/`, `/home`, `/carta`, `/empezar`, `/valores`, `/personalidad`, `/transito` (deep links vía rewrite). Demo mock-first funciona sin auth.
