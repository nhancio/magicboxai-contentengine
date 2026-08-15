// Central landing-page config.
//
// APP_URL points at the product app:
//   - local `npm run dev` / ./run.sh → http://localhost:8174
//   - production build → https://app.magicboxai.in
// Override anytime with VITE_APP_URL.

const PROD_APP_URL = "https://app.magicboxai.in";
const LOCAL_APP_URL = "http://localhost:8174";

export const APP_URL =
  (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, "") ||
  (import.meta.env.DEV ? LOCAL_APP_URL : PROD_APP_URL);

/**
 * Send visitors through sign-in before any paid checkout can be created.
 *
 * `intent=google` tells the app to hand off to the Google account chooser on
 * arrival, so a CTA click is one hop to Google rather than landing on a second
 * "Sign in" button. The app falls back to its normal sign-in card if the
 * handoff can't run, so this is always safe to include.
 */
export function appLoginUrl(redirectTo = "/") {
  return `${APP_URL}/login?intent=google&redirect=${encodeURIComponent(redirectTo)}`;
}

/**
 * Sign-in for visitors with no particular destination in mind ("Sign in",
 * "Get started"). Lands them wherever the app decides — onboarding if they
 * haven't finished it, the dashboard otherwise.
 */
export function appSignInUrl() {
  return `${APP_URL}/login?intent=google`;
}

const PROD_GUEST_CHECKOUT_URL =
  "https://us-central1-magicboxai-50927.cloudfunctions.net/createGuestCheckout";

/** Override with VITE_GUEST_CHECKOUT_URL when testing against a deployed dev project. */
const GUEST_CHECKOUT_URL =
  (import.meta.env.VITE_GUEST_CHECKOUT_URL as string | undefined) || PROD_GUEST_CHECKOUT_URL;

/**
 * Paid plans go straight to a Dodo hosted checkout — no account required
 * first. The visitor pays with whatever email they choose; MagicBox links
 * that payment to their account the moment they sign in with the same email.
 */
export function guestCheckoutUrl(planId: "pro" | "max", billing: "monthly" | "annual") {
  return `${GUEST_CHECKOUT_URL}?plan=${planId}&billing=${billing}`;
}

// Google Calendar appointment scheduling page — same booking link the app's
// Pricing page (apps/web/src/pages/Pricing.tsx) opens for its Custom plan CTA.
export const BOOKING_URL = "https://calendar.app.google/TH9bgDRMEdDpLvD68";
