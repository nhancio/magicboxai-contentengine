import { z } from "zod";

export const videoPropsSchema = z.object({
  /** Avatar photo URL */
  avatarUrl: z.string().url().optional(),
  /** Avatar display name */
  avatarName: z.string().default("Creator"),
  /** Product photo URL */
  productImageUrl: z.string().url().optional(),
  /** Product name */
  productName: z.string().default("Product"),
  /** Hook line (opening) */
  hook: z.string().default("Check this out!"),
  /** Main script body */
  script: z.string().default(""),
  /** Call-to-action text */
  cta: z.string().default("Link in bio!"),
  /** On-screen captions */
  captions: z.array(z.string()).default([]),
  /** Brand color (hex) */
  brandColor: z.string().default("#8b5cf6"),
  /** Platform — affects aspect ratio */
  platform: z.enum(["TikTok", "Instagram Reels", "YouTube Shorts"]).default("TikTok"),
  /** Tone affects visual style */
  tone: z.string().default("Bold"),
});

export type VideoProps = z.infer<typeof videoPropsSchema>;

/** Standard vertical video dimensions (9:16) */
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const VIDEO_FPS = 30;

/**
 * Props for MayaMemeComposition — burns brand text overlays + logo onto an
 * already-generated base video (lip-synced or Veo-synthetic). Duration is
 * per-template, so the composition uses calculateMetadata to size itself from
 * durationInFrames/fps instead of a fixed registration value.
 */
export const mayaMemeCompositionSchema = z.object({
  baseVideoUrl: z.string().url(),
  durationInFrames: z.number().int().positive(),
  fps: z.number().int().positive().default(30),
  textOverlays: z
    .array(
      z.object({
        text: z.string(),
        placement: z.string().default("top"),
        color: z.string().default("#FFFFFF"),
        bgColor: z.string().optional(),
        startFrame: z.number().int().nonnegative().default(0),
        durationFrames: z.number().int().positive().default(60),
      }),
    )
    .default([]),
  /** Mute-friendly caption cards burned into the lower third. */
  subtitleCues: z
    .array(
      z.object({
        text: z.string(),
        startFrame: z.number().int().nonnegative().default(0),
        durationFrames: z.number().int().positive().default(20),
      }),
    )
    .default([]),
  /** Voice track laid over the base video — used for the Veo path, whose
   * footage is silent. Omitted for lip-sync output, which already has audio. */
  voiceAudioUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
});

export type MayaMemeCompositionProps = z.infer<typeof mayaMemeCompositionSchema>;
