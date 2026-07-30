import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { Button } from "@shared/components/ui/button";
import { captureEvent, PRODUCT_EVENTS } from "@shared/lib/analytics";
import { cn } from "@shared/lib/utils";
import type { SocialPlatform } from "@shared/types";
import { isConvexConfigured } from "../lib/convex";
import { useMayaActivation } from "../hooks/useMayaActivation";
import PlatformPreview, { type PreviewContent } from "../components/previews/PlatformPreview";
import {
  ArrowRight,
  CheckCircle2,
  Globe2,
  LockKeyhole,
  Sparkles,
  X,
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
  MessageCircle,
  TrendingUp,
  Loader2,
  CalendarClock,
  Link2,
  Send,
} from "lucide-react";

/**
 * MAYA — the daily swipe deck.
 *
 * Approve with Post now or Next best time. Left / Skip = not for me.
 */

const PLATFORM_ICON: Record<string, typeof Instagram> = {
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Facebook,
  whatsapp: MessageCircle,
};

const SWIPE_THRESHOLD = 110;

type MayaActivation = {
  hasWebsite: boolean;
  hasChannel: boolean;
  ready: boolean;
  websiteUrl?: string;
  brandName?: string;
  activePlatforms: string[];
  channelCount: number;
};

function formatSlot(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

type Suggestion = {
  _id: string;
  slot: number;
  platforms: string[];
  hook?: string;
  angle?: string;
  caption: string;
  hashtags: string[];
  mediaPlan?: { type: string; prompt?: string };
  media?: { type: string; url: string }[];
  trendRefs?: string[];
};

function Card({
  s,
  onDecide,
  isTop,
  depth,
}: {
  s: Suggestion;
  onDecide: (d: "right" | "left", dwellMs: number, publishMode?: "now" | "schedule") => void;
  isTop: boolean;
  depth: number;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-14, 14]);
  const approveOpacity = useTransform(x, [40, 150], [0, 1]);
  const rejectOpacity = useTransform(x, [-150, -40], [1, 0]);
  const shownAt = useRef(Date.now());

  const platform = s.platforms[0] ?? "instagram";
  const Icon = PLATFORM_ICON[platform] ?? Sparkles;

  const asset = s.media?.[0];
  const isRendering = !asset && !!s.mediaPlan && s.mediaPlan.type !== "none";
  const previewContent: PreviewContent = {
    caption: s.caption,
    hashtags: s.hashtags,
    imageUrl: asset?.type === "image" ? asset.url : undefined,
    videoUrl: asset?.type === "video" ? asset.url : undefined,
  };

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (Math.abs(info.offset.x) < SWIPE_THRESHOLD) return;
    onDecide(info.offset.x > 0 ? "right" : "left", Date.now() - shownAt.current, "schedule");
  }

  return (
    <motion.div
      className={cn(
        "relative w-full rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6",
        isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none",
      )}
      style={{ x, rotate, zIndex: 10 - depth }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Swipe intent overlays — feedback before the user commits. */}
      <motion.div
        style={{ opacity: approveOpacity }}
        className="pointer-events-none absolute right-5 top-5 rounded-md border-2 border-emerald-500 px-3 py-1 font-mono text-xs uppercase tracking-widest text-emerald-600"
      >
        Next best time
      </motion.div>
      <motion.div
        style={{ opacity: rejectOpacity }}
        className="pointer-events-none absolute left-5 top-5 rounded-md border-2 border-red-500 px-3 py-1 font-mono text-xs uppercase tracking-widest text-red-600"
      >
        Skip
      </motion.div>

      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {platform}
        </span>
        {s.trendRefs && s.trendRefs.length > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            on-trend
          </span>
        )}
      </div>

      {/* Hook / angle are Maya's internal strategy notes for the reviewer —
          not part of the post itself, so they sit above the preview rather
          than inside it. */}
      {(s.hook || s.angle) && (
        <div className="mb-4 space-y-1">
          {s.hook && (
            <p className="font-display text-lg leading-tight text-foreground sm:text-xl">
              {s.hook}
            </p>
          )}
          {s.angle && <p className="text-sm italic text-muted-foreground">{s.angle}</p>}
        </div>
      )}

      {isRendering && (
        <p className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          rendering {s.mediaPlan?.type}…
        </p>
      )}

      {/* Platform-accurate preview: exactly the caption, hashtags, and media
          that will actually publish — as if scrolling the real feed. */}
      <div className="flex justify-center">
        <PlatformPreview platform={platform as SocialPlatform} content={previewContent} />
      </div>
    </motion.div>
  );
}

function ActivationGate({ activation }: { activation: MayaActivation }) {
  const nextPath = activation.hasWebsite ? "/onboarding/channels" : "/onboarding";

  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-10">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(circle at 12% 5%, rgb(var(--brand) / 0.14), transparent 36%), linear-gradient(135deg, transparent 62%, rgb(var(--foreground) / 0.04))",
          }}
        />
        <div className="relative border-b border-border px-6 py-8 sm:px-10 sm:py-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <LockKeyhole className="h-3.5 w-3.5 text-brand" />
            Maya is waiting
          </div>
          <h1 className="max-w-xl font-display text-4xl leading-[1.02] tracking-tight text-foreground sm:text-5xl">
            Give Maya a brand to understand and somewhere to publish.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Your website teaches Maya the offer, audience, voice, logo, and visual language.
            A connected channel tells her where the finished work can go.
          </p>
        </div>

        <div className="relative grid gap-px bg-border sm:grid-cols-2">
          <div className="bg-card p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <Globe2 className="h-5 w-5 text-foreground" />
              </div>
              {activation.hasWebsite ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Complete
                </span>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-widest text-brand">
                  Step 1
                </span>
              )}
            </div>
            <h2 className="mt-6 font-display text-2xl text-foreground">Link your website</h2>
            <p className="mt-2 min-h-10 text-sm leading-relaxed text-muted-foreground">
              {activation.hasWebsite
                ? `${activation.brandName || "Your brand"} is ready for Maya.`
                : "We will extract your brand kit and content evidence before Maya writes anything."}
            </p>
            {!activation.hasWebsite && (
              <Button asChild className="mt-6 w-full">
                <Link to="/onboarding">
                  Add website <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>

          <div className={cn("bg-card p-6 sm:p-8", !activation.hasWebsite && "opacity-55")}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <Link2 className="h-5 w-5 text-foreground" />
              </div>
              {activation.hasChannel ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Complete
                </span>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Step 2
                </span>
              )}
            </div>
            <h2 className="mt-6 font-display text-2xl text-foreground">Connect a social channel</h2>
            <p className="mt-2 min-h-10 text-sm leading-relaxed text-muted-foreground">
              {activation.hasChannel
                ? `${activation.channelCount} active ${activation.channelCount === 1 ? "channel" : "channels"} connected.`
                : activation.hasWebsite
                  ? "Connect at least one destination. Nothing is posted without your approval."
                  : "This unlocks after your website is linked."}
            </p>
            {activation.hasWebsite && !activation.hasChannel && (
              <Button asChild className="mt-6 w-full">
                <Link to="/onboarding/channels">
                  Connect a channel <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="relative flex items-center justify-between gap-4 bg-foreground px-6 py-4 text-background sm:px-10">
          <p className="text-xs leading-relaxed text-background/70">
            Maya activates automatically when both steps are complete.
          </p>
          <Link
            to={nextPath}
            className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-background underline decoration-background/35 underline-offset-4"
          >
            Continue setup
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Maya() {
  const [generating, setGenerating] = useState(false);
  const activation = useMayaActivation();
  const trackedActivationState = useRef<string | null>(null);

  // Convex is optional at runtime (the client is null when unconfigured), so
  // skip the queries entirely rather than crash the route.
  const deck = useQuery(api.maya.deck, isConvexConfigured ? {} : "skip");
  const ensureConfig = useMutation(api.maya.ensureConfig);
  const swipe = useMutation(api.maya.swipe);
  const generateNow = useAction(api.maya.generateNow);

  useEffect(() => {
    if (activation === undefined) return;
    const state = activation.ready
      ? "ready"
      : `blocked:${activation.hasWebsite}:${activation.hasChannel}`;
    if (trackedActivationState.current === state) return;
    trackedActivationState.current = state;
    if (activation.ready) {
      captureEvent(PRODUCT_EVENTS.mayaActivated, {
        channel_count: activation.channelCount,
      });
    } else {
      captureEvent(PRODUCT_EVENTS.mayaActivationBlocked, {
        missing_website: !activation.hasWebsite,
        missing_channel: !activation.hasChannel,
      });
    }
  }, [activation]);

  // Idempotent bootstrap: config + pillars + seeded best-time slots.
  useEffect(() => {
    if (!isConvexConfigured || !activation?.ready) return;
    ensureConfig({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).catch((e) => console.warn("[maya] ensureConfig failed", e));
  }, [activation?.ready, ensureConfig]);

  const pending = useMemo(() => (deck?.pending ?? []) as unknown as Suggestion[], [deck]);

  async function decide(
    s: Suggestion,
    decision: "right" | "left",
    dwellMs: number,
    publishMode: "now" | "schedule" = "schedule",
  ) {
    try {
      const r: any = await swipe({
        suggestionId: s._id as any,
        decision,
        dwellMs,
        publishMode: decision === "right" ? publishMode : undefined,
      });
      if (decision === "left") {
        toast("Skipped — Maya will show less like this.");
        return;
      }
      if (r?.needsChannel) {
        toast.warning("Saved as a draft — connect a channel to publish.", {
          action: { label: "Connect", onClick: () => (window.location.href = "/settings") },
        });
      } else if (r?.renderingVideo) {
        toast.success(
          publishMode === "now"
            ? "Rendering video — it'll post as soon as it's ready."
            : `Rendering your video — it'll publish ${r.scheduledAt ? formatSlot(r.scheduledAt) : "at the next slot"} once ready.`,
        );
      } else if (publishMode === "now") {
        toast.success("Posting now — check Posts in a moment.");
      } else if (r?.scheduledAt) {
        toast.success(`Queued for next best time · ${formatSlot(r.scheduledAt)}`);
      } else {
        toast.success("Queued for next best time.");
      }
    } catch (e) {
      toast.error(`Couldn't save that swipe: ${String(e).slice(0, 90)}`);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      await ensureConfig({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const r = await generateNow({ force: true });
      if (r.created > 0) toast.success(`Maya wrote ${r.created} new posts.`);
      else toast(`Nothing new to add (${r.reason ?? "no changes"}).`);
    } catch (e) {
      toast.error(`Generation failed: ${String(e).slice(0, 110)}`);
    } finally {
      setGenerating(false);
    }
  }

  if (!isConvexConfigured) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Maya needs <code className="font-mono">VITE_CONVEX_URL</code> configured.
        </p>
      </div>
    );
  }

  if (activation === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activation.ready) {
    return <ActivationGate activation={activation} />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6 sm:mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Daily deck · {deck?.batchDate ?? "—"}
        </p>
        <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">Maya</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Post now</span> or{" "}
          <span className="font-medium text-foreground">Next best time</span>
          <span className="hidden sm:inline">
            {" "}
            — swipe right for next best time / left to skip
          </span>
          <span className="sm:hidden">. Use the buttons below on mobile.</span>
        </p>
      </header>

      {/* Deck — only the top card is in flow so action buttons stay visible below */}
      <div className="relative">
        {deck === undefined ? (
          <div className="flex h-72 items-center justify-center sm:h-80">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : pending.length === 0 ? (
          <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-4 text-center sm:h-80">
            <Sparkles className="mb-3 h-6 w-6 text-muted-foreground" />
            <p className="font-display text-xl text-foreground">
              {deck.decided > 0 ? "Deck cleared" : "No deck yet"}
            </p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {deck.decided > 0
                ? `You reviewed all ${deck.total} today. Maya writes a fresh deck each morning.`
                : "Maya writes a deck each morning — or generate one now."}
            </p>
            <Button onClick={handleGenerate} disabled={generating} className="mt-5">
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Writing…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Generate today's deck
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="relative">
            {/* Peek cards behind — decorative only */}
            {pending.slice(1, 3).map((s, i) => (
              <div
                key={`peek-${s._id}`}
                aria-hidden
                className="pointer-events-none absolute inset-x-2 rounded-2xl border border-border bg-card shadow-sm"
                style={{
                  top: (i + 1) * 8,
                  bottom: -(i + 1) * 8,
                  zIndex: 1,
                  opacity: 0.55 - i * 0.15,
                  transform: `scale(${1 - (i + 1) * 0.02})`,
                }}
              />
            ))}
            <div className="relative z-10">
              <Card
                key={pending[0]._id}
                s={pending[0]}
                depth={0}
                isTop
                onDecide={(d, dwell, mode) => decide(pending[0], d, dwell, mode)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Always-visible post actions */}
      {pending.length > 0 && (
        <div className="sticky bottom-3 z-20 mt-5 rounded-2xl border border-border bg-background/95 p-2.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:bottom-4 sm:mt-6 sm:p-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              size="lg"
              className="h-11 flex-1 gap-2 rounded-full border-red-500/30 hover:bg-red-500/10 sm:h-12 sm:min-w-[6.5rem] sm:flex-none"
              onClick={() => decide(pending[0], "left", 0)}
              aria-label="Skip this post"
            >
              <X className="h-4 w-4 text-red-500" />
              <span>Skip</span>
            </Button>
            <span className="order-first w-full text-center font-mono text-[11px] text-muted-foreground sm:order-none sm:w-auto sm:px-1">
              {pending.length} left
            </span>
            <Button
              variant="outline"
              size="lg"
              className="h-11 flex-1 gap-1.5 rounded-full px-3 sm:h-12 sm:min-w-[7.5rem] sm:flex-none"
              onClick={() => decide(pending[0], "right", 0, "schedule")}
              aria-label="Queue at next best time"
            >
              <CalendarClock className="h-4 w-4 shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">Schedule</span>
                <span className="hidden sm:inline">Next best time</span>
              </span>
            </Button>
            <Button
              size="lg"
              className="h-11 flex-[1.2] gap-2 rounded-full sm:h-12 sm:min-w-[7.5rem] sm:flex-none"
              onClick={() => decide(pending[0], "right", 0, "now")}
              aria-label="Post now"
            >
              <Send className="h-4 w-4" />
              Post now
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-4 pb-2 text-xs text-muted-foreground sm:mt-8">
        <Link to="/schedule" className="inline-flex items-center gap-1.5 hover:text-foreground">
          <CalendarClock className="h-3.5 w-3.5" /> See what's scheduled
        </Link>
      </div>
    </div>
  );
}
