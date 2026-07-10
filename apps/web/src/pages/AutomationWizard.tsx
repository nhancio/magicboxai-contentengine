import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@shared/lib/auth";
import type { SocialAccount, SocialPlatform, BrandProfile } from "@shared/types";
import {
  getSocialAccounts,
  getBrandProfiles,
  getAutomation,
} from "@shared/lib/automations";
import {
  createAutomation,
  updateAutomation,
  generatePreviewContent,
  syncSocialAccounts,
} from "@shared/lib/suite";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Textarea } from "@shared/components/ui/textarea";
import { Label } from "@shared/components/ui/label";
import { cn } from "@shared/lib/utils";
import PlatformPreview from "../components/previews/PlatformPreview";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  Image as ImageIcon,
  Instagram,
  Linkedin,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Twitter,
  Type,
  Video,
} from "lucide-react";

const PLATFORM_META: Record<
  SocialPlatform,
  { label: string; icon: typeof Instagram; tint: string }
> = {
  instagram: { label: "Instagram", icon: Instagram, tint: "from-pink-500 to-orange-400" },
  twitter: { label: "Twitter / X", icon: Twitter, tint: "from-sky-400 to-blue-500" },
  linkedin: { label: "LinkedIn", icon: Linkedin, tint: "from-blue-500 to-cyan-500" },
};

const PRESETS = [
  { id: "announcement", label: "Announcement", hint: "Product news framed around customer outcomes" },
  { id: "educational", label: "Educational", hint: "Teach one useful thing, build authority" },
  { id: "promo", label: "Promotional", hint: "Sell the transformation with one clear CTA" },
  { id: "story", label: "Story", hint: "Narrative arc ending in a lesson" },
  { id: "custom", label: "Custom", hint: "Follow the brief's own framing" },
] as const;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STEPS = ["Brief", "Channels", "Content", "Schedule", "Review"] as const;

export default function AutomationWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [syncing, setSyncing] = useState(false);

  // form state
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [preset, setPreset] = useState<string>("custom");
  const [tone, setTone] = useState("");
  const [brandProfileId, setBrandProfileId] = useState<string>("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [withImage, setWithImage] = useState(true);
  const [withVideo, setWithVideo] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [time, setTime] = useState("07:00");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  // review state
  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>("instagram");
  const [preview, setPreview] = useState<{ caption: string; hashtags: string[] } | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);

  useEffect(() => {
    if (!user) return;
    getSocialAccounts(user.uid).then(setAccounts).catch(() => {});
    getBrandProfiles(user.uid).then(setBrands).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!editId) return;
    getAutomation(editId).then((automation) => {
      if (!automation) return;
      setName(automation.name);
      setBrief(automation.brief);
      setPreset(automation.preset);
      setTone(automation.tone);
      setBrandProfileId(automation.brandProfileId ?? "");
      setSelectedAccounts(automation.socialAccountIds);
      setWithImage(automation.contentTypes.image);
      setWithVideo(automation.contentTypes.video);
      setRequiresApproval(automation.requiresApproval);
      setTime(automation.schedule.time);
      setDaysOfWeek(automation.schedule.daysOfWeek ?? []);
    });
  }, [editId]);

  const selectedPlatforms = useMemo(() => {
    const set = new Set<SocialPlatform>();
    for (const account of accounts) {
      if (selectedAccounts.includes(account.id)) set.add(account.platform);
    }
    return [...set];
  }, [accounts, selectedAccounts]);

  useEffect(() => {
    if (selectedPlatforms.length && !selectedPlatforms.includes(previewPlatform)) {
      setPreviewPlatform(selectedPlatforms[0]);
    }
  }, [selectedPlatforms, previewPlatform]);

  const brand = brands.find((b) => b.id === brandProfileId);

  const canNext = [
    name.trim().length > 0 && brief.trim().length > 10,
    selectedAccounts.length > 0,
    true,
    /^\d{2}:\d{2}$/.test(time),
    true,
  ][step];

  const handleSync = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const result = await syncSocialAccounts({});
      const fresh = await getSocialAccounts(user.uid);
      setAccounts(fresh);
      toast.success(
        result.dryRun
          ? `Synced ${result.synced} accounts (sandbox mode)`
          : `Synced ${result.synced} connected accounts`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handlePreview = async () => {
    setGeneratingPreview(true);
    try {
      const result = await generatePreviewContent({
        brief,
        platform: previewPlatform,
        preset,
        tone,
        brandProfileId: brandProfileId || undefined,
      });
      setPreview(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preview generation failed");
    } finally {
      setGeneratingPreview(false);
    }
  };

  useEffect(() => {
    if (step === 4 && !preview && !generatingPreview && brief.trim()) {
      handlePreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, previewPlatform]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload = {
        name,
        brief,
        brandProfileId: brandProfileId || undefined,
        platforms: selectedPlatforms,
        socialAccountIds: selectedAccounts,
        contentTypes: { text: true, image: withImage, video: withVideo },
        preset,
        tone,
        schedule: {
          type: "recurring" as const,
          time,
          daysOfWeek: daysOfWeek.length ? daysOfWeek : undefined,
          timezone,
        },
        requiresApproval,
      };
      if (editId) {
        await updateAutomation({ ...payload, id: editId });
        toast.success("Automation updated");
      } else {
        await createAutomation(payload);
        toast.success("Automation is live", {
          description: `First post ${daysOfWeek.length ? "on the next selected day" : "tomorrow"} at ${time}`,
        });
      }
      navigate("/automations");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save automation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Stepper */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/automations")}
          className="mb-4 flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70"
        >
          <ArrowLeft className="h-4 w-4" /> Automations
        </button>
        <h1 className="text-2xl font-bold tracking-tight">
          {editId ? "Edit automation" : "New automation"}
        </h1>
        <div className="mt-5 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <button
                onClick={() => i < step && setStep(i)}
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  i < step
                    ? "bg-violet-600 text-white"
                    : i === step
                      ? "bg-violet-600/20 text-violet-300 ring-1 ring-violet-500/50"
                      : "bg-white/[0.06] text-white/40"
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </button>
              <span
                className={cn(
                  "hidden text-xs sm:block",
                  i === step ? "text-white" : "text-white/40"
                )}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-white/[0.08]" />}
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {/* Step 0 — Brief */}
          {step === 0 && (
            <div className="glass-card space-y-5 p-6">
              <div className="space-y-2">
                <Label>Automation name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Daily product tips"
                  className="bg-white/[0.04] border-white/10"
                />
              </div>
              <div className="space-y-2">
                <Label>Content brief</Label>
                <Textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={5}
                  placeholder="What should this automation post about? e.g. 'Share practical tips about supply-chain analytics for operations leaders, referencing trends in Indian manufacturing. Position Acme Analytics as the calm expert.'"
                  className="bg-white/[0.04] border-white/10"
                />
                <p className="text-xs text-white/35">
                  The engine writes a fresh post from this brief on every run — it never repeats itself.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Content style</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPreset(p.id)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        preset === p.id
                          ? "border-violet-500/60 bg-violet-600/10"
                          : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                      )}
                    >
                      <div className="text-sm font-medium">{p.label}</div>
                      <div className="text-xs text-white/40">{p.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tone (optional)</Label>
                  <Input
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    placeholder="confident, human, no fluff"
                    className="bg-white/[0.04] border-white/10"
                  />
                </div>
                {brands.length > 0 && (
                  <div className="space-y-2">
                    <Label>Brand kit</Label>
                    <select
                      value={brandProfileId}
                      onChange={(e) => setBrandProfileId(e.target.value)}
                      className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm"
                    >
                      <option value="">No brand kit</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 1 — Channels */}
          {step === 1 && (
            <div className="glass-card space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Where should this post?</h2>
                  <p className="text-xs text-white/40">
                    Pick the connected accounts this automation publishes to.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                  className="border-white/10 bg-white/[0.04]"
                >
                  {syncing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Sync accounts
                </Button>
              </div>
              {accounts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
                  <p className="text-sm text-white/50">No connected accounts yet.</p>
                  <p className="mt-1 text-xs text-white/35">
                    Hit “Sync accounts” to pull in the profiles linked for your workspace.
                  </p>
                </div>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {accounts.map((account) => {
                    const meta = PLATFORM_META[account.platform];
                    if (!meta) return null;
                    const selected = selectedAccounts.includes(account.id);
                    return (
                      <button
                        key={account.id}
                        onClick={() =>
                          setSelectedAccounts((prev) =>
                            selected
                              ? prev.filter((x) => x !== account.id)
                              : [...prev, account.id]
                          )
                        }
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
                          selected
                            ? "border-violet-500/60 bg-violet-600/10"
                            : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white",
                            meta.tint
                          )}
                        >
                          <meta.icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{meta.label}</div>
                          <div className="truncate text-xs text-white/40">
                            @{account.username || account.displayName}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border",
                            selected
                              ? "border-violet-500 bg-violet-600"
                              : "border-white/20"
                          )}
                        >
                          {selected && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Content types */}
          {step === 2 && (
            <div className="glass-card space-y-4 p-6">
              <h2 className="font-semibold">What should each post include?</h2>
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 opacity-70">
                  <Type className="h-5 w-5 text-violet-300" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Written post</div>
                    <div className="text-xs text-white/40">
                      Platform-native caption written fresh each run — always on
                    </div>
                  </div>
                  <Check className="h-4 w-4 text-violet-400" />
                </div>
                {[
                  {
                    on: withImage,
                    set: setWithImage,
                    icon: ImageIcon,
                    title: "AI image",
                    hint: "A scroll-stopping visual generated to match the post",
                  },
                  {
                    on: withVideo,
                    set: setWithVideo,
                    icon: Video,
                    title: "AI video",
                    hint: "Short vertical video — generated 2 hours ahead of post time",
                  },
                ].map(({ on, set, icon: Icon, title, hint }) => (
                  <button
                    key={title}
                    onClick={() => set(!on)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                      on
                        ? "border-violet-500/60 bg-violet-600/10"
                        : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                    )}
                  >
                    <Icon className={cn("h-5 w-5", on ? "text-violet-300" : "text-white/40")} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{title}</div>
                      <div className="text-xs text-white/40">{hint}</div>
                    </div>
                    <div
                      className={cn(
                        "h-5 w-9 rounded-full p-0.5 transition-colors",
                        on ? "bg-violet-600" : "bg-white/15"
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full bg-white transition-transform",
                          on && "translate-x-4"
                        )}
                      />
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setRequiresApproval(!requiresApproval)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                  requiresApproval
                    ? "border-emerald-500/50 bg-emerald-600/10"
                    : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                )}
              >
                <ShieldCheck
                  className={cn("h-5 w-5", requiresApproval ? "text-emerald-300" : "text-white/40")}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">Require approval before posting</div>
                  <div className="text-xs text-white/40">
                    Generated posts wait in your approval queue instead of publishing automatically
                  </div>
                </div>
                <div
                  className={cn(
                    "h-5 w-9 rounded-full p-0.5 transition-colors",
                    requiresApproval ? "bg-emerald-600" : "bg-white/15"
                  )}
                >
                  <div
                    className={cn(
                      "h-4 w-4 rounded-full bg-white transition-transform",
                      requiresApproval && "translate-x-4"
                    )}
                  />
                </div>
              </button>
            </div>
          )}

          {/* Step 3 — Schedule */}
          {step === 3 && (
            <div className="glass-card space-y-5 p-6">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-violet-300" />
                <h2 className="font-semibold">When should it post?</h2>
              </div>
              <div className="space-y-2">
                <Label>Time of day</Label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-40 bg-white/[0.04] border-white/10 [color-scheme:dark]"
                />
                <p className="text-xs text-white/35">Timezone: {timezone}</p>
              </div>
              <div className="space-y-2">
                <Label>Days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day, i) => {
                    const on = daysOfWeek.includes(i);
                    return (
                      <button
                        key={day}
                        onClick={() =>
                          setDaysOfWeek((prev) =>
                            on ? prev.filter((d) => d !== i) : [...prev, i].sort()
                          )
                        }
                        className={cn(
                          "h-10 w-12 rounded-lg border text-sm font-medium transition-colors",
                          on
                            ? "border-violet-500/60 bg-violet-600/20 text-violet-200"
                            : "border-white/[0.08] bg-white/[0.02] text-white/50 hover:bg-white/[0.05]"
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-white/35">
                  {daysOfWeek.length === 0
                    ? "No days selected — posts every day"
                    : `Posts on ${daysOfWeek.map((d) => DAYS[d]).join(", ")}`}
                </p>
              </div>
              <div className="rounded-xl border border-violet-500/20 bg-violet-600/[0.07] p-4 text-sm text-violet-200/90">
                “{name || "This automation"}” will post{" "}
                {daysOfWeek.length === 0 || daysOfWeek.length === 7
                  ? "daily"
                  : `every ${daysOfWeek.map((d) => DAYS[d]).join(", ")}`}{" "}
                at {time} ({timezone}). Content is generated ahead of time, so it lands on the dot.
              </div>
            </div>
          )}

          {/* Step 4 — Review */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="glass-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">Here's how it will look</h2>
                    <p className="text-xs text-white/40">
                      A sample generated from your brief — every run creates a fresh take.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreview}
                    disabled={generatingPreview}
                    className="border-white/10 bg-white/[0.04]"
                  >
                    {generatingPreview ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Regenerate
                  </Button>
                </div>
                {selectedPlatforms.length > 1 && (
                  <div className="mb-4 flex gap-2">
                    {selectedPlatforms.map((platform) => {
                      const meta = PLATFORM_META[platform];
                      return (
                        <button
                          key={platform}
                          onClick={() => {
                            setPreviewPlatform(platform);
                            setPreview(null);
                          }}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium",
                            previewPlatform === platform
                              ? "border-violet-500/60 bg-violet-600/15 text-violet-200"
                              : "border-white/[0.08] text-white/50"
                          )}
                        >
                          <meta.icon className="h-3.5 w-3.5" /> {meta.label}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex justify-center py-2">
                  {generatingPreview ? (
                    <div className="flex h-72 flex-col items-center justify-center gap-3 text-white/40">
                      <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                      <span className="text-sm">Writing your sample post…</span>
                    </div>
                  ) : preview ? (
                    <PlatformPreview
                      platform={previewPlatform}
                      content={{
                        caption: preview.caption,
                        hashtags: preview.hashtags,
                        brandName: brand?.name ?? name,
                        handle: brand?.name?.toLowerCase().replace(/\s+/g, "") ?? undefined,
                        logoUrl: brand?.logoUrl,
                      }}
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center text-sm text-white/35">
                      Preview unavailable — you can still launch the automation.
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card space-y-2 p-5 text-sm">
                {[
                  ["Brief", brief.slice(0, 120) + (brief.length > 120 ? "…" : "")],
                  [
                    "Channels",
                    selectedPlatforms.map((p) => PLATFORM_META[p].label).join(", ") || "—",
                  ],
                  [
                    "Includes",
                    ["post copy", withImage && "AI image", withVideo && "AI video"]
                      .filter(Boolean)
                      .join(" + "),
                  ],
                  [
                    "Schedule",
                    `${daysOfWeek.length === 0 || daysOfWeek.length === 7 ? "Daily" : daysOfWeek.map((d) => DAYS[d]).join(", ")} at ${time} (${timezone})`,
                  ],
                  ["Approval", requiresApproval ? "Manual approval required" : "Fully automatic"],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex gap-4">
                    <span className="w-24 shrink-0 text-white/40">{k}</span>
                    <span className="text-white/85">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer nav */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => (step === 0 ? navigate("/automations") : setStep(step - 1))}
          className="text-white/50 hover:text-white"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {step === 0 ? "Cancel" : "Back"}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canNext}
            className="bg-violet-600 hover:bg-violet-500"
          >
            Continue <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-violet-600 hover:bg-violet-500"
          >
            {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {editId ? "Save changes" : "Launch automation"}
          </Button>
        )}
      </div>
    </div>
  );
}
