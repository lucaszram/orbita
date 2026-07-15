# Plan — Primera experiencia y hábito (modelo Hook)

Fecha: 2026-07-14. Origen: sesión de diagnóstico Lucas + Claude sobre el loop de hábito
(trigger → acción → recompensa variable → inversión), cruzando el código real con flujos
de Co-Star y Moonly (Mobbin).

**Diagnóstico corto:** la acción y la recompensa ya están bien resueltas (ritual del velo,
carta única diaria, guía LLM, Umbral con cupo). Las patas flojas son el **trigger** (un solo
push genérico a las 09:00, agendado en silencio, sin que el usuario lo pida ni elija hora)
y la **inversión** (el Umbral no guarda historial, el onboarding fija por código decisiones
que el usuario podría tomar, el guest no acumula nada y la cuenta se pide antes de que
exista algo que perder).

**Orden acordado: B → A → C → D.** B es puro frontend/copy y define el lenguaje del ritual
que A y C refuerzan.

---

## Bloque B — Primer día: la doble entrega (EN CURSO)

**Reencuadre (Lucas, 2026-07-14):** el día 1 post-onboarding tiene DOS entregas, en orden.
**(1) La carta natal**: recibirla de verdad — qué es, qué significa, que es tuya para
siempre. Es el activo por el que muchos van a pagar; hoy su "recepción" es un banner
descartable (`CartaBanner`: "YA TENÉS TU CARTA NATAL / Miralá entera →") y el tab Carta
no explica qué es una carta natal a un recién llegado. **(2) El mazo**: el ritual diario
que te mete en el loop. El orden importa: primero el activo (justifica el pago), después
el hábito — y el B1 ("se cruza con tu carta natal") recién tiene sentido si la carta
natal ya te fue entregada.

**Objetivo:** que al final del día 1 el usuario sepa: qué es su carta natal y qué
significa; que el mazo se lee sobre ella; que esto se hace una vez por día; que la tira
acumula; que mañana hay otra. Sin tutorial — el lenguaje ya existe en la app ("abrir el
día", "una carta por día"); se completa el círculo.

**Principio de voz:** registro aprobado (editora sobria, dato → traducción → agencia).
Sin gamificación ruidosa: nada de contadores de racha ni culpa; la pérdida se muestra,
no se sermonea (el hueco boca abajo ya es el mensaje).

### Piezas de copy (PROPUESTA v2 — gate de Lucas antes de Figma)

Ajuste pedido por Lucas (2026-07-14): B1 no puede ser solo cadencia ("una por día") —
tiene que explicar el **sentido** de la carta, si no parece tarot diario genérico,
"tirando por tirar". La explicación ya existe como modelo editorial
(`docs/carta-dia-modelo-editorial.md`: carta al azar = lente simbólica; cielo
personalizado = tensión verificable; el cruce es la lectura) y como ontología por carta
(`queEs`/`hoy` en `tarotDeck.ts`, beats "QUÉ ES" / "CÓMO INFLUYE HOY"). B1 dice ese
modelo UNA vez, en el momento de máxima atención: el primer reveal. Los beats por carta
siguen explicando cada carta individual; B1 explica el sistema.

**B0 · Antes del primer reveal** — variante día 1 del sub bajo "TOCÁ PARA SACARLA"
(hoy fijo: "Una carta por día · se saca una sola vez"). Siembra el sentido antes del
primer tap:

> TOCÁ PARA SACARLA
> Una carta al azar, leída sobre tu cielo real.

**B1 · Cierre del primer reveal** — bloque inline que aparece una única vez en la vida,
después del flip y la cascada de beats del primer día (debajo de los beats de la carta,
antes de SignalTop).

Iteración con Lucas (2026-07-14): la v2 ("La carta no predice: enfoca") era una defensa
del mecanismo, abstracta — no explicaba nada. Lo que va acá es la **promesa de lectura**:
te salió una carta → esto es lo que hacemos con eso, todos los días. Son los mismos tres
elementos de la ontología de beats ("qué es / qué significa que te haya salido / cómo se
cruza con tu cielo"), dichos como método al usuario justo después de haberlos leído por
primera vez:

> EL RITUAL
> **Qué significa que te haya salido esta carta.**
> Cada día sale una para vos, y la leemos en tres pasos: qué es la carta, qué te muestra
> que te haya salido justo hoy, y cómo se cruza con tu carta natal y el cielo del día.
> Una por día. Queda en tu tira; la de mañana se abre a medianoche.

**✅ B1 v3 APROBADO por Lucas (2026-07-14: "esto está mucho más guiado").**

**Idea DIFERIDA (Lucas 2026-07-14: "dejando todo eso para las próximas"): los primeros
días enseñan.** Los primeros 3 reveals extienden levemente un beat cada uno, en
secuencia: día 1 el mazo/los arcanos, día 2 el rol de TU carta natal en la lectura,
día 3 los tránsitos del día. Mini-curso tejido adentro del ritual (equivalente sobrio
del "3-Day Intro Course" de Moonly, sin card aparte ni progreso gamificado). Cuando se
retome: el copy de días 2-3 para logueados entra en la Tanda 3 del prompt (Codex).

**B5 · Recepción de la carta natal (día 1) — PROPUESTA, gate de Lucas.** La primera
entrega del día 1, ANTES del mazo en el orden de la Home. Dos piezas:

*B5a — El banner del día 1 deja de ser un aviso y pasa a ser la entrega.* Mismo lugar
(arriba de la tira), más peso visual (frame a diseñar en Figma), sin × de descarte el
primer día (se descarta solo al entrar o al día siguiente):

> TU CARTA NATAL
> **Ya es tuya.**
> El mapa del cielo en el momento y lugar exactos en que naciste. No cambia nunca — y
> todo lo que Órbita te lea, incluida la carta de cada día, se lee sobre ella.
> VER MI CARTA →

*B5b — Explainer de primera visita en el tab Carta* (bloque una-sola-vez arriba de la
tríada; hoy el tab tira datos sin decir qué es una carta natal).

v1 rechazada por Lucas (definición técnica: "una foto del cielo del {fecha}…" — no dice
qué significa para vos). v2 retoma la narrativa del onboarding aprobada en la Tanda 1
("Tu signo solo no alcanza"): el signo es una pieza, la carta es el resto, y su
significado es el mapa de cómo funcionás:

> QUÉ ES
> Tu signo es una sola pieza: el Sol. La carta es el resto — Luna, ascendente, diez
> planetas y doce casas, donde estaban en el momento y lugar exactos en que naciste.
> Es el mapa de cómo funcionás. Todo lo que Órbita te lea, se lee acá.

(Con hora desconocida, variante honesta: "calculada sin hora exacta — el ascendente y
las casas son aproximados".)

**❌ B5a RECHAZADA por Lucas (2026-07-14, sobre los frames):** el banner se lee como
popup/notificación descartable, UX floja, y el copy "Ya es tuya" queda mal en pantalla.
No volver al patrón banner para la recepción. Benchmark Mobbin: las referencias entregan
la carta natal como momento full-screen propio (Snapchat: una pieza por vez con jerarquía
enorme; Co-Star: aterrizás EN la carta), nunca como aviso dentro de la Home.
**B5a v2 — CEREMONIA FULL-SCREEN (dirección elegida por Lucas 2026-07-14):** una pantalla
inmersiva única, una sola vez, al caer a la app post-onboarding y ANTES de la Home. La
Home queda limpia (sin banner; el `CartaBanner` actual se retira el día 1 en favor de
esto). Composición (frame `679:2`, clon de Carta/Overview): rueda natal full-bleed +
tríada + eyebrow "TU CARTA NATAL" + headline = EL DATO ("El cielo del {fecha}, {hora},
{lugar}.") + body "De ese momento salen tu Sol, tu Luna y tu ascendente. No cambia
nunca: todo lo que Órbita te lea se lee sobre esta carta." + CTA "ENTRAR A MI CARTA" +
secundaria "VER DESPUÉS". **Ceremonia 1 APROBADA por Lucas (2026-07-14).**

**Ceremonia 2 DESCARTADA (Lucas 2026-07-14: se sentía repetida con la 1).** El tarot se
explica EN la Home, no en otra full-screen. Reemplaza a B0. Flujo día 1 final:
`ceremonia (carta natal)` → "ENTRAR A MI CARTA" abre el tab Carta (con el QUÉ ES) /
"VER DESPUÉS" → `Home día 1` con **bloque intro "TU TAROT DIARIO"** (solo primera vez,
entre la tira y la carta velada; nodos `684:8`/`684:9`):

Copy v1 rechazado por Lucas ("22 arcanos" no — el mazo no son solo los mayores; "al
azar, una sola vez" = sobre-explicar; "las que saques van armando tu tira" = frase
vacía). Pedido: investigar para qué sirve el tarot y traer eso al texto. Investigación
(2026-07-14): el tarot serio se define como espejo, no bola de cristal — herramienta
proyectiva (las imágenes dan forma a lo que ya traés), cada carta un arquetipo (Jung /
Sallie Nichols), y la práctica de una carta diaria sirve para interrumpir la historia
por defecto y mirar el día con una pregunta mejor. Copy v2 (nodos `684:8`/`684:9`):

Copy v2 también rechazado (abría con negación defensiva "no adivina" + cierre abstracto
"una pregunta mejor" — mismo vicio que el B1 v2 rechazado; regla aprendida: **nunca
abrir negando ni defendiendo el mecanismo; afirmativo, concreto, guiado**). Copy v3
✅ APROBADO por Lucas (2026-07-14, elegido entre 3 opciones):

> TU TAROT DIARIO — "Tu carta de hoy ya está en el mazo. Sacala y Órbita te la explica:
> qué es, qué significa que te haya salido, y cómo se cruza con tu carta natal y el
> cielo del día."

La explicación queda pegada a la acción (la carta está ahí para tocar) y el reveal hace
el resto (los beats ya explican la carta puntual). Día 2+ el bloque desaparece (B3 toma
la posta). El sub B0 se eliminó (redundante con la intro). Copy v2 pendiente de gate.
**⚠️ Dato de producto a resolver:** Lucas dijo que el mazo "son todos", pero el sorteo
del backend hoy es SOLO sobre los 22 mayores (`convex/lib/tarot.ts`) y la ontología
`queEs`/`hoy` cubre 22. Si el mazo pasa a 78, es tarea backend + editorial (Codex +
ontología de menores) — decidir antes de codear el copy que lo mencione.
**✅ B5b v2 (QUÉ ES en tab Carta) APROBADA (2026-07-14).**

**→ COPY DEL BLOQUE B COMPLETO Y APROBADO (B0, B1 v3, B2, B3, B4, B5a, B5b v2).
Siguiente paso: frames en Figma (gate visual) y recién después código.**

**B2 · Explicación de la tira** — caption bajo `DiarioStrip`, visible hasta que el usuario
tenga 3 cartas acumuladas (después desaparece sola):

> Cada día deja su carta. Los que no abras quedan boca abajo.

**B3 · Reconocimiento del regreso** — variantes del eyebrow de la carta boca abajo
(hoy es fijo "TOCÁ PARA SACARLA / Una carta por día · se saca una sola vez"):

- Día 1 (sin cartas previas): actual, sin cambios.
- Día 2 (una carta en la tira): "HAY UNA CARTA NUEVA / La segunda de tu tira."
- Día 3+: "HAY UNA CARTA NUEVA / Tocá para abrir el día."
- Volvió con hueco (ayer quedó boca abajo): "HAY UNA CARTA NUEVA / Las de ayer no se
  recuperan. La de hoy sí."

**B4 · Hito de primera semana** — nota bajo la tira, solo el día que se completa la
séptima carta (no necesariamente consecutivas: 7 cartas acumuladas):

> Siete cartas. La primera vuelta completa de tu tira.

### Estructura / mecánica

- Flags locales de primera vez (`firstRevealClosed`, sin backend): viven en el perfil
  local (`src/hooks/useAppState.tsx` + `src/domain/types.ts`) → funcionan también guest.
- Los contadores de días NO son un streak nuevo: se derivan de lo que ya devuelve
  `daily.getStrip` (cartas reveladas). Guest no puede contar más allá de hoy
  (`guestRitual` es memoria de sesión) → guest siempre ve la variante día 1/genérica.
  Ese límite es deliberado: alimenta la conversión a cuenta del Bloque C.
- Estados completos: mientras `strip` carga no se muestra ningún explainer (regla
  anti-placeholder-que-se-pisa); error → igual que hoy.

### Pasos

1. **Gate copy** (Lucas): ✅ COMPLETO 2026-07-14 — B0, B1 v3, B2, B3, B4, B5a, B5b v2.
2. **Figma**: ✅ HECHO 2026-07-14 — sección **"13 · Primer día · doble entrega (Claude)"**
   (`668:2`) en la página App Core (ojo: la página perdió su nombre, hoy se llama " "),
   todo clonado de la sección 12 y de "Carta / Overview" (`254:2`), nada de cero.
   Cinco frames: `668:4` día 1 velada (banner B5a + B0), `668:139` día 1 primer reveal
   (banner + bloque EL RITUAL/B1 después de los beats + "POR QUÉ ESTA CARTA"→"EL CRUCE
   DE HOY"), `668:263` día 2 (caption B2 + eyebrow B3, sin banner), `668:398` hito 7
   cartas (nota B4 en cobre, frame recortado como detalle), `668:522` tab Carta primera
   visita (bloque QUÉ ES/B5b). Anotaciones de estado arriba de cada frame.
   **Gate visual de Lucas PENDIENTE.**
3. **Código**: ✅ HECHO 2026-07-14 (sin commitear) — `app/recepcion.tsx` (ceremonia),
   `OnboardingFlow.submit()` → `/recepcion` (tríada por params), Home (intro tarot +
   EL RITUAL + B2/B3/B4 + strip a ventana de 7 días + CartaBanner retirado),
   `CartaDelDia` (`ctaLabel`/`ctaSub`), tab Carta (QUÉ ES primera visita),
   `src/services/firstRun.ts` (flags de dispositivo: `recepcionVista`,
   `ritualExplicado`, `cartaQueEsVisto`; se limpian en `resetApp`).
   `pnpm typecheck` OK + tests 59/59.
4. **PENDIENTE: pasada visual en simulador** (install fresco → onboarding → ceremonia
   → Home día 1 → primer reveal → día 2 simulado; y recorrido guest). Después:
   borrar `CartaBanner.tsx` (quedó sin usos).

---

## Bloque A — Trigger: el recordatorio elegido

**Objetivo:** convertir el push de "cosa que pasa en silencio" a "compromiso que el usuario
eligió". Patrón de referencia (Moonly / one year): pedir la **hora** con picker propio antes
del permiso de iOS.

- Pantalla nueva de onboarding entre Antes/Después (12) y Cuenta (13): "Tu carta se renueva
  cada día. ¿A qué hora querés que te avise?" + picker (default 09:00) → recién ahí el
  prompt de permiso de iOS. Si lo niega, la app no insiste (se ofrece en Perfil).
- Reescribir el texto del push (hoy: "Tu lectura diaria te espera"): misterio sin spoiler,
  p. ej. "Hay una carta nueva esperándote." Variantes rotativas simples (local, sin server).
- Fuera de alcance acá: push server-side segmentado, re-engagement por inactividad, email.
  Se anotan como fase 2 (requieren backend/Codex).
- Pasos: copy exacto → frame en Figma (mismo kit del onboarding V4.4) → código
  (`OnboardingFlow` + `notifications.ts`) → gate visual.

## Bloque C — Inversión: lo que duele perder

1. **Historial del Umbral** (`voidHistory`): hoy cada respuesta es efímera. Necesita
   contrato backend → stub en `convex/schema.ts` + nota en `convex/CHANGELOG.md` para
   Codex (tabla pregunta/respuesta/fecha + query por usuario). Front: sección "Tus
   preguntas" dentro del Umbral, mock tipado mientras tanto.
2. **Feedback "¿Te sirvió?"** (patrón Co-Star "WAS THIS USEFUL?") al pie de la lectura
   diaria: 👍/👎. También contrato backend (campo en `dailyGuides` o tabla aparte);
   además alimenta la mejora del prompt (Tanda 3 de textos).
3. **Conversión guest → cuenta en el momento correcto**: hoy la cuenta se pide en el
   step 13, antes de que exista inversión. Sumar el pitch cuando hay algo que perder:
   guest con carta revelada ve, bajo la tira, "Tu carta de hoy no se guarda en ningún
   lado. Creá tu cuenta para que la tira sea tuya." (copy a validar). No se toca el
   onboarding: es un momento de la Home.

## Bloque D — Cierre / limpieza pre-launch

- **Share funcional** de la carta del día: cablear `Share.share()` al esqueleto existente
  (`ShareCardPreview`, `createDailyShareCard`).
- **Bug splash post-logout / primer arranque** (documentado en CURRENT_TASK 2026-07-14):
  las puertas de 01B no aparecen; deep link lo destraba. Es literalmente un usuario nuevo
  que no puede entrar → prioridad dentro de D.
- **Próximamente visibles** (Vínculo, Calendario): decidir si se ocultan hasta el launch.

---

## Dependencias y gates

| Bloque | Territorio | Necesita a Codex | Gate |
|--------|-----------|------------------|------|
| B | frontend + Figma | No | Copy (ya) → visual Figma → visual app |
| A | frontend + Figma | No (fase 2 sí) | Copy → visual Figma → visual app |
| C | frontend + contrato | Sí (voidHistory, feedback) | Contrato en CHANGELOG + copy |
| D | frontend | No | Por ítem |
