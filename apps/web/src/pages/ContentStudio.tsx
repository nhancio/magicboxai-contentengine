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
import { captureEvent } from "@shared/lib/analytics";

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
      captureEvent("ugc_copy_generated", { platform, tone });
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
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="create">Create Copy</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">Recent Videos</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
              <div className="space-y-6">
                <Card className="glass-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base font-display">
                      <User className="h-4 w-4 text-brand" />
                      Select Avatar
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={selectedAvatar || undefined}
                      onValueChange={setSelectedAvatar}
                    >
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue placeholder="Choose an avatar from your library" />
                      </SelectTrigger>
                      <SelectContent>
                        {avatars.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            No ready avatars yet — create one under Avatars.
                          </div>
                        ) : (
                          avatars.map((avatar, index) => {
                            const value = String(avatar.id || avatar.name || `avatar-${index}`);
                            return (
                              <SelectItem key={value} value={value}>
                                {avatar.name || "Untitled"} • {avatar.personality || "Creator"}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base font-display">
                      <Sparkles className="h-4 w-4 text-brand" />
                      Copy Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Platform</Label>
                      <div className="flex flex-wrap gap-2">
                        {PLATFORMS.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => setPlatform(item.id)}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 border",
                              platform === item.id
                                ? "bg-brand/10 border-brand/20 text-brand"
                                : "bg-secondary border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                          >
                            <item.icon className="h-3.5 w-3.5" />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Tone</Label>
                      <div className="flex flex-wrap gap-2">
                        {TONES.map((item) => (
                          <button
                            key={item}
                            onClick={() => setTone(item)}
                            className={cn(
                              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 border",
                              tone === item
                                ? "bg-brand/10 border-brand/20 text-brand"
                                : "bg-secondary border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Source Copy</Label>
                      <Textarea
                        rows={8}
                        value={caption}
                        onChange={(event) => setCaption(event.target.value)}
                        placeholder="Paste a rough script, product explanation, or social post idea here..."
                        className="bg-secondary border-border resize-none"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Button
                  onClick={handleGenerate}
                  disabled={generateState === "generating"}
                  className="w-full h-12 gap-2 text-base"
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
                <Card className="glass-card sticky top-4">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-display">Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Badge className="bg-brand/10 text-brand border-brand/20">
                      {platform}
                    </Badge>
                    <div className="rounded-2xl border border-border bg-secondary p-4 min-h-[320px]">
                      <ScrollArea className="h-[280px] pr-4">
                        <p className="text-sm leading-7 text-foreground/70 whitespace-pre-line">
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
                className="glass-card text-left p-5 hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                    <template.icon className="w-5 h-5 text-brand" />
                  </div>
                  <h3 className="text-sm font-medium text-foreground">{template.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground">{template.description}</p>
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
            </div>
          ) : videos.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-16 text-center text-muted-foreground">
                No video history yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {videos.slice(0, 9).map((video) => (
                <Card key={video.id} className="glass-card">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{video.productName}</p>
                        <p className="text-xs text-muted-foreground">{video.avatarName} • {video.templateName}</p>
                      </div>
                      <Badge className="bg-secondary text-foreground/70 border-border capitalize">
                        {video.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">{video.hookLine}</p>
                    {video.videoUrl && (
                      <Button
                        size="sm"
                        className="w-full bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20"
                        onClick={() => window.open(video.videoUrl, "_blank", "noopener,noreferrer")}
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
