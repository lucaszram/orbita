# Handoff frontend — secuencia de alta y cuenta (onboarding inmersivo primero)

Fecha: 2026-07-29 · **corregido 2026-07-31**
Decisión de producto: Lucas
Owner de implementación: Claude (frontend)

> **Corrección del 2026-07-31.** La versión original de este documento describía
> un flujo **auth-first**: crear cuenta ANTES del onboarding, con el alta como
> ruta propia (`/crear-cuenta`) y `AccountScreen` fuera del flujo. Esa dirección
> quedó sin efecto. El producto vigente es el inverso: **el onboarding inmersivo
> va primero** y la cuenta se crea en su paso canónico de la secuencia V4.4
> (`14 / Create Account`, índice 13). Lo que sigue describe la conducta real
> implementada. La invariante de escritura y el follow-up de backend siguen
> valiendo tal cual.

## Ficha

**Objetivo:** una sola secuencia de alta en web, iOS y Android. La experiencia
inmersiva engancha primero; los datos de nacimiento se juntan en el borrador
local; la cuenta se pide recién cuando ya hay una carta que guardar; y el estado
remoto de esa cuenta decide entre seguir el alta y entrar a la Home de la app.
La landing pública nunca reemplaza a la Home autenticada y el onboarding nunca
puede sobrescribir datos natales de una cuenta completa.

**Criterios de aceptación:** ver la matriz de rutas y los escenarios de este
documento. En particular: el onboarding se monta SIN sesión y nada sale del
dispositivo antes de que haya una cuenta confirmada; una cuenta completa que
abre el onboarding vuelve a la Home sin ejecutar escrituras; una cuenta con
sesión y sin `birthData` continúa desde los datos de nacimiento.

**Owner:** Claude.

**Territorio permitido:** `app/**`, `src/**`, `test/**` y este handoff. No tocar
`convex/**`, no correr Convex codegen/dev y no desplegar.

**Cambio de contrato:** no. Convex ya expone la sesión Clerk y
`birthData.getCurrent`; alcanza para decidir el destino.

**Riesgo:** alto. Toca auth, arranque, onboarding, navegación y persistencia.

**Plan de pruebas:** tests puros del resolver de destino, tests de los guards,
typecheck, suite completa, export web y pasada manual en navegador + iOS.

**Rollout:** PR frontend aislado → Convex dev/Clerk test → cuentas descartables en
los estados `sin sesión`, `cuenta nueva`, `cuenta incompleta` y `cuenta completa` →
TestFlight/staging → aprobación de Lucas. No producción directa.

**Rollback:** revertir el PR frontend. No hay migración ni cambio de datos backend.

**Fuera de alcance:** rediseño visual de auth, paywall, Stripe/RevenueCat, cambios
de schema, deploy, App Store y endurecimiento backend de `completeBirthData` (queda
como follow-up separado).

## Decisión de producto vigente

Hay dos superficies distintas:

- **Landing pública:** marketing web para una persona sin sesión.
- **Home de la app:** experiencia personalizada de Órbita. En web es `/home`; en
  nativo es `/(tabs)`.

La landing no es una Home invitada. Órbita no tiene modo invitado público.

**El alta sí empieza sin cuenta.** Los pasos inmersivos y los datos de nacimiento
viven en el borrador local (`sessionStorage` en web, memoria en nativo) hasta el
paso de cuenta. Eso es deliberado: es lo que permite que la experiencia enganche
antes de pedir nada.

La autoridad para saber si una cuenta completó el alta sigue siendo la existencia
de `birthData` remoto para la identidad Clerk activa. Un perfil local no autoriza
entrar a Home cuando el backend está configurado.

## Flujo canónico

```text
Landing / arranque
        |
        v
Onboarding inmersivo (pasos 0-12)   ← sin sesión, todo en el borrador local
        |
        v
Paso 13 · Crear cuenta              ← Google (sólo web, con flag) o email + código
        |
        v
Clerk autenticado + fila users asegurada
        |
        v
Paso 14 · Cierre → UNA persistencia esperada → Recepción
```

Y para quien ya tiene cuenta:

```text
Entrar (/iniciar-sesion)
        |
        v
birthData.getCurrent
   |                 |
   | null            | existe
   v                 v
Onboarding       Home de la app
desde los datos
```

Después de autenticarse:

- cuenta con `birthData` → `HOME_ROUTE`;
- cuenta sin `birthData` → `ONBOARDING_ROUTE`, continuando **desde la fecha de
  nacimiento** (paso 4), no desde el splash;
- error o estado todavía no resuelto → carga/reintento, nunca fallback local ni
  landing.

## Matriz de rutas

| Estado | `/` web | Login/alta | `/empezar` o `/onboarding` | `/home` o `/(tabs)` |
|---|---|---|---|---|
| Clerk cargando | carga | carga | carga | carga |
| Sin sesión | landing pública | permitir | **permitir** (el alta empieza sin cuenta) | redirigir a login |
| Con sesión, `birthData` sin resolver | carga | carga | carga (sin desmontar el alta ya montada) | carga |
| Con sesión, sin `birthData` | onboarding | onboarding | permitir, desde los datos | redirigir a onboarding |
| Con sesión, con `birthData` | Home de la app | Home de la app | Home de la app | permitir |
| Error recuperando cuenta | reintento | reintento | reintento | reintento |

En web, un usuario autenticado nunca debe ver la landing ni el link “Inicio” de la
barra pública. Debe entrar a `/home`, que monta la Home canónica dentro del shell de
la app.

**Nota sobre el gate:** `AccountGate` monta el alta con `sticky`. Al crear la
cuenta en el paso 13, la fila `users` pasa a `pending` y `birthData` vuelve a
`undefined` por un instante, así que el resolver dice `loading`. Sin `sticky` el
gate desmontaba el flujo entero justo ahí — en web el borrador lo disimulaba, en
nativo se perdía todo lo cargado. `sticky` sólo sostiene el estado `loading`: un
destino resuelto distinto sigue redirigiendo.

## Estructura y copy

### Landing pública

- `Empezar` → `/empezar` (el onboarding completo).
- `Ya tengo cuenta` → `/iniciar-sesion`.

### Paso 13 — Crear cuenta, dentro del alta

Es `src/onboarding/screens/AccountScreen.tsx`, montada por `OnboardingFlow` en el
índice 13. Copy vigente:

- Título: `Guardá tu carta.`
- Camino corto (sólo web, sólo con `EXPO_PUBLIC_ORBITA_GOOGLE_AUTH=true`):
  `Continuar con Google`, arriba del divisor `o continuar con email`.
- Campos: `Email`, `Contraseña`, `Repetir contraseña`.
- CTA: `Guardar mi carta`.
- Código por email con auto-verificación; `Usar otro email` para volver.

Google es **web-only** por dos razones acumulativas: en iOS/Android el SSO abre un
navegador externo y vuelve por deep link (exige credenciales propias), y la
guideline 4.8 de Apple obliga a Sign in with Apple si hay Google. El botón no
existe en nativo. Un deploy que se olvide la variable queda **cerrado, no roto**:
el alta por email sigue entera.

El formulario suelto `/crear-cuenta` (`SignUpGateScreen`) sigue existiendo como
ruta directa, pero **ninguna superficie manda ahí**.

### Login

Mantener `Bienvenido de nuevo.` y el flujo existente. Después de verificar, no
decidir por perfil local:

- remoto con `birthData` → Home de la app;
- remoto sin `birthData` → onboarding, desde los datos.

`home-local` está eliminado como destino en builds con backend configurado. Un
snapshot local puede restaurar diario/guardadas después de identificar al dueño,
pero nunca reemplazar la prueba remota de onboarding completo.

`Crear una cuenta` desde el login abre el onboarding completo y le pasa el email
ya tipeado por params, para no pedirlo dos veces.

### Onboarding

Al entrar a la ruta, resolver antes de montar el flujo:

- sin sesión → **montar el flujo** (el alta empieza acá);
- sesión + `birthData` → Home de la app;
- sesión sin `birthData` → montar el flujo, desde los datos de nacimiento.

Cuando el onboarding completa y crea `birthData`, el propio flujo conserva el
control hasta navegar a Recepción; el guard no debe interrumpir esa transición por
la actualización reactiva.

No existe “¿Querés sobrescribir?” dentro del onboarding. Una persona con datos
existentes usa `Perfil → Editar datos`, que expresa esa intención de forma explícita.

## Cambio técnico

Un único resolver puro, compartido por arranque, login, alta, onboarding y
guards de Home:

```ts
type AccountDestination =
  | "loading"
  | "sign-in"
  | "bootstrap"
  | "onboarding"
  | "app-home"
  | "retry";
```

Inputs mínimos:

- backend configurado;
- Clerk cargado;
- sesión activa;
- `birthData` resuelto;
- existencia de `birthData`;
- error de recuperación.

`destinationAllows(destination, surface)` traduce eso a "esta superficie puede
renderizarse". La superficie `onboarding` acepta **también** `sign-in` —que acá
significa "todavía no hay sesión"—, porque el alta empieza sin cuenta. Lo que no
cambia es la protección que motivó todo: una cuenta completa resuelve `app-home`,
no entra al alta, y por lo tanto no puede sobrescribir sus datos natales.

No duplicar decisiones distintas en `app/index.tsx`,
`app/iniciar-sesion.tsx`, `RequireSession`, `app/empezar.tsx` y el layout de tabs.

Archivos de referencia:

- `app/index.tsx`
- `app/iniciar-sesion.tsx`
- `app/empezar.tsx`
- `app/home.tsx`
- `app/(tabs)/_layout.tsx`
- `src/domain/accountDestination.ts`
- `src/domain/appRoutes.ts`
- `src/components/orbita/AccountGate.tsx`
- `src/components/web/orbita-landing.tsx`
- `src/components/web/require-session.tsx`
- `src/onboarding/OnboardingGate.tsx`
- `src/onboarding/OnboardingFlow.tsx`
- `src/onboarding/screens/AccountScreen.tsx`
- `src/onboarding/useAccount.ts`

## Invariante de escritura

Hoy el paso final tiene dos caminos de persistencia:

1. un efecto al montar el paso 14;
2. `submit()` vuelve a llamar `persistBackend`.

Eliminar la escritura por montaje. Completar el onboarding debe hacer una sola
persistencia explícita, esperada y estricta antes de navegar. Nunca persistir
defaults, un borrador incompleto ni un salto `debugStep`.

Requisitos:

- `debugStep` puede ayudar a renderizar, pero no habilita efectos de escritura;
- validar que fecha, precisión horaria, lugar, coordenadas y timezone estén listos;
- **nada sale del dispositivo sin una cuenta confirmada**: sin usuario Clerk
  activo el cierre vuelve al paso 13 con el borrador intacto, no escribe "por si
  acaso" ni pierde lo cargado;
- una sola llamada a `completeBirthData`;
- una sola creación/selección de carta para esos datos;
- error visible y reintento; no entrar a Home fingiendo éxito.

## Escenarios obligatorios

1. Web sin sesión: `/` muestra landing; `Empezar` abre el onboarding completo.
2. Nativo sin sesión: el arranque abre el onboarding, con `Ya tengo cuenta` en la
   entrada.
3. Abrir `/empezar` o `/onboarding` sin sesión **monta el alta**, no redirige.
4. Recorrer los pasos 0-12 sin cuenta no escribe nada remoto.
5. Crear la cuenta en el paso 13 (Google en web, o email + código) no desmonta el
   flujo ni pierde lo cargado, en web y en nativo.
6. Login de cuenta sin `birthData` lleva al onboarding, desde la fecha.
7. Login de cuenta con `birthData` lleva a la Home de la app.
8. Usuario web logueado que abre `/` termina en `/home`, nunca en la landing.
9. Usuario completo que abre directamente el onboarding termina en Home sin mutations.
10. Usuario incompleto que abre Home termina en onboarding.
11. Perfil local existente + cuenta remota sin `birthData` termina en onboarding,
    no en `home-local`.
12. Cuenta A local y login de cuenta B no mezclan perfil, diario ni guardadas.
13. Completar el onboarding persiste exactamente una vez y termina en Recepción.
14. Llegar al cierre sin cuenta activa vuelve al paso 13 con el borrador intacto.
15. `debugStep=14` con una cuenta completa no monta el flujo ni escribe.
16. `debugStep=14` con una cuenta incompleta puede renderizar en herramientas
    internas, pero no persiste automáticamente ni crea cuenta.
17. `/preview-alta` sólo existe con herramientas internas y es de sólo lectura.
18. Refresh y deep links mantienen la misma decisión en web, iOS y Android.

## Follow-up backend separado

Una vez que `Editar datos` use explícitamente `birthData.upsertForCurrentUser`
con `source: "profile"`, endurecer `onboarding.completeBirthData`:

- creación idempotente para una cuenta sin datos;
- si ya existen datos distintos, rechazar el overwrite desde onboarding;
- permitir cambios sólo por la mutación explícita de Perfil.

Eso convierte el gate frontend en experiencia correcta y el backend en última
línea de defensa. Debe ir en otro objetivo/PR porque cambia semántica backend y
requiere compatibilidad con builds instalados.
