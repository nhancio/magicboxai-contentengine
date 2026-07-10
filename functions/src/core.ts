import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";

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

export const getPublicUrl = (filePath: string) =>
  `https://storage.googleapis.com/${getBucket().name}/${filePath}`;

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

export type SocialPlatform = "instagram" | "twitter" | "linkedin";

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
  pbMediaId?: string;
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
  pb?: { postId?: string; dryRun: boolean; submittedAt?: admin.firestore.Timestamp };
  results?: Array<{
    platform: SocialPlatform;
    pbAccountId?: string;
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
