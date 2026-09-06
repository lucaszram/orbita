# design QA — Órbita V4.9.2 nativa iOS

## Estado vigente (2026-08-19)

**Veredicto único: PASS técnico local del código auditado y de la suite. NO
LISTO PARA LANZAMIENTO NI PUBLICACIÓN.**

| Qué | Valor |
|---|---|
| Rama · HEAD | `feature/native-v492-implementation` · `52836ad5f4ad6d6c72f389069ff73f008d45be28` |
| Working tree sin commit | **381 entradas** (`-uall`) = 129 tracked + 252 untracked |
| Índice | 2 entradas heredadas: `D app/(tabs)/transitos.tsx` · `R100 app/(tabs)/perfil.tsx → src/screens/PerfilScreen.tsx` |
| `pnpm typecheck` | **PASS** |
| Suite completa | **2145/2145**, 196 suites, 0 fail (`node --import tsx --test test/*.test.ts`) |
| `pnpm check:test-count test-output.log` | **PASS** (mínimo 745) |
| `git diff --check` / `--cached --check` | **PASS** |

De este delta **no** hubo deploy, build nativo nuevo, compra sandbox, dashboard
de Apple/RevenueCat, TestFlight, App Review ni producción. La certificación
**visual** sigue como estaba: los estados no se recapturaron en esta pasada.

**Limitación abierta, release-blocking:** si `deleteUser` de Clerk termina y el
proceso cae antes de persistir `identity_deleted`, el checkpoint sólo estaba en
memoria; al reiniciar queda fail-closed y la salida es soporte, sin recuperación
self-service. Cerrarlo exige una integración server-side durable con la Clerk
Backend API y `CLERK_SECRET_KEY`, que **no se implementó ni se configuró**.

Detalle completo y pendientes externos en orden: `CURRENT_TASK.md`, sección
vigente al inicio.

---

## Certificación visual — pasada 15 (2026-08-18) · HISTÓRICO

> **HISTÓRICO.** Los conteos de suite de esta sección (**1537/1537**, 93 suites)
> corresponden a la pasada 15 y quedaron superados por los **2145/2145** de
> arriba. La tabla de estados visuales sigue siendo la referencia vigente de QA
> visual, porque no se recapturó nada después.

**final result: not fully passed.** De los 12 estados: **10 passed** · **1
blocked externo** (06) · **1 not re-run** (02).

- **04 · passed runtime** — ranking real de 12 entradas; se abrió el arco #2
  `Urano en sextil con tu Saturno`. Su trazabilidad usa `ORB-TRN-001` y
  `transit-arc-planets-tropical-roots-v2`, nunca `ORB-TRN-002`.
- **06 · blocked por entitlement** — exige una cuenta con **Órbita Plus real**;
  ninguna cuenta QA local lo tiene y no se tocó monetización.
- **09 · passed runtime** — comparación carta contra carta real; los 14
  contactos expandidos usan `Su … con tu …` / `Tu … en su …`, con 0 nombres
  propios repetidos. La degradación honesta de la pasada anterior también sigue
  certificada.
- **02 · not re-run** — su fixture vivía en un simulador descartado y no había
  credenciales locales seguras para regenerarlo; no se declara passed.
- **08 · passed runtime v2** — `La tierra…`, `CUANDO LA TIERRA SATURA` y `con un
  planeta`; ausencia de `El tierra` y `uno planeta`.
- **D7 · functional passed / runtime 15 N/A** — la cuenta QA disponible tiene
  una carta completa y no ofrece el camino de recuperación; no se fabricó una
  fila incompleta.
- **VoiceOver · blocked** — exige un **iPhone físico**.
- **Verificación visual autenticada de la web · pendiente** — es una tarea
  separada; el smoke vigente es anónimo a propósito.

Van **quince pasadas**. La **decimocuarta (2026-08-18)** ejecutó tres deploys
puntuales y autorizados sólo a Convex Development. Reprodujo cachés editoriales
obsoletos en 08/09 y, durante la auditoría posterior, bordes de concordancia y
una degradación que culpaba falsamente al perfil. Todos quedaron cubiertos por
regresiones falla/pasa; el cierre final es typecheck 0, focales **91/91**, suite
**1537/1537**, 129 funciones live, diffs limpios y auditoría **0 P0/P1/P2**
*(cifras de la pasada 15; el conteo vigente es 2145/2145 · 196 suites)*.
La **decimoquinta (2026-08-18)** no cambió código ni desplegó: con los créditos
del proveedor restaurados, recapturó 04 y 09 por el flujo público y cerró ambos
en runtime.
## Historial de las pasadas 3–13 — no usar como veredicto vigente

La tercera cerró la auditoría independiente de forma
visual pero dejó abierto su hallazgo más grave: el detalle de un arco NO principal
mentía sobre su propio análisis. La **cuarta pasada (2026-08-17)** implementó el
contrato aditivo que ese detalle necesitaba y corrigió el método duplicado de
Vínculos. El código y las pruebas están en verde; **la captura `04` deja de ser
`passed`** porque la función nueva todavía no está desplegada en Development y
desplegar estaba fuera de alcance.

La **quinta pasada (2026-08-17)** cerró la causa de fondo de ese mismo hallazgo
—el ranking y el arco derivaban dos identidades distintas para el mismo tránsito,
así que hasta el #1 de la lista caía al fallback— y dos estados de la Carta que
decían algo distinto de lo que era cierto (D12–D14). **No recapturó ningún
estado**, así que la tabla visual de arriba es la misma: el veredicto no cambia.

La **sexta pasada (2026-08-17)** cerró un P1 que el quinto arreglo dejaba abierto
—la identidad quedaba garantizada al CALCULAR, pero `getForDate` y el rescate sin
efeméride leían el ranking y el arco por separado, así que un par incoherente
guardado podía sobrevivir indefinidamente— y dos bordes de la Carta (D15–D17).
**Tampoco recapturó ningún estado ni desplegó nada**: la tabla visual de arriba
sigue igual.

La **séptima pasada (2026-08-17)** cerró un P1 funcional que ninguna anterior
había visto —el botón de recuperación de la Carta llamaba a `layers.refreshForDate`,
que no genera la carta natal, así que no podía arreglar nunca lo que la propia
pantalla decía que faltaba— y el copy del ranking vacío (D18–D19). **Tampoco
recapturó ningún estado ni desplegó nada**, y el camino real de recuperación
—tocar el botón contra un backend con una carta incompleta— **no se pudo
ejercitar en runtime**: exige desplegar y una cuenta con esa fila. La tabla visual
de arriba sigue igual.

La **octava pasada (2026-08-17)** cerró los dos P1 y los tres P2 que una auditoría
independiente encontró sobre la séptima (D20–D24). Los dos P1 son de honestidad
del mismo botón: (a) el intento se anunciaba como éxito aunque el proveedor
fallara o devolviera una carta que seguía sin la geometría —y en el segundo caso
la persistía encima de la anterior—; (b) el candado terminaba antes que el
recálculo real, así que había una ventana en la que un segundo toque volvía a
llamar la operación. Los P2: el fallo era global y se pegaba entre cuentas y
cartas; un sobre negativo cacheado del arco sobrevivía a un ranking vacío que lo
desmentía; y tres documentos se contradecían. **Tampoco recapturó ningún estado
ni desplegó nada**, y el camino real de recuperación —tocar el botón contra un
backend con una carta incompleta y contra un proveedor caído— **sigue sin poder
ejercitarse en runtime**: exige desplegar la action aditiva
`charts.recoverNatalChart` y una cuenta con esa fila. La tabla visual de arriba
sigue igual.

La **novena pasada (2026-08-17)** cerró seis P1 y dos P2 que tres auditorías
independientes reprodujeron sobre la octava, todos de CONCURRENCIA: carreras que
una suite verde no cubría porque ninguna prueba controlaba el orden real de
resolución (D25–D32). En resumen: la carta natal podía **empeorar** por una
corrida atrasada; la action nueva se consumía con una firma escrita a mano en vez
de la referencia generada; un refresco colgado dejaba la recuperación bloqueada
tras desmontar; una solicitud nueva heredaba la espera y los reintentos agotados
de la anterior; una completion natal vieja podía arrancar un refresco sobre el
alcance nuevo; una mejora de carta podía dejar —o reescribir— una interpretación
LLM obsoleta; el registro podía desalojar un store todavía montado; y la tabla de
checks de este archivo seguía apuntando a la séptima pasada. **Tampoco recapturó
ningún estado ni desplegó nada**, y el camino real de recuperación **sigue sin
poder ejercitarse en runtime**. La tabla visual de arriba sigue igual.

La **décima pasada (2026-08-18)** cerró los cuatro P1 y el P2 que tres
auditorías independientes reprodujeron sobre la novena, más un gate de release
real que esa suite no cubría (D33–D38). Otra vez son carreras: una falla tardía
del proveedor ignoraba la carta que otra corrida ya había publicado; una carta
suficiente podía quedar ligada al `birthDataId` histórico y dejar el alta en
`chart_pending` para siempre; un éxito de recuperación podía saltear el refresh
del día; `suspend()`/`resume()` podía dejar el ciclo nuevo bloqueado por una
action huérfana; y la `cacheVersion` de la interpretación natal no invalidaba
nada. El gate: **`convex/_generated/api.d.ts` estaba incompleto** —le faltaban
dos módulos— y tres documentos afirmaban que no hacía falta codegen; **quedó
cerrado el 2026-08-18**, cuando Codex corrió `pnpm convex:codegen --typecheck
disable` y la suite pasó a **1493/1493** con el gate 7/7. **Tampoco recapturó
ningún estado ni desplegó nada**, y el camino real de recuperación **sigue sin
poder ejercitarse en runtime**. La tabla visual de arriba sigue igual.

La **undécima pasada (2026-08-18)** cerró los dos P1 y el P2 que dos auditorías
independientes reprodujeron sobre la décima (D39–D41). Los tres son de
**interleaving**, y ninguno se veía mirando cada mitad por separado: un claimant
de la lectura natal con una `cacheVersion` vieja podía **destruir una lectura
vigente** —el CAS final la rechazaba después, pero el claim ya había borrado el
payload—; `suspend()`/`resume()` podía ejecutar **dos veces** el mismo refresco
del día y dejar `refreshFailed=true` sobre datos recién calculados; y una
solicitud hecha durante la suspensión encendía `CALCULANDO…` sin ningún trabajo
vivo detrás. **Tampoco recapturó ningún estado ni desplegó nada**, y el camino
real de recuperación **sigue sin poder ejercitarse en runtime**. La tabla visual
de arriba sigue igual.

La **duodécima pasada (2026-08-18)** cerró un P1 de **liveness**, su P2 hermano y
tres pendientes de release que tres auditorías independientes reprodujeron sobre
la undécima (D42–D43). El P1: una action del recálculo del día que **no resolvía
nunca** bloqueaba para siempre a la solicitud pertinente más nueva —`CALCULANDO…`
permanente, y ni volver del background lo destrababa—, porque el mutex era del
ciclo y la pertinencia no estaba modelada; ahora la clave del pedido viaja como
**alcance** y una corrida superada queda **relevada**, huérfana y sin efectos. El
P2: `pedirYEsperar` anotaba como admitido un pedido que la cola había rechazado
sin encolar, así que al reabrir el efecto se salteaba el refresco. Los tres
pendientes de release: la **compilación nativa de Android** —Gradle real, no un
export, con `BUILD SUCCESSFUL` y APK en disco—, un runner de exports que **no
podía fallar** por diseño y ahora es un gate con self-test, y `.local/` fuera del
alcance de un `git add -A`. **Tampoco recapturó ningún estado ni desplegó nada**,
y el defecto de liveness **no se pudo ejercitar en runtime**: reproducirlo pide
una action de Convex que no resuelva nunca. La tabla visual de arriba sigue
igual; lo único nuevo en imágenes son las cinco capturas del smoke web anónimo,
que son de otra plataforma y otro viewport y no se comparan contra ningún frame.

La **decimotercera pasada (2026-08-18)** cerró el P1 que tres auditorías
independientes reprodujeron **después** del cierre de la duodécima, y cuatro P2
de una auditoría de release (D44). El P1: el relevo por alcance cubría el
*cambio* de alcance, así que el cuelgue seguía vivo justo donde nada cambiaba
—con el refresco automático colgado, la recuperación natal pedía el **MISMO**
alcance y quedaba detrás de él para siempre, con el candado natal tomado—. Ahora
el contador del intento vive en el ciclo, en una sola fuente de verdad, y la vía
forzada lo **reserva sincrónicamente en el mismo instante en que encola**; la vía
automática con clave idéntica sigue sin duplicar, que es lo correcto. Los cuatro
P2: `.easignore` no excluía `.local/` ni los exports temporales —y EAS deja de
leer `.gitignore` cuando ese archivo existe—, el runner de Android salía **0**
con Gradle en 0 y sin APK, el de exports miraba **sólo el primer** `.hbc` de cada
plataforma, y la compilación anterior no dejaba ninguna cadena de hashes entre el
árbol y lo compilado. **Tampoco recapturó ningún estado ni desplegó nada**, y el
P1 **no se pudo ejercitar en runtime** por el mismo motivo que el de la
duodécima: reproducirlo pide una action de Convex que no resuelva nunca. La tabla
visual de arriba sigue igual; las únicas imágenes nuevas son las cinco capturas
del smoke web anónimo de esta pasada (`shots/web-smoke13/`).

- Corrida: 2026-08-17/18 · rama `feature/native-v492-implementation` · **sin commit**.
- Evidencia final de runtime de la pasada 15: `logs15/`, `shots/cert15/` y
  `compare15/`. 04 acepta `04-arco-live.png`; 09 acepta
  `09-vinculos-canonica.png`. `logs15/run-summary.md` enumera el set exacto.
- Evidencia técnica y de contingencia de la pasada 14: `logs14/`,
  `shots/cert14/` y `compare14/`. 08 con sufijo `v2` sigue vigente; los sets de
  proveedor caído de 04/09 son historia válida, pero ya no su veredicto actual.
- Evidencia visual heredada vigente para 01, 03, 05–07 y 10–12:
  `shots/cert3/` y `compare3/`. 02 conserva el set histórico de la segunda.
- Evidencia de código y exports de la cuarta pasada: `logs4/` del mismo directorio;
  de la quinta, `logs5/` (incluye la reproducción antes/después del `arcId`); de la
  sexta, `logs6/` (incluye la verificación en las dos direcciones de las 8 pruebas
  nuevas); de la séptima, `logs7/`; de la octava, `logs8/` (incluye la verificación
  en las dos direcciones de los cinco arreglos); de la novena, `logs9/`
  (incluye la verificación en las dos direcciones de los diez arreglos, con las
  herramientas `tools/verify-reverts9.mjs` y `tools/run-exports9.sh`); de la
  **décima**, `logs10/` (verificación en las dos direcciones de los diez
  arreglos de esta pasada, con `tools/verify-reverts10.mjs` y
  `tools/run-exports10.sh`); de la **undécima**, `logs11/` (verificación en las
  dos direcciones de los cuatro arreglos, con `tools/verify-reverts11.mjs` y
  `tools/run-exports11.sh`); de la **duodécima**, `logs12/` (verificación en las
  dos direcciones de los seis arreglos, con `tools/verify-reverts12.mjs`,
  `tools/run-exports12.sh` y `tools/android-native-compile12.sh`, más el smoke
  web sobre el export actual en `shots/web-smoke12/`); de la **decimotercera**,
  `logs13/` (verificación en las dos direcciones de **diez** reversiones —las
  cuatro de esta pasada y las seis de la duodécima— con `tools/verify-reverts13.mjs`,
  `tools/run-exports13.sh`, `tools/android-native-compile13.sh`,
  `tools/easignore-gate13.mjs` y `tools/tree-manifest13.py`, más el smoke web en
  `shots/web-smoke13/`). **`logs12/` no se reescribió:** era la evidencia honesta
  de aquel momento, con su runner que podía salir verde sin APK y todo.
- Cada fila compara **el mismo estado y el mismo viewport**: página completa a
  393 pt contra el frame V4.9.2, en cortes de 850 pt, con la barra fija una sola
  vez.

> **La costura tenía un segundo defecto.** `fullpage2.mjs` había arreglado la
> barra de pestañas (banda fija ABAJO) pero no la barra de "volver" de las
> pantallas de detalle (banda fija ARRIBA): se cosía una vez por costura y
> `← ARCO DEL TRÁNSITO` aparecía a mitad de página. `fullpage3.mjs` detecta las
> dos bandas por píxeles. `compare2/` se conserva; lo válido es `compare3/`.

---

## Comparaciones · 393 pt

| # | Estado | Comparación | Alto impl → ref | Resultado |
|---|---|---|---|---|
| 01 | Hoy | `compare3/01-hoy-p1..p4.png` | 2767 → 2436 | **passed** |
| 02 | Hoy con evento | `compare2/02-hoy-evento-p1..p4.png` | 2788 → 2483 | **not re-run**¹ |
| 03 | Tránsitos | `compare3/03-transitos-p1..p4.png` | 3077 → 1990² | **passed** |
| 04 | Detalle de arco | `compare15/04-arco-live-p1.png`, `compare15/04-arco-live-p2.png`, `compare15/04-arco-live-p3.png` | 2200 → 2051 | **passed runtime**⁷ |
| 05 | Tu momento | `compare3/05-tu-momento-p1..p4.png` | 2697 → 2100 | **passed** |
| 06 | Carta | `compare3/06-carta-p1..p3.png` | 2133 → 1817 | **blocked**⁴ |
| 07 | Tipo lunar | `compare3/07-tipo-lunar-p1..p3.png` | 2309 → 2271³ | **passed** |
| 08 | Mapa elemental | `compare14/08-mapa-elemental-v2-p1..p2.png` | 1302 → 1212 | **passed runtime v2**⁵ |
| 09 | Vínculos carta contra carta | `compare15/09-vinculos-canonica-p1.png`, `compare15/09-vinculos-canonica-p2.png`, `compare15/09-vinculos-canonica-p3.png` | 1839 → 1329 | **passed runtime**⁵ |
| 10 | Vínculos signo contra signo | `compare3/10-vinculos-signo-p1..p2.png` | 1354 → 1022 | **passed** |
| 11 | Carta sin hora | `compare3/11-carta-sin-hora-p1..p3.png` | 1738 → 2036 | **passed** |
| 12 | Tu momento sin hora | `compare3/12-tu-momento-sin-hora-p1..p3.png` | 2102 → 2177 | **passed** |
| D7 | Recálculo natal | — | — | **functional passed / visual N/A**⁶ |

¹ **02 no se recapturó.** Su fixture vivía en un simulador descartable que la
pasada anterior borró al terminar. El código de esa pantalla no se tocó en esta
pasada; la evidencia válida sigue siendo la de la segunda
(`shots/cert2/02-hoy-evento.png`, `logs2/cumpleluna-search.log`).
² La pasada 15 obtuvo **12 tránsitos activos reales**; el frame dibuja 6.
³ **El acordeón de trazabilidad se abrió antes de capturar** (la evidencia
vigente de `04` registra 52 elementos y la de `07`, 59), para comparar el mismo
estado que el frame.
⁴ **06 está BLOCKED por entitlement**, no por diseño. Ver abajo.
⁵ **08** está recapturado después del tercer deploy y pasa visualmente con
`La tierra…` y `con un planeta`. **09** quedó recapturado en la pasada 15 con la
comparación real: 14/14 contactos usan la voz `Su/Tu` y 0 repiten nombres. La
degradación honesta de la pasada 14 se conserva como evidencia histórica.
⁶ No existe frame canónico del estado de recálculo. Se certifica como prueba
funcional con tiempos reales (`logs3/d7-recalculo.md`), no como PASS visual.
⁷ **04 quedó PASS en la pasada 15.** Las funciones `layers.getTransitArc` /
`layers.refreshTransitArc` devolvieron el arco #2 real. La trazabilidad mostró
`ORB-TRN-001` y el método v2, nunca `ORB-TRN-002`. La comparación `compare3/`
queda sólo como historia del defecto anterior.

### Estado 06 — bloqueado por entitlement, con estado alternativo honesto

El frame dibuja una carta **completa** (`12 CASAS · 8 ASPECTOS MAYORES`), o sea
una cuenta con Órbita Plus vigente. **Ninguna cuenta QA local tiene Plus**:
verificado en los tres simuladores (`v492-cert-se`, `-393`, `-max`), los tres
muestran `CASAS EN PLUS · ASPECTOS EN PLUS`. `isPro` sale de filas reales de
suscripción (RevenueCat/Stripe), así que concederlo sería tocar monetización.

**No se concedió acceso y no se declara PASS.** Lo capturado en
`compare3/06-carta-*.png` es el **estado alternativo honesto**: la misma
pantalla con el límite de acceso declarado. Es correcto como estado, y no es el
frame canónico.

Sí se corrigió lo que en 06 dependía de nosotros: **la fecha del día en la barra
superior**, que el frame muestra (`VIE 15 AGO`) y faltaba.

---

## Defectos funcionales

| # | Defecto | Resultado | Verificación |
|---|---|---|---|
| D1 | Barra de pestañas amontonada | **passed** | Geometría medida en 375/393/440 |
| D2 | Las ruedas capturaban el arrastre | **passed** | Formulario recorrido; la página scrollea sin tocar el valor |
| D3 | Picker en inglés y sin etiquetas | **passed** | `Día`/`Mes`/`Año` y `Hora`/`Minuto`, en español y 24 h |
| D4 | "Guardar cambios" mudo | **passed** | Bloqueado con su razón como elemento enfocable propio |
| D5 | El primer refresh no se recuperaba | **passed** | REINTENTAR recuperó en runtime |
| D6 | Medianoche propuesta en silencio | **passed** | `Listo` bloqueado hasta mover una rueda; reverificado al restaurar el perfil |
| D7 | Recálculo leído como falla terminal | **passed (re-corregido)** | El estado lo decide una corrida REAL, no `access.positions`. Dos ciclos con tiempos: `logs3/d7-recalculo.md` |
| D8 | La hora quedaba imposible de restaurar | **passed** | Reverificado en el ciclo de restauración de esta pasada |
| **D9** | **El candado de guardar y borrar era estado de React** | **passed** | Defecto de la tercera pasada. Mutex sincrónico real, probado por comportamiento |
| **D10** | **El detalle de un arco no principal se armaba con el ítem del ranking** | **passed en código, contrato y runtime** | Contrato aditivo `layers.getTransitArc` + `layers.refreshTransitArc`; la pasada 15 abrió el arco #2 real y verificó `ORB-TRN-001` sin `ORB-TRN-002` |
| **D11** | **Vínculos imprimía el método y su versión dos veces** | **passed** | Defecto NUEVO de la cuarta pasada (P2). El identificador crudo salió del pie; método y versión quedan sólo en el acordeón |
| **D12** | **El ranking y el arco derivaban dos identidades para el mismo tránsito** | **passed en código y runtime** | Defecto de la quinta pasada. La identidad dejó de depender de si la cronología se estimó o se verificó; la pasada 15 abrió correctamente el arco #2 del ranking real |
| **D13** | **La Carta decía `Necesita tu hora` con la hora exacta ya guardada** | **passed en código / sin recaptura visual** | Defecto de la quinta pasada. Vista y VoiceOver salen del mismo hecho; el eje pendiente dice `Calculando…` |
| **D14** | **Se ofrecía reintentar un `parcial` que sólo dependía de la hora** | **passed en código / sin recaptura visual** | Defecto de la quinta pasada. `canRetry` se deriva de la salida real (`recovery`), no de la fase |
| **D15** | **El ranking y el arco CACHEADOS podían divergir** | **passed en código / sin recaptura visual** | Defecto de la sexta pasada (P1). Coherencia por `arcId` **y** tupla en todo camino que arma el bundle; 5 pruebas nuevas, verificadas también contra el motor viejo |
| **D16** | **Un refresco fallido volvía reintentable la carta limitada sólo por la hora** | **passed en código / sin recaptura visual** | Defecto de la sexta pasada (P2). `refreshFailed` deja de participar de esa decisión |
| **D17** | **Carta completa descartaba `canRetry` / `recovery` al dibujar el contenido** | **passed en código / sin recaptura visual** | Defecto de la sexta pasada (P2). Hub y carta completa ofrecen la misma salida, con la misma voz |
| **D18** | **El CTA de recuperación de Carta llamaba a la acción equivocada** | **passed en código / sin recaptura visual** | Defecto de la séptima pasada (P1). Un controlador compartido llama a **`charts.recoverNatalChart`** —la action aditiva de la octava, con desenlace discriminado— y encadena el **refresh esperable** del ciclo de capas (`useLayers().refreshAndWait`), bajo el mismo candado; 14 pruebas nuevas de comportamiento, y el cache natal deja de reutilizar un payload sin geometría |
| **D19** | **El ranking vacío retiraba el arco con el motivo equivocado** | **passed en código / sin recaptura visual** | Defecto de la séptima pasada (P2). Lista vacía → `active_transit_arc` ("hoy no hay tránsito mayor activo"); primer ítem distinto → `matching_transit_arc`; ranking sin dato → el arco se conserva |
| **D20** | **Un proveedor fallido —o insuficiente— se presentaba como éxito** | **passed en código / sin recaptura visual** | Defecto de la octava pasada (P1). Action aditiva `charts.recoverNatalChart` con desenlace discriminado; una carta guardada nunca se sustituye por otra igual de incompleta; 11 pruebas nuevas con el proveedor inyectado |
| **D21** | **El candado terminaba antes que el recálculo real** | **passed en código / sin recaptura visual** | Defecto de la octava pasada (P1). La cola sale del hook (`src/domain/refreshQueue.ts`) y `useLayers` expone `refreshAndWait`; el ciclo entero corre bajo el mismo gate. 12 pruebas nuevas de la cola + 4 del controlador |
| **D22** | **El fallo de recuperación se pegaba entre cartas y cuentas** | **passed en código / sin recaptura visual** | Defecto de la octava pasada (P2). Un store por `userId + inputHash`, con limpieza que nunca suelta un alcance ocupado; una completion vieja no publica sobre el alcance nuevo |
| **D23** | **Una caché negativa vieja del arco sobrevivía a un ranking vacío** | **passed en código / sin recaptura visual** | Defecto de la octava pasada (P2). La coherencia mira el ranking también cuando el arco no trae dato; la limitación deja de afirmar "es de otro día" |
| **D24** | **Tres documentos se contradecían sobre pasadas, archivos y VoiceOver** | **passed** | Defecto de la octava pasada (P2). Corregidos el conteo histórico de pasadas, la cifra de archivos tocados y la afirmación de que VoiceOver se había reverificado |
| **D25** | **La carta natal podía EMPEORAR por una corrida atrasada** | **passed en código / sin recaptura visual** | Defecto de la novena pasada (P1-A). La decisión de persistencia es monotónica y vive DENTRO de la mutación; `profileAstrologyCaches` copia el payload realmente elegido; al volver se vuelve a medir la carta final. 6 pruebas de interleaving con el orden de resolución bajo control |
| **D26** | **Los datos natales podían cambiar durante el cálculo y publicarse igual** | **passed en código / sin recaptura visual** | Defecto de la novena pasada (P1-A). La mutación revalida `birthDataId`, `birthDataHash` y `cacheKey`; si cambiaron, rechaza con `NATAL_BIRTH_DATA_CHANGED_DURING_CALCULATION` en vez de publicar la carta de datos que ya no existen |
| **D27** | **La action nueva se consumía con una firma escrita a mano** | **passed** | Defecto de la novena pasada (P1-B). `charts.recoverNatalChart` sale de `appRefs` (`anyApi` + `FunctionReference` manual) y pasa a `src/services/chartsApi.ts`, que reexporta la referencia GENERADA. Un cambio de contrato del backend ahora rompe el typecheck |
| **D28** | **Un refresco colgado dejaba la recuperación bloqueada tras desmontar** | **passed en código / sin recaptura visual** | Defecto de la novena pasada (P1-C). La cola tiene ciclo de vida explícito (`suspend`/`resume`): el cleanup corta TODAS las esperas con `LAYERS_REFRESH_UNAVAILABLE` y desacopla la corrida vieja del ciclo nuevo. Sin el arreglo, la prueba no falla: **se cuelga** |
| **D29** | **Una solicitud nueva heredaba la espera y los reintentos agotados de la vieja** | **passed en código / sin recaptura visual** | Defecto de la novena pasada (P1-D). El presupuesto de reintentos pertenece al TRABAJO, no a la cola, y el backoff es despertable: una solicitud más nueva corre enseguida y con su crédito entero. Single-flight intacto |
| **D30** | **Una completion natal vieja podía arrancar un refresco en el alcance nuevo** | **passed en código / sin recaptura visual** | Defecto de la novena pasada (P1-E). El controlador exige `vigente()` —montado + mismo alcance + salida todavía `reintentar`— antes de tocar el ciclo de capas global; si dejó de serlo, libera el gate en estado neutro y no publica ningún fallo |
| **D31** | **Una mejora de carta podía dejar o reescribir una interpretación LLM obsoleta** | **passed en código / sin recaptura visual** | Defecto de la novena pasada (P1-F). Claim, lectura pública y persistencia atados a `chartRevision`; la escritura final es un CAS contra la revisión y el `claimSeq`. Las filas legadas sin revisión se regeneran, nunca se publican |
| **D32** | **El registro podía desalojar un store todavía montado** | **passed en código / sin recaptura visual** | Defecto de la novena pasada (P2-A). La retención es explícita: `subscribe()` retiene, su función de baja libera y `observadores()` los cuenta. Nunca se desaloja un store ocupado NI observado, y al desuscribirse vuelve a ser desalojable |
| **D33** | **Una falla tardía del proveedor ignoraba la carta que otra corrida ya había publicado** | **passed en código / sin recaptura visual** | Defecto de la décima pasada (P1-A). La corrida que arranca SIN carta y falla no llegaba a la mutación: decidía sola con su snapshot. Ahora relee el estado vigente (`charts.recheckNatalStateForRun`) y aplica la misma medida final: ganadora suficiente ⇒ `cache_sufficient`; parcial ⇒ fallo honesto pero con la carta real; ninguna ⇒ igual que antes; datos natales cambiados ⇒ rechazo estable. 5 pruebas de interleaving con el proveedor diferido |
| **D34** | **Una carta suficiente podía quedar ligada al `birthDataId` histórico para siempre** | **passed en código / sin recaptura visual** | Defecto de la décima pasada (P1-B). El hash y el `cacheKey` describen los CAMPOS natales, no la fila: una fila natal nueva y semánticamente idéntica dejaba la carta apuntando a la vieja y `chartMatchesCompletionBirthData` nunca cerraba (`chart_pending` eterno). La mutación reafirma la identidad vigente en `natalCharts` y en `profileAstrologyCaches`, y conserva el payload y la procedencia del ganador byte por byte |
| **D35** | **Un éxito de recuperación podía saltear el refresh del día** | **passed en código / sin recaptura visual** | Defecto de la décima pasada (P1-C). Un solo predicado decidía dos cosas, y la salida sale de una query reactiva: un cálculo exitoso la movía a `ninguna` antes de la continuación y el refresco se salteaba. Ahora `mismoAlcance()` decide si el ciclo sigue y `falloVigente()` si un error se publica; un éxito del mismo alcance recalcula exactamente una vez |
| **D36** | **`suspend()`/`resume()` podía dejar el ciclo nuevo bloqueado por una action huérfana** | **passed en código / sin recaptura visual** | Defecto de la décima pasada (P1-D). El mutex era un booleano global que `suspend()` no soltaba: con una action colgada, `CALCULANDO…` quedaba para siempre. Ahora es un token por generación viva; la huérfana no publica flags ni resuelve waiters, y `useLayers` borra la clave del pedido para que el ciclo nuevo lo vuelva a pedir. Se documenta el precio: puede haber dos actions FÍSICAS entre generaciones |
| **D37** | **`cacheVersion` de la interpretación natal no invalidaba nada** | **passed en código / sin recaptura visual** | Defecto de la décima pasada (P2-A). Se persistía y no la miraba nadie: un bump v1 → v2 con el mismo prompt dejaba la fila v1 `ready` para siempre. Ahora cache hit, estado público y claim exigen revisión **y** versión; el CAS final también, así que una generación v1 tardía no vuelve a publicar v1 |
| **D38** | **`convex/_generated/api.d.ts` estaba incompleto y tres documentos decían que no hacía falta codegen** | **passed — gate 7/7 en verde tras el codegen de Codex (2026-08-18)** | Defecto de la décima pasada (gate de release). El artifact no enumeraba `convex/lib/natalGeometry.ts` ni `convex/lib/natalRevision.ts`: `ApiFromModules` deriva las FUNCIONES de los módulos que `fullApi` ya lista, no los módulos nuevos. `test/convexGeneratedApiGate.test.ts` compara el árbol con el artifact usando las reglas reales de `entryPoints()` y falló nombrando esos dos mientras el artifact estuvo desincronizado. Lo cerró **Codex** con `pnpm convex:codegen --typecheck disable` (exit 0, sin `convex dev` ni deploy); no se editó `_generated/` a mano. La suite completa quedó **1493/1493**, sin fallos deliberados |

### D7, corregido de verdad

`access.positions` **no es un entitlement**: en `convex/layers.ts` vale
`snapshot !== null`. Las dos pantallas de Carta lo leían como acceso, así que el
hub decía "TU CARTA SE ESTÁ CALCULANDO" sin mirar si algo se estaba calculando,
y la carta completa mostraba un **muro de Órbita Plus por un cálculo pendiente**
— a una cuenta que podía estar pagando.

Ahora el estado sale de `natalChartState` y separa siete hechos: query en vuelo ·
faltan datos natales · corrida activa · sin corrida y sin snapshot (recuperable)
· parcial · listo; y el límite de Plus se pregunta **por superficie**
(`natalHousesAccess` / `natalAspectsAccess`), que es la única forma en que ese
límite existe.

Medido: tras guardar, la pantalla estuvo **7 min 5 s** en el estado recuperable
**sin ninguna corrida activa**, y resolvió en menos de 5 s al tocar `Comprobar de
nuevo`. Con el copy anterior esos siete minutos decían "se está calculando".

### D10 y D11, los defectos de la cuarta pasada

**D10 — el detalle mentía sobre su análisis.** `bundle.today.transitArc` trae
únicamente el arco PRINCIPAL del día y es `ORB-TRN-001`. Al abrir otro `arcId`
desde el ranking, la pantalla armaba una pseudo-ventana con el ítem `ORB-TRN-002`
—cuyas fechas son extrapolaciones de la velocidad actual, no contactos
verificados— y le pasaba **ese** sobre al `TraceAccordion`. La captura `04`
mostraba por eso `ORB-TRN-002 · transit-ranking-v1` dentro de `ARCO DEL TRÁNSITO`:
método, precisión, limitaciones y bibliografía de otro cálculo.

No se cambió el texto ni el `analysisId`: se agregó el cálculo que faltaba.
`layers.getTransitArc({ localDate, timezone, arcId })` lee y
`layers.refreshTransitArc({ localDate, timezone, arcId })` calcula el
`ORB-TRN-001` de ESE arco —contactos reconstruidos, contacto activo seleccionado
por `arcId` exacto, seguimiento verificado de `planets/tropical` para ese contacto,
y alcance de cache propio `{ localDate, timezone, arcId }`—. Si el arco salió de la
lista, el sobre responde `unavailable` honesto; si falla el proveedor o el
seguimiento, `stale` / `partial` / `error` con su motivo. En la pantalla,
**titular, chip, ventana, pasadas, resumen, precisión y trazabilidad salen del
mismo sobre**; el ranking sólo aporta el NOMBRE del tránsito mientras su cálculo
específico viaja, y la pantalla lo dice.

Una respuesta tardía de un `arcId` no puede sobrescribir la pantalla después de
navegar a otro: el pedido pasa por un coordinador puro
(`src/domain/transitArcRequest.ts`) que emite un token por pedido, no repite el
mismo pedido y descarta lo que ya no está vigente. Probado por comportamiento.

**D11 — método duplicado en Vínculos.** El pie visible imprimía
`MÉTODO relationship-comparison-…` además del bloque `MÉTODO Y VERSIÓN` que el
acordeón ya publica con el título del análisis al lado. La copia sin contexto se
leía como ruido de desarrollo. Se quitó; la fecha humana de la última verificación
se conserva. El gate cubre las nueve pantallas con acordeón.

### D12–D14, los defectos de la quinta pasada

**D12 — dos identidades para el mismo tránsito.** La lista publicaba
`arc_v1_0pa9p2w` para Saturno–Marte y la cronología verificada del MISMO contacto
publicaba `arc_v1_19nh0r0`, así que la pantalla de detalle no reconocía como
principal el arco que sí lo era y caía al fallback aun abriendo el #1 de la lista.
La causa: `transitTimeline` sembraba la ventana del arco con
`verified:<fecha verificada>` y `transitLayers` metía esa marca en la semilla del
`arcId`, o sea que la identidad dependía de **cómo se había medido** la ventana —el
ranking la extrapola con la velocidad del día; el seguimiento la verifica contra
efemérides—. Ahora la identidad V1 es carta + planeta + aspecto + punto natal +
**ventana lógica**, la procedencia se descarta, y quien verifica pasadas propaga la
ventana lógica que el contacto ya traía. Las **fechas** siguen siendo las
verificadas: lo que dejó de moverse es el identificador. Una fila de cache con otra
identidad se recalcula en vez de publicarse.

**D13 — `Necesita tu hora` con la hora exacta guardada.** En el hub de Carta, con
hora exacta y los ejes todavía sin publicar, la fila del Ascendente mandaba a
corregir la hora mientras VoiceOver decía —bien— que el cálculo no había publicado
los ejes verificados. Eran dos ramas para el mismo hecho. Ahora el estado del eje
se resuelve una vez en el dominio (`angleRowView`) y de ahí salen el valor visible
y la voz: `Calculando…` cuando falta el cálculo, `Necesita tu hora` sólo cuando la
hora efectivamente falta, y el signo con su grado cuando está.

**D14 — reintentar algo que reintentar no arregla.** `natalChartState` marcaba
`canRetry: true` para cualquier `parcial`, incluida la carta sin hora, que es
completa para los datos que hay. El estado publica ahora la salida real
(`recovery`: `ninguna` · `cargar-datos` · `completar-hora` · `reintentar`) y
`canRetry` se deriva de ella: con cálculo pendiente se ofrece comprobar de nuevo,
con la hora faltante se ofrece completar la hora y ningún reintento.

### D15–D17, los defectos de la sexta pasada

**D15 — el par cacheado podía divergir.** El arreglo de D12 garantiza que un
CÁLCULO nuevo publique el mismo `arcId` en la lista y en el arco. La lectura no:
`layers.getForDate` y `layers.refreshForDate` sin efeméride rescatan los dos
sobres del cache **por separado**, así que una fila escrita antes de aquel arreglo
podía combinar un ranking cuyo primer ítem es A con un arco que describe B —y en
modo caché u offline durar indefinidamente—. Ahora todo camino que arma el bundle
exige el `arcId` **y** la tupla —planeta en tránsito, punto natal, aspecto—: sólo
el identificador dejaría pasar dos identidades iguales sobre contactos distintos,
y sólo la tupla dejaría pasar el mismo contacto con un identificador que la lista
de al lado no reconoce. Si no corresponden, el arco se descarta y va un
`ORB-TRN-001` honesto sin dato —nunca `stale`, porque no hay fila correspondiente
que mostrar, y nunca el ranking relabelado—; en el refresh, ese sobre reemplaza la
fila mala. Un ranking sin dato no descarta nada (no afirma nada); uno con la lista
vacía sí, porque afirma que hoy no encabeza ningún contacto.

**D16 — un fallo de refresco no hace aparecer la hora natal.** `natalChartState`
sumaba `refreshFailed` a la condición de "cálculo pendiente", así que una carta
cuyo único faltante era `exact_birth_time` pasaba de `completar-hora` a
`reintentar` en cuanto fallaba el refresco del día. Lo que falla ahí es traer el
cielo de hoy, que no tiene ninguna relación con la hora a la que naciste: el botón
prometía un final imposible y tapaba la única salida real. Un parcial que YA tenía
cálculo pendiente sigue siendo reintentable, con o sin ese fallo.

**D17 — la carta completa perdía la salida del estado.** La pantalla resolvía
`estado` con el resolvedor compartido y, al dibujar el contenido, se quedaba sólo
con la carta y la zona horaria: un parcial con los ejes o las doce casas
pendientes —recuperable según el dominio— no ofrecía nada. Ahora el estado viaja
al contenido y las dos pantallas de Carta dicen lo mismo: cálculo pendiente
recuperable → `FALTA UNA PARTE DEL CÁLCULO` con `COMPROBAR DE NUEVO` (misma voz en
VoiceOver que el hub); falta de hora → completar la hora, sin reintento; cálculo en
curso → esperar, sin botón; listo → ningún CTA. Sin muro de Plus por
disponibilidad de efeméride: `access.positions` sigue siendo snapshot y el límite
de plan se pregunta por superficie.

### D45–D49, los defectos de la decimocuarta pasada

**D45 — Mapa elemental reutilizaba copy editorial anterior al deploy.** El hash
de `ORB-NAT-001` no incluía la versión editorial, así que un snapshot listo con
`El tierra` sobrevivía indefinidamente. La versión editorial v2 entra sólo en
ese hash; `ORB-LUN-001` y `ORB-REL-001` no cambian.

**D46 — Vínculos reutilizaba la voz anterior.** La comparación lista tampoco se
invalidaba al cambiar el copy. La versión se separó de
`RELATIONSHIP_LAYERS_VERSION`: `ORB-REL-001` conserva v1 y sólo
`RelationshipComparison` usa `orbita-relationship-comparison-v2` en payload e
input hash. La pasada 15 lo verificó en runtime: 14/14 contactos expandidos usan
la voz `Su/Tu` y 0 repiten nombres propios.

**D47 — el singular decía `uno planeta` y los empates parciales podían decir
`uno planetas cada uno`.** Un helper de sintagma produce `un planeta` o el plural
completo. El fixture real 2/4/3/1 quedó recapturado después de invalidar también
el snapshot editorial v1.

**D48 — una caída del proveedor culpaba a un perfil completo.** Los perfiles de
fecha/carta guardan `zodiacSign: null` de forma deliberada. El fallback lo leía
como `other_sun_sign` y ofrecía `COMPLETAR SUS DATOS` aun con fecha, hora y lugar.
Ahora ese caso es `comparison_ephemeris`: se atribuye al cálculo y la semántica
de dato realmente ausente se conserva para un perfil sin fecha ni signo.

**D49 — un mapa parcial de una sola posición decía `uno de los uno planetas
disponibles`.** El caso soportado de total 1 usa `el único planeta disponible`.
Quedó cubierto junto con artículos, singular/plural y empates.

Los cinco defectos se reprodujeron con regresiones rojas y cerraron con focales
**91/91**, suite **1537/1537** y una auditoría final **0 P0/P1/P2** *(cifras de
la pasada 15; el conteo vigente es 2145/2145 — ver el bloque del 2026-08-19)*.

### D44, el defecto de la decimotercera pasada

**D44 — `refreshAndWait()` quedaba detrás de una action colgada del MISMO
alcance.** El relevo de D42 decía: *una corrida cuyo alcance ya no es el vigente
no puede seguir siendo dueña del ciclo*. Es correcto, y por eso mismo el cuelgue
sobrevivía **justo donde el alcance no cambiaba**. Con el refresco automático A
en vuelo y sin resolver nunca, la recuperación natal terminaba
`recoverNatalChart` y llamaba a `refreshAndWait()` para el **mismo** usuario, día
civil, zona y hora civil. `useLayers` armaba la clave con el `attempt` que tenía
en la mano —estado de React, que en el mismo tick todavía vale lo mismo—,
`pedirYEsperar` encolaba esa clave **idéntica**, y la cola no relevaba nada: A
seguía siendo la dueña, B quedaba `pending` y el waiter —**con el candado natal
tomado**— no terminaba nunca. Reproducido: `runs=1`, `pending` con el mismo
pedido, `waiting=1`, `busy=true`, promesa sin resolver. Y ni siquiera era una
deduplicación honesta: si A terminaba alguna vez, recién entonces arrancaba una
segunda action idéntica.

La causa es que el nonce del alcance —el `intento`— vivía en el estado de React,
y el estado de React no cambia en el mismo tick: `setAttempt(v => v + 1)` no lo
arregla, porque el valor nuevo recién existe en el render siguiente y la clave se
arma antes de cualquier render. Ahora el contador vive en el **ciclo**
(`intento()` / `reservarIntento()`), que es su única fuente de verdad, y
`pedirYEsperar` **no recibe una clave armada sino cómo armarla**
(`(intento) => string | null`): reserva el intento siguiente y llama al armador
con ÉSE número, en el mismo instante sincrónico en que encola. **Es imposible
encolar un pedido esperable con un intento viejo, porque quien llama no elige el
intento.** La clave se arma en un solo lugar (`claveDeAlcance`), así que las dos
vías producen la misma cadena para los mismos datos, y el efecto del reloj usa
`ciclo.intento()` —no el espejo de React— para que el render posterior a la
reserva reconozca el pedido como propio y **no encole un duplicado**.

**La vía automática no cambió y no debía cambiar:** `pedir(clave, …)` con una
clave idéntica sigue sin encolar nada. La semántica distinta es deliberada y vale
sólo para la vía forzada, que por definición pide trabajo nuevo sobre datos que
acaban de cambiar. El precio es el mismo de cualquier relevo: una action física
huérfana, sólo cuando había una corrida viva. **No es un temporizador ni un
spinner apagado por consuelo**: el progreso se prueba contando acciones físicas,
con la action bajo control y promesas diferidas.

### D42–D43, los defectos de la duodécima pasada

Los dos viven en la misma costura que la undécima dejó tocada, y ninguno se veía
mirando la cola o el ciclo por separado. Las pruebas nuevas usan **promesas
diferidas**: cada corrida queda suspendida hasta que la prueba la resuelve o la
rechaza, así que el interleaving se controla de verdad en vez de esperar a que el
reloj colabore.

**D42 — una action colgada bloqueaba PARA SIEMPRE a un alcance más nuevo.**
`drain()` quedaba parado en `await deps.run(A)`. Si A no resolvía nunca —la red
cortada a mitad de la action— B y C, con otra clave, quedaban `pending` para
siempre: `busy` en `true`, `CALCULANDO…` permanente, y volver de background sólo
movía reloj e intento sin rotar la generación viva. La cola garantizaba
single-flight y "la más reciente gana", pero eso describía la COLA, no el
PROGRESO: el mutex era del ciclo y la pertinencia no estaba modelada por ningún
lado. Ahora la clave del último pedido admitido —`cuenta|día|zona|hora|intento`,
los cinco ejes que hacen que un recálculo deje de servir— viaja con cada pedido
como **alcance**, y cuando el de lo pendiente difiere del de la corrida viva la
cola hace un **relevo**: avanza la generación, suelta el candado, deja la corrida
vieja huérfana —sin publicar flags, sin resolver waiters, sin pisar el resultado
de la nueva, con sus esperas transferidas al trabajo vigente— y arranca la
pertinente. **No es un temporizador**: el disparador es el cambio de alcance, y
hay una prueba dedicada a que pasar cinco turnos del bucle de eventos sin un
alcance nuevo **no** releva nada. El relevo se decide al final del tick, así que
la secuencia física es **A/C** —B se descarta como intermedia— y una corrida que
termina sola dentro del mismo tick gana por el camino normal. El precio, dicho:
cada relevo paga una huérfana física más, sólo cuando el alcance cambió y la
corrida anterior seguía viva; es el mismo total de acciones, en paralelo en vez
de en fila. Dentro de una misma generación viva sigue habiendo una sola action.

**D43 — `pedirYEsperar()` envenenaba la clave durante la suspensión.** Escribía
la clave del pedido **antes** de llamar a `requestAndWait`, que con el ciclo
suspendido rechaza en el acto y **sin encolar nada**. La clave quedaba anotada
por un pedido que nunca salió: al reabrir, el efecto la veía como propia y se
salteaba el refresco, así que la pantalla se quedaba con el sobre viejo y sin
nada en vuelo que lo arreglara. Ahora la cola expone `accepts()` —exactamente la
condición con la que `requestAndWait` decide rechazar— y el ciclo la consulta en
el **mismo instante sincrónico** en que escribiría la clave: entre preguntar y
encolar no se intercala nada, y con la cola cerrada la clave queda como estaba.

### D39–D41, los defectos de la undécima pasada

Los tres viven en una **costura**, no en una mitad: cada pieza era correcta y la
combinación no. Las pruebas nuevas controlan el orden real —el claim demorado
hasta después del bump, el desmonte con algo pendiente, la solicitud aceptada
durante la suspensión— en vez de mirar cada lado por separado.

**D39 — un claimant de `cacheVersion` vieja destruía la lectura vigente.** El CAS
de la escritura ya comparaba la versión configurada con la del texto, pero el
claim se toma antes y medía la fila contra la versión que traía el claimant. Una
action que arrancó en v1 y aterriza con la configuración ya en v2 veía la fila v2
como "de otra versión", la tomaba, incrementaba `claimSeq` y la dejaba `pending`
v1 con el payload en null. Con una generación v2 en vuelo, v2 terminaba en
`claim_lost` y v1 en `cache_version_changed` y no quedaba nadie generando; con una
lectura v2 ya `ready`, el payload publicado se perdía aunque la escritura final
del claimant se rechazara igual. Ahora la comparación de versión está **antes de
consultar o mutar `natalInterpretations`**: el claimant atrasado no toma turno, no
incrementa nada, no toca status ni payload y no programa ninguna generación
(`stale_cache_version`, decisión interna tratada como no-op — ni error visible ni
cache hit).

**D40 — `suspend()`/`resume()` ejecutaba el mismo refresco dos veces.** Con A en
vuelo y B como única pendiente, el cleanup suspendía la cola —que **conserva** lo
pendiente— y además borraba la clave del último pedido admitido. Al remontar,
`resume()` tomaba B y el efecto, viendo la clave en blanco, volvía a encolar la
misma B: secuencia física **A/B/B**. Si la B retomada salía bien y el duplicado
fallaba, `refreshFailed` quedaba en `true` sobre datos recién calculados. La
costura pasó a ser un módulo puro (`src/domain/refreshCycle.ts`) con una sola
regla: la clave sobrevive **exactamente cuando su pedido sobrevive**. Con algo
pendiente se conserva; sin nada pendiente se borra, para que el primer refresh no
se pierda con el doble montaje de StrictMode. Una clave nueva —otro día civil,
otra zona— encola normalmente: B se retoma y C queda como la única pendiente.

**D41 — `request()` durante la suspensión encendía `CALCULANDO…` sin trabajo.**
`encolar()` publicaba busy aunque la cola estuviera suspendida: la solicitud
quedaba pendiente, `busy()` decía `false` y la UI mostraba el estado de cálculo
por trabajo que ningún ciclo vivo estaba haciendo. Ahora, suspendida, la cola
acepta y conserva la solicitud —la más reciente gana, como siempre— **sin
publicar busy ni failed**, y `resume()` sincroniza el flag con lo que la
generación viva va a hacer de verdad: `true` si toma trabajo, `false` si no hay
ninguno. El pedido hecho durante la suspensión corre una vez al reanudar.

### D33–D38, los defectos de la décima pasada

Cinco de los seis son otra vez de **concurrencia**, y el sexto es un gate de
release que ninguna suite miraba. Las pruebas nuevas vuelven a mantener la
operación EN VUELO —el proveedor diferido, la action colgada, el cálculo
suspendido— y a decidir el orden de resolución.

**D33 — una falla tardía ignoraba una carta concurrente ganadora.** Cuando una
corrida arranca **sin carta** y su proveedor falla, no tiene candidato: nunca
llega a la mutación, que es donde vive la decisión con el estado vigente. Así que
decidía sola, con el snapshot que había tomado antes de llamar al proveedor, y
devolvía `provider_failed`, `sufficient:false`, `chart:null` aunque otra corrida
ya hubiera publicado una carta suficiente. `recoverNatalChart` informaba un fallo
falso y la action legacy podía lanzar con una carta válida en la base. Ahora ese
camino relee el estado vigente para la MISMA identidad
(`charts.recheckNatalStateForRun`, query interna cerrada) y aplica la misma
medida final: ganadora suficiente ⇒ `cache_sufficient` sin detalle de error;
ganadora parcial ⇒ el fallo sigue siendo honesto pero devuelve esa carta real;
ninguna ⇒ igual que antes; datos natales cambiados durante la espera ⇒ el mismo
rechazo estable `NATAL_BIRTH_DATA_CHANGED_DURING_CALCULATION`, nunca un éxito
cruzado.

**D34 — la carta correcta apuntaba a la fila natal equivocada.** El hash y el
`cacheKey` describen los CAMPOS natales, no la fila que los guarda: una fila
natal más nueva y semánticamente idéntica —volver a cargar los mismos datos,
reescribir el alta— produce el mismo `cacheKey`. La carta que ya existía ganaba
—y está bien que gane— pero sólo se le parcheaba `updatedAt`, así que seguía
apuntando al `birthDataId` histórico; el cache de perfil, igual.
`chartMatchesCompletionBirthData` exige la fila vigente exacta, de modo que el
onboarding quedaba en `chart_pending` **para siempre** con el payload correcto
delante. Ahora la misma mutación monotónica reafirma la identidad vigente en las
dos tablas —`userId`, `birthDataId`, `birthDataHash`, `cacheKey`,
`natalChartId`, `cacheVersion`— sin tocar el payload, el `providerVersion` ni el
`calculationVersion` del ganador, y sin abrir filas duplicadas.

**D35 — un éxito podía saltear el refresh del día.** El controlador exigía UN
predicado —montado + alcance + salida todavía `reintentar`— para dos decisiones
distintas. Pero la salida viene de una query REACTIVA: el cálculo que funciona
hace que la carta deje de necesitar reintento, y esa actualización puede llegar
antes que la continuación. El predicado único respondía "ya no es vigente" y el
refresco del día —la mitad que arma el sobre con la geometría recién calculada—
no corría nunca. Ahora son dos: `mismoAlcance()` decide si el ciclo sigue, y
`falloVigente()` decide si un error se publica. Un cálculo publicable del mismo
alcance recalcula **exactamente una vez**; un cambio real de cuenta o de carta lo
impide; y un error tardío que ya no describe nada no queda pegado.

**D36 — el ciclo nuevo podía quedar bloqueado por una action huérfana.** El mutex
de la cola era un booleano global: `suspend()` cortaba las esperas pero lo dejaba
tomado, así que si la action de A no resolvía nunca, `resume()` no podía arrancar
B y `CALCULANDO…` se quedaba visible sin trabajo que lo justificara. No se puede
tener a la vez single-flight FÍSICO global y progreso si A no resuelve nunca: la
semántica correcta es **single-flight por generación viva**. `suspend()` avanza la
generación, corta las esperas, suelta el token y publica que el ciclo cerrado no
está ocupado; una corrida sólo limpia al terminar si todavía es dueña del token,
así que la huérfana no apaga a B, no toca `failed` y no resuelve waiters nuevos.
El precio se dice en el código y acá: **puede haber dos actions físicas vivas
entre generaciones**. Y el pedido que estaba en vuelo no se pierde: `useLayers`
borra la clave del último pedido admitido en el cleanup, así que el montaje nuevo
lo vuelve a pedir —que es lo que evita perder el primer refresh con el doble
montaje de StrictMode—.

**D37 — la versión de caché de la lectura natal no invalidaba nada.**
`ORBITA_LLM_NATAL_CACHE_VERSION` se persistía en cada fila de
`natalInterpretations` y no la miraba nadie: lectura pública, estado y claim
validaban sólo `chartRevision`. Un bump v1 → v2 con el mismo prompt y la misma
carta dejaba la fila v1 `ready` para siempre. Ahora toda decisión de cache hit,
readiness y claim exige revisión **y** versión: una fila de otra versión queda no
verificable, se declara `pending` —no `error`, porque lo que corresponde es
regenerarla—, no frena la generación nueva y se toma un claim nuevo sobre la
misma fila. El CAS final exige además que la versión configurada AHORA sea la de
ese texto, así que una generación que arrancó en v1 y vuelve después del bump no
vuelve a publicar v1. Sin cambios de schema y sin cambios de firma pública.

**D38 — el artifact generado estaba incompleto, y la documentación lo negaba.**
`convex/lib/natalGeometry.ts` y `convex/lib/natalRevision.ts` existían en el árbol
y `convex/_generated/api.d.ts` no los enumeraba. Lo que `ApiFromModules` deriva son
las FUNCIONES de los módulos que `fullApi` ya lista —por eso
`api.charts.recoverNatalChart` compila sin regenerar—; `fullApi` lo escribe el
codegen archivo por archivo, y un módulo nuevo no aparece solo. El gate
`test/convexGeneratedApiGate.test.ts` compara el árbol contra el artifact usando
las reglas reales de `entryPoints()` del bundler de Convex 1.42.1 —no una lista
de nombres— y **falló a propósito** mientras el artifact estuvo desincronizado,
nombrando esos dos módulos; se auto-prueba con artifacts sintéticos para que su
verde también signifique algo.

**Cerrado el 2026-08-18.** Lo corrió **Codex**, con
`pnpm convex:codegen --typecheck disable` (exit 0): el workflow del repo le
reserva ese comando al backend, y `convex/_generated/**` no se editó a mano. El
codegen agregó al artifact los dos módulos que el gate nombraba —contra `52836ad`
el archivo suma +26 líneas y pasa de 58 a 71 entradas en `fullApi`, de las cuales
11 venían del codegen de la certificación del 16/08 y **2** de esta corrida—.
Reverificado después: gate **7/7** exit 0, `pnpm typecheck` exit 0, suite completa
**1493/1493** (93 suites, 0 fail) y piso 1493/745. **No se corrió `convex dev`,
`finishPush` ni deploy alguno.** Las afirmaciones de "no hace falta codegen"
quedaron corregidas en `convex/CHANGELOG.md`, `src/services/chartsApi.ts`, el
README del audit y este archivo.

### D25–D32, los defectos de la novena pasada

Los ocho son de **concurrencia**. Es la categoría que la octava pasada no cubrió:
1423 pruebas en verde y ninguna que controlara el orden real de resolución. Todas
las pruebas nuevas de esta pasada mantienen la operación en vuelo —el proveedor
suspendido, la action colgada, el backoff dormido— y deciden cuándo y en qué
orden termina cada cosa.

**D25 — la Carta podía EMPEORAR.** `runNatalChartCalculation` tomaba un snapshot
del estado ANTES de llamar al proveedor, y `persistCalculatedNatalChart` volvía a
leer la fila por `cacheKey` pero la parcheaba a ciegas con lo que le llegara. Dos
corridas sobre la misma carta A incompleta —dos toques, el hub y la carta
completa, el prewarm y la persona— terminan en cualquier orden: la que llegaba
tarde traía A vieja, o una respuesta C que tampoco alcanzaba, y la escribía encima
de la B completa que la otra ya había publicado. `profileAstrologyCaches` se iba
con ella. Ahora la decisión final es **monotónica** y vive DENTRO de la
transacción: una fila que alcanza no se reemplaza nunca —ni por un parcial
atrasado ni por otra completa más vieja del mismo `cacheKey`— y una fila que no
alcanza sólo se reemplaza por algo que sí. El cache de perfil copia el payload
**realmente elegido**, no el candidato. Y al volver de la mutación se vuelve a
medir la carta final: si otra corrida ganó con una carta que alcanza, el desenlace
es éxito almacenado (`recovered`/`stored`) y no un fallo falso.

**D26 — los datos natales podían cambiar en el medio.** El proveedor tarda, y en
esa ventana alguien puede editar su hora de nacimiento. Lo calculado describe a la
persona natal anterior. La mutación revalida ahora `birthDataId`, `birthDataHash`
y `cacheKey` contra los datos vigentes y rechaza con
`NATAL_BIRTH_DATA_CHANGED_DURING_CALCULATION`: la salida es reintentar, ya con los
datos nuevos. El `returns` de `recoverNatalChart` **no cambia** —las dos actions
ya podían rechazar—.

**D27 — una firma escrita a mano no es un contrato.** `charts.recoverNatalChart`
es una superficie NUEVA y estaba cerrada en el backend, pero el front la consumía
por `appRefs`, que la enlazaba con `anyApi` y repetía su `returns` a mano. Un
cambio de contrato del backend habría seguido compilando y el error habría
aparecido en runtime, sobre el botón. Ahora se consume por
`src/services/chartsApi.ts`, que reexporta la referencia generada con el mismo
criterio que `layersApi.ts` y `relationshipsApi.ts`. Las superficies legacy de
`appRefs` no se migran en esta tanda: el gate cubre específicamente la action
nueva y su consumidor real.

**D28 — un refresco colgado mataba el botón.** `requestAndWait` movía sus waiters
activos fuera del arreglo global antes del `await`, y el cleanup de `useLayers`
sólo ponía `mounted = false`. Si la action no resolvía y el árbol se desmontaba,
la promesa de recuperación no terminaba nunca: el candado natal quedaba tomado y
`CALCULANDO…` no se desbloqueaba **ni volviendo a montar**. La cola tiene ahora
ciclo de vida explícito: `suspend()` corta TODAS las esperas —las de la corrida en
vuelo y las que esperaban turno— con `LAYERS_REFRESH_UNAVAILABLE`, y desacopla la
corrida vieja del ciclo nuevo. No se cancela la action: una action Convex que ya
salió no se puede cancelar, y fingir que sí sería mentir. Lo pendiente sobrevive y
`resume()` lo retoma, sin waiters huérfanos y sin abrir una segunda acción.

**D29 — la solicitud nueva era rehén de la vieja.** El contador de reintentos era
global a la cola: si A gastaba el presupuesto y B llegaba mientras A dormía su
backoff, B esperaba el resto de esa espera y su primer fallo se contaba como
intento 4. El intento pertenece ahora al TRABAJO, y el backoff es despertable: una
solicitud más nueva lo interrumpe, corre enseguida después de la action vigente y
arranca con su crédito entero. Los waiters de la vieja se transfieren al trabajo
vigente y terminan exactamente una vez. Single-flight intacto.

**D30 — una completion vieja arrancaba trabajo en el alcance nuevo.** Los stores
están separados por `userId + inputHash`, pero el controlador encadenaba
`recalcularCapas` de forma incondicional y lo que recibía era el refresco GLOBAL.
Si cambiaba la cuenta, la carta o la salida de recuperación mientras el proveedor
respondía, la operación vieja largaba un refresco visible sobre el alcance nuevo.
Ahora el controlador exige `vigente()` —montado, mismo alcance, salida todavía
`reintentar`— antes de tocar el ciclo de capas: si dejó de serlo, libera el gate
en estado NEUTRO y no llama a nada. Y un error tardío que ya no describe nada no
se guarda, así que no reaparece si ese hash vuelve a ser recuperable.

**D31 — una interpretación LLM podía quedar describiendo otra carta.** Una mejora
reescribe el payload **sobre el mismo `natalChartId`**, y `natalInterpretations`
se identificaba sólo por carta + feature + `promptVersion`. Una lectura `ready`
escrita sobre la carta parcial seguía pasando como cache hit sobre la carta
completa —texto sin Ascendente ni casas al lado de una rueda que ya las tiene— y
una generación que arrancó con el payload parcial podía terminar después de la
mejora y persistir ese texto encima del estado nuevo. Claim, lectura pública y
persistencia quedan atados a `chartRevision` (hash estable del payload), y la
escritura final es un **CAS**: la carta tiene que seguir en esa revisión y la
generación tiene que seguir siendo dueña del `claimSeq`. Las filas legadas sin
revisión no pueden demostrar sobre qué carta se escribieron: se regeneran, nunca
se publican. Schema **aditivo**, los dos campos opcionales.

**D32 — el registro desalojaba un store montado.** El límite de ocho sólo
protegía `ocupado()`. Un store quieto pero con una pantalla viva podía ser
desalojado, y el siguiente `storeFor` del mismo alcance devolvía otro objeto —otro
candado— mientras la primera pantalla seguía ahí. La retención es ahora explícita
y verificable: `subscribe()` retiene, la función que devuelve libera, y
`observadores()` los cuenta. No se supone nada sobre cuándo React termina con un
componente; se pregunta. Al desuscribirse, el alcance vuelve a ser desalojable, así
que la memoria no crece sin límite.

### D20–D24, los defectos de la octava pasada

**D20 — éxito no era éxito.** El botón ya llamaba a la operación correcta, pero
la operación declaraba éxito pasara lo que pasara: si el proveedor fallaba,
reafirmaba la carta parcial y resolvía con ella —y el controlador, que sólo entra
en `fallo` ante un rechazo, dejaba la pantalla `quieto`, silenciando el intento—;
si el proveedor respondía con un payload que seguía sin casas ni ejes, lo
persistía **encima** del anterior sin comprobar nada. Ahora la decisión es una
tabla pura (`resolveNatalCalculationDecision`): con una carta guardada que no
alcanza, sólo se escribe algo nuevo si ese algo sí alcanza, medido con la misma
regla de geometría que publica la Carta. Y una action aditiva
—`charts.recoverNatalChart`, `args: {}` y `returns` discriminado— devuelve el
desenlace, así que la pantalla dice `No pudimos completar el cálculo ahora.` y
`REINTENTAR` cuando el intento no mejoró nada, con la carta parcial intacta.
`charts.calculateOrCreateNatalChart` **no cambia**: el alta, el editor de perfil y
la Carta web siguen recibiendo una carta o un rechazo, exactamente como antes.

**D21 — el candado se soltaba en el medio.** El recálculo del día se disparaba sin
esperarlo: la fase pasaba a `quieto` y el gate quedaba libre mientras el refresco
ni siquiera había salido, así que un segundo toque volvía a llamar la operación.
La cola del recálculo salió del hook a `src/domain/refreshQueue.ts` —misma
política de single-flight, "la más reciente gana" y reintento de la carrera del
alta— y `useLayers` expone `refreshAndWait()` junto al `refresh()` de siempre, que
no cambia. La vía esperable **no** abre una acción paralela: entra en la misma
cola y su promesa termina con esa solicitud. El ciclo entero —calcular la carta,
rearmar el día— corre bajo el mismo candado, y `CALCULANDO…`, `disabled` y la
región viva cubren las dos mitades porque salen de la misma fase.

**D22 — el fallo era de la app, no de la carta.** El store era único de módulo:
un error podía reaparecer en otra cuenta o sobre otra carta recuperable. Ahora hay
**un store por `userId + inputHash`**, con un valor estable para los huecos. El
hub y la carta completa de la misma carta comparten candado; otra cuenta u otra
carta empiezan quietas; una corrida vieja publica en el alcance que la pidió y no
puede tocar el nuevo; y cuando la carta deja de necesitar reintento, el fallo se
da por visto.

**D23 — una caché negativa que no caducaba.** La coherencia del par
`(ranking, arco)` daba por bueno cualquier arco sin dato antes de mirar el
ranking, así que un sobre cacheado que prometía calcular el arco del tránsito
principal convivía con una lista vacía que decía que hoy no hay ninguno. Ahora la
lista se mira siempre: sin `data` el arco se conserva; con `items: []` se
normaliza a `active_transit_arc` y el código contrario se descarta; con un primer
ítem y sin arco correspondiente, `matching_transit_arc`. La limitación decía *"el
que estaba guardado es de otro día"* —puede ser de otra hora del mismo día— y
ahora dice *"ya no corresponde a la lista actual"*, sólo cuando de verdad había un
arco con dato que retirar.

**D24 — la documentación se contradecía.** Este archivo afirmaba que VoiceOver
había sido *"reverificado en esta pasada"*: la séptima no abrió simulador. La
evidencia vigente se hereda de la tercera y el bloqueo sigue igual, porque exige
un iPhone físico. El README del audit decía *"seis pasadas"* cuando ya iban siete,
y su cifra de archivos tocados excluía los documentos sin decirlo.

### D18–D19, los defectos de la séptima pasada

**D18 — el botón prometía un arreglo que no podía hacer.** El estado de la Carta
declaraba bien `reintentar` cuando faltaban los ejes verificados o las doce
cúspides, pero las dos pantallas cableaban esa salida a `useLayers().refresh`, que
sólo ejecuta `layers.refreshForDate`. Esa acción rearma las capas del día y la
efeméride natal; la geometría sale de la carta persistida en `natalCharts`, y la
única operación que la escribe es `charts.calculateOrCreateNatalChart`. "COMPROBAR
DE NUEVO" podía tocarse indefinidamente sin que apareciera nunca el Ascendente.

Ahora las dos pantallas usan **el mismo controlador**: un store puro
(`src/domain/natalChartRecovery.ts`, sin React ni Convex) sobre el candado
sincrónico de D9, expuesto por un hook con **un solo store de módulo** para toda
la app —el hub queda montado debajo de la carta completa, así que un candado por
pantalla no alcanzaba—. Calcula la carta y **después** vuelve a pedir el día, en
ese orden: al revés, `layers.persistRefresh` rechazaría el refresco contra su
propia causa. Con la salida `completar-hora` no llama a nada y no anuncia ningún
cálculo. Un fallo se dice en región viva, deja la carta parcial visible y permite
reintentar; en curso, el botón queda bloqueado con `CALCULANDO…` y la voz
acompaña.

**El borde que faltaba.** Aun con el CTA arreglado, el reintento podía seguir sin
cambiar nada: la carta se busca por un `cacheKey` armado con los DATOS natales, y
una corrida en la que el proveedor no devolvió casas —y por lo tanto tampoco
Ascendente— dejaba una fila incompleta que la action reutilizaba para siempre.
Ahora la action mide la **suficiencia** del payload con la misma regla de
geometría que publica la Carta; con hora exacta e incompleta vuelve al proveedor, y
sin hora exacta el cache sano se reutiliza igual que antes.

**D19 — la lista vacía no significa "falta calcular".** El sobre del arco retirado
declaraba siempre `matching_transit_arc`, que se lee *"Todavía no está calculado el
arco del tránsito que hoy encabeza tu lista"*. Con la lista vacía, la lista ya
afirmó que **no hay** tal tránsito: el sobre prometía el cálculo de algo que no
existe. Ahora la lista vacía declara `active_transit_arc` —*"Hoy no hay ningún
tránsito mayor activo para formar un arco"*, el código canónico que el producto ya
usaba—, un primer ítem que no es el del arco conserva `matching_transit_arc`, y un
ranking sin dato no contradice a nadie: el arco guardado se conserva.

### D9, el defecto de la tercera pasada

`saving` y `borrando` son `useState`: se aplican en el render siguiente, así que
dos toques del mismo render pasaban los dos. En el borrado era peor —`borrando`
se encendía **después** de la confirmación, así que dos toques abrían dos
alertas—. Corregido con un candado sincrónico (`src/domain/exclusive.ts`) tomado
**antes del primer `await`** y liberado en `finally`.

---

## Correcciones de la quinta pasada (2026-08-17)

| Estado | Qué estaba mal | Qué se hizo |
|---|---|---|
| 04 | El ranking y el arco derivaban dos `arcId` distintos para el mismo tránsito, así que hasta el #1 de la lista caía al fallback | La identidad dejó de depender de la procedencia de la ventana. `today.transitArc.data.arcId === today.transitRanking.data.items[0].arcId` para la misma tupla semántica; el cache viejo con otra identidad se recalcula. **Recapturado en runtime en la pasada 15.** |
| 06 / 11 | La fila del Ascendente decía `Necesita tu hora` aunque la hora exacta estuviera guardada y sólo faltara el cálculo del eje | Vista y voz salen del mismo hecho: `Calculando…` mientras el eje no llega, `Necesita tu hora` sólo sin hora. **Sin recaptura visual** |
| 06 / 11 | Un `parcial` limitado sólo por la hora quedaba marcado como reintentable | `canRetry` se deriva de la salida real; la hora se completa, no se reintenta. **Sin recaptura visual** |

## Correcciones de la cuarta pasada (2026-08-17)

| Estado | Qué estaba mal | Qué se hizo |
|---|---|---|
| 04 | El detalle de un arco no principal se armaba con el ítem del ranking y le pasaba ESE sobre al acordeón | Contrato aditivo `layers.getTransitArc` / `layers.refreshTransitArc`: el arco pedido tiene su propio `ORB-TRN-001`, con su cronología verificada, su alcance de cache y sus estados honestos. Todo el cuerpo del detalle sale de ese único sobre. **Desplegado en la 14 y cerrado en runtime en la 15.** |
| 09 | El pie repetía `MÉTODO <versión>` además del bloque del acordeón | El identificador crudo salió del pie visible. Método y versión quedan sólo dentro del `TraceAccordion`; la fecha humana de la última verificación se conserva |

## Correcciones de la tercera pasada

| Estado | Qué estaba mal | Qué se hizo |
|---|---|---|
| 03 | Los ordinales `10` y `11` se partían en dos renglones | La columna pasó de `width: 14` fijo a `minWidth: 18` + `numberOfLines={1}`. Verificado con 11 filas reales en 375, 393 y 440 |
| 04 | Se comparaba con la trazabilidad plegada contra un frame desplegado | Se abre el acordeón antes de capturar, y se verifica que abrió |
| 08 | `Aire 1 · Urano` y al lado `AIRE SIN PLANETAS` | `SIN PLANETAS` sólo con recuento 0; con 1 o más, `MENOS PRESENTE`; empates nombran a los dos |
| 09 | Las cinco barras de cobre | El tono sale del balance apoyo/tensión de cada dimensión (`dimension.value`), azul para lo fluido y cobre para tensión/ambivalencia, y se declara en la leyenda y en la etiqueta accesible |
| 10 | `1/6`, "las otras cinco", riel cobre | Escalera canónica exacta: `1/5`, "una dimensión / las otras cuatro", `Proyecto en común` bajo hora y lugar, riel azul |
| 12 | Evidencia obsoleta y posible divergencia lista/dial | Una sola definición de qué anillos se dibujan (`mandalaGeometry`), concordancia completa. Recapturado: `Ves 2 anillos de 4`, y el dial dibuja dos |
| 06 | Faltaba la fecha del día en la barra superior | Agregada, con el mismo formato que Hoy y Tránsitos |

---

## Accesibilidad

| Dimensión | Resultado | Cómo se midió |
|---|---|---|
| 375 / 393 / 440 pt | **passed** | Cada pestaña ≥ 74×44 en los tres; ordinales de dos dígitos verificados en los tres |
| Dynamic Type | **passed** | `accessibility-extra-large`: el ancho se conserva y la barra crece a 61 pt |
| Objetivos táctiles | **passed** | Pestañas 74–87 × 44 · botones de hoja 166×44 |
| Reduce Motion | **passed** | Dos capturas del Umbral a 3 s: idénticas pixel a pixel |
| Contraste | **passed** | 21 pares contra los tres fondos reales + 3 comparaciones entre barras; mínimo de **texto 4,80:1** (`logs3/contrast.log`) |
| Color como único medio (WCAG 1.4.1) | **passed** | El tono de las barras de Vínculos va también en la etiqueta accesible y en la leyenda visible. Azul y cobre difieren en tono, no en luminancia (1,53:1): por eso no se apoya nada sólo en el color |
| Orden de foco, rol, valor, estado, acciones | **passed** | Siete pantallas recorridas |
| VoiceOver con el lector encendido | **blocked (externo)** | El lector no existe en el runtime del simulador. La evidencia vigente se **hereda de la tercera pasada**; ni la séptima, ni la octava, ni la novena abrieron simulador. Levantar el bloqueo exige un iPhone físico |
| Live region del recálculo | **not evaluated** | El árbol de `idb` no publica `accessibilityLiveRegion` |
| Rol `tab` / estado `selected` de la barra | **not measurable** | Está en el código y con gate; `idb` no mapea ese rol |

---

## Diferencias declaradas contra el frame (no son PASS por explicarlas)

1. **La rueda de la Carta es real** (06/11): el frame dibuja una ilustración
   rotulada `NO CODIFICA TUS GRADOS`; la implementación dibuja la carta natal
   verdadera y por eso no lleva ese rótulo.
2. **Los datos son otros**: la cuenta QA reparte `2/4/3/1` y el frame `6/3/1/0`;
   el arco real tiene un contacto y el del frame tres; la comparación real da
   tres dimensiones fluidas y el fixture del frame dos. Son datos, no defectos.
3. **Formato de la fecha superior**: el frame escribe `VIE 15 AGO`; la app
   escribe `LUNES 17 DE AGOSTO`, que es el formato que ya usan Hoy y Tránsitos.
4. **Dynamic Type en la barra**: en el tamaño accesible más grande, dos labels
   se parten a mitad de palabra. Nada se recorta ni se superpone.

---

## Checks

> **Los conteos de suite de esta sección son HISTÓRICOS.** Los checks de código
> vigentes son los del bloque `## Estado vigente (2026-08-19)`, al inicio:
> typecheck PASS y **2145/2145 en 196 suites**. Lo de abajo se conserva porque
> sigue siendo la evidencia de la certificación **visual y runtime** de los
> pases 14–15, que no se recapturó después.

**Los checks de código de esa certificación son los de la DECIMOCUARTA pasada**
(`logs14/`); la pasada 15 sólo agrega evidencia runtime en `logs15/`. Los
exports, bundles y la compilación Android se heredan de
`logs13/` porque los arreglos finales sólo tocaron backend, copy y pruebas; no
se repitió trabajo nativo sin una causa de producto.

| Check | Resultado | Evidencia |
|---|---|---|
| `pnpm typecheck` | **passed** exit 0 | `logs14/typecheck.log` |
| Focales de capas, copy y Vínculos | **passed 91/91** · 6 suites · 0 fail | `logs14/cache-focals-green.log` |
| `pnpm test` | **passed 1537/1537** · 93 suites · 0 fail *(cifra de la pasada 15; vigente: 2145/2145 · 196 suites)* | `logs14/tests.log` |
| Whitespace | working tree e índice **passed** | `logs14/diff-check.log`, `logs14/diff-cached-check.log` |
| Development live | **129 funciones**; las cuatro interfaces objetivo presentes | `logs14/function-spec-final.json` |
| Schema / bindings | SHA-256 iguales antes/después; sin cambio de firma pública | `logs14/run-summary.md` |
| Runtime 08 | **passed v2**: `La tierra…` + `con un planeta` | `logs14/08-v2-focus.md`, `shots/cert14/08-mapa-elemental-v2.png`, `compare14/08-mapa-elemental-v2-p1..p2.png` |
| Runtime 04 | **passed**: ranking #2 + trazabilidad `ORB-TRN-001`, nunca `ORB-TRN-002` | `logs15/04-ranking-check.json`, `logs15/04-trace-check.json`, `logs15/04-focus.md`, `shots/cert15/04-arco-live.png` |
| Runtime 09 | voz canónica **passed**: 14/14 contactos y 0 nombres repetidos | `logs15/09-voice-check.json`, `logs15/09-expanded-focus.md`, `shots/cert15/09-vinculos-canonica.png` |
| Auditoría post-arreglo | **0 P0 / 0 P1 / 0 P2** | registro de revisión en `logs14/run-summary.md` |

### Checks de la decimotercera pasada (histórico de release heredado)

| Check | Resultado | Evidencia |
|---|---|---|
| `pnpm typecheck` | **passed** exit 0 | `logs13/typecheck.log` |
| `pnpm test` | **passed 1532/1532** · 93 suites · 0 fail · exit 0 (+13) | `logs13/suite.log` |
| Gate de `convex/_generated/api.d.ts` | **passed 7/7** exit 0 — esta pasada **no toca `convex/`**, así que no hizo falta codegen | `logs13/gate-generated.log` |
| Piso de cobertura | **1532 / mínimo 745** · 0 fallos · exit 0 | `logs13/piso-cobertura.log` |
| Focales de cola, ciclo, `useLayers`, recuperación natal y `.easignore` | **passed** 143/143 en 8 archivos (`refreshQueueV492`, `cartaRecuperacionV492`, `easignoreV492`, `layersV492Runtime`, `layerContract`, `layerAssembly`, `convexGeneratedApiGate`, `testCountGate`) | `logs13/focales.log` |
| Verificación en las dos direcciones | **passed** · **10** reversiones por separado —las 4 de esta pasada y las 6 de la duodécima— hacen fallar su prueba focal (entre 1 y 14 pruebas cada una); restauradas vuelven a pasar, con el sha256 de cada archivo idéntico al de antes. Los 3 gates se comprueban por sus self-tests, sin repetir compilaciones ni exports | `logs13/verificacion-antes-despues.md`, `logs13/verify-reverts.log` |
| `git diff --check` | **passed** exit 0 (working tree e índice) · los **209** untracked revisados con `--no-index`: **0 avisos**. El índice no se tocó: sigue con las 2 entradas que ya tenía | `logs13/diff-check.log`, `logs13/diff-check-untracked.log`, `logs13/indice.log` |
| **Gate de `.easignore`** | **passed** — 14 rutas comprobadas con **dos motores** que coinciden (el paquete `ignore` que usa EAS CLI y el motor de gitignore de git): `.local/`, `dist-ios/` y `dist-android/` **excluidos**; el producto y `.env.example` **incluidos**; los `.env` **excluidos**. Versionado en `test/easignoreV492.test.ts`, así que lo corre `pnpm test` para siempre | `logs13/easignore-gate.log`, `logs13/easignore-self-test.log` |
| Export web + límites | **passed** 32.10 MB / 50 MB · JS gzip 1006.4 KB / 1.25 MB · ficha completa | `logs13/web-export.log`, `logs13/web-export-check.log` |
| **Smoke web** `/ /home /carta /transito /diario` | **passed sobre el export ACTUAL** — Chrome headless con perfil nuevo y descartable, **sin login ni OAuth**: cero errores de consola en las cinco rutas. **Es anónimo por construcción: NO es la verificación visual autenticada**, que sigue pendiente | `logs13/web-smoke.log`, `shots/web-smoke13/` |
| Export iOS + Android | **passed** · bundle 7.0 MB cada uno. **Un export no es una compilación** | `logs13/ios-export.log`, `logs13/android-export.log` |
| **Compilación NATIVA Android (Gradle)** con **fidelidad byte a byte** | **passed** — manifiestos deterministas del árbol y del snapshot (ruta + tamaño + SHA-256): **939 archivos, 0 symlinks, mismo digest**, comparados **antes** del prebuild. Después: `BUILD SUCCESSFUL in 1m 14s`, 511 tareas (483 ejecutadas), **APK de 196 MB** con su sha256. JDK Temurin 17.0.19, SDK 36, NDK 27.1.12297006, sin instalar nada, sin EAS y sin ensuciar el worktree | `logs13/android-native-compile.log`, `logs13/fidelidad-snapshot.md` |
| Bundle nativo sin Tarot/Diario, sobre **TODOS** los `.hbc` | **passed** en iOS y Android — el runner 13 recorre **todos** los bundles de cada plataforma (hoy: 1 por plataforma): lo prohibido se exige **bundle por bundle** y el contrato se cuenta sobre el **total**, así que un segundo bundle no puede esconder Tarot/Diario ni inflar el conteo. `tarot` 0; las 3 apariciones de `diario` son copy y dos rutas que en nativo sólo redirigen. Llegaron al cliente `createRefreshCycle`, `claveDeAlcance`, `reservarIntento`, `createRefreshQueue`, `refreshAndWait`, `recoverNatalChart` y `LAYERS_REFRESH_UNAVAILABLE`, **1 vez cada uno** | `logs13/bundle-audit.log` |
| **Los gates fallan de verdad** | **passed** — tres self-tests sin correr exports ni compilar: el de Android exige **APK** (con `gradle=0` y APK ausente sale **28**, donde el runner 12 salía **0**); el de exports falla con un **segundo bundle sucio** (+4) y con un conteo contractual **inflado** (+16), y sigue verde con un bundle limpio por plataforma; el de `.easignore` rechaza el archivo **viejo** (5 rutas) | `logs13/android-self-test.log`, `logs13/gate-self-test.log`, `logs13/easignore-self-test.log` |
| Codegen de Convex | **no correspondía** — esta pasada no toca `convex/` | `logs13/gate-generated.log` |

### Checks de la duodécima pasada (histórico, ya no vigentes)

| Check | Resultado | Evidencia |
|---|---|---|
| `pnpm typecheck` | **passed** exit 0 | `logs12/typecheck.log` |
| `pnpm test` | **passed 1519/1519** · 93 suites · 0 fail · exit 0 (+14) | `logs12/suite.log` |
| Gate de `convex/_generated/api.d.ts` | **passed 7/7** exit 0 — la duodécima pasada **no toca `convex/`**, así que no hizo falta codegen | `logs12/gate-generated.log` |
| Piso de cobertura | **1519 / mínimo 745** · 0 fallos · exit 0 | `logs12/piso-cobertura.log` |
| Focales de cola, ciclo, `useLayers` y recuperación natal | **passed** 166/166 (`refreshQueueV492`, `nativeDefectsV492`, `v492ReleaseP1`, `cartaRecuperacionV492`, `natalRecoveryBackendV492`, `layersV492Runtime`, `natalChartBase`) | `logs12/focales.log` |
| Verificación en las dos direcciones | **passed** · los **6** arreglos revertidos por separado hacen fallar su prueba focal (entre 1 y 8 pruebas cada uno); restaurados vuelven a pasar, con el sha256 de cada archivo idéntico al de antes | `logs12/verificacion-antes-despues.md` |
| `git diff --check` | **passed** exit 0 (working tree e índice) · los **208** untracked revisados con `--no-index` juzgando la SALIDA: **0 avisos**. Bajan de 601 porque `.local/` pasó a `.gitignore`; **la evidencia no se borró**: los 2660 archivos siguen en disco, sólo que fuera del alcance de un `git add -A` | `logs12/diff-check.log`, `logs12/diff-check-untracked.log` |
| Export web + límites | **passed** 32.10 MB / 50 MB · JS gzip 1006.2 KB / 1.25 MB · ficha completa | `logs12/web-export.log`, `logs12/web-export-check.log` |
| **Smoke web** `/ /home /carta /transito /diario` | **passed sobre el export ACTUAL** — Chrome headless con perfil nuevo y descartable, **sin login ni OAuth**: cero errores de consola en las cinco rutas; `/` dibuja la landing entera y las otras cuatro, la puerta de sesión de Clerk. **Es anónimo por construcción: NO es la verificación visual autenticada**, que sigue pendiente | `logs12/web-smoke.log`, `shots/web-smoke12/` |
| Export iOS | **passed** · bundle 7.0 MB | `logs12/ios-export.log` |
| Export Android (bundle JS) | **passed** · bundle 7.0 MB. **Un export no es una compilación**: no toca Java, Kotlin ni C++ | `logs12/android-export.log` |
| **Compilación NATIVA Android (Gradle)** | **passed** — prebuild local + `./gradlew :app:assembleDebug --no-daemon` con JDK Temurin 17.0.19, SDK 36 y NDK 27.1.12297006: **`BUILD SUCCESSFUL in 4m`**, 511 tareas, exit 0, **APK de 196 MB**. En un temporal bajo `/private/tmp`, sin EAS, sin instalar toolchain y sin ensuciar el worktree | `logs12/android-native-compile.log` |
| Bundle nativo sin Tarot/Diario | **passed** en iOS y Android — **42 comprobaciones, 0 fallas**, ahora **comparadas** contra su valor y no sólo impresas. `tarot` 0 y ningún componente de Diario; las 3 apariciones de `diario` son copy (`CAMBIA A DIARIO`) y dos rutas que en nativo sólo redirigen (tope 3). Llegaron al cliente `recoverNatalChart` (1), `calculateOrCreateNatalChart` (1), `createRefreshQueue` (1), `createRefreshCycle` (1), `refreshAndWait` (1) y `LAYERS_REFRESH_UNAVAILABLE` (1) | `logs12/bundle-audit.log` |
| **El gate de exports falla de verdad** | **passed** — `--self-test` sin correr ningún export: 1 control positivo (0 fallas) y 3 negativos (etapa con `exit=3`, token prohibido presente, token contractual ausente). El runner sale con **exit=3** | `logs12/gate-self-test.log` |
| Limpieza de exports temporales | **passed** — `dist-ios/` (125 archivos) y `dist-android/` (126) borrados por `trap` con targets exactos tras validar que eran directorios reales, no symlinks, dentro del worktree y sin seguimiento de git. `dist/` (189 archivos) se conserva. **No** se corrió `git clean` | `logs12/limpieza-dist.log` |
| Codegen de Convex | **no correspondía** — esta pasada no toca `convex/` | `logs12/gate-generated.log` |

### Checks de la undécima pasada (histórico, ya no vigentes)

| Check | Resultado | Evidencia |
|---|---|---|
| `pnpm typecheck` | **passed** exit 0 | `logs11/typecheck.log` |
| `pnpm test` | **passed 1505/1505** · 93 suites · 0 fail · exit 0 | `logs11/suite.log` |
| Gate de `convex/_generated/api.d.ts` | **passed 7/7** exit 0 — sigue completo: este pase no agrega módulos ni funciones, así que **no hizo falta codegen** | `logs11/gate-generated.log` |
| Piso de cobertura | **1505 / mínimo 745** · 0 fallos · exit 0 | `logs11/piso-cobertura.log` |
| Focales de charts, interpretación, cola y recuperación | **passed** 258/258 (`refreshQueueV492`, `natalInterpretationRevisionV492`, `cartaRecuperacionV492`, `natalRecoveryBackendV492`, `personalityReading`, `chartsBindingsV492`, `nativeDefectsV492`, `v492ReleaseP1`, `layersV492Runtime`, `cartaNatalCarga`, `cartaV492`, `natalChartGate`, `natalChartPublicContract`, `natalChartBase`, `convexGeneratedApiGate`) | `logs11/focales.log` |
| Verificación en las dos direcciones | **passed** · los 4 arreglos de esta pasada revertidos por separado hacen fallar su prueba focal (entre 1 y 3 pruebas cada uno); restaurados, todos vuelven a pasar | `logs11/verificacion-antes-despues.md` |
| `git diff --check` | **passed** exit 0 (working tree e índice) · los **601** archivos untracked revisados con `--no-index` juzgando la SALIDA: **0 avisos** (393 son la evidencia del audit bajo `.local/`; **208** quedan fuera: los 207 del décimo más `src/domain/refreshCycle.ts`) | `logs11/diff-check.log`, `logs11/diff-check-untracked.log` |
| Export web + límites | **passed** 32.10 MB / 50 MB · JS gzip 1006.0 KB / 1.25 MB · ficha completa | `logs11/web-export.log`, `logs11/web-export-check.log` |
| Smoke web `/ /home /carta /transito /diario` | **passed en la TERCERA pasada** — histórico. No se repitió entre la cuarta y la undécima. El vigente es el de la duodécima, corrido sobre el export actual | `logs3/web-smoke.log`, `shots/web-smoke3/` |
| Export iOS | **passed** · bundle 7.0 MB | `logs11/ios-export.log` |
| Export Android | **passed** · bundle 7.0 MB | `logs11/android-export.log` |
| Bundle nativo sin Tarot/Diario | **passed** en iOS y Android — `tarot` 0 y ningún componente de Diario; las 3 apariciones de `diario` son copy (`CAMBIA A DIARIO`) y dos cadenas de ruta que en nativo sólo redirigen. Llegaron al cliente `recoverNatalChart` (1), `calculateOrCreateNatalChart` (1), `createRefreshQueue` (1), **`createRefreshCycle` (1)**, `refreshAndWait` (1) y `LAYERS_REFRESH_UNAVAILABLE` (1) | `logs11/bundle-audit.log` |
| Limpieza de exports temporales | **passed** — `dist-ios/` (125 archivos) y `dist-android/` (126) borrados con targets exactos tras validar que eran directorios reales, no symlinks, dentro del worktree y sin seguimiento de git. `dist/` (189 archivos) se conserva: es la salida canónica del export web. **No** se corrió `git clean` | `logs11/limpieza-dist.log` |
| Codegen de Convex | **no correspondía** — este pase no agrega módulos ni funciones ni cambia el contrato público. El artifact regenerado por Codex el 2026-08-18 sigue vigente y el gate lo confirma | `logs11/gate-generated.log` |

**Corrección al informe anterior sobre la web.** Aquél dejó anotado que `/` y
`/carta` quedaban en blanco con `Could not find Convex client`. Repetido el
export **con las claves públicas del checkout original cargadas sólo al entorno
del proceso** y con la caché de Metro limpia, las cinco rutas cargan sin un solo
error: `/` dibuja la landing entera y las otras cuatro, la puerta de sesión de
Clerk. **No era un defecto del producto**: era el build sin claves, y una caché
de transformación que conservaba el valor vacío.

## Veredicto comercial de la pasada 18 (2026-08-18) · HISTÓRICO — SUPERADO

> **HISTÓRICO / SUPERADO. Este NO es el veredicto vigente.** El único bloque
> vigente de este documento es `## Estado vigente (2026-08-19)`, al inicio.
> Todas las cifras de abajo quedaron superadas: **1842/1842 en 155 suites** y
> **focales 429/429** ya no son el conteo actual — hoy son **2145/2145 en 196
> suites**, con un inventario de **381 entradas** (129 tracked + 252 untracked)
> y un índice heredado de 2 entradas. Y **Android no está deshabilitado por
> código**: queda **fuera del alcance comercial actual** y sin verificar.

**Repositorio validado; comercio NO certificado** *(veredicto de esa pasada)*.

Verde en el repo, cifras **de la pasada 18**: `pnpm typecheck` exit 0, focales
429/429, `pnpm test` 1842/1842 en 155 suites, gate de conteo exit 0, export web
dentro de límites y bundle web sin el SDK ni ningún secreto de RevenueCat.

Lo que sigue siendo verdad es la conclusión de fondo: eso **no** certifica el
comercio. Falta, y nada de esto se puede cerrar desde el repositorio:

1. configuración externa (App Store Connect, RevenueCat, webhook, secretos);
2. un build nativo NUEVO — los módulos de RevenueCat no existen en el binario
   actual y ninguna actualización OTA los agrega;
3. verificación en dispositivo real → Sandbox → TestFlight → App Review.

**Android quedó fuera del alcance y sin verificar** hasta que exista catálogo en
Google Play; además `android.package` (`com.horoscopo.orbita`) no coincide con
el bundle iOS (`com.lucasssram.orbita`).

Detalle vigente en `docs/native-commerce-release-checklist.md` y en la sección
inicial de `CURRENT_TASK.md`.
