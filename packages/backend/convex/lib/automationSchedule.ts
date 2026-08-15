import { zonedParts, zonedWallClockToUtc } from "./bestTime";

export type AutomationSchedule = {
  type: "recurring" | "once";
  time: string;
  daysOfWeek?: number[];
  timezone: string;
  endAt?: number;
};

/**
 * Next fire time strictly after `afterMs`, DST-safe via Intl (no luxon).
 * Returns null when a bounded schedule never fires again.
 */
export function computeNextRunAt(schedule: AutomationSchedule, afterMs: number): number | null {
  const [hourStr, minuteStr] = (schedule.time || "07:00").split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid schedule time: ${schedule.time}`);
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: schedule.timezone }).format();
  } catch {
    throw new Error("Schedule timezone must be a valid IANA timezone");
  }

  const start = zonedParts(afterMs, schedule.timezone);
  for (let i = 0; i <= 8; i++) {
    const probe = Date.UTC(start.year, start.month - 1, start.day + i, 12, 0, 0);
    const day = zonedParts(probe, schedule.timezone);
    const at = zonedWallClockToUtc(day.year, day.month, day.day, hour, minute, schedule.timezone);
    if (at <= afterMs) continue;
    if (schedule.daysOfWeek?.length && !schedule.daysOfWeek.includes(day.dayOfWeek)) continue;
    if (schedule.endAt !== undefined && at > schedule.endAt) return null;
    return at;
  }
  return null;
}
