/**
 * Orden canónico del onboarding aprobado (Figma `BEB5v6SbgJn2Nipm8Qa0wE`,
 * página `1139:2`, propuesta `1139:3`): la cuenta abre el flujo, los datos
 * natales se cargan una sola vez y se confirman en un único resumen editable,
 * la tríada es una única superficie no bloqueante y toda salida del paywall
 * entra directo a Carta.
 *
 * Los índices se nombran a propósito: el camino de escritura y los tests
 * dependen de ellos, y un renumerado silencioso ya costó datos.
 */
export const ONBOARDING_TOTAL = 11;

/** 01 — Crear cuenta o ingresar: la PRIMERA superficie del flujo. */
export const STEP_AUTH = 0;
/** 02 — Promesa inmersiva. */
export const STEP_PROMISE = 1;
/** 03 — Identidad y propuesta personal. */
export const STEP_IDENTITY = 2;
/** 04 — Orientación sobre la guía diaria. */
export const STEP_GUIDANCE = 3;
/** 05 — Fecha de nacimiento. */
export const STEP_BIRTHDATE = 4;
/** 06 — Lugar de nacimiento. */
export const STEP_BIRTHPLACE = 5;
/** 07 — Hora de nacimiento ("No sé la hora" vive EN esta pantalla). */
export const STEP_BIRTHTIME = 6;
/** 08 — "Estos son tus datos": único resumen editable; CTA "Preparar mi carta". */
export const STEP_SUMMARY = 7;
/** 09 — Única superficie de cálculo: "Preparando tu carta…" → "Tu carta ya está lista". */
export const STEP_TRIAD = 8;
/** 10 — Antes y después de Órbita. */
export const STEP_BEFORE_AFTER = 9;
/** 11 — Paywall aprobado; compra, restauración y "Seguir gratis" entran a Carta. */
export const STEP_PAYWALL = 10;
