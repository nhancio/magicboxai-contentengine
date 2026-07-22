// Direct publishing to Instagram (Meta Graph API), LinkedIn, and YouTube.
// Called by the postingTick in scheduler.ts. Each account publishes
// synchronously and returns a permalink (Instagram video containers are
// polled inline until FINISHED).

import * as admin from "firebase-admin";
import { db, getBucket } from "./core";
import type { PostDoc, SocialTokenDoc, SocialPlatform, SocialProvider } from "./core";
import { activePaidPostEntitlement } from "./entitlements";

const GRAPH = "https://graph.facebook.com/v21.0";
const LINKEDIN_VERSION = "202601";
const ACTUAL_PLATFORMS = ["instagram", "linkedin", "youtube"] as const;

function isActualPlatform(value: unknown): value is (typeof ACTUAL_PLATFORMS)[number] {
  return typeof value === "string" && ACTUAL_PLATFORMS.includes(value as never);
}

function decodeStoragePath(value: string): string | null {
  try {
    const path = decodeURIComponent(value).replace(/^\/+/, "");
    if (!path || path.includes("\0") || path.split("/").some((part) => part === "..")) {
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

/**
 * Resolve an HTTPS media URL to an object in this project's default GCS
 * bucket. Keeping this parser allowlist-based prevents the publisher's media
 * fetches from becoming an arbitrary-URL SSRF primitive.
 */
export function trustedStoragePathFromUrl(rawUrl: string): string | null {
  if (typeof rawUrl !== "string" || rawUrl.length > 4_096) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;

  const bucketName = getBucket().name;
  if (url.hostname === "storage.googleapis.com") {
    const path = url.pathname.replace(/^\/+/, "");
    const slash = path.indexOf("/");
    if (slash < 1) return null;
    try {
      if (decodeURIComponent(path.slice(0, slash)) !== bucketName) return null;
    } catch {
      return null;
    }
    return decodeStoragePath(path.slice(slash + 1));
  }

  if (url.hostname === `${bucketName}.storage.googleapis.com`) {
    return decodeStoragePath(url.pathname);
  }

  if (url.hostname === "firebasestorage.googleapis.com") {
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (!match) return null;
    try {
      if (decodeURIComponent(match[1]) !== bucketName) return null;
    } catch {
      return null;
    }
    return decodeStoragePath(match[2]);
  }

  return null;
}

export interface AccountPublishResult {
  accountId: string;
  platform: SocialPlatform;
  status: "posted" | "failed";
  permalink?: string;
  error?: string;
}

interface AccountInfo {
  userId: string;
  provider: SocialProvider;
  platform: SocialPlatform;
  externalId: string;
  status: string;
}

async function loadAccount(
  accountId: string,
  expectedUserId: string
): Promise<{ account: AccountInfo; token: SocialTokenDoc } | null> {
  const [accSnap, tokSnap] = await Promise.all([
    db.collection("socialAccounts").doc(accountId).get(),
    db.collection("socialTokens").doc(accountId).get(),
  ]);
  if (!accSnap.exists || !tokSnap.exists) return null;
  const a = accSnap.data() as Partial<AccountInfo>;
  const token = tokSnap.data() as Partial<SocialTokenDoc>;
  if (
    a.userId !== expectedUserId ||
    token.userId !== expectedUserId ||
    a.status !== "active" ||
    !isActualPlatform(a.platform) ||
    a.provider !== a.platform ||
    token.provider !== a.provider ||
    typeof a.externalId !== "string" ||
    !a.externalId ||
    typeof token.accessToken !== "string" ||
    !token.accessToken
  ) {
    return null;
  }
  return {
    account: {
      userId: a.userId,
      provider: a.provider,
      platform: a.platform,
      externalId: a.externalId,
      status: a.status,
    },
    token: token as SocialTokenDoc,
  };
}

async function assertActivePublishingEntitlement(userId: string): Promise<void> {
  const snap = await db.collection("subscriptions").doc(userId).get();
  if (!snap.exists || activePaidPostEntitlement(snap.data()) === null) {
    throw new Error("An active, unexpired paid subscription is required to publish");
  }
}

/** Mark the client-visible account record so the UI can prompt a reconnect. */
async function markAccountExpired(accountId: string): Promise<void> {
  await db
    .collection("socialAccounts")
    .doc(accountId)
    .update({
      status: "expired",
      lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});
}

/**
 * Return a usable access token for the account, refreshing it first when it
 * is expired (or about to expire). YouTube tokens refresh via Google's OAuth
 * endpoint; Instagram/LinkedIn tokens cannot be refreshed server-side, so an
 * expired one throws and the account is flagged for reconnection.
 */
async function freshAccessToken(
  accountId: string,
  account: AccountInfo,
  token: SocialTokenDoc
): Promise<string> {
  const expiresSoon =
    token.expiresAt !== undefined && token.expiresAt.toMillis() < Date.now() + 5 * 60_000;
  if (!expiresSoon) return token.accessToken;

  if (account.provider === "youtube" && token.refreshToken) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      }).toString(),
    });
    const text = await res.text();
    if (!res.ok) {
      await markAccountExpired(accountId);
      throw new Error(`YouTube token refresh failed (${res.status}): ${text}`);
    }
    const refreshed = JSON.parse(text) as { access_token: string; expires_in?: number };
    await db
      .collection("socialTokens")
      .doc(accountId)
      .set(
        {
          accessToken: refreshed.access_token,
          ...(refreshed.expires_in
            ? {
                expiresAt: admin.firestore.Timestamp.fromMillis(
                  Date.now() + refreshed.expires_in * 1000
                ),
              }
            : {}),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    return refreshed.access_token;
  }

  await markAccountExpired(accountId);
  throw new Error(
    `${account.provider} access token expired — reconnect the account in Settings`
  );
}

function firstMedia(
  post: PostDoc,
  type?: "image" | "video"
): { url: string; type: "image" | "video" } | null {
  const m = (post.media ?? []).find((x) => x.url && (!type || x.type === type));
  return m ? { url: m.url, type: m.type } : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- Instagram ---

async function publishInstagram(
  token: SocialTokenDoc,
  caption: string,
  media: { url: string; type: "image" | "video" } | null
): Promise<string> {
  const igUserId = token.igUserId;
  const accessToken = token.accessToken;
  if (!igUserId) throw new Error("Instagram account missing igUserId");
  if (!media) throw new Error("Instagram requires an image or video");

  // 1) create media container
  const containerParams = new URLSearchParams({ caption, access_token: accessToken });
  if (media.type === "video") {
    containerParams.set("media_type", "REELS");
    containerParams.set("video_url", media.url);
  } else {
    containerParams.set("image_url", media.url);
  }
  const createRes = await fetch(`${GRAPH}/${igUserId}/media`, {
    method: "POST",
    body: containerParams,
  });
  const createText = await createRes.text();
  if (!createRes.ok) throw new Error(`IG container failed (${createRes.status}): ${createText}`);
  const creationId = (JSON.parse(createText) as { id: string }).id;

  // 2) videos process async — poll the container until FINISHED
  if (media.type === "video") {
    for (let i = 0; i < 20; i++) {
      await sleep(6000);
      const statusRes = await fetch(
        `${GRAPH}/${creationId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`
      );
      const statusJson = (await statusRes.json()) as { status_code?: string };
      if (statusJson.status_code === "FINISHED") break;
      if (statusJson.status_code === "ERROR") throw new Error("IG video processing failed");
      if (i === 19) throw new Error("IG video processing timed out");
    }
  }

  // 3) publish
  const pubRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: creationId, access_token: accessToken }),
  });
  const pubText = await pubRes.text();
  if (!pubRes.ok) throw new Error(`IG publish failed (${pubRes.status}): ${pubText}`);
  const mediaId = (JSON.parse(pubText) as { id: string }).id;

  // 4) best-effort permalink
  try {
    const linkRes = await fetch(
      `${GRAPH}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`
    );
    const linkJson = (await linkRes.json()) as { permalink?: string };
    if (linkJson.permalink) return linkJson.permalink;
  } catch {
    /* non-fatal */
  }
  return `https://www.instagram.com/`;
}

// --- LinkedIn ---

async function linkedinUploadImage(
  token: string,
  authorUrn: string,
  imageUrl: string
): Promise<string> {
  // 1) initialize upload
  const initRes = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
  });
  const initText = await initRes.text();
  if (!initRes.ok) throw new Error(`LinkedIn image init failed (${initRes.status}): ${initText}`);
  const init = JSON.parse(initText) as { value: { uploadUrl: string; image: string } };

  // 2) fetch the asset bytes and upload
  const assetRes = await fetch(imageUrl);
  if (!assetRes.ok) throw new Error(`Could not fetch media for LinkedIn (${assetRes.status})`);
  const bytes = Buffer.from(await assetRes.arrayBuffer());
  const putRes = await fetch(init.value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: new Uint8Array(bytes),
  });
  if (!putRes.ok) throw new Error(`LinkedIn image upload failed (${putRes.status})`);
  return init.value.image;
}

async function publishLinkedIn(
  token: SocialTokenDoc,
  authorUrn: string,
  caption: string,
  media: { url: string; type: "image" | "video" } | null
): Promise<string> {
  const accessToken = token.accessToken;

  const body: Record<string, unknown> = {
    author: authorUrn,
    commentary: caption,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  // LinkedIn's Posts API only supports images here; videos fall back to text.
  if (media && media.type === "image") {
    const imageUrn = await linkedinUploadImage(accessToken, authorUrn, media.url);
    body.content = { media: { id: imageUrn } };
  }

  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn post failed (${res.status}): ${text}`);
  }
  const postUrn = res.headers.get("x-restli-id") || res.headers.get("x-linkedin-id") || "";
  return postUrn
    ? `https://www.linkedin.com/feed/update/${postUrn}`
    : "https://www.linkedin.com/feed/";
}

// --- YouTube ---

/**
 * Upload a video to YouTube via the multipart upload endpoint. The first line
 * of the caption becomes the title (YouTube caps titles at 100 chars); the
 * full caption becomes the description.
 */
async function publishYouTube(
  accessToken: string,
  caption: string,
  media: { url: string; type: "image" | "video" } | null
): Promise<string> {
  if (!media || media.type !== "video") {
    throw new Error("YouTube requires a video — enable video content for this automation");
  }

  const assetRes = await fetch(media.url);
  if (!assetRes.ok) throw new Error(`Could not fetch video for YouTube (${assetRes.status})`);
  const bytes = Buffer.from(await assetRes.arrayBuffer());

  const title = (caption.split("\n")[0] || "New video").slice(0, 100);
  const metadata = {
    snippet: { title, description: caption.slice(0, 5000) },
    status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
  };

  const boundary = "magicbox-yt-upload";
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: video/*\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([head, bytes, tail]);

  const res = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body: new Uint8Array(body),
    }
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`YouTube upload failed (${res.status}): ${text}`);
  const video = JSON.parse(text) as { id: string };
  return `https://youtu.be/${video.id}`;
}

// --- dispatcher ---

/**
 * Publish a ready post to every connected account attached to it.
 * Returns one result per account; the caller decides overall success.
 */
export async function publishPost(post: PostDoc): Promise<AccountPublishResult[]> {
  if (typeof post.userId !== "string" || !post.userId || post.userId.includes("/")) {
    throw new Error("Post owner is invalid");
  }
  if (post.source !== "manual" && post.source !== "automation") {
    throw new Error("Post source is invalid");
  }
  await assertActivePublishingEntitlement(post.userId);

  if (
    !post.platforms?.length ||
    post.platforms.length > ACTUAL_PLATFORMS.length ||
    new Set(post.platforms).size !== post.platforms.length ||
    post.platforms.some((platform) => !isActualPlatform(platform))
  ) {
    throw new Error("Post contains an unsupported publishing platform");
  }
  if (
    !post.socialAccountIds?.length ||
    post.socialAccountIds.length > 20 ||
    post.socialAccountIds.some(
      (id) => typeof id !== "string" || !id || id.length > 300 || id.includes("/")
    ) ||
    new Set(post.socialAccountIds).size !== post.socialAccountIds.length
  ) {
    throw new Error("Post must contain unique connected social accounts");
  }
  if (!Array.isArray(post.media) && post.media !== undefined) {
    throw new Error("Post media is invalid");
  }
  if ((post.media?.length ?? 0) > 10) {
    throw new Error("Post contains too many media items");
  }
  for (const item of post.media ?? []) {
    if (item.type !== "image" && item.type !== "video") {
      throw new Error("Post media type is invalid");
    }
    const trustedPath = trustedStoragePathFromUrl(item.url);
    const validSourcePath =
      post.source === "manual"
        ? trustedPath?.startsWith(`users/${post.userId}/`)
        : trustedPath?.startsWith("posts/");
    if (!trustedPath || !validSourcePath || (item.storagePath && item.storagePath !== trustedPath)) {
      throw new Error("Post media must come from MagicBox storage");
    }
  }

  const caption = post.content?.caption ?? post.brief;
  if (typeof caption !== "string" || !caption.trim() || caption.length > 10_000) {
    throw new Error("Post caption is invalid");
  }
  const media = firstMedia(post);
  const results: AccountPublishResult[] = [];
  const requestedPlatforms = new Set(post.platforms);

  for (const accountId of post.socialAccountIds) {
    // Re-read both records immediately before use. This is the final tenant
    // boundary even if a stale/malformed post document reaches the scheduler.
    const loaded = await loadAccount(accountId, post.userId);
    if (!loaded) {
      results.push({
        accountId,
        platform: post.platforms[0] ?? "instagram",
        status: "failed",
        error: "Account is unavailable or does not belong to this user",
      });
      continue;
    }
    const { account, token } = loaded;
    if (!requestedPlatforms.has(account.platform)) {
      results.push({
        accountId,
        platform: account.platform,
        status: "failed",
        error: "Account platform is not selected for this post",
      });
      continue;
    }

    // per-platform caption override if present
    const perCaption =
      post.content?.perPlatform?.[account.platform]?.caption ?? caption;

    try {
      const accessToken = await freshAccessToken(accountId, account, token);
      let permalink: string;
      if (account.provider === "instagram") {
        permalink = await publishInstagram({ ...token, accessToken }, perCaption, media);
      } else if (account.provider === "youtube") {
        permalink = await publishYouTube(accessToken, perCaption, firstMedia(post, "video"));
      } else if (account.provider === "linkedin") {
        permalink = await publishLinkedIn(
          { ...token, accessToken },
          account.externalId,
          perCaption,
          media
        );
      } else {
        throw new Error("Unsupported publishing provider");
      }
      results.push({ accountId, platform: account.platform, status: "posted", permalink });
    } catch (e: unknown) {
      results.push({
        accountId,
        platform: account.platform,
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return results;
}
