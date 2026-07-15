import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@shared/lib/auth";
import type { Automation, Post, PostStatus, SocialPlatform, SocialAccount } from "@shared/types";
import { getAutomations, getPosts, getSocialAccounts } from "@shared/lib/automations";
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
  Youtube,
  Zap,
} from "lucide-react";

const PLATFORM_ICONS: Record<SocialPlatform, typeof Instagram> = {
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
};

const STATUS_DOT: Record<PostStatus, string> = {
  draft: "bg-muted-foreground/40",
  pending_approval: "bg-amber-500",
  scheduled: "bg-sky-500",
  generating: "bg-brand",
  ready: "bg-brand/60",
  posting: "bg-brand",
  posted: "bg-emerald-500",
  failed: "bg-red-500",
  cancelled: "bg-muted-foreground/25",
};

export default function Dashboard() {
  const { user } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [quota, setQuota] = useState<{ plan: string; used: number; limit: number } | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getAutomations(user.uid),
      getPosts(user.uid, 100),
      getQuota({}).catch(() => null),
      getSocialAccounts(user.uid).catch(() => []),
    ])
      .then(([a, p, q, s]) => {
        setAutomations(a);
        setPosts(p);
        setQuota(q);
        setAccounts(s);
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
          <span className="eyebrow">Dashboard</span>
          <h1 className="mt-2 font-display text-3xl tracking-tight">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeAutomations.length > 0
              ? `${activeAutomations.length} automation${activeAutomations.length === 1 ? "" : "s"} working for you right now.`
              : "Your marketing engine is ready when you are."}
          </p>
        </div>
        <Button asChild>
          <Link to="/automations/new">
            <Plus className="mr-1.5 h-4 w-4" /> New automation
          </Link>
        </Button>
      </div>

      {erroredAutomations.length > 0 && (
        <Link
          to="/automations"
          className="mb-6 flex items-center gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4 text-sm text-red-700 transition-colors hover:bg-red-500/10"
        >
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" />
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
            <div className="flex items-center gap-2 text-muted-foreground">
              <stat.icon className="h-4 w-4" />
              <span className="text-[10px] font-mono uppercase tracking-widest">{stat.label}</span>
            </div>
            <div className="mt-2 font-display text-3xl tabular-nums">
              {loading ? "—" : stat.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Connected channels */}
      <div className="glass-card mb-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl">Connected channels</h2>
          <Link to="/settings" className="text-xs font-mono uppercase tracking-widest text-brand hover:text-brand/80">
            Manage →
          </Link>
        </div>
        {loading ? (
          <div className="h-12 animate-pulse rounded-lg bg-secondary" />
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              No channels connected yet. Connect Instagram or LinkedIn to start publishing.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/settings">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Connect a channel
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {accounts.map((account) => {
              const Icon = PLATFORM_ICONS[account.platform] ?? Instagram;
              return (
                <div
                  key={account.id}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="pr-1">
                    <div className="text-sm font-medium leading-tight">
                      @{account.username || account.displayName}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      {account.platform === "twitter" ? "Twitter / X" : account.platform}
                    </div>
                  </div>
                  <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming */}
        <div className="glass-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl">Coming up</h2>
            <Link to="/calendar" className="text-xs font-mono uppercase tracking-widest text-brand hover:text-brand/80">
              Calendar →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-secondary" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No posts queued.{" "}
              <Link to="/automations/new" className="text-brand hover:underline">
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
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
                >
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[post.status])} />
                  <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {post.content?.caption ?? post.brief}
                  </p>
                  <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                    {post.platforms.slice(0, 3).map((p) => {
                      const Icon = PLATFORM_ICONS[p];
                      return Icon ? <Icon key={p} className="h-3.5 w-3.5" /> : null;
                    })}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
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
            <h2 className="font-display text-xl">Recent activity</h2>
            <Link to="/posts" className="text-xs font-mono uppercase tracking-widest text-brand hover:text-brand/80">
              All posts →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-secondary" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Published posts will show up here.
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((post) => (
                <Link
                  key={post.id}
                  to="/posts"
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
                >
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[post.status])} />
                  <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {post.content?.caption ?? post.brief}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
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
            <h2 className="font-display text-xl">Your automations</h2>
            <Link to="/automations" className="text-xs font-mono uppercase tracking-widest text-brand hover:text-brand/80">
              Manage →
            </Link>
          </div>
          {loading ? (
            <div className="h-14 animate-pulse rounded-lg bg-secondary" />
          ) : automations.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              <Zap className="h-4 w-4 text-brand" />
              One brief. Daily posts. Zero effort — that's an automation.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {automations.slice(0, 6).map((automation) => (
                <Link
                  key={automation.id}
                  to={`/automations/${automation.id}`}
                  className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-3 pr-4 text-sm text-foreground/80 transition-colors hover:bg-accent"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      automation.status === "active"
                        ? "bg-emerald-500"
                        : automation.status === "error"
                          ? "bg-red-500"
                          : "bg-amber-500"
                    )}
                  />
                  {automation.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h2 className="mb-3 font-display text-xl">Monthly usage</h2>
          {quota && quota.limit > 0 ? (
            <>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Posts published</span>
                <span className="tabular-nums text-foreground">
                  {quota.used} / {quota.limit}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs capitalize text-muted-foreground">{quota.plan} plan</p>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              Publishing requires an active plan.{" "}
              <Link to="/pricing" className="text-brand hover:underline">
                See pricing
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
