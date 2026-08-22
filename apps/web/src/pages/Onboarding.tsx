import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { getPreset } from "@/lib/presets";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { doc, serverTimestamp, setDoc, collection } from "firebase/firestore";
import { db } from "@shared/lib/firebase";
import { useAuth } from "@shared/lib/auth";
import { api } from "@convex/_generated/api";
import { isConvexConfigured } from "../lib/convex";
import type { SocialAccount, SocialPlatform, SocialProvider, BrandProfile } from "@shared/types";
import { deleteSocialAccount, getBrandProfiles, getSocialAccounts, saveBrandProfile, saveSocialAccount, stripUndefined } from "@shared/lib/automations";
import {
  extractBrandFromWebsite,
  type BrandExtractResult,
} from "@shared/lib/suite";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/avatar";
import { cn } from "@shared/lib/utils";
import { captureEvent, PRODUCT_EVENTS } from "@shared/lib/analytics";
import PlatformPreview from "../components/previews/PlatformPreview";
import PhoneFrame from "../components/previews/PhoneFrame";
import BrandedSlide from "../components/carousel/BrandedSlide";
import { exportSlidePngs } from "../components/carousel/exportSlides";
import {
  ASPECT_SIZE,
  PLATFORM_ASPECT,
  defaultBrand,
  type CarouselBrand,
  type CarouselPack,
  type CarouselPlatform,
} from "../components/carousel/types";
import WebsitePostCard from "../components/creative/WebsitePostCard";
import { WhatsAppV2Modal, isWhatsAppV2Active } from "./Integrations";
import {
  ArrowRight,
  BatteryFull,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Facebook,
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
  Signal,
  Sparkles,
  Tag,
  Twitter,
  Users,
  Video,
  Volume2,
  Wifi,
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
  const favicon = domain ? `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128` : "";
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
  {
    label: string;
    icon: typeof Instagram;
    tint: string;
    category: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  instagram: {
    label: "Instagram",
    icon: Instagram,
    tint: "from-pink-500 to-orange-400",
    category: "Social & Visual",
    badgeBg: "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]",
    badgeText: "text-white",
  },
  linkedin: {
    label: "LinkedIn",
    icon: Linkedin,
    tint: "from-blue-600 to-cyan-500",
    category: "Professional",
    badgeBg: "bg-[#0A66C2]",
    badgeText: "text-white",
  },
  youtube: {
    label: "YouTube",
    icon: Youtube,
    tint: "from-red-500 to-rose-600",
    category: "Video & Shorts",
    badgeBg: "bg-[#FF0000]",
    badgeText: "text-white",
  },
  tiktok: {
    label: "TikTok",
    icon: Video,
    tint: "from-fuchsia-500 to-cyan-400",
    category: "Short-form Video",
    badgeBg: "bg-black dark:bg-zinc-900",
    badgeText: "text-white",
  },
  twitter: {
    label: "Twitter / X",
    icon: Twitter,
    tint: "from-sky-400 to-blue-500",
    category: "Real-time & News",
    badgeBg: "bg-[#1DA1F2]",
    badgeText: "text-white",
  },
  x: {
    label: "X (Twitter)",
    icon: Twitter,
    tint: "from-slate-700 to-slate-900",
    category: "Real-time & News",
    badgeBg: "bg-black dark:bg-zinc-900",
    badgeText: "text-white",
  },
  facebook: {
    label: "Facebook",
    icon: Facebook,
    tint: "from-blue-600 to-indigo-500",
    category: "Social & Community",
    badgeBg: "bg-[#1877F2]",
    badgeText: "text-white",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    tint: "from-emerald-500 to-teal-500",
    category: "Messaging",
    badgeBg: "bg-[#25D366]",
    badgeText: "text-white",
  },
  reddit: {
    label: "Reddit",
    icon: MessageCircle,
    tint: "from-orange-500 to-red-500",
    category: "Communities",
    badgeBg: "bg-[#FF4500]",
    badgeText: "text-white",
  },
};

const CONNECTABLE = [
  "instagram",
  "youtube",
  "linkedin",
  "facebook",
  "whatsapp",
  "x",
  "reddit",
  "tiktok",
] as const;

function channelHandle(account: SocialAccount): string {
  const raw = (account.username || account.displayName || "").trim();
  if (!raw) return account.externalId ? `id:${account.externalId.slice(0, 8)}` : "connected";
  return raw.startsWith("@") ? raw : `@${raw.replace(/^@/, "")}`;
}

const SAMPLE_BRIEF =
  "Share one practical insight that positions the brand as a calm expert worth following.";

const PREVIEW_PLATFORMS: SocialPlatform[] = [
  "instagram",
  "linkedin",
  "youtube",
  "twitter",
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
    hashtags: tags.length ? tags : ["brand", "marketing", "growth"],
  }));
}

const STEPS = [
  { title: "Website & Brand", icon: Globe2 },
  { title: "Connect channels", icon: Link2 },
  { title: "Review & approve", icon: ShieldCheck },
];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const preset = getPreset(searchParams.get("preset"));
  const channelSetupOnly = location.pathname.endsWith("/channels");

  const getInitialStep = () => {
    if (channelSetupOnly) return 1;
    try {
      const saved = sessionStorage.getItem("magicbox_onboarding_step");
      if (saved === "1" || saved === "2") return parseInt(saved, 10);
    } catch {}
    return 0;
  };
  const [step, setStepState] = useState<number>(getInitialStep);
  const setStep = (s: number) => {
    setStepState(s);
    try {
      sessionStorage.setItem("magicbox_onboarding_step", String(s));
    } catch {}
  };

  const [legacyAccounts, setLegacyAccounts] = useState<SocialAccount[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);

  // Convex queries and mutations
  const convexAccounts = useQuery(api.social.accounts, isConvexConfigured ? {} : "skip");
  const convexBrands = useQuery(api.brands.list, isConvexConfigured ? {} : "skip");
  const connectUrl = useAction(api.social.connectUrl);
  const createPost = useAction(api.studio.createPost);
  const generateCopy = useAction(api.studio.generateCopy);
  const generateCarousel = useAction(api.carousel.generate);
  const uploadUrl = useMutation(api.studio.uploadUrl);
  const resolveUpload = useMutation(api.studio.resolveUpload);
  const upsertWebsiteBrand = useMutation(api.brands.upsertFromWebsite);
  const extractBrandConvex = useAction(api.brands.extractFromWebsite);

  const accounts: SocialAccount[] = useMemo(() => {
    if (isConvexConfigured) {
      return (convexAccounts ?? [])
        .filter((a: any) => a.status === "active" || a.status === "expired")
        .map((a: any) => ({
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
    return (legacyAccounts ?? []).filter(
      (a) => a.status !== "disconnected",
    );
  }, [convexAccounts, legacyAccounts]);

  const connectedByPlatform = useMemo(() => {
    const map = new Map<string, SocialAccount>();
    for (const a of accounts) {
      if (a.status === "active" || a.status === "expired") {
        map.set(a.platform, a);
        if ((a.platform as string) === "twitter") map.set("x", a);
        if ((a.platform as string) === "x") map.set("twitter", a);
      }
    }
    return map;
  }, [accounts]);
  const hasActiveChannel = accounts.some((account) => account.status === "active");

  // brand — website fetch & hydration
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [brandPhase, setBrandPhase] = useState<"idle" | "scanning" | "ready" | "saving">("idle");
  const [scanStep, setScanStep] = useState(0);
  const [extracted, setExtracted] = useState<BrandExtractResult | null>(null);
  const [extractedUrl, setExtractedUrl] = useState("");
  const [brandName, setBrandName] = useState("");
  const [toneOfVoice, setToneOfVoice] = useState("");
  const [isEditingBrand, setIsEditingBrand] = useState(false);
  const [brandProfileId, setBrandProfileId] = useState<string>("");
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  // preview — branded samples from fetch
  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>("linkedin");
  const [samples, setSamples] = useState<SamplePost[]>([]);
  const [activeSampleId, setActiveSampleId] = useState<string>("sample-0");
  const [generating, setGenerating] = useState(false);
  const [creativeMode, setCreativeMode] = useState<"image" | "carousel">("image");
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [carouselPack, setCarouselPack] = useState<CarouselPack | null>(null);
  const [carouselGenerating, setCarouselGenerating] = useState(false);
  const [activeCarouselSlide, setActiveCarouselSlide] = useState(0);
  const [posting, setPosting] = useState(false);
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

  // Load existing brand profile from Convex or Firestore on mount
  useEffect(() => {
    if (!user) return;
    if (isConvexConfigured && convexBrands && convexBrands.length > 0 && !brandProfileId) {
      const activeBrand = convexBrands.find((b: any) => b.websiteUrl) || convexBrands[0];
      if (activeBrand) {
        setBrandProfileId(activeBrand.legacyId || activeBrand._id);
        setBrandName(activeBrand.name || "");
        setWebsiteUrl(activeBrand.websiteUrl || "");
        setExtractedUrl(activeBrand.websiteUrl || "");
        setToneOfVoice(activeBrand.toneOfVoice || "");
        const hydratedExtracted: BrandExtractResult = {
          companyName: activeBrand.name,
          industry: activeBrand.industry || "Digital & Technology",
          audience: activeBrand.audience || "Modern consumers and growing businesses",
          tone: activeBrand.toneOfVoice || "Professional, authentic, innovative",
          hashtags: activeBrand.hashtagSets?.default || ["brand", "growth", "business"],
          sampleCaptions: activeBrand.sampleCaptions || [],
          logoUrl: activeBrand.logoUrl || "",
          websiteImages: [],
          brandedImageUrl: "",
          brandedImageSource: "",
          colors: {
            primary: activeBrand.colors?.primary || "#18181b",
            secondary: activeBrand.colors?.secondary || "#6366f1",
            accent: activeBrand.colors?.accent || "#f59e0b",
          },
          fonts: ["Inter", "sans-serif"],
          coreIdentity: activeBrand.coreIdentity,
          productOffering: activeBrand.productOffering,
          uniqueBenefits: activeBrand.uniqueBenefits,
          problemSolution: activeBrand.problemSolution,
          mission: activeBrand.mission,
          differentiation: activeBrand.differentiation,
          ownedSpace: activeBrand.ownedSpace,
        };
        setExtracted(hydratedExtracted);
        setBrandPhase("ready");
      }
    }
  }, [user, convexBrands, brandProfileId]);

  useEffect(() => {
    if (!user || brandProfileId) return;
    getBrandProfiles(user.uid)
      .then((profiles) => {
        if (profiles && profiles.length > 0 && !brandProfileId) {
          const activeBrand = profiles.find((b) => b.websiteUrl) || profiles[0];
          if (activeBrand) {
            setBrandProfileId(activeBrand.id);
            setBrandName(activeBrand.name || "");
            setWebsiteUrl(activeBrand.websiteUrl || "");
            setExtractedUrl(activeBrand.websiteUrl || "");
            setToneOfVoice(activeBrand.toneOfVoice || "");
            const hydratedExtracted: BrandExtractResult = {
              companyName: activeBrand.name,
              industry: activeBrand.industry || "Digital & Technology",
              audience: activeBrand.audience || "Modern consumers and growing businesses",
              tone: activeBrand.toneOfVoice || "Professional, authentic, innovative",
              hashtags: activeBrand.hashtagSets?.default || ["brand", "growth", "business"],
              sampleCaptions: activeBrand.sampleCaptions || [],
              logoUrl: activeBrand.logoUrl || "",
              websiteImages: activeBrand.websiteImages || [],
              brandedImageUrl: activeBrand.brandedImageUrl || "",
              brandedImageSource: activeBrand.brandedImageUrl ? "website" : "",
              colors: {
                primary: activeBrand.colors?.primary || "#18181b",
                secondary: activeBrand.colors?.secondary || "#6366f1",
                accent: activeBrand.colors?.accent || "#f59e0b",
              },
              fonts: ["Inter", "sans-serif"],
              coreIdentity: activeBrand.coreIdentity,
              productOffering: activeBrand.productOffering,
              uniqueBenefits: activeBrand.uniqueBenefits,
              problemSolution: activeBrand.problemSolution,
              mission: activeBrand.mission,
              differentiation: activeBrand.differentiation,
              ownedSpace: activeBrand.ownedSpace,
            };
            setExtracted(hydratedExtracted);
            setBrandPhase("ready");
          }
        }
      })
      .catch((err) => console.warn("[onboarding] Firestore brand profile fetch error:", err));
  }, [user, brandProfileId]);

  useEffect(() => {
    if (!user) return;
    getSocialAccounts(user.uid).then(setLegacyAccounts).catch(() => {});
  }, [user]);

  // Dual-sync: keep Firestore in sync with Convex-connected channels
  useEffect(() => {
    if (!user || !isConvexConfigured || convexAccounts === undefined) return;
    const currentPlatforms = new Set(
      convexAccounts
        .filter((a: any) => a.status === "active" || a.status === "expired")
        .map((a: any) => a.platform),
    );

    for (const acc of convexAccounts) {
      if (acc.status === "active" || acc.status === "expired") {
        void saveSocialAccount({
          userId: user.uid,
          provider: acc.provider as SocialProvider,
          platform: acc.platform as SocialPlatform,
          externalId: acc.externalId,
          username: acc.username ?? "",
          displayName: acc.displayName ?? acc.username ?? "",
          avatarUrl: acc.avatarUrl,
          status: acc.status,
          linkedAt: acc.linkedAt,
        }).catch(() => {});
      }
    }

    // Remove any stale legacy accounts no longer present in Convex
    for (const leg of legacyAccounts) {
      if (!currentPlatforms.has(leg.platform)) {
        void deleteSocialAccount(leg.id);
      }
    }
  }, [user, convexAccounts, legacyAccounts]);

  useEffect(() => {
    captureEvent(PRODUCT_EVENTS.onboardingStarted, {
      preset: preset?.label ?? "none",
      entry: channelSetupOnly ? "explicit_channel_setup" : "initial",
    });
  }, [preset?.label, channelSetupOnly]);

  useEffect(() => {
    const stepKey = `${channelSetupOnly ? "explicit" : "initial"}:${step}`;
    if (viewedStepRef.current === stepKey) return;
    viewedStepRef.current = stepKey;
    const stepLabel = step === 0 ? "website" : step === 1 ? "social" : "review";
    captureEvent(PRODUCT_EVENTS.onboardingStepViewed, {
      step: stepLabel,
      entry: channelSetupOnly ? "explicit_channel_setup" : "initial",
    });

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
      const provider = params.get("provider") ?? "unknown";
      captureEvent(PRODUCT_EVENTS.channelConnected, {
        channel: provider,
        source: "onboarding",
      });
      toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} connected successfully!`);
      if (user) {
        getSocialAccounts(user.uid).then(setLegacyAccounts).catch(() => {});
        if (db) {
          void setDoc(
            doc(db, "users", user.uid),
            {
              socialSetupAttempted: true,
              socialSetupEnabledAt: serverTimestamp(),
              onboardingLastAction: "channel_connected",
            },
            { merge: true },
          ).catch((error) => {
            console.warn("[onboarding] Could not record channel connection on user", error);
          });
        }
      }
    } else if (social === "error") {
      const rawReason = params.get("reason");
      let cleanReason = rawReason?.replace(/^Error:\s*/, "").replace(/Uncaught\s+BadBodyError:\s*/, "") || "Could not connect channel";
      if (rawReason?.includes("no_youtube_channel")) {
        cleanReason = "YouTube connection failed: This Google account does not have a YouTube channel. Please visit youtube.com to create a channel on this account, or select a Google account that has a channel.";
      } else if (rawReason?.includes("invalid_google_client_secret") || rawReason?.includes("invalid_client") || rawReason?.includes("client secret is invalid")) {
        cleanReason = "YouTube connection failed: The configured Google OAuth Client Secret is invalid. Please ensure GOOGLE_OAUTH_CLIENT_SECRET in your backend environment matches your Google Cloud Console OAuth 2.0 Client credentials.";
      } else if (rawReason?.includes("no_facebook_pages")) {
        cleanReason = "Facebook connection failed: You must own or manage at least one Facebook Page under your account.";
      } else if (rawReason?.includes("feature_unavailable") || rawReason?.includes("unavailable") || rawReason?.includes("Facebook Login")) {
        cleanReason = "Facebook Login unavailable: Your Meta App is in Development mode. Add test users in Meta Dashboard or complete App Review.";
      } else if (rawReason?.includes("access_denied")) {
        cleanReason = "Connection cancelled or access denied by user.";
      } else if (rawReason?.includes("403") || rawReason?.includes("NotEnoughScopesError")) {
        cleanReason = "Permission or API quota error. Please ensure the required YouTube/OAuth API permissions are enabled in your developer console.";
      }
      toast.error(cleanReason, { duration: 7000 });
    }
    params.delete("social");
    params.delete("provider");
    params.delete("reason");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [user]);

  // Listen for OAuth completion from new tab/popup window
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === "magicbox_social_connected") {
        const prov = e.data.provider || "channel";
        toast.success(`${prov.charAt(0).toUpperCase() + prov.slice(1)} connected successfully!`);
        setConnecting(null);
      } else if (e.data?.type === "magicbox_social_error") {
        toast.error(e.data.reason || "Connection failed");
        setConnecting(null);
      }
    };
    window.addEventListener("message", handleMsg);
    return () => window.removeEventListener("message", handleMsg);
  }, []);

  const handleConnect = async (provider: string) => {
    if (provider === "tiktok") {
      toast.info("TikTok OAuth is currently in verification with ByteDance. Connect Instagram, LinkedIn, or YouTube to publish live content today.", { duration: 5000 });
      return;
    }
    if (provider === "x" || provider === "twitter") {
      toast.info("Twitter / X direct posting requires a verified developer app. Instagram, LinkedIn, and YouTube are fully active.", { duration: 5000 });
      return;
    }
    if (provider === "whatsapp" && isWhatsAppV2Active()) {
      setWhatsAppModalOpen(true);
      return;
    }
    const validProvider = provider as "instagram" | "linkedin" | "youtube" | "facebook" | "whatsapp";
    captureEvent(PRODUCT_EVENTS.channelConnectStarted, {
      channel: validProvider,
      source: "onboarding",
    });
    setConnecting(validProvider);

    // Watchdog: reset connecting state if navigation is delayed or cancelled
    const watchdog = window.setTimeout(() => {
      setConnecting(null);
    }, 15000);

    try {
      if (!isConvexConfigured) {
        toast.error("Convex is not configured — set VITE_CONVEX_URL.");
        setConnecting(null);
        window.clearTimeout(watchdog);
        return;
      }
      const { url, redirectUri } = await connectUrl({
        provider: validProvider,
        returnTo: "/onboarding/channels",
        returnOrigin: window.location.origin,
        loginHint: user?.email ?? undefined,
      });
      if (redirectUri.includes("cloudfunctions.net")) {
        toast.error("OAuth misconfigured (Firebase callback). Use Convex.");
        setConnecting(null);
        window.clearTimeout(watchdog);
        return;
      }
      window.clearTimeout(watchdog);
      // Open in a new tab so onboarding session is preserved
      const newTab = window.open(url, "_blank");
      if (!newTab || newTab.closed || typeof newTab.closed === "undefined") {
        // Fallback if popup blocker intercepted
        window.location.href = url;
      } else {
        toast.info(`Connecting ${PLATFORM_META[validProvider]?.label || validProvider}... Authorize in the new tab to continue.`, { duration: 6000 });
      }
    } catch (error) {
      window.clearTimeout(watchdog);
      toast.error(error instanceof Error ? error.message : "Could not start connection");
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

  // Safety watchdog: never leave user stranded on saving state
  useEffect(() => {
    if (brandPhase !== "saving") return;
    const timer = window.setTimeout(() => {
      console.warn("[onboarding] Saving brand profile taking too long, auto-advancing to channels");
      setBrandPhase("ready");
      setStep(1);
      setSaving(false);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [brandPhase]);

  const updateExtractedField = (field: keyof BrandExtractResult, val: any) => {
    setExtracted((prev) => {
      const base =
        prev ||
        safeExtracted ||
        createFallbackBrandResult(websiteUrl || "https://mybrand.com", brandName);
      return { ...base, [field]: val };
    });
  };

  const updateColor = (colorKey: "primary" | "secondary" | "accent", hex: string) => {
    setExtracted((prev) => {
      const base =
        prev ||
        safeExtracted ||
        createFallbackBrandResult(websiteUrl || "https://mybrand.com", brandName);
      return {
        ...base,
        colors: {
          ...base.colors,
          [colorKey]: hex,
        },
      };
    });
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

    const fetchWithTimeout = async () => {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Extraction timed out after 14s")), 14000),
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
    setSaving(true);

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
    const finalLogoUrl = currentExtracted.logoUrl || (domain ? `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128` : "");
    const finalHashtags = (currentExtracted.hashtags ?? []).map((h) => h.replace(/^#/, "")).filter(Boolean);
    const finalSampleCaptions = currentExtracted.sampleCaptions?.length ? currentExtracted.sampleCaptions : undefined;

    // Instant deterministic ID so UI is never blocked on sequential round-trips
    const id = brandProfileId || (db ? doc(collection(db, "brandProfiles")).id : `brand_${Date.now()}`);

    // Update local state and advance immediately to channels
    setBrandProfileId(id);
    setBrandName(finalName);
    setToneOfVoice(finalTone);
    setExtracted(currentExtracted);
    setBrandPhase("ready");
    setStep(1);

    captureEvent("brand_kit_completed", { source: "onboarding", has_website: true });
    captureEvent(PRODUCT_EVENTS.onboardingWebsiteEnabled, {
      source: "onboarding",
    });

    toast.success("Brand kit saved! Moving to social channels...");

    // Persist in background with timeout safety
    const timeoutPromise = (ms = 4000) =>
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

    const firestorePromise = db
      ? setDoc(
          doc(db, "brandProfiles", id),
          stripUndefined({
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
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
          { merge: true },
        )
      : Promise.resolve();

    const convexPromise = isConvexConfigured
      ? upsertWebsiteBrand({
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
        })
      : Promise.resolve();

    const userDocPromise = db
      ? setDoc(
          doc(db, "users", user.uid),
          {
            websiteSetupEnabledAt: serverTimestamp(),
            onboardingLastAction: "website_enabled",
          },
          { merge: true },
        )
      : Promise.resolve();

    try {
      await Promise.allSettled([
        Promise.race([firestorePromise, timeoutPromise(4000)]),
        Promise.race([convexPromise, timeoutPromise(4000)]),
        Promise.race([userDocPromise, timeoutPromise(4000)]),
      ]);
    } catch (error) {
      console.warn("[onboarding] Background brand save warning:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleContinueToReview = async () => {
    if (user && db) {
      void setDoc(
        doc(db, "users", user.uid),
        {
          socialSetupAttempted: true,
          socialSetupEnabledAt: serverTimestamp(),
          onboardingLastAction: "social_enabled",
        },
        { merge: true },
      ).catch((error) => {
        console.warn("[onboarding] Could not record social setup enabled", error);
      });
    }
    if (user) {
      for (const acc of accounts) {
        if (acc.status === "active") {
          void saveSocialAccount({
            userId: user.uid,
            provider: acc.provider,
            platform: acc.platform,
            externalId: acc.externalId,
            username: acc.username,
            displayName: acc.displayName,
            avatarUrl: acc.avatarUrl,
            status: acc.status,
            linkedAt: acc.linkedAt,
          }).catch(() => {});
        }
      }
    }
    setStep(2);
  };

  const deferOnboarding = async (section: "website" | "social") => {
    try {
      sessionStorage.removeItem("magicbox_onboarding_step");
    } catch {}
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

  const cyclePlatform = (direction: number) => {
    const index = PREVIEW_PLATFORMS.indexOf(previewPlatform);
    const size = PREVIEW_PLATFORMS.length;
    setPreviewPlatform(PREVIEW_PLATFORMS[(index + direction + size) % size]);
  };

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

  const handleQuickPost = async (mode: "now" | "schedule" | "draft") => {
    if (!activeCaption) return;
    if (!isConvexConfigured) {
      toast.error("Convex is not configured — can't publish yet.");
      return;
    }
    const hasAccount = !!activeAccountForPreview;
    const effectiveMode = hasAccount ? mode : "draft";

    if (hasAccount && effectiveMode !== "draft" && previewPlatform === "youtube") {
      toast.error("YouTube requires a video. Use this branded creative as the visual direction in Studio.");
      return;
    }
    if (hasAccount && effectiveMode !== "draft" && creativeMode === "carousel" && !["instagram", "linkedin"].includes(previewPlatform)) {
      toast.error("Carousel posting is currently available for Instagram and LinkedIn.");
      return;
    }
    if (creativeMode === "image" && !imageCardRef.current) {
      toast.error("The creative is still rendering — try again in a moment.");
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
        socialAccountIds: activeAccountForPreview ? [activeAccountForPreview.id] : undefined,
        mediaUrls,
        mediaType: "image",
        mediaSource: "upload",
        brief:
          creativeMode === "carousel"
            ? carouselPack?.topic || SAMPLE_BRIEF
            : SAMPLE_BRIEF,
        brandProfileId: brandProfileId || undefined,
        mode: effectiveMode,
        timezone,
      });
      if (effectiveMode === "draft" || result.status === "draft" || !hasAccount) {
        toast.success(
          !hasAccount
            ? `No channel connected — saved to drafts for ${PLATFORM_META[previewPlatform]?.label || previewPlatform}`
            : `Saved to drafts for ${PLATFORM_META[previewPlatform]?.label || previewPlatform}`,
        );
        cyclePlatform(1);
      } else if (effectiveMode === "now") {
        captureEvent("post_publish_requested", { channel: previewPlatform, source: "onboarding" });
        if (result.status === "posted") captureEvent("post_published", { channel: previewPlatform, source: "onboarding" });
        toast.success(
          result.status === "posted"
            ? `${creativeMode === "carousel" ? "Carousel" : "Image"} posted to ${PLATFORM_META[previewPlatform]?.label || previewPlatform}`
            : `Approved — sending to ${PLATFORM_META[previewPlatform]?.label || previewPlatform} now…`,
        );
        cyclePlatform(1);
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
            : `Queued for ${PLATFORM_META[previewPlatform]?.label || previewPlatform}`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post");
    } finally {
      setPosting(false);
    }
  };

  const finish = async (goToWizard: boolean) => {
    if (!user || !db) {
      toast.error("You are signed out — sign in again to finish setup.");
      return;
    }
    if (!brandProfileId) {
      toast.error("Link your website before completing setup.");
      setStep(0);
      return;
    }
    try {
      sessionStorage.removeItem("magicbox_onboarding_step");
    } catch {}
    // A failed write leaves OnboardingGate bouncing the user back here, so the
    // failure has to be visible rather than an unhandled rejection.
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          // `email` keeps this legal when the document does not exist yet:
          // a merge-set is then a create, and the create rule requires it.
          email: user.email,
          onboardingComplete: true,
          onboardingDeferred: false,
          onboardingCompletedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? `Could not save setup: ${error.message}` : "Could not save setup",
      );
      return;
    }
    captureEvent(PRODUCT_EVENTS.onboardingCompleted, {
      next: goToWizard ? "automation_wizard" : "dashboard",
    });
    navigate(goToWizard ? "/automations/new" : "/");
  };

  // Safe active extracted brand reference for Step 0 render
  const safeExtracted = useMemo(() => {
    if (extracted) return extracted;
    if (brandName || websiteUrl || extractedUrl) {
      return createFallbackBrandResult(extractedUrl || websiteUrl || "https://mybrand.com", brandName || undefined);
    }
    return null;
  }, [extracted, brandName, websiteUrl, extractedUrl]);

  return (
    <div className="min-h-[100dvh] h-full flex flex-col bg-background text-foreground overflow-x-hidden relative">
      {/* Subtle warm ambient gradient aura */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-96 w-full max-w-4xl rounded-full bg-gradient-to-b from-brand/[0.06] via-brand/[0.01] to-transparent blur-3xl" />

      <div
        className={`relative mx-auto flex w-full flex-1 min-h-0 flex-col px-3 py-6 sm:px-6 lg:px-8 ${step === 0 ? "max-w-3xl" : "max-w-5xl"}`}
      >
        {/* Top Header */}
        <div className="mb-6 lg:mb-8 text-center shrink-0">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-card border border-border/80 shadow-xs p-2">
            <img
              src="/logo.svg"
              alt="MagicBox"
              className="h-full w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/favicon.svg";
              }}
            />
          </div>
          <span className="eyebrow text-[10px] tracking-widest text-muted-foreground font-mono">GET STARTED</span>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl tracking-tight text-foreground">Turn your website into a campaign</h1>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto px-2">
            Start with your site. Connect channels. Review the creative. Nothing posts without your approval.
          </p>
        </div>

        {/* Stepper with click navigation */}
        <div className="mb-6 flex items-center justify-center gap-1.5 sm:gap-3 shrink-0">
          {STEPS.map((s, i) => {
            const isDone = i < step;
            const isCurrent = i === step;
            const canJump = i <= step || (i === 1 && (brandProfileId || extracted)) || (i === 2 && hasActiveChannel);
            return (
              <div key={s.title} className="flex items-center gap-1.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (canJump) setStep(i);
                  }}
                  disabled={!canJump}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                    isCurrent
                      ? "bg-brand/10 text-brand ring-1 ring-brand/30 shadow-xs"
                      : isDone
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                      : canJump
                      ? "bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                      : "bg-secondary/40 text-muted-foreground/40 cursor-not-allowed",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold transition-transform",
                      isCurrent
                        ? "bg-brand text-brand-foreground shadow-xs scale-105"
                        : isDone
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isDone ? <Check className="h-3 w-3" /> : i + 1}
                  </div>
                  <span className="hidden sm:inline font-medium">{s.title}</span>
                </button>
                {i < STEPS.length - 1 && <div className="h-px w-6 sm:w-10 bg-border" />}
              </div>
            );
          })}
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
            {/* STEP 0: Website & Brand Kit */}
            {step === 0 && (
              <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-6">
                {/* Phase A: Input State (Before Extraction) */}
                {brandPhase === "idle" && (
                  <div className="space-y-6">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
                        <Sparkles className="h-3.5 w-3.5" />
                        Step 1 of 3 · Website &amp; Brand Kit
                      </div>
                      <h2 className="mt-3 font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight">
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
                            className="h-13 bg-card border-border/90 pl-12 pr-12 text-base shadow-xs focus-visible:ring-brand"
                            autoFocus
                          />
                          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded border border-border/60">
                            ↵
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        onClick={() => void handleScanBrand()}
                        disabled={!websiteUrl.trim()}
                        className="w-full h-12 text-base font-semibold bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 rounded-xl"
                      >
                        <Sparkles className="h-4.5 w-4.5" />
                        Analyze Website &amp; Build Brand Kit
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
                  <div className="space-y-6 py-6">
                    <div className="text-center max-w-md mx-auto space-y-2">
                      <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/20 bg-brand/10 text-brand shadow-inner">
                        <div className="absolute inset-0 rounded-2xl bg-brand/20 animate-ping opacity-25" />
                        <Loader2 className="h-8 w-8 animate-spin text-brand" />
                      </div>
                      <h2 className="font-display text-2xl text-foreground font-normal tracking-tight">
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
                                : "text-muted-foreground/40",
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

                {/* Phase C: Saving State */}
                {brandPhase === "saving" && (
                  <div className="space-y-6 py-8 text-center max-w-md mx-auto">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/20 bg-brand/10 text-brand shadow-inner">
                      <Loader2 className="h-8 w-8 animate-spin text-brand" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="font-display text-2xl text-foreground font-normal tracking-tight">
                        Saving Brand Profile…
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Syncing your logo, colors, and positioning to your MagicBox workspace.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBrandPhase("ready");
                          setStep(1);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Continue to Channels →
                      </Button>
                    </div>
                  </div>
                )}

                {/* Phase D: Preview & Confirmation State (Screenshot 1 Redesign) */}
                {brandPhase === "ready" && safeExtracted && (
                  <div className="space-y-6">
                    {/* Header Bar with Badge & Action Toolbar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-5">
                      <div>
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Brand Kit Extracted
                        </div>
                        <h2 className="mt-2 font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight">
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
                          className="text-xs h-9 px-3 gap-1.5 rounded-xl border-border/80 hover:bg-secondary"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {isEditingBrand ? "Done Editing" : "Edit Details"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRescan}
                          className="text-xs h-9 px-3 gap-1.5 text-muted-foreground hover:text-foreground rounded-xl"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Re-scan
                        </Button>
                      </div>
                    </div>

                    {/* Brand Identity Card */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-secondary/30 border border-border/60">
                      <div className="relative shrink-0">
                        {safeExtracted.logoUrl && !logoLoadFailed ? (
                          <img
                            src={safeExtracted.logoUrl}
                            alt={brandName || safeExtracted.companyName || "Logo"}
                            className="h-16 w-16 rounded-xl border border-border bg-card object-contain p-1.5 shadow-xs"
                            onError={() => setLogoLoadFailed(true)}
                          />
                        ) : (
                          <div
                            className="flex h-16 w-16 items-center justify-center rounded-xl font-display text-2xl font-bold text-white shadow-xs border border-white/10"
                            style={{ background: safeExtracted.colors?.primary || "#6366f1" }}
                          >
                            {(brandName || safeExtracted.companyName || "?").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5 w-full">
                        {isEditingBrand ? (
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            <div>
                              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium">Brand Name</label>
                              <Input
                                value={brandName || safeExtracted.companyName}
                                onChange={(e) => {
                                  setBrandName(e.target.value);
                                  updateExtractedField("companyName", e.target.value);
                                }}
                                className="h-9 mt-1 text-sm bg-card border-border/80"
                                placeholder="Brand Name"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium">Industry</label>
                              <Input
                                value={safeExtracted.industry || ""}
                                onChange={(e) => updateExtractedField("industry", e.target.value)}
                                className="h-9 mt-1 text-sm bg-card border-border/80"
                                placeholder="e.g. Technology, Apparel, Healthcare"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium">Logo URL</label>
                              <Input
                                value={safeExtracted.logoUrl || ""}
                                onChange={(e) => {
                                  setLogoLoadFailed(false);
                                  updateExtractedField("logoUrl", e.target.value);
                                }}
                                className="h-9 mt-1 text-sm bg-card border-border/80 font-mono text-xs"
                                placeholder="https://example.com/logo.png"
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-display text-2xl font-bold text-foreground leading-tight">
                                {brandName || safeExtracted.companyName || extractDomain(extractedUrl || websiteUrl)}
                              </h3>
                              {safeExtracted.industry && (
                                <span className="rounded-md border border-border/80 bg-secondary/80 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                  {safeExtracted.industry}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Globe2 className="h-3.5 w-3.5" />
                              <a
                                href={extractedUrl || normalizeInputUrl(websiteUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:text-brand inline-flex items-center gap-1 underline-offset-4 hover:underline transition-colors"
                              >
                                {extractDomain(extractedUrl || websiteUrl)}
                                <ExternalLink className="h-3 w-3 inline opacity-70" />
                              </a>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Two-Column Details Grid: Palette on Left, Voice & Positioning on Right */}
                    <div className="grid gap-6 lg:grid-cols-2 pt-2">
                      {/* Left: Color Palette Section */}
                      <div className="space-y-3.5">
                        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                          <Palette className="h-4 w-4 text-brand" />
                          Extracted Brand Colors
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {(["primary", "secondary", "accent"] as const).map((key) => {
                            const hex = safeExtracted.colors?.[key] || (key === "primary" ? "#18181b" : key === "secondary" ? "#6366f1" : "#f59e0b");
                            return (
                              <div
                                key={key}
                                className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-2.5 shadow-xs hover:border-border transition-all"
                              >
                                <div
                                  className="h-10 w-10 rounded-lg border border-black/10 shadow-xs shrink-0"
                                  style={{ background: hex }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
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
                                    <div className="font-mono text-xs font-semibold text-foreground truncate">
                                      {hex}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Continuous Palette Blend Bar */}
                        <div className="space-y-1.5 pt-1">
                          <div
                            className="h-2.5 w-full rounded-full border border-black/10 shadow-inner"
                            style={{
                              background: `linear-gradient(to right, ${safeExtracted.colors?.primary || "#18181b"}, ${safeExtracted.colors?.secondary || "#6366f1"}, ${safeExtracted.colors?.accent || "#f59e0b"})`,
                            }}
                          />
                          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground px-0.5">
                            <span>Primary</span>
                            <span>Secondary</span>
                            <span>Accent</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Brand Positioning & Voice Section */}
                      <div className="space-y-3.5">
                        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                          <Sparkles className="h-4 w-4 text-brand" />
                          Brand Positioning &amp; Voice
                        </div>

                        {isEditingBrand ? (
                          <div className="space-y-3">
                            <div>
                              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium">Core Tagline / Bio</label>
                              <Input
                                value={safeExtracted.coreIdentity || safeExtracted.mission || ""}
                                onChange={(e) => updateExtractedField("coreIdentity", e.target.value)}
                                className="h-9 mt-1 text-sm bg-card border-border/80"
                                placeholder="Short summary of what your brand does"
                              />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium">Tone of Voice</label>
                                <Input
                                  value={toneOfVoice || safeExtracted.tone || ""}
                                  onChange={(e) => {
                                    setToneOfVoice(e.target.value);
                                    updateExtractedField("tone", e.target.value);
                                  }}
                                  className="h-9 mt-1 text-sm bg-card border-border/80"
                                  placeholder="e.g. Professional, authoritative, friendly"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-medium">Target Audience</label>
                                <Input
                                  value={safeExtracted.audience || ""}
                                  onChange={(e) => updateExtractedField("audience", e.target.value)}
                                  className="h-9 mt-1 text-sm bg-card border-border/80"
                                  placeholder="e.g. B2B founders, marketing leaders"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {(safeExtracted.coreIdentity || safeExtracted.mission || safeExtracted.productOffering) && (
                              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed italic bg-secondary/30 rounded-xl p-3 border border-border/50">
                                &ldquo;{safeExtracted.coreIdentity || safeExtracted.mission || safeExtracted.productOffering}&rdquo;
                              </p>
                            )}

                            <div className="space-y-2.5">
                              {(toneOfVoice || safeExtracted.tone) && (
                                <div className="rounded-xl border border-border/60 bg-secondary/20 p-2.5 space-y-1">
                                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                    <Volume2 className="h-3.5 w-3.5 text-brand" />
                                    Tone of Voice
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                                    {(toneOfVoice || safeExtracted.tone)
                                      .split(/[,·|]/)
                                      .map((t) => t.trim())
                                      .filter(Boolean)
                                      .map((token) => (
                                        <span
                                          key={token}
                                          className="inline-flex items-center rounded-md border border-border/70 bg-card px-2 py-0.5 text-xs font-medium text-foreground"
                                        >
                                          {token}
                                        </span>
                                      ))}
                                  </div>
                                </div>
                              )}

                              {safeExtracted.audience && (
                                <div className="rounded-xl border border-border/60 bg-secondary/20 p-2.5 space-y-1">
                                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                    <Users className="h-3.5 w-3.5 text-brand" />
                                    Target Audience
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    {safeExtracted.audience}
                                  </p>
                                </div>
                              )}

                              {safeExtracted.hashtags && safeExtracted.hashtags.length > 0 && (
                                <div className="rounded-xl border border-border/60 bg-secondary/20 p-2.5 space-y-1">
                                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                    <Tag className="h-3.5 w-3.5 text-brand" />
                                    Campaign Hashtags
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                                    {safeExtracted.hashtags.slice(0, 5).map((tag) => (
                                      <span
                                        key={tag}
                                        className="inline-flex items-center rounded-md border border-border/70 bg-card px-2 py-0.5 text-[11px] font-mono text-muted-foreground"
                                      >
                                        #{tag.replace(/^#/, "")}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons: Clear Save & Continue */}
                    <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/60">
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
                        className="w-full sm:w-auto h-12 text-sm sm:text-base font-semibold bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm hover:shadow-md transition-all px-6 flex items-center justify-center gap-2 rounded-xl"
                      >
                        {saving ? (
                          <Loader2 className="h-4.5 w-4.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-4.5 w-4.5" />
                        )}
                        <span>Save Brand Kit &amp; Continue to Channels</span>
                        <ArrowRight className="h-4.5 w-4.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 1: Connect Social Channels (Screenshot 2 Redesign) */}
            {step === 1 && (
              <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-6">
                {preset && (
                  <div className="rounded-xl border border-brand/20 bg-brand/[0.05] p-4">
                    <div className="text-[11px] font-mono uppercase tracking-widest text-brand font-semibold">
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
                            className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-card px-3 py-1 text-xs font-medium text-foreground shadow-xs"
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
                  <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-medium text-brand mb-2">
                    <Link2 className="h-3.5 w-3.5" />
                    Step 2 of 3 · Social Distribution
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight">{STEPS[1].title}</h2>
                  <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
                    Connect at least one channel where approved content can go. Nothing is posted
                    automatically; you review and approve every post before publishing.
                  </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
                  {/* Left Column: Connected channels + Setup notes */}
                  <div className="lg:col-span-5 space-y-4">
                    {accounts.length > 0 && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
                            Connected Channels
                          </p>
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            {accounts.length} active
                          </span>
                        </div>
                        <div className="space-y-2">
                          {accounts.map((account) => {
                            const meta = PLATFORM_META[account.platform] ?? {
                              label: account.platform,
                              icon: Link2,
                              badgeBg: "bg-secondary",
                              badgeText: "text-foreground",
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
                                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs"
                              >
                                <Avatar className="h-10 w-10 border border-border">
                                  <AvatarImage src={account.avatarUrl} alt="" />
                                  <AvatarFallback className="bg-secondary text-xs text-foreground font-semibold">
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span className="truncate text-sm font-semibold text-foreground">
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
                                    className="shrink-0 border-amber-500/30 text-amber-700 h-8 text-xs rounded-lg"
                                    disabled={connecting !== null}
                                    onClick={() => handleConnect(account.platform)}
                                  >
                                    Reconnect
                                  </Button>
                                ) : (
                                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                    <Check className="h-3 w-3" /> Connected
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Channel Setup Notes Card */}
                    <div className="rounded-2xl border border-border/80 bg-secondary/25 p-4 sm:p-5 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-foreground font-semibold">
                        <ShieldCheck className="h-4 w-4 text-brand" />
                        Channel Setup Notes
                      </div>
                      <div className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
                        <div className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand shrink-0" />
                          <p>
                            <strong className="text-foreground">YouTube:</strong> If Google displays <em>&quot;Google hasn&apos;t verified this app&quot;</em>, click <strong>Advanced → Go to MagicBox (unsafe)</strong> to proceed.
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand shrink-0" />
                          <p>
                            <strong className="text-foreground">Facebook, Instagram &amp; WhatsApp:</strong> If Meta displays <em>&quot;Feature unavailable&quot;</em>, ensure your Meta App is in Live mode or add test accounts in Meta Developer Dashboard.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Connect channel cards */}
                  <div className="lg:col-span-7 grid gap-3 sm:grid-cols-2">
                    {CONNECTABLE.filter((provider) => {
                      const linked = connectedByPlatform.get(provider);
                      return !(linked && linked.status === "active");
                    }).map((provider) => {
                      const meta = PLATFORM_META[provider] ?? {
                        label: provider,
                        icon: Link2,
                        category: "Social",
                        badgeBg: "bg-secondary",
                        badgeText: "text-foreground",
                      };
                      const Icon = meta.icon;
                      const linked = connectedByPlatform.get(provider);
                      const busy = connecting === provider;
                      const expired = linked?.status === "expired";
                      return (
                        <button
                          key={provider}
                          type="button"
                          onClick={() => handleConnect(provider)}
                          disabled={connecting !== null}
                          className="group relative flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-border/80 bg-card hover:border-brand/40 hover:shadow-xs transition-all duration-200 text-left w-full cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {busy ? (
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand shrink-0">
                                <Loader2 className="h-5 w-5 animate-spin" />
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  "flex h-10 w-10 items-center justify-center rounded-xl shrink-0 shadow-xs transition-transform group-hover:scale-105",
                                  meta.badgeBg,
                                  meta.badgeText,
                                )}
                              >
                                <Icon className="h-5 w-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors truncate">
                                {expired ? `Reconnect ${meta.label}` : `Connect ${meta.label}`}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {meta.category}
                              </div>
                            </div>
                          </div>

                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-muted-foreground group-hover:bg-brand/10 group-hover:text-brand transition-all shrink-0 ml-2">
                            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Navigation Bar */}
                <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/60">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      onClick={() => setStep(0)}
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground text-xs sm:text-sm"
                    >
                      ← Back to website
                    </Button>
                    <Button
                      onClick={() => void deferOnboarding("social")}
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground text-xs sm:text-sm"
                    >
                      Skip for now
                    </Button>
                  </div>
                  <Button
                    onClick={() => void handleContinueToReview()}
                    className="w-full sm:w-auto h-12 py-3.5 px-6 text-xs sm:text-sm bg-brand hover:bg-brand/90 text-brand-foreground font-semibold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 rounded-xl"
                  >
                    <span className="truncate">
                      {hasActiveChannel
                        ? "Review my campaign"
                        : "Continue to campaign review"}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 ml-0.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Review & Approve — one phone per platform, cycled */}
            {step === 2 && (
              <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4">
                {/* Platform rail — icon only, green dot = connected */}
                <div className="flex shrink-0 items-center gap-2">
                  {PREVIEW_PLATFORMS.map((platform) => {
                    const meta = PLATFORM_META[platform];
                    const Icon = meta?.icon ?? Link2;
                    const connected = accounts.some(
                      (a) => a.platform === platform && a.status === "active",
                    );
                    return (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => handlePreviewPlatform(platform)}
                        aria-label={meta?.label || platform}
                        aria-current={platform === previewPlatform}
                        className={cn(
                          "relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all",
                          platform === previewPlatform
                            ? "border-brand/40 bg-brand/10 text-brand shadow-sm"
                            : "border-border bg-card text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4.5 w-4.5" />
                        {connected && (
                          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Device */}
                <div className="flex min-h-0 w-full flex-1 items-center justify-center gap-2 sm:gap-6">
                  <button
                    type="button"
                    onClick={() => cyclePlatform(-1)}
                    aria-label="Previous channel"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <PhoneFrame className="max-w-[430px]">
                      {activeCaption ? (
                        <motion.div
                          key={previewPlatform}
                          initial={{ opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.18 }}
                          className="[&>div]:max-w-none [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none"
                        >
                          <PlatformPreview
                            platform={previewPlatform}
                            content={{
                              caption: activeCaption,
                              hashtags: activeHashtags,
                              mediaAspect: creativeMode === "carousel" ? carouselAspect : "4:5",
                              mediaNode:
                                creativeMode === "carousel" && carouselPack ? (
                                  <BrandedSlide
                                    slide={carouselPack.slides[activeCarouselSlide] ?? carouselPack.slides[0]}
                                    brand={creativeBrand}
                                    aspect={carouselAspect}
                                    index={activeCarouselSlide}
                                    total={carouselPack.slides.length}
                                    scale={carouselPreviewScale}
                                  />
                                ) : (
                                  <WebsitePostCard
                                    brand={creativeBrand}
                                    hook={activeHook}
                                    supporting={activeSupporting}
                                    eyebrow={safeExtracted?.industry || "From your website"}
                                    imageUrl={previewImageUrl || undefined}
                                    scale={340 / 1080}
                                  />
                                ),
                              brandName: brandName || safeExtracted?.companyName || "Your Brand",
                              handle: (brandName || safeExtracted?.companyName)
                                ? (brandName || safeExtracted?.companyName || "").toLowerCase().replace(/\s+/g, "")
                                : "yourbrand",
                              logoUrl: safeExtracted?.logoUrl,
                              brandColors: safeExtracted?.colors,
                            }}
                          />
                        </motion.div>
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-white/50" />
                        </div>
                      )}
                  </PhoneFrame>

                  <button
                    type="button"
                    onClick={() => cyclePlatform(1)}
                    aria-label="Next channel"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex w-[min(90vw,420px)] shrink-0 flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={() => void handleQuickPost("now")}
                    disabled={posting || !activeCaption}
                    className="w-full flex-1 h-11 bg-brand hover:bg-brand/90 text-brand-foreground font-semibold rounded-xl"
                  >
                    {posting ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-1.5 h-4 w-4" />
                    )}
                    Post Now
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleQuickPost("draft")}
                    disabled={posting || !activeCaption}
                    className="w-full flex-1 h-11 rounded-xl"
                  >
                    <Layers className="mr-1.5 h-4 w-4" />
                    Save to Draft
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => void finish(false)}
                  className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  Finish setup →
                </button>

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
                      eyebrow={safeExtracted?.industry || "From your website"}
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

            {/* Fallback for any non-standard step index */}
            {step !== 0 && step !== 1 && step !== 2 && (
              <div className="rounded-2xl border border-border/80 bg-card p-8 text-center space-y-4 max-w-md mx-auto shadow-sm">
                <h2 className="font-display text-xl">Let&apos;s get you setup</h2>
                <p className="text-sm text-muted-foreground">
                  Start by setting up your brand or connecting your social channels.
                </p>
                <Button onClick={() => setStep(0)} className="w-full rounded-xl">
                  Go to Website &amp; Brand Kit
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <WhatsAppV2Modal
        open={whatsAppModalOpen}
        onOpenChange={setWhatsAppModalOpen}
      />
    </div>
  );
}
