import { useEffect, useMemo, useRef, useState } from"react";
import { useLocation, useNavigate, useSearchParams } from"react-router-dom";
import { useAction, useMutation, useQuery } from"convex/react";
import { getPreset } from"@/lib/presets";
import { motion, AnimatePresence } from"framer-motion";
import { toast } from"sonner";
import { doc, serverTimestamp, setDoc } from"firebase/firestore";
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
import { captureEvent, PRODUCT_EVENTS } from"@shared/lib/analytics";
import PreviewModule from"../components/previews/PreviewModule";
import BrandedSlide from"../components/carousel/BrandedSlide";
import { exportSlidePngs } from"../components/carousel/exportSlides";
import {
 ASPECT_SIZE,
 PLATFORM_ASPECT,
 defaultBrand,
 type CarouselBrand,
 type CarouselPack,
 type CarouselPlatform,
} from"../components/carousel/types";
import WebsitePostCard from"../components/creative/WebsitePostCard";
import {
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Facebook,
  Flame,
  Globe2,
  Image as ImageIcon,
  Instagram,
  Layers,
  Link2,
  Linkedin,
  Loader2,
  MessageCircle,
  Palette,
  Pencil,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  Twitter,
  Users,
  Volume2,
  Youtube,
} from "lucide-react";

const SCAN_STEPS = [
  { title: "Scanning website & homepage", detail: "Reading title, meta tags, and content structure" },
  { title: "Extracting brand logo & favicon", detail: "Locating high-resolution brand marks" },
  { title: "Sampling brand color palette", detail: "Finding primary, secondary & accent colors" },
  { title: "Analyzing audience & brand voice", detail: "Synthesizing tone, positioning & campaign hooks" },
];

function normalizeInputUrl(raw: string): string {
  let t = raw.trim();
  if (!t) return "";
  if (!/^https?:\/\//i.test(t)) {
    t = `https://${t}`;
  }
  return t;
}

function extractDomain(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return urlStr.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || "";
  }
}

function deriveBrandNameFromDomain(domain: string): string {
  const base = domain.split(".")[0] || domain;
  if (!base) return "Your Brand";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function createFallbackBrandResult(url: string, manualName?: string): BrandExtractResult {
  const domain = extractDomain(url);
  const name = manualName?.trim() || deriveBrandNameFromDomain(domain);
  const favicon = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : "";
  return {
    companyName: name,
    industry: "Digital & Technology",
    audience: "Modern consumers and growing businesses",
    tone: "Professional, authentic, innovative",
    hashtags: [domain.replace(/[^a-zA-Z0-9]/g, "").slice(0, 15) || "brand", "business", "innovation", "growth"].filter(Boolean),
    sampleCaptions: [
      `Welcome to ${name} — helping teams move faster and achieve more.`,
      `Built for consistency and growth. Discover what's new at ${name}.`,
    ],
    logoUrl: favicon,
    websiteImages: [],
    brandedImageUrl: "",
    brandedImageSource: "",
    colors: {
      primary: "#18181b",
      secondary: "#6366f1",
      accent: "#f59e0b",
    },
    fonts: ["Inter", "sans-serif"],
    coreIdentity: `${name} delivers modern solutions designed for quality and scale.`,
    productOffering: "Products and services for forward-thinking teams.",
    uniqueBenefits: "Speed, reliability, and modern user experience.",
    problemSolution: "Simplifying workflows and driving measurable results.",
    mission: `Empowering our audience through innovative solutions at ${domain || name}.`,
    differentiation: "Modern design, intelligent automation, and quality execution.",
    ownedSpace: name,
  };
}

const PLATFORM_META: Record<
 string,
 { label: string; icon: typeof Instagram; tint: string }
> = {
 instagram: { label:"Instagram", icon: Instagram, tint:"from-pink-500 to-orange-400" },
 facebook: { label:"Facebook", icon: Facebook, tint:"from-blue-600 to-indigo-500" },
 twitter: { label:"Twitter / X", icon: Twitter, tint:"from-sky-400 to-blue-500" },
 linkedin: { label:"LinkedIn", icon: Linkedin, tint:"from-blue-500 to-cyan-500" },
 youtube: { label:"YouTube", icon: Youtube, tint:"from-red-500 to-rose-500" },
 whatsapp: { label:"WhatsApp", icon: MessageCircle, tint:"from-emerald-500 to-teal-500" },
};

const CONNECTABLE: Array<"instagram" | "linkedin" | "youtube" | "facebook" | "whatsapp"> = [
 "instagram",
 "linkedin",
 "youtube",
 "facebook",
 "whatsapp",
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
 "facebook",
 "whatsapp",
];

type SamplePost = {
 id: string;
 hook: string;
 caption: string;
 hashtags: string[];
 whyShare?: string;
 trendUsed?: string;
};

function firstSentence(value: string): string {
 const line = value.split(/\n+/).map((part) => part.trim()).find(Boolean) ?? value.trim();
 const sentence = line.match(/^.{1,110}?[.!?](?:\s|$)/)?.[0]?.trim() ?? line;
 return sentence.slice(0, 110).replace(/[.!?]+$/, "");
}

function supportingCopy(value: string, hook: string): string {
 const rest = value.replace(hook, "").replace(/^[\s.!?—:-]+/, "").trim();
 return (rest || value).slice(0, 180);
}

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
 hook: firstSentence(caption),
 caption,
 hashtags: tags,
 }));
}

const STEPS = [
 { title: "Your website", icon: Globe2 },
 { title: "Connect your channels", icon: Link2 },
 { title: "Review & approve", icon: ShieldCheck },
];

export default function Onboarding() {
 const { user } = useAuth();
 const navigate = useNavigate();
 const location = useLocation();
 const [searchParams] = useSearchParams();
 const preset = getPreset(searchParams.get("preset"));
 const channelSetupOnly = location.pathname.endsWith("/channels");
 const [step, setStep] = useState(channelSetupOnly ? 1 : 0);
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
 const generateCarousel = useAction(api.carousel.generate);
 const uploadUrl = useMutation(api.studio.uploadUrl);
 const resolveUpload = useMutation(api.studio.resolveUpload);
 const upsertWebsiteBrand = useMutation(api.brands.upsertFromWebsite);
 const extractBrandConvex = useAction(api.brands.extractFromWebsite);

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
 const hasActiveChannel = accounts.some((account) => account.status === "active");

  // brand — website fetch only
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [brandPhase, setBrandPhase] = useState<"idle" | "scanning" | "ready" | "saving">("idle");
  const [scanStep, setScanStep] = useState(0);
  const [extracted, setExtracted] = useState<BrandExtractResult | null>(null);
  const [extractedUrl, setExtractedUrl] = useState("");
  const [brandName, setBrandName] = useState("");
  const [toneOfVoice, setToneOfVoice] = useState("");
  const [isEditingBrand, setIsEditingBrand] = useState(false);
  const [brandProfileId, setBrandProfileId] = useState<string>("");

 // preview — branded samples from fetch (no dependency on failing Firebase callable)
 const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>("linkedin");
 const [samples, setSamples] = useState<SamplePost[]>([]);
 const [activeSampleId, setActiveSampleId] = useState<string>("sample-0");
 const [generating, setGenerating] = useState(false);
 const [creativeMode, setCreativeMode] = useState<"image" | "carousel">("image");
 const [previewImageUrl, setPreviewImageUrl] = useState("");
 const [carouselPack, setCarouselPack] = useState<CarouselPack | null>(null);
 const [carouselGenerating, setCarouselGenerating] = useState(false);
 const [activeCarouselSlide, setActiveCarouselSlide] = useState(0);
 const [clientApproved, setClientApproved] = useState(false);
 const [posting, setPosting] = useState(false);
 const [previewCollapsed, setPreviewCollapsed] = useState(false);
 const imageCardRef = useRef<HTMLDivElement | null>(null);
 const carouselSlideRefs = useRef<(HTMLDivElement | null)[]>([]);
 const contentHydratedRef = useRef(false);
 const viewedStepRef = useRef<string | null>(null);

 const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

 const carouselPlatform: CarouselPlatform =
 previewPlatform === "instagram" || previewPlatform === "linkedin"
 ? previewPlatform
 : "instagram";
 const carouselAspect = PLATFORM_ASPECT[carouselPlatform];
 const carouselPreviewScale = 340 / ASPECT_SIZE[carouselAspect].w;
 const creativeBrand: CarouselBrand = useMemo(
 () =>
 defaultBrand({
 name: brandName || extracted?.companyName || "Your Brand",
 logoUrl: extracted?.logoUrl,
 colors: {
 primary: extracted?.colors.primary || "#171614",
 secondary: extracted?.colors.secondary || extracted?.colors.accent || "#5f4b8b",
 accent: extracted?.colors.accent || extracted?.colors.secondary || "#f2c14e",
 text: "#ffffff",
 muted: "rgba(255,255,255,0.78)",
 },
 }),
 [brandName, extracted],
 );

 useEffect(() => {
 if (!user || isConvexConfigured) return;
 getSocialAccounts(user.uid).then(setLegacyAccounts).catch(() => {});
 }, [user]);

 useEffect(() => {
 captureEvent(PRODUCT_EVENTS.onboardingStarted, {
 preset: preset?.label ?? "none",
 entry: channelSetupOnly ? "explicit_channel_setup" : "initial",
 });
 }, [preset?.label]);

 useEffect(() => {
 const stepKey = `${channelSetupOnly ? "explicit" : "initial"}:${step}`;
 if (viewedStepRef.current === stepKey) return;
 viewedStepRef.current = stepKey;
 const stepLabel = step === 0 ? "website" : step === 1 ? "social" : "review";
 captureEvent(PRODUCT_EVENTS.onboardingStepViewed, {
 step: stepLabel,
 entry: channelSetupOnly ? "explicit_channel_setup" : "initial",
 });

 // The automatic social-channel chooser is presented only in the initial
 // website-first attempt. If it is skipped, OnboardingGate lets the user into
 // the dashboard; a later chooser opens only after an explicit setup action.
 if (step === 1 && !channelSetupOnly && user && db) {
 void setDoc(
 doc(db, "users", user.uid),
 {
 socialSetupAttempted: true,
 socialSetupPresentedAt: serverTimestamp(),
 onboardingDeferred: true,
 onboardingLastAction: "social_setup_presented",
 },
 { merge: true },
 ).catch((error) => {
 console.warn("[onboarding] Could not record the social setup attempt", error);
 });
 }
 }, [channelSetupOnly, step, user]);

 // Returning from the OAuth round-trip: surface the result and refresh.
 useEffect(() => {
 const params = new URLSearchParams(window.location.search);
 const social = params.get("social");
 if (!social) return;
 if (social === "connected") {
 captureEvent(PRODUCT_EVENTS.channelConnected, {
 channel: params.get("provider") ?? "unknown",
 source: "onboarding",
 });
 toast.success(`${params.get("provider") ?? "Channel"} connected`);
 if (user && !isConvexConfigured) {
 getSocialAccounts(user.uid).then(setLegacyAccounts).catch(() => {});
 }
      } else if (social === "error") {
        const rawReason = params.get("reason");
        let cleanReason = rawReason?.replace(/^Error:\s*/, "").replace(/Uncaught\s+BadBodyError:\s*/, "") || "Could not connect channel";
        if (rawReason?.includes("no_facebook_pages")) {
          cleanReason = "Facebook connection failed: You must own or manage at least one Facebook Page under your account.";
        } else if (rawReason?.includes("feature_unavailable") || rawReason?.includes("unavailable") || rawReason?.includes("Facebook Login")) {
          cleanReason = "Facebook Login unavailable: Your Meta App is in Development mode or updating details in Meta Developer Console. Add test users under Roles in Meta Dashboard or complete App Review.";
        } else if (rawReason?.includes("access_denied")) {
          cleanReason = "Connection cancelled or access denied by user.";
        }
        toast.error(cleanReason, { duration: 6000 });
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
 captureEvent(PRODUCT_EVENTS.channelConnectStarted, {
 channel: provider,
 source: "onboarding",
 });
 setConnecting(provider);
 try {
 if (!isConvexConfigured) {
 toast.error("Convex is not configured — set VITE_CONVEX_URL.");
 setConnecting(null);
 return;
 }
 const { url, redirectUri } = await connectUrl({
 provider,
 returnTo: "/onboarding/channels",
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

  const updateExtractedField = (field: keyof BrandExtractResult, val: any) => {
    if (!extracted) return;
    setExtracted((prev) => (prev ? { ...prev, [field]: val } : prev));
  };

  const updateColor = (colorKey: "primary" | "secondary" | "accent", hex: string) => {
    if (!extracted) return;
    setExtracted((prev) =>
      prev
        ? {
            ...prev,
            colors: {
              ...prev.colors,
              [colorKey]: hex,
            },
          }
        : prev,
    );
  };

  const handleScanBrand = async () => {
    const url = normalizeInputUrl(websiteUrl);
    if (!url) {
      toast.error("Please enter your website or domain URL first.");
      return;
    }
    setWebsiteUrl(url);

    captureEvent(PRODUCT_EVENTS.onboardingWebsiteFetchStarted, {
      source: "onboarding",
    });
    setBrandPhase("scanning");
    setExtracted(null);
    setIsEditingBrand(false);
    contentHydratedRef.current = false;

    // Timeout helper to avoid infinite hanging if backend or external site is unresponsive
    const fetchWithTimeout = async () => {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Extraction timed out after 14s")), 14000)
      );
      const runner = async () => {
        if (isConvexConfigured) {
          try {
            const convexRes = await extractBrandConvex({ url });
            if (convexRes && (convexRes.companyName || convexRes.logoUrl || convexRes.colors?.primary)) {
              return convexRes as BrandExtractResult;
            }
          } catch (convexErr) {
            console.warn("[onboarding] Convex extract error, falling back to Firebase callable:", convexErr);
          }
        }
        return await extractBrandFromWebsite({ url });
      };
      return Promise.race([runner(), timeoutPromise]);
    };

    try {
      const result = await fetchWithTimeout();
      if (!result.companyName && !result.logoUrl && !result.colors?.primary) {
        const fallback = createFallbackBrandResult(url);
        const merged: BrandExtractResult = {
          ...fallback,
          ...result,
          companyName: result.companyName || fallback.companyName,
          logoUrl: result.logoUrl || fallback.logoUrl,
          colors: {
            primary: result.colors?.primary || fallback.colors.primary,
            secondary: result.colors?.secondary || fallback.colors.secondary,
            accent: result.colors?.accent || fallback.colors.accent,
          },
          industry: result.industry || fallback.industry,
          audience: result.audience || fallback.audience,
          tone: result.tone || fallback.tone,
        };
        setExtracted(merged);
        setExtractedUrl(url);
        setBrandName(merged.companyName);
        setToneOfVoice(merged.tone || "");
        setBrandPhase("ready");
        toast.info("Extracted core brand details — feel free to tweak them below.");
        return;
      }

      setExtracted(result);
      setExtractedUrl(url);
      setBrandName(result.companyName || deriveBrandNameFromDomain(extractDomain(url)));
      setToneOfVoice(result.tone || "");
      setBrandPhase("ready");
      toast.success("Brand Kit extracted successfully!");
    } catch (error) {
      console.warn("[onboarding] Extraction failed or timed out, generating domain fallback:", error);
      const fallback = createFallbackBrandResult(url);
      setExtracted(fallback);
      setExtractedUrl(url);
      setBrandName(fallback.companyName);
      setToneOfVoice(fallback.tone || "");
      setBrandPhase("ready");
      toast.info("Created brand profile from your domain — you can customize details below.");
    }
  };

  const handleManualBrandEntry = (customUrl?: string) => {
    const rawUrl = customUrl || websiteUrl.trim() || "https://mybrand.com";
    const url = normalizeInputUrl(rawUrl);
    setWebsiteUrl(url);
    const fallback = createFallbackBrandResult(url, brandName || undefined);
    setExtracted(fallback);
    setExtractedUrl(url);
    setBrandName(fallback.companyName);
    setToneOfVoice(fallback.tone || "");
    setIsEditingBrand(true);
    setBrandPhase("ready");
    toast.info("Enter your brand details below to customize your profile.");
  };

  const handleRescan = () => {
    setBrandPhase("idle");
    setIsEditingBrand(false);
  };

  const handleSaveBrand = async () => {
    if (!user) {
      toast.error("Please sign in to save your brand.");
      return;
    }
    setBrandPhase("saving");
    setSaving(true);
    try {
      const activeUrl = extractedUrl || normalizeInputUrl(websiteUrl) || "https://mybrand.com";
      const domain = extractDomain(activeUrl);
      const currentExtracted = extracted || createFallbackBrandResult(activeUrl, brandName || undefined);
      const finalName = brandName.trim() || currentExtracted.companyName || deriveBrandNameFromDomain(domain);
      const finalIndustry = currentExtracted.industry || "General";
      const finalTone = toneOfVoice.trim() || currentExtracted.tone || "Professional, modern, clear";
      const finalAudience = currentExtracted.audience || "Target customers & industry peers";
      const finalColors = {
        primary: currentExtracted.colors?.primary || "#18181b",
        secondary: currentExtracted.colors?.secondary || "#6366f1",
        accent: currentExtracted.colors?.accent || "#f59e0b",
      };
      const finalLogoUrl = currentExtracted.logoUrl || `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      const finalHashtags = (currentExtracted.hashtags ?? []).map((h) => h.replace(/^#/, "")).filter(Boolean);
      const finalSampleCaptions = currentExtracted.sampleCaptions?.length ? currentExtracted.sampleCaptions : undefined;

      const id = await saveBrandProfile({
        userId: user.uid,
        name: finalName,
        industry: finalIndustry,
        toneOfVoice: finalTone,
        audience: finalAudience,
        websiteUrl: activeUrl,
        logoUrl: finalLogoUrl,
        colors: finalColors,
        hashtagSets: {
          default: finalHashtags,
        },
        sampleCaptions: finalSampleCaptions,
        websiteImages: currentExtracted.websiteImages?.length ? currentExtracted.websiteImages : undefined,
        brandedImageUrl: currentExtracted.brandedImageUrl || undefined,
      });

      if (isConvexConfigured) {
        try {
          await upsertWebsiteBrand({
            legacyId: id,
            name: finalName,
            websiteUrl: activeUrl,
            logoUrl: finalLogoUrl,
            colors: finalColors,
            industry: finalIndustry,
            toneOfVoice: finalTone,
            audience: finalAudience,
            hashtagSets: {
              default: finalHashtags,
            },
            sampleCaptions: finalSampleCaptions,
          });
        } catch (error) {
          console.warn("[onboarding] Convex brand sync will retry from the saved kit", error);
        }
      }

      setBrandProfileId(id);
      setBrandName(finalName);
      setToneOfVoice(finalTone);

      if (db) {
        await setDoc(
          doc(db, "users", user.uid),
          {
            websiteSetupEnabledAt: serverTimestamp(),
            onboardingLastAction: "website_enabled",
          },
          { merge: true },
        );
      }

      captureEvent("brand_kit_completed", { source: "onboarding", has_website: true });
      captureEvent(PRODUCT_EVENTS.onboardingWebsiteEnabled, {
        source: "onboarding",
      });

      toast.success("Brand kit saved! Moving to social channels...");
      setStep(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save brand");
      setBrandPhase("ready");
    } finally {
      setSaving(false);
    }
  };

 const deferOnboarding = async (section: "website" | "social") => {
 try {
 if (user && db) {
 await setDoc(
 doc(db, "users", user.uid),
 {
 onboardingDeferred: true,
 onboardingLastAction: `${section}_skipped`,
 ...(section === "website"
 ? { websiteSetupSkippedAt: serverTimestamp() }
 : { socialSetupSkippedAt: serverTimestamp() }),
 },
 { merge: true },
 );
 }
 } catch (error) {
 console.error("[onboarding] Could not save the deferred setup choice", error);
 toast.error("Could not save your choice. Please try again.");
 return;
 }
 captureEvent(
 section === "website"
 ? PRODUCT_EVENTS.onboardingWebsiteSkipped
 : PRODUCT_EVENTS.onboardingSocialSkipped,
 { entry: channelSetupOnly ? "explicit_channel_setup" : "initial" },
 );
 toast("Setup saved for later. Maya stays locked until both steps are complete.");
 navigate("/");
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
 const discoveredImage = extracted?.websiteImages?.[0]?.url ?? "";
 setPreviewImageUrl(extracted?.brandedImageUrl || discoveredImage);

 // Best-effort AI polish via Convex — local website-derived samples stay
 // visible while the trend-aware image copy and carousel are prepared.
 if (!isConvexConfigured) return;
 setGenerating(true);
 setCarouselGenerating(true);
 const websiteEvidence = [
 extractedUrl && `Website: ${extractedUrl}`,
 extracted?.industry && `Industry: ${extracted.industry}`,
 extracted?.audience && `Audience: ${extracted.audience}`,
 toneOfVoice && `Tone: ${toneOfVoice}`,
 extracted?.sampleCaptions?.length &&
 `Website-derived voice examples:\n${extracted.sampleCaptions.map((caption) => `- ${caption}`).join("\n")}`,
 ]
 .filter(Boolean)
 .join("\n");
 const carouselTopic =
 extracted?.sampleCaptions?.[0] ||
 (extracted?.audience
 ? `A practical idea ${extracted.audience} can use today`
 : `A practical guide from ${brandName || extracted?.companyName || "this brand"}`);

 const [copyResult, carouselResult] = await Promise.allSettled([
 generateCopy({
 presetId: "text-post",
 platform: previewPlatform,
 prompt: SAMPLE_BRIEF,
 productName: brandName || extracted?.companyName || undefined,
 context: websiteEvidence,
 }),
 generateCarousel({
 topic: carouselTopic,
 brandName: brandName || extracted?.companyName || "Your Brand",
 brandTone: toneOfVoice || undefined,
 audience: extracted?.audience || undefined,
 industry: extracted?.industry || undefined,
 websiteUrl: extractedUrl || undefined,
 websiteContext: websiteEvidence || undefined,
 platform: carouselPlatform,
 slideCount: 5,
 }),
 ]);

 if (copyResult.status === "fulfilled") {
 const polished = copyResult.value;
 const next: SamplePost = {
 id: "ai-0",
 hook: polished.hook || firstSentence(polished.caption),
 caption: polished.caption,
 hashtags: (polished.hashtags ?? []).map((h) => h.replace(/^#/, "")),
 whyShare: polished.whyShare,
 trendUsed: polished.trendUsed,
 };
 setSamples((prev) => [next, ...prev.filter((s) => s.id !== "ai-0")].slice(0, 3));
 setActiveSampleId("ai-0");
 }
 if (carouselResult.status === "fulfilled") {
 const result = carouselResult.value;
 setCarouselPack({
 topic: result.topic,
 caption: result.caption,
 hashtags: result.hashtags,
 hookFamily: result.hookFamily,
 trendUsed: result.trendUsed,
 whySave: result.whySave,
 slides: result.slides as CarouselPack["slides"],
 });
 setActiveCarouselSlide(0);
 }
 setGenerating(false);
 setCarouselGenerating(false);
 };

 const handlePreviewPlatform = (platform: SocialPlatform) => {
 setPreviewPlatform(platform);
 };

 useEffect(() => {
 setClientApproved(false);
 }, [activeSampleId, creativeMode, previewPlatform]);

 useEffect(() => {
 if (step !== 2 || contentHydratedRef.current) return;
 contentHydratedRef.current = true;
 void hydrateSamples();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [step]);

 const activeCaption =
 creativeMode === "carousel" ? carouselPack?.caption ?? "" : activeSample?.caption ?? "";
 const activeHashtags =
 creativeMode === "carousel" ? carouselPack?.hashtags ?? [] : activeSample?.hashtags ?? [];
 const activeHook =
 creativeMode === "carousel"
 ? carouselPack?.slides[0]?.title ?? ""
 : activeSample?.hook || firstSentence(activeSample?.caption ?? "");
 const activeSupporting =
 creativeMode === "carousel"
 ? carouselPack?.slides[0]?.body ?? ""
 : supportingCopy(activeSample?.caption ?? "", activeHook);
 const activeTrend =
 creativeMode === "carousel" ? carouselPack?.trendUsed : activeSample?.trendUsed;
 const activeShareReason =
 creativeMode === "carousel" ? carouselPack?.whySave : activeSample?.whyShare;

 const uploadCreativePngs = async (dataUrls: string[]): Promise<string[]> => {
 const urls: string[] = [];
 for (const dataUrl of dataUrls) {
 const blob = await (await fetch(dataUrl)).blob();
 const target = await uploadUrl({});
 const response = await fetch(target, {
 method: "POST",
 headers: { "Content-Type": "image/png" },
 body: blob,
 });
 if (!response.ok) throw new Error("Creative upload failed");
 const { storageId } = (await response.json()) as { storageId: string };
 const resolved = await resolveUpload({ storageId: storageId as any });
 urls.push(resolved.url);
 }
 return urls;
 };

 const handleQuickPost = async (mode: "now" | "schedule") => {
 if (!activeCaption) return;
 if (!isConvexConfigured) {
 toast.error("Convex is not configured — can't publish yet.");
 return;
 }
 if (!clientApproved) {
 toast.error("Please approve the copy and creative before posting.");
 return;
 }
 if (!activeAccountForPreview) {
 toast.error(`Connect ${PLATFORM_META[previewPlatform].label} first to post this.`);
 return;
 }

 if (previewPlatform === "youtube") {
 toast.error("YouTube requires a video. Use this branded creative as the visual direction in Studio.");
 return;
 }
 if (creativeMode === "carousel" && !["instagram", "linkedin"].includes(previewPlatform)) {
 toast.error("Carousel posting is currently available for Instagram and LinkedIn.");
 return;
 }
 if (creativeMode === "image" && !previewImageUrl) {
 toast.error(
 `A finished branded image is required before posting to ${PLATFORM_META[previewPlatform].label}. Fetch the website again or use Studio.`,
 );
 return;
 }
 if (creativeMode === "carousel" && !carouselPack) {
 toast.error("The carousel is still being created.");
 return;
 }

 setPosting(true);
 try {
 const dataUrls =
 creativeMode === "carousel"
 ? await exportSlidePngs(carouselSlideRefs.current)
 : await exportSlidePngs([imageCardRef.current]);
 if (!dataUrls.length) throw new Error("Creative preview is not ready to export");
 const mediaUrls = await uploadCreativePngs(dataUrls);
 const result = await createPost({
 caption: activeCaption,
 hashtags: activeHashtags,
 platforms: [previewPlatform],
 socialAccountIds: [activeAccountForPreview.id],
 mediaUrls,
 mediaType: "image",
 mediaSource: "upload",
 brief:
 creativeMode === "carousel"
 ? carouselPack?.topic || SAMPLE_BRIEF
 : SAMPLE_BRIEF,
 brandProfileId: brandProfileId || undefined,
 mode,
 timezone,
 });
 if (mode === "now") {
 captureEvent("post_publish_requested", { channel: previewPlatform, source: "onboarding" });
 if (result.status === "posted") captureEvent("post_published", { channel: previewPlatform, source: "onboarding" });
 toast.success(
 result.status === "posted"
 ? `${creativeMode === "carousel" ? "Carousel" : "Image"} posted to ${PLATFORM_META[previewPlatform].label}`
 : `Approved — sending to ${PLATFORM_META[previewPlatform].label} now…`,
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
 if (!brandProfileId) {
 toast.error("Link your website before completing setup.");
 setStep(0);
 return;
 }
 if (!hasActiveChannel) {
 toast.error("Connect at least one social channel before activating Maya.");
 setStep(1);
 return;
 }
 await setDoc(
 doc(db, "users", user.uid),
 {
 onboardingComplete: true,
 onboardingDeferred: false,
 onboardingCompletedAt: serverTimestamp(),
 },
 { merge: true },
 );
 captureEvent(PRODUCT_EVENTS.onboardingCompleted, {
 next: goToWizard ? "automation_wizard" : "dashboard",
 });
 navigate(goToWizard ? "/automations/new" : "/");
 };

 const activateMayaAfterChannel = async () => {
 if (!user || !db || !hasActiveChannel) return;
 await setDoc(
 doc(db, "users", user.uid),
 {
 onboardingComplete: true,
 onboardingDeferred: false,
 onboardingCompletedAt: serverTimestamp(),
 },
 { merge: true },
 );
 captureEvent(PRODUCT_EVENTS.onboardingCompleted, {
 next: "maya",
 source: "channel_setup",
 });
 navigate("/maya");
 };

 return (
 <div className="h-[100dvh] flex flex-col overflow-hidden bg-background text-foreground">
  <div
  className={cn(
  "relative mx-auto flex flex-col flex-1 min-h-0 w-full py-4 lg:py-6",
  step === 2 ? "max-w-[1600px] px-4 lg:px-8 xl:px-12" : "max-w-3xl px-4",
  )}
  >
 <div className="mb-4 lg:mb-6 text-center shrink-0">
 <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center overflow-hidden">
  <img src="/logo.png" alt="MagicBox" className="h-full w-full object-contain" />
 </div>
 <span className="eyebrow text-[10px]">Get started</span>
 <h1 className="mt-1 font-display text-2xl sm:text-3xl tracking-tight">Turn your website into a campaign</h1>
 <p className="mt-1 text-sm text-muted-foreground max-w-xl mx-auto">
 Start with your site. Review the creative. Nothing posts without your approval.
 </p>
 </div>

 {/* Stepper */}
 <div className="mb-4 flex items-center justify-center gap-3 shrink-0">
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
 className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-6"
 >
      {step === 0 && (
        <div className="glass-card p-5 sm:p-8 space-y-6">
          {/* Phase A: Input State (Before Extraction) */}
          {brandPhase === "idle" && (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
                  <Sparkles className="h-3.5 w-3.5" />
                  Step 1 of 3 · Website & Brand Kit
                </div>
                <h2 className="mt-3 font-display text-2xl sm:text-3xl text-foreground">
                  Build your Brand Kit from your website
                </h2>
                <p className="mt-2 text-sm sm:text-base text-muted-foreground leading-relaxed">
                  Enter your domain or website URL. MagicBox AI scans your homepage to automatically extract your logo, color palette, brand voice, and positioning.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Globe2 className="h-3.5 w-3.5 text-brand" />
                    Website or Domain URL
                  </label>
                  <div className="relative">
                    <Globe2 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && websiteUrl.trim()) {
                          e.preventDefault();
                          void handleScanBrand();
                        }
                      }}
                      placeholder="e.g. nhancio.com or https://yourbrand.com"
                      className="h-13 bg-card border-border/90 pl-12 text-base shadow-sm focus-visible:ring-brand"
                      autoFocus
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => void handleScanBrand()}
                  disabled={!websiteUrl.trim()}
                  className="w-full h-12 text-base font-semibold bg-brand hover:bg-brand/90 text-brand-foreground shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="h-4.5 w-4.5" />
                  Analyze Website & Build Brand Kit
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/50 text-xs sm:text-sm">
                <button
                  type="button"
                  onClick={() => handleManualBrandEntry()}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors underline-offset-4 hover:underline"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Or enter brand details manually
                </button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void deferOnboarding("website")}
                  className="text-muted-foreground hover:text-foreground h-auto py-1 px-2"
                >
                  Skip setup for now →
                </Button>
              </div>
            </div>
          )}

          {/* Phase B: Loading / Scanning State */}
          {brandPhase === "scanning" && (
            <div className="space-y-6 py-4">
              <div className="text-center max-w-md mx-auto space-y-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/20 bg-brand/10 text-brand shadow-inner">
                  <Loader2 className="h-7 w-7 animate-spin text-brand" />
                </div>
                <h2 className="font-display text-2xl text-foreground">
                  Analyzing {extractDomain(normalizeInputUrl(websiteUrl)) || "your website"}…
                </h2>
                <p className="text-sm text-muted-foreground">
                  MagicBox AI is synthesizing your brand assets, color palette, and positioning.
                </p>
              </div>

              <div className="rounded-2xl border border-brand/20 bg-brand/[0.03] p-5 sm:p-6 space-y-3.5 max-w-lg mx-auto">
                {SCAN_STEPS.map((stepItem, i) => {
                  const isDone = i < scanStep;
                  const isCurrent = i === scanStep;
                  return (
                    <div
                      key={stepItem.title}
                      className={cn(
                        "flex items-start gap-3.5 transition-all duration-300",
                        isCurrent
                          ? "text-foreground font-medium"
                          : isDone
                          ? "text-muted-foreground"
                          : "text-muted-foreground/40"
                      )}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/20 text-brand">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        ) : isCurrent ? (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/20 text-brand">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded-full border border-border/80" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn("text-sm", isCurrent && "font-semibold text-foreground")}>
                          {stepItem.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {stepItem.detail}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-center pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRescan}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel and change URL
                </Button>
              </div>
            </div>
          )}

          {/* Phase C: Preview & Confirmation State */}
          {brandPhase === "ready" && extracted && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Brand Kit Extracted
                  </div>
                  <h2 className="mt-2 font-display text-2xl text-foreground">
                    Review your Brand Profile
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Confirm your brand details below before connecting your social channels.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingBrand((prev) => !prev)}
                    className="text-xs h-8 gap-1.5"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {isEditingBrand ? "Done Editing" : "Edit Details"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRescan}
                    className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Re-scan
                  </Button>
                </div>
              </div>

              {/* Rich Extracted Brand Preview Card */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 space-y-6 shadow-sm">
                {/* Brand Identity Header Row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="relative shrink-0">
                    {extracted.logoUrl ? (
                      <img
                        src={extracted.logoUrl}
                        alt=""
                        className="h-16 w-16 rounded-xl border border-border bg-card object-contain p-1.5 shadow-sm"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-secondary font-display text-2xl font-bold text-foreground border border-border">
                        {(brandName || extracted.companyName || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5 w-full">
                    {isEditingBrand ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="text-[11px] font-mono uppercase text-muted-foreground">Brand Name</label>
                          <Input
                            value={brandName || extracted.companyName}
                            onChange={(e) => {
                              setBrandName(e.target.value);
                              updateExtractedField("companyName", e.target.value);
                            }}
                            className="h-9 mt-1 text-sm bg-secondary/50"
                            placeholder="Brand Name"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-mono uppercase text-muted-foreground">Industry</label>
                          <Input
                            value={extracted.industry || ""}
                            onChange={(e) => updateExtractedField("industry", e.target.value)}
                            className="h-9 mt-1 text-sm bg-secondary/50"
                            placeholder="e.g. Technology, Apparel, Healthcare"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-2xl font-bold text-foreground leading-tight">
                            {brandName || extracted.companyName || extractDomain(extractedUrl || websiteUrl)}
                          </h3>
                          {extracted.industry && (
                            <span className="rounded-md border border-border/80 bg-secondary/80 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              {extracted.industry}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Globe2 className="h-3.5 w-3.5" />
                          <a
                            href={extractedUrl || normalizeInputUrl(websiteUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-foreground inline-flex items-center gap-1 underline-offset-4 hover:underline"
                          >
                            {extractDomain(extractedUrl || websiteUrl)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Color Palette Row */}
                <div className="space-y-2.5 pt-2 border-t border-border/60">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    <Palette className="h-3.5 w-3.5 text-brand" />
                    Extracted Brand Colors
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(["primary", "secondary", "accent"] as const).map((key) => {
                      const hex = extracted.colors?.[key] || (key === "primary" ? "#18181b" : key === "secondary" ? "#6366f1" : "#f59e0b");
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-2.5"
                        >
                          <div
                            className="h-9 w-9 rounded-lg border border-black/10 shadow-sm shrink-0"
                            style={{ background: hex }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                              {key}
                            </div>
                            {isEditingBrand ? (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <input
                                  type="color"
                                  value={hex.startsWith("#") && hex.length === 7 ? hex : "#000000"}
                                  onChange={(e) => updateColor(key, e.target.value)}
                                  className="h-5 w-5 rounded cursor-pointer border-0 bg-transparent p-0"
                                />
                                <input
                                  type="text"
                                  value={hex}
                                  onChange={(e) => updateColor(key, e.target.value)}
                                  className="h-6 w-20 rounded border border-border bg-card px-1.5 font-mono text-xs"
                                />
                              </div>
                            ) : (
                              <div className="font-mono text-xs font-medium text-foreground">
                                {hex}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Brand Positioning & Voice Row */}
                <div className="space-y-3 pt-2 border-t border-border/60">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-brand" />
                    Brand Positioning & Voice
                  </div>

                  {isEditingBrand ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-mono uppercase text-muted-foreground">Core Tagline / Bio</label>
                        <Input
                          value={extracted.coreIdentity || extracted.mission || ""}
                          onChange={(e) => updateExtractedField("coreIdentity", e.target.value)}
                          className="h-9 mt-1 text-sm bg-secondary/50"
                          placeholder="Short summary of what your brand does"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="text-[11px] font-mono uppercase text-muted-foreground">Tone of Voice</label>
                          <Input
                            value={toneOfVoice || extracted.tone || ""}
                            onChange={(e) => {
                              setToneOfVoice(e.target.value);
                              updateExtractedField("tone", e.target.value);
                            }}
                            className="h-9 mt-1 text-sm bg-secondary/50"
                            placeholder="e.g. Professional, authoritative, friendly"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-mono uppercase text-muted-foreground">Target Audience</label>
                          <Input
                            value={extracted.audience || ""}
                            onChange={(e) => updateExtractedField("audience", e.target.value)}
                            className="h-9 mt-1 text-sm bg-secondary/50"
                            placeholder="e.g. B2B founders, marketing leaders"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(extracted.coreIdentity || extracted.mission || extracted.productOffering) && (
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed italic bg-secondary/30 rounded-xl p-3 border border-border/50">
                          &ldquo;{extracted.coreIdentity || extracted.mission || extracted.productOffering}&rdquo;
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        {(toneOfVoice || extracted.tone) && (
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-xs text-foreground">
                            <Volume2 className="h-3.5 w-3.5 text-brand" />
                            <span className="font-medium">Tone:</span>
                            <span className="text-muted-foreground">{toneOfVoice || extracted.tone}</span>
                          </div>
                        )}

                        {extracted.audience && (
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-xs text-foreground">
                            <Users className="h-3.5 w-3.5 text-brand" />
                            <span className="font-medium">Audience:</span>
                            <span className="text-muted-foreground">{extracted.audience}</span>
                          </div>
                        )}

                        {extracted.hashtags && extracted.hashtags.length > 0 && (
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-xs text-foreground">
                            <Tag className="h-3.5 w-3.5 text-brand" />
                            <span className="text-muted-foreground truncate max-w-[200px]">
                              {extracted.hashtags.slice(0, 3).map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons: Clear Save & Continue */}
              <div className="flex flex-col-reverse sm:flex-row items-center gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="w-full sm:w-auto text-muted-foreground hover:text-foreground text-sm"
                >
                  Skip to channels →
                </Button>
                <Button
                  onClick={() => void handleSaveBrand()}
                  disabled={saving}
                  className="w-full sm:flex-1 h-12 text-base font-semibold bg-brand hover:bg-brand/90 text-brand-foreground shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-4.5 w-4.5" />
                  )}
                  <span>Save Brand Kit & Continue to Channels</span>
                  <ArrowRight className="h-4.5 w-4.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="glass-card space-y-5 p-4 sm:p-6">
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
            <h2 className="font-display text-2xl">{STEPS[1].title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect at least one channel where approved content can go. Nothing is posted
              at this step; the connection activates Maya after your website is ready.
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

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Channel Setup Notes:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><strong className="text-foreground">YouTube:</strong> If Google displays <em>&quot;Google hasn&apos;t verified this app&quot;</em>, click <strong>Advanced → Go to MagicBox (unsafe)</strong> to proceed.</li>
              <li><strong className="text-foreground">Facebook, Instagram &amp; WhatsApp:</strong> If Meta displays <em>&quot;Feature unavailable&quot;</em>, ensure your Meta App is set to Live or your Meta account is added as a Tester/Admin in Meta Developer Dashboard.</li>
            </ul>
          </div>

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
            <Button
              onClick={() => toast.info("Buy warmed up accounts feature coming soon! Pre-warmed aged accounts with clean reputation.")}
              variant="outline"
              className="justify-start py-5 border-dashed border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            >
              <Flame className="mr-2 h-4 w-4 text-amber-500" />
              Buy Warmed Up Accounts — Soon
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[auto_auto_1fr]">
            <Button
              onClick={() => setStep(0)}
              variant="ghost"
              className="w-full sm:w-auto text-muted-foreground"
            >
              Back to website
            </Button>
            <Button
              onClick={() => void deferOnboarding("social")}
              variant="ghost"
              className="w-full sm:w-auto text-muted-foreground"
            >
              Skip for now
            </Button>
            <Button
              onClick={() => setStep(2)}
              disabled={!hasActiveChannel}
              className="w-full h-auto py-3.5 px-4 text-xs sm:text-sm"
            >
              <span className="truncate">
                {hasActiveChannel
                  ? "Review my campaign"
                  : "Connect one channel to continue"}
              </span>
              <ArrowRight className="ml-1.5 h-4 w-4 shrink-0" />
            </Button>
          </div>
        </div>
      )}

 {step === 2 && (
 <div
 className={cn(
 "grid gap-5 lg:h-[calc(100vh-280px)]",
 previewCollapsed
 ? "lg:grid-cols-[minmax(0,1fr)_3.5rem]"
 : "lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]",
 )}
 >
 <div
 className={cn(
 "min-w-0 space-y-5 lg:overflow-y-auto lg:pr-2 lg:pb-4 no-scrollbar",
 !previewCollapsed && "pb-[min(52vh,440px)] lg:pb-4",
 )}
 >
 <div className="glass-card overflow-hidden">
 <div className="border-b border-border bg-secondary/35 p-6">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-brand">
 <ShieldCheck className="h-3.5 w-3.5" />
 Approval workspace
 </div>
 <h2 className="font-display text-3xl">{STEPS[2].title}</h2>
 <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
 MagicBox used the website&apos;s strongest imagery, logo, palette, audience, and
 voice. Review the hook and finished creative before granting permission to post.
 </p>
 </div>
 {(extracted?.logoUrl || brandName) && (
 <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-sm">
 {extracted?.logoUrl ? (
 <img
 src={extracted.logoUrl}
 alt=""
 className="h-7 w-7 rounded-full object-contain"
 />
 ) : null}
 <span className="text-xs font-semibold">{brandName || "Your brand"}</span>
 </div>
 )}
 </div>
 <div className="mt-5 grid gap-2 sm:grid-cols-3">
 {[
 ["Website grounded", "Copy follows the supplied site"],
 ["Logo locked", "Brand mark stays consistent"],
 ["Permission first", "No automatic publishing"],
 ].map(([label, detail]) => (
 <div key={label} className="rounded-lg border border-border bg-card px-3 py-2.5">
 <div className="flex items-center gap-1.5 text-xs font-semibold">
 <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
 {label}
 </div>
 <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>
 </div>
 ))}
 </div>
 </div>

 <div className="space-y-5 p-6">
 <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary p-1.5">
 <button
 type="button"
 onClick={() => setCreativeMode("image")}
 className={cn(
 "flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition-all",
 creativeMode === "image"
 ? "bg-card text-foreground shadow-sm ring-1 ring-border"
 : "text-muted-foreground hover:text-foreground",
 )}
 >
 <ImageIcon className="h-4 w-4" />
 Image post
 </button>
 <button
 type="button"
 onClick={() => setCreativeMode("carousel")}
 className={cn(
 "flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition-all",
 creativeMode === "carousel"
 ? "bg-card text-foreground shadow-sm ring-1 ring-border"
 : "text-muted-foreground hover:text-foreground",
 )}
 >
 <Layers className="h-4 w-4" />
 Carousel {carouselPack ? `· ${carouselPack.slides.length} slides` : ""}
 </button>
 </div>

 {creativeMode === "image" && samples.length > 1 && (
 <div className="flex flex-wrap gap-2">
 {samples.map((sample, index) => (
 <button
 key={sample.id}
 type="button"
 onClick={() => setActiveSampleId(sample.id)}
 className={cn(
 "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
 activeSampleId === sample.id
 ? "border-foreground bg-foreground text-background"
 : "border-border text-muted-foreground hover:bg-secondary",
 )}
 >
 Hook {index + 1}
 </button>
 ))}
 </div>
 )}

 {creativeMode === "carousel" && carouselPack && (
 <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2">
 {carouselPack.slides.map((slide, index) => (
 <button
 key={`${slide.title}-${index}`}
 type="button"
 onClick={() => setActiveCarouselSlide(index)}
 className={cn(
 "snap-start rounded-lg border px-3 py-2 text-left transition-colors",
 activeCarouselSlide === index
 ? "border-foreground bg-foreground text-background"
 : "border-border bg-card text-muted-foreground hover:bg-secondary",
 )}
 >
 <span className="font-mono text-[9px] uppercase tracking-widest">
 {index + 1}/{carouselPack.slides.length}
 </span>
 <span className="mt-0.5 block max-w-36 truncate text-xs font-semibold">
 {slide.title}
 </span>
 </button>
 ))}
 </div>
 )}

 {(generating || carouselGenerating) && (
 <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
 <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
 {generating && carouselGenerating
 ? "Writing the strongest hooks and building the carousel…"
 : carouselGenerating
 ? "Building the carousel…"
 : "Polishing the image-post copy…"}
 </div>
 )}

 {activeCaption ? (
 <div className="rounded-xl border border-border bg-card p-4">
 <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
 {creativeMode === "carousel" ? "Carousel caption" : "Post copy"}
 </div>
 <h3 className="mt-2 font-display text-xl leading-tight">{activeHook}</h3>
 <p className="mt-2 line-clamp-5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
 {activeCaption}
 </p>
 <div className="mt-3 flex flex-wrap gap-1.5">
 {activeHashtags.slice(0, 6).map((tag) => (
 <span key={tag} className="rounded-full bg-secondary px-2 py-1 text-[10px] text-muted-foreground">
 #{tag.replace(/^#/, "")}
 </span>
 ))}
 </div>
 {(activeTrend || activeShareReason) ? (
 <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
 {activeTrend ? (
 <p><span className="font-semibold text-foreground">Trend signal:</span> {activeTrend}</p>
 ) : null}
 {activeShareReason ? (
 <p className="mt-1">
 <span className="font-semibold text-foreground">
 {creativeMode === "carousel" ? "Why it earns a save:" : "Why it earns a share:"}
 </span>{" "}
 {activeShareReason}
 </p>
 ) : null}
 </div>
 ) : null}
 </div>
 ) : !generating && !carouselGenerating ? (
 <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
 Go back and enter a website to unlock branded campaign drafts.
 </div>
 ) : null}

 {creativeMode === "carousel" && !["instagram", "linkedin"].includes(previewPlatform) && (
 <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
 Multi-image publishing is currently available for Instagram and LinkedIn.
 Switch the preview platform to approve this carousel.
 </div>
 )}

 <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-foreground/15 bg-secondary/60 p-4">
 <input
 type="checkbox"
 checked={clientApproved}
 onChange={(event) => setClientApproved(event.target.checked)}
 className="mt-0.5 h-4 w-4 accent-black"
 />
 <span>
 <span className="block text-sm font-semibold text-foreground">
 I approve this copy and creative for {PLATFORM_META[previewPlatform].label}
 </span>
 <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
 MagicBox will only post the version visible in the preview. Editing the hook,
 format, or platform clears this permission and asks again.
 </span>
 </span>
 </label>

        {activeAccountForPreview ? (
          <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2">
            <Button
              onClick={() => void handleQuickPost("now")}
              disabled={posting || !clientApproved || !activeCaption}
              className="w-full h-auto py-3.5 px-4 text-xs sm:text-sm"
            >
              {posting ? <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" /> : <Send className="mr-1.5 h-4 w-4 shrink-0" />}
              <span className="truncate">Approve & post now</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleQuickPost("schedule")}
              disabled={posting || !clientApproved || !activeCaption}
              className="w-full h-auto py-3.5 px-4 text-xs sm:text-sm"
            >
              {posting ? <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" /> : <CalendarClock className="mr-1.5 h-4 w-4 shrink-0" />}
              <span className="truncate">Approve for next best time</span>
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setStep(1)} className="w-full h-auto py-3.5 px-4 text-xs sm:text-sm">
            <span className="truncate">Connect {PLATFORM_META[previewPlatform].label} to post after approval</span>
            <ArrowRight className="ml-1.5 h-4 w-4 shrink-0" />
          </Button>
        )}
 </div>
 </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <Button
            variant="ghost"
            onClick={() => finish(false)}
            className="w-full sm:flex-1 text-muted-foreground hover:text-foreground"
          >
            Explore the dashboard
          </Button>
          <Button
            onClick={() => finish(true)}
            className="w-full sm:flex-1 bg-brand h-auto py-3.5 px-4 text-xs sm:text-sm hover:bg-brand"
          >
            <span className="truncate">Create my first automation</span>
            <ArrowRight className="ml-1.5 h-4 w-4 shrink-0" />
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
 "h-full",
 previewCollapsed
 ? "min-h-[min(48vh,280px)] lg:min-h-0"
 : "max-h-[min(48vh,420px)] min-h-0 lg:max-h-none",
 )}
 title={clientApproved ? "Approved preview" : "Approval preview"}
 platform={previewPlatform}
 onPlatformChange={handlePreviewPlatform}
 allowedPlatforms={PREVIEW_PLATFORMS}
 content={
 activeCaption
 ? {
 caption: activeCaption,
 hashtags: activeHashtags,
 mediaAspect: creativeMode === "carousel" ? carouselAspect : "4:5",
 mediaNode:
 creativeMode === "carousel" && carouselPack
 ? (
 <BrandedSlide
 slide={carouselPack.slides[activeCarouselSlide] ?? carouselPack.slides[0]}
 brand={creativeBrand}
 aspect={carouselAspect}
 index={activeCarouselSlide}
 total={carouselPack.slides.length}
 scale={carouselPreviewScale}
 />
 )
 : (
 <WebsitePostCard
 brand={creativeBrand}
 hook={activeHook}
 supporting={activeSupporting}
 eyebrow={extracted?.industry || "From your website"}
 imageUrl={previewImageUrl || undefined}
 scale={340 / 1080}
 />
 ),
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
 generating || carouselGenerating
 ? "Building website-grounded campaign drafts…"
 : "Go back and enter a website to unlock campaign drafts."
 }
 footer={
 <div className="flex items-center gap-2 text-xs">
 {clientApproved ? (
 <>
 <CheckCircle2 className="h-4 w-4 text-emerald-600" />
 <span className="font-medium text-emerald-700">Client permission confirmed for this version</span>
 </>
 ) : (
 <>
 <ShieldCheck className="h-4 w-4 text-muted-foreground" />
 <span className="text-muted-foreground">Waiting for explicit approval</span>
 </>
 )}
 </div>
 }
 />
 </div>
 <div
 aria-hidden
 style={{
 position: "fixed",
 left: -10000,
 top: 0,
 pointerEvents: "none",
 opacity: 0,
 }}
 >
 {activeCaption ? (
 <WebsitePostCard
 brand={creativeBrand}
 hook={activeHook}
 supporting={activeSupporting}
 eyebrow={extracted?.industry || "From your website"}
 imageUrl={previewImageUrl || undefined}
 scale={1}
 cardRef={(element) => {
 imageCardRef.current = element;
 }}
 />
 ) : null}
 {carouselPack?.slides.map((slide, index) => (
 <BrandedSlide
 key={`onboarding-export-${index}`}
 slide={slide}
 brand={creativeBrand}
 aspect={carouselAspect}
 index={index}
 total={carouselPack.slides.length}
 scale={1}
 slideRef={(element) => {
 carouselSlideRefs.current[index] = element;
 }}
 />
 ))}
 </div>
 </div>
 )}
 </motion.div>
 </AnimatePresence>
 </div>
 </div>
 );
}
