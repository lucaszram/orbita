# Home Personalizada - Contenidos Y Backend

Fecha: 2026-07-04

## Alcance

Este documento reemplaza el analisis amplio de pantallas para esta decision concreta:

**que textos/contenidos tiene que devolver el backend para la Home personalizada de Orbita.**

No analiza UI, estilo visual ni estructura de pantallas. La pregunta aca es:

- que recibia el usuario en Co-Star,
- que recibia el usuario en Moonly,
- que queremos dar en Orbita,
- de que dato astrologico sale,
- que biblioteca editorial hay que escribir,
- que se prueba primero en backoffice.

## Fuentes De Referencia

- Mobbin Co-Star flows: https://mobbin.com/apps/co-star-ios-9a62804f-6b1b-4423-8b2d-5ad8508a8b52/579236af-9315-44d2-88b6-326ccdb4a6bc/flows
- Mobbin Moonly flows: https://mobbin.com/apps/moonly-ios-6e065143-033e-42d4-97a0-dfbcb795e32e/9b979db9-170f-40cc-ac80-627c18acbf39/flows
- Co-Star referencia publica: https://www.vogue.com/article/whats-co-star-astrology-app-technology-spirituality
- Co-Star alertas/realtime: https://www.teenvogue.com/story/astrology-app-co-star-bizarre-alerts
- API y calculo Orbita: `docs/api-astrologica-orbita.md`
- Plan anterior de textos: `docs/textos-analisis-personalizacion.md`

Nota importante: no copiamos texto de Co-Star ni Moonly. Usamos sus tipos de contenido como referencia de producto.

## Idea Central

La Home no deberia ser "un horoscopo generico de Escorpio".

La Home tiene que ser un objeto diario personalizado:

```ts
DailyHomeReading = {
  userId,
  localDate,
  timezone,
  natalBase,
  highlightedTransit,
  dailyTextModules,
  topicReadings,
  questionModules,
  lunarModules,
  reviewStatus,
  modelGaps
}
```

La personalizacion sale de combinar:

1. Carta natal del usuario.
2. Fecha local del dia.
3. Transitos del dia contra su carta.
4. Reglas editoriales de Orbita.
5. Biblioteca de textos propia.
6. Guardrails de seguridad.

## Como Hacer Una Frase Del Dia Personalizada

Flujo optimo:

1. El usuario carga fecha, hora, lugar y timezone.
2. El backend calcula carta natal real:
   - Sol,
   - Luna,
   - Ascendente,
   - planetas personales,
   - casas,
   - aspectos.
3. Cada dia, el backend calcula transitos para la fecha local.
4. El backend elige 1 transito destacado y 1 a 3 secundarios.
5. El selector traduce ese transito a tema:
   - planeta en transito = tipo de energia,
   - punto natal tocado = parte del usuario activada,
   - aspecto = tono del dia,
   - casa = area de vida,
   - signo = textura/modo.
6. El motor editorial arma los textos:
   - frase principal,
   - amor/vinculos,
   - trabajo/creatividad,
   - familia/casa,
   - energia interna,
   - hace,
   - evita,
   - accion,
   - pregunta del dia.
7. El backoffice muestra el output y alguien lo aprueba antes de exponerlo en la app.

Ejemplo de regla:

```text
Si transito destacado = Venus cuadratura Marte natal en casa 7
Tema principal = vinculos / deseo / friccion
Tono = tension constructiva
Headline = frase breve sobre no confundir impulso con claridad
Hace = bajar una conversacion a algo concreto
Evita = forzar una definicion por ansiedad
Pregunta = que parte de este deseo pide escucha antes de accion?
```

No es texto suelto al azar. Es una combinacion entre datos astrologicos y una biblioteca escrita por Orbita.

## Lista 1 - Contenidos Tipo Co-Star Que Nos Interesan

### 1. Frase principal del dia

Que hacia:

- Una frase breve para el dia.
- Tono directo.
- Se siente personal.
- Puede funcionar como push notification o headline de Home.

Que queremos en Orbita:

- `headline`
- 1 frase corta, diaria y personalizada.
- Debe poder leerse sola.
- No debe sonar determinista.

De donde sale:

- Transito destacado del dia.
- Carta natal base.
- Tema dominante del transito.
- Fecha local y timezone.

Backend:

- `highlightedTransit`
- `dailyHeadline`
- `headlineTemplateId`
- `basedOn`
- `confidence`
- `reviewStatus`

Biblioteca editorial a escribir:

- 5 a 10 templates por tipo de aspecto.
- 5 a 10 templates por planeta en transito.
- 5 a 10 templates por tema.
- Variantes suaves, medias y mas intensas.

Ejemplo Orbita:

```text
Hoy conviene escuchar antes de cerrar una conclusion.
```

### 2. Lectura por areas de vida

Que hacia:

- Divide el dia en modulos/areas.
- No todo queda en una sola frase.
- El usuario puede mirar amor, trabajo, vinculos, energia interna o temas parecidos.

Que queremos en Orbita P0:

- Amor.
- Trabajo.
- Familia.
- Vinculos.

Posible P1:

- Creatividad.
- Dinero/recursos, con mucho cuidado y sin consejo financiero.
- Cuerpo/ritmo, sin consejo medico.
- Amistades.
- Casa.

De donde sale:

- Casa natal activada por transito.
- Planeta natal activado.
- Planeta en transito.
- Signo/elemento.
- Aspecto.

Regla de mapeo sugerida:

| Area Home | Datos que la activan | Ejemplo de lectura |
| --- | --- | --- |
| Amor | Venus, Marte, Luna, casa 5, casa 7 | deseo, afecto, ritmo vincular |
| Trabajo | Sol, Mercurio, Saturno, Marte, casa 6, casa 10 | foco, tarea, visibilidad, limites |
| Familia | Luna, casa 4, Cancer, Saturno | casa, memoria, cuidado, pertenencia |
| Vinculos | Venus, casa 7, Libra, aspectos a Luna/Mercurio | conversacion, acuerdos, espejo |
| Creatividad P1 | Sol, Venus, Mercurio, casa 5 | expresion, juego, idea |
| Recursos P1 | Venus, Jupiter, Saturno, casa 2, casa 8 | valor, intercambio, orden |

Backend:

- `topicReadings[]`
- Cada item:
  - `topic`
  - `title`
  - `oneLine`
  - `detail`
  - `do`
  - `avoid`
  - `question`
  - `basedOn`
  - `lockedForPlus`

Biblioteca editorial a escribir:

- Por cada topic:
  - 30 frases cortas.
  - 30 detalles.
  - 30 acciones.
  - 30 evita.
  - 30 preguntas.
- Tags por planeta, casa, aspecto y tono.

### 3. Do / Don't, traducido a Hace / Evita

Que hacia:

- Recomendaciones accionables.
- Lo que conviene hacer.
- Lo que conviene evitar.
- Son microtextos, no explicaciones largas.

Que queremos en Orbita:

- `hace`
- `evita`

De donde sale:

- Aspecto del dia:
  - cuadratura/oposicion: cuidado, pausa, contraste.
  - trigono/sextil: oportunidad, fluidez, colaboracion.
  - conjuncion: foco, intensidad, inicio.
- Planeta:
  - Mercurio: hablar, ordenar, escribir, preguntar.
  - Venus: suavizar, elegir, registrar deseo.
  - Marte: actuar, cortar, mover energia.
  - Saturno: estructurar, poner limite, sostener.
  - Luna: registrar, cuidar, bajar velocidad.

Backend:

- `modules.do`
- `modules.avoid`
- `actionBankId`
- `avoidBankId`
- `safetyLevel`

Biblioteca editorial:

- Banco de 100 `hace`.
- Banco de 100 `evita`.
- Cada item con tags:
  - planeta,
  - aspecto,
  - tema,
  - intensidad,
  - prohibiciones.

Ejemplos Orbita:

```text
Hace: Converti una idea suelta en un paso concreto.
Evita: Tomar una sensacion como sentencia final.
```

### 4. Detalle del por que astrologico

Que hacia:

- Muestra datos de carta o detalles.
- Hace que el texto no parezca inventado.
- Puede explicar placements, transitos o areas.

Que queremos en Orbita:

- Un bloque corto de "basado en".
- Primero interno/backoffice.
- En app P0 puede ser muy simple.

De donde sale:

- `highlightedTransit`
- `selectedTransits`
- `natalBase`

Backend:

- `basedOn.label`
- `basedOn.raw`
- `basedOn.display`

Ejemplo:

```text
Basado en Venus activando tu casa 7.
```

Si no tenemos suficiente precision:

```text
Lectura aproximada: falta hora exacta de nacimiento.
```

### 5. Pregunta de reflexion diaria

Que hacia:

- Co-Star tiende a dejar frases que invitan a interpretacion.
- The Void agrega una capa de pregunta/respuesta.

Que queremos en Orbita:

- `preguntaDelDia`
- P0 como pregunta fija generada por el motor diario.
- P1 como entrada a Void/Oraculo.

De donde sale:

- Tema dominante.
- Aspecto.
- Topic principal.

Backend:

- `dailyQuestion`
- `questionTemplateId`
- `topic`
- `basedOn`

Biblioteca editorial:

- 20 preguntas por topic.
- 20 preguntas por aspecto.
- 20 preguntas por planeta personal.
- Preguntas seguras, no diagnosticas.

Ejemplos Orbita:

```text
Que estas queriendo resolver demasiado rapido?
```

```text
Que conversacion necesita menos defensa y mas precision?
```

### 6. The Void / modulo de preguntas

Que hacia:

- Una experiencia donde el usuario puede preguntar algo.
- Co-Star lo presenta como una capa aparte de la Home normal.
- Tiene un set de posibles preguntas o prompts.

Que queremos en Orbita:

- No P0 en app publica.
- Si P0 en backoffice como experimento.
- P1 como modulo tipo `El Vacio` o nombre propio de Orbita.

Contenido necesario:

- Lista de preguntas sugeridas.
- Categorias de pregunta.
- Respuesta generada con contexto astrologico del dia.
- Guardrails fuertes.
- Historial de preguntas.

Categorias sugeridas:

| Categoria | Ejemplos de preguntas |
| --- | --- |
| Dia | Que necesito mirar hoy? |
| Amor | Que patron vincular se activa hoy? |
| Trabajo | Donde conviene poner foco hoy? |
| Decision | Que dato estoy ignorando? |
| Cierre | Que puedo soltar sin dramatizar? |
| Deseo | Que deseo pide mas claridad? |
| Conversacion | Que pregunta abre mejor este tema? |
| Energia | Que me esta pidiendo el ritmo del dia? |

Backend:

- `voidQuestions`
- `voidSessions`
- `voidAnswers`
- `questionCategory`
- `moderationStatus`
- `basedOn`
- `guardrails`

Biblioteca editorial:

- 100 preguntas sugeridas.
- 10 categorias.
- Templates de respuesta por categoria.
- Respuestas de rechazo seguro:
  - salud,
  - legal,
  - dinero,
  - crisis,
  - decisiones de riesgo.

Regla:

The Void no deberia contestar "si/no va a pasar". Deberia devolver marco, pregunta mejor formulada y accion segura.

## Lista 2 - Contenidos Tipo Moonly Que Nos Interesan

### 1. Horoscopo diario / lectura diaria

Que hacia:

- Daily horoscope como modulo principal.
- Texto mas explicativo que Co-Star.
- Sensacion de guia diaria.

Que queremos en Orbita:

- `dailyLongRead`
- P0 en backoffice.
- App free puede mostrar solo resumen.
- Plus puede abrir lectura completa.

De donde sale:

- Headline + transito destacado + topic principal.

Backend:

- `longRead.title`
- `longRead.body`
- `longRead.sections[]`
- `lockedForPlus`

Biblioteca editorial:

- Templates de lectura larga por:
  - aspecto,
  - planeta,
  - casa,
  - topic.
- Variantes por intensidad.

### 2. Fase lunar / energia lunar

Que hacia:

- Moonly le da peso al calendario lunar.
- Muestra luna/fase como contexto del dia.

Que queremos en Orbita:

- P1, no imprescindible para validar Home P0.
- Puede sumar una capa simple:
  - fase lunar,
  - signo lunar del dia,
  - energia lunar,
  - accion lunar.

De donde sale:

- Provider lunar o calculo interno.
- Fecha local/timezone.

Backend:

- `lunar.phase`
- `lunar.sign`
- `lunar.illumination`
- `lunar.copy`
- `lunar.action`

Biblioteca editorial:

- Textos para 8 fases lunares.
- Textos para Luna en 12 signos.
- Acciones seguras por fase.
- Evita por fase.

### 3. Calendario energetico

Que hacia:

- Ver dias futuros.
- Revisar energia del dia.
- Conectar fecha con actividades/lecturas.

Que queremos en Orbita:

- P1 despues de Home.
- Semana o mes con:
  - energia,
  - topic dominante,
  - transito destacado,
  - fase lunar si aplica.

Backend:

- `calendarDays[]`
- Cache por usuario/rango.
- `dailyScore` o `energyTone`, sin venderlo como suerte/destino.

Biblioteca editorial:

- Labels de energia:
  - claro,
  - sensible,
  - activo,
  - lento,
  - social,
  - introspectivo,
  - creativo,
  - ordenado.
- Textos cortos por label.

### 4. Actividades / rituales / practicas

Que hacia:

- Recomienda actividades.
- Algunas estan asociadas al dia o luna.

Que queremos en Orbita:

- P0: solo `accion` simple.
- P1: acciones mas ricas.
- Evitar lenguaje de sanacion garantizada.

Backend:

- `recommendedActions[]`
- Tags por topic, planeta, fase lunar, intensidad.

Biblioteca editorial:

- 100 acciones seguras.
- 50 acciones de escritura/reflexion.
- 50 acciones vinculares.
- 50 acciones de orden/foco.
- 30 acciones creativas.

Ejemplos seguros:

```text
Escribi tres opciones antes de elegir una.
```

```text
Deja una conversacion importante para cuando puedas responder sin apuro.
```

### 5. Afirmacion / mantra corto

Que hacia:

- Apps tipo Moonly suelen usar afirmaciones o frases de energia.

Que queremos en Orbita:

- No como "mantra mistico" P0.
- Si como `frase para volver` dentro de lectura.

Backend:

- `anchorPhrase`
- `topic`
- `tone`

Biblioteca editorial:

- 100 frases breves.
- Deben sonar Orbita, no autoayuda generica.

Ejemplo Orbita:

```text
No todo lo intenso pide respuesta inmediata.
```

### 6. Contenido bloqueado Plus

Que hacia:

- Deja ver parte del valor y bloquea profundidad.

Que queremos en Orbita:

- P0 backoffice: simular free/Plus.
- P1 app: definir gating real.

Free posible:

- Headline.
- Hace.
- Evita.
- 1 topic abierto.

Plus posible:

- Lectura larga.
- 4 topics completos.
- Calendario.
- Void/preguntas.
- Historial.
- Vinculos.

Backend:

- `entitlement`
- `lockedModules[]`
- `previewCopy`
- `paywallContext`

## Nuestra Home P0 - Lista Exacta De Outputs

Esto es lo minimo que deberia devolver el backend para probar bien la Home.

### 1. Header diario

Campos:

```ts
{
  localDate: string;
  timezone: string;
  greeting: string;
  headline: string;
  subheadline: string;
}
```

Ejemplo:

```text
Hoy conviene ordenar el deseo antes de actuar.
```

### 2. Base astrologica visible

Campos:

```ts
{
  sun: Placement;
  moon: Placement | null;
  ascendant: Placement | null;
  accuracy: "calculated" | "approximate_without_birth_time";
  limitations: string[];
}
```

Uso:

- Mostrar o explicar de donde sale la lectura.
- Degradar copy si falta hora.

### 3. Transito destacado

Campos:

```ts
{
  transitPlanet: string;
  natalPoint: string;
  aspect: string;
  natalHouse?: number;
  sign?: string;
  exactTime?: string;
  priority: number;
  displayText: string;
}
```

Uso:

- Motor de personalizacion de todo el dia.
- Base para headline, topics, hace/evita y pregunta.

### 4. Modulos principales

Campos:

```ts
{
  do: string;
  avoid: string;
  energy: string;
  action: string;
  question: string;
}
```

Uso:

- Co-Star style, pero en voz Orbita.
- Microtextos accionables.

### 5. Topics

Campos:

```ts
[
  {
    topic: "amor" | "trabajo" | "familia" | "vinculos";
    title: string;
    oneLine: string;
    detail: string;
    do?: string;
    avoid?: string;
    question?: string;
    basedOn: string[];
    lockedForPlus: boolean;
  }
]
```

Uso:

- Lo que el usuario espera cuando dice "a nivel laboral y sentimental".
- Permite Home personalizada sin escribir un ensayo unico.

### 6. Lectura larga

Campos:

```ts
{
  title: string;
  body: string;
  sections?: Array<{ title: string; body: string }>;
  lockedForPlus: boolean;
}
```

Uso:

- Moonly style adaptado.
- Mejor como Plus o detalle expandible.

### 7. Preguntas / Void

Campos:

```ts
{
  questionOfDay: string;
  suggestedQuestions: Array<{
    id: string;
    category: string;
    text: string;
  }>;
}
```

Uso:

- Pregunta diaria P0.
- Void interactivo P1.

### 8. Gaps y revision

Campos:

```ts
{
  modelGaps: string[];
  reviewStatus: "needs_review" | "approved" | "rejected";
  contentVersion: string;
  calculationVersion: string;
}
```

Uso:

- Backoffice decide si algo esta listo.
- Nada sensible pasa a app sin aprobacion.

## Biblioteca Editorial Que Hay Que Escribir

### A. Signos

Para cada signo:

- descripcion corta.
- elemento.
- modalidad.
- verbos asociados.
- tono emocional.
- accion segura.
- evita seguro.
- pregunta de reflexion.

Cantidad:

- 12 signos.
- 10 a 20 variantes por signo.

### B. Planetas y puntos

Para cada planeta/punto:

- que representa.
- temas que activa.
- verbos.
- areas Home que puede tocar.
- intensidad.
- ejemplos de hace/evita.

Lista P0:

- Sol.
- Luna.
- Ascendente.
- Mercurio.
- Venus.
- Marte.
- Jupiter.
- Saturno.

P1:

- Urano.
- Neptuno.
- Pluton.
- Nodo.
- Quiron.

### C. Casas

Para cada casa:

- area de vida.
- topics relacionados.
- palabras clave.
- tipo de accion segura.
- warnings de copy.

Casas clave P0:

- Casa 1: identidad, presencia, cuerpo como registro, sin consejo medico.
- Casa 4: casa, familia, raiz, intimidad.
- Casa 5: deseo, creatividad, juego, romance.
- Casa 6: rutina, tarea, cuidado cotidiano, sin consejo medico.
- Casa 7: vinculos, pareja, acuerdos.
- Casa 10: trabajo, visibilidad, direccion.

### D. Aspectos

Para cada aspecto:

- tono.
- nivel de friccion/fluidez.
- accion sugerida.
- evita sugerido.
- pregunta sugerida.

P0:

- conjuncion.
- oposicion.
- cuadratura.
- trigono.
- sextil.

### E. Transitos

Esta es la parte mas importante para personalizacion diaria.

Necesitamos combinaciones:

```text
planeta en transito + aspecto + punto natal + casa = lectura base
```

Ejemplos de filas editoriales:

| Transito | Tema | Headline base | Hace | Evita |
| --- | --- | --- | --- | --- |
| Mercurio cuadratura Luna natal | comunicacion emocional | No todo lo que sentis necesita salir en bruto. | Escribi antes de responder. | Mandar el mensaje en caliente. |
| Venus trigono Sol natal | deseo/autoestima | Hay algo propio que hoy puede mostrarse con menos esfuerzo. | Elegi una senal clara. | Hacerte menos para gustar. |
| Marte oposicion Venus natal | deseo/vinculo | El impulso pide direccion antes que reaccion. | Nombrar lo que queres. | Confundir intensidad con acuerdo. |
| Saturno sextil Mercurio natal | foco/trabajo | La claridad aparece cuando ordenas el metodo. | Defini el primer paso. | Abrir diez frentes a la vez. |

Cantidad inicial:

- 100 combinaciones P0 revisadas manualmente.
- Luego expandir a 300-500 combinaciones.

### F. Topics

Para cada topic:

- descripcion.
- reglas astrologicas que lo activan.
- 50 one-liners.
- 50 detalles.
- 50 acciones.
- 50 evita.
- 50 preguntas.

Topics P0:

- amor.
- trabajo.
- familia.
- vinculos.

Topics P1:

- creatividad.
- amistades.
- casa.
- recursos.
- descanso/ritmo, sin consejo medico.

### G. Acciones Seguras

Banco reusable para `hace` y `accion`.

Tags:

- comunicacion.
- foco.
- vinculo.
- casa.
- creatividad.
- pausa.
- decision.
- limite.
- orden.

Reglas:

- siempre acciones chicas.
- nunca prometer resultado.
- nunca dar consejo medico/legal/financiero.
- evitar "tenes que".

### H. Evita Seguros

Banco reusable para `evita`.

Tipos:

- reaccionar rapido.
- cerrar conclusion.
- dramatizar.
- forzar respuesta.
- dispersarse.
- complacer.
- aislarse como sentencia.
- sobreexplicar.

Reglas:

- no culpabilizar.
- no asustar.
- no patologizar.

### I. Preguntas

Banco reusable para:

- pregunta del dia,
- Void,
- journaling,
- detalle de topics.

Categorias:

- amor.
- trabajo.
- familia.
- vinculos.
- decision.
- deseo.
- limite.
- claridad.
- cierre.
- inicio.

Cantidad P0:

- 100 preguntas.

### J. Disclaimers y estados raros

Textos necesarios:

- lectura aproximada sin hora.
- no se pudo calcular transito.
- provider no disponible.
- dato incompleto.
- timezone dudoso.
- pendiente de revision.
- contenido no apto para consejo medico/legal/financiero.

## Backend Necesario Para Rellenarlo

### Tablas / colecciones

Sugeridas:

- `birthData`
- `natalCharts`
- `dailyReadings`
- `dailyReadingRuns`
- `contentModules`
- `editorialTemplates`
- `editorialBanks`
- `voidQuestions`
- `voidAnswers`
- `calendarDays`
- `reviewQueue`

### Servicios

- `resolvePlace`
- `calculateNatalChart`
- `calculateDailyTransits`
- `selectHighlightedTransit`
- `mapTransitToTopics`
- `renderDailyHomeReading`
- `validateGuardrails`
- `saveBackofficeRun`
- `approveReading`
- `publishApprovedReadingToApp`

### Versionado

Cada lectura debe guardar:

- version de calculo.
- version de provider.
- version editorial.
- template IDs usados.
- banco de acciones usado.
- fecha local.
- timezone.
- estado de revision.

Sin esto no vamos a poder saber por que un usuario vio una frase especifica.

## Como Se Personaliza Cada Area

### Amor

Prioridad de datos:

1. Venus.
2. Marte.
3. Luna.
4. Casa 5.
5. Casa 7.
6. Aspectos a Venus/Luna/Marte.

Salida:

- one-line sentimental.
- hace.
- evita.
- pregunta.

Ejemplo:

```text
Amor: Hoy el deseo necesita menos prueba y mas claridad.
```

### Trabajo

Prioridad de datos:

1. Casa 10.
2. Casa 6.
3. Mercurio.
4. Saturno.
5. Marte.
6. Sol.

Salida:

- foco laboral.
- accion concreta.
- evita dispersion o reaccion.

Ejemplo:

```text
Trabajo: Una tarea chica puede ordenar mas de lo que parece.
```

### Familia

Prioridad de datos:

1. Luna.
2. Casa 4.
3. Cancer.
4. Saturno.
5. Aspectos a Luna.

Salida:

- lectura de casa/pertenencia.
- cuidado de limites.
- pregunta suave.

Ejemplo:

```text
Familia: No todo lo heredado necesita repetirse hoy.
```

### Vinculos

Prioridad de datos:

1. Casa 7.
2. Venus.
3. Mercurio.
4. Libra.
5. Aspectos Venus/Mercurio/Luna.

Salida:

- conversacion.
- acuerdo.
- espejo.
- limite.

Ejemplo:

```text
Vinculos: La claridad aparece cuando bajas la expectativa a una frase simple.
```

## Orden De Implementacion Correcto

### P0 Backoffice

1. Configurar AstrologyAPI real.
2. Calcular carta natal real.
3. Calcular transitos diarios.
4. Elegir transito destacado.
5. Generar:
   - headline,
   - hace,
   - evita,
   - energia,
   - accion,
   - pregunta,
   - amor,
   - trabajo,
   - familia,
   - vinculos.
6. Mostrar todo en backoffice.
7. Marcar approved/rejected.

### P0 Biblioteca

1. 12 signos.
2. 8 planetas/puntos P0.
3. 12 casas.
4. 5 aspectos.
5. 100 transitos base.
6. 100 acciones.
7. 100 evita.
8. 100 preguntas.
9. Disclaimers.

### P1

1. Lectura larga.
2. Fase lunar.
3. Calendario semanal.
4. Free/Plus real.
5. Void interactivo.
6. Historial de lecturas.

### P2

1. Compatibilidad/vinculos con segundo perfil.
2. Reportes premium.
3. Calendario mensual.
4. Notificaciones inteligentes.
5. CMS editorial completo.

## Decision Para Orbita

Lo que mas nos sirve tomar:

- De Co-Star:
  - frase diaria,
  - lectura por areas,
  - hace/evita,
  - pregunta/reflexion,
  - Void como modulo futuro,
  - mezcla de datos astrologicos + snippets editoriales.

- De Moonly:
  - lectura diaria mas explicada,
  - fase lunar/calendario como P1,
  - actividades/acciones,
  - free/Plus por profundidad,
  - progreso de personalizacion.

Orbita P0 deberia concentrarse en:

```text
Una frase diaria + cuatro areas + hace/evita + accion + pregunta.
```

Todo eso tiene que salir del backend y pasar por backoffice antes de ir a la app.

## Corte Implementado En Home Lab

El `/backoffice` ahora genera una salida editorial completa para revisar antes de conectar nada a la app publica.

### 1. Chart natal estable

No es diario. Se calcula y versiona como base de la persona.

Incluye:

- triada: Sol, Luna, Ascendente;
- placements;
- casas;
- aspectos principales;
- limitaciones si falta hora o proveedor real.

Uso:

- alimentar la lectura diaria;
- mostrar perfil natal;
- explicar de donde sale una lectura;
- comparar cambios entre versiones de calculo.

### 2. Daily Home por fecha

Se genera por persona + fecha local + timezone.

Incluye:

- headline;
- energia;
- 3 items de `hace`;
- 3 items de `evita`;
- accion;
- pregunta;
- topics: amor, trabajo, familia, vinculos.

Modo real:

- usa transitos del proveedor cuando AstrologyAPI esta configurada.

Modo maqueta:

- usa signo solar y reglas editoriales base;
- queda marcado como `demo_without_provider`;
- permite pulir contenido mientras faltan credenciales o raw real.

### 3. Deep Dive

Es el detalle del dia.

Incluye:

- titulo;
- intro;
- por que sale esa lectura;
- que hacer;
- que evitar;
- pregunta de reflexion;
- disclaimer seguro.

Uso:

- abrir la lectura diaria;
- explicar el transito destacado;
- probar tono antes de app.

### 4. Transits

Incluye:

- transito destacado;
- transitos secundarios;
- explicacion legible;
- raw normalizado.

Uso:

- validar si el selector eligio bien;
- ajustar prioridad;
- explicar la lectura sin mostrar todo el JSON.

### 5. Void preview

Incluye:

- pregunta del dia;
- preguntas sugeridas por categoria;
- guardrails.

Uso:

- probar el futuro modulo de preguntas;
- armar banco editorial sin activar todavia una experiencia interactiva en la app.

### 6. Sending Note To Your Future Self

Incluye:

- prompt sugerido;
- campo editable de nota;
- guardado lab-only en el run.

Uso:

- testear si la reflexion diaria genera una nota util;
- separar nota del usuario del payload original.

### 7. Long Reads

Incluye contenido educativo/editorial, no necesariamente personalizado.

Ejemplo:

- casas;
- ascendente;
- signos;
- aspectos;
- transitos.

Uso:

- biblioteca editorial tipo CMS;
- contenido free/Plus futuro;
- no depende directamente del calculo diario.

### 8. Persistencia editorial

Cada run conserva:

- payload generado original;
- `editorialPayload` editado;
- `futureSelfNote`;
- `reviewStatus`;
- `reviewNote`;
- `modelGaps`;
- versiones de calculo y contenido.

Regla:

El texto editado no pisa el raw ni el output original. Esto permite comparar proveedor, maqueta, edicion editorial y decision de aprobacion.

### 9. Base de personalizacion

Cada lectura debe mostrar de donde sale.

Estados:

- `personalizado_con_carta_y_transitos`: usa carta natal real + transito diario destacado.
- `personalizado_con_carta_sin_transito`: usa carta natal real pero no tiene transito diario destacado.
- `maqueta_no_personalizada_completa`: solo sirve para pulir estructura editorial; no debe leerse como resultado astrologico final.

El backoffice debe mostrar:

- explicacion simple;
- datos usados;
- datos faltantes;
- confianza para lab;
- gaps del modelo.

Regla:

Si falta AstrologyAPI o los transitos reales, la UI tiene que decirlo de forma visible. No alcanza con mostrar textos lindos; hay que poder auditar si la frase sale de la carta real de la persona o de una maqueta editorial.
