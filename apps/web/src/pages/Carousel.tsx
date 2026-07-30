import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { useAuth } from "@shared/lib/auth";
import { getBrandProfiles } from "@shared/lib/automations";
import type { BrandProfile } from "@shared/types";
import { api } from "@convex/_generated/api";
import { isConvexConfigured } from "../lib/convex";
import { Button } from "@shared/components/ui/button";
import { Label } from "@shared/components/ui/label";
import { Textarea } from "@shared/components/ui/textarea";
import { cn } from "@shared/lib/utils";
import BrandedSlide from "../components/carousel/BrandedSlide";
import { downloadAllSlides, exportSlidePngs } from "../components/carousel/exportSlides";
import PreviewModule from "../components/previews/PreviewModule";
import {
  ASPECT_SIZE,
  defaultBrand,
  PLATFORM_ASPECT,
  type CarouselAspect,
  type CarouselBrand,
  type CarouselPack,
  type CarouselPlatform,
} from "../components/carousel/types";
import {
  Download,
  Facebook,
  FolderOpen,
  Instagram,
  Linkedin,
  Loader2,
  MessageCircle,
  Sparkles,
  Twitter,
  Layers,
} from "lucide-react";

const PLATFORMS: {
  id: CarouselPlatform;
  label: string;
  icon: typeof Instagram;
}[] = [
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "facebook", label: "Facebook", icon: Facebook },
  { id: "twitter", label: "X", icon: Twitter },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

const CAROUSEL_TEMPLATES = [
  {
    id: "how-to",
    name: "How-to guide",
    description: "Teach one skill in 4 slides",
    topic: "How to [skill] in 4 simple steps",
  },
  {
    id: "myths",
    name: "Myths vs facts",
    description: "Debunk 3 myths, land the truth",
    topic: "3 myths about [topic] — and the truth",
  },
  {
    id: "list",
    name: "Listicle",
    description: "Numbered tips people save",
    topic: "5 things every [audience] should know about [topic]",
  },
  {
    id: "story",
    name: "Before → After",
    description: "Transformation story arc",
    topic: "How we went from [before] to [after]",
  },
  {
    id: "framework",
    name: "Framework",
    description: "Name a method and break it down",
    topic: "The [Name] framework for [outcome]",
  },
  {
    id: "faq",
    name: "FAQ carousel",
    description: "Answer the top questions",
    topic: "People always ask me about [topic] — here's the answer",
  },
] as const;

function brandFromProfile(p?: BrandProfile | null): CarouselBrand {
  if (!p) return defaultBrand();
  return defaultBrand({
    name: p.name || "Your Brand",
    logoUrl: p.logoUrl,
    colors: {
      primary: p.colors?.primary || "#0b1b3a",
      secondary: p.colors?.secondary || p.colors?.accent || "#8b7cf6",
      accent: p.colors?.accent || p.colors?.secondary || "#7dd3fc",
      text: "#ffffff",
      muted: "rgba(255,255,255,0.78)",
    },
  });
}

export default function Carousel({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const generate = useAction(api.carousel.generate);
  const createPost = useAction(api.studio.createPost);
  const uploadUrl = useMutation(api.studio.uploadUrl);
  const resolveUpload = useMutation(api.studio.resolveUpload);

  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [brandId, setBrandId] = useState<string>("");
  const [topic, setTopic] = useState("How AI is changing lives");
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [platform, setPlatform] = useState<CarouselPlatform>("linkedin");
  const [pack, setPack] = useState<CarouselPack | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingLibrary, setSavingLibrary] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  const slideEls = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!user) return;
    getBrandProfiles(user.uid).then((list) => {
      setBrands(list);
      if (list[0]) setBrandId(list[0].id);
    });
  }, [user]);

  const profile = brands.find((b) => b.id === brandId) ?? brands[0] ?? null;
  const brand = useMemo(() => brandFromProfile(profile), [profile]);
  const aspect: CarouselAspect = PLATFORM_ASPECT[platform];
  const previewScale = Math.min(1, 320 / ASPECT_SIZE[aspect].w);

  const onGenerate = async () => {
    if (!isConvexConfigured) {
      toast.error("Convex is not configured");
      return;
    }
    if (!topic.trim()) {
      toast.error("Enter a topic or prompt");
      return;
    }
    setBusy(true);
    try {
      const result = await generate({
        topic: topic.trim(),
        brandName: brand.name,
        brandTone: profile?.toneOfVoice,
        audience: profile?.audience,
        industry: profile?.industry,
        bannedTopics: profile?.bannedTopics,
        platform,
        slideCount: 4,
      });
      setPack({
        topic: result.topic,
        caption: result.caption,
        hashtags: result.hashtags,
        hookFamily: result.hookFamily,
        trendUsed: result.trendUsed,
        whySave: result.whySave,
        slides: result.slides as CarouselPack["slides"],
      });
      setActiveSlide(0);
      if ("usedFallback" in result && result.usedFallback) {
        toast.message("Used offline template — Gemini hiccuped, slides still ready");
      } else {
        toast.success("Carousel ready — 1 i-credit used");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async () => {
    if (!pack) return;
    setExporting(true);
    try {
      const urls = await exportSlidePngs(slideEls.current);
      if (!urls.length) throw new Error("Nothing to export");
      const slug = pack.topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
      await downloadAllSlides(urls, slug || "carousel");
      toast.success(`Downloaded ${urls.length} slides`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const onSaveToLibrary = async () => {
    if (!pack) return;
    if (!isConvexConfigured) {
      toast.error("Convex is not configured");
      return;
    }
    setSavingLibrary(true);
    try {
      const urls = await exportSlidePngs(slideEls.current);
      const mediaUrls: string[] = [];
      for (const url of urls) {
        const blob = await (await fetch(url)).blob();
        const postUrl = await uploadUrl({});
        const res = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: blob,
        });
        if (!res.ok) throw new Error("Slide upload failed");
        const { storageId } = (await res.json()) as { storageId: string };
        const resolved = await resolveUpload({ storageId: storageId as any });
        mediaUrls.push(resolved.url);
      }
      await createPost({
        caption: pack.caption,
        hashtags: pack.hashtags,
        platforms: [platform === "twitter" ? "twitter" : platform],
        mediaUrls: mediaUrls.length ? mediaUrls : undefined,
        mediaType: mediaUrls.length ? "image" : undefined,
        mediaSource: mediaUrls.length ? "upload" : undefined,
        brief: pack.topic,
        brandProfileId: brandId || undefined,
        mode: "draft",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      toast.success("Saved to Library as draft");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save to Library");
    } finally {
      setSavingLibrary(false);
    }
  };

  const previewCaption = pack
    ? `${pack.caption}\n\n${pack.hashtags.map((h) => `#${h}`).join(" ")}`
    : "";

  return (
    <div className={cn("w-full", !embedded && "animate-fade-in")}>
      {!embedded && (
        <div className="mb-5 sm:mb-6">
          <span className="eyebrow">Create</span>
          <h1 className="mt-2 flex items-center gap-2 font-display text-2xl sm:text-3xl">
            <Layers className="h-6 w-6 text-brand sm:h-7 sm:w-7" />
            Carousel
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Enter a topic. Gemini writes 4 slides; brand kit locks logo, colors, and name — ready for
            LinkedIn, Instagram, Facebook, and X.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_min(380px,36vw)]">
        <div className="space-y-5 min-w-0">
          <div className="space-y-3">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
              Templates
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CAROUSEL_TEMPLATES.map((t) => {
                const active = activeTemplate === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveTemplate(t.id);
                      setTopic(t.topic);
                    }}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      active
                        ? "border-brand bg-brand/5 ring-1 ring-brand"
                        : "border-border bg-card hover:border-brand/40",
                    )}
                  >
                    <div className="text-sm font-medium text-foreground">{t.name}</div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass-card space-y-4 p-4 sm:p-5">
            <div className="space-y-2">
              <Label>Topic / prompt</Label>
              <Textarea
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  setActiveTemplate(null);
                }}
                rows={3}
                placeholder="e.g. How AI is changing lives"
                className="resize-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Brand kit</Label>
                {brands.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No brand yet.{" "}
                    <Link to="/brand" className="text-brand hover:underline">
                      Set up Brand Kit
                    </Link>
                  </p>
                ) : (
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <Label>Primary platform</Label>
                <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
                  {PLATFORMS.map((p) => {
                    const Icon = p.icon;
                    const on = platform === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlatform(p.id)}
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium sm:justify-start sm:py-1.5",
                          on
                            ? "border-brand/40 bg-brand/15 text-brand"
                            : "border-border text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                onClick={() => void onGenerate()}
                disabled={busy || !topic.trim()}
                className="w-full sm:w-auto"
              >
                {busy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-4 w-4" />
                )}
                Generate carousel
              </Button>
              {pack && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => void onSaveToLibrary()}
                    disabled={savingLibrary || exporting}
                    className="w-full sm:w-auto"
                  >
                    {savingLibrary ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <FolderOpen className="mr-1.5 h-4 w-4" />
                    )}
                    Save to Library
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void onDownload()}
                    disabled={exporting || savingLibrary}
                    className="w-full sm:w-auto"
                  >
                    {exporting ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-1.5 h-4 w-4" />
                    )}
                    Download PNGs
                  </Button>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Uses 1 i-credit · layering keeps brand marks locked
            </p>
          </div>

          {/* Slide strip */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Slides</h2>
              {pack && (
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {ASPECT_SIZE[aspect].w}×{ASPECT_SIZE[aspect].h} · {aspect}
                </span>
              )}
            </div>

            {!pack ? (
              <div className="glass-card flex flex-col items-center gap-2 px-4 py-12 text-center sm:py-16">
                <Layers className="h-8 w-8 text-muted-foreground/40" />
                <p className="max-w-sm text-sm text-muted-foreground">
                  Generate to see 4 branded slides with locked logo & name placement.
                </p>
              </div>
            ) : (
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 snap-x snap-mandatory">
                {pack.slides.map((slide, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveSlide(i)}
                    className={cn(
                      "snap-start shrink-0 rounded-xl p-1 transition-shadow",
                      activeSlide === i ? "ring-2 ring-brand" : "opacity-90 hover:opacity-100",
                    )}
                  >
                    <BrandedSlide
                      slide={slide}
                      brand={brand}
                      aspect={aspect}
                      index={i}
                      total={pack.slides.length}
                      scale={previewScale * 0.85}
                    />
                  </button>
                ))}
              </div>
            )}

            {pack && (
              <div className="glass-card space-y-2 p-4">
                <Label className="text-xs text-muted-foreground">Caption</Label>
                <p className="whitespace-pre-wrap text-sm">{pack.caption}</p>
                <p className="text-xs text-brand/80">
                  {pack.hashtags.map((h) => `#${h}`).join(" ")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right preview — stacks under editor until xl */}
        <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
          <PreviewModule
            className="min-h-[360px] sm:min-h-[480px]"
            title="Post preview"
            platform={platform === "twitter" ? "twitter" : platform}
            onPlatformChange={(p) => {
              if (p === "youtube") return;
              setPlatform(p as CarouselPlatform);
            }}
            allowedPlatforms={["linkedin", "instagram", "facebook", "twitter", "whatsapp"]}
            content={
              pack
                ? {
                    caption: previewCaption,
                    brandName: brand.name,
                    logoUrl: brand.logoUrl,
                    brandColors: {
                      primary: brand.colors.primary,
                      secondary: brand.colors.secondary,
                      accent: brand.colors.accent,
                    },
                    mediaAspect: aspect,
                    // Render the live active slide inside the phone frame.
                    mediaNode: (
                      <BrandedSlide
                        slide={pack.slides[activeSlide] ?? pack.slides[0]}
                        brand={brand}
                        aspect={aspect}
                        index={activeSlide}
                        total={pack.slides.length}
                        scale={340 / ASPECT_SIZE[aspect].w}
                      />
                    ),
                  }
                : null
            }
            emptyHint="Generate a carousel to preview how the post will read on each channel."
          />
          {pack && pack.slides.length > 1 && (
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {pack.slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Preview slide ${i + 1}`}
                  onClick={() => setActiveSlide(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    activeSlide === i ? "w-5 bg-brand" : "w-1.5 bg-border hover:bg-brand/40",
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Offscreen full-res export nodes — always mounted when pack exists */}
      {pack && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: -10000,
            top: 0,
            pointerEvents: "none",
            opacity: 0,
          }}
        >
          {pack.slides.map((slide, i) => (
            <BrandedSlide
              key={`export-${i}`}
              slide={slide}
              brand={brand}
              aspect={aspect}
              index={i}
              total={pack.slides.length}
              scale={1}
              slideRef={(el) => {
                slideEls.current[i] = el;
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
