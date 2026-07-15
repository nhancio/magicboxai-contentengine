// Client wrappers for the marketing automation suite callables.

import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { SocialPlatform, SocialProvider } from "../types";

function callable<Req, Res>(name: string) {
  return async (data: Req): Promise<Res> => {
    if (!functions) throw new Error("Firebase Functions not initialized");
    const fn = httpsCallable<Req, Res>(functions, name);
    const result = await fn(data);
    return result.data;
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

/** Infer brand fields from a website URL via Gemini (for onboarding autofill). */
export const extractBrandFromWebsite = callable<
  { url: string },
  { companyName: string; industry: string; audience: string; tone: string }
>("extractBrandFromWebsite");

/** Create a Dodo Payments checkout session and return its hosted URL. */
export const createDodoCheckout = callable<
  { planId: "pro" | "max"; billing: "monthly" | "annual" },
  { url: string }
>("createDodoCheckout");

/** Open the authenticated Dodo customer portal for billing management. */
export const createDodoPortal = callable<Record<string, never>, { url: string }>(
  "createDodoPortal"
);
