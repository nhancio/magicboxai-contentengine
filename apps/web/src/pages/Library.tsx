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
import { cn } from "@shared/lib/utils";
import PlatformPreview from "../components/previews/PlatformPreview";
import {
  Bot,
  Check,
  ExternalLink,
  Instagram,
  Linkedin,
  Loader2,
  RefreshCw,
  RotateCcw,
  Twitter,
  X,
} from "lucide-react";

const PLATFORM_ICONS: Record<SocialPlatform, typeof Instagram> = {
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
};

const STATUS_META: Record<PostStatus, { label: string; dot: string }> = {
  draft: { label: "Draft", dot: "bg-white/30" },
  pending_approval: { label: "Awaiting approval", dot: "bg-amber-400" },
  scheduled: { label: "Scheduled", dot: "bg-sky-400" },
  generating: { label: "Generating", dot: "bg-violet-400" },
  ready: { label: "Ready to publish", dot: "bg-violet-300" },
  posting: { label: "Publishing", dot: "bg-violet-400" },
  posted: { label: "Published", dot: "bg-emerald-400" },
  failed: { label: "Failed", dot: "bg-rose-400" },
  cancelled: { label: "Cancelled", dot: "bg-white/20" },
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
          <h1 className="text-2xl font-bold tracking-tight">Posts</h1>
          <p className="mt-1 text-sm text-white/40">
            Everything your automations have written, are writing, and have published.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh()}
          className="border-white/10 bg-white/[0.04]"
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-5">
        <TabsList className="bg-white/[0.04]">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="approval">
            Approval
            {approvalCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-300">
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
        <div className="glass-card flex flex-col items-center gap-3 py-16 text-center">
          <Bot className="h-8 w-8 text-white/20" />
          <p className="text-sm text-white/40">
            {tab === "all"
              ? "No posts yet — launch an automation and they'll appear here."
              : "Nothing here right now."}
          </p>
          {tab === "all" && (
            <Button asChild size="sm" className="bg-violet-600 hover:bg-violet-500">
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
                    <div className="flex items-center gap-2 text-xs text-white/40">
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
                          className="text-violet-300/70 hover:text-violet-300"
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
                          "whitespace-pre-line text-sm text-white/85",
                          !isExpanded && "line-clamp-2"
                        )}
                      >
                        {post.content?.caption ?? post.brief}
                      </p>
                    </button>
                    {post.status === "failed" && post.error && (
                      <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300/90">
                        {post.error}
                      </p>
                    )}
                  </div>
                  {post.media?.[0]?.type === "image" && (
                    <img
                      src={post.media[0].url}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-lg border border-white/10 object-cover"
                    />
                  )}
                </div>

                {isExpanded && post.content?.caption && (
                  <div className="mt-4 flex justify-center border-t border-white/[0.06] pt-4">
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
                        className="border-white/10 bg-white/[0.04]"
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
                      className="border-white/10 bg-white/[0.04]"
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
                      className="text-white/40 hover:text-rose-300"
                    >
                      <X className="mr-1 h-3.5 w-3.5" /> Cancel
                    </Button>
                  )}
                  {permalink && (
                    <a
                      href={permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto flex items-center gap-1 text-xs text-violet-300/80 hover:text-violet-300"
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
