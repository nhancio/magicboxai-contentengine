/**
 * Ported from the standalone MAYA-Templates prototype (now retired — this file
 * plus curatedTemplates.ts/adaptationLogic.ts are the source of truth). Raw
 * Monid/TikHub wire types live in ./monid, not here.
 */

export type MemeFormat =
  | "talking_head_rant"
  | "dramatic_reaction"
  | "brainrot_dialogue"
  | "before_after_comparison"
  | "absurdist_humor"
  | "sigma_grindset_satire"
  | "pov_relatable"
  | "interview_voxpop"
  | "split_screen_chaos";

export type AspectRatio = "9:16" | "16:9" | "1:1";

export interface TemplateBeat {
  timestampSec: number;
  durationSec: number;
  label: string;
  visualAction: string;
  originalAudioCue?: string;
  suggestedBrandAction?: string;
}

export interface TextOverlaySlot {
  slotId: "top_header" | "bottom_punchline" | "center_caption" | "brand_badge" | "subtitles";
  defaultText: string;
  placement: "top" | "bottom" | "center" | "bottom_right" | "top_left";
  fontSize: "large" | "medium" | "small";
  fontStyle?: "bold_impact" | "classic_meme" | "kinetic_sans" | "neon_glow";
  backgroundColor?: string;
  textColor?: string;
  animation?: "pop_in" | "typewriter" | "bounce" | "fade" | "static";
  startSec?: number;
  endSec?: number;
}

export interface AudioSlot {
  trackType: "bgm" | "voiceover" | "sfx" | "meme_audio_bite";
  originalSoundName?: string;
  originalAudioUrl?: string;
  suggestedTrackStyle: string;
  bpm?: number;
  sfxCues: Array<{
    timestampSec: number;
    sfxName: "vine_boom" | "bruh" | "dramatic_reverb" | "record_scratch" | "cash_register" | "laser" | "applause" | string;
    volumeMultiplier?: number;
  }>;
}

export interface LipSyncSlot {
  speakerId: string;
  speakerDescription: string;
  startSec: number;
  endSec: number;
  originalDialogue: string;
  emotionalExpression: "shocked" | "confident" | "ranting" | "confused" | "smug" | "excited" | "deadpan";
  headMotionPrompt?: string;
}

export interface MemeTemplate {
  templateId: string;
  title: string;
  category: "Indian Brainrot" | "Desi Comedy" | "Workplace / Tech Meme" | "Relatable Lifestyle" | "Sigma Satire";
  format: MemeFormat;
  sourceReelUrl?: string;
  previewVideoUrl: string;
  thumbnailUrl?: string;
  previewImageUrl?: string;
  author?: {
    username?: string;
    full_name?: string;
    profile_pic_url?: string;
  };
  durationSec: number;
  aspectRatio: AspectRatio;
  viralHook: string;
  humorMechanism: string;
  culturalContext: string;
  metrics?: {
    plays?: number;
    likes?: number;
    comments?: number;
  };
  beats: TemplateBeat[];
  textSlots: TextOverlaySlot[];
  audioPlan: AudioSlot;
  lipSyncSlots: LipSyncSlot[];
  defaultScript: string;
  tags: string[];
}

export interface BrandContext {
  name: string;
  industry?: string;
  audience?: string;
  toneOfVoice?: string;
  productOffering?: string;
  uniqueSellingPoint?: string;
  targetCallToAction?: string;
  colors?: {
    primary: string;
    secondary?: string;
    accent?: string;
  };
  logoUrl?: string;
  websiteUrl?: string;
}

export interface BrandAdaptationRequest {
  templateId?: string;
  template?: MemeTemplate;
  brand: BrandContext;
  customProductAngle?: string;
  humorIntensity?: "subtle" | "unhinged_brainrot" | "relatable_corporate" | "high_energy";
  targetPlatform?: "instagram_reels" | "youtube_shorts" | "tiktok" | "linkedin";
  enableLipSync?: boolean;
}

export interface AdaptedLipSyncLine {
  speakerId: string;
  startSec: number;
  endSec: number;
  spokenDialogue: string;
  deliveryTone: string;
  facialExpression: string;
  phonemePacing?: "fast_rant" | "dramatic_slow" | "punchy_rhythmic" | "natural";
}

export interface AdaptedTextOverlay {
  slotId: string;
  text: string;
  placement: string;
  color: string;
  bgColor?: string;
  startSec?: number;
  endSec?: number;
}

/** A mute-friendly caption card — Reels are mostly watched with sound off. */
export interface AdaptedSubtitleCue {
  startSec: number;
  endSec: number;
  text: string;
}

/** A sound-effect cue timed to a beat (data only — not yet mixed into rendered audio, see composeAndFinish). */
export interface AdaptedSfxCue {
  timestampSec: number;
  sfxName: string;
  volumeMultiplier?: number;
}

/** The AI-generation half of an adaptation — everything Gemini or the
 * algorithmic fallback produce. Assembled with the source template into the
 * full mayaAdaptations row by adaptationLogic.finalizeAdaptation. */
export interface SynthesizedAdaptation {
  hookText: string;
  adaptedScript: string;
  textOverlays: AdaptedTextOverlay[];
  lipSyncScript: AdaptedLipSyncLine[];
  videoModelPrompts: {
    googleVeoPrompt: string;
    negativePrompt: string;
  };
  subtitleCues: AdaptedSubtitleCue[];
  sfxCues: AdaptedSfxCue[];
  /** Ready-to-paste Instagram caption, ending in the brand's CTA. */
  instagramCaption: string;
  hashtags: string[];
  /** One sentence: the comedic angle chosen and why it fits this footage. */
  adaptationNote?: string;
}
