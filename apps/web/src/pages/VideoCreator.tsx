import { useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Badge } from "@shared/components/ui/badge";
import { Input } from "@shared/components/ui/input";
import { Label } from "@shared/components/ui/label";
import { Textarea } from "@shared/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/components/ui/tabs";
import { ScrollArea } from "@shared/components/ui/scroll-area";
import { PREBUILT_AVATARS, type PrebuiltAvatar } from "@shared/lib/avatars";
import {
  VIRAL_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type ViralTemplate,
} from "@shared/lib/templates";
import { generateScript, generateHooks } from "@shared/lib/gemini";
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
} from "lucide-react";

const TONES = ["Funny", "Bold", "Aesthetic", "Storytelling", "Problem-Solution"] as const;
const PLATFORMS = ["TikTok", "Instagram Reels", "YouTube Shorts"] as const;

const STEP_LABELS = ["Choose Avatar", "Choose Template", "Generate Video"] as const;

export default function VideoCreator() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedAvatar, setSelectedAvatar] = useState<PrebuiltAvatar | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ViralTemplate | null>(null);
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [selectedTone, setSelectedTone] = useState<string>("Bold");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("TikTok");
  const [generatedScript, setGeneratedScript] = useState<{
    hook: string;
    script: string;
    cta: string;
    captions: string[];
  } | null>(null);
  const [generatedHooks, setGeneratedHooks] = useState<string[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [productImages, setProductImages] = useState<File[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Handlers ──────────────────────────────────────────────────

  const handleGenerateScript = async () => {
    if (!productName.trim()) {
      toast.error("Please enter a product name");
      return;
    }
    if (!selectedAvatar || !selectedTemplate) return;

    setIsGenerating(true);
    try {
      const result = await generateScript({
        productName,
        productDescription,
        templateName: selectedTemplate.name,
        avatarPersonality: selectedAvatar.personality,
        tone: selectedTone,
        platform: selectedPlatform,
      });
      setGeneratedScript(result);
      toast.success("Script generated successfully!");
    } catch {
      toast.error("Failed to generate script. Please try again.");
    } finally {
      setIsGenerating(false);
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setProductImages((prev) => [...prev, ...Array.from(files)]);
  };

  const removeImage = (index: number) => {
    setProductImages((prev) => prev.filter((_, i) => i !== index));
  };

  const filteredTemplates =
    activeCategory === "All"
      ? VIRAL_TEMPLATES
      : VIRAL_TEMPLATES.filter((t) => t.category === activeCategory);

  // ── Progress Bar ──────────────────────────────────────────────

  const renderProgress = () => (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEP_LABELS.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3;
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
                  "w-24 h-px mx-4 mb-6 transition-colors",
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
        <h2 className="text-2xl font-bold text-white">Choose Your AI Avatar</h2>
        <p className="text-white/50 text-sm">
          Select the personality that best represents your brand voice
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PREBUILT_AVATARS.map((avatar) => {
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
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0",
                    `bg-gradient-to-br ${avatar.gradient}`
                  )}
                >
                  {avatar.emoji}
                </div>
                <div className="min-w-0 space-y-1">
                  <h3 className="font-semibold text-white text-sm">{avatar.name}</h3>
                  <p className="text-xs text-purple-400 font-medium">
                    {avatar.personality}
                  </p>
                </div>
              </div>
              <p className="text-xs text-white/40 mt-3 line-clamp-2">
                {avatar.description}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {avatar.useCases.slice(0, 3).map((uc) => (
                  <Badge
                    key={uc}
                    variant="secondary"
                    className="text-[10px] bg-white/[0.06] text-white/50 border-0 px-2 py-0.5"
                  >
                    {uc}
                  </Badge>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end pt-4">
        <Button
          onClick={() => setCurrentStep(2)}
          disabled={!selectedAvatar}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white gap-2"
        >
          Next: Choose Template
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  // ── Step 2: Choose Template ───────────────────────────────────

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Choose a Viral Template</h2>
        <p className="text-white/50 text-sm">
          Pick a proven format that drives views and conversions
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
              return (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={cn(
                    "text-left rounded-2xl p-5 transition-all duration-200 cursor-pointer",
                    "bg-white/[0.03] border hover:bg-white/[0.06]",
                    isSelected
                      ? "border-purple-500 ring-2 ring-purple-500/20 bg-purple-500/[0.06]"
                      : "border-white/[0.06]"
                  )}
                >
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
                      {template.platform.slice(0, 2).map((p) => (
                        <Badge
                          key={p}
                          variant="secondary"
                          className="text-[10px] bg-purple-500/10 text-purple-400 border-0 px-2 py-0.5"
                        >
                          {p}
                        </Badge>
                      ))}
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
          Next: Generate Video
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  // ── Step 3: Generate Video ────────────────────────────────────

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Generate Your Video</h2>
        <p className="text-white/50 text-sm">
          Enter your product details and let AI create the script
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Product Details */}
        <div className="space-y-5">
          <Card className="bg-white/[0.03] border-white/[0.06] rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-white text-base">Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/70 text-sm">Product Name</Label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. GlowSerum Pro"
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/70 text-sm">Product Description</Label>
                <Textarea
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Describe your product, its key benefits, target audience..."
                  rows={3}
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 resize-none"
                />
              </div>

              {/* Image Upload Drop Zone */}
              <div className="space-y-2">
                <Label className="text-white/70 text-sm">Upload Product Images</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "w-full rounded-xl border-2 border-dashed p-6 transition-colors",
                    "border-white/[0.08] hover:border-purple-500/40 hover:bg-purple-500/[0.03]",
                    "flex flex-col items-center gap-2 cursor-pointer"
                  )}
                >
                  <Upload className="w-6 h-6 text-white/30" />
                  <span className="text-xs text-white/40">
                    Click to upload or drag and drop
                  </span>
                  <span className="text-[10px] text-white/25">
                    PNG, JPG up to 10MB
                  </span>
                </button>
                {productImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {productImages.map((file, i) => (
                      <div
                        key={i}
                        className="relative group bg-white/[0.06] rounded-lg px-3 py-1.5 flex items-center gap-2"
                      >
                        <ImagePlus className="w-3 h-3 text-white/40" />
                        <span className="text-xs text-white/50 max-w-[120px] truncate">
                          {file.name}
                        </span>
                        <button
                          onClick={() => removeImage(i)}
                          className="text-white/30 hover:text-white/70"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tone Selector */}
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

              {/* Platform Selector */}
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

              {/* Generate Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleGenerateScript}
                  disabled={isGenerating || !productName.trim()}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white gap-2"
                >
                  {isGenerating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Generate Script
                </Button>
                <Button
                  onClick={handleGenerateHooks}
                  disabled={isGenerating || !productName.trim()}
                  variant="outline"
                  className="border-white/[0.1] text-white/70 hover:text-white hover:bg-white/[0.06] gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Generate Hooks
                </Button>
              </div>
            </CardContent>
          </Card>

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
              <CardTitle className="text-white text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              {/* Phone Mockup */}
              <div className="w-[280px] rounded-[2rem] border-2 border-white/[0.1] bg-black/60 p-3 shadow-2xl">
                <div className="rounded-[1.5rem] overflow-hidden bg-zinc-900 aspect-[9/16] flex flex-col">
                  {/* Avatar Header */}
                  {selectedAvatar && (
                    <div className="p-4 flex items-center gap-3 bg-gradient-to-b from-black/60 to-transparent">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white",
                          `bg-gradient-to-br ${selectedAvatar.gradient}`
                        )}
                      >
                        {selectedAvatar.emoji}
                      </div>
                      <div>
                        <p className="text-white text-xs font-semibold">
                          {selectedAvatar.name}
                        </p>
                        <p className="text-white/40 text-[10px]">
                          {selectedAvatar.personality}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Content Area */}
                  <ScrollArea className="flex-1 px-4">
                    {generatedScript ? (
                      <div className="space-y-4 pb-4">
                        {/* Hook */}
                        <div className="bg-purple-500/20 rounded-xl px-3 py-2 border border-purple-500/30">
                          <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider mb-1">
                            Hook
                          </p>
                          <p className="text-white text-xs font-medium leading-relaxed">
                            {generatedScript.hook}
                          </p>
                        </div>

                        {/* Script */}
                        <div>
                          <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-2">
                            Script
                          </p>
                          <p className="text-white/70 text-xs leading-relaxed whitespace-pre-line">
                            {generatedScript.script}
                          </p>
                        </div>

                        {/* CTA */}
                        <div className="bg-indigo-500/20 rounded-xl px-3 py-2 border border-indigo-500/30">
                          <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider mb-1">
                            CTA
                          </p>
                          <p className="text-white text-xs font-medium">
                            {generatedScript.cta}
                          </p>
                        </div>

                        {/* Captions */}
                        <div>
                          <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-2">
                            Captions
                          </p>
                          <div className="space-y-1.5">
                            {generatedScript.captions.map((cap, i) => (
                              <div
                                key={i}
                                className="bg-white/[0.08] rounded-lg px-2.5 py-1.5 text-[11px] text-white/80"
                              >
                                {cap}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                        <Video className="w-10 h-10 text-white/10 mb-3" />
                        <p className="text-white/30 text-xs">
                          Generate a script to see the preview
                        </p>
                      </div>
                    )}
                  </ScrollArea>

                  {/* Bottom Bar */}
                  {selectedTemplate && (
                    <div className="p-3 bg-gradient-to-t from-black/60 to-transparent">
                      <p className="text-white/40 text-[10px] text-center truncate">
                        {selectedTemplate.name} &middot; {selectedTemplate.estimatedDuration}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export Button */}
          <Button
            onClick={() => toast.info("Video export coming soon!")}
            disabled={!generatedScript}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white gap-2 h-12 rounded-xl"
          >
            <Download className="w-4 h-4" />
            Export Video
          </Button>
        </div>
      </div>

      <div className="flex justify-start pt-2">
        <Button
          variant="ghost"
          onClick={() => setCurrentStep(2)}
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
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Video Creator
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Create scroll-stopping UGC videos with AI
          </p>
        </div>

        {renderProgress()}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </div>
    </div>
  );
}
