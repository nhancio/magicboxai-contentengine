import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@shared/lib/auth";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Textarea } from "@shared/components/ui/textarea";
import { Card, CardContent } from "@shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@shared/components/ui/dialog";
import { cn } from "@shared/lib/utils";
import {
  Route,
  Sparkles,
  ArrowUp,
  Plus,
  Bot,
  Video,
  Share2,
  CheckCircle2,
  Clock,
  Zap,
  MessageSquare,
  FileText,
  Check,
  Flame,
  Layers,
  ShoppingBag,
} from "lucide-react";

export type FeatureStatus = "in_progress" | "planned" | "shipped";

export interface RoadmapFeature {
  id: string;
  title: string;
  description: string;
  status: FeatureStatus;
  icon: typeof Zap;
  category: string;
}

const ROADMAP_FEATURES: RoadmapFeature[] = [
  {
    id: "tiktok-publishing",
    title: "TikTok Direct Publishing",
    description: "Auto-publish scheduled TikTok videos, photo carousels, and sound pairing directly from MagicBox.",
    status: "in_progress",
    icon: Video,
    category: "Channels",
  },
  {
    id: "voice-cloning",
    title: "AI Voice Cloning",
    description: "Clone your speaking voice in seconds to generate authentic founder UGC video ads without recording.",
    status: "in_progress",
    icon: Sparkles,
    category: "AI Video",
  },
  {
    id: "x-threads",
    title: "X (Twitter) Threads & Scheduling",
    description: "Convert brand insights into high-engagement X threads with automatic scheduling.",
    status: "planned",
    icon: Share2,
    category: "Channels",
  },
  {
    id: "shopify-sync",
    title: "Shopify Product Ad Generator",
    description: "Sync your store catalog to automatically generate high-converting video and carousel ads for new products.",
    status: "planned",
    icon: ShoppingBag,
    category: "Studio",
  },
  {
    id: "competitor-radar",
    title: "Competitor Ad Breakdown",
    description: "Analyze competitor hooks and ad angles to generate unique counter-creatives for your brand.",
    status: "planned",
    icon: Bot,
    category: "Maya Agent",
  },
  {
    id: "multi-channel-oauth",
    title: "Instagram, LinkedIn & YouTube Publishing",
    description: "Direct verified OAuth integrations for auto-publishing feed posts, reels, shorts, and articles.",
    status: "shipped",
    icon: CheckCircle2,
    category: "Channels",
  },
  {
    id: "maya-agent",
    title: "Maya 1.0 Autonomous Agent",
    description: "Scans your website to extract brand voice, colors, and logo, then generates 7-day social campaigns.",
    status: "shipped",
    icon: Bot,
    category: "Maya Agent",
  },
  {
    id: "carousel-studio",
    title: "Branded Carousel Studio",
    description: "Generate multi-slide branded carousels with custom typography, colors, and high-res PNG export.",
    status: "shipped",
    icon: Layers,
    category: "Studio",
  },
];

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "in_progress", label: "In Progress", dot: "bg-brand animate-pulse" },
  { id: "planned", label: "Planned", dot: "bg-amber-400" },
  { id: "shipped", label: "Shipped", dot: "bg-emerald-400" },
] as const;

const QUICK_POLL_OPTIONS = [
  { id: "tiktok", label: "TikTok Direct Video Publishing", icon: Video },
  { id: "voice", label: "Voice Cloning for UGC Ads", icon: Sparkles },
  { id: "shopify", label: "Shopify / E-commerce Sync", icon: ShoppingBag },
  { id: "x", label: "X (Twitter) Thread Scheduler", icon: Share2 },
];

export default function Roadmap() {
  const { user } = useAuth();

  const [votes, setVotes] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("magicbox_roadmap_votes");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [pollVote, setPollVote] = useState<string | null>(() => {
    return localStorage.getItem("magicbox_roadmap_poll_choice") || null;
  });

  const [activeTab, setActiveTab] = useState<"all" | FeatureStatus>("all");

  // Suggest Modal
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [customFeatures, setCustomFeatures] = useState<RoadmapFeature[]>(() => {
    try {
      const saved = localStorage.getItem("magicbox_custom_features");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    localStorage.setItem("magicbox_roadmap_votes", JSON.stringify(votes));
  }, [votes]);

  useEffect(() => {
    if (pollVote) {
      localStorage.setItem("magicbox_roadmap_poll_choice", pollVote);
    }
  }, [pollVote]);

  useEffect(() => {
    localStorage.setItem("magicbox_custom_features", JSON.stringify(customFeatures));
  }, [customFeatures]);

  const toggleVote = (id: string) => {
    const hasVoted = !!votes[id];
    setVotes((prev) => ({ ...prev, [id]: !hasVoted }));
    if (!hasVoted) {
      toast.success("Vote recorded! We've prioritized this for upcoming sprints.");
    }
  };

  const handlePollSelect = (id: string) => {
    setPollVote(id);
    toast.success("Thank you for your feedback!");
  };

  const handleSuggest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      const newFeature: RoadmapFeature = {
        id: `custom-${Date.now()}`,
        title: title.trim(),
        description: description.trim(),
        status: "planned",
        icon: Sparkles,
        category: "Community",
      };

      setCustomFeatures((prev) => [newFeature, ...prev]);
      setVotes((prev) => ({ ...prev, [newFeature.id]: true }));

      // Optional webhook forwarding
      const webhookUrl = import.meta.env.VITE_FEEDBACK_WEBHOOK_URL;
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              type: "roadmap_feature_suggestion",
              title,
              description,
              userEmail: user?.email ?? "anonymous",
              userName: user?.displayName ?? "Anonymous",
              timestamp: new Date().toISOString(),
            }),
            mode: "no-cors",
          });
        } catch {
          // Ignore network errors on optional webhook
        }
      }

      toast.success("Feature requested! We've added it to the roadmap.");
      setTitle("");
      setDescription("");
      setIsSuggestOpen(false);
    } catch {
      toast.error("Failed to submit request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const allItems = useMemo(() => {
    return [...customFeatures, ...ROADMAP_FEATURES];
  }, [customFeatures]);

  const filteredFeatures = useMemo(() => {
    if (activeTab === "all") return allItems;
    return allItems.filter((item) => item.status === activeTab);
  }, [allItems, activeTab]);

  return (
    <div className="w-full animate-fade-in py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-8">
        {/* Header - Minimal Onboarding Aesthetic */}
        <div className="text-center sm:text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-medium text-brand mb-2">
              <Route className="h-3.5 w-3.5" />
              Product Roadmap
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              What we're building
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-xl">
              Vote on upcoming features to speed up development or tell us what you need next.
            </p>
          </div>

          <div className="flex items-center justify-center sm:justify-end gap-2 shrink-0">
            <Dialog open={isSuggestOpen} onOpenChange={setIsSuggestOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90 text-xs gap-1.5 shadow-sm">
                  <Plus className="h-3.5 w-3.5" />
                  Suggest Feature
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md glass-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-lg font-display">Suggest a feature</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Tell us what capability or integration would save your brand the most time.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSuggest} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Feature Name</label>
                    <Input
                      placeholder="e.g., Pinterest Auto-Publisher, Caption AI in Spanish..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">How will you use this?</label>
                    <Textarea
                      rows={3}
                      placeholder="Briefly describe what problem this solves..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                    />
                  </div>

                  <DialogFooter className="pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsSuggestOpen(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      className="bg-brand text-brand-foreground hover:bg-brand/90"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Submitting..." : "Submit Request"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Button asChild variant="outline" size="sm" className="text-xs gap-1.5">
              <Link to="/changelog">
                <FileText className="h-3.5 w-3.5" />
                Changelog
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="text-xs gap-1.5">
              <Link to="/feedback">
                <MessageSquare className="h-3.5 w-3.5" />
                Feedback
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick Customer Question Card */}
        <Card className="glass-card border border-border overflow-hidden">
          <CardContent className="p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-brand font-medium uppercase tracking-wider">
                Quick Question
              </span>
              {pollVote && (
                <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                  <Check className="h-3 w-3" /> Vote saved
                </span>
              )}
            </div>

            <h3 className="font-display text-base font-semibold text-foreground">
              Which feature would you use most this month?
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {QUICK_POLL_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = pollVote === opt.id;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handlePollSelect(opt.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 text-left transition-all cursor-pointer",
                      isSelected
                        ? "border-brand/40 bg-brand/10 text-foreground ring-1 ring-brand/30"
                        : "border-border bg-card hover:border-brand/30 hover:bg-secondary/40 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
                        isSelected ? "bg-brand text-brand-foreground" : "bg-secondary text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium leading-tight text-foreground">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto no-scrollbar">
          {STATUS_TABS.map((tab) => {
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer",
                  isCurrent
                    ? "bg-brand/10 text-brand ring-1 ring-brand/30"
                    : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {"dot" in tab && <span className={cn("h-1.5 w-1.5 rounded-full", tab.dot)} />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Features List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredFeatures.map((item) => {
              const isVoted = !!votes[item.id];
              const Icon = item.icon;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition-all hover:border-brand/30"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-foreground">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {item.category}
                        </span>
                      </div>

                      {item.status === "in_progress" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand border border-brand/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                          In Progress
                        </span>
                      )}
                      {item.status === "planned" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500 border border-amber-500/20">
                          Planned
                        </span>
                      )}
                      {item.status === "shipped" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500 border border-emerald-500/20">
                          <Check className="h-3 w-3" />
                          Shipped
                        </span>
                      )}
                    </div>

                    <h3 className="font-display text-sm font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {item.status !== "shipped" && (
                    <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        {isVoted ? "You voted for this" : "Want this feature?"}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant={isVoted ? "default" : "outline"}
                        onClick={() => toggleVote(item.id)}
                        className={cn(
                          "h-7 px-3 text-xs gap-1.5",
                          isVoted
                            ? "bg-brand text-brand-foreground hover:bg-brand/90"
                            : "hover:border-brand/40 hover:text-brand",
                        )}
                      >
                        <ArrowUp className={cn("h-3 w-3", isVoted && "stroke-[3]")} />
                        {isVoted ? "Voted" : "Vote"}
                      </Button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
