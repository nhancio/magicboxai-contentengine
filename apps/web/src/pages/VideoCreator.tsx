import { useState, useRef, useEffect } from"react";
import { Link } from"react-router-dom";
import { toast } from"sonner";
import { functions, storage } from"@shared/lib/firebase";
import { httpsCallable } from"firebase/functions";
import { ref, uploadBytes, getDownloadURL } from"firebase/storage";
import { useAuth } from"@shared/lib/auth";
import { Button } from"@shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from"@shared/components/ui/card";
import { Badge } from"@shared/components/ui/badge";
import { Input } from"@shared/components/ui/input";
import { Label } from"@shared/components/ui/label";
import { Textarea } from"@shared/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@shared/components/ui/tabs";
import { ScrollArea } from"@shared/components/ui/scroll-area";
import {
 getPhotoAvatars,
 type PhotoAvatarRecord,
 saveVideo,
 getUserSubscription,
 type SubscriptionRecord,
} from"@shared/lib/firestore";
import {
 VIRAL_TEMPLATES,
 TEMPLATE_CATEGORIES,
 type ViralTemplate,
} from"@shared/lib/templates";
import {
 generateScript,
 generateHooks,
 analyzeProductPhoto,
} from"@shared/lib/gemini";
import { cn } from"@shared/lib/utils";
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
} from"lucide-react";
import {
 VideoPlayer,
 mapTemplateToComposition,
 exportVideoMetadata,
 renderVideo,
 type VideoProps,
 type TemplateId,
} from"../remotion";

const TONES = ["Funny","Bold","Aesthetic","Storytelling","Problem-Solution"] as const;
const PLATFORMS = ["TikTok","Instagram Reels","YouTube Shorts"] as const;
const STEP_LABELS = ["Choose Avatar","Choose Template","Product Details","Generate Video"] as const;

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
 const [userPrompt, setUserPrompt] = useState("");
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
 .catch(() => setSubscription({ plan:"free", videosUsed: 0, videosLimit: 0 }));
 }, [user]);

 const filteredTemplates =
 activeCategory ==="All"
 ? VIRAL_TEMPLATES
 : VIRAL_TEMPLATES.filter((t) => t.category === activeCategory);

 // Auto-select Product Explanation template
 useEffect(() => {
 const productExplanation = VIRAL_TEMPLATES.find(
 (t) => t.id ==="template-product-explanation"
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
 if (subscription && subscription.plan ==="free") {
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
 const safeName = productImage.name.replace(/\s+/g,"-");
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
 productDescription: productDescription || productPhotoAnalysis ||"",
 templateName: selectedTemplate.name,
 avatarPersonality: selectedAvatar.personality,
 tone: selectedTone,
 platform: selectedPlatform,
 productPhotoAnalysis,
 userPrompt,
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
 productDescription: productDescription ||"",
 productImageUrl,
 script: result.script,
 hookLine: result.hook,
 captions: result.captions,
 cta: result.cta,
 platform: selectedPlatform,
 tone: selectedTone,
 status:"queued",
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
 >(functions,"generateUGCVideo");

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
 productDescription: productDescription ||"",
 productImageAnalysis: productPhotoAnalysis,
 });

 setGeneratedVideoUrl(videoResult.data.videoUrl);
 if (subscription) {
 setSubscription({ ...subscription, videosUsed: subscription.videosUsed + 1 });
 }

 setVideoSaved(true);
 toast.success("Video generated successfully!");
 } catch (err) {
 const message = err instanceof Error ? err.message :"Failed to generate video";
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
 subscription && subscription.plan !=="free" && subscription.videosUsed < subscription.videosLimit;

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
 className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
 isComplete
 ?"bg-brand text-foreground"
 : isActive
 ?"bg-brand text-foreground ring-4 ring-ring/20"
 :"bg-card/[0.06] text-muted-foreground border border-border/[0.08]"
 )}
 >
 {isComplete ? <Check className="w-4 h-4" /> : step}
 </div>
 <span
 className={cn("text-xs font-medium transition-colors whitespace-nowrap",
 isActive ?"text-foreground" :"text-muted-foreground"
 )}
 >
 {label}
 </span>
 </div>
 {i < STEP_LABELS.length - 1 && (
 <div
 className={cn("w-16 sm:w-24 h-px mx-2 sm:mx-4 mb-6 transition-colors",
 isComplete ?"bg-brand" :"bg-card/[0.08]"
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
 <h2 className="text-2xl font-bold text-foreground">Choose Your Avatar</h2>
 <p className="text-muted-foreground text-sm">
 Select the avatar that will appear in your video
 </p>
 </div>

 {loadingAvatars ? (
 <div className="flex justify-center py-12">
 <Loader2 className="w-8 h-8 text-brand animate-spin" />
 </div>
 ) : avatars.length === 0 ? (
 <Card className="bg-card/[0.03] border-border/[0.06] rounded-2xl">
 <CardContent className="p-12 text-center space-y-4">
 <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
 <Camera className="w-8 h-8 text-muted-foreground" />
 </div>
 <div className="space-y-2">
 <h3 className="text-lg font-semibold text-foreground">
 No avatars yet
 </h3>
 <p className="text-muted-foreground text-sm max-w-md mx-auto">
 You need to create an avatar first — upload photos, upload a video, or record yourself live.
 Avatar creation is free!
 </p>
 </div>
 <Link to="/avatars">
 <Button className="bg-brand hover: hover: text-foreground gap-2 mt-2">
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
 .filter((a) => a.status ==="ready")
 .map((avatar) => {
 const isSelected = selectedAvatar?.id === avatar.id;
 return (
 <button
 key={avatar.id}
 onClick={() => setSelectedAvatar(avatar)}
 className={cn("text-left rounded-2xl p-5 transition-all duration-200 cursor-pointer","bg-card/[0.03] border hover:bg-card/[0.06]",
 isSelected
 ?"border-brand ring-2 ring-ring/20 bg-brand/[0.06]"
 :"border-border/[0.06]"
 )}
 >
 <div className="flex items-start gap-4">
 <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-border shrink-0">
 {avatar.photoUrls?.[0] ? (
 <img
 src={avatar.photoUrls[0]}
 alt={avatar.name}
 className="w-full h-full object-cover"
 />
 ) : (
 <div className="w-full h-full bg-brand flex items-center justify-center text-foreground font-bold">
 {avatar.name[0]}
 </div>
 )}
 </div>
 <div className="min-w-0 space-y-1">
 <h3 className="font-semibold text-foreground text-sm">
 {avatar.name}
 </h3>
 <p className="text-xs text-brand font-medium">
 {avatar.personality}
 </p>
 <p className="text-xs text-muted-foreground line-clamp-2">
 {avatar.description}
 </p>
 </div>
 </div>
 </button>
 );
 })}
 </div>

 <div className="flex items-center justify-between pt-4">
 <Link to="/avatars?tab=create">
 <Button
 variant="ghost"
 className="text-brand hover:text-brand hover:bg-brand/10 gap-2"
 >
 <Camera className="w-4 h-4" />
 Create New Avatar
 </Button>
 </Link>
 <Button
 onClick={() => setCurrentStep(2)}
 disabled={!selectedAvatar}
 className="bg-brand hover: hover: text-foreground gap-2"
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
 <h2 className="text-2xl font-bold text-foreground">Choose a Template</h2>
 <p className="text-muted-foreground text-sm">
 Pick a video format —"Product Explanation" is recommended for product videos
 </p>
 </div>

 <Tabs value={activeCategory} onValueChange={setActiveCategory}>
 <TabsList className="bg-card/[0.04] border border-border/[0.06] p-1 flex flex-wrap h-auto gap-1">
 {TEMPLATE_CATEGORIES.map((cat) => (
 <TabsTrigger
 key={cat}
 value={cat}
 className="text-xs data-[state=active]:bg-brand data-[state=active]:text-foreground"
 >
 {cat}
 </TabsTrigger>
 ))}
 </TabsList>

 <TabsContent value={activeCategory} className="mt-4">
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {filteredTemplates.map((template) => {
 const isSelected = selectedTemplate?.id === template.id;
 const isRecommended = template.id ==="template-product-explanation";
 return (
 <button
 key={template.id}
 onClick={() => setSelectedTemplate(template)}
 className={cn("text-left rounded-2xl p-5 transition-all duration-200 cursor-pointer relative","bg-card/[0.03] border hover:bg-card/[0.06]",
 isSelected
 ?"border-brand ring-2 ring-ring/20 bg-brand/[0.06]"
 : isRecommended
 ?"border-orange-500/30 bg-orange-500/[0.03]"
 :"border-border/[0.06]"
 )}
 >
 {isRecommended && (
 <Badge className="absolute -top-2 right-3 bg-orange-500 text-foreground border-0 text-[10px] px-2">
 Recommended
 </Badge>
 )}
 <div className="flex items-center gap-3 mb-3">
 <div
 className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
 `bg-brand ${template.gradient}`
 )}
 >
 <Video className="w-4 h-4 text-foreground" />
 </div>
 <h3 className="font-semibold text-foreground text-sm">{template.name}</h3>
 </div>
 <p className="text-xs text-brand/70 italic mb-2 line-clamp-1">
 &ldquo;{template.hookLine}&rdquo;
 </p>
 <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
 {template.description}
 </p>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1.5">
 <Badge
 variant="secondary"
 className="text-[10px] bg-card/[0.06] text-muted-foreground border-0 px-2 py-0.5"
 >
 {template.tone.split(",")[0]}
 </Badge>
 </div>
 <span className="text-[10px] text-muted-foreground flex items-center gap-1">
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
 className="text-muted-foreground hover:text-foreground gap-2"
 >
 <ArrowLeft className="w-4 h-4" />
 Back
 </Button>
 <Button
 onClick={() => setCurrentStep(3)}
 disabled={!selectedTemplate}
 className="bg-brand hover: hover: text-foreground gap-2"
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
 <h2 className="text-2xl font-bold text-foreground">Add Product Details</h2>
 <p className="text-muted-foreground text-sm">
 Upload your product photo and tell us about it
 </p>
 </div>

 <div className="max-w-2xl mx-auto space-y-5">
 {/* Product Photo Upload */}
 <Card className="bg-card/[0.03] border-border/[0.06] rounded-2xl">
 <CardHeader className="pb-4">
 <CardTitle className="text-foreground text-base flex items-center gap-2">
 <ImagePlus className="w-4 h-4 text-brand" />
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
 <div className="relative rounded-xl overflow-hidden border border-border">
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
 <X className="w-4 h-4 text-foreground" />
 </button>
 </div>
 ) : (
 <button
 onClick={() => fileInputRef.current?.click()}
 className={cn("w-full rounded-xl border-2 border-dashed p-8 transition-colors","border-border/[0.08] hover:border-brand/40 hover:bg-brand/[0.03]","flex flex-col items-center gap-3 cursor-pointer"
 )}
 >
 <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center">
 <Upload className="w-7 h-7 text-brand" />
 </div>
 <div className="text-center">
 <p className="text-sm text-muted-foreground font-medium">
 Upload your product photo
 </p>
 <p className="text-xs text-muted-foreground mt-1">
 AI will analyze it to generate an accurate script
 </p>
 </div>
 </button>
 )}
 </CardContent>
 </Card>

 {/* Creative Brief */}
 <Card className="bg-card/[0.03] border-border/[0.06] rounded-2xl">
 <CardHeader className="pb-4">
 <CardTitle className="text-foreground text-base flex items-center gap-2">
 <Sparkles className="w-4 h-4 text-brand" />
 What should your avatar say?
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-2">
 <Textarea
 value={userPrompt}
 onChange={(e) => setUserPrompt(e.target.value)}
 placeholder='e.g. "Talk about how this serum cleared my skin in 2 weeks" — a rough idea is enough'
 rows={3}
 className="bg-card/[0.04] border-border/[0.08] text-foreground placeholder:text-muted-foreground resize-none"
 />
 <p className="text-xs text-muted-foreground">
 Give a short prompt and AI will expand it into a full, detailed script your avatar speaks while presenting the product.
 </p>
 </CardContent>
 </Card>

 {/* Product Info */}
 <Card className="bg-card/[0.03] border-border/[0.06] rounded-2xl">
 <CardHeader className="pb-4">
 <CardTitle className="text-foreground text-base">Product Info</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label className="text-foreground text-sm">Product Name *</Label>
 <Input
 value={productName}
 onChange={(e) => setProductName(e.target.value)}
 placeholder="e.g. GlowSerum Pro, Nike Air Max, iPhone Case..."
 className="bg-card/[0.04] border-border/[0.08] text-foreground placeholder:text-muted-foreground h-11"
 />
 </div>
 <div className="space-y-2">
 <Label className="text-foreground text-sm">
 Product Description{""}
 <span className="text-muted-foreground">(optional if photo uploaded)</span>
 </Label>
 <Textarea
 value={productDescription}
 onChange={(e) => setProductDescription(e.target.value)}
 placeholder="Describe your product, its key benefits, target audience..."
 rows={3}
 className="bg-card/[0.04] border-border/[0.08] text-foreground placeholder:text-muted-foreground resize-none"
 />
 </div>

 {/* Tone */}
 <div className="space-y-2">
 <Label className="text-foreground text-sm">Tone</Label>
 <div className="flex flex-wrap gap-2">
 {TONES.map((tone) => (
 <button
 key={tone}
 onClick={() => setSelectedTone(tone)}
 className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all",
 selectedTone === tone
 ?"bg-brand text-foreground"
 :"bg-card/[0.06] text-muted-foreground hover:text-foreground hover:bg-card/[0.1]"
 )}
 >
 {tone}
 </button>
 ))}
 </div>
 </div>

 {/* Platform */}
 <div className="space-y-2">
 <Label className="text-foreground text-sm">Platform</Label>
 <div className="flex flex-wrap gap-2">
 {PLATFORMS.map((platform) => (
 <button
 key={platform}
 onClick={() => setSelectedPlatform(platform)}
 className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all",
 selectedPlatform === platform
 ?"bg-brand text-foreground"
 :"bg-card/[0.06] text-muted-foreground hover:text-foreground hover:bg-card/[0.1]"
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
 className="text-muted-foreground hover:text-foreground gap-2"
 >
 <ArrowLeft className="w-4 h-4" />
 Back
 </Button>
 <Button
 onClick={() => setCurrentStep(4)}
 disabled={!productName.trim()}
 className="bg-brand hover: hover: text-foreground gap-2"
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
 <h2 className="text-2xl font-bold text-foreground">Generate Your Video</h2>
 <p className="text-muted-foreground text-sm">
 Review your selections and generate the final avatar video
 </p>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Left: Summary & Generate */}
 <div className="space-y-5">
 {/* Subscription Check */}
 {subscription && subscription.plan ==="free" && (
 <Card className="bg-orange-500/[0.05] border-orange-500/20 rounded-2xl">
 <CardContent className="p-5 flex items-start gap-4">
 <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
 <Crown className="w-5 h-5 text-orange-400" />
 </div>
 <div className="space-y-2">
 <p className="text-sm font-medium text-foreground">
 Subscribe to generate videos
 </p>
 <p className="text-xs text-muted-foreground">
 Avatar creation is free, but video generation requires a subscription.
 </p>
 <Link to="/pricing">
 <Button
 size="sm"
 className="bg-brand from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-foreground gap-1.5 mt-1"
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
 {subscription && subscription.plan !=="free" && (
 <Card className="bg-card/[0.03] border-border/[0.06] rounded-2xl">
 <CardContent className="p-4 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
 <Video className="w-4 h-4 text-brand" />
 </div>
 <div>
 <p className="text-sm text-foreground font-medium">
 {subscription.videosLimit - subscription.videosUsed} videos remaining
 </p>
 <p className="text-xs text-muted-foreground">
 {subscription.videosUsed}/{subscription.videosLimit} used this month
 </p>
 </div>
 </div>
 <Badge className="bg-brand/10 text-brand border-brand/20 capitalize">
 {subscription.plan}
 </Badge>
 </CardContent>
 </Card>
 )}

 {/* Summary Card */}
 <Card className="bg-card/[0.03] border-border/[0.06] rounded-2xl">
 <CardHeader className="pb-3">
 <CardTitle className="text-foreground text-base">Summary</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="flex items-center justify-between py-2 border-b border-border/[0.06]">
 <span className="text-xs text-muted-foreground">Avatar</span>
 <div className="flex items-center gap-2">
 {selectedAvatar?.photoUrls?.[0] && (
 <div className="w-6 h-6 rounded-full overflow-hidden">
 <img src={selectedAvatar.photoUrls[0]} alt="" className="w-full h-full object-cover" />
 </div>
 )}
 <span className="text-sm text-foreground font-medium">
 {selectedAvatar?.name}
 </span>
 </div>
 </div>
 <div className="flex items-center justify-between py-2 border-b border-border/[0.06]">
 <span className="text-xs text-muted-foreground">Template</span>
 <span className="text-sm text-foreground font-medium">
 {selectedTemplate?.name}
 </span>
 </div>
 <div className="flex items-center justify-between py-2 border-b border-border/[0.06]">
 <span className="text-xs text-muted-foreground">Product</span>
 <span className="text-sm text-foreground font-medium">{productName}</span>
 </div>
 {productImagePreview && (
 <div className="flex items-center justify-between py-2 border-b border-border/[0.06]">
 <span className="text-xs text-muted-foreground">Product Photo</span>
 <div className="w-10 h-10 rounded-lg overflow-hidden border border-border">
 <img
 src={productImagePreview}
 alt=""
 className="w-full h-full object-cover"
 />
 </div>
 </div>
 )}
 <div className="flex items-center justify-between py-2 border-b border-border/[0.06]">
 <span className="text-xs text-muted-foreground">Tone</span>
 <Badge className="bg-card/[0.06] text-muted-foreground border-0 text-xs">
 {selectedTone}
 </Badge>
 </div>
 <div className="flex items-center justify-between py-2">
 <span className="text-xs text-muted-foreground">Platform</span>
 <Badge className="bg-brand/10 text-brand border-0 text-xs">
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
 className="flex-1 h-12 bg-brand hover: hover: text-foreground gap-2 text-base rounded-xl"
 >
 {isGenerating ? (
 <>
 <Loader2 className="w-5 h-5 animate-spin" />
 {generationStep ||"Generating..."}
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
 className="border-border/[0.1] text-foreground hover:text-foreground hover:bg-card/[0.06] gap-2"
 >
 <Zap className="w-4 h-4" />
 Hooks
 </Button>
 </div>

 {/* Generated Hooks */}
 {generatedHooks && (
 <Card className="bg-card/[0.03] border-border/[0.06] rounded-2xl">
 <CardHeader className="pb-3">
 <CardTitle className="text-foreground text-sm flex items-center gap-2">
 <Zap className="w-4 h-4 text-brand" />
 Generated Hooks
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 {generatedHooks.map((hook, i) => (
 <div
 key={i}
 className="bg-card/[0.04] rounded-lg px-3 py-2 text-sm text-foreground border border-border/[0.06]"
 >
 <span className="text-brand font-semibold mr-2">
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
 <Card className="bg-card/[0.03] border-border/[0.06] rounded-2xl">
 <CardHeader className="pb-3">
 <CardTitle className="text-foreground text-base flex items-center gap-2">
 <Play className="w-4 h-4 text-brand" />
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
 templateId={mapTemplateToComposition(selectedTemplate?.id ||"") ||"ProductShowcase"}
 props={{
 avatarUrl: selectedAvatar?.photoUrls?.[0],
 avatarName: selectedAvatar?.name ||"Creator",
 productImageUrl: productImagePreview || undefined,
 productName,
 hook: generatedScript.hook,
 script: generatedScript.script,
 cta: generatedScript.cta,
 captions: generatedScript.captions,
 brandColor:"#8b5cf6",
 platform: selectedPlatform as VideoProps["platform"],
 tone: selectedTone,
 }}
 width={280}
 />
 ) : isGenerating ? (
 <div className="w-[280px] aspect-[9/16] bg-card rounded-xl flex flex-col items-center justify-center gap-3">
 <Loader2 className="w-8 h-8 text-brand animate-spin" />
 <p className="text-muted-foreground text-xs">
 {generationStep ||"Generating..."}
 </p>
 </div>
 ) : (
 <div className="w-[280px] aspect-[9/16] bg-card rounded-xl flex flex-col items-center justify-center">
 <Video className="w-10 h-10 text-muted-foreground mb-3" />
 <p className="text-muted-foreground text-xs">
 Click"Create Video" to generate
 </p>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Script details (collapsed) */}
 {generatedScript && (
 <Card className="bg-card/[0.03] border-border/[0.06] rounded-2xl">
 <CardHeader className="pb-3">
 <CardTitle className="text-foreground text-sm">Generated Script</CardTitle>
 </CardHeader>
 <CardContent>
 <ScrollArea className="max-h-48">
 <div className="space-y-3">
 <div className="bg-brand/20 rounded-lg px-3 py-2 border border-brand/30">
 <p className="text-[10px] text-brand font-semibold uppercase tracking-wider mb-1">Hook</p>
 <p className="text-foreground text-xs">{generatedScript.hook}</p>
 </div>
 <p className="text-foreground text-xs leading-relaxed whitespace-pre-line">
 {generatedScript.script}
 </p>
 <div className="bg-brand/20 rounded-lg px-3 py-2 border border-brand/30">
 <p className="text-[10px] text-brand font-semibold uppercase tracking-wider mb-1">CTA</p>
 <p className="text-foreground text-xs">{generatedScript.cta}</p>
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
 window.open(generatedVideoUrl,"_blank");
 return;
 }

 if (!functions) {
 toast.error("Cloud Functions not initialized");
 return;
 }

 const compositionId = mapTemplateToComposition(selectedTemplate?.id ||"") ||"ProductShowcase";
 const videoProps: VideoProps = {
 avatarUrl: selectedAvatar?.photoUrls?.[0],
 avatarName: selectedAvatar?.name ||"Creator",
 productImageUrl: productImagePreview || undefined,
 productName,
 hook: generatedScript.hook,
 script: generatedScript.script,
 cta: generatedScript.cta,
 captions: generatedScript.captions,
 brandColor:"#8b5cf6",
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
 window.open(result.videoUrl,"_blank");
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
 className="flex-1 bg-brand hover: hover: text-foreground gap-2 h-12 rounded-xl"
 >
 {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
 {isGenerating ?"Rendering..." : generatedVideoUrl ?"Open Video" :"Export Video"}
 </Button>
 <Button
 onClick={() => {
 const compositionId = mapTemplateToComposition(selectedTemplate?.id ||"") ||"ProductShowcase";
 exportVideoMetadata(compositionId, {
 avatarUrl: selectedAvatar?.photoUrls?.[0],
 avatarName: selectedAvatar?.name ||"Creator",
 productImageUrl: productImagePreview || undefined,
 productName,
 hook: generatedScript.hook,
 script: generatedScript.script,
 cta: generatedScript.cta,
 captions: generatedScript.captions,
 brandColor:"#8b5cf6",
 platform: selectedPlatform as VideoProps["platform"],
 tone: selectedTone,
 });
 toast.success("Project file downloaded!");
 }}
 variant="outline"
 className="border-border/[0.1] text-foreground hover:text-foreground hover:bg-card/[0.06] gap-2 h-12 rounded-xl"
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
 className="text-muted-foreground hover:text-foreground gap-2"
 >
 <ArrowLeft className="w-4 h-4" />
 Back
 </Button>
 </div>
 </div>
 );

 // ── Render ────────────────────────────────────────────────────

 return (
 <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
 <div className="max-w-6xl mx-auto">
 <div className="text-center mb-8">
 <h1 className="text-3xl font-bold text-foreground tracking-tight">
 Video Creator
 </h1>
 <p className="text-muted-foreground text-sm mt-1">
 Create scroll-stopping UGC videos with your AI avatar
 </p>
 </div>

 {/* Subscription Banner for Free Users */}
 {subscription && subscription.plan ==="free" && !loadingAvatars && avatars.length > 0 && (
 <Card className="bg-orange-500/[0.05] border-orange-500/20 rounded-2xl mb-6">
 <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
 <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
 <Crown className="w-5 h-5 text-orange-400" />
 </div>
 <div className="flex-1 space-y-1">
 <p className="text-sm font-medium text-foreground">
 Subscribe to generate videos
 </p>
 <p className="text-xs text-muted-foreground">
 You can browse templates and configure everything, but video generation requires a paid plan.
 </p>
 </div>
 <Link to="/pricing">
 <Button
 size="sm"
 className="bg-brand from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-foreground gap-1.5 whitespace-nowrap"
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
