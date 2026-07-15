export const PAID_POST_LIMITS = {
  pro: 60,
  max: 300,
} as const;

export type PaidPlan = keyof typeof PAID_POST_LIMITS;

type TimestampLike = { toMillis?: () => number };

/**
 * Parse the one publishing entitlement used by callables, quota reporting,
 * and the final provider boundary. Missing, malformed, inactive, unknown, or
 * expired subscription records all fail closed.
 */
export function activePaidPostEntitlement(
  subscription: unknown,
  nowMs = Date.now()
): { plan: PaidPlan; limit: number; currentPeriodEndMs: number } | null {
  const data = subscription as
    | { plan?: unknown; status?: unknown; currentPeriodEnd?: TimestampLike }
    | undefined;
  if (
    data?.status !== "active" ||
    (data.plan !== "pro" && data.plan !== "max") ||
    typeof data.currentPeriodEnd?.toMillis !== "function"
  ) {
    return null;
  }

  try {
    const currentPeriodEndMs = data.currentPeriodEnd.toMillis();
    if (!Number.isFinite(currentPeriodEndMs) || currentPeriodEndMs <= nowMs) return null;
    return {
      plan: data.plan,
      limit: PAID_POST_LIMITS[data.plan],
      currentPeriodEndMs,
    };
  } catch {
    return null;
  }
}
