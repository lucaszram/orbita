# Backend — Carta natal real en el reveal (handoff a Codex)

**Objetivo:** que el onboarding devuelva **Luna y Ascendente reales** (no "pendiente" / "modo maqueta") de forma confiable, sin quemar la cuota de AstrologyAPI.

**Estado (2026-07-07):** el frontend ya está OK y verificado. El bloqueo es 100% backend + deploy. Este doc es la lista de lo que falta del lado de `convex/`.

---

## 1. Qué hace el frontend (ya funciona, no tocar)

En el reveal, `OrbitaOnboarding` calcula la tríada llamando al endpoint público:

```
publicLab.previewDailyHome({
  birthDate,            // "YYYY-MM-DD"
  birthTime,            // "HH:MM" 24h  (undefined si timeUnknown)
  birthTimePrecision,   // "known" | "unknown"
  birthPlaceLabel,      // texto
  latitude, longitude,  // number — SIEMPRE presentes (el front geocodifica si hace falta)
  timezone,             // IANA
  localDate             // "YYYY-MM-DD"
})
```

Lee `res.natalBase.{sun, moon, ascendant}`. Si `moon`/`ascendant` vienen `"pendiente"` o `null`, el front ya muestra un **cartel honesto de error con "Reintentar"** (no placeholders). El objetivo es que ese cartel **no aparezca** cuando la carta se puede calcular.

### Evidencia de que el front manda bien los datos
Línea de debug real del reveal (Sofía, 17/07/2002, Lomas de Zamora, 13:42):

```
OK sun=Cáncer moon=null asc=null | lat=-34.7572582 lon=-58.4026638 time=13:42
```

→ coords + hora llegan perfectas. El `moon=null asc=null` es **el backend** devolviendo modo maqueta.

---

## 2. La causa raíz (dónde está)

En `convex/publicLab.ts` el flag que decide real-vs-maqueta es:

```ts
const hasProviderChart = provider.status === "success"; // ~línea 271
```

Cuando `runAstrologyApiProvider` **no** devuelve `status:"success"`, todos los puntos (moon, ascendant, casas, aspectos) caen a `"pendiente"` con `"Modo maqueta: faltan Luna, Ascendente..."`.

`runAstrologyApiProvider` deja de ser `"success"` cuando:
- **Rate-limit del plan TRIAL** de AstrologyAPI (hay saldo — $1.45 — pero se throttlea por requests/min). Se dispara fácil al testear.
- **`unawaited fetch`** — Convex avisaba `[WARN] 2 unawaited operations: [fetch]`, lo que corta la corrida antes de que llegue el chart.

### Verificación reproducible
Llamando al endpoint directo (ver script en §5):
- **Con cupo:** `sun=Sol en escorpio · moon=Luna en escorpio · ascendant=Ascendente en acuario · accuracy=calculated` ✅ (coincide con astro.com).
- **Rate-limiteado:** `moon=pendiente · asc=pendiente · accuracy=ready_for_real_calculation` + `limitations: ["Modo maqueta: faltan Luna, Ascendente..."]`.

O sea: **cuando la API responde, el cálculo es correcto.** El problema es la resiliencia ante fallos parciales y la cuota.

---

## 3. Lo que el backend TIENE que garantizar

### 3.1 Carta natal primero, tránsitos opcionales  ✅ (ya hecho por Lucas — falta deploy)
> Fix aplicado en `../orbita-backend/convex/lib/astrologyApi.ts`: si `natal_transits/daily` cae por rate-limit/error, ya **no** tira toda la corrida a maqueta. La carta natal se calcula primero; si salió bien, devuelve `status:"success"` con Luna/Asc reales y `transits: []` + `warning`. Endpoints natales legacy pasados a `Promise.allSettled`. Regresión agregada en `test/convexOrbita.test.ts` (carta OK + tránsitos 429 → sigue devolviendo carta real). `pnpm typecheck` + `pnpm test` verdes (58/58).

**Deploy:** sincronizado a Convex dev `dutiful-viper-815` el 2026-07-07 con `pnpm exec convex dev --once --typecheck disable`.

**Estado live post-sync:** el deployment ya corre el fix, pero el test de Sofía todavía cae a maqueta porque AstrologyAPI respondió `TRIAL_REQUEST_LIMIT_EXCEEDED` en los endpoints natales mismos (`natal_chart_interpretation` y `western_chart_data`). Es distinto del bug original de tránsitos: si la carta natal no responde, no hay Luna/Asc real que preservar. Reintentar cuando resetee el límite TRIAL o con tier pago/API sin throttle diario.

**Re-test post saldo agregado:** se volvió a correr el test live y el proveedor siguió devolviendo `TRIAL_REQUEST_LIMIT_EXCEEDED`. El balance disponible no alcanza por sí solo si el token/cuenta sigue marcado como `TRIAL`; hace falta que AstrologyAPI quite el throttle trial (cambio de plan/tier/token activado) o esperar el reset real del límite.

**Re-test con token nuevo del proyecto:** se actualizó `ASTROLOGY_API_KEY` y `ASTROLOGY_API_LOCATION_KEY` en Convex dev `dutiful-viper-815` sin guardar el token en archivos. El test live de Sofía pasó: `provider.status="success"`, `mode="provider_real"`, `natalBase.accuracy="calculated"`, `sun="Sol en cancer"`, `moon="Luna en escorpio"`, `ascendant="Ascendente en escorpio"`, `limitations=[]`.

### 3.2 Cachear la carta natal por persona  ⬜ (recomendado, evita quemar cuota)
Cada `previewDailyHome` / `calculateOrCreateNatalChart` con los mismos datos de nacimiento **no debe re-pegarle a AstrologyAPI**. Cachear el chart real por hash de birthData (lat/lon/fecha/hora/tz) con TTL largo. Ya existe `ASTROLOGY_API_CHART_CALCULATION_VERSION` + `cacheKey` en `charts.ts` para la versión autenticada; replicar la misma idea para el path público del lab. Beneficio: el reveal + la app comparten el mismo chart calculado una sola vez.

### 3.3 Distinguir "sin hora" de "falló la API"  ⬜
- `birthTimePrecision === "unknown"` → Ascendente legítimamente no calculable → NO es error (el front ya lo trata aparte).
- Con hora + coords y aun así `pendiente` → eso es fallo real de la API; que `natalBase` lo refleje (p. ej. `accuracy` distinto o un `error`/`warning` claro) para que el front muestre "Reintentar" y no un estado ambiguo.

---

## 4. Contrato de `natalBase` (lo que el front espera)

```ts
natalBase: {
  sun: string | null;         // "Sol en escorpio"  (o null)
  moon: string | null;        // "Luna en escorpio" — REAL cuando hay hora+coords y la API respondió
  ascendant: string | null;   // "Ascendente en acuario" — idem
  accuracy: "calculated" | "ready_for_real_calculation" | "pending" | ...;
  limitations?: string[];     // vacío en éxito
}
```

- `parseSign` del front convierte `"pendiente"` → `null`. Devolver strings reales tipo `"Luna en escorpio"`.
- **Éxito de la carta natal = `moon` y `ascendant` reales**, aunque `transits` venga `[]`.

Consumidores de la carta natal (ambos deben devolver real de forma confiable):
1. `publicLab.previewDailyHome` — reveal del onboarding (público, sin auth).
2. `charts.calculateOrCreateNatalChart` + `charts.current` — carta persistida para la app / Horóscopo de personalidad (con auth).

---

## 5. Cómo testear (sin UI)

Script Node desde la raíz del repo (usa `EXPO_PUBLIC_CONVEX_URL` de `.env.local`):

```js
import { ConvexHttpClient } from "convex/browser";
const client = new ConvexHttpClient(process.env.CV_URL);
const res = await client.action("publicLab:previewDailyHome", {
  birthDate: "2002-07-17", birthTime: "13:42", birthTimePrecision: "known",
  birthPlaceLabel: "Lomas de Zamora", latitude: -34.757, longitude: -58.403,
  timezone: "America/Argentina/Buenos_Aires", localDate: "2026-07-07"
});
console.log(res.natalBase);
```

**Esperado (post-fix + deploy + cupo disponible):**
```
{ sun: "Sol en cancer", moon: "Luna en escorpio", ascendant: "Ascendente en escorpio", accuracy: "calculated" }
```
(Sofía debe dar **Cáncer / Luna Escorpio / Asc Escorpio** — verificado contra Astromix.)

> Ojo: cada corrida gasta cuota real de AstrologyAPI. Testear poco; con caché (§3.2), repetir el mismo input no debería pegarle a la API.

---

## 6. Deploy

El fix vive en el worktree backend (`../orbita-backend`, sucio con otros cambios). Ya se sincronizó Convex dev desde ese worktree:

```bash
cd ../orbita-backend
pnpm exec convex dev --once --typecheck disable
```

(Claude no corre `convex dev` / `convex codegen`.) Después, cuando AstrologyAPI vuelva a tener cupo, en el reveal "Reintentar" o rehacer el onboarding → debería salir la tríada real y desaparecer el cartel.

---

## 7. Checklist

- [x] Carta natal primero, transits opcionales (`astrologyApi.ts`) — **hecho, falta deploy**
- [x] **Sync Convex dev** desde `../orbita-backend` (§6)
- [ ] Cachear carta natal por birthData en el path público (§3.2)
- [ ] `natalBase` diferencia "sin hora" vs "falló API" (§3.3)
- [x] Test §5 devuelve Cáncer / Luna Escorpio / Asc Escorpio para Sofía con el token nuevo del proyecto

---

## 8. Del lado del front (ya cerrado, para contexto)

- Geocode fallback: si el usuario tipea la ciudad sin elegir del dropdown, el front geocodifica igual → coords siempre presentes.
- `computedTriad` se resetea al cambiar datos (antes quedaba pegada la tríada de otra persona).
- Cartel de error + "Reintentar" cuando `moon`/`asc` vienen null con hora+coords.
- Marcador debug temporal `b8` (se saca al confirmar la carta real).
