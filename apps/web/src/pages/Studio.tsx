import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
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
  Link2,
  ImagePlus,
  Film,
  Type,
  RefreshCw,
  Layers,
  User,
} from "lucide-react";

/**
 * STUDIO — unified create surface.
 *
 * Top modes: Video · Carousel · Post. Templates for the active mode appear
 * underneath. Carousel embeds the carousel creator; Video/Post use Convex presets.
 */

type StudioMode = "video" | "carousel" | "post";

const STUDIO_MODES: {
  id: StudioMode;
  label: string;
  icon: typeof Film;
  blurb: string;
}[] = [
  { id: "video", label: "Video", icon: Film, blurb: "Reels, Shorts, talking-head" },
  { id: "carousel", label: "Carousel", icon: Layers, blurb: "Multi-slide branded posts" },
  { id: "post", label: "Post", icon: Type, blurb: "Image or text-only" },
];

const TONES = ["Professional", "Casual", "Funny", "Inspirational", "Educational", "Bold"] as const;

const PLATFORM_ICON: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  youtube: Youtube,
  whatsapp: MessageCircle,
};

const VERTICAL = new Set(["instagram", "youtube", "facebook", "reddit", "whatsapp"]);
const aspectFor = (p: string) => (VERTICAL.has(p) ? "9:16" : "1:1");

const MEDIA_ICON = { video: Film, image: ImagePlus, none: Type } as const;

type Preset = {
  id: string;
  name: string;
  description: string;
  platforms: string[];
  mediaType: "video" | "image" | "none";
  inputs: { key: string; required: boolean; label: string }[];
};

type Copy = { hook: string; caption: string; hashtags: string[]; mediaPrompt?: string };

function modeFromParam(raw: string | null): StudioMode {
  if (raw === "carousel" || raw === "post" || raw === "video") return raw;
  return "video";
}

export default function Studio() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = modeFromParam(searchParams.get("mode"));

  const presets = useQuery(api.studio.presets, isConvexConfigured ? {} : "skip") as
    | Preset[]
    | undefined;
  const accounts = useQuery(api.social.accounts, isConvexConfigured ? {} : "skip");

  const generateCopy = useAction(api.studio.generateCopy);
  const generateImage = useAction(api.media.generateImage);
  const generateVideo = useAction(api.media.generateVideo);
  const createPost = useAction(api.studio.createPost);
  const uploadUrl = useMutation(api.studio.uploadUrl);
  const resolveUpload = useMutation(api.studio.resolveUpload);

  const [preset, setPreset] = useState<Preset | null>(null);
  const [platform, setPlatform] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [productName, setProductName] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]>("Casual");
  const [avatars, setAvatars] = useState<PhotoAvatarRecord[]>([]);
  const [avatarId, setAvatarId] = useState("");
  const [productImage, setProductImage] = useState<{ url: string; source: string } | null>(null);
  const [uploadingProduct, setUploadingProduct] = useState(false);
  const [rewriting, setRewriting] = useState(false);

  const [copy, setCopy] = useState<Copy | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [whatsappRecipients, setWhatsappRecipients] = useState("");
  const [whatsappTemplateName, setWhatsappTemplateName] = useState("");

  const [media, setMedia] = useState<{ type: "image" | "video"; url: string; source: string } | null>(
    null,
  );
  const [videoJobId, setVideoJobId] = useState<string | null>(null);

  const [writing, setWriting] = useState(false);
  const [renderingMedia, setRenderingMedia] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState<null | "now" | "schedule" | "draft">(null);

  const filteredPresets = useMemo(() => {
    if (!presets) return undefined;
    if (mode === "video") return presets.filter((p) => p.mediaType === "video");
    if (mode === "post") return presets.filter((p) => p.mediaType === "image" || p.mediaType === "none");
    return [];
  }, [presets, mode]);

  useEffect(() => {
    if (!user) return;
    getPhotoAvatars(user.uid)
      .then((list) => setAvatars(list.filter((a) => a.status === "ready")))
      .catch(() => setAvatars([]));
  }, [user]);

  // Clear preset when switching away from a format that doesn't include it.
  useEffect(() => {
    if (mode === "carousel") {
      setPreset(null);
      return;
    }
    if (preset && filteredPresets && !filteredPresets.some((p) => p.id === preset.id)) {
      setPreset(null);
    }
  }, [mode, filteredPresets, preset]);

  function setMode(next: StudioMode) {
    const nextParams = new URLSearchParams(searchParams);
    if (next === "video") nextParams.delete("mode");
    else nextParams.set("mode", next);
    setSearchParams(nextParams, { replace: true });
  }

  // Poll the Veo job until the video is ready (reactive — no manual polling).
  const job = useQuery(api.media.job, videoJobId ? { jobId: videoJobId as any } : "skip");
  useEffect(() => {
    if (!job) return;
    if (job.status === "completed" && job.url) {
      setMedia({ type: "video", url: job.url, source: "veo" });
      setRenderingMedia(false);
      setVideoJobId(null);
    } else if (job.status === "failed") {
      setRenderingMedia(false);
      setVideoJobId(null);
      toast.error(`Video failed: ${job.error ?? "unknown error"}`);
    }
  }, [job]);

  const connectedForPlatform = useMemo(
    () => (accounts ?? []).filter((a: any) => a.status === "active" && a.platform === platform),
    [accounts, platform],
  );

  function choosePreset(p: Preset) {
    setPreset(p);
    setPlatform(p.platforms[0] ?? "instagram");
    setCopy(null);
    setMedia(null);
    setVideoJobId(null);
    setProductImage(null);
  }

  const selectedAvatar = avatars.find((a) => a.id === avatarId) ?? null;

  const requiredInputs = preset?.inputs.filter((i) => i.required).map((i) => i.key) ?? [];
  const missingRequired =
    (requiredInputs.includes("prompt") && !prompt.trim()) ||
    (requiredInputs.includes("productName") && !productName.trim()) ||
    (requiredInputs.includes("avatar") && !avatarId) ||
    (requiredInputs.includes("images") && !productImage);

  async function handleGenerateCopy() {
    if (!preset) return;
    setWriting(true);
    try {
      const avatarContext = selectedAvatar
        ? `Avatar: ${selectedAvatar.name}. Personality: ${selectedAvatar.personality}. Voice: ${selectedAvatar.voiceTone}.`
        : "";
      const r = (await generateCopy({
        presetId: preset.id,
        platform,
        prompt: prompt || undefined,
        context: [tone && `Tone: ${tone}`, avatarContext, context].filter(Boolean).join("\n") || undefined,
        productName: productName || undefined,
      })) as Copy;
      setCopy(r);
      setCaption(r.caption);
      setHashtags((r.hashtags ?? []).join(" "));
    } catch (e) {
      toast.error(`Couldn't write copy: ${String(e).slice(0, 120)}`);
    } finally {
      setWriting(false);
    }
  }

  async function handleRewriteUgc() {
    if (!caption.trim()) {
      toast.error("Write or generate a caption first.");
      return;
    }
    setRewriting(true);
    try {
      const rewritten = await rewriteAsUGC({
        text: caption,
        avatarPersonality: selectedAvatar?.personality || "Friendly creator",
        tone,
      });
      setCaption(rewritten);
      toast.success("Rewrote in UGC voice");
    } catch (e) {
      toast.error(`Rewrite failed: ${String(e).slice(0, 120)}`);
    } finally {
      setRewriting(false);
    }
  }

  async function handleProductImageUpload(file: File) {
    setUploadingProduct(true);
    try {
      const url = await uploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: string };
      const resolved = await resolveUpload({ storageId });
      setProductImage({ url: resolved.url, source: "upload" });
      // Also seed final media if none yet — product shot can be the post image.
      if (!media) setMedia({ type: "image", url: resolved.url, source: "upload" });
      toast.success("Product photo added");
    } catch (e) {
      toast.error(`Upload failed: ${String(e).slice(0, 120)}`);
    } finally {
      setUploadingProduct(false);
    }
  }

  async function handleGenerateMedia() {
    if (!preset || preset.mediaType === "none") return;
    const mediaPrompt = copy?.mediaPrompt || prompt;
    if (!mediaPrompt) {
      toast.error("Generate copy first (it produces the media prompt).");
      return;
    }
    setRenderingMedia(true);
    setMedia(null);
    try {
      if (preset.mediaType === "image") {
        const r = await generateImage({ prompt: mediaPrompt, aspectRatio: aspectFor(platform) });
        setMedia({ type: "image", url: r.url, source: "imagen" });
        setRenderingMedia(false);
      } else {
        const { jobId } = await generateVideo({
          prompt: mediaPrompt,
          aspectRatio: aspectFor(platform),
        });
        setVideoJobId(jobId as unknown as string);
        toast.success("Rendering video — this takes a minute or two.");
      }
    } catch (e) {
      setRenderingMedia(false);
      toast.error(`Media generation failed: ${String(e).slice(0, 120)}`);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await res.json();
      const resolved = await resolveUpload({ storageId });
      setMedia({
        type: file.type.startsWith("video") ? "video" : "image",
        url: resolved.url,
        source: "upload",
      });
      toast.success("Uploaded.");
    } catch (e) {
      toast.error(`Upload failed: ${String(e).slice(0, 120)}`);
    } finally {
      setUploading(false);
    }
  }

  async function handlePublish(mode: "now" | "schedule" | "draft") {
    if (!preset) return;
    if (!caption.trim()) {
      toast.error("Write or generate a caption first.");
      return;
    }
    if (preset.mediaType !== "none" && !media && mode !== "draft") {
      toast.error("Generate or upload media first (or save as draft).");
      return;
    }
    if (platform === "whatsapp" && mode !== "draft") {
      const recipients = whatsappRecipients
        .split(/[\s,;]+/)
        .map((n) => n.replace(/[^\d]/g, ""))
        .filter((n) => n.length >= 8);
      if (recipients.length === 0) {
        toast.error("Add at least one opted-in WhatsApp number (E.164 digits).");
        return;
      }
    }
    setPosting(mode);
    try {
      const r = await createPost({
        caption,
        hashtags: hashtags
          .split(/\s+/)
          .map((h) => h.trim())
          .filter(Boolean),
        platforms: [platform],
        mediaUrl: media?.url,
        mediaType: media?.type,
        mediaSource: media?.source,
        brief: prompt || preset.name,
        mode,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(platform === "whatsapp"
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
          toast.success(`Posted to ${r.published ?? 0}/${r.of ?? 1} channel(s).`);
        } else if (r.status === "failed") {
          toast.error("Post now failed — check Posts for the error.");
        } else if (r.status === "draft") {
          toast.warning("Saved as a draft — connect a channel to publish.", {
            action: { label: "Channels", onClick: () => (window.location.href = "/settings") },
          });
        } else {
          toast.success("Sending now — check Posts in a moment.");
        }
      } else if (mode === "schedule") {
        const when = r.scheduledFor
          ? new Date(r.scheduledFor).toLocaleString(undefined, {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
            })
          : null;
        toast.success(when ? `Queued for next best time · ${when}` : "Queued for next best time.");
      } else if (r.status === "draft") {
        toast.warning("Saved as a draft — connect a channel to publish.", {
          action: { label: "Channels", onClick: () => (window.location.href = "/settings") },
        });
      } else {
        toast.success("Draft saved.");
      }
      // Reset media/copy for the next post but keep the preset selected.
      setMedia(null);
      setCopy(null);
      setCaption("");
      setHashtags("");
    } catch (e) {
      toast.error(`Couldn't publish: ${String(e).slice(0, 140)}`);
    } finally {
      setPosting(null);
    }
  }

  if (!isConvexConfigured) {
    return (
      <div className="mx-auto max-w-md p-8 text-center text-sm text-muted-foreground">
        Studio needs <code className="font-mono">VITE_CONVEX_URL</code> configured.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8 animate-fade-in">
      <header>
        <span className="eyebrow">Create</span>
        <h1 className="mt-2 font-display text-3xl md:text-4xl text-foreground flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-brand" /> Studio
        </h1>
        <p className="mt-2 text-muted-foreground">
          Pick Video, Carousel, or Post — then choose a template and create.
        </p>
      </header>

      {/* Mode switcher — Video / Carousel / Post */}
      <div className="flex flex-wrap gap-2">
        {STUDIO_MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-brand bg-brand/10 text-brand ring-1 ring-brand/30"
                  : "border-border bg-card text-muted-foreground hover:border-brand/40 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {m.label}
            </button>
          );
        })}
      </div>

      {mode === "carousel" ? (
        <Carousel embedded />
      ) : (
        <>
          {/* Templates for active mode */}
          <section>
            <h2 className="mb-3 text-sm font-mono uppercase tracking-widest text-muted-foreground">
              {mode === "video" ? "Video templates" : "Post templates"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(filteredPresets ?? []).map((p) => {
                const MediaIcon = MEDIA_ICON[p.mediaType];
                const active = preset?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => choosePreset(p)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all",
                      active
                        ? "border-brand bg-brand/5 ring-1 ring-brand"
                        : "border-border bg-card hover:border-brand/40",
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <MediaIcon className="h-4 w-4 text-brand" />
                      <span className="font-medium text-foreground">{p.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </button>
                );
              })}
              {filteredPresets === undefined && (
                <div className="col-span-full flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {filteredPresets?.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground">
                  No templates for this format yet.
                </p>
              )}
            </div>
          </section>

      {preset && (
        <>
          {/* Step 2 — inputs */}
          <section className="space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
              2 · Details
            </h2>

            <div className="flex flex-wrap gap-2">
              {preset.platforms.map((p) => {
                const Icon = PLATFORM_ICON[p] ?? Link2;
                return (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm capitalize transition-colors",
                      platform === p
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {p}
                  </button>
                );
              })}
            </div>

            {platform === "whatsapp" && (
              <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
                <div className="space-y-1.5">
                  <Label>WhatsApp recipients (opted-in)</Label>
                  <Input
                    value={whatsappRecipients}
                    onChange={(e) => setWhatsappRecipients(e.target.value)}
                    placeholder="9198xxxxxxxx, 14155552671"
                  />
                  <p className="text-xs text-muted-foreground">
                    E.164 digits, comma-separated. Not a public feed — each send is A2P to these numbers.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Template name (optional)</Label>
                  <Input
                    value={whatsappTemplateName}
                    onChange={(e) => setWhatsappTemplateName(e.target.value)}
                    placeholder="Approved Marketing template for cold sends"
                  />
                  <p className="text-xs text-muted-foreground">
                    Required outside the 24h service window. Leave blank for session messages.
                  </p>
                </div>
              </div>
            )}

            {preset.inputs.some((i) => i.key === "avatar") && (
              <div className="space-y-2">
                <Label>
                  Avatar
                  {requiredInputs.includes("avatar") ? "" : " (optional)"}
                </Label>
                {avatars.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No ready avatars.{" "}
                    <Link to="/avatars" className="text-brand hover:underline">
                      Create one
                    </Link>
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {avatars.map((a) => {
                      const active = avatarId === a.id;
                      const thumb = a.photoUrls?.[0];
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setAvatarId(a.id ?? "")}
                          className={cn(
                            "flex w-[88px] flex-col items-center gap-1 rounded-xl border p-2 text-center transition-colors",
                            active
                              ? "border-brand bg-brand/10 ring-1 ring-brand"
                              : "border-border hover:border-brand/40",
                          )}
                        >
                          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-secondary">
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
                )}
              </div>
            )}

            {preset.inputs.some((i) => i.key === "images") && (
              <div className="space-y-2">
                <Label>
                  Product photo
                  {requiredInputs.includes("images") ? "" : " (optional)"}
                </Label>
                {productImage ? (
                  <div className="relative w-32 overflow-hidden rounded-xl border border-border">
                    <img src={productImage.url} alt="" className="aspect-square w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-md bg-background/90 px-1.5 text-[10px]"
                      onClick={() => setProductImage(null)}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground hover:border-brand/40 hover:text-foreground">
                    {uploadingProduct ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    Upload product photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingProduct}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleProductImageUpload(f);
                      }}
                    />
                  </label>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Tone</Label>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                      tone === t
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {preset.inputs.some((i) => i.key === "productName") && (
              <div className="space-y-1.5">
                <Label>Product</Label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="What are you promoting?"
                />
              </div>
            )}

            {preset.inputs.some((i) => i.key === "prompt") && (
              <div className="space-y-1.5">
                <Label>
                  {preset.inputs.find((i) => i.key === "prompt")?.label ?? "Prompt"}
                </Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe what this post should say…"
                  rows={3}
                />
              </div>
            )}

            {preset.inputs.some((i) => i.key === "context") && (
              <div className="space-y-1.5">
                <Label>Extra context (optional)</Label>
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Brand notes, audience, offers…"
                  rows={2}
                />
              </div>
            )}

            <Button onClick={handleGenerateCopy} disabled={writing || missingRequired}>
              {writing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Writing…
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" /> {copy ? "Rewrite copy" : "Generate copy"}
                </>
              )}
            </Button>
          </section>

          {/* Step 3 — review copy + media */}
          {copy && (
            <section className="space-y-4">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
                3 · Review &amp; media
              </h2>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  {copy.hook && (
                    <p className="font-serif text-xl text-foreground">{copy.hook}</p>
                  )}
                  <div className="space-y-1.5">
                    <Label>Caption</Label>
                    <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={6} />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      disabled={rewriting || !caption.trim()}
                      onClick={() => void handleRewriteUgc()}
                    >
                      {rewriting ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Rewrite as UGC
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hashtags</Label>
                    <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Media</Label>
                  <div className="flex aspect-[9/16] max-h-96 w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary/40">
                    {media?.type === "video" ? (
                      <video src={media.url} className="h-full w-full object-cover" controls loop muted />
                    ) : media?.type === "image" ? (
                      <img src={media.url} alt="" className="h-full w-full object-cover" />
                    ) : renderingMedia ? (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-xs">Rendering {preset.mediaType}…</span>
                      </div>
                    ) : (
                      <span className="px-6 text-center text-xs text-muted-foreground">
                        {preset.mediaType === "none"
                          ? "This format is text-only."
                          : "Generate or upload media."}
                      </span>
                    )}
                  </div>

                  {preset.mediaType !== "none" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateMedia}
                        disabled={renderingMedia}
                      >
                        {renderingMedia ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : media ? (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        ) : (
                          <Wand2 className="mr-2 h-4 w-4" />
                        )}
                        {media ? "Regenerate" : `Generate ${preset.mediaType}`}
                      </Button>

                      <label>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(f);
                          }}
                        />
                        <Button variant="outline" size="sm" asChild disabled={uploading}>
                          <span>
                            {uploading ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="mr-2 h-4 w-4" />
                            )}
                            Upload
                          </span>
                        </Button>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 4 — publish */}
              <div className="border-t border-border pt-4">
                {connectedForPlatform.length === 0 && (
                  <p className="mb-3 flex items-center gap-2 text-xs text-amber-600">
                    <Link2 className="h-3.5 w-3.5" />
                    No {platform} channel connected —{" "}
                    <Link to="/settings" className="underline underline-offset-2">
                      connect one
                    </Link>{" "}
                    or save as a draft.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => handlePublish("now")}
                    disabled={posting !== null || connectedForPlatform.length === 0}
                  >
                    {posting === "now" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Post now
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handlePublish("schedule")}
                    disabled={posting !== null || connectedForPlatform.length === 0}
                  >
                    {posting === "schedule" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CalendarClock className="mr-2 h-4 w-4" />
                    )}
                    Next best time
                  </Button>
                  <Button variant="ghost" onClick={() => handlePublish("draft")} disabled={posting !== null}>
                    {posting === "draft" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save draft
                  </Button>
                </div>
              </div>
            </section>
          )}
        </>
      )}
        </>
      )}
    </div>
  );
}
