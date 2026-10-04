/**
 * Free/Plus en la app nativa (CORE-1043): la regla de la web, en el bundle iOS.
 *
 * El corte REAL lo aplica el servidor —lo prueba `freePlusAccessServer.test.ts`—.
 * Lo que se fija acá es la mitad del cliente: que la app nativa pida SÓLO las
 * funciones que traen el corte, y que cuente la verdad de lo que recibe.
 *
 * 1. **La tabla.** `sectionAccess` dice, por sección y por plan, lo mismo que la
 *    tabla del producto; con el plan en vuelo, las secciones que Free no abre
 *    esperan en vez de afirmar un muro.
 * 2. **Las fuentes del plan.** Tránsitos y Tu momento se deciden con el `access`
 *    del sobre del día; la carta completa, con el de la carta o el entitlement
 *    remoto; el cupo de Vínculos, con el de la lista. Nunca con `data === null`.
 * 3. **Los datos.** Ningún módulo del bundle nativo enlaza las funciones sin
 *    sufijo, que siguen publicadas sin corte para el build ya instalado.
 * 4. **Los muros.** Cada pantalla que Free no abre dibuja el muro ANTES de leer
 *    su dato, con el texto de la web y una única salida: `/paywall`.
 * 5. **Hoy.** No tiene muro, ni lo importa.
 * 6. **Vínculos.** El alta con el cupo tomado muestra el aviso de Plus —también
 *    cuando el que lo dice es el servidor— y la comparación dice cuántos
 *    contactos faltan con el número que publicó el backend.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

import { reachableFrom, ROOT } from "./moduleGraph";
import {
  cartaCompletaAccess,
  HIDDEN_CONTACTS_BODY,
  hiddenContactsTitle,
  layerSectionAccess,
  MOMENTO_LOCKED_INTRO,
  PLAN_SECTIONS,
  PLAN_WALLS,
  planAccess,
  PLUS_CTA_HINT,
  PLUS_CTA_LABEL,
  PLUS_ONLY_LABEL,
  PLUS_PAYWALL_ROUTE,
  PLUS_REQUIRED_BADGE,
  RELATIONSHIP_LIMIT_REACHED,
  relationshipAddIntent,
  relationshipLimitLine,
  relationshipLimitReached,
  sectionAccess,
  TRANSITOS_LOCKED_INTRO,
  type LayerAccessLike,
  type PlanAccess,
  type PlanSection,
  type PlanWallKey,
  type SectionAccess
} from "../src/domain/planAccess";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
/** Una regla se comprueba sobre el CÓDIGO, no sobre lo que los comentarios cuentan de él. */
const sinComentarios = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const codigo = (rel: string) => sinComentarios(leer(rel));

/** Expo Router mete en el grafo TODOS los archivos de `app/`. */
function routeEntries(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(t|j)sx?$/.test(name)) out.push(relative(ROOT, full));
    }
  };
  walk(join(ROOT, "app"));
  return out.sort();
}

/** Todo lo que Metro empaqueta para iOS, menos el backend y lo generado. */
const BUNDLE_NATIVO = [...reachableFrom(routeEntries(), "native")]
  .filter((rel) => /\.(t|j)sx?$/.test(rel))
  .filter((rel) => rel.startsWith("src/") || rel.startsWith("app/"))
  .sort();

const nativo = (entry: string) => reachableFrom([entry], "native");

const PLAN_LOCK = "src/components/v492/PlanLock.tsx";
const HOY = "src/screens/v492/HoyScreen.tsx";
const TRANSITOS = "src/screens/v492/TransitosLayersScreen.tsx";
const ARCO = "src/screens/v492/ArcoDetailScreen.tsx";
const CARTA_COMPLETA = "src/screens/v492/CartaCompletaV492Screen.tsx";
const CARTA_HUB = "src/screens/v492/CartaHubScreen.tsx";
const HUB = "src/screens/v492/VinculosHubScreen.tsx";
const CONECTAR = "src/screens/v492/VinculosConnectScreen.tsx";
const PERFIL = "src/screens/v492/VinculosProfileScreen.tsx";
const RESULTADO = "src/screens/v492/VinculosResultScreen.tsx";
const USE_LAYERS = "src/hooks/useLayers.tsx";
const USE_ARC = "src/hooks/useTransitArc.ts";

const PLUS = { isPro: true };
const FREE = { isPro: false };
const ACCESO_FREE: LayerAccessLike = { isPro: false, hoy: "open", transitos: "locked", momento: "locked" };
const ACCESO_PLUS: LayerAccessLike = { isPro: true, hoy: "open", transitos: "open", momento: "open" };

// ---------------------------------------------------------------------------
// 1 · El plan y la tabla
// ---------------------------------------------------------------------------

describe("planAccess: sólo el remoto confirmado nombra un plan", () => {
  it("sin confirmación del dueño vigente, espera", () => {
    assert.equal(planAccess({ remote: undefined, resolved: false }), "loading");
    // Un plan en la mano que todavía no es de ESTA cuenta no autoriza nada.
    assert.equal(planAccess({ remote: PLUS, resolved: false }), "loading");
    assert.equal(planAccess({ remote: FREE, resolved: false }), "loading");
    assert.equal(planAccess({ remote: undefined, resolved: true }), "loading");
  });

  it("confirmado, dice Plus o Free", () => {
    assert.equal(planAccess({ remote: PLUS, resolved: true }), "plus");
    assert.equal(planAccess({ remote: FREE, resolved: true }), "free");
  });

  it("«el backend no reconoce plan» es Free, no una espera", () => {
    assert.equal(planAccess({ remote: null, resolved: true }), "free");
  });
});

describe("sectionAccess: la tabla Free/Plus de la web", () => {
  const TABLA: Record<PlanSection, Record<PlanAccess, SectionAccess>> = {
    hoy: { free: "open", plus: "open", loading: "open" },
    transitos: { free: "locked", plus: "open", loading: "loading" },
    momento: { free: "locked", plus: "open", loading: "loading" },
    vinculos: { free: "limited", plus: "open", loading: "loading" },
    carta: { free: "open", plus: "open", loading: "open" },
    cartaCompleta: { free: "locked", plus: "open", loading: "loading" },
    umbral: { free: "limited", plus: "open", loading: "loading" }
  };

  it("la tabla cubre todas las secciones", () => {
    assert.deepEqual([...PLAN_SECTIONS].sort(), Object.keys(TABLA).sort());
  });

  for (const section of PLAN_SECTIONS) {
    for (const plan of ["free", "plus", "loading"] as const) {
      it(`${section} · ${plan} → ${TABLA[section][plan]}`, () => {
        assert.equal(sectionAccess(section, plan), TABLA[section][plan]);
      });
    }
  }

  it("Plus no tiene ninguna sección cerrada ni con tope", () => {
    for (const section of PLAN_SECTIONS) assert.equal(sectionAccess(section, "plus"), "open");
  });

  it("con el plan en vuelo ninguna sección afirma un muro", () => {
    for (const section of PLAN_SECTIONS) {
      assert.notEqual(sectionAccess(section, "loading"), "locked", section);
      assert.notEqual(sectionAccess(section, "loading"), "limited", section);
    }
  });
});

// ---------------------------------------------------------------------------
// 2 · Las fuentes del plan
// ---------------------------------------------------------------------------

describe("layerSectionAccess: el acceso que viaja con el sobre del día", () => {
  it("Free: Hoy abierto, Tránsitos y Tu momento cerrados", () => {
    assert.equal(layerSectionAccess(ACCESO_FREE, "hoy"), "open");
    assert.equal(layerSectionAccess(ACCESO_FREE, "transitos"), "locked");
    assert.equal(layerSectionAccess(ACCESO_FREE, "momento"), "locked");
  });

  it("Plus: las tres abiertas", () => {
    for (const section of ["hoy", "transitos", "momento"] as const) {
      assert.equal(layerSectionAccess(ACCESO_PLUS, section), "open");
    }
  });

  it("sin sobre no hay muro: Tránsitos y Tu momento esperan, Hoy sigue abierto", () => {
    for (const vacio of [null, undefined]) {
      assert.equal(layerSectionAccess(vacio, "transitos"), "loading");
      assert.equal(layerSectionAccess(vacio, "momento"), "loading");
      assert.equal(layerSectionAccess(vacio, "hoy"), "open");
    }
  });

  it("cada sección se lee por su propia llave", () => {
    const mixto: LayerAccessLike = { isPro: false, hoy: "open", transitos: "open", momento: "locked" };
    assert.equal(layerSectionAccess(mixto, "transitos"), "open");
    assert.equal(layerSectionAccess(mixto, "momento"), "locked");
  });
});

describe("cartaCompletaAccess: la carta manda; sin carta, el entitlement", () => {
  it("con la carta leída decide su propio `access.isPro`", () => {
    for (const plan of ["loading", "free", "plus"] as const) {
      assert.equal(cartaCompletaAccess({ plan, chartIsPro: true }), "open");
      assert.equal(cartaCompletaAccess({ plan, chartIsPro: false }), "locked");
    }
  });

  it("sin carta decide el plan, y en vuelo espera", () => {
    assert.equal(cartaCompletaAccess({ plan: "plus" }), "open");
    assert.equal(cartaCompletaAccess({ plan: "free" }), "locked");
    assert.equal(cartaCompletaAccess({ plan: "loading" }), "loading");
  });
});

describe("Vínculos: el cupo lo dice el servidor", () => {
  it("mientras la lista viaja, agregar espera", () => {
    assert.equal(relationshipAddIntent(undefined), "esperar");
    assert.equal(relationshipAddIntent(null), "esperar");
  });

  it("con cupo abre el formulario; con el cupo tomado, el límite", () => {
    assert.equal(
      relationshipAddIntent({ isPro: false, limit: 1, remaining: 1, atLimit: false }),
      "formulario"
    );
    assert.equal(
      relationshipAddIntent({ isPro: false, limit: 1, remaining: 0, atLimit: true }),
      "limite"
    );
    assert.equal(
      relationshipAddIntent({ isPro: true, limit: null, remaining: null, atLimit: false }),
      "formulario"
    );
  });

  it("no cuenta personas: sólo lee `atLimit`", () => {
    // Una cuenta histórica con tres personas y plan Free: el servidor dice que
    // está en el límite aunque `remaining` no sea un número que el front entienda.
    assert.equal(
      relationshipAddIntent({ isPro: false, limit: 1, remaining: 0, atLimit: true }),
      "limite"
    );
    assert.doesNotMatch(codigo("src/domain/planAccess.ts"), /\.length\b/);
  });

  it("reconoce el rechazo del servidor adentro del error envuelto de Convex", () => {
    assert.equal(RELATIONSHIP_LIMIT_REACHED, "RELATIONSHIP_LIMIT_REACHED");
    const envuelto = new Error(
      "[Request ID: 7f3a9c1] Server Error\nUncaught Error: RELATIONSHIP_LIMIT_REACHED\n  at handler"
    );
    assert.equal(relationshipLimitReached(envuelto), true);
    assert.equal(relationshipLimitReached("RELATIONSHIP_LIMIT_REACHED"), true);
    assert.equal(relationshipLimitReached({ message: "x RELATIONSHIP_LIMIT_REACHED y" }), true);
    assert.equal(relationshipLimitReached(new Error("Network request failed")), false);
    assert.equal(relationshipLimitReached(null), false);
    assert.equal(relationshipLimitReached(undefined), false);
    assert.equal(relationshipLimitReached(42), false);
  });

  it("el límite se dice con el cupo que publicó el servidor", () => {
    assert.equal(
      relationshipLimitLine(1),
      "Free guarda una persona por cuenta. Para agregar a alguien más, activá Plus o editá los datos de la persona guardada."
    );
    assert.match(relationshipLimitLine(3), /^Free guarda 3 personas por cuenta\./);
    assert.match(relationshipLimitLine(null), /^Free guarda una persona por cuenta\./);
  });

  it("los contactos que faltan se dicen con su número, y con cero no se dice nada", () => {
    assert.equal(hiddenContactsTitle(0), null);
    assert.equal(hiddenContactsTitle(-2), null);
    assert.equal(hiddenContactsTitle(Number.NaN), null);
    assert.equal(hiddenContactsTitle(1), "Un contacto más, en Plus");
    assert.equal(hiddenContactsTitle(11), "11 contactos más, en Plus");
    assert.match(HIDDEN_CONTACTS_BODY, /Órbita Plus/);
  });
});

// ---------------------------------------------------------------------------
// 3 · Los datos: sólo `…WithAccess`
// ---------------------------------------------------------------------------

describe("el bundle nativo no enlaza las funciones sin corte de plan", () => {
  const SIN_SUFIJO_CAPAS = ["getForDate", "refreshForDate", "getTransitArc", "refreshTransitArc"];
  const SIN_SUFIJO_VINCULOS = ["list", "savePerson", "getComparison", "refreshComparison"];

  it("el grafo nativo incluye los servicios y las pantallas que se revisan", () => {
    for (const rel of [
      "src/services/layersApi.ts",
      "src/services/relationshipsApi.ts",
      USE_LAYERS,
      USE_ARC,
      HOY,
      TRANSITOS,
      ARCO,
      HUB,
      CONECTAR,
      RESULTADO,
      CARTA_COMPLETA,
      PLAN_LOCK
    ]) {
      assert.ok(BUNDLE_NATIVO.includes(rel), `${rel} no está en el bundle nativo`);
    }
  });

  for (const nombre of SIN_SUFIJO_CAPAS) {
    it(`ningún módulo nativo referencia layers.${nombre} sin sufijo`, () => {
      const patron = new RegExp(`(?:\\bapi|\\banyApi|\\blayersApi)(?:\\.layers)?\\.${nombre}\\b`);
      const culpables = BUNDLE_NATIVO.filter((rel) => patron.test(codigo(rel)));
      assert.deepEqual(culpables, []);
    });
  }

  for (const nombre of SIN_SUFIJO_VINCULOS) {
    it(`ningún módulo nativo referencia relationships.${nombre} sin sufijo`, () => {
      const patron = new RegExp(
        `(?:(?:\\bapi|\\banyApi)\\.relationships|\\brelationshipsApi)\\.${nombre}\\b`
      );
      const culpables = BUNDLE_NATIVO.filter((rel) => patron.test(codigo(rel)));
      assert.deepEqual(culpables, []);
    });
  }

  it("layersApi enlaza las cuatro variantes con el corte en el servidor", () => {
    const source = codigo("src/services/layersApi.ts");
    for (const nombre of [
      "getForDateWithAccess",
      "refreshForDateWithAccess",
      "getTransitArcWithAccess",
      "refreshTransitArcWithAccess"
    ]) {
      assert.match(source, new RegExp(`${nombre}:\\s*api\\.layers\\.${nombre}\\b`), nombre);
    }
    // Lo natal no cambia: la carta base es de cualquier plan.
    assert.match(source, /getNatalBase:\s*api\.layers\.getNatalBase\b/);
    assert.match(source, /getNatalChartBase:\s*api\.layers\.getNatalChartBase\b/);
    // Los tipos salen del contrato generado: el acceso y el sobre, de la MISMA respuesta.
    assert.match(source, /export type LayerAccess = LayerBundleWithAccess\["access"\]/);
    assert.match(source, /export type LayerBundle = LayerBundleWithAccess\["bundle"\]/);
    assert.doesNotMatch(source, /\banyApi\b|\bas any\b/);
  });

  it("relationshipsApi enlaza las cuatro variantes y conserva el borrado", () => {
    const source = codigo("src/services/relationshipsApi.ts");
    for (const nombre of [
      "listWithAccess",
      "savePersonWithAccess",
      "getComparisonWithAccess",
      "refreshComparisonWithAccess"
    ]) {
      assert.match(source, new RegExp(`${nombre}:\\s*api\\.relationships\\.${nombre}\\b`), nombre);
    }
    assert.match(source, /removePerson:\s*api\.relationships\.removePerson\b/);
  });

  it("el ciclo del día publica el `access` de la misma respuesta que el sobre", () => {
    const source = codigo(USE_LAYERS);
    assert.match(source, /useAction\(layersApi\.refreshForDateWithAccess\)/);
    assert.equal(
      (source.match(/useQuery\(\s*layersApi\.getForDateWithAccess\b/g) ?? []).length,
      2,
      "hoy y ayer, y nada más"
    );
    assert.match(source, /const bundle = delDia \? delDia\.bundle : delDia;/);
    assert.match(source, /const access = delDia \? delDia\.access : null;/);
    assert.match(source, /access: LayerAccess \| null;/);
    // Hoy está abierto para cualquier plan: el ciclo no espera al entitlement.
    assert.doesNotMatch(source, /usePlanAccess|useEntitlement/);
  });

  it("el arco trata `locked` como un cierre, no como un cálculo pendiente", () => {
    const source = codigo(USE_ARC);
    assert.match(source, /useQuery\(\s*layersApi\.getTransitArcWithAccess\b/);
    assert.match(source, /useAction\(layersApi\.refreshTransitArcWithAccess\)/);
    assert.match(source, /layerSectionAccess\(access, "transitos"\) === "locked"/);
    assert.match(source, /const locked = cerradoPorPlan \|\| resultado\?\.status === "locked";/);
    // Cerrado por el sobre del día, la lectura ni sale.
    assert.match(source, /const activo = listo && !cerradoPorPlan &&/);
    // Y el sobre sólo existe con `ready`: `locked` no dispara el cálculo.
    assert.match(source, /resultado\?\.status === "ready" \? resultado\.arc : null/);
    assert.match(source, /if \(envelope === undefined \|\| envelope === null\) return false;/);
  });
});

// ---------------------------------------------------------------------------
// 4 · Los muros
// ---------------------------------------------------------------------------

describe("el muro: una composición, una salida", () => {
  const source = codigo(PLAN_LOCK);

  it("la única salida es /paywall, y no se recibe por props", () => {
    assert.equal(PLUS_PAYWALL_ROUTE, "/paywall");
    assert.match(source, /router\.push\(PLUS_PAYWALL_ROUTE as never\)/);
    assert.equal((source.match(/router\.(?:push|replace|navigate)\(/g) ?? []).length, 1);
    assert.doesNotMatch(source, /onPress:\s*\(\)|onCta|href\??:/, "ninguna pantalla elige el destino");
    assert.equal((source.match(/onPress=\{irAPlus\}/g) ?? []).length, 2, "muro y aviso, el mismo botón");
  });

  it("el botón dice lo mismo que la web y explica qué pasa al tocarlo", () => {
    assert.equal(PLUS_CTA_LABEL, "VER ÓRBITA PLUS");
    assert.ok(PLUS_CTA_HINT.length > 0);
    assert.equal((source.match(/label=\{PLUS_CTA_LABEL\}/g) ?? []).length, 2);
    assert.equal((source.match(/accessibilityHint=\{PLUS_CTA_HINT\}/g) ?? []).length, 2);
    assert.match(source, /accessibilityLabel=\{copy\.ctaVoice\}/);
    assert.match(source, /accessibilityLabel=\{ctaVoice\}/);
  });

  it("el muro se anuncia como encabezado, con el rótulo y el titular juntos", () => {
    assert.equal(PLUS_ONLY_LABEL, "SOLO CON ÓRBITA PLUS");
    assert.equal((source.match(/accessibilityRole="header"/g) ?? []).length, 2);
    assert.match(source, /accessibilityLabel=\{`\$\{PLUS_ONLY_LABEL\}\. \$\{titularDeVoz\}`\}/);
    // El salto de línea tipográfico no llega a VoiceOver.
    assert.match(source, /copy\.title\.replace\(\/\\n\/g, " "\)/);
  });

  it("el objetivo táctil es el del token, y no hay colores ni medidas sueltas", () => {
    const states = codigo("src/components/v492/States.tsx");
    assert.match(states, /minHeight: v492\.touch/, "el botón del muro mide el token táctil");
    assert.match(source, /<PrimaryButton\b/);
    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, "los colores salen de los tokens");
    assert.doesNotMatch(source, /(?:margin|padding)\w*:\s*\d/, "los espaciados salen de los tokens");
  });
});

describe("el texto de cada muro es el de la web", () => {
  const web = (rel: string) => leer(rel);

  it("Tránsitos", () => {
    const transitos = web("src/screens/TransitosScreen.tsx");
    assert.equal(TRANSITOS_LOCKED_INTRO, "Un tránsito es un planeta de hoy tocando un punto de tu carta natal.");
    assert.ok(transitos.includes(`"${TRANSITOS_LOCKED_INTRO}"`));
    assert.equal(PLUS_REQUIRED_BADGE, "REQUIERE PLUS");
    assert.ok(transitos.includes(`derecha="${PLUS_REQUIRED_BADGE}"`));
    assert.ok(transitos.includes(PLUS_ONLY_LABEL));
    assert.ok(transitos.includes(PLAN_WALLS.transitos.title));
    for (const vineta of PLAN_WALLS.transitos.bullets ?? []) {
      assert.ok(transitos.includes(`"${vineta}"`), vineta);
    }
    assert.equal(PLAN_WALLS.transitos.bullets?.length, 3);
    // El cuerpo es el de la web, que lo parte en dos renglones de JSX.
    assert.equal(
      PLAN_WALLS.transitos.body,
      "Con Plus, Órbita cruza el cielo de hoy con tu carta natal: qué contactos están activos, cuánto les falta para ser exactos y qué casa de tu carta tocan."
    );
    assert.ok(transitos.includes("Con Plus, Órbita cruza el cielo de hoy con tu carta natal"));
    assert.ok(transitos.includes(`"${PLAN_WALLS.arco.bullets?.[0]}"`), "el detalle de arco, como lo dice la web");
  });

  it("Tu momento y sus tres capas", () => {
    const pares: Array<[PlanWallKey, string]> = [
      ["estacion", "src/screens/EstacionVitalScreen.tsx"],
      ["ano", "src/screens/TemaDelAnoScreen.tsx"],
      ["mandala", "src/screens/CuatroRitmosScreen.tsx"]
    ];
    for (const [clave, rel] of pares) {
      const fuente = web(rel);
      const titulo = JSON.stringify(PLAN_WALLS[clave].title);
      assert.ok(fuente.includes(`title={${titulo}}`), `${clave}: ${titulo}`);
      assert.ok(fuente.includes(`body="${PLAN_WALLS[clave].body}"`), `${clave}: cuerpo`);
    }
    assert.equal(PLAN_WALLS.momento.body, PLAN_WALLS.estacion.body);
    assert.match(MOMENTO_LOCKED_INTRO, /se abren con Plus\.$/);
  });

  it("la carta completa", () => {
    const carta = web("src/screens/CartaCompletaScreen.tsx");
    assert.ok(carta.includes(`title={${JSON.stringify(PLAN_WALLS.cartaCompleta.title)}}`));
    assert.ok(carta.includes(`body="${PLAN_WALLS.cartaCompleta.body}"`));
    assert.match(PLAN_WALLS.cartaCompleta.body, /Tu rueda y tu tríada siguen en Carta\.$/);
  });

  it("los contactos de la comparación", () => {
    const comparacion = web("src/screens/VinculoComparacionScreen.tsx");
    assert.ok(comparacion.includes('"Un contacto más, en Plus"'));
    assert.ok(comparacion.includes("contactos más, en Plus`"));
  });

  it("ningún muro promete destino, dinero, salud ni resultados", () => {
    const todo = [
      ...Object.values(PLAN_WALLS).flatMap((copy) => [
        copy.title,
        copy.body,
        copy.note ?? "",
        copy.ctaVoice,
        ...(copy.bullets ?? [])
      ]),
      TRANSITOS_LOCKED_INTRO,
      MOMENTO_LOCKED_INTRO,
      HIDDEN_CONTACTS_BODY,
      relationshipLimitLine(1)
    ].join("\n");
    assert.doesNotMatch(todo, /destino|garantiz|predic|salud|dinero|prueba gratis|precio|\$/i);
  });
});

describe("cada pantalla que Free no abre dibuja el muro antes de leer su dato", () => {
  /** El muro aparece en el fuente ANTES que la primera lectura del contenido. */
  function muroAntesDe(rel: string, guardia: RegExp, copy: RegExp, contenido: RegExp) {
    const source = codigo(rel);
    const iGuardia = source.search(guardia);
    const iCopy = source.search(copy);
    const iContenido = source.search(contenido);
    assert.ok(iGuardia >= 0, `${rel}: falta la guardia de plan`);
    assert.ok(iCopy >= 0, `${rel}: falta el muro`);
    assert.ok(iContenido >= 0, `${rel}: no se encontró el contenido`);
    assert.ok(iGuardia < iContenido, `${rel}: el plan se decide después de leer el dato`);
    assert.ok(iCopy < iContenido, `${rel}: el muro va antes que el contenido`);
    assert.match(source, /import \{ PlanWall \} from "@\/components\/v492\/PlanLock";/);
    // La pantalla no arma su propia salida: la trae el muro.
    return source;
  }

  it("Tránsitos · Ahora y Tu momento", () => {
    const source = muroAntesDe(
      TRANSITOS,
      /layerSectionAccess\(access, mode === "ahora" \? "transitos" : "momento"\) === "locked"/,
      /<PlanWall copy=\{mode === "ahora" \? PLAN_WALLS\.transitos : PLAN_WALLS\.momento\} \/>/,
      /anyDataReady\(/
    );
    assert.match(source, /capas=\{PLUS_REQUIRED_BADGE\}/);
    assert.match(source, /intro=\{mode === "ahora" \? TRANSITOS_LOCKED_INTRO : MOMENTO_LOCKED_INTRO\}/);
    // El selector sigue en el muro: las dos vistas existen.
    const cerrado = /=== "locked"\) \{[\s\S]*?\n  \}\n/.exec(source)?.[0] ?? "";
    assert.match(cerrado, /pills=\{pills\}/);
    assert.doesNotMatch(cerrado, /onRefresh|AhoraView|MomentoView|TraceAccordion/);
  });

  it("el detalle de arco, por el sobre del día y por la propia lectura", () => {
    const source = muroAntesDe(
      ARCO,
      /layerSectionAccess\(layers\.access, "transitos"\) === "locked"/,
      /<ArcoBloqueado fallbackHref=\{fallbackHref\} \/>/,
      /<ArcoResolver\b/
    );
    assert.match(source, /<PlanWall copy=\{PLAN_WALLS\.arco\} \/>/);
    // La última palabra del servidor: `locked` va antes que el arco principal y
    // que el estado vacío.
    const resolver = source.slice(source.indexOf("function ArcoResolver"));
    const iLocked = resolver.search(/if \(especifico\.locked\) return <ArcoBloqueado/);
    assert.ok(iLocked >= 0);
    assert.ok(iLocked < resolver.search(/if \(esPrincipal\)/));
    assert.ok(iLocked < resolver.search(/<EmptyBlock \/>/));
  });

  for (const [rel, clave, lectura] of [
    ["src/screens/v492/EstacionDetailScreen.tsx", "estacion", /bundle\.moment\.progressedLunation/],
    ["src/screens/v492/AnoDetailScreen.tsx", "ano", /bundle\.moment\.annualProfection/],
    ["src/screens/v492/MandalaDetailScreen.tsx", "mandala", /bundle\.moment\.temporalMandala/]
  ] as const) {
    it(`Tu momento · ${clave}`, () => {
      muroAntesDe(
        rel,
        /layerSectionAccess\(layers\.access, "momento"\) === "locked"/,
        new RegExp(`<PlanWall copy=\\{PLAN_WALLS\\.${clave}\\} \\/>`),
        lectura
      );
    });
  }

  it("la carta completa: entera, y sin parpadeo mientras el plan viaja", () => {
    const source = muroAntesDe(
      CARTA_COMPLETA,
      /cartaCompletaAccess\(\{ plan: usePlanAccess\(\), chartIsPro: chart\?\.access\.isPro \}\)/,
      /<PlanWall copy=\{PLAN_WALLS\.cartaCompleta\} \/>/,
      /<CartaCompletaContent\b/
    );
    assert.match(source, /if \(estado\.phase === "cargando" \|\| acceso === "loading"\) \{/);
    const iCarga = source.search(/acceso === "loading"/);
    const iMuro = source.search(/if \(acceso === "locked"\)/);
    assert.ok(iCarga < iMuro, "primero se espera, después se decide");
    // Ningún estado del cálculo se le ofrece a quien su plan no abre la pantalla.
    assert.ok(iMuro < source.search(/estado\.phase === "sin-datos"/));
    assert.ok(iMuro < source.search(/estado\.phase === "sin-calculo"/));
  });

  it("ninguna pantalla decide el plan mirando si el sobre trae dato", () => {
    for (const rel of [TRANSITOS, ARCO, HOY, CARTA_COMPLETA]) {
      assert.doesNotMatch(codigo(rel), /orbita_plus/, rel);
    }
    assert.doesNotMatch(codigo("src/domain/layers.ts"), /orbita_plus/);
  });

  it("las rutas nativas bloqueables llegan al muro; sus pares web no", () => {
    for (const entry of [
      "app/(tabs)/transitos/index.tsx",
      "app/(tabs)/transitos/momento.tsx",
      "app/(tabs)/transitos/arco/[arcId].tsx",
      "app/(tabs)/transitos/capa/[layer].tsx",
      "app/(tabs)/perfil/carta/completa.tsx",
      "app/(tabs)/vinculos/index.tsx",
      "app/(tabs)/vinculos/conectar.tsx",
      "app/(tabs)/vinculos/[profileId]/comparacion.tsx"
    ]) {
      assert.ok(nativo(entry).has(PLAN_LOCK), `${entry} no llega al muro en nativo`);
      assert.ok(!reachableFrom([entry], "web").has(PLAN_LOCK), `${entry} arrastra el muro nativo a la web`);
    }
  });
});

// ---------------------------------------------------------------------------
// 5 · Hoy está abierto
// ---------------------------------------------------------------------------

describe("Hoy no tiene muro", () => {
  it("la pantalla no importa ni dibuja nada de plan", () => {
    const source = codigo(HOY);
    assert.doesNotMatch(source, /PlanWall|PlanLockBlock|PlanLock"|PLAN_WALLS|PLUS_PAYWALL_ROUTE|\/paywall/);
    assert.doesNotMatch(source, /usePlanAccess|useEntitlement|sectionAccess\(/);
    assert.doesNotMatch(source, /=== "locked"\) \{|=== "locked"\) return/);
  });

  it("sus tres rutas no llegan al muro", () => {
    for (const entry of [
      "app/(tabs)/hoy/index.tsx",
      "app/(tabs)/hoy/luna.tsx",
      "app/(tabs)/hoy/cumpleluna.tsx"
    ]) {
      assert.ok(!nativo(entry).has(PLAN_LOCK), `${entry} llega a un muro`);
    }
  });

  it("la Luna y el cumpleluna tampoco se cierran cuando se abren desde Tránsitos", () => {
    for (const rel of [
      "src/screens/v492/LunaDetailScreen.tsx",
      "src/screens/v492/CumplelunaDetailScreen.tsx"
    ]) {
      assert.doesNotMatch(codigo(rel), /PlanWall|layerSectionAccess|\/paywall/, rel);
    }
  });

  it("el arco cerrado no se cuenta entre las capas de Hoy ni en su aviso de frescura", () => {
    const source = codigo(HOY);
    assert.match(source, /arcoCerrado=\{layerSectionAccess\(access, "transitos"\) === "locked"\}/);
    assert.match(
      source,
      /const sobres = arcoCerrado\s*\? \[transitRanking, moonOnChart, cumpleluna\]\s*: Object\.values\(bundle\.today\);/
    );
  });

  it("el contexto del año sólo se dibuja con el dato, así que en Free no aparece", () => {
    const source = codigo(HOY);
    assert.match(source, /const profeccion = bundle\.moment\.annualProfection\.data;/);
    assert.match(source, /\{tema && profeccion \? \(/);
  });

  it("las salidas a Tránsitos siguen ahí y caen en el muro de esa sección", () => {
    const source = codigo(HOY);
    assert.match(source, /router\.push\(`\/transitos\/arco\/\$\{encodeURIComponent\(item\.arcId\)\}` as never\)/);
    assert.match(source, /router\.push\("\/transitos" as never\)/);
    assert.match(source, /router\.push\("\/transitos\/momento" as never\)/);
  });

  it("la pestaña inicial sigue siendo Hoy", () => {
    assert.match(codigo("src/routes/v492/tabs-index.tsx"), /<Redirect href="\/hoy" \/>/);
  });

  it("la pestaña Carta no se cierra: la rueda y la tríada son de cualquier plan", () => {
    const source = codigo(CARTA_HUB);
    assert.doesNotMatch(source, /PlanWall|cartaCompletaAccess|usePlanAccess/);
    assert.match(source, /router\.push\("\/perfil\/carta\/completa" as never\)/, "el acceso sigue y cae en el muro");
  });
});

// ---------------------------------------------------------------------------
// 6 · Vínculos
// ---------------------------------------------------------------------------

describe("Vínculos: una persona y tres contactos para Free", () => {
  it("la raíz cambia el alta por el aviso de Plus cuando el cupo está tomado", () => {
    const source = codigo(HUB);
    assert.match(source, /const lista = useQuery\(relationshipsApi\.listWithAccess, \{\}\);/);
    assert.match(source, /const agregar = relationshipAddIntent\(lista\?\.access\);/);
    assert.match(source, /\{agregar === "formulario" \? \(\s*<View style=\{styles\.cta\}>\s*<PrimaryButton\s*label="AGREGAR UNA PERSONA"/);
    assert.match(
      source,
      /\{agregar === "limite" \? \(\s*<PlanLockBlock\s*line=\{relationshipLimitLine\(lista\?\.access\.limit\)\}/
    );
    // Las personas se dibujan igual, tengan o no cupo.
    assert.match(source, /<PersonasBlock personas=\{personas\} \/>/);
    // El formulario sólo se abre desde el botón que existe con cupo.
    assert.equal((source.match(/router\.push\(VINCULOS_FORM_ROUTE as never\)/g) ?? []).length, 1);
  });

  it("el alta directa con el cupo tomado muestra el mismo aviso, no el formulario", () => {
    const source = codigo(CONECTAR);
    assert.match(source, /const lista = useQuery\(relationshipsApi\.listWithAccess, \{\}\);/);
    assert.match(source, /const intencion = relationshipAddIntent\(lista\?\.access\);/);
    assert.match(source, /if \(intencion === "esperar"\) \{/, "mientras la lista viaja no hay formulario");
    assert.match(
      source,
      /if \(intencion === "limite" && \(cupoAlEntrar\.current === "tomado" \|\| rechazadaPorCupo\)\) \{/
    );
    assert.match(source, /<PlanLockBlock\s*line=\{relationshipLimitLine\(lista\?\.access\.limit\)\}/);
  });

  it("guardar la primera persona no desmonta el formulario con un límite", () => {
    const source = codigo(CONECTAR);
    // El cupo se fija UNA vez, al resolver la lista: el alta que salió bien deja
    // `atLimit` en true antes de navegar y ese instante no es un rechazo.
    assert.match(source, /const cupoAlEntrar = useRef<"libre" \| "tomado" \| null>\(null\);/);
    assert.match(source, /if \(cupoAlEntrar\.current === null && intencion !== "esperar"\) \{/);
  });

  it("el rechazo del servidor se dice como límite de plan, no como error de conexión", () => {
    const source = codigo(CONECTAR);
    const captura = /\} catch \(error\) \{[\s\S]*?\} finally \{/.exec(source)?.[0] ?? "";
    assert.ok(captura, "no se encontró el catch del guardado");
    assert.match(captura, /if \(!persona && relationshipLimitReached\(error\)\) \{/);
    assert.match(captura, /onCupoTomado\?\.\(\);/);
    const iLimite = captura.search(/relationshipLimitReached\(error\)/);
    const iGenerico = captura.search(/No pudimos guardar/);
    assert.ok(iLimite >= 0 && iLimite < iGenerico, "el límite se reconoce antes del mensaje genérico");
    assert.match(source, /onCupoTomado=\{\(\) => setRechazadaPorCupo\(true\)\}/);
    // Editar no cuenta contra el cupo: la edición no recibe el callback.
    assert.match(source, /<ConnectForm key=\{persona\.profileId\} persona=\{persona\} \/>/);
  });

  it("el perfil y la edición siguen abiertos para todas las personas guardadas", () => {
    assert.doesNotMatch(codigo(PERFIL), /atLimit|PlanLockBlock|PlanWall|relationshipAddIntent/);
    const conectar = codigo(CONECTAR);
    const edicion = conectar.slice(conectar.indexOf("if (persona === undefined)"));
    assert.doesNotMatch(
      edicion.slice(0, edicion.indexOf("function ConnectForm")),
      /PlanLockBlock|intencion/
    );
  });

  it("la comparación dice cuántos contactos faltan con el número del servidor", () => {
    const source = codigo(RESULTADO);
    assert.match(source, /useQuery\(relationshipsApi\.getComparisonWithAccess, \{\s*profileId: persona\.profileId\s*\}\)/);
    assert.match(source, /const comparison = conAcceso\?\.comparison;/);
    assert.match(source, /const contactosEnPlus = hiddenContactsTitle\(conAcceso\?\.hiddenContacts \?\? 0\);/);
    assert.match(
      source,
      /\{data && contactosEnPlus \? \(\s*<PlanLockBlock\s*title=\{contactosEnPlus\}\s*line=\{HIDDEN_CONTACTS_BODY\}/
    );
    // El front no cuenta contactos para decidir.
    assert.doesNotMatch(source, /contactLimit|FREE_CONTACT_LIMIT/);
  });
});

// ---------------------------------------------------------------------------
// Lo que esta tarjeta NO trae
// ---------------------------------------------------------------------------

describe("alcance", () => {
  it("el bundle nativo no trae el canje de códigos de oferta", () => {
    for (const rel of BUNDLE_NATIVO) {
      assert.doesNotMatch(codigo(rel), /orbita-offer-codes/, rel);
    }
  });

  it("los muros nativos no entran al bundle web", () => {
    const web = reachableFrom(routeEntries(), "web");
    assert.ok(!web.has(PLAN_LOCK));
    assert.ok(!web.has("src/hooks/usePlanAccess.ts"));
  });
});
