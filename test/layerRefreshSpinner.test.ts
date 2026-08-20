/**
 * El spinner de "tirar para actualizar" sólo aparece si la persona tiró.
 *
 * ## El defecto, reportado por Lucas en iPhone físico (2026-08-19)
 *
 * "Cuando cambiás entre pestañas, se queda el coso cargando arriba y la
 * pantalla trabada por un rato."
 *
 * `refreshing` es el flag COMPARTIDO del ciclo de capas (uno para toda la app),
 * y `LayerScreen` lo enchufaba directo al `RefreshControl`. Cuando un recálculo
 * corre en segundo plano —volver al frente, cambio de hora civil, reintento con
 * backoff tras un fallo—, cualquier pestaña que se monte en ese momento aparece
 * con el control expandido y el contenido clavado hacia abajo hasta que el
 * recálculo termina. El recálculo llama al proveedor: puede tardar.
 *
 * ## La regla
 *
 * El control refleja `pulled` (un gesto real de la persona en ESTA pantalla),
 * nunca el flag compartido a secas. El refresh de fondo es invisible: los datos
 * viejos ya avisan con StaleNotice cuando corresponde.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { ROOT } from "./moduleGraph";

const fuente = readFileSync(join(ROOT, "src/components/v492/Screen.tsx"), "utf8");
const layer = fuente.slice(
  fuente.indexOf("export function LayerScreen"),
  fuente.indexOf("export function DetailLayerScreen")
);

describe("LayerScreen — el pull es local, el refresh de fondo es invisible", () => {
  it("existe el estado local del gesto", () => {
    assert.match(layer, /const \[pulled, setPulled\] = useState\(false\)/);
  });

  it("el RefreshControl refleja el gesto, no el flag compartido", () => {
    assert.match(layer, /refreshing=\{pulled\}/, "el spinner es del gesto");
    assert.doesNotMatch(
      layer,
      /refreshing=\{refreshing\}/,
      "el flag compartido no puede clavar el spinner de una pestaña recién montada"
    );
  });

  it("el gesto se apaga cuando el ciclo termina, no antes", () => {
    // El pull marca `pulled`; cuando el flag compartido baja DESPUÉS de haber
    // estado alto, el gesto se libera. Bajarlo sin haber visto el ciclo activo
    // haría parpadear el spinner si la cola tarda un render en marcar busy.
    assert.match(layer, /sawBusy/, "se recuerda haber visto el ciclo ocupado");
  });
});
