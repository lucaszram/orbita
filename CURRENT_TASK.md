# Current Task

## Onboarding auth-first (2026-08-21) · PROMOCIÓN A BUILD 25 AUTORIZADA

### Ficha de tarea · identidad antes de los datos natales

**Objetivo.** Reordenar el alta de Órbita para que, después del splash de
marca, la primera acción sea crear cuenta o ingresar con Apple, Google o email.
Sólo una sesión confirmada puede comenzar o reanudar el onboarding natal. El
flujo deja de depender de confirmar un borrador anónimo y de resolver la zona
horaria antes de mostrar Clerk.

**Criterios de aceptación.** (1) una instalación sin sesión ve primero una
superficie unificada `Crear cuenta | Ingresar`; (2) una cuenta nueva entra al
onboarding sólo después de activar la sesión; (3) una cuenta completa entra a
Inicio y una incompleta retoma el destino autoritativo correspondiente; (4) el
paso tardío `Guardá tu carta` deja de crear la cuenta; (5) un fallo de zona
horaria no puede impedir registrarse; (6) cancelación, error y reintento de auth
tienen salida útil; (7) no se muestran ni adoptan datos de otra cuenta; (8) web,
iOS, accesibilidad y restauración de sesión conservan sus contratos; (9) los
endpoints de borrador anónimo siguen disponibles para builds 22–24.

**Owner y territorio.** Claude Code ejecuta el frontend en `app/**`, `src/**`.
Codex orquesta, actualiza las pruebas, revisa identidad/ownership y verifica;
`convex/**` es sólo lectura y no cambia en esta tarea. Trabajo aislado en
`/Users/lucas/Documents/Core/worktrees/orbita/auth-first-onboarding`, rama
local `fix/auth-first-onboarding`, desde `58a41efa` (`release/1.0.0`).

**Riesgo.** Alto: cambia el orden de autenticación, los destinos de arranque y
la persistencia del alta. Se falla cerrado ante sesión no confirmada, se evita
adoptar borradores anónimos de otra identidad y se preserva compatibilidad con
los clientes ya distribuidos. No se reemplaza Clerk ni se inventa un manejo de
tokens propio.

**Plan de pruebas.** Pruebas puras del resolver de destino; instalación nueva;
crear cuenta e ingresar; cuenta completa/incompleta; volver/cancelar/reintentar;
ownership entre dos cuentas; restauración y offline seguro; regresiones del
onboarding; accesibilidad estructural; `pnpm typecheck`, suite completa con
piso vigente, `git diff --check` y revisión del diff. Sin QA física de
VoiceOver en este entorno.

**Rollout.** Integrar este único objetivo mediante PR a `release/1.0.0`, subir
el build iOS de 24 a 25, producir el RC con configuración productiva y enviarlo
a TestFlight interno para QA física. El backend compatible ya desplegado no se
modifica porque este diff no toca contrato ni funciones Convex.

**Rollback.** Descartar/revertir exclusivamente el diff de esta rama y volver
al flujo del build 24. Como no se elimina ningún contrato backend, los builds
22–24 continúan funcionando sin migración destructiva.

**Fuera de alcance.** Deploy de Convex sin delta backend, App Review,
publicación pública, OTA, Android, rediseño visual completo, cambios de pago y
la revisión editorial de Tránsitos (`VER TU MOMENTO`, ranking y copy), que queda
registrada para una tarea posterior.

### Evidencia de cierre de fuente

- **Entrada auth-first.** Instalación nueva y `/empezar` abren
  `/crear-cuenta`; la cuenta existente puede cambiar a `/iniciar-sesion` desde
  el selector visible `Crear cuenta | Ingresar`. El onboarding canónico queda
  en `/onboarding` y sólo admite el destino autenticado `onboarding`.
- **Flujo natal.** La portada y el alta tardía salieron de `OnboardingFlow`;
  quedan 13 pasos (0–12). El cierre escribe `completeBirthData` bajo sesión,
  resuelve la zona horaria desde las coordenadas del lugar y espera readiness
  autoritativo antes de crear el perfil local y entrar a Recepción.
- **Aislamiento.** El alta nueva abandona cualquier borrador anónimo legacy;
  una cuenta completa no puede montar el onboarding y una cuenta preexistente
  incompleta conserva su recuperación por el editor natal. Los contratos de
  borrador remoto se mantienen sin cambios para los builds ya distribuidos.
- **Verificación.** Suite completa: **2723/2723**, 235 suites, cero fallos,
  cero skips. `tsc --noEmit` y `git diff --check`: verdes. Revisión React/Expo:
  sin `Pressable.style` en forma función, targets de 44 px, selector con estado
  accesible y un único camino visual entre alta e ingreso.
- **Integración.** El commit de fuente `885df9f81c4e0389a6af5d9d2a43881c0d8da226`
  pasó el PR [#78](https://github.com/lucaszram/orbita/pull/78) y quedó integrado
  en `release/1.0.0` mediante el merge
  `7b841ec44c613412bf99528ad3518b30ead3f88d`. El árbol exacto del merge repitió
  **2723/2723** tests, typecheck, `git diff --check` y export iOS en verde.
- **Binario 25.** EAS local archivó y firmó
  `/private/tmp/orbita-1.0.0-25.ipa` (aprox. 47 MB; SHA-256
  `f44975c520ebd210bab03f233559ee4cf876e809ea30ea61145f76950f2a11ea`).
  La inspección confirmó `1.0.0 (25)`, bundle `com.lucasssram.orbita`, ejecutable
  arm64, deployment target iOS 17, `get-task-allow=false` y beta reports activos.
  Expo Doctor conserva el warning conocido del RC anterior: 17/18 por tres
  desfasajes sólo de patch; no se amplió el hotfix actualizando dependencias.
- **TestFlight.** Apple aceptó el binario mediante la presentación
  `7aab0938-dd63-45ff-b737-1bcabe9ef21e`. Detalle:
  <https://expo.dev/accounts/lucasssram/projects/orbita/submissions/7aab0938-dd63-45ff-b737-1bcabe9ef21e>.
  TestFlight:
  <https://appstoreconnect.apple.com/apps/6788918249/testflight/ios>. Apple puede
  tardar algunos minutos adicionales en procesarlo y mostrarlo a testers
  internos. No se ejecutó deploy Convex, App Review ni publicación pública.
- **QA pendiente.** Instalación limpia real en iOS: alta e ingreso con los
  métodos visibles/configurados, cancelar/reintentar, relanzar a mitad del
  onboarding y confirmar que los datos reaparecen sólo bajo la misma cuenta.

## QA23 · promoción del cierre posterior al build 23 (2026-08-21) · AUTORIZADA · EN CURSO

### Ficha de promoción · integración + Convex + build 24/TestFlight

**Objetivo.** Convertir el árbol QA23 ya verificado en un Release Candidate
identificable: integrar la rama por el flujo del repositorio, regenerar y
desplegar el contrato/backend Convex compatible, incrementar sólo el build iOS
a 24, producir el binario productivo desde ese commit y enviarlo a TestFlight
para QA física. Esta autorización no incluye App Review ni liberación pública.

**Criterios de aceptación.** (1) commit y rama remota exactos; (2) diff completo
revisado y worktree limpio antes del build; (3) `convex/_generated` actualizado
por Codex, contrato aditivo y builds 22/23 compatibles; (4) suite completa con
piso 2542, typecheck, diff check y export iOS verdes sobre el commit candidato;
(5) variables de producción presentes sin imprimir valores; (6) deploy Convex
exitoso y smoke checks de funciones críticas; (7) versión `1.0.0`, build iOS
`24`, perfil EAS `production`; (8) build subido a TestFlight con identificador y
URL registradas; (9) ninguna acción de App Review ni release pública.

**Owner y territorio.** Claude Code revisa el frente y la configuración Expo;
Codex orquesta, revisa, controla `convex/**`, codegen, deploy, Git y EAS. El
trabajo continúa exclusivamente en `qa23-fixes`; no se toca `qa22-fixes` ni
otro producto. Archivos compartidos de release (`app.json`, `eas.json`, docs y
config) sólo se cambian cuando el gate lo exige.

**Riesgo.** Alto: auth, compra, onboarding, esquema aditivo, backend productivo
y distribución iOS. Se falla cerrado ante rama/base inesperada, secretos
faltantes, codegen no reproducible, tests rojos, deploy parcial, número de build
ocupado o credenciales no disponibles. No se corrige una falla ampliando el
alcance silenciosamente.

**Plan de pruebas.** Revisión de diff y secretos; codegen; suite completa y gate
de conteo; typecheck; `git diff --check`; export iOS; verificación de config
pública Expo; smoke backend sin escrituras destructivas; estado de EAS y App
Store Connect. La QA física posterior cubre instalación nueva, alta, login de
cuenta existente, compra sandbox, cancelación, restore, reinicio, Free/Plus,
offline/reconexión y navegación crítica.

**Rollout.** Commit(s) identificables → rama remota/PR o integración equivalente
según el estado real del repo → deploy Convex compatible → build 24 productivo →
TestFlight interno. Lucas prueba y autoriza por separado App Review y la salida
pública del mismo binario.

**Rollback.** Antes del deploy, detener la promoción y conservar build 23. Tras
el deploy, mantener el campo opcional nuevo en schema y revertir lógica/cliente
si fuera necesario; no hacer una migración destructiva. Un build fallido o no
aprobado queda sin seleccionar en App Store Connect y build 23 sigue vigente.

**Fuera de alcance.** App Review, publicación pública/automática, OTA, Android,
web productiva, cambios de producto adicionales, migraciones destructivas y
QA física realizada por el agente.

**Preflight ejecutado.** Base y branch correctas (`5ffbd17`,
`fix/qa23-release-readiness`); `origin/main` es ancestro de la línea de release
y no existe todavía una rama remota QA23/release que pueda pisarse. EAS reconoce
la cuenta `lucasssram`, el proyecto `9e91bb5e-e69e-489e-818d-0e377f397147` y el
bundle `com.lucasssram.orbita`; el build 24 no aparece usado. Codegen contra
Development (`dutiful-viper-815`) terminó en verde y no modificó
`convex/_generated`. El candidato `1.0.0 (24)` cerró **2720/2720**, gate mínimo
**2542**, typecheck y `git diff --check`; export iOS en
`/private/tmp/orbita-qa23-build24-ios-export` terminó en verde. La revisión
estática de los TSX, siguiendo el checklist de hooks/render/persistencia, no
encontró P0/P1, mocks activos, endpoints locales ni secretos en los archivos
cambiados. Expo Doctor conserva el warning ya conocido del build 23: **17/18**,
con tres desfasajes sólo de patch (`expo` 54.0.35 vs 54.0.37,
`expo-constants` 18.0.13 vs 18.0.14 y `expo-updates` 29.0.18 vs 29.0.20); no se
actualizan dependencias dentro de este RC porque el build 23 archivó bien con la
misma base y hacerlo ampliaría el riesgo. La revisión adicional de Claude se
interrumpió al quedar sin salida ni cambios; no ejecutó acciones externas.

### Promoción ejecutada · build 24 recibido por Apple

- **Integración.** Los cambios se separaron en `6d7a190` (backend compatible),
  `949f8b1` (cierre QA23 de cliente) y `8d81c35` (preparación del build 24). El
  PR [#76](https://github.com/lucaszram/orbita/pull/76) pasó tests, typecheck,
  export web y previews, y se integró en `release/1.0.0` mediante el merge
  `536c337069ac5379d2e89d3db5c988b975d80270`. Ese es el commit exacto de
  fuente usado para producir el binario; `qa22-fixes` permaneció intacto.
- **Convex productivo.** Antes del deploy se exportó la copia completa con
  storage `/private/tmp/orbita-convex-prod-pre-qa23-536c337.zip` (SHA-256
  `1b5f15de8a49f7b31e232a1b011b35632ce7e6391267785703660d0aa5febcd4`).
  El deploy aditivo terminó correctamente en `exciting-bat-311`; validó schema,
  no eliminó índices y el smoke read-only `void:suggestedToday` terminó en
  verde. El spec público posterior conserva 141 funciones y las superficies
  compatibles requeridas (`layers`, `relationships`, borrado v2 y reconcile).
- **Binario.** EAS local archivó y firmó `/private/tmp/orbita-1.0.0-24.ipa`
  (49.234.862 bytes; SHA-256
  `692279bcddf04e83db04797aafd7299bea8232532538c38e954fdcc5c6ceaca5`).
  La inspección del IPA confirmó `1.0.0 (24)`, bundle
  `com.lucasssram.orbita`, nombre `Órbita`, ejecutable arm64, entitlement
  `get-task-allow=false`, beta reports activos y perfil vigente hasta
  2027-07-08. El bundle contiene el host Convex productivo y ninguna referencia
  al deployment de desarrollo.
- **TestFlight.** Se reutilizó la clave de App Store Connect ya existente y se
  la asoció al proyecto para EAS Submit; no se creó otra clave. Apple aceptó el
  binario y EAS cerró la presentación
  `e36afb92-0179-4bc9-ba5d-38c665cb54a6` como `finished` el 2026-08-21 a las
  23:03 ART. Detalle: <https://expo.dev/accounts/lucasssram/projects/orbita/submissions/e36afb92-0179-4bc9-ba5d-38c665cb54a6>.
  TestFlight: <https://appstoreconnect.apple.com/apps/6788918249/testflight/ios>.
  Apple puede tardar unos minutos adicionales en completar el procesamiento y
  mostrar el build a testers internos.
- **Pendiente de Lucas.** QA física en TestFlight: onboarding de instalación
  nueva y cuenta existente; aislamiento de borradores; compra sandbox,
  cancelación, restore y reinicio; estados Free/Plus; offline, reconexión y
  cambio de cuenta; perfil/comparación de Vínculos; cambio de día de
  Cumpleluna; splash, deep links, atrás y restauración de scroll. App Review y
  la salida pública requieren una autorización posterior explícita.

## Cierre de fuente QA23 · evidencia previa

**Objetivo.** Cerrar en código los hallazgos de QA física del build 23 sobre la
base exacta `5ffbd17`, preservando el RC/binario existente (`0ec205d`) y
preparando un árbol verificable para una futura build 24, sin crearla ni
distribuirla en esta tarea.

**Criterios de aceptación.**

1. **Plan.** La raíz muestra sólo `PLUS` / `FREE`; los detalles muestran
   `Órbita Plus` / `Órbita Free`; toda variante tiene nombre accesible y no se
   presenta `Free` mientras el entitlement siga sin resolver.
2. **Tu momento.** La raíz presenta tres módulos hermanos —Estación vital,
   Tema del año y Tus cuatro ritmos—. Estación y año conservan sus detalles.
   Cuatro ritmos tiene un único CTA a un detalle integral y determinístico del
   mandala (concepto, cuatro anillos, configuración actual, combinación, uso,
   pregunta, método y trazabilidad), sin enlaces internos a estación, año,
   ciclo lunar ni tránsito. Atrás y deep link vuelven a Tu momento preservando
   scroll; la pestaña Tránsitos abre Ahora y los arcos abiertos desde Ahora
   vuelven a Ahora.
3. **Cumpleluna.** La identidad del snapshot incorpora el alcance diario y su
   vigencia deja de cubrir casi un ciclo; el cliente no combina `Date.now()` con
   escalares de otro día. Hay pruebas de cambio de día y bordes temporales.
4. **Tipo de vínculo aditivo.** Se aceptan los ocho valores internos y labels
   definidos por Lucas. El tipo se pregunta junto al nombre, es editable,
   declarado y separado de signo/fecha/carta. Contrato, schema, guardado y perfil
   son opcionales y compatibles con builds 22/23 (`null` = legacy; `prefer_not_to_say`
   = elección explícita). Sólo `romantic` puede emitir Deseo o lenguaje sexual;
   los demás y legacy son neutrales. Legacy muestra `DEFINIR TIPO DE VÍNCULO`
   sin bloquear. El tipo participa de hash/cache y el copy se contrasta con las
   fuentes astrológicas locales. Sin LLM nuevo y sin deploy.
5. **Post-guardado.** Alta y edición confirman brevemente y aterrizan en el
   perfil canónico de la persona. Las filas abren ese perfil, que ofrece
   `VER LA COMPARACIÓN` y `EDITAR DATOS`; la comparación es una ruta hija. Las
   pruebas fijan ownership y evitan abrir datos de otra cuenta.
6. **Arranque visual.** Splash y gates usan `#0A0B0E`, no muestran frames claros
   ni slide lateral de redirects y no parpadean `Free`. Se puede modificar
   `app.json`, pero no construir ni publicar.
7. **Offline seguro.** Un timeout de Clerk no se interpreta como signed-out.
   Con cuenta previamente válida y snapshot local seguro se abre el shell con
   últimos datos, aviso localizado, errores/reintentos por sección y
   reconexión sin reinicio. Sin sesión confirmada se bloquean compras, borrado,
   edición natal y escrituras sensibles. Instalación nueva o sin identidad local
   segura conserva el gate. Una matriz pura demuestra que nunca se muestran
   datos de otra cuenta.
8. **Cierre técnico.** Se revisan onboarding nuevo completo y pago/restore/
   reinicio. Suite completa con piso `>= 2542` y cero fallos, `pnpm typecheck`,
   `git diff --check`, export Expo web/iOS fuera del repo si no publica y
   compatibilidad de web/rutas, sin build ni distribución.

**Owner y territorio.** Claude Code es ejecutor principal de `app/**`, `src/**`,
config gris imprescindible (`app.json`) y pruebas del cliente. Codex orquesta,
revisa, verifica y es dueño exclusivo de `convex/**`, contrato, CHANGELOG y
eventual codegen. Documentación y pruebas se actualizan como evidencia. Todo se
hace únicamente en `/Users/lucas/Documents/Core/worktrees/orbita/qa23-fixes`,
rama local `fix/qa23-release-readiness`; `qa22-fixes` queda intacto.

**Riesgo.** Alto por abarcar navegación, identidad offline, compra, datos
persistidos y un contrato aditivo. Los cortes fail-closed son: ninguna autoridad
de compra o escritura desde snapshots; ninguna publicación de datos sin dueño
correlacionado; campos nuevos opcionales; cachés versionados por entradas; y
degradación neutral para vínculos legacy. Los cambios se implementan y revisan
por bloque, con prueba focal, typecheck y diff antes de avanzar.

**Plan de pruebas.** Por bloque: pruebas puras de dominio y ownership, pruebas
estructurales de ruta/copy/accesibilidad y regresiones existentes vecinas;
`pnpm typecheck` y revisión de diff. Cierre: suite completa, gate de conteo con
piso 2542, `git diff --check`, exports Expo web/iOS sólo a `/private/tmp` y
revisión manual del árbol. La QA física de VoiceOver queda fuera y sólo se
mantiene/cubre la accesibilidad automatizada.

**Rollout.** Futuro PR y futura build 24 únicamente después de autorización
separada. El contrato de vínculo es aditivo y puede convivir con builds 22/23;
el cliente nuevo degrada ante backend viejo y filas legacy. Esta tarea no hace
commit, push, deploy, build, EAS/TestFlight, submit ni App Review.

**Rollback.** Antes de deploy futuro, descartar/revertir el cambio de fuente
restaura el build 23 sin migración. Después de un eventual deploy que haya
escrito el campo opcional de vínculo, el rollback seguro es mantener el campo en
schema/backend y revertir sólo el cliente hasta que expiren cachés; no se elimina
schema contra filas ya escritas. Los snapshots offline nuevos son de
presentación y quedan inertes si el lector se revierte.

**Fuera de alcance aceptado.** Baúl del Umbral; copy del CTA de cuota agotada;
refinamiento de múltiples exactos; QA física de VoiceOver; commit, push, deploy
de Convex, codegen no imprescindible, build 24, EAS/TestFlight, App Review y
publicación; otros productos y otros worktrees.

### Avance verificado · bloques 1–8 cerrados en fuente (sin publicar)

Esta sección **reemplaza el estado provisional que sigue debajo**, escrito por
el ejecutor antes de que Codex completara backend y pruebas.

- **Bloques 1–2:** implementación frontend completa; focal conjunto en verde
  (`181/181`) y `pnpm typecheck` en verde.
- **Bloque 3:** backend y frontend completos. `ORB-LUN-002` incorpora alcance
  diario `{localDate, timezone}`, persiste como snapshot diario, acota
  `validUntil` al primer borde seguro y el cliente ancla todos los escalares a
  `observedAt`. Focal backend/frontend y bordes en verde (`93/93`), typecheck en
  verde. No hubo codegen ni deploy.
- **Bloque 4:** completo en contrato, schema, motor, caché y cliente. Ocho tipos
  y labels exactos; alta/edición junto al nombre; `null` legacy distinto de
  `prefer_not_to_say`; CTA no bloqueante para legacy; hash, idempotencia y
  claves de lectura incluyen el tipo. Sólo `romantic` publica `Deseo` o lenguaje
  de atracción; cualquier otro tipo y legacy usan `Energía compartida` con
  redacción neutral sobre iniciativa, expresión y acuerdos. El tipo no se
  infiere de carta/fecha/signo y las técnicas se contrastaron con los locators
  locales de `ORB-REL-002/003`. Un backend viejo puede rechazar el único campo
  nuevo sin perder el alta: el cliente reintenta el mismo intento sin ese campo,
  informa la degradación y ofrece salida al perfil. Focal consolidado en verde:
  **100/100**; `pnpm typecheck` y `git diff --check` en verde. No hubo LLM nuevo,
  migración, codegen ni deploy.
- **Bloque 5:** perfil canónico en `/vinculos/[profileId]`, comparación hija en
  `/vinculos/[profileId]/comparacion`, filas y post-guardado al perfil, dos CTA
  explícitos y cero cálculo automático desde raíz/perfil. Ownership y deep links
  resuelven el id contra `relationships.list` antes de publicar datos. Focal
  consolidado en verde: **116/116**; `pnpm typecheck` y `git diff --check` en
  verde.

- **Bloque 6:** arranque visual escrito en fuente y en `app.json`. Un solo color
  `#0A0B0E` para splash, root view, `Stack` raíz y los seis gates; barra de
  estado `light` declarada una sola vez y repetida por el shell con el mismo
  token; los cuatro redirects de gate reemplazan sin animación y la navegación
  posterior conserva la suya; el chip del plan sigue sin poder decir `Free`
  antes de saberlo, y ahora ningún gate nombra un plan siquiera. Las pruebas
  del bloque y sus regresiones vecinas cerraron **41/41**; `pnpm typecheck` y
  `git diff --check` están en verde. No hubo prebuild ni build.
- **Bloque 7:** timeout no equivale a signed-out; sesión degradada sólo con
  identidad previa nativa en SecureStore y ownership exacto, web fail-closed,
  aviso/reintento sin reinicio y bloqueos explícitos para pago, restore, edición
  natal, eliminación y escrituras de Vínculos. La secuencia de cambio A→B
  serializa `clear` y `write` y nunca publica owner durante una transición.
  Focal ampliada en verde: **211/211**; `pnpm typecheck` y `git diff --check` en
  verde. No hubo codegen, deploy, prebuild ni build.

- **Bloque 8:** auditoría de release-readiness del onboarding nuevo completo y
  del flujo de pago/restore/reinicio cerrada. Se corrigieron: adopción indebida
  del borrador anónimo al entrar con una cuenta existente; falso fallo del alta
  si fallaba el recordatorio; selección de ciudad que pedía dos toques con el
  teclado abierto; salida local post-guardado que podía quedar trabada; y el
  enlace de cuenta existente de Clerk web, que ahora sale a `/iniciar-sesion`
  antes de reutilizar una sesión. El focal propio cerró **16/16** y la
  reverificación estructural de los contratos que cambiaron cerró **202/202**.

**Cierre final:** suite completa **2720/2720** (piso requerido 2542),
`pnpm typecheck` exit 0, `git diff --check` exit 0 y exports Expo web/iOS exit 0
fuera del repositorio (`/private/tmp/orbita-qa23-web-final`, 33 MB, 189 archivos;
`/private/tmp/orbita-qa23-ios-final`, 30 MB, 125 archivos). No hubo commit,
push, codegen, deploy, prebuild, build nativo, EAS, TestFlight ni App Review.
No hay bloque 9: sólo queda la autorización separada para integrar/publicar y
la revalidación física sobre una futura build 24.

### Bloque 8 · cierre técnico: alta nueva y pago/restore/reinicio (QA23-008) · VERIFICADO

**Estado.** Auditoría completa del grafo real —nativo y web— del onboarding
nuevo y del comercio, con las correcciones de fuente y pruebas descriptas
abajo. Codex verificó el focal propio **16/16**, los contratos estructurales
afectados **202/202**, la suite completa **2720/2720**, `pnpm typecheck` y
`git diff --check`; los exports Expo web e iOS terminaron en verde fuera del
repo. No hubo codegen, deploy, prebuild, build nativo, EAS, TestFlight ni App
Review. `app.json` conserva versión `1.0.0` y build `23`; sus cambios sólo
preparan el fondo de arranque para una futura build 24 autorizada.

**Qué se recorrió, y hasta dónde.** El grafo entero de entrada y de cobro, leído
de punta a punta: `app/index.tsx` y `src/routes/v492/index{,.web}.tsx` →
`resolveStart` → `/onboarding` → `OnboardingGate` → `AccountGate` →
`OnboardingFlow` (los quince pasos, el borrador local y el remoto, la tríada, el
paso de cuenta con la UI oficial de Clerk, el cierre y la recepción) →
`/iniciar-sesion` → `useAccountBootstrap` → `/editar-datos`; y del otro lado
`/paywall` → `PlusPaywallScreen` → `RevenueCatProvider` → `nativeCommerce` /
`purchaseGuard`, más `ManageSubscriptionBlock`, el Perfil y
`PendingDeletionBoundary`. Del backend se leyeron —sin tocar—
`convex/onboarding.ts`, `convex/publicOnboarding.ts` y
`convex/lib/onboardingCompletion.ts`, porque los tres defectos de identidad del
alta sólo se ven cruzando el cliente con lo que la mutación hace de verdad.

#### Defecto 1 · una cuenta se quedaba con los datos natales de otra alta

**Qué pasaba.** El `clientDraftId` del alta anónima vive en memoria de módulo
(nativo) y en `sessionStorage` (web) — a propósito: es lo que le permite
sobrevivir a la vuelta de Clerk en web. Pero también sobrevivía a la pantalla de
login, y ahí dejaba de ser suyo:

1. `SessionResilienceProvider` le pasa ese id a
   `onboarding.getCompletionStatus`. El backend lo busca y acepta el borrador si
   **no tiene dueño** (`safeExplicitDraft`), que es exactamente el caso de un
   borrador anónimo. Con él presente contesta `recovery: "onboarding"`.
2. Con esa respuesta, `resolveReadinessDestination` manda a una cuenta
   preexistente incompleta **al alta**, que es create-only, en vez de a
   `/editar-datos`, que es su destino diseñado.
3. Ya adentro del alta, `sesionActiva` hace que `prepareSignupDraft` se saltee
   entero: con la sesión activa el borrador remoto **no se vuelve a escribir**.
   Los pasos 4–12 se cargan sólo en `useState`.
4. El cierre llama `completeSignupFromDraft({ clientDraftId })`, y esa mutación
   copia fecha, hora, lugar, coordenadas y zona **de la fila del borrador** — no
   de lo que la persona acaba de tipear.

**El resultado.** La cuenta que acaba de entrar se queda con los datos de
nacimiento del alta anterior (otra persona en un teléfono o una pestaña
compartida, o los datos viejos de la misma persona), y lo que tipeó se descarta
sin un solo aviso. Es el caso que el criterio «una cuenta A nunca hereda datos de
B» nombra, y estaba abierto.

**Reproducción, sin inventar nada.** Empezar el alta, llegar al paso 13 (el
borrador remoto queda guardado y confirmado ahí), no crear la cuenta, volver
atrás hasta el paso 0, tocar «Ya tengo cuenta» y entrar con una cuenta que
existe y no completó su alta.

**La corrección (`app/iniciar-sesion.tsx`).** Entrar por esa puerta es la
declaración explícita de «ya tengo cuenta», así que el alta anónima se
**abandona**: `clearDraft()` en `enter`, que es el `onSignedIn` de
`SignInScreen` y por donde pasan las tres vías (código, contraseña y Google).
Con el id fuera, `getCompletionStatus` deja de encontrar el borrador ajeno, la
cuenta incompleta vuelve a `/editar-datos` —que sí puede completar y recalcular—
y el alta no se puede montar ni por deep link
(`destinationAllows("edit-birth-data", "onboarding") === false`). Volver atrás o
salir a «Crear una cuenta» **no** borran nada: ahí el alta sigue siendo de quien
la empezó.

#### Defecto 2 · un fallo del recordatorio diario se reportaba como alta fallida

**Qué pasaba.** `scheduleDailyReminder` traga el error del **permiso**
(`requestNotificationAccess`), pero no el de
`cancelAllScheduledNotificationsAsync` ni el de `scheduleNotificationAsync`, que
pueden tirar con el permiso ya concedido. `createProfile` los esperaba **después**
de haber escrito el perfil y su dueño en disco, así que ese rechazo se propagaba
hacia atrás a los cuatro llamadores: el cierre del alta quedaba en «Guardando tus
datos…», el editor natal decía «no cambiamos nada» habiendo escrito, y el
bootstrap y la recuperación del arranque mostraban reintento sobre algo que ya
estaba guardado.

**La corrección (`src/hooks/useAppState.tsx`).** El recordatorio es un efecto
lateral, no parte de la creación del perfil: las dos llamadas —creación y
edición— quedan `.catch(() => false)`. El orden no cambió: primero el disco,
después el efecto lateral.

#### Defecto 3 · elegir la ciudad pedía dos toques

**Qué pasaba.** `keyboardShouldPersistTaps` por defecto es `"never"`: con el
teclado abierto, el primer toque fuera del campo lo cierra y **no se entrega al
hijo**. El paso «¿Dónde naciste?» es exactamente esa interacción —se tipea y se
toca un resultado de la lista— y el shell del alta
(`src/onboarding/components/Screen.tsx`) no lo declaraba. El editor natal sí lo
declaraba por su cuenta, con el comentario que explica justamente este caso: las
dos superficies con la misma interacción se comportaban distinto.

**La corrección.** `keyboardShouldPersistTaps="handled"` en el `ScrollView` del
shell del alta —una vez, para todos los pasos— y `accessibilityRole="button"`
más `accessibilityHint` en cada resultado de ciudad, que se leían como texto
suelto y no ofrecían activarse. El mismo shell lo monta `SignInScreen`, así que
el `Continuar` / `Verificar código` del login con el teclado abierto también deja
de necesitar dos toques.

#### Defecto 4 · el cierre del alta no tenía salida si fallaba la parte local

**Qué pasaba.** `enterApp` tomaba `enterLock` y no lo soltaba nunca («en el éxito
ya navegamos fuera»). Un rechazo de `createProfile` —AsyncStorage, o el
recordatorio del defecto 2— dejaba el candado tomado, sin `submitError` y sin
navegación: la pantalla quedaba en «Guardando tus datos…» sin un solo control,
con los datos **ya guardados en la cuenta**. La única salida era matar la app (y
recién ahí el arranque reconciliaba contra Convex).

**La corrección (`src/onboarding/OnboardingFlow.tsx`).** El cuerpo pasó a
`abrirOrbita` y `enterApp` es ahora el candado más su fallo: suelta el candado,
publica `entryFailed` y la pantalla ofrece **volver a entrar** —no a guardar de
nuevo algo que ya está hecho—. El aviso lo dice así («tus datos quedaron
guardados en tu cuenta, pero no pudimos abrir Órbita en este teléfono») y el
anuncio para lector de pantalla deja de ser «no pudimos sincronizar tus datos»,
que habría afirmado una pérdida que no ocurrió. `SavingBirthData` recibió dos
props opcionales con el valor de siempre por defecto, así que el camino de
guardado no cambió en nada.

#### Lo que se revisó y quedó BIEN (evidencia, no resumen)

- **Ownership del alta.** El aislamiento de datos ajenos corre **antes** de
  elegir destino y también cuando la cuenta activa no tiene `birthData`
  (`runAccountBootstrap`, `resolveAccountDestination` → `bootstrap`), con archivo
  bajo el dueño anterior + `resetApp` y fail-closed si el archivo falla. El
  arranque nativo hace lo mismo en su rama `recover`, y `leaveWithoutSignIn`
  cubre al que se va del login sin entrar.
- **Alta parcialmente persistida.** El cierre es idempotente por `clientDraftId`
  (`completeSignupFromDraft` → `decideOnboardingBirthDataWrite` devuelve
  `idempotent` para el mismo payload) y la puerta de salida es la query reactiva
  `getCompletionStatus`, no el retorno de la escritura: un reintento no duplica y
  un corte no pierde. `commitProfileCreation` persiste perfil y dueño **antes**
  de publicar la adopción diferida.
- **Doble toque.** `submitLock` y `enterLock` son refs sincrónicos;
  `verifyGuardRef` cubre el auto-submit del código contra el tap del botón;
  `runExclusive` + `createOwnerGates` cubren compra, restore, Customer Center y
  activación, y el candado es **por dueño**.
- **Sesión sin confirmar (bloque 7) sobre el alta.** `AccountGate` resuelve la
  sesión sin confirmar **antes** que nada y nunca redirige por ella; con
  `sticky` —que sólo declara el alta— un corte de red en el paso 13 no desmonta
  el flujo con la cuenta recién creada. Ninguna escritura sale de ahí sin cuenta
  activa: `submit` exige `cuentaActiva` y vuelve al paso de cuenta con el
  borrador intacto, y `useOnboardingFinalize` rechaza sin `isSignedIn`.
- **Ningún CTA cobra, restaura o gestiona sin sesión confirmada.** `/paywall`
  declara `requires="confirmed-session"` (apaga Offering, compra, restore y
  Customer Center de una vez); `restoreReady` exige identidad de RevenueCat **y**
  entitlement remoto resuelto para esta cuenta; las seis operaciones del SDK
  pasan por `runOnStore`, que exige `isLive` + identidad alineada + generación;
  `ManageSubscriptionBlock` deriva del **remoto** (sin él, `view === "loading"` y
  no dibuja ninguna acción) y separa el dueño de Clerk —portal de Stripe— del
  dueño de la tienda —Customer Center y restore—; `Eliminar mi cuenta` se
  revalida en el handler.
- **Resultado ambiguo y reinicio.** El marcador se escribe en disco **antes** de
  abrir la hoja de la tienda y sobrevive al desmontaje: al remontar, el primario
  es `restore` y nunca `purchase`. Sólo una cancelación demostrada o un restore
  vacío autoritativo lo levantan; `store_confirmed` no, y `recheck_empty`
  tampoco. Un marcador ilegible bloquea (falla cerrado) y el de A no frena a B.
- **Cambio A → B.** `purchaseSessionForOwner` devuelve una sesión nueva en el
  mismo render, así que B nunca hereda el `guardLoaded` de A; `publishOwnedValue`
  hace que una continuación tardía de A no pueda publicar ni limpiar sobre B; y
  `storeIdentityIsCurrent` cae el estado del provider de forma **síncrona**.
- **Snapshot del entitlement y plan sin parpadeo.** El snapshot es por cuenta y
  validado; `labelReady` es exactamente «la vista efectiva afirma un plan», así
  que `Free` no puede aparecer antes de saberlo; y todo lo que decide plata sale
  de `remote`/`resolved`, nunca de `effective`.
- **PendingDeletionBoundary × compra.** El boundary envuelve sesión, plan y
  Stack, así que un marcador vivo desmonta el producto entero antes de que
  `RevenueCatProvider` identifique a nadie; la purga llama `clearPurchaseGuard`
  (que **propaga** el fallo) y sólo declara `completed` si todos los pasos
  cerraron; en web no purga y lo dice.

**Archivos tocados en este bloque.**

| Archivo | Qué cambió |
|---|---|
| `app/iniciar-sesion.tsx` | `clearDraft()` en `enter` (el `onSignedIn` de las tres vías) + el porqué escrito. |
| `src/hooks/useAppState.tsx` | `scheduleDailyReminder` best-effort en `createProfile` y `updateProfile`. |
| `src/onboarding/OnboardingFlow.tsx` | `abrirOrbita` + `enterApp` con su catch; estado `entryFailed`; `SavingBirthData` con `errorLabel`/`retryLabel` opcionales. |
| `src/onboarding/components/Screen.tsx` | `keyboardShouldPersistTaps="handled"` en el scroll del shell del alta. |
| `src/onboarding/screens/BirthplaceSearchScreen.tsx` | Rol y pista accesibles en cada resultado de ciudad. |
| `test/altaYPagoQA23.test.ts` (nuevo) | La prueba focal del bloque. |

**Prueba escrita · NO EJECUTADA.**

| Archivo | Qué fija | Estado |
|---|---|---|
| `test/altaYPagoQA23.test.ts` (nuevo) | **Puro y ejecutado:** el ciclo de vida del borrador anónimo sobre un `sessionStorage` falso —que el id sea estable y sobreviva a un remonte (la propiedad que el alta necesita) y que `clearDraft()` se lleve el id **y** los datos tipeados, y que un alta posterior estrene el suyo—; la cadena de destino completa (`resolveReadinessDestination` → `resolveAccountDestination` → `destinationAllows`) para una cuenta preexistente incompleta y para una completa, que es lo que decide si el alta se puede montar; y los puntos de reinicio del pago (marcador persistido → `restore`, marcador ilegible → `restore`, marcador de otra cuenta → `purchase`, qué respuestas levantan el bloqueo, y que un cambio A → B no herede ni `guardLoaded` ni una publicación tardía). **Cableado, leyendo la fuente:** que `/iniciar-sesion` importe y llame `clearDraft` en `enter` y que `leaveWithoutSignIn` **no** lo llame; que las tres vías de `SignInScreen` pasen por `onSignedIn`; que `enterApp` suelte el candado y ofrezca entrar; que las dos llamadas al recordatorio estén `.catch`-eadas y sigan después del disco; que el shell del alta persista los taps y que el resultado de ciudad tenga rol; y que ningún CTA comercial exista sin sesión confirmada (`requires` del pago y del editor, `restoreReady`, las seis acciones por `runOnStore`, el remoto en `ManageSubscriptionBlock` y la revalidación del borrado en Perfil). | **escrito, sin ejecutar** |

**Lo que esta prueba NO afirma.** No monta React ni navega: fija que el handler
revalide y que la ruta declare su exigencia, no cómo se ve. No compra de verdad
—la hoja de StoreKit, el webhook y el Customer Center son prueba de dispositivo—
y no ejercita `expo-secure-store` ni el comportamiento real de Clerk sin red. Y
no prueba el backend: `completeSignupFromDraft` se leyó, no se corrió.

**Comandos exactos que Codex tiene que correr.**

1. `pnpm typecheck`
2. `npx tsx --test test/altaYPagoQA23.test.ts`
3. Focal de regresión vecina (todo lo que lee estas fuentes o depende de ellas):
   `npx tsx --test test/sesionOfflineQA23.test.ts test/arranqueVisualQA23.test.ts test/planIndicatorQA23.test.ts test/v492ReleaseP1.test.ts test/responsiveShells.test.ts`
4. `git diff --check`
5. Suite completa con el piso de conteo (`>= 2542`, ahora + los casos nuevos) y
   cero fallos.
6. Export Expo web/iOS fuera del repo (`/private/tmp`), sin build ni
   distribución.

**Riesgos anotados.**

1. **Nada de esto se ejecutó.** Es el riesgo principal, igual que en el bloque 7:
   el ejecutor trabajó sin shell por instrucción explícita. Los cinco archivos de
   fuente y la prueba están escritos y sin una sola corrida.
2. **Las aserciones estructurales de la prueba nueva son de TEXTO.** Fijan
   fragmentos concretos (`const restoreReady = …`, `onRetry={entryFailed ? …}`,
   el conteo de `await runOnStore(`). Un reformateo las rompe por forma y no por
   conducta. Están elegidas sobre líneas que llevan la garantía, no sobre
   decoración, pero conviene saberlo.
3. **`OnboardingFlow` cambió de forma.** El cuerpo del cierre se llama ahora
   `abrirOrbita`, hay un estado nuevo (`entryFailed`) y `SavingBirthData` tiene
   dos props más. Si alguna prueba existente lee ese archivo esperando la forma
   anterior —en particular una que afirme que `enterLock` **nunca** se libera—
   falla por forma y hay que actualizarla: la conducta nueva es deliberada.
4. **`app/iniciar-sesion.tsx` cambió `enter`.** Era un cuerpo de una línea. Una
   prueba estructural que lo lea literal falla por forma.
5. **`keyboardShouldPersistTaps="handled"` aplica a TODOS los pasos con
   `scroll`.** Es el comportamiento estándar y el mismo que ya tenían el editor
   natal y el paso de cuenta, pero cambia cómo se cierra el teclado en esos
   pasos: ahora un toque sobre un control lo conserva. Conviene mirarlo en el
   teléfono en el paso 6 y en el 13.
6. **La cuenta preexistente incompleta cambia de destino.** Con el borrador
   abandonado ya no entra al alta: va a `/editar-datos`. Es el destino diseñado y
   documentado en `resolveReadinessDestination`, pero es un cambio de conducta
   visible y es lo primero que hay que probar en el teléfono: entrar con una
   cuenta sin datos natales y confirmar que aterriza en el editor y que puede
   completar y recalcular.
7. **Queda un camino que esta corrección NO cubre.** Si la UI oficial de Clerk
   ofrece «iniciar sesión» **dentro** del paso 13, la sesión se activa sin pasar
   por `/iniciar-sesion` y el borrador —que en ese caso es el que la persona
   acaba de cargar— se adjunta igual. Con una cuenta que ya tiene datos natales,
   `decideOnboardingBirthDataWrite` tira `ONBOARDING_BIRTH_DATA_CONFLICT` y el
   cierre reintenta sesenta segundos antes de mostrar el error: es fail-closed
   (no pisa datos) pero la espera es larga y el mensaje habla de conexión. No se
   tocó porque cerrarlo bien exige que el backend distinga «este borrador creó
   esta cuenta», que es territorio de Codex.
8. **El cierre exitoso deja `submitLock` tomado a propósito.** Si
   `finalizeOnboarding` cierra bien pero la query reactiva de readiness nunca
   confirma, la pantalla se queda en «Guardando tus datos…» sin CTA. Reiniciar la
   app lo resuelve (el arranque reconcilia contra Convex). No se cambió: soltar
   el candado ahí habilitaría reescrituras sobre un cierre ya hecho.
9. **La instalación nueva sin red no puede empezar el alta.** Con
   `transient-unavailable`, `AccountGate` bloquea la superficie `onboarding` con
   reintento. Antes era un spinner infinito, así que es mejor, pero los doce
   primeros pasos del alta son locales y hoy no se pueden ver sin conexión. Es
   conducta heredada del bloque 7, no de éste, y se deja anotada porque es lo
   primero que ve alguien que instala en el subte.

**Autorizaciones pendientes.** Commit, push, PR, deploy de Convex, codegen,
prebuild, build 24, EAS, TestFlight, submit y App Review siguen **sin
autorizar** y no se hicieron. `app.json` no se tocó.

### Bloque 7 · una sesión sin confirmar no es una sesión ausente (QA23-007) · VERIFICADO

**Estado.** Implementación completa y verificada en el árbol de trabajo, **sin
commit**. Después de tres pasadas de implementación/revisión, Codex cerró la
tanda focal ampliada en **211/211**, `pnpm typecheck` y `git diff --check` en
verde. No se tocó `convex/**` durante este bloque, no hubo codegen, deploy,
prebuild, build, EAS, TestFlight ni App Review.

**Tercera pasada · hallazgos y cierre de la verificación de Codex.** La focal
intermedia cerró `204/204` y `git diff --check` quedó en verde, pero aparecieron
dos cosas; ambas quedaron corregidas y la repetición final cerró `211/211` más
typecheck y diff-check verdes:

1. **`pnpm typecheck` fallaba en el propio focal.** `test/sesionOfflineQA23.test.ts`
   le pasaba a `resolveLocalViewer` un literal con `confirmationTimedOut` adentro,
   y esa señal es de `SessionSignals`, no de `LocalIdentitySignals`. Se corrigió
   **sin debilitar el caso**: el estado con el plazo vencido se nombra una vez,
   tipado como `SessionSignals`, y se usa para las dos aserciones (la confianza
   degradada y que la vía del dueño sea la viva).
2. **Había una carrera material entre `clear` y `write`.** El efecto marcaba la
   identidad en memoria y arrancaba el `clear`; el render siguiente veía el
   registro vacío, decidía `write` y lo arrancaba **con el `clear` todavía en
   vuelo**. Los comentarios decían «dos pasos», pero nada los serializaba: el
   resultado dependía de cuál promesa del llavero resolviera última y una de las
   posibilidades era el `clear` borrando al dueño que el `write` acababa de
   escribir. La corrección está descrita abajo, en «La serialización».

**Los cuatro huecos que marcó Codex, y qué se hizo con cada uno.**

1. **La política sólo degradaba si Clerk publicaba `userId` en este proceso**, y
   eso no cubre el timeout COMPLETO de Clerk para una cuenta previamente válida
   —que es el caso de aceptación escrito—. Se agregó una **identidad
   previamente confirmada** en almacenamiento seguro nativo (`expo-secure-store`,
   ya instalado), con su secuencia fail-closed. Ver abajo. **Y una pieza más que
   la revisión no pidió pero sin la cual la anterior era código muerto:**
   `src/routes/v492/index.tsx` cortaba en `auth-timeout` —la pantalla de
   reintento del arranque— antes de que ningún gate opinara, y ése es exactamente
   el arranque en frío sin red. Ahora, y sólo con `degraded-local`, redirige a
   `/hoy`; para todo lo demás el bloqueo no destructivo queda igual y
   `resolveStart` no se tocó.
2. **`/editar-datos` no declaraba nada** y se apoyaba en que
   `destinationAllows("degraded", "edit-birth-data")` hoy sea `false`. Ahora
   declara `requires="confirmed-session"` y además revalida en el handler.
3. **Los tres handlers de escritura de Vínculos** quedaban autorizados por una
   implicación de render (`useLayers` desmonta el cuerpo al degradar). Ahora
   revalidan `useSensitiveOperation("account-write")` pegado a cada
   action/mutation y apagan el control con copy accesible.
4. **La cobertura de «últimos datos» estaba redondeada.** Ahora está enumerada,
   en el copy y en esta ficha.

**El defecto.** Con la sesión restaurada del llavero y sin red, la app no
distinguía «no se puede confirmar» de «no hay cuenta». Dos formas del mismo
error, las dos reproducibles leyendo el código del build 23:

1. **El spinner infinito.** `useConvexAuth` no valida el token, así que
   `liveAppGate` deja `isAuthLoading` en `true`, `resolveAccountDestination`
   contesta `loading` y `AccountGate` dibuja `MinimalLoading` para siempre. No
   hay plazo, no hay reintento y no hay salida sin matar la app.
2. **La pantalla de error sobre todo el producto.** Si `getOrCreateCurrentUser`
   agota sus tres intentos, el destino pasa a `retry` y el gate tapa la app
   entera —con todo lo de esa misma cuenta ahí en disco—.

Y una tercera pieza: aunque el shell hubiera abierto, **cada sección se habría
quedado girando**, porque `LayersProvider` deriva su fase de `sessionPhase`, que
con `isAuthLoading` responde `cargando`.

**La decisión de diseño.** Cinco estados explícitos, nunca colapsados:
`loading`, `confirmed-signed-in`, `confirmed-signed-out`,
`transient-unavailable` y `degraded-local`. La línea que **no** se cruza:
degradar no afloja la identidad. `degraded-local` exige un **dueño vigente** que
sea **exactamente** el dueño persistido del perfil (`orbita:profile-owner`) y el
de **cada snapshot local que la superficie vaya a publicar**. Un signed-out
**confirmado** sigue mandando al login y sigue sin tocar un solo byte local.

**Lo que cambió en la corrección: de dónde puede salir ese dueño.** Con una sola
fuente —el `userId` vivo de Clerk— el bloque no cubría su propio caso de
aceptación. Ahora hay dos, y la segunda no afloja la primera:

1. **Vivo.** Clerk publicó un `userId` en ESTE proceso. Cubre el corte de red con
   Clerk ya cargado: el handshake de Convex que no cierra, la fila `users` que
   agota sus intentos, el estado autoritativo que no llega.
2. **Previamente confirmado.** El último dueño que esta app confirmó de punta a
   punta, guardado en el **llavero del sistema** (`expo-secure-store`:
   Keychain/Keystore) bajo `orbita.session.last-confirmed-owner`. Cubre el
   **timeout completo de Clerk**, que es el caso real de "abro la app sin red con
   la sesión en el llavero": ahí Clerk no publica nada y con la regla anterior el
   producto entero quedaba tapado por un bloqueo.

Lo que se guarda es un `clerkUserId` —el mismo identificador público que ya vive
en claro en `orbita:profile-owner`—, **no un token**. No se lee, se copia ni se
toca nada del almacén de Clerk. No autoriza: toda operación sensible sigue
exigiendo `confirmed-signed-in`; esto sólo puede habilitar una **lectura** de lo
que ya está en el aparato.

**La secuencia fail-closed** (`secureIdentityAction`, pura y probada):

- **Escribir** sólo con `confirmed-signed-in`. Ni una espera, ni un timeout, ni
  una sesión degradada dejan una identidad nueva en disco.
- **Borrar** ante un signed-out **confirmado**, y ante **cualquier** dueño vivo
  distinto del guardado. Un cambio de identidad se resuelve en **dos pasos**
  —`clear` y recién en la vuelta siguiente `write`— para que un cierre de la app
  en el medio deje el registro vacío (que no abre nada) en vez de dejar al dueño
  anterior (que abriría lo que no debe). En el servicio, escribir es además
  `deleteItemAsync` y después `setItemAsync`, por la misma razón.
- **No tocar** en todo lo demás: un corte de red no puede alterar el disco.
- Un **error** de lectura o de escritura deja la identidad en nada, y nada no
  abre. Mientras el llavero **no contestó**, el vínculo local es `unknown`: no se
  muestra un solo dato antes de terminar de hidratar esta identidad.
- Un registro **versionado** que no se entiende se lee como ausencia. No hay
  migración: perder la identidad previa cuesta un bloqueo con reintento, aceptar
  un formato desconocido costaría mostrar los datos de otra cuenta.

**La serialización (tercera pasada).** `secureIdentityAction` contesta sobre un
registro **quieto**, y entre que una operación arranca y que el llavero contesta
el registro no es ni lo viejo ni lo nuevo. Preguntar ahí calcula la respuesta
contra un disco que ya no existe, y eso es lo que hacía que los «dos pasos»
fueran uno con dos resultados posibles. Ahora el estado del registro se modela
entero y las dos preguntas se hacen sobre él, las dos puras y probadas:

- **`SecureIdentitySlot`** = `{ hydrated, busy, error, owner }`. `hydrated` es
  «la lectura inicial contestó»; `busy` es «hay UNA operación en vuelo».
- **`publishSecureIdentity(slot)`** es lo único que ve la política de sesión.
  Con la lectura sin terminar, con una operación en vuelo o con el llavero roto:
  `ready: false` (o `error: true`) y **`owner: null`**. Sólo un registro quieto y
  confirmado publica un dueño, así que **durante la transición no se puede abrir
  el shell degradado con la identidad previa**.
- **`nextSecureIdentityStep({ slot, confidence, liveOwner })`** es lo único que
  autoriza una operación, y agrega tres puertas a la política de siempre: no
  decide sin la lectura, **no arranca una segunda operación mientras hay una en
  vuelo**, y no vuelve a tocar un llavero que falló. Sobre un registro quieto
  contesta exactamente lo mismo que `secureIdentityAction` —hay una prueba que lo
  fija— así que no es una segunda política.
- En el provider, un **candado en `useRef`** (`enVuelo`) toma antes de cualquier
  otra cosa y se suelta **siempre**, incluso si el árbol se desmontó: un candado
  tomado para siempre dejaría el llavero muerto y con él la degradación offline.
  Un resultado que llega tarde al **mismo árbol vivo se aplica igual** —es el de
  la única operación que hubo—; lo único que se descarta es publicar sobre un
  árbol que ya no está. La lectura inicial sólo puede **hidratar**: si contesta
  después de que este proceso escribió o borró, manda lo que se hizo.
- Nada de esto usa timers ni depende del orden en que resuelvan las promesas:
  con una sola operación posible por vez, no hay carrera que ordenar. El `write`
  de un cambio de identidad lo decide el render que ve el `clear` **ya
  terminado**. Y cualquier fallo —promesa rota o resultado negativo— deja
  `BROKEN`, que no publica dueño y por lo tanto no abre nada.

**En web no existe.** `localStorage` es legible y escribible por cualquier script
del origen, así que guardar ahí "el último dueño confirmado" no sería una prueba
de identidad sino un valor que decide qué se muestra y que cualquiera puede
poner. `src/services/secureIdentity.web.ts` declara
`SECURE_IDENTITY_SUPPORTED = false` y contesta siempre "no hay registro": sin
`userId` vivo, el navegador **conserva el gate**, exactamente como antes del
bloque.

**Los tres casos que jamás abren, dicho una vez:** cuenta B confirmada mirando el
perfil de A; perfil sin dueño (invitado o legado); snapshot sin dueño o de otra
cuenta. Y uno más que la corrección agregó: Clerk que afirma `isSignedIn` sin
publicar `userId` — ahí no se cae al dueño previo, porque atribuirle a una sesión
nueva la identidad de la vieja es justamente lo que no puede pasar.

**Qué se hizo.**

- **`src/domain/sessionResilience.ts` (nuevo)** — la política, pura y sin React:
  `resolveSessionConfidence` (los cinco estados), `resolveLocalViewer` (de dónde
  sale el dueño vigente: `live` / `secure-prior` / `pending` / `none`),
  `resolveLocalIdentity` (seis vínculos: `unknown` / `none` / `unowned` /
  `unproven` / `foreign` / `secure`, con `unproven` y `foreign` separados a
  propósito), `publishableViewer` (el dueño con el que se puede publicar un dato:
  un dueño previo sólo vale si la identidad local entera cerró contra él),
  `sensitiveOperationAllowed` sobre una tabla operación → confianza declarada una
  por una, `sensitiveOperationBlockMessage`, `surfaceOpensUnderConfidence`,
  `applySessionResilience`, `ownedDataReadable`, `sessionPhaseUnderConfidence` y
  el copy. `SESSION_CONFIRMATION_TIMEOUT_MS = 8000`, el **mismo** plazo que ya
  usaban la raíz y el gate de las pestañas para el `isLoaded` de Clerk. Las
  señales nuevas de la identidad previa son **opcionales con default cerrado**:
  quien no la declara no puede abrir por ella.
- **`src/domain/secureIdentity.ts` (nuevo, corrección)** — el registro previo,
  puro: clave, versión, `serializeSecureIdentity`, `parseSecureIdentity` (todo lo
  que no se entiende es ausencia; sin migración) y `secureIdentityAction`, que es
  la secuencia fail-closed entera —`keep` / `write` / `clear`— y converge en un
  máximo de dos pasos para toda combinación. **En la tercera pasada se le sumó el
  estado del registro y sus dos preguntas**, también puras: `SecureIdentitySlot`
  con sus constructores (`SECURE_SLOT_HYDRATING`, `SECURE_SLOT_EMPTY`,
  `SECURE_SLOT_BROKEN`, `secureSlotSettled`, `secureSlotBusy`),
  `publishSecureIdentity` (qué se le puede decir a la política; `null` en las
  tres esperas) y `nextSecureIdentityStep` (qué operación se puede arrancar;
  ninguna mientras haya una en vuelo). El módulo sigue sin importar runtime.
- **`src/services/secureIdentity.ts` + `.web.ts` (nuevos, corrección)** — el
  adaptador. Nativo: `expo-secure-store`, ninguna función tira (un llavero que no
  contesta es una respuesta, y la más restrictiva), y escribir es borrar y
  después escribir. Web: no-op que declara `SECURE_IDENTITY_SUPPORTED = false` y
  no arrastra `expo-secure-store` al bundle.
- **`src/hooks/useSessionResilience.tsx` (nuevo)** — el provider: **un** plazo,
  **una** `onboarding.getCompletionStatus` y **una** lectura del llavero para
  todo el árbol. La consulta vivía dentro de `useAccountDestination`, que se monta
  en cada `AccountGate`: había una suscripción y un `setTimeout` por gate, y con
  ellos dos ideas distintas de «la cuenta ya resolvió». Expone `confidence`,
  `completion`, `viewer` y `retry`, más el azúcar `useSensitiveOperation(op)`. El
  `retry` **no** rearma el plazo en el shell degradado: hacerlo lo devolvería a un
  spinner y desmontaría lo que la persona está leyendo. La reconexión no necesita
  el botón: cuando Convex vuelve a validar el token y la fila queda lista, la
  confianza pasa sola a `confirmed-signed-in` y el aviso desaparece **sin
  reiniciar**. En la corrección se le sumó: la hidratación única del llavero, el
  efecto que aplica la política del registro (bajando la identidad en memoria
  **antes** de tocar el disco), `viewer` derivado de `publishableViewer` y el
  dueño del snapshot del plan declarado en `snapshotOwners` cuando la vista
  efectiva viene del caché. **En la tercera pasada se serializó ese efecto**: un
  solo estado `slot`, publicado con `publishSecureIdentity`; la decisión pasa por
  `nextSecureIdentityStep`; el candado `enVuelo` impide arrancar una segunda
  operación y se suelta siempre; `montado` distingue «resultado tardío del árbol
  vivo» (se aplica) de «árbol desmontado» (no se publica); y la lectura inicial
  ya no puede pisar lo que este proceso escribió. Se fue el `vivo = false` por
  corrida del efecto, que cancelaba resultados del árbol vivo y era la mitad del
  problema.
- **`src/domain/accountDestination.ts`** — un destino nuevo, `degraded`, y una
  sola línea en `destinationAllows`: lo admite `app` y nadie más. `landing`,
  `auth`, `onboarding` y `edit-birth-data` conservan su gate. El resolver **no
  cambió**: la resiliencia se aplica después, en `useAccountDestination`, y sólo
  degrada `loading` y `retry`. Un destino resuelto —`sign-in`, `onboarding`,
  `bootstrap`— manda siempre.
- **`src/components/orbita/AccountGate.tsx`** — resuelve la sesión sin confirmar
  **antes** que nada y **nunca redirige** por ella. Con identidad segura y
  superficie permitida abre con `DegradedSessionBanner` arriba; si la ruta
  declara `requires="confirmed-session"`, no abre. Sin identidad segura muestra
  el bloqueo con reintento, con el motivo dicho según lo que la superficie
  esperaba (donde hace falta cuenta: «no mostramos datos que no podemos
  verificar»; en landing/login/alta: «no pudimos conectar»). **`sticky` manda
  igual que en `loading`**: un corte de red en el paso 13 del alta no puede
  desmontar el flujo con la cuenta recién creada.
- **`src/components/orbita/SessionNotice.tsx` (nuevo)** — la franja y la pantalla
  de bloqueo. Cero colores a mano: todo sale de `@/theme/boot` (QA23-006). Región
  viva `polite` + `accessibilityRole="alert"`, botón real con rol, etiqueta,
  pista y `minHeight: 44`, y la franja respeta el inset superior porque se dibuja
  sobre un shell sin header.
- **Bloqueos de escritura.** `/paywall` declara `requires="confirmed-session"`
  (apaga de una vez Offering, compra, restore y Customer Center); el Perfil
  bloquea `Eliminar mi cuenta` **en la vista y en el handler**, con `disabled`,
  `accessibilityState` y el motivo escrito arriba del botón.
  `ManageSubscriptionBlock` no necesitó gate nuevo: ya deriva del **remoto**, que
  sin sesión viva es `undefined` y deja la vista en `loading` — se fijó con una
  prueba para que nadie lo mueva a la vista efectiva (que incluye el snapshot).
- **`app/editar-datos.tsx` (corrección).** Declara
  `requires="confirmed-session"` **por sí misma**, y no por la coincidencia de
  que `destinationAllows("degraded", "edit-birth-data")` hoy sea `false`: ampliar
  esa superficie mañana por cualquier otro motivo abriría el editor con la sesión
  sin confirmar sin que nadie lo note. Además `EditarDatosSurface` consulta
  `useSensitiveOperation("natal-edit")` **en cada render** y revalida **dos
  veces** en el handler (al entrar y pegado a la escritura remota, que está
  detrás de un `await` del candado), porque el gate decide al montar y esta
  pantalla vive minutos: la conexión se puede caer con el editor ya abierto.
  Cuando pasa, `Guardar` se apaga y el motivo se anuncia con `alert` + región
  viva; lo tipeado no se pierde y el `Reintentar sincronización` sigue vivo,
  porque es la salida. Sin envs no hay cuenta que confirmar y el editor local no
  se bloquea.
- **Vínculos, defensa en profundidad (corrección).** Los tres puntos donde esa
  sección escribe en la cuenta —`savePerson` en `VinculosConnectScreen`, y
  `refreshComparison` (que **persiste** un sobre nuevo, no es una lectura) y
  `removePerson` en `VinculosResultScreen`— revalidan
  `useSensitiveOperation("account-write")` justo antes de la action/mutation, y
  no una sola vez: `savePerson` vuelve a preguntar después del `await` que
  resuelve la zona horaria, y `removePerson` después del `await` de la
  confirmación destructiva, que dura lo que la persona tarde en decidir.
  `useLayers` normalmente desmonta esos cuerpos al degradar, pero un handler no
  puede quedar autorizado por una implicación de render. Los controles se apagan
  con `disabled`, `accessibilityState` y `accessibilityHint`, y el motivo se
  anuncia una vez por pantalla. Salir al perfil ya guardado —que no escribe— sigue
  disponible. El ciclo automático de recálculo **no** marca su clave como pedida
  cuando está bloqueado: si la marcara, al reconectar no volvería a intentarlo
  solo. El bloque 4 (tipo de vínculo, `romantic` y demás) quedó intacto.
- **`src/routes/v492/index.tsx` (corrección).** El arranque nativo tenía su
  propio plazo y su propia salida: `resolveStart` contesta `auth-timeout` y esa
  pantalla de reintento tapaba el producto entero. Es el arranque en frío sin
  red, o sea el caso que la identidad previa existe para cubrir, así que sin
  tocarla el resto del bloque nunca se llegaba a ver. Ahora ese caso —y **sólo**
  ese— consulta la confianza: con `degraded-local` redirige a `/hoy` y el shell
  abre con su franja; con cualquier otra cosa conserva el bloqueo tal cual.
  `resolveStart` **no cambió** y el plazo sigue sin disfrazarse de «cargado». La
  variante web no se tocó: allá no hay identidad previa, así que `degraded-local`
  sólo puede salir de la vía viva, que no produce `auth-timeout`.
- **`src/hooks/useLayers.tsx`** — la fase pasa por `sessionPhaseUnderConfidence`,
  así que con la sesión sin confirmar **cada sección muestra su error y su
  reintento** en vez de un spinner eterno, y `retrySession` pasa a ser el
  `retry` de la resiliencia.
- **`app/_layout.tsx`** — `SessionResilienceProvider` montado una sola vez,
  dentro de `AppStateProvider` (necesita el dueño del perfil), dentro de
  `EntitlementProvider` (declara el dueño del snapshot del plan) y envolviendo al
  `Stack` (todo `AccountGate` vive adentro). **La lista de `Stack.Screen` no se
  movió**: ningún deep link cambia.

**«Últimos datos», enumerado (corrección).** El aviso decía «lo último que
guardamos en este teléfono», que es cierto pero incompleto, y la parte que
faltaba es la que genera la decepción. Esto es lo que hay, exactamente:

*Persistido en el dispositivo y publicable en un arranque sin red* —siempre que
el dueño cierre contra la identidad segura—:

| Dato | Clave | Alcance |
|---|---|---|
| Perfil local (nombre, fecha, hora, lugar, signo) | `orbita:profile` | global, atribuido por `orbita:profile-owner` |
| Dueño del perfil | `orbita:profile-owner` | es el que se compara |
| Lecturas guardadas y sus lápidas | `orbita:saved-readings`, `orbita:saved-readings-tombstones` | global, se archiva por cuenta al cerrar sesión |
| Diario | `orbita:journal` | ídem |
| Snapshot del plan (`isPro`) | `orbita:entitlement-snapshot:<owner>` | **por cuenta**, con el dueño también dentro del valor |

*Sin snapshot local, por lo tanto con bloqueo y reintento por sección:* las capas
del día y de ayer (`layers.getForDate`), las capas natales, la carta
(`charts.current`), la lectura del día (`readings.getToday`), el `birthData`
remoto, la lista de personas de Vínculos y toda comparación
(`relationships.list` / `getComparison`), y el Cumpleluna. **Convex no persiste
nada de eso en el dispositivo**, así que no hay un «último valor» que mostrar y
el aviso no lo promete: `sessionPhaseUnderConfidence` pasa la fase a `error` y
cada sección dibuja su `ErrorBlock` con reintento.

Dos precisiones sobre el snapshot del plan, que es el único que se integra:

1. Es **owner-scoped y validado** (`parsePlanSnapshot` exige que el dueño de
   adentro sea el vigente) y **no se migró nada**: ya existía desde QA23-001.
2. Bajo un **timeout completo de Clerk no aparece**, y eso es correcto: se lee
   con `readEntitlementSnapshot(owner)` y sin `userId` vivo no hay `owner`, así
   que la vista efectiva queda en `undefined`, `labelReady` en `false` y el chip
   del plan **no se dibuja**. Sólo aparece en la degradación con Clerk vivo
   (handshake de Convex caído). Por eso el copy dice que el plan «se calcula en
   tu cuenta» en vez de prometerlo.

El copy vive en `DEGRADED_SESSION_COVERAGE`, se dibuja en la franja y entra en su
`accessibilityLabel`.

**Pruebas escritas · NO EJECUTADAS.**

| Archivo | Qué fija | Estado |
|---|---|---|
| `test/sesionOfflineQA23.test.ts` (reescrito en la corrección) | **Conducta pura:** los cinco estados y que no se colapsen; la **matriz completa de 73 728 combinaciones** (las 3072 anteriores × las 24 de la identidad previa) con seis invariantes —confirmar exige todas las piezas y ninguna es local; degradar exige un dueño vigente igual al del disco por una de **dos** vías declaradas, y la vía previa sólo con llavero soportado, leído, sin error y con Clerk sin publicar sesión; un signed-out confirmado sólo sale de un Clerk cargado; nada que no sea confirmar autoriza una operación; con dueños distintos no se abre nada, venga el dueño de Clerk o del llavero; y el llavero a medio leer no decide nada—, más la comprobación de que las **dos** vías se ejercitan de verdad. El caso de aceptación (timeout completo + dueño previo) y sus cinco negativas: web, llavero ilegible, llavero sin contestar, sin registro y registro de otra cuenta. Cuenta B confirmada contra perfil de A. Clerk con `isSignedIn` sin `userId`. Snapshots ambiguos —ajeno, sin dueño y mezclado— por las dos vías. El formato del registro (versionado, sin migrar, con catorce entradas de basura) y la clave válida para `expo-secure-store`. La secuencia fail-closed: quién puede escribir, qué borra un signed-out confirmado, el cambio de identidad en dos pasos, que un corte de red no toca el disco y que **toda** combinación converge en ≤ 2 pasos. `ownedDataReadable` y `publishableViewer`. El producto cartesiano operación × confianza y el copy de cada bloqueo. `applySessionResilience` sobre los ocho destinos × cinco confianzas; que `degraded` sólo monte `app`; `surfaceOpensUnderConfidence`; la regresión de `resolveAccountDestination`; la fase por sección; y la cobertura declarada (que nombre perfil, guardadas y diario, y que **no** prometa capas). **Cableado:** gate, layout (incluida la anidación dentro de `EntitlementProvider`), provider (las cuatro señales, la hidratación, la acción y el orden memoria-antes-que-disco), llavero nativo (no menciona Clerk ni token; borra antes de escribir; tres `catch`), llavero web (sin `expo-secure-store` y sin `localStorage`), **el arranque nativo (que `auth-timeout` deje pasar sólo a `degraded-local` y conserve su bloqueo para todo lo demás, con `resolveStart` intacto)**, pago, **editor natal (`requires` + dos revalidaciones + control apagado)**, **los tres handlers de Vínculos (conteo exacto de revalidaciones + controles apagados + el ciclo automático)**, Perfil, gestión de suscripción, capas y accesibilidad del aviso. **Tercera pasada:** la **serialización** del llavero, ejecutada de verdad sobre la política pura —un bucle que reproduce el orden del provider (un render decide un paso, el paso marca el registro en vuelo, el llavero contesta, recién ahí se decide el siguiente) y comprueba en cada vuelta que con una operación en vuelo la política contesta `keep`; el cambio de identidad sale exactamente como `["clear", "write"]` y en las dos transiciones lo publicado es `{ ready: false, owner: null }`; ninguna combinación de cinco confianzas × tres dueños vivos × cinco registros iniciales × tres llaveros (el que anda, el que falla al borrar y el que falla al escribir) arranca dos operaciones, deja el registro en vuelo, se cuelga ni termina con un dueño que no sea el vivo; con el registro quieto `nextSecureIdentityStep` contesta lo mismo que `secureIdentityAction` para las 45 combinaciones, y no contesta otra cosa que `keep` en las tres esperas; a nivel de sesión, el instante de la transición **no** degrada (queda `transient-unavailable`) y el mismo caso con el registro quieto sí; y un llavero roto no abre ni se reintenta. **Cableado nuevo:** el candado tomado antes de nada y soltado siempre, el resultado tardío que igual se aplica al árbol vivo, la lectura que sólo hidrata, y que el archivo no tenga más `setTimeout` que el del plazo ni un `Promise.all/race`. | **escrito, sin ejecutar** |

**Lo que estas pruebas NO afirman**, escrito también en el encabezado del
archivo: no reemplazan apagar el wifi con la app abierta (el comportamiento real
de Clerk sin red sólo se ve en un teléfono), no prueban `expo-secure-store` de
verdad —qué devuelve tras reinstalar, tras un restore de backup o con el
dispositivo bloqueado es una prueba de dispositivo—, y no montan React: los
bloqueos se comprueban leyendo el código, así que fijan que el handler revalide y
que el control se apague, no cómo se ve.

**Comandos que Codex tiene que correr.**

1. `pnpm typecheck`
2. `npx tsx --test test/sesionOfflineQA23.test.ts`
3. Focal de regresión vecina: `npx tsx --test test/arranqueVisualQA23.test.ts test/planIndicatorQA23.test.ts test/layersV492Runtime.test.ts test/vinculosQA22.test.ts test/vinculosReadingQA22.test.ts test/relationshipsV492.test.ts test/v492ReleaseP1.test.ts test/responsiveShells.test.ts`
4. `git diff --check`

**Riesgos anotados.**

1. **Nada de esto se ejecutó.** Es el riesgo principal del bloque: el código y
   las pruebas están escritos y sin una sola corrida. Cualquier detalle de
   tipos —el `satisfies` de `SESSION_CONFIDENCES`, el estrechamiento de
   `liveOwner` dentro del ternario del efecto— aparece recién en
   `pnpm typecheck`.
2. **Regresión posible en pruebas vecinas.** Se tocaron `useAccountDestination`
   (perdió su `useQuery`), `useLayers` (fase y `retrySession`), `AccountGate`,
   `app/_layout.tsx` y `accountDestination`. Si alguna prueba existente lee esas
   fuentes esperando la forma anterior, falla por forma y no por conducta.
   `arranqueVisualQA23` se revisó por lectura y no debería moverse: no se agregó
   ningún color, ningún `router.push`, ningún `Link` y la lista de rutas del
   `Stack` quedó igual.
3. **El plazo de 8 s es una elección, no una medida.** Se eligió por coherencia
   con el `CLERK_LOAD_TIMEOUT_MS` que ya existía. Cuánto tarda de verdad Clerk
   sin red sólo se sabe apagando el wifi en un teléfono.
4. **El `retry` del shell degradado puede no hacer nada visible.** Si Convex
   nunca autenticó, `SessionProviderInner` ni siquiera intenta `ensureUser`, así
   que el botón sólo re-dispara la evaluación. La reconexión real la trae el
   websocket de Convex por su cuenta. Es honesto (no promete un plazo) pero no
   es un botón que «arregle».
5. **El paywall web queda fuera.** `/paywall` en web es el lanzador de checkout
   de Stripe y no pasa por `AccountGate`; la regla nueva cubre la ruta nativa.
   Web no es la superficie de esta build.
6. **`transient-unavailable` cambia lo que se ve en la landing web y en el alta
   offline.** Antes era un spinner sin fin; ahora es un bloqueo con reintento.
   Es mejor, pero es un cambio de conducta visible que conviene mirar.
7. **La API de `expo-secure-store` se usó sin poder compilarla.** Sólo
   `getItemAsync` / `setItemAsync` / `deleteItemAsync`, sin opciones, para no
   apoyarse en constantes cuyo nombre no se pudo verificar. La clave evita `:`
   porque el módulo sólo admite alfanuméricos, `.`, `-` y `_`; una clave inválida
   haría fallar la escritura en el dispositivo y ese fallo se leería para siempre
   como «no hay identidad previa» (fail closed, pero sin cubrir el caso).
   Verificar en un teléfono, y verificar también que el módulo nativo esté en el
   binario: `expo-secure-store` ya estaba en `package.json`, pero esta es la
   primera vez que la app lo importa.
8. **La matriz pasó de 3072 a 73 728 combinaciones.** Sigue siendo una función
   pura y los mensajes caros se construyen sólo al fallar (`assert.fail`), pero
   es el test más lento del archivo y conviene mirar su tiempo.
9. **`viewer` cambió de significado.** Antes era el `userId` de Clerk; ahora es
   `publishableViewer`, que además puede ser el dueño previo cuando la identidad
   local cerró entera. Todo caso que antes devolvía un valor sigue devolviendo el
   mismo; lo nuevo es que a veces devuelve algo donde antes devolvía `null`. Si
   algún consumidor lo usara como argumento de query, habría que mirarlo.
10. **Durante la transición la degradación no está disponible.** Mientras un
    `clear` o un `write` viajan, lo publicado es `ready: false` y `owner: null`,
    así que si en ese milisegundo venciera el plazo la respuesta sería
    `transient-unavailable` (bloqueo con reintento) y no el shell degradado. Es
    la elección correcta —el registro está en un estado que el proceso no
    conoce— pero es una ventana en la que el modo degradado no aparece. Dura lo
    que tarde el llavero, y sólo puede abrirse con Clerk vivo, que es justamente
    el caso en el que el dueño sale de la vía viva y no del registro.
11. **El fallo del llavero es terminal dentro del proceso.** Un `read`, `write` o
    `clear` que falla deja `BROKEN` y nada vuelve a tocar el llavero hasta la
    próxima apertura de la app. Es a propósito: reintentar en bucle no arregla un
    llavero roto y cada intento sería otra escritura sobre un registro que ya no
    sabemos cómo quedó. La consecuencia real es que un `clear` fallido puede
    dejar el registro viejo en disco hasta el próximo arranque; no abre nada
    —`BROKEN` no publica dueño— y en el flujo de logout es inocuo porque
    `resetApp()` borra el perfil local y sin perfil no hay nada que atribuir.
    Tampoco se reintenta el `write` después de una lectura fallida, que es la
    única conducta que la tercera pasada cambió acá: antes ese caso escribía.
12. **Un llavero que nunca contesta deja el registro en vuelo para siempre.** No
    hay plazo, y es deliberado: un timer sobre `expo-secure-store` sólo podría
    inventar una respuesta que el disco no dio. Si una promesa colgara, la
    identidad previa queda no publicable el resto del proceso —fail-closed,
    cuesta un bloqueo con reintento— y el resto de la app no depende de ella.
13. **La serialización se probó sobre la política pura, no montando React.** El
    bucle de la prueba reproduce el orden del provider (decidir → marcar en vuelo
    → contestar → decidir), y el cableado se fija leyendo el archivo. Lo que
    **no** se ejercita es el doble efecto de `StrictMode` ni el render
    concurrente; el candado en `useRef` está justamente para eso, pero es la
    parte que sólo se ve corriendo la app.
14. **`useSessionResilience` ahora depende de `useEntitlement`.** El orden del
    layout raíz lo sostiene (`EntitlementProvider` envuelve a
    `SessionResilienceProvider`) y hay una prueba que lo fija, pero es un
    acoplamiento nuevo entre dos providers: mover uno rompe el otro.
15. **El arranque nativo tiene una salida nueva.** `auth-timeout` con
    `degraded-local` redirige a `/hoy` en vez de mostrar el bloqueo. El shell no
    devuelve a `/`, así que no hay bucle posible, pero es la conducta de arranque
    más visible del bloque y es la que hay que mirar primero en el teléfono:
    apagar el wifi, matar la app y abrirla. Si Clerk **sí** resuelve desde su
    caché sin red, el camino que se ejercita es el vivo y no el previo, y esta
    línea no se ejecuta.
16. **`test/sessionStart` y compañía no se tocaron, pero el archivo sí.**
    `src/routes/v492/index.tsx` cambió de forma (un import y una rama). Si alguna
    prueba estructural del arranque lee ese archivo esperando la forma anterior,
    falla por forma y no por conducta.
17. **El provider volvió a cambiar de forma en la tercera pasada.** `secure` pasó
    de estado a valor derivado (`slot` + `publishSecureIdentity`) y se fueron
    `setSecure`, `SECURE_IDENTITY_NONE` y compañía. Las aserciones estructurales
    que leían esas líneas están actualizadas en `sesionOfflineQA23`; si alguna
    otra prueba leyera `src/hooks/useSessionResilience.tsx` esperando la forma
    anterior, falla por forma y no por conducta.

**Próximo paso.** Bloque 8 (cierre técnico), después de que Codex verifique este.

### Bloque 6 · arranque visual coherente (QA23-006) · VERIFICADO

**Estado.** Implementación completa y verificada en el árbol de trabajo, **sin
commit**. La tanda focal cerró **41/41**, `pnpm typecheck` y `git diff --check`
cerraron en verde. No se tocó `convex/**`, no hubo codegen, deploy, prebuild,
build, EAS, TestFlight ni App Review.

**El defecto.** Abrir la app mostraba tres cosas que no son Órbita, en este
orden.

1. **El splash blanco.** `app.json` no declaraba el fondo del splash ni el del
   root view, así que el color lo ponía el template nativo.
2. **Frames claros.** Los gates que se dibujan antes de que haya producto
   pintaban `theme.colors.background` —el crema `#fff8f0` del MVP legado, no el
   `#0A0B0E` del producto— con el spinner en `theme.colors.plum`, que sobre el
   fondo de Órbita es casi invisible. Y el `Stack` raíz no declaraba
   `contentStyle`, así que cada hueco entre gates lo llenaba el fondo claro del
   tema por defecto de React Navigation. En el camino feliz se ven al menos dos:
   el boundary de eliminación pendiente mientras lee el disco, y la espera del
   gate de las tabs.
3. **Un deslizamiento lateral.** `<Redirect>` es un `replace`, y el stack nativo
   anima un replace como un `pop`: la primera pantalla real entraba desde el
   costado, como si alguien hubiera tocado «volver». No es una transición entre
   pantallas: es la app decidiendo a dónde va, y decidir no se anima.

**Qué se hizo.**

- **`src/theme/boot.ts` (nuevo)** — el arranque tiene **un color y cero
  movimiento**, y los dos viven acá: `BOOT_BACKGROUND` (= `orbita.colors.background`
  = `v492.colors.background`, así que entrar al producto no cambia un punto de la
  pantalla), `BOOT_TEXT` / `BOOT_TEXT_MUTED` / `BOOT_ACCENT` para que repintar el
  fondo no deje el texto oscuro sobre oscuro, `BOOT_STATUS_BAR_STYLE`,
  `BOOT_SCREEN_OPTIONS` y `BOOT_GATE_ROUTES`. Módulo puro: no importa nada de
  React Native, así que las pruebas lo ejecutan.
- **`app/_layout.tsx`** — la barra de estado pasa de `dark` a
  `BOOT_STATUS_BAR_STYLE`; el `Stack` estrena `contentStyle` con el fondo del
  arranque; el fondo se declara **además** en el nodo más alto del árbol
  (`SafeAreaProvider`), que es lo que se ve entre que el splash se retira y el
  primer gate monta; y las **cuatro** rutas del arranque —`index`, `onboarding`,
  `iniciar-sesion`, `(tabs)`— reciben `options={BOOT_SCREEN_OPTIONS}`. Ninguna
  otra pantalla del `Stack` declara opciones: el pago, las lecturas, la carta
  completa, la recepción y el editor conservan su animación. **La lista de
  `Stack.Screen` no cambió**, así que ningún deep link se movió.
- **Los seis gates repintados** — `src/components/PendingDeletionBoundary.tsx`,
  `src/components/orbita/AccountGate.tsx`, `src/routes/v492/index.tsx` y su
  `.web.tsx`, `src/routes/v492/tabs-layout.tsx` y su `.web.tsx`. Ninguno importa
  ya `@/theme/theme` y **ninguno escribe un color a mano**: fondo, titular,
  cuerpo, spinner y borde de reintento salen todos de `@/theme/boot`. El
  `sceneStyle` de las tabs deja de repetir el literal `#0A0B0E` y usa el token.
- **`AccountGate` estrena `BootSurface`.** `MinimalLoading` y `ErrorState` son
  bloques de CONTENIDO —están escritos para caer dentro de un shell que ya puso
  el fondo— y el gate los montaba sueltos: `/onboarding` y `/iniciar-sesion` no
  le pasan un `loading` propio, así que el color lo ponía lo que hubiera detrás.
  Las superficies que sí traen el suyo (`WebLoading`, la espera de las tabs) no
  pasan por ahí y no cambian.
- **`app.json`** — `backgroundColor`, `ios.backgroundColor`,
  `android.backgroundColor`, `splash.backgroundColor`, `ios.splash`,
  `android.splash` y `androidNavigationBar` (`light-content` + `#0A0B0E`), todos
  con el mismo valor. `userInterfaceStyle` ya era `dark`. **No se tocaron
  `version` ni `ios.buildNumber`:** el RC 1.0.0 (23) sigue siendo el binario que
  existe. El ícono adaptativo de Android queda en `#0D0E12` —es el lanzador, no
  el arranque—.
- **Accesibilidad.** Cambio de color solamente: los dos reintentos de la raíz
  conservan `accessibilityRole="button"` y su `hitSlop`, el bloqueo conserva su
  botón de 44 y su enlace a soporte, y no se movió un copy. Los tres colores
  nuevos se miden contra el fondo: **17,0:1** el titular, **8,9:1** el cuerpo y
  **8,1:1** el cobre suave del spinner y del reintento.

**Pruebas verificadas.**

| Archivo | Qué fija | Estado |
|---|---|---|
| `test/arranqueVisualQA23.test.ts` (nuevo) | Que el color del arranque sea el del shell; que el crema legado fuera literalmente un frame claro (18:1) y que repintar sólo el fondo habría dejado texto y spinner por debajo de 3:1; el contraste real de los tres colores nuevos; que ningún gate lea el tema legado ni escriba un color a mano; la superficie propia de los estados por defecto de `AccountGate`; splash, root view, barra de estado y barra de navegación en `app.json`, con un solo color y sin mover `version`/`buildNumber`; que las cuatro rutas del arranque —y sólo ellas— reemplacen sin animación; que los stacks de pestaña conserven `slide_from_right` y su respeto por «Reducir movimiento»; que ningún gate apile ni ofrezca navegación; la lista completa de rutas del `Stack` raíz y el esquema `orbita` (deep links); la regresión de QA23-001 más la regla nueva de que ningún gate nombra un plan; y los roles y objetivos táctiles de los gates. | PASS dentro de la tanda focal 41/41 |

Regresiones vecinas revisadas por lectura; la tanda focal ejecutada incluyó
`planIndicatorQA23`, `planIndicatorQA22`, `gatesQA22`, `accountGate` y
`pendingDeletionBoundary`:
`test/responsiveShells.test.ts` deja `app/_layout.tsx` fuera de su barrido de
lienzo y no mira la barra de estado; `test/v492ReleaseP1.test.ts` recorre el
grafo nativo desde `app/**` —`src/theme/boot.ts` entra y no nombra nada ajeno—;
`test/v492CopyA11y.test.ts` barre `src/components/v492/**` y `src/screens/v492/**`,
que esta pasada no toca; `test/nativeDefectsV492.test.ts` y
`test/tabPressV492.test.ts` leen la barra de pestañas y el editor, intactos; y
`test/planIndicatorQA23.test.ts` fija `labelReady` y las dos variantes del chip,
que tampoco se movieron.

**Riesgos anotados.**

1. **La suite completa todavía no se corrió.** La focal cubre el bloque y sus
   regresiones directas; el cierre integral pertenece al bloque 8.
2. **El launch screen sale de `prebuild`, no del bundle.** El color declarado en
   `app.json` cambia el fingerprint y **exige un build nuevo** para verse; esta
   tanda no construye. Además `expo-splash-screen` **no figura en
   `package.json`**: `backgroundColor` / `ios.backgroundColor` los aplica el core
   de `@expo/config-plugins` (root view), pero si este SDK ignorara la clave
   legada `splash`, para pintar el launch screen habría que agregar ese paquete e
   instalarlo — y eso desincroniza el lockfile, así que queda fuera de alcance y
   se anota acá en vez de hacerse a medias.
3. **`editar-datos` conserva su animación a propósito.** Es destino de gate en un
   caso de recuperación (cuenta preexistente incompleta), pero también es la
   navegación normal desde el Perfil; apagarle la transición rompería lo segundo
   para arreglar un camino raro. Queda anotado como decisión, no como olvido.

**Próximo paso.** Bloque 7.

### Bloque 5 · perfil canónico y comparación como ruta hija (QA23-005) · VERIFICADO

**Estado.** Implementación frontend completa y verificada en el árbol de
trabajo, **sin commit**. La tanda focal cerró **116/116**, `pnpm typecheck` y
`git diff --check` están en verde. No se tocó `convex/**`, no hubo codegen,
deploy, build ni publicación.

**El defecto.** `/vinculos/[profileId]` **era** la comparación y el guardado
volvía a la raíz global con `?guardada=<id>` (QA22-015). Juntas, las dos cosas
dejaban al alta sin superficie propia: quien acababa de cargar a alguien
aterrizaba en una lista donde su persona es una fila más, y lo único que la
nombraba era una lectura que la raíz **arrancaba sola** —así que guardar y
calcular volvían a verse como una sola espera, que es justo lo que QA22-016 había
separado—.

**Qué se hizo.**

- **`src/screens/v492/VinculosProfileScreen.tsx` (nuevo)** — el perfil canónico.
  Muestra los datos tal como quedaron guardados (`relationshipBirthLine`, nivel
  con su rótulo y su nota) y el tipo **declarado o legacy**
  (`relationshipTypeLine`, chip, y `DEFINIR TIPO DE VÍNCULO` **no bloqueante**
  sólo cuando es `null`). Ofrece **exactamente dos** acciones primarias —`VER LA
  COMPARACIÓN` y `EDITAR DATOS`—. **No monta `getComparison`, `refreshComparison`,
  `useAction` ni `useEffect`:** entrar acá —o aterrizar acá al guardar— no
  arranca ningún cálculo.
- **Ownership antes que cualquier dato.** El `profileId` de la URL se resuelve con
  `findRelationshipProfile(personas, profileId)` contra `relationships.list`
  —la misma conversión autorizada que usan el formulario y la comparación—:
  `undefined` mientras la lista viaja, `null` para un id ajeno, borrado o
  inventado. El bloque del id no autorizado **no lee un solo campo de la persona**
  y ofrece volver a la lista. Cero `as Id<…>`.
- **Rutas.** `app/(tabs)/vinculos/[profileId]/comparacion.tsx` (nuevo, wrapper) →
  `src/routes/v492/vinculos-comparacion.tsx` / `.web.tsx` (nuevos).
  `src/routes/v492/vinculos-perfil.tsx` pasa a montar el perfil. Los destinos
  viven en el dominio: `relationshipProfileHref` y `relationshipComparisonHref`
  (nuevos en `src/domain/relationships.ts`), y ninguna pantalla arma una URL de
  Vínculos a mano.
- **Post-guardado.** `relationshipSavedHref` devuelve
  `/vinculos/<id>?modo=alta|edicion`: el id es el **segmento** —el que devolvió el
  backend— y lo único que viaja como parámetro es el modo.
  `VinculosConnectScreen` navega con `router.replace(destino)` (antes
  `dismissTo`): el perfil puede o no estar en el stack —se edita desde la raíz,
  desde el propio perfil y desde la comparación— y `replace` deja el mismo
  destino en los tres casos, sin el formulario debajo. La degradación de
  QA23-004 (`tipoSinGuardar` → `IR AL PERFIL`) sale al **mismo** destino.
- **Confirmación.** Vive en el perfil, es una región viva `polite`, se puede
  cerrar y **no promete un cálculo**: `relationshipSavedConfirmation` se reescribió
  para decir que la comparación se calcula *cuando la abrís*.
- **Raíz.** `VinculosHubScreen` perdió el bloque de confirmación, el chip
  `RECIÉN GUARDADA` y **todo** `EstadoLectura` —la única superficie que disparaba
  `refreshComparison` desde la lista—. Cada fila abre
  `relationshipProfileHref(persona.profileId)`. Se conservan `EDITAR DATOS DE …`
  y el CTA legacy fuera de la tarjeta (QA22-023). `RELATIONSHIP_SAVED_PARAM` se
  eliminó del dominio: sin `?guardada=` no tiene a quién nombrar.
- **Back y deep link.** La comparación vuelve al **perfil**
  (`fallbackHref = relationshipProfileHref(...)`, en las nueve superficies de la
  pantalla); el perfil vuelve a la **raíz**; un id borrado o ajeno sale a la raíz
  en vez de rebotar contra un perfil igual de vacío; borrar sigue haciendo
  `replace` a `/vinculos`. Sin segmento, las dos rutas redirigen a
  `VINCULOS_ROUTE` en vez de montar una pantalla sin persona.
- **Web.** La cuarta ruta degrada igual que las otras tres: wrapper neutro en
  `app/`, implementación por plataforma fuera de `app/` y `<Redirect href="/vinculo" />`
  en la variante `.web.tsx`. Ninguna arrastra `src/screens/v492/**` al paquete web.
- **Accesibilidad.** Las dos acciones anuncian etiqueta con el nombre de la
  persona y pista con la consecuencia —incluida «el cálculo empieza al abrirla»—;
  el CTA legacy y el cierre de la confirmación son botones reales con
  `minHeight: v492.touch`; la tarjeta de la fila sigue anunciando nombre y nivel y
  no contiene otros botones adentro. Cero color o espaciado hardcodeado.

**Pruebas escritas · VERIFICADAS.**

| Archivo | Qué fija | Estado |
|---|---|---|
| `test/vinculosPerfilQA23.test.ts` (nuevo) | Las cuatro rutas y la degradación web; que la comparación cuelgue del perfil; el destino del post-guardado y su confirmación sin promesa de cálculo; la ausencia de `getComparison`/`refreshComparison`/`useAction`/`useEffect` en raíz y perfil; la matriz de ownership de `findRelationshipProfile`; que el id no autorizado no publique un campo; las dos acciones exactas; y la accesibilidad del perfil. | verde |
| `test/vinculosQA22.test.ts` | Ajustado: destinos del dominio, confirmación, `router.replace`, «guardar aterriza en el perfil y NO abre la comparación», la raíz sin ningún cálculo y las **cuatro** rutas. Las garantías puras de nivel, bloqueo, idempotencia y fase del cálculo no se movieron. | verde |
| `test/vinculosNativeV492.test.ts` | Ajustado: `VINCULOS_ROUTES` pasa a cuatro; las pruebas de la comparación apuntan a `[profileId]/comparacion`; `[profileId]` estrena su prueba de perfil sin cálculo; `relationshipReading(datosComparacion, tipo)` reemplaza al `relationshipReading(data)` viejo. | verde |
| `test/tipoVinculoFrontQA23.test.ts` | Ajustado: el CTA legacy se exige también en el perfil; la fila abre `relationshipProfileHref`; la clave de cálculo dejó de vivir en la raíz. | verde |
| `test/vinculosLecturaQA22.test.ts` | Ajustado: la lista de rutas pasa a cuatro. | verde |

**Riesgo anotado.** `relationshipCalcPhase`, `relationshipCalcNote`,
`relationshipRowCanRetry` y `RELATIONSHIP_ROW_RETRY_LIMIT` quedan **sin call site
en `src/`** al retirarse `EstadoLectura`; el módulo sigue existiendo y probado, y
`relationshipCalcKey` / `relationshipNeedsCalculation` los sigue usando la
comparación. Si Codex prefiere podarlos, es una pasada aparte.

**Próximo paso.** Bloque 6.

### Registro provisional del ejecutor · bloques 1, 2 y 3 (supersedido)

**Estado.** Bloques **1 (plan)**, **2 (Tu momento)** y la **parte frontend del 3
(Cumpleluna)** están escritos en el árbol de trabajo, **sin commit**. Los bloques
4 a 8 no se tocaron. Nada de `convex/**` se modificó —la mitad backend del bloque
3 (hash diario de `ORB-LUN-002` y `validUntil` acotado) sigue **pendiente** y es
de Codex—. **No se corrió `pnpm test` ni `pnpm typecheck`**: las pruebas de abajo
quedan **pendientes de ejecución** y ése es el primer paso de la próxima sesión,
antes de cualquier otra cosa.

**Bloque 1 · el plan no se adivina (QA23-001).**

- `src/hooks/useLiveApp.tsx` — `labelReady` pasó a ser exactamente
  `effective !== undefined`. El segundo camino de la condición anterior —sesión
  de Clerk resuelta y disco leído sin snapshot— es verdadero en toda instalación
  nueva y publicaba `FREE` mientras la única `subscriptions.getCurrent` seguía en
  vuelo. `undefined` es "no sé"; `null` sí es respuesta y se dice Free. Es el
  único cambio del archivo, más el `isAuthLoading` que dejó de destructurarse
  porque ya no se usa. `OFFLINE_ENTITLEMENT` no se tocó: sin backend el plan es
  una respuesta (`effective: null`, `labelReady: true`) y sigue sin autorizar
  cobro.
- `src/components/v492/Screen.tsx` — `PlanBadge` recibe una `variant`
  **obligatoria** (sin default): `mark` dibuja `PLUS`/`FREE` en la raíz de una
  pestaña —donde el nombre entero le comía el ancho a la fecha— y `full` dibuja
  `Órbita Plus`/`Órbita Free` en la barra de un detalle. Las dos anuncian el
  nombre **completo** por VoiceOver, y la marca corta se deriva de `planMark`,
  que a su vez se deriva de `planLabel`: no pueden divergir. La reserva de ancho
  (`PLAN_BADGE_WIDTH` / `DETAIL_EDGE`) se sigue calculando con los nombres
  enteros, que es la superficie donde el chip se dibuja completo.

**Bloque 2 · `Tu momento`, tres módulos hermanos (QA23-002).**

- `src/domain/layerReading.ts` — teoría y lectura del dibujo: `MANDALA_RINGS` /
  `MANDALA_RING_ORDER` (los cuatro anillos, de afuera hacia adentro, sin la clave
  de compatibilidad `current_lunation`), `mandalaReading()` —puro y
  determinístico: concepto, uso, pregunta y método fijos; combinación y límite
  derivados sólo de **qué anillos hay**—, `MANDALA_METHOD` y `MANDALA_TRACE`.
- `src/screens/v492/MandalaDetailScreen.tsx` (**nuevo**) — el detalle integral,
  en orden: concepto → los cuatro anillos → tu configuración de hoy →
  combinación → cómo usarlo → para observar → límite → método y trazabilidad.
  **Adentro no hay ningún enlace** a estación, año, ciclo lunar ni tránsito, y no
  monta query propia: lee el mismo sobre `ORB-CYC-003` del bundle del día.
- `src/screens/v492/TransitosLayersScreen.tsx` — el mandala dejó de repartir
  cuatro enlaces por anillo. Cada módulo tiene **un** acceso —`VER TU ESTACIÓN`,
  `VER TU AÑO`, `VER TUS CUATRO RITMOS`—, y el del mandala sólo aparece cuando
  hay dibujo. Se eliminaron la prop `destinos`, los tipos `RitmoDestino` /
  `RitmoDestinos` y el `arcId` que alimentaba la salida al tránsito.
- `src/domain/detailOrigin.ts` y `src/routes/v492/transitos-capa.tsx` — `mandala`
  entra en `SECTION_LAYER_DETAILS` y en la tabla de pantallas, así que
  `/transitos/capa/mandala` resuelve por deep link, vuelve a `Tu momento` sin
  historial y, con historial, hace `pop` del stack de Tránsitos conservando el
  scroll. La pestaña Tránsitos sigue abriendo `Ahora` y un arco abierto desde
  `Ahora` sigue volviendo a `Ahora` (sin origen declarado → raíz canónica); las
  dos cosas quedaron fijadas por prueba.

**Bloque 3 · el Cumpleluna se lee con un solo reloj (QA23-003) · MITAD FRONTEND.**

La pantalla mezclaba dos relojes en la misma fila. `cumplelunaView` compone
**escalares del snapshot** —`cycleDay`, `cycleLength`, `daysRemaining`,
`progressBand`, que el backend fijó en `observedAt` y no se recalculan solos—
con **un instante relativo**, `nextWhen`, que sin ventana se arma con
`relativeDayLabel(nextExactAt, <reloj>)`. Las dos superficies le pasaban el
`nowMs` de la sesión, así que bastaba que el sobre tuviera unas horas para que la
misma fila dijera `Hoy` al lado de `FALTAN 1,2 días`; con la app abierta cruzando
la medianoche, el titular avanzaba solo y la barra no.

- `src/domain/layers.ts` — el tercer parámetro de `cumplelunaView` pasa de
  `nowMs` a **`observedAtMs`**, documentado como «`observedAt` del MISMO sobre
  que trajo `data`, nunca `Date.now()`». El nombre es el contrato: un `nowMs` en
  un call site ahora se lee como lo que es. `cumplelunaToday` **conserva `nowMs`**
  —si hoy es el día del Cumpleluna sí es una pregunta del día civil de la
  persona— y ninguna otra capa se tocó.
- `src/screens/v492/CumplelunaDetailScreen.tsx` — la vista se arma con
  `envelope.observedAt`: precisión y reloj salen del mismo sobre. `nowMs` dejó de
  destructurarse de `useLayers()` porque era su único uso.
- `src/screens/v492/HoyScreen.tsx` — `CumplelunaBloque` cambia la prop `nowMs`
  por **`observedAt: number`** y los **dos** call sites —el bloque destacado
  cuando el Cumpleluna es hoy y el bloque en su lugar del orden cuando no— pasan
  `cumpleluna.observedAt`. `nowMs` sigue alimentando `cumplelunaToday`, la fecha
  del encabezado, el ranking y el resto de la pantalla.

Sin cambios de copy, de estructura ni de accesibilidad: las etiquetas del head,
del anillo y de la barra son las mismas y siguen anunciando lo mismo; lo único
que cambia es desde qué instante se cuenta el `en N días`. **Los bordes
temporales del bloque 3 que dependen del backend —hash diario de `ORB-LUN-002` y
`validUntil` acotado— no están hechos: son de `convex/**` y quedaron fuera.**

**Pruebas escritas · PENDIENTES DE CORRER.**

| Archivo | Qué fija | Estado |
|---|---|---|
| `test/planIndicatorQA23.test.ts` (nuevo) | La celda exacta del defecto (arranque sin snapshot, sesión resuelta), la matriz de cuándo se puede nombrar el plan, `labelReady` sin `hydrated` ni `isAuthLoading`, el estado offline y las dos variantes del chip. | pendiente |
| `test/mandalaDetalleQA23.test.ts` (nuevo) | `mandalaReading` puro, determinístico y con guardrails; los cuatro anillos y su orden; anillos vacíos y raíz inexacta; el detalle sin enlaces; el deep link, el `pop`, Tránsitos→Ahora y arco desde Ahora→Ahora. | pendiente |
| `test/planIndicatorQA22.test.ts` | Ajustado: el chip ahora tiene `variant`. Las cuatro garantías QA22 no se movieron. | pendiente |
| `test/momentoNavegacionQA22.test.ts` | Ajustado: `mandala` en `SECTION_LAYER_DETAILS`, en la matriz y en la tabla de rutas; el test de accesos pasa de cuatro enlaces por anillo a tres por módulo. | pendiente |
| `test/lecturasQA22.test.ts` | Ajustado: «los cuatro accesos» pasa a «los tres módulos»; se exige que el acceso viva en la rama con cálculo. | pendiente |
| `test/cumplelunaRelojQA23.test.ts` (nuevo) | El dominio nombra `observedAtMs`; la mezcla de relojes reproducida y cortada por el ancla (`hoy` + `1,2 días` → `mañana` + `1,2 días`); que el ancla sólo pueda mover `nextWhen`; los dos call sites de Hoy y el del detalle; `cumplelunaToday` con `nowMs`; y la accesibilidad del bloque y del anillo intactas. | pendiente |

Regresiones QA22 revisadas y **sin cambios necesarios**:
`test/layerMeaningV492.test.ts` (una línea por ritmo, nada entre las líneas y el
acordeón), `test/momentoV492.test.ts`, `test/v492PrecisionUi.test.ts`,
`test/v492CopyA11y.test.ts`, `test/v492ReleaseP1.test.ts` y
`test/tabPressV492.test.ts`. Las tres últimas tocan el Cumpleluna y ninguna se
apoya en el reloj que cambió: `v492ReleaseP1` llama a `cumplelunaView` por
posición, `v492PrecisionUi` mira `precision={cumpleluna.precision}` y
`hoy={cumplelunaHoyAt}`, y `v492CopyA11y` mira las etiquetas del bloque —que no
se movieron—. **Revisado leyendo los archivos, no ejecutándolos.**

**Próximo paso.** Correr `pnpm typecheck` y `pnpm test` (con el gate de piso
`>= 2542`, que ahora debería subir por los tres archivos nuevos), revisar
`git diff --check`, y recién entonces encarar lo que falta del bloque 3: la
mitad backend en `convex/**` —hash diario de `ORB-LUN-002` y `validUntil`
acotado, que es de Codex— y las pruebas de cambio de día y bordes temporales que
dependen de ella.

## RC iOS 1.0.0 (23) · RESULTADO (2026-08-21) · BINARIO ARMADO LOCALMENTE · SIN PUSH NI DISTRIBUCIÓN

**Estado: RC armado.** El binario existe y su **commit exacto es `0ec205d`**.
Se hizo con **autorización explícita de Lucas** para tres cosas y sólo tres:
**commits locales**, **deploy productivo de Convex** y **build de iOS**. Esa
autorización **no incluyó push, TestFlight, App Review ni publicación**, y nada
de eso se hizo. El cambio de producto sigue siendo el de la preparación:
`expo.ios.buildNumber` de `"22"` a `"23"`, con `expo.version` en `"1.0.0"`.

**Commits locales del release** (en este worktree, **sin push**):

| Commit | Mensaje |
|---|---|
| `de08b60` | `fix(qa22): add compatible backend envelopes` |
| `0442876` | `fix(qa22): resolve physical QA findings` |
| `0ec205d` | `chore(release): prepare iOS build 23` — **commit exacto del binario** |

`release/1.0.0` se cortó **localmente** desde `0ec205d`. **No se pusheó.**

**Convex producción: desplegado.** Deployment `exciting-bat-311`, desde ese
mismo árbol. **Sin índices eliminados**, **validación de schema completa** y
**smoke read-only de `void:suggestedToday` en verde**. **No hubo migración
destructiva.**

**Build de EAS.**

- **EAS cloud, perfil `production`:** cargó el proyecto pero **NO creó build**.
  La **cuota mensual Free de iOS está agotada**; **resetea el 2026-09-01**.
- **Alternativa oficial local de EAS, mismo perfil `production`:** **build
  exitoso**, desde el commit exacto **`0ec205d`**.

**Artefacto.**

| Dato | Valor |
|---|---|
| IPA | `/private/tmp/orbita-1.0.0-23.ipa` |
| Tamaño | 49.210.399 bytes |
| SHA-256 | `7b1565b8adcd2ed9188703331781ff2be02ad12ca4d0789372445aa194ed817f` |
| Versión · build | `1.0.0` · `23` |
| Bundle · display | `com.lucasssram.orbita` · `Órbita` |
| Arquitectura | `arm64` |
| Team ID | `UN3VVJMCDQ` |
| Provisioning | App Store, **activo hasta 2027-07-09** |
| `get-task-allow` | `false` |
| `beta-reports-active` | `true` |

**Limitación de la inspección post-build, no fallo de compilación.** El
**archive de Xcode y el export firmado terminaron con éxito**. La verificación
`codesign` posterior **no pudo reconstruir la cadena de confianza** porque el
EAS local **destruye su keychain temporal al finalizar**. Queda registrado como
**limitación de la inspección post-build**, no como fallo de compilación.

**Expo Doctor durante el build: 17/18.** Lo único en rojo son *patch
mismatches*: `expo` 54.0.35 vs `~54.0.37`, `expo-constants` 18.0.13 vs
`~18.0.14`, `expo-updates` 29.0.18 vs `~29.0.20`. El archive terminó
exitosamente igual. **No actualizar dependencias dentro de este RC** sin una
tarea separada.

**Nota de seguridad — rotación recomendada.** El modo verbose del *dry-run* de
Convex **imprimió valores de variables de entorno** en el log local de
herramientas. **No se guardaron ni se commitearon en el repositorio**, y acá no
se repite ningún valor. Recomendación: **rotar los secretos live antes de la
publicación**.

**Pendiente, cada uno con autorización separada y ninguna dada.** Push de
`release/1.0.0`; subida a **TestFlight**; **instalación física** y revalidación
de los **31 casos** originales del registro del build 22; **App Review** y
**publicación**. Nada de eso está autorizado ni hecho: la autorización recibida
cubrió commits locales, deploy de Convex y build, y ahí termina.

## QA22 · CIERRE INTEGRAL DE CÓDIGO — build 22 (2026-08-21) · CERRADO EN CÓDIGO

**Estado: CERRADO EN CÓDIGO.** Los **seis bloques de implementación** de QA22
están terminados y revisados. Codex corrió la verificación **sobre el árbol
completo** —ya no por tandas focales— y quedó todo en verde. El **codegen de
Convex ya corrió**, también en verde (detalle abajo). Lo que sigue pendiente no
es código: son las autorizaciones del release, cada una por separado.

**Verificación integral (corrida de Codex, sobre el árbol completo).**

| Qué | Resultado |
|---|---|
| Suite completa | **2542 pruebas · 2542 en verde · 0 fallos** (piso obligatorio: **2347**) |
| `pnpm check:test-count /private/tmp/qa22-test-output.log` | **VERDE** |
| `pnpm typecheck` | **VERDE** |
| `git diff --check` | **VERDE** |
| Export Expo web | **VERDE** — generado **sólo** en `/private/tmp/orbita-qa22-web.Ix5Wzv` |
| Export Expo iOS | **VERDE** — generado **sólo** en `/private/tmp/orbita-qa22-ios.3sfrNx` |
| Revisión de archivos inesperados | **VERDE** — el alcance del árbol coincide con QA22 |
| Codegen de Convex (`CONVEX_DEPLOYMENT=dev:dutiful-viper-815`) | **VERDE** — corrió y **no dejó cambios** en `convex/_generated` |
| Commit · push · deploy · build EAS · submit · App Review | **NO al momento de esta verificación** — lo que pasó después está en la ficha del RC de arriba |

Los dos exports se escribieron **fuera del repositorio**, en esos directorios
temporales y nada más: no dejaron artefactos en el árbol y **no son builds
distribuibles**.

**Codegen de Convex: HECHO, en verde.** Lo corrió **Codex**, pasándole
`CONVEX_DEPLOYMENT=dev:dutiful-viper-815` al proceso: **sin leer `.env.local`** y
**sin deploy**. Terminó bien y **no dejó cambios en `convex/_generated`** —los
tipos generados ya estaban al día con el contrato, así que el árbol no se movió—.
La verificación posterior al codegen quedó igual de verde: suite en
**2542/2542**, `pnpm typecheck` **VERDE** y `git diff --check` **VERDE**. Para el
contrato aditivo del bloque 4B (`driverDetails`) esto levanta el bloqueo que
estaba anotado acá: ya no falta codegen. Lo que falta para que los sobres nuevos
traigan el campo es el **deploy del backend**, que es otra autorización y **no se
hizo**; hasta que ocurra, la lectura degrada del lado del cliente exactamente
como está escrito en esa ficha. — **Actualización posterior: ese deploy ya se
hizo** (`exciting-bat-311`); ver el bullet de abajo y la ficha del RC.

**Estado actualizado de los pendientes (ver la ficha del RC arriba).**

- **RC 1.0.0 (23). HECHO.** El árbol se commiteó (`de08b60`, `0442876`,
  `0ec205d`), `release/1.0.0` se cortó **localmente** desde `0ec205d` y el
  **build salió desde ese commit exacto** con el EAS local, perfil
  `production` —el EAS cloud no pudo por cuota Free agotada—.
- **Deploy de Convex producción. HECHO.** `exciting-bat-311`, sin índices
  eliminados y sin migración destructiva. Con esto queda **levantado el
  bloqueo del contrato aditivo del bloque 4B (`driverDetails`)**: los sobres
  nuevos ya pueden traer el campo y la lectura deja de depender de la
  degradación del lado del cliente.
- **Push · TestFlight · App Review · publicación. PENDIENTE.** Ninguna de esas
  autorizaciones se pidió ni se dio.
- **QA física de los 31 casos del registro del build 22. PENDIENTE.** No se
  instaló el binario en dispositivo: la IPA existe pero no se distribuyó.

Cada pendiente sigue siendo una autorización separada. Este cierre cubre el
código y su verificación; el estado real del binario y del backend está en la
ficha del RC, con **`0ec205d` como commit exacto**.

## QA22 · BLOQUE 6 — limpieza visual de Ajustes, paywall y Carta completa (2026-08-21) · VERIFICADO

**Estado: VERIFICADO.** La implementación está completa y Codex ya corrió la
verificación sobre esta pasada: `pnpm typecheck` **limpio**, la tanda focal
—`test/visualCleanupQA22.test.ts` + `test/cartaV492.test.ts` +
`test/cartaNatalCarga.test.ts` + `test/accesoPostAlta.test.ts` +
`test/perfilAppReview.test.ts` + `test/nativeDefectsV492.test.ts` +
`test/nativeCommerceIntegration.test.ts` + `test/nativeCommerceSurface.test.ts` +
`test/dualProviderManagement.test.ts` + `test/planIndicatorQA22.test.ts` +
`test/responsiveShells.test.ts`— en **370/370 verdes**, y `git diff --check`
**limpio**. Es una tanda **FOCAL** sobre las once tandas que leen estas pantallas
como fuente: **la suite completa no se corrió en esta tanda** —la corrió después
el *CIERRE INTEGRAL DE CÓDIGO* de arriba, en verde— y **tampoco hubo
revalidación física** en el dispositivo del registro del build 22. Cubre
**QA22-006**,
**QA22-007** y **QA22-030** del registro físico del build 22, y deja **QA22-022**
verificado como intacto. No hubo commit, push, deploy, build ni codegen: el árbol
sigue con los cambios de los bloques anteriores sin commitear, sobre `ac384cf`.

**Ficha de tarea (obligatoria antes de tocar archivos).**

- **Objetivo.** Tres pantallas se leen desprolijas por el mismo motivo: la FORMA
  no distingue de qué tipo es cada cosa.
  1. **Ajustes.** `ManageSubscriptionBlock`
     (`src/components/orbita/ManageSubscription.tsx`) sigue escrito con el kit
     legado —`Body`, `Divider`, `Eyebrow`, `Note`, `Pill` de
     `@/components/orbita/kit`— mientras la pantalla que lo contiene en nativo es
     V4.9.2 (`PerfilAjustesBody` dentro del `DetailLayerScreen` del wrapper
     `src/routes/v492/perfil-ajustes.tsx`). Dos sistemas tipográficos y dos
     escalas de espaciado en la misma columna. Y encima, cuatro cosas de
     naturaleza distinta caen en una sola lista plana con el mismo peso:
     **activar** (`ACTIVAR ÓRBITA PLUS`), **gestionar** (`GESTIONAR SUSCRIPCIÓN`
     / `GESTIONAR EN LA TIENDA` / `GESTIONAR LA SUSCRIPCIÓN WEB`), **restaurar**
     (`Restaurar compras`) y las **acciones de cuenta y destructivas** (`Cerrar
     sesión`, `Eliminar mi cuenta`), que además hoy quedan ARRIBA del bloque de
     suscripción —`AccountSignedIn` se dibuja antes que `ManageSubscriptionBlock`
     en `CuerpoAdministrativo`—, así que el borrado de cuenta vive en el medio de
     la columna y pegado a lo comercial.
  2. **Paywall.** `PlusPaywallScreen` lista TRES beneficios —las doce casas, los
     aspectos, cinco preguntas por día en El Umbral— y no nombra la superficie
     más grande que abre el plan: los siete capítulos de "Tu carta, explicada",
     que la Carta completa cierra con `PlusBlock` cuando `lectura.phase` es
     `bloqueado`. Se ofrece algo que no se enumera.
  3. **Carta completa.** `CartaCompletaV492Screen` envuelve en `Card` lo que son
     LISTAS NORMALES de datos: los datos natales, los ejes, las diez posiciones,
     los contactos y las doce casas, más la ficha de método. Seis cajas apiladas
     una atrás de otra convierten una lectura editorial en un tablero, y le
     quitan a la `Card` lo único que la hacía significar algo: marcar lo
     excepcional.
- **Criterios de aceptación (a verificar sobre el código entregado).**
  1. **El bloque de suscripción habla el idioma de la pantalla (QA22-006).**
     `ManageSubscription.tsx` deja de importar de `@/components/orbita/kit` y
     pasa al sistema V4.9.2: tipografías de `@/components/v492/typography`,
     `ModuleHeader` / `Card` / `DataRow` de `@/components/v492/Module`,
     `PrimaryButton` de `@/components/v492/States` y espaciados de
     `@/components/v492/tokens`. Ningún color, tamaño ni margen hardcodeado: si
     falta un token se propone, no se inventa.
  2. **Cuatro cosas distintas, cuatro zonas distintas.** La separación es visual
     Y semántica, no sólo un margen más: **activar** es la única acción primaria
     del bloque; **gestionar** es la salida de quien ya paga y nunca comparte
     peso con activar; **restaurar** queda como acción secundaria nombrada
     —recuperar algo que ya se compró no es comprar—; y **cuenta y destructivas**
     viven en su propia zona, al FINAL de la columna, detrás de su divisor y su
     rótulo, después de la suscripción. `Eliminar mi cuenta` conserva su
     tratamiento de peligro y no queda adyacente a `Restaurar compras` ni a
     `GESTIONAR SUSCRIPCIÓN`: confundir una con otra es el error caro de esta
     pantalla. Toque mínimo 44 y `accessibilityRole` / `accessibilityState` de
     cada acción se conservan tal cual.
  3. **El paywall nombra los capítulos (QA22-007).** El bloque "Qué abre Plus"
     suma un cuarto `Benefit` con el literal EXACTO **`7 capítulos personalizados
     de Tu carta, explicada`**, y **no se quita ninguno** de los tres que ya
     están ni se cambia su orden. Es lo único que cambia en esa pantalla: la
     oferta, los importes, el botón primario, la tarjeta de activación y el
     legal quedan intactos. El beneficio es comprobable —esa superficie existe y
     el backend la cierra por plan—, así que no promete nada que el producto no
     entregue.
  4. **La Carta completa vuelve a ser una columna editorial (QA22-030).** Los
     datos se dibujan como datos: título de bloque, pares rótulo/valor y
     divisores de hairline (`v492.colors.line`) entre filas, sin superficie
     encajonada. `Card` queda reservada para **loading, error, empty, bloqueado
     por plan y acciones excepcionales**: `Calculando`, `SinCalculo`,
     `FaltaCalculo`, `PlusBlock`, los estados de `LecturaNatal` (`cargando`,
     `error`, lectura sin capítulos) y las explicaciones de lo que no se puede
     dibujar (rueda sin grados, ejes sin hora, casas o contactos pendientes). Lo
     que NO cambia: ningún dato se agrega, se quita ni se reordena; ningún copy
     se reescribe; los `accessibilityLabel` de cada fila —`view.voice`— y los
     roles siguen siendo los mismos, así que VoiceOver lee exactamente lo de
     hoy.
  5. **El borrado de cuenta (QA22-022) queda idéntico.** `handleDeleteAccount`,
     `requestAccountDeletion`, la doble confirmación con sus literales
     —`Eliminar tu cuenta` / `Continuar` y `¿Eliminar definitivamente?` /
     `Eliminar mi cuenta`—, `DELETE_ACCOUNT_WARNING`,
     `DELETE_ACCOUNT_SUBSCRIPTION_WARNING`, el marcador
     (`storePendingAccountDeletion`), el handoff al boundary
     (`publishPendingDeletion`) y el lock sincrónico `deletionInFlight` no se
     tocan. En `PerfilScreen.tsx` esta pasada cambia **sólo composición y
     estilos**: agrupar, ordenar y separar. Ni una línea de autoridad, de
     handler ni de copy.
- **Cambio de contrato: NO.** Ninguna función nueva de Convex, ningún campo
  nuevo, ningún schema tocado, ningún `useQuery` agregado. El bloque de
  suscripción sigue leyendo el plan de `useEntitlement()`, como lo dejó 5A.
- **Owner:** Claude (frontend), sin excepción de territorio.
- **Territorio previsto.** Todo propio: `src/components/orbita/ManageSubscription.tsx`
  (migración visual completa), `src/screens/PerfilScreen.tsx` (**sólo**
  composición y estilos, sin tocar `handleDeleteAccount` ni el circuito de
  eliminación), `src/screens/v492/PlusPaywallScreen.tsx` (**sólo** el beneficio
  nuevo), `src/screens/v492/CartaCompletaV492Screen.tsx`, `test/**` y esta ficha
  en `CURRENT_TASK.md`. **No toca `convex/**`** —ni schema, ni CHANGELOG, ni
  `_generated`—, así que del lado de Codex no hay nada que revisar más allá de la
  verificación.
- **Commit base:** `ac384cf` (`release: Órbita 1.0.0 (22)`), preservado.
- **Riesgo:** medio, y concentrado en cinco puntos.
  1. **Estos archivos están fijados por pruebas que los leen como fuente.**
     `PerfilScreen.tsx` lo leen las tandas de eliminación de cuenta, suscripción
     y App Review; `ManageSubscription.tsx` y el paywall los leen
     `nativeCommerceSurface`, `nativeCommerceIntegration` y `planIndicatorQA22`.
     Reordenar y recomponer puede romperlas. La regla de corte: una prueba se
     actualiza SÓLO cuando fija la primitiva vieja o la posición vieja; si fija
     un copy, una autoridad o una guarda, manda la prueba y se ajusta el diseño.
  2. **Sacar la `Card` puede aplanar la lectura.** Sin superficie, lo único que
     separa una fila de la siguiente es el divisor y el ritmo vertical: con poco
     contraste, las diez posiciones se leen como un bloque continuo. La
     mitigación es usar los tokens de la retícula —divisor, `space.md`,
     `rowSpaced`— y conservar el glifo y la alineación de valor a la derecha que
     ya distinguen cada fila.
  3. **La costura entre dos sistemas puede empeorar antes de mejorar.** Si sólo
     migra el bloque de suscripción, el resto de `CuerpoAdministrativo` sigue en
     el kit legado y el contraste queda más visible que hoy. Por eso el alcance
     en `PerfilScreen.tsx` incluye alinear la composición de las zonas vecinas
     —agrupación, orden, divisores y rótulos—, siempre dentro de composición y
     estilos y nunca sobre handlers ni copies.
  4. **Mover el borrado de lugar es tocar la vecindad de una acción
     irreversible.** El flujo no cambia, pero cambia dónde está el botón. Se
     acota exigiendo que la prueba fije la nueva vecindad: `Eliminar mi cuenta`
     al final, con divisor y rótulo propios, y nunca pegado a una acción
     comercial.
  5. **Un cuarto beneficio alarga la tarjeta del paywall.** Empuja hacia abajo
     el legal y los links, que ya viven en un `ScrollView` con el footer fijo
     aparte: no tapa el CTA, pero suma scroll. Se acepta a cambio de enumerar lo
     que el plan realmente abre.
- **Plan de pruebas (previsto, todavía no corrido).** Tanda focal nueva,
  estructural sobre el CÓDIGO con los comentarios removidos, como el resto de
  QA22 —una regla que se cumple sólo en un comentario no se cumple—:
  - **Ajustes:** cero imports del kit legado en `ManageSubscription.tsx`,
    primitivas V4.9.2 presentes, cero valores hardcodeados de color o espaciado;
    las cuatro zonas existen y están separadas; `Restaurar compras` no comparte
    tratamiento con el primario; el bloque no monta `useQuery` propia (garantía
    de 5A, que no se puede perder por el camino).
  - **Borrado (QA22-022):** los literales de las dos confirmaciones, el orden
    aviso → destructiva, el ref de reentrada y el handoff al boundary siguen
    idénticos; `Eliminar mi cuenta` aparece UNA sola vez, en su zona y después
    de la suscripción.
  - **Paywall:** los CUATRO beneficios, el nuevo con el literal exacto y una
    sola aparición, los tres viejos conservados; ninguna referencia a precio,
    Offering ni entitlement cambia en ese bloque.
  - **Carta completa:** `Card` aparece SÓLO en los bloques de estado permitidos
    —se cuentan y se nombran uno por uno— y ninguna envuelve una lista de datos;
    la cantidad de filas y de `DataRow` se conserva; los `accessibilityLabel` de
    las filas son los mismos de hoy.
  - **Tandas existentes a revisar** porque leen estos archivos como fuente:
    `nativeCommerceSurface`, `nativeCommerceIntegration`, `planIndicatorQA22`,
    `v492CopyA11y`, `lecturasQA22` y las de eliminación de cuenta / App Review.
  `pnpm typecheck` y la tanda focal quedan **por correr**: esta ficha no afirma
  ninguna corrida ni ningún resultado.
- **Plan de rollout (previsto).** Merge por PR a `main`. Sin cambio de contrato,
  sin codegen y sin deploy de Convex: el efecto es puramente de cliente y aparece
  con el próximo build. Nada se persiste, nada se migra, nada hay que limpiar.
  **Commit, push, build y deploy no están autorizados en esta tanda.**
- **Plan de rollback (previsto).** Revertir el commit del front alcanza y no deja
  nada vivo: no hay contrato, ni fila remota, ni clave nueva en disco. Vuelven
  las `Card` de la Carta completa, el bloque de suscripción con el kit legado y
  la lista de tres beneficios, sin ningún estado huérfano.
- **Fuera de alcance:** la superficie web y su circuito de Stripe, incluida la
  variante hermana del bloque de suscripción; `convex/**`, el codegen y el
  deploy; cualquier uso de IA/LLM; precios, productos, ids de paquete y la
  lectura del Offering; el entitlement central del 5A, su snapshot y el chip de
  plan; el estado de activación recuperable del 5B; el circuito de la tienda
  —identidad de RevenueCat, cola serial, Customer Center—; el flujo de
  eliminación de cuenta de QA22-022, que se conserva idéntico; agregar, quitar o
  reordenar capacidades del producto —esta pasada es visual—; el resto del plan
  QA22; commit, push, build EAS, TestFlight y App Store; otros worktrees.

## QA22 · BLOQUE 5B — activación recuperable y protección de compra (2026-08-21) · VERIFICADO

**Estado: VERIFICADO.** La implementación está completa y Codex ya corrió la
verificación sobre esta pasada: `pnpm typecheck` **limpio**, la tanda focal
—`test/activationRecoveryQA22.test.ts` + `test/nativeCommerceOffer.test.ts` +
`test/nativeCommerceIntegration.test.ts` + `test/nativeCommerceSurface.test.ts` +
`test/nativeIdentityAndGuard.test.ts` + `test/planIndicatorQA22.test.ts`— en
**232/232 verdes**, y `git diff --check` **limpio**. Es una tanda **FOCAL** sobre
las seis tandas que tocan esta pantalla: **la suite completa no se corrió en esta
tanda** —la corrió después el *CIERRE INTEGRAL DE CÓDIGO* de arriba, en verde— y
**tampoco hubo revalidación física** en el dispositivo del registro del build 22.
No hubo commit, push, deploy, build ni codegen: el árbol de trabajo queda tal
cual, con los cambios sin commitear. Cierra el residual **QA22-028**, el único
punto que el bloque 5A dejó explícitamente PENDIENTE.

**Ficha de tarea (obligatoria antes de tocar archivos).**

- **Objetivo (cumplido):** cerrar **QA22-028**. Antes, cuando la tienda ya había
  aceptado la compra y Convex todavía no la confirmaba, la pantalla entraba en
  `activating` y **se quedaba ahí**: a los 20 s aparecía un aviso más largo y un
  único enlace `COMPROBAR DE NUEVO`, pero la fase no cambiaba nunca, el botón
  primario seguía diciendo `ACTIVANDO ÓRBITA PLUS…` deshabilitado y no había
  salida nombrada. Una espera sin final es el escenario donde alguien vuelve a la
  tienda y paga dos veces. Ahora, **a los 20 s sin confirmación del backend**, la
  pantalla SALE de `activating` hacia `recoverable`, un estado que ofrece
  exactamente dos acciones, con estos literales: **`REINTENTAR ACTIVACIÓN`** y
  **`RESTAURAR COMPRA`**. El enlace viejo se retiró, y la prueba prohíbe que
  vuelva a aparecer en la pantalla o en el dominio.
- **Criterios de aceptación (verificados sobre el código entregado):**
  1. **La espera termina, y termina en un estado accionable (QA22-028).**
     `NativeActivationPhase` suma `recoverable`, y `nativeActivationPhase`
     (`src/domain/nativeCommerce.ts`) recibe el tiempo transcurrido como **dato**
     —`elapsedMs`— en vez de leer el reloj: la decisión es pura y se prueba en
     node sin timers falsos. El umbral es `NATIVE_ACTIVATION_RECOVERY_MS = 20_000`,
     exportado del dominio y usado por las DOS cosas que tienen que coincidir —la
     frontera de la fase y el plazo del `setTimeout` de la pantalla—, y el corte es
     `>=`: 19 999 ms todavía es `activating`, 20 000 ya es `recoverable`. Sin dato,
     con `NaN` o con un valor negativo la respuesta cae del lado conservador
     (`activating`): adelantar la reparación no es más seguro que atrasarla, sólo
     cambia qué se le ofrece a alguien cuyo cargo ya existe. **Cambió respecto del
     plan:** la ficha previa anunciaba reutilizar `BACKEND_ACTIVATION_WAIT_MS`; ese
     nombre ya no existe ni en el dominio ni en la pantalla y la prueba lo prohíbe,
     para que no queden dos plazos con nombres distintos.
  2. **Los dos botones, con el literal exacto.** La tarjeta de `recoverable`
     dibuja exactamente DOS `Pressable` —`REINTENTAR ACTIVACIÓN` y `RESTAURAR
     COMPRA`— y ninguna acción más, las dos con `accessibilityRole="button"`, con
     su `accessibilityState.disabled` anunciado, con toque mínimo 44
     (`inlineAction`) y dentro de una tarjeta con `accessibilityRole="alert"` y
     `accessibilityLiveRegion="polite"`. Ninguna de las dos dice "comprar": la
     prueba exige que `purchase(` no aparezca en el bloque. El copy nombra además
     una tercera salida que no es una acción nueva —seguir con Free—, la que el
     footer ya tenía. **Cambió respecto del plan:** los literales NO se extrajeron
     a constantes del dominio; quedaron escritos en el JSX y fijados por la prueba,
     que exige que cada uno aparezca UNA sola vez en toda la pantalla.
  3. **Sólo Convex confirma el acceso.** `activating` y `recoverable` son
     **presentación**: no abren una capa, un cupo ni un contenido. Los gates
     siguen leyendo `subscriptions.getCurrent` a través de
     `useEntitlement().remote`, y `backendIsPro === true` gana sobre cualquier
     reloj vencido: si el webhook llega al segundo 25, la fase pasa a `confirmed`
     sola, sin tocar nada.
  4. **Nunca un segundo cargo.** Con la compra confirmada por la tienda
     (`storeConfirmed`), con el marcador todavía sin leer (`guard: "loading"`) o
     bloqueado, y en TODO el estado recuperable, `nativePrimaryAction` no puede
     devolver `purchase`. El orden de guardas de la función se conserva tal cual y
     la fase nueva no abre ninguna rama que lo esquive: `recoverable` se deriva de
     `storeConfirmed`, así que llegar ahí implica que la salida ya no es comprar.
     La prueba barre las 48 combinaciones de `backendIsPro` × `busy` ×
     `guardLoaded` × `lastOutcome` × `offeringReady` con `storeConfirmed: true` y
     exige `wait` en todas, con un control positivo que impide que el barrido pase
     por una función que conteste `wait` siempre.
  5. **Reintentar pide reparación y refresca la tienda.** `REINTENTAR ACTIVACIÓN`
     usa el circuito existente de `retryActivation`: primero
     `subscriptions.requestStoreReconcile` —mutation, el backend deja el trabajo
     escrito— y después `refreshCustomerInfo`. Una respuesta vacía es
     `recheck_empty` y **no** levanta el marcador: `getCustomerInfo` puede
     contestar desde el caché del SDK y no prueba que no haya compra.
  6. **Restaurar es el circuito de siempre.** `RESTAURAR COMPRA` llama al mismo
     `restore()` que ya usan el botón primario y el rótulo del nav: mismo candado
     por dueño (`runExclusive` / `createOwnerGates`), mismo marcador armado antes
     de tocar la tienda, mismas respuestas (`restore_empty` / `store_confirmed` /
     `purchase_ambiguous`). No se escribe un segundo camino de restauración.
  7. **Un solo reloj, con dueño y sin bucle.** La pantalla tiene UN `setTimeout`
     —la prueba los cuenta—: publica `0` al entrar, no arma nada si no hay espera y
     desarma con `clearTimeout` en la limpieza. Su entrada es `waitingForBackend`
     (`storeConfirmed && backendIsPro !== true`) y **no** la fase que él mismo
     produce: si dependiera de `activation`, publicar el vencimiento cambiaría la
     fase, el efecto volvería a correr, reiniciaría su propio plazo y la pantalla
     oscilaría entre "activando" y la reparación para siempre. Se rearma sólo
     cuando cambia la espera o la cuenta (`[waitingForBackend, identifiedUserId]`).
  8. **Nada de A se ve en B.** El tiempo de espera viaja en un
     `OwnedValue<number>` (`activationWaitSlot`): se publica con
     `publishOwnedValue` contra `ownerRef.current` y se lee con `readOwnedValue`
     para el dueño vigente, así que un plazo armado para A no puede abrirle a B una
     tarjeta de reparación, y B arranca su propia espera desde cero. Detalle real
     de la implementación: el slot **no es un cronómetro** —guarda `0` o el
     umbral—, porque la decisión es una sola frontera y un reloj corriendo
     obligaría a re-renderizar varias veces por segundo sin decidir nada distinto.
  9. **El primario deja de prometer un final inminente.** Con la fase vencida,
     `primaryLabel` devuelve **`ACTIVACIÓN PENDIENTE`** y el CTA va deshabilitado
     (`primary === "wait"`): dice lo único cierto —el cargo existe, Convex todavía
     no lo refleja— y no invita a comprar. `ACTIVANDO ÓRBITA PLUS…` queda para la
     espera joven, que se nombra y no ofrece ninguna acción. La oferta y su
     impresión siguen atadas a `activation === "idle"`: a quien ya pagó no se le
     vuelve a dibujar el catálogo ni se le cuenta una impresión.
  10. **El 5A queda intacto.** `EntitlementProvider`, `resolvePlanView`, el
      snapshot en disco, `planLabel` y el chip de plan quedan exactamente como los
      dejó el bloque 5A. 5B **lee** `useEntitlement()` y no cambia cómo se
      resuelve, se cachea ni se borra el último entitlement confirmado.
- **Cambio de contrato: NO.** Ninguna función nueva de Convex, ningún campo
  nuevo, ningún schema tocado. `subscriptions.requestStoreReconcile` y
  `subscriptions.getCurrent` ya existen y se usan tal como están.
- **Owner:** Claude (frontend), sin excepción de territorio.
- **Territorio.** Todo territorio propio: `src/domain/**`, `src/screens/**`,
  `test/**` y esta ficha en `CURRENT_TASK.md`. **No toca `convex/**`** —ni el
  schema, ni el CHANGELOG, ni `_generated`—, ni `app/**`, ni la superficie web, ni
  el circuito de identidad de RevenueCat, así que no hay nada que revisar del lado
  de Codex más allá de la verificación.
- **Archivos de esta pasada.** Dominio: `src/domain/nativeCommerce.ts`
  —`NATIVE_ACTIVATION_RECOVERY_MS`, `NativeActivationPhase` con `recoverable` y
  `nativeActivationPhase` recibiendo `elapsedMs`—. Pantalla:
  `src/screens/v492/PlusPaywallScreen.tsx` —el slot de espera con dueño, el único
  `setTimeout`, la tarjeta de reparación con sus dos acciones y el rótulo del
  primario—. Pruebas: `test/activationRecoveryQA22.test.ts` (nueva, catorce casos)
  y `test/nativeCommerceSurface.test.ts` (ampliada: las dos salidas exactas, el
  rótulo `ACTIVACIÓN PENDIENTE` y la ausencia del enlace viejo). Documentación:
  esta ficha.
- **Commit base:** `ac384cf` (`release: Órbita 1.0.0 (22)`), preservado.
- **Riesgo:** medio, y concentrado en cuatro puntos.
  1. **El umbral puede cortar antes que el webhook.** En una red lenta, 20 s
     pueden vencer con la activación en camino. Está acotado a propósito: el
     estado recuperable no retrocede ningún acceso, no afirma que la compra falló
     y no ofrece comprar; y la confirmación del backend lo reemplaza sola apenas
     llega.
  2. **Volver a entrar reinicia la espera.** El tiempo transcurrido vive en el
     estado de la pantalla, así que quien sale del paywall y vuelve —con la tienda
     todavía informando la compra y Convex sin confirmarla— ve otra vez la espera
     joven y tiene que esperar otros 20 s para que reaparezcan las dos salidas. No
     pierde nada: ni el marcador ni el acceso dependen de este reloj, y las mismas
     salidas siguen existiendo en el nav y en el primario. Persistir el arranque de
     la espera habría metido una clave nueva en disco para un problema que se
     resuelve solo apenas llega el webhook.
  3. **Ofrecer Restaurar justo cuando probablemente hubo cargo.** Un
     `restore_empty` en ese momento levanta el marcador. Es el comportamiento que
     ya existe y está razonado —`restorePurchases` fuerza un refresh del recibo—;
     el riesgo se contiene reutilizando ese circuito sin variantes, en vez de
     escribir uno nuevo con reglas propias.
  4. **Tres rótulos para el mismo circuito, y ninguno en el dominio.**
     `Restaurar`, `RESTAURAR MI COMPRA` y `RESTAURAR COMPRA` conviven en la misma
     pantalla, y los literales quedaron en el JSX y no en constantes del dominio
     como preveía el plan. El literal pedido por el registro no se toca; la
     mitigación real es la prueba, que fija los dos textos exactos y exige que cada
     uno aparezca UNA sola vez, así que "unificarlos" o duplicarlos rompe la tanda.
     Fuera de ese archivo no hay nada que los proteja.
- **Plan de pruebas (previsto, todavía no corrido).** Tanda focal nueva sobre el
  dominio y la superficie:
  - **Reloj y bordes:** 19 999 ms → `activating`; 20 000 ms → `recoverable`;
    `elapsedMs` grande sin `storeConfirmed` → `idle` (el reloj solo nunca crea el
    estado); `backendIsPro === true` con el reloj vencido → `confirmed`.
  - **Fase:** la tabla completa de `nativeActivationPhase` con el estado nuevo,
    incluida la transición `activating → recoverable → confirmed`.
  - **Doble compra:** `nativePrimaryAction` nunca devuelve `purchase` con
    `storeConfirmed`, con `guard: "loading"`, con el marcador bloqueado ni en
    `recoverable`; y una cancelación demostrada sigue permitiendo comprar.
  - **Cambio de dueño:** una publicación tardía de A no cambia la fase ni el aviso
    de B, y el reloj de B arranca de cero.
  - **Acciones y copy:** los dos botones existen con el literal EXACTO, con rol de
    botón, deshabilitados mientras hay algo en curso, con toque mínimo 44 y dentro
    de una live region; el copy no promete acceso que Convex no confirmó.
  Las comprobaciones estructurales corren sobre el CÓDIGO con los comentarios
  removidos, como el resto de QA22. Se revisan además las tandas de comercio ya
  existentes (`nativeCommerceIntegration`, `nativeCommerceSurface`,
  `planIndicatorQA22`) porque tocan la misma pantalla.
- **Plan de rollout (previsto).** Merge por PR a `main`. Sin cambio de contrato,
  sin codegen y sin deploy de Convex: el efecto es puramente de cliente y aparece
  con el próximo build. No se persiste nada nuevo —el umbral vive en memoria de la
  pantalla— así que no hay que migrar ni limpiar nada. **Commit, push, build y
  deploy no están autorizados en esta tanda.**
- **Plan de rollback (previsto).** Revertir el commit del front alcanza y no deja
  nada vivo: no hay contrato, ni fila remota, ni clave nueva en disco. Volver
  atrás devuelve la tarjeta de activación del 5A —aviso demorado y `COMPROBAR DE
  NUEVO`— sin ningún estado huérfano.
- **Fuera de alcance:** precios, productos, ids de paquete y la lectura del
  Offering; el entitlement central del 5A, su snapshot y el chip de plan; el
  circuito de la tienda —identidad de RevenueCat, cola serial, Customer Center—;
  cualquier uso de IA/LLM; la superficie web y su circuito de Stripe; `convex/**`,
  el codegen y el deploy; el resto del plan QA22; commit, push, build EAS,
  TestFlight y App Store; otros worktrees.

## QA22 · BLOQUE 5A — El plan se dice en pantalla, y se dice desde un solo lugar (2026-08-21) · VERIFICADO

**Estado: VERIFICADO.** La implementación está completa y Codex ya corrió la
verificación sobre esta pasada: `pnpm typecheck` **limpio**, la tanda focal
—`test/planIndicatorQA22.test.ts` + `test/nativeCommerceIntegration.test.ts` +
`test/nativeCommerceSurface.test.ts`— en **134/134 verdes**, y `git diff --check`
**limpio**. No hubo commit, push, deploy, build ni codegen: el árbol de trabajo
queda tal cual, con los cambios sin commitear.

**Ficha de tarea (obligatoria antes de tocar archivos).**

- **Objetivo:** cerrar **QA22-003** del registro físico del build 22. La app no
  decía en ninguna pantalla de capas si la cuenta era Free o Plus, así que un
  bloque recortado por el backend —casas sin datos, un mapa de valores vacío, una
  lectura de personalidad que no aparece— se leía como una falla y no como una
  oferta. Y donde el plan sí se consultaba, se consultaba tres veces: el paywall,
  el bloque de suscripción del perfil y los docs vivos montaban cada uno su
  propia `subscriptions.getCurrent` y repetían por su cuenta la correlación con
  el dueño de Clerk. Tres copias de la misma verdad, cada una con su ventana de
  "todavía no sé", y ninguna con memoria: al arrancar en frío, a quien paga la
  app se le decía "Free" hasta que su query resolviera.
- **Criterios de aceptación:**
  1. **El plan se ve, y con su nombre entero (QA22-003).** `PlanBadge`
     (`src/components/v492/Screen.tsx`) dibuja `Órbita Plus` u `Órbita Free` en
     las DOS pantallas base —`LayerScreen`, arriba junto a la marca, y
     `DetailLayerScreen`, en el extremo derecho de la barra—, una sola vez cada
     una. El texto en pantalla es EL MISMO que anuncia VoiceOver
     (`Tu plan: {label}`). La marca corta (`PLUS`/`FREE`) queda fuera del chip:
     ahorraba dos palabras a cambio de pedir que ya se supiera qué es "PLUS", que
     es justo lo que el chip viene a contestar. Los nombres salen del dominio
     (`PLAN_PLUS_LABEL` / `PLAN_FREE_LABEL`), nunca de un literal suelto, y
     `planLabel` es la ÚNICA función que puede escribir "Órbita Plus".
  2. **Una sola query, montada una sola vez.** `EntitlementProvider`
     (`src/hooks/useLiveApp.tsx`) tiene la única `subscriptions.getCurrent` de la
     UI nativa y se monta una vez en `app/_layout.tsx`, DENTRO de
     `OrbitaSessionProvider`: sin dueño de Clerk no hay plan que correlacionar.
     El paywall, el bloque de perfil y `useLiveAppDocs` pasan a leer de
     `useEntitlement()` y no montan query propia.
  3. **El último confirmado llena el hueco, y no hay parpadeo Free.**
     `resolvePlanView` (`src/domain/entitlement.ts`, pura) tiene un solo filo:
     **el snapshot sólo llena el hueco**. Con respuesta remota —Free, Plus o
     `null`— manda el remoto y el snapshot se actualiza o se borra; nunca al
     revés, que es exactamente cómo una suscripción vencida se quedaría "activa"
     para siempre en esta pantalla. Sin respuesta remota se usa el último plan
     confirmado, y sólo si el disco ya se leyó (`hydrated`); antes de eso la
     respuesta honesta es "no sé" y el chip **no dibuja nada** (`labelReady`), en
     vez de publicar un "Free" especulativo.
  4. **Presentar no es conceder.** El cache es SÓLO presentación: pone una
     etiqueta y nada más. Todo lo que decide acceso o plata —los gates de
     lectura, comprar, restaurar, abrir el portal de facturación— lee `remote` y
     `resolved`, el remoto confirmado para la cuenta vigente. Un snapshot jamás
     levanta `resolved`: dice cómo se llamaba el plan la última vez, no qué
     autoriza la tienda hoy. En disco se guarda sólo `isPro`, no el entitlement
     entero: proveedor, portal y vida del cargo son decisiones de plata.
  5. **El cambio de cuenta falla cerrado.** La query va con `skip` sin sesión
     viva y el resultado se correlaciona con el dueño (`safeEntitlement`) antes
     de publicarse, porque el `skip` no alcanza —Convex conserva el último valor
     mientras la nueva suscripción resuelve—. El snapshot en memoria viaja con su
     dueño (`OwnedValue`) y la caída es **síncrona**, en el mismo render del
     cambio: los efectos corren después, y un render con el plan de A bajo la
     sesión de B es lo que no puede pasar. En disco hay una clave por cuenta **y**
     el dueño adentro del valor; ante cualquier duda —ilegible, sin dueño
     vigente, de otra cuenta, forma equivocada— `parsePlanSnapshot` devuelve
     `null` y no afirma ningún plan.
  6. **La barra de detalle queda centrada de verdad.** Los dos extremos miden lo
     mismo (`DETAIL_EDGE`, ancho FIJO y no `minWidth`: un mínimo deja crecer el
     lado del chip y descentra el rótulo) y el rótulo del medio se centra con
     `flex: 1`. La reserva es el ancho del nombre más largo —calculable sin medir
     porque la familia es monoespaciada— y nunca baja del toque mínimo de 44.
     Los dos nombres tienen el mismo largo, así que cambiar de plan no mueve un
     punto; con Dynamic Type al tope el chip encoge y se recorta antes que
     invadir el rótulo, y VoiceOver sigue diciendo el plan entero.
- **Cambio de contrato: NO.** Ninguna función nueva de Convex, ningún campo
  nuevo, ningún schema tocado. Esta pasada RESTA queries en vez de agregar
  contrato: `subscriptions.getCurrent` ya existía y ahora se pide una sola vez.
- **Owner:** Claude (frontend), sin excepción de territorio.
- **Territorio.** Todo territorio propio: `app/_layout.tsx`, `src/**` y `test/**`.
  **No toca `convex/**`** —ni el schema, ni el CHANGELOG, ni `_generated`—, así
  que no hay nada que revisar del lado de Codex más allá de la verificación.
- **Archivos de esta pasada.** Montaje: `app/_layout.tsx`. Estado central:
  `src/hooks/useLiveApp.tsx` (`EntitlementProvider`, `useEntitlement`, y
  `useLiveAppDocs` que deja de pedir el plan por su cuenta). Dominio:
  `src/domain/entitlement.ts` (`PlanView`, `planLabel`, `planMark`,
  `resolvePlanView`, `serializePlanSnapshot`, `parsePlanSnapshot`). Persistencia:
  `src/services/entitlementSnapshot.ts` (nuevo) y
  `src/services/entitlementSnapshot.web.ts` (nuevo, no-op, para que el bundle web
  no arrastre `AsyncStorage`). Presentación: `src/components/v492/Screen.tsx`.
  Consumidores de plata: `src/screens/v492/PlusPaywallScreen.tsx` y
  `src/components/orbita/ManageSubscription.tsx`. Pruebas:
  `test/planIndicatorQA22.test.ts` (nueva), `test/nativeCommerceIntegration.test.ts`
  y `test/nativeCommerceSurface.test.ts`. Documentación: esta ficha.
- **Commit base:** `ac384cf` (`release: Órbita 1.0.0 (22)`), preservado.
- **Riesgo:** medio, y concentrado en cuatro puntos.
  1. **La etiqueta puede ir por delante del acceso.** En la ventana sin remoto,
     alguien cuyo Plus venció ve el chip que dice Plus hasta que el backend
     conteste. Es a propósito y está acotado: el acceso no cambia —los gates y el
     cobro leen `remote`/`resolved`— y la respuesta remota borra el snapshot.
  2. **Un cuarto consumidor reabre el agujero.** Si mañana una pantalla vuelve a
     montar su propia `subscriptions.getCurrent`, vuelven la copia de la verdad y
     su ventana de espera. No falla: se degrada en silencio. Por eso las pruebas
     lo cuentan sobre el CÓDIGO —una sola `getCurrent` operativa, una sola
     `safeEntitlement`, cero `useQuery` en las dos pantallas de plata—.
  3. **El disco puede quedar con una etiqueta vieja.** `clearEntitlementSnapshot`
     propaga el fallo y el provider lo traga: si el borrado no llega al disco, el
     próximo arranque en frío puede mostrar "Órbita Plus" de más hasta que el
     remoto conteste. No concede nada, y el remoto lo corrige.
  4. **La reserva de ancho es un cálculo, no una medición.** `PLAN_BADGE_WIDTH`
     asume Roboto Mono y su avance por glifo. Si el chip cambia de familia,
     cuerpo o tracking sin mover esa constante, el rótulo del detalle se
     descentra. Las pruebas fijan la simetría, no la tipografía.
- **Plan de pruebas.** `test/planIndicatorQA22.test.ts` (nueva) cubre las cuatro
  garantías: la decisión pura en sus cuatro cuadrantes —incluido el filo Free
  remoto sobre cache Plus—, el snapshot con su dueño adentro y su lectura
  defensiva (otra cuenta, ilegible, JSON válido con forma equivocada, `__proto__`),
  los dos nombres y el chip que no especula, y las comprobaciones estructurales:
  un solo provider dentro de la sesión, una sola `getCurrent`, una sola
  correlación, las dos pantallas de plata leyendo el remoto sin query propia, el
  chip en las dos pantallas base y los dos extremos con el mismo ancho fijo. Esas
  comprobaciones corren sobre el CÓDIGO con los comentarios removidos: estos
  archivos documentan largo, y una regla que se cumple sólo en un comentario no se
  cumple. `nativeCommerceIntegration` y `nativeCommerceSurface` se actualizan
  porque el paywall y el bloque de perfil cambiaron de fuente de plan.
  **Corrida de Codex sobre esta pasada: `pnpm typecheck` limpio, 134/134 focales
  en verde y `git diff --check` limpio.**
- **Plan de rollout.** Merge por PR a `main`. Sin cambio de contrato, sin codegen
  y sin deploy de Convex: el efecto es puramente de cliente y aparece con el
  próximo build. El snapshot se crea solo, en el primer arranque de cada cuenta
  que reciba un remoto confirmado; nadie tiene que migrar ni limpiar nada.
  **Commit, push, build y deploy no están autorizados en esta tanda.**
- **Plan de rollback.** Revertir el commit del front alcanza y no deja nada vivo:
  no hay contrato ni fila remota que deshacer. Lo único que sobrevive es la clave
  `orbita:entitlement-snapshot:{owner}` en el AsyncStorage de quien ya la haya
  escrito, y queda huérfana e inerte: no la lee nadie y nunca concedió acceso. No
  hay migración que revertir.
- **Fuera de alcance:** **QA22-028 (la activación) queda PENDIENTE** y no entró
  en esta pasada; la superficie web, que conserva su circuito de Stripe y recibe
  el stub no-op del snapshot; derivar el plan de `RevenueCat.storeIsPro` o del
  marcador de compra en vuelo —la tienda dice qué cobró, no qué acceso concede
  Órbita—; mostrar el chip fuera de las dos pantallas base; `convex/**`, el
  codegen y el deploy; el resto del plan QA22; commit, push, build EAS,
  TestFlight y App Store; otros worktrees.

## QA22 · BLOQUE 4B — Vínculos: el contrato publica la evidencia y la lectura la explica (2026-08-21) · EN REVISIÓN

**Estado: EN REVISIÓN.** La implementación de 4B está completa y entregada a
Codex. Codex ya corrió `pnpm typecheck` —**limpio**— y la tanda focal —**212/212
en verde**—, pero al cerrar esta tanda **el codegen de Convex y la suite completa
seguían pendientes**. **Actualización:** la suite completa ya corrió en verde en
el *CIERRE INTEGRAL DE CÓDIGO* de arriba; **el codegen de Convex sigue
pendiente**, así que el gate de contrato de 4B todavía no está cerrado y esta
ficha **no** lo marca VERIFICADO.

**Ficha de tarea (obligatoria antes de tocar archivos).**

- **Objetivo:** cerrar QA22-014, QA22-017, QA22-019, QA22-020 y QA22-021 del
  registro físico del build 22. En Vínculos, el descargo del alta no decía de qué
  hablaba —no se distinguía si anunciaba qué compara la lectura, una limitación
  del cálculo o una advertencia legal—; la lectura ponía método y limitaciones
  antes que una interpretación útil, y cada dimensión repetía la misma fórmula
  sobre una lista de contactos enumerados; `+ 1 CONTACTO MÁS` no decía a qué
  dimensión pertenecía lo plegado, cuántos había ni con qué criterio estaban
  ordenados; el largo y el color de las barras no tenían una semántica
  reconstruible y se leían como un porcentaje de compatibilidad; y un mismo
  contacto que alimenta dos dimensiones se mostraba dos veces, como si fueran dos
  hallazgos distintos.
- **Criterios de aceptación:**
  1. **El descargo dice qué es (QA22-014).** El bloque único se parte en dos
     rótulos con función declarada —`RELATIONSHIP_WHAT_YOU_SEE_LABEL` y
     `RELATIONSHIP_READING_LIMITS_LABEL`, en `src/domain/relationships.ts`—: uno
     anuncia QUÉ va a leer esa persona con los datos que cargó y el otro dice
     dónde termina el alcance del cálculo. El texto sigue siendo el del
     guardrail de marca: entretenimiento y autoconocimiento, sin claims.
  2. **La lectura interpreta antes de explicarse (QA22-017).** `relationshipReading`
     (`src/domain/relationshipReading.ts`, puro: sin React, sin Convex y sin
     reloj) abre con DOS o TRES dinámicas reales —`RELATIONSHIP_MAX_DYNAMICS`—,
     cada una un contacto del cálculo con su propia oración, y no un puntaje
     global. Por dimensión escribe **qué se facilita**, **qué puede tensarse** y
     **una invitación** —acción cuando el balance es más fluido, pregunta cuando
     no—, apoyadas en la evidencia real de `driverDetails` y no en la plantilla
     por tono. Lo que no se puede afirmar se dice que no se puede afirmar: nunca
     se inventa una calidad, un peso ni una precisión.
  3. **El plegado dice qué pliega y cuántos (QA22-019).** El copy es el literal
     del registro: `VER LOS {N} CONTACTOS QUE FORMAN {DIMENSIÓN}`, con `N` = los
     contactos ÚNICOS por id de esa dimensión y la dimensión nombrada
     (`relationshipContactsToggleLabel` / `relationshipContactsCollapseLabel`).
     La concordancia en singular se resuelve donde se puede resolver sin torcer
     el copy pedido: en la etiqueta accesible
     (`relationshipContactsToggleVoice`). El orden es explícito y determinístico
     —**fuerza, calidad, precisión** y dos desempates estables: la posición que
     el sobre ya traía y el id—.
  4. **La barra se dice en palabras (QA22-020).** La barra por dimensión se
     reemplaza por texto: `relationshipDimensionRow` escribe `3 contactos ·
     mixto` y `relationshipDimensionRowVoice` lo dice entero para el lector de
     pantalla. No hay riel, no hay porcentaje y no hay significado que dependa
     del color: el color acompaña SÓLO a la palabra del balance, nunca a la
     cantidad, para no sugerir que el número mide algo que no mide. La barra de
     NIVEL (`01`/`02`/`03`) se conserva: ésa sí es una posición dentro de tres.
  5. **La reutilización se dice, no se duplica (QA22-021).** El mismo `id` en dos
     dimensiones es UN contacto leído desde dos lados, y así se escribe
     (`alsoIn` por dimensión, `dimensions` en la dinámica,
     `relationshipContactRole` y `relationshipDynamicRole`). El cierre factual
     cuenta contactos **distintos** y cuántos se comparten
     (`relationshipContactsLine`), en vez de sumar filas y contar dos veces el
     mismo contacto.
- **Cambio de contrato: SÍ, y es aditivo.** `relationships.getComparison`
  conserva `drivers: string[]` exactamente con su semántica y su orden, y agrega
  por dimensión `driverDetails` **opcional**
  (`relationshipDriverDetailValidator` en `convex/lib/layerContract.ts`): una
  entrada por contacto único con `id`, `text`, `quality`
  (`support` · `tension` · `neutral`), `weight` y `precision`. Es un SUBCONJUNTO
  de lo que `buildDimensions` ya calculaba —`relationshipDriverDetails` en
  `convex/lib/relationshipLayers.ts`—: sin LLM, sin heurística y sin orden nuevo.
  Los ids son **deterministas y semánticos** (`aspect:a:venus:b:sun:trine`,
  `house:b:sun:a:7`): salen de QUÉ toca a QUÉ, nunca del índice del arreglo ni
  del texto. Se **deduplica sólo por id** —dos contactos con texto parecido y
  distinto id son dos contactos, y borrar uno perdería evidencia real—, y el
  MISMO id puede vivir en varias dimensiones, que es justamente lo que permite
  explicar la reutilización. El detalle está escrito en `convex/CHANGELOG.md`
  (entrada 2026-08-21 · bloque 4B).
- **Compatibilidad (cachés y build 22).** El campo es opcional en el validator
  **por los sobres ya persistidos**: `relationshipComparisonCachesV492.data` se
  valida contra `relationshipComparisonDataValidator`, así que las filas escritas
  antes de este cambio tienen que seguir siendo válidas sin migración. Un cliente
  del build 22 no lee el campo nuevo y no cambia de comportamiento. Del lado del
  front la degradación es explícita: sin `driverDetails`, `quality`, `weight` y
  `precision` quedan en `null`, los contactos se muestran igual y en el orden que
  el sobre ya traía, el id sintético `legacy:{dimensión}:{texto}` existe SÓLO
  para poder listar y dedupear dentro de la pantalla —no se presenta como
  identidad certificada— y un sobre legacy **nunca** afirma que un contacto se
  reutiliza. Sin migración destructiva, sin tabla nueva y sin índice nuevo.
- **Owner:** Claude (frontend), con la excepción de contrato declarada.
- **Territorio.** Esta pasada **sí toca `convex/**`**, que normalmente es de
  Codex: es el cambio de contrato aditivo y va acompañado de su nota en
  `convex/CHANGELOG.md`, como pide `CLAUDE.md`. Alcanza a
  `convex/lib/layerContract.ts` (validators y tipos), `convex/lib/relationshipLayers.ts`
  (`relationshipDriverDetails`) y `convex/relationships.ts` (emisión). **La
  revisión de esas tres, el codegen y el deploy son de Codex.** El resto es
  territorio propio: `src/domain/**`, `src/screens/v492/**`, `test/**` y esta
  ficha. No toca `app/**`, ni las rutas, ni la superficie web, ni `convex/schema.ts`.
- **Archivos de esta pasada.** Contrato: `convex/lib/layerContract.ts`,
  `convex/lib/relationshipLayers.ts`, `convex/relationships.ts` y
  `convex/CHANGELOG.md`. Dominio: `src/domain/relationshipReading.ts` (nuevo) y
  `src/domain/relationships.ts`. Pantallas: `src/screens/v492/VinculosResultScreen.tsx`
  (la lectura) y `src/screens/v492/VinculosConnectScreen.tsx` (el descargo del
  alta). Pruebas: `test/vinculosLecturaQA22.test.ts` y
  `test/vinculosReadingQA22.test.ts` (las dos nuevas). Documentación: esta ficha.
- **Commit base:** `ac384cf` (`release: Órbita 1.0.0 (22)`), preservado. 4B se
  apoya sobre 4A y no toca ninguno de sus archivos de decisión salvo
  `src/domain/relationships.ts` y las dos pantallas de Vínculos, así que la
  corrida de 4A hay que repetirla junto con ésta.
- **Riesgo:** medio-alto, y concentrado en tres puntos.
  1. **El campo llega tarde.** Hasta que Codex corra el codegen y despliegue,
     ningún sobre nuevo trae `driverDetails` y la lectura corre en su modo
     degradado. Durante la ventana de expiración de los cachés conviven dos
     lecturas —una con evidencia y otra sin ella— para dos personas de la misma
     cuenta. Es visible a propósito: la pantalla lo dice en vez de disimularlo.
  2. **El balance se reproduce, no se lee.** El sobre no publica su `tone`, así
     que `relationshipDimensionBalance` reproduce del lado del cliente la MISMA
     regla que el backend usa en `dimensionSummary` (apoyo/tensión con margen
     1,25; sólo neutrales ⇒ sutil). Si Codex cambia su regla y no cambia ésta, la
     fila y el resumen del backend van a decir cosas distintas.
  3. **Los ids son la identidad.** Toda la explicación de la reutilización y toda
     la dedupe cuelgan de que el id sea estable entre corridas. Un id que pase a
     depender del índice o del texto rompe QA22-021 en silencio: no falla, dice
     otra cosa. Por eso las pruebas lo fijan sobre el motor real.
- **Plan de pruebas.** `test/vinculosLecturaQA22.test.ts` — corre el MOTOR real
  (`buildRelationshipComparisonResult`) de punta a punta y fija el contrato: los
  ids, la forma cerrada de `driverDetails`, que `drivers` conserve semántica y
  orden, y el cableado que una prueba de dominio no puede ver.
  `test/vinculosReadingQA22.test.ts` — la contraparte sin motor: sobres mínimos
  escritos a mano y tipados contra el contrato, uno por regla, para aislar
  identidad (mismo id repetido se descarta; dos ids con el mismo texto
  sobreviven; el mismo id en dos dimensiones es uno y se dice), degradación
  build 22, cada escalón del orden con su desempate, el texto de las cinco
  dimensiones y el copy literal del control de contactos, más que el validator
  siga siendo aditivo y que la pantalla no vuelva a dibujar la barra por
  dimensión. **Corrida de Codex sobre esta pasada: `pnpm typecheck` limpio y
  212/212 focales en verde. La suite completa corrió después, en verde, en el
  *CIERRE INTEGRAL DE CÓDIGO* de arriba; falta el codegen de Convex, y sin eso
  4B no se marca VERIFICADO.**
- **Plan de rollout.** Merge por PR a `main`. El campo es aditivo, así que back y
  front pueden viajar en el mismo PR sin orden entre ellos, pero el efecto
  visible depende de Codex: **codegen + deploy de Convex**, y recién ahí los
  sobres nuevos empiezan a traer `driverDetails`. Los sobres viejos no se
  reescriben: caducan por su propia invalidación de entradas/método. **El deploy
  no está autorizado en esta tanda.**
- **Plan de rollback.** Mientras no haya deploy, revertir el commit del PR alcanza
  y no deja nada atrás: ninguna fila se escribió con el campo nuevo. **Después de
  un deploy que ya haya escrito sobres con `driverDetails`, revertir el validator
  no es gratis:** `relationshipComparisonCachesV492.data` se valida contra el
  validator cerrado, así que un push de schema sin el campo declarado fallaría
  contra esas filas. En ese escenario el rollback correcto es revertir sólo el
  front —la lectura degrada sola— y dejar el campo publicado hasta que los cachés
  expiren. No hay migración que deshacer.
- **Fuera de alcance:** el codegen de Convex y el deploy, que son de Codex;
  unificar `drivers` con `driverDetails` o retirar el string (el contrato queda
  con los dos a propósito); publicar el `tone` de la dimensión desde el backend;
  recalcular o migrar los sobres ya persistidos; el resto del plan QA22; `app/**`,
  las rutas y la superficie web; commit, push, build EAS, TestFlight y App Store;
  otros worktrees.

## QA22 · BLOQUE 4A — Vínculos: guardar no es calcular, el nivel no se elige dos veces y el alta es un flujo (2026-08-21) · EN REVISIÓN

**Estado: EN REVISIÓN.** La implementación de 4A está completa y entregada a
Codex. Codex corrió `pnpm typecheck` y la tanda focal sobre la pasada previa a
esta revisión; el cierre estructural del mutex de guardado (ver *Ajuste de esta
revisión*) es POSTERIOR a esa corrida, así que la que vale es la que Codex repita
ahora. **Actualización:** esa corrida posterior ya existe —el *CIERRE INTEGRAL
DE CÓDIGO* de arriba, con la suite completa en verde sobre el árbol que incluye
este ajuste—.

**Ficha de tarea (obligatoria antes de tocar archivos).**

- **Objetivo:** cerrar QA22-013, QA22-015, QA22-016, QA22-018 y QA22-023 del
  registro físico del build 22. En Vínculos, elegir una modalidad navegaba sola y
  el CTA quedaba empujado fuera de la vista por el límite del nivel; guardar una
  persona abría la lectura y la espera del proveedor quedaba en el medio, sin
  decir si lo que tardaba era escribir la persona o generar la comparación; el
  nivel se pedía dos veces —como preferencia en el selector y otra vez como
  consecuencia de los datos—; y quitar la fecha dejaba la hora y la ciudad
  escritas en pantalla como si siguieran guardadas.
- **Criterios de aceptación:**
  1. **Elegir no navega y el CTA no se escapa (QA22-013).** En el ALTA, tocar una
     modalidad sólo la elige: no avanza de paso ni apaga nada. `CONTINUAR` queda
     inmediatamente debajo de las tres opciones y siempre accionable —hay una
     modalidad elegida desde el primer render—, con el límite del nivel DEBAJO en
     vez de empujando la acción fuera de la pantalla. La elección acusa recibo en
     una región viva que VoiceOver anuncia sin ir a buscarla. El alta pasa a ser
     un flujo de tres pasos: 1 nombre → 2 qué comparar → 3 los datos de ese nivel.
  2. **El guardado termina en la raíz, no en la lectura (QA22-015).** Guardar
     vuelve a `/vinculos` con `router.dismissTo`, con el nombre confirmado y la
     fila de esa persona a la vista; abrir la comparación es una acción
     explícita. Los destinos y el copy se arman en el dominio
     (`relationshipSavedHref`, `relationshipSavedConfirmation`,
     `relationshipSavedMode`, `RELATIONSHIP_SAVED_PARAM`) y el id que se confirma
     es el que devolvió `relationships.savePerson`, validado además contra la
     lista autorizada de la cuenta: un id de URL no abre nada por sí solo.
  3. **Guardar no es calcular (QA22-016).** El estado del CÁLCULO vive separado
     del guardado en `src/domain/relationshipCalc.ts`, puro y compartido:
     `relationshipCalcPhase` (`buscando` · `calculando` · `error` · `pendiente` ·
     `lista`), `relationshipNeedsCalculation` y `relationshipCalcNote`. Se anuncia
     donde pasa —en SU fila y en SU lectura—, nunca reemplazando la pantalla: la
     lista, el patrón propio y el botón de agregar siguen usables todo el tiempo.
     El recálculo automático es UNO por estado del sobre (`relationshipCalcKey`
     sobre persona + nivel + entradas) y la fila admite dos reintentos manuales
     (`RELATIONSHIP_ROW_RETRY_LIMIT`) antes de mandar a la lectura, que es donde
     el reintento tiene todo el contexto. `needs_birth_time` queda fuera de los
     estados recalculables a propósito: ahí no falta una corrida, falta un dato.
     La consulta del sobre se monta sólo para la persona recién guardada, no una
     por cada fila de la lista.
  4. **El nivel es consecuencia de los datos, no una preferencia (QA22-018).**
     `relationshipLevelFromDraft` es la ÚNICA derivación y es la misma regla que
     aplica el backend; la pantalla lo ANUNCIA (`NIVEL QUE PERMITEN ESTOS DATOS`)
     en vez de volver a preguntarlo. Editar entra directo a los datos, con todos
     los campos precompletados y SIN selector de modalidad, y el borrador de una
     persona guardada vuelve a derivar el nivel en lugar de copiar el
     persistido. El pedido de guardado no lleva `level`. "Editar datos de …" está
     siempre disponible: en la lectura y en la fila de la lista
     (`relationshipEditHref`), y guarda SOBRE la misma persona en vez de crear una
     segunda copia.
  5. **Bajar de nivel es tan explícito como subirlo (QA22-023).** `QUITAR LA
     FECHA` se lleva la hora y la ciudad con ella, y `QUITAR LA HORA` baja a fecha
     con fecha: nada queda escrito en pantalla como cargado si el guardado lo va a
     descartar. Cada dato se guarda por lo que es —el signo no se deriva de la
     fecha, no se inventa una hora—, y la zona horaria se resuelve en el backend
     desde las COORDENADAS de la ciudad antes de escribir: si no se resuelve, no
     se guarda nada (fallar cerrado), nunca se cae a la zona del teléfono.
  6. **Dos toques en Guardar no guardan dos veces.** El candado son dos refs, no
     estado de React: `enVuelo` cierra la puerta en el mismo tick —`saving` recién
     existe en el render siguiente— y `guardado` la deja cerrada entre la
     respuesta del backend y el desmonte de la pantalla. Encima, el mismo pedido
     reintentado viaja con la MISMA clave de idempotencia
     (`relationshipSaveSignature` + `createRelationshipIdempotencyKey`): cambiar
     un dato estrena clave, corregir un espacio no.
- **Ajuste de esta revisión (cierre 4A).** El mutex de `save` recupera su forma
  estructural canónica: dos guards consecutivos, primero `if (guardado.current)
  return;` y después exactamente `if (enVuelo.current || block !== null)
  return;` —que es la forma que fija la regresión existente
  `test/nativeDefectsV492.test.ts` ("D4 · no hay submits dobles")—. El
  comportamiento es el mismo que la forma fusionada: cierra el doble toque antes
  del primer `await` y sigue cerrado una vez confirmado el guardado. La
  aserción de `test/vinculosQA22.test.ts` pasa a exigir los DOS guards y en ese
  orden, así que la prueba queda igual de estricta o más, no más débil.
- **Owner:** Claude (frontend).
- **Territorio permitido:** `src/domain/**`, `src/screens/v492/**`, `test/**` y
  `CURRENT_TASK.md`. **Esta pasada no toca `convex/**`** —ni código ni
  `CHANGELOG.md`— ni `app/**`, ni las rutas, ni la superficie web.
- **Archivos de esta pasada.** Dominio: `src/domain/relationshipCalc.ts` (nuevo)
  y `src/domain/relationships.ts`. Pantallas: `src/screens/v492/
  VinculosConnectScreen.tsx`, `VinculosHubScreen.tsx` y
  `VinculosResultScreen.tsx`. Pruebas: `test/vinculosQA22.test.ts` (nueva) y
  `test/vinculosNativeV492.test.ts` (actualizada). Documentación: esta ficha.
- **Commit base:** `ac384cf` (`release: Órbita 1.0.0 (22)`), preservado. 4A no
  toca ningún archivo de los bloques 1, 2 ni 3A, así que sus corridas siguen
  valiendo.
- **Cambio de contrato:** **no.** Ninguna firma de Convex cambia, no hay campos
  nuevos, no hay codegen y no hay nota de contrato: 4A consume
  `relationships.list`, `relationships.savePerson`, `relationships.getComparison`
  y `relationships.refreshComparison` tal como ya existen.
- **Riesgo:** medio. Toca las tres superficies de Vínculos y el camino del
  guardado, pero sin migración, sin escritura nueva y sin auth nueva. El riesgo
  concreto es el ciclo de cálculo: `relationshipNeedsCalculation` decide desde
  una lista cerrada de estados, así que un `status` nuevo del backend se leería
  como "listo" y la fila no ofrecería recalcularlo. El recálculo automático está
  acotado por `relationshipCalcKey` (uno por estado del sobre) justamente para
  que un proveedor caído no lo deje girando.
- **Plan de pruebas:** `test/vinculosQA22.test.ts` (nueva, 21 pruebas) — nivel
  derivado de los datos y bordes que no suben de escalón, paridad de la
  derivación con el backend, borrador que re-deriva en vez de copiar, el nivel
  dicho con lo que agregaría el dato siguiente, lo mínimo exigible al editar
  contra lo prometido en el alta, el pedido que guarda exactamente los datos del
  nivel derivado, destinos unívocos del dominio, confirmación con nombre y lugar,
  guardado que vuelve a la raíz y NO abre la lectura, elegir que no navega ni
  apaga el CTA, `CONTINUAR` pegado a las opciones, edición sin selector, "editar
  datos" presente en las dos superficies, la fase del cálculo como función pura,
  qué se recalcula y cuándo se gasta el intento automático, la persona visible
  antes del cálculo, la regla de recálculo compartida por fila y lectura, el
  doble toque con sus dos guards y su clave de idempotencia, y las tres rutas +
  la superficie web sin moverse. Actualizada: `test/vinculosNativeV492.test.ts`.
  Más `pnpm typecheck` y la suite completa, que **corre Codex**. **Resultado: la
  corrida posterior a este ajuste quedó en verde; está registrada en el *CIERRE
  INTEGRAL DE CÓDIGO* de arriba.**
- **Plan de rollout:** merge por PR a `main`. No cambia ninguna función de Convex
  ni el esquema, así que no hay orden entre back y front ni deploy asociado.
- **Plan de rollback:** revertir el commit del PR. Todo el cambio es de lectura,
  presentación y navegación sobre funciones que ya existían; el único efecto
  persistente sigue siendo el que ya hacía `relationships.savePerson`, con su
  clave de idempotencia. No deja datos ni migraciones detrás.
- **Fuera de alcance:** **el BLOQUE 4B, que queda PENDIENTE**, y el resto del
  plan QA22; cualquier cambio en `convex/**`; el rediseño de la lectura de
  comparación; commit, push, deploy de Convex, codegen, build EAS, TestFlight y
  App Store; otros worktrees.

## QA22 · BLOQUE 2 — Tránsitos: título legible, un solo estado, dos hitos y una pantalla que se lee antes de calcular (2026-08-21) · VERIFICADO

**Verificación (corrida de Codex, posterior a la corrección del `EXACTO AHORA`).**
`pnpm typecheck` **limpio** y **130 focales en verde**. QA22-008, QA22-009,
QA22-010, QA22-011 y QA22-012 quedan cerrados en código; lo que resta es el paso
por el binario, que va con el release. La pasada 3A no toca nada del bloque 2
—`src/domain/transitState.ts`, `src/domain/transitDetail.ts`,
`src/domain/layers.ts`, `src/components/v492/TransitCard.tsx`,
`src/components/v492/Layout.tsx` ni `src/screens/v492/ArcoDetailScreen.tsx`—, así
que la corrida sigue valiendo.

**Ficha de tarea (obligatoria antes de tocar archivos).**

- **Objetivo:** cerrar QA22-008, QA22-009, QA22-010, QA22-011 y QA22-012 del
  registro físico del build 22 (`native-v492/docs/QA-FISICA-BUILD22.md`, leído
  para esta tarea). La lista de Tránsitos se escaneaba en glifos y no dejaba
  elegir un tránsito; el mismo arco decía `ACERCÁNDOSE · EXACTO HOY` en la lista
  y `EXACTO` en su detalle, y encima anunciaba un “próximo contacto” que era el
  de hoy; `HOY` y `EXACTO` se fusionaban en una marca cuando compartían fecha;
  la primera apertura de cada detalle reemplazaba toda la pantalla por
  “Calculando la línea de tiempo…”; y con tres contactos los rótulos de la línea
  saltaban a una segunda fila desde la izquierda.
- **Criterios de aceptación:**
  1. **Título corto legible junto a los glifos (QA22-008).** Cada `TransitRow`
     dibuja `Luna cuadratura tu Marte` en su propio renglón, debajo de la
     notación simbólica —no dentro de ella, que es donde competía por el ancho
     con el ordinal y el orbe—. Los símbolos se conservan y VoiceOver sigue
     recibiendo el titular COMPLETO (`transitHeadline`), no la forma corta.
  2. **Una sola derivación canónica del estado (QA22-009).** `ORB-TRN-001` y
     `ORB-TRN-002` publican `state` con reglas distintas —±6 h del pico contra
     orbe ≤ 0,1°—, así que **el origen realmente diverge**. La derivación única
     vive en `src/domain/transitState.ts` y la usan la fila y el detalle: sale de
     los INSTANTES que los dos sobres ya publican, por eso vale también para los
     sobres persistidos y no necesita deploy. El campo crudo se conserva como
     respaldo. La divergencia y la decisión quedan escritas en
     `convex/CHANGELOG.md`.
     **La regla, cerrada (corrección de la revisión Codex):** antes del pico
     `approaching`; durante el **mismo minuto civil** del instante exacto,
     `exact` / `EXACTO AHORA`; pasado ese minuto, `integrating` —aunque siga
     siendo el mismo día—. La comparación es por minuto en la zona de la persona
     (`sameCivilMinute`), sin ninguna ventana horaria inventada. La primera
     versión dejaba `exact` hasta la medianoche, y eso afirmaba a las 23:40 que un
     contacto de las 16:00 estaba ocurriendo *ahora*: el mismo defecto de
     QA22-009 con otra ventana. `peakToday` sobrevive como dato del RANKING —el
     motivo `EXACTO HOY` sigue siendo cierto todo el día—, y por eso la frase de
     etapa lleva la hora a los dos lados del pico (`Se acerca al punto exacto,
     hoy a las 16:00` · `Ya pasó el punto exacto, hoy a las 16:00`): así el chip
     `INTEGRÁNDOSE` y el motivo `EXACTO HOY` dicen lo mismo en vez de pelearse.
  3. **Sin “próximo contacto” cuando el contacto ya es hoy (QA22-009).**
     `contactWorthNaming` deja fuera de esa línea cualquier contacto que caiga en
     el día civil de hoy: ya lo dicen la etapa, el motivo del ranking y la marca
     `EXACTO` de la línea de tiempo.
  4. **`HOY` y `EXACTO` son dos hitos aunque compartan fecha (QA22-010).** `HOY`
     se ubica en `nowMs` y el contacto en su instante exacto; el contacto que es
     de hoy lleva la hora en el rótulo (`EXACTO 16:00`). La marca fusionada
     `HOY · EXACTO` desaparece.
  5. **La línea proporcional se conserva y los rótulos pasan a una lista
     cronológica (QA22-012).** Un hito por renglón —Inicio / Hoy / Picos /
     Cierre—, con su punto del mismo color que su marca. Se retira la fila con
     `flexWrap`, que es la que reordenaba las etiquetas. VoiceOver mantiene UN
     anuncio, entero y en orden cronológico.
  6. **La primera apertura del detalle se lee entera menos la cronología
     (QA22-011).** Con la fila del ranking que se acaba de tocar
     (`transitPreviewFromRanking`) la pantalla dibuja de inmediato título, etapa,
     significado y acción; la línea de tiempo es lo ÚNICO que muestra su carga,
     su “ya no está en la lista” o su fallo, dentro de su propio bloque y con su
     propio reintento. El adelanto **no** aporta fechas, ventanas, pasadas ni
     trazabilidad.
- **Owner:** Claude (frontend).
- **Territorio permitido:** `src/components/v492/**`, `src/domain/**`,
  `src/screens/v492/**`, `test/**`, `CURRENT_TASK.md` y `convex/CHANGELOG.md`
  (sólo la nota de contrato). **No se tocó código de `convex/**`.**
- **Commit base:** `ac384cf` (`release: Órbita 1.0.0 (22)`), preservado. El
  bloque 1 queda intacto: esta pasada no toca `convex/void.ts`,
  `src/components/void/**` ni `src/services/appRefs.ts`.
- **Cambio de contrato:** **no.** Ninguna firma cambia y no hay codegen. Lo que
  sí hay es una **nota de contrato** en `convex/CHANGELOG.md`: `state` no
  significa lo mismo en los dos análisis, y el cliente publica una proyección
  canónica compatible. `summaryWithCanonicalState` declara además su dependencia
  del copy de etapa que compone el backend, con la degradación segura escrita.
- **Riesgo:** medio. Toca las dos superficies de Tránsitos y el vocabulario de
  etapa. Sin migración, sin escritura y sin auth nueva. El riesgo concreto es de
  copy: si Codex cambia la frase de etapa de un `summary`, el reemplazo deja de
  aplicar y el chip podría volver a discrepar del párrafo (el texto se dibuja
  igual: no se recorta a ciegas).
- **Plan de pruebas:** `test/transitosQA22.test.ts` (nuevo) — título corto,
  etapa canónica compartida por las dos superficies **en los tres tramos del día**
  (antes del pico, durante su minuto, después), `EXACTO AHORA` acotado a ese
  minuto —incluidos `PICO−1 ms`, `PICO+59 999 ms`, `PICO+60 000 ms` y un pico con
  segundos—, el minuto comparado en zona (Buenos Aires, no UTC), respaldo del
  sobre viejo, reemplazo de la frase de etapa, contacto de hoy que no se anuncia
  como próximo, línea con UNO y con TRES contactos y el cableado del adelanto.
  Actualizados: `transitDetailV492` (fijaba `HOY · EXACTO`),
  `arcoDetailNativeV492`, `layerMeaningV492` y `v492CopyA11y`. Más
  `pnpm typecheck` y la suite completa, que **corre Codex**.
- **Plan de rollout:** merge por PR a `main`. No cambia ninguna función de
  Convex, así que no hay orden entre back y front.
- **Plan de rollback:** revertir el commit del PR. Todo el cambio es de lectura y
  presentación: no deja datos ni migraciones detrás.
- **Fuera de alcance:** el resto del plan QA22 (bloques 3+), la unificación de
  `stageFromTrend`/`arcStage` en el backend (queda anotada para Codex), el
  indicador directo/retrógrado sobre la línea de tiempo, commit, push, deploy de
  Convex, codegen, build EAS, TestFlight y App Store; otros worktrees; el piso de
  `testCountGate` (es un piso, y esta pasada sólo suma pruebas).

**Archivos de esta pasada.** Dominio: `transitState.ts` (nuevo),
`transitDetail.ts` (dos hitos, hora del contacto de hoy, adelanto), `layers.ts`
(`transitShortTitle`). Componentes: `v492/TransitCard.tsx`, `v492/Layout.tsx`
(`ArcTimeline`). Pantallas: `v492/ArcoDetailScreen.tsx`. Pruebas:
`transitosQA22.test.ts` (nueva) y actualizaciones en `transitDetailV492`,
`arcoDetailNativeV492`, `layerMeaningV492` y `v492CopyA11y`. Documentación:
`convex/CHANGELOG.md` y esta ficha.

**Estado: VERIFICADO.** La revisión de Codex encontró y se corrigió el punto del
`EXACTO AHORA` que duraba todo el día (`src/domain/transitState.ts` +
`test/transitosQA22.test.ts`); la corrida posterior de Codex cerró el bloque con
`pnpm typecheck` limpio y 130 focales en verde.

---

## QA22 · BLOQUE 1 — El Umbral: entrada inmediata, salida siempre visible y límite que informa (2026-08-20) · VERIFICADO

**Verificación (corrida de Codex).** `pnpm typecheck` **limpio** y **147 focales
en verde**. QA22-001, QA22-002 y QA22-031 quedan cerrados en código; lo que resta
es el paso por el binario, que va con el release. Esta pasada del bloque 2 no
tocó nada del bloque 1 —`convex/void.ts`, `src/components/void/**`,
`src/domain/voidSession.ts` ni `src/services/appRefs.ts`—, así que la corrida
sigue valiendo.

**Ficha de tarea (obligatoria antes de tocar archivos).**

- **Objetivo:** cerrar QA22-001, QA22-002 y QA22-031 del registro físico del
  build 22 (`native-v492/docs/QA-FISICA-BUILD22.md`, leído para esta tarea).
  El Umbral se quedaba en “Cargando tu cielo…” hasta que la action de sugeridas
  —que genera texto con un LLM— contestaba; dibujaba categorías genéricas que
  después se pisaban con las personalizadas; no ofrecía ninguna acción visible
  para volver al selector desde la respuesta, el error, la espera ni el cupo
  agotado; y el estado de cupo agotado no decía cuántas preguntas se usaron.
- **Criterios de aceptación:**
  1. `void.suggestedToday` es una query **aditiva** que devuelve el set de
     sugeridas YA cacheado del día del usuario **sin disparar la action ni el
     LLM**, y `null` cuando el día todavía no tiene set. `void.ask`,
     `void.today` y `void.suggestedQuestions` quedan intactas.
  2. El Umbral muestra la superficie para preguntar (campo + `PREGUNTAR`) y la
     cuota del día apenas resuelve la query de cuota; la carga de sugeridas es
     una sección **localizada** dentro de la fase de entrada. Con el set del día
     ya cacheado —la “carga caliente” que QA22-001 pide no invalidar— la entrada
     dibuja las sugeridas reales sin pagar un LLM.
  3. Nunca se dibujan categorías genéricas que después cambien: o están las del
     día, o está el estado de carga/error de esa sección.
  4. `HACER OTRA PREGUNTA` aparece en respuesta normal, error, carga y cupo
     agotado —las cuatro superficies que QA22-002 nombra—. Resetea **sólo** la
     interacción actual (fase, texto, payload, bloqueo, fallo) y **no toca la
     cuota**: el contador sigue saliendo de la query reactiva.
  5. Copy dinámico exacto del cupo agotado, como estado concreto y primero:
     `Usaste tus {limit} preguntas de hoy. Volvé mañana para hacer más.`
     La frase editorial queda como texto secundario, no como reemplazo
     (QA22-031).
- **Owner:** Claude (frontend), con el cambio de contrato Convex autorizado
  explícitamente por Lucas para esta tarea.
- **Territorio permitido:** `src/components/void/**`, `src/domain/**`,
  `src/services/appRefs.ts`, `test/**`, `CURRENT_TASK.md`, y — por autorización
  expresa — `convex/void.ts` + `convex/CHANGELOG.md`.
- **Commit base:** `ac384cf` (`release: Órbita 1.0.0 (22)`), preservado.
- **Cambio de contrato:** **sí**, aditivo. `void.suggestedToday` (query pública,
  `args: {}`, `returns: { categories } | null`). No agrega tabla ni índice: lee
  `voidPromptSets` por el índice `by_user_date` que ya existe. **No se corrió
  codegen** (lo corre Codex): el módulo `void` ya está enumerado en
  `convex/_generated/api.d.ts`, así que `ApiFromModules` deriva la función nueva
  y el front la consume por `anyApi`.
- **Riesgo:** medio. Toca la lógica de una pantalla y agrega una query de
  lectura. Sin migración, sin escritura nueva, sin auth nueva.
- **Plan de pruebas:** `test/voidUmbralQA22.test.ts` (nuevo) — decisiones puras
  de `src/domain/voidSession.ts`, la query real de Convex contra la base en
  memoria, y los gates de composición del Umbral. Más los focales que ya cubrían
  el archivo (`responsiveShells`, `accessibilityWeb`, `pressableStyleValue`,
  `parityFoundations`, `perfilAppReview`, `convexGeneratedApiGate`) y
  `pnpm typecheck`.
- **Plan de rollout:** merge por PR a `main` como cualquier fix. No cambia
  ninguna función existente, así que un cliente viejo sigue funcionando: sin
  `void.suggestedToday` el front cae al camino de generar y no rompe.
- **Plan de rollback:** revertir el commit del PR. La query nueva es de lectura:
  quitarla no deja datos huérfanos ni migración pendiente.
- **Fuera de alcance:** el resto del plan QA22 (bloques 2+), commit, push,
  deploy de Convex, build EAS, TestFlight y App Store; otros worktrees; codegen
  de Convex; el piso de `testCountGate` (es un piso, y esta pasada sólo suma
  pruebas).

---

## Cierre de frescura, ruta del arco, pestaña Tránsitos y contrato `ORB-TRN` (2026-08-20) · VIGENTE

**Éste es el único bloque vigente del archivo.** El de abajo —*Frescura, Hoy sin
arco y detalles editoriales*— es de dónde viene este trabajo y quedó superado por
éste; la ficha del **RC 1.0.0 (21)** y todo lo que sigue describen el BINARIO y
el release, no el código local.

**Alcance autorizado:** implementación integral del plan en este worktree,
incluido el contrato de capas y el ranking temporal. La implementación se cerró
sin tocar producción; después Lucas autorizó puntualmente **el deploy compatible
de Convex**, ya ejecutado. Siguen fuera: commit, push, EAS, build de distribución
y App Review.
El índice heredado se preserva (`D app/(tabs)/transitos.tsx` · `R100
app/(tabs)/perfil.tsx → src/screens/PerfilScreen.tsx`).

**Qué entra (cuatro cierres):**

1. **El fallo que llega como éxito.** `layers.refreshForDate` podía terminar BIEN
   y devolver igual un sobre `stale` porque el proveedor de efemérides no
   contestó. Sin rechazo no había clasificación, así que el reintento automático
   no se enteraba: la pantalla se quedaba con el cálculo de antes hasta que la
   persona tocara el botón. Ahora hay un **detector puro**
   (`isStaleEphemerisResult`, en `src/domain/layerRetry.ts`) que reconoce ese caso
   —y **sólo** ése: `status === "stale"` **y** un faltante `current_ephemeris` /
   `fresh_ephemeris`—; un `stale` por cualquier otro motivo, y cualquier
   `unavailable`, siguen contando como corrida terminada porque repetirlos
   devolvería lo mismo. Se aplica **después del await**, en los dos lugares: en
   `refreshQueue` (la corrida de `refreshForDate` que enchufa `useLayers`) y en
   `useTransitArc` (`refreshTransitArc`). El resultado se reencauza como
   `LAYER_STALE_EPHEMERIS`, que es transitorio, así que recorre la política de
   siempre: **1500 / 4500 / 9000 ms** y **tope de 20 s** por corrida, sin
   inventar esperas nuevas.
   **El copy del caso, exacto.** Mientras la política reintenta, un dato de HOY
   dice `Actualizado HH:MM · intentando actualizar` y no ofrece control —no hay
   nada que decidir hasta que ese intento termine—; agotados los tres, dice
   `Actualizado HH:MM · no se pudo actualizar` y recién ahí aparece `REINTENTAR`.
   Siempre la línea discreta: **ni tarjeta grande ni estado indefinido**. El
   bloque grande queda donde estaba, para cuando NO hay dato que leer.
2. **`/hoy/arco` queda sólo como compatibilidad.** Ya no monta
   `ArcoDetailScreen` por segunda vez: **redirige** al canónico
   `/transitos/arco/[arcId]` con el `arcId` del tránsito principal del sobre del
   día, y sin `arcId` a `/transitos`. Mientras el sobre viaja no resuelve el
   destino —mandar a la lista ahí sería contestarle "no está" a alguien que pidió
   un detalle concreto—. El detalle vuelve a tener un solo dueño.
3. **La pestaña Tránsitos abre en `Ahora`.** `Ahora` y `Tu momento` son dos
   vistas de la misma sección y el selector cambia de ruta con `replace`, así que
   tocar `Tránsitos` en la barra devolvía a `Tu momento` y no había forma de
   llegar a `Ahora` desde la barra. Ahora el destino es explícito. La decisión
   vive en `src/domain/tabPress.ts` —pura, sin React— y por eso se prueba
   corriendo: re-tocar la activa no navega, un `tabPress` vetado gana, `Tránsitos`
   se abre siempre en su raíz y **las demás pestañas vuelven donde estaban**. El
   tipo del navegador declara el segundo argumento (`params?: { screen: string }`),
   así que el destino no viaja sin tipo.
4. **El contrato `ORB-TRN` publica los cinco campos y el ranking temporal es
   canónico.** `ORB-TRN-001` trae
   `natalHouse`, `previousExactAt`, `nextExactAt`, `rankingWindow
   {startsAt,endsAt}` y `rankingReason`; `ORB-TRN-002` los trae por fila. Se
   actualizaron los comentarios que decían que "todavía no existen" y **se
   conserva la lectura defensiva**: lo que la pantalla dibuja es un sobre
   PERSISTIDO, y uno guardado antes del cambio sigue siendo válido para leer sin
   traerlos. La fila del ranking usa `rankingReason` cuando viene y **no dibuja
   además su etiqueta derivada** (`PICO 16 AGO` al lado de `Exacto hoy` eran dos
   frases del mismo dato que podían contradecirse); la derivada queda como
   respaldo de los sobres viejos. `ORB-TRN-002` pasó a
   `transit-ranking-v2`: exactos hoy → próximos 72 h → ocurridos en las últimas
   72 h → resto activo; después desempata por tiempo, orbe, relevancia natal e
   identidad estable. Con el reloj congelado el 20 de agosto, Marte con pico el
   21 queda delante de Saturno con pico el 9. El **detalle sigue leyendo sólo
   `ORB-TRN-001`**: no toma prestada la casa ni las razones del ranking. Los
   campos nuevos del arco son opcionales sólo al validar cachés anteriores; cada
   cálculo nuevo los publica.

### Estado medido (local, este worktree, 2026-08-20)

| Qué | Valor medido |
|---|---|
| `pnpm typecheck` | **LIMPIO** |
| Suite | **2347/2347** · 220 suites · **0 fallos** (eran 2327; entran los focales de frescura, ruta, copy, prioridad temporal, compatibilidad de caché y QA visual/VoiceOver) |
| Piso del gate | **subido 2327 → 2347**, el conteo REAL de la corrida (el propio gate está cubierto por la suite) |
| `git diff --check` | **limpio** |
| Export web | **PASS** — `pnpm build:web` + `pnpm check:web-export`: 32,15 MB de 50, imagen más pesada 479,3 KB de 500, JS de app 1022,1 KB gzip de 1,25 MB, ficha de búsqueda completa |
| Export iOS | **PASS** — `pnpm exec expo export --platform ios`: bundle `entry-*.hbc` de 8,77 MB en un directorio temporal fuera del repo |
| Árbol e índice heredados | **PRESERVADOS**: índice con sus 2 entradas (`D app/(tabs)/transitos.tsx` · `R100 app/(tabs)/perfil.tsx → src/screens/PerfilScreen.tsx`) |
| `convex/**` | **DESPLEGADO A PRODUCCIÓN** — ranking v2 y contrato de persistencia compatible; sin tabla, índice ni API nueva |
| Convex producción | **PASS** — `exciting-bat-311`, 142 funciones antes y después, catálogo idéntico, cero índices eliminados y schema validado |
| Commit · push · build · EAS · App Store | **NO** — nada de eso se hizo ni se autorizó |
| QA visual | **SIMULADOR REVISADO** con bundle recargado: frescura discreta, Luna y Cumpleluna; se corrigieron orden y duplicados de VoiceOver. **Dispositivo físico pendiente**: no se instaló ningún binario nuevo |

**Archivos principales de esta pasada.** Dominio: `tabPress.ts` (nuevo), `layerRetry.ts`
(detector + código transitorio), `refreshQueue.ts`, `layerFreshness.ts`,
`transitDetail.ts` (comentarios). Hooks: `useTransitArc.ts`. Componentes:
`v492/Status.tsx`, `v492/TransitCard.tsx`, `orbita/TabBar.tsx`. Pantallas:
`v492/ArcoDetailScreen.tsx` (comentarios). Rutas: `app/(tabs)/hoy/arco.tsx`.
Pruebas: `tabPressV492` (nueva) y anclajes/casos nuevos en
`layerRetryPolicyV492`, `layerFreshnessV492`, `hoySinArcoV492`,
`transitDetailV492`, `v492CopyA11y`, `nativeDefectsV492` y `testCountGate`. Más
`scripts/check-test-count.mjs` y esta ficha. Backend: `convex/lib/transitLayers.ts`,
`convex/lib/layerAssembly.ts`, `convex/lib/layerContract.ts`, `convex/layers.ts`,
`convex/content/astrologySources.ts` y `convex/CHANGELOG.md`; regresiones en
`transitLayers`, `layerContract` y `layerOrderingAndRanges`.

**Lo que NO se tocó, a propósito.** `TabBar.web.tsx` queda igual: en web el
chrome es `WebAppShell` y la sección Tránsitos se sirve con `Slot`, así que no
hay stack anidado que reencauzar. `useLayers.tsx` tampoco: el `await` de
`refreshForDate` vive en `refreshQueue`, que es donde entra el detector, y el
hook sólo le enchufa la acción.

**Backend (Codex).** Cerrado y desplegado a producción: los cinco campos de
`ORB-TRN-001` y `ORB-TRN-002` están en el contrato, el ranking v2 usa la fecha
civil y zona horaria pedidas, y la pantalla muestra el motivo que publica el
cálculo. El primer push se detuvo antes de publicar al encontrar una fila
histórica v1: el hash nuevo invalida su lectura, pero Convex igualmente valida
la fila al publicar el schema. El validator de persistencia quedó compatible
con esos snapshots; cada cálculo v2 sigue emitiendo todos los campos. Tras
29/29 focales, 2347/2347 y typecheck limpio, el segundo push completó schema y
deploy. Rollback exacto: RC20 `b2531a19`; function specs anterior y posterior
guardados en el snapshot temporal del deploy.

## Frescura, Hoy sin arco y detalles editoriales (2026-08-20) · SUPERADO POR EL BLOQUE DE ARRIBA

**Éste era el bloque vigente hasta la ficha de arriba**, que lo continúa: la
frescura, `/hoy/arco`, la pestaña Tránsitos y los campos de `ORB-TRN-001` se
cerraron ahí. Lo que sigue describiendo bien es de dónde salió cada pieza. Todo
lo de más abajo —incluida la ficha del **RC 1.0.0 (21)**— describe el estado del
BINARIO y del release, no el árbol de este worktree.

**Alcance autorizado:** `CURRENT_TASK.md`, `app/**`, `src/**`, `test/**` y
`scripts/check-test-count.mjs` dentro de este worktree. **Nada de `convex/**`,
nada de configuración de producción, sin commit, push, deploy, EAS ni build.**
El índice heredado se preserva (`D app/(tabs)/transitos.tsx` · `R100
app/(tabs)/perfil.tsx → src/screens/PerfilScreen.tsx`).

**Qué entra (seis bloques):**

1. **Frescura del sobre.** `src/domain/layerFreshness.ts`: modelo puro
   `fresh · cachedToday · stale · unavailable`. Un dato de HOY que no se pudo
   rehacer es una línea discreta; uno de un día anterior, un aviso compacto; el
   bloque de error grande queda reservado para cuando NO hay dato. El reintento
   automático sigue siendo tres veces (1500/4500/9000 ms) y ahora la acción tiene
   **tope de 20 s**: ninguna promesa queda pendiente para siempre. No se
   reintentan los errores de autenticación, validación ni datos natales, y el log
   dice sólo el código clasificado —nunca el mensaje crudo, que puede traer PII—.
2. **Hoy sin `ARCO DEL TRÁNSITO`.** El bloque del arco sale de Hoy. El Cumpleluna
   sigue siendo lo principal cuando ocurre hoy y, si no, lo es el primero del
   ranking. "Ver todos" y la pestaña llegan a `/transitos` (`Ahora`); el selector
   `Tu momento` no se toca; el detalle se abre por `arcId`. `/hoy/arco` queda
   viva por compatibilidad de deep links.
3. **Detalle del tránsito.** Se llama `DETALLE DEL TRÁNSITO`; significado y
   acción van antes de `DURACIÓN Y MOMENTOS CLAVE`; la tabla que repetía la línea
   de tiempo se retira. Los campos que el backend todavía no publica
   —`previousExactAt`, `nextExactAt`, `rankingWindow`, `rankingReason`,
   `natalHouse`— se leen como OPCIONALES del MISMO sobre `ORB-TRN-001`, sin
   mezclar sobres. La línea de tiempo: inicio y cierre en gris hueco, contacto en
   hueso, hoy en cobre, `HOY · EXACTO` cuando coinciden, año cuando la ventana lo
   cruza y **un solo anuncio** para VoiceOver.
4. **Luna en columna abierta**, sin `Card`: encabezado, `TU GUÍA PARA HOY`
   (Priorizá / Probá / Observá), el área dicha una sola vez, `POR QUÉ SE MUESTRA`
   y el método al final. Sin hora exacta no se inventa casa.
5. **Ciclo lunar abierto:** `INICIO · DESARROLLO · REVISIÓN · CIERRE` con
   fronteras 0/25/50/75/100, cada tramo con foco, acción y pregunta. La fecha de
   transición al tramo siguiente sólo se afirma con raíz exacta. El método
   técnico queda al final.
6. **Modelos determinísticos y pruebas.** Todo lo editorial y lo de frescura vive
   en el dominio, sin reloj ni azar adentro, y se prueba entero. Los anclajes de
   las pruebas viejas se actualizan sin bajar ninguna garantía, y el piso del
   gate se sube al conteo real final.

### Estado medido (local, este worktree, 2026-08-20)

| Qué | Valor medido |
|---|---|
| `pnpm typecheck` | **LIMPIO** |
| Suite | **2327/2327** · 220 suites · **0 fallos** |
| Piso del gate | **subido 2200 → 2327**, el conteo REAL de la corrida (`pnpm check:test-count` en verde) |
| `git diff --check` | **limpio** |
| Export web | **PASS** — `pnpm build:web` + `pnpm check:web-export`: 32,16 MB de 50, imagen más pesada 479,3 KB de 500, JS de app 1,00 MB gzip de 1,25, ficha de búsqueda completa |
| Export iOS | **PASS** — `npx expo export --platform ios`: bundle `entry-*.hbc` de 8,77 MB |
| Árbol e índice heredados | **PRESERVADOS**: índice con sus 2 entradas (`D app/(tabs)/transitos.tsx` · `R100 app/(tabs)/perfil.tsx → src/screens/PerfilScreen.tsx`) |
| `convex/**` | **SIN TOCAR** en esta pasada (lo modificado ahí es del árbol sucio heredado) |
| Commit · push · build · EAS · deploy | **NO** — nada de eso se hizo ni se autorizó |
| QA en dispositivo | **PENDIENTE**: no se instaló ningún binario nuevo |

**Archivos de esta pasada (20).** Dominio: `layerFreshness.ts` (nuevo),
`transitDetail.ts` (nuevo), `layerRetry.ts`, `refreshQueue.ts`,
`layerMeaning.ts`. Componentes: `v492/Status.tsx` (`FreshnessNotice`),
`v492/Layout.tsx` (`ArcTimeline`). Hooks: `useLayers.tsx`, `useTransitArc.ts`.
Pantallas: `HoyScreen`, `ArcoDetailScreen`, `LunaDetailScreen`,
`CumplelunaDetailScreen`, `TransitosLayersScreen`. Pruebas nuevas:
`layerFreshnessV492`, `layerRetryPolicyV492`, `transitDetailV492`,
`hoySinArcoV492`; anclajes actualizados en `layerMeaningV492`,
`v492PrecisionUi`, `arcoDetailNativeV492`, `v492CopyA11y` y `testCountGate`.
Más `scripts/check-test-count.mjs` y esta ficha.

**Dependencias de backend (Codex).** Nada bloquea lo entregado, pero cinco
campos de `ORB-TRN-001` ya tienen su lector y su lugar en pantalla y hoy vienen
en `null`: `natalHouse` (la casa que el contacto activa: hoy el significado del
detalle se arma sin ella), `previousExactAt` y `nextExactAt` (las dos
repeticiones exactas alrededor de hoy, que la línea de tiempo marcaría y el
texto fecharía), `rankingWindow` y `rankingReason` (la ventana y el criterio con
los que la lista considera activo el contacto, que habilitan el bloque `POR QUÉ
SE MUESTRA` del detalle). El front los lee del MISMO sobre y nunca del ranking;
el día que el contrato los publique, aparecen sin tocar una línea de pantalla.

## RC productivo Órbita 1.0.0 (21) — estado medido (2026-08-20) · SUPERADO POR EL BLOQUE DE ARRIBA

**Éste era el único bloque vigente hasta la ficha de arriba.** Cualquier sección
de más abajo que diga "vigente", "estado actual" o "fuente de verdad" describe el
momento en que se escribió, no hoy. En particular, la ficha del **RC 1.0.0 (20)**
quedó **superada** por ésta.

**Veredicto:** el RC **1.0.0 (21) existe, está commiteado, construido, subido y
Apple terminó de procesarlo el 2026-08-20**. Figura **Lista para enviar**,
**caduca en 90 días** y está **en TestFlight interno, grupo Own, con 3 testers**,
con las instrucciones **Qué se debe probar** ya guardadas. **NO está en App
Review y NO está publicado:** el build 21 **no se seleccionó**, **no se hizo *Add
for Review*** y **no se publicó**. **No se desplegó backend en esta pasada.** La
**QA física del build 21 está pendiente entera**: Lucas **todavía no lo
instaló** —el binario que sigue en su iPhone es el **20**—.

El **build 20 queda superado como candidato visual** (no trae el refinamiento de
glifos) y el **build 19 nunca se promueve**.

### Actualización 2026-08-20 (cierre local) · Carta natal + bloque editorial

**Qué cambió respecto de la ficha de arriba:** el árbol de este worktree ya no es
el del binario. Sobre el RC21 se completaron —**sin commitear, sin push y sin
build**— dos bloques:

1. **Carta natal.** Estado visual **cerrado**: la carta completa con sus **siete
   capítulos** y los **CTAs de Plus**. No se regresa.
2. **Bloque editorial** (punto 22 de la *Corrección editorial pre-RC*).
   `src/domain/layerMeaning.ts`: una capa **pura y determinística** de
   *significado + acción*, **sin LLM y sin backend**, que traduce lo que el sobre
   ya calcula —Luna del día, tránsitos, estación vital, tema del año y
   cumpleluna—. Además: el **Ascendente** muestra `INICIO CASA 1` en el hub (es
   la cúspide que inicia la casa 1, **no** una ubicación dentro de ella), el
   **detalle de la Luna** deja de decir la casa tres veces, el **detalle del
   tránsito** explica antes de fechar y reúne el resumen técnico bajo `DATOS DEL
   CONTACTO`, el **mandala** queda en **cuatro líneas** —una por ritmo— sin
   repetir `ring.detail` en los ritmos que sí se calculan y **sin nada entre esas
   líneas y su acordeón**, y el **detalle de Cumpleluna** abre con el estado
   actual: el párrafo que explicaba el ángulo Sol–Luna arriba de todo se eliminó
   y esa metodología queda sólo en `TraceAccordion`.

**Estado medido (local, este worktree, 2026-08-20):**

| Qué | Valor medido |
|---|---|
| `pnpm typecheck` | **LIMPIO** |
| Suite | **220 suites · 2274/2274** · piso del gate **2200** (eran 2257 antes de este bloque; entra `test/layerMeaningV492.test.ts` con 17) |
| `git diff --check` | **limpio** |
| Árbol e índice heredados | **PRESERVADOS**: árbol sucio intacto e **índice con sus 2 entradas** (`D app/(tabs)/transitos.tsx` · `R100 app/(tabs)/perfil.tsx → src/screens/PerfilScreen.tsx`) |
| **Build 21** | **SUPERADO como candidato visual**: el binario **no** contiene ni la Carta natal cerrada ni el bloque editorial |
| **Build 22** | **NO EXISTE.** No se construyó, no se subió y no hay autorización para hacerlo |
| **QA visual local** | **PASS en Simulator**: Carta/Ascendente, Luna, detalle de tránsito, estación vital, tema del año, mandala y Cumpleluna revisados sobre el bundle actual |
| **QA física** | **PENDIENTE ENTERA.** No se instaló ningún binario nuevo; lo que corre en el iPhone de Lucas sigue siendo el **20** |
| Backend, contrato y comercio | **SIN TOCAR** — `convex/**`, `convex/schema.ts`, las firmas públicas, el **precio** y el **entitlement** quedaron intactos |

> **Lectura honesta del estado:** lo que está terminado está terminado **en
> local**. La jerarquía y la accesibilidad se revisaron también en Simulator,
> pero nada de esto se probó en un dispositivo real todavía. Hasta que exista
> un build 22 y su QA física, no cuenta como verificado en iPhone.

### Estado medido

| Qué | Valor medido |
|---|---|
| **Commit del RC** | `84e93cd3e34fa3e30ad54b06b41654047dc0a5df` — *release: Órbita 1.0.0 (21)* · tree `b1d730eab32a44025469929a3975f706f04b25d0` |
| **Worktree del RC** | `/Users/lucas/Documents/Core/worktrees/orbita/release-1.0.0-build21` · rama **local** `release/1.0.0-build21` · **limpio** |
| Worktree de trabajo (éste) | `/Users/lucas/Documents/Core/worktrees/orbita/native-v492` · `feature/native-v492-implementation` · HEAD `52836ad` · árbol sucio **preservado** · **índice intacto con 2 entradas** heredadas (`D app/(tabs)/transitos.tsx` · `R100 app/(tabs)/perfil.tsx → src/screens/PerfilScreen.tsx`) |
| **IPA** | `/private/tmp/Orbita-1.0.0-21.ipa` · SHA-256 `5ab2468174a4d6d1950f7f8baecefc0e34ac32307850b412a83130f63d675a54` · **49146946 bytes** |
| **Delivery UUID** | `b4570ad5-8fd4-4ade-99cc-c44b48e5115d` |
| **Runtime fingerprint** | `52b060ff571a7ed502c7b11ae1976f4e1a7dcdc5` |
| **Procesamiento de Apple** | **TERMINADO el 2026-08-20** · **Lista para enviar** · **caduca en 90 días** |
| **TestFlight** | **interno, grupo Own** · **3 testers** · instrucciones **Qué se debe probar** guardadas |
| **Instalación del build 21** | **PENDIENTE.** Lucas **todavía no lo instaló**. El binario instalado en su iPhone sigue siendo el **20** |
| `pnpm typecheck` | **LIMPIO** |
| Suite | **218 suites · 2236/2236** — es la medición del **RC21** (el mismo número que ya daba el árbol local con el refinamiento de `TransitCard.tsx`, que ahora **viaja dentro del binario**) · piso del gate subido **745 → 2200** |
| Export web · Export iOS | **PASS** · **PASS** |
| Inspección del IPA productiva | **PASS** |
| **Backend** | **NO se desplegó en esta pasada.** `exciting-bat-311` sigue como quedó: **desplegado y verificado, 142 funciones**. El RC21 no cambia contrato, schema ni firmas públicas |
| Webhook RevenueCat productivo | **probado: HTTP 200** (medición previa, sin cambios) |
| App Store Connect | **app `6788918249`** · **suscripción `6803253452`** / producto `orbita_plus_monthly` · **USD 9.99 mensual con 7 días gratis** |
| App Privacy | **Purchases** e **Identifiers** publicados |
| Notas de review | **corregidas** |
| Liberación | **manual** |
| **App Review** | **build 21 NO seleccionado · NO se hizo *Add for Review* · NO publicado** |
| **Build 20** | **SUPERADO como candidato visual.** Commit `b2531a19` · IPA SHA-256 `cf3ad601d8f00cbf504b61b669a342b807eeb67e5b0bc71045f3f3039429fca8` · procesado en TestFlight interno · sigue instalado hasta que Lucas instale el 21 |
| **Build 19** | **NUNCA se promueve** — apunta a Development |
| **Apple Developer Program License Agreement actualizado** | **ACEPTADO personalmente por Lucas.** Ya **no** es bloqueo |
| Snapshot de seguridad | `~/Backups/orbita-native-v492/2026-08-19/` (restauración ensayada, 978/978 sha256) |
| Punto de rollback pre-RC | worktree `rollback/prod-pre-rc20-0823332`, en `0823332` |

> **Los dos números de Apple no son intercambiables.** `6788918249` es la **app**
> (el de las URLs de App Store Connect); `6803253452` es el **recurso de la
> suscripción** dentro del grupo `Órbita Plus` (`22320917`), no la app. El
> producto es `orbita_plus_monthly`.

### El build 19 NO se promueve

El archive Release 19 que quedó en `~/Library/Developer/Xcode/Archives/2026-08-20/`
**apunta a Development**, deliberadamente, para probar la compra Sandbox en el
iPhone de Lucas. Un binario que habla con el deployment de dev tiene cuentas,
compras y cartas de dev: **no es candidato de release** por más que TestFlight lo
acepte.

### Qué trae el build 21 que el 20 no tenía

**`src/components/v492/TransitCard.tsx`** — el refinamiento que hasta ayer era un
cambio local post-RC20 **ahora viaja dentro de un binario**. Qué hace la cabecera
de la fila de tránsito:

- **Los dos cuerpos se dibujan con los glifos vectoriales propios de Órbita**
  (`domain/astroGlyphs` → `AstroGlyph`, el catálogo monocromo que ya usa el resto
  de la app; nada de caracteres Unicode, que en web y Android caen al font de
  emoji).
- **Cuerpo en tránsito en cobre**, **aspecto vectorial al centro** con el color
  del sistema, **punto natal en marfil**. La jerarquía de color es la que dice
  cuál es cuál: cobre = lo que se mueve, marfil = tu carta.
- **Los nombres completos se conservan en el resumen y en la etiqueta de
  VoiceOver.** La fila entera es un solo botón, así que su etiqueta accesible
  sigue diciendo todo lo que se ve —posición, titular **con los nombres**,
  aspecto, etapa, orbe, cambio respecto de ayer, casa, frase del cálculo y fecha
  del punto más exacto—. Los símbolos comprimen la cabecera; no borran el dato.
- **Fallback textual:** un nombre que no resuelva a un glifo del catálogo se
  imprime como **nombre**, en el mismo color. Antes una fila menos compacta que
  un hueco mudo donde va el dato.

Más `ios.buildNumber` **20 → 21**, sobre el snapshot productivo anterior (RC20,
commit `b2531a19`). **Nada más entró.** `version` (**1.0.0**),
`bundleIdentifier` (`com.lucasssram.orbita`) y la app `6788918249` quedaron
intactos.

> ⚠️ **Por eso la QA física va sobre el 21, no sobre el 20.** El build 20 muestra
> la cabecera **anterior**: no es un defecto, es que ese binario es previo al
> refinamiento. Y como Lucas **todavía no instaló el 21**, lo que hoy corre en su
> iPhone sigue siendo el 20.

### Pendiente inmediato, en orden

1. **Lucas instala el build 21 desde TestFlight y ejecuta la QA física** en el
   iPhone real. Es el paso que desbloquea todo lo demás. Foco explícito:
   - **glifos vectoriales en los encabezados de tránsitos** (lo que agrega el 21);
   - **alta limpia**, sin errores residuales de `onboarding:confirmSignupDraft`
     ni de `layers:refreshForDate` (los dos diagnósticos abiertos de la noche del
     19/8; el fix de la reafirmación natal debería haber matado los segundos —
     hay que **confirmarlo contra el build 21**, no asumirlo);
   - **navegación**;
   - **matriz Free/Plus completa**: Free y Plus · trial elegible y trial NO
     elegible · compra Sandbox · restore · cancelación / expiración ·
     reinstalación · cambio de cuenta · borrado · **VoiceOver** (el pendiente que
     el simulador nunca pudo cubrir).
2. **Capturar el paywall real** y los screenshots del build 21.
3. **Completar metadata y Review Information** de la suscripción en App Store
   Connect, incluido el **screenshot de Review Information**. Recordatorio de
   Apple: *"Your first subscription group must be submitted with a new app
   version"* — la suscripción viaja con el binario.
4. **Recién tras todos los gates anteriores**, seleccionar el **build 21** y la
   **suscripción**, **siempre con aprobación separada**: una para **Add for
   Review** y otra distinta para la **publicación**. Ninguna de las dos existe
   hoy.

> **Corrección sobre esa lista, 2026-08-20 (cierre local):** el candidato de esa
> fila ya no puede ser el **21**. La Carta natal cerrada y el bloque editorial
> viven **sólo en el árbol local** y no viajan en ese binario, así que la QA
> física sobre el 21 no cubre lo que hoy se ve en la app. El orden real pasa a
> ser: **build 22 → instalar → QA física → capturas → metadata → Add for Review →
> publicación**. El **build 22 no existe** y **nadie lo autorizó**: construirlo es
> una orden puntual de Lucas, como lo fueron el 20 y el 21.

Fuera de esa fila, siguen abiertos: los **PRs** (el árbol de este worktree no
existe en git; los cortes A/B/C históricos están desactualizados), la **decisión
de precio de Plus** (USD 9.99 sobre un Free que ya entrega las capas completas) y
la evidencia de certificación —estado **06 casi resuelto** (captura de Carta con
Plus del 19/8 21:49) y **recaptura del 02**—.

### Reglas de esta sesión

- **Modelo de trabajo (vigente y acordado):** **Codex organiza y orquesta el
  plan, revisa y valida**; **Claude Code es el ejecutor principal**; **Lucas
  decide y autoriza** lo externo y lo legal (App Store Connect, App Review,
  publicación, acuerdos de Apple, deploys). Cualquier reparto distinto de roles
  que aparezca más abajo en este archivo es **historia**, no la regla de hoy.
- **Preservar el árbol sin commitear de este worktree y no tocar su índice.**
- **No** commitear, pushear, mergear, ni hacer `reset` / `clean` / checkout
  destructivo. **No** borrar nada de `.local/`.
- **No hay ninguna autorización abierta.** El deploy de producción, la subida del
  build 20 y la preparación, build y subida del **build 21** fueron **órdenes
  puntuales y ya se consumieron**: que hayan ocurrido **no** las deja vigentes.
  Hoy **no** se despliega backend, **no** se construye ni se sube otro build, y
  **no** se toca nada externo por cuenta propia.
- **No** seleccionar el build para App Review, **no** tocar *Add for Review*,
  **no** publicar. Siguen siendo **dos aprobaciones separadas** de Lucas, después
  de los gates.
- La trampa del directorio sigue viva: **todo comando de Convex con el `cd` al
  worktree correcto en la misma línea**, y verificar en la salida que el
  deployment sea el esperado antes de dar nada por bueno.

---

## Finalizador durable de identidad en Clerk (2026-08-19) · CERRADO

> **CERRADO y verificado en runtime** (ver "Verificación en runtime" y "Segunda
> corrida", más abajo). El estado vigente del proyecto es el bloque
> `## RC productivo Órbita 1.0.0 (21) … · VIGENTE` de arriba. Esta ficha se
> conserva por su diseño y su evidencia; el rótulo `EN CURSO` original quedó
> **superado**, igual que la frase "el repositorio sigue en PASS técnico local y
> NO listo para lanzamiento": desde entonces hubo commit, deploy a producción y
> TestFlight interno.

**Owner de esa ficha (HISTÓRICO, 2026-08-19):** Claude Code (ejecutor); Lucas
autorizaba lo externo. **Roles de esa etapa (HISTÓRICO):** Claude Code llevó
además el rol que tenía Codex. **Eso ya no rige**: el modelo vigente está en
`### Reglas de esta sesión` del bloque VIGENTE —Codex organiza, orquesta, revisa
y valida; Claude Code ejecuta; Lucas decide y autoriza lo externo y lo legal—.
`convex/**` se tocó dentro de esta tarea de forma explícita, no por accidente de
territorio.

### Objetivo

Que el borrado de la identidad en Clerk sea una **operación durable del
servidor**, y no un paso del cliente, para que el hecho "la identidad ya no
existe" no pueda perderse con el proceso.

### El defecto que cierra

`src/components/PendingDeletionBoundary.tsx:147` guarda ese hecho en
`useState(identityConfirmedFor)`. Si `user.delete()` responde ok y el proceso
muere antes de persistir `identity_deleted`, la memoria se va: el marcador queda
en `backend_deleted`, la sesión en signed-out, y `resolvePendingDeletionBoot`
devuelve `needs-owner` — que pide volver a entrar con una cuenta **que ya no
existe**. Callejón sin salida; la única salida es soporte.

### Diseño

1. **Tombstone sobre el fence que ya existe.** `accountDeletionFences` gana
   `identityDeletedAt?: v.number()`. La fila ya se escribe por `subject` con
   clave seudónima (`SHA-256(dominio|subject)`); promoverla en el lugar es el
   tombstone, sin tabla nueva ni identificadores en crudo permanentes.
2. **Trabajo durable**, copiando el patrón ya probado de `reconcileJobs`
   (generación, señal, lease, watchdog, backoff). Guarda el `clerkUserId` **en
   crudo y de forma transitoria** —no se puede borrar una identidad sin
   nombrarla— y la fila **se borra al terminar**. Lo único permanente es la
   clave seudónima del fence.
3. **`deleteAccountV2` crea el trabajo en su misma transacción**, junto al fence
   y la barrida: o commitean los tres o ninguno.
4. **Runner server-side:** `DELETE /v1/users/{id}` de la Clerk Backend API con
   `CLERK_SECRET_KEY`, con reintentos y watchdog.
5. **El cliente sigue borrando Clerk como camino rápido; el servidor es la
   autoridad y la red.** Corregido el 2026-08-19 tras medir el costo: sacarle el
   paso al cliente obligaba a reescribir la coreografía que codifican las 88
   pruebas de `accountDeletionFlow.test.ts`, y ahí es donde se cuela el riesgo de
   debilitar una prueba sin querer. Lo que se arregla es lo que estaba mal: que
   `useState(identityConfirmedFor)` fuera la **única** prueba. Ahora el boundary
   consulta el tombstone durable, y el borrado sigue siendo inmediato en el caso
   normal en vez de esperar a un trabajo agendado. Los dos caminos son
   idempotentes: el que llegue segundo recibe 404, lo verifica y confirma igual.
6. **Consulta del tombstone sin sesión:** mutation pública acotada, con la
   derivación seudónima hecha en el servidor y cupo por sujeto. Honestidad sobre
   su límite: el cupo frena el martilleo sobre UN id, no una enumeración amplia —
   para eso haría falta limitar por origen, que Convex no expone. El atacante
   necesita conocer de antemano el `subject` de Clerk de la víctima, que es el
   mismo modelo de amenaza que el fence ya aceptó y documentó.

### Semántica de la respuesta de Clerk — fail closed

| Respuesta | Decisión |
|---|---|
| `200` | Identidad borrada. Promueve `identityDeletedAt`. Cierra el trabajo. |
| `404` | Sólo cuenta como prueba si la credencial ya se demostró válida en esa misma corrida. Un 404 por ruta/proyecto mal configurado **no prueba nada**. |
| `401` / `403` | Credencial inválida. No prueba nada, no promueve, reintenta. |
| `5xx` / `429` | Transitorio. Reintenta con backoff. |
| Sin `CLERK_SECRET_KEY` | `not_configured`: el trabajo queda pendiente, no se promueve nada. Inerte pero seguro. |

Regla que no se negocia, heredada del incidente del 404 de RevenueCat: **nunca
promover el checkpoint antes de que Clerk confirme, y nunca inferir el borrado a
partir de un `signed-out`.**

### Criterios de aceptación

- [ ] Matar el proceso entre el borrado en Clerk y la escritura del checkpoint ya
      **no** deja la cuenta trabada: el servidor lo termina solo.
- [ ] Sin `CLERK_SECRET_KEY`, nada se promueve y el comportamiento actual no
      empeora (falla cerrado, no abierto).
- [ ] Ningún camino promueve el checkpoint sin confirmación de Clerk.
- [ ] El fence sigue sin guardar identificadores en crudo de forma permanente.
- [ ] `pnpm typecheck` verde y suite **≥ 2145** (bajar significa prueba borrada
      o debilitada).
- [ ] Cada arreglo verificado en las dos direcciones (revertir → falla → restaurar
      byte a byte → pasa).

### Restricción de territorio

**Prohibido crear archivos nuevos en `convex/`.** El gate
`test/convexGeneratedApiGate.test.ts` exige que todo módulo esté en
`convex/_generated/api.d.ts`, que sólo se regenera con `convex codegen` — y este
worktree no lo corre. Todo va en módulos existentes (`convex/users.ts`,
`convex/lib/accountDeletion.ts`). Tablas nuevas en `convex/schema.ts` sí: el
schema queda fuera del gate.

### Pruebas

TDD. Prueba roja de conducta que reproduzca el callejón sin salida **antes** del
arreglo. Focales: `accountDeletionFlow`, `accountDeletionFence`,
`accountDeletion`, `accountDeletionReadRace`, `convexGeneratedApiGate`.

### Riesgo

Alto por ubicación, no por tamaño: toca el camino de borrado recién certificado
y `test/accountDeletionFlow.test.ts` tiene 2145 líneas sobre este flujo. Mitigación:
TDD estricto, verificación en las dos direcciones y suite completa en cada corte.

### Rollout

Nada se despliega en esta etapa. El orden externo, cuando Lucas lo autorice:
secreto en Convex → deploy a **Development** (que además arrastra la migración
de schema pendiente: `revenuecatRest`, `deleteAccountV2`, `accountDeletionFences`)
→ verificación → recién ahí producción.

### Rollback

Todo sin commitear. Snapshot verificado del árbol certificado en
`~/Backups/orbita-native-v492/2026-08-19/` (978 archivos, restauración ensayada,
978/978 byte a byte).

### Verificación en runtime (2026-08-19, Development)

**Desplegado a Development `dutiful-viper-815`** con autorización puntual de
Lucas. Catálogo live: 127 → **140 funciones**. Migración aditiva; ningún índice
borrado. `convex/_generated/` quedó **sin cambios** (no se agregaron módulos).

**Verificado sin la app, contra el deployment real:**

| Check | Resultado |
|---|---|
| Identidad desconocida | `unknown` — falla cerrado |
| Cupo de la consulta pública | 10 pasan, la 11ª corta con `retryAfterMs` |
| Borrado sin sesión | rechazado con `Authentication required` |
| Runner con id malformado | **defecto encontrado y corregido** (ver abajo) |

**Verificado con la app** (dev build + Metro, simulador `Orbita-Claude`, cuenta
descartable en la instancia de Clerk **de development** `golden-urchin-96`):

```
17:07:29.743  toque en la 2ª confirmación
17:07:30.340  +597ms   barrida en Convex + fence escrito
17:07:30.940  +1197ms  TOMBSTONE PROMOVIDO — Clerk confirmó el borrado
17:07:31.425  +1682ms  proceso matado
```

El finalizador **llamó a la Clerk Backend API con el secreto real, Clerk borró la
identidad, el tombstone se promovió y el trabajo se retiró de la cola en 600 ms,
sin intervención**. `users` sin la cuenta, `accountDeletionFences` con una fila y
su `identityDeletedAt`, `identityDeletionJobs` **vacía** — el Clerk id en crudo
desapareció con el trabajo, como está diseñado. La app quedó limpia: purga local
completa y marcador retirado.

En esa primera corrida el servidor terminó 485 ms **antes** del kill, así que el
callejón sin salida no llegó a existir. Se repitió con la ventana ajustada.

### Segunda corrida — el callejón sin salida, reproducido y resuelto

Cuenta descartable `+test21`, kill a **+1029 ms** en vez de +1682:

```
17:23:16.288  confirmo el borrado
17:23:16.964  +676ms    Convex barre + fence escrito
17:23:17.317  +1029ms   ← PROCESO MATADO
17:23:17.581  +1293ms   el SERVIDOR promueve el tombstone
```

**El kill cayó dentro de la ventana.** Estado congelado en disco, medido
directamente en el AsyncStorage del simulador:

```json
orbita:pending-account-deletion =
  {"userId":"user_3I9JYjODgTDxQeKfasdxLe93qbN","phase":"backend_deleted"}
```

Marcador en `backend_deleted`, sin checkpoint, y la memoria del proceso perdida.
**Ése es exactamente el estado que dejaba a la persona en soporte.** El servidor
completó el borrado en Clerk **264 ms después de que el cliente ya estaba
muerto**: no hay forma de atribuírselo a la app.

Al reabrir, el arranque —que antes habría dicho `needs-owner`, o sea "volvé a
entrar" con una cuenta que ya no existe— **consultó el tombstone, lo encontró
confirmado y purgó solo**. Medido después del arranque:

| Clave | Estado |
|---|---|
| `orbita:pending-account-deletion` | **retirada** |
| `orbita:profile` | **purgado** |
| `orbita:profile-owner` | **purgado** |
| `orbita_install_pinged_v1`, `orbita:first-run` | conservadas (no son de la cuenta) |

Sin bloqueo, sin pantalla de soporte, sin intervención. **El P0 queda cerrado en
código y verificado en runtime.**

**Lo que esto NO cambia:** el veredicto general del repositorio. Siguen abiertos
los pendientes externos de comercio (catálogo Apple/RevenueCat, build nativo con
los módulos, Sandbox, TestFlight, App Review) y la evidencia visual pendiente
(estado 06, VoiceOver, recaptura del 02).

### Defecto encontrado en runtime y corregido

`ctx.db.get()` con un id malformado **tira**, no devuelve `null`. El runner
usaba `ctx.db.get(args.jobId as any)` sin validar, así que reventaba
(`Invalid ID length 29`) en vez de ser el no-op seguro que su documentación
prometía. Corregido con `ctx.db.normalizeId()` en las dos entradas (claim y
settle), verificado en las dos direcciones **contra el deployment real**: antes
reventaba, después es un no-op silencioso y no promueve nada.

No lo agarró la suite de 2183 pruebas ni el typecheck: lo agarró llamar a la
función. La base en memoria devuelve `null` para cualquier id; la real tira.

### Hallazgos abiertos, NO investigados — para Codex

0. **BLOQUEANTE en iPhone físico: el campo del código de verificación NO acepta
   entrada del teclado.** En dispositivo real (iPhone 13 Pro Max, iOS 26.6), en
   el login (SignInScreen): los recuadros del código **nunca toman foco** — no se
   puede escribir a mano, no se puede borrar, no se puede tocar ningún recuadro.
   Lo ÚNICO que logró escribir fue el autofill de QuickType (el código leído del
   mail), que entró mal (`730879`, "Incorrect code") y quedó clavado sin forma de
   corregirlo. Sin autofill, el login es directamente imposible en dispositivo
   físico. **No reproducible en simulador**, donde el flujo de foco se comporta
   distinto y no existe QuickType — por eso 15 pasadas de certificación no lo
   vieron. Los archivos de la pantalla están byte a byte idénticos al árbol
   certificado (verificado contra el snapshot): defecto preexistente de V4.9.2,
   no de esta sesión. **Bloquea cualquier prueba en dispositivo y bloquea App
   Review** — el revisor usa un iPhone real.

Aparecieron durante la corrida de runtime y **no son de este paquete**. No se
tocó nada de esto; queda anotado para que no se pierda:

0b. **UX en iPhone físico (feedback de Lucas): la Carta no tiene vuelta atrás.**
   Entrando a Perfil → carta, la pantalla `CARTA · TU BASE` no muestra flecha de
   volver; la única salida es la tab bar. En pantallas empujadas dentro de una
   sección tiene que haber un back visible. Revisar el resto de los detalles
   (arco, luna, cumpleluna, etc.) por el mismo patrón.

### Verificado en iPhone físico (2026-08-19, 20:51)

**El paywall renderiza el contrato completo en dispositivo real:**
`Mensual · 7 DÍAS GRATIS · $9.99 por mes`, beneficios reales, Términos y
Privacidad, salida a Free. Eso confirma lo único que faltaba: `P1M` (el cliente
descarta el Offering si el período no es exactamente un mes), el precio llega de
StoreKit y la elegibilidad del trial la confirmó Apple. RevenueCat quedó
identificado con el Clerk ID real (`user_3G2rn…`), no un `$RCAnonymousID` —
verificado en los logs del SDK. **La compra en Sandbox sigue pendiente.**

### Defecto BLOQUEANTE de dispositivo, encontrado y corregido en esta sesión

`CodeInput` (el código de verificación del login) dependía de que un TextInput
con `opacity: 0` recibiera los toques. Con New Architecture en iPhone físico esa
vista queda fuera del hit-testing: **el login era imposible en dispositivo** —
sin foco, sin teclado, sin poder borrar; sólo escribía el autofill de QuickType
y sin forma de corregirlo. En simulador el `autoFocus` inicial lo disimulaba.
Arreglo: un `Pressable` real captura el tap y enfoca por ref; el input oculto
lleva `pointerEvents="none"`. Regresión en `test/codeInputDeviceFocus.test.ts`
(4 pruebas), verificado en las dos direcciones y **probado en el iPhone**: el
login completo funcionó después del arreglo.

1. **`[CONVEX M(onboarding:confirmSignupDraft…)]`** — error visible en la app
   **antes** del alta, en la pantalla de Clerk. No lo causó el borrado ni el
   finalizador: ya estaba al llegar ahí. No bloqueó el flujo.
2. **`[CONVEX A(layers:refreshForDate)]`** — dos ocurrencias al entrar a Hoy con
   una cuenta recién creada. La pantalla igual renderizó con datos reales
   (4 capas, ranking, Urano trígono Marte).

Ninguno de los dos frenó el alta ni el borrado. No se diagnosticaron.

### Trampa operativa descubierta — dejar por escrito

El worktree `native-v492` y el checkout `projects/orbita` comparten el **mismo**
`CONVEX_DEPLOYMENT` de dev, pero tienen backends con **tres semanas de
diferencia**. Un comando de Convex corrido desde el directorio equivocado apunta
al deployment correcto con el código incorrecto, y **no avisa**.

Ya pasó en esta corrida: un `npx convex dev --once` desde `projects/orbita` casi
pisa Development con el backend viejo —habría borrado `payments/revenuecatRest`,
`deleteAccountV2` y `accountDeletionFences`—. Lo salvó la validación de schema de
Convex, que se negó porque los datos de dev ya tenían campos que el schema viejo
no declara. Con la base más vacía habría entrado sin quejarse.

**Siempre el `cd` en la misma línea del comando.**

### Herramienta instalada

`idb` (cliente Python de `idb-companion`, que ya estaba por brew) quedó en un
venv aislado: `~/.venvs/idb/bin/idb`. Se instaló con el Python **3.9 del
sistema**: `fb-idb 1.1.7` no es compatible con Python 3.14 (`asyncio.get_event_loop()`).
No se tocó el Python del proyecto ni el del sistema.

### Fuera de alcance

Deploy, configuración del secreto, dashboards, comercio nativo, Android, web,
recaptura de evidencia visual.

---


## Reestructura de producto probada en iPhone (2026-08-19, noche) · VIGENTE

Ronda de cambios de producto decididos por Lucas probando el dev build en su
iPhone 13 Pro Max. Todo con TDD, suite completa en verde tras cada corte.
**Suite: 2212/2212 · 213 suites. Piso del gate subido: 745 → 2200.**

### 1. La pestaña 5 es "Carta" y muestra el hub directamente

Plan aprobado y ejecutado (5 cortes; detalle en
`~/.claude/plans/bien-no-pero-ac-eventual-biscuit.md` y en `test/perfilTuCarta.test.ts`):

- `LayerScreen` ganó un slot `action` en el header (44×44, prioridad sobre `meta`).
- `/perfil` nativo monta `CartaHubScreen`; web sigue mostrando el `PerfilScreen`
  administrativo **sin ningún cambio** (wrappers `perfil-index.tsx`/`.web.tsx`;
  garantía fijada por test de grafo + export web verificado: `CARTA · TU BASE`
  con 0 ocurrencias en el bundle web, límites intactos).
- Lo administrativo vive en `/perfil/ajustes` (nativo): `DetailLayerScreen` con
  `←` + `PerfilAjustesBody`, exportado desde el MISMO `PerfilScreen.tsx` para no
  mover el texto que ~12 tests fijan. El engranaje ⚙︎ (32pt, línea 40 — la
  heredada del Mono lo recortaba) reemplaza a la fecha en el header del hub y
  está en las 4 fases, invitado incluido.
- Deep links: `/carta` y `/perfil/carta` nativos redirigen a `/perfil` en un
  salto; web intacta. Fallbacks de los 3 detalles → `/perfil`.
- Título de pestaña: "Perfil" → "Tu carta" → **"Carta"** (iteración de Lucas).
  El name de ruta sigue siendo `perfil`. Test nuevo de coherencia
  LABELS (TabBar) ↔ Tabs.Screen (tabs-layout), dualidad que nadie fijaba.
- **El hallazgo "entro a mi carta y no puedo volver" queda resuelto por
  estructura**: el hub ya no es un detalle sin back, es la raíz de la pestaña.

### 2. Vínculos: las personas arriba, el patrón abajo

El hub invierte el orden: `Personas guardadas` + AGREGAR UNA PERSONA primero
(la acción), `Tu patrón relacional` después (contexto natal que no cambia).
Test que fija el orden en `vinculosNativeV492.test.ts`.

### 3. Agregar persona es un flujo de 3 pasos

`VinculosConnectScreen`: PASO 1 NOMBRE → PASO 2 QUÉ COMPARAR → PASO 3 SUS
DATOS. El motor de la pantalla (draft, validación, idempotencia, búsqueda de
ciudad) no se tocó: la máquina de pasos sólo gatea qué se muestra.
- El borrador sobrevive al ir y volver entre pasos; **se pierde al salir de la
  pantalla — decisión consciente de Lucas** (nada se persiste a medias).
- **Editar una persona existente NO pasa por el wizard**: entra directo con
  todos los bloques visibles.

---

## ORDEN DE ESTA NOCHE — deploy a PRODUCCIÓN + TestFlight (2026-08-19) · EJECUTADA — SUPERADA

> **EJECUTADA Y SUPERADA (2026-08-20).** Esta orden ya se cumplió: producción
> `exciting-bat-311` está **desplegada y verificada con 142 funciones**, el
> webhook productivo de RevenueCat dio **200**, y el build **1.0.0 (20)** está
> **subido y procesado en TestFlight interno (grupo Own)** desde el commit
> `b2531a19` en el worktree `release-1.0.0-build20`. **Nada de acá se vuelve a
> ejecutar sin una orden nueva.** El estado vigente está en el bloque
> `## RC productivo Órbita 1.0.0 (21) … · VIGENTE`. Se conserva por los pasos y
> las advertencias, que siguen siendo la referencia operativa.

**Lucas autorizó lanzar esa noche**: backend a producción y build a TestFlight
interno. Codex ejecutó el deploy; Lucas cargó los secretos; Claude preparó el
paquete y armó el archive.

### Para Codex: el deploy a producción, paso a paso

1. **SIEMPRE desde el worktree** — la trampa del directorio ya casi pisa
   Development una vez (ver más abajo). El comando completo, en UNA línea:
   ```
   cd /Users/lucas/Documents/Core/worktrees/orbita/native-v492 && npx convex deploy
   ```
   (`convex deploy` apunta a prod usando la config del proyecto; verificar en la
   salida que diga `exciting-bat-311` ANTES de confirmar. Si dice otra cosa,
   abortar.)
2. **Prerrequisito**: Lucas ya cargó en el env de producción de Convex:
   `CLERK_SECRET_KEY` (live), `ORBITA_ENVIRONMENT=production`,
   `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_AUTH` (header NUEVO, distinto
   al de dev), `REVENUECAT_SANDBOX_REVIEW_USER_IDS` (el Clerk ID **de
   producción** de Lucas — se obtiene tras el primer login del build). Sin la
   allowlist, las compras de TestFlight (sandbox contra prod) se descartan.
3. **Verificación post-deploy** (read-only):
   - `npx convex function-spec` → ~140 funciones, presentes
     `users:deleteAccountV2`, `users:checkIdentityDeletionStatus`,
     `payments/revenuecatRest:requestStoreReconcile`, `layers.*`,
     `relationships.*`. → **RESULTADO: 142 funciones, verificado.**
   - La web viva (orbitaastrologia.xyz) sigue funcionando: smoke anónimo de
     `/`, `/home`, `/carta`. El schema es aditivo (verificado en dev: sólo
     índices nuevos) y ninguna firma pública se retira, pero ES la primera vez
     que V4.9.2 toca prod.
   - Webhook de RevenueCat #2 (prod): mandar Test Event → 200, y fila TEST en
     `paymentEvents` con environment correcto. → **RESULTADO: HTTP 200.**
4. **Advertencia de proceso, explícita**: ~~este deploy corre código que NO está
   en ningún commit (398 entradas sin commitear)~~ → **RESUELTO**: el RC se
   commiteó como **`b2531a19`** (*release: Órbita 1.0.0 (20)*) en el worktree
   limpio `release-1.0.0-build20`. **Este** worktree sigue con su árbol sucio
   preservado y su snapshot en `~/Backups/orbita-native-v492/2026-08-19/`, y los
   PRs siguen siendo la deuda número uno.

### Estado del build para TestFlight · **SUPERADO — el build 20 ya existe**

> El build **1.0.0 (20)** se archivó, se firmó y se subió: **IPA SHA-256
> `cf3ad601d8f00cbf504b61b669a342b807eeb67e5b0bc71045f3f3039429fca8`**, build
> local reproducible, **procesado en TestFlight interno, grupo Own**. Lo que
> sigue vale sólo como registro de cómo se preparó.

- ~~`buildNumber` **20** … **todavía no existe: hay que archivarlo**~~ →
  **HECHO.** `buildNumber` **20**, versión 1.0.0, bundle `com.lucasssram.orbita`.
- **El build 19 no se promueve** — sigue vigente. El archive Release que quedó en
  `~/Library/Developer/Xcode/Archives/2026-08-20/` apunta a **Development**
  (deliberado, para probar la compra Sandbox en el iPhone de Lucas). Un binario
  que habla con el deployment de dev no puede subirse como candidato de
  producción por más que TestFlight lo acepte: las compras, las cuentas y las
  cartas serían las de dev. Sirve como prueba interna y nada más; el RC sale de
  un archive NUEVO, el 20, con las EXPO_PUBLIC_* de PRODUCCIÓN.
- ~~Falta el **archive Release del build 20**~~ → **HECHO**, con las
  EXPO_PUBLIC_* de PRODUCCIÓN (Convex prod + `pk_live_` de Clerk + la misma key
  de RevenueCat). La advertencia sigue valiendo para cualquier archive futuro:
  `.env.local` del worktree apunta a DEV — el archive corre con el env de prod
  **exportado en el proceso**, nunca editando ese archivo.
- ~~Credenciales de firma: falta el certificado de DISTRIBUCIÓN~~ → **resuelto**:
  el IPA se firmó, se subió y **App Store Connect lo procesó**.

---

## Ronda nocturna de QA en iPhone — 5 defectos más (2026-08-19, 22:00–23:00) · VIGENTE

Lucas probando en su iPhone 13 Pro Max; cada arreglo con TDD y suite completa.
**Suite final: 2219/2219 · 215 suites.**

1. **Spinner clavado al cambiar de pestaña** — `refreshing` (flag COMPARTIDO del
   ciclo de capas) iba directo al RefreshControl: cualquier pestaña montada
   durante un refresh de fondo aparecía con el control expandido y el contenido
   empujado hasta que el recálculo (proveedor mediante) terminara. Arreglo: el
   spinner refleja el GESTO local (`pulled` + `sawBusy` en LayerScreen); el
   refresh de fondo es invisible. `test/layerRefreshSpinner.test.ts`.

2. **La comparación de Vínculos no persistía NUNCA para una persona nueva**
   (`RELATIONSHIP_INPUT_CHANGED_DURING_REFRESH` en loop). Causa raíz: la
   reafirmación de identidad natal (`applyCalculatedNatalChart`, rama reuse)
   patcheaba `updatedAt: now` en CADA refresh de capas aunque nada cambiara, y
   el `inputHash` de la comparación incluye ese timestamp; con la comparación
   tardando segundos (proveedor), la ventana estaba casi siempre abierta.
   Arreglo: la reafirmación sólo escribe si la identidad REALMENTE difiere
   (guard `identidadYaVigente`). `test/natalReaffirmNoOp.test.ts`.
   **⚠️ PENDIENTE DE DEPLOY a Development** — hasta el próximo
   `npx convex dev --once` el teléfono sigue viendo el bug.
   Probable causa también de los errores `layers:refreshForDate` anotados antes.

3. **La tarjeta de precisión no mostraba los datos guardados** — "HORA GUARDADA:
   Hora exacta" era un rótulo que prometía un dato y entregaba una categoría, y
   tras editar con un error en el medio no había forma de verificar qué usó la
   carta. Ahora: fila `DATOS` (fecha · hora · lugar reales, vía
   `birthData.getCurrent` — gate de cartaV492 ajustado con intención, sólo para
   esta pantalla y sólo para mostrar), `PRECISIÓN`, y `SE CALCULÓ CON` sólo
   cuando informa algo (sin hora exacta). Verificado además contra la base: la
   edición de Lucas SÍ había guardado (11 Nov 1996 · 10:32 · CABA) y el
   Ascendente nuevo es correcto — el error que vio fue ruido del refresh.

4. **Colores de las barras de Vínculos invertidos** (decisión de Lucas): lo
   fluido en COBRE (la marca, cálido, es lo que más se llena) y la tensión en
   azul acero. La semántica no cambia — el color dice balance, nunca cantidad;
   un color por cantidad convertiría la barra en el puntaje que el canon
   prohíbe (se le explicó y aceptó el trade-off).

5. **"EN RESUMEN" antes de POR DIMENSIÓN** — lectura general PUNTUAL del
   vínculo: abre nombrando los contactos que más pesan ("su Venus con tu Sol,
   en Deseo"), extraídos de la frase canónica de los drivers
   (`relationshipDriverShortName`; el contrato los publica como prosa, no como
   estructura); si una frase no matchea cae a la versión contable, nunca
   inventa. Factual, sin nota: `relationshipComparisonSummary` +
   `relationshipSummaryLine` en `src/domain/relationships.ts`.

Aclaración registrada para QA: **"se me fue el Plus" NO fue un bug** — el reloj
de Sandbox comprime el mes a 5 minutos, renueva 6 veces y expira; la app volvió
a Free honestamente (caso de la matriz de aceptación, cumplido).

---

## Comercio nativo — configuración externa hecha (2026-08-19) · VIGENTE

Sesión de configuración con Lucas en los dashboards. **Autorizada por él paso a
paso.** Development recibió dos deploys puntuales autorizados.

### App Store Connect — HECHO

| Qué | Valor |
|---|---|
| App | `Órbita: Astrología` · bundle `com.lucasssram.orbita` · **Apple ID `6788918249`** |
| Subscription Group | `Órbita Plus` · **Group ID `22320917`** |
| Producto | `orbita_plus_monthly` · `Órbita Plus Mensual` · **1 month** · resource ID `6803253452` |
| Precio | **USD 9.99**, propagado a los 175 países (Argentina también en USD, decisión de Lucas) |
| Introductory Offer | **Free for the first week** · 175 países · sin fecha de fin |
| Localización | Spanish (Mexico) · `Órbita Plus` / `Más profundidad sobre tu carta natal` |
| Estado | `Prepare for Submission` |

> **Los dos números no son intercambiables.** `6788918249` es la **app** — el
> que va en las URLs de App Store Connect (`/apps/6788918249/testflight/ios`,
> como ya figura en `docs/app-store-launch-pack.md`). `6803253452` es el id del
> **recurso de la suscripción** dentro del grupo, no el de la app. Esta ficha
> los tenía cruzados y anotaba el de la suscripción como "Apple ID" de la app.

**Se creó y se borró una suscripción anual** (`orbita_plus_anual`). No va: el
paywall no tiene selector de plan —`nativeCommerce.ts:153` toma siempre
`plans[0]`— y los Términos describen un solo mensual. Agregarla es una tarea
aparte con su UI, su copy legal y sus pruebas.

**Pendiente en Apple:** el **screenshot de Review Information**. Se deja para
después del build, porque hoy el paywall no puede mostrar un plan y una captura
de un paywall vacío es peor que ninguna. Aviso de Apple a tener presente: *"Your
first subscription group must be submitted with a new app version"* — la
suscripción viaja con el binario, no se aprueba sola.

### RevenueCat — HECHO

| Qué | Valor |
|---|---|
| App | Apple, bundle `com.lucasssram.orbita` |
| Credenciales | In-App Purchase Key `.p8` + Issuer ID cargados |
| Producto | `orbita_plus_monthly` (creado a mano, no importado) |
| Entitlement | **`orbita_pro`** con el producto adjunto |
| Offering | **`orbita_plus`**, Default, **una** package `$rc_monthly` |
| Secret API key | **v1** (el backend pega contra `/v1/subscribers`; una V2 daría 401) |
| Webhook | `https://dutiful-viper-815.convex.site/webhooks/revenuecat` · Sandbox only · header aleatorio de 64 chars · HMAC signing off (el backend autentica por header) |

**Se borró el Offering `default`** que RevenueCat crea solo, con sus packages
Weekly/Yearly/**Lifetime**. Con él como Default el paywall quedaba vacío
(`availablePackages.length !== 1`) y encima exponía un `lifetime`, que el backend
tiene prohibido conceder. Queda un entitlement viejo `Orbita Pro` con 3 productos
placeholder: inofensivo —el código sólo mira `orbita_pro`— pero conviene limpiarlo.

### Verificado contra el sistema real

**Offerings, con la key pública, como los pediría el SDK:**

```
current_offering_id: orbita_plus
  orbita_plus  ← CURRENT
    $rc_monthly  ->  orbita_plus_monthly
```

Cumple `availablePackages.length === 1` y `packageType === "MONTHLY"`.
**`subscriptionPeriod === "P1M"` NO se puede verificar desde acá** —lo aporta
StoreKit en el dispositivo— y queda para el Sandbox.

**Webhook:** evento de prueba **200**, procesado y auditado en `paymentEvents`
(`eventType: TEST`, `environment: SANDBOX`). El `rawPayload` guardado contiene
sólo campos de lifecycle: sin aliases ni atributos del suscriptor.

**Env de Convex Development:** `CLERK_SECRET_KEY`, `ORBITA_ENVIRONMENT`,
`REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_AUTH`.
`REVENUECAT_LIFETIME_PRODUCT_IDS` ausente = vacía, que es lo correcto.

**Cliente:** `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` agregada a
`projects/orbita/.env.local` (10 públicas). Falta cargarla en las variables de
EAS cuando se arme el build: el build no lee el `.env.local` local.

### DEFECTO ENCONTRADO Y CORREGIDO — el webhook perdía compras

`revenuecatWebhook` pasaba el evento **crudo** como argumento de la mutation.
Convex valida los argumentos ANTES de entrar al handler y rechaza los nombres de
campo que empiezan con `$`. RevenueCat manda `subscriber_attributes` con
`$displayName`, `$email` e `$idfa`, y los completa solo:

```
500 — Field name $displayName starts with a '$', which is reserved.
  at validateObjectField (convex/values/value.ts:163:11)
```

**No era un artefacto del evento de prueba: pasa con eventos reales.** Cada
webhook devolvía 500, RevenueCat reintenta una cantidad acotada y abandona. Un
`INITIAL_PURCHASE` perdido = Apple cobró y Convex se quedó en Free.

`sanitizeRevenueCatEvent` ya existía pero corre **dentro** de la mutation, o sea
después de la validación que explotaba. El arreglo es `stripConvexReservedKeys`
en `convex/lib/revenueCatEvents.ts`, aplicado en el httpAction antes de cruzar la
frontera: saca en profundidad las claves `$` y `_` y **conserva todo lo demás**,
porque la mutation necesita el evento completo para identidad, transfers y
entitlements.

Regresión en `test/revenueCatReservedKeys.test.ts` (8 pruebas). Verificado en las
dos direcciones **contra el deployment**: antes 500, después **200**.

### Lo que sigue, en orden

1. **Build nativo nuevo** con los módulos de RevenueCat. El binario actual
   (build 18, 16/08) no los tiene — verificado en `ios/Podfile.lock`. Ninguna
   actualización OTA los agrega. Cargar las `EXPO_PUBLIC_*` en EAS.
2. **Compra en Sandbox**: verificar `P1M`, la elegibilidad de los 7 días, compra,
   restauración, cancelación y Customer Center.
3. **Screenshot del paywall real** → Review Information en ASC.
4. **Recaptura del estado 06** (Carta), que necesita el entitlement Plus real.
5. Recién ahí, TestFlight y App Review.

### Sigue sin resolverse

El **precio**: USD 9.99/mes por un Plus que agrega casas, aspectos y dos
preguntas, sobre un Free que ya entrega las capas de tiempo completas. No frena
nada técnico, pero es una decisión de producto pendiente: o Plus abre más, o el
precio baja, o Free da menos.

---

## Identidad, borrado y comercio — cierre técnico local (2026-08-19) · VIGENTE

**Veredicto único: PASS técnico local del código auditado y de la suite. NO
LISTO PARA LANZAMIENTO NI PUBLICACIÓN.** Todo lo de abajo es local y sin
commitear. De este delta **no** hubo deploy, build nativo nuevo, compra sandbox,
dashboard de Apple/RevenueCat, TestFlight, App Review ni producción. Commit,
push y deploy siguen **prohibidos** hasta autorización explícita de Lucas.

### Estado medido (verificado por Codex el 2026-08-19)

| Qué | Valor |
|---|---|
| Rama | `feature/native-v492-implementation` |
| HEAD | `52836ad5f4ad6d6c72f389069ff73f008d45be28` |
| Working tree sin commit | **381 entradas** con `-uall` = 129 tracked + 252 untracked |
| Índice | **2 entradas heredadas**: `D app/(tabs)/transitos.tsx` · `R100 app/(tabs)/perfil.tsx → src/screens/PerfilScreen.tsx` |
| `pnpm typecheck` | **PASS** |
| Suite completa | **2145/2145**, 196 suites, 0 fail — `node --import tsx --test test/*.test.ts`; `test-output.log` actualizado |
| `pnpm check:test-count test-output.log` | **PASS** (mínimo 745) |
| `git diff --check` y `--cached --check` | **PASS** |
| Focal final identidad/borrado/comercio/bindings | **PASS**; bindings gate PASS **sin codegen**; staging intacto |

### Qué quedó cerrado en el código (local)

1. **Reautenticación real de Convex ante A → B.** `ConvexProviderWithAuth` con
   hook propio: la identidad de `fetchAccessToken` cambia con el `userId`. El
   adapter anterior memoizaba sólo por org/rol y dejaba a Convex hablando como la
   cuenta anterior. `ensureUser` publica `ready` **sólo** si el `clerkUserId` de
   la fila devuelta coincide con el dueño capturado.
2. **Entitlement correlacionado de punta a punta.** `subscriptions.getCurrent`
   devuelve `clerkUserId` y **todas** las superficies de comercio derivan de
   `safeEntitlement`. Sin correlación el estado es neutral: cero Comprar,
   Restaurar, gestión, portal, oferta e impresión. La oferta y la impresión
   exigen entitlement correlacionado + foco real + `activation === "idle"`.
3. **Comercio nativo endurecido.** Paywall, Perfil, owner gates por dueño,
   restore/portal/Customer Center y el marcador de compra en disco y memoria. El
   backend de RevenueCat ya tiene la pasada local de hardening y reconciliación
   descrita en las secciones de abajo. **No se probó ningún cobro real.**
4. **Borrado con autoridad única.** `deletion_requested` se persiste **antes** de
   tocar nada; `PendingDeletionBoundary` es el único dueño de la mutación de
   Convex, del borrado de Clerk, del checkpoint y de la purga; el endpoint legado
   `deleteAccount({})` falla cerrado; en web no se purga el storage global
   (`localStorage` es del origen y compartido entre pestañas); la recuperación
   ofrece email + código y **no** OAuth ni alta de cuenta nueva.
5. **Fence de supresión.** `accountDeletionFences` se escribe en la **misma
   mutation** que la barrida —una transacción— con una clave versionada
   `SHA-256(dominio | subject)`, **seudónima**, sin identificadores en crudo y sin
   expiración. Impide que un token de Clerk todavía válido recree la cuenta desde
   otro dispositivo, otra pestaña o un retry tardío. **No es anonimización ni es
   irreversible**: con un subject candidato se puede comprobar la pertenencia.

### Contratos de comercio VIGENTES (los que mandan si un doc viejo dice otra cosa)

| Contrato | Regla vigente |
|---|---|
| Superficie de reconciliación | **Mutation** `payments/revenuecatRest:requestStoreReconcile`, `args: {}`, deriva la cuenta de `ctx.auth` y devuelve `{ status: "queued" \| "cooldown" \| "unauthenticated" }`. La action `reconcileMyStoreEntitlement` **ya no existe**: era at-most-once y podía morir antes de crear el trabajo. |
| Lectura REST y 404 | **Un 404 NO revoca.** `/v1/subscribers/{id}` es GET-or-create: un 404 significa ruta, proyecto o credencial mal configurados, y leerlo como "no compró nada" le sacaría el acceso a alguien que pagó. Sólo un **200/201 con la forma completa y sin el entitlement** retira. 5xx, 429, 401/403 y shape inválida no conceden ni revocan. |
| Identidad ambigua | **Cuarentena: no se reconcilia ninguna cuenta.** Se audita `ignored_ambiguous_identity` y se resuelve a mano. Cero matches es distinto: no se marca procesado y el retry de RevenueCat lo vuelve a traer. |
| Cambio de cuenta | **`logIn(B)` directo, sin logout intermedio.** Convex re-autentica con el cambio de `userId`; el estado de tienda se publica atado a su dueño y se descarta si la identidad cambió durante el `await`. |

Las pasadas 16 y 17, más abajo, describen los contratos **anteriores** a estos.
Están rotuladas HISTÓRICO — SUPERADO y no se usan como referencia.

### Limitación abierta, release-blocking

Si `deleteUser` de Clerk **termina** y el proceso cae **antes** de persistir
`identity_deleted`, ese checkpoint sólo existía en memoria. Al reiniciar, el
arranque queda **fail-closed** y la salida es soporte: **no hay recuperación
self-service**.

Cerrarlo bien exige una integración server-side durable con la **Clerk Backend
API** y `CLERK_SECRET_KEY` —un job/tombstone/retry capaz de probar de forma
idempotente que la identidad ya no existe—. **No se implementó ni se configuró**;
requiere autorización y configuración externa. Las dos reglas que no se negocian
mientras tanto: no promover el checkpoint antes de que Clerk confirme, y no
inferir el borrado a partir de un `signed-out`.

### Pendientes externos, en orden

1. Diseñar y autorizar el finalizador server-side de Clerk; configurar el secreto
   en Convex sin exponerlo.
2. Auditar y configurar el catálogo de Apple + RevenueCat (bundle real
   `com.lucasssram.orbita`; entitlement, oferta, producto mensual y trial según la
   decisión legal); contratos, banking y tax si faltan.
3. Desplegar backend/schema/fence/RevenueCat en **Development primero** y
   verificar funciones y bindings. **Backend antes que cliente.**
4. Crear dev build/TestFlight compatible con los módulos de RevenueCat y el
   runtime fingerprint; compra, restore y Customer Center en Sandbox con una
   cuenta legítima; verificar webhook, reconcile y allowlist de App Review.
5. Recapturar Plus 06, VoiceOver en iPhone físico y el checklist legal/App
   Review. **Recién ahí** pedir autorización para producción y publicación.

---

# ▲ FRONTERA DE ARCHIVO — todo lo que sigue es HISTÓRICO / SUPERADO ▲

**El único bloque vigente de este archivo es el de arriba: `## Identidad,
borrado y comercio — cierre técnico local (2026-08-19) · VIGENTE`.**

Desde esta línea hacia abajo, todo se conserva **sólo como trazabilidad**: qué
se encontró, qué se arregló y por qué. Nada de lo que sigue describe el estado
actual del repositorio.

Regla de lectura, sin excepciones: **ningún encabezado posterior a esta frontera
reemplaza el bloque del 2026-08-19**, aunque diga "vigente", "cerrado",
"objetivo", "estado actual", "fuente de verdad" o cualquier fórmula parecida.
Esas palabras describen el momento en que se escribió esa sección, no hoy. Lo
mismo vale para sus métricas y sus contratos: **todo conteo de pruebas,
inventario de árbol, veredicto y contrato de API que aparezca más abajo está
superado** por el bloque vigente.

El estado actual, y el único que se cita hacia afuera:

- **PASS técnico local; NO listo para lanzamiento ni publicación.**
- **2145/2145** pruebas en **196 suites**; inventario de **381 entradas**;
  índice con **2 entradas** heredadas.
- El finalizador **server-side de Clerk no está implementado ni configurado**, y
  es **release-blocking**.

---

## Comercio nativo — cierre del paquete de auditoría A/B/C (2026-08-18, pasada 18) · HISTÓRICO

> **HISTÓRICO.** Los conteos y el veredicto de esta sección quedaron superados
> por el cierre del 2026-08-19 de arriba. Se conservan como evidencia de la
> pasada, no como estado vigente.

**Veredicto: repositorio validado; comercio NO certificado.** Typecheck, focales
y suite completa en verde, con una prueba roja reproduciendo cada defecto antes
del arreglo. Eso no certifica nada comercial: siguen faltando configuración
externa, un build nativo nuevo y dispositivo/TestFlight/App Review. **Android
queda fuera del alcance de esta corrida y sin verificar.**

### A · Backend, entorno e identidad

1. **Bypass de allowlist (P1).** El corte de entorno se aplicaba con
   `allCandidates.some(...)` sobre los strings crudos del evento: un alias
   allowlisted (`user_review`) habilitaba el recibo Sandbox de OTRA cuenta
   (`user_common`) en producción. Ahora la autorización corre **después** de
   resolver la única identidad local canónica, contra esa cuenta y ninguna otra.
2. **Aislamiento sandbox/production.** `isRowActive` corta por entorno: una fila
   de RevenueCat sin `environment` falla cerrado y una `sandbox` sólo concede si
   esa cuenta está allowlisted — vaciar el secreto apaga el acceso. Las filas
   dejaron de buscarse con `first()` ambiguo: se colectan por (usuario,
   proveedor) y se eligen por entorno, así que sandbox y production **conviven**
   sin pisarse. Se actualizaron **todos** los consumidores vía
   `resolveRowsForUser`: `subscriptions.getCurrent`, `isUserPro` (layers, daily,
   transits, charts, journal), `void` y `stripeInternal`. Stripe no se ve
   afectado. Las filas legadas sin entorno quedan documentadas para
   auditoría/migración y se reparan con la lectura REST.
3. **Cuarentena de identidad ambigua.** Antes reconciliaba A y B; como los
   aliases devuelven el mismo `CustomerInfo`, eso dejaba Pro a los dos. Ahora se
   audita y **no se reconcilia ninguno**.
4. **Contrato REST v1 real.** 200 y 201 se validan igual (el endpoint es
   GET-or-create); **404 dejó de ser éxito** y no revoca; shape profunda y
   `request_date_ms` válido obligatorios; `orbita_pro: null` es inválido, no
   Free; un `expires` ausente o ilegible ya no se convierte en lifetime.
5. **Reembolsos.** `CANCELLATION` + `cancel_reason: CUSTOMER_SUPPORT` es un
   reembolso y retira el acceso **en el acto**, también un lifetime sin
   vencimiento. Las demás cancelaciones conservan hasta fin de período y
   `REFUND_REVERSED` sigue restaurando. Todo evento canónico con un único
   usuario dispara reconciliación aunque la decisión local quede ignorada.
6. **Lifetime.** La precedencia es explícita en los dos caminos: el guard del
   webhook usa un discriminador `overridesLifetime` (sin él, una `EXPIRATION`
   tenía la misma forma que un reembolso y borraba el lifetime), y la
   proyección REST no degrada ni pierde un lifetime vigente. La lectura toma el
   lifetime de `non_subscriptions` no reembolsado, con precedencia sobre el
   mensual.
7. **Operación.** Cooldown por cuenta sobre `publicRateLimits`; verificación de
   sesión y fila local **antes** de tocar la red; timeout con `AbortController`;
   **retry durable y acotado** que se reprograma solo (las scheduled actions de
   Convex son at-most-once) y sólo para lo transitorio; auditoría idempotente
   por observación; y el `v.any()` del outcome reemplazado por un validador
   cerrado campo por campo.

### B · App nativa

8. **Identidad del SDK.** A → B es `logIn(B)` **directo**: se eliminó el
   `logOut` intermedio, que no cierra sesión sino que crea un anónimo capaz de
   recibir una compra huérfana. El logout de la app ya no toca el SDK. Una
   **única cola serial** cubre identidad, compra, restore, refresh y Customer
   Center, y cada acción revalida la identidad dentro de la cola: una transición
   no puede colarse en medio de una compra. Se corrigieron los tests que
   canonizaban el logout.
9. **Carrera del Offering.** `runGuardedOfferingLoad` captura
   `(generación, usuario)` antes de pedir y descarta **el éxito y el error**
   obsoletos. Probado con promesas diferidas.
10. **Marcador de compra.** Lectura con tres estados: `empty`, `held` y
    `unreadable` — un JSON roto o un fallo de IO **bloquean** (llevan a
    Restaurar), nunca habilitan Comprar. El estado de compra pasó a ser una
    sesión **con dueño**: `guardLoaded`, `lastOutcome` y `purchaseReceived` se
    reinician al cambiar de cuenta y una continuación async de A no publica —ni
    limpia— el estado de B. Sólo levantan el marcador una cancelación
    demostrada, un Restaurar vacío autoritativo o una confirmación **de
    RevenueCat**: un `isPro` de Stripe ya no lo limpia.
11. **Perfil.** Restaurar usa el mismo circuito que el paywall (reconcilia
    siempre; vacío limpia; activo conserva hasta confirmación). Las dos salidas
    de gestión se muestran sin importar quién gana el rango, incluido Stripe
    ganador con RevenueCat activo. Con el portal web apagado el botón queda
    deshabilitado.
12. **Eliminación de cuenta.** Se limpia el marcador de compra en el borrado
    inmediato y en la reanudación pendiente, y **no** en un logout normal. La
    primera confirmación avisa que la suscripción sigue cobrando y pide
    cancelarla antes. **No se implementó** borrado remoto en RevenueCat/Stripe:
    quedó como decisión/gate explícito en el checklist.

### C · Configuración y documentación

13. `.env.example` sin duplicados (había cinco) y sin ningún valor cargado.
14. `eas.json` ya no versiona `ascApiKeyPath` (una ruta absoluta a `~/Downloads`),
    `ascApiKeyId` ni `ascApiKeyIssuerId`. Queda `ascAppId`, que es público; las
    credenciales van al almacenamiento seguro de EAS. **No se leyó, movió ni
    modificó el `.p8` externo.**
15. Checklist con el veredicto único, el gate de retención/borrado externo y
    Android declarado deshabilitado. *(Corregido después: Android no está
    deshabilitado por código — queda **fuera del alcance comercial** y sin
    verificar. El checklist ya dice eso.)*

### Archivos

**Backend nuevo (2):** `convex/lib/revenueCatRetry.ts`, y de la pasada previa
`convex/lib/revenueCatRest.ts` + `convex/payments/revenuecatRest.ts` (ambos
reescritos acá).
**Backend modificado (7):** `convex/lib/{entitlements,revenueCatEvents,subscriptionAccess}.ts`,
`convex/payments/{revenuecat,revenuecatRest,stripeInternal}.ts`,
`convex/subscriptions.ts`, `convex/void.ts`.
**Cliente nuevo (1):** `src/domain/offeringRetry.ts`.
**Cliente modificado (8):** `src/domain/{nativeCommerce,purchaseGuard,accountDeletion,accountDeletionCopy,accountDeletionCopy.web}.ts`,
`src/services/{purchaseGuard,purchaseGuard.web}.ts`,
`src/services/revenuecat/{client.ts,RevenueCatProvider.tsx}`,
`src/screens/{PerfilScreen,v492/PlusPaywallScreen}.tsx`,
`src/components/orbita/ManageSubscription.tsx`, `src/hooks/useAppState.tsx`.
**Config/contrato:** `.env.example`, `eas.json`, `convex/_generated/api.d.ts`
(regenerado con `convex codegen`).
**Pruebas nuevas (6):** `revenueCatIdentityAndEnvironment`,
`revenueCatRestContract`, `revenueCatRefundAndLifetime`, `reconcileOperations`,
`nativeIdentityAndGuard`, `accountDeletionCommerce`.
**Pruebas actualizadas (9):** `revenueCatEvents`, `revenueCatLifecycle`,
`revenueCatReconciliation`, `revenueCatWebhookHardening`, `entitlements`,
`entitlementPrecedence`, `nativeCommerceOffer`, `nativeCommerceSurface`,
`dualProviderManagement`, `perfilAppReview`, `accountDeletionReadRace` — todas
por cambio de diseño documentado en el propio test.

### Resultados exactos (HISTÓRICOS — superados por el cierre del 2026-08-19)

- `convex codegen` local: **sin cambios** en `api.d.ts` (el catálogo ya incluía
  `lib/revenueCatRest`, `lib/revenueCatRetry` y `payments/revenuecatRest`).
- `pnpm typecheck` — **exit 0**.
- Focales (24 archivos) — **429/429**, 67 suites.
- `pnpm test` — **1842/1842** en 155 suites, 0 fallas.
- `pnpm check:test-count` — **exit 0** (piso 745).
- `pnpm build:web` + `pnpm check:web-export` — **exit 0** (32,12 MB;
  1012,2 KB gzip / 1,25 MB).
- Bundle web: `react-native-purchases`, `RCAnonymousID`, `purchasePackage`,
  `restorePurchases`, `checkTrialOrIntroductoryPriceEligibility`,
  `api.revenuecat.com`, `orbita:purchase-guard`, `REVENUECAT_SECRET_API_KEY`,
  `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_SANDBOX_REVIEW_USER_IDS`, `AuthKey_` y
  `\.p8` → **0 ocurrencias**. `presentCustomerCenter` → 1, el stub inerte.
  `createCheckoutSession` → 2, Stripe intacto.
- `git diff --check` y `--cached --check` — exit 0.
- Índice: las dos entradas heredadas, sin reordenar.
- Inventario: **361** = 347 de la pasada previa + 8 archivos nuevos + 6 tracked
  que pasaron a modificados.

### Bloqueos abiertos (no cerrados por esta pasada)

1. **Configuración externa**: producto mensual e introductory offer en App Store
   Connect, `orbita_pro` y Default Offering en RevenueCat, webhook con su
   Authorization, `REVENUECAT_SECRET_API_KEY` y la allowlist de review.
2. **Build nativo nuevo**: los módulos de RevenueCat no están en el binario
   actual y ninguna OTA los agrega.
3. **Dispositivo real → Sandbox → TestFlight → App Review.**
4. **Decisión de retención/borrado externo** (RevenueCat/Stripe) pendiente de
   producto y legal; el gate está escrito en el checklist.
5. **Android**: fuera del alcance de esta corrida. Sin catálogo en Play, sin app
   de RevenueCat y con `android.package` distinto del bundle iOS.
6. **Credenciales de EAS Submit**: hay que cargarlas en el almacenamiento seguro
   de EAS ahora que salieron del repo.

> A esta lista se le sumó, el 2026-08-19, el **finalizador server-side de Clerk**
> (`CLERK_SECRET_KEY` + job durable). Ver la sección vigente al inicio.

**No se ejecutó:** commit, push, `convex dev`/deploy, EAS build, TestFlight,
App Store, dashboards de RevenueCat/Apple ni producción.

## Comercio nativo — cierre de los 7 hallazgos P1 (2026-08-18, pasada 17) · HISTÓRICO — SUPERADO

> **TODA ESTA PASADA ES HISTÓRICA Y ESTÁ SUPERADA. No uses sus contratos.**
> Se conserva por trazabilidad —qué defecto se encontró y por qué se arregló—,
> pero describe una API y unas reglas que ya **no** son las del código. Cuatro de
> sus afirmaciones son hoy **falsas**:
>
> | Lo que dice esta pasada (FALSO hoy) | Contrato VIGENTE |
> |---|---|
> | Action pública `reconcileMyStoreEntitlement` | **Mutation** `payments/revenuecatRest:requestStoreReconcile`, con `args: {}` y retorno `{ status: "queued" \| "cooldown" \| "unauthenticated" }`. La action era at-most-once y podía morir antes de crear el trabajo. |
> | "un 200 sin el entitlement, **o un 404**, sí retiran" | **Un 404 NO revoca.** `/v1/subscribers/{id}` es GET-or-create y nunca contesta 404 para una cuenta legítima: un 404 significa ruta, proyecto o credencial mal configurados. Sólo un **200/201 con la forma completa y sin el entitlement** retira el acceso. |
> | Identidad ambigua: "se fuerza la reconciliación de **ambas**" | **CUARENTENA: no se reconcilia ninguna.** Se audita `ignored_ambiguous_identity` y se resuelve a mano. Los aliases devuelven el MISMO `CustomerInfo`, así que reconciliar las dos dejaría Pro a ambas cuentas por una sola compra. |
> | Cambio de cuenta `A → logout → B` | **`logIn(B)` directo, sin logout intermedio.** Convex re-autentica al cambiar la cuenta de Clerk y el estado de tienda se publica atado a su dueño. |
>
> El estado y los contratos vigentes están en la sección inicial de este
> documento y en `docs/native-commerce-release-checklist.md`. Sus conteos
> (**1743/1743**, 130 suites, focales 112/112, inventario 347) también quedaron
> superados: hoy son **2145/2145 en 196 suites** con **381 entradas**.

**Owner:** Claude Code ejecuta, Codex revisa. Cada hallazgo se cerró con
**prueba roja primero** y arreglo mínimo de producción. Base `52836ad`, rama
`feature/native-v492-implementation`, las dos entradas staged intactas.

### 1 · No existía reconciliación server-side

**Causa:** el webhook es best-effort. RevenueCat reintenta una cantidad acotada
y abandona; si el `INITIAL_PURCHASE` se pierde, Apple ya cobró y Convex queda en
Free **sin ningún evento posterior que lo repare**.

**Arreglo:** `convex/lib/revenueCatRest.ts` (parser puro) +
`convex/payments/revenuecatRest.ts` (adapter y proyección). Lee
`GET /v1/subscribers/{app_user_id}` con `REVENUECAT_SECRET_API_KEY`, secreto de
backend. La acción pública `reconcileMyStoreEntitlement` **no declara
argumentos**: deriva el Clerk id de `ctx.auth`. 5xx/429/401/shape inválida no
conceden ni revocan; un 200 sin el entitlement, o un 404, sí retiran. La
proyección es idempotente y no pisa un webhook más nuevo (`lastEventAt`). Se
dispara tras compra, restauración, comprobación demorada y cada webhook.

> **SUPERADO en los dos puntos marcados.** Hoy la superficie pública es la
> **mutation** `requestStoreReconcile` (`args: {}`), y **un 404 NO retira el
> acceso**: se trata como `unavailable`, igual que un 5xx. Ver la advertencia
> del encabezado de la pasada.

**Borde que encontré en mi propia solución:** la proyección no aplicaba el corte
de entorno, así que producción podía conceder desde un recibo sandbox por la
puerta de atrás. Cerrado: para **conceder** exige entorno demostrable y
permitido; para **retirar** no, porque "esta cuenta no tiene el entitlement" es
cierto venga de donde venga. Además, `is_sandbox` ahora se lee también de
`non_subscriptions`, donde viven los lifetime.

### 2 · Entorno que no fallaba cerrado

`resolveDeploymentEnvironment` distingue `production` / `development` /
**`unknown`**; antes "no es producción" significaba development y un deployment
sin configurar consumía Sandbox. `unknown` no consume nada.

Producción acepta Sandbox **sólo** para los Clerk id de
`REVENUECAT_SANDBOX_REVIEW_USER_IDS` — TestFlight y App Review compran en
Sandbox con el binario productivo, y sin esa puerta quien revisa la app no ve
Plus. Las filas conservan su `environment` y una sandbox no pisa una productiva.
Un evento **sin** `environment` (`TRANSFER`, `TEMPORARY_ENTITLEMENT_GRANT`) ya no
se descarta: se difiere a la reconciliación. `undefined` nunca se lee como
production.

### 3 · `isRowActive` concedía sin fecha demostrable

Una fila `active`/`trialing` sin `currentPeriodEnd` daba acceso indefinido.
`checkout.session.completed` de Stripe escribe exactamente esa forma y la fecha
llega recién con `customer.subscription.updated`: si ese webhook no llegaba, el
acceso no vencía **nunca**. Ahora sólo `isLifetime` puede omitirla.

### 4 · Identidad ordinaria ambigua

Si `app_user_id` / `original_app_user_id` / aliases resolvían a dos cuentas
locales, se elegía la primera. Ahora se resuelven todas: con más de una se
audita `ignored_ambiguous_identity`, no se muta acceso y se fuerza la
reconciliación de ambas.

> **SUPERADO.** Reconciliar ambas resultó peor que no hacer nada: los aliases
> devuelven el MISMO `CustomerInfo`, así que una sola compra dejaba Pro a las dos
> cuentas. El contrato vigente es **cuarentena**: se audita
> `ignored_ambiguous_identity` y **no se reconcilia ninguna**; se resuelve a
> mano. (Cero matches es otro caso: no se registra como procesado y el retry
> acotado de RevenueCat lo vuelve a traer.)

### 5 · Un mensual podía borrar un lifetime legado

RevenueCat guarda UNA fila por (usuario, proveedor). La `EXPIRATION` del mensual
escribía `free` / `expired` / `isLifetime: false` encima del lifetime.
`guardLifetimePrecedence` impide que un evento cuyo producto no es lifetime baje
esos tres campos; el resto del patch se aplica igual. Probado con la secuencia
completa: lifetime + mensual + expiración del mensual conserva lifetime.

### 6 · Doble proveedor sin doble salida

`resolveEntitlement` podía decir `provider: "revenuecat"` + `isLifetime` y a la
vez `canManageInStripePortal: true`, pero el Perfil mostraba una sola salida —la
del ganador por rango— y el mensual de Stripe seguía cobrando sin forma visible
de cancelarlo. Contrato aditivo: `canManageInRevenueCat` y `activeProviders`.
`nativeSubscriptionManagement` declara cada salida por separado y el Perfil
muestra **las dos**, diciendo que hay dos suscripciones activas.

### 7 · El bloqueo ambiguo moría con la pantalla

Vivía en `useState`: volver atrás y reabrir el paywall —o que iOS descarte la
pantalla con la hoja de StoreKit arriba— devolvía el botón a "comprar" con un
cargo posiblemente hecho. Ahora hay un marcador por cuenta en disco
(`src/domain/purchaseGuard.ts` + `src/services/purchaseGuard.ts`, con stub web),
escrito **antes** de abrir la hoja de la tienda. `nativePrimaryAction` recibe
`guardLoaded`: mientras el marcador no se leyó no se ofrece ninguna acción de
cobro, así que no hay ventana al montar. Sólo lo levantan una cancelación
demostrada, un Restaurar vacío autoritativo o la confirmación del backend. Nunca
concede acceso.

### Archivos

**Backend nuevo (2):** `convex/lib/revenueCatRest.ts`,
`convex/payments/revenuecatRest.ts`.
**Backend modificado (5):** `convex/lib/{entitlements,environment,revenueCatEvents}.ts`,
`convex/payments/revenuecat.ts`, `convex/subscriptions.ts`.
**Cliente nuevo (3):** `src/domain/purchaseGuard.ts`,
`src/services/purchaseGuard.ts`, `src/services/purchaseGuard.web.ts`.
**Cliente modificado (4):** `src/domain/nativeCommerce.ts`,
`src/screens/v492/PlusPaywallScreen.tsx`,
`src/components/orbita/ManageSubscription.tsx`, `src/services/appRefs.ts`.
**Contrato/config/docs:** `convex/_generated/api.d.ts` (regenerado con
`convex codegen`, no editado a mano), `convex/CHANGELOG.md`, `.env.example`
(placeholders sin valores), `docs/native-commerce-release-checklist.md`.
**Pruebas nuevas (6 archivos):** `entitlementPrecedence`,
`revenueCatEnvironmentGate`, `revenueCatReconciliation`,
`revenueCatWebhookHardening`, `purchaseGuard`, `dualProviderManagement`.
**Pruebas actualizadas (4):** `revenueCatEvents`, `revenueCatLifecycle`,
`nativeCommerceOffer`, `nativeCommerceSurface` — todas por cambio de diseño
declarado, ninguna por debilitar una expectativa.

### Resultados (HISTÓRICOS — superados por el cierre del 2026-08-19)

- `pnpm typecheck` **exit 0**.
- Focales backend de comercio — **112/112**.
- `pnpm test` — **1743/1743** en 130 suites, 0 fallas.
- `pnpm check:test-count` — **exit 0** (piso 745).
- `git diff --check` y `--cached --check` — exit 0.
- `pnpm build:web` + `pnpm check:web-export` — exit 0.
- **Corte web sobre el bundle real:** `react-native-purchases`, `RCAnonymousID`,
  `purchasePackage`, `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_AUTH`,
  `api.revenuecat.com` y la clave `orbita:purchase-guard` → **0 ocurrencias**;
  `createCheckoutSession` → 2, Stripe intacto.
- `convex codegen` local: agregó exactamente `lib/revenueCatRest` y
  `payments/revenuecatRest` al catálogo. Deployment **sin tocar**.

**Inventario:** 347 entradas = 333 heredadas + 11 archivos nuevos + 3 tracked
que pasaron a modificados (`convex/subscriptions.ts`, `.env.example`,
`src/services/appRefs.ts`; `convex/lib/environment.ts` ya estaba). Índice con
las dos entradas de siempre.

**Bloqueos externos:** los mismos del checklist, ninguno levantable desde el
repo. Se suman dos configuraciones nuevas antes de TestFlight/review:
`REVENUECAT_SECRET_API_KEY` y `REVENUECAT_SANDBOX_REVIEW_USER_IDS` (esta última
se vacía al terminar la revisión).

**No se ejecutó:** commit, push, `convex dev`/deploy, EAS, build nativo,
TestFlight, App Store, dashboards de RevenueCat/Apple ni producción.

## Comercio nativo — auditoría, corrección y cierre técnico (2026-08-18, pasada 16) · HISTÓRICO — SUPERADO

> **HISTÓRICA Y SUPERADA.** Se conserva por trazabilidad de los 8 defectos. Sus
> contratos de identidad quedaron reemplazados: el cambio de cuenta vigente es
> **`logIn(B)` directo, sin logout intermedio**, con re-autenticación de Convex
> y estado de tienda atado a su dueño. Contratos vigentes en la sección inicial
> y en `docs/native-commerce-release-checklist.md`.

**Owner:** Claude Code como ejecutor; Codex revisa. Se volvió al flujo canónico
de `WORKFLOW.md`. Base `52836ad`, rama `feature/native-v492-implementation`, las
dos entradas ya preparadas en el índice intactas y sin reordenarlo.

**Qué se hizo:** auditar el trabajo heredado de esta etapa (dependencias,
fingerprint/EAS, hardening del webhook, cliente/provider, paywall, Perfil,
documentación) y cerrar los defectos encontrados. El backend heredado quedó
confirmado sin cambios: sólo `orbita_pro` concede o revoca, producción rechaza
`SANDBOX` y development rechaza `PRODUCTION`, `original_app_user_id` y aliases
se resuelven, `CANCELLATION` exige una fecha demostrable, el usuario todavía no
materializado es reintentable sin marcar el evento y la auditoría no guarda PII
ni `subscriber_attributes`. **No se tocó `convex/**`, ni el schema, ni ninguna
firma pública.**

### Defectos corregidos

1. **La oferta canónica de 7 días no existía en el código.** `NativeStorePlan`
   no tenía campo de prueba, el cliente nunca leía `product.introPrice` y nadie
   preguntaba elegibilidad. Ahora la prueba sale de `introPrice` +
   `checkTrialOrIntroductoryPriceEligibility`, y se anuncia sólo con oferta
   gratuita **y** `ELIGIBLE`. `UNKNOWN`, `INELIGIBLE`, un error de red o la
   ausencia de oferta muestran el mensual sin promesa; la consulta caída degrada
   a `unknown` sin romper la oferta. La duración se traduce del período de la
   tienda (`P1W` → “7 días”), no se escribe.
2. **Doble cobro tras un error posterior a la compra.** El `catch` volvía a
   `idle` y el CTA reaparecía como “DESBLOQUEAR ÓRBITA PLUS” habilitado,
   contradiciendo su propio aviso. Ahora un resultado ambiguo pasa el botón
   primario a **Restaurar**, y si la tienda ya confirmó nunca se vuelve a
   ofrecer comprar. Un Restaurar vacío levanta el bloqueo (fuerza el refresh del
   recibo: es respuesta definitiva); un recheck vacío por caché, no.
3. **Doble toque en el paywall.** `busy` era `useState`: el segundo toque del
   mismo render pasaba la guarda, chocaba con el `actionLock` del provider y
   mostraba “No pudimos confirmar el resultado” por un rebote de dedo. Las
   cuatro acciones toman ahora el candado síncrono `createExclusiveGate`.
4. **Acciones simultáneas en Perfil.** Gestionar y Restaurar usaban guardas
   asimétricas sobre estado de React y podían entrar juntas. Comparten un único
   candado síncrono, y los botones bloqueados se anuncian bloqueados.
5. **Carrera de identidad al publicar el estado de tienda.** `purchase`,
   `restore` y `refreshCustomerInfo` publicaban el resultado sin revalidar:
   Clerk podía cambiar de cuenta durante el `await`. Ahora pasan por
   `publishStoreState`, que descarta el resultado si la identidad cambió.
6. **`storeIsPro` estaba muerto.** Se calculaba y nadie lo leía; la distinción
   “compra recibida” vs “activación confirmada” dependía de un estado que se
   perdía al remontar la pantalla. Ahora alimenta `nativeActivationPhase` y
   sobrevive al remonte. Sigue siendo **sólo presentación**: ningún gate lo lee.
7. **Etiquetas deshonestas.** El CTA decía “PREPARANDO LA OFERTA…” también con
   compras no disponibles, sin Offering o con error de carga. Cada estado
   terminal dice lo suyo.
8. **Comentario falso** en `app/paywall.tsx` (“nativo → redirección al Perfil”)
   y **stub web incompleto** (`client.web.ts` sin `trackNativePaywall`,
   `listenForCustomerInfo`, `customerHasOrbitaPro` ni `nativeTrialEligibility`).
   Los dos corregidos; la paridad de exports es ahora una prueba.

### Archivos de la pasada 16

Comercio (8 de producción): `src/domain/nativeCommerce.ts`,
`src/services/revenuecat/{client.ts, client.web.ts, RevenueCatProvider.tsx}`,
`src/screens/v492/PlusPaywallScreen.tsx`,
`src/components/orbita/{ManageSubscription.tsx, kit.tsx}`, `app/paywall.tsx`.
Cierre de la revisión de Codex (2): `convex/_generated/api.d.ts` (regenerado,
no editado a mano) y `test/natalChartBase.test.ts` (fixture + guarda).
Pruebas nuevas: 3 archivos. Pruebas heredadas actualizadas: 2.
Documentación: `CURRENT_TASK.md` y
`docs/native-commerce-release-checklist.md`.

### Pruebas nuevas (100 casos)

- `test/nativeCommerceOffer.test.ts` — **45** casos puros: elegibilidad de la
  prueba (incluido `UNKNOWN` sin promesa y el precio introductorio rebajado que
  no es prueba), duración traducida, plan mensual, identidad `A → logout → B`
  *(escenario de esa pasada; el contrato vigente cubre el cambio directo
  `logIn(B)` sin logout intermedio)*, botón primario contra doble cobro,
  transiciones de respuesta de la tienda y vistas del Perfil.
- `test/nativeCommerceSurface.test.ts` — **36** casos de alcance/estructura:
  corte web/nativo recorriendo el grafo real de imports desde todas las rutas de
  `app/`, catálogo mensual fail-closed, identidad, salidas del paywall, Perfil,
  candados y paywall del onboarding todavía apagada.
- `test/revenueCatLifecycle.test.ts` — **19** casos de lifecycle backend que no
  tenían regresión: `PRODUCT_CHANGE`, `UNCANCELLATION`, `SUBSCRIPTION_PAUSED`,
  tipo ausente/desconocido, corte de entorno visto desde la mutation completa,
  evento viejo que no pisa el nuevo, resolución por alias y transferencia hacia
  una cuenta ausente reintentable.

**Tres pruebas heredadas reflejaban el diseño anterior y se actualizaron**, con
la justificación escrita en el propio test: `accesoPostAlta` (dos) y
`v492ReleaseP1` (una) prohibían que cualquier módulo nativo nombrara
`/paywall`, porque antes el único checkout era web. Con la ruta resuelta por
plataforma, la garantía que importa es que el grafo **nativo** no alcance la
implementación web ni llame `createCheckoutSession` — eso es lo que ahora
afirman, más la contraparte de que en nativo `/paywall` ES la compra con
RevenueCat.

### Resultados reales (HISTÓRICOS — superados por el cierre del 2026-08-19)

- `pnpm typecheck` — **exit 0**.
- Focales (13 archivos: comercio + natal + gate generado) — **253/253**, 0 fallas.
- `pnpm test` — **1656/1656** en 113 suites, 0 fallas.
- `pnpm check:test-count` — **exit 0** (1656 pasan, 0 fallan, piso 745).
- `git diff --check` y `git diff --cached --check` — exit 0. Los archivos nuevos
  se verificaron con `git diff --check --no-index`, sin tocar el índice.
- `npx expo config --type public` — resuelve; `buildNumber` sigue en **18**,
  `runtimeVersion` en `fingerprint`, `extra` sin secretos.
- `pnpm build:web` + `pnpm check:web-export` — export local **exit 0** (32,12 MB
  totales, 1012 KB de JS gzip sobre un límite de 1,25 MB).
- **Evidencia del corte web sobre el bundle real:** `react-native-purchases`,
  `purchasePackage`, `RCAnonymousID` y `checkTrialOrIntroductoryPriceEligibility`
  aparecen **0 veces**; `presentCustomerCenter` aparece 1 vez y es el stub inerte
  (`phase:"unavailable"`); `createCheckoutSession` aparece 2 veces, o sea que
  Stripe sigue entero en web.

### Las 5 fallas: causa raíz demostrada (corrección de la pasada anterior)

**Mi atribución anterior era incorrecta.** Dije que las cuatro fallas natales
eran heredadas y ajenas al comercio, apoyándome en los mtimes de
`convex/lib/natalGeometry.ts` y `test/natalChartBase.test.ts`. El mtime no
prueba comportamiento: la revisión de Codex señaló que
`.local/audits/native-v492-recertification-2026-08-17/logs14/run-summary.md`
certifica **1537/1537** a las 15:23 del 08-18, o sea DESPUÉS de esos mtimes.
Las cuatro fallas sí las causó esta etapa.

**Causa raíz, demostrada con un experimento reversible.** El endurecimiento de
`isRowActive` en `convex/lib/entitlements.ts` (16:55, parte de este comercio)
cambió el predicado de

```
if (row.entitlement === "free") return false;              // pasada 14
if (row.entitlement !== PRO_ENTITLEMENT && row.entitlement !== "plus") return false;  // hoy
```

`test/natalChartBase.test.ts` sembraba la fila Pro como
`{ status: "active", provider: "stub", isLifetime: true }`, **sin
`entitlement`**. Con el predicado viejo, `undefined` no era `"free"` y la fila
concedía acceso; con el nuevo, no concede. `getNatalChartBase` resuelve casas y
aspectos con `isUserPro` → `resolveEntitlement`, así que la cuenta pasó a Free y
`convex/layers.ts` cerró la geometría. De ahí los cuatro síntomas: casa solar
`null`, oposición `range` ausente, geometría verificada ausente y 0 casas.

**Prueba de causalidad:** revertir únicamente ese predicado deja
`test/natalChartBase.test.ts` en **11/11**; restaurarlo lo devuelve a **7/12**.

**El arreglo correcto es la fixture, no el predicado.** `convex/schema.ts:21`
declara `entitlement` como `v.union(v.literal("free"), v.literal("plus"),
v.literal("orbita_pro"))` y el campo **no es opcional**: una fila sin
`entitlement` no puede existir en la base real. Para las tres filas que el
schema sí admite, el predicado nuevo se comporta igual que el viejo (`free` →
false; `plus` y `orbita_pro` → true), así que **el endurecimiento no cambia el
comportamiento de producción** y se conserva tal cual. La fixture pasó a ser
representable con `entitlement: "orbita_pro"`; ninguna expectativa se tocó ni se
quitó cobertura.

**Regresión agregada** (`test/natalChartBase.test.ts`): una guarda que resuelve
la fila sembrada con el `resolveEntitlement` real y comprueba que su
`entitlement` es uno de los que el schema declara. Verificada por falsación:
al quitar `entitlement` de la fixture, la guarda falla **primero** y reproduce
exactamente los cuatro síntomas originales. Antes, la deriva se manifestaba a
cuatro assertions de distancia de la causa.

**Codegen (5.ª falla):** `pnpm convex:codegen --typecheck disable`, local y sin
deploy. El cambio generado es **exactamente el módulo esperado**: dos líneas en
`convex/_generated/api.d.ts` (`import type * as lib_revenueCatEvents` y la
entrada `"lib/revenueCatEvents"` del catálogo). `convex/_generated/api.js` y
`convex/schema.ts` conservan su SHA-256 certificado
(`f5130585…` y `79a13e87…`). El CLI imprime `Uploading functions to Convex…`
como parte de su typegen: el catálogo del deployment sigue en **129 funciones**,
igual que la pasada 14, verificado read-only con `convex function-spec`.

### Bloqueos externos que siguen abiertos

Ninguno se puede levantar desde el repo: precio y territorios sin decidir,
producto mensual e introductory offer sin crear en App Store Connect,
entitlement `orbita_pro` y Default Offering sin verificar en RevenueCat,
webhook y su Authorization sin configurar, y sin development build no hay forma
de certificar StoreKit. Todo eso está en
`docs/native-commerce-release-checklist.md`.

**No se ejecutó:** commit, push, PR, deploy a Convex, EAS Build, TestFlight, App
Store Connect, dashboard de RevenueCat, producción ni publicación. No se
cambiaron `buildNumber`, versión ni precio, y no se leyó ni escribió ningún
secreto.

## Comercial nativo — Free + Órbita Plus con RevenueCat/Apple (2026-08-18) · HISTÓRICO — SUPERADO

> **HISTÓRICO — SUPERADO.** Es la ficha con la que **arrancó** la etapa
> comercial: su "Objetivo" y sus "Criterios de aceptación" describen lo que se
> proponía entonces, no el estado de hoy. Su inventario de **310 entradas** se
> conserva sólo como evidencia de esa fecha; el vigente es **381**. El estado
> actual está en el bloque del 2026-08-19, al inicio del archivo.

**Objetivo:** convertir el acceso Plus que V4.9.2 ya entiende en un circuito
comercial nativo real: oferta de tienda, compra, restauración, gestión y
sincronización del entitlement. La experiencia Free sigue siendo una forma
completa de usar Órbita; no se lanza una edición separada ni una app “solo
Free”. Stripe web continúa vigente y Convex sigue siendo la autoridad de los
gates server-side.

**Criterios de aceptación:**

- iOS/Android configuran RevenueCat sólo con una clave pública por plataforma y
  vinculan la compra al `clerkUserId`; no se permite iniciar una compra sin una
  cuenta identificada;
- el paywall nativo usa el Offering real y los precios/localización de la
  tienda, sin importes, pruebas ni descuentos hardcodeados;
- comprar, cancelar, restaurar y abrir la gestión tienen estados honestos de
  carga, cancelación, error y confirmación, y nunca conceden acceso mediante una
  escritura del cliente;
- `subscriptions.getCurrent` combina Stripe web y RevenueCat nativo sin romper
  clientes anteriores; los webhooks son autenticados, idempotentes, toleran
  desorden, reembolsos, grace period, extensiones y transferencias de identidad;
- una cuenta Free conserva Hoy, Tránsitos, Vínculos, Carta base y 3 preguntas
  diarias; Plus abre casas, aspectos y el cupo de 5, con caminos visibles desde
  Perfil y los módulos cerrados;
- la integración se prueba primero con RevenueCat Test Store/StoreKit y después
  con Apple Sandbox/TestFlight; producción sólo se habilita tras una compra,
  restauración, vencimiento/cancelación y recuperación entre dispositivos
  verificadas en una cuenta legítima.

**Ficha:** owner Codex por excepción explícita mientras Claude Code no está
disponible. Territorio permitido: `convex/**`, `app/**`, `src/**`, configuración
Expo/EAS, dependencias, pruebas y documentación de esta integración. Se trabaja
sobre `feature/native-v492-implementation` / `52836ad`, preservando las 310
entradas del cierre V4.9.2 y las dos entradas ya staged; no se reordena el
índice. Cambio de contrato aditivo y compatible. Riesgo **alto** por pagos,
identidad, webhooks y publicación nativa.

**Pruebas:** regresiones puras del lifecycle RevenueCat y de la resolución
multi-proveedor; estados del cliente y paywall; rutas/gates Free/Plus;
`pnpm typecheck`, suite completa, `git diff --check`, export iOS/Android y build
de development client. La pasada manual debe cubrir compra sandbox,
restauración, cancelación con acceso hasta fin de período, vencimiento,
billing/grace period, reinstalación y cambio de dispositivo/cuenta.

**Rollout:** primero código local; luego un único sync a Convex Development y
un development build cuando Lucas autorice esas acciones externas; después
TestFlight interno. App Store Connect, RevenueCat y Apple se configuran con los
ids reales del producto, pero no se publica ni se habilita producción hasta el
gate comercial final. **Rollback:** desactivar el Offering/paywall en
RevenueCat y mantener la app en Free; Stripe web y las filas existentes quedan
intactos. **Fuera de alcance por ahora:** commit, push, merge, deploy de
producción, envío a App Review, publicación en App Store, Google Play,
alteración de precios sin decisión de Lucas y cualquier secreto dentro del
repositorio.

## Cierre de certificación V4.9.2 — pasada 15 (2026-08-18) · HISTÓRICO — SUPERADO

> **HISTÓRICO — SUPERADO.** Sus cifras se conservan sólo como evidencia de esa
> pasada: **1537/1537** en **93 suites** e inventario de **310** entradas. Los
> valores vigentes son **2145/2145** en **196 suites** e inventario **381**, en
> el bloque del 2026-08-19. Lo que sí sigue valiendo de acá es la **evidencia
> visual y de runtime** de 04, 08 y 09, que no se recapturó después.

**Estado: CERRADO técnicamente y en runtime para 04, 08 y 09** — *veredicto
**histórico** de la pasada 15, no el estado actual*. De los 12
estados visuales: **10 PASS · 1 BLOCKED externo (06 Plus) · 1 sin recapturar
(02)**. Owner: Codex, mientras Claude Code no estuvo disponible. Se preservó la
base `52836ad`, la rama `feature/native-v492-implementation`, el inventario de
**310** entradas (`100` tracked + `210` untracked) y las dos entradas que ya
estaban preparadas en el índice.

**Rollout ejecutado en la pasada 14:** tres deploys puntuales y autorizados,
exclusivamente a Convex Development `dutiful-viper-815` (14:33, 14:48 y 15:11
ART). El primero publicó el contrato aditivo; el segundo invalidó los cachés
editoriales viejos; el tercero publicó las correcciones surgidas de la auditoría
posterior. El catálogo live quedó en **129 funciones**, incluidas:

- `layers.getTransitArc` — query pública;
- `layers.refreshTransitArc` — action pública;
- `charts.recoverNatalChart` — action pública;
- `charts.recheckNatalStateForRun` — query interna.

**Defectos reproducidos y cerrados con regresión falla/pasa:** los cachés de
`ORB-NAT-001` y de la comparación de Vínculos no incluían la versión editorial;
Mapa elemental decía `uno planeta` y tenía dos bordes parciales de concordancia;
y una caída del proveedor podía culpar falsamente a un perfil con fecha, hora y
lugar completos. La invalidación quedó quirúrgica: `ORB-REL-001` conserva su
versión v1 y sólo la comparación usa v2. No cambió schema, firma pública ni
artifact generado.

**Cierre técnico heredado de la pasada 14:** `pnpm typecheck` exit 0 · focales de capas/copy/Vínculos
**91/91** · `pnpm test` **1537/1537** en 93 suites · working tree e índice sin
errores de whitespace · `convex/_generated/api.d.ts` y `convex/schema.ts` con
los mismos SHA-256 de la línea base de esta etapa. La auditoría post-arreglo
cerró con **0 P0 / 0 P1 / 0 P2**.

**Runtime:** 08 es **PASS** desde la pasada 14 con `La tierra…`, `CUANDO LA
TIERRA SATURA` y `con un planeta`. En la **pasada 15**, después de restaurarse
los créditos de la Astrology API, 04 y 09 también quedaron **PASS** sin cambios
de código ni otro deploy. 04 abrió el arco real #2 `Urano en sextil con tu
Saturno` y su trazabilidad mostró `ORB-TRN-001` +
`transit-arc-planets-tropical-roots-v2`, nunca `ORB-TRN-002`. 09 produjo la
comparación carta contra carta: los 14 contactos expandidos usan `Su … con tu …`
o `Tu … en su …`, con 0 nombres propios repetidos. Evidencia final en `logs15/`,
`shots/cert15/` y `compare15/`; `logs15/run-summary.md` registra el set aceptado
y ninguna evidencia anterior fue sobrescrita.

**No bloqueantes de V1:** 02 conserva evidencia histórica porque no había
credenciales locales seguras para regenerar el fixture; recuperación natal no
se ejercitó porque la única cuenta QA tenía carta completa; 06 requiere un
entitlement Plus legítimo antes del lanzamiento comercial; VoiceOver requiere
un iPhone físico; web autenticada es una tarea separada.

**Cortes de revisión preparados, sin staging nuevo:** A contrato/backend **43**
entradas, B aplicación nativa **258** (incluye las dos entradas ya staged) y C
hardening/documentación **9**. El proceso canónico exige separar contrato de
backend al convertir A en PR. No se autorizó commit, push, merge, producción,
EAS, TestFlight, App Store, deploy web, monetización ni escritura directa de
datos QA. La pasada 15 tampoco ejecutó deploy alguno.

## Órbita V4.9.2 — capas de tiempo nativas iOS (2026-08-15, HISTÓRICO)

**Objetivo:** implementar en la app nativa las 26 pantallas de Figma V4.9.2 y
los diez análisis trazables de Carta, Tu momento, Hoy y Vínculos. La experiencia
iOS queda exclusivamente astrológica; Tarot y Diario continúan únicamente en
web. La entrega de producto es una sola, aunque contrato, backend y frontend se
construyen en cortes internos revisables.

**Criterios de aceptación:** cinco tabs `Hoy · Tránsitos · Vínculos · Umbral ·
Perfil`; datos reales o degradación explícita; hora desconocida sin casas ni
ángulos falsos; Cumpleluna como repetición del ángulo Sol–Luna natal; ranking y
arcos deterministas; tres niveles de Vínculos sin puntaje global; trazabilidad
`analysisId + sourceRefs`; cero mocks personales y cero regresiones web.

**Ficha:** owner Codex para `convex/**`, contratos y pruebas; Claude Opus para
`app/**`, `src/**` y evidencia visual. Worktree limpio
`/Users/lucas/Documents/Core/worktrees/orbita/native-v492`, rama
`feature/native-v492-implementation`, base `origin/main` `52836ad`. Cambio de
contrato aditivo; riesgo alto por navegación, caches y cálculos; pruebas puras,
suite completa, typecheck, export iOS/web y comparación con los 14 frames
auditados. Rollout sin producción: integración local y RC solamente después de
aprobación de Lucas. Rollback por descartar la rama/worktree; los contratos son
aditivos y los clientes anteriores permanecen compatibles. Fuera de alcance:
rediseño web/web-mobile, certificación Android, monetización, notificaciones,
calendario mensual, deploy Convex, TestFlight, App Store, commit, push o merge.

**Fuente visual y editorial:** Figma `UX V4.9 - Órbita Capas de Tiempo` y
`docs/handoff-claude-figma-v492-copy-claridad.md` del checkout de producto. El
frame canónico `Hoy · lo activo ahora` (`938:289`) fue leído por MCP antes de
modificar código. Los PDFs permanecen locales; solo se incorporan metadatos y
locators verificables.

**Recertificación iOS local (2026-08-18, DECIMOTERCER pase — HISTÓRICO,
reemplazado por el cierre de pasada 15 al inicio):**
tres auditorías independientes reprodujeron sobre el duodécimo pase **un P1
todavía abierto**, y una auditoría de release encontró **cuatro P2** de
hardening. Los cinco están cerrados. **El veredicto visual de los 12 estados no
cambia:** esta pasada no recapturó nada, no desplegó nada y no tocó datos QA.
Informe histórico: `.local/audits/native-v492-recertification-2026-08-17/README.md`,
sección de la decimotercera pasada, y `logs13/`.

- **P1 · `refreshAndWait()` quedaba detrás de una action colgada del MISMO
  alcance.** El relevo del duodécimo pase cubría el *cambio* de alcance, así que
  el cuelgue sobrevivía justo donde nada cambiaba: con el refresco automático A
  en vuelo y sin resolver, la recuperación natal terminaba `recoverNatalChart` y
  pedía el refresco esperable para el **mismo** usuario, día, zona y hora. El
  hook armaba la clave con el `attempt` que tenía en la mano —estado de React,
  que en el mismo tick vale lo mismo—, la cola no relevaba nada, y el waiter
  —**con el candado natal tomado**— no terminaba nunca. Reproducido: `runs=1`,
  `pending` con el mismo pedido, `waiting=1`, `busy=true`, promesa sin resolver.
  Ni siquiera era una deduplicación honesta: si A terminaba, recién entonces
  arrancaba una segunda action idéntica.
  **El arreglo:** el contador del intento se mudó al ciclo
  (`src/domain/refreshCycle.ts`), que es ahora su única fuente de verdad, y la
  vía forzada lo **RESERVA sincrónicamente en el mismo instante en que encola**.
  `pedirYEsperar` ya no recibe una clave armada sino *cómo* armarla
  (`(intento) => string | null`): quien llama **no elige el intento**, así que es
  imposible encolar un pedido esperable con uno viejo. `setAttempt(v => v + 1)`
  no alcanzaba —el estado nuevo recién existe en el render siguiente—. El efecto
  del reloj arma su clave con `ciclo.intento()`, no con el espejo de React, así
  que el render posterior a la reserva **no encola un duplicado**. La vía
  automática con clave idéntica **sigue sin duplicar**: la semántica distinta es
  deliberada y vale sólo para `refreshAndWait()` y la recuperación.
- **P2-A · `.easignore` no protegía la evidencia local.** EAS deja de leer
  `.gitignore` cuando existe `.easignore`, así que el parser real incluía
  `.local/audit.bin`, `dist-ios/bundle.hbc` y `dist-android/bundle.hbc`. Se
  agregaron `.local/`, `dist-ios/` y `dist-android/`; **no se borró evidencia**.
  El gate se comprueba con dos motores que tienen que coincidir —el paquete
  `ignore` que usa EAS CLI y el motor de gitignore de git— y quedó **versionado**
  en `test/easignoreV492.test.ts`, así que lo corre `pnpm test` para siempre.
- **P2-B · el runner de Android podía quedar verde sin APK.** El 12 terminaba con
  `exit $gradle_exit`: con Gradle en 0 y sin APK, el log decía FALLO y el proceso
  salía 0. El runner 13 calcula el veredicto como función de prebuild + Gradle +
  **existencia del APK**, con self-test de las seis combinaciones.
- **P2-C · la auditoría de bundle miraba sólo el primer `.hbc`.** El 13 recorre
  **todos** los bundles de cada plataforma: lo prohibido se exige bundle por
  bundle y el contrato se cuenta sobre el total, así que un segundo bundle no
  puede ni esconder Tarot/Diario ni inflar el conteo. El self-test lo demuestra.
- **P2-D · fidelidad byte a byte del snapshot Android.** Manifiestos
  deterministas (ruta + tamaño + SHA-256) del árbol y del snapshot, comparados
  **antes** del prebuild y con aborto si difieren. Resultado: 939 archivos, 0
  symlinks, mismo digest; `BUILD SUCCESSFUL`, APK de 196 MB en disco. Ningún
  `.env*` entra al manifiesto ni al snapshot.
- **Checks.** `pnpm typecheck` 0 · `pnpm test` **1532/1532** (+13, ninguna
  debilitada) · piso 1532/745 · gate `_generated` **7/7** sin codegen ·
  `git diff --check` 0 y 0 · 209 untracked sin avisos de whitespace · exports
  web/iOS/Android verdes con auditoría de **todos** los `.hbc` · smoke web
  anónimo sin errores de consola · compilación Gradle real del snapshot
  manifestado. Verificación en las dos direcciones: **10 reversiones**, todas
  fallan sin su arreglo y pasan con él, restauradas byte por byte.
- **Archivos de producto tocados (5):** `src/domain/refreshCycle.ts`,
  `src/hooks/useLayers.tsx`, `test/refreshQueueV492.test.ts`,
  `test/easignoreV492.test.ts` (nuevo) y `.easignore`. **Cero en backend.**
  `src/domain/refreshQueue.ts` no hizo falta tocarlo: el relevo ya estaba bien,
  lo que faltaba era declararle un alcance nuevo.
- **Próximo paso de aquel momento — EJECUTADO/REEMPLAZADO por pasadas 14–15:** el
  contrato se desplegó a Development y 04/09 se cerraron al volver el proveedor; 06,
  02, VoiceOver físico y web autenticada siguen como pendientes no bloqueantes
  según la ficha vigente al inicio.

**Recertificación iOS local (2026-08-17, TERCERA pasada — cierre histórico de la
auditoría independiente; el conteo vigente lo fija la PASADA 15 al
inicio):** el veredicto honesto **no** era "los 12 estados pasan". Al cierre de esa
pasada: **9 PASS · 1 PASS de frontend con el copy del backend pendiente de deploy
(09) · 1 BLOCKED por entitlement externo (06) · 1 sin recapturar (02)**. Aparte: **D7 funcional PASS / visual N/A** y **VoiceOver
BLOCKED** por el runtime. Informe y evidencia:
`.local/audits/native-v492-recertification-2026-08-17/README.md`; resumen visual
en `design-qa.md`.

Una auditoría independiente comparó a ojo los PNG de `compare2/` y leyó el
código: el "12 de 12 PASA" de la segunda pasada no se sostenía. Esta pasada
corrige lo corregible localmente, recaptura y dice el resultado real. **Nada se
borró:** conviven `compare/` (1.ª), `compare2/` + `logs2/` (2.ª) y `compare3/` +
`logs3/` + `shots/cert3/` (ésta).

- **`access.positions` NO es entitlement (D7, re-corregido).** En
  `convex/layers.ts` vale `snapshot !== null`. Las dos pantallas de Carta lo
  leían como acceso: el hub decía "TU CARTA SE ESTÁ CALCULANDO" sin mirar si
  había una corrida, y la carta completa mostraba un **muro de Órbita Plus por
  un cálculo pendiente**. Ahora el estado sale de `natalChartState` —siete
  hechos: query en vuelo · faltan datos · corrida activa · sin corrida y sin
  snapshot (recuperable) · parcial · listo— y el límite de Plus se pregunta
  **por superficie** (`natalHousesAccess` / `natalAspectsAccess`). Medido en
  runtime: **7 min 5 s** en el estado recuperable **sin ninguna corrida
  activa**, y menos de 5 s para resolver al tocar `Comprobar de nuevo`
  (`logs3/d7-recalculo.md`).
- **D9, defecto nuevo: el candado de guardar y borrar era estado de React.**
  `saving` y `borrando` se aplican en el render siguiente, así que dos toques
  del mismo render entraban los dos; en el borrado, `borrando` se encendía
  DESPUÉS de la confirmación y dos toques abrían dos alertas. Candado sincrónico
  en `src/domain/exclusive.ts`, tomado antes del primer `await` y liberado en
  `finally`. **Probado por comportamiento**, no por búsqueda de palabras.
- **Vínculos con `data:null`.** El modo salía de `data?.generalOnly`, que sin
  cálculo no existe: el nivel 01 dibujaba cinco barras en cero y culpaba a la
  fecha de la otra persona aunque faltara la carta propia. Ahora el modo sale
  del **nivel guardado**, no se dibuja ninguna barra en cero (`SIN CALCULAR`), y
  cada causa dice **de quién** es el dato que falta; el botón que se ofrece es
  el del dueño del hueco.
- **Correcciones visuales recapturadas.** 03: los ordinales `10` y `11` se
  partían en dos renglones (columna de 14 pt fija; dos dígitos de Roboto Mono a
  13 px miden 15,6). 04: se comparaba con la trazabilidad plegada contra un
  frame desplegado. 08: `Aire 1 · Urano` junto a `AIRE SIN PLANETAS`. 09: las
  cinco barras de cobre → el tono sale del balance apoyo/tensión de cada
  dimensión, y se declara en la leyenda y en la etiqueta accesible. 10: `1/6` y
  "otras cinco" → escalera canónica `1/5`, "una dimensión / las otras cuatro",
  riel azul. 12: una sola definición de qué anillos se dibujan; `Ves 2 anillos
  de 4` y el dial dibuja dos. 06: se agregó la fecha del día en la barra
  superior.
- **La costura tenía un SEGUNDO defecto.** `fullpage2.mjs` arregló la barra fija
  de abajo pero no la de arriba: en las pantallas de detalle, `← ARCO DEL
  TRÁNSITO` se cosía una vez por costura, a mitad de página. `fullpage3.mjs`
  detecta las dos bandas por píxeles (99 pt abajo, 50,7 pt arriba en detalle,
  0 en pestañas).
- **Estado 06 · BLOCKED por entitlement, no por diseño.** El frame dibuja una
  carta completa (`12 CASAS · 8 ASPECTOS MAYORES`), o sea una cuenta con Plus.
  **Ninguna cuenta QA local tiene Plus** —verificado en los tres simuladores— y
  `isPro` sale de filas reales de suscripción. **No se concedió acceso, no se
  tocó monetización y no se declara PASS.** Lo capturado es el estado
  alternativo honesto, dicho como tal.
- **D7 no se compara visualmente contra el frame `06`.** Uno es un recálculo y
  el otro una carta lista. No existe frame canónico del estado pending, así que
  se declara **FUNCIONAL PASS / VISUAL N/A** con before/pending/after y tiempos
  reales.
- **Estado 02 no se recapturó** y no se declara PASS de esta pasada: su fixture
  vivía en un simulador descartable que la segunda borró. Su código no se tocó;
  la evidencia válida sigue siendo la de aquella pasada.
- **El smoke web, ahora con claves.** El anterior corrió sin claves públicas, así
  que su `Could not find Convex client` en `/` y `/carta` no decía nada del
  producto. Repetido con las `EXPO_PUBLIC_*` del checkout original cargadas
  **sólo al entorno del proceso** (`tools/with-public-env.sh`, valores nunca
  impresos) y con `--clear` —la caché de Metro conservaba el valor vacío—: las
  **cinco rutas cargan sin un solo error de consola**. `/` dibuja la landing
  entera. **No era un defecto del producto.**
- **El gate de `style` en forma función ya no es ciego a los callbacks
  multilínea.** Analiza el archivo entero y reporta la línea de la prop; se
  auto-prueba en las dos direcciones, incluidas trampas donde blanquear
  comentarios podría esconder código ejecutable.
- **Checks.** `pnpm typecheck` 0 · `pnpm test` **1325/1325** (+16, ninguno
  debilitado) · piso 1325/745 · `git diff --check` 0 · exports web/iOS/Android
  verdes · bundles nativos sin Tarot ni Diario (las 3 apariciones de `diario`
  son copy y dos rutas que en nativo sólo redirigen — el "0 en cualquier caso"
  del informe anterior era inexacto).
- **Árbol y datos QA.** Todo sin commitear, sin deploy. 19 archivos de código
  tocados en esta pasada, **cero en backend**. El perfil QA quedó exactamente
  restaurado (`16 Ago 1996 · 12:00 · Buenos Aires`, Ascendente Escorpio 28°,
  2 personas guardadas), sin fixture natal temporal.
- **Próximo paso exacto:** conseguir un entitlement Plus real para cerrar el
  estado 06, recorrer la app con VoiceOver en un iPhone real, y desplegar los
  dos cambios de copy del backend cuando Lucas lo autorice.

**Recertificación iOS local (2026-08-17, segunda pasada — superada por la
tercera):** declaró **los 12 estados capturados, comparados y aprobados** con
ocho defectos funcionales corregidos (D1–D8). **Ese veredicto no se sostuvo**: la
auditoría independiente encontró defectos funcionales abiertos y divergencias
visuales materiales. Lo que sí quedó firme de esa pasada y sigue vigente: el
cierre del defecto sistémico de `style`, el fixture del estado 02, D8, y las
correcciones de canon y concordancia. El detalle de aquella pasada:

- **La evidencia visual de la primera pasada era inválida** y se rehízo entera.
  El cosido de página completa tenía DOS defectos: repetía la barra fija de
  pestañas a mitad de página, y **perdía contenido** porque medía el
  corrimiento con el árbol de accesibilidad mientras el `swipe` seguía con
  inercia (511 pt de arrastre movían 882 pt, más que los 706 pt visibles: había
  filas que no aparecían en ninguna captura). Ahora la banda fija se detecta por
  píxeles y se pega una sola vez al final, el arrastre es lento (sin inercia) y
  el corrimiento se mide sobre las imágenes. **Los 12 estados se recapturaron
  desde cero** en `compare2/`; `compare/` se conserva intacto.
- **Estados aprobados** (alto implementación → frame): 01 Hoy `2767→2436` ·
  02 Hoy con evento `2788→2483` · 03 Tránsitos `3110→1990` · 04 Arco
  `1337→2051` · 05 Tu momento `2697→2100` · 06 Carta `2133→1817` · 07 Tipo
  lunar `2296→2271` · 08 Mapa elemental `1322→1212` · 09 Vínculos carta
  `1897→1329` · 10 Vínculos signo `1406→1022` · 11 Carta sin hora `1738→2036` ·
  12 Tu momento sin hora `2102→2177`.
- **02 Cumpleluna hoy: RESUELTO.** La búsqueda inversa sobre efemérides que la
  pasada anterior declaró irresoluble se resolvió con el propio motor del
  proyecto: se pidió al proveedor real (`planets/tropical`) la elongación
  Sol–Luna del día, se retrocedieron 371 meses sinódicos y se refinó con
  `findCumplelunaCrossing`. Resultado verificado: **19/08/1996 · 16:10 · Buenos
  Aires**, cuya repetición cae hoy a las 12:58. Se cargó por la UI pública en
  una cuenta Clerk descartable, sobre un **simulador aparte** que después se
  borró; la cuenta QA principal no se tocó. La app confirmó: *"Tu cumpleluna fue
  hoy a las 12:58"*.
- **D7 verificado en runtime, dos veces.** Quitar la hora: `17:50:39` →
  carta lista sin hora `17:52:05` (**~86 s**). Devolverla: `17:58:51` →
  `Ascendente en Escorpio, 28 grados` a las `18:00:45` (**~65 s**). El encargo
  preveía 2–3 min; el proveedor terminó antes y se documenta la transición real,
  sin forzar delay. Copy en curso y recuperable: `TU CARTA SE ESTÁ CALCULANDO` +
  `Comprobar de nuevo si tu carta ya está calculada`.
- **D8, defecto NUEVO encontrado al restaurar el perfil.** Tras guardar "No sé
  la hora", el editor reabría mostrando `12:00` con el interruptor apagado y
  `Guardar` bloqueado por "no cambiaste nada": **la hora era imposible de
  devolver por la UI**. Causa raíz: el `patch` de `convex/birthData.ts` OMITE
  `birthTime` en vez de borrarla. Corregido en los dos lados —la precisión manda
  sobre el valor en el frontend, y el backend manda `birthTime: undefined`
  explícito—, con tres gates.
- **Defecto sistémico cerrado.** Las 18 ocurrencias pendientes de `style` en
  forma función, **más `TabBar.web.tsx`** que el informe anterior no listaba.
  **0 ocurrencias ejecutables** quedan en `app/**` + `src/**`, con gate nuevo
  (`test/pressableStyleValue.test.ts`) que escanea el árbol entero y se
  auto-prueba. Probado con un A/B en el simulador: el botón `PREGUNTAR` del
  Umbral pasa de texto suelto a píldora con su borde.
- **Correcciones de canon y concordancia:** el nivel 01 de Vínculos se encabeza
  `VOS Y ALGUIEN DE TAURO` aunque la persona tenga nombre (regla en el dominio);
  la pantalla ya no dice "las otras cuatro" mientras lista cinco; la estación
  vital escribe mes y AÑO (`EMPEZÓ DIC 2023 · PRÓXIMA FASE NOV 2027`); el mapa
  elemental dice `CUANDO LA TIERRA SATURA`; el mandala ya no dice
  "Ves 1 anillos de 4".
- **Backend corregido, tipado, probado y SIN desplegar** (dos cambios en
  plantillas editoriales): el artículo del elemento (`la tierra` · `el agua` ·
  `el fuego` · `el aire`) y la voz del canon en Vínculos (segunda persona sin
  nombres: `Su Venus forma un trígono con tu Marte…`, con el artículo del
  aspecto concordado). Como no hay deploy, **no se ven en las capturas**.
- **Accesibilidad.** 375/393/440, Dynamic Type, Reduce Motion, contraste y
  **orden de foco** medidos y aprobados. Dos correcciones al informe anterior:
  el mínimo de contraste para TEXTO es **4,80:1** (no 5,13:1 — aquél midió sólo
  contra un fondo), y **no se puede sostener** que la barra exponga rol `tab` y
  estado `selected`: `idb` los devuelve como `GenericElement`.
- **VoiceOver: BLOQUEO EXTERNO DEMOSTRADO.** Se agotaron cuatro vías seguras
  (`simctl ui`, el default `VoiceOverTouchEnabled` + invalidación de cache,
  Ajustes → Accesibilidad, Ajustes → Spoken Content) y se probó que el binario
  no está: `ls /System/Library/CoreServices/VoiceOverTouch.app` → *No such file
  or directory*. **No es una limitación de automatización: el lector no está
  instalado en iOS 26.5 Simulator.** Exige un dispositivo físico.
- **Checks.** `pnpm typecheck` 0 · `pnpm test` **1309/1309** (+15) ·
  `git diff --check` 0 · export web dentro de límites (32.09 MB · JS gzip
  1004.0 KB) · smoke web de las cinco rutas en Chrome headless · exports iOS y
  Android verdes, los dos **sin Tarot ni Diario** (0 coincidencias, incluida
  `diario`). Ningún test se debilitó: dos anclajes obsoletos se movieron
  **reforzando** la garantía, comentados en el propio test.
- **Árbol y datos QA.** Todo sin commitear, sin deploy. 29 archivos de código
  tocados en esta pasada (18 front, 3 backend, 8 tests). El perfil QA quedó
  exactamente como estaba (`16 Ago 1996 · 12:00 · Buenos Aires`, Ascendente
  Escorpio 28°, 2 personas guardadas) y el simulador descartable se borró.
- (El "próximo paso" de aquella pasada quedó reemplazado por el de la tercera,
  arriba.)

**Certificación iOS local (2026-08-16, corrida anterior):** el producto quedaba
**NO CERTIFICADO** **con medición real**: **0 PASS · 11 FAIL · 1 BLOCKED**
sobre 12 estados. Informe y evidencia completos:
`.local/audits/native-v492-certification-2026-08-16/README.md`.

**Los dos blockers del informe anterior están resueltos.**

**Blocker B — `INPUT_HIT_SLOP` — RESUELTO.** `src/onboarding/screens/SignInScreen.tsx(148,28):
TS2304` era un identificador libre: no estaba declarado ni importado en ningún
lado, y además de romper el typecheck lanzaba `ReferenceError` en runtime en la
rama `passwordPhase`. **Arreglo: se quitó esa única línea**, que es el cambio
mínimo y coherente con los patrones del repo —no existe ningún token de hit slop
(los 30+ usos son literales numéricos sobre `Pressable`) y **ningún `TextInput`
del repo usa `hitSlop`**, empezando por el campo de email hermano en la misma
pantalla con el mismo `styles.input`—. El archivo queda **idéntico a
`origin/main`**. Verificado también en runtime: durante el login en el simulador
SE la cuenta QA cayó en `passwordPhase` y la pantalla **renderizó sin excepción**.

**Blocker A — backend Development — RESUELTO.** Se desplegó el backend V4.9.2
**exclusivamente a `dutiful-viper-815` (Development)** con `pnpm exec convex dev
--once --env-file <checkout original>/.env.local` (exit 0). Las variables entraron
**sólo al proceso**: no se imprimieron ni se copiaron. La migración de esquema
fue **aditiva y sin pérdida** —el comando sólo reportó tres índices nuevos
(`natalEphemerisCachesV492.by_cache_key`, `.by_user`,
`relationshipProfiles.by_user_creation_request_key`)— y nunca pidió una migración
destructiva. El codegen actualizó `convex/_generated/api.d.ts` (+22 líneas).
Verificación read-only posterior con `convex function-spec`: **125 funciones (86
públicas, 39 internas)** y **las 9 del contrato presentes**
(`layers.getNatalBase`, `getNatalChartBase`, `getForDate`, `refreshForDate`;
`relationships.list`, `savePerson`, `removePerson`, `getComparison`,
`refreshComparison`), `MISSING_COUNT: 0`. **Producción no se contactó ni para
leer.** No hubo EAS, TestFlight, App Store, commit, push ni merge.

**Cuenta y datos QA, todos por flujos públicos reales** (toque y teclado reales
sobre el simulador; sin mocks y **sin una sola escritura directa a la base**):
cuenta Clerk `orbita.v492+clerk_test@example.com` creada por la **UI oficial de
Clerk** en la instancia Development con **OTP 424242** (sin OAuth y sin
contraseña personal: Clerk exigió contraseña y se usó una generada al azar, no
registrada; el reingreso va por código al email). Perfil propio cargado por el
onboarding completo: **16/08/1996 · 12:00 · Buenos Aires, Ciudad Autónoma de
Buenos Aires, Argentina** → tríada Sol Leo · Luna Virgo · Ascendente Escorpio.
Vínculo carta con carta: **Martina QA, 4 de mayo de 1994 · 09:12 · Buenos
Aires**. Vínculo signo: **Tauro** (se tipeó "Persona Tauro QA" y quedó guardada
como "Persona Tauro"; el signo, que es lo que la certificación evalúa, es
correcto). Datos reales verificados en el backend: posiciones tropicales del
16/08/2026 y snapshots con `analysisId`, `status: "ready"` y `sourceRefs`.

**Los 12 estados.** Se capturó **página completa a 393 pt** —los frames de
`reference/` son páginas enteras de hasta 2500 pt— y se comparó **lado a lado con
la referencia** en cortes de 850 pt (`compare/`, 41 imágenes). Se rechazaron y
rehicieron capturas por diálogo del sistema encima (01), pantalla de recálculo
(11) y una costura defectuosa (01). Las diferencias de datos astrológicos no
cuentan como falla: los frames usan otra persona de muestra. **01, 03–12: FAIL.
02: BLOCKED** (el estado exige el día en que ocurre la Cumpleluna; para este
perfil es el 13/09, y falsear la fecha del dispositivo contaminaría los otros
once). Tres patrones atraviesan los once FAIL: **bloques enteros ausentes**
(`LO PRINCIPAL HOY`, `EL CICLO COMPLETO`, `POR DIMENSIÓN`, `AGREGAR O CORREGIR
HORA`, los planetas por elemento, los tres contactos), **densidad** (la
implementación mide entre 1,1× y 2,2× el alto del frame por descargos y
explicaciones extra) y **encabezados de dos columnas que se parten en dos líneas**
(05, 09, 10). Detalle estado por estado en el README del audit.

**Siete defectos registrados, ninguno arreglado** (la instrucción lo prohibía):
**D1** la barra de pestañas amontona los cinco ítems a la izquierda —ocupan de 2
a 195 pt en pantallas de 375, 393 y 440— con "Hoy" en **18 pt de ancho** contra el
mínimo táctil de 44, y el frame de referencia muestra la barra bien repartida;
**D2** las ruedas nativas de "Agregar persona" y "Editar datos" capturan cualquier
arrastre vertical y **cambian el dato en vez de scrollear** (medido: 4 → 27 de
mayo, 1994 → 1992, 09:12 → 09:24, 16 → 23 de agosto; la primera persona se guardó
efectivamente mal); **D3** ese picker está **en inglés** (`January…December`,
`AM/PM`) en una app en español y expone sus columnas como `AXSlider` con
`AXLabel: null`; **D4** "Guardar cambios" no respondió cuatro veces seguidas, sin
error y sin llegar al backend, y sólo guardó tras volver a elegir la ciudad;
**D5** el primer refresh tras el alta falla con `LAYER_INPUT_CHANGED_DURING_REFRESH`
y **"REINTENTAR" no lo recupera** (sólo relanzar la app); **D6** el editor propone
**medianoche** cuando no hay hora guardada; **D7** el recálculo natal tarda 2-3
minutos mostrando "TU CARTA TODAVÍA NO ESTÁ CALCULADA".

**Tamaños y accesibilidad, sólo lo medido.** 393 pt a fondo. **SE (375)** y **Max
(440)**: login OTP real y Hoy completa en ambos, sin recortes en el contenido y
con la misma barra rota. **Dynamic Type**: probado en 393 con
`content_size accessibility-extra-large` + relanzamiento — el texto **escala y
reflowea de verdad**, sin recortes (en caliente no cambia nada). **Objetivos
táctiles**: falla en la barra (18–55 pt); el contenido va sobrado (tarjetas de
345×304). **Semántica VoiceOver del contenido**: buena, con etiquetas completas e
imágenes descritas; **de los formularios**: falla (D3). **Reduce Motion,
contraste y VoiceOver con el lector encendido: NO evaluados**, sin resultado.

**Nota de método — el Mac quedó bloqueado a mitad de corrida.** Sin sesión gráfica
Simulator.app no crea ventanas y el harness anterior (`tools/qa.mjs`, que inyecta
toque con `cliclick` sobre esa ventana) quedó inutilizable. **No se intentó
desbloquear el Mac.** La corrida siguió con `idb`, que inyecta eventos HID
directamente al simulador —toque, arrastre y teclado reales, sin ventana—, en
`tools/hid.mjs`. Dos aprendizajes: el árbol de React por CDP **se queda viejo**
con el navegador de pestañas (casi produce un falso defecto: la captura demostró
que la pantalla sí renderizaba), así que la fuente de verdad para tocar pasó a ser
el árbol de accesibilidad de iOS; y una costura mal medida **inventó** un
solapamiento de texto en 05 que no existe, verificado contra el viewport crudo.

**Checks finales:** `pnpm typecheck` **PASS exit 0**, `pnpm test` **PASS
1267/1267** (93 suites, 0 fail), `git diff --check` **PASS exit 0**. Se
preservaron todos los cambios sin commitear. Archivos tracked tocados por esta
corrida: `src/onboarding/screens/SignInScreen.tsx` (queda idéntico a
`origin/main`) y `convex/_generated/api.d.ts` (+22 de codegen). Todo lo demás vive
en `.local/audits/native-v492-certification-2026-08-16/` más `.env.local`
(ignorado por git). ⚠️ **`.local/` sigue sin estar en `.gitignore`**: un `git add
-A` la arrastraría.

**Próximos pasos sugeridos, no ejecutados:** (1) D1, la barra de pestañas, que
rompe navegación y mínimo táctil en los tres tamaños; (2) D2 y D3, el formulario
de "Agregar persona", donde hoy se puede guardar una fecha distinta de la elegida;
(3) los bloques de diseño ausentes; (4) D5; (5) definir cómo se certifica el
estado 02, que depende de un evento del calendario; (6) medir Reduce Motion,
contraste y VoiceOver con el lector activo.

**Duodécimo pase (2026-08-18, la action colgada que bloqueaba el ciclo y los
gates de release que no eran gates) — un P1 de liveness, su P2 hermano y tres
pendientes de release cerrados; el veredicto visual de los 12 estados NO cambia.**

El undécimo pase cerró con typecheck limpio, gate 7/7 y 1505/1505. **Tres
auditorías independientes** reprodujeron sobre él un P1 de LIVENESS, un P2
hermano y tres pendientes de release que esa suite no podía ver porque no eran de
código de producto: eran del proceso que lo certifica. Nada del cierre del
undécimo se borra ni se corrige: era cierto.

- **P1-A · una action colgada bloqueaba PARA SIEMPRE a un alcance más nuevo.**
  `drain()` quedaba parado en `await deps.run(A)`. Si A no resolvía nunca —la red
  cortada a mitad de la action— todo lo que llegara después con otra clave
  quedaba `pending` para siempre: `busy` en `true`, `CALCULANDO…` permanente, y
  volver de background sólo movía reloj e intento sin rotar la generación viva.
  La cola garantizaba single-flight y "la más reciente gana", pero eso describía
  la COLA, no el PROGRESO.
  **El arreglo:** una semántica explícita de **alcance** (`RefreshScope`). La
  clave del último pedido admitido —`cuenta|día|zona|hora|intento`, los cinco
  ejes que hacen que un recálculo deje de servir— viaja con cada pedido, y cuando
  el alcance de lo pendiente difiere del de la corrida viva, la cola hace un
  **relevo**: avanza la generación, suelta el candado, deja la corrida vieja
  huérfana —sin publicar flags, sin resolver waiters, sin pisar el resultado de
  la nueva— y arranca la pertinente. **No es un temporizador:** el disparador es
  el cambio de alcance, no el paso del tiempo, y hay una prueba dedicada a que
  pasar cinco turnos del bucle de eventos **no** releva nada. El relevo se decide
  **al final del tick** (microtarea), y por eso la secuencia física es **A/C** y
  no A/B/C: B se descarta como intermedia, y una corrida que termina sola dentro
  del mismo tick gana por el camino normal sin quedar huérfana al pedo.
  **El precio, dicho:** cada relevo paga una huérfana física más, sólo cuando el
  alcance cambió y la corrida anterior seguía viva. Es el mismo total de acciones
  —A y C se ejecutan igual—, en paralelo en vez de en fila. Dentro de una misma
  generación viva sigue habiendo una sola action, y sin alcance declarado la cola
  no releva nada.
- **P2-A · `pedirYEsperar()` envenenaba la clave durante la suspensión.**
  Escribía la clave ANTES de llamar a `requestAndWait`, que con el ciclo
  suspendido rechaza en el acto y **sin encolar nada**. La clave quedaba anotada
  por un pedido que nunca salió, así que al reabrir el efecto la veía como propia
  y se salteaba el refresco: la pantalla se quedaba con el sobre viejo y sin nada
  en vuelo que lo arreglara.
  **El arreglo:** la cola expone `accepts()` —exactamente la condición con la que
  `requestAndWait` decide rechazar— y el ciclo la consulta en el **mismo instante
  sincrónico** en que escribiría la clave. Reproducción cerrada por prueba: A
  corre · se suspende · `pedirYEsperar(B)` rechaza · la clave no queda en B · al
  reabrir, B corre **exactamente una vez**.
- **P1-B · Android compila de verdad, por primera vez en esta corrida.** Lo que
  se venía corriendo era `expo export --platform android`, que empaqueta el
  bundle JS y **no compila una sola línea nativa**. Ahora: copia del árbol actual
  —con los untracked productivos, sin `.git`, sin `.local/`, sin `dist*` y **sin
  ningún `.env`**— a un temporal bajo `/private/tmp`, `node_modules` por symlink,
  `expo prebuild --platform android --no-install` local y
  **`./gradlew :app:assembleDebug --no-daemon`** con JDK Temurin 17.0.19, SDK 36
  y NDK 27.1.12297006: **`BUILD SUCCESSFUL in 4m`, 511 tareas, exit 0, APK de
  196 MB**. Sin EAS, sin instalar toolchain, sin ensuciar el worktree y borrando
  sólo el temporal creado por el script. Un export ya no se llama compilación.
- **P2-B · el runner de exports no podía fallar.** El anterior corría con `set -u`
  solo, imprimía **`exit=0` hardcodeado** al final del bloque de auditoría, y los
  tokens se imprimían sin compararse contra nada. `tools/run-exports12.sh` es un
  gate: `set -euo pipefail` con control explícito por etapa, glob vacío que no
  rompe pero tampoco pasa (sin bundle es FALLO), tokens prohibidos que hacen
  fallar, **42 comprobaciones contractuales comparadas** contra su valor,
  limpieza por `trap` con targets exactos y validados —`dist/` se conserva
  siempre— y un **`--self-test`** que, sin correr un solo export, demuestra con 1
  control positivo y 3 negativos que el runner sale **non-zero**. En el camino se
  corrigió un defecto propio: el bloque de auditoría estaba escrito como
  `{ ... } | tee`, y **un pipe abre una subshell**, así que el contador de fallas
  se perdía y el gate podía ver un token prohibido y salir en verde igual.
- **P2-C · `.local/` fuera del alcance de un `git add -A`.** Son 288 MB de
  evidencia y **cero archivos con seguimiento**. Se agregaron `.local/`,
  `dist-ios/` y `dist-android/` a `.gitignore` (`dist/` ya estaba). **No se borró
  nada de la evidencia**: los 2660 archivos bajo `.local/` siguen completos en
  disco. `git status -uall` pasa a listar **exactamente 208** entradas sin
  seguimiento, y esas 208 son **todas** productivas. (La undécima había medido
  601 untracked, 393 bajo `.local/`; esos 393 no eran los archivos reales: dos
  entornos virtuales de Python bajo `.local/audits/` traen su propio `.gitignore`
  con `*` y tapaban el resto, así que la cuenta anterior ni siquiera mostraba el
  tamaño del riesgo.) **Deberán seleccionarse
  intencionalmente, uno por uno, recién cuando Lucas autorice el commit**: esta
  pasada no staged nada y el índice quedó con las dos entradas que ya tenía.
- **P2-D · documentación y smoke web.** Se corrigió el conteo del undécimo pase
  (decía 5 archivos de código y listaba 6; el total documental salía corrido) acá
  y en el README del audit. El **smoke web de la tercera pasada ya no se cita
  como vigente**: se repitió **sobre el export actual**, en Chrome headless con
  perfil nuevo y descartable —**sin login, sin OAuth y sin inventar datos**—, y
  las cinco rutas cargan con **cero errores de consola**. **Es anónimo por
  construcción, así que NO es la verificación visual autenticada**: un export
  verde y una suite verde no equivalen a un smoke visual/autenticado, y ninguno
  reemplaza al otro. `convex/CHANGELOG.md` **no cambia y eso es lo correcto**:
  esta pasada no toca un solo archivo de `convex/`.
- **Pruebas nuevas (+14, de 1505 a 1519),** todas en `refreshQueueV492` y todas
  con **promesas diferidas**, que es lo único que permite controlar el
  interleaving de verdad: A colgada + B + C ⇒ secuencia A/C · A termina MIENTRAS
  C corre · C sale bien y A falla después (`refreshFailed` en false) · los cinco
  ejes del alcance uno por uno · el resume de foreground con sólo el intento
  movido · la misma clave no releva ni duplica · una action del ciclo vigente y
  una sola huérfana física · sin alcance declarado no se releva nada · **el
  relevo no es un temporizador** · los waiters de la relevada los termina el
  trabajo vigente una sola vez · el reintento automático conserva su alcance ·
  y las tres de la clave admitida. **Ningún test se borró, se saltó ni se
  aflojó**; los 37 del undécimo siguen pasando sin tocarlos.
  **Verificadas en las dos direcciones** (`logs12/verificacion-antes-despues.md`):
  los **seis** arreglos revertidos por separado hacen fallar su prueba focal
  —entre 1 y 8 pruebas cada uno— y restaurados vuelven a pasar, con el sha256 de
  cada archivo idéntico al de antes. Revertir sólo la microtarea del relevo rompe
  4 pruebas, **3 de ellas del undécimo pase**: la decisión al final del tick es
  load-bearing.
- **Checks del pase:** `pnpm typecheck` PASS exit 0 · `pnpm test` **1519/1519**
  (93 suites, 0 fail, exit 0) · gate de `_generated` **7/7** exit 0 (no hizo falta
  codegen: no se toca `convex/`) · piso de cobertura **1519/745**, 0 fallos ·
  focales de cola, ciclo, `useLayers` y recuperación natal **166/166** ·
  `git diff --check` PASS en working tree e índice, y los **208** untracked
  revisados con `--no-index` juzgando la SALIDA: **0 avisos** · export web PASS
  con límites (32.10 MB / 50 · JS gzip 1006.2 KB / 1.25 MB · ficha completa) ·
  **smoke web sobre el export actual**, cinco rutas sin errores de consola ·
  exports iOS y Android PASS (7.0 MB cada bundle) · auditoría de bundle **42
  comprobaciones, 0 fallas** · self-test del gate **exit=3** · **compilación
  nativa Android `BUILD SUCCESSFUL`, APK 196 MB** · limpieza de `dist-ios/` y
  `dist-android/` con targets exactos, `dist/` conservado, sin `git clean`.
  Evidencia en `logs12/`.
- **Qué NO cambió el veredicto.** No se abrió un simulador, no se recapturó un
  solo estado, no se desplegó nada y no se tocaron datos QA, suscripciones ni
  credenciales. **04 BLOCKED** —exige desplegar el contrato aditivo a Convex
  Development **y recapturar**—, **06 BLOCKED** —exige entitlement Plus real—,
  **02 sin recapturar**, **08 y 09 PASS de código con la evidencia runtime
  pendiente**, **D7 funcional PASS / visual N/A** y **VoiceOver BLOCKED** por el
  runtime del simulador: exige un iPhone físico. El defecto de liveness que este
  pase cierra **no se pudo ejercitar en runtime**: reproducirlo pide una action
  de Convex que no resuelva nunca. Está verificado por prueba y en las dos
  direcciones, no por captura.
- **Archivos del pase: 4 de código/pruebas + 1 de configuración + 3 documentos =
  8** (más 3 herramientas bajo `.local/`, que no se versionan). Frontend:
  `src/domain/refreshQueue.ts` · `src/domain/refreshCycle.ts` ·
  `src/hooks/useLayers.tsx` (sólo documentación interna). Tests:
  `test/refreshQueueV492.test.ts`. Configuración: `.gitignore`. Documentos:
  `CURRENT_TASK.md` · `design-qa.md` · el README del audit. Herramientas del pase
  dentro del audit: `tools/run-exports12.sh` · `tools/verify-reverts12.mjs` ·
  `tools/android-native-compile12.sh`. **`convex/**` no se tocó**, así que
  `convex/CHANGELOG.md` no cambia. `git status` **no suma ninguna entrada nueva**
  sin seguimiento fuera de `.local/`. HEAD sigue en `52836ad`, **sin commit,
  push, merge, rebase, deploy de Convex, EAS Update, EAS Build ni publicación
  alguna**, sin codegen, y el árbol sucio con su índice quedó preservado: no se
  corrió `git add`, `git reset` ni `git clean`.
- **Límites externos que siguen abiertos:** el deploy del contrato aditivo a
  Convex Development y la recaptura de 04; el entitlement Plus real de 06; la
  recaptura de 02; el deploy del copy del backend para 08 y 09; la pasada de
  VoiceOver en un iPhone físico; y la **verificación visual autenticada** de la
  web, que exige una sesión y por lo tanto login. Ninguno depende de este pase.

**Undécimo pase (2026-08-18, el fence de versión del claim y el replay único del
refresh) — dos P1 y un P2 cerrados en código; el veredicto visual de los 12
estados NO cambia.**

El décimo pase cerró con typecheck limpio, gate 7/7 y 1493/1493 después del
codegen de Codex. **Dos auditorías independientes** volvieron a reproducir dos P1
y un P2 que esa suite no cubría: los tres son de INTERLEAVING, y ninguno se veía
mirando cada mitad por separado. Nada del cierre post-codegen del décimo se borra
ni se corrige: era cierto, y la auditoría posterior encontró estos tres.

- **P1-A · un claimant de `cacheVersion` vieja podía destruir una lectura
  vigente.** El CAS de `persistNatalReading` sí compara la versión configurada
  con la del texto, pero llega tarde: el claim se toma ANTES y medía la fila
  contra la versión que traía el claimant. Una action que arrancó en v1 y
  aterriza en la mutación con la configuración ya en v2 veía la fila v2 como "de
  otra versión", la tomaba, incrementaba `claimSeq` y la dejaba `pending` v1 con
  el payload en null. Reproducidos los dos desenlaces: con una generación v2 **en
  vuelo**, v2 terminaba en `claim_lost` y v1 en `cache_version_changed`, y la
  fila quedaba pendiente sin nadie generando; con una lectura v2 **`ready`**, el
  claim borraba el payload publicado y la escritura del claimant se rechazaba
  igual —la lectura válida ya se había perdido—.
  **El arreglo:** `applyNatalReadingClaim` compara `args.cacheVersion` con
  `getAiGatewayNatalCacheVersion()` **antes de consultar o mutar
  `natalInterpretations`**. Si no coinciden no toma claim, no incrementa
  `claimSeq`, no cambia status/payload/versión/`updatedAt` y no programa ninguna
  generación: devuelve `stale_cache_version`, cuarta variante de la unión interna
  `NatalReadingClaimRejection`, tipada explícitamente. El caller la trata como
  no-op —la registra con `cacheHit:false` y sale—, **no como error visible**: la
  Carta sólo toma como fallo el *reject* de la action. El claimant de la versión
  vigente conserva el flujo entero y el CAS final sigue exigiendo revisión +
  claim + versión. **Sin cambios de schema ni de firmas públicas.**
- **P1-B · suspend/resume podía ejecutar B dos veces.** La costura entre
  `refreshQueue` y `useLayers`: A en vuelo, B como única pendiente, el cleanup
  llamaba `suspend()` —que CONSERVA lo pendiente— y además borraba
  `requested.current`. Al remontar, `resume()` tomaba B y el efecto, viendo la
  clave en blanco, volvía a encolar la misma B: secuencia física **A/B/B**. Si la
  B retomada salía bien y el duplicado fallaba, `refreshFailed` terminaba en
  `true` **sobre datos recién calculados**.
  **El arreglo:** la costura pasa a ser un módulo puro,
  `src/domain/refreshCycle.ts`, que el hook consume entero. La política es una
  línea —`claveTrasCerrar`—: la clave sobrevive **exactamente cuando su pedido
  sobrevive**. Con algo pendiente se conserva (el ciclo nuevo lo retoma solo); sin
  nada pendiente se borra, porque lo que había quedó huérfano y el primer refresh
  se perdería con el doble montaje de StrictMode. Un cambio real de alcance
  produce una clave distinta y entra por el camino normal: B se retoma y C queda
  como la única pendiente. **No se reintroduce single-flight físico global**: la
  semántica por generación viva del décimo pase queda intacta.
- **P2-A · `request()` durante la suspensión encendía un busy fantasma.**
  `encolar()` publicaba `onBusyChange(true)` aunque la cola estuviera suspendida:
  `events:[true]`, `busy():false`, `suspended():true`. La UI podía mostrar
  `CALCULANDO…` por trabajo que ningún ciclo vivo estaba haciendo.
  **El arreglo:** suspendida, la cola **acepta y conserva** la solicitud con la
  misma política de "la más reciente gana", pero no publica ni busy ni failed.
  `resume()` sincroniza el flag con lo que la generación viva va a hacer de
  verdad: `true` si toma trabajo —lo pendiente o una corrida viva—, `false` si no
  hay ninguno. Un pedido hecho durante la suspensión corre **una vez** al
  reanudar.
- **Pruebas nuevas (+12, de 1493 a 1505).** Cuatro del fence de versión en
  `natalInterpretationRevisionV492` —v2 en vuelo + claimant v1 tardío, v2 `ready`
  comparada **byte por byte** antes y después, la corrida entera del claimant
  atrasado por el camino de la action (con el despacho del claim demorado hasta
  después del bump) y el claimant de la versión vigente tomando/reutilizando— más
  dos aserciones nuevas en el test del CAS post-bump, que ahora deja explícito
  que el claim SÍ se tomó cuando v1 era la vigente. Ocho en `refreshQueueV492`:
  la política pura, los tres interleavings de la costura (A/B con la misma clave;
  A sin pendiente; B pendiente con la clave ya en C), el duplicado que no puede
  dejar `refreshFailed=true`, y tres del busy durante la suspensión.
  **La prueba de forma que había se reemplazó por conductuales**: el grep del
  hook (`requested.current = null`) ya no alcanzaba —el defecto vivía justo en la
  costura que ese grep no miraba—, así que ahora se corre la cola real con el
  ciclo real y del hook sólo se verifica el cableado, incluido que **no quede
  ninguna copia de la clave fuera del ciclo**. Ningún test se borró ni se aflojó.
  **Verificadas en las dos direcciones** (`logs11/verificacion-antes-despues.md`):
  los cuatro arreglos revertidos por separado hacen fallar su prueba focal —entre
  1 y 3 pruebas cada uno— y restaurados vuelven a pasar; el árbol queda byte por
  byte como estaba.
- **Checks del pase:** `pnpm typecheck` PASS exit 0 · `pnpm test` **1505/1505**
  (93 suites, 0 fail, exit 0) · gate de `_generated` **7/7** exit 0 (no hizo falta
  codegen: no se agregan módulos ni contrato público) · piso de cobertura
  **1505/745**, 0 fallos, exit 0 · focales de charts/interpretación/cola/
  recuperación **258/258** · `git diff --check` PASS en working tree e índice, y
  los **601** untracked revisados con `--no-index` juzgando la SALIDA: **0
  avisos** (208 fuera de `.local/`: los 207 del décimo más
  `src/domain/refreshCycle.ts`) · export web PASS con límites (32.10 MB / 50 ·
  JS gzip 1006.0 KB / 1.25 MB · ficha completa) · export iOS PASS (7.0 MB) ·
  export Android PASS (7.0 MB) · bundles nativos **sin Tarot ni Diario**, con los
  mismos tokens del décimo presentes 1 vez en cada plataforma y
  `createRefreshCycle` 1 vez (las 3 apariciones de `diario` siguen siendo copy y
  dos rutas que en nativo sólo redirigen). Evidencia en `logs11/`.
- **Qué NO cambió el veredicto.** No se abrió un simulador, no se recapturó un
  solo PNG, no se desplegó nada y no se tocaron datos QA, suscripciones ni
  credenciales. `04` y `06` siguen **BLOCKED**, `02` sin recapturar, `08` y `09`
  PASS en código con la evidencia pendiente de deploy, D7 funcional PASS / visual
  N/A y VoiceOver BLOCKED por el runtime. Las tres carreras que este pase cierra
  **no se pudieron ejercitar en runtime**: exigen desplegar Convex y una cuenta
  con esas filas.
- **Archivos del pase: 6 de código/pruebas + 1 de contrato + 3 documentos = 10**
  (más 2 herramientas bajo `.local/`, que no se versionan). *(Corregido en el
  duodécimo pase: acá decía "5 … = 9" y la lista de abajo siempre tuvo seis
  archivos de código y pruebas.)*
  Backend: `convex/charts.ts`. Contrato: `convex/CHANGELOG.md` (**sin cambios de
  schema**). Frontend: `src/domain/refreshCycle.ts` (**nuevo**) ·
  `src/domain/refreshQueue.ts` · `src/hooks/useLayers.tsx`. Tests:
  `test/refreshQueueV492.test.ts` · `test/natalInterpretationRevisionV492.test.ts`.
  Documentos: `CURRENT_TASK.md` · `design-qa.md` · el README del audit.
  Herramientas del pase dentro del audit: `tools/verify-reverts11.mjs` ·
  `tools/run-exports11.sh`. `git status` suma **una** entrada nueva sin
  seguimiento fuera de `.local/` (`src/domain/refreshCycle.ts`). `dist-ios/` y
  `dist-android/` se borraron con targets exactos, validando antes que fueran
  directorios reales —no symlinks—, dentro del worktree y sin seguimiento de git;
  `dist/` se conserva. No se corrió `git clean`. HEAD sigue en `52836ad`, sin
  commit, push, merge ni deploy, y el árbol sucio con su índice quedó preservado.
- **Límite externo que sigue abierto:** el entitlement Plus del estado 06, la
  pasada de VoiceOver en un iPhone real y el deploy de los dos cambios de copy del
  backend. Ninguno depende de este pase.

**Décimo pase (2026-08-18, la carrera que quedaba, la identidad de la carta y el
artifact generado) — cuatro P1, un P2 y un gate de release cerrados en código; el
veredicto visual de los 12 estados NO cambia.**

El noveno pase cerró con typecheck limpio y 1465/1465, pero **tres auditorías
independientes** reprodujeron cuatro P1 y un P2 que esa suite no cubría, más un
gate de release que ninguna prueba miraba. Los cinco defectos vuelven a ser de
CONCURRENCIA; el gate es de otra clase: un artifact generado desincronizado del
código, sostenido por una afirmación falsa repetida en tres documentos.

- **P1-A · una falla tardía del proveedor ignoraba una carta concurrente
  ganadora.** El noveno pase movió la decisión DENTRO de la mutación, pero quedaba
  un camino que nunca llega ahí: la corrida que arranca **sin carta** y cuyo
  proveedor falla no tiene candidato que persistir, así que devolvía el desenlace
  que había decidido con su snapshot previo. Si otra corrida publicaba una carta
  durante la espera, la primera igual informaba `provider_failed`,
  `sufficient:false`, `chart:null`: `recoverNatalChart` daba un fallo falso y la
  action legacy podía lanzar con una carta válida en la base.
  **El arreglo:** antes de devolver esa rama se relee el estado natal vigente para
  la MISMA identidad (`charts.recheckNatalStateForRun`, query interna cerrada que
  mide suficiencia con la precisión natal de ahora y no escribe nada). Datos
  natales cambiados ⇒ rechazo estable
  `NATAL_BIRTH_DATA_CHANGED_DURING_CALCULATION`, nunca un éxito cruzado; carta
  suficiente ⇒ `cache_sufficient`, `sufficient:true`, esa carta y sin detalle de
  error; carta parcial ⇒ el fallo sigue siendo honesto pero **devuelve esa carta
  real**; ninguna carta ⇒ igual que antes. La medida final es la misma función que
  usa el camino con candidato (`resolveFinalNatalOutcome`). **Contratos públicos
  intactos.**
- **P1-B · una carta suficiente podía quedar ligada al `birthDataId` histórico
  para siempre.** El hash y el `cacheKey` describen los CAMPOS natales, no la fila
  que los guarda: una fila natal más nueva y semánticamente idéntica —recargar los
  mismos datos, reescribir el alta— produce el mismo `cacheKey`. La carta que ya
  existía ganaba (bien) pero sólo se le parcheaba `updatedAt`, así que seguía
  apuntando a la fila vieja; el cache de perfil, igual. Como
  `chartMatchesCompletionBirthData` exige la fila vigente exacta, el onboarding
  quedaba en `chart_pending` **para siempre** con el payload correcto delante y
  sin vía de reparación.
  **El arreglo:** dentro de la misma mutación monotónica se reafirma la identidad
  vigente en `natalCharts` (`userId`, `birthDataId`, `birthDataHash`, `cacheKey`,
  `updatedAt`) y en `profileAstrologyCaches` (`userId`, `birthDataId`,
  `natalChartId`, `cacheKey`, `cacheVersion`, payload elegido, `updatedAt`). Si
  gana la fila existente, su payload, su `providerVersion` y su
  `calculationVersion` quedan **byte por byte**: reafirmar identidad no es
  relabelar una carta con la procedencia de otra. Sin filas duplicadas y sin
  cambios de contrato.
- **P1-C · un éxito de recuperación podía saltear el refresh del día.**
  `useNatalChartRecovery` definía UN predicado `vigente()` que mezclaba dos cosas:
  mismo montaje/alcance y `recovery === "reintentar"`. Pero `recovery` sale de una
  query REACTIVA: el cálculo que funciona la mueve a `ninguna` antes de que la
  continuación corra, así que `refreshAndWait` no salía **nunca** justo cuando la
  recuperación había salido bien, y el sobre del día quedaba armado sin la
  geometría recién calculada.
  **El arreglo:** dos predicados explícitos. `mismoAlcance()` —montado + mismo
  `userId` + mismo `inputHash`— decide si el ciclo sigue; `falloVigente()` —eso y
  además que la salida siga siendo `reintentar`— decide si un error se publica. Un
  cálculo publicable del mismo alcance ejecuta **exactamente un** refresco
  esperable aunque la salida ya haya pasado a `ninguna`; un cambio real de alcance
  o un desmonte lo impiden; y un error tardío que ya no describe nada no queda
  pegado.
- **P1-D · `suspend()`/`resume()` podía dejar el ciclo nuevo bloqueado por una
  action huérfana.** El mutex de la cola seguía siendo un booleano global:
  `suspend()` cortaba los waiters pero lo dejaba tomado, así que con la action de A
  colgada `resume()` no podía arrancar nada y `CALCULANDO…` no se apagaba.
  **No se puede tener single-flight FÍSICO global y progreso** si A no resuelve
  nunca, y el arreglo no lo disimula: la semántica es **single-flight por
  generación viva**. El mutex pasa a ser un token de corrida; `suspend()` avanza la
  generación, corta las esperas, suelta el token y publica que el ciclo cerrado no
  está ocupado; `resume()` deja arrancar YA una solicitud pertinente aunque A siga
  pendiente; y una corrida sólo limpia al terminar **si todavía posee el token**,
  así que la huérfana no apaga a B, no toca `failed` ni resuelve waiters nuevos. El
  pedido que estaba en vuelo no se reencola en la cola —su efecto se descartó—:
  `useLayers` borra `requested.current` en el cleanup, así que el montaje nuevo lo
  vuelve a pedir y el primer refresh no se pierde con StrictMode. **La
  documentación de la cola dice el precio** en vez de seguir afirmando que nunca
  hay dos actions físicas.
- **P2-A · `cacheVersion` de la interpretación natal no invalidaba nada.**
  `ORBITA_LLM_NATAL_CACHE_VERSION` se persistía en cada fila y no la miraba nadie:
  lectura pública, estado y claim validaban sólo `chartRevision`. Un bump v1 → v2
  con el mismo prompt dejaba la fila v1 `ready` para siempre.
  **El arreglo:** cache hit, readiness y claim exigen **revisión y versión**. Una
  fila de otra versión queda no verificable: pública `pending` —no `error`—, no
  frena la generación nueva y se toma un claim nuevo sobre la misma fila. El CAS
  final exige además que la versión configurada AHORA sea la de ese texto, así que
  una generación que arrancó en v1 y vuelve después del bump no vuelve a publicar
  v1 (`cache_version_changed`) y la fila queda regenerable. **Sin cambios de
  schema ni de firmas públicas**; las filas legadas se conservan.
- **Gate de release · `convex/_generated/api.d.ts` estaba INCOMPLETO — CERRADO.**
  **Antes:** el árbol tenía `convex/lib/natalGeometry.ts` y
  `convex/lib/natalRevision.ts` y el artifact no los enumeraba. La afirmación que
  sostenía el error —"`ApiFromModules` deriva el `api` de los módulos, así que no
  hace falta regenerar nada"— es falsa a nivel de MÓDULO: lo que se deriva son las
  FUNCIONES de los módulos que `fullApi` ya lista, y `fullApi` lo escribe el
  codegen archivo por archivo.
  **El gate** (`test/convexGeneratedApiGate.test.ts`) compara sin red los módulos
  elegibles de `convex/**` con los imports y las entradas del artifact, en las dos
  direcciones y con la consistencia alias↔ruta, usando las reglas reales de
  `entryPoints()` del bundler de Convex 1.42.1 —no una lista de nombres, así que
  un módulo futuro se exige igual—. Se auto-prueba con artifacts sintéticos.
  **Durante:** falló a propósito nombrando esos dos módulos; ése era el estado
  honesto del árbol. Claude escribió el gate y **no** corrió el codegen ni editó
  `convex/_generated/**` a mano, porque el workflow le reserva ese comando al
  backend.
  **Después (2026-08-18):** **Codex** corrió `pnpm convex:codegen --typecheck
  disable` (exit 0) fuera de esta sesión —sin `convex dev`, sin `finishPush` y sin
  deploy— y el artifact incorporó los dos módulos que faltaban. El gate quedó
  **7/7 en verde** y la suite completa en **1493/1493**. Contra `52836ad`,
  `api.d.ts` suma +26 líneas y pasa de 58 a 71 entradas en `fullApi`: 11 módulos
  venían del codegen de la certificación del 16/08 (las "+22 de codegen"
  documentadas más arriba) y **2** los agregó esta corrida. Las afirmaciones
  falsas quedaron corregidas en `convex/CHANGELOG.md`, `src/services/chartsApi.ts`,
  `design-qa.md` y el README del audit.
- **Pruebas nuevas (+28, de 1465 a 1493).** Cinco interleavings de la corrida sin
  carta y dos de identidad natal en `natalRecoveryBackendV492`; cuatro del
  controlador en `cartaRecuperacionV492`; ocho del ciclo de vida de la cola en
  `refreshQueueV492`; tres de versión de caché en
  `natalInterpretationRevisionV492`; y seis del gate nuevo. El harness del backend
  despacha las queries internas por su NOMBRE canónico, así que corre el cuerpo
  real de la relectura contra la base en memoria.
  **Verificadas en las dos direcciones** (`logs10/verificacion-antes-despues.md`):
  los diez arreglos revertidos por separado hacen fallar su prueba focal —entre 1
  y 7 pruebas cada uno— y restaurados vuelven a pasar; el árbol queda byte por
  byte como estaba. **Tres tests existentes cambiaron de forma y ninguno se
  aflojó:** `personalityReading` y `natalInterpretationRevisionV492` resuelven
  contra la identidad completa; `cartaRecuperacionV492` separa las dos banderas
  igual que el hook separa los dos predicados; y `refreshQueueV492` **reescribe**
  el test de remontaje —antes exigía que B no arrancara mientras A siguiera viva—
  porque ésa es exactamente la semántica que este pase corrige. Ningún test se
  borró ni se saltó.
- **Checks del pase, estado FINAL (después del codegen de Codex):**
  `pnpm typecheck` PASS exit 0 · `pnpm test` **1493/1493** (93 suites, 0 fail,
  exit 0) · gate de `_generated` **7/7** exit 0 · piso de cobertura **1493/745**,
  0 fallos, exit 0 · `git diff --check` PASS en working tree e índice, y los 595
  untracked revisados con `--no-index` juzgando la SALIDA: 0 avisos (207 fuera de
  `.local/`: los 206 de la novena más el gate nuevo; el untracked de más es la
  ficha de este cierre dentro de `.local/`) · export web PASS con límites
  (32.10 MB / 50 · JS gzip 1005.8 KB / 1.25 MB · ficha completa) · export iOS PASS
  (7.0 MB) · export Android PASS (7.0 MB) · bundles nativos sin Tarot ni Diario,
  con los mismos tokens de la novena presentes 1 vez en cada plataforma.
  Evidencia final en `logs10/*-post-codegen.log`; los logs previos del mismo
  directorio conservan el estado INTERMEDIO —typecheck PASS, suite 1492 + 1 fallo
  deliberado del gate, focales de Carta 154/154, de tránsitos/caché 67/67, de la
  cola 64/64 y de bindings 71 + 1 fallo— tal como estaba antes del codegen.
- **Qué NO cambió el veredicto.** No se abrió un simulador, no se recapturó un
  solo PNG, no se desplegó nada y no se tocaron datos QA, suscripciones ni
  credenciales. `04` y `06` siguen **BLOCKED**, `02` sin recapturar, `08` y `09`
  PASS en código con la evidencia pendiente de deploy, D7 funcional PASS / visual
  N/A y VoiceOver BLOCKED por el runtime —evidencia heredada de la tercera
  pasada—. Las carreras que este pase cierra **no se pudieron ejercitar en
  runtime**: exigen desplegar Convex y una cuenta con esas filas.
- **Archivos del pase: 13 de código/pruebas + 1 de contrato + 3 documentos = 17.**
  Backend: `convex/charts.ts` · `convex/lib/natalRevision.ts`. Contrato:
  `convex/CHANGELOG.md` (**sin cambios de schema**). Frontend:
  `src/domain/refreshQueue.ts` · `src/domain/natalChartRecovery.ts` ·
  `src/hooks/useNatalChartRecovery.ts` · `src/hooks/useLayers.tsx` ·
  `src/services/chartsApi.ts` (sólo el comentario de cabecera). Tests:
  `test/convexGeneratedApiGate.test.ts` (**nuevo**) ·
  `test/natalRecoveryBackendV492.test.ts` · `test/refreshQueueV492.test.ts` ·
  `test/cartaRecuperacionV492.test.ts` ·
  `test/natalInterpretationRevisionV492.test.ts` ·
  `test/personalityReading.test.ts`. Documentos: `CURRENT_TASK.md` ·
  `design-qa.md` · el README del audit. Herramientas del pase dentro del audit:
  `tools/run-exports10.sh` · `tools/verify-reverts10.mjs`. `git status` suma una
  entrada nueva sin seguimiento fuera de `.local/`
  (`test/convexGeneratedApiGate.test.ts`). El cierre posterior al codegen tocó
  además `convex/_generated/api.d.ts` —**regenerado por Codex**, no editado a
  mano— y `convex/CHANGELOG.md`, `CURRENT_TASK.md`, `design-qa.md`,
  `src/services/chartsApi.ts`, el docblock de `test/convexGeneratedApiGate.test.ts`
  y el README del audit, sólo para cambiar el estado del gate. **Ninguna línea de
  lógica ni de aserción cambió**, y la suite se volvió a correr después del
  retoque del comentario: 1493/1493.
  `dist-ios/` y `dist-android/`, creados para la auditoría de bundle, se
  borraron con targets exactos las **dos** veces que se generaron —la del pase y
  la de los exports posteriores al codegen—, validando antes que fueran
  directorios reales, no symlinks, dentro del worktree y sin seguimiento de git.
  `dist/` se conserva: preexistía y es la salida canónica del export web. No se
  corrió `git clean`.
- **Handoff a Codex — CUMPLIDO.** Codex corrió
  `pnpm convex:codegen --typecheck disable` (exit 0), sin `convex dev`, sin
  `finishPush` y sin deploy, y regeneró los exports. La reverificación posterior
  dio gate 7/7, typecheck exit 0, suite 1493/1493 y piso 1493/745. **No queda
  ningún comando pendiente de este pase.**

**Noveno pase (2026-08-17, concurrencia monotónica, bindings generados y ciclo
de refresh cancelable) — seis P1 y dos P2 cerrados en código; el veredicto visual
de los 12 estados NO cambia.**

El octavo pase cerró con 1423/1423 y exports en verde, pero **tres auditorías
independientes** reprodujeron carreras reales que esa suite no cubría. Los ocho
hallazgos son de CONCURRENCIA, y por eso pasaban: ninguna prueba controlaba el
orden real de resolución. Todas las pruebas nuevas de este pase mantienen la
operación EN VUELO —el proveedor suspendido, la action colgada, el backoff
dormido— y deciden cuándo y en qué orden termina cada cosa.

- **P1-A · la carta natal podía EMPEORAR por una corrida atrasada.**
  `runNatalChartCalculation` toma un snapshot A antes de llamar al proveedor, y
  `persistCalculatedNatalChart` volvía a leer la fila por `cacheKey` pero la
  parcheaba **a ciegas** con `args.payload`. Dos corridas que arrancan de la misma
  carta A incompleta terminan en cualquier orden: la atrasada traía A vieja —o una
  respuesta C que tampoco alcanzaba— y la escribía encima de la B completa ya
  publicada; `profileAstrologyCaches` se iba con ella.
  **El arreglo:** la decisión final es **monotónica** y vive DENTRO de la
  transacción (`resolveNatalPersistDecision`, tabla pura de cuatro reglas, medida
  con `storedNatalChartIsSufficient` y la precisión natal vigente): sin fila se
  inserta el candidato aunque sea parcial; una fila **suficiente** se conserva
  intacta pase lo que pase —tampoco la reemplaza otra completa atrasada del mismo
  `cacheKey`—; una fila insuficiente sólo se reemplaza por algo que sí alcanza.
  Cuando gana la fila que ya estaba, se reafirma su vigencia y **nada más**: no se
  relabela su `providerVersion` con la del candidato descartado.
  `profileAstrologyCaches` copia y referencia el payload **realmente elegido**. Y
  al volver de la mutación se **vuelve a medir la carta final**
  (`resolveFinalNatalOutcome`): si otra corrida ganó con una carta que alcanza, el
  desenlace es éxito almacenado (`cache_sufficient` ⇒ `recovered`/`stored`) y no
  un fallo falso. El cuerpo de la mutación se exporta como
  `applyCalculatedNatalChart` para poder correrlo contra una base en memoria con
  el orden bajo control.
  **Y la identidad se revalida dentro de la transacción:** `birthDataId`,
  `birthDataHash` y `cacheKey` contra los datos vigentes. Si cambiaron durante la
  llamada al proveedor, se rechaza con
  `NATAL_BIRTH_DATA_CHANGED_DURING_CALCULATION` en vez de publicar la carta de
  datos que ya no existen. Es un rechazo estable y compatible: las dos actions ya
  podían rechazar, el `returns` de `recoverNatalChart` no crece, y la pantalla lo
  trata como cualquier otro fallo, con el reintento sobre los datos nuevos.
  **Los contratos públicos quedan intactos.**
- **P1-B · `recoverNatalChart` usaba una firma manual prohibida.** La action está
  cerrada y ya aparece en `convex/_generated/api.d.ts`, pero `appRefs` la enlazaba
  con `anyApi` y repetía su `returns` a mano: un cambio del contrato del backend
  habría seguido compilando y el error habría aparecido en runtime.
  **El arreglo:** sale de `appRefs` y entra en `src/services/chartsApi.ts`
  (**nuevo**), que reexporta `api.charts.recoverNatalChart` del generado, con el
  mismo criterio que `layersApi.ts` y `relationshipsApi.ts`. Sin
  `FunctionReference` a mano, sin `anyApi`, sin `any`, sin casts. El gate
  (`test/chartsBindingsV492.test.ts`) falla si la action aparece bajo `anyApi` o
  casteada en cualquier archivo de `src/` o `app/`, comprueba por el **grafo real**
  que las dos rutas de Carta llegan al servicio, y ata el contrato con
  comprobaciones de TIPOS derivadas del generado: un cambio del `returns` rompe
  `pnpm typecheck`. Las superficies legacy de `appRefs` **no** se migran acá.
- **P1-C · un refresh colgado dejaba la recuperación bloqueada tras desmontar.**
  `requestAndWait` movía sus waiters activos fuera del arreglo global antes del
  `await`, y el cleanup de `useLayers` sólo ponía `mounted = false`: si la action
  no resolvía y el árbol se desmontaba, la promesa no terminaba nunca, el gate
  natal quedaba tomado y `CALCULANDO…` no se desbloqueaba **ni volviendo a
  montar**.
  **El arreglo:** la cola tiene ciclo de vida explícito. `suspend()` —lo llama el
  cleanup— corta TODAS las esperas, las de la corrida en vuelo y las que esperaban
  turno, con `LAYERS_REFRESH_UNAVAILABLE`. No se cancela la action (una action
  Convex que ya salió no se puede cancelar): lo que se corta es su **efecto**, con
  una generación de ciclo, así que su completion tardía no publica flags ni
  resuelve waiters del ciclo nuevo. Lo pendiente sobrevive y `resume()` lo retoma
  sin waiters huérfanos y sin abrir una segunda acción. **Sin este arreglo la
  prueba no falla: se cuelga**, y el verificador lo informa así.
- **P1-D · la solicitud nueva heredaba la espera y los retries de la vieja.** El
  contador era global a la cola: si A gastaba el presupuesto y B llegaba durante
  su backoff, B esperaba el resto y su primer fallo contaba como intento 4.
  **El arreglo:** el intento pertenece al TRABAJO (identidad de la solicitud, no
  contenido) y el backoff es **despertable** —`encolar` dispara la señal—, así que
  una solicitud más nueva interrumpe la espera, corre enseguida después de la
  action vigente y arranca con su crédito entero. "La más reciente gana" no
  cambia; los waiters de la abandonada se transfieren al trabajo vigente y
  terminan exactamente una vez. Single-flight intacto.
- **P1-E · una completion natal vieja podía arrancar refresh en el scope nuevo.**
  El controlador llamaba `recalcularCapas` de forma incondicional y lo que recibía
  era el `refreshAndWait` **global**.
  **El arreglo:** `NatalRecoveryDeps` exige `vigente()` —montado + mismo alcance +
  salida todavía `reintentar`, tres refs vivas del hook— y el controlador la
  consulta antes de tocar el ciclo de capas. Si dejó de ser vigente, libera el
  gate del store viejo en estado **neutro** y no llama al refresco global. Un
  error tardío que ya no describe nada tampoco se guarda: dejarlo pegado lo haría
  reaparecer si ese hash volviera a ser recuperable. El flujo estable de una misma
  carta no cambia: calcular → refresco esperado → quieto.
- **P1-F · una mejora de carta podía dejar o reescribir una interpretación LLM
  obsoleta.** Una mejora reescribe el payload sobre el MISMO `natalChartId`, y
  `natalInterpretations` se identificaba sólo por carta + feature +
  `promptVersion`.
  **El arreglo:** `convex/lib/natalRevision.ts` (**nuevo**) deriva `chartRevision`
  del payload con `stableInputHash` —la identidad del PAYLOAD, no la de la fila—.
  Claim, lectura pública y persistencia se resuelven contra la revisión vigente:
  una fila `ready` sólo es cache hit si coincide, y una de otra revisión no
  publica, no frena una generación nueva y se declara `pending` (no `error`),
  porque lo que corresponde es regenerarla. La escritura final es un **CAS**
  (`resolveNatalReadingWrite`): la carta tiene que seguir en esa revisión y la
  generación tiene que seguir siendo dueña del `claimSeq` monótono. Una generación
  vieja no escribe después de una mejora ni después de que otro claim la
  reemplazó, **ni siquiera para marcar `error`**. Las filas legadas sin revisión se
  tratan como no verificadas y se regeneran. **Schema aditivo:** `chartRevision` y
  `claimSeq`, los dos `v.optional()`; ninguna firma pública cambia y el borrado de
  cuenta ya cubre la tabla por `by_user`.
- **P2-A · el registro podía desalojar un store todavía montado.** El límite de
  ocho sólo protegía `ocupado()`: un store idle con suscriptor vivo podía ser
  desalojado y un segundo `storeFor` creaba otro candado para el mismo alcance.
  **El arreglo:** la retención es explícita y verificable —`subscribe()` retiene,
  su función de baja libera, `observadores()` los cuenta—; no se desaloja un store
  ocupado NI observado; y al desuscribirse vuelve a ser desalojable, así que la
  memoria no crece sin límite. No se supone nada sobre cuándo React termina con un
  componente: se pregunta.
- **P2-B · documentación que mezclaba pasadas.** `design-qa.md` tenía la tabla de
  checks de la SÉPTIMA marcada como vigente (`logs7/`, 1385 pruebas): ahora la
  vigente es la de la novena (`logs9/`, 1465) y se dice que las anteriores quedan
  como historia. La fila **D18** decía que el controlador llama a
  `calculateOrCreateNatalChart`: desde la octava llama a `charts.recoverNatalChart`
  y encadena el **refresh esperable** (`useLayers().refreshAndWait`); corregido. La
  nota de VoiceOver ahora incluye la novena entre las pasadas que no abrieron
  simulador. Bloque de NOVENA pasada en el README del audit, en `design-qa.md`
  (D25–D32) y acá. No se borró historia.
- **Pruebas nuevas (+42, de 1423 a 1465).** Doce en
  `test/natalInterpretationRevisionV492.test.ts` (**nuevo**) y cinco en
  `test/chartsBindingsV492.test.ts` (**nuevo**); nueve más en
  `test/refreshQueueV492.test.ts`, ocho en `test/cartaRecuperacionV492.test.ts` y
  ocho en `test/natalRecoveryBackendV492.test.ts`. Helper nuevo:
  `test/convexMemoryDb.ts`, una base Convex mínima en memoria (`insert`, `get`,
  `patch`, `query().withIndex()`) que permite correr las mutaciones REALES con el
  orden de resolución bajo control; los documentos se clonan al entrar y al salir.
  **Verificadas en las dos direcciones:** los **diez** arreglos revertidos por
  separado, nueve hacen fallar su prueba focal y uno —el ciclo de vida de la
  cola— la deja **colgada**, que es el defecto exacto; restaurados, todos vuelven
  a pasar (`logs9/verificacion-antes-despues.md`), y el árbol quedó byte por byte
  como estaba. **Tres tests existentes cambiaron de forma y ninguno se aflojó:**
  `personalityReading` (los tres resolvers reciben la revisión vigente, se
  conservan todos los casos y se agregan los de revisión), `onboardingCompletion`
  (los anclajes apuntan a la forma nueva del cuerpo compartido, más la exigencia de
  que el desenlace se vuelva a medir después de persistir) y los harnesses de
  `cartaRecuperacionV492` y `natalRecoveryBackendV492`, que pasan a controlar el
  orden de resolución y a correr la mutación real. Ningún test se borró ni se saltó.
- **Checks del pase:** `pnpm typecheck` PASS exit 0 · `pnpm test` PASS
  **1465/1465** (93 suites, 0 fail) · piso 1465/745 · focales de Carta y
  recuperación 140/140, de tránsitos/caché 67/67, de la cola 57/57 y de bindings y
  contrato 65/65 · `git diff --check` PASS en working tree e índice, y los 589
  untracked revisados con `--no-index` juzgando la SALIDA —no el código de
  salida—: 0 avisos (206 fuera de `.local/`: los 201 de la octava más los cinco
  archivos nuevos de ésta) · export web PASS con límites (32.10 MB / 50 · JS gzip
  1005.8 KB / 1.25 MB · ficha completa) · export iOS PASS (7.0 MB) · export
  Android PASS (7.0 MB) · bundles nativos sin Tarot ni Diario, con
  `recoverNatalChart` (ya por el binding generado), `calculateOrCreateNatalChart`,
  `createRefreshQueue`, `refreshAndWait`, `LAYERS_REFRESH_UNAVAILABLE`,
  `active_transit_arc` y `matching_transit_arc` presentes 1 vez en cada
  plataforma; las 3 apariciones de `diario` siguen siendo dos cadenas de ruta y el
  rótulo `CAMBIA A DIARIO`. Evidencia en `logs9/`.
- **Qué NO cambió el veredicto.** No se abrió un simulador, no se recapturó un
  solo PNG, no se desplegó nada y no se tocaron datos QA, suscripciones ni
  credenciales. `04` y `06` siguen **BLOCKED**, `02` sin recapturar, `08` y `09`
  PASS en código con la evidencia pendiente de deploy, D7 funcional PASS / visual
  N/A y VoiceOver BLOCKED por el runtime —evidencia heredada de la tercera
  pasada—. Las carreras que este pase cierra **no se pudieron ejercitar en
  runtime**: exigen desplegar Convex y una cuenta con esas filas.
- **Archivos del pase: 16 de código/pruebas + 2 de contrato + 3 documentos = 21.**
  Backend: `convex/charts.ts` · `convex/lib/natalRevision.ts` (**nuevo**).
  Contrato: `convex/schema.ts` · `convex/CHANGELOG.md`. Frontend:
  `src/services/chartsApi.ts` (**nuevo**) · `src/services/appRefs.ts` ·
  `src/domain/refreshQueue.ts` · `src/domain/natalChartRecovery.ts` ·
  `src/hooks/useNatalChartRecovery.ts` · `src/hooks/useLayers.tsx`. Tests:
  `test/convexMemoryDb.ts` (**nuevo**, helper) ·
  `test/natalInterpretationRevisionV492.test.ts` (**nuevo**) ·
  `test/chartsBindingsV492.test.ts` (**nuevo**) ·
  `test/natalRecoveryBackendV492.test.ts` · `test/refreshQueueV492.test.ts` ·
  `test/cartaRecuperacionV492.test.ts` · `test/personalityReading.test.ts` ·
  `test/onboardingCompletion.test.ts`. Documentos: `CURRENT_TASK.md` ·
  `design-qa.md` · el README del audit. Herramientas del pase dentro del audit:
  `tools/run-exports9.sh` · `tools/verify-reverts9.mjs`. `git status` pasa de
  **168** a **174** entradas.

**Octavo pase (2026-08-17, recuperación natal honesta y cierre de caché
negativa) — dos P1 y tres P2 cerrados en código; el veredicto visual de los 12
estados NO cambia.**

Una auditoría independiente revisó el séptimo pase —que cerró con 1385/1385 en
verde— y encontró dos P1 y tres P2 reales. Los cinco están cerrados acá, con
pruebas que ejercitan la OPERACIÓN: contando llamadas al proveedor con el
proveedor inyectado, manteniendo una promesa de refresco en vuelo, y publicando
en un alcance mientras se mira otro.

- **P1-A · un proveedor fallido —o insuficiente— se presentaba como éxito.** La
  séptima pasada arregló *a quién llama* el botón; faltaba arreglar *qué se
  considera que salió bien*. `charts.calculateOrCreateNatalChart` vuelve al
  proveedor cuando la carta guardada no alcanza, y después declaraba éxito pasara
  lo que pasara: con el proveedor caído reafirmaba la carta parcial y resolvía con
  ella —y el controlador, que sólo entra en `fallo` ante un rechazo, dejaba la UI
  `quieto`, silenciando el intento—; con una respuesta `success` que seguía sin
  casas ni ejes la persistía **encima** de la anterior sin comprobar nada.
  **El arreglo:** `runNatalChartCalculation` (cuerpo compartido, proveedor
  inyectable) + `resolveNatalCalculationDecision` (tabla pura de ocho
  combinaciones). Con una carta guardada que no alcanza, sólo se escribe algo
  nuevo si ese algo **sí** alcanza, medido con `storedNatalChartIsSufficient`, la
  misma regla que usa el read-model. Sin carta guardada se persiste igual: algo es
  mejor que nada, pero el desenlace sigue diciendo la verdad.
  **La vía contractual elegida es aditiva:** `charts.recoverNatalChart` (`args: {}`
  y `returns` cerrados y discriminados: `recovered`/`stored`, `recovered`/`provider`,
  `failed`/`provider_failed`, `failed`/`still_incomplete`). Se eligió aditiva y no
  hacer rechazar a la de siempre porque el alta la espera de forma ESTRICTA
  (`useBackendPersistStrict`): hacerla rechazar podía bloquear un onboarding
  rehecho sobre una carta incompleta durante una caída del proveedor.
  `calculateOrCreateNatalChart` queda intacta en firma y en comportamiento visible
  para el alta, el editor de perfil y la Carta web. La pantalla muestra
  `No pudimos completar el cálculo ahora.` y `REINTENTAR` en los dos casos, con la
  carta parcial visible.
- **P1-B · el candado terminaba antes que el recálculo real.**
  `NatalRecoveryDeps.recalcularCapas` era `() => void`: `pedir()` lo invocaba sin
  `await`, publicaba `quieto` y soltaba el gate, así que un segundo toque podía
  volver a llamar la operación antes de que el refresco saliera.
  **El arreglo:** la cola del recálculo sale del hook a `src/domain/refreshQueue.ts`
  —misma política de single-flight, "la más reciente gana" y reintento automático
  de la carrera del alta, ahora probable sin React—, y `useLayers` expone
  **`refreshAndWait(): Promise<void>`** junto al `refresh(): void` de siempre, que
  no cambia. La vía esperable entra en la MISMA cola: si ya hay una corrida en
  vuelo espera a la pendiente más reciente y no abre ninguna acción paralela. El
  ciclo entero —recuperar la carta → `refreshForDate` real— corre bajo el mismo
  candado; si falla cualquiera de las dos mitades queda en `fallo`, con los datos
  visibles intactos y el reintento disponible. `CALCULANDO…`, `disabled` y la
  región viva cubren las dos mitades porque salen de la misma fase. Un detalle
  corregido al mover la cola: el reintento transitorio ya no pisa una solicitud
  más nueva que llegó mientras corría.
- **P2-A · el fallo global se pegaba entre cartas y cuentas.** El store era un
  singleton de módulo sin alcance ni reset. Ahora hay **un store por
  `userId + chart.inputHash`**, con un valor estable para los huecos
  (`sin-cuenta`, `sin-carta`): el hub y la Carta completa de la misma carta
  comparten store y candado; otra cuenta u otra carta empiezan `quieto`; una
  completion vieja publica en el alcance que la pidió y no puede tocar el nuevo; y
  cuando `recovery` deja de ser `reintentar` el fallo se da por visto
  (`olvidarFallo`, que no toca un trabajo en vuelo). La limpieza suelta los
  alcances menos usados y **nunca** uno ocupado.
- **P2-B · caché negativa vieja con ranking vacío.** `transitArcCoherence`
  devolvía `coherente` apenas veía `arc.data === null`, antes de mirar el ranking:
  un sobre negativo cacheado con `matching_transit_arc` convivía con un
  `items: []` nuevo, y ese copy falso duraba hasta `validUntil` —o para siempre si
  era `null`—. Ahora la lista se mira siempre: sin `data` el arco se conserva tal
  cual; con `items: []` se normaliza a `active_transit_arc` y el código contrario
  se descarta; con un primer ítem y sin arco correspondiente, `matching_transit_arc`.
  Los demás faltantes del sobre sin dato se conservan, y un sobre que ya declara
  exactamente ese hecho no se reescribe. Método, `inputHash`, alcance, `status`,
  `stale` y `validUntil` quedan compatibles y nunca se relabela el arco de otro
  contacto. **Copy:** la limitación decía *"el que estaba guardado es de otro
  día"* —puede ser de otra hora del mismo día— y ahora dice *"ya no corresponde a
  la lista actual"*, sólo cuando de verdad había un arco con dato que retirar.
- **P2-C · documentación contradictoria.** El README del audit decía *"seis
  pasadas"* cuando ya iban siete (ahora dice siete antes de ésta, y ocho en
  total); su título *"Archivos tocados … (14)"* excluía los documentos (ahora
  desglosa la cifra exacta); y `design-qa.md` afirmaba que VoiceOver fue
  *"reverificado en esta pasada"* cuando la séptima no abrió simulador (ahora dice
  que la evidencia vigente se hereda de la tercera y que el bloqueo exige un
  iPhone físico).
- **Pruebas nuevas (+38, de 1385 a 1423).** Once en
  `test/natalRecoveryBackendV492.test.ts` (**nuevo**): el cuerpo real del cálculo
  natal con el proveedor inyectado y una base en memoria —cache incompleto +
  proveedor caído, cache incompleto + respuesta insuficiente, cache incompleto +
  respuesta completa, cache completo con cero llamadas al proveedor,
  `unknown`/`approximate` sin exigir geometría, y la tabla de decisión entera—.
  Trece en `test/refreshQueueV492.test.ts` (**nuevo**): single-flight real,
  `requestAndWait` que no resuelve al encolar, espera a la pendiente más reciente,
  rechazo con reintento, carrera del alta reintentada sin soltar a quien espera, y
  desmonte —incluido el corte de una espera que el desmonte deja sin atender, para
  que el candado de quien esperaba no quede tomado para siempre—. Siete en `test/cartaRecuperacionV492.test.ts`: refresco mantenido en
  vuelo, segundo toque bloqueado, refresco rechazado, respuesta que no mejora, y
  los cuatro casos de alcance. Tres en `test/transitArcDetailV492.test.ts`,
  incluido el que faltaba: ranking vacío + arco `data:null` cacheado con
  `matching_transit_arc` → `active_transit_arc`, sin el otro código y con el copy
  cotidiano correcto. **Verificadas en las dos direcciones:** revirtiendo cada
  arreglo por separado, su prueba focal falla y con el arreglo restaurado vuelve a
  pasar (`logs8/verificacion-antes-despues.md`). **Cuatro tests existentes
  cambiaron de forma y ninguno se aflojó:** `v492ReleaseP1` y `nativeDefectsV492`
  (D5) pasaron de mirar la fuente a ejercitar el comportamiento de la cola;
  `natalChartBase` y `onboardingCompletion` reapuntaron sus anclajes al cuerpo
  compartido, sumando la exigencia de que las dos actions públicas sigan sin
  argumentos y de que la del alta siga devolviendo una carta o un rechazo. Ningún
  test se borró ni se saltó.
- **Checks del pase:** `pnpm typecheck` PASS exit 0 · `pnpm test` PASS
  **1423/1423** (93 suites, 0 fail) · piso 1423/745 · focales de Carta 103/103, de
  tránsitos/caché 67/67 y de la cola 48/48 · `git diff --check` PASS, y los 580
  untracked revisados con `--no-index` juzgando la SALIDA —no el código de salida—:
  0 avisos (201 fuera de `.local/`: los 198 de la séptima pasada más los tres
  archivos nuevos de ésta) · export web
  PASS con límites (32.10 MB / 50 · JS gzip 1005.5 KB / 1.25 MB) · export iOS PASS
  (7.0 MB) · export Android PASS (7.0 MB) · bundles nativos sin Tarot ni Diario,
  con `recoverNatalChart`, `refreshAndWait`, `createRefreshQueue`,
  `calculateOrCreateNatalChart`, `active_transit_arc` y `matching_transit_arc`
  presentes 1 vez en cada uno. Evidencia en `logs8/`.
  **Detalle de método:** Hermes guarda en UTF-16LE cualquier literal con un
  caracter no ASCII, así que un `grep` de bytes no encontraba
  `No pudimos completar el cálculo ahora` ni `CALCULANDO…`; el script los cuenta
  ahora en las dos codificaciones y dan 1.
- **Qué NO cambió el veredicto.** No se abrió un simulador, no se recapturó un
  solo PNG, no se desplegó nada y no se tocaron datos QA, suscripciones ni
  credenciales. `04` y `06` siguen **BLOCKED**, `02` sin recapturar, `08` y `09`
  PASS en código con la evidencia pendiente de deploy, D7 funcional PASS / visual
  N/A y VoiceOver BLOCKED por el runtime —su evidencia vigente se hereda de la
  tercera pasada—. El camino real de recuperación —tocar el botón contra un
  backend con una carta incompleta y contra un proveedor caído— **sigue sin poder
  ejercitarse en runtime**: exige desplegar `charts.recoverNatalChart` y una
  cuenta con esa fila.
- **Archivos del pase: 17 de código/pruebas + 1 de contrato + 3 documentos = 21.**
  Backend: `convex/charts.ts` · `convex/layers.ts`. Contrato:
  `convex/CHANGELOG.md`. Frontend: `src/domain/refreshQueue.ts` (**nuevo**) ·
  `src/domain/natalChartRecovery.ts` · `src/hooks/useLayers.tsx` ·
  `src/hooks/useNatalChartRecovery.ts` · `src/services/appRefs.ts` ·
  `src/screens/v492/CartaHubScreen.tsx` ·
  `src/screens/v492/CartaCompletaV492Screen.tsx`. Tests:
  `test/refreshQueueV492.test.ts` (**nuevo**) ·
  `test/natalRecoveryBackendV492.test.ts` (**nuevo**) ·
  `test/cartaRecuperacionV492.test.ts` · `test/transitArcDetailV492.test.ts` ·
  `test/natalChartBase.test.ts` · `test/nativeDefectsV492.test.ts` ·
  `test/v492ReleaseP1.test.ts` · `test/onboardingCompletion.test.ts`. Documentos:
  `CURRENT_TASK.md` · `design-qa.md` · el README del audit. Herramientas del pase
  dentro del audit: `tools/run-exports8.sh` · `tools/verify-reverts8.mjs`.

**Séptimo pase (2026-08-17, recuperación natal real y motivo del ranking vacío) —
un P1 funcional y un P2 de copy cerrados en código; el veredicto visual de los 12
estados NO cambia.**

Una auditoría independiente revisó el sexto pase y encontró que la Carta ofrecía
una salida que no podía llevar a ningún lado.

- **P1 · el CTA de recuperación de Carta llamaba a la acción equivocada.**
  `natalChartState` declaraba bien `recovery: "reintentar"` cuando hay posiciones
  canónicas y falta geometría (`verified_ascendant_mc_geometry`,
  `verified_twelve_house_geometry`), pero las dos pantallas cableaban esa salida a
  `useLayers().refresh`, que ejecuta `layers.refreshForDate` y **nada más**. La
  geometría —Ascendente, Medio Cielo y las doce cúspides— no sale de ahí: sale de
  la carta persistida en `natalCharts`, y la única operación que la escribe es
  `charts.calculateOrCreateNatalChart`. "COMPROBAR DE NUEVO" repetía el cálculo de
  capas indefinidamente sin generar nunca lo que la propia pantalla decía que
  faltaba. Ahora hay **un solo controlador compartido**:
  `src/domain/natalChartRecovery.ts` (store puro sobre `createExclusiveGate`, sin
  React ni Convex) y `src/hooks/useNatalChartRecovery.ts` (store **de módulo**, uno
  para toda la app, porque el hub y la carta completa conviven en la pila). Hace
  dos cosas y siempre en este orden: `charts.calculateOrCreateNatalChart({})` y
  después el recálculo del día —al revés, `layers.persistRefresh` rechazaría con
  `LAYER_INPUT_CHANGED_DURING_REFRESH` un refresco salido antes de que la carta
  cambiara—. El read-model es reactivo, así que las dos pantallas ven el resultado
  solas; el sobre del día no lo es, y por eso se encadena. El controlador **exige
  la salida declarada** y sólo calcula con `reintentar`: con `completar-hora` no
  llama a nada y no anuncia ningún cálculo. Un fallo se dice en región viva, deja
  la carta parcial visible y permite reintentar; en curso, el botón queda bloqueado
  con `CALCULANDO…`. `access.positions` sigue sin ser entitlement y Plus se sigue
  preguntando por superficie.
- **Borde cerrado en `convex/charts.ts`.** El `cacheKey` de `natalCharts` se arma
  con los DATOS natales: dice "esta carta se calculó con estos datos", no "el
  cálculo llegó hasta donde estos datos permiten". Una corrida en la que el
  proveedor no devolvió `houses` —y por lo tanto tampoco Ascendente— dejaba una
  fila que la Carta declara `partial` y que la action reutilizaba para siempre. La
  action ahora mide la **suficiencia** del payload con la misma regla de geometría
  que usa `layers.ts` (`convex/lib/natalGeometry.ts`, extraído de allí para que las
  dos preguntas no puedan discrepar); si con hora exacta falta geometría, vuelve al
  proveedor. Sin hora exacta no hay geometría que exigir y el cache sano se
  reutiliza igual que antes. **No se agregó ningún `force` público**, y si el
  proveedor tampoco puede mejorarla se conserva la carta que ya había en vez de
  dejar la cuenta sin ninguna.
- **P2 · el ranking vacío retiraba el arco con el motivo equivocado.**
  `coherentTransitArc` publicaba siempre `matching_transit_arc` —"todavía no está
  calculado el arco del tránsito que hoy encabeza tu lista"—, y con `items: []` la
  propia lista ya afirmó que no hay tal tránsito. Ahora la coherencia devuelve el
  MOTIVO: lista vacía → `active_transit_arc` ("Hoy no hay ningún tránsito mayor
  activo para formar un arco"), primer ítem que no es el del arco →
  `matching_transit_arc`, ranking sin `data` → el arco se conserva. `active_transit_arc`
  es el código canónico que ya usaba `layerAssembly` y que ya tenía traducción
  visible: no se inventó ninguno y el código interno no se expone.
- **Pruebas nuevas (+16, de 1369 a 1385).** Nueve en
  `test/cartaRecuperacionV492.test.ts` —controlador real con dependencias
  instrumentadas: dos entradas del mismo tick con una sola action, candado
  sincrónico, encadenamiento en orden, store compartido entre dos suscriptores,
  fallo con parcial visible y reintento que vuelve a ejecutar, `completar-hora` sin
  action, cableado por el grafo de módulos desde las dos rutas, y bloqueo/voz/región
  viva—. Cinco en `test/natalChartBase.test.ts` para la suficiencia del cache,
  atadas al mismo payload que el read-model. Dos en
  `test/transitArcDetailV492.test.ts` para el ranking sin dato y el mensaje visible
  del arco ajeno. **Verificadas en las dos direcciones:** revirtiendo cada arreglo
  por separado, el test correspondiente falla y sólo ése
  (`logs7/verificacion-antes-despues.md`). **Un test existente cambió de
  expectativa** —el que afirmaba `matching_transit_arc` para el ranking vacío: esa
  afirmación era el defecto—, y dos estructurales se ajustaron a la forma nueva sin
  aflojar su intención (`test/cartaV492.test.ts`, `test/onboardingCompletion.test.ts`).
  Ningún test se borró ni se saltó.
- **Checks del pase:** `pnpm typecheck` PASS exit 0 · `pnpm test` PASS
  **1385/1385** (93 suites, 0 fail) · piso 1385/745 · focales de Carta 73/73 y de
  tránsitos/caché 64/64 · `git diff --check` PASS, y los 198 untracked revisados
  además con `--no-index` (un aviso heredado en `convex/lib/stableHash.ts`,
  corregido) · export web PASS con límites (32.10 MB / 50 · JS gzip 1005.2 KB /
  1.25 MB) · export iOS PASS (7.0 MB) · export Android PASS (7.0 MB) · bundles
  nativos sin Tarot ni Diario, con `calculateOrCreateNatalChart` y
  `active_transit_arc` presentes 1 vez en cada uno. Evidencia en `logs7/`.
- **Qué NO cambió el veredicto.** No se abrió un simulador, no se recapturó un solo
  PNG, no se desplegó nada y no se tocaron datos QA, suscripciones ni credenciales.
  `04` y `06` siguen **BLOCKED**, `02` sin recapturar, `08` y `09` PASS en código
  con la evidencia pendiente de deploy, D7 funcional PASS / visual N/A y VoiceOver
  BLOCKED por el runtime. El camino real de recuperación —tocar el botón contra un
  backend con una carta incompleta— **no se pudo ejercitar en runtime**: exige
  desplegar y una cuenta con esa fila.
- **Archivos del pase (9 de código + docs).** Backend: `convex/lib/natalGeometry.ts`
  (nuevo) · `convex/layers.ts` · `convex/charts.ts` · `convex/CHANGELOG.md`.
  Frontend: `src/domain/natalChartRecovery.ts` (nuevo) ·
  `src/hooks/useNatalChartRecovery.ts` (nuevo) · `src/screens/v492/CartaHubScreen.tsx` ·
  `src/screens/v492/CartaCompletaV492Screen.tsx`. Higiene:
  `convex/lib/stableHash.ts`. Tests: `test/cartaRecuperacionV492.test.ts` (nuevo) ·
  `test/natalChartBase.test.ts` · `test/transitArcDetailV492.test.ts` ·
  `test/cartaV492.test.ts` · `test/onboardingCompletion.test.ts`.

**Sexto pase (2026-08-17, coherencia del par cacheado y dos bordes de Carta) —
un P1 y dos P2 cerrados en código; el veredicto visual de los 12 estados NO
cambia.**

Una auditoría independiente revisó el quinto pase y encontró que el arreglo de
identidad cubría el **cálculo**, no la **lectura**.

- **P1 · el ranking y el arco CACHEADOS podían divergir.** Quedaban dos caminos
  que rescatan los dos sobres por separado sin mirar si se corresponden:
  `layers.getForDate` —lectura pura— y `layers.refreshForDate` cuando no hay
  efeméride. Una fila escrita **antes** del quinto pase —o por otra ventana lógica
  del día— podía combinar un ranking cuyo `items[0]` es A con un arco que describe
  B, y en modo caché u offline ese par podía durar **indefinidamente**. Ahora un
  helper puro (`transitArcMatchesRanking`) y su componedor (`coherentTransitArc`)
  se aplican en **todo camino que arma el bundle**, y exigen el `arcId` **y** la
  tupla —planeta en tránsito, punto natal, aspecto—: sólo el `arcId` dejaría pasar
  dos identidades iguales sobre contactos distintos, y sólo la tupla dejaría pasar
  el mismo contacto con un identificador que la lista de al lado no reconoce. Si no
  corresponden, el arco **se descarta** —nunca se relabela `ORB-TRN-002` ni se
  mezcla el arco de otro contacto— y va un `ORB-TRN-001` honesto sin dato, con el
  faltante nuevo `matching_transit_arc` y su limitación; **nunca `stale`**, porque
  no existe fila correspondiente que mostrar. En `refreshForDate` ese sobre
  **reemplaza** la fila incoherente, así que el defecto no sobrevive al refresh. Un
  ranking **sin dato** no afirma nada y no descarta ningún arco; uno **con la lista
  vacía** sí afirma que hoy no encabeza ningún contacto, y ahí ningún arco con dato
  se publica. Ninguna firma cambió.
- **P2 · `refreshFailed` volvía reintentable la carta limitada sólo por la hora.**
  `natalChartState` hacía `refreshFailed || …`: con el refresco del día fallado y
  `exact_birth_time` como único faltante, la salida pasaba de `completar-hora` a
  `reintentar`. Lo que falló fue traer el cielo de HOY, y el cielo de hoy no tiene
  nada que ver con la hora a la que naciste. Ahora ese fallo no participa de la
  decisión; un parcial que ya tenía cálculo pendiente sigue siendo reintentable.
  **Corrige una afirmación del quinto pase**, que declaraba lo contrario.
- **P2 · Carta completa descartaba la salida del estado.** `CartaCompletaLive`
  resolvía `estado` y al pasar al contenido se quedaba sólo con `chart` y
  `timezone`: un parcial con los ejes o las casas pendientes no ofrecía nada. El
  estado viaja ahora al contenido y las dos pantallas de Carta ofrecen la misma
  salida con el mismo texto y la misma voz —`FALTA UNA PARTE DEL CÁLCULO` +
  *"Comprobar de nuevo si el cálculo ya publicó lo que falta"*—; cálculo en curso
  espera sin botón, listo no ofrece ningún CTA, y el botón se anuncia bloqueado
  mientras hay una corrida en vuelo. **No se agregó ningún muro de Plus por
  disponibilidad de efeméride:** `access.positions` sigue siendo snapshot y el
  límite de plan se pregunta por superficie.
- **Pruebas nuevas (+8, de 1361 a 1369).** Cinco en `test/transitArcDetailV492.test.ts`
  para la coherencia del par —lectura pura, rescate sin efeméride, `arcId` y tupla
  por separado, ranking vacío, y el par coherente que SÍ se sigue reutilizando— y
  tres en `test/cartaV492.test.ts` para los dos bordes de Carta. **Todas
  verificadas en las dos direcciones:** se restauró a mano el comportamiento
  anterior y las nuevas fallaron (`logs6/coherencia-par-antes-despues.md`). **Un
  test existente cambió de expectativa** —el que afirmaba que `refreshFailed` deja
  reintentable un parcial cuyo único faltante es la hora—: esa afirmación era el
  defecto, se invirtió con su motivo escrito en el propio test, y la parte que
  seguía siendo cierta se conservó como caso propio. Ningún otro test se debilitó.
- **Checks del pase:** `pnpm typecheck` PASS exit 0 · `pnpm test` PASS
  **1369/1369** (93 suites, 0 fail) · piso 1369/745 · `git diff --check` PASS ·
  export web PASS con límites (32.10 MB / 50 · JS gzip 1005.2 KB / 1.25 MB) ·
  export iOS PASS (7.0 MB) · export Android PASS (7.0 MB) · bundles nativos sin
  Tarot ni Diario (`tarot` 0; las 3 apariciones de `diario` son las mismas de
  siempre: dos cadenas de ruta que en nativo sólo redirigen y el rótulo de cadencia
  `CAMBIA A DIARIO`). Evidencia en `logs6/`.
- **Qué NO cambió el veredicto.** No se abrió un simulador, no se recapturó un solo
  PNG, no se desplegó nada y no se tocaron datos QA, suscripciones ni
  credenciales. `04` y `06` siguen **BLOCKED**, `02` sin recapturar, `08` y `09`
  PASS en código con la evidencia pendiente de deploy, D7 funcional PASS / visual
  N/A y VoiceOver BLOCKED por el runtime. Las dos correcciones de Carta de este
  pase **tampoco** se declaran PASS visual: están verificadas por prueba, no por
  captura.
- **Archivos del pase (5 de código + docs).** Backend: `convex/layers.ts` ·
  `convex/CHANGELOG.md`. Frontend: `src/domain/layers.ts` ·
  `src/domain/natalChartState.ts` · `src/screens/v492/CartaCompletaV492Screen.tsx`.
  Tests ampliados: `test/transitArcDetailV492.test.ts` · `test/cartaV492.test.ts`.

**Quinto pase (2026-08-17, identidad del arco y estados de Carta) — tres defectos
cerrados en código; el veredicto visual de los 12 estados NO cambia.**

La auditoría reprodujo que `compare3/04` abrió el ranking **#1** —el arco
principal, el único que el bundle ya trae— y aun así cayó al fallback: el ranking
publicaba `arc_v1_0pa9p2w` para Saturno–Marte y la cronología verificada
`arc_v1_19nh0r0` para ese mismo contacto. El cuarto pase le había dado a cada arco
de la lista su propio `ORB-TRN-001`, pero la causa de fondo seguía abierta.

- **La identidad del arco dependía de cómo se había medido la ventana.**
  `convex/lib/transitTimeline.ts` sembraba `arcWindowKey` con
  `verified:<fecha de la ventana verificada>` y `convex/lib/transitLayers.ts`
  metía esa clave en la semilla del `arcId` con un prefijo propio. El ranking
  extrapola la ventana con la velocidad del día; el seguimiento la verifica contra
  efemérides reales: dos medidas del mismo proceso, dos identificadores. **Ahora la
  identidad V1 es carta + planeta en tránsito + aspecto + punto natal + ventana
  lógica**, la procedencia se descarta (`verified:2026-05-12` y `2026-05-12` son la
  misma ventana), y quien verifica pasadas **propaga** la ventana lógica que el
  contacto ya traía en vez de sembrar una nueva con sus bordes. Sólo un contacto
  sin ninguna ventana —un instante suelto— recibe la verificada, que es la medida
  más estable y no se mueve porque se observe otro día: esa garantía anterior
  (`test/transitTimeline.test.ts`) se conservó intacta. `refreshForDate` además le
  declara al contacto principal el `arcId` que publicó el ranking de esa corrida.
  **Las fechas no cambiaron:** el arco sigue mostrando la ventana verificada.
- **El cache viejo ya no se puede tomar por otro contacto.** El arco principal se
  reutiliza sólo si la fila guardada declara el `arcId` vigente **además** del
  mismo planeta, punto natal y aspecto. Una fila escrita con la identidad anterior
  se recalcula: la invalidación es explícita y por identidad, no por versión de
  tabla. Ninguna firma de función cambió; el soporte de arcos no principales del
  cuarto pase queda intacto.
- **Carta, hora exacta y eje todavía sin publicar.** El hub decía `Necesita tu
  hora` en la fila del Ascendente mientras VoiceOver decía —bien— que el cálculo
  no había publicado los ejes verificados: dos ramas para el mismo hecho, y la
  visible mandaba a corregir un dato que ya estaba bien. Ahora el estado del eje se
  resuelve una vez en el dominio (`angleRowView`) y de ahí salen el valor y la voz:
  `Calculando…` mientras falta el cálculo, `Necesita tu hora` sólo sin hora, signo
  y grado cuando está. La etiqueta accesible de la rueda pregunta lo mismo.
- **Reintentar sólo cuando reintentar resuelve algo.** `natalChartState` marcaba
  `canRetry: true` para CUALQUIER `parcial`, incluida la carta sin hora, que es
  completa para los datos que hay. El estado publica ahora la salida real
  (`recovery`: `ninguna` · `cargar-datos` · `completar-hora` · `reintentar`) y
  `canRetry` se deriva de ella. Un parcial con cálculo pendiente ofrece comprobar
  de nuevo; uno limitado sólo por la hora ofrece completar la hora y ningún
  reintento. Los estados D7 corregidos en el tercer pase quedan igual.
- **Pruebas nuevas (+12, de 1349 a 1361).** Seis en `test/transitLayers.test.ts`
  y `test/transitArcDetailV492.test.ts` para la identidad —igualdad ranking/arco
  del principal con cronología verificada, tres pasadas retrógradas, cruce
  359°/0°, seis procesos distintos que no comparten identidad, y el cache con otra
  identidad que se recalcula— y seis en `test/cartaV492.test.ts` para los dos
  estados de Carta. **Todas verificadas en las dos direcciones:** se restauró a
  mano el motor anterior y las nuevas fallaron
  (`logs5/identidad-arco-antes-despues.md`). Ningún test anterior se debilitó.
- **Checks del pase:** `pnpm typecheck` PASS exit 0 · `pnpm test` PASS
  **1361/1361** (93 suites, 0 fail) · piso 1361/745 · `git diff --check` PASS ·
  export web PASS con límites (32.10 MB / 50 · JS gzip 1005.2 KB / 1.25 MB) ·
  export iOS PASS · export Android PASS · bundles nativos sin Tarot ni Diario.
  Evidencia en `logs5/`.
- **Qué NO cambió el veredicto.** No se recapturó ningún estado, no se tocó el
  simulador, los datos QA ni el entitlement, y no se desplegó nada. `04` sigue
  **BLOCKED**: con la identidad estable, abrir el **primer** tránsito de la lista
  ya no depende del contrato nuevo —usa el sobre del bundle—, pero eso no se
  declara PASS visual sin recaptura, y el detalle de un arco **no principal** sigue
  necesitando el deploy. `06` sigue BLOCKED por entitlement, `02` sin recapturar,
  D7 funcional PASS / visual N/A y VoiceOver BLOCKED por el runtime.
- **Archivos del pase (8 de código + docs).** Backend: `convex/lib/transitLayers.ts`
  · `convex/lib/transitTimeline.ts` · `convex/layers.ts` · `convex/CHANGELOG.md`.
  Frontend: `src/domain/natalChartBase.ts` · `src/domain/natalChartState.ts` ·
  `src/screens/v492/CartaHubScreen.tsx` · `src/screens/v492/CartaCompletaV492Screen.tsx`.
  Tests ampliados: `test/transitLayers.test.ts` ·
  `test/transitArcDetailV492.test.ts` · `test/cartaV492.test.ts`.

**Cuarto pase (2026-08-17, cierre del arco seleccionado) — P1 y P2 cerrados en
código; la evidencia visual de 04 queda BLOCKED por deploy.**

La auditoría independiente encontró que el detalle de un arco NO principal mentía
sobre su propio análisis. `bundle.today.transitArc` trae sólo el arco principal y
es `ORB-TRN-001`; al abrir otro `arcId` del ranking la pantalla armaba una
pseudo-ventana con el ítem `ORB-TRN-002` y le pasaba **ese** sobre al
`TraceAccordion`. Por eso la captura `04` mostraba
`ORB-TRN-002 · transit-ranking-v1` dentro de `ARCO DEL TRÁNSITO`: método,
precisión, limitaciones y bibliografía de otro cálculo.

**Contrato aditivo nuevo (sin deploy).** `layers.getTransitArc({ localDate,
timezone, arcId })` —query reactiva y pura— y `layers.refreshTransitArc({
localDate, timezone, arcId })` —action que calcula y persiste—. Las dos devuelven
el sobre cerrado `AnalysisResult<TransitArcData>` de `ORB-TRN-001`, con
validadores cerrados de `args` y `returns`, sin `v.any` ni `anyApi`. La
autorización y el ownership son los de `getForDate`/`refreshForDate`
(`findCurrentUser` / `getRefreshState` + `expectedInputFingerprint`).

- **Cálculo real, no rótulo.** Se reutiliza el estado del día, la efeméride
  global vigente —o la anterior declarada `stale`—, la carta natal canónica y el
  motor existente. Se reconstruyen los contactos, se selecciona el activo cuyo
  `arcId` coincide exactamente con el pedido, se corre `verifiedTimelineForContact`
  para **ese** contacto y se arma `buildTransitArcLayerData({ contacts,
  observedAt, arcId })`.
- **Alcance propio.** El hash y el `cacheKey` incluyen `{ localDate, timezone,
  arcId }`. Dos arcos del mismo día y el arco principal son tres filas distintas
  en `analysisSnapshotsV492`; ninguna se lee en lugar de otra. Un `stale` sólo se
  reutiliza si el dato guardado declara el mismo `arcId`.
- **Estados honestos.** Arco fuera de la lista → `unavailable` con
  `requested_transit_arc`. Sin cálculo todavía → la query lo declara con
  `requested_transit_arc_calculation`, que la pantalla distingue de "ya no está
  activo". Proveedor o seguimiento caídos → `stale` / `partial` / `error` con su
  motivo. Nunca se reconstruye con metadatos del ranking.
- **Identidad estable del arco.** `TransitContactInput` acepta `arcId?`.
  Verificar las pasadas corre los bordes de la ventana y con ellos el
  identificador derivado: sin este campo el mismo tránsito cambiaba de `arcId` al
  verificarse y dejaba de corresponder al que publicó el ranking. Aditivo: sin el
  campo el motor se comporta igual que antes.
- **Frontend.** `src/services/layersApi.ts` expone los dos bindings generados;
  `src/hooks/useTransitArc.ts` lee la query reactiva y pide la acción **una vez**
  por arco/día/zona/hora civil (`src/domain/transitArcRequest.ts`), y una
  respuesta tardía sólo escribe estado si sigue siendo el pedido vigente.
  `ArcoDetailScreen` quedó con un solo sobre: titular, chip, ventana, pasadas,
  resumen, precisión y trazabilidad salen todos del mismo `ORB-TRN-001`. Se
  eliminó por completo el fallback del ranking; del ranking sólo queda el NOMBRE
  del tránsito mientras su cálculo específico viaja, y la pantalla lo dice.
- **P2 — Vínculos.** Se quitó el pie visible `MÉTODO ${comparison.methodVersion}`.
  Método y versión viven únicamente dentro del `TraceAccordion`; la fecha humana
  de la última verificación se conserva.

**Pruebas nuevas (+24, de 1325 a 1349).** `test/transitArcDetailV492.test.ts` (12),
`test/arcoDetailNativeV492.test.ts` (9) y tres más en `test/transitLayers.test.ts`
para la identidad declarada del arco. Son de comportamiento y contrato: dos
`arcId` del mismo día producen dos `ORB-TRN-001` con hash distinto y tres
`cacheKey` distintos al persistir; un arco no principal obtiene su cronología
verificada contra efemérides sintéticas servidas por un `fetch` interceptado y su
`data.arcId` es el pedido; un arco inactivo devuelve `ORB-TRN-001 unavailable` y
nunca el método de `ORB-TRN-002`; el cielo vencido publica `stale`; sin efeméride
publica `error` fechado; un `stale` de otro arco no se rescata; `getTransitArc`
lee exactamente la fila del arco pedido y `getForDate` sigue publicando el arco
principal; una respuesta tardía de A no reemplaza B; y ninguna pantalla con
acordeón imprime la versión del método por fuera.

**Checks del pase:** `pnpm typecheck` PASS exit 0 · `pnpm test` PASS 1349/1349
(93 suites, 0 fail) · `git diff --check` PASS exit 0 · export web PASS con límites
(32.10 MB / 50 · JS gzip 1005.2 KB / 1.25 MB) · export iOS PASS · export Android
PASS · bundle nativo sin Tarot ni Diario. Evidencia en
`.local/audits/native-v492-recertification-2026-08-17/logs4/`.

**Lo que sigue BLOCKED, y por qué.** El estado visual `04` **no** se declara PASS:
la función nueva no existe en el deployment Development y desplegarla estaba
prohibido en este encargo. Queda
`BLOCKED — requiere desplegar el contrato aditivo a Development y recapturar el
mismo arcId con el acordeón abierto`. Con eso, el conteo honesto de los 12 estados
es **7 PASS visual · 2 PASS de código con evidencia runtime pendiente de deploy
(08 y 09) · 2 BLOCKED (04 por deploy, 06 por entitlement Plus real) · 1 sin
recapturar (02, evidencia previa válida)**. Aparte: D7 funcional PASS / visual
N/A, y VoiceOver BLOCKED en simulador —exige un iPhone físico—.

**Sin commit, sin push, sin merge, sin rebase y sin deploy** de Convex, EAS,
TestFlight, App Store ni producción. Datos QA y entitlement intactos.

## Tarot Free — la carta misma abre Plus al llegar al límite (2026-08-12)

**Objetivo:** evitar el estado confuso donde la octava carta quedaba boca abajo
con “TOCÁ PARA SACARLA” y aparecía además un botón separado. El primer toque
sigue consultando al backend; si informa que Free ya usó siete cartas, se muestra
el aviso y el dorso cambia a `DESBLOQUEAR TAROT DIARIO`. El siguiente toque sobre
la propia carta abre `/paywall` sin volver a animar un reveal imposible.

**Implementación:** `HomeScreen` conserva el rechazo autoritativo y cambia la
acción/label de `CartaDelDia` cuando `tarotLimite` es verdadero. El bloque de
explicación ya no contiene un `Pressable`. `CartaDelDia` suma el modo `unlock`,
con etiqueta accesible propia y salida antes de iniciar el flip optimista. Tanto
el dorso como el texto inferior son controles reales con la misma acción: tocar
`TOCÁ PARA SACARLA` revela y tocar `DESBLOQUEAR TAROT DIARIO` abre Plus.
Producción queda fuera de alcance; rollout únicamente por este Preview.

## Checkout directo — `/paywall` abre Stripe sin pantalla intermedia (2026-08-12)

**Objetivo:** respetar el CTA ya aceptado en Recepción, Carta, Perfil o Home y
abrir directamente Stripe Checkout, sin volver a mostrar una segunda pantalla
comercial propia. El resumen de lo que incluye Plus debe acompañar la
confirmación dentro de Stripe.

**Implementación:** `src/components/web/orbita-paywall.tsx` quedó reducido a un
lanzador autenticado: crea una única sesión mensual al montarse, usa sólo la URL
devuelta por `payments.createCheckoutSession` con `window.location.replace`
—para que `/paywall` no quede atrapado en el historial y Atrás desde Stripe
regrese al CTA de origen— y muestra únicamente el estado
“Abriendo el pago seguro…”. Un guard sincrónico por intento evita duplicados por
StrictMode o re-render; el reintento explícito sí inicia un intento nuevo. Los
estados de error y cuenta ya Plus permanecen cerrados y accionables. Se retiraron
de esa ruta precio, oferta, beneficios, navegación y legales; los CTA de origen
siguen explicando qué se desbloquea.

**Contrato Stripe:** `buildStripeCheckoutForm` agrega
`custom_text[submit][message]` al Checkout mensual con carta natal completa,
Tarot diario, lectura personalizada, tránsitos, Umbral y Diario. Precio, moneda,
intervalo y prueba continúan gobernados exclusivamente por el Price de Stripe.
`cancel_url` pasa a `/home`: volver a `/paywall` abriría otra sesión y formaría un
bucle. Customer, metadata, trial, webhook y entitlement no cambian.

**Validación local:** regresiones focalizadas frontend/backend **85/85** y
`pnpm typecheck` en verde. Pendiente antes de cerrar: suite completa, build/export
web, sincronización exclusiva de Convex Development, commit/push de esta rama,
Vercel Preview y recorrido real autenticado hasta Stripe test. Producción queda
fuera de alcance.

## Editar datos — contraste legible y timezone automático (2026-08-12)

**Objetivo:** reparar `/editar-datos` para que todos sus estados sean legibles
sobre el fondo oscuro y para que elegir una ciudad con coordenadas siempre
resuelva su zona horaria automáticamente, sin pedirle a la persona que repita
la selección ni usar la zona del dispositivo.

**Criterios de aceptación:** (1) resultados de ciudad, `No sé la hora`, mensajes
de ayuda/error y `Cancelar` mantienen contraste suficiente en web y móvil;
(2) Photon sigue siendo el autocomplete gratuito y fuente de etiqueta +
coordenadas; (3) la timezone IANA se deriva server-side de esas coordenadas con
datos geográficos empaquetados, sin llamada paga ni dependencia de la zona del
aparato; (4) el editor espera esa resolución al guardar y persiste la zona
resuelta junto con los demás datos; (5) cambiar sólo fecha/hora conserva la
timezone remota; (6) errores reales de red/guardado siguen fallando cerrado y
sin modificar el perfil local; (7) regresiones focalizadas, typecheck, suite,
build/export web y comparación visual en Chrome; (8) producción intacta.

**Ficha:** owner dividido por territorio — Codex en `convex/**`, contrato y
resolver geográfico; Claude en `app/**`, `src/**` y estilos; misma rama/worktree
del Preview `feature/onboarding-readiness-clerk-ui` /
`.worktrees/orbita-onboarding-readiness`; cambio de contrato aditivo (nueva
action de timezone por coordenadas, sin romper firmas existentes); riesgo medio
por tocar el guardado natal; rollout local primero y Vercel Preview sólo con
autorización de Lucas; rollback revirtiendo los commits de esta tarea; fuera de
alcance onboarding, Clerk, carta, paywall, producción y rediseño visual.

**Diagnóstico confirmado:** Photon no devuelve timezone. El editor tomaba sus
resultados y luego `validateBirthPayload` exigía una timezone antes de invocar
Convex, por lo que el flujo se bloqueaba por construcción. En paralelo, varios
textos usan estilos registrados de React Native Web que pierden contra la clase
`text-foreground` del componente compartido y se renderizan casi negros. La
solución es resolver IANA desde latitud/longitud en backend y usar estilos de
texto con precedencia explícita en esta pantalla.

**Estado frontend (Claude, 2026-08-12):** implementado.
`src/services/appRefs.ts` registra `placeTimezone.atCoordinates` como action
pública (`{ latitude, longitude }` → `{ timezone }`). El helper puro
`src/domain/placeTimezone.ts` (`timezoneLookupFor`, `withResolvedTimezone`)
decide cuándo consultar: con zona presente no se pisa nada, y sin coordenadas
usables no se consulta —el rechazo correcto sigue siendo `coordenadasFaltantes`—.
El camino ESTRICTO del editor (`useProfilePersistInner`) espera esa resolución
ANTES de `validateBirthPayload` y antes de `upsertBirthData`; si falla, el error
se propaga, el editor lo muestra y no se toca el perfil local. Nunca se usa la
zona del dispositivo ni un provider externo, y cambiar sólo fecha u hora
conserva la zona remota. Contraste: en `app/editar-datos.tsx` los textos que
pasan por el `Text` compartido usan objetos LITERALES (`TEXT`) en vez de la hoja
registrada —en react-native-web una hoja compilada a clase pierde contra
`text-foreground`/`text-base`, y por eso salían casi negros y a 16px—; mismos
colores de siempre, sin rediseño. Regresiones nuevas en
`test/placeTimezoneEditor.test.ts` (15) más el ajuste de
`test/natalDataIntegrity.test.ts`. Verde: focalizadas 15/15, suite **971/971**,
`check:test-count`, `pnpm typecheck`, `pnpm build:web`, `pnpm check:web-export`
(32,01 MB / 50 MB; JS gzip 984,0 KB / 1,25 MB) y `git diff --check`. Pendiente:
comparación visual y guardado real en Chrome sobre el Preview.

**Estado backend/rollout local (Codex, 2026-08-12):** la action Node y el
dataset geográfico compacto de `geo-tz@7.0.7` quedaron sincronizados únicamente
con Convex Development (`dutiful-viper-815`). `geo-tz` se instala como paquete
externo mediante `convex.json`; la versión 8 completa excedía el máximo
comprimido de Convex y fue descartada antes de publicar. Producción permanece
intacta. Export web verde: 32,01 MB / 50 MB y JS gzip 986,8 KB / 1,25 MB.

## Post-alta — recepción, acceso a carta y límite Free del Tarot (2026-08-12)

**Objetivo:** ordenar el cierre del alta para que la persona llegue primero a
`/recepcion`, y convertir desde ahí de forma directa a la carta natal completa
sin una pantalla Free intermedia confusa. Hacer que Órbita Plus sea visible y
fácil de activar desde Perfil, y limitar de forma autoritativa a siete las
cartas de Tarot que una cuenta Free puede revelar.

**Criterios de aceptación:** (1) al terminar el alta durable se navega a
`/recepcion`, conservando la tríada real calculada; (2) en recepción, una cuenta
Free ve `DESBLOQUEAR MI CARTA NATAL` y va directo a `/paywall`, mientras una
cuenta Plus ve `ENTRAR A MI CARTA` y va a `/carta`; (3) si una cuenta Free llega
a la carta parcial, su CTA dice `DESBLOQUEAR MI CARTA NATAL`; (4) la paywall
explica qué incluye la carta natal completa y que Free permite siete cartas de
Tarot, pidiendo Plus desde la octava; (5) Perfil ofrece `ACTIVAR ÓRBITA PLUS` a
Free y conserva la gestión autoritativa para Plus; (6) `daily.revealCard` deja
revelar hasta siete cartas a Free, conserva la idempotencia de una carta ya
revelada y rechaza la octava con un marcador estable que el frontend convierte
en salida a `/paywall`; (7) typecheck, suite completa, export web y recorrido en
Chrome sobre Preview en verde; (8) producción intacta.

**Ficha:** owner compartido por territorio — Codex en `convex/**`, Claude en
`app/**` + `src/**`; branch y worktree existentes
`feature/onboarding-readiness-clerk-ui` / `.worktrees/orbita-onboarding-readiness`;
cambio de contrato público no (la firma de `daily.revealCard` no cambia; suma
una regla de acceso y un marcador de error estable); riesgo alto por tocar
onboarding, entitlement y pago; rollout únicamente al Vercel Preview de esta
rama y al deployment Convex dev compartido si la verificación lo requiere;
rollback por revertir los commits de esta tarea y volver a sincronizar sólo el
backend dev; fuera de alcance precio, trial, Checkout/webhook/portal, Stripe
live, schema, producción, diseño visual nuevo y contenido del Tarot.

**Plan de pruebas:** regresiones de navegación/copy/Perfil; pruebas unitarias de
la regla `7 Free / ilimitado Plus`, incluida la idempotencia; typecheck, suite
completa, `build:web`, `check:web-export`, `git diff --check`; en Chrome Preview,
revisar recepción Free → paywall, Carta Free → paywall, Perfil Free → paywall,
paywall y navegación Plus preservada. La octava carta se demuestra con prueba
de backend sin fabricar ni sobrescribir datos reales de la cuenta de Lucas.

**Estado de integración:** backend y frontend implementados. Convex dev
`dutiful-viper-815` quedó sincronizado con la regla de siete revelaciones Free;
producción no se tocó. El frontend restaura `/recepcion`, decide el CTA con el
entitlement real, ofrece Plus desde Perfil, corrige los CTA de Carta/paywall y
convierte el rechazo de la octava carta en una salida visible a `/paywall` sin
fingir un reveal exitoso. Validación independiente de Codex: `pnpm typecheck`,
suite completa **953/953**, `pnpm build:web`, `pnpm check:web-export` y
`git diff --check` en verde; export web 31,99 MB, imagen máxima 479,3 KB y JS
gzip 978,9 KB. Backend aislado en `744f0eb`. Pendiente al escribir esta línea:
commit frontend, push, Vercel Preview y recorrido autenticado en Chrome.

## Alta — vuelve la columna única del alta (2026-08-12, Claude)

**Objetivo:** sacar del alta la composición ancha que reintrodujo `56b8a6d` (escenario de 1200, `split`/`scene` y el slot que mudaba controles a una segunda columna) y volver al shell de formulario de UNA columna aprobado en `feature/web-p5-onboarding-responsive`, sin tocar el layout compartido de la app ni nada del alta durable.

**Criterios de aceptación:** (1) primera pantalla legible en una sola columna, con el CTA visible o alcanzable por scroll; (2) fecha y hora natal con título, control, nota y CTA en la misma secuencia vertical, sin control aislado a la derecha; (3) Cuenta con Clerk oficial, su scroll propio y su alto reservado; (4) Splash sin escena ancha; (5) ningún control duplicado en el DOM; (6) fondo full-bleed, wash, assets, tipografía y copy intactos; (7) regresiones que PROHÍBAN la vuelta del layout ancho; (8) `completeSignupFromDraft`, readiness, Home y la carta no bloqueante sin tocar.

**Ficha:** owner Claude (frontend); branch `feature/onboarding-readiness-clerk-ui` sobre HEAD `3f9faff`, worktree `.worktrees/orbita-onboarding-readiness`; territorio autorizado por Lucas y acotado a `src/onboarding/**`, `test/onboardingLaunch.test.ts`, `test/responsiveShells.test.ts` y esta ficha; cambio de contrato no; riesgo medio — toca el marco de los quince pasos del alta más `/editar-datos` y `/iniciar-sesion`, que montan el mismo shell; rollout por Vercel Preview del PR #72; rollback revirtiendo el commit único; fuera de alcance `convex/**`, `src/domain/webLayout.ts`, `ContentCanvas`, copy, assets, Home, Carta y el alta durable.

**Implementación:** el arreglo es autocontenido: la medida vive en el shell del alta, no en el contrato compartido.

- **`src/onboarding/components/Screen.tsx`:** una sola columna de `FORM_COLUMN = 480` centrada con `alignSelf` sobre el fondo full-bleed. Se eliminaron `ScreenLayout`, `layout`, `aside`, `useSplitSlot`, `STAGE_MAX` (1200), `STAGE_COLUMN` (720), `COPY_COLUMN` (520) y el `useIsDesktop` del shell. Se conservan `bg`/`bgOpacity`/`wash`, el `LinearGradient` de legibilidad, la safe area, el `scroll` opcional y los `minHeight: 0` que permiten acotar un `ScrollView` interno sin mandar el CTA fuera del viewport. La estructura sigue siendo `stage > column > children`: misma profundidad que antes, sin cadenas de flex nuevas.
- **Align, fecha natal y hora natal:** la grilla y los dos pickers se montan INLINE, una sola vez, en su lugar real del flujo. Sin `useSplitSlot` ya no hay dos posiciones posibles para el mismo control.
- **Cuenta:** una columna, con el sello compacto de 88 px arriba del título (el disco de 420 px de la segunda columna se fue) y el arte del sobre como atmósfera fija (`bgOpacity 0.32`, `wash 0.74`). El widget OFICIAL de Clerk, su `ScrollView` propio, el `keyboardShouldPersistTaps` y el `minHeight: 380` de su zona quedan igual.
- **Splash:** una sola composición —marca centrada, puertas al pie—; se fueron `WORDMARK_DESKTOP` (96 px), `TAGLINE_DESKTOP` y los estilos del hero editorial anclado abajo a la izquierda. **Queda una excepción deliberada:** `useIsDesktop()` sobrevive SÓLO para elegir el master del fondo (`entryBackground(desktop)`: panorámico 2560×1440 en ventana ancha, vertical 1170×2532 en teléfono, el mismo par aprobado en el PR #57 y que usa la landing). No compone nada; sacarlo obligaría a servir un master recortado y sería un cambio de assets.

**Regresiones:** `test/onboardingLaunch.test.ts` y `test/responsiveShells.test.ts` pasaron de exigir el layout ancho a prohibirlo. Ahora: la medida del shell es `FORM_COLUMN = 480` y es la ÚNICA del archivo; `STAGE_MAX`, `STAGE_COLUMN`, `COPY_COLUMN`, `ScreenLayout`, `useSplitSlot`, `aside`, `columnDesktop`, `columnCentered`, `stageDesktop`, `layout="split"` y `layout="scene"` están prohibidos en el shell **y en los diecisiete pasos**, no sólo en los archivos que fallaban; ningún archivo del alta mide la ventana ni ramifica por modo de layout salvo la entrada, donde se afirma que el modo se usa exactamente dos veces y sólo para el fondo; cada pieza interactiva se monta exactamente una vez; el orden de Align, fecha y hora se verifica por posición en el archivo; el sello de Cuenta es el compacto y Clerk sigue siendo el oficial; la entrada conserva marca centrada y puertas al pie, sin tipografía de escritorio.

**Validación:** Codex ejecutó las pruebas que Claude no pudo correr por su gate local: focalizadas responsive **73/73**, `pnpm typecheck` verde, suite completa **911/911**, `pnpm build:web` verde, `pnpm check:web-export` verde (36,33 MB / 50 MB; imagen máxima 479,3 KB / 500 KB; JS gzip 1,10 MB / 1,25 MB; ficha de búsqueda completa) y `git diff --check` limpio. Smoke visual local de sólo lectura: Align 1440×900, Fecha 1024×768 y 390×844 quedan en una columna, sin overflow horizontal y con CTA dentro del marco; Hora 320×568 conserva el comportamiento extremo previo de P5 y deja el CTA debajo del marco, pero la matriz obligatoria empieza en 360×800 y se verificará exacta sobre Vercel Preview antes de cerrar. La cuenta real de Clerk tampoco puede probarse localmente porque este worktree no tiene toda su configuración; queda para el Preview con variables reales.

**Handoff:** **Estado:** implementado y validado localmente, listo para commit + Vercel Preview. **Branch:** `feature/onboarding-readiness-clerk-ui` (base `3f9faff`), todavía sin commit, push ni deploy al escribir esta entrada. **Qué cambió:** `src/onboarding/components/Screen.tsx`, `src/onboarding/screens/{Align,Birthdate,BirthTime,Account,Splash}Screen.tsx`, `test/onboardingLaunch.test.ts`, `test/responsiveShells.test.ts` y esta ficha. **Qué NO cambió:** `convex/**`, `completeSignupFromDraft`, la readiness, Home, la carta no bloqueante, el copy, los assets, `src/domain/webLayout.ts`, `ContentCanvas` y el resto de `app/**` y `src/**`. **Efecto colateral esperado:** `/editar-datos` y `/iniciar-sesion` montan el mismo shell, así que también pasan a la columna de 480 — es el comportamiento de P5, no un desvío. **Próximo paso exacto:** revisar el diff final, commitear con un solo objetivo, push y recorrer en Chrome la matriz visual (1440×900, 1440×780, 1280×720, 1024×768, 768×1024, 393×852, 360×800) y la funcional del handoff sobre Vercel Preview. Producción intacta.

## Backend — resolución durable del lugar natal (2026-08-11, Codex)

**Objetivo:** guardar el borrador del alta antes de cualquier enriquecimiento y
resolver internamente la zona horaria del lugar, con reintentos durables, sin pedirla
ni mostrar errores técnicos a la persona.

**Implementación:** `onboarding.saveDraft` persiste primero y agenda un único worker
por combinación lugar/coordenadas. El worker elige el resultado más cercano, aplica
la zona sólo si el lugar no cambió y reintenta con backoff hasta 12 horas. Un claim
opcional en `onboardingDrafts` deduplica autoguardados; se libera al resolver o agotar
la cadena. No existe fallback a la zona del dispositivo y las respuestas viejas no
pueden pisar una ciudad nueva.

**Verificación:** pruebas focalizadas **23/23**; suite completa **854/854**;
`tsc --noEmit` y `git diff --check` en verde. Sin commit, push, deploy ni mutaciones
de producción.

## Web — la vista previa de Google de orbitaastrologia.xyz (2026-08-11, Claude)

**Objetivo:** darle a los buscadores todo lo que hoy le falta a `orbitaastrologia.xyz` para armar bien su ficha —un ícono de marca declarado de forma explícita y estable, un extracto real de la landing en el HTML inicial, y `robots.txt`/`sitemap.xml` servidos de verdad—, sin romper la SPA ni la UI autenticada. Lo que Google termine mostrando y cuándo lo actualice no es algo que este cambio pueda forzar.

**Criterios de aceptación:** (1) el documento declara un favicon de marca explícito y estable, cuadrado y múltiplo de 48 px, servido desde una URL fija; (2) `robots.txt` y `sitemap.xml` se sirven como archivos reales, no como `index.html`; (3) el HTML inicial trae contenido semántico de la landing —el mismo que ve una persona— para que el buscador tenga de dónde sacar el extracto sin ejecutar JavaScript; (4) metadatos esenciales de robots, Open Graph, Twitter, `theme-color` y datos estructurados válidos; (5) nada del contenido pre-JS queda oculto, fuera de pantalla ni distinto de lo visible (sin cloaking); (6) React sigue montando sobre `#root` y no queda un flash feo; (7) los deep links de la SPA y la UI autenticada siguen igual; (8) regresiones focalizadas sobre la fuente y sobre `dist/`; (9) `pnpm typecheck`, `pnpm test`, `pnpm build:web` y `pnpm check:web-export` en verde.

**Ficha:** owner Claude (frontend); branch `fix/web-seo-search-preview` desde `main` `c6b32df`, worktree `.worktrees/orbita-web-seo` (no es `feature/web`: Lucas pidió trabajar en este worktree); territorio permitido `public/**` (documento y estáticos servidos tal cual), `scripts/check-web-export.mjs`, `test/**` y `CURRENT_TASK.md`; cambio de contrato no; riesgo bajo-medio — toca el documento que sirve TODAS las rutas web, no toca `app/**` ni `src/**`; plan de pruebas: regresiones de documento + export, suite completa, typecheck, `build:web` e inspección del `dist/` real; rollout por PR a `main` y despliegue web cuando Lucas lo autorice; rollback revirtiendo el commit único; fuera de alcance `convex/**`, commit/push/deploy, `app.json`, `vercel.json`, renderizado estático por ruta, canónicas por ruta, manifest PWA, rediseño de la landing y cualquier pantalla de la app.

**Diagnóstico — lo confirmado y lo que NO:**

- **Confirmado (defecto real):** `robots.txt` y `sitemap.xml` no existían como archivos. Vercel resuelve `rewrites` DESPUÉS del filesystem, así que `/robots.txt` y `/sitemap.xml` caían en `"/(.*)" → "/index.html"` y devolvían el documento de la SPA. Reproducido local y arreglado acá.
- **Confirmado (defecto real):** el documento llegaba con `<div id="root"></div>` vacío, así que el único texto del HTML inicial era el aviso de JavaScript y el buscador nunca tuvo contenido mejor del cual sacar el extracto. El resto que Google muestra hoy —“You need to enable JavaScript to run this app.”, en inglés— es textual el aviso de la plantilla por defecto de Expo; la plantilla propia lo tiene traducido desde el PR #50, o sea que ese extracto viene de un rastreo anterior a aquel deploy. El `#root` vacío está arreglado acá; el extracto lo actualiza Google cuando vuelva a rastrear.
- **NO confirmado — hipótesis descartada:** que el ícono genérico viniera de un favicon inválido. Codex auditó producción hoy (2026-08-11): `/favicon.ico` responde 200, está enlazado desde el HTML emitido y contiene un frame válido de 48×48 (más 16 y 32), o sea que **cumple** la guía de Google (cuadrado y múltiplo de 48). La explicación razonable del globo genérico en la captura es un crawl/caché viejo, posterior al deploy del favicon del 2026-08-07 — la misma antigüedad que explica el extracto en inglés. **No hay que atribuirlo a un favicon roto ni prometer que el PNG nuevo lo cambie.**
- **Por qué el PNG de 192 igual entra:** es un refuerzo, no una corrección. El `.ico` que inyecta Expo se declara sin `sizes` ni `type` y sale al final del `head`; el PNG agrega una declaración explícita, autodescripta, estable y de mayor tamaño, que también cumple la guía. Mejora la señal; no garantiza el resultado.

**Implementación:** todo en `public/`, que el export copia tal cual a `dist/` (verificado en el CLI: `copyPublicFolderAsync` corre antes de escribir el `index.html` generado).

- **Ícono estable (refuerzo, no corrección):** `public/orbita-icon-192.png` — copia del emblema oficial `assets/orbita/optimized/brand/orbita_app_icon_web.png` (192×192, 62,9 KB), servido desde una URL fija sin hash de build. La plantilla lo declara explícito (`rel="icon" type="image/png" sizes="192x192"` + `apple-touch-icon`) ANTES del `.ico` que inyecta Expo. El `.ico` **no se toca ni se reemplaza**: sigue siendo válido, se genera con frames 16/32/48 y queda para la pestaña del navegador. Las dos rutas terminan en el mismo emblema; la nueva sólo lo dice de forma explícita y con un tamaño mayor.
- **Metadatos:** `robots` (`index, follow, max-image-preview:large, max-snippet:-1`), `theme-color` `#07080A`, Open Graph completo (`type`, `site_name`, `locale es_AR`, `url`, `title`, `description`, `image` + tipo/medidas/alt) y Twitter `summary_large_image`. Título y descripción son LOS MISMOS de `app.json` (hay regresión que falla si se desincronizan) y la meta description se sigue dejando a Expo para no duplicarla.
- **Imagen de compartido:** `public/orbita-og.jpg` (1200×630, 68,7 KB), recorte del fondo orbital APROBADO `assets/orbita/optimized/web-entry/entry_bg_desktop.webp` (2560×1440) — arte real de Órbita, sin tipografía inventada.
- **Datos estructurados:** un JSON-LD con `WebSite` + `Organization` (nombre, URL, logo 192). Nada de ratings, reseñas ni precios.
- **Contenido inicial:** dentro de `#root`, `div#orbita-pre-js` con la landing real en HTML plano — emblema, `TU ASTRÓLOGA PERSONAL`, el H1, la promesa, los dos CTAs (`/empezar`, `/iniciar-sesion`), la línea de carta astral base, “Cómo funciona” (3 pasos) y “Qué incluye” (5 filas), más el pie con Privacidad/Términos/Soporte. **Copy textual de `orbita-landing.tsx`**, no una versión para robots. Los estilos van en un `<style id="orbita-prejs-style">` y TODAS las reglas cuelgan de `#orbita-pre-js`, con los colores de la landing: lo primero que se pinta ya es negro `#07080A`, así que se elimina el flash blanco que había antes.
- **Por qué dentro de `#root`:** `registerRootComponent` monta con `createRoot` (`hydrate` sale de `globalThis.__EXPO_ROUTER_HYDRATE__`, que sólo define el renderizado estático), y React vacía el contenedor en su primer commit. El bloque desaparece entero al montar: no queda duplicado en el DOM ni texto debajo de la app.
- **`robots.txt` / `sitemap.xml` reales**, con `Sitemap:` absoluto, sin bloquear `_expo`/`assets` (Google necesita el bundle para renderizar) y cerrando sólo `/backoffice`, `/lab`, `/studio` y `/checkout/`. El sitemap lista UNA sola URL a propósito: todas las rutas se sirven desde el mismo documento con canónica al raíz, así que listar `/empezar` o `/privacy` contradiría esa canónica; se las descubre por los enlaces reales del HTML inicial.
- **Gate de export:** `scripts/check-web-export.mjs` suma `evaluatePublicSeo` — falla si a `dist/` le falta alguno de los seis estáticos (`favicon.ico`, `index.html`, `orbita-icon-192.png`, `orbita-og.jpg`, `robots.txt`, `sitemap.xml`), si el `index.html` emitido perdió la canónica, el ícono de 192, el bloque inicial, el JSON-LD o la meta description, o si quedó un marcador de plantilla sin sustituir.

**Regresiones:** `test/webSearchPreview.test.ts` (nuevo, 15 tests): el ícono existe, es cuadrado, su lado es múltiplo de 48 y su URL no lleva hash (se leen las medidas REALES del PNG, no lo declarado); la imagen de compartido existe y mide exactamente lo que dice el `<meta>` (medidas leídas del JPEG); OG/Twitter repiten literal el título y la descripción de `app.json`; el JSON-LD parsea, apunta al dominio productivo y no trae `aggregateRating`/`review`/`offers`/`price`; el bloque inicial vive dentro de `#root`, tiene un solo H1 y enlaza cinco rutas que existen en `app/`; **cada frase del bloque aparece textual en `orbita-landing.tsx`** (el guard anti-cloaking); ninguna regla del bloque usa `display:none`, `visibility:hidden`, `opacity:0`, `font-size:0`, `text-indent` negativo, posicionamiento fuera de pantalla ni `clip`, y todo selector cuelga de `#orbita-pre-js`; `robots.txt` abre el sitio, publica el sitemap y sólo cierra rutas que existen; ningún `<loc>` del sitemap contradice la canónica. `test/webDocument.test.ts` suma dos: los cierres de `head`/`body` aparecen una sola vez (Expo inyecta pisando la primera aparición) y ni la descripción ni el `theme-color` se declaran dos veces. `test/webExportLimits.test.ts` suma cinco sobre `evaluatePublicSeo`.

**Validación ejecutada (2026-08-11):** `pnpm typecheck` verde; suite completa **868/868** (846 antes, +22 nuevos), `check:test-count` verde; `pnpm build:web` completo; `pnpm check:web-export` verde — 36,33 MB / 50 MB, imagen máxima 479,3 KB / 500 KB, JS gzip 1,10 MB / 1,25 MB y ficha de búsqueda completa; `git diff --check` limpio. Inspección del `dist/` real: `robots.txt`, `sitemap.xml`, `orbita-icon-192.png` y `orbita-og.jpg` en la raíz; `index.html` con `lang="es"`, el título sustituido, la meta description inyectada una sola vez, el CSS, el `<link rel="icon" href="/favicon.ico" />` de Expo después del PNG de 192 y el `<script defer>` al final; `favicon.ico` con frames 16×16, 32×32 y **48×48**. Servido con un servidor que imita a Vercel (filesystem primero, rewrite después): `/robots.txt` y `/sitemap.xml` responden `text/plain` y `application/xml`, y `/empezar` sigue devolviendo el documento de la SPA. Chrome headless: el documento sin JavaScript se ve como la landing real (negro, emblema, H1 serif, CTAs) a 1280 y a 500 px, sin desbordes (`scrollWidth == clientWidth` en `html`, `body`, `#root` y el bloque); con el bundle, `/privacy` monta la app entera y el bloque inicial **desaparece del DOM** (`#orbita-pre-js` ya no existe, la nav web se dibuja normal): React reemplaza, no superpone.

**Limitaciones / pendientes:** (1) la landing autenticada no se pudo ver localmente: este worktree no tiene `.env`, así que sin `EXPO_PUBLIC_CONVEX_URL`/Clerk la app corta con `Could not find Convex client!` en `/` — se comprobó que el mismo build con el documento ANTERIOR (con `#root` vacío) falla igual, así que no lo introduce este cambio; la prueba de montaje se hizo sobre `/privacy`, que no depende del backend. Falta una pasada visual en producción/preview con las variables reales. (2) En una ruta profunda con sesión (por ejemplo recargar `/carta`) el HTML inicial muestra un instante la portada pública antes de que monte la app; antes se veía una pantalla en blanco. Es consecuencia de servir un solo documento para todas las rutas y se resolvería con renderizado estático por ruta (fuera de alcance). (3) No se tocó `vercel.json`: el rewrite `"/(.*)"` sigue igual y funciona porque Vercel resuelve `rewrites` después del filesystem — si alguna vez se migra a `routes`, hay que excluir explícitamente los estáticos. (4) La imagen de compartido es arte aprobado sin marca tipográfica; una placa diseñada con el wordmark tendría que salir de Figma. (5) **La ficha que se ve hoy en Google es vieja, y este cambio no la actualiza por sí solo.** El favicon publicado ya era válido y el snippet en inglés viene del documento anterior; Google puede tardar semanas en revisitar. Después del deploy corresponde pedir la reindexación de `https://orbitaastrologia.xyz/` en Search Console y recién ahí evaluar el resultado: si el ícono siguiera genérico con el PNG explícito servido y rastreable, la causa es otra y hay que investigarla de nuevo, no insistir con el ícono.

**Handoff:** **Estado:** completo, sin commitear. **Branch y commit:** `fix/web-seo-search-preview` sobre `main` `c6b32df`, worktree `.worktrees/orbita-web-seo`, sin commit/push/deploy. **Qué cambió:** `public/index.html` (metadatos + contenido inicial), `public/robots.txt`, `public/sitemap.xml`, `public/orbita-icon-192.png` y `public/orbita-og.jpg` nuevos, `scripts/check-web-export.mjs` (+`evaluatePublicSeo`), `test/webSearchPreview.test.ts` nuevo, `test/webDocument.test.ts` y `test/webExportLimits.test.ts` ampliados, y esta ficha. **Qué NO cambió:** `app/**`, `src/**`, `convex/**`, `app.json`, `vercel.json`, `assets/**`, la landing React, el onboarding, la sesión, Stripe y los deep links (`vercel.json` intacto; `/empezar` verificado). **Pruebas:** typecheck, 868/868, `check:test-count`, `build:web`, `check:web-export` e inspección del `dist/` servido. **Riesgos:** el documento lo comparten TODAS las rutas web; el error clásico acá es escribir dos veces un marcador o un cierre de `head`/`body` — ya hay regresión para ambos. **Rollback:** revertir el commit único (vuelve el documento anterior; ningún dato ni contrato se toca). **Próximo paso exacto:** commitear como un solo PR `fix(web): arregla la vista previa de búsqueda`, mergear a `main` y, con autorización de Lucas, desplegar la web; después verificar en producción `https://orbitaastrologia.xyz/robots.txt` y `/sitemap.xml`, revisar la URL con la prueba de resultados enriquecidos de Google y pedir reindexación en Search Console.
## Hotfix visual — la mini rueda de la tarjeta de Carta natal (2026-08-08, Claude)

**Objetivo:** que la tarjeta de Carta natal de Perfil vuelva a dibujar su mini rueda en vez del hueco vacío de 232 px que muestra la captura de producción, conservando el tope de 232 y los glifos vectoriales de Sol, Luna y Ascendente.

**Criterios de aceptación:** el contenedor de la mini rueda tiene ancho medible en web y nativo; `MeasuredSquare` conserva `max={232}` y el lado sigue saliendo de la medición del contenedor, nunca del viewport; los estados de carga siguen reservando el mismo alto y centrando su spinner; la tríada sigue siendo `TriadLine` + `AstroGlyph` (`sun`/`moon`/`ascendant`) con el nombre real del signo, sin códigos `SO`/`LU`/`AC`; pruebas focalizadas que cubran las dos regresiones; esta ficha.

**Ficha:** owner Claude (frontend), con autorización explícita de Lucas acotada a `src/components/home/CartaCard.tsx`, sus pruebas y `CURRENT_TASK.md`; branch `fix/profile-natal-card-visual` desde `origin/main` `2ff7010`; cambio de contrato no — es sólo estilo y cobertura; riesgo bajo; rollout por PR a `main`, sin commit, push ni deploy en esta pasada; rollback revirtiendo el commit único; fuera de alcance `convex/**`, datos, Tarot, favicon, aliases, Vercel y cualquier otra pantalla.

**Causa confirmada:** `MeasuredSquare` mide su contenedor con `onLayout` y hasta no tener una medida real no dibuja nada, sólo reserva el alto del tope (`minHeight: size ?? max`). El `wheelWrap` de la tarjeta no declaraba ancho propio y vive dentro de un `Pressable` con `alignItems: "center"`, así que se encogía a su contenido —que arranca vacío— y el ancho medido quedaba en 0: el porcentaje del cuadrado no resolvía nunca y sólo sobrevivía el rectángulo de 232 px. Es la misma combinación que ya está documentada en `ContentCanvas` (`alignItems: "center"` sobre un hijo con `width: "100%"` colapsa en react-native-web).

**Implementación:** `wheelWrap` pasa a `alignSelf: "stretch"` + `width: "100%"` y deja de centrar; el centrado lo pone `MeasuredSquare`, que ya centra su contenido. `stateZone` recibe `alignItems: "center"` para que el spinner de los tres estados de carga siga centrado. Nada más cambia: mismo `max={232}`, misma `TriadLine` con `sun`/`moon`/`ascendant` y el nombre del signo del payload (los códigos de dos letras ya no estaban en el archivo; ahora hay regresión que lo fija).

**Regresiones (`test/cartaCardVisual.test.ts`, nuevo):** el wrap declara ancho propio y NO centra; la tarjeta sigue centrando el resto de su contenido; `max={232}` y `size={size}` intactos y sin lectura de viewport; `stateZone` reserva 232 y centra, y se usa en los tres estados de carga; la tríada importa `TriadLine` y declara las tres unidades con el signo real, y `TriadLine` dibuja `AstroGlyph`; Sol, Luna y Ascendente tienen dibujo en el catálogo; ningún token `SO`/`LU`/`AC` ni la API vieja de códigos.

**Validación ejecutada (2026-08-08, Codex):** pruebas focalizadas **60/60**; suite completa **846/846**; `pnpm typecheck` verde; `pnpm build:web` verde; `check:web-export` verde con presupuesto 36.19 MB / 50 MB, imagen máxima 479.3 KB / 500 KB y JS gzip 1.10 MB / 1.25 MB.

**Pendiente:** la **verificación visual autenticada todavía no se pudo ejecutar** porque el navegador local no tiene la sesión del usuario; no hay smoke visual de la tarjeta real y no se debe dar por hecho. Queda para una pasada con sesión válida.

**Estado:** cambio aplicado y con la validación automatizada completa en verde. Falta únicamente la pasada visual autenticada antes del PR. Sin commit, push ni deploy en esta pasada.

## Incidente producción — restaurar definitivamente las cartas natales (2026-08-08)

**Objetivo:** corregir el contrato entre `charts.current` y el frontend sin recalcular ni modificar cartas existentes, integrar el arreglo en `main` y desplegar únicamente Convex producción desde el SHA mergeado.

**Criterios de aceptación:** payload plano canónico con `placements`, `houses`, `aspects` y `summary`; compatibilidad temporal con `payload.chart.normalized`; respuestas malformadas muestran error en vez de una rueda vacía; `AC —` sólo para `noon_fallback`; Free/Plus y privacidad intactos; Sol Escorpio, Luna Escorpio y Ascendente Capricornio mapeados en el contrato realista; payload nulo y posiciones esenciales ausentes cubiertos; suite, typecheck, export web, presupuesto y dry-run Convex en verde; ids/timestamps persistidos sin cambios; PR mergeado antes del deploy; smoke y monitoreo posterior.

**Ficha:** owner Codex, con autorización excepcional explícita de Lucas para modificar `src/domain/natalChart.ts` y sus pruebas después de que Claude Code quedara bloqueado por permisos internos; branch `hotfix/natal-public-contract` desde `origin/main` `cf7a981`; territorios `convex/charts.ts`, helper público nuevo, mapper natal, pruebas y documentación; cambio de contrato sí — restauración compatible, sin cambio de nombre ni argumentos; riesgo alto por producción compartida; rollout tests → PR → merge a `main` → worktree limpio del merge → dry-run → deploy exclusivo `exciting-bat-311` → smoke/monitoreo; rollback al bundle anterior de funciones; fuera de alcance Vercel, favicon, aliases, Stripe, Tarot, datos natales, cartas guardadas, migraciones, recálculos y rediseño.

**Causa confirmada:** el arreglo probado `a027e24` restauró el payload plano y fue desplegado el 2 de agosto, pero quedó en una rama lateral. Un deploy posterior desde `main`, donde seguía la envoltura `payload.chart.normalized`, revirtió el contrato sin tocar las filas. El mapper leyó `payload.placements`, obtuvo una lista vacía y fabricó guiones; `personalChartGate` hizo visible esa respuesta no nula como la carta vigente. La fuente persistida conserva la carta completa.

**Validación local:** pruebas focalizadas 49/49; suite completa 838/838; typecheck completo verde; codegen Convex regeneró únicamente la referencia al helper nuevo; export web completo; presupuesto 36,21 MB / 50 MB, imagen máxima 479,3 KB / 500 KB y JS gzip 1,10 MB / 1,25 MB; `git diff --check` limpio. El dry-run contra `exciting-bat-311` validó schema, confirmó cero índices eliminados y no mostró cambios de schema ni funciones ajenas; la CLI reportó sólo una diferencia vacía de metadata de versión Node (`undefined` vs `null`), sin valor agregado o retirado.

**Estado:** listo para PR. No desplegar nada hasta que este hotfix quede integrado en `main` y se verifique el SHA mergeado.

## Web — favicon de Órbita (2026-08-07)

**Objetivo:** reemplazar el ícono genérico de la pestaña/favorito del navegador por el emblema oficial de Órbita.

**Criterios de aceptación:** Expo Web declara un favicon propio; el export genera `favicon.ico` y lo enlaza desde `index.html`; la configuración de íconos nativos no cambia.

**Ficha:** owner Claude, coordinado y verificado por Codex; territorio `app.json` + asset web optimizado existente; cambio de contrato no; riesgo bajo; rollout por PR a `main` y despliegue automático de Vercel autorizado por Lucas el 2026-08-07; rollback revirtiendo el commit; fuera de alcance UI, backend e íconos nativos.

**Estado:** implementación y validación completas en `fix/web-favicon-current`. `app.json` apunta al asset oficial `assets/orbita/optimized/brand/orbita_app_icon_web.png` (192x192, 62.9 KB). Verificación: JSON y `expo config --type public` válidos; typecheck y 817 tests en verde; `expo export --platform web` completo; el HTML exportado contiene `<link rel="icon" href="/favicon.ico" />` y el `.ico` incluye variantes 16x16 y 32x32.

## Símbolos astrológicos reales en toda la app (2026-08-01, Claude)

**Objetivo:** reemplazar los códigos de dos letras (`SO LU ME VE MA JU SA UR NE PL NO QU FO AC MC`) por un sistema ÚNICO de símbolos astrológicos visuales — determinista, monocromo y idéntico en web, iOS y Android — que cubra Sol, Luna, Mercurio, Venus, Marte, Júpiter, Saturno, Urano, Neptuno, Plutón, Nodo, Quirón, Parte de la Fortuna, Ascendente, Medio Cielo y los doce signos. Lucas rechazó explícitamente la limitación documentada en `src/domain/astroSymbols.ts` ("los planetas son abreviaturas").

**Criterios de aceptación:** (1) ningún código de dos letras visible queda en la UI; (2) cero dependencia de fuentes del OS, de fallback Unicode o de emoji a color; (3) glifos como paths SVG deterministas empaquetados (o fuente licenciada local); (4) fuente y licencia de cada asset documentadas; (5) los doce signos siguen completos y consistentes con los planetas (un solo vocabulario visual); (6) todos los consumidores actualizados: tríada de Carta, rueda natal, tabla de posiciones, línea del planeta seleccionado, sectores de la explicación, tríada de Home (hero + kit), GlyphRow, carta-full, recepción; (7) ningún dato real de signo/grado/casa se toca ni se inventa; (8) los símbolos obedecen los colores del tema; (9) tests de regresión: catálogo completo, sin fallback de dos letras, sin Unicode/emoji del sistema; (10) esta ficha; (11) typecheck + test + build:web + check:web-export + `git diff --check` en verde; (12) verificación visual en anchos móvil y escritorio.

**Ficha:** owner Claude (frontend); territorio `app/**`, `src/**`, `test/**`, `CURRENT_TASK.md` (sin `convex/**`, sin Stripe, sin `COMMERCE_MODE`, sin deploys); riesgo medio — cambio visual transversal en superficies aprobadas, mitigado con evolución quirúrgica (misma estructura, solo el glifo cambia de `Text` a SVG) y verificación visual; tests: nueva suite de catálogo + reescritura de `astroSymbols.test.ts` + ajuste de `wheelLayout.test.ts`; rollout: PR aislado `feature/web-astro-symbols`, sin push/merge/deploy en esta pasada; rollback: revert del commit único; fuera de alcance: rediseño de pantallas, marca `Rx` de retrogradación (no está en el catálogo pedido y es notación estándar), numerales romanos de casas, cambios de copy o de datos.

**Decisión de asset:** los 27 glifos son **vectores originales dibujados a mano para Órbita** en `src/domain/astroGlyphs.ts` (paths SVG sobre grilla 24×24, trazo redondeado), siguiendo las formas canónicas de la notación astrológica (símbolos de dominio público; ningún outline se extrajo de fuentes de terceros). Licencia: la del repo, como el resto del código. Se elimina la dependencia de `MaterialCommunityIcons` para los signos: un solo vocabulario de trazo para signos y planetas. Ascendente y Medio Cielo se dibujan como monogramas `Ac`/`Mc` en paths propios (la notación canónica de los ejes es tipográfica), no como texto.

**Implementación (2026-08-01, Claude):** nuevo catálogo `src/domain/astroGlyphs.ts` (27 defs `strokes/rings/dots`) + componente `src/components/orbita/AstroGlyph.tsx` (`AstroGlyph` autónomo, `AstroGlyphShape` para componer, `WheelAstroGlyph` para la rueda) + `src/components/orbita/TriadLine.tsx` (tríadas glifo+texto con wrap por unidad). `astroSymbols.ts` reescrito: `bodySymbol`/`bodySymbolForName`/`signSymbolForName`/`PLACEMENT_BODY_SYMBOL` devuelven claves del catálogo; `BODY_CODES`/`bodyCode` eliminados. Consumidores migrados: rueda (`NatalWheel` — signos 26/planetas 16 vectoriales; sólo numerales y `Rx` siguen en la mono), `wheelLayout` (`symbol` en vez de `code`/`glyph`), tríada y tabla y línea de selección y sectores de `CartaScreen`, `CartaCard`, `carta-full`, `recepcion`, hero y marcadores de área de `sections.tsx` (`TOPIC_GLYPHS` era Unicode), `kit.Triad`, `GlyphRow`, tríada del paywall de onboarding (`PaywallScreen`), mosaico lunar de `AlignScreen` (`☾`), tabs del Vacío (`VoidExperience` ignora el `glyph` string del payload y resuelve por key/label). `Placement` perdió el campo `glyph` (el mock de `readingEngine` ya no fabrica `☉ ☽ ↑`). `src/theme/glyphFont.ts` eliminado y `useOrbitaFonts` ya no carga MaterialCommunityIcons. Sin cambios en `convex/**`, Stripe ni `COMMERCE_MODE`.

**Regresiones (`test/astroSymbols.test.ts` reescrito):** catálogo 15+12 completo y con paths válidos dentro de la grilla; 27 dibujos distintos; resolución key/nombre; barrido de superficies sin Unicode/emoji prohibidos, sin `bodyCode`/códigos de dos letras y sin `fontFamily` en el sistema de glifos; `glyphFont.ts` inexistente; la rueda dibuja `WheelAstroGlyph` y sus únicos `SvgText` declaran la mono. `wheelLayout.test.ts` y `onboardingLaunch.test.ts` ajustados a la nueva forma.

**Validación (2026-08-01):** typecheck verde; suite **817/817**; `pnpm build:web` y `check:web-export` aprobados (36.18 MB / 50 MB, JS gzip 1.10 MB / 1.25 MB); `git diff --check` limpio. Visual en Chrome: catálogo completo a 72/28/16/12 px (monocromo cobre, mientras los caracteres Unicode de referencia caían al font de emoji), rueda dibujada con el dominio real (`buildWheelLayout`) a 360/232/160 px, dev server web con sesión: filas de área con ☽/☿ reales, shells móviles a 390 px OK. La Carta real con datos no se pudo ver porque la cuenta dev no tiene datos natales (no se tocaron los datos de la cuenta).

**Limitaciones/pendientes:** falta pasada visual en iOS/Android nativos (el render es `react-native-svg`, el mismo módulo en las tres plataformas); `src/content/tarotCatalog.ts` conserva caracteres Unicode en `correspondencia` como DATO — hoy ninguna superficie los renderiza (la landing sólo muestra correspondencias de arcanos menores, texto plano); si se muestran a futuro, derivar el glifo con `bodySymbolForName`/`signSymbolForName`. La marca de retrogradación sigue siendo `Rx` (ASCII estándar, fuera del catálogo pedido).

## Stripe Live — Gate B de cobros web (2026-08-01, Codex)

**Objetivo:** habilitar en `orbitaastrologia.xyz` la suscripción mensual Live de USD 9,99 con siete días gratis, Checkout alojado por Stripe, entitlement autoritativo por webhook y portal/cancelación, sin mezclar credenciales test/live ni cobrar durante la preparación.

**Criterios de aceptación:** producto/precio Live mensual activo y coherente; webhook Live a `https://exciting-bat-311.convex.site/webhooks/stripe` con `checkout.session.completed`, `checkout.session.expired`, `customer.subscription.updated` y `customer.subscription.deleted`; Convex producción recibe `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y `STRIPE_PRICE_MONTHLY` Live manteniendo primero `COMMERCE_MODE=off`; oferta autenticada publica USD 9,99/mes y siete días; Checkout usa `orbitaastrologia.xyz`; prueba manual con tarjeta real confirma trial, webhook, entitlement, portal y cancelación sin cobro inmediato; al cerrar la prueba se vuelve a `COMMERCE_MODE=off` hasta la decisión explícita de apertura pública.

**Ficha:** owner Codex + pasos manuales de Lucas en Stripe/tarjeta; configuración externa y corrección backend acotada para compatibilidad con la API Live actual de Stripe; riesgo alto porque habilita suscripciones y futuros cobros reales; rollout `off → secretos Live → validación → live temporal → smoke completo → cancelación → off`; rollback inmediato `COMMERCE_MODE=off` y, si fuera necesario, desactivar el Price/webhook; fuera de alcance nuevos planes, cambios de copy, app stores, RevenueCat y modificaciones fiscales no decididas.

### Resultado de Gate B

- [x] Producto Live `Órbita Plus` y precio mensual Live USD 9,99 activos; trial de siete días agregado por Checkout; Automatic Tax apagado por decisión explícita.
- [x] Webhook Live `Órbita Production Billing` activo hacia `https://exciting-bat-311.convex.site/webhooks/stripe`, limitado a los cuatro eventos contratados. El secreto expuesto accidentalmente en una captura fue rotado por Lucas y reemplazado en Convex sin volver a revelarlo.
- [x] Convex producción recibió la clave Live dedicada, el Price mensual, el secreto rotado y `WEB_APP_URL`; no se imprimió ni persistió ningún secreto.
- [x] La mención de “verificación de identidad” pertenecía a una guía genérica de Connect; no había evidencia de bloqueo de Payments y la prueba Live confirmó que la cuenta puede crear suscripciones.
- [x] Validación técnica sin tarjeta: Price Live correcto, Checkout alojado, retorno productivo, siete días y Automatic Tax `false`; la sesión se venció inmediatamente y `checkout.session.expired` llegó a Convex sin crear cliente, suscripción ni cobro.
- [x] Lucas autorizó omitir la espera de 24 horas, activar `COMMERCE_MODE=live` temporalmente, probar de punta a punta, cancelar dentro del trial y volver a `off`.
- [x] Paywall y Checkout mostraron Órbita Plus mensual, siete días gratis, USD 9,99/mes y primer cobro previsto el 8 de agosto de 2026.
- [x] Lucas completó OTP/tarjeta directamente en Stripe; Codex no leyó ni ingresó credenciales ni datos de pago.
- [x] Checkout Live terminó correctamente: total inmediato USD 0, estado `trialing`, siete días, cero PaymentIntents inmediatos y acceso `orbita_pro` concedido por webhook.
- [x] Billing Portal abrió desde Perfil, mostró la factura inicial USD 0,00 y permitió cancelar. La renovación quedó cancelada para el 8 de agosto; Stripe conserva acceso durante el trial y no realizará el cobro futuro.
- [x] La pasada Live detectó que la API Stripe `2025-11-17.clover` entrega la baja del trial en `cancel_at` y el fin de período en `items.data[].current_period_end`. El backend sólo contemplaba los campos legacy.
- [x] Se agregó `convex/lib/stripeSubscription.ts`, se ajustó `convex/payments/stripeInternal.ts` y se cubrieron ambos formatos con cuatro tests nuevos.
- [x] Fix sincronizado con Convex dev y publicado con aprobación explícita a Convex producción `exciting-bat-311`. Un webhook Live nuevo confirmó: `status=canceled`, `willRenew=false`, fin de acceso el 8 de agosto y entitlement `orbita_pro` todavía activo.
- [x] Validación posterior al rebase sobre `main` actual: suite completa **816/816**, typecheck verde, Convex dev/codegen correctos y `git diff --check` limpio.
- [x] `COMMERCE_MODE` volvió a **`off`**. CLI y web autenticada confirman que `/paywall` muestra “Órbita Plus estará disponible pronto”, sin compra; `/carta` conserva Plus durante el trial cancelado.

**Estado de cierre:** Gate B técnico completo y sin cobro: Checkout, trial, webhook, entitlement, portal y cancelación funcionaron de punta a punta. La única suscripción Live creada quedó cancelada dentro del trial, con acceso hasta el 8 de agosto y renovación desactivada. Producción está segura con `COMMERCE_MODE=off`; para abrir ventas al público sólo falta una decisión explícita de Lucas de volverlo a `live` y fusionar el ajuste backend posterior al PR #58.

## Hotfix web — Carta Free no dispara generación Plus (2026-08-01, Claude + Codex)

**Objetivo:** impedir que `CartaScreen` invoque `charts.generatePersonalityReading` cuando el estado remoto autoritativo ya es `locked` para una cuenta Free. Hoy la pantalla muestra correctamente el bloqueo, pero igualmente dispara la action Plus y genera un Server Error en producción.

**Criterios de aceptación:** una cuenta Free con `personalityReadingState.status="locked"` no llama la action de generación; conserva el CTA hacia `/paywall`; una cuenta Plus mantiene generación, reintento y lectura lista sin regresiones; no cambian contratos ni `convex/**`.

**Ficha:** owner Claude (frontend), revisión/release Codex; rama `feature/web-free-reading-hotfix` desde `origin/main` `0086eba`; territorio permitido `src/screens/CartaScreen.tsx`, pruebas focalizadas de Carta y este handoff; riesgo medio porque altera el efecto de generación de la lectura larga; pruebas focalizadas, suite completa, typecheck, export web y presupuesto de assets; rollout por PR aislado y nuevo deployment productivo sólo después de aprobación; rollback por revert del PR/deployment; fuera de alcance recálculo de carta natal, cambios de oferta/entitlements, `convex/**`, Stripe y rediseño.

**Estado inicial:** reproducido en producción con una cuenta Free: Carta pide recalcular la carta base y la consola registra `[CONVEX A(charts:generatePersonalityReading)] Server Error`. El backend rechaza correctamente la action porque la cuenta no es Plus; el defecto es que el frontend la invoca antes de respetar `locked`.

**Implementación (2026-08-01, Claude):** en `CartaLive` se deriva `const canGenerate = readingState !== undefined && readingState.status !== "locked"` de la query reactiva `charts.personalityReadingState` que la pantalla ya escuchaba. El efecto de generación abre con `if (!canGenerate) return;`: la action no se dispara mientras la señal remota está en vuelo (`undefined`) ni cuando es `locked`, y el booleano se sumó al array de dependencias (`[generate, attempt, canGenerate]`). Depender del booleano — no del status crudo — garantiza que las transiciones `pending→ready`/`pending→error` de una cuenta Plus no re-disparan la generación: el efecto solo vuelve a correr si cambia la posibilidad de generar o con el reintento explícito (`attempt`). El resto del cableado queda intacto: `readingBlockPhase` ya priorizaba `locked` → `bloqueado` (CTA a `/paywall`, sin REINTENTAR), así que aunque `generating` conserve su valor inicial con la action sin disparar, el bloque bloqueado se muestra igual; Plus mantiene montaje→generación, reintento y lectura lista sin cambios.

**Pruebas:** `test/cartaNatalCarga.test.ts` suma dos tests estructurales HOTFIX: (a) `canGenerate` con la forma exacta y el guard `if (!canGenerate) return;` dentro del efecto ANTES de `generate({})`; (b) el array de dependencias es `[generate, attempt, canGenerate]` y ningún array de dependencias del archivo contiene `readingState` crudo. La conducta de dominio (`locked` gana a `failed`/`generating` → `bloqueado`) ya estaba cubierta en `test/entitlement.test.ts` y no se duplicó.

**Validación final (2026-08-01, Codex):** test focalizado `test/cartaNatalCarga.test.ts` 24/24; suite completa 819/819; typecheck verde; export web aprobado; presupuesto aprobado (`36.17 MB / 50 MB`, imagen máxima `479.3 KB / 500 KB`, JS gzip `1.10 MB / 1.25 MB`); `git diff --check` verde. Revisión React: el cambio usa una dependencia booleana primitiva derivada durante render, evita depender del objeto reactivo crudo y mantiene el early return antes de la action; sin hallazgos adicionales.

**Archivos tocados:** `src/screens/CartaScreen.tsx` (gate `canGenerate` del efecto de generación), `test/cartaNatalCarga.test.ts` (2 tests estructurales), `CURRENT_TASK.md`.

**Estado release:** PR #59 integrado en `main` como `5b6a38d`; pendiente confirmar el deployment productivo y la pasada manual junto con el hotfix siguiente.

## Hotfix web — Carta exacta no debe quedar en recálculo infinito (2026-08-01, Claude + Codex)

**Objetivo:** hacer que Carta y Home acepten `charts.current` como la carta natal vigente autoritativa. Convex ya devuelve únicamente el cache exacto de los datos actuales; el frontend aplica además un gate heredado que exige `birthDataId`, `birthDataHash` o `payload.birth`, campos que el contrato público elimina por privacidad, y por eso una carta recalculada queda falsamente en “desactualizada”.

**Criterios de aceptación:** tras `calculateOrCreateNatalChart`, una carta no nula de `charts.current` se dibuja; si la query devuelve `null`, se conserva el estado sin carta/recalcular según corresponda; no se publican datos natales ni hashes serializados; Carta y Home usan la misma autoridad; tests de regresión cubren el contrato; no cambia `convex/**`.

**Ficha:** owner Claude (frontend), revisión/release Codex; rama `feature/web-chart-current-gate-hotfix` desde `origin/main` `0086eba`; territorio permitido `src/domain/natalChartGate.ts`, sus consumidores Carta/Home, tests focalizados y este handoff; riesgo medio porque cambia el gate previo a dibujar la rueda; tests focalizados, suite completa, typecheck, export web y presupuesto; rollout por PR aislado y deployment productivo sólo tras aprobación; rollback por revert del PR/deployment; fuera de alcance lectura Plus/Free (PR #59), contratos Convex, Stripe, edición natal y rediseño.

**Evidencia producción:** el clic llegó a `charts.calculateOrCreateNatalChart` y la action terminó correctamente. `charts.current` volvió a consultar la carta exacta. La pantalla siguió mostrando recálculo porque `personalChartGate` exige una prueba de identidad que `publicChartDocument` omite deliberadamente. Exponer `birthDataHash` no es opción: hoy es una serialización de fecha, hora, lugar, coordenadas y timezone, no un digest opaco.

**Implementación (2026-08-01, Claude):** `personalChartGate` ahora trata `charts.current` como autoritativo: `undefined` en cualquiera de las dos queries = `cargando`; datos natales incompletos = `datosIncompletos`; `chart === null` = `sinCarta`; **toda carta no nula = `listo`**, sin re-verificar correspondencia en el cliente. Se eliminaron del módulo `chartMatchesBirthData`, `birthDataHash` y los helpers de eco/normalización (ningún otro caller productivo los usaba; su único consumidor externo era el propio test). El miembro `"desactualizada"` queda en el union como legado documentado —el gate ya no lo devuelve— para que las ramas defensivas de `CartaScreen`, `CartaCard`, `carta-full` y `reading/rueda` sigan typecheckeando sin tocar esas superficies. `ChartDoc` quedó reducido al contrato público sanitizado (`{ payload?: unknown } | null`). Comentarios del módulo reescritos: sin fallback backend, sin hash replicado (que además serializaba datos natales).

**Regresiones (`test/natalChartGate.test.ts`):** se reescribió con un `PUBLIC_CHART` sanitizado (sin `birthDataId`/`birthDataHash`/`payload.birth`): carta pública no nula = `listo` (incluye variantes sin payload); editar los datos natales NO degrada una carta no nula (el cliente no duda de `charts.current`); nuevo test estructural que prohíbe que el gate vuelva a usar `birthDataHash`/`chartMatchesBirthData`; se eliminaron los tests de matching/hash (incluida la réplica del hash que leía `convex/lib/birthDataConsistency.ts`); los tests de cableado (gate antes de mapear, única fuente `charts.current`, recálculo idempotente) se conservan, quitando sólo la exigencia de la rama `"desactualizada"` en Carta/Home.

**Archivos tocados:** `src/domain/natalChartGate.ts`, `test/natalChartGate.test.ts`, `CURRENT_TASK.md`. Sin cambios en `convex/**` ni en las superficies consumidoras.

**Validación final (2026-08-01, Codex):** test focalizado 12/12; suite completa 810/810; typecheck verde; export web aprobado; presupuesto aprobado (`36.17 MB / 50 MB`, imagen máxima `479.3 KB / 500 KB`, JS gzip `1.10 MB / 1.25 MB`); `git diff --check` verde. La regresión reproduce la forma pública real sin ids/hash/eco y confirma `listo`.

**Siguiente paso:** PR #60 rebasado sobre `main`; merge + deployment productivo y pasada manual de Carta después de checks remotos. Producción todavía muestra el recálculo infinito hasta desplegar este hotfix.

## Web pública v2 — hero: la carta astral base, dicha en el primer pantallazo (2026-08-01, Claude)

**Objetivo:** corrección acotada de mensaje sobre el mismo PR #57 (`feature/web-public-entry-v2`, misma rama, se actualiza, no se abre otro), por feedback de usuario: la landing sobre-indexaba en el tarot diario y no decía en el hero que la carta astral es fundacional. Sin tocar titular, layout, abanico de 7, CTAs, anclas, rutas, secciones, assets ni responsive.

**Decisión de producto (user-facing):** el hero suma una línea de valor visualmente contenida, con esta copy exacta — etiqueta `TU CARTA ASTRAL BASE, INCLUIDA AL EMPEZAR` + apoyo `Sol, Luna y ascendente: el mapa personal que da contexto a tu tarot diario y a los tránsitos.` Se dice "base" y se nombra la tríada a propósito: **no** se promete la carta natal completa gratis — casas, aspectos y lecturas siguen siendo Plus (coherente con los paneles Gratis/Plus de la misma página).

**Implementación:** bloque `heroBase` DEBAJO del row de CTAs en la columna de copy del hero — así el CTA primario no baja ni un pixel y sigue en el primer viewport a 390×844 (ya validado en la pasada anterior; esta línea sólo agrega contenido debajo). Hairline superior (`colors.hairline`), etiqueta en Roboto Mono cobre 11/`letterSpacing: 1` (mismo trato que `eyebrow`/`cardCaption`) y apoyo en Inter 14/21 `boneMuted` con `maxWidth: 560`: tokens y tipografías ya existentes, integrado a la columna, no un card nuevo. Cero estilos de color/fuente nuevos, cero assets.

**Test:** `test/webPublicEntry.test.ts` suma «el hero declara la carta astral base, debajo del CTA y sin regalar la completa»: copy exacta presente una sola vez dentro del bloque del hero, posicionada después de `<EmpezarCta` (guarda de que no empuja el CTA), y `doesNotMatch(/carta natal completa/i)` en el hero. Los invariantes de conversión existentes no cambian.

**Validación (2026-08-01, Codex):** `pnpm typecheck` pasó; suite completa **812/812**; `pnpm build:web` pasó; `pnpm check:web-export` pasó con 36,17 MB totales, imagen máxima 479,3 KB y JS gzip 1,10 MB; `git diff --check` limpio. Revisión visual en navegador a 390×844 y 1440×900: CTA principal visible dentro del primer viewport, bloque de carta astral inmediatamente debajo de los CTA, sin colisiones ni cambios en el abanico. La etiqueta aparece exactamente una vez y los cuatro CTA, el único login y la promesa Free/Plus conservan sus invariantes.

**Archivos tocados:** `src/components/web/orbita-landing.tsx` (bloque `heroBase` + 3 estilos), `test/webPublicEntry.test.ts` (un test nuevo), `CURRENT_TASK.md`.

**Sin commit, push, deploy.** Producción intacta.

## Web pública v2 — corrección final: entrada web sin portada + landing con mazo real (2026-07-31, Claude)

**Objetivo:** cerrar el PR #57 (`feature/web-public-entry-v2`) con la corrección final acordada: (a) el flujo web normal `/` → `/empezar` monta **AlignScreen de inmediato** (CTA `Empezar el viaje`) y nunca la portada nativa (SplashScreen: video de intro + "Órbita · Tu cielo, todos los días"); (b) la landing extiende los dos fondos orbitales ya aprobados a TODA la página, muestra en el hero un abanico de cartas reales del mazo en lugar de La Luna, y suma la sección "El mazo de Órbita" con 16 cartas y la mención explícita del mazo completo de 78. Nativo, auth, Convex, rutas y pasos 2–15 intactos.

**Ficha:** owner Claude (frontend), revisión/release Codex; misma rama/PR (`feature/web-public-entry-v2` → PR #57, se actualiza, no se abre otro); territorio `src/onboarding/OnboardingFlow.tsx` (sólo la entrada por plataforma), `src/components/web/orbita-landing.tsx`, `test/webPublicEntry.test.ts` (nuevo) y este handoff; riesgo medio (superficie pública + el arranque del alta web); rollout un PR aislado sin deploy; rollback revert; fuera de alcance `convex/**`, pagos, APIs, rutas, conducta nativa (más allá de preservarla), onboarding pasos 2–15, assets nuevos y producción.

**Decisiones:**
1. **Entrada por plataforma en el flujo canónico, sin flujo web aparte.** `ENTRY_STEP = IS_WEB ? 1 : 0` en `OnboardingFlow.tsx`: la web entra por AlignScreen y el nativo conserva su paso 0 (SplashScreen) intacto. Un borrador web persistido en el paso 0 (versión anterior) se **normaliza al paso 1** al restaurarse (`normalizeEntryStep`). Los saltos de sesión activa y `resume=datos` comparan contra `ENTRY_STEP` (antes `0` literal): sin esto, en web una cuenta incompleta se quedaba mirando AlignScreen en vez de seguir en la fecha.
2. **Volver desde el paso 1 web regresa a `/`** (`router.replace("/")`): en web el paso 1 ES la entrada, no hay portada abajo. En nativo y en inspección el back no cambia. `debugStep=0` sigue montando la portada, pero SOLO por `resolveDebugStep` (herramientas internas, sólo lectura) — es la única puerta al paso 0 en web.
3. **Fondo orbital de la landing = los MISMOS derivados aprobados de la entrada** (`entryBackground`: panorámico 2560×1440 en escritorio, vertical 1170×2532 en móvil), montados como capa fija al viewport detrás del ScrollView con `resizeMode="cover"` (recorta, no estira) + scrim `rgba(7,8,10,0.74)`. El ScrollView quedó transparente: sin fondos sólidos por sección no hay cortes y las transiciones son continuas. Cero assets nuevos.
4. **Hero: abanico accesible de 7 piezas** — cinco cartas reales (La Estrella, El Mago, El Sol, As de Copas, Reina de Bastos) + los dos dorsos del repo (mandala y órbitas). Para un lector de pantalla es UNA imagen (contenedor `accessibilityRole="image"` con nombre; las cartas solapadas ocultas del árbol). El ancho del abanico se calcula del espacio disponible: no desborda a 320 ni se agranda de más a 1440. **La ilustración de La Luna aparece UNA sola vez en la página, en la lectura editorial**; el hero cierra con "HOY · UNA CARTA DEL MAZO DE 78".
5. **Sección "El mazo de Órbita"** (entre el ejemplo editorial y Cómo funciona, sin ancla nueva en el header): fila horizontal accesible (`role="list"`/`listitem`, indicador de scroll visible, nombre visible por carta + meta en Roboto Mono) con 16 cartas — 8 Arcanos Mayores (sin La Luna) y 2 por cada palo (Bastos, Copas, Espadas, Oros) — y el copy dice explícitamente "un mazo completo de 78 cartas… los 22 Arcanos Mayores y los 56 Arcanos Menores". Las 78 ilustraciones ya estaban bundleadas por `tarotDeck.ts`, así que la sección no agrega peso de export.
6. **Invariantes de conversión conservados:** exactamente UN "Ya tengo cuenta" (header), los 4 `EmpezarCta` (`Empezar gratis`) en hero/ejemplo/cómo-funciona/cierre, las 3 anclas, paneles Gratis/Plus sin precios y los enlaces legales `/privacy` `/terminos` `/support`.

**Archivos tocados:** `src/onboarding/OnboardingFlow.tsx` (entrada por plataforma: `ENTRY_STEP`, `normalizeEntryStep`, `back` web→`/`, saltos vs `ENTRY_STEP`), `src/components/web/orbita-landing.tsx` (fondo fijo + scrim, abanico `CardFan`, sección "El mazo de Órbita", La Luna una sola vez), `test/webPublicEntry.test.ts` (nuevo: 8 tests estructurales de estos invariantes), `CURRENT_TASK.md`.

**Validación final de Codex:** `git diff --check` limpio; `pnpm typecheck` en verde; suite completa **811/811**; `pnpm build:web` correcto; `pnpm check:web-export` en verde — **36,17 MB** totales, imagen máxima **479,3 KB** y JavaScript de aplicación **1,10 MB gzip**. Pasada visual y funcional en 390×844 y 1440×900, más controles de desborde a 320, 768, 900, 1024 y 1920 px: sin desborde horizontal, cortes blancos ni colisiones. `/` → `/empezar` muestra inmediatamente `Alineate con el ritmo del universo`; la flecha vuelve a `/`; el splash no aparece en el recorrido web normal. El reporte completo está en `design-qa.md` con resultado `passed`.

**Sin deploy.** Producción intacta.

## Web pública v2 — landing W1 + portada responsive de /empezar (2026-07-31, Claude)

**Objetivo:** reemplazar el recorrido público `/` → `/empezar`: reconstruir la landing entera según WEB V1/W1 (Figma `767:2` escritorio, `770:2` móvil) con el ritual de La Luna aprobado (`727:127`) como pieza editorial central, y cambiar SÓLO el fondo de la primera pantalla web de `/empezar` por las dos composiciones elegidas directamente por Lucas. Pasos 2–15, nativo, auth, Convex y rutas quedan intactos. PR #56 (`codex/web-hero-background-v2`) queda superseded: no se cherry-pickeó nada.

**Ficha:** owner Claude (frontend), revisión/release Codex; rama `feature/web-public-entry-v2` sobre `origin/main` `8d542a1`, worktree limpio `.worktrees/orbita-public-entry-v2`; territorio `src/components/web/orbita-landing.tsx`, `src/onboarding/screens/SplashScreen.tsx`, `src/onboarding/entryBackground{,.web}.ts`, `src/content/plusBenefits.ts`, `src/components/web/orbita-paywall.tsx` (sólo la extracción de beneficios), `assets/orbita/web-entry/**`, `assets/orbita/optimized/web-entry/**` y este handoff; riesgo medio (superficie pública de captación; cero contratos backend); rollout un PR aislado sin deploy; rollback revert del PR; fuera de alcance `convex/**`, Clerk/Convex, pagos, precios, onboarding pasos 2–15, conducta nativa, deploy y producción.

**Decisiones:**
1. **Fondos de entrada seleccionados por Lucas:** desktop usa la composición con espacio negativo a la izquierda y planeta/orbitas cobre abajo a la derecha; mobile usa la composición simétrica con cuerpo celeste centrado arriba. Se recortó únicamente la interfaz del visor de las capturas entregadas y se generaron masters/derivados específicos por breakpoint. Los candidatos generados anteriormente quedan como referencia en `rejected/`. Ningún master es dependencia runtime.
2. **Seam por plataforma** `src/onboarding/entryBackground.ts` (nativo → `A.splashBg` de siempre) + `entryBackground.web.ts` (web → derivado por breakpoint vía `useIsDesktop`, que ya estaba en el splash). El bundle nativo no carga los fondos web y el PNG 393×852 ya no se estira en escritorio.
3. **Landing tipográfica W1**, no foto gigante: header con el emblema real (`orbita_app_icon_web.png`, mismo tratamiento que `web-nav.tsx`) + anclas (`Cómo funciona`, `Tu carta de hoy`, `Qué incluye`, ocultas <760) + ÚNICO `Ya tengo cuenta` → `/iniciar-sesion`; hero escritorio copy izquierda / carta real derecha (arte `major_18_la_luna.jpg` del mazo, ratio 603×900), móvil copy+CTA primero (CTA en el primer viewport) y carta debajo; título y bajada del brief; `Ver una lectura` scrollea al ejemplo.
4. **Ritual de muestra hardcodeado a propósito** (la landing es pública: no hay ni puede haber API de lecturas personalizadas): versión abreviada fiel del nodo `727:127` con el orden canónico de `RitualReading` (esencia → SIGNIFICADO GENERAL → EN TU DÍA → EL CONSEJO → cierre), etiquetas en Roboto Mono cobre como el producto. El remate "PREGUNTALE AL UMBRAL ›" es texto de la muestra, no un control muerto.
5. **Free/Plus sin precios:** los cinco beneficios Plus son copy LOCAL de la landing que espeja los `BENEFITS` del paywall sin importarlos (revisión Codex: el paywall queda 100% fuera de este PR; su archivo está byte-idéntico a `main`). Panel Gratis derivado del producto real (ritual completo, tríada, tres preguntas de Umbral, Diario de siete días) y nota explícita de que la carta diaria sigue gratis.
6. **Anclas por `scrollTo`** con posiciones medidas por `onLayout` (las secciones son hijas directas del ScrollView), más `id` en el DOM; headings semánticos (`role="heading"` + `aria-level` 1/2/3), foco visible del CSS global, targets ≥44px, un solo H1.

**Validación al momento de este handoff:**
- `pnpm typecheck` **en verde** (corrido en la pasada de revisión de Codex sobre este worktree).
- Invariantes verificados sobre el código: exactamente UNA aparición de texto de "Ya tengo cuenta" en `/` (header); un solo `EmpezarCta` definido y montado 4 veces (hero, tras el ejemplo, tras Cómo funciona, cierre), siempre `href="/empezar"`; logo → `/`; `Ver una lectura` → scroll al ejemplo de La Luna; footer → `/privacy`, `/terminos`, `/support`; regex de los tests estructurales (`accountDestination`, `parityFoundations`, `responsiveShells`, `onboardingLaunch`) chequeados a mano contra los archivos nuevos.
- Suite completa **803/803**, typecheck, export web y presupuesto de assets ya estaban verdes antes del reemplazo final de imágenes. Después del reemplazo literal se volvió a ejecutar el export web y `pnpm check:web-export`: **35,99 MB**, imagen runtime máxima **479,3 KB**, JS gzip **1,09 MB**.
- Verificación visual final de `/empezar`: desktop 1440×900 usa el fondo panorámico con el contenido legible en el espacio negativo; mobile 390×844 usa el cuerpo celeste centrado, CTA y login visibles, sin desborde horizontal ni errores de consola.

**Derivados WebP definitivos (cerrado):** generados desde las dos imágenes elegidas por Lucas y verificados por inspección visual:
- `assets/orbita/optimized/web-entry/entry_bg_desktop.webp` — **2560×1440, 80.104 bytes**.
- `assets/orbita/optimized/web-entry/entry_bg_mobile.webp` — **1170×2532, 42.866 bytes**.
Los dos requires de `src/onboarding/entryBackground.web.ts` apuntan a los `.webp`; los PNG interinos de `optimized/web-entry/` fueron eliminados y el TODO quitado. Ambos derivados quedan lejos del límite de 500 KB por imagen del gate.

**Archivos tocados (alcance final, ya sin paywall):** `src/components/web/orbita-landing.tsx` (reescritura completa), `src/onboarding/screens/SplashScreen.tsx` (sólo el `bg` de la entrada), `src/onboarding/entryBackground.ts` + `entryBackground.web.ts` (nuevos), `assets/orbita/web-entry/{selected,rejected}/*.png` (masters, 4 archivos), `assets/orbita/optimized/web-entry/entry_bg_{desktop,mobile}.webp` (runtime), `CURRENT_TASK.md`.

**Sin commit, push, PR ni deploy.** Producción intacta.
## Web Plus — oferta única mensual con 7 días de prueba completa (2026-08-01, Claude + Codex)

**Objetivo:** un solo plan de suscripción mensual de Stripe, con 7 días de prueba con acceso completo —incluida la carta natal y el Tarot diario— y renovación mensual automática salvo cancelación. La divulgación del paywall promete explícitamente que cancelar antes de que termine la prueba no genera ningún cobro, con los días dinámicos del plan y el precio siempre desde Stripe (nunca hardcodeado).

**Ficha:** owner Claude (frontend) / Codex (backend); territorio `convex/payments/**`, `convex/lib/stripeApi.ts`, contrato de suscripciones, `.env.example`, `src/components/web/orbita-paywall.tsx`, `src/components/web/orbita-legal.tsx`, `src/domain/paywall.ts`, referencias tipadas, pruebas focalizadas y este handoff. Riesgo alto por tocar Checkout, trial, webhooks y entitlement; validación: typecheck, suite completa, export web, presupuesto de assets y pasada integrada con Stripe test. Rollout sólo en modo test — producción mantiene `COMMERCE_MODE=off`; rollback por revert y `COMMERCE_MODE=off`; fuera de alcance compras one-time, nuevos checkouts semanal/anual, publicación y promoción productiva.

### QA integrado final — 2026-08-01 14:08 ART

- La descripción del producto en Stripe Test fue corregida y un Checkout nuevo mostró `Suscripción Mensual`, junto con `7 days free`, `$9.99 per month` y primer cobro simulado el 8 de agosto de 2026.
- Se completó Checkout en Sandbox con la tarjeta oficial de prueba `4242`; Stripe creó la suscripción/trial y una factura de `$0.00`. No hubo cobro real, tarjeta real ni cambio de producción.
- Convex dev recibió `POST /webhooks/stripe` con HTTP `200`; `payments/stripeInternal:dispatchStripeEvent` procesó el evento y `subscriptions:getCurrent` pasó a devolver la suscripción. Perfil mostró `GESTIONAR SUSCRIPCIÓN`, confirmando el entitlement Plus.
- El Customer Portal abrió correctamente y mostró Órbita Plus, `$9.99 per month`, trial hasta el 8 de agosto y la tarjeta test. La cancelación se completó desde el portal: ahora figura `Cancels Aug 8` y confirma que el servicio dejará de estar disponible al finalizar la prueba, sin renovación.
- Convex dev recibió y procesó también los webhooks de cancelación con HTTP `200`. El acceso Plus permanece activo hasta el final del trial, que es la conducta esperada.
- Detalle de infraestructura observado: el `success_url` de este entorno apunta al preview protegido de Vercel y, tras Checkout, redirige al login de Vercel. No afectó Checkout, webhook, entitlement, portal ni cancelación; la pantalla de éxito del preview no pudo validarse visualmente. Antes de activar live, la URL de retorno debe ser el dominio público no protegido.
- Gates de código previos siguen vigentes: typecheck, suite completa **808/808**, export web y presupuesto de assets en verde. Producción continúa con comercio apagado y no fue modificada.
- PR #58 ya completó la pasada integrada de Stripe Test. Puede pasar de draft a listo para revisión técnica, manteniendo fuera de alcance cualquier promoción productiva.

### Handoff final — 2026-08-01 12:30 ART

- Rama/worktree: `codex/web-offer-v2` en `.worktrees/orbita-web-offer-v2`, limpia.
- Commits: `e753cc2` (contrato backend mensual + prueba) y `91b499c` (presentación frontend/legal).
- PR draft: [#58](https://github.com/lucaszram/orbita/pull/58). La rama remota está publicada; no se mergeó ni se desplegó producción.
- Convex dev `dutiful-viper-815` fue sincronizado con esta rama mediante `convex dev --once`. Producción no se tocó.
- Configuración dev confirmada por comportamiento integrado: `COMMERCE_MODE=test` y `STRIPE_PRICE_MONTHLY` apuntan al nuevo precio mensual de Stripe Test.
- Paywall autenticada verificada en navegador: `Órbita Plus mensual`, `7 días gratis`, `US$ 9,99 por mes`, acceso completo durante la prueba (carta natal + Tarot diario), divulgación de cancelación y enlaces legales. Sin errores de consola del build vigente.
- Checkout de Stripe Test abierto sin confirmar compra: muestra `Try Órbita Plus`, `7 days free`, luego `$9.99 per month`, y fecha de primer cobro siete días después. No se ingresó tarjeta ni se creó suscripción.
- Hallazgo de configuración en Stripe Test: la descripción del producto todavía dice “Suscripción semanal o anual”. Lucas debe editar solamente esa descripción a mensual antes del QA final/productivo. El título `Órbita Plus`, el precio y el trial ya son correctos.
- Validación de código ya verde: typecheck, suite completa **808/808**, export web y presupuesto (35,87 MB total; imagen máxima 479,3 KB; JS 1,09 MB gzip).
- Próximo paso recomendado: corregir la descripción del producto en Stripe Test, volver a abrir Checkout para una confirmación visual rápida y después decidir si PR #58 pasa de draft a listo para revisión. La prueba completa con tarjeta Stripe Test/webhook queda para esa siguiente conversación.
- Gate de producción: mantener `COMMERCE_MODE=off`; todavía no cargar precios/secretos live ni promover Vercel. La activación live requiere aprobación explícita de Lucas y una pasada completa de checkout, webhook, entitlement, portal y cancelación.

## Web Plus — mensaje preciso al bloquear una compra repetida (2026-07-31, Claude + Codex)

**Objetivo:** cuando Stripe Checkout no se abre porque la cuenta ya tiene Órbita Plus, mostrar una explicación accionable y enviar a Perfil; conservar el mensaje genérico para fallas de red o errores desconocidos.

**Ficha:** owner Claude (frontend), revisión/release Codex; rama `feature/web-plus-checkout-errors`; territorio `src/components/web/orbita-paywall.tsx`, `src/domain/paywall.ts`, `test/paywall.test.ts` y este handoff; riesgo bajo porque no cambia contratos, precios, Stripe, backend ni el estado de la suscripción; rollout por PR aislado, sin deploy; rollback por revert; fuera de alcance producción, Convex, configuración de Stripe, onboarding y rediseño del paywall.

**Qué cambió:** `checkoutStartErrorKind` reconoce tanto el error exacto `This account already has Plus access` como el mismo texto envuelto por Convex. El paywall muestra “Ya tenés Órbita Plus. Podés gestionar tu suscripción desde Perfil.” y enlaza Perfil. Cualquier otro valor mantiene “No pudimos abrir el pago. Probá de nuevo.” Cuatro pruebas cubren el error exacto, el envuelto, errores desconocidos y valores que no son `Error`.

**Validación:** `git diff --check` limpio; `pnpm typecheck` en verde; suite completa **803/803**; `pnpm build:web` correcto; `pnpm check:web-export` en verde — 35,87 MB totales, imagen máxima 479,3 KB y JavaScript de aplicación 1,09 MB gzip. Sin commit, push, PR, deploy ni cambios de producción al momento de este handoff.

## Web standalone — nav de escritorio en Paywall y páginas legales (2026-07-31, Claude)

**Objetivo:** que `/paywall`, `/support`, `/privacy` y `/terminos` muestren la barra de navegación de escritorio en viewports anchos, igual que el resto de la app y que `/iniciar-sesion`/`/editar-datos`. Estas cuatro pantallas montan `WebNav` fuera de `WebAppShell` (son standalone), y `WebNav` decide topbar vs. barra inferior con `useIsDesktop()`, que lee `LayoutModeContext` — cuyo default es `"mobile"` cuando no hay ningún `WebLayoutProvider` en el árbol. Sin el provider, esas cuatro pantallas quedaban condenadas a la barra móvil sin importar el ancho de la ventana.

**Ficha:** owner Claude (frontend); territorio `src/components/web/orbita-paywall.tsx`, `src/components/web/orbita-legal.tsx`, `test/paywall.test.ts`, `test/legalSurface.test.ts`, `CURRENT_TASK.md`; rama `feature/web-standalone-nav-responsive`; riesgo bajo (un solo wrapper de contexto, sin tocar lógica, copy, precios ni rutas); pruebas: tests estructurales focalizados + typecheck + suite completa + `pnpm build:web`; rollout: PR aislado, sin deploy; rollback: revertir el PR; fuera de alcance `convex/**`, comportamiento de pagos/precios, rutas, copy, onboarding, pantallas autenticadas, assets y conducta nativa.

**Qué cambió:** ambos archivos ya traían el fix aplicado al retomar esta tarea — se revisó por correctividad y minimalidad, no se reescribió. `OrbitaPaywall` envuelve `<RequireSession><PaywallWithBackend /></RequireSession>` en `<WebLayoutProvider>`; `LegalShell` (el shell común de Soporte/Privacidad/Términos) envuelve su `<View style={styles.page}>` en el mismo provider, después del gate de fuentes cargadas. Mismo patrón exacto que `/iniciar-sesion` y `/editar-datos`, incluido el comentario que explica el motivo. Se agregaron tests estructurales en `test/paywall.test.ts` y `test/legalSurface.test.ts` que verifican que el provider envuelve el árbol que monta `WebNav` y que hay exactamente un `WebLayoutProvider` por pantalla (evita duplicarlo si alguien vuelve a tocar el archivo).

**Estado:** cambios completos y validados en el worktree, sin commitear. `pnpm typecheck` pasó sin errores; la suite completa pasó 799/799; `pnpm build:web` exportó correctamente; y `pnpm check:web-export` confirmó 35,87 MB totales, imagen máxima de 479,3 KB y JavaScript de aplicación de 1,09 MB gzip, todos dentro de los límites. Verificación visual completada en 390×844 y 1440×900: Paywall y Términos usan barra inferior mobile por debajo de 900 px, barra superior desktop desde 900 px, no tienen desborde horizontal y conservan contenido, precios y enlaces legales. Listo para commit y PR.

**Objetivo:** alinear la oferta web y Stripe Checkout sobre una única prueba anual de tres días; el plan semanal no ofrece prueba.

**Criterios de aceptación:** `getWebOffer` devuelve `trialDays: 3` para anual y `0` para semanal; Checkout envía `trial_period_days=3` sólo para anual; una sola constante evita divergencias; no cambian schema ni firmas públicas.

**Ficha:** owner Codex; rama `codex/web-plus-trial`; territorio `convex/**`, tests y documentación contractual; base `origin/main` en `791d867`; cambio de contrato: no; riesgo alto por tocar la oferta y la creación de pagos; pruebas unitarias, suite completa, typecheck y diff check; rollout únicamente con Stripe test y preview integrado, manteniendo producción en `COMMERCE_MODE=off`; rollback por revert del PR o comercio apagado; fuera de alcance frontend, precios hardcodeados, credenciales, deploy y activación live.

**Estado:** implementación backend integrada en PR #51. `ANNUAL_TRIAL_DAYS = 3` alimenta tanto la oferta como Checkout; semanal permanece sin prueba. La auditoría confirmó que el backend ya bloquea compras repetidas, valida sesión/customer, espera el webhook para confirmar Plus y deduplica eventos. Typecheck, prueba Stripe 6/6, suite completa 793/793 y `git diff --check` están verdes. Sin codegen porque no cambian schema, bindings ni firmas públicas. Producción no fue tocada.

## Carta — CTA a Plus cuando la lectura de personalidad está bloqueada (2026-07-31, Claude)

**Objetivo:** cuando el `personalityReadingState` autoritativo del backend está `bloqueado` para una cuenta Free, Carta conserva visible la rueda natal Free, la tríada y las posiciones, y agrega un CTA hacia `/paywall`; los errores genuinos de generación siguen ofreciendo REINTENTAR. No confundir un plan bloqueado con un error transitorio, y no ocultar contenido Free de Carta.

**Ficha:** owner Claude (frontend); territorio `src/screens/CartaScreen.tsx`, `test/cartaNatalCarga.test.ts`, `CURRENT_TASK.md`; riesgo: confundir el bloqueo de plan con un error transitorio, u ocultar contenido Free de Carta; rollout: un PR frontend aislado, sin deploy; rollback: revertir ese PR; fuera de alcance `convex/**`/backend, precios, comportamiento de Stripe/checkout, rediseño del paywall, onboarding, otras pantallas, environment/config, deploy y producción.

**Qué cambió:** en `CartaScreen.tsx`, la rama `readingPhase === "bloqueado"` de la lectura de personalidad muestra el CTA `router.push("/paywall")` en vez de REINTENTAR, manteniendo intactas la rueda natal, la tríada y las posiciones Free alrededor. La rama de error real conserva `<Pill label="REINTENTAR" onPress={onRetryReading} />` sin ningún camino a `/paywall`. `test/cartaNatalCarga.test.ts` cubre ambas ramas de forma estructural: confirma el CTA correcto en cada una y confirma la ausencia del otro (ningún `Pill label="REINTENTAR"` en la rama bloqueada, ningún `/paywall` en la rama de error), con slices de texto que delimitan exactamente cada rama JSX sin capturar comentarios ni la rama vecina.

**Validación (Codex):** test focalizado 22/22; `pnpm typecheck` en verde; suite completa **795/795**; `pnpm build:web` en verde; `pnpm check:web-export` en verde — 35.87 MB de export total, imagen más grande 479.3 KB, JS de aplicación 1.09 MB gzip; `git diff --check` limpio. Producción y todos los servicios externos permanecen intactos.

## Web launch — public preparation and validation CI (2026-07-31, Codex + Claude)

**Objective:** make the public web surface truthful and launch-ready, and add validation-only CI, without changing payment behavior, backend contracts, native behavior, or production state.

**Acceptance criteria:** Support states that an account is required and that account deletion is available from Profile; `soporte@orbitaastrologia.xyz` is the support contact across Support, Privacy, Terms, and the paywall; `/terminos` covers automatic renewal, yearly three-day trial, weekly without trial, cancellation from Profile, access through the paid period, applicable-law refunds, and entertainment framing; Privacy explicitly identifies Clerk/Google, Convex, and Stripe; the paywall visibly links to Privacy, Terms, and support; web metadata uses Spanish, the production canonical, and an accurate description; `.env.example` documents Google Auth, Clerk/Convex web configuration, and disabled internal tools; CI performs a frozen install, typecheck, at least 745 tests, web export, and export-size validation without deploying anything.

**Task brief:** Claude owns public frontend/copy and web metadata; Codex owns CI/release review, validation, PR, and merge. Allowed territory: `app/terminos.tsx`, `app/+html.tsx` or the smallest equivalent metadata surface, `src/components/web/orbita-legal.tsx`, `src/components/web/orbita-paywall.tsx`, `.env.example`, `.github/workflows/**`, focused scripts/tests, package scripts, and this handoff. Base is clean `origin/main` at `26ce5bc` on `codex/web-public-prep`. Risk is medium because legal copy, metadata, and CI gates are launch-critical. Tests: typecheck, full suite with a 745-test minimum, web export, export budgets, diff check, and browser review of Support, Privacy, Terms, and paywall links at mobile and desktop widths. Rollout: one isolated PR and branch preview only; production promotion remains manual and forbidden in this task. Rollback: revert the PR. Out of scope: `convex/**`, Stripe/commerce behavior, enabling the onboarding paywall, changing prices, Clerk dashboard configuration, Figma, redesign, native publication, environment mutation, deployment, or production promotion.

**Status:** implemented in the worktree, uncommitted. Production, Convex, Stripe, Clerk, and Vercel remain untouched.

**Implemented:**
1. **Support** (`src/components/web/orbita-legal.tsx`) now states that an account is required, sends account deletion to Profile (“Eliminar mi cuenta”), and frames the mailbox as a help path rather than the deletion mechanism. A cancellation FAQ links to the new Terms.
2. **One published support address.** `src/domain/support.ts` holds `soporte@orbitaastrologia.xyz`; Support, Privacy, Terms, and the paywall all read it. The personal Gmail is gone from the public surface (it remains, correctly, in the backoffice allowlist).
3. **`/terminos`** (`app/terminos.tsx` + `OrbitaTerms`) reuses the existing legal shell and covers automatic renewal, the yearly three-day trial, the weekly plan without trial, cancellation from Profile, access through the end of the paid period, refunds under applicable law, and the entertainment/self-knowledge framing with no guaranteed prediction. It was already whitelisted in `PUBLIC_WEB_ROUTES`.
4. **Privacy** names Clerk (auth), Google (only if you sign in with Google), Convex (backend/data), Stripe (web payments), and Apple (distribution), and states that deletion happens from Profile.
5. **Paywall** shows a legal block —Privacidad · Términos y condiciones + the support address— inside `Shell`, so it renders in every phase, including the current “próximamente” state with commerce off. Prices, plan selection, and checkout are untouched.
6. **`.env.example`** documents the public web Convex/Clerk variables, `EXPO_PUBLIC_ORBITA_GOOGLE_AUTH`, and that internal tools stay absent/disabled in public production.
7. **Web document**: `expo.web.lang/name/description` in `app.json` plus `public/index.html` (Expo's own template plus a canonical link). With `output: single`, `app/+html.tsx` is dead code — Expo builds `index.html` from the config template, so this is the smallest implementation that works. Native is untouched (`public/` is web-only).

**CI:** `.github/workflows/validate.yml` runs frozen install → typecheck → suite → test-count floor → web export → export budgets. No Vercel, EAS, Convex, or production step. The suite runs once and `scripts/check-test-count.mjs` judges its output (≥745 passing, zero failures, and a missing summary counts as failure).

**Gotcha found while implementing:** Expo fills the HTML template with one `String.replace` per placeholder, so naming a placeholder in a comment eats the substitution and the site ships with the literal in `<html lang>`/`<title>`. It happened; `test/webDocument.test.ts` now guards it.

**Open decision (blocks charging, not this PR):** the Terms announce a **three-day** yearly trial per the brief, but `convex/lib/stripeApi.ts:56` sends `trial_period_days: 7`. Either the backend or the copy has to change before commerce is enabled.

**Validation:** `pnpm typecheck` green; suite **793/793** (764 before this task; 29 new across `test/legalSurface.test.ts`, `test/webDocument.test.ts`, and `test/testCountGate.test.ts`); `pnpm check:test-count` green; `pnpm build:web` green; `pnpm check:web-export` green (35.87 MB, largest image 479.3 KB, app JS 1.09 MB gzip); `git diff --check` clean. Browser pass over the built export at 375 and 1440: Support, Privacy, and Terms render with no horizontal overflow and no console errors. The paywall legal block was **not** verified with a live session (the local export has no Convex/Clerk) — it needs Lucas's manual pass.

## Web launch — runtime asset optimization (2026-07-31, Codex + Claude)

**Objective:** reduce the production web export below 50 MB by replacing every heavyweight runtime image with a visually equivalent optimized derivative, without changing product behavior, copy, layouts, backend contracts, or native source assets.

**Acceptance criteria:** all raw PNG inputs remain untouched; the 13 heavyweight product images still imported from `assets/orbita/core/**` and `assets/orbita/higgsfield/archive-10/**` use derivatives under `assets/orbita/optimized/**`; the web icon is also emitted below the runtime image limit without overwriting the native icon; no emitted runtime image exceeds 500 KB; the complete `dist` export is at most 50 MB; the compressed application JavaScript remains at most 1.25 MB; a reproducible check enforces those limits; typecheck, the full test suite, web export, and visual checks of onboarding, Home, Carta, Tránsitos, and the landing are green on mobile and desktop.

**Task brief:** Claude owns frontend and assets (`app/**`, `src/**`, `assets/orbita/optimized/**`, and only indispensable web/config/test scripts); Codex owns scope, review, validation, PR, and merge. Allowed territory is optimized derivatives, runtime asset maps/imports, web-specific icon configuration, package scripts, size-check code/tests, and this handoff. Risk is medium because compression or import mistakes can cause visible regressions or missing images. Rollout is one isolated PR merged to `main` with production auto-deploy still disabled; rollback is reverting that PR. Out of scope: `convex/**`, payments, legal copy, authentication changes, Figma edits, redesign, native publication, Vercel production promotion, and deleting or overwriting source assets.

**Branch:** `codex/web-assets-optimization`, based on integrated `main` at `37f77c5`.

**Implemented:** the six heavyweight core slots now reuse the existing optimized JPGs; the six Archive 10 slots use new 1024×1024 JPG derivatives under `assets/orbita/optimized/archive-10/`; desktop navigation uses a dedicated 192×192 web icon under `assets/orbita/optimized/brand/`; all source PNGs and the native `assets/icon.png` are unchanged. `scripts/check-web-export.mjs` and `pnpm check:web-export` enforce the export, emitted-image, and compressed application-JavaScript budgets. Focused tests cover the budget decision logic and the web/native icon split.

**Measured result:** the production web export is **35.86 MB**, down from the 84 MB baseline (48.14 MB / about 57% smaller). The largest emitted image is **479.3 KB**, compressed application JavaScript is **1.09 MB**, and the export contains 200 files. The six new Archive 10 derivatives range from 149,840 to 221,015 bytes; the web icon is 62,858 bytes. No heavyweight core/Archive 10 master or native icon is emitted.

**Validation:** `pnpm typecheck` passed; the full suite passed **764/764** across 64 suites; `pnpm build:web` passed; `pnpm check:web-export` passed; `git diff --check` passed. Visual QA passed for landing and onboarding at 390×844 and 1440×900, plus authenticated Home, Carta, and Tránsitos at the same sizes: no horizontal overflow, missing/broken imagery, distorted crops, or layout regression. Browser warnings remain the known local-only Expo notifications warning and Clerk development-key warning. Carta also logs the existing expected Convex rejection when a Free account requests the gated Plus personality reading; that behavior predates and is outside this asset-only PR.

**Rollout state:** ready for review/PR. Production remains untouched and Git production deployment from `main` remains disabled. Rollback is a single revert of this PR.

## Web launch — manual production promotion guard (2026-07-31, Codex)

**Objective:** prevent merges to `main` from publishing Órbita automatically while keeping branch previews available, so production receives exactly the clean deployment that passed integrated QA.

**Acceptance criteria:** pushes and PR branches can still create Vercel previews; `main` does not trigger a Git deployment; production changes only through an explicit promotion of the validated deployment; no application, backend, payment, domain, or environment behavior changes in this PR.

**Task brief:** owner Codex (release); allowed territory `vercel.json` and this handoff; risk low but release-critical because the current Vercel project automatically targets `main` deployments as production; tests are JSON/config validation plus a green Vercel preview; rollout is merge this guard before the backend/frontend stack, then verify that the merge creates no production deployment; rollback is revert the config and re-enable Git deployments; out of scope product code, Convex, Stripe, Clerk, assets, and production promotion.

**Decision:** `git.deploymentEnabled.main = false`. Unspecified feature branches remain enabled for preview deployments. Production will later use Vercel's promote workflow, which changes traffic to the exact tested deployment without rebuilding it.

## P0 — integridad de datos natales y recuperación dev (2026-07-29, Codex)

**Objetivo:** impedir que el onboarding o sus controles internos sobrescriban datos natales ya existentes y evitar que una carta vieja se presente como vigente durante una edición/reparación.

**Criterios de aceptación:** `onboarding.completeBirthData` crea datos únicamente cuando la cuenta todavía no los tiene; una cuenta existente debe editar mediante `birthData.upsertForCurrentUser`; las lecturas de carta seleccionan exclusivamente el cache correspondiente al hash natal vigente y devuelven estado vacío mientras se recalcula, nunca una carta anterior; el modo `debugStep` del frontend no ejecuta escrituras; la reparación de la cuenta dev no se ejecuta sin aprobación explícita de Lucas y distingue datos natales/carta de caches diarios ya generados.

**Ficha:** owner Codex para `convex/**` y Claude para el ajuste coordinado `app/**`/`src/**`; rama backend `feature/api` dentro del PR #40 por tratarse de un gate P0 descubierto durante la integración; riesgo alto por integridad de datos personales; pruebas unitarias/estructurales + suite completa + typecheck + codegen dev; rollout contrato backend y frontend coordinados en Convex dev → reparación controlada de la cuenta dev → pasada manual → PR, sin producción; rollback revertir el commit coordinado y no reparar/migrar ninguna cuenta; fuera de alcance producción, Stripe, deploy Vercel, PWA y cambios visuales.

**Incidente:** el barrido responsive abrió `/empezar?debugStep=14` con una sesión dev activa. Como el paywall está apagado, el montaje ejecutó `submit()` y reemplazó los datos natales existentes por defaults, luego recalculó carta y contenido derivado. Producción no fue tocada. Las pruebas manuales quedan pausadas.

**Estado backend:** implementado localmente y sin deploy. El onboarding es create-only/idempotente; Carta/Home/lecturas/Tránsitos rechazan caches que no pertenecen a la carta exacta vigente; `dailyGuides` conserva Tarot/ritual/reveal pero invalida y regenera los módulos personalizados ante un cambio natal, con protección contra jobs viejos en carrera. Verificación: typecheck 0, 375/375 tests, codegen correcto y `git diff --check` limpio. El function spec remoto confirmó que Convex dev todavía conserva el contrato anterior.

**Handoff frontend requerido antes de desplegar dev:** separar `useBackendPersist` (onboarding → `onboarding.completeBirthData`) de `useBackendPersistStrict` (Perfil → `birthData.upsertForCurrentUser`, `source: "profile"`); retirar `readings.generateToday` con fecha/timezone del dispositivo del hook compartido; hacer `debugStep` estrictamente read-only; impedir que una cuenta con `birthData` vuelva al onboarding para editar (usar `/editar-datos`). Luego desplegar backend y frontend coordinados, restaurar la cuenta dev sólo con aprobación de Lucas y verificar que Carta/Tránsitos/Home se autorreparen sin cambiar la carta de Tarot ni `revealedAt`.

**Rollout dev (2026-07-29 20:24 ART):** backend `1ad486f` + `a9ae1f2` desplegado únicamente a Convex dev `dutiful-viper-815`; function spec remoto confirma el nuevo argumento interno de `daily.persistEnrichedGuide`. Frontend de paridad/integridad revisado hasta `cd8b274`, con typecheck 0 y 512/512 tests verificados por Codex; servidor local activo en `http://localhost:8099` contra ese dev. Producción intacta. Próximo paso autorizado: Lucas restaura 11 Nov 1996 · 10:32 y vuelve a elegir Ciudad Autónoma de Buenos Aires desde el buscador; después verificar autorreparación de Carta/Home/Tránsitos y estabilidad del Tarot diario antes de retomar otros escenarios.

**Corrección posterior al PR 3 frontend (2026-07-30):** la defensa del cliente detectó dos huecos residuales del selector backend: `charts.current` todavía rescataba una carta histórica cuando no existía ninguna fila `birthData`, y algunos módulos elegían `.first()` mientras otros usaban la fila natal más reciente. El follow-up unifica Perfil, Carta, Home, lecturas y Tránsitos sobre `findCurrentBirthData(...).order("desc").first()` y hace que, sin datos natales vigentes, la carta vigente sea estrictamente `null`. No cambia firmas públicas ni despliega nada. Validación: typecheck verde, 376/376 tests y `git diff --check` limpio.

## Órbita Web P0 — contrato backend seguro (2026-07-28, Codex)

**Objetivo:** preparar el backend P0 de Órbita Web para una salida gratuita primero y cobros después, sin permitir que cliente, URL o modo demo habiliten Plus o Stripe.

**Criterios de aceptación:** comercio apagado por defecto y resuelto en servidor; checkout sólo `weekly|yearly`; trial anual de siete días; sesión Stripe ligada al Clerk user y entitlement confirmado por webhook; sin mutación/seed pública de Plus; fecha diaria calculada con timezone natal; una carta por día sin generación histórica/futura; Free/Plus aplicado en Carta, Diario, Tránsitos y Umbral; Lab/backoffice cerrados en producción; analytics de compra sin PII.

**Ficha:** owner Codex; rama `feature/api` desde `origin/main` `ef8b048`; territorio de implementación `convex/**` y documentación de handoff; riesgo alto por pagos, privacidad y cambios de contrato; pruebas typecheck + suite completa + codegen dev + checklist manual frontend; rollout contrato backend en PR → integración frontend limpia por Claude → Gate A con `COMMERCE_MODE=off` → 24 h estables → validación fiscal/comercial y aprobación explícita de Lucas → recién entonces Gate B; rollback apagar comercio y restaurar el deployment anterior; fuera de alcance `app/**`, `src/**`, deploy productivo, dominio/Clerk, Stripe live, PWA, Playwright, Vínculos, Calendario y App Store.

**Estado:** implementación backend publicada para revisión en PR #40. `convex/CHANGELOG.md` documenta firmas y migración frontend; codegen validó y cargó únicamente Convex dev `dutiful-viper-815`; typecheck verde; suite completa 371/371; `git diff --check` limpio. Producción no fue tocada. El frontend PR1 `feature/web-p0-shell` (`3c66b89`) eliminó `?live=1`, los fallbacks silenciosos a carta/tránsitos mock para sesiones reales y cerró las superficies internas por defecto. PR2 `feature/web-p0-contracts` (`9eaaa29`) centralizó `daily.getTodayContext`, corrigió las cuatro superficies que enviaban fecha de dispositivo, evitó que Home quedara congelada al cambiar de día y resolvió los estados Free/Plus de Carta; typecheck verde y 406/406 tests. PR3 `feature/web-p0-paywall` (`087fa51`) conectó `getWebOffer`, el estado “Plus estará disponible pronto” con comercio apagado y el polling acotado de `getCheckoutStatus`. PR4 `feature/web-p0-final` (`91786fe`) completó responsive, navegación móvil y gestión de suscripción, y eliminó datos fallback visibles en Perfil, acceso anónimo al Diario y el CTA demo muerto del login. PR5 `feature/web-p0-auth-es` (`610f6ad`) agregó `esES` desde el subpath tree-shakeable y corrigió los strings visibles. PR6 `feature/web-p0-signup-es` (`bb4f1e5`) mantuvo el alta dentro de `/empezar` con `withSignUp`, eliminó toda navegación a `accounts.dev`, agregó un borrador defensivo en `sessionStorage` y preservó paso, datos natales y tríada al remontar Clerk; la cadena termina con typecheck verde, 441/441 tests, export web de 5,18 MB y responsive verificado a 320/390/1100 px. El worktree apunta a Convex dev `dutiful-viper-815`, Clerk test y el proyecto Vercel `orbita`, sin commitear secretos ni habilitar herramientas internas. El backend corrigió en `6fcfdac` el retorno del Customer Portal a la ruta canónica `/perfil` y sincronizó ese código únicamente con Convex dev; `/profile` permanece como redirect de compatibilidad. Trabajo de features congelado. Único gate de producto pendiente: pasada manual autenticada con una cuenta descartable para confirmar alta, restauración del borrador, carta persistida antes del paywall y experiencia Free completa. Después: dominio + Clerk productivos y Gate A. PWA continúa explícitamente fuera de alcance.

**Bloqueo móvil posterior:** `src/domain/appData.ts` todavía construye tránsitos nativos hardcodeados mediante `buildTransitos` y `chartMock`. No afecta Gate A web y queda fuera de este PR backend, pero debe eliminarse antes de cualquier nueva publicación móvil.

## P6 — secuencia de alta y cuenta, web + nativo (2026-07-31, Claude)

**Objetivo:** cerrar la secuencia canónica del alta: el onboarding inmersivo va primero, la cuenta se crea en su paso original de la V4.4 (`14 / Create Account`, índice 13), y recién ahí algo sale del dispositivo. Que funcione limpio en web móvil (390×844) y escritorio (1440×900) sin cambiar la conducta nativa.

**Corrección de rumbo:** la entrada anterior de este archivo describía un flujo **auth-first** (cuenta ANTES del onboarding, alta como ruta propia `/crear-cuenta`, `AccountScreen` fuera del flujo). Esa dirección quedó sin efecto y el documento `docs/handoff-auth-first-entry.md` está corregido con la conducta real. El `/crear-cuenta` sigue existiendo como ruta directa, pero ninguna superficie manda ahí: la landing y el login abren el onboarding completo.

**Qué cambió (diff P6 existente):**
1. **`TOTAL = 15`, `STEP_ACCOUNT = 13`.** `AccountScreen` vuelve al flujo; el login pasa el email tipeado por params. `destinationAllows` acepta `sign-in` en la superficie `onboarding`: el alta empieza sin cuenta y junta todo en el borrador local.
2. **Una sola persistencia, esperada, con guard de cuenta.** Sin usuario Clerk activo el cierre vuelve al paso 13 con el borrador intacto; nunca escribe defaults. El error del cierre es visible y reintentable, y no navega a Recepción fingiendo éxito.
3. **Google sólo web y sólo con flag.** `GOOGLE_AUTH_ENABLED = Platform.OS === "web" && EXPO_PUBLIC_ORBITA_GOOGLE_AUTH === "true"`. Apple salió del flujo. Sin la variable, el alta por email queda entera.
4. **Composición de escritorio real** (`Screen` con `stage` / `split` / `scene` + `useSplitSlot`), no un teléfono centrado. `WebLayoutProvider` es el único lector del viewport; en nativo el modo es siempre `mobile`.
5. **Rueda propia de fecha/hora en web** con semántica de listbox, sin el popover del sistema y sin depender de eventos de momentum que el navegador no emite.
6. **`/preview-alta`**: vista combinada de los 15 pasos en la matriz de tamaños. Sólo con herramientas internas y de sólo lectura — entra por el mismo camino que `debugStep`.

**Correcciones aplicadas al cerrar la tarea:**
- **`AccountGate` con `sticky` (bug serio).** Al crear la cuenta en el paso 13, `users` pasa a `pending` y `birthData` vuelve a `undefined`, así que el resolver decía `loading` y el gate **desmontaba el alta entera** justo ahí. En web el borrador de `sessionStorage` lo disimulaba; **en nativo no hay borrador y se perdía todo lo cargado**. `sticky` sostiene sólo el estado `loading`: un destino resuelto distinto sigue redirigiendo y una cuenta completa sigue sin poder montar el alta.
- **Cuenta incompleta continúa desde la fecha también en web.** El arranque nativo ya mandaba `resume=datos`, pero el gate web redirige a `/empezar` sin ese param y la cuenta incompleta volvía al splash.
- **Banda de selección de la rueda web alineada.** Se posicionaba con `8 + PAD`, ignorando el alto de la leyenda: quedaba ~14px por encima de la fila que decía marcar. Ahora la leyenda tiene alto y `line-height` explícitos y el offset es aritmética.
- **Texto obsoleto corregido** en `docs/handoff-auth-first-entry.md`, `src/domain/appRoutes.ts`, `app/crear-cuenta.tsx` y `app/empezar.tsx`.
- **El borrador conserva el email.** `parseDraft` reconstruye el objeto campo por campo y nunca copiaba `email`, así que `writeDraft` lo guardaba, `readDraft` lo descartaba en silencio y `saved?.email` era código muerto: la vuelta de Clerk hacía retipear el email recién tipeado. Ahora sale por `optStr` —igual que `identity`—, así que un valor que no sea string no vacío queda en `undefined`. `test/onboardingDraft.test.ts` **afirmaba** ese descarte; ahora afirma la conservación, mantiene la compatibilidad con borradores viejos sin `email` y suma el rechazo de valores inválidos.

**Paywall:** sigue **desactivado** (`PAYWALL_ENABLED = false`). El producto es freemium; no se implementaron pagos en esta tarea.

**Validación: en verde.** `git diff --check` limpio, `pnpm typecheck` en verde, suite completa **747/747**, `pnpm build:web` correcto y pasada de navegador a 320, 390 y 1440 sin desborde horizontal ni errores de consola.

**Hallazgos reportados y NO corregidos** (quedan como follow-up, ninguno bloquea el PR):
- `yearOptions` cubre 100 años: un `value.year` fuera de rango cae a `Math.max(0, -1)` y la rueda **muestra el año actual mientras el estado guarda otro** — la misma clase de bug de integridad que ese archivo existe para evitar. Improbable en la práctica (el valor por defecto es 1996), pero es el defecto que el archivo promete no tener.
- Estilos muertos tras sacar Apple: `divider`, `socials`, `gap` en `AccountScreen.tsx` y `SignInScreen.tsx`.
- El enlace "Ya tengo cuenta" perdió su `marginTop: 14` de móvil al pasar a `SIGN_IN_LINK_ROW` (el literal compartido no lo trae).

**Fuera de alcance:** endurecer `onboarding.completeBirthData` para rechazar sobrescrituras — follow-up backend separado, después de que Perfil use la mutación explícita de edición.

## Órbita Web P0 — alta de cuenta dentro de Órbita (2026-07-28, Claude)

**Objetivo:** que crear cuenta ocurra dentro del producto, en español, sin perder el onboarding cargado.

**Ficha:** owner Claude (frontend); territorio `app/**`, `src/**`, `test/**`; rama `feature/web-p0-signup-es` sobre `feature/web-p0-auth-es` `610f6ad`; riesgo medio (toca el estado del onboarding); validación typecheck + suite + export web + navegador a 320/390/1100.

**Qué cambió:**
1. **`/login`**: `signUpUrl="/empezar"` en el `<SignIn />`. "Registrate" ahora lleva al onboarding de Órbita, no al Account Portal alojado.
2. **Paso de cuenta de `/empezar`**: `withSignUp` en el `<SignIn />` ya montado. Un email nuevo continúa a registro **en el mismo componente**, con `routing="hash"` (`/empezar#/create`). No hizo falta montar `<SignUp />` aparte: la instancia no bloqueó el flujo.
3. **Borrador del onboarding persistido** (`src/domain/onboardingDraft.ts`). Sin esto no se cumplía el criterio de aceptación: todo el onboarding vivía en `useState` y la vuelta de Clerk a `/empezar` lo borraba entero. Se guarda en `sessionStorage`, no `localStorage`, a propósito — son datos de nacimiento: duran lo que dura la pestaña y no quedan en una máquina compartida. Lectura defensiva: un borrador corrupto, truncado o de otra versión se descarta y se empieza limpio. Se borra al terminar el onboarding.
4. **Bug encontrado al validar:** el efecto que invalida la tríada cuando cambian los datos de nacimiento **también corría en el primer render**, así que al volver de crear la cuenta borraba la tríada restaurada aunque nada hubiera cambiado. Ahora compara contra una firma de los datos; la tríada guardada se calculó con esos mismos datos, así que es consistente por construcción.
5. **Overrides de voz y de inglés faltante.** `esES` deja **550 claves** sin traducir respecto de `enUS`; casi todas son de passkeys, SSO empresarial, API keys y códigos por teléfono, que Órbita no usa. Se tradujeron sólo las alcanzables en email + contraseña: `signIn.start.titleCombined` (mostraba **"Continue to Orbita"** en el formulario combinado), `formFieldInputPlaceholder__signUpPassword`, `formFieldInput__emailAddress_format`, `protectCheck.*` y los títulos de contraseña comprometida/no confiable. Más el ajuste a voseo pedido: "Ingresá tu dirección de correo electrónico", "¿No tenés cuenta?", "Registrate", "Creá tu cuenta", "¿Ya tenés cuenta?".

**Verificado en navegador contra Convex dev:**
- Click real en "Registrate" desde `/login` → `http://localhost:8099/empezar`. **No** `accounts.dev`.
- En el paso de cuenta, un email nuevo continuó a registro en `/empezar#/create` (dos `history.replaceState`, sin recarga ni navegación externa), con el paso "5/6 Guardá tu carta" intacto alrededor.
- Formulario de alta en español: "Creá tu cuenta", "para continuar en Orbita", "¿Ya tenés cuenta? Iniciar sesión". Cero inglés.
- Borrador tras entrar al alta: paso 8, `1994-4-12`, `10:40`, "Rosario, Santa Fe, Argentina", coordenadas y tríada `Aries/Tauro/Virgo` conservados.
- 320, 390 y 1100: sin desborde horizontal, sin inglés, sin `accounts.dev`.

**Validación: typecheck verde, 441/441 tests, export web 5,18 MB.**

**Límite:** no completé un alta real (no creo cuentas ni ingreso contraseñas). Falta confirmar con una cuenta descartable que, **después** de crear la cuenta, el onboarding sigue en el paso de cuenta con los datos y que la carta queda guardada antes del paywall. El borrador y la tríada ya se verificaron sobrevivir el remonte y la entrada al alta.

## Órbita Web P0 — auth en español (2026-07-28, Claude)

**Objetivo:** que los componentes de Clerk que montamos rindan en español. Sin rediseñar auth ni tocar la arquitectura de providers.

**Ficha:** owner Claude (frontend); territorio `src/services/**` + `package.json`/`pnpm-lock.yaml`; rama `feature/web-p0-auth-es` sobre `feature/web-p0-final` `91786fe`; riesgo bajo; validación typecheck + suite + `expo export --platform web` + navegador a 320/390/1100.

**Qué cambió:**
1. `@clerk/localizations@4.13.8` agregado con pnpm (`package.json` + `pnpm-lock.yaml` commiteados).
2. `src/services/clerkLocalization.ts` exporta `orbitaEsES` = `esES` + overrides puntuales.
3. `ClerkProvider` recibe `localization={orbitaEsES}`. Nada más cambió: mismo `tokenCache`, mismo `ConvexProviderWithClerk`, mismas rutas.

**Import por subpath — no cosmético:** importar desde la raíz (`@clerk/localizations`) mete los ~40 idiomas del paquete y el bundle web pasó de **4,9 MB a 10,1 MB**. Con `@clerk/localizations/es-ES` queda en **5,18 MB** (+~70 KB sobre la base). El bundle exportado se verificó: tiene los strings en español y **cero** francés/alemán/portugués/japonés.

**Overrides aplicados:** `esES` trae dos interrogaciones sin signo de apertura. Se corrigieron sólo esas dos claves (`formFieldAction__forgotPassword` y `reverification.alternativeMethods.getHelp.title`). No quedó ningún string en inglés dentro de los componentes que montamos, así que no hizo falta ningún otro override.

**Verificado en navegador contra Convex dev:** "Entrar", "para continuar a Orbita", "Correo electrónico", "Contraseña", "Continuar", "¿No tienes cuenta? Regístrese", "¿Olvidaste tu contraseña?" y el error real del servidor ("No se ha encontrado ninguna cuenta con este identificador."). Sin desborde horizontal ni strings en inglés a 320, 390 y 1100.

**Validación: typecheck verde, 430/430 tests, export web correcto.**

**Dos cosas que quedan y NO se resuelven con esta librería:**
1. **"Regístrese" sale de la app.** Lleva al Account Portal alojado de Clerk (`golden-urchin-96.accounts.dev/sign-up`), que está **en inglés** y no lo alcanza el prop `localization` — ése es otro origen. Se arregla desde el Dashboard de Clerk (idioma del Account Portal) o montando un `<SignUp />` propio, que sería rediseñar auth y quedó explícitamente fuera de este PR.
2. **Registro mezclado tú/usted.** `esES` es español peninsular: "¿No tienes cuenta?" (tú) junto a "Regístrese" / "Ingrese su dirección" (usted), mientras Órbita escribe en voseo ("Entrá", "Guardá"). No es un bug de traducción sino de voz de marca. Se puede alinear sobrescribiendo un puñado de claves visibles; no lo hice porque excede "sobrescribir sólo strings en inglés".

El badge **"Development mode"** es esperable con la instancia de desarrollo y `pk_test`. No se ocultó por CSS; se verifica antes del Gate A con `pk_live` y el dominio canónico.

## Órbita Web P0 — responsive, gestión de suscripción y validación en dev (2026-07-28, Claude)

**Objetivo:** cerrar el alcance P0 restante — comportamiento responsive, "Gestionar suscripción" en Perfil, y una pasada real contra Convex dev `dutiful-viper-815`. PWA queda fuera.

**Ficha:** owner Claude (frontend); territorio `app/**`, `src/**`, `test/**`; rama `feature/web-p0-final` sobre `feature/web-p0-paywall`; riesgo medio; validación `pnpm typecheck` + suite completa + pasada en navegador contra Convex dev.

**Qué cambió:**
1. **Navegación móvil.** `WebNav` ocultaba los cuatro links debajo de 900px y no dejaba **ningún** modo de moverse entre secciones: la web era inusable en teléfono. Ahora baja a una barra inferior fija (`position: fixed` de RNW, con `env(safe-area-inset-bottom)`), ítems de 56px y los links de escritorio con 44px de alto mínimo.
2. **Desborde horizontal.** `minWidth: 300` en la columna lateral de Carta y Valores forzaba 300px sobre los 272 disponibles a 320px; `deepVisual` de la Home tenía `width: 460` fijo. Corregidos a `minWidth: 0` + `sideWide` sólo en ancho, y `maxWidth` con `width: "100%"`.
3. **`ManageSubscriptionBlock`** en Perfil, sobre la decisión pura `manageSubscription`. La autoridad es `canManageInStripePortal` (que el backend calcula como `provider === "stripe" && !isLifetime`, o sea que ya excluye Free, RevenueCat y lifetime). Se suma el estado del comercio: con `off` **no** se ofrece el portal —`createPortalSession` no puede construir el cliente de Stripe y tiraría— sino la vía de soporte. Estados de carga y error con reintento. Sólo se abre la URL que devolvió el backend.
4. **`/profile`** se mantiene como redirect de compatibilidad; el backend ya devuelve a `/perfil` (`6fcfdac`).

**Hallazgos de la validación real (corregidos en esta rama):**
- **`/perfil` mostraba "12 Abr 1994"** a cualquier visitante sin sesión. Sale de `createFallbackProfile()` (`birthDate: "1994-04-12"` hardcodeado) vía `useAppData()`: una fecha de nacimiento inventada presentada como propia. Ahora el hero sólo muestra la línea si existe un perfil real. Se arregló en el punto de render, sin tocar `src/domain/appData.ts`.
- **`/diario` no exigía sesión**: renderizaba el shell y la navegación para cualquiera. Ahora va detrás de `RequireSession`.
- **El login ofrecía "Seguir en modo demo"**, que además apuntaba a `/home` y por tanto rebotaba a `/login`: superficie demo muerta. Eliminada, junto con el copy "la web sigue andando en modo demo".
- **La tarjeta de Clerk quedaba cortada a 320/390**: 112px de padding sobre 320 dejaban 208px para una tarjeta que pide ~400, y el campo de email no entraba. Padding responsive + `appearance` fluido.

**Validación ejecutada contra Convex dev** (`localhost:8099`, iframes del mismo origen para forzar viewport real):
- Rutas internas `/studio`, `/lab`, `/backoffice` → todas redirigen a `/`.
- Rutas de app `/carta`, `/transito`, `/paywall`, `/diario` → redirigen a `/login` sin sesión.
- `/profile` → `/perfil`.
- Sin desborde horizontal a 320, 390 y 430 (`scrollWidth === innerWidth`).
- `/perfil` y el resto de los tabs sin sesión muestran estados honestos ("Creá tu cuenta"), sin fechas ni lecturas inventadas.

**NO validado — requiere a Lucas:** todo el recorrido con sesión (onboarding, fecha canónica, Home, carta Free, Tarot diario, Diario, Tránsitos, Umbral, paywall con comercio apagado y "Gestionar suscripción"). No puedo crear cuentas ni ingresar contraseñas.

**Pendiente / decisión:**
- **Clerk está en inglés** ("Sign in to Orbita", "Welcome back!", "Email address", "Continue", "Sign up"). El brief P0 exige auth en español. El arreglo es `@clerk/localizations` (`esES`) en `ClerkProvider`, pero implica agregar una dependencia (`package.json` es config gris): queda a tu decisión.
- El badge **"Development mode"** de Clerk aparece por usar `pk_test` en local; con `pk_live` no se muestra. Verificar en el preview productivo.

## Órbita Web P0 — paywall y retorno de checkout (2026-07-28, Claude)

**Objetivo:** consumir `payments.getWebOffer` y `payments.getCheckoutStatus` con el comercio apagado por defecto, sin precios en el cliente y sin que la URL de retorno pueda conceder Plus.

**Criterios de aceptación:** el paywall pide la oferta al entrar; con `commerceMode="off"` dice "Órbita Plus estará disponible pronto" y no ofrece ningún camino a checkout; los precios salen exclusivamente de `currency`/`unitAmount`/`interval`/`trialDays`; el retorno valida `session_id` con `getCheckoutStatus` y hace polling acotado sólo mientras responde `pending`, cortando con `active`, `failed`, timeout, logout o desmontaje; con el comercio apagado no se consulta el estado.

**Ficha:** owner Claude (frontend); territorio `app/**`, `src/**`, `test/**`; rama `feature/web-p0-paywall` sobre `feature/web-p0-contracts`; riesgo alto por tocar el camino de cobro; validación `pnpm typecheck` + suite completa + export web; fuera de alcance `convex/**`, Stripe live, dominio/Clerk, responsive y PWA.

**Qué cambió:**
1. **`/paywall`** (`src/components/web/orbita-paywall.tsx`) llama `getWebOffer({})` al montar. `offerPhase` (`src/domain/paywall.ts`) resuelve cargando/error/próximamente/disponible. "Próximamente" cubre además el caso `checkoutEnabled=true` con `plans: []`: antes que una pantalla de compra vacía, se dice que todavía no está.
2. **Precios sólo desde Stripe.** `formatPlanPrice` usa `currency` + `unitAmount` (unidad mínima) vía `Intl`; `planTrialLabel` sólo anuncia el trial si `trialDays > 0`; `planIntervalLabel` sale del `interval`. No hay ningún importe escrito en el cliente. Un código de moneda inválido cae a mostrar el código, nunca a un símbolo inventado.
3. **`/checkout/success`** (`src/components/web/orbita-checkout-return.tsx`) valida la forma del `session_id` antes de mandarlo, consulta primero si el comercio está habilitado y sólo entonces llama `getCheckoutStatus`. El polling vive en la decisión pura `checkoutPollDecision`: se detiene con `active`, `failed`, timeout (90 s), logout (`isLive`) o desmontaje. El timeout no promete Plus ni declara un fallo: dice que el pago se está confirmando.
4. **`/profile`** redirige a `/perfil`. El backend fija `return_url` del Customer Portal en `{WEB_APP_URL}/profile`, pero el perfil de Órbita vive en `/perfil`: volver del portal daba 404.
5. **`PlusLocked` linkea a `/paywall`**, que resuelve por sí solo el estado del comercio. Con `off` no hay camino a checkout desde ninguna superficie.

**Validación:** `pnpm typecheck` en verde, **425/425** tests (19 nuevos en `test/paywall.test.ts`) y `npx expo export --platform web` correcto. El bundle exportado confirma `getWebOffer`, `getCheckoutStatus`, `getTodayContext`, `/paywall` y `/checkout/success` presentes, y **cero** ocurrencias de `live=1`, `urlForcedLive`, `setStubPlusForDev` y el copy de demo.

**Configuración del worktree:** `.env.local` y `.vercel` copiados desde el worktree principal — Convex dev `dutiful-viper-815`, Clerk `pk_test`, proyecto Vercel `orbita`. Ambos están cubiertos por `.gitignore` (`.env*`, `.vercel`); no se commiteó ningún secreto. `EXPO_PUBLIC_ORBITA_INTERNAL_TOOLS` queda sin setear.

**Pendiente:** responsive/PWA; "Gestionar suscripción" en Perfil con `createPortalSession`; prueba manual conjunta contra Convex dev.

## Órbita Web P0 — contratos nuevos: fecha canónica y Free/Plus (2026-07-28, Claude)

**Objetivo:** consumir el contrato del backend P0 (PR #40): la fecha del día la decide el servidor, y las superficies recortadas por plan se leen como "esto es Plus" y no como una falla.

**Criterios de aceptación:** ninguna pantalla calcula el día astrológico ni manda su timezone como autoridad; una sola llamada a `getTodayContext` por sesión, refrescada al cambiar de cuenta, volver al frente y cruzar la medianoche; `locked` y `access` tienen estado propio en Carta, Personalidad, Valores y la Carta nativa.

**Ficha:** owner Claude (frontend); territorio `app/**`, `src/**`, `test/**`; rama `feature/web-p0-contracts` sobre `feature/web-p0-shell`; riesgo medio — cambia cómo se resuelve la fecha en toda la app; validación `pnpm typecheck` + suite completa; fuera de alcance `convex/**`, paywall/checkout (PR siguiente), responsive, PWA y `src/domain/appData.ts`.

**Qué cambió:**
1. **`DailyContextProvider`** (`src/hooks/useDailyContext.tsx`) monta una sola llamada a `daily.getTodayContext` por sesión, sobre la decisión pura `refetchReason` (`src/domain/dailyContext.ts`). Refresca por cambio de cuenta, foreground (`AppState`) y medianoche. El reloj del navegador **sólo dispara el refetch**: se compara contra la fecha civil observada al momento del último fetch, nunca contra el `localDate` del servidor — si se comparara contra el servidor, un ciclo congelado tras editar el lugar natal refetchearía en loop para siempre.
2. **Se eliminaron los seis `todayLocalDate()`** del cliente. Esto no era cosmético: `transits.getToday` ahora **tira excepción** si la fecha no es la canónica, así que Tránsitos web, `app/reading/transito.tsx`, `app/reading/transitos.tsx` y `app/(tabs)/transitos.tsx` fallaban para cualquiera cuya zona natal no coincidiera con la del dispositivo.
3. **`useLiveHome` recibe fecha y zona canónicas.** Antes escribía con `toISODate()` + `deviceTimezone()` y `home.getDaily` leía otra fecha: la Home podía quedar vacía para siempre. Además el flag de "ya intenté generar" pasó de booleano a por-fecha, si no el día siguiente nunca se generaba.
4. **Free/Plus con estado propio** (`src/domain/entitlement.ts`): `valuesMapPhase` desambigua el `null` de `charts.valuesMap` (Free vs sin carta) — antes a un Free con su carta ya calculada le decíamos "completá tus datos de nacimiento"; `personalityPhase` trata `locked`; la Carta web oculta el bloque de aspectos con `access.aspects` en vez de dejar la tarjeta vacía.
5. **`readingBlockPhase` suma `bloqueado`** y `locked` gana sobre `failed`/`generating`: para un Free la action de generación rechaza por diseño, así que la Carta nativa mostraba error con REINTENTAR o "Preparando tu lectura…" eterno.
6. **Ref de `subscriptions.getCurrent` corregido.** Decía `{ entitlement: "free" | "plus" } | null`; el backend devuelve `orbita_pro`, incluye `isPro` y nunca es null. El tipo viejo hacía que cualquier decisión de gating leyera mal el plan.

**Validación:** `pnpm typecheck` en verde y **406/406** tests (16 nuevos entre `test/dailyContext.test.ts` y `test/entitlement.test.ts`). Sin pasada manual todavía.

**Pendiente:** paywall con `getWebOffer` y retorno de checkout con `getCheckoutStatus` (PR 3); responsive/PWA; prueba manual conjunta contra Convex dev con el #40 desplegado.

## Órbita Web P0 — shell limpio: sin mocks ni superficies internas (2026-07-28, Claude)

**Objetivo:** que la web publicada no pueda mostrar contenido inventado ni rutear a herramientas internas. Pareja frontend del backend P0 (PR #40), primer PR de la serie.

**Criterios de aceptación:** ninguna pantalla web renderiza mocks, ni como demo para visitantes ni como fallback ante error/vacío; sin sesión toda ruta de app manda a login; Studio/Lab/backoffice no son ruteables en la web pública; `?live=1` no existe; `setStubPlusForDev` no se referencia.

**Ficha:** owner Claude (frontend); territorio `app/**`, `src/**`, `test/**`; rama `feature/web-p0-shell` sobre `origin/main` `ef8b048` (misma base que el backend #40); riesgo medio — toca el arranque de sesión de la web y borra caminos de render; validación `pnpm typecheck` + suite completa; rollout PR → revisión → integración con #40 en Convex dev → pasada manual de Lucas; fuera de alcance `convex/**`, deploy, dominio/Clerk, Stripe, PWA, responsive y los contratos nuevos (van en los PR siguientes).

**Qué cambió:**
1. **`LiveGate` eliminado** (`src/components/web/live.tsx` borrado). Era la raíz del problema: no sólo daba una demo mock a visitantes sin sesión, también servía de fallback silencioso ante fallas reales. Casos concretos que veía gente **con sesión**: `orbita-transit.tsx` devolvía `transitMock` cuando la action de tránsitos fallaba o venía vacía, y `orbita-personality.tsx` rellenaba con `chartMock`/`personalityMock`/`valuesMock`, mostrándole a alguien sin carta la carta natal inventada de otro como si fuera suya.
2. **`RequireSession`** (`src/components/web/require-session.tsx`) reemplaza esa dualidad, sobre la decisión pura `webRouteDecision` (`src/domain/webSession.ts`, testeada). Reusa `useLiveApp` + `sessionPhase` en vez de duplicar el handshake Clerk/Convex. Sin sesión → login; error de fila `users` → reintento; sin Convex/Clerk → "no está disponible", nunca demo.
3. **Estados honestos** en Tránsitos (con reintento), Personalidad, Valores y Carta, vía `WebNotice`.
4. **`?live=1` eliminado**, incluido el `router.replace("/home?live=1")` del onboarding web.
5. **Superficies internas cerradas** por `INTERNAL_TOOLS_ENABLED` (`src/services/internalTools.ts`, apagado por defecto): `/studio`, `/lab` y `/backoffice` redirigen a `/`. El Lab antes sólo se cerraba en nativo: en la web publicada era ruteable. La landing pública además promocionaba el Studio con una sección entera ("el espacio interno donde Órbita prepara su material"); se eliminó y los CTA ahora son `Empezar` / `Ya tengo cuenta`.
6. **`setStubPro` fuera de `appRefs.ts`** — apuntaba a la mutación que el backend eliminó.
7. **`/empezar` sin backend** muestra el estado no-disponible en vez de correr el onboarding entero y descartar los datos en silencio.

**Validación:** `pnpm typecheck` en verde y **379/379** tests (8 nuevos en `test/webSession.test.ts`, incluida la regresión de que "sin sesión" jamás rinde contenido de muestra). Sin pasada manual todavía.

**Pendiente / handoff:**
- `src/domain/appData.ts` (`buildTransitos`) todavía arma tránsitos hardcodeados con `chartMock` ("Venus armoniza tu Sol en…"). Sólo lo consume el Perfil **nativo** (`app/(tabs)/perfil.tsx`), no la web, así que queda fuera de este PR — pero es contenido astrológico inventado y hay que resolverlo antes de publicar el nativo.
- Para el backend: `.env.example` sigue documentando `ALLOW_DEV_STUB` y `STRIPE_PRICE_LIFETIME`, ambos ya sin uso tras el P0.
- `EXPO_PUBLIC_ORBITA_INTERNAL_TOOLS` debe quedar **sin setear** en el proyecto Vercel de producción.

## Analytics — eventos de producto + resumen diario por Telegram (2026-07-20, Codex)

**Objetivo:** registrar hechos puntuales del funnel de Órbita y enviar cada mañana un resumen del día anterior con aperturas únicas, nuevos/recurrentes, onboarding completado, cartas reveladas y retención.

**Criterios de aceptación:** `app_opened` es idempotente por `eventId` y vincula una instalación seudónima con la cuenta cuando existe sesión; `account_created`, `onboarding_completed` y `daily_card_revealed` salen únicamente de sus mutations autoritativas; ningún evento guarda PII, datos natales ni contenido libre; el digest calcula nuevos/recurrentes, D1 y regreso diario sin doble conteo; un cron lo agenda a las 09:00 de Argentina y un claim evita duplicados; los builds viejos siguen funcionando.

**Ficha:** owner Codex; territorio `convex/**`, tests y documentación/handoff; rama `codex/telegram-product-events` sobre `origin/main` `b81f262`; contrato aislado en `0b31db2`; riesgo medio por tablas nuevas, telemetría pública y cron; pruebas unitarias de métricas/formato/idempotencia + suite completa + typecheck + codegen; rollout PR backend → Convex dev → frontend separado instrumenta eventos → prueba con cuentas descartables → aprobación explícita de Lucas → producción; rollback por revert y redeploy (las tablas aditivas pueden quedar sin consumidores); fuera de alcance `app/**`, `src/**`, PostHog, deploy productivo y publicación móvil.

**Privacidad:** se guarda un UUID aleatorio por instalación, ids internos, timestamps y metadata técnica acotada. Nunca email, nombre, fecha/hora/lugar natal, pregunta/respuesta, nota, payload o copy de pantalla.

**Estado:** PR backend [#36](https://github.com/lucaszram/orbita/pull/36) mergeado en `main` como `19b4681` y desplegado a Convex producción `exciting-bat-311` el 2026-07-20 con aprobación explícita de Lucas. Codegen, typecheck, 371/371 tests, Vercel y dry-run productivo quedaron verdes; el deploy validó schema, no eliminó índices y agregó ocho índices analíticos. `@orbita_metricas_bot`, `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` están activos en producción; el envío de prueba fue exitoso y `telemetry.computeDigest` respondió en producción. El cron enviará a las 09:00 AR el día anterior completo. Los eventos autoritativos de backend ya se registran; el conteo diario completo de aperturas y vistas continúa pendiente del PR frontend separado descrito en `docs/handoff-claude-product-events.md`.

## Release Candidate — TestFlight 1.0.0 (18) (2026-07-19, Codex)

**Objetivo:** publicar únicamente en TestFlight interno el `main` aprobado que desacopla la Carta Natal base de la lectura larga y precalienta esa lectura en segundo plano.

**Criterios de aceptación:** el RC corresponde exactamente a `origin/main` `33608df` más este bump puntual; `1.0.0 (18)` usa Clerk live y Convex production `exciting-bat-311`; typecheck, suite completa y export iOS en verde; la carta base abre sin esperar la lectura larga; el binario se sube solo a TestFlight interno y no se agrega a App Review ni se publica en App Store.

**Ficha:** owner Codex; territorio de release `app.json` y documentación; rama `codex/release-1.0.0-build18`; riesgo alto por Convex producción y distribución; pruebas typecheck + 364/364 + export iOS + pasada manual ya aprobada en Convex dev; rollout backend compatible a producción → PR puntual de release → build local firmado → TestFlight interno; rollback conservar build 17 disponible y no promover build 18; fuera de alcance App Review, metadata, publicación en App Store y cambios de producto.

**Preflight:** la integración `#32 + #33` fue aprobada manualmente por Lucas: rueda, tríada, posiciones, casas y mapa de valores aparecen sin esperar; `Tu carta, explicada` carga inline y termina mostrando los siete capítulos completos. El backend no cambia schema ni firmas existentes; agrega prewarm y `charts.personalityReadingState()` de forma compatible. Gates del árbol exacto: typecheck verde, 364/364 tests, export iOS correcto y `git diff --check` limpio.

**Rollback:** no promover build 18 y mantener build 17 en TestFlight. Si el prewarm productivo presentara errores, revertir el merge de #32 y redesplegar Convex; los clientes anteriores y las lecturas ya persistidas permanecen compatibles.

## Hotfix — carta natal visible mientras se genera la lectura (2026-07-18, Codex)

**Objetivo:** iniciar la lectura natal larga en segundo plano apenas existe la carta y evitar generaciones LLM duplicadas, sin cambiar el texto aprobado ni el contrato público actual.

**Criterios de aceptación:** una carta nueva programa la lectura rica sin esperar que la persona abra el tab; dos disparos concurrentes hacen una sola generación; una lectura `ready` no se regenera; se registran cache hit, generación y persistencia sin PII ni texto; errores quedan reintentables; las firmas públicas `charts.current`, `charts.personalityReading` y `charts.generatePersonalityReading` siguen compatibles; la query aditiva `charts.personalityReadingState` permite distinguir `pending | ready | error` sin exponer contenido.

**Ficha:** owner Codex; territorio `convex/**`, tests y documentación; rama `codex/natal-reading-prewarm` sobre `origin/main` `9e52c55`; riesgo medio por scheduler/IA; tests unitarios + suite completa + typecheck + codegen; rollout Convex dev → integración con PR frontend de Claude → pasada manual → aprobación explícita → producción; rollback por revert y redeploy; fuera de alcance `app/**`, `src/**`, calidad/copy de la lectura, Figma, TestFlight y App Review.

**Diagnóstico producción:** la carta astronómica tardó `0,308 s`, las queries `13 ms` o menos y `charts.generatePersonalityReading` tardó `61,418 s`. El cuello es exclusivamente la lectura larga LLM; el frontend del build 17 bloquea toda la pantalla mientras `personalityReading` es `null`.

**Estado:** backend implementado y desplegado únicamente a Convex dev `dutiful-viper-815`. El function spec confirma la acción interna de precarga y el claim atómico. Validación local: typecheck verde, 343/343 tests y `git diff --check` limpio. Pendiente: PR backend, adaptación frontend separada por Claude y pasada manual conjunta; producción sigue intacta.

## Carta Natal — carga sin bloquear por la lectura larga (2026-07-18, Claude)

**Objetivo:** pareja frontend del PR backend #32 (prewarm natal): mostrar la carta astronómica (rueda, tríada, posiciones, aspectos, casas y mapa de valores) apenas `charts.current` + `charts.valuesMap` resuelven (<1 s), sin esperar los 40–61 s de `charts.personalityReading`.

**Ficha:** owner Claude (frontend); territorio `app/(tabs)/carta.tsx`, `src/domain/`, `test/`; rama `feature/carta-natal-carga` sobre `origin/main` `9e52c55`; riesgo bajo (solo reordena estados de carga, cero cambios de copy aprobado/contenido/backend/Figma); validación `pnpm typecheck` + suite completa; rollout: PR → revisión → prueba manual de Lucas contra Convex dev `dutiful-viper-815` (backend #32 ya desplegado); producción fuera de alcance.

**Estado:** implementado. Nuevo dominio puro `src/domain/cartaNatalCarga.ts`: `cartaGate({ doc, values })` gobierna el loading general (la lectura NO es input — garantía de tipo de que nunca vuelve a `MinimalLoading`) y `readingBlockPhase({ reading, failed })` gobierna solo el bloque "Tu carta, explicada": pendiente → "Preparando tu lectura…" inline; reject del generador → error inline con REINTENTAR (re-dispara la action); lista → los siete capítulos largos intactos (mismo markup `SectorBlock`, valores intercalados, disclaimer). El dato manda: si el prewarm del backend termina aunque la action del cliente haya fallado, la query llena la lectura y se muestra. `generatePersonalityReading({})` se sigue disparando al montar; `{ status: "pending" }` resuelto no es error (solo un reject lo es). Validación: typecheck verde, 354/354 tests (14 nuevos en `test/cartaNatalCarga.test.ts`: dominio + estructurales del cableado). Pendiente: pasada manual de Lucas en simulador con el backend #32 en dev.

**Ronda 2 (2026-07-19, señal remota):** el review de Lucas encontró que un prewarm fallido dejaba "Preparando…" eterno (el cliente recibía `{status:"pending"}` y la query seguía null). El backend #32 (`24ba2ac`, solo Convex dev) sumó la query aditiva `charts.personalityReadingState()` → `{ status: "pending" | "ready" | "error" }`, reactiva y nunca null. Frontend conectado: ref tipada en `appRefs.ts`; `readingBlockPhase` ahora recibe `state` + `generating` — prioridad: lectura llegada gana siempre; reject local o `state="error"` → error inline con REINTENTAR; `state="ready"` con lectura aún null = ventana entre queries → sigue cargando; el reintento limpia el fallo local, re-dispara la action y `generating` tapa el `error` remoto stale hasta que el backend lo pise. Regresión exacta pending→error sin desmontar + 5 tests más. Validación: typecheck verde, 360/360.

## Release Candidate — TestFlight 1.0.0 (17) (2026-07-18, Codex)

**Objetivo:** generar un binario iPhone reproducible para la pasada final de App Review, incorporando el backend de eliminación seguro y el frontend de cumplimiento ya validados.

**Criterios de aceptación:** `main` contiene los PR #30 y #29; `1.0.0 (17)` usa Clerk live y Convex production `exciting-bat-311`; typecheck, suite completa y export iOS en verde; el binario se sube únicamente a TestFlight interno; no se agrega a App Review ni se publica automáticamente.

**Ficha:** owner Codex; territorio de release `app.json` y documentación; rama `codex/release-build17` sobre `origin/main` `9bf198a`; riesgo medio por configuración/distribución; rollout PR puntual → merge → build exacto → TestFlight físico → aprobación de Lucas → recién después App Review; rollback mantener build 16 disponible y no promover build 17; fuera de alcance metadata, capturas, cuenta demo y envío a revisión.

**Preflight:** EAS production verificado con `EXPO_PUBLIC_APP_ENV=production`, Clerk `pk_live` y Convex `exciting-bat-311` (`cloud` + `site`); versión `1.0.0`; iPhone-only; cifrado no exento declarado `false`; publicación manual.

**Estado final del RC:** PR #31 mergeado en `main` como `d6a2b021077536a358e9908d886c5dec41701caf`. Build local App Store firmado generado como `1.0.0 (17)`, verificado con Convex producción y Clerk live, y recibido por Apple. App Store Connect lo informa `VALID` (build ID `43482860-b3d4-4a8f-b574-cef833631de5`). Pendiente únicamente la pasada física en TestFlight; todavía no fue agregado a App Review.

## Hotfix — carrera de lecturas al eliminar cuenta (2026-07-18, Codex)

**Objetivo:** evitar el crash nativo observado al borrar una cuenta mientras Clerk todavía mantiene la sesión y las queries reactivas vuelven a ejecutarse después de eliminar la fila `users`.

**Criterios de aceptación:** toda query pública de datos de cuenta devuelve su estado vacío contractual (`null`, `[]` o entitlement/cupo gratuito) si la identidad ya no tiene fila `users`; ninguna query lanza `User record not found` durante la ventana Convex → Clerk; mutations/actions continúan exigiendo identidad/usuario; la eliminación y los datos de otras cuentas no cambian.

**Ficha:** owner Codex; territorio `convex/**`, tests y documentación; rama `codex/account-deletion-read-race` sobre `origin/main` `ba9456e`; riesgo medio por ampliar estados vacíos de lectura; tests unitarios + estructurales + suite completa + typecheck; rollout PR backend → Convex dev → repetir eliminación con cuenta descartable y frontend PR #29 → recién después decidir merges/producción; rollback por revert; fuera de alcance UI, Clerk client, Figma, TestFlight y producción.

**Evidencia:** crash `rbita-2026-07-18-194801.ips`: `EXC_BAD_ACCESS/SIGSEGV` mientras React Native convertía una excepción de TurboModule. El log inmediatamente anterior muestra `readings:getToday` sin manejar: `User record not found`, después de que `users.deleteAccount()` eliminó el grafo y antes de que Clerk terminara de cerrar la identidad.

## App Review — paquete canónico de lanzamiento (2026-07-18, Codex)

**Objetivo:** reemplazar la documentación vieja y contradictoria por una única fuente de verdad para llevar el próximo Release Candidate desde TestFlight hasta App Review con liberación manual.

**Criterios de aceptación:** reflejar la configuración real (iPhone-only, ícono, cuenta obligatoria, versión gratuita), los gates de eliminación/legal/Plus, la cuenta demo con contraseña, la pasada TestFlight, metadata, privacidad, screenshots y definición exacta de “Add for Review”.

**Ficha:** owner Codex; territorio `docs/**` y `CURRENT_TASK.md`; rama `codex/app-review-pack-v2`; riesgo bajo, solo documentación; validación por contraste con `app.json`/`eas.json` y URLs públicas; rollout por PR docs; rollback por revert; fuera de alcance código nativo, producción, App Store Connect y credenciales reales.

**Estado:** `docs/app-review-readiness.md` creado como fuente canónica. Los dos documentos del 2026-07-10 quedan marcados como históricos. El backend y frontend de cumplimiento ya están en `main`; el build `1.0.0 (17)` está válido en TestFlight. Pendiente: pasada física, cuenta demo y metadata/capturas en App Store Connect.

## App Review — eliminación completa de cuenta (2026-07-18, Codex)

**Objetivo:** cumplir el requisito de App Store para apps con creación de cuenta mediante una eliminación real, autenticada e irreversible de la cuenta y sus datos.

**Criterios de aceptación:** `users.deleteAccount()` elimina la fila del usuario y todas sus filas propias en Convex, incluidos eventos de pago asociados por Clerk; nunca toca otra cuenta ni caches/editorial global; es idempotente; no registra PII; el cliente puede borrar después la identidad de Clerk sin perder antes la prueba de autenticación.

**Ficha:** owner Codex; territorio `convex/**`, pruebas y documentación; rama `codex/account-deletion-v2` sobre `origin/main` `da930df`; riesgo alto y destructivo únicamente al invocar explícitamente la mutación; tests unitarios + suite completa + typecheck + codegen; rollout backend a Convex dev → frontend Claude en PR separado → prueba con cuenta descartable → aprobación explícita de Lucas → producción; rollback por revert mientras ningún cliente invoque la función; fuera de alcance UI nativa, Clerk client, Plus/IAP, metadata de App Store y producción.

**Estado:** backend listo en `codex/account-deletion-v2`. Contrato aislado en `c896cd3` e implementación en `aaac19b`; la mutación borra 20 tablas propias, `paymentEvents` por `clerkUserId` y la fila `users` al final. Las tablas globales se preservan. Validación: typecheck verde, test destructivo 4/4 y suite completa 296/296; bindings Convex regenerados. Desplegado únicamente a Convex dev `dutiful-viper-815` y verificado en el function spec como `users.js:deleteAccount`; producción no fue tocada. Pendiente: PR borrador y frontend separado. Frontend debe confirmar dos veces, ejecutar Convex → Clerk → limpieza local, fallar cerrado y ocultar la superficie Plus para la primera versión gratuita.
## App Review — frontend de eliminación de cuenta + versión gratuita (2026-07-18, Claude)

**Objetivo:** cumplir App Review en el cliente: eliminar cuenta desde Perfil con doble confirmación, links visibles de Privacidad/Soporte y ninguna superficie de Plan Plus/precios/suscripción en esta primera versión gratuita.

**Ficha:** owner Claude (frontend); territorio `app/**`, `src/**`, tests; rama `feature/app-review-account` sobre `origin/main` `da930df`; backend ya disponible en Convex dev vía PR #27 (`users.deleteAccount({})` → `{ deleted: true }`, idempotente). Sin tocar `convex/**`, Figma, producción ni TestFlight.

**Estado:** implementado. (1) Perfil suma "Eliminar mi cuenta" (solo con sesión): advertencia clara + segunda confirmación destructiva, y orden estricto en `src/domain/accountDeletion.ts` — Convex `users.deleteAccount()` → Clerk `user.delete()` (nuevo `deleteUser` en `useOrbitaAuth`) → limpieza local (`resetApp` + snapshot por cuenta) → entrada. Cualquier fallo de Convex/Clerk conserva sesión y datos, muestra error y ofrece reintento (la idempotencia del backend permite reintentar todo el flujo); nunca se simula éxito. La mutación se consume por ref tipada en `appRefs.ts` (el `_generated` de main aún no la tiene; PR #27 abierto). (2) Perfil suma sección LEGAL con Privacidad (`https://orbitaastrologia.xyz/privacy`) y Soporte (`https://orbitaastrologia.xyz/support`). (3) Plus oculto por completo: Perfil pierde SUSCRIPCIÓN, `/reading/plus` redirige sin mostrar precios y El Umbral pierde el CTA "DESBLOQUEAR 5 CON EL SEMANAL". Token nuevo `orbita.colors.danger`.

**Correcciones del review Codex (2026-07-18, mismo día):** (a) P1 datos huérfanos — nuevo marcador `orbita:pending-account-deletion` escrito DESPUÉS de que Convex confirma y ANTES de borrar Clerk (si no se puede escribir, no se borra Clerk); la limpieza local retira el marcador ÚLTIMO; al arrancar, `useAppState` corre `completePendingAccountDeletion` y SOLO el marcador autoriza completar la purga (perfil, dueño, guardadas, diario, lápidas, snapshot) — si vuelve a fallar queda "pending", el proceso arranca vacío y nunca se ofrece login a la cuenta eliminada; sin marcador rige la regla de preservar datos ante sesión perdida. (b) P1 reentrada — lock sincrónico `useRef` tomado en la primera línea de `handleDeleteAccount` (liberado al cancelar/fallar, retenido en éxito); el logout también lo respeta. Rebasada sobre `main` `ba9456e` (#27 mergeado).

**Segunda ronda del review (marcador por fases):** el marcador ahora persiste la FASE — `backend_deleted` (antes de Clerk; falla cerrado si no hay `userId`) o `identity_deleted` (tras `user.delete()`, promoción best-effort). La hidratación solo purga con `identity_deleted`; `backend_deleted` deja todo intacto ("awaiting-identity") y un gate nuevo en `app/index.tsx` bloquea el arranque en "Finalizando la eliminación": espera a Clerk, con identidad activa reintenta `user.delete()` y recién después purga (`finalizePendingDeletionPurge` promueve el marcador PRIMERO y lo retira ÚLTIMO), con Clerk signed-out (crash post-delete) completa la purga directo. Nunca se purga a ciegas una fase anterior a Clerk ni se pierde la señal para retomar. Regresiones de reinicio: Clerk falla → reboot signed-in → nada se purga, marcador intacto, se completa después; crash post-Clerk → reboot signed-out → purga completa; + purga del gate muerta a mitad → la promoción persistida hace que el próximo arranque termine solo. Validación: typecheck verde, 332/332 tests.

**Tercera ronda del review (carreras del gate):** (a) una purga fallida en la hidratación ("pending") ahora TAMBIÉN expone el marcador — solo "completed" libera el arranque normal; el gate se monta y bloquea hasta terminar (nunca se puede crear/entrar otra cuenta con un marcador vivo en disco). (b) El intento del gate corre por `attemptPendingDeletionFinalize` (dominio, testeable): el resultado se publica siempre que el componente siga montado — un cambio de decisión durante los await (Clerk pasa a signed-out tras `deleteUser`) re-dispara el efecto pero NO silencia el fallo (se eliminó la cancelación por cleanup; guard de unmount real con `mountedRef`). Regresiones: pending→gate→retry completa; signed-in→deleteUser OK→signed-out→purga falla→error visible→retry purga sin repetir Clerk. Validación: typecheck verde, 335/335 tests. Pendiente: revisión acotada de Lucas y de ahí directo a la prueba con cuenta descartable en dev; producción no se toca.

## Backend — fast path de carta diaria (2026-07-18, Codex)

**Objetivo:** desacoplar la carta diaria de AstrologyAPI/IA para que el build 16 pueda revelar en menos de 2 s en frío y responder en menos de 500 ms con caché.

**Criterios de aceptación:** carta + orientación + una de las 156 lecturas editoriales canónicas persistidas antes de cualquier proveedor; las 78 cartas tienen versión al derecho e invertida, con cinco secciones y exactamente tres facetas; exclusión móvil de siete días; una sola fila/job por usuario y fecha; proveedores con topes de 5 s; enriquecimiento tardío incapaz de cambiar carta, orientación, ritual o `revealedAt`; payload v3 anterior intacto; métricas sin PII; tests de carrera, catálogo e invariantes.

**Ficha:** owner Codex; territorio `convex/**`, pruebas y documentación de contrato/handoff; base `origin/main` `e527abb`; cambio público aditivo sin schema; riesgo alto; rollout dev → aprobación explícita de Lucas → producción; rollback por revert de `6eff43d` y redeploy del backend anterior; fuera de alcance frontend, TestFlight y cron de precarga.

**Estado:** completado y publicado. El PR #25 fue mergeado en `main` como `6eff43d` y desplegado el 2026-07-18 a Convex producción `exciting-bat-311`, después de la aprobación explícita de Lucas. `daily.getGuide()` usa el camino DB-only compatible con build 16 y `daily.getCard()` expone `{ card, enrichment, personalized }` para build 17. `convex/content/tarotEditorial.generated.json` contiene **156 rituales completos y únicos** (78 cartas × derecho/invertida). El deploy no cambió schema ni eliminó índices; los registros existentes, la carta, orientación y `revealedAt` se preservan. Validación previa: typecheck verde, 292/292 tests, doble apertura con una fila y un job; medición dev de 36 ms de backend en frío y 16 ms con caché. No se generó TestFlight ni se modificó el binario. Seguimiento: observar logs `[daily.fast]` y `[daily.enrichment]`; el enriquecimiento lento nunca debe bloquear ni reemplazar la lectura base.

**Gate editorial:** aprobado por Lucas para este rollout: la lectura base completa y estable se prioriza para eliminar la espera, y la personalización queda como enriquecimiento posterior. Preparar mañana continúa fuera de alcance: no se crean cartas de días que la persona todavía no abrió hasta definir una tabla separada de precarga.

## Release Candidate — TestFlight 1.0.0 (16) (2026-07-18, Codex)

**Objetivo:** publicar únicamente en TestFlight interno el ritual diario v3 ya aprobado en simulador: carta al derecho/invertida, giro visual al revelar, lectura completa y persistencia en Diario.

**Estado:** `main` integra los PR #22 (backend compatible) y #23 (frontend). El árbol mergeado coincide exactamente con el Release Candidate probado: typecheck verde, 282/282 tests, export iOS correcto y `git diff --check` limpio. Convex production `exciting-bat-311` recibió el backend compatible, que conserva `carta.beats` para builds anteriores y agrega `orientacion` + `ritual` para este build. Esta rama fija explícitamente `1.0.0 (16)` y desactiva el auto-incremento para que el binario local sea reproducible. No se envía a App Review ni se publica en App Store hasta que Lucas apruebe la pasada en TestFlight.

**Gate manual en TestFlight:** carta nueva cerrada con dorso → un tap gira y revela sin mostrar cara+CTA a la vez → orientación y ritual completo → reapertura conserva carta/orientación → Diario muestra el mismo ritual → login y carta natal continúan funcionando.

**Rollback:** mantener disponible el build anterior en TestFlight y no promover el build 16. El backend es aditivo/compatible, por lo que no requiere rollback para que los builds anteriores sigan operando.

## Backend — carta diaria ritual + orientación (2026-07-17, Codex)

**Estado:** implementado y validado en la rama `codex/daily-card-ritual`. `daily.getGuide()` migra a `orbita-daily-guide-v3`: suma `carta.orientacion` (`derecho|invertida`) + `carta.ritual` (esencia, exactamente 3 facetas, enTuDia, consejo y cierre/Umbral). Durante el rollout conserva un `carta.beats` legacy derivado del ritual para que el build 13 siga funcionando; no genera otro contenido ni inventa cruces astrológicos. Se conserva el mazo completo de 78 y la exclusión de los seis días anteriores; la orientación usa una segunda semilla determinística al 50% y `daily.getStrip()` la devuelve para el historial. Payloads v2 se regeneran preservando `revealedAt`. El frontend PR #23 corrigió el Diario para usar el mismo bloque canónico que Home y agregó regresiones de ritual completo. Integración final previa al puente `#22 + #23`: typecheck verde, 276/276 tests y `git diff --check` limpio. Backend desplegado únicamente a Convex dev `dutiful-viper-815`; producción no fue tocada. Release local con JS embebido instalado en `orbita-main-b11` para la pasada manual de Lucas. El puente nuevo está validado localmente con typecheck y 266/266 tests backend; falta repetir la integración conjunta y la aprobación manual antes de mergear o publicar.

**Orden de integración:** repetir la integración `#22 + #23` con el puente legacy, probarla en dev y en el simulador, mergear ambos PR y recién entonces desplegar el backend compatible a producción antes de generar el nuevo TestFlight. El build 13 puede convivir porque seguirá recibiendo `carta.beats`.

**Handoff frontend:** `docs/handoff-claude-carta-diaria-v3.md` fija el contrato exacto, corrige el handoff viejo que todavía hablaba de 22 cartas/`majorById`, documenta la estructura completa de la lectura y deja el checklist conjunto para Claude y Lucas.

## Lectura natal larga — estado de generación honesto (2026-07-17, Codex)

La pasada manual del hotfix de autenticación mostró la plantilla breve (`Núcleo`, `Clima interno`, etc.) como si fuera la lectura natal final. El motor largo de siete capítulos sí está mergeado y Convex dev tiene LLM/modelo/clave configurados; el problema es de estado: `charts.personalityReading()` devolvía el fallback breve mientras la action generaba. Rama aislada `codex/natal-reading-state`: la query devuelve `null` hasta cache `ready` y la action rechaza cualquier fallo para que el frontend existente muestre carga o reintento. Pendiente: tests/typecheck, deploy solo a dev y pasada manual carga → lectura larga; producción no se toca.

## Estado histórico — 2026-07-16 · SUPERADO

Esta sección fue la fuente de verdad **al 2026-07-16** y hoy se conserva como
historial. El estado actual está en el bloque del 2026-08-19, al inicio del
archivo. El contenido posterior a esta sección también es historial y contexto
técnico.

### Mazo completo de 78 cartas — coordinación backend/frontend

- Decisión de producto cerrada por Lucas: Órbita usa el mazo completo de **78 cartas**, no solo los 22 arcanos mayores.
- Backend aislado en `codex/tarot-78-contract`: conserva los ids históricos `0–21`, asigna ids estables `22–77` a los 56 menores y verifica que cada id tenga su asset optimizado. La carta nueva excluye lo que salió en los seis días calendario anteriores (ventana móvil de siete días; puede reaparecer al octavo). Los documentos ya generados no se vuelven a sortear.
- Gate obligatorio: **no mergear ni desplegar el backend antes del frontend compatible**. Claude debe ampliar el mapa estático de imágenes/contenido y todos los consumidores de `carta.id`/`cartaId` a `0–77` en un PR separado; después se prueban ambos lados juntos en dev.
- Validación backend local: typecheck verde, 173/173 tests y `git diff --check` limpio. Producción, Convex dev, EAS, TestFlight y Figma no fueron tocados.

### Recuperación de contenido posterior a la pasada RC

- Lucas validó en el simulador Release de `main`: sesión y datos reales, Home, reveal diario, carta natal, edición, reapertura y logout/login pasaron. Quedan fuera de aprobación la lectura natal corta y la recuperación del archivo anterior.
- Cambio aislado: rama `codex/natal-reading-long-v2`. Backend solamente. La lectura rica que Lucas había visto sí existía en `b341606` y quedó preservada en el snapshot productivo `135861e`; `1d31e2a` la reemplazó después por un motor inline corto. PR #11 recupera el motor original: carta completa (placements, casas, aspectos y precisión), siete capítulos temáticos, parser estricto y pruebas anti-regresión. **Gate visual aprobado por Lucas el 2026-07-16 en el simulador dev**; el pulido editorial posterior queda para otro cambio. No toca Figma, `app/**`, `src/**`, Home, sesión, EAS ni producción.

### Recuperación de lecturas guardadas — backend activo

- Rama `codex/saved-readings-recovery`, rebasada sobre `main` después del PR #11: agrega `readings.listSaved({ limit? })` para que un dispositivo nuevo recupere las lecturas que sí se sincronizaron a Convex y las fusione con el snapshot/local.
- No migra ni fabrica cartas meramente reveladas antes de `dailyGuides`: esas aperturas no fueron persistidas todas por la versión anterior. La tira debe empezar honestamente en su primera fecha disponible.
- Frontend pendiente (Claude, PR separado): consultar solo con sesión resuelta, distinguir `undefined`/error/lista vacía, validar payloads, mergear sin borrar lo local y conservar el orden local primero. Al borrar una guardada debe ejecutar `readings.unsave` con `savedReadingId`/`readingId`; hoy la app borra solo AsyncStorage y una sincronización posterior podría resucitarla.

### Línea base integrada en `main`

- `a8c82b1` — PR #6: sesión, navegación, edición de datos y logout seguro. Lucas validó en simulador sesión existente, datos natales correctos, edición y persistencia, logout y reingreso sin pérdida.
- `22d8036` — PR #7: backend del ritual diario, carta determinística, reveal irreversible, tira histórica y guía diaria por timezone natal.
- `1c36896` — PR #8: recepción del primer día, Home con carta diaria, tira/Diario y protecciones de sesión/caché.
- `c5db178` — PR #11: restauración del motor natal largo desde la carta completa; gate visual aprobado por Lucas en dev.
- No quedan PRs abiertos de esta secuencia. Ninguno de estos merges generó TestFlight ni publicó una nueva versión de producción.

### Próximo orden de producto

1. Actualizar documentación y plan canónico — este PR, solo Markdown.
2. Completar y pulir Carta natal, incluido el bloque de primera visita `QUÉ ES`.
3. Pulir Tránsitos.
4. Pulir Luna.
5. Pulir Perfil, incluido el centrado visual de fecha, hora y ciudad.

Cada punto entra en una rama y un PR independiente. El checkpoint `wip/first-day-double-delivery-20260715` (`3eaf3a4`) es únicamente respaldo y referencia: no se mergea ni se copia en bloque.

### Release y producción

- Backend Convex de producción y dominios Clerk quedaron recuperados y verificados.
- `main` puede recibir PRs chicos y revisados, pero **mergear no equivale a publicar**.
- El 2026-07-16 se restauraron y verificaron las variables públicas de EAS `production`: Clerk live de Órbita y Convex production `exciting-bat-311` (`cloud` + `site`). Development y preview no se modificaron.
- El PR de preparación del build 11 restaura la configuración del último binario distribuido: versión `1.0.0`, build base `10`, ícono real y app solo iPhone. Con `autoIncrement`, el próximo build debe salir como `1.0.0 (11)`.
- No hay todavía un Release Candidate nuevo aprobado para TestFlight o App Store.

### Implementación del proceso

- Etapa 1 completa: documentación operativa y plantilla de PR.
- Etapas 2 a 6 pendientes: CI, protección automática de territorios/`main`, staging con smoke tests, TestFlight con aprobación manual y monitoreo/backups/rollback practicado.

## Proceso operativo aprobado — 2026-07-15

Lucas aprobó incorporar un flujo incremental y sostenible: **un objetivo, una rama, un PR**, con responsabilidades claras para Codex/Claude/Lucas, revisión por alcance, ambientes separados y producción detrás de un Release Candidate probado en TestFlight. La implementación se divide en PRs: (1) documentación + template de PR; (2) CI básico; (3) protección de `main` y territorios; (4) staging/smoke tests; (5) TestFlight con aprobación manual; (6) monitoreo/backups/rollback. Producción sigue primero en modo recuperación: se congelan features nuevas, no los fixes necesarios para levantar y validar el servicio. Fuente operativa nueva: `docs/proceso-desarrollo-y-releases.md`.

## Goal

Keep Órbita easy to continue from a fresh Codex thread without depending on old chat history.

The active project work is broader than this file: continue planning/designing the Órbita app, especially the post-onboarding Home/App Core flow and the asset pipeline, while preserving the decisions from the `Planear app de horóscopo` and `Diagramar home en Figma` threads.

## Historial (referencia; no usar como estado actual)

- 2026-07-15 **PR #6 MERGEADO Y VALIDADO; integración incremental de la Home nueva en curso.** El hotfix de sesión/navegación entró a `main` con squash `a8c82b1` después de la pasada manual de Lucas en simulador: sesión existente, datos natales, edición+persistencia, logout y re-login conservaron el estado. No se generó TestFlight ni se tocaron EAS/producción. El checkpoint visual `wip/first-day-double-delivery-20260715` (`3eaf3a4`) sigue protegido y no se integra en bloque porque contiene frontend, assets y backend anterior a los fixes recientes. Primer corte activo: rama backend `codex/backend-daily-home`, reconstruida sobre `main`, con carta diaria determinística, payload `orbita-daily-guide-v2`, reveal irreversible, tira histórica y fecha calculada en la timezone natal. Próximo orden: PR backend → PR frontend Home/recepción/tira reconciliado manualmente con el hotfix → PR separado de assets/Diario → preparación de release (EAS producción y versión) aparte.
- 2026-07-15 **HOTFIX BUILD 11 — sesión y navegación (sesión frontend Claude, rama `hotfix/build11-session-clean`, reconstruida limpia sobre `origin/main` `2e0ece2` aplicando solo los deltas de `797fe36`+`8a8884e`; incluye el CodeInput de 6 casilleros y la versión final de `useAccount`/`AccountScreen`/`SignInScreen` con login social oculto (decisión 2026-07-14)).** Arregla los fallos de TestFlight build 10: cuenta existente mostrada como `Modo invitado`, `EDITAR DATOS` reiniciando el onboarding, splash clavado en "Órbita" y login sin conectar. Cambios: (1) **Arranque** — `app/index.tsx` decide con `resolveStart()` (`src/domain/sessionStart.ts`, puro y testeado): espera Clerk (con timeout de 8s a entrada), recupera la cuenta desde Convex si hay sesión sin perfil local (`useSignInHydrate` tipado ok/error con reintento visible), y recién ahí rutea Home / continuar alta / entrada. (2) **Sesión central** — `OrbitaSessionProvider` en `_layout` (en `src/hooks/useLiveApp.tsx`): un solo `ensureUser` con 3 reintentos y estado `error` explícito (antes cada consumidor tenía el suyo y el catch fingía `userReady`); `useLiveHome` sostiene la última lectura live en reconexión (no pisa live con mocks). (3) **Entrada estable** — `SplashScreen` ahora monta las puertas estáticas (`Empezar` / `Ya tengo cuenta · Iniciar sesión`) SIEMPRE debajo del video; el intro es un overlay que se descarta por playToEnd/timeout/tap y se reproduce una vez por proceso. (4) **Login** — nueva ruta `app/iniciar-sesion.tsx` monta la `SignInScreen` existente (`useSignInFlow`: email inexistente = error, no crea cuenta); con birthData en Convex hidrata el perfil y entra a Home; sin datos continúa el alta en `/onboarding?resume=datos` (arranca en fecha, saltea crear-cuenta si ya hay sesión). (5) **Editar datos** — nueva ruta `app/editar-datos.tsx`: editor independiente precompletado (fecha/hora/lugar con búsqueda Photon), cancelar no toca nada; **con sesión, Guardar ESPERA la confirmación del backend** (`useBackendPersistStrict`, propaga errores; la variante que traga errores queda solo para el onboarding) y si falla no aplica nada — error visible + Reintentar; en invitado guarda solo local. Preserva coords remotas si el lugar no cambió (`src/domain/birthEdits.ts`, puro y testeado); `Perfil → EDITAR DATOS` apunta acá (nunca más al onboarding). (6) **Perfil/logout** — CUENTA con 3 estados (conectando / sesión / invitado, nunca afirma invitado mientras carga; email sale de Clerk directo, no del gate live), link "Iniciar sesión" para invitados. Logout SIN pérdida y en orden seguro — **archivar → signOut → limpiar**: el diario y las lecturas guardadas NO viven en Convex, así que primero (con la sesión viva) se archivan en un **snapshot local por cuenta** (`src/domain/accountLocalData.ts` puro + testeado, clave `orbita:account-snapshot:<clerkUserId>`; `planLogoutArchive` decide archive/skip/error); si el snapshot no se puede escribir o hay datos sin userId se ABORTA el logout con error/reintento visible (nunca pérdida silenciosa), y un fallo de `signOut` también mantiene la sesión con reintento (no se finge que salió bien). Solo tras un signOut exitoso se limpia el estado activo (nada visible para el próximo usuario) y se vuelve a la entrada. Reingresar con la misma cuenta en este teléfono restaura y mergea el snapshot (lo nuevo primero, dedupe por id, respeta límites 60/120; perfil/carta ganan los de Convex); el id para restaurar sale de `getOrCreateCurrentUser` (backend) vía `useSignInHydrate`, NO de `useAuth` — justo después de `setActive` React puede no haber re-renderizado. El invitado puro nunca ve el botón. Verificación: `pnpm typecheck` verde, `pnpm test` 95/95 (37 nuevos: resolver + editor + snapshot/plan de logout), export iOS OK, y pasada visual en **Release local** (simulador propio `orbita-hotfix-b11`): instalación fresca → entrada con puertas OK, relanzar OK, perfil guest → Home directo OK, Perfil muestra datos locales OK. **Pendiente pasada humana de Lucas:** login real con código de email, editar datos guardar/cancelar en device, logout end-to-end, upgrade sobre sesión existente, red lenta, iPhone físico. Cuarta pasada (revisión Codex de la reconstrucción): (a) perfil local con DUEÑO (`orbita:profile-owner`, fuera de UserProfile) — una sesión activa solo entra a Home con un perfil PROPIO; guest/legado/ajeno se reconcilia SIEMPRE con birthData de Convex (el remoto manda), el guest-upgrade adopta explícitamente el perfil en el sign-in, y un perfil con dueño SIN sesión (logout a medio limpiar) se PURGA al arrancar; (b) Editar datos espera la resolución del birthData remoto antes de habilitar Guardar (`birthSaveGate`): sin doc resuelto no se manda timezone undefined ni se recalcula la carta con la timezone del teléfono; (c) fallo de resetApp post-signOut controlado (el dueño marcado en disco garantiza la purga al reiniciar); (d) errores de createProfile en la recuperación inicial van a la pantalla de reintento (recovery nunca queda en loading). Tests 110/110. Quinta pasada (revisión Codex): (a) P0 — el timeout de Clerk YA NO equivale a signed-out: sin `isLoaded` real la decisión es `auth-timeout` (pantalla no destructiva con REINTENTAR); `purge-local` solo puede ocurrir con Clerk resuelto y sin sesión (test exacto: perfil con dueño + timeout → nunca purge-local); (b) P1 — la espera de birthData en Editar datos tiene tope de 10s (`birthSyncUx`): pasa a error visible con 'Reintentar sincronización' (re-dispara ensureUser) manteniendo la protección de timezone; nunca 'Sincronizando…' eterno; (c) P2 — `OnboardingFlow.submit` marca el dueño del perfil cuando hay sesión (alta con cuenta o resume=datos): el próximo arranque lo reconoce como propio. Tests 116/116. Sexta pasada (revisión Codex): carrera post-verify en OnboardingFlow — después de `verify/oauth → setActive`, el render inmediato del paso 14 puede ver `useAuth` stale y el perfil se creaba con owner null. Ahora el flow registra que la sesión se activó (ref al retornar ok el verify/oauth, cubre email/código, OAuth y resume=datos) y `resolveProfileOwnerAtCreation` decide: userId conocido → owner directo; sesión activa sin userId → perfil sin dueño con ADOPCIÓN PENDIENTE que AppState ejecuta apenas useAuth publica el userId (`shouldAdoptPendingProfile`); si la app muere en esa ventana, el arranque reconcilia contra Convex como fallback. Test exacto de la secuencia stale→userId→owner correcto. Tests 120/120. Séptima pasada (revisión Codex): carrera de ESCRITURA en createProfile — publicaba `pendingOwnerAdoption` antes de terminar de persistir; la adopción podía escribir el userId en disco y la escritura inicial (owner null), todavía en vuelo, pisarlo (memoria bien, disco sin dueño). Ahora `commitProfileCreation` (puro, inyectable) fija el orden: persistir perfil + dueño inicial y RECIÉN después publicar el estado que habilita la adopción; test con storage demorado verifica que el dueño en disco queda correcto. Tests 122/122. PR #6 abierto (borrador, reemplaza al #5). Octava pasada (hallazgos de la pasada visual): (a) editar-datos ahora scrollea (ScrollView + KeyboardAvoidingView iOS + keyboardShouldPersistTaps, header fijo, sin spacer flex) — verificado en iPhone SE 4.7\" y 17 Pro: Lugar/resultados/Guardar/Cancelar alcanzables, búsqueda y selección de ciudad OK; (b) la recuperación del arranque tenía DOS bugs reales: el efecto se auto-cancelaba (recovery en sus propias deps → cleanup marcaba cancelled y el resultado del hydrate se descartaba → spinner eterno) y las llamadas Convex encoladas sin conexión no rechazan nunca → ahora hydrate corre con tope por llamada (5s) y presupuesto total (15s) vía withTimeout puro (+3 tests) y el efecto no se re-dispara a sí mismo. Verificado end-to-end en release Hermes: reinstalación con sesión en keychain y sin perfil local → recover → Home LIVE con datos reales. Tests 125/125. Novena pasada (revisión Codex): el presupuesto de la recuperación ahora es ESTRICTO — `runSessionAttempts` (puro, inyectable) acota cada llamada Y cada pausa al tiempo restante (antes un intento que arrancaba a los ~10,7s podía correr dos esperas de 5s completas → ~21,4s hasta 'Reintentar'); hydrate corre sobre ese ciclo y hay tests del ciclo completo (intentos colgados, pausa acotada, éxito, falla transitoria y forma de dos llamadas por intento: total siempre ≤ presupuesto + scheduler). Tests 130/130. Listo para la pasada física; PR #6 sigue en borrador; build/TestFlight sin generarse.
- 2026-07-09 **EAS iOS config desbloqueado.** El build `npx eas-cli build --platform ios --profile production --auto-submit` fallaba antes de credenciales/App Store porque `expo config --json` no podía cargar `plugins/withStripUnusedEntitlements.js`: el plugin local importaba `@expo/config-plugins`, paquete no resoluble desde la raíz con la instalación actual. Codex cambió el import a `expo/config-plugins` sin tocar dependencias ni lockfile. Verificación: `node -e "require('./plugins/withStripUnusedEntitlements.js')"` devuelve función y `node node_modules/expo/bin/cli config --json` termina OK. Próximo paso: volver a correr el build EAS; los warnings de `.npmrc`, Expo Go y el `project.pbxproj` duplicado parecen no bloqueantes.
- 2026-07-07 **Clerk CLI/app auth preparado para app nativa.** Codex ejecutó `npm install -g clerk` (CLI sigue en `1.5.0`, up-to-date), reautenticó la CLI con OAuth como `lucaszramos11@gmail.com`, confirmó link a Clerk app `Orbita` (`app_3G2mZM0b44zGplJmkpwPFuamFYG`) y `clerk doctor` quedó OK salvo warnings no bloqueantes (sin producción configurada, shell completion). `.env.local` tiene `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` y `EXPO_PUBLIC_CONVEX_URL`; Convex dev `dutiful-viper-815` tiene `CLERK_JWT_ISSUER_DOMAIN`. La app ya tiene `@clerk/expo`, `expo-secure-store`, plugin `@clerk/expo`, scheme `orbita`, `BackendProviders` con `ClerkProvider` + `ConvexProviderWithClerk`, y onboarding email+código en `src/onboarding/useAccount.ts`. Verificación: `pnpm typecheck` verde; `pnpm test` pasó fuera del sandbox con 54/54.
- 2026-07-07 **Backend carta natal real sincronizado y confirmado con token nuevo.** Codex sincronizó `../orbita-backend` contra `dutiful-viper-815` con `pnpm exec convex dev --once --typecheck disable`, incluyendo el fix de `runAstrologyApiProvider` que preserva carta natal real aunque `natal_transits/daily` falle. El primer test live con Sofía cayó por `TRIAL_REQUEST_LIMIT_EXCEEDED`; Lucas creó un token nuevo del proyecto y Codex lo cargó en Convex dev como `ASTROLOGY_API_KEY` + `ASTROLOGY_API_LOCATION_KEY` sin guardarlo en archivos. Re-test live `publicLab:previewDailyHome` con Sofía (17/07/2002 13:42 Lomas de Zamora) pasó: `provider.status="success"`, `mode="provider_real"`, `natalBase={ sun:"Sol en cancer", moon:"Luna en escorpio", ascendant:"Ascendente en escorpio", accuracy:"calculated" }`. Handoff actualizado en `docs/backend-carta-natal-real.md`. Próximo: confirmar en UI onboarding/reveal; luego sacar debug `b8`/commitear front.
- 2026-07-07 **App nativa: reveal real + Horóscopo de personalidad (sesión frontend Claude, `main`).** Réplica de lo logrado en web: (1) **Reveal nativo con tríada real SIN login** — `src/onboarding/useAccount.ts` suma `useOnboardingComputeTriad` (usa `publicLab.previewDailyHome`, público) + parser de signo; `OnboardingFlow.tsx` dispara el cálculo al llegar a "Personalizing"(11) y pasa la tríada calculada a `ChartPreviewScreen` (`chart={computed ?? chartPreview}`), así Luna/Ascendente salen reales aunque no haya sesión (antes solo con login vía `charts.current`). (2) **`app/reading/personalidad.tsx`** reescrita a live: split estilo LiveGate (`useLiveApp.isLive`), consume `charts.personalityReading` + `charts.current` + `charts.valuesMap`, dispara `generatePersonalityReading`, reusa `NatalWheel`/`mapNatalChart`/`Radar` (RN-svg de los componentes web) → rueda real + 7 sectores LLM + radar, con fallback a mocks. `pnpm typecheck` + `pnpm test` 54/54; rutas responden 200 en web (RNW), sin errores Metro. **Verificación simulador: pendiente Lucas** (EAS Update / Expo Go). Commits front `ba1afc9` + este pendiente de commitear.
- 2026-07-07 **Horóscopo de personalidad (web) + reveal real del onboarding web (sesión frontend Claude, `main`).** (1) **Reveal onboarding web** (`src/components/web/orbita-onboarding.tsx`): ahora calcula la tríada REAL (Sol/Luna/Ascendente) sin login vía `publicLab.previewDailyHome` (`backend.computeTriad`), el paso "Calculando" espera a que esté lista (sin parpadeo de mock), acentos normalizados (Géminis/Cáncer…), geocoding de ciudad pasó a **Photon** con `Accept-Language: es` (español) + coords reales pasadas al cálculo. Orden de pasos: …hora → antes/después → cuenta → calculando → reveal → paywall. Hay un marcador DEV verde "b12" arriba a la derecha (sacar antes de mergear). Nav por `?step=` para debug. (2) **`/personalidad`** (`src/components/web/orbita-personality.tsx`) reescrita como **lectura larga por 7 sectores**: rueda natal real (reusa `NatalWheel` de `orbita-chart`, exportada) + secciones interpretativas + mapa de valores (reusa `Radar` de `orbita-values`, exportado). Consume `charts.personalityReading` + `charts.current` + `charts.valuesMap` (promovidas a `appApi`). `PersonalitySection` suma `questions?`. Mock rico en `src/content/personalityMock.ts` (7 secciones = target). `pnpm typecheck` + `pnpm test` 54/54. **LLM natal IMPLEMENTADO** (Claude, en worktree backend `../orbita-backend` feature/api): `convex/lib/aiGateway.ts` suma `generateNatalReadingWithGateway` + prompt/parser de las 7 secciones temáticas; `convex/charts.ts` suma `generatePersonalityReading` (action pública: genera vía AI Gateway GPT-5.4 y cachea en `natalInterpretations`), `getNatalReadingState` (internalQuery), `persistNatalReading` (internalMutation), y `personalityReading` (query) ahora devuelve la cache LLM `ready` o cae a la plantilla. Front: `appApi.charts.generatePersonalityReading` + `PersonalityWithBackend` la dispara una vez al montar (la query se actualiza reactiva al cachearse). Back `pnpm typecheck` limpio + `pnpm test` 57/57. **Pendiente Lucas:** deploy — `cd ../orbita-backend && pnpm exec convex dev --once --typecheck disable`. Sin tocar archivos dirty de Codex (orbita.ts/schema.ts). **Pendiente front:** replicar reveal real + carta completa al onboarding/app NATIVA; sacar marcador "b12".
- 2026-07-07 **Primera experiencia — Fase 1 (preview de carta → paywall) implementada en app nativa (sesión frontend Claude, en `main`).** Decisiones de producto: hard paywall (pagás para entrar), preview real de la carta y cortar el resto antes del paywall, sin cablear pago real todavía (el CTA sigue entrando). Cambios: en `src/onboarding/OnboardingFlow.tsx` el paso 14 ahora muestra primero un `ChartPreviewScreen` nuevo y, al tocar "Ver mi carta completa", revela el `PaywallScreen` (mismo índice de progreso, sin sumar paso numerado); al entrar al paso 14 se dispara el cálculo REAL de la carta vía `useBackendPersist` (antes solo corría en `submit()` post-pago). Nuevo `src/onboarding/screens/ChartPreviewScreen.tsx`: tríada real Sol/Luna/Ascendente (de `charts.current`) + carta completa cortada con candado PLUS (casas/aspectos/personalidad/valores); degrada a solo-Sol honesto si el usuario saltea la cuenta / no hay sesión. Nuevo hook `useOnboardingChart()` en `src/onboarding/useAccount.ts` que lee la tríada real. Copy del paywall alineado (saqué "Sueños" que no existe → "Vínculos, calendario y fase lunar"). `pnpm typecheck` verde, `pnpm test` 54/54. **Pendiente (Fase 1 web + Fase 2):** paridad del reveal real en `src/components/web/orbita-onboarding.tsx`; payoff post-pago a dato real (tabs Carta/Tránsitos/Vínculo/Calendario/Void + `reading/{valores,personalidad,transito,rueda}`) extendiendo `mergeLiveAppData`, usando lo que Codex dejó live (`relationships.synastry`, `calendar.getMonth`, `void.ask`) + Capa 1. Fase 3 (después): pago real Stripe/RC + gating server-side.
- 2026-07-07 **Inventario de capacidades de la API + contrato de capacidades ampliadas (sesión frontend Claude, en `main`).** Se mapeó exhaustivamente qué puede traer AstrologyAPI (occidental tropical) cruzándolo con lo cableado hoy: doc nuevo `docs/api-capacidades-orbita.md` (catálogo ✅/⚪, 3 capas real/plantilla/falta-motor, bajada a onboarding free-vs-paywall, guardrail sobre texto crudo). Hallazgo clave: casi todo lo que figuraba "falta motor" **sí sale de la API, solo falta cablear el endpoint** (fase lunar, pronóstico largo, revolución solar, sinastría). **Pedido a backend (Codex):** implementar 4 funciones nuevas contra endpoints ya disponibles — `sky.getMoonPhase` (`moon_phase_report`, free), `forecast.getLongRange` (`life_forecast_report`, premium; reemplaza el contrato `needs_provider_endpoint`), `charts.solarReturn` (`solar_return_*`, premium), `content.sunSignDaily` (`sun_sign_prediction/daily`, free). Contrato del front listo: tipos+refs en `src/services/skyRefs.ts`, mocks en `src/content/{moonPhase,forecast,solarReturn,sunSign}Mock.ts`, stub en `convex/schema.ts` (bloque "Capacidades ampliadas") y entrada en `convex/CHANGELOG.md` (2026-07-07). Front puede construir contra los mocks mientras tanto. `pnpm typecheck` verde. **Próximo paso natural (post-implementación + QA en /backoffice):** reveal enriquecido del onboarding (web+app) mostrando la Capa 1 real (tríada Sol/Luna/Asc + rueda + previews) en vez del reveal solo-Sol actual, y cableado live de las pantallas nativas que hoy son mock directo.
- 2026-07-06 **Git reconciliation (Fase 0.1 del mega plan de lanzamiento) COMPLETADA.** `origin/main` era un commit huérfano "Web B0 deploy snapshot" sin historia común con el main real; quedó confirmado que estaba superado por `feature/web` (solo 4 archivos stale únicos, ningún asset). Se integró `main = baseline + feature/api (backend) + feature/web (frontend)` con dos merges `--no-ff`; los únicos conflictos fueron 7 archivos grises (docs de estado resueltos por union, `_generated` tomado de feature/api, schema/package/lock auto-mergeados limpio). `pnpm typecheck` limpio y `pnpm test` 44/44. Se corrigió el export web: `pnpm add -D -E @babel/types@7.29.7` (había 7.29.7 y 8.0.0 en el store pnpm y el hoisting quedaba ambiguo → `expo export --platform web` fallaba con "Cannot find module @babel/types"); ahora el export genera `dist/` OK. El bug de import de Clerk (`@clerk/clerk-expo`) ya no existe: feature/web trae la versión correcta con `@clerk/expo` + `@clerk/expo/token-cache`. Force-push `46dcb2f→877e4dc` a `origin/main` (aprobado por Lucas); Vercel auto-deploya Producción desde origin/main (confirmado por `vercel[bot]` en la API de deployments), así que el push dispara un redeploy con la estructura integrada. Los tres worktrees (`.`/main, `../orbita-backend`/feature/api, `../orbita-frontend`/feature/web) quedaron alineados en `877e4dc` y las tres ramas pusheadas a origin. Backups locales en tags `backup/main-preintegration`, `backup/feature-api`, `backup/feature-web`, `backup/origin-main-snapshot`.
- 2026-07-07 Payments backend sync completed in `../orbita-backend` on `feature/api`: `pnpm typecheck` passed, `pnpm test` passed outside sandbox with 54/54, `pnpm exec convex dev --once --typecheck disable` synced RevenueCat/Stripe payment functions to Convex dev `dutiful-viper-815`, and Convex added the new `paymentEvents`/`subscriptions` indexes. Migration `pnpm exec convex run migrations:renamePlusToOrbitaPro --deployment dutiful-viper-815` completed with `subscriptions: 0` and `contentModules: 0`, so no legacy `plus` rows were present. Sync regenerated `convex/_generated/api.d.ts`; commit that generated file before merging `feature/api` to `main`.
- 2026-07-06 RevenueCat React Native integration handoff added at `docs/revenuecat-react-native-handoff.md`. It is scoped to frontend/Claude because the requested SDK wiring touches `app/**` and `src/**`. The handoff covers npm install, Expo dev-client/native rebuild requirements, public SDK key `test_abWYVQjsvuJRVRjJDXjuIIiPPvR`, entitlement recommendation `orbita_pro` display name `Orbita Pro`, products `lifetime`/`yearly`/`weekly`, Offering `default`, CustomerInfo/entitlement checks, Paywalls, Customer Center, restore, manual custom-paywall purchase flow, and Convex webhook best practices. Codex did not edit frontend files.
- 2026-07-06 AstrologyAPI MCP was added to local Codex config as `astrology` with a masked `x-astrologyapi-key` header. MCP probing confirmed `geo_details` and returned Buenos Aires results with `place_name`, `latitude`, `longitude`, `country_code`, and `timezone_id`. Backend `../orbita-backend` was updated so `places.resolve({ query })` supports `geo_details`/`geonames`, sends `place` with numeric `maxRows: 10`, normalizes `place_name` + `timezone_id`, uses `ASTROLOGY_API_KEY` as the Location `x-astrologyapi-key` by default, keeps `ASTROLOGY_API_LOCATION_KEY` only as an optional override, and calls MCP `geo_details` first because Convex REST body parsing produced `maxRows: null`. `ASTROLOGY_API_LOCATION_URL=geo_details` is set in Convex dev `dutiful-viper-815`. Local `pnpm typecheck` passed and `pnpm test` passed outside sandbox with 41/41. Real sync used `pnpm exec convex dev --once --typecheck disable`; `pnpm exec convex run places:resolve '{"query":"Buenos Aires, Argentina"}' --deployment dutiful-viper-815` now returns `status: "success"` with Buenos Aires coordinates and `America/Argentina/Buenos_Aires`.
- 2026-07-06 Natal chart live path implemented in `../orbita-backend` on `feature/api`: `charts.calculateOrCreateNatalChart()` is now a public Convex Action backed by AstrologyAPI instead of the stub. It loads the latest `birthData`, computes numeric `tzone` from IANA timezone at birth date/time, tries `western_horoscope` first and falls back to `natal_chart_interpretation` + `western_chart_data`, persists the sanitized normalized chart in `natalCharts`, and upserts `profileAstrologyCaches`. `charts.current()` remains the frontend read path. Unknown birth time uses noon only for provider planet positions and omits Ascendant/houses from the returned chart. `pnpm typecheck` passed; `pnpm test` passed outside sandbox with 42/42; `pnpm exec convex dev --once --typecheck disable` synced to `dutiful-viper-815`; `function-spec` shows `charts.calculateOrCreateNatalChart` as public Action plus internal query/mutation helpers. Codex did not run the authenticated Lucas chart calculation because it would send real birth PII to AstrologyAPI/Convex; test it from logged-in frontend or approve explicitly.
- 2026-07-06 Daily transits live path implemented in `../orbita-backend` on `feature/api`: `transits.getToday({ localDate })` changed from cache-only query to public authenticated Action so it can call AstrologyAPI `natal_transits/daily`, normalize begin/exact/end transit windows, persist `transitReadings`, and update/create `dailyReadings` for Home using the same provider-backed payload. Frontend/Claude should call it as an action for live mode, then `home.getDaily({ localDate })` can read the refreshed daily payload. `charts.valuesMap()` and `charts.personalityReading()` already derive from the latest persisted `natalCharts.payload`, so with the AstrologyAPI chart they are real-chart-derived rather than separate stubs. `pnpm typecheck` passed; `pnpm test` passed outside sandbox with 42/42; `pnpm exec convex dev --once --typecheck disable` synced to `dutiful-viper-815`; `function-spec` shows `transits.getToday` as public Action plus internal cache helpers. Commit `be95019` was pushed to `origin/feature/api`. PR is still blocked: rebasing `feature/api` over `origin/main` hit broad add/add conflicts across app/src/docs/schema, so the GitHub main reconciliation (#9) must happen separately before opening a clean PR.
- 2026-07-06 Voz editorial diaria v2 implemented in `../orbita-backend` on `feature/api`: Home/topics/transit/personality/values copy now uses voseo rioplatense, tildes, opening question marks, and more direct second-person phrasing. `DAILY_READING_EDITORIAL_VERSION` is now `orbita-daily-editorial-p0-v2`, AI Gateway daily prompt is `orbita-lab-daily-home-llm-v2`, and daily transit provider cache is `astrologyapi-western-daily-transits-v2` so regenerated days do not reuse old P0 copy. The missing local guide was added at `docs/voz-copy-orbita.md` from the pasted brief. `pnpm typecheck` passed; `pnpm test` passed outside sandbox with 42/42; `pnpm exec convex dev --once --typecheck disable` synced to `dutiful-viper-815`. Commit `872d405` was pushed to `origin/feature/api`.
- 2026-07-06 Voz editorial diaria v3 implemented in `../orbita-backend` on `feature/api`: fixes the Home repetition where `header.subheadline` reused `home.energy`. Backend now separates `home.subheadline` from `home.energy`, maps Home/Lab header subtitling from `home.subheadline`, and bumps daily versions to `orbita-daily-editorial-p0-v3`, `orbita-lab-daily-home-llm-v3`, and `astrologyapi-western-daily-transits-v3` so regenerated days do not reuse the repeated v2 cache. Added iteration 2 notes to `docs/voz-copy-orbita.md`. `pnpm typecheck` passed; `pnpm test` passed outside sandbox with 42/42; `pnpm exec convex dev --once --typecheck disable` synced to `dutiful-viper-815`. Commit `5148210` was pushed to `origin/feature/api`.
- 2026-07-05 Backend Web B0 Live QA helper implemented in `../orbita-backend` on `feature/api`: added `convex/webB0Seed.ts` with allowlisted `webB0Seed.persistCurrentUserSnapshot({ localDate, timezone, birthData, chartPayload, dailyReadingPayload, markPlus? })`, updated `charts.current()` to return the latest current chart, and added a sanitization test so provider `raw`/`request` data is stripped before app-facing persistence. `pnpm typecheck` passed; `pnpm test` passed outside the sandbox with 39 tests and 0 failures. `pnpm exec convex codegen --typecheck disable` initially completed and updated `convex/_generated/api.d.ts`; after a final logic refinement, the second sync/code upload was blocked by environment policy, so Lucas should rerun `pnpm exec convex codegen --typecheck disable` or `pnpm exec convex dev --once --typecheck disable` locally before Claude relies on the live deployment. Convex dev metadata/data reads confirmed deployment `dutiful-viper-815`, the real QA user row for `lucaszramos11@gmail.com`, and server env names for AstrologyAPI except `ASTROLOGY_API_LOCATION_URL`. Running the actual QA seed with Lucas identity + birth data from Codex was blocked by environment policy because it would transmit real personal identity and birth data to an external Convex deployment; Lucas must run the preview/seed locally, or explicitly approve that PII transfer after accepting the risk. Commit `1e6356d` was pushed to `origin/feature/api`; PR creation failed because the GitHub remote currently has only `feature/api` and no `main` branch/base ref.
- 2026-07-05 App Core V4.7 EAS Update published from `../orbita-frontend` to branch/channel `preview`: group `9e5b5f49-969f-45a4-b964-5017ab3f242e`, runtime `exposdk:54.0.0`, iOS update `019f33ff-069a-7369-8c6a-3a98b348b9a7`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/9e5b5f49-969f-45a4-b964-5017ab3f242e`, message `App core V4.7 — 5 tabs + detalles + estados`. Publish required explicitly adding `@babel/plugin-transform-react-jsx@7.29.7` in the frontend worktree because EAS export could not resolve the Babel JSX transform. Simulator Expo Go was updated to `54.0.7`; screenshots were taken from Expo Go preview after seeding a local-only test profile in Simulator AsyncStorage. First visual note: bottom tab labels are clipping/truncating near the edges on iPhone 17 Pro Simulator.
- Backend Web B0 contract functions started as proposals in `convex/CHANGELOG.md` and are now implemented locally in `../orbita-backend` on `feature/api`: `charts.valuesMap()`, `charts.personalityReading()`, `transits.getToday({ localDate })`, and `places.resolve({ query })`. They stay inside `convex/**`, add no tables, adapt existing natal/transit payloads to the TS shapes requested by `src/services/appRefs.ts`, and keep provider raw data out of public responses. They are not considered live for frontend/integration until the backend changes are committed, PR'd, merged, and synced to Convex dev.
- Backend `/lab` contract pass implemented on 2026-07-05: added Convex cache tables for app mobile (`profileAstrologyCaches`, `natalInterpretations`, `dailyLlmReadings`, `transitTimelineCaches`, `globalSkyCaches`), plus `chartWheelData`, `valueRadar`, versioned Gateway natal interpretation plan, and `longRangeTimeline` provider contract. `/lab` remains read-only/no-persist; real app/backoffice will persist.
- Timeline largo decision: do not invent dates with LLM. Phrases like "esto pasa una vez al anio", "hasta marzo", or "vuelve en 2027" require an AstrologyAPI range/forecast endpoint or another approved astro provider/motor. Current backend only implements weekly/monthly provider previews and exposes the long-range gap explicitly.
- Frontend contract handoff: `chartWheelData` is backend-produced renderer data for SVG/canvas (absolute degrees, houses, aspects, labels, colors/styles). `valueRadar` is backend scoring v1: trines/sextiles add harmony, squares/oppositions add stress, Saturn/hard aspects add restrictions.
- 2026-07-06 App Core V4.7 implementado COMPLETO en código (sesión frontend Claude), pantalla por pantalla con gate visual simulador-vs-Figma. Commits `fedd509..3546510` en `feature/web`: checkpoint del WIP; Home 2.0 (hero luna full-bleed + wash, eyebrow `HOY · PARA <SIGNO>`, topics con glifos, copy V4.7); banco editorial por signo (`src/content/signHomeBank.ts`, 12×3 variantes headline/body/clima, rota por seed en `createHomeReading`); `catalog.ts` reescrito en rioplatense correcto (tildes/voseo, sin tuteo); Carta y Tránsitos con `FullBleedHero` + `GlyphRow` compartida; Void como 3 momentos (Entrada → Escuchando animado → Respuesta oracular con tríada real del perfil; contrato pendiente `void.ask`); Estados rediseñados (emblema + glow, centrados, chip PLUS); Vínculo sin capa social (ruta `vinculo-add` ELIMINADA, CTA → `vinculo-result`); Perfil y Luna con heros inmersivos; Exploración en nativo: `/reading/transito` (escena espacial svg + timeline + tierra), `/reading/rueda` (rueda natal react-native-svg), `/reading/personalidad`, `/reading/valores` (radar 8 ejes + impulsa/pesa), cableados desde Por área / Carta / Home. Bugfix compartido: `backgroundColor` directo sobre `Pressable` no pinta en iOS new-arch — los pills usan View interno (aplicado en `kit.tsx` y Home). Mocks alineados al copy V4.7. `pnpm typecheck` + 14/14 tests verdes en cada commit. Figma V4.7 también actualizado hoy: Void estilo Co-Star (3 frames en 01·Inicio), estados rediseñados, fondos en todas las pantallas, pasada dura de copy, Agregar persona eliminada, secciones reordenadas.
- 2026-07-05 App Core V4.7 EAS Update published to branch/channel `preview`: group `9e5b5f49-969f-45a4-b964-5017ab3f242e`, runtime `exposdk:54.0.0`, iOS update `019f33ff-069a-7369-8c6a-3a98b348b9a7`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/9e5b5f49-969f-45a4-b964-5017ab3f242e`, message `App core V4.7 — 5 tabs + detalles + estados`. Publish required explicitly adding `@babel/plugin-transform-react-jsx@7.29.7` because EAS export could not resolve the Babel JSX transform. Simulator Expo Go was updated to `54.0.7`; screenshots were taken from Expo Go preview after seeding a local-only test profile in Simulator AsyncStorage. First visual note: bottom tab labels are clipping/truncating near the edges on iPhone 17 Pro Simulator.
- Startup memory files have been added: `AGENTS.md`, `PROJECT_CONTEXT.md`, `CURRENT_TASK.md`, and `docs/architecture.md`.
- `README.md`, `docs/contexto-actual.md`, `docs/figma-context.md`, and `docs/decision-log.md` were adjusted so the new bootstrap files are discoverable and the old prompt-only Figma page is treated as historical.
- Existing context docs already describe the current product direction, Figma file, onboarding flow, Home V1.1, asset library, Archive 7, Archive 9, and the symbolic asset library.
- A local Git repository now exists; current workspace inspection reports modified `CURRENT_TASK.md` and `app/onboarding.tsx` while this onboarding polish is in progress.
- Latest visible thread context shows an active request in `Diagramar home en Figma` to catalog a new `archive (10)` asset batch. Do not assume that work is complete unless you inspect the workspace/docs/Figma state.
- Backend/connections analysis was added in `docs/backend-todo.md`.
- Convex + Clerk was selected and implemented as the new backend/auth foundation. Supabase remains legacy/reference only.
- Base Convex schema and functions now exist for users, onboarding drafts, birth data, natal chart snapshots/stub, readings, saved readings, journal, relationship profiles, notification preferences/devices, subscription stub, and content modules.
- Expo root layout now mounts optional Clerk + Convex providers when `EXPO_PUBLIC_CONVEX_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` are configured; local MVP rendering still works without those envs.
- Figma API inspection in this thread only listed `UX V4.3 - Órbita Onboarding Copy`; `UX V4.5 - Órbita App Core` and `UX V4.6 - Órbita Asset Library` remain documented sources, but were not visible as top-level pages through the Figma tool in this session.
- A new Figma page was created for the onboarding visual pass: `UX V4.4 - Órbita Onboarding Immersive Pass`.
- The V4.4 pass keeps onboarding flow/copy/structure but changes visual treatment so assets read as integrated backgrounds, textures, diagrams, or symbols instead of square image cards.
- Screens `01`, `02`, `03`, `04`, `05`, `06`, `07`, `08`, `09`, `10`, `11`, `12`, `13`, `14`, and `15` were updated in the duplicated Figma page. The strongest changes are `01`, `04`, `08`, `10`, `11`, `12`, `13`, and `15`.
- Direct upload of local PNG assets to the Figma MCP upload endpoint was initially blocked by sandbox networking, but the focused `05-09` onboarding pass succeeded after explicit escalated approval. The broader V4.4 pass still contains some in-file reused fills outside this `05-09` slice.
- Screens `05`, `06`, `07`, `08`, and `09` in `UX V4.4 - Órbita Onboarding Immersive Pass` now use real local project assets: `orbita_daily_texture_b.png`, Archive 10 Sol `idx25`, Archive 10 Horizonte `idx27`, and Archive 10 Anillos `idx15`.
- `09 / Birth Time Picker` now treats `No sé la hora / Usamos una carta aproximada.` as a proper full-width button instead of a split rectangular control.
- `15 / Onboarding Payment / Scroll` in `UX V4.4 - Órbita Onboarding Immersive Pass` was redesigned as a dark premium full-bleed paywall using the real local Archive 7 `idx62` payment asset. Pricing, benefits, how-it-works, legal, and CTA were restyled with glass/dark/copper treatment while preserving the existing editable payment copy.
- A React Native implementation handoff for the V4.4 onboarding beta now exists at `docs/onboarding-v44-react-native-handoff.md`. It maps the `01-15` flow to app implementation, freezes screen copy, lists exact local asset paths, calls out the legacy app onboarding as replaceable, and includes the updated paywall copy direction that avoids transit-heavy claims.
- `app/onboarding.tsx` has now been replaced with the V4.4 Órbita beta flow: 15 screens, local state, editable copy, real selected assets, payment stub, and final `createProfile` into the existing local app state.
- Expo Web support was added so the local beta can be opened in a browser: `react-native-web`, `react-dom`, `@expo/metro-runtime`, and direct `@react-native/assets-registry` for PNG resolution under pnpm.
- iOS Simulator preview is now working through Expo Go SDK 51 on `iPhone 17 Pro`. Extra fix: `expo-linking` was added and `src/services/backendProviders.tsx` now lazy-loads Clerk/Convex only when env keys exist, so local beta mode does not import Clerk native modules.
- Current technical gap: the app is now Órbita-branded in `app.json`, onboarding, storage keys, and visible local screens. Convex/Clerk backend contracts exist, but screens have not yet been migrated from `AsyncStorage` to Convex. Geocoding/timezone provider, real natal chart calculation, App Store/Google Play subscriptions, analytics, and production content workflows remain unimplemented.
- Latest cleanup renamed app config/package/storage to Órbita, updated visible Home/Explore/Journal/Profile/tab copy, fixed unaccented signal copy in local content, and removed literal previous-brand references from active docs.
- Figma page `UX V4.4 - Órbita Onboarding Immersive Pass` now has a visible implementation note: `Órbita / RN beta implementation note`, marking the React Native beta and iOS Simulator verification.
- Convex is now linked locally to dev deployment `dutiful-viper-815`; codegen produced `convex/_generated/`, but final function upload to Convex Cloud must be run by the user locally because Codex is blocked from transferring backend code externally.
- Backoffice Lab V1 is now implemented locally as a web route at `/backoffice`: it is an internal model lab for test people, normalized birth inputs, versioned stub chart snapshots, daily reading payloads, model gap inspection, and saved lab runs.
- Backoffice Lab V1 added isolated Convex tables/functions for `labSubjects` and `labRuns`, guarded by Clerk auth plus `ORBITA_BACKOFFICE_ALLOWED_EMAILS` / `ORBITA_BACKOFFICE_ALLOW_ALL` server envs. It uses generic Convex references so the Expo code can typecheck before `convex/_generated` exists.
- `/backoffice` now shows Clerk's web sign-in UI when Convex/Clerk public envs exist but there is no active Clerk session.
- `/backoffice` now uses Clerk sign-in directly; the operational access path is signing in with `lucaszramos11@gmail.com`, which must stay in `ORBITA_BACKOFFICE_ALLOWED_EMAILS` on Convex.
- Backend setup runbook now lives at `docs/backend-setup.md`.
- Clerk CLI is installed and authenticated as `lucaszramos11@gmail.com`; `clerk init --app app_3G2mZM0b44zGplJmkpwPFuamFYG` linked this repo to Clerk app `Orbita`, pulled development env vars into `.env.local`, and installed the current Expo SDK package `@clerk/expo`.
- The code now uses `@clerk/expo` instead of the older `@clerk/clerk-expo`; `package.json` and `pnpm-lock.yaml` were updated accordingly.
- Convex dev deployment is identified as `dutiful-viper-815` with public URL `https://dutiful-viper-815.convex.cloud`; `.env.local` contains the local Convex deployment values and Clerk development values. Convex server envs `CLERK_JWT_ISSUER_DOMAIN` and `ORBITA_BACKOFFICE_ALLOWED_EMAILS` were set successfully on the dev deployment.
- `convex/_generated/` exists locally and the user successfully ran `pnpm exec convex dev --once --typecheck disable`; Convex confirmed functions ready on dev deployment `dutiful-viper-815`.
- Backoffice Lab V1 is now synced to Convex dev. If `convex/` code changes again, the user must rerun `pnpm exec convex dev --once --typecheck disable` locally because Codex is blocked from uploading backend code externally.
- Backoffice auth polish is implemented locally: `/backoffice` is Clerk-only, waits for `useConvexAuth()` before mounting lab queries/mutations, redirects Clerk sign-in back to `/backoffice`, and shows clear states for missing envs, connecting Convex, JWT mismatch, and non-allowlisted email.
- Clerk JWT template `convex` now exists in the linked Clerk app with audience/application id `convex`, so Convex can receive Clerk identity for `lucaszramos11@gmail.com` after a fresh sign-in.
- Backoffice Convex helper fix is implemented locally: read queries validate Clerk/email without writing to `users`; if the user row does not exist yet, `listSubjects` and `listRuns` return empty lists and the first mutation creates/updates the user.
- Backoffice visual polish is implemented locally: the large hero was reduced into a compact internal-tool header, the content is centered in a stable max-width container, and blocked auth no longer leaves active forms visible underneath.
- Onboarding web centering polish is implemented locally: the fixed `393x852` Figma canvas no longer upscales on desktop web, and a shared Figma screen chrome helper normalizes status/progress/back placement for the birthdate, birthplace, and birth-time screens.
- Onboarding local web debugging is enabled for `localhost`, `127.0.0.1`, and `::1`, so `/onboarding?debugStep=...` works in Expo Web export for screenshot verification without opening it on non-local hosts.
- Pixel-perfect React Native pass for onboarding screens `01-04` is implemented in `app/onboarding.tsx`: fixed Figma canvas `393x852`, absolute-positioned local Figma components, fake status/home indicators, real Inter/Newsreader fonts, and direct screen mapping for frames `151:33`, `151:47`, `151:70`, and `151:105`.
- To avoid another responsive reinterpretation, screens `01-04` now use Figma-derived local background/slot assets under `assets/orbita/figma/onboarding-v44/`. These exports are visual crops only; visible copy and UI geometry remain editable React Native.
- Pixel-perfect React Native continuation for onboarding screens `05-15` is now implemented in `app/onboarding.tsx`: the flexible `OnboardingShell` render path is no longer used for the remaining onboarding steps, and the flow now uses fixed `393x852` Figma-style canvases plus a `393x1180` scroll canvas for payment.
- Screens `09 / Birth Time Picker` and `10 / Birth Time Selected` were specifically rebuilt to stop the oversized responsive layout seen on phone: native status chrome is hidden, fake Figma status/progress/back controls are drawn, `09` is now a light text-wheel layout rather than white picker cards, and `10` is now light with an integrated orbital crop instead of a dark responsive poster layout.
- Screen `11 / Your Base Chart` now uses the Archive 10 orbital chart crop as a square rounded Figma-style chart block instead of the older circular natal-chart diagram.
- Screens `12 / Personalizing` and `13 / Before After / Órbita` were corrected against live V4.4 Figma metadata and screenshots: `12` no longer shows the hidden chart crop or visible CTA and now advances after the fake progress; `13` uses the V4.4 `dailyTextureB` background treatment, exact panel sizes, and the two Archive 10 circular symbols above the columns.
- Screens `14 / Create Account` and `15 / Onboarding Payment / Scroll` were corrected against live V4.4 Figma metadata and screenshots: `14` now uses the flatter account form/social buttons from Figma; `15` has the closer dark premium payment layout, plan selector, benefits, how-it-works area, legal row, and fixed bottom CTA while preserving safer Órbita copy.
- Screens `05 / Birthdate Empty` through `11 / Your Base Chart` received a new Figma correction pass against live V4.4 metadata/screenshots: `06` now uses the warmer solar field, glow, and emblem scale; `08` removes the wrong circular crop and uses the horizon as integrated full-frame atmosphere; `09` uses the corrected text-wheel positions, selection band, no-time button, note, and CTA geometry; `10` and `11` remove the oversized crops and use full-field warm backgrounds with aligned metrics/glyphs.
- New visual polish pass against Figma/screenshots fixed repeated mismatches: light-screen progress segments are now black/gray instead of copper, `12 / Personalizing` opens at the Figma-visible 59% state before auto-advancing, `13 / Before After / Órbita` no longer renders a literal `\n` and has a brighter background wash, and `15 / Onboarding Payment / Scroll` now uses an outline-style `PLUS` badge with no visible back chevron.
- Additional screenshot-driven polish pass corrected `10 / Ascendente afinado` and `11 / Your Base Chart`: removed the rectangular/circular asset artifacts, rebuilt the warm orbital/chart backgrounds with fixed RN geometry, added the Figma-style outer orbital ring/glow on `10`, and restored the radial natal chart grid/glyph balance on `11`.
- Additional screenshot-driven polish pass corrected `13 / Before After / Órbita`: restored a darker integrated orbital backplate, adjusted the before/after panel positions and highlighted-column width, and changed the CTA to the pale blue treatment visible in Figma.
- Additional Figma-derived asset pass corrected `12 / Personalizing`: the screen now uses the exact Figma-resolved calculation background exported from node `152:26` (`figma_onboarding_12_background__152-26.png`) instead of the wrong local Archive 10 PNG with a diagonal swoosh crop.
- Additional Figma-derived asset pass corrected `13 / Before After / Órbita`: the screen now uses the exact Figma-resolved background exported from node `152:28` (`figma_onboarding_13_background__152-28.png`), removes the non-Figma top progress/back chrome, and uses the Figma panel sizes/rotations.
- Additional screenshot-driven polish pass corrected `05 / Birthdate Empty`: the date wheel now uses Newsreader like Figma, capitalized month labels, exact year offsets from the frame, and a robust wrapping helper so previous months/days do not collapse to the same value.
- Additional Figma/compositing pass corrected `08 / Birthplace Selected`: the screen now uses the Figma-resolved horizon background from node `152:16`, keeps the Figma `22%` image and `#F7F3EA` `64%` wash values, and adds the missing light base layer so the asset does not blend against the dark canvas and turn gray.
- Additional Figma polish pass corrected `09 / Birth Time Picker`: live Figma frame `151:348` confirmed the circular wheel is correct; the app now uses Figma background opacities, the `11%` orbital ring, Newsreader wheel numerals, the correct selector band, softer `No sé la hora` button, and `48px` bottom CTA.
- Additional Figma polish pass corrected `15 / Onboarding Payment / Scroll`: live Figma frame `151:610` confirmed the fixed benefits panel/chip positions; the app now uses absolute chips instead of flex-wrap rows, the long benefits chip no longer truncates, and `Cómo funciona` no longer collides with `Qué incluye`.
- Additional Figma polish pass corrected `14 / Create Account`: the account screen now opens with the Figma sample email `mica@email.com` as editable state and uses Newsreader for the email field instead of a heavy Inter placeholder.
- Additional Figma/mobile behavior pass corrected `07 / Birthplace Search`: the city field now auto-focuses on entry and no longer wraps the fixed Figma canvas in keyboard avoidance, so iPhone should open the native keyboard like the Figma frame instead of showing a passive search screen.
- Additional Figma/light-background polish corrected shared light screens and `14 / Create Account`: `FigmaLightBackdrop` now uses a lighter texture/wash, and account gets a clean extra wash so its background matches Figma's warmer off-white.
- Additional Figma pixel pass corrected `11 / Your Base Chart` and reinforced `07 / Birthplace Search`: screen `11` now uses the exact Figma-resolved chart image export from node `152:22` as its integrated backplate with editable text/symbols on top, and screen `07` imperatively focuses the city input after mount so the native keyboard path is stronger on iPhone.
- Additional Figma pixel pass corrected `15 / Onboarding Payment / Scroll`: the top paywall title now uses the exact Figma line break `Tu cielo, todos\nlos días.`, the restore link uses Figma's medium/opacity treatment, and the subtitle color matches the lighter Figma payment copy while keeping the safer `Tu día con contexto` line in the how-it-works section.
- Additional Figma pixel pass corrected `11 / Your Base Chart`: the app now restores the full radial natal chart grid with editable RN geometry over the light backdrop, matching the fresh Figma frame `151:428` instead of showing a mostly empty background with only the glyphs.
- Additional Figma pixel pass corrected `06 / Birthdate Selected`: the app no longer renders the artificial copper/peach circle behind the solar emblem, so the sun sits directly in the integrated solar field like the Figma frame.
- The `05-15` implementation keeps local beta behavior: editable date/time/city/email/plan state, mock city options, no real auth/payment/geocoding/chart calculation, and final payment CTA still calls `createProfile` then routes to `/(tabs)`.
- Current phone-compatible EAS Update for this pixel-perfect continuation is published on branch `preview`: update group `4a1c1cf1-1f56-4704-b0c0-7a5a051df7f4`, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/4a1c1cf1-1f56-4704-b0c0-7a5a051df7f4`. Previous groups `4b8a23d5-a9af-43b0-ad0a-fbd7aa210754`, `c8db30e9-bc8b-4aa3-8bdf-21f545939a1a`, `2a77d0fd-68a3-413b-a0ef-5309c72e1c11`, `d79634c6-b285-40bd-8421-7e7e80dd2143`, `db389668-3956-4b98-a806-0a33f53e7846`, `dc4f837b-28e7-4858-9420-626583974faa`, `29114707-d5b7-4de2-880a-3eb08e4ba823`, `6ed3ba8b-c825-4121-99b5-e7450b4f8a69`, `b71a3b90-9d20-44d3-ba70-f04dc20bc9c6`, `cf035676-763e-48d1-ba02-5ad15764a740`, `31b993d7-20af-4a02-8ae1-187774cb2cca`, `cfc74531-572c-429b-9cc6-fe37c96b3436`, `59951ce6-bfff-484d-a5a4-73d02dbc618b`, `8cc0e33b-31a3-420f-9385-48b80f5feae8`, `66894e41-a209-4f22-9d02-b2496070e093`, `ca752f95-c97e-4660-b379-9b1c645acc34`, `604b39fd-b9c1-4f0c-899d-0c208687e2c0`, `15729fbc-1046-4e97-9d1e-46db92f0517a`, `67909001-cc97-431b-a62a-b56077d962ca`, and `883c6ea6-9778-4d5b-85b1-f3702c457f9b` are superseded.
- Onboarding V4.4 immersive asset pass is now implemented in `app/onboarding.tsx`: the local asset manifest uses real selected Archive 7/10 assets across the flow instead of relying mostly on flat RN geometry or Figma-derived crops. Key additions: `01` logo/backplate `idx08` + Archive 10 backplate, `02` benefit tiles from Archive 7 `idx68/27/38/13`, `03` identify backgrounds `idx21/27`, `04` daily base/backplates `idx20/21/61/65/66`, `05-10` birth-data assets `idx34/40/77/83`, `11` base chart `idx46/47`, `12` personalizing `idx51/55`, `13` before/after `idx53/81`, `14` account `idx58/59`, and `15` payment `idx62` with `idx69` as a subtle secondary atmosphere.
- Current phone-compatible EAS Update after the immersive asset pass is published on branch `preview`: update group `b087be8e-061d-4907-95c2-3d446bc56807`, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/b087be8e-061d-4907-95c2-3d446bc56807`. It supersedes `Onboarding 06 sun emblem cleanup`.
- Latest phone-compatible EAS Update is the optimized loading hotfix on branch `preview`: update group `809f8cfb-cd54-4e10-a545-b03be399adb1`, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/809f8cfb-cd54-4e10-a545-b03be399adb1`. It supersedes `Onboarding immersive asset pass`.
- The raw selected Archive 7/10 assets remain untouched as source files, but `app/onboarding.tsx` now points the heavy onboarding visuals to 36 optimized JPEG derivatives in `assets/orbita/optimized/onboarding-v44/` totaling about `5.6M`, so Expo Go does not need to download the multi-megabyte PNG originals before opening the preview.
- Latest phone-compatible EAS Update is now the native UI primitives pass on branch `preview`: update group `edb14d63-a72b-4fe9-b344-3e13aa296024`, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/edb14d63-a72b-4fe9-b344-3e13aa296024`. It supersedes `Onboarding load hotfix optimized assets`.
- Onboarding V4.4 now uses React Native Reusables/NativeWind for the approved mobile controls, not shadcn web/Radix DOM. The local `src/components/ui/` registry components include RNR `button`, `input`, `label`, `radio-group`, `toggle`, `progress`, `separator`, `badge`, `avatar`, `text`, and `icon`, plus thin Órbita adapters where the fixed Figma canvas needs absolute coordinates.
- The visible onboarding controls in `app/onboarding.tsx` now use RNR-backed primitives: identity is a `RadioGroup`, birthplace/account inputs go through `Input`/`Label`, `No sé la hora` goes through `Toggle`, payment plans are a `RadioGroup`, `PLUS` uses `Badge`, and account adds `Avatar`.
- The old custom date/time wheel path was removed from `app/onboarding.tsx`; screens `05` and `09` now use `@react-native-community/datetimepicker` with local conversion back into the existing `YYYY-MM-DD` and `08:30 AM` state formats. `birthTimeUnknown` still stores `birthTime` as undefined on submit.
- NativeWind/RNR infrastructure is now configured through `components.json`, `global.css`, `tailwind.config.js`, `metro.config.js`, `nativewind-env.d.ts`, `babel.config.js`, `app/_layout.tsx`, and `src/lib/utils.ts`. Expo's SDK 54 installer currently resolves Reanimated/Worklets as `react-native-reanimated@~4.1.1` and `react-native-worklets@0.5.1`.
- This RNR/native picker pass has not been published to EAS yet. Latest published phone-compatible `preview` remains `Onboarding native ui primitives pass` (`edb14d63-a72b-4fe9-b344-3e13aa296024`) until the NativeWind/Reanimated export issue is fixed and a new EAS Update is explicitly published.
- Historical simulator note: Expo Go SDK 51 was previously installed on `iPhone 17 Pro` for the older SDK 51 project, but the currently booted Simulator now reports Expo Go SDK 57 and rejects this SDK 54 project. No Metro server is intentionally left running after the latest `05-15` pass.
- Expo/EAS preview setup is now configured for account `lucasssram`: project `@lucasssram/orbita`, EAS project ID `9e91bb5e-e69e-489e-818d-0e377f397147`.
- Android preview build is complete and installable from Expo: `https://expo.dev/accounts/lucasssram/projects/orbita/builds/41da1364-fc7b-40d9-ac70-c244c48332ab`.
- EAS Update branch `preview` is now published so the project no longer shows as empty in Expo Go's branch list: update group `52c16c65-723d-4684-b5c6-a72985f2520d`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/52c16c65-723d-4684-b5c6-a72985f2520d`.
- Expo Go on the physical iPhone showed branch `preview` but marked that first update as not compatible because it was published from the old SDK 51 app while the phone's current Expo Go expects a newer SDK.
- A second SDK 57 update using runtime policy `appVersion` also showed as incompatible in Expo Go because it published runtime `0.2.0`. Expo Go expects Expo SDK runtimes such as `exposdk:57.0.0`, not arbitrary app-version runtimes.
- User screenshot of Expo Go settings confirmed the installed phone client supports SDK 54, so SDK 57 updates still cannot open there. The working reference project is also on Expo SDK 54.
- To unblock phone review through the user's current Expo Go, the project has been aligned to Expo SDK 54 / React Native 0.81.5, app version `0.2.0`, runtime policy `sdkVersion`, and SDK 54-compatible Expo module versions.
- SDK 57 EAS Update is now published on branch `preview`: update group `b331824b-a4a9-4b9f-8442-6c41266a29e9`, runtime `0.2.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/b331824b-a4a9-4b9f-8442-6c41266a29e9`.
- Expo Go-compatible EAS Update is now published on branch `preview`: update group `fe0c62e3-b873-490c-81d2-b02d816eee39`, runtime `exposdk:57.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/fe0c62e3-b873-490c-81d2-b02d816eee39`.
- Earlier SDK 54 phone-compatible EAS Update was published on branch `preview`: update group `feaa6ecc-784c-4396-af5b-4d7ce6466603`, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/feaa6ecc-784c-4396-af5b-4d7ce6466603`. It is now superseded by the latest `Figma polish onboarding progress payment` update.
- iOS physical-device preview build is not complete yet because EAS requires Apple Developer credentials/ad hoc provisioning for `com.horoscopo.orbita`. The iOS flow reached the Apple login prompt and was intentionally stopped; do not paste Apple passwords into chat.
- A true installed iOS preview build still requires access to a valid Apple Developer team for signing/provisioning. Until that is available, the practical iPhone path is Expo Go + EAS Update on branch `preview`.
- A local Git repository now exists because EAS Build requires Git. The first commits capture the current Órbita beta state and EAS build fixes.
- Content/personalization planning pass was added in `docs/textos-analisis-personalizacion.md`, based on current Órbita docs/Figma/código plus Mobbin references for Co-Star and Moonly. It inventories the static copy, dynamic personalized readings, analysis modules, guardrails, and P0/P1/P2 prioritization needed for each incoming user.
- Backend/backoffice astrological implementation pass is now added without wiring the user app: AstrologyAPI server-side adapter, chart/transit normalization, editorial daily payload P0, fixtures P0, provider/raw inspector, place lookup hook, and review statuses for lab runs.
- Backoffice lab smoke test is now saved for `Lucas prueba` with birth data `1996-11-11 10:48`, assumed `Buenos Aires, Argentina`, timezone `America/Argentina/Buenos_Aires`, and local reading date `2026-07-04`. The run saved successfully, but AstrologyAPI returned `not_configured`, so the lab stored the expected stub fallback with provider request metadata and gaps.
- Backoffice inspector UI has been polished after the first live run: it now shows a compact run summary, readable chart fields, readable daily modules/topics, provider status, and bounded scrollable raw JSON blocks so long payloads no longer overlap the next sections.
- Backend/API decision doc now exists at `docs/api-astrologica-orbita.md`; it summarizes AstrologyAPI, the endpoints in use, what data each endpoint returns, what Orbita must own on top, the Lucas lab test, and the next validation steps.
- Competitive astrology reference doc now exists at `docs/referencias-costar-moonly-orbita.md`; it lists what Co-Star and Moonly ask, show, sell, and separate technically, then maps what Orbita should take, adapt, defer, or avoid.
- Home content/backend doc now exists at `docs/home-contenidos-personalizados.md`; it refocuses the Co-Star/Moonly analysis away from pages and into the exact personalized text modules the backend should generate for Home: daily headline, topics, `Hace`, `Evita`, action, question, Void prompts, lunar/calendar P1, editorial banks, and data required for personalization.
- Interactive Home Lab is now implemented inside `/backoffice`: generated lab runs now include richer editorial payloads for chart profile, Home, topics, Deep Dive, transits, Void preview, Future Self, long read, guardrails, versions, and mode; the UI adds editable tabs and lab-only saving for `editorialPayload` and `futureSelfNote`.
- Home Lab content correction: `Hacé` and `Evitá` should be three-item lists each, not one-liners. The lab also now needs to show a clear personalization trace explaining whether a run uses real natal chart + daily transits, natal fallback only, or demo-only editorial output because the provider is missing.
- Public-dev `/lab` is implemented in the backend worktree: no-login Home daily preview, complete horoscope capability map, optional Vercel AI Gateway copy layer, and extended transit timeline previews. It stays disabled by default with `ORBITA_PUBLIC_LAB_ENABLED=false` and does not persist users, runs, or readings.
- Backend AI Gateway + timeline pass is implemented in `../orbita-backend` (`feature/api`): `publicLab.previewLlmHome`, `previewTransitTimeline`, and optional flags on `previewDailyHome` / `previewCompleteHoroscope`. Gateway uses tags `feature:orbita-lab`, `env:dev`, `user:lab`; missing/failed Gateway falls back to deterministic Home copy with explicit gaps.
- Órbita Web V0 is now implemented locally: on web, `/` renders a public dark premium landing using real Órbita assets; on native, `/` still redirects to onboarding or tabs through the existing app state.
- A new `/studio` route is implemented as a protected web Studio with Clerk + Convex auth shell and the backoffice allowlist pattern. Studio V0 is intentionally visual/local: video drop is simulated, metadata edits stay in component state, and no files or video metadata are uploaded or persisted.
- A web asset manifest now curates Home core assets, onboarding optimized assets, and Archive 10 symbols as a shared web visual language. The assets are used as integrated hero/texture/backplate/symbol material, not as a wholesale gallery.
- `convex/studio.ts` adds a local `checkAccess` query, but it is not synced to Convex dev yet. The sync command was blocked by policy because it uploads local backend code externally; the user must run `pnpm exec convex dev --once --typecheck disable` locally before `/studio` can validate against the live dev deployment.
- The consumer app still uses local/stub behavior; real astrology is intentionally limited to `/backoffice` until outputs are reviewed and approved.
- Órbita Web B0 (Home diaria) is now designed in Figma as the source of truth on a new page `WEB B0 - Órbita Home Web` (file `BEB5v6SbgJn2Nipm8Qa0wE`, wrapper frame node `225:10`). It is a desktop dark-premium daily Home built from the current app language (not the legacy warm MVP theme): tokens negro `#07080A`, cobre `#C46A3A`/`#D69A6A`, hueso `#F4EEE4`, Newsreader (títulos) + Inter (UI), captured in a local Figma variable collection `Órbita Web` (colors bg/charcoal/panel/copper/copper-soft/bone). Content structure mirrors the `PublicDailyHome` shape from `src/components/web/orbita-lab.tsx`.
- Home B0 sections built and screenshot-verified: Top bar (marca orbital + nav `Hoy · Carta · Tránsitos · Diario` + fecha/zona + avatar), Hero/Titular del día (eyebrow fecha, saludo Newsreader, titular, subtítulo, chips tríada natal Sol/Luna/Asc + nota de precisión), Guía diaria (2 col: Hacé/Evitá tabla editorial + Energía/Acción/Pregunta destacada), Tránsito destacado (banda charcoal + secundarios), Temas grid 2×2 (Amor/Trabajo/Familia/Vínculos con línea + pregunta), Deep Dive (visual + título + CTA), Cierre (prompt de diario + input + guardar + disclaimer), Footer.
- Real Órbita assets integrated into Home B0 via `upload_assets`: `assets/orbita/core/orbita_daily_texture_b.png` as hero background (imageHash `08d5a1cefa31f275148b77a2926c100bead696e2`, dark overlay for legibility) and `assets/orbita/core/orbita_long_read_thumbnail_a.png` in the Deep Dive slot (imageHash `6ba780e033b70ebf332f572c422e5f76bf4997ab`).
- Figma render gotchas found while building Home B0: zodiac unicode glyphs (♌♓♎) render as color emoji — use text labels instead; and low-opacity fills on frames bound to a color variable render at full opacity — use plain SOLID paints with `opacity` for tints/hairline fills (variable-bound opacity still works for text fills and strokes).
- Home B0 immersive pass applied after user feedback ("podría ser mucho más inmersivo"): hero rebuilt as a tall cinematic cosmic scene (hero orbital image `4061046a3880d77c4104c6b1883b02329e59c596`, bottom-anchored content, blurred copper glow, 780px), Tránsito destacado turned into a cosmic scene (daily texture bg + scrim + glow), a faint global texture added behind the whole wrapper (daily texture at 6%), copper blur-glows added to Guía/Temas/Cierre, and Temas got an orbital ring-system backplate (`f01be82e91d78c2d2c75f3729fee4e3d5dbaef5a`, 16%) with glassy translucent topic cards. Immersion technique: full-bleed image fills + layered dark scrims + absolute blurred copper ellipses (LAYER_BLUR) as glows.
- Carta Natal screen (B0) built as a new immersive desktop frame `Carta Natal / Desktop` on the same `WEB B0` page (node `252:2`, at canvas x=1640). Left: a natal wheel (`252:12`) built as an SVG vector (`figma.createNodeFromSvg`) — outer copper ring with degree ticks, 12 sign sectors + labels (ARI…PIS), inner house ring with Roman numerals I–XII, 7 planet dots (Sol/Luna/Mer/Ven/Mar/Júp/Sat) with copper labels, and 4 aspect lines (blue=armonía, copper=tensión) crossing the center. Geometry computed by angle in JS; sign glyphs avoided (emoji issue) in favor of text abbreviations. Right: interpretation panel with Tu tríada, Posiciones clave list, Aspectos legend, and "Cómo leerla" note + `Ver mi día` CTA. Immersive bg (faint texture + central copper glow) consistent with Home.
- Mapa de valores screen (B0) built as new immersive desktop frame `Mapa de valores / Desktop` (node `260:2`, canvas x=3280). Left: an 8-axis radar chart (`260:12`) as SVG geometry (grid rings, spokes, two overlaid data polygons — Armonía copper, Tensión blue — with vertex dots) plus 8 icon+label axis groups (Amor/Familia/Trabajo/Dinero/Libertad/Creatividad/Estabilidad/Vínculos) using inline lucide SVGs. Right: reading panel with Referencias legend, Te impulsa (copper bars) and Te pesa (blue bars) using fixed-width track+fill bars, and a Cómo leerlo note. Immersive bg consistent with Home/Carta.
- Entrada de datos screen (B0) built as new immersive desktop frame `Entrada de datos / Desktop` (node `266:2`, canvas x=4920). Two columns: left = intro + three why-points (Fecha→Sol, Lugar→ascendente/casas, Hora→afina, con íconos lucide en cajas cobre) + privacy line; right = glass form card with date/place/time input-styled fields (con íconos calendar/pin/clock), "No sé la hora exacta" toggle, and `Ver mi carta` CTA. No real inputs — es maqueta de diseño.
- Tránsito en el espacio screen (B0, Co-Star style) built as new immersive desktop frame `Tránsito en el espacio / Desktop` (node `271:70`, canvas x=6560). Centerpiece is a cosmic scene panel (`271:80`, hero orbital image bg + scrim) with an SVG dashed connection line Vos→Mercurio→tu Venus, glowing planet dots/rings, and label chips (VOS, MERCURIO · HOY, TU VENUS · LEO, CONJUNCIÓN · 0°). Below: left col = "La lectura" sentence-builder (source-labeled fragments in Newsreader) + "Cada cuánto pasa" timeline (4 year dots, current = copper); right col = copper-tinted "Cómo se juega en la tierra" card with checklist + "La ventana ~5 días" card.
- Horóscopo de personalidad screen (B0, editorial long-read) built as new immersive desktop frame `Horóscopo de personalidad / Desktop` (node `280:2`, canvas x=8200). Centered 760px reading column: header + 3 sections (Identidad/Sol en Leo, Amor y relaciones/Venus en Libra, Crecimiento y expansión/Júpiter en casa 12), each with a circular icon marker (sun/heart/sparkles), centered Newsreader title + intro, and a glass interpretation card (icon heading + body). Delicate SVG diamond dividers between sections; closing disclaimer + `Ver mi día` CTA. Tone guardrails applied: Júpiter casa 12 reframed as inner growth (no money/business claims), explicit "tendencias, no un destino" disclaimer.
- WEB B0 design library COMPLETE (6 screens) on `WEB B0 - Órbita Home Web` (left→right on canvas): Home (`225:10`, x0), Carta Natal (`252:2`, x1640), Mapa de valores (`260:2`, x3280), Entrada de datos (`266:2`, x4920), Tránsito en el espacio (`271:70`, x6560), Horóscopo de personalidad (`280:2`, x8200). Next new screen would go at x≈9740.
- WEB B0 flow reorganized in Figma to the real user journey (frames repositioned left→right: Entrada `266:2` x0 → Carta `252:2` x1640 → Home `225:10` x3280 → Tránsito `271:70` x4920 → Mapa `260:2` x6560 → Personalidad `280:2` x8200) with a page title `Órbita — Web B0` + numbered step labels above each screen (branch: desde Home se abren tránsito/valores/personalidad).
- Web B0 backend-connection layer prepared (frontend side). `convex/_generated/` is empty in this worktree, so the front binds Convex via `anyApi` + hand-declared types (same pattern as `publicLabRefs.ts`):
  - `src/services/appRefs.ts` — typed `appApi` bindings to EXISTING functions (`users.*`, `birthData.*`, `onboarding.*`, `charts.current`/`calculateOrCreateNatalChart`, `readings.getToday`/`generateToday`/`save`/`unsave`, `subscriptions.getCurrent`) + payload shapes (`NatalChartPayload`, reuse `PublicDailyHome`), and `proposedApi` for 4 NOT-YET-EXISTING functions with payload shapes (`ValuesMapPayload`, `PersonalityReadingPayload`, `TransitDetailPayload`, `PlaceLookup`).
  - `docs/web-b0-backend-map.md` — pantalla→dato→función mapping table + flow diagram + list of missing functions.
  - `convex/CHANGELOG.md` (2026-07-05) + `// TODO: pendiente backend — Web B0` block in `convex/schema.ts` proposing the 4 functions: `charts.valuesMap`, `charts.personalityReading`, `transits.getToday`, `places.resolve`. These need no new tables (derive from `natalCharts`/`transitReadings`, payload v.any()).
  - `pnpm typecheck` (tsc --noEmit) passes with the new layer.
- WEB B0 remaining: backend (Codex) implements the 4 proposed functions; front builds each screen in code (`app/` + `src/components/web/`) against `appApi`/`proposedApi` + typed mocks; estados loading/empty/error; variante mobile/narrow.
- Home diaria bajada a código (Expo Web) — primera pantalla B0 implementada:
  - `src/components/web/orbita-home.tsx` — traduce el diseño Figma `Home Web / Desktop` a RN/Expo Web (top bar, hero con `webAssets.dailyTexture` + overlay, guía diaria 2 col, tránsito band, temas grid, deep dive con `webAssets.longRead`, cierre, footer). Incluye `toHomeView(payload: PublicDailyHome): HomeView` (mapper defensivo con `asRecord`/`readString`) y responsive (`isNarrow < 900`). Container `OrbitaHome`: sin Convex → renderiza el mock; con Convex → `HomeWithBackend` que usa `useQuery(appApi.readings.getToday, { localDate })` con estados loading/empty/error (`StatusScreen`).
  - `src/content/homeMock.ts` — mock tipado `PublicDailyHome` con el copy del diseño.
  - `app/home.tsx` — ruta web (`/home`), redirect a `/` en native (mismo patrón que `app/lab.tsx`).
  - Verificado: `tsc --noEmit` ✓, `expo export --platform web` ✓ (bundlea sin errores de runtime, ruta `/home` incluida), `tsx --test test/*.test.ts` 14/14 ✓. Falta screenshot en navegador (entorno sin browser headless) — previsualizar con `pnpm web` → abrir `/home`.
- Navegación web + más pantallas en código:
  - `src/components/web/web-nav.tsx` — `WebNav` compartida con `Link` de expo-router (Hoy→/home, Carta→/carta, Tránsitos→/transito, Diario→/diario). Reemplazó el top bar inline de la Home.
  - Carta natal en código: `src/components/web/orbita-chart.tsx` (rueda con `react-native-svg` — anillos/signos/casas/planetas/aspectos — + panel tríada/posiciones/aspectos/cómo leerla), `src/content/chartMock.ts` (`NatalChartPayload`), ruta `app/carta.tsx`. Mock-first + `?live=1` (usa `appApi.charts.current`).
  - Tránsito en código: `src/components/web/orbita-transit.tsx` (escena cósmica: ImageBackground `heroOrbital` + SVG línea/puntos/labels + lectura por fragmentos + timeline + tierra/checklist + ventana), `src/content/transitMock.ts` (`TransitDetailPayload`), ruta `app/transito.tsx` (reemplazó placeholder). Mock-first + `?live=1` (usa `proposedApi.transitToday`).
  - Placeholder `src/components/web/orbita-soon.tsx` para `/diario` (diseño aún solo en Figma).
  - Verificado: `tsc --noEmit` limpio para mis archivos; dev server `expo start --web` bundlea OK (3198 módulos), rutas `/home /carta /transito /diario` responden 200.
- Onboarding web (gamification) en código — MISMAS preguntas/copy que el onboarding de la app (`app/onboarding.tsx` V4.4): identidad (¿Cómo te identificás? Ella/Él/Prefiero no decirlo), fecha (¿Cuándo naciste?), lugar (¿Dónde naciste? + sugerencias mock), hora (¿A qué hora naciste? + "No sé la hora" → carta aproximada), + promesas, calculando (progreso animado), reveal ("Estos son tus puntos de partida" + tríada), antes/después, cuenta ("Guardá tu carta"), pago (Semanal $5 / Anual $30 · MEJOR VALOR + beneficios + legal).
  - `src/content/onboardingSteps.ts` — steps + opciones + copy (fuente única para no divergir con la app).
  - `src/components/web/orbita-onboarding.tsx` — máquina de estados con barra de progreso, cards seleccionables, y CTA por paso. Mock-first; al final `router.replace("/home")`. TODO wiring: `appApi.onboarding.saveDraft`/`completeBirthData`/`markPaymentState`.
  - Ruta `app/empezar.tsx` (`/empezar`, redirect a `/onboarding` en native). Landing: CTA "Empezar" ahora → `/empezar`.
  - Verificado: `tsc` limpio (mis archivos), dev server bundlea OK (3275 módulos), `/empezar` responde 200.
  - REWORK tras feedback ("se ve muy feo, perdió los componentes del app, es mobile con cards"): `orbita-onboarding.tsx` ahora es un flujo **mobile enmarcado** (frame tipo teléfono centrado en stage oscuro, redondeado en desktop, full-screen en mobile) con **assets reales full-bleed por paso** (`assets/orbita/optimized/onboarding-v44/*.jpg`: logo_orbe, identify_bg, daily_base, birth_data, ascendant_horizon, personalizing, orbital_chart, before_after, account_seal, payment) + scrim. Se mantienen/agregan **cards**: opciones de identidad, tiles de beneficio con imagen (benefit_lunar/guide/practice/decisions), planes, antes/después, tríada, y las inputs dentro de un card. Chips con íconos lucide (no unicode). El **Sol sale real de la fecha** vía `getZodiacSign` (muestra "Tu Sol es X" en el paso fecha y en el reveal); Luna/Ascendente quedan honestos ("se afinan con tu hora y lugar en la carta completa") porque no hay efemérides en el cliente.
- OJO worktree compartido: otra sesión de Claude agregó `src/components/orbita/` (TabBar.tsx + kit.tsx, untracked) y modificó `app/(tabs)/_layout.tsx` para importar `@react-navigation/bottom-tabs`, que NO está instalado. Rompe el `tsc` global (solo tipos) pero metro igual bundlea el web. No tocar esos archivos; coordinar que instalen la dep.
- Home B0 pending: (A) pantalla de entrada de datos de nacimiento (fecha/lugar/hora) que personaliza el Home; (B) más módulos — tránsito en el espacio estilo Co-Star, secciones editoriales (Amor y relaciones, Su suerte, horóscopo de personalidad) [rueda de carta natal ✔, mapa de valores ✔]; (C) estados loading/empty/error + variante mobile/narrow; (D) bajar el diseño a Expo Web (`src/components/web` + ruta) consumiendo `PublicDailyHome`. User references for the rich modules were Co-Star transit-in-space screens + a personality-horoscope PDF.
- Figma bar gotcha (radar): `layoutSizingHorizontal/Vertical = "FILL"` only works on children of AUTO-LAYOUT frames; a rectangle inside a plain `createFrame()` track can't be FILL — use fixed pixel widths (track fixed width + fill width = value*trackWidth).
- Public-dev Home Lab is now implemented locally at `/lab`: it is a no-login Expo Web route for entering birth date/place/time and previewing the Home daily output without saving users, subjects, runs, or readings.
- Backend function `convex/publicLab.ts` adds `previewDailyHome` and `resolvePlace`, both gated by `ORBITA_PUBLIC_LAB_ENABLED=true` and optional `ORBITA_PUBLIC_LAB_KEY`; the response is sanitized for Home review and does not return raw AstrologyAPI payloads.
- Frontend `/lab` uses Convex without requiring Clerk, shows manual natal inputs, optional place lookup, loading/error/disabled states, and result tabs for Summary, Home, Chart, Transits, Questions, and Gaps.
- Public-dev Complete Horoscope preview is now implemented in `feature/api`: `publicLab.previewCompleteHoroscope(args)` returns a full per-profile feature map for Identity, Natal Chart, Daily, Current Sky, Future, and Extras, including source model A/B/C/dataset, entitlement, status, missing backend needs, cache plan, raw policy, provider status, and embedded `dailyHome`.
- Frontend `/lab` now has a `Generar horóscopo completo` action and `Completo` tab so a test person can show what is ready, stubbed, provider-dependent, LLM-dependent, input-dependent, or planned before user dailies are persisted.
- Backend AI Gateway + timeline pass is implemented in `feature/api`: `convex/lib/aiGateway.ts` calls Vercel AI Gateway through the OpenAI-compatible chat completions endpoint with tags `feature:orbita-lab`, `env:dev`, `user:lab`; `publicLab.previewLlmHome(args)` returns generated Orbita Home copy when Gateway is configured and deterministic fallback with gaps when disabled/error/rate-limited.
- Public-dev extended transit timeline is implemented in `feature/api`: `publicLab.previewTransitTimeline(args)` and `previewCompleteHoroscope({ includeTimeline: true })` can call `natal_transits/weekly`, `tropical_transits/weekly`, and `tropical_transits/monthly`, normalize upcoming events with `startTime`, `exactTime`, `endTime`, planet, natal point, aspect, house, priority, and keep raw AstrologyAPI payloads out of `/lab`.
- Backend package now includes the `ai` dependency for the AI Gateway track, while the first Convex-safe implementation uses direct Gateway REST fetch so the action stays portable outside Vercel runtime/OIDC.
- Multi-agent base is now split into worktrees: `../orbita-backend` on `feature/api` for Codex/backend and `../orbita-frontend` on `feature/web` for Claude/frontend. `main` is clean and holds the integration/checkpoint history.
- Backend contract pass for Home P0 is implemented in `feature/api`: new public Convex API `home.getDaily({ localDate })` and `home.generateDaily({ localDate, timezone })` return a `DailyHomeReading` shape for Claude with header, natal base, highlighted transit, three `Hacé`, three `Evitá`, energy/action/question, topics, long read, Void preview, personalization trace, `modelGaps`, versions, mode, and `reviewStatus`.
- Onboarding remote contract now includes `onboarding.getDraft({ clientDraftId? })`, a read-only query that returns the current authenticated draft when available or falls back to anonymous `clientDraftId` without writing user rows.
- `convex/_generated/` was regenerated from `feature/api`; the dev deployment `dutiful-viper-815` was also synced during `pnpm convex:codegen`. Claude should consume the generated `api.home.*` types after pulling/merging the backend contract.

## Decisions Made

- Current brand is `Órbita`.
- Órbita is the only current product brand.
- Previous names and intermediate explorations are historical context only.
- Current design reference mix is 70% Co-Star / 30% Moonly.
- Content strategy interpretation of the 70/30 mix: use Co-Star for editorial authority, sparse daily rhythm, data precision and chart/detail patterns; use Moonly for onboarding clarity, privacy framing, payment/benefit progression and Plus gating. Do not copy Co-Star's unsupported `NASA` claim or Moonly's inflated wellness/review claims.
- Current onboarding is `01-15` in `UX V4.3 - Órbita Onboarding Copy`.
- Payment is a single onboarding payment screen with weekly and annual plans.
- App Core/Home design lives in `UX V4.5 - Órbita App Core`.
- Asset library lives in `UX V4.6 - Órbita Asset Library`.
- Prompt-only Figma pages are not a source of truth; prompts should live in docs or chat handoff.
- Assets should be selected, cropped, classified, and verified instead of uploaded wholesale.
- Backend planning should treat `docs/backend-todo.md` as the current backlog source for auth, profile, birth data, geocoding, chart calculation, payments, daily readings, journal, notifications, analytics, CMS, and external integrations.
- Backend V1 decision is Convex + Clerk. Do not extend `supabase/schema.sql` for new Órbita work unless there is an explicit product/technical decision to revert.
- Backoffice V1 decision: build a lab first, not a full CMS/admin. The first web route is `/backoffice`, scoped to loading test subjects, running the current stub/proveedor astrológico, inspecting model gaps/raw provider payloads, saving lab runs, and marking review status. Payments, production analytics, full CMS editorial, LLM output, and app migration from `AsyncStorage` remain out of scope.
- Public-dev Lab decision: `/lab` is a fast no-login development surface for Home daily previews, LLM copy experiments, extended transit timelines, and complete profile capability maps. It must not persist inputs/outputs; `/backoffice` remains the persistence/review surface.
- Public-dev LLM decision: Convex remains the backend; Vercel is used only for AI Gateway budget/model/observability. The first cut uses `AI_GATEWAY_API_KEY` in Convex because Convex is not running inside Vercel OIDC.
- Home Lab decision: `/backoffice` is the place to polish personalized astrological content before app work. It keeps original generated payloads separate from edited `editorialPayload`, supports Future Self notes, and treats provider-missing output as explicit `demo_without_provider` instead of blocking editorial review.
- Home Lab output decision: Co-Star-style `Do/Don't` maps to three `Hacé` items and three `Evitá` items. Every run must expose a visible `personalization` block so editorial review can tell what came from real user astrology and what is still maqueta.
- Web V0 decision: `/` is the public landing on Expo Web only; iOS/Android keep the existing app redirect. `/studio` is the private web surface for visual/content operations.
- Studio V0 decision: video drop/upload is mock-only for now. Do not add storage, transcoding, file persistence, or public user uploads until the visual workflow is approved.
- Public-dev Lab decision: `/lab` is a fast no-login development surface for Home daily previews and complete profile capability maps. It must stay disabled by default in Convex and must not persist inputs or outputs; `/backoffice` remains the review/persistence surface.
- Public-dev LLM decision: Convex remains the backend; Vercel is used only for AI Gateway budget/model/observability. The lab uses `AI_GATEWAY_API_KEY` because Convex is not running inside Vercel OIDC. If Gateway is missing or fails, `/lab` must keep returning template output plus explicit gaps instead of blocking review.
- Transit timeline decision: use `natal_transits/weekly` first for personal near-term windows. `tropical_transits/weekly` and `tropical_transits/monthly` are available as inspection/support endpoints, not final provider-written copy. Long multi-month/year windows can later be built by iterating periods or moving to a self-hosted ephemeris service.
- Web asset decision: use the full Órbita asset library as a curated language system. Do not show every asset at once or treat RGB PNGs as transparent stickers.
- Backoffice astrology provider decision: use AstrologyAPI first for backend lab calculations, keep Órbita-owned editorial text, keep the adapter isolated, and do not expose provider credentials through app/client envs.
- Backoffice access decision: use Clerk directly with `lucaszramos11@gmail.com` allowlisted in Convex. Do not use a generic internal-code shortcut.
- Backoffice auth implementation decision: do not call `listSubjects`, `upsertSubject`, `runModel`, or run detail queries until Convex confirms `isAuthenticated`; a Clerk-only visible session is not enough.
- Onboarding asset rule for the V4.4 pass: no principal visual should read as a square/rectangle photo pasted onto a background. If an asset is RGB/no-alpha, use it as a full-frame background, low-opacity texture, masked symbol, or integrated diagram.
- `01 / Logo Splash` should use an editable Órbita orbital mark instead of a square logo image.
- For the `05-09` onboarding slice, the selected treatment is `Ritmo mixto`: `05`, `07`, and `09` stay light with `orbita_daily_texture_b` as an atmospheric wallpaper; `06` and `08` use stronger integrated Sol/Horizonte imagery.
- For `15 / Onboarding Payment / Scroll`, the selected treatment is `Full-bleed premium`: use Archive 7 `idx62` as the full-screen background, not as a hero card, and keep all payment copy editable and unchanged unless product explicitly revises it.
- For React Native implementation, use `docs/onboarding-v44-react-native-handoff.md` as the working handoff. Its payment copy intentionally supersedes the current Figma `15` block for the `Qué incluye` / `Cómo funciona` area until Figma is synced.
- First app beta keeps onboarding local/stubbed: no Convex write, no Clerk auth, no real geocoding/timezone, no real chart calculation, and no StoreKit/Play Billing yet.
- For pixel-perfect RN passes, use the Figma frame as source of truth over hand-guessed `Image resizeMode="cover"` crops. If an image fill crop matters, export the specific Figma background/slot node as a local derived asset and keep text/buttons editable in RN.
- A dev-only `debugStep` query param in `app/onboarding.tsx` may be used to open exact onboarding steps in Simulator for screenshots, for example `exp://127.0.0.1:8082/--/onboarding?debugStep=3`.
- Onboarding UI decision: use React Native Reusables generated components and NativeWind for mobile UI primitives; keep wrappers thin so the fixed `393x852` Figma canvas and asset composition remain stable.
- Onboarding date/time decision: React Native Reusables does not provide a dedicated date picker in the selected registry, so use `@react-native-community/datetimepicker` for birth date and birth time instead of recreating custom wheels.

## Relevant Files

- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- `CURRENT_TASK.md`
- `README.md`
- `docs/contexto-actual.md`
- `docs/figma-context.md`
- `docs/ritmo-trabajo.md`
- `docs/assets-needed.md`
- `docs/onboarding-v44-react-native-handoff.md`
- `docs/textos-analisis-personalizacion.md`
- `docs/api-astrologica-orbita.md`
- `docs/referencias-costar-moonly-orbita.md`
- `docs/home-contenidos-personalizados.md`
- `docs/backend-todo.md`
- `docs/backend-setup.md`
- `app/lab.tsx`
- `docs/decision-log.md`
- `docs/architecture.md`
- `docs/symbolic-asset-library.md`
- `.easignore`
- `.env.example`
- `.gitignore`
- `.npmrc`
- `babel.config.js`
- `components.json`
- `global.css`
- `metro.config.js`
- `nativewind-env.d.ts`
- `app.json`
- `eas.json`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `supabase/schema.sql`
- `app/index.tsx`
- `app/backoffice.tsx`
- `src/components/web/orbita-lab.tsx`
- `app/studio.tsx`
- `app/_layout.tsx`
- `convex/schema.ts`
- `convex/_generated/`
- `convex/auth.config.ts`
- `convex/backoffice.ts`
- `convex/studio.ts`
- `convex/publicLab.ts`
- `convex/lib/aiGateway.ts`
- `convex/users.ts`
- `convex/onboarding.ts`
- `convex/birthData.ts`
- `convex/charts.ts`
- `convex/readings.ts`
- `convex/journal.ts`
- `convex/relationships.ts`
- `convex/subscriptions.ts`
- `convex/notifications.ts`
- `convex/devices.ts`
- `convex/contentModules.ts`
- `convex/lib/backoffice.ts`
- `convex/lib/orbita.ts`
- `convex/lib/users.ts`
- `src/components/backoffice/BackofficeLab.tsx`
- `src/components/web/orbita-landing.tsx`
- `src/components/web/orbita-studio.tsx`
- `src/components/ui/`
- `src/lib/utils.ts`
- `src/content/webAssets.ts`
- `src/services/backofficeRefs.ts`
- `src/services/studioRefs.ts`
- `src/services/backendProviders.tsx`
- `src/services/notifications.ts`
- `src/services/supabase.ts`
- `src/services/storage.ts`
- `src/hooks/useAppState.tsx`
- `src/content/catalog.ts`
- `src/domain/readingEngine.ts`
- `app/onboarding.tsx`
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/index.tsx`
- `app/(tabs)/explore.tsx`
- `app/(tabs)/relationship.tsx`
- `app/(tabs)/journal.tsx`
- `app/(tabs)/profile.tsx`
- `assets/orbita/figma/onboarding-v44/backgrounds/`
- `assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_08_background__152-16.png`
- `assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_11_chart_image__152-22.png`
- `assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_12_background__152-26.png`
- `assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_13_background__152-28.png`
- `assets/orbita/figma/onboarding-v44/02-benefit-slots/`
- `assets/orbita/optimized/onboarding-v44/`
- `assets/orbita/core/`
- `assets/orbita/higgsfield/archive-7/`
- `assets/orbita/higgsfield/archive-9/`
- `assets/orbita/higgsfield/archive-10/`
- `assets/orbita/symbolic-library/`

## Next Steps

1. In any new thread, read `AGENTS.md` first and follow it.
2. If continuing design/Figma work, inspect `docs/figma-context.md`, then open the current Figma pages before changing anything.
3. If continuing onboarding visual work, start from Figma page `UX V4.4 - Órbita Onboarding Immersive Pass` and compare against `UX V4.3 - Órbita Onboarding Copy`.
4. If continuing asset work, inspect `assets/orbita/higgsfield/`, `assets/orbita/symbolic-library/`, and any new batch mentioned by the user. Preserve raw files and create manifests/contact sheets/classification folders.
5. If the user wants more exact local Archive 7/9/10 PNGs applied to Figma, use the same explicit-approval upload route that succeeded for `05-09`; do not silently fall back to old in-file fills unless the user asks.
6. If continuing onboarding app implementation, inspect `app/onboarding.tsx` and the RNR/NativeWind config. Next practical slice is to fix the NativeWind/Reanimated export failure, launch the app on physical iPhone/Expo Go, verify `05` and `09` native pickers, `03`/`15` radio behavior, `14` avatar/input behavior, then publish a new EAS `preview` update only after it opens locally.
7. If continuing Web V0, start from `/`, `/studio`, `src/components/web/`, `src/content/webAssets.ts`, and `convex/studio.ts`. Next practical slice: run `pnpm exec convex dev --once --typecheck disable` locally to publish the Studio access query, then open `/` and `/studio` in Expo Web with and without a Clerk session.
8. If continuing backend work, start from `docs/backend-todo.md`, `docs/backend-setup.md`, `/backoffice`, `/lab`, and `../orbita-backend/convex/`. Next practical slice: set Vercel AI Gateway envs in Convex, use `/lab` to test Lucas with Home template, Home LLM, and Timeline, then decide which generated outputs move to persisted/cache-backed user dailies. Do not connect this to the app until lab outputs are approved.
7. If continuing Web V0 or `/lab`, start from `/`, `/lab`, `/studio`, `src/components/web/`, `src/content/webAssets.ts`, `src/services/publicLabRefs.ts`, `convex/publicLab.ts`, and `convex/studio.ts`. Next practical slice: have Claude add UI toggles/buttons for `llmEnabled`, `previewLlmHome`, `includeTimeline`, and `previewTransitTimeline`, then test Lucas with Home template, Home LLM, and Timeline.
8. If continuing backend work, start in `../orbita-backend` (`feature/api`). Next practical slice: set Convex envs for Vercel AI Gateway (`AI_GATEWAY_API_KEY`, `ORBITA_LLM_MODEL`, `ORBITA_LLM_ENABLED=true`), run a live `publicLab:previewLlmHome`, compare generated copy against guardrails, then decide what gets cached for real users. Do not connect provider-real astrology to the app until lab outputs are approved.
7. If continuing Web V0 or `/lab`, start from `/`, `/lab`, `/studio`, `src/components/web/`, `src/content/webAssets.ts`, `src/services/publicLabRefs.ts`, `convex/publicLab.ts`, and `convex/studio.ts`. Next practical slice: use `/lab` to generate the Lucas base case and `Horóscopo completo`, then verify that each feature block shows source, status, missing needs, and provider state.
8. If continuing backend work, start in `../orbita-backend` (`feature/api`). Next practical slice: choose/configure the real astrology provider or Kerykeion/FastAPI service, configure location lookup, add a global daily sky job, add per-profile natal/daily transit cache, and define the LLM prompt/cache policy. Do not connect provider-real astrology to the app until lab outputs are approved.
9. If continuing content/product planning, start from `docs/home-contenidos-personalizados.md`, then use `docs/textos-analisis-personalizacion.md` and `docs/referencias-costar-moonly-orbita.md` as broader references. Next practical slice: replace demo editorial strings with a real Orbita P0 editorial bank for headline, topics, three `Hacé`, three `Evitá`, action, question, Deep Dive, Void prompts, Future Self prompts, and personalization trace copy.
10. If continuing device distribution, first unblock `expo export --platform all` for the RNR/native picker pass. The latest failure is a Worklets Babel transform exception while bundling Reanimated; the next likely fix is aligning `@babel/plugin-transform-react-jsx` with Babel 7 instead of the accidentally installed 8.x package, then rerunning export and `eas update --branch preview`.
11. After any meaningful step, update this file with status, decisions, relevant files, next steps, and verification.

## Verification

- Backend Web B0 verification on 2026-07-05: `pnpm typecheck` passed in `../orbita-backend`; `pnpm test` was blocked in-sandbox by the local `tsx` pipe permission, then passed outside the sandbox with 38 tests and 0 failures. Verified local exports for `charts.valuesMap`, `charts.personalityReading`, `transits.getToday`, and `places.resolve` in `convex/_generated/api.d.ts`.
- Public-dev AI Gateway + timeline verification in `../orbita-backend`: `pnpm typecheck` passed; `pnpm test` passed outside the sandbox with 30 tests and 0 failures, covering disabled Gateway fallback, 429 fallback, JSON parsing/merge, weekly transit windows, and raw hiding for public timeline. Convex dev synced successfully. Live `publicLab:previewLlmHome` returned real AstrologyAPI data plus `llm.status=not_configured` until Gateway envs are set; live `publicLab:previewTransitTimeline` returned `natal_transits/weekly` events with `startTime`, `exactTime`, `endTime`, priority, and raw hidden.
- AI Gateway `orbita-dev` is now configured in Convex dev. Live `publicLab:previewLlmHome` returned `llm.status=success` with model `openai/gpt-5.4`, tags `feature:orbita-lab`, `env:dev`, `user:lab`, usage `875` prompt tokens + `321` completion tokens, and generated Home copy for headline, `Hacé`, `Evitá`, action, question, and long read.
- Public-dev AI Gateway + timeline verification: `pnpm typecheck` passed in `../orbita-backend`; `pnpm test` passed outside the sandbox with 30 tests and 0 failures after adding tests for disabled Gateway fallback, 429 Gateway fallback, JSON parse/merge, weekly transit `start/exact/end`, and public timeline raw hiding. Convex dev synced successfully with `pnpm exec convex dev --once --typecheck disable`.
- Live Convex lab verification: `publicLab:previewLlmHome` for Lucas returned real AstrologyAPI chart/transits plus `llm.status=not_configured` with gaps `ai_gateway_api_key_not_configured` and `orbita_llm_model_not_configured`, without blocking the template Home. `publicLab:previewTransitTimeline` with `includeNatalWeekly=true` returned provider `success`, endpoint `natal_transits/weekly`, and upcoming events with `startTime`, `exactTime`, `endTime`, `priority`, and raw hidden.
- AI Gateway `orbita-dev` live verification: after setting `AI_GATEWAY_API_KEY` in Convex dev, `publicLab:previewLlmHome` returned `llm.status=success` with model `openai/gpt-5.4`, tags `feature:orbita-lab`, `env:dev`, `user:lab`, and usage `875` prompt tokens + `321` completion tokens. Generated Home copy replaced headline, `Hacé`, `Evitá`, action, question, and long read while preserving provider chart/transit data and public raw hiding.
- Public-dev complete horoscope verification: `pnpm typecheck` passed in `../orbita-backend`, `pnpm test` passed with 25 tests and 0 failures, Convex dev synced with `pnpm exec convex dev --once --typecheck disable`, and `publicLab:previewCompleteHoroscope` returned the Lucas base profile with provider `not_configured`, six feature blocks, `dailyHome`, cache plan, raw policy, and explicit next backend needs.
- Public-dev complete horoscope verification: `pnpm typecheck` passed in `../orbita-frontend`; Expo Web is running at `http://127.0.0.1:8081/lab`; HTTP checks to both `localhost:8081/lab` and `127.0.0.1:8081/lab` returned 200 after starting Expo outside the sandbox.

- `docs/api-astrologica-orbita.md` documents the current AstrologyAPI choice, the provider endpoints, what data comes from the API, what Orbita must own, and why the provider output is not the final user-facing reading.
- `docs/referencias-costar-moonly-orbita.md` documents Co-Star vs Moonly feature/copy/product patterns, the Orbita decision matrix, and why onboarding, natal chart, daily readings, calendar, payment, relationships, and CMS/backoffice need separate implementation paths.
- `docs/home-contenidos-personalizados.md` documents the focused content inventory the user requested: what daily/home text modules Co-Star and Moonly inspire, how Orbita should personalize them from natal chart + daily transits, what editorial banks are needed, and what the backend should return before any app UI work.
- Home Lab implementation verified locally with TypeScript and tests; the app public flow remains untouched.
- Home P0 backend contract verification in `../orbita-backend`: `pnpm typecheck` passed, `pnpm test` passed with 21 tests and 0 failures, and `pnpm convex:codegen` regenerated `convex/_generated/` with the new `home` module.

- Confirmed main docs exist and describe Órbita as current product direction.
- Confirmed workspace files include Expo app, docs, Supabase schema, tests, and asset libraries.
- Confirmed `AGENTS.md` now tells new threads how to bootstrap themselves.
- Confirmed prompt-only Figma page references are marked as historical/non-source-of-truth.
- Confirmed Figma API exposes `UX V4.3 - Órbita Onboarding Copy` and inspected onboarding frames including birthdate, birthplace, base chart, personalizing, account, and payment.
- Confirmed `docs/backend-todo.md` now contains the backend/connections todo list.
- Confirmed Mobbin references for Co-Star onboarding, Co-Star Home, Moonly onboarding/payment, and Moonly Home were inspected through the Mobbin connector plus local temporary screenshot downloads under `/private/tmp/orbita-mobbin/`.
- Confirmed Figma API still exposes only `UX V4.3 - Órbita Onboarding Copy` as a top-level page in this session; `UX V4.5 - Órbita App Core` and `UX V4.6 - Órbita Asset Library` remain documented sources but were analyzed through project docs.
- Added `docs/textos-analisis-personalizacion.md` as the content and analysis inventory for static copy, dynamic personalized modules, editorial libraries, Plus/payment copy, privacy/error states, and prioritization.
- TypeScript passed with direct local `tsc --noEmit`.
- Tests passed with direct local `tsx --test test/*.test.ts`: 12 tests, 0 failures.
- Órbita Web V0 verification: `pnpm typecheck` passed after adding `/`, `/studio`, web components, web asset manifest, and `convex/studio.ts`.
- Órbita Web V0 verification: `pnpm test` was blocked in-sandbox by the `tsx` pipe permission, then passed outside the sandbox with 21 tests and 0 failures.
- Órbita Web V0 verification: `pnpm exec expo export --platform web --output-dir /private/tmp/orbita-web-v0-export --clear` completed successfully and bundled the new landing/Studio routes plus web assets.
- Órbita Web V0 verification: `pnpm web` / `expo start --web` could not be used for preview because Expo CLI hit a Node 24 `ERR_SOCKET_BAD_PORT` during port discovery, and the fixed-port attempt hung before serving. A static export server was started at `http://127.0.0.1:8099/`.
- Órbita Web V0 verification: automated screenshots could not be captured because Playwright is installed but its Chromium binary is missing, and no local Chrome/Edge app was available.
- Órbita Web V0 verification: Convex dev sync was attempted but blocked by policy because it would upload local backend code to an external Convex deployment. The local code is ready; the user must run the sync command locally.
- `pnpm test` and `pnpm typecheck` wrappers attempted to run a pnpm install/status check and aborted in no-TTY mode; direct binaries were used for verification.
- Earlier `convex codegen --typecheck=disable` failed before `CONVEX_DEPLOYMENT` existed; this is now superseded by the linked `dutiful-viper-815` setup.
- Backoffice Lab V1 verification: `pnpm typecheck` passed.
- Backoffice Lab V1 verification: `pnpm test` was blocked in-sandbox by the `tsx` pipe permission, then passed outside the sandbox with 15 tests and 0 failures.
- Backoffice Lab V1 verification: Convex env setup succeeded and `convex/_generated/` was created locally, but the final Convex function upload step remains blocked for Codex by external-transfer policy.
- Backoffice Lab V1 verification: `expo export --platform web --output-dir /private/tmp/orbita-backoffice-web-export` completed successfully, so the `/backoffice` route bundles for Expo Web.
- Backoffice Astro Lab V1 verification: `pnpm typecheck` passed after adding AstrologyAPI adapter, chart/transit normalization, fixtures, review status, and backoffice UI controls.
- Backoffice Astro Lab V1 verification: `pnpm test` was blocked in-sandbox by the `tsx` pipe permission, then passed outside the sandbox with 21 tests and 0 failures.
- Backoffice live lab verification: Expo Web is running at `http://localhost:8081/backoffice`, Clerk + Convex auth works for `lucaszramos11@gmail.com`, `Lucas prueba` was saved, and `Correr proveedor astrológico` created a run dated `2026-07-04` with `orbita-stub-v1+provider-not_configured`, request `{ day: 11, month: 11, year: 1996, hour: 10, min: 48, lat: -34.6037, lon: -58.3816, tzone: -3, house_type: "placidus" }`, and gaps `astrologyapi_credentials_not_configured` plus `editorial_review_required_before_app_release`.
- Backoffice live lab UI note: at the default narrow browser width, the `Ejecución del modelo` controls can be visually overlapped by the side panels; a 1280px-wide viewport showed the controls correctly and allowed the provider run.
- Backoffice inspector UI verification: `pnpm typecheck` passed, `pnpm test` passed outside the sandbox with 21 tests and 0 failures, and the in-app browser at `http://localhost:8081/backoffice` shows the inspector summary plus contained JSON blocks instead of overlapping raw payloads.
- Backend/API documentation verification: `docs/api-astrologica-orbita.md` was created from local adapter code plus official AstrologyAPI docs for `western_chart_data`, `natal_chart_interpretation`, `natal_transits/daily`, and Geo Location API.
- Backoffice Clerk-only verification: Convex dev sync completed from the user's terminal with `functions ready`; local preview at `http://127.0.0.1:8084/backoffice` responds. The UI was then changed back to Clerk-only access to avoid the generic-code path.
- Backoffice Clerk-only final verification: `tsc --noEmit` passed, `tsx --test test/*.test.ts` passed with 15 tests and 0 failures, Expo Web export completed to `/private/tmp/orbita-backoffice-web-export`, `http://127.0.0.1:8084/backoffice` responds, and the exported bundle no longer contains the internal-code strings.
- Backoffice auth/design polish verification: Clerk JWT template `convex` was created in Clerk with audience `convex`; `src/components/backoffice/BackofficeLab.tsx` now gates on `useConvexAuth()` before rendering lab queries/mutations; blocked auth returns only the compact header plus the relevant notice.
- Backoffice/onboarding polish verification: `pnpm typecheck` passed, tests passed with 15 tests and 0 failures, and `expo export --platform web --output-dir /private/tmp/orbita-backoffice-web-export --clear` completed successfully after the auth/design/onboarding changes.
- Backoffice query-write regression verification: `pnpm test` now includes `backoffice read auth does not write when the user row does not exist yet`; latest run passed 16 tests, 0 failures.
- Latest verification after the Convex helper fix and local `debugStep` change: `pnpm typecheck` passed, `pnpm test` passed with 16 tests and 0 failures, and Expo Web export completed to `/private/tmp/orbita-backoffice-web-export`.
- In-app browser verification of `/onboarding?debugStep=3`, `5`, `8`, and `9` on `http://127.0.0.1:8084` showed the fixed canvas centered in a `1280x720` viewport with center delta `0`; the expected screen copy rendered for daily guidance, birthdate selected, birth time picker, and birth time selected.
- In-app browser verification of `/backoffice` confirmed Clerk identity reaches Convex. The remaining visible `e.db.insert is not a function` error comes from the currently deployed Convex function version and should clear after the user reruns `pnpm exec convex dev --once --typecheck disable`.
- Backoffice white-screen fix: `src/components/backoffice/BackofficeLab.tsx` no longer references the `SecondaryButton` component that Metro omitted from the web bundle; the secondary stub action now renders directly as a `Pressable`.
- Backoffice white-screen verification: `pnpm typecheck` passed, `pnpm test` passed with 21 tests and 0 failures, Expo Web export completed, the exported bundle changed to `entry-d01709cf2062919060983f8c6f84a820.js`, and `rg` confirmed the bundle no longer contains `SecondaryButton`.
- In-app browser verification after the white-screen fix: `/backoffice` loads the new `entry-d017...` bundle and renders the Backoffice shell instead of a blank page. The only remaining blocker shown in the UI is the deployed Convex `e.db.insert is not a function` error, which still requires rerunning `pnpm exec convex dev --once --typecheck disable`.
- Backoffice auth clarification: the visible session card confirms Google/Clerk login is working for `lucaszramos11@gmail.com`; the remaining `e.db.insert is not a function` message is a stale Convex deployment problem, not an auth problem.
- Backoffice stale-deployment UI polish: `friendlyBackofficeError` now maps `e.db.insert is not a function` to a clear `Convex necesita sincronizarse` message that tells the user to rerun `pnpm exec convex dev --once --typecheck disable`.
- Latest verification after the stale-deployment message polish: `pnpm typecheck` passed and Expo Web export completed with bundle `entry-2e1fbc6d981d6ee15fb286bd56c33da3.js`.
- Verified Figma V4.4 onboarding pass with screenshots of the full page and detailed frames: `01`, `02`, `04`, `08`, `10`, `11`, `12`, `13`, and `15`.
- Fixed CTA contrast after screenshot review on dark screens with light CTAs.
- Added editable orbital geometry inside `04 / Daily Guidance` phone after review so the phone no longer depends on an inner square image.
- Verified the focused `05-09` real-asset pass with screenshots of `05`, `06`, `07`, `08`, and `09`, plus a final `09` screenshot after button polish.
- Confirmed Figma image hashes for the real uploaded assets: Daily Texture B `08d5a1cefa31f275148b77a2926c100bead696e2`, Sol idx25 `af326408cc03d06fa9d089655a535433de129522`, Horizonte idx27 `74d9ce51392d50d1129812a6746c64cbf40e1c50`, and Anillos idx15 `f01be82e91d78c2d2c75f3729fee4e3d5dbaef5a`.
- Verified `15 / Onboarding Payment / Scroll` after the full-bleed premium pass with a complete Figma screenshot. Confirmed the real Archive 7 idx62 upload hash is `a15ff7f68be7ee3b494237e742a6d94233ce7f6a`, applied full-screen to the background image node.
- Verified local asset paths and dimensions for the React Native handoff, including `orbita_daily_texture_b.png`, Archive 10 Sol `idx25`, Horizonte `idx27`, Anillos `idx15`, Tránsitos `idx30`, Backplate `idx34`, Before/After `idx53`/`idx81`, and Archive 7 Payment `idx62`.
- After implementing `app/onboarding.tsx`, TypeScript passed with bundled Node: `tsc --noEmit`.
- After implementing `app/onboarding.tsx`, tests passed with bundled Node outside the sandbox after the TSX pipe was blocked in-sandbox: `tsx --test test/*.test.ts`, 12 tests, 0 failures.
- Guardrail search in `app/onboarding.tsx` found no previous-brand text, transit-heavy claim, `NASA`, `védica`/`vedica`, or unaccented signal copy.
- Expo dev server originally crashed inside the sandbox with `ERR_SOCKET_BAD_PORT`; after adding web dependencies and running outside the sandbox, Expo Web is serving at `http://localhost:8081`.
- Native Expo preview was launched successfully with `expo start --ios --localhost --port 8081 --clear`. Verified via simulator screenshot that the app renders the Órbita onboarding on iPhone 17 Pro (`02 / 15`, CTA `Empezar el viaje`).
- Latest TypeScript check passed with bundled Node after the Explore/tab copy cleanup: `tsc --noEmit`.
- Latest tests passed outside the sandbox after the TSX pipe was blocked in-sandbox: `tsx --test test/*.test.ts`, 12 tests, 0 failures.
- Latest guardrail search across `AGENTS.md`, `app`, `src`, app config, package metadata, README, project context, current task, and docs found no previous-brand literal strings and no unaccented signal copy.
- Latest iOS Simulator screenshot confirms Órbita onboarding renders on `iPhone 17 Pro` without the Metro disconnect warning.
- Figma V4.4 was inspected through the plugin API, visible signal copy was confirmed valid for Órbita, and implementation note node `182:2` was created and selected on the V4.4 page.
- Pixel-perfect `01-04` pass: TypeScript passed with bundled Node via `pnpm typecheck`.
- Pixel-perfect `01-04` pass: tests passed outside the sandbox because `tsx` needs a local pipe: `pnpm test`, 12 tests, 0 failures.
- Pixel-perfect `01-04` pass: guardrail search in `app/onboarding.tsx` found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`, and no unaccented `senal`.
- Pixel-perfect `01-04` pass: `git status --short` was attempted again and the folder still does not respond as a git checkout.
- Pixel-perfect `01-04` pass: Figma references were captured from frames `151:33`, `151:47`, `151:70`, and `151:105`; Simulator screenshots were captured at `/private/tmp/orbita-onboarding-01-final.png`, `/private/tmp/orbita-onboarding-02-final.png`, `/private/tmp/orbita-onboarding-03-final.png`, and `/private/tmp/orbita-onboarding-04-final2.png`.
- Pixel-perfect `01-04` pass: Expo Go SDK 51 is installed in the `iPhone 17 Pro` Simulator and the app is open through Expo on `exp://127.0.0.1:8082`.
- EAS setup: `expo whoami` confirmed `lucasssram`; `eas init --force` created and linked `@lucasssram/orbita`.
- EAS setup: added `eas.json`, `owner: "lucasssram"`, EAS project ID, iOS non-exempt encryption flag, `.gitignore`, `.easignore`, `.npmrc`, and pnpm/EAS dependency fixes.
- EAS setup: Android build initially failed because the archive was 2.3 GB; `.easignore` reduced the upload to 1.3 GB.
- EAS setup: Android build then failed on pnpm workspace metadata; adding `packages: ["."]` to `pnpm-workspace.yaml` fixed dependency install on EAS pnpm 9.
- EAS setup: Android build then failed on Gradle resolving `@react-native/gradle-plugin`; adding `node-linker=hoisted` and explicit `@react-native/gradle-plugin@0.74.87` fixed the native build.
- EAS setup: installed SDK 51-compatible `expo-auth-session@~5.5.2` and `expo-web-browser@~13.0.3` to satisfy Clerk peer deps outside Expo Go.
- EAS verification: after the final EAS fixes, TypeScript passed with `pnpm typecheck` and tests passed outside the sandbox with `pnpm test`, 12 tests, 0 failures.
- Onboarding load hotfix: generated optimized JPEG derivatives for the heavy onboarding assets under `assets/orbita/optimized/onboarding-v44/`; folder size is about `5.6M`.
- Onboarding load hotfix: TypeScript passed with `pnpm typecheck`; tests passed outside the sandbox with `pnpm test`, 12 tests, 0 failures.
- Onboarding load hotfix: `expo export --platform ios` completed successfully and showed the onboarding assets using the optimized JPEGs instead of the heavy raw PNGs.
- Onboarding load hotfix: guardrail search in `app/onboarding.tsx` found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, no unaccented `senal`, and no superseded payment claim strings.
- Onboarding load hotfix: EAS `preview` branch now lists `Onboarding load hotfix optimized assets` first, group `809f8cfb-cd54-4e10-a545-b03be399adb1`, runtime `exposdk:54.0.0`.
- Onboarding native UI primitives pass: TypeScript passed with `pnpm typecheck`; tests passed outside the sandbox with `pnpm test`, 21 tests, 0 failures; iOS export passed with `pnpm exec expo export --platform ios --output-dir /private/tmp/orbita-ui-primitives-export`.
- Onboarding native UI primitives pass: guardrail search in `app/onboarding.tsx` and `src/components/ui` found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, no unaccented `senal`, and no superseded payment claim strings.
- Onboarding native UI primitives pass: EAS `preview` branch now lists `Onboarding native ui primitives pass` first, group `edb14d63-a72b-4fe9-b344-3e13aa296024`, runtime `exposdk:54.0.0`.
- Onboarding RNR/native picker pass: `pnpm typecheck` passed after adding NativeWind/RNR and `@react-native-community/datetimepicker`.
- Onboarding RNR/native picker pass: `pnpm test` is still blocked in-sandbox by the `tsx` pipe permission, then passed outside the sandbox with 21 tests, 0 failures.
- Onboarding RNR/native picker pass: `pnpm exec expo export --platform ios --output-dir /private/tmp/orbita-rnr-onboarding-export` completed successfully and bundled the existing optimized onboarding assets plus the new NativeWind/RNR runtime.
- Onboarding RNR/native picker pass: guardrail search in `app/onboarding.tsx` found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`, no unaccented `senal`, and no remaining `WheelControl`/Figma wheel component references.
- Onboarding RNR/native picker pass publish attempt: `eas update --branch preview --message "Onboarding RNR native picker pass" --platform all --non-interactive` failed before publishing because Expo export could not resolve `@babel/plugin-transform-react-jsx`. Adding the latest package installed `8.0.1`, which is not aligned with the project's Babel 7 stack.
- Onboarding RNR/native picker pass publish attempt: after reinstalling Expo SDK 54-compatible `react-native-reanimated` / `react-native-worklets`, `pnpm typecheck` still passes but `expo export --platform all` fails while transforming `react-native-reanimated/src/animation/timing.ts` with `[Worklets] Babel plugin exception: Cannot read properties of undefined (reading 'length')`. No new EAS update was published; `edb14d63-a72b-4fe9-b344-3e13aa296024` remains the latest published phone-compatible preview.
- EAS verification: Android preview build `41da1364-fc7b-40d9-ac70-c244c48332ab` completed successfully; Gradle log showed `BUILD SUCCESSFUL in 6m 32s`, produced `app-release.apk` at 131 MB, and Expo returned the install URL.
- EAS Update verification: `eas update:configure` added `expo-updates`, `updates.url`, runtime version policy `appVersion`, and channel `preview`.
- EAS Update verification: `eas update --branch preview --message "Orbita preview update" --platform all` published update group `52c16c65-723d-4684-b5c6-a72985f2520d` for Android and iOS, runtime `0.1.0`.
- EAS Update verification: `eas update:list --branch preview --limit 5 --json` returned branch `preview` with the new update group. To see it in Expo Go, refresh/reopen the project's branch list.
- EAS Update fixes: direct dependencies `expo-asset` and `babel-preset-expo` were added because pnpm did not expose them to Expo export unless they were declared explicitly.
- SDK 57 migration verification: `pnpm typecheck` passed with bundled Node.
- SDK 57 migration verification: `pnpm test` passed with bundled Node, 12 tests, 0 failures.
- SDK 57 migration verification: `pnpm exec expo install --check` reported dependencies are up to date.
- SDK 57 migration verification: `expo export --platform all` completed for web, iOS, and Android at `/private/tmp/orbita-sdk57-export-check2`.
- SDK 57 EAS Update verification: `eas update --branch preview --message "Orbita Expo Go SDK 57 preview" --platform all` published update group `b331824b-a4a9-4b9f-8442-6c41266a29e9` for Android and iOS, runtime `0.2.0`, commit `cbfe6fa8d588377a6679cb6e66efa996e6618b7a`.
- SDK 57 EAS Update verification: `eas update:list --branch preview --limit 5 --json` shows the SDK 57 runtime `0.2.0` update first and the old SDK 51 runtime `0.1.0` update second.
- Expo Go runtime fix verification: `app.json` now uses runtime policy `sdkVersion`.
- Expo Go runtime fix verification: `pnpm typecheck` passed and `pnpm test` passed, 12 tests, 0 failures.
- Expo Go runtime fix verification: `eas update --branch preview --message "Orbita Expo Go sdk runtime preview" --platform all` published update group `fe0c62e3-b873-490c-81d2-b02d816eee39` for Android and iOS, runtime `exposdk:57.0.0`, commit `1bdea70d85a4f1f79e8942be242be8bd96db801f`.
- Expo Go runtime fix verification: `eas update:list --branch preview --limit 5 --json` shows `exposdk:57.0.0` as the latest update above the incompatible `0.2.0` and `0.1.0` updates.
- SDK 54 phone compatibility verification: `pnpm exec expo install --check` reported dependencies are up to date.
- SDK 54 phone compatibility verification: `pnpm typecheck` passed.
- SDK 54 phone compatibility verification: `pnpm test` passed, 12 tests, 0 failures.
- SDK 54 phone compatibility verification: `expo config --json` reports `sdkVersion: "54.0.0"` and runtime policy `sdkVersion`.
- SDK 54 phone compatibility verification: `expo export --platform all` completed for web, iOS, and Android at `/private/tmp/orbita-sdk54-export-check`.
- SDK 54 phone compatibility verification: `eas update --branch preview --message "Orbita Expo Go SDK 54 preview" --platform all` published update group `feaa6ecc-784c-4396-af5b-4d7ce6466603` for Android and iOS, runtime `exposdk:54.0.0`, commit `990cfb9feae336e8ee2941a974121a9155c25f07`.
- Onboarding `10-11` polish verification: `pnpm typecheck` passed.
- Onboarding `10-11` polish verification: `pnpm test` passed outside the sandbox after the `tsx` pipe was blocked in-sandbox, 12 tests, 0 failures.
- Onboarding `10-11` polish verification: guardrail search in `app/onboarding.tsx`, `app.json`, `package.json`, and `src` found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Onboarding `10-11` polish verification: web export screenshots were captured at `/private/tmp/orbita-polish-c-app-10.png` and `/private/tmp/orbita-polish-c-app-11.png` and compared against Figma references `/private/tmp/orbita-figma-10.png` and `/private/tmp/orbita-figma-11.png`.
- Onboarding `10-11` polish verification: iOS export completed at `/private/tmp/orbita-onboarding-export-check-10-11-polish`.
- Onboarding `10-11` polish verification: EAS Update `Onboarding 10 11 Figma polish` published on branch `preview`, group `8cc0e33b-31a3-420f-9385-48b80f5feae8`, runtime `exposdk:54.0.0`, and `eas update:list --branch preview --limit 4 --json` confirmed it is first on the branch.
- SDK 54 phone compatibility verification: `eas update:list --branch preview --limit 6 --json` showed `exposdk:54.0.0` as the latest update above the incompatible SDK 57/app-version updates at that point; this was later superseded by the Figma correction updates on the same SDK 54 runtime.
- Pixel-perfect `05-15` continuation verification: `pnpm typecheck` passed with bundled Node.
- Pixel-perfect `05-15` continuation verification: `pnpm test` passed, 12 tests, 0 failures.
- Pixel-perfect `05-15` continuation verification: guardrail search in active app code found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Pixel-perfect `05-15` continuation verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check` completed successfully.
- Pixel-perfect `05-15` continuation verification: local Simulator launch was attempted on booted `iPhone 17`, but the installed Expo Go client there is SDK 57 and rejects this SDK 54 project. The practical review path remains the physical phone's Expo Go SDK 54-compatible `preview` branch.
- Pixel-perfect `05-15` EAS Update verification: `eas update --branch preview --message "Pixel-perfect onboarding 05-15" --platform all` published update group `883c6ea6-9778-4d5b-85b1-f3702c457f9b` for Android and iOS, runtime `exposdk:54.0.0`, commit `24721abcf9a01a53d7985a68bc49feeb30a6b835*`.
- Figma correction `09-11` verification: `pnpm typecheck` passed with bundled Node.
- Figma correction `09-11` verification: `pnpm test` passed, 12 tests, 0 failures.
- Figma correction `09-11` verification: guardrail search in active app code found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Figma correction `09-11` verification: Expo config reports `name: "Órbita"`, `slug: "orbita"`, `owner: "lucasssram"`, `sdkVersion: "54.0.0"`, runtime policy `sdkVersion`, and EAS updates URL `https://u.expo.dev/9e91bb5e-e69e-489e-818d-0e377f397147`.
- Figma correction `09-11` verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check` completed successfully.
- Figma correction `09-11` EAS Update verification: `eas update --branch preview --message "Figma correction onboarding 09-11" --platform all` published update group `67909001-cc97-431b-a62a-b56077d962ca` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/67909001-cc97-431b-a62a-b56077d962ca`.
- Figma correction `09-11` EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `67909001-cc97-431b-a62a-b56077d962ca` first on branch `preview`.
- Figma correction `12-13` evidence: Figma V4.4 frame IDs were inspected live: `151:513` for `12 / Personalizing` and `151:569` for `13 / Before After / Órbita`; screenshots were downloaded to `/private/tmp/orbita-figma-12.png` and `/private/tmp/orbita-figma-13.png`.
- Figma correction `12-13` verification: `pnpm typecheck` passed with bundled Node.
- Figma correction `12-13` verification: initial `pnpm test` was blocked by sandbox IPC permissions for `tsx`; rerunning outside the sandbox passed, 12 tests, 0 failures.
- Figma correction `12-13` verification: guardrail search in active app code found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Figma correction `12-13` verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check-12-13` completed successfully.
- Figma correction `12-13` EAS Update verification: `eas update --branch preview --message "Figma correction onboarding 12-13" --platform all` published update group `15729fbc-1046-4e97-9d1e-46db92f0517a` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/15729fbc-1046-4e97-9d1e-46db92f0517a`.
- Figma correction `12-13` EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `15729fbc-1046-4e97-9d1e-46db92f0517a` first on branch `preview`.
- Figma correction `14-15` evidence: Figma V4.4 frame IDs were inspected live: `151:480` for `14 / Create Account` and `151:610` for `15 / Onboarding Payment / Scroll`; screenshots were downloaded to `/private/tmp/orbita-figma-14.png` and `/private/tmp/orbita-figma-15.png`.
- Figma correction `12-15` verification: `pnpm typecheck` passed with bundled Node.
- Figma correction `12-15` verification: initial `pnpm test` was blocked by sandbox IPC permissions for `tsx`; rerunning outside the sandbox passed, 12 tests, 0 failures.
- Figma correction `12-15` verification: guardrail search in active app code found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Figma correction `12-15` verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check-12-15` completed successfully.
- Figma correction `12-15` EAS Update verification: `eas update --branch preview --message "Figma correction onboarding 12-15" --platform all` published update group `604b39fd-b9c1-4f0c-899d-0c208687e2c0` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/604b39fd-b9c1-4f0c-899d-0c208687e2c0`.
- Figma correction `12-15` EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `604b39fd-b9c1-4f0c-899d-0c208687e2c0` first on branch `preview`.
- Figma correction `05-11` verification: live V4.4 metadata was inspected for frames `151:136`, `151:184`, `151:223`, `151:314`, `151:348`, `151:391`, and `151:428`; reference screenshots for `09`, `10`, and `11` were saved under `/private/tmp/orbita-figma-09.png`, `/private/tmp/orbita-figma-10.png`, and `/private/tmp/orbita-figma-11.png`.
- Figma correction `05-11` verification: local web screenshots were captured at `/private/tmp/orbita-web-step05-after-fix.png`, `/private/tmp/orbita-web-step06-after-fix.png`, `/private/tmp/orbita-web-step07-after-fix.png`, `/private/tmp/orbita-web-step08-after-fix.png`, `/private/tmp/orbita-web-step09-final-this-pass.png`, `/private/tmp/orbita-web-step10-final-this-pass.png`, and `/private/tmp/orbita-web-step11-final-this-pass.png`.
- Figma correction `05-11` verification: `pnpm typecheck` passed with bundled Node.
- Figma correction `05-11` verification: `pnpm test` was blocked in the sandbox by the `tsx` pipe permission, then passed outside the sandbox, 12 tests and 0 failures.
- Figma correction `05-11` verification: guardrail search in active app files found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Figma correction `05-11` verification: `expo export --platform ios` completed at `/private/tmp/orbita-onboarding-export-check-05-11-final`.
- Figma correction `05-11` EAS Update verification: `eas update --branch preview --message "Figma correction onboarding 05-11" --platform all` published update group `ca752f95-c97e-4660-b379-9b1c645acc34` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/ca752f95-c97e-4660-b379-9b1c645acc34`.
- Figma correction `05-11` EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `ca752f95-c97e-4660-b379-9b1c645acc34` first on branch `preview`.
- Figma polish verification: references were downloaded for frames `151:47`, `151:105`, `151:513`, `151:569`, `151:480`, and `151:610`; current app screenshots were captured under `/private/tmp/orbita-current-audit/`, including `app-12-fixed.png`, `app-13-final-pass.png`, `app-14-fixed.png`, and `app-15-final-pass.png`.
- Figma polish verification: `pnpm typecheck` passed with bundled Node.
- Figma polish verification: guardrail search in active app files found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`; matches for `\n` are intentional JS newline strings, not rendered literal text after the fix.
- Figma polish verification: `pnpm test` passed outside the sandbox, 12 tests and 0 failures.
- Figma polish verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check-visual-polish-final` completed successfully.
- Figma polish EAS Update verification: `eas update --branch preview --message "Figma polish onboarding progress payment" --platform all` published update group `66894e41-a209-4f22-9d02-b2496070e093` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/66894e41-a209-4f22-9d02-b2496070e093`.
- Figma polish EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `66894e41-a209-4f22-9d02-b2496070e093` first on branch `preview`.
- Onboarding `13` polish verification: final screenshot `/private/tmp/orbita-audit-latest/app-13-final.png` was compared against Figma reference `/private/tmp/orbita-figma-13.png`; the pass restored the integrated backplate/orbit field, corrected the panel placement, and aligned the CTA color closer to the Figma frame.
- Onboarding `13` polish verification: `pnpm typecheck` passed.
- Onboarding `13` polish verification: `pnpm test` was blocked in the sandbox by the `tsx` pipe permission, then passed outside the sandbox with 12 tests and 0 failures.
- Onboarding `13` polish verification: guardrail search in active app files found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Onboarding `13` polish verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check-13-polish` completed successfully.
- Onboarding `13` EAS Update verification: `eas update --branch preview --message "Onboarding 13 Figma polish" --platform all` published update group `59951ce6-bfff-484d-a5a4-73d02dbc618b` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/59951ce6-bfff-484d-a5a4-73d02dbc618b`.
- Onboarding `13` EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `59951ce6-bfff-484d-a5a4-73d02dbc618b` first on branch `preview`.
- Onboarding `12` Figma background evidence: Figma design context for frame `151:513` confirmed background node `152:26` named `image-bg / 12 / calculation transit field / archive10-idx30`, with image opacity `58%` and wash `#06070A` opacity `58%`.
- Onboarding `12` Figma background evidence: the Figma-resolved background asset was downloaded from the MCP asset URL and added as `assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_12_background__152-26.png`.
- Onboarding `12` polish verification: local dev screenshot `/private/tmp/orbita-audit-latest/app-12-final.png` was compared against Figma reference `/private/tmp/orbita-figma-12.png`; the backplate now matches the circular orbital field instead of the previous diagonal crop.
- Onboarding `12` polish verification: `pnpm typecheck` passed.
- Onboarding `12` polish verification: `pnpm test` was blocked in the sandbox by the `tsx` pipe permission, then passed outside the sandbox with 12 tests and 0 failures.
- Onboarding `12` polish verification: guardrail search in active app files found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Onboarding `12` polish verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check-12-figma-bg` completed successfully.
- Onboarding `12` EAS Update verification: `eas update --branch preview --message "Onboarding 12 Figma background" --platform all` published update group `cfc74531-572c-429b-9cc6-fe37c96b3436` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/cfc74531-572c-429b-9cc6-fe37c96b3436`.
- Onboarding `12` EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `cfc74531-572c-429b-9cc6-fe37c96b3436` first on branch `preview`.
- Onboarding `05` wheel evidence: Figma design context for frame `151:136` confirmed the birthdate picker rows use Newsreader, selected values at `22px`, inactive values at `15px`, and year rows `1992`, `1993`, `1994`, `1996`, `1997`, `1998`, `1999`.
- Onboarding `05` wheel verification: local dev screenshot `/private/tmp/orbita-audit-latest/app-05-final.png` was compared against Figma frame `151:136`; typography, month capitalization, and year rows now match the visible Figma structure more closely.
- Onboarding `05` wheel verification: `pnpm typecheck` passed.
- Onboarding `05` wheel verification: `pnpm test` was blocked in the sandbox by the `tsx` pipe permission, then passed outside the sandbox with 12 tests and 0 failures.
- Onboarding `05` wheel verification: guardrail search in active app files found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Onboarding `05` wheel verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check-05-wheel` completed successfully.
- Onboarding `05` wheel EAS Update verification: `eas update --branch preview --message "Onboarding 05 wheel typography" --platform all` published update group `31b993d7-20af-4a02-8ae1-187774cb2cca` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/31b993d7-20af-4a02-8ae1-187774cb2cca`.
- Onboarding `05` wheel EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `31b993d7-20af-4a02-8ae1-187774cb2cca` first on branch `preview`.
- Onboarding `08` Figma/compositing evidence: Figma design context for frame `151:314` confirmed background node `152:16`, image opacity `22%`, wash `#F7F3EA` opacity `64%`, Newsreader title at `32/38`, body at `24/30`, privacy copy at `y=703`, and CTA at `y=759`.
- Onboarding `08` Figma/compositing evidence: the Figma-resolved background was downloaded as `assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_08_background__152-16.png`; its MD5 hash matches the existing Archive 10 horizon asset (`b9f54720755f30dd60350cdfa3a93afd`), so the visual fix was the missing light base layer under the `22%` image.
- Onboarding `08` polish verification: local dev screenshot `/private/tmp/orbita-audit-latest/app-08-final.png` now shows the warm light horizon/planet treatment instead of the earlier gray composite.
- Onboarding `08` polish verification: `pnpm typecheck` passed.
- Onboarding `08` polish verification: `pnpm test` was blocked in the sandbox by the `tsx` pipe permission, then passed outside the sandbox with 12 tests and 0 failures.
- Onboarding `08` polish verification: guardrail search in active app files found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Onboarding `08` polish verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check-08-bg-clear --clear` completed successfully; the EAS export log included `figma_onboarding_08_background__152-16.b9f54720755f30dd60350cdfa3a93afd.png`.
- Onboarding `08` EAS Update verification: `eas update --branch preview --message "Onboarding 08 Figma background" --platform all` published update group `cf035676-763e-48d1-ba02-5ad15764a740` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/cf035676-763e-48d1-ba02-5ad15764a740`.
- Onboarding `08` EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `cf035676-763e-48d1-ba02-5ad15764a740` first on branch `preview`.
- Onboarding `09` Figma polish evidence: live Figma design context for frame `151:348` confirmed the circular wheel layout, `dailyTextureB` opacity `16%`, wash `#F7F3EA` opacity `70%`, orbital ring node `163:4` opacity `11%`, selector band at `x=67 y=349 w=257 h=36`, Newsreader wheel numerals, `No sé la hora` button at `x=31 y=597 w=329 h=64`, note at `y=685`, and CTA at `y=759 h=48`.
- Onboarding `09` polish verification: local dev screenshot `/private/tmp/orbita-full-audit-current/app-09-after.png` now matches the Figma wheel structure more closely, with softer background, serif hour/minute numerals, the correct selector band, and the white secondary button treatment.
- Onboarding `09` polish verification: `pnpm typecheck` passed.
- Onboarding `09` polish verification: `pnpm test` was blocked in the sandbox by the `tsx` pipe permission, then passed outside the sandbox with 12 tests and 0 failures.
- Onboarding `09` polish verification: guardrail search in active app files found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Onboarding `09` polish verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check-09-wheel` completed successfully.
- Onboarding `09` EAS Update verification: `eas update --branch preview --message "Onboarding 09 Figma wheel polish" --platform all` published update group `b71a3b90-9d20-44d3-ba70-f04dc20bc9c6` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/b71a3b90-9d20-44d3-ba70-f04dc20bc9c6`.
- Onboarding `09` EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `b71a3b90-9d20-44d3-ba70-f04dc20bc9c6` first on branch `preview`.
- Onboarding `15` Figma polish evidence: live Figma design context for frame `151:610` confirmed the fixed `Qué incluye` panel at `x=23 y=585 w=345 h=178`, five absolute benefits chips, `Cómo funciona` at `y=797`, and the final CTA at `y=1111`.
- Onboarding `15` polish verification: local browser screenshots were captured at `/private/tmp/orbita-full-audit-current/app-15-after.png` and `/private/tmp/orbita-full-audit-current/app-15-bottom-after.png`; the benefits panel no longer overlaps the how-it-works section and the long benefits chip no longer truncates.
- Onboarding `15` polish verification: `pnpm typecheck` passed.
- Onboarding `15` polish verification: `pnpm test` was blocked in the sandbox by the `tsx` pipe permission, then passed outside the sandbox with 12 tests and 0 failures.
- Onboarding `15` polish verification: guardrail search in active app files found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Onboarding `15` polish verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check-15-benefits` completed successfully.
- Onboarding `15` EAS Update verification: `eas update --branch preview --message "Onboarding 15 benefits layout" --platform all` published update group `6ed3ba8b-c825-4121-99b5-e7450b4f8a69` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/6ed3ba8b-c825-4121-99b5-e7450b4f8a69`.
- Onboarding `15` EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `6ed3ba8b-c825-4121-99b5-e7450b4f8a69` first on branch `preview`, above the `09`, `08`, and `05` polish updates.
- Onboarding `13` Figma background evidence: live Figma design context for frame `151:569` confirmed background node `152:28` at `44%`, wash `#090A0D` at `54%`, no visible progress/back controls, before panel rotation `3deg`, after panel rotation `-2deg`, and CTA at `y=759`.
- Onboarding `13` Figma background evidence: the Figma-resolved background was downloaded as `assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_13_background__152-28.png` with SHA-256 `e427013f3a6d10e0100ad0bc54505f1b035da1c33b0f6ae018af9b9538552f45`.
- Onboarding `13` polish verification: local browser screenshot `/private/tmp/orbita-full-audit-current/app-13-after-bg.png` was compared against Figma reference `/private/tmp/orbita-figma-13.png`; the background crop, visible chrome, panel sizes, rotations, legal copy, and CTA now match more closely.
- Onboarding `13` polish verification: `pnpm typecheck` passed.
- Onboarding `13` polish verification: `pnpm test` was blocked in the sandbox by the `tsx` pipe permission, then passed outside the sandbox with 12 tests and 0 failures.
- Onboarding `13` polish verification: guardrail search in active app files found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Onboarding `13` polish verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check-13-figma-bg-clean --clear` completed successfully and dropped the unused Archive 7 before/after assets from the export.
- Onboarding `13` EAS Update verification: `eas update --branch preview --message "Onboarding 13 Figma background" --platform all` published update group `29114707-d5b7-4de2-880a-3eb08e4ba823` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/29114707-d5b7-4de2-880a-3eb08e4ba823`.
- Onboarding `13` EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `29114707-d5b7-4de2-880a-3eb08e4ba823` first on branch `preview`, above the `15`, `09`, and `08` polish updates.
- Onboarding `14` Figma account evidence: local browser screenshot `/private/tmp/orbita-full-audit-current/app-14-after-email.png` was compared against Figma reference `/private/tmp/orbita-figma-14.png`; the account screen now shows editable `mica@email.com` in the expected dark editorial field treatment.
- Onboarding `14` polish verification: `pnpm typecheck` passed.
- Onboarding `14` polish verification: `pnpm test` was blocked in the sandbox by the `tsx` pipe permission, then passed outside the sandbox with 12 tests and 0 failures.
- Onboarding `14` polish verification: guardrail search in active app files found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Onboarding `14` polish verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check-14-email --clear` completed successfully.
- Onboarding `14` EAS Update verification: `eas update --branch preview --message "Onboarding 14 account email" --platform all` published update group `dc4f837b-28e7-4858-9420-626583974faa` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/dc4f837b-28e7-4858-9420-626583974faa`.
- Onboarding `14` EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `dc4f837b-28e7-4858-9420-626583974faa` first on branch `preview`, above the `13`, `15`, and `09` polish updates.
- Full onboarding audit evidence: fresh app screenshots for `01-15` were captured under `/private/tmp/orbita-audit-now/`, and a Figma-vs-app comparison board was generated at `/private/tmp/orbita-audit-now/compare-figma-app-01-15.png`.
- Onboarding `07` keyboard-focus verification: local browser check confirmed the active DOM element after opening `debugStep=6` is the city `INPUT` with placeholder `Buenos`; screenshot saved at `/private/tmp/orbita-audit-now/app-07-autofocus.png`.
- Onboarding `07` polish verification: `pnpm typecheck` passed.
- Onboarding `07` polish verification: `pnpm test` was blocked in the sandbox by the `tsx` pipe permission, then passed outside the sandbox with 12 tests and 0 failures.
- Onboarding `07` polish verification: guardrail search in active app files found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Onboarding `07` polish verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check-07-autofocus --clear` completed successfully.
- Onboarding `07` EAS Update verification: `eas update --branch preview --message "Onboarding 07 keyboard focus" --platform all` published update group `db389668-3956-4b98-a806-0a33f53e7846` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/db389668-3956-4b98-a806-0a33f53e7846`.
- Onboarding `07` EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `db389668-3956-4b98-a806-0a33f53e7846` first on branch `preview`, above the `14`, `13`, and `15` polish updates.
- Onboarding light-background evidence: fresh screen `14` browser screenshot is `/private/tmp/orbita-audit-next/app-14-clean-bg.png`; image comparison improved from `rms=63.56 mean=27.79 bg=(217,216,211)` to `rms=49.33 mean=7.24 bg=(243,240,233)` against Figma bg sample `(243,240,235)`.
- Onboarding light-background verification: `pnpm typecheck` passed.
- Onboarding light-background verification: `pnpm test` was blocked in the sandbox by the `tsx` pipe permission, then passed outside the sandbox with 12 tests and 0 failures.
- Onboarding light-background verification: guardrail search in active app files found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Onboarding light-background verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check-light-bg --clear` completed successfully.
- Onboarding light-background EAS Update verification: `eas update --branch preview --message "Onboarding light screens background" --platform all` published update group `d79634c6-b285-40bd-8421-7e7e80dd2143` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/d79634c6-b285-40bd-8421-7e7e80dd2143`.
- Onboarding light-background EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `d79634c6-b285-40bd-8421-7e7e80dd2143` first on branch `preview`, above `Onboarding 07 keyboard focus`, `Onboarding 14 account email`, and `Onboarding 13 Figma background`.
- Onboarding `11` / `07` evidence: fresh app screenshots were captured under `/private/tmp/orbita-audit-fresh/`, including `/private/tmp/orbita-audit-fresh/app-11-after-figma-bg.png`, `/private/tmp/orbita-audit-fresh/app-07-focus-after.png`, and comparison board `/private/tmp/orbita-audit-fresh/compare-figma-app-01-15-after-11.png`.
- Onboarding `11` Figma evidence: live Figma node `152:22` (`image-bg / 11 / integrated base chart diagram / core-chart-a`) was exported to `assets/orbita/figma/onboarding-v44/backgrounds/figma_onboarding_11_chart_image__152-22.png` and wired into `FigmaNatalChartBackdrop` so visible UI remains editable React Native text/symbols.
- Onboarding `07` focus evidence: local browser check on `debugStep=6` confirmed the active DOM element is the city `INPUT` with placeholder `Buenos` after the imperative focus effect.
- Onboarding `11` / `07` verification: `pnpm typecheck` passed.
- Onboarding `11` / `07` verification: guardrail search in active app files found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Onboarding `11` / `07` verification: `pnpm test` was blocked in the sandbox by the `tsx` pipe permission, then passed outside the sandbox with 12 tests and 0 failures.
- Onboarding `11` / `07` verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check-11-07 --clear` completed successfully and included the new `figma_onboarding_11_chart_image__152-22.png` asset.
- Onboarding `11` / `07` EAS Update verification: `eas update --branch preview --message "Onboarding 11 chart and 07 focus" --platform all` published update group `2a77d0fd-68a3-413b-a0ef-5309c72e1c11` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/2a77d0fd-68a3-413b-a0ef-5309c72e1c11`.
- Onboarding `11` / `07` EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `2a77d0fd-68a3-413b-a0ef-5309c72e1c11` first on branch `preview`, above `Onboarding light screens background`, `Onboarding 07 keyboard focus`, and `Onboarding 14 account email`.
- Onboarding `11` radial grid evidence: fresh Figma screenshot for frame `151:428` was downloaded to `/private/tmp/orbita-implement-plan/figma-11-fresh.png`; app screenshots before/after were captured at `/private/tmp/orbita-implement-plan/app-11.png` and `/private/tmp/orbita-implement-plan/app-11-after-grid.png`.
- Onboarding `11` radial grid verification: `app/onboarding.tsx` now renders `FigmaAstroGrid` inside `FigmaNatalChartBackdrop`, restoring the full-screen chart grid behind editable text/metrics.
- Onboarding `11` radial grid verification: `pnpm typecheck` passed.
- Onboarding `11` radial grid verification: guardrail search in active app files found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Onboarding `11` radial grid verification: `pnpm test` was blocked in the sandbox by the `tsx` pipe permission, then passed outside the sandbox with 12 tests and 0 failures.
- Onboarding `11` radial grid verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check-11-grid --clear` completed successfully.
- Onboarding `11` radial grid EAS Update verification: `eas update --branch preview --message "Onboarding 11 radial chart grid" --platform all` published update group `4b8a23d5-a9af-43b0-ad0a-fbd7aa210754` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/4b8a23d5-a9af-43b0-ad0a-fbd7aa210754`.
- Onboarding `11` radial grid EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `4b8a23d5-a9af-43b0-ad0a-fbd7aa210754` first on branch `preview`, above `Onboarding 15 title polish`, `Onboarding 11 chart and 07 focus`, and `Onboarding light screens background`.
- Onboarding `06` sun halo evidence: Figma reference `/private/tmp/orbita-audit-now/figma-06.png` shows the solar emblem without a peach/copper disc behind it, while the previous app capture `/private/tmp/orbita-audit-fresh/app-06.png` showed an artificial circular halo.
- Onboarding `06` sun halo verification: `app/onboarding.tsx` removed the extra `FigmaEllipse color="rgba(196, 106, 58, 0.18)"` layer from `FigmaBirthdateSelectedScreen`; the solar asset remains editable/positioned as before.
- Onboarding `06` sun halo verification: `pnpm typecheck` passed.
- Onboarding `06` sun halo verification: guardrail search in active app files found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, and no unaccented `senal`.
- Onboarding `06` sun halo verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-export-check-06-sun-halo --clear` completed successfully.
- Onboarding `06` sun halo verification: `pnpm test` remained blocked in the sandbox by the `tsx` pipe permission, but the equivalent `node --import tsx --test test/*.test.ts` passed with 12 tests and 0 failures.
- Onboarding `06` sun halo EAS Update verification: `eas update --branch preview --message "Onboarding 06 sun emblem cleanup" --platform all` published update group `4a1c1cf1-1f56-4704-b0c0-7a5a051df7f4` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/4a1c1cf1-1f56-4704-b0c0-7a5a051df7f4`.
- Onboarding `06` sun halo EAS Update verification: `eas update:list --branch preview --limit 4 --json` shows group `4a1c1cf1-1f56-4704-b0c0-7a5a051df7f4` first on branch `preview`, above `Onboarding 11 radial chart grid`, `Onboarding 15 title polish`, and `Onboarding 11 chart and 07 focus`.
- Onboarding immersive asset pass verification: `pnpm typecheck` passed.
- Onboarding immersive asset pass verification: `pnpm test` passed outside the sandbox after the `tsx` pipe was blocked in-sandbox, 12 tests and 0 failures.
- Onboarding immersive asset pass verification: guardrail search in `app/onboarding.tsx` found no previous-brand text, no `Leemos los tránsitos`, no `NASA`, no `védica`/`vedica`, no unaccented `senal`, and no old payment copy strings `Calculamos tu carta`, `Cruzamos tu mapa`, or `Te damos una acción`.
- Onboarding immersive asset pass verification: `expo export --platform ios --output-dir /private/tmp/orbita-onboarding-asset-pass-export-final` completed successfully and bundled the new selected Archive 7/10 asset layers.
- Onboarding immersive asset pass EAS Update verification: `npx eas-cli update --branch preview --message "Onboarding immersive asset pass" --platform all` published update group `b087be8e-061d-4907-95c2-3d446bc56807` for Android and iOS, runtime `exposdk:54.0.0`, dashboard `https://expo.dev/accounts/lucasssram/projects/orbita/updates/b087be8e-061d-4907-95c2-3d446bc56807`.
- Onboarding immersive asset pass EAS Update verification: `npx eas-cli update:list --branch preview --limit 3 --json` shows group `b087be8e-061d-4907-95c2-3d446bc56807` first on branch `preview`, above `Onboarding 06 sun emblem cleanup` and `Onboarding 11 radial chart grid`.

## Home V4.5 (App Core) redesign — 2026-07-05

Working in worktree `../orbita-frontend` (branch `feature/web`). Local/stub only (no Convex).

### What was built
- **Reanimated/Worklets export blocker fixed (Next Step #10):** removed the errant `@babel/plugin-transform-react-jsx@^8.0.1` from `package.json` devDependencies. It was breaking `react-native-worklets`' Babel transform (`[Worklets] Babel plugin exception: Cannot read properties of undefined (reading 'length')`) because babel-preset-expo expects the 7.x plugin. After `pnpm install`, `expo export --platform ios` bundles the full app again.
- **New Órbita dark editorial design system** (`src/theme/orbita.ts`): tokens taken 1:1 from Figma `UX V4.5 - Órbita App Core` (fondo `#111`, bone `#f7f5ef`, muted `#a49f96`/`#777169`, copper `#c46a3a`, line `#39352f`; fonts Newsreader/Inter/Roboto Mono). Does not touch legacy `theme.ts`.
- **Roboto Mono** added (`@expo-google-fonts/roboto-mono`) + shared `src/hooks/useOrbitaFonts.ts`.
- **Home redesigned** (`app/(tabs)/index.tsx`): single dark scroll matching the 4 Figma frames (nodes `92:58/89/128/163`): Top (tríada natal + hero orbital SVG + señal del día + CTA Profundizar), Guía diaria (Hacé/Evitá/Energía + banda Acción), Topics (tabs Amor/Trabajo/Familia/Vínculos + filas tappables), End (lectura larga + módulo educativo + Guardar/Ver historial), plus a secondary **Extras** block keeping the legacy tarot/color/número restyled.
- **Section components** in `src/components/home/` (`sections.tsx`, `OrbitalHero.tsx` SVG hero + mini chart, `DetailScreen.tsx` shell).
- **Detail routes** (`app/reading/_layout.tsx` + `deep-dive.tsx`, `topic.tsx`, `long-read.tsx`), registered in `app/_layout.tsx`. CTAs: Profundizar → deep-dive, topic row → topic detail, Leer análisis → long-read, Guardar → `saveTodayReading`, Ver historial → `/(tabs)/journal`.
- **Tab bar** restyled dark (`app/(tabs)/_layout.tsx`): surface `#151515`, active copper. NOTE: tab labels/routes unchanged (Hoy/Señales/Vínculo/Diario/Perfil); the other 4 tabs are still light content under a dark bar until migrated.
- **Data model** (`src/domain/types.ts`): added `vinculos` topic + `homeTopicOrder`, and `HomeReading`/`Triad`/`HomeTopic`/`Placement` types. `readingEngine.ts` adds `createHomeReading` + `createTriad` (Sun real from birthDate; Moon/Asc deterministic stub, marked `approximate` when birthTime/place missing). Editorial banks in new `src/content/homeCatalog.ts` (Figma copy as first variant). `useAppState` exposes `homeReading`.

### Decisions (from user)
- Alcance: **solo la Home** a fondo; otras 4 pantallas después.
- Legacy tarot/color/número: **se conserva** en bloque "Extras" al final, reestilizado.
- Estilo: **migrar al lenguaje del onboarding** (dark editorial Órbita).
- Workflows: **construir las rutas de detalle** (Profundizar / topic / lectura larga).

### Verification
- `pnpm exec tsc --noEmit`: passed.
- `pnpm exec tsx --test test/*.test.ts`: 14 tests, 0 failures (added 2 for `createHomeReading`: determinism + 4 home topics + approximate/calculated triad).
- Guardrail search on new Home content: clean (no destino/salud/dinero/legal claims, no NASA/védica, no unaccented `senal`).
- `expo export --platform ios --output-dir /private/tmp/orbita-home-export`: **succeeded** after the babel fix (bundle 8.81 MB). Full app (incl. onboarding + new Home) bundles.
- PENDING: visual/device verification. Not yet published to EAS preview. Simulator Expo Go is on a newer SDK than this SDK 54 project, so device review goes through EAS Update on branch `preview` (previous latest was the SDK 51-era `809f8cfb...`; a fresh SDK 54 update was not yet published for this Home pass).

### Next steps
1. Publish an EAS `preview` update for phone review, then compare against Figma frames (screenshots saved in scratchpad: home_top/daily/topics/end).
2. Iterate spacing/hero fidelity from the on-device screenshots.
3. Then migrate the other 4 tabs + consider the tab rename to Inicio/Carta/Tránsitos/Vínculo/Perfil.

## App Core V4.7 — Figma flows + full frontend + backend handoff — 2026-07-05

### Figma
- New page `UX V4.7 - Órbita App Core Flows` (file `BEB5v6SbgJn2Nipm8Qa0wE`): 21 screens across 7 titled Sections with arrows (Inicio / Carta / Tránsitos / Vínculo / Perfil / Luna·Calendario / Estados). Built from `Home V1.1` visual language + real assets (uploaded a moon phase from Archive 10). Dark editorial, Newsreader/Inter/Roboto Mono, copper.

### Frontend (coded to match V4.7, worktree `feature/web`, local/stub)
- **UI kit** `src/components/orbita/kit.tsx` (OrbitaScreen, TopBar, Eyebrow, H1/H2/H3, Body, Triad, Pill, GuideRow, ActionBand, InsightRow, TabStrip, MonoLine, Note) + `TabBar.tsx` (custom 5-tab dark nav) + `states.tsx` (Cargando/Vacío/Error/Bloqueado).
- **Tabs** restructured to Inicio/Carta/Tránsitos/Vínculo/Perfil (`app/(tabs)/`); legacy explore/relationship/profile removed, journal → `app/reading/saved.tsx`.
- **Detail routes** `app/reading/`: carta (Posiciones), transitos (Por área), vinculo-add (form), vinculo-result, calendario (grid), void, plus (paywall), saved + existing deep-dive/topic/long-read.
- **Data** `src/domain/appData.ts` (typed mock: CartaData/TransitosData/VinculoData/PerfilData/LunarData) + existing `readingEngine` HomeReading.
- Verified: `tsc` OK, `tsx --test` 14/14, `expo export --platform ios` OK (bundle 8.86 MB). Not yet reviewed on device.

### Backend handoff (contract — for Codex)
- Most app-core screens map to existing/Web-B0-proposed functions. **3 new functions proposed** (Vínculo + Calendario): `relationships.add`, `relationships.synastry` -> `SynastryPayload`, `calendar.getMonth` -> `CalendarMonthPayload`.
- Contract: `src/services/appCoreRefs.ts` (payload types), `docs/app-core-backend-map.md` (screen->function map), `convex/CHANGELOG.md` (2026-07-05 App Core entry), `// TODO: pendiente backend — App Core V4.7` block in `convex/schema.ts`.
- Front stays on `appData.ts` mock until the 3 functions exist. Wiring = replace `buildAppData` with `useQuery(api.x.y)`.

### Visual fix pass — 2026-07-05 (after first device review)
- First `preview` publish (group `9e5b5f49-969f-45a4-b964-5017ab3f242e`, published by user) looked wrong vs Figma: screens used a hand-drawn SVG ellipse placeholder instead of the real hero assets, and the tab bar truncated labels.
- Fixed: new `src/components/orbita/HeroImage.tsx` renders the REAL core assets per screen (home=orbital_b eclipse, carta=natal diagram, transitos=transitos_visual, vinculo=vinculo_symbol, perfil=orbital_a, longRead=editorial thumbnail) from new optimized derivatives `assets/orbita/optimized/core/*.jpg` (1024px JPEG, ~250 KB each vs 2.5 MB PNGs). Swapped in all 5 tabs, states, paywall thumb, long-read.
- Tab bar: `flex:1` items, font 10, `numberOfLines=1`, `allowFontScaling=false` — no more truncation.
- Header aligned to Figma: mono `ÓRBITA` + `HOY ˅` + divider (was serif "Órbita").
- Inicio copy aligned to V4.7: eyebrow `TU DÍA EN UNA FRASE`, label `CLIMA DEL DÍA`, hero above centered triad.
- User env notes: `@babel/plugin-transform-react-jsx@7.29.7` pinned in devDependencies (EAS export needed it); Simulator Expo Go updated to 54.0.7 with a seeded local test profile.
- Verified: `tsc` OK, tests OK, `expo export --platform ios` OK (8.93 MB; hero asset confirmed in bundle by md5).
- Added missing 21st screen: `app/reading/luna.tsx` (Fase lunar — real Archive 10 moon at `optimized/core/orbita_moon_phase_waxing.jpg` 92 KB, week strip, ACCIÓN LUNAR, CTA → calendario). Home "Fase lunar y calendario" now routes luna → calendario like the Figma flow. Export re-verified with moon asset in bundle.

### Pending / next
- User to republish for device review: `npx eas-cli update --branch preview --message "App core V4.7 — heros reales + tab bar fix" --platform ios` (auto-mode classifier blocks Claude from publishing).
- Iterate fidelity from next device screenshots.
- Backend: implement the 3 proposed functions, then front swaps mock -> Convex.
