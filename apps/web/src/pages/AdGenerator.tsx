import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@shared/lib/auth";
import { saveAd, getInfluencers, type InfluencerRecord } from "@shared/lib/firestore";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Label } from "@shared/components/ui/label";
import { Textarea } from "@shared/components/ui/textarea";
import { Badge } from "@shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/components/ui/select";
import { cn } from "@shared/lib/utils";
import {
  Megaphone,
  Sparkles,
  Save,
  Instagram,
  Facebook,
  Youtube,
  Play,
  Search,
  Image,
  LayoutGrid,
  Video,
  Smartphone,
  Eye,
} from "lucide-react";

const PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "facebook", label: "Facebook", icon: Facebook },
  { value: "tiktok", label: "TikTok", icon: Play },
  { value: "youtube", label: "YouTube", icon: Youtube },
  { value: "google", label: "Google", icon: Search },
] as const;

const AD_FORMATS = [
  { value: "single", label: "Single Image", icon: Image },
  { value: "carousel", label: "Carousel", icon: LayoutGrid },
  { value: "video", label: "Video", icon: Video },
  { value: "story", label: "Story", icon: Smartphone },
] as const;

const TONES = ["Professional", "Playful", "Bold", "Minimal", "Luxury"] as const;

export default function AdGenerator() {
  const { user } = useAuth();
  const [influencers, setInfluencers] = useState<InfluencerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [adFormat, setAdFormat] = useState("single");
  const [tone, setTone] = useState<string>("Professional");
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [ctaText, setCtaText] = useState("Shop Now");

  useEffect(() => {
    if (!user?.uid) return;
    getInfluencers(user.uid).then(setInfluencers).catch(console.error);
  }, [user?.uid]);

  const handleGenerate = async () => {
    if (!productName.trim()) {
      toast.error("Please enter a product name");
      return;
    }
    setGenerating(true);
    // Simulate generation delay
    await new Promise((r) => setTimeout(r, 2000));
    setGenerated(true);
    setGenerating(false);
    toast.success("Ad generated successfully!");
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      await saveAd({
        userId: user.uid,
        productName,
        platform,
        imageUrl: "",
        adCopy: productDescription,
        settings: {
          format: adFormat,
          tone,
          avatar: selectedAvatar,
          cta: ctaText,
        },
      });
      toast.success("Ad saved to library!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save ad");
    } finally {
      setLoading(false);
    }
  };

  const activePlatform = PLATFORMS.find((p) => p.value === platform);
  const activeFormat = AD_FORMATS.find((f) => f.value === adFormat);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25">
            <Megaphone className="h-5 w-5 text-white" />
          </div>
          <span className="text-gradient">Ad Generator</span>
        </h2>
        <p className="mt-2 text-white/60 max-w-2xl">
          Create high-converting ads for any platform. Choose your product, style, and avatar to
          generate scroll-stopping content in seconds.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: Settings */}
        <div className="space-y-6">
          {/* Product Info */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Product Details</h3>

            <div className="space-y-2">
              <Label htmlFor="product-name" className="text-white/80">
                Product Name
              </Label>
              <Input
                id="product-name"
                placeholder="e.g. Summer Glow Serum"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="bg-white/[0.03] border-white/[0.06]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-desc" className="text-white/80">
                Product Description
              </Label>
              <Textarea
                id="product-desc"
                placeholder="Describe your product, its key features and benefits..."
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                rows={4}
                className="bg-white/[0.03] border-white/[0.06] resize-none"
              />
            </div>
          </div>

          {/* Platform Selection */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Platform</h3>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPlatform(p.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                    platform === p.value
                      ? "bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/20"
                      : "bg-white/[0.03] text-white/60 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white/80"
                  )}
                >
                  <p.icon className="h-4 w-4" />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ad Format */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Ad Format</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {AD_FORMATS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setAdFormat(f.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl p-4 text-sm font-medium transition-all duration-200",
                    adFormat === f.value
                      ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                      : "bg-white/[0.03] text-white/60 border border-white/[0.06] hover:bg-white/[0.06]"
                  )}
                >
                  <f.icon className="h-5 w-5" />
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Tone</h3>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                    tone === t
                      ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                      : "bg-white/[0.03] text-white/60 border border-white/[0.06] hover:bg-white/[0.06]"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Avatar & CTA */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Additional Settings</h3>

            <div className="space-y-2">
              <Label className="text-white/80">Select Avatar to Feature</Label>
              <Select value={selectedAvatar} onValueChange={setSelectedAvatar}>
                <SelectTrigger className="bg-white/[0.03] border-white/[0.06]">
                  <SelectValue placeholder="Choose an avatar (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {influencers.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No avatars available
                    </SelectItem>
                  ) : (
                    influencers.map((inf) => (
                      <SelectItem key={inf.id} value={inf.id ?? inf.name}>
                        {inf.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cta" className="text-white/80">
                Call to Action
              </Label>
              <Input
                id="cta"
                placeholder="Shop Now"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                className="bg-white/[0.03] border-white/[0.06]"
              />
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generating || !productName.trim()}
            className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25 h-12 text-base font-semibold"
          >
            {generating ? (
              <>
                <Sparkles className="mr-2 h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Generate Ad
              </>
            )}
          </Button>
        </div>

        {/* Right: Preview */}
        <div className="space-y-4">
          <div className="glass-card p-6 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Eye className="h-5 w-5 text-purple-400" />
                Ad Preview
              </h3>
              {generated && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  Generated
                </Badge>
              )}
            </div>

            {/* Mock Preview Card */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              {/* Preview Header */}
              <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600" />
                <div>
                  <p className="text-sm font-medium text-white">
                    {productName || "Your Brand"}
                  </p>
                  <p className="text-xs text-white/40">
                    Sponsored &middot; {activePlatform?.label ?? "Instagram"}
                  </p>
                </div>
              </div>

              {/* Preview Image Area */}
              <div className="relative aspect-square bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                {generated ? (
                  <div className="text-center p-8 space-y-3">
                    <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-purple-500/30 to-indigo-600/30 flex items-center justify-center">
                      <Image className="h-10 w-10 text-purple-400" />
                    </div>
                    <p className="text-sm text-white/60">AI-generated creative</p>
                    <Badge variant="outline" className="border-purple-500/30 text-purple-300">
                      {activeFormat?.label ?? "Single Image"}
                    </Badge>
                  </div>
                ) : (
                  <div className="text-center p-8 space-y-3">
                    <div className="mx-auto h-16 w-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                      <Image className="h-8 w-8 text-white/20" />
                    </div>
                    <p className="text-sm text-white/30">
                      Configure settings and generate to preview
                    </p>
                  </div>
                )}

                {/* Format overlay badge */}
                {adFormat && (
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-black/60 text-white/80 backdrop-blur-sm border-white/10">
                      {activeFormat?.label}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Preview Content */}
              <div className="p-4 space-y-3">
                {productDescription ? (
                  <p className="text-sm text-white/70 line-clamp-3">{productDescription}</p>
                ) : (
                  <div className="space-y-2">
                    <div className="h-3 w-full rounded-full bg-white/[0.06]" />
                    <div className="h-3 w-3/4 rounded-full bg-white/[0.06]" />
                    <div className="h-3 w-1/2 rounded-full bg-white/[0.06]" />
                  </div>
                )}

                {/* CTA Button Preview */}
                <button className="w-full rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">
                  {ctaText || "Shop Now"}
                </button>

                {/* Metadata */}
                <div className="flex items-center gap-3 pt-2 text-xs text-white/40">
                  <span>Platform: {activePlatform?.label}</span>
                  <span>&middot;</span>
                  <span>Tone: {tone}</span>
                </div>
              </div>
            </div>

            {/* Save Button */}
            {generated && (
              <Button
                onClick={handleSave}
                disabled={loading}
                className="w-full mt-4 bg-white/[0.06] border border-white/[0.1] text-white hover:bg-white/[0.1]"
              >
                <Save className="mr-2 h-4 w-4" />
                {loading ? "Saving..." : "Save Ad to Library"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
