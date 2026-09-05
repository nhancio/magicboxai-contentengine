import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@shared/lib/auth";
import type { BrandProfile } from "@shared/types";
import { getBrandProfiles } from "@shared/lib/automations";
import { isConvexConfigured } from "../lib/convex";
import { usePersistentState } from "../lib/drafts";
import {
  Flame,
  FileEdit,
  Film,
  Shuffle,
  Heart,
  Eye,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  MapPin,
  Search,
  RefreshCw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Layers,
  Wand2,
  Copy,
  Check,
  CheckCircle2,
  Building2,
  Sliders,
  Maximize2,
  ArrowRight,
  ExternalLink,
  Zap,
  Tag,
  ChevronDown,
  X,
  Palette,
  Radio,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import type { MemeTemplate } from "@convex/lib/maya/types";

/** Shape returned by the api.mayaTemplates.adaptTemplate action. */
interface AdaptedMemeVideo {
  adaptationId: string;
  sourceTemplateId: string;
  sourceVideoUrl: string;
  sourceTitle: string;
  durationSec: number;
  brandName: string;
  templateTitle: string;
  aspectRatio: string;
  hookText: string;
  adaptedScript: string;
  textOverlays: Array<{
    slotId: string;
    text: string;
    placement: string;
    color: string;
    bgColor?: string;
    startSec?: number;
    endSec?: number;
  }>;
  lipSyncScript: Array<{
    speakerId: string;
    startSec: number;
    endSec: number;
    spokenDialogue: string;
    deliveryTone: string;
    facialExpression?: string;
  }>;
  videoModelPrompts: { googleVeoPrompt: string; negativePrompt: string };
  subtitleCues: Array<{ startSec: number; endSec: number; text: string }>;
  sfxCues: Array<{ timestampSec: number; sfxName: string; volumeMultiplier?: number }>;
  instagramCaption: string;
  hashtags: string[];
  adaptationNote?: string;
  usedAI: boolean;
}

// Locations for Indian Trending Reels & Brainrot Memes
interface LocationPreset {
  id: string;
  name: string;
  flag: string;
  query: string;
  description: string;
}

const LOCATION_PRESETS: LocationPreset[] = [
  {
    id: "india_all",
    name: "India (All Trends)",
    flag: "🇮🇳",
    query: "indian meme brain rot trending reel",
    description: "Viral Indian brainrot, relatable desi humor & meme formats",
  },
  {
    id: "mumbai",
    name: "Mumbai / Bollywood",
    flag: "🎬",
    query: "mumbai street comedy meme reel",
    description: "Bollywood dialogue satire, local train banter & creator reels",
  },
  {
    id: "delhi",
    name: "Delhi NCR / North",
    flag: "🏛️",
    query: "delhi desi comedy viral reel",
    description: "North Indian situational comedy, college life & street rants",
  },
  {
    id: "bengaluru",
    name: "Bengaluru / Tech Hub",
    flag: "💻",
    query: "bangalore tech startup founder meme reel",
    description: "Tech worker struggles, SaaS hustle, traffic & coffee rants",
  },
  {
    id: "south",
    name: "South India / Hyderabad",
    flag: "🌴",
    query: "south indian funny viral reels",
    description: "High-energy comedic timing, cinema references & regional hits",
  },
  {
    id: "global",
    name: "Global Brainrot",
    flag: "🌍",
    query: "brainrot meme viral reels",
    description: "Worldwide trending Gen-Z meme formats & audio trends",
  },
];

// Category Pills matching the reference UI
const CATEGORY_PILLS = [
  { id: "all", label: "All Categories", color: "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700" },
  { id: "Productivity", label: "Productivity", color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60" },
  { id: "B2B SaaS/Platform", label: "B2B SaaS/Platform", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60" },
  { id: "Neutral/Filler", label: "Neutral/Filler", color: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60" },
  { id: "Desi Brainrot", label: "Desi Brainrot 🇮🇳", color: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60" },
  { id: "E-Commerce", label: "E-Commerce / D2C", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60" },
];

export default function MayaTemplatesTest() {
  const { user, loading: authLoading } = useAuth();
  const convexBrands = useQuery(
    api.brands.list,
    isConvexConfigured && user ? {} : "skip"
  );
  const searchTrendingTemplates = useAction(api.mayaTemplates.searchTrendingTemplates);
  const suggestSearchQueries = useAction(api.mayaTemplates.suggestSearchQueries);
  const postFinishedReel = useAction(api.mayaTemplates.postFinishedReel);
  const adaptTemplateAction = useAction(api.mayaTemplates.adaptTemplate);
  const dispatchVideoGeneration = useAction(api.mayaTemplates.dispatchVideoGeneration);
  const [legacyBrands, setLegacyBrands] = useState<BrandProfile[]>([]);

  useEffect(() => {
    if (user?.uid) {
      getBrandProfiles(user.uid)
        .then((list) => setLegacyBrands(list || []))
        .catch(() => {});
    }
  }, [user?.uid]);

  // Combine Brand Kit sources
  const allBrands = React.useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      industry?: string;
      audience?: string;
      toneOfVoice?: string;
      colors?: { primary: string; secondary?: string; accent?: string };
      logoUrl?: string;
      productOffering?: string;
    }> = [];

    if (convexBrands && convexBrands.length > 0) {
      convexBrands.forEach((b: any) => {
        list.push({
          id: b._id || b.legacyId || b.name,
          name: b.name,
          industry: b.industry,
          audience: b.audience,
          toneOfVoice: b.toneOfVoice,
          colors: b.colors,
          logoUrl: b.logoUrl,
          productOffering: b.productOffering,
        });
      });
    }

    if (legacyBrands && legacyBrands.length > 0) {
      legacyBrands.forEach((b: any) => {
        if (!list.some((existing) => existing.name === b.name)) {
          list.push({
            id: b.id || b.name,
            name: b.name,
            industry: b.industry,
            audience: b.audience,
            toneOfVoice: b.toneOfVoice,
            colors: b.colors,
            logoUrl: b.logoUrl,
            productOffering: (b as any).productOffering,
          });
        }
      });
    }

    return list;
  }, [convexBrands, legacyBrands]);

  // Active Tab: 'trending' | 'preview'
  const [activeTab, setActiveTab] = useState<"trending" | "preview">("trending");

  // Location & Category State
  const [selectedLocation, setSelectedLocation] = useState<LocationPreset>(LOCATION_PRESETS[0]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Template Data
  const [templates, setTemplates] = useState<MemeTemplate[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLiveFromApi, setIsLiveFromApi] = useState<boolean>(false);
  const [videoPlaying, setVideoPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);

  // Brand-matched reel discovery: Gemini turns brand context into a handful of
  // "blank canvas" search queries (avatars, green-screen rants, universal
  // reactions) so the trending tab surfaces reels that actually fit this
  // brand instead of generic location-based ones.
  const [suggestedQueries, setSuggestedQueries] = useState<string[]>([]);
  const [isMatchingBrand, setIsMatchingBrand] = useState<boolean>(false);

  // Remix & Adaptation Modal State
  const [isRemixOpen, setIsRemixOpen] = useState<boolean>(false);
  const [isAdapting, setIsAdapting] = useState<boolean>(false);
  const [adaptedVideo, setAdaptedVideo] = useState<AdaptedMemeVideo | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Brand Configuration for Adaptation
  const [brandName, setBrandName] = useState<string>("MagicBox AI");
  const [brandIndustry, setBrandIndustry] = useState<string>("AI Video Creation & Growth Studio");
  const [brandAudience, setBrandAudience] = useState<string>("Creators, founders, marketing agencies");
  const [brandProduct, setBrandProduct] = useState<string>("Generate 30 viral video reels in 1 click from your phone");
  const [brandTone, setBrandTone] = useState<string>("Unhinged, witty, high-speed desi brainrot comedy with instant ROI punchline");
  const [brandPrimaryColor, setBrandPrimaryColor] = useState<string>("#FFE600");
  const [brandAccentColor, setBrandAccentColor] = useState<string>("#38BDF8");
  const [humorIntensity, setHumorIntensity] = useState<"unhinged_brainrot" | "witty_desi_satire" | "clever_b2b_punchline">("unhinged_brainrot");

  // Custom Comedic Angle auto-tracks the brand name/product until the user
  // edits it directly — a real, brand-specific starting script they can tweak,
  // not a generic placeholder and not stale copy from a different brand.
  const defaultCustomAngle = (name: string, product: string) =>
    product
      ? `Show how pointless doing this manually looks now that ${name || "your brand"} exists — punchline should highlight: ${product}`
      : `Show how foolish it is to do this manually when ${name || "your brand"} does it instantly`;
  const [customAngle, setCustomAngle] = useState<string>(() =>
    defaultCustomAngle("MagicBox AI", "Generate 30 viral video reels in 1 click from your phone")
  );
  const [customAngleTouched, setCustomAngleTouched] = useState(false);

  useEffect(() => {
    if (customAngleTouched) return;
    setCustomAngle(defaultCustomAngle(brandName, brandProduct));
  }, [brandName, brandProduct, customAngleTouched]);

  // Which saved brand kit is currently applied to the form — shared by the
  // Remix modal's dropdown and the Match-Reels-To-Your-Brand dropdown, so
  // picking one anywhere updates every brand field consistently.
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");

  const applyBrandKit = (id: string) => {
    const found = allBrands.find((b) => b.id === id);
    if (!found) return;
    setSelectedBrandId(id);
    // Overwrite every field (not just the ones the found brand happens to
    // have) so switching brands never leaves a previous brand's text behind.
    setBrandName(found.name || "Your Brand");
    setBrandIndustry(found.industry || "");
    setBrandAudience(found.audience || "");
    setBrandProduct(found.productOffering || "");
    setBrandTone(found.toneOfVoice || "");
    setBrandPrimaryColor(found.colors?.primary || "#FFE600");
    setBrandAccentColor(found.colors?.accent || "#38BDF8");
    setCustomAngle(defaultCustomAngle(found.name || "", found.productOffering || ""));
    setCustomAngleTouched(false);
  };

  // Once your real brand kits load (from onboarding), use the first one
  // instead of leaving the MagicBox AI demo defaults on screen.
  useEffect(() => {
    if (selectedBrandId || allBrands.length === 0) return;
    applyBrandKit(allBrands[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBrands, selectedBrandId]);

  // Video Generation Job State — jobId persists across reloads so an
  // in-flight render isn't stranded (same pattern as Studio.tsx's video job).
  const [videoJobId, setVideoJobId] = usePersistentState<string | null>("maya-video-job-id", null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<boolean>(false);
  const videoJob = useQuery(
    api.mayaTemplates.job,
    isConvexConfigured && user && videoJobId ? { jobId: videoJobId as any } : "skip"
  );

  useEffect(() => {
    if (!videoJob) return;
    if (videoJob.status === "completed") {
      setIsGeneratingVideo(false);
      toast.success("Video ready!");
    } else if (videoJob.status === "failed") {
      setIsGeneratingVideo(false);
      toast.error(`Video generation failed: ${videoJob.error ?? "Unknown error"}`);
    }
  }, [videoJob?.status]);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Filter templates by category
  const filteredTemplates = templates.filter((t) => {
    if (selectedCategory === "all") return true;
    if (selectedCategory === "Productivity") return t.format === "before_after_comparison" || t.title.toLowerCase().includes("productiv");
    if (selectedCategory === "B2B SaaS/Platform") return t.format === "sigma_grindset_satire" || t.title.toLowerCase().includes("b2b");
    if (selectedCategory === "Desi Brainrot") return t.format === "talking_head_rant" || t.tags.includes("brainrot");
    if (selectedCategory === "Neutral/Filler") return t.format === "dramatic_reaction";
    if (selectedCategory === "E-Commerce") return t.format === "before_after_comparison";
    return true;
  });

  const activeTemplate = filteredTemplates[activeIndex] || filteredTemplates[0] || templates[0];

  // A stale adaptation/video job must never be shown for a DIFFERENT reel or
  // a DIFFERENT brand than it was generated for — otherwise switching reels
  // (carousel nav, category filter, a fresh search) or switching brand kits
  // silently keeps showing the old one, since the shortcut buttons below only
  // (re)adapt `if (!adaptedVideo)`. Clearing on either change keeps that
  // guard correct and stops "brand says Ownly, reel says Domain2Deals".
  useEffect(() => {
    setAdaptedVideo(null);
    setVideoJobId(null);
  }, [activeTemplate?.templateId, selectedBrandId]);

  // Refresh keeps returning the *next* page of the same search when Monid
  // gives us a token; when it doesn't, we rotate the keyword through a few
  // variants instead — a plain re-run of the identical query would otherwise
  // return the same top trending results every time.
  const REFRESH_QUERY_VARIANTS = ["", " new", " latest", " viral right now", " trending today"];
  const [paginationToken, setPaginationToken] = useState<string | undefined>(undefined);
  const [refreshRotation, setRefreshRotation] = useState(0);

  // Fetch trending reels via the mayaTemplates Convex action (Monid runs
  // server-side now — no API key in the browser, no CORS). Requires sign-in
  // since the action is auth-gated server-side. Only verified AI-generated
  // reels are ever shown: an empty list is the honest result when nothing
  // qualifies, never non-AI placeholder footage standing in for real results.
  const fetchTrendingReels = async (preset?: LocationPreset, customQ?: string, isRefresh = false) => {
    if (!user) {
      setTemplates([]);
      setIsLiveFromApi(false);
      return;
    }
    setIsLoading(true);
    const baseQuery = customQ || (preset ? preset.query : selectedLocation.query);

    let targetQuery = baseQuery;
    let tokenToUse: string | undefined;
    if (isRefresh) {
      if (paginationToken) {
        tokenToUse = paginationToken;
      } else {
        const nextRotation = (refreshRotation + 1) % REFRESH_QUERY_VARIANTS.length;
        setRefreshRotation(nextRotation);
        targetQuery = `${baseQuery}${REFRESH_QUERY_VARIANTS[nextRotation]}`.trim();
      }
    } else {
      setPaginationToken(undefined);
      setRefreshRotation(0);
    }

    try {
      toast.info(`Fetching trending reels for: "${targetQuery}"...`);
      const result = await searchTrendingTemplates({ query: targetQuery, paginationToken: tokenToUse });

      setTemplates(result.templates);
      setActiveIndex(0);
      setIsLiveFromApi(result.source === "monid");
      setPaginationToken(result.nextPaginationToken);
      if (result.source === "monid") {
        toast.success(`Loaded ${result.templates.length} AI-generated reels!`);
      } else {
        toast.warning(result.fallbackReason || "No AI-generated reels found for this search.");
      }
    } catch (err: any) {
      console.warn("Monid API call failed:", err);
      setTemplates([]);
      setIsLiveFromApi(false);
      toast.error(`Reel search failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Find reels that actually fit the current brand: Gemini proposes a few
  // brand-contextualized AI animated / parody meme search queries from the
  // full brand kit, then we search Monid across all of them and merge results.
  const handleMatchReelsToBrand = async () => {
    if (!user) {
      toast.error("Sign in to find reels for your brand.");
      return;
    }
    if (!selectedBrandId) {
      toast.error("Select a saved brand first.");
      return;
    }
    setIsMatchingBrand(true);
    setIsLoading(true);
    try {
      const { queries } = await suggestSearchQueries({
        brandName,
        industry: brandIndustry || undefined,
        productOffering: brandProduct || undefined,
        audience: brandAudience || undefined,
        toneOfVoice: brandTone || undefined,
      });
      setSuggestedQueries(queries);
      toast.info(`Searching reels for ${brandName}: ${queries.join(" · ")}`);

      const results = await Promise.all(queries.map((q) => searchTrendingTemplates({ query: q })));
      const seen = new Set<string>();
      const merged: MemeTemplate[] = [];
      let anyLive = false;
      for (const result of results) {
        if (result.source === "monid") anyLive = true;
        for (const t of result.templates) {
          if (seen.has(t.templateId)) continue;
          seen.add(t.templateId);
          merged.push(t);
        }
      }

      setTemplates(merged);
      setActiveIndex(0);
      setIsLiveFromApi(anyLive);
      if (merged.length) {
        toast.success(`Found ${merged.length} AI-generated reels matched to ${brandName}.`);
      } else {
        toast.warning(
          `No AI-generated reels found for ${brandName} — try "Refresh Reels" for a different page of results.`
        );
      }
    } catch (err: any) {
      toast.error(`Couldn't find brand-matched reels: ${err.message}`);
    } finally {
      setIsMatchingBrand(false);
      setIsLoading(false);
    }
  };

  // Initial load — wait for auth to resolve so a still-loading session
  // doesn't hit the auth-gated action before the identity is ready.
  useEffect(() => {
    if (authLoading) return;
    fetchTrendingReels(selectedLocation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  // Handle Carousel navigation
  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredTemplates.length - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < filteredTemplates.length - 1 ? prev + 1 : 0));
  };

  // Copy helper
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Run Meme & Brand Adaptation via the mayaTemplates Convex action (Gemini
  // runs server-side — falls back to the algorithmic synthesizer on failure).
  //
  // `autoGenerate` chains straight into video generation once the script is
  // ready — used by the modal's explicit "Apply & Generate Video" action.
  // It's opt-in because generation spends v-credits, so passive paths (tab
  // switches, opening the remix modal) must not trigger it.
  const handleAdaptTemplate = async (autoGenerate = false) => {
    if (!activeTemplate) return;
    if (!user) {
      toast.error("Sign in to adapt this template for your brand.");
      return;
    }
    setIsAdapting(true);
    try {
      const adaptation = await adaptTemplateAction({
        template: activeTemplate,
        brand: {
          name: brandName,
          industry: brandIndustry,
          audience: brandAudience,
          productOffering: brandProduct,
          toneOfVoice: brandTone,
          colors: {
            primary: brandPrimaryColor,
            secondary: "#0F172A",
            accent: brandAccentColor,
          },
        },
        humorIntensity,
        customProductAngle: customAngle,
      });

      setAdaptedVideo({
        ...adaptation,
        brandName,
        templateTitle: activeTemplate.title,
        aspectRatio: activeTemplate.aspectRatio,
      } as AdaptedMemeVideo);
      setVideoJobId(null);
      if (adaptation.usedAI) {
        toast.success("Meme template successfully adapted for " + brandName + "!");
      } else {
        toast.warning(
          "Gemini was unavailable, so this used the deterministic template fallback instead of a fresh AI-written script."
        );
      }

      // Chain straight into rendering the adapted script into an actual video.
      if (autoGenerate) {
        await startVideoGeneration(adaptation.adaptationId);
      }
    } catch (err: any) {
      toast.error("Adaptation error: " + err.message);
    } finally {
      setIsAdapting(false);
    }
  };

  /**
   * Kicks off generation for an adaptation id. The server picks the mode:
   * lip-sync onto the ORIGINAL chosen reel when FAL_API_KEY is configured
   * (the actual "edit the reel" behavior), otherwise a synthetic Veo render
   * from the adapted prompt (which works today with the Google key alone).
   */
  const startVideoGeneration = async (adaptationId: string) => {
    setIsGeneratingVideo(true);
    try {
      const { jobId, mode } = await dispatchVideoGeneration({ adaptationId: adaptationId as any });
      setVideoJobId(jobId as unknown as string);
      toast.success(
        mode === "replicate"
          ? "Watching the reel, writing the production prompt, then generating each beat..."
          : mode === "lipsync"
            ? "Lip-syncing the original reel to your brand's new script..."
            : mode === "dub"
              ? "Dubbing your brand's script onto the original reel..."
              : "Generating a new video with Google Veo from your adapted script..."
      );
    } catch (err: any) {
      toast.error("Video generation dispatch failed: " + err.message);
      setIsGeneratingVideo(false);
    }
  };

  /** Publish the finished adapted reel to connected channels via the existing publish engine. */
  const [isPosting, setIsPosting] = useState(false);
  const handlePostNow = async () => {
    if (!videoJobId || videoJob?.status !== "completed" || !videoJob?.finalVideoUrl) return;
    setIsPosting(true);
    try {
      const res = await postFinishedReel({ jobId: videoJobId as any });
      if (res.published > 0) {
        toast.success(`Posted to ${res.published} of ${res.of} connected channel(s)!`);
      } else {
        toast.warning(`Publish finished with status "${res.status}" — check the post in Library.`);
      }
    } catch (err: any) {
      toast.error(`Couldn't post: ${err.message}`);
    } finally {
      setIsPosting(false);
    }
  };

  /** Preview tab's manual "Generate Video" button — same path as auto-generate. */
  const handleGenerateVideo = async () => {
    if (!adaptedVideo) return;
    if (!user) {
      toast.error("Sign in to generate video.");
      return;
    }
    await startVideoGeneration(adaptedVideo.adaptationId);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] dark:bg-[#0B0C0E] text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-200">
      {/* Top Banner Notice */}
      <div className="bg-gradient-to-r from-orange-500/15 via-amber-500/15 to-purple-500/15 border-b border-orange-500/20 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="bg-orange-500 text-white font-bold px-2 py-0.5 rounded text-[10px] tracking-wider uppercase">
            Transient Test Route
          </span>
          <span className="text-zinc-600 dark:text-zinc-300">
            <strong>MAYA-Templates:</strong> Indian Brainrot & Viral Meme Reels Ingestion with Monid TikHub API, Brand Adaptation & Lip-Sync Conditioning
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/prompt-enhance-test"
            className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-medium"
          >
            Go to Prompt Enhance Test <ArrowRight className="w-3 h-3" />
          </Link>
          <Link
            to="/studio"
            className="text-zinc-600 dark:text-zinc-400 hover:underline flex items-center gap-1"
          >
            Studio <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Component Header & Tabs (Matching the Image) */}
        <div className="bg-white dark:bg-zinc-900/90 rounded-2xl p-5 border border-zinc-200/80 dark:border-zinc-800 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left Tabs (Trending Content & Preview) */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab("trending")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeTab === "trending"
                    ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent"
                }`}
              >
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500/20" />
                <span>Trending Content</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("preview");
                  if (!adaptedVideo) {
                    handleAdaptTemplate();
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeTab === "preview"
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent"
                }`}
              >
                <FileEdit className="w-4 h-4 text-purple-500" />
                <span>Preview & Blueprint</span>
                {adaptedVideo && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            </div>

            {/* Right Action & Clapperboard */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchTrendingReels(undefined, undefined, true)}
                disabled={isLoading}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-orange-500" : ""}`} />
                <span>{isLoading ? "Fetching..." : "Refresh Reels"}</span>
              </button>

              <div className="relative group">
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                  <Film className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  <ChevronDown className="w-3 h-3 text-zinc-500" />
                </button>
              </div>
            </div>
          </div>

          {/* Location & Region Selector (Trending in India) */}
          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider mr-1">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                Location:
              </div>
              {LOCATION_PRESETS.map((loc) => {
                const isSelected = selectedLocation.id === loc.id;
                return (
                  <button
                    key={loc.id}
                    onClick={() => {
                      setSelectedLocation(loc);
                      fetchTrendingReels(loc);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-rose-500 text-white shadow-sm ring-2 ring-rose-500/20 font-semibold"
                        : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    <span>{loc.flag}</span>
                    <span>{loc.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Search Query */}
            <div className="flex items-center gap-2 max-w-md w-full">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search reels (e.g. chai meme, bhai ye kya ho gaya)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchQuery.trim()) {
                      fetchTrendingReels(undefined, searchQuery.trim());
                    }
                  }}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-purple-500 text-zinc-800 dark:text-zinc-200"
                />
              </div>
              <button
                onClick={() => {
                  if (searchQuery.trim()) {
                    fetchTrendingReels(undefined, searchQuery.trim());
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
              >
                Search
              </button>
            </div>
          </div>

          {/* Category Filter Pills (Matching Reference Image) */}
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <div className="flex items-center gap-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider mr-1">
              <Tag className="w-3.5 h-3.5" />
              Filter:
            </div>
            {CATEGORY_PILLS.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setActiveIndex(0);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${cat.color} ${
                    isSelected ? "ring-2 ring-offset-1 ring-zinc-400 dark:ring-zinc-600 font-bold scale-105" : "opacity-80 hover:opacity-100"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Match Reels To Your Brand — pick a saved brand kit, we pull its
              full details and turn them into "blank canvas" search queries
              (AI avatars, green-screen rants, universal reactions) instead of
              generic location-based search. No manual brand entry here — the
              brand kit from onboarding is the single source of truth. */}
          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              <Wand2 className="w-3.5 h-3.5 text-purple-500" />
              Match Reels To Your Brand
            </div>
            {allBrands.length > 0 ? (
              <select
                onChange={(e) => applyBrandKit(e.target.value)}
                value={selectedBrandId}
                className="w-full mb-2 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="" disabled>Select a saved brand...</option>
                {allBrands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.industry || "General"})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-zinc-500 mb-2">
                No saved brand kits yet — add one from Brand Kit / onboarding first.
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleMatchReelsToBrand}
                disabled={isMatchingBrand || !selectedBrandId}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition disabled:opacity-60"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isMatchingBrand ? "animate-pulse" : ""}`} />
                <span>{isMatchingBrand ? "Finding matching reels..." : "Find Matching Reels"}</span>
              </button>
              {suggestedQueries.map((q) => (
                <button
                  key={q}
                  onClick={() => fetchTrendingReels(undefined, q)}
                  disabled={isLoading}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition"
                  title="Search this query alone"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Content View based on Active Tab */}
        {activeTab === "trending" ? (
          /* ========================================================================= */
          /* 3D CAROUSEL / REEL STACK VIEW (Faithful to Reference Image)               */
          /* ========================================================================= */
          <div className="relative py-6 flex flex-col items-center justify-center overflow-hidden">
            {/* Template Counter / Status */}
            <div className="mb-4 flex items-center justify-between w-full max-w-3xl px-4 text-xs text-zinc-500">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  Showing {filteredTemplates.length > 0 ? activeIndex + 1 : 0} of {filteredTemplates.length} Reels
                </span>
                <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[10px]">
                  {isLiveFromApi ? "🟢 AI-Generated · Verified" : "— No results"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span>{selectedLocation.name}</span>
                <span>•</span>
                <span className="capitalize">{activeTemplate?.format ? activeTemplate.format.replace(/_/g, " ") : "Template"}</span>
              </div>
            </div>

            {/* Empty state — only verified AI-generated reels are ever shown,
                so "nothing qualified" is a real outcome, not a bug. */}
            {filteredTemplates.length === 0 ? (
              <div className="w-full max-w-md text-center py-16 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center mx-auto">
                  <Film className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {isLoading ? "Searching for AI-generated reels..." : "No AI-generated reels found"}
                </h3>
                <p className="text-xs text-zinc-500">
                  {isLoading
                    ? "Verifying each result is genuinely AI-generated — this takes a moment."
                    : "Only verified AI-generated reels (animated characters, talking animals, 3D mascots) are shown here. Try “Refresh Reels” for a different page, a different location, or “Find Matching Reels” for your brand."}
                </p>
              </div>
            ) : (
            <>
            {/* Carousel Container */}
            <div className="relative w-full max-w-4xl flex items-center justify-center min-h-[580px]">
              {/* Left Arrow Button */}
              <button
                onClick={handlePrev}
                className="absolute left-2 sm:left-6 z-30 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md border border-white/20 shadow-lg transition-transform active:scale-95"
                title="Previous Reel"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              {/* Right Arrow Button */}
              <button
                onClick={handleNext}
                className="absolute right-2 sm:right-6 z-30 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md border border-white/20 shadow-lg transition-transform active:scale-95"
                title="Next Reel"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Stacked Cards Layout */}
              <div className="flex items-center justify-center gap-4 sm:gap-6 w-full">
                {/* Previous Reel Card (Left Preview) */}
                {filteredTemplates.length > 1 && (
                  <div
                    onClick={handlePrev}
                    className="hidden md:block w-[240px] aspect-[9/16] rounded-2xl overflow-hidden shadow-md border border-zinc-200 dark:border-zinc-800 bg-zinc-900 opacity-50 hover:opacity-75 transition-all duration-300 transform scale-90 -rotate-2 cursor-pointer relative"
                  >
                    {(() => {
                      const prevIdx = activeIndex > 0 ? activeIndex - 1 : filteredTemplates.length - 1;
                      const prevItem = filteredTemplates[prevIdx];
                      return (
                        <div className="relative w-full h-full bg-zinc-950 flex flex-col justify-between p-4 text-white">
                          <img
                            src={prevItem.previewImageUrl || prevItem.thumbnailUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=60"}
                            alt={prevItem.title}
                            className="absolute inset-0 w-full h-full object-cover opacity-60"
                          />
                          <div className="relative z-10 text-[10px] bg-black/60 px-2 py-1 rounded w-fit">
                            @{prevItem.author?.username || "creator"}
                          </div>
                          <div className="relative z-10">
                            <p className="text-xs font-bold line-clamp-2">{prevItem.viralHook}</p>
                            <p className="text-[10px] text-zinc-300 mt-1">
                              ❤️ {prevItem.metrics?.likes ? (prevItem.metrics.likes >= 1000 ? `${(prevItem.metrics.likes / 1000).toFixed(1)}K` : prevItem.metrics.likes) : "12.4K"}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Main Active Center Reel Card (Dominant View) */}
                {activeTemplate && (
                  <div className="w-[310px] sm:w-[340px] aspect-[9/16] rounded-3xl overflow-hidden shadow-2xl border-2 border-zinc-300/80 dark:border-zinc-700 bg-black relative z-20 transition-all duration-300 transform scale-100 flex flex-col justify-between">
                    {/* Reel Video or Image Preview */}
                    <div className="absolute inset-0 w-full h-full overflow-hidden bg-zinc-950">
                      {activeTemplate.previewVideoUrl ? (
                        <video
                          ref={videoRef}
                          src={activeTemplate.previewVideoUrl}
                          poster={activeTemplate.previewImageUrl || activeTemplate.thumbnailUrl}
                          autoPlay
                          loop
                          muted={isMuted}
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={activeTemplate.previewImageUrl || activeTemplate.thumbnailUrl || "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80"}
                          alt={activeTemplate.title}
                          className="w-full h-full object-cover opacity-85"
                        />
                      )}

                      {/* Video Vignette Gradient */}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none" />
                    </div>

                    {/* Top Overlay: Creator Badge & Sound Info */}
                    <div className="relative z-20 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-white text-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="font-semibold truncate max-w-[120px]">
                          @{activeTemplate.author?.username || "creator"}
                        </span>
                      </div>

                      {/* Video Controls (Mute / Play) */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              if (videoPlaying) {
                                videoRef.current.pause();
                                setVideoPlaying(false);
                              } else {
                                videoRef.current.play();
                                setVideoPlaying(true);
                              }
                            }
                          }}
                          className="w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition"
                        >
                          {videoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setIsMuted(!isMuted)}
                          className="w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition"
                        >
                          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Right Floating Engagement Metrics (Like in Reference Image) */}
                    <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-3 text-white">
                      {/* Likes */}
                      <button className="flex flex-col items-center group">
                        <div className="w-9 h-9 rounded-full bg-black/40 hover:bg-rose-600/80 backdrop-blur-md flex items-center justify-center border border-white/20 transition">
                          <Heart className="w-4 h-4 text-white group-hover:scale-110 transition" />
                        </div>
                        <span className="text-[10px] font-bold mt-0.5 shadow-sm">
                          {activeTemplate.metrics?.likes
                            ? (activeTemplate.metrics.likes >= 1000
                                ? `${(activeTemplate.metrics.likes / 1000).toFixed(1)}K`
                                : activeTemplate.metrics.likes)
                            : "9.3K"}
                        </span>
                      </button>

                      {/* Views */}
                      <div className="flex flex-col items-center">
                        <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20">
                          <Eye className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-[10px] font-bold mt-0.5 shadow-sm">
                          {activeTemplate.metrics?.plays
                            ? (activeTemplate.metrics.plays >= 1000
                                ? `${(activeTemplate.metrics.plays / 1000).toFixed(1)}K`
                                : activeTemplate.metrics.plays)
                            : "193.2K"}
                        </span>
                      </div>

                      {/* Comments */}
                      <div className="flex flex-col items-center">
                        <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20">
                          <MessageCircle className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-[10px] font-bold mt-0.5 shadow-sm">
                          {activeTemplate.metrics?.comments || "340"}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Action Button: "Remix this" (Matching Reference Image) */}
                    <div className="relative z-20 p-4 pt-0">
                      <button
                        onClick={async () => {
                          // One-click remix for the CURRENTLY SELECTED brand.
                          // This used to inline its own adapt call against
                          // allBrands[0], which ignored the dropdown and then
                          // overwrote the brand fields without updating
                          // selectedBrandId — that's how the form could read
                          // "Ownly" while the reel was built for another brand.
                          // Routing through handleAdaptTemplate keeps one code
                          // path and one source of truth for brand state.
                          if (!allBrands.length) {
                            setIsRemixOpen(true);
                            return;
                          }
                          setActiveTab("preview");
                          await handleAdaptTemplate(true);
                        }}
                        className="w-full py-3 px-4 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-98 border border-white/20"
                      >
                        <Shuffle className="w-4 h-4 animate-spin-slow" />
                        <span>Remix this</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Next Reel Card (Right Preview) */}
                {filteredTemplates.length > 1 && (
                  <div
                    onClick={handleNext}
                    className="hidden md:block w-[240px] aspect-[9/16] rounded-2xl overflow-hidden shadow-md border border-zinc-200 dark:border-zinc-800 bg-zinc-900 opacity-50 hover:opacity-75 transition-all duration-300 transform scale-90 rotate-2 cursor-pointer relative"
                  >
                    {(() => {
                      const nextIdx = activeIndex < filteredTemplates.length - 1 ? activeIndex + 1 : 0;
                      const nextItem = filteredTemplates[nextIdx];
                      return (
                        <div className="relative w-full h-full bg-zinc-950 flex flex-col justify-between p-4 text-white">
                          <img
                            src={nextItem.previewImageUrl || nextItem.thumbnailUrl || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=60"}
                            alt={nextItem.title}
                            className="absolute inset-0 w-full h-full object-cover opacity-60"
                          />
                          <div className="relative z-10 text-[10px] bg-black/60 px-2 py-1 rounded w-fit">
                            @{nextItem.author?.username || "creator"}
                          </div>
                          <div className="relative z-10">
                            <p className="text-xs font-bold line-clamp-2">{nextItem.viralHook}</p>
                            <p className="text-[10px] text-zinc-300 mt-1">
                              ❤️ {nextItem.metrics?.likes ? (nextItem.metrics.likes >= 1000 ? `${(nextItem.metrics.likes / 1000).toFixed(1)}K` : nextItem.metrics.likes) : "18.2K"}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions below Carousel */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => {
                  setIsRemixOpen(true);
                  if (!adaptedVideo) handleAdaptTemplate();
                }}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm flex items-center gap-2 transition"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Customize & Adapt Script for Brand</span>
              </button>

              <button
                onClick={() => setActiveTab("preview")}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 flex items-center gap-2 transition"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>View Full Composition Manifest</span>
              </button>
            </div>
            </>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* PREVIEW & BLUEPRINT MANIFEST VIEW                                         */
          /* ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Template & Adaptation Summary */}
            <div className="lg:col-span-5 space-y-5">
              {!activeTemplate ? (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 border border-zinc-200 dark:border-zinc-800 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center mx-auto">
                    <Film className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">No reel selected</h3>
                  <p className="text-xs text-zinc-500">
                    Find an AI-generated reel on the Trending Content tab first.
                  </p>
                </div>
              ) : (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    Selected Source Reel
                  </h3>
                  <span className="text-[10px] bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 font-semibold px-2 py-0.5 rounded">
                    {activeTemplate.durationSec}s • {activeTemplate.format}
                  </span>
                </div>

                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black relative">
                  {activeTemplate.previewVideoUrl ? (
                    <video
                      src={activeTemplate.previewVideoUrl}
                      controls
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={activeTemplate.previewImageUrl || activeTemplate.thumbnailUrl || "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80"}
                      alt={activeTemplate.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Viral Hook</h4>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                    "{activeTemplate.viralHook}"
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Original Script</h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 italic bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    "{activeTemplate.defaultScript}"
                  </p>
                </div>

                <button
                  onClick={() => setIsRemixOpen(true)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm flex items-center justify-center gap-2 transition"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Configure Brand Adaptation</span>
                </button>
              </div>
              )}
            </div>

            {/* Right Column: Adapted Brand Video Manifest */}
            <div className="lg:col-span-7 space-y-5">
              {adaptedVideo ? (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        Adapted Brand Reel: <span className="text-purple-600 dark:text-purple-400">{adaptedVideo.brandName}</span>
                      </h3>
                      <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                        <span>Template: {adaptedVideo.templateTitle} ({adaptedVideo.durationSec}s • {adaptedVideo.aspectRatio})</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                            adaptedVideo.usedAI
                              ? "bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300"
                              : "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                          }`}
                          title={adaptedVideo.usedAI ? "Written by Gemini for this specific reel" : "Gemini was unavailable — deterministic template fallback"}
                        >
                          {adaptedVideo.usedAI ? "✨ AI-written" : "⚡ Template fallback"}
                        </span>
                      </p>
                    </div>

                    <button
                      onClick={() => handleAdaptTemplate()}
                      disabled={isAdapting}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isAdapting ? "animate-spin text-purple-500" : ""}`} />
                      <span>{isAdapting ? "Regenerating..." : "Regenerate"}</span>
                    </button>
                  </div>

                  {/* Adapted Hook & Spoken Script */}
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60">
                      <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider block">
                        🏷️ Top Caption / Hook Text
                      </span>
                      <p className="text-sm font-extrabold text-purple-950 dark:text-purple-100 mt-0.5">
                        {adaptedVideo.hookText}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                        🗣️ Spoken Dialogue (Hinglish/English Creator Rant)
                      </span>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mt-1">
                        "{adaptedVideo.adaptedScript}"
                      </p>
                    </div>
                  </div>

                  {/* Per-speaker timing track — only worth showing when there
                      are multiple speakers; for a single speaker it just
                      repeats the spoken dialogue block above verbatim. */}
                  <div className={adaptedVideo.lipSyncScript.length > 1 ? "" : "hidden"}>
                    <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-rose-500" />
                      Per-Speaker Timing & Delivery
                    </h4>
                    <div className="space-y-2">
                      {adaptedVideo.lipSyncScript.map((line, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between text-[11px] text-zinc-500">
                            <span className="font-semibold text-rose-600 dark:text-rose-400">
                              Shot {idx + 1} ({line.startSec}s - {line.endSec}s)
                            </span>
                            <span className="bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded text-[10px]">
                              {line.deliveryTone}
                            </span>
                          </div>
                          <p className="font-medium text-zinc-800 dark:text-zinc-200">
                            "{line.spokenDialogue}"
                          </p>
                          <div className="text-[10px] text-zinc-400 italic">
                            Expression: {line.facialExpression}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Kinetic Text Overlays Preview */}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-amber-500" />
                      Kinetic Text Overlays
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {adaptedVideo.textOverlays.map((to, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg border text-xs"
                          style={{
                            backgroundColor: to.bgColor || "#000000CC",
                            borderColor: to.color || "#FFE600",
                          }}
                        >
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">
                            [{to.placement.toUpperCase()}]
                          </span>
                          <span className="font-bold text-xs" style={{ color: to.color || "#FFFFFF" }}>
                            {to.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ready-to-paste Instagram caption + hashtags */}
                  {adaptedVideo.instagramCaption && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                          <FileEdit className="w-3.5 h-3.5 text-pink-500" />
                          Instagram Caption
                        </h4>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              `${adaptedVideo.instagramCaption}\n\n${(adaptedVideo.hashtags || []).join(" ")}`,
                              "ig_caption"
                            )
                          }
                          className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                        >
                          {copiedKey === "ig_caption" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === "ig_caption" ? "Copied" : "Copy caption"}</span>
                        </button>
                      </div>
                      <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                        <p className="text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                          {adaptedVideo.instagramCaption}
                        </p>
                        {(adaptedVideo.hashtags || []).length > 0 && (
                          <p className="text-[11px] text-purple-600 dark:text-purple-400 break-words">
                            {adaptedVideo.hashtags.join(" ")}
                          </p>
                        )}
                      </div>
                      {adaptedVideo.adaptationNote && (
                        <p className="mt-1.5 text-[11px] text-zinc-500 italic">
                          Angle: {adaptedVideo.adaptationNote}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Video Model Conditioning Prompt (Google Veo 2 / 3.1 & Runway Gen-3) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        Google Veo 2 / 3.1 Video Model Prompt
                      </h4>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            adaptedVideo.videoModelPrompts.googleVeoPrompt,
                            "veo_prompt"
                          )
                        }
                        className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                      >
                        {copiedKey === "veo_prompt" ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedKey === "veo_prompt" ? "Copied" : "Copy Prompt"}</span>
                      </button>
                    </div>

                    <pre className="p-3.5 rounded-xl bg-zinc-950 text-zinc-200 text-xs font-mono whitespace-pre-wrap border border-zinc-800 leading-relaxed">
                      {adaptedVideo.videoModelPrompts.googleVeoPrompt}
                    </pre>
                  </div>

                  {/* Video Model Dispatch Button */}
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      onClick={handleGenerateVideo}
                      disabled={isGeneratingVideo}
                      className="flex-1 py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md flex items-center justify-center gap-2 transition"
                    >
                      <Film className="w-4 h-4" />
                      <span>{isGeneratingVideo ? "Generating Video..." : "Generate Video"}</span>
                    </button>
                  </div>

                  {/* ===================================================== */}
                  {/* FINAL ADAPTED REEL — the actual deliverable            */}
                  {/* ===================================================== */}
                  {videoJob && (
                    <div className="rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <Film className="w-4 h-4" />
                          Final Adapted Reel
                        </h4>
                        <span className="bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">
                          {videoJob.mode === "replicate"
                            ? "Replicated · fresh multi-beat cut"
                            : videoJob.mode === "lipsync"
                              ? "Lip-synced onto original"
                              : videoJob.mode === "dub"
                                ? "Original reel · new voiceover"
                                : "Veo generated (new footage)"}{" "}
                          • {videoJob.status === "completed" ? "ready" : videoJob.stage}
                        </span>
                      </div>

                      {videoJob.status === "failed" ? (
                        <p className="text-xs text-rose-600 dark:text-rose-400">
                          {videoJob.error || "Generation failed."}
                        </p>
                      ) : videoJob.finalVideoUrl ? (
                        <div className="space-y-3">
                          <video
                            key={videoJob.finalVideoUrl}
                            src={videoJob.finalVideoUrl}
                            controls
                            autoPlay
                            loop
                            className="w-full rounded-xl bg-black aspect-[9/16] max-h-[420px] mx-auto"
                          />
                          {videoJob.error && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400">{videoJob.error}</p>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handlePostNow}
                              disabled={isPosting}
                              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md flex items-center justify-center gap-2 transition disabled:opacity-60"
                            >
                              <Radio className="w-4 h-4" />
                              <span>{isPosting ? "Posting..." : "Post Now to Connected Channels"}</span>
                            </button>
                            <a
                              href={videoJob.finalVideoUrl}
                              download
                              className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 transition"
                            >
                              Download
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 text-center space-y-2">
                          <RefreshCw className="w-6 h-6 mx-auto animate-spin text-emerald-600" />
                          <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                            {videoJob.stage === "analyze"
                              ? "Watching the reel and writing the production prompt..."
                              : "Adapting the reel to your script..."}
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            {videoJob.stage === "analyze"
                              ? "Reverse-engineering its pacing, camera language and energy into a shot-by-shot brief."
                              : videoJob.stage === "generate"
                                ? videoJob.mode === "replicate"
                                  ? "Generating one fresh clip per beat — this is the slow part."
                                  : videoJob.mode === "lipsync"
                                    ? "Lip-syncing the original footage to the new dialogue."
                                    : "Generating footage and voicing your script."
                                : videoJob.mode === "replicate"
                                  ? "Stitching the beats together and laying the voiceover over the cut."
                                  : videoJob.mode === "dub"
                                    ? "Laying your script's voiceover over the original reel and burning in captions."
                                    : "Burning in captions, overlays and your logo."}{" "}
                            This takes a minute or two — it keeps updating on its own.
                          </p>

                          {/* Per-beat progress, so a 4-clip run isn't an opaque wait */}
                          {videoJob.beatClips && videoJob.beatClips.length > 0 && (
                            <div className="pt-2 space-y-1 text-left max-w-md mx-auto">
                              {videoJob.beatClips.map((clip: any) => (
                                <div
                                  key={clip.index}
                                  className="flex items-start gap-2 text-[11px] text-zinc-600 dark:text-zinc-400"
                                >
                                  <span className="mt-0.5">
                                    {clip.url ? "✅" : clip.failed ? "❌" : clip.retries ? "🔄" : "⏳"}
                                  </span>
                                  <span className="flex-1">
                                    <strong>Beat {clip.index}</strong> — {clip.description}
                                    {/* A bare ❌ tells you nothing; the generator's own
                                        reason is the only way to know whether to reword
                                        the script or just try again. */}
                                    {clip.failed && clip.error && (
                                      <span className="block text-rose-600 dark:text-rose-400">
                                        {clip.error}
                                      </span>
                                    )}
                                    {!clip.failed && !clip.url && clip.retries > 0 && (
                                      <span className="block text-amber-600 dark:text-amber-400">
                                        Blocked by the video model's safety filter — retrying
                                        with softer wording ({clip.retries}/2).
                                      </span>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* The production prompt, for pasting into Omni/Higgsfield directly */}
                      {videoJob.fullPrompt && (
                        <div className="pt-3 border-t border-emerald-200 dark:border-emerald-800">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                              Production prompt
                            </span>
                            <button
                              onClick={() => copyToClipboard(videoJob.fullPrompt!, "full_prompt")}
                              className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                            >
                              {copiedKey === "full_prompt" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedKey === "full_prompt" ? "Copied" : "Copy for Omni / Higgsfield"}</span>
                            </button>
                          </div>
                          <pre className="p-3 rounded-lg bg-zinc-950 text-zinc-300 text-[10px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto border border-zinc-800 leading-relaxed">
                            {videoJob.fullPrompt}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-10 border border-zinc-200 dark:border-zinc-800 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center mx-auto">
                    <Wand2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    No Brand Adaptation Generated Yet
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Click "Customize & Adapt Script" or "Remix this" to adapt this meme template to your brand identity with custom lip-sync and overlays.
                  </p>
                  <button
                    onClick={() => handleAdaptTemplate()}
                    disabled={isAdapting}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm inline-flex items-center gap-2 transition"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isAdapting ? "Generating Adaptation..." : `Generate for ${brandName}`}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* REMIX / BRAND ADAPTATION MODAL DRAWER                                     */}
      {/* ========================================================================= */}
      {isRemixOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center">
                  <Shuffle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Remix Meme Template for Your Brand
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Template: <strong>{activeTemplate?.title || "Meme Template"}</strong> ({activeTemplate?.format || "meme"})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsRemixOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {allBrands.length > 0 && (
                <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50">
                  <label className="text-[11px] font-bold text-purple-700 dark:text-purple-300 block mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Auto-Fill From Your Saved Brand Kits
                  </label>
                  <select
                    onChange={(e) => applyBrandKit(e.target.value)}
                    value={selectedBrandId}
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="" disabled>Select a saved brand...</option>
                    {allBrands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.industry || "General"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Brand Name & Industry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Brand Name *
                  </label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-purple-500 text-zinc-800 dark:text-zinc-200"
                    placeholder="e.g. MagicBox AI"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Industry / Vertical
                  </label>
                  <input
                    type="text"
                    value={brandIndustry}
                    onChange={(e) => setBrandIndustry(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-purple-500 text-zinc-800 dark:text-zinc-200"
                    placeholder="e.g. B2B Video Automation"
                  />
                </div>
              </div>

              {/* Product Pitch / Offering */}
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Product Offering / Core Value Proposition
                </label>
                <input
                  type="text"
                  value={brandProduct}
                  onChange={(e) => setBrandProduct(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-purple-500 text-zinc-800 dark:text-zinc-200"
                  placeholder="e.g. Turn 1 prompt into 30 viral video reels"
                />
              </div>

              {/* Custom Angle / Hook */}
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Custom Comedic Angle / Pain Point
                </label>
                <textarea
                  rows={2}
                  value={customAngle}
                  onChange={(e) => {
                    setCustomAngle(e.target.value);
                    setCustomAngleTouched(true);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-purple-500 text-zinc-800 dark:text-zinc-200"
                  placeholder="e.g. Show how foolish it is to do this manually in 2026 when your brand does it in 1 click"
                />
              </div>

              {/* Humor Intensity */}
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Humor Style & Desi Brainrot Intensity
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "unhinged_brainrot", label: "🔥 Unhinged Brainrot", desc: "Maximum viral chaotic desi comedy" },
                    { id: "witty_desi_satire", label: "☕ Witty Satire", desc: "Hustle culture & relatable problem" },
                    { id: "clever_b2b_punchline", label: "💼 Clean B2B Punch", desc: "Sharp professional comparison" },
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setHumorIntensity(style.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        humorIntensity === style.id
                          ? "bg-purple-50 dark:bg-purple-950/40 border-purple-500 ring-1 ring-purple-500"
                          : "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100"
                      }`}
                    >
                      <div className="font-bold text-xs text-zinc-800 dark:text-zinc-200">{style.label}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">{style.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Brand Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Primary Color (Top Hook Highlight)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandPrimaryColor}
                      onChange={(e) => setBrandPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-zinc-300"
                    />
                    <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">{brandPrimaryColor}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Accent Color (Badge / CTA)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandAccentColor}
                      onChange={(e) => setBrandAccentColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-zinc-300"
                    />
                    <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">{brandAccentColor}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsRemixOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  // Switch to preview first so the job progress is visible
                  // while the adaptation + render runs.
                  setIsRemixOpen(false);
                  setActiveTab("preview");
                  await handleAdaptTemplate(true);
                }}
                disabled={isAdapting || isGeneratingVideo}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-md flex items-center gap-2 transition disabled:opacity-60"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isAdapting
                    ? "Writing script..."
                    : isGeneratingVideo
                      ? "Generating video..."
                      : "Apply & Generate Video"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
