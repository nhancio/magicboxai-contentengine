import { VideoScene, AspectRatio, ModelSpecificPayload } from './types.js';

export class VideoPromptFormatters {
  /**
   * Formats for Runway Gen-3 Alpha / Turbo
   * Syntax: [Camera Motion]: [Subject & Action], [Environment], [Lighting/Mood], [Lens/Aesthetics]
   */
  static formatRunwayGen3(scene: VideoScene, aspectRatio: AspectRatio): ModelSpecificPayload {
    const cameraKey = this.mapCameraToRunwayTag(scene.cameraMovement);
    const prompt = `${cameraKey}: ${scene.subjectDescription}. ${scene.environmentAndBackground}. ${scene.lightingAndAtmosphere}. ${scene.motionAndPhysics}. Shot on 35mm anamorphic, hyper-realistic 8k cinematic ad.`;

    return {
      prompt,
      negativePrompt: scene.negativePrompt || 'blurry, low quality, morphing, distorted, cartoon, oversaturated, plastic skin',
      cameraSettings: cameraKey,
      aspectRatio,
      durationSeconds: Math.min(scene.durationSec, 10),
    };
  }

  /**
   * Formats for Google Veo 2 / 3.1
   * Syntax: Natural cinematic prose with explicit camera, lighting, and volumetric atmosphere cues
   */
  static formatGoogleVeo(scene: VideoScene, aspectRatio: AspectRatio): ModelSpecificPayload {
    const prompt = `Cinematic commercial video, ${scene.shotType.replace(/_/g, ' ')}. ${scene.subjectDescription}. ${scene.motionAndPhysics}. ${scene.environmentAndBackground}. Lighting: ${scene.lightingAndAtmosphere}. Camera movement: ${scene.cameraMovement.replace(/_/g, ' ')}. Shot on ARRI Alexa Mini LF, shallow depth of field, photorealistic 8k, warm color grade.`;

    return {
      prompt,
      negativePrompt: scene.negativePrompt,
      aspectRatio,
      durationSeconds: Math.min(scene.durationSec, 8),
    };
  }

  /**
   * Formats for Kling AI 1.5 / 2.0
   * Syntax: Action and subject realism first, rich physical fluid dynamics, negative prompt
   */
  static formatKling(scene: VideoScene, aspectRatio: AspectRatio): ModelSpecificPayload {
    const prompt = `${scene.shotType.replace(/_/g, ' ')} of ${scene.subjectDescription}. ${scene.motionAndPhysics}. Ambient background: ${scene.environmentAndBackground}. ${scene.lightingAndAtmosphere}. Smooth fluid motion, cinematic color grading, masterwork, 4k.`;

    return {
      prompt,
      negativePrompt: `${scene.negativePrompt}, deformed body, jerky motion, low resolution, watermark, static image`,
      aspectRatio,
      durationSeconds: Math.min(scene.durationSec, 10),
    };
  }

  /**
   * Formats for Luma Dream Machine
   * Syntax: Dynamic movement vector, clean subject action, atmospheric tags
   */
  static formatLuma(scene: VideoScene, aspectRatio: AspectRatio): ModelSpecificPayload {
    const prompt = `${scene.cameraMovement.replace(/_/g, ' ')}, ${scene.subjectDescription}, ${scene.environmentAndBackground}, ${scene.lightingAndAtmosphere}, cinematic photorealistic 8k.`;

    return {
      prompt,
      aspectRatio,
      durationSeconds: Math.min(scene.durationSec, 5),
    };
  }

  /**
   * Formats for OpenAI Sora
   */
  static formatSora(scene: VideoScene, aspectRatio: AspectRatio): ModelSpecificPayload {
    const prompt = `A high-end cinematic commercial video. ${scene.shotType.replace(/_/g, ' ')} with ${scene.cameraMovement.replace(/_/g, ' ')}. ${scene.subjectDescription}. ${scene.motionAndPhysics}. ${scene.environmentAndBackground}. Atmosphere: ${scene.lightingAndAtmosphere}. High dynamic range, photorealistic textures, fine film grain.`;

    return {
      prompt,
      aspectRatio,
      durationSeconds: scene.durationSec,
    };
  }

  private static mapCameraToRunwayTag(camera: string): string {
    switch (camera) {
      case 'slow_push_in':
        return 'Slow continuous push in';
      case 'slow_pull_back':
        return 'Slow pull back';
      case 'orbital_arc_left':
        return 'Orbital pan left around subject';
      case 'orbital_arc_right':
        return 'Orbital pan right around subject';
      case 'dolly_forward':
        return 'Low dolly forward';
      case 'crane_pedestal_up':
        return 'Pedestal up crane shot';
      case 'speed_ramp_fpv':
        return 'Speed ramp smooth forward track';
      case 'smooth_tracking':
        return 'Smooth horizontal tracking shot';
      default:
        return 'Cinematic camera movement';
    }
  }
}
