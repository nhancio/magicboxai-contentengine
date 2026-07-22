/**
 * Reusable phone-frame primitives for Ferryman-style storytelling.
 * Placeholder media slots accept a future video `src` without layout changes.
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Play,
  Send,
  Share2,
  ThumbsUp,
} from "lucide-react";
import { InstagramLogo, LinkedInLogo, YouTubeLogo } from "./channel-logos";

export type PlatformKey = "instagram" | "linkedin" | "youtube";
export type PublishStatus = "live" | "scheduled" | "review" | "draft" | "uploading";

export type PhoneMedia = {
  /** Vertical video URL — optional; posters/gradients render when absent. */
  src?: string;
  posterClassName?: string;
  caption: string;
  handle: string;
  title?: string;
};

const DEFAULT_MEDIA: Record<PlatformKey, PhoneMedia> = {
  instagram: {
    caption: "3 things nobody tells you about launching →",
    handle: "@yourbrand",
    posterClassName: "from-brand/80 via-fuchsia-500/50 to-indigo-600/70",
  },
  linkedin: {
    caption:
      "We turned one brand brief into a full week of posts — without a content team.",
    handle: "Your Brand",
    title: "Founder",
    posterClassName: "from-sky-500/30 via-brand/20 to-indigo-500/40",
  },
  youtube: {
    caption: "How we booked demos with one weekly brief",
    handle: "Your Brand",
    title: "Shorts",
    posterClassName: "from-red-500/60 via-orange-400/40 to-brand/50",
  },
};

const STATUS_STYLES: Record<PublishStatus, string> = {
  live: "bg-emerald-500/90 text-white",
  scheduled: "bg-brand/90 text-white",
  review: "bg-amber-400 text-foreground",
  draft: "bg-white/90 text-foreground",
  uploading: "bg-emerald-400/95 text-foreground",
};

const STATUS_LABELS: Record<PublishStatus, string> = {
  live: "LIVE",
  scheduled: "SCHEDULED",
  review: "IN REVIEW",
  draft: "DRAFT",
  uploading: "UPLOADING",
};

type PhoneFrameProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  size?: "sm" | "md" | "lg";
  glow?: "instagram" | "linkedin" | "youtube" | "brand" | "none";
  float?: boolean;
};

const SIZE_MAP = {
  sm: "w-[220px] h-[450px]",
  md: "w-[270px] h-[550px]",
  lg: "w-[320px] h-[650px]",
} as const;

const GLOW_MAP = {
  none: "",
  brand: "shadow-[0_20px_60px_-12px_rgba(147,51,234,0.45)]",
  instagram: "shadow-[0_20px_60px_-12px_rgba(225,48,108,0.45)]",
  linkedin: "shadow-[0_20px_60px_-12px_rgba(10,102,194,0.45)]",
  youtube: "shadow-[0_20px_60px_-12px_rgba(255,0,0,0.35)]",
} as const;

export function PhoneFrame({
  children,
  className = "",
  style,
  size = "md",
  glow = "none",
  float = false,
}: PhoneFrameProps) {
  return (
    <div
      className={`relative select-none ${float ? "animate-phone-float" : ""} ${className}`}
      style={style}
    >
      <div
        className={`relative ${SIZE_MAP[size]} rounded-[2rem] border-[8px] border-neutral-900 bg-neutral-900 overflow-hidden ${GLOW_MAP[glow]}`}
      >
        {/* Dynamic Island */}
        <div className="absolute top-2 left-1/2 z-30 h-5 w-[72px] -translate-x-1/2 rounded-full bg-black" />
        <div className="absolute inset-0 overflow-hidden rounded-[1.5rem] bg-neutral-950">
          {children}
        </div>
      </div>
    </div>
  );
}

function MediaBackdrop({
  media,
  posterClassName,
}: {
  media?: PhoneMedia;
  posterClassName: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !media?.src) return;

    el.muted = true;
    el.defaultMuted = true;
    el.setAttribute("muted", "");
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "");

    const tryPlay = () => {
      void el.play().catch(() => {
        /* iOS may block until visible; retry on intersection */
      });
    };

    tryPlay();
    el.addEventListener("loadeddata", tryPlay);
    el.addEventListener("canplay", tryPlay);

    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting) tryPlay();
                else el.pause();
              }
            },
            { threshold: 0.25 },
          )
        : null;
    io?.observe(el);

    return () => {
      el.removeEventListener("loadeddata", tryPlay);
      el.removeEventListener("canplay", tryPlay);
      io?.disconnect();
    };
  }, [media?.src]);

  if (media?.src) {
    return (
      <>
        {/* Gradient under video so failed/loading frames never look blank black */}
        <div className={`absolute inset-0 bg-gradient-to-br ${posterClassName}`} />
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={media.src}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
        />
      </>
    );
  }

  return (
    <>
      <div className={`absolute inset-0 bg-gradient-to-br ${posterClassName}`} />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 20%, rgba(255,255,255,.55), transparent 42%), radial-gradient(circle at 80% 70%, rgba(0,0,0,.25), transparent 40%)",
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm animate-pulse-slow">
          <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
        </div>
      </div>
    </>
  );
}

function StatusPill({ status }: { status?: PublishStatus }) {
  if (!status) return null;
  return (
    <div
      className={`absolute left-1/2 top-9 z-20 -translate-x-1/2 rounded-full px-2.5 py-1 text-[9px] font-semibold tracking-wider ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
      {status === "uploading" && (
        <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-black/20">
          <div className="h-full w-2/3 animate-progress-bar bg-black/50" style={{ animationDuration: "2.4s" }} />
        </div>
      )}
    </div>
  );
}

type ScreenProps = {
  media?: Partial<PhoneMedia>;
  status?: PublishStatus;
};

export function InstagramScreen({ media, status }: ScreenProps) {
  const m = { ...DEFAULT_MEDIA.instagram, ...media };
  return (
    <div className="relative h-full w-full text-white">
      <MediaBackdrop media={m} posterClassName={m.posterClassName!} />
      <StatusPill status={status} />

      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3.5 pb-2 pt-8">
        <span className="text-[11px] font-semibold tracking-tight">Reels</span>
        <InstagramLogo className="h-4 w-4 text-white" />
      </div>

      <div className="absolute bottom-24 right-2.5 z-10 flex flex-col items-center gap-3.5 text-white">
        <div className="flex flex-col items-center gap-0.5">
          <Heart className="h-5 w-5" />
          <span className="text-[9px] font-medium">12.4K</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <MessageCircle className="h-5 w-5" />
          <span className="text-[9px] font-medium">328</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Send className="h-5 w-5" />
          <span className="text-[9px] font-medium">Share</span>
        </div>
        <Bookmark className="h-5 w-5" />
      </div>

      <div className="absolute bottom-5 left-3 right-12 z-10">
        <div className="mb-1.5 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[8px] font-bold text-neutral-900">
            MB
          </div>
          <span className="text-[11px] font-semibold">{m.handle}</span>
        </div>
        <p className="text-[11px] leading-snug">{m.caption}</p>
        <p className="mt-1 text-[9px] text-white/70">MagicBox · on-brand</p>
      </div>
    </div>
  );
}

export function LinkedInScreen({ media, status }: ScreenProps) {
  const m = { ...DEFAULT_MEDIA.linkedin, ...media };
  return (
    <div className="relative flex h-full w-full flex-col bg-[#0a0a0a] text-white">
      <StatusPill status={status} />

      <div className="flex items-center justify-between px-3.5 pb-2 pt-8">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0A66C2] text-[9px] font-bold">
            YB
          </div>
          <div className="leading-tight">
            <div className="text-[11px] font-semibold">{m.handle}</div>
            <div className="text-[9px] text-white/50">{m.title} · Now</div>
          </div>
        </div>
        <MoreHorizontal className="h-4 w-4 text-white/50" />
      </div>

      <p className="px-3.5 pb-3 text-[11px] leading-relaxed text-white/90">{m.caption}</p>

      <div className="relative mx-3.5 mb-3 flex-1 overflow-hidden rounded-lg">
        <MediaBackdrop media={m} posterClassName={m.posterClassName!} />
        <div className="absolute inset-0 flex items-end p-3 pointer-events-none">
          <span className="rounded-full bg-black/40 px-2 py-0.5 text-[9px] backdrop-blur-sm">
            Brand kit applied
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5 text-white/60">
        <div className="flex items-center gap-1 text-[9px]">
          <ThumbsUp className="h-3.5 w-3.5" /> Like
        </div>
        <div className="flex items-center gap-1 text-[9px]">
          <MessageCircle className="h-3.5 w-3.5" /> Comment
        </div>
        <div className="flex items-center gap-1 text-[9px]">
          <Share2 className="h-3.5 w-3.5" /> Repost
        </div>
      </div>

      <div className="absolute right-3 top-9 z-10">
        <LinkedInLogo className="h-3.5 w-3.5 text-[#0A66C2]" />
      </div>
    </div>
  );
}

export function YouTubeScreen({ media, status }: ScreenProps) {
  const m = { ...DEFAULT_MEDIA.youtube, ...media };
  return (
    <div className="relative h-full w-full text-white">
      <MediaBackdrop media={m} posterClassName={m.posterClassName!} />
      <StatusPill status={status} />

      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3.5 pb-2 pt-8">
        <div className="flex items-center gap-1.5">
          <YouTubeLogo className="h-4 w-4 text-red-500" />
          <span className="text-[11px] font-semibold">Shorts</span>
        </div>
        <MoreHorizontal className="h-4 w-4" />
      </div>

      <div className="absolute bottom-24 right-2.5 z-10 flex flex-col items-center gap-3.5">
        <div className="flex flex-col items-center gap-0.5">
          <Heart className="h-5 w-5" />
          <span className="text-[9px]">8.2K</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <MessageCircle className="h-5 w-5" />
          <span className="text-[9px]">214</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Share2 className="h-5 w-5" />
          <span className="text-[9px]">Share</span>
        </div>
      </div>

      <div className="absolute bottom-5 left-3 right-12 z-10">
        <div className="mb-1 text-[11px] font-semibold">@{m.handle.replace(/^@/, "")}</div>
        <p className="text-[11px] leading-snug">{m.caption}</p>
      </div>
    </div>
  );
}

export function PlatformBadge({
  platform,
  label,
}: {
  platform: PlatformKey;
  label?: string;
}) {
  const Logo =
    platform === "instagram"
      ? InstagramLogo
      : platform === "linkedin"
        ? LinkedInLogo
        : YouTubeLogo;
  const name =
    label ??
    (platform === "instagram"
      ? "Instagram"
      : platform === "linkedin"
        ? "LinkedIn"
        : "YouTube");

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
      <Logo className="h-3.5 w-3.5" />
      {name}
    </div>
  );
}

type PhoneShowcaseProps = {
  platforms?: PlatformKey[];
  statuses?: Partial<Record<PlatformKey, PublishStatus>>;
  mediaConfig?: Partial<Record<PlatformKey, Partial<PhoneMedia>>>;
  className?: string;
  /** Primary phone index — larger / centered on mobile */
  primary?: number;
};

const SCREEN: Record<PlatformKey, (p: ScreenProps) => JSX.Element> = {
  instagram: InstagramScreen,
  linkedin: LinkedInScreen,
  youtube: YouTubeScreen,
};

const GLOW: Record<PlatformKey, NonNullable<PhoneFrameProps["glow"]>> = {
  instagram: "instagram",
  linkedin: "linkedin",
  youtube: "youtube",
};

/**
 * Fan of 2–3 phones. Mobile shows the primary large with neighbors peeking;
 * desktop shows the full tilted cluster.
 */
export function PhoneShowcase({
  platforms = ["instagram", "linkedin", "youtube"],
  statuses = { instagram: "live", linkedin: "scheduled", youtube: "draft" },
  mediaConfig = {},
  className = "",
  primary = 0,
}: PhoneShowcaseProps) {
  const layouts = [
    { rotate: "-7deg", left: "17%", top: "14%", z: 1, size: "md" as const },
    { rotate: "0deg", left: "50%", top: "2%", z: 3, size: "lg" as const, center: true },
    { rotate: "7deg", left: "83%", top: "14%", z: 2, size: "md" as const },
  ];

  // Center the primary platform in the middle slot when 3 phones
  const ordered =
    platforms.length === 3
      ? [platforms[(primary + 2) % 3], platforms[primary], platforms[(primary + 1) % 3]]
      : platforms;

  return (
    <div className={`relative mx-auto h-[700px] w-full max-w-[1180px] overflow-visible sm:h-[740px] ${className}`}>
      {ordered.map((platform, i) => {
        const layout = layouts[Math.min(i, layouts.length - 1)];
        const Screen = SCREEN[platform];
        const isPrimary = Boolean(layout.center) || ordered.length === 1;

        return (
          <div
            key={`${platform}-${i}`}
            className={`absolute transition-transform duration-700 ${
              isPrimary ? "block" : "hidden sm:block"
            }`}
            style={{
              left: layout.left,
              top: layout.top,
              zIndex: layout.z,
              transform: `translateX(-50%) rotate(${layout.rotate})`,
            }}
          >
            <PhoneFrame
              size={layout.size}
              glow={GLOW[platform]}
              float={isPrimary}
            >
              <Screen status={statuses[platform]} media={mediaConfig[platform]} />
            </PhoneFrame>
            <div className="mt-3 flex justify-center">
              <PlatformBadge platform={platform} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Compact single-platform phone for feature / workflow rows */
export function FeaturePhone({
  platform,
  status,
  media,
  size = "md",
  className = "",
}: {
  platform: PlatformKey;
  status?: PublishStatus;
  media?: Partial<PhoneMedia>;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Screen = SCREEN[platform];
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <PhoneFrame size={size} glow={GLOW[platform]} float>
        <Screen status={status} media={media} />
      </PhoneFrame>
      <PlatformBadge platform={platform} />
    </div>
  );
}

/** Keep PhoneReels export for any lingering imports during migration */
export function PhoneReels() {
  return (
    <PhoneFrame size="lg" glow="instagram" float>
      <InstagramScreen 
        status="live" 
        media={{ 
          src: '/videos/Pregnant_woman_taking_over_bed.mp4',
          handle: '@nithindidigam',
          caption: 'Automated 10x distribution 🚀',
        }} 
      />
    </PhoneFrame>
  );
}
