import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { useAuth } from "@shared/lib/auth";
import type { Automation, Post, PostStatus, SocialAccount } from "@shared/types";
import { getAutomations, getPosts, getSocialAccounts } from "@shared/lib/automations";
import { getQuota } from "@shared/lib/suite";
import { Button } from "@shared/components/ui/button";
import { cn } from "@shared/lib/utils";
import { api } from "@convex/_generated/api";
import { isConvexConfigured } from "../lib/convex";
import { getSocialPostUrl } from "../lib/socialUrl";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Facebook,
  Instagram,
  Linkedin,
  MessageCircle,
  Plus,
  ShieldAlert,
  Twitter,
  Youtube,
  Zap,
} from "lucide-react";

const PLATFORM_ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Facebook,
  whatsapp: MessageCircle,
};

/** Brand colours so each connected channel shows its real platform logo colour. */
const PLATFORM_BRAND: Record<string, { bg: string; label: string }> = {
  instagram: {
    bg: "linear-gradient(45deg,#F58529,#DD2A7B,#8134AF,#515BD4)",
    label: "Instagram",
  },
  youtube: { bg: "#FF0000", label: "YouTube" },
  linkedin: { bg: "#0A66C2", label: "LinkedIn" },
  facebook: { bg: "#1877F2", label: "Facebook" },
  twitter: { bg: "#000000", label: "Twitter / X" },
  whatsapp: { bg: "#25D366", label: "WhatsApp" },
};

type ChannelRow = {
  id: string;
  platform: string;
  username: string;
  displayName: string;
  status: string;
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

function channelKey(platform: string, username: string, displayName: string) {
  return `${platform}:${(username || displayName || "").toLowerCase()}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [legacyPosts, setLegacyPosts] = useState<Post[]>([]);
  const [quota, setQuota] = useState<{ plan: string; used: number; limit: number } | null>(null);
  const [legacyAccounts, setLegacyAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Same source of truth as Settings / Posts — Convex.
  const convexAccounts = useQuery(api.social.accounts, isConvexConfigured ? {} : "skip");
  const convexPostsRaw = useQuery(api.posts.list, isConvexConfigured ? { limit: 200 } : "skip");
  const mayaDeck = useQuery(api.maya.deck, isConvexConfigured ? {} : "skip");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getAutomations(user.uid),
      getPosts(user.uid, 100).catch(() => [] as Post[]),
      getQuota({}).catch(() => null),
      // Legacy Firebase rows only fill gaps until those channels are reconnected via Convex.
      getSocialAccounts(user.uid).catch(() => [] as SocialAccount[]),
    ])
      .then(([a, p, q, s]) => {
        setAutomations(a);
        setLegacyPosts(p);
        setQuota(q);
        setLegacyAccounts(s);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const posts: Post[] = useMemo(() => {
    const fromConvex: Post[] = (convexPostsRaw ?? []).map((raw: any) => ({
      id: String(raw._id),
      userId: String(raw.userId ?? ""),
      automationId: raw.automationId,
      brandProfileId: raw.brandProfileId,
      source: raw.source ?? "manual",
      scheduledFor: new Date(raw.scheduledFor),
      timezone: raw.timezone ?? "UTC",
      status: raw.status as PostStatus,
      brief: raw.brief ?? "",
      content: raw.content,
      media: raw.media,
      platforms: raw.platforms ?? [],
      socialAccountIds: raw.socialAccountIds ?? [],
      results: raw.results,
      attempts: raw.attempts ?? 0,
      maxAttempts: raw.maxAttempts ?? 3,
      nextAttemptAt: raw.nextAttemptAt ? new Date(raw.nextAttemptAt) : undefined,
      error: raw.error,
      createdAt: new Date(raw.createdAt ?? Date.now()),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : undefined,
    }));

    if (!isConvexConfigured) return legacyPosts;

    // Prefer Convex; keep legacy rows that don't share an id (migration leftovers).
    const seen = new Set(fromConvex.map((p) => p.id));
    const extras = legacyPosts.filter((p) => !seen.has(p.id));
    return [...fromConvex, ...extras];
  }, [convexPostsRaw, legacyPosts]);

  const postsLoading =
    loading || (isConvexConfigured && convexPostsRaw === undefined);

  const accounts: ChannelRow[] = useMemo(() => {
    if (isConvexConfigured) {
      return (convexAccounts ?? [])
        .filter((a: any) => a.status === "active" || a.status === "expired")
        .map((a: any) => ({
          id: String(a._id),
          platform: String(a.platform),
          username: String(a.username || ""),
          displayName: String(a.displayName || a.username || a.platform),
          status: String(a.status),
        }));
    }

    return legacyAccounts
      .filter((a) => a.status === "active" || a.status === "expired")
      .map((a) => ({
        id: a.id,
        platform: a.platform,
        username: a.username || "",
        displayName: a.displayName || a.username || a.platform,
        status: a.status,
      }));
  }, [convexAccounts, legacyAccounts]);

  const channelsLoading =
    loading || (isConvexConfigured && convexAccounts === undefined);

  const firstName = user?.displayName?.split(" ")[0] ?? "there";
  const now = Date.now();
  const activeAutomations = automations.filter((a) => a.status === "active");
  const erroredAutomations = automations.filter((a) => a.status === "error");
  const queuedCount = posts.filter((p) =>
    ["scheduled", "generating", "ready", "posting"].includes(p.status),
  ).length;
  const upcoming = posts
    .filter(
      (p) =>
        p.scheduledFor.getTime() >= now - 60_000 &&
        ["scheduled", "generating", "ready", "posting", "pending_approval"].includes(p.status),
    )
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
    .slice(0, 4);
  const awaitingApproval =
    posts.filter((p) => p.status === "pending_approval").length +
    (mayaDeck?.pending?.length ?? 0);
  const publishedThisMonth = posts.filter(
    (p) =>
      p.status === "posted" &&
      p.scheduledFor.getMonth() === new Date().getMonth() &&
      p.scheduledFor.getFullYear() === new Date().getFullYear(),
  ).length;

  const stats = [
    { label: "Active automations", value: activeAutomations.length, icon: Bot },
    { label: "Queued posts", value: queuedCount, icon: CalendarClock },
    { label: "Awaiting approval", value: awaitingApproval, icon: ShieldAlert },
    { label: "Published this month", value: publishedThisMonth, icon: CheckCircle2 },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h1 className="mt-1 font-display text-2xl tracking-tight sm:text-3xl">
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
          className="flex items-center gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-3 text-sm text-red-700 transition-colors hover:bg-red-500/10"
        >
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" />
          {erroredAutomations.length === 1
            ? `“${erroredAutomations[0].name}” stopped after repeated failures — review and resume it.`
            : `${erroredAutomations.length} automations stopped after repeated failures.`}
          <ArrowRight className="ml-auto h-4 w-4" />
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            className="glass-card p-3.5 sm:p-4"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <stat.icon className="h-4 w-4" />
              <span className="text-[10px] font-mono uppercase tracking-widest">{stat.label}</span>
            </div>
            <div className="mt-1.5 font-display text-2xl tabular-nums sm:text-3xl">
              {postsLoading ? "—" : stat.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Channels + Coming up — 50/50 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Connected channels */}
        <div className="glass-card flex min-h-0 flex-col p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg sm:text-xl">Connected channels</h2>
            <Link to="/settings" className="text-xs font-mono uppercase tracking-widest text-brand hover:text-brand/80">
              Manage →
            </Link>
          </div>
          {channelsLoading ? (
            <div className="h-12 animate-pulse rounded-lg bg-secondary" />
          ) : accounts.length === 0 ? (
            <div className="flex flex-1 flex-col items-start justify-center gap-3 rounded-lg border border-dashed border-border p-4">
              <p className="text-sm text-muted-foreground">
                No channels connected yet. Connect YouTube, LinkedIn, Instagram, Facebook, or WhatsApp
                in Settings.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/settings">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Connect a channel
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap content-start gap-2.5">
              {accounts.map((account) => {
                const Icon = PLATFORM_ICONS[account.platform] ?? Instagram;
                const brand = PLATFORM_BRAND[account.platform];
                const raw = (account.username || account.displayName || "").trim();
                const handle = raw ? (raw.startsWith("@") ? raw : `@${raw}`) : account.platform;
                const label =
                  account.platform === "twitter" ? "Twitter / X" : (brand?.label ?? account.platform);
                return (
                  <div
                    key={account.id}
                    title={`${handle} · ${label}`}
                    className="relative flex h-10 w-10 items-center justify-center rounded-lg text-white"
                    style={{ background: brand?.bg ?? "#6b7280" }}
                  >
                    <Icon className="h-5 w-5" />
                    <span
                      className={cn(
                        "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-card",
                        account.status === "active" ? "bg-emerald-500" : "bg-amber-500",
                      )}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Coming up */}
        <div className="glass-card flex min-h-0 flex-col p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg sm:text-xl">Coming up</h2>
            <Link to="/calendar" className="text-xs font-mono uppercase tracking-widest text-brand hover:text-brand/80">
              Calendar →
            </Link>
          </div>
          {postsLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-6 text-center text-sm text-muted-foreground">
              <p>
                No posts queued.{" "}
                <Link to="/studio" className="text-brand hover:underline">
                  Open Studio
                </Link>{" "}
                or{" "}
                <Link to="/maya" className="text-brand hover:underline">
                  review Maya
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((post) => {
                const url = getSocialPostUrl(post);
                const className =
                  "flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 transition-colors sm:p-3";
                const inner = (
                  <>
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
                  </>
                );
                return url ? (
                  <a
                    key={post.id}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View post"
                    className={cn(className, "hover:bg-accent")}
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={post.id} className={className}>
                    {inner}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Automations strip */}
      <div className="glass-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg sm:text-xl">Your automations</h2>
          <Link to="/automations" className="text-xs font-mono uppercase tracking-widest text-brand hover:text-brand/80">
            Manage →
          </Link>
        </div>
        {loading ? (
          <div className="h-10 animate-pulse rounded-lg bg-secondary" />
        ) : automations.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
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
    </div>
  );
}
