# Referencias Co-Star Y Moonly - Que Hacen Y Que Tomamos Para Orbita

Fecha: 2026-07-04

## Para Que Sirve Este Documento

Este documento separa tres cosas:

1. Que hacian Co-Star y Moonly en las referencias revisadas.
2. Que queremos tomar, adaptar o descartar para Orbita.
3. Por que algunas partes tienen que construirse aparte aunque en la app parezcan una sola experiencia.

La lectura clave: **las apps no muestran solo astrologia**. Muestran una mezcla de captura de datos, calculo, contenido editorial, personalizacion, cuenta, pago, calendario, historial, vinculos, notificaciones y CMS. En producto se ve continuo; en backend hay que separarlo para poder probarlo bien.

## Fuentes Usadas

- Analisis previo: `docs/textos-analisis-personalizacion.md`
- API/calculo: `docs/api-astrologica-orbita.md`
- Backend backlog: `docs/backend-todo.md`
- Figma actual: `docs/figma-context.md`
- Mobbin Co-Star app flows: https://mobbin.com/apps/co-star-ios-9a62804f-6b1b-4423-8b2d-5ad8508a8b52/579236af-9315-44d2-88b6-326ccdb4a6bc/flows
- Mobbin Moonly app flows: https://mobbin.com/apps/moonly-ios-6e065143-033e-42d4-97a0-dfbcb795e32e/9b979db9-170f-40cc-ac80-627c18acbf39/flows

Nota: esto no es una copia literal de esas apps. Es una matriz para decidir el scope de Orbita.

## Resumen Ejecutivo

### Co-Star

Co-Star trabaja mas como una experiencia editorial/data-driven:

- pide datos natales con mucha sobriedad,
- promete precision,
- muestra carta base y placements,
- centra el dia en una lectura breve,
- usa modulos tipo detalles/tablas,
- empuja relacion/social/friends como capa de valor,
- monetiza reportes o profundidad.

Para Orbita:

- tomar tono editorial, precision, aire, triada/carta y home diaria;
- no copiar claims tecnicos sin respaldo;
- no meter social/friends como core antes de validar lectura diaria.

### Moonly

Moonly trabaja mas como una experiencia wellness/comercial:

- explica beneficios,
- acompana onboarding con progreso,
- muestra privacidad/por que pide datos,
- usa payment fuerte,
- ofrece calendario, fases lunares, actividades y contenido diario,
- bloquea valor detras de Plus.

Para Orbita:

- tomar claridad comercial, privacidad, progreso, paywall y calendario simple;
- no copiar claims inflados de bienestar ni estetica generica mistica.

## Matriz General

| Area | Co-Star | Moonly | Que Hacemos En Orbita | Por Que Va Aparte |
| --- | --- | --- | --- | --- |
| Onboarding natal | Fecha, lugar, hora, flujo sobrio | Identidad, fecha, lugar, hora, beneficios | Mantener fecha/lugar/hora + precision de hora | Captura de datos y calculo son sistemas distintos |
| Privacidad | Microcopy de uso de datos | Caja visible de privacidad | Microcopy por dato sensible | Legal/confianza no depende de la API astrologica |
| Calculo | Carta y placements como base | Blueprint/carta como promesa | Calculo real en backoffice primero | API/backend antes que app publica |
| Home diaria | Frase diaria + detalles | Daily horoscope + actividades | Headline, Hace, Evita, Energia, Accion | Contenido editorial/cache diario separado del onboarding |
| Calendario | Fechas/dias destacados en premium | Luna/calendario/actividades | P1 calendario energetico/lunar | Requiere motor por fecha y UI propia |
| Vínculos | Friends/synastry/social | Menos central | P1/P2 vinculo simbolico | Requiere segundo perfil y reglas de compatibilidad |
| Pago | Premium reports/features | Paywall fuerte, beneficios claros | Pago despues de validar outputs | StoreKit/Play Billing + entitlement separado |
| CMS/contenido | Mucho contenido editorial | Contenido diario + cursos/actividades | Biblioteca editorial propia | La API calcula; no escribe la voz de Orbita |
| Notificaciones | Habitual en daily apps | Recordatorios/contenido diario | P1 despues de Home estable | Depende de timezone, preferencia y valor diario |
| Social | Muy importante en Co-Star | Secundario | No P0 | Es otro producto dentro del producto |

## Lista 1 - Que Hacia Co-Star

### 1. Entrada sobria y editorial

Observado:

- Pantallas austeras.
- Mucho aire.
- Una idea por pantalla.
- Poca explicacion larga.
- Sensacion de autoridad.

Para Orbita:

- Tomar el ritmo seco/editorial.
- Mantener copy breve.
- Evitar explicar todo en onboarding.
- Traducir a dark premium, no a blanco Co-Star literal.

### 2. Captura de datos natales

Observado:

- Fecha de nacimiento.
- Lugar de nacimiento.
- Hora de nacimiento.
- Flujo paso a paso.
- Confirmaciones antes de calcular.

Para Orbita:

- Mantener `fecha -> lugar -> hora`.
- Agregar `precision de hora`.
- Permitir `No se la hora`.
- Guardar draft de onboarding.

Backend separado:

- `onboardingDrafts`
- `birthData`
- geocoding/timezone
- validacion de inputs

### 3. Microcopy de confianza

Observado:

- Explica por que necesita datos.
- Ubica el dato dentro del calculo de carta.
- No lo convierte en un formulario frio.

Para Orbita:

- Por fecha: ubica Sol/base.
- Por lugar: ayuda a ascendente/casas.
- Por hora: afina ascendente/casas.
- Si falta hora: carta aproximada.

Backend/contenido separado:

- No lo trae la API.
- Es copy legal/editorial propio.

### 4. Carta base / placements

Observado:

- Muestra puntos natales.
- Da importancia a placements.
- Usa detalles/tabla/estructura.
- Hace sentir que el usuario tiene un mapa personal.

Para Orbita:

- P0: Sol, Luna, Ascendente.
- P0: Mercurio, Venus, Marte si el output es estable.
- P0: casas 1, 4, 7, 10.
- P0: aspectos mayores.

Backend separado:

- `natalCharts`
- provider raw
- normalizacion propia
- versionado de calculo
- revision editorial

### 5. Home diaria editorial

Observado:

- Lectura diaria central.
- Tono corto, misterioso, con autoridad.
- Modulos expandibles o de detalle.
- Fecha/dia como unidad de consumo.

Para Orbita:

- Home V1.1 ya apunta a:
  - frase principal,
  - triada natal,
  - `Hace`,
  - `Evita`,
  - `Energia`,
  - `Accion`,
  - topics.

Backend separado:

- `dailyReadings`
- cache por usuario/dia/timezone
- version editorial
- estado free/Plus

### 6. Detalles y tablas

Observado:

- Usa estructura de datos visible.
- Details/placements/aspectos dan sensacion de profundidad.
- No todo es texto largo.

Para Orbita:

- Backoffice ya va en esta direccion.
- App futura puede mostrar:
  - tabla de puntos natales,
  - aspectos destacados,
  - casas principales,
  - detalle expandible.

Backend separado:

- Normalizacion de carta.
- Selector de relevancia.
- UI de lectura vs raw/debug.

### 7. Friends / relaciones

Observado:

- Co-Star empuja comparar cartas y amigos.
- El valor social aparece como extension natural de carta personal.

Para Orbita:

- No P0.
- P1/P2 como `Vinculo simbolico`, no red social completa.
- Empezar con una sola relacion cargada manualmente.

Backend separado:

- segundo perfil natal,
- permisos/privacidad,
- compatibilidad/synastry,
- sharing,
- invitaciones si se hace social.

### 8. Premium reports / profundidad paga

Observado:

- Parte del valor avanzado queda en reportes o features premium.

Para Orbita:

- Plus despues de validar outputs.
- Potenciales bloques:
  - carta completa,
  - transitos profundos,
  - calendario,
  - vinculo,
  - historial/guardadas.

Backend separado:

- productos de tienda,
- entitlement,
- restore,
- receipt validation,
- paywall analytics.

### 9. Que No Copiar De Co-Star

- Claim tecnico fuerte tipo fuente astronomica especifica sin integracion real.
- Frases demasiado deterministas.
- Estetica literal si contradice Orbita.
- Social como centro antes de validar core diario.
- Textos duros o patologizantes.

## Lista 2 - Que Hacia Moonly

### 1. Onboarding con beneficios claros

Observado:

- Explica que va a obtener la persona.
- Antes del pago, lista beneficios.
- Usa una progresion mas comercial.

Para Orbita:

- Mantener claridad de `que desbloquea`.
- Decir beneficios concretos:
  - carta,
  - tránsitos,
  - guia diaria,
  - calendario futuro.
- Evitar prometer resultados emocionales garantizados.

Backend/contenido separado:

- copy comercial,
- paywall,
- entitlement,
- estados de compra.

### 2. Privacidad visible

Observado:

- Moonly explica por que pide datos personales.
- Usa bloques de confianza cerca de datos sensibles.

Para Orbita:

- Microcopy en fecha/lugar/hora.
- Copy legal corto en pago.
- Disclaimer claro de entretenimiento/autoconocimiento.

Backend/legal separado:

- terminos,
- privacidad,
- consentimiento,
- tratamiento de datos natales.

### 3. Progreso / personalizacion

Observado:

- Pantallas de analisis con porcentaje.
- Sensacion de que la app esta trabajando.
- Promete resultado personalizado.

Para Orbita:

- Pantalla `12 / Personalizing`.
- En backoffice: job real visible.
- En app: no fingir calculos; mostrar progreso honesto.

Backend separado:

- job de calculo,
- retry,
- error,
- cache,
- status de provider.

### 4. Payment fuerte

Observado:

- Paywall claro.
- Planes comparables.
- Beneficios visibles.
- Recomendacion de plan.
- Restore/legal.

Para Orbita:

- Una pantalla de pago al final del onboarding.
- Plan anual default si se confirma producto.
- Legal: cancelar, entretenimiento/autoconocimiento.
- No mostrar reviews/estrellas inventadas.

Backend separado:

- StoreKit/Play Billing.
- productos weekly/annual,
- entitlement Plus,
- restore,
- validacion de recibos.

### 5. Home con modulos diarios

Observado:

- Horoscopo diario.
- Fase lunar.
- Actividades/recomendaciones.
- Contenido personalizado.
- Bloqueos Plus.

Para Orbita:

- Home diaria editorial.
- Topics: Amor, Trabajo, Familia, Vinculos.
- P1 calendario energetico/lunar.
- P1/P2 actividades o rituales si el tono los soporta.

Backend separado:

- `dailyReadings`,
- `contentModules`,
- CMS,
- calendario/fases lunares,
- gating Plus.

### 6. Calendario lunar / energetico

Observado:

- Moonly le da peso al calendario.
- El usuario puede mirar dias, luna, actividades.

Para Orbita:

- P1 despues de Home diaria.
- Calendario con:
  - dia,
  - fase lunar si se integra,
  - energia,
  - mejor foco,
  - transitos destacados.

Backend separado:

- motor por rango de fechas,
- cache semanal/mensual,
- contenido editorial por fecha,
- zona horaria.

### 7. Actividades / practicas

Observado:

- Recomendaciones accionables.
- Actividades segun dia/luna.

Para Orbita:

- P0: `Accion` simple.
- P1: banco de acciones seguras.
- Evitar lenguaje de cura/sanacion garantizada.

Backend/contenido separado:

- biblioteca de acciones,
- tags por tema,
- guardrails,
- versionado editorial.

### 8. Bloqueos Plus

Observado:

- Parte del contenido se ve bloqueado.
- El bloqueo ayuda a explicar valor premium.

Para Orbita:

- No bloquear demasiado antes de que la persona entienda valor.
- Free puede tener headline + una accion.
- Plus puede tener detalle, calendario, vinculo, historial.

Backend separado:

- entitlement,
- feature flags,
- lectura free vs Plus,
- analytics de paywall.

### 9. Que No Copiar De Moonly

- Claims de bienestar exagerados.
- Reviews falsas.
- Estetica violeta/mistica generica.
- Exceso de modulos bloqueados.
- Lenguaje de resultados garantizados.

## Que Conviene Hacer En Orbita

### P0 - Hacer Ahora

- Captura natal completa:
  - fecha,
  - lugar,
  - hora,
  - precision.
- Backoffice astrological lab.
- Carta natal real versionada.
- Lectura diaria P0:
  - headline,
  - Hace,
  - Evita,
  - Energia,
  - Accion.
- Topics:
  - Amor,
  - Trabajo,
  - Familia,
  - Vinculos.
- Paywall de onboarding con beneficios claros.
- Disclaimers y privacidad.
- Revision editorial antes de app publica.

### P1 - Hacer Despues De Validar Outputs

- Calendario semanal/mes.
- Fase lunar si se integra proveedor.
- Lectura larga.
- Guardar lecturas.
- Historial.
- Plus/free gating.
- Notificaciones diarias.

### P2 - Futuro

- Vinculo/compatibilidad.
- Comparar cartas.
- Reportes premium.
- Social/friends.
- Sharing/invitaciones.
- CMS editorial avanzado.

## Por Que Algunas Cosas Van Aparte

### 1. API astrologica no es producto final

La API trae datos calculados:

- placements,
- casas,
- aspectos,
- transitos.

Pero no define:

- tono,
- que mostrar primero,
- que ocultar,
- que es free/Plus,
- que frase ve el usuario,
- que se considera seguro.

Por eso hay que separar:

- provider,
- normalizacion,
- selector de relevancia,
- editorial Orbita,
- revision backoffice.

### 2. Onboarding no es Home

Onboarding captura datos y vende valor.

Home entrega valor todos los dias.

Aunque usen la misma carta natal, son sistemas distintos:

- onboarding draft,
- perfil natal,
- lectura diaria,
- cache diario,
- payment.

### 3. Carta natal no es transito diario

Carta natal:

- cambia poco o nunca,
- se calcula con fecha/lugar/hora de nacimiento,
- sirve como base.

Transito diario:

- cambia por fecha/timezone,
- se recalcula o cachea por dia,
- sirve para Home y calendario.

### 4. Pago no es solo una pantalla

La pantalla se ve simple, pero requiere:

- productos reales,
- compra,
- restore,
- validacion,
- entitlement,
- estados de error,
- analytics.

Por eso se puede disenar ahora, pero implementar de verdad va aparte.

### 5. Calendario es otro motor

Un calendario no es una lista estatica.

Necesita:

- rango de fechas,
- zona horaria,
- transitos por dia,
- fases lunares si aplica,
- cache,
- resumen editorial por dia.

### 6. Vínculos requieren segundo perfil

No alcanza con la carta del usuario.

Hace falta:

- datos natales de otra persona,
- privacidad,
- calculo comparativo,
- permisos,
- copy cuidadoso para no prometer destino relacional.

### 7. CMS/editorial es clave

Si todo vive hardcodeado, no se puede mejorar tono ni hacer QA de lecturas.

Orbita necesita biblioteca editable para:

- signos,
- planetas,
- casas,
- aspectos,
- tránsitos,
- acciones,
- evita,
- disclaimers,
- variantes free/Plus.

## Decisiones Para Marcar

| Feature | Tomar | Adaptar | No Ahora | No Copiar |
| --- | --- | --- | --- | --- |
| Fecha/lugar/hora | x |  |  |  |
| Microcopy privacidad | x |  |  |  |
| Progreso de calculo |  | x |  |  |
| Carta base visible | x |  |  |  |
| Frase diaria editorial | x |  |  |  |
| Do/Don't / Hace/Evita |  | x |  |  |
| Topics Home | x |  |  |  |
| Calendario lunar |  | x | x P1 |  |
| Actividades/rituales |  | x | x P1 |  |
| Vínculos/compatibilidad |  | x | x P2 |  |
| Social/friends |  |  | x P2/P3 |  |
| Premium reports |  | x | x P2 |  |
| Reviews/claims fuertes |  |  |  | x |
| Claims tecnicos sin respaldo |  |  |  | x |
| Estetica literal Co-Star/Moonly |  |  |  | x |

## Traduccion A Backoffice

Para probar todo esto sin romper la app publica, el backoffice deberia crecer asi:

1. Personas de prueba.
2. Carta natal raw/normalizada.
3. Transitos diarios raw/normalizados.
4. Selector de transito destacado.
5. Lectura diaria generada.
6. Biblioteca editorial P0.
7. Estado free/Plus simulado.
8. Calendario semanal simulado.
9. Revision editorial:
   - `needs_review`,
   - `approved`,
   - `rejected`.
10. Solo outputs aprobados pasan despues a app.

