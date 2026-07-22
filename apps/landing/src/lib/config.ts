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

// Cloud Functions base — the public guest-checkout endpoint lives here.
export const FUNCTIONS_URL =
  (import.meta.env.VITE_FUNCTIONS_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://us-central1-magicboxai-50927.cloudfunctions.net";

// A real scheduling link has not been provisioned, so sales CTAs use a working
// support mailbox instead of sending visitors to a speculative Calendly URL.
export const CALENDLY_URL = "mailto:support@magicboxai.in?subject=MagicBox%20sales";
