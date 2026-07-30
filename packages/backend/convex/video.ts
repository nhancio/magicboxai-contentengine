import { action } from "./_generated/server";
import { v } from "convex/values";
import { requireUid } from "./lib/auth";

/**
 * Trigger the dedicated Remotion rendering microservice.
 * This replaces the fake Firebase render function.
 */
export const startVideoRender = action({
  args: {
    templateId: v.string(),
    props: v.any(), // VideoProps
    videoId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUid(ctx);
    // In production, RENDERER_URL would point to the deployed Express/Cloud Run worker
    // or we would use @remotion/lambda directly here.
    const rendererUrl = process.env.RENDERER_URL || "http://localhost:8005/api/render";
    
    console.log(`[Convex:Video] Starting render for template ${args.templateId}`);
    
    try {
      const response = await fetch(rendererUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: args.templateId,
          props: args.props,
          videoId: args.videoId,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Renderer failed: ${errText}`);
      }

      const data = await response.json();
      return { success: true, ...data };
    } catch (error: any) {
      console.error("[Convex:Video] Render failed:", error.message);
      throw new Error(`Failed to render video: ${error.message}`);
    }
  },
});

/**
 * Compose uploaded/generated clips, stills, a logo, voice, and optional music
 * through the renderer's declarative FFmpeg pipeline.
 *
 * The renderer currently returns an ephemeral worker URL. Production must add
 * object-storage upload before this result is attached to a post.
 */
export const startCompositionRender = action({
  args: {
    manifest: v.any(),
  },
  handler: async (ctx, args) => {
    await requireUid(ctx);
    const rendererBase = process.env.RENDERER_URL || "http://localhost:8005";
    const rendererUrl = rendererBase.endsWith("/api/compose")
      ? rendererBase
      : rendererBase.endsWith("/api/render")
        ? rendererBase.replace(/\/api\/render$/, "/api/compose")
        : `${rendererBase.replace(/\/+$/, "")}/api/compose`;
    const token = process.env.RENDERER_TOKEN;
    const response = await fetch(rendererUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ manifest: args.manifest }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`FFmpeg renderer failed: ${data?.error ?? response.statusText}`);
    }
    return data;
  },
});
