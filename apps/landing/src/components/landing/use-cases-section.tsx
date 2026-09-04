import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { appLoginUrl } from "@/lib/config";
import { captureEvent } from "@shared/lib/analytics";
import { CHANNELS, type ChannelKey } from "./channel-logos";

type UseCase = {
  id: "solo-founder" | "lean-team";
  title: string;
  blurb: string;
  channels: ChannelKey[];
};

/**
 * These presets make onboarding faster; they are not customer stories or proof
 * of results. Keep them in sync with apps/web/src/lib/presets.ts.
 */
const USE_CASES: UseCase[] = [
  {
    id: "solo-founder",
    title: "Solo founders & creators",
    blurb: "Turn one weekly vibe or update into a viral, reviewable LinkedIn and Instagram plan.",
    channels: ["linkedin", "instagram"],
  },
  {
    id: "lean-team",
    title: "Brands & marketing teams",
    blurb: "Keep your brand aesthetic on-vibe with automated UGC videos, approval workflows, and multi-channel publishing.",
    channels: ["linkedin", "instagram", "youtube"],
  },
];

const logoFor = (key: ChannelKey) => CHANNELS.find((channel) => channel.key === key)!.Logo;

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
    <section id="use-cases" ref={sectionRef} className="relative border-t border-foreground/10 py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="mb-14 lg:mb-20">
          <span className="mb-6 inline-flex items-center gap-3 font-mono text-sm text-muted-foreground">
            <span className="h-px w-8 bg-foreground/30" />
            Start with your workflow
          </span>
          <h2 className="font-display text-4xl tracking-tight lg:text-6xl">
            Pick a starting point.
            <br />
            <span className="text-muted-foreground">We&apos;ll pre-select the setup.</span>
          </h2>
        </div>

        <div className="grid gap-px bg-foreground/10 sm:grid-cols-2">
          {USE_CASES.map((useCase, index) => (
            <div
              key={useCase.id}
              className={`group flex flex-col bg-background p-8 transition-all duration-700 hover:bg-brand/[0.03] ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <div className="mb-6 flex items-center gap-2 text-foreground/70 group-hover:text-brand transition-colors">
                {useCase.channels.map((channel) => {
                  const Logo = logoFor(channel);
                  return <Logo key={channel} className="h-5 w-5" />;
                })}
              </div>
              <h3 className="mb-3 font-display text-2xl">{useCase.title}</h3>
              <p className="leading-relaxed text-muted-foreground">{useCase.blurb}</p>

              <div className="mt-8 border-t border-foreground/10 pt-6">
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Recommended starting channels
                </p>
                <p className="mt-2 text-sm text-foreground/80">
                  {useCase.channels.map((channel) => CHANNELS.find((item) => item.key === channel)!.name).join(" + ")}
                </p>
              </div>

              <a
                href={appLoginUrl(`/onboarding?preset=${useCase.id}`)}
                onClick={() => captureEvent("landing_cta_clicked", { cta: `use_case_${useCase.id}`, destination: "onboarding" })}
                className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors group-hover:text-brand"
              >
                Start with this setup
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          ))}
        </div>

        <p className="mt-8 font-mono text-sm text-muted-foreground">
          Setup suggestions only. You choose which supported accounts to connect and what to publish.
        </p>
      </div>
    </section>
  );
}
