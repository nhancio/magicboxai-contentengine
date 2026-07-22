import type { SocialPlatform } from "@shared/types";
import { cn } from "@shared/lib/utils";
import {
  Facebook,
  Instagram,
  Linkedin,
  Smartphone,
  Twitter,
  Youtube,
} from "lucide-react";
import PlatformPreview, { type PreviewContent } from "./PlatformPreview";

const PLATFORM_META: {
  id: SocialPlatform;
  label: string;
  icon: typeof Instagram;
}[] = [
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "youtube", label: "YouTube", icon: Youtube },
  { id: "facebook", label: "Facebook", icon: Facebook },
  { id: "twitter", label: "X", icon: Twitter },
];

/**
 * Shared right-rail / mobile preview shell used by Posts, Studio, Onboarding, etc.
 */
export default function PreviewModule({
  platform,
  onPlatformChange,
  content,
  allowedPlatforms,
  title = "Preview",
  emptyHint = "Select a post to preview how it will look on each channel.",
  className,
}: {
  platform: SocialPlatform;
  onPlatformChange?: (p: SocialPlatform) => void;
  content: PreviewContent | null;
  allowedPlatforms?: SocialPlatform[];
  title?: string;
  emptyHint?: string;
  className?: string;
}) {
  const tabs = allowedPlatforms?.length
    ? PLATFORM_META.filter((p) => allowedPlatforms.includes(p.id))
    : PLATFORM_META;

  const active = tabs.some((t) => t.id === platform) ? platform : (tabs[0]?.id ?? "linkedin");

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col rounded-2xl border border-border bg-card",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
        </div>
      </div>

      {tabs.length > 1 && onPlatformChange && (
        <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2.5">
          {tabs.map((t) => {
            const activeTab = t.id === active;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onPlatformChange(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  activeTab
                    ? "bg-brand/15 text-brand border border-brand/25"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent",
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-1 justify-center overflow-y-auto p-4">
        {content ? (
          <div className="w-full max-w-[340px]">
            <PlatformPreview platform={active} content={content} />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <Smartphone className="h-8 w-8 text-muted-foreground/40" />
            <p className="max-w-[220px] text-sm text-muted-foreground">{emptyHint}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
