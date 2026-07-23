"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateFixedWindowRateLimit = evaluateFixedWindowRateLimit;
function assertConfig(config, nowMs) {
    if (!Number.isSafeInteger(config.limit) ||
        config.limit < 1 ||
        !Number.isSafeInteger(config.windowMs) ||
        config.windowMs < 1 ||
        !Number.isSafeInteger(nowMs) ||
        nowMs < 0) {
        throw new Error("Invalid rate-limit configuration");
    }
}
function safeNonNegativeInteger(value, fallback) {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
        ? value
        : fallback;
}
/** Decide whether a request fits in the caller's current fixed window. */
function evaluateFixedWindowRateLimit(state, config, nowMs = Date.now()) {
    assertConfig(config, nowMs);
    let windowStartedAtMs = safeNonNegativeInteger(state === null || state === void 0 ? void 0 : state.windowStartedAtMs, nowMs);
    let count = safeNonNegativeInteger(state === null || state === void 0 ? void 0 : state.count, 0);
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
//# sourceMappingURL=rate-limit.js.map