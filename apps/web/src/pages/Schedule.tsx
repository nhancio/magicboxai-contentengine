import { useEffect, useMemo, useState } from "react";
import { getSocialPostUrl } from "../lib/socialUrl";
import { useQuery } from "convex/react";
import { useAuth } from "@shared/lib/auth";
import type { Post, PostStatus, SocialPlatform } from "@shared/types";
import { getPostsInRange } from "@shared/lib/automations";
import { Button } from "@shared/components/ui/button";
import { LottiePlayer } from "@shared/components/ui/lottie";
import { cn } from "@shared/lib/utils";
import { api } from "@convex/_generated/api";
import { isConvexConfigured } from "../lib/convex";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Instagram,
  Linkedin,
  Plus,
  Twitter,
  Youtube,
} from "lucide-react";

const PLATFORM_ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Facebook,
};

const STATUS_DOT: Record<PostStatus, string> = {
  draft: "bg-muted-foreground/40",
  pending_approval: "bg-amber-500",
  scheduled: "bg-sky-500",
  generating: "bg-brand",
  ready: "bg-brand/60",
  posting: "bg-brand",
  posted: "bg-emerald-500",
  failed: "bg-rose-500",
  cancelled: "bg-muted-foreground/30",
};

const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "Draft",
  pending_approval: "Awaiting approval",
  scheduled: "Scheduled",
  generating: "Generating",
  ready: "Ready",
  posting: "Publishing",
  posted: "Published",
  failed: "Failed",
  cancelled: "Cancelled",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthMatrix(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function toUiPost(raw: any): Post {
  return {
    id: String(raw._id ?? raw.id),
    userId: String(raw.userId ?? ""),
    automationId: raw.automationId,
    brandProfileId: raw.brandProfileId,
    source: raw.source ?? "manual",
    scheduledFor: raw.scheduledFor instanceof Date ? raw.scheduledFor : new Date(raw.scheduledFor),
    timezone: raw.timezone ?? "UTC",
    status: raw.status as PostStatus,
    brief: raw.brief ?? "",
    content: raw.content,
    media: raw.media,
    platforms: (raw.platforms ?? []) as SocialPlatform[],
    socialAccountIds: raw.socialAccountIds ?? [],
    results: raw.results,
    attempts: raw.attempts ?? 0,
    maxAttempts: raw.maxAttempts ?? 3,
    nextAttemptAt: raw.nextAttemptAt ? new Date(raw.nextAttemptAt) : undefined,
    error: raw.error,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt ?? Date.now()),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : undefined,
  };
}

export default function Schedule() {
  const { user } = useAuth();
  const [anchor, setAnchor] = useState(() => new Date());
  const [legacyPosts, setLegacyPosts] = useState<Post[]>([]);
  const [legacyLoading, setLegacyLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  const days = useMemo(() => monthMatrix(anchor), [anchor]);
  const rangeStart = days[0];
  const rangeEnd = useMemo(() => {
    const end = new Date(days[days.length - 1]);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [days]);

  const convexPosts = useQuery(
    api.posts.listInRange,
    isConvexConfigured
      ? { startMs: rangeStart.getTime(), endMs: rangeEnd.getTime() }
      : "skip",
  );

  useEffect(() => {
    if (!user) return;
    setLegacyLoading(true);
    getPostsInRange(user.uid, rangeStart, rangeEnd)
      .then(setLegacyPosts)
      .catch(() => setLegacyPosts([]))
      .finally(() => setLegacyLoading(false));
  }, [user, rangeStart, rangeEnd]);

  const posts = useMemo(() => {
    const fromConvex = (convexPosts ?? []).map(toUiPost);
    const seen = new Set(fromConvex.map((p) => p.id));
    const fromLegacy = legacyPosts.filter((p) => !seen.has(p.id) && !seen.has(`legacy:${p.id}`));
    return [...fromConvex, ...fromLegacy];
  }, [convexPosts, legacyPosts]);

  const loading =
    legacyLoading || (isConvexConfigured && convexPosts === undefined);

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of posts) {
      const key = dayKey(post.scheduledFor);
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return map;
  }, [posts]);

  const selectedPosts = postsByDay.get(dayKey(selectedDay)) ?? [];
  const today = new Date();
  const monthLabel = anchor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="eyebrow">Schedule</span>
          <h1 className="mt-2 font-display text-3xl">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every scheduled and published post across your channels.
          </p>
        </div>
        <Button asChild>
          <a href="/automations/new">
            <Plus className="mr-1.5 h-4 w-4" /> New automation
          </a>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="glass-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl">{monthLabel}</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => {
                  setAnchor(new Date());
                  setSelectedDay(new Date());
                }}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="pb-2 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const inMonth = day.getMonth() === anchor.getMonth();
              const isToday = dayKey(day) === dayKey(today);
              const isSelected = dayKey(day) === dayKey(selectedDay);
              const dayPosts = postsByDay.get(dayKey(day)) ?? [];
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-start rounded-lg border p-1 pt-1.5 transition-colors sm:aspect-[4/3]",
                    isSelected
                      ? "border-brand/40 bg-brand/10"
                      : "border-transparent hover:bg-accent",
                    !inMonth && "opacity-30"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                      isToday ? "bg-brand font-semibold text-brand-foreground" : "text-foreground"
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {dayPosts.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-0.5">
                      {dayPosts.slice(0, 4).map((post) => (
                        <span
                          key={post.id}
                          className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[post.status])}
                        />
                      ))}
                      {dayPosts.length > 4 && (
                        <span className="text-[9px] text-muted-foreground">+{dayPosts.length - 4}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
            {(["scheduled", "generating", "pending_approval", "posted", "failed"] as PostStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[s])} />
                {STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        </div>

        {/* Day detail */}
        <div className="glass-card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-brand" />
            {selectedDay.toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </h3>
          {loading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : selectedPosts.length === 0 ? (
            <div className="py-8 text-center">
              <LottiePlayer size={96} className="mx-auto" />
              <p className="mt-1 text-sm text-muted-foreground">Nothing scheduled this day.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {selectedPosts
                .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
                .map((post) => (
                  <a
                    key={post.id}
                    href={getSocialPostUrl(post)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in social platform"
                    className="block rounded-lg border border-border bg-secondary p-3 transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[post.status])} />
                      {STATUS_LABEL[post.status]}
                      <span className="ml-auto">
                        {post.scheduledFor.toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-foreground/80">
                      {post.content?.caption ?? post.brief}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-muted-foreground">
                      {post.platforms.map((p) => {
                        const Icon = PLATFORM_ICONS[p];
                        return Icon ? <Icon key={p} className="h-3.5 w-3.5" /> : null;
                      })}
                    </div>
                  </a>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
