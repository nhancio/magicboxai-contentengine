import { useEffect, useMemo, useState } from"react";
import { useNavigate, useSearchParams } from"react-router-dom";
import { useAction, useQuery } from"convex/react";
import { getPreset } from"@/lib/presets";
import { motion, AnimatePresence } from"framer-motion";
import { toast } from"sonner";
import { doc, setDoc } from"firebase/firestore";
import { db } from"@shared/lib/firebase";
import { useAuth } from"@shared/lib/auth";
import { api } from"@convex/_generated/api";
import { isConvexConfigured } from"../lib/convex";
import type { SocialAccount, SocialPlatform } from"@shared/types";
import { getSocialAccounts, saveBrandProfile } from"@shared/lib/automations";
import {
 extractBrandFromWebsite,
 type BrandExtractResult,
} from"@shared/lib/suite";
import { Button } from"@shared/components/ui/button";
import { Input } from"@shared/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from"@shared/components/ui/avatar";
import { cn } from"@shared/lib/utils";
import { captureEvent } from"@shared/lib/analytics";
import PreviewModule from"../components/previews/PreviewModule";
import {
 ArrowRight,
 CalendarClock,
 Check,
 ChevronLeft,
 Globe2,
 Instagram,
 Link2,
 Linkedin,
 Loader2,
 PanelRight,
 Send,
 Sparkles,
 Youtube,
} from"lucide-react";

const SCAN_STEPS = [
 "Fetching your site",
 "Finding logo & icons",
 "Sampling brand colors",
 "Reading voice & audience",
];

function normalizeInputUrl(raw: string): string {
 const t = raw.trim();
 if (!t) return "";
 return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

const PLATFORM_META: Record<
 string,
 { label: string; icon: typeof Instagram; tint: string }
> = {
 instagram: { label:"Instagram", icon: Instagram, tint:"from-pink-500 to-orange-400" },
 linkedin: { label:"LinkedIn", icon: Linkedin, tint:"from-blue-500 to-cyan-500" },
 youtube: { label:"YouTube", icon: Youtube, tint:"from-red-500 to-rose-500" },
};

const CONNECTABLE: Array<"instagram" | "linkedin" | "youtube"> = [
 "instagram",
 "linkedin",
 "youtube",
];

function channelHandle(account: SocialAccount): string {
 const raw = (account.username || account.displayName || "").trim();
 if (!raw) return account.externalId ? `id:${account.externalId.slice(0, 8)}` : "connected";
 // YouTube customUrl often already starts with @
 return raw.startsWith("@") ? raw : `@${raw.replace(/^@/, "")}`;
}

const SAMPLE_BRIEF =
 "Share one practical insight that positions the brand as a calm expert worth following.";

const PREVIEW_PLATFORMS: SocialPlatform[] = [
 "instagram",
 "linkedin",
 "youtube",
];

type SamplePost = {
 id: string;
 caption: string;
 hashtags: string[];
};

function buildBrandSamples(
 extracted: BrandExtractResult | null,
 brandName: string,
): SamplePost[] {
 const name = brandName || extracted?.companyName || "Your brand";
 const tags = (extracted?.hashtags ?? [])
 .map((h) => h.replace(/^#/, ""))
 .filter(Boolean)
 .slice(0, 6);
 const fromSite = (extracted?.sampleCaptions ?? []).filter((c) => c?.trim());
 const fallbacks = [
 `${name} helps teams ship clearer marketing — without starting from a blank page every Monday.`,
 extracted?.industry
 ? `One take from ${extracted.industry}: consistency beats one-off campaigns. Show up with the same voice every week.`
 : `Consistency beats one-off campaigns. Show up with the same voice every week.`,
 extracted?.tone
 ? `${name} voice check: ${extracted.tone.slice(0, 120)}${extracted.tone.length > 120 ? "…" : ""}`
 : `Here's what ${name} is focused on this week — practical, on-brand, ready to publish.`,
 ];
 const captions = (fromSite.length >= 1 ? fromSite : fallbacks).slice(0, 3);
 return captions.map((caption, i) => ({
 id: `sample-${i}`,
 caption,
 hashtags: tags,
 }));
}

const STEPS = [
 { title: "Connect your channels", icon: Link2 },
 { title: "Your website", icon: Globe2 },
 { title: "See it in action", icon: Sparkles },
];

export default function Onboarding() {
 const { user } = useAuth();
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();
 const preset = getPreset(searchParams.get("preset"));
 const [step, setStep] = useState(0);
 const [legacyAccounts, setLegacyAccounts] = useState<SocialAccount[]>([]);
 const [connecting, setConnecting] = useState<
 "instagram" | "linkedin" | "youtube" | "facebook" | "whatsapp" | null
 >(null);
 const [saving, setSaving] = useState(false);

 // Convex channel path (same engine Studio / Maya / Settings use).
 const convexAccounts = useQuery(api.social.accounts, isConvexConfigured ? {} : "skip");
 const connectUrl = useAction(api.social.connectUrl);
 const createPost = useAction(api.studio.createPost);
 const generateCopy = useAction(api.studio.generateCopy);

 const accounts: SocialAccount[] = useMemo(() => {
 if (isConvexConfigured && convexAccounts) {
 return convexAccounts.map((a: any) => ({
 id: a._id,
 userId: a.userId,
 provider: a.provider,
 platform: a.platform,
 externalId: a.externalId,
 username: a.username ?? "",
 displayName: a.displayName ?? a.username ?? "",
 avatarUrl: a.avatarUrl,
 status: a.status,
 linkedAt: new Date(a.linkedAt),
 lastSyncedAt: a.lastSyncedAt ? new Date(a.lastSyncedAt) : undefined,
 }));
 }
 return legacyAccounts;
 }, [convexAccounts, legacyAccounts]);

 const connectedByPlatform = useMemo(() => {
 const map = new Map<string, SocialAccount>();
 for (const a of accounts) {
 if (a.status === "active" || a.status === "expired") map.set(a.platform, a);
 }
 return map;
 }, [accounts]);

 // brand — website fetch only
 const [websiteUrl, setWebsiteUrl] = useState("");
 const [brandPhase, setBrandPhase] = useState<"idle" | "scanning" | "ready" | "saving">("idle");
 const [scanStep, setScanStep] = useState(0);
 const [extracted, setExtracted] = useState<BrandExtractResult | null>(null);
 const [extractedUrl, setExtractedUrl] = useState("");
 const [brandName, setBrandName] = useState("");
 const [toneOfVoice, setToneOfVoice] = useState("");
 const [brandProfileId, setBrandProfileId] = useState<string>("");

 // preview — branded samples from fetch (no dependency on failing Firebase callable)
 const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>("linkedin");
 const [samples, setSamples] = useState<SamplePost[]>([]);
 const [activeSampleId, setActiveSampleId] = useState<string>("sample-0");
 const [generating, setGenerating] = useState(false);
 const [posting, setPosting] = useState(false);
 const [previewCollapsed, setPreviewCollapsed] = useState(false);

 const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

 useEffect(() => {
 if (!user || isConvexConfigured) return;
 getSocialAccounts(user.uid).then(setLegacyAccounts).catch(() => {});
 }, [user]);

 useEffect(() => {
 captureEvent("onboarding_started", { preset: preset?.label ?? "none" });
 }, [preset?.label]);

 // Returning from the OAuth round-trip: surface the result and refresh.
 useEffect(() => {
 const params = new URLSearchParams(window.location.search);
 const social = params.get("social");
 if (!social) return;
 if (social === "connected") {
 captureEvent("channel_connected", { channel: params.get("provider") ?? "unknown", source: "onboarding" });
 toast.success(`${params.get("provider") ?? "Channel"} connected`);
 if (user && !isConvexConfigured) {
 getSocialAccounts(user.uid).then(setLegacyAccounts).catch(() => {});
 }
 } else if (social === "error") {
 toast.error(params.get("reason") || "Could not connect channel");
 }
 // keep ?preset= but drop the social params
 params.delete("social");
 params.delete("provider");
 params.delete("reason");
 const qs = params.toString();
 window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
 }, [user]);

 const handleConnect = async (
 provider: "instagram" | "linkedin" | "youtube" | "facebook" | "whatsapp",
 ) => {
 captureEvent("channel_connect_started", { channel: provider, source: "onboarding" });
 setConnecting(provider);
 try {
 if (!isConvexConfigured) {
 toast.error("Convex is not configured — set VITE_CONVEX_URL.");
 setConnecting(null);
 return;
 }
 const { url, redirectUri } = await connectUrl({
 provider,
 returnTo: "/onboarding",
 returnOrigin: window.location.origin,
 loginHint: user?.email ?? undefined,
 });
 if (redirectUri.includes("cloudfunctions.net")) {
 toast.error("OAuth misconfigured (Firebase callback). Use Convex.");
 setConnecting(null);
 return;
 }
 window.location.href = url;
 } catch (error) {
 toast.error(error instanceof Error ? error.message :"Could not start connection");
 setConnecting(null);
 }
 };

 useEffect(() => {
 if (brandPhase !== "scanning") return;
 setScanStep(0);
 const id = window.setInterval(() => {
 setScanStep((s) => (s < SCAN_STEPS.length - 1 ? s + 1 : s));
 }, 1400);
 return () => window.clearInterval(id);
 }, [brandPhase]);

 const handleScanBrand = async () => {
 const url = normalizeInputUrl(websiteUrl);
 if (!url) {
 toast.error("Enter your website URL first.");
 return;
 }
 setBrandPhase("scanning");
 setExtracted(null);
 try {
 const result = await extractBrandFromWebsite({ url });
 if (!result.companyName && !result.logoUrl && !result.colors?.primary) {
 toast.error("Couldn't pull much from that page — try the homepage URL.");
 setBrandPhase("idle");
 return;
 }
 setExtracted(result);
 setExtractedUrl(url);
 setBrandName(result.companyName || new URL(url).hostname);
 setToneOfVoice(result.tone || "");
 setBrandPhase("ready");
 toast.success("Brand details fetched — review and continue.");
 } catch (error) {
 toast.error(error instanceof Error ? error.message : "Couldn't read that site.");
 setBrandPhase("idle");
 }
 };

 const handleSaveBrand = async () => {
 if (!user || !extracted) return;
 setBrandPhase("saving");
 setSaving(true);
 try {
 const id = await saveBrandProfile({
 userId: user.uid,
 name: extracted.companyName || new URL(extractedUrl).hostname,
 industry: extracted.industry || "",
 toneOfVoice: extracted.tone || "",
 audience: extracted.audience || "",
 websiteUrl: extractedUrl,
 logoUrl: extracted.logoUrl || undefined,
 colors: {
 primary: extracted.colors.primary || "#111111",
 secondary: extracted.colors.secondary,
 accent: extracted.colors.accent,
 },
 hashtagSets: {
 default: (extracted.hashtags ?? []).map((h) => h.replace(/^#/, "")).filter(Boolean),
 },
 sampleCaptions: extracted.sampleCaptions?.length
 ? extracted.sampleCaptions
 : undefined,
 });
 setBrandProfileId(id);
 setBrandName(extracted.companyName || new URL(extractedUrl).hostname);
 setToneOfVoice(extracted.tone || "");
 captureEvent("brand_kit_completed", { source: "onboarding", has_website: true });
 setStep(2);
 } catch (error) {
 toast.error(error instanceof Error ? error.message :"Could not save brand");
 setBrandPhase("ready");
 } finally {
 setSaving(false);
 }
 };

 const activeSample = samples.find((s) => s.id === activeSampleId) ?? samples[0] ?? null;

 const activeAccountForPreview = useMemo(() => {
 return accounts.find(
 (a) => a.platform === previewPlatform && a.status === "active",
 );
 }, [accounts, previewPlatform]);

 const hydrateSamples = async () => {
 const local = buildBrandSamples(extracted, brandName);
 setSamples(local);
 setActiveSampleId(local[0]?.id ?? "sample-0");

 // Best-effort AI polish via Convex — never blocks the UI if it fails.
 if (!isConvexConfigured) return;
 setGenerating(true);
 try {
 const polished = await generateCopy({
 presetId: "text-post",
 platform: previewPlatform,
 prompt: SAMPLE_BRIEF,
 productName: brandName || extracted?.companyName || undefined,
 context: [
 extracted?.industry && `Industry: ${extracted.industry}`,
 extracted?.audience && `Audience: ${extracted.audience}`,
 toneOfVoice && `Tone: ${toneOfVoice}`,
 extractedUrl && `Website: ${extractedUrl}`,
 ]
 .filter(Boolean)
 .join("\n"),
 });
 const next: SamplePost = {
 id: "ai-0",
 caption: polished.caption,
 hashtags: (polished.hashtags ?? []).map((h) => h.replace(/^#/, "")),
 };
 setSamples((prev) => [next, ...prev.filter((s) => s.id !== "ai-0")].slice(0, 3));
 setActiveSampleId("ai-0");
 } catch {
 // Local brand samples already on screen.
 } finally {
 setGenerating(false);
 }
 };

 const handlePreviewPlatform = (platform: SocialPlatform) => {
 setPreviewPlatform(platform);
 };

 useEffect(() => {
 if (step !== 2) return;
 void hydrateSamples();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [step]);

 const handleQuickPost = async (mode: "now" | "schedule") => {
 if (!activeSample) return;
 if (!isConvexConfigured) {
 toast.error("Convex is not configured — can't publish yet.");
 return;
 }
 if (!activeAccountForPreview) {
 toast.error(`Connect ${PLATFORM_META[previewPlatform].label} first to post this.`);
 return;
 }

 const needsMedia =
 previewPlatform === "instagram" || previewPlatform === "youtube";
 const logo = extracted?.logoUrl;
 if (needsMedia && !logo) {
 toast.error(
 `${PLATFORM_META[previewPlatform].label} needs an image — fetch a site with a logo, or post from Studio.`,
 );
 return;
 }

 setPosting(true);
 try {
 const result = await createPost({
 caption: activeSample.caption,
 hashtags: activeSample.hashtags,
 platforms: [previewPlatform],
 socialAccountIds: [activeAccountForPreview.id],
 mediaUrl: logo || undefined,
 mediaType: logo ? "image" : undefined,
 mediaSource: logo ? "upload" : undefined,
 brief: SAMPLE_BRIEF,
 brandProfileId: brandProfileId || undefined,
 mode,
 timezone,
 });
 if (mode === "now") {
 captureEvent("post_publish_requested", { channel: previewPlatform, source: "onboarding" });
 if (result.status === "posted") captureEvent("post_published", { channel: previewPlatform, source: "onboarding" });
 toast.success(
 result.status === "posted"
 ? `Posted to ${PLATFORM_META[previewPlatform].label}`
 : `Sending to ${PLATFORM_META[previewPlatform].label} now…`,
 );
 } else {
 captureEvent("post_scheduled", { channel: previewPlatform, source: "onboarding" });
 const when = result.scheduledFor
 ? new Date(result.scheduledFor).toLocaleString(undefined, {
 weekday: "short",
 hour: "numeric",
 minute: "2-digit",
 })
 : null;
 toast.success(
 when
 ? `Queued for next best time · ${when}`
 : `Queued for ${PLATFORM_META[previewPlatform].label}`,
 );
 }
 } catch (error) {
 toast.error(error instanceof Error ? error.message : "Could not post");
 } finally {
 setPosting(false);
 }
 };

 const finish = async (goToWizard: boolean) => {
 if (!user || !db) return;
 await setDoc(
 doc(db, "users", user.uid),
 { onboardingComplete: true },
 { merge: true },
 );
 captureEvent("onboarding_completed", { next: goToWizard ? "automation_wizard" : "dashboard" });
 navigate(goToWizard ? "/automations/new" : "/");
 };

 return (
 <div className="min-h-screen bg-background text-foreground">
 <div
 className={cn(
 "relative mx-auto px-4 py-12",
 step === 2 ? "max-w-6xl" : "max-w-2xl",
 )}
 >
 <div className="mb-10 text-center">
 <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-foreground text-background">
 {step === 0 ? <Link2 className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
 </div>
 <span className="eyebrow">Get started</span>
 <h1 className="mt-2 font-display text-4xl tracking-tight">Welcome to MagicBox</h1>
 <p className="mt-2 text-muted-foreground">
 Connect channels, fetch your brand, see a sample post.
 </p>
 </div>

 {/* Stepper */}
 <div className="mb-8 flex items-center justify-center gap-3">
 {STEPS.map((s, i) => (
 <div key={s.title} className="flex items-center gap-3">
 <div
 className={cn("flex h-9 w-9 items-center justify-center rounded-full transition-colors",
 i < step
 ?"bg-brand text-brand-foreground"
 : i === step
 ?"bg-brand/10 text-brand ring-1 ring-brand/30"
 :"bg-secondary text-muted-foreground"
 )}
 >
 {i < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
 </div>
 {i < STEPS.length - 1 && <div className="h-px w-10 bg-border sm:w-16" />}
 </div>
 ))}
 </div>

 <AnimatePresence mode="wait">
 <motion.div
 key={step}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -10 }}
 transition={{ duration: 0.2 }}
 >
 {step === 0 && (
 <div className="glass-card space-y-5 p-6">
 {preset && (
 <div className="rounded-lg border border-brand/20 bg-brand/[0.06] p-4">
 <div className="text-[11px] font-mono uppercase tracking-widest text-brand">
 {preset.label} setup
 </div>
 <p className="mt-1 text-sm text-foreground">
 Recommended for you — connect these channels to get started:
 </p>
 <div className="mt-3 flex flex-wrap gap-2">
 {preset.platforms.map((p) => {
 const meta = PLATFORM_META[p];
 if (!meta) return null;
 return (
 <span
 key={p}
 className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-card px-3 py-1 text-xs font-medium text-foreground"
 >
 <meta.icon className="h-3.5 w-3.5 text-brand" />
 {meta.label}
 </span>
 );
 })}
 </div>
 </div>
 )}
 <div>
 <h2 className="font-display text-2xl">{STEPS[0].title}</h2>
 <p className="mt-1 text-sm text-muted-foreground">
 Connect the accounts MagicBox should publish to. Instagram needs a Business or
 Creator account linked to a Facebook Page. You can skip and connect later in Settings.
 </p>
 </div>

 {accounts.length > 0 && (
 <div className="space-y-2">
 <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
 Connected · {accounts.length}
 </p>
 {accounts.map((account) => {
 const meta = PLATFORM_META[account.platform] ?? {
 label: account.platform,
 icon: Link2,
 };
 const Icon = meta.icon;
 const handle = channelHandle(account);
 const initials = (account.displayName || account.username || "?")
 .slice(0, 2)
 .toUpperCase();
 const needsReconnect = account.status === "expired";
 return (
 <div
 key={account.id}
 className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5"
 >
 <Avatar className="h-11 w-11 border border-border">
 <AvatarImage src={account.avatarUrl} alt="" />
 <AvatarFallback className="bg-secondary text-xs text-foreground">
 {initials}
 </AvatarFallback>
 </Avatar>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2">
 <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
 <span className="truncate text-sm font-medium text-foreground">
 {account.displayName || meta.label}
 </span>
 </div>
 <p className="truncate text-xs text-muted-foreground">
 {meta.label} · {handle}
 </p>
 </div>
 {needsReconnect ? (
 <Button
 size="sm"
 variant="outline"
 className="shrink-0 border-amber-500/30 text-amber-700"
 disabled={connecting !== null}
 onClick={() =>
 handleConnect(
 account.platform as "instagram" | "linkedin" | "youtube" | "facebook" | "whatsapp",
 )
 }
 >
 Reconnect
 </Button>
 ) : (
 <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700">
 <Check className="h-3 w-3" /> Connected
 </span>
 )}
 </div>
 );
 })}
 </div>
 )}

 {accounts.length === 0 && (
 <div className="rounded-lg border border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
 YouTube connects via Google. Instagram and LinkedIn may need app review for other
 users. You can skip and connect later in Settings.
 </div>
 )}

 <div className="grid gap-2 sm:grid-cols-2">
 {CONNECTABLE.filter((provider) => {
 const linked = connectedByPlatform.get(provider);
 // Already active → shown in the Connected list above; hide Connect.
 return !(linked && linked.status === "active");
 }).map((provider) => {
 const meta = PLATFORM_META[provider];
 const Icon = meta.icon;
 const linked = connectedByPlatform.get(provider);
 const busy = connecting === provider;
 const expired = linked?.status === "expired";
 return (
 <Button
 key={provider}
 onClick={() => handleConnect(provider)}
 disabled={connecting !== null}
 variant="outline"
 className="justify-start py-5"
 >
 {busy ? (
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 ) : (
 <Icon className="mr-2 h-4 w-4" />
 )}
 {expired ? `Reconnect ${meta.label}` : `Connect ${meta.label}`}
 </Button>
 );
 })}
 </div>

 {accounts.length > 0 ? (
 <Button onClick={() => setStep(1)} className="w-full py-5">
 Continue <ArrowRight className="ml-1.5 h-4 w-4" />
 </Button>
 ) : (
 <Button
 onClick={() => setStep(1)}
 variant="outline"
 className="w-full py-5"
 >
 Skip for now <ArrowRight className="ml-1.5 h-4 w-4" />
 </Button>
 )}
 </div>
 )}

 {step === 1 && (
 <div className="glass-card space-y-5 p-6">
 <div>
 <h2 className="font-display text-2xl">Your website</h2>
 <p className="mt-1 text-sm text-muted-foreground">
 Paste your site URL. We fetch logo, colors, voice, and audience — no manual brand form.
 </p>
 </div>

 <div className="space-y-3">
 <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground">
 <Globe2 className="h-3.5 w-3.5 text-brand" />
 Website → brand kit
 </div>
 <div className="flex flex-col gap-3 sm:flex-row">
 <div className="relative flex-1">
 <Globe2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 value={websiteUrl}
 onChange={(e) => {
 setWebsiteUrl(e.target.value);
 if (brandPhase === "ready") {
 setBrandPhase("idle");
 setExtracted(null);
 }
 }}
 onKeyDown={(e) => {
 if (e.key === "Enter") {
 e.preventDefault();
 void handleScanBrand();
 }
 }}
 placeholder="https://yourbrand.com"
 disabled={brandPhase === "scanning" || brandPhase === "saving"}
 className="h-12 bg-card border-border pl-10"
 />
 </div>
 <Button
 type="button"
 onClick={() => void handleScanBrand()}
 disabled={
 brandPhase === "scanning" ||
 brandPhase === "saving" ||
 !websiteUrl.trim()
 }
 className="h-12 shrink-0 px-6"
 >
 {brandPhase === "scanning" ? (
 <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
 ) : (
 <Sparkles className="mr-1.5 h-4 w-4" />
 )}
 {brandPhase === "scanning" ? "Fetching…" : "Fetch brand"}
 </Button>
 </div>
 </div>

 {brandPhase === "scanning" && (
 <div className="rounded-xl border border-brand/20 bg-brand/[0.06] p-4">
 <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
 <Loader2 className="h-4 w-4 animate-spin text-brand" />
 Reading your brand…
 </div>
 <ul className="space-y-2">
 {SCAN_STEPS.map((label, i) => (
 <li
 key={label}
 className={cn(
 "flex items-center gap-2 text-sm",
 i <= scanStep ? "text-foreground" : "text-muted-foreground/50"
 )}
 >
 {i < scanStep ? (
 <Check className="h-3.5 w-3.5 text-brand" />
 ) : i === scanStep ? (
 <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
 ) : (
 <span className="h-3.5 w-3.5 rounded-full border border-border" />
 )}
 {label}
 </li>
 ))}
 </ul>
 </div>
 )}

 {brandPhase === "ready" && extracted && (
 <div className="space-y-4 rounded-xl border border-border bg-card p-4">
 <div className="flex items-start gap-3">
 {extracted.logoUrl ? (
 <img
 src={extracted.logoUrl}
 alt=""
 className="h-12 w-12 rounded-lg border border-border bg-secondary object-contain p-1"
 />
 ) : (
 <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary font-display text-lg">
 {(extracted.companyName || "?").slice(0, 1)}
 </div>
 )}
 <div className="min-w-0 flex-1">
 <div className="font-display text-xl leading-tight">
 {extracted.companyName || new URL(extractedUrl).hostname}
 </div>
 <p className="mt-0.5 truncate text-xs text-muted-foreground">
 {extractedUrl.replace(/^https?:\/\//, "")}
 {extracted.industry ? ` · ${extracted.industry}` : ""}
 </p>
 </div>
 </div>

 {(extracted.colors.primary ||
 extracted.colors.secondary ||
 extracted.colors.accent) && (
 <div className="flex flex-wrap gap-3">
 {(["primary", "secondary", "accent"] as const).map((key) => {
 const hex = extracted.colors[key];
 if (!hex) return null;
 return (
 <div key={key} className="flex items-center gap-2">
 <div
 className="h-8 w-8 rounded-lg border border-border"
 style={{ background: hex }}
 />
 <div>
 <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
 {key}
 </div>
 <div className="font-mono text-xs">{hex}</div>
 </div>
 </div>
 );
 })}
 </div>
 )}

 {(extracted.audience || extracted.tone) && (
 <div className="space-y-2 text-sm text-muted-foreground">
 {extracted.audience && (
 <p>
 <span className="font-medium text-foreground">Audience · </span>
 {extracted.audience}
 </p>
 )}
 {extracted.tone && (
 <p>
 <span className="font-medium text-foreground">Tone · </span>
 {extracted.tone}
 </p>
 )}
 </div>
 )}
 </div>
 )}

 <div className="flex gap-3 pt-1">
 <Button
 variant="ghost"
 onClick={() => setStep(2)}
 className="flex-1 text-muted-foreground hover:text-foreground"
 >
 Skip for now
 </Button>
 <Button
 onClick={() => void handleSaveBrand()}
 disabled={saving || brandPhase !== "ready" || !extracted}
 className="flex-1 bg-brand hover:bg-brand"
 >
 {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
 Save & continue
 </Button>
 </div>
 </div>
 )}

 {step === 2 && (
 <div
 className={cn(
 "grid gap-5",
 previewCollapsed
 ? "lg:grid-cols-[minmax(0,1fr)_3.5rem]"
 : "lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]",
 )}
 >
 <div
 className={cn(
 "min-w-0 space-y-5",
 !previewCollapsed && "pb-[min(52vh,440px)] lg:pb-0",
 )}
 >
 <div className="glass-card p-6">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <h2 className="font-display text-2xl">{STEPS[2].title}</h2>
 <p className="mt-1 text-sm text-muted-foreground">
 Sample posts in your fetched brand — logo, colors, and voice. Post now if a
 channel is connected.
 </p>
 </div>
 <div className="flex items-center gap-2">
 {(extracted?.logoUrl || brandName) && (
 <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5">
 {extracted?.logoUrl ? (
 <img
 src={extracted.logoUrl}
 alt=""
 className="h-6 w-6 rounded-full object-cover"
 />
 ) : null}
 <span className="text-xs font-medium">{brandName || "Your brand"}</span>
 </div>
 )}
 {previewCollapsed && (
 <Button
 type="button"
 variant="outline"
 size="sm"
 className="lg:hidden"
 onClick={() => setPreviewCollapsed(false)}
 >
 <PanelRight className="mr-1.5 h-3.5 w-3.5" />
 Show preview
 </Button>
 )}
 </div>
 </div>

 {samples.length > 1 && (
 <div className="mt-4 flex flex-wrap gap-2">
 {samples.map((s, i) => (
 <button
 key={s.id}
 type="button"
 onClick={() => setActiveSampleId(s.id)}
 className={cn(
 "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
 activeSampleId === s.id
 ? "border-brand/60 bg-brand/15 text-brand"
 : "border-border text-muted-foreground hover:bg-secondary",
 )}
 >
 Sample {i + 1}
 </button>
 ))}
 </div>
 )}

 {generating && (
 <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
 {activeSample ? "Polishing with AI…" : "Writing samples in your brand voice…"}
 </p>
 )}

 {!activeSample && !generating && (
 <div className="mt-5 flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
 Go back and fetch a website to unlock branded samples.
 </div>
 )}

 {activeSample && (
 <div className="mt-5 space-y-2">
 {activeAccountForPreview ? (
 <div className="grid gap-2 sm:grid-cols-2">
 <Button
 onClick={() => void handleQuickPost("now")}
 disabled={posting}
 className="w-full py-5"
 >
 {posting ? (
 <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
 ) : (
 <Send className="mr-1.5 h-4 w-4" />
 )}
 Post now
 </Button>
 <Button
 variant="outline"
 onClick={() => void handleQuickPost("schedule")}
 disabled={posting}
 className="w-full py-5"
 >
 {posting ? (
 <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
 ) : (
 <CalendarClock className="mr-1.5 h-4 w-4" />
 )}
 Next best time
 </Button>
 </div>
 ) : (
 <div className="rounded-lg border border-dashed border-border bg-secondary/40 px-4 py-3 text-center text-xs text-muted-foreground">
 Connect {PLATFORM_META[previewPlatform].label} in step 1 to quick-post this
 sample.
 </div>
 )}
 </div>
 )}
 </div>

 <div className="flex gap-3">
 <Button
 variant="ghost"
 onClick={() => finish(false)}
 className="flex-1 text-muted-foreground hover:text-foreground"
 >
 Explore the dashboard
 </Button>
 <Button
 onClick={() => finish(true)}
 className="flex-1 bg-brand py-5 hover:bg-brand"
 >
 Create my first automation <ArrowRight className="ml-1.5 h-4 w-4" />
 </Button>
 </div>
 <p className="text-center text-xs text-muted-foreground">
 Posting timezone: {timezone}
 </p>
 </div>

 {/* Right preview rail — desktop sticky; mobile bottom sheet */}
 <div
 className={cn(
 "z-20 border-border bg-background/95 backdrop-blur-md",
 "fixed inset-x-0 bottom-0 border-t p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]",
 previewCollapsed && "hidden lg:block",
 "lg:static lg:inset-auto lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none",
 "lg:sticky lg:top-6 lg:self-start",
 )}
 >
 {!previewCollapsed && (
 <div className="mb-2 flex items-center justify-between lg:hidden">
 <span className="text-xs font-medium text-muted-foreground">Live preview</span>
 <button
 type="button"
 onClick={() => setPreviewCollapsed(true)}
 className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
 >
 <ChevronLeft className="h-3.5 w-3.5" />
 Hide
 </button>
 </div>
 )}
 <PreviewModule
 collapsible
 collapsed={previewCollapsed}
 onCollapsedChange={setPreviewCollapsed}
 className={cn(
 previewCollapsed
 ? "min-h-[min(48vh,280px)] lg:min-h-[420px]"
 : "max-h-[min(48vh,420px)] min-h-0 lg:min-h-[480px] lg:max-h-[min(80vh,720px)]",
 )}
 title="Post preview"
 platform={previewPlatform}
 onPlatformChange={handlePreviewPlatform}
 allowedPlatforms={PREVIEW_PLATFORMS}
 content={
 activeSample
 ? {
 caption: activeSample.caption,
 hashtags: activeSample.hashtags,
 brandName: brandName || "Your Brand",
 handle: brandName
 ? brandName.toLowerCase().replace(/\s+/g, "")
 : "yourbrand",
 logoUrl: extracted?.logoUrl,
 brandColors: extracted?.colors,
 }
 : null
 }
 emptyHint={
 generating
 ? "Writing samples in your brand voice…"
 : "Go back and fetch a website to unlock branded samples."
 }
 />
 </div>
 </div>
 )}
 </motion.div>
 </AnimatePresence>
 </div>
 </div>
 );
}
