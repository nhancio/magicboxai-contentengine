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

/** Send visitors through sign-in before any paid checkout can be created. */
export function appLoginUrl(redirectTo = "/onboarding?preset=solo-founder") {
  return `${APP_URL}/login?redirect=${encodeURIComponent(redirectTo)}`;
}

// A real scheduling link has not been provisioned, so sales CTAs use a working
// support mailbox instead of sending visitors to a speculative Calendly URL.
export const CALENDLY_URL = "mailto:support@magicboxai.in?subject=MagicBox%20sales";
