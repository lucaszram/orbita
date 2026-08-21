# Contrato — CHANGELOG

## 2026-08-21 (QA22 · bloque 4B) — `relationships.getComparison`: la evidencia por contacto, sin tocar `drivers`

**Aditivo, no breaking. Codegen pendiente de Codex; deploy NO autorizado.**

`relationships.getComparison` **conserva `drivers: string[]`** en cada dimensión,
con exactamente la misma semántica y el mismo orden, y **agrega por dimensión un
`driverDetails` opcional**:

```ts
// convex/lib/layerContract.ts
relationshipDriverDetailValidator = v.object({
  id: v.string(),
  text: v.string(),
  quality: v.union(v.literal("support"), v.literal("tension"), v.literal("neutral")),
  weight: v.number(),
  precision: precisionValidator, // exact | estimated | range | not_applicable
})

relationshipDimensionValidator = v.object({
  key, label, value, summary,
  drivers: v.array(v.string()),                                  // sin cambios
  driverDetails: v.optional(v.array(relationshipDriverDetailValidator)), // nuevo
  precision: precisionValidator,
})
```

- **Por qué existe.** `drivers` publica prosa. Un cliente que quiera explicar
  **por qué** una dimensión dice lo que dice tenía que volver a parsear la
  oración —o inventar una calidad—. `driverDetails` es la forma ESTRUCTURADA de
  lo que el motor ya había calculado, no un cálculo nuevo: mismo id, mismo texto,
  misma calidad, mismo peso y misma precisión que produce `buildDimensions`. Sin
  LLM, sin heurística y sin orden nuevo (`relationshipDriverDetails` en
  `convex/lib/relationshipLayers.ts`).
- **Opcional en el validator POR LOS SOBRES PERSISTIDOS.**
  `relationshipComparisonCachesV492.data` se valida contra
  `relationshipComparisonDataValidator`, así que Convex verifica cada fila ya
  guardada cuando se pushea el schema. Declararlo requerido invalidaría todos los
  cachés escritos antes de este cambio. **Emitido en las respuestas nuevas**: una
  comparación recién calculada trae siempre `driverDetails`, con una entrada por
  contacto único de esa dimensión.
- **`quality` es la familia del aspecto, no un juicio.** `support` no es "bueno"
  ni `tension` "malo": trígono y sextil de un lado, cuadratura y oposición del
  otro, y la conjunción, que sola no inclina nada.
- **`weight` no es un porcentaje.** Es cuánto pesa ese contacto DENTRO de esa
  dimensión; se suma con los demás de la misma dimensión y no está normalizado a
  1. El mismo contacto puede pesar distinto en dos dimensiones, porque el par de
  puntos importa distinto en cada una.
- **Ids deterministas y semánticos.** `aspect:a:venus:b:sun:trine`,
  `house:b:sun:a:7`. Salen de QUÉ toca a QUÉ: nunca del índice del arreglo, nunca
  del texto. Dos corridas del mismo cálculo devuelven los mismos ids.
- **Se deduplica SÓLO por id.** Dos contactos con texto parecido —o igual— y
  distinto id son dos contactos: `Su Descendente □ tu Luna` y `Su Ascendente □ tu
  Luna` describen cosas distintas aunque la oración quede casi igual, y borrar uno
  por parecido perdería evidencia real. Lo único que se descarta es la repetición
  EXACTA de un id dentro de la misma dimensión, que sería contar dos veces el
  mismo contacto.
- **El mismo id puede vivir en varias dimensiones, y eso se conserva.** Un
  contacto que alimenta `Deseo` y `Fricción` es UNO solo, aparece en las dos y su
  id es lo que permite decirlo en vez de publicarlo como dos hallazgos distintos.
  Un consumidor que quiera contar contactos reales tiene que contar ids únicos,
  no filas.
- **Sin migración destructiva.** No hay tabla nueva, no hay índice nuevo, no se
  reescribe ninguna fila y no se borra nada. Los sobres ya persistidos siguen
  siendo válidos tal como están y se renuevan por su propia invalidación de
  entradas/método.
- **Cliente build 22 compatible.** No lee el campo nuevo y no cambia de
  comportamiento: `drivers` le sigue llegando igual. El cliente nuevo degrada en
  la otra dirección —sobre sin `driverDetails`, `quality`/`weight`/`precision` en
  `null`— y dice que no puede afirmar el balance en vez de inventarlo.
- **Pendiente de Codex.** Correr el **codegen** (`convex/_generated/**` es
  read-only para el front) y revisar las tres funciones tocadas en `convex/**`:
  `lib/layerContract.ts`, `lib/relationshipLayers.ts` y `relationships.ts`. **El
  deploy no está autorizado en esta tanda**, así que hasta que corra no hay sobre
  nuevo con `driverDetails` en producción.

## 2026-08-21 (QA22 · bloque 2) — nota de contrato: `state` de `ORB-TRN-001` y `ORB-TRN-002` no es el mismo dato

**Sin cambio de firma. Nada que desplegar.** Esta entrada documenta una
divergencia REAL del contrato encontrada al cerrar QA22-009 y la decisión que se
tomó del lado del cliente. No se tocó `convex/**`.

**Lo medido.** Los dos análisis publican un campo llamado `state`, y cada uno lo
calcula con una regla distinta sobre el mismo arco y el mismo instante:

| Análisis | Función | Regla de `exact` |
|---|---|---|
| `ORB-TRN-002` (ranking) | `stageFromTrend` (`convex/lib/transitLayers.ts:427`) | orbe ≤ `EXACT_TRANSIT_ORB_DEGREES` (**0,1°**); si no, tendencia |
| `ORB-TRN-001` (arco) | `arcStage` (`convex/lib/transitLayers.ts:909`) | algún contacto a ≤ `ARC_EXACT_WINDOW_MS` (**±6 h**) del instante de referencia |

Con Luna–Marte a 0°07′ (0,1167°) y el pico más tarde ese mismo día, la primera
regla devuelve `approaching` y la segunda `exact`. Las dos son correctas para su
propia definición: la lista mostraba `ACERCÁNDOSE · EXACTO HOY` y el detalle
`EXACTO`, "en su punto más exacto". El `summary` de cada sobre arrastra la misma
divergencia, porque su última frase se compone a partir de ese `state`
(`adaptTransitArcToData` y `transitStageSummary`, en `convex/lib/layerAssembly.ts`).

**La decisión: la derivación canónica vive en el cliente.**
`src/domain/transitState.ts` deriva la etapa de los INSTANTES que los dos sobres
ya publican —el contacto exacto más cercano a ahora, comparado con el instante
actual y con el día civil— y la usan la fila y el detalle. Por qué acá y no en el
backend:

- lo que las pantallas leen son sobres **persistidos**; unificar `stageFromTrend`
  con `arcStage` arreglaría los cálculos nuevos y dejaría contradiciéndose a los
  que ya están guardados hasta que expiren;
- recalcularlos exige un deploy de Convex, que esta tanda no tiene autorizado;
- el campo crudo **no se toca**: se sigue publicando igual y el cliente lo usa
  como respaldo cuando el sobre no trae ningún instante con el que derivar.

**Dependencia de copy declarada.** `summaryWithCanonicalState` reconoce por texto
EXACTO las seis frases de etapa que el backend adjunta al final de cada `summary`
(tres por análisis) y sólo las reemplaza por la de la misma familia. Si Codex
cambia esa redacción, el reemplazo deja de aplicar y el resumen se dibuja tal
cual —no se recorta a ciegas—, pero el chip y el resumen podrían volver a decir
cosas distintas. Las seis frases están copiadas y comentadas en
`src/domain/transitState.ts`.

**Pendiente para Codex, si se quiere cerrar en el origen.** Unificar las dos
funciones en una sola derivación —o renombrar los campos para que digan qué mide
cada uno— y republicar. La proyección del cliente es compatible con ese cambio:
si el backend pasa a publicar la misma etapa que el canon deriva, `corrected`
queda en `false` y no cambia nada de lo que se ve.

## 2026-08-20 (QA22 · bloque 1) — `void.suggestedToday`: el set del día, sin LLM

**Aditivo, no breaking.** Query pública nueva: `void.suggestedToday`.

```ts
args: {}
returns: v.union(v.object({ categories: v.array(voidPromptCategoryValidator) }), v.null())
// voidPromptCategoryValidator = { key: string, label: string, glyph: string, prompts: string[] }
```

- **Defecto (QA22-001, registro físico del build 22).** El Umbral se quedaba en
  “Cargando tu cielo…” a pantalla completa hasta que `void.suggestedQuestions`
  contestaba. Esa function es una **action**: en la carga fría genera el set con
  el AI Gateway, así que la espera es de segundos y bloqueaba también la
  superficie para preguntar y el contador de cupo, que no dependen de ella.
- **Ahora.** `suggestedToday` devuelve la fila de `voidPromptSets` del día del
  usuario —la misma que la action lee antes de decidir si genera— como **query
  reactiva**: no llama al AI Gateway, no escribe, no consume cupo. `null`
  significa exactamente “este día todavía no tiene set”, y es la señal con la
  que el front dispara la action una sola vez.
- **Compatibilidad.** `void.ask`, `void.today` y `void.suggestedQuestions` no
  cambian de firma ni de comportamiento. Un cliente anterior sigue funcionando
  sin conocer la query nueva.
- **Sin tabla, sin índice, sin migración.** Lee `voidPromptSets` por el índice
  `by_user_date` que ya existe. `payload` sigue siendo `v.any()` en la tabla; el
  validator de salida es cerrado y la lectura es defensiva (un set deformado o a
  medias se reporta como `null`, no se publica a medias).
- **Día civil unificado.** `getVoidState`, `today` y `suggestedToday` resuelven
  el `localDate` con el mismo helper (`resolveVoidLocalDate`, extracción textual
  de lo que ya hacían las dos primeras). Si divergieran, la pantalla mostraría
  el contador de hoy junto a las preguntas de ayer.
- **Codegen pendiente de Codex.** No se corrió: el módulo `void` ya está
  enumerado en `convex/_generated/api.d.ts`, así que `ApiFromModules` deriva la
  function nueva y `convexGeneratedApiGate` —que compara a nivel de módulo—
  sigue verde. El front la consume por `anyApi`.

## 2026-08-20 — ranking temporal y detalle canónico de tránsitos

**Aditivo, con invalidación por versión de método.** `ORB-TRN-002` pasa a
`transit-ranking-v2`: primero ordena los contactos exactos del día, luego los
próximos dentro de 72 horas, después los ocurridos en las últimas 72 horas y al
final el resto de los tránsitos activos. Dentro de cada grupo conserva los
desempates determinísticos de relevancia, orbe e identidad estable.

- Cada fila publica `previousExactAt`, `nextExactAt`, `rankingWindow` y
  `rankingReason`, para que Hoy y Tránsitos expliquen el mismo orden.
- `ORB-TRN-001` publica esos mismos campos, más `natalHouse`, calculados desde el
  arco pedido. El detalle ya no toma prestada la casa de otra capa.
- Cada cálculo nuevo de ranking v2 emite los campos. En el validator de
  persistencia siguen siendo opcionales porque Convex valida también las filas
  históricas al publicar el schema: invalidar el hash impide leerlas como dato
  vigente, pero no las borra de la tabla. El arco aplica la misma compatibilidad
  para sus sobres anteriores.
- La fecha civil y la ventana de 72 horas usan explícitamente la fecha y zona
  horaria solicitadas. No cambia la matemática de aspectos ni el orbe activo de
  3°.

## 2026-08-19 (P1) — fence de supresión: la cuenta borrada no resucita

**Tabla nueva `accountDeletionFences`**, aditiva y fuera de la barrida.

- **Defecto:** `deleteAccountV2` borraba la cuenta, pero el JWT de Clerk seguía
  siendo válido —la identidad se borra después, desde el cliente—. En esa
  ventana cualquier llamada autenticada volvía a entrar por `getOrCreateUser` y
  **recreaba** `users` + `account_created`. Lo disparaba otro dispositivo, otra
  pestaña, o el retry tardío de `ensureUser` que ya estaba en vuelo.
- **Ahora:** `deleteAccountV2` escribe el fence **antes de barrer y en la misma
  mutation** (una transacción: o commitean los dos o ninguno).
  `assertIdentityNotDeletionFenced` corre antes de cualquier `insert`/`patch` en
  `getOrCreateUser` y `requireExistingUser`, y tira `ACCOUNT_DELETION_IN_PROGRESS`.
  Las lecturas no pasan por el fence: con la fila borrada ya degradan a vacío.
- **La fila no guarda identificadores en crudo:** sólo `identityKey`,
  `keyVersion` y `createdAt`. `identityKey` es una **clave seudónima de
  supresión** —`SHA-256(dominio versionado | subject)` con WebCrypto, sin
  secreto—, no una anonimización: con un subject candidato se puede comprobar la
  pertenencia. Los Clerk IDs tienen alta entropía, así que no es enumerable.
  `keyVersion` queda para migrar a HMAC con secreto más adelante.
- **No expira.** Expirar reabriría la ventana del token viejo. Un alta nueva en
  Clerk obtiene otro `subject` y no queda bloqueada.

## 2026-08-19 — `subscriptions.getCurrent` publica su dueño

**Aditivo, no breaking.** `getCurrent` devuelve además
`clerkUserId: string | null`: el Clerk id para el que se calculó ESE resultado.

- **Defecto:** la query de Convex conserva su último valor mientras la nueva
  suscripción resuelve. En un cambio de cuenta A → B eso deja el entitlement de
  A publicado bajo la sesión de B durante uno o varios renders, y con él el
  efecto que levanta el marcador de compra: se desbloqueaba una recompra de B
  con una confirmación que era de A.
- **Ahora:** el cliente correlaciona (`entitlementBelongsTo`) y sólo actúa si el
  dueño coincide. Falla cerrado: sin el campo (backend anterior) no autoriza.

## 2026-08-19 (P0 A→B) — `users.deleteAccountV2` exige el dueño esperado

**Endpoint nuevo.** Se agrega
`users.deleteAccountV2({ expectedClerkUserId: string })`; `users.deleteAccount`
(sin argumentos) queda **deprecado, desplegado y fallando cerrado**: no borra
nada y tira `ACCOUNT_DELETE_UPDATE_REQUIRED`. Un build viejo pierde el borrado
in-app —recuperable actualizando o por soporte— en vez de arriesgar borrar la
cuenta equivocada.

- **Defecto:** el handler borraba el grafo de "quien esté autenticado al
  ejecutar". Entre las dos confirmaciones destructivas del cliente hay awaits
  largos; si Clerk entregaba otra sesión en el medio (logout+login, refresh de
  token, otra pestaña), un flujo empezado por **A** borraba los datos de **B**.
- **Ahora:** el argumento es una **exigencia**, nunca un selector de objetivo. El
  handler hace `trim`, rechaza vacío (`ACCOUNT_DELETE_OWNER_REQUIRED`) y compara
  contra `identity.subject` **antes** de `deleteAccountData`; si no coincide tira
  `ACCOUNT_DELETE_OWNER_MISMATCH` y no lee ni borra nada. El objetivo sigue
  siendo exclusivamente la identidad autenticada.
- **Cliente:** la llama el **boundary global** de eliminación pendiente —no el
  Perfil— con el dueño del marcador, y sólo con la sesión de ese dueño viva. El
  Perfil ya no llama a Convex: persiste `deletion_requested` y se aparta. Ningún
  cliente de este repo llama a la ruta legada (hay un test que lo exige).
- **Rollout del legado:** `deleteAccount` sigue desplegado —fallando cerrado—
  mientras haya builds instalados sin V2 (revisión de App Store + la cola de
  quienes no actualizaron). Cuando el build mínimo soportado incluya V2, se borra
  la función.

## 2026-08-18 (tercera corrección integral) — identidad exacta, catálogo mensual, durabilidad con lease

> **Esta entrada manda sobre todas las anteriores del comercio nativo.** Las de
> abajo quedan como historia: donde digan otra cosa, están superadas.

### Decisiones de producto que fijan todo lo demás

- **El catálogo de lanzamiento (V1) es MENSUAL.** No se vende lifetime.
  `REVENUECAT_LIFETIME_PRODUCT_IDS` queda **vacío**. Las filas lifetime legadas
  se preservan, pero no se inventa soporte REST que la API no documenta.
- **El cliente es custom-ID-only:** RevenueCat se configura con el Clerk userId
  ya conocido y nunca usa `logOut` ni el modo anónimo. Por lo tanto un
  `original_app_user_id` anónimo **no es autoridad para ninguna cuenta**.
- **Fail closed por deployment:** development acepta sólo Sandbox; production
  acepta Production y Sandbox sólo para un reviewer allowlisted; un deployment
  sin entorno declarado (`unknown`) no acepta **ninguna** fila.
- **La fila es agregada y no puede representar dos compras distintas.** Ante
  ambigüedad multi-producto o multi-entorno no se destruye ni se concede: se
  preserva lo más fuerte y se reconcilia.

### `entitlements` — el corte de entorno tenía una sola puerta

- **Defecto:** `EntitlementContext` sólo traía `sandboxAllowed`. `production`
  no se autorizaba nunca, así que `resolveEntitlement(rows, now)` —el default
  directo— concedía Órbita Plus desde una fila productiva en un deployment de
  development o sin entorno declarado.
- **Ahora:** `productionAllowed` es obligatorio para las filas de RevenueCat y
  su default es `false`. `entitlementContextFor` lo calcula con la misma función
  que usa el webhook. Stripe no cambia.
- **`SubscriptionRow` suma `productId`** (P1 12): estaba en la tabla y en las
  comparaciones de precedencia, pero invisible para el compilador.

### `lib/revenueCatRest` — sólo el id exacto es autoridad

- Se **eliminó la excepción del id anónimo**. `checkRevenueCatSubscriberIdentity`
  devuelve `anonymous_subscriber_identity` (no reintentable) y el proyector
  exige `subscriberId === clerkUserId` sin excepciones. El mismo id anónimo
  puede estar aliased a dos cuentas de Clerk.

### `lib/revenueCatRest` — se eliminó la inferencia de reembolso inventada

- **Defecto:** se construía "evidencia de reembolso" leyendo `refunded_at` /
  `refunded_at_ms` de `non_subscriptions`. **La v1 no documenta ese campo ahí**
  —vive en `subscriptions`—, así que la evidencia salía de campos fabricados.
- **Ahora** `refundedPurchases` **no existe**. La REST **nunca** retira un
  acceso permanente: `revocationPatchFor` devuelve `null` para toda fila
  `isLifetime: true`. Una ausencia en una lectura no es un reembolso.
- El reembolso de un permanente sólo puede llegar por **webhook del mismo
  producto**. Para V1 hay que **auditar cero lifetime de RevenueCat antes de
  lanzar** — ver `docs/native-commerce-release-checklist.md`.

### `lib/revenueCatRest` — permanente sólo con producto declarado

- Conceder un permanente exige las tres cosas: `productId` **explícitamente
  allowlisted**, `expires_date`/`_ms` presentes y exactamente `null`, y
  **exactamente una** transacción estricta (`id`, `is_sandbox`, `purchase_date`,
  `store`) en un **único** entorno. Dos entornos, mezcla, contradicción o
  producto no declarado ⇒ `unavailable`, cero grant y cero revoke.
- **Motivos nuevos:** `lifetime_product_not_allowlisted`,
  `active_without_environment`, `anonymous_subscriber_identity`.

### `lib/revenueCatRest` — fechas coherentes o nada

- **Defecto:** se prefería `_ms` y se caía al ISO. `expires_date: null` +
  `expires_date_ms: "corrupt"` se leía como "sin vencimiento" y concedía
  permanente.
- **Ahora** `coherentFieldDate` exige que **todas** las variantes declaradas
  sean legibles y describan el mismo instante (tolerancia de 1 s por la
  precisión del ISO). Contradicción o malformación ⇒ `invalid_expiration`.

### `lib/revenueCatRest` — un `orbita_pro` VIGENTE sin recibo no resuelve

- **Defecto:** sin `subscriptions[productId].is_sandbox` la lectura devolvía
  `resolved` sin `environment`. El proyector no concedía, pero el trabajo se
  liquidaba: la reparación quedaba cerrada sin haber reparado nada.
- **Ahora:** `active_without_environment` (reintentable) y cero mutaciones. El
  caso vencido conserva `expired_without_environment`.

### `lib/revenueCatEvents` — nunca autoridad lifetime por substring

- `planFromRevenueCatProductId` **ya no devuelve `"lifetime"`**. Mientras lo
  hizo, un `INITIAL_PURCHASE` de `orbita_lifetime_trial` con vencimiento finito
  producía `plan: "lifetime"` y `guardLifetimePrecedence` lo leía como autoridad
  sobre un lifetime real y lo destruía.
- **Nuevo campo de la decisión:** `lifetimeAuthority`, que sólo marcan los
  eventos de un producto **declarado**. `guardLifetimePrecedence` acepta autoridad
  únicamente con esa marca **y** el mismo `productId`, o con un reembolso que
  demuestre ese mismo producto.

### Webhook — `TRANSFER` nunca degrada el destino

- **Nuevo:** `transferOverwritesTarget(source, target)`. Una transferencia se
  aplica sólo si no degrada: una fuente Free/vencida no apaga un destino activo,
  un mensual más corto no acorta uno más largo, un mensual no pisa un
  permanente, y el lifetime A no reemplaza al lifetime B ni le roba su
  `productId`. La fuente se apaga igual y las dos cuentas se reconcilian.
- **Outcome renombrado:** `applied_transfer_lifetime_preserved` →
  `applied_transfer_target_preserved`.

### Superficie pública — de action a MUTATION

- **`reconcileMyStoreEntitlement` (action) fue reemplazada por
  `requestStoreReconcile` (mutation pública).** Una action es at-most-once y
  podía morir antes de crear el trabajo: el toque de la persona se perdía sin
  dejar rastro. La mutation consume el cupo y deja el trabajo escrito en **una**
  transacción, y devuelve `{ status: "queued" | "cooldown" | "unauthenticated" }`.
- El cliente (`appRefs`, `PlusPaywallScreen`, `ManageSubscription`) pasa a
  `useMutation`. El acceso reparado llega por la query reactiva
  `subscriptions.getCurrent`, no por el retorno.
- **`reconcileStoreEntitlement` exige `jobId` y `lease`**: no queda ningún
  camino at-most-once sin estado persistido.

### Durabilidad — señales, generaciones y lease

- `reconcileJobs` suma `generation`, `requestedSeq`, `startedSeq` y `leaseToken`.
- **Lost wakeup:** cada pedido incrementa `requestedSeq` aunque el trabajo ya
  esté `pending`. Antes, un webhook que llegaba durante una corrida no dejaba
  rastro y esa corrida —con un snapshot anterior— liquidaba el trabajo.
- **Stale settle:** cada corrida lleva un `leaseToken` determinista
  (`generación:señal:intento`). Un resultado tardío con lease viejo no liquida
  nada y **no cancela el watchdog** de la corrida nueva.
- **Señal nueva sobre un trabajo agotado** reinicia la generación y los intentos.
- **Auth (P1 10):** el lease se revalida **antes de la red** y **antes de
  proyectar**, y verifica que `jobId` y `clerkUserId` correspondan y que la
  cuenta exista. Tras un borrado, una action ya agendada sale con **cero fetch**.

### Eliminación de cuenta y PII

- `deleteAccountData` borra `reconcileJobs` de la cuenta (cancelando su watchdog
  cuando el contexto lo permite) y los contadores de `publicRateLimits` del
  scope de reconciliación.
- **`buildRateLimitBucketKey` hashea el sujeto** (`rateLimitSubjectHash`): la
  tabla ya no guarda el Clerk id en claro. `publicRateLimits` suma
  `subjectHash` y el índice `by_scope_subjectHash`, que es lo que permite
  encontrar esas filas sin guardar el id.
- Hay **exactamente una fila `reconcileJobs` por cuenta**, reutilizada entre
  generaciones: el trabajo no se acumula.

### Auditoría

- Un `unavailable` —incluido `subscriber_identity_mismatch`— deja fila de
  auditoría sanitizada (sin payload crudo, sin aliases, sin el id del
  suscriptor), no muta acceso y no reintenta.

---

## 2026-08-18 (auditoría del backend corregido, P1 1–8 nuevos) — identidad del snapshot, entorno en cada decisión y durabilidad real

> **Superada.** Ver la entrada de arriba: `refundedPurchases` se eliminó entero,
> el id anónimo dejó de ser autoridad, el permanente pasó a exigir allowlist, y
> la superficie pública dejó de ser una action.

> Esta entrada **corrige** varias afirmaciones de la entrada inmediatamente
> siguiente (“tercera auditoría, backend P1 1–8”). Donde las dos digan cosas
> distintas, manda ésta.

### `lib/revenueCatRest` — un snapshot vale para UNA cuenta

- **Defecto (cross-account):** `GET /v1/subscribers/{B}` no devuelve “lo de B”: devuelve el `CustomerInfo` del **alias chain**. Con A y B aliased, la respuesta de B trae `subscriber.original_app_user_id: A` y describe la compra de A. Ese campo se ignoraba, así que el mismo pago se proyectaba a las dos cuentas.
- **Ahora** `interpretRevenueCatSubscriber(status, body, { expectedAppUserId })` valida la identidad **antes** de interpretar ninguna regla de acceso:
  - `original_app_user_id` ausente/vacío/no-string → `invalid_subscriber_identity` (`unavailable`);
  - id **custom** distinto del consultado → `subscriber_identity_mismatch` (cuarentena: ni concede ni revoca, y **no se reintenta**);
  - id **anónimo** (`$RCAnonymousID:…`) → se acepta. Única excepción y segura por construcción: un id anónimo del SDK no puede ser otra cuenta de Clerk, así que describe la compra que empezó anónima y terminó identificada en la cuenta consultada;
  - sin `expectedAppUserId` → `unverified_subscriber_identity`. Interpretar sin decir contra qué cuenta es un error, no un permiso.
- El resultado lleva `subscriberId`, y `projectRevenueCatSubscriber` lo vuelve a comprobar: un snapshot con id custom ajeno no muta nada aunque llegue por otra vía.
- **Breaking (interno):** el tercer parámetro dejó de ser `now` (que no se usaba) y pasó a ser el objeto de opciones.

### `lib/revenueCatRest` — la evidencia de reembolso lleva su entorno

- **Defecto:** `refundedLifetimeProductIds: string[]` nombraba sólo el producto. Una cuenta de review con el MISMO producto permanente en `sandbox` y en `production` perdía las dos filas cuando sólo se reembolsaba la copia sandbox.
- **Ahora:** `refundedPurchases: Array<{ productId, environment }>`, agrupada por entorno. Un par entra sólo si **todas** las transacciones de ese entorno se entienden y **todas** están reembolsadas; una sola transacción ilegible del producto lo deja afuera entero. El proyector exige coincidencia de producto **y** entorno.
- Ya no se filtra por el nombre del producto para juntar evidencia: la coincidencia con la fila es por `productId` exacto, así que un id legado también puede demostrar su propio reembolso. Esta evidencia sólo puede RETIRAR acceso.

### `lib/revenueCatRest` — una expiración sólo apaga el entorno que demuestra

- **Defecto:** un `orbita_pro` vencido cuyo `subscriptions[productId]` no existía —o no traía `is_sandbox`— producía un Free de alcance **global** y apagaba todas las filas del usuario.
- **Ahora** ese caso es `expired_without_environment` (`unavailable`, cero mutaciones). Con `orbita_pro` presente, la revocación **nunca** es global: como mucho toca el entorno demostrado.
- El alcance `global` queda reservado para lo único que lo justifica: la **ausencia total** del entitlement canónico en un cuerpo completo.

### `lib/revenueCatRest` — permanente por evidencia, no por substring

- **Defecto:** el camino permanente se elegía con `planFromProductId(productId) === "lifetime"`, así que `orbita_lifetime_trial` con `expires_date` finito y **vencido** salía permanente.
- **Ahora** el nombre no participa. Hacen falta las tres cosas: entitlement canónico verificado, su declaración **inequívoca** de no vencimiento (`expires_date` o `expires_date_ms` presentes y exactamente `null`), y una transacción de **ese mismo** `product_identifier` con forma estricta y sin reembolso. Un `expires_date` finito entra siempre por el camino de suscripción.

### `lib/revenueCatEvents` — catálogo permanente por configuración

- **Defecto:** `NON_RENEWING_PURCHASE` (y el `REFUND_REVERSED` permanente) concedían acceso de por vida porque el product id contenía `lifetime`. Eso es conceder desde una convención de nombres que este código no controla.
- **Nuevo secreto de backend:** `REVENUECAT_LIFETIME_PRODUCT_IDS` (lista separada por comas). **Default vacío = cerrado**: sin declaración, ningún evento escribe un acceso permanente y el trabajo cae en la lectura autoritativa, que sí puede demostrarlo. El catálogo comercial V1 es exclusivamente mensual.
- **No rompe lo legado:** una fila `isLifetime: true` ya escrita sigue concediendo acceso y sigue protegida por `guardLifetimePrecedence`. Lo que se cierra es la puerta para escribir una nueva sin prueba.

### `lib/revenueCatEvents` — un reembolso tiene que demostrar su producto

- **Defecto:** un `CANCELLATION` con `cancel_reason: "CUSTOMER_SUPPORT"` **sin** `product_id`, o con el de otro producto, escribía `entitlement: "free"` sobre la fila agregada igual.
- **Ahora:** sin `product_id` → `ignore` / `refund_without_product`; con un producto que no es el de la fila (o con una fila sin `productId`) → `ignore` / `refund_product_mismatch`. En los dos casos no se revoca nada y se dispara la reconciliación.
- **Nuevos outcomes auditados:** `ignored_refund_without_product`, `ignored_refund_product_mismatch`.

### Webhook — `TRANSFER` con el mismo corte de entorno que el resto

- **Defecto:** el camino ordinario aplicaba `isRevenueCatEnvironmentAllowed` por identidad; el `TRANSFER` no. En un deployment `production` con la allowlist vacía —y también en `unknown`— un `TRANSFER` `SANDBOX` movía Órbita Plus de A a B y apagaba la fila de A.
- **Ahora** el corte se exige sobre **las dos puntas**, después de resolverlas: apagar acceso pago desde un recibo que este deployment no consume es tan grave como concederlo. Un mismatch no muta ninguna fila (`ignored_environment_mismatch`).

### Webhook — `TRANSFER` no degrada el destino

- **Defecto:** la fila de origen se copiaba **entera** sobre el destino. Transferir un mensual encima de un lifetime ya demostrado le escribía `isLifetime: false` y le borraba el `productId`: el acceso permanente desaparecía sin reembolso.
- **Ahora**, si el destino es permanente y lo transferido no lo es, la fila del destino no se toca. La fuente se apaga igual y en la misma transacción, y las dos cuentas se reconcilian contra la tienda.
- **Nuevo outcome auditado:** `applied_transfer_lifetime_preserved`.

### Durabilidad — watchdog sobre estado persistido, no preagendado desde la action

- **Defecto del arreglo anterior:** hacer que la action preagendara su propia sucesora no cierra la ventana. Si la action **nunca llega a su primera línea**, o si ese `runAfter` **rechaza**, la action muere sin sucesora y la reparación se pierde igual. Una action at-most-once no puede sostener su propia durabilidad.
- **Nueva tabla `reconcileJobs`** (una fila por trabajo: `clerkUserId`, `trigger`, `attempt`, `status`, `outcome`, `watchdogId`, `nextCheckAt`). Índices `by_clerkUserId`, `by_status`, `by_status_user`.
- **Nuevas funciones internas** en `payments/revenuecatRest`: `enqueueStoreReconcile` (mutation), `runReconcileJob` (mutation — el watchdog), `settleReconcileJob` (mutation).
- El modelo es el que documenta Convex para error handling de scheduled functions: las **mutations** se reintentan ante fallos transitorios y su `scheduler.runAfter` es parte de su transacción. `runReconcileJob` lanza la action y agenda su propia próxima vigilancia **atómicamente**; si algo rechaza, no queda un intento consumido sin sucesor. El watchdog no pregunta si la action corrió: mira el estado y, si sigue `pending`, la relanza.
- La action sólo puede **liquidar** (`settled`) o **pedir reintento** del trabajo. Sin `jobId` —la llamada directa del cliente— un fallo transitorio **encola** trabajo durable antes de contestar.
- Techo (`RECONCILE_MAX_ATTEMPTS = 4`) aplicado por el watchdog; liquidar dos veces es idempotente; timeout de lectura y cupo por cuenta sin cambios.
- **`RECONCILE_STORE_ENTITLEMENT_REF` se renombró a `ENQUEUE_STORE_RECONCILE_REF`** y ahora apunta a la mutation de encolado: lo que el webhook tiene que dejar escrito en su transacción es el trabajo durable, no una action suelta.

### Reintento — reclasificación

- Se **reintentan** además: `expired_without_environment`, `invalid_subscriber_identity`.
- **Nunca** se reintentan: `subscriber_identity_mismatch`, `unverified_subscriber_identity`, `not_configured`, `http_400/401/403/404` y cualquier motivo desconocido.

---

## 2026-08-18 (tercera auditoría, backend P1 1–8) — alcance de revocación, evidencia de reembolso y retry durable

> **Parcialmente superada.** Ver la entrada de arriba: `refundedLifetimeProductIds`
> pasó a ser `refundedPurchases` (con entorno), la expiración dejó de poder
> revocar en global, el lifetime dejó de decidirse por substring, y el
> “preagendado desde la action” fue reemplazado por el watchdog durable.

> Esta entrada **reemplaza** las afirmaciones equivalentes de la entrada
> anterior (“comercio nativo, cierre P1”) sobre revocación REST, identidad
> ambigua y reintento. Donde las dos digan cosas distintas, manda ésta.

### `payments/revenuecatRest` — la revocación declara su alcance

- **Defecto:** `interpretRevenueCatSubscriber` devolvía Free **sin entorno** cuando faltaba `orbita_pro`, y `projectRevenueCatSubscriber` buscaba la fila con `row.environment === undefined`. Una fila `production` con acceso vigente nunca se apagaba: la reconciliación no revocaba nada real.
- **Ahora:** el resultado `resolved` viaja con `revocation`:
  - `{ kind: "none" }` — no se demostró qué apagar; no se toca nada.
  - `{ kind: "environment", environment }` — sólo la fila de ese entorno.
  - `{ kind: "global" }` — un cuerpo **completo** (200/201, shape profunda, `request_date_ms` válido) sin el entitlement canónico demuestra ausencia en todos los entornos: se apagan todas las filas de RevenueCat del usuario. **Nunca toca Stripe**, que no participa de esta lectura.
- Un cuerpo ambiguo o incompleto sigue siendo `unavailable`: no concede ni revoca. Un **404 sigue siendo `unavailable`** y nunca revoca (el endpoint es GET-or-create; un 404 es un problema de ruta/proyecto/credencial, no una cuenta sin compras).
- **Compatibilidad:** `revocation` es opcional en el validador. Un resultado que no lo declare **no revoca nada** — la ausencia falla hacia el lado seguro.

### `payments/revenuecatRest` — un lifetime sólo se retira con reembolso demostrado

- **Nuevo campo:** `refundedLifetimeProductIds: string[]`, calculado sobre el cuerpo completo. Un producto entra sólo si **todas** sus transacciones se entienden (forma estricta) y **todas** están reembolsadas con un marcador válido.
- El proyector retira un `isLifetime: true` únicamente si el `productId` de la fila está en esa lista. Una ausencia —por completa que sea la lectura— jamás lo borra; un marcador de reembolso malformado tampoco.
- Simétrico del lado de la concesión: una lectura que sólo ve el mensual **no** escribe `isLifetime: false`, `plan` ni `productId` encima de una fila permanente. Antes, la precedencia lifetime vivía en el intérprete (escaneando nombres de producto) y por eso concedía de más; ahora vive en la fila, que es donde está la evidencia.

### `lib/revenueCatRest` — conceder exige entitlement canónico, no un nombre

- **Defecto:** se recorría `non_subscriptions` buscando cualquier product id que contuviera `lifetime` **antes** de mirar `entitlements.orbita_pro`, y se aceptaban transacciones parciales o con `refunded_at_ms` malformado. `entitlements: {}` + `unrelated_lifetime_pack` concedía acceso permanente.
- **Ahora**, para conceder un permanente hacen falta las tres cosas: `entitlements.orbita_pro` presente y legible; su `product_identifier` nombrando un producto permanente; y una transacción de **ese** producto con forma estricta (fecha de compra demostrable, `is_sandbox` booleano) y sin reembolso.
- El catálogo V1 vigente es **mensual**. La compatibilidad legacy con lifetime no abre ninguna puerta de concesión nueva.
- **Motivos nuevos de `unavailable`:** `invalid_entitlement_product`.

### `lib/revenueCatEvents` — un reembolso sólo retira el producto que demuestra

- **Defecto:** `overridesLifetime` marcaba autoridad sobre el acceso permanente sin decir de qué producto era el reembolso. Un `CANCELLATION` con `cancel_reason: "CUSTOMER_SUPPORT"` de `orbita_monthly` borraba un lifetime que nadie devolvió.
- **Nuevos campos de la decisión:** `refundedProductId` (lo escribe el derivador) y `preservedLifetime` (lo escribe `guardLifetimePrecedence`).
- Mientras la fila siga siendo agregada, un evento de otro producto tampoco pisa `plan` ni `productId` de un lifetime: sin ellos, el reembolso real de mañana no tendría contra qué compararse.
- **Nuevo outcome auditado:** `applied_lifetime_preserved`.

### Webhook de RevenueCat — identidad resuelta antes de agendar

- **Corrección de la entrada anterior.** Donde decía «se audita y **se reconcilian ambos**», ahora: una identidad ambigua queda en **cuarentena** y **no se reconcilia a ninguno**. Reconciliar a los dos les daba Pro a los dos, porque los aliases devuelven el mismo `CustomerInfo`.
- La rama sin `environment` ya no agenda los candidatos crudos del evento: resuelve identidades contra las filas locales primero. Cero matches sigue siendo recuperable (no se registra `paymentEvents`); uno reconcilia sólo a ese usuario; más de uno queda en cuarentena. Un `TRANSFER` resuelve cada punta por separado, porque nombra dos cuentas legítimamente distintas.
- Sin scheduler, esa rama **lanza** en vez de auditar: la reparación agendada es lo único durable que deja, y marcarla como procesada sin haberla dejado agendada la daba por resuelta para siempre.
- **Nuevo outcome auditado:** `ignored_without_resolvable_user` también en la rama sin entorno. **Retirado:** `ignored_transfer_environment_mismatch` (ya no puede ocurrir).

### Webhook de RevenueCat — `TRANSFER` elige por entorno

- **Defecto:** origen y destino se leían con `first()` sobre `by_user_provider`. Desde que production y sandbox conviven, el orden del índice decidía qué fila se movía —o descartaba el evento entero—.
- **Ahora** las filas se colectan y se elige la del entorno del evento, igual que el camino ordinario. Sin fila de ese entorno, el evento es **recuperable** (lanza, no se audita).

### `reconcileStoreEntitlement` — reintento durable y acotado

- **Defecto:** el reintento se agendaba **después** de proyectar. Un 200 resuelto seguido de un `runMutation` que tira mataba la action antes del `runAfter` y la reparación se perdía para siempre.
- **Ahora** el próximo intento queda **preagendado antes** del tramo frágil y se liquida (`scheduler.cancel`) sólo cuando: el motivo es permanente, o la lectura resolvió **y la proyección terminó bien**. La única garantía usada es la que Convex da: `runAfter` persiste el job al agendarlo y una action que muere después no lo cancela.
- **Reclasificación de motivos:** los cuerpos ilegibles (`invalid_shape`, `invalid_request_date`, `invalid_entitlement`, `invalid_entitlement_product`, `invalid_expiration`, `lifetime_without_purchase_evidence`) ahora **sí** se reintentan: la ilegibilidad puede ser una ventana transitoria y ninguno muta acceso mientras tanto. `401`/`403`/`404`/`400` y la falta de credencial **no** se reintentan. Un motivo desconocido tampoco.
- Techo (`RECONCILE_MAX_ATTEMPTS = 4`), timeout de lectura y cupo por cuenta se conservan sin cambios.
- Un contexto cuyo scheduler no sabe cancelar cae al reintento posterior de siempre, en vez de dejar un job imposible de liquidar.

### `projectRevenueCatSubscriber` — validador cerrado y patch mudo

- **Defecto:** `patch.entitlement !== "free"` era verdadero también cuando el campo **no vino**, así que un patch sin entitlement entraba por el camino de concesión.
- **Ahora** sólo `entitlement === "orbita_pro"` concede y sólo `entitlement === "free"` revoca. Un patch mudo no hace ninguna de las dos cosas y queda auditado.
- El validador enumera además `revocation` y `refundedLifetimeProductIds`. Toda lectura `resolved` que llega a un usuario existente deja su fila de auditoría, incluida la que no cambió nada.

### `subscriptions` — identidad de fila documentada (sin migración)

- La identidad real de una fila es **(userId, provider, environment)**. La schema lo dice explícitamente; el índice sigue siendo `by_user_provider` porque son una o dos filas por proveedor y los escritores eligen por entorno en memoria. **No se agregó ningún índice y no hace falta migrar datos.**

---

## 2026-08-18 (comercio nativo, cierre P1) — reconciliación REST y gestión de doble proveedor

> **Parcialmente superada.** Ver la entrada de la tercera auditoría, arriba:
> corrige el alcance de la revocación REST y el tratamiento de la identidad
> ambigua (que aquí decía «se reconcilian ambos»).

### `subscriptions.getCurrent()` — dos campos aditivos

- **Nuevos:** `canManageInRevenueCat: boolean` y `activeProviders: ("revenuecat" | "stripe" | "stub")[]`.
- **Por qué:** `provider` nombra al ganador por rango (lifetime primero, después mayor `currentPeriodEnd`). Una persona que compró en la web y después en la app tiene DOS cobros vivos; con un solo `provider` la pantalla ofrecía cancelar uno y el otro seguía corriendo sin salida visible.
- **Compatibilidad:** aditivo. `entitlement`, `isPro`, `provider`, `plan`, `isLifetime`, `currentPeriodEnd`, `willRenew` y `canManageInStripePortal` conservan su semántica; un cliente anterior los sigue leyendo igual.

### `isRowActive` — sólo lifetime puede omitir la fecha de fin

- **Defecto:** una fila `active`/`trialing` sin `currentPeriodEnd` concedía acceso indefinido. `checkout.session.completed` de Stripe escribe exactamente esa forma y la fecha llega recién con `customer.subscription.updated`: si ese webhook no llegaba, el acceso no vencía nunca.
- **Ahora:** sin fecha demostrable no hay acceso, salvo `isLifetime: true`.

### `payments/revenuecatRest` — módulo nuevo

- `reconcileMyStoreEntitlement` (action pública, **sin argumentos**): deriva el Clerk id de `ctx.auth` y pide la lectura autoritativa. No acepta `userId`, `CustomerInfo`, entitlement ni recibos del cliente.
- `reconcileStoreEntitlement` (internal action) y `projectRevenueCatSubscriber` (internal mutation).
- Lee `GET /v1/subscribers/{app_user_id}` con `REVENUECAT_SECRET_API_KEY` (secreto de backend, sin prefijo `EXPO_PUBLIC_`). Un 5xx/429/401/shape inválida **no concede ni revoca**; un 200 completo sin el entitlement sí retira el acceso. ~~o un 404~~ **SUPERADO / ERROR DE REDACCIÓN:** el código nunca revocó por 404 y no debe hacerlo — el endpoint es GET-or-create y un 404 es `unavailable`.
- Se dispara después de compra/restauración, desde la comprobación demorada del paywall y detrás de cada webhook aplicado o diferido.
- **Sin cambio de schema.** La auditoría usa `paymentEvents` con `eventType: "RECONCILE"` y un resumen sin payload crudo ni PII.

### Webhook de RevenueCat — corte de entorno e identidad

- El entorno del deployment ahora se resuelve explícito (`production` / `development` / `unknown`); `unknown` no consume ningún recibo.
- Producción acepta Sandbox **sólo** para los Clerk id de `REVENUECAT_SANDBOX_REVIEW_USER_IDS` (TestFlight y App Review compran en Sandbox con el binario productivo). Las filas conservan su `environment` y no se pisan entre sí.
- Un evento sin `environment` (`TRANSFER`, `TEMPORARY_ENTITLEMENT_GRANT`) ya no se descarta: se difiere a la reconciliación. `undefined` nunca se lee como `production`.
- ~~Si `app_user_id`/`original_app_user_id`/aliases resuelven a **dos** usuarios locales, no se elige el primero ni se muta acceso: se audita y se reconcilian ambos.~~ **SUPERADO:** reconciliar ambos les daba Pro a los dos. Hoy la identidad ambigua queda en cuarentena y no se reconcilia a ninguno.
- Un evento del mensual no puede borrar un lifetime legado que vive en la misma fila.


## 2026-08-18 (pasada 14) — Invalidación editorial y degradación honesta de 08/09 (sin cambio de firma pública)

### `layers.getNatalBase()` / `layers.refreshForDate()` — mapa elemental vigente

- **Defecto reproducido en Development:** una cuenta con un snapshot previo de `ORB-NAT-001` seguía viendo “El tierra…” después de publicar el copy corregido. El `methodVersion` técnico y el hash no habían cambiado, por lo que tanto la lectura como el refresh elegían el snapshot anterior.
- **Segundo defecto reproducido al recapturar:** el artículo ya era correcto, pero la rama singular decía “con uno planeta”; los empates parciales podían decir “uno planetas cada uno”. Además, una carta parcial de una sola posición decía “uno de los uno planetas disponibles”. Helpers acotados corrigen `un planeta` / `N planetas` y `el único planeta disponible` sin tocar el cálculo.
- **Arreglo mínimo:** sólo el hash de `ORB-NAT-001` incorpora `ASTROLOGY_EDITORIAL_COPY_VERSION`, que sube a `orbita-v492-copy-clarity-v2` para retirar también el snapshot v1 con la concordancia rota. El tipo lunar (`ORB-LUN-001`) y el patrón vincular natal (`ORB-REL-001`) conservan su identidad de caché.
- **Datos:** no hay migración ni borrado. La fila anterior queda fuera de la identidad vigente y el resultado corregido se calcula por el flujo normal.

### Vínculos — voz editorial vigente

- **Defecto reproducido en Development:** una comparación `ready` anterior seguía mostrando nombres propios en cada contacto porque su caché no vence y la identidad de comparación continuaba en v1.
- **Invalidación quirúrgica:** se separa `RELATIONSHIP_COMPARISON_VERSION = orbita-relationship-comparison-v2`, usada por el resultado de comparación y por `buildRelationshipComparisonInputHash`. `RELATIONSHIP_LAYERS_VERSION` permanece en v1 para `ORB-REL-001`; su mismo `inputHash` ya no puede representar dos versiones internas distintas.
- **Degradación honesta:** si fecha —o fecha, hora y lugar— ya están cargados pero el proveedor no entrega las posiciones, el fallback emite `comparison_ephemeris`. No vuelve a afirmar `other_sun_sign` ni a ofrecer “completar datos” que ya están completos. Si existe una comparación vigente, se conserva como `stale` igual que antes.

### Compatibilidad y rollout

- Sin cambios de schema, argumentos, retornos ni bindings generados. Se conserva `AnalysisResult<T>` y la compatibilidad con clientes anteriores.
- Los hallazgos se reprodujeron con pruebas rojas y cerraron con focales **91/91**, suite **1537/1537** y el tercer deploy correctivo autorizado, exclusivamente a Convex Development (2026-08-18 15:11 ART). Producción continúa fuera de alcance.

## 2026-08-18 (undécimo pase) — El claim de la lectura natal se cierra por VERSIÓN antes de tocar la fila (sin cambio de firma pública)

### `charts.claimNatalReadingGeneration()` — barrera de `cacheVersion` (interna)

- **Hecho:** el CAS de `persistNatalReading` ya comparaba la versión configurada con la del texto, pero llega tarde. El claim se toma ANTES, y medía la fila contra la versión que traía el claimant: un claimant de **v1** cuya action arrancó antes del bump aterrizaba con la configuración ya en **v2**, veía la fila v2 como "de otra versión", la tomaba, incrementaba `claimSeq` y la dejaba `pending` v1 con `payload: null`.
- **Los dos desenlaces reproducidos:** (a) con una generación v2 **en vuelo**, el claimant viejo le sacaba el claim; v2 terminaba en `claim_lost` y v1 en `cache_version_changed`, y la fila quedaba `pending` v1 sin nadie generando; (b) con una lectura v2 **`ready`**, el claim destruía el payload publicado y la escritura final del claimant se rechazaba igual: la lectura válida ya se había perdido.
- **Qué cambia:** `applyNatalReadingClaim` compara `args.cacheVersion` con `getAiGatewayNatalCacheVersion()` **antes de consultar o mutar `natalInterpretations`**. Si no coinciden, no toma claim, no incrementa `claimSeq`, no cambia `status`, `payload`, `cacheVersion` ni `updatedAt`, y no programa ninguna generación.
- **Decisión nueva, interna y cerrada:** `stale_cache_version`, cuarta variante de `NatalReadingClaimRejection` (`"ready" | "pending" | "stale_chart" | "stale_cache_version"`), tipada explícitamente. El caller (`generateAndPersistNatalReading`) la trata como no-op/superseded: la registra en `[natal.prewarm]` con `cacheHit:false` y sale sin tocar nada. **No es un error visible**: la pantalla de Carta sólo trata como fallo el *reject* de la action.
- **Qué NO cambia:** el claimant de la versión vigente conserva el flujo entero (toma, reutiliza `ready`, espera un `pending` con lease vivo, rechaza `stale_chart`). El CAS final sigue exigiendo revisión + `claimSeq` + versión; no se debilitó ninguna de las tres.
- **Compatibilidad:** sin cambios de schema, sin cambios de firma pública, sin filas nuevas. `claimNatalReadingGeneration` es una `internalMutation` sin `returns` validator: ningún cliente ve esta unión.

### Rollout

- **Sin deploy y sin codegen.** No se agregan módulos ni funciones, así que `convex/_generated/` no cambia (gate 7/7 en verde). No se corrió `convex dev`, `convex codegen`, `finishPush` ni ningún deploy.

## 2026-08-18 — Carreras natales cerradas de punta a punta, versión de caché que invalida, y el artifact generado auditado y regenerado (sin cambio de firma pública)

### `charts.recheckNatalStateForRun()` — **NUEVA**, interna

- **Firma:** `internalQuery`. `args: { tokenIdentifier, birthDataId, cacheKey, birthDataHash }` (cerrado). Devuelve `{ status: "birth_data_changed" } | { status: "same", chart, sufficient }`.
- **Por qué:** una corrida que arranca **sin carta** y cuyo proveedor falla no tiene candidato, así que nunca llega a `persistCalculatedNatalChart` —que es donde vive la decisión con el estado vigente— y decidía sola con el snapshot previo. Si otra corrida publicaba una carta durante la espera, la primera igual informaba `provider_failed`, `sufficient:false` y `chart:null`: `recoverNatalChart` daba un fallo falso y `calculateOrCreateNatalChart` podía lanzar con una carta válida en la base.
- **Qué hace:** relee el estado natal vigente para la MISMA identidad original y mide suficiencia con la precisión natal de ahora, la misma regla del read-model. No escribe nada.
- **Es interna:** ningún cliente la ve.

### `charts.calculateOrCreateNatalChart()` y `charts.recoverNatalChart()` — contratos INTACTOS

- **Ninguna firma cambia.** Lo que cambia es el camino sin candidato: ahora relee y aplica la misma medida final (`resolveFinalNatalOutcome`). Otra corrida ganadora con carta suficiente ⇒ `cache_sufficient` (`recovered`/`stored`); una carta parcial ⇒ sigue siendo `provider_failed`/`sufficient:false`, pero **se devuelve la carta real** en vez de `null`; sin ninguna carta, el comportamiento anterior queda igual.
- **Rechazo estable, ya existente:** si los datos natales cambiaron durante la espera, ese camino también rechaza con `NATAL_BIRTH_DATA_CHANGED_DURING_CALCULATION`. Una carta calculada para otros datos nunca se convierte en el éxito de esta corrida.

### `charts.persistCalculatedNatalChart()` — reafirma la IDENTIDAD vigente (interna)

- **Qué cambia:** gane la fila existente o el candidato, la mutación reafirma en `natalCharts` `userId`, `birthDataId`, `birthDataHash`, `cacheKey` y `updatedAt`; y en `profileAstrologyCaches`, `userId`, `birthDataId`, `natalChartId`, `cacheKey`, `cacheVersion`, el payload elegido y `updatedAt`. No se abre ninguna fila nueva.
- **Por qué:** el hash y el `cacheKey` describen los CAMPOS natales, no la fila que los guarda. Una fila natal más nueva y semánticamente idéntica —volver a cargar los mismos datos, reescribir el alta— produce el mismo `cacheKey`: la carta existente gana y se quedaba apuntando al `birthDataId` histórico. `chartMatchesCompletionBirthData` exige la fila vigente exacta, así que el onboarding quedaba en `chart_pending` **para siempre** con el payload correcto delante.
- **Qué NO cambia:** si gana la fila existente, su `payload`, su `providerVersion` y su `calculationVersion` quedan byte por byte. Reafirmar identidad no es relabelar una carta con la procedencia de otra.

### `natalInterpretations` — la `cacheVersion` por fin invalida (sin cambio de schema)

- **Qué cambia:** toda decisión de cache hit, estado público y claim exige ahora **la misma `chartRevision` Y la misma `cacheVersion` esperada** (`ORBITA_LLM_NATAL_CACHE_VERSION`). Una fila de una versión anterior queda no verificable: estado público `pending` —no `error`—, no se publica, no frena una generación nueva y se toma un claim nuevo sobre la misma fila.
- **Por qué:** la versión se persistía en cada fila y no la miraba nadie: lectura pública, estado y claim validaban sólo `chartRevision`. Un bump v1 → v2 con el mismo prompt dejaba la fila v1 `ready` para siempre, así que la única palanca para retirar texto generado no retiraba nada.
- **CAS final:** además de revisión y `claimSeq`, exige que la versión configurada AHORA sea la de este texto. Una generación que arrancó en v1 y vuelve después del bump no publica v1: la fila queda `pending` para que la regenere un claim de v2. Motivo nuevo `cache_version_changed` en el resultado **interno** de `persistNatalReading`.
- **Compatibilidad:** sin cambios de schema, sin cambios de firma pública. Las filas legadas se conservan y se regeneran en vez de publicarse.

### `convex/_generated/api.d.ts` — estaba INCOMPLETO; el gate lo dijo y el codegen lo cerró

- **Hecho (antes):** el árbol tenía `convex/lib/natalGeometry.ts` y `convex/lib/natalRevision.ts`, y el artifact —generado antes de que esos módulos existieran— no los enumeraba. `ApiFromModules` **no** los agrega solo: deriva las funciones de los módulos que `fullApi` ya lista, y `fullApi` lo escribe el codegen archivo por archivo.
- **Gate:** `test/convexGeneratedApiGate.test.ts` compara, sin red, todos los módulos elegibles de `convex/**` —con las reglas reales de `entryPoints()` de Convex 1.42.1, no con una lista de nombres— contra los imports y las entradas del artifact. Falló a propósito mientras el artifact estuvo desincronizado, nombrando esos dos módulos.
- **Durante:** Claude escribió el gate y dejó el árbol rojo a propósito; **no** ejecutó el codegen ni editó `convex/_generated/**` a mano, porque el workflow del repo le reserva `pnpm convex:codegen` al backend.
- **Cerrado (2026-08-18):** **Codex** corrió `pnpm convex:codegen --typecheck disable` (exit 0) fuera de esa sesión y agregó al artifact los **dos** módulos que el gate nombraba, `lib/natalGeometry` y `lib/natalRevision`, con su `import type * as …` y su entrada en `fullApi`. `convex/_generated/**` no se editó a mano. El gate quedó **7/7 en verde** y la suite completa en **1493/1493**, sin ningún fallo deliberado.
- **Alcance del diff del artifact:** contra `52836ad`, `api.d.ts` suma **+26 líneas** y pasa de **58 a 71** entradas en `fullApi`. Esos 13 módulos son ACUMULADOS de este trabajo sin commitear: 11 (`layers`, `content/astrologySources`, `lib/civilTime`, `lib/layerAssembly`, `lib/layerContract`, `lib/layersMath`, `lib/natalChartBaseContract`, `lib/relationshipLayers`, `lib/stableHash`, `lib/transitLayers`, `lib/transitTimeline`) ya estaban en el árbol antes de esta corrida —el gate no los reportaba— y **2** los agregó el codegen del 2026-08-18.
- **Documentación corregida:** las dos entradas anteriores que afirmaban "no hace falta regenerar nada" quedan anotadas más abajo con la distinción real (función nueva vs. módulo nuevo).

### Rollout

- **Sin deploy.** El único comando de Convex que se corrió es `pnpm convex:codegen --typecheck disable`, ejecutado por **Codex**: regenera el artifact de tipos en el árbol y no publica funciones. **No** se corrió `convex dev`, ni `finishPush`, ni ningún deploy; ningún deployment cambió.
- **Compatibilidad hacia atrás:** ninguna firma pública cambia, no hay cambios de schema y los clientes instalados no se enteran.

## 2026-08-17 — Persistencia natal monotónica, revisión de la lectura LLM y bindings generados (sin cambio de firma pública)

### `charts.persistCalculatedNatalChart()` — la decisión final es MONOTÓNICA y vive dentro de la transacción (interna)

- **Qué cambia:** la mutación dejaba de parchear a ciegas con el payload que le llegaba. Ahora relee la fila por `cacheKey` **dentro de la transacción**, mide suficiencia con `storedNatalChartIsSufficient` y la precisión natal VIGENTE, y decide: sin fila ⇒ inserta el candidato (aunque sea parcial); fila **suficiente** ⇒ la conserva intacta, pase lo que pase; fila insuficiente + candidato suficiente ⇒ escribe el candidato; fila insuficiente + candidato insuficiente ⇒ conserva la fila. La regla vive en `resolveNatalPersistDecision`, exportada y probada como tabla.
- **Por qué:** el snapshot con el que la action decidía se toma ANTES de llamar al proveedor, y el proveedor tarda. Dos corridas sobre la misma carta A incompleta terminan en cualquier orden: la atrasada traía A vieja —o una respuesta C que tampoco alcanzaba— y la escribía encima de la B completa que la otra ya había publicado. **La Carta empeoraba por una corrida atrasada.**
- **`profileAstrologyCaches`:** copia y referencia el payload REALMENTE elegido por la mutación —nunca el candidato descartado—, con su `providerVersion` y su `calculationVersion`. Antes se actualizaba con `args.payload` y podía divergir de `natalCharts` o degradarse con ella.
- **Revalidación de identidad:** la mutación comprueba que `birthDataId`, `birthDataHash` y `cacheKey` sigan correspondiendo a los datos natales vigentes. Si cambiaron durante la llamada al proveedor, rechaza con `NATAL_BIRTH_DATA_CHANGED_DURING_CALCULATION` en vez de publicar una carta calculada para los datos anteriores.
- **Retorno (interno):** `{ chart, stored: "existing" | "candidate", outcome, sufficient }` en lugar del documento a secas. Es una mutación **interna**: ningún cliente la ve.

### `charts.calculateOrCreateNatalChart()` y `charts.recoverNatalChart()` — contratos INTACTOS

- **Ninguna firma cambia.** `calculateOrCreateNatalChart` sigue devolviendo la carta vigente o rechazando; `recoverNatalChart` conserva `args: {}` y su `returns` cerrado y discriminado, con los mismos cuatro desenlaces.
- **Qué cambia por dentro:** al volver de la mutación se vuelve a medir la carta FINAL (`resolveFinalNatalOutcome`). Si otra corrida ganó con una carta que alcanza, el desenlace es éxito **almacenado** (`cache_sufficient` ⇒ `recovered`/`stored`) y no un fallo falso; y una corrida que traía una carta completa pero no llegó a escribir reporta `stored`, no `provider`.
- **Rechazo nuevo, compatible:** las dos actions pueden rechazar con `NATAL_BIRTH_DATA_CHANGED_DURING_CALCULATION` cuando los datos natales cambiaron durante el cálculo. Las dos ya podían rechazar; el `returns` de `recoverNatalChart` no crece. La salida es reintentar, ahora con los datos nuevos.

### `natalInterpretations` — revisión del payload natal y CAS (schema **aditivo**)

- **Campos nuevos, los dos `v.optional()`:** `chartRevision` (hash estable del payload natal con el que se generó la lectura, `natalPayloadRevision`) y `claimSeq` (número monótono del claim vigente por fila).
- **Por qué:** una mejora de la carta reescribe el payload **sobre el mismo `natalChartId`**, y la lectura se identificaba sólo por carta + feature + `promptVersion`. Una lectura `ready` escrita sobre la carta parcial seguía pasando como cache hit sobre la carta completa, y una generación que arrancó con el payload parcial podía terminar después de la mejora y persistir texto viejo encima del estado nuevo.
- **Qué cambia:** el claim, la lectura pública y la persistencia se resuelven contra la revisión vigente. Una fila `ready` sólo es cache hit si su revisión coincide. La escritura final es un **CAS** (`resolveNatalReadingWrite`): la carta tiene que seguir en la revisión esperada **y** la generación tiene que seguir siendo dueña del `claimSeq`. Una generación vieja no escribe después de una mejora ni después de que otro claim la reemplazó, ni siquiera para marcar `error`.
- **Filas legadas sin revisión:** no pueden demostrar sobre qué carta se generaron, así que se tratan como **no verificadas** y se regeneran. Nunca se publican como `ready` de una carta que no pueden demostrar.
- **Estado público:** `charts.personalityReadingState` declara `pending` —no `error`— cuando la única fila guardada es de otra revisión: lo que corresponde es regenerarla. `charts.personalityReading` no la devuelve. Las dos firmas quedan igual.
- **Borrado de cuenta:** sin cambios. `natalInterpretations` ya se borra por `by_user`.

### Binding del front: `charts.recoverNatalChart` se consume por la referencia GENERADA

- **Qué cambia:** sale de la sección manual de `src/services/appRefs.ts` —donde estaba enlazada por `anyApi` con su firma escrita a mano— y pasa a `src/services/chartsApi.ts`, que reexporta `api.charts.recoverNatalChart` de `convex/_generated/api`, con el mismo criterio que `layersApi.ts` y `relationshipsApi.ts`.
- **Por qué:** una firma escrita a mano no es un contrato, es una copia: un cambio del `returns` del backend seguiría compilando y el error aparecería recién en runtime. Con la referencia generada, un cambio de contrato **rompe el typecheck** del consumidor.
- **Alcance:** sólo esta action. Las superficies legacy de `appRefs` no se migran en esta tanda.

### Rollout

- **Sin deploy en esta tarea.** No se corrió `convex dev` ni `convex codegen`. **Corrección (2026-08-18):** esta línea decía que `api.d.ts` "deriva de los módulos (`ApiFromModules`)" y por eso no hacía falta regenerar nada. Eso vale para una FUNCIÓN nueva dentro de un módulo que el artifact ya enumera —el caso de esta entrada—, pero **no** para un módulo nuevo: `fullApi` es una tabla que escribe el codegen archivo por archivo. `convex/lib/natalRevision.ts` es un módulo nuevo y quedó **fuera** del artifact. Ver la entrada del 2026-08-18.
- **Compatibilidad hacia atrás:** los dos campos nuevos son opcionales, ninguna firma pública cambia y los clientes instalados no se enteran. Una app anterior que lea una lectura legada verá `pending` y la regeneración la completará.

## 2026-08-17 — Recuperación natal honesta (`charts.recoverNatalChart`, aditiva) y caché negativa del arco

### `charts.recoverNatalChart()` — **NUEVA**, aditiva

- **Firma:** `action`, pública. `args: {}` (cerrado, sin argumentos). `returns` cerrado y discriminado:
  `{ status: "recovered", source: "stored" | "provider" } | { status: "failed", reason: "provider_failed" | "still_incomplete" }`.
- **Qué hace:** exactamente el mismo trabajo que `charts.calculateOrCreateNatalChart` —mide la suficiencia del cache, vuelve al proveedor si no alcanza, persiste y agenda la lectura larga— y además **dice cómo terminó**. `recovered` significa una sola cosa: el read-model puede publicar la geometría que estos datos natales permiten, medida con `storedNatalChartIsSufficient`, la misma regla que usa `layers.getNatalChartBase`.
- **Por qué:** `calculateOrCreateNatalChart` resuelve con la carta guardada cuando el proveedor falla. Eso es lo correcto para el alta —nadie se queda sin carta por una caída— y es justamente lo que no sirve para el botón "COMPROBAR DE NUEVO": recibir de vuelta la misma carta incompleta y llamarlo éxito dejaba a la pantalla anunciando un final que no ocurrió. Con `success` del proveedor y un payload que seguía sin casas ni ejes pasaba lo mismo, y encima ese payload se persistía **encima** del anterior sin comprobar nada.
- **Quién la usa:** el controlador de recuperación de la Carta (`src/hooks/useNatalChartRecovery.ts`). Con `failed` la pantalla muestra *"No pudimos completar el cálculo ahora."* y `REINTENTAR`, y la carta parcial sigue visible.
- **Binding:** tipado en `src/services/appRefs.ts` con `args`/`returns` cerrados. La action nueva vive en `convex/charts.ts`, un módulo que `convex/_generated/api.d.ts` **ya enumera**, así que `ApiFromModules` deriva su firma sin regenerar nada; **no se corrió `convex dev` ni `convex codegen`**. **Corrección (2026-08-18):** esa derivación vale por FUNCIÓN dentro de un módulo ya enumerado, no por módulo nuevo. Ver la entrada del 2026-08-18.

### `charts.calculateOrCreateNatalChart()` — una carta guardada nunca empeora (sin cambio de firma)

- **Qué cambia:** cuando la carta guardada no alcanza y el proveedor responde `success` con un payload que **tampoco** alcanza, ese payload ya **no se persiste encima** de la anterior. Se conserva la que estaba. Sin carta guardada, en cambio, se persiste igual: algo es mejor que nada y la Carta ya sabe declararlo `partial` con su reintento.
- **Por qué:** no hay forma de ordenar dos cálculos incompletos, y el que ya está publicado es el que la Carta está mostrando. Un intento de recuperación no puede empeorar lo que había.
- **Qué NO cambia:** su firma, su comportamiento visible para el alta, el editor de perfil y la Carta web. Sigue devolviendo la carta vigente —la nueva, o la anterior cuando el proveedor no pudo mejorarla— y sólo rechaza cuando no queda ninguna. Ningún argumento nuevo, ningún `force`.
- **Dónde vive la decisión:** `runNatalChartCalculation` + `resolveNatalCalculationDecision` en `convex/charts.ts`, exportadas y probadas como tabla (`test/natalRecoveryBackendV492.test.ts`), con el proveedor inyectado.

### `ORB-TRN-001` — la caché negativa vieja no sobrevive al ranking de hoy

- **Qué cambia:** la coherencia del par `(ranking, arco)` mira el ranking **siempre**, también cuando el arco no trae dato. Antes devolvía "coherente" apenas veía `data === null`, así que un sobre negativo cacheado con `missingInputs: ["matching_transit_arc"]` convivía con un `items: []` nuevo: el copy prometía calcular el arco del tránsito que hoy encabeza la lista cuando la propia lista decía que no encabeza ninguno. Ese copy falso duraba hasta `validUntil`, o indefinidamente si era `null`.
- **La regla, entera:** ranking **sin `data`** → el arco se conserva tal cual, traiga dato o no. Ranking con **`items: []`** → sobre sin dato con `active_transit_arc`, y el código contrario se descarta. Ranking con **primer ítem** y arco ausente o de otro contacto → `matching_transit_arc`.
- **Qué se conserva:** los demás faltantes del sobre sin dato (`current_ephemeris`, `natal_chart`, …) se suman al hecho de coherencia en vez de perderse. Y un sobre sin dato que **ya declara exactamente ese hecho** —y no el contrario— no se reescribe: su limitación explica mejor por qué hoy no hay arco.
- **Copy:** la limitación decía *"el que estaba guardado es de otro día"*. Puede ser de otra hora del MISMO día: ahora dice *"ya no corresponde a la lista actual"*, y sólo cuando de verdad había un arco con dato que retirar.
- **Qué NO cambia:** `methodVersion`, `inputHash`, alcance, `status`, `stale` y `validUntil` siguen resolviéndose igual, y nunca se relabela el arco de otro contacto.
- **Schema y firmas:** sin cambios.
- **Rollout:** sin deploy en esta tarea.

## 2026-08-17 — Cache natal suficiente y motivo honesto del ranking vacío (sin cambio de firma)

### `charts.calculateOrCreateNatalChart()` — el cache se mide por lo que publicó, no sólo por la clave

- **Qué cambia:** la action deja de reutilizar la carta guardada por el solo hecho de existir. Con hora exacta (`birthTimePrecision === "known"`) se exige que el payload traiga la geometría completa —Ascendente, Medio Cielo y las doce cúspides verificadas—; si no la trae, se vuelve al proveedor y se persiste el resultado nuevo bajo el mismo `cacheKey`. Sin hora exacta no hay geometría que exigir y el cache se reutiliza exactamente como antes.
- **Por qué:** el `cacheKey` se arma con los DATOS natales, así que dice "esta carta se calculó con estos datos"; no dice que el cálculo haya llegado hasta donde estos datos permiten. Una corrida en la que el proveedor devolvió posiciones pero no `houses` deja una fila sin casas y sin Ascendente. `layers.getNatalChartBase` la declara `partial` con `verified_ascendant_mc_geometry` / `verified_twelve_house_geometry`, la Carta ofrece volver a pedir el cálculo… y la action encontraba esa misma fila por `cacheKey` y la volvía a persistir igual. El botón prometía un cambio imposible.
- **Una sola regla:** la suficiencia se mide con `convex/lib/natalGeometry.ts`, que es el mismo módulo del que `layers.getNatalChartBase` deriva los ejes y las casas publicables. Las dos preguntas no pueden discrepar.
- **Qué NO cambia:** ninguna firma, ningún argumento, ninguna tabla. **No se agrega ningún `force` público:** la decisión es interna y no se puede pedir desde afuera. Si el proveedor no puede mejorar la carta ahora —credenciales ausentes, caída, respuesta parcial— se conserva la que ya había y se agenda la lectura larga igual que antes: reintentar puede no mejorar nada, pero nunca deja la cuenta sin carta.
- **Costo:** una cuenta con carta incompleta y hora exacta vuelve a pegarle al proveedor en cada invocación hasta que la carta se complete. Es acotado (lo dispara una persona) y es el objetivo del arreglo.

### `ORB-TRN-001` — el ranking con la lista VACÍA declara `active_transit_arc`

- **Qué cambia:** cuando el arco guardado se descarta porque el ranking publicó `items: []`, el faltante pasa a ser `active_transit_arc` —el código canónico de "hoy no hay ningún tránsito mayor activo para formar un arco", el mismo que usa `layerAssembly`— en vez de `matching_transit_arc`. La limitación acompaña: *"Hoy no hay ningún tránsito encabezando tu lista, así que no hay arco que mostrar: el que estaba guardado es de otro día."*
- **Por qué:** `matching_transit_arc` significa "falta calcular el arco del tránsito que hoy encabeza tu lista". Con la lista vacía, la propia lista ya afirmó que **no hay** tal tránsito: el sobre prometía el cálculo de algo que no existe.
- **Qué NO cambia:** un ranking con un primer ítem y un arco de OTRO contacto conserva `matching_transit_arc` —ahí sí falta un cálculo—. Un ranking **sin dato** (`unavailable`, `error`) sigue sin contradecir a nadie y conserva el arco guardado. Estados, `stale`, `validUntil` y `current_ephemeris` quedan igual.
- **Clientes:** los dos códigos ya tienen traducción visible en `src/domain/layers.ts`; `active_transit_arc` estaba desde el principio. Ningún cliente necesita conocer nada nuevo.
- **Schema y firmas:** sin cambios.
- **Rollout:** sin deploy en esta tarea.

## 2026-08-17 — Coherencia del par ranking/arco al leer del cache (sin cambio de firma)

- **Qué cambia:** todo camino que compone el bundle publica `today.transitArc` y `today.transitRanking` correspondiéndose. Cuando el arco trae dato, se exige contra el primer ítem del ranking el `arcId` **y** la tupla semántica completa —`transitPlanet`, `natalPoint`, `aspect`—. Si no corresponden, el arco se descarta y en su lugar va un `ORB-TRN-001` sin dato con el faltante nuevo `matching_transit_arc`. Nunca se relabela `ORB-TRN-002` como arco ni se mezcla el arco de otro contacto.
- **Por qué:** el arreglo de identidad anterior sólo cubre el CÁLCULO. `layers.getForDate` (lectura pura) y `layers.refreshForDate` sin efeméride rescataban los dos sobres del cache por separado, así que una fila escrita antes de aquel arreglo —o por otra ventana lógica del día— podía combinar un ranking cuyo `items[0]` es A con un arco que describe B. En modo caché u offline ese par podía durar indefinidamente.
- **Dónde aplica:** `getForDate`, las dos ramas de `refreshForDate` (con efeméride y sin ella) y, por lo tanto, lo que `persistRefresh` guarda. En `refreshForDate` el sobre honesto REEMPLAZA la fila incoherente, así que el defecto no sobrevive a un refresh.
- **Qué NO cambia:** un ranking **sin dato** —`unavailable`, `error`— no afirma nada sobre hoy y no descarta ningún arco: ahí se conserva el último dato personal disponible. Un ranking **con la lista vacía** sí afirma que hoy no encabeza ningún contacto, y contra eso ningún arco con dato se publica. El arco por `arcId` (`getTransitArc` / `refreshTransitArc`) conserva su guard propio y su alcance.
- **Estados honestos:** el reemplazo nunca es `stale` —no existe fila correspondiente que mostrar—. Con efeméride es `unavailable`; sin efeméride, `error` con su fecha de reintento y `current_ephemeris` además del faltante nuevo.
- **Schema y firmas:** sin cambios. `layers.getForDate`, `layers.refreshForDate`, `layers.getTransitArc` y `layers.refreshTransitArc` conservan args y returns; `missingInputs` ya era `array(string)`.
- **Clientes:** `matching_transit_arc` tiene traducción visible en el front (`src/domain/layers.ts`). Un cliente anterior que no lo conozca cae en la limitación del sobre, que también está escrita para leer.
- **Rollout:** sin deploy en esta tarea.

## 2026-08-17 — Identidad estable del arco de tránsito (sin cambio de firma)

- **Qué cambia:** el `arcId` V1 se deriva de carta + planeta en tránsito + aspecto + punto natal + **ventana lógica**, y ya no de cómo se midió esa ventana. `TransitContactInput.arcWindowKey` pasa a ser la ventana lógica: las marcas de procedencia (`verified:`, `estimated:`, `provisional:`) se descartan al calcular la identidad, y el seguimiento verificado propaga la ventana lógica que el contacto ya traía en vez de sembrar una nueva con sus propios bordes.
- **Por qué:** el ranking (`ORB-TRN-002`) extrapola la ventana con la velocidad del día y el arco (`ORB-TRN-001`) la verifica contra efemérides reales. Sembrar la identidad con la ventana verificada —y encima etiquetada— hacía que el MISMO Saturno–Marte saliera como `arc_v1_0pa9p2w` en la lista y como `arc_v1_19nh0r0` en su propio arco: abrir el detalle del tránsito principal desde la lista no encontraba su arco. Ahora `today.transitArc.data.arcId === today.transitRanking.data.items[0].arcId` para la misma tupla semántica.
- **Qué NO cambia:** las FECHAS. Verificar sigue corriendo los bordes de la ventana y publicando las pasadas reales; lo que se conserva es el identificador. Un `arcId` declarado por el caller sigue mandando sobre el derivado, y los arcos no principales conservan el soporte del cambio anterior.
- **Cache:** el arco principal se sirve desde `analysisSnapshotsV492` sólo si la fila guardada declara el `arcId` vigente además del mismo contacto (planeta, punto natal y aspecto). Una fila escrita con otra identidad —por ejemplo, la de la versión anterior del motor— se recalcula en vez de publicarse; la invalidación es explícita y por identidad, no por versión de tabla.
- **Schema y firmas:** sin cambios. `layers.getForDate`, `layers.refreshForDate`, `layers.getTransitArc` y `layers.refreshTransitArc` conservan args y returns.
- **Rollout:** sin deploy en esta tarea.

## 2026-08-17 — Detalle de UN arco de tránsito (aditivo)

- **Qué cambia:** dos funciones nuevas y tipadas, `layers.getTransitArc({ localDate, timezone, arcId })` (query reactiva y pura) y `layers.refreshTransitArc({ localDate, timezone, arcId })` (action que calcula y persiste). Las dos devuelven el sobre cerrado `AnalysisResult<TransitArcData>` de `ORB-TRN-001`, con su método, su precisión, su hash, sus limitaciones y sus `sourceRefs`. La query devuelve `null` sólo cuando no hay cuenta con datos, igual que `getForDate`.
- **Por qué:** `layers.getForDate` publica `ORB-TRN-001` únicamente del arco PRINCIPAL del día. El detalle de cualquier otro tránsito de la lista no tenía de dónde salir, y el cliente lo armaba con el ítem del ranking (`ORB-TRN-002`): fechas extrapoladas presentadas como cronología del arco y trazabilidad de otro análisis. Ahora cada arco pedido tiene su propio cálculo.
- **Alcance y cache:** el resultado se guarda en `analysisSnapshotsV492` con el hash de `{ localDate, timezone, arcId }`. El arco principal conserva su alcance `{ localDate, timezone }`, así que dos arcos del mismo día —y el principal— son tres filas con tres `cacheKey` distintos y ninguno se lee en lugar de otro. Un `stale` sólo se reutiliza si el dato guardado declara el mismo `arcId`.
- **Cómo se calcula:** se reutiliza el estado de `layers.getRefreshState`, la efeméride global vigente —o la anterior declarada `stale`—, la carta natal canónica y el motor real. Se reconstruyen los contactos, se selecciona el activo cuyo `arcId` coincide exactamente con el pedido, se corre el seguimiento verificado de `planets/tropical` para ESE contacto y se arma `buildTransitArcLayerData({ contacts, observedAt, arcId })`. La efeméride natal no se recalcula por este camino: sigue siendo del ciclo del día.
- **Estados honestos:** si el arco salió de la lista, `unavailable` con `requested_transit_arc`; si nunca se calculó, la query lo declara con `requested_transit_arc_calculation`; si falla el proveedor o el seguimiento, `stale`, `partial` o `error` con su motivo. Nunca se rescata el arco de otro contacto ni se reconstruye con metadatos del ranking.
- **Motor de arcos (aditivo):** `TransitContactInput` acepta `arcId?`. Verificar las pasadas corre los bordes de la ventana y con ellos el identificador derivado, así que sin esto el mismo tránsito cambiaría de `arcId` al verificarse y dejaría de corresponder al que publicó el ranking. Los contactos que declaran el mismo `arcId` se agrupan como pasadas del mismo arco. Sin el campo, el comportamiento es idéntico al anterior.
- **Schema:** sin cambios. No hay tablas ni campos nuevos; el borrado de cuenta ya cubre `analysisSnapshotsV492`.
- **Compatibilidad:** `layers.getForDate`, `layers.refreshForDate`, el arco principal, el ranking y los clientes instalados quedan intactos. Cambio puramente aditivo.
- **Rollout:** sin deploy en esta tarea. Las funciones nuevas no están disponibles en Development hasta que se despliegue el contrato.

## 2026-08-15 — Capas astrológicas nativas V4.9.2

- **Creación idempotente de personas:** `relationships.savePerson(...)` acepta
  `idempotencyKey` como parte de su contrato nuevo. En una creación, la clave
  queda acotada al usuario e identifica un único intento: los reintentos concurrentes o tardíos
  devuelven el mismo `profileId`; reutilizarla con otros datos falla cerrado.
  Dos altas intencionales, incluso con datos idénticos, siguen siendo posibles
  usando claves distintas. `relationshipProfiles` suma el campo privado
  `creationRequestKey?` y el índice `by_user_creation_request_key`; la clave no
  forma parte del retorno público, la telemetría ni las comparaciones.
- **Qué cambia:** se agregan las funciones tipadas `layers.getNatalBase()`, `layers.getForDate({ localDate, timezone })`, `layers.refreshForDate({ localDate, timezone })`, `relationships.list()`, `relationships.savePerson(...)`, `relationships.removePerson({ profileId })`, `relationships.getComparison({ profileId })` y `relationships.refreshComparison({ profileId })`. Todos los resultados personales usan el sobre cerrado `AnalysisResult<T>` con estado, precisión, vigencia, versión de método, hash opaco, limitaciones y `sourceRefs` bibliográficas.
- **Schema aditivo:** nuevas tablas tipadas `analysisSnapshotsV492`, `natalEphemerisCachesV492`, `globalSkySnapshotsV492` y `relationshipComparisonCachesV492`. `natalEphemerisCachesV492` conserva únicamente las diez posiciones normalizadas de `planets/tropical` —una muestra exacta con hora conocida o tres muestras del día civil sin hora—, se invalida por datos natales y versión del método, y nunca persiste el payload crudo. `relationshipProfiles` suma precisión de hora, coordenadas, timezone e identidad opcional del lugar; las filas anteriores siguen siendo válidas y se muestran como la primera persona guardada.
- **Privacidad:** las nuevas tablas no persisten respuestas crudas del proveedor. El hash público no contiene fecha, hora, lugar ni coordenadas en claro. Telemetría no recibe datos natales ni contenido interpretativo.
- **Compatibilidad:** no se retiran ni cambian funciones o tablas legacy; los clientes instalados conservan sus contratos. Los caches nuevos se borran con la cuenta y el cielo global compartido se preserva.
- **Precisión:** sin hora exacta no se publican casas, Ascendente, profección ni capas sensibles. Un valor estable durante todo el intervalo civil puede mostrarse como estimado; si cruza un límite se devuelve rango o se retira esa parte.
- **Carta natal canónica:** se agrega `layers.getNatalChartBase()` con contrato cerrado y `methodVersion=canonical-natal-chart-base-v1`. Sol–Plutón provienen exclusivamente del cache `planets/tropical`; Ascendente, Medio Cielo y las doce casas reutilizan geometría legacy sólo con hora `known`. Una hora `approximate` se trata como desconocida. Sin hora, cada posición declara `exact | estimated | range | omitted`, nunca publica el grado del mediodía, y los aspectos mayores sólo aparecen si conservan el mismo tipo dentro de la cota conservadora del día completo. La versión fija aspectos 0°/60°/90°/120°/180° con orbes 6°/4°/5°/5°/6°; no reutiliza `mainAspects` legacy.
- **Estación vital sin hora:** `ORB-CYC-002` usa ahora `secondary-progressed-lunation-full-civil-day-v2`. Una hora desconocida —o aproximada sin margen declarado— se evalúa en `00:00 / 12:00 / 23:59` de la zona natal mediante `planets/tropical`. Solo se publica la fase cuando un margen conservador descarta un cruce durante todo el día. Las fechas de inicio y cambio incluyen rangos derivados del intervalo completo; si la fase cruza un límite, la capa queda `partial/range` sin elegir una hora. Los saltos y repeticiones del reloj se resuelven de forma cerrada y nunca seleccionan una ocurrencia implícita.
- **Cumpleluna:** el dato devuelve las dos raíces consecutivas `previousExactAt` y `nextExactAt`. Así el cliente puede reconocer todo el día civil en que ocurrió la repetición del ángulo natal, incluso después de la hora exacta, sin confundirla con el ciclo del mes siguiente.
- **Mandala temporal v2:** el tercer anillo deja de usar la lunación colectiva del día y pasa a representar `Tu ritmo lunar`, entre dos Cumplelunas personales consecutivas. `ORB-CYC-007` incorpora el anillo `cumpleluna` con avance, día del ciclo, días restantes y ambas fechas exactas; el validator conserva `current_lunation` únicamente para poder leer snapshots v1. El hash y la vigencia del Mandala dependen de sus cuatro capas fuente, y estado, precisión, faltantes y `stale` se propagan desde Cumpleluna en lugar de `Luna en tu carta`.
- **Arcos de tránsito v2:** `ORB-TRN-001` usa `transit-arc-planets-tropical-roots-v2`. Para el contacto principal busca raíces reales y acotadas alrededor de la ventana activa mediante el adaptador canónico `planets/tropical`, detecta la dirección en cada pasada y agrupa el arco con un `arcId` estable. El radio se amplía según la velocidad de los planetas exteriores, con tope explícito de fechas y de 96 consultas. El snapshot horario y una deduplicación corta en vuelo evitan recalcular la misma búsqueda; un fallback `stale` sólo se acepta si planeta, punto natal y aspecto siguen siendo los del arco principal actual. Si una sola muestra falla o la ventana no puede cerrarse, conserva ese resultado compatible como `stale` o declara la estimación como `partial`; nunca presenta la extrapolación como una cronología verificada.
- **Rollout:** contrato e implementación se integran con las diez capas terminadas. No hay deploy, TestFlight ni publicación en esta tarea sin autorización explícita de Lucas.

## 2026-08-13 — Hotfix: límite Free del Tarot visible en producción

- **Qué cambia:** `daily.revealCard({ localDate })` conserva argumentos y retorno de éxito, pero el límite esperado de siete cartas ahora se comunica como `ConvexError({ code: "FREE_TAROT_REVEAL_LIMIT_REACHED" })` en lugar de un `Error` interno.
- **Por qué:** Convex redacta los errores internos comunes en producción. El servidor aplicaba correctamente el límite, pero el navegador recibía sólo `Server Error`; por eso la Home revertía el giro y nunca activaba `DESBLOQUEAR TAROT DIARIO`.
- **Compatibilidad:** no cambia schema ni el camino exitoso. Los clientes deben leer `error.data.code`; durante la transición pueden conservar el reconocimiento del marcador dentro de `Error.message` usado en desarrollo.
- **Rollout:** desplegar primero Convex compatible y luego el frontend que reconoce el payload estructurado. Rollback por redeploy del bundle anterior, sabiendo que restaura el fallo visual en producción.

## 2026-08-13 — Tríada del onboarding anónimo fuera del laboratorio

- **Qué cambia:** nueva acción pública `publicOnboarding.computeTriad({ birthDate, birthTime?, birthTimePrecision, birthPlaceLabel?, latitude, longitude, clientDraftId })` que devuelve **únicamente** `{ sun, moon, ascendant }` (signos canónicos en minúscula sin tildes, o `null`), garantizado por un `returns` validator. Usa el proveedor natal canónico (`runAstrologyApiNatalChart`). Sin sesión y sin persistir datos de nacimiento.
- **Por qué:** el alta calculaba la tríada con `publicLab.previewDailyHome`. El lab está bloqueado en producción por diseño, así que la llamada fallaba siempre y la UI se lo tragaba: la persona llegaba a Clerk y a `/recepcion` sin Luna ni ascendente. Afectaba por igual a la app y a `/empezar`, que comparten `OnboardingFlow`.
- **Zona horaria:** la acción corre en el runtime Node y **deriva la zona de las coordenadas** con `timezoneAtCoordinates` (`geo-tz`), el mismo resolver que ya usa el resto del alta. No acepta `timezone` del cliente ni cae nunca a la zona del dispositivo; si no se puede resolver, falla con `ONBOARDING_TRIAD_TIMEZONE_UNRESOLVED` y el cliente ofrece reintento.
- **Validación:** fecha real `YYYY-MM-DD` entre 1900 y hoy; `birthTime` obligatorio en `HH:MM` salvo `birthTimePrecision=unknown` (donde mandarla es un error); latitud −90..90 y longitud −180..180 finitas y obligatorias; etiqueta de lugar ≤ 160. Sin hora natal el ascendente vuelve `null` en vez de un signo calculado con mediodía. Errores con código estable `ONBOARDING_TRIAD_*`.
- **Schema (aditivo):** nueva tabla `publicRateLimits` (`bucketKey`, `scope`, `count`, `windowStartedAt`, `expiresAt`; índices `by_bucketKey` y `by_expiresAt`) + `publicRateLimits.consumeOnboardingTriad` (internal mutation). Guarda solo contadores por ventana: el sujeto es `draft:${clientDraftId}` —el id opaco que emite el cliente, tal cual, sin hash— o `all` para el fusible global. No guarda datos natales.
- **Timeouts:** la llamada natal corre con deadline (`ORBITA_ONBOARDING_TRIAD_TIMEOUT_MS`, default 12s y **máximo 15s**, por debajo del techo del cliente para cualquier configuración válida) y `AbortController`; `runAstrologyApiNatalChart` acepta ahora `signal` y lo pasa al fetch de los tres endpoints natales, sin intentar el fallback legacy si el deadline ya cortó. Al vencer devuelve `ONBOARDING_TRIAD_PROVIDER_TIMEOUT`. El cliente suma su propio techo (20s) porque `useAction` encola sin fallar cuando no hay conexión: sin él la pantalla quedaba al 100% para siempre.
- **Rate limit en dos niveles, con alcances distintos:** cupo por borrador del alta (`clientDraftId`, obligatorio y validado por formato/longitud) de 12/min, que es el **cupo de reintentos del flujo** — no una defensa contra un caller malicioso, porque rotar ese id es trivial y estrena cupo. La **protección real de costo es el fusible global** de 3000/min: existe para que un bug o un script no dispare la factura de AstrologyAPI, y si corta todas las altas ven "reintentá en un momento". Ajustables con `ORBITA_ONBOARDING_TRIAD_MAX_PER_DRAFT_PER_MINUTE` y `ORBITA_ONBOARDING_TRIAD_GLOBAL_FUSE_PER_MINUTE`. El sujeto del contador es el id tal cual: no se hashea, porque un hash corto no sería anonimización real.
- **Guard del lab:** se conserva intacto. Las tres señales productivas (`ORBITA_ENVIRONMENT=production`, `COMMERCE_MODE=live`, `CONVEX_DEPLOYMENT` con prefijo `prod:`) se mudan a `convex/lib/environment.ts` con la misma semántica, y se suma `ORBITA_ENV=production` como señal adicional. Deliberadamente NO se mira `NODE_ENV`.
- **Compatibilidad:** cambio aditivo. `publicLab` conserva firmas y comportamiento; Clerk, borrador durable, idempotencia y el resto de la resolución de timezone quedan como estaban.
- **Estado:** rama `fix/onboarding-triad-public-action` desde `origin/main`. Typecheck, suite completa, build web y presupuesto del export en verde. Sincronizado únicamente con Convex dev `dutiful-viper-815`: codegen generado, tabla e índices creados y smoke sintético de la tríada real aprobado. Producción no fue tocada.

## 2026-08-12 — Checkout directo sin pantalla comercial intermedia

- **Checkout alojado:** la sesión mensual agrega
  `custom_text[submit][message]` con el resumen de beneficios que antes vivía en
  “Qué incluye”. Stripe lo muestra junto a la confirmación; el Price sigue
  siendo la única autoridad de importe, moneda e intervalo.
- **Cancelación:** `cancel_url` vuelve a `/home`, no a `/paywall`. Esa ruta pasa
  a ser un lanzador automático y volver a ella crearía una segunda sesión.
- **Sin cambio de seguridad:** Clerk, customer, Price, trial, metadata, webhook
  y concesión autoritativa del entitlement quedan intactos.
- **Rollout:** validar exclusivamente con Stripe test y Vercel Preview.
  Producción permanece fuera de alcance.

## 2026-08-12 — Timezone natal por coordenadas, sin API paga

- **Contrato aditivo:** nueva action pública
  `placeTimezone.atCoordinates({ latitude, longitude })` → `{ timezone }`.
- **Autoridad:** usa los límites geográficos empaquetados de `geo-tz` y devuelve
  una zona IANA desde las coordenadas elegidas en Photon. No llama a un provider,
  no consume créditos y no usa la zona del dispositivo.
- **Empaquetado:** `convex.json` instala `geo-tz` como dependencia externa del
  runtime Node para no sumar su dataset geográfico al límite del bundle de
  funciones. La versión sigue fijada por `package.json`/`pnpm-lock.yaml`.
- **Motivo:** Photon entrega etiqueta y coordenadas pero no timezone. El editor
  exigía timezone antes de persistir y convertía una selección válida en el
  error repetitivo “No pudimos determinar la zona horaria”.
- **Compatibilidad:** no cambia ninguna firma existente. El frontend del editor
  llama la nueva action sólo cuando la persona selecciona un lugar nuevo.
- **Rollout:** sincronizar únicamente Convex dev y validar el guardado en Vercel
  Preview. Producción queda fuera de esta tarea.

## 2026-08-12 — Límite durable de siete revelaciones Tarot para Free

- **Qué cambia:** `daily.revealCard({ localDate })` conserva sus argumentos y su
  retorno, pero una cuenta Free puede revelar como máximo siete cartas nuevas.
  La octava y siguientes rechazan con el marcador estable
  `FREE_TAROT_REVEAL_LIMIT_REACHED`; Plus mantiene acceso ilimitado.
- **Idempotencia:** si la carta del día ya estaba revelada, la mutación devuelve
  la marca original antes de evaluar el límite. Reabrir un ritual existente no
  consume cupo ni exige pago.
- **Autoridad:** el conteo y el entitlement se resuelven dentro de la misma
  transacción Convex. El cliente sólo presenta la salida a la paywall y no puede
  eludir la regla.
- **Compatibilidad:** no cambia schema, firma pública, argumentos ni forma de
  éxito. Los clientes anteriores reciben un error normal al superar el nuevo
  límite.
- **Rollout:** sincronizar primero Convex dev y validar el frontend en Preview.
  Producción queda fuera de esta tarea.

## 2026-08-11 — Readiness natal autoritativo para alta y recuperación

- **Qué cambia:** `onboardingDrafts` suma el campo aditivo `flowOrigin?: "anonymous_signup" | "authenticated_recovery"`. Se incorpora `onboarding.confirmSignupDraft({ clientDraftId })`, confirmación anónima e idempotente que sólo devuelve `{ ready: true }` para un borrador remoto completo, y la consulta pública `onboarding.getCompletionStatus({ clientDraftId? })`, que devuelve un estado sin PII: `signed_out | onboarding_incomplete | profile_incomplete | chart_pending | chart_ready`, el destino de recuperación `onboarding | edit_birth_data | null` y los booleanos `profileReady`/`birthDataReady`/`chartReady`.
- **Autoridad:** `chart_ready` exige identidad Clerk, fila `users`, datos natales completos y válidos, y una `natalChart` cuyo `birthDataId`, `birthDataHash`, `cacheKey` y versión correspondan exactamente a los datos natales vigentes. El nombre que Clerk pueda aportar se conserva, pero es opcional y nunca bloquea el alta. Un paso local, `isSignedIn` o el retorno de `completeBirthData` no habilitan Home.
- **Recuperación:** un alta iniciada anónimamente conserva su origen al adjuntarse a Clerk y vuelve al onboarding si falla la finalización. Una cuenta existente incompleta vuelve a `/editar-datos`; nunca se borra ni se recrea.
- **Rendimiento:** la consulta es reactiva y sólo confirma el resultado persistido; no llama al proveedor, no hace polling ni dispara cálculos. La única cadena de finalización reutiliza el cálculo idempotente por `cacheKey`.
- **Rollout:** contrato compatible primero en Convex preview/dev. Producción requiere el mismo commit aprobado, desplegando primero Convex compatible y luego un build web con variables productivas.

## 2026-08-11 — Alta durable: claim interno para resolver la zona horaria

- **Contrato aditivo:** `onboardingDrafts` suma `timezoneResolutionKey?: string` para deduplicar el enriquecimiento interno del lugar natal.
- **Compatibilidad:** no cambia ninguna firma pública ni se exige el campo a clientes existentes; el backend lo crea, rota y elimina de forma interna.
- **Privacidad:** el claim identifica la combinación ya guardada de etiqueta y coordenadas, no se devuelve en respuestas de producto ni se usa como autoridad natal.
- **Rollout:** desplegar primero este schema compatible y después el worker interno; rollback eliminando el worker y, en una entrega posterior, el campo opcional.

## 2026-08-11 — Nombre y apellido opcionales cuando Clerk los provee

- **Qué cambia:** `users` incorpora `firstName?` y `lastName?` de forma aditiva para conservarlos cuando Clerk los provee, además del `name` de presentación compatible con clientes anteriores. El onboarding no los solicita ni los exige.
- **Por qué:** Clerk no garantiza que el flujo email/clave entregue esos atributos, mientras que Google puede aportarlos. Se conserva la diferencia real sin convertirla en un requisito de producto.
- **Privacidad y acceso:** son datos de perfil de la propia cuenta; sólo la identidad autenticada puede escribirlos. No se incluyen en telemetría ni logs.
- **Rollout:** coordinar con el `SignUp` oficial de Clerk y validar que `birthData` y `natalChart` existan antes de habilitar Home, tanto si Clerk aporta un nombre como si no. Sin despliegue de producción en esta tarea.

## 2026-08-08 — Hotfix definitivo: restaurar el contrato natal público

- **Qué cambia:** `charts.current()` vuelve a entregar la carta sanitizada directamente en `payload` (`placements`, `houses`, `aspects`, `summary`, etc.) en vez de envolverla en `payload.chart.normalized`. El cliente acepta temporalmente ambas formas y rechaza payloads malformados o sin Sol/Luna/Ascendente, salvo el Ascendente legítimamente ausente con `noon_fallback`.
- **Por qué:** el arreglo probado del 2 de agosto se desplegó desde una rama lateral pero no quedó integrado en `main`; un despliegue posterior restauró la forma incompatible y el mapper produjo `SO — / LU — / AC —` en silencio.
- **Privacidad y acceso:** siguen fuera de la respuesta fecha, hora, lugar, coordenadas, `timezoneOffset`, request/raw del proveedor y hashes. Free conserva posiciones/tríada sin casas ni aspectos; Plus conserva la carta completa.
- **Persistencia:** no hay schema, migración ni escritura de datos. Los ids, `createdAt`, `updatedAt` y payloads almacenados no se modifican ni se recalculan.
- **Rollout:** PR obligatorio a `main`; deploy exclusivo de Convex producción desde un worktree limpio del SHA mergeado; sin promoción de previews ni cambios en Vercel. Rollback por redeploy del bundle anterior de funciones.

## 2026-08-01 — Oferta web mensual única con siete días de Plus completo

- **Oferta pública:** `payments.getWebOffer({})` deja de publicar los ids `weekly | yearly` y devuelve únicamente `monthly`, con intervalo `month`. Precio y moneda siguen viniendo del Price configurado en Stripe; el cliente no escribe USD 10 ni ningún importe.
- **Checkout:** `payments.createCheckoutSession({ plan })` y `payments.getCheckoutStatus({ sessionId })` aceptan el plan web nuevo `monthly`. `MONTHLY_TRIAL_DAYS = 7` gobierna tanto la oferta como `subscription_data[trial_period_days]`, por lo que la prueba incluye el entitlement completo (carta natal y experiencia diaria) y, si no se cancela, continúa como suscripción mensual.
- **Configuración:** se agrega `STRIPE_PRICE_MONTHLY`. `STRIPE_PRICE_WEEKLY` y `STRIPE_PRICE_YEARLY` quedan sólo como compatibilidad de lectura para webhooks de suscripciones históricas; no pueden iniciar compras nuevas.
- **Persistencia:** el schema suma `monthly` sin retirar `weekly | yearly | lifetime`, evitando invalidar filas antiguas. No cambia la forma de las tablas ni se requiere migración de datos.
- **Rollout:** probar exclusivamente con `COMMERCE_MODE=test`; producción permanece `off` hasta validar Checkout, webhook, trial, portal, cancelación y la transición al primer cobro.

## 2026-07-31 — Oferta Plus web: tres días de prueba anual

- **Autoridad única:** `ANNUAL_TRIAL_DAYS = 3` gobierna tanto `payments.getWebOffer({})` como la creación de Stripe Checkout. El plan semanal conserva cero días de prueba.
- **Compatibilidad:** no cambian schema, argumentos, retornos ni ids de planes; únicamente cambia el valor anual publicado y enviado a Stripe de siete a tres días.
- **Rollout:** validar primero con precios y webhook Stripe test. Producción permanece con `COMMERCE_MODE=off` hasta completar el preview integrado, 24 horas estables y la aprobación explícita de Lucas.

## 2026-07-29 — Integridad natal: onboarding create-only y caches ligados a la carta vigente

- **Onboarding:** `onboarding.completeBirthData(...)` conserva la misma firma, pero pasa a ser create-only e idempotente. Si la cuenta ya tiene datos natales distintos, falla con `ONBOARDING_BIRTH_DATA_CONFLICT`; las ediciones intencionales deben usar `birthData.upsertForCurrentUser({ ..., source: "profile" })`.
- **Lectura vigente:** `charts.current`, Carta larga, Valores, Home, lecturas diarias y Tránsitos dejan de caer a “la última carta” o a un cache diario de otra carta. Mientras el cálculo exacto no exista devuelven estado vacío/pendiente o regeneran; nunca presentan la identidad anterior como actual.
- **Guía diaria:** `dailyGuides` suma `birthDataUpdatedAt?` y `natalChartId?` como identidad interna de la personalización. Al cambiar datos natales, conserva la carta, orientación, ritual y `revealedAt` del día, reemplaza inmediatamente los módulos personalizados por el fast path y agenda un nuevo enriquecimiento. Un job viejo no puede escribir después de otra edición.
- **Handoff frontend:** separar la persistencia de onboarding y Perfil; `useBackendPersistStrict` debe usar `birthData.upsertForCurrentUser` con `source: "profile"`. No generar la lectura diaria con fecha/timezone del dispositivo desde el hook de persistencia. El modo interno `debugStep` debe ser estrictamente read-only, y una cuenta con datos natales existentes no debe reingresar al onboarding para editar.
- **Incidente dev:** el acceso directo al paso final del onboarding con sesión activa sobrescribió la cuenta de prueba. Producción no fue tocada. La recuperación se hará únicamente después del rollout coordinado en Convex dev y con aprobación explícita de Lucas.
- **Rollout:** contrato backend + frontend coordinados en dev, restauración controlada de la cuenta, verificación de autorreparación de Carta/Home/Tránsitos/Guía y recién después PR. Sin deploy de producción.

## 2026-07-28 — Órbita Web P0: fecha canónica, Free/Plus y comercio apagable

- **Comercio server-side:** `COMMERCE_MODE` acepta `off | test | live` y por defecto es `off`. En `off`, ninguna action de checkout o portal puede construir un cliente Stripe. `test` exige `sk_test_*`; `live` exige `sk_live_*`, HTTPS y `WEB_APP_URL=https://orbitaastrologia.xyz`.
- **Oferta web:** se agrega `payments.getWebOffer({})` → `{ commerceMode, checkoutEnabled, plans }`. Con comercio apagado devuelve `plans: []`. Con comercio activo lee precio, moneda, intervalo y estado directamente de Stripe; no expone ids internos.
- **Checkout:** `payments.createCheckoutSession({ plan })` cambia de `weekly | yearly | lifetime` a `weekly | yearly`. El anual configura siete días de trial. Se agrega `payments.getCheckoutStatus({ sessionId })` → `pending | active | failed`; valida que sesión, customer y Clerk user sean la misma cuenta y sólo devuelve `active` después del entitlement autoritativo del webhook. `payments.createPortalSession({})` exige una suscripción Stripe activa propia y configura su retorno en la ruta canónica `/perfil`.
- **Seguridad de pagos:** se elimina la mutación pública `subscriptions.setStubPlusForDev` y la opción `markPlus` de `webB0Seed.persistCurrentUserSnapshot`. Los webhooks ya no conceden acceso a sesiones one-time/lifetime, rechazan cambios de customer, ignoran eventos anteriores a `lastEventAt` y mantienen idempotencia por `event.id`. Se agregan los eventos backend `checkout_completed` y `checkout_failed`, sin PII.
- **Fecha diaria:** se agrega `daily.getTodayContext({})` → `{ localDate, timezone }`. `daily.getGuide/getCard` ignoran la timezone del cliente, sólo generan el día canónico calculado desde la timezone natal persistida y permiten consultar una fecha histórica únicamente si ya existe. `daily.revealCard` acepta exclusivamente el día canónico actual. `dailyGuides` suma `timezone?` para congelar el ciclo ya abierto cuando se edita el lugar natal.
- **Free/Plus autoritativo:** `charts.current()` deja de devolver raw/request/datos natales y entrega casas/aspectos sólo a Plus; `charts.valuesMap`, `charts.personalityReading` y su generación quedan bloqueados server-side para Free. `transits.getToday` usa la fecha canónica y para Free devuelve clima general sin cruce natal ni lectura por áreas. `journal.list` limita Free a los últimos siete días civiles; Plus conserva el historial amplio. Umbral mantiene tres respuestas Free y cinco Plus.
- **Superficies internas:** el escape `ORBITA_BACKOFFICE_ALLOW_ALL=true` queda deshabilitado en producción. `publicLab` falla cerrado en producción aunque alguien conozca la URL; Studio, backoffice y seeds siguen requiriendo identidad Clerk allowlisteada.
- **Compatibilidad legacy:** el schema conserva `lifetime` y `stub` para leer entitlements históricos de RevenueCat/app nativa, pero la web no puede crearlos. Los clientes actuales que llamen `setStubPlusForDev`, `markPlus` o esperen el payload natal crudo deben migrar antes del deploy.
- **Handoff frontend:** eliminar `setStubPlusForDev` de `src/services/appRefs.ts`; consumir `getTodayContext`, `getWebOffer` y `getCheckoutStatus`; mostrar “Órbita Plus estará disponible pronto” cuando `commerceMode=off`; tratar `personalityReadingState.status="locked"` y `access` de Carta/Tránsitos; no enviar `timezone` como autoridad ni usar `?live=1`.
- **Rollout:** primero Convex dev + frontend limpio + checklist manual. Producción y `COMMERCE_MODE=live` quedan fuera de esta tarea hasta cumplir Gate A, 24 horas estables, validación fiscal/comercial y aprobación explícita de Lucas.

## 2026-07-20 — Eventos de producto y resumen diario por Telegram

- **Qué cambió:** se agregan `productActors`, `productEvents` y `productDigests`. `productActors` mantiene una identidad seudónima por instalación y puede vincularse al `userId` autenticado; `productEvents` registra hechos idempotentes del funnel (`app_opened`, onboarding, cuenta, vistas y reveal) sin PII ni contenido libre; `productDigests` evita duplicar el resumen diario. La mutation pública de telemetría aceptará únicamente el subconjunto de eventos originados en el cliente. Los resultados sensibles para las métricas (`account_created`, `onboarding_completed`, `daily_card_revealed`) se escribirán desde sus mutations autoritativas.
- **Por qué:** calcular aperturas únicas, usuarios nuevos/recurrentes, onboarding completado, cartas desbloqueadas y retención D1 sin inferencias ambiguas ni pings aislados.
- **Compatibilidad:** aditivo. Los builds anteriores siguen funcionando; sus pings históricos no pueden reconstruirse como actividad diaria.
- **Privacidad:** no se guardan email, nombre, fecha/lugar/hora natal, preguntas, notas, payloads ni texto de pantalla.
- **Quién lo pidió:** Lucas.
- **Estado:** contrato definido; implementación backend y handoff frontend en esta tarea.

## 2026-07-18 — Prewarm de lectura natal larga
- **Qué cambia:** no cambia ninguna firma pública ni el schema. `charts.calculateOrCreateNatalChart()` agenda internamente la lectura larga apenas encuentra o persiste la carta; `charts.generatePersonalityReading()` comparte un claim atómico con ese trabajo para que cliente y prewarm no generen dos veces.
- **Por qué:** producción confirmó que la carta astronómica tarda ~0,3 s pero la lectura LLM rica tarda ~61 s. Iniciarla antes reduce la espera sin acortar ni reemplazar los siete capítulos aprobados.
- **Ejecución:** un `pending` reciente funciona como lease de 90 segundos; `ready` es cache hit; `error` o lease vencido permiten reintento. La query aditiva `charts.personalityReadingState()` expone solo `pending | ready | error` para que el bloque inline pueda salir de la espera si el trabajo de fondo falla. Los logs `[natal.prewarm]` registran fuente, cache hit, resultado y duraciones, sin email, datos natales ni texto.
- **Compatibilidad:** clientes actuales siguen leyendo `charts.current`, `charts.valuesMap` y `charts.personalityReading` sin cambios. El frontend debe dejar de bloquear la carta base mientras la lectura larga sigue pendiente.
- **Rollout:** Convex dev primero, junto al PR frontend desacoplado; producción solo después de la pasada manual y aprobación explícita de Lucas.

## 2026-07-18 — Queries seguras durante la eliminación de cuenta
- **Qué cambia:** las queries públicas que leen datos de cuenta tratan una identidad Clerk válida sin fila `users` como estado vacío contractual (`null`, `[]`, entitlement gratuito o cupo gratuito), en vez de lanzar `User record not found`. Las mutations/actions conservan sus validaciones estrictas.
- **Por qué:** `users.deleteAccount()` elimina Convex antes de borrar la identidad Clerk. En esa ventana breve las suscripciones reactivas vuelven a ejecutarse; el build nativo cerró con `SIGSEGV` después de que `readings.getToday()` propagara una excepción sin manejar.
- **Compatibilidad:** no cambian argumentos, firmas ni schema. Una cuenta normal obtiene exactamente los mismos datos; solo cambia la transición de una cuenta ya eliminada. No se recrean filas ni se exponen datos de otra cuenta.
- **Rollout:** desplegar primero en Convex dev y repetir el borrado con una cuenta descartable usando el frontend PR #29. Producción queda fuera hasta aprobación explícita.

## 2026-07-18 — Eliminación completa de cuenta para App Review
- **Qué cambia:** se define la mutación autenticada `users.deleteAccount()` con retorno `{ deleted: true }`. El borrado comprende la fila `users` y todos los documentos propios vinculados por `userId`/`createdByUserId`; `paymentEvents` suma el índice `by_clerkUserId` para retirar también la auditoría asociada sin escanear la tabla global.
- **Compatibilidad:** cambio aditivo. Ningún flujo existente llama esta mutación; las cuentas actuales permanecen intactas. El frontend debe invocarla solo después de una confirmación destructiva y, si responde correctamente, eliminar la identidad de Clerk y limpiar el estado local.
- **Datos preservados:** caches globales del cielo y módulos editoriales compartidos. Nunca se borran datos de otra cuenta.
- **Estado:** implementado y validado en backend: typecheck verde, test destructivo 4/4 y suite completa 296/296. Desplegado únicamente a Convex dev `dutiful-viper-815`, donde el function spec confirma `users.js:deleteAccount`; pendiente PR y frontend separado. Producción no fue tocada.

## 2026-07-18 — Carta inmediata y enriquecimiento diario en segundo plano
- **Qué cambió:** `daily.getGuide()` conserva los mismos argumentos y el payload `orbita-daily-guide-v3`, pero ahora persiste/devuelve primero la carta completa sin llamar a AstrologyAPI ni al AI Gateway. La lectura inmediata sale de un catálogo versionado de **156 rituales editoriales** (78 cartas × `derecho|invertida`), cada uno con esencia, exactamente tres facetas, `enTuDia`, consejo y cierre. El payload suma metadata aditiva `enrichment: { status: "pending" | "ready" | "fallback" | "error", requestedAt, completedAt?, retryAfter?, attempt }`. Los clientes existentes pueden ignorarla. Se agrega `daily.getCard({ localDate?, timezone? })`, que devuelve el contrato separado `{ card, enrichment, personalized }` para build 17+. La carta, orientación, ritual y `revealedAt` quedan inmutables; el job posterior solo actualiza módulos personalizados de la misma fila.
- **Compatibilidad:** un payload v3 anterior sin `enrichment` se trata como terminado y se devuelve intacto. El build 16 sigue recibiendo inmediatamente todos los campos que ya espera. No hay cambio de schema ni migración destructiva.
- **Ejecución:** la mutation transaccional sobre `(userId, localDate)` crea una sola fila y agenda una sola mejora. AstrologyAPI y AI Gateway tienen un máximo de 5 segundos cada uno; ante fallo se conserva el contenido base. Los logs registran tiempos/resultado sin email, datos natales ni texto generado.
- **Contenido:** dos personas con la misma carta y orientación reciben la misma lectura editorial base, inmediata y estable. La personalización natal/tránsitos llega en módulos separados; nunca reemplaza esa lectura. El catálogo está validado estructuralmente y sin copy defensivo, mocks o astrología personalizada fingida.
- **Estado:** mergeado mediante PR #25 (`6eff43d`) y desplegado el 2026-07-18 a Convex producción `exciting-bat-311` con aprobación explícita de Lucas. Dry-run y deploy confirmaron que no se eliminó ningún índice ni se cambió el schema. Validación previa: typecheck verde, 292/292 tests, una sola fila/job bajo doble apertura y medición dev de 36 ms en frío / 16 ms con caché. No requirió un nuevo TestFlight; monitorear `[daily.fast]` y `[daily.enrichment]`. Rollback: revertir `6eff43d` y volver a desplegar el backend anterior.

## 2026-07-17 — Carta diaria: ritual intrínseco + orientación estable
- **Qué cambió:** `daily.getGuide()` migra `carta` de `{ id, nombre, correspondencia, beats }` a `{ id, nombre, correspondencia, orientacion: "derecho" | "invertida", ritual: { esencia, significadoGeneral, enTuDia, consejo, cierre } }`. `significadoGeneral` exige exactamente tres facetas, siguiendo el formato aprobado en Figma. `daily.getStrip()` suma `orientacion` para reproducir fielmente el historial. Los payloads nuevos usan `orbita-daily-guide-v3`; un cache v2 se regenera sin borrar `revealedAt`.
- **Compatibilidad de rollout:** durante la convivencia con el build 13, `carta` conserva además un `beats` legacy derivado de `ritual` (`QUÉ ES`, `EN TU DÍA`, `EL CONSEJO`). No dispara otra generación ni inventa cruces con el cielo. El frontend v3 lo ignora; se retira en un PR posterior cuando el cliente viejo deje de circular.
- **Por qué:** la carta diaria deja de fingir un cruce con la carta natal o los tránsitos. La nueva apertura muestra una lectura completa de la carta misma, diferenciada por orientación.
- **Decisiones cerradas:** mazo completo de 78; sin repetición durante los seis días anteriores; 50% invertidas mediante una segunda semilla determinística; orientación persistida; ritual generado dentro de la guía diaria con fallback intrínseco y sin cruce astro.
- **Quién lo pidió:** Lucas (handoff frontend/Claude, sección 14 de Figma).
- **Estado:** implementado en backend; pendiente integración del frontend contra el contrato real y prueba en Convex dev.

## 2026-07-17 — La lectura natal corta deja de presentarse como resultado final
- **Qué cambió:** `charts.personalityReading()` conserva su firma `PersonalityReadingPayload | null`, pero ahora devuelve `null` hasta que exista una interpretación LLM completa y cacheada con estado `ready`. Ya no entrega la plantilla breve determinística durante la generación. `charts.generatePersonalityReading()` rechaza la llamada si el generador está deshabilitado, incompleto o falla, para que el cliente pueda salir de la carga y ofrecer reintento.
- **Por qué:** la plantilla breve (`Núcleo`, `Clima interno`, etc.) aparecía como si fuera la carta natal terminada y ocultaba que los siete capítulos largos todavía se estaban generando o habían fallado.
- **Compatibilidad:** no cambian argumentos ni tipos públicos. El frontend actual ya interpreta `null` como carga y una action rechazada como error recuperable.
- **Estado:** implementado en rama backend; desplegar primero en Convex dev y verificar carga → lectura larga antes de producción.

## 2026-07-16 — Mazo completo de 78 cartas y ventana móvil sin repetición
- **Qué cambió:** el dominio de `carta.id` en `daily.getGuide()` y `cartaId` en `daily.getStrip()` se amplía de `0–21` a `0–77`. Los ids históricos `0–21` conservan exactamente las mismas cartas; los arcanos menores ocupan ids estables `22–77` en orden Bastos, Copas, Espadas y Oros (As, 2–10, Paje, Caballero, Reina, Rey).
- **Regla de producto:** al generar una carta nueva se excluyen las cartas persistidas en los seis días calendario anteriores. La ventana es móvil: no hay un reinicio semanal abrupto y una carta puede volver a salir recién al octavo día. Un documento ya generado nunca se vuelve a sortear.
- **Compatibilidad:** no cambian argumentos ni forma del payload. El frontend debe ampliar su mapa estático `id→imagen/contenido` a las 78 cartas antes de desplegar este backend; los 78 assets ya existen en `assets/orbita/optimized/tarot/`.
- **Quién lo pidió:** producto.
- **Estado:** implementado en rama coordinada; no desplegar hasta que el frontend de 78 cartas esté listo.

## 2026-07-16 — Recuperación remota de lecturas guardadas
- **Qué cambió:** nueva query autenticada `readings.listSaved({ limit? })`. Devuelve, de más nueva a más vieja, `{ savedReadingId, readingId, readingDate, readingPayload, note, createdAt }` para las lecturas que sí llegaron a `savedReadings` en Convex. Límite por defecto 60, máximo 120.
- **Por qué:** un simulador o teléfono nuevo no tiene el `AsyncStorage` anterior. La app necesita mergear el archivo remoto con el local sin confundir “remoto vacío” con “borrar lo local”.
- **Límite honesto:** esto recupera lecturas guardadas explícitamente; no inventa cartas que solo se revelaron localmente antes de existir `dailyGuides`.
- **Estado:** backend implementado; frontend pendiente de validar cada payload, integrar `listSaved` y `unsave`, y mergear por `readingPayload.id` (fecha+carta como fallback), con lo local primero.

## 2026-07-16 — Recuperación del motor natal largo original
- **Qué cambió:** `charts.generatePersonalityReading()` vuelve a usar el motor rico `generateNatalReadingWithGateway`, preservado en `b341606`/snapshot productivo `135861e`. El prompt recibe la carta completa (placements, casas, aspectos y precisión), genera los siete capítulos canónicos (`identidad`, `emocional`, `mente`, `amor`, `impulso`, `expansion`, `estructura`) y usa un presupuesto de 7000 tokens. Se elimina el motor inline posterior que reducía la carta a siete líneas aisladas y 1400 tokens.
- **Contrato:** no cambia ninguna firma pública. `charts.personalityReading()` conserva `PersonalityReadingPayload` y sigue cayendo a la plantilla determinística mientras se genera la lectura rica.
- **Regresión cubierta:** el parser rechaza respuestas incompletas o desordenadas; las pruebas exigen los siete capítulos, Júpiter, casas, aspectos, integraciones Sol+Ascendente y Venus+Marte, y el presupuesto largo.
- **Guardrails:** entretenimiento y autoconocimiento; sin destino, salud, dinero, consejo legal ni posiciones/casas inventadas.

Registro de cambios del **contrato** entre backend (Codex) y frontend (Claude).
El contrato es `convex/schema.ts` + las firmas `args`/`returns` de cada función Convex pública.
El puente de tipos (`convex/_generated/`) se deriva de acá y lo commitea el backend.

**Reglas** (ver `WORKFLOW.md` §4):
- Todo cambio de tabla, campo o firma de función pública se anota acá.
- El cambio de contrato se commitea **solo**, sin mezclarlo con una feature.
- Quien propone un cambio que el otro lado debe implementar deja un stub con `// TODO: pendiente <backend|frontend>`.

**Formato de entrada:**

```
## YYYY-MM-DD — <título corto>
- **Qué cambió:** tabla / función / firma afectada.
- **Por qué:** motivo.
- **Quién lo pidió:** backend | frontend.
- **Estado:** propuesto (stub) | implementado.
```

---

## 2026-07-15 — Contrato del ritual diario: reveal irreversible e historial

- **Qué cambió:** `dailyGuides` suma `revealedAt?: number`. `daily.revealCard({ localDate })` devuelve el timestamp del primer reveal y `daily.getStrip({ from, to })` devuelve `{ localDate, cartaId, revealed }[]` para el archivo diario. `daily.getGuide()` incorpora una carta determinística y versiona el payload como `orbita-daily-guide-v2`, invalidando caches anteriores que no pueden sostener el ritual.
- **Por qué:** el binario iOS necesita distinguir una carta generada de una carta revelada y mostrar el historial sin crear otra tabla.
- **Quién lo pidió:** frontend + producto.
- **Estado:** implementado en backend y cubierto por tests; pendiente de merge y deploy coordinado con la Home nueva.

## 2026-07-15 — Edición de datos natales consistente

- **Qué cambió:** las firmas públicas se mantienen. `onboarding.completeBirthData` ahora elimina una hora anterior cuando `birthTimePrecision="unknown"`; `charts.current` resuelve la carta que coincide con los datos natales vigentes; y `readings.generateToday` recalcula la lectura existente del día si cambió la carta, timezone o versión de contenido.
- **Por qué:** el editor del build 11 espera confirmación del backend y no puede confirmar un estado que después reaparece con la hora o lectura anteriores.
- **Quién lo pidió:** frontend + revisión backend.
- **Estado:** implementado, pendiente de deploy.

## 2026-07-15 — Stripe Checkout/Portal sin SDK Node (sin cambio de contrato)
- **Qué cambió:** `payments/stripeActions.ts` mantiene las mismas firmas públicas pero usa la API REST de Stripe mediante `fetch`; se elimina el SDK `stripe` y el runtime `"use node"`.
- **Por qué:** el SDK hacía que la evaluación del deploy de producción agotara el timeout. El backend completo sin ese módulo se evalúa en segundos.
- **Quién lo pidió:** producto/backend para estabilizar producción.
- **Estado:** implementado y verificado en producción `exciting-bat-311`.

## 2026-07-10 — Calidad de generación diaria: anti-redundancia + voz criolla (feedback usuario Sofi)
- **Qué reportó el usuario (Sofi, 2026-07-10):**
  - **HACÉ repite el body** casi palabra por palabra ("marcá/elegí la tarea que desbloquea el resto… veinte minutos" en ambos) → *"dice lo mismo tal cual"*.
  - **Lectura del tránsito larga y repetitiva:** nombra "Sol en Cáncer"/"Mercurio" 4-5 veces y reformula la misma idea → *"ese texto está raro / dice lo mismo"*.
  - **Energía en crudo:** muestra `"Elemento de base: agua"` → *"en energía no puede decir agua, puede decir sensible"*.
- **Dónde está en el código:**
  - Prompt daily LLM: `convex/daily.ts` → `buildDailyPrompt` (y el prompt lab `orbita-lab-daily-home-llm-v1`).
  - Plantilla energía cruda: `convex/lib/orbita.ts` → `energy: \`Elemento de base: ${element}.\`` (~línea 490) y `energy: \`Casa ${natalHouse}: …\``.
  - Redundancia body/hacé en topics: `buildTopicReadings` en `orbita.ts`.
- **Reglas a agregar al prompt (pedido a Codex):**
  1. **Cada campo aporta algo DISTINTO.** El `body` explica el tránsito; `hacé`/`evitá` son gestos concretos que **NO repiten frases ni ideas del body**; `acción` ≠ `hacé`; `energía` describe el clima, no repite el hacé. Prohibido que dos campos digan lo mismo con otras palabras.
  2. **No repitas placements.** Nombrá cada planeta/signo/casa **una vez**. Nada de "Sol en Cáncer" / "tu Mercurio" en cada frase.
  3. **Conciso.** `body` máximo 2-3 frases; una idea por frase; sin reformular.
  4. **Criollo, no técnico.** Nada de "Elemento de base: agua", "casa 9", "cuadratura" en crudo → traducir al **efecto humano**.
- **Mapa de humanización (para la plantilla `energy` y como guía al LLM):**
  - `agua` → "hoy te movés desde lo sensible y la memoria"
  - `fuego` → "desde el impulso y las ganas"
  - `tierra` → "desde lo concreto y lo que se sostiene"
  - `aire` → "desde la cabeza y la palabra"
  - Casas: usar `houseThemes` en criollo (ej. casa 7 → "vínculos y acuerdos"), nunca "casa N" pelado.
- **Quién lo pidió:** frontend (Claude), desde feedback de usuario real.
- **Estado:** propuesto. La personalización LLM ya está **en implementación por Codex** — estas reglas se suman al mismo prompt (y aplican también a la plantilla de fallback). Regenerar/bustear cache para que las lecturas ya emitidas se corrijan.
- **Texto LISTO PARA PEGAR (Codex).** Sumar al bloque "Reglas duras" del prompt daily (`buildDailyPrompt` en `daily.ts` y el prompt lab):
  ```
  - CONCISO: el body son 2-3 frases, una idea por frase. Prohibido reformular la misma idea con otras palabras.
  - NO REPITAS placements: nombrá cada planeta / signo / casa UNA sola vez en TODO el texto.
  - Cada campo aporta algo DISTINTO: el headline nombra el tránsito; el body lo explica una vez; el hacé y el evitá son gestos concretos NUEVOS que NO repiten frases ni ideas del body; la acción es un gesto distinto del hacé; la energía es el clima emocional en criollo. Ningún campo puede decir lo mismo que otro.
  - CRIOLLO, no técnico: si nombrás una casa, un aspecto o un elemento, traducilo al efecto humano ("casa 7" -> "vínculos y acuerdos"; "cuadratura" -> "tensión o roce"; elemento agua -> "lo sensible y la memoria"). NUNCA términos crudos tipo "Elemento de base: agua" ni "casa 9" pelado.
  ```
  Y reemplazar la plantilla de energía cruda en `convex/lib/orbita.ts` (`energy: \`Elemento de base: ${element}.\``) por criollo:
  ```ts
  const ENERGIA_CRIOLLA: Record<string, string> = {
    agua:   "Hoy te movés desde lo sensible y la memoria.",
    fuego:  "Hoy te movés desde el impulso y las ganas.",
    tierra: "Hoy te movés desde lo concreto y lo que se sostiene.",
    aire:   "Hoy te movés desde la cabeza y la palabra.",
  };
  // energy: ENERGIA_CRIOLLA[String(element).toLowerCase()] ?? "Tu día tiene un tono propio."
  ```

## 2026-07-09 — Enriquecer input del prompt daily (personalización real por punto) + sinastría vínculos
- **Hallazgo (verificado en vivo):** `buildDailyPrompt` (`convex/daily.ts:80`) hoy pasa a GPT **solo Sol/Luna/Asc** + las líneas de tránsito. Corriendo `publicLab:previewCompleteHoroscope` para 14/08/2002 se confirmó que la API **ya trae** el signo/casa/aspectos natales del punto que el tránsito toca (ej. Venus en Libra, casa 7, con 5 aspectos natales), pero **no llegan al prompt** → el LLM habla del punto sin su contexto. La materia prima rica existe; el prompt la desperdicia.
- **Pedido a Codex (1) — enriquecer el input del prompt daily:** por cada tránsito, incluir el **punto natal tocado con su signo, casa y aspectos natales** (ya está en `chartWheelData` planets/houses/aspects y en el normalizado del proveedor). No cambia el contrato de tipos del front — mejora la calidad del texto generado. Mantener guardrails (entretenimiento/autoconocimiento; sin destino/salud/dinero/legal; voseo).
- **Pedido a Codex (2) — sinastría para Vínculos:** cablear `relationships.synastry({ relationshipProfileId }): SynastryPayload` → `synastry_horoscope` + `love_compatibility_report` (ya propuesto en el bloque App Core; se reafirma para la Home de Vínculos "con quién sintonizás"). El empty state ("clima de tus vínculos") NO necesita esto: se deriva de los tránsitos propios a Venus/Marte/casas 5-7-11, que ya existen.
- **Decisión de producto (Lucas, pendiente):** prender el LLM daily (`ORBITA_LLM_ENABLED=true` + `AI_GATEWAY_API_KEY`) con cache `dailyLlmReadings` (1×/usuario/día). Costo medido: ~1.496 tokens/generación (1.088 in + 408 out) en `gpt-5.4`. Propuesta: **modelo mini para el daily** (~15× más barato), `gpt-5.4` para la interpretación natal (1×/vida, cacheada). ~$0,01–0,16 por usuario/mes según modelo.
- **Quién lo pidió:** frontend (Claude). Análisis completo en `.claude/plans/mossy-gathering-lobster.md`.
- **Estado:** propuesto (stub). Construcción se decide después (el usuario pidió no editar la app todavía).

## 2026-07-09 — Tránsitos por área (usuario logueado)
- **Qué cambió (contrato):** `TransitDetailPayload` (en `src/services/appRefs.ts`) suma `porArea?: Array<{ title: string; body: string }>` — la lectura del tránsito de hoy desglosada por área (Amor / Trabajo / Vínculos / Energía).
- **Qué construyó el front:** el tab **Tránsitos** (`app/(tabs)/transitos.tsx`) ahora **embebe la sección "POR ÁREA" inline al final** (antes era el botón "VER POR ÁREA" → `/reading/transitos`, que se saca). Mapea `porArea` del payload de `transits.getToday`; si viene vacía/undefined, la sección **se oculta** (no rompe). Consistente con "TU DÍA POR ÁREA" de la Home.
- **Pedido a backend (Codex):** que `transits.getToday` devuelva `porArea` con la lectura del **tránsito principal por cada una de las 4 áreas** (Amor/Trabajo/Vínculos/Energía) para el usuario logueado. Cada item: `{ title (ej. "Saturno pesa sobre tu Venus"), body (la lectura para esa área, en criollo, ~1-2 frases) }`. Mismos guardrails que el daily (entretenimiento/autoconocimiento; sin destino/dinero/salud/legal; voseo rioplatense). Fallback: sin dato → omitir `porArea` (el front oculta la sección).
- **Quién lo pidió:** frontend (Claude).
- **Estado:** propuesto (stub).
- **Además — labels crudos del proveedor en `transits.getToday` (bug de copy, backend):** el payload filtra placeholders del proveedor que violan el guardrail "voz Órbita, nunca copy crudo": `frequency.label` = `"Ventana del proveedor"`, `frequency.timeline[].label` = `"Pico "` sin fecha (queda "Pico -"), `window.label` = `"Ventana estimada"/"Pico estimado"`, `window.note` = `"La ventana exacta tiene que venir del proveedor astrológico."` (todo en `convex/lib/orbita.ts` ~1182/1266/1274). **Mientras tanto el front los oculta** (helper `PROVIDER_JUNK`/`humanCopy` en `app/(tabs)/transitos.tsx`): sanitiza sufijos colgados y esconde captions placeholder; cuando el copy pase a voz Órbita, se muestra solo. **Pedido a Codex:** humanizar esos strings (ej. cadencia → "Este tránsito dura ~2 meses; hoy pega fuerte"; ventana → fecha real formateada) o dejarlos vacíos.

## 2026-07-07 — Horóscopo de personalidad: pedido de interpretación natal por LLM
- **Qué cambió (contrato):** `PersonalitySection` (en `src/services/appRefs.ts`) suma `questions?: string[]` (1-2 preguntas de reflexión por sector; el plan `buildNatalInterpretationGatewayPlan` ya las prevé). El front promovió `charts.personalityReading` y `charts.valuesMap` de `proposedApi`→`appApi` (ya estaban implementadas; el "propuesto" era obsoleto).
- **Qué construyó el front:** la pantalla `/personalidad` (`src/components/web/orbita-personality.tsx`) es ahora la **lectura larga por sectores**: rueda natal real (`charts.current`) + 7 secciones interpretativas + mapa de valores (`charts.valuesMap`). El mock (`src/content/personalityMock.ts`) tiene la lectura rica de ejemplo = **target de calidad y taxonomía**.
- **Pedido a backend (Codex):** cablear el **LLM natal** (GPT-5.4, `ORBITA_LLM_ENABLED=true`) para que `charts.personalityReading` genere las **7 secciones temáticas** desde la carta real, con guardrails, cacheadas en `natalInterpretations`, con **fallback a la plantilla** actual. Ejecutar el plan `buildNatalInterpretationGatewayPlan` (falta la action que llame al gateway, parsee y escriba en `natalInterpretations`).
  - **Taxonomía de secciones (keys exactas que espera el front):** `identidad` (Sol+Asc), `emocional` (Luna), `mente` (Mercurio), `amor` (Venus+Marte), `impulso` (Marte), `expansion` (Júpiter — **reframe de "suerte"**, sin dinero/éxito), `estructura` (Saturno). Cada sección: `{ key, title, intro, placement:{label,planet,sign?,house?}, body (largo, ~4 párrafos, EXPLICATIVO/pedagógico: (1) qué es el planeta/placement en términos simples, (2) qué te da tu signo, (3) qué agrega la casa, (4) el borde de crecimiento), questions: 1-2 en CADA sección (promesa "por sector") }`. Ver `src/content/personalityMock.ts` como target de tono, largo y estructura. **No alargar más el body**; el enriquecimiento futuro va por sub-bloques opcionales por sección (ej. "Cómo se juega en tu día", "Para observar esta semana"), no por más párrafos. Evitar imperativos duros ("tenés que…").
  - **Guardrails duros en el prompt:** entretenimiento/autoconocimiento; sin destino/dinero/salud/legal como consejo; sin órdenes ("le diremos lo que debe hacer" ❌); no copiar copy crudo del proveedor. Voseo rioplatense.
- **Quién lo pidió:** frontend (Claude).
- **Estado:** front implementado (contra plantilla + mock rico). Backend LLM natal: **pendiente (Codex)**.

## 2026-07-07 — Capacidades ampliadas (endpoints AstrologyAPI disponibles sin cablear)
- **Qué cambió:** el front propone 4 funciones públicas nuevas para exponer endpoints de AstrologyAPI que ya existen pero no están cableados. No requieren tablas nuevas (cache opcional, patrón `transits.getToday`). Formas de payload en `src/services/skyRefs.ts`; catálogo completo en `docs/api-capacidades-orbita.md`:
  - `sky.getMoonPhase({ localDate, timezone })` → `MoonPhasePayload` — fase lunar del día (`moon_phase_report`/`lunar_metrics`). Módulo Home/onboarding. Free.
  - `forecast.getLongRange()` → `LongRangeForecastPayload` — tránsitos lentos por ventanas (`life_forecast_report/tropical`). **Reemplaza** el contrato que hoy figura `needs_provider_endpoint` en `buildLongRangeTimelineContract`. Premium.
  - `charts.solarReturn({ year })` → `SolarReturnPayload` — revolución solar anual (`solar_return_*`). Premium.
  - `content.sunSignDaily({ sign, localDate })` → `SunSignContentPayload` — lectura diaria por signo sin carta (`sun_sign_prediction/daily/:signo`), para demo free / logueado-sin-carta / notificaciones. Free.
- **Guardrail:** `sun_sign_prediction` y los reportes traen claims de salud/dinero/suerte/destino. Órbita toma el dato y reescribe en voz propia; nada del texto crudo va a app y todo pasa por `/backoffice`.
- **Nota:** la sinastría (`relationships.synastry`, bloque App Core) queda reconfirmada — el motor existe (`synastry_horoscope` + `love_compatibility_report`), no era "falta proveedor" sino "falta cablear + input de 2da persona".
- **Por qué:** ampliar lo mostrable con datos que ya se pueden sacar de la API (fase lunar, pronóstico largo, revolución solar, contenido por signo) sin depender de un motor nuevo.
- **Quién lo pidió:** frontend (Claude).
- **Estado:** propuesto (stub). Ver bloque `// TODO: pendiente backend — Capacidades ampliadas` en `convex/schema.ts`. Front trabaja contra mocks (`src/content/moonPhaseMock.ts`, `forecastMock.ts`, `solarReturnMock.ts`, `sunSignMock.ts`) hasta que existan.

## 2026-07-06 — Contrato de pagos v2 (RevenueCat app + Stripe web)
- **Qué cambió:**
  - **`subscriptions` v2** — una fila por `(userId, provider)`. Campos nuevos: `clerkUserId?` (denormalizado para webhooks), `provider` ahora `"revenuecat"|"stripe"|"stub"`, `plan? "weekly"|"yearly"|"lifetime"`, `providerSubscriptionId?`, `isLifetime?`, `willRenew?`, `environment? "sandbox"|"production"`, `lastEventAt?`. `status` suma `"billing_issue"`. Índices nuevos: `by_user_provider`, `by_clerkUserId`, `by_providerCustomerId`, `by_providerSubscriptionId`.
  - **`paymentEvents`** (tabla nueva) — idempotencia/auditoría de webhooks (`provider`, `eventId`, `eventType`, `clerkUserId?`, `rawPayload`, `processedAt`; índice `by_provider_eventId`).
  - **entitlement** — `plus` → `orbita_pro` (identificador canónico). Union transitorio `free|plus|orbita_pro` hasta correr `migrations:renamePlusToOrbitaPro`; después un commit lo deja en `free|orbita_pro`. Afecta también `contentModules.entitlement`.
  - **Firmas que consume el frontend:**
    - `subscriptions.getCurrent()` (query, sin args) → `{ entitlement: "free"|"orbita_pro", isPro: boolean, status, provider?, plan?, isLifetime: boolean, currentPeriodEnd?: number, willRenew?: boolean, canManageInStripePortal: boolean }`.
    - `payments.createCheckoutSession({ plan: "weekly"|"yearly"|"lifetime" })` (action, auth Clerk) → `{ url: string }` (Stripe Checkout, web).
    - `payments.createPortalSession()` (action, auth Clerk) → `{ url: string }` (Stripe Customer Portal, web).
  - **Webhooks (no los consume el front):** `POST /webhooks/revenuecat` y `POST /webhooks/stripe` en `convex/http.ts` (dominio `*.convex.site`).
- **Por qué:** habilitar el paywall real — RevenueCat en la app (iOS/Android), Stripe en la web — con Convex como fuente de verdad server-side del acceso, alimentada por webhooks. El cliente nunca escribe su propio entitlement.
- **Quién lo pidió:** frontend (mega plan de lanzamiento, Fase 1).
- **Estado:** implementado (backend). Requiere `pnpm exec convex dev --once` de Lucas para sync + correr `migrations:renamePlusToOrbitaPro`. Envs server nuevas: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_WEEKLY|YEARLY|LIFETIME`, `REVENUECAT_WEBHOOK_AUTH`, `WEB_APP_URL`, `ALLOW_DEV_STUB`.

## 2026-07-06 — Voz editorial diaria v3
- **Qué cambió:** el payload diario separa `home.subheadline` de `home.energy`, y `home.getDaily()` / `/lab` usan `home.subheadline` para el header en vez de repetir el módulo Energía. `DAILY_READING_EDITORIAL_VERSION` pasa a `orbita-daily-editorial-p0-v3`, el prompt diario AI Gateway a `orbita-lab-daily-home-llm-v3`, y la cache de `transits.getToday` a `astrologyapi-western-daily-transits-v3`.
- **Por qué:** evitar que el subtítulo de Home repita el bloque Energía y dejar cada pieza con función editorial propia.
- **Quién lo pidió:** frontend.
- **Estado:** implementado.

## 2026-07-06 — Voz editorial diaria v2
- **Qué cambió:** se actualiza la voz visible de Home/temas/tránsito/personalidad/valores a español rioplatense con voseo, tildes y signos de apertura. `DAILY_READING_EDITORIAL_VERSION` pasa a `orbita-daily-editorial-p0-v2`, el prompt diario AI Gateway pasa a `orbita-lab-daily-home-llm-v2`, y la cache de `transits.getToday` usa `astrologyapi-western-daily-transits-v2` para regenerar payloads diarios con la nueva voz.
- **Por qué:** alinear la salida dinámica con la guía de voz Órbita: hablarle a la persona, no del tema, y evitar copy abstracto/impersonal.
- **Quién lo pidió:** frontend.
- **Estado:** implementado.

## 2026-07-06 — Tránsitos diarios live con AstrologyAPI
- **Qué cambió:** `transits.getToday({ localDate })` pasa de query cache-only a action autenticada provider-backed. Si existe cache `astrologyapi-western-daily-transits-v1`, devuelve el payload público actual; si no, llama `natal_transits/daily`, normaliza aspectos/ventanas (`startTime`, `exactTime`, `endTime`), persiste `transitReadings`, actualiza/crea `dailyReadings` con `orbita-daily-editorial-p0-v1`, y no guarda raw/request en tablas app-facing.
- **Por qué:** desbloquear Home diaria y pantalla de tránsitos con tránsitos personales reales contra la carta/birth data guardada.
- **Quién lo pidió:** frontend.
- **Estado:** implementado.

## 2026-07-06 — Carta natal live con AstrologyAPI
- **Qué cambió:** `charts.calculateOrCreateNatalChart()` deja de crear el stub y pasa a ser una action provider-backed: lee el `birthData` vigente, calcula la carta natal con AstrologyAPI usando coords/timezone reales, persiste en `natalCharts`, actualiza `profileAstrologyCaches`, y `charts.current()` sigue devolviendo el chart persistido. El payload usa `orbita-astrologyapi-western-v1`; para hora desconocida no devuelve ascendente ni casas.
- **Por qué:** desbloquear `/carta?live=1` con Sol/Luna/Asc y placements reales después de que onboarding guarda lat/lon/timezone desde `places.resolve`.
- **Quién lo pidió:** frontend.
- **Estado:** implementado.

## 2026-07-06 — Location API via `geo_details`
- **Qué cambió:** `places.resolve({ query })` mantiene la misma firma, pero el adapter de AstrologyAPI ahora envía `place` a `ASTROLOGY_API_LOCATION_URL`, soporta respuestas `geonames`, normaliza `place_name`, `latitude`, `longitude` y `timezone_id`, usa `ASTROLOGY_API_KEY` para el header `x-astrologyapi-key` con `ASTROLOGY_API_LOCATION_KEY` como override opcional, usa MCP `geo_details` primero para evitar que Convex pierda el body REST, manda `maxRows: 10` como número, y hace fallback para queries con coma como `Buenos Aires, Argentina`.
- **Por qué:** conectar onboarding/lugar real al shape confirmado por el MCP de AstrologyAPI sin cambiar el contrato frontend ni duplicar configuración cuando la sandbox/API key sirve para Location.
- **Quién lo pidió:** backend.
- **Estado:** implementado.

## 2026-07-05 — Seed QA Web B0 autenticado
- **Qué cambió:** se agrega `webB0Seed.persistCurrentUserSnapshot({ localDate, timezone, birthData, chartPayload, dailyReadingPayload, markPlus? })`, una mutación pública restringida por allowlist de backoffice. Persiste snapshots QA para el usuario autenticado en `birthData`, `natalCharts`, `dailyReadings`, `transitReadings` y opcionalmente `subscriptions`; sanitiza `raw` y `request` antes de escribir payloads app-facing. `charts.current()` ahora devuelve la carta vigente más reciente.
- **Por qué:** permitir que Claude pruebe Web B0 en modo live con la cuenta QA sin exponer raw del proveedor ni depender de mocks.
- **Quién lo pidió:** frontend + backend.
- **Estado:** implementado.

## 2026-07-05 — Funciones Web B0 para modulos post-Home
- **Qué cambió:** se implementan las funciones publicas `charts.valuesMap()`, `charts.personalityReading()`, `transits.getToday({ localDate })` y `places.resolve({ query })`. No agregan tablas nuevas: `charts.*` derivan de `natalCharts.payload`, `transits.getToday` lee `transitReadings` y cae a `dailyReadings.payload`, y `places.resolve` usa el adapter server-side de AstrologyAPI sin devolver raw provider.
- **Por qué:** desbloquear las pantallas Web B0 ya disenadas por frontend: Mapa de valores, Horoscopo de personalidad, Transito en el espacio y geocoding real de entrada de datos.
- **Quién lo pidió:** frontend.
- **Estado:** implementado.

## 2026-07-05 — Cache mobile, rueda natal y radar de valores
- **Qué cambió:** `convex/schema.ts` agrega caches persistentes para app mobile: `profileAstrologyCaches`, `natalInterpretations`, `dailyLlmReadings`, `transitTimelineCaches` y `globalSkyCaches`; además extiende `natalCharts`, `dailyReadings` y `transitReadings` con campos opcionales de cache/version/provider. `publicLab.previewDailyHome(args)` y `publicLab.previewCompleteHoroscope(args)` ahora devuelven `chartWheelData` y `valueRadar`. `previewCompleteHoroscope(args)` también devuelve `editorialGeneration` versionado para Gateway y `longRangeTimeline` con estado `needs_provider_endpoint`.
- **Por qué:** preparar el contrato real para una app móvil con persistencia por perfil, renderer visual de carta natal en frontend, radar calculado en backend y timeline largo basado en proveedor/API, no en texto inventado.
- **Quién lo pidió:** producto/backend.
- **Estado:** implementado.

## 2026-07-05 — Public-dev AI Gateway y timeline extendido
- **Qué cambió:** se agrega `publicLab.previewLlmHome(args)` y `publicLab.previewTransitTimeline(args)`. `previewDailyHome(args)` acepta `llmEnabled?`. `previewCompleteHoroscope(args)` acepta `llmEnabled?`, `includeTimeline?`, `includeNatalWeekly?`, `includeTropicalWeekly?` e `includeTropicalMonthly?`, y puede devolver bloques `llm` y `timeline`. El timeline público normaliza eventos con `startTime`, `exactTime`, `endTime`, planeta transitante, punto natal, aspecto, casa, prioridad y `displayText`; no devuelve raw completo. La capa LLM usa Vercel AI Gateway server-side con tags `feature:orbita-lab`, `env:dev`, `user:lab`, y cae a templates determinísticos con gaps explícitos si Gateway está deshabilitado, falta config o falla.
- **Por qué:** probar en `/lab` copy editorial generado por Órbita y próximos tránsitos sin mover todavía el backend a Vercel ni persistir runs públicos.
- **Quién lo pidió:** producto/backend.
- **Estado:** implementado.

## 2026-07-05 — Public-dev complete horoscope profile
- **Qué cambió:** se agrega `publicLab.previewCompleteHoroscope(args)`. Recibe el mismo input público-dev que `previewDailyHome` y devuelve un mapa completo por perfil con bloques `identity`, `natalChart`, `daily`, `currentSky`, `future` y `extras`, fuente A/B/C/dataset, estado por feature, entitlement, faltantes backend, plan de cache, política de raw, `dailyHome`, gaps y estado provider. No persiste datos y no devuelve raw completo de AstrologyAPI.
- **Por qué:** poder cargar una persona en `/lab` y ver todo lo que Órbita necesitará conseguir/generar para un horóscopo completo antes de conectar dailies reales por usuario.
- **Quién lo pidió:** producto/backend.
- **Estado:** implementado.

## 2026-07-05 — Public-dev Home Lab
- **Qué cambió:** se agrega `publicLab.previewDailyHome(args)` y `publicLab.resolvePlace({ query, accessKey? })`. `previewDailyHome` acepta datos natales/manuales y devuelve una salida pública-dev tipo Home diaria sin sesión: header, base natal, tránsito destacado, `Hacé` x3, `Evitá` x3, acción, pregunta, topics, lectura larga, Void/Future Self, traza de personalización, gaps, versiones y estado provider. Ambas acciones requieren `ORBITA_PUBLIC_LAB_ENABLED=true`; si `ORBITA_PUBLIC_LAB_KEY` está definido, también exigen `accessKey`.
- **Por qué:** levantar `/lab` como web rápida para probar inputs natales y resultados de Home sin ensuciar `/backoffice` ni persistir datos.
- **Quién lo pidió:** producto/backend.
- **Estado:** implementado.

## 2026-07-05 — Home diaria P0 y draft remoto
- **Qué cambió:** se agrega `home.getDaily({ localDate })`, `home.generateDaily({ localDate, timezone })` y `onboarding.getDraft({ clientDraftId? })`. `home.*` devuelve un `DailyHomeReading` P0 para Claude: header diario, base natal visible, tránsito destacado, `Hacé` x3, `Evitá` x3, energía, acción, pregunta, topics, long read, Void preview, personalization trace, `modelGaps`, versiones y `reviewStatus`.
- **Por qué:** crear el primer puente backend/frontend para Home/App Core sin adaptar el contrato al `DailyReading` local heredado ni exponer raw/provider payloads.
- **Quién lo pidió:** frontend + backend.
- **Estado:** implementado.

## 2026-07-04 — Inicio del changelog de contrato
- **Qué cambió:** se establece este registro. El contrato vigente es el `convex/schema.ts` actual (tablas: `users`, `onboardingDrafts`, `birthData`, `natalCharts`, `dailyReadings`, `transitReadings`, `savedReadings`, `journalEntries`, `relationshipProfiles`, `notificationPreferences`, `devices`, `subscriptions`, `labSubjects`, `labRuns`, `contentModules`) más las firmas de las funciones públicas existentes.
- **Por qué:** arrancar el flujo multi-agente con un punto de partida explícito.
- **Quién lo pidió:** —
- **Estado:** implementado.

## 2026-07-05 — Funciones para la Web B0 (pantallas de módulos)
- **Qué cambió:** el front (Web B0) necesita 4 funciones públicas que todavía no existen, para alimentar las pantallas de diseño ya construidas en Figma. Formas de payload declaradas en `src/services/appRefs.ts` (`proposedApi`) y mapeo en `docs/web-b0-backend-map.md`:
  - `charts.valuesMap(): ValuesMapPayload` — radar de valores (8 ejes armonía/tensión) derivado de la carta natal. Alimenta la pantalla *Mapa de valores*.
  - `charts.personalityReading(): PersonalityReadingPayload` — secciones editoriales por posición (planeta en signo/casa) + disclaimer. Alimenta *Horóscopo de personalidad*. Requiere banco editorial.
  - `transits.getToday({ localDate }): TransitDetailPayload` — detalle del tránsito destacado (escena, frase por fragmentos, frecuencia/timeline, efecto en la tierra, ventana). Extiende `PublicDailyHome.transits`. Alimenta *Tránsito en el espacio*.
  - `places.resolve({ query }): PlaceLookup` — geocoding + timezone real para el onboarding (hoy sólo existe `publicLab.resolvePlace` para el lab). Alimenta *Entrada de datos*.
- **Por qué:** conectar las pantallas B0 con datos reales derivados de la carta natal; hoy el diseño está listo pero no hay función que lo alimente.
- **Quién lo pidió:** frontend (Claude).
- **Estado:** propuesto (stub). Ver bloque `// TODO: pendiente backend — Web B0` en `convex/schema.ts`. Front trabaja contra mocks tipados hasta que existan.

## 2026-07-05 — Funciones para el App Core V4.7 (Vínculo + Calendario)
- **Qué cambió:** el App Core (5 tabs + detalles, código en `feature/web`, diseño Figma `UX V4.7 - Órbita App Core Flows`) necesita 3 funciones nuevas. Formas de payload en `src/services/appCoreRefs.ts`; mapeo pantalla→función en `docs/app-core-backend-map.md`:
  - `relationships.add({ name, birthDate, birthTime?, birthPlaceLabel? }): { relationshipProfileId }` — alta de la otra persona (usa tabla `relationshipProfiles` existente). Alimenta *Vínculo / Agregar persona*.
  - `relationships.synastry({ relationshipProfileId }): SynastryPayload` — energía comparada entre dos cartas (Fluye/Fricciona/Energía/Acción + overview). Requiere banco editorial de sinastría; sin promesas de resultado. Alimenta *Vínculo / Overview* y *Resultado*.
  - `calendar.getMonth({ month }): CalendarMonthPayload` — grilla mensual (tono de energía + días intensos) + capa lunar (fase/signo/acción). Motor por rango de fechas + timezone. Alimenta *Fase lunar / Calendario*.
- **Nota:** el resto del App Core ya mapea a funciones existentes/propuestas en Web B0: Inicio→`readings.getToday`, Carta→`charts.current`, Tránsitos→`transits.getToday`, Perfil→`users.current`/`subscriptions.getCurrent`.
- **Por qué:** conectar las pantallas del app core (hoy contra mock tipado en `src/domain/appData.ts`) con datos reales derivados de la carta natal + tránsitos.
- **Quién lo pidió:** frontend (Claude).
- **Estado:** propuesto (stub). Ver bloque `// TODO: pendiente backend — App Core V4.7` en `convex/schema.ts`. Front trabaja contra `appData.ts` hasta que existan.

## 2026-07-06 — Función para El Vacío (app nativa)
- **Qué cambió:** la pantalla Void del app core (3 momentos: Entrada → Escuchando → Respuesta, `app/reading/void.tsx`) necesita una función que responda la pregunta diaria del usuario. Forma de payload en `src/services/appRefs.ts` (`proposedApi.voidAsk`, `VoidAnswerPayload`):
  - `void.ask({ question }): VoidAnswerPayload` — `{ question, answer, basadoEn[], mejorPregunta, paso }`. Deriva de carta natal + tránsitos del día; `basadoEn` lleva los placements reales usados (ej. "TU LUNA EN SAGITARIO"). Límite de producto: una pregunta por día por usuario.
- **Guardrails duros:** el Vacío NUNCA contesta sí o no; devuelve marco + una mejor pregunta + un paso concreto; sin claims de destino/salud/dinero/legal (ver AGENTS.md y `docs/home-contenidos-personalizados.md` §6).
- **Por qué:** el flujo ya está implementado en nativo contra respuesta de maqueta; falta el generador real.
- **Quién lo pidió:** frontend (Claude).
- **Estado:** propuesto (stub). Ver bloque `// TODO: pendiente backend — El Vacío` en `convex/schema.ts`.
