import { GEMINI_API_BASE, requireGeminiKey } from "./models";

/**
 * Gemini text-to-speech. Stands in for ElevenLabs so voiceover works with the
 * Google key every deployment already has — no separate TTS account needed.
 * Raw fetch against the REST API, same convention as lib/gemini.ts (native
 * fetch, no "use node", no SDK).
 */
export async function synthesizeSpeech(
  script: string,
  voiceName = "Kore",
): Promise<{ pcmBase64: string; sampleRateHz: number }> {
  const key = requireGeminiKey();
  const res = await fetch(`${GEMINI_API_BASE}/models/gemini-2.5-flash-preview-tts:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: script }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`[tts] ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const inline = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inline?.data) {
    throw new Error("[tts] no audio in response (check responseModalities)");
  }
  // Gemini TTS returns raw 16-bit PCM mono at 24kHz regardless of the declared mimeType.
  return { pcmBase64: inline.data, sampleRateHz: 24000 };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Wraps raw 16-bit PCM mono samples in a WAV header so it plays as a normal audio file. */
export function pcmToWav(pcmBase64: string, sampleRateHz: number): Uint8Array {
  const pcm = base64ToBytes(pcmBase64);
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRateHz * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRateHz, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, pcm.length, true);

  const wav = new Uint8Array(44 + pcm.length);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcm, 44);
  return wav;
}
