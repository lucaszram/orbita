# Órbita — Estado de lanzamiento (auditoría 2026-07-07)

> Reemplaza la lista vieja `docs/pendientes-orbita.md` (2026-07-06). Cruza tres auditorías
> de código: superficies frontend, backend Convex, y pagos/auth/infra. Cada ítem apunta a
> `archivo:línea`. Leyenda de dueño: **[Lucas]** dashboards/keys/cuentas · **[Código]** falta escribir/cablear.

## Veredicto

La app está **avanzada en producto**: `Carta`, `Inicio`, `Personalidad` y `Valores` leen data real de Convex y `Carta` es la superficie mejor terminada (estados loading/empty/error completos). **Pero no se puede lanzar cobrando todavía**, por dos bloqueantes duros y varias features centrales que muestran mock a todos.

---

## 🔴 Bloqueante #1 — Nada cobra y no hay gate

El backend de pagos está **completo y testeado** (Stripe + RevenueCat + entitlement en `convex/payments/*`, `convex/lib/entitlements.ts`). Lo que falta es el cliente y el gate:

- **[Código] App no cobra.** `react-native-purchases` no está instalado; "Desbloquear Órbita" (`PaywallScreen.tsx:147` → `submit()` en `OnboardingFlow.tsx:163`) solo crea el perfil local y navega a `/(tabs)/carta`. Es un "continuar" disfrazado de paywall.
- **[Código] Web no cobra.** El backend `createCheckoutSession` (`convex/payments/stripeActions.ts:31`) existe pero el onboarding web (`orbita-onboarding.tsx:557+`) nunca lo llama.
- **[Código] No hay gate de entitlement.** No existe ningún `if (isPro)` que bloquee contenido; `subscriptions.getCurrent` solo se usa para el label del plan en Perfil. La paywall se saltea con "Seguir sin cuenta" (`AccountScreen.tsx:81`) → acceso completo gratis y sin cuenta.
- **[Código] Bug de entitlement:** `appData.ts:225` compara `entitlement === "plus"`, pero el backend migró a `orbita_pro`. Un Pro real vería "Plan gratuito".
- **[Lucas]** RevenueCat (dashboard + productos store + keys `EXPO_PUBLIC_REVENUECAT_*`), Stripe (`STRIPE_*` + `WEB_APP_URL` en env de Convex), correr `migrations:renamePlusToOrbitaPro`, apagar `ALLOW_DEV_STUB` en prod.

## 🟢 Motor real AstrologyAPI — YA FUNCIONA (corrección)

- **Las credenciales están puestas en el env server-side de Convex y andan** — confirmado con carta real (Sofía → Cáncer/Escorpio/Escorpio, `provider_real`). La auditoría de código lo marcó como "falta" porque leyó el repo + `.env` locales; la key vive en `convex env set`, fuera del repo. **No es un bloqueante.**
- **[Lucas] Pendiente menor:** confirmar que la key esté también en el deployment de **prod** al promover.
- **[Código] Riesgo del path stub (chico).** `home.generateDaily` y `readings.generateToday` pueden escribir cartas placeholder `orbita-stub-v1` en `natalCharts`. Si corren antes que la action real `charts.calculateOrCreateNatalChart`, `charts.current`/`valuesMap`/`personalityReading` leen la carta stub. Forzar la action real y/o deprecar el path stub.

---

## Estado por superficie (móvil — `app/(tabs)/` y `app/reading/`)

| Superficie | Estado | Qué falta |
|---|---|---|
| **Carta** `(tabs)/carta.tsx` | ✅ REAL | Nada crítico. Patrón a replicar (loading/empty/error completos). Cosmético: la rueda "quedó fea" (pulido visual). |
| **Inicio** `(tabs)/index.tsx` | ✅ REAL* | *Sin sesión usa engine local. InsightRows con subtítulos **fijos** ("Luna creciente…", `index.tsx:70`). Sin skeleton de carga. |
| **Personalidad** `reading/personalidad.tsx` | ✅ REAL | Ref muerta `charts.generatePersonalityReading` (no existe → no-op silencioso). Copy de las 7 secciones es **plantilla fija**, no LLM. |
| **Valores** `reading/valores.tsx` | ✅ REAL | Sin loading/empty (cae a mock en silencio). |
| **Rueda / Carta-tabla** `reading/{rueda,carta}.tsx` | ✅ REAL | Sin loading/empty explícito. |
| **Tránsitos** `(tabs)` + `reading/transitos.tsx` + `reading/transito.tsx` | 🔴 MOCK | Backend `transits.getToday` **existe** (`convex/transits.ts:183`) pero la pantalla nativa nunca lo llama → mismo cielo fijo para todos. Cablearlo es barato y de alto valor. |
| **Vínculo** `(tabs)/vinculo.tsx` | 🔴 MOCK | Siempre "Escorpio + Libra". No hay backend de sinastría ni forma de cargar a la otra persona. |
| **El Vacío** `reading/void.tsx` | 🔴 ROTO | Misma respuesta a cualquier pregunta (`ORACLE` fijo), "escuchando" falso de 2.8s, sin límite de 1/día. `void.ask` no existe. |
| **Luna / Calendario** `reading/{luna,calendario}.tsx` | 🔴 MOCK | Clavado en "JULIO 2026", "hoy" = día 6 (`appData.ts:165`). Sin backend de fase lunar / calendario. |
| **Perfil** `(tabs)/perfil.tsx` | 🟡 PARCIAL | birthLine/email/plan reales. Muestra "Órbita Plus · activo" por **default** sin suscripción (`appData.ts:154`). Sin login para usuarios existentes (solo signOut). |
| **Guardadas** `reading/saved.tsx` | ✅ REAL (local) | AsyncStorage + `readings.save` con sesión. |
| **Plus interno** `reading/plus.tsx` | 🔴 ROTO | "EMPEZAR PLUS" hace `router.back()`, no compra. |

---

## Backend que NO existe (solo contratos TODO en `convex/schema.ts`)

- `void.ask` (El Vacío) · `relationships.synastry` (Vínculo) · `calendar.getMonth` · `sky.getMoonPhase` · `forecast.getLongRange` · `charts.solarReturn` · `content.sunSignDaily`.
- `charts.generatePersonalityReading` (LLM natal): el plan `buildNatalInterpretationGatewayPlan` está listo (`aiGateway.ts:100`) pero **sin action que lo ejecute**.
- **Guía diaria / LLM diario en app**: existe `generateDailyHomeWithGateway` (`aiGateway.ts:347`) pero solo cableado en `/lab`, no en la app. Home usa el motor stub.
- **`contentModules` vacía**: query real (`contentModules.ts:18`) pero solo `upsertForDev` manual; sin seed ni pipeline. Además valida entitlement legacy `free|plus`.

---

## Onboarding — pendientes

- **[Código] OAuth Apple/Google = mock.** `AccountScreen.tsx:88` — "Continuar con Apple/Google" hace `onPress={onNext}` (avanza sin autenticar) y solo aparece sin-backend. Decidir: implementar OAuth real (necesita dev build) u ocultarlo.
- **[Código] Paywall no cobra** (ver Bloqueante #1).
- **[Código] Geocoding**: `places.resolve` existe (`convex/places.ts`) pero `appRefs.ts:341` sigue marcado `// TODO pendiente backend`; verificar wiring de `BirthplaceSearchScreen`.
- **[Código/Diseño] Cosméticos V4.4** (`docs/brief-onboarding-v44-pendientes.md`): desfases de layout en Birthdate (05) y BirthTime (09), pantalla Daily Guidance (04) floja sin assets, resultados de lugar reales (07), copy borderline "calcular tu carta".

---

## Infra / distribución / calidad

- **[Código] Analytics: 0%.** Mixpanel no está instalado ni disparando eventos. Sin instrumentación no hay forma de medir el lanzamiento.
- **[Lucas/Código] EAS**: solo perfiles `preview` y `production`; falta `development` (dev-client). Cablear RevenueCat exige **nueva build nativa** (EAS Update no alcanza).
- **[Lucas] Stores**: `submit.production` vacío → App Store Connect / Play Console, certificados, productos IAP sin configurar.
- **[Lucas] Web Vercel**: live por CLI (`orbita-lac-three.vercel.app`); auto-deploy por push roto (`main` orphan divergente). Consolidar `main` + dominio propio.
- **[Lucas] Clerk**: key `pk_test` seteada; `CLERK_JWT_ISSUER_DOMAIN` **vacío** (sin el handshake JWT template `convex`, Convex no recibe identidad → todo cae a demo). Migrar a keys prod.
- **[Código] typecheck no verde**: errores conocidos en `app/onboarding.tsx` (cambio de API Clerk). Sin CI. Tests cubren engine + entitlement, no el wiring de pagos cliente (no existe).

---

## Camino recomendado a lanzamiento

**Decisión de alcance primero.** Hay features enteras sin backend (Vínculo, El Vacío, Calendario/Luna). Dos opciones:

- **MVP "carta real" (recomendado):** lanzar con lo que ya es verdadero — Carta + Inicio + Personalidad + Valores + Tránsitos (cableado) — con paywall que cobra. **Ocultar o marcar "próximamente"** Vínculo, El Vacío y Calendario hasta tener backend. Menos features, todo real.
- **Full:** construir synastry + void + calendar + LLM antes de lanzar. Bastante más largo.

**Secuencia sugerida (MVP):**
1. **Cobrar de verdad** — cablear RevenueCat (app) + Stripe checkout (web) + gate `isPro` + creds AstrologyAPI + correr migración `orbita_pro`. *(desbloquea el modelo de negocio)*
2. **Tránsitos reales** — cablear la pantalla a `transits.getToday` (backend ya existe; barato, gran valor).
3. **Ocultar lo mock** — Vínculo / El Vacío / Calendario a "próximamente" (o cablear si se elige Full).
4. **Bugs visibles** — Perfil "Plus activo" por default, Luna/Calendario con fecha fija, InsightRows fijos del Home, ref muerta de personalidad, estados loading/empty en reading screens.
5. **Analytics mínimo** — Mixpanel con eventos clave (onboarding, paywall, compra) para medir.
6. **Onboarding fino** — cosméticos V4.4 + decisión OAuth.
7. **Build + distribución** — perfil `development`, nueva build nativa con RevenueCat, TestFlight, consolidar web.
