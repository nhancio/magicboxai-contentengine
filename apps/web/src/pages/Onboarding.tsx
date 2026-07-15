import { useEffect, useMemo, useState } from"react";
import { useNavigate, useSearchParams } from"react-router-dom";
import { getPreset } from"@/lib/presets";
import { motion, AnimatePresence } from"framer-motion";
import { toast } from"sonner";
import { doc, setDoc } from"firebase/firestore";
import { db } from"@shared/lib/firebase";
import { useAuth } from"@shared/lib/auth";
import type { SocialAccount, SocialPlatform } from"@shared/types";
import { getSocialAccounts, saveBrandProfile } from"@shared/lib/automations";
import { connectSocial, generatePreviewContent, extractBrandFromWebsite } from"@shared/lib/suite";
import { Button } from"@shared/components/ui/button";
import { Input } from"@shared/components/ui/input";
import { Textarea } from"@shared/components/ui/textarea";
import { Label } from"@shared/components/ui/label";
import { cn } from"@shared/lib/utils";
import PlatformPreview from"../components/previews/PlatformPreview";
import {
 ArrowRight,
 Check,
 Instagram,
 Link2,
 Linkedin,
 Loader2,
 Palette,
 Sparkles,
 Twitter,
 Wand2,
 Youtube,
} from"lucide-react";

const PLATFORM_META: Record<SocialPlatform, { label: string; icon: typeof Instagram; tint: string }> = {
 instagram: { label:"Instagram", icon: Instagram, tint:"from-pink-500 to-orange-400" },
 twitter: { label:"Twitter / X", icon: Twitter, tint:"from-sky-400 to-blue-500" },
 linkedin: { label:"LinkedIn", icon: Linkedin, tint:"from-blue-500 to-cyan-500" },
 youtube: { label:"YouTube", icon: Youtube, tint:"from-red-500 to-rose-500" },
};

const SAMPLE_BRIEF ="Share one practical insight about modern marketing operations, positioning the brand as the calm expert enterprises trust.";

const STEPS = [
 { title:"Connect your channels", icon: Link2 },
 { title:"Your brand", icon: Palette },
 { title:"See it in action", icon: Sparkles },
];

export default function Onboarding() {
 const { user } = useAuth();
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();
 const preset = getPreset(searchParams.get("preset"));
 const [step, setStep] = useState(0);
 const [accounts, setAccounts] = useState<SocialAccount[]>([]);
 const [connecting, setConnecting] = useState<"instagram" | "linkedin" | "youtube" | null>(null);
 const [saving, setSaving] = useState(false);

 // brand form
 const [brandName, setBrandName] = useState("");
 const [industry, setIndustry] = useState("");
 const [toneOfVoice, setToneOfVoice] = useState("");
 const [audience, setAudience] = useState("");
 const [websiteUrl, setWebsiteUrl] = useState("");
 const [brandProfileId, setBrandProfileId] = useState<string>("");
 const [autofilling, setAutofilling] = useState(false);

 // preview
 const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>("linkedin");
 const [preview, setPreview] = useState<{ caption: string; hashtags: string[] } | null>(null);
 const [generating, setGenerating] = useState(false);

 const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

 useEffect(() => {
 if (!user) return;
 getSocialAccounts(user.uid).then(setAccounts).catch(() => {});
 }, [user]);

 // Returning from the OAuth round-trip: surface the result and refresh.
 useEffect(() => {
 const params = new URLSearchParams(window.location.search);
 const social = params.get("social");
 if (!social) return;
 if (social === "connected") {
 toast.success(`${params.get("provider") ?? "Channel"} connected`);
 if (user) getSocialAccounts(user.uid).then(setAccounts).catch(() => {});
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

 const handleConnect = async (provider: "instagram" | "linkedin" | "youtube") => {
 setConnecting(provider);
 try {
 await connectSocial(provider, "/onboarding"); // redirects the tab
 } catch (error) {
 toast.error(error instanceof Error ? error.message :"Could not start connection");
 setConnecting(null);
 }
 };

 const handleAutofill = async () => {
 const url = websiteUrl.trim();
 if (!url) {
 toast.error("Enter your website URL first.");
 return;
 }
 setAutofilling(true);
 try {
 const b = await extractBrandFromWebsite({ url });
 if (b.companyName) setBrandName(b.companyName);
 if (b.industry) setIndustry(b.industry);
 if (b.audience) setAudience(b.audience);
 if (b.tone) setToneOfVoice(b.tone);
 if (!b.companyName && !b.industry && !b.audience && !b.tone) {
 toast.error("Couldn't pull much from that page — fill it in manually.");
 } else {
 toast.success("Filled in from your website — tweak anything that's off.");
 }
 } catch (error) {
 toast.error(error instanceof Error ? error.message : "Couldn't read that site.");
 } finally {
 setAutofilling(false);
 }
 };

 const handleSaveBrand = async () => {
 if (!user) return;
 setSaving(true);
 try {
 if (brandName.trim()) {
 const id = await saveBrandProfile({
 userId: user.uid,
 name: brandName.trim(),
 industry: industry.trim(),
 toneOfVoice: toneOfVoice.trim(),
 audience: audience.trim(),
 websiteUrl: websiteUrl.trim() || undefined,
 });
 setBrandProfileId(id);
 }
 setStep(2);
 } catch (error) {
 toast.error(error instanceof Error ? error.message :"Could not save brand");
 } finally {
 setSaving(false);
 }
 };

 const handlePreview = async (platform: SocialPlatform) => {
 setPreviewPlatform(platform);
 setGenerating(true);
 setPreview(null);
 try {
 const result = await generatePreviewContent({
 brief: SAMPLE_BRIEF,
 platform,
 preset:"educational",
 tone: toneOfVoice || undefined,
 brandProfileId: brandProfileId || undefined,
 });
 setPreview(result);
 } catch (error) {
 toast.error(error instanceof Error ? error.message :"Preview failed");
 } finally {
 setGenerating(false);
 }
 };

 useEffect(() => {
 if (step === 2 && !preview && !generating) {
 handlePreview(previewPlatform);
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [step]);

 const finish = async (goToWizard: boolean) => {
 if (!user || !db) return;
 await setDoc(
 doc(db,"users", user.uid),
 { onboardingComplete: true },
 { merge: true }
 );
 navigate(goToWizard ?"/automations/new" :"/");
 };

 return (
 <div className="min-h-screen bg-background text-foreground">
 <div className="relative mx-auto max-w-2xl px-4 py-12">
 <div className="mb-10 text-center">
 <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-foreground text-background">
 {step === 0 ? <Link2 className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
 </div>
 <span className="eyebrow">Get started</span>
 <h1 className="mt-2 font-display text-4xl tracking-tight">Welcome to MagicBox</h1>
 <p className="mt-2 text-muted-foreground">
 Three steps and your marketing runs itself.
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
 Creator account linked to a Facebook Page. X / Twitter is coming soon.
 </p>
 </div>
 <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3 text-xs text-amber-700">
 Channel connection isn&apos;t live yet — our Instagram (Meta) and LinkedIn apps are
 pending review. Connecting won&apos;t work right now. Use{" "}
 <span className="font-medium">Skip for now</span> to explore the rest of the product.
 </div>
 <div className="grid gap-2 sm:grid-cols-2">
 <Button
 onClick={() => handleConnect("instagram")}
 disabled={connecting !== null}
 variant="outline"
 className="justify-start py-5"
 >
 {connecting === "instagram" ? (
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 ) : (
 <Instagram className="mr-2 h-4 w-4" />
 )}
 Connect Instagram
 </Button>
 <Button
 onClick={() => handleConnect("linkedin")}
 disabled={connecting !== null}
 variant="outline"
 className="justify-start py-5"
 >
 {connecting === "linkedin" ? (
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 ) : (
 <Linkedin className="mr-2 h-4 w-4" />
 )}
 Connect LinkedIn
 </Button>
 <Button
 onClick={() => handleConnect("youtube")}
 disabled={connecting !== null}
 variant="outline"
 className="justify-start py-5"
 >
 {connecting === "youtube" ? (
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 ) : (
 <Youtube className="mr-2 h-4 w-4" />
 )}
 Connect YouTube
 </Button>
 </div>
 {accounts.length > 0 && (
 <div className="space-y-2">
 {accounts.map((account) => {
 const meta = PLATFORM_META[account.platform];
 if (!meta) return null;
 return (
 <div
 key={account.id}
 className="flex items-center gap-3 rounded-lg border border-border bg-card p-3.5"
 >
 <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground">
 <meta.icon className="h-4 w-4" />
 </div>
 <div className="flex-1">
 <div className="text-sm font-medium">{meta.label}</div>
 <div className="text-xs text-muted-foreground">
 @{account.username || account.displayName}
 </div>
 </div>
 <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700">
 <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
 </span>
 </div>
 );
 })}
 </div>
 )}
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
 <div className="glass-card space-y-4 p-6">
 <div>
 <h2 className="font-display text-2xl">{STEPS[1].title}</h2>
 <p className="mt-1 text-sm text-muted-foreground">
 The engine writes in your voice. A minute here pays off in every post.
 </p>
 </div>
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2">
 <Label>Company name</Label>
 <Input
 value={brandName}
 onChange={(e) => setBrandName(e.target.value)}
 placeholder="Acme Analytics"
 className="bg-card/[0.04] border-border"
 />
 </div>
 <div className="space-y-2">
 <Label>Industry</Label>
 <Input
 value={industry}
 onChange={(e) => setIndustry(e.target.value)}
 placeholder="B2B SaaS, logistics…"
 className="bg-card/[0.04] border-border"
 />
 </div>
 </div>
 <div className="space-y-2">
 <Label>Who are you talking to?</Label>
 <Input
 value={audience}
 onChange={(e) => setAudience(e.target.value)}
 placeholder="Operations leaders at mid-market manufacturers"
 className="bg-card/[0.04] border-border"
 />
 </div>
 <div className="space-y-2">
 <Label>Tone of voice</Label>
 <Textarea
 value={toneOfVoice}
 onChange={(e) => setToneOfVoice(e.target.value)}
 rows={2}
 placeholder="Confident and human. Plain language, no jargon, no hype."
 className="bg-card/[0.04] border-border"
 />
 </div>
 <div className="space-y-2">
 <Label>Your website — autofill the rest with AI</Label>
 <div className="flex gap-2">
 <Input
 value={websiteUrl}
 onChange={(e) => setWebsiteUrl(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === "Enter") {
 e.preventDefault();
 handleAutofill();
 }
 }}
 placeholder="https://acme.example"
 className="bg-card/[0.04] border-border"
 />
 <Button
 type="button"
 variant="outline"
 onClick={handleAutofill}
 disabled={autofilling || !websiteUrl.trim()}
 className="shrink-0"
 >
 {autofilling ? (
 <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
 ) : (
 <Wand2 className="mr-1.5 h-4 w-4" />
 )}
 Autofill
 </Button>
 </div>
 <p className="text-xs text-muted-foreground">
 Paste your site URL and we&apos;ll fill company, industry, audience and tone above — edit anything that&apos;s off.
 </p>
 </div>
 <div className="flex gap-3 pt-2">
 <Button
 variant="ghost"
 onClick={() => setStep(2)}
 className="flex-1 text-muted-foreground hover:text-foreground"
 >
 Skip for now
 </Button>
 <Button
 onClick={handleSaveBrand}
 disabled={saving || !brandName.trim()}
 className="flex-1 bg-brand hover:bg-brand"
 >
 {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
 Save & continue
 </Button>
 </div>
 </div>
 )}

 {step === 2 && (
 <div className="space-y-5">
 <div className="glass-card p-6">
 <h2 className="text-lg font-semibold">{STEPS[2].title}</h2>
 <p className="mt-1 text-sm text-muted-foreground">
 This is a live sample written by your engine — switch platforms to see
 how it adapts the same idea to each channel.
 </p>
 <div className="mt-4 flex gap-2">
 {(Object.keys(PLATFORM_META) as SocialPlatform[]).map((platform) => {
 const meta = PLATFORM_META[platform];
 return (
 <button
 key={platform}
 onClick={() => handlePreview(platform)}
 className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
 previewPlatform === platform
 ?"border-brand/60 bg-brand/15 text-brand"
 :"border-border/[0.08] text-muted-foreground hover:bg-card/[0.04]"
 )}
 >
 <meta.icon className="h-3.5 w-3.5" /> {meta.label}
 </button>
 );
 })}
 </div>
 <div className="mt-5 flex justify-center">
 {generating ? (
 <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
 <Loader2 className="h-6 w-6 animate-spin text-brand" />
 <span className="text-sm">Writing a sample for {PLATFORM_META[previewPlatform].label}…</span>
 </div>
 ) : preview ? (
 <PlatformPreview
 platform={previewPlatform}
 content={{
 caption: preview.caption,
 hashtags: preview.hashtags,
 brandName: brandName ||"Your Brand",
 handle: brandName
 ? brandName.toLowerCase().replace(/\s+/g,"")
 : undefined,
 }}
 />
 ) : (
 <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
 Sample unavailable right now — you can still continue.
 </div>
 )}
 </div>
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
 )}
 </motion.div>
 </AnimatePresence>
 </div>
 </div>
 );
}
