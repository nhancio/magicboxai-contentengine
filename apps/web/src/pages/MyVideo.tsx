import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { isConvexConfigured } from "../lib/convex";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Label } from "@shared/components/ui/label";
import { Textarea } from "@shared/components/ui/textarea";
import { Badge } from "@shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/card";
import { cn } from "@shared/lib/utils";
import {
  Film,
  Sparkles,
  Upload,
  Play,
  Scissors,
  Wand2,
  CheckCircle2,
  Send,
  CalendarClock,
  Save,
  Layers,
  Loader2,
  Share2,
  Trash2,
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
  MessageCircle,
  Twitter,
  Video,
  FileVideo,
  Sliders,
  Type,
  Palette,
  Volume2,
  RefreshCw,
  Clock,
  Eye,
  Zap,
} from "lucide-react";

/**
 * MY VIDEO MODULE — Full-Stack Conversational & AI Video Editing Page
 * Modeled after browser-use/video-use pipeline & technology.
 */

type PresetStyle = {
  id: string;
  name: string;
  badge: string;
  description: string;
  prompt: string;
  grade: string;
};

const PRESET_STYLES: PresetStyle[] = [
  {
    id: "viral_short",
    name: "Viral Short Cut",
    badge: "TikTok & Reels",
    description: "Fast-paced vertical cut with filler word removal, punchy 2-word uppercase subtitles, and vivid color grade.",
    prompt: "Cut filler words (um, uh, false starts), remove silent gaps >=0.4s, apply vivid pop color grade, and burn bold 2-word uppercase captions.",
    grade: "vivid_pop",
  },
  {
    id: "launch_demo",
    name: "Tech Launch / Demo",
    badge: "YouTube & LinkedIn",
    description: "Structured problem-solution flow with 30ms audio crossfades and clean word-boundary cuts.",
    prompt: "Structure into HOOK -> PROBLEM -> SOLUTION -> CTA. Clean up verbal stumbles, apply neutral punch color grade, and add subtitles.",
    grade: "neutral_punch",
  },
  {
    id: "talking_head",
    name: "Talking Head Clean Cut",
    badge: "Professional",
    description: "Cuts awkward pauses and vocal slips while preserving natural emphasis beats and speaker handoffs.",
    prompt: "Precision trim talking head footage. Remove 'um' and 'uh', pad cuts by 50ms, apply natural SDR grade, and format 2-word subtitles.",
    grade: "natural_sdr",
  },
  {
    id: "cinematic_vlog",
    name: "Cinematic Vlog",
    badge: "Atmospheric",
    description: "Warm cinematic color grade, 30ms smooth audio fades, and paced storytelling cuts.",
    prompt: "Apply warm cinematic color grade, keep atmospheric pause beats, apply 30ms audio fades at every segment boundary, burn captions.",
    grade: "warm_cinematic",
  },
];

const CHANNELS = [
  { id: "instagram", label: "Instagram Reel", icon: Instagram },
  { id: "youtube", label: "YouTube Shorts / Video", icon: Youtube },
  { id: "linkedin", label: "LinkedIn Video", icon: Linkedin },
  { id: "facebook", label: "Facebook Reel / Video", icon: Facebook },
  { id: "whatsapp", label: "WhatsApp Video", icon: MessageCircle },
  { id: "twitter", label: "Twitter / X Video", icon: Twitter },
];

const QUICK_PROMPTS = [
  "Remove all 'um' and 'uh' filler words",
  "Snap cuts to word boundaries with 30ms audio fades",
  "Burn 2-word UPPERCASE bold subtitles with safe vertical margin",
  "Apply Warm Cinematic color grade",
  "Highlight key punchlines and CTA",
];

export default function MyVideo() {
  const [selectedPreset, setSelectedStyle] = useState<PresetStyle>(PRESET_STYLES[0]);
  const [projectTitle, setProjectTitle] = useState("");
  const [prompt, setPrompt] = useState(PRESET_STYLES[0].prompt);
  const [rawVideoUrl, setRawVideoUrl] = useState("");
  const [rawStorageId, setRawStorageId] = useState<Id<"_storage"> | undefined>();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Active video project ID
  const [activeProjectId, setActiveProjectId] = useState<Id<"myVideos"> | null>(null);

  // Channel Selection
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram", "youtube"]);
  const [videoFormat, setVideoFormat] = useState<"reel" | "video">("reel");

  // Editing / Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [publishingMode, setPublishingMode] = useState<"now" | "schedule" | "draft" | null>(null);

  // Convex Hooks
  const projects = useQuery(api.myVideo.list, isConvexConfigured ? {} : "skip");
  const activeProject = useQuery(
    api.myVideo.get,
    isConvexConfigured && activeProjectId ? { id: activeProjectId } : "skip"
  );

  const createProject = useMutation(api.myVideo.create);
  const updateProject = useMutation(api.myVideo.update);
  const deleteProject = useMutation(api.myVideo.remove);
  const uploadUrlMutation = useMutation(api.studio.uploadUrl);
  const resolveUploadMutation = useMutation(api.studio.resolveUpload);

  const processVideoUseAction = useAction(api.myVideo.processVideoUse);
  const publishToChannelsAction = useAction(api.myVideo.publishToChannels);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync selected project data into local editing form when active project changes
  useEffect(() => {
    if (activeProject) {
      setProjectTitle(activeProject.title);
      setPrompt(activeProject.prompt);
      setRawVideoUrl(activeProject.rawVideoUrl);
      if (activeProject.platforms) {
        setSelectedPlatforms(activeProject.platforms);
      }
    }
  }, [activeProject]);

  // Handle Preset Change
  const handleSelectPreset = (preset: PresetStyle) => {
    setSelectedStyle(preset);
    setPrompt(preset.prompt);
  };

  // Quick Prompt Toggle
  const handleAddQuickPrompt = (quickText: string) => {
    if (prompt.includes(quickText)) return;
    setPrompt((prev) => (prev ? `${prev}. ${quickText}` : quickText));
  };

  // Handle Video Upload
  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a valid video file (.mp4, .mov, .webm)");
      return;
    }
    try {
      setUploading(true);
      setUploadProgress(20);

      const postUrl = await uploadUrlMutation({});
      setUploadProgress(50);

      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!res.ok) throw new Error("Upload to Convex storage failed");

      const { storageId } = await res.json();
      setUploadProgress(80);

      const resolved = await resolveUploadMutation({ storageId });
      setRawVideoUrl(resolved.url);
      setRawStorageId(resolved.storageId as Id<"_storage">);
      setUploadProgress(100);

      if (!projectTitle) {
        setProjectTitle(file.name.replace(/\.[^/.]+$/, ""));
      }

      toast.success("Raw video footage uploaded successfully!");
    } catch (err: any) {
      toast.error(`Video upload failed: ${err.message || "Unknown error"}`);
    } finally {
      setUploading(false);
    }
  };

  // Create Project & Run Video-Use AI Editing
  const handleRunVideoUse = async () => {
    if (!rawVideoUrl.trim()) {
      toast.error("Please upload or provide raw video footage first.");
      return;
    }

    try {
      setIsProcessing(true);

      let projectId = activeProjectId;
      if (!projectId) {
        projectId = await createProject({
          title: projectTitle.trim() || "My Video Edit",
          prompt: prompt.trim(),
          rawVideoUrl,
          rawStorageId,
          presetStyle: selectedPreset.id,
        });
        setActiveProjectId(projectId);
      } else {
        await updateProject({
          id: projectId,
          title: projectTitle.trim() || "My Video Edit",
          prompt: prompt.trim(),
          presetStyle: selectedPreset.id,
          platforms: selectedPlatforms,
        });
      }

      toast.info("Processing video-use pipeline: transcribing, removing filler, crossfading, and styling...");

      const res = await processVideoUseAction({
        id: projectId,
        prompt: prompt.trim(),
        presetStyle: selectedPreset.id,
      });

      if (res.success) {
        toast.success(`Video edited! ${res.cutsMade} segments trimmed, duration ${res.editedDuration}s.`);
      }
    } catch (err: any) {
      toast.error(`Editing failed: ${err.message || "Execution error"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle Social Channel Selection
  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  };

  // Publish / Schedule Video
  const handlePublish = async (mode: "now" | "schedule" | "draft") => {
    if (!activeProjectId) {
      toast.error("No active video project to publish.");
      return;
    }
    if (selectedPlatforms.length === 0 && mode !== "draft") {
      toast.error("Please select at least one channel to publish to.");
      return;
    }

    try {
      setPublishingMode(mode);
      const res = await publishToChannelsAction({
        id: activeProjectId,
        platforms: selectedPlatforms,
        postFormat: videoFormat,
        mode,
        caption: activeProject?.generatedCaption,
        hashtags: activeProject?.generatedHashtags,
      });

      if (mode === "now") {
        toast.success("Video published successfully to selected channels!");
      } else if (mode === "schedule") {
        toast.success("Video scheduled for the next best posting time!");
      } else {
        toast.success("Video saved to drafts.");
      }
    } catch (err: any) {
      toast.error(`Publishing failed: ${err.message || "Error"}`);
    } finally {
      setPublishingMode(null);
    }
  };

  const edl = activeProject?.edl;
  const currentVideoUrl = activeProject?.editedVideoUrl || activeProject?.rawVideoUrl || rawVideoUrl;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight font-display text-foreground sm:text-3xl">
              My Video Module
            </h1>
            <Badge variant="outline" className="border-brand/30 bg-brand/10 text-brand gap-1 text-xs py-0.5">
              <Sparkles className="h-3 w-3" />
              Video-Use AI Engine
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Conversational full-stack video editing powered by Gemini API & video-use. Automatically cut filler words,
            apply 30ms audio fades, auto color grade, and burn bold 2-word uppercase subtitles for multi-channel publishing.
          </p>
        </div>

        {activeProjectId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveProjectId(null);
              setProjectTitle("");
              setRawVideoUrl("");
              setRawStorageId(undefined);
              setPrompt(selectedPreset.prompt);
            }}
            className="self-start md:self-auto gap-2 text-xs"
          >
            <Video className="h-3.5 w-3.5" />
            New Video Project
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Form & Configuration (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Preset Picker */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-brand" />
                1. Select Video Editing Style
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {PRESET_STYLES.map((preset) => {
                  const isSelected = selectedPreset.id === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={cn(
                        "cursor-pointer rounded-xl border p-3.5 transition-all duration-200",
                        isSelected
                          ? "border-brand bg-brand/10 shadow-sm"
                          : "border-border/70 bg-card hover:border-border hover:bg-accent/40"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-foreground">{preset.name}</span>
                        <Badge variant="secondary" className="text-[10px] py-0 px-2">
                          {preset.badge}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Footage Upload & Video Source */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Upload className="h-4 w-4 text-brand" />
                2. Provide Raw Video Footage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center gap-2.5",
                  rawVideoUrl
                    ? "border-brand/40 bg-brand/5"
                    : "border-border/80 hover:border-brand/50 hover:bg-accent/30"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileUpload(file);
                  }}
                  className="hidden"
                />
                <div className="rounded-full bg-brand/10 p-3 text-brand">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <FileVideo className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {uploading
                      ? "Uploading footage to MagicBox Storage..."
                      : rawVideoUrl
                      ? "Footage Loaded — Click or drag to replace"
                      : "Click or drag raw video file here"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Supports MP4, MOV, WebM up to 500MB
                  </p>
                </div>
              </div>

              {/* Alternative: Direct Video URL */}
              <div className="space-y-1.5">
                <Label htmlFor="rawUrl" className="text-xs font-medium text-muted-foreground">
                  Or paste direct Raw Video URL:
                </Label>
                <Input
                  id="rawUrl"
                  type="url"
                  placeholder="https://storage.googleapis.com/.../raw.mp4"
                  value={rawVideoUrl}
                  onChange={(e) => setRawVideoUrl(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              {/* Title Field */}
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-medium text-foreground">
                  Project Title
                </Label>
                <Input
                  id="title"
                  placeholder="e.g., Product Launch Reel - Take 1"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* AI Editing Instructions & Prompts */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-brand" />
                  3. Video-Use Editing Prompt & Instructions
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  Rule-based & LLM Reasoning
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={3}
                placeholder="Describe how to edit this video..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="text-sm leading-relaxed"
              />

              {/* Quick Prompt Chips */}
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-2">
                  Quick Video-Use Rules:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAddQuickPrompt(chip)}
                      className="rounded-full border border-border/80 bg-accent/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-brand/10 hover:text-brand hover:border-brand/30 transition-all"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Run Action Button */}
              <Button
                onClick={handleRunVideoUse}
                disabled={isProcessing || !rawVideoUrl.trim()}
                className="w-full bg-brand text-brand-foreground hover:bg-brand/90 gap-2 h-11 font-medium shadow-md"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Executing Video-Use Pipeline...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 fill-current" />
                    Edit Video with AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Player, EDL Breakdown & Channel Publishing (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Video Preview Player */}
          <Card className="border-border bg-card/60 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Play className="h-4 w-4 text-brand" />
                  Video Output Preview
                </span>
                {activeProject?.status === "completed" && (
                  <div className="flex items-center gap-1.5">
                    {activeProject.editedVideoUrl && activeProject.editedVideoUrl !== activeProject.rawVideoUrl ? (
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Rendered MP4
                      </Badge>
                    ) : edl ? (
                      <Badge variant="outline" className="border-brand/30 text-brand bg-brand/10 text-[10px]">
                        <Scissors className="h-3 w-3 mr-1" /> EDL Active ({edl.editedDuration}s)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Ready
                      </Badge>
                    )}
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative aspect-[9/16] max-h-[480px] w-full bg-black/90 flex items-center justify-center overflow-hidden">
                {currentVideoUrl ? (
                  <>
                    <video
                      src={currentVideoUrl}
                      controls
                      className="h-full w-full object-contain"
                    />
                    {edl && (!activeProject?.editedVideoUrl || activeProject.editedVideoUrl === activeProject.rawVideoUrl) && (
                      <div className="absolute top-2 left-2 right-2 bg-black/80 backdrop-blur-md rounded-lg p-2 text-[11px] text-white/90 border border-brand/40 shadow-lg pointer-events-none flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-medium truncate">
                          <Sparkles className="h-3.5 w-3.5 text-brand shrink-0" />
                          <span className="truncate">
                            AI EDL Active: {edl.segments.filter((s) => !s.keep).length} filler trims ({edl.totalDuration}s → {edl.editedDuration}s), 30ms fades, {edl.colorGradePreset} grade
                          </span>
                        </div>
                        <span className="text-[9px] uppercase tracking-wider font-mono bg-brand/30 px-1.5 py-0.5 rounded text-brand-foreground shrink-0">
                          EDL
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <FileVideo className="h-10 w-10 text-muted-foreground/40 mb-1" />
                    <p className="text-sm font-medium">No video generated yet</p>
                    <p className="text-xs text-muted-foreground/70">
                      Upload raw video footage and click "Edit Video with AI" to generate the final edit.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* EDL & Segment Breakdown (Video-Use Engine Output) */}
          {edl && (
            <Card className="border-border bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="h-4 w-4 text-brand" />
                    EDL & Segment Breakdown
                  </span>
                  <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                    <span className="line-through">{edl.totalDuration}s</span>
                    <span className="text-brand font-bold">{edl.editedDuration}s</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Tech Specs Summary */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs bg-muted/30 p-2.5 rounded-lg border border-border/40">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-mono">Audio Fades</span>
                    <span className="font-semibold text-foreground">30ms Crossfade</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-mono">Color Grade</span>
                    <span className="font-semibold text-brand capitalize">{edl.colorGradePreset.replace("_", " ")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-mono">Subtitles</span>
                    <span className="font-semibold text-foreground">2-Word UPPERCASE</span>
                  </div>
                </div>

                {/* Segments List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {edl.segments.map((seg, idx) => (
                    <div
                      key={seg.id || idx}
                      className={cn(
                        "rounded-lg border p-2.5 text-xs transition-colors flex flex-col gap-1",
                        seg.keep
                          ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                          : "border-destructive/20 bg-destructive/5 text-muted-foreground opacity-60"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold text-muted-foreground">
                          [{seg.startTime.toFixed(2)}s - {seg.endTime.toFixed(2)}s] {seg.speaker}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] py-0 px-1.5",
                            seg.keep
                              ? "border-emerald-500/30 text-emerald-400"
                              : "border-destructive/30 text-destructive"
                          )}
                        >
                          {seg.keep ? "KEPT" : "TRIMMED (FILLER)"}
                        </Badge>
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed font-medium">{seg.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Channel Selection & Publishing Options */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Share2 className="h-4 w-4 text-brand" />
                4. Select Channels & Publish Output
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Generated Caption Preview */}
              {activeProject?.generatedCaption && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Generated Social Caption
                  </Label>
                  <Textarea
                    rows={2}
                    value={activeProject.generatedCaption}
                    onChange={(e) => {
                      if (activeProjectId) {
                        void updateProject({ id: activeProjectId, generatedCaption: e.target.value });
                      }
                    }}
                    className="text-xs leading-relaxed"
                  />
                  {activeProject.generatedHashtags && (
                    <p className="text-[11px] font-mono text-brand font-medium">
                      {activeProject.generatedHashtags.join(" ")}
                    </p>
                  )}
                </div>
              )}

              {/* Channels Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-medium text-muted-foreground block">
                    Target Social Platforms:
                  </Label>
                  <div className="flex items-center gap-1 bg-secondary p-0.5 rounded-lg text-[10px]">
                    <button
                      type="button"
                      onClick={() => setVideoFormat("reel")}
                      className={cn(
                        "px-2 py-0.5 rounded-md font-medium transition-colors",
                        videoFormat === "reel"
                          ? "bg-brand text-brand-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Reel / Short
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoFormat("video")}
                      className={cn(
                        "px-2 py-0.5 rounded-md font-medium transition-colors",
                        videoFormat === "video"
                          ? "bg-brand text-brand-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Long Video
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {CHANNELS.map((ch) => {
                    const isSelected = selectedPlatforms.includes(ch.id);
                    const Icon = ch.icon;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => togglePlatform(ch.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-2 text-xs font-medium transition-all text-left",
                          isSelected
                            ? "border-brand bg-brand/10 text-brand font-semibold"
                            : "border-border/70 bg-card text-muted-foreground hover:bg-accent/40"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{ch.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Publish Action Buttons */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Button
                  onClick={() => void handlePublish("now")}
                  disabled={publishingMode !== null || !activeProjectId || activeProject?.status !== "completed"}
                  className="bg-brand text-brand-foreground hover:bg-brand/90 text-xs gap-1.5"
                >
                  {publishingMode === "now" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Post Now
                </Button>

                <Button
                  variant="outline"
                  onClick={() => void handlePublish("schedule")}
                  disabled={publishingMode !== null || !activeProjectId || activeProject?.status !== "completed"}
                  className="text-xs gap-1.5 border-border"
                >
                  {publishingMode === "schedule" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CalendarClock className="h-3.5 w-3.5" />
                  )}
                  Best Time
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => void handlePublish("draft")}
                  disabled={publishingMode !== null || !activeProjectId}
                  className="text-xs gap-1.5"
                >
                  {publishingMode === "draft" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Saved Projects Library Section */}
      {projects && projects.length > 0 && (
        <Card className="border-border bg-card/60 backdrop-blur-sm mt-8">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Film className="h-4 w-4 text-brand" />
              Saved My Video Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((item) => (
                <div
                  key={item._id}
                  className={cn(
                    "rounded-xl border p-4 transition-all duration-200 flex flex-col justify-between gap-3",
                    activeProjectId === item._id
                      ? "border-brand bg-brand/5"
                      : "border-border/70 bg-card hover:border-border"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-sm text-foreground truncate">{item.title}</h4>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] py-0 px-2 capitalize",
                          item.status === "completed"
                            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                            : item.status === "failed"
                            ? "border-destructive/30 text-destructive bg-destructive/10"
                            : "border-amber-500/30 text-amber-400 bg-amber-500/10"
                        )}
                      >
                        {item.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.prompt}</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/40 pt-2.5">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveProjectId(item._id)}
                        className="h-7 px-2 text-xs gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        Open
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void deleteProject({ id: item._id })}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
