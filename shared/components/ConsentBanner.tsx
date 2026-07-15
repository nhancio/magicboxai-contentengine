// Cookie/analytics consent banner (GDPR). Renders only while consent is
// undecided and an analytics key is configured; the choice persists in
// localStorage and gates PostHog via shared/lib/analytics.

import { useEffect, useState } from "react";
import { analyticsEnabled, getConsent, setConsent } from "../lib/analytics";

export default function ConsentBanner() {
  // Start hidden so server-rendered markup and the first client render match.
  // Consent is read only after hydration because localStorage is browser-only.
  const [mounted, setMounted] = useState(false);
  const [decided, setDecided] = useState(true);

  useEffect(() => {
    setDecided(getConsent() !== "unset");
    setMounted(true);
  }, []);

  if (!mounted || decided || !analyticsEnabled) return null;

  const choose = (state: "granted" | "denied") => {
    setConsent(state);
    setDecided(true);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-xl rounded-xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur">
      <p className="text-sm text-foreground">
        We use analytics cookies to understand how MagicBox is used and improve it. See our{" "}
        <a
          href="https://magicboxai.in/privacy.html"
          className="underline underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          privacy policy
        </a>
        .
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={() => choose("denied")}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Decline
        </button>
        <button
          onClick={() => choose("granted")}
          className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
