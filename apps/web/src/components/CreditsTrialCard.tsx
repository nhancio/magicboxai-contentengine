import { Link } from "react-router-dom";
import { Clock, Sparkles } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { trialClock, trialStatusCopy, type CreditBalanceLike } from "@/lib/credits";

type Credits = CreditBalanceLike & {
  iCredits?: number;
  vCredits?: number;
  needsTrialClaim?: boolean;
};

type Props = {
  credits: Credits | undefined | null;
  /** denser chip for mobile header */
  compact?: boolean;
  className?: string;
  onNavigate?: () => void;
};

export function CreditsTrialCard({ credits, compact, className, onNavigate }: Props) {
  const clock = trialClock(credits);
  const loading = credits === undefined;
  const i = loading || credits?.needsTrialClaim ? "…" : (credits?.iCredits ?? "—");
  const v = loading || credits?.needsTrialClaim ? "…" : (credits?.vCredits ?? "—");
  const showTrial = !!clock && !credits?.hasPaidPlan;
  const expired = !!clock?.expired;

  if (compact) {
    return (
      <Link
        to={expired ? "/pricing" : "/settings"}
        onClick={onNavigate}
        className={cn(
          "inline-flex max-w-[11rem] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] tabular-nums transition-colors",
          expired
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : "border-border bg-secondary/80 text-foreground hover:border-brand/30",
          className,
        )}
        title="Credits & trial"
      >
        <Sparkles className="h-3 w-3 shrink-0 text-brand" />
        <span>
          <span className="font-medium text-brand">{i}</span>
          <span className="text-muted-foreground">i</span>
          <span className="mx-0.5 text-border">·</span>
          <span className="font-medium text-brand">{v}</span>
          <span className="text-muted-foreground">v</span>
        </span>
        {showTrial && (
          <span
            className={cn(
              "truncate font-mono text-[9px] uppercase tracking-wide",
              expired ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {expired ? "ended" : `${clock.daysLeft}d`}
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link
      to={expired ? "/pricing" : "/settings"}
      onClick={onNavigate}
      className={cn(
        "block rounded-xl border p-3 transition-colors",
        expired
          ? "border-destructive/30 bg-destructive/5 hover:border-destructive/45"
          : "border-border bg-secondary/50 hover:border-brand/35 hover:bg-secondary",
        className,
      )}
      title="View credits, trial & pricing"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-brand" />
          Credits
        </span>
        {credits?.hasPaidPlan ? (
          <span className="rounded-full bg-brand/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-brand">
            Plan
          </span>
        ) : showTrial ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
              expired
                ? "bg-destructive/10 text-destructive"
                : clock.daysLeft <= 2
                  ? "bg-amber-500/15 text-amber-800"
                  : "bg-brand/10 text-brand",
            )}
          >
            <Clock className="h-3 w-3" />
            {expired ? "Ended" : `${clock.daysLeft}d left`}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-baseline gap-3 tabular-nums">
        <p className="text-sm text-foreground">
          <span className="font-display text-xl text-brand">{i}</span>
          <span className="ml-1 text-[11px] text-muted-foreground">i</span>
        </p>
        <span className="text-border">·</span>
        <p className="text-sm text-foreground">
          <span className="font-display text-xl text-brand">{v}</span>
          <span className="ml-1 text-[11px] text-muted-foreground">v</span>
        </p>
      </div>

      {showTrial && (
        <div className="mt-2.5 space-y-1.5">
          {!expired && (
            <div className="h-1 overflow-hidden rounded-full bg-background/80">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  clock.daysLeft <= 2 ? "bg-amber-500" : "bg-brand",
                )}
                style={{ width: `${Math.max(6, clock.progress * 100)}%` }}
              />
            </div>
          )}
          <p
            className={cn(
              "text-[10px] leading-snug",
              expired ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {expired
              ? "Trial ended — upgrade to keep creating"
              : `${trialStatusCopy(clock)}${clock.endsOnLabel ? ` · ends ${clock.endsOnLabel}` : ""}`}
          </p>
        </div>
      )}

      {!showTrial && !credits?.hasPaidPlan && !loading && (
        <p className="mt-2 text-[10px] text-muted-foreground">Tap for plan & trial details</p>
      )}
    </Link>
  );
}
