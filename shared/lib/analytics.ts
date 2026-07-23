// Lightweight PostHog loader (no npm dependency) shared across apps.
// Autocapture instruments all clicks/buttons/inputs and pageviews automatically.
// No-ops unless VITE_POSTHOG_KEY is set at build time, so it's safe to ship now.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    posthog?: any;
  }
}

const env = (import.meta as any).env ?? {};
const KEY: string | undefined = env.VITE_POSTHOG_KEY;
const HOST: string = env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

let started = false;

// --- cookie/analytics consent (GDPR) ---
// Analytics only starts after explicit consent; "denied" keeps it off for good.

const CONSENT_KEY = "mb_analytics_consent";

export type ConsentState = "granted" | "denied" | "unset";

export function getConsent(): ConsentState {
  if (typeof window === "undefined") return "unset";
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : "unset";
  } catch {
    return "unset";
  }
}

export function setConsent(state: "granted" | "denied"): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, state);
  } catch {
    /* storage unavailable — treat as session-only choice */
  }
  if (state === "granted") initAnalytics();
  else if (window.posthog?.opt_out_capturing) window.posthog.opt_out_capturing();
}

const STUB_METHODS =
  "init capture identify reset register register_once unregister people group alias set_config get_distinct_id onFeatureFlags isFeatureEnabled getFeatureFlag reloadFeatureFlags opt_in_capturing opt_out_capturing startSessionRecording stopSessionRecording debug".split(
    " "
  );

export type AnalyticsProperty = string | number | boolean | null | undefined;
export type AnalyticsProperties = Record<string, AnalyticsProperty>;

const SAFE_EVENT_NAME = /^[a-zA-Z0-9_.:-]{1,80}$/;
const SENSITIVE_PROPERTY = /(?:email|name|token|secret|password|oauth|authorization|caption|brief|prompt|content|url)/i;
const MAX_PROPERTIES = 30;
const MAX_STRING_LENGTH = 200;

/**
 * Product analytics should describe a workflow, never the customer's content
 * or credentials. Keep event properties flat, bounded, and non-sensitive so a
 * future call site cannot accidentally send an OAuth token, post copy, or PII.
 */
function safeProperties(props?: AnalyticsProperties): Record<string, string | number | boolean | null> | undefined {
  if (!props) return undefined;

  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(props)) {
    if (Object.keys(safe).length >= MAX_PROPERTIES || SENSITIVE_PROPERTY.test(key)) continue;
    if (typeof value === "string") safe[key] = value.slice(0, MAX_STRING_LENGTH);
    else if (typeof value === "number" && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === "boolean" || value === null) safe[key] = value;
  }
  return safe;
}

export function initAnalytics(): void {
  if (started || !KEY || typeof window === "undefined") return;
  if (getConsent() !== "granted") return; // wait for the consent banner
  started = true;

  // Stub-queue loader: queues calls, lazy-loads array.js, then replays them.
  const ph: any = (window.posthog = window.posthog || []);
  if (!ph.__SV) {
    ph._i = [];
    ph.init = function (token: string, config: unknown, name?: string) {
      const target: any = name ? (ph[name] = []) : ph;
      for (const m of STUB_METHODS) {
        target[m] = function () {
          target.push([m].concat(Array.prototype.slice.call(arguments, 0)));
        };
      }
      ph._i.push([token, config, name]);
    };
    ph.__SV = 1;

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = HOST.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js";
    const first = document.getElementsByTagName("script")[0];
    if (first && first.parentNode) first.parentNode.insertBefore(script, first);
    else document.head.appendChild(script);
  }

  ph.init(KEY, {
    api_host: HOST,
    capture_pageview: true,
    autocapture: true,
    person_profiles: "identified_only",
  });
}

export function capturePageview(): void {
  if (KEY && window.posthog) window.posthog.capture("$pageview");
}

export function captureEvent(event: string, props?: AnalyticsProperties): void {
  const eventName = event.trim();
  if (!SAFE_EVENT_NAME.test(eventName)) return;
  if (KEY && window.posthog) window.posthog.capture(eventName, safeProperties(props));
}

export function identifyUser(id: string, props?: AnalyticsProperties): void {
  if (KEY && window.posthog) window.posthog.identify(id, safeProperties(props));
}

export function resetAnalytics(): void {
  if (KEY && window.posthog) window.posthog.reset();
}

export const analyticsEnabled = Boolean(KEY);
