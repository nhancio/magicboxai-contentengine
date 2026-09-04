import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@shared/lib/auth";
import type { BrandProfile } from "@shared/types";
import { getBrandProfiles } from "@shared/lib/automations";
import { isConvexConfigured } from "../lib/convex";
import {
  Sparkles,
  Video,
  Play,
  Film,
  Layers,
  Wand2,
  Copy,
  Check,
  Clock,
  Palette,
  Volume2,
  RefreshCw,
  ExternalLink,
  Shield,
  Zap,
  Building2,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Globe,
  Tag,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PromptEnhanceEngine } from "../../../../prompt-enhance-engine/src/engine";
import { GoogleVeoService } from "../../../../prompt-enhance-engine/src/veoService";
import { EnhancedVideoBlueprint } from "../../../../prompt-enhance-engine/src/types";

// No hardcoded key here — paste your own in the field below, or set
// VITE_GEMINI_API_KEY in apps/web/.env for a local default.
const DEFAULT_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? "";
const DEFAULT_VEO_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? "";

const PRESETS = [
  {
    label: "🚀 B2B SaaS & Tech Launch (Domain2Deals)",
    prompt: "make a video on my brand launch for our sales intelligence platform",
    brand: "Domain2Deals",
    category: "B2B Sales & Marketing Tech",
  },
  {
    label: "🏎️ Supercar / Automotive Reveal",
    prompt: "cinematic sunset commercial of a sleek black electric sports car carving through scenic mountain curves",
    brand: "Apex Motors",
    category: "Luxury Automotive & EV",
  },
  {
    label: "☕ Artisan Coffee & Cafe Mood",
    prompt: "warm morning coffee brewing with cinematic golden hour light and artisan beans in a sunlit cafe",
    brand: "Roast & Bloom",
    category: "Specialty Coffee Roasters",
  },
  {
    label: "👟 Urban Streetwear Sneaker Drop",
    prompt: "dynamic slow-motion street dance shot showcasing futuristic chunky sneakers on wet asphalt with neon city reflections",
    brand: "KicksLab Tokyo",
    category: "Streetwear & Footwear",
  },
  {
    label: "🌊 Luxury Oceanfront Resort",
    prompt: "breathtaking drone shot flying over a private infinity pool overlooking turquoise crystal ocean at sunrise",
    brand: "Solstice Villas",
    category: "Luxury Hospitality & Travel",
  },
  {
    label: "🪔 Diwali Festive Brand (Jewelry)",
    prompt: "make a video on my brand for diwali",
    brand: "Aura Luxe Jewels",
    category: "Fine Heritage & Festive Jewelry",
  },
];

export default function PromptEnhanceTest() {
  const { user } = useAuth();

  // 1. Fetch Brand Profiles from Convex & Firestore
  const convexBrands = useQuery(
    api.brands.list,
    isConvexConfigured && user ? {} : "skip"
  );
  const [legacyBrands, setLegacyBrands] = useState<BrandProfile[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");

  useEffect(() => {
    if (user?.uid) {
      getBrandProfiles(user.uid)
        .then((list) => setLegacyBrands(list || []))
        .catch(() => {});
    }
  }, [user?.uid]);

  // Combine Brand Kit sources
  const allBrands: Array<{
    id: string;
    name: string;
    industry?: string;
    audience?: string;
    toneOfVoice?: string;
    colors?: { primary: string; secondary?: string; accent?: string };
    logoUrl?: string;
    websiteUrl?: string;
    coreIdentity?: string;
    productOffering?: string;
  }> = React.useMemo(() => {
    if (convexBrands && convexBrands.length > 0) {
      return convexBrands.map((b: any) => ({
        id: b._id || b.legacyId,
        name: b.name,
        industry: b.industry || "Festive & Commercial",
        audience: b.audience || "General Commercial Audience",
        toneOfVoice: b.toneOfVoice || "Warm, Cinematic, Authentic",
        colors: b.colors,
        logoUrl: b.logoUrl,
        websiteUrl: b.websiteUrl,
        coreIdentity: b.coreIdentity,
        productOffering: b.productOffering,
      }));
    }
    if (legacyBrands && legacyBrands.length > 0) {
      return legacyBrands.map((b) => ({
        id: b.id,
        name: b.name,
        industry: b.industry || "Festive & Commercial",
        audience: b.audience || "General Commercial Audience",
        toneOfVoice: b.toneOfVoice || "Warm, Cinematic, Authentic",
        colors: b.colors,
        logoUrl: b.logoUrl,
        websiteUrl: b.websiteUrl,
        coreIdentity: b.coreIdentity,
        productOffering: b.productOffering,
      }));
    }
    return [];
  }, [convexBrands, legacyBrands]);

  // Active Brand from Brand Kit
  const activeBrand = allBrands.find((b) => b.id === selectedBrandId) || allBrands[0] || null;

  // Form State
  const [geminiKey, setGeminiKey] = useState(DEFAULT_GEMINI_KEY);
  const [veoKey, setVeoKey] = useState(DEFAULT_VEO_KEY);
  const [modelId, setModelId] = useState("gemini-2.5-pro");
  const [rawPrompt, setRawPrompt] = useState("i want to launch my brand give me a reel which explains my product");
  const [brandName, setBrandName] = useState(activeBrand?.name || "Domain2Deals");
  const [brandCategory, setBrandCategory] = useState(activeBrand?.industry || "B2B Sales Intelligence & Automated Outreach");
  const [targetAudience, setTargetAudience] = useState(activeBrand?.audience || "Founders, sales leaders, and B2B outreach teams");
  const [duration, setDuration] = useState<number>(15);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");

  // Sync with active brand whenever selected
  useEffect(() => {
    if (activeBrand) {
      setBrandName(activeBrand.name);
      if (activeBrand.industry) setBrandCategory(activeBrand.industry);
      if (activeBrand.audience) setTargetAudience(activeBrand.audience);
    }
  }, [activeBrand]);

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [stepLog, setStepLog] = useState<string[]>([]);
  
  const [blueprint, setBlueprint] = useState<EnhancedVideoBlueprint | null>(null);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [videoResultUrl, setVideoResultUrl] = useState<string | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [isGeneratingReferenceImage, setIsGeneratingReferenceImage] = useState(false);
  const [useImageToVideo, setUseImageToVideo] = useState(true);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"storyboard" | "veo-prompt" | "style" | "audio">("storyboard");

  const addLog = (msg: string) => {
    setStepLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleSyncWithBrandKit = (brand: typeof activeBrand) => {
    if (!brand) return;
    setBrandName(brand.name);
    if (brand.industry) setBrandCategory(brand.industry);
    if (brand.audience) setTargetAudience(brand.audience);
    toast.success(`Synced details from Brand Kit (${brand.name})!`);
    addLog(`Fetched brand profile: "${brand.name}" [Category: ${brand.industry || "N/A"}]`);
  };

  const runEnhancement = async (): Promise<EnhancedVideoBlueprint | null> => {
    setIsEnhancing(true);
    setStatusMessage("Enhancing prompt with Gemini AI Director...");
    addLog(`Initiating prompt enhancement with model: ${modelId}`);

    try {
      const engine = new PromptEnhanceEngine({
        provider: "google",
        apiKey: geminiKey,
        modelId,
      });

      // Construct style notes with active brand identity
      const customStyleNotes = [
        activeBrand?.toneOfVoice ? `Brand Tone: ${activeBrand.toneOfVoice}` : "",
        activeBrand?.colors?.primary ? `Brand Primary Color: ${activeBrand.colors.primary}` : "",
        activeBrand?.coreIdentity ? `Brand Identity: ${activeBrand.coreIdentity}` : "",
        activeBrand?.productOffering ? `Product Core: ${activeBrand.productOffering}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const res = await engine.enhance(
        {
          rawPrompt,
          brandName: brandName || undefined,
          brandCategory: brandCategory || undefined,
          targetAudience: targetAudience || undefined,
          aspectRatio,
          durationSeconds: duration,
          targetEngine: "google_veo",
          customStyleNotes: customStyleNotes || undefined,
        },
        {
          apiKey: geminiKey,
          modelId,
        }
      );

      setBlueprint(res);
      addLog(
        `✨ Successfully created ${res.scenes.length}-scene blueprint! [Engine: ${
          res.source === "llm_generated"
            ? `Live Gemini LLM (${res.llmModelUsed})`
            : "Domain Fallback Synthesizer"
        }]`
      );
      toast.success("Prompt successfully enhanced into cinematic blueprint!");
      return res;
    } catch (err: any) {
      addLog(`❌ Enhancement error: ${err.message}`);
      toast.error(`Enhancement failed: ${err.message}`);
      return null;
    } finally {
      setIsEnhancing(false);
    }
  };

  const runGenerateReferenceImage = async (customPrompt?: string): Promise<string | null> => {
    const promptToUse =
      customPrompt ||
      blueprint?.referenceImagePrompt ||
      `Cinematic commercial hero frame of ${brandName} product. 35mm anamorphic lens, f/1.8 shallow depth of field, natural studio lighting, 8k photorealistic quality.`;

    setIsGeneratingReferenceImage(true);
    setStatusMessage("Generating locked reference hero image (Imagen 3)...");
    addLog(`🖼️ Generating Reference Hero Image with Imagen 3...`);
    addLog(`📝 Hero Frame Prompt: "${promptToUse}"`);

    try {
      const res = await GoogleVeoService.generateReferenceImage(geminiKey, promptToUse, aspectRatio);
      if (res.success && res.imageUrl) {
        setReferenceImageUrl(res.imageUrl);
        addLog(`🎯 Visual Anchor Hero Frame generated successfully!`);
        toast.success("Locked reference hero image created!");
        return res.imageUrl;
      } else {
        addLog(`⚠️ Reference image generation failed: ${res.error}`);
        toast.error(`Reference image failed: ${res.error}`);
        return null;
      }
    } catch (err: any) {
      addLog(`❌ Reference image error: ${err.message}`);
      return null;
    } finally {
      setIsGeneratingReferenceImage(false);
      setStatusMessage("");
    }
  };

  const runVeoGeneration = async (promptToUse?: string, refImageOverride?: string | null) => {
    let finalPrompt = promptToUse;

    if (!finalPrompt) {
      if (blueprint && blueprint.scenes[selectedSceneIndex]) {
        finalPrompt = blueprint.scenes[selectedSceneIndex].targetEnginePrompt;
      } else {
        finalPrompt = rawPrompt;
      }
    }

    const refImage = refImageOverride !== undefined ? refImageOverride : (useImageToVideo ? referenceImageUrl : null);

    setIsGeneratingVideo(true);
    setStatusMessage(refImage ? "Submitting Image-Conditioned Video to Veo..." : "Submitting to Google Veo...");
    addLog(`🚀 Sending prompt to Google Veo engine (aspect ratio: ${aspectRatio}, duration: ${duration || 8}s)...`);
    if (refImage) {
      addLog(`🎯 Using Locked Reference Image as First-Frame Anchor (Image-to-Video mode).`);
    }
    addLog(`📝 Exact Prompt Sent to Veo:\n"${finalPrompt}"`);

    try {
      const result = await GoogleVeoService.generateVideo({
        apiKey: veoKey,
        prompt: finalPrompt,
        aspectRatio,
        durationSeconds: duration || 8,
        referenceImageUrl: refImage || undefined,
        onProgress: (update) => {
          setStatusMessage(update.message);
          addLog(`[Veo] ${update.message}`);
        },
      });

      if (result.success && result.videoUrl) {
        setVideoResultUrl(result.videoUrl);
        addLog(`🎉 Video generated successfully! URL: ${result.videoUrl}`);
        toast.success("Veo Video generation complete!");
      } else {
        addLog(`❌ Veo generation failed: ${result.error}`);
        if (result.diagnostics) {
          addLog(`[Diagnostics]\n${result.diagnostics}`);
        }
        toast.error(`Veo failed: ${result.error}`);
      }
    } catch (err: any) {
      addLog(`❌ Veo generation error: ${err.message}`);
      toast.error(`Veo error: ${err.message}`);
    } finally {
      setIsGeneratingVideo(false);
      setStatusMessage("");
    }
  };

  const runAllEndToEnd = async () => {
    setVideoResultUrl(null);
    setStepLog([]);
    const bp = await runEnhancement();
    if (bp && bp.scenes.length > 0) {
      // Step 2: Generate Locked Hero Reference Image Anchor
      let generatedRefImg: string | null = null;
      if (useImageToVideo) {
        generatedRefImg = await runGenerateReferenceImage(bp.referenceImagePrompt);
      }
      // Step 3: Call Veo with Scene 1 Prompt + Reference Image Anchor
      const scene1Prompt = bp.scenes[0].targetEnginePrompt;
      await runVeoGeneration(scene1Prompt, generatedRefImg);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Live Engine Workbench
              </span>
              <span className="text-xs text-zinc-500">v1.0.0</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mt-1">
              Prompt Enhancement & Google Veo Video Engine
            </h1>
            <p className="text-sm text-zinc-400">
              Transform short ambiguous prompts into multi-scene cinematic blueprints and render directly with Google Veo.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={runAllEndToEnd}
              disabled={isEnhancing || isGeneratingVideo}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/20 hover:opacity-95 active:scale-95 transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isEnhancing || isGeneratingVideo ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              <span>1-Click: Enhance & Generate Video</span>
            </button>
          </div>
        </div>

        {/* Brand Kit Auto-Fetch Card */}
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-amber-950/20 border border-amber-500/30 rounded-2xl p-5 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                {activeBrand?.logoUrl ? (
                  <img
                    src={activeBrand.logoUrl}
                    alt={activeBrand.name}
                    className="w-full h-full object-contain rounded-xl p-1"
                  />
                ) : (
                  <Building2 className="w-5 h-5" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Linked Brand Kit
                  </span>
                  {activeBrand && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
                      Auto-Populated
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <h3 className="font-bold text-white text-base">
                    {activeBrand ? activeBrand.name : "No Brand Kit Detected Yet"}
                  </h3>
                  {activeBrand?.industry && (
                    <span className="text-xs text-zinc-400 font-medium">
                      • {activeBrand.industry}
                    </span>
                  )}
                </div>

                {activeBrand && (
                  <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1 flex-wrap">
                    {activeBrand.audience && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-zinc-500" /> {activeBrand.audience}
                      </span>
                    )}
                    {activeBrand.toneOfVoice && (
                      <span className="flex items-center gap-1 text-amber-300/80">
                        <Tag className="w-3 h-3" /> {activeBrand.toneOfVoice}
                      </span>
                    )}
                    {activeBrand.colors?.primary && (
                      <div className="flex items-center gap-1">
                        <span
                          className="w-3 h-3 rounded-full border border-zinc-700 inline-block shadow-sm"
                          style={{ backgroundColor: activeBrand.colors.primary }}
                        />
                        <span className="font-mono text-[10px] text-zinc-400">
                          {activeBrand.colors.primary}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Brand Kit Controls */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {allBrands.length > 1 && (
                <div className="relative">
                  <select
                    value={activeBrand?.id || ""}
                    onChange={(e) => {
                      setSelectedBrandId(e.target.value);
                      const target = allBrands.find((b) => b.id === e.target.value);
                      if (target) handleSyncWithBrandKit(target);
                    }}
                    className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none cursor-pointer pr-8"
                  >
                    {allBrands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.industry || "General"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeBrand && (
                <button
                  type="button"
                  onClick={() => handleSyncWithBrandKit(activeBrand)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 flex items-center gap-1.5 transition cursor-pointer"
                  title="Re-fetch brand attributes from Brand Kit"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Re-Sync Details</span>
                </button>
              )}

              <Link
                to="/brand"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Manage Brand Kit</span>
              </Link>
            </div>

          </div>
        </div>

        {/* API Credentials & Config Accordion */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Configured Engine API Keys & Models</span>
            </div>
            <span className="text-xs text-zinc-500">Keys pre-loaded & ready</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Gemini Prompt Enhancement Key
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 focus:border-amber-500 focus:outline-none"
                placeholder="Gemini API Key"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Google Veo Video-Gen Key
              </label>
              <input
                type="password"
                value={veoKey}
                onChange={(e) => setVeoKey(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 focus:border-amber-500 focus:outline-none"
                placeholder="Google Veo API Key"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Enhancement Model
              </label>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:border-amber-500 focus:outline-none"
              >
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Best Cinematic & Product Logic)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast & Reliable)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Grid: Input & Output */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Input Form (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* Presets */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Quick Festive & Brand Presets
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setRawPrompt(p.prompt);
                      setBrandName(p.brand);
                      setBrandCategory(p.category);
                    }}
                    className="p-2.5 text-left rounded-xl bg-zinc-900/80 border border-zinc-800/80 hover:border-amber-500/50 hover:bg-zinc-800/50 transition text-xs group cursor-pointer"
                  >
                    <div className="font-semibold text-zinc-200 group-hover:text-amber-300 truncate">
                      {p.label}
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">{p.brand}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Input */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  User Raw Prompt
                </label>
                <textarea
                  rows={3}
                  value={rawPrompt}
                  onChange={(e) => setRawPrompt(e.target.value)}
                  placeholder="e.g. make a video on my brand for diwali"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-zinc-400">
                      Brand Name
                    </label>
                    {activeBrand && brandName === activeBrand.name && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> From Kit
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
                    placeholder="Brand Name"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-zinc-400">
                      Brand Category
                    </label>
                    {activeBrand && brandCategory === activeBrand.industry && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> From Kit
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={brandCategory}
                    onChange={(e) => setBrandCategory(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
                    placeholder="e.g. Luxury Jewelry"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Target Audience
                </label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
                  placeholder="e.g. Modern couples and families"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Aspect Ratio
                  </label>
                  <div className="flex gap-2">
                    {(["9:16", "16:9"] as const).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition ${
                          aspectRatio === ratio
                            ? "bg-amber-500/20 border-amber-500 text-amber-300"
                            : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {ratio === "9:16" ? "9:16 Reel" : "16:9 Landscape"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Total Duration
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
                  >
                    <option value={8}>8 Seconds (1 Hero Shot - Veo Standard)</option>
                    <option value={4}>4 Seconds (Quick Clip)</option>
                    <option value={6}>6 Seconds (Medium Shot)</option>
                    <option value={15}>15 Seconds (Multi-Scene Storyboard)</option>
                  </select>
                </div>
              </div>

              {/* Image-to-Video Anchor Toggle */}
              <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="i2v-toggle"
                      checked={useImageToVideo}
                      onChange={(e) => setUseImageToVideo(e.target.checked)}
                      className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500/20 bg-zinc-900 cursor-pointer"
                    />
                    <label htmlFor="i2v-toggle" className="text-xs font-semibold text-zinc-200 cursor-pointer flex items-center gap-1.5">
                      <span>🎯 1st-Frame Visual Anchor (Imagen 3)</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">I2V Mode</span>
                    </label>
                  </div>
                  {blueprint && (
                    <button
                      onClick={() => runGenerateReferenceImage()}
                      disabled={isGeneratingReferenceImage || isGeneratingVideo}
                      className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition cursor-pointer disabled:opacity-50"
                    >
                      {isGeneratingReferenceImage ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      <span>{referenceImageUrl ? "Regenerate Anchor" : "Generate Anchor"}</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 leading-normal">
                  Locks hero product, lighting, and brand colors into a single image first, preventing random visual jitter across scenes.
                </p>

                {referenceImageUrl && (
                  <div className="mt-2 pt-2 border-t border-zinc-800/80 flex items-center gap-3">
                    <img
                      src={referenceImageUrl}
                      alt="Hero Reference Anchor"
                      className="w-14 h-14 object-cover rounded-lg border border-amber-500/40 shadow-sm"
                    />
                    <div className="text-[11px] space-y-0.5">
                      <div className="font-semibold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Visual Anchor Active
                      </div>
                      <div className="text-zinc-400 text-[10px]">
                        Conditioning Veo with this hero frame.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  onClick={runAllEndToEnd}
                  disabled={isEnhancing || isGeneratingVideo}
                  className="w-full py-3.5 rounded-xl font-bold text-xs md:text-sm bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/25 hover:brightness-110 active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isEnhancing || isGeneratingVideo ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{isEnhancing ? "Writing Script & Blueprint..." : "Rendering Video in Veo..."}</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      <span>⚡ 1-Click: AI Script & Veo Video Generation</span>
                    </>
                  )}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => runEnhancement()}
                    disabled={isEnhancing || isGeneratingVideo}
                    className="py-2.5 px-3 rounded-xl font-semibold text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 truncate"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">Enhance Script Only</span>
                  </button>

                  <button
                    onClick={() => runVeoGeneration()}
                    disabled={isEnhancing || isGeneratingVideo}
                    className="py-2.5 px-3 rounded-xl font-semibold text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 truncate"
                  >
                    <Video className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">Generate in Veo</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Live Progress Logs */}
            {stepLog.length > 0 && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-amber-400" /> Engine Execution Log
                  </span>
                  {(isEnhancing || isGeneratingVideo) && (
                    <span className="text-amber-400 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> {statusMessage || "Processing..."}
                    </span>
                  )}
                </div>
                <div className="max-h-44 overflow-y-auto bg-zinc-950 rounded-lg p-2.5 font-mono text-[11px] text-zinc-400 space-y-1">
                  {stepLog.map((log, i) => (
                    <div key={i} className="leading-relaxed">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Output Blueprint & Video Preview (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Generated Video Player Section */}
            {videoResultUrl ? (
              <div className="bg-zinc-900/90 border border-emerald-500/40 rounded-2xl p-5 space-y-3 shadow-xl shadow-emerald-950/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                      <Film className="w-4 h-4" /> Google Veo Video Rendered Successfully
                    </h3>
                  </div>
                  <a
                    href={videoResultUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    <span>Open in new tab</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative rounded-xl overflow-hidden bg-black flex items-center justify-center max-h-96">
                  <video
                    src={videoResultUrl}
                    controls
                    autoPlay
                    loop
                    className={`rounded-xl ${aspectRatio === "9:16" ? "max-h-96 aspect-[9/16]" : "w-full aspect-video"}`}
                  />
                </div>
              </div>
            ) : isGeneratingVideo ? (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 animate-pulse">
                  <Video className="w-6 h-6 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-zinc-200">Google Veo is Rendering Video...</h4>
                  <p className="text-xs text-zinc-500 max-w-sm">
                    {statusMessage || "Synthesizing high-fidelity lighting, motion physics, and cinematic color grade..."}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Blueprint Tabs */}
            {blueprint ? (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
                
                {/* Blueprint Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-zinc-800 pb-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400">
                      {blueprint.brandAnalysis.inferredCategory}
                    </span>
                    <h2 className="text-lg font-bold text-white">{blueprint.title}</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">{blueprint.logline}</p>
                  </div>

                  <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                    {(
                      [
                        { id: "storyboard", label: "Storyboard", icon: Layers },
                        { id: "veo-prompt", label: "Veo Prompts", icon: Video },
                        { id: "style", label: "Visual Style", icon: Palette },
                        { id: "audio", label: "Audio/Voice", icon: Volume2 },
                      ] as const
                    ).map((t) => {
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setActiveTab(t.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                            activeTab === t.id
                              ? "bg-zinc-800 text-white font-semibold shadow"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tab 1: Storyboard */}
                {activeTab === "storyboard" && (
                  <div className="space-y-4">
                    {/* Master Voiceover & Hook Banner */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-zinc-900 to-zinc-900 border border-amber-500/30 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-4 h-4 text-amber-400" />
                          <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                            🎙️ Master Commercial Script & Voiceover ({blueprint.audioBlueprint.bpmAndPacing || "High-Impact"})
                          </h4>
                        </div>
                        <button
                          onClick={() => {
                            const fullScript = blueprint.audioBlueprint.voiceoverScript
                              .map((v) => `[${v.timestamp}] ${v.spokenText}`)
                              .join("\n");
                            handleCopy(fullScript, "full-script");
                          }}
                          className="text-[11px] text-zinc-400 hover:text-amber-300 flex items-center gap-1 font-medium transition cursor-pointer"
                        >
                          {copiedText === "full-script" ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Full Script</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        {blueprint.audioBlueprint.voiceoverScript.map((v, i) => (
                          <div key={i} className="flex items-start gap-2.5 text-xs">
                            <span className="font-mono text-[10px] text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 shrink-0 mt-0.5">
                              {v.timestamp}
                            </span>
                            <div className="leading-relaxed">
                              <span className="text-zinc-100 font-medium">"{v.spokenText}"</span>
                              {v.deliveryTone && (
                                <span className="text-[10px] text-amber-400/80 italic ml-2">
                                  ({v.deliveryTone})
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>Shot-by-Shot Scene Breakdown ({blueprint.scenes.length} Scenes)</span>
                      <span>Click a scene to target it for generation</span>
                    </div>

                    <div className="space-y-3">
                      {blueprint.scenes.map((scene, idx) => (
                        <div
                          key={scene.sceneNumber}
                          onClick={() => setSelectedSceneIndex(idx)}
                          className={`p-4 rounded-xl border transition cursor-pointer ${
                            selectedSceneIndex === idx
                              ? "bg-zinc-800/80 border-amber-500/80 shadow-md shadow-amber-500/5"
                              : "bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-zinc-800 text-[11px] font-bold text-zinc-300">
                                Scene {scene.sceneNumber}
                              </span>
                              <span className="text-xs text-zinc-400 font-mono">
                                {scene.timestampRange}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                {scene.shotType.replace(/_/g, " ")}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                {scene.cameraMovement.replace(/_/g, " ")}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-zinc-200 font-medium mb-2 leading-relaxed">
                            {scene.subjectDescription}
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-zinc-400 bg-zinc-900/50 p-2.5 rounded-lg">
                            <div>
                              <span className="text-zinc-500">Lighting:</span> {scene.lightingAndAtmosphere}
                            </div>
                            <div>
                              <span className="text-zinc-500">Physics:</span> {scene.motionAndPhysics}
                            </div>
                            {scene.voiceoverLine && (
                              <div className="md:col-span-2 text-amber-200/90 italic">
                                <span className="text-zinc-500 not-italic">Voiceover:</span> "{scene.voiceoverLine}"
                              </div>
                            )}
                            {scene.onScreenText && (
                              <div className="md:col-span-2 text-emerald-300/90 font-medium">
                                <span className="text-zinc-500">On-Screen Kinetic Text:</span> "{scene.onScreenText}"
                              </div>
                            )}
                          </div>

                          <div className="mt-3 flex items-center justify-between pt-2 border-t border-zinc-800/60">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                runVeoGeneration(scene.targetEnginePrompt);
                              }}
                              disabled={isGeneratingVideo}
                              className="px-3 py-1 text-[11px] font-semibold rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-current" /> Generate Video for Scene {scene.sceneNumber}
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(scene.targetEnginePrompt, `scene-${idx}`);
                              }}
                              className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              {copiedText === `scene-${idx}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>Copy Veo Prompt</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 2: Veo Prompt */}
                {activeTab === "veo-prompt" && (
                  <div className="space-y-4">
                    <div className="text-xs text-zinc-400">
                      Optimized prompts formatted specifically for Google Veo 2 / 3.1:
                    </div>

                    {blueprint.scenes.map((scene, idx) => (
                      <div key={idx} className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-400">
                            Scene {scene.sceneNumber} ({scene.timestampRange}) Prompt
                          </span>
                          <button
                            onClick={() => handleCopy(scene.targetEnginePrompt, `veo-p-${idx}`)}
                            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 flex items-center gap-1"
                          >
                            {copiedText === `veo-p-${idx}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>Copy Prompt</span>
                          </button>
                        </div>
                        <p className="text-xs font-mono text-zinc-300 leading-relaxed bg-zinc-900 p-3 rounded-lg border border-zinc-800/80">
                          {scene.targetEnginePrompt}
                        </p>
                        {scene.negativePrompt && (
                          <p className="text-[11px] text-zinc-500">
                            <span className="text-rose-400/80 font-semibold">Negative Prompt:</span> {scene.negativePrompt}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 3: Style Guide */}
                {activeTab === "style" && (
                  <div className="space-y-4 text-xs">
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3">
                      <div>
                        <span className="text-zinc-500 font-medium">Art Direction:</span>
                        <p className="text-zinc-200 mt-0.5">{blueprint.visualStyleGuide.artDirection}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500 font-medium">Lighting Mood:</span>
                        <p className="text-zinc-200 mt-0.5">{blueprint.visualStyleGuide.lightingMood}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500 font-medium">Lens & Optics:</span>
                        <p className="text-zinc-200 mt-0.5">{blueprint.visualStyleGuide.lensAndOptics}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500 font-medium">Color Palette:</span>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {blueprint.visualStyleGuide.colorPalette.map((c, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono text-[11px]"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 4: Audio & Voiceover */}
                {activeTab === "audio" && (
                  <div className="space-y-4 text-xs">
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3">
                      <div>
                        <span className="text-zinc-500 font-medium">Soundscape & Music Score:</span>
                        <p className="text-zinc-200 mt-0.5">{blueprint.audioBlueprint.musicDescription}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500 font-medium">Tempo & BPM:</span>
                        <p className="text-zinc-200 mt-0.5">{blueprint.audioBlueprint.bpmAndPacing}</p>
                      </div>

                      <div className="pt-2 border-t border-zinc-800">
                        <span className="text-zinc-500 font-medium">Voiceover Script Beats:</span>
                        <div className="space-y-2 mt-2">
                          {blueprint.audioBlueprint.voiceoverScript.map((v, i) => (
                            <div key={i} className="bg-zinc-900 p-2.5 rounded-lg flex items-start gap-3">
                              <span className="text-zinc-500 font-mono text-[11px] shrink-0 mt-0.5">
                                {v.timestamp}
                              </span>
                              <div>
                                <p className="text-zinc-100 font-medium">"{v.spokenText}"</p>
                                <span className="text-[10px] text-amber-400/80 italic">
                                  Tone: {v.deliveryTone}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-zinc-400">
                  <Sparkles className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="font-bold text-zinc-200">No Prompt Enhanced Yet</h3>
                <p className="text-xs text-zinc-500 max-w-sm">
                  Click <strong>"1-Click: Enhance & Generate Video"</strong> or <strong>"Step 1: Enhance Prompt Blueprint"</strong> to see the AI Cinematographer in action.
                </p>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
