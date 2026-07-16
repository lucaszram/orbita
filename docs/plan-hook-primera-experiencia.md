# Plan canónico — primera experiencia y hábito diario

Estado vigente: 2026-07-16.

Este documento ordena lo que ya entró en `main` y lo que todavía falta. El checkpoint `wip/first-day-double-delivery-20260715` (`3eaf3a4`) conserva el historial visual detallado, pero no es una rama para mergear ni copiar en bloque.

## Orden de producto

El orden aprobado sigue siendo **B → A → C → D**:

- B: primer día y doble entrega.
- A: recordatorio configurable.
- C: historial y utilidad de Void.
- D: compartir, pulido y decisiones pendientes.

Cada bloque se divide en PRs chicos por pantalla o comportamiento.

## B — Primer día y doble entrega

### Integrado en `main`

- Recepción de la carta natal en `/recepcion`.
- Home con ritual de carta diaria.
- Reveal de una carta por día.
- Tira/Diario con historial diario.
- Protecciones para no mostrar mocks de carta natal en cuentas reales.
- Estados de sesión, reconexión y caché corregidos.
- Backend con carta determinística, reveal irreversible y fecha según timezone natal.

Integración: PR #7 (`22d8036`) + PR #8 (`1c36896`).

### Pendiente

- Carta natal: bloque de primera visita `QUÉ ES` y revisión visual completa contra Figma.
- Verificación humana del flujo integrado de primer día de punta a punta.
- Decidir si el mazo definitivo usa 22 arcanos mayores o 78 cartas. El backend actual trabaja con 22.
- Definir si habrá un control interno para repetir la experiencia de primer día; no debe aparecer en producción para usuarios.

## A — Recordatorio configurable

Objetivo: permitir elegir la hora del recordatorio antes de pedir el permiso nativo de notificaciones.

Pendiente:

- copy exacto y estructura de pantalla;
- selector de hora;
- persistencia de preferencia;
- solicitud del permiso iOS después de guardar la elección;
- estados de permiso rechazado, pendiente y concedido;
- pruebas de cambio de timezone y horario de verano.

## C — Void: historial y utilidad

Pendiente:

- persistir consultas y respuestas necesarias para el historial;
- pantalla de historial;
- feedback simple `¿Te sirvió?`;
- conversión segura de invitado a cuenta sin perder contenido local;
- contrato backend separado antes de implementar frontend.

## D — Compartir y pulido

Pendiente:

- compartir una carta/lectura con una pieza visual controlada;
- revisar los estados `Próximamente` y decidir cuáles siguen existiendo;
- pulido visual de Carta, Tránsitos, Luna y Perfil en PRs separados;
- Perfil: centrar fecha y hora en la primera línea y ciudad en una segunda línea, sin tocar lógica ni datos.

El bloqueo antiguo del splash quedó resuelto en el PR #6: las puertas de entrada son estáticas y el video es un overlay descartable, por lo que no vuelve a formar parte de este plan.

## Criterio de terminado por PR

Un cambio de este plan está terminado cuando:

1. tiene un objetivo único;
2. el diff contiene solo archivos necesarios;
3. typecheck y tests relevantes pasan;
4. hay evidencia visual si cambia UI;
5. se explican riesgos y rollback;
6. Lucas valida el comportamiento cuando requiere criterio de producto;
7. merge y publicación se tratan como decisiones separadas.
