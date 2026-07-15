import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@shared/lib/auth";
import type { BrandProfile } from "@shared/types";
import {
  getBrandProfiles,
  saveBrandProfile,
  updateBrandProfile,
  deleteBrandProfile,
} from "@shared/lib/automations";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Textarea } from "@shared/components/ui/textarea";
import { Label } from "@shared/components/ui/label";
import { cn } from "@shared/lib/utils";
import { Loader2, Palette, Plus, Trash2 } from "lucide-react";

type FormState = {
  name: string;
  industry: string;
  toneOfVoice: string;
  audience: string;
  websiteUrl: string;
  bannedTopics: string;
  hashtags: string;
  primaryColor: string;
};

const EMPTY: FormState = {
  name: "",
  industry: "",
  toneOfVoice: "",
  audience: "",
  websiteUrl: "",
  bannedTopics: "",
  hashtags: "",
  primaryColor: "#7c3aed",
};

function toForm(brand: BrandProfile): FormState {
  return {
    name: brand.name,
    industry: brand.industry,
    toneOfVoice: brand.toneOfVoice,
    audience: brand.audience,
    websiteUrl: brand.websiteUrl ?? "",
    bannedTopics: (brand.bannedTopics ?? []).join(", "),
    hashtags: (brand.hashtagSets?.default ?? []).join(" "),
    primaryColor: brand.colors?.primary ?? "#7c3aed",
  };
}

export default function BrandKit() {
  const { user } = useAuth();
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | "new">("new");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    if (!user) return;
    const list = await getBrandProfiles(user.uid);
    setBrands(list);
    setLoading(false);
    if (list.length && selectedId === "new") {
      setSelectedId(list[0].id);
      setForm(toForm(list[0]));
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const select = (id: string | "new") => {
    setSelectedId(id);
    if (id === "new") {
      setForm(EMPTY);
    } else {
      const brand = brands.find((b) => b.id === id);
      if (brand) setForm(toForm(brand));
    }
  };

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!user || !form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        industry: form.industry.trim(),
        toneOfVoice: form.toneOfVoice.trim(),
        audience: form.audience.trim(),
        websiteUrl: form.websiteUrl.trim() || undefined,
        bannedTopics: form.bannedTopics
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        hashtagSets: {
          default: form.hashtags
            .split(/[\s,]+/)
            .map((s) => s.replace(/^#/, "").trim())
            .filter(Boolean),
        },
        colors: { primary: form.primaryColor },
      };
      if (selectedId === "new") {
        const id = await saveBrandProfile({ userId: user.uid, ...payload });
        setSelectedId(id);
        toast.success("Brand kit created");
      } else {
        await updateBrandProfile(selectedId, payload);
        toast.success("Brand kit saved");
      }
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save brand kit");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (selectedId === "new") return;
    if (!confirm("Delete this brand kit? Automations using it fall back to a neutral voice.")) return;
    await deleteBrandProfile(selectedId);
    setSelectedId("new");
    setForm(EMPTY);
    await refresh();
    toast.success("Brand kit deleted");
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <span className="eyebrow">Brand Kit</span>
        <h1 className="mt-2 font-display text-3xl">Brand kit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything the engine needs to sound and look unmistakably like you.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          {loading ? (
            <div className="glass-card h-12 animate-pulse" />
          ) : (
            <>
              {brands.map((brand) => (
                <button
                  key={brand.id}
                  onClick={() => select(brand.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-3 text-left text-sm transition-colors",
                    selectedId === brand.id
                      ? "border-brand/40 bg-brand/10 text-brand"
                      : "border-border bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: brand.colors?.primary ?? "#7c3aed" }}
                  />
                  <span className="truncate">{brand.name}</span>
                </button>
              ))}
              <button
                onClick={() => select("new")}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg border border-dashed px-3.5 py-3 text-left text-sm transition-colors",
                  selectedId === "new"
                    ? "border-brand/40 text-brand"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Plus className="h-4 w-4" /> New brand
              </button>
            </>
          )}
        </div>

        <div className="glass-card space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-brand" />
            <h2 className="font-display text-xl">
              {selectedId === "new" ? "New brand" : "Edit brand"}
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Company name</Label>
              <Input value={form.name} onChange={set("name")} placeholder="Acme Analytics" className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input value={form.industry} onChange={set("industry")} placeholder="B2B SaaS" className="bg-secondary border-border" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Audience</Label>
            <Input
              value={form.audience}
              onChange={set("audience")}
              placeholder="Operations leaders at mid-market manufacturers"
              className="bg-secondary border-border"
            />
          </div>
          <div className="space-y-2">
            <Label>Tone of voice</Label>
            <Textarea
              value={form.toneOfVoice}
              onChange={set("toneOfVoice")}
              rows={3}
              placeholder="Confident and human. Plain language over jargon. Specific numbers over vague claims."
              className="bg-secondary border-border"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={form.websiteUrl} onChange={set("websiteUrl")} placeholder="https://acme.example" className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label>Brand color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={set("primaryColor")}
                  className="h-10 w-12 cursor-pointer rounded-md border border-border bg-transparent"
                />
                <Input value={form.primaryColor} onChange={set("primaryColor")} className="bg-secondary border-border" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Preferred hashtags</Label>
            <Input
              value={form.hashtags}
              onChange={set("hashtags")}
              placeholder="#supplychain #manufacturing #operations"
              className="bg-secondary border-border"
            />
          </div>
          <div className="space-y-2">
            <Label>Never mention (comma-separated)</Label>
            <Input
              value={form.bannedTopics}
              onChange={set("bannedTopics")}
              placeholder="competitor names, politics, pricing details"
              className="bg-secondary border-border"
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            {selectedId !== "new" ? (
              <Button
                variant="ghost"
                onClick={handleDelete}
                className="text-muted-foreground hover:text-red-600"
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete
              </Button>
            ) : (
              <span />
            )}
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="bg-violet-600 hover:bg-violet-500"
            >
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {selectedId === "new" ? "Create brand kit" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
