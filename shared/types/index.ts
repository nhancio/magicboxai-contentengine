export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
  lastLoginAt: Date;
}

export interface AvatarSettings {
  gender: string;
  ageRange: string;
  ethnicity: string;
  faceShape: string;
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  eyeColor: string;
  outfit: string;
  pose: string;
  expression: string;
  background: string;
  lighting: string;
  style: string;
}

export interface PhotoAvatar {
  id: string;
  userId: string;
  name: string;
  photoUrls: string[];
  photoStoragePaths?: string[];
  description: string;
  personality: string;
  voiceTone: string;
  videoUrl?: string;
  previewStatus?: "pending" | "completed" | "failed";
  previewError?: string;
  status: "processing" | "ready" | "failed";
  createdAt: Date;
}

export interface GeneratedAvatar {
  id: string;
  userId: string;
  name: string;
  prompt: string;
  imageUrl: string;
  settings: AvatarSettings;
  createdAt: Date;
}

export type SubscriptionPlan = "free" | "pro" | "max";

export interface UserSubscription {
  plan: SubscriptionPlan;
  videosUsed: number;
  videosLimit: number;
  status?: "inactive" | "active" | "past_due" | "cancelled";
  razorpayOrderId?: string;
  razorpaySubscriptionId?: string;
  currentPeriodEnd?: Date;
}

export interface GeneratedAd {
  id: string;
  userId: string;
  productName: string;
  platform: string;
  imageUrl: string;
  adCopy: string;
  settings: Record<string, string>;
  createdAt: Date;
}

export interface GeneratedVideo {
  id: string;
  userId: string;
  avatarId: string;
  templateId: string;
  productName: string;
  productDescription: string;
  script: string;
  hookLine: string;
  captions: string[];
  cta: string;
  platform: string;
  tone: string;
  productImageUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  renderProvider?: "veo" | "remotion";
  errorMessage?: string;
  previewVideoUrl?: string;
  status: "queued" | "generating" | "completed" | "failed";
  createdAt: Date;
}

// --- Marketing Automation Suite ---

export type SocialPlatform = "instagram" | "twitter" | "linkedin" | "youtube";
/** Providers we connect directly via OAuth. Twitter/X is intentionally deferred. */
export type SocialProvider = "instagram" | "linkedin" | "youtube";

export interface SocialAccount {
  id: string;
  userId: string;
  provider: SocialProvider;
  platform: SocialPlatform;
  /** Provider-native id: IG business account id, or `urn:li:person:{sub}`. */
  externalId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  status: "active" | "disconnected" | "expired";
  linkedAt: Date;
  lastSyncedAt?: Date;
}

export interface BrandProfile {
  id: string;
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
  createdAt: Date;
  updatedAt?: Date;
}

export type AutomationStatus = "active" | "paused" | "draft" | "error";
export type ContentPreset = "announcement" | "educational" | "promo" | "story" | "custom";

export interface AutomationSchedule {
  type: "recurring" | "once";
  /** cron expression evaluated in `timezone`, e.g. "0 7 * * *" */
  cron?: string;
  /** "HH:mm" local time */
  time: string;
  /** 0 = Sunday ... 6 = Saturday; omitted = every day */
  daysOfWeek?: number[];
  /** IANA timezone, e.g. "Asia/Kolkata" */
  timezone: string;
  startAt?: Date;
  endAt?: Date;
}

export interface Automation {
  id: string;
  userId: string;
  brandProfileId?: string;
  name: string;
  status: AutomationStatus;
  /** the user prompt / content brief driving generation */
  brief: string;
  platforms: SocialPlatform[];
  socialAccountIds: string[];
  contentTypes: { text: boolean; image: boolean; video: boolean };
  preset: ContentPreset;
  tone: string;
  schedule: AutomationSchedule;
  /** precomputed next fire time (UTC) — scheduler queries this */
  nextRunAt: Date;
  lastRunAt?: Date;
  runCount: number;
  failureCount: number;
  lastError?: string;
  /** how far ahead of scheduledFor content generation starts */
  generateLeadMinutes: number;
  requiresApproval: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export type PostStatus =
  | "draft"
  | "pending_approval"
  | "scheduled"
  | "generating"
  | "ready"
  | "posting"
  | "posted"
  | "failed"
  | "cancelled";

export interface PostMedia {
  type: "image" | "video";
  storagePath?: string;
  url: string;
  source: "imagen" | "veo" | "remotion" | "upload";
}

export interface PostPlatformResult {
  platform: SocialPlatform;
  accountId?: string;
  status: "pending" | "posted" | "failed";
  permalink?: string;
  error?: string;
}

export interface Post {
  id: string;
  userId: string;
  automationId?: string;
  brandProfileId?: string;
  source: "automation" | "manual";
  scheduledFor: Date;
  timezone: string;
  status: PostStatus;
  brief: string;
  content?: {
    caption: string;
    hashtags: string[];
    perPlatform?: Partial<Record<SocialPlatform, { caption: string }>>;
  };
  media?: PostMedia[];
  platforms: SocialPlatform[];
  socialAccountIds: string[];
  results?: PostPlatformResult[];
  attempts: number;
  maxAttempts: number;
  nextAttemptAt?: Date;
  error?: string;
  /** `${automationId}_${slotISO}` — also used as the Firestore doc ID */
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ApiLogEntry {
  id: string;
  endpoint: string;
  method: string;
  userId?: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
}

export interface AdminStats {
  totalUsers: number;
  totalAvatars: number;
  totalAds: number;
  totalApiRequests: number;
}
