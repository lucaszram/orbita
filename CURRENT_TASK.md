# Current Task

## Vínculos — la primera persona y su comparación real (CORE-212, 2026-09-06)

**Objetivo:** que Vínculos deje de ser «Próximamente»: alta de la primera
persona en tres pasos (nombre y tipo, nivel signo / fecha / carta, datos por
nivel con buscador de lugar), persistencia del perfil con su carta calculada en
el alta, y la comparación real entre las dos cartas en móvil y escritorio según
el carril de Vínculos del tablero `02 · WEB — PARIDAD PROPUESTA`.

**Contrato (aditivo):** `relationships.addPerson` (action) y
`relationships.synastry` (query reactiva, sobre con `status`). Motor puro en
`convex/lib/synastry.ts`. **Desvío de alcance declarado:** la ficha excluía
`convex/schema.ts`, pero una query no puede llamar al proveedor, así que la carta
de la persona se calcula en la action y se persiste: `relationshipProfiles` suma
campos opcionales con los nombres que ya usa `release/1.0.0`. Los nombres de
función evitan `savePerson` / `getComparison` de esa línea a propósito.

**Decisiones:** nivel `fecha` acepta hora sólo junto con lugar (una hora sin
zona no se puede ubicar; no se descarta en silencio); nivel `signo` lee el tono
por elementos con `signEs` (el `sign` del proveedor viene en inglés); Free ve
tres contactos y cuántos faltan, los conteos no se recortan; el CTA de Plus va a
`/paywall`.

**Estado:** rama `orb/core-212-primera-comparacion`, PR #90, revisión
independiente r1 rechazada por dos bloqueos (tono con signo en inglés; hora
descartada en nivel fecha), ambos corregidos junto con los laterales; segunda
ronda pendiente. Backend sincronizado en Convex dev `beaming-lobster-442`.
Producción bloqueada por la divergencia `main` / `release/1.0.0` (ver Linear).

## Umbral Tarot — el ritual sin la regla ni el rótulo repetidos (CORE-131, 2026-09-02)

**Objetivo:** ocultar en el Umbral la regla superior y el rótulo
`TU CARTA DE HOY` que `CartaDelDia` dibuja para sí: ahí partían al medio una
sección que ya se encabeza con `EL UMBRAL · TAROT` y repetían lo mismo. Home y
nativo no se ven afectados.

**Implementación:** `CartaDelDia` suma la prop `variant`, con `section` por
default —la presentación de siempre, regla superior más eyebrow— y `embedded`
usada únicamente por `src/components/web/umbral-tarot.tsx`, que monta sólo el
ritual. Gesto, copy, estados y contenido quedan iguales, y la regla sigue en el
componente para la variante por default. `test/umbralTarotWiring.test.ts` suma
regresiones: el Umbral pasa `variant="embedded"`, `embedded` es lo único que
apaga esos dos elementos y la Home no opta por ocultar nada.

**Verificación independiente:** en verde `pnpm typecheck`, suite completa
**1077/1077**, `pnpm build:web` fresco y `pnpm check:web-export` con 31,99 MB de
export, imagen máxima 479,3 KB y JS gzip 980,4 KB; `git diff --check` limpio.

**Estado remoto:** el arreglo funcional quedó en el commit `634ec65` y está
pusheado a la rama `orb/core-131-umbral-tarot-web`, la de la PR 85. La validación
terminó exitosa en GitHub, en Vercel Preview Comments y en los dos Previews de
Vercel, `orbita` y `horoscopo`. La PR está abierta, no es draft y GitHub la
reporta `MERGEABLE` / `CLEAN`.

**Pendiente:** la verificación visual del estado Free 7/7 en el Umbral no se
ejecutó. No existe fixture ni modo local que lo reproduzca, y prepararlo exigiría
una mutación externa en Convex Development que no está autorizada. Dada la
instrucción de Lucas de dejar la PR lista para que él la mergee, y dado que esa
verificación estaba condicionada a que existiera una vía segura, no se hizo
ninguna mutación: queda registrada como pendiente y no bloquea este handoff.

**Alcance:** producción, cuentas y datos siguen intactos. El merge lo hará Lucas.

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

## Estado vigente — 2026-07-16

Esta sección es la fuente de verdad actual. El contenido posterior queda como historial y contexto técnico.

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
