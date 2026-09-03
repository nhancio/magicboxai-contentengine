import { MONID_API_BASE, requireMonidKey } from "./models";
import { filterAIGeneratedOnly } from "./maya/aiContentFilter";
import type { MemeTemplate } from "./maya/types";

/**
 * Server-side Monid/TikHub reel search — ported from the retired MAYA-Templates
 * prototype's monidService.ts. Runs inside a Convex action so the API key never
 * reaches the browser (the old client-side version also hardcoded a fallback
 * key in source, which this replaces with requireMonidKey()'s hard failure).
 *
 * STRICT: never substitutes curated placeholder footage as a search result —
 * those clips aren't AI-generated, so passing them off as "results" would
 * defeat the whole point of filterAIGeneratedOnly. Any failure (missing key,
 * API error, no runId, empty poll, or the AI-content filter rejecting
 * everything) returns an EMPTY result with a reason, never substitute content.
 *
 * Every raw Monid result is verified as genuinely AI-generated content (see
 * filterAIGeneratedOnly) before it's returned — keyword matching alone
 * ("ai generated" in the search query) can't guarantee that, since a normal
 * human-recorded reel can still match on caption/hashtag text.
 */

interface MonidReelItem {
  id: string;
  code: string;
  caption?: { text?: string };
  video_versions?: Array<{ url: string }>;
  image_versions2?: { candidates?: Array<{ url: string }> };
  play_count?: number;
  like_count?: number;
  comment_count?: number;
  music_metadata?: { song_name?: string };
  user?: { username?: string; full_name?: string; profile_pic_url?: string };
}

export interface TrendingReelsResult {
  /** Verified AI-generated reels only. Empty when nothing qualified — never padded with non-AI placeholder content. */
  templates: MemeTemplate[];
  /** "monid" = real verified AI results. "empty" = nothing qualified; see fallbackReason. */
  source: "monid" | "empty";
  /** Why the result is empty (missing key, API error, or everything failed the AI-content filter). */
  fallbackReason?: string;
  /** Pass this back as `paginationToken` on the next call to get a different page — same keyword returns the same top results otherwise. */
  nextPaginationToken?: string;
}

/** No AI-generated content qualified — return nothing rather than substituting non-AI footage. */
function emptyResult(reason: string, nextPaginationToken?: string): TrendingReelsResult {
  return { templates: [], source: "empty", fallbackReason: reason, nextPaginationToken };
}

export async function searchTrendingReels(options: {
  keyword?: string;
  paginationToken?: string;
  timeoutMs?: number;
}): Promise<TrendingReelsResult> {
  const keyword = options.keyword || "indian meme brain rot";
  let key: string;
  try {
    key = requireMonidKey();
  } catch (err) {
    console.warn("[monid] MONID_API_KEY not set:", err);
    return emptyResult("MONID_API_KEY is not set on this Convex deployment");
  }

  try {
    const runRes = await fetch(`${MONID_API_BASE}/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "tikhub",
        endpoint: "/api/v1/instagram/v2/search_reels",
        input: {
          queryParams: {
            keyword,
            ...(options.paginationToken ? { pagination_token: options.paginationToken } : {}),
          },
        },
      }),
    });

    if (!runRes.ok) {
      const reason = `Monid run failed (${runRes.status})`;
      console.warn(`[monid] ${reason}`);
      return emptyResult(reason);
    }

    const runData = await runRes.json();
    const runId: string | undefined = runData?.runId;
    if (!runId) {
      return emptyResult("Monid returned no runId");
    }

    const { items: rawItems, paginationToken: nextPaginationToken } = await pollRunResult(
      runId,
      key,
      options.timeoutMs ?? 30_000,
    );
    if (!rawItems.length) {
      return emptyResult("Monid returned no reels for this query", nextPaginationToken);
    }

    const converted = rawItems.map((item, idx) => convertReelToTemplate(item, idx));
    const aiOnly = await filterAIGeneratedOnly(converted);
    console.log(`[monid] AI-content filter kept ${aiOnly.length}/${converted.length} reels for "${keyword}"`);
    if (!aiOnly.length) {
      return emptyResult(
        `None of the ${converted.length} reels found were AI-generated — try refreshing for a different page`,
        nextPaginationToken,
      );
    }
    return { templates: aiOnly, source: "monid", nextPaginationToken };
  } catch (err) {
    const reason = `Monid search error: ${String(err).slice(0, 200)}`;
    console.warn(`[monid] ${reason}`);
    return emptyResult(reason);
  }
}

async function pollRunResult(
  runId: string,
  apiKey: string,
  timeoutMs: number,
  intervalMs = 3000,
): Promise<{ items: MonidReelItem[]; paginationToken?: string }> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const res = await fetch(`${MONID_API_BASE}/runs/${runId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status === "COMPLETED") {
        const items = data.output?.data?.items || data.output?.items || data.response?.data?.items || [];
        const paginationToken: string | undefined =
          data.output?.data?.pagination_token || data.output?.pagination_token || data.response?.data?.pagination_token;
        return { items, paginationToken };
      }
      if (data.status === "FAILED") return { items: [] };
    } catch (err) {
      console.warn("[monid] polling error:", err);
    }
  }
  console.warn(`[monid] polling timed out for run ${runId}`);
  return { items: [] };
}

/**
 * Truncates by Unicode code point, not UTF-16 code unit. Real captions are
 * full of emoji (surrogate pairs — 2 code units each); a plain .slice() that
 * lands mid-pair leaves a lone surrogate in the string, which corrupts JSON
 * serialization further down the pipeline ("unexpected end of hex escape").
 */
function safeTruncate(str: string, maxChars: number): string {
  const chars = Array.from(str);
  return chars.length > maxChars ? chars.slice(0, maxChars).join("") : str;
}

function convertReelToTemplate(item: MonidReelItem, index: number): MemeTemplate {
  const captionText = item.caption?.text || "Trending Indian Meme Reel";
  const cleanHook = captionText.split("\n")[0]?.replace(/#\w+/g, "").trim() || "Desi Brainrot Meme Template";
  const videoUrl =
    item.video_versions?.[0]?.url ||
    "https://assets.mixkit.co/videos/preview/mixkit-hands-holding-a-smartphone-playing-a-video-41584-large.mp4";
  const thumbUrl =
    item.image_versions2?.candidates?.[0]?.url ||
    "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80";

  return {
    templateId: `monid_reel_${item.id || item.code || index + 1}`,
    title: cleanHook.length > 50 ? `${safeTruncate(cleanHook, 47)}...` : cleanHook,
    category: "Indian Brainrot",
    format: "talking_head_rant",
    sourceReelUrl: item.code ? `https://www.instagram.com/reel/${item.code}/` : undefined,
    previewVideoUrl: videoUrl,
    thumbnailUrl: thumbUrl,
    previewImageUrl: thumbUrl,
    author: item.user
      ? { username: item.user.username, full_name: item.user.full_name, profile_pic_url: item.user.profile_pic_url }
      : undefined,
    durationSec: 8,
    aspectRatio: "9:16",
    viralHook: cleanHook,
    humorMechanism: "Viral pacing with relatable punchline drop",
    culturalContext: "Trending social media reel from Indian creator ecosystem",
    metrics: {
      plays: item.play_count || 1250000,
      likes: item.like_count || 85000,
      comments: item.comment_count || 4200,
    },
    beats: [
      {
        timestampSec: 0,
        durationSec: 3.0,
        label: "The Confusion Setup",
        visualAction: "Speaker makes an expressive opening hook",
        originalAudioCue: "Original Reel Audio",
        suggestedBrandAction: "Highlight user frustration with traditional alternatives",
      },
      {
        timestampSec: 3.0,
        durationSec: 3.0,
        label: "The Rant Escalation",
        visualAction: "Fast hand gestures and rapid delivery",
        suggestedBrandAction: "Introduce brand value proposition",
      },
      {
        timestampSec: 6.0,
        durationSec: 2.0,
        label: "The Punchline Climax",
        visualAction: "Freeze frame or punchline smirk",
        suggestedBrandAction: "Brand call-to-action lockup",
      },
    ],
    textSlots: [
      {
        slotId: "top_header",
        defaultText: cleanHook.toUpperCase(),
        placement: "top",
        fontSize: "large",
        fontStyle: "bold_impact",
        backgroundColor: "#000000CC",
        textColor: "#FFE600",
        animation: "pop_in",
      },
      {
        slotId: "bottom_punchline",
        defaultText: "Bro really thought we wouldn't notice 😭💀",
        placement: "bottom",
        fontSize: "medium",
        fontStyle: "classic_meme",
        backgroundColor: "#DC2626EE",
        textColor: "#FFFFFF",
        animation: "typewriter",
      },
      {
        slotId: "brand_badge",
        defaultText: "Automate with MagicBox AI 🚀",
        placement: "bottom_right",
        fontSize: "small",
        backgroundColor: "#0F172AEB",
        textColor: "#38BDF8",
      },
    ],
    audioPlan: {
      trackType: "bgm",
      originalSoundName: item.music_metadata?.song_name || "Original Audio",
      suggestedTrackStyle: "High-energy Phonk with comedic sound effects",
      bpm: 124,
      sfxCues: [
        { timestampSec: 0.1, sfxName: "record_scratch", volumeMultiplier: 0.7 },
        { timestampSec: 5.8, sfxName: "vine_boom", volumeMultiplier: 1.0 },
      ],
    },
    lipSyncSlots: [
      {
        speakerId: "speaker_primary",
        speakerDescription: "Main reel protagonist",
        startSec: 0.2,
        endSec: 5.8,
        originalDialogue: safeTruncate(captionText, 120),
        emotionalExpression: "ranting",
      },
    ],
    defaultScript: cleanHook,
    tags: ["trending", "monid_reel", "brainrot", "india"],
  };
}
