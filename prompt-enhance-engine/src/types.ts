export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5';

export type VideoPlatform =
  | 'instagram_reels'
  | 'tiktok'
  | 'youtube_shorts'
  | 'youtube_landscape'
  | 'linkedin_feed'
  | 'tv_commercial';

export type VideoEngineTarget =
  | 'runway_gen3'
  | 'google_veo'
  | 'kling'
  | 'luma_dream_machine'
  | 'sora'
  | 'minimax_hailuo'
  | 'pika'
  | 'universal';

export type ShotType =
  | 'extreme_close_up'
  | 'macro_shot'
  | 'close_up'
  | 'medium_shot'
  | 'wide_cinematic'
  | 'drone_aerial'
  | 'low_angle_hero'
  | 'over_the_shoulder';

export type CameraMovement =
  | 'slow_push_in'
  | 'slow_pull_back'
  | 'orbital_arc_left'
  | 'orbital_arc_right'
  | 'dolly_forward'
  | 'crane_pedestal_up'
  | 'speed_ramp_fpv'
  | 'smooth_tracking'
  | 'static_locked_off';

export interface UserEnhanceRequest {
  rawPrompt: string;
  brandName?: string;
  brandCategory?: string;
  targetAudience?: string;
  platform?: VideoPlatform;
  aspectRatio?: AspectRatio;
  durationSeconds?: number;
  targetEngine?: VideoEngineTarget;
  customStyleNotes?: string;
}

export interface BrandAnalysis {
  brandName: string;
  inferredCategory: string;
  coreVibe: string;
  targetAudience: string;
  emotionalHook: string;
  occasionContext: {
    occasionName: string;
    culturalNuances: string[];
    visualSymbols: string[];
    festiveColorGrade: string;
  };
}

export interface VisualStyleGuide {
  artDirection: string;
  colorPalette: string[];
  lightingMood: string;
  lensAndOptics: string;
  renderAesthetic: string;
}

export interface VoiceoverBeat {
  timestamp: string;
  spokenText: string;
  deliveryTone: string;
}

export interface AudioBlueprint {
  musicDescription: string;
  bpmAndPacing: string;
  voiceoverScript: VoiceoverBeat[];
  sfxCues: Array<{ timestamp: string; sfx: string }>;
}

export interface VideoScene {
  sceneNumber: number;
  durationSec: number;
  timestampRange: string;
  sceneObjective: string;
  shotType: ShotType;
  cameraMovement: CameraMovement;
  subjectDescription: string;
  environmentAndBackground: string;
  lightingAndAtmosphere: string;
  motionAndPhysics: string;
  onScreenText: string | null;
  voiceoverLine: string | null;
  negativePrompt: string;
  /** Ready-to-use literal prompt optimized specifically for the target video generation model (1-2 sentences, zero poetic metaphors) */
  targetEnginePrompt: string;
  /** Optional reference image prompt for locking visual consistency */
  sceneImagePrompt?: string;
  /** Optional first-frame image URL / URI for Image-to-Video generation */
  referenceImageUrl?: string;
}

export interface ModelSpecificPayload {
  prompt: string;
  negativePrompt?: string;
  cameraSettings?: string;
  aspectRatio: AspectRatio;
  durationSeconds: number;
  inputImageUrl?: string;
  guidanceParameters?: Record<string, any>;
}

export interface EnhancedVideoBlueprint {
  requestId: string;
  title: string;
  logline: string;
  totalDurationSeconds: number;
  aspectRatio: AspectRatio;
  primaryTargetEngine: VideoEngineTarget;
  /** The locked reference image prompt used to generate the visual anchor frame with Imagen 3 */
  referenceImagePrompt: string;
  brandAnalysis: BrandAnalysis;
  visualStyleGuide: VisualStyleGuide;
  audioBlueprint: AudioBlueprint;
  scenes: VideoScene[];
  /** Model-specific payloads formatted for direct API submission or UI copy */
  modelPayloads: {
    runwayGen3?: ModelSpecificPayload[];
    googleVeo?: ModelSpecificPayload[];
    kling?: ModelSpecificPayload[];
    lumaDreamMachine?: ModelSpecificPayload[];
    sora?: ModelSpecificPayload[];
    minimaxHailuo?: ModelSpecificPayload[];
    universal?: ModelSpecificPayload[];
  };
  source?: 'llm_generated' | 'domain_fallback';
  llmModelUsed?: string;
  generatedAt: string;
}
