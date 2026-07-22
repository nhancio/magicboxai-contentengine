import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { APP_URL } from "@/lib/config";
import { PhoneReels } from "./phone-reels";

export function SpotlightSection() {
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
    <section id="spotlight" ref={sectionRef} className="relative py-24 lg:py-32 bg-foreground/[0.02] overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className={`transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <span className="inline-flex items-center gap-2 text-sm font-mono text-muted-foreground mb-6">
              <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
              Spotlight
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-6 leading-[0.95]">
              One brief in.
              <br />
              A reviewable post out.
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-10">
              Turn a campaign idea into channel-ready copy and an image, then choose
              whether the result waits for review or follows an automatic schedule.
            </p>

            {/* TODO: replace with a real, verifiable customer story + quote before launch. */}
            <div className="border border-foreground/10 p-6 bg-background">
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
                What one automation does
              </div>
              <p className="text-lg leading-relaxed">
                Writes the copy, generates the image, applies your selected cadence,
                and queues publishing for supported accounts you have connected.
              </p>
            </div>

            <div className="mt-8">
              <Button asChild size="lg" variant="brand" className="px-8 h-14 text-base rounded-full">
                <a href={`${APP_URL}/login`}>Get started for free</a>
              </Button>
            </div>
          </div>

          <div className={`hidden lg:flex justify-center transition-all duration-1000 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <PhoneShowcase 
              platforms={["instagram"]} 
              mediaConfig={{ instagram: { src: '/videos/Pregnant_woman_taking_over_bed.mp4', handle: '@yourbrand', caption: 'Automated 10x distribution 🚀' } }} 
            />
          </div>
        </div>
      </div>
    </section>
  );
}
