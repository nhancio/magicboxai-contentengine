import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { APP_URL } from "@/lib/config";
import { PhoneShowcase } from "./phone-system";
import { InstagramLogo, LinkedInLogo, YouTubeLogo } from "./channel-logos";

const CHANNELS = [
  { name: "Instagram", Logo: InstagramLogo },
  { name: "LinkedIn", Logo: LinkedInLogo },
  { name: "YouTube", Logo: YouTubeLogo },
];

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="relative overflow-hidden pt-28 lg:pt-32">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        {[...Array(8)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute left-0 right-0 h-px bg-foreground/10"
            style={{ top: `${12.5 * (i + 1)}%` }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-12">
        <div
          className={`mx-auto max-w-3xl text-center transition-all duration-700 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <span className="mb-6 inline-flex items-center gap-3 font-mono text-sm text-muted-foreground">
            <span className="h-px w-8 bg-foreground/30" />
            AI marketing agent for modern teams
            <span className="h-px w-8 bg-foreground/30" />
          </span>

          <h1 className="mb-6 font-display text-[clamp(2.5rem,6vw,4.75rem)] leading-[0.95] tracking-tight">
            Create once.
            <br />
            Publish{" "}
            <span className="relative inline-block">
              everywhere
              <span className="absolute -bottom-1 left-0 right-0 h-3 bg-brand/20" />
            </span>{" "}
            that matters.
          </h1>

          <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-muted-foreground lg:text-xl">
            Turn one brand brief into channel-ready posts for Instagram, LinkedIn,
            and YouTube — with approval controls and direct publishing.
          </p>

          <div className="mb-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" variant="brand" className="group h-14 rounded-full px-8 text-base">
              <a href={`${APP_URL}/login`}>
                Start free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 rounded-full px-8 text-base">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
            {CHANNELS.map(({ name, Logo }) => (
              <span
                key={name}
                className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background px-3 py-1.5 text-xs font-medium text-foreground/80"
              >
                <Logo className="h-3.5 w-3.5" />
                {name}
              </span>
            ))}
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Direct publishing · brand-aware generation · human-in-the-loop
          </p>
        </div>

        <div
          className={`mt-10 transition-all duration-1000 delay-150 lg:mt-14 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <PhoneShowcase
            platforms={["instagram", "youtube", "linkedin"]}
            statuses={{
              instagram: "live",
              youtube: "uploading",
              linkedin: "scheduled",
            }}
            primary={0}
          />
        </div>
      </div>
    </section>
  );
}
