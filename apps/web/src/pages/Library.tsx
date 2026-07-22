import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@shared/lib/auth";
import type { Post, PostStatus, SocialPlatform } from "@shared/types";
import { getBrandProfiles, getPosts } from "@shared/lib/automations";
import {
  approvePost,
  retryPost,
  cancelPost,
  regeneratePostContent,
} from "@shared/lib/suite";
import type { BrandProfile } from "@shared/types";
import { Button } from "@shared/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@shared/components/ui/tabs";
import { LottiePlayer } from "@shared/components/ui/lottie";
import { cn } from "@shared/lib/utils";
import { api } from "@convex/_generated/api";
import { isConvexConfigured } from "../lib/convex";
import PreviewModule from "../components/previews/PreviewModule";
import type { PreviewContent } from "../components/previews/PlatformPreview";
import {
  Check,
  ExternalLink,
  Facebook,
  Instagram,
  Linkedin,
  Loader2,
  RefreshCw,
  RotateCcw,
  Twitter,
  Youtube,
  X,
} from "lucide-react";

const PLATFORM_ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Facebook,
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
type UiPost = Post & { store: "convex" | "firebase" };

const TAB_FILTERS: Record<Tab, (p: Post) => boolean> = {
  all: (p) => p.status !== "cancelled",
  queue: (p) => ["scheduled", "generating", "ready", "posting"].includes(p.status),
  approval: (p) => p.status === "pending_approval",
  published: (p) => p.status === "posted",
  failed: (p) => p.status === "failed",
};

function toUiPost(raw: any, store: "convex" | "firebase"): UiPost {
  return {
    id: String(raw._id ?? raw.id),
    userId: String(raw.userId ?? ""),
    automationId: raw.automationId,
    brandProfileId: raw.brandProfileId,
    source: raw.source ?? "manual",
    scheduledFor:
      raw.scheduledFor instanceof Date ? raw.scheduledFor : new Date(raw.scheduledFor),
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
    createdAt:
      raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt ?? Date.now()),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : undefined,
    store,
  };
}

export default function Library() {
  const { user } = useAuth();
  const [legacyPosts, setLegacyPosts] = useState<UiPost[]>([]);
  const [legacyLoading, setLegacyLoading] = useState(true);
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [tab, setTab] = useState<Tab>("queue");
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>("linkedin");

  const convexRaw = useQuery(api.posts.list, isConvexConfigured ? { limit: 200 } : "skip");
  const cancelConvex = useMutation(api.posts.cancel);

  const refreshLegacy = async () => {
    if (!user) return;
    setLegacyLoading(true);
    try {
      const list = await getPosts(user.uid, 200);
      setLegacyPosts(list.map((p) => toUiPost(p, "firebase")));
    } catch {
      setLegacyPosts([]);
    } finally {
      setLegacyLoading(false);
    }
  };

  useEffect(() => {
    refreshLegacy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getBrandProfiles(user.uid)
      .then(setBrands)
      .catch(() => setBrands([]));
  }, [user]);

  const posts = useMemo(() => {
    const fromConvex = (convexRaw ?? []).map((p) => toUiPost(p, "convex"));
    const seen = new Set(fromConvex.map((p) => p.id));
    const fromLegacy = legacyPosts.filter((p) => !seen.has(p.id));
    return [...fromConvex, ...fromLegacy].sort(
      (a, b) => b.scheduledFor.getTime() - a.scheduledFor.getTime(),
    );
  }, [convexRaw, legacyPosts]);

  const loading = legacyLoading || (isConvexConfigured && convexRaw === undefined);
  const filtered = useMemo(() => posts.filter(TAB_FILTERS[tab]), [posts, tab]);
  const approvalCount = posts.filter(TAB_FILTERS.approval).length;
  const queueCount = posts.filter(TAB_FILTERS.queue).length;

  // Keep selection in the current tab; default to first row.
  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((p) => p.id === selectedId)) {
      setSelectedId(filtered[0].id);
      const p0 = filtered[0].platforms[0];
      if (p0) setPreviewPlatform(p0);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (selected?.platforms?.[0]) setPreviewPlatform(selected.platforms[0]);
  }, [selected?.id]);

  const brandForPreview = useMemo(() => {
    if (!brands.length) return null;
    if (selected?.brandProfileId) {
      const match = brands.find((b) => b.id === selected.brandProfileId);
      if (match) return match;
    }
    return brands[0] ?? null;
  }, [brands, selected?.brandProfileId]);

  const previewContent: PreviewContent | null = selected
    ? {
        caption:
          selected.content?.perPlatform?.[previewPlatform]?.caption ??
          selected.content?.caption ??
          selected.brief ??
          "",
        hashtags: selected.content?.hashtags,
        imageUrl: selected.media?.find((m) => m.type === "image")?.url,
        brandName: brandForPreview?.name || "Your Brand",
        logoUrl: brandForPreview?.logoUrl,
        handle: brandForPreview?.name
          ? brandForPreview.name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24)
          : undefined,
        brandColors: brandForPreview?.colors
          ? {
              primary: brandForPreview.colors.primary,
              secondary: brandForPreview.colors.secondary,
              accent: brandForPreview.colors.accent,
            }
          : undefined,
      }
    : null;

  const actFirebase = async (
    postId: string,
    fn: (args: { postId: string }) => Promise<unknown>,
    success: string,
  ) => {
    setBusy(postId);
    try {
      await fn({ postId });
      toast.success(success);
      await refreshLegacy();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const actCancel = async (post: UiPost) => {
    setBusy(post.id);
    try {
      if (post.store === "convex") {
        await cancelConvex({ postId: post.id as any });
      } else {
        await cancelPost({ postId: post.id });
        await refreshLegacy();
      }
      toast.success("Post cancelled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cancel failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="w-full animate-fade-in">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <span className="eyebrow">Library</span>
          <h1 className="mt-2 font-display text-3xl">Posts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything Maya and your automations have written, scheduled, and published.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refreshLegacy()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-5">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="queue">
            Queue
            {queueCount > 0 && (
              <span className="ml-1.5 rounded-full bg-brand/15 px-1.5 text-[10px] text-brand">
                {queueCount}
              </span>
            )}
          </TabsTrigger>
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

      <div className="grid grid-cols-1 gap-5 pb-[min(52vh,480px)] lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-0">
        {/* List */}
        <div className="min-w-0">
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
                  ? "No posts yet — approve one in Maya or launch an automation."
                  : "Nothing here right now."}
              </p>
              {tab === "all" && (
                <Button asChild size="sm">
                  <Link to="/maya">Open Maya</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((post) => {
                const status = STATUS_META[post.status];
                const isSelected = selectedId === post.id;
                const permalink = post.results?.find((r) => r.permalink)?.permalink;
                return (
                  <div
                    key={`${post.store}-${post.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedId(post.id);
                      if (post.platforms[0]) setPreviewPlatform(post.platforms[0]);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(post.id);
                        if (post.platforms[0]) setPreviewPlatform(post.platforms[0]);
                      }
                    }}
                    className={cn(
                      "glass-card cursor-pointer p-5 transition-all",
                      isSelected
                        ? "border-brand ring-1 ring-brand/40"
                        : "hover:border-brand/30",
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
                          {post.source === "manual" && (
                            <span className="rounded-full bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider">
                              Maya
                            </span>
                          )}
                        </div>
                        <p className="mt-2 line-clamp-2 whitespace-pre-line text-sm text-foreground/85">
                          {post.content?.caption ?? post.brief}
                        </p>
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

                    <div
                      className="mt-3 flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {post.store === "firebase" && post.status === "pending_approval" && (
                        <>
                          <Button
                            size="sm"
                            disabled={busy === post.id}
                            onClick={() =>
                              actFirebase(
                                post.id,
                                approvePost,
                                "Post approved — publishing at its slot",
                              )
                            }
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
                            onClick={() =>
                              actFirebase(
                                post.id,
                                regeneratePostContent,
                                "Rewritten — take a look",
                              )
                            }
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Rewrite
                          </Button>
                        </>
                      )}
                      {post.store === "firebase" && post.status === "failed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy === post.id}
                          onClick={() => actFirebase(post.id, retryPost, "Retrying")}
                        >
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retry
                        </Button>
                      )}
                      {[
                        "draft",
                        "pending_approval",
                        "scheduled",
                        "ready",
                        "generating",
                        "failed",
                      ].includes(post.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === post.id}
                          onClick={() => actCancel(post)}
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

        {/* Preview module — right rail on desktop; sticky bottom sheet on mobile */}
        <div
          className={cn(
            "z-20 border-border bg-background/95 backdrop-blur-md",
            "fixed inset-x-0 bottom-0 border-t p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]",
            "lg:static lg:inset-auto lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none",
            "lg:sticky lg:top-6 lg:self-start",
          )}
        >
          <PreviewModule
            className="max-h-[min(48vh,420px)] min-h-0 lg:min-h-[420px] lg:max-h-[min(80vh,720px)]"
            title="Preview"
            platform={previewPlatform}
            onPlatformChange={setPreviewPlatform}
            allowedPlatforms={
              selected?.platforms?.length
                ? selected.platforms
                : (["linkedin", "instagram", "youtube", "facebook"] as SocialPlatform[])
            }
            content={previewContent}
            emptyHint="Select a post to preview it on each channel."
          />
        </div>
      </div>
    </div>
  );
}
