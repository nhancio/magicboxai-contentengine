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
      setSelectedPresetId(creatorPresets[0].id);
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
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8 animate-fade-in">
      <header>
        <span className="eyebrow">Create</span>
        <h1 className="mt-2 font-display text-3xl md:text-4xl text-foreground flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-brand" /> Studio
        </h1>
        <p className="mt-2 text-muted-foreground">
          Select your channel, choose a post type, provide creative direction, and create.
        </p>
      </header>

      {/* STEP 1: SELECT CHANNEL */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <span>1</span> · Select Channel
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {CHANNELS.map((ch) => {
            const Icon = ch.icon;
            const isSelected = channel === ch.id;
            const isConnected = (accounts ?? []).some(
              (a: any) => a.platform === ch.id && a.status === "active"
            );

            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setChannel(ch.id)}
                className={cn(
                  "inline-flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                  isSelected
                    ? "border-brand bg-brand/10 text-brand ring-2 ring-brand/30 shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-brand/40 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{ch.label}</span>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/70">(Link)</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* STEP 2: SELECT POST TYPE */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <span>2</span> · Select Post Type for {CHANNELS.find((c) => c.id === channel)?.label}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {availablePostTypes.map((pt) => {
            const Icon = pt.icon;
            const isSelected = postType === pt.id;
            return (
              <button
                key={pt.id}
                type="button"
                onClick={() => setPostType(pt.id)}
                className={cn(
                  "flex flex-col items-start rounded-xl border p-4 text-left transition-all",
                  isSelected
                    ? "border-brand bg-brand/10 ring-2 ring-brand/30 shadow-sm"
                    : "border-border bg-card hover:border-brand/40"
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      isSelected ? "bg-brand text-brand-foreground" : "bg-secondary text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-foreground text-sm">{pt.label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{pt.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {(postType === "video" || postType === "reel" || postType === "image") && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-brand" />
                Trend-picked creator templates
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose a format and create immediately. MagicBox supplies the prompt, hook structure, and shot direction.
              </p>
            </div>
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] text-muted-foreground">
              Refreshed from the live trend brief
            </span>
          </div>

          {creatorPresets === undefined ? (
            <div className="flex h-28 items-center justify-center rounded-2xl border border-border bg-card">
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {creatorPresets.slice(0, 8).map((preset) => {
                const active = preset.id === selectedPresetId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={cn(
                      "group relative min-h-40 overflow-hidden rounded-2xl border p-4 text-left transition-all",
                      active
                        ? "border-brand bg-brand/10 ring-2 ring-brand/25 shadow-sm"
                        : "border-border bg-card hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-sm",
                    )}
                  >
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-secondary px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                        {preset.category ?? "Creator"}
                      </span>
                      {preset.isTrending ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
                          <TrendingUp className="h-2.5 w-2.5" /> Trending now
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">{preset.name}</h3>
                    <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {preset.description}
                    </p>
                    {preset.matchedTrend ? (
                      <p className="mt-3 line-clamp-1 text-[10px] font-medium text-brand">
                        Signal: {preset.matchedTrend}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {selectedPreset?.rightsNote ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{selectedPreset.rightsNote}</span>
            </div>
          ) : null}
        </section>
      )}

      {postType === "carousel" ? (
        <section className="space-y-4">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            3 &amp; 4 · Carousel Builder
          </h2>
          <Carousel embedded />
        </section>
      ) : (
        <>
          {/* STEP 3: INPUT PROMPT / CREATIVE / MEDIA */}
          <section className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xs">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <span>3</span> · Provide Creative Direction &amp; Assets
            </h2>

            {/* Prompt Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {postType === "video" || postType === "image"
                  ? "Optional creative direction"
                  : "Prompt / Idea / Topic"}{" "}
                <span className="text-muted-foreground font-normal">
                  {postType === "video" || postType === "image"
                    ? "(the selected template already includes a complete prompt)"
                    : "(provide text or upload media)"}
                </span>
              </Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  postType === "video" || postType === "image"
                    ? selectedPreset?.starterPrompt || "Add a product, offer, or campaign detail—or leave blank to use the template."
                    : "e.g. Write a thought-provoking post on why AI content creation is transforming marketing teams..."
                }
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Tone Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tone of Voice</Label>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      tone === t
                        ? "border-brand bg-brand/10 text-brand font-semibold"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Avatar Selection for Video */}
            {postType === "video" && avatars.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Avatar (Optional)</Label>
                <div className="flex flex-wrap gap-2">
                  {avatars.map((a) => {
                    const active = avatarId === a.id;
                    const thumb = a.photoUrls?.[0];
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAvatarId(avatarId === a.id ? "" : (a.id ?? ""))}
                        className={cn(
                          "flex w-[88px] flex-col items-center gap-1 rounded-xl border p-2 text-center transition-colors",
                          active
                            ? "border-brand bg-brand/10 ring-1 ring-brand"
                            : "border-border hover:border-brand/40"
                        )}
                      >
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-secondary">
                          {thumb ? (
                            <img src={thumb} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <span className="w-full truncate text-[10px] font-medium">{a.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* WhatsApp Options */}
            {channel === "whatsapp" && (
              <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
                <div className="space-y-1.5">
                  <Label>WhatsApp Recipients (Opted-in)</Label>
                  <Input
                    value={whatsappRecipients}
                    onChange={(e) => setWhatsappRecipients(e.target.value)}
                    placeholder="e.g. 919876543210, 14155552671"
                  />
                  <p className="text-xs text-muted-foreground">
                    E.164 phone numbers with country code, separated by commas.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Template Name (Optional)</Label>
                  <Input
                    value={whatsappTemplateName}
                    onChange={(e) => setWhatsappTemplateName(e.target.value)}
                    placeholder="e.g. marketing_update_v1"
                  />
                </div>
              </div>
            )}

            {/* Upload Image / Video */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Upload Media <span className="text-muted-foreground font-normal">(Optional — upload photo or video)</span>
              </Label>

              {media ? (
                <div className="relative inline-flex items-center gap-3 rounded-xl border border-border bg-secondary/50 p-3 pr-8">
                  {media.type === "video" ? (
                    <video src={media.url} className="h-16 w-16 rounded-lg object-cover" muted />
                  ) : (
                    <img src={media.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  )}
                  <div>
                    <p className="text-xs font-semibold capitalize text-foreground">{media.type} Attached</p>
                    <p className="text-[11px] text-muted-foreground">Source: {media.source}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMedia(null)}
                    className="absolute top-2 right-2 rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                    title="Remove media"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground">
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  ) : (
                    <Upload className="h-4 w-4 text-brand" />
                  )}
                  <span>{isUploading ? "Uploading file..." : "Click to upload Image or Video file"}</span>
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
              )}
            </div>

            {/* STEP 4: CREATE BUTTON */}
            <div className="border-t border-border pt-4">
              <Button
                size="lg"
                onClick={handleCreate}
                disabled={
                  isCreating ||
                  isRenderingMedia ||
                  (!prompt.trim() &&
                    !media &&
                    !((postType === "video" || postType === "image") && selectedPreset?.starterPrompt))
                }
                className="w-full sm:w-auto px-8"
              >
                {isCreating || isRenderingMedia ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating post &amp; creative...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {(postType === "video" || postType === "image") && selectedPreset
                      ? `Create with ${selectedPreset.name}`
                      : "Create Post"}
                  </>
                )}
              </Button>
            </div>
          </section>

          {/* STEP 5: PREVIEW & PUBLISH */}
          {(caption || media || isRenderingMedia) && (
            <section className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <span>5</span> · Live Preview &amp; Actions
              </h2>

              <div className="grid gap-8 lg:grid-cols-12 items-start">
                {/* Platform Preview Column */}
                <div className="lg:col-span-6 flex justify-center bg-secondary/20 p-4 rounded-xl border border-border/50">
                  <div className="w-full max-w-sm">
                    {isRenderingMedia && !media ? (
                      <div className="flex aspect-[9/16] w-full flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center">
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
                </div>

                {/* Edit & Action Column */}
                <div className="lg:col-span-6 space-y-5">
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
                      rows={5}
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
                        disabled={isRenderingMedia || !prompt.trim()}
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
                          connect channel in Settings
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
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
