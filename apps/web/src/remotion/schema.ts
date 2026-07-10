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
