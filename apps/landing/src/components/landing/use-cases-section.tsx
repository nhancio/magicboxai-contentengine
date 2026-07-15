import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { APP_URL } from "@/lib/config";
import { CHANNELS, type ChannelKey } from "./channel-logos";

/**
 * Use-case presets. Selecting one deep-links to the app onboarding with `?preset=<id>`,
 * which pre-selects the channels below and prompts the user to connect them.
 * Keep these ids in sync with USE_CASE_PRESETS in apps/web/src/lib/presets.ts.
 */
const USE_CASES: {
  id: string;
  title: string;
  blurb: string;
  channels: ChannelKey[];
}[] = [
  {
    id: "founder",
    title: "Founders",
    blurb: "Build in public and stay top-of-mind without a content team.",
    channels: ["linkedin", "instagram", "youtube"],
  },
  {
    id: "solo-founder",
    title: "Solo founders",
    blurb: "One brief a week becomes a full calendar across your two core channels.",
    channels: ["linkedin", "instagram"],
  },
  {
    id: "agency",
    title: "Marketing agencies",
    blurb: "Run multiple brands, each on-voice, from a single workspace.",
    channels: ["instagram", "linkedin", "youtube"],
  },
  {
    id: "d2c",
    title: "D2C brands",
    blurb: "Turn products into scroll-stopping posts across visual-first channels.",
    channels: ["instagram", "youtube"],
  },
];

const logoFor = (key: ChannelKey) => CHANNELS.find((c) => c.key === key)!.Logo;

export function UseCasesSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    }, { threshold: 0.1 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="use-cases" ref={sectionRef} className="relative py-24 lg:py-32 border-t border-foreground/10">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-14 lg:mb-20">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            Built for how you work
          </span>
          <h2 className="text-4xl lg:text-6xl font-display tracking-tight">
            Pick your setup.
            <br />
            <span className="text-muted-foreground">We&apos;ll pre-wire the rest.</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-foreground/10">
          {USE_CASES.map((uc, i) => (
            <a
              key={uc.id}
              href={`${APP_URL}/onboarding?preset=${uc.id}`}
              className={`group bg-background p-8 flex flex-col transition-all duration-700 hover:bg-brand/[0.03] ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center gap-2 mb-6 text-foreground/70 group-hover:text-brand transition-colors">
                {uc.channels.map((ck) => {
                  const Logo = logoFor(ck);
                  return <Logo key={ck} className="w-5 h-5" />;
                })}
              </div>
              <h3 className="text-2xl font-display mb-3">{uc.title}</h3>
              <p className="text-muted-foreground leading-relaxed flex-1">{uc.blurb}</p>
              <span className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-foreground group-hover:text-brand transition-colors">
                Start with this
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </span>
            </a>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground font-mono">
          Selecting a setup pre-selects the right channels in onboarding and walks you through connecting them.
        </p>
      </div>
    </section>
  );
}
