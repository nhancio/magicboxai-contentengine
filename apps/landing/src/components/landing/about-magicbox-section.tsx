import { ArrowUpRight, CalendarClock, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appLoginUrl } from "@/lib/config";
import { captureEvent } from "@shared/lib/analytics";
import { InstagramLogo, LinkedInLogo, YouTubeLogo } from "./channel-logos";

const channels = [
  { name: "Instagram", Logo: InstagramLogo, className: "left-[7%] top-[18%] rotate-[-8deg]" },
  { name: "YouTube", Logo: YouTubeLogo, className: "right-[10%] top-[12%] rotate-[7deg]" },
  { name: "LinkedIn", Logo: LinkedInLogo, className: "left-[12%] bottom-[13%] rotate-[6deg]" },
  { name: "Instagram", Logo: InstagramLogo, className: "right-[8%] bottom-[16%] rotate-[-6deg]" },
];

/** A conversion-focused replacement for the former OAuth/privacy landing section. */
export function AboutMagicBoxSection() {
  return (
    <section id="about-magicbox" className="relative scroll-mt-24 overflow-hidden border-t border-foreground/10 py-20 sm:py-28 lg:py-36">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="relative isolate overflow-hidden rounded-[2rem] border border-foreground/10 bg-[#fbfaf8] px-6 py-14 shadow-[0_24px_70px_rgba(27,25,31,0.08)] sm:px-12 sm:py-20 lg:px-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(218,190,255,.22),transparent_36%),radial-gradient(circle_at_50%_100%,rgba(255,184,170,.18),transparent_35%)]" />
          {channels.map(({ name, Logo, className }, index) => (
            <div key={`${name}-${index}`} className={`absolute hidden h-14 w-14 items-center justify-center rounded-2xl border border-foreground/10 bg-white text-foreground/80 shadow-[0_12px_30px_rgba(26,24,30,0.12)] sm:flex lg:h-16 lg:w-16 ${className}`} role="img" aria-label={name}>
              <Logo className="h-6 w-6 lg:h-7 lg:w-7" />
            </div>
          ))}

          <div className="relative mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-white px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-[#8d62dd]" /> Integrations
            </span>
            <h2 className="mt-7 font-display text-[clamp(3rem,7vw,6.5rem)] leading-[0.9] tracking-[-0.06em]">
              Schedule directly
              <br />
              from one brief.
            </h2>
            <p className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Turn an approved idea into channel-ready posts, then publish to Instagram, LinkedIn, and YouTube when your audience is ready.
            </p>
            <Button asChild size="lg" variant="brand" className="mt-9 h-14 rounded-full px-8 text-base shadow-[0_12px_28px_rgba(128,78,220,.22)]">
              <a href={appLoginUrl()} onClick={() => captureEvent("landing_cta_clicked", { cta: "schedule_from_one_brief", destination: "onboarding" })}>
                Connect your channels <ArrowUpRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>

          <div className="relative mx-auto mt-14 grid max-w-3xl gap-3 sm:grid-cols-3">
            {[
              ["Create", "Brand-aware copy and media", Sparkles],
              ["Review", "You approve every draft", Check],
              ["Publish", "Schedule when it matters", CalendarClock],
            ].map(([label, detail, Icon]) => (
              <div key={label as string} className="rounded-2xl border border-foreground/10 bg-white/80 p-4 text-left backdrop-blur-sm">
                <Icon className="h-4 w-4 text-[#8d62dd]" />
                <p className="mt-3 text-sm font-semibold">{label as string}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail as string}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
