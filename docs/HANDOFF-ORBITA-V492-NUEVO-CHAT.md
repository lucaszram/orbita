# Handoff autónomo — Órbita V4.9.2 nativa iOS

**Para retomar el trabajo en un chat nuevo (Claude o Codex) sin depender de ningún hilo anterior.**

---

## 0. BLOQUE VIGENTE — leer esto y nada más para arrancar (2026-08-20)

Todo lo que sigue después de esta sección es **historia**. El estado volvió a
cambiar: el RC **Órbita 1.0.0 (21)** ya **existe, se construyó, se subió y Apple
terminó de procesarlo el 2026-08-20**. Hoy figura **Lista para enviar**, **caduca
en 90 días** y está **en TestFlight interno, grupo Own, con 3 testers**, con las
instrucciones **Qué se debe probar** ya guardadas. El **build 20 queda superado**
como candidato visual —no trae el refinamiento de glifos— y el **build 19 nunca
se promueve**. Lo que **NO** pasó: **el build 21 no se seleccionó para App
Review**, **no se hizo *Add for Review***, **no se publicó** y **no se desplegó
backend en esta pasada**. Y lo que falta arriba de todo: **la QA física del build
21 está entera pendiente — Lucas todavía no lo instaló**. **El detalle por tema
está en `CURRENT_TASK.md`, en la sección `## RC productivo Órbita 1.0.0 (21) —
estado medido (2026-08-20) · VIGENTE`** — este bloque es el índice.

> **Leé también `### Actualización 2026-08-20 (cierre local)`, más abajo en este
> mismo bloque.** Después de ese RC se cerraron en local la **Carta natal** y el
> **bloque editorial**, así que **el build 21 quedó superado como candidato
> visual** y el **build 22 todavía no existe**. La tabla del RC21 que sigue
> describe el binario, no lo que hoy se ve corriendo la app desde este worktree.

### Estado medido del RC 1.0.0 (21)

| Qué | Valor medido |
|---|---|
| **Commit del RC** | `84e93cd3e34fa3e30ad54b06b41654047dc0a5df` — *release: Órbita 1.0.0 (21)* · tree `b1d730eab32a44025469929a3975f706f04b25d0` |
| **Worktree del RC** | `/Users/lucas/Documents/Core/worktrees/orbita/release-1.0.0-build21` · rama **local** `release/1.0.0-build21` · **worktree limpio** |
| Worktree de trabajo (este) | `/Users/lucas/Documents/Core/worktrees/orbita/native-v492` · `feature/native-v492-implementation` · HEAD `52836ad` · árbol sucio **preservado** · índice intacto con **2 entradas** heredadas |
| **IPA** | `/private/tmp/Orbita-1.0.0-21.ipa` · SHA-256 `5ab2468174a4d6d1950f7f8baecefc0e34ac32307850b412a83130f63d675a54` · **49146946 bytes** |
| **Delivery UUID** | `b4570ad5-8fd4-4ade-99cc-c44b48e5115d` |
| **Runtime fingerprint** | `52b060ff571a7ed502c7b11ae1976f4e1a7dcdc5` |
| **Procesamiento de Apple** | **TERMINADO el 2026-08-20.** Figura **Lista para enviar** · **caduca en 90 días** |
| **TestFlight** | **interno, grupo Own, 3 testers** · instrucciones **Qué se debe probar** guardadas |
| **Instalación del build 21** | **PENDIENTE.** Lucas **todavía no lo instaló**; el binario que sigue en su iPhone es el **20** |
| **Gates del RC21** | `pnpm typecheck` **limpio** · **218 suites · 2236/2236 tests** · **export web PASS** · **export iOS PASS** · **inspección del IPA productiva PASS** |
| **Backend** | **NO se desplegó en esta pasada.** `exciting-bat-311` sigue como quedó: **desplegado y verificado, 142 funciones**. El RC21 no cambia contrato, schema ni firmas públicas |
| Webhook RevenueCat productivo | **probado: HTTP 200** (medición previa, sin cambios) |
| App Store Connect | **app `6788918249`** · **suscripción `6803253452`** / producto `orbita_plus_monthly` · **USD 9.99 mensual con 7 días gratis** |
| App Privacy | **Purchases** e **Identifiers** publicados |
| Notas de review | **corregidas** |
| Liberación | **manual** |
| **App Review** | **NO se seleccionó el build 21 · NO se hizo *Add for Review* · NO se publicó** |
| **Build 20** | **SUPERADO como candidato visual.** Commit `b2531a19`, IPA SHA-256 `cf3ad601d8f00cbf504b61b669a342b807eeb67e5b0bc71045f3f3039429fca8`. Sigue siendo el binario instalado hasta que Lucas instale el 21 |
| **Build 19** | **NUNCA se promueve** — apunta a Development |
| Acuerdo de Apple (Developer Program License Agreement actualizado) | **ACEPTADO personalmente por Lucas.** Dejó de ser bloqueo |
| Snapshot de seguridad | `~/Backups/orbita-native-v492/2026-08-19/` (restauración ensayada, 978/978 sha256) |
| Punto de rollback pre-RC | worktree `rollback/prod-pre-rc20-0823332` en `0823332` |

> **Los dos números de Apple no son intercambiables.** `6788918249` es la **app**
> (el de las URLs de App Store Connect); `6803253452` es el **recurso de la
> suscripción** dentro del grupo `Órbita Plus`, no la app. El producto es
> `orbita_plus_monthly`.

**El build 19 apunta a Development y NO debe promoverse.** Es una prueba interna:
habla con el deployment de dev, así que sus cuentas, compras y cartas son las de
dev. Que TestFlight lo acepte no lo convierte en candidato.

### Qué trae el build 21 que el 20 no tenía

Un solo cambio de producto, más el `ios.buildNumber`:

**`src/components/v492/TransitCard.tsx` — notación de la cabecera con glifos
propios.** La fila de tránsito dibuja los **dos cuerpos con los glifos
vectoriales propios de Órbita** (`domain/astroGlyphs` vía `AstroGlyph`, el mismo
catálogo monocromo que ya usa el resto de la app: nada de caracteres Unicode que
en web y Android caen al font de emoji). La jerarquía de color dice cuál es
cuál: **cuerpo en tránsito en cobre**, **aspecto vectorial al centro** con el
color del sistema y **punto natal en marfil** (cobre = lo que se mueve, marfil =
tu carta).

Lo que el cambio **no** sacrifica, y hay que conservarlo si alguien lo toca:

- **Los nombres completos siguen en el resumen y en la etiqueta de VoiceOver.**
  La fila entera es un solo botón, así que su etiqueta accesible dice todo lo que
  se ve —posición, titular **con los nombres**, aspecto, etapa, orbe, cambio
  respecto de ayer, casa, frase del cálculo y fecha del punto más exacto—. Los
  símbolos comprimen la cabecera visual; **no** borran el dato.
- **Fallback textual real:** si un nombre no resuelve a un glifo del catálogo —un
  punto que el backend agregue mañana— se imprime el **nombre**, en el mismo
  color. Antes que un hueco mudo, una fila menos compacta.

> **Ese refinamiento ya está en un binario.** Dejó de ser "cambio local post-RC":
> viaja dentro del **build 21**, que Apple ya procesó. Por eso el **build 20 está
> superado como candidato visual** —su cabecera es la anterior— y por eso la QA
> física tiene que hacerse **sobre el 21**, no sobre el binario que hoy sigue
> instalado en el iPhone.

### Actualización 2026-08-20 (cierre local) · Carta natal + bloque editorial

**El árbol de este worktree ya no es el del binario.** Después del RC21 se
cerraron dos bloques **en local**, sin commit, sin push y sin build:

1. **Carta natal — estado visual CERRADO.** La carta completa con sus **siete
   capítulos** y los **CTAs de Plus** existe y no se regresa.
2. **Bloque editorial — punto 22 de la *Corrección editorial pre-RC*.** Entra
   `src/domain/layerMeaning.ts`: una capa **pura y determinística** de
   *significado + acción*, **sin LLM y sin backend**, que traduce lo que el sobre
   ya calcula. La consumen la Luna del día, el detalle de tránsito, la estación
   vital, el tema del año y el cumpleluna.

Lo que cambia en pantalla, para que nadie lo revierta sin querer:

- **Ascendente:** en el hub de Carta su celda dice **`INICIO CASA 1`**, no
  `CASA 1`. Es la **cúspide que inicia** la casa 1, no una ubicación dentro de
  ella; VoiceOver lo dice **una sola vez**, en la fila del eje, y la etiqueta de
  la rueda no lo repite.
- **Detalle de la Luna:** orden `QUÉ SIGNIFICA HOY` → `PARA BAJARLO A TIERRA` →
  `LOS DATOS EXACTOS` → trazabilidad. La casa se **imprime una sola vez**, entre
  los datos: antes se decía tres veces seguidas (resumen del cálculo, filas
  `CASA`/`TEMA` y la línea "Activa tu casa N…"). Sin casa publicada el texto se
  apoya en signo y fase y **no inventa** ninguna.
- **Detalle de tránsito:** `QUÉ SIGNIFICA PARA VOS` y `PARA BAJARLO A TIERRA`
  **antes** de la línea temporal; el resumen técnico queda reunido bajo **`DATOS
  DEL CONTACTO`**. La lista/ranking conserva su **notación compacta** y no repite
  la explicación larga.
- **Tu momento:** estación vital y tema del año explican **antes** de medir, y el
  párrafo de método quedó **relegado** entre el dato y su acordeón. Son **dos**
  bloques `Metodo`, no tres: el mandala no lleva.
- **Mandala:** debajo del dibujo quedan **exactamente cuatro líneas** —una por
  ritmo, `RÓTULO · estado`— y **enseguida el acordeón, sin nada en el medio**.
  **`ring.detail` ya no se muestra** en los ritmos disponibles; se usa una sola
  vez y sólo cuando un ritmo **no** se puede calcular. El pie explicativo se
  eliminó y la etiqueta accesible del dibujo dejó de enumerar lo mismo que la
  leyenda.
- **Detalle de Cumpleluna:** orden `estado actual` → `qué significa` → `PARA
  BAJARLO A TIERRA` → `Los números del ciclo` → trazabilidad. El párrafo que
  abría la pantalla explicando **qué es** el ángulo Sol–Luna se eliminó: esa
  metodología vive entera en `TraceAccordion`, al pie.

**Estado medido (local, 2026-08-20):** `pnpm typecheck` **limpio** · **220 suites
· 2347/2347 tests** (piso 2347) · `git diff --check` **limpio** · export web e
iOS **PASS** · árbol sucio e **índice heredado de 2 entradas preservados**. El
backend incorpora `transit-ranking-v2` y el contrato aditivo compatible, ya
**desplegado a `exciting-bat-311`**. Schema estructural, **precio** y
**entitlement** siguen sin cambios.

| Qué | Valor medido |
|---|---|
| **Build 21** | **SUPERADO como candidato visual.** No contiene la Carta natal cerrada ni el bloque editorial |
| **Build 22** | **NO EXISTE.** No se construyó, no se subió y no hay autorización para hacerlo |
| **QA visual local** | **PASS en Simulator**: Carta/Ascendente, Hoy, Luna, Cumpleluna, lista y detalle de tránsito, estación vital, tema del año y mandala revisados sobre el bundle actual |
| **QA física** | **PENDIENTE ENTERA.** No se instaló ningún binario nuevo |
| **Ranking temporal v2** | **DESPLEGADO EN PRODUCCIÓN.** Con reloj 20/8/2026, Marte con pico 21/8 gana a Saturno con pico 9/8. Convex conserva 142 funciones y no eliminó índices |
| **Rollback del deploy** | RC20 limpio `b2531a19`; function spec previo guardado (142 funciones). El primer push se frenó sin publicar por una fila v1 y el segundo completó schema + deploy tras hacer compatible el validator de persistencia |

> La jerarquía y la accesibilidad se revisaron también en Simulator. Nada de
> esto se probó todavía en un dispositivo real; hasta que exista un **build 22**
> y su QA física, no cuenta como verificado en iPhone.

### Pendiente inmediato (en este orden)

> **Corrección 2026-08-20:** el candidato de esta fila ya **no** puede ser el
> **21**: lo que hoy se ve en la app vive sólo en el árbol local. El orden real
> es **build 22 → instalar → QA física → capturas → metadata → Add for Review →
> publicación**, y el **build 22 no existe ni está autorizado**. La lista de
> abajo se conserva porque su contenido —el foco de la QA— sigue valiendo entero.

1. **Preparar el build 22, instalarlo y ejecutar la QA física.** Es el binario
   que reúne todos estos cambios. Foco explícito:
   - **prioridad temporal del ranking**: Marte con pico 21/8 antes que Saturno en integración;
   - **estados de frescura** sin tarjeta de error para caché verificada del mismo día;
   - **una sola raíz de Tránsitos**, detalle canónico y línea temporal con Inicio/Pico/Hoy/Cierre;
   - **Luna y Cumpleluna** con guía práctica antes que método y sin cajas/repeticiones;
   - **glifos vectoriales en los encabezados de tránsitos**;
   - **alta limpia**, sin errores residuales de `onboarding:confirmSignupDraft`
     ni de `layers:refreshForDate` (los dos diagnósticos abiertos de la noche del
     19/8; el fix de la reafirmación natal debería haber matado los segundos, hay
     que **confirmarlo contra el build 22**, no asumirlo);
   - **navegación**;
   - **matriz Free/Plus completa**: Free y Plus, trial elegible y trial NO
     elegible, compra Sandbox, restore, cancelación / expiración, reinstalación,
     cambio de cuenta, borrado y **VoiceOver**.
2. **Capturar el paywall real** y los screenshots del build 22.
3. **Completar metadata y Review Information** de la suscripción en App Store
   Connect (incluido el screenshot de Review Information).
4. **Recién tras todos los gates anteriores**, seleccionar el build y la
   suscripción. **Siempre con aprobación separada**: una para **Add for Review**
   y otra distinta para la **publicación**. Ninguna de las dos existe hoy.

Fuera de esa fila, sigue abierto: los **PRs** (el árbol de **este** worktree no
existe en git; los cortes A/B/C históricos están desactualizados), la **decisión
de precio de Plus** (USD 9.99 vs lo que abre) y la evidencia de certificación
—**estado 06 casi resuelto** (captura de Carta con Plus del 19/8 21:49) y
**recaptura del 02**—. El VoiceOver físico dejó de ser una tarea suelta: va
dentro de la QA del build 22 (punto 1).

### Lo que se cerró antes (detalle en CURRENT_TASK.md)

1. **Finalizador durable de Clerk** — el bloqueante P0 del handoff anterior:
   implementado, desplegado y **verificado en runtime end-to-end** (proceso
   matado en la ventana exacta; el servidor terminó el borrado solo y la app
   purgó al reabrir). `CLERK_SECRET_KEY` cargada en dev Y prod.
2. **Comercio nativo configurado entero**: Apple (producto `orbita_plus_monthly`,
   1 mes, USD 9.99, 7 días gratis, grupo 22320917) + RevenueCat (entitlement
   `orbita_pro`, offering `orbita_plus` Default, webhook con 200 en dev y
   **también en producción**) + **compra Sandbox real completada en iPhone
   físico** con la cadena entera (Apple → RC → webhook → Convex `trialing` →
   expiración honesta a Free).
3. **Deploy a producción y RC20** — `b2531a19` en su worktree limpio,
   `exciting-bat-311` desplegado y verificado con 142 funciones, IPA 1.0.0 (20)
   procesado en TestFlight interno e instalado por Lucas. **Superado por el 21**
   como candidato visual.
4. **RC21 construido, subido y procesado** — commit `84e93cd3`, gates en verde
   (typecheck limpio, 218 suites, 2236/2236, export web, export iOS, inspección
   productiva del IPA), Apple terminó de procesarlo el 2026-08-20 y quedó **Lista
   para enviar** en TestFlight interno.
5. **Reestructura de producto** (decisiones de Lucas probando en el teléfono):
   pestaña 5 = "Carta" con el hub directo y engranaje → `/perfil/ajustes`;
   Vínculos con personas arriba; alta de persona en flujo de 3 pasos; resumen
   puntual "EN RESUMEN" que nombra los contactos; colores de barras invertidos
   (fluido=cobre, tensión=azul); tarjeta DATOS/PRECISIÓN en carta completa.
   **Web intacta** (garantizado por tests de grafo + export verificado).
6. **11 defectos reales encontrados y corregidos**, ninguno visible para la
   suite anterior: webhook que perdía compras (`$displayName`), reafirmación
   natal que rompía Vínculos (`INPUT_CHANGED` en loop), CodeInput inusable en
   iPhone físico (login imposible), spinner clavado entre pestañas, `db.get`
   sin normalizar, offering default con lifetime, y más.
7. ~~**Aceptar el Apple Developer Program License Agreement actualizado**~~ —
   **HECHO**. Lucas lo aceptó **personalmente** en `developer.apple.com/account`.

### Reglas que no cambiaron

**Modelo de trabajo vigente y acordado:** **Codex organiza y orquesta el plan,
revisa y valida**; **Claude Code es el ejecutor principal**; **Lucas decide y
autoriza** las acciones externas o legales (App Store Connect, App Review,
publicación, aceptación de acuerdos de Apple, deploys). Ninguna frase de este
documento que reparta los roles de otra manera describe el estado vigente: es
historia.

Preservar el árbol sin commitear de **este** worktree y no tocar su índice
(2 entradas). Nada se publica ni se envía a revisión sin la orden explícita y
puntual de Lucas. **Que el deploy de producción, la subida del build 20 y la
preparación, build y subida del build 21 ya hayan ocurrido no los deja
autorizados de nuevo:** fueron órdenes puntuales y **ya se consumieron**. Hoy
**no hay ninguna autorización abierta**: ni para desplegar backend, ni para
construir o subir otro build, ni para App Review, ***Add for Review*** o la
publicación —esas dos siguen siendo **aprobaciones separadas** de Lucas—. La
trampa del directorio sigue viva: **todo comando de Convex con el `cd` al
worktree en la misma línea.**

- Fecha de emisión del cuerpo histórico: `2026-08-18`
- Estado que describe el cuerpo histórico: **implementado · Convex Development desplegado · SIN commit · SIN producción**. **SUPERADO** por este bloque.
- Este documento es autosuficiente. No contiene secretos, valores de variables de entorno, credenciales ni contenido de PDFs.

Convención que se usa en todo el documento:

| Marca | Significado |
|---|---|
| **HECHO** | Ejecutado y verificado con evidencia en disco. |
| **PENDIENTE EXTERNO** | Bloqueado por algo que no depende del código: un deploy, un entitlement pago, un dispositivo físico, una sesión autenticada. |
| **NO AUTORIZADO** | Prohibido en esta corrida por instrucción de Lucas; requiere autorización explícita para ejecutarse. |

---

## 1. Resumen ejecutivo · HISTÓRICO (pasadas 14–15, 2026-08-18)

> **HISTÓRICO.** Los conteos de esta sección (**1537/1537**, 93 suites) son de la
> pasada 15. El estado y el veredicto vigentes están en el bloque 0.

Órbita V4.9.2 es la implementación nativa iOS de las **capas de tiempo**: una app exclusivamente astrológica, con cinco pestañas (`Hoy · Tránsitos · Vínculos · Umbral · Perfil`), diez análisis personales trazables con `analysisId + sourceRefs`, y tres niveles de Vínculos sin puntaje global de compatibilidad.

El trabajo está **implementado y verde en verificación técnica**, y **sin commitear**. Van **quince pasadas de recertificación** (2026-08-16 a 2026-08-18). La decimocuarta ejecutó tres deploys puntuales y autorizados exclusivamente a Convex Development. En runtime reprodujo cachés editoriales obsoletos en 08/09 y, en la auditoría posterior, tres bordes adicionales de concordancia y degradación. Cada defecto tuvo una regresión roja antes del arreglo mínimo y quedó cerrado antes del tercer deploy. La decimoquinta no cambió código ni desplegó: con los créditos del proveedor restaurados, cerró 04 y 09 por el flujo público real.

**Lo verde, medido:** `pnpm typecheck` exit 0 · `pnpm test` **1537/1537** (93 suites, 0 fail) · focales de caché/copy/Vínculos **91/91** · catálogo live **129 funciones** con las cuatro superficies objetivo · gate de `convex/_generated` **7/7** · `git diff --check` limpio · estados 04, 08 y 09 recapturados y comparados · exports web/iOS/Android, bundles nativos y compilación Android reutilizados de `logs13/` porque el arreglo no toca aplicación nativa, schema, firmas públicas ni artifacts generados.

**Lo honesto, y por qué no se puede declarar "todo pasa":** de los 12 estados visuales, **10 son PASS**. **08** muestra `La tierra…`, `CUANDO LA TIERRA SATURA` y `con un planeta`. **04** abrió el arco real #2 y publicó su propio `ORB-TRN-001`, nunca el ranking `ORB-TRN-002`. **09** calculó la comparación carta contra carta y sus 14 contactos expandidos usan la voz `Su/Tu`, con 0 nombres propios repetidos. **06** sigue necesitando un entitlement Órbita Plus legítimo y **02** conserva evidencia histórica sin recaptura porque las credenciales del fixture no estaban disponibles localmente. VoiceOver exige un iPhone físico; la web autenticada sigue como tarea separada.

**No hay un defecto de producto abierto conocido.** El defecto de invalidación editorial quedó cerrado con prueba falla/pasa, y los límites restantes son de evidencia o estado externo. La auditoría independiente del pase 13 se conserva; la pasada 14 agrega evidencia técnica y de contingencia en `logs14/`, y la 15 agrega el cierre runtime en `logs15/`, `shots/cert15/` y `compare15/`.

**Nota operativa:** ninguna pasada sobrescribe a la anterior. `logs14/run-summary.md` registra los tres deploys, regresiones y la caída real del proveedor; `logs15/run-summary.md` registra su recuperación, el cierre de 04/09 y el set exacto aceptado.

---

## 2. Qué es Órbita V4.9.2 y alcance exacto por plataforma

### El producto

Órbita es una app de astrología premium en español rioplatense (voseo), enmarcada como **entretenimiento y autoconocimiento**. Tono editorial: 70% Co-Star (aire, tablas, autoridad concisa, misterio seco), 30% Moonly (onboarding claro, claridad comercial). Estética dark premium: negro/carbón, cobre sutil, geometría orbital.

**Guardrails de producto, innegociables:** sin claims de destino, resultados garantizados, salud, dinero, decisiones legales ni consejo psicológico. No se menciona `NASA/JPL` ni `astrología védica`. La marca vigente es `Órbita`; cualquier nombre anterior es legado técnico.

### Qué agrega V4.9.2

La arquitectura de **capas de tiempo**: lo cotidiano se lee dentro de procesos más largos. Cuatro relojes simultáneos —etapa vital (años), tema del año, ritmo lunar personal y el tránsito activo (días o semanas)— con trazabilidad bibliográfica en cada análisis.

### Alcance por plataforma

| Plataforma | Alcance en V4.9.2 |
|---|---|
| **iOS (nativo)** | **El objetivo de esta corrida.** Experiencia **exclusivamente astrológica**: cinco pestañas, diez análisis personales, tres niveles de Vínculos. **Tarot y Diario NO existen en el bundle nativo** — verificado bundle por bundle. |
| **Web** | **Sin rediseño en esta corrida.** Conserva Tarot, Diario y la landing. La regla operativa es **cero regresiones web**: el export y el smoke anónimo lo verifican en cada pasada. |
| **Android** | **Fuera del alcance de certificación de producto**, pero **dentro del gate de release** desde la duodécima pasada: se compila de verdad con Gradle (no un export) y se audita el bundle. **No** se certificó visualmente ninguna pantalla Android. |

El aislamiento nativo se logró sacando las implementaciones fuera de `app/`: Expo Router mete en el grafo **todos** los archivos de `app/`, incluidas las variantes `.web.tsx`, así que el bundle nativo terminaba empaquetando el árbol web. Con la implementación en `src/routes/v492/{nombre}.tsx` / `.web.tsx`, la resolución por plataforma de Metro decide y el nativo nunca ve el módulo web.

---

## 3. Repo, rama y estado sucio

### Ubicación

- **Worktree de trabajo:** `/Users/lucas/Documents/Core/worktrees/orbita/native-v492`
- **Checkout de producto (repo principal):** `/Users/lucas/Documents/Core/projects/orbita`
- **Rama:** `feature/native-v492-implementation`
- **Base:** `origin/main` en `52836ad` (*Merge pull request #75 — hotfix/tarot-limit-client-error-data*)
- **HEAD == origin/main:** sí. **Todo el trabajo de V4.9.2 vive sin commitear en el working tree.**

### Estado sucio, medido ahora (2026-08-19)

```
git status --porcelain -uall  →  381 entradas
  · 129 tracked (modificados / borrados / renombrados)
  · 252 untracked (archivos nuevos)
```

> Medición anterior, **HISTÓRICA**: 310 entradas = 100 tracked + 210 untracked
> (2026-08-18). Creció con las pasadas de identidad, borrado y comercio.

**El índice tiene 2 entradas ya preparadas y no se tocó desde entonces:**

```
D    app/(tabs)/transitos.tsx
R100 app/(tabs)/perfil.tsx → src/screens/PerfilScreen.tsx
```

### Qué NO se hizo (HECHO: se preservó todo)

> **SUPERADO en parte (2026-08-20).** El párrafo de abajo describe **este**
> worktree, que sigue sin commit y con su árbol sucio intacto. Lo que ya **no**
> es cierto a nivel proyecto: el **deploy de producción existe** (`exciting-bat-311`,
> 142 funciones verificadas) y el **build 1.0.0 (20) está subido y procesado en
> TestFlight interno**, desde el commit `b2531a19` en el worktree
> `release-1.0.0-build20`. App Store / App Review siguen sin tocarse.

Sin commit, push, merge, rebase, reset, `git clean`, deploy de producción, EAS, TestFlight ni App Store. Hubo exactamente **tres deploys autorizados a Convex Development en la pasada 14**: 14:33, 14:48 y 15:11 ART. La pasada 15 no desplegó. `dist/` existe (salida canónica del export web, 189 archivos); `dist-ios/` y `dist-android/` se borraron al terminar cada pasada.

`.local/` (la evidencia de auditoría: capturas, logs, comparaciones, herramientas) está **fuera de git a propósito** desde la duodécima pasada: quedó en `.gitignore` y en `.easignore`. **No se borró nada de la evidencia** — sigue en disco.

---

## 4. Decisiones y restricciones innegociables

### De proceso

1. **Una tarea, una rama, un PR.** Si aparece un segundo objetivo independiente, se abre otra tarea.
2. **Nada se despliega ni se publica sin autorización explícita de Lucas** y sin el gate documentado en `docs/proceso-desarrollo-y-releases.md`.
3. **Territorio:** Codex es dueño de `convex/**`; Claude es dueño de `app/**`, `src/**`, `assets/**`, `global.css`, `tailwind.config.js`, `src/theme/**`. Config gris (`package.json`, `babel.config.js`, `metro.config.js`, `tsconfig.json`, `app.json`) se toca sólo si es imprescindible y se coordina.
4. **Sólo el backend corre `pnpm convex:dev` / `pnpm convex:codegen`.** `convex/_generated/**` se consume read-only y **nunca se edita a mano**.
5. **Antes de cualquier PR:** `pnpm typecheck` y `pnpm test` en verde (no hay eslint: el "lint" es el typecheck). Rebase sobre `main`.
6. **Claude Code se invoca exclusivamente** por `/Users/lucas/Documents/Core/scripts/claude-opus -p "<instrucción>"`. Nunca el binario `claude` directo, nunca `--bare`, nunca `claude auth login` / `setup-token` / OAuth / navegador.

### De producto y datos

7. **Cero mocks personales.** Los datos que se muestran salen del backend real o se declara la degradación de forma explícita.
8. **Hora de nacimiento desconocida ⇒ no se inventan casas ni ángulos.** Sin hora exacta no se publican casas, Ascendente, profección ni capas sensibles. Una hora `approximate` se trata como desconocida. Cada posición declara su precisión: `exact | estimated | range | omitted`.
9. **Trazabilidad obligatoria:** todo resultado personal viaja en el sobre cerrado `AnalysisResult<T>` con estado, precisión, vigencia, versión de método, hash opaco, limitaciones y `sourceRefs` bibliográficas.
10. **Vínculos: tres niveles y ningún puntaje global de compatibilidad.** Las barras cuentan contactos reales; no son un porcentaje.
11. **Cumpleluna** es la repetición del ángulo Sol–Luna **natal**, no la lunación colectiva del mes.
12. **Ranking y arcos deterministas**, con identidad estable (`arcId`) que no depende de si la ventana se estimó o se verificó.
13. **Cero regresiones web.** El rediseño web/web-mobile está fuera de alcance.
14. **El hash público no contiene fecha, hora, lugar ni coordenadas en claro.** Las tablas nuevas no persisten respuestas crudas del proveedor. Telemetría no recibe datos natales ni contenido interpretativo.
15. **No se toca monetización para desbloquear QA.** `isPro` sale de filas reales de suscripción; conceder un entitlement para capturar una pantalla está prohibido.
16. **Los PDFs de las fuentes bibliográficas permanecen locales.** Sólo se envían metadatos y locators verificables.

### Fuera de alcance declarado de esta corrida

> **SUPERADO en parte (2026-08-20).** La lista es la del alcance original. Desde
> entonces, y con autorización puntual de Lucas, sí ocurrieron **monetización**,
> **deploy Convex de producción**, **commit** (`b2531a19`, en el worktree
> `release-1.0.0-build20`) y **TestFlight interno**. Siguen fuera: **App Store /
> App Review** (el build 20 no se seleccionó ni se envió), rediseño
> web/web-mobile, certificación visual Android, notificaciones y calendario
> mensual.

Rediseño web/web-mobile · certificación visual Android · monetización · notificaciones · calendario mensual · deploy Convex de producción · TestFlight · App Store · commit · push · merge.

---

## 5. Arquitectura y rutas

### Shell nativo

`app/(tabs)/_layout.tsx` es sólo un wrapper: `export { default } from "@/routes/v492/tabs-layout"`. La implementación real vive en `src/routes/v492/tabs-layout.tsx` (nativo) y `tabs-layout.web.tsx` (web, `WebAppShell`).

- **Gate de sesión ARRIBA de `(tabs)`** (`resolveTabsGuard`, puro y con tests): iOS restaura la navegación y puede montar una pestaña directo tras una actualización, sin pasar por `app/index.tsx`. Órbita no tiene modo invitado.
- **`LayersProvider`** envuelve el chrome autorizado: es **el único ciclo de datos** de las capas V4.9.2. Todas las pestañas y sus detalles comparten el mismo reloj, el mismo sobre y el mismo aviso de "no pudimos actualizar".
- Shell oscuro `#0A0B0E`, `StatusBar` en `light` declarado en el shell (no en el layout raíz, que es compartido con web).

### Rutas nativas

| Ruta | Implementación | Contenido |
|---|---|---|
| `(tabs)/hoy/index` | `src/screens/v492/HoyScreen` | Ranking del día, arco resumido, Luna en tu carta, evento personal |
| `(tabs)/hoy/arco` | `ArcoDetailScreen` | Arco del tránsito principal |
| `(tabs)/hoy/cumpleluna` | `CumplelunaDetailScreen` | Detalle de Cumpleluna |
| `(tabs)/hoy/luna` | `LunaDetailScreen` | Detalle de la Luna en tu carta |
| `(tabs)/transitos/index` | `src/routes/v492/transitos-index` → `TransitosLayersScreen` | Lista completa de tránsitos activos + `POR QUÉ ESTE ORDEN` |
| `(tabs)/transitos/momento` | `src/routes/v492/transitos-momento` | Tu momento: estación vital, tema del año, mandala temporal |
| `(tabs)/transitos/arco/[arcId]` | `src/routes/v492/transitos-arco` | Detalle de **un** arco elegido de la lista |
| `(tabs)/vinculos/index` | `src/routes/v492/vinculos-index` → `VinculosHubScreen` | Personas guardadas |
| `(tabs)/vinculos/conectar` | `src/routes/v492/vinculos-conectar` → `VinculosConnectScreen` | Alta de persona |
| `(tabs)/vinculos/[profileId]` | `src/routes/v492/vinculos-perfil` → `VinculosResultScreen` | Resultado por nivel |
| `(tabs)/umbral/index` | `VoidExperience` | Umbral |
| `(tabs)/perfil/index` | `src/screens/PerfilScreen` | Perfil |
| `(tabs)/perfil/carta` | `perfil-carta` → `CartaHubScreen` | Hub de Carta |
| `(tabs)/perfil/carta/completa` | `perfil-carta-completa` → `CartaCompletaV492Screen` | Carta completa |
| `(tabs)/perfil/carta/mapa-elemental` | `perfil-carta-mapa-elemental` → `MapaElementalDetailScreen` | Mapa elemental |
| `(tabs)/perfil/carta/tipo-lunar` | `perfil-carta-tipo-lunar` → `TipoLunarDetailScreen` | Tipo lunar natal |

**Rutas históricas fuera de la barra** (`href: null`): `index`, `vacio`, `vinculo`, `carta`. Sólo redirigen, así que ningún link viejo se rompe. Las rutas legadas de Diario (`/reading/diario`, `/diario`) resuelven en nativo a `src/routes/v492/{reading-diario,diario}.tsx`, que son **un `<Redirect href="/hoy" />` y nada más**.

### Módulos de dominio clave (frontend)

| Archivo | Qué resuelve |
|---|---|
| `src/domain/refreshQueue.ts` | Cola de recálculo: single-flight por generación viva, "la más reciente gana", **relevo por alcance**, backoff despertable, `suspend()`/`resume()`, `accepts()` |
| `src/domain/refreshCycle.ts` | Costura entre la cola y React: **única fuente de verdad del `intento`** (`intento()` / `reservarIntento()`), `claveDeAlcance` |
| `src/hooks/useLayers.tsx` | Ciclo de datos de las capas. Expone `refresh()` y `refreshAndWait()` |
| `src/domain/natalChartState.ts` | Siete hechos del estado natal; `recovery`: `ninguna · cargar-datos · completar-hora · reintentar` |
| `src/domain/natalChartRecovery.ts` + `src/hooks/useNatalChartRecovery.ts` | Controlador del botón "COMPROBAR DE NUEVO": store puro, un store por `userId + inputHash`, candado sincrónico |
| `src/domain/exclusive.ts` | Candado sincrónico (mutex real), tomado **antes del primer `await`** |
| `src/domain/transitArcRequest.ts` | Coordinador puro de pedidos de arco: token por pedido, descarta lo que ya no está vigente |
| `src/domain/relationships.ts` | Niveles, dimensiones, escalera canónica, causas con dueño |
| `src/components/v492/mandalaGeometry.ts` | Única definición de qué anillos se dibujan (lista y dial no pueden divergir) |
| `src/services/{layersApi,relationshipsApi,chartsApi}.ts` | Reexportan las **referencias generadas** de Convex (un cambio de contrato rompe el typecheck) |

---

## 6. Los diez análisis y los niveles de Vínculos

### El bundle personal — exactamente diez análisis

`layerBundleValidator` = `natal` (3) + `today` (4) + `moment` (3). Registro canónico: `convex/content/astrologySources.ts`; validadores: `convex/lib/layerContract.ts`; rótulos de front: `src/domain/layers.ts`.

| # | Grupo | `analysisId` | Título | `methodVersion` | Elaboración |
|---|---|---|---|---|---|
| 1 | natal | `ORB-LUN-001` | Tipo lunar natal | `natal-lunation-8-phases-v1` | `direct` |
| 2 | natal | `ORB-NAT-001` | Mapa elemental | `element-map-ten-planets-equal-v1` | `orbita_synthesis` |
| 3 | natal | `ORB-REL-001` | Patrón relacional | `relationship-pattern-moon-venus-mars-v1` | `orbita_synthesis` |
| 4 | today | `ORB-TRN-002` | Ranking de tránsitos | `transit-ranking-v1` | `orbita_synthesis` |
| 5 | today | `ORB-TRN-001` | Arco del tránsito | `transit-arc-planets-tropical-roots-v2` | `orbita_synthesis` |
| 6 | today | `ORB-LUN-003` | Luna en tu carta | `current-lunation-natal-chart-v1` | `orbita_synthesis` |
| 7 | today | `ORB-LUN-002` | Cumpleluna | `natal-elongation-return-full-day-range-v2` | `orbita_synthesis` |
| 8 | moment | `ORB-CYC-002` | Estación vital | `secondary-progressed-lunation-full-civil-day-v2` | `direct` |
| 9 | moment | `ORB-CYC-001` | Tema del año | `whole-sign-profection-traditional-rulers-v1` | `direct` |
| 10 | moment | `ORB-CYC-007` | Mandala temporal | `temporal-mandala-four-personal-rhythms-v2` | `orbita_synthesis` |

**Además existen dos análisis de comparación**, que NO viajan en el bundle personal sino en `relationships.getComparison` — por eso el registro tiene **12** IDs en total y el brief habla de "diez":

| `analysisId` | Título | `methodVersion` | Se usa cuando |
|---|---|---|---|
| `ORB-REL-002` | Intercambio elemental | `relationship-element-exchange-v1` (`direct`) | nivel `sign_to_sign` |
| `ORB-REL-003` | Diálogos entre dos cartas | `relationship-five-dimensions-v1` (`orbita_synthesis`) | niveles `date_to_date` y `chart_to_chart` |

### Notas de método que hay que respetar

- **`ORB-CYC-007` v2:** el tercer anillo dejó de ser la lunación colectiva y pasó a ser **`Tu ritmo lunar`** (entre dos Cumplelunas personales consecutivas). El validator conserva `current_lunation` **sólo** para poder leer snapshots v1.
- **`ORB-TRN-001` v2:** busca raíces reales y acotadas alrededor de la ventana activa vía `planets/tropical`, detecta dirección por pasada y agrupa el arco con un `arcId` estable. La identidad V1 es **carta + planeta + aspecto + punto natal + ventana lógica**; la procedencia (estimada vs. verificada) se descarta. Un `stale` sólo se acepta si planeta, punto natal y aspecto siguen siendo los del arco vigente. Nunca se presenta una extrapolación como cronología verificada.
- **`ORB-CYC-002` v2:** sin hora, se evalúa en `00:00 / 12:00 / 23:59` de la zona natal y sólo se publica la fase si un margen conservador descarta un cruce durante todo el día. Saltos y repeticiones del reloj se resuelven de forma cerrada.
- **`ORB-LUN-002`:** devuelve las dos raíces consecutivas `previousExactAt` y `nextExactAt`, para reconocer **todo el día civil** de la repetición.
- **Carta natal canónica** (`layers.getNatalChartBase`, `canonical-natal-chart-base-v1`): Sol–Plutón salen exclusivamente del cache `planets/tropical`; Ascendente, MC y las doce casas reutilizan geometría legacy **sólo con hora `known`**. Aspectos 0°/60°/90°/120°/180° con orbes 6°/4°/5°/5°/6°; no reutiliza `mainAspects` legacy.

### Los tres niveles de Vínculos

`ComparisonLevel` = `sign_to_sign | date_to_date | chart_to_chart`. Rank 1/2/3, denominador 3.

| Nivel | Badge · titular | Qué carga la persona | Qué se puede leer |
|---|---|---|---|
| 01 | `01 · SIGNO CONTRA SIGNO` | sólo el signo | lectura **general** (`ORB-REL-002`). Dos personas del mismo signo devuelven exactamente lo mismo. No entra nada personal |
| 02 | `02 · FECHA CONTRA FECHA` | fecha de nacimiento | tres de las cinco dimensiones (`ORB-REL-003`) |
| 03 | `03 · CARTA CONTRA CARTA` | fecha + hora + lugar | las cinco dimensiones (`ORB-REL-003`) |

**Las cinco dimensiones**, en el orden canónico del frame: `Cómo se hablan` · `Cómo se cuidan` · `Deseo` · `Fricción` · `Proyecto en común`.

**Reglas duras de la pantalla (cada una cierra un defecto real que ya volvió a aparecer una vez):**

- **El modo sale del nivel guardado (`persona.availableLevel`), NUNCA de `data?.generalOnly`.** Sin cálculo ese campo no existe, y el nivel 01 terminaba dibujando cinco barras en cero.
- **Nunca se dibuja una barra en cero**: si no hay cálculo, dice `SIN CALCULAR`.
- **Cada causa faltante dice de quién es el dato**, y el botón que se ofrece es el del **dueño del hueco** (no siempre es la otra persona).
- **El color de cada barra sale del balance apoyo/tensión** (`dimension.value`) — azul para lo fluido, cobre para tensión/ambivalencia — y **nunca** define el largo. El tono va también en la etiqueta accesible y en la leyenda visible (WCAG 1.4.1: azul y cobre difieren en tono, no en luminancia, 1,53:1).
- **Escalera canónica exacta:** `1/5`, "una dimensión / las otras cuatro". Nunca `1/6` ni "las otras cinco".
- **El método y su versión viven SÓLO dentro del `TraceAccordion`.** El pie visible no repite el identificador crudo.
- **No hay puntaje global de compatibilidad.** El descargo dice que esto muestra patrones simbólicos entre dos cartas: no mide amor, no decide compatibilidad y no predice duración.

---

## 7. Contratos y fuentes bibliográficas

### Superficie pública de Convex para V4.9.2

Registrada en `convex/CHANGELOG.md`. Todas devuelven `AnalysisResult<T>` cerrado.

> **SUPERADO (2026-08-20).** Las frases "Producción no se contactó" / "Producción
> no fue contactada" de esta sección son de las pasadas 13–15. Hoy
> **`exciting-bat-311` (producción) está desplegado y verificado con 142
> funciones**, y el webhook productivo de RevenueCat respondió **200**. Los
> catálogos de 125 / 129 funciones que siguen son históricos, de Development.

**Desplegadas en Development (`dutiful-viper-815`) desde el 2026-08-16 — HECHO:**

```
layers.getNatalBase()
layers.getNatalChartBase()
layers.getForDate({ localDate, timezone })
layers.refreshForDate({ localDate, timezone })
relationships.list()
relationships.savePerson(... , idempotencyKey)
relationships.removePerson({ profileId })
relationships.getComparison({ profileId })
relationships.refreshComparison({ profileId })
```

Verificación read-only de aquel deploy con `convex function-spec`: **125 funciones (86 públicas, 39 internas)**, las 9 del contrato presentes, `MISSING_COUNT: 0`. La migración fue **aditiva y sin pérdida** (tres índices nuevos). **Producción no se contactó ni para leer.**

**Agregadas y desplegadas en Development en la pasada 14 — HECHO:**

```
layers.getTransitArc({ localDate, timezone, arcId })       // query — arco NO principal
layers.refreshTransitArc({ localDate, timezone, arcId })   // action
charts.recoverNatalChart()                                  // action pública, args {} , returns discriminado
charts.recheckNatalStateForRun(...)                         // internalQuery
```

El catálogo live final tiene **129 funciones** y conserva las nueve anteriores más estas cuatro. Las correcciones editoriales también están live: Mapa elemental versiona su copy v2 y la comparación de Vínculos usa una versión v2 separada, sin mover `ORB-REL-001` de su versión v1. Producción no fue contactada.

**Schema:** aditivo. Tablas nuevas `analysisSnapshotsV492`, `natalEphemerisCachesV492`, `globalSkySnapshotsV492`, `relationshipComparisonCachesV492`. `relationshipProfiles` suma precisión de hora, coordenadas, timezone, identidad opcional del lugar y `creationRequestKey?` con índice `by_user_creation_request_key`. `natalInterpretations` suma `chartRevision?` y `claimSeq?`. Ningún cliente instalado se entera; ninguna firma pública se retiró.

### Fuentes bibliográficas

`convex/content/astrologySources.ts` contiene **únicamente metadatos y locators verificados**. **Los PDFs, sus rutas locales, sus hashes y su texto NO se envían.**

| ID | Obra | Autoría |
|---|---|---|
| `DG-AAS` | *Astrology and the Authentic Self* | Demetra George |
| `DR-AOP` | *The Astrology of Personality* | Dane Rudhyar |
| `DR-LC` | *The Lunation Cycle* | Dane Rudhyar |
| `SA-APE` | *Astrology, Psychology, and the Four Elements* | Stephen Arroyo |
| `RH-HS` | *Horoscope Symbols* | Robert Hand |
| `ST-LAA` | *Los aspectos en astrología* | Sue Tompkins |
| `SF-IS` | *The Inner Sky* | Steven Forrest |
| `HS-TH` | *The Twelve Houses* | Howard Sasportas |

Cada `SourceRef` lleva `chapter`, `section`, `pdfPages`, `printedPages`, `relation` (`direct · synthesis · contextual · doctrinal_disagreement`) y una `locatorNote` que explica la particularidad del escaneo. Ninguna edición bibliográfica se inventa: cuando el archivo no la declara, se dice explícitamente.

### Fuente visual y editorial

- Archivo Figma: `BEB5v6SbgJn2Nipm8Qa0wE` · Página `UX V4.9 - Órbita Capas de Tiempo` (`893:2`)
- Frame canónico de `Hoy · lo activo ahora`: `938:289` (leído por MCP antes de tocar código)
- Archivo histórico intocable: `95 · ARCHIVO V4.9` (`905:247`)
- Copy exacto por frame: `docs/handoff-claude-figma-v492-copy-claridad.md` **del checkout de producto** (`/Users/lucas/Documents/Core/projects/orbita/docs/`), **no** de este worktree.

⚠️ **Trampa conocida:** `docs/figma-context.md` de **este worktree** está desactualizado — describe V4.3 / V4.5 / V4.6 y **no menciona V4.9**. Para V4.9.2, la fuente vigente es el handoff de copy del checkout de producto más los frames reales por MCP.

**Los diez frames de referencia de V4.9.2:** `938:289` Hoy base · `961:712` Hoy evento/Cumpleluna · `965:934` Tránsitos lista · `966:975` Arco detalle · `943:356` Tu momento · `935:247` Carta hub · `969:907` Tipo lunar · `970:979` Mapa elemental · `947:434` Vínculos carta contra carta · `948:453` Vínculos signo contra signo.

---

## 8. Qué se implementó

### 8.1 Backend (`convex/**`) — HECHO y desplegado sólo a Development el 18/08

- Contrato completo de capas y Vínculos con sobre `AnalysisResult<T>` y `sourceRefs`.
- Caches nuevos con invalidación por datos natales + versión de método; **nunca** persisten el payload crudo del proveedor.
- **Precisión honesta sin hora:** `exact | estimated | range | omitted` por posición; sin hora exacta no hay casas, Ascendente ni profección.
- **Persistencia natal monotónica dentro de la transacción** (`resolveNatalPersistDecision`): una carta suficiente **nunca** se reemplaza; una insuficiente sólo se reemplaza por algo que sí alcanza. `profileAstrologyCaches` copia el payload **realmente elegido**.
- **Revalidación de identidad natal:** si `birthDataId`/`birthDataHash`/`cacheKey` cambiaron durante el cálculo, rechaza con `NATAL_BIRTH_DATA_CHANGED_DURING_CALCULATION` en vez de publicar una carta de datos que ya no existen. La mutación además **reafirma la identidad vigente** en `natalCharts` y `profileAstrologyCaches` sin tocar payload ni procedencia del ganador.
- **`charts.recoverNatalChart`** con desenlace discriminado: `recovered(stored|provider)` / `failed(provider_failed|still_incomplete)`. Un intento que no mejoró nada se dice como tal; una carta guardada nunca empeora.
- **Interpretación LLM atada a `chartRevision` + `cacheVersion`**, con claim y CAS final. Un claimant de versión vieja **no toma turno** (`stale_cache_version`) y no destruye una lectura vigente.
- **Coherencia del par `(ranking, arco)`** exigida por `arcId` **y** tupla (planeta en tránsito, punto natal, aspecto) en todo camino que arma el bundle, incluida la lectura de cache.
- **Contrato aditivo del arco elegido** (`getTransitArc` / `refreshTransitArc`) con alcance de cache propio `{ localDate, timezone, arcId }` y estados honestos (`unavailable` / `stale` / `partial` / `error`).
- **Invalidación editorial quirúrgica:** `ORB-NAT-001` incorpora la versión de copy v2; la comparación de Vínculos usa su propia versión v2 mientras `ORB-REL-001` conserva v1.
- **Degradación honesta de Vínculos:** si fecha/hora/lugar ya existen pero falla el cálculo de posiciones, el faltante es `comparison_ephemeris`; no se culpa a la otra persona ni se ofrece completar datos ya cargados.

### 8.2 Frontend (`app/**`, `src/**`) — HECHO

- Cinco pestañas con stack propio por sección; detalle abre dentro de su sección y vuelve a ella.
- Las 26 pantallas del alcance de Figma V4.9.2, con estados completos (loading / empty / error / success) y **el límite viajando junto al dato**.
- **Aislamiento nativo real:** implementaciones fuera de `app/`, en `src/routes/v492/`. Tarot y Diario no llegan al bundle.
- **Cola y ciclo de refresco** como módulos puros y testeables, con relevo por alcance y contador de intento reservado sincrónicamente.
- **Candados sincrónicos** (`src/domain/exclusive.ts`) para guardar, borrar y recuperar — **no** `useState`, que se aplica en el render siguiente.
- **Un solo resolvedor de estado de Carta** (`natalChartState`): hub y carta completa dicen exactamente lo mismo, con la misma voz en VoiceOver.
- **El límite de Plus se pregunta por superficie** (`natalHousesAccess` / `natalAspectsAccess`). **`access.positions` NO es entitlement** — vale `snapshot !== null`.
- **Geometría del mandala en un solo lugar**: la lista y el dial no pueden divergir.
- Copy de claridad editorial aplicado según el handoff de Figma; sin jerga sin traducir, sin `proveedor` en UI, sin notas internas visibles.

### 8.3 Precisión y honestidad de datos — HECHO

- Sin hora ⇒ sin casas ni ángulos falsos; el frame lo declara y la app también.
- Cumpleluna = repetición del ángulo Sol–Luna **natal** (no la lunación del mes).
- Mapa elemental: distribución simple de los diez planetas, mismo peso, sin Ascendente, casas ni asteroides. `SIN PLANETAS` sólo con recuento 0; con 1 o más, `MENOS PRESENTE`; los empates nombran a los dos.
- El orden de los tránsitos **no es un puntaje de importancia** y se dice.
- Un ranking vacío declara `active_transit_arc` ("hoy no hay tránsito mayor activo"), no `matching_transit_arc` ("todavía no está calculado").

### 8.4 Aislamiento Tarot / Diario — HECHO y verificado

Auditoría sobre **todos** los `.hbc` de cada plataforma (hoy 1 por plataforma):

- `RitualReading`, `DiarioScreen`, `TarotScreen`, `tarotSpread`, `arcanos` ⇒ **0 coincidencias, bundle por bundle**.
- `tarot` sin distinguir mayúsculas ⇒ **0**.
- `diario` sin distinguir mayúsculas ⇒ **3**, y las tres están explicadas: el copy `CAMBIA A DIARIO` y dos cadenas de ruta del manifiesto de expo-router que en nativo **sólo redirigen**. (El "0 en cualquier caso" de un informe anterior era inexacto y quedó corregido.)
- Contrato **presente** 1 vez cada uno: `getTransitArc`, `refreshTransitArc`, `matching_transit_arc`, `active_transit_arc`, `calculateOrCreateNatalChart`, `recoverNatalChart`, `refreshAndWait`, `createRefreshQueue`, `createRefreshCycle`, `claveDeAlcance`, `reservarIntento`, `LAYERS_REFRESH_UNAVAILABLE`, `REINTENTAR`, `COMPROBAR DE NUEVO`, `No pudimos completar el cálculo ahora`, `CALCULANDO…`.

### 8.5 QA y evidencia — HECHO

- Cuenta y datos QA creados **por flujos públicos reales** (toque y teclado reales vía `idb`), **sin una sola escritura directa a la base**. Perfil: `16/08/1996 · 12:00 · Buenos Aires` → Sol Leo · Luna Virgo · Ascendente Escorpio. Dos personas guardadas (una carta con carta, una signo).
- Los 12 estados tuvieron evidencia a **página completa a 393 pt** en alguna de las primeras pasadas. Para **01, 03, 05–07 y 10–12**, la comparación vigente sigue en `compare3/` + `shots/cert3/`. El **08** se recapturó en la pasada 14 y sólo el set con sufijo `v2` es vigente. **04** y **09** se recapturaron en la pasada 15; sólo `04-arco-live` y `09-vinculos-canonica` son sus comparaciones vigentes. El **02** conserva la evidencia de la segunda pasada y no se declara PASS. Los sets de proveedor caído de 04/09 siguen como historia válida de contingencia, no como veredicto actual.
- **Verificación en las dos direcciones** en cada pasada: cada arreglo se revierte por separado, su prueba focal tiene que **fallar** sin él y **pasar** con él, y el archivo se restaura **byte por byte** (sha256 antes/después).
- El perfil QA quedó **exactamente restaurado**, sin fixture natal temporal. Las preferencias de accesibilidad del simulador se dejaron como estaban.

---

## 9. Certificación técnica y runtime de los pases 14–15 · HISTÓRICO

> **HISTÓRICO.** Esta tabla certifica el runtime editorial de los pases 14–15
> (cert14/cert15) y sigue siendo la evidencia válida de **04, 08 y 09**. Sus
> cifras de suite (**1537/1537**, 93 suites) y de inventario (**310** entradas)
> quedaron **superadas**: el conteo vigente es **2145/2145 · 196 suites** y
> **381 entradas = 129 + 252** (bloque 0).

Evidencia técnica en `.local/audits/native-v492-recertification-2026-08-17/logs14/`; cierre runtime aditivo en `logs15/`, `shots/cert15/` y `compare15/`.

| Check | Resultado | Evidencia |
|---|---|---|
| Línea base | rama y HEAD intactos · **310** entradas = 100 tracked + 210 untracked · índice intacto con 2 entradas | `run-summary.md` |
| Deploy Development | **tres** deploys puntuales autorizados (14:33, 14:48, 15:11 ART) · `dutiful-viper-815` · **129 funciones** live | `run-summary.md`, `function-spec-final.json` |
| Interfaces | `getTransitArc`, `refreshTransitArc`, `recoverNatalChart` públicas; `recheckNatalStateForRun` interna | `function-spec-final.json` |
| Regresiones focales | primera roja **40/42**; auditoría roja de 6 fallos; borde parcial rojo **0/1**; final **91/91** | `run-summary.md`, `cache-focals-green.log` |
| `pnpm typecheck` | exit 0 | `typecheck.log` |
| `pnpm test` | **1537/1537** · 93 suites · 0 fail | `tests.log` |
| Diff | working tree e índice sin errores de whitespace | `diff-check.log`, `diff-cached-check.log` |
| Codegen/schema | SHA-256 idénticos antes/después; sin cambio de schema, bindings ni firmas | `run-summary.md` |
| 08 runtime | PASS v2: artículo, encabezado y `un planeta` correctos; captura y comparación inspeccionadas | `08-v2-focus.md`, `08-v2-capture.json`, `08-v2-compare.json` |
| 04 runtime | PASS: ranking real #2, trazabilidad `ORB-TRN-001` + método v2, nunca `ORB-TRN-002` | `logs15/04-ranking-check.json`, `logs15/04-trace-check.json`, `logs15/04-focus.md`, `shots/cert15/04-arco-live.png` |
| 09 runtime | PASS: 14/14 contactos en voz `Su/Tu`, 0 nombres propios repetidos | `logs15/09-voice-check.json`, `logs15/09-expanded-focus.md`, `shots/cert15/09-vinculos-canonica.png` |
| Recuperación natal | cuenta QA completa, sin CTA recuperable; evidencia válida sólo para ausencia del camino de recuperación, no para copy visual | `recovery-current-account.md` |

### Evidencia heredada del decimotercer pase

Los exports, bundles y la compilación Android no se repitieron: la pasada 14 cambió invalidación editorial, concordancia y degradación de Vínculos, todo en backend/pruebas y sin tocar código nativo. Su evidencia certificada sigue en `.local/audits/native-v492-recertification-2026-08-17/logs13/`.

| Check | Resultado | Evidencia |
|---|---|---|
| `pnpm typecheck` | **exit 0** | `typecheck.log` |
| `pnpm test` | **1532 / 1532** · 93 suites · 0 fail · exit 0 (+13 sobre 1519, ninguna prueba debilitada ni borrada) | `suite.log` |
| Piso de cobertura | **1532 / mínimo 745** · 0 fallos / máximo 0 · exit 0 | `piso-cobertura.log` |
| Gate `convex/_generated/api.d.ts` | **7 / 7** exit 0 — esta pasada no toca `convex/`, no hizo falta codegen | `gate-generated.log` |
| Focales (cola · ciclo · `useLayers` · recuperación natal · `.easignore` · capas · gate) | **8 archivos, 143 tests, 0 fallos** | `focales.log` |
| Verificación en las dos direcciones | **10 reversiones**, todas fallan sin su arreglo (entre 1 y 14 tests cada una) y pasan con él; sha256 idéntico al restaurar | `verificacion-antes-despues.md`, `verify-reverts.log` |
| `git diff --check` | **0 y 0** (working tree e índice) · **210** untracked con `--no-index`: **0 avisos** — el log cubre los 209 que existían al correrlo y este handoff, el 210.º, se verificó aparte · el índice sigue con sus 2 entradas | `diff-check.log`, `diff-check-untracked.log`, `indice.log` |
| Gate `.easignore` | **PASS** · 14 rutas · **dos motores que coinciden** (el paquete `ignore` que usa EAS CLI y el motor de gitignore de git) · 0 discrepancias · versionado en `test/easignoreV492.test.ts` | `easignore-gate.log` |
| Export web + `check:web-export` | **verde** · 32.10 MB / 50 MB · imagen máxima 479.3 KB / 500 KB · JS gzip **1006.4 KB** / 1.25 MB · ficha de búsqueda completa · `dist/` 189 archivos | `web-export.log`, `web-export-check.log` |
| Smoke web `/ /home /carta /transito /diario` | **0 errores de consola** en las cinco rutas — Chrome headless, perfil nuevo y descartable, **anónimo por construcción** | `web-smoke.log`, `shots/web-smoke13/` |
| Export iOS + Android · auditoría de **todos** los `.hbc` | **GATE PASS** · 1 bundle por plataforma · **7.0 MB** cada uno | `ios-export.log`, `android-export.log`, `bundle-audit.log` |
| Bundle nativo sin Tarot / Diario | **PASS** en iOS y Android (detalle en §8.4) | `bundle-audit.log` |
| **Compilación NATIVA Android (Gradle)** — **corrida VIGENTE: la del ÁRBOL FINAL**, después de escribir la documentación | **BUILD SUCCESSFUL in 1m 18s** · 511 tareas (483 ejecutadas, 28 up-to-date) · **APK de 196 MB** (205.122.840 bytes) · SHA-256 `0e6d3d21b335f24cc6f914818f00dc39df55c29cb27b5e08f585d37dfad2c112` · JDK Temurin 17.0.19, SDK 36, NDK 27.1.12297006 · sin instalar toolchain, sin EAS, sin ensuciar el worktree | `android-native-compile-final.log` |
| **Fidelidad byte a byte del snapshot compilado** | manifiestos deterministas (ruta + tamaño + SHA-256) del árbol y del snapshot, comparados **antes** del prebuild: **939 archivos · 0 symlinks · mismo digest**, y en la corrida vigente ese digest es `be17190a9aa4f3bf34315e9d3a7de98e73e1c02163c3d2c795031110de49a88b`. Ningún `.env*` entra al manifiesto ni al snapshot | `android-native-compile-final.log`; `fidelidad-snapshot.md` como resumen de las dos corridas |
| Los gates fallan de verdad (self-tests) | **3 / 3** — Android exige APK (sale 28 donde el runner anterior salía 0) · exports falla con un segundo bundle sucio y con conteo contractual inflado · `.easignore` rechaza el archivo viejo | `android-self-test.log`, `gate-self-test.log`, `easignore-self-test.log` |

**Archivos de producto tocados por la decimotercera pasada (5):** `src/domain/refreshCycle.ts`, `src/hooks/useLayers.tsx`, `test/refreshQueueV492.test.ts`, `test/easignoreV492.test.ts` (nuevo) y `.easignore`. **Cero en backend.**

**Nota sobre las dos compilaciones Android:** `design-qa.md` también conserva el registro histórico de la primera corrida (**1m 14s**). `logs13/fidelidad-snapshot.md` distingue ambas y marca como vigente la corrida posterior sobre el árbol final: `android-native-compile-final.log`, **1m 18s**, digest `be17190a9aa4f3bf34315e9d3a7de98e73e1c02163c3d2c795031110de49a88b`.

**Estado P0/P1/P2:** el P1 y los cuatro P2 que las auditorías independientes reprodujeron sobre el duodécimo pase están **cerrados y verificados en las dos direcciones**. **No hay P0/P1/P2 abiertos.**

**Auditoría independiente sobre el decimotercer pase — HECHA.** La corrieron tres revisores read-only separados, uno por alcance, y **cada alcance cerró en 0 P0, 0 P1 y 0 P2**:

| Alcance | Qué revisó | Resultado |
|---|---|---|
| **Cola de recálculo** | `refreshQueue` / `refreshCycle` / `useLayers`, relevo por alcance e intento reservado | **60/60** reejecutados · 0 P0 / 0 P1 / 0 P2 |
| **Integración y documentación** | rutas, bindings de servicios y coherencia documental | **58/58** · 0 P0 / 0 P1 / 0 P2 |
| **Release** | revalidó typecheck, **1532/1532**, exports, `.easignore`, la compilación Android y el estado de git | 0 P0 / 0 P1 / 0 P2 |

Codex reejecutó después, sobre el mismo árbol: typecheck **exit 0**, **focales combinadas 79/79**, **suite completa 1532/1532** y los `git diff --check` (working tree, índice y untracked) limpios.

**Lo honesto:** esa auditoría del pase 13 fue **read-only** y **no dejó un directorio propio** — reprodujo los checks contra `logs13/`. El `logs14/` que hoy existe pertenece exclusivamente a la pasada 14; no es evidencia retroactiva de aquella auditoría.

---

## 10. Certificación visual — tabla honesta

**El veredicto NO es "los 12 estados pasan".** Conteo vigente: **10 PASS · 1 BLOCKED externo · 1 sin recapturar**. La pasada 14 cerró 08 y la pasada 15 cerró 04/09 después de restaurarse los créditos del proveedor.

| # | Estado | Veredicto | De qué depende exactamente |
|---|---|---|---|
| 01 | Hoy | **PASS** | — |
| 02 | Hoy con evento | **SIN RECAPTURAR** | Su fixture vivía en un simulador descartable que una pasada anterior borró. Su código no se tocó; la evidencia válida sigue siendo la de la segunda pasada. **No se declara PASS.** |
| 03 | Tránsitos | **PASS** | — |
| 04 | Detalle de arco | **PASS** | Ranking real de 12 entradas; arco #2 `Urano en sextil con tu Saturno`. Trazabilidad `ORB-TRN-001` + `transit-arc-planets-tropical-roots-v2`, nunca `ORB-TRN-002`. Comparación vigente en `compare15/04-arco-live-*`. |
| 05 | Tu momento | **PASS** | — |
| 06 | Carta | **BLOCKED** | Exige una cuenta con **entitlement Órbita Plus real**. Ninguna cuenta QA local lo tiene (verificado en los tres simuladores) y `isPro` sale de filas reales de suscripción. **No se concedió acceso y no se tocó monetización.** Lo capturado es el estado alternativo honesto, dicho como tal. |
| 07 | Tipo lunar | **PASS** | — |
| 08 | Mapa elemental | **PASS** | Runtime v2 recapturado: `La tierra reúne…`, `CUANDO LA TIERRA SATURA` y `con un planeta`; ausencia de `El tierra` y `uno planeta`. Comparación vigente en `compare14/08-mapa-elemental-v2-*`. |
| 09 | Vínculos carta contra carta | **PASS** | Comparación real nivel 03. Los 14 contactos expandidos usan `Su … con tu …` / `Tu … en su …`; 0 repiten `Vos` o `Martina QA`. Comparación vigente en `compare15/09-vinculos-canonica-*`. |
| 10 | Vínculos signo contra signo | **PASS** | — |
| 11 | Carta sin hora | **PASS** | — |
| 12 | Tu momento sin hora | **PASS** | — |
| D7 | Recálculo natal | **FUNCIONAL PASS / RUNTIME 15 N/A** | La cuenta QA disponible tiene carta completa y no ofrece `COMPROBAR DE NUEVO`. Se conserva la medición funcional anterior; no se fabricaron filas ni una caída del proveedor. |
| — | **VoiceOver con el lector encendido** | **BLOCKED — externo** | El lector **no está instalado** en el runtime del simulador (iOS 26.5). Exige un **iPhone físico**. No es una limitación de automatización. |
| — | **Verificación visual autenticada de la web** | **PENDIENTE** | El smoke vigente es **anónimo a propósito** (abrir sesión exigía login/OAuth, prohibido en esta corrida). Un export verde y una suite verde **no equivalen** a un smoke visual autenticado. |

### Diferencias declaradas contra el frame que **no** son defectos

1. **Los datos son de otra persona.** La cuenta QA reparte `2/4/3/1` y el frame `6/3/1/0`; el arco real tiene un contacto y el del frame tres; la comparación real da tres dimensiones fluidas y el fixture del frame dos.
2. **La rueda de la Carta es real.** El frame dibuja una ilustración rotulada `NO CODIFICA TUS GRADOS`; la implementación dibuja la carta natal verdadera y por eso no lleva ese rótulo.
3. **La lista de Tránsitos mostró 12 tránsitos activos reales** en la pasada 15; el frame dibuja 6.
4. **Formato de fecha superior:** el frame escribe `VIE 15 AGO`; la app escribe `LUNES 17 DE AGOSTO`, el formato que ya usan Hoy y Tránsitos.
5. **Dynamic Type en la barra:** en el tamaño accesible más grande dos labels se parten a mitad de palabra. Nada se recorta ni se superpone.

### Accesibilidad medida

**PASS:** 375 / 393 / 440 pt (cada pestaña ≥ 74×44) · Dynamic Type (`accessibility-extra-large`) · objetivos táctiles (pestañas 74–87 × 44) · Reduce Motion (dos capturas a 3 s, idénticas pixel a pixel) · contraste (21 pares, mínimo de texto **4,80:1**) · color como único medio (WCAG 1.4.1) · orden de foco, rol, valor, estado y acciones (siete pantallas recorridas).

**BLOCKED / no medible:** VoiceOver con el lector encendido (iPhone físico) · live region del recálculo (`idb` no publica `accessibilityLiveRegion`) · rol `tab` / estado `selected` de la barra (está en el código y con gate; `idb` no mapea ese rol).

---

## 11. Pendientes, por prioridad y dependencias

### Prioridad 0 — bloqueante de release (2026-08-19) · **SUPERADO, ver bloque 0**

> **SUPERADO (2026-08-20).** Los dos P0 de esta tabla están **cerrados**: el
> finalizador de Clerk se implementó, se desplegó y se verificó en runtime
> end-to-end, y el comercio nativo llegó hasta **TestFlight interno** con el
> build 1.0.0 (20). La fila de pendientes vigente es la del **bloque 0**, y su
> primer bloqueo es que **Lucas acepte personalmente el Apple Developer Program
> License Agreement actualizado**. La tabla se conserva como historia.

| # | Pendiente | Tipo | Qué hace falta |
|---|---|---|---|
| 0 | ~~**Finalizador server-side de la identidad en Clerk.**~~ **CERRADO.** Si `deleteUser` termina y el proceso cae antes de persistir `identity_deleted`, ese checkpoint sólo existía en memoria: al reiniciar el flujo quedaba fail-closed y la salida era soporte. | **CERRADO 2026-08-19** | Se implementó el tombstone durable sobre `accountDeletionFences` con runner contra la Clerk Backend API, `CLERK_SECRET_KEY` cargada en dev y prod, y **verificación en runtime con el proceso matado dentro de la ventana**: el servidor terminó el borrado solo y la app purgó al reabrir. Siguen valiendo las dos reglas: **nunca promover el checkpoint antes de que Clerk confirme, ni inferir el borrado desde un `signed-out`.** |
| 0b | ~~**Comercio nativo iOS end-to-end**~~ **CERRADO hasta TestFlight.** | **PARCIAL — falta App Review** | Catálogo Apple/RevenueCat, deploy a producción, build 1.0.0 (20), compra/restore en Sandbox y TestFlight interno: **hechos**. Falta la QA física del build 20, los screenshots, el screenshot de Review Information y **la selección del build para App Review**, que no se hizo. Ver `docs/native-commerce-release-checklist.md` y el bloque 0. |

### Prioridad 1 — completa evidencia no bloqueante

| # | Pendiente | Tipo | Depende de | Desbloquea |
|---|---|---|---|---|
| 1 | **Ejercitar en runtime la recuperación natal** | PENDIENTE | Una carta incompleta que ya exista y sea alcanzable por UI; no crear filas directas ni provocar una caída real. | Completa la evidencia runtime de D18–D44 |

### Prioridad 2 — bloqueos externos, sin dependencia entre sí

| # | Pendiente | Tipo | Qué hace falta |
|---|---|---|---|
| 2 | **Estado 06** | PENDIENTE EXTERNO | Una cuenta QA con **entitlement Órbita Plus real**. **NO AUTORIZADO** conceder acceso ni tocar monetización para conseguirlo. |
| 3 | **Recapturar 02** (Hoy con evento) | NO BLOQUEANTE | Credenciales locales seguras para generar un fixture real y un simulador descartable. No estaban disponibles en la pasada 14; se conserva la evidencia histórica. |
| 4 | **VoiceOver con el lector encendido** | PENDIENTE EXTERNO | Un **iPhone físico**. No hay atajo por simulador ni se declara soporte en App Store antes de probarlo. |
| 5 | **Verificación visual autenticada de la web** | TAREA SEPARADA | Una sesión real en el navegador. V4.9.2 no rediseña la web y el smoke anónimo no reemplaza esa revisión. |

### Prioridad 3 — antes de cualquier PR

| # | Pendiente | Tipo |
|---|---|---|
| 6 | **Corte A — contrato/backend:** 43 entradas. Es un corte de revisión; el proceso canónico exige separar contrato de backend por hunks antes de convertirlo en PR. | PREPARADO, NO STAGED |
| 7 | **Corte B — aplicación nativa:** 258 entradas, incluidas las 2 ya preparadas. | PREPARADO, NO CAMBIAR ÍNDICE |
| 8 | **Corte C — hardening/documentación:** 9 entradas. | PREPARADO, NO STAGED |
| 11 | Rebase sobre `main`, staging intencional, commits y PRs. | **NO AUTORIZADO** hasta orden explícita |

> **Los tres cortes suman 310 y describen el inventario del 2026-08-18.** El
> árbol actual tiene **381** entradas: las 71 nuevas de identidad, borrado y
> comercio todavía no están repartidas entre cortes. Recalcularlos es parte del
> trabajo de armar los PRs, y ese trabajo sigue **NO AUTORIZADO**.

> La auditoría independiente sobre el decimotercer pase se conserva. La pasada 14 agregó la regresión que faltaba y su evidencia separada; no borra ni reescribe `logs13/`.

### NO AUTORIZADO (requiere aprobación explícita de Lucas, uno por uno)

commit · push · merge · **otro** deploy a Convex Development · **otro** deploy a Convex Producción · EAS build · **otra** subida a TestFlight · **seleccionar un build para App Review** · **Add for Review** · **publicar en App Store** · deploy web (Vercel) · conceder entitlements o tocar monetización · borrar evidencia de `.local/`.

> Que el deploy de producción y la subida a TestFlight del build 20 ya hayan
> ocurrido **no** los deja autorizados de forma permanente: fueron órdenes
> puntuales. **Add for Review y la publicación necesitan dos aprobaciones
> separadas.**

### Observación de producto anotada, fuera de alcance

Guardar datos natales **no** dispara `layers.refreshForDate`: la carta se republica al cambiar la hora civil, al volver la app al frente o al tocar `Comprobar de nuevo`. La pantalla lo dice con honestidad y ofrece la acción. Cambiarlo tocaría el ciclo de datos.

---

## 12. Cómo retomar en un chat nuevo

### Paso 0 — leer antes de tocar nada

Lectura inicial mínima, en este orden: **el bloque 0 de este documento** (estado
vigente, veredicto, bloqueos y prohibiciones) → la sección inicial
`## RC productivo Órbita 1.0.0 (21) — estado medido (2026-08-20) · VIGENTE`
de `CURRENT_TASK.md` → `AGENTS.md` → `CLAUDE.md` → `PROJECT_CONTEXT.md`. Eso
alcanza para orientarse. El resto de este documento y de `CURRENT_TASK.md` es
historia: se consulta cuando hace falta entender una decisión, no para saber el
estado.

Consultá bajo demanda, según la tarea: `design-qa.md` (bloque `## Estado vigente (2026-08-19)`), `.local/audits/native-v492-recertification-2026-08-17/README.md` §0, `docs/proceso-desarrollo-y-releases.md` y `WORKFLOW.md`. **Advertencia:** el setup/autenticación de Claude que aparece en `WORKFLOW.md` es histórico y está obsoleto. Ese archivo se consulta sólo por territorio y release. Para Claude y autenticación mandan `AGENTS.md` de Core y el lanzador seguro `/Users/lucas/Documents/Core/scripts/claude-opus -p`: nunca ejecutar `claude` directo, `claude auth login`, `claude setup-token`, abrir OAuth/navegador ni buscar o leer el token.

Para copy y diseño: el handoff de Figma del **checkout de producto** (`/Users/lucas/Documents/Core/projects/orbita/docs/handoff-claude-figma-v492-copy-claridad.md`) y los frames reales por MCP. **No** uses `docs/figma-context.md` de este worktree para V4.9.2: está desactualizado.

### Paso 1 — confirmar dónde estás

```bash
cd /Users/lucas/Documents/Core/worktrees/orbita/native-v492
git branch --show-current      # feature/native-v492-implementation
git status --porcelain -uall | wc -l   # ~381 (129 tracked + 252 untracked)
git log --oneline -1           # 52836ad
```

El conteo de referencia se movió con las pasadas (381 el 18/8, **398** al cerrar
el 19/8 — ver bloque 0). Lo que **no** se mueve y hay que verificar es la rama,
el HEAD `52836ad` y el **índice con sus 2 entradas**. Si la rama es otra, si el
índice cambió o si el árbol aparece limpio, **pará y avisá**: alguien lo tocó.

> El RC vive en **otro** worktree —`release-1.0.0-build20`, commit `b2531a19`,
> limpio—. No lo confundas con éste ni trabajes ahí sin orden explícita.

> ⚠️ **TRAMPA REAL, ya ocurrió (2026-08-19).** Este worktree y el checkout de
> producto `projects/orbita` comparten el **mismo** `CONVEX_DEPLOYMENT` de dev
> (`dev:dutiful-viper-815`), pero sus backends tienen **semanas de diferencia**.
> Un comando de Convex corrido desde el directorio equivocado apunta al
> deployment correcto con el código incorrecto, y **no lo dice por ningún lado**.
>
> Un `npx convex dev --once` lanzado desde `projects/orbita` casi pisa
> Development con el backend viejo: habría borrado `payments/revenuecatRest`,
> `users:deleteAccountV2` y `accountDeletionFences`. Lo frenó la validación de
> schema de Convex, no el operador. Con la base más vacía habría entrado sin
> quejarse.
>
> **Poné siempre el `cd` en la misma línea del comando**, y antes de aceptar una
> salida como buena, confirmá que dice el deployment esperado.

### Paso 2 — reglas de la sesión

0. **Roles:** Claude Code es el **ejecutor principal**; Codex **orquesta, revisa y verifica**.
1. **Preservá los cambios sin commitear.** No commitees, no pushees, no mergees, no hagas `reset`, `clean` ni `checkout` destructivo.
2. **No toques `main`** ni ninguna otra rama. **No toques el índice:** son exactamente 2 entradas heredadas.
3. **No despliegues nada** —Convex, Vercel, EAS, TestFlight, App Store— sin autorización explícita de Lucas para ese despliegue puntual. Tampoco dashboards de Apple ni de RevenueCat.
4. **No corras `convex dev` ni `convex codegen`** si sos el frontend. Ese comando es de Codex.
5. **No borres `.local/`.** Es la evidencia de quince pasadas.
6. **Territorio:** `convex/**` es de Codex; `app/**`, `src/**`, `assets/**`, `src/theme/**` son de Claude.
7. **Escribí la ficha de tarea** (objetivo, criterios de aceptación, owner, territorio, riesgo, pruebas, rollout, rollback, fuera de alcance) **antes** de tocar archivos.
8. **No leas ni imprimas secretos**, y no hardcodees precios ni product IDs.
9. **No debilites gates de runtime para poner tests en verde.** El método es TDD: prueba roja de conducta que reproduzca el defecto → arreglo mínimo → verde.

### Paso 3 — invocar a Claude Code (si sos Codex u orquestás)

```bash
/Users/lucas/Documents/Core/scripts/claude-opus -p "<instrucción>"
```

Siempre desde la raíz del proyecto y **siempre por el lanzador**. Nunca el binario `claude` directo, nunca `--bare` (ignora `CLAUDE_CODE_OAUTH_TOKEN`), nunca `claude auth login` ni `claude setup-token`, nunca abrir navegador ni pantalla OAuth. El agente **no** busca, lee, copia ni recupera el token por su cuenta: el único componente autorizado para leerlo es el lanzador.

Si el primer intento sale con código `44` o dice que Claude Code no está disponible por el lanzador seguro, asumí que el aislamiento bloqueó el Llavero: **repetí una sola vez exactamente el mismo comando** fuera del aislamiento, por la aprobación normal de ejecución. Si también falla ahí, **detené el trabajo que dependía de Claude y reportá exactamente ese bloqueo** — sin inventar otra vía de autenticación y sin pedir que Lucas pegue el token en el chat.

### Paso 4 — antes de decir "listo"

`pnpm typecheck` verde · `pnpm test` verde y **≥ 2145** (el piso mínimo del gate es 745; bajar de 2145 significa que se borró o debilitó una prueba) · `git diff --check` y `git diff --cached --check` limpios · índice intacto con sus 2 entradas · un objetivo por PR · `CURRENT_TASK.md` actualizado si cambió plan, estado, decisiones o handoff.

**Si arreglás algo, verificalo en las dos direcciones:** revertí el arreglo, comprobá que su prueba focal **falla**, restaurá byte por byte y comprobá que **pasa**. Es el estándar de esta corrida y es lo que permitió detectar la invalidación editorial ausente.

---

## 13. Comandos de verificación

```bash
cd /Users/lucas/Documents/Core/worktrees/orbita/native-v492

# Estado
git branch --show-current
git log --oneline -1
git status --porcelain -uall | wc -l              # 381
git status --porcelain -uall | grep -c '^??'      # 252
git diff --cached --name-status                   # las 2 entradas del índice

# Gates obligatorios
pnpm typecheck                                   # exit 0
node --import tsx --test test/*.test.ts          # 2145/2145, 196 suites, 0 fail
pnpm check:test-count test-output.log            # corrida 2145 / mínimo 745
git diff --check                                 # 0
git diff --cached --check                        # 0

# Focales de identidad, borrado y comercio (pasadas 2026-08-19)
node --import tsx --test test/accountDeletionFence.test.ts
node --import tsx --test test/accountDeletionFlow.test.ts
node --import tsx --test test/accountDeletionCommerce.test.ts
node --import tsx --test test/nativeCommerceSurface.test.ts
node --import tsx --test test/nativeCommerceIntegration.test.ts
node --import tsx --test test/accesoPostAlta.test.ts
node --import tsx --test test/convexGeneratedApiGate.test.ts   # bindings, sin codegen

# Focales de la corrida editorial 14–15 (HISTÓRICAS, siguen verdes)
node --import tsx --test test/refreshQueueV492.test.ts
node --import tsx --test test/easignoreV492.test.ts
node --import tsx --test test/cartaRecuperacionV492.test.ts
node --import tsx --test test/layersV492Runtime.test.ts
node --import tsx --test test/relationshipsV492.test.ts
node --import tsx --test test/layerAssembly.test.ts
node --import tsx --test test/relationshipLayers.test.ts
node --import tsx --test test/convexGeneratedApiGate.test.ts

# Export web y sus límites
pnpm build:web
pnpm check:web-export                            # 32.10 MB / 50 · JS gzip 1006.4 KB / 1.25 MB

# Runners de auditoría (regeneran exports; borran dist-ios/dist-android al terminar)
bash .local/audits/native-v492-recertification-2026-08-17/tools/run-exports13.sh
bash .local/audits/native-v492-recertification-2026-08-17/tools/android-native-compile13.sh
node .local/audits/native-v492-recertification-2026-08-17/tools/easignore-gate13.mjs
```

`verify-reverts13.mjs` **no es un comando rutinario**. Modifica temporalmente `.easignore`, `refreshCycle`, `useLayers` y `refreshQueue`, y restaura en `finally`. Ejecutarlo sólo durante una recertificación controlada, con el árbol respaldado y supervisado: una interrupción abrupta o `SIGKILL` puede impedir la restauración y dejar archivos alterados.

**Prohibidos sin autorización explícita:** `pnpm convex:dev`, `pnpm convex:codegen`, `convex deploy`, `eas build`, `eas submit`, cualquier deploy de Vercel, `git commit`, `git push`, `git merge`, `git clean`.

---

## 14. Archivos clave y evidencia

### Documentos vivos

| Archivo | Qué es |
|---|---|
| `CURRENT_TASK.md` | Ficha y bitácora. **La sección inicial `## RC productivo Órbita 1.0.0 (21) — estado medido (2026-08-20) · VIGENTE` es la actual**; hacia abajo queda el historial rotulado. |
| `design-qa.md` | Veredicto visual honesto, tabla de los 12 estados, defectos D1–D49 con su verificación, y los checks de cada pasada. El bloque `## Estado vigente (2026-08-19)` manda sobre las cifras; la tabla de estados sigue siendo la referencia visual. |
| `docs/native-commerce-release-checklist.md` | Qué falta **fuera del código** para poder cobrar en iOS: catálogo Apple/RevenueCat, contratos, build nativo, sandbox y App Review. |
| `docs/recuperacion-eliminacion-cuenta.md` | Procedimiento operativo cuando un borrado queda a mitad de camino (checkpoint de Clerk no persistido). |
| `.local/audits/native-v492-recertification-2026-08-17/README.md` | Informe de quince pasadas. `logs15/`, `shots/cert15/` y `compare15/` son aditivos. **Cubre hasta la pasada 15; las pasadas posteriores de identidad, borrado y comercio no están ahí sino en `CURRENT_TASK.md`.** |
| `convex/CHANGELOG.md` | Historia del contrato, entrada por entrada, con su rollout. |
| `PROJECT_CONTEXT.md`, `AGENTS.md`, `CLAUDE.md`, `WORKFLOW.md`, `docs/proceso-desarrollo-y-releases.md` | Reglas de proceso y territorio. En `WORKFLOW.md`, el setup/auth de Claude es histórico y **no se ejecuta**; mandan Core `AGENTS.md` y el lanzador seguro. |
| `/Users/lucas/Documents/Core/projects/orbita/docs/handoff-claude-figma-v492-copy-claridad.md` | **Copy exacto por frame de V4.9.2.** Vive en el checkout de producto, no acá. |

### Código

**Backend:** `convex/layers.ts` · `convex/relationships.ts` · `convex/charts.ts` · `convex/schema.ts` · `convex/lib/{layerContract,layerAssembly,layersMath,transitLayers,transitTimeline,relationshipLayers,natalChartBaseContract,natalGeometry,natalRevision,civilTime,stableHash}.ts` · `convex/content/astrologySources.ts`

**Frontend:** `src/routes/v492/**` · `src/screens/v492/**` (12 pantallas) · `src/components/v492/**` · `src/domain/{layers,relationships,natalChartState,natalChartRecovery,refreshQueue,refreshCycle,exclusive,transitArcRequest}.ts` · `src/hooks/useLayers.tsx` · `src/hooks/useNatalChartRecovery.ts` · `src/services/{layersApi,relationshipsApi,chartsApi}.ts`

**Rutas:** `app/(tabs)/{hoy,transitos,vinculos,umbral,perfil}/**`

**Pruebas de V4.9.2:** `test/{refreshQueueV492,cartaRecuperacionV492,easignoreV492,layersV492Runtime,convexGeneratedApiGate,cartaV492,momentoV492,v492CopyA11y,vinculosNativeV492,nativeDefectsV492,v492ReleaseP1,arcoDetailNativeV492,transitArcDetailV492,relationshipsV492,natalRecoveryBackendV492,natalInterpretationRevisionV492,chartsBindingsV492,v492PrecisionUi}.test.ts`

### Evidencia (toda bajo `.local/audits/native-v492-recertification-2026-08-17/`)

| Ruta | Contenido |
|---|---|
| `logs15/` + `shots/cert15/` + `compare15/` | **Cierre runtime de 04/09 (cert15, HISTÓRICO pero todavía la evidencia válida de esos dos estados).** 04 = `04-ranking-check.json`, `04-focus.md`, `04-trace-check.json`, `04-arco-live.png`, `04-arco-live-p1.png`, `04-arco-live-p2.png` y `04-arco-live-p3.png`. `04-capture.json` marca `suspect:true`, pero el PNG fue inspeccionado y no tiene defectos. 09 = `09-focus.md`, `09-expanded-focus.md`, `09-voice-check.json`, `09-vinculos-canonica.png`, `09-vinculos-canonica-p1.png`, `09-vinculos-canonica-p2.png` y `09-vinculos-canonica-p3.png`. El PNG muestra el estado colapsado; los 14 contactos completos los prueban el focus expandido y el JSON. |
| `logs14/` + `shots/cert14/` + `compare14/` | **Checks técnicos de cert14 y contingencia, HISTÓRICOS.** 08 = set `v2` aceptado. 04/09 = caída del proveedor y fallback honesto; ya no definen su veredicto actual. `run-summary.md` enumera los tres deploys y las capturas rechazadas. |
| `logs13/` | **Checks de release heredados vigentes para exports, bundles y compilación Android.** No se repitieron porque la pasada 14 no cambió código nativo. Android se compiló **dos veces**: la corrida final es `android-native-compile-final.log` (árbol final, 1m 18s); `android-native-compile.log` es la anterior y `fidelidad-snapshot.md` resume ambas. |
| `logs2/` … `logs12/` | Los checks de cada pasada anterior. **No se reescribieron** — `logs12/` conserva incluso el runner de Android que podía salir verde sin APK. |
| `compare3/` + `shots/cert3/` | Comparación visual heredada vigente para **01, 03, 05–07 y 10–12**. Página completa a 393 pt contra el frame, en cortes de 850 pt, con la barra fija una sola vez. 04/09 quedan históricos y 08 fue reemplazado por v2. |
| `compare2/02-hoy-evento-p1.png` … `p4.png` + `shots/cert2/02-hoy-evento.png` | Única evidencia disponible del estado **02**, tomada en la segunda pasada. Es histórica y no equivale a una recaptura ni a un PASS. |
| `compare/`, resto de `compare2/`, `shots/cert/`, resto de `shots/cert2/` | Comparaciones históricas de la primera y segunda pasada; para los demás estados fueron reemplazadas por la tercera. |
| `shots/web-smoke13/` | Las cinco capturas del smoke web anónimo vigente. |
| `logs3/d7-recalculo.md` | Los tiempos reales medidos del recálculo natal. |
| `tools/` | Los runners: `run-exports13.sh`, `android-native-compile13.sh`, `easignore-gate13.mjs`, `verify-reverts13.mjs`, `tree-manifest13.py`, `fullpage3.mjs`, `capture3.mjs`, `with-public-env.sh`. **`verify-reverts13.mjs` muta archivos temporalmente y no debe ejecutarse como check rutinario. `capture3.mjs` es histórico y escribe en `cert3/compare3`: no ejecutarlo. Para evidencia nueva usar `fullpage3.mjs` con rutas de salida explícitas y únicas.** |
| `.local/audits/native-v492-certification-2026-08-16/` | La certificación anterior (0 PASS · 11 FAIL · 1 BLOCKED). Contexto histórico. |

---

## 15. Riesgos y errores que NO deben reintroducirse

Cada uno de estos ya pasó al menos una vez en esta corrida y volvería a pasar sin cuidado.

### De concurrencia y estado

1. **Usar `useState` como candado.** `saving`, `borrando`, `attempt` se aplican en el render **siguiente**: dos toques del mismo render entran los dos. Candado sincrónico (`src/domain/exclusive.ts`), tomado **antes del primer `await`** y liberado en `finally`.
2. **Armar el nonce del alcance con el espejo de React.** `setAttempt(v => v + 1)` no sirve: el valor nuevo recién existe en el render siguiente. El contador vive en el **ciclo** (`reservarIntento()`), y quien llama **no elige el intento**.
3. **Suponer que una suite verde cubre concurrencia.** 1423 pruebas en verde no cubrían **ocho** carreras reales, porque ninguna controlaba el orden de resolución. Las pruebas de interleaving usan **promesas diferidas**: cada corrida queda suspendida hasta que la prueba la resuelve.
4. **Confundir single-flight con progreso.** Una action que no resuelve nunca bloqueaba para siempre a la solicitud pertinente más nueva. El mutex es **por generación viva**, no global, y una corrida superada queda **relevada** (huérfana, sin publicar flags ni resolver waiters).
5. **Escribir sobre un estado sin releerlo dentro de la transacción.** La carta natal podía **empeorar** por una corrida atrasada. La decisión de persistencia es **monotónica** y vive dentro de la mutación.
6. **Anotar como admitido un pedido que la cola rechazó.** La clave se escribe **sólo** si `accepts()` dice que sí, en el mismo instante sincrónico.

### De honestidad de datos

7. **Leer `access.positions` como entitlement.** Vale `snapshot !== null`. Un cálculo pendiente mostraba un **muro de Órbita Plus** a una cuenta que podía estar pagando. El límite de plan se pregunta **por superficie**.
8. **Anunciar éxito sin comprobarlo.** Un proveedor caído —o uno que devuelve una carta igual de incompleta— no es un éxito. El desenlace es discriminado y la pantalla dice qué pasó.
9. **Derivar dos identidades para el mismo objeto.** El ranking y el arco publicaban `arcId` distintos para el mismo tránsito. La identidad **no depende de la procedencia** de la ventana.
10. **Ofrecer un botón que no puede arreglar lo que promete.** "COMPROBAR DE NUEVO" llamaba a `layers.refreshForDate`, que no genera la carta natal. Y `canRetry` no puede derivarse de la fase: sale de la salida real (`recovery`).
11. **Confundir "lista vacía" con "falta calcular".** Lista vacía ⇒ `active_transit_arc`. Ranking sin dato ⇒ no contradice nada, el arco se conserva.
12. **Decir `Necesita tu hora` con la hora exacta ya guardada.** Vista y VoiceOver salen del **mismo hecho**.
13. **Duplicar el método en la UI.** El identificador crudo va **sólo** dentro del `TraceAccordion`.
14. **Derivar el modo de Vínculos de `data?.generalOnly`.** Sin cálculo ese campo no existe. El modo sale del **nivel guardado**.

### De proceso y evidencia

15. **Declarar PASS sin recapturar.** La segunda pasada dijo "12 de 12 PASA" y una auditoría independiente lo desmintió a ojo. Un arreglo de código **no** convierte una captura vieja en evidencia visual.
16. **Confundir un export con una compilación.** `expo export --platform android` empaqueta el bundle JS y **no compila una sola línea nativa**.
17. **Escribir un gate que no puede fallar.** Todo gate necesita **self-test negativo**. El runner de Android salía **0** con Gradle en 0 y sin APK; el de exports miraba **sólo el primer** `.hbc`.
18. **Olvidar que EAS deja de leer `.gitignore` cuando existe `.easignore`.** Sin `.local/`, `dist-ios/` y `dist-android/` en `.easignore`, la evidencia local viajaba dentro del tarball del build.
19. **Asumir que `convex/_generated/api.d.ts` se actualiza solo.** `ApiFromModules` deriva las **funciones** de los módulos que `fullApi` ya lista; un **módulo nuevo** no aparece solo. Sólo el backend corre el codegen, y `_generated/` nunca se edita a mano.
20. **Correr un export web sin las claves públicas y culpar al producto.** El `Could not find Convex client` de un informe anterior era el build sin claves más una caché de Metro que conservaba el valor vacío. Con las `EXPO_PUBLIC_*` cargadas **sólo al entorno del proceso** y `--clear`, las cinco rutas cargan sin un error.
21. **Dejar que tres documentos se contradigan.** Ya pasó: el conteo de pasadas, la cifra de archivos tocados y la afirmación de que VoiceOver se había reverificado. Si tocás un número en un lado, tocalo en los tres.
22. **Tratar `docs/figma-context.md` de este worktree como fuente de V4.9.2.** Describe V4.3/V4.5/V4.6.
23. **Empaquetar el árbol web en el bundle nativo.** Expo Router mete en el grafo **todos** los archivos de `app/`, también las variantes `.web.tsx`. Las implementaciones viven en `src/routes/v492/`.
24. **Cambiar copy sin versionar su caché.** El deploy por sí solo no reemplaza snapshots listos. `ORB-NAT-001` incorpora la versión editorial en su hash y la comparación de Vínculos tiene una versión propia; `ORB-REL-001` conserva v1.
25. **Usar `uno` delante de `planeta`.** El sintagma es `un planeta`; los empates parciales y el total de una sola posición tienen ramas probadas por separado.
26. **Culpar a una persona cuando falló el cálculo.** Un perfil con fecha/hora/lugar y signo todavía no calculado depende de `comparison_ephemeris`. No se muestra `Falta el signo solar` ni `COMPLETAR SUS DATOS`.
27. **Aceptar una captura cosida sin inspeccionarla.** En 09 una costura duplicó `Fricción` aunque el árbol accesible tenía una sola fila. `09-provider-unavailable-v2-full-r2.png` se acepta sólo como degradación histórica; la voz canónica vigente está en `09-vinculos-canonica.png`, con cosido limpio y verificación separada de los 14 contactos expandidos.

---

## 16. Primer prompt para el chat nuevo

Copiá el bloque completo tal cual:

```text
Trabajo en Órbita V4.9.2, la app nativa iOS de capas de tiempo.

Worktree de trabajo: /Users/lucas/Documents/Core/worktrees/orbita/native-v492
Rama: feature/native-v492-implementation, HEAD 52836ad (= origin/main).

Existe además el RC productivo, en OTRO worktree y ya commiteado:
/Users/lucas/Documents/Core/worktrees/orbita/release-1.0.0-build20
rama release/1.0.0-build20, commit b2531a1932fd709494b9b85fa85d067efc2df9cd,
worktree LIMPIO. Órbita 1.0.0 (20) está subido y procesado en TestFlight
interno, y Convex producción exciting-bat-311 está desplegado y verificado.
El build 20 NO se seleccionó para App Review y NO se envió a revisión.

ANTES DE TOCAR NADA, leé SÓLO esto, en este orden:
1. docs/HANDOFF-ORBITA-V492-NUEVO-CHAT.md, sección "## 0. BLOQUE VIGENTE"
   (estado medido del RC, bloqueos en orden y prohibiciones).
2. CURRENT_TASK.md, únicamente la sección inicial
   "## RC productivo Órbita 1.0.0 (21) — estado medido (2026-08-20) · VIGENTE".
3. AGENTS.md y CLAUDE.md (proceso y territorio).

NO cargues de entrada el resto del handoff, ni CURRENT_TASK.md completo, ni
design-qa.md, ni los README de auditoría: todo eso es historia, rotulada como
tal, y se consulta sólo si la tarea concreta lo exige. Cuando lo hagas:
- design-qa.md: leé primero "## Estado vigente (2026-08-19)"; la tabla de los 12
  estados sigue siendo la referencia visual, sus conteos de suite no.
- docs/native-commerce-release-checklist.md: qué falta fuera del código para cobrar.
- WORKFLOW.md: sólo territorio/release. Su setup/auth de Claude es histórico y
  está obsoleto; mandan Core AGENTS.md y el lanzador seguro.

ROLES: Claude Code es el EJECUTOR PRINCIPAL. Codex ORQUESTA, REVISA y VERIFICA.

REGLAS INNEGOCIABLES DE ESTA SESIÓN:
- No commitees, no pushees, no mergees. No toques main ni otra rama.
- No toques el índice: son exactamente 2 entradas heredadas
  (D app/(tabs)/transitos.tsx · R100 app/(tabs)/perfil.tsx → src/screens/PerfilScreen.tsx).
  Preservá además todo el árbol sucio (~381 entradas: 129 tracked + 252 untracked).
- No hagas reset, clean, checkout destructivo ni borres nada de .local/
  (es la evidencia de quince pasadas de recertificación).
- No despliegues NADA (Convex, Vercel, EAS, TestFlight, App Store) ni toques
  dashboards de Apple o RevenueCat sin autorización explícita de Lucas para esa
  acción puntual. Que el deploy de producción y la subida del build 20 ya hayan
  ocurrido NO los deja autorizados de nuevo.
- NO selecciones el build 20 para App Review, NO toques "Add for Review" y NO
  publiques. Son dos aprobaciones SEPARADAS de Lucas, y antes van los gates:
  el License Agreement aceptado por él, la QA física del build 20, los
  screenshots y el screenshot de Review Information de la suscripción.
- El build 19 apunta a Development: es prueba interna y NO se promueve.
- No corras convex dev ni convex codegen: ese comando es del backend (Codex).
  convex/_generated/ se consume read-only y nunca se edita a mano.
- No leas ni imprimas secretos. No hardcodees precios ni product IDs.
- Territorio: convex/** es de Codex; app/**, src/**, assets/**, src/theme/**
  son de Claude. Un objetivo, una rama, un PR.
- Método: TDD. Prueba roja de CONDUCTA que reproduzca el defecto, arreglo
  mínimo, verde. Prohibido debilitar un gate de runtime para poner algo en verde.
- Si invocás Claude Code, es SIEMPRE por
  /Users/lucas/Documents/Core/scripts/claude-opus -p "<instrucción>"
  Nunca el binario claude directo, nunca --bare, nunca auth login ni OAuth.
- Antes de decir "listo": pnpm typecheck verde y la suite verde con 2145 o más.
  Bajar de ahí significa que se borró o debilitó una prueba.
- Si arreglás algo, verificalo en las dos direcciones: revertí el arreglo,
  comprobá que su prueba focal FALLA, restaurá byte por byte y comprobá que PASA.
- Reportá honesto: si no pudiste ejecutar algo, decilo; no inventes conteos.

Primero decime, en español y corto: qué entendiste del estado actual, qué
documentos leíste, qué mostró git status, y cuál proponés como próximo paso.
Después esperá mi confirmación antes de modificar un solo archivo.
```

## Veredicto comercial de la pasada 18 (2026-08-18) · HISTÓRICO

> **HISTÓRICO — SUPERADO.** Sus cifras (`pnpm test` 1842/1842 en 155 suites,
> focales 429/429) quedaron superadas por **2231/2231 · 218 suites** (medición
> del RC20; el árbol local post-RC mide **2236/2236**). Su
> conclusión de fondo también: los tres faltantes que enumera —configuración
> externa, build nativo nuevo, dispositivo real/Sandbox/TestFlight— **están
> hechos**. El comercio se configuró entero, la compra Sandbox se completó en
> iPhone físico y el build 1.0.0 (20) está procesado en TestFlight interno. Lo
> único que sigue abierto de esa lista es **App Review**, que no se inició. El
> estado vigente está en el bloque 0.

**Repositorio validado; comercio NO certificado.**

Verde en el repo (cifras de esa pasada): `pnpm typecheck` exit 0, focales
429/429, `pnpm test` 1842/1842 en 155 suites, gate de conteo exit 0, export web
dentro de límites y bundle web sin el SDK ni ningún secreto de RevenueCat.

Eso **no** certifica el comercio. Falta, y nada de esto se puede cerrar desde el
repositorio:

1. configuración externa (App Store Connect, RevenueCat, webhook, secretos);
2. un build nativo NUEVO — los módulos de RevenueCat no existen en el binario
   actual y ninguna actualización OTA los agrega;
3. verificación en dispositivo real → Sandbox → TestFlight → App Review.

**Android queda fuera del alcance de esta corrida y sin verificar** hasta que
exista catálogo en Google Play; además `android.package`
(`com.horoscopo.orbita`) no coincide con el bundle iOS
(`com.lucasssram.orbita`).

Detalle completo en `docs/native-commerce-release-checklist.md` y
`CURRENT_TASK.md`.
