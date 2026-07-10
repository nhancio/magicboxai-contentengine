import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@shared/lib/firebase";
import { useAuth } from "@shared/lib/auth";
import type { SocialAccount, SocialPlatform } from "@shared/types";
import { getSocialAccounts, saveBrandProfile } from "@shared/lib/automations";
import { syncSocialAccounts, generatePreviewContent } from "@shared/lib/suite";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Textarea } from "@shared/components/ui/textarea";
import { Label } from "@shared/components/ui/label";
import { cn } from "@shared/lib/utils";
import PlatformPreview from "../components/previews/PlatformPreview";
import {
  ArrowRight,
  Check,
  Instagram,
  Link2,
  Linkedin,
  Loader2,
  Palette,
  RefreshCw,
  Sparkles,
  Twitter,
} from "lucide-react";

const PLATFORM_META: Record<SocialPlatform, { label: string; icon: typeof Instagram; tint: string }> = {
  instagram: { label: "Instagram", icon: Instagram, tint: "from-pink-500 to-orange-400" },
  twitter: { label: "Twitter / X", icon: Twitter, tint: "from-sky-400 to-blue-500" },
  linkedin: { label: "LinkedIn", icon: Linkedin, tint: "from-blue-500 to-cyan-500" },
};

const SAMPLE_BRIEF =
  "Share one practical insight about modern marketing operations, positioning the brand as the calm expert enterprises trust.";

const STEPS = [
  { title: "Connect your channels", icon: Link2 },
  { title: "Your brand", icon: Palette },
  { title: "See it in action", icon: Sparkles },
];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  // brand form
  const [brandName, setBrandName] = useState("");
  const [industry, setIndustry] = useState("");
  const [toneOfVoice, setToneOfVoice] = useState("");
  const [audience, setAudience] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [brandProfileId, setBrandProfileId] = useState<string>("");

  // preview
  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>("linkedin");
  const [preview, setPreview] = useState<{ caption: string; hashtags: string[] } | null>(null);
  const [generating, setGenerating] = useState(false);

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  useEffect(() => {
    if (!user) return;
    getSocialAccounts(user.uid).then(setAccounts).catch(() => {});
  }, [user]);

  const handleSync = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const result = await syncSocialAccounts({});
      setAccounts(await getSocialAccounts(user.uid));
      toast.success(
        result.dryRun
          ? `Found ${result.synced} channels (sandbox mode until your workspace goes live)`
          : `Found ${result.synced} connected channels`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sync accounts");
    } finally {
      setSyncing(false);
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
      toast.error(error instanceof Error ? error.message : "Could not save brand");
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
        preset: "educational",
        tone: toneOfVoice || undefined,
        brandProfileId: brandProfileId || undefined,
      });
      setPreview(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preview failed");
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
      doc(db, "users", user.uid),
      { onboardingComplete: true },
      { merge: true }
    );
    navigate(goToWizard ? "/automations/new" : "/");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-violet-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-2xl px-4 py-12">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to MagicBox Suite</h1>
          <p className="mt-2 text-white/45">
            Three steps and your marketing runs itself.
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-8 flex items-center justify-center gap-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                  i < step
                    ? "bg-violet-600 text-white"
                    : i === step
                      ? "bg-violet-600/20 text-violet-300 ring-1 ring-violet-500/50"
                      : "bg-white/[0.06] text-white/35"
                )}
              >
                {i < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              </div>
              {i < STEPS.length - 1 && <div className="h-px w-10 bg-white/10 sm:w-16" />}
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
                <div>
                  <h2 className="text-lg font-semibold">{STEPS[0].title}</h2>
                  <p className="mt-1 text-sm text-white/45">
                    Your Instagram, Twitter/X and LinkedIn profiles are linked by our team
                    during enterprise onboarding. Sync to pull them in.
                  </p>
                </div>
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  variant="outline"
                  className="w-full border-white/10 bg-white/[0.04] py-5"
                >
                  {syncing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync connected channels
                </Button>
                {accounts.length > 0 && (
                  <div className="space-y-2">
                    {accounts.map((account) => {
                      const meta = PLATFORM_META[account.platform];
                      if (!meta) return null;
                      return (
                        <div
                          key={account.id}
                          className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5"
                        >
                          <div
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br",
                              meta.tint
                            )}
                          >
                            <meta.icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{meta.label}</div>
                            <div className="text-xs text-white/40">
                              @{account.username || account.displayName}
                            </div>
                          </div>
                          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Connected
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Button
                  onClick={() => setStep(1)}
                  disabled={accounts.length === 0}
                  className="w-full bg-violet-600 py-5 hover:bg-violet-500"
                >
                  Continue <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            )}

            {step === 1 && (
              <div className="glass-card space-y-4 p-6">
                <div>
                  <h2 className="text-lg font-semibold">{STEPS[1].title}</h2>
                  <p className="mt-1 text-sm text-white/45">
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
                      className="bg-white/[0.04] border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <Input
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="B2B SaaS, logistics…"
                      className="bg-white/[0.04] border-white/10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Who are you talking to?</Label>
                  <Input
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="Operations leaders at mid-market manufacturers"
                    className="bg-white/[0.04] border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tone of voice</Label>
                  <Textarea
                    value={toneOfVoice}
                    onChange={(e) => setToneOfVoice(e.target.value)}
                    rows={2}
                    placeholder="Confident and human. Plain language, no jargon, no hype."
                    className="bg-white/[0.04] border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Website (optional)</Label>
                  <Input
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://acme.example"
                    className="bg-white/[0.04] border-white/10"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(2)}
                    className="flex-1 text-white/50 hover:text-white"
                  >
                    Skip for now
                  </Button>
                  <Button
                    onClick={handleSaveBrand}
                    disabled={saving || !brandName.trim()}
                    className="flex-1 bg-violet-600 hover:bg-violet-500"
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
                  <p className="mt-1 text-sm text-white/45">
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
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                            previewPlatform === platform
                              ? "border-violet-500/60 bg-violet-600/15 text-violet-200"
                              : "border-white/[0.08] text-white/50 hover:bg-white/[0.04]"
                          )}
                        >
                          <meta.icon className="h-3.5 w-3.5" /> {meta.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-5 flex justify-center">
                    {generating ? (
                      <div className="flex h-64 flex-col items-center justify-center gap-3 text-white/40">
                        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                        <span className="text-sm">Writing a sample for {PLATFORM_META[previewPlatform].label}…</span>
                      </div>
                    ) : preview ? (
                      <PlatformPreview
                        platform={previewPlatform}
                        content={{
                          caption: preview.caption,
                          hashtags: preview.hashtags,
                          brandName: brandName || "Your Brand",
                          handle: brandName
                            ? brandName.toLowerCase().replace(/\s+/g, "")
                            : undefined,
                        }}
                      />
                    ) : (
                      <div className="flex h-40 items-center justify-center text-sm text-white/35">
                        Sample unavailable right now — you can still continue.
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => finish(false)}
                    className="flex-1 text-white/50 hover:text-white"
                  >
                    Explore the dashboard
                  </Button>
                  <Button
                    onClick={() => finish(true)}
                    className="flex-1 bg-violet-600 py-5 hover:bg-violet-500"
                  >
                    Create my first automation <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
                <p className="text-center text-xs text-white/30">
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
