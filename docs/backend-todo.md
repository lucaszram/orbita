# Backend Todo - Órbita

## Alcance de este análisis

Este backlog cruza tres fuentes:

- Figma inspeccionado por API: archivo `BEB5v6SbgJn2Nipm8Qa0wE`, página visible `UX V4.3 - Órbita Onboarding Copy`.
- Docs vigentes: `PROJECT_CONTEXT.md`, `CURRENT_TASK.md`, `docs/contexto-actual.md`, `docs/figma-context.md`, `docs/architecture.md`, `docs/assets-needed.md`, `docs/decision-log.md`.
- Código actual Expo/React Native: `app/`, `src/`, `supabase/schema.sql`.

Nota importante: la API de Figma sólo listó la página `UX V4.3 - Órbita Onboarding Copy`. Las páginas `UX V4.5 - Órbita App Core` y `UX V4.6 - Órbita Asset Library` están documentadas como vigentes en los markdowns, pero no aparecieron en la lista de páginas de la sesión. Para backend, Home/App Core se analiza desde `docs/figma-context.md` y `docs/assets-needed.md`.

## Estado técnico actual

- La app es Expo/React Native con Expo Router.
- La experiencia implementada venía de un MVP heredado; la marca vigente es Órbita.
- Persistencia real actual: `AsyncStorage` local para perfil, lecturas guardadas y diario.
- Convex + Clerk queda elegido como backend/auth V1. La base mínima ya existe en `convex/` y Expo la monta desde `src/services/backendProviders.tsx` cuando hay envs.
- Supabase existe como cliente opcional/legado, pero hoy sólo se usa para leer `content_templates` y `tarot_cards`; si no hay credenciales, cae a contenido local.
- `supabase/schema.sql` queda como referencia histórica; no extenderlo para la nueva base Órbita salvo que se decida revertir Convex.
- El motor actual calcula lecturas determinísticas por seed local. Calcula signo solar por fecha, pero no carta natal real, ascendente, casas, luna, aspectos ni tránsitos personalizados.
- Notificaciones actuales son locales con `expo-notifications`; no hay push tokens, campañas ni scheduling server-side.
- `app.json` ya está configurado como Órbita; bundle/package/scheme fueron renombrados para la beta local.
- Convex está linkeado localmente al dev deployment `dutiful-viper-815`; `convex/_generated/` existe localmente y las funciones ya fueron subidas al deployment dev por el usuario con `pnpm exec convex dev --once --typecheck disable`.
- Backoffice Lab V1 ya existe como ruta Expo Web `/backoffice`, con tablas Convex aisladas `labSubjects` y `labRuns`, funciones para cargar personas de prueba, correr el modelo stub, guardar ejecuciones e inspeccionar inputs/outputs/model gaps.
- El backoffice usa Clerk + allowlist server-side (`ORBITA_BACKOFFICE_ALLOWED_EMAILS` o escape hatch local `ORBITA_BACKOFFICE_ALLOW_ALL=true`). El acceso operativo elegido es iniciar sesión con `lucaszramos11@gmail.com`.
- El backoffice ahora espera `useConvexAuth()` antes de ejecutar queries/mutations, por lo que evita disparar `labSubjects`/`labRuns` antes de que Convex reciba identidad Clerk.
- Backoffice Astro Lab V1 ahora agrega proveedor AstrologyAPI server-side: acción Convex para previsualizar carta/tránsitos, normalización a payload Órbita, lectura diaria editorial P0, guardado de raw API, fixtures P0 y revisión `needs_review/approved/rejected`.
- La app de usuario sigue sin consumir este proveedor; el corte actual es sólo backend/backoffice.
- Las queries del backoffice ya no intentan crear/actualizar `users`: si el usuario Clerk está habilitado pero todavía no existe fila en `users`, `listSubjects` y `listRuns` devuelven listas vacías; la primera mutation crea/actualiza el usuario y guarda la persona.

## Corte Convex + Clerk implementado

- [x] Agregar dependencias `convex`, `@clerk/expo` y `expo-secure-store`.
- [x] Agregar envs base: `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_JWT_ISSUER_DOMAIN`.
- [x] Montar `ClerkProvider` + `ConvexProviderWithClerk` en el root layout con fallback local si no hay credenciales.
- [x] Crear `convex/auth.config.ts` para issuer Clerk.
- [x] Crear `convex/schema.ts` con `users`, `onboardingDrafts`, `birthData`, `natalCharts`, `dailyReadings`, `transitReadings`, `savedReadings`, `journalEntries`, `relationshipProfiles`, `notificationPreferences`, `devices`, `subscriptions` y `contentModules`.
- [x] Crear funciones Convex por dominio: usuario, onboarding, datos natales, carta natal stub, lecturas diarias, guardadas, diario, vínculo, suscripción stub, notificaciones, devices y módulos de contenido.
- [x] Encapsular cálculo astrológico inicial como stub versionado en `convex/lib/orbita.ts`.
- [x] Agregar tests mínimos de helpers para identidad Clerk-like, normalización de hora, signo solar, snapshot natal stub y lectura diaria estable.
- [x] Crear Backoffice Lab V1 para probar personas/modelo antes de migrarlo a la app: `/backoffice`, `labSubjects`, `labRuns`, model gaps y tests de payload estable.
- [x] Crear Backoffice Astro Lab V1: adapter AstrologyAPI, normalización de carta/tránsitos, selector de tránsitos P0, lectura editorial propia, raw API visible, fixtures y estados de revisión.

## Pendiente de conexión

- [x] Linkear el proyecto localmente a Convex dev deployment `dutiful-viper-815`.
- [x] Actualizar `.env.local` con `CONVEX_DEPLOYMENT`, `EXPO_PUBLIC_CONVEX_URL` y envs de Clerk development.
- [x] Configurar `CLERK_JWT_ISSUER_DOMAIN` y `ORBITA_BACKOFFICE_ALLOWED_EMAILS` en Convex dev.
- [x] Correr localmente `pnpm convex:codegen` o `pnpm exec convex dev --once --typecheck disable` para subir funciones al deployment.
- [x] Configurar Clerk JWT template `convex` para Convex con audience/application id `convex`.
- [ ] Migrar pantallas de `AsyncStorage` a queries/mutations Convex de forma gradual.
- [ ] Configurar credenciales reales de AstrologyAPI en Convex dev/prod y validar contra 10-20 fixtures.
- [ ] Confirmar endpoint exacto de AstrologyAPI Location API para autocomplete/lugar; por ahora el backoffice permite lat/lon/timezone manual y lookup configurable.
- [ ] Reemplazar adapters/stubs por proveedores reales en la app: geocoding/timezone, cálculo astrológico, pagos App Store/Google Play.

## Brechas críticas detectadas

1. **Auth y perfil no están conectados.** El schema usa RLS con `auth.uid() = user_profiles.id`, pero el cliente crea IDs locales tipo `nombre-fecha`, no usuarios Supabase Auth.
2. **Falta política de insert para `user_profiles`.** Aunque hubiera auth, el usuario no podría crear su perfil con las policies actuales.
3. **Faltan datos natales reales.** Figma pide fecha, lugar y hora para calcular Sol, ascendente y casas; el código sólo deriva signo solar desde fecha.
4. **Falta geocoding/timezone.** La pantalla de ciudad necesita autocomplete, coordenadas, país, zona horaria y nombre canónico.
5. **Falta cálculo astrológico server-side.** Hay que definir motor/proveedor para natal chart, tránsitos y aspectos sin hacer claims técnicos no respaldados.
6. **Falta cuenta real.** Figma muestra email, Apple y Google; el código no tiene sign-in, sesión ni recuperación.
7. **Falta pago.** Figma define planes semanal/anual, restore y entitlement Plus; no existe integración con App Store/Play Store ni webhooks.
8. **Falta sincronización.** Guardadas, diario, perfil, vínculo y preferencias viven sólo en el dispositivo.
9. **Falta content/CMS.** Hay contenido local estático y una tabla simple, pero Home V1.1 necesita módulos diarios, topics, long reads y calendario editorial.
10. **Falta observabilidad y funnel.** Onboarding + account + payment necesitan eventos, errores, conversión y abandono por pantalla.

## Mapa Figma -> Backend

### Onboarding V4.3

| Pantalla | Necesidad backend/conexión |
| --- | --- |
| `01 / Logo Splash` | Sin backend; sólo configuración de marca, assets y gating inicial de sesión/onboarding. |
| `02 / Align With Universe` | Sin backend obligatorio; registrar evento de inicio y fuente de adquisición si se implementa analytics. |
| `03 / Identify` | Guardar identidad/pronombres como preferencia opcional. Definir si afecta copy personalizado o sólo analytics. |
| `04 / Daily Guidance` | Preview estático o demo de valor. Puede usar contenido local; registrar avance. |
| `05 / Birthdate Empty` | Captura y validación de fecha. Guardar draft de onboarding. Calcular signo solar preliminar local o por API. |
| `06 / Birthdate Selected` | Confirmar fecha, signo solar y elemento. Requiere taxonomía zodiacal consistente. |
| `07 / Birthplace Search` | Autocomplete de ciudad/lugar, geocoding, país, región, lat/lon, timezone. Guardar place id/canonical name. |
| `08 / Birthplace Selected` | Confirmar lugar y explicar ascendente/casas. Persistir coordenadas y timezone, no sólo string visible. |
| `09 / Birth Time Picker` | Capturar hora/minuto + AM/PM editable. Validar formato, precisión y caso "no sé la hora" si se decide. |
| `10 / Birth Time Selected` | Confirmar hora normalizada 24h, zona horaria y precisión. |
| `11 / Your Base Chart` | Generar resumen base: fecha, lugar, hora, Sol, Luna, ascendente, casas mínimas y metadata de cálculo. |
| `12 / Personalizing` | Orquestar cálculo de carta + tránsitos + primera lectura. Necesita estados `queued/running/succeeded/failed`, retry y fallback. |
| `13 / Before After / Órbita` | Estático/comercial. Registrar impresión; cuidar que no prometa resultados garantizados. |
| `14 / Create Account` | Supabase Auth o equivalente: email, Apple, Google, link de perfil draft a usuario autenticado, recuperación de sesión. |
| `15 / Onboarding Payment / Scroll` | Productos semanal/anual, compra, restore, entitlement Plus, validación de recibos, webhooks, estado de suscripción y paywall analytics. |

### App Core / Home V1.1

Fuente: `docs/figma-context.md`, porque la página V4.5 no estuvo disponible por API en esta sesión.

| Área | Necesidad backend/conexión |
| --- | --- |
| `Home V1.1 / Top` | Endpoint o selector local/cache para "hoy": triada natal, frase principal, fecha local del usuario, CTA `Profundizar`, estado Plus. |
| `Home V1.1 / Daily Guide` | Generar/leer `Hacé`, `Evitá`, `Energía`, `Acción`; cache diario por usuario y timezone; versionar copy. |
| `Home V1.1 / Topics` | Contenido por tema: `Amor`, `Trabajo`, `Familia`, `Vínculos`; filas editoriales, desbloqueos y tracking de taps. |
| `Home V1.1 / End` | Lectura larga, módulo educativo, historial/guardadas; requiere content CMS, saved readings remoto y flags de leído/guardado. |
| `Carta` | Carta natal completa: placements, casas, aspectos, visual data para wheel/tabla y explicaciones editoriales. |
| `Tránsitos` | Tránsitos diarios personalizados contra carta natal, calendario, intensidad, explicación y acciones seguras. |
| `Vínculo` | Perfil de otra persona, compatibilidad simbólica, relación con carta propia, guardado/edición y límites de privacidad. |
| `Perfil` | Datos personales, cuenta, suscripción, notificaciones, privacidad, borrar/exportar datos, restaurar compra. |

### Asset Library V4.6

Backend runtime bajo, pero hay tareas de soporte:

- Definir manifest de assets en app: key, uso, versión, archivo local/CDN, fallback.
- Si los assets se sirven remoto, agregar storage/CDN y cache.
- Mantener separación entre assets editoriales PNG y símbolos funcionales vectoriales/editables.
- No hornear copy en imágenes; el backend debe servir contenido como texto editable/renderizable.

## Backlog priorizado

### P0 - Fundaciones obligatorias

- [x] Elegir arquitectura backend V1: Convex para backend/app data + Clerk para auth.
- [x] Crear modelo base de usuario remoto con identidad Clerk (`tokenIdentifier`, `clerkUserId`, email, nombre, locale).
- [x] Crear schema Convex inicial para:
  - `users`
  - `onboardingDrafts`
  - `birthData`
  - `natalCharts`
  - `dailyReadings`
  - `transitReadings`
  - `subscriptions`
  - `savedReadings`
  - `journalEntries`
  - `relationshipProfiles`
  - `notificationPreferences`
  - `devices`
  - `contentModules`
- [ ] Decidir si hace falta tabla/event sink para analytics o integración externa equivalente.
- [ ] Definir migración local -> remoto desde `AsyncStorage`, incluyendo keys heredadas previas al rename.
- [ ] Crear capa de servicios/hooks en app sobre Convex: `authService`, `profileService`, `onboardingDraftService`, `chartService`, `subscriptionService`, `readingService`, `journalService`.
- [ ] Normalizar tipos compartidos entre DB y TypeScript. Hoy hay desajustes de tone (`directa` vs `directo`, `protectora` vs `protector`) y topics.
- [ ] Configurar environments: local/dev/prod, `EXPO_PUBLIC_*`, secretos server-side y EAS build profiles para Órbita.

### P0 - Onboarding, cuenta y pago

- [ ] Persistir draft de onboarding pantalla por pantalla para no perder datos si la app se cierra.
- [ ] Implementar captura de identidad de `03 / Identify`, con política de privacidad y uso claro.
- [ ] Implementar date picker real para `05-06`, validación de edad/formato y cálculo preliminar de signo.
- [ ] Conectar búsqueda de lugar para `07-08`: autocomplete, selección, lat/lon, país, región, timezone, display name.
- [ ] Implementar time picker `09-10`: AM/PM editable, normalización a 24h, precisión de hora y posible `unknown_birth_time`.
- [ ] Crear cálculo de carta natal server-side o librería encapsulada: entrada `birth_date`, `birth_time`, `timezone`, `latitude`, `longitude`; salida versionada.
- [ ] Guardar `natal_chart` como snapshot versionado, no recalcular todo en cada render.
- [ ] Modelar `chart_calculation_jobs` o equivalente para `12 / Personalizing`, con estados, errores y reintentos.
- [ ] Implementar Auth para `14 / Create Account`: email, Apple, Google, sesión persistente, link de draft onboarding a cuenta.
- [ ] Definir qué pasa si el usuario crea cuenta pero no paga: estado free/locked, recuperación de draft y posibilidad de completar pago luego.
- [ ] Implementar compra de `15 / Payment`: productos `weekly` y `annual`, default anual, restore, receipt validation, entitlement Plus y estado offline.
- [ ] Crear webhooks de suscripción: compra, renovación, cancelación, expiración, refund, grace period.
- [ ] Gating Plus: carta completa, tránsitos diarios personalizados, guía profunda, vínculo/calendario si quedan pagos.

### P1 - Lecturas y contenido diario

- [ ] Diseñar contrato `daily_context` por usuario/día: natal chart id, timezone, fecha local, tránsitos relevantes, tema, energía, acciones.
- [ ] Crear generación determinística/cacheada de lectura diaria: misma persona + fecha local + versión de contenido = mismo resultado.
- [ ] Definir si las lecturas salen de plantillas editoriales, motor algorítmico, LLM asistido o híbrido. Si hay LLM, agregar cache, costos, moderation y fallback.
- [ ] Crear tabla/CMS para módulos Home:
  - headline diario
  - `Hacé`
  - `Evitá`
  - `Energía`
  - `Acción`
  - topic rows
  - long reads
  - módulos educativos
- [ ] Versionar contenido por idioma/locale, tono, topic, signo, tránsito y estado Plus.
- [ ] Agregar guardrails editoriales en backend: entretenimiento/autoconocimiento, sin salud/dinero/legal/psicología como consejo, sin determinismo.
- [ ] Crear seeds y previews para desarrollo, sin depender de producción.

### P1 - Carta, tránsitos y vínculo

- [ ] Modelar `natal_chart_placements`: planeta/punto, signo, grado, casa, retrógrado, metadata.
- [ ] Modelar `houses` y `aspects` para visualización y explicación.
- [ ] Crear API de carta: resumen triada, tabla completa, wheel data, explicaciones cortas/largas.
- [ ] Modelar tránsitos diarios contra carta natal: planeta transitante, aspecto, punto natal, orb, intensidad, fecha/hora, explicación y acción.
- [ ] Crear calendario de tránsitos y cache por usuario/timezone.
- [ ] Crear `relationship_profiles`: nombre/apodo, fecha/lugar/hora opcionales, signo manual, consentimiento/privacidad local.
- [ ] Crear cálculo de compatibilidad simbólica: signo solar fallback, carta completa si hay datos, explicación sin claims deterministas.
- [ ] Guardar historial de vínculos o limitar a uno activo según decisión producto.

### P1 - Persistencia de usuario

- [ ] Sincronizar lecturas guardadas con backend.
- [ ] Sincronizar notas de diario con backend, incluyendo edición/borrado.
- [ ] Agregar favoritos, historial leído y `last_seen_at`.
- [ ] Crear export/delete account: perfil, birth data, chart snapshots, journal, saved readings, relationship data.
- [ ] Definir retención de datos sensibles de nacimiento y borrado al cancelar/eliminar cuenta.
- [ ] Agregar manejo offline: queue de writes, conflictos y rehidratación.

### P1 - Notificaciones

- [ ] Reemplazar recordatorio puramente local por modelo de preferencias remoto.
- [ ] Guardar push tokens por device, plataforma, usuario y estado de permiso.
- [ ] Programar recordatorios por timezone del usuario.
- [ ] Definir copy de notificaciones por evento: lectura diaria, tránsito relevante, lectura larga, renovación/payment si aplica.
- [ ] Crear opt-in/opt-out por tipo, quiet hours y borrado de token al logout.

### P1 - Analytics y funnel

- [ ] Instrumentar onboarding por pantalla: view, continue, back, skip, validation error.
- [ ] Instrumentar lugar/hora/carta: search started, place selected, chart calculation started/succeeded/failed.
- [ ] Instrumentar cuenta: email submit, OAuth start/success/fail.
- [ ] Instrumentar payment: paywall view, plan selected, purchase start/success/fail, restore start/success/fail, entitlement active.
- [ ] Instrumentar Home/App Core: topic tap, profundizar, save, journal note, share, subscription gate.
- [ ] Agregar crash/error reporting para cálculo, auth, pago y geocoding.

### P2 - CMS, assets y operaciones

- [x] Crear backoffice/lab mínimo para personas de prueba, modelo stub, lectura diaria y gaps antes de llevarlo a la app.
- [ ] Crear admin/CMS mínimo para contenido editorial: daily modules, topics, long reads, legal copy, paywall inclusions.
- [ ] Crear workflow de publicación con estados `draft/review/published/archived`.
- [ ] Crear validaciones de contenido prohibido antes de publicar.
- [ ] Gestionar assets con manifest: `asset_key`, `type`, `local_path`, `remote_url`, `version`, `usage`, `fallback`.
- [ ] Si se usa storage remoto, subir assets seleccionados a bucket/CDN y mantener cache/local fallback.
- [ ] Crear dashboard operativo: usuarios, conversiones, suscripciones, errores de cálculo, jobs fallidos.
- [ ] Crear scripts de seed/migration/rollback para Supabase.

## Schema sugerido para una primera migración

No es SQL final, sino mapa de entidades:

- `profiles`: `user_id`, `display_name`, `identity`, `locale`, `created_at`, `updated_at`.
- `birth_data`: `user_id`, `birth_date`, `birth_time`, `birth_time_precision`, `birth_place_label`, `place_id`, `latitude`, `longitude`, `timezone`, `source`.
- `natal_charts`: `id`, `user_id`, `birth_data_id`, `calculation_version`, `placements_json`, `houses_json`, `aspects_json`, `summary_json`, `created_at`.
- `daily_readings`: `id`, `user_id`, `local_date`, `timezone`, `natal_chart_id`, `content_version`, `payload_json`, `created_at`.
- `transit_readings`: `id`, `user_id`, `local_date`, `payload_json`, `created_at`.
- `subscriptions`: `user_id`, `provider`, `product_id`, `entitlement`, `status`, `current_period_end`, `original_transaction_id`, `updated_at`.
- `saved_readings`: `id`, `user_id`, `reading_id`, `reading_date`, `reading_payload`, `created_at`.
- `journal_entries`: `id`, `user_id`, `reading_id`, `note`, `created_at`, `updated_at`.
- `relationship_profiles`: `id`, `user_id`, `name`, `birth_date`, `birth_time`, `birth_place`, `zodiac_sign`, `created_at`, `updated_at`.
- `notification_preferences`: `user_id`, `enabled`, `daily_time`, `timezone`, `topics`, `updated_at`.
- `devices`: `id`, `user_id`, `platform`, `push_token`, `permission_status`, `last_seen_at`.
- `content_modules`: `id`, `kind`, `topic`, `zodiac_sign`, `transit_type`, `entitlement`, `locale`, `title`, `body`, `action`, `status`, `version`.

## Integraciones externas a decidir

- Backend principal: Convex.
- Auth: Clerk, con email, Apple Sign In y Google Sign In a configurar en dashboard.
- Pagos: Apple App Store + Google Play Billing, con capa de gestión de suscripciones o validación propia.
- Geocoding/autocomplete: proveedor de lugares + timezone.
- Cálculo astrológico: librería o servicio encapsulado server-side, con versión y tests contra fixtures.
- Push: Expo Push Notifications o APNs/FCM directo.
- Analytics/crash: proveedor a definir.
- Email: magic links/transaccionales si no alcanza lo incluido por el backend elegido.
- Storage/CDN: assets editoriales y posibles previews remotos.

## Corte MVP recomendado

Para que Órbita sea usable y pagable sin sobrediseñar backend:

1. Auth + perfil remoto + draft onboarding.
2. Lugar/hora normalizados con geocoding/timezone.
3. Cálculo natal mínimo: Sol, Luna, ascendente, casas básicas y snapshot.
4. Pago semanal/anual + entitlement Plus + restore.
5. Home diaria cacheada por usuario/día con módulos `Hacé/Evitá/Energía/Acción`.
6. Guardadas/diario remoto básico.
7. Perfil con edición de datos, suscripción, notificaciones y borrar cuenta.

Todo lo demás puede crecer después, pero sin esos siete puntos la Figma actual no se puede implementar como producto real.
