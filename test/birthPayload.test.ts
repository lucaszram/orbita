import assert from "node:assert/strict";
import test from "node:test";
import {
  BirthPayloadError,
  birthPayloadMessage,
  validateBirthPayload,
  type BirthPayloadCandidate
} from "../src/domain/birthPayload";

const VALIDO: BirthPayloadCandidate = {
  birthDate: "1996-11-11",
  birthTime: "10:32",
  birthPlaceLabel: "Ciudad Autónoma de Buenos Aires, Argentina",
  latitude: -34.6,
  longitude: -58.44,
  timezone: "America/Argentina/Buenos_Aires"
};

// El alta rellenaba lo que faltaba: `?? "Sin especificar"` para el lugar y
// `?? deviceTimezone()` para la zona. Con eso una carta se calculaba sobre un
// lugar que la persona nunca eligió y sobre la zona del aparato.

test("un payload completo pasa y conserva los datos", () => {
  const out = validateBirthPayload(VALIDO);
  assert.equal(out.birthPlaceLabel, VALIDO.birthPlaceLabel);
  assert.equal(out.latitude, -34.6);
  assert.equal(out.timezone, "America/Argentina/Buenos_Aires");
});

test("la hora desconocida es válida: no todos la saben", () => {
  const out = validateBirthPayload({ ...VALIDO, birthTime: undefined });
  assert.equal(out.birthTime, undefined);
});

test('"Sin especificar" no es un lugar elegido', () => {
  for (const birthPlaceLabel of [undefined, "", "   ", "Sin especificar", "sin especificar"]) {
    assert.throws(
      () => validateBirthPayload({ ...VALIDO, birthPlaceLabel }),
      (e: unknown) => e instanceof BirthPayloadError && e.problem === "lugarFaltante",
      `debía rechazar: ${JSON.stringify(birthPlaceLabel)}`
    );
  }
});

test("sin coordenadas finitas no hay ascendente ni casas: se rechaza", () => {
  for (const coords of [
    { latitude: undefined, longitude: -58.44 },
    { latitude: -34.6, longitude: undefined },
    { latitude: NaN, longitude: -58.44 },
    { latitude: Infinity, longitude: -58.44 },
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: 181 }
  ]) {
    assert.throws(
      () => validateBirthPayload({ ...VALIDO, ...coords }),
      (e: unknown) => e instanceof BirthPayloadError && e.problem === "coordenadasFaltantes",
      `debía rechazar: ${JSON.stringify(coords)}`
    );
  }
});

test("la zona horaria no se completa con la del dispositivo", () => {
  for (const timezone of [undefined, "", "  "]) {
    assert.throws(
      () => validateBirthPayload({ ...VALIDO, timezone }),
      (e: unknown) => e instanceof BirthPayloadError && e.problem === "zonaFaltante"
    );
  }
});

test("una fecha faltante o mal formada se rechaza", () => {
  for (const birthDate of [undefined, "", "11/11/1996", "1996-11"]) {
    assert.throws(
      () => validateBirthPayload({ ...VALIDO, birthDate }),
      (e: unknown) => e instanceof BirthPayloadError && e.problem === "fechaFaltante"
    );
  }
});

test("cada motivo tiene un mensaje concreto, sin jerga", () => {
  for (const problem of ["fechaFaltante", "lugarFaltante", "coordenadasFaltantes", "zonaFaltante"] as const) {
    const msg = birthPayloadMessage(problem);
    assert.ok(msg.length > 20, problem);
    assert.ok(!/undefined|null|Error|payload/i.test(msg), `${problem} filtra jerga: ${msg}`);
  }
});

// --- Escenarios reales del editor -------------------------------------------
// Lo que se valida es el payload FINAL que arma `buildBackendBirthPayload`:
// según si el lugar cambió, arrastra el doc remoto o usa el elegido.

const REMOTO_INCOMPLETO = {
  birthPlaceLabel: "Sin especificar",
  latitude: undefined,
  longitude: undefined,
  timezone: "America/Argentina/Buenos_Aires"
};
const REMOTO_COMPLETO = {
  birthPlaceLabel: "Ciudad Autónoma de Buenos Aires, Argentina",
  latitude: -34.6,
  longitude: -58.44,
  timezone: "America/Argentina/Buenos_Aires"
};

test("documento incompleto + cambiar sólo la hora → cero escrituras", () => {
  // El arrastre conserva el lugar vacío del doc: se rechaza antes de escribir.
  const payload = { birthDate: "1996-11-11", birthTime: "11:00", ...REMOTO_INCOMPLETO };
  assert.throws(
    () => validateBirthPayload(payload),
    (e: unknown) => e instanceof BirthPayloadError && e.problem === "lugarFaltante"
  );
});

test("documento incompleto sin lugar pero con coords → igual se rechaza por el lugar", () => {
  const payload = { birthDate: "1996-11-11", birthTime: "11:00", ...REMOTO_INCOMPLETO, latitude: -34.6, longitude: -58.44 };
  assert.throws(() => validateBirthPayload(payload), BirthPayloadError);
});

test("documento COMPLETO + cambiar sólo la hora sigue siendo válido", () => {
  const out = validateBirthPayload({ birthDate: "1996-11-11", birthTime: "11:00", ...REMOTO_COMPLETO });
  assert.equal(out.birthTime, "11:00");
  assert.equal(out.birthPlaceLabel, REMOTO_COMPLETO.birthPlaceLabel);
  assert.equal(out.latitude, -34.6);
});

test("elegir un lugar nuevo válido pasa, aunque el doc remoto esté roto", () => {
  // Es el camino de la recuperación: re-elegir el lugar trae coords y zona.
  const out = validateBirthPayload({
    birthDate: "1996-11-11",
    birthTime: "10:32",
    birthPlaceLabel: "Ciudad Autónoma de Buenos Aires, Argentina",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires"
  });
  assert.equal(out.birthPlaceLabel, "Ciudad Autónoma de Buenos Aires, Argentina");
  assert.equal(out.timezone, "America/Argentina/Buenos_Aires");
});
