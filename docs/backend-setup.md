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
http://localhost:8081/backoffice
```

## Resultado esperado

- Si faltan envs, `/backoffice` muestra un estado de setup.
- Si Clerk está configurado pero no hay sesión, muestra login web de Clerk.
- Si Clerk inició sesión pero Convex todavía no confirmó identidad, muestra `Conectando Convex` o `Falta conectar Clerk con Convex`.
- Si el email está allowlisted, muestra el lab para crear personas, correr el modelo stub e inspeccionar runs.
- Si AstrologyAPI está configurado, `Correr proveedor astrológico` guarda un run con carta/tránsitos reales normalizados.
- Si AstrologyAPI no está configurado, el mismo botón guarda fallback stub con gaps explícitos para no bloquear el QA del lab.
