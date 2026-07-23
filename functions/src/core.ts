import { setGlobalOptions } from "firebase-functions/v2";
import {
  HttpsError,
  type CallableOptions,
  type CallableRequest,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "node:crypto";

// core.ts is the first module in the import graph (callables.ts imports it),
// so this runs before any function is defined and applies to all of them.
// Region is pinned to match the deployed webhook URL + Vertex location.
// maxInstances caps runaway cost. NOTE: to kill cold starts on the hot
// interactive callables at launch, add `minInstances: 1` here (paid warm
// instance — leave at 0 pre-launch while traffic is ~zero).
setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();

export const getAI = () => {
  const projectId = process.env.GCLOUD_PROJECT || admin.app().options.projectId;
  return new GoogleGenAI({
    vertexai: true,
    project: projectId,
    location: "us-central1",
  });
};

export const requireAuth = <T>(request: CallableRequest<T>): string => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  return request.auth.uid;
};

export const getBucket = () => admin.storage().bucket();

/**
 * Only the first-party applications and local development servers can invoke
 * browser callables. Authentication still remains the authorization boundary.
 */
export const callableSecurity: Pick<CallableOptions, "cors" | "enforceAppCheck"> = {
  cors: [
    "https://app.magicboxai.in",
    "https://admin.magicboxai.in",
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/,
  ],
  // App Check is initialized by shared/lib/firebase.ts. Deployments must set
  // VITE_FIREBASE_APPCHECK_SITE_KEY before serving browser traffic.
  enforceAppCheck: true,
};

/**
 * Give a caller a Firebase Storage bearer URL without making the underlying
 * GCS object public. The URL is still sensitive and must only be persisted in
 * tenant-owned records; bucket-level anonymous reads are never required.
 */
export async function createDownloadUrl(filePath: string): Promise<string> {
  const bucket = getBucket();
  const token = randomUUID();
  await bucket.file(filePath).setMetadata({
    metadata: { firebaseStorageDownloadTokens: token },
  });
  return (
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}` +
    `/o/${encodeURIComponent(filePath)}?alt=media&token=${encodeURIComponent(token)}`
  );
}

/** Veo is opt-in so an incomplete deployment cannot incur generation spend. */
export const isVeoGenerationEnabled = (): boolean =>
  process.env.ENABLE_VEO_GENERATION === "true";

export const assertVeoGenerationEnabled = (): void => {
  if (!isVeoGenerationEnabled()) {
    throw new HttpsError(
      "failed-precondition",
      "AI video generation is temporarily disabled by the server configuration"
    );
  }
};

/** Parse an operator override without accepting zero, fractions, or unsafe values. */
export function parsePositiveBoundedInteger(
  rawValue: string | undefined,
  fallback: number,
  maximum: number
): number {
  if (
    !Number.isSafeInteger(fallback) ||
    fallback < 1 ||
    !Number.isSafeInteger(maximum) ||
    maximum < fallback
  ) {
    throw new Error("Invalid bounded integer configuration");
  }

  const value = rawValue?.trim();
  if (!value || !/^\d+$/.test(value)) return fallback;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum
    ? parsed
    : fallback;
}

/**
 * Paid-plan video quotas. Defaults are deliberately conservative; explicit
 * operator overrides remain capped to contain accidental provider spend.
 */
export type PlanId = "pro" | "max";
export const PLAN_VIDEO_LIMIT: Record<PlanId, number> = {
  pro: parsePositiveBoundedInteger(process.env.VIDEO_LIMIT_PRO, 2, 10),
  max: parsePositiveBoundedInteger(process.env.VIDEO_LIMIT_MAX, 10, 50),
};

export const stringifyError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unexpected error";
  }
};

// --- Server-side models for the marketing automation suite ---

export type SocialPlatform =
  | "instagram"
  | "twitter"
  | "linkedin"
  | "youtube"
  | "facebook"
  | "whatsapp";
export type SocialProvider = "instagram" | "linkedin" | "youtube";

/** Public-ish account record (client-readable, no secrets). */
export interface SocialAccountDoc {
  userId: string;
  provider: SocialProvider;
  platform: SocialPlatform;
  externalId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  status: "active" | "disconnected" | "expired";
}

/** Secret token record, stored in `socialTokens/{accountId}` — never client-readable. */
export interface SocialTokenDoc {
  userId: string;
  provider: SocialProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: admin.firestore.Timestamp;
  /** Instagram: the IG business account id used for publishing. */
  igUserId?: string;
  /** Instagram: the Facebook Page id that owns the IG account. */
  pageId?: string;
  /** YouTube: the channel id videos are uploaded to. */
  channelId?: string;
}

export interface AutomationScheduleDoc {
  type: "recurring" | "once";
  cron?: string;
  time: string;
  daysOfWeek?: number[];
  timezone: string;
  startAt?: admin.firestore.Timestamp;
  endAt?: admin.firestore.Timestamp;
}

export interface AutomationDoc {
  userId: string;
  brandProfileId?: string;
  name: string;
  status: "active" | "paused" | "draft" | "error";
  brief: string;
  platforms: SocialPlatform[];
  socialAccountIds: string[];
  contentTypes: { text: boolean; image: boolean; video: boolean };
  preset: string;
  tone: string;
  schedule: AutomationScheduleDoc;
  nextRunAt: admin.firestore.Timestamp;
  lastRunAt?: admin.firestore.Timestamp;
  runCount: number;
  failureCount: number;
  lastError?: string;
  generateLeadMinutes: number;
  requiresApproval: boolean;
}

export interface PostMediaDoc {
  type: "image" | "video";
  storagePath?: string;
  url: string;
  source: "imagen" | "veo" | "remotion" | "upload";
}

export interface PostDoc {
  userId: string;
  automationId?: string;
  brandProfileId?: string;
  source: "automation" | "manual";
  scheduledFor: admin.firestore.Timestamp;
  timezone: string;
  status:
    | "draft"
    | "pending_approval"
    | "scheduled"
    | "generating"
    | "ready"
    | "posting"
    | "posted"
    | "failed"
    | "cancelled";
  brief: string;
  content?: {
    caption: string;
    hashtags: string[];
    perPlatform?: Partial<Record<SocialPlatform, { caption: string }>>;
  };
  media?: PostMediaDoc[];
  contentTypes?: { text: boolean; image: boolean; video: boolean };
  preset?: string;
  tone?: string;
  platforms: SocialPlatform[];
  socialAccountIds: string[];
  results?: Array<{
    platform: SocialPlatform;
    accountId?: string;
    status: "pending" | "posted" | "failed";
    permalink?: string;
    error?: string;
  }>;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt?: admin.firestore.Timestamp;
  error?: string;
  idempotencyKey?: string;
}

export interface BrandProfileDoc {
  userId: string;
  name: string;
  logoUrl?: string;
  colors?: { primary: string; secondary?: string; accent?: string };
  industry: string;
  toneOfVoice: string;
  audience: string;
  bannedTopics?: string[];
  hashtagSets?: { default: string[] };
  sampleCaptions?: string[];
  websiteUrl?: string;
}
