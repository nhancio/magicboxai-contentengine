import { Link } from "react-router-dom";
import { Card, CardContent } from "@shared/components/ui/card";
import { Button } from "@shared/components/ui/button";
import {
  Sparkles,
  Bot,
  Layers,
  Film,
  Calendar,
  Share2,
  Zap,
  ShieldCheck,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
} from "lucide-react";

const HIGHLIGHTS_1_0 = [
  {
    icon: Bot,
    title: "Maya 1.0 Autonomous Agent",
    color: "text-purple-500 bg-purple-500/10",
    description:
      "Deep website scraping extracts your core brand identity and value props. Maya generates high-converting hooks and captions continuously.",
  },
  {
    icon: Sparkles,
    title: "Swipe Approval Workflow",
    color: "text-amber-500 bg-amber-500/10",
    description:
      "Review generated posts at lightning speed. Swipe right to approve, swipe left to discard, or tap to customize hooks and media before queuing.",
  },
  {
    icon: Share2,
    title: "Multi-Channel Direct Publishing",
    color: "text-blue-500 bg-blue-500/10",
    description:
      "Direct verified OAuth integrations for Instagram (Feed & Reels), LinkedIn (Posts & Articles), YouTube (Shorts & Videos), and Facebook Pages.",
  },
  {
    icon: Layers,
    title: "Creative Studio & Carousels",
    color: "text-emerald-500 bg-emerald-500/10",
    description:
      "Build multi-slide branded carousels, generate hyper-realistic visuals with Google Imagen 3, and convert posts into founder UGC style with Gemini.",
  },
  {
    icon: Film,
    title: "AI Video & UGC Engine",
    color: "text-rose-500 bg-rose-500/10",
    description:
      "Google Veo video generation merged with Remotion dynamic compositing to produce polished short-form video ads and social reels.",
  },
  {
    icon: Calendar,
    title: "Visual Calendar & Automations",
    color: "text-indigo-500 bg-indigo-500/10",
    description:
      "Drag-and-drop interactive calendar scheduling, queue management, and automated posting cadences configured by platform.",
  },
  {
    icon: Zap,
    title: "Convex Real-Time Backend",
    color: "text-orange-500 bg-orange-500/10",
    description:
      "Reactive architecture across all devices. Real-time post state synchronization, zero cache lag, and isolated tenant storage.",
  },
  {
    icon: ShieldCheck,
    title: "Unified Credits & Enterprise Security",
    color: "text-cyan-500 bg-cyan-500/10",
    description:
      "Transparent i-credits and v-credits ledger, 7-day free trial on signup, secure server-side token encryption, and Stripe billing.",
  },
];

export default function Changelog() {
  return (
    <div className="w-full animate-fade-in py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-display text-3xl font-bold text-foreground">Changelog</h1>
              <span className="rounded-full bg-brand/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-brand border border-brand/20">
                v1.0.0
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              New features, improvements, and updates shipped to MagicBox
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://magicboxai.in/changelog"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
            >
              <span>Public Changelog</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link to="/feedback">
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                Give Feedback
              </Link>
            </Button>
          </div>
        </div>

        {/* Release Card */}
        <div className="space-y-6">
          <Card className="glass-card shadow-sm border border-border overflow-hidden">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5 mb-6">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-sm font-bold text-brand bg-brand/10 border border-brand/20 px-3 py-1 rounded-full">
                    v1.0.0
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    General Availability
                  </span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">August 21, 2026</span>
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-bold font-display text-foreground mb-2">
                  MagicBox 1.0 — Autonomous Marketing &amp; UGC Distribution Engine
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We are excited to launch MagicBox 1.0! This major release unifies autonomous AI
                  marketing, swipe-based approval, multi-channel direct publishing, and high-converting
                  creative generation into a cohesive workspace.
                </p>
              </div>

              {/* Highlight Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {HIGHLIGHTS_1_0.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="rounded-xl border border-border/80 bg-secondary/30 p-4 transition-colors hover:bg-secondary/60"
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.color}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground mb-1">
                            {item.title}
                          </h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detailed Breakdown */}
              <div className="border-t border-border pt-6 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                  Full Release Checklist
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-foreground/90">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Maya brand crawler &amp; auto-campaign generation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Instagram Posts, Carousels &amp; Reels publishing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>LinkedIn Company Page &amp; Profile distribution</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>YouTube Shorts &amp; Videos direct upload</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Facebook Page automated publishing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Multi-slide Carousel Creator with export tools</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Google Imagen 3 &amp; Veo AI Media pipeline</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>7-Day Free Trial (50 i-credits, 100 v-credits)</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
