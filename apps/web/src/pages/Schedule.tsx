import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@shared/lib/auth";
import type { Post, PostStatus, SocialPlatform } from "@shared/types";
import { getPostsInRange } from "@shared/lib/automations";
import { Button } from "@shared/components/ui/button";
import { cn } from "@shared/lib/utils";
import {
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Instagram,
  Linkedin,
  Plus,
  Twitter,
} from "lucide-react";

const PLATFORM_ICONS: Record<SocialPlatform, typeof Instagram> = {
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
};

const STATUS_DOT: Record<PostStatus, string> = {
  draft: "bg-white/30",
  pending_approval: "bg-amber-400",
  scheduled: "bg-sky-400",
  generating: "bg-violet-400",
  ready: "bg-violet-300",
  posting: "bg-violet-400",
  posted: "bg-emerald-400",
  failed: "bg-rose-400",
  cancelled: "bg-white/20",
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

export default function Schedule() {
  const { user } = useAuth();
  const [anchor, setAnchor] = useState(() => new Date());
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  const days = useMemo(() => monthMatrix(anchor), [anchor]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const start = days[0];
    const end = new Date(days[days.length - 1]);
    end.setHours(23, 59, 59);
    getPostsInRange(user.uid, start, end)
      .then(setPosts)
      .finally(() => setLoading(false));
  }, [user, days]);

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
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-white/40">
            Every scheduled and published post across your channels.
          </p>
        </div>
        <Button asChild className="bg-violet-600 hover:bg-violet-500">
          <Link to="/automations/new">
            <Plus className="mr-1.5 h-4 w-4" /> New automation
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="glass-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{monthLabel}</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/50"
                onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-white/50"
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
                className="h-8 w-8 text-white/50"
                onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="pb-2 text-center text-[11px] font-medium text-white/30">
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
                      ? "border-violet-500/60 bg-violet-600/10"
                      : "border-transparent hover:bg-white/[0.04]",
                    !inMonth && "opacity-30"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                      isToday ? "bg-violet-600 font-semibold text-white" : "text-white/60"
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
                        <span className="text-[9px] text-white/40">+{dayPosts.length - 4}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.06] pt-3 text-[11px] text-white/40">
            {(["scheduled", "pending_approval", "posted", "failed"] as PostStatus[]).map((s) => (
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
            <CalendarDays className="h-4 w-4 text-violet-300" />
            {selectedDay.toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </h3>
          {loading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
              ))}
            </div>
          ) : selectedPosts.length === 0 ? (
            <div className="py-10 text-center">
              <Bot className="mx-auto mb-2 h-6 w-6 text-white/20" />
              <p className="text-sm text-white/35">Nothing scheduled this day.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {selectedPosts
                .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
                .map((post) => (
                  <Link
                    key={post.id}
                    to="/posts"
                    className="block rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.05]"
                  >
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[post.status])} />
                      {STATUS_LABEL[post.status]}
                      <span className="ml-auto">
                        {post.scheduledFor.toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-white/80">
                      {post.content?.caption ?? post.brief}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-white/40">
                      {post.platforms.map((p) => {
                        const Icon = PLATFORM_ICONS[p];
                        return Icon ? <Icon key={p} className="h-3.5 w-3.5" /> : null;
                      })}
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
