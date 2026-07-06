# Órbita — Guía de voz para el copy diario (editorial LLM)

Para iterar los prompts del backend (`dailyLlmReadings` / editorial diario). El copy hoy es **real pero P0**: correcto en contenido, pero **impersonal, sin tildes y neutro**. Objetivo: **personal, LATAM rioplatense, dirigido a vos**.

---

## La voz de Órbita (principios)

1. **Hablale a la persona, no del tema.** No describas el cielo en abstracto; decile qué le toca HOY a ella.
   - ❌ "El deseo pide claridad antes que intensidad." *(afirmación abstracta)*
   - ✅ "Hoy tu deseo busca claridad antes que intensidad."
2. **Segunda persona, rioplatense.** `vos`, `tenés`, `querés`, `sentís`, `podés`. Nada de "tú/tienes/quieres".
3. **Cálido y directo, sin bajar línea.** Contexto para elegir, no una orden ni un diagnóstico.
4. **Tildes y ortografía correctas SIEMPRE.** Hoy salen sin acentos ("dia", "mas", "queres", "Que", "simbolico") → tiene que ser "día", "más", "querés", "¿Qué", "simbólico". Signos de apertura `¿` `¡`.
5. **Guardrails de marca (duro):** sin destino/salud/dinero/legal. Framing entretenimiento + autoconocimiento. Preguntas abiertas, nunca sí/no.

---

## Reglas duras (checklist para el prompt)

- [ ] Todo en **segunda persona vos** dirigido al usuario ("tu deseo", "hoy te toca", "¿qué estás…?").
- [ ] **Tildes correctas** + `¿…?` `¡…!` de apertura.
- [ ] Las **preguntas** empiezan con `¿` y son personales: "¿Qué estás queriendo cuidar sin sobreactuar?".
- [ ] Nada de imperativos duros tipo horóscopo ("hacé esto", "evitá aquello") salvo en los módulos Hacé/Evitá, y ahí en tono sugerencia.
- [ ] Español **neutro-rioplatense** (LATAM), no España.
- [ ] Sin claims de destino/plata/salud/legal.

---

## Before → After (de la salida real de hoy)

**Tema Amor**
- ❌ "El deseo pide claridad antes que intensidad. / Que queres cuidar sin sobreactuar?"
- ✅ "Hoy tu deseo busca claridad antes que intensidad. / ¿Qué estás queriendo cuidar sin sobreactuar?"

**Tema Trabajo**
- ❌ "Una prioridad bien elegida ordena el dia. / Que tarea vuelve mas liviano el resto del dia?"
- ✅ "Si elegís bien una prioridad, se te ordena el día. / ¿Qué tarea te aliviana el resto del día?"

**Tránsito destacado**
- ❌ "Venus activa tu Luna. Tomalo como contexto simbolico para elegir mejor el ritmo del dia, no como una orden."
- ✅ "Venus te activa la Luna. Tomalo como contexto simbólico para elegir mejor el ritmo de tu día, no como una orden."

**Guía diaria (Hacé/Evitá)** — ya están en imperativo vos, mantener, solo tildes:
- ❌ "Separar lo que sentis de lo que ya sabes." → ✅ "Separá lo que sentís de lo que ya sabés."
- ❌ "Forzar una definicion cuando todavia falta contexto." → ✅ "Forzar una definición cuando todavía falta contexto."

**Pregunta del día**
- ❌ "Que estas queriendo resolver demasiado rapido?"
- ✅ "¿Qué estás queriendo resolver demasiado rápido?"

**Saludo / headline**
- ❌ greeting: "Tu guia diaria" *(genérico)* → ✅ el front ya lo reemplaza por "Buenas, {nombre}." — el backend puede dejar el greeting o mandar uno personal.

---

## Para Codex (aplicar en los prompts del backend)

> **Iterar la voz del editorial diario** (`dailyLlmReadings` / prompts en `convex/`):
> 1. **Segunda persona vos** (rioplatense) dirigida al usuario en TODOS los textos: headline, subheadline, temas (oneLine + pregunta), tránsito, long-read, pregunta del día.
> 2. **Tildes y `¿?` `¡!` obligatorios** — hoy la salida viene sin acentos, es lo más urgente.
> 3. Preguntas personales que empiecen con "¿Qué estás…/¿Qué te…".
> 4. Mantener guardrails (sin destino/salud/dinero/legal; entretenimiento + autoconocimiento).
> 5. Ver `docs/voz-copy-orbita.md` (este archivo) para principios + before/after.
>
> El `modelGaps: ["editorial_review_required_before_app_release"]` que ya marca el backend es exactamente esto: la pasada de voz.

## Loop de iteración
1. Codex actualiza prompts con esta voz → regenera un día.
2. Yo/vos revisamos la salida real en `/home`, `/valores`, `/personalidad`, `/transito`.
3. Marcamos qué chirría → refinamos el prompt → repetimos.

Esta guía es la **iteración 1**. Se va afinando con cada review.

---

## Iteración 2 — pendiente (para Codex)

**Bug de contenido:** en la Home, `modules.energy` ("Energía del día") sale **idéntico a `header.subheadline`** — ambos muestran el tema de la casa (ej. "Casa 8: profundidad, confianza y cambio"). Se ve repetido.

**Fix:** que `modules.energy` sea un **read propio de energía del día** (nivel/carácter energético), distinto del subtítulo. Ejemplos de tono objetivo:
- "Media, más para sostener que para arrancar."
- "En subida: rinde el foco largo, no los sprints."
- "Baja y densa: mejor cerrar que abrir."

Debe seguir la voz vos/LATAM de arriba. El subtítulo puede quedarse con el tema de la casa; la energía es otra cosa.
