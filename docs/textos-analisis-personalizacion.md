# Textos Y Análisis De Personalización - Órbita

Fecha: 2026-07-04

## Alcance

Este documento lista las piezas de texto, análisis y contenido personalizado que habría que definir para que Órbita pase de onboarding visual/beta a producto vivo para cada persona que entra.

Fuentes revisadas:

- `PROJECT_CONTEXT.md`
- `CURRENT_TASK.md`
- `docs/contexto-actual.md`
- `docs/figma-context.md`
- `docs/ritmo-trabajo.md`
- `docs/assets-needed.md`
- `docs/backend-todo.md`
- `docs/onboarding-v44-react-native-handoff.md`
- Figma `BEB5v6SbgJn2Nipm8Qa0wE`, página visible `UX V4.3 - Órbita Onboarding Copy`
- Código actual: `app/onboarding.tsx`, `app/(tabs)/*`, `src/domain/*`, `src/content/catalog.ts`, `convex/schema.ts`
- Mobbin: Co-Star iOS flows, Moonly iOS flows y pantallas de Home/onboarding/pago.

Referencias Mobbin usadas:

- Co-Star app flows: https://mobbin.com/apps/co-star-ios-9a62804f-6b1b-4423-8b2d-5ad8508a8b52/579236af-9315-44d2-88b6-326ccdb4a6bc/flows
- Co-Star onboarding encontrado: https://mobbin.com/flows/ca4b6afb-f05a-462f-b9a7-ab026b438d39
- Moonly app flows: https://mobbin.com/apps/moonly-ios-6e065143-033e-42d4-97a0-dfbcb795e32e/9b979db9-170f-40cc-ac80-627c18acbf39/flows
- Moonly onboarding + pago encontrado: https://mobbin.com/flows/87813e2f-8e67-4cd7-9510-7892c0676442
- Moonly onboarding alternativo encontrado: https://mobbin.com/flows/992bc16a-8d0b-4961-8078-98e2e807a32a

Capturas temporales de referencia:

- `/private/tmp/orbita-mobbin/costar/`
- `/private/tmp/orbita-mobbin/costar-home/`
- `/private/tmp/orbita-mobbin/moonly/`

No son assets de producto. Son evidencia de referencia para análisis.

## Lectura Competitiva

### Co-Star: qué tomar

- Apertura austera: símbolo, frase corta, autoridad sin explicar demasiado.
- Una pregunta por paso para datos natales: fecha, lugar, hora.
- Microcopy de confianza junto a cada dato sensible.
- Formatos de input muy sobrios: wheel, búsqueda, confirmación.
- Revelación temprana de triada o puntos base.
- Home editorial centrado en una frase diaria y módulos de detalle.
- Lectura por fecha, con calendario horizontal.
- Secciones expandibles tipo `Details`.
- Contenido premium como lectura de relación o reporte anual.
- CTA de reflexión tipo nota al yo futuro.

### Co-Star: qué evitar

- Mencionar `NASA` o una fuente técnica sin respaldo real del producto.
- Frases demasiado duras, diagnósticas o deterministas.
- Usar teléfono como puerta principal si no es necesario.
- Copiar la estética blanca/grilla literal si la marca actual ya es dark premium.
- Social/friends como centro del producto antes de validar el core diario.

### Moonly: qué tomar

- Beneficios claros antes de pedir pago.
- Caja de privacidad visible cuando pide datos personales.
- Progreso de análisis con porcentaje y sensación de trabajo en curso.
- Planes comparables con precio y recomendación visible.
- Lista de beneficios tipo producto: carta, personalización, calendario, recomendaciones.
- Home con módulos diarios: fase lunar, actividad diaria, contenido personalizado y bloqueos Plus.
- Claridad de qué está incluido y qué queda pago.

### Moonly: qué evitar

- Exceso de claims de bienestar genérico.
- Reviews, estrellas o promesas comerciales si no son reales.
- Paleta violeta/fantasía demasiado fuerte para Órbita.
- Ilustraciones con estética más juvenil o mística que editorial.
- Demasiados módulos bloqueados antes de que el usuario entienda el valor.

## Decisión De Producto Para Órbita

Mantener la mezcla vigente: 70% Co-Star, 30% Moonly.

- De Co-Star: ritmo editorial, aire, precisión, autoridad seca, lectura diaria.
- De Moonly: progresión comercial, claridad de beneficios, privacidad y pago.
- No copiar literal; traducir a Órbita: dark premium, cobre sutil, voseo argentino, entretenimiento/autoconocimiento/contexto.

## Lista Maestra De Textos Por Etapa

### 0. Marca, tono y disclaimers base

Textos a definir:

- Definición corta de Órbita.
- Tagline final.
- Disclaimer corto de producto: entretenimiento, autoconocimiento y contexto.
- Disclaimer largo legal.
- Frases prohibidas o no recomendadas.
- Glosario de tono: cómo suena `voseo editorial`, cómo no suena.
- Reglas de temas sensibles: salud, dinero, legal, decisiones de riesgo, psicología.
- Reglas para hablar de astrología sin prometer destino.

Estado actual:

- Bastante definido en docs, pero falta convertirlo en bloque reutilizable para UI, paywall, perfil, onboarding y backoffice.

### 1. Onboarding 01-15

#### 01 / Logo Splash

Textos:

- Marca.
- Tagline.
- Variante breve para loading si hace falta.

Análisis requerido:

- Ninguno personalizado todavía.

#### 02 / Align With Universe

Textos:

- Promesa principal.
- Subcopy de valor.
- Nombres de beneficios: influencia lunar, guía personal, práctica diaria, decisiones.
- Nota segura: ordena señales, no dicta destino.
- CTA.

Análisis requerido:

- Ninguno personalizado todavía; es promesa general.

#### 03 / Identify

Textos:

- Pregunta de identidad.
- Opciones.
- Nota sobre uso: cambia tono de lecturas.
- CTA.
- Error/estado si no elige.

Análisis requerido:

- Definir si identidad afecta pronombres, ejemplos, tono o solo experiencia.
- Definir si se guarda como dato editable en perfil.

#### 04 / Daily Guidance

Textos:

- Título de valor diario.
- Subcopy.
- Badges de tema.
- Mini lectura de ejemplo dentro del teléfono.
- CTA.

Análisis requerido:

- Demo estática de valor, no personalizada.
- Debe anticipar los módulos reales de Home.

#### 05 / Birthdate Empty

Textos:

- Pregunta de fecha.
- Por qué se pide.
- Privacidad.
- CTA.
- Errores: fecha incompleta, fecha inválida, edad mínima si aplica.

Análisis requerido:

- Calcular signo solar preliminar.
- Normalizar fecha.
- Guardar draft.

#### 06 / Birthdate Selected

Textos:

- Confirmación dinámica: `Sol en {signo}.`
- Fecha legible.
- Etiquetas de tabla: Sol, Elemento.
- Link `Cambiar fecha`.
- Privacidad.
- CTA.

Análisis requerido:

- Signo solar.
- Elemento.
- Modalidad si se decide agregar.
- Frase corta del signo para confirmar valor.

#### 07 / Birthplace Search

Textos:

- Pregunta de lugar.
- Placeholder de búsqueda.
- Estados: buscando, sin resultados, error, reintentar.
- Nota de por qué importa.
- CTA deshabilitado/habilitado.

Análisis requerido:

- Geocoding/autocomplete.
- Lugar canónico.
- País/región.
- Latitud/longitud.
- Timezone.

#### 08 / Birthplace Selected

Textos:

- Confirmación de lugar.
- Explicación de ascendente/casas.
- Link `Cambiar lugar`.
- CTA.

Análisis requerido:

- Validar que el lugar seleccionado tenga coordenadas y timezone.
- Preparar cálculo de casas/ascendente.

#### 09 / Birth Time Picker

Textos:

- Pregunta de hora.
- Selector hora/minuto/AM-PM.
- Botón `No sé la hora`.
- Nota sobre carta aproximada.
- CTA.
- Errores de formato si aplica.

Análisis requerido:

- Normalizar a 24h.
- Definir `birthTimePrecision`: known, approximate, unknown.
- Decidir qué análisis se bloquea o se degrada si no hay hora.

#### 10 / Birth Time Selected

Textos:

- Confirmación de hora.
- Explicación de precisión.
- Link `Cambiar hora`.
- CTA.

Análisis requerido:

- Hora normalizada + timezone.
- Mensaje dinámico según precisión.

#### 11 / Your Base Chart

Textos:

- Título de puntos de partida.
- Subcopy de carta base.
- Etiquetas: Sol, Luna, Ascendente, hora/lugar.
- Frase de cierre: con esto calculamos carta, ascendente y casas.
- CTA `Calcular mi carta`.

Análisis requerido:

- Carta natal mínima.
- Sol.
- Luna.
- Ascendente.
- Casas básicas.
- Lugar/hora usados.
- Grado/signo si se decide mostrar.
- Estado si no se sabe la hora.

#### 12 / Personalizing

Textos:

- Título de cálculo.
- Subcopy.
- Labels de progreso: carta natal, tránsitos del día.
- Nota segura sobre uso de datos.
- Error si falla cálculo.
- CTA/retry si hace falta.

Análisis requerido:

- Job de cálculo.
- Carta natal snapshot.
- Tránsitos diarios.
- Primera lectura diaria.
- Control de fallos y reintentos.

#### 13 / Before After / Órbita

Textos:

- Título.
- Subcopy.
- Lista `Antes`.
- Lista `Después`.
- Nota segura: no resuelve por vos, devuelve contexto.
- CTA.

Análisis requerido:

- No personalizado.
- Debe revisar claims: evitar prometer calma, intuición o vínculos como resultado garantizado.

#### 14 / Create Account

Textos:

- Título para guardar carta.
- Subcopy de historial, lecturas y tránsitos.
- Email label/placeholder.
- CTA.
- Apple/Google.
- Errores de email/OAuth.
- Recuperación de sesión.
- Consentimientos si aplica.

Análisis requerido:

- Linkear draft onboarding a usuario.
- Definir qué pasa si crea cuenta y no paga.

#### 15 / Onboarding Payment / Scroll

Textos:

- Marca + PLUS.
- Título.
- Subcopy.
- Plan semanal.
- Plan anual.
- Badge de valor.
- `Qué incluye`.
- `Cómo funciona`.
- Legal: cancelar, entretenimiento/autoconocimiento.
- Restore.
- CTA.
- Estados de compra, error, éxito, restore.

Análisis requerido:

- Entitlement Plus.
- Productos y precios reales.
- Gating de features.
- Receipt validation.
- Estado offline.

## Análisis Personalizados A Construir

### A. Perfil natal base

Inputs:

- Fecha de nacimiento.
- Hora de nacimiento.
- Precisión de hora.
- Lugar.
- Timezone.
- Identidad opcional.

Outputs mínimos:

- Sol.
- Luna.
- Ascendente.
- Elemento dominante si está respaldado.
- Modalidad dominante si está respaldada.
- Casas principales.
- Tabla de placements.
- Resumen editorial de 2-4 líneas.
- Aviso si la hora es desconocida.

Textos:

- Resumen de carta.
- Explicación de Sol.
- Explicación de Luna.
- Explicación de Ascendente.
- Explicación de casas.
- Tooltip o nota: qué cambia si no se conoce hora.

### B. Guía diaria Home

Inputs:

- Perfil natal.
- Fecha local del usuario.
- Timezone.
- Tránsitos relevantes.
- Estado Plus/free.
- Temas preferidos.

Outputs mínimos:

- Headline diario.
- Frase principal.
- Nivel/etiqueta de energía.
- `Hacé`.
- `Evitá`.
- `Energía`.
- `Acción`.
- CTA `Profundizar`.
- Variante free vs Plus.
- Guardar/compartir.

Textos:

- Saludo diario.
- Fecha local.
- Frase principal.
- Cuerpo corto.
- Acción concreta.
- Nota de límite: contexto, no mandato.
- Estado vacío/error si no se generó lectura.

### C. Tránsitos diarios

Inputs:

- Carta natal.
- Cielo del día.
- Fecha/timezone.

Outputs mínimos:

- Tránsito relevante.
- Punto natal afectado.
- Intensidad o prioridad editorial.
- Ventana temporal.
- Explicación corta.
- Qué mirar.
- Acción segura.

Textos:

- Título del tránsito.
- Bajada.
- `Qué activa`.
- `Cómo usarlo`.
- `No lo conviertas en`.
- CTA para ver detalle.

### D. Temas editoriales

Temas vigentes de Figma:

- Amor.
- Trabajo.
- Familia.
- Vínculos.

Temas existentes en código:

- Amor.
- Trabajo.
- Dinero.
- Energía.
- Familia.
- Decisiones.
- Claridad.
- Protección.
- Luna.

Decisión pendiente:

- Mantener Home V1 con los cuatro temas de Figma.
- Pasar el resto a Explore/futuro o integrarlos como tags secundarios.

Textos por tema:

- Título.
- Mini bajada.
- Lectura corta.
- Acción.
- Señal de desbloqueo Plus si aplica.
- Empty state si no hay lectura.

### E. Lectura larga

Inputs:

- Daily context.
- Tema del día.
- Entitlement.

Outputs:

- Título editorial.
- Bajada.
- Cuerpo largo.
- Módulo educativo.
- Acción de cierre.
- Guardar.

Textos:

- Long read diaria/semanal.
- Módulo educativo corto.
- CTA de guardado.
- Estado locked/free preview.

### F. Vínculo / compatibilidad

Inputs:

- Perfil del usuario.
- Nombre/apodo de otra persona.
- Fecha/lugar/hora opcionales.
- Signo manual fallback.

Outputs:

- Energía del usuario.
- Energía de la otra persona.
- Dinámica compartida.
- Punto de cuidado.
- Acción o pregunta.
- Nivel de precisión según datos disponibles.

Textos:

- Formulario para guardar vínculo.
- Privacidad.
- Lectura del vínculo.
- Advertencia: no mide destino ni garantiza compatibilidad.
- Error si faltan datos.
- CTA de editar/eliminar.

### G. Diario y guardadas

Textos:

- Guardar lectura.
- Lectura guardada.
- Quitar.
- Prompt de nota.
- Empty states.
- Historial por fecha.
- Mensaje de privacidad: notas personales.
- CTA para volver a lectura de hoy.

Análisis requerido:

- Asociar nota a lectura/día.
- Mantener historial remoto.

### H. Notificaciones

Textos:

- Opt-in.
- Permiso del sistema.
- Hora preferida.
- Tipos: lectura diaria, tránsito relevante, lectura larga, vínculo.
- Quiet hours si aplica.
- Mensajes push.
- Opt-out.

Análisis requerido:

- Timezone.
- Preferencias.
- Estado de permiso.
- Token de device.

### I. Perfil y ajustes

Textos:

- Datos natales editables.
- Precisión de hora.
- Suscripción.
- Restaurar compra.
- Notificaciones.
- Privacidad.
- Exportar/borrar datos.
- Cerrar sesión.
- Recalcular carta si cambian datos.

Análisis requerido:

- Invalidar snapshots si cambia birth data.
- Mantener historial o regenerar lecturas.

### J. Pago, Plus y gating

Textos:

- Beneficios Plus.
- Planes.
- Trial si existe.
- Restore.
- Error de compra.
- Cancelación.
- Estado free.
- Estado Plus activo.
- Estado vencido/cancelado.
- Locks en Home/Topics/Relationship.

Análisis requerido:

- Qué queda gratis.
- Qué se desbloquea.
- Qué se previsualiza.
- Cómo se recupera una compra.

### K. Backoffice / lab editorial

Textos internos:

- Nombre de sujeto de prueba.
- Datos normalizados.
- Gaps del modelo.
- Resultado de carta.
- Resultado de lectura diaria.
- Versiones de modelo.
- Estado de publicación de contenido.

Análisis requerido:

- Fixtures por tipo de usuario.
- Comparar outputs.
- Guardrails de contenido.
- QA editorial antes de publicar.

## Inventario De Contenido Necesario

### Static copy

- Onboarding 01-15.
- Account.
- Payment.
- Legal/disclaimers.
- Empty states.
- Errors.
- Loading states.
- Profile/settings.
- Permission screens.

### Dynamic copy by user

- Signo solar.
- Elemento/modalidad.
- Sol/Luna/Ascendente.
- Resumen natal.
- Daily headline.
- Hacé/Evitá/Energía/Acción.
- Tema del día.
- Tránsito destacado.
- Long read.
- Vínculo.
- Notificaciones.

### Editorial libraries

- Signos: 12 short reads + 12 deeper reads.
- Planetas/puntos: Sol, Luna, Ascendente, Mercurio, Venus, Marte, Júpiter, Saturno, Urano, Neptuno, Plutón.
- Casas: 12 explicaciones.
- Aspectos principales.
- Fases lunares.
- Temas: amor, trabajo, familia, vínculos; secundarios si se aprueban.
- Acciones seguras.
- Evitá seguros.
- Micro-rituales sobrios.
- Long reads.
- Push notifications.
- Paywall benefits.

## Priorización Recomendada

### P0 - Para que la app se sienta real

- Copy final de onboarding 01-15.
- Microcopy de privacidad para fecha/lugar/hora/cuenta.
- Definición de datos faltantes: sin hora, sin lugar, error de cálculo.
- Perfil natal mínimo: Sol, Luna, Ascendente.
- Home diaria: headline, frase, Hacé, Evitá, Energía, Acción.
- Payment copy y estados de compra.
- Legal/disclaimer reutilizable.
- Empty/error states.
- Backoffice/lab para probar outputs.

### P1 - Para que haya retención

- Tránsitos diarios explicados.
- Topics de Home.
- Lectura larga.
- Guardadas y diario.
- Perfil editable.
- Notificaciones.
- Vínculo básico.

### P2 - Para crecimiento futuro

- Calendario energético semanal.
- Reporte anual o mensual.
- Courses/educación.
- Social/friends.
- Nota al yo futuro.
- Widgets/share cards.
- Tarot o cartas simbólicas, solo si se decide que forma parte de Órbita y no del MVP heredado.

## Decisiones Pendientes

1. Qué motor/proveedor astrológico se usará para carta y tránsitos.
2. Si la lectura diaria será template-only, algorítmica, LLM asistida o híbrida.
3. Qué queda gratis y qué queda Plus.
4. Si `dinero`, `protección`, `luna`, `claridad`, `decisiones` siguen en producto o quedan como tags internos.
5. Si tarot/cartas simbólicas permanecen en Órbita o se retiran del core V1.
6. Cómo se habla de precisión cuando falta hora natal.
7. Si se agrega prueba gratis o solo planes semanal/anual.
8. Si habrá notificaciones desde V1 o después.
9. Si el vínculo pide datos completos de otra persona o empieza con signo/apodo.
10. Si se necesita contenido por género/pronombre o solo variaciones neutras.

## Próximo Paso Sugerido

Cerrar primero la matriz P0:

1. Onboarding final.
2. Perfil natal mínimo.
3. Home diaria.
4. Payment.
5. Estados de error/privacidad.

Después de eso conviene escribir los módulos reales de Home V1.1 antes de tocar Figma o seguir expandiendo pantallas.
