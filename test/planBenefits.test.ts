/**
 * CORE-1044 — una sola fuente para lo que cada plan incluye.
 *
 * Apple rechazó la app por prometer cosas distintas de las que ofrece. La regla
 * de acceso es una sola para iOS y web, y los textos que la cuentan viven en
 * `src/domain/planBenefits.ts`. Acá se fija que las superficies lo consuman en
 * vez de redactar su propia lista, y que ningún texto prometa lo que no existe.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import * as nativo from "../src/domain/planBenefits";
import * as web from "../src/domain/planBenefits.web";
import { PLUS_BENEFITS_COMMON, PLUS_HEADLINE, PLUS_STEPS } from "../src/domain/planBenefitsShared";
import { importsOf } from "./moduleGraph";
import { ROOT } from "./moduleGraph";

const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const MODULOS = [
  "src/domain/planBenefitsShared.ts",
  "src/domain/planBenefits.ts",
  "src/domain/planBenefits.web.ts"
];
const ONBOARDING_NATIVO = leer("src/onboarding/screens/OnboardingPaywallScreen.tsx");
const ONBOARDING_WEB = leer("src/onboarding/screens/OnboardingPaywallScreen.web.tsx");
const PAYWALL_NATIVO = leer("src/screens/v492/PlusPaywallScreen.tsx");
const PERFIL_NATIVO = leer("src/components/orbita/ManageSubscription.tsx");
const PERFIL_WEB = leer("src/components/orbita/ManageSubscription.web.tsx");

const SUPERFICIES = {
  "OnboardingPaywallScreen.tsx": ONBOARDING_NATIVO,
  "OnboardingPaywallScreen.web.tsx": ONBOARDING_WEB,
  "PlusPaywallScreen.tsx": PAYWALL_NATIVO,
  "ManageSubscription.tsx": PERFIL_NATIVO,
  "ManageSubscription.web.tsx": PERFIL_WEB
};

const pasos = PLUS_STEPS.flatMap((paso) => [paso.title, paso.body]);

/** Todo lo que se le dice a una persona en nativo sobre los planes. */
const TEXTOS_NATIVOS = [
  ...nativo.PLUS_BENEFITS,
  PLUS_HEADLINE,
  ...pasos,
  nativo.FREE_PLAN_SUMMARY,
  nativo.PLUS_SUMMARY
];

/** Todo lo que se le dice en la web. */
const TEXTOS_WEB = [...web.PLUS_BENEFITS, PLUS_HEADLINE, ...pasos, web.FREE_PLAN_SUMMARY, web.PLUS_SUMMARY];

const TODOS = [...new Set([...TEXTOS_NATIVOS, ...TEXTOS_WEB])];

/** Los nombres que un archivo importa de `@/domain/planBenefits`. */
function importados(fuente: string): string[] {
  const encontrado = fuente.match(/import\s*\{([^}]*)\}\s*from\s*"@\/domain\/planBenefits"/);
  if (!encontrado) return [];
  return encontrado[1].split(",").map((nombre) => nombre.trim()).filter(Boolean);
}

describe("CORE-1044 · el módulo de beneficios es dominio puro", () => {
  it("sólo importa su parte común: se puede probar con node", () => {
    assert.deepEqual(importsOf(join(ROOT, MODULOS[0])), []);
    for (const rel of [MODULOS[1], MODULOS[2]]) {
      assert.deepEqual([...new Set(importsOf(join(ROOT, rel)))], ["./planBenefitsShared"]);
    }
  });

  it("las dos variantes exponen la misma interfaz a las pantallas", () => {
    for (const nombre of ["PLUS_BENEFITS", "PLUS_HEADLINE", "PLUS_STEPS", "FREE_PLAN_SUMMARY", "PLUS_SUMMARY"]) {
      assert.ok(nombre in nativo, `planBenefits.ts no exporta ${nombre}`);
      assert.ok(nombre in web, `planBenefits.web.ts no exporta ${nombre}`);
    }
    assert.equal(nativo.PLUS_HEADLINE, web.PLUS_HEADLINE);
    assert.deepEqual(nativo.PLUS_STEPS, web.PLUS_STEPS);
  });

  it("la lista nativa es la común y la web le suma sólo el Tarot", () => {
    assert.deepEqual([...nativo.PLUS_BENEFITS], [...PLUS_BENEFITS_COMMON]);
    assert.deepEqual([...web.PLUS_BENEFITS], [...PLUS_BENEFITS_COMMON, ...web.PLUS_BENEFITS_WEB_ONLY]);
    assert.equal(web.PLUS_BENEFITS_WEB_ONLY.length, 1);
    assert.match(web.PLUS_BENEFITS_WEB_ONLY[0], /Tarot/);
  });

  it("no hay renglones repetidos", () => {
    assert.equal(new Set(web.PLUS_BENEFITS).size, web.PLUS_BENEFITS.length);
  });

  it("lo que entra al bundle nativo no nombra Tarot, Diario ni calendario, ni en comentarios de código", () => {
    for (const rel of [MODULOS[0], MODULOS[1]]) {
      const codigo = leer(rel).replace(/\/\*[\s\S]*?\*\//g, "");
      assert.equal(/tarot|\bdiario\b|calendario/i.test(codigo), false, rel);
    }
  });
});

describe("CORE-1044 · las superficies consumen el módulo y no redactan su lista", () => {
  it("las cinco superficies importan `@/domain/planBenefits`", () => {
    for (const [nombre, fuente] of Object.entries(SUPERFICIES)) {
      assert.ok(importados(fuente).length > 0, `${nombre} no importa el módulo de beneficios`);
      assert.equal(/planBenefitsShared|planBenefits\.web/.test(fuente), false, `${nombre} saltea el fork de plataforma`);
    }
  });

  it("los tres paywalls pintan la lista del módulo", () => {
    for (const fuente of [ONBOARDING_NATIVO, ONBOARDING_WEB, PAYWALL_NATIVO]) {
      assert.match(fuente, /PLUS_BENEFITS\.map\(/);
    }
  });

  it("ningún paywall tiene un `<Benefit>` o un `<Paso>` con literal propio", () => {
    for (const [nombre, fuente] of Object.entries(SUPERFICIES)) {
      assert.equal(/<Benefit\s+text="/.test(fuente), false, `${nombre} redacta un beneficio a mano`);
      assert.equal(/<Paso\s+n="/.test(fuente), false, `${nombre} redacta un paso a mano`);
    }
  });

  it("el onboarding toma la cabecera y los pasos del módulo", () => {
    for (const fuente of [ONBOARDING_NATIVO, ONBOARDING_WEB]) {
      assert.match(fuente, /<Body style=\{styles\.sub\}>\{PLUS_HEADLINE\}<\/Body>/);
      assert.match(fuente, /PLUS_STEPS\.map\(/);
    }
  });

  it("el Perfil toma la frase de Free del módulo en las dos plataformas", () => {
    assert.match(PERFIL_NATIVO, /<Note>\{FREE_PLAN_SUMMARY\}<\/Note>/);
    assert.match(PERFIL_WEB, /\{FREE_PLAN_SUMMARY\} \{PLUS_SUMMARY\}/);
  });

  it("los textos viejos no quedaron en ninguna superficie", () => {
    const viejos = [
      /calendario y fase lunar/,
      /Tu día con contexto/,
      /Preguntas más profundas/,
      /guía diaria/,
      /Tenés Hoy, Tránsitos/,
      /Tarot de todos los días/,
      /—la rueda, tus casas/
    ];
    for (const [nombre, fuente] of Object.entries(SUPERFICIES)) {
      for (const viejo of viejos) {
        assert.equal(viejo.test(fuente), false, `${nombre} conserva ${viejo}`);
      }
    }
  });
});

describe("CORE-1044 · cada texto dice lo que la regla de acceso abre", () => {
  it("ningún texto de beneficios menciona calendario", () => {
    for (const texto of TODOS) assert.equal(/calendario/i.test(texto), false, texto);
  });

  it("los textos nativos no mencionan Tarot ni Diario", () => {
    for (const texto of TEXTOS_NATIVOS) {
      assert.equal(/tarot/i.test(texto), false, texto);
      assert.equal(/\bdiario\b/i.test(texto), false, texto);
    }
  });

  it("la frase Free nativa no dice Tránsitos ni Tu momento, y nombra los topes", () => {
    const free = nativo.FREE_PLAN_SUMMARY;
    assert.equal(/tr[áa]nsitos/i.test(free), false);
    assert.equal(/tu momento/i.test(free), false);
    assert.match(free, /Hoy/);
    assert.match(free, /la rueda y la tríada/);
    assert.match(free, /una persona en Vínculos/);
    assert.match(free, /tres preguntas por día en El Umbral/);
  });

  it("la frase Free de web tampoco dice Tránsitos, y cuenta el Tarot como total", () => {
    const free = web.FREE_PLAN_SUMMARY;
    assert.equal(/tr[áa]nsitos/i.test(free), false);
    assert.match(free, /siete cartas de Tarot en total/);
  });

  it("Plus no se atribuye lo que ya es gratis: Hoy, la fase lunar ni la rueda", () => {
    for (const texto of [...web.PLUS_BENEFITS, PLUS_HEADLINE, ...pasos, nativo.PLUS_SUMMARY, web.PLUS_SUMMARY]) {
      assert.equal(/\bHoy\b/.test(texto), false, texto);
      assert.equal(/fase lunar/i.test(texto), false, texto);
      assert.equal(/\brueda\b/i.test(texto), false, texto);
      assert.equal(/Sol, Luna/.test(texto), false, texto);
    }
  });

  it("Plus nombra las seis cosas que la regla abre", () => {
    const lista = nativo.PLUS_BENEFITS.join("\n");
    for (const esperado of [
      /Tránsitos: el panorama del día sobre tu carta y el detalle de cada tránsito/,
      /Tu momento: tu estación vital, el tema del año y tus cuatro ritmos/,
      /doce casas/,
      /aspectos/,
      /7 capítulos de «Tu carta, explicada»/,
      /Vínculos sin tope de personas ni de contactos/,
      /Cinco preguntas por día en El Umbral, en vez de tres/
    ]) {
      assert.match(lista, esperado);
    }
  });

  it("el Tarot de web se anuncia como diario, después de las siete cartas gratis", () => {
    assert.match(web.PLUS_BENEFITS.join("\n"), /Tarot: una carta cada día, después de las siete cartas gratis/);
    assert.match(web.PLUS_SUMMARY, /una carta de Tarot cada día/);
    assert.equal(/tarot/i.test(nativo.PLUS_SUMMARY), false);
  });

  it("sin superlativos ni promesas de resultado", () => {
    const prohibido = /más profund|ilimitad|\btodo\b|\btodos\b|\btodas\b|garantiz|destino|predic|salud|dinero|suerte/i;
    for (const texto of TODOS) assert.equal(prohibido.test(texto), false, texto);
  });
});
