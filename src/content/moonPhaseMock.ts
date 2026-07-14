import type { MoonPhasePayload } from "@/services/skyRefs";

/** Mock tipado de la fase lunar (forma = sky.getMoonPhase). */
export const moonPhaseMock: MoonPhasePayload = {
  phase: "Luna creciente",
  phaseKey: "waxing_crescent",
  sign: "Tauro",
  illumination: 0.38,
  copy: "La Luna suma tierra: un buen momento para afirmar algo que venías dudando y darle cuerpo, sin apurarlo.",
  action: "Elegí una sola cosa para sostener esta semana y dejala a la vista."
};
