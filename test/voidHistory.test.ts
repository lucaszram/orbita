import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  historyItemToAnswerPayload,
  isVoidHistoryItem,
  parseVoidHistory,
  voidBackAction,
  voidHistoryDateLabel
} from "../src/domain/voidHistory";
import type { VoidHistoryItem } from "../src/services/appRefs";

const ITEM: VoidHistoryItem = {
  answerId: "va_1",
  localDate: "2026-07-18",
  question: "¿Qué estás apurando?",
  answer: "Estás corriendo una decisión que pide una semana más.",
  basadoEn: ["TU LUNA EN ESCORPIO"],
  mejorPregunta: "¿Qué cambia si espero siete días?",
  paso: "Anotá hoy qué te apura y releelo el viernes.",
  createdAt: 1_784_500_000_000
};

describe("void.history — parser defensivo", () => {
  it("acepta la fila completa del contrato", () => {
    assert.equal(isVoidHistoryItem(ITEM), true);
    assert.deepEqual(parseVoidHistory([ITEM]), [ITEM]);
  });

  it("undefined / error / no-array → lista vacía (nunca rompe la pantalla)", () => {
    assert.deepEqual(parseVoidHistory(undefined), []);
    assert.deepEqual(parseVoidHistory(null), []);
    assert.deepEqual(parseVoidHistory("boom"), []);
    assert.deepEqual(parseVoidHistory({ rows: [ITEM] }), []);
  });

  it("descarta filas malformadas sin tirar las válidas", () => {
    const rows = [
      ITEM,
      null,
      "fila",
      { ...ITEM, answerId: "" },
      { ...ITEM, question: undefined },
      { ...ITEM, basadoEn: "TU LUNA" },
      { ...ITEM, basadoEn: ["ok", 3] },
      { ...ITEM, createdAt: "ayer" }
    ];
    assert.deepEqual(parseVoidHistory(rows), [ITEM]);
  });

  it("no reordena: el backend ya manda más nueva primero", () => {
    const older = { ...ITEM, answerId: "va_0", localDate: "2026-07-10" };
    assert.deepEqual(
      parseVoidHistory([ITEM, older]).map((r) => r.answerId),
      ["va_1", "va_0"]
    );
  });
});

describe("void.history — rótulo de fecha corta", () => {
  it("HOY para el mismo localDate", () => {
    assert.equal(voidHistoryDateLabel("2026-07-20", "2026-07-20"), "HOY");
  });

  it("DD MMM en español para días anteriores, sin cero a la izquierda", () => {
    assert.equal(voidHistoryDateLabel("2026-07-18", "2026-07-20"), "18 JUL");
    assert.equal(voidHistoryDateLabel("2026-01-05", "2026-07-20"), "5 ENE");
    assert.equal(voidHistoryDateLabel("2025-12-31", "2026-07-20"), "31 DIC");
  });

  it("fecha rara → se muestra cruda antes que inventar un mes", () => {
    assert.equal(voidHistoryDateLabel("2026-13-01", "2026-07-20"), "2026-13-01");
    assert.equal(voidHistoryDateLabel("sin-fecha", "2026-07-20"), "sin-fecha");
  });
});

describe("void.history — reabrir una respuesta guardada", () => {
  it("mapea la fila a la forma de `respuesta` sin tocar cupo (sin remaining/limit/locked)", () => {
    assert.deepEqual(historyItemToAnswerPayload(ITEM), {
      question: ITEM.question,
      answer: ITEM.answer,
      basadoEn: ITEM.basadoEn,
      mejorPregunta: ITEM.mejorPregunta,
      paso: ITEM.paso
    });
  });
});

describe("void — comportamiento de la flecha por fase", () => {
  it("respuesta SIEMPRE vuelve a las preguntas, también en la raíz del tab", () => {
    assert.equal(voidBackAction("respuesta", false), "volver-a-preguntas");
    assert.equal(voidBackAction("respuesta", true), "volver-a-preguntas");
  });

  it("entrada solo sale de la ruta en el montaje profundo", () => {
    assert.equal(voidBackAction("entrada", true), "salir");
    assert.equal(voidBackAction("entrada", false), "oculta");
  });

  it("escuchando la oculta: no se abandona una action en vuelo", () => {
    assert.equal(voidBackAction("escuchando", true), "oculta");
    assert.equal(voidBackAction("escuchando", false), "oculta");
  });
});
