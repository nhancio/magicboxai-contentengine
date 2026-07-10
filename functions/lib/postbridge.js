"use strict";
// Thin client for the Post Bridge API (https://api.post-bridge.com).
// When POST_BRIDGE_API_KEY is not configured the client runs in dry-run
// mode: deterministic fakes so the whole pipeline is testable end-to-end.
Object.defineProperty(exports, "__esModule", { value: true });
exports.postBridgeApiKey = void 0;
exports.isDryRun = isDryRun;
exports.pbListAccounts = pbListAccounts;
exports.pbUploadMediaFromBuffer = pbUploadMediaFromBuffer;
exports.pbCreatePost = pbCreatePost;
exports.pbGetPost = pbGetPost;
const params_1 = require("firebase-functions/params");
exports.postBridgeApiKey = (0, params_1.defineSecret)("POST_BRIDGE_API_KEY");
const PB_BASE = "https://api.post-bridge.com/v1";
function isDryRun() {
    if (process.env.POST_BRIDGE_DRY_RUN === "true")
        return true;
    try {
        return !exports.postBridgeApiKey.value();
    }
    catch (_a) {
        return true;
    }
}
async function pbFetch(path, init) {
    var _a;
    const response = await fetch(`${PB_BASE}${path}`, Object.assign(Object.assign({}, init), { headers: Object.assign({ Authorization: `Bearer ${exports.postBridgeApiKey.value()}`, "Content-Type": "application/json" }, ((_a = init === null || init === void 0 ? void 0 : init.headers) !== null && _a !== void 0 ? _a : {})) }));
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Post Bridge ${path} failed (${response.status}): ${text}`);
    }
    return (await response.json());
}
async function pbListAccounts() {
    var _a;
    if (isDryRun()) {
        return [
            { id: "pb_mock_ig", platform: "instagram", username: "yourbrand", display_name: "Your Brand" },
            { id: "pb_mock_tw", platform: "twitter", username: "yourbrand", display_name: "Your Brand" },
            { id: "pb_mock_li", platform: "linkedin", username: "your-brand", display_name: "Your Brand" },
        ];
    }
    const data = await pbFetch("/social-accounts");
    return Array.isArray(data) ? data : (_a = data.data) !== null && _a !== void 0 ? _a : [];
}
async function pbUploadMediaFromBuffer(buffer, mimeType, name) {
    if (isDryRun()) {
        return `pb_mock_media_${name.replace(/[^a-z0-9]/gi, "").slice(0, 24)}`;
    }
    const { media_id, upload_url } = await pbFetch("/media/create-upload-url", {
        method: "POST",
        body: JSON.stringify({ mime_type: mimeType, size_bytes: buffer.length, name }),
    });
    const put = await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: new Uint8Array(buffer),
    });
    if (!put.ok) {
        throw new Error(`Post Bridge media upload failed (${put.status})`);
    }
    return media_id;
}
async function pbCreatePost(args) {
    var _a;
    if (isDryRun()) {
        return { id: `pb_mock_post_${args.socialAccountIds.join("_").slice(0, 32)}`, dryRun: true };
    }
    const post = await pbFetch("/posts", {
        method: "POST",
        body: JSON.stringify(Object.assign(Object.assign({ caption: args.caption, social_accounts: args.socialAccountIds }, (((_a = args.mediaIds) === null || _a === void 0 ? void 0 : _a.length) ? { media: args.mediaIds } : {})), (args.scheduledAt ? { scheduled_at: args.scheduledAt } : {}))),
    });
    const id = "data" in post ? post.data.id : post.id;
    return { id, dryRun: false };
}
async function pbGetPost(id) {
    if (isDryRun()) {
        // Dry-run posts read back as immediately posted
        return { id, status: "posted", results: [] };
    }
    const data = await pbFetch(`/posts/${id}`);
    return "data" in data ? data.data : data;
}
//# sourceMappingURL=postbridge.js.map