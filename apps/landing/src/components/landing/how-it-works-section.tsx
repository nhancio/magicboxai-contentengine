import { useEffect, useRef, useState } from "react";
import { ArrowDown, Check, FileText, Sparkles, ChevronDown } from "lucide-react";
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
    image: "/images/linkedin-card.svg",
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
      { threshold: 0.1 }
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

        {/* Visual journey: Top to Bottom Flow */}
        <div
          className={`relative mb-20 flex flex-col items-center justify-center gap-6 lg:mb-28 ${
            isVisible ? "opacity-100" : "opacity-0"
          } transition-opacity duration-700 delay-150`}
        >
          {/* Step 1: Connect Card */}
          <div className="flex flex-col items-center gap-3">
            <ConnectCard />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              1 · Connect
            </span>
          </div>

          {/* Animated Downward Connector Path & Arrow 1 */}
          <div className="flex flex-col items-center gap-1 my-2">
            <div className="h-10 w-0.5 border-l-2 border-dashed border-brand/50 animate-pulse" />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand animate-bounce">
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>

          {/* Step 2: Brief Card */}
          <div className="flex flex-col items-center gap-3">
            <BriefCard />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              2 · Brief
            </span>
          </div>

          {/* Animated Downward Connector Path & Arrow 2 */}
          <div className="flex flex-col items-center gap-1 my-2">
            <div className="h-10 w-0.5 border-l-2 border-dashed border-brand/50 animate-pulse" />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand animate-bounce">
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>

          {/* Step 3: Feature Phone Previews */}
          <div className="flex flex-col items-center gap-3">
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
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-2">
              3 · Publish &amp; Review
            </span>
          </div>
        </div>

        {/* Top-to-Bottom Flow Step Cards with Connector Line */}
        <div className="relative grid gap-6 sm:grid-cols-3">
          {/* Connector Line across top on desktop */}
          <div className="hidden sm:block absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 border-t-2 border-dashed border-brand/20 -z-0" />

          {steps.map((step, i) => (
            <div
              key={step.number}
              className={`relative z-10 rounded-2xl border border-foreground/10 bg-background p-8 shadow-sm transition-all duration-700 hover:border-brand/40 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
              style={{ transitionDelay: `${200 + i * 100}ms` }}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-brand">{step.number}</span>
                <ArrowDown className="h-4 w-4 text-brand/50" />
              </div>
              <h3 className="mb-3 font-display text-2xl text-foreground">{step.title}</h3>
              <p className="leading-relaxed text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
