import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { isConvexConfigured } from "../lib/convex";
import { getSocialPostUrl } from "../lib/socialUrl";
import { Button } from "@shared/components/ui/button";
import { Badge } from "@shared/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@shared/components/ui/card";
import {
  BarChart3,
  CalendarClock,
  Check,
  Facebook,
  Instagram,
  Linkedin,
  Link2,
  Loader2,
  ShieldCheck,
  XCircle,
  Youtube,
} from "lucide-react";

const PLATFORM_ICON: Record<string, typeof Instagram> = {
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Facebook,
};

export default function Analytics() {
  const accounts = useQuery(api.social.accounts, isConvexConfigured ? {} : "skip");
  const posts = useQuery(api.posts.list, isConvexConfigured ? { limit: 200 } : "skip");

  const connected = useMemo(
    () => (accounts ?? []).filter((a: any) => a.status === "active" || a.status === "expired"),
    [accounts],
  );

  const stats = useMemo(() => {
    const list = posts ?? [];
    const now = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthMs = monthStart.getTime();

    return {
      posted: list.filter((p: any) => p.status === "posted").length,
      postedThisMonth: list.filter(
        (p: any) => p.status === "posted" && (p.scheduledFor ?? 0) >= monthMs,
      ).length,
      queued: list.filter((p: any) =>
        ["scheduled", "generating", "ready", "posting"].includes(p.status),
      ).length,
      failed: list.filter((p: any) => p.status === "failed").length,
      upcoming: list
        .filter(
          (p: any) =>
            ["scheduled", "generating", "ready", "posting"].includes(p.status) &&
            (p.scheduledFor ?? 0) >= now - 60_000,
        )
        .sort((a: any, b: any) => a.scheduledFor - b.scheduledFor)
        .slice(0, 5),
      recentPosted: list
        .filter((p: any) => p.status === "posted")
        .sort((a: any, b: any) => (b.scheduledFor ?? 0) - (a.scheduledFor ?? 0))
        .slice(0, 5),
    };
  }, [posts]);

  const loading = isConvexConfigured && (accounts === undefined || posts === undefined);

  return (
    <div className="w-full animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="eyebrow">Reporting</span>
          <h2 className="mt-2 flex items-center gap-3 font-display text-3xl text-foreground md:text-4xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
              <BarChart3 className="h-5 w-5" />
            </span>
            Analytics
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Publishing activity from your connected channels. Likes, reach, and impressions from
            each platform’s API are coming next — we won’t invent sample numbers.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/settings">
            <Link2 className="mr-2 h-4 w-4" />
            Manage channels
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading your activity…
        </div>
      ) : (
        <>
          {/* Channels */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-brand" />
                Connected channels
              </CardTitle>
              <CardDescription>
                {connected.length === 0
                  ? "No channels linked yet — connect one to publish and track activity here."
                  : `${connected.length} channel${connected.length === 1 ? "" : "s"} ready for publishing.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {connected.length === 0 ? (
                <Button asChild>
                  <Link to="/settings">Connect a channel</Link>
                </Button>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {connected.map((account: any) => {
                    const Icon = PLATFORM_ICON[account.platform] ?? Link2;
                    const raw = (account.username || account.displayName || "").toString().trim();
                    const handle = raw ? (raw.startsWith("@") ? raw : `@${raw}`) : "";
                    return (
                      <div
                        key={account._id}
                        className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                            <Icon className="h-4 w-4 text-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {account.displayName || account.platform}
                            </p>
                            <p className="text-xs capitalize text-muted-foreground">
                              {account.platform}
                              {handle ? ` · ${handle}` : ""}
                            </p>
                          </div>
                        </div>
                        {account.status === "active" ? (
                          <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
                            <Check className="mr-1 h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-700">
                            Reconnect
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Publishing stats */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Posted (all time)", value: stats.posted },
              { label: "Posted this month", value: stats.postedThisMonth },
              { label: "In queue", value: stats.queued },
              { label: "Failed", value: stats.failed },
            ].map((s) => (
              <Card key={s.label} className="glass-card">
                <CardContent className="p-5">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="mt-2 font-display text-3xl text-foreground">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="h-4 w-4 text-brand" />
                  Upcoming
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing queued right now.</p>
                ) : (
                  stats.upcoming.map((p: any) => (
                    <a
                      key={p._id}
                      href={getSocialPostUrl(p)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in social platform"
                      className="flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 hover:bg-secondary"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">
                          {(p.content?.caption || p.brief || "Post").slice(0, 80)}
                        </p>
                        <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                          {(p.platforms ?? []).join(", ")} · {p.status}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {new Date(p.scheduledFor).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </a>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Check className="h-4 w-4 text-brand" />
                  Recently posted
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.recentPosted.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No published posts yet — try Studio or Maya.
                  </p>
                ) : (
                  stats.recentPosted.map((p: any) => (
                    <a
                      key={p._id}
                      href={getSocialPostUrl(p)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in social platform"
                      className="flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 hover:bg-secondary"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">
                          {(p.content?.caption || p.brief || "Post").slice(0, 80)}
                        </p>
                        <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                          {(p.platforms ?? []).join(", ")}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {new Date(p.scheduledFor).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </a>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card border-dashed">
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <div>
                  <p className="text-sm font-medium text-foreground">Engagement metrics next</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Reach, likes, and comments from Instagram / LinkedIn / YouTube APIs aren’t
                    wired yet. Your channels are connected for publishing — this page already
                    reflects real post activity.
                  </p>
                </div>
              </div>
              {stats.failed > 0 && (
                <Button asChild variant="outline" size="sm">
                  <Link to="/posts">
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Review failed ({stats.failed})
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
