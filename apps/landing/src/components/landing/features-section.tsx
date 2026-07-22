import { useEffect, useRef, useState } from "react";
import { FeaturePhone, type PlatformKey, type PublishStatus } from "./phone-system";

const features: {
  number: string;
  title: string;
  description: string;
  platform: PlatformKey;
  status: PublishStatus;
  media: { caption: string; handle: string };
}[] = [
  {
    number: "01",
    title: "Prompt to post",
    description:
      "Describe a campaign in a sentence. MagicBox writes the copy, generates the image, and prepares a post for each connected channel.",
    platform: "instagram",
    status: "live",
    media: {
      src: "/videos/Cute_baby_at_gym.mp4",
      caption: "3 things nobody tells you about launching →",
      handle: "@yourbrand",
    },
  },
  {
    number: "02",
    title: "On-brand by default",
    description:
      "Your brand kit — voice, palette, do's and don'ts — is baked into every generation. No more off-message posts slipping through.",
    platform: "linkedin",
    status: "review",
    media: {
      src: "/videos/Playful_cats_cuddling_on_bed.mp4",
      caption:
        "One brand kit. Consistent voice across every channel — without the copy-paste grind.",
      handle: "Your Brand",
    },
  },
  {
    number: "03",
    title: "Approve & auto-schedule",
    description:
      "Route everything through an approval queue, or let trusted automations run on the cadence you choose.",
    platform: "youtube",
    status: "scheduled",
    media: {
      src: "/videos/Cozy_cartoon_characters_bedroom.mp4",
      caption: "How one weekly brief became three Shorts",
      handle: "Your Brand",
    },
  },
  {
    number: "04",
    title: "Publish where it counts",
    description:
      "Direct publishing to Instagram, LinkedIn, and YouTube after you authorize each account — with formats each platform actually accepts.",
    platform: "instagram",
    status: "uploading",
    media: {
      src: "/videos/Cute_fluffy_animated_hamster.mp4",
      caption: "Queued for Reels · brand kit applied",
      handle: "@yourbrand",
    },
  },
];

function FeatureRow({
  feature,
  index,
}: {
  feature: (typeof features)[0];
  index: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const phoneLeft = index % 2 === 1;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 },
    );
    if (rowRef.current) observer.observe(rowRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rowRef}
      className={`grid items-center gap-10 border-b border-foreground/10 py-14 lg:grid-cols-2 lg:gap-16 lg:py-20 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
      } transition-all duration-700`}
      style={{ transitionDelay: `${index * 60}ms` }}
    >
      <div className={phoneLeft ? "lg:order-2" : ""}>
        <span className="mb-4 block font-mono text-sm text-muted-foreground">
          {feature.number}
        </span>
        <h3 className="mb-4 font-display text-3xl lg:text-4xl">{feature.title}</h3>
        <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
          {feature.description}
        </p>
      </div>

      <div className={`flex justify-center ${phoneLeft ? "lg:order-1" : ""}`}>
        <FeaturePhone
          platform={feature.platform}
          status={feature.status}
          media={feature.media}
          size="lg"
        />
      </div>
    </div>
  );
}

export function FeaturesSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.05 },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" ref={sectionRef} className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="mb-12 text-center lg:mb-16">
          <span className="mb-6 inline-flex items-center gap-3 font-mono text-sm text-muted-foreground">
            <span className="h-px w-8 bg-foreground/30" />
            Capabilities
            <span className="h-px w-8 bg-foreground/30" />
          </span>
          <h2
            className={`font-display text-4xl tracking-tight transition-all duration-700 lg:text-6xl ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            Everything shown on the phone
            <br />
            <span className="text-muted-foreground">is what MagicBox ships.</span>
          </h2>
        </div>

        <div>
          {features.map((feature, index) => (
            <FeatureRow key={feature.number} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
