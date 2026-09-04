export interface LLMRecommendation {
  modelId: string;
  provider: 'google' | 'anthropic' | 'openai';
  displayName: string;
  recommendedFor: string;
  whyThisModel: string;
  isDefault?: boolean;
}

export interface VideoModelRecommendation {
  engineId: string;
  provider: string;
  displayName: string;
  bestUseCases: string[];
  promptingStyle: 'structured_tags' | 'natural_cinematic_prose' | 'camera_first' | 'action_first';
  supportedAspectRatios: string[];
  maxDurationPerClipSec: number;
}

export const RECOMMENDED_ENHANCER_LLMS: LLMRecommendation[] = [
  {
    modelId: 'gemini-2.5-pro',
    provider: 'google',
    displayName: 'Gemini 2.5 Pro (Google)',
    recommendedFor: 'Deep cultural nuance, intricate festive visual reasoning, multi-scene pacing',
    whyThisModel:
      'Has unmatched knowledge of regional Indian/global festivals, authentic cultural motifs (diyas, rangoli, silk textures), strict JSON schema mode, and 1M+ context window for multi-shot brand continuity.',
    isDefault: true,
  },
  {
    modelId: 'gemini-3.5-flash',
    provider: 'google',
    displayName: 'Gemini 3.5 Flash (Google)',
    recommendedFor: 'Sub-second real-time prompt enhancement in web/mobile UI',
    whyThisModel:
      'Extremely fast response time (<1.2s), low token cost, high fidelity in expanding short hooks into camera directions.',
  },
  {
    modelId: 'claude-3-7-sonnet',
    provider: 'anthropic',
    displayName: 'Claude 3.7 Sonnet (Anthropic)',
    recommendedFor: 'Artisan cinematic directing, poetic scriptwriting, and high-fashion aesthetics',
    whyThisModel:
      'Gold standard for cinematic vocabulary, sophisticated lighting descriptions, and non-cliché storytelling.',
  },
  {
    modelId: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o (OpenAI)',
    recommendedFor: 'Strict structured outputs and versatile multi-model pipelines',
    whyThisModel:
      'Flawless adherence to JSON schemas with comprehensive camera and lighting parameter generation.',
  },
];

export const TARGET_VIDEO_MODELS: VideoModelRecommendation[] = [
  {
    engineId: 'runway_gen3',
    provider: 'Runway ML',
    displayName: 'Runway Gen-3 Alpha / Turbo',
    bestUseCases: ['Commercial ads', 'Explicit camera motion paths', 'Cinematic realism'],
    promptingStyle: 'camera_first',
    supportedAspectRatios: ['16:9', '9:16'],
    maxDurationPerClipSec: 10,
  },
  {
    engineId: 'google_veo',
    provider: 'Google DeepMind',
    displayName: 'Google Veo 2 / 3.1',
    bestUseCases: ['Hyper-realistic lighting', 'Complex particle physics (sparks, smoke)', 'Visual consistency'],
    promptingStyle: 'natural_cinematic_prose',
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    maxDurationPerClipSec: 8,
  },
  {
    engineId: 'kling',
    provider: 'Kuaishou Kling AI',
    displayName: 'Kling 1.5 / 2.0 Pro',
    bestUseCases: ['Realistic human expressions', 'Fluid movements', 'Complex physical interactions'],
    promptingStyle: 'action_first',
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    maxDurationPerClipSec: 10,
  },
  {
    engineId: 'luma_dream_machine',
    provider: 'Luma AI',
    displayName: 'Luma Dream Machine 1.6',
    bestUseCases: ['Dynamic 3D camera fly-throughs', 'Rapid motion', 'Seamless transitions'],
    promptingStyle: 'structured_tags',
    supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3'],
    maxDurationPerClipSec: 5,
  },
  {
    engineId: 'sora',
    provider: 'OpenAI',
    displayName: 'OpenAI Sora',
    bestUseCases: ['Multi-shot narrative understanding', 'Complex scene environments', 'High dynamic range'],
    promptingStyle: 'natural_cinematic_prose',
    supportedAspectRatios: ['16:9', '9:16', '1:1', '4:5'],
    maxDurationPerClipSec: 20,
  },
];
