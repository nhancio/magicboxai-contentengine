import { useEffect, useRef, useState } from "react";
import { Check, Minus, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appLoginUrl } from "@/lib/config";
import { captureEvent } from "@shared/lib/analytics";
import { InstagramLogo, LinkedInLogo, YouTubeLogo } from "./channel-logos";

type FormatRow = {
  label: string;
  instagram: boolean | "note";
  linkedin: boolean | "note";
  youtube: boolean | "note";
  note?: string;
};

const formats: FormatRow[] = [
  { label: "Image posts", instagram: true, linkedin: true, youtube: false },
  { label: "Text posts", instagram: false, linkedin: true, youtube: false },
  {
    label: "Video / Reels / Shorts",
    instagram: true,
    linkedin: "note",
    youtube: true,
    note: "LinkedIn video falls back to text today",
  },
  { label: "Brand-aware captions", instagram: true, linkedin: true, youtube: true },
  { label: "Approval queue", instagram: true, linkedin: true, youtube: true },
  { label: "Recurring schedules", instagram: true, linkedin: true, youtube: true },
];

const platforms = [
  {
    key: "instagram" as const,
    name: "Instagram",
    Logo: InstagramLogo,
    summary: "Feed images & Reels. Requires a Business/Creator account linked to a Facebook Page.",
  },
  {
    key: "linkedin" as const,
    name: "LinkedIn",
    Logo: LinkedInLogo,
    summary: "Text and image posts to member profiles. Video upload is not yet supported.",
  },
  {
    key: "youtube" as const,
    name: "YouTube",
    Logo: YouTubeLogo,
    summary: "Video uploads (Shorts-ready). Requires a video asset; subject to API quota.",
  },
];

function Cell({ value }: { value: boolean | "note" }) {
  if (value === true) {
    return <Check className="mx-auto h-4 w-4 text-emerald-700" role="img" aria-label="Supported" />;
  }
  if (value === "note") {
    return <span className="font-mono text-[10px] font-medium text-amber-800">Limited</span>;
  }
  return <Minus className="mx-auto h-4 w-4 text-foreground/45" role="img" aria-label="Not supported" />;
}

export function IntegrationsSection() {
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
      id="supported"
      ref={sectionRef}
      className="relative overflow-hidden border-t border-foreground/10 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="mb-14 text-center lg:mb-16">
          <span className="mb-6 inline-flex items-center gap-3 font-mono text-sm text-muted-foreground">
            <span className="h-px w-8 bg-foreground/30" />
            What&apos;s supported
            <span className="h-px w-8 bg-foreground/30" />
          </span>
          <h2
            className={`mb-4 font-display text-4xl tracking-tight transition-all duration-700 lg:text-6xl ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            Three channels.
            <br />
            <span className="text-muted-foreground">Honest formats.</span>
          </h2>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Post on the platforms MagicBox actually publishes to today — no wishlist icons.
          </p>
        </div>

        {/* Platform cards */}
        <div className="mb-14 grid gap-px bg-foreground/10 sm:grid-cols-3">
          {platforms.map((p, i) => (
            <div
              key={p.key}
              className={`bg-background p-7 transition-all duration-700 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
              style={{ transitionDelay: `${150 + i * 80}ms` }}
            >
              <div className="mb-4 flex items-center gap-3">
                <p.Logo className="h-6 w-6" />
                <h3 className="font-display text-xl">{p.name}</h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.summary}</p>
            </div>
          ))}
        </div>

        {/* Format matrix */}
        <div className="overflow-x-auto rounded-2xl border border-foreground/10">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-foreground/10 bg-foreground/[0.02]">
                <th className="px-5 py-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Format
                </th>
                <th className="px-5 py-4 text-center font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <InstagramLogo className="h-4 w-4" /> Instagram
                  </span>
                </th>
                <th className="px-5 py-4 text-center font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <LinkedInLogo className="h-4 w-4" /> LinkedIn
                  </span>
                </th>
                <th className="px-5 py-4 text-center font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <YouTubeLogo className="h-4 w-4" /> YouTube
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {formats.map((row) => (
                <tr key={row.label} className="border-b border-foreground/5 last:border-0">
                  <td className="px-5 py-3.5">
                    <div>{row.label}</div>
                    {row.note && (
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {row.note}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <Cell value={row.instagram} />
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <Cell value={row.linkedin} />
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <Cell value={row.youtube} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <p className="max-w-lg text-sm text-muted-foreground">
            Short-form AI video generation is a gated beta and off by default. X / TikTok /
            Threads are not available for direct publishing yet.
          </p>
          <Button asChild size="lg" variant="brand" className="group h-16 rounded-full px-14 text-xl font-medium shadow-[0_12px_24px_rgba(139,92,246,0.28)] transition-all hover:shadow-[0_16px_32px_rgba(139,92,246,0.38)]">
            <a
              href={appLoginUrl("/settings?tab=integrations")}
              onClick={() => captureEvent("landing_cta_clicked", { cta: "supported_connect_channels", destination: "connections" })}
            >
              Connect your channels
              <ArrowUpRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
