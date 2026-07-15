# Carta del día · modelo editorial

**Dirección de trabajo · 2026-07-13**

Este documento define qué tiene que decir la lectura de Carta del día y cómo se construye el vínculo entre una carta aleatoria y el cielo personalizado. La voz se define en `docs/voz-copy-orbita.md`; este documento define el contenido anterior a la escritura.

## La promesa

La Carta del día no adivina qué va a pasar y no revela una verdad oculta sobre la persona. Convierte dos materiales independientes en un ritual breve de lectura:

1. una **carta aleatoria**, que aporta una imagen y una operación simbólica;
2. un **cielo personalizado**, que muestra una tensión real del día sobre la carta natal;
3. una **relación editorial** entre ambos, que abre una pregunta concreta.

El valor no está en fingir que la carta fue elegida por el cielo. Está en mostrar qué se vuelve visible cuando se leen las dos cosas juntas.

## Qué tiene que entender la persona

Al terminar la lectura, la persona debería poder decir:

- entiendo qué perspectiva aporta esta carta;
- entiendo qué tema de mi cielo está activo hoy;
- entiendo si esas dos lecturas se refuerzan, tiran distinto o cambian la pregunta;
- me quedó una pregunta específica, no una orden ni un pronóstico.

Si el texto no logra esas cuatro cosas, una prosa más linda no lo arregla.

## El rol de cada parte

### La carta

La carta no representa un evento futuro. Aporta una forma de mirar y de operar.

Para escribirla hacen falta cuatro datos editoriales curados:

- **movimiento central:** qué hace la carta —corta, pausa, revela, ordena, mezcla, elige—;
- **tensión:** entre qué dos fuerzas se mueve;
- **potencia:** qué permite ver o hacer cuando se la usa bien;
- **exceso:** qué pasa cuando ese movimiento se lleva demasiado lejos.

No alcanza con darle al modelo `La Torre + Marte`. Eso obliga al modelo a reconstruir el significado de memoria y produce lugares comunes.

### El cielo

El cielo aporta la parte personalizada y verificable:

- qué función natal recibe el tránsito;
- qué dinámica introduce el aspecto;
- en qué área de vida ocurre;
- con qué intensidad o cercanía temporal;
- qué tensión concreta se puede traducir sin inventar una conducta.

El cielo da contexto. No dicta una decisión.

### La conexión

La conexión no es una mezcla de palabras clave ni una justificación astrológica de la carta. Es una relación editorial explícita entre el movimiento de la carta y la dinámica del tránsito.

Puede adoptar cuatro formas:

1. **Resonancia:** carta y cielo enfocan el mismo eje desde lenguajes distintos.
2. **Contraste:** una parte empuja donde la otra limita, demora o cuestiona.
3. **Reencuadre:** la carta cambia la pregunta que parecía plantear el cielo.
4. **Sin cruce fuerte:** no hay una relación significativa; se presentan como dos perspectivas independientes sin forzar una tesis.

`Sin cruce fuerte` es una salida válida y necesaria. Si todos los pares producen una conexión brillante, el sistema está inventando.

## La correspondencia astrológica

La correspondencia tradicional de una carta es metadata válida, pero no convierte automáticamente el cruce en legítimo.

- Puede enriquecer una conexión cuando esa correspondencia participa realmente del eje del tránsito.
- Puede funcionar como dato secundario o desempate.
- No debe ser el puente principal ni aparecer por obligación.

`La Torre es Marte + hoy Saturno toca Venus` no constituye todavía una lectura. La lectura aparece cuando se define qué relación concreta existe entre ruptura, estructura, deseo, límite y vínculo.

## Datos que necesita el sistema

Cada arcano mayor debería tener un perfil editorial curado y versionado:

```text
cardProfile
  movimientoCentral
  tensionPrincipal
  potencia
  exceso
  ejesSemanticos[]
  preguntasPosibles[]
  afirmacionesProhibidas[]
```

El tránsito debería llegar normalizado:

```text
transitProfile
  funcionActivada
  dinamicaDelAspecto
  areaDeVida
  intensidad
  ejesSemanticos[]
  evidencia[]
```

Antes de escribir, el conector debe producir:

```text
connection
  modo: resonancia | contraste | reencuadre | sin_cruce_fuerte
  ejeCompartido
  aporteDeLaCarta
  aporteDelCielo
  diferenciaEntreAmbos
  preguntaAbierta
```

El modelo recién escribe después de resolver esa estructura. No debe descubrir el significado y redactar al mismo tiempo.

## Formato recomendado

1. `TE SALIÓ {CARTA}`
2. `LA CARTA` — qué perspectiva aporta; incluye potencia y exceso.
3. `TU CIELO HOY` — qué tensión personalizada está activa.
4. `ENTRE LAS DOS` — resonancia, contraste, reencuadre o ausencia de cruce.
5. `LA PREGUNTA` — una pregunta concreta que conserve la agencia.

La pregunta reemplaza el consejo automático. Una acción solo aparece cuando surge naturalmente del cruce y se puede formular sin asumir una situación que no está en los datos.

## Ejemplo trabajado

### Entrada

- Carta: **La Torre**.
- Perfil editorial: ruptura de forma; tensión entre sostener y derribar; potencia para exponer una estructura insuficiente; exceso de confundir revisión con destrucción.
- Cielo de prueba: **Saturno en oposición a Venus natal en casa 7**.
- Lectura del cielo: tensión entre deseo, compromiso, límite y forma vincular.
- Tipo de conexión: **resonancia en el eje estructura ↔ vínculo**.

### Salida

**TE SALIÓ LA TORRE**

**LA CARTA**

La Torre no habla solamente de derrumbe. Distingue entre perder algo y perder la forma que lo sostenía. Su potencia está en mostrar una estructura que ya no alcanza; su exceso, en confundir revisión con destrucción.

**TU CIELO HOY**

Saturno frente a Venus en casa 7 concentra la tensión en los acuerdos de a dos: cuánto deseo cabe dentro de un compromiso y cuánto límite necesita un vínculo para seguir siendo habitable.

**ENTRE LAS DOS · RESONANCIA**

Se encuentran en una pregunta por la forma. La Torre examina si la estructura todavía sostiene. Saturno recuerda que un vínculo también necesita bordes. Juntas no anuncian una ruptura: ayudan a separar la relación del acuerdo que hoy la organiza.

**LA PREGUNTA**

¿Lo que está en tensión es el vínculo o la forma que hoy lo organiza?

## Qué cambia respecto del enfoque anterior

Antes:

- el modelo recibía nombre y correspondencia, pero no un significado editorial curado;
- se le pedía que inventara la tesis y la prosa en el mismo paso;
- la correspondencia astrológica se trataba como garantía del puente;
- todos los pares debían reforzarse o contradecirse;
- el cierre tenía que convertirse en conducta, consejo o incomodidad.

Ahora:

- la carta tiene una ontología editorial propia;
- el cielo se interpreta por separado y con trazabilidad;
- el cruce se clasifica antes de redactarse;
- se permite declarar que no existe un cruce fuerte;
- la salida central es una distinción o una pregunta, no un veredicto.

## Criterio de calidad

Una buena lectura no es la que parece más profunda. Es la que produce una distinción que no estaba disponible al mirar la carta o el tránsito por separado.
