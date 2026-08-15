import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarClock, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appLoginUrl } from "@/lib/config";
import { captureEvent } from "@shared/lib/analytics";
import { InstagramLogo, LinkedInLogo, YouTubeLogo, FacebookLogo } from "./channel-logos";

const floatingChannels = [
  {
    name: "Instagram",
    Logo: InstagramLogo,
    position: "left-[4%] top-[12%]",
    animation: "animate-[float_6s_ease-in-out_infinite]",
  },
  {
    name: "YouTube",
    Logo: YouTubeLogo,
    position: "right-[6%] top-[8%]",
    animation: "animate-[float_7s_ease-in-out_infinite_1s]",
  },
  {
    name: "LinkedIn",
    Logo: LinkedInLogo,
    position: "left-[8%] bottom-[12%]",
    animation: "animate-[float_6.5s_ease-in-out_infinite_1.5s]",
  },
  {
    name: "Facebook",
    Logo: FacebookLogo,
    position: "right-[5%] bottom-[14%]",
    animation: "animate-[float_5.5s_ease-in-out_infinite_0.5s]",
  },
];

export function AboutMagicBoxSection() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section
      id="about-magicbox"
      className="relative scroll-mt-24 overflow-hidden bg-[#fcfcf9] py-20 text-[#17212a] sm:py-28 lg:py-36"
    >
      {/* Soft Ambient Background Glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(147,51,234,0.12),transparent_60%)]" />

      <div className="relative mx-auto max-w-[1380px] px-6 lg:px-12">
        {/* Floating Channel Badges (Dynamic, moving open screen) */}
        {floatingChannels.map(({ name, Logo, position, animation }, index) => (
          <div
            key={`${name}-${index}`}
            className={`absolute hidden sm:flex items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white/90 px-3.5 py-2.5 shadow-[0_16px_36px_rgba(15,23,42,0.08)] backdrop-blur-md transition-all duration-300 hover:scale-105 ${position} ${animation}`}
            role="img"
            aria-label={name}
          >
            <Logo className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="text-xs font-semibold text-[#334155]">{name}</span>
          </div>
        ))}

        {/* Center Content — Open Screen Layout */}
        <div
          className={`relative mx-auto max-w-3xl text-center transition-all duration-700 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          {/* Eyebrow Pill */}
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-brand font-semibold shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-brand" /> Integrations
          </span>

          {/* Main Headline */}
          <h2 className="mt-8 font-display text-[clamp(2.75rem,6.5vw,5.5rem)] font-normal leading-[0.95] tracking-[-0.05em] text-[#0f172a]">
            Schedule directly
            <br />
            <span className="font-serif italic text-brand decoration-brand/30 underline-offset-8">
              from one brief.
            </span>
          </h2>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#475569] sm:text-lg lg:text-xl">
            Turn an approved idea into channel-ready posts, then publish to Instagram, LinkedIn, and
            YouTube when your audience is ready.
          </p>

          {/* Primary CTA */}
          <div className="mt-9 flex justify-center">
            <Button
              asChild
              size="lg"
              variant="brand"
              className="group h-16 rounded-full px-14 text-xl font-medium shadow-[0_12px_24px_rgba(139,92,246,0.28)] transition-all hover:shadow-[0_16px_32px_rgba(139,92,246,0.38)]"
            >
              <a
                href={appLoginUrl("/settings?tab=integrations")}
                onClick={() =>
                  captureEvent("landing_cta_clicked", {
                    cta: "schedule_from_one_brief",
                    destination: "connections",
                  })
                }
              >
                Connect your channels
                <ArrowUpRight className="ml-2 h-6 w-6 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </Button>
          </div>
        </div>

        {/* 3 Step Cards at Bottom — Open layout */}
        <div
          className={`relative mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3 transition-all duration-700 delay-200 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          {[
            ["Create", "Brand-aware copy and media", Sparkles],
            ["Review", "You approve every draft", Check],
            ["Publish", "Schedule when it matters", CalendarClock],
          ].map(([label, detail, Icon], i) => (
            <div
              key={label as string}
              className="group rounded-2xl border border-[#e2e8f0] bg-white p-5 text-left shadow-[0_10px_25px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_16px_35px_rgba(139,92,246,0.12)] animate-[float_5s_ease-in-out_infinite]"
              style={{ animationDelay: `${i * 0.4}s` }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand group-hover:bg-brand group-hover:text-brand-foreground transition-colors">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-base font-semibold text-[#0f172a]">{label as string}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#64748b]">{detail as string}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
