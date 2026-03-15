import { useState } from "react";
import { useAuth } from "@shared/lib/auth";
import { saveInfluencer } from "@shared/lib/firestore";
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

const SETTING_OPTIONS: Record<keyof AvatarSettings, string[]> = {
  gender: ["Male", "Female", "Non-binary"],
  ageRange: ["18-25", "26-35", "36-45", "46+"],
  ethnicity: ["Asian", "Black", "Caucasian", "Hispanic", "Middle Eastern", "Mixed"],
  faceShape: ["Oval", "Round", "Square", "Heart", "Diamond"],
  skinTone: ["Fair", "Light", "Medium", "Olive", "Tan", "Dark"],
  hairStyle: ["Short", "Medium", "Long", "Curly", "Wavy", "Braided", "Bald"],
  hairColor: ["Black", "Brown", "Blonde", "Red", "Gray", "Platinum", "Custom"],
  eyeColor: ["Brown", "Blue", "Green", "Hazel", "Gray"],
  outfit: ["Casual", "Business", "Formal", "Streetwear", "Athletic", "Traditional"],
  pose: ["Portrait", "Half-body", "Full-body", "Profile", "Action"],
  expression: ["Neutral", "Smile", "Serious", "Confident", "Playful"],
  background: ["Studio", "Urban", "Nature", "Abstract", "Gradient", "Transparent"],
  lighting: ["Natural", "Studio", "Dramatic", "Soft", "Neon", "Golden Hour"],
  style: [
    "Photorealistic",
    "Anime",
    "3D Render",
    "Oil Painting",
    "Watercolor",
    "Digital Art",
  ],
};

const SETTING_LABELS: Record<keyof AvatarSettings, string> = {
  gender: "Gender",
  ageRange: "Age Range",
  ethnicity: "Ethnicity",
  faceShape: "Face Shape",
  skinTone: "Skin Tone",
  hairStyle: "Hair Style",
  hairColor: "Hair Color",
  eyeColor: "Eye Color",
  outfit: "Outfit",
  pose: "Pose",
  expression: "Expression",
  background: "Background",
  lighting: "Lighting",
  style: "Style",
};

const DEFAULT_SETTINGS: AvatarSettings = {
  gender: "",
  ageRange: "",
  ethnicity: "",
  faceShape: "",
  skinTone: "",
  hairStyle: "",
  hairColor: "",
  eyeColor: "",
  outfit: "",
  pose: "",
  expression: "",
  background: "",
  lighting: "",
  style: "",
};

type GenerateState = "idle" | "generating" | "done";

export default function AvatarBuilder() {
  const { user } = useAuth();
  const [avatarName, setAvatarName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [settings, setSettings] = useState<AvatarSettings>({ ...DEFAULT_SETTINGS });
  const [generateState, setGenerateState] = useState<GenerateState>("idle");
  const [saving, setSaving] = useState(false);

  const updateSetting = (key: keyof AvatarSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    setAvatarName("");
    setPrompt("");
    setGenerateState("idle");
  };

  const handleGenerate = () => {
    if (!avatarName.trim()) {
      toast.error("Please enter an avatar name");
      return;
    }

    setGenerateState("generating");
    // Simulate AI generation
    setTimeout(() => {
      setGenerateState("done");
      toast.success("Avatar generated successfully!");
    }, 2000);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveInfluencer({
        userId: user.uid,
        name: avatarName,
        prompt,
        imageUrl: "",
        settings: settings as unknown as Record<string, string>,
      });
      toast.success("Avatar saved to library!");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save avatar";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const settingKeys = Object.keys(SETTING_OPTIONS) as (keyof AvatarSettings)[];
  const filledCount = settingKeys.filter((k) => settings[k]).length;

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 h-full">
        {/* Settings Panel */}
        <div className="space-y-6">
          {/* Name & Prompt */}
          <Card className="glass-card border-white/[0.06]">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-display">
                <User className="h-4 w-4 text-purple-400" />
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
                  className="bg-white/[0.03] border-white/[0.06]"
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
                  className="bg-white/[0.03] border-white/[0.06] resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Avatar Settings */}
          <Card className="glass-card border-white/[0.06]">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-display">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  Appearance Settings
                </CardTitle>
                <Badge
                  variant="secondary"
                  className="bg-purple-500/10 text-purple-400 border-purple-500/20"
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
                      <Label className="text-xs text-white/50">
                        {SETTING_LABELS[key]}
                      </Label>
                      <Select
                        value={settings[key]}
                        onValueChange={(v) => updateSetting(key, v)}
                      >
                        <SelectTrigger className="bg-white/[0.03] border-white/[0.06] h-9 text-sm">
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
              disabled={generateState === "generating"}
              className="flex-1 h-11 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-medium shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-200"
            >
              {generateState === "generating" ? (
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
              className="text-white/60 hover:text-white hover:bg-white/5"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="space-y-4">
          <Card className="glass-card border-white/[0.06] sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-display">
                <Image className="h-4 w-4 text-purple-400" />
                Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-[3/4] rounded-xl overflow-hidden relative">
                {generateState === "idle" && (
                  <div className="w-full h-full bg-white/[0.02] border border-dashed border-white/[0.08] rounded-xl flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
                      <Sparkles className="h-7 w-7 text-white/20" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white/40">
                        No avatar generated yet
                      </p>
                      <p className="text-xs text-white/25">
                        Configure your avatar settings and click Generate
                      </p>
                    </div>
                  </div>
                )}

                {generateState === "generating" && (
                  <div className="w-full h-full bg-white/[0.02] rounded-xl overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-indigo-500/10 to-violet-500/10" />
                    <div className="absolute inset-0 animate-pulse">
                      <div className="h-full w-full bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 animate-shimmer" />
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                      <p className="text-sm text-white/50">
                        Creating your avatar...
                      </p>
                    </div>
                  </div>
                )}

                {generateState === "done" && (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600/20 via-indigo-600/20 to-violet-600/20 rounded-xl flex flex-col items-center justify-center gap-4 p-6 relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-indigo-500/5" />
                    <div className="relative flex flex-col items-center gap-4">
                      <div className="h-32 w-32 rounded-full bg-gradient-to-br from-purple-500/30 to-indigo-600/30 border border-white/10 flex items-center justify-center">
                        <User className="h-16 w-16 text-white/40" />
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="text-lg font-semibold text-white font-display">
                          {avatarName}
                        </h3>
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          Generated
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                        {settingKeys
                          .filter((k) => settings[k])
                          .slice(0, 6)
                          .map((k) => (
                            <Badge
                              key={k}
                              variant="secondary"
                              className="bg-white/5 text-white/50 border-white/10 text-[10px]"
                            >
                              {settings[k]}
                            </Badge>
                          ))}
                        {settingKeys.filter((k) => settings[k]).length > 6 && (
                          <Badge
                            variant="secondary"
                            className="bg-white/5 text-white/50 border-white/10 text-[10px]"
                          >
                            +
                            {settingKeys.filter((k) => settings[k]).length - 6}{" "}
                            more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {generateState === "done" && (
                <>
                  <Separator className="my-4" />
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full h-10 bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 transition-all duration-200"
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
