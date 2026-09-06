/**
 * `LO PRINCIPAL HOY` y el `RANKING DE TRÁNSITOS` (CORE-191).
 *
 * Lo que se prueba acá es la DERIVACIÓN desde `daily.getGuide`: qué frase
 * encabeza la sección, qué filas tiene el ranking y —sobre todo— qué NO se
 * inventa cuando el payload viene incompleto. Es todo puro, así que se ejecuta
 * de verdad: no hay una sola afirmación sobre el texto del archivo.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { contarModulos, contextoDelAno, esLecturaPlantilla, etiquetaDeModulos, guiaPendiente, hoyBloques, hoyPrincipal, hoyRanking, numeroDeBloque, partesDeContacto } from "../src/domain/hoyPrincipal";
import type { DailyGuidePayload } from "../src/services/appRefs";

/** Un payload real mínimo; cada test pisa sólo lo que le importa. */
function guia(partial: Partial<DailyGuidePayload> = {}): DailyGuidePayload {
  return {
    headline: "Un día para poner límites sin romper nada",
    body: "cuerpo",
    clima: "clima",
    destacado: { aspecto: "Luna en cuadratura a tu Sol", lectura: "La tensión de hoy pide que elijas una sola cosa." },
    secundarios: [
      { aspecto: "Venus en trígono a tu Luna", lectura: "Un gesto amable ordena una conversación pendiente." }
    ],
    basadoEn: ["TU LUNA EN SAGITARIO"],
    disclaimer: "Órbita es entretenimiento y autoconocimiento.",
    ...partial
  };
}

describe("hoyPrincipal — la síntesis editorial", () => {
  it("el titular es la lectura del aspecto destacado", () => {
    const principal = hoyPrincipal(guia());
    assert.equal(principal?.titular, "La tensión de hoy pide que elijas una sola cosa.");
    assert.equal(principal?.aspecto, "Luna en cuadratura a tu Sol");
  });

  it("sin lectura del destacado cae al titular del día, que es la misma generación", () => {
    const principal = hoyPrincipal(guia({ destacado: { aspecto: "Luna en cuadratura a tu Sol", lectura: "   " } }));
    assert.equal(principal?.titular, "Un día para poner límites sin romper nada");
    // El contacto sigue estando: no se pierde por venir sin lectura.
    assert.equal(principal?.aspecto, "Luna en cuadratura a tu Sol");
  });

  it("sin lectura y sin titular no hay bloque: la síntesis no se rellena", () => {
    assert.equal(hoyPrincipal(guia({ headline: "", destacado: { aspecto: "X", lectura: "" } })), null);
    assert.equal(hoyPrincipal(null), null);
    assert.equal(hoyPrincipal(undefined), null);
  });

  it("un aspecto vacío no se muestra como etiqueta en blanco", () => {
    const principal = hoyPrincipal(guia({ destacado: { aspecto: "  ", lectura: "Hay algo que decir." } }));
    assert.equal(principal?.aspecto, null);
  });

  it("el texto se recorta, pero no se reescribe", () => {
    const principal = hoyPrincipal(guia({ destacado: { aspecto: " Sol ", lectura: "  Hoy no.  " } }));
    assert.equal(principal?.titular, "Hoy no.");
    assert.equal(principal?.aspecto, "Sol");
  });

  it("un payload con formas rotas no explota", () => {
    const roto = { headline: 42, destacado: "no soy un objeto", secundarios: "tampoco" } as unknown as DailyGuidePayload;
    assert.equal(hoyPrincipal(roto), null);
    assert.deepEqual(hoyRanking(roto), []);
  });
});

describe("hoyRanking — el orden real, sin puntajes inventados", () => {
  it("el destacado va primero y los secundarios después, numerados desde 1", () => {
    const filas = hoyRanking(guia());
    assert.equal(filas.length, 2);
    assert.equal(filas[0].aspecto, "Luna en cuadratura a tu Sol");
    assert.equal(filas[0].rango, 1);
    assert.equal(filas[1].aspecto, "Venus en trígono a tu Luna");
    assert.equal(filas[1].rango, 2);
  });

  it("una fila NO trae orbe, barra, exactitud ni contador de activos", () => {
    // La regresión que este test impide: derivar una escala de cercanía a partir
    // de un contrato que no publica orbes. Sería un puntaje inventado.
    const [fila] = hoyRanking(guia());
    assert.deepEqual(
      Object.keys(fila).sort(),
      ["aspecto", "casa", "clave", "lectura", "planeta", "punto", "rango", "titulo", "transitId"]
    );
  });

  it("cada fila lee el planeta, el punto y la casa de la línea real del backend, sin inventar", () => {
    const filas = hoyRanking(
      guia({
        destacado: { aspecto: "Marte en Cáncer cuadratura tu Venus (casa 6)", lectura: "Algo real." },
        secundarios: [
          { aspecto: "Saturno en Aries cuadratura tu Júpiter (casa 3)", lectura: "" },
          { aspecto: "Venus en Libra cuadratura tu Ascendente (casa 10)", lectura: "" },
          { aspecto: "Sol conjunción tu Medio Cielo", lectura: "" },
          { aspecto: "una línea que no sigue el formato", lectura: "" }
        ]
      })
    );
    assert.deepEqual(
      filas.map((f) => [f.planeta, f.punto, f.casa, f.titulo]),
      [
        ["Marte", "Venus", 6, "Marte cuadratura tu Venus"],
        ["Saturno", "Júpiter", 3, "Saturno cuadratura tu Júpiter"],
        ["Venus", "Ascendente", 10, "Venus cuadratura tu Ascendente"],
        ["Sol", "Medio Cielo", null, "Sol conjunción tu Medio Cielo"],
        [null, null, null, "una línea que no sigue el formato"]
      ]
    );
    // `partesDeContacto` es puro y conserva el signo aparte.
    assert.equal(partesDeContacto("Marte en Cáncer cuadratura tu Venus (casa 6)").signo, "Cáncer");
  });

  it("la plantilla de fallback del backend (`Hoy <contacto>.`) no es una lectura", () => {
    const aspecto = "Marte en Cáncer cuadratura tu Venus (casa 6)";
    assert.equal(esLecturaPlantilla(`Hoy ${aspecto}.`, aspecto), true);
    assert.equal(esLecturaPlantilla("  hoy   marte en cáncer cuadratura tu venus (casa 6)", aspecto), true);
    assert.equal(esLecturaPlantilla("Un texto escrito de verdad.", aspecto), false);

    const filas = hoyRanking(guia({ destacado: { aspecto, lectura: `Hoy ${aspecto}.` } }));
    assert.equal(filas[0].lectura, null);
    // Y en «lo principal» cae al titular del día en vez de repetir el contacto.
    const principal = hoyPrincipal(guia({ destacado: { aspecto, lectura: `Hoy ${aspecto}.` } }));
    assert.equal(principal?.titular, "Un día para poner límites sin romper nada");
    assert.equal(principal?.aspecto, aspecto);
  });

  it("el destacado repetido dentro de secundarios se muestra UNA sola vez", () => {
    const filas = hoyRanking(
      guia({
        secundarios: [
          { aspecto: "Luna en cuadratura a tu Sol", lectura: "Otra redacción del mismo contacto." },
          { aspecto: "Venus en trígono a tu Luna", lectura: "Un gesto amable." }
        ]
      })
    );
    assert.deepEqual(
      filas.map((f) => f.aspecto),
      ["Luna en cuadratura a tu Sol", "Venus en trígono a tu Luna"]
    );
    // Y gana la lectura del destacado: es la del bloque que el backend eligió.
    assert.equal(filas[0].lectura, "La tensión de hoy pide que elijas una sola cosa.");
  });

  it("la deduplicación no depende de mayúsculas, espacios ni puntuación final", () => {
    const filas = hoyRanking(
      guia({
        secundarios: [{ aspecto: "  LUNA   en Cuadratura a tu SOL.  ", lectura: "El mismo contacto." }]
      })
    );
    assert.equal(filas.length, 1);
    assert.equal(filas[0].clave, "luna en cuadratura a tu sol");
  });

  it("después de deduplicar, la numeración queda sin huecos", () => {
    const filas = hoyRanking(
      guia({
        secundarios: [
          { aspecto: "Luna en cuadratura a tu Sol", lectura: "Repetido." },
          { aspecto: "Marte en oposición a tu Luna", lectura: "Segundo real." }
        ]
      })
    );
    assert.deepEqual(
      filas.map((f) => f.rango),
      [1, 2]
    );
  });

  it("sin contacto no hay fila; sin lectura la fila queda con el contacto solo", () => {
    const filas = hoyRanking(
      guia({
        destacado: { aspecto: "Luna en cuadratura a tu Sol", lectura: "" },
        secundarios: [
          { aspecto: "", lectura: "Una lectura sin contacto." },
          { aspecto: "Marte en oposición a tu Luna", lectura: "   " },
          { aspecto: "Venus en trígono a tu Luna", lectura: "Esta sí." }
        ]
      })
    );
    assert.deepEqual(
      filas.map((f) => f.aspecto),
      ["Luna en cuadratura a tu Sol", "Marte en oposición a tu Luna", "Venus en trígono a tu Luna"]
    );
    assert.deepEqual(
      filas.map((f) => f.lectura),
      [null, null, "Esta sí."]
    );
    assert.deepEqual(
      filas.map((f) => f.rango),
      [1, 2, 3]
    );
  });

  it("consume los secundarios tal como los manda el contrato real: con lectura vacía", () => {
    // `composePayload` del backend arma `secundarios` con `lectura: ""` siempre.
    // Descartarlos por eso dejaría el ranking reducido al destacado.
    const filas = hoyRanking(
      guia({
        secundarios: [
          { aspecto: "Venus en trígono a tu Luna", lectura: "" },
          { aspecto: "Marte en oposición a tu Luna", lectura: "" },
          { aspecto: "Saturno en sextil a tu Sol", lectura: "" }
        ]
      })
    );
    assert.equal(filas.length, 4);
    assert.deepEqual(filas.slice(1).map((f) => f.lectura), [null, null, null]);
  });

  it("sin payload no hay filas (nunca una lista de relleno)", () => {
    assert.deepEqual(hoyRanking(null), []);
    assert.deepEqual(hoyRanking(undefined), []);
    assert.deepEqual(hoyRanking(guia({ destacado: undefined as never, secundarios: [] })), []);
  });

  it("secundarios que no es una lista se ignora sin romper el destacado", () => {
    const filas = hoyRanking(guia({ secundarios: null as never }));
    assert.equal(filas.length, 1);
    assert.equal(filas[0].rango, 1);
  });
});

describe("guiaPendiente — la primera respuesta genérica no es el dato de hoy", () => {
  it("un payload marcado pending no produce síntesis ni ranking", () => {
    const pendiente = Object.assign(guia(), { enrichment: { status: "pending", requestedAt: 1, attempt: 1 } });
    assert.equal(guiaPendiente(pendiente), true);
    assert.equal(hoyPrincipal(pendiente), null);
    assert.deepEqual(hoyRanking(pendiente), []);
  });

  it("listo, en fallback, con error o sin `enrichment` (v3 completo) se consume tal cual", () => {
    for (const status of ["ready", "fallback", "error"]) {
      const listo = Object.assign(guia(), { enrichment: { status, requestedAt: 1, attempt: 1 } });
      assert.equal(guiaPendiente(listo), false);
      assert.ok(hoyPrincipal(listo));
      assert.equal(hoyRanking(listo).length, 2);
    }
    assert.equal(guiaPendiente(guia()), false);
    assert.equal(guiaPendiente(null), false);
    assert.equal(guiaPendiente(Object.assign(guia(), { enrichment: "raro" })), false);
  });
});

describe("hoyBloques — los bloques numerados del frame", () => {
  it("por defecto: ranking, Luna y Cumpleluna; lo principal va arriba sin número", () => {
    assert.deepEqual(hoyBloques(false), ["ranking", "luna", "cumpleluna"]);
  });

  it("con Cumpleluna hoy el evento sube a 01 y los otros dos corren", () => {
    assert.deepEqual(hoyBloques(true), ["cumpleluna", "ranking", "luna"]);
  });

  it("los tres bloques están siempre, en los dos órdenes", () => {
    for (const orden of [hoyBloques(false), hoyBloques(true)]) {
      assert.deepEqual([...orden].sort(), ["cumpleluna", "luna", "ranking"]);
    }
  });

  it("el índice acompaña a la posición, no a la capa", () => {
    const conEvento = hoyBloques(true);
    assert.equal(numeroDeBloque(conEvento.indexOf("cumpleluna")), "01");
    assert.equal(numeroDeBloque(conEvento.indexOf("ranking")), "02");
    assert.equal(numeroDeBloque(conEvento.indexOf("luna")), "03");

    const sinEvento = hoyBloques(false);
    assert.equal(numeroDeBloque(sinEvento.indexOf("ranking")), "01");
    assert.equal(numeroDeBloque(sinEvento.indexOf("cumpleluna")), "03");
  });

  it("numeroDeBloque siempre da dos dígitos y tolera basura", () => {
    assert.equal(numeroDeBloque(0), "01");
    assert.equal(numeroDeBloque(9), "10");
    assert.equal(numeroDeBloque(-3), "01");
    assert.equal(numeroDeBloque(Number.NaN), "01");
  });
});

describe("el contador del encabezado", () => {
  it("cuenta sólo los módulos que tienen dato", () => {
    assert.equal(contarModulos({ principal: true, ranking: true, luna: true, cumpleluna: true }), 4);
    assert.equal(contarModulos({ principal: true, ranking: false, luna: true, cumpleluna: false }), 2);
    assert.equal(contarModulos({ principal: false, ranking: false, luna: false, cumpleluna: false }), 0);
  });

  it("se omite cuando no hay ninguno: nunca «0 CAPAS»", () => {
    assert.equal(etiquetaDeModulos(0), null);
    assert.equal(etiquetaDeModulos(-1), null);
    assert.equal(etiquetaDeModulos(Number.NaN), null);
  });

  it("concuerda en singular y plural", () => {
    assert.equal(etiquetaDeModulos(1), "1 CAPA");
    assert.equal(etiquetaDeModulos(4), "4 CAPAS");
  });
});

describe("el contexto del año (CORE-237)", () => {
  it("escribe «Tu año de …» sólo con un tema listo, con el titular de la casa si lo hay", () => {
    assert.equal(contextoDelAno({ status: "ready", houseTheme: "rutinas, tareas, cuidado y trabajo cotidiano" }, "rutinas, tareas y organización cotidiana"), "Tu año de rutinas, tareas y organización cotidiana");
    assert.equal(contextoDelAno({ status: "ready", houseTheme: "vínculos y acuerdos" }, null), "Tu año de vínculos y acuerdos");
    assert.equal(contextoDelAno({ status: "ready", houseTheme: "   " }, null), null, "sin tema escrito no hay contexto");
    assert.equal(contextoDelAno({ status: "needs_birth_time" }, "algo"), null, "sin profección no se inventa contexto");
    assert.equal(contextoDelAno(null, "algo"), null);
  });
});
