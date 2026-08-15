import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { isConvexConfigured } from "../lib/convex";
import { studioKey, usePersistentState, type StudioField } from "../lib/drafts";
import { useAuth } from "@shared/lib/auth";
import { getPhotoAvatars, type PhotoAvatarRecord } from "@shared/lib/firestore";
import { rewriteAsUGC } from "@shared/lib/gemini";
import { Button } from "@shared/components/ui/button";
import { Label } from "@shared/components/ui/label";
import { Textarea } from "@shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/components/ui/select";
import { cn } from "@shared/lib/utils";
import Carousel from "./Carousel";
import PlatformPreview, { type PreviewContent } from "../components/previews/PlatformPreview";
import CreativeImageLoader from "../components/common/CreativeImageLoader";
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
  AlertCircle,
  ArrowRight,
  LockKeyhole,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@shared/components/ui/dialog";

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

type StudioMedia = { type: "image" | "video"; url: string; source: string };

function cleanErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  let cleaned = raw
    .replace(/(?:\[CONVEX\s+[^\]]+\]\s*)+/g, "")
    .replace(/(?:Uncaught\s+)?Error:\s*/g, "")
    .trim();
  if (!cleaned) cleaned = "Image generation service encountered an error. Please try again.";
  return cleaned;
}

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

  // Draft state — persisted so leaving Studio mid-generation doesn't lose the
  // post. Writes go straight to storage, so a generation that lands after the
  // page unmounted is still here when the user returns.
  const uid = user?.uid ?? "anon";
  const key = (field: StudioField) => studioKey(uid, field);

  // Form State
  const [channel, setChannel] = usePersistentState<string>(key("channel"), "instagram");
  const [postType, setPostType] = usePersistentState<PostType>(key("postType"), "image");
  const [selectedPresetId, setSelectedPresetId] = usePersistentState(key("selectedPresetId"), "");
  const [prompt, setPrompt] = usePersistentState(key("prompt"), "");
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const [tone, setTone] = usePersistentState<(typeof TONES)[number]>(key("tone"), "Casual");
  const [avatars, setAvatars] = useState<PhotoAvatarRecord[]>([]);
  const [avatarId, setAvatarId] = usePersistentState(key("avatarId"), "");

  // Uploaded or Generated Media
  const [media, setMedia] = usePersistentState<StudioMedia | null>(key("media"), null);
  const [videoJobId, setVideoJobId] = usePersistentState<string | null>(key("videoJobId"), null);

  // WhatsApp specific inputs
  const [whatsappRecipients, setWhatsappRecipients] = usePersistentState(key("whatsappRecipients"), "");
  const [whatsappTemplateName, setWhatsappTemplateName] = usePersistentState(key("whatsappTemplateName"), "");

  // Generated Post State
  const [caption, setCaption] = usePersistentState(key("caption"), "");
  const [hashtags, setHashtags] = usePersistentState(key("hashtags"), "");

  // Loading States
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isRenderingMedia, setIsRenderingMedia] = usePersistentState(key("isRenderingMedia"), false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [posting, setPosting] = useState<null | "now" | "schedule" | "draft">(null);

  // Big Modal for Free Version / Trial Over
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalInfo, setUpgradeModalInfo] = useState<{
    title: string;
    description: string;
    badge: string;
  }>({
    title: "Your Free Trial Has Ended",
    description:
      "You have reached the limit of free AI creations. Upgrade to MagicBox Pro to continue generating high-converting posts, photorealistic AI visuals, and automated multi-channel campaigns.",
    badge: "Free Trial Expired",
  });

  function reportGenerationError(prefix: string, e: unknown): string {
    const message = cleanErrorMessage(e);
    if (/TrialExpired|free trial has ended|trial.*expired/i.test(message)) {
      setUpgradeModalInfo({
        title: "Your Free Trial Has Ended",
        description:
          "You've used all complimentary creative generations on your free trial. Upgrade to MagicBox Pro to keep creating unlimited AI posts, photorealistic images, AI video reels, and scheduling to all your social channels.",
        badge: "Free Trial Expired",
      });
      setUpgradeModalOpen(true);
      toast.error("Your free trial has ended. Upgrade a plan to keep creating.", {
        action: { label: "View plans", onClick: () => (window.location.href = "/pricing?plan=pro") },
      });
      return "Your free trial has ended. Upgrade a plan to keep creating.";
    }
    if (/InsufficientCredits|not enough credits|out of credits/i.test(message)) {
      setUpgradeModalInfo({
        title: "You're Out of Credits",
        description:
          "You've exhausted your generation credits. Upgrade your subscription or top up credits to keep generating photorealistic AI media, videos, and multi-channel campaigns.",
        badge: "Credits Depleted",
      });
      setUpgradeModalOpen(true);
      toast.error("You're out of credits. Upgrade to keep creating.", {
        action: { label: "View plans", onClick: () => (window.location.href = "/pricing?plan=pro") },
      });
      return "You're out of credits. Upgrade to keep creating.";
    }
    toast.error(`${prefix}: ${message.slice(0, 140)}`);
    return message;
  }

  // A channel/type in the URL ("create a Reel" from the dashboard) is an explicit
  // intent, so it wins over whatever the restored draft was using.
  useEffect(() => {
    const requestedChannel = searchParams.get("channel");
    if (requestedChannel && CHANNELS.some((c) => c.id === requestedChannel)) {
      setChannel(requestedChannel);
    }
    if (searchParams.get("type") || searchParams.get("mode")) {
      setPostType(initialPostType(searchParams));
    }
    // Only a video job survives a reload; a stranded image render would spin forever.
    if (isRenderingMedia && !videoJobId) setIsRenderingMedia(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Auto-grow the prompt textarea to fit its content (no inner scroll until it
  // gets very tall), including when a preset pre-fills it programmatically.
  useEffect(() => {
    const el = promptRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = Math.round(window.innerHeight * 0.5);
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [prompt]);

  useEffect(() => {
    const el = captionRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflowY = "hidden";
  }, [caption]);

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

  // Step 4: Handle "Create" or "Regenerate"
  async function handleCreate(options?: { forceRegenerateMedia?: boolean }) {
    if (postType === "carousel") {
      toast.info("Generate the carousel from the preview canvas.");
      return;
    }

    const forceNewMedia = options?.forceRegenerateMedia ?? false;
    const templateBrief =
      postType === "video" || postType === "image" ? selectedPreset?.starterPrompt : undefined;
    const effectiveBrief = prompt.trim() || templateBrief;
    if (!effectiveBrief && !media) {
      toast.error("Choose a template, provide a topic, or upload media to create your post.");
      return;
    }

    setIsCreating(true);
    setMediaError(null);
    if (forceNewMedia) {
      setMedia(null);
    }
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
      const formattedTags = (copyRes.hashtags ?? [])
        .map((h) => (h.startsWith("#") ? h : `#${h.replace(/^[#\s]+/, "")}`))
        .filter(Boolean)
        .join(" ");
      setHashtags(formattedTags);

      // Media is a separate step so a video/image credit failure still leaves
      // the caption on screen instead of looking like the whole create died.
      if (!media || forceNewMedia) {
        const mediaPrompt = copyRes.mediaPrompt || effectiveBrief;
        try {
          if (postType === "image" && mediaPrompt) {
            setIsRenderingMedia(true);
            const imgRes = await generateImage({
              prompt: mediaPrompt,
              aspectRatio: aspectFor(channel),
            });
            setMedia({ type: "image", url: imgRes.url, source: "imagen" });
            setMediaError(null);
            setIsRenderingMedia(false);
          } else if ((postType === "video" || postType === "reel") && mediaPrompt) {
            setIsRenderingMedia(true);
            const vidRes = await generateVideo({
              prompt: mediaPrompt,
              aspectRatio: aspectFor(channel),
            });
            setVideoJobId(vidRes.jobId as unknown as string);
            setMediaError(null);
            toast.info("Generating AI Video — this may take 1-2 minutes.");
          }
        } catch (e) {
          setIsRenderingMedia(false);
          const err = reportGenerationError("Could not generate media", e);
          setMediaError(err);
          return;
        }
      }

      toast.success(caption || media ? "Post regenerated with fresh creative!" : "Post created! Review and publish below.");
    } catch (e) {
      setIsRenderingMedia(false);
      const err = reportGenerationError("Could not create post", e);
      setMediaError(err);
    } finally {
      setIsCreating(false);
    }
  }

  // Regenerate all content (copy, hashtags, and media)
  async function handleRegenerateAll() {
    await handleCreate({ forceRegenerateMedia: true });
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
    setMediaError(null);
    try {
      if (postType === "image") {
        const imgRes = await generateImage({
          prompt: effectivePrompt,
          aspectRatio: aspectFor(channel),
        });
        setMedia({ type: "image", url: imgRes.url, source: "imagen" });
        setMediaError(null);
        setIsRenderingMedia(false);
      } else if (postType === "video" || postType === "reel") {
        const vidRes = await generateVideo({
          prompt: effectivePrompt,
          aspectRatio: aspectFor(channel),
        });
        setVideoJobId(vidRes.jobId as unknown as string);
        setMediaError(null);
        toast.info("Generating new AI Video...");
      }
    } catch (e) {
      setIsRenderingMedia(false);
      const err = reportGenerationError("Could not generate media", e);
      setMediaError(err);
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
          .filter(Boolean)
          .map((h) => (h.startsWith("#") ? h : `#${h.replace(/^[#\s]+/, "")}`)),
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
      setMediaError(null);
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

  const hasEditPanel = Boolean(caption || media || isRenderingMedia || mediaError) && postType !== "carousel";

  const previewContent: PreviewContent = {
    caption,
    hashtags: hashtags
      .split(/\s+/)
      .map((h) => h.trim())
      .filter(Boolean)
      .map((h) => (h.startsWith("#") ? h : `#${h.replace(/^[#\s]+/, "")}`)),
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
    mediaError,
    onRetryMedia: () => void handleRegenerateMedia(),
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden animate-fade-in gap-3">
      {/* Top Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-border/40 pb-2">
        <div>
          <span className="eyebrow text-[10px]">Create</span>
          <h1 className="flex items-center gap-2 font-display text-xl sm:text-2xl text-foreground">
            <Sparkles className="h-5 w-5 text-brand" /> Studio
          </h1>
        </div>
        {primaryBrand && (
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground shadow-sm">
            {primaryBrand.logoUrl && (
              <img src={primaryBrand.logoUrl} alt="" className="h-4 w-4 rounded-full object-contain" />
            )}
            <span className="font-medium text-foreground">{primaryBrand.name}</span>
          </div>
        )}
      </header>

      {/* Middle Workspace Area (Always fits within viewport at 100% zoom) */}
      <div className="flex-1 min-h-0 w-full overflow-hidden">
        {postType === "carousel" ? (
          <div className="h-full w-full overflow-y-auto pr-1">
            <Carousel embedded />
          </div>
        ) : (
          <div
            className={cn(
              "grid h-full w-full min-w-0 gap-4 overflow-hidden",
              hasEditPanel ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1",
            )}
          >
            {/* Left Edit & Publish Card (Internally scrollable if needed on smaller viewports, page never scrolls) */}
            {hasEditPanel && (
              <div className="flex h-full flex-col min-w-0 overflow-y-auto rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-3.5 no-scrollbar">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    2. Edit & Publish Options
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isCreating || isRenderingMedia}
                    onClick={() => void handleRegenerateAll()}
                    className="h-6 px-2 text-[11px] font-medium text-brand hover:bg-brand/10"
                    title="Regenerate all content (copy, hashtags & AI media)"
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Regenerate Post
                  </Button>
                </div>

                {/* Caption */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs font-medium">Caption</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isRewriting || !caption.trim()}
                      onClick={() => void handleRewriteUgc()}
                      className="h-6 shrink-0 px-2 text-[11px] text-brand hover:bg-brand/10"
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
                    ref={captionRef}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={3}
                    className="min-h-[4.5rem] w-full overflow-hidden text-xs leading-relaxed"
                  />
                </div>

                {/* Hashtags */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Hashtags</Label>
                  <Textarea
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    onBlur={() => {
                      if (hashtags.trim()) {
                        const formatted = hashtags
                          .split(/\s+/)
                          .map((h) => h.trim())
                          .filter(Boolean)
                          .map((h) => (h.startsWith("#") ? h : `#${h.replace(/^[#\s]+/, "")}`))
                          .join(" ");
                        setHashtags(formatted);
                      }
                    }}
                    placeholder="#marketing #ai #growth"
                    rows={2}
                    className="min-h-[2.5rem] w-full overflow-hidden text-xs leading-relaxed"
                  />
                </div>

                {/* Media Generation Failure banner */}
                {mediaError && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="font-semibold">AI Media Generation Failed</p>
                      <p className="text-destructive/90 leading-relaxed">{mediaError}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerateMedia}
                      disabled={isRenderingMedia}
                      className="h-7 shrink-0 text-xs border-destructive/30 hover:bg-destructive/20"
                    >
                      <RefreshCw className="mr-1 h-3 w-3" /> Retry
                    </Button>
                  </div>
                )}

                {/* Regenerate AI Media button */}
                {postType !== "text" && postType !== "post" && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerateMedia}
                      disabled={isRenderingMedia || (!prompt.trim() && !selectedPreset?.starterPrompt)}
                      className="h-7 text-xs"
                    >
                      {isRenderingMedia ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1.5 h-3 w-3" />
                      )}
                      Regenerate AI Media
                    </Button>
                  </div>
                )}

                {/* No active account alert */}
                {!connectedAccount && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
                    <Link2 className="h-4 w-4 shrink-0" />
                    <span>
                      No active {channel} account connected. You can publish as draft or{" "}
                      <Link to="/settings" className="underline font-semibold">
                        connect channel
                      </Link>.
                    </span>
                  </div>
                )}

                {/* Publish Options */}
                <div className="mt-auto space-y-2 border-t border-border pt-3">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    Publish Options
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Button
                      onClick={() => void handlePublish("now")}
                      disabled={posting !== null}
                      className="w-full h-8 text-xs"
                    >
                      {posting === "now" ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Post Now
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => void handlePublish("schedule")}
                      disabled={posting !== null}
                      className="w-full h-8 text-xs"
                    >
                      {posting === "schedule" ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Post Best Time
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => void handlePublish("draft")}
                      disabled={posting !== null}
                      className="w-full h-8 text-xs"
                    >
                      {posting === "draft" ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Save to Draft
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Right Preview Card */}
            <div
              className={cn(
                "flex h-full min-w-0 w-full items-center justify-center rounded-2xl border border-border/70 bg-secondary/10 p-3 sm:p-4 shadow-inner dark:bg-secondary/20 overflow-hidden",
              )}
            >
              {caption || media || isRenderingMedia || mediaError ? (
                <div className="mx-auto w-full max-w-sm max-h-full overflow-y-auto no-scrollbar flex items-center justify-center">
                  {isRenderingMedia && !media ? (
                    <CreativeImageLoader
                      aspectRatio="9:16"
                      title="Rendering AI Creative..."
                      subtitle={`Generating high-quality media for ${channel}`}
                      className="w-full max-h-[68vh]"
                    />
                  ) : (
                    <div className="w-full">
                      <PlatformPreview
                        platform={channel as SocialPlatform}
                        content={previewContent}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-3 px-4 py-8 text-center max-w-md">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand shadow-md">
                    <ImagePlus className="h-7 w-7" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">Interactive Preview Canvas</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Choose a template or write your idea below to generate high-reach posts and view previews here in real time.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step 3: Pinned Docked Gemini-Style Input Bar (Always docked at bottom of screen) */}
      <div className="shrink-0 w-full">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg transition-all focus-within:border-brand/50 focus-within:ring-1 focus-within:ring-brand/40">
          {/* Top pills row for Channel, Post Type, Tone, Template */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border/40 bg-secondary/15 px-3 py-1.5 sm:px-4">
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="h-7 w-auto min-w-[105px] gap-1.5 rounded-full border-border/60 bg-background/80 px-2.5 text-xs shadow-none hover:bg-secondary">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((ch) => (
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
              <SelectTrigger className="h-7 w-auto min-w-[105px] gap-1.5 rounded-full border-border/60 bg-background/80 px-2.5 text-xs shadow-none hover:bg-secondary">
                <SelectValue placeholder="Post Type" />
              </SelectTrigger>
              <SelectContent>
                {availablePostTypes.map((pt) => (
                  <SelectItem key={pt.id} value={pt.id}>
                    <div className="flex items-center gap-2">
                      <pt.icon className="h-3.5 w-3.5" />
                      {pt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tone} onValueChange={(v) => setTone(v as (typeof TONES)[number])}>
              <SelectTrigger className="h-7 w-auto min-w-[90px] gap-1.5 rounded-full border-border/60 bg-background/80 px-2.5 text-xs shadow-none hover:bg-secondary">
                <SelectValue placeholder="Tone" />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {creatorPresets && creatorPresets.length > 0 && (
              <Select
                value={selectedPresetId}
                onValueChange={(v) => {
                  setSelectedPresetId(v);
                  const preset = creatorPresets.find((p) => p.id === v);
                  if (preset?.starterPrompt) setPrompt(preset.starterPrompt);
                }}
              >
                <SelectTrigger className="h-7 w-auto min-w-[125px] gap-1.5 rounded-full border-brand/30 bg-brand/5 px-2.5 text-xs font-medium text-brand shadow-none hover:bg-brand/10">
                  <Wand2 className="h-3 w-3" />
                  <SelectValue placeholder="Template" />
                </SelectTrigger>
                <SelectContent>
                  {creatorPresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      <div className="flex flex-col">
                        <span>{preset.name}</span>
                        <span className="max-w-[200px] truncate text-[10px] text-muted-foreground">
                          {preset.category ?? "Creator"}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Prompt row (Gemini-style input) */}
          <div className="p-2 sm:p-2.5">
            {media && (
              <div className="relative mb-2 inline-flex items-center gap-2 self-start rounded-lg border border-border bg-secondary/30 p-1.5 pr-6">
                {media.type === "video" ? (
                  <video src={media.url} className="h-7 w-7 rounded object-cover" muted />
                ) : (
                  <img src={media.url} alt="" className="h-7 w-7 rounded object-cover" />
                )}
                <p className="text-[11px] font-semibold capitalize text-foreground">{media.type} Attached</p>
                <button
                  type="button"
                  onClick={() => setMedia(null)}
                  className="absolute right-1 top-1 h-4 w-4 rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                title="Upload media"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-brand" />
                ) : (
                  <Upload className="h-4 w-4" />
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
                ref={promptRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  postType === "video" || postType === "image"
                    ? selectedPreset?.starterPrompt || "Message Maya to create..."
                    : "Message Maya to create..."
                }
                rows={1}
                className="min-h-[36px] max-h-24 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-1 py-2 text-[13px] leading-relaxed text-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (caption || media) {
                      void handleRegenerateAll();
                    } else {
                      void handleCreate();
                    }
                  }
                }}
              />

              {/* Regenerate button (A): visible when content already exists so user can easily regenerate if they don't like it */}
              {(Boolean(caption) || Boolean(media)) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleRegenerateAll()}
                  disabled={isCreating || isRenderingMedia}
                  className="h-9 shrink-0 gap-1.5 rounded-xl border-border bg-secondary/40 px-3 text-xs font-semibold text-foreground shadow-sm hover:bg-secondary hover:text-foreground"
                  title="Regenerate all content (copy, hashtags & AI media)"
                >
                  {isCreating || isRenderingMedia ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 text-brand" />
                  )}
                  <span>Regenerate</span>
                </Button>
              )}

              {/* Generate / Update with new prompt */}
              <Button
                onClick={() => void handleCreate()}
                disabled={
                  isCreating ||
                  isRenderingMedia ||
                  (!prompt.trim() &&
                    !media &&
                    !((postType === "video" || postType === "image") && selectedPreset?.starterPrompt) &&
                    !primaryBrand)
                }
                className={cn(
                  "flex h-9 shrink-0 items-center justify-center rounded-xl px-3.5 shadow-sm transition-all text-xs font-semibold gap-1.5",
                  prompt.trim() || media || selectedPreset
                    ? "bg-brand text-brand-foreground hover:bg-brand/90"
                    : "bg-secondary text-muted-foreground",
                )}
                title={caption || media ? "Generate with new prompt" : "Generate post"}
              >
                {isCreating || isRenderingMedia ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>{caption || media ? "Update" : "Generate"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Big Popup Dialog for Free Version Over / Out of Credits */}
      <Dialog open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
          <DialogHeader className="space-y-3 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 font-mono text-[11px] font-semibold text-brand uppercase tracking-wider">
                <LockKeyhole className="h-3.5 w-3.5" />
                {upgradeModalInfo.badge}
              </span>
            </div>
            <DialogTitle className="font-display text-2xl sm:text-3xl tracking-tight text-foreground">
              {upgradeModalInfo.title}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {upgradeModalInfo.description}
            </DialogDescription>
          </DialogHeader>

          {/* Feature benefits list */}
          <div className="my-2 space-y-2 rounded-xl border border-border/60 bg-secondary/20 p-4">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Unlock with MagicBox Pro:
            </p>
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>Unlimited AI copy & captions</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>Photorealistic AI image synthesis</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>AI Reel & video generation</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>Multi-channel auto publishing</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setUpgradeModalOpen(false);
                window.location.href = "/pricing";
              }}
              className="w-full sm:w-auto text-xs"
            >
              View All Plans
            </Button>
            <Button
              onClick={() => {
                setUpgradeModalOpen(false);
                window.location.href = "/pricing?plan=pro";
              }}
              className="w-full sm:w-auto bg-brand text-brand-foreground hover:bg-brand/90 gap-1.5 text-xs font-semibold shadow-md"
            >
              <span>Upgrade to Pro</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
