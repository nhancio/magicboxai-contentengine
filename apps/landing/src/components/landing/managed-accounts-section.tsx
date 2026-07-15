import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CALENDLY_URL } from "@/lib/config";
import { InstagramLogo, TikTokLogo, YouTubeLogo } from "./channel-logos";

const perks = [
  "Real accounts, run by real people — no bots",
  "Warmed up in your exact niche",
  "Instagram, TikTok & YouTube",
  "Unified analytics across accounts",
  "Ongoing account management",
  "Target multiple countries (US & EU)",
  "Fully integrated with MagicBox content",
];

const sampleAccounts = [
  { handle: "@yourbrand_us", Logo: InstagramLogo, region: "🇺🇸 USA" },
  { handle: "@yourbrand_uk", Logo: TikTokLogo, region: "🇬🇧 UK" },
  { handle: "@yourbrand_ca", Logo: YouTubeLogo, region: "🇨🇦 CA" },
];

export function ManagedAccountsSection() {
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
    <section id="managed-accounts" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className={`text-center max-w-3xl mx-auto mb-14 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 px-3 py-1 text-xs font-mono uppercase tracking-widest text-brand mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
            Early access · waitlist
          </span>
          <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-6">
            Managed accounts,
            <br />
            done for you.
          </h2>
          <p className="text-xl text-muted-foreground">
            We create and warm real, human-run accounts in the niche and country you're
            targeting — then run them on autopilot through MagicBox.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className={`transition-all duration-1000 delay-100 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="border border-foreground/10 bg-foreground/[0.02] p-6 rounded-lg">
              <div className="space-y-3 mb-6">
                {sampleAccounts.map((a) => (
                  <div key={a.handle} className="flex items-center gap-3 border border-foreground/10 bg-background px-4 py-3 rounded-md">
                    <a.Logo className="h-5 w-5 text-foreground/70 shrink-0" />
                    <span className="font-medium">{a.handle}</span>
                    <span className="ml-auto text-xs font-mono text-muted-foreground">{a.region}</span>
                    <span className="text-xs font-mono text-brand">warming</span>
                  </div>
                ))}
              </div>
              <Button asChild variant="brand" className="w-full rounded-md h-11">
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer">Join the waitlist</a>
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {perks.map((perk, i) => (
              <div
                key={perk}
                className={`flex items-center gap-3 transition-all duration-500 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6"}`}
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <Check className="h-5 w-5 text-brand shrink-0" />
                <span className="text-lg">{perk}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
