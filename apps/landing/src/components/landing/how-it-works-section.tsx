import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, FileText, Sparkles } from "lucide-react";
import { FeaturePhone } from "./phone-system";
import { InstagramLogo, LinkedInLogo, YouTubeLogo } from "./channel-logos";

const steps = [
  {
    number: "01",
    title: "Connect your channels",
    description:
      "Link Instagram, LinkedIn, and YouTube. MagicBox stores access server-side and only publishes to accounts you authorize.",
  },
  {
    number: "02",
    title: "Describe one brief",
    description:
      "Give it a theme, voice, and cadence. Your brand kit shapes copy, palette, and imagery automatically.",
  },
  {
    number: "03",
    title: "Review or auto-publish",
    description:
      "Approve drafts from the queue, or let trusted automations ship on schedule to connected channels.",
  },
];

const previewMedia = {
  instagram: {
    src: "/videos/Cute_winking_animated_girl.mp4",
    handle: "@yourbrand",
    caption: "One brief, turned into a scroll-stopping Reel.",
  },
  linkedin: {
    src: "/videos/sample1.mp4",
    handle: "Your Brand",
    title: "Founder",
    caption: "A channel-ready update, shaped to your brand voice.",
  },
  youtube: {
    src: "/videos/Cute_baby_at_gym.mp4",
    handle: "Your Brand",
    caption: "A polished Short, ready for review.",
  },
} as const;

function BriefCard() {
  return (
    <div className="w-full max-w-[280px] rounded-2xl border border-foreground/10 bg-background p-5 shadow-lg">
      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <FileText className="h-3.5 w-3.5 text-brand" />
        Campaign brief
      </div>
      <p className="mb-4 text-sm leading-relaxed">
        Founder-led B2B tips, 3× a week — confident, concise, no jargon.
      </p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-brand" />
        Generating channel-ready posts…
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="aspect-square rounded-lg bg-gradient-to-br from-brand/40 to-indigo-500/30 animate-fill-dot"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function ConnectCard() {
  const rows = [
    { name: "Instagram", Logo: InstagramLogo },
    { name: "LinkedIn", Logo: LinkedInLogo },
    { name: "YouTube", Logo: YouTubeLogo },
  ];
  return (
    <div className="w-full max-w-[280px] space-y-2.5">
      {rows.map(({ name, Logo }, i) => (
        <div
          key={name}
          className="flex items-center justify-between rounded-xl border border-foreground/10 bg-background px-4 py-3 shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <Logo className="h-5 w-5" />
            <span className="text-sm font-medium">{name}</span>
          </div>
          <span
            className="flex items-center gap-1 font-mono text-[10px] font-medium text-emerald-700 animate-check-pop"
            style={{ animationDelay: `${i * 200}ms` }}
          >
            <Check className="h-3.5 w-3.5" /> Connected
          </span>
        </div>
      ))}
    </div>
  );
}

export function HowItWorksSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative overflow-hidden border-t border-foreground/10 py-24 lg:py-32"
    >
      <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="mb-16 text-center lg:mb-20">
          <span className="mb-6 inline-flex items-center gap-3 font-mono text-sm text-muted-foreground">
            <span className="h-px w-8 bg-foreground/30" />
            How it works
            <span className="h-px w-8 bg-foreground/30" />
          </span>
          <h2
            className={`font-display text-4xl tracking-tight transition-all duration-700 lg:text-6xl ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            Brief in.
            <br />
            <span className="text-muted-foreground">Posts out — channel ready.</span>
          </h2>
        </div>

        {/* Visual journey: brief → phone → destinations */}
        <div
          className={`relative mb-20 flex flex-col items-center justify-center gap-8 lg:mb-28 lg:flex-row lg:items-center lg:gap-6 ${
            isVisible ? "opacity-100" : "opacity-0"
          } transition-opacity duration-700 delay-150`}
        >
          <div className="flex flex-col items-center gap-3">
            <ConnectCard />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              1 · Connect
            </span>
          </div>

          <ArrowRight className="hidden h-5 w-5 text-brand/60 lg:block animate-connector-pulse" />

          <div className="flex flex-col items-center gap-3">
            <BriefCard />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              2 · Brief
            </span>
          </div>

          <ArrowRight className="hidden h-5 w-5 text-brand/60 lg:block animate-connector-pulse" />

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end sm:gap-4">
            <FeaturePhone
              platform="instagram"
              status="review"
              size="sm"
              media={previewMedia.instagram}
            />
            <div className="hidden sm:block">
              <FeaturePhone
                platform="linkedin"
                status="scheduled"
                size="sm"
                media={previewMedia.linkedin}
              />
            </div>
            <div className="hidden md:block">
              <FeaturePhone
                platform="youtube"
                status="draft"
                size="sm"
                media={previewMedia.youtube}
              />
            </div>
          </div>
        </div>

        {/* Step cards */}
        <div className="grid gap-px bg-foreground/10 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className={`bg-background p-8 transition-all duration-700 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
              style={{ transitionDelay: `${200 + i * 100}ms` }}
            >
              <span className="mb-4 block font-mono text-sm text-brand">{step.number}</span>
              <h3 className="mb-3 font-display text-2xl">{step.title}</h3>
              <p className="leading-relaxed text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
