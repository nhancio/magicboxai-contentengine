import type {
  GenerateVideosOperation,
  GenerateVideosParameters,
  GoogleGenAI,
  Image,
} from "@google/genai";

export const DEFAULT_VEO_MODEL = "veo-3.1-generate-001";
export const DEFAULT_VEO_POLL_INTERVAL_MS = 15_000;
export const DEFAULT_VEO_MAX_POLL_ATTEMPTS = 30;

export type VeoDurationSeconds = 4 | 6 | 8;
export type VeoAspectRatio = "9:16" | "16:9";

type VeoClient = Pick<GoogleGenAI, "models" | "operations">;

export interface VeoSourceImage {
  gcsUri: string;
  mimeType: string;
}

export interface VeoPollingOptions {
  intervalMs?: number;
  maxAttempts?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface GenerateVeoVideoInput {
  ai: VeoClient;
  prompt: string;
  outputGcsUri: string;
  durationSeconds: VeoDurationSeconds;
  aspectRatio?: VeoAspectRatio;
  model?: string;
  sourceImage?: VeoSourceImage;
  polling?: VeoPollingOptions;
}

export interface GeneratedVeoVideo {
  operationName: string;
  gcsUri: string;
  bucketName: string;
  storagePath: string;
  mimeType?: string;
  pollAttempts: number;
}

export interface GcsLocation {
  bucketName: string;
  storagePath: string;
}

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/** Parse a Cloud Storage URI into the bucket and object path it identifies. */
export function parseGcsUri(uri: string): GcsLocation {
  const match = /^gs:\/\/([^/\s]+)\/(.+)$/.exec(uri.trim());
  if (!match) {
    throw new Error(`Invalid Cloud Storage URI: ${uri}`);
  }

  const storagePath = match[2].replace(/^\/+/, "");
  if (!storagePath) {
    throw new Error(`Cloud Storage URI must include an object path: ${uri}`);
  }

  return { bucketName: match[1], storagePath };
}

/** Veo treats outputGcsUri as a directory, not an exact output filename. */
export function normalizeGcsDirectoryUri(uri: string): string {
  const { bucketName, storagePath } = parseGcsUri(uri);
  const directory = storagePath.replace(/\/+$/, "");
  if (!directory) {
    throw new Error("Veo outputGcsUri must identify a directory inside a bucket");
  }
  return `gs://${bucketName}/${directory}/`;
}

function assertGeneratedUriIsWithinPrefix(generatedUri: string, outputGcsUri: string): GcsLocation {
  const generated = parseGcsUri(generatedUri);
  const expected = parseGcsUri(outputGcsUri);

  if (
    generated.bucketName !== expected.bucketName ||
    !generated.storagePath.startsWith(expected.storagePath) ||
    generated.storagePath === expected.storagePath
  ) {
    throw new Error(
      `Veo returned an output outside the requested Cloud Storage directory: ${generatedUri}`
    );
  }

  return generated;
}

function validatePollingOptions(options: VeoPollingOptions | undefined): {
  intervalMs: number;
  maxAttempts: number;
  sleep: (milliseconds: number) => Promise<void>;
} {
  const intervalMs = options?.intervalMs ?? DEFAULT_VEO_POLL_INTERVAL_MS;
  const maxAttempts = options?.maxAttempts ?? DEFAULT_VEO_MAX_POLL_ATTEMPTS;

  if (!Number.isFinite(intervalMs) || intervalMs < 0) {
    throw new Error("Veo polling intervalMs must be a non-negative finite number");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("Veo polling maxAttempts must be a positive integer");
  }

  return { intervalMs, maxAttempts, sleep: options?.sleep ?? defaultSleep };
}

function formatOperationError(error: Record<string, unknown>): string {
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown Veo operation error";
  }
}

function buildMissingVideoError(operation: GenerateVideosOperation): Error {
  const reasons = operation.response?.raiMediaFilteredReasons?.filter(Boolean) ?? [];
  const filteredCount = operation.response?.raiMediaFilteredCount ?? 0;
  if (filteredCount > 0 || reasons.length > 0) {
    const reasonText = reasons.length ? `: ${reasons.join("; ")}` : "";
    return new Error(`Veo did not return a video because it was safety-filtered${reasonText}`);
  }
  return new Error("Veo operation completed without a generated video URI");
}

/**
 * Submit and poll one Veo generation using the typed @google/genai contract.
 *
 * This deliberately remains a bounded, synchronous helper and therefore does
 * not provide crash recovery. Durable orchestration must split submission from
 * polling and persist operation.name immediately; that is outside this patch.
 */
export async function generateVeoVideo(input: GenerateVeoVideoInput): Promise<GeneratedVeoVideo> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Veo prompt must not be empty");

  const outputGcsUri = normalizeGcsDirectoryUri(input.outputGcsUri);
  const polling = validatePollingOptions(input.polling);

  let sourceImage: Image | undefined;
  if (input.sourceImage) {
    parseGcsUri(input.sourceImage.gcsUri);
    if (!/^image\/[a-z0-9.+-]+$/i.test(input.sourceImage.mimeType)) {
      throw new Error(`Invalid Veo source image MIME type: ${input.sourceImage.mimeType}`);
    }
    sourceImage = {
      gcsUri: input.sourceImage.gcsUri,
      mimeType: input.sourceImage.mimeType,
    };
  }

  const request: GenerateVideosParameters = {
    model: input.model ?? DEFAULT_VEO_MODEL,
    prompt,
    ...(sourceImage ? { source: { image: sourceImage } } : {}),
    config: {
      numberOfVideos: 1,
      aspectRatio: input.aspectRatio ?? "9:16",
      durationSeconds: input.durationSeconds,
      outputGcsUri,
    },
  };

  let operation = await input.ai.models.generateVideos(request);
  const operationName = operation.name;
  if (!operationName) throw new Error("Veo did not return an operation name");

  let pollAttempts = 0;
  while (!operation.done) {
    if (pollAttempts >= polling.maxAttempts) {
      throw new Error(
        `Veo operation ${operationName} did not complete after ${polling.maxAttempts} polls`
      );
    }

    await polling.sleep(polling.intervalMs);
    operation = await input.ai.operations.getVideosOperation({ operation });
    pollAttempts += 1;
  }

  if (operation.error) {
    throw new Error(`Veo operation ${operationName} failed: ${formatOperationError(operation.error)}`);
  }

  const video = operation.response?.generatedVideos?.find((item) => item.video?.uri)?.video;
  if (!video?.uri) throw buildMissingVideoError(operation);
  if (video.mimeType && !video.mimeType.startsWith("video/")) {
    throw new Error(`Veo returned an unexpected output MIME type: ${video.mimeType}`);
  }

  const generated = assertGeneratedUriIsWithinPrefix(video.uri, outputGcsUri);
  return {
    operationName,
    gcsUri: video.uri,
    bucketName: generated.bucketName,
    storagePath: generated.storagePath,
    mimeType: video.mimeType,
    pollAttempts,
  };
}
