// Client wrappers for the marketing automation suite callables.

import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { SocialPlatform } from "../types";

function callable<Req, Res>(name: string) {
  return async (data: Req): Promise<Res> => {
    if (!functions) throw new Error("Firebase Functions not initialized");
    const fn = httpsCallable<Req, Res>(functions, name);
    const result = await fn(data);
    return result.data;
  };
}

export const syncSocialAccounts = callable<
  Record<string, never>,
  { synced: number; dryRun: boolean }
>("syncSocialAccounts");

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
