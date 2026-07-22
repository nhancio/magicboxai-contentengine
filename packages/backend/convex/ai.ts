import { action } from "./_generated/server";
import { v } from "convex/values";
import { GoogleGenAI } from "@google/genai";
import { MODELS, requireGeminiKey } from "./lib/models";
import { requireUid } from "./lib/auth";

export const generateScript = action({
  args: {
    prompt: v.string(),
    systemInstruction: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUid(ctx);
    const apiKey = requireGeminiKey();

    const ai = new GoogleGenAI({ apiKey });

    try {
      const response = await ai.models.generateContent({
        // Was `gemini-2.0-flash-001` — removed by Google, 404s on every call.
        model: MODELS.text,
        contents: args.prompt,
        config: {
          systemInstruction: args.systemInstruction,
        },
      });

      return { text: response.text };
    } catch (error: any) {
      console.error("[Convex:AI] Gemini API failed:", error);
      throw new Error(`Failed to generate script: ${error.message}`);
    }
  },
});
