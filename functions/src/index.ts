import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";

admin.initializeApp();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const generateImage = onCall(
  { timeoutSeconds: 120, memory: "512MiB", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const { prompt, type } = request.data as {
      prompt: string;
      type: "influencer" | "ad";
    };

    if (!prompt || typeof prompt !== "string") {
      throw new HttpsError("invalid-argument", "Prompt is required");
    }

    const uid = request.auth.uid;

    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt.slice(0, 4000),
        n: 1,
        size: "1024x1024",
        quality: "hd",
      });

      const tempUrl = response.data[0].url;
      if (!tempUrl) throw new Error("No image URL returned from OpenAI");

      const imageResponse = await fetch(tempUrl);
      if (!imageResponse.ok) throw new Error("Failed to download generated image");
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      const bucket = admin.storage().bucket();
      const fileName = `users/${uid}/${type}s/${uuidv4()}.png`;
      const file = bucket.file(fileName);

      await file.save(imageBuffer, {
        metadata: {
          contentType: "image/png",
          cacheControl: "public, max-age=31536000",
        },
      });

      await file.makePublic();

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

      return { imageUrl: publicUrl };
    } catch (error: unknown) {
      console.error("Image generation error:", error);
      if (error instanceof HttpsError) throw error;
      const message = error instanceof Error ? error.message : "Image generation failed";
      throw new HttpsError("internal", message);
    }
  }
);
