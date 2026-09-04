import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Wand2, Palette, Image as ImageIcon, Layers } from "lucide-react";
import { cn } from "@shared/lib/utils";

const CREATIVE_QUOTES = [
  {
    quote: "Visual storytelling connects 60,000x faster in the brain than plain text.",
    author: "Marketing Science",
  },
  {
    quote: "Design is the silent ambassador of your brand.",
    author: "Paul Rand",
  },
  {
    quote: "Make it simple. Make it memorable. Make it inviting to look at.",
    author: "Leo Burnett",
  },
  {
    quote: "Creativity is intelligence having fun.",
    author: "Albert Einstein",
  },
  {
    quote: "Content is fire, social media is gasoline.",
    author: "Jay Baer",
  },
  {
    quote: "Good marketing makes the company look smart. Great marketing makes the customer feel smart.",
    author: "Joe Chernov",
  },
  {
    quote: "People ignore design that ignores people.",
    author: "Frank Chimero",
  },
  {
    quote: "Simplicity is the ultimate sophistication.",
    author: "Leonardo da Vinci",
  },
  {
    quote: "Your visual identity is your promise of quality to every customer.",
    author: "Brand Craft",
  },
];

const GENERATION_STAGES = [
  { label: "Analyzing prompt & brand vibe", icon: Sparkles },
  { label: "Composing studio visual layout", icon: Layers },
  { label: "Synthesizing lighting & color depth", icon: Palette },
  { label: "Rendering channel-ready creative", icon: Wand2 },
];

export interface CreativeImageLoaderProps {
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9" | "auto";
  title?: string;
  subtitle?: string;
  className?: string;
  compact?: boolean;
}

export default function CreativeImageLoader({
  aspectRatio = "4:5",
  title = "Rendering AI Creative...",
  subtitle,
  className,
  compact = false,
}: CreativeImageLoaderProps) {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  // Rotate quotes every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % CREATIVE_QUOTES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Advance generation stage every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % GENERATION_STAGES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const aspectClass =
    aspectRatio === "1:1"
      ? "aspect-square"
      : aspectRatio === "4:5"
        ? "aspect-[4/5]"
        : aspectRatio === "9:16"
          ? "aspect-[9/16]"
          : aspectRatio === "16:9"
            ? "aspect-video"
            : "w-full h-full";

  const currentQuote = CREATIVE_QUOTES[quoteIndex] ?? CREATIVE_QUOTES[0];
  const currentStage = GENERATION_STAGES[stageIndex] ?? GENERATION_STAGES[0];
  const StageIcon = currentStage?.icon ?? Sparkles;

  if (compact) {
    return (
      <div
        className={cn(
          "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-b from-brand/[0.08] via-card to-background p-4 text-center shadow-lg",
          aspectClass,
          className
        )}
      >
        {/* Subtle glowing orb */}
        <div className="absolute -top-10 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-brand/20 blur-2xl" />

        <div className="relative z-10 flex flex-col items-center gap-2.5">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand ring-1 ring-brand/30 shadow-inner">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground">{title}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {subtitle || currentStage?.label}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex w-full flex-col items-center justify-between overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-b from-purple-950/30 via-card/95 to-background p-6 text-center shadow-2xl backdrop-blur-md dark:border-brand/25",
        aspectClass,
        className
      )}
    >
      {/* Background ambient lighting effects */}
      <div className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 rounded-full bg-brand/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />

      {/* Shimmer overlay beam */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-shimmer" />

      {/* Top Header: Badge & Status */}
      <div className="relative z-10 flex w-full items-center justify-between">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[11px] font-medium text-brand">
          <Sparkles className="h-3 w-3 animate-spin text-brand" style={{ animationDuration: "4s" }} />
          <span>MagicBox AI</span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
          </span>
          Generating
        </div>
      </div>

      {/* Center: Animated Visual Core */}
      <div className="relative z-10 my-auto flex flex-col items-center justify-center gap-4 py-2">
        <div className="relative flex h-20 w-20 items-center justify-center">
          {/* Outer pulsing ring */}
          <div className="absolute inset-0 animate-ping rounded-3xl bg-brand/20 opacity-40" style={{ animationDuration: "2.5s" }} />

          {/* Rotating dashed ring */}
          <div className="absolute -inset-2 rounded-3xl border border-dashed border-brand/40 animate-spin" style={{ animationDuration: "12s" }} />

          {/* Inner glass core */}
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/40 bg-gradient-to-tr from-brand/20 via-card to-brand/10 shadow-xl backdrop-blur-sm">
            <motion.div
              key={stageIndex}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <StageIcon className="h-8 w-8 text-brand drop-shadow-[0_0_12px_rgba(139,92,246,0.6)]" />
            </motion.div>
          </div>
        </div>

        <div className="max-w-xs space-y-1.5">
          <h4 className="font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {title}
          </h4>

          {/* Live Stage Transition */}
          <div className="h-5 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={stageIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="text-xs font-medium text-brand"
              >
                {subtitle || currentStage?.label}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Progress Bar Pulse */}
        <div className="w-48 overflow-hidden rounded-full bg-secondary/80 p-0.5 ring-1 ring-border/50">
          <motion.div
            className="h-1.5 rounded-full bg-gradient-to-r from-brand via-purple-400 to-brand"
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.8,
              ease: "easeInOut",
            }}
          />
        </div>
      </div>

      {/* Bottom: Dynamic Rotating Quotes */}
      <div className="relative z-10 w-full border-t border-border/40 bg-secondary/20 -mx-6 -mb-6 p-4 rounded-b-2xl backdrop-blur-sm">
        <div className="min-h-[52px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={quoteIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="space-y-1"
            >
              <p className="text-xs italic leading-relaxed text-foreground/90 line-clamp-2">
                &ldquo;{currentQuote?.quote}&rdquo;
              </p>
              {currentQuote?.author && (
                <p className="text-[10px] font-mono font-medium uppercase tracking-wider text-muted-foreground">
                  — {currentQuote.author}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
