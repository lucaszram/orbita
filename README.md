# Órbita

> Contexto actual para nuevos threads: antes de tocar diseno, copy, codigo o Figma, leer primero [`docs/contexto-actual.md`](docs/contexto-actual.md).

Este repositorio contiene una app Expo/React Native creada en una etapa anterior del proyecto. Puede haber nombres, copies y decisiones viejas en el codigo o en docs heredados. La direccion vigente del producto es **Órbita**.

## Documentos de contexto

- [`AGENTS.md`](AGENTS.md): instrucciones de arranque para nuevos threads de Codex.
- [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md): memoria estable del proyecto.
- [`CURRENT_TASK.md`](CURRENT_TASK.md): estado vivo y handoff para continuar trabajo.
- [`docs/contexto-actual.md`](docs/contexto-actual.md): fuente de verdad del producto vigente.
- [`docs/figma-context.md`](docs/figma-context.md): Figma vigente, paginas y flujo actual `01-15`.
- [`docs/ritmo-trabajo.md`](docs/ritmo-trabajo.md): como trabajar sin desordenar copy, Figma o pantallas.
- [`docs/decision-log.md`](docs/decision-log.md): decisiones tomadas y contexto historico.
- [`docs/assets-needed.md`](docs/assets-needed.md): reglas de assets, slots y naming.
- [`docs/architecture.md`](docs/architecture.md): mapa tecnico de la app y carpetas principales.
- [`docs/figma-map.md`](docs/figma-map.md): mapa viejo, mantenido solo como referencia historica.

## Estado tecnico heredado

La implementación actual nació como un MVP con un nombre anterior. Ese nombre ya no es la marca vigente. Si una pantalla, archivo o constante contradice los docs actuales, tomar los docs de Órbita como prioridad y tratar el código como material a migrar.

El MVP tecnico incluye:

- Onboarding de 8 pasos heredado.
- Home diaria con mensaje, fecha, signo, energia, recomendacion, color, numero, carta, transito y accion.
- Calendario energetico semanal.
- Lectura semanal por signo.
- Transitos actuales traducidos a acciones.
- Vinculo amoroso con compatibilidad y tarjeta para compartir.
- Pick-a-card diario.
- Tarjetas compartibles.
- Diario con lecturas guardadas, notas personales y favoritos.
- Perfil con preferencias, tono de guia, datos de nacimiento, notificaciones y aviso de entretenimiento/autoconocimiento.
- Motor deterministico: mismo usuario + fecha + intereses = misma lectura del dia.
- Adaptador preparado para Supabase, con fallback local para probar sin backend.

## Primer uso tecnico

```bash
pnpm install
pnpm start
```

Para iOS o Android:

```bash
pnpm ios
pnpm android
```

## Supabase

La V1 tecnica funciona con datos locales. Para conectar Supabase, completar `extra.supabaseUrl` y `extra.supabaseAnonKey` en `app.json`, o usar variables `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

Hay un esquema inicial en `supabase/schema.sql`. Tablas incluidas:

- `content_templates`: `id`, `kind`, `zodiac_sign`, `topic`, `tone`, `title`, `body`, `action`, `created_at`.
- `tarot_cards`: `id`, `name`, `arcana`, `keywords`, `meaning`, `ritual`.
- `weekly_energy_days`: calendario semanal editable.
- `transit_events`: transitos y alertas.
- `share_card_templates`: plantillas de tarjetas compartibles.
- `saved_readings`: `id`, `user_id`, `date`, `reading_payload`, `note`, `created_at`.
- `user_profiles`: `id`, `name`, `birth_date`, `birth_time`, `birth_place`, `interests`, `guidance_tone`, `relationship_target`, `notification_time`, `created_at`.

## Seguridad de contenido

Los textos deben formularse como reflexion, entretenimiento y autoconocimiento. No reemplazan consejo medico, legal, financiero ni psicologico.
