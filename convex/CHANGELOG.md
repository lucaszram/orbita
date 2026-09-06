# Contrato — CHANGELOG

## 2026-09-06 — Tu momento abre la estación vital: `momento.getEstacionVital` (CORE-209)

- **Qué cambia (aditivo):** nueva action pública `momento.getEstacionVital({ localDate })`. Devuelve **siempre** un sobre con `status`: `locked` (Free: la capa es Plus, no se calcula nada) o `ready` con `estacion`, que a su vez declara su propio `status`: `ready` (fase certificada), `partial` (sin hora exacta y el día natal cruza un límite de fase: se publican `possiblePhases`, nunca una elegida), `needs_birth_data`, `needs_birth_time`, `unavailable` (proveedor o raíces no confirmadas) y `not_configured`. `transits.*` no cambia.
- **Método:** progresiones secundarias (un día de efemérides por año tropical) sobre la elongación Sol–Luna progresada; ocho fases de 45°, ciclo de ~30 años. Es el método de la línea `release/1.0.0` (`progressedLunationBuild`), reescrito en `convex/lib/estacionVital.ts` sobre una función inyectable de efemérides para poder probarlo sin red; la matemática (`convex/lib/layersMath.ts`) y la resolución de hora civil (`convex/lib/civilTime.ts`) se portaron **tal cual** de esa línea, y el cliente de `planets/tropical` (`convex/lib/tropicalEphemeris.ts`) también, para que una reconciliación no encuentre dos versiones.
- **Qué publica `estacion` en `ready`:** `precision` (`exact` con hora natal exacta; `range` sin ella), `phaseKey` (`new` · `crescent` · `first_quarter` · `gibbous` · `full` · `disseminating` · `last_quarter` · `balsamic`), `name`, `progressedElongationDegrees` (+ `progressedElongationRangeDegrees` sin hora), `ageYears`, `phaseStartedAt` / `nextPhaseAt` (+ `*Range` sin hora), `phaseYears`, `yearsIntoPhase`, `progress` y `limitations`.
- **Qué NO se inventa:** sin hora exacta se muestrean tres horas del día natal y sólo se afirma una fase si las tres caen en la misma y lejos del límite; las fechas de inicio y de la próxima fase se refinan buscando el cruce del límite en muestras reales del proveedor (cinco llamadas por cálculo con hora exacta) y, si no se pueden acotar, el dato se retira. Ningún resultado se estima por movimiento medio.
- **Cache (schema aditivo):** tabla `momentoAnalyses { userId, localDate, kind, version, inputHash, payload }` con índice `by_user_date_kind`: una fila por persona, día y capa; `inputHash` (fecha, hora, precisión, zona, coordenadas natales) invalida el cache al cambiar los datos. Se guardan `ready`, `partial` y `needs_birth_time`; un fallo del proveedor no se cachea. Las capas 02 (tema del año) y 03 (cuatro ritmos) reutilizarán la misma tabla (CORE-210/211).
- **Desvíos declarados respecto de release:** sin hora exacta el sobre publica `status: "ready"` + `precision: "range"` con rangos (`*Range`) en vez de `partial` + `estimated` con una cifra de incertidumbre en meses; y `possiblePhases` usa los nombres editoriales (`Nueva`, `Gibosa`) en vez de las etiquetas geométricas (`Luna nueva`, `Gibosa creciente`), para que coincidan con la pantalla. El sobre `ready` suma `timezone` (la zona natal) para escribir las fechas de borde en ella.
- **Front:** Tránsitos suma el segmento «Tu momento» (hub con la capa 01 real y las capas 02/03 declaradas pendientes, sin cifras estimadas) y la ruta `/reading/estacion-vital` con la copy de Build 30 (`src/domain/momento.ts`, portada de `release/1.0.0`).

## 2026-09-06 — Vínculos conserva las personas guardadas (CORE-213)

- **Qué cambia (aditivo):** `relationships.listPeople({})` (query reactiva) devuelve `{ people, activeId }`: todas las personas guardadas de la cuenta —sólo datos autorizados: nombre, tipo, nivel, signo, fecha, hora si se guardó, lugar, `chartStatus`, `isActive`, `savedAt`— de la más reciente a la más antigua. `relationships.selectPerson({ profileId })` (mutation) deja activa a una persona propia; no calcula nada. `relationships.synastry` acepta `profileId?` para abrir la comparación de una persona concreta; sin él sigue usando la activa. `addPerson` acepta `profileId?` para editar a una persona guardada (reemplazo completo de la fila, como antes al reemplazar a la activa).
- **Cambio de comportamiento de `addPerson` sin `profileId`:** ya no reemplaza a la activa: crea una persona nueva y la deja activa; las demás siguen guardadas con `isActive: false`. `by_user_active` sigue apuntando a una sola. El cupo Free queda para CORE-214: hasta entonces la biblioteca no limita.
- **Por qué:** la ficha pide una biblioteca observable sobre `relationshipProfiles` (índice `by_user`), sin duplicar datos en el cliente, y que cada persona abra su comparación existente sin generar otra por navegar. La comparación es una derivación pura sobre las cartas ya guardadas (`computeSynastryContacts`), así que elegir a alguien no llama al proveedor.
- **Front:** `/vinculo` muestra la biblioteca (frames `2092:2975` / `1757:2475`): filas por persona, «Tu vínculo con X» con `resumenDeVinculo` y la barra por tono, «Nivel de datos» y las acciones agregar / editar; `/reading/vinculo-result?id=<profileId>` abre la comparación de esa persona (`perfilIdValido`), sin id la activa. Un id ajeno responde `no_person`.

## 2026-09-06 — Tránsitos ordena el cielo de hoy: `transits.getPanorama` (CORE-207)

- **Qué cambia (aditivo):** nueva action pública `transits.getPanorama({ localDate })`. Devuelve **siempre** un sobre con `status`: `ready` (con `rows`, `count`, `activeTotal`, `cadence: "Cambia a diario"` y `access`), `empty` (la lectura del día no tiene contactos dentro de orbe) o `locked` (Free: el ranking se calcula con la carta y es Plus; **no** viaja la lista). `getToday` y `getDetail` no cambian.
- **Misma fuente:** el panorama sale de la MISMA lectura persistida del día que alimenta `getToday` y `getDetail` (`resolveTodayReading`), así que cada fila lleva el `transitId` que `getDetail` acepta —`rankedTransits` con identidad guardada en lecturas nuevas; en documentos anteriores se reconstruye la selección y la identidad legacy (`listRankedTransits`)—. Ninguna fila se calcula por posición.
- **Qué publica cada fila:** `title` («Luna trígono tu Marte»), `transitPlanet` / `natalPoint` (mono), `aspectType` / `aspectEs` / `aspectAngle` (sólo los cinco aspectos mayores; `null` en otro caso), `natalHouse`, la ventana (`startTime`, `exactTime`, `endTime`), `phase` (`acercandose` | `exacto` | `integrandose`, por el día civil del exacto respecto de `localDate`), `peakLabel` (`EXACTO HOY` · `PICO MAÑANA` · `PICO AYER` · `PICO EN N DÍAS` · `PICO HACE N DÍAS`), `closeness` 0–1, `cadence` (la de `transitCadence`) y `body` (una oración honesta sobre el contacto y su fase).
- **Qué NO se inventa:** el proveedor diario no publica el orbe en grados ni la posición del planeta, así que no hay `0°43'` ni puntaje. `closeness` mide cercanía **en tiempo**: la distancia entre «ahora» en la zona de la lectura (o el mediodía de `localDate` si no hay zona) y `exactTime`, sobre la mitad de la ventana (escala mínima: media jornada). Sin ventana o sin exacto, `closeness`, `phase` y `peakLabel` son `null` y el front no dibuja barra ni chip. Las horas del proveedor (`2026-09-05T14:30`, sin zona) se leen como instantes ingenuos (`parseNaiveTime`) y sólo se comparan entre sí.
- **Orden:** el del backend (`selectRelevantTransits` → `transitPriority`: pesos fijos por planeta en tránsito, punto natal y tipo de aspecto, más uno si hay hora exacta), el mismo que usa el ranking de la guía diaria; el front no reordena y «Por qué este orden» describe exactamente ese criterio, no cercanía al exacto ni casas.
- **Totales reales:** la lectura del día suma `transitTotals { provider, major, ranked }` (aditivo) para que el panorama pueda decir «8 de 16 contactos activos». En documentos anteriores `activeTotal` es `null` y el front dice «contactos principales», nunca «todos».
- **«Ahora»:** la action calcula `now` en la zona de la lectura (`naiveNowIn`) y la cercanía se mide desde ese instante; sin zona, desde el mediodía de `localDate`. La leyenda lo declara («desde ahora»).
- **Pruebas:** `test/transitPanorama.test.ts` (backend puro) y `test/transitosPanorama.test.ts` (front puro).

## 2026-09-06 — Vínculos: la primera persona y su comparación real (CORE-212)

- **Qué cambia (aditivo):** dos funciones nuevas en `relationships`. `addPerson({ name, level, relationshipType?, zodiacSign?, birthDate?, birthTime?, birthPlaceLabel?, latitude?, longitude? })` (action) guarda a la persona como perfil activo —reemplaza al anterior: en esta tarjeta hay una sola— y, cuando el nivel lo pide, calcula su carta con el mismo proveedor que la carta propia. `synastry({})` (query, reactiva) devuelve **siempre** un sobre con `status`: `no_person`, `needs_natal_chart`, `person_chart_unavailable` o `ready`. `getActive` y `upsert` no cambian.
- **Por qué:** Vínculos mostraba «Próximamente». La ficha pedía una rebanada vertical real —alta, cálculo, resultado, persistencia— sin porcentajes inventados. La carta de la persona se calcula **una vez** en el alta (una action puede llamar al proveedor; una query no) y queda en `relationshipProfiles.chartPayload` con su `chartStatus`; la comparación es una derivación pura sobre las dos cartas guardadas (`convex/lib/synastry.ts`, probada en `test/synastry.test.ts`).
- **Niveles:** `signo` (nombre + signo solar: sólo tono por elementos, sin contactos), `fecha` (fecha obligatoria; hora y lugar opcionales pero sólo juntos: sin ellos, contactos entre planetas sin ejes; con los dos, la carta de la persona tiene hora real y la comparación suma ejes, y `precision` lo declara) y `carta` (fecha, hora y lugar obligatorios: suma Ascendente y Medio Cielo). La precisión que **se pudo** calcular viaja en `precision` (`level`, `label`, `includesAngles`, `limitations`): pedir `carta` con una carta propia sin hora baja a `fecha` y lo dice; no se finge un eje calculado al mediodía.
- **Contactos reales:** aspectos mayores (conjunción, sextil, cuadratura, trígono, oposición) entre los planetas de una carta y los de la otra, con orbes de sinastría acotados (`SYNASTRY_ORBS`: 8/4/6/6/7, +2° si interviene Sol o Luna). Cada contacto publica `orb` medido y `orbLabel` (`2° 10'`), `tone` (`armonico` | `tenso` | `fusion`) y `dimensions` (`hablan` | `cuidan` | `deseo`, mapeo editorial fijo por planeta; Urano, Neptuno y Plutón no suman a ninguna). `summary` trae los conteos totales y por dimensión **sobre la lista entera**.
- **Free / Plus:** en Free `contacts` se corta en `FREE_CONTACT_LIMIT = 3` y `hiddenContacts` dice cuántos faltan; `access.isPro` y `access.contactLimit` lo declaran. Los conteos no se recortan. El cupo de personas y la biblioteca múltiple quedan para CORE-213/214.
- **Schema (aditivo, opcional):** `relationshipProfiles` suma `relationshipType`, `level`, `birthTimePrecision`, `latitude`, `longitude`, `timezone`, `chartStatus`, `chartVersion` y `chartPayload`. Los nombres coinciden con los que ya usa la línea `release/1.0.0` (`relationshipType` con las claves de `relationshipTypeValidator`, `birthTimePrecision`, `latitude`, `longitude`, `timezone`) para no divergir en el campo. **Nota de líneas:** `release/1.0.0` expone `relationships.savePerson`, `list`, `removePerson`, `getComparison({ profileId })` y `refreshComparison` con el sobre `AnalysisResult`; esta tarjeta **no** reutiliza esos nombres a propósito (`addPerson` / `synastry`) para que una reconciliación posterior de las dos líneas no choque función contra función. `synastry` es el nombre que este CHANGELOG ya proponía para el motor de Vínculos.
- **Falla cerrado:** una persona con fecha cuya carta no llegó del proveedor queda guardada con `chartStatus: "error"` y la comparación responde `person_chart_unavailable`, sin contactos inventados. Sin carta propia calculada: `needs_natal_chart`. Sin sesión: `no_person`.

## 2026-09-05 — Cada tránsito del ranking abre su propio detalle (profundización de CORE-191)

- **Qué cambia (aditivo):** nueva action pública `transits.getDetail({ localDate, transitId })`. Devuelve `{ status: "ready", localDate, transitId, detail }` con el detalle del contacto pedido —cuerpos, aspecto, casa natal y su tema si el proveedor la publicó, lectura, ventana, cadencia y «cómo se juega en la Tierra», con el mismo `access` por plan que `transits.getToday`— o `{ status: "not_found", localDate, transitId }` cuando ese contacto no está en la lectura de hoy de la persona. Nunca devuelve otro tránsito en su lugar. `transits.getToday` conserva su firma y su selección; su respuesta suma los campos aditivos del detalle (`transitId`, `natalHouse`, `houseTheme`, `cadence`).
- **Identidad estable:** `transitId` es `planeta-aspecto-punto` con las claves canónicas del proveedor (`mars-square-venus`, `transitIdFor` en `convex/lib/orbita.ts`); si el mismo par se repite en el día, la segunda aparición lleva sufijo `-2`. No depende de la posición en el ranking ni de un texto traducido, y el servidor sólo la resuelve dentro de la lectura de la persona con sesión para la fecha canónica: un id ajeno o de otro día responde `not_found` o se rechaza. Un id con caracteres fuera de `[a-z0-9_-]` se rechaza antes de tocar nada.
- **Dónde viaja:** `daily.getGuide` agrega `transitId` opcional en `destacado` y en cada elemento de `secundarios`. La guía y la lectura de `transits` son dos selecciones sobre dos llamadas al proveedor para la misma fecha (cuatro y ocho contactos), pero usan el mismo algoritmo determinista (`selectRelevantTransits`, por prioridad, sin reloj) y la misma asignación de identidad, así que cada `transitId` de la guía resuelve al mismo contacto en la lectura; hay una prueba ejecutable que lo afirma. La lectura persistida en `transitReadings` / `dailyReadings` suma `rankedTransits` (hasta ocho contactos con `transitId` y `displayText`) y `transitId` en `transits.highlighted`, `transits.secondary` y `selectedTransits`. `WebB0TransitDetailPayload` suma `transitId`, `natalHouse`, `houseTheme` y `cadence` (derivada de la ventana real del contacto: horas, días, semanas; ausente sin ventana), todos opcionales.
- **Compatibilidad:** documentos anteriores sin `transitId` siguen siendo válidos. El ranking no abre nada para esas filas (el cliente las muestra sin enlace y lo dice). `getDetail` sobre una lectura anterior sin `rankedTransits` reconstruye la identidad de los contactos que sí guardó (`selectedTransits`, `highlighted`, `secondary`) y responde `not_found` para el resto. Sin migración: los documentos nuevos del día traen la identidad al generarse.
- **Schema:** sin cambios. `payload: v.any()` absorbe los campos aditivos.
- **Contrato en el front:** `proposedApi.transitDetail` y `TransitDetailResult` en `src/services/appRefs.ts`; `DailyGuidePayload.destacado/secundarios` con `transitId?`. La ruta `/reading/transito?id=<transitId>` carga exactamente ese contacto en web y nativo (misma pantalla, mismo contrato); sin `id` conserva el destacado del día.
- **Rollout:** aditivo, sin migración. Desplegar Convex primero (los previews web usan el deployment dev); el frontend que consume la action llega en la misma rebanada. Rollback por redeploy del bundle anterior: los documentos escritos con `rankedTransits` son inertes para el código previo.

## 2026-09-03 — La Luna de hoy sobre la carta natal (CORE-192)

- **Qué cambia (aditivo):** nueva action pública `home.getLunaSobreLaCarta({ localDate?, timezone? })`. Devuelve **siempre** un sobre `{ methodVersion, providerVersion, status, precision, localDate, timezone, observedAt, moonOnChart, cumpleluna, missingInputs, limitations }`; nunca `null`. `getDaily` y `generateDaily` no cambian ni en firma ni en comportamiento.
- **Por qué:** CORE-191 tiene que armar los módulos reales **LA LUNA EN TU CARTA** y **CUMPLELUNA** en la Home. Hasta ahora no había ningún dato: la Home sólo tenía tránsitos y fase lunar global (`sky.getMoonPhase`), que no cruzan con la carta de la persona.
- **`moonOnChart`:** signo, grado, fase, iluminación y elongación de la Luna de hoy, más la **casa natal** por la que pasa y su tema. Publica además `housesToday` / `signsToday` / `phasesToday`: lo que la Luna recorre durante el día civil. Si cambia de casa o de signo dentro del día, `precision` baja a `range` en vez de afirmar una sola casa; el `status` no cambia, porque no falta un insumo.
- **`cumpleluna`:** elongación Sol→Luna natal y actual, posición en el ciclo personal y la repetición estimada (`previousExactAt` / `nextExactAt`). **Nunca se publica un instante exacto:** cada uno viaja con su ventana (`*Window`) y con `precision: "estimated" | "range"`. La estimación propaga la elongación por movimiento medio y acota la ventana con la intersección de dos cotas: las velocidades extremas de la elongación (10.7–14.6 °/día, mandan en arcos cortos) y la ecuación del centro combinada de Luna y Sol (mandan en arcos largos). Un consumidor que muestre `nextExactAt` sin su ventana estaría inventando precisión.
- **Sin hora natal exacta:** no se asigna casa (`natalHouse: null`, `missingInputs: ["exact_birth_time"]`) y la elongación natal pasa a conocerse dentro del día de nacimiento (±7.3°, media jornada a velocidad máxima), así que el Cumpleluna es `precision: "range"` con la ventana ensanchada. Lo que decide no es sólo `birth.birthTimePrecision` —eso es lo que la persona **declaró**— sino con qué hora se **calculó** la carta: se exigen a la vez `birthTimePrecision: "known"`, `calculationTimeSource: "birth_time"` y una `birth.birthTime` que parsee. Una carta con la hora declarada pero resuelta al mediodía (`noon_fallback`), o guardada antes de que existiera ese campo, degrada igual que una sin hora. `approximate` se trata como no exacta.
- **Datos incompletos de la carta guardada:** `NormalizedAstroHouse.degree` y `NormalizedAstroPlacement.fullDegree` son `number | null`, y un `null` **no** se coacciona a 0°. Una cúspide sin grado invalida las doce y deja `natalHouse: null` con `missingInputs: ["complete_natal_houses"]`; un Sol o una Luna natal sin grado deja `cumpleluna: null` con `missingInputs: ["natal_sun_and_moon"]`, en vez de publicar un ciclo personal medido desde 0° de Aries.
- **El día lo decide el servidor:** `localDate` y `timezone` siguen siendo opcionales, pero ya no eligen nada. La autoridad es siempre `resolveCanonicalDailyContext` (el mismo día canónico que devuelve `daily.getTodayContext`, derivado de la zona natal). Si llegan, sólo pueden **confirmarlo**: se comparan por igualdad exacta y cualquier diferencia se rechaza —incluida la misma zona escrita distinto (`"America/Buenos_Aires"`, `" America/…"`) y un alias numérico de offset (`"-3"`, que `getTimezoneOffsetHours` aceptaría y resolvería el mismo cielo con otra clave)—. El rechazo ocurre **antes** de leer `globalSkyCaches` y antes de llamar al proveedor, y ni en el caso aceptado se usan los valores del cliente para armar la clave o el sobre: sin ese cerrojo, pedir cualquier fecha o cualquier alias multiplicaba filas y llamadas facturables. El sobre devuelto siempre publica el `localDate` / `timezone` canónicos (vacíos cuando todavía no hay sesión y no hay contexto que resolver).
- **Falla cerrado con estado explícito:** `needs_session`, `needs_daily_context` (fecha o zona irresolubles, o un `localDate` / `timezone` que no coincide con el canónico: `missingInputs: ["canonical_local_date_mismatch"]` / `["canonical_timezone_mismatch"]`), `needs_natal_chart`, `not_configured` (sin credenciales de AstrologyAPI) y `provider_error` (el proveedor falló o no devolvió Sol y Luna con longitud **y velocidad**). En ninguno de esos casos se completa el dato con una maqueta.
- **Proveedor:** `planets/tropical` de AstrologyAPI, con el mismo patrón de transporte que ya usa `convex/sky.ts` (Basic auth, sin exponer el crudo). Se pide el **mediodía local** de `localDate` con coordenadas neutras: las longitudes son geocéntricas y no dependen del lugar.
- **Schema:** sin cambios. Reutiliza la tabla existente `globalSkyCaches` por el índice `by_date_timezone_version`, con `providerVersion: "astrologyapi-planets-tropical-luna-carta-v1"`. El cielo del día se busca una sola vez por `(localDate, timezone)` y lo comparten todas las cuentas de esa zona, así el costo no crece por usuario. La fila se relee con la misma validación que la respuesta cruda; si `observedAt` no coincide, se descarta y se vuelve a pedir.
- **Funciones internas nuevas** (no públicas): `home.lunaSobreLaCartaState` (internal query) y `home.persistGlobalSky` (internal mutation).
- **Contrato en el front:** `LunaSobreLaCartaPayload` y sus bloques quedan declarados en `src/services/appRefs.ts` (`appApi.home.getLunaSobreLaCarta`, se invoca con `useAction`), y `src/domain/homeAdapter.ts` suma `toLunaSobreLaCarta` / `hasLunaSobreLaCartaData`: lectores defensivos que, a diferencia del resto del adaptador, **no rellenan con fallback** —un Cumpleluna sin ventana o una casa fuera de 1..12 se descartan— porque medio dato astronómico es un dato falso.
- **Rollout:** cambio aditivo, sin migración. Desplegar Convex primero; el frontend que consuma la action llega en CORE-191. Rollback por redeploy del bundle anterior: el único rastro son filas nuevas de `globalSkyCaches` con ese `providerVersion`, inertes para el resto del sistema.

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
