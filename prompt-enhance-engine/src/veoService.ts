export interface VeoGenerateOptions {
  apiKey: string;
  prompt: string;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  durationSeconds?: number;
  modelId?: string;
  referenceImageUrl?: string; // For Image-to-Video conditioning
  onProgress?: (update: { status: string; attempt: number; message: string }) => void;
}

export interface VeoGenerateResult {
  success: boolean;
  videoUrl?: string;
  operationName?: string;
  rawResponse?: any;
  error?: string;
  diagnostics?: string;
}

export interface ImagenGenerateResult {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  error?: string;
}

function getGoogleApiBase(): string {
  if (typeof window !== 'undefined') {
    return '/api/google-ai';
  }
  return 'https://generativelanguage.googleapis.com/v1beta';
}

const CANDIDATE_VEO_MODELS = [
  'veo-3.1-generate-preview',
  'veo-2.0-generate-001',
  'veo-3.1-generate-001',
  'veo-2.0-generate-preview',
];

const CANDIDATE_IMAGEN_MODELS = [
  'imagen-3.0-generate-002',
  'imagen-3.0-fast-generate-001',
  'imagen-3.0-generate-001',
];

export class GoogleVeoService {
  /**
   * Discover available models on the given API key
   */
  static async discoverModels(apiKey: string): Promise<string[]> {
    const apiBase = getGoogleApiBase();
    try {
      const res = await fetch(`${apiBase}/models?key=${apiKey}`);
      if (!res.ok) return [];
      const data = (await res.json()) as any;
      const models = (data.models || [])
        .map((m: any) => m.name.replace(/^models\//, ''))
        .filter((name: string) => name.toLowerCase().includes('veo') || name.toLowerCase().includes('video'));
      return models;
    } catch {
      return [];
    }
  }

  /**
   * Generates a single locked reference image (Imagen 3) to establish visual identity,
   * product details, and color palette before conditioning video scenes.
   */
  static async generateReferenceImage(
    apiKey: string,
    prompt: string,
    aspectRatio: '9:16' | '16:9' | '1:1' = '9:16',
  ): Promise<ImagenGenerateResult> {
    if (!apiKey) {
      return { success: false, error: 'API key is required for Imagen.' };
    }

    const apiBase = getGoogleApiBase();
    let lastError = '';

    for (const model of CANDIDATE_IMAGEN_MODELS) {
      const cleanModel = model.replace(/^models\//, '');
      const url = `${apiBase}/models/${cleanModel}:predict?key=${apiKey}`;
      const body = {
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: aspectRatio === '9:16' ? '9:16' : aspectRatio === '16:9' ? '16:9' : '1:1',
          outputOptions: { mimeType: 'image/jpeg' },
          personGeneration: 'ALLOW_ADULT',
        },
      };

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          const b64 =
            data?.predictions?.[0]?.bytesBase64Encoded ||
            data?.predictions?.[0]?.image?.bytesBase64Encoded;
          if (b64) {
            const dataUrl = `data:image/jpeg;base64,${b64}`;
            return { success: true, imageUrl: dataUrl, imageBase64: b64 };
          }
        } else {
          lastError = `[${cleanModel}]: ${(await res.text()).slice(0, 120)}`;
        }
      } catch (err: any) {
        lastError = err.message || String(err);
      }
    }

    return {
      success: false,
      error: `Imagen reference image generation failed: ${lastError}`,
    };
  }

  /**
   * Starts a long-running video generation task and polls until completion.
   * Supports both pure Text-to-Video and Image-to-Video conditioning.
   */
  static async generateVideo(options: VeoGenerateOptions): Promise<VeoGenerateResult> {
    const { apiKey, prompt, aspectRatio = '9:16', durationSeconds = 8, referenceImageUrl, onProgress } = options;

    if (!apiKey) {
      return { success: false, error: 'Google Veo API Key is required.' };
    }

    onProgress?.({
      status: 'discovering',
      attempt: 0,
      message: 'Checking available Veo models on your API key...',
    });

    const discovered = await this.discoverModels(apiKey);
    const modelsToTry = [
      ...(options.modelId ? [options.modelId] : []),
      ...discovered,
      ...CANDIDATE_VEO_MODELS,
    ].filter((val, idx, self) => self.indexOf(val) === idx);

    let lastError = '';
    const errorsList: string[] = [];

    for (const model of modelsToTry) {
      try {
        onProgress?.({
          status: 'submitting',
          attempt: 1,
          message: referenceImageUrl
            ? `Submitting Image-Conditioned Video to ${model}...`
            : `Submitting Text-to-Video generation to ${model}...`,
        });

        const startResult = await this.startOperation(
          apiKey,
          model,
          prompt,
          aspectRatio,
          durationSeconds,
          referenceImageUrl,
        );

        if (!startResult.operationName) {
          const err = startResult.error || 'Failed to start Veo operation';
          errorsList.push(`${model}: ${err}`);
          lastError = err;
          continue;
        }

        onProgress?.({
          status: 'rendering',
          attempt: 1,
          message: `Veo operation created (${startResult.operationName}). Rendering video...`,
        });

        const finalResult = await this.pollOperation(apiKey, startResult.operationName, onProgress);
        if (finalResult.success) {
          return finalResult;
        } else {
          lastError = finalResult.error || 'Polling failed';
          errorsList.push(`${model} (polling): ${lastError}`);
        }
      } catch (err: any) {
        lastError = err.message || String(err);
        errorsList.push(`${model}: ${lastError}`);
      }
    }

    return {
      success: false,
      error: `All Veo models failed. (${lastError})`,
      diagnostics: errorsList.join('\n'),
    };
  }

  private static async startOperation(
    apiKey: string,
    modelId: string,
    prompt: string,
    aspectRatio: string,
    durationSeconds: number,
    referenceImageUrl?: string,
  ): Promise<{ operationName?: string; error?: string }> {
    const cleanModel = modelId.replace(/^models\//, '');
    const apiBase = getGoogleApiBase();

    // Prepare instance payload (supporting text and image-conditioning)
    const instance: any = { prompt };
    if (referenceImageUrl) {
      if (referenceImageUrl.startsWith('data:')) {
        const base64Data = referenceImageUrl.split(',')[1];
        const mimeType = referenceImageUrl.split(';')[0].replace('data:', '') || 'image/jpeg';
        instance.image = { bytesBase64Encoded: base64Data, mimeType };
      } else if (referenceImageUrl.startsWith('http')) {
        instance.image = { imageUri: referenceImageUrl };
      }
    }

    // 1. Try predictLongRunning
    const longRunningUrl = `${apiBase}/models/${cleanModel}:predictLongRunning?key=${apiKey}`;
    const longRunningBody = {
      instances: [instance],
      parameters: {
        aspectRatio,
        personGeneration: 'allow_all',
        durationSeconds: Math.min(durationSeconds, 8),
      },
    };

    try {
      const res = await fetch(longRunningUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(longRunningBody),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        if (data?.name) return { operationName: data.name };
      } else {
        const errText = await res.text();

        // 2. Try generateVideos endpoint as alternative
        const genVideosUrl = `${apiBase}/models/${cleanModel}:generateVideos?key=${apiKey}`;
        const genVideosBody: any = {
          prompt,
          config: {
            aspectRatio,
            durationSeconds: Math.min(durationSeconds, 8),
            numberOfVideos: 1,
          },
        };
        if (referenceImageUrl) {
          genVideosBody.config.referenceImages = [referenceImageUrl];
        }

        const res2 = await fetch(genVideosUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(genVideosBody),
        });

        if (res2.ok) {
          const data2 = (await res2.json()) as any;
          if (data2?.name) return { operationName: data2.name };
        }

        return { error: `Veo start (${cleanModel}): ${errText.slice(0, 150)}` };
      }
    } catch (e: any) {
      return { error: e.message };
    }

    return { error: `No operation name returned for ${cleanModel}` };
  }

  private static async pollOperation(
    apiKey: string,
    operationName: string,
    onProgress?: (update: { status: string; attempt: number; message: string }) => void,
    maxPolls: number = 60,
    pollIntervalMs: number = 5000,
  ): Promise<VeoGenerateResult> {
    const cleanOp = operationName.replace(/^\/+/, '');
    const apiBase = getGoogleApiBase();

    let pollUrl: string;
    if (cleanOp.startsWith('http://') || cleanOp.startsWith('https://')) {
      pollUrl = `${cleanOp}${cleanOp.includes('?') ? '&' : '?'}key=${apiKey}`;
      if (typeof window !== 'undefined') {
        pollUrl = pollUrl.replace('https://generativelanguage.googleapis.com/v1beta', '/api/google-ai');
      }
    } else {
      pollUrl = `${apiBase}/${cleanOp}?key=${apiKey}`;
    }

    for (let attempt = 1; attempt <= maxPolls; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      onProgress?.({
        status: 'rendering',
        attempt,
        message: `Rendering video (${attempt}/${maxPolls} polls)...`,
      });

      try {
        const res = await fetch(pollUrl, {
          headers: { 'x-goog-api-key': apiKey },
        });

        if (!res.ok) {
          const errText = await res.text();
          onProgress?.({
            status: 'polling_retry',
            attempt,
            message: `Polling status (${res.status}): ${errText.slice(0, 80)}. Retrying...`,
          });
          continue;
        }

        const data = (await res.json()) as any;

        if (data.done) {
          if (data.error) {
            return {
              success: false,
              operationName,
              error: `Veo error: ${JSON.stringify(data.error)}`,
              rawResponse: data,
            };
          }

          // Extract video uri
          const generatedSample = data.response?.generateVideoResponse?.generatedSamples?.[0];
          const directVideo = data.response?.generatedVideos?.[0]?.video;
          const videoUri = generatedSample?.video?.uri || directVideo?.uri || data.response?.videoUri;

          if (videoUri) {
            let playableUrl = videoUri;
            if (videoUri.includes('googleapis.com') && !videoUri.includes('key=')) {
              playableUrl = `${videoUri}${videoUri.includes('?') ? '&' : '?'}key=${apiKey}`;
            }
            if (typeof window !== 'undefined' && playableUrl.includes('https://generativelanguage.googleapis.com/v1beta')) {
              playableUrl = playableUrl.replace('https://generativelanguage.googleapis.com/v1beta', '/api/google-ai');
            }

            return {
              success: true,
              videoUrl: playableUrl,
              operationName,
              rawResponse: data,
            };
          }

          return {
            success: false,
            operationName,
            error: 'Veo operation completed but video URI was empty or filtered.',
            rawResponse: data,
          };
        }
      } catch (err: any) {
        onProgress?.({
          status: 'network_retry',
          attempt,
          message: `Checking status: ${err.message}. Retrying...`,
        });
      }
    }

    return {
      success: false,
      operationName,
      error: `Veo video rendering timed out after ${maxPolls * (pollIntervalMs / 1000)} seconds.`,
    };
  }
}
