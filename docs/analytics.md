# Analytics de la web pública — `page_view`

Órbita mide **una sola cosa en la web**: cuántas veces se vio cada pantalla.
Nada más. Este documento dice qué se manda, qué explícitamente no, y cómo
prenderlo o apagarlo.

No reemplaza a los eventos de producto del backend (`convex/telemetry.ts`,
`productEvents`, el digest diario de Telegram). Eso sigue igual y es donde viven
`app_opened`, `onboarding_completed` y `daily_card_revealed`, para web y nativo.
Lo de acá es sólo tráfico de páginas de la web.

## Qué se manda

Un evento, con una propiedad:

```
page_view  { path: "/empezar" }
```

`path` es la ruta ya normalizada: sin query string, sin fragmento, sin barras
duplicadas ni finales, y con cualquier segmento que parezca un identificador
reemplazado por `redactado`.

## Qué NO se manda

Esta es la parte que importa. Órbita maneja fecha y hora de nacimiento, ciudad y
correo: cualquier captura automática de un SDK de navegador puede levantar eso
del DOM o de la URL sin que nadie lo pida.

- **Query string y fragmento.** Se cortan siempre. Ahí viajan el
  `__clerk_ticket` del alta, el `session_id` con el que Stripe vuelve del
  checkout, el email que el login pasa por params y el `#/create` con el que
  Clerk rutea el registro dentro de `/empezar`.
- **Todo el capture automático de PostHog**, apagado uno por uno en el `init` y
  no por confiar en los defaults del vendor: `autocapture` (clicks y texto de
  los elementos), `capture_pageview`, `capture_pageleave`, `capture_heatmaps`,
  `capture_dead_clicks`, `rageclick`, `capture_performance`, encuestas y session
  replay.
- **Perfiles de persona.** `person_profiles: "never"` y nunca se llama a
  `identify`. El evento queda agregado; no se ata a una cuenta de Órbita.
- **Parámetros de campaña** (`utm_*`, `gclid`, `fbclid`), por `property_denylist`.
- **Nativo.** No se manda nada: no hay SDK en el bundle de la app.

Como red de seguridad, `sanitize_properties` le saca query y fragmento a las
propiedades que el SDK arma solo (`$current_url`, `$referrer`, `$pathname` y sus
variantes `$initial_*`) antes de que salgan.

## Cómo se prende

Dos variables públicas del build, documentadas en `.env.example`:

| Variable | Qué es |
| --- | --- |
| `EXPO_PUBLIC_POSTHOG_KEY` | Clave pública del proyecto PostHog (`phc_…`). |
| `EXPO_PUBLIC_POSTHOG_HOST` | Host del proyecto. Vacío = `https://us.i.posthog.com`. |

**Sin `EXPO_PUBLIC_POSTHOG_KEY` el SDK no se inicializa y no sale ningún
evento.** El default es cerrado: un deploy que se olvida de setear la variable
no manda nada a ningún lado, igual que el flag de herramientas internas.

Como todo lo que empieza con `EXPO_PUBLIC_`, la clave queda **embebida en el
bundle y es visible para cualquiera**. Es lo correcto para una clave pública de
ingesta; no poner ahí ningún secreto.

## Dónde está el código

| Archivo | Qué hace |
| --- | --- |
| `src/domain/pageView.ts` | Lógica pura: normalizar la ruta, deduplicar, resolver config, limpiar propiedades. Sin React ni PostHog. |
| `src/services/analytics.web.ts` | Init de PostHog y `capture`. Sólo web. |
| `src/services/analytics.ts` | Variante nativa: no-op. |
| `src/components/PageViewTracker.web.tsx` | Escucha `usePathname` y manda el evento. |
| `src/components/PageViewTracker.tsx` | Variante nativa: no monta nada. |
| `app/_layout.tsx` | Monta el tracker una vez, en la raíz. |
| `test/pageView.test.ts` | Tests de la lógica pura + guardas del cableado. |

La separación web/nativo es la misma extensión de plataforma de Metro que ya usa
`entryBackground.ts` / `entryBackground.web.ts`. Las dos variantes exponen la
misma superficie, así que `tsc` chequea el contrato contra la nativa y avisa si
alguna firma se desalinea.

## Dos decisiones que conviene no deshacer

**El tracker escucha la ruta del router, no eventos del navegador.** La web de
Órbita es una SPA: ir de `/` a `/empezar` no recarga el documento, así que un
pageview atado a `load` contaría una sola visita por sesión.

**El dedup es por ruta normalizada.** El efecto que escucha la ruta se vuelve a
disparar por causas que no son navegación — StrictMode monta dos veces en dev,
un cambio de params re-renderiza. Sin dedup, la misma pantalla se cuenta varias
veces y el número deja de significar algo.

## Si se quiere agregar un evento

No agregar propiedades de texto libre ni nada derivado de datos natales, correo o
ubicación. El criterio es el mismo que el del backend en
`convex/lib/productAnalytics.ts`: identificadores opacos y valores de un conjunto
cerrado. Un evento nuevo se decide, se documenta acá y se testea; no se cuela en
un PR de otra cosa.
