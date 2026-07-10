import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@shared/lib/auth";
import type { Automation, Post, PostStatus, SocialPlatform } from "@shared/types";
import { getAutomations, getPosts } from "@shared/lib/automations";
import { getQuota } from "@shared/lib/suite";
import { Button } from "@shared/components/ui/button";
import { cn } from "@shared/lib/utils";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Instagram,
  Linkedin,
  Plus,
  ShieldAlert,
  Twitter,
  Zap,
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

export default function Dashboard() {
  const { user } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [quota, setQuota] = useState<{ plan: string; used: number; limit: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getAutomations(user.uid),
      getPosts(user.uid, 100),
      getQuota({}).catch(() => null),
    ])
      .then(([a, p, q]) => {
        setAutomations(a);
        setPosts(p);
        setQuota(q);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const firstName = user?.displayName?.split(" ")[0] ?? "there";
  const now = Date.now();
  const activeAutomations = automations.filter((a) => a.status === "active");
  const erroredAutomations = automations.filter((a) => a.status === "error");
  const upcoming = posts
    .filter(
      (p) =>
        p.scheduledFor.getTime() >= now - 60_000 &&
        ["scheduled", "generating", "ready", "posting", "pending_approval"].includes(p.status)
    )
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
    .slice(0, 5);
  const recent = posts
    .filter((p) => ["posted", "failed"].includes(p.status))
    .sort((a, b) => b.scheduledFor.getTime() - a.scheduledFor.getTime())
    .slice(0, 5);
  const awaitingApproval = posts.filter((p) => p.status === "pending_approval").length;
  const publishedThisMonth = posts.filter(
    (p) =>
      p.status === "posted" &&
      p.scheduledFor.getMonth() === new Date().getMonth() &&
      p.scheduledFor.getFullYear() === new Date().getFullYear()
  ).length;

  const stats = [
    { label: "Active automations", value: activeAutomations.length, icon: Bot },
    { label: "Queued posts", value: upcoming.length, icon: CalendarClock },
    { label: "Awaiting approval", value: awaitingApproval, icon: ShieldAlert },
    { label: "Published this month", value: publishedThisMonth, icon: CheckCircle2 },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-white/40">
            {activeAutomations.length > 0
              ? `${activeAutomations.length} automation${activeAutomations.length === 1 ? "" : "s"} working for you right now.`
              : "Your marketing engine is ready when you are."}
          </p>
        </div>
        <Button asChild className="bg-violet-600 hover:bg-violet-500">
          <Link to="/automations/new">
            <Plus className="mr-1.5 h-4 w-4" /> New automation
          </Link>
        </Button>
      </div>

      {erroredAutomations.length > 0 && (
        <Link
          to="/automations"
          className="mb-6 flex items-center gap-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.07] p-4 text-sm text-rose-200/90 transition-colors hover:bg-rose-500/10"
        >
          <ShieldAlert className="h-5 w-5 shrink-0 text-rose-300" />
          {erroredAutomations.length === 1
            ? `“${erroredAutomations[0].name}” stopped after repeated failures — review and resume it.`
            : `${erroredAutomations.length} automations stopped after repeated failures.`}
          <ArrowRight className="ml-auto h-4 w-4" />
        </Link>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            className="glass-card p-4"
          >
            <div className="flex items-center gap-2 text-white/35">
              <stat.icon className="h-4 w-4" />
              <span className="text-xs">{stat.label}</span>
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums">
              {loading ? "—" : stat.value}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming */}
        <div className="glass-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Coming up</h2>
            <Link to="/calendar" className="text-xs text-violet-300/80 hover:text-violet-300">
              Calendar →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="py-8 text-center text-sm text-white/35">
              No posts queued.{" "}
              <Link to="/automations/new" className="text-violet-300 hover:underline">
                Launch an automation
              </Link>{" "}
              to fill your calendar.
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((post) => (
                <Link
                  key={post.id}
                  to="/posts"
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.05]"
                >
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[post.status])} />
                  <p className="min-w-0 flex-1 truncate text-sm text-white/80">
                    {post.content?.caption ?? post.brief}
                  </p>
                  <span className="flex shrink-0 items-center gap-1 text-white/35">
                    {post.platforms.slice(0, 3).map((p) => {
                      const Icon = PLATFORM_ICONS[p];
                      return Icon ? <Icon key={p} className="h-3.5 w-3.5" /> : null;
                    })}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-white/40">
                    {post.scheduledFor.toLocaleString(undefined, {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="glass-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recent activity</h2>
            <Link to="/posts" className="text-xs text-violet-300/80 hover:text-violet-300">
              All posts →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="py-8 text-center text-sm text-white/35">
              Published posts will show up here.
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((post) => (
                <Link
                  key={post.id}
                  to="/posts"
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.05]"
                >
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[post.status])} />
                  <p className="min-w-0 flex-1 truncate text-sm text-white/80">
                    {post.content?.caption ?? post.brief}
                  </p>
                  <span className="shrink-0 text-xs text-white/40">
                    {post.status === "posted" ? "Published" : "Failed"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Usage + automations strip */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="glass-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Your automations</h2>
            <Link to="/automations" className="text-xs text-violet-300/80 hover:text-violet-300">
              Manage →
            </Link>
          </div>
          {loading ? (
            <div className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
          ) : automations.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/15 p-4 text-sm text-white/40">
              <Zap className="h-4 w-4 text-violet-300" />
              One brief. Daily posts. Zero effort — that's an automation.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {automations.slice(0, 6).map((automation) => (
                <Link
                  key={automation.id}
                  to={`/automations/${automation.id}`}
                  className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] py-1.5 pl-3 pr-4 text-sm text-white/70 transition-colors hover:bg-white/[0.06]"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      automation.status === "active"
                        ? "bg-emerald-400"
                        : automation.status === "error"
                          ? "bg-rose-400"
                          : "bg-amber-400"
                    )}
                  />
                  {automation.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h2 className="mb-3 font-semibold">Monthly usage</h2>
          {quota && quota.limit > 0 ? (
            <>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-white/50">Posts published</span>
                <span className="tabular-nums text-white/80">
                  {quota.used} / {quota.limit}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                  style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs capitalize text-white/35">{quota.plan} plan</p>
            </>
          ) : (
            <div className="text-sm text-white/40">
              Publishing requires an active plan.{" "}
              <Link to="/pricing" className="text-violet-300 hover:underline">
                See pricing
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
