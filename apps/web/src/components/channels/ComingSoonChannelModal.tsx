import React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@shared/components/ui/dialog";
import { Button } from "@shared/components/ui/button";
import {
  Twitter,
  Video,
  MessageCircle,
  Check,
  Bell,
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
  Flame,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export interface ComingSoonChannelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: string | null;
  onConnectActivePlatform?: (platform: "instagram" | "linkedin" | "youtube" | "facebook") => void;
}

interface PlatformDetails {
  title: string;
  category: string;
  icon: any;
  statusBadge: string;
  description: string;
  features: string[];
}

const PLATFORM_DETAILS: Record<string, PlatformDetails> = {
  tiktok: {
    title: "TikTok Publishing",
    category: "Short-form Video & Reels",
    icon: Video,
    statusBadge: "Verification in progress",
    description:
      "Direct video publishing and Reel scheduling is in verification with ByteDance. You will soon be able to auto-publish videos, trending audio tags, and hooks directly from MagicBox.",
    features: [
      "1-Click TikTok video & short posting",
      "AI viral captions & trending hashtags",
      "Automated video thumbnail generation",
    ],
  },
  x: {
    title: "X (Twitter) Publishing",
    category: "Real-time & Thread Scheduler",
    icon: Twitter,
    statusBadge: "In active development",
    description:
      "Direct posting and thread scheduling for X (Twitter) is currently in active development. You will soon be able to write, schedule, and automate full threads with media.",
    features: [
      "Multi-tweet thread builder & auto-split",
      "AI hook generation & tweet expander",
      "Media attachments & scheduled drops",
    ],
  },
  twitter: {
    title: "X (Twitter) Publishing",
    category: "Real-time & Thread Scheduler",
    icon: Twitter,
    statusBadge: "In active development",
    description:
      "Direct posting and thread scheduling for X (Twitter) is currently in active development. You will soon be able to write, schedule, and automate full threads with media.",
    features: [
      "Multi-tweet thread builder & auto-split",
      "AI hook generation & tweet expander",
      "Media attachments & scheduled drops",
    ],
  },
  whatsapp: {
    title: "WhatsApp Business",
    category: "Broadcasts & Interactive Messaging",
    icon: MessageCircle,
    statusBadge: "Meta API integration",
    description:
      "WhatsApp 1-to-1 customer broadcasts, interactive CTA buttons, and automated flow templates are arriving soon with our Meta Cloud API integration.",
    features: [
      "Broadcast campaigns to opted-in audiences",
      "Interactive Quick-Reply & CTA buttons",
      "Automated customer service window replies",
    ],
  },
  warmed_up: {
    title: "Warmed Up Accounts",
    category: "Aged & Verified Channels",
    icon: Flame,
    statusBadge: "Marketplace coming soon",
    description:
      "Purchase pre-warmed aged accounts with established platform trust and clean reputations to accelerate your brand without cold-start restrictions.",
    features: [
      "Verified aged profiles with high trust scores",
      "Instant 1-click dashboard handoff",
      "Replacement guarantee & verified history",
    ],
  },
};

const ACTIVE_CHANNELS = [
  { id: "instagram" as const, label: "Instagram", icon: Instagram },
  { id: "linkedin" as const, label: "LinkedIn", icon: Linkedin },
  { id: "youtube" as const, label: "YouTube", icon: Youtube },
  { id: "facebook" as const, label: "Facebook", icon: Facebook },
];

export function ComingSoonChannelModal({
  open,
  onOpenChange,
  platform,
  onConnectActivePlatform,
}: ComingSoonChannelModalProps) {
  if (!platform) return null;

  const key = platform.toLowerCase();
  const info = PLATFORM_DETAILS[key] ?? {
    title: `${platform} Integration`,
    category: "Social Publishing",
    icon: Sparkles,
    statusBadge: "Coming soon",
    description: `${platform} publishing and automation is currently in active development.`,
    features: [
      "Automated content scheduling",
      "AI caption & visual generation",
      "Performance & engagement analytics",
    ],
  };

  const Icon = info.icon;

  const handleNotifyMe = () => {
    toast.success(`You're on the priority list! We'll notify you as soon as ${info.title} is ready.`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] p-6 rounded-2xl border border-border/80 bg-card text-foreground shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3.5 pr-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/80 text-foreground">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                {info.title}
              </DialogTitle>
              <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-mono font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Soon
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
              {info.category} · <span className="text-foreground/70">{info.statusBadge}</span>
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {info.description}
        </p>

        {/* Key Planned Features */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
            Planned Capabilities
          </p>
          <div className="space-y-1.5">
            {info.features.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-foreground/90">
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-2.5 w-2.5 stroke-[2.5]" />
                </div>
                <span className="truncate">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Alternatives */}
        {onConnectActivePlatform && (
          <div className="space-y-2 pt-1 border-t border-border/50">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground font-medium">Active channels ready to connect:</span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {ACTIVE_CHANNELS.map((ch) => {
                const ChIcon = ch.icon;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onConnectActivePlatform(ch.id);
                    }}
                    className="flex items-center justify-center gap-1 rounded-lg border border-border/80 bg-background/80 hover:bg-secondary hover:border-brand/40 py-1.5 px-1 text-[11px] font-medium text-foreground transition-all hover:scale-[1.02] active:scale-[0.98]"
                    title={`Connect ${ch.label}`}
                  >
                    <ChIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{ch.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleNotifyMe}
            className="text-xs gap-1.5"
          >
            <Bell className="h-3.5 w-3.5" />
            Notify Me
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
