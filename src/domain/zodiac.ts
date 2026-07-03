import { ZodiacSign } from "./types";

type ZodiacRange = {
  sign: ZodiacSign;
  start: [number, number];
  end: [number, number];
};

const ranges: ZodiacRange[] = [
  { sign: "capricornio", start: [12, 22], end: [1, 19] },
  { sign: "acuario", start: [1, 20], end: [2, 18] },
  { sign: "piscis", start: [2, 19], end: [3, 20] },
  { sign: "aries", start: [3, 21], end: [4, 19] },
  { sign: "tauro", start: [4, 20], end: [5, 20] },
  { sign: "geminis", start: [5, 21], end: [6, 20] },
  { sign: "cancer", start: [6, 21], end: [7, 22] },
  { sign: "leo", start: [7, 23], end: [8, 22] },
  { sign: "virgo", start: [8, 23], end: [9, 22] },
  { sign: "libra", start: [9, 23], end: [10, 22] },
  { sign: "escorpio", start: [10, 23], end: [11, 21] },
  { sign: "sagitario", start: [11, 22], end: [12, 21] }
];

export const signLabels: Record<ZodiacSign, string> = {
  aries: "Aries",
  tauro: "Tauro",
  geminis: "Geminis",
  cancer: "Cancer",
  leo: "Leo",
  virgo: "Virgo",
  libra: "Libra",
  escorpio: "Escorpio",
  sagitario: "Sagitario",
  capricornio: "Capricornio",
  acuario: "Acuario",
  piscis: "Piscis"
};

export function getZodiacSign(birthDate: string): ZodiacSign {
  const [year, month, day] = birthDate.split("-").map(Number);
  const validDate = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day);

  if (!validDate || month < 1 || month > 12 || day < 1 || day > 31) {
    return "aries";
  }

  const matching = ranges.find((range) => {
    const [startMonth, startDay] = range.start;
    const [endMonth, endDay] = range.end;

    if (startMonth > endMonth) {
      return (month === startMonth && day >= startDay) || (month === endMonth && day <= endDay);
    }

    return (
      (month === startMonth && day >= startDay) ||
      (month === endMonth && day <= endDay) ||
      (month > startMonth && month < endMonth)
    );
  });

  return matching?.sign ?? "aries";
}

export function formatSign(sign: ZodiacSign): string {
  return signLabels[sign];
}
