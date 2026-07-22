/**
 * Best-time-to-post slot engine.
 *
 * Right-swiping a Maya suggestion must NOT prompt for a datetime — the whole
 * point is a 10-second review. Instead every user has a weekly template of
 * posting windows per platform, and an approved suggestion is bound to the next
 * OPEN slot (queue model, as Buffer/Taplio do).
 *
 * Cold start: seeded per-platform defaults below.
 * Warm phase: recompute from the user's own engagement and flip
 * `slotTemplates.source` to "learned". Kept a heuristic table on purpose —
 * there isn't enough data to justify anything cleverer, and a wrong "smart"
 * time is worse than a decent fixed one.
 */

export type Slot = { dayOfWeek: number; hour: number; minute: number };
export type Platform =
  | "instagram"
  | "facebook"
  | "twitter"
  | "linkedin"
  | "youtube"
  | "reddit";

/**
 * Seeded defaults from published platform-engagement guidance. These are
 * starting points, not claims of optimality — they get replaced by real data.
 */
export const DEFAULT_SLOTS: Record<Platform, Slot[]> = {
  // Business hours, midweek. LinkedIn dies on weekends.
  linkedin: [
    { dayOfWeek: 2, hour: 8, minute: 30 },
    { dayOfWeek: 3, hour: 9, minute: 0 },
    { dayOfWeek: 4, hour: 13, minute: 0 },
  ],
  // Late-morning + evening commute/scroll windows.
  instagram: [
    { dayOfWeek: 1, hour: 18, minute: 0 },
    { dayOfWeek: 3, hour: 9, minute: 0 },
    { dayOfWeek: 4, hour: 9, minute: 0 },
    { dayOfWeek: 5, hour: 18, minute: 0 },
    { dayOfWeek: 6, hour: 11, minute: 0 },
  ],
  facebook: [
    { dayOfWeek: 1, hour: 9, minute: 0 },
    { dayOfWeek: 3, hour: 9, minute: 0 },
    { dayOfWeek: 5, hour: 10, minute: 0 },
  ],
  twitter: [
    { dayOfWeek: 2, hour: 9, minute: 0 },
    { dayOfWeek: 3, hour: 9, minute: 0 },
    { dayOfWeek: 4, hour: 12, minute: 0 },
  ],
  // Evening — people watch long-form after work.
  youtube: [
    { dayOfWeek: 4, hour: 17, minute: 0 },
    { dayOfWeek: 5, hour: 17, minute: 0 },
    { dayOfWeek: 6, hour: 10, minute: 0 },
  ],
  reddit: [
    { dayOfWeek: 1, hour: 8, minute: 0 },
    { dayOfWeek: 3, hour: 8, minute: 0 },
    { dayOfWeek: 6, hour: 9, minute: 0 },
  ],
};

/**
 * Offset (ms) between UTC and `timeZone` at a given instant. Uses Intl rather
 * than a date library so this stays dependency-free in the Convex runtime.
 */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) % 24,
    Number(map.minute),
    Number(map.second),
  );
  return asUTC - date.getTime();
}

/**
 * Convert a wall-clock time in `timeZone` to an epoch-ms instant.
 * Applies the offset twice so DST transitions resolve correctly (the offset at
 * the guessed instant can differ from the offset at the true instant).
 */
export function zonedWallClockToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const off1 = timeZoneOffsetMs(new Date(guess), timeZone);
  let utc = guess - off1;
  const off2 = timeZoneOffsetMs(new Date(utc), timeZone);
  if (off2 !== off1) utc = guess - off2;
  return utc;
}

/** Calendar parts of `instant` as seen in `timeZone`. */
export function zonedParts(
  instant: number,
  timeZone: string,
): { year: number; month: number; day: number; dayOfWeek: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(instant))) map[p.type] = p.value;
  const dows: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    dayOfWeek: dows[map.weekday] ?? 0,
  };
}

/** YYYY-MM-DD as seen in `timeZone` — Maya's per-user batch key. */
export function localBatchDate(instant: number, timeZone: string): string {
  const { year, month, day } = zonedParts(instant, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Next open slot at or after `from`, skipping any instant already taken.
 *
 * `taken` makes the queue non-double-booking: approving five suggestions in a
 * row fills five distinct slots instead of stacking them all on one time.
 * Falls back to `from + 1h` if the template somehow yields nothing in 21 days,
 * so an approval can never silently fail to schedule.
 */
export function nextOpenSlot(opts: {
  slots: Slot[];
  timeZone: string;
  from: number;
  taken: number[];
  horizonDays?: number;
}): number {
  const { slots, timeZone, from, taken } = opts;
  if (slots.length === 0) return from + 60 * 60 * 1000;

  const takenSet = new Set(taken);
  const horizon = opts.horizonDays ?? 21;
  const dayMs = 24 * 60 * 60 * 1000;

  const candidates: number[] = [];
  for (let d = 0; d <= horizon; d++) {
    const probe = from + d * dayMs;
    const { year, month, day, dayOfWeek } = zonedParts(probe, timeZone);
    for (const s of slots) {
      if (s.dayOfWeek !== dayOfWeek) continue;
      const at = zonedWallClockToUtc(year, month, day, s.hour, s.minute, timeZone);
      // > from (not >=) so we never schedule in the past or exactly "now".
      if (at > from && !takenSet.has(at)) candidates.push(at);
    }
  }

  if (candidates.length === 0) return from + 60 * 60 * 1000;
  return Math.min(...candidates);
}
