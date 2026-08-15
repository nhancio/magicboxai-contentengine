import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * MagicBox scheduled jobs (Convex-native replacement for the Firebase 3-tick
 * scheduler in functions/src/scheduler.ts).
 *
 * Cadence rationale:
 *  - trends: once daily. Trend data has ~24h of useful life and each run costs
 *    real Gemini grounding calls; hourly would burn quota for no signal gain.
 *  - maya: hourly, but each run only generates for users whose LOCAL time just
 *    hit their review hour. One UTC cron therefore serves every timezone
 *    without a per-user schedule.
 *  - publish: every minute. This is the latency floor for "post at 9:00" —
 *    anything slower and scheduled posts visibly drift.
 */
const crons = cronJobs();

crons.daily(
  "refresh trends",
  { hourUTC: 1, minuteUTC: 0 }, // ~06:30 IST — before any user's review hour
  internal.trends.refresh,
);

crons.daily(
  "maya 9am 7-day social deck",
  { hourUTC: 3, minuteUTC: 30 }, // 09:00 AM IST (03:30 UTC) - daily 9am deck generation
  internal.maya.generateDaily,
);

crons.hourly(
  "maya daily decks hourly timezone check",
  { minuteUTC: 10 }, // offset from the top of the hour to dodge cron pile-up across all timezones
  internal.maya.generateDaily,
);

crons.interval("publish due posts", { minutes: 1 }, internal.scheduler.publishTick);

crons.interval("automation tick", { minutes: 5 }, internal.automations.tick);

export default crons;
