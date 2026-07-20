# Handoff frontend — eventos de producto v1

Owner frontend: Claude. Territorio: `app/**`, `src/**` y tests. No tocar
`convex/**` ni correr Convex codegen/dev.

## Objetivo

Enviar eventos puntuales y reintentables al nuevo contrato
`telemetry.track(args)`. El backend ya registra por sí solo cuentas creadas,
onboarding completado y reveal de carta.

## Contrato

```ts
type TrackProductEventArgs = {
  eventId: string;
  eventName:
    | "app_opened"
    | "onboarding_started"
    | "onboarding_step_viewed"
    | "natal_chart_viewed"
    | "daily_guide_viewed"
    | "paywall_viewed"
    | "checkout_started";
  installationId: string;
  sessionId?: string;
  occurredAt?: number;
  platform?: "ios" | "android" | "web" | "unknown";
  appVersion?: string;
  buildNumber?: string;
  onboardingStep?: number;
  entryPoint?: string;
};

type TrackProductEventResult = { recorded: boolean };
```

`eventId`, `installationId` y `sessionId` son identificadores opacos de 8–160
caracteres (`A-Z`, `a-z`, números, `.`, `_`, `:`, `-`). `entryPoint` solo admite
slugs técnicos en minúscula, nunca copy o texto ingresado por la persona.

## Identidad e idempotencia

1. Crear una sola vez un UUID aleatorio `installationId` y persistirlo en
   AsyncStorage. No usar IDFA, email, Clerk id ni datos del dispositivo.
2. Crear un `sessionId` nuevo al inicio en frío y cuando la app vuelve a foreground
   después de haber quedado en background.
3. Crear un `eventId` nuevo por hecho. Si falla la red, reintentar exactamente el
   mismo payload/eventId; no fabricar otro id.
4. Enviar `occurredAt: Date.now()` al crear el evento. El backend acepta hasta siete
   días de demora y conserva la fecha real aunque la cola se sincronice después.
5. Mantener una cola local pequeña hasta recibir `{ recorded: true|false }`.
   `false` significa que el backend ya había recibido ese evento y también se puede
   retirar de la cola.
6. Esperar a que Clerk resuelva la sesión antes de enviar la apertura cuando sea
   posible. Así Convex vincula la instalación con la cuenta. Un evento anónimo sigue
   siendo válido y se vinculará en el siguiente evento autenticado.

## Cuándo disparar cada evento

| Evento | Disparo exacto | Dedupe del cliente |
|---|---|---|
| `app_opened` | inicio en frío y transición real background → active | uno por sesión/foreground |
| `onboarding_started` | primera pantalla funcional del flujo visible | uno por ejecución del flujo |
| `onboarding_step_viewed` | un paso distinto queda visible | uno por paso por ejecución; enviar `onboardingStep` |
| `natal_chart_viewed` | contenido real de Carta queda visible | uno por sesión; `entryPoint` opcional |
| `daily_guide_viewed` | contenido real de la guía queda visible | uno por sesión; no al montar loading |
| `paywall_viewed` | paywall real visible | futuro; uno por impresión |
| `checkout_started` | la persona confirma salir hacia compra | futuro; uno por intento |

No enviar desde frontend:

- `account_created` — lo escribe `users.getOrCreateCurrentUser`.
- `onboarding_completed` — lo escribe `onboarding.completeBirthData` solo la primera vez.
- `daily_card_revealed` — lo escribe `daily.revealCard` solo en el primer reveal.

## Reemplazo de la implementación vieja

`InstallPing` y `telemetry.appOpened({ platform })` representan únicamente la
primera instalación y no sirven para actividad diaria. Mantener el endpoint legacy
en backend para builds instalados, pero el cliente nuevo debe usar `telemetry.track`.

## Estados y seguridad

- Best-effort: analytics nunca bloquea navegación, onboarding ni reveal.
- No hacer `console.log` del payload completo en producción.
- No enviar propiedades libres ni agregar datos natales, email, preguntas, notas o
  contenido personalizado a `entryPoint`.
- El bridge de apertura debe vivir debajo del provider de sesión para que pueda
  esperar el estado autenticado sin crear otro listener de Clerk.

## Prueba conjunta en dev

1. Primera apertura → `Abrieron=1`, `Nuevos=1`.
2. Varias aperturas el mismo día → sigue siendo una persona única.
3. Completar onboarding → `Onboarding completado=1`.
4. Reveal y reintento de la mutation → `Carta=1`.
5. Abrir al día siguiente → recurrente y numerador D1.
6. Dos dispositivos de la misma cuenta → una persona si ambos eventos están
   autenticados.
7. Sin Telegram configurado → eventos persisten, digest queda en error reintentable
   y la app funciona normalmente.
