import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { Button } from "@shared/components/ui/button";
import { captureEvent, PRODUCT_EVENTS } from "@shared/lib/analytics";
import { cn } from "@shared/lib/utils";
import { isConvexConfigured } from "../lib/convex";
import { trialClock } from "../lib/credits";
import { useMayaActivation } from "../hooks/useMayaActivation";
import {
  ArrowRight,
  CheckCircle2,
  Check,
  Globe2,
  LockKeyhole,
  Sparkles,
  X,
  Loader2,
  CalendarClock,
  Clock,
  Calendar,
  Link2,
  ChevronLeft,
  ChevronRight,
  Heart,
  Eye,
  VolumeX,
  Volume2,
  Pencil,
  Settings,
  Library
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@shared/components/ui/dialog";

function ActivationGate({ activation }: { activation: any }) {
  const nextPath = activation.hasWebsite ? "/onboarding/channels" : "/onboarding";
  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-10">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(circle at 12% 5%, rgb(var(--brand) / 0.14), transparent 36%), linear-gradient(135deg, transparent 62%, rgb(var(--foreground) / 0.04))",
          }}
        />
        <div className="relative border-b border-border px-6 py-8 sm:px-10 sm:py-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <LockKeyhole className="h-3.5 w-3.5 text-brand" />
            Maya is waiting
          </div>
          <h1 className="max-w-xl font-display text-4xl leading-[1.02] tracking-tight text-foreground sm:text-5xl">
            Give Maya a brand to understand and somewhere to publish.
          </h1>
        </div>

        <div className="relative grid gap-px bg-border sm:grid-cols-2">
          <div className="bg-card p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <Globe2 className="h-5 w-5 text-foreground" />
              </div>
              {activation.hasWebsite ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Complete
                </span>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-widest text-brand">
                  Step 1
                </span>
              )}
            </div>
            <h2 className="mt-6 font-display text-2xl text-foreground">Link your website</h2>
            {!activation.hasWebsite && (
              <Button asChild className="mt-6 w-full">
                <Link to="/onboarding">
                  Add website <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>

          <div className={cn("bg-card p-6 sm:p-8", !activation.hasWebsite && "opacity-55")}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <Link2 className="h-5 w-5 text-foreground" />
              </div>
              {activation.hasChannel ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Complete
                </span>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Step 2
                </span>
              )}
            </div>
            <h2 className="mt-6 font-display text-2xl text-foreground">Connect a social channel</h2>
            {activation.hasWebsite && !activation.hasChannel && (
              <Button asChild className="mt-6 w-full">
                <Link to="/onboarding/channels">
                  Connect a channel <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PaidPlanGate() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="rounded-[1.75rem] border border-brand/25 bg-brand/[0.06] p-8 text-center sm:p-12">
        <Sparkles className="mx-auto h-8 w-8 text-brand" />
        <h1 className="mt-5 font-display text-3xl text-foreground">Maya is ready when you are.</h1>
        <Button asChild className="mt-7 rounded-full px-6">
          <Link to="/pricing?plan=pro">Choose a paid plan</Link>
        </Button>
      </div>
    </div>
  );
}

// Pseudo-random image generator based on ID for the Remixed card
function getSeededImage(id: string) {
  return `https://picsum.photos/seed/${id}/400/700`;
}

// Swipable Card Group (contains both Remixed and Main Card)
function SwipableGroup({
  s,
  pending,
  activePendingIndex,
  onDecide,
  isEditing,
  setIsEditing,
  editedCaption,
  setEditedCaption,
  isMuted,
  setIsMuted,
  onPrev,
  onNext,
  exitDir
}: any) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-5, 5]);
  const shownAt = useRef(Date.now());

  const asset = s.media?.[0];
  const isRendering = !asset && !!s.mediaPlan && s.mediaPlan.type !== "none";
  
  // Remixed from text
  const remixedText = s.angle || s.hook || "When will people realize the real reason launching a site feels stressful isn't because you're bad with tech...";
  const remixedImage = getSeededImage(s._id);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (isEditing) return;
    if (Math.abs(info.offset.x) < 100) return;
    onDecide(s, info.offset.x > 0 ? "right" : "left", Date.now() - shownAt.current, "schedule");
  }

  return (
    <motion.div
      className="absolute top-0 left-0 right-0 mx-auto w-full h-full flex items-center justify-center gap-8 cursor-grab active:cursor-grabbing"
      style={{ x, rotate, zIndex: 10, willChange: "transform" }}
      drag={!isEditing ? "x" : false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.6}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0, y: 15 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ 
        x: exitDir === "right" ? 800 : -800, 
        opacity: 0, 
        rotate: exitDir === "right" ? 12 : -12, 
        transition: { duration: 0.2, ease: "easeOut" } 
      }}
      transition={{ type: "spring", stiffness: 400, damping: 20, mass: 0.8 }}
    >
      {/* Remixed From Card (Left) */}
      <div className="hidden lg:flex w-[200px] flex-col gap-2 opacity-95 shrink-0 pointer-events-none">
        <h3 className="text-[13px] font-semibold tracking-tight text-foreground/80 font-sans ml-1 text-center">Remixed From</h3>
        <div className="aspect-[9/16] w-full rounded-[1.5rem] overflow-hidden relative shadow-[0_15px_30px_rgba(0,0,0,0.08)] bg-secondary border border-black/5">
          <img src={remixedImage} alt="Trend reference" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-3 right-3 text-white">
            <p className="text-[10px] font-medium line-clamp-4 mb-2 leading-snug text-white/95">
              {remixedText}
            </p>
            <div className="flex items-center gap-3 text-[9px] font-semibold text-white/80">
              <div className="flex flex-col items-center"><Heart className="w-3.5 h-3.5 mb-0.5"/>299K</div>
              <div className="flex flex-col items-center"><Eye className="w-3.5 h-3.5 mb-0.5"/>3.3M</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Preview Card (Center) */}
      <div className="relative flex flex-col items-center shrink-0 w-[260px] pointer-events-auto">
        {/* Main Card */}
        <div className="relative w-full aspect-[9/16] rounded-[1.5rem] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.25)] overflow-hidden bg-black border border-white/10 z-10">
          {asset?.type === "video" ? (
            <video src={asset.url} autoPlay loop muted={isMuted} playsInline className="absolute inset-0 w-full h-full object-cover" />
          ) : asset?.type === "image" ? (
            <img src={asset.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-[#E2D4F0] to-[#E9DFCA] flex items-center justify-center">
              {isRendering ? <Loader2 className="w-8 h-8 animate-spin text-brand" /> : <Sparkles className="w-8 h-8 text-black/20" />}
            </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

          {/* Top Left Mute Button */}
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
            className="absolute top-3 left-3 h-7 w-7 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center z-20 pointer-events-auto border border-white/10 text-white hover:bg-black/60 transition-colors"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Caption Editing Overlay / Display */}
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 px-4 z-20 text-center flex flex-col items-center justify-center pointer-events-auto">
            {isEditing ? (
              <div className="w-full bg-black/70 backdrop-blur-md p-3 rounded-xl border border-white/20">
                <textarea 
                  value={editedCaption}
                  onChange={(e) => setEditedCaption(e.target.value)}
                  className="w-full h-28 bg-transparent text-white text-xs focus:outline-none resize-none text-center"
                  autoFocus
                />
                <div className="flex justify-between mt-2">
                  <button onClick={() => setIsEditing(false)} className="text-white/70 text-[10px] px-2 py-1 hover:text-white">Cancel</button>
                  <button onClick={() => setIsEditing(false)} className="bg-white text-black text-[10px] font-semibold px-3 py-1 rounded hover:bg-gray-200">Save</button>
                </div>
              </div>
            ) : (
              <p 
                onPointerDown={(e) => e.stopPropagation()} // Prevent drag when selecting text
                className="text-white font-semibold text-[12px] drop-shadow-md leading-snug line-clamp-8 whitespace-pre-wrap cursor-text"
              >
                {editedCaption}
              </p>
            )}
          </div>
          
          {/* Left / Right Nav Arrows inside card */}
          {!isEditing && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); onPrev(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition border border-white/20 z-20 pointer-events-auto"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onNext(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition border border-white/20 z-20 pointer-events-auto"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Pagination Dots */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
            {pending.map((_: any, i: number) => (
              <div 
                key={i} 
                className={cn("h-1 rounded-full transition-all duration-300", i === activePendingIndex ? "w-3 bg-white" : "w-1 bg-white/40")}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}


export default function Maya() {
  const [generating, setGenerating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCaption, setEditedCaption] = useState("");
  const [isMuted, setIsMuted] = useState(true); // Default muted for autoplay policies
  
  const activation = useMayaActivation();
  const trackedActivationState = useRef<string | null>(null);
  const [exitDir, setExitDir] = useState<"left" | "right">("right");

  const deck = useQuery(api.maya.deck, isConvexConfigured ? {} : "skip");
  const credits = useQuery(api.credits.balance, isConvexConfigured ? {} : "skip");
  const ensureConfig = useMutation(api.maya.ensureConfig);
  const swipe = useMutation(api.maya.swipe);
  const generateNow = useAction(api.maya.generateNow);
  const tClock = trialClock(credits as any);

  useEffect(() => {
    if (activation === undefined) return;
    const state = activation.ready
      ? "ready"
      : `blocked:${activation.hasWebsite}:${activation.hasChannel}`;
    if (trackedActivationState.current === state) return;
    trackedActivationState.current = state;
  }, [activation]);

  useEffect(() => {
    if (!isConvexConfigured || !activation?.ready) return;
    ensureConfig({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).catch((e) => console.warn("[maya] ensureConfig failed", e));
  }, [activation?.ready, ensureConfig]);

  const pending = useMemo(() => (deck?.pending ?? []) as any[], [deck]);
  const activePendingIndex = pending.length ? ((activeIndex % pending.length) + pending.length) % pending.length : 0;
  const topSuggestion = pending[activePendingIndex];

  useEffect(() => {
    setEditedCaption(topSuggestion?.caption || "");
    setIsEditing(false);
  }, [topSuggestion?._id, topSuggestion?.caption]);

  async function decide(
    s: any,
    decision: "right" | "left",
    dwellMs: number = 0,
    publishMode: "now" | "schedule" = "schedule",
  ) {
    setExitDir(decision);
    try {
      const args: any = {
        suggestionId: s._id as any,
        decision,
        dwellMs,
      };
      if (decision === "right") args.publishMode = publishMode;
      const r: any = await swipe(args);
      
      setApprovalModalOpen(false);
      setIsEditing(false);
      
      if (decision === "left") {
        toast("Skipped — Maya will show less like this.");
        return;
      }
      
      if (r?.needsChannel) {
        toast.warning("Saved as a draft — connect a channel to publish.", {
          action: { label: "Connect", onClick: () => (window.location.href = "/settings") },
        });
      } else if (r?.renderingVideo) {
        toast.success(
          publishMode === "now"
            ? "Rendering video — it'll post as soon as it's ready."
            : `Rendering your video — it'll publish ${r.scheduledAt ? new Date(r.scheduledAt).toLocaleTimeString() : "at the next slot"} once ready.`,
        );
      } else if (publishMode === "now") {
        toast.success("Posting now — check Posts in a moment.");
      } else if (r?.scheduledAt) {
        toast.success(`Queued for next best time · ${new Date(r.scheduledAt).toLocaleTimeString()}`);
      } else {
        toast.success("Queued for next best time.");
      }
    } catch (e) {
      const message = String(e);
      if (/TrialExpired|free trial has ended|trial.*expired/i.test(message)) {
        toast.error("Your free trial has ended. Upgrade to post from Maya.", {
          action: { label: "View plans", onClick: () => (window.location.href = "/pricing?plan=pro") },
        });
      } else {
        toast.error(`Couldn't save that swipe: ${message.slice(0, 90)}`);
      }
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      await ensureConfig({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const r: any = await generateNow({ force: true });
      if (r.created > 0) toast.success(`Maya wrote ${r.created} new posts.`);
      else toast(`Nothing new to add (${r.reason ?? "no changes"}).`);
    } catch (e) {
      toast.error(`Generation failed: ${String(e).slice(0, 110)}`);
    } finally {
      setGenerating(false);
    }
  }

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => prev + 1);
  }, []);

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => prev - 1);
  }, []);

  const handleSkip = useCallback(() => {
    if (topSuggestion) decide(topSuggestion, "left");
  }, [topSuggestion]);

  const handleApprove = useCallback(() => {
    if (topSuggestion) setApprovalModalOpen(true);
  }, [topSuggestion]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") setApprovalModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev, topSuggestion]);

  if (!isConvexConfigured) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Maya needs <code className="font-mono">VITE_CONVEX_URL</code> configured.
        </p>
      </div>
    );
  }

  if (activation === undefined || credits === undefined) {
    return (
      <div className="flex min-h-[100vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activation.ready) {
    return <ActivationGate activation={activation} />;
  }

  if (!credits.hasPaidPlan && tClock?.expired) {
    return <PaidPlanGate />;
  }

  return (
    <div className="flex flex-col h-[100vh] w-full overflow-hidden bg-[#FAFAFA] dark:bg-background relative">
      
      {/* Top Bar - Cleaned up per request (removed Trial Pill and Configure button) */}
      <div className="flex justify-end p-4 z-20 shrink-0">
        <div className="flex items-center gap-3">
          {!credits.hasPaidPlan && (
            <Button asChild variant="outline" size="sm" className="rounded-full bg-[#FFF0E6] text-[#E06611] border-none hover:bg-[#FFE4D6] shadow-sm">
              <Link to="/pricing?plan=pro">Upgrade</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area - Reduced sizes and fixed height to prevent scrolling */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6 relative z-10 w-full overflow-hidden">
        {deck === undefined ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[2rem] bg-white border border-border/50 text-center p-10 shadow-[0_15px_40px_rgba(0,0,0,0.05)] max-w-sm w-full relative">
            <Sparkles className="mb-4 h-8 w-8 text-brand" />
            <h2 className="font-display text-xl text-foreground">Deck cleared</h2>
            <p className="text-muted-foreground mt-2 text-xs">You've reviewed all suggestions for today.</p>
            <Button onClick={handleGenerate} disabled={generating} className="mt-6 rounded-full px-5 text-sm shadow-md bg-brand hover:bg-brand/90 text-white">
              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {generating ? "Writing..." : "Generate today's deck"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full max-w-3xl relative h-[70vh] max-h-[600px]">
            
            {/* The Cards Area */}
            <div className="relative w-full h-[85%] mb-4">
              <AnimatePresence mode="popLayout">
                {topSuggestion && (
                  <SwipableGroup
                    key={topSuggestion._id}
                    s={topSuggestion}
                    pending={pending}
                    activePendingIndex={activePendingIndex}
                    onDecide={decide}
                    isEditing={isEditing}
                    setIsEditing={setIsEditing}
                    editedCaption={editedCaption}
                    setEditedCaption={setEditedCaption}
                    isMuted={isMuted}
                    setIsMuted={setIsMuted}
                    onPrev={handlePrev}
                    onNext={handleNext}
                    exitDir={exitDir}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Action Buttons Row */}
            <div className="flex flex-col items-center mt-2 z-20 w-full max-w-[280px]">
              <div className="flex items-center justify-between w-full px-2">
                {/* Reject Button */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={handleSkip}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_5px_15px_rgba(0,0,0,0.06)] border border-gray-100 hover:scale-110 transition-transform text-[#FF4B4B]"
                  >
                    <X className="h-5 w-5" strokeWidth={2.5} />
                  </button>

                </div>
                
                {/* Edit Button */}
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex h-9 px-4 items-center justify-center rounded-full bg-white shadow-[0_5px_15px_rgba(0,0,0,0.06)] border border-gray-100 hover:scale-105 transition-transform text-gray-700 text-xs font-medium gap-1.5"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                
                {/* Approve Button */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={handleApprove}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_5px_15px_rgba(0,0,0,0.06)] border border-gray-100 hover:scale-110 transition-transform text-[#27CE65]"
                  >
                    <Check className="h-6 w-6" strokeWidth={2.5} />
                  </button>

                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Approval Modal */}
      <Dialog open={approvalModalOpen} onOpenChange={setApprovalModalOpen}>
        <DialogContent className="max-w-md rounded-[1.5rem] p-0 border-none bg-white overflow-hidden shadow-2xl">
          <div className="px-6 pt-5 pb-3">
            <p className="text-[11px] font-bold tracking-widest text-[#8B5CF6] uppercase mb-3">Step 1 of 3</p>
            <div className="w-full bg-gray-100 h-1.5 rounded-full mb-6 overflow-hidden">
               <div className="bg-[#8B5CF6] h-full w-1/3 rounded-full"></div>
            </div>
            <DialogHeader className="mb-2">
              <DialogTitle className="text-2xl font-display text-gray-900 text-left">What would you like to do?</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-4 pb-4">
            <button 
              onClick={() => decide(topSuggestion, "right", 0, "schedule")}
              className="w-full text-left p-4 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100 flex gap-4 items-start group"
            >
              <div className="bg-[#F3E8FF] text-[#8B5CF6] p-3 rounded-full mt-1 group-hover:scale-110 transition-transform">
                <Library className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 text-[14px]">Save to Library</h4>
                <p className="text-gray-500 text-xs mt-1">Save this content for later</p>
              </div>
            </button>
            <div className="h-px w-full bg-gray-100 my-1"></div>
            <button 
              onClick={() => decide(topSuggestion, "right", 0, "now")}
              className="w-full text-left p-4 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100 flex gap-4 items-start group"
            >
              <div className="bg-[#E0F2FE] text-[#0284C7] p-3 rounded-full mt-1 group-hover:scale-110 transition-transform">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 text-[14px]">Schedule Post</h4>
                <p className="text-gray-500 text-xs mt-1">Post or schedule to your platforms</p>
              </div>
            </button>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-center">
            <button onClick={() => setApprovalModalOpen(false)} className="text-gray-500 hover:text-gray-900 text-sm font-medium">
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
