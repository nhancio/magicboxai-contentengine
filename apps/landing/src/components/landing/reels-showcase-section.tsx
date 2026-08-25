import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ReelFormat = {
  id: string;
  label: string;
  blurb: string;
  src: string;
  poster: string;
};

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
    src: "/videos/Cute_animated_children_talking.mp4",
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

function ReelCard({
  format,
  index,
  ariaHidden,
}: {
  format: ReelFormat;
  index: number;
  ariaHidden?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          const vid = videoRef.current;
          if (vid) void vid.play().catch(() => {});
        } else {
          const vid = videoRef.current;
          if (vid) vid.pause();
        }
      },
      { rootMargin: "100px 0px", threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !isInView) return;

    vid.muted = true;
    vid.defaultMuted = true;
    vid.setAttribute("muted", "");
    vid.setAttribute("playsinline", "");
    vid.setAttribute("webkit-playsinline", "");

    void vid.play().catch(() => {});
  }, [isInView]);

  return (
    <div
      ref={containerRef}
      aria-hidden={ariaHidden}
      className="group relative aspect-[9/16] w-[200px] shrink-0 select-none overflow-hidden rounded-2xl border border-foreground/10 bg-neutral-900 shadow-sm transition-transform duration-300 hover:-translate-y-1 sm:w-[230px]"
      style={{ transitionDelay: `${index * 30}ms` }}
    >
      <div className={`absolute inset-0 pointer-events-none bg-gradient-to-br ${format.poster}`} />
      {isInView ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
          src={format.src}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          disablePictureInPicture
          disableRemotePlayback
        />
      ) : null}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/85 via-black/5 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white pointer-events-none">
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

  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Smooth continuous cyclic auto-scroll that never stops on hover
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !isVisible) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frameId = 0;
    let previousTime = performance.now();

    const drift = (now: number) => {
      const elapsed = Math.min(now - previousTime, 64);
      previousTime = now;

      // Never stop on hover; only pause while actively holding mouse down to drag
      const shouldMove =
        !reducedMotion.matches &&
        !isMouseDownRef.current &&
        document.visibilityState === "visible";

      if (shouldMove) {
        const pixelsPerSecond = 35;
        el.scrollLeft += pixelsPerSecond * (elapsed / 1000);

        // Seamless infinite wrap (cards are duplicated in 2 sets)
        const halfScroll = el.scrollWidth / 2;
        if (halfScroll > 0 && el.scrollLeft >= halfScroll) {
          el.scrollLeft -= halfScroll;
        }
      }

      frameId = window.requestAnimationFrame(drift);
    };

    frameId = window.requestAnimationFrame(drift);
    return () => window.cancelAnimationFrame(frameId);
  }, [isVisible]);

  const scrollByCards = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const first = el.children[0] as HTMLElement | undefined;
    const cardStep = first ? first.getBoundingClientRect().width + 16 : 240;
    // The drift loop writes scrollLeft every frame, which cancels a smooth
    // scroll mid-flight — hold it off until the animation lands.
    isMouseDownRef.current = true;
    el.scrollBy({ left: direction * cardStep, behavior: "smooth" });
    window.setTimeout(() => {
      isMouseDownRef.current = false;
    }, 600);
  };

  // Mouse Drag-to-Scroll Handlers for Desktop
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    isMouseDownRef.current = true;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDownRef.current) return;
    const el = scrollerRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.5; // Scroll speed factor
    el.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isMouseDownRef.current = false;
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

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => scrollByCards(-1)}
              aria-label="Scroll formats left"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/20 bg-background text-foreground shadow-xs transition-all hover:border-brand hover:bg-brand hover:text-brand-foreground active:scale-95"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollByCards(1)}
              aria-label="Scroll formats right"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/20 bg-background text-foreground shadow-xs transition-all hover:border-brand hover:bg-brand hover:text-brand-foreground active:scale-95"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Drag & Scroll Container */}
      <div
        ref={scrollerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className="no-scrollbar flex gap-4 overflow-x-auto touch-pan-x cursor-grab active:cursor-grabbing px-6 pb-4 lg:px-12 select-none"
      >
        {[0, 1].flatMap((copy) =>
          REEL_FORMATS.map((format, index) => (
            <ReelCard
              key={`${copy}-${format.id}`}
              format={format}
              index={index}
              ariaHidden={copy !== 0}
            />
          ))
        )}
      </div>
    </section>
  );
}
