# Analítica y alertas de Core

## Visitas web

La web captura `page_view` en PostHog. `core-control` consulta los agregados y publica el resumen en el tema **📊 Visitas web** de Telegram.

## Nuevas cuentas

Cuando se crea por primera vez un usuario real de Clerk, el backend agenda un envío a `core-control` con:

- producto: `orbita`;
- email normalizado;
- identificador estable de Clerk como `eventId`;
- fecha de creación.

La creación de la cuenta no espera a Telegram. Los errores se reintentan de forma acotada. Órbita no contiene token, chat id ni cliente de Telegram; sólo usa una credencial individual de ingreso guardada como secreto del backend.

El email se usa exclusivamente para el mensaje solicitado y no se persiste en `core-control`.
