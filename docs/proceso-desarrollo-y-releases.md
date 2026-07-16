# Proceso de desarrollo y releases de Órbita

Este documento define cómo trabajan Lucas, Codex y Claude sin mezclar cambios ni poner producción en riesgo. Es la fuente de verdad operativa para tareas, ramas, Pull Requests, ambientes, TestFlight y releases.

`WORKFLOW.md` sigue siendo la fuente de verdad técnica sobre territorios y contrato Convex. Este documento agrega el proceso de integración, revisión y publicación.

## 1. Principio central

**Un objetivo, una rama, un PR.**

Un PR debe poder explicarse en una frase y revisarse sin reconstruir una semana de trabajo. Si aparecen dos objetivos independientes, se separan aunque pertenezcan a la misma iniciativa.

Ejemplos correctos:

- `fix(auth): evita bloqueo al iniciar Clerk`
- `feat(home): agrega historial de siete cartas`
- `contract(void): define args y returns de void.ask`
- `docs(workflow): documenta proceso de PR y releases`

Ejemplos que deben dividirse:

- arreglar login + rediseñar Home + actualizar Expo;
- cambiar contrato Convex + implementar backend + rehacer tres pantallas;
- limpiar assets + cambiar configuración EAS + publicar producción.

Una tarea grande se convierte en una secuencia de PRs chicos con un orden explícito.

## 2. Estado actual: recuperación técnica completa, promoción pendiente

Al 2026-07-16 Convex de producción y los dominios Clerk están operativos, y los PRs #6, #7 y #8 forman la nueva línea base de código en `main`. Esto no significa que exista una nueva versión móvil publicada.

- `main` puede recibir features y fixes puntuales, revisados y reversibles;
- mergear un PR no autoriza ni ejecuta un deploy;
- producción, EAS y App Store permanecen sin cambios hasta aprobar un Release Candidate;
- no se publica una OTA ni se envía una versión al App Store sin una prueba real en TestFlight;
- antes del próximo build se verifican variables EAS, versión/build, checks automáticos, smoke tests y rollback;
- cada fix de incidente debe dejar evidencia y, cuando corresponda, un test de regresión.

Congelar producción significa preservar la versión distribuida mientras el trabajo continúa de forma controlada en `main`.

## 3. Roles y territorios

### Codex — backend

- Dueño de `convex/**`.
- Único agente que corre codegen o comandos de desarrollo/deploy de Convex.
- Mantiene `convex/_generated/**` y `convex/CHANGELOG.md`.
- No modifica `app/**` ni `src/**`.

### Claude — frontend

- Dueño de `app/**`, `src/**` y `assets/**`.
- Implementa la experiencia Expo/React Native y la evidencia visual.
- No corre Convex codegen/dev y no modifica funciones backend.

### Lucas — producto y release captain

- Define prioridad y criterios de aceptación.
- Valida que la experiencia resuelva lo pedido.
- Aprueba la promoción final a producción.
- No necesita auditar cada línea: revisa alcance, evidencia, checks y resultado en TestFlight.

### Revisor técnico

- Trabaja en modo lectura.
- Comprueba alcance, riesgos, archivos inesperados, contrato y cobertura de pruebas.
- No aprovecha la revisión para agregar otra feature al mismo PR.

## 4. Territorio compartido y archivos sensibles

Estos archivos no pertenecen exclusivamente a un agente y requieren explicación explícita en el PR:

- `package.json` y `pnpm-lock.yaml`;
- `app.json` y `eas.json`;
- `app/_layout.tsx`;
- archivos de autenticación, pagos o sesión;
- `convex/schema.ts`;
- configuración de build, CI o release;
- variables de entorno y credenciales.

Nunca se commitean secretos ni valores reales de `.env`. Los PRs solo pueden documentar nombres de variables o usar placeholders seguros.

## 5. Ficha obligatoria antes de trabajar

Toda tarea comienza con este contrato breve, en el issue, plan o `CURRENT_TASK.md`:

```md
Objetivo:
Criterios de aceptación:
Owner: Codex | Claude
Territorio permitido:
Commit base:
Cambio de contrato: sí | no
Riesgo: bajo | medio | alto
Plan de pruebas:
Plan de rollout:
Plan de rollback:
Fuera de alcance:
```

Si durante la implementación cambia el objetivo, el agente debe detenerse y decidir si corresponde actualizar la ficha o abrir otra tarea/PR.

## 6. Flujo diario

1. Leer `PROJECT_CONTEXT.md`, `CURRENT_TASK.md`, `docs/contexto-actual.md`, `WORKFLOW.md` y este documento.
2. Confirmar worktree, branch y `git status`.
3. Escribir la ficha de tarea y el criterio de aceptación.
4. Crear una rama desde una base limpia y actualizada.
5. Implementar solamente el objetivo acordado.
6. Ejecutar verificaciones proporcionales al riesgo.
7. Revisar el diff completo antes de commitear.
8. Actualizar `CURRENT_TASK.md` si cambió estado, decisión o handoff.
9. Abrir un PR usando el template del repo.
10. Corregir feedback sin ampliar el alcance.
11. Mergear solamente con checks verdes y aprobación correspondiente.

No se trabaja directamente sobre `main`. El checkout de integración no es un lugar para acumular trabajo sin commitear.

## 7. Ramas y commits

Nombres recomendados:

```text
feat/<tema>
fix/<tema>
contract/<tema>
docs/<tema>
chore/<tema>
release/<version>
hotfix/<tema>
```

Los commits deben ser intencionales. No se mezclan cambios de contrato con implementación, ni limpieza general con una feature.

Antes del PR:

- la rama debe estar actualizada con `main`;
- el worktree no debe tener archivos requeridos sin trackear;
- los archivos generados necesarios deben estar incluidos;
- el diff debe contener solamente el objetivo declarado.

Como guía, si un PR supera aproximadamente 10 archivos o 400 líneas no generadas, el autor debe explicar por qué no puede dividirse. No es un límite rígido: importa más la coherencia que el número.

## 8. Cambios de contrato Convex

El contrato es `convex/schema.ts` más los validators `args` y `returns` de las funciones públicas.

Orden obligatorio:

1. PR de contrato aislado.
2. Entrada en `convex/CHANGELOG.md`.
3. Revisión de impacto frontend/backend.
4. Implementación backend.
5. Integración frontend.

Mientras existan versiones anteriores instaladas, el backend debe mantener compatibilidad. Las migraciones destructivas se hacen por fases:

1. agregar forma nueva compatible;
2. migrar datos/consumidores;
3. observar adopción;
4. retirar la forma anterior en otro release.

## 9. Contenido obligatorio del PR

La descripción debe responder, en lenguaje entendible:

- qué problema resuelve;
- qué cambió;
- qué quedó fuera;
- qué archivos o áreas toca;
- cómo se probó;
- qué riesgo tiene;
- cómo se vuelve atrás;
- qué evidencia puede revisar Lucas.

Un PR no está listo si la descripción dice solamente “listo”, “fix” o “varios cambios”.

## 10. Tres niveles de revisión

### Automática

Debe terminar cubriendo instalación reproducible, typecheck, tests, export iOS, validación de territorio, secretos/configuración sensible y contrato Convex.

### Técnica

El revisor busca archivos fuera de alcance, comportamiento inseguro, estados incompletos, incompatibilidades, falta de regresión y ausencia de rollout/rollback.

### Producto

Lucas responde:

1. ¿Entiendo qué cambia?
2. ¿Es lo que pedí?
3. ¿Los archivos/áreas modificados tienen sentido?
4. ¿Los checks están verdes?
5. ¿Lo vi funcionando en evidencia o TestFlight?

Si alguna respuesta es “no”, el PR todavía no se mergea.

## 11. Niveles de riesgo

### Bajo

Documentación, copy aprobado o cambio visual aislado sin lógica ni contrato. Requiere checks básicos y evidencia visual cuando corresponda.

### Medio

Lógica de una pantalla, cache, navegación, nueva query o cambio aditivo de contrato. Requiere tests, estados completos y prueba en staging.

### Alto

Auth, pagos, onboarding, arranque, persistencia, migraciones, variables de entorno, EAS, Clerk, Convex prod u OTA. Requiere rollback, TestFlight, smoke tests y aprobación explícita de Lucas.

## 12. Ambientes objetivo

| Ambiente | Cliente | Backend/Auth | Uso |
|---|---|---|---|
| Desarrollo | simulador/dev client | Convex dev + Clerk test | trabajo diario |
| Staging | build interno/TestFlight | Convex staging + Clerk staging/test | integración y QA |
| Producción | RC en TestFlight; luego App Store | Convex prod + Clerk live | usuarios reales |

TestFlight es un canal de distribución, no un ambiente. Un build de TestFlight puede apuntar a staging o a producción.

El build de staging no se convierte en productivo. Desde el mismo commit validado se genera un Release Candidate con configuración productiva. Ese RC se prueba en TestFlight y, si pasa, **el mismo binario** se selecciona para App Store.

```text
Build 11 → staging → TestFlight grupo Staging
Build 12 → staging corregido → TestFlight grupo Staging
Build 13 → producción → TestFlight grupo Release Candidate
Build 13 → mismo binario → App Store
```

## 13. Flujo de release

El merge y el deploy son decisiones separadas.

1. Los PRs chicos entran a `main` con checks verdes.
2. `main` se valida en staging; no publica producción automáticamente.
3. Se corta `release/x.y.z` desde un commit verde.
4. Solo entran fixes necesarios para ese release.
5. Se prueba un build staging completo.
6. Backend productivo recibe cambios compatibles y, si corresponde, apagados por feature flag.
7. Se genera un RC contra producción.
8. Se prueba en TestFlight: arranque fresco, invitado, auth, Home, funciones críticas y logout.
9. Lucas aprueba.
10. El mismo build se publica en App Store.
11. Se monitorea y documenta el resultado.

No se publica producción desde un worktree sucio, una rama personal o un commit no identificable.

## 14. Checklist mínimo de release

- [ ] Commit y build exactos identificados.
- [ ] Worktree limpio.
- [ ] Typecheck, tests y export iOS verdes.
- [ ] Contrato compatible con la versión pública anterior.
- [ ] Variables requeridas verificadas sin imprimir secretos.
- [ ] Clerk TLS/issuer/JWKS saludables.
- [ ] Convex tiene funciones y smoke tests verdes.
- [ ] Backup reciente antes de migraciones.
- [ ] Sin controles `TESTING`, mocks ni labs públicos accidentales.
- [ ] Staging probado.
- [ ] RC productivo probado en TestFlight.
- [ ] Rollback escrito.
- [ ] Aprobación explícita de Lucas.

## 15. Modo incidente

1. Detener features y releases no relacionados.
2. Declarar un owner del incidente.
3. Registrar síntomas, alcance y hora.
4. Priorizar restaurar servicio sobre mejorar arquitectura.
5. Hacer cambios mínimos y reversibles.
6. Verificar producción con smoke tests.
7. Documentar causa raíz.
8. Agregar el check/test que habría evitado la repetición.
9. Recién entonces retomar el roadmap.

Un hotfix no habilita a mezclar “ya que estamos” con otras mejoras.

## 16. Handoff obligatorio

```md
Estado: completo | parcial | bloqueado
Branch y commit:
Qué cambió:
Qué no cambió:
Pruebas ejecutadas:
Evidencia:
Riesgos conocidos:
Rollback:
Próximo paso exacto:
```

El siguiente agente debe poder continuar leyendo archivos del repo, sin depender de una conversación anterior.

## 17. Implementación gradual

1. ✅ Documentación + template de PR.
2. ⏳ CI básico: typecheck, tests y export.
3. ⏳ Protección de `main` y validación de territorios.
4. ⏳ Staging y smoke tests.
5. ⏳ TestFlight automatizado con aprobación manual.
6. ⏳ Monitoreo, backups y rollback practicado.

Cada etapa debe quedar funcionando antes de sumar la siguiente.
