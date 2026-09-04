/**
 * Voice + video generation legs.
 *
 * - TTS (`synthesizeSpeech`/`pcmToWav`) voices the adapted script with the
 *   same Google key used elsewhere — no separate TTS vendor.
 * - Lip-sync (`submitLipSync`/`pollLipSyncStatus`) re-syncs the ORIGINAL
 *   reel's speaker to that new audio via Fal.ai. Needs FAL_API_KEY; without
 *   it the pipeline dubs the voiceover over the untouched footage instead.
 */
export { synthesizeSpeech, pcmToWav } from "../../packages/backend/convex/lib/tts";
export { submitLipSync, pollLipSyncStatus } from "../../packages/backend/convex/lib/fal";
