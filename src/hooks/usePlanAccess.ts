import { planAccess, type PlanAccess } from "@/domain/planAccess";
import { useEntitlement } from "@/hooks/useLiveApp";

/**
 * El acceso Free/Plus de la cuenta vigente, para TODA la app nativa.
 *
 * Ninguna pantalla lee `useEntitlement()` por su cuenta para decidir si abre o
 * bloquea: el plan se pregunta acá, con la regla única de `@/domain/planAccess`
 * —sólo el remoto confirmado autoriza— y así el ciclo de datos y las pantallas
 * no pueden llegar a contestar distinto sobre la misma cuenta.
 *
 * Sin provider —build sin backend— el estado offline devuelve `resolved: false`
 * y esto contesta `loading`: no hay plan que consultar, y las superficies caen
 * en sus estados de sesión de siempre en vez de mostrar un bloqueo inventado.
 */
export function usePlanAccess(): PlanAccess {
  const { remote, resolved } = useEntitlement();
  return planAccess({ remote, resolved });
}
