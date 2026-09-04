import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  Instagram,
  Linkedin,
  Youtube,
  Sparkles,
} from "lucide-react";
import { BOOKING_URL, appLoginUrl } from "@/lib/config";
import { captureEvent } from "@shared/lib/analytics";

const PLAN_DAYS = [
  {
    day: "Mon",
    date: "12",
    title: "Product launch teaser",
    platform: "instagram" as const,
    status: "Scheduled",
    tone: "from-[#F58529] via-[#DD2A7B] to-[#8134AF]",
  },
  {
    day: "Wed",
    date: "14",
    title: "Founder insight thread",
    platform: "linkedin" as const,
    status: "In review",
    tone: "from-[#0A66C2] to-[#0A66C2]",
  },
  {
    day: "Fri",
    date: "16",
    title: "Behind-the-scenes Reel",
    platform: "youtube" as const,
    status: "Drafting",
    tone: "from-[#FF0000] to-[#c40000]",
  },
];

const PLATFORM_ICON = {
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
};

const STATUS_STYLE: Record<string, string> = {
  Scheduled: "bg-emerald-50 text-emerald-600 ring-emerald-200",
  "In review": "bg-amber-50 text-amber-600 ring-amber-200",
  Drafting: "bg-brand/10 text-brand ring-brand/20",
};

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
      className="relative overflow-hidden bg-[#fcfcf9] py-16 text-[#17212a] lg:py-20"
    >
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.14),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(219,42,123,0.08),transparent_55%)]" />

      <div className="relative mx-auto max-w-[1380px] px-6 lg:px-12">
        <div
          className={`relative overflow-hidden rounded-[2.5rem] border border-[#e6e8ec] bg-white/70 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-700 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <div className="grid items-stretch lg:grid-cols-[1.05fr_0.95fr]">
            {/* LEFT — Message + CTA */}
            <div className="relative flex flex-col justify-center gap-5 p-7 sm:p-10 lg:p-12">
              <div className="flex items-center gap-2">
                <img
                  src="/logo.svg"
                  alt="MagicBox"
                  width={28}
                  height={28}
                  loading="lazy"
                  decoding="async"
                  className="h-7 w-7 rounded-lg object-contain"
                />
                <span className="font-display text-lg font-semibold tracking-tight text-[#0f172a]">
                  MagicBox
                </span>
              </div>

              <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-brand/20 bg-brand/5 px-3 py-1 text-[11px] font-medium text-brand">
                <Sparkles className="h-3 w-3" />
                Your week, planned in minutes
              </div>

              <h2 className="font-display text-[clamp(1.9rem,3.4vw,3.2rem)] font-normal leading-[1.05] tracking-[-0.04em] text-[#0f172a]">
                Ready to put your{" "}
                <span className="font-serif italic text-brand">marketing workflow</span> to work?
              </h2>

              <p className="max-w-lg text-sm leading-relaxed text-[#475569] sm:text-base">
                Describe your brand, connect a supported channel, and build a reviewable first post.
                Explore the full workflow before choosing a paid publishing plan.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-0.5">
                <Button
                  asChild
                  size="lg"
                  variant="brand"
                  className="group h-11 rounded-full px-7 text-sm shadow-[0_12px_28px_rgba(139,92,246,0.3)] transition-all hover:shadow-[0_18px_36px_rgba(139,92,246,0.42)]"
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
                  className="h-11 rounded-full border-[#d3d8e0] bg-white/80 px-6 text-sm font-medium text-[#334155] hover:border-[#94a3b8] hover:bg-white"
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
                    Talk to us
                  </a>
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-[#64748b]">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  No card required to explore
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Review before anything publishes
                </span>
              </div>
            </div>

            {/* RIGHT — Product mockup: this week's plan */}
            <div
              className="relative flex items-center justify-center overflow-hidden border-t border-[#e6e8ec] bg-gradient-to-br from-[#faf9ff] via-white to-[#f6f4ff] p-7 sm:p-10 lg:border-l lg:border-t-0"
              aria-hidden="true"
            >
              <div className="pointer-events-none absolute -right-16 top-8 h-64 w-64 rounded-full bg-brand/15 blur-3xl" />
              <div className="pointer-events-none absolute -left-10 bottom-4 h-52 w-52 rounded-full bg-fuchsia-400/10 blur-3xl" />

              <div
                className={`relative w-full max-w-[320px] rounded-2xl border border-[#e6e8ec] bg-white/90 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-sm transition-all duration-700 delay-150 ${
                  isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                }`}
              >
                {/* Card header */}
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">
                      This week&apos;s plan
                    </p>
                    <p className="mt-0.5 font-display text-base text-[#0f172a]">3 posts queued</p>
                  </div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm">
                    <Sparkles className="h-4 w-4" />
                  </span>
                </div>

                {/* Plan rows */}
                <div className="space-y-2">
                  {PLAN_DAYS.map((item, i) => {
                    const Icon = PLATFORM_ICON[item.platform];
                    return (
                      <div
                        key={item.day}
                        className={`group flex items-center gap-2.5 rounded-lg border border-[#eef0f3] bg-white p-2 transition-all duration-500 hover:border-brand/30 hover:shadow-sm ${
                          isVisible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
                        }`}
                        style={{ transitionDelay: `${250 + i * 120}ms` }}
                      >
                        <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md bg-[#f8fafc] text-center">
                          <span className="text-[8px] font-semibold uppercase text-[#94a3b8]">
                            {item.day}
                          </span>
                          <span className="text-xs font-bold leading-none text-[#0f172a]">
                            {item.date}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-[#1e293b]">
                            {item.title}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span
                              className={`flex h-3.5 w-3.5 items-center justify-center rounded-[4px] bg-gradient-to-br text-white ${item.tone}`}
                            >
                              <Icon className="h-2 w-2" />
                            </span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ring-1 ${STATUS_STYLE[item.status]}`}
                            >
                              {item.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Card footer */}
                <div className="mt-3 flex items-center justify-between border-t border-[#eef0f3] pt-3">
                  <div className="flex -space-x-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#F58529] to-[#8134AF] text-white ring-2 ring-white">
                      <Instagram className="h-2.5 w-2.5" />
                    </span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0A66C2] text-white ring-2 ring-white">
                      <Linkedin className="h-2.5 w-2.5" />
                    </span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FF0000] text-white ring-2 ring-white">
                      <Youtube className="h-2.5 w-2.5" />
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 ring-1 ring-emerald-200">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Ready to review
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
