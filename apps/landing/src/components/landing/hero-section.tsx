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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { appLoginUrl } from "@/lib/config";
import { captureEvent } from "@shared/lib/analytics";
import { InstagramLogo } from "./channel-logos";

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Ensure video plays smoothly on mobile & desktop browsers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    const tryPlay = () => {
      void video.play().catch(() => {
        // Autoplay policy fallback: user interaction will start playback
      });
    };

    tryPlay();
    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);

    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting) tryPlay();
                else video.pause();
              }
            },
            { threshold: 0.15 }
          )
        : null;

    observer?.observe(video);

    return () => {
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
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
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-8">
          {/* Left Column — Text & CTAs */}
          <div
            className={`space-y-6 lg:col-span-7 transition-all duration-700 ${
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

          {/* Right Column — Phone Mockup with Reel Video */}
          <div
            className={`flex justify-center lg:col-span-5 lg:justify-end transition-all duration-700 delay-100 ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
          >
            <div data-testid="hero-phone-stage" className="relative group">
              {/* Glow Aura */}
              <div className="absolute -inset-4 rounded-[3rem] bg-gradient-to-r from-brand/30 via-fuchsia-500/20 to-purple-600/30 blur-2xl opacity-80 group-hover:opacity-100 transition-opacity" />

              {/* Phone Frame */}
              <div className="relative h-[540px] w-[270px] sm:h-[590px] sm:w-[295px] overflow-hidden rounded-[2.8rem] border-[10px] border-[#0f172a] bg-[#0f172a] shadow-[0_30px_70px_rgba(15,23,42,0.35)] select-none">
                {/* Dynamic Island Notch */}
                <div className="absolute left-1/2 top-2.5 z-30 h-4 w-[76px] -translate-x-1/2 rounded-full bg-black" />

                {/* Reel Content Surface */}
                <div className="relative h-full w-full overflow-hidden bg-black text-white">
                  {/* Gradient placeholder so video never flashes blank before first frame */}
                  <div className="absolute inset-0 bg-gradient-to-br from-brand/70 via-fuchsia-500/40 to-indigo-600/60 pointer-events-none" />

                  {/* Playing Video element — plays on mobile and desktop */}
                  <video
                    ref={videoRef}
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

                  {/* Gradient Overlay for Readable Text */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none" />

                  {/* Top Reel Navigation Bar */}
                  <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pb-2 pt-9">
                    <span className="text-xs font-semibold tracking-tight">Reels</span>
                    <InstagramLogo className="h-4 w-4 text-white" />
                  </div>

                  {/* Center Play Indicator */}
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-lg">
                      <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
                    </div>
                  </div>

                  {/* Right Action Buttons */}
                  <div className="absolute bottom-20 right-3 z-20 flex flex-col items-center gap-4 text-white">
                    <button type="button" className="flex flex-col items-center gap-1">
                      <Heart className="h-6 w-6 fill-white text-white" />
                      <span className="text-[10px] font-semibold">9,812</span>
                    </button>
                    <button type="button" className="flex flex-col items-center gap-1">
                      <MessageCircle className="h-6 w-6 text-white" />
                      <span className="text-[10px] font-semibold">328</span>
                    </button>
                    <button type="button" className="flex flex-col items-center gap-1">
                      <Send className="h-5 w-5 text-white" />
                      <span className="text-[10px] font-semibold">Share</span>
                    </button>
                  </div>

                  {/* Bottom Post & Account Overlay */}
                  <div className="absolute inset-x-0 bottom-0 z-20 p-4 space-y-2 text-left">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand font-bold text-[10px] ring-2 ring-white">
                        MB
                      </div>
                      <span className="text-xs font-semibold">@yourbrand</span>
                      <button
                        type="button"
                        className="rounded-full border border-white/40 bg-white/10 px-2 py-0.5 text-[9px] font-medium backdrop-blur-xs"
                      >
                        Follow
                      </button>
                    </div>

                    <p className="text-xs font-medium leading-snug line-clamp-2 pr-12">
                      How we booked 40 demos in a week ✨
                    </p>

                    <div className="flex items-center gap-1.5 text-[10px] text-white/80">
                      <Sparkles className="h-3 w-3 text-brand-foreground" />
                      <span>MagicBox scheduled</span>
                    </div>
                  </div>
                </div>
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
