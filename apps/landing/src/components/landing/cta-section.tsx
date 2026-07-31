import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bot, CalendarClock, Send, Sparkles, CheckCircle2 } from "lucide-react";
import { BOOKING_URL, appLoginUrl } from "@/lib/config";
import { captureEvent } from "@shared/lib/analytics";

export function CtaSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[#fcfcf9] py-24 text-[#17212a] lg:py-32"
    >
      {/* Soft Radial Ambient Glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(147,51,234,0.12),transparent_70%)]" />

      <div className="relative mx-auto max-w-[1380px] px-6 lg:px-12">
        <div
          className={`relative overflow-hidden rounded-[2.5rem] border border-[#e2e8f0] bg-white/80 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.06)] backdrop-blur-md transition-all duration-700 lg:p-16 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          {/* Background Aura Glow */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-gradient-to-br from-brand/20 via-fuchsia-500/15 to-purple-600/20 blur-3xl" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between lg:gap-12">
            {/* Left Content */}
            <div className="max-w-2xl space-y-6">
              {/* Logo / Brand Header */}
              <div className="flex items-center gap-3">
                <img
                  src="/logo-128.webp"
                  alt="MagicBox"
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-xl object-contain shadow-xs"
                />
                <span className="font-display text-2xl font-semibold tracking-tight text-[#0f172a]">
                  MagicBox
                </span>
              </div>

              {/* Main Headline */}
              <h2 className="font-display text-[clamp(2.5rem,5vw,4.8rem)] font-normal leading-[1.02] tracking-[-0.04em] text-[#0f172a]">
                Ready to put your
                <br />
                <span className="font-serif italic text-brand underline decoration-brand/30 underline-offset-8">
                  marketing workflow
                </span>{" "}
                to work?
              </h2>

              {/* Subtext */}
              <p className="text-base leading-relaxed text-[#475569] sm:text-lg lg:text-xl">
                Describe your brand, connect a supported channel, and build a reviewable first post.
                Explore the workflow before choosing a paid publishing plan.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Button
                  asChild
                  size="lg"
                  variant="brand"
                  className="group h-13 rounded-full px-8 text-base shadow-[0_12px_24px_rgba(139,92,246,0.28)] transition-all hover:shadow-[0_16px_32px_rgba(139,92,246,0.38)]"
                >
                  <a
                    href={appLoginUrl()}
                    onClick={() =>
                      captureEvent("landing_cta_clicked", {
                        cta: "footer_create_plan",
                        destination: "onboarding",
                      })
                    }
                  >
                    Create this week&apos;s plan
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </a>
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-13 rounded-full border-[#cbd5e1] bg-white px-7 text-base font-medium text-[#334155] shadow-xs hover:border-[#94a3b8] hover:bg-[#f8fafc]"
                >
                  <a
                    href={BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      captureEvent("landing_cta_clicked", {
                        cta: "footer_contact_support",
                        destination: "support",
                      })
                    }
                  >
                    Contact support
                  </a>
                </Button>
              </div>

              {/* Reassurance Badge */}
              <div className="flex items-center gap-2 text-xs font-medium text-[#64748b]">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>No card required to explore</span>
              </div>
            </div>

            {/* Right Graphic / Interactive Orbit */}
            <div
              className="hidden lg:flex h-[360px] w-[360px] shrink-0 items-center justify-center relative"
              aria-hidden="true"
            >
              <div className="relative flex h-72 w-72 items-center justify-center rounded-full border border-[#e2e8f0] bg-gradient-to-br from-purple-500/5 to-brand/10 shadow-lg">
                {/* Rotating Dashed Orbit Ring */}
                <div className="absolute inset-4 rounded-full border border-dashed border-brand/30 animate-[spin_28s_linear_infinite]" />

                {/* Center Bot Badge */}
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-brand text-brand-foreground shadow-[0_16px_36px_rgba(139,92,246,0.35)] animate-pulse-slow">
                  <Bot className="h-11 w-11" />
                </div>

                {/* Floating Orbit Badges */}
                <span className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-2xl border border-[#e2e8f0] bg-white text-brand shadow-md animate-phone-float">
                  <CalendarClock className="h-5 w-5" />
                </span>

                <span className="absolute right-4 top-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e2e8f0] bg-white text-brand shadow-md animate-phone-float" style={{ animationDelay: "1s" }}>
                  <Send className="h-5 w-5" />
                </span>

                <span className="absolute bottom-6 left-12 flex h-10 w-10 items-center justify-center rounded-2xl border border-[#e2e8f0] bg-white text-brand shadow-md animate-phone-float" style={{ animationDelay: "2s" }}>
                  <Sparkles className="h-4 w-4" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
