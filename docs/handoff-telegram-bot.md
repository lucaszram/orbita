# Bot de Telegram — resumen diario de producto

## Resultado esperado

Cada día a las 09:00 de Argentina, el bot envía las métricas completas del día
anterior:

```text
📊 Órbita — resumen del 19/07

👥 Abrieron la app: 43
├ Nuevos: 17
└ Recurrentes: 26
🆕 Onboarding completado: 9

🪐 Desbloquearon su carta: 21
├ Nuevos: 12
└ Recurrentes: 9

↩️ Retención D1: 41% (7 de 17)
🔥 Activos de ayer que volvieron: 58% (18 de 31)
```

## Definiciones

- **Abrieron la app:** personas/instalaciones únicas con al menos un `app_opened`
  ese día. Varias sesiones no aumentan este número.
- **Nuevos:** su primera apertura histórica ocurrió ese día.
- **Recurrentes:** ya habían abierto Órbita antes.
- **Onboarding completado:** primera persistencia exitosa de datos natales desde
  `onboarding.completeBirthData`. No es una vista ni un tap del cliente.
- **Carta desbloqueada:** primer reveal confirmado por `daily.revealCard` para esa
  persona y fecha.
- **Retención D1:** personas nuevas del día anterior que volvieron a abrir al día
  siguiente / total de nuevas del día anterior.
- **Activos de ayer que volvieron:** cualquier persona activa el día anterior que
  también abrió el día reportado / total de activos del día anterior.

## Implementación backend

- `productActors`: UUID seudónimo por instalación, vinculado al `userId` interno
  cuando existe sesión.
- `productEvents`: eventos idempotentes por `eventId`; no acepta propiedades libres.
- Eventos encolados conservan `occurredAt` (hasta siete días) para no mover una
  apertura offline al día en que volvió la conexión.
- `telemetry.track`: mutation pública únicamente para eventos originados en UI.
- `account_created`, `onboarding_completed` y `daily_card_revealed`: se escriben en
  las mutations autoritativas correspondientes; el frontend no los duplica.
- `productDigests`: claim por fecha para evitar dos envíos.
- `crons.ts`: agenda el action a las 12:00 UTC (09:00 Argentina).
- `notify.sendTelegram`: devuelve si Telegram aceptó o no el mensaje; una falla no
  afecta la operación del usuario.

## Configuración de Telegram

Variables privadas de Convex, tanto en dev como en producción:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

El token se obtiene con `@BotFather`. El chat id puede ser personal o de un grupo.
Nunca se guardan estos valores en Git.

## Privacidad

No se registra ni se manda a Telegram: email, nombre, fecha/hora/lugar natal,
coordenadas, preguntas o respuestas del Vacío, notas del Diario, payloads, prompts,
outputs personalizados, tokens o texto libre.

## Límite histórico

La medición completa comienza con el build que implemente `telemetry.track`. Los
pings viejos de primera instalación no permiten reconstruir aperturas diarias ni
retención anterior.
