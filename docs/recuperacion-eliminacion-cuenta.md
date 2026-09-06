# Eliminación de cuenta — estados que quedan pendientes y cómo se recuperan

Este documento describe qué pasa cuando la eliminación de una cuenta se corta a
mitad, qué resuelve hoy la app y **qué queda pendiente de una integración
server-side que todavía no está implementada ni configurada**. La regla que
ordena todo:

> Nunca se inventa "completado". Si no hay prueba de que la identidad se borró,
> el marcador sobrevive y la app se bloquea.

## Las dos fases del marcador

El marcador local (`orbita:pending-account-deletion`) sólo puede decir dos cosas:

| Fase | Qué prueba | Quién la escribe |
|---|---|---|
| `backend_deleted` | Convex borró los datos. **La identidad de Clerk puede seguir viva.** | El cliente, después de que la mutation responde ok y ANTES de tocar Clerk |
| `identity_deleted` | `user.delete()` de Clerk respondió ok. La identidad ya no existe. | El cliente, inmediatamente después de esa respuesta |

## Qué hace el boundary con cada combinación

`PendingDeletionBoundary` envuelve la app entera (sesión, bootstrap, router).
Mientras haya marcador, nada del producto se monta.

| Marcador | Estado de Clerk | Decisión | Efecto |
|---|---|---|---|
| — | cualquiera | `proceed` | Arranque normal |
| cualquiera | sin cargar | `wait` | Espera. Cero operaciones |
| `backend_deleted` | sesión del MISMO dueño | `finalize-identity` | Reintenta `user.delete()` y persiste `identity_deleted` |
| `backend_deleted` | **sin sesión** | `needs-owner` | **Login real dentro del bloqueo. No purga, no promueve, no retira el marcador** |
| `backend_deleted` | `deleteUser` ok en este proceso, checkpoint sin escribir | `promote-checkpoint` | Reintenta SÓLO la promoción; no pide login |
| `backend_deleted` | sesión de OTRA cuenta | `blocked` | Bloqueo; se ofrece cerrar esa sesión |
| `identity_deleted` | cualquier sesión viva | `wait` / `blocked` | Espera a que el token caiga; con otra cuenta, bloquea |
| `identity_deleted` | sin sesión | `purge` | Purga local completa y retira el marcador ÚLTIMO |
| ilegible / no se pudo leer | cualquiera | `blocked` | Bloqueo; el raw se conserva intacto |

## El caso que TODAVÍA no se automatiza: `backend_deleted` + signed-out

**Estar signed-out no demuestra que Clerk se haya borrado.** Puede ser un token
expirado, un logout, un reinstall o una app sin red. Antes esto purgaba: borraba
los datos locales de una cuenta que quizás sigue existiendo y, peor, retiraba el
marcador — perdiendo la única señal para terminar la eliminación de verdad.

Resolverlo sin intervención exige preguntarle a Clerk por esa cuenta desde el
backend, y eso significa una integración server-side con la **Clerk Backend
API** y su secreto (`CLERK_SECRET_KEY`) configurado en Convex. **Todavía no está
implementada ni configurada**: incorporarla requiere autorización explícita de
Lucas y la provisión segura del secreto, sin exponerlo en el repositorio ni en
logs. Hasta que exista, **sigue siendo un bloqueo de lanzamiento** (ver "El
checkpoint que se pierde con el proceso").

Mientras tanto, y por eso mismo, el flujo no adivina: el bloqueo ofrece volver a
entrar (paso 1 de abajo), que es una acción real de la persona y no una
inferencia nuestra.

### Recuperación operativa

1. **La persona vuelve a entrar con la misma cuenta, DENTRO del bloqueo.** El
   boundary monta el flujo canónico de email + código (`SignInScreen` +
   `useSignInFlow`) con el producto desmontado y **sin** la salida "Crear una
   cuenta": una cuenta nueva conviviendo con un marcador ajeno vivo es
   exactamente lo que no puede pasar. Al reaparecer la sesión del dueño, la
   decisión pasa a `finalize-identity`, se borra la identidad, se persiste el
   checkpoint y sigue el flujo normal. Si entra OTRA cuenta, la decisión pasa a
   `blocked`, no se toca nada y se ofrece cerrar esa sesión.
2. **Si no puede entrar** (perdió el acceso al email, Clerk sigue caído), la
   pantalla ofrece escribir a soporte. Del otro lado, el procedimiento es:
   - verificar la identidad por el canal de soporte;
   - borrar la cuenta desde el dashboard de Clerk;
   - pedirle que abra la app: con la cuenta ya inexistente el login falla, y
     desinstalar/reinstalar limpia el marcador local junto con el resto del
     almacenamiento (los datos de Convex ya no existen desde el paso 1 del flujo).

### El checkpoint que se pierde con el proceso — LIMITACIÓN ABIERTA, BLOQUEA EL RELEASE

Si `user.delete()` responde ok pero escribir `identity_deleted` falla, el hecho
queda **en memoria, atado a ese dueño**: se reintenta sólo la promoción y no se
pide login (la identidad ya no existe). **Si el proceso muere antes de lograrlo,
esa memoria se pierde.** Al reiniciar, el marcador vuelve a decir
`backend_deleted` y nadie puede probar lo contrario: queda fail closed. El punto
1 tampoco sirve —la cuenta de Clerk ya no existe, así que el login no puede
funcionar—, de modo que la salida real es el punto 2, **soporte**. No hay
recuperación self-service en ese caso, y no se infiere el borrado a partir de un
signed-out.

Cerrarlo de verdad exige lo que hoy no está: una integración **server-side
durable con la Clerk Backend API**, con `CLERK_SECRET_KEY` configurado en Convex
y sin exponerlo — un job con tombstone y reintentos que pruebe de forma
idempotente que la identidad ya no existe. **No está implementado ni
configurado**, y decidirlo y configurarlo es externo a este repositorio. Hasta
entonces esta limitación es un bloqueo de lanzamiento, no una nota al pie.

No hay pérdida de datos en ninguno de los dos caminos: lo que Convex tenía ya se
borró antes de escribir el marcador.

### La valla que impide resurrección

El JWT de Clerk sigue siendo válido un rato después de borrar los datos, y con
él cualquier pantalla podía recrear la fila que se acababa de borrar. Por eso
`deleteAccountV2` escribe primero una **valla de supresión**
(`accountDeletionFences`) con la clave SHA-256 de un dominio versionado más
`identity.subject`, y `getOrCreateUser` / `requireExistingUser` la consultan
antes de escribir nada.

Precisiones, para no prometer de más: la clave es **seudónima**, no es
anonimización ni es irreversible. **No expira** y **no se borra con la cuenta**
—no forma parte de `USER_SCOPED_DELETION_STEPS`—, porque una valla que se borra
con lo que protege no protege nada.

## Qué nunca se toca

- **Snapshots de otras cuentas.** La purga borra `snapshot:<dueño del marcador>`
  y su marcador de compra; el archivo de cualquier otra cuenta en ese teléfono se
  preserva.
- **Datos locales de otro dueño.** Antes de limpiar se lee `profile-owner`: si
  está marcado con una cuenta distinta a la del marcador, la purga se niega
  (`foreign-local-data`) y se muestra soporte.
- **Un marcador inválido.** No se corrige ni se borra: no se sabe de quién es.
- **Nada en web.** En web el flujo corta en `web-unsupported`: no hay purga
  local. Decidir a partir de `localStorage` qué borrar es una carrera contra la
  propia sesión, y el precio de equivocarse es borrar datos de alguien que no
  pidió nada.
