import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { Button } from "@shared/components/ui/button";
import { cn } from "@shared/lib/utils";
import { isConvexConfigured } from "../lib/convex";
import {
  Sparkles,
  X,
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
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
};

const SWIPE_THRESHOLD = 110;

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

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (Math.abs(info.offset.x) < SWIPE_THRESHOLD) return;
    onDecide(info.offset.x > 0 ? "right" : "left", Date.now() - shownAt.current, "schedule");
  }

  return (
    <motion.div
      className={cn(
        "relative w-full rounded-2xl border border-border bg-card p-6 shadow-sm",
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

      {/* Rendered media: the actual poster image (or video) Maya generated. */}
      {(() => {
        const asset = s.media?.[0];
        if (asset?.type === "video") {
          return (
            <video
              src={asset.url}
              className="mb-4 max-h-72 w-full rounded-xl border border-border object-cover"
              muted
              loop
              playsInline
              autoPlay
            />
          );
        }
        if (asset?.type === "image") {
          return (
            <img
              src={asset.url}
              alt=""
              className="mb-4 max-h-72 w-full rounded-xl border border-border object-cover"
              draggable={false}
            />
          );
        }
        // Media planned but not rendered yet — show a subtle loading frame.
        if (s.mediaPlan && s.mediaPlan.type !== "none") {
          return (
            <div className="mb-4 flex h-40 w-full items-center justify-center rounded-xl border border-dashed border-border bg-secondary/40">
              <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                rendering {s.mediaPlan.type}…
              </span>
            </div>
          );
        }
        return null;
      })()}

      <h3 className="mb-3 font-serif text-2xl leading-tight text-foreground">
        {s.hook ?? "Untitled"}
      </h3>

      {s.angle && <p className="mb-4 text-sm italic text-muted-foreground">{s.angle}</p>}

      <p className="mb-4 max-h-52 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
        {s.caption}
      </p>

      {s.hashtags?.length > 0 && (
        <p className="font-mono text-xs text-brand">
          {s.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
        </p>
      )}
    </motion.div>
  );
}

export default function Maya() {
  const [generating, setGenerating] = useState(false);

  // Convex is optional at runtime (the client is null when unconfigured), so
  // skip the queries entirely rather than crash the route.
  const deck = useQuery(api.maya.deck, isConvexConfigured ? {} : "skip");
  const accounts = useQuery(api.social.accounts, isConvexConfigured ? {} : "skip");
  const ensureConfig = useMutation(api.maya.ensureConfig);
  const swipe = useMutation(api.maya.swipe);
  const generateNow = useAction(api.maya.generateNow);

  // Idempotent bootstrap: config + pillars + seeded best-time slots.
  useEffect(() => {
    if (!isConvexConfigured) return;
    ensureConfig({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).catch((e) => console.warn("[maya] ensureConfig failed", e));
  }, [ensureConfig]);

  const pending = useMemo(() => (deck?.pending ?? []) as unknown as Suggestion[], [deck]);
  const hasChannel = (accounts ?? []).some((a: any) => a.status === "active");

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Daily deck · {deck?.batchDate ?? "—"}
        </p>
        <h1 className="mt-2 font-serif text-4xl text-foreground">Maya</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Post now</span> or{" "}
          <span className="font-medium text-foreground">Next best time</span> — or swipe right for
          next best time / left to skip.
        </p>
      </header>

      {!hasChannel && accounts !== undefined && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <Link2 className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-muted-foreground">
            No channel connected — approvals will be saved as drafts.{" "}
            <Link to="/settings" className="font-medium text-brand underline underline-offset-2">
              Connect one
            </Link>
          </p>
        </div>
      )}

      {/* Deck — only the top card is in flow so action buttons stay visible below */}
      <div className="relative">
        {deck === undefined ? (
          <div className="flex h-80 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : pending.length === 0 ? (
          <div className="flex h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center">
            <Sparkles className="mb-3 h-6 w-6 text-muted-foreground" />
            <p className="font-serif text-xl text-foreground">
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
        <div className="sticky bottom-4 z-20 mt-6 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button
            variant="outline"
            size="lg"
            className="h-12 min-w-[6.5rem] gap-2 rounded-full border-red-500/30 hover:bg-red-500/10"
            onClick={() => decide(pending[0], "left", 0)}
            aria-label="Skip this post"
          >
            <X className="h-4 w-4 text-red-500" />
            Skip
          </Button>
          <span className="px-1 font-mono text-xs text-muted-foreground">{pending.length} left</span>
          <Button
            variant="outline"
            size="lg"
            className="h-12 min-w-[7.5rem] gap-2 rounded-full"
            onClick={() => decide(pending[0], "right", 0, "schedule")}
            aria-label="Queue at next best time"
          >
            <CalendarClock className="h-4 w-4" />
            Next best time
          </Button>
          <Button
            size="lg"
            className="h-12 min-w-[7.5rem] gap-2 rounded-full"
            onClick={() => decide(pending[0], "right", 0, "now")}
            aria-label="Post now"
          >
            <Send className="h-4 w-4" />
            Post now
          </Button>
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <Link to="/schedule" className="inline-flex items-center gap-1.5 hover:text-foreground">
          <CalendarClock className="h-3.5 w-3.5" /> See what's scheduled
        </Link>
      </div>
    </div>
  );
}
