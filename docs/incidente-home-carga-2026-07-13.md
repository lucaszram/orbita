# Incidente Home · carga y caches · 2026-07-13

## Estado

El incidente tiene dos capas distintas:

1. **Backend:** una guía diaria anterior al contrato de Carta del día podía reutilizarse aunque no tuviera `carta`. Corregido y desplegado.
2. **Frontend:** la app trata estados transitorios de autenticación/datos como modo invitado, muestra mocks y después cambia a live. Sigue pendiente y requiere un nuevo build.

**Gate de release del build 7:** el build iOS `0.2.1 (7)` no debe promoverse. Sofía confirmó después de la regeneración válida que la carga termina pero Home sigue rompiéndose. El reemplazo `0.2.1 (8)` incorporó el arreglo de estados del cliente, pasó typecheck, 59/59 tests, export iOS y la verificación visual en simulador (reveal, cambio de tab y cold launch), y fue recibido por App Store Connect el 2026-07-14. La prueba física de reconexión por modo avión quedó postergada por autorización explícita de Lucas; no bloqueó la subida.

### Revalidación 23:22 ART

- El árbol actual sigue sin el arreglo frontend: `HomeScreen` todavía calcula `revealed` únicamente desde `daily.getStrip`, mientras `carta` depende por separado de `daily.getGuide`.
- `CartaDelDia` todavía mueve el flip a frente ante `revealed=true` aunque `carta` sea `undefined`.
- `useLiveApp()` todavía crea un `userReady` local por instancia y convierte también un error de `ensureUser` en `userReady=true`.
- `pnpm typecheck` pasa y el build nativo local compila sin errores, pero eso no cubre esta carrera de datos.
- La verificación visual local no completó el flujo porque el debug instalado abrió sin URL de bundle (`No script URL provided`); esto es independiente del incidente y no invalida la comprobación directa del estado actual del código.

## Evidencia confirmada

- Sofía tenía un `dailyGuides` de `2026-07-13` con `revealedAt`, pero sin `payload.carta` ni `payload.guia`.
- Después del fix, su documento se regeneró con `payloadVersion: orbita-daily-guide-v2`, carta `El Sol`, tres beats, guía, cuatro áreas y lectura larga.
- Todos los campos del payload regenerado tienen los tipos esperados.
- Convex no registra errores en la regeneración: `daily.getGuide` responde correctamente con 7.908 bytes.
- La primera regeneración tardó aproximadamente 25 segundos y se disparó tres veces en paralelo durante reaperturas/reintentos.
- Los logs también muestran múltiples llamadas a `users.getOrCreateCurrentUser`, coherentes con varias instancias independientes de `useLiveApp()`.

## Causa backend corregida

- `daily.getGuide()` ahora exige `payloadVersion` vigente y carta válida.
- Los caches viejos se reemplazan preservando `revealedAt`.
- `daily.revealCard()` no revela un documento obsoleto.
- Hay una prueba automática para el contrato viejo.

## Causa frontend pendiente

`useLiveApp()` se instancia en distintos niveles y mantiene `userReady` local en cada instancia. Durante el handshake o una reconexión:

- `isLive` vuelve temporalmente a `false`;
- las pantallas interpretan `false` como invitado;
- Home, Carta y Tránsitos pueden montar mocks;
- al volver la sesión, desmontan el mock y montan live;
- cada montaje puede reiniciar acciones largas.

En Home, además:

- `chartPayload` empieza siempre en `chartMock`, incluso con una sesión conocida;
- la acción diaria no tiene un estado explícito `loading | ready | error | retrying`;
- no hay deduplicación compartida entre montajes;
- una acción inicial puede tardar más de 25 segundos;
- el componente puede recibir `revealed=true` antes de recibir `carta`.

La última condición explica el marco vacío aun con backend sano: `daily.getStrip` confirma rápidamente que la carta ya fue revelada, mientras `daily.getGuide` todavía no resolvió. `CartaDelDia` pasa a la cara frontal, pero como `daily?.carta` sigue siendo `undefined`, no tiene imagen ni texto para dibujar. Si Home se remonta durante el handshake, el estado local de la acción se pierde y el vacío puede persistir o repetirse.

## Arreglo requerido en frontend

1. Centralizar auth y `ensureUser` en un único provider compartido.
2. Reemplazar `isLive: boolean` por un estado explícito: `booting | guest | live | reconnecting | error`.
3. Mostrar mock solo en `guest` confirmado; `booting` y `reconnecting` muestran carga estable.
4. En Home live, no inicializar la tríada con `chartMock`; esperar `charts.current` o mostrar skeleton.
5. Deduplicar `daily.getGuide` por usuario+fecha fuera del componente de pantalla.
6. Modelar la carga diaria como `loading | ready | error` con timeout y reintento visible.
7. No iniciar ni mostrar el flip si `carta` todavía es `undefined`, aunque `revealedAt` ya exista.
8. Al fallar `ensureUser`, no marcar `userReady=true`; mostrar error recuperable.

## Relevamiento de caches

- `dailyGuides`: 12 documentos; 11 legacy, 8 sin carta. La ruta ya quedó protegida por versión.
- `dailyReadings`: 19 documentos; 14 editorial v3 y 5 stub v1. No hay duplicados actuales, pero dos generadores todavía aceptan cualquier documento existente por fecha.
- `natalInterpretations`: conviven dos versiones de prompt y la query de lectura no filtra explícitamente la vigente.
- `voidPromptSets`: 8 documentos, todos sin versión de payload.

Los tres últimos puntos no causaron este crash, pero deben entrar en una pasada posterior de endurecimiento de caches.

## Criterios de aceptación del nuevo build

- Una sesión existente nunca ve datos demo.
- Una reconexión no desmonta la Home ni reinicia acciones.
- `daily.getGuide` se ejecuta una vez por usuario+fecha.
- Si la guía tarda, la pantalla permanece estable y comunica la carga.
- Si la guía falla, hay error y reintento; nunca mock silencioso ni marco vacío.
- `revealed=true` sin `carta` se trata como carga inconsistente, no como carta revelada.

## Revalidación previa al build 8 · 2026-07-14

- Cambio Home → Tránsitos → Home: aprobado en simulador.
- Reveal del día y cold launch posterior: aprobado; la carta reaparece abierta con imagen y lectura.
- Typecheck, 59/59 pruebas y export iOS: aprobados.
- Pendiente: modo avión on/off en iPhone físico. El dispositivo aparece offline para Xcode; no iniciar EAS hasta completar este gate.
