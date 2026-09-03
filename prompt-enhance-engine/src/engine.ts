import {
  UserEnhanceRequest,
  EnhancedVideoBlueprint,
  VideoScene,
  AspectRatio,
  VideoEngineTarget,
} from './types.js';
import { LLMAdapter, LLMProviderConfig } from './adapters.js';
import { VideoPromptFormatters } from './formatters.js';

declare const process: { env: Record<string, string | undefined> } | undefined;

function getEnv(name: string): string | undefined {
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[name];
  }
  return undefined;
}

export interface EnhanceOptions {
  provider?: 'google' | 'openai' | 'anthropic';
  apiKey?: string;
  modelId?: string;
  forceFallback?: boolean;
}

export class PromptEnhanceEngine {
  private defaultProvider: 'google' | 'openai' | 'anthropic';
  private defaultApiKey?: string;
  private defaultModelId?: string;

  constructor(options?: {
    provider?: 'google' | 'openai' | 'anthropic';
    apiKey?: string;
    modelId?: string;
  }) {
    this.defaultProvider = options?.provider || 'google';
    this.defaultApiKey = options?.apiKey;
    this.defaultModelId = options?.modelId;
  }

  /**
   * Main entry point: Enhances a raw user prompt into a complete video blueprint
   */
  async enhance(
    request: UserEnhanceRequest,
    options?: EnhanceOptions,
  ): Promise<EnhancedVideoBlueprint> {
    const provider = options?.provider || this.defaultProvider;
    const apiKey = options?.apiKey || this.defaultApiKey;
    const modelId = options?.modelId || this.defaultModelId;
    const forceFallback = options?.forceFallback || false;

    let parsedRawBlueprint: any = null;
    let source: 'llm_generated' | 'domain_fallback' = 'domain_fallback';
    let llmModelUsed: string | undefined = undefined;

    if (!forceFallback && (apiKey || getEnv('GEMINI_API_KEY') || getEnv('OPENAI_API_KEY') || getEnv('ANTHROPIC_API_KEY'))) {
      try {
        const config: LLMProviderConfig = { provider, apiKey, modelId };
        const rawJsonString = await LLMAdapter.callLLM(config, request);
        parsedRawBlueprint = this.cleanAndParseJSON(rawJsonString);
        source = 'llm_generated';
        llmModelUsed = modelId;
      } catch (err: any) {
        console.warn(`[PromptEnhanceEngine] LLM API call failed (${err.message}). Synthesizing domain-adaptive blueprint.`);
      }
    }

    if (!parsedRawBlueprint) {
      parsedRawBlueprint = this.generateFallbackBlueprint(request);
      source = 'domain_fallback';
    }

    return this.buildCompleteBlueprint(request, parsedRawBlueprint, source, llmModelUsed);
  }

  private cleanAndParseJSON(raw: string): any {
    let clean = raw.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }
    return JSON.parse(clean);
  }

  private buildCompleteBlueprint(
    request: UserEnhanceRequest,
    raw: any,
    source: 'llm_generated' | 'domain_fallback' = 'domain_fallback',
    llmModelUsed?: string,
  ): EnhancedVideoBlueprint {
    const aspectRatio: AspectRatio = request.aspectRatio || '9:16';
    const primaryEngine: VideoEngineTarget = request.targetEngine || 'google_veo';
    const totalDuration = request.durationSeconds || 8;

    const scenes: VideoScene[] = (raw.scenes || []).map((scene: any, idx: number) => {
      const sceneNum = scene.sceneNumber || idx + 1;
      const durationSec = scene.durationSec || totalDuration;

      return {
        sceneNumber: sceneNum,
        durationSec,
        timestampRange: scene.timestampRange || `0:00 - 0:${String(durationSec).padStart(2, '0')}`,
        sceneObjective: scene.sceneObjective || 'Establish emotional atmosphere and cinematic brand story',
        shotType: scene.shotType || 'medium_shot',
        cameraMovement: scene.cameraMovement || 'slow_push_in',
        subjectDescription: scene.subjectDescription || '',
        environmentAndBackground: scene.environmentAndBackground || '',
        lightingAndAtmosphere: scene.lightingAndAtmosphere || 'Cinematic lighting with rich depth of field',
        motionAndPhysics: scene.motionAndPhysics || 'Natural fluid slow motion',
        onScreenText: scene.onScreenText || null,
        voiceoverLine: scene.voiceoverLine || null,
        negativePrompt: scene.negativePrompt || 'blurry, low quality, deformed, artifacts',
        targetEnginePrompt: scene.targetEnginePrompt || scene.subjectDescription || '',
      };
    });

    const runwayPayloads = scenes.map((s) => VideoPromptFormatters.formatRunwayGen3(s, aspectRatio));
    const veoPayloads = scenes.map((s) => VideoPromptFormatters.formatGoogleVeo(s, aspectRatio));
    const klingPayloads = scenes.map((s) => VideoPromptFormatters.formatKling(s, aspectRatio));
    const lumaPayloads = scenes.map((s) => VideoPromptFormatters.formatLuma(s, aspectRatio));
    const soraPayloads = scenes.map((s) => VideoPromptFormatters.formatSora(s, aspectRatio));

    return {
      requestId: `enh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: raw.title || `${request.brandName || 'Brand'} Launch Film`,
      logline: raw.logline || 'A high-impact cinematic commercial capturing the essence of the brand.',
      totalDurationSeconds: totalDuration,
      aspectRatio,
      primaryTargetEngine: primaryEngine,
      referenceImagePrompt:
        raw.referenceImagePrompt ||
        `Cinematic commercial hero frame of ${request.brandName || 'the brand'} product. 35mm anamorphic prime lens, f/1.8 shallow depth of field, natural lighting, photorealistic 8k commercial quality.`,
      brandAnalysis: {
        brandName: raw.brandAnalysis?.brandName || request.brandName || 'Brand',
        inferredCategory: raw.brandAnalysis?.inferredCategory || request.brandCategory || 'Commercial',
        coreVibe: raw.brandAnalysis?.coreVibe || 'Cinematic, High-Impact, Modern',
        targetAudience: raw.brandAnalysis?.targetAudience || request.targetAudience || 'Target commercial audience',
        emotionalHook: raw.brandAnalysis?.emotionalHook || 'Delivering innovative value and unforgettable impact',
        occasionContext: raw.brandAnalysis?.occasionContext || {
          occasionName: 'Commercial Campaign',
          culturalNuances: ['Modern high-impact communication'],
          visualSymbols: ['Sleek modern architecture', 'Confident leadership', 'Illuminated cityscapes'],
          festiveColorGrade: 'Clean High-Contrast Commercial Grade',
        },
      },
      visualStyleGuide: {
        artDirection: raw.visualStyleGuide?.artDirection || 'Premium commercial aesthetics with high-contrast volumetric depth',
        colorPalette: raw.visualStyleGuide?.colorPalette || ['#00E5FF', '#0F172A', '#3B82F6', '#FFFFFF'],
        lightingMood: raw.visualStyleGuide?.lightingMood || 'Volumetric cinematic lighting with soft rim illumination',
        lensAndOptics: raw.visualStyleGuide?.lensAndOptics || '35mm anamorphic prime lens, f/1.8 shallow depth of field',
        renderAesthetic: raw.visualStyleGuide?.renderAesthetic || '8k commercial film stock, razor-sharp details',
      },
      audioBlueprint: {
        musicDescription: raw.audioBlueprint?.musicDescription || 'Modern cinematic score building into an impactful climax',
        bpmAndPacing: raw.audioBlueprint?.bpmAndPacing || '110 BPM confident momentum',
        voiceoverScript: raw.audioBlueprint?.voiceoverScript || [
          { timestamp: '0:00 - 0:04', spokenText: `Empowering every moment with ${request.brandName || 'our brand'}.`, deliveryTone: 'Confident and visionary' },
          { timestamp: '0:04 - 0:08', spokenText: 'Experience the next standard of excellence.', deliveryTone: 'Inspiring brand sign-off' },
        ],
        sfxCues: raw.audioBlueprint?.sfxCues || [
          { timestamp: '0:01', sfx: 'Cinematic whoosh and impact' },
          { timestamp: '0:05', sfx: 'Deep sub-bass swell' },
        ],
      },
      scenes,
      modelPayloads: {
        runwayGen3: runwayPayloads,
        googleVeo: veoPayloads,
        kling: klingPayloads,
        lumaDreamMachine: lumaPayloads,
        sora: soraPayloads,
      },
      source,
      llmModelUsed,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Internal intelligent fallback synthesizer adapting to the specific industry and prompt intent
   */
  private generateFallbackBlueprint(request: UserEnhanceRequest): any {
    const rawLower = (request.rawPrompt || '').toLowerCase();
    const catLower = (request.brandCategory || '').toLowerCase();
    const brand = request.brandName || 'Brand';
    const isSingleShot = (request.durationSeconds || 8) <= 8;

    const isDiwali = rawLower.includes('diwali') || rawLower.includes('deepavali') || rawLower.includes('festive diwali');
    const isTechOrLaunch =
      rawLower.includes('launch') ||
      rawLower.includes('b2b') ||
      rawLower.includes('saas') ||
      rawLower.includes('tech') ||
      rawLower.includes('software') ||
      rawLower.includes('app') ||
      rawLower.includes('marketing') ||
      rawLower.includes('sales') ||
      rawLower.includes('deal') ||
      rawLower.includes('outreach') ||
      catLower.includes('tech') ||
      catLower.includes('saas') ||
      catLower.includes('b2b') ||
      catLower.includes('software') ||
      catLower.includes('sales') ||
      catLower.includes('marketing');

    // 1. DIWALI ONLY IF EXPLICITLY REQUESTED
    if (isDiwali) {
      return {
        title: `${brand} Diwali Festive Celebration`,
        logline: 'An evocative 8-second cinematic journey celebrating warmth, luxury, and festive togetherness.',
        brandAnalysis: {
          brandName: brand,
          inferredCategory: request.brandCategory || 'Luxury Lifestyle & Festive Retail',
          coreVibe: 'Warm, Regal, Cinematic, Heartfelt',
          targetAudience: request.targetAudience || 'Festive consumers celebrating light and traditions',
          emotionalHook: 'Connecting families with shared light and festive elegance',
          occasionContext: {
            occasionName: 'Diwali',
            culturalNuances: ['Lighting earthen diyas at blue-hour dusk', 'Marigold floral rangoli arrangements', 'Sharing festive sweets'],
            visualSymbols: ['Handcrafted clay diyas', 'Warm golden fairy lights', 'Silk zari weaves', 'Glowing sparkler embers'],
            festiveColorGrade: 'Royal Amber Gold, Deep Crimson, Terracotta, Indigo Dusk',
          },
        },
        visualStyleGuide: {
          artDirection: 'High-end luxury commercial cinematography, authentic festive warmth, rich depth of field',
          colorPalette: ['#D4AF37 (Gold)', '#E25822 (Amber)', '#4B1E2F (Wine)', '#0F172A (Dusk)'],
          lightingMood: 'Warm glowing candle flame practicals with soft golden backlight and circular bokeh',
          lensAndOptics: '35mm anamorphic prime lens, f/1.4 shallow DOF',
          renderAesthetic: 'Shot on 35mm film stock, 8k resolution, photorealistic commercial grade',
        },
        audioBlueprint: {
          musicDescription: 'Modern classical fusion featuring bansuri flute and sitar layered over warm acoustic guitar and uplifting percussion crescendo',
          bpmAndPacing: '82 BPM, gentle start accelerating into a joyful climax',
          voiceoverScript: [
            { timestamp: '0:00 - 0:04', spokenText: 'In every flickering light, we find the moments that bring us closer.', deliveryTone: 'Warm, poetic baritone' },
            { timestamp: '0:04 - 0:08', spokenText: `This Diwali, celebrate the light that connects us all. ${brand}.`, deliveryTone: 'Joyful and resonant brand sign-off' },
          ],
          sfxCues: [
            { timestamp: '0:01', sfx: 'Match striking and gentle diya flame whoosh' },
            { timestamp: '0:05', sfx: 'Soft clinking of brass urlis and festive chime' },
          ],
        },
        scenes: isSingleShot
          ? [
              {
                sceneNumber: 1,
                durationSec: 8,
                timestampRange: '0:00 - 0:08',
                sceneObjective: 'Breathtaking 8-second cinematic hero commercial shot',
                shotType: 'macro_shot',
                cameraMovement: 'slow_push_in',
                subjectDescription: `Extreme close-up of graceful hands adorned with intricate henna and a gold ring lighting an earthen clay diya with a brass taper match. As the golden flame ignites in smooth slow motion, the warm light reveals fresh marigold floral rangoli and the ambient glow of ${brand}'s festive celebration.`,
                environmentAndBackground: 'Intricate floral rangoli made of fresh marigold petals on dark teak courtyard floor, out-of-focus fairy lights twinkling in dusk background',
                lightingAndAtmosphere: 'Warm golden diya flame casting flickering reflections across skin and brass, soft volumetric smoke wisps, circular bokeh in dark indigo dusk',
                motionAndPhysics: 'Flame ignites smoothly in 120fps slow motion, heat shimmer distortion, fluid continuous slow camera push-in',
                onScreenText: `Happy Diwali | ${brand}`,
                voiceoverLine: 'In every flickering light, celebrate the golden moments.',
                negativePrompt: 'blurry, low quality, deformed hands, extra fingers, cartoonish, 3d render, plastic skin, jittery artifacts, low resolution',
                targetEnginePrompt: 'Cinematic commercial video, slow continuous push in. Extreme close-up of graceful hands with delicate mehendi lighting an earthen clay diya. Warm golden flame igniting with subtle smoke wisps, illuminating a floral marigold rangoli. Twinkling warm fairy lights bokeh in dark indigo dusk background. Shot on 35mm anamorphic, f/1.4, golden hour dusk lighting, hyper-realistic 8k commercial quality.',
              },
            ]
          : [
              {
                sceneNumber: 1,
                durationSec: 4,
                timestampRange: '0:00 - 0:04',
                sceneObjective: 'Immediate visual hook with intimate festive lighting',
                shotType: 'macro_shot',
                cameraMovement: 'slow_push_in',
                subjectDescription: 'Extreme close-up of graceful hands adorned with intricate henna lighting an earthen clay diya with a brass match',
                environmentAndBackground: 'Marigold floral rangoli on teak floor, twinkling fairy lights in background',
                lightingAndAtmosphere: 'Warm golden flame practical lighting',
                motionAndPhysics: 'Slow motion flame ignition',
                onScreenText: 'Where Light Begins',
                voiceoverLine: 'When a single flame lights up the dark...',
                negativePrompt: 'blurry, low quality, deformed hands',
                targetEnginePrompt: 'Cinematic macro shot, slow smooth push in. Extreme close-up of graceful hands with mehendi lighting an earthen diya. 8k commercial quality.',
              },
              {
                sceneNumber: 2,
                durationSec: 4,
                timestampRange: '0:04 - 0:08',
                sceneObjective: 'Hero celebration and family togetherness',
                shotType: 'medium_shot',
                cameraMovement: 'orbital_arc_left',
                subjectDescription: 'Festive family celebrating with glowing sparklers and smiling warmly',
                environmentAndBackground: 'Courtyard with festive brass lanterns and marigold garlands',
                lightingAndAtmosphere: 'Warm glowing festive fairy lights and amber rim lighting',
                motionAndPhysics: 'Sparkler trails and floating golden embers',
                onScreenText: 'Shared Joy',
                voiceoverLine: 'It touches every heart and brightens every home.',
                negativePrompt: 'blurry, distorted faces',
                targetEnginePrompt: 'Orbital arc medium shot. Family in royal silk ethnic wear celebrating with glowing sparklers in a warm courtyard. 8k hyper-realistic commercial.',
              },
            ],
      };
    }

    // 2. TECH / B2B / SAAS / BRAND LAUNCH (LIVE-ACTION, DYNAMIC, HUMAN-LED)
    if (isTechOrLaunch) {
      return {
        title: `${brand} Official Brand Launch`,
        logline: `A high-impact live-action commercial capturing visionary leadership, ambition, and modern momentum for ${brand}.`,
        brandAnalysis: {
          brandName: brand,
          inferredCategory: request.brandCategory || 'B2B Sales & Marketing Tech',
          coreVibe: 'Sleek, Visionary, High-Impact, Energetic, Human-Centered',
          targetAudience: request.targetAudience || 'Modern enterprise leaders, founders, and sales teams',
          emotionalHook: 'Unlocking exponential growth with unstoppable momentum',
          occasionContext: {
            occasionName: 'Official Brand Launch',
            culturalNuances: ['Modern high-growth business culture', 'Executive clarity and speed'],
            visualSymbols: ['Sunlit high-rise architecture', 'Confident human leadership', 'Panoramic city skyline'],
            festiveColorGrade: 'Warm Golden Hour Sunbeams with Crisp Cobalt and Slate Contrast',
          },
        },
        visualStyleGuide: {
          artDirection: 'High-production live-action commercial cinematography, natural golden light, genuine human confidence, cinematic anamorphic depth',
          colorPalette: ['#0284C7 (Cobalt Blue)', '#0F172A (Deep Slate)', '#F59E0B (Golden Sun)', '#FFFFFF (Pure Light)'],
          lightingMood: 'Warm golden hour sun pouring through panoramic windows with natural rim light and soft interior fill',
          lensAndOptics: '35mm anamorphic prime lens, f/1.8 shallow depth of field with organic background bokeh',
          renderAesthetic: 'Shot on ARRI Alexa Mini LF, 8k resolution, photorealistic cinematic grade',
        },
        audioBlueprint: {
          musicDescription: 'Modern electronic and acoustic hybrid score, rhythmic piano motif building into an energetic, uplifting beat drop',
          bpmAndPacing: '114 BPM, confident, inspiring momentum',
          voiceoverScript: [
            { timestamp: '0:00 - 0:04', spokenText: `The way you close deals is about to change. Welcome to ${brand}.`, deliveryTone: 'Confident, authoritative, inspiring commercial voice' },
            { timestamp: '0:04 - 0:08', spokenText: 'Move faster. Scale bigger. Own your growth.', deliveryTone: 'Visionary, impactful crescendo' },
          ],
          sfxCues: [
            { timestamp: '0:01', sfx: 'Subtle ambient skyline breeze and cinematic acoustic riser' },
            { timestamp: '0:05', sfx: 'Clean crystal chime and powerful sub-bass drop' },
          ],
        },
        scenes: isSingleShot
          ? [
              {
                sceneNumber: 1,
                durationSec: 8,
                timestampRange: '0:00 - 0:08',
                sceneObjective: 'Arresting product demo hero shot: Show the product interface in action solving the core problem with fluid clarity',
                shotType: 'macro_shot',
                cameraMovement: 'slow_push_in',
                subjectDescription: `Over-the-shoulder macro camera push-in showing a user's hand operating a sleek tablet displaying the ${brand} sales intelligence dashboard. With a single tap on the screen, scattered lead data instantly organizes into a clean, glowing green automated deal pipeline with live revenue metrics.`,
                environmentAndBackground: 'Modern bright sunlit desk with subtle blurred office background and natural daylight',
                lightingAndAtmosphere: 'Bright natural daylight with crisp screen reflections and soft rim lighting on device edges',
                motionAndPhysics: 'Finger taps tablet screen, UI cards fluidly slide and organize with 60fps smooth animation, continuous slow camera push-in',
                onScreenText: `Automate Your Pipeline | ${brand}`,
                voiceoverLine: `The way you close deals is about to change. Welcome to ${brand}.`,
                negativePrompt: 'blurry, low quality, cartoon, 3d render, plastic skin, deformed hands, abstract wallpaper, neon circuits, glitchy, noisy, low resolution',
                targetEnginePrompt: `Cinematic commercial macro film, smooth continuous slow push in. Over-the-shoulder view of a hand tapping a high-resolution tablet screen displaying the ${brand} clean sales dashboard app, watching animated pipeline progress bars turn green. Bright sunlit modern desk, 35mm macro lens, f/1.8, razor-sharp UI clarity, photorealistic 8k commercial quality.`,
              },
            ]
          : [
              {
                sceneNumber: 1,
                durationSec: 4,
                timestampRange: '0:00 - 0:04',
                sceneObjective: 'The Problem Hook: Establish the painful manual outreach chaos before the product',
                shotType: 'close_up',
                cameraMovement: 'slow_push_in',
                subjectDescription: 'Overwhelmed sales professional sitting at a desk cluttered with messy spreadsheets and sticky notes, staring at the screen in exhaustion',
                environmentAndBackground: 'Modern office desk with realistic daylight',
                lightingAndAtmosphere: 'Natural high-contrast lighting emphasizing friction and chaos',
                motionAndPhysics: 'Hands pushing away paper stacks, smooth continuous slow push-in',
                onScreenText: 'Still Doing Outreach Manually?',
                voiceoverLine: `Tired of wasting hours on manual outreach?`,
                negativePrompt: 'blurry, distorted faces, cartoon, abstract circuits',
                targetEnginePrompt: 'Cinematic commercial film, slow continuous push in. Close up of an overwhelmed professional at a desk with cluttered spreadsheets on screen, expressing frustration. Realistic modern office, 35mm anamorphic lens, f/1.8, photorealistic 8k commercial quality.',
              },
              {
                sceneNumber: 2,
                durationSec: 4,
                timestampRange: '0:04 - 0:08',
                sceneObjective: 'The Product Demo: Show the product solving the problem with clean UI and fluid automation',
                shotType: 'macro_shot',
                cameraMovement: 'slow_pan_right',
                subjectDescription: `Over-the-shoulder macro view of fingers tapping a clean tablet screen displaying the ${brand} interface, instantly converting messy lead lists into a streamlined automated sales pipeline`,
                environmentAndBackground: 'Clean minimalist wooden desk with natural sunlight',
                lightingAndAtmosphere: 'Bright natural daylight with crisp screen reflections and soft rim lighting',
                motionAndPhysics: 'Finger taps the screen, clean UI cards animate smoothly into closed deal stages',
                onScreenText: '1-Click Deal Automation',
                voiceoverLine: `Meet ${brand}: the automated sales pipeline that qualifies and closes deals on autopilot.`,
                negativePrompt: 'blurry, distorted hands, cartoon, fake 3d, abstract wallpaper',
                targetEnginePrompt: `Cinematic commercial macro shot, smooth slider pan. Over-the-shoulder view of a finger tapping a sleek tablet display showing a modern clean sales dashboard app with animated deal progress bars and clear metrics. Bright sunlit desk, 35mm macro lens, f/1.8, razor-sharp UI clarity, photorealistic 8k quality.`,
              },
              {
                sceneNumber: 3,
                durationSec: 7,
                timestampRange: '0:08 - 0:15',
                sceneObjective: 'The Result & CTA: Confident outcome, revenue growth metric, and clear brand lockup',
                shotType: 'medium_shot',
                cameraMovement: 'slow_pedestal_up',
                subjectDescription: `The sales professional smiles confidently while viewing an incoming notification alert for Closed Deal $25,000, turning toward the camera with victorious confidence in a bright modern office`,
                environmentAndBackground: 'Sunlit modern executive office with floor-to-ceiling glass and city view',
                lightingAndAtmosphere: 'Warm golden hour sunlight with uplifting lens flares',
                motionAndPhysics: 'Slow upward pedestal camera movement with natural micro-expressions',
                onScreenText: `${brand} | Scale Your Revenue Today`,
                voiceoverLine: `Scale your revenue faster. Start with ${brand} today.`,
                negativePrompt: 'blurry, low resolution, jittery, distorted faces',
                targetEnginePrompt: `Cinematic commercial film, smooth upward pedestal movement. Confident professional holding smartphone showing green deal success notification, smiling warmly in a bright sunlit office. Golden hour sunbeams, 35mm prime lens, f/1.8, photorealistic 8k commercial quality.`,
              },
            ],
      };
    }

    // 3. PHYSICAL PRODUCT / LIFESTYLE / COMMERCIAL (TACTILE, PRODUCT-FIRST)
    const isPhysicalOrFashion =
      rawLower.includes('shoe') ||
      rawLower.includes('sneaker') ||
      rawLower.includes('coffee') ||
      rawLower.includes('car') ||
      rawLower.includes('watch') ||
      rawLower.includes('dress') ||
      rawLower.includes('perfume') ||
      rawLower.includes('food') ||
      catLower.includes('apparel') ||
      catLower.includes('footwear') ||
      catLower.includes('fashion') ||
      catLower.includes('luxury') ||
      catLower.includes('coffee') ||
      catLower.includes('automotive');

    if (isPhysicalOrFashion) {
      return {
        title: `${brand} Product Film`,
        logline: `A sensory macro commercial showcasing the craftsmanship, textures, and active utility of ${brand}.`,
        brandAnalysis: {
          brandName: brand,
          inferredCategory: request.brandCategory || 'Premium DTC & Lifestyle Goods',
          coreVibe: 'Sensory, Precision-Engineered, Tactile, Modern',
          targetAudience: request.targetAudience || 'Discerning design-conscious consumers',
          emotionalHook: 'Experiencing the sensory perfection of mastercrafted design',
          occasionContext: {
            occasionName: 'Product Spotlight Commercial',
            culturalNuances: ['High-aesthetic sensory storytelling', 'Focus on material quality and tactile motion'],
            visualSymbols: ['Macro textures', 'Fluid dynamic motion', 'Pristine product reflections'],
            festiveColorGrade: 'Warm Cinematic Golden Tone with Rich Shadow Contrast',
          },
        },
        visualStyleGuide: {
          artDirection: 'Macro sensory cinematography with crisp product detail, volumetric natural lighting, and high-speed fluid motion',
          colorPalette: ['#E2B714 (Warm Amber)', '#1E293B (Deep Slate)', '#F8FAFC (Pure Light)', '#0F172A (Midnight)'],
          lightingMood: 'High-contrast studio softbox lighting with crisp rim highlights and natural golden hour fill',
          lensAndOptics: '35mm macro anamorphic prime lens, f/1.8 razor-sharp depth of field',
          renderAesthetic: 'Shot on ARRI Alexa 35mm film stock, 8k resolution, photorealistic commercial grade',
        },
        audioBlueprint: {
          musicDescription: 'Rhythmic acoustic and modern electronic hybrid beat, deep bass pulse building into an uplifting sensory crescendo',
          bpmAndPacing: '110 BPM, punchy and tactile',
          voiceoverScript: [
            { timestamp: '0:00 - 0:04', spokenText: 'True quality is never accidental. It is engineered into every single detail.', deliveryTone: 'Sensory, confident, premium narrator voice' },
            { timestamp: '0:04 - 0:08', spokenText: `Feel the difference. Discover the new standard with ${brand}.`, deliveryTone: 'Warm, decisive call to action' },
          ],
          sfxCues: [
            { timestamp: '0:01', sfx: 'Subtle atmospheric whoosh and tactile texture brush' },
            { timestamp: '0:05', sfx: 'Crisp acoustic impact and deep resonant swell' },
          ],
        },
        scenes: isSingleShot
          ? [
              {
                sceneNumber: 1,
                durationSec: 8,
                timestampRange: '0:00 - 0:08',
                sceneObjective: 'Hero sensory macro showcase demonstrating material beauty, active motion, and product elegance',
                shotType: 'macro_shot',
                cameraMovement: 'slow_push_in',
                subjectDescription: `Extreme close-up macro slider shot of ${brand}'s hero product in motion under dynamic lighting, highlighting tactile material textures, intricate craftsmanship, and smooth natural reflections in glorious 120fps slow motion`,
                environmentAndBackground: 'Minimalist contemporary sunlit showcase surface with soft architectural backdrop',
                lightingAndAtmosphere: 'Golden hour directional side-lighting with soft rim highlights and organic lens flares',
                motionAndPhysics: 'Fluid continuous slow motion camera push-in, subtle natural light shifts',
                onScreenText: `Crafted for Excellence | ${brand}`,
                voiceoverLine: 'True quality is engineered into every detail.',
                negativePrompt: 'blurry, low quality, deformed, cartoon, noisy, low resolution, artifacts, abstract wallpaper',
                targetEnginePrompt: `Cinematic commercial macro film, slow continuous slider push in. Extreme close up of ${brand}'s premium product, showcasing rich physical textures, reflections, and fine artisan details in warm natural golden hour light. 35mm macro prime lens, f/1.8, shallow depth of field, photorealistic 8k commercial quality.`,
              },
            ]
          : [
              {
                sceneNumber: 1,
                durationSec: 4,
                timestampRange: '0:00 - 0:04',
                sceneObjective: 'Hook: Arresting macro texture and unboxing reveal',
                shotType: 'macro_shot',
                cameraMovement: 'slow_push_in',
                subjectDescription: `Extreme close up of ${brand}'s flagship product emerging from luxury packaging, catching golden rim lighting`,
                environmentAndBackground: 'Minimalist contemporary studio surface',
                lightingAndAtmosphere: 'High-contrast dramatic studio lighting with warm rim flares',
                motionAndPhysics: 'Slow smooth camera push-in',
                onScreenText: 'Crafted Without Compromise',
                voiceoverLine: 'True quality is never accidental.',
                negativePrompt: 'blurry, low quality, cartoon',
                targetEnginePrompt: `Cinematic commercial macro shot, slow push in. Extreme close-up of ${brand} product in crisp studio lighting. 35mm macro lens, f/1.8, 8k quality.`,
              },
              {
                sceneNumber: 2,
                durationSec: 4,
                timestampRange: '0:04 - 0:08',
                sceneObjective: 'Product in action: Dynamic real-world utility',
                shotType: 'medium_shot',
                cameraMovement: 'smooth_tracking',
                subjectDescription: `Dynamic active tracking shot showing the product in fluid, effortless real-world performance`,
                environmentAndBackground: 'Sunlit modern architectural setting with natural daylight',
                lightingAndAtmosphere: 'Bright natural sunlight with soft atmospheric depth',
                motionAndPhysics: 'Smooth 60fps tracking motion with natural fluid physics',
                onScreenText: 'Engineered for Performance',
                voiceoverLine: `Engineered into every single detail.`,
                negativePrompt: 'blurry, low quality, jittery',
                targetEnginePrompt: `Cinematic commercial tracking shot. Real-world dynamic demonstration of ${brand} product in bright natural daylight. 35mm lens, f/1.8, photorealistic 8k.`,
              },
              {
                sceneNumber: 3,
                durationSec: 7,
                timestampRange: '0:08 - 0:15',
                sceneObjective: 'Payoff & CTA: Satisfied lifestyle moment and official brand sign-off',
                shotType: 'medium_shot',
                cameraMovement: 'slow_pedestal_up',
                subjectDescription: `Confident user enjoying the flawless experience of ${brand}, turning to camera with a warm smile`,
                environmentAndBackground: 'Golden hour architectural terrace with scenic view',
                lightingAndAtmosphere: 'Warm golden hour sunbeams with uplifting bokeh',
                motionAndPhysics: 'Slow upward pedestal camera movement',
                onScreenText: `${brand} | Experience The New Standard`,
                voiceoverLine: `Feel the difference. Discover the new standard with ${brand}.`,
                negativePrompt: 'blurry, distorted faces, low resolution',
                targetEnginePrompt: `Cinematic commercial film, smooth upward pedestal movement. Confident person smiling in golden hour sunlight holding ${brand} product. 35mm lens, f/1.8, photorealistic 8k quality.`,
              },
            ],
      };
    }

    // 4. GENERIC MODERN BRAND FILM (DEFAULT - LIVE ACTION & CINEMATIC)
    return {
      title: `${brand} Brand Story`,
      logline: `A cinematic commercial celebrating innovation, craftsmanship, and modern elegance for ${brand}.`,
      brandAnalysis: {
        brandName: brand,
        inferredCategory: request.brandCategory || 'Premium Lifestyle & Business',
        coreVibe: 'Cinematic, Inspiring, High-End, Confident',
        targetAudience: request.targetAudience || 'Discerning modern consumers and professionals',
        emotionalHook: 'Elevating everyday standards into extraordinary experiences',
        occasionContext: {
          occasionName: 'Brand Commercial',
          culturalNuances: ['Contemporary luxury and innovation'],
          visualSymbols: ['Clean geometry', 'Natural golden lighting', 'Hero human presence'],
          festiveColorGrade: 'Warm Golden Hour and Deep Slate Contrast',
        },
      },
      visualStyleGuide: {
        artDirection: 'High-end commercial cinematography with natural golden lighting, shallow depth of field, and elegant motion',
        colorPalette: ['#E2B714 (Warm Gold)', '#1E293B (Slate)', '#F1F5F9 (White)', '#0F172A (Deep Navy)'],
        lightingMood: 'Natural golden hour side-lighting with soft cinematic rim highlights',
        lensAndOptics: '35mm anamorphic prime lens, f/1.8 shallow depth of field',
        renderAesthetic: 'Shot on 35mm film stock, 8k resolution, pristine commercial grade',
      },
      audioBlueprint: {
        musicDescription: 'Uplifting acoustic and orchestral hybrid score with inspiring piano and soaring string crescendo',
        bpmAndPacing: '96 BPM, emotional and inspiring build',
        voiceoverScript: [
          { timestamp: '0:00 - 0:04', spokenText: `Every great story begins with a bold vision.`, deliveryTone: 'Warm, inspiring, premium narrator voice' },
          { timestamp: '0:04 - 0:08', spokenText: `Discover what is possible with ${brand}.`, deliveryTone: 'Resonant, confident sign-off' },
        ],
        sfxCues: [
          { timestamp: '0:01', sfx: 'Gentle ambient shimmer and piano chord resonance' },
          { timestamp: '0:05', sfx: 'Uplifting orchestral swell' },
        ],
      },
      scenes: [
        {
          sceneNumber: 1,
          durationSec: 8,
          timestampRange: '0:00 - 0:08',
          sceneObjective: 'Arresting 8-second hero brand reveal showcasing beauty, craftsmanship, and visionary ambition',
          shotType: 'medium_shot',
          cameraMovement: 'slow_push_in',
          subjectDescription: `Smooth slow-motion push-in revealing a confident, stylish person walking into a beautifully designed sunlit modern architectural pavilion, turning toward the camera with an inspiring smile as natural golden hour light illuminates the space.`,
          environmentAndBackground: 'Contemporary sunlit design pavilion with textured limestone, clean lines, and lush green garden visible through floor-to-ceiling glass',
          lightingAndAtmosphere: 'Natural golden hour sunlight casting soft warm shadows and glowing rim highlights with gentle lens flares',
          motionAndPhysics: 'Gentle dust motes dancing in sunbeams, smooth continuous camera forward glide',
          onScreenText: `Elevate Your Story | ${brand}`,
          voiceoverLine: `Discover what is possible with ${brand}.`,
          negativePrompt: 'blurry, low quality, deformed, cartoon, noisy, low resolution, artifacts, abstract wallpaper',
          targetEnginePrompt: `Cinematic commercial video, slow continuous push in. Stylish charismatic person in contemporary minimalist clothing walking in a sunlit architectural villa, turning to camera with a warm confident smile. Natural golden hour sunbeams, glass and stone textures, soft cinematic lens flare. Shot on 35mm anamorphic, f/1.8, 8k commercial quality.`,
        },
      ],
    };
  }
}
