# API Astrologica Y Laboratorio - Orbita

Fecha: 2026-07-04

## Resumen Corto

Orbita usa primero un laboratorio interno en `/backoffice` para probar calculos astrologicos antes de llevarlos a la app.

La decision actual es:

- Proveedor de calculo: AstrologyAPI, desde Convex/server.
- Texto final: propio de Orbita.
- Uso en app publica: bloqueado hasta revisar outputs del lab.
- Astrologia inicial: occidental tropical.
- Sistema de casas inicial: Placidus.
- Framing de producto: entretenimiento, autoconocimiento y contexto diario.

Estado actual del lab:

- El backoffice ya guarda personas de prueba y runs.
- El caso `Lucas prueba` quedo guardado con `1996-11-11`, `10:48`, `Buenos Aires, Argentina`, `America/Argentina/Buenos_Aires`.
- La corrida guardo fallback porque faltan credenciales de AstrologyAPI en Convex.
- Gap visible actual: `astrologyapi_credentials_not_configured`.

## Fuentes

- AstrologyAPI Western Chart Data: https://astrologyapi.com/western-api-docs/api-ref/163/western_chart_data
- AstrologyAPI Natal Chart Interpretation: https://astrologyapi.com/western-api-docs/api-ref/192/natal_chart_interpretation
- AstrologyAPI Natal Transits Daily: https://astrologyapi.com/western-api-docs/api-ref/200/natal_transits/daily
- AstrologyAPI Geo Location API: https://astrologyapi.com/products/geo-location-api
- Implementacion local: `convex/lib/astrologyApi.ts`
- Normalizacion/editorial local: `convex/lib/orbita.ts`
- Backoffice UI: `src/components/backoffice/BackofficeLab.tsx`
- Runbook: `docs/backend-setup.md`

## Como Entra Un Usuario Al Calculo

Datos que necesitamos pedir o resolver:

- Fecha de nacimiento.
- Hora de nacimiento.
- Precision de hora: `known`, `approximate`, `unknown`.
- Lugar de nacimiento visible para la persona.
- Latitud.
- Longitud.
- Timezone IANA.
- Fecha local de lectura diaria.

Ejemplo actual para el lab:

```json
{
  "birthDate": "1996-11-11",
  "birthTime": "10:48",
  "birthTimePrecision": "known",
  "birthPlaceLabel": "Buenos Aires, Argentina",
  "latitude": -34.6037,
  "longitude": -58.3816,
  "timezone": "America/Argentina/Buenos_Aires",
  "localDate": "2026-07-04"
}
```

Request que el adapter arma para AstrologyAPI:

```json
{
  "day": 11,
  "month": 11,
  "year": 1996,
  "hour": 10,
  "min": 48,
  "lat": -34.6037,
  "lon": -58.3816,
  "tzone": -3,
  "house_type": "placidus"
}
```

Si la hora es desconocida, el adapter usa `12:00` como fallback tecnico para poder calcular, pero marca el warning:

```text
unknown_birth_time_uses_noon_fallback_for_provider_call
```

## Lista 1 - Lo Que Trae La API

### 1. Geo Location API

Uso previsto:

- Autocomplete de ciudad/lugar en onboarding.
- Resolver lugar visible a coordenadas y timezone.
- Evitar que el usuario cargue lat/lon manualmente.

Segun la documentacion, puede traer:

- Nombre/localidad.
- Coordenadas con precision de 4 decimales.
- Timezone IANA.
- UTC offset.
- Cobertura de ciudades, barrios, suburbios, distritos y pueblos.
- Datos compatibles con los endpoints astrologicos.

Estado en nuestro codigo:

- Existe `resolvePlaceWithAstrologyApi`.
- Todavia falta confirmar/configurar `ASTROLOGY_API_LOCATION_URL`.
- Mientras tanto, el backoffice permite cargar lat/lon/timezone manualmente.

### 2. `natal_chart_interpretation`

Endpoint:

```text
POST https://json.astrologyapi.com/v1/natal_chart_interpretation
```

Input:

- `day`
- `month`
- `year`
- `hour`
- `min`
- `lat`
- `lon`
- `tzone`
- `house_type`

Trae principalmente:

- Planetas/puntos.
- Grado completo.
- Grado dentro del signo.
- Velocidad.
- Retrogradacion.
- Signo.
- Casa.
- Casas con signo y grado.

Campos relevantes para Orbita:

- Sol: signo, grado, casa.
- Luna: signo, grado, casa.
- Mercurio, Venus, Marte: signo, grado, casa.
- Jupiter, Saturno, Urano, Neptuno, Pluton.
- Nodo, Quiron, Parte de Fortuna si decidimos usarlos.
- Casas 1 a 12.
- Ascendente derivado de casa 1.

Como lo normalizamos hoy:

```ts
placements: NormalizedAstroPlacement[]
houses: NormalizedAstroHouse[]
summary.sun
summary.moon
summary.ascendant
```

### 3. `western_chart_data`

Endpoint:

```text
POST https://json.astrologyapi.com/v1/western_chart_data
```

Input:

- Mismo input natal: fecha, hora, lat/lon, timezone, sistema de casas.

Trae principalmente:

- Casas astrologicas.
- Inicio y fin de cada casa.
- Signo de cada casa.
- Planetas ubicados dentro de casas.
- Aspectos planetarios.
- Tipo de aspecto.
- Planetas involucrados.
- Orbe.
- Diferencia angular.

Campos relevantes para Orbita:

- Casas principales: 1, 4, 7, 10.
- Planetas dentro de casas.
- Aspectos mayores:
  - conjuncion,
  - oposicion,
  - cuadratura,
  - trigono,
  - sextil.
- Orbe para ordenar importancia.

Como lo normalizamos hoy:

```ts
aspects: NormalizedAstroAspect[]
summary.mainAspects
```

El codigo filtra aspectos mayores y ordena por orbe para elegir los mas relevantes.

### 4. `natal_transits/daily`

Endpoint:

```text
POST https://json.astrologyapi.com/v1/natal_transits/daily
```

Input:

- Mismo set base de fecha/hora/lugar/timezone/casas.

Trae principalmente:

- Fecha de transito.
- Ascendente.
- Lista de relaciones de transito.
- Planeta en transito.
- Planeta o punto natal activado.
- Tipo de aspecto.
- Inicio, exacto y fin de ventana.
- Retrogradacion.
- Signo del transito.
- Casa natal.
- Otros planetas involucrados en signos.

Campos relevantes para Orbita:

- Transito destacado del dia.
- Planeta que transita.
- Punto natal activado.
- Aspecto.
- Casa natal.
- Ventana temporal.
- Si esta retrogrado.
- Signo del transito.

Como lo normalizamos hoy:

```ts
transits: NormalizedAstroTransit[]
selectedTransits
highlightedTransit
```

El codigo calcula una prioridad simple para elegir 1 a 3 transitos relevantes. Pesa:

- planeta en transito,
- punto natal,
- aspecto,
- si hay exact time.

Nota pendiente:

- Validar con AstrologyAPI el alcance exacto de fecha de `natal_transits/daily`.
- El adapter hoy marca el warning `natal_transits_daily_endpoint_date_scope_needs_provider_verification` para no vender ese resultado como cerrado sin QA.

## Lista 2 - Lo Que Tiene Que Hacer Orbita Encima

La API calcula datos. Orbita tiene que decidir lectura, tono, seleccion, limites y experiencia.

### 1. Normalizar Datos

Tenemos que convertir respuestas del proveedor a un formato propio:

- `NormalizedAstroPlacement`
- `NormalizedAstroHouse`
- `NormalizedAstroAspect`
- `NormalizedAstroTransit`
- `NormalizedAstroChart`

Esto evita que la app dependa directamente del formato de AstrologyAPI.

### 2. Elegir Que Mostrar

No todo lo que trae la API debe verse.

P0 recomendado:

- Sol.
- Luna.
- Ascendente.
- Mercurio.
- Venus.
- Marte.
- Casas 1, 4, 7 y 10.
- Aspectos mayores con menor orbe.
- Transito destacado del dia.
- 1 a 3 transitos secundarios.

P1/P2:

- Jupiter/Saturno como lectura de ciclo.
- Urano/Neptuno/Pluton como fondo lento.
- Nodo/Quiron solo si editorialmente tiene sentido.
- Compatibilidad/vinculos.
- Calendario de dias.

### 3. Decidir Estados Segun Calidad Del Dato

Casos que el lab debe dejar visibles:

- Falta hora natal.
- Hora aproximada.
- Coordenadas faltantes.
- Timezone no IANA.
- Provider sin credenciales.
- Provider con error.
- Transitos vacios.
- Resultado pendiente de revision editorial.

Gaps actuales:

```text
astrologyapi_credentials_not_configured
editorial_review_required_before_app_release
```

### 4. Crear Texto Propio

No queremos copiar interpretaciones de la API como texto final.

Orbita necesita una biblioteca propia para:

- 12 signos.
- 10 planetas/puntos base.
- 12 casas.
- 5 aspectos mayores.
- Combinaciones planeta-signo.
- Combinaciones planeta-casa.
- Combinaciones transito-planeta natal-aspecto.
- Variantes por tema: amor, trabajo, familia, vinculos.
- Acciones seguras.
- Evita seguros.
- Disclaimers cortos y largos.
- Estados de error/carga/dato incompleto.

### 5. Generar Lectura Diaria

P0 actual del backend:

- `headline`
- `do`
- `avoid`
- `energy`
- `action`
- `topics`
- `longRead`
- `guardrails`

Ejemplo cuando hay transito destacado:

```text
{planeta en transito} en {aspecto} con tu {punto natal}: contexto para mirar el dia sin apurarlo.
```

Ejemplo fallback actual:

```text
Tu cielo de hoy pide una lectura simple.
```

### 6. Guardrails Editoriales

Reglas obligatorias:

- No determinismo.
- No prometer destino.
- No dar consejo de salud, dinero, legal o psicologico.
- No afirmar resultados garantizados en amor/trabajo.
- Mantenerlo como entretenimiento, autoconocimiento y contexto.
- Usar voseo argentino, breve y editorial.

Guardrails guardados en payload:

```json
[
  "entretenimiento_y_autoconocimiento",
  "no_determinismo",
  "no_salud_dinero_legal_psicologia_como_consejo"
]
```

### 7. Revisar En Backoffice Antes De App

El backoffice debe permitir:

- Cargar persona de prueba.
- Ver input normalizado.
- Ver request enviada.
- Ver provider/raw.
- Ver carta normalizada.
- Ver lectura editorial.
- Ver gaps.
- Marcar run:
  - `needs_review`
  - `approved`
  - `rejected`

Nada pasa a la app publica hasta tener outputs aprobados.

## Endpoints Configurados En Nuestro Adapter

Archivo:

```text
convex/lib/astrologyApi.ts
```

Variables server/Convex:

```bash
ASTROLOGY_API_USER_ID
ASTROLOGY_API_KEY
ASTROLOGY_API_BASE_URL=https://json.astrologyapi.com/v1
ASTROLOGY_API_LANGUAGE=en
ASTROLOGY_API_HOUSE_SYSTEM=placidus
ASTROLOGY_API_LOCATION_URL
```

Llamadas actuales:

```ts
postAstrologyApi(config, "natal_chart_interpretation", prepared.request)
postAstrologyApi(config, "western_chart_data", prepared.request)
postAstrologyApi(config, "natal_transits/daily", prepared.request)
```

Autenticacion:

- Basic Auth con `ASTROLOGY_API_USER_ID` + `ASTROLOGY_API_KEY`.
- Nunca exponer credenciales como `EXPO_PUBLIC`.
- Todo corre del lado Convex/server.

## Que Vimos En La Prueba De Lucas

Input cargado:

```json
{
  "birthDate": "1996-11-11",
  "birthPlaceLabel": "Buenos Aires, Argentina",
  "birthTime": "10:48",
  "birthTimePrecision": "known",
  "latitude": -34.6037,
  "longitude": -58.3816,
  "modelInputWarnings": [],
  "timezone": "America/Argentina/Buenos_Aires"
}
```

Resultado:

- Run creado.
- Provider status: `not_configured`.
- Chart version: `orbita-stub-v1+provider-not_configured`.
- Daily reading version: `orbita-daily-stub-v1`.
- Sol por fallback local: `escorpio`.
- Luna: pendiente.
- Ascendente: pendiente.
- Casas: pendiente.
- Aspectos: pendiente.
- Transitos: pendiente.

Esto confirma que el flujo del lab funciona, pero falta configurar credenciales reales de AstrologyAPI para obtener carta y transitos reales.

## Orden Optimo Desde Aca

1. Configurar credenciales AstrologyAPI en Convex dev.
2. Confirmar `ASTROLOGY_API_LOCATION_URL`.
3. Rerun de `Lucas prueba`.
4. Crear 10-20 perfiles fixture.
5. Revisar raw de:
   - carta natal,
   - aspectos,
   - casas,
   - tránsitos diarios.
6. Ajustar normalizacion si el raw real difiere de la doc.
7. Cerrar selector de transitos relevantes.
8. Escribir biblioteca editorial P0.
9. Aprobar/rechazar outputs en backoffice.
10. Recién despues conectar app publica.

## Decisiones Pendientes

- Confirmar si usamos siempre Placidus o damos sistema de casas configurable en backoffice.
- Confirmar si el idioma de API queda `en` para datos estables o `es` para lectura raw.
- Confirmar endpoint exacto y contrato de Location API.
- Confirmar comportamiento exacto de `natal_transits/daily` por fecha.
- Definir si Plus tendra reportes extra, calendario, vinculos o profundidad de lectura.
- Definir politica de retencion de raw provider data.

