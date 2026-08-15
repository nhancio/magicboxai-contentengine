import { useState } from "react";
import { useAction } from "convex/react";
import { useAuth } from "@shared/lib/auth";
import { saveInfluencer } from "@shared/lib/firestore";
import { buildAvatarPrompt } from "@shared/lib/gemini";
import type { AvatarSettings } from "@shared/types";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Label } from "@shared/components/ui/label";
import { Textarea } from "@shared/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Badge } from "@shared/components/ui/badge";
import { ScrollArea } from "@shared/components/ui/scroll-area";
import { Separator } from "@shared/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/components/ui/select";
import { Sparkles, Loader2, Save, RotateCcw, User, Image } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { isConvexConfigured } from "../lib/convex";
import CreativeImageLoader from "../components/common/CreativeImageLoader";

const SETTING_OPTIONS: Record<keyof AvatarSettings, string[]> = {
 gender: ["Male","Female","Non-binary"],
 ageRange: ["18-25","26-35","36-45","46+"],
 ethnicity: ["Asian","Black","Caucasian","Hispanic","Middle Eastern","Mixed"],
 faceShape: ["Oval","Round","Square","Heart","Diamond"],
 skinTone: ["Fair","Light","Medium","Olive","Tan","Dark"],
 hairStyle: ["Short","Medium","Long","Curly","Wavy","Braided","Bald"],
 hairColor: ["Black","Brown","Blonde","Red","Gray","Platinum","Custom"],
 eyeColor: ["Brown","Blue","Green","Hazel","Gray"],
 outfit: ["Casual","Business","Formal","Streetwear","Athletic","Traditional"],
 pose: ["Portrait","Half-body","Full-body","Profile","Action"],
 expression: ["Neutral","Smile","Serious","Confident","Playful"],
 background: ["Studio","Urban","Nature","Abstract","Gradient","Transparent"],
 lighting: ["Natural","Studio","Dramatic","Soft","Neon","Golden Hour"],
 style: ["Photorealistic","Anime","3D Render","Oil Painting","Watercolor","Digital Art",
 ],
};

const SETTING_LABELS: Record<keyof AvatarSettings, string> = {
 gender:"Gender",
 ageRange:"Age Range",
 ethnicity:"Ethnicity",
 faceShape:"Face Shape",
 skinTone:"Skin Tone",
 hairStyle:"Hair Style",
 hairColor:"Hair Color",
 eyeColor:"Eye Color",
 outfit:"Outfit",
 pose:"Pose",
 expression:"Expression",
 background:"Background",
 lighting:"Lighting",
 style:"Style",
};

const DEFAULT_SETTINGS: AvatarSettings = {
 gender:"",
 ageRange:"",
 ethnicity:"",
 faceShape:"",
 skinTone:"",
 hairStyle:"",
 hairColor:"",
 eyeColor:"",
 outfit:"",
 pose:"",
 expression:"",
 background:"",
 lighting:"",
 style:"",
};

type GenerateState ="idle" |"generating" |"done";

function errorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Failed to generate avatar";
  const anyErr = err as Error & { code?: string; details?: unknown };
  // Firebase callables often surface as message "internal" with the real text elsewhere.
  const raw = anyErr.message?.replace(/^FirebaseError:\s*/i, "").trim() || "";
  if (raw && raw.toLowerCase() !== "internal" && !raw.startsWith("functions/")) {
    return raw.slice(0, 200);
  }
  if (typeof anyErr.details === "string" && anyErr.details.trim()) {
    return anyErr.details.trim().slice(0, 200);
  }
  if (anyErr.code === "functions/internal" || raw.toLowerCase() === "internal") {
    return "Image generation failed. Check Gemini/Imagen access, then try again.";
  }
  return raw || "Failed to generate avatar";
}

export default function AvatarBuilder({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const generateImage = useAction(api.media.generateImage);
  const [avatarName, setAvatarName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [settings, setSettings] = useState<AvatarSettings>({ ...DEFAULT_SETTINGS });
  const [generateState, setGenerateState] = useState<GenerateState>("idle");
  const [imageUrl, setImageUrl] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [saving, setSaving] = useState(false);

  const updateSetting = (key: keyof AvatarSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    setAvatarName("");
    setPrompt("");
    setImageUrl("");
    setGeneratedPrompt("");
    setGenerateState("idle");
  };

  const handleGenerate = async () => {
    if (!avatarName.trim()) {
      toast.error("Please enter an avatar name");
      return;
    }
    if (!isConvexConfigured) {
      toast.error("Convex is not configured — cannot generate images");
      return;
    }

    setGenerateState("generating");
    setImageUrl("");
    try {
      const usedPrompt = buildAvatarPrompt({
        name: avatarName,
        description: prompt,
        settings: settings as unknown as Record<string, string>,
      });
      // Same Gemini image path Studio uses (credits: 1 i-credit).
      const { url } = await generateImage({
        prompt: usedPrompt,
        aspectRatio: "1:1",
      });
      setImageUrl(url);
      setGeneratedPrompt(usedPrompt);
      setGenerateState("done");
      toast.success("Avatar generated — 1 i-credit used");
    } catch (err) {
      setGenerateState("idle");
      toast.error(errorMessage(err));
    }
  };

 const handleSave = async () => {
 if (!user) return;
 setSaving(true);
 try {
 await saveInfluencer({
 userId: user.uid,
 name: avatarName,
 prompt: generatedPrompt || prompt,
 imageUrl,
 settings: settings as unknown as Record<string, string>,
 });
 toast.success("Avatar saved to library!");
 } catch (err) {
 const message =
 err instanceof Error ? err.message :"Failed to save avatar";
 toast.error(message);
 } finally {
 setSaving(false);
 }
 };

 const settingKeys = Object.keys(SETTING_OPTIONS) as (keyof AvatarSettings)[];
 const filledCount = settingKeys.filter((k) => settings[k]).length;

 return (
 <div className="animate-fade-in space-y-4">
 {embedded && (
 <div className="space-y-1">
 <h2 className="font-display text-xl text-foreground">Custom avatar</h2>
 <p className="text-sm text-muted-foreground">
 Generate a look with AI appearance settings, then save it to your library.
 </p>
 </div>
 )}
 <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 h-full">
 {/* Settings Panel */}
 <div className="space-y-6">
 {/* Name & Prompt */}
 <Card className="glass-card border-border/[0.06]">
 <CardHeader className="pb-4">
 <CardTitle className="flex items-center gap-2 text-base font-display">
 <User className="h-4 w-4 text-brand" />
 Avatar Identity
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="avatar-name">Avatar Name</Label>
 <Input
 id="avatar-name"
 placeholder="e.g. Alex, Sophia, Jordan..."
 value={avatarName}
 onChange={(e) => setAvatarName(e.target.value)}
 className="bg-card/[0.03] border-border/[0.06]"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="prompt">Additional Description</Label>
 <Textarea
 id="prompt"
 placeholder="Describe any additional details for your avatar..."
 value={prompt}
 onChange={(e) => setPrompt(e.target.value)}
 rows={3}
 className="bg-card/[0.03] border-border/[0.06] resize-none"
 />
 </div>
 </CardContent>
 </Card>

 {/* Avatar Settings */}
 <Card className="glass-card border-border/[0.06]">
 <CardHeader className="pb-4">
 <div className="flex items-center justify-between">
 <CardTitle className="flex items-center gap-2 text-base font-display">
 <Sparkles className="h-4 w-4 text-brand" />
 Appearance Settings
 </CardTitle>
 <Badge
 variant="secondary"
 className="bg-brand/10 text-brand border-brand/20"
 >
 {filledCount}/{settingKeys.length} set
 </Badge>
 </div>
 </CardHeader>
 <CardContent>
 <ScrollArea className="h-auto max-h-[520px]">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-2">
 {settingKeys.map((key) => (
 <div key={key} className="space-y-1.5">
 <Label className="text-xs text-muted-foreground">
 {SETTING_LABELS[key]}
 </Label>
 <Select
 value={settings[key]}
 onValueChange={(v) => updateSetting(key, v)}
 >
 <SelectTrigger className="bg-card/[0.03] border-border/[0.06] h-9 text-sm">
 <SelectValue
 placeholder={`Select ${SETTING_LABELS[key].toLowerCase()}`}
 />
 </SelectTrigger>
 <SelectContent>
 {SETTING_OPTIONS[key].map((option) => (
 <SelectItem key={option} value={option}>
 {option}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 ))}
 </div>
 </ScrollArea>
 </CardContent>
 </Card>

 {/* Action Buttons */}
 <div className="flex flex-col sm:flex-row gap-3">
 <Button
 onClick={handleGenerate}
 disabled={generateState ==="generating"}
 className="flex-1 h-11 bg-brand hover: hover: text-foreground font-medium shadow-lg hover: transition-all duration-200"
 >
 {generateState ==="generating" ? (
 <span className="flex items-center gap-2">
 <Loader2 className="h-4 w-4 animate-spin" />
 Generating...
 </span>
 ) : (
 <span className="flex items-center gap-2">
 <Sparkles className="h-4 w-4" />
 Generate Avatar
 </span>
 )}
 </Button>
 <Button
 variant="ghost"
 onClick={handleReset}
 className="text-muted-foreground hover:text-foreground hover:bg-secondary"
 >
 <RotateCcw className="h-4 w-4 mr-2" />
 Reset
 </Button>
 </div>
 </div>

 {/* Preview Panel */}
 <div className="space-y-4">
 <Card className="glass-card border-border/[0.06] sticky top-4">
 <CardHeader className="pb-3">
 <CardTitle className="flex items-center gap-2 text-base font-display">
 <Image className="h-4 w-4 text-brand" />
 Preview
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="aspect-[3/4] rounded-xl overflow-hidden relative">
 {generateState ==="idle" && (
 <div className="w-full h-full bg-card/[0.02] border border-dashed border-border/[0.08] rounded-xl flex flex-col items-center justify-center gap-3 p-6 text-center">
 <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
 <Sparkles className="h-7 w-7 text-muted-foreground" />
 </div>
 <div className="space-y-1">
 <p className="text-sm font-medium text-muted-foreground">
 No avatar generated yet
 </p>
 <p className="text-xs text-muted-foreground">
 Configure your avatar settings and click Generate
 </p>
 </div>
 </div>
 )}

        {generateState === "generating" && (
          <CreativeImageLoader
            aspectRatio="auto"
            title="Generating AI Avatar..."
            subtitle="Synthesizing photorealistic features & lighting"
            className="h-full w-full rounded-xl"
          />
        )}

 {generateState ==="done" && (
 <div className="w-full h-full rounded-xl overflow-hidden relative bg-secondary">
 {imageUrl ? (
 <img
 src={imageUrl}
 alt={avatarName}
 className="absolute inset-0 h-full w-full object-cover"
 />
 ) : (
 <div className="absolute inset-0 flex items-center justify-center">
 <User className="h-16 w-16 text-muted-foreground" />
 </div>
 )}
 <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
 <div className="flex items-center justify-between gap-2">
 <h3 className="text-lg font-semibold text-white font-display drop-shadow">
 {avatarName}
 </h3>
 <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-400/30">
 Generated
 </Badge>
 </div>
 <div className="mt-2 flex flex-wrap gap-1.5">
 {settingKeys
 .filter((k) => settings[k])
 .slice(0, 6)
 .map((k) => (
 <Badge
 key={k}
 variant="secondary"
 className="bg-white/15 text-white border-white/20 text-[10px]"
 >
 {settings[k]}
 </Badge>
 ))}
 </div>
 </div>
 </div>
 )}
 </div>

 {generateState ==="done" && (
 <>
 <Separator className="my-4" />
 <Button
 onClick={handleSave}
 disabled={saving}
 className="w-full h-10 bg-secondary hover:bg-accent text-foreground border border-border hover:border-foreground/20 transition-all duration-200"
 >
 {saving ? (
 <span className="flex items-center gap-2">
 <Loader2 className="h-4 w-4 animate-spin" />
 Saving...
 </span>
 ) : (
 <span className="flex items-center gap-2">
 <Save className="h-4 w-4" />
 Save to Library
 </span>
 )}
 </Button>
 </>
 )}
 </CardContent>
 </Card>
 </div>
 </div>
 </div>
 );
}
