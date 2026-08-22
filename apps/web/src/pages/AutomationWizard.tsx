import { useEffect, useMemo, useState } from"react";
import { useNavigate, useParams } from"react-router-dom";
import { motion, AnimatePresence } from"framer-motion";
import { toast } from"sonner";
import { useMutation, useQuery } from"convex/react";
import { useAuth } from"@shared/lib/auth";
import type { SocialAccount, SocialPlatform, BrandProfile } from"@shared/types";
import {
 getSocialAccounts,
 getBrandProfiles,
 getAutomation,
} from"@shared/lib/automations";
import {
 createAutomation,
 updateAutomation,
 generatePreviewContent,
} from"@shared/lib/suite";
import { Button } from"@shared/components/ui/button";
import { Input } from"@shared/components/ui/input";
import { Textarea } from"@shared/components/ui/textarea";
import { Label } from"@shared/components/ui/label";
import { cn } from"@shared/lib/utils";
import { captureEvent } from"@shared/lib/analytics";
import { api } from"@convex/_generated/api";
import { isConvexConfigured } from"../lib/convex";
import {
 AUTOMATION_STEPS as STEPS,
 automationDraftKey,
 clearAutomationDraft,
 readAutomationDraft,
 writePersisted,
} from"../lib/drafts";
import PlatformPreview from "../components/previews/PlatformPreview";
import CreativeImageLoader from "../components/common/CreativeImageLoader";
import {
 ArrowLeft,
 ArrowRight,
 CalendarClock,
 Check,
 Globe2,
 Image as ImageIcon,
 Instagram,
 Linkedin,
 Loader2,
 Plus,
 ShieldCheck,
 Sparkles,
 Twitter,
 MessageCircle,
 Type,
 Video,
 Youtube,
} from"lucide-react";

const PLATFORM_META: Record<
 SocialPlatform,
 { label: string; icon: typeof Instagram; tint: string }
> = {
 instagram: { label:"Instagram", icon: Instagram, tint:"from-pink-500 to-orange-400" },
 twitter: { label:"Twitter / X", icon: Twitter, tint:"from-sky-400 to-blue-500" },
 linkedin: { label:"LinkedIn", icon: Linkedin, tint:"from-blue-500 to-cyan-500" },
 youtube: { label:"YouTube", icon: Youtube, tint:"from-red-500 to-rose-500" },
 facebook: { label:"Facebook", icon: Globe2, tint:"from-blue-600 to-blue-400" },
 whatsapp: { label:"WhatsApp", icon: MessageCircle, tint:"from-emerald-500 to-green-400" },
 reddit: { label:"Reddit", icon: MessageCircle, tint:"from-orange-500 to-amber-500" },
};

const PRESETS = [
 { id:"announcement", label:"Announcement", hint:"Product news framed around customer outcomes" },
 { id:"educational", label:"Educational", hint:"Teach one useful thing, build authority" },
 { id:"promo", label:"Promotional", hint:"Sell the transformation with one clear CTA" },
 { id:"story", label:"Story", hint:"Narrative arc ending in a lesson" },
 { id:"custom", label:"Custom", hint:"Follow the brief's own framing" },
] as const;

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function AutomationWizard() {
 const { user } = useAuth();
 const navigate = useNavigate();
 const { id: editId } = useParams<{ id: string }>();

 const [step, setStep] = useState(0);
 const [loading, setLoading] = useState(false);
 const [legacyAccounts, setLegacyAccounts] = useState<SocialAccount[]>([]);
 const [brands, setBrands] = useState<BrandProfile[]>([]);

 const convexAccounts = useQuery(api.social.accounts, isConvexConfigured ? {} :"skip");
 const convexEdit = useQuery(
  api.automations.get,
  isConvexConfigured && editId ? { automationId: editId } : "skip",
 );
 const createConvex = useMutation(api.automations.create);
 const updateConvex = useMutation(api.automations.update);

 const accounts: SocialAccount[] = useMemo(() => {
   if (isConvexConfigured) {
     return (convexAccounts ?? [])
       .filter((a: any) => a.status === "active" || a.status === "expired")
       .map((a: any) => ({
         id: String(a._id),
         userId: String(a.userId ?? ""),
         provider: a.platform as SocialAccount["provider"],
         platform: a.platform as SocialPlatform,
         externalId: String(a.externalId ?? ""),
         username: String(a.username ?? ""),
         displayName: String(a.displayName ?? a.username ?? a.platform),
         avatarUrl: a.avatarUrl,
         status: a.status as SocialAccount["status"],
         linkedAt: new Date(a.linkedAt ?? Date.now()),
       }));
   }
   return legacyAccounts.filter((a) => a.status === "active" || a.status === "expired");
 }, [convexAccounts, legacyAccounts]);

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
 // Cache a generated sample per platform so switching channels is instant and
 // connected channels can be generated together in the background.
 const [previews, setPreviews] = useState<
 Partial<Record<SocialPlatform, { caption: string; hashtags: string[] }>>
 >({});
 const [generatingPlatforms, setGeneratingPlatforms] = useState<Set<SocialPlatform>>(new Set());

 useEffect(() => {
 if (!user) return;
 getSocialAccounts(user.uid).then(setLegacyAccounts).catch(() => {});
 getBrandProfiles(user.uid).then(setBrands).catch(() => {});
 }, [user]);

 useEffect(() => {
 if (!editId) return;
 if (isConvexConfigured && convexEdit === undefined) return;
 if (convexEdit) {
 setName(convexEdit.name);
 setBrief(convexEdit.brief);
 setPreset(convexEdit.preset);
 setTone(convexEdit.tone ?? "");
 setBrandProfileId(convexEdit.brandProfileId ?? "");
 setSelectedAccounts(convexEdit.socialAccountIds);
 setWithImage(convexEdit.contentTypes.image);
 setWithVideo(convexEdit.contentTypes.video);
 setRequiresApproval(convexEdit.requiresApproval);
 setTime(convexEdit.schedule.time);
 setDaysOfWeek(convexEdit.schedule.daysOfWeek ?? []);
 return;
 }
 getAutomation(editId).then((automation) => {
 if (!automation) return;
 setName(automation.name);
 setBrief(automation.brief);
 setPreset(automation.preset);
 setTone(automation.tone);
 setBrandProfileId(automation.brandProfileId ??"");
 setSelectedAccounts(automation.socialAccountIds);
 setWithImage(automation.contentTypes.image);
 setWithVideo(automation.contentTypes.video);
 setRequiresApproval(automation.requiresApproval);
 setTime(automation.schedule.time);
 setDaysOfWeek(automation.schedule.daysOfWeek ?? []);
 });
 }, [editId, convexEdit]);

 // Pick up an unfinished draft (the Drafts section on /automations links here).
 // Editing an existing automation reads from Firestore instead.
 const [hydrated, setHydrated] = useState(false);
 useEffect(() => {
 const draft = editId || !user ? null : readAutomationDraft(user.uid);
 if (draft) {
 setStep(draft.step);
 setName(draft.name);
 setBrief(draft.brief);
 setPreset(draft.preset);
 setTone(draft.tone);
 setBrandProfileId(draft.brandProfileId);
 setSelectedAccounts(draft.selectedAccounts);
 setWithImage(draft.withImage);
 setWithVideo(draft.withVideo);
 setRequiresApproval(draft.requiresApproval);
 setTime(draft.time);
 setDaysOfWeek(draft.daysOfWeek);
 }
 setHydrated(true);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 // Save on every change so closing the tab mid-wizard keeps the progress.
 // `readAutomationDraft` treats an empty name and brief as "no draft".
 useEffect(() => {
 if (!hydrated || editId || !user) return;
 writePersisted(automationDraftKey(user.uid), {
 step,
 name,
 brief,
 preset,
 tone,
 brandProfileId,
 selectedAccounts,
 withImage,
 withVideo,
 requiresApproval,
 time,
 daysOfWeek,
 updatedAt: Date.now(),
 });
 }, [
 hydrated,
 editId,
 user,
 step,
 name,
 brief,
 preset,
 tone,
 brandProfileId,
 selectedAccounts,
 withImage,
 withVideo,
 requiresApproval,
 time,
 daysOfWeek,
 ]);

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

 useEffect(() => {
 if (!editId) captureEvent("automation_wizard_started", { source: "web" });
 }, [editId]);

 const canNext = [
 name.trim().length > 0 && brief.trim().length > 10,
 selectedAccounts.length > 0,
 true,
 /^\d{2}:\d{2}$/.test(time),
 true,
 ][step];

 const currentPreview = previews[previewPlatform] ?? null;
 const isGeneratingCurrent = generatingPlatforms.has(previewPlatform);
 const generatingPreview = generatingPlatforms.size > 0;

 const generateForPlatform = async (
 platform: SocialPlatform,
 opts?: { force?: boolean },
 ) => {
 if (!brief.trim()) return;
 // Skip if we already have it (unless forcing) or it's already generating.
 if (!opts?.force && previews[platform]) return;
 if (generatingPlatforms.has(platform)) return;

 setGeneratingPlatforms((prev) => {
 const next = new Set(prev);
 next.add(platform);
 return next;
 });
 try {
 const result = await generatePreviewContent({
 brief,
 platform,
 preset,
 tone,
 brandProfileId: brandProfileId || undefined,
 });
 setPreviews((prev) => ({ ...prev, [platform]: result }));
 } catch (error) {
 // Only surface the error for the channel the user is currently viewing so
 // background channels don't spam toasts.
 if (platform === previewPlatform) {
 toast.error(error instanceof Error ? error.message : "Preview generation failed");
 }
 } finally {
 setGeneratingPlatforms((prev) => {
 const next = new Set(prev);
 next.delete(platform);
 return next;
 });
 }
 };

 // Generate the visible channel plus every other connected channel in the
 // background. `force` regenerates all of them from scratch.
 const generateAllPlatforms = (force = false) => {
 const targets = selectedPlatforms.length ? selectedPlatforms : [previewPlatform];
 // Prioritize the channel currently in view, then the rest in the background.
 const ordered = [
 previewPlatform,
 ...targets.filter((p) => p !== previewPlatform),
 ].filter((p, i, arr) => arr.indexOf(p) === i);
 if (force) setPreviews({});
 for (const platform of ordered) {
 void generateForPlatform(platform, { force });
 }
 };

 const handlePreview = () => generateAllPlatforms(true);

 useEffect(() => {
 if (step !== 4 || !brief.trim()) return;
 generateAllPlatforms(false);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [step, selectedPlatforms]);

 const handleSave = async () => {
 setLoading(true);
 try {
 if (isConvexConfigured && editId && convexEdit === undefined) {
  throw new Error("Still loading this automation");
 }
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
 type:"recurring" as const,
 time,
 daysOfWeek: daysOfWeek.length ? daysOfWeek : undefined,
 timezone,
 },
 requiresApproval,
 };
 const useConvex =
  isConvexConfigured && (!editId || !!convexEdit);
 if (useConvex) {
  if (editId) {
   await updateConvex({ automationId: editId, ...payload });
   toast.success("Automation updated");
  } else {
   await createConvex(payload);
   if (user) clearAutomationDraft(user.uid);
   captureEvent("automation_created", {
    platforms: selectedPlatforms.join(","),
    requires_approval: requiresApproval,
   });
   toast.success("Automation is live", {
    description: `First post ${daysOfWeek.length ?"on the next selected day" :"tomorrow"} at ${time}`,
   });
  }
 } else if (editId) {
  await updateAutomation({ ...payload, id: editId });
  toast.success("Automation updated");
 } else {
  await createAutomation(payload);
  if (user) clearAutomationDraft(user.uid);
  captureEvent("automation_created", {
   platforms: selectedPlatforms.join(","),
   requires_approval: requiresApproval,
  });
  toast.success("Automation is live", {
   description: `First post ${daysOfWeek.length ?"on the next selected day" :"tomorrow"} at ${time}`,
  });
 }
 navigate("/automations");
 } catch (error) {
 toast.error(error instanceof Error ? error.message :"Could not save automation");
 } finally {
 setLoading(false);
 }
 };

  return (
    <div className={cn("mx-auto py-8 px-4", step === 4 ? "max-w-6xl" : "max-w-2xl")}>
      <button
        onClick={() => navigate("/automations")}
        className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Automations
      </button>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col min-h-[600px]">
        {/* Wizard Header */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-foreground text-sm">{STEPS[step]}</span>
            <span className="text-sm text-muted-foreground font-medium">
              {step + 1} / {STEPS.length}
            </span>
          </div>
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-brand transition-all duration-300 ease-in-out rounded-full"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="h-px w-full bg-border" />

        {/* Wizard Body */}
        <div className="flex-1 p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              {/* Step 0 — Brief */}
              {step === 0 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">What's this campaign about?</h2>
                    <p className="text-sm text-muted-foreground">
                      Set up the foundation for your automation. The engine writes a fresh post from this brief on every run.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Automation name (Optional)</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Daily product tips"
                        className="bg-secondary/50 border-border h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Content brief</Label>
                      <Textarea
                        value={brief}
                        onChange={(e) => setBrief(e.target.value)}
                        rows={5}
                        placeholder="What should this automation post about? e.g. 'Share practical tips about supply-chain analytics for operations leaders...'"
                        className="bg-secondary/50 border-border resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Content Style</Label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {PRESETS.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setPreset(p.id)}
                            className={cn(
                              "rounded-xl border p-4 text-left transition-all",
                              preset === p.id
                                ? "border-brand bg-brand/5 ring-1 ring-brand/20 shadow-sm"
                                : "border-border bg-secondary/30 hover:bg-secondary/80"
                            )}
                          >
                            <div className="text-sm font-semibold text-foreground mb-1">{p.label}</div>
                            <div className="text-xs text-muted-foreground leading-relaxed">{p.hint}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 pt-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tone (Optional)</Label>
                        <Input
                          value={tone}
                          onChange={(e) => setTone(e.target.value)}
                          placeholder="confident, human, no fluff"
                          className="bg-secondary/50 border-border h-11"
                        />
                      </div>
                      {brands.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Brand kit</Label>
                          <select
                            value={brandProfileId}
                            onChange={(e) => setBrandProfileId(e.target.value)}
                            className="h-11 w-full rounded-md border border-border bg-secondary/50 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
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
                </div>
              )}

              {/* Step 1 — Channels */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Where should we post?</h2>
                    <p className="text-sm text-muted-foreground">
                      Pick one or more connected accounts. You can mix your own connected accounts and warmed accounts.
                    </p>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/settings")}
                      className="text-xs font-medium h-9"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Connect an account
                    </Button>
                  </div>

                  {accounts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-12 text-center bg-secondary/20">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary mb-4">
                         <Globe2 className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground mb-1">No accounts connected yet</h3>
                      <p className="text-xs text-muted-foreground mb-6 max-w-sm mx-auto">
                        To run an automation, connect your social accounts in Settings first.
                      </p>
                      <Button onClick={() => navigate("/settings")} className="bg-brand hover:bg-brand/90 text-brand-foreground">
                         Connect an account
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
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
                              "flex items-center gap-4 rounded-xl border p-4 text-left transition-all",
                              selected
                                ? "border-brand bg-brand/5 ring-1 ring-brand/20 shadow-sm"
                                : "border-border bg-secondary/30 hover:bg-secondary/80"
                            )}
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                              <meta.icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-foreground">{meta.label}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                @{account.username || account.displayName}
                              </div>
                            </div>
                            <div
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                                selected
                                  ? "border-brand bg-brand text-brand-foreground"
                                  : "border-muted-foreground/30"
                              )}
                            >
                              {selected && <Check className="h-3.5 w-3.5" />}
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
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">What should each post include?</h2>
                    <p className="text-sm text-muted-foreground">
                      Choose the types of media to generate alongside your text captions.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-4 rounded-xl border border-border bg-secondary/20 p-4 opacity-70">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                        <Type className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-foreground">Written post</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Platform-native caption written fresh each run — always on
                        </div>
                      </div>
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-brand bg-brand text-brand-foreground">
                         <Check className="h-3.5 w-3.5" />
                      </div>
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
                          "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all",
                          on
                            ? "border-brand bg-brand/5 ring-1 ring-brand/20 shadow-sm"
                            : "border-border bg-secondary/30 hover:bg-secondary/80"
                        )}
                      >
                        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", on ? "bg-brand/10 text-brand" : "bg-secondary text-muted-foreground")}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-foreground">{title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
                        </div>
                        <div
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                            on
                              ? "border-brand bg-brand text-brand-foreground"
                              : "border-muted-foreground/30"
                          )}
                        >
                          {on && <Check className="h-3.5 w-3.5" />}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-border">
                    <button
                      onClick={() => setRequiresApproval(!requiresApproval)}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all",
                        requiresApproval
                          ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20 shadow-sm"
                          : "border-border bg-secondary/30 hover:bg-secondary/80"
                      )}
                    >
                      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", requiresApproval ? "bg-emerald-500/10 text-emerald-600" : "bg-secondary text-muted-foreground")}>
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-foreground">Require approval before posting</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Generated posts wait in your approval queue instead of publishing automatically
                        </div>
                      </div>
                      <div
                        className={cn(
                          "h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
                          requiresApproval ? "bg-emerald-500" : "bg-secondary border border-border"
                        )}
                      >
                        <div
                          className={cn(
                            "h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
                            requiresApproval && "translate-x-4"
                          )}
                        />
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 — Schedule */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">How often, and for how long?</h2>
                    <p className="text-sm text-muted-foreground">
                      Set up your posting cadence and schedule window.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between py-2 border-b border-border pb-6">
                       <div>
                         <div className="text-sm font-semibold text-foreground mb-1">Time of day</div>
                         <div className="text-xs text-muted-foreground">Timezone: {timezone}</div>
                       </div>
                       <Input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-32 bg-secondary/50 border-border font-medium h-10 [color-scheme:dark]"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-foreground">Posting Days</div>
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
                                "h-11 w-14 rounded-lg border text-sm font-semibold transition-all",
                                on
                                  ? "border-brand bg-brand/10 text-brand shadow-sm"
                                  : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary/80"
                              )}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {daysOfWeek.length === 0
                          ? "No days selected — posts every day."
                          : `Posts on ${daysOfWeek.map((d) => DAYS[d]).join(", ")}.`}
                      </p>
                    </div>

                    <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm text-brand/90 leading-relaxed shadow-sm">
                      <span className="font-semibold">Schedule Summary:</span><br/>
                      This automation will post {daysOfWeek.length === 0 || daysOfWeek.length === 7 ? "daily" : `every ${daysOfWeek.map((d) => DAYS[d]).join(", ")}`} at {time}. Content is generated ahead of time so it launches seamlessly.
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4 — Review */}
              {step === 4 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Review your campaign</h2>
                    <p className="text-sm text-muted-foreground">
                      Check your configuration and see a sample of what the automation will generate.
                    </p>
                  </div>

                  {/* This screen only: details on the left, live preview on the right */}
                  <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
                    {/* LEFT: campaign summary + sample generation controls */}
                    <div className="space-y-6">
                      <div className="rounded-xl border border-border bg-secondary/20 p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-border/50 pb-4">
                           <div>
                             <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Campaign Summary</div>
                             <div className="text-sm font-medium text-foreground">{name || "Untitled Automation"}</div>
                           </div>
                           <div className="text-right">
                             <div className="text-sm font-medium text-foreground">{selectedAccounts.length} Account(s)</div>
                             <div className="text-xs text-muted-foreground">{daysOfWeek.length === 0 || daysOfWeek.length === 7 ? "Daily" : `${daysOfWeek.length} days/week`} at {time}</div>
                           </div>
                        </div>
                        <div className="text-sm text-foreground leading-relaxed">
                           <span className="font-semibold">Brief:</span> {brief}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-foreground">Sample Generation</h3>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePreview}
                            disabled={generatingPreview}
                            className="h-8 px-3 text-xs"
                          >
                            {generatingPreview ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-brand" />
                            )}
                            Regenerate
                          </Button>
                        </div>

                        {selectedPlatforms.length > 1 && (
                          <div className="flex flex-wrap gap-2">
                            {selectedPlatforms.map((platform) => {
                              const meta = PLATFORM_META[platform];
                              const loadingThis = generatingPlatforms.has(platform);
                              return (
                                <button
                                  key={platform}
                                  onClick={() => {
                                    setPreviewPlatform(platform);
                                    void generateForPlatform(platform);
                                  }}
                                  className={cn(
                                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                                    previewPlatform === platform
                                      ? "border-brand bg-brand/10 text-brand"
                                      : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary/80"
                                  )}
                                >
                                  {loadingThis ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <meta.icon className="h-3.5 w-3.5" />
                                  )}
                                  {meta.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT: live preview */}
                    <div className="flex items-center justify-center rounded-xl border border-border bg-secondary/10 p-6 min-h-[420px] lg:h-full">
                      {isGeneratingCurrent ? (
                        <CreativeImageLoader
                          aspectRatio="4:5"
                          title="Writing sample post..."
                          subtitle="Shaping copy & visual creative to your brand voice"
                          className="max-w-sm w-full"
                        />
                      ) : currentPreview ? (
                        <PlatformPreview
                          platform={previewPlatform}
                          content={{
                            caption: currentPreview.caption,
                            hashtags: currentPreview.hashtags,
                            brandName: brand?.name ?? name,
                            handle: brand?.name?.toLowerCase().replace(/\s+/g, "") ?? undefined,
                            logoUrl: brand?.logoUrl,
                          }}
                        />
                      ) : (
                        <div className="flex h-full min-h-[250px] items-center justify-center text-sm text-muted-foreground">
                          Preview unavailable — you can still launch the automation.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="h-px w-full bg-border" />

        {/* Wizard Footer */}
        <div className="px-8 py-5 bg-card flex items-center justify-between rounded-b-xl">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? navigate("/automations") : setStep(step - 1))}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary/50 px-4 h-11"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {step === 0 ? "Cancel" : "Back"}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canNext}
              className="bg-brand hover:bg-brand/90 text-brand-foreground px-6 h-11 font-semibold shadow-sm transition-all active:scale-[0.98]"
            >
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={loading || !canNext}
              className="bg-brand hover:bg-brand/90 text-brand-foreground px-6 h-11 font-semibold shadow-sm transition-all active:scale-[0.98]"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editId ? "Save changes" : "Continue to launch"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
