import type { VideoProps } from "./schema";
import type { TemplateId } from "./VideoPlayer";

/**
 * Renders a video by calling the Cloud Function which uses Remotion's
 * server-side rendering. The function renders the composition to MP4
 * and uploads it to Firebase Storage.
 *
 * For now, we use client-side rendering via the Player's built-in
 * recording capabilities, or a simple "export script + metadata" approach.
 *
 * The actual MP4 rendering happens server-side via the Cloud Function
 * `renderRemotionVideo`.
 */

import { httpsCallable } from "firebase/functions";
import { functions } from "@shared/lib/firebase";

export interface RenderVideoRequest {
  templateId: TemplateId;
  props: VideoProps;
}

export interface RenderVideoResponse {
  videoUrl: string;
  duration: number;
}

/**
 * Calls the Cloud Function to render a Remotion video server-side.
 * Falls back to a metadata-only export if rendering is not available.
 */
export async function renderVideo(
  request: RenderVideoRequest
): Promise<RenderVideoResponse> {
  if (!functions) {
    throw new Error("Firebase functions not initialized");
  }

  const renderFn = httpsCallable<RenderVideoRequest, RenderVideoResponse>(
    functions,
    "renderRemotionVideo"
  );

  const result = await renderFn(request);
  return result.data;
}

/**
 * Exports the video script and metadata as a JSON file for download.
 * This is a fallback when server-side rendering is not available.
 */
export function exportVideoMetadata(
  templateId: TemplateId,
  props: VideoProps
): void {
  const metadata = {
    templateId,
    props,
    exportedAt: new Date().toISOString(),
    format: "magicboxai-video-project",
    version: 1,
  };

  const blob = new Blob([JSON.stringify(metadata, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${props.productName.replace(/\s+/g, "-").toLowerCase()}-video.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
