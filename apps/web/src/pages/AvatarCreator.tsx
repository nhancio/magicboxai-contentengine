import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@shared/lib/auth";
import { savePhotoAvatar } from "@shared/lib/firestore";
import { analyzeAvatarPhotos, analyzeAvatarPhotosFromStorage } from "@shared/lib/gemini";
import { storage, functions } from "@shared/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Label } from "@shared/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Badge } from "@shared/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
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
} from "lucide-react";

const MAX_PHOTOS = 10;
const REQUIRED_PHOTOS = 5;

const FALLBACK_AVATAR_ANALYSIS: {
  description: string;
  personality: string;
  voiceTone: string;
} = {
  description: "A natural content creator with authentic presence.",
  personality: "Content Creator",
  voiceTone: "Warm and conversational",
};

const isVertexApiSetupError = (message: string) =>
  /Vertex AI API is disabled|Vertex AI API has not been used|aiplatform\.googleapis\.com|SERVICE_DISABLED/i.test(
    message
  );

export default function AvatarCreator() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarName, setAvatarName] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [creationStep, setCreationStep] = useState<
    "idle" | "uploading" | "analyzing" | "generating-video" | "saving" | "done"
  >("idle");
  const [createdAvatar, setCreatedAvatar] = useState<{
    name: string;
    personality: string;
    voiceTone: string;
    description: string;
    videoUrl?: string | null;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePhotoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const newFiles = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
      if (newFiles.length === 0) {
        toast.error(`Maximum ${MAX_PHOTOS} photos allowed`);
        return;
      }

      // Validate file types
      const validFiles = newFiles.filter((f) => f.type.startsWith("image/"));
      if (validFiles.length !== newFiles.length) {
        toast.error("Only image files are allowed");
      }

      // Validate file sizes (max 10MB each)
      const sizedFiles = validFiles.filter((f) => f.size <= 10 * 1024 * 1024);
      if (sizedFiles.length !== validFiles.length) {
        toast.error("Images must be under 10MB each");
      }

      setPhotos((prev) => [...prev, ...sizedFiles]);

      // Generate previews
      sizedFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotoPreviews((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [photos.length]
  );

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateAvatar = async () => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    if (!avatarName.trim()) {
      toast.error("Please enter a name for your avatar");
      return;
    }
    if (photos.length < REQUIRED_PHOTOS) {
      toast.error(`Please upload ${REQUIRED_PHOTOS} photos`);
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

      // Step 3: Generate avatar video with Veo (via Cloud Function)
      let videoUrl: string | null = null;
      if (!analysisWarning) {
        setCreationStep("generating-video");
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

  const stepMessages: Record<string, string> = {
    uploading: "Uploading your photos...",
    analyzing: "AI is analyzing your photos...",
    "generating-video": "Generating avatar video with AI...",
    saving: "Saving your avatar...",
    done: "Avatar created!",
  };

  return (
    <div className="animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Create Your Avatar
          </h1>
          <p className="text-white/50 text-sm max-w-md mx-auto">
            Upload 5 to 10 photos of yourself. We use multiple angles to build your avatar identity and generate a talking preview.
          </p>
        </div>

        {creationStep === "done" && createdAvatar ? (
          /* ── Success State with Sample Video ────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">
            {/* Left: Avatar Info */}
            <Card className="bg-white/[0.03] border-white/[0.06] rounded-2xl overflow-hidden">
              <CardContent className="p-8">
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <Check className="w-10 h-10 text-white" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">
                      {createdAvatar.name}
                    </h2>
                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                      {createdAvatar.personality}
                    </Badge>
                  </div>

                  <p className="text-white/60 text-sm max-w-md">
                    {createdAvatar.description}
                  </p>

                  <p className="text-white/40 text-xs">
                    Voice tone: {createdAvatar.voiceTone}
                  </p>

                  {/* Photo thumbnails */}
                  <div className="flex gap-3">
                    {photoPreviews.map((preview, i) => (
                      <div
                        key={i}
                        className="w-16 h-16 rounded-xl overflow-hidden border-2 border-white/10"
                      >
                        <img
                          src={preview}
                          alt={`Photo ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={() => navigate("/create-video")}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white gap-2 h-12 px-8"
                    >
                      Create Video
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPhotos([]);
                        setPhotoPreviews([]);
                        setAvatarName("");
                        setCreationStep("idle");
                        setCreatedAvatar(null);
                      }}
                      className="border-white/10 text-white/60 hover:text-white hover:bg-white/5 h-12"
                    >
                      Create Another
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right: Video Preview */}
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm font-medium text-white/60">
                {createdAvatar.videoUrl ? "AI Generated Video" : "Sample Video Preview"}
              </p>
              <div className="w-[280px] rounded-[2rem] border-2 border-white/[0.1] bg-black/60 p-3 shadow-2xl">
                <div className="rounded-[1.5rem] overflow-hidden bg-zinc-900 aspect-[9/16] flex flex-col relative">
                  {createdAvatar.videoUrl ? (
                    /* ── Real AI-generated video ── */
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
                      <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/60 to-transparent z-10">
                        <div className="flex items-center gap-2">
                          {photoPreviews[0] && (
                            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/30">
                              <img src={photoPreviews[0]} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div>
                            <p className="text-white text-xs font-semibold">{createdAvatar.name}</p>
                            <p className="text-white/50 text-[10px]">{createdAvatar.personality}</p>
                          </div>
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent z-10">
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                          AI Generated
                        </Badge>
                      </div>
                    </>
                  ) : (
                    /* ── Fallback: Static preview mockup ── */
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-indigo-900/30 to-zinc-900" />
                      {photoPreviews[0] && (
                        <div className="absolute inset-0 opacity-20">
                          <img src={photoPreviews[0]} alt="" className="w-full h-full object-cover blur-xl scale-110" />
                        </div>
                      )}
                      <div className="relative flex flex-col items-center justify-center h-full px-6 gap-5">
                        <div className="relative">
                          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-purple-500/50 shadow-lg shadow-purple-500/30 animate-pulse-slow">
                            {photoPreviews[0] && (
                              <img src={photoPreviews[0]} alt={createdAvatar.name} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                            <div className="w-1.5 h-3 bg-purple-400 rounded-full animate-sound-wave-1" />
                            <div className="w-1.5 h-5 bg-purple-400 rounded-full animate-sound-wave-2" />
                            <div className="w-1.5 h-4 bg-purple-400 rounded-full animate-sound-wave-3" />
                            <div className="w-1.5 h-6 bg-purple-400 rounded-full animate-sound-wave-2" />
                            <div className="w-1.5 h-3 bg-purple-400 rounded-full animate-sound-wave-1" />
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-white font-bold text-base">{createdAvatar.name}</p>
                          <p className="text-purple-300 text-xs mt-0.5">{createdAvatar.personality}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-4 border border-white/10 max-w-[240px]">
                          <p className="text-white text-sm leading-relaxed animate-typing-reveal">
                            {`"Hello! I'm ${createdAvatar.name}, your digital avatar. I'm ready to create amazing product videos for you!"`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-white/30">
                          <Volume2 className="w-4 h-4" />
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 12 }).map((_, i) => (
                              <div
                                key={i}
                                className="w-0.5 bg-white/30 rounded-full"
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
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Play className="w-3 h-3 text-white/50" />
                            <span className="text-[10px] text-white/40">Preview (video unavailable)</span>
                          </div>
                          <span className="text-[10px] text-white/40">0:08</span>
                        </div>
                        <div className="mt-1.5 h-0.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full animate-progress-bar" />
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
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
            {/* Left: Upload Section */}
            <div className="space-y-5">
              {/* Avatar Name */}
              <Card className="bg-white/[0.03] border-white/[0.06] rounded-2xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <User className="w-4 h-4 text-purple-400" />
                    Avatar Name
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    value={avatarName}
                    onChange={(e) => setAvatarName(e.target.value)}
                    placeholder="Enter a name for your avatar..."
                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 h-11"
                    disabled={isCreating}
                  />
                </CardContent>
              </Card>

              {/* Photo Upload */}
              <Card className="bg-white/[0.03] border-white/[0.06] rounded-2xl">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <Camera className="w-4 h-4 text-purple-400" />
                      Upload Photos
                    </CardTitle>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "border-0 px-2.5 py-0.5",
                        photos.length >= REQUIRED_PHOTOS
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-white/[0.06] text-white/50"
                      )}
                    >
                      {photos.length}/{MAX_PHOTOS}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-white/40">
                    Upload at least 5 and up to 10 clear photos of yourself. Use different angles and expressions for best results.
                    Front-facing, side profile, 3/4 view, and talking-expression shots work best.
                  </p>

                  {/* Photo Grid */}
                  <div className="grid grid-cols-5 gap-3">
                    {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
                      const hasPhoto = i < photoPreviews.length;
                      return (
                        <div key={i} className="relative aspect-square">
                          {hasPhoto ? (
                            <div className="w-full h-full rounded-xl overflow-hidden border-2 border-purple-500/30 group relative">
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
                                  <X className="w-3 h-3 text-white" />
                                </button>
                              )}
                              <div className="absolute bottom-1 left-1">
                                <Badge className="bg-emerald-500/80 text-white text-[9px] border-0 px-1.5 py-0">
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
                                "border-white/[0.08] hover:border-purple-500/40 hover:bg-purple-500/[0.03]",
                                isCreating && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <ImagePlus className="w-5 h-5 text-white/20" />
                              <span className="text-[9px] text-white/25">
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
                      className="w-full border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.06] gap-2"
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
                      className="w-full border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.06] gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Add Optional Photos ({MAX_PHOTOS - photos.length} slots left)
                    </Button>
                  )}

                  {/* Tips */}
                  <div className="bg-purple-500/[0.05] border border-purple-500/10 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-medium text-purple-400">
                      Tips for best results:
                    </p>
                    <ul className="text-xs text-white/40 space-y-1">
                      <li>- Use well-lit photos with clear face visibility</li>
                      <li>- Include different angles: front, side, 3/4 view</li>
                      <li>- Show different expressions: smile, neutral, talking</li>
                      <li>- Avoid heavy filters or sunglasses</li>
                      <li>- Use recent photos that look like you</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Create Button */}
              <Button
                onClick={handleCreateAvatar}
                disabled={
                  isCreating ||
                  !avatarName.trim() ||
                  photos.length < REQUIRED_PHOTOS
                }
                className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white gap-2 text-base rounded-xl"
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
            </div>

            {/* Right: Preview Panel */}
            <div>
              <Card className="bg-white/[0.03] border-white/[0.06] rounded-2xl sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    Avatar Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-[3/4] rounded-xl overflow-hidden relative">
                    {photos.length > 0 ? (
                      <div className="w-full h-full bg-gradient-to-br from-purple-600/20 via-indigo-600/20 to-violet-600/20 rounded-xl flex flex-col items-center justify-center gap-4 p-6">
                        {/* Main photo preview */}
                        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-purple-500/30 shadow-lg shadow-purple-500/20">
                          <img
                            src={photoPreviews[0]}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="text-center space-y-2">
                          <h3 className="text-lg font-semibold text-white">
                            {avatarName || "Your Avatar"}
                          </h3>
                          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">
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
                              className="w-12 h-12 rounded-lg overflow-hidden border border-white/10"
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
                            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                          <p className="text-xs text-white/50">
                            {stepMessages[creationStep]}
                          </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-full bg-white/[0.02] border border-dashed border-white/[0.08] rounded-xl flex flex-col items-center justify-center gap-3 p-6 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
                          <Camera className="w-7 h-7 text-white/20" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-white/40">
                            No photos uploaded yet
                          </p>
                          <p className="text-xs text-white/25">
                            Upload at least {REQUIRED_PHOTOS} photos to create your avatar
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
