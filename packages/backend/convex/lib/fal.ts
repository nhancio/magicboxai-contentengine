import { requireFalKey } from "./models";

/**
 * Fal.ai lip-sync integration (fal-ai/sync-lipsync). Chosen over Replicate and
 * direct vendor APIs (Runway/Kling/Hedra) after cost research: Fal is
 * typically 30-50% cheaper than Replicate for the same models, with
 * predictable per-output pricing and a single key covering many models.
 *
 * Async queue API: submit -> poll status -> fetch result once COMPLETED.
 * Mirrors media.ts's Veo start/poll split so the rest of the codebase's
 * durable-job pattern (mayaTemplates.ts) applies unchanged.
 */

const FAL_QUEUE_BASE = "https://queue.fal.run/fal-ai/sync-lipsync";

export async function submitLipSync(videoUrl: string, audioUrl: string): Promise<string> {
  const key = requireFalKey();
  const res = await fetch(FAL_QUEUE_BASE, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ video_url: videoUrl, audio_url: audioUrl }),
  });
  if (!res.ok) {
    throw new Error(`[fal] submit ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data?.request_id) throw new Error("[fal] submit returned no request_id");
  return data.request_id as string;
}

export async function pollLipSyncStatus(
  requestId: string,
): Promise<{ done: boolean; videoUrl?: string; error?: string }> {
  const key = requireFalKey();
  const statusRes = await fetch(`${FAL_QUEUE_BASE}/requests/${requestId}/status`, {
    headers: { Authorization: `Key ${key}` },
  });
  if (!statusRes.ok) {
    throw new Error(`[fal] status ${statusRes.status}: ${(await statusRes.text()).slice(0, 300)}`);
  }
  const status = await statusRes.json();

  if (status.status === "COMPLETED") {
    const resultRes = await fetch(`${FAL_QUEUE_BASE}/requests/${requestId}`, {
      headers: { Authorization: `Key ${key}` },
    });
    if (!resultRes.ok) {
      throw new Error(`[fal] result ${resultRes.status}: ${(await resultRes.text()).slice(0, 300)}`);
    }
    const result = await resultRes.json();
    const videoUrl: string | undefined = result?.video?.url;
    if (!videoUrl) return { done: true, error: "completed request had no video url" };
    return { done: true, videoUrl };
  }

  if (status.status === "ERROR") {
    return { done: true, error: JSON.stringify(status.error ?? status) };
  }

  // IN_QUEUE / IN_PROGRESS
  return { done: false };
}
