import { useEffect, useState } from "react";
import { useAuth } from "@shared/lib/auth";
import {
  getPhotoAvatars,
  getVideos,
  type PhotoAvatarRecord,
  type VideoRecord,
} from "@shared/lib/firestore";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/components/ui/tabs";
import { ScrollArea } from "@shared/components/ui/scroll-area";
import {
  Sparkles,
  Loader2,
  Instagram,
  Youtube,
  Twitter,
  Linkedin,
  Film,
  Rocket,
  BookOpen,
  MessageSquare,
  Heart,
  User,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { rewriteAsUGC } from "@shared/lib/gemini";
import { cn } from "@shared/lib/utils";

const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "tiktok", label: "TikTok", icon: Film },
  { id: "youtube", label: "YouTube", icon: Youtube },
  { id: "twitter", label: "Twitter", icon: Twitter },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
] as const;

const TONES = ["Professional", "Casual", "Funny", "Inspirational", "Educational"] as const;

const TEMPLATES = [
  { name: "Product Launch", description: "Announce a new product with a confident reveal.", icon: Rocket },
  { name: "Tutorial", description: "Explain a product through a simple step-by-step narrative.", icon: BookOpen },
  { name: "Testimonial", description: "Frame the message like a personal experience or review.", icon: MessageSquare },
  { name: "Lifestyle", description: "Make the product feel like part of a natural day-to-day routine.", icon: Heart },
] as const;

type GenerateState = "idle" | "generating" | "done";

export default function ContentStudio() {
  const { user } = useAuth();
  const [avatars, setAvatars] = useState<PhotoAvatarRecord[]>([]);
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [caption, setCaption] = useState("");
  const [tone, setTone] = useState<string>("Casual");
  const [generateState, setGenerateState] = useState<GenerateState>("idle");

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    Promise.all([getPhotoAvatars(user.uid), getVideos(user.uid)])
      .then(([avatarList, videoList]) => {
        setAvatars(avatarList.filter((avatar) => avatar.status === "ready"));
        setVideos(videoList);
      })
      .catch(() => {
        setAvatars([]);
        setVideos([]);
      })
      .finally(() => setLoading(false));
  }, [user?.uid]);

  const handleGenerate = async () => {
    if (!selectedAvatar) {
      toast.error("Please select an avatar first");
      return;
    }

    if (!caption.trim()) {
      toast.error("Please enter source copy first");
      return;
    }

    setGenerateState("generating");
    try {
      const avatar = avatars.find((item) => (item.id ?? item.name) === selectedAvatar);
      const result = await rewriteAsUGC({
        text: caption,
        avatarPersonality: avatar?.personality ?? "Content Creator",
        tone,
      });
      setCaption(result);
      setGenerateState("done");
      toast.success("UGC copy generated");
    } catch {
      setGenerateState("done");
      toast.error("Failed to generate content");
    }
  };

  const handleSelectTemplate = (template: (typeof TEMPLATES)[number]) => {
    setCaption(template.description);
    toast.success(`${template.name} template applied`);
  };

  return (
    <div className="animate-fade-in">
      <Tabs defaultValue="create" className="space-y-6">
        <TabsList className="bg-white/[0.03] border border-white/[0.06]">
          <TabsTrigger value="create">Create Copy</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">Recent Videos</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
              <div className="space-y-6">
                <Card className="glass-card border-white/[0.06]">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base font-display">
                      <User className="h-4 w-4 text-purple-400" />
                      Select Avatar
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select value={selectedAvatar} onValueChange={setSelectedAvatar}>
                      <SelectTrigger className="bg-white/[0.03] border-white/[0.06]">
                        <SelectValue placeholder="Choose an avatar from your library" />
                      </SelectTrigger>
                      <SelectContent>
                        {avatars.length === 0 ? (
                          <SelectItem value="_none" disabled>
                            No ready avatars yet
                          </SelectItem>
                        ) : (
                          avatars.map((avatar) => (
                            <SelectItem key={avatar.id} value={avatar.id ?? avatar.name}>
                              {avatar.name} • {avatar.personality}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                <Card className="glass-card border-white/[0.06]">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base font-display">
                      <Sparkles className="h-4 w-4 text-purple-400" />
                      Copy Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-xs text-white/50">Platform</Label>
                      <div className="flex flex-wrap gap-2">
                        {PLATFORMS.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => setPlatform(item.id)}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 border",
                              platform === item.id
                                ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                                : "bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/70"
                            )}
                          >
                            <item.icon className="h-3.5 w-3.5" />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-white/50">Tone</Label>
                      <div className="flex flex-wrap gap-2">
                        {TONES.map((item) => (
                          <button
                            key={item}
                            onClick={() => setTone(item)}
                            className={cn(
                              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 border",
                              tone === item
                                ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                                : "bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/70"
                            )}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-white/50">Source Copy</Label>
                      <Textarea
                        rows={8}
                        value={caption}
                        onChange={(event) => setCaption(event.target.value)}
                        placeholder="Paste a rough script, product explanation, or social post idea here..."
                        className="bg-white/[0.03] border-white/[0.06] resize-none"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Button
                  onClick={handleGenerate}
                  disabled={generateState === "generating"}
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white gap-2 text-base rounded-xl"
                >
                  {generateState === "generating" ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Rewriting in UGC style...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate UGC Copy
                    </>
                  )}
                </Button>
              </div>

              <div>
                <Card className="glass-card border-white/[0.06] sticky top-4">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-display">Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                      {platform}
                    </Badge>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 min-h-[320px]">
                      <ScrollArea className="h-[280px] pr-4">
                        <p className="text-sm leading-7 text-white/75 whitespace-pre-line">
                          {caption || "Your rewritten UGC copy will appear here."}
                        </p>
                      </ScrollArea>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {TEMPLATES.map((template) => (
              <button
                key={template.name}
                onClick={() => handleSelectTemplate(template)}
                className="glass-card text-left p-5 border-white/[0.06] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <template.icon className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-sm font-medium text-white">{template.name}</h3>
                </div>
                <p className="text-xs text-white/45">{template.description}</p>
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            </div>
          ) : videos.length === 0 ? (
            <Card className="glass-card border-white/[0.06]">
              <CardContent className="py-16 text-center text-white/45">
                No video history yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {videos.slice(0, 9).map((video) => (
                <Card key={video.id} className="glass-card border-white/[0.06]">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{video.productName}</p>
                        <p className="text-xs text-white/45">{video.avatarName} • {video.templateName}</p>
                      </div>
                      <Badge className="bg-white/[0.08] text-white/70 border-white/10 capitalize">
                        {video.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-white/50 line-clamp-3">{video.hookLine}</p>
                    {video.videoUrl && (
                      <Button
                        size="sm"
                        className="w-full bg-purple-600/20 text-purple-300 border border-purple-500/20 hover:bg-purple-600/30"
                        onClick={() => window.open(video.videoUrl, "_blank")}
                      >
                        <Video className="mr-1.5 h-3.5 w-3.5" />
                        Open Video
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
