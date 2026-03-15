import { useEffect, useState } from "react";
import { useAuth } from "@shared/lib/auth";
import { getInfluencers, type InfluencerRecord } from "@shared/lib/firestore";
import { Button } from "@shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Badge } from "@shared/components/ui/badge";
import { Textarea } from "@shared/components/ui/textarea";
import { Label } from "@shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@shared/components/ui/tabs";
import { ScrollArea } from "@shared/components/ui/scroll-area";
import {
  Sparkles,
  Loader2,
  Instagram,
  Youtube,
  Twitter,
  Linkedin,
  Image,
  Film,
  Layout,
  Layers,
  Clock,
  Rocket,
  Camera,
  BookOpen,
  MessageSquare,
  Heart,
  CalendarDays,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";

const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "tiktok", label: "TikTok", icon: Film },
  { id: "youtube", label: "YouTube", icon: Youtube },
  { id: "twitter", label: "Twitter", icon: Twitter },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
] as const;

const CONTENT_TYPES = [
  { id: "photo", label: "Photo Post", icon: Image },
  { id: "story", label: "Story", icon: Layers },
  { id: "reel", label: "Reel / Short", icon: Film },
  { id: "carousel", label: "Carousel", icon: Layout },
] as const;

const TONES = [
  "Professional",
  "Casual",
  "Funny",
  "Inspirational",
  "Educational",
] as const;

const TEMPLATES = [
  {
    name: "Product Launch",
    description: "Announce a new product with style",
    icon: Rocket,
    color: "from-purple-500 to-indigo-600",
  },
  {
    name: "Behind the Scenes",
    description: "Show the authentic creative process",
    icon: Camera,
    color: "from-violet-500 to-purple-600",
  },
  {
    name: "Tutorial",
    description: "Educational step-by-step content",
    icon: BookOpen,
    color: "from-indigo-500 to-blue-600",
  },
  {
    name: "Testimonial",
    description: "Share customer success stories",
    icon: MessageSquare,
    color: "from-pink-500 to-rose-600",
  },
  {
    name: "Lifestyle",
    description: "Relatable day-in-the-life content",
    icon: Heart,
    color: "from-amber-500 to-orange-600",
  },
  {
    name: "Event",
    description: "Promote upcoming events and launches",
    icon: CalendarDays,
    color: "from-emerald-500 to-teal-600",
  },
];

type GenerateState = "idle" | "generating" | "done";

export default function ContentStudio() {
  const { user } = useAuth();
  const [avatars, setAvatars] = useState<InfluencerRecord[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [contentType, setContentType] = useState("photo");
  const [caption, setCaption] = useState("");
  const [tone, setTone] = useState("");
  const [generateState, setGenerateState] = useState<GenerateState>("idle");

  useEffect(() => {
    if (!user) return;
    getInfluencers(user.uid)
      .then(setAvatars)
      .catch(() => setAvatars([]));
  }, [user]);

  const handleGenerate = () => {
    if (!selectedAvatar) {
      toast.error("Please select an avatar first");
      return;
    }
    if (!caption.trim()) {
      toast.error("Please enter a caption or script");
      return;
    }

    setGenerateState("generating");
    setTimeout(() => {
      setGenerateState("done");
      toast.success("Content generated successfully!");
    }, 2000);
  };

  return (
    <div className="animate-fade-in">
      <Tabs defaultValue="create" className="space-y-6">
        <TabsList className="bg-white/[0.03] border border-white/[0.06]">
          <TabsTrigger value="create">Create Post</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Create Post Tab */}
        <TabsContent value="create" className="mt-0">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
            {/* Settings */}
            <div className="space-y-6">
              {/* Avatar Selection */}
              <Card className="glass-card border-white/[0.06]">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base font-display">
                    <User className="h-4 w-4 text-purple-400" />
                    Select Avatar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={selectedAvatar}
                    onValueChange={setSelectedAvatar}
                  >
                    <SelectTrigger className="bg-white/[0.03] border-white/[0.06]">
                      <SelectValue placeholder="Choose an avatar from your library" />
                    </SelectTrigger>
                    <SelectContent>
                      {avatars.length === 0 ? (
                        <SelectItem value="_none" disabled>
                          No avatars yet -- create one first
                        </SelectItem>
                      ) : (
                        avatars.map((a) => (
                          <SelectItem key={a.id} value={a.id ?? a.name}>
                            {a.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Platform & Content Type */}
              <Card className="glass-card border-white/[0.06]">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base font-display">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    Post Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Platform Pills */}
                  <div className="space-y-2">
                    <Label className="text-xs text-white/50">Platform</Label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPlatform(p.id)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 border",
                            platform === p.id
                              ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                              : "bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/70"
                          )}
                        >
                          <p.icon className="h-3.5 w-3.5" />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Content Type */}
                  <div className="space-y-2">
                    <Label className="text-xs text-white/50">
                      Content Type
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {CONTENT_TYPES.map((ct) => (
                        <button
                          key={ct.id}
                          onClick={() => setContentType(ct.id)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-xs font-medium transition-all duration-200 border",
                            contentType === ct.id
                              ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                              : "bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/70"
                          )}
                        >
                          <ct.icon className="h-5 w-5" />
                          {ct.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="space-y-2">
                    <Label className="text-xs text-white/50">
                      Caption / Script
                    </Label>
                    <Textarea
                      placeholder="Write your caption or describe the content you want..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={4}
                      className="bg-white/[0.03] border-white/[0.06] resize-none"
                    />
                  </div>

                  {/* Tone */}
                  <div className="space-y-2">
                    <Label className="text-xs text-white/50">Tone</Label>
                    <div className="flex flex-wrap gap-2">
                      {TONES.map((t) => (
                        <button
                          key={t}
                          onClick={() => setTone(t)}
                          className={cn(
                            "rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 border",
                            tone === t
                              ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                              : "bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/70"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={generateState === "generating"}
                className="w-full h-11 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-medium shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-200"
              >
                {generateState === "generating" ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Generate Content
                  </span>
                )}
              </Button>
            </div>

            {/* Preview */}
            <div>
              <Card className="glass-card border-white/[0.06] sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-display">
                    <Image className="h-4 w-4 text-purple-400" />
                    Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-square rounded-xl overflow-hidden">
                    {generateState === "idle" && (
                      <div className="w-full h-full bg-white/[0.02] border border-dashed border-white/[0.08] rounded-xl flex flex-col items-center justify-center gap-3 p-6 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
                          <Image className="h-7 w-7 text-white/20" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-white/40">
                            Content preview
                          </p>
                          <p className="text-xs text-white/25">
                            Configure your post and click Generate
                          </p>
                        </div>
                      </div>
                    )}

                    {generateState === "generating" && (
                      <div className="w-full h-full bg-white/[0.02] rounded-xl overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-indigo-500/10 to-violet-500/10" />
                        <div className="absolute inset-0 animate-pulse">
                          <div className="h-full w-full bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12" />
                        </div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                          <p className="text-sm text-white/50">
                            Creating content...
                          </p>
                        </div>
                      </div>
                    )}

                    {generateState === "done" && (
                      <div className="w-full h-full bg-gradient-to-br from-purple-600/20 via-indigo-600/20 to-violet-600/20 rounded-xl flex flex-col items-center justify-center gap-4 p-6 relative">
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          {platform} / {contentType}
                        </Badge>
                        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-purple-500/30 to-indigo-600/30 border border-white/10 flex items-center justify-center">
                          <User className="h-12 w-12 text-white/40" />
                        </div>
                        <p className="text-sm text-white/60 text-center line-clamp-3 max-w-[260px]">
                          {caption || "Your generated content will appear here"}
                        </p>
                        {tone && (
                          <Badge
                            variant="secondary"
                            className="bg-white/5 text-white/50 border-white/10 text-xs"
                          >
                            {tone}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TEMPLATES.map((template) => (
              <Card
                key={template.name}
                className="glass-card border-white/[0.06] transition-all duration-300 hover:bg-white/[0.06] hover:border-white/[0.1] cursor-pointer group"
              >
                <CardContent className="p-6 flex flex-col gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${template.color} shadow-lg`}
                  >
                    <template.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-sm text-white/50">
                      {template.description}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className="w-fit bg-white/5 text-white/40 border-white/10 text-xs"
                  >
                    Template
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-0">
          <Card className="glass-card border-white/[0.06]">
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center text-center gap-3 py-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
                  <Clock className="h-7 w-7 text-white/20" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white/60">
                    No content history yet
                  </p>
                  <p className="text-xs text-white/40">
                    Generated content will appear here for easy access
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
