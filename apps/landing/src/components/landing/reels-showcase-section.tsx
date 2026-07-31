import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ReelFormat = {
  id: string;
  label: string;
  blurb: string;
  src: string;
  poster: string;
};

/**
 * Illustrative formats + stock clips (not customer content) — same convention
 * as the sample media used in features-section.tsx.
 */
const REEL_FORMATS: ReelFormat[] = [
  {
    id: "ugc",
    label: "UGC",
    blurb: "Raw, phone-shot, creator style",
    src: "/videos/Adorable_toddler_calling_someone.mp4",
    poster: "from-brand/70 via-fuchsia-500/40 to-indigo-600/60",
  },
  {
    id: "testimonial",
    label: "Testimonial",
    blurb: "A real voice, telling it straight",
    src: "/videos/Caring_partner_giving_massage.mp4",
    poster: "from-emerald-500/60 via-teal-500/40 to-brand/50",
  },
  {
    id: "unboxing",
    label: "Unboxing",
    blurb: "The reveal, close and tactile",
    src: "/videos/Cute_fluffy_animated_hamster.mp4",
    poster: "from-amber-400/60 via-orange-500/40 to-fuchsia-600/50",
  },
  {
    id: "before-after",
    label: "Before / After",
    blurb: "The transformation, side by side",
    src: "/videos/Applying_a_wrist_brace.mp4",
    poster: "from-sky-500/50 via-brand/30 to-indigo-500/60",
  },
  {
    id: "problem-solution",
    label: "Problem → Solution",
    blurb: "The pain, then the fix",
    src: "/videos/Toddlers_using_laptop.mp4",
    poster: "from-indigo-500/60 via-purple-500/40 to-rose-500/40",
  },
  {
    id: "product-cinematic",
    label: "Product cinematic",
    blurb: "Glossy, lit, hero framing",
    src: "/videos/Cute_winking_animated_girl.mp4",
    poster: "from-neutral-700/70 via-brand/30 to-amber-400/40",
  },
  {
    id: "beauty-closeup",
    label: "Beauty close-up",
    blurb: "Texture, detail, instant attention",
    src: "/videos/beauty-closeup.mp4",
    poster: "from-slate-950/80 via-sky-900/50 to-rose-400/40",
  },
  {
    id: "product-story",
    label: "Product story",
    blurb: "A product moment with a little wonder",
    src: "/videos/product-story.mp4",
    poster: "from-orange-400/60 via-pink-400/40 to-sky-500/50",
  },
  {
    id: "asmr",
    label: "ASMR",
    blurb: "Close, tactile, sound-led",
    src: "/videos/Cozy_cartoon_characters_bedroom.mp4",
    poster: "from-rose-400/50 via-brand/30 to-sky-500/40",
  },
  {
    id: "talking-head",
    label: "Talking head",
    blurb: "One founder, one camera",
    src: "/videos/Cute_animated_children_talking.mp4",
    poster: "from-brand/60 via-indigo-500/40 to-emerald-500/40",
  },
];

function ReelCard({ format, index, ariaHidden }: { format: ReelFormat; index: number; ariaHidden?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      aria-hidden={ariaHidden}
      className="group relative aspect-[9/16] w-[200px] shrink-0 overflow-hidden rounded-2xl border border-foreground/10 bg-neutral-900 shadow-sm transition-transform duration-300 hover:-translate-y-1 sm:w-[230px]"
      style={{ transitionDelay: `${index * 40}ms` }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${format.poster}`} />
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src={format.src}
        muted
        loop
        playsInline
        preload="metadata"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/70">
          {format.label}
        </p>
        <p className="mt-1 text-sm font-medium leading-snug">{format.blurb}</p>
      </div>
    </div>
  );
}

export function ReelsShowcaseSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isPointerOverScrollerRef = useRef(false);
  const resumeAutoScrollAtRef = useRef(0);
  const loopSegmentRef = useRef(0);

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

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !isVisible) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frameId = 0;
    let previousTime = performance.now();
    let driftPosition = el.scrollLeft;

    const measureSegment = () => {
      const first = el.children[0] as HTMLElement | undefined;
      const next = el.children[REEL_FORMATS.length] as HTMLElement | undefined;
      if (!first || !next) return 0;
      return Math.max(1, next.getBoundingClientRect().left - first.getBoundingClientRect().left);
    };

    // Start in the middle copy. The copies on either side make the track
    // genuinely cyclic, so wrapping never reveals an empty edge.
    loopSegmentRef.current = measureSegment();
    if (loopSegmentRef.current > 0) {
      el.scrollLeft = loopSegmentRef.current;
      driftPosition = el.scrollLeft;
    }

    const normalizeLoop = () => {
      const segment = loopSegmentRef.current || (loopSegmentRef.current = measureSegment());
      if (!segment) return;
      while (el.scrollLeft < segment) el.scrollLeft += segment;
      while (el.scrollLeft >= segment * 2) el.scrollLeft -= segment;
      driftPosition = el.scrollLeft;
    };

    const drift = (now: number) => {
      const elapsed = Math.min(now - previousTime, 64);
      previousTime = now;
      normalizeLoop();
      const shouldMove =
        loopSegmentRef.current > 1 &&
        !reducedMotion.matches &&
        document.visibilityState === "visible" &&
        !isPointerOverScrollerRef.current &&
        now >= resumeAutoScrollAtRef.current;

      if (shouldMove) {
        const pixelsPerSecond = 25;
        if (Math.abs(el.scrollLeft - driftPosition) > 2) driftPosition = el.scrollLeft;
        driftPosition += pixelsPerSecond * (elapsed / 1000);
        el.scrollLeft = driftPosition;
      } else {
        driftPosition = el.scrollLeft;
      }

      frameId = window.requestAnimationFrame(drift);
    };

    frameId = window.requestAnimationFrame(drift);
    return () => window.cancelAnimationFrame(frameId);
  }, [isVisible]);

  const pauseAutoScroll = (milliseconds = 3200) => {
    resumeAutoScrollAtRef.current = performance.now() + milliseconds;
  };

  const scrollByCards = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    pauseAutoScroll();
    const first = el.children[0] as HTMLElement | undefined;
    const cardStep = first ? first.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * cardStep, behavior: "smooth" });
  };

  return (
    <section ref={sectionRef} className="relative border-t border-foreground/10 py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div
          className={`mb-10 flex flex-col gap-6 transition-all duration-700 lg:mb-14 lg:flex-row lg:items-end lg:justify-between ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <div>
            <span className="mb-6 inline-flex items-center gap-3 font-mono text-sm text-muted-foreground">
              <span className="h-px w-8 bg-foreground/30" />
              Same brief, different stories
            </span>
            <h2 className="font-display text-4xl tracking-tight lg:text-6xl">
              Every reel format your feed needs.
            </h2>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
              MagicBox drafts the format that fits each moment — UGC, testimonial, unboxing, and
              more — all from the same weekly brief and brand kit.
            </p>
          </div>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <button
              type="button"
              onClick={() => scrollByCards(-1)}
              aria-label="Scroll formats left"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/15 text-foreground/70 transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollByCards(1)}
              aria-label="Scroll formats right"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/15 text-foreground/70 transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        onPointerEnter={() => {
          isPointerOverScrollerRef.current = true;
        }}
        onPointerLeave={() => {
          isPointerOverScrollerRef.current = false;
          pauseAutoScroll(900);
        }}
        onPointerDown={() => {
          isPointerOverScrollerRef.current = true;
          pauseAutoScroll();
        }}
        onPointerUp={(event) => {
          isPointerOverScrollerRef.current = event.pointerType === "mouse";
          pauseAutoScroll();
        }}
        onWheel={() => pauseAutoScroll()}
        onFocusCapture={() => {
          isPointerOverScrollerRef.current = true;
        }}
        onBlurCapture={() => {
          isPointerOverScrollerRef.current = false;
          pauseAutoScroll(900);
        }}
        className="no-scrollbar flex gap-4 overflow-x-auto px-6 pb-2 lg:px-12"
      >
        {[0, 1, 2].flatMap((copy) =>
          REEL_FORMATS.map((format, index) => (
            <ReelCard
              key={`${copy}-${format.id}`}
              format={format}
              index={index}
              ariaHidden={copy !== 1}
            />
          )),
        )}
      </div>
    </section>
  );
}
