// Lightweight PostHog loader (no npm dependency) shared across apps.
// Explicit events cover the approved product taxonomy. Broad DOM autocapture
// and session replay stay off so customer content is never recorded by default.
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

/**
 * Canonical product events. Keep these stable: saved funnels and historical
 * reports depend on the exact strings.
 */
export const PRODUCT_EVENTS = {
  loginStarted: "login_started",
  loginCompleted: "login_completed",
  loginCancelled: "login_cancelled",
  loginFailed: "login_failed",
  logoutCompleted: "logout_completed",
  onboardingStarted: "onboarding_started",
  onboardingStepViewed: "onboarding_step_viewed",
  onboardingWebsiteFetchStarted: "onboarding_website_fetch_started",
  onboardingWebsiteEnabled: "onboarding_website_enabled",
  onboardingWebsiteSkipped: "onboarding_website_skipped",
  channelConnectStarted: "channel_connect_started",
  channelConnected: "channel_connected",
  onboardingSocialSkipped: "onboarding_social_skipped",
  onboardingCompleted: "onboarding_completed",
  sidebarModuleAccessed: "sidebar_module_accessed",
  mayaActivationBlocked: "maya_activation_blocked",
  mayaActivated: "maya_activated",
} as const;

export type ProductEventName =
  (typeof PRODUCT_EVENTS)[keyof typeof PRODUCT_EVENTS];

export type TrackedProductAction = {
  event: ProductEventName;
  label: string;
  surface: "Authentication" | "Onboarding" | "Navigation" | "Maya";
  description: string;
};

/** Human-readable registry used by the admin analytics guide. */
export const TRACKED_PRODUCT_ACTIONS: readonly TrackedProductAction[] = [
  {
    event: PRODUCT_EVENTS.loginStarted,
    label: "Login started",
    surface: "Authentication",
    description: "A user begins Google sign-in.",
  },
  {
    event: PRODUCT_EVENTS.loginCompleted,
    label: "Login completed",
    surface: "Authentication",
    description: "Firebase confirms a signed-in user, once per browser session.",
  },
  {
    event: PRODUCT_EVENTS.loginCancelled,
    label: "Login cancelled",
    surface: "Authentication",
    description: "The user closes or cancels the Google sign-in flow.",
  },
  {
    event: PRODUCT_EVENTS.loginFailed,
    label: "Login failed",
    surface: "Authentication",
    description: "Google sign-in fails for a reason other than user cancellation.",
  },
  {
    event: PRODUCT_EVENTS.logoutCompleted,
    label: "Logout completed",
    surface: "Authentication",
    description: "A signed-in user chooses to sign out.",
  },
  {
    event: PRODUCT_EVENTS.onboardingStarted,
    label: "Onboarding started",
    surface: "Onboarding",
    description: "The website-first onboarding flow opens.",
  },
  {
    event: PRODUCT_EVENTS.onboardingStepViewed,
    label: "Onboarding step viewed",
    surface: "Onboarding",
    description: "The user sees the website, social-channel, or review step.",
  },
  {
    event: PRODUCT_EVENTS.onboardingWebsiteFetchStarted,
    label: "Website fetch started",
    surface: "Onboarding",
    description: "The user asks MagicBox to build a brand kit from a website.",
  },
  {
    event: PRODUCT_EVENTS.onboardingWebsiteEnabled,
    label: "Website enabled",
    surface: "Onboarding",
    description: "A website-derived brand kit is saved successfully.",
  },
  {
    event: PRODUCT_EVENTS.onboardingWebsiteSkipped,
    label: "Website skipped",
    surface: "Onboarding",
    description: "The user defers website setup and enters the dashboard.",
  },
  {
    event: PRODUCT_EVENTS.channelConnectStarted,
    label: "Social connection started",
    surface: "Onboarding",
    description: "The user starts connecting a supported social channel.",
  },
  {
    event: PRODUCT_EVENTS.channelConnected,
    label: "Social channel connected",
    surface: "Onboarding",
    description: "A social OAuth connection returns successfully.",
  },
  {
    event: PRODUCT_EVENTS.onboardingSocialSkipped,
    label: "Social setup skipped",
    surface: "Onboarding",
    description: "The user defers social setup after saving a website.",
  },
  {
    event: PRODUCT_EVENTS.onboardingCompleted,
    label: "Onboarding completed",
    surface: "Onboarding",
    description: "Website and at least one active social channel are ready.",
  },
  {
    event: PRODUCT_EVENTS.sidebarModuleAccessed,
    label: "Left-side module accessed",
    surface: "Navigation",
    description: "A signed-in user selects a module in the left navigation.",
  },
  {
    event: PRODUCT_EVENTS.mayaActivationBlocked,
    label: "Maya activation blocked",
    surface: "Maya",
    description: "Maya is opened without the required website or social channel.",
  },
  {
    event: PRODUCT_EVENTS.mayaActivated,
    label: "Maya activated",
    surface: "Maya",
    description: "Maya opens with both activation requirements satisfied.",
  },
] as const;

export const PRODUCT_FUNNELS = [
  {
    name: "Signup to Maya activation",
    events: [
      PRODUCT_EVENTS.loginCompleted,
      PRODUCT_EVENTS.onboardingWebsiteEnabled,
      PRODUCT_EVENTS.channelConnected,
      PRODUCT_EVENTS.mayaActivated,
    ],
  },
  {
    name: "Website onboarding completion",
    events: [
      PRODUCT_EVENTS.onboardingStarted,
      PRODUCT_EVENTS.onboardingWebsiteFetchStarted,
      PRODUCT_EVENTS.onboardingWebsiteEnabled,
      PRODUCT_EVENTS.onboardingCompleted,
    ],
  },
] as const;

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
    autocapture: false,
    disable_session_recording: true,
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
