export type CivilTimeInvalidReason = "date" | "time" | "timezone";

export type CivilTimeCandidate = {
  instantMs: number;
  offsetMinutes: number;
};

export type CivilTimeResolution =
  | ({ status: "exact" } & CivilTimeCandidate)
  | { status: "gap"; candidates: [] }
  | { status: "fold"; candidates: CivilTimeCandidate[] }
  | { status: "invalid"; reason: CivilTimeInvalidReason; candidates: [] };

type CivilParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function utcMilliseconds(parts: CivilParts) {
  const instant = new Date(0);
  instant.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  instant.setUTCHours(parts.hour, parts.minute, parts.second, 0);
  return instant.getTime();
}

function parseDate(localDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return null;
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: 0,
    minute: 0,
    second: 0,
  } satisfies CivilParts;
  const instant = new Date(utcMilliseconds(parts));
  return instant.getUTCFullYear() === parts.year &&
    instant.getUTCMonth() === parts.month - 1 &&
    instant.getUTCDate() === parts.day
    ? parts
    : null;
}

function parseTime(localTime: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(localTime);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

function formatterFor(timezone: string) {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    // Some runtimes delay validating the IANA identifier until the first format.
    formatter.format(new Date(0));
    return formatter;
  } catch {
    return null;
  }
}

function formatParts(formatter: Intl.DateTimeFormat, instantMs: number): CivilParts | null {
  try {
    const values = new Map(
      formatter
        .formatToParts(new Date(instantMs))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );
    const parts = {
      year: values.get("year"),
      month: values.get("month"),
      day: values.get("day"),
      hour: values.get("hour"),
      minute: values.get("minute"),
      second: values.get("second"),
    };
    return Object.values(parts).every((value) => Number.isFinite(value))
      ? (parts as CivilParts)
      : null;
  } catch {
    return null;
  }
}

function sameCivilMinute(left: CivilParts, right: CivilParts) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

/**
 * Resuelve una hora de pared a un instante real sin adivinar durante cambios de
 * reloj. Un salto devuelve `gap`; una hora repetida devuelve las dos ocurrencias
 * como `fold`. El llamador decide cómo degradar el producto en ambos casos.
 */
export function resolveZonedCivilTime(args: {
  localDate: string;
  localTime: string;
  timezone: string;
}): CivilTimeResolution {
  const date = parseDate(args.localDate);
  if (!date) return { status: "invalid", reason: "date", candidates: [] };
  const time = parseTime(args.localTime);
  if (!time) return { status: "invalid", reason: "time", candidates: [] };
  const formatter = formatterFor(args.timezone);
  if (!formatter) return { status: "invalid", reason: "timezone", candidates: [] };

  const requested = { ...date, ...time } satisfies CivilParts;
  const wallClockMs = utcMilliseconds(requested);
  const offsets = new Set<number>();

  // Sampling both sides of the requested day discovers the offsets before and
  // after a clock change. Candidate instants are then verified by round-trip;
  // no sampled value is accepted merely because its offset looks plausible.
  for (let deltaHours = -36; deltaHours <= 36; deltaHours += 1) {
    const sampledInstantMs = wallClockMs + deltaHours * 60 * 60 * 1000;
    const sampledCivil = formatParts(formatter, sampledInstantMs);
    if (sampledCivil) {
      offsets.add(utcMilliseconds(sampledCivil) - sampledInstantMs);
    }
  }

  const matches = Array.from(offsets)
    .map((offsetMs) => wallClockMs - offsetMs)
    .filter((instantMs) => {
      const formatted = formatParts(formatter, instantMs);
      return Boolean(formatted && sameCivilMinute(formatted, requested));
    })
    .filter((instantMs, index, all) => all.indexOf(instantMs) === index)
    .sort((left, right) => left - right)
    .map((instantMs) => ({
      instantMs,
      offsetMinutes: (wallClockMs - instantMs) / (60 * 1000),
    }));

  if (matches.length === 1) return { status: "exact", ...matches[0] };
  if (matches.length > 1) return { status: "fold", candidates: matches };
  return { status: "gap", candidates: [] };
}
