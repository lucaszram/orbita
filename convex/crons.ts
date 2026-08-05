import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const internalApi = internal as any;
const crons = cronJobs();

// Argentina usa UTC-3: 12:00 UTC = 09:00 America/Argentina/Buenos_Aires.
// El action calcula y envía el día calendario anterior completo.
crons.daily(
  "telegram daily product digest",
  { hourUTC: 12, minuteUTC: 0 },
  internalApi.telemetry.sendDailyDigest,
  {}
);

// Retención de El Vacío: se ejecuta en lotes y vuelve a agendarse si quedan
// respuestas cuya antigüedad ya superó los 90 días exactos.
crons.daily(
  "refresh stale admin streaks",
  { hourUTC: 7, minuteUTC: 5 },
  internalApi.adminMaintenance.refreshStaleStreaks,
  {}
);

crons.daily(
  "cleanup expired Void answers",
  { hourUTC: 7, minuteUTC: 15 },
  internalApi.adminMaintenance.cleanupExpiredVoid,
  {}
);

export default crons;
