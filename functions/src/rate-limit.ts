/**
 * Pure fixed-window accounting used by the Firestore-backed callable limiter.
 * Keeping the decision logic free of Firebase dependencies makes edge cases
 * testable and ensures malformed persisted data fails closed to a fresh window
 * instead of blocking a customer indefinitely.
 */
export type FixedWindowRateLimit = {
  limit: number;
  windowMs: number;
};

export type FixedWindowState = {
  windowStartedAtMs?: unknown;
  count?: unknown;
};

export type FixedWindowDecision =
  | {
      allowed: true;
      count: number;
      windowStartedAtMs: number;
    }
  | {
      allowed: false;
      retryAfterMs: number;
    };

function assertConfig(config: FixedWindowRateLimit, nowMs: number): void {
  if (
    !Number.isSafeInteger(config.limit) ||
    config.limit < 1 ||
    !Number.isSafeInteger(config.windowMs) ||
    config.windowMs < 1 ||
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0
  ) {
    throw new Error("Invalid rate-limit configuration");
  }
}

function safeNonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : fallback;
}

/** Decide whether a request fits in the caller's current fixed window. */
export function evaluateFixedWindowRateLimit(
  state: FixedWindowState | undefined,
  config: FixedWindowRateLimit,
  nowMs = Date.now(),
): FixedWindowDecision {
  assertConfig(config, nowMs);

  let windowStartedAtMs = safeNonNegativeInteger(state?.windowStartedAtMs, nowMs);
  let count = safeNonNegativeInteger(state?.count, 0);
  const elapsedMs = nowMs - windowStartedAtMs;

  // A clock-skewed/future timestamp or expired window starts cleanly. Firestore
  // documents are server-only, but this keeps a corrupt record from locking out
  // the account forever.
  if (elapsedMs < 0 || elapsedMs >= config.windowMs) {
    windowStartedAtMs = nowMs;
    count = 0;
  }

  if (count >= config.limit) {
    return {
      allowed: false,
      retryAfterMs: Math.max(1, config.windowMs - Math.max(0, nowMs - windowStartedAtMs)),
    };
  }

  return {
    allowed: true,
    count: count + 1,
    windowStartedAtMs,
  };
}
