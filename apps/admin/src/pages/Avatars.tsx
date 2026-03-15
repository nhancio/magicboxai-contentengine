import { useState, useEffect, useMemo } from "react";
import { Image, Search, Eye, Trash2, Calendar, User } from "lucide-react";
import { getRecentInfluencers, deleteInfluencer } from "@shared/lib/firestore";
import { Card, CardContent } from "@shared/components/ui/card";
import { Input } from "@shared/components/ui/input";
import { Button } from "@shared/components/ui/button";
import { Badge } from "@shared/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@shared/components/ui/dialog";
import { Separator } from "@shared/components/ui/separator";
import { toast } from "sonner";

type AvatarRecord = Record<string, unknown>;

const filters = ["All", "Recent", "Most Used"] as const;

export default function Avatars() {
  const [avatars, setAvatars] = useState<AvatarRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadAvatars();
  }, []);

  async function loadAvatars() {
    try {
      const data = await getRecentInfluencers(50);
      setAvatars(data);
    } catch (err) {
      console.error("Failed to load avatars:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredAvatars = useMemo(() => {
    if (!search.trim()) return avatars;
    const q = search.toLowerCase();
    return avatars.filter(
      (a) =>
        ((a.name as string) || "").toLowerCase().includes(q) ||
        ((a.userId as string) || "").toLowerCase().includes(q)
    );
  }, [avatars, search]);

  function formatTimestamp(ts: unknown): string {
    if (!ts) return "N/A";
    if (typeof ts === "object" && ts !== null && "toDate" in ts) {
      return (ts as { toDate: () => Date }).toDate().toLocaleDateString();
    }
    if (ts instanceof Date) return ts.toLocaleDateString();
    return String(ts);
  }

  function viewDetails(avatar: AvatarRecord) {
    setSelectedAvatar(avatar);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this avatar?")) return;
    try {
      await deleteInfluencer(id);
      setAvatars((prev) => prev.filter((a) => a.id !== id));
      toast.success("Avatar deleted successfully");
    } catch (err) {
      console.error("Failed to delete avatar:", err);
      toast.error("Failed to delete avatar");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-pink-500/10">
            <Image className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Avatars</h1>
            <p className="text-white/50 text-sm">
              {loading ? "Loading..." : `${avatars.length} total avatars`}
            </p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            placeholder="Search avatars..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 w-64"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              activeFilter === filter
                ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                : "text-white/50 hover:text-white/70 hover:bg-white/5 border border-transparent"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <div className="h-40 bg-white/5 animate-pulse rounded-t-xl" />
              <CardContent className="pt-4 space-y-2">
                <div className="h-5 w-3/4 bg-white/5 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-white/5 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAvatars.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Image className="w-12 h-12 text-white/20 mb-4" />
          <p className="text-white/50 text-sm">
            {search ? "No avatars match your search" : "No avatars created yet"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAvatars.map((avatar, i) => {
            const id = avatar.id as string;
            const settings = (avatar.settings as Record<string, string>) || {};
            return (
              <Card
                key={id || i}
                className="overflow-hidden group hover:border-white/20 transition-all duration-200"
              >
                {/* Gradient placeholder image */}
                <div className="h-40 bg-gradient-to-br from-purple-600/30 via-pink-500/20 to-indigo-600/30 flex items-center justify-center relative">
                  {avatar.imageUrl ? (
                    <img
                      src={avatar.imageUrl as string}
                      alt={(avatar.name as string) || "Avatar"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Image className="w-10 h-10 text-white/20" />
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => viewDetails(avatar)}
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                    {id && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <CardContent className="pt-4 space-y-2">
                  <h3 className="font-semibold text-white truncate">
                    {(avatar.name as string) || "Untitled"}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-white/40">
                    <User className="w-3 h-3" />
                    <span className="font-mono truncate">
                      {((avatar.userId as string) || "N/A").slice(0, 16)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-white/40">
                    <Calendar className="w-3 h-3" />
                    <span>{formatTimestamp(avatar.createdAt)}</span>
                  </div>
                  {Object.keys(settings).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Object.entries(settings)
                        .slice(0, 3)
                        .map(([key, val]) => (
                          <Badge key={key} variant="secondary" className="text-[10px]">
                            {key}: {val}
                          </Badge>
                        ))}
                      {Object.keys(settings).length > 3 && (
                        <Badge variant="secondary" className="text-[10px]">
                          +{Object.keys(settings).length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {(selectedAvatar?.name as string) || "Avatar Details"}
            </DialogTitle>
            <DialogDescription>
              Full settings and information for this avatar.
            </DialogDescription>
          </DialogHeader>
          {selectedAvatar && (
            <div className="space-y-4">
              {selectedAvatar.imageUrl && (
                <div className="rounded-lg overflow-hidden">
                  <img
                    src={selectedAvatar.imageUrl as string}
                    alt={(selectedAvatar.name as string) || "Avatar"}
                    className="w-full h-48 object-cover"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-white/40 text-xs mb-0.5">Name</p>
                  <p className="text-white font-medium">
                    {(selectedAvatar.name as string) || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-white/40 text-xs mb-0.5">Creator</p>
                  <p className="text-white font-mono text-xs">
                    {(selectedAvatar.userId as string) || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-white/40 text-xs mb-0.5">Created</p>
                  <p className="text-white">
                    {formatTimestamp(selectedAvatar.createdAt)}
                  </p>
                </div>
              </div>

              {selectedAvatar.prompt && (
                <>
                  <Separator />
                  <div>
                    <p className="text-white/40 text-xs mb-1">Prompt</p>
                    <p className="text-white/80 text-sm">
                      {selectedAvatar.prompt as string}
                    </p>
                  </div>
                </>
              )}

              {selectedAvatar.settings &&
                Object.keys(
                  selectedAvatar.settings as Record<string, string>
                ).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-white/40 text-xs mb-2">Settings</p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(
                          selectedAvatar.settings as Record<string, string>
                        ).map(([key, val]) => (
                          <div
                            key={key}
                            className="bg-white/5 rounded-lg px-3 py-2"
                          >
                            <p className="text-white/40 text-[10px] uppercase tracking-wider">
                              {key}
                            </p>
                            <p className="text-white text-sm">{val}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
