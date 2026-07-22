import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { APP_URL } from "@/lib/config";
import { PhoneShowcase } from "./phone-system";
import { InstagramLogo, LinkedInLogo, YouTubeLogo } from "./channel-logos";

const CHANNELS = [
  { name: "Instagram", Logo: InstagramLogo },
  { name: "LinkedIn", Logo: LinkedInLogo },
  { name: "YouTube", Logo: YouTubeLogo },
];

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="relative overflow-hidden pt-28 lg:pt-32">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        {[...Array(8)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute left-0 right-0 h-px bg-foreground/10"
            style={{ top: `${12.5 * (i + 1)}%` }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-12">
        <div
          className={`mx-auto max-w-3xl text-center transition-all duration-700 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          {/* App name must match OAuth consent screen exactly: "MagicBox" */}
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Application name: MagicBox
          </p>
          <h1 className="mb-4 font-display text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.92] tracking-tight">
            MagicBox
          </h1>

          <p className="mb-6 font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-tight tracking-tight text-foreground/85">
            AI marketing automation for social media
          </p>

          <p className="mx-auto mb-6 max-w-2xl text-lg leading-relaxed text-muted-foreground lg:text-xl">
            <strong className="font-medium text-foreground">MagicBox</strong> is a
            web application from Nhancio Technologies Private Limited. It helps
            marketers and creators generate on-brand social posts, approve them,
            schedule publishing, and post to Instagram, LinkedIn, and{" "}
            <strong className="font-medium text-foreground">YouTube</strong> from
            accounts you connect.
          </p>

          <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
            When you connect Google / YouTube, MagicBox uses your authorized Google
            account only to upload and manage videos you choose to publish on your
            YouTube channel — not to train unrelated models or share your data with
            third parties for advertising. See our{" "}
            <a
              href="/privacy.html"
              className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
            >
              Privacy Policy
            </a>
            .
          </p>

          <div className="mb-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" variant="brand" className="group h-14 rounded-full px-8 text-base">
              <a href={`${APP_URL}/login`}>
                Start free with MagicBox
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 rounded-full px-8 text-base">
              <a href="#about-magicbox">What MagicBox does</a>
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
            {CHANNELS.map(({ name, Logo }) => (
              <span
                key={name}
                className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background px-3 py-1.5 text-xs font-medium text-foreground/80"
              >
                <Logo className="h-3.5 w-3.5" />
                {name}
              </span>
            ))}
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Direct publishing · brand-aware generation · human-in-the-loop
          </p>
        </div>

        <div
          className={`mt-10 transition-all duration-1000 delay-150 lg:mt-14 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <PhoneShowcase
            mediaConfig={{
              instagram: { src: "/videos/Applying_a_wrist_brace.mp4", handle: "@yourbrand" },
              linkedin: { src: "/videos/Cute_winking_animated_girl.mp4", handle: "Your Brand" },
              youtube: { src: "/videos/Adorable_toddler_calling_someone.mp4", handle: "Your Brand" },
            }}
            platforms={["instagram", "youtube", "linkedin"]}
            statuses={{
              instagram: "live",
              youtube: "uploading",
              linkedin: "scheduled",
            }}
            primary={0}
          />
        </div>
      </div>
    </section>
  );
}
