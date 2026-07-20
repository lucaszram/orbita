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

export default crons;
