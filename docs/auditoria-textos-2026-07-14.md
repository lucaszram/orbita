# Auditoría de textos — maneras y sentido · 2026-07-14

Pedido de Lucas: "empezar a mejorar las maneras y el sentido de los textos". Auditoría de TODO
lo que la app le dice al usuario — copy fijo (`app/**`, `src/**`) y texto generado (prompts) —
contra la voz canónica de `docs/voz-copy-orbita.md`. **Solo diagnóstico: acá no se cambió código
ni prompts.** Lucas decide qué tanda se aplica.

Método: barrido completo del copy nativo con citas file:línea + extracción de los prompts
productivo (`orbita-daily-guide-v2`, `convex/daily.ts`) y lab
(`orbita-lab-daily-home-llm-v5-human-benchmark`, worktree backend) + verificación en vivo en
simulador (guest Pro Max + cuenta real en Orbita-Claude).

---

## Veredicto ejecutivo

Hay TRES problemas distintos, con dueños y riesgos distintos:

**1 · El prompt productivo contradice la voz canónica — y es lo que ve todo usuario logueado.**
`convex/daily.ts` sigue ordenando exactamente lo que la redefinición del 13/07 prohibió:
"la incomodidad es el producto", "la última frase es la que tiene que doler", "nunca consolás",
preguntas como "incisiones", y el movimiento central es **asumir el autoengaño del lector**
("agarrar la excusa que la persona se dice y traducirla"). La guía dice: no inferir motivos
ocultos, matiz honesto, agencia. Evidencia en producción, hoy, cuenta real de Lucas:

> "Venus en Virgo sobre tu zona de redes y futuro **te obliga a notar cuánto corregís lo que
> decís para seguir cayendo bien**."

Eso infiere un motivo (vanidad social) que el dato no contiene. El v5 del lab ya corrige la
actitud (editora sobria, "precisa sin crueldad, íntima sin inventar motivos"), pero **solo cubre
el hero**: no tiene tesis, ni carta de tarot, ni las 4 áreas, ni lectura larga. No se puede
"enchufar" tal cual: hay que extenderlo al schema completo de `orbita-daily-guide-v2`.

Lo que el prompt v2 SÍ tiene bien y hay que conservar: el manejo honesto del tarot
(yuxtaposición, "la deshonesta es fingir que había un plan"), el anti-hedge, el anclaje al dato,
el límite anti-crueldad, los guardrails duros y la tesis que ordena los módulos.

**2 · El copy fijo tiene bolsones de coaching/new-age — concentrados, no repartidos.**
El grueso del copy funcional (onboarding de datos, Diario, Tránsitos, Carta, errores, legal) está
bien: honesto, voseado, concreto. Las violaciones graves se concentran en 6 lugares:

| Dónde | Qué | Gravedad |
|---|---|---|
| `AlignScreen.tsx:18` | "Alineate con el ritmo del universo" — DOS frases prohibidas juntas | Alta (2ª pantalla que ve todo usuario nuevo) |
| `BeforeAfterScreen.tsx` entera | Columnas "Vivía en automático → Con calma y confianza": diagnóstico de heridas + promesa de transformación + género asumido ("agotada"/"Centrada") | Alta |
| `CartaDelDia.tsx:192` | Label "POR QUÉ ESTA CARTA" — la guía lo reemplaza explícitamente por "EL CRUCE DE HOY" (la carta salió al azar; ese label finge causa) | Alta y barata |
| `DailyGuidanceScreen.tsx:30-31` | Demo "Tu energía se mueve suave" + "Una acción pequeña ordena el día" — es literalmente la columna "Antes" de la tabla Before/After de la guía de voz | Media |
| `SintoniaSection.tsx` (mock visible a todos) | "Misma intensidad, mismo fondo. Se reconocen." — veredictos deterministas de compatibilidad sin dato | Media |
| `VoidExperience.tsx:26` (mock) | "Lo que apurás no es la respuesta: es el alivio." — fórmula "No es X. Es Y." + motivo adivinado | Media |

Menores pero reales: "Desbloquea" (tuteo) en el paywall, "Bienvenido de nuevo." y "Conectada con
Apple" con género fijo (choca con la pantalla de identidad), eyebrow "GUARDADAS" hardcodeado en
el EmptyState que también usa la Carta, y "¿Qué necesito soltar?" entre los prompts sugeridos
del Umbral.

**3 · Los bancos editoriales son horóscopo genérico — fallan el control de calidad #1.**
`signHomeBank.ts` (36 variantes, lo que ve el INVITADO en la Home) y las entradas flaggeadas de
`catalog.ts` (fallback del engine local) no se pueden rastrear a ningún dato del cielo: son
horóscopo por signo solar. Hoy en el sim guest: "Brillá sin pedir permiso.", "Menos frentes, más
precisión." (fórmula "Menos X, más Y", prohibida textualmente). Acá el problema es el **sentido**,
no solo las maneras: la promesa de Órbita es dato real → traducción → agencia, y estos textos no
tienen dato. Mientras el invitado no tenga carta, el banco no puede citar tránsitos personales —
pero sí puede citar el cielo del día (que es igual para todos) o bajar la pretensión y ser
honesto sobre qué es.

---

## Antes / después

| Antes (hoy en la app) | Después (voz canónica) |
|---|---|
| "Alineate con el ritmo del universo" | "El cielo de hoy, leído sobre tu carta." |
| "Tu energía se mueve suave" + "Una acción pequeña ordena el día." (demo onboarding) | "Mercurio toca tu Luna." + "La respuesta rápida va a sonar más segura de lo que está." |
| "Antes: Vivía en automático → Después: Con calma y confianza" | Sin promesa de transformación: "Qué hace Órbita: un dato real del cielo, una escena donde verlo, una elección que queda de tu lado." |
| "POR QUÉ ESTA CARTA" | "EL CRUCE DE HOY" |
| "Lo que apurás no es la respuesta: es el alivio." (Umbral mock) | "La urgencia es real; la certeza, no. Escribí la decisión y dejala dormir hasta mañana." |
| "Fluye con tu Luna — te entienden sin que tengas que explicar." | "Elemento de agua, como tu Luna: hoy cuesta menos hablar de lo que pesa." |
| "Tu paz no se negocia." (signHomeBank) | "Un no a tiempo te ahorra tres explicaciones. Elegí dónde lo decís hoy." |
| "te obliga a notar cuánto corregís lo que decís para seguir cayendo bien" (LLM v2, producción) | "Venus en Virgo pasa por tu casa 11: hoy se nota el borrador detrás de cada mensaje. Mandá uno sin corregir y mirá qué vuelve." |
| "Menos frentes, más precisión." | "Un solo frente hoy. Elegilo antes del mediodía." |
| "Desbloquea tu carta natal completa" | "Desbloqueá tu carta natal completa" |

## Qué NO tocar (ya está en voz)

El ritual de la carta ("TU CARTA DE HOY", "TOCÁ PARA SACARLA", "Te salió X."), los estados del
Diario ("Ese día no abriste la app. Esa carta ya no se saca."), el copy de datos del onboarding
(fecha/lugar/hora, privacidad), "Órbita ordena señales, no dicta destino.", el legal del paywall,
los errores con reintento, y del prompt v2: tarot por yuxtaposición, anclaje, anti-hedge,
límite anti-crueldad, guardrails duros.

---

## Plan propuesto (3 tandas, cada una con gate de Lucas)

**Tanda 1 — Copy fijo quirúrgico (Claude, `app/**`+`src/**`, bajo riesgo, ~1 sesión).**
Los 6 bolsones + menores: EL CRUCE DE HOY, AlignScreen, BeforeAfter reescrita, demo del
onboarding, mocks de Umbral y Sintonía, voseo del paywall, género neutro donde está asumido,
eyebrow del EmptyState. Sin tocar pantallas aprobadas más allá del string (evolución quirúrgica,
gate visual después).

**Tanda 2 — Bancos editoriales (Claude, editorial, ~1 sesión aparte).**
Reescritura de las 36 variantes de `signHomeBank` y las entradas flaggeadas de `catalog.ts` bajo
la voz canónica, con la restricción honesta de que el guest no tiene carta (anclar al cielo del
día o bajar pretensión). Entregable: tabla vieja→nueva para aprobar antes de commitear.

**Tanda 3 — Prompt productivo v3 (backend/Codex, gate fuerte).**
Fusionar: estructura y schema completo de v2 (tesis + carta + guía + 4 áreas + lectura larga +
cierre) + actitud de v5 (editora sobria, sin autoengaño asumido, matiz de certeza, pregunta que
abre en vez de incidir) + lo conservable de v2 (tarot honesto, anti-hedge, anclaje, límites).
Versionar como `orbita-daily-guide-v3` con bump de caches, y gate acordado: A/B sobre 3 días
reales aprobado por Lucas antes de pisar producción. El benchmark de Miss Astrológica
(`docs/benchmark-voz-miss-astrologica.md`) ya define qué es transferible.

**Cobertura pendiente de esta auditoría** (no bloquea las tandas): pantallas de lectura
secundarias (`app/reading/*` salvo diario), mocks demo (`chartMock`, `personalityMock`,
`transitMock`, `valuesMock`), `readingEngine`/`homeAdapter` (headlines del engine local) y rutas
legacy posiblemente muertas (`app/home.tsx`, `app/diario.tsx`, `app/carta.tsx`). Se barren en la
Tanda 1 ó 2 según superficie.
