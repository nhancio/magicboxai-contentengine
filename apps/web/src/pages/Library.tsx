import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@shared/lib/auth";
import {
  getInfluencers,
  getAds,
  deleteInfluencer,
  deleteAd,
  type InfluencerRecord,
  type AdRecord,
} from "@shared/lib/firestore";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Badge } from "@shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/components/ui/tabs";
import {
  FolderOpen,
  Search,
  Trash2,
  Wand2,
  Megaphone,
  User,
  Image,
  Calendar,
  Loader2,
  Sparkles,
} from "lucide-react";

export default function Library() {
  const { user } = useAuth();
  const [influencers, setInfluencers] = useState<InfluencerRecord[]>([]);
  const [ads, setAds] = useState<AdRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    Promise.all([getInfluencers(user.uid), getAds(user.uid)])
      .then(([inf, adList]) => {
        setInfluencers(inf);
        setAds(adList);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.uid]);

  const handleDeleteInfluencer = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteInfluencer(id);
      setInfluencers((prev) => prev.filter((i) => i.id !== id));
      toast.success("Avatar deleted");
    } catch {
      toast.error("Failed to delete avatar");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAd = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteAd(id);
      setAds((prev) => prev.filter((a) => a.id !== id));
      toast.success("Ad deleted");
    } catch {
      toast.error("Failed to delete ad");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredInfluencers = influencers.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAds = ads.filter((a) =>
    a.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (timestamp: unknown) => {
    if (!timestamp) return "Unknown date";
    const ts = timestamp as { toDate?: () => Date };
    if (ts.toDate) return ts.toDate().toLocaleDateString();
    return new Date(timestamp as string).toLocaleDateString();
  };

  const EmptyState = ({ message, sub }: { message: string; sub: string }) => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-20 w-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
        <FolderOpen className="h-10 w-10 text-white/20" />
      </div>
      <p className="text-lg font-medium text-white/60">{message}</p>
      <p className="text-sm text-white/40 mt-1">{sub}</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25">
            <FolderOpen className="h-5 w-5 text-white" />
          </div>
          <span className="text-gradient">Content Library</span>
        </h2>
        <p className="mt-2 text-white/60">
          Browse and manage all your saved avatars and ads in one place.
        </p>
      </div>

      {/* Search */}
      <div className="glass-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Search your library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/[0.03] border-white/[0.06]"
          />
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
        </div>
      ) : (
        <Tabs defaultValue="avatars" className="space-y-6">
          <TabsList className="bg-white/[0.03] border border-white/[0.06]">
            <TabsTrigger value="avatars" className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-300">
              <User className="mr-2 h-4 w-4" />
              Avatars ({filteredInfluencers.length})
            </TabsTrigger>
            <TabsTrigger value="ads" className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-300">
              <Megaphone className="mr-2 h-4 w-4" />
              Ads ({filteredAds.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-300">
              <FolderOpen className="mr-2 h-4 w-4" />
              All ({filteredInfluencers.length + filteredAds.length})
            </TabsTrigger>
          </TabsList>

          {/* Avatars Tab */}
          <TabsContent value="avatars">
            {filteredInfluencers.length === 0 ? (
              <EmptyState
                message="No avatars yet"
                sub="Create your first avatar in the Avatar Builder!"
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredInfluencers.map((inf) => (
                  <div key={inf.id} className="glass-card overflow-hidden group">
                    {/* Gradient placeholder image */}
                    <div className="aspect-[4/3] bg-gradient-to-br from-purple-600/30 via-indigo-600/20 to-violet-600/30 flex items-center justify-center relative">
                      {inf.imageUrl ? (
                        <img
                          src={inf.imageUrl}
                          alt={inf.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-16 w-16 text-white/20" />
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-white">{inf.name}</h4>
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-white/40">
                            <Calendar className="h-3 w-3" />
                            {formatDate(inf.createdAt)}
                          </div>
                        </div>
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                          Avatar
                        </Badge>
                      </div>

                      {/* Settings summary */}
                      {inf.settings && (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(inf.settings).slice(0, 3).map(([key, val]) => (
                            <span
                              key={key}
                              className="text-xs bg-white/[0.05] text-white/50 rounded-full px-2 py-0.5"
                            >
                              {val}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          className="flex-1 bg-purple-600/20 text-purple-300 border border-purple-500/20 hover:bg-purple-600/30"
                        >
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                          Use in Studio
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => inf.id && handleDeleteInfluencer(inf.id)}
                          disabled={deletingId === inf.id}
                          className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Ads Tab */}
          <TabsContent value="ads">
            {filteredAds.length === 0 ? (
              <EmptyState
                message="No ads yet"
                sub="Head to the Ad Generator to create your first ad!"
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAds.map((ad) => (
                  <div key={ad.id} className="glass-card overflow-hidden group">
                    <div className="aspect-video bg-gradient-to-br from-indigo-600/20 via-purple-600/20 to-pink-600/20 flex items-center justify-center relative">
                      {ad.imageUrl ? (
                        <img
                          src={ad.imageUrl}
                          alt={ad.productName}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <Image className="h-12 w-12 text-white/20" />
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-white">{ad.productName}</h4>
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-white/40">
                            <Calendar className="h-3 w-3" />
                            {formatDate(ad.createdAt)}
                          </div>
                        </div>
                        <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs capitalize">
                          {ad.platform}
                        </Badge>
                      </div>

                      {ad.adCopy && (
                        <p className="text-sm text-white/50 line-clamp-2">{ad.adCopy}</p>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          className="flex-1 bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-600/30"
                        >
                          <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => ad.id && handleDeleteAd(ad.id)}
                          disabled={deletingId === ad.id}
                          className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* All Tab */}
          <TabsContent value="all">
            {filteredInfluencers.length === 0 && filteredAds.length === 0 ? (
              <EmptyState
                message="No items yet"
                sub="Create your first avatar or ad to get started!"
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Avatars */}
                {filteredInfluencers.map((inf) => (
                  <div key={`avatar-${inf.id}`} className="glass-card overflow-hidden">
                    <div className="aspect-[4/3] bg-gradient-to-br from-purple-600/30 via-indigo-600/20 to-violet-600/30 flex items-center justify-center relative">
                      {inf.imageUrl ? (
                        <img
                          src={inf.imageUrl}
                          alt={inf.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-16 w-16 text-white/20" />
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-white">{inf.name}</h4>
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                          Avatar
                        </Badge>
                      </div>
                      <p className="text-xs text-white/40 mt-1">{formatDate(inf.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {/* Ads */}
                {filteredAds.map((ad) => (
                  <div key={`ad-${ad.id}`} className="glass-card overflow-hidden">
                    <div className="aspect-video bg-gradient-to-br from-indigo-600/20 via-purple-600/20 to-pink-600/20 flex items-center justify-center relative">
                      {ad.imageUrl ? (
                        <img
                          src={ad.imageUrl}
                          alt={ad.productName}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <Image className="h-12 w-12 text-white/20" />
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-white">{ad.productName}</h4>
                        <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs capitalize">
                          {ad.platform}
                        </Badge>
                      </div>
                      <p className="text-xs text-white/40 mt-1">{formatDate(ad.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
