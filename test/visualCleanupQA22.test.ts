import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { importsOf, resolveModule, ROOT } from "./moduleGraph";

/**
 * QA22 — la pasada VISUAL del build 22, fijada como estructura.
 *
 * Son tres arreglos de forma y una regresión que ninguno de ellos puede pisar:
 *
 * - **QA22-006** — el bloque de plan del Perfil NATIVO pasó al sistema V4.9.2
 *   (tipografías, tokens, `PrimaryButton`, `Touchable`) y sus acciones quedaron
 *   agrupadas por lo que deciden: ACTIVAR contrata, GESTIONAR toca un cobro vivo
 *   y RESTAURAR recupera una compra ya hecha. Mezcladas en una columna, la que
 *   se tocaba por error era siempre la comercial.
 * - **QA22-007** — el paywall nombra los siete capítulos entre lo que abre Plus:
 *   se vendían y no figuraban en la lista.
 * - **QA22-030** — la carta completa dejó de ser una pila de tarjetas: lo normal
 *   —datos, ejes, posiciones, contactos, casas, cómo se calculó— vive en una
 *   columna editorial y la `Card` queda para lo excepcional.
 * - **QA22-022** — el borrado de cuenta (App Review) no se movió ni se diluyó en
 *   la limpieza: sigue en el Perfil, con doble confirmación y marcador en disco.
 *
 * No se puede renderizar React Native en node, así que se valida la ESTRUCTURA
 * del fuente, igual que `perfilAppReview.test.ts`. Los regex son estrictos en lo
 * que afirman y tolerantes con el formato: espacios, saltos de línea y
 * comentarios no cambian ninguna respuesta.
 */

/** Escapa un literal para poder usarlo como marca dentro de un regex. */
const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const marca = (m: string | RegExp) => (typeof m === "string" ? new RegExp(escapar(m)) : m);

/** Primera posición de `re` a partir de `desde`, o -1. */
function indiceDe(fuente: string, re: RegExp, desde = 0): number {
  const encontrado = fuente.slice(desde).search(re);
  return encontrado === -1 ? -1 : desde + encontrado;
}

/** El texto entre dos marcas, diciendo cuál faltó cuando no aparece. */
function tramo(fuente: string, desde: string | RegExp, hasta: string | RegExp): string {
  const inicio = indiceDe(fuente, marca(desde));
  assert.ok(inicio !== -1, `falta la marca de apertura: ${desde}`);
  const fin = indiceDe(fuente, marca(hasta), inicio + 1);
  assert.ok(fin !== -1, `falta la marca de cierre: ${hasta}`);
  return fuente.slice(inicio, fin);
}

const cuantas = (fuente: string, re: RegExp) => (fuente.match(re) ?? []).length;

/** Los nombres que un archivo importa de un módulo concreto (sin `type`). */
function nombresImportados(fuente: string, spec: string): string[] {
  const encontrado = fuente.match(
    new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*"${escapar(spec)}"`)
  );
  if (!encontrado) throw new Error(`falta el import de ${spec}`);
  return encontrado[1]
    .split(",")
    .map((nombre) => nombre.trim().replace(/^type\s+/, ""))
    .filter(Boolean);
}

/** El módulo que Metro elige para NATIVO detrás de un alias `@/`. */
function entradaNativa(spec: string): string {
  const archivo = resolveModule(path.join(ROOT, "src/screens/PerfilScreen.tsx"), spec, "native");
  if (!archivo) throw new Error(`Metro no resuelve ${spec} para nativo`);
  return archivo;
}

/**
 * Una rama CON DATOS de un ternario del JSX, fijada por sus tres bordes.
 *
 * Afirma dos cosas de una: que el caso exitoso lo envuelve la columna editorial,
 * y que la `Card` del tramo —si la hay— vive del otro lado del corte, que es
 * donde se explica lo que falta. Preguntarle al módulo entero no sirve: casi
 * todos tienen una `Card` legítima en la rama vecina, y contestaría que sí.
 */
function ramaConDatos(
  nombre: string,
  fuente: string,
  condicion: RegExp,
  envoltorio: RegExp,
  alternativa: RegExp
) {
  const abre = indiceDe(fuente, condicion);
  assert.ok(abre !== -1, `${nombre}: no encontré la condición ${condicion}`);
  const corte = indiceDe(fuente, alternativa, abre + 1);
  assert.ok(corte !== -1, `${nombre}: no encontré dónde empieza la alternativa`);
  const envuelve = indiceDe(fuente, envoltorio, abre);
  assert.ok(
    envuelve !== -1 && envuelve < corte,
    `${nombre}: el caso con datos tiene que ir en la columna editorial`
  );
  const card = indiceDe(fuente, /<Card\b/, abre);
  assert.ok(card === -1 || card > corte, `${nombre}: la Card no puede envolver el caso con datos`);
}

const leer = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

// El bloque de plan es POR PLATAFORMA: la variante web conserva Stripe y el kit
// legado a propósito. Lo que se fija acá es la NATIVA, resuelta como la
// resolvería el bundler y no por una ruta escrita a mano.
const MANAGE_PATH = entradaNativa("@/components/orbita/ManageSubscription");
const MANAGE = readFileSync(MANAGE_PATH, "utf8");
const MANAGE_IMPORTS = importsOf(MANAGE_PATH);
const PERFIL = leer("src/screens/PerfilScreen.tsx");
const PAYWALL = leer("src/screens/v492/PlusPaywallScreen.tsx");
const CARTA = leer("src/screens/v492/CartaCompletaV492Screen.tsx");

/** El cuerpo del bloque ACTIVO: de los flags de salida hasta el primer helper. */
const MANAGE_ACTIVA = tramo(MANAGE, "const lifetime = view ===", "function PlanBlock(");

describe("QA22-006 · el plan del Perfil nativo habla V4.9.2", () => {
  it("Metro resuelve el bloque NATIVO, no la variante web", () => {
    assert.equal(
      path.relative(ROOT, MANAGE_PATH),
      "src/components/orbita/ManageSubscription.tsx",
      "el test tiene que estar mirando el bloque nativo"
    );
  });

  it("no queda nada del kit legado ni del tema `orbita`", () => {
    // `importsOf` borra comentarios antes de mirar: un import comentado no
    // cuenta como dependencia, y uno vivo no se salva por estar en otra línea.
    assert.equal(
      MANAGE_IMPORTS.includes("@/components/orbita/kit"),
      false,
      "el bloque nativo no puede volver al kit legado"
    );
    assert.equal(
      MANAGE_IMPORTS.some((spec) => spec.startsWith("@/theme/")),
      false,
      "el tema `orbita` es del lienzo viejo: acá manda `v492`"
    );
    assert.doesNotMatch(MANAGE, /\borbita\.(colors|spacing|fonts|radius)\b/);
  });

  it("dibuja con las piezas del sistema V4.9.2", () => {
    for (const spec of [
      "@/components/v492/typography",
      "@/components/v492/tokens",
      "@/components/v492/States",
      "@/components/v492/Touchable"
    ]) {
      assert.ok(MANAGE_IMPORTS.includes(spec), `falta el import de ${spec}`);
    }
    assert.ok(nombresImportados(MANAGE, "@/components/v492/States").includes("PrimaryButton"));
    assert.ok(nombresImportados(MANAGE, "@/components/v492/Touchable").includes("Touchable"));
    assert.ok(nombresImportados(MANAGE, "@/components/v492/tokens").includes("v492"));
    const tipografia = nombresImportados(MANAGE, "@/components/v492/typography");
    for (const pieza of ["Body", "Divider", "Eyebrow", "Label", "Note"]) {
      assert.ok(tipografia.includes(pieza), `falta \`${pieza}\` de la tipografía V4.9.2`);
    }
  });

  it("el bloque se rotula TU PLAN, con su filete arriba", () => {
    const planBlock = tramo(MANAGE, "function PlanBlock(", "function ActionGroup(");
    assert.match(planBlock, /<Divider\b/);
    assert.match(planBlock, /<Eyebrow>TU PLAN<\/Eyebrow>/);
    assert.equal(cuantas(MANAGE, /TU PLAN/g), 1, "un solo rótulo de sección para el plan");
  });

  it("las acciones van agrupadas por lo que deciden: ACTIVAR, GESTIONAR y RESTAURAR", () => {
    const actionGroup = tramo(MANAGE, "function ActionGroup(", "function PlanLoading(");
    assert.match(actionGroup, /<Label>\{label\}<\/Label>/, "el grupo lleva su rótulo mono");
    for (const rotulo of ["ACTIVAR", "GESTIONAR", "RESTAURAR"]) {
      assert.match(
        MANAGE,
        new RegExp(`<ActionGroup\\s+label="${rotulo}"`),
        `falta el grupo ${rotulo}`
      );
    }
  });

  it("ACTIVAR existe UNA vez y sólo en la rama free", () => {
    assert.equal(cuantas(MANAGE, /<ActionGroup\s+label="ACTIVAR"/g), 1);
    const free = tramo(MANAGE, 'if (view === "free") {', "const lifetime = view ===");
    assert.match(free, /<ActionGroup\s+label="ACTIVAR"/);
    assert.match(free, /label="ACTIVAR ÓRBITA PLUS"/);
    assert.match(free, /router\.push\("\/paywall"\)/);
    // Con el acceso ya activo, ofrecer la compra otra vez es el camino al
    // segundo cargo: la rama activa no vuelve a nombrarla.
    assert.doesNotMatch(MANAGE_ACTIVA, /<ActionGroup\s+label="ACTIVAR"/);
    assert.doesNotMatch(MANAGE_ACTIVA, /router\.push\("\/paywall"\)/);
  });

  it("RESTAURAR es su propio grupo y nunca cuelga de GESTIONAR", () => {
    // Dos: la rama free y la activa. Restaurar recupera una compra hecha, así
    // que existe en las dos y en ninguna contrata nada.
    assert.equal(cuantas(MANAGE, /<ActionGroup\s+label="RESTAURAR"/g), 2);
    assert.equal(cuantas(MANAGE, /<RestoreAction\b/g), 2);
    const gestionar = tramo(MANAGE, /<ActionGroup\s+label="GESTIONAR">/, "</ActionGroup>");
    assert.doesNotMatch(gestionar, /<RestoreAction\b/, "restaurar no gestiona nada");
    const cierre = indiceDe(MANAGE_ACTIVA, /<\/ActionGroup>/);
    const restaurar = indiceDe(MANAGE_ACTIVA, /<ActionGroup\s+label="RESTAURAR">/);
    assert.ok(cierre !== -1 && restaurar > cierre, "RESTAURAR abre DESPUÉS de cerrar GESTIONAR");
  });

  it("los objetivos táctiles salen del token y el bloqueo se ANUNCIA", () => {
    assert.doesNotMatch(
      MANAGE,
      /minHeight:\s*\d/,
      "el alto mínimo sale de `v492.touch`, no de un número suelto"
    );
    for (const clave of ["loading", "secondary", "supportLink"]) {
      assert.match(
        MANAGE,
        new RegExp(`${clave}:\\s*\\{[^}]*minHeight:\\s*v492\\.touch`),
        `\`${clave}\` tiene que llegar al objetivo táctil del sistema`
      );
    }
    // Un botón que existe y no responde, sin decirlo, es una trampa con lector
    // de pantalla: bloqueado se anuncia bloqueado y baja a texto apagado.
    const restore = tramo(MANAGE, "function RestoreAction(", "function SupportLink(");
    assert.match(restore, /const\s+disabled\s*=/);
    for (const condicion of [/!ready/, /"restoring"/, /"opening"/]) {
      assert.match(restore, condicion, "el bloqueo mira identidad y acción en vuelo");
    }
    assert.match(restore, /disabled=\{disabled\}/);
    assert.match(restore, /accessibilityRole="button"/);
    assert.match(restore, /accessibilityLabel=\{label\}/);
    assert.match(restore, /accessibilityHint="/);
    assert.match(restore, /accessibilityState=\{\{\s*disabled\s*\}\}/);
    assert.match(restore, /disabled\s*\?\s*styles\.secondaryTextOff\s*:\s*styles\.secondaryText/);
    // Y las salidas de GESTIONAR también: ocupadas o con el comercio apagado
    // quedan bloqueadas en vez de tirar.
    assert.match(MANAGE_ACTIVA, /disabled=\{busy\}/);
    assert.match(MANAGE_ACTIVA, /disabled=\{busy\s*\|\|\s*commerceEnabled !== true\}/);
    assert.match(MANAGE_ACTIVA, /accessibilityHint="Abre la gestión de tu suscripción en la tienda"/);
    assert.match(MANAGE_ACTIVA, /accessibilityHint="Abre el portal de facturación web"/);
  });

  it("la lógica de dueño, marcador y reconciliación sigue intacta", () => {
    // La pasada era VISUAL. Lo que decide plata —de quién es el plan, si hay una
    // compra sin confirmar y a quién se le pide la reparación— no se toca.
    for (const pieza of [
      "useEntitlement()",
      "nativeSubscriptionManagement(entitlement)",
      "createOwnerGates()",
      "gates.for(clerkOwner)",
      "runExclusive(gate",
      "ownerRef.current",
      "storeOwnerRef.current",
      "publishOwnedValue(",
      "readOwnedValue(",
      "backendConfirmsStorePurchase(entitlement)",
      "entitlementBelongsTo(entitlement, storeOwner)",
      "storePurchaseGuard(dueñoTienda, Date.now())",
      "clearPurchaseGuard(",
      "requestStoreReconcile",
      "reconcile({})"
    ]) {
      assert.ok(MANAGE.includes(pieza), `se perdió \`${pieza}\` en la limpieza visual`);
    }
  });
});

describe("QA22-006 · el Perfil monta UN solo bloque de plan, en su lugar", () => {
  const CUENTA = tramo(PERFIL, "function AccountSignedIn({", "const styles = StyleSheet.create(");

  it("hay exactamente un `ManageSubscriptionBlock`, dentro de `AccountSignedIn`", () => {
    assert.match(
      PERFIL,
      new RegExp(
        'import\\s*\\{[^}]*ManageSubscriptionBlock[^}]*\\}\\s*from\\s*"@/components/orbita/ManageSubscription"'
      )
    );
    // Dos bloques serían dos lecturas del mismo entitlement con sus dos salidas
    // a la gestión; y montado fuera de `AccountSignedIn` pediría el plan de
    // nadie —o el de la cuenta anterior— sin sesión firmada.
    assert.equal(cuantas(PERFIL, /<ManageSubscriptionBlock\b/g), 1);
    assert.equal(cuantas(CUENTA, /<ManageSubscriptionBlock\b/g), 1);
    assert.match(CUENTA, /<ManageSubscriptionBlock\s*\/>/, "es autocerrado: no recibe hijos");
  });

  it("el orden de lectura es identidad → plan → acciones, con la destructiva última", () => {
    // La suscripción es parte de la identidad de la cuenta —qué plan tenés,
    // dónde se gestiona—, no una acción: va con el email y ANTES del corte.
    const arranque = CUENTA.indexOf("<Body bone>{auth.name");
    assert.ok(arranque !== -1, "falta el arranque del render de la cuenta");
    const render = CUENTA.slice(arranque);
    let previo = -1;
    for (const hito of [
      '{auth.name ?? auth.email ?? "Tu cuenta"}',
      "<ManageSubscriptionBlock />",
      "ACCIONES DE CUENTA",
      "Cerrar sesión",
      "Eliminar mi cuenta"
    ]) {
      const donde = render.indexOf(hito);
      assert.ok(donde !== -1, `falta "${hito}" en AccountSignedIn`);
      assert.ok(donde > previo, `"${hito}" quedó fuera de orden en AccountSignedIn`);
      previo = donde;
    }
  });
});

describe("QA22-007 · el paywall nombra los capítulos entre lo que abre Plus", () => {
  const BENEFICIOS = tramo(PAYWALL, "Qué abre Plus", "</View>");

  it("`Qué abre Plus` lista exactamente cuatro beneficios", () => {
    assert.equal(cuantas(BENEFICIOS, /<Benefit\b/g), 4);
    assert.equal(
      cuantas(PAYWALL, /<Benefit\b/g),
      4,
      "no hay beneficios sueltos fuera de la tarjeta"
    );
  });

  it("el capítulo nuevo entra con su literal exacto y una sola vez", () => {
    // Se vendían siete capítulos y la lista no los nombraba: quien miraba el
    // paywall no podía saber que la compra los abría.
    assert.equal(cuantas(PAYWALL, /7 capítulos personalizados de Tu carta, explicada/g), 1);
    assert.match(
      PAYWALL,
      /<Benefit\s+text="7 capítulos personalizados de Tu carta, explicada"\s*\/>/
    );
  });

  it("los otros tres beneficios siguen intactos", () => {
    for (const texto of [
      "Las doce casas de tu carta natal.",
      "Los aspectos entre los puntos de tu carta.",
      "Cinco preguntas por día en El Umbral, en vez de tres."
    ]) {
      assert.match(
        PAYWALL,
        new RegExp(`<Benefit\\s+text="${escapar(texto)}"`),
        `falta el beneficio "${texto}"`
      );
    }
  });
});

describe("QA22-030 · la carta completa es una columna editorial, no una pila de cajas", () => {
  it("`EditorialList` y `EditorialRows` separan filas con el filete del sistema", () => {
    const react = nombresImportados(CARTA, "react");
    for (const pieza of ["Children", "Fragment"]) {
      assert.ok(react.includes(pieza), `falta \`${pieza}\` para armar la columna`);
    }
    for (const [helper, hasta] of [
      ["EditorialList", "function EditorialRows("],
      ["EditorialRows", "function CartaCompletaContent("]
    ] as const) {
      const cuerpo = tramo(CARTA, `function ${helper}({ children }`, hasta);
      // Aplanar es lo que hace que una fila condicional no deje un filete
      // colgando ni abra la lista con una línea suelta.
      assert.match(cuerpo, /Children\.toArray\(children\)/, `${helper} tiene que aplanar sus hijos`);
      assert.match(cuerpo, /filas\.length === 0/, `${helper} sin filas no dibuja nada`);
      assert.match(
        cuerpo,
        /index\s*>\s*0\s*\?\s*<Divider\s*\/>\s*:\s*null/,
        `${helper} separa con un Divider de verdad, no con un margen`
      );
    }
  });

  it("los datos natales y `Cómo se calculó` son pares rótulo/valor en la columna", () => {
    for (const [nombre, desde, hasta] of [
      ["datos natales", 'module="Tus datos natales y su precisión"', "<Label>TUS EJES</Label>"],
      ["cómo se calculó", 'module="Cómo se calculó"', "</Section>"]
    ] as const) {
      const modulo = tramo(CARTA, desde, hasta);
      assert.match(modulo, /<EditorialRows>/, `${nombre} tiene que usar EditorialRows`);
      assert.match(modulo, /<DataRow\b/, `${nombre} sigue siendo una tabla de pares`);
      assert.doesNotMatch(modulo, /<Card\b/, `${nombre} no puede volver a encajonarse`);
    }
  });

  it("ejes, posiciones, contactos y casas se listan; la `Card` queda para lo que falta", () => {
    ramaConDatos(
      "ejes publicados",
      tramo(CARTA, "<Label>TUS EJES</Label>", "--- Las diez posiciones"),
      /chart\.access\.angles\s*\?\s*\(/,
      /<EditorialList\b/,
      /\)\s*:\s*\(/
    );

    // Las diez posiciones no tienen rama: siempre se muestran, y en la columna.
    const posiciones = tramo(CARTA, 'module="Tus diez posiciones"', "--- Tu carta, explicada");
    assert.match(posiciones, /<EditorialList\b/);
    assert.doesNotMatch(posiciones, /<Card\b/);

    ramaConDatos(
      "contactos publicados",
      tramo(CARTA, "--- Los contactos mayores", "--- Las doce casas"),
      /contactos\.length > 0\s*\?\s*\(/,
      /<EditorialList\b/,
      /\)\s*:\s*\(/
    );

    ramaConDatos(
      "doce casas",
      tramo(CARTA, "--- Las doce casas", "--- Cómo se calculó"),
      /chart\.access\.houses\s*\?\s*\(/,
      /<EditorialList\b/,
      /\)\s*:\s*natalHousesAccess/
    );
  });

  it("la `Card` sigue viva donde hay un estado o una acción que despegar", () => {
    // Lo excepcional es justamente lo que tiene que salirse de la columna: el
    // cálculo en curso, el que no se pudo publicar, la parte que falta y lo
    // cerrado por plan —cada uno con su explicación y, si corresponde, su botón.
    for (const [helper, hasta] of [
      ["Calculando", "function SinCalculo("],
      ["SinCalculo", "function FalloDeRecuperacion("],
      ["FaltaCalculo", "function EditorialList("],
      ["PlusBlock", "function introRueda("]
    ] as const) {
      const cuerpo = tramo(CARTA, `function ${helper}(`, hasta);
      assert.match(cuerpo, /<Card>/, `${helper} conserva su caja`);
    }
  });
});

describe("QA22-022 · el borrado de cuenta no se movió ni se diluyó", () => {
  it("el Perfil sigue pidiendo la eliminación con doble confirmación", () => {
    assert.match(
      PERFIL,
      new RegExp(
        'import\\s*\\{[^}]*requestAccountDeletion[^}]*\\}\\s*from\\s*"@/domain/accountDeletion"'
      )
    );
    assert.match(PERFIL, /await requestAccountDeletion\(/);
    assert.equal(cuantas(PERFIL, /askConfirm\(\{/g), 2, "son DOS confirmaciones, no una");

    const borrado = tramo(PERFIL, "async function handleDeleteAccount()", "return (");
    // El aviso comercial va en la PRIMERA, con tiempo de salir a cancelar:
    // borrar la cuenta no detiene el cobro.
    assert.match(borrado, /title: "Eliminar tu cuenta"/);
    assert.match(
      borrado,
      /message: `\$\{DELETE_ACCOUNT_WARNING\}\\n\\n\$\{DELETE_ACCOUNT_SUBSCRIPTION_WARNING\}`/
    );
    assert.match(borrado, /confirmLabel: "Continuar"/);
    assert.match(borrado, /title: "¿Eliminar definitivamente\?"/);
    assert.match(
      borrado,
      /message: "Última confirmación: tu cuenta y tus datos se borran para siempre\."/
    );
    assert.match(borrado, /confirmLabel: "Eliminar mi cuenta"/);
    assert.match(borrado, /destructive:\s*true/);
  });

  it("el lock, el marcador y la entrega del control siguen en su sitio", () => {
    assert.match(PERFIL, /const deletionInFlight = useRef\(false\)/);
    assert.match(PERFIL, /deletionInFlight\.current = true;/);
    assert.match(PERFIL, /deletionInFlight\.current = false;/);
    assert.match(PERFIL, /ownerUserId: userId \?\? ""/);
    assert.match(PERFIL, /storePendingAccountDeletion\(userId, "deletion_requested"\)/);
    assert.match(PERFIL, /publishPendingDeletion\(result\.marker\)/);
    assert.match(PERFIL, /usePendingDeletionGate\(\)/);
  });

  it("eliminar la cuenta NO se volvió una acción del bloque de suscripción", () => {
    for (const ajeno of [
      "requestAccountDeletion",
      "storePendingAccountDeletion",
      "publishPendingDeletion",
      "usePendingDeletionGate",
      "deleteAccount",
      "Eliminar mi cuenta"
    ]) {
      assert.equal(MANAGE.includes(ajeno), false, `el bloque de plan no puede cablear ${ajeno}`);
    }
    // Y en el Perfil el botón destructivo sigue con su propio handler y su
    // propio estilo, DEBAJO del bloque de plan y fuera de él.
    const cuenta = tramo(PERFIL, "function AccountSignedIn({", "const styles = StyleSheet.create(");
    const bloque = indiceDe(cuenta, /<ManageSubscriptionBlock\s*\/>/);
    const boton = indiceDe(cuenta, /onPress=\{handleDeleteAccount\}/);
    assert.ok(bloque !== -1 && boton > bloque, "el borrado va al final, no dentro del plan");
    assert.match(cuenta, /style=\{styles\.deleteBtn\}/);
  });
});
