// nextRunAt computation for automation schedules. Schedules are expressed as
// local wall-clock time ("HH:mm") + optional daysOfWeek in an IANA timezone,
// which luxon evaluates DST-safely. (A raw cron string, if present on the
// doc, is informational — the UI always produces time/daysOfWeek.)

import { DateTime } from "luxon";
import type { AutomationScheduleDoc } from "./core";

/** 0 = Sunday ... 6 = Saturday (JS convention; luxon weekday is 1=Mon..7=Sun) */
function matchesDayOfWeek(dt: DateTime, daysOfWeek?: number[]): boolean {
  if (!daysOfWeek || daysOfWeek.length === 0) return true;
  const jsDay = dt.weekday % 7; // luxon 7 (Sun) -> 0
  return daysOfWeek.includes(jsDay);
}

/**
 * Compute the next fire time strictly after `after` (defaults to now).
 * Returns null for one-off schedules that already fired.
 */
export function computeNextRunAt(
  schedule: AutomationScheduleDoc,
  after: Date = new Date()
): Date | null {
  const [hourStr, minuteStr] = (schedule.time || "07:00").split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error(`Invalid schedule time: ${schedule.time}`);
  }

  const zone = schedule.timezone || "UTC";
  const afterDt = DateTime.fromJSDate(after, { zone });
  if (!afterDt.isValid) throw new Error(`Invalid timezone: ${zone}`);

  const startAt = schedule.startAt ? schedule.startAt.toDate() : undefined;
  const floor =
    startAt && startAt > after ? DateTime.fromJSDate(startAt, { zone }) : afterDt;

  // Scan up to 8 days ahead — covers any daysOfWeek combination.
  for (let i = 0; i <= 8; i++) {
    const candidate = floor
      .plus({ days: i })
      .set({ hour, minute, second: 0, millisecond: 0 });
    if (candidate <= floor) continue;
    if (!matchesDayOfWeek(candidate, schedule.daysOfWeek)) continue;
    if (schedule.endAt && candidate.toJSDate() > schedule.endAt.toDate()) return null;
    return candidate.toJSDate();
  }
  return null;
}
