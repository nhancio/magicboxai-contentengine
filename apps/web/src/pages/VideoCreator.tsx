import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { functions, storage } from "@shared/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@shared/lib/auth";
import { Button } from "@shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Badge } from "@shared/components/ui/badge";
import { Input } from "@shared/components/ui/input";
import { Label } from "@shared/components/ui/label";
import { Textarea } from "@shared/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/components/ui/tabs";
import { ScrollArea } from "@shared/components/ui/scroll-area";
import {
  getPhotoAvatars,
  type PhotoAvatarRecord,
  saveVideo,
  getUserSubscription,
  type SubscriptionRecord,
} from "@shared/lib/firestore";
import {
  VIRAL_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type ViralTemplate,
} from "@shared/lib/templates";
import {
  generateScript,
  generateHooks,
  analyzeProductPhoto,
} from "@shared/lib/gemini";
import { cn } from "@shared/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Download,
  ImagePlus,
  Sparkles,
  Upload,
  Video,
  X,
  Zap,
  Loader2,
  Camera,
  CreditCard,
  Crown,
  Play,
  FileDown,
} from "lucide-react";
import {
  VideoPlayer,
  mapTemplateToComposition,
  exportVideoMetadata,
  renderVideo,
  type VideoProps,
  type TemplateId,
} from "../remotion";

const TONES = ["Funny", "Bold", "Aesthetic", "Storytelling", "Problem-Solution"] as const;
const PLATFORMS = ["TikTok", "Instagram Reels", "YouTube Shorts"] as const;
const STEP_LABELS = ["Choose Avatar", "Choose Template", "Product Details", "Generate Video"] as const;

export default function VideoCreator() {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Avatars
  const [avatars, setAvatars] = useState<PhotoAvatarRecord[]>([]);
  const [loadingAvatars, setLoadingAvatars] = useState(true);
  const [selectedAvatar, setSelectedAvatar] = useState<PhotoAvatarRecord | null>(null);

  // Template
  const [selectedTemplate, setSelectedTemplate] = useState<ViralTemplate | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // Product
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState<string>("Bold");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("TikTok");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>("");
  const [generatedScript, setGeneratedScript] = useState<{
    hook: string;
    script: string;
    cta: string;
    captions: string[];
  } | null>(null);
  const [generatedHooks, setGeneratedHooks] = useState<string[] | null>(null);
  const [videoSaved, setVideoSaved] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

  // Subscription
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);

  // Load user's avatars and subscription
  useEffect(() => {
    if (!user) return;
    getPhotoAvatars(user.uid)
      .then(setAvatars)
      .catch(() => setAvatars([]))
      .finally(() => setLoadingAvatars(false));

    getUserSubscription(user.uid)
      .then(setSubscription)
      .catch(() => setSubscription({ plan: "free", videosUsed: 0, videosLimit: 0 }));
  }, [user]);

  const filteredTemplates =
    activeCategory === "All"
      ? VIRAL_TEMPLATES
      : VIRAL_TEMPLATES.filter((t) => t.category === activeCategory);

  // Auto-select Product Explanation template
  useEffect(() => {
    const productExplanation = VIRAL_TEMPLATES.find(
      (t) => t.id === "template-product-explanation"
    );
    if (productExplanation && !selectedTemplate) {
      setSelectedTemplate(productExplanation);
    }
  }, []);

  // ── Handlers ──────────────────────────────────────────────────

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    setProductImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setProductImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleGenerateVideo = async () => {
    if (!user || !selectedAvatar || !selectedTemplate) return;

    if (!productName.trim()) {
      toast.error("Please enter a product name");
      return;
    }

    if (!selectedAvatar.photoStoragePaths?.[0]) {
      toast.error("This avatar does not have a reusable source image. Please recreate the avatar.");
      return;
    }

    // Check subscription
    if (subscription && subscription.plan === "free") {
      toast.error("Please subscribe to a plan to generate videos");
      return;
    }
    if (subscription && subscription.videosUsed >= subscription.videosLimit) {
      toast.error("You've reached your video generation limit. Please upgrade your plan.");
      return;
    }

    setIsGenerating(true);
    setGeneratedScript(null);
    setGeneratedVideoUrl(null);
    setVideoSaved(false);

    try {
      // Step 1: Analyze product photo if uploaded
      let productPhotoAnalysis: string | undefined;
      let productImageUrl: string | undefined;
      if (productImage) {
        setGenerationStep("Analyzing your product photo...");
        productPhotoAnalysis = await analyzeProductPhoto(productImage);

        if (storage) {
          setGenerationStep("Uploading your product image...");
          const safeName = productImage.name.replace(/\s+/g, "-");
          const productPath = `users/${user.uid}/products/${Date.now()}_${safeName}`;
          const storageRef = ref(storage, productPath);
          await uploadBytes(storageRef, productImage);
          productImageUrl = await getDownloadURL(storageRef);
        }
      }

      // Step 2: Generate script
      setGenerationStep("Generating script with AI...");
      const result = await generateScript({
        productName,
        productDescription: productDescription || productPhotoAnalysis || "",
        templateName: selectedTemplate.name,
        avatarPersonality: selectedAvatar.personality,
        tone: selectedTone,
        platform: selectedPlatform,
        productPhotoAnalysis,
      });

      setGeneratedScript(result);

      // Step 3: Create video job in Firestore
      setGenerationStep("Creating your video job...");
      const videoDoc = await saveVideo({
        userId: user.uid,
        avatarId: selectedAvatar.id!,
        avatarName: selectedAvatar.name,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        productName,
        productDescription: productDescription || "",
        productImageUrl,
        script: result.script,
        hookLine: result.hook,
        captions: result.captions,
        cta: result.cta,
        platform: selectedPlatform,
        tone: selectedTone,
        status: "queued",
      });

      // Step 4: Generate final video on the backend
      if (!functions) {
        throw new Error("Cloud Functions not initialized");
      }

      const generateUGCVideoFn = httpsCallable<
        {
          videoId: string;
          photoStoragePath: string;
          script: string;
          templateId: string;
          templateName: string;
          avatarName: string;
          characterSummary?: string;
          productName: string;
          productDescription?: string;
          productImageAnalysis?: string;
        },
        { videoUrl: string }
      >(functions, "generateUGCVideo");

      setGenerationStep("Rendering your avatar video...");
      const videoResult = await generateUGCVideoFn({
        videoId: videoDoc.id,
        photoStoragePath: selectedAvatar.photoStoragePaths[0],
        script: result.script,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        avatarName: selectedAvatar.name,
        characterSummary: `${selectedAvatar.personality}. ${selectedAvatar.description}`,
        productName,
        productDescription: productDescription || "",
        productImageAnalysis: productPhotoAnalysis,
      });

      setGeneratedVideoUrl(videoResult.data.videoUrl);
      if (subscription) {
        setSubscription({ ...subscription, videosUsed: subscription.videosUsed + 1 });
      }

      setVideoSaved(true);
      toast.success("Video generated successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate video";
      toast.error(message);
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  const handleGenerateHooks = async () => {
    if (!productName.trim()) {
      toast.error("Please enter a product name");
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generateHooks({
        productName,
        productDescription,
        tone: selectedTone,
      });
      setGeneratedHooks(result);
      toast.success("Hooks generated!");
    } catch {
      toast.error("Failed to generate hooks.");
    } finally {
      setIsGenerating(false);
    }
  };

  const canProceedToGenerate =
    subscription && subscription.plan !== "free" && subscription.videosUsed < subscription.videosLimit;

  // ── Progress Bar ──────────────────────────────────────────────

  const renderProgress = () => (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEP_LABELS.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3 | 4;
        const isActive = currentStep === step;
        const isComplete = currentStep > step;

        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                  isComplete
                    ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white"
                    : isActive
                      ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white ring-4 ring-purple-500/20"
                      : "bg-white/[0.06] text-white/40 border border-white/[0.08]"
                )}
              >
                {isComplete ? <Check className="w-4 h-4" /> : step}
              </div>
              <span
                className={cn(
                  "text-xs font-medium transition-colors whitespace-nowrap",
                  isActive ? "text-white" : "text-white/40"
                )}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={cn(
                  "w-16 sm:w-24 h-px mx-2 sm:mx-4 mb-6 transition-colors",
                  isComplete ? "bg-purple-500" : "bg-white/[0.08]"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Step 1: Choose Avatar ─────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Choose Your Avatar</h2>
        <p className="text-white/50 text-sm">
          Select the avatar that will appear in your video
        </p>
      </div>

      {loadingAvatars ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : avatars.length === 0 ? (
        <Card className="bg-white/[0.03] border-white/[0.06] rounded-2xl">
          <CardContent className="p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto">
              <Camera className="w-8 h-8 text-white/20" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">
                No avatars yet
              </h3>
              <p className="text-white/50 text-sm max-w-md mx-auto">
                You need to create an avatar first by uploading 5 to 10 photos of yourself.
                Avatar creation is free!
              </p>
            </div>
            <Link to="/avatar-builder">
              <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white gap-2 mt-2">
                <Camera className="w-4 h-4" />
                Create Your Avatar
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {avatars
              .filter((a) => a.status === "ready")
              .map((avatar) => {
                const isSelected = selectedAvatar?.id === avatar.id;
                return (
                  <button
                    key={avatar.id}
                    onClick={() => setSelectedAvatar(avatar)}
                    className={cn(
                      "text-left rounded-2xl p-5 transition-all duration-200 cursor-pointer",
                      "bg-white/[0.03] border hover:bg-white/[0.06]",
                      isSelected
                        ? "border-purple-500 ring-2 ring-purple-500/20 bg-purple-500/[0.06]"
                        : "border-white/[0.06]"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/10 shrink-0">
                        {avatar.photoUrls?.[0] ? (
                          <img
                            src={avatar.photoUrls[0]}
                            alt={avatar.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                            {avatar.name[0]}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h3 className="font-semibold text-white text-sm">
                          {avatar.name}
                        </h3>
                        <p className="text-xs text-purple-400 font-medium">
                          {avatar.personality}
                        </p>
                        <p className="text-xs text-white/40 line-clamp-2">
                          {avatar.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>

          <div className="flex items-center justify-between pt-4">
            <Link to="/avatar-builder">
              <Button
                variant="ghost"
                className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 gap-2"
              >
                <Camera className="w-4 h-4" />
                Create New Avatar
              </Button>
            </Link>
            <Button
              onClick={() => setCurrentStep(2)}
              disabled={!selectedAvatar}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white gap-2"
            >
              Next: Choose Template
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );

  // ── Step 2: Choose Template ───────────────────────────────────

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Choose a Template</h2>
        <p className="text-white/50 text-sm">
          Pick a video format — "Product Explanation" is recommended for product videos
        </p>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="bg-white/[0.04] border border-white/[0.06] p-1 flex flex-wrap h-auto gap-1">
          {TEMPLATE_CATEGORIES.map((cat) => (
            <TabsTrigger
              key={cat}
              value={cat}
              className="text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => {
              const isSelected = selectedTemplate?.id === template.id;
              const isRecommended = template.id === "template-product-explanation";
              return (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={cn(
                    "text-left rounded-2xl p-5 transition-all duration-200 cursor-pointer relative",
                    "bg-white/[0.03] border hover:bg-white/[0.06]",
                    isSelected
                      ? "border-purple-500 ring-2 ring-purple-500/20 bg-purple-500/[0.06]"
                      : isRecommended
                        ? "border-orange-500/30 bg-orange-500/[0.03]"
                        : "border-white/[0.06]"
                  )}
                >
                  {isRecommended && (
                    <Badge className="absolute -top-2 right-3 bg-orange-500 text-white border-0 text-[10px] px-2">
                      Recommended
                    </Badge>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                        `bg-gradient-to-br ${template.gradient}`
                      )}
                    >
                      <Video className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-white text-sm">{template.name}</h3>
                  </div>
                  <p className="text-xs text-purple-300/70 italic mb-2 line-clamp-1">
                    &ldquo;{template.hookLine}&rdquo;
                  </p>
                  <p className="text-xs text-white/40 mb-3 line-clamp-2">
                    {template.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-white/[0.06] text-white/50 border-0 px-2 py-0.5"
                      >
                        {template.tone.split(",")[0]}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-white/30 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {template.estimatedDuration}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between pt-4">
        <Button
          variant="ghost"
          onClick={() => setCurrentStep(1)}
          className="text-white/60 hover:text-white gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          onClick={() => setCurrentStep(3)}
          disabled={!selectedTemplate}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white gap-2"
        >
          Next: Product Details
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  // ── Step 3: Product Details ───────────────────────────────────

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Add Product Details</h2>
        <p className="text-white/50 text-sm">
          Upload your product photo and tell us about it
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-5">
        {/* Product Photo Upload */}
        <Card className="bg-white/[0.03] border-white/[0.06] rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <ImagePlus className="w-4 h-4 text-purple-400" />
              Product Photo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleProductImageUpload}
              className="hidden"
            />

            {productImagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-white/10">
                <img
                  src={productImagePreview}
                  alt="Product"
                  className="w-full max-h-64 object-contain bg-black/20"
                />
                <button
                  onClick={() => {
                    setProductImage(null);
                    setProductImagePreview(null);
                  }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 flex items-center justify-center hover:bg-black/90 transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "w-full rounded-xl border-2 border-dashed p-8 transition-colors",
                  "border-white/[0.08] hover:border-purple-500/40 hover:bg-purple-500/[0.03]",
                  "flex flex-col items-center gap-3 cursor-pointer"
                )}
              >
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-purple-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-white/60 font-medium">
                    Upload your product photo
                  </p>
                  <p className="text-xs text-white/30 mt-1">
                    AI will analyze it to generate an accurate script
                  </p>
                </div>
              </button>
            )}
          </CardContent>
        </Card>

        {/* Product Info */}
        <Card className="bg-white/[0.03] border-white/[0.06] rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-base">Product Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Product Name *</Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. GlowSerum Pro, Nike Air Max, iPhone Case..."
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">
                Product Description{" "}
                <span className="text-white/30">(optional if photo uploaded)</span>
              </Label>
              <Textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Describe your product, its key benefits, target audience..."
                rows={3}
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 resize-none"
              />
            </div>

            {/* Tone */}
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Tone</Label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((tone) => (
                  <button
                    key={tone}
                    onClick={() => setSelectedTone(tone)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                      selectedTone === tone
                        ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
                        : "bg-white/[0.06] text-white/50 hover:text-white/70 hover:bg-white/[0.1]"
                    )}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Platform</Label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((platform) => (
                  <button
                    key={platform}
                    onClick={() => setSelectedPlatform(platform)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                      selectedPlatform === platform
                        ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
                        : "bg-white/[0.06] text-white/50 hover:text-white/70 hover:bg-white/[0.1]"
                    )}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between pt-4 max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => setCurrentStep(2)}
          className="text-white/60 hover:text-white gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          onClick={() => setCurrentStep(4)}
          disabled={!productName.trim()}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white gap-2"
        >
          Next: Generate Video
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  // ── Step 4: Generate Video ────────────────────────────────────

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Generate Your Video</h2>
        <p className="text-white/50 text-sm">
          Review your selections and generate the final avatar video
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Summary & Generate */}
        <div className="space-y-5">
          {/* Subscription Check */}
          {subscription && subscription.plan === "free" && (
            <Card className="bg-orange-500/[0.05] border-orange-500/20 rounded-2xl">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5 text-orange-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-white">
                    Subscribe to generate videos
                  </p>
                  <p className="text-xs text-white/50">
                    Avatar creation is free, but video generation requires a subscription.
                  </p>
                  <Link to="/pricing">
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white gap-1.5 mt-1"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      View Plans
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Usage Info */}
          {subscription && subscription.plan !== "free" && (
            <Card className="bg-white/[0.03] border-white/[0.06] rounded-2xl">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Video className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">
                      {subscription.videosLimit - subscription.videosUsed} videos remaining
                    </p>
                    <p className="text-xs text-white/40">
                      {subscription.videosUsed}/{subscription.videosLimit} used this month
                    </p>
                  </div>
                </div>
                <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 capitalize">
                  {subscription.plan}
                </Badge>
              </CardContent>
            </Card>
          )}

          {/* Summary Card */}
          <Card className="bg-white/[0.03] border-white/[0.06] rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                <span className="text-xs text-white/50">Avatar</span>
                <div className="flex items-center gap-2">
                  {selectedAvatar?.photoUrls?.[0] && (
                    <div className="w-6 h-6 rounded-full overflow-hidden">
                      <img src={selectedAvatar.photoUrls[0]} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <span className="text-sm text-white font-medium">
                    {selectedAvatar?.name}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                <span className="text-xs text-white/50">Template</span>
                <span className="text-sm text-white font-medium">
                  {selectedTemplate?.name}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                <span className="text-xs text-white/50">Product</span>
                <span className="text-sm text-white font-medium">{productName}</span>
              </div>
              {productImagePreview && (
                <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                  <span className="text-xs text-white/50">Product Photo</span>
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10">
                    <img
                      src={productImagePreview}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                <span className="text-xs text-white/50">Tone</span>
                <Badge className="bg-white/[0.06] text-white/60 border-0 text-xs">
                  {selectedTone}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-white/50">Platform</span>
                <Badge className="bg-purple-500/10 text-purple-400 border-0 text-xs">
                  {selectedPlatform}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Generate Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleGenerateVideo}
              disabled={isGenerating || !canProceedToGenerate}
              className="flex-1 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white gap-2 text-base rounded-xl"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {generationStep || "Generating..."}
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Render Final Video
                </>
              )}
            </Button>
            <Button
              onClick={handleGenerateHooks}
              disabled={isGenerating || !productName.trim()}
              variant="outline"
              className="border-white/[0.1] text-white/70 hover:text-white hover:bg-white/[0.06] gap-2"
            >
              <Zap className="w-4 h-4" />
              Hooks
            </Button>
          </div>

          {/* Generated Hooks */}
          {generatedHooks && (
            <Card className="bg-white/[0.03] border-white/[0.06] rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  Generated Hooks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {generatedHooks.map((hook, i) => (
                    <div
                      key={i}
                      className="bg-white/[0.04] rounded-lg px-3 py-2 text-sm text-white/70 border border-white/[0.06]"
                    >
                      <span className="text-purple-400 font-semibold mr-2">
                        {i + 1}.
                      </span>
                      {hook}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Preview Panel */}
        <div className="space-y-4">
          <Card className="bg-white/[0.03] border-white/[0.06] rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Play className="w-4 h-4 text-purple-400" />
                Video Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              {generatedVideoUrl ? (
                <video
                  src={generatedVideoUrl}
                  className="w-[280px] aspect-[9/16] rounded-xl bg-black object-cover"
                  controls
                  autoPlay
                  loop
                  playsInline
                />
              ) : generatedScript ? (
                <VideoPlayer
                  templateId={mapTemplateToComposition(selectedTemplate?.id || "") || "ProductShowcase"}
                  props={{
                    avatarUrl: selectedAvatar?.photoUrls?.[0],
                    avatarName: selectedAvatar?.name || "Creator",
                    productImageUrl: productImagePreview || undefined,
                    productName,
                    hook: generatedScript.hook,
                    script: generatedScript.script,
                    cta: generatedScript.cta,
                    captions: generatedScript.captions,
                    brandColor: "#8b5cf6",
                    platform: selectedPlatform as VideoProps["platform"],
                    tone: selectedTone,
                  }}
                  width={280}
                  />
              ) : isGenerating ? (
                <div className="w-[280px] aspect-[9/16] bg-zinc-900 rounded-xl flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                  <p className="text-white/50 text-xs">
                    {generationStep || "Generating..."}
                  </p>
                </div>
              ) : (
                <div className="w-[280px] aspect-[9/16] bg-zinc-900 rounded-xl flex flex-col items-center justify-center">
                  <Video className="w-10 h-10 text-white/10 mb-3" />
                  <p className="text-white/30 text-xs">
                    Click "Create Video" to generate
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Script details (collapsed) */}
          {generatedScript && (
            <Card className="bg-white/[0.03] border-white/[0.06] rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm">Generated Script</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-48">
                  <div className="space-y-3">
                    <div className="bg-purple-500/20 rounded-lg px-3 py-2 border border-purple-500/30">
                      <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider mb-1">Hook</p>
                      <p className="text-white text-xs">{generatedScript.hook}</p>
                    </div>
                    <p className="text-white/70 text-xs leading-relaxed whitespace-pre-line">
                      {generatedScript.script}
                    </p>
                    <div className="bg-indigo-500/20 rounded-lg px-3 py-2 border border-indigo-500/30">
                      <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider mb-1">CTA</p>
                      <p className="text-white text-xs">{generatedScript.cta}</p>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Export Buttons */}
          {generatedScript && (
            <div className="flex gap-3">
              <Button
                onClick={async () => {
                  if (generatedVideoUrl) {
                    window.open(generatedVideoUrl, "_blank");
                    return;
                  }

                  if (!functions) {
                    toast.error("Cloud Functions not initialized");
                    return;
                  }

                  const compositionId = mapTemplateToComposition(selectedTemplate?.id || "") || "ProductShowcase";
                  const videoProps: VideoProps = {
                    avatarUrl: selectedAvatar?.photoUrls?.[0],
                    avatarName: selectedAvatar?.name || "Creator",
                    productImageUrl: productImagePreview || undefined,
                    productName,
                    hook: generatedScript.hook,
                    script: generatedScript.script,
                    cta: generatedScript.cta,
                    captions: generatedScript.captions,
                    brandColor: "#8b5cf6",
                    platform: selectedPlatform as VideoProps["platform"],
                    tone: selectedTone,
                  };

                  setIsGenerating(true);
                  setGenerationStep("Rendering video...");

                  try {
                    const result = await renderVideo({
                      templateId: compositionId,
                      props: videoProps,
                    });

                    if (result.videoUrl) {
                      toast.success("Video rendered successfully!");
                      window.open(result.videoUrl, "_blank");
                    }
                  } catch (err: any) {
                    console.error("Render error:", err);
                    // Fallback: export as project file
                    toast.info("Server rendering unavailable. Exporting project file instead.");
                    exportVideoMetadata(compositionId, videoProps);
                  } finally {
                    setIsGenerating(false);
                    setGenerationStep("");
                  }
                }}
                disabled={isGenerating}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white gap-2 h-12 rounded-xl"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isGenerating ? "Rendering..." : generatedVideoUrl ? "Open Video" : "Export Video"}
              </Button>
              <Button
                onClick={() => {
                  const compositionId = mapTemplateToComposition(selectedTemplate?.id || "") || "ProductShowcase";
                  exportVideoMetadata(compositionId, {
                    avatarUrl: selectedAvatar?.photoUrls?.[0],
                    avatarName: selectedAvatar?.name || "Creator",
                    productImageUrl: productImagePreview || undefined,
                    productName,
                    hook: generatedScript.hook,
                    script: generatedScript.script,
                    cta: generatedScript.cta,
                    captions: generatedScript.captions,
                    brandColor: "#8b5cf6",
                    platform: selectedPlatform as VideoProps["platform"],
                    tone: selectedTone,
                  });
                  toast.success("Project file downloaded!");
                }}
                variant="outline"
                className="border-white/[0.1] text-white/70 hover:text-white hover:bg-white/[0.06] gap-2 h-12 rounded-xl"
              >
                <FileDown className="w-4 h-4" />
                Project
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-start pt-2">
        <Button
          variant="ghost"
          onClick={() => setCurrentStep(3)}
          className="text-white/60 hover:text-white gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Video Creator
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Create scroll-stopping UGC videos with your AI avatar
          </p>
        </div>

        {/* Subscription Banner for Free Users */}
        {subscription && subscription.plan === "free" && !loadingAvatars && avatars.length > 0 && (
          <Card className="bg-orange-500/[0.05] border-orange-500/20 rounded-2xl mb-6">
            <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-white">
                  Subscribe to generate videos
                </p>
                <p className="text-xs text-white/50">
                  You can browse templates and configure everything, but video generation requires a paid plan.
                </p>
              </div>
              <Link to="/pricing">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white gap-1.5 whitespace-nowrap"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  View Plans
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {renderProgress()}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </div>
    </div>
  );
}
