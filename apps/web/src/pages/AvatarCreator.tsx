import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { isConvexConfigured } from "../lib/convex";
import { useAuth } from "@shared/lib/auth";
import { savePhotoAvatar, type AvatarSourceType } from "@shared/lib/firestore";
import {
  analyzeAvatarPhotos,
  analyzeAvatarPhotosFromStorage,
  type AvatarAnalysis,
} from "@shared/lib/gemini";
import { storage, functions } from "@shared/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Badge } from "@shared/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import { captureEvent } from "@shared/lib/analytics";
import {
  Camera,
  Upload,
  X,
  Loader2,
  Sparkles,
  Check,
  User,
  ArrowRight,
  ImagePlus,
  Volume2,
  Play,
  Video,
  Film,
  Square,
  RefreshCcw,
} from "lucide-react";

const MAX_PHOTOS = 10;
const REQUIRED_PHOTOS = 4;
const MAX_VIDEO_MB = 200;
const MIN_RECORD_SECONDS = 3;
/** Veo avatar preview length — must match `durationSeconds` in the callable. */
const AVATAR_VIDEO_SECONDS = 8;
const MAX_RECORD_SECONDS = 60;
/** Identity frames sampled from an upload/recording for Veo. */
const AVATAR_FRAME_COUNT = 5;

type CreationMode = "photos" | "upload" | "record";

const MODE_SOURCE_TYPE: Record<CreationMode, AvatarSourceType> = {
  photos: "photos",
  upload: "video_upload",
  record: "webcam",
};

const MODES: Array<{
  id: CreationMode;
  title: string;
  description: string;
  icon: typeof Camera;
}> = [
  {
    id: "photos",
    title: "Upload Photos",
    description: "4–10 photos of yourself. AI builds your identity and generates a talking preview.",
    icon: ImagePlus,
  },
  {
    id: "upload",
    title: "Upload a Video",
    description:
      "We capture 5 frames across your clip, then generate an avatar preview with Veo 3.",
    icon: Film,
  },
  {
    id: "record",
    title: "Record Live",
    description:
      "Record 10–60s. We sample 5 frames and generate your Veo avatar preview.",
    icon: Video,
  },
];

const FALLBACK_AVATAR_ANALYSIS: AvatarAnalysis = {
  description: "A natural content creator with authentic presence.",
  personality: "Content Creator",
  voiceTone: "Warm and conversational",
};

const isVertexApiSetupError = (message: string) =>
  /Vertex AI API is disabled|Vertex AI API has not been used|aiplatform\.googleapis\.com|SERVICE_DISABLED/i.test(
    message
  );

const videoExtensionFor = (mimeType: string) => {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("webm")) return "webm";
  return "webm";
};

function loadVideoElement(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error("Could not load the video for frame capture"));
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Could not seek in the video"));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    const duration = Number.isFinite(video.duration) ? video.duration : time;
    video.currentTime = Math.max(0, Math.min(time, Math.max(duration - 0.05, 0)));
  });
}

function canvasFrameBlob(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  if (!canvas.width || !canvas.height) {
    throw new Error("The video has no readable frames");
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  ctx.drawImage(video, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not capture a frame"))),
      "image/jpeg",
      0.92,
    );
  });
}

/**
 * Capture N screenshots evenly across the clip.
 * 5s → 1s interval · 10s → 2s · general: interval = duration / N
 * Sample times: 1×interval … N×interval (clamped to end of clip).
 */
export async function extractAvatarFrames(
  source: Blob,
  count = AVATAR_FRAME_COUNT,
): Promise<{ blobs: Blob[]; duration: number; interval: number }> {
  const url = URL.createObjectURL(source);
  try {
    const video = await loadVideoElement(url);
    // Some containers report Infinity until playback starts.
    if (!Number.isFinite(video.duration) || video.duration === 0) {
      await video.play().catch(() => undefined);
      video.pause();
    }
    const duration = Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : Math.max(count, 5);
    const interval = duration / count;
    const blobs: Blob[] = [];
    for (let i = 1; i <= count; i += 1) {
      const t = Math.min(duration - 0.04, interval * i);
      await seekVideo(video, Math.max(0, t));
      blobs.push(await canvasFrameBlob(video));
    }
    return { blobs, duration, interval };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Stitch frames into a short reference MP4/WebM (1 fps) for storage / analysis. */
export async function assembleFramesToVideo(frames: Blob[]): Promise<Blob> {
  if (frames.length === 0) throw new Error("No frames to assemble");
  const bitmaps = await Promise.all(frames.map((f) => createImageBitmap(f)));
  const width = bitmaps[0].width;
  const height = bitmaps[0].height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  const stream = canvas.captureStream(1);
  const mimeType =
    ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
      (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
    ) || "";
  if (!mimeType) {
    bitmaps.forEach((b) => b.close());
    throw new Error("This browser cannot assemble frames into a video");
  }

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = () => reject(new Error("Frame assembly failed"));
  });

  recorder.start();
  for (const bmp of bitmaps) {
    ctx.drawImage(bmp, 0, 0, width, height);
    await new Promise((r) => setTimeout(r, 1000));
  }
  recorder.stop();
  bitmaps.forEach((b) => b.close());
  stream.getTracks().forEach((t) => t.stop());
  return done;
}

/** @deprecated Prefer extractAvatarFrames — kept for callers expecting a single still. */
export async function extractReferenceFrame(source: Blob): Promise<Blob> {
  const { blobs } = await extractAvatarFrames(source, 1);
  return blobs[0];
}

const pickRecorderMimeType = () => {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find(
    (type) =>
      typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)
  );
};

export default function AvatarCreator({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  // v-credit metering for the Veo avatar preview (single ledger, shared with the
  // rest of the app). Charged before generation, refunded if it fails.
  const spendVideoCredits = useMutation(api.credits.spendVideo);
  const refundVideoCredits = useMutation(api.credits.refundVideo);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<CreationMode>("photos");
  const [avatarName, setAvatarName] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [creationStep, setCreationStep] = useState<
    | "idle"
    | "uploading"
    | "sampling"
    | "analyzing"
    | "generating-video"
    | "saving"
    | "done"
  >("idle");
  const [createdAvatar, setCreatedAvatar] = useState<{
    name: string;
    personality: string;
    voiceTone: string;
    description: string;
    videoUrl?: string | null;
  } | null>(null);
  const [framePreviews, setFramePreviews] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Upload-video mode
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  // Record mode
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
    setIsCameraOn(false);
  }, []);

  const clearRecordTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Release camera / object URLs when the page unmounts.
  useEffect(() => {
    return () => {
      clearRecordTimer();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving record mode releases the camera.
  useEffect(() => {
    if (mode !== "record") {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      stopCamera();
    }
  }, [mode, stopCamera]);

  const handlePhotoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const newFiles = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
      if (newFiles.length === 0) {
        toast.error(`Maximum ${MAX_PHOTOS} photos allowed`);
        return;
      }

      const validFiles = newFiles.filter((f) => f.type.startsWith("image/"));
      if (validFiles.length !== newFiles.length) {
        toast.error("Only image files are allowed");
      }

      const sizedFiles = validFiles.filter((f) => f.size <= 10 * 1024 * 1024);
      if (sizedFiles.length !== validFiles.length) {
        toast.error("Images must be under 10MB each");
      }

      setPhotos((prev) => [...prev, ...sizedFiles]);

      sizedFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotoPreviews((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [photos.length]
  );

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please choose a video file");
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast.error(`Videos must be under ${MAX_VIDEO_MB}MB`);
      return;
    }
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
    // Name is required for Create — fill from the file if the field is still empty.
    setAvatarName((prev) => {
      if (prev.trim()) return prev;
      const base = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
      return base || user?.displayName?.split(" ")[0] || "My Avatar";
    });
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play().catch(() => undefined);
      }
      setIsCameraOn(true);
    } catch {
      toast.error("Could not access your camera. Please allow camera and microphone permissions.");
    }
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;

    const mimeType = pickRecorderMimeType();
    if (!mimeType) {
      toast.error("Video recording is not supported in this browser");
      return;
    }

    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    setRecordedBlob(null);
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      setRecordedUrl(URL.createObjectURL(blob));
      setIsRecording(false);
      clearRecordTimer();
      stopCamera();
      setAvatarName((prev) =>
        prev.trim() ? prev : user?.displayName?.split(" ")[0] || "My Avatar",
      );
    };

    recorder.start(1000);
    setIsRecording(true);
    setRecordSeconds(0);
    timerRef.current = window.setInterval(() => {
      setRecordSeconds((prev) => {
        if (prev + 1 >= MAX_RECORD_SECONDS && recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (recordSeconds < MIN_RECORD_SECONDS) {
      toast.error(`Record at least ${MIN_RECORD_SECONDS} seconds`);
      return;
    }
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  };

  const resetRecording = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setRecordedBlob(null);
    setRecordSeconds(0);
  };

  const resetAll = () => {
    setPhotos([]);
    setPhotoPreviews([]);
    setAvatarName("");
    setCreationStep("idle");
    setCreatedAvatar(null);
    setVideoFile(null);
    setFramePreviews((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u));
      return [];
    });
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(null);
    resetRecording();
  };

  /**
   * Video / record pipeline:
   * 1) Sample 5 frames at duration/5 intervals
   * 2) Assemble frames into a short reference video
   * 3) Analyze identity from the frames
   * 4) Generate avatar preview with Veo 3 (image→video from middle frame)
   * 5) Save + show preview video
   */
  const handleCreateAvatarFromVideo = async (source: Blob, mimeType: string) => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    if (!avatarName.trim()) {
      toast.error("Please enter a name for your avatar");
      return;
    }
    if (!storage) {
      toast.error("Video avatars need Firebase Storage, which is unavailable in demo mode");
      return;
    }

    setIsCreating(true);
    setFramePreviews((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u));
      return [];
    });

    try {
      setCreationStep("sampling");
      const { blobs: frameBlobs, interval } = await extractAvatarFrames(source, AVATAR_FRAME_COUNT);
      setFramePreviews(frameBlobs.map((b) => URL.createObjectURL(b)));

      let assembled: Blob;
      try {
        assembled = await assembleFramesToVideo(frameBlobs);
      } catch {
        // Fall back to the original clip if the browser can't stitch frames.
        assembled = source;
      }

      setCreationStep("uploading");
      const stamp = Date.now();
      const assembledMime = assembled.type || "video/webm";
      const videoPath = `users/${user.uid}/avatars/source/${stamp}_frames.${videoExtensionFor(assembledMime)}`;
      await uploadBytes(ref(storage, videoPath), assembled, { contentType: assembledMime });
      const assembledVideoUrl = await getDownloadURL(ref(storage, videoPath));

      // Keep the original upload too when it differs.
      let sourceVideoUrl = assembledVideoUrl;
      let sourceVideoPath = videoPath;
      if (assembled !== source) {
        const originalPath = `users/${user.uid}/avatars/source/${stamp}_original.${videoExtensionFor(mimeType)}`;
        await uploadBytes(ref(storage, originalPath), source, { contentType: mimeType });
        sourceVideoUrl = await getDownloadURL(ref(storage, originalPath));
        sourceVideoPath = originalPath;
      }

      const framePaths: string[] = [];
      const frameUrls: string[] = [];
      for (let i = 0; i < frameBlobs.length; i += 1) {
        const path = `users/${user.uid}/avatars/raw/${stamp}_frame_${i + 1}.jpg`;
        await uploadBytes(ref(storage, path), frameBlobs[i], { contentType: "image/jpeg" });
        framePaths.push(path);
        frameUrls.push(await getDownloadURL(ref(storage, path)));
      }

      // Middle frame is usually the steadiest identity still for Veo.
      const veoFramePath = framePaths[Math.floor(framePaths.length / 2)] ?? framePaths[0];

      setCreationStep("analyzing");
      let analysis = FALLBACK_AVATAR_ANALYSIS;
      let previewError: string | undefined;
      try {
        analysis = await analyzeAvatarPhotosFromStorage(framePaths);
      } catch (analysisErr) {
        const message =
          analysisErr instanceof Error ? analysisErr.message : "Failed to analyze avatar frames";
        if (!isVertexApiSetupError(message)) {
          throw analysisErr;
        }
        previewError = message;
        toast.error("AI analysis unavailable. Continuing with a default profile.");
      }

      setCreationStep("generating-video");
      let videoUrl: string | null = null;
      let previewStatus: "pending" | "completed" | "failed" = "pending";
      let charged = false;
      try {
        // Charge v-credits up front; refunded below if generation fails.
        if (isConvexConfigured) {
          await spendVideoCredits({ seconds: AVATAR_VIDEO_SECONDS });
          charged = true;
        }
        if (!functions) throw new Error("Cloud Functions not configured");
        const generateAvatarVideoFn = httpsCallable<
          {
            photoStoragePath: string;
            frameStoragePaths?: string[];
            avatarName: string;
            personality: string;
          },
          { videoUrl: string }
        >(functions, "generateAvatarVideo");
        const result = await generateAvatarVideoFn({
          photoStoragePath: veoFramePath,
          frameStoragePaths: framePaths,
          avatarName,
          personality: analysis.personality,
        });
        if (!result.data.videoUrl) throw new Error("Veo did not return a video URL");
        videoUrl = result.data.videoUrl;
        previewStatus = "completed";
      } catch (videoErr) {
        const message =
          videoErr instanceof Error ? videoErr.message : "Avatar video generation failed";
        previewStatus = "failed";
        previewError = message;
        console.warn("Veo avatar generation failed:", videoErr);
        toast.error(message);
      }
      if (charged && previewStatus !== "completed") {
        try {
          await refundVideoCredits({ seconds: AVATAR_VIDEO_SECONDS });
        } catch (refundErr) {
          console.warn("v-credit refund failed", refundErr);
        }
      }

      setCreationStep("saving");
      const avatarData: Parameters<typeof savePhotoAvatar>[0] = {
        userId: user.uid,
        name: avatarName,
        photoUrls: frameUrls,
        photoStoragePaths: framePaths,
        description: analysis.description,
        personality: analysis.personality,
        voiceTone: analysis.voiceTone,
        status: "ready",
        sourceType: MODE_SOURCE_TYPE[mode],
        sourceVideoUrl,
        sourceVideoStoragePath: sourceVideoPath,
        // Only a real Veo-generated preview counts as the avatar video. The raw
        // recording stays in sourceVideoUrl — never shown as the "avatar".
        videoUrl: videoUrl ?? undefined,
        previewStatus,
      };
      if (previewError) avatarData.previewError = previewError;
      await savePhotoAvatar(avatarData);

      setCreationStep("done");
      setCreatedAvatar({
        name: avatarName,
        personality: analysis.personality,
        voiceTone: analysis.voiceTone,
        description: analysis.description,
        videoUrl: videoUrl ?? undefined,
      });
      captureEvent("avatar_created", {
        source_type: MODE_SOURCE_TYPE[mode],
        preview_status: previewStatus,
        has_preview_video: Boolean(videoUrl),
      });
      toast.success(
        videoUrl
          ? `Avatar ready — sampled every ${interval.toFixed(1)}s, Veo preview generated`
          : "Avatar saved (preview video pending)",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create avatar";
      toast.error(message);
      setCreationStep("idle");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateAvatarFromPhotos = async () => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    if (!avatarName.trim()) {
      toast.error("Please enter a name for your avatar");
      return;
    }
    if (photos.length < REQUIRED_PHOTOS) {
      toast.error(`Please upload at least ${REQUIRED_PHOTOS} photos`);
      return;
    }

    setIsCreating(true);

    try {
      // Step 1: Upload photos to Firebase Storage
      setCreationStep("uploading");
      let photoUrls: string[] = [];
      let photoStoragePaths: string[] = [];
      let firstPhotoStoragePath: string | null = null;
      let previewStatus: "pending" | "completed" | "failed" = "pending";
      let previewError: string | undefined;
      let analysisWarning: string | undefined;

      if (storage) {
        const uploadPromises = photos.map(async (photo, i) => {
          const safeName = photo.name.replace(/\s+/g, "-");
          const path = `users/${user.uid}/avatars/raw/${Date.now()}_${i}_${safeName}`;
          const storageRef = ref(storage!, path);
          photoStoragePaths.push(path);

          if (i === 0) {
            firstPhotoStoragePath = path;
          }

          await uploadBytes(storageRef, photo);
          return getDownloadURL(storageRef);
        });
        photoUrls = await Promise.all(uploadPromises);
      } else {
        // Demo mode - use preview URLs
        photoUrls = photoPreviews;
      }

      // Step 2: Analyze photos with Gemini
      setCreationStep("analyzing");
      let analysis = FALLBACK_AVATAR_ANALYSIS;

      try {
        analysis =
          photoStoragePaths.length > 0
            ? await analyzeAvatarPhotosFromStorage(photoStoragePaths)
            : await analyzeAvatarPhotos(photos);
      } catch (analysisErr) {
        const message =
          analysisErr instanceof Error ? analysisErr.message : "Failed to analyze avatar photos";

        if (!isVertexApiSetupError(message)) {
          throw analysisErr;
        }

        analysisWarning = message;
        previewStatus = "failed";
        previewError = message;
        toast.error("Vertex AI API is disabled. Saving avatar without AI analysis or preview video.");
      }

      // Step 3: Generate avatar video with Veo (via Cloud Function).
      // Metered against the shared v-credit balance: charge first, refund on failure.
      let videoUrl: string | null = null;
      let charged = false;
      if (!analysisWarning) {
        setCreationStep("generating-video");

        try {
          if (isConvexConfigured) {
            await spendVideoCredits({ seconds: AVATAR_VIDEO_SECONDS });
            charged = true;
          }
        } catch (creditErr) {
          previewStatus = "failed";
          previewError =
            creditErr instanceof Error
              ? creditErr.message
              : "Not enough v-credits for a preview video.";
          toast.error(previewError);
        }

        if (previewStatus !== "failed") {
          try {
            if (functions && firstPhotoStoragePath) {
              const generateAvatarVideoFn = httpsCallable<
                { photoStoragePath: string; avatarName: string; personality: string },
                { videoUrl: string }
              >(functions, "generateAvatarVideo");
              const result = await generateAvatarVideoFn({
                photoStoragePath: firstPhotoStoragePath,
                avatarName,
                personality: analysis.personality,
              });
              if (result.data.videoUrl) {
                videoUrl = result.data.videoUrl;
                previewStatus = "completed";
              } else {
                previewStatus = "failed";
                previewError = "Preview video did not return a URL.";
              }
            } else {
              console.warn("Firebase Functions not initialized or missing photo storage path.");
              previewStatus = "failed";
              previewError = "Preview generation is unavailable in demo mode.";
            }
          } catch (videoErr) {
            console.warn("Video generation failed, continuing without video:", videoErr);
            previewStatus = "failed";
            previewError =
              videoErr instanceof Error ? videoErr.message : "Preview generation failed";
          }
        }

        // Refund if we charged but no preview was produced.
        if (charged && previewStatus !== "completed") {
          try {
            await refundVideoCredits({ seconds: AVATAR_VIDEO_SECONDS });
          } catch (refundErr) {
            console.warn("v-credit refund failed", refundErr);
          }
        }
      }

      // Step 4: Save to Firestore
      setCreationStep("saving");
      const avatarData: Parameters<typeof savePhotoAvatar>[0] = {
        userId: user.uid,
        name: avatarName,
        photoUrls,
        photoStoragePaths,
        description: analysis.description,
        personality: analysis.personality,
        voiceTone: analysis.voiceTone,
        status: "ready",
        sourceType: "photos",
        previewStatus,
      };
      if (videoUrl) avatarData.videoUrl = videoUrl;
      if (previewError) avatarData.previewError = previewError;
      await savePhotoAvatar(avatarData);

      setCreationStep("done");
      setCreatedAvatar({
        name: avatarName,
        personality: analysis.personality,
        voiceTone: analysis.voiceTone,
        description: analysis.description,
        videoUrl,
      });
      captureEvent("avatar_created", {
        source_type: "photos",
        preview_status: previewStatus,
        has_preview_video: Boolean(videoUrl),
        photo_count: photos.length,
      });
      toast.success(
        videoUrl
          ? "Avatar created with video!"
          : analysisWarning
          ? "Avatar saved. Enable Vertex AI API to generate analysis and preview video."
          : "Avatar created successfully! (Video generation unavailable)"
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create avatar";
      toast.error(message);
      setCreationStep("idle");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreate = () => {
    if (mode === "photos") {
      void handleCreateAvatarFromPhotos();
    } else if (mode === "upload") {
      if (!videoFile) {
        toast.error("Please choose a video first");
        return;
      }
      void handleCreateAvatarFromVideo(videoFile, videoFile.type || "video/mp4");
    } else {
      if (!recordedBlob) {
        toast.error("Please record a video first");
        return;
      }
      void handleCreateAvatarFromVideo(recordedBlob, recordedBlob.type || "video/webm");
    }
  };

  const canCreate =
    !isCreating &&
    !!avatarName.trim() &&
    (mode === "photos"
      ? photos.length >= REQUIRED_PHOTOS
      : mode === "upload"
      ? !!videoFile
      : !!recordedBlob);

  const stepMessages: Record<string, string> = {
    sampling: "Capturing 5 identity frames…",
    uploading: mode === "photos" ? "Uploading your photos…" : "Uploading frames & video…",
    analyzing:
      mode === "photos" ? "AI is analyzing your photos…" : "AI is analyzing your frames…",
    "generating-video": "Generating avatar video with Veo 3…",
    saving: "Saving your avatar…",
    done: "Avatar created!",
  };

  const formatSeconds = (total: number) =>
    `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;

  return (
    <div className={cn("animate-fade-in", embedded && "pt-1")}>
      <div className={cn("mx-auto space-y-6", embedded ? "max-w-5xl" : "max-w-4xl")}>
        {/* Header */}
        {!embedded && (
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Create Your Avatar
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Upload photos, upload a video, or record yourself live. Your avatar is stored once and reused for every studio video.
          </p>
        </div>
        )}
        {embedded && (
          <div className="space-y-1">
            <h2 className="font-display text-xl text-foreground">Create avatar</h2>
            <p className="text-sm text-muted-foreground">
              Upload photos, upload a video, or record yourself live.
            </p>
          </div>
        )}

        {creationStep === "done" && createdAvatar ? (
          /* ── Success State with Sample Video ────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">
            {/* Left: Avatar Info */}
            <Card className="bg-card/[0.03] border-border/[0.06] rounded-2xl overflow-hidden">
              <CardContent className="p-8">
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-brand from-emerald-500 to-teal-600 flex items-center justify-center">
                    <Check className="w-10 h-10 text-foreground" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-foreground">
                      {createdAvatar.name}
                    </h2>
                    <Badge className="bg-brand/10 text-brand border-brand/20">
                      {createdAvatar.personality}
                    </Badge>
                  </div>

                  <p className="text-muted-foreground text-sm max-w-md">
                    {createdAvatar.description}
                  </p>

                  <p className="text-muted-foreground text-xs">
                    Voice tone: {createdAvatar.voiceTone}
                  </p>

                  {/* Photo / frame thumbnails */}
                  <div className="flex flex-wrap justify-center gap-3">
                    {(photoPreviews.length > 0 ? photoPreviews : framePreviews).map(
                      (preview, i) => (
                      <div
                        key={i}
                        className="w-16 h-16 rounded-xl overflow-hidden border-2 border-border"
                      >
                        <img
                          src={preview}
                          alt={`Frame ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={() => navigate("/studio")}
                      className="bg-brand hover: hover: text-foreground gap-2 h-12 px-8"
                    >
                      Create Video in Studio
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetAll}
                      className="border-border text-muted-foreground hover:text-foreground hover:bg-secondary h-12"
                    >
                      Create Another
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right: Video Preview */}
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm font-medium text-muted-foreground">
                {createdAvatar.videoUrl
                  ? mode === "photos"
                    ? "AI Generated Video"
                    : "Your Avatar Video"
                  : "Sample Video Preview"}
              </p>
              <div className="w-[280px] rounded-[2rem] border-2 border-border/[0.1] bg-black/60 p-3 shadow-2xl">
                <div className="rounded-[1.5rem] overflow-hidden bg-card aspect-[9/16] flex flex-col relative">
                  {createdAvatar.videoUrl ? (
                    /* ── Stored avatar video ── */
                    <>
                      <video
                        ref={videoRef}
                        src={createdAvatar.videoUrl}
                        className="absolute inset-0 w-full h-full object-cover"
                        controls
                        autoPlay
                        loop
                        playsInline
                        muted
                      />
                      {/* Overlay with avatar info */}
                      <div className="absolute top-0 left-0 right-0 p-3 bg-brand from-black/60 to-transparent z-10">
                        <div className="flex items-center gap-2">
                          {photoPreviews[0] && (
                            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-foreground/20">
                              <img src={photoPreviews[0]} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div>
                            <p className="text-foreground text-xs font-semibold">{createdAvatar.name}</p>
                            <p className="text-muted-foreground text-[10px]">{createdAvatar.personality}</p>
                          </div>
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-brand from-black/60 to-transparent z-10">
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                          {mode === "photos" ? "AI Generated" : "Avatar Source"}
                        </Badge>
                      </div>
                    </>
                  ) : (
                    /* ── Fallback: Static preview mockup ── */
                    <>
                      <div className="absolute inset-0 bg-brand to-zinc-900" />
                      {photoPreviews[0] && (
                        <div className="absolute inset-0 opacity-20">
                          <img src={photoPreviews[0]} alt="" className="w-full h-full object-cover blur-xl scale-110" />
                        </div>
                      )}
                      <div className="relative flex flex-col items-center justify-center h-full px-6 gap-5">
                        <div className="relative">
                          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-brand/50 shadow-lg animate-pulse-slow">
                            {photoPreviews[0] && (
                              <img src={photoPreviews[0]} alt={createdAvatar.name} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                            <div className="w-1.5 h-3 bg-brand rounded-full animate-sound-wave-1" />
                            <div className="w-1.5 h-5 bg-brand rounded-full animate-sound-wave-2" />
                            <div className="w-1.5 h-4 bg-brand rounded-full animate-sound-wave-3" />
                            <div className="w-1.5 h-6 bg-brand rounded-full animate-sound-wave-2" />
                            <div className="w-1.5 h-3 bg-brand rounded-full animate-sound-wave-1" />
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-foreground font-bold text-base">{createdAvatar.name}</p>
                          <p className="text-brand text-xs mt-0.5">{createdAvatar.personality}</p>
                        </div>
                        <div className="bg-accent backdrop-blur-sm rounded-2xl px-5 py-4 border border-border max-w-[240px]">
                          <p className="text-foreground text-sm leading-relaxed animate-typing-reveal">
                            {`"Hello! I'm ${createdAvatar.name}, your digital avatar. I'm ready to create amazing product videos for you!"`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Volume2 className="w-4 h-4" />
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 12 }).map((_, i) => (
                              <div
                                key={i}
                                className="w-0.5 bg-accent rounded-full"
                                style={{
                                  height: `${Math.random() * 12 + 4}px`,
                                  animation: `soundWave ${0.3 + Math.random() * 0.4}s ease-in-out infinite alternate`,
                                  animationDelay: `${i * 0.05}s`,
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-brand from-black/80 to-transparent">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Play className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">Preview (video unavailable)</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">0:08</span>
                        </div>
                        <div className="mt-1.5 h-0.5 bg-accent rounded-full overflow-hidden">
                          <div className="h-full bg-brand rounded-full animate-progress-bar" />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── Creation Form ────────────────────────────────── */
          <div className="space-y-5">
            {/* Mode Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MODES.map((option) => {
                const Icon = option.icon;
                const isActive = mode === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => !isCreating && setMode(option.id)}
                    disabled={isCreating}
                    className={cn(
                      "text-left rounded-2xl p-4 transition-all duration-200 cursor-pointer border",
                      "bg-card/[0.03] hover:bg-card/[0.06]",
                      isActive
                        ? "border-brand ring-2 ring-ring/20 bg-brand/[0.06]"
                        : "border-border/[0.06]",
                      isCreating && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                          isActive ? "bg-brand/15 text-brand" : "bg-secondary text-muted-foreground"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{option.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{option.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
              {/* Left: Input Section */}
              <div className="space-y-5">
                {/* Avatar Name */}
                <Card className="bg-card/[0.03] border-border/[0.06] rounded-2xl">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-foreground text-base flex items-center gap-2">
                      <User className="w-4 h-4 text-brand" />
                      Avatar Name
                      <span className="text-xs font-normal text-rose-500">required</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Input
                      value={avatarName}
                      onChange={(e) => setAvatarName(e.target.value)}
                      placeholder="Enter a name for your avatar..."
                      className="bg-card/[0.04] border-border/[0.08] text-foreground placeholder:text-muted-foreground h-11"
                      disabled={isCreating}
                    />
                    {!avatarName.trim() && (
                      <p className="mt-2 text-xs text-amber-600">
                        Add a name above to unlock Create Avatar.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* ── Photos Mode ── */}
                {mode === "photos" && (
                  <Card className="bg-card/[0.03] border-border/[0.06] rounded-2xl">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-foreground text-base flex items-center gap-2">
                          <Camera className="w-4 h-4 text-brand" />
                          Upload Photos
                        </CardTitle>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "border-0 px-2.5 py-0.5",
                            photos.length >= REQUIRED_PHOTOS
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-card/[0.06] text-muted-foreground"
                          )}
                        >
                          {photos.length}/{MAX_PHOTOS}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-xs text-muted-foreground">
                        Upload at least {REQUIRED_PHOTOS} and up to {MAX_PHOTOS} clear photos of yourself. Use different angles and expressions for best results.
                        Front-facing, side profile, 3/4 view, and talking-expression shots work best.
                      </p>

                      {/* Photo Grid */}
                      <div className="grid grid-cols-5 gap-3">
                        {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
                          const hasPhoto = i < photoPreviews.length;
                          return (
                            <div key={i} className="relative aspect-square">
                              {hasPhoto ? (
                                <div className="w-full h-full rounded-xl overflow-hidden border-2 border-brand/30 group relative">
                                  <img
                                    src={photoPreviews[i]}
                                    alt={`Photo ${i + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  {!isCreating && (
                                    <button
                                      onClick={() => removePhoto(i)}
                                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <X className="w-3 h-3 text-foreground" />
                                    </button>
                                  )}
                                  <div className="absolute bottom-1 left-1">
                                    <Badge className="bg-emerald-500/80 text-foreground text-[9px] border-0 px-1.5 py-0">
                                      <Check className="w-2.5 h-2.5" />
                                    </Badge>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={isCreating}
                                  className={cn(
                                    "w-full h-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer",
                                    "border-border/[0.08] hover:border-brand/40 hover:bg-brand/[0.03]",
                                    isCreating && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  <ImagePlus className="w-5 h-5 text-muted-foreground" />
                                  <span className="text-[9px] text-muted-foreground">
                                    Photo {i + 1}
                                  </span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />

                      {photos.length < REQUIRED_PHOTOS && (
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isCreating}
                          variant="outline"
                          className="w-full border-border/[0.08] text-muted-foreground hover:text-foreground hover:bg-card/[0.06] gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          Upload Photos ({REQUIRED_PHOTOS - photos.length} more needed to start)
                        </Button>
                      )}

                      {photos.length >= REQUIRED_PHOTOS && photos.length < MAX_PHOTOS && (
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isCreating}
                          variant="outline"
                          className="w-full border-border/[0.08] text-muted-foreground hover:text-foreground hover:bg-card/[0.06] gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          Add Optional Photos ({MAX_PHOTOS - photos.length} slots left)
                        </Button>
                      )}

                      {/* Tips */}
                      <div className="bg-brand/[0.05] border border-brand/10 rounded-xl p-4 space-y-2">
                        <p className="text-xs font-medium text-brand">
                          Tips for best results:
                        </p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>- Use well-lit photos with clear face visibility</li>
                          <li>- Include different angles: front, side, 3/4 view</li>
                          <li>- Show different expressions: smile, neutral, talking</li>
                          <li>- Avoid heavy filters or sunglasses</li>
                          <li>- Use recent photos that look like you</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── Upload Video Mode ── */}
                {mode === "upload" && (
                  <Card className="bg-card/[0.03] border-border/[0.06] rounded-2xl">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-foreground text-base flex items-center gap-2">
                        <Film className="w-4 h-4 text-brand" />
                        Upload a Video of Yourself
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-xs text-muted-foreground">
                        A short talking-to-camera clip works best (10–60 seconds, under {MAX_VIDEO_MB}MB).
                        We store this video as your avatar and use it to understand how you look and speak.
                      </p>

                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        onChange={handleVideoSelect}
                        className="hidden"
                      />

                      {videoPreviewUrl ? (
                        <div className="space-y-3">
                          <div className="rounded-xl overflow-hidden bg-black aspect-video">
                            <video
                              src={videoPreviewUrl}
                              controls
                              playsInline
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground truncate">
                              {videoFile?.name} ({((videoFile?.size ?? 0) / (1024 * 1024)).toFixed(1)}MB)
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isCreating}
                              onClick={() => videoInputRef.current?.click()}
                              className="border-border/[0.08] text-muted-foreground hover:text-foreground gap-2"
                            >
                              <RefreshCcw className="w-3.5 h-3.5" />
                              Replace
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => videoInputRef.current?.click()}
                          disabled={isCreating}
                          className={cn(
                            "w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer",
                            "border-border/[0.08] hover:border-brand/40 hover:bg-brand/[0.03]",
                            isCreating && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                            <Upload className="w-7 h-7 text-muted-foreground" />
                          </div>
                          <div className="text-center space-y-1">
                            <p className="text-sm font-medium text-foreground">Click to choose a video</p>
                            <p className="text-xs text-muted-foreground">MP4, MOV, or WebM up to {MAX_VIDEO_MB}MB</p>
                          </div>
                        </button>
                      )}

                      <div className="bg-brand/[0.05] border border-brand/10 rounded-xl p-4 space-y-2">
                        <p className="text-xs font-medium text-brand">
                          Tips for best results:
                        </p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>- Face the camera in good lighting</li>
                          <li>- Speak naturally so we can learn your voice tone</li>
                          <li>- Keep your face visible for the whole clip</li>
                          <li>- Avoid heavy filters, masks, or sunglasses</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── Record Mode ── */}
                {mode === "record" && (
                  <Card className="bg-card/[0.03] border-border/[0.06] rounded-2xl">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-foreground text-base flex items-center gap-2">
                          <Video className="w-4 h-4 text-brand" />
                          Record Yourself Live
                        </CardTitle>
                        {isRecording && (
                          <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            REC {formatSeconds(recordSeconds)}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-xs text-muted-foreground">
                        Record {MIN_RECORD_SECONDS}–{MAX_RECORD_SECONDS} seconds of yourself talking to the camera.
                        We store the recording as your avatar and learn your look and voice from it.
                      </p>

                      <div className="rounded-xl overflow-hidden bg-black aspect-video relative">
                        {recordedUrl ? (
                          <video
                            src={recordedUrl}
                            controls
                            playsInline
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <>
                            <video
                              ref={liveVideoRef}
                              autoPlay
                              muted
                              playsInline
                              className="w-full h-full object-cover scale-x-[-1]"
                            />
                            {!isCameraOn && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                                  <Camera className="w-7 h-7 text-muted-foreground" />
                                </div>
                                <p className="text-xs text-muted-foreground">Camera is off</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex gap-3">
                        {recordedUrl ? (
                          <Button
                            variant="outline"
                            disabled={isCreating}
                            onClick={() => {
                              resetRecording();
                              void startCamera();
                            }}
                            className="flex-1 border-border/[0.08] text-muted-foreground hover:text-foreground gap-2"
                          >
                            <RefreshCcw className="w-4 h-4" />
                            Record Again
                          </Button>
                        ) : !isCameraOn ? (
                          <Button
                            onClick={() => void startCamera()}
                            disabled={isCreating}
                            className="flex-1 bg-brand text-foreground gap-2"
                          >
                            <Camera className="w-4 h-4" />
                            Turn On Camera
                          </Button>
                        ) : !isRecording ? (
                          <Button
                            onClick={startRecording}
                            disabled={isCreating}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white gap-2"
                          >
                            <span className="w-2.5 h-2.5 rounded-full bg-white" />
                            Start Recording
                          </Button>
                        ) : (
                          <Button
                            onClick={stopRecording}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white gap-2"
                          >
                            <Square className="w-4 h-4" />
                            Stop Recording
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Create Button */}
                <div className="space-y-2">
                  <Button
                    onClick={handleCreate}
                    disabled={!canCreate}
                    className="w-full h-12 gap-2 rounded-xl bg-brand text-base text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {stepMessages[creationStep] || "Creating..."}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Create Avatar
                      </>
                    )}
                  </Button>
                  {!canCreate && !isCreating && (
                    <p className="text-center text-xs text-muted-foreground">
                      {!avatarName.trim()
                        ? "Enter an avatar name to continue."
                        : mode === "photos"
                          ? `Upload at least ${REQUIRED_PHOTOS} photos.`
                          : mode === "upload"
                            ? "Upload a video first."
                            : "Record a short clip first."}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Preview Panel */}
              <div>
                <Card className="bg-card/[0.03] border-border/[0.06] rounded-2xl sticky top-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-foreground text-base flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-brand" />
                      Avatar Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="aspect-[3/4] rounded-xl overflow-hidden relative">
                      {createdAvatar?.videoUrl && creationStep === "done" ? (
                        <div className="w-full h-full bg-black rounded-xl relative">
                          <video
                            src={createdAvatar.videoUrl}
                            controls
                            playsInline
                            autoPlay
                            loop
                            muted
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                            <p className="text-sm font-semibold text-white">
                              {createdAvatar.name}
                            </p>
                            <p className="text-xs text-white/70">Veo avatar preview</p>
                          </div>
                        </div>
                      ) : mode === "photos" && photos.length > 0 ? (
                        <div className="w-full h-full bg-brand rounded-xl flex flex-col items-center justify-center gap-4 p-6">
                          {/* Main photo preview */}
                          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-brand/30 shadow-lg">
                            <img
                              src={photoPreviews[0]}
                              alt="Avatar"
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="text-center space-y-2">
                            <h3 className="text-lg font-semibold text-foreground">
                              {avatarName || "Your Avatar"}
                            </h3>
                            <Badge className="bg-brand/10 text-brand border-brand/20">
                              {photos.length >= REQUIRED_PHOTOS
                                ? `Ready to create (${photos.length}/${MAX_PHOTOS})`
                                : `${REQUIRED_PHOTOS - photos.length} more photos needed`}
                            </Badge>
                          </div>

                          {/* Small photo grid */}
                          <div className="flex gap-2 mt-2">
                            {photoPreviews.slice(1).map((preview, i) => (
                              <div
                                key={i}
                                className="w-12 h-12 rounded-lg overflow-hidden border border-border"
                              >
                                <img
                                  src={preview}
                                  alt={`Photo ${i + 2}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>

                          {isCreating && (
                            <div className="mt-4 flex flex-col items-center gap-2">
                              <Loader2 className="w-6 h-6 text-brand animate-spin" />
                              <p className="text-xs text-muted-foreground">
                                {stepMessages[creationStep]}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : mode !== "photos" && (videoPreviewUrl || recordedUrl || framePreviews.length > 0) ? (
                        <div className="w-full h-full bg-black rounded-xl relative flex flex-col">
                          <video
                            src={(mode === "upload" ? videoPreviewUrl : recordedUrl) ?? undefined}
                            muted
                            loop
                            autoPlay
                            playsInline
                            className="min-h-0 flex-1 w-full object-cover"
                          />
                          {framePreviews.length > 0 && (
                            <div className="absolute left-2 right-2 top-2 flex gap-1">
                              {framePreviews.map((src, i) => (
                                <img
                                  key={src}
                                  src={src}
                                  alt={`Frame ${i + 1}`}
                                  className="h-10 flex-1 rounded object-cover border border-white/30"
                                />
                              ))}
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                            <p className="text-sm font-semibold text-foreground">
                              {avatarName || "Your Avatar"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {framePreviews.length > 0
                                ? `${framePreviews.length} frames sampled → Veo`
                                : mode === "upload"
                                  ? "From uploaded video"
                                  : "From live recording"}
                            </p>
                          </div>
                          {isCreating && (
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                              <Loader2 className="w-6 h-6 text-brand animate-spin" />
                              <p className="text-xs text-muted-foreground">
                                {stepMessages[creationStep]}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full bg-card/[0.02] border border-dashed border-border/[0.08] rounded-xl flex flex-col items-center justify-center gap-3 p-6 text-center">
                          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                            {mode === "photos" ? (
                              <Camera className="w-7 h-7 text-muted-foreground" />
                            ) : mode === "upload" ? (
                              <Film className="w-7 h-7 text-muted-foreground" />
                            ) : (
                              <Video className="w-7 h-7 text-muted-foreground" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">
                              {mode === "photos"
                                ? "No photos uploaded yet"
                                : mode === "upload"
                                ? "No video selected yet"
                                : "Nothing recorded yet"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {mode === "photos"
                                ? `Upload at least ${REQUIRED_PHOTOS} photos to create your avatar`
                                : mode === "upload"
                                ? "We'll sample 5 frames, then generate a Veo avatar preview"
                                : "Turn on your camera and record a short intro"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
