import { planAccess, type PlanAccess } from "@/domain/planAccess";
import { useEntitlement } from "@/hooks/useLiveApp";

/**
 * El plan de la cuenta vigente, para las superficies nativas que no lo reciben
 * con su propio dato (CORE-1043).
 *
 * Tránsitos, Tu momento y Vínculos NO pasan por acá: su acceso viaja en la misma
 * respuesta que el contenido (`access` de las funciones `…WithAccess`). Esto es
 * para la carta completa, que se decide antes de tener un payload que lo diga.
 *
 * Ninguna pantalla lee `useEntitlement()` por su cuenta para decidir si abre o
 * bloquea: el plan se pregunta acá, con la regla única de `@/domain/planAccess`
 * —sólo el remoto confirmado autoriza—.
 *
 * Sin provider —build sin backend— el estado offline devuelve `resolved: false`
 * y esto contesta `loading`: no hay plan que consultar, y las superficies caen
 * en sus estados de sesión de siempre en vez de mostrar un muro inventado.
 */
export function usePlanAccess(): PlanAccess {
  const { remote, resolved } = useEntitlement();
  return planAccess({ remote, resolved });
}
