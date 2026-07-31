"use strict";
// Direct publishing to Instagram (Meta Graph API), LinkedIn, and YouTube.
// Called by the postingTick in scheduler.ts. Each account publishes
// synchronously and returns a permalink (Instagram video containers are
// polled inline until FINISHED).
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.trustedStoragePathFromUrl = trustedStoragePathFromUrl;
exports.publishInstagram = publishInstagram;
exports.linkedinUploadImage = linkedinUploadImage;
exports.linkedinUploadVideo = linkedinUploadVideo;
exports.publishLinkedIn = publishLinkedIn;
exports.publishPost = publishPost;
const admin = __importStar(require("firebase-admin"));
const core_1 = require("./core");
const entitlements_1 = require("./entitlements");
const GRAPH = "https://graph.facebook.com/v21.0";
const LINKEDIN_VERSION = "202601";
const ACTUAL_PLATFORMS = ["instagram", "linkedin", "youtube"];
function isActualPlatform(value) {
    return typeof value === "string" && ACTUAL_PLATFORMS.includes(value);
}
function decodeStoragePath(value) {
    try {
        const path = decodeURIComponent(value).replace(/^\/+/, "");
        if (!path || path.includes("\0") || path.split("/").some((part) => part === "..")) {
            return null;
        }
        return path;
    }
    catch (_a) {
        return null;
    }
}
/**
 * Resolve an HTTPS media URL to an object in this project's default GCS
 * bucket. Keeping this parser allowlist-based prevents the publisher's media
 * fetches from becoming an arbitrary-URL SSRF primitive.
 */
function trustedStoragePathFromUrl(rawUrl) {
    if (typeof rawUrl !== "string" || rawUrl.length > 4096)
        return null;
    let url;
    try {
        url = new URL(rawUrl);
    }
    catch (_a) {
        return null;
    }
    if (url.protocol !== "https:" || url.username || url.password || url.port)
        return null;
    const bucketName = (0, core_1.getBucket)().name;
    if (url.hostname === "storage.googleapis.com") {
        const path = url.pathname.replace(/^\/+/, "");
        const slash = path.indexOf("/");
        if (slash < 1)
            return null;
        try {
            if (decodeURIComponent(path.slice(0, slash)) !== bucketName)
                return null;
        }
        catch (_b) {
            return null;
        }
        return decodeStoragePath(path.slice(slash + 1));
    }
    if (url.hostname === `${bucketName}.storage.googleapis.com`) {
        return decodeStoragePath(url.pathname);
    }
    if (url.hostname === "firebasestorage.googleapis.com") {
        const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
        if (!match)
            return null;
        try {
            if (decodeURIComponent(match[1]) !== bucketName)
                return null;
        }
        catch (_c) {
            return null;
        }
        return decodeStoragePath(match[2]);
    }
    return null;
}
async function loadAccount(accountId, expectedUserId) {
    const [accSnap, tokSnap] = await Promise.all([
        core_1.db.collection("socialAccounts").doc(accountId).get(),
        core_1.db.collection("socialTokens").doc(accountId).get(),
    ]);
    if (!accSnap.exists || !tokSnap.exists)
        return null;
    const a = accSnap.data();
    const token = tokSnap.data();
    if (a.userId !== expectedUserId ||
        token.userId !== expectedUserId ||
        a.status !== "active" ||
        !isActualPlatform(a.platform) ||
        a.provider !== a.platform ||
        token.provider !== a.provider ||
        typeof a.externalId !== "string" ||
        !a.externalId ||
        typeof token.accessToken !== "string" ||
        !token.accessToken) {
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
        token: token,
    };
}
async function assertActivePublishingEntitlement(userId) {
    const snap = await core_1.db.collection("subscriptions").doc(userId).get();
    if (!snap.exists || (0, entitlements_1.activePaidPostEntitlement)(snap.data()) === null) {
        throw new Error("An active, unexpired paid subscription is required to publish");
    }
}
/** Mark the client-visible account record so the UI can prompt a reconnect. */
async function markAccountExpired(accountId) {
    await core_1.db
        .collection("socialAccounts")
        .doc(accountId)
        .update({
        status: "expired",
        lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
        .catch(() => { });
}
/**
 * Return a usable access token for the account, refreshing it first when it
 * is expired (or about to expire). YouTube tokens refresh via Google's OAuth
 * endpoint; Instagram/LinkedIn tokens cannot be refreshed server-side, so an
 * expired one throws and the account is flagged for reconnection.
 */
async function freshAccessToken(accountId, account, token) {
    var _a, _b;
    const expiresSoon = token.expiresAt !== undefined && token.expiresAt.toMillis() < Date.now() + 5 * 60000;
    if (!expiresSoon)
        return token.accessToken;
    if (account.provider === "youtube" && token.refreshToken) {
        const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: token.refreshToken,
                client_id: (_a = process.env.GOOGLE_OAUTH_CLIENT_ID) !== null && _a !== void 0 ? _a : "",
                client_secret: (_b = process.env.GOOGLE_OAUTH_CLIENT_SECRET) !== null && _b !== void 0 ? _b : "",
            }).toString(),
        });
        const text = await res.text();
        if (!res.ok) {
            await markAccountExpired(accountId);
            throw new Error(`YouTube token refresh failed (${res.status}): ${text}`);
        }
        const refreshed = JSON.parse(text);
        await core_1.db
            .collection("socialTokens")
            .doc(accountId)
            .set(Object.assign(Object.assign({ accessToken: refreshed.access_token }, (refreshed.expires_in
            ? {
                expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + refreshed.expires_in * 1000),
            }
            : {})), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
        return refreshed.access_token;
    }
    await markAccountExpired(accountId);
    throw new Error(`${account.provider} access token expired — reconnect the account in Settings`);
}
function firstMedia(post, type) {
    var _a;
    const m = ((_a = post.media) !== null && _a !== void 0 ? _a : []).find((x) => x.url && (!type || x.type === type));
    return m ? { url: m.url, type: m.type } : null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// --- Instagram ---
async function publishInstagram(token, caption, media, options) {
    const igUserId = token.igUserId;
    const accessToken = token.accessToken;
    if (!igUserId)
        throw new Error("Instagram account missing igUserId");
    if (!media)
        throw new Error("Instagram requires an image or video");
    let creationId = options === null || options === void 0 ? void 0 : options.creationId;
    // 1) Check existing creationId if provided
    if (creationId) {
        try {
            const statusRes = await fetch(`${GRAPH}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`);
            if (statusRes.ok) {
                const statusJson = (await statusRes.json());
                if (statusJson.status_code === "PUBLISHED") {
                    let permalink = "https://www.instagram.com/";
                    try {
                        const linkRes = await fetch(`${GRAPH}/${creationId}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`);
                        const linkJson = (await linkRes.json());
                        if (linkJson.permalink)
                            permalink = linkJson.permalink;
                    }
                    catch (_a) {
                        /* non-fatal */
                    }
                    return { permalink, creationId };
                }
                else if (statusJson.status_code === "FINISHED" ||
                    statusJson.status_code === "IN_PROGRESS") {
                    // Existing container is valid and can be reused
                }
                else {
                    creationId = undefined;
                }
            }
            else {
                creationId = undefined;
            }
        }
        catch (_b) {
            creationId = undefined;
        }
    }
    // 2) Create media container if no valid creationId exists
    if (!creationId) {
        const containerParams = new URLSearchParams({ caption, access_token: accessToken });
        if (media.type === "video") {
            containerParams.set("media_type", "REELS");
            containerParams.set("video_url", media.url);
        }
        else {
            containerParams.set("image_url", media.url);
        }
        const createRes = await fetch(`${GRAPH}/${igUserId}/media`, {
            method: "POST",
            body: containerParams,
        });
        const createText = await createRes.text();
        if (!createRes.ok)
            throw new Error(`IG container failed (${createRes.status}): ${createText}`);
        creationId = JSON.parse(createText).id;
        if (!creationId)
            throw new Error("IG container returned no creation id");
        // Persist creationId before attempting publish
        if (options === null || options === void 0 ? void 0 : options.onCreationId) {
            try {
                await options.onCreationId(creationId);
            }
            catch (e) {
                console.error("Failed to persist Instagram creationId:", e);
            }
        }
    }
    // 3) Poll container until FINISHED or PUBLISHED
    for (let i = 0; i < 20; i++) {
        const statusRes = await fetch(`${GRAPH}/${creationId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`);
        if (statusRes.ok) {
            const statusJson = (await statusRes.json());
            if (statusJson.status_code === "FINISHED" || statusJson.status_code === "PUBLISHED")
                break;
            if (statusJson.status_code === "ERROR")
                throw new Error("IG video processing failed");
        }
        if (i === 19)
            throw new Error("IG video processing timed out");
        await sleep(6000);
    }
    // 4) Publish container
    const pubRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
        method: "POST",
        body: new URLSearchParams({ creation_id: creationId, access_token: accessToken }),
    });
    const pubText = await pubRes.text();
    if (!pubRes.ok) {
        if (/already published|2207001|2207003/i.test(pubText)) {
            let permalink = "https://www.instagram.com/";
            try {
                const linkRes = await fetch(`${GRAPH}/${creationId}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`);
                const linkJson = (await linkRes.json());
                if (linkJson.permalink)
                    permalink = linkJson.permalink;
            }
            catch (_c) {
                /* non-fatal */
            }
            return { permalink, creationId };
        }
        throw new Error(`IG publish failed (${pubRes.status}): ${pubText}`);
    }
    const mediaId = JSON.parse(pubText).id;
    // 5) Fetch permalink
    let permalink = "https://www.instagram.com/";
    try {
        const linkRes = await fetch(`${GRAPH}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`);
        const linkJson = (await linkRes.json());
        if (linkJson.permalink)
            permalink = linkJson.permalink;
    }
    catch (_d) {
        /* non-fatal */
    }
    return { permalink, creationId };
}
// --- LinkedIn ---
async function linkedinUploadImage(token, authorUrn, imageUrl) {
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
    if (!initRes.ok)
        throw new Error(`LinkedIn image init failed (${initRes.status}): ${initText}`);
    const init = JSON.parse(initText);
    // 2) fetch the asset bytes and upload
    const assetRes = await fetch(imageUrl);
    if (!assetRes.ok)
        throw new Error(`Could not fetch media for LinkedIn (${assetRes.status})`);
    const bytes = Buffer.from(await assetRes.arrayBuffer());
    const putRes = await fetch(init.value.uploadUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: new Uint8Array(bytes),
    });
    if (!putRes.ok)
        throw new Error(`LinkedIn image upload failed (${putRes.status})`);
    return init.value.image;
}
async function linkedinUploadVideo(token, authorUrn, videoUrl) {
    var _a, _b, _c, _d, _e, _f;
    // 1) fetch asset bytes
    const assetRes = await fetch(videoUrl);
    if (!assetRes.ok)
        throw new Error(`Could not fetch media for LinkedIn (${assetRes.status})`);
    const bytes = Buffer.from(await assetRes.arrayBuffer());
    const fileSizeBytes = bytes.length;
    // 2) initialize video upload
    const initRes = await fetch("https://api.linkedin.com/rest/videos?action=initializeUpload", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "LinkedIn-Version": LINKEDIN_VERSION,
            "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
            initializeUploadRequest: {
                owner: authorUrn,
                fileSizeBytes,
                uploadCaptions: false,
                uploadThumbnail: false,
            },
        }),
    });
    const initText = await initRes.text();
    if (!initRes.ok)
        throw new Error(`LinkedIn video init failed (${initRes.status}): ${initText}`);
    const init = JSON.parse(initText);
    const videoUrn = (_a = init.value) === null || _a === void 0 ? void 0 : _a.video;
    const uploadToken = (_c = (_b = init.value) === null || _b === void 0 ? void 0 : _b.uploadToken) !== null && _c !== void 0 ? _c : "";
    const instructions = (_e = (_d = init.value) === null || _d === void 0 ? void 0 : _d.uploadInstructions) !== null && _e !== void 0 ? _e : [];
    if (!videoUrn || !instructions.length) {
        throw new Error("LinkedIn video init returned no video URN or upload instructions");
    }
    // 3) upload binary chunks
    const uploadedPartIds = [];
    for (const part of instructions) {
        const chunk = bytes.subarray(part.firstByte, part.lastByte + 1);
        const putRes = await fetch(part.uploadUrl, {
            method: "PUT",
            headers: {
                "Content-Type": "application/octet-stream",
            },
            body: new Uint8Array(chunk),
        });
        if (!putRes.ok) {
            const text = await putRes.text();
            throw new Error(`LinkedIn video chunk upload failed (${putRes.status}): ${text}`);
        }
        const etagHeader = putRes.headers.get("etag") || putRes.headers.get("ETag");
        if (!etagHeader) {
            throw new Error("LinkedIn video chunk upload returned no ETag header");
        }
        const etag = etagHeader.replace(/^"|"$/g, "").trim();
        uploadedPartIds.push(etag);
    }
    // 4) finalize upload
    const finalizeRes = await fetch("https://api.linkedin.com/rest/videos?action=finalizeUpload", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "LinkedIn-Version": LINKEDIN_VERSION,
            "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
            finalizeUploadRequest: {
                video: videoUrn,
                uploadToken,
                uploadedPartIds,
            },
        }),
    });
    const finalizeText = await finalizeRes.text();
    if (!finalizeRes.ok) {
        throw new Error(`LinkedIn video finalize failed (${finalizeRes.status}): ${finalizeText}`);
    }
    // 5) check status
    for (let i = 0; i < 30; i++) {
        const statusRes = await fetch(`https://api.linkedin.com/rest/videos/${encodeURIComponent(videoUrn)}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                "LinkedIn-Version": LINKEDIN_VERSION,
                "X-Restli-Protocol-Version": "2.0.0",
            },
        });
        const statusText = await statusRes.text();
        if (!statusRes.ok) {
            throw new Error(`LinkedIn video status check failed (${statusRes.status}): ${statusText}`);
        }
        const statusJson = JSON.parse(statusText);
        if (statusJson.status === "AVAILABLE") {
            return videoUrn;
        }
        if (statusJson.status === "PROCESSING_FAILED") {
            throw new Error(`LinkedIn video processing failed: ${(_f = statusJson.processingFailureReason) !== null && _f !== void 0 ? _f : "unknown reason"}`);
        }
        await sleep(3000);
    }
    throw new Error("LinkedIn video processing timed out");
}
async function publishLinkedIn(token, authorUrn, caption, media) {
    const accessToken = token.accessToken;
    const body = {
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
    if (media && media.type === "image") {
        const imageUrn = await linkedinUploadImage(accessToken, authorUrn, media.url);
        body.content = { media: { id: imageUrn } };
    }
    else if (media && media.type === "video") {
        const videoUrn = await linkedinUploadVideo(accessToken, authorUrn, media.url);
        body.content = { media: { id: videoUrn } };
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
async function publishYouTube(accessToken, caption, media) {
    if (!media || media.type !== "video") {
        throw new Error("YouTube requires a video — enable video content for this automation");
    }
    const assetRes = await fetch(media.url);
    if (!assetRes.ok)
        throw new Error(`Could not fetch video for YouTube (${assetRes.status})`);
    const bytes = Buffer.from(await assetRes.arrayBuffer());
    const title = (caption.split("\n")[0] || "New video").slice(0, 100);
    const metadata = {
        snippet: { title, description: caption.slice(0, 5000) },
        status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    };
    const boundary = "magicbox-yt-upload";
    const head = Buffer.from(`--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: video/*\r\n\r\n`);
    const tail = Buffer.from(`\r\n--${boundary}--`);
    const body = Buffer.concat([head, bytes, tail]);
    const res = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
            "Content-Length": String(body.length),
        },
        body: new Uint8Array(body),
    });
    const text = await res.text();
    if (!res.ok)
        throw new Error(`YouTube upload failed (${res.status}): ${text}`);
    const video = JSON.parse(text);
    return `https://youtu.be/${video.id}`;
}
// --- dispatcher ---
/**
 * Publish a ready post to every connected account attached to it.
 * Returns one result per account; the caller decides overall success.
 */
async function publishPost(post) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    if (typeof post.userId !== "string" || !post.userId || post.userId.includes("/")) {
        throw new Error("Post owner is invalid");
    }
    if (post.source !== "manual" && post.source !== "automation") {
        throw new Error("Post source is invalid");
    }
    await assertActivePublishingEntitlement(post.userId);
    if (!((_a = post.platforms) === null || _a === void 0 ? void 0 : _a.length) ||
        post.platforms.length > ACTUAL_PLATFORMS.length ||
        new Set(post.platforms).size !== post.platforms.length ||
        post.platforms.some((platform) => !isActualPlatform(platform))) {
        throw new Error("Post contains an unsupported publishing platform");
    }
    if (!((_b = post.socialAccountIds) === null || _b === void 0 ? void 0 : _b.length) ||
        post.socialAccountIds.length > 20 ||
        post.socialAccountIds.some((id) => typeof id !== "string" || !id || id.length > 300 || id.includes("/")) ||
        new Set(post.socialAccountIds).size !== post.socialAccountIds.length) {
        throw new Error("Post must contain unique connected social accounts");
    }
    if (!Array.isArray(post.media) && post.media !== undefined) {
        throw new Error("Post media is invalid");
    }
    if (((_d = (_c = post.media) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0) > 10) {
        throw new Error("Post contains too many media items");
    }
    for (const item of (_e = post.media) !== null && _e !== void 0 ? _e : []) {
        if (item.type !== "image" && item.type !== "video") {
            throw new Error("Post media type is invalid");
        }
        const trustedPath = trustedStoragePathFromUrl(item.url);
        const validSourcePath = post.source === "manual"
            ? trustedPath === null || trustedPath === void 0 ? void 0 : trustedPath.startsWith(`users/${post.userId}/`)
            : trustedPath === null || trustedPath === void 0 ? void 0 : trustedPath.startsWith("posts/");
        if (!trustedPath || !validSourcePath || (item.storagePath && item.storagePath !== trustedPath)) {
            throw new Error("Post media must come from MagicBox storage");
        }
    }
    const caption = (_g = (_f = post.content) === null || _f === void 0 ? void 0 : _f.caption) !== null && _g !== void 0 ? _g : post.brief;
    if (typeof caption !== "string" || !caption.trim() || caption.length > 10000) {
        throw new Error("Post caption is invalid");
    }
    const media = firstMedia(post);
    const results = [];
    const requestedPlatforms = new Set(post.platforms);
    for (const accountId of post.socialAccountIds) {
        // Re-read both records immediately before use. This is the final tenant
        // boundary even if a stale/malformed post document reaches the scheduler.
        const loaded = await loadAccount(accountId, post.userId);
        if (!loaded) {
            results.push({
                accountId,
                platform: (_h = post.platforms[0]) !== null && _h !== void 0 ? _h : "instagram",
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
        const perCaption = (_m = (_l = (_k = (_j = post.content) === null || _j === void 0 ? void 0 : _j.perPlatform) === null || _k === void 0 ? void 0 : _k[account.platform]) === null || _l === void 0 ? void 0 : _l.caption) !== null && _m !== void 0 ? _m : caption;
        try {
            const accessToken = await freshAccessToken(accountId, account, token);
            let permalink;
            let creationId;
            if (account.provider === "instagram") {
                const existingResult = (_o = post.results) === null || _o === void 0 ? void 0 : _o.find((r) => r.accountId === accountId || r.platform === account.platform);
                const existingCreationId = existingResult === null || existingResult === void 0 ? void 0 : existingResult.creationId;
                const onCreationId = async (cid) => {
                    const docId = post.id || post.idempotencyKey;
                    if (!docId)
                        return;
                    try {
                        const postRef = core_1.db.collection("posts").doc(docId);
                        await core_1.db.runTransaction(async (tx) => {
                            var _a;
                            const fresh = await tx.get(postRef);
                            if (!fresh.exists)
                                return;
                            const freshData = fresh.data();
                            const updatedResults = [...((_a = freshData.results) !== null && _a !== void 0 ? _a : [])];
                            const idx = updatedResults.findIndex((r) => r.accountId === accountId);
                            if (idx >= 0) {
                                updatedResults[idx] = Object.assign(Object.assign({}, updatedResults[idx]), { creationId: cid });
                            }
                            else {
                                updatedResults.push({
                                    platform: account.platform,
                                    accountId,
                                    status: "pending",
                                    creationId: cid,
                                });
                            }
                            tx.update(postRef, {
                                results: updatedResults,
                                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            });
                        });
                    }
                    catch (e) {
                        console.error("Failed to persist creationId in Firestore:", e);
                    }
                };
                const res = await publishInstagram(Object.assign(Object.assign({}, token), { accessToken }), perCaption, media, { creationId: existingCreationId, onCreationId });
                permalink = res.permalink;
                creationId = res.creationId;
            }
            else if (account.provider === "youtube") {
                permalink = await publishYouTube(accessToken, perCaption, firstMedia(post, "video"));
            }
            else if (account.provider === "linkedin") {
                permalink = await publishLinkedIn(Object.assign(Object.assign({}, token), { accessToken }), account.externalId, perCaption, media);
            }
            else {
                throw new Error("Unsupported publishing provider");
            }
            results.push(Object.assign({ accountId, platform: account.platform, status: "posted", permalink }, (creationId ? { creationId } : {})));
        }
        catch (e) {
            const existingResult = (_p = post.results) === null || _p === void 0 ? void 0 : _p.find((r) => r.accountId === accountId || r.platform === account.platform);
            results.push(Object.assign({ accountId, platform: account.platform, status: "failed", error: e instanceof Error ? e.message : String(e) }, ((existingResult === null || existingResult === void 0 ? void 0 : existingResult.creationId) ? { creationId: existingResult.creationId } : {})));
        }
    }
    return results;
}
//# sourceMappingURL=publishing.js.map