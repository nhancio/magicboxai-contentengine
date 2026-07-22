import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@shared/lib/auth";
import {
  deleteInfluencer,
  deletePhotoAvatar,
  getInfluencers,
  getPhotoAvatars,
  type InfluencerRecord,
  type PhotoAvatarRecord,
} from "@shared/lib/firestore";
import { Button } from "@shared/components/ui/button";
import { Badge } from "@shared/components/ui/badge";
import { cn } from "@shared/lib/utils";
import { toast } from "sonner";
import {
  Film,
  Image as ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  User,
  Wand2,
} from "lucide-react";
import AvatarCreator from "./AvatarCreator";
import AvatarBuilder from "./AvatarBuilder";

type TabId = "mine" | "create" | "custom";

const TABS: { id: TabId; label: string; icon: typeof User; hint: string }[] = [
  { id: "mine", label: "My avatars", icon: User, hint: "Saved photo & custom avatars" },
  { id: "create", label: "Create avatar", icon: Film, hint: "Photos, video, or webcam" },
  { id: "custom", label: "Custom avatar", icon: Wand2, hint: "AI-generate a look" },
];

function parseTab(raw: string | null): TabId {
  if (raw === "create" || raw === "custom" || raw === "mine") return raw;
  if (raw === "builder" || raw === "generate") return "custom";
  if (raw === "creator" || raw === "new") return "create";
  return "mine";
}

type LibraryItem =
  | { kind: "photo"; record: PhotoAvatarRecord }
  | { kind: "custom"; record: InfluencerRecord };

export default function Avatars() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get("tab"));

  const setTab = useCallback(
    (next: TabId) => {
      setParams(next === "mine" ? {} : { tab: next }, { replace: true });
    },
    [setParams],
  );

  const [loading, setLoading] = useState(true);
  const [photoAvatars, setPhotoAvatars] = useState<PhotoAvatarRecord[]>([]);
  const [customAvatars, setCustomAvatars] = useState<InfluencerRecord[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [photos, customs] = await Promise.all([
        getPhotoAvatars(user.uid),
        getInfluencers(user.uid),
      ]);
      setPhotoAvatars(photos);
      setCustomAvatars(customs);
    } catch {
      setPhotoAvatars([]);
      setCustomAvatars([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary, tab]);

  const library: LibraryItem[] = useMemo(() => {
    const photos: LibraryItem[] = photoAvatars.map((record) => ({ kind: "photo", record }));
    const customs: LibraryItem[] = customAvatars.map((record) => ({ kind: "custom", record }));
    return [...photos, ...customs];
  }, [photoAvatars, customAvatars]);

  const handleDelete = async (item: LibraryItem) => {
    const id = item.record.id;
    if (!id) return;
    if (!confirm(`Delete “${item.record.name}”? This can’t be undone.`)) return;
    setDeletingId(id);
    try {
      if (item.kind === "photo") await deletePhotoAvatar(id);
      else await deleteInfluencer(id);
      toast.success("Avatar deleted");
      await loadLibrary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete avatar");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full animate-fade-in space-y-6">
      <div>
        <span className="eyebrow">AI Video</span>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground md:text-4xl">
          Avatar
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Manage your library, create from photos or video, or generate a custom look — all in one
          place.
        </p>
      </div>

      <div
        className="flex flex-wrap gap-2 rounded-xl border border-border bg-card/60 p-1.5"
        role="tablist"
        aria-label="Avatar sections"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand/15 text-brand border border-brand/25"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent",
              )}
            >
              <t.icon className="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "mine" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Loading…"
                : library.length === 0
                  ? "No avatars yet"
                  : `${library.length} avatar${library.length === 1 ? "" : "s"}`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setTab("create")}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create avatar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setTab("custom")}>
                <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                Custom avatar
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading avatars…
            </div>
          ) : library.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-brand" />
              <h2 className="mt-4 font-display text-xl text-foreground">Create your first avatar</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Upload photos or a short video, or generate a custom AI look to use in Studio.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button onClick={() => setTab("create")}>
                  <Film className="mr-2 h-4 w-4" />
                  Create avatar
                </Button>
                <Button variant="outline" onClick={() => setTab("custom")}>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Custom avatar
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {library.map((item) => {
                const id = item.record.id ?? `${item.kind}-${item.record.name}`;
                const thumb =
                  item.kind === "photo"
                    ? item.record.photoUrls?.[0] || item.record.videoUrl
                    : item.record.imageUrl;
                const isVideoThumb =
                  item.kind === "photo" && !item.record.photoUrls?.[0] && !!item.record.videoUrl;
                const status = item.kind === "photo" ? item.record.status : "ready";
                const subtitle =
                  item.kind === "photo"
                    ? item.record.personality || "Photo / video avatar"
                    : "Custom AI avatar";

                return (
                  <div
                    key={id}
                    className="group overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <div className="relative aspect-[4/5] bg-secondary">
                      {thumb ? (
                        isVideoThumb ? (
                          <video
                            src={thumb}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <img
                            src={thumb}
                            alt={item.record.name}
                            className="h-full w-full object-cover"
                          />
                        )
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-10 w-10 opacity-40" />
                        </div>
                      )}
                      <Badge className="absolute left-3 top-3 border-border/40 bg-background/85 text-foreground backdrop-blur">
                        {item.kind === "photo" ? "Create" : "Custom"}
                      </Badge>
                    </div>
                    <div className="space-y-3 p-4">
                      <div>
                        <h3 className="truncate font-medium text-foreground">{item.record.name}</h3>
                        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                        {status && status !== "ready" && (
                          <p className="mt-1 text-[11px] capitalize text-amber-700">{status}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => navigate("/studio")}
                        >
                          Use in Studio
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={deletingId === item.record.id}
                          onClick={() => void handleDelete(item)}
                        >
                          {deletingId === item.record.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "create" && <AvatarCreator embedded />}
      {tab === "custom" && <AvatarBuilder embedded />}
    </div>
  );
}
