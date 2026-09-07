# Contrato de eventos de Órbita — v1.0.0

Este documento define qué es un evento válido de Órbita. Es el diccionario
canónico: si algo no está acá, no es un evento del producto y no se emite. Si
estás por agregar, cambiar o leer una medición, empezá por acá.

Hasta ahora Órbita no tenía contrato de medición. Ningún documento decía qué
evento era válido, con qué propiedades ni bajo qué regla de identidad y
privacidad, así que cualquier número que sacáramos era imposible de defender: no
había forma de distinguir un dato bien medido de uno inventado por una pantalla
distraída. Este contrato existe para que esa pregunta tenga una sola respuesta.

- **Versión:** `1.0.0` (viaja en cada evento como `contract_version`).
- **Versión ejecutable:** `src/analytics/eventContract.ts` — mismos nombres,
  mismos literales, con funciones puras de validación.
- **Tests:** `test/analyticsEventContract.test.ts`.
- **Alcance:** qué se mide y cómo se nombra. Este contrato **no** toca el SDK, la
  captura real ni la configuración de PostHog o Vercel.

Órbita es un producto de entretenimiento y autoconocimiento. Este contrato mide
uso del producto: pantallas, activación y compra. No mide, no nombra y no
transporta contenido natal.

---

## 1. Principios

1. **Lista cerrada.** Los eventos válidos son cinco. Nada más.
2. **Nada de texto libre.** Toda propiedad tiene un enum o un formato estricto.
   No hay una sola propiedad donde alguien pueda escribir una frase.
3. **Allowlist, no denylist.** Una propiedad que no está declarada se rechaza.
   No hace falta prever cada dato peligroso: alcanza con no permitirlo.
4. **Sin PII, nunca.** Ni en el nombre de la propiedad, ni en su valor, ni
   escondida adentro de una ruta.
5. **Verificable.** Todo lo que dice este documento se puede correr: el
   validador es un módulo puro y los tests lo prueban sin red ni entorno.

---

## 2. Propiedades comunes obligatorias

Estas cinco viajan en **todos** los eventos. No hay evento sin ellas.

| Propiedad | Valores | Quién la resuelve |
|---|---|---|
| `environment` | `production` \| `preview` \| `development` | El scope o la configuración de despliegue |
| `platform` | `web` \| `ios` \| `android` | La superficie que emite |
| `surface` | `landing` \| `onboarding` \| `app` \| `paywall` \| `checkout` | La superficie que emite |
| `section` | `hoy` \| `transitos` \| `vinculos` \| `umbral` \| `carta` \| `sin_seccion` | La navegación |
| `contract_version` | `1.0.0` | Este contrato |

### `environment` sale del scope, nunca del hostname ni del proyecto

El entorno lo define **este contrato**, leyendo el scope o la configuración de
despliegue. Nunca se infiere del hostname (se rompe con cada dominio nuevo y con
cada preview) ni del proyecto de destino (invierte la relación: el proyecto se
elige por el entorno, no al revés). Si el valor que llega no es uno de los tres
literales, no hay entorno: `normalizeEnvironment` devuelve `null` y el evento no
sale.

### `surface`: por qué cinco y no quince

`surface` contesta "qué pedazo del producto emitió esto", y está partida por
tramos con dueño y métrica propios:

- `landing` — lo público, sin sesión.
- `onboarding` — el alta, hasta que la carta queda disponible.
- `app` — el producto autenticado, con su navegación canónica.
- `paywall` — la oferta.
- `checkout` — el cobro.

La conversión se lee justo como el salto entre superficies (`app` → `paywall` →
`checkout`). Si partís `surface` por pantalla, el embudo se vuelve ilegible y
cada pantalla nueva pasa a ser un cambio de contrato. Si la unificás más, el
embudo desaparece.

### `section`: las cinco de CORE-113, más la ausencia explícita

Las secciones canónicas de la web son las que fijó CORE-113: `hoy`, `transitos`,
`vinculos`, `umbral` y `carta`. El Perfil **vive dentro de `carta`**: no es una
sección propia y no tiene valor propio.

`sin_seccion` es el sexto valor y es obligatorio para todo lo que pasa fuera de
esa navegación (landing, onboarding, paywall, checkout). Como la propiedad es
obligatoria en todo evento, la ausencia también tiene que ser un valor del enum:
un vacío, un `null` o un `"-"` serían texto libre por la puerta de atrás.

De ahí sale una regla de coherencia que el validador aplica: `surface: app` exige
una de las cinco secciones canónicas, y cualquier otra `surface` exige
`sin_seccion`. Un `paywall` en la sección `carta` sería una contradicción, y una
contradicción medida es un número que después nadie sabe leer.

---

## 3. Los cinco eventos

Para cada uno: qué contesta, qué lo dispara, qué **no** lo dispara y qué
propiedades exige. El no-disparador no es decorativo: sin él, un evento se
estira solo hasta contar cualquier cosa parecida.

### `$pageview`

- **Contesta:** visitas — retención sobre identidad estable, adquisición por
  fuente.
- **Dispara:** una vista queda montada con su ruta definitiva, tanto en la carga
  inicial como en cada cambio de ruta de la SPA.
- **No dispara:** un re-render; un cambio de query o de fragmento sin cambio de
  ruta; una redirección intermedia; un estado de carga previo a la ruta
  definitiva.
- **Propiedades:** las cinco comunes + `path` + `acquisition_source`.

`$pageview` es el **único** evento canónico de navegación, en web y en SPA. Es el
nombre que el SDK ya entiende y sobre el que se calculan visitantes únicos sin
que tengamos que reimplementar nada.

### `onboarding_completed`

- **Contesta:** activación — la persona llegó a tener producto.
- **Dispara:** el alta termina y la carta queda disponible por primera vez para
  esa cuenta.
- **No dispara:** empezar el alta; avanzar un paso; cargar los datos natales sin
  confirmarlos; volver a entrar a una cuenta que ya lo había completado.
- **Propiedades:** las cinco comunes.

### `paywall_viewed`

- **Contesta:** conversión, paso 1 — la oferta se vio de verdad.
- **Dispara:** la paywall queda visible con su oferta real ya cargada.
- **No dispara:** montarla en estado de carga o de error; un bloque bloqueado que
  sólo invita a la oferta; un re-render de la misma impresión.
- **Propiedades:** las cinco comunes.

### `checkout_started`

- **Contesta:** conversión, paso 2 — intención declarada de pagar.
- **Dispara:** la persona confirma avanzar al cobro y se abre el checkout.
- **No dispara:** elegir un plan sin confirmar; abrir la paywall; un reintento
  automático del mismo intento ya contado.
- **Propiedades:** las cinco comunes.

### `purchase_completed`

- **Contesta:** conversión, paso 3 — el cobro se confirmó.
- **Dispara:** el cobro vuelve confirmado y el acceso queda otorgado.
- **No dispara:** un cobro pendiente, en prueba gratuita sin cargo, fallido o
  reembolsado; una renovación automática posterior; volver a abrir la pantalla de
  compra exitosa.
- **Propiedades:** las cinco comunes.

### Por qué ninguno lleva propiedades propias además de esas

En v1.0.0 no hay propiedades opcionales. `purchase_completed` no lleva monto ni
plan, y no es un olvido: agregar una propiedad compatible es un cambio **minor**
y se puede hacer cuando haya una decisión que dependa de ese dato. Sacar una
propiedad que ya se prometió es un cambio **major**. Empezar mínimo es la única
de las dos puertas que se puede abrir barato.

---

## 4. `page_view`: legado excluido

`page_view` (con guion bajo) es data histórica. **Queda fuera del diccionario
v1**, en modo sólo lectura:

- **no se migra** — reescribir el pasado no lo vuelve comparable;
- **no se borra** — sigue sirviendo para consultar lo que ya pasó;
- **no se reetiqueta** — mezclaría dos definiciones distintas de "visita" en la
  misma serie;
- **no hay doble emisión** — contaría cada visita dos veces;
- **no hay traducción intermedia** — una capa que convierte un nombre en otro es
  exactamente el lugar donde después nadie sabe qué se está midiendo.

Lo que se hace con `page_view` es consultarlo cuando hace falta mirar atrás, y
saber que la serie nueva arranca con `$pageview`. El validador lo rechaza con un
código propio (`legacy_event`) para que el error diga *por qué* y no sólo "no
existe".

---

## 5. `path` y `acquisition_source`

### `path`: plantilla de ruta, sanitizada antes de salir del dispositivo

`path` no lleva query, ni fragmento, ni identificadores dinámicos, ni PII. Lleva
la **plantilla**: `/reading/:id`, no `/reading/8f2c-...`.

Sanitizar en el borde, antes de que el dato salga del dispositivo, es lo único
que funciona: una vez que la URL cruda llegó a un sistema de analítica, ya está
ahí. Un id dentro de una ruta es PII de hecho (identifica a una persona o a su
contenido) y además hace explotar la cardinalidad de cualquier métrica.

Se valida por **forma**, no contra una lista de rutas: si el contrato de medición
dependiera del mapa de navegación, cada ruta nueva sería un cambio de contrato.
Si dudás de una ruta, pasala por `isSanitizedPath` y listo.

Válidas: `/`, `/home`, `/reading/:id`, `/reading/carta-completa`, `/checkout/success`.

Rechazadas: `/home?utm_source=x` (query), `/home#seccion` (fragmento),
`/reading/42` y `/reading/8f2c1a9b-...` (id crudo), `/perfil/alguien@example.com`
(PII), `https://orbitaastrologia.xyz/home` (URL absoluta).

Los grupos de expo-router (`(tabs)`) no existen en la URL pública, así que
tampoco existen acá.

### `acquisition_source`: medir la fuente sin guardar la URL

Seis valores: `direct`, `organic_search`, `social`, `referral`, `paid`,
`unknown`.

La normalización recibe una **clase de referrer ya clasificada**, no una URL. El
referrer crudo se clasifica en el borde —el único lugar que lo ve— y se descarta
ahí mismo; nunca entra al módulo del contrato, nunca se guarda y nunca viaja en
una propiedad.

| Clase de referrer | `acquisition_source` |
|---|---|
| `none` (sin referrer) | `direct` |
| `internal` (navegación dentro del sitio) | `direct` |
| `search_engine` | `organic_search` |
| `social_network` | `social` |
| `external_site` | `referral` |
| `paid_campaign` | `paid` |
| `unclassified` | `unknown` |

`unknown` es parte del enum a propósito: sin él, lo que no se puede clasificar se
cuela como `direct` y la métrica de adquisición miente en silencio. Y si alguien
le pasa por error la URL cruda en vez de la clase, el resultado es `unknown`: la
URL no sobrevive a la llamada.

---

## 6. Mapa de métricas (para CORE-190)

| Métrica | Cómo se calcula con este contrato |
|---|---|
| **Activación** | `onboarding_completed` |
| **Conversión** | La secuencia `paywall_viewed` → `checkout_started` → `purchase_completed` |
| **Retención** | Identidad estable sobre `$pageview` |
| **Adquisición** | Visitantes únicos por `acquisition_source` |

Los cinco eventos existen por estas cuatro preguntas, y no hay una quinta
pregunta esperando un sexto evento. Si te aparece una, no la metas de prepo:
entra por la regla de evolución de la sección 10.

---

## 7. Identidad

1. **Distinct ID anónimo estable del SDK, desde la primera visita.** No se
   regenera, no se pisa, no se reemplaza por uno propio. Es lo que permite que
   una visita anónima de hoy y la cuenta de mañana sean la misma persona.
2. **`identify` sólo con un identificador interno estable.** Nunca email, nunca
   nombre, nunca fecha ni lugar de nacimiento, nunca ningún otro dato personal.
   Un identificador viaja a un sistema de analítica y se queda ahí: tiene que ser
   opaco, un dato que no signifique nada fuera de nuestra base.
3. **`reset` es obligatorio** en logout, en cambio de cuenta y en eliminación,
   **antes** de las capturas siguientes. Sin reset, el distinct ID de una persona
   queda pegado a los eventos de la siguiente: dos cuentas fusionadas en un
   perfil, sin forma limpia de deshacerlo.
4. **`alias` sólo si existe un segundo identificador estable, real y distinto**
   que haya que vincular. En el flujo normal no hay nada que aliasar: el distinct
   ID anónimo ya viene del SDK y `identify` lo vincula. `alias` usado de rutina
   es la forma más rápida de arruinar un proyecto de analítica.

---

## 8. Privacidad y consentimiento

- **Sin captura antes del consentimiento aplicable.** "Todavía no contestó" es un
  no: mientras no haya respuesta, no se emite.
- **El retiro detiene la captura y resetea el contexto.** Dejar de capturar sin
  resetear conservaría justo el vínculo que la persona acaba de retirar.
- **Allowlist de propiedades.** Sólo las declaradas en este documento. Está
  explícitamente prohibido: PII de cualquier tipo, textos libres, contenido
  natal, y query, fragmento o referrer crudo.
- **Las rutas se sanitizan antes de salir del dispositivo** (sección 5).

Sobre el contenido natal: es el dato más sensible que maneja Órbita y **no es una
propiedad de ningún evento**. No se mide qué dice la carta de nadie. Se mide que
una pantalla se vio.

---

## 9. Separación de proyectos (heredada de CORE-182)

| `environment` | Proyecto PostHog |
|---|---|
| `production` | `517300` |
| `preview` | `592867` |
| `development` | `592867` |

`environment` lo define **este contrato**, usando el scope. No se mezcla y no se
infiere el entorno a partir del proyecto: el proyecto es el destino, no la
fuente de verdad. Que `preview` y `development` compartan proyecto es
exactamente la razón por la que hace falta la propiedad: sin ella, adentro de
`592867` no se pueden separar.

Esto está documentado acá, y sólo documentado: **este contrato no toca el SDK ni
la configuración**. Aplicarlo es trabajo de otra tarjeta.

---

## 10. Evolución y versionado

Dentro de una versión, los nombres y la semántica son **inmutables**. Un evento
que cambia de significado sin cambiar de nombre rompe toda serie histórica que lo
use, en silencio y hacia atrás.

| Cambio | Versión |
|---|---|
| Agregar un evento compatible | **minor** (`1.1.0`) |
| Agregar una propiedad opcional compatible | **minor** |
| Una aclaración que no cambia el comportamiento | **patch** (`1.0.1`) |
| Renombrar un evento o una propiedad | **major** (`2.0.0`) |
| Eliminar un evento o una propiedad | **major** |
| Volver obligatoria una propiedad que no lo era | **major** |

Toda deprecación es **explícita**: se anuncia, se anota acá con su fecha y
conserva una ventana de consulta. Nada se apaga de un día para el otro y nada
desaparece sin dejar dicho dónde quedó su data. Antes de tocar un nombre,
fijate en qué fila de esta tabla cae el cambio que tenés en la mano.

El validador acepta **exactamente** `1.0.0`. Una minor futura puede traer eventos
que este código no conoce: aceptarla sería afirmar algo que no se puede
verificar. El contrato se lee junto con el código que lo implementa.

---

## 11. Qué no cubre este contrato

Fuera de alcance, a propósito: el SDK y la captura real, restaurar tracking,
recorridos, dashboards, insights, alertas, feature flags, y cualquier cambio en
PostHog o en Vercel.

La telemetría interna de producto que corre sobre Convex
(`docs/handoff-claude-product-events.md`) es un canal distinto y anterior: no la
regula esta v1 y no se mezcla con ella.
