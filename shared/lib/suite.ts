// Client wrappers for the marketing automation suite callables.

import { httpsCallable, type FunctionsErrorCode } from "firebase/functions";
import { FirebaseError } from "firebase/app";
import { appCheck, auth, functions } from "./firebase";
import type { SocialPlatform, SocialProvider } from "../types";

function errorCode(error: unknown): string {
  return error instanceof FirebaseError
    ? error.code.replace(/^functions\//, "")
    : "";
}

function friendlyCallableError(error: unknown): Error {
  if (error instanceof FirebaseError) {
    const code = errorCode(error) as FunctionsErrorCode | string;
    if (code === "internal" || code === "unknown") {
      return new Error(
        "Could not reach automation service. If this keeps happening, the Cloud Function may be blocking browser calls — ask an admin to set invoker=public and redeploy.",
      );
    }
    if (code === "unauthenticated") {
      if (auth?.currentUser && import.meta.env.PROD && !appCheck) {
        return new Error(
          "MagicBox browser verification is not configured. Please try again shortly.",
        );
      }
      // Reached only after a forced token refresh already failed, so the
      // session really is gone rather than merely stale.
      return new Error("Your session expired. Sign in again to continue.");
    }
    if (code === "failed-precondition" && /app check/i.test(error.message)) {
      return new Error("App Check blocked this request. Set VITE_FIREBASE_APPCHECK_SITE_KEY for local/prod.");
    }
    if (error.message && error.message.toLowerCase() !== "internal") {
      return new Error(error.message);
    }
    return new Error(code);
  }
  if (error instanceof Error) return error;
  return new Error("Could not save automation");
}

/**
 * Forces a new Firebase ID token, returning false when the session cannot be
 * revived. Callables carry whatever token the SDK has cached; if that token is
 * expired — or the device clock is skewed, or Safari evicted the auth store
 * mid-session — Cloud Functions rejects the call as `unauthenticated` even
 * though the app still shows a signed-in user.
 */
async function refreshSession(): Promise<boolean> {
  const current = auth?.currentUser;
  if (!current) return false;
  try {
    await current.getIdToken(true);
    return true;
  } catch (e) {
    console.warn("Could not refresh the Firebase ID token", e);
    return false;
  }
}

function callable<Req, Res>(name: string) {
  return async (data: Req): Promise<Res> => {
    if (!functions) throw new Error("Firebase Functions not initialized");
    const fn = httpsCallable<Req, Res>(functions, name);
    try {
      const result = await fn(data);
      return result.data;
    } catch (error) {
      // A stale token is the common cause here and it is fully recoverable, so
      // mint a fresh one and retry once before telling the user to sign in.
      if (errorCode(error) === "unauthenticated" && (await refreshSession())) {
        try {
          const retried = await fn(data);
          return retried.data;
        } catch (retryError) {
          throw friendlyCallableError(retryError);
        }
      }
      throw friendlyCallableError(error);
    }
  };
}

/** Returns the provider consent URL to redirect the browser to. */
export const getSocialConnectUrl = callable<
  { provider: SocialProvider; returnTo?: string },
  { url: string }
>("getSocialConnectUrl");

export const disconnectSocialAccount = callable<
  { accountId: string },
  { success: boolean }
>("disconnectSocialAccount");

/**
 * Kick off the OAuth flow for a provider by redirecting the current tab to the
 * provider's consent screen. On return the app lands on `returnTo`
 * (default: the current path) with ?social=connected|error.
 */
export async function connectSocial(
  provider: SocialProvider,
  returnTo: string = window.location.pathname
): Promise<void> {
  const { url } = await getSocialConnectUrl({ provider, returnTo });
  window.location.href = url;
}

export interface AutomationPayload {
  id?: string;
  name: string;
  brief: string;
  brandProfileId?: string;
  platforms: SocialPlatform[];
  socialAccountIds: string[];
  contentTypes: { text: boolean; image: boolean; video: boolean };
  preset: string;
  tone: string;
  schedule: {
    type: "recurring" | "once";
    time: string;
    daysOfWeek?: number[];
    timezone: string;
  };
  requiresApproval?: boolean;
  status?: "active" | "paused" | "draft";
}

export const createAutomation = callable<
  AutomationPayload,
  { id: string; nextRunAt: string }
>("createAutomation");

export const updateAutomation = callable<
  AutomationPayload & { id: string },
  { id: string; nextRunAt: string }
>("updateAutomation");

export const runAutomationNow = callable<
  { automationId: string },
  { postId: string; status: string }
>("runAutomationNow");

export const generatePreviewContent = callable<
  {
    brief: string;
    platform: SocialPlatform;
    preset?: string;
    tone?: string;
    brandProfileId?: string;
  },
  { caption: string; hashtags: string[] }
>("generatePreviewContent");

export const approvePost = callable<{ postId: string }, { success: boolean }>("approvePost");
export const retryPost = callable<{ postId: string }, { success: boolean }>("retryPost");
export const cancelPost = callable<{ postId: string }, { success: boolean }>("cancelPost");
export const regeneratePostContent = callable<
  { postId: string },
  { success: boolean; content?: { caption: string; hashtags: string[] } }
>("regeneratePostContent");

export const getQuota = callable<
  Record<string, never>,
  { plan: string; used: number; limit: number; remaining: number }
>("getQuota");

/** Fetch a website into a full brand kit (logo, colors, fonts, voice). */
export type BrandExtractResult = {
  companyName: string;
  industry: string;
  audience: string;
  tone: string;
  hashtags: string[];
  sampleCaptions: string[];
  logoUrl: string;
  websiteImages: Array<{
    url: string;
    alt: string;
    kind: "product" | "hero" | "social" | "content";
  }>;
  brandedImageUrl: string;
  brandedImageSource: "website" | "generated" | "";
  colors: { primary?: string; secondary?: string; accent?: string };
  fonts: string[];
  
  coreIdentity?: string;
  productOffering?: string;
  uniqueBenefits?: string;
  problemSolution?: string;
  mission?: string;
  differentiation?: string;
  ownedSpace?: string;

  contentAngles?: string[];
  toneDos?: string[];
  toneDonts?: string[];
  customerSegments?: Array<{ segmentName: string; percentage: number }>;
  competitors?: string[];
};

export const extractBrandFromWebsite = callable<{ url: string }, BrandExtractResult>(
  "extractBrandFromWebsite",
);

export const generateBrandedPostImage = callable<
  {
    websiteUrl: string;
    assetUrl?: string;
    brandName: string;
    industry?: string;
    caption?: string;
    colors?: { primary?: string; secondary?: string; accent?: string };
  },
  { imageUrl: string; source: "website" | "generated" }
>("generateBrandedPostImage");
/** Create a Dodo Payments checkout session and return its hosted URL. */
export const createDodoCheckout = callable<
  { planId: "pro" | "max"; billing: "monthly" | "annual" },
  { url: string }
>("createDodoCheckout");

/** Open the authenticated Dodo customer portal for billing management. */
export const createDodoPortal = callable<Record<string, never>, { url: string }>(
  "createDodoPortal"
);

export const syncBillingClaims = callable<
  Record<string, never>,
  { plan: "free" | "pro" | "max"; status: string; hasPaidPlan: boolean }
>("syncBillingClaims");

/** Attach a guest-checkout purchase keyed by the signed-in Google email. */
export const claimGuestEntitlement = callable<
  Record<string, never>,
  {
    outcome: "claimed" | "already_active" | "none";
    plan: "free" | "pro" | "max";
    status: string;
    hasPaidPlan: boolean;
    email: string;
  }
>("claimGuestEntitlement");
