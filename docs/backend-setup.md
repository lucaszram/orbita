# Backend Setup - Convex + Clerk

## Estado

El código de backend y backoffice ya está en el repo. Clerk está linkeado a la app `Orbita`, `.env.local` tiene las credenciales de development, y Convex apunta al deployment `dutiful-viper-815`.

El usuario ya corrió `pnpm exec convex dev --once --typecheck disable`, por lo que las funciones del backoffice están publicadas en el deployment dev. Si se editan archivos en `convex/`, hay que volver a correr ese comando localmente para sincronizar.

El acceso del backoffice quedó decidido como Clerk-only con allowlist de email. El shortcut de código interno quedó removido del flujo activo.

## Convex

Desde la raíz del proyecto, correr localmente:

```bash
pnpm exec convex dev --once --typecheck disable
```

Ese comando sincroniza `convex/` con el deployment de desarrollo y termina de publicar las funciones del backoffice.

Cada vez que cambien archivos en `convex/`, incluyendo el proveedor astrológico o el schema del lab, hay que volver a correr ese comando.

## AstrologyAPI

El proveedor astrológico vive sólo del lado server/Convex. No usar variables `EXPO_PUBLIC` para estas credenciales.

Variables de Convex dev:

```bash
pnpm exec convex env set ASTROLOGY_API_USER_ID "<user_id>"
pnpm exec convex env set ASTROLOGY_API_KEY "<api_key>"
pnpm exec convex env set ASTROLOGY_API_BASE_URL "https://json.astrologyapi.com/v1"
pnpm exec convex env set ASTROLOGY_API_LANGUAGE "en"
pnpm exec convex env set ASTROLOGY_API_HOUSE_SYSTEM "placidus"
```

`ASTROLOGY_API_LOCATION_URL` queda opcional hasta tener el endpoint exacto de Location API para la cuenta. Sin esa variable, el lookup de lugar del backoffice muestra estado `not_configured`, pero se pueden cargar lat/lon/timezone manualmente.

`ASTROLOGY_API_LONG_RANGE_URL` queda opcional/futuro hasta confirmar con AstrologyAPI un endpoint de rango o forecast que devuelva ventanas largas confirmadas: inicio, exacto, fin, frecuencia y próximas ocurrencias. Órbita no debe inventar con LLM frases tipo `vuelve en 2027` o `dura hasta marzo`; esas fechas tienen que venir del proveedor o de un motor astronómico explícito aprobado.

El backoffice llama primero a AstrologyAPI desde una acción Convex y guarda:

- input normalizado,
- request enviada,
- carta normalizada,
- respuesta raw,
- tránsitos normalizados,
- lectura editorial P0,
- gaps y estado de revisión.

## Clerk

Clerk CLI ya fue inicializado con:

```bash
clerk init --app app_3G2mZM0b44zGplJmkpwPFuamFYG
```

También quedó creado el JWT template `convex` para Convex:

- `name`: `convex`
- `aud`: `convex`
- claims incluidos: `email`, `name`, `given_name`, `family_name`, `picture`

Si `/backoffice` muestra una sesión Clerk pero Convex dice `Authentication required`, cerrar sesión desde `Cambiar cuenta` y volver a entrar con `lucaszramos11@gmail.com` para forzar un token nuevo.

Si `/backoffice` muestra `e.db.insert is not a function`, el navegador ya está autenticado correctamente pero el deployment de Convex todavía tiene una versión vieja del helper de backoffice. Correr de nuevo:

```bash
pnpm exec convex dev --once --typecheck disable
```

Si se recrea la app de Clerk o cambia el issuer, confirmar en Clerk:

- Habilitar email para entrar al backoffice.
- Mantener el JWT template `convex` con audience/application id `convex`.
- Actualizar `CLERK_JWT_ISSUER_DOMAIN` en Convex si el issuer cambió.

## Acceso

`/backoffice` usa Clerk y allowlist por email. Para entrar, iniciar sesión con `lucaszramos11@gmail.com`.

Variable de Convex dev:

```bash
pnpm exec convex env set ORBITA_BACKOFFICE_ALLOWED_EMAILS lucaszramos11@gmail.com
```

## Lab público-dev

`/lab` usa acciones Convex públicas-dev sin sesión para cargar datos natales, previsualizar la Home diaria, generar copy con Vercel AI Gateway si está configurado, y ver timelines de tránsitos extendidos. Queda apagado por defecto.

Variables de Convex dev:

```bash
pnpm exec convex env set ORBITA_PUBLIC_LAB_ENABLED true
pnpm exec convex env set ORBITA_PUBLIC_LAB_KEY "<codigo-opcional>"
```

Si `ORBITA_PUBLIC_LAB_KEY` queda vacío, alcanza con `ORBITA_PUBLIC_LAB_ENABLED=true`. Si se define una key, la web debe enviar ese código desde el campo `Código lab`.

El lab no guarda usuarios, sujetos, runs ni lecturas. Para guardar, revisar y aprobar contenido sigue existiendo `/backoffice`. El raw completo de proveedor tampoco vuelve por `/lab`; queda reservado para `/backoffice`.

### AI Gateway para copy del lab

Convex sigue siendo el backend principal; Vercel se usa para Gateway, budget, modelo y observabilidad.

Variables de Convex dev:

```bash
pnpm exec convex env set ORBITA_LLM_ENABLED true
pnpm exec convex env set AI_GATEWAY_API_KEY "<ai_gateway_key>"
pnpm exec convex env set ORBITA_LLM_MODEL "<provider/model>"
pnpm exec convex env set ORBITA_LLM_DAILY_PROMPT_VERSION "orbita-lab-daily-home-llm-v1"
pnpm exec convex env set ORBITA_LLM_DAILY_CACHE_VERSION "orbita-llm-daily-cache-v1"
pnpm exec convex env set ORBITA_LLM_NATAL_PROMPT_VERSION "orbita-natal-profile-llm-v1"
pnpm exec convex env set ORBITA_LLM_NATAL_CACHE_VERSION "orbita-natal-profile-cache-v1"
```

Si falta `ORBITA_LLM_ENABLED=true`, la key o el modelo, `/lab` vuelve a templates determinísticos y agrega gaps explícitos sin gastar tokens. Las llamadas de Gateway salen con tags `feature:orbita-lab`, `env:dev`, `user:lab`.

La Home diaria usa `dailyLlmReadings` como cache objetivo por usuario + fecha + timezone + promptVersion. Las interpretaciones natales tipo `Amor y relaciones`, `Tu suerte` y `Mapa de valores` usan `natalInterpretations` por usuario + carta natal + feature + promptVersion.

### Tránsitos extendidos

`/lab` puede normalizar:

- `natal_transits/weekly`
- `tropical_transits/weekly`
- `tropical_transits/monthly`

El default recomendado para probar costo bajo es `natal_transits/weekly`. El resultado público devuelve eventos normalizados (`startTime`, `exactTime`, `endTime`, planeta transitante, punto natal, aspecto, casa, prioridad y texto de display) y no devuelve raw completo.

Para timeline largo, el contrato público devuelve `longRangeTimeline` con estado `needs_provider_endpoint`. El backend espera un endpoint de rango/forecast antes de mostrar textos tipo `esto pasa una vez al año`, `hasta marzo` o `vuelve en 2027`.

### Cache de app mobile

El cache vive en Convex, no en memoria del lab:

- `natalCharts` / `profileAstrologyCaches`: carta natal y datos normalizados por perfil/birthData.
- `natalInterpretations`: interpretaciones natales LLM por feature + promptVersion.
- `dailyReadings` / `dailyLlmReadings`: Home diaria por usuario + fecha + timezone + version.
- `transitTimelineCaches`: timeline semanal/mensual/largo por usuario + periodo + providerVersion.
- `globalSkyCaches`: cielo global diario reutilizable por todos.

`/lab` sigue sin escribir en estas tablas; sólo muestra el contrato y los datos de preview. La app móvil y `/backoffice` son los que tienen que persistir cuando pasemos a flujo real.

### Contrato visual para frontend

`previewDailyHome` y `previewCompleteHoroscope` devuelven `chartWheelData` para que el frontend dibuje la rueda con SVG/canvas sin pedir otra API: grados absolutos, casas, aspectos, colores/estilos de línea, labels y hints de renderer.

También devuelven `valueRadar`, calculado en backend sobre la carta natal cacheable:

- armonía: trígonos y sextiles,
- estrés: cuadraturas y oposiciones,
- restricciones: Saturno, casas activadas por Saturno y aspectos duros.

La fórmula está versionada como `orbita-value-radar-v1`.

## Expo

`.env.local` ya fue creado por Clerk/Convex. No imprimirlo ni commitearlo.

Luego correr:

```bash
pnpm typecheck
pnpm test
pnpm exec expo start --web
```

Abrir:

```text
http://localhost:8081/lab
http://localhost:8081/backoffice
```

## Resultado esperado

- Si faltan envs, `/backoffice` muestra un estado de setup.
- Si `/lab` está apagado en Convex, muestra error de lab deshabilitado al generar.
- Si `/lab` genera Home con LLM y Gateway está configurado, muestra `llm.status=success`; si falta config o hay 402/429/error, mantiene la Home template y agrega gaps explícitos.
- Si `/lab` genera timeline, muestra próximos eventos normalizados; el raw de AstrologyAPI no vuelve en la respuesta pública.
- Si Clerk está configurado pero no hay sesión, muestra login web de Clerk.
- Si Clerk inició sesión pero Convex todavía no confirmó identidad, muestra `Conectando Convex` o `Falta conectar Clerk con Convex`.
- Si el email está allowlisted, muestra el lab para crear personas, correr el modelo stub e inspeccionar runs.
- Si AstrologyAPI está configurado, `Correr proveedor astrológico` guarda un run con carta/tránsitos reales normalizados.
- Si AstrologyAPI no está configurado, el mismo botón guarda fallback stub con gaps explícitos para no bloquear el QA del lab.
