import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bot, CalendarClock, Send } from "lucide-react";
import { CALENDLY_URL, appLoginUrl } from "@/lib/config";
import { captureEvent } from "@shared/lib/analytics";

export function CtaSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    }, { threshold: 0.2 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <section ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className={`relative border border-foreground transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} onMouseMove={handleMouseMove}>
          <div className="absolute inset-0 opacity-10 pointer-events-none transition-opacity duration-300" style={{ background: `radial-gradient(600px circle at ${mousePosition.x}% ${mousePosition.y}%, rgb(var(--brand) / 0.25), transparent 40%)` }} />

          <div className="relative z-10 px-8 lg:px-16 py-16 lg:py-24">
            {/* MagicBox logo at the top */}
            <div className="flex items-center gap-2.5 mb-10">
              <img src="/logo-128.webp" alt="MagicBox" width={36} height={36} className="h-9 w-9 rounded-lg object-contain" />
              <span className="font-display text-2xl tracking-tight">MagicBox</span>
            </div>

            <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
              <div className="flex-1">
                <h2 className="text-4xl lg:text-7xl font-display tracking-tight mb-8 leading-[0.95]">
                  Ready to put your
                  <br />
                  marketing workflow to work?
                </h2>
                <p className="text-xl text-muted-foreground mb-12 leading-relaxed max-w-xl">
                  Describe your brand, connect a supported channel, and build a reviewable
                  first post. Explore the workflow before choosing a paid publishing plan.
                </p>
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <Button asChild size="lg" variant="brand" className="px-8 h-14 text-base rounded-full group">
                    <a
                      href={appLoginUrl()}
                      onClick={() => captureEvent("landing_cta_clicked", { cta: "footer_create_plan", destination: "onboarding" })}
                    >
                      Create this week&apos;s plan
                      <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-14 px-8 text-base rounded-full">
                    <a
                      href={CALENDLY_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => captureEvent("landing_cta_clicked", { cta: "footer_contact_support", destination: "support" })}
                    >
                      Contact support
                    </a>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-8 font-mono">No card required to explore</p>
              </div>

              <div className="hidden h-[380px] w-[380px] shrink-0 items-center justify-center lg:flex" aria-hidden="true">
                <div className="relative flex h-72 w-72 items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.02]">
                  <div className="absolute inset-8 rounded-full border border-dashed border-foreground/20 animate-[spin_24s_linear_infinite]" />
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-brand text-brand-foreground shadow-2xl">
                    <Bot className="h-11 w-11" />
                  </div>
                  <span className="absolute left-1 top-1/2 flex h-12 w-12 items-center justify-center rounded-2xl border border-foreground/10 bg-background shadow-lg">
                    <CalendarClock className="h-5 w-5" />
                  </span>
                  <span className="absolute right-5 top-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-foreground/10 bg-background shadow-lg">
                    <Send className="h-5 w-5" />
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute top-0 right-0 w-32 h-32 border-b border-l border-foreground/10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 border-t border-r border-foreground/10" />
        </div>
      </div>
    </section>
  );
}
