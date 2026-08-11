import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { isConvexConfigured } from "../lib/convex";
import { useAuth } from "@shared/lib/auth";
import { getPhotoAvatars, type PhotoAvatarRecord } from "@shared/lib/firestore";
import { rewriteAsUGC } from "@shared/lib/gemini";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Label } from "@shared/components/ui/label";
import { Textarea } from "@shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/components/ui/select";
import { cn } from "@shared/lib/utils";
import Carousel from "./Carousel";
import PlatformPreview, { type PreviewContent } from "../components/previews/PlatformPreview";
import type { SocialPlatform } from "@shared/types";
import {
  Sparkles,
  Loader2,
  Wand2,
  Send,
  CalendarClock,
  Save,
  Upload,
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
  MessageCircle,
  Twitter,
  ImagePlus,
  Film,
  Type,
  Layers,
  CheckCircle2,
  X,
  User,
  Link2,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";

/**
 * STUDIO — 5-Step Unified Content Creator
 *
 * 1. Select Channel (Instagram, LinkedIn, YouTube, Facebook, WhatsApp, Twitter)
 * 2. Select Post Type (Text, Image, Carousel, Video)
 * 3. Provide Input (Prompt, uploaded Image, or uploaded Video)
 * 4. Click Create
 * 5. Display Preview with Post Now, Post Best Time, Save to Draft options
 */

type PostType = "text" | "image" | "carousel" | "reel" | "video" | "post";

const CHANNELS: { id: string; label: string; icon: typeof Instagram }[] = [
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
  { id: "youtube", label: "YouTube", icon: Youtube },
  { id: "facebook", label: "Facebook", icon: Facebook },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "twitter", label: "Twitter / X", icon: Twitter },
];

const CHANNEL_POST_TYPES: Record<
  string,
  { id: PostType; label: string; icon: typeof Type; description: string }[]
> = {
  instagram: [
    { id: "image", label: "Image Post", icon: ImagePlus, description: "Single graphic or photo with engaging caption" },
    { id: "carousel", label: "Carousel", icon: Layers, description: "Multi-slide story or educational deck" },
    { id: "reel", label: "Reel", icon: Film, description: "Vertical short-form video Reel" },
    { id: "post", label: "Standard Post", icon: Type, description: "Standard post copy & caption" },
  ],
  linkedin: [
    { id: "image", label: "Image Post", icon: ImagePlus, description: "Single graphic or photo with caption" },
    { id: "carousel", label: "Carousel (Document)", icon: Layers, description: "PDF / multi-image document carousel" },
    { id: "reel", label: "Reel / Video", icon: Film, description: "Short vertical video or video clip" },
    { id: "post", label: "Standard Post", icon: Type, description: "Text post & professional insight" },
  ],
  youtube: [
    { id: "reel", label: "Reel / Short", icon: Film, description: "Vertical short-form YouTube Short (9:16)" },
    { id: "video", label: "Long-form Video", icon: Film, description: "Standard long-form YouTube video" },
  ],
  facebook: [
    { id: "image", label: "Image Post", icon: ImagePlus, description: "Single photo with caption" },
    { id: "carousel", label: "Carousel", icon: Layers, description: "Multi-image post" },
    { id: "reel", label: "Reel", icon: Film, description: "Short-form video Reel" },
    { id: "video", label: "Video", icon: Film, description: "Longer video post" },
    { id: "post", label: "Standard Post", icon: Type, description: "Text update or link post" },
  ],
  twitter: [
    { id: "post", label: "Standard Post", icon: Type, description: "Short post copy & tweet" },
    { id: "image", label: "Image Post", icon: ImagePlus, description: "Photo tweet with copy" },
    { id: "video", label: "Video Post", icon: Film, description: "Video clip with copy" },
  ],
  whatsapp: [
    { id: "post", label: "Standard Message", icon: Type, description: "Direct text message" },
    { id: "image", label: "Image Message", icon: ImagePlus, description: "Image with caption" },
    { id: "video", label: "Video Message", icon: Film, description: "Video clip with caption" },
  ],
};

const TONES = ["Casual", "Professional", "Bold", "Funny", "Educational", "Inspirational"] as const;

const VERTICAL_PLATFORMS = new Set(["instagram", "youtube", "facebook"]);
const aspectFor = (p: string) => (VERTICAL_PLATFORMS.has(p) ? "9:16" : "1:1");

type CopyResult = { hook: string; caption: string; hashtags: string[]; mediaPrompt?: string };

type StudioPreset = {
  id: string;
  name: string;
  description: string;
  category?: string;
  starterPrompt?: string;
  rightsNote?: string;
  isTrending: boolean;
  matchedTrend?: string;
};

function initialPostType(searchParams: URLSearchParams): PostType {
  const requested = searchParams.get("type") ?? searchParams.get("mode");
  if (
    requested === "text" ||
    requested === "image" ||
    requested === "carousel" ||
    requested === "reel" ||
    requested === "video" ||
    requested === "post"
  ) {
    return requested as PostType;
  }
  return "image";
}

export default function Studio() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Queries & Mutations
  const accounts = useQuery(api.social.accounts, isConvexConfigured ? {} : "skip");
  const brands = useQuery(api.brands.list, isConvexConfigured ? {} : "skip");
  const primaryBrand = brands?.[0];

  const generateCopy = useAction(api.studio.generateCopy);
  const generateImage = useAction(api.media.generateImage);
  const generateVideo = useAction(api.media.generateVideo);
  const createPost = useAction(api.studio.createPost);
  const uploadUrl = useMutation(api.studio.uploadUrl);
  const resolveUpload = useMutation(api.studio.resolveUpload);

  // Form State
  const [channel, setChannel] = useState<string>(searchParams.get("channel") || "instagram");
  const [postType, setPostType] = useState<PostType>(() => initialPostType(searchParams));
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]>("Casual");
  const [avatars, setAvatars] = useState<PhotoAvatarRecord[]>([]);
  const [avatarId, setAvatarId] = useState("");

  // Uploaded or Generated Media
  const [media, setMedia] = useState<{
    type: "image" | "video";
    url: string;
    source: string;
  } | null>(null);
  const [videoJobId, setVideoJobId] = useState<string | null>(null);

  // WhatsApp specific inputs
  const [whatsappRecipients, setWhatsappRecipients] = useState("");
  const [whatsappTemplateName, setWhatsappTemplateName] = useState("");

  // Generated Post State
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");

  // Loading States
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isRenderingMedia, setIsRenderingMedia] = useState(false);
  const [posting, setPosting] = useState<null | "now" | "schedule" | "draft">(null);

  // Available post types for selected channel
  const availablePostTypes = useMemo(
    () => CHANNEL_POST_TYPES[channel] || CHANNEL_POST_TYPES.instagram,
    [channel],
  );

  // Auto-switch postType if current postType is not supported on newly selected channel
  useEffect(() => {
    if (!availablePostTypes.some((pt) => pt.id === postType)) {
      setPostType(availablePostTypes[0].id);
    }
  }, [channel, availablePostTypes, postType]);

  const targetMediaType =
    postType === "video" || postType === "reel"
      ? "video"
      : postType === "image" || postType === "carousel"
        ? "image"
        : "none";

  const creatorPresets = useQuery(
    api.studio.presets,
    isConvexConfigured && targetMediaType !== "none"
      ? { platform: channel, mediaType: targetMediaType }
      : "skip",
  ) as StudioPreset[] | undefined;
  const selectedPreset = creatorPresets?.find((preset) => preset.id === selectedPresetId);

  useEffect(() => {
    if ((postType !== "video" && postType !== "image") || !creatorPresets?.length) return;
    if (!creatorPresets.some((preset) => preset.id === selectedPresetId)) {
      const firstPreset = creatorPresets[0];
      setSelectedPresetId(firstPreset.id);
      setPrompt((prev) => prev ? prev : (firstPreset.starterPrompt || ""));
    }
  }, [creatorPresets, postType, selectedPresetId]);

  // Load avatars
  useEffect(() => {
    if (!user) return;
    getPhotoAvatars(user.uid)
      .then((list) => setAvatars(list.filter((a) => a.status === "ready")))
      .catch(() => setAvatars([]));
  }, [user]);

  // Poll Veo Video Job reactively if active
  const job = useQuery(api.media.job, videoJobId ? { jobId: videoJobId as any } : "skip");
  useEffect(() => {
    if (!job) return;
    if (job.status === "completed" && job.url) {
      setMedia({ type: "video", url: job.url, source: "veo" });
      setIsRenderingMedia(false);
      setVideoJobId(null);
      toast.success("AI Video generated successfully!");
    } else if (job.status === "failed") {
      setIsRenderingMedia(false);
      setVideoJobId(null);
      toast.error(`Video rendering failed: ${job.error ?? "Unknown error"}`);
    }
  }, [job]);

  // Connected accounts for selected channel
  const connectedAccount = useMemo(
    () => (accounts ?? []).find((a: any) => a.status === "active" && a.platform === channel),
    [accounts, channel]
  );

  // Brand Info for Preview
  const previewBrandName =
    connectedAccount?.displayName || connectedAccount?.username || primaryBrand?.name || "Your Brand";
  const previewHandle = connectedAccount?.username
    ? connectedAccount.username
    : primaryBrand?.name
      ? primaryBrand.name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24)
      : "yourbrand";
  const previewLogoUrl = connectedAccount?.avatarUrl || primaryBrand?.logoUrl;

  const selectedAvatar = avatars.find((a) => a.id === avatarId) ?? null;

  // File Upload Handler
  async function handleFileUpload(file: File) {
    setIsUploading(true);
    try {
      const url = await uploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      const resolved = await resolveUpload({ storageId });

      const isVideo = file.type.startsWith("video");
      setMedia({
        type: isVideo ? "video" : "image",
        url: resolved.url,
        source: "upload",
      });

      // Auto-set post type to match uploaded media
      if (isVideo && postType !== "video") setPostType("video");
      if (!isVideo && postType === "text") setPostType("image");

      toast.success(`${isVideo ? "Video" : "Image"} uploaded successfully.`);
    } catch (e) {
      toast.error(`Upload failed: ${String(e).slice(0, 120)}`);
    } finally {
      setIsUploading(false);
    }
  }

  // Step 4: Handle "Create"
  async function handleCreate() {
    if (postType === "carousel") {
      // Handled by embedded Carousel component
      return;
    }

    const templateBrief =
      postType === "video" || postType === "image" ? selectedPreset?.starterPrompt : undefined;
    const effectiveBrief = prompt.trim() || templateBrief;
    if (!effectiveBrief && !media) {
      toast.error("Choose a template, provide a topic, or upload media to create your post.");
      return;
    }

    setIsCreating(true);
    try {
      // Map post type to preset ID for backend
      let presetId = "talking-head-ugc";
      if (postType === "text" || postType === "post") presetId = "text-post";
      else if (postType === "image") presetId = selectedPreset?.id || "branded-story-image";
      else if (postType === "video" || postType === "reel") presetId = selectedPreset?.id || "talking-head-ugc";

      const effectiveFormat = postType === "text" ? "post" : postType;

      const avatarContext = selectedAvatar
        ? `Avatar: ${selectedAvatar.name}. Voice: ${selectedAvatar.voiceTone}.`
        : "";
      const brandContext = primaryBrand
        ? [
            `Brand: ${primaryBrand.name}`,
            primaryBrand.industry && `Industry: ${primaryBrand.industry}`,
            primaryBrand.audience && `Audience: ${primaryBrand.audience}`,
            primaryBrand.toneOfVoice && `Brand voice: ${primaryBrand.toneOfVoice}`,
            primaryBrand.websiteUrl && `Website source: ${primaryBrand.websiteUrl}`,
            primaryBrand.sampleCaptions?.length &&
              `Voice examples:\n${primaryBrand.sampleCaptions.slice(0, 3).map((sample: string) => `- ${sample}`).join("\n")}`,
          ]
            .filter(Boolean)
            .join("\n")
        : "";

      // 1. Generate Copy
      const copyRes = (await generateCopy({
        presetId,
        platform: channel,
        postFormat: effectiveFormat,
        prompt: effectiveBrief,
        productName: primaryBrand?.name,
        brandProfileId: primaryBrand?._id,
        context:
          [brandContext, tone && `Requested tone: ${tone}`, avatarContext]
            .filter(Boolean)
            .join("\n") || undefined,
      })) as CopyResult;

      setCaption(copyRes.caption);
      setHashtags((copyRes.hashtags ?? []).join(" "));

      // 2. Generate Media if needed and not already uploaded
      if (!media) {
        const mediaPrompt = copyRes.mediaPrompt || effectiveBrief;
        if (postType === "image" && mediaPrompt) {
          setIsRenderingMedia(true);
          const imgRes = await generateImage({
            prompt: mediaPrompt,
            aspectRatio: aspectFor(channel),
          });
          setMedia({ type: "image", url: imgRes.url, source: "imagen" });
          setIsRenderingMedia(false);
        } else if ((postType === "video" || postType === "reel") && mediaPrompt) {
          setIsRenderingMedia(true);
          const vidRes = await generateVideo({
            prompt: mediaPrompt,
            aspectRatio: aspectFor(channel),
          });
          setVideoJobId(vidRes.jobId as unknown as string);
          toast.info("Generating AI Video — this may take 1-2 minutes.");
        }
      }

      toast.success("Post created! Review and publish below.");
    } catch (e) {
      toast.error(`Could not create post: ${String(e).slice(0, 140)}`);
    } finally {
      setIsCreating(false);
    }
  }

  // Rewrite caption as UGC
  async function handleRewriteUgc() {
    if (!caption.trim()) {
      toast.error("Generate or type a caption first.");
      return;
    }
    setIsRewriting(true);
    try {
      const rewritten = await rewriteAsUGC({
        text: caption,
        avatarPersonality: selectedAvatar?.personality || "Friendly creator",
        tone,
      });
      setCaption(rewritten);
      toast.success("Rewritten in UGC creator style!");
    } catch (e) {
      toast.error(`Rewrite failed: ${String(e).slice(0, 120)}`);
    } finally {
      setIsRewriting(false);
    }
  }

  // Regenerate AI Media
  async function handleRegenerateMedia() {
    const effectivePrompt = prompt.trim() || selectedPreset?.starterPrompt;
    if (!effectivePrompt) {
      toast.error("Choose a template or provide creative direction first.");
      return;
    }
    setIsRenderingMedia(true);
    setMedia(null);
    try {
      if (postType === "image") {
        const imgRes = await generateImage({
          prompt: effectivePrompt,
          aspectRatio: aspectFor(channel),
        });
        setMedia({ type: "image", url: imgRes.url, source: "imagen" });
        setIsRenderingMedia(false);
      } else if (postType === "video" || postType === "reel") {
        const vidRes = await generateVideo({
          prompt: effectivePrompt,
          aspectRatio: aspectFor(channel),
        });
        setVideoJobId(vidRes.jobId as unknown as string);
        toast.info("Generating new AI Video...");
      }
    } catch (e) {
      setIsRenderingMedia(false);
      toast.error(`Media generation failed: ${String(e).slice(0, 120)}`);
    }
  }

  // Step 5: Publish / Schedule / Save Draft
  async function handlePublish(mode: "now" | "schedule" | "draft") {
    if (!caption.trim()) {
      toast.error("Please add a caption before publishing.");
      return;
    }
    if (postType !== "text" && postType !== "carousel" && !media && mode !== "draft") {
      toast.error("Please add or generate media for this post type before publishing.");
      return;
    }

    if (channel === "whatsapp" && mode !== "draft") {
      const recipients = whatsappRecipients
        .split(/[\s,;]+/)
        .map((n) => n.replace(/[^\d]/g, ""))
        .filter((n) => n.length >= 8);
      if (recipients.length === 0) {
        toast.error("Add at least one opted-in WhatsApp recipient phone number.");
        return;
      }
    }

    setPosting(mode);
    try {
      const effectiveFormat = postType === "text" ? "post" : postType;
      const r = await createPost({
        caption,
        hashtags: hashtags
          .split(/\s+/)
          .map((h) => h.trim())
          .filter(Boolean),
        platforms: [channel],
        postFormat: effectiveFormat as any,
        mediaUrl: media?.url,
        mediaType: media?.type,
        mediaSource: media?.source,
        brief: prompt || "Studio post",
        mode,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(channel === "whatsapp"
          ? {
              whatsappRecipients: whatsappRecipients
                .split(/[\s,;]+/)
                .map((n) => n.replace(/[^\d]/g, ""))
                .filter((n) => n.length >= 8),
              whatsappTemplateName: whatsappTemplateName.trim() || undefined,
              whatsappTemplateLanguage: "en",
            }
          : {}),
      });

      if (mode === "now") {
        if (r.status === "posted") {
          toast.success(`Published to ${r.published ?? 1} channel!`);
        } else if (r.status === "failed") {
          toast.error("Publishing failed — check Library for error details.");
        } else if (r.status === "draft") {
          toast.warning("Saved as a draft — connect a channel to publish directly.", {
            action: { label: "Channels", onClick: () => (window.location.href = "/settings") },
          });
        } else {
          toast.success("Publishing in progress...");
        }
      } else if (mode === "schedule") {
        const when = r.scheduledFor
          ? new Date(r.scheduledFor).toLocaleString(undefined, {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
            })
          : null;
        toast.success(when ? `Scheduled for best time: ${when}` : "Scheduled for best time.");
      } else {
        toast.success("Saved to Drafts.");
      }

      // Reset state after publishing
      setCaption("");
      setHashtags("");
      setMedia(null);
      setPrompt("");
    } catch (e) {
      toast.error(`Publish failed: ${String(e).slice(0, 140)}`);
    } finally {
      setPosting(null);
    }
  }

  if (!isConvexConfigured) {
    return (
      <div className="mx-auto max-w-md p-8 text-center text-sm text-muted-foreground">
        Studio requires <code className="font-mono">VITE_CONVEX_URL</code> to be configured.
      </div>
    );
  }

  const previewContent: PreviewContent = {
    caption,
    hashtags: hashtags
      .split(/\s+/)
      .map((h) => h.trim())
      .filter(Boolean),
    imageUrl: media?.type === "image" ? media.url : undefined,
    videoUrl: media?.type === "video" ? media.url : undefined,
    brandName: previewBrandName,
    handle: previewHandle,
    logoUrl: previewLogoUrl,
    brandColors: primaryBrand?.colors
      ? {
          primary: primaryBrand.colors.primary,
          secondary: primaryBrand.colors.secondary,
          accent: primaryBrand.colors.accent,
        }
      : undefined,
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-theme(spacing.16))] max-w-7xl w-full flex-col animate-fade-in relative pb-6">
      <header className="px-6 py-4 shrink-0 border-b border-border/40">
        <span className="eyebrow">Create</span>
        <h1 className="mt-1 font-display text-2xl md:text-3xl text-foreground flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-brand" /> Studio
        </h1>
      </header>

      {/* Main Viewing Area with Left-Controls / Right-Preview Grid */}
      {/* ponytail: persistent 2-column layout prevents any layout shifts, overlaps, or inversions at all zoom levels */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="grid gap-8 lg:grid-cols-12 items-start h-full">

          {/* LEFT COLUMN: Input Controls, Prompt Bar, Captions, Publish Options (Col span 5) */}
          <div className="lg:col-span-5 space-y-6 flex flex-col justify-start">
            
            {/* 1. Unified Configuration & AI Chat Input Card */}
            {/* ponytail: merged fragmented selectors and input into one cohesive card mirroring standard AI chat interfaces */}
            <div className="rounded-2xl border border-border bg-card shadow-sm flex flex-col overflow-hidden">
              <div className="p-5 bg-secondary/10 border-b border-border/40 space-y-4">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  1. Configuration
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger className="h-8 rounded-full bg-background hover:bg-secondary/60 text-xs border-border/60 px-3 w-full sm:w-auto min-w-[120px] gap-2 shadow-sm">
                      <SelectValue placeholder="Channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map(ch => (
                        <SelectItem key={ch.id} value={ch.id}>
                          <div className="flex items-center gap-2">
                            <ch.icon className="h-3.5 w-3.5" />
                            {ch.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={postType} onValueChange={(v) => setPostType(v as PostType)}>
                    <SelectTrigger className="h-8 rounded-full bg-background hover:bg-secondary/60 text-xs border-border/60 px-3 w-full sm:w-auto min-w-[120px] gap-2 shadow-sm">
                      <SelectValue placeholder="Post Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePostTypes.map(pt => (
                        <SelectItem key={pt.id} value={pt.id}>
                          <div className="flex items-center gap-2">
                            <pt.icon className="h-3.5 w-3.5" />
                            {pt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={tone} onValueChange={(v) => setTone(v as any)}>
                    <SelectTrigger className="h-8 rounded-full bg-background hover:bg-secondary/60 text-xs border-border/60 px-3 w-full sm:w-auto min-w-[100px] gap-2 shadow-sm">
                      <SelectValue placeholder="Tone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TONES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {creatorPresets && creatorPresets.length > 0 && (
                    <Select value={selectedPresetId} onValueChange={(v) => {
                      setSelectedPresetId(v);
                      const preset = creatorPresets.find(p => p.id === v);
                      if (preset?.starterPrompt) setPrompt(preset.starterPrompt);
                    }}>
                      <SelectTrigger className="h-8 rounded-full bg-brand/5 hover:bg-brand/10 text-xs border-brand/30 text-brand px-3 w-full sm:w-auto min-w-[140px] gap-2 font-medium shadow-sm">
                        <Wand2 className="h-3 w-3" />
                        <SelectValue placeholder="Template" />
                      </SelectTrigger>
                      <SelectContent>
                        {creatorPresets.map(preset => (
                          <SelectItem key={preset.id} value={preset.id}>
                            <div className="flex flex-col">
                               <span>{preset.name}</span>
                               <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{preset.category ?? "Creator"}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-5">
                {/* Media Upload Preview (if attached) */}
                {media && (
                  <div className="mb-3 relative inline-flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-2 pr-8 self-start">
                    {media.type === "video" ? (
                      <video src={media.url} className="h-10 w-10 rounded-lg object-cover" muted />
                    ) : (
                      <img src={media.url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    )}
                    <div>
                      <p className="text-xs font-semibold capitalize text-foreground">{media.type} Attached</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setMedia(null)}
                      className="absolute top-1 right-1 rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground h-5 w-5"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* Modern AI Chat Input */}
                <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-background p-1.5 shadow-sm transition-all focus-within:border-brand/50 focus-within:ring-1 focus-within:ring-brand/50">
                  <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors">
                    {isUploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-brand" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      disabled={isUploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleFileUpload(f);
                      }}
                    />
                  </label>
                  
                  <Textarea
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    placeholder={
                      postType === "video" || postType === "image"
                        ? selectedPreset?.starterPrompt || "Message Maya to create..."
                        : "Message Maya to create..."
                    }
                    rows={1}
                    className="flex-1 min-h-[40px] max-h-[160px] resize-none border-0 bg-transparent py-2.5 px-1 text-[14px] shadow-none focus-visible:ring-0 text-foreground placeholder:text-muted-foreground/60 leading-relaxed"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleCreate();
                      }
                    }}
                  />
                  
                  <Button
                    onClick={handleCreate}
                    disabled={
                      isCreating ||
                      isRenderingMedia ||
                      (!prompt.trim() &&
                        !media &&
                        !((postType === "video" || postType === "image") && selectedPreset?.starterPrompt))
                    }
                    className={cn(
                      "h-10 w-10 shrink-0 rounded-xl transition-all shadow-sm p-0 flex items-center justify-center",
                      prompt.trim() || media ? "bg-brand text-brand-foreground hover:bg-brand/90" : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {isCreating || isRenderingMedia ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5 ml-[-2px]" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* 2. Caption, Hashtags & Publish Options Panel (Only rendered once generated/generating) */}
            {(caption || media || isRenderingMedia || postType === "carousel") && (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5 animate-fade-in">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  2. Edit & Publish Options
                </p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Caption</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isRewriting || !caption.trim()}
                      onClick={() => void handleRewriteUgc()}
                      className="h-7 px-2 text-xs text-brand"
                    >
                      {isRewriting ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Wand2 className="mr-1 h-3 w-3" />
                      )}
                      Rewrite as UGC
                    </Button>
                  </div>
                  <Textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={4}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Hashtags</Label>
                  <Input
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    placeholder="#marketing #ai #growth"
                    className="text-sm"
                  />
                </div>

                {postType !== "text" && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerateMedia}
                      disabled={isRenderingMedia || (!prompt.trim() && !selectedPreset?.starterPrompt)}
                    >
                      {isRenderingMedia ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Regenerate AI Media
                    </Button>
                  </div>
                )}

                {!connectedAccount && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <Link2 className="h-4 w-4 shrink-0" />
                    <span>
                      No active {channel} account connected. You can publish as draft or{" "}
                      <Link to="/settings" className="underline font-semibold">
                        connect channel
                      </Link>.
                    </span>
                  </div>
                )}

                {/* ACTION BUTTONS ON PREVIEW */}
                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Publish Options
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <Button
                      onClick={() => void handlePublish("now")}
                      disabled={posting !== null}
                      className="flex-1 min-w-[120px]"
                    >
                      {posting === "now" ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-1.5 h-4 w-4" />
                      )}
                      Post Now
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => void handlePublish("schedule")}
                      disabled={posting !== null}
                      className="flex-1 min-w-[120px]"
                    >
                      {posting === "schedule" ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <CalendarClock className="mr-1.5 h-4 w-4" />
                      )}
                      Post Best Time
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => void handlePublish("draft")}
                      disabled={posting !== null}
                      className="flex-1 min-w-[120px]"
                    >
                      {posting === "draft" ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-1.5 h-4 w-4" />
                      )}
                      Save to Draft
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Live Generated Media / Post Preview (Col span 7) */}
          {/* ponytail: constrained height with internal scroll handles arbitrary length posts without ever breaking/overflowing the layout */}
          <div className="lg:col-span-7 flex flex-col items-center bg-secondary/10 dark:bg-secondary/20 rounded-2xl border-2 border-border/70 shadow-inner overflow-hidden relative h-[600px] lg:h-[calc(100vh-11rem)] lg:sticky lg:top-6">
            <div className="w-full h-full overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center scrollbar-thin">
              {postType === "carousel" ? (
                 <Carousel embedded />
              ) : caption || media || isRenderingMedia ? (
                <div className="w-full max-w-sm mx-auto transition-all duration-300 transform-gpu shrink-0">
                  {isRenderingMedia && !media ? (
                    <div className="flex aspect-[9/16] w-full flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center shadow-lg my-auto min-h-[400px]">
                      <Loader2 className="h-8 w-8 animate-spin text-brand mb-3" />
                      <p className="text-sm font-medium text-foreground">Rendering AI Creative...</p>
                      <p className="text-xs text-muted-foreground mt-1">Generating high-quality media for {channel}</p>
                    </div>
                  ) : (
                    <PlatformPreview
                      platform={channel as SocialPlatform}
                      content={previewContent}
                    />
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center space-y-4 max-w-md my-auto h-full min-h-[400px]">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand shadow-md">
                    <ImagePlus className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-foreground">Interactive Preview Canvas</p>
                    <p className="text-sm text-muted-foreground px-4 leading-relaxed">
                      Choose a template or write a prompt on the left to instantly generate high-reach posts and view previews here.
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Subtle bottom fade to indicate scrollability */}
            {(caption || media || isRenderingMedia || postType === "carousel") && (
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-secondary/10 dark:from-secondary/20 to-transparent pointer-events-none rounded-b-2xl" />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
