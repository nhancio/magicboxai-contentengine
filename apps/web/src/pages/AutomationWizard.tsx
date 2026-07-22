import { useEffect, useMemo, useState } from"react";
import { useNavigate, useParams } from"react-router-dom";
import { motion, AnimatePresence } from"framer-motion";
import { toast } from"sonner";
import { useQuery } from"convex/react";
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
import { api } from"@convex/_generated/api";
import { isConvexConfigured } from"../lib/convex";
import PlatformPreview from"../components/previews/PlatformPreview";
import {
 ArrowLeft,
 ArrowRight,
 CalendarClock,
 Check,
 Image as ImageIcon,
 Instagram,
 Linkedin,
 Loader2,
 Plus,
 ShieldCheck,
 Sparkles,
 Twitter,
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
};

const PRESETS = [
 { id:"announcement", label:"Announcement", hint:"Product news framed around customer outcomes" },
 { id:"educational", label:"Educational", hint:"Teach one useful thing, build authority" },
 { id:"promo", label:"Promotional", hint:"Sell the transformation with one clear CTA" },
 { id:"story", label:"Story", hint:"Narrative arc ending in a lesson" },
 { id:"custom", label:"Custom", hint:"Follow the brief's own framing" },
] as const;

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const STEPS = ["Brief","Channels","Content","Schedule","Review"] as const;

export default function AutomationWizard() {
 const { user } = useAuth();
 const navigate = useNavigate();
 const { id: editId } = useParams<{ id: string }>();

 const [step, setStep] = useState(0);
 const [loading, setLoading] = useState(false);
 const [legacyAccounts, setLegacyAccounts] = useState<SocialAccount[]>([]);
 const [brands, setBrands] = useState<BrandProfile[]>([]);

 const convexAccounts = useQuery(api.social.accounts, isConvexConfigured ? {} :"skip");

 const accounts: SocialAccount[] = useMemo(() => {
 const fromConvex: SocialAccount[] = (convexAccounts ?? [])
 .filter((a: any) => a.status ==="active"|| a.status ==="expired")
 .map((a: any) => ({
 id: String(a._id),
 userId: String(a.userId ??""),
 provider: a.platform as SocialAccount["provider"],
 platform: a.platform as SocialPlatform,
 externalId: String(a.externalId ??""),
 username: String(a.username ??""),
 displayName: String(a.displayName ?? a.username ?? a.platform),
 avatarUrl: a.avatarUrl,
 status: a.status as SocialAccount["status"],
 linkedAt: new Date(a.linkedAt ?? Date.now()),
 }));
 const seen = new Set(
 fromConvex.map((a) => `${a.platform}:${(a.username || a.displayName).toLowerCase()}`),
 );
 const fromLegacy = legacyAccounts.filter(
 (a) => !seen.has(`${a.platform}:${(a.username || a.displayName).toLowerCase()}`),
 );
 return [...fromConvex, ...fromLegacy];
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
 const [preview, setPreview] = useState<{ caption: string; hashtags: string[] } | null>(null);
 const [generatingPreview, setGeneratingPreview] = useState(false);

 useEffect(() => {
 if (!user) return;
 getSocialAccounts(user.uid).then(setLegacyAccounts).catch(() => {});
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
 setBrandProfileId(automation.brandProfileId ??"");
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
 toast.error(error instanceof Error ? error.message :"Preview generation failed");
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
 type:"recurring" as const,
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
 <div className="mx-auto max-w-3xl">
 {/* Stepper */}
 <div className="mb-8">
 <button
 onClick={() => navigate("/automations")}
 className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
 >
 <ArrowLeft className="h-4 w-4" /> Automations
 </button>
 <h1 className="font-display text-4xl leading-none text-foreground">
 {editId ?"Edit automation" :"New automation"}
 </h1>
 <div className="mt-5 flex items-center gap-2">
 {STEPS.map((label, i) => (
 <div key={label} className="flex flex-1 items-center gap-2">
 <button
 onClick={() => i < step && setStep(i)}
 className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
 i < step
 ?"bg-brand text-brand-foreground"
 : i === step
 ?"bg-brand/10 text-brand ring-1 ring-brand/30"
 :"bg-secondary text-muted-foreground"
 )}
 >
 {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
 </button>
 <span
 className={cn("hidden text-xs sm:block",
 i === step ?"text-foreground" :"text-muted-foreground"
 )}
 >
 {label}
 </span>
 {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
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
 className="bg-secondary border-border"
 />
 </div>
 <div className="space-y-2">
 <Label>Content brief</Label>
 <Textarea
 value={brief}
 onChange={(e) => setBrief(e.target.value)}
 rows={5}
 placeholder="What should this automation post about? e.g. 'Share practical tips about supply-chain analytics for operations leaders, referencing trends in Indian manufacturing. Position Acme Analytics as the calm expert.'"
 className="bg-secondary border-border"
 />
 <p className="text-xs text-muted-foreground">
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
 className={cn("rounded-lg border p-3 text-left transition-colors",
 preset === p.id
 ?"border-brand/50 bg-brand/10"
 :"border-border bg-secondary hover:bg-accent"
 )}
 >
 <div className="text-sm font-medium text-foreground">{p.label}</div>
 <div className="text-xs text-muted-foreground">{p.hint}</div>
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
 className="bg-secondary border-border"
 />
 </div>
 {brands.length > 0 && (
 <div className="space-y-2">
 <Label>Brand kit</Label>
 <select
 value={brandProfileId}
 onChange={(e) => setBrandProfileId(e.target.value)}
 className="h-10 w-full rounded-md border border-border bg-secondary px-3 text-sm"
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
 <p className="text-xs text-muted-foreground">
 Pick the connected accounts this automation publishes to.
 </p>
 </div>
 <Button
 variant="outline"
 size="sm"
 onClick={() => navigate("/settings")}
 >
 <Plus className="mr-1.5 h-3.5 w-3.5" />
 Connect channels
 </Button>
 </div>
 {accounts.length === 0 ? (
 <div className="rounded-lg border border-dashed border-border p-8 text-center">
 <p className="text-sm text-muted-foreground">No connected accounts yet.</p>
 <p className="mt-1 text-xs text-muted-foreground">
 Connect YouTube, LinkedIn, or Instagram in Settings, then come back to pick them here.
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
 className={cn("flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
 selected
 ?"border-brand/50 bg-brand/10"
 :"border-border bg-secondary hover:bg-accent"
 )}
 >
 <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background">
 <meta.icon className="h-5 w-5" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="truncate text-sm font-medium text-foreground">{meta.label}</div>
 <div className="truncate text-xs text-muted-foreground">
 @{account.username || account.displayName}
 </div>
 </div>
 <div
 className={cn("flex h-5 w-5 items-center justify-center rounded-full border",
 selected
 ?"border-brand bg-brand"
 :"border-foreground/20"
 )}
 >
 {selected && <Check className="h-3 w-3 text-brand-foreground" />}
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
 <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary p-4 opacity-70">
 <Type className="h-5 w-5 text-brand" />
 <div className="flex-1">
 <div className="text-sm font-medium text-foreground">Written post</div>
 <div className="text-xs text-muted-foreground">
 Platform-native caption written fresh each run — always on
 </div>
 </div>
 <Check className="h-4 w-4 text-brand" />
 </div>
 {[
 {
 on: withImage,
 set: setWithImage,
 icon: ImageIcon,
 title:"AI image",
 hint:"A scroll-stopping visual generated to match the post",
 },
 {
 on: withVideo,
 set: setWithVideo,
 icon: Video,
 title:"AI video",
 hint:"Short vertical video — generated 2 hours ahead of post time",
 },
 ].map(({ on, set, icon: Icon, title, hint }) => (
 <button
 key={title}
 onClick={() => set(!on)}
 className={cn("flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors",
 on
 ?"border-brand/50 bg-brand/10"
 :"border-border bg-secondary hover:bg-accent"
 )}
 >
 <Icon className={cn("h-5 w-5", on ?"text-brand" :"text-muted-foreground")} />
 <div className="flex-1">
 <div className="text-sm font-medium text-foreground">{title}</div>
 <div className="text-xs text-muted-foreground">{hint}</div>
 </div>
 <div
 className={cn("h-5 w-9 rounded-full p-0.5 transition-colors",
 on ?"bg-brand" :"bg-muted-foreground/40"
 )}
 >
 <div
 className={cn("h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
 on &&"translate-x-4"
 )}
 />
 </div>
 </button>
 ))}
 </div>

 <button
 onClick={() => setRequiresApproval(!requiresApproval)}
 className={cn("flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors",
 requiresApproval
 ?"border-emerald-500/50 bg-emerald-600/10"
 :"border-border bg-secondary hover:bg-accent"
 )}
 >
 <ShieldCheck
 className={cn("h-5 w-5", requiresApproval ?"text-emerald-300" :"text-muted-foreground")}
 />
 <div className="flex-1">
 <div className="text-sm font-medium">Require approval before posting</div>
 <div className="text-xs text-muted-foreground">
 Generated posts wait in your approval queue instead of publishing automatically
 </div>
 </div>
 <div
 className={cn("h-5 w-9 rounded-full p-0.5 transition-colors",
 requiresApproval ?"bg-emerald-600" :"bg-accent"
 )}
 >
 <div
 className={cn("h-4 w-4 rounded-full bg-card transition-transform",
 requiresApproval &&"translate-x-4"
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
 <CalendarClock className="h-5 w-5 text-brand" />
 <h2 className="font-semibold">When should it post?</h2>
 </div>
 <div className="space-y-2">
 <Label>Time of day</Label>
 <Input
 type="time"
 value={time}
 onChange={(e) => setTime(e.target.value)}
 className="w-40 bg-card/[0.04] border-border [color-scheme:dark]"
 />
 <p className="text-xs text-muted-foreground">Timezone: {timezone}</p>
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
 className={cn("h-10 w-12 rounded-lg border text-sm font-medium transition-colors",
 on
 ?"border-brand/60 bg-brand/20 text-brand"
 :"border-border/[0.08] bg-card/[0.02] text-muted-foreground hover:bg-card/[0.05]"
 )}
 >
 {day}
 </button>
 );
 })}
 </div>
 <p className="text-xs text-muted-foreground">
 {daysOfWeek.length === 0
 ?"No days selected — posts every day"
 : `Posts on ${daysOfWeek.map((d) => DAYS[d]).join(",")}`}
 </p>
 </div>
 <div className="rounded-xl border border-brand/20 bg-brand/[0.07] p-4 text-sm text-brand/90">
 “{name ||"This automation"}” will post{""}
 {daysOfWeek.length === 0 || daysOfWeek.length === 7
 ?"daily"
 : `every ${daysOfWeek.map((d) => DAYS[d]).join(",")}`}{""}
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
 <p className="text-xs text-muted-foreground">
 A sample generated from your brief — every run creates a fresh take.
 </p>
 </div>
 <Button
 variant="outline"
 size="sm"
 onClick={handlePreview}
 disabled={generatingPreview}
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
 className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium",
 previewPlatform === platform
 ?"border-brand/60 bg-brand/15 text-brand"
 :"border-border/[0.08] text-muted-foreground"
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
 <div className="flex h-72 flex-col items-center justify-center gap-3 text-muted-foreground">
 <Loader2 className="h-6 w-6 animate-spin text-brand" />
 <span className="text-sm">Writing your sample post…</span>
 </div>
 ) : preview ? (
 <PlatformPreview
 platform={previewPlatform}
 content={{
 caption: preview.caption,
 hashtags: preview.hashtags,
 brandName: brand?.name ?? name,
 handle: brand?.name?.toLowerCase().replace(/\s+/g,"") ?? undefined,
 logoUrl: brand?.logoUrl,
 }}
 />
 ) : (
 <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
 Preview unavailable — you can still launch the automation.
 </div>
 )}
 </div>
 </div>

 <div className="glass-card space-y-2 p-5 text-sm">
 {[
 ["Brief", brief.slice(0, 120) + (brief.length > 120 ?"…" :"")],
 ["Channels",
 selectedPlatforms.map((p) => PLATFORM_META[p].label).join(",") ||"—",
 ],
 ["Includes",
 ["post copy", withImage &&"AI image", withVideo &&"AI video"]
 .filter(Boolean)
 .join(" +"),
 ],
 ["Schedule",
 `${daysOfWeek.length === 0 || daysOfWeek.length === 7 ?"Daily" : daysOfWeek.map((d) => DAYS[d]).join(",")} at ${time} (${timezone})`,
 ],
 ["Approval", requiresApproval ?"Manual approval required" :"Fully automatic"],
 ].map(([k, v]) => (
 <div key={k as string} className="flex gap-4">
 <span className="w-24 shrink-0 text-muted-foreground">{k}</span>
 <span className="text-foreground">{v}</span>
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
 className="text-muted-foreground hover:text-foreground"
 >
 <ArrowLeft className="mr-1.5 h-4 w-4" />
 {step === 0 ?"Cancel" :"Back"}
 </Button>
 {step < STEPS.length - 1 ? (
 <Button
 onClick={() => setStep(step + 1)}
 disabled={!canNext}
 className="bg-brand hover:bg-brand"
 >
 Continue <ArrowRight className="ml-1.5 h-4 w-4" />
 </Button>
 ) : (
 <Button
 onClick={handleSave}
 disabled={loading}
 className="bg-brand hover:bg-brand"
 >
 {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
 {editId ?"Save changes" :"Launch automation"}
 </Button>
 )}
 </div>
 </div>
 );
}
