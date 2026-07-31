import { useEffect, useRef, useState } from "react";
import { FeaturePhone, type PlatformKey, type PublishStatus } from "./phone-system";

const features: {
  number: string;
  title: string;
  description: string;
  platform: PlatformKey;
  status: PublishStatus;
  media: { caption: string; handle: string; src: string };
}[] = [
  {
    number: "01",
    title: "Prompt to post",
    description:
      "Describe a campaign in a sentence. MagicBox writes the copy, generates the image, and prepares a post for each connected channel.",
    platform: "instagram",
    status: "review",
    media: {
      caption: "A product update, ready for review",
      handle: "@yourbrand",
      src: "/videos/beauty-closeup.mp4",
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
      caption:
        "One brand kit. Consistent voice across every channel — without the copy-paste grind.",
      handle: "Your Brand",
      src: "/videos/Cute_animated_children_talking.mp4",
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
      caption: "One brief, adapted to each connected channel",
      handle: "Your Brand",
      src: "/videos/Toddlers_using_laptop.mp4",
    },
  },
  {
    number: "04",
    title: "Publish where it counts",
    description:
      "Direct publishing to Instagram, LinkedIn, and YouTube after you authorize each account — with formats each platform actually accepts.",
    platform: "instagram",
    status: "scheduled",
    media: {
      caption: "Scheduled with your approval settings",
      handle: "@yourbrand",
      src: "/videos/product-story.mp4",
    },
  },
];

function StepBlock({
  feature,
  index,
  active,
  onActivate,
}: {
  feature: (typeof features)[0];
  index: number;
  active: boolean;
  onActivate: (index: number) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onActivate(index);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index, onActivate]);

  return (
    <div
      ref={rowRef}
      className={`border-b border-foreground/10 py-14 transition-opacity duration-500 lg:min-h-[60vh] lg:flex lg:flex-col lg:justify-center lg:border-b-0 lg:py-0 ${
        active ? "opacity-100" : "lg:opacity-40"
      }`}
    >
      <span className="mb-4 block font-mono text-sm text-muted-foreground">
        {feature.number}
      </span>
      <h3 className="mb-4 font-display text-3xl lg:text-4xl">{feature.title}</h3>
      <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
        {feature.description}
      </p>

      {/* Sticky phone only renders on lg+; mobile gets its own inline phone per step */}
      <div className="mt-8 flex justify-center lg:hidden">
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
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const active = features[activeIndex];

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
            A walkthrough of the workflow
            <br />
            <span className="text-muted-foreground">before anything is published.</span>
          </h2>
        </div>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            {features.map((feature, index) => (
              <StepBlock
                key={feature.number}
                feature={feature}
                index={index}
                active={activeIndex === index}
                onActivate={setActiveIndex}
              />
            ))}
          </div>

          {/* Desktop only: one phone stays pinned in view while steps scroll past on the left */}
          <div className="hidden lg:block">
            <div className="sticky top-32 flex justify-center">
              <FeaturePhone
                platform={active.platform}
                status={active.status}
                media={active.media}
                size="lg"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
