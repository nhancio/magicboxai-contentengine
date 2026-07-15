"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAID_POST_LIMITS = void 0;
exports.activePaidPostEntitlement = activePaidPostEntitlement;
exports.PAID_POST_LIMITS = {
    pro: 60,
    max: 300,
};
/**
 * Parse the one publishing entitlement used by callables, quota reporting,
 * and the final provider boundary. Missing, malformed, inactive, unknown, or
 * expired subscription records all fail closed.
 */
function activePaidPostEntitlement(subscription, nowMs = Date.now()) {
    var _a;
    const data = subscription;
    if ((data === null || data === void 0 ? void 0 : data.status) !== "active" ||
        (data.plan !== "pro" && data.plan !== "max") ||
        typeof ((_a = data.currentPeriodEnd) === null || _a === void 0 ? void 0 : _a.toMillis) !== "function") {
        return null;
    }
    try {
        const currentPeriodEndMs = data.currentPeriodEnd.toMillis();
        if (!Number.isFinite(currentPeriodEndMs) || currentPeriodEndMs <= nowMs)
            return null;
        return {
            plan: data.plan,
            limit: exports.PAID_POST_LIMITS[data.plan],
            currentPeriodEndMs,
        };
    }
    catch (_b) {
        return null;
    }
}
//# sourceMappingURL=entitlements.js.map