import { useEffect, useRef, useState } from "react";
import { Sparkles, SlidersHorizontal, ScanFace, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_URL } from "@/lib/config";

const features = [
  { icon: Sparkles, title: "Photorealistic quality", description: "Realistic, iPhone-style AI influencers — generated from a single prompt." },
  { icon: SlidersHorizontal, title: "Full creative control", description: "Customize every detail, from appearance to tone of voice." },
  { icon: ScanFace, title: "Consistent brand presence", description: "The same face and vibe across every post and video." },
  { icon: Repeat, title: "Yours, forever", description: "Reuse your unique character across every video, freely." },
];

function FeatureBlock({
  icon: Icon,
  title,
  description,
  align,
  visible,
  delay,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
  align: "left" | "right";
  visible: boolean;
  delay: number;
}) {
  return (
    <div
      className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className={`flex items-center gap-3 mb-2 ${align === "right" ? "lg:flex-row-reverse lg:text-right" : ""}`}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-medium">{title}</h3>
      </div>
      <p className={`text-muted-foreground ${align === "right" ? "lg:text-right" : ""}`}>{description}</p>
    </div>
  );
}

export function AIInfluencerSection() {
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
    <section id="ai-studio" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            AI Studio
            <span className="w-8 h-px bg-foreground/30" />
          </span>
          <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-6">
            Create your own
            <br />
            AI influencer.
          </h2>
          <p className="text-xl text-muted-foreground">
            Spin up a photorealistic, on-brand character and let MagicBox turn it into
            scroll-stopping video — all from one prompt.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_auto_1fr] items-center gap-10 lg:gap-14">
          <div className="space-y-10">
            {features.slice(0, 2).map((f, i) => (
              <FeatureBlock key={f.title} {...f} align="right" visible={isVisible} delay={i * 100} />
            ))}
          </div>

          <div className={`mx-auto transition-all duration-1000 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="relative w-[240px] h-[500px] rounded-[2.25rem] border border-foreground/15 bg-foreground/[0.03] p-2 shadow-2xl">
              <div className="relative h-full w-full rounded-[1.85rem] bg-gradient-to-b from-brand/25 via-brand/[0.06] to-transparent overflow-hidden flex items-end justify-center">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 h-1.5 w-16 rounded-full bg-foreground/20" />
                <div className="p-6 text-center">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand/20 text-brand">
                    <ScanFace className="h-8 w-8" />
                  </div>
                  <div className="font-display text-lg">Your AI influencer</div>
                  <div className="font-mono text-xs text-muted-foreground mt-1">generated from one prompt</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-10">
            {features.slice(2).map((f, i) => (
              <FeatureBlock key={f.title} {...f} align="left" visible={isVisible} delay={i * 100 + 200} />
            ))}
          </div>
        </div>

        <div className={`mt-14 flex justify-center transition-all duration-700 delay-300 ${isVisible ? "opacity-100" : "opacity-0"}`}>
          <Button asChild size="lg" variant="brand" className="px-8 h-14 text-base rounded-full">
            <a href={`${APP_URL}/login`}>Build your influencer</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
