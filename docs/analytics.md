# Analítica y alertas de Core

## Visitas web

La web captura `$pageview` en PostHog, con el diccionario versionado de
`src/analytics/eventContract.ts` (`page_view`, sin `$`, es data vieja: se
conserva para consultar el pasado y no se emite más). `core-control` consulta
los agregados y publica el resumen en el tema **📊 Visitas web** de Telegram.

Esa telemetría es la de PostHog y vive en `src/analytics/`. No tiene nada que
ver con `convex/telemetry.ts`, que son los eventos de producto propios del
backend.

## Nuevas cuentas

El aviso se agenda en `convex/lib/users.ts`, dentro de `getOrCreateUser` y
pegado al único `insert` que crea una cuenta: no cuelga de una mutation en
particular, así que da igual si el alta entra por `users.getOrCreateCurrentUser`
o por cualquiera de las mutations que llegan ahí con `requireUser`.

El trabajo agendado lleva **sólo el `userId`**. `convex/coreControl.ts` recién
ahí lee la cuenta y le manda a `core-control`:

- producto: `orbita`;
- email normalizado;
- identificador estable de Clerk como `eventId`;
- fecha de creación.

Nada más de la persona viaja: ni nombre, ni apellido, ni datos natales, ni el
token de sesión.

### Entrega y reintentos

La creación de la cuenta no espera la entrega: se agenda con `runAfter(0, …)` y
sigue. Si el envío falla —la red se corta, o el endpoint no contesta 2xx— la
action se reagenda a sí misma al minuto, a los cinco, a la media hora y a las
dos horas. Son cinco entregas como máximo y la cadena termina sola.

Una configuración incompleta, un endpoint que no sea `https://` o una cuenta sin
email cortan sin reintentar: ninguno de los tres se arregla esperando.

### Deduplicación

`core-control` deduplica por un hash de `eventId`, así que un reintento después
de un fallo transitorio no produce un aviso nuevo. Por eso `eventId` es el id de
Clerk —estable, escrito una sola vez— y cada intento vuelve a leer el payload de
la base en vez de arrastrarlo por los argumentos del trabajo: entre un intento y
el otro el email puede cambiar, la clave de deduplicación no.

### Privacidad

Del lado de Órbita el email no se persiste en ningún lado nuevo: se lee de la
fila de la cuenta, viaja en el cuerpo del pedido y no queda en los argumentos
del trabajo agendado (que Convex sí persiste) ni en los logs. `coreControl.ts`
no escribe en la base y no loguea, ni siquiera cuando la entrega falla.

Órbita no contiene token, chat id ni cliente de Telegram; sólo usa una
credencial individual de ingreso a `core-control`, guardada como secreto del
backend (`CORE_CONTROL_SIGNUP_SECRET`, nunca `EXPO_PUBLIC_*`).

`core-control` se compromete, de su lado, a usar el email únicamente para el
mensaje y a no persistirlo. Eso vive en su repo, no acá.
