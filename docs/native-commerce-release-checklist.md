# Comercio nativo — checklist App Store Connect + RevenueCat

Estado: 2026-08-19. Fuente de verdad operativa para habilitar Órbita Plus en
iOS, probarlo en Sandbox/TestFlight y prepararlo para App Review.

> Este checklist no autoriza deploy, EAS Build, TestFlight, App Review ni
> publicación. Cada acción externa se ejecuta solamente con autorización
> explícita de Lucas. No guardar claves, credenciales ni datos de testers en Git.

## Contrato canónico de esta versión

| Concepto | Valor vigente |
| --- | --- |
| App iOS | Órbita |
| Bundle ID iOS | `com.lucasssram.orbita` |
| Acceso pago interno | `orbita_pro` |
| Catálogo | Una suscripción mensual auto-renovable |
| Oferta inicial | Siete días gratis para personas elegibles |
| Precio | El localizado que muestre Apple; falta decidir/configurar en App Store Connect |
| RevenueCat | Un producto mensual unido a `orbita_pro` |
| Offering consumido por la app | `offerings.current` |
| Renovación | Mensual y automática hasta cancelación |
| Canal web | Stripe, con el mismo mensual + siete días vigente |

`current` no es un identificador que haya que inventar. Es el Offering que el
SDK devuelve como vigente después de marcar uno como **Default Offering** en el
dashboard de RevenueCat. La app no debe fijar un id como `default`.

### Bloqueo previo al lanzamiento — auditar CERO lifetime en RevenueCat

El backend de V1 **no puede reparar ni retirar un acceso permanente desde la
lectura REST**, y eso es deliberado: la v1 de RevenueCat documenta cada entrada
de `non_subscriptions` con `id`, `is_sandbox`, `purchase_date` y `store`, y **no**
documenta ahí un campo de reembolso. Inferirlo sería apagar acceso pagado desde
un campo que el proveedor no promete. Un reembolso de un permanente sólo puede
llegar por **webhook del mismo producto**.

Consecuencia operativa, antes de habilitar cobros:

1. Confirmar en el dashboard de RevenueCat que **no existe ninguna compra
   permanente** (`non_subscriptions`) asociada a `orbita_pro`.
2. Confirmar que `REVENUECAT_LIFETIME_PRODUCT_IDS` está **vacía** en el
   deployment. Vacía es lo correcto para V1: sin ella ningún evento ni lectura
   puede escribir un acceso permanente nuevo.
3. Si aparece alguna fila `isLifetime: true` en `subscriptions`, resolverla a
   mano y dejar constancia. El código la preserva —no la borra por ausencia—
   pero tampoco puede repararla solo.

Sin los tres puntos, el comercio **no está listo para lanzar**. Esto es un
bloqueo explícito, no una recomendación.

Semanal, anual y lifetime **no forman parte del catálogo vigente**. Agregar
cualquiera exige, antes de crearlo en Apple o RevenueCat:

1. decisión explícita de producto y precio;
2. actualización coordinada de Términos, Privacidad y copy del paywall;
3. revisión del catálogo Stripe para evitar dos promesas comerciales distintas;
4. nuevas pruebas de compra, restauración, cambio de plan y reembolso.

## Estado de la configuración externa (2026-08-19, hecha con Lucas)

**Apple y RevenueCat: configurados.** Detalle completo, valores exactos y los
defectos encontrados en `CURRENT_TASK.md`, sección
`## Comercio nativo — configuración externa hecha (2026-08-19)`.

Resumen: producto `orbita_plus_monthly` (1 mes, USD 9.99, 7 días gratis),
entitlement `orbita_pro`, Offering `orbita_plus` Default con una sola package
mensual, webhook a Development devolviendo **200** y auditado, y las cuatro
variables cargadas en Convex.

**Un defecto real, corregido:** el webhook moría con 500 porque el evento crudo
de RevenueCat lleva claves `$` que Convex reserva. Habría perdido compras reales,
no sólo el evento de prueba.

**Falta:** screenshot de review en ASC (después del build), build nativo con los
módulos de RevenueCat, y toda la verificación en Sandbox.

## Veredicto vigente (2026-08-19)

**PASS técnico local del código auditado y de la suite. NO LISTO PARA
LANZAMIENTO NI PUBLICACIÓN.**

Medido en este árbol: rama `feature/native-v492-implementation`, HEAD
`52836ad5f4ad6d6c72f389069ff73f008d45be28`, `pnpm typecheck` PASS, suite
**2145/2145** en 196 suites con 0 fallos, `pnpm check:test-count` PASS,
`git diff --check` y `git diff --cached --check` PASS, gate de bindings PASS sin
codegen. Cada defecto se reprodujo con una regresión roja antes de arreglarlo.

Eso certifica el código, no el comercio. **No se probó ningún cobro real.** De
este delta no hubo deploy, build nativo nuevo, compra en Sandbox, cambio en los
dashboards de Apple o RevenueCat, TestFlight, App Review ni producción. Falta, y
ninguna de estas cosas se puede resolver desde el repo:

1. configuración externa — producto y oferta introductoria en App Store Connect,
   entitlement `orbita_pro` y Default Offering en RevenueCat, webhook,
   `REVENUECAT_SECRET_API_KEY` y la allowlist de review;
2. un build nativo NUEVO: los módulos de RevenueCat no existen en el binario
   actual y ninguna actualización OTA los agrega;
3. verificación en dispositivo real → Sandbox → TestFlight → App Review.

### Bloqueo abierto que no es de comercio pero frena el release

Si `deleteUser` de Clerk termina y el proceso cae **antes** de persistir
`identity_deleted`, ese checkpoint sólo existía en memoria: al reiniciar el flujo
queda fail-closed y la única salida es soporte, sin recuperación self-service.
Cerrarlo bien exige una integración **server-side durable con la Clerk Backend
API** y `CLERK_SECRET_KEY` configurado en Convex sin exponerlo — un
job/tombstone/retry que pruebe de forma idempotente que la identidad ya no
existe. **No está implementado ni configurado**, y requiere autorización externa.
Mientras tanto: nunca promover el checkpoint antes de que Clerk confirme, y nunca
inferir el borrado a partir de un `signed-out`. Procedimiento operativo en
`docs/recuperacion-eliminacion-cuenta.md`.

**Android queda fuera del alcance de esta corrida y sin verificar** — no está
deshabilitado por código. No hay catálogo en Google Play, no se creó la app de
RevenueCat para Android y ninguna ruta de este paquete se probó ahí. El
identificador tampoco coincide: `app.json` declara `ios.bundleIdentifier`
`com.lucasssram.orbita` y `android.package` `com.horoscopo.orbita`. Habilitarlo
es una decisión y un trabajo aparte.

### Orden de ejecución de lo externo

Cada paso necesita autorización explícita de Lucas y ninguno se adelanta al
anterior:

1. **Finalizador server-side de Clerk** y su secreto en Convex (bloqueo de
   arriba).
2. **Catálogo Apple + RevenueCat** con el bundle real `com.lucasssram.orbita`,
   entitlement, Offering, mensual y prueba según la decisión legal; contratos,
   banking y tax si faltan → §§1 y 2 de este documento.
3. **Deploy a Development primero**, backend antes que cliente, verificando
   funciones y bindings.
4. **Dev build / TestFlight** con los módulos de RevenueCat y el runtime
   fingerprint; compra, restauración y Customer Center en **Sandbox** con una
   cuenta legítima; webhook, reconciliación y allowlist de review → §§3 y 4.
5. **Recaptura del estado 06** (cuenta Plus real), **VoiceOver en iPhone
   físico** y checklist legal/App Review.

**Recién después** de los cinco se pide autorización para producción y
publicación.

### Decisión pendiente — retención y borrado en procesadores externos

Borrar la cuenta de Órbita **no cancela** la suscripción ni borra los datos de
transacción que conservan Apple, Stripe y RevenueCat por obligación contable y
antifraude. Hoy la app avisa a la persona y le pide cancelar primero. Falta una
decisión explícita de producto/legal antes del lanzamiento:

- [ ] ¿se pide el borrado del subscriber en RevenueCat al eliminar la cuenta?
- [ ] ¿qué dice Privacidad sobre lo que conservan los procesadores y por cuánto?
- [ ] ¿quién atiende un pedido de borrado que llegue por soporte?

Este paquete **no implementa** borrado remoto en RevenueCat ni Stripe: hacerlo a
ciegas puede romper la conciliación de cobros y la evidencia de reembolsos.

## Qué implementa el código hoy (2026-08-19, auditado)

La app **no escribe nunca** su propio acceso: `subscriptions.getCurrent` es la
única autoridad de todo gate. Lo que sigue describe el comportamiento ya
implementado y con regresión, para que la configuración externa no tenga que
adivinarlo.

| Punto del contrato | Cómo se cumple en el código |
| --- | --- |
| Un solo mensual | `currentNativeOffering()` descarta el Offering si no tiene exactamente una package `MONTHLY` con `subscriptionPeriod === "P1M"`. Cualquier otra configuración deja el paywall en “no hay un plan disponible”, no publica una oferta que los Términos no describen. |
| Precio y moneda | Salen de `product.priceString` / `subscriptionPeriod`. No hay ningún importe escrito en el cliente. |
| Prueba de 7 días | Sale de `product.introPrice` **y** de `checkTrialOrIntroductoryPriceEligibility`. Se anuncia sólo si la oferta introductoria es gratis (`price === 0`) **y** la tienda contesta `ELIGIBLE`. `INELIGIBLE`, `UNKNOWN`, un error de red o la ausencia de oferta muestran el mensual pelado, sin promesa. |
| Duración mostrada | Se traduce del período que informa la tienda (`P1W` → “7 días”). Las semanas se convierten a días porque son siete exactos; meses y años conservan su unidad. |
| Identidad | Comprar y restaurar exigen `useLiveApp.isLive` (Clerk autenticado **y** fila Convex `ready`) y que el app user id del SDK coincida con el `clerkUserId`. Un `$RCAnonymousID:` nunca se acepta. |
| Cambio de cuenta | Cubre el cambio **directo `A → B`**, sin logout intermedio: Convex re-autentica al cambiar la cuenta de Clerk (`ConvexProviderWithAuth` con un hook propio que depende de `userId`/`sessionId`, no sólo de la organización), el estado de tienda se publica atado a su dueño (`OwnedValue`) y sólo si la identidad no cambió durante el `await`. Una acción de A que resuelve tarde no dispara `requestStoreReconcile` bajo la sesión de B ni le consume el cupo. |
| Entitlement correlacionado | Toda pantalla que decide acceso pasa la lectura por `safeEntitlement(doc, clerkUserId)`: `subscriptions.getCurrent` devuelve `clerkUserId` y, si no corresponde al dueño de la sesión, el valor es `undefined` = **estado neutro de validación**, no Free. La query conserva su último valor mientras la nueva resuelve, así que sin esto el plan de A decidía la pantalla de B. |
| Doble cobro | Después de un resultado ambiguo (error o `inactive`), el botón primario deja de ofrecer comprar y pasa a **Restaurar**. Si la tienda ya confirmó, nunca vuelve a ofrecer comprar. Un Restaurar vacío —que sí fuerza el refresh del recibo— levanta el bloqueo; un recheck vacío por caché no. |
| Doble toque | Candado síncrono (`createExclusiveGate`) en paywall y Perfil: dos toques del mismo render no lanzan dos acciones. |
| Compra vs activación | La pantalla distingue “la tienda cobró” de “Convex confirmó”. El estado local de compra recibida es sólo presentación: no abre contenido. |
| Acceso sin fecha | Sólo `isLifetime` puede conceder sin `currentPeriodEnd`. Un `checkout.session.completed` de Stripe cuyo `customer.subscription.updated` nunca llegue ya no concede acceso indefinido |
| Lifetime legado | Un evento del mensual no puede apagar un lifetime que vive en la misma fila de RevenueCat |
| Identidad ambigua | Si `app_user_id`/`original`/aliases resuelven a **más de una** cuenta local, el evento va a **CUARENTENA**: se audita como `ignored_ambiguous_identity` y **no se reconcilia ninguna de las dos**. Reconciliarlas sería peor que no hacer nada — los aliases devuelven el MISMO `CustomerInfo`, así que una sola compra dejaría Pro a las dos cuentas. Se resuelve a mano. (Cero matches es distinto: no se registra como procesado y el retry de RevenueCat lo vuelve a traer.) |
| Doble cobro entre canales | `subscriptions.getCurrent` declara `canManageInRevenueCat` y `activeProviders`; con dos cobros vivos el Perfil muestra **las dos** salidas de cancelación |
| Compra en vuelo | Un marcador por cuenta se persiste ANTES de abrir la hoja de la tienda y sobrevive al desmontaje: reabrir el paywall no vuelve a ofrecer comprar |
| Web | El bundle web no contiene el SDK: verificado sobre el export real (`react-native-purchases`, `purchasePackage`, `RCAnonymousID` y `checkTrialOrIntroductoryPriceEligibility` con 0 ocurrencias) y sobre el grafo de imports en `test/nativeCommerceSurface.test.ts`. |
| Borrado con cobro vivo | `deleteAccountV2` exige `expectedClerkUserId` y lo compara contra `identity.subject`: borrar la cuenta de A desde la sesión de B es imposible. El endpoint legado `deleteAccount` falla cerrado con `ACCOUNT_DELETE_UPDATE_REQUIRED`. |
| Resurrección después de borrar | Antes de borrar se escribe una **valla de supresión** (`accountDeletionFences`, clave = SHA-256 de un dominio versionado + `identity.subject`). Mientras el JWT viejo siga vivo —Clerk lo mantiene válido— ningún `getOrCreateUser` ni `requireExistingUser` puede recrear la fila. La clave es **seudónima**, no es anonimización ni es irreversible, **no expira** y **no se borra con la cuenta** (no está en `USER_SCOPED_DELETION_STEPS`). |

### Reconciliación server-side (red de seguridad del webhook)

El webhook es best-effort: RevenueCat reintenta una cantidad acotada y después
abandona. Si el `INITIAL_PURCHASE` se pierde, Apple ya cobró y Convex queda en
Free sin ningún evento posterior que lo repare. Por eso el backend lee
`GET /v1/subscribers/{app_user_id}` —la recomendación oficial de RevenueCat—
después de compra, restauración, comprobación demorada y de cada webhook.

- La superficie pública es la **mutation** `payments/revenuecatRest:requestStoreReconcile`,
  con `args: {}`: deriva la cuenta de la sesión de Clerk y devuelve
  `{ status: "queued" | "cooldown" | "unauthenticated" }`. El teléfono no manda
  identidad, `CustomerInfo`, entitlement ni recibos. Reemplazó a la action
  `reconcileMyStoreEntitlement`, que era at-most-once y podía morir antes de
  crear el trabajo; la mutation consume cupo y deja el trabajo escrito en **una**
  transacción. El acceso reparado llega por la query reactiva
  `subscriptions.getCurrent`, no por el retorno.
- Un 5xx, un 429, un 401/403, **un 404** o un cuerpo con otra forma **no conceden
  ni revocan**: el endpoint `/v1/subscribers/{id}` es GET-or-create y nunca
  contesta 404 para una cuenta legítima, así que un 404 significa ruta, proyecto
  o credencial mal configurados —leerlo como "no compró nada" revocaría el acceso
  de alguien que pagó—. Sólo un **200/201 con la forma completa y sin el
  entitlement** retira el acceso.
- La proyección aplica el MISMO corte de entorno que el webhook, para no ser una
  puerta de atrás; sin poder demostrar de qué tienda vino el recibo, no concede.
- La auditoría (`paymentEvents`, `eventType: "RECONCILE"`) guarda un resumen sin
  payload crudo, sin aliases y sin atributos del suscriptor.

### Credenciales de EAS Submit

`eas.json` ya no versiona la ruta al `.p8` ni el key id / issuer id: una ruta
absoluta a `~/Downloads` sólo funciona en una computadora y publica dónde vive
la clave privada. Se configuran una sola vez en el **almacenamiento seguro de
EAS** (`eas credentials`), fuera del repositorio. En el archivo queda sólo
`ascAppId`, que es público.

### Variables de entorno (placeholders en `.env.example`, sin valores)

| Variable | Dónde vive | Para qué |
| --- | --- | --- |
| `REVENUECAT_WEBHOOK_AUTH` | Convex (secreto) | Header `Authorization` acordado con el webhook |
| `REVENUECAT_SECRET_API_KEY` | Convex (secreto) | Sólo la reconciliación REST v1. Sin ella, `not_configured` y nada cambia |
| `REVENUECAT_SANDBOX_REVIEW_USER_IDS` | Convex (secreto) | Clerk ids de QA/App Review habilitados a comprar en Sandbox contra producción |
| `ORBITA_ENVIRONMENT` | Convex | Entorno declarado. Sin señal reconocida el comercio **no consume ningún recibo** |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | Build (pública) | Configuración del SDK en iOS |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | Build (pública) | Ídem Android |
| `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` | Build (pública) | Test Store, sólo en `__DEV__` |

### TestFlight y App Review contra producción

TestFlight y App Review usan el **binario productivo** pero sus compras salen de
**Sandbox**. Sin una puerta explícita, producción descarta esos eventos y quien
revisa la app no ve Plus.

- [ ] Antes de enviar a review, agregar el Clerk id de la cuenta de review a
  `REVENUECAT_SANDBOX_REVIEW_USER_IDS`. Nunca una cuenta real de una persona.
- [ ] Verificar que la fila creada quede con `environment: "sandbox"` y que no
  pise ninguna fila productiva de la misma cuenta.
- [ ] **Vaciar la lista al terminar la revisión.**
- [ ] Confirmar que una cuenta común sigue sin poder activar Plus con un recibo
  Sandbox contra producción.

### Revisiones separadas, fuera de este cierre

- **Copy comercial de Stripe web.** `convex/lib/stripeApi.ts` y
  `src/components/orbita/ManageSubscription.web.tsx` describen Plus con Tarot,
  Diario y “siete capítulos”, que no es lo que V4.9.2 abre (casas, aspectos y
  cinco preguntas diarias en El Umbral). Web tiene superficies distintas y su
  catálogo es de Stripe: se revisa aparte y no frena el comercio nativo.
- **Bundle de Android.** `app.json` declara `ios.bundleIdentifier`
  `com.lucasssram.orbita` y `android.package` `com.horoscopo.orbita`. Si alguna
  vez se crea la app Android en RevenueCat, hay que usar ese identificador.

## Bloqueos previos a crear el producto

- [ ] Lucas decidió el precio base y los territorios. No copiar precios de
  Figma, documentos históricos ni Stripe sin confirmación.
- [ ] El Account Holder aceptó el Paid Applications Agreement vigente.
- [ ] Banking y Tax están completos en App Store Connect.
- [ ] La app de App Store Connect corresponde a `com.lucasssram.orbita`.
- [ ] Las URLs públicas responden y muestran el texto vigente:
  - `https://orbitaastrologia.xyz/privacy`
  - `https://orbitaastrologia.xyz/terminos`
  - `https://orbitaastrologia.xyz/support`
- [ ] Hay una cuenta de Órbita descartable para QA y una Sandbox Apple Account.
- [ ] Está definido quién conserva las credenciales Apple/RevenueCat fuera del
  repositorio.

Si cualquiera de los tres primeros puntos falta, no crear ni probar cobros
reales. El Test Store de RevenueCat puede servir para UI, pero no certifica
StoreKit ni Apple.

## 1. App Store Connect

### Cuenta y app

- [ ] Abrir la ficha de Órbita y volver a verificar el bundle exacto
  `com.lucasssram.orbita`.
- [ ] Confirmar que los acuerdos pagos, impuestos y banco figuren activos.
- [ ] Confirmar que la versión se mantenga con liberación manual.
- [ ] Verificar que el identificador del build, el perfil de firma y la app de
  RevenueCat correspondan al mismo bundle.

### Grupo y producto

- [ ] En **Monetization → Subscriptions**, crear o reutilizar **un solo grupo**
  para Órbita Plus.
- [ ] Dentro del grupo, crear **un solo producto auto-renovable mensual**.
- [ ] Elegir y registrar el Product ID definitivo. No reutilizar ids semanales,
  anuales o lifetime históricos.
- [ ] Completar nombre visible y descripción en español sin prometer funciones
  que Free o Plus no tengan realmente.
- [ ] Configurar duración de un mes.
- [ ] Configurar precio y territorios según la decisión de Lucas. La interfaz
  debe leer el precio localizado de StoreKit/RevenueCat, nunca escribirlo a mano.
- [ ] Revisar categoría impositiva y disponibilidad.
- [ ] Cargar la captura de revisión del producto que Apple solicite.

### Prueba introductoria

- [ ] En el producto mensual, crear una **Introductory Offer → Free → 1 Week**.
- [ ] Aplicarla sólo a los territorios aprobados y revisar fechas de vigencia.
- [ ] Confirmar que el paywall diga “7 días gratis” únicamente cuando StoreKit
  informe elegibilidad; una persona sólo puede usar una oferta introductoria por
  grupo de suscripción. El código ya falla cerrado: sólo anuncia la prueba con
  `INTRO_ELIGIBILITY_STATUS_ELIGIBLE`.
- [ ] Confirmar que, si no hay elegibilidad, se muestre directamente el precio
  mensual localizado sin prometer prueba. Con `INELIGIBLE`, `UNKNOWN` o un fallo
  de la consulta, el plan viaja sin prueba y el CTA dice “DESBLOQUEAR ÓRBITA
  PLUS” en vez de “EMPEZAR 7 DÍAS GRATIS”.
- [ ] Verificar en Sandbox las dos caras con cuentas distintas: una elegible y
  una que ya usó la oferta introductoria del grupo.

### Metadata y privacidad de App Store

- [ ] La descripción y screenshots muestran Free + Órbita Plus reales, no una
  “primera versión sólo gratuita”.
- [ ] App Privacy se respondió contra el binario final. Como mínimo, revisar
  **Purchases** e **Identifiers** por Apple IAP/RevenueCat; no declarar Tracking
  salvo que la configuración real lo haga necesario.
- [ ] Términos, Política de privacidad y Soporte están visibles desde el
  paywall/perfil y usan las URLs públicas.
- [ ] Las notas de review explican cómo abrir el paywall, comprar, restaurar y
  gestionar/cancelar una suscripción.
- [ ] El producto mensual y el build que lo usa se agregan a la misma entrega de
  App Review cuando corresponda.

## 2. RevenueCat

### App y credenciales Apple

- [ ] En el proyecto correcto, crear/verificar la app Apple con bundle
  `com.lucasssram.orbita`.
- [ ] Cargar la **In-App Purchase Key** de Apple y su Issuer ID por el flujo
  seguro del dashboard. No copiar el `.p8` al repositorio.
- [ ] Validar las credenciales hasta que RevenueCat las muestre válidas.
- [ ] Cargar una App Store Connect API Key sólo si se usa para importar productos;
  conservarla fuera del repositorio.
- [ ] Configurar App Store Server Notifications según la guía vigente de
  RevenueCat para acelerar renovaciones y cambios de estado.
- [ ] Antes de App Review, verificar que el binario use la **public Apple SDK
  key** de esa app y no la Test Store key. Ninguna secret key va al cliente.

### Producto, entitlement y Offering

- [ ] Importar el único producto mensual desde App Store Connect.
- [ ] Crear o verificar el entitlement exacto `orbita_pro`.
- [ ] Adjuntar el producto mensual a `orbita_pro`.
- [ ] Crear una package mensual con ese producto dentro de un Offering.
- [ ] Marcar ese Offering como **Default Offering**.
- [ ] Confirmar que `getOfferings().current` devuelve una única package mensual
  válida para iOS.
- [ ] Confirmar que CustomerInfo activa exactamente `orbita_pro` después de la
  compra y lo desactiva al expirar.
- [ ] No crear packages weekly, annual ni lifetime.

### Identidad, webhook y gestión

- [ ] RevenueCat identifica a la persona con el mismo identificador estable de
  cuenta que usa el backend, respetando mayúsculas/minúsculas.
- [ ] Compra y restore sólo se ofrecen después de que la sesión esté vinculada;
  no dejar una compra anónima separada de la cuenta de Órbita.
- [ ] Configurar el webhook HTTPS de RevenueCat hacia el endpoint previsto y un
  Authorization header aleatorio guardado como secreto del backend.
- [ ] Habilitar Sandbox en una integración de Development y Production sólo en
  la integración de producción correspondiente; no mezclar evidencia.
- [ ] Enviar un evento de prueba y verificar recepción sin exponer payloads ni
  secretos en capturas/logs.
- [ ] Confirmar que compra, renovación, cancelación, expiración, billing issue,
  refund y transfer dejan un estado coherente en RevenueCat y en Convex.
- [ ] Customer Center/gestión abre la suscripción Apple correcta; Restore
  Purchases funciona desde el perfil/paywall.

## 3. Sandbox en development build

Una integración nativa no se certifica con Expo Go ni con una actualización
OTA. Hace falta un binario nuevo que incluya los módulos de RevenueCat.

- [ ] Generar el development build autorizado con In-App Purchase capability y
  bundle `com.lucasssram.orbita`.
- [ ] Instalarlo en un iPhone de prueba; usar simulador sólo como complemento.
- [ ] Crear una Sandbox Apple Account nueva y seleccionar el storefront que se
  quiere verificar.
- [ ] Activar “View Sandbox Data” en RevenueCat.
- [ ] Entrar a Órbita con la cuenta QA y anotar su App User ID sin publicar datos
  personales.
- [ ] Abrir el paywall y comprobar:
  - una sola opción mensual;
  - precio/moneda provenientes de Apple;
  - siete días gratis sólo si la cuenta es elegible;
  - renovación automática, cancelar, Privacidad, Términos y Restaurar visibles;
  - una salida clara para seguir usando Free.
- [ ] Comprar y verificar, en este orden:
  1. Apple confirma la transacción Sandbox;
  2. RevenueCat muestra la transacción y `orbita_pro` activo;
  3. Convex recibe el webhook y refleja Plus;
  4. la app desbloquea Plus sin reinicio forzado;
  5. cerrar sesión y volver a entrar conserva el acceso correcto.
- [ ] Cancelar renovación y comprobar que Plus sigue activo hasta la expiración.
- [ ] Verificar expiración y vuelta honesta a Free.
- [ ] Probar Restore en reinstalación y en otro dispositivo con la misma cuenta.
- [ ] Probar “sin compra para restaurar” sin mostrar un éxito falso.
- [ ] Probar compra cancelada por la persona, sin error rojo ni entitlement.
- [ ] Probar al menos una falla de conectividad y reintento sin doble cobro.
- [ ] Usar controles Sandbox para billing retry/refund sólo de forma controlada;
  no provocar fallas reales de proveedor.

Apple puede demorar la propagación de metadata y Sandbox puede ser lento. Una
espera no se interpreta como compra fallida hasta verificar Apple, RevenueCat y
el estado local.

## 4. TestFlight

- [ ] Subir únicamente un build autorizado, con número nuevo y los módulos
  nativos incluidos.
- [ ] Confirmar que usa la Apple public SDK key y endpoints de la etapa prevista;
  nunca una key de Test Store ni backend Development en un candidato productivo.
- [ ] Instalar desde TestFlight en un iPhone limpio. Las compras siguen siendo
  Sandbox y no generan cargos reales.
- [ ] Repetir compra, cancelación, restore, reinstalación y cambio de cuenta.
- [ ] Verificar Free y Plus con dos cuentas separadas.
- [ ] Esperar el webhook y confirmar que no haya doble entitlement ni doble fila.
- [ ] Revisar Customer Center, enlace a gestión de Apple y textos legales.
- [ ] Recordar que en TestFlight las renovaciones se aceleran a una por día,
  hasta seis renovaciones; no esperar el ritmo mensual real.
- [ ] Guardar capturas y logs sin emails, App User IDs completos, tokens ni keys.

## 5. Matriz mínima de aceptación

| Caso | Resultado esperado |
| --- | --- |
| Cuenta Free | Usa toda la base gratuita y ve una invitación clara a Plus |
| Elegible | Ve mensual + 7 días + precio localizado |
| No elegible | Ve mensual sin promesa de prueba |
| Compra aprobada | `orbita_pro` activo en RC, Convex y app |
| Compra cancelada | Permanece Free; no se registra como error de cobro |
| Restore válido | Recupera `orbita_pro` para la cuenta correcta |
| Restore vacío | Mensaje honesto; permanece Free |
| Auto-renew cancelado | Plus hasta fin del período; luego Free |
| Billing issue/grace | Estado y acceso respetan la fecha informada por la tienda |
| Refund/expiración | Se retira Plus cuando corresponde, sin borrar la cuenta |
| Usuario Stripe activo | Conserva Plus en nativo sin comprar otra vez |
| Logout/cambio de cuenta | Nunca hereda la compra local de otra cuenta |

## 6. Evidencia y autorización de salida

Antes de pedir autorización para App Review, adjuntar:

- [ ] captura de grupo/producto mensual e introductory offer sin revelar claves;
- [ ] captura de `orbita_pro` unido al producto y del Default Offering;
- [ ] compra Sandbox y TestFlight visibles en RevenueCat;
- [ ] webhook recibido y entitlement resuelto en Convex;
- [ ] Free, compra, Plus, cancelación y restore en dispositivo real;
- [ ] resultado de typecheck, suite completa, export/build y controles de diff;
- [ ] versión final de Privacidad, Términos, metadata y App Privacy;
- [ ] veredicto único: listo o no listo, con cualquier pendiente explícito.

La autorización de App Review no implica publicación automática. Mantener
release manual hasta una aprobación separada de Lucas.

## Fuentes oficiales

- Apple — [Offer auto-renewable subscriptions](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions/)
- Apple — [Set up introductory offers](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions)
- Apple — [Overview of testing in Sandbox](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/overview-of-testing-in-sandbox/)
- Apple — [Testing subscriptions and IAP in TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/)
- RevenueCat — [Expo installation](https://www.revenuecat.com/docs/getting-started/installation/expo)
- RevenueCat — [Connect apps and stores](https://www.revenuecat.com/docs/projects/connect-a-store)
- RevenueCat — [Entitlements](https://www.revenuecat.com/docs/getting-started/entitlements)
- RevenueCat — [Offerings](https://www.revenuecat.com/docs/offerings/overview)
- RevenueCat — [Apple Sandbox and TestFlight](https://www.revenuecat.com/docs/test-and-launch/sandbox/apple-app-store)
- RevenueCat — [Webhooks](https://www.revenuecat.com/docs/integrations/webhooks)
