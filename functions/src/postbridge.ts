// Thin client for the Post Bridge API (https://api.post-bridge.com).
// When POST_BRIDGE_API_KEY is not configured the client runs in dry-run
// mode: deterministic fakes so the whole pipeline is testable end-to-end.

import { defineSecret } from "firebase-functions/params";

export const postBridgeApiKey = defineSecret("POST_BRIDGE_API_KEY");

const PB_BASE = "https://api.post-bridge.com/v1";

export interface PbSocialAccount {
  id: string;
  platform: string;
  username?: string;
  display_name?: string;
  profile_picture_url?: string;
}

export interface PbPost {
  id: string;
  status: string; // scheduled | processing | posted | failed ...
  results?: Array<{
    social_account_id: string;
    platform?: string;
    success?: boolean;
    url?: string;
    error?: string;
  }>;
}

export function isDryRun(): boolean {
  if (process.env.POST_BRIDGE_DRY_RUN === "true") return true;
  try {
    return !postBridgeApiKey.value();
  } catch {
    return true;
  }
}

async function pbFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PB_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${postBridgeApiKey.value()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Post Bridge ${path} failed (${response.status}): ${text}`);
  }
  return (await response.json()) as T;
}

export async function pbListAccounts(): Promise<PbSocialAccount[]> {
  if (isDryRun()) {
    return [
      { id: "pb_mock_ig", platform: "instagram", username: "yourbrand", display_name: "Your Brand" },
      { id: "pb_mock_tw", platform: "twitter", username: "yourbrand", display_name: "Your Brand" },
      { id: "pb_mock_li", platform: "linkedin", username: "your-brand", display_name: "Your Brand" },
    ];
  }
  const data = await pbFetch<{ data?: PbSocialAccount[] } | PbSocialAccount[]>("/social-accounts");
  return Array.isArray(data) ? data : data.data ?? [];
}

export async function pbUploadMediaFromBuffer(
  buffer: Buffer,
  mimeType: string,
  name: string
): Promise<string> {
  if (isDryRun()) {
    return `pb_mock_media_${name.replace(/[^a-z0-9]/gi, "").slice(0, 24)}`;
  }
  const { media_id, upload_url } = await pbFetch<{ media_id: string; upload_url: string }>(
    "/media/create-upload-url",
    {
      method: "POST",
      body: JSON.stringify({ mime_type: mimeType, size_bytes: buffer.length, name }),
    }
  );
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

export async function pbCreatePost(args: {
  caption: string;
  socialAccountIds: string[];
  mediaIds?: string[];
  scheduledAt?: string; // ISO UTC; omit = publish now
}): Promise<{ id: string; dryRun: boolean }> {
  if (isDryRun()) {
    return { id: `pb_mock_post_${args.socialAccountIds.join("_").slice(0, 32)}`, dryRun: true };
  }
  const post = await pbFetch<{ id: string } | { data: { id: string } }>("/posts", {
    method: "POST",
    body: JSON.stringify({
      caption: args.caption,
      social_accounts: args.socialAccountIds,
      ...(args.mediaIds?.length ? { media: args.mediaIds } : {}),
      ...(args.scheduledAt ? { scheduled_at: args.scheduledAt } : {}),
    }),
  });
  const id = "data" in post ? post.data.id : post.id;
  return { id, dryRun: false };
}

export async function pbGetPost(id: string): Promise<PbPost> {
  if (isDryRun()) {
    // Dry-run posts read back as immediately posted
    return { id, status: "posted", results: [] };
  }
  const data = await pbFetch<PbPost | { data: PbPost }>(`/posts/${id}`);
  return "data" in data ? (data as { data: PbPost }).data : (data as PbPost);
}
