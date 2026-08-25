import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  Heart,
  MessageCircle,
  Play,
  Send,
  Share2,
  Sparkles,
  ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { appLoginUrl } from "@/lib/config";
import { captureEvent } from "@shared/lib/analytics";
import { InstagramLogo, LinkedInLogo, YouTubeLogo } from "./channel-logos";

/**
 * Modern iPhone Pro Max mockup frame with titanium bezel, dynamic island,
 * status elements, and realistic cast shadow.
 */
function PhoneFrameShell({
  children,
  className = "",
  islandWidth = 74,
}: {
  children: React.ReactNode;
  className?: string;
  islandWidth?: number;
}) {
  return (
    <div
      className={`relative h-[480px] w-[222px] shrink-0 sm:h-[510px] sm:w-[236px] lg:h-[480px] lg:w-[222px] xl:h-[515px] xl:w-[238px] select-none ${className}`}
    >
      {/* Titanium band outer rim */}
      <div className="relative h-full w-full rounded-[2.85rem] bg-gradient-to-b from-[#64748b] via-[#334155] to-[#1e293b] p-[2.5px]">
        {/* Inner black bezel */}
        <div className="relative h-full w-full rounded-[2.7rem] bg-black p-[7px] shadow-inner">
          {/* Dynamic Island Pill */}
          <div
            className="pointer-events-none absolute left-1/2 top-2 z-30 flex h-4 -translate-x-1/2 items-center justify-end rounded-full bg-black pr-2 shadow-sm"
            style={{ width: `${islandWidth}px` }}
          >
            {/* Subtle camera lens reflection */}
            <span className="h-1.5 w-1.5 rounded-full bg-[#1e293b] ring-1 ring-white/10" />
          </div>

          {/* Screen Content Surface */}
          <div className="relative h-full w-full overflow-hidden rounded-[2.2rem] bg-black text-white">
            {children}
            {/* Home Indicator Bar */}
            <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-30 h-1 w-24 -translate-x-1/2 rounded-full bg-white/70" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);
  const centerVideoRef = useRef<HTMLVideoElement>(null);
  const leftVideoRef = useRef<HTMLVideoElement>(null);
  const rightVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Ensure all 3 videos autoplay smoothly on mobile & desktop browsers
  useEffect(() => {
    const videos = [
      centerVideoRef.current,
      leftVideoRef.current,
      rightVideoRef.current,
    ].filter(Boolean) as HTMLVideoElement[];

    videos.forEach((video) => {
      video.muted = true;
      video.defaultMuted = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
    });

    const tryPlayAll = () => {
      videos.forEach((video) => {
        void video.play().catch(() => {});
      });
    };

    tryPlayAll();
    videos.forEach((video) => {
      video.addEventListener("loadeddata", tryPlayAll);
      video.addEventListener("canplay", tryPlayAll);
    });

    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting) tryPlayAll();
                else {
                  videos.forEach((v) => v.pause());
                }
              }
            },
            { threshold: 0.15 }
          )
        : null;

    if (centerVideoRef.current) {
      observer?.observe(centerVideoRef.current);
    }

    return () => {
      videos.forEach((video) => {
        video.removeEventListener("loadeddata", tryPlayAll);
        video.removeEventListener("canplay", tryPlayAll);
      });
      observer?.disconnect();
    };
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#fcfcf9] pb-16 pt-28 text-[#17212a] sm:pt-32 lg:pb-24 lg:pt-36">
      {/* Background Grid Pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse at center, black 60%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto max-w-[1380px] px-4 sm:px-6 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-8 xl:gap-4">
          {/* Left Column — Text & CTAs */}
          <div
            className={`space-y-6 lg:col-span-7 xl:col-span-6 transition-all duration-700 ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
            }`}
          >
            {/* Eyebrow / 1.0 Release Badge */}
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/changelog"
                className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/5 px-3.5 py-1 text-xs font-mono text-brand transition-colors hover:bg-brand/10 hover:border-brand/30"
              >
                <span className="flex h-2 w-2 rounded-full bg-brand animate-pulse" />
                <span className="font-semibold uppercase tracking-wider">v1.0 is Live</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-foreground/80 font-sans font-medium">Explore Release Notes</span>
                <ChevronRight className="h-3 w-3 text-brand" />
              </a>
            </div>

            {/* Main Headline */}
            <h1 className="font-display text-[clamp(2.75rem,5.5vw,5.2rem)] font-normal leading-[1.02] tracking-[-0.04em] text-[#0f172a]">
              Marketing that{" "}
              <span className="font-serif italic text-brand decoration-brand/30 decoration-wavy underline-offset-4">
                runs on brand
              </span>
            </h1>

            {/* Subtitle */}
            <p className="max-w-xl text-base leading-relaxed text-[#475569] sm:text-lg lg:text-xl">
              One prompt in. On-vibe, high-converting posts and AI videos out — auto-published across Instagram,
              LinkedIn, and YouTube, exactly when your audience is watching.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button
                asChild
                size="lg"
                variant="brand"
                className="group h-14 rounded-full px-10 text-lg shadow-[0_12px_24px_rgba(139,92,246,0.28)] transition-all hover:shadow-[0_16px_32px_rgba(139,92,246,0.38)]"
              >
                <a
                  href={appLoginUrl()}
                  onClick={() =>
                    captureEvent("landing_cta_clicked", {
                      cta: "hero_start_free",
                      destination: "onboarding",
                    })
                  }
                >
                  Start free
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                </a>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 rounded-full border-[#cbd5e1] bg-white/80 px-8 text-lg font-medium text-[#334155] backdrop-blur-xs hover:border-[#94a3b8] hover:bg-white"
              >
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>
          </div>

          {/* Right Column — 3-Phone Mockup Fan (Left: YouTube, Center: Instagram Reels, Right: LinkedIn) */}
          <div
            className={`flex justify-center lg:col-span-5 lg:justify-end xl:col-span-6 xl:justify-center transition-all duration-700 delay-100 ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
          >
            {/* Stage container with responsive scaling for clean mobile and desktop fit */}
            <div
              data-testid="hero-phone-stage"
              className="relative flex items-center justify-center py-4 origin-center scale-[0.68] xs:scale-[0.78] sm:scale-[0.88] md:scale-95 lg:scale-[0.92] xl:scale-100 transition-transform"
            >
              {/* Soft Ambient Glow Aura */}
              <div className="pointer-events-none absolute -inset-8 rounded-[4rem] bg-gradient-to-r from-brand/25 via-fuchsia-500/15 to-indigo-500/25 blur-3xl opacity-75" />

              {/* 1. LEFT PHONE — Tilted counter-clockwise (-8.5deg), YouTube Shorts */}
              <div
                aria-hidden="true"
                className="z-10 -mr-16 sm:-mr-20 lg:-mr-16 xl:-mr-20 -rotate-[8.5deg] translate-y-3 shrink-0 transition-transform duration-500 hover:-translate-y-1 hover:-rotate-[10deg]"
              >
                <PhoneFrameShell
                  islandWidth={68}
                  className="shadow-[-16px_28px_50px_rgba(15,23,42,0.32),0_10px_20px_rgba(0,0,0,0.18)]"
                >
                  <div className="relative h-full w-full overflow-hidden bg-black">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-600/60 via-orange-500/40 to-brand/50 pointer-events-none" />
                    <video
                      ref={leftVideoRef}
                      src="/videos/product-story.mp4"
                      className="absolute inset-0 h-full w-full object-cover"
                      muted
                      loop
                      playsInline
                      autoPlay
                      preload="metadata"
                      tabIndex={-1}
                      disablePictureInPicture
                      disableRemotePlayback
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/85" />

                    {/* Top YouTube Shorts Header */}
                    <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3.5 pb-2 pt-8 text-white">
                      <div className="flex items-center gap-1.5">
                        <YouTubeLogo className="h-4 w-4 text-red-500" />
                        <span className="font-sans text-[11px] font-bold tracking-tight">Shorts</span>
                      </div>
                      <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider backdrop-blur-xs">
                        YouTube
                      </span>
                    </div>

                    {/* Right side interaction buttons */}
                    <div className="absolute bottom-16 right-2.5 z-20 flex flex-col items-center gap-3 text-white/90">
                      <div className="flex flex-col items-center gap-0.5">
                        <ThumbsUp className="h-4 w-4" />
                        <span className="text-[9px] font-semibold">14.2k</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <MessageCircle className="h-4 w-4" />
                        <span className="text-[9px] font-semibold">412</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <Share2 className="h-4 w-4" />
                        <span className="text-[9px] font-semibold">Share</span>
                      </div>
                    </div>

                    {/* Bottom Caption */}
                    <div className="absolute inset-x-0 bottom-0 z-20 p-3.5 text-left text-white">
                      <div className="mb-1 flex items-center gap-1.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 font-bold text-[8px]">
                          MB
                        </div>
                        <span className="text-[11px] font-semibold">@yourbrand</span>
                      </div>
                      <p className="text-[10px] font-medium leading-snug line-clamp-2 text-white/90">
                        Product reveal with 1-click publishing 🚀
                      </p>
                    </div>
                  </div>
                </PhoneFrameShell>
              </div>

              {/* 2. CENTER PHONE — Upright (0deg), Instagram Reels, Front Elevation (z-20) */}
              <div className="relative z-20 shrink-0 transition-transform duration-500 hover:scale-[1.02]">
                <PhoneFrameShell
                  islandWidth={78}
                  className="shadow-[0_32px_75px_rgba(15,23,42,0.42),0_12px_24px_rgba(0,0,0,0.22)]"
                >
                  <div className="relative h-full w-full overflow-hidden bg-black text-white">
                    {/* Placeholder gradient */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/70 via-fuchsia-500/40 to-indigo-600/60" />

                    {/* Center Playing Video */}
                    <video
                      ref={centerVideoRef}
                      src="/videos/Cute_winking_animated_girl.mp4"
                      className="absolute inset-0 h-full w-full object-cover"
                      muted
                      loop
                      playsInline
                      autoPlay
                      preload="metadata"
                      aria-hidden="true"
                      tabIndex={-1}
                      disablePictureInPicture
                      disableRemotePlayback
                    />

                    {/* Gradient Overlay for Readable UI */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/85" />

                    {/* Top Reel Header */}
                    <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pb-2 pt-8">
                      <span className="text-xs font-semibold tracking-tight">Reels</span>
                      <InstagramLogo className="h-4 w-4 text-white" />
                    </div>

                    {/* Center Play Indicator */}
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white shadow-lg backdrop-blur-md">
                        <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
                      </div>
                    </div>

                    {/* Right Action Buttons */}
                    <div className="absolute bottom-16 right-3 z-20 flex flex-col items-center gap-3.5 text-white">
                      <button type="button" className="flex flex-col items-center gap-0.5">
                        <Heart className="h-5 w-5 fill-white text-white" />
                        <span className="text-[10px] font-semibold">9,812</span>
                      </button>
                      <button type="button" className="flex flex-col items-center gap-0.5">
                        <MessageCircle className="h-5 w-5 text-white" />
                        <span className="text-[10px] font-semibold">328</span>
                      </button>
                      <button type="button" className="flex flex-col items-center gap-0.5">
                        <Send className="h-4 w-4 text-white" />
                        <span className="text-[10px] font-semibold">Share</span>
                      </button>
                    </div>

                    {/* Bottom Post & Account Overlay */}
                    <div className="absolute inset-x-0 bottom-0 z-20 p-3.5 space-y-1.5 text-left">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand font-bold text-[9px] ring-2 ring-white">
                          MB
                        </div>
                        <span className="text-xs font-semibold">@yourbrand</span>
                        <span className="rounded-full border border-white/40 bg-white/10 px-2 py-0.5 text-[9px] font-medium backdrop-blur-xs">
                          Follow
                        </span>
                      </div>

                      <p className="text-xs font-medium leading-snug line-clamp-2 pr-12 text-white">
                        How we booked 40 demos in a week ✨
                      </p>

                      <div className="flex items-center gap-1.5 text-[10px] text-white/85">
                        <Sparkles className="h-3 w-3 text-brand-foreground" />
                        <span className="font-mono text-[9px] uppercase tracking-wider">MagicBox scheduled</span>
                      </div>
                    </div>
                  </div>
                </PhoneFrameShell>
              </div>

              {/* 3. RIGHT PHONE — Tilted clockwise (+8.5deg), LinkedIn */}
              <div
                aria-hidden="true"
                className="z-10 -ml-16 sm:-ml-20 lg:-ml-16 xl:-ml-20 rotate-[8.5deg] translate-y-3 shrink-0 transition-transform duration-500 hover:-translate-y-1 hover:rotate-[10deg]"
              >
                <PhoneFrameShell
                  islandWidth={68}
                  className="shadow-[16px_28px_50px_rgba(15,23,42,0.32),0_10px_20px_rgba(0,0,0,0.18)]"
                >
                  <div className="relative h-full w-full overflow-hidden bg-black">
                    <div className="absolute inset-0 bg-gradient-to-br from-sky-600/60 via-indigo-500/40 to-brand/50 pointer-events-none" />
                    <video
                      ref={rightVideoRef}
                      src="/videos/beauty-closeup.mp4"
                      className="absolute inset-0 h-full w-full object-cover"
                      muted
                      loop
                      playsInline
                      autoPlay
                      preload="metadata"
                      tabIndex={-1}
                      disablePictureInPicture
                      disableRemotePlayback
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/85" />

                    {/* Top LinkedIn Header */}
                    <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3.5 pb-2 pt-8 text-white">
                      <div className="flex items-center gap-1.5">
                        <LinkedInLogo className="h-4 w-4 text-[#0a66c2]" />
                        <span className="font-sans text-[11px] font-bold tracking-tight">LinkedIn</span>
                      </div>
                      <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider backdrop-blur-xs">
                        Feed
                      </span>
                    </div>

                    {/* Right side interaction buttons */}
                    <div className="absolute bottom-16 right-2.5 z-20 flex flex-col items-center gap-3 text-white/90">
                      <div className="flex flex-col items-center gap-0.5">
                        <ThumbsUp className="h-4 w-4" />
                        <span className="text-[9px] font-semibold">2.8k</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <MessageCircle className="h-4 w-4" />
                        <span className="text-[9px] font-semibold">184</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <Share2 className="h-4 w-4" />
                        <span className="text-[9px] font-semibold">Repost</span>
                      </div>
                    </div>

                    {/* Bottom Caption */}
                    <div className="absolute inset-x-0 bottom-0 z-20 p-3.5 text-left text-white">
                      <div className="mb-1 flex items-center gap-1.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0a66c2] font-bold text-[8px]">
                          MB
                        </div>
                        <div className="leading-none">
                          <span className="text-[11px] font-semibold">Your Brand</span>
                          <span className="block text-[8px] text-white/60">Founder · Now</span>
                        </div>
                      </div>
                      <p className="text-[10px] font-medium leading-snug line-clamp-2 text-white/90">
                        Turned one prompt into a full week of engagement.
                      </p>
                    </div>
                  </div>
                </PhoneFrameShell>
              </div>
            </div>
          </div>
        </div>

        {/* Ticker / Key Highlights Row below Hero */}
        <div className="mt-16 border-t border-[#e2e8f0] pt-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4 lg:gap-8">
            <div className="space-y-1">
              <p className="font-display text-3xl font-bold text-[#0f172a] lg:text-4xl">3x</p>
              <p className="text-xs font-medium text-[#64748b]">more posts shipped</p>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#94a3b8]">
                ON AVERAGE
              </p>
            </div>

            <div className="space-y-1">
              <p className="font-display text-3xl font-bold text-[#0f172a] lg:text-4xl">100%</p>
              <p className="text-xs font-medium text-[#64748b]">on-brand output</p>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#94a3b8]">
                BRAND KIT
              </p>
            </div>

            <div className="space-y-1">
              <p className="font-display text-3xl font-bold text-[#0f172a] lg:text-4xl">3</p>
              <p className="text-xs font-medium text-[#64748b]">channels, one prompt</p>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#94a3b8]">
                IG · X · IN
              </p>
            </div>

            <div className="space-y-1">
              <p className="font-display text-3xl font-bold text-[#0f172a] lg:text-4xl">12 hrs</p>
              <p className="text-xs font-medium text-[#64748b]">saved per week</p>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#94a3b8]">
                PER TEAM
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
