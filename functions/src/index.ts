import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import { v4 as uuidv4 } from "uuid";
import { createHmac } from "node:crypto";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Marketing automation suite
export {
  syncSocialAccounts,
  createAutomation,
  updateAutomation,
  runAutomationNow,
  generatePreviewContent,
  approvePost,
  retryPost,
  cancelPost,
  regeneratePostContent,
  getQuota,
} from "./callables";
export { automationTick, generationTick, postingTick } from "./scheduler";

type SubscriptionPlan = "free" | "starter" | "pro";

type SubscriptionState = {
  plan: SubscriptionPlan;
  videosUsed: number;
  videosLimit: number;
  status?: "inactive" | "active" | "past_due" | "cancelled";
  currentPeriodEnd?: admin.firestore.Timestamp;
};

const SUBSCRIPTION_PLANS: Record<
  Exclude<SubscriptionPlan, "free">,
  { amount: number; currency: "INR"; videoLimit: number; periodDays: number }
> = {
  starter: { amount: 100000, currency: "INR", videoLimit: 50, periodDays: 30 },
  pro: { amount: 500000, currency: "INR", videoLimit: 1000, periodDays: 30 },
};

const VEO_SYSTEM_PROMPTS = {
  avatarPreview: `You are MagicBox AI's avatar preview director for Veo.

Your job is to generate a short, realistic talking-head preview from a single reference image.

Rules:
- Preserve the person's identity from the reference image.
- Keep the framing vertical and social-first.
- Use subtle, believable facial motion and lip sync.
- Use a clean background and flattering soft light.
- Do not introduce extra props, extra people, or unrelated scene changes.
- The result should feel like a creator introducing themselves to camera.`,

  ugcProductVideo: `You are MagicBox AI's UGC product video director for Veo.

You generate a single-shot or lightly edited vertical short video using:
- one reference character image
- one product image context
- one spoken script

Creative objective:
- produce a convincing avatar-led UGC ad where the character looks like the reference person
- the character is clearly presenting the product
- the delivery feels native to TikTok / Reels / Shorts rather than cinematic brand film

Hard rules:
- Preserve identity from the supplied reference image.
- The character must face camera and speak the supplied script.
- The product must appear clearly and naturally in the scene.
- Show the character holding or presenting the product for an obvious portion of the clip.
- Keep body motion, hand motion, and lip sync realistic and restrained.
- Avoid surreal transformations, extra limbs, warped hands, floating props, or product swaps.
- Do not change the product category, color, or core appearance unless explicitly described in the product context.
- No subtitles burned into the video unless requested elsewhere.
- No cutaways that lose the character-product relationship for most of the clip.

Visual direction:
- mobile-first composition
- clean creator-style lighting
- natural room or studio setting
- realistic lens and skin texture
- strong product visibility without looking like a catalog shoot

Performance direction:
- conversational, persuasive, creator-style delivery
- gestures should support the spoken lines
- when the script mentions benefits, the product should be emphasized visually
- when possible, align hand positioning and eyeline with the product mention`,
} as const;

type VeoUGCPromptInput = {
  avatarName?: string;
  templateId?: string;
  templateName: string;
  productName: string;
  productDescription?: string;
  productImageAnalysis?: string;
  script: string;
  characterSummary?: string;
};

const VEO_TEMPLATE_DIRECTIONS: Record<
  string,
  {
    sceneStyle: string;
    pacing: string;
    productHandling: string;
    cameraBehavior: string;
  }
> = {
  "template-product-explanation": {
    sceneStyle: "Creator demo setup with direct-to-camera explanation and clean product visibility.",
    pacing: "Steady, persuasive, informative pacing with no rushed gestures.",
    productHandling: "Hold the product near chest or shoulder level and angle it toward camera when key benefits are mentioned.",
    cameraBehavior: "Mostly medium framing with slight push-in energy, keeping the product and face visible together.",
  },
  "template-problem-solution": {
    sceneStyle: "Start with mild frustration or concern, then pivot into relief once the product is introduced.",
    pacing: "Hook fast, then settle into a clear before/after explanation.",
    productHandling: "Bring the product into frame at the moment of solution reveal and keep it visible during benefit explanation.",
    cameraBehavior: "Direct talking-head framing with one clear emphasis beat during the solution moment.",
  },
  "template-unboxing": {
    sceneStyle: "First-impression creator energy with tactile curiosity and natural excitement.",
    pacing: "Slightly quicker early beats, then slower when showing product details.",
    productHandling: "Show the product with both hands at first, then hold it naturally while reacting and speaking.",
    cameraBehavior: "Hands and product should stay in frame; avoid wide shots that hide the product reveal.",
  },
  "template-3-reasons": {
    sceneStyle: "List-style creator breakdown with clear structure and confident delivery.",
    pacing: "Distinct beat changes for each reason, with a clean emphasis at each transition.",
    productHandling: "Reposition or gesture to the product as each reason is discussed.",
    cameraBehavior: "Stable medium shot that keeps presenter and product consistently visible.",
  },
  "template-storytime": {
    sceneStyle: "Personal, anecdotal storytelling that feels intimate and authentic.",
    pacing: "Start conversational, build emotional momentum, then land on the product reveal.",
    productHandling: "Product appears naturally as the turning point in the story, not from the first frame.",
    cameraBehavior: "Direct vlog-like framing with warm, personal eye contact.",
  },
  "template-testimonial": {
    sceneStyle: "Satisfied customer energy with credible, low-hype confidence.",
    pacing: "Measured, believable pacing focused on trust and lived experience.",
    productHandling: "Keep the product visible as supporting proof while speaking about the result.",
    cameraBehavior: "Simple testimonial framing with minimal camera movement.",
  },
  "template-comparison": {
    sceneStyle: "Analytical creator review with clear winner-energy by the end.",
    pacing: "Structured comparison rhythm with clear verbal contrast points.",
    productHandling: "Keep the featured product dominant in frame and gesture as if contrasting it against alternatives.",
    cameraBehavior: "Front-facing comparison style shot with emphasis on product close presentation.",
  },
};

const getTemplateDirection = (templateId: string | undefined, templateName: string) => {
  const byId = templateId ? VEO_TEMPLATE_DIRECTIONS[templateId] : undefined;
  if (byId) return byId;

  return {
    sceneStyle: `${templateName} creator-style product presentation.`,
    pacing: "Natural short-form pacing with clear spoken beats.",
    productHandling: "Keep the product visible and naturally presented while speaking.",
    cameraBehavior: "Vertical social framing that preserves face and product visibility together.",
  };
};

const buildAvatarPreviewPrompt = (input: {
  avatarName: string;
  personality: string;
}) =>
  [
    VEO_SYSTEM_PROMPTS.avatarPreview,
    "",
    "Character:",
    `- Avatar name: ${input.avatarName}`,
    `- Delivery style: ${input.personality || "warm, natural, creator-like"}`,
    "",
    "Scene brief:",
    `- A realistic talking-head preview where the character says: "Hello, this is your avatar. I am ${input.avatarName}."`,
    "- Look directly into camera.",
    "- Use subtle head motion, natural blinking, and a calm introduction.",
    "- Keep the result short, clean, and believable.",
  ].join("\n");

const buildUGCVideoPrompt = (input: VeoUGCPromptInput) =>
  (() => {
    const direction = getTemplateDirection(input.templateId, input.templateName);

    return [
    VEO_SYSTEM_PROMPTS.ugcProductVideo,
    "",
    "Character input:",
    `- Avatar name: ${input.avatarName || "Creator"}`,
    `- Character summary: ${input.characterSummary || "Friendly, believable UGC creator"}`,
    "",
    "Template input:",
    `- Template id: ${input.templateId || "Not provided"}`,
    `- Template style: ${input.templateName}`,
    `- Scene direction: ${direction.sceneStyle}`,
    `- Pacing direction: ${direction.pacing}`,
    `- Product handling direction: ${direction.productHandling}`,
    `- Camera direction: ${direction.cameraBehavior}`,
    "",
    "Product input:",
    `- Product name: ${input.productName}`,
    `- Product description: ${input.productDescription || "Not provided"}`,
    `- Product image context: ${input.productImageAnalysis || "Use the uploaded product image as the source of truth for appearance and form factor."}`,
    "",
    "Performance requirements:",
    "- The character should visibly present the product while speaking.",
    "- Product-in-hand interaction should look natural, stable, and intentional.",
    "- Match gestures to the spoken claims and product mentions.",
    "",
    "Spoken script:",
    input.script,
    ].join("\n");
  })();

const getAI = () => {
  const projectId = process.env.GCLOUD_PROJECT || admin.app().options.projectId;
  return new GoogleGenAI({
    vertexai: true,
    project: projectId,
    location: "us-central1",
  });
};

const requireAuth = <T>(request: CallableRequest<T>): string => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  return request.auth.uid;
};

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new HttpsError("failed-precondition", `${key} is not configured`);
  }
  return value;
};

const getBucket = () => admin.storage().bucket();

const getPublicUrl = (filePath: string) =>
  `https://storage.googleapis.com/${getBucket().name}/${filePath}`;

const getSubscription = async (uid: string): Promise<SubscriptionState> => {
  const snap = await db.collection("subscriptions").doc(uid).get();
  if (!snap.exists) {
    return { plan: "free", videosUsed: 0, videosLimit: 0, status: "inactive" };
  }

  const data = snap.data() as Partial<SubscriptionState> | undefined;
  return {
    plan: data?.plan ?? "free",
    videosUsed: data?.videosUsed ?? 0,
    videosLimit: data?.videosLimit ?? 0,
    status: data?.status ?? (data?.plan && data.plan !== "free" ? "active" : "inactive"),
    currentPeriodEnd: data?.currentPeriodEnd,
  };
};

const assertCanGenerateVideo = (subscription: SubscriptionState) => {
  if (subscription.plan === "free") {
    throw new HttpsError("permission-denied", "A paid subscription is required to generate videos");
  }

  if (subscription.status && subscription.status !== "active") {
    throw new HttpsError("permission-denied", "Subscription is not active");
  }

  if (subscription.videosUsed >= subscription.videosLimit) {
    throw new HttpsError("resource-exhausted", "Monthly video generation limit reached");
  }
};

const stringifyError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unexpected error";
  }
};

const formatAIServiceError = (rawMessage: string): string => {
  const message = rawMessage.trim();
  const projectId = process.env.GCLOUD_PROJECT || admin.app().options.projectId || "your-project-id";

  if (
    /SERVICE_DISABLED/i.test(message) ||
    /aiplatform\.googleapis\.com/i.test(message) ||
    /Vertex AI API has not been used/i.test(message)
  ) {
    return [
      `Vertex AI API is disabled for Firebase project ${projectId}.`,
      `Enable aiplatform.googleapis.com for ${projectId}, wait a few minutes for propagation, then retry avatar creation.`,
      `Console: https://console.developers.google.com/apis/api/aiplatform.googleapis.com/overview?project=${projectId}`,
    ].join(" ");
  }

  return message || "Unexpected error";
};

const parseError = (error: unknown) => formatAIServiceError(stringifyError(error));

const fetchJson = async <T>(input: string, init: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
};

const getRazorpayAuthHeader = () => {
  const keyId = requireEnv("RAZORPAY_KEY_ID");
  const keySecret = requireEnv("RAZORPAY_KEY_SECRET");
  return {
    keyId,
    keySecret,
    authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
  };
};

const updateVideoDocument = async (
  uid: string,
  videoId: string | undefined,
  data: Record<string, unknown>
) => {
  if (!videoId) return;

  const ref = db.collection("videos").doc(videoId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Video job not found");
  }

  if (snap.data()?.userId !== uid) {
    throw new HttpsError("permission-denied", "Video job does not belong to the current user");
  }

  await ref.set(data, { merge: true });
};

const generateVideoFromImage = async ({
  prompt,
  inputImagePath,
  outputFilePath,
  durationSeconds,
}: {
  prompt: string;
  inputImagePath: string;
  outputFilePath: string;
  durationSeconds: number;
}) => {
  console.log("[generateVideoFromImage] STARTING with params:", { inputImagePath, outputFilePath, durationSeconds });
  console.log("[generateVideoFromImage] PROMPT:", prompt);
  
  const ai = getAI();
  const bucket = getBucket();
  const inputGcsUri = `gs://${bucket.name}/${inputImagePath}`;
  const outputGcsUri = `gs://${bucket.name}/${outputFilePath}`;
  
  console.log("[generateVideoFromImage] URIs:", { inputGcsUri, outputGcsUri });

  console.log("[generateVideoFromImage] Calling ai.models.generateVideos...");
  let operation;
  try {
    operation = await ai.models.generateVideos({
      model: "veo-3.1-generate-001",
      prompt,
      source: {
        image: {
          gcsUri: inputGcsUri,
        },
      } as never,
      config: {
        aspectRatio: "9:16",
        durationSeconds,
        outputUri: outputGcsUri,
      } as never,
    });
  } catch (genError) {
    console.error("[generateVideoFromImage] ai.models.generateVideos FAILED:", genError);
    throw genError;
  }
  
  console.log("[generateVideoFromImage] operation result:", JSON.stringify(operation));

  if (!operation?.name) {
    console.error("[generateVideoFromImage] No operation name returned");
    throw new Error("No operation name returned from Veo");
  }

  let result = operation as { done?: boolean; error?: unknown; name: string };
  let attempts = 0;

  console.log("[generateVideoFromImage] Starting poll loop for operation:", operation.name);
  while (!result.done && attempts < 30) {
    attempts += 1;
    console.log(`[generateVideoFromImage] Polling attempt ${attempts}...`);
    await new Promise((resolve) => setTimeout(resolve, 15000));
    try {
      result = (await ai.operations.get({
        operationId: operation.name,
      } as never)) as typeof result;
      console.log(`[generateVideoFromImage] Polling result (attempt ${attempts}):`, JSON.stringify(result));
    } catch (pollError) {
      console.error(`[generateVideoFromImage] Error during polling (attempt ${attempts}):`, pollError);
      throw pollError;
    }
  }

  if (!result.done) {
    console.error("[generateVideoFromImage] Generation timed out after 30 attempts");
    throw new Error("Video generation timed out");
  }

  if (result.error) {
    console.error("[generateVideoFromImage] Operation finished with error:", result.error);
    throw new Error(JSON.stringify(result.error));
  }

  console.log("[generateVideoFromImage] Operation done. Checking file existence...");
  const file = bucket.file(outputFilePath);
  const [exists] = await file.exists();
  if (!exists) {
    console.error(`[generateVideoFromImage] File ${outputFilePath} does not exist in bucket`);
    throw new Error("Generated video file not found in storage");
  }

  console.log(`[generateVideoFromImage] File exists. Making public...`);
  await file.makePublic();
  const finalUrl = getPublicUrl(outputFilePath);
  console.log(`[generateVideoFromImage] SUCCESS. final video url:`, finalUrl);
  
  return {
    videoUrl: finalUrl,
    outputFilePath,
  };
};

type SetAdminRoleData = { email: string };
type VerifyAdminStatusData = Record<string, never>;
type RenderRemotionVideoData = {
  templateId: string;
  props: Record<string, unknown>;
  videoId?: string;
};
type GenerateImageData = {
  prompt: string;
  type: "influencer" | "ad";
};
type GenerateScriptData = {
  prompt: string;
  systemInstruction?: string;
};
type AnalyzeImageData = {
  imageBase64: string;
  prompt: string;
  mimeType: string;
};
type AnalyzeAvatarPhotosData = {
  images?: Array<{ imageBase64: string; mimeType: string }>;
  storagePaths?: string[];
  prompt?: string;
};
type GenerateAvatarVideoData = {
  photoStoragePath: string;
  avatarName: string;
  personality: string;
};
type GenerateUGCVideoData = {
  videoId?: string;
  photoStoragePath: string;
  script: string;
  templateId?: string;
  templateName: string;
  avatarName?: string;
  characterSummary?: string;
  productName: string;
  productDescription?: string;
  productImageAnalysis?: string;
};
type CreateRazorpayOrderData = {
  planId: Exclude<SubscriptionPlan, "free">;
};
type VerifyRazorpayPaymentData = {
  planId: Exclude<SubscriptionPlan, "free">;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
  status: string;
};

type RazorpayPaymentResponse = {
  id: string;
  order_id: string;
  status: string;
  amount: number;
  currency: string;
};

export const setAdminRole = onCall(
  { cors: true },
  async (request: CallableRequest<SetAdminRoleData>) => {
    const uid = requireAuth(request);
    const callerRecord = await admin.auth().getUser(uid);
    if (!callerRecord.customClaims?.admin) {
      throw new HttpsError("permission-denied", "Only admins can grant admin roles");
    }

    const { email } = request.data;
    if (!email) {
      throw new HttpsError("invalid-argument", "Email is required");
    }

    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });
      await db.collection("admins").doc(email).set({
        uid: userRecord.uid,
        email,
        grantedBy: uid,
        grantedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, message: `Admin role granted to ${email}` };
    } catch (error: unknown) {
      throw new HttpsError("internal", parseError(error));
    }
  }
);

export const verifyAdminStatus = onCall(
  { cors: true },
  async (request: CallableRequest<VerifyAdminStatusData>) => {
    const uid = requireAuth(request);
    const userRecord = await admin.auth().getUser(uid);
    const isAdmin = userRecord.customClaims?.admin === true;

    if (!isAdmin && request.auth?.token.email) {
      const adminDoc = await db.collection("admins").doc(request.auth.token.email).get();
      if (adminDoc.exists) {
        await admin.auth().setCustomUserClaims(uid, { admin: true });
        return { isAdmin: true };
      }
    }

    return { isAdmin };
  }
);

export const createRazorpayOrder = onCall(
  { cors: true },
  async (request: CallableRequest<CreateRazorpayOrderData>) => {
    const uid = requireAuth(request);
    const { planId } = request.data;

    if (!planId || !(planId in SUBSCRIPTION_PLANS)) {
      throw new HttpsError("invalid-argument", "A valid paid planId is required");
    }

    const paidPlanId = planId as keyof typeof SUBSCRIPTION_PLANS;
    const plan = SUBSCRIPTION_PLANS[paidPlanId];
    const { keyId, authorization } = getRazorpayAuthHeader();

    try {
      const order = await fetchJson<RazorpayOrderResponse>("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: plan.amount,
          currency: plan.currency,
          receipt: `magicbox_${uid}_${Date.now()}`,
          notes: {
            uid,
            planId: paidPlanId,
          },
        }),
      });

      return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId,
      };
    } catch (error: unknown) {
      throw new HttpsError("internal", parseError(error));
    }
  }
);

export const verifyRazorpayPayment = onCall(
  { cors: true },
  async (request: CallableRequest<VerifyRazorpayPaymentData>) => {
    const uid = requireAuth(request);
    const { planId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.data;

    if (!planId || !(planId in SUBSCRIPTION_PLANS)) {
      throw new HttpsError("invalid-argument", "A valid paid planId is required");
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new HttpsError("invalid-argument", "Payment verification data is incomplete");
    }

    const paidPlanId = planId as keyof typeof SUBSCRIPTION_PLANS;
    const plan = SUBSCRIPTION_PLANS[paidPlanId];
    const { authorization, keySecret } = getRazorpayAuthHeader();

    const expectedSignature = createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      throw new HttpsError("permission-denied", "Invalid payment signature");
    }

    try {
      const payment = await fetchJson<RazorpayPaymentResponse>(
        `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,
        {
          method: "GET",
          headers: { Authorization: authorization },
        }
      );

      if (payment.order_id !== razorpay_order_id || payment.status !== "captured") {
        throw new Error("Payment is not captured for the provided order");
      }

      const periodEnd = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + plan.periodDays * 24 * 60 * 60 * 1000)
      );

      await db.collection("subscriptions").doc(uid).set(
        {
          plan: paidPlanId,
          videosUsed: 0,
          videosLimit: plan.videoLimit,
          status: "active",
          razorpayOrderId: razorpay_order_id,
          razorpayCustomerId: razorpay_payment_id,
          currentPeriodEnd: periodEnd,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        success: true,
        subscription: {
          plan: paidPlanId,
          videosUsed: 0,
          videosLimit: plan.videoLimit,
          status: "active",
          razorpayOrderId: razorpay_order_id,
          razorpayCustomerId: razorpay_payment_id,
          currentPeriodEnd: periodEnd,
        },
      };
    } catch (error: unknown) {
      throw new HttpsError("internal", parseError(error));
    }
  }
);

export const renderRemotionVideo = onCall(
  { timeoutSeconds: 540, memory: "2GiB", cors: true },
  async (request: CallableRequest<RenderRemotionVideoData>) => {
    const uid = requireAuth(request);
    const { templateId, props, videoId } = request.data;

    if (!templateId || !props) {
      throw new HttpsError("invalid-argument", "templateId and props are required");
    }

    try {
      if (videoId) {
        await updateVideoDocument(uid, videoId, { status: "generating" });
      }

      const renderJobRef = await db.collection("videoRenders").add({
        userId: uid,
        templateId,
        props,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const projectFileName = `users/${uid}/video-projects/${renderJobRef.id}.json`;
      const projectFile = getBucket().file(projectFileName);

      await projectFile.save(
        JSON.stringify({
          templateId,
          props,
          format: "magicboxai-remotion-project",
          version: 1,
          createdAt: new Date().toISOString(),
        }),
        { metadata: { contentType: "application/json" } }
      );

      await projectFile.makePublic();
      const projectUrl = getPublicUrl(projectFileName);

      await renderJobRef.update({
        status: "completed",
        projectUrl,
      });

      if (videoId) {
        await updateVideoDocument(uid, videoId, {
          status: "completed",
          renderProvider: "remotion",
          videoUrl: projectUrl,
        });
      }

      return {
        videoUrl: projectUrl,
        duration: 15,
        projectId: renderJobRef.id,
      };
    } catch (error: unknown) {
      if (videoId) {
        await updateVideoDocument(uid, videoId, {
          status: "failed",
          errorMessage: parseError(error),
        });
      }
      throw new HttpsError("internal", parseError(error));
    }
  }
);

export const generateImage = onCall(
  { timeoutSeconds: 120, memory: "512MiB", cors: true },
  async (request: CallableRequest<GenerateImageData>) => {
    const uid = requireAuth(request);
    const { prompt, type } = request.data;

    if (!prompt || typeof prompt !== "string") {
      throw new HttpsError("invalid-argument", "Prompt is required");
    }

    try {
      const ai = getAI();
      const response = await ai.models.generateImages({
        model: "imagen-3.0-generate-001",
        prompt: prompt.slice(0, 4000),
        config: {
          numberOfImages: 1,
          outputMimeType: "image/png",
          aspectRatio: "1:1",
        },
      });

      const generatedImage = response.generatedImages?.[0];
      const imageBytes = generatedImage?.image?.imageBytes;
      if (!imageBytes) {
        throw new Error("No image returned from Imagen");
      }

      const fileName = `users/${uid}/${type}s/${uuidv4()}.png`;
      await getBucket().file(fileName).save(Buffer.from(imageBytes, "base64"), {
        metadata: {
          contentType: "image/png",
          cacheControl: "public, max-age=31536000",
        },
      });

      await getBucket().file(fileName).makePublic();
      return { imageUrl: getPublicUrl(fileName) };
    } catch (error: unknown) {
      throw new HttpsError("internal", parseError(error));
    }
  }
);

export const generateScript = onCall(
  { timeoutSeconds: 60, memory: "512MiB", cors: true },
  async (request: CallableRequest<GenerateScriptData>) => {
    requireAuth(request);
    const { prompt, systemInstruction } = request.data;

    try {
      const ai = getAI();
      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction || undefined,
        },
      });

      return { text: result.text };
    } catch (error: unknown) {
      throw new HttpsError("internal", parseError(error));
    }
  }
);

export const analyzeImage = onCall(
  { timeoutSeconds: 60, memory: "512MiB", cors: true },
  async (request: CallableRequest<AnalyzeImageData>) => {
    requireAuth(request);
    const { imageBase64, prompt, mimeType } = request.data;

    try {
      const ai = getAI();
      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          prompt,
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType || "image/jpeg",
            },
          },
        ],
      });

      return { text: result.text };
    } catch (error: unknown) {
      throw new HttpsError("internal", parseError(error));
    }
  }
);

export const analyzeAvatarPhotos = onCall(
  { timeoutSeconds: 120, memory: "512MiB", cors: true },
  async (request: CallableRequest<AnalyzeAvatarPhotosData>) => {
    requireAuth(request);
    const { images, storagePaths, prompt } = request.data;

    if (!images?.length && !storagePaths?.length) {
      throw new HttpsError("invalid-argument", "At least one image or storage path is required");
    }

    try {
      const ai = getAI();
      const inlineImages = storagePaths?.length
        ? await Promise.all(
            storagePaths.slice(0, 10).map(async (path) => {
              const file = getBucket().file(path);
              const [metadata] = await file.getMetadata();
              const [buffer] = await file.download();
              return {
                inlineData: {
                  data: buffer.toString("base64"),
                  mimeType: metadata.contentType || "image/jpeg",
                },
              };
            })
          )
        : (images ?? []).slice(0, 10).map((image: { imageBase64: string; mimeType: string }) => ({
            inlineData: {
              data: image.imageBase64,
              mimeType: image.mimeType || "image/jpeg",
            },
          }));

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          prompt ||
            `You are analyzing multiple photos of the same person for a reusable talking-head avatar.
Return:
DESCRIPTION: 2-3 sentences describing their consistent visual identity and creator vibe
PERSONALITY: a concise creator archetype, max 3 words
VOICE_TONE: the most suitable speaking tone

Requirements:
- Use all photos together, not just one image
- Focus on consistent facial features, energy, and camera presence
- Ignore background differences and prioritize identity consistency`,
          ...inlineImages,
        ],
      });

      return { text: result.text };
    } catch (error: unknown) {
      throw new HttpsError("internal", parseError(error));
    }
  }
);

export const generateAvatarVideo = onCall(
  { timeoutSeconds: 540, memory: "1GiB", cors: true },
  async (request: CallableRequest<GenerateAvatarVideoData>) => {
    console.log("[generateAvatarVideo] ONCALL INVOKED");
    const uid = requireAuth(request);
    console.log(`[generateAvatarVideo] UID: ${uid}`);
    const { photoStoragePath, avatarName, personality } = request.data;
    console.log(`[generateAvatarVideo] Input data:`, { photoStoragePath, avatarName, personality });

    if (!photoStoragePath || !avatarName) {
      console.error("[generateAvatarVideo] MISSING ARGS");
      throw new HttpsError("invalid-argument", "photoStoragePath and avatarName are required");
    }

    try {
      const outputFilePath = `users/${uid}/avatar-previews/${uuidv4()}.mp4`;
      console.log(`[generateAvatarVideo] outputFilePath: ${outputFilePath}`);
      const previewPrompt = buildAvatarPreviewPrompt({
        avatarName,
        personality,
      });

      console.log(`[generateAvatarVideo] previewPrompt: ${previewPrompt}`);
      const res = await generateVideoFromImage({
        prompt: previewPrompt,
        inputImagePath: photoStoragePath,
        outputFilePath,
        durationSeconds: 5,
      });
      console.log(`[generateAvatarVideo] FINISHED SUCCESSFULLY`, res);
      return res;
    } catch (error: unknown) {
      console.error("[generateAvatarVideo] CATCH ERROR:", error);
      throw new HttpsError("internal", parseError(error));
    }
  }
);

export const generateUGCVideo = onCall(
  { timeoutSeconds: 540, memory: "1GiB", cors: true },
  async (request: CallableRequest<GenerateUGCVideoData>) => {
    console.log("[generateUGCVideo] ONCALL INVOKED");
    const uid = requireAuth(request);
    console.log(`[generateUGCVideo] UID: ${uid}`);
    const {
      videoId,
      photoStoragePath,
      script,
      templateId,
      templateName,
      avatarName,
      characterSummary,
      productName,
      productDescription,
      productImageAnalysis,
    } = request.data;

    console.log(`[generateUGCVideo] Input data:`, request.data);

    if (!photoStoragePath || !script || !templateName || !productName) {
      console.error("[generateUGCVideo] MISSING ARGS");
      throw new HttpsError(
        "invalid-argument",
        "photoStoragePath, script, templateName, and productName are required"
      );
    }

    console.log("[generateUGCVideo] Checking subscription...");
    const subscription = await getSubscription(uid);
    assertCanGenerateVideo(subscription);
    console.log("[generateUGCVideo] Subscription OK.");

    try {
      console.log(`[generateUGCVideo] Updating video document ${videoId}...`);
      await updateVideoDocument(uid, videoId, {
        status: "generating",
        renderProvider: "veo",
      });

      const outputFilePath = `users/${uid}/videos/ugc_${uuidv4()}.mp4`;
      console.log(`[generateUGCVideo] outputFilePath: ${outputFilePath}`);
      const prompt = buildUGCVideoPrompt({
        avatarName,
        characterSummary,
        templateId,
        templateName,
        productName,
        productDescription,
        productImageAnalysis,
        script,
      });
      console.log(`[generateUGCVideo] Prompt: \n${prompt}`);

      console.log("[generateUGCVideo] Calling generateVideoFromImage...");
      const result = await generateVideoFromImage({
        prompt,
        inputImagePath: photoStoragePath,
        outputFilePath,
        durationSeconds: 8,
      });
      console.log("[generateUGCVideo] generateVideoFromImage SUCCESS:", result);

      await updateVideoDocument(uid, videoId, {
        status: "completed",
        videoUrl: result.videoUrl,
        renderProvider: "veo",
        errorMessage: admin.firestore.FieldValue.delete(),
      });
      console.log("[generateUGCVideo] Video doc updated as completed.");

      await db.collection("subscriptions").doc(uid).set(
        {
          videosUsed: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log("[generateUGCVideo] Subscription usage incremented. FINISHED.");

      return { videoUrl: result.videoUrl };
    } catch (error: unknown) {
      console.error("[generateUGCVideo] CATCH ERROR:", error);
      await updateVideoDocument(uid, videoId, {
        status: "failed",
        errorMessage: parseError(error),
      });
      throw new HttpsError("internal", parseError(error));
    }
  }
);
