import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@shared/lib/auth";
import type { Post, PostStatus, SocialPlatform } from "@shared/types";
import { getPosts } from "@shared/lib/automations";
import {
  approvePost,
  retryPost,
  cancelPost,
  regeneratePostContent,
} from "@shared/lib/suite";
import { Button } from "@shared/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@shared/components/ui/tabs";
import { LottiePlayer } from "@shared/components/ui/lottie";
import { cn } from "@shared/lib/utils";
import PlatformPreview from "../components/previews/PlatformPreview";
import {
  Check,
  ExternalLink,
  Instagram,
  Linkedin,
  Loader2,
  RefreshCw,
  RotateCcw,
  Twitter,
  Youtube,
  X,
} from "lucide-react";

const PLATFORM_ICONS: Record<SocialPlatform, typeof Instagram> = {
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
};

const STATUS_META: Record<PostStatus, { label: string; dot: string }> = {
  draft: { label: "Draft", dot: "bg-muted-foreground/40" },
  pending_approval: { label: "Awaiting approval", dot: "bg-amber-500" },
  scheduled: { label: "Scheduled", dot: "bg-sky-500" },
  generating: { label: "Generating", dot: "bg-brand" },
  ready: { label: "Ready to publish", dot: "bg-brand/60" },
  posting: { label: "Publishing", dot: "bg-brand" },
  posted: { label: "Published", dot: "bg-emerald-500" },
  failed: { label: "Failed", dot: "bg-rose-500" },
  cancelled: { label: "Cancelled", dot: "bg-muted-foreground/30" },
};

type Tab = "all" | "queue" | "approval" | "published" | "failed";

const TAB_FILTERS: Record<Tab, (p: Post) => boolean> = {
  all: () => true,
  queue: (p) => ["scheduled", "generating", "ready", "posting"].includes(p.status),
  approval: (p) => p.status === "pending_approval",
  published: (p) => p.status === "posted",
  failed: (p) => p.status === "failed",
};

export default function Library() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = async () => {
    if (!user) return;
    const list = await getPosts(user.uid, 200);
    setPosts(list);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => posts.filter(TAB_FILTERS[tab]), [posts, tab]);
  const approvalCount = posts.filter(TAB_FILTERS.approval).length;

  const act = async (
    postId: string,
    fn: (args: { postId: string }) => Promise<unknown>,
    success: string
  ) => {
    setBusy(postId);
    try {
      await fn({ postId });
      toast.success(success);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="eyebrow">Library</span>
          <h1 className="mt-2 font-display text-3xl">Posts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything your automations have written, are writing, and have published.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh()}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-5">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="approval">
            Approval
            {approvalCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 text-[10px] text-amber-700">
                {approvalCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card h-28 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-3 py-14 text-center">
          <LottiePlayer size={128} />
          <p className="text-sm text-muted-foreground">
            {tab === "all"
              ? "No posts yet — launch an automation and they'll appear here."
              : "Nothing here right now."}
          </p>
          {tab === "all" && (
            <Button asChild size="sm">
              <Link to="/automations/new">Create automation</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => {
            const status = STATUS_META[post.status];
            const isExpanded = expanded === post.id;
            const permalink = post.results?.find((r) => r.permalink)?.permalink;
            return (
              <div key={post.id} className="glass-card p-5">
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                      {status.label}
                      <span>·</span>
                      <span>
                        {post.scheduledFor.toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="flex items-center gap-1 pl-1">
                        {post.platforms.map((p) => {
                          const Icon = PLATFORM_ICONS[p];
                          return Icon ? <Icon key={p} className="h-3 w-3" /> : null;
                        })}
                      </span>
                      {post.source === "automation" && post.automationId && (
                        <Link
                          to={`/automations/${post.automationId}`}
                          className="text-brand/80 hover:text-brand"
                        >
                          automation
                        </Link>
                      )}
                    </div>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : post.id)}
                      className="mt-2 block w-full text-left"
                    >
                      <p
                        className={cn(
                          "whitespace-pre-line text-sm text-foreground/85",
                          !isExpanded && "line-clamp-2"
                        )}
                      >
                        {post.content?.caption ?? post.brief}
                      </p>
                    </button>
                    {post.status === "failed" && post.error && (
                      <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-red-600">
                        {post.error}
                      </p>
                    )}
                  </div>
                  {post.media?.[0]?.type === "image" && (
                    <img
                      src={post.media[0].url}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
                    />
                  )}
                </div>

                {isExpanded && post.content?.caption && (
                  <div className="mt-4 flex justify-center border-t border-border pt-4">
                    <PlatformPreview
                      platform={post.platforms[0] ?? "instagram"}
                      content={{
                        caption:
                          post.content.perPlatform?.[post.platforms[0]]?.caption ??
                          post.content.caption,
                        hashtags: post.content.hashtags,
                        imageUrl: post.media?.find((m) => m.type === "image")?.url,
                      }}
                    />
                  </div>
                )}

                {/* actions */}
                <div className="mt-3 flex items-center gap-2">
                  {post.status === "pending_approval" && (
                    <>
                      <Button
                        size="sm"
                        disabled={busy === post.id}
                        onClick={() => act(post.id, approvePost, "Post approved — publishing at its slot")}
                        className="bg-emerald-600 hover:bg-emerald-500"
                      >
                        {busy === post.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy === post.id}
                        onClick={() => act(post.id, regeneratePostContent, "Rewritten — take a look")}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Rewrite
                      </Button>
                    </>
                  )}
                  {post.status === "failed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === post.id}
                      onClick={() => act(post.id, retryPost, "Retrying")}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retry
                    </Button>
                  )}
                  {["draft", "pending_approval", "scheduled", "ready", "generating", "failed"].includes(
                    post.status
                  ) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === post.id}
                      onClick={() => act(post.id, cancelPost, "Post cancelled")}
                      className="text-muted-foreground hover:text-red-600"
                    >
                      <X className="mr-1 h-3.5 w-3.5" /> Cancel
                    </Button>
                  )}
                  {permalink && (
                    <a
                      href={permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto flex items-center gap-1 text-xs text-brand/80 hover:text-brand"
                    >
                      View live <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
