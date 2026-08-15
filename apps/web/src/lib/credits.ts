/** Client helpers for MagicBox credit / free-trial UI. */

export const DEFAULT_TRIAL_I = 50;
export const DEFAULT_TRIAL_V = 100;
export const DEFAULT_TRIAL_DAYS = 7;

export type CreditBalanceLike = {
  iCredits?: number;
  vCredits?: number;
  trialExpiresAt?: number | null;
  trialGrantedAt?: number | null;
  trialDurationDays?: number;
  trialGranted?: boolean;
  needsTrialClaim?: boolean;
  hasPaidPlan?: boolean;
  freeTrial?: { i: number; v: number; days: number };
};

export type TrialClock = {
  /** Full days left, ceiling (so 1h left → 1 day). 0 when expired. */
  daysLeft: number;
  /** 0–1 progress through the trial window (1 = just started). */
  progress: number;
  expired: boolean;
  /** e.g. "Jul 30" */
  endsOnLabel: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 7;

function resolveExpiresAt(balance: CreditBalanceLike): number | null {
  if (typeof balance.trialExpiresAt === "number" && balance.trialExpiresAt > 0) {
    return balance.trialExpiresAt;
  }
  if (typeof balance.trialGrantedAt === "number" && balance.trialGrantedAt > 0) {
    const days = balance.trialDurationDays ?? DEFAULT_DAYS;
    return balance.trialGrantedAt + days * DAY_MS;
  }
  return null;
}

/**
 * Returns null only when the user is on a paid plan or we have no trial signal.
 * Prefer server `trialExpiresAt`; fall back to `trialGrantedAt + duration`.
 */
export function trialClock(
  balance: CreditBalanceLike | null | undefined,
  now = Date.now(),
): TrialClock | null {
  if (!balance || balance.hasPaidPlan) return null;

  const durationDays = balance.trialDurationDays ?? DEFAULT_DAYS;
  const expiresAt = resolveExpiresAt(balance);

  // Backend hasn't sent timestamps yet (stale deploy or new user before claim mutation writes) —
  // still show a full 7-day window so the UI never looks "broken".
  if (!expiresAt) {
    if (!balance.trialGranted && !balance.needsTrialClaim) return null;
    return {
      daysLeft: durationDays,
      progress: 1,
      expired: false,
      endsOnLabel: null,
    };
  }

  const durationMs = durationDays * DAY_MS;
  const msLeft = expiresAt - now;
  const expired = msLeft <= 0;
  const daysLeft = expired ? 0 : Math.max(1, Math.ceil(msLeft / DAY_MS));
  const progress = expired ? 0 : Math.min(1, Math.max(0, msLeft / durationMs));

  return {
    daysLeft,
    progress,
    expired,
    endsOnLabel: new Date(expiresAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  };
}

export function trialStatusCopy(clock: TrialClock): string {
  if (clock.expired) return "Trial ended";
  if (clock.daysLeft === 1) return "1 day left";
  return `${clock.daysLeft} days left`;
}
