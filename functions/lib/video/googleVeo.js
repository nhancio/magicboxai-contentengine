"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_VEO_MAX_POLL_ATTEMPTS = exports.DEFAULT_VEO_POLL_INTERVAL_MS = exports.DEFAULT_VEO_MODEL = void 0;
exports.parseGcsUri = parseGcsUri;
exports.normalizeGcsDirectoryUri = normalizeGcsDirectoryUri;
exports.generateVeoVideo = generateVeoVideo;
exports.DEFAULT_VEO_MODEL = "veo-3.1-generate-001";
exports.DEFAULT_VEO_POLL_INTERVAL_MS = 15000;
exports.DEFAULT_VEO_MAX_POLL_ATTEMPTS = 30;
const defaultSleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
/** Parse a Cloud Storage URI into the bucket and object path it identifies. */
function parseGcsUri(uri) {
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
function normalizeGcsDirectoryUri(uri) {
    const { bucketName, storagePath } = parseGcsUri(uri);
    const directory = storagePath.replace(/\/+$/, "");
    if (!directory) {
        throw new Error("Veo outputGcsUri must identify a directory inside a bucket");
    }
    return `gs://${bucketName}/${directory}/`;
}
function assertGeneratedUriIsWithinPrefix(generatedUri, outputGcsUri) {
    const generated = parseGcsUri(generatedUri);
    const expected = parseGcsUri(outputGcsUri);
    if (generated.bucketName !== expected.bucketName ||
        !generated.storagePath.startsWith(expected.storagePath) ||
        generated.storagePath === expected.storagePath) {
        throw new Error(`Veo returned an output outside the requested Cloud Storage directory: ${generatedUri}`);
    }
    return generated;
}
function validatePollingOptions(options) {
    var _a, _b, _c;
    const intervalMs = (_a = options === null || options === void 0 ? void 0 : options.intervalMs) !== null && _a !== void 0 ? _a : exports.DEFAULT_VEO_POLL_INTERVAL_MS;
    const maxAttempts = (_b = options === null || options === void 0 ? void 0 : options.maxAttempts) !== null && _b !== void 0 ? _b : exports.DEFAULT_VEO_MAX_POLL_ATTEMPTS;
    if (!Number.isFinite(intervalMs) || intervalMs < 0) {
        throw new Error("Veo polling intervalMs must be a non-negative finite number");
    }
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
        throw new Error("Veo polling maxAttempts must be a positive integer");
    }
    return { intervalMs, maxAttempts, sleep: (_c = options === null || options === void 0 ? void 0 : options.sleep) !== null && _c !== void 0 ? _c : defaultSleep };
}
function formatOperationError(error) {
    try {
        return JSON.stringify(error);
    }
    catch (_a) {
        return "Unknown Veo operation error";
    }
}
function buildMissingVideoError(operation) {
    var _a, _b, _c, _d, _e;
    const reasons = (_c = (_b = (_a = operation.response) === null || _a === void 0 ? void 0 : _a.raiMediaFilteredReasons) === null || _b === void 0 ? void 0 : _b.filter(Boolean)) !== null && _c !== void 0 ? _c : [];
    const filteredCount = (_e = (_d = operation.response) === null || _d === void 0 ? void 0 : _d.raiMediaFilteredCount) !== null && _e !== void 0 ? _e : 0;
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
async function generateVeoVideo(input) {
    var _a, _b, _c, _d, _e;
    const prompt = input.prompt.trim();
    if (!prompt)
        throw new Error("Veo prompt must not be empty");
    const outputGcsUri = normalizeGcsDirectoryUri(input.outputGcsUri);
    const polling = validatePollingOptions(input.polling);
    let sourceImage;
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
    const request = Object.assign(Object.assign({ model: (_a = input.model) !== null && _a !== void 0 ? _a : exports.DEFAULT_VEO_MODEL, prompt }, (sourceImage ? { source: { image: sourceImage } } : {})), { config: {
            numberOfVideos: 1,
            aspectRatio: (_b = input.aspectRatio) !== null && _b !== void 0 ? _b : "9:16",
            durationSeconds: input.durationSeconds,
            outputGcsUri,
        } });
    let operation = await input.ai.models.generateVideos(request);
    const operationName = operation.name;
    if (!operationName)
        throw new Error("Veo did not return an operation name");
    let pollAttempts = 0;
    while (!operation.done) {
        if (pollAttempts >= polling.maxAttempts) {
            throw new Error(`Veo operation ${operationName} did not complete after ${polling.maxAttempts} polls`);
        }
        await polling.sleep(polling.intervalMs);
        operation = await input.ai.operations.getVideosOperation({ operation });
        pollAttempts += 1;
    }
    if (operation.error) {
        throw new Error(`Veo operation ${operationName} failed: ${formatOperationError(operation.error)}`);
    }
    const video = (_e = (_d = (_c = operation.response) === null || _c === void 0 ? void 0 : _c.generatedVideos) === null || _d === void 0 ? void 0 : _d.find((item) => { var _a; return (_a = item.video) === null || _a === void 0 ? void 0 : _a.uri; })) === null || _e === void 0 ? void 0 : _e.video;
    if (!(video === null || video === void 0 ? void 0 : video.uri))
        throw buildMissingVideoError(operation);
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
//# sourceMappingURL=googleVeo.js.map