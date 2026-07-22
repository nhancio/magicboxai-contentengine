import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@shared/lib/auth";
import type { BrandProfile } from "@shared/types";
import {
  getBrandProfiles,
  saveBrandProfile,
  deleteBrandProfile,
} from "@shared/lib/automations";
import {
  extractBrandFromWebsite,
  type BrandExtractResult,
} from "@shared/lib/suite";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { cn } from "@shared/lib/utils";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Globe2,
  Loader2,
  Sparkles,
  Trash2,
  Type,
} from "lucide-react";

type Phase = "idle" | "scanning" | "ready" | "saving";

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

function Swatch({ hex, label }: { hex?: string; label: string }) {
  if (!hex) return null;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="h-14 w-14 rounded-xl border border-border shadow-inner"
        style={{ background: hex }}
        title={hex}
      />
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-[11px] text-foreground/80">{hex}</span>
    </div>
  );
}

export default function BrandKit() {
  const { user } = useAuth();
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [scanStep, setScanStep] = useState(0);
  const [extracted, setExtracted] = useState<BrandExtractResult | null>(null);
  const [extractedUrl, setExtractedUrl] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = async () => {
    if (!user) return;
    const list = await getBrandProfiles(user.uid);
    setBrands(list);
    setLoading(false);
    if (!selectedId && list[0]) setSelectedId(list[0].id);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (phase !== "scanning") return;
    setScanStep(0);
    const id = window.setInterval(() => {
      setScanStep((s) => (s < SCAN_STEPS.length - 1 ? s + 1 : s));
    }, 1400);
    return () => window.clearInterval(id);
  }, [phase]);

  const selected = brands.find((b) => b.id === selectedId) ?? null;

  const handleScan = async () => {
    const normalized = normalizeInputUrl(url);
    if (!normalized) {
      toast.error("Enter a website URL first.");
      return;
    }
    setPhase("scanning");
    setExtracted(null);
    try {
      const result = await extractBrandFromWebsite({ url: normalized });
      if (!result.companyName && !result.logoUrl && !result.colors?.primary) {
        toast.error("Couldn't pull much from that page — try the homepage URL.");
        setPhase("idle");
        return;
      }
      setExtracted(result);
      setExtractedUrl(normalized);
      setPhase("ready");
      toast.success("Brand kit fetched — review and save.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't read that site.");
      setPhase("idle");
    }
  };

  const handleSave = async () => {
    if (!user || !extracted) return;
    setPhase("saving");
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
      setSelectedId(id);
      setExtracted(null);
      setUrl("");
      setPhase("idle");
      await refresh();
      toast.success("Brand kit saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save brand kit");
      setPhase("ready");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this brand kit? Automations using it fall back to a neutral voice.")) {
      return;
    }
    await deleteBrandProfile(id);
    if (selectedId === id) setSelectedId(null);
    await refresh();
    toast.success("Brand kit deleted");
  };

  const busy = phase === "scanning" || phase === "saving";

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <span className="eyebrow">Brand Kit</span>
        <h1 className="mt-2 font-display text-3xl tracking-tight">Fetch your brand</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Paste a website URL. MagicBox fetches the logo, palette, fonts, and voice — then saves a
          kit Maya and Studio can use.
        </p>
      </header>

      {/* URL scanner */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-border bg-card">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 20% 0%, color-mix(in oklab, var(--brand) 28%, transparent), transparent 55%), radial-gradient(ellipse at 90% 100%, color-mix(in oklab, var(--brand) 12%, transparent), transparent 40%)",
          }}
        />
        <div className="relative space-y-4 p-6 sm:p-8">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground">
            <Globe2 className="h-3.5 w-3.5 text-brand" />
            Website → brand kit
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="relative flex-1">
              <Globe2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !busy) void handleScan();
                }}
                placeholder="yourbrand.com"
                disabled={busy}
                className="h-12 border-border bg-background/80 pl-10 font-mono text-sm"
              />
            </div>
            <Button
              size="lg"
              className="h-12 shrink-0 gap-2 px-6"
              onClick={handleScan}
              disabled={busy || !url.trim()}
            >
              {phase === "scanning" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Fetching…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Fetch brand
                </>
              )}
            </Button>
          </div>

          <AnimatePresence mode="wait">
            {phase === "scanning" && (
              <motion.div
                key="scan"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-border/80 bg-background/70 px-4 py-3"
              >
                <ul className="space-y-2">
                  {SCAN_STEPS.map((label, i) => {
                    const done = i < scanStep;
                    const active = i === scanStep;
                    return (
                      <li key={label} className="flex items-center gap-2.5 text-sm">
                        {done ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : active ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                        ) : (
                          <span className="h-3.5 w-3.5 rounded-full border border-border" />
                        )}
                        <span
                          className={cn(
                            active ? "text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/50",
                          )}
                        >
                          {label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Extraction preview */}
      <AnimatePresence>
        {extracted && phase !== "idle" && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-8 overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div className="flex flex-col gap-6 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-border bg-secondary">
                  {extracted.logoUrl ? (
                    <img
                      src={extracted.logoUrl}
                      alt=""
                      className="h-full w-full object-contain p-1.5"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Sparkles className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h2 className="font-display text-2xl leading-tight">
                    {extracted.companyName || "Untitled brand"}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {extracted.industry || "Industry detected from site"}
                  </p>
                  <a
                    href={extractedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-brand hover:underline"
                  >
                    {extractedUrl.replace(/^https?:\/\//, "")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setExtracted(null); setPhase("idle"); }}>
                  Discard
                </Button>
                <Button onClick={handleSave} disabled={phase === "saving"} className="gap-2">
                  {phase === "saving" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  Save brand kit
                </Button>
              </div>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_1.2fr]">
              <div>
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Palette
                </p>
                <div className="flex flex-wrap gap-4">
                  <Swatch hex={extracted.colors.primary} label="Primary" />
                  <Swatch hex={extracted.colors.secondary} label="Secondary" />
                  <Swatch hex={extracted.colors.accent} label="Accent" />
                  {!extracted.colors.primary && (
                    <p className="text-sm text-muted-foreground">No strong palette found.</p>
                  )}
                </div>
                {extracted.fonts?.length > 0 && (
                  <div className="mt-6">
                    <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      <Type className="h-3 w-3" /> Fonts
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {extracted.fonts.slice(0, 4).map((f) => (
                        <span
                          key={f}
                          className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground/80"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Audience
                  </p>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {extracted.audience || "—"}
                  </p>
                </div>
                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Tone of voice
                  </p>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {extracted.tone || "—"}
                  </p>
                </div>
                {extracted.hashtags?.length > 0 && (
                  <div>
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Hashtags
                    </p>
                    <p className="font-mono text-xs text-brand">
                      {extracted.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
                    </p>
                  </div>
                )}
                {extracted.sampleCaptions?.length > 0 && (
                  <div>
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Sample captions
                    </p>
                    <ul className="space-y-2">
                      {extracted.sampleCaptions.map((c) => (
                        <li
                          key={c}
                          className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm italic text-muted-foreground"
                        >
                          “{c}”
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Saved kits */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl">Saved kits</h2>
          <span className="font-mono text-[11px] text-muted-foreground">
            {loading ? "…" : `${brands.length} saved`}
          </span>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        ) : brands.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
            <Sparkles className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
            <p className="font-display text-lg">No kits yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Fetch one from a website above — no manual fields required.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {brands.map((brand) => {
              const active = selectedId === brand.id;
              return (
                <button
                  key={brand.id}
                  type="button"
                  onClick={() => setSelectedId(brand.id)}
                  className={cn(
                    "group relative rounded-2xl border p-4 text-left transition-colors",
                    active
                      ? "border-brand/40 bg-brand/5"
                      : "border-border bg-card hover:bg-accent/40",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary">
                      {brand.logoUrl ? (
                        <img
                          src={brand.logoUrl}
                          alt=""
                          className="h-full w-full object-contain p-1"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span
                          className="h-5 w-5 rounded-full"
                          style={{ background: brand.colors?.primary ?? "#888" }}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{brand.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {brand.industry || brand.websiteUrl || "Brand kit"}
                      </p>
                      <div className="mt-2 flex gap-1.5">
                        {[brand.colors?.primary, brand.colors?.secondary, brand.colors?.accent]
                          .filter(Boolean)
                          .map((hex) => (
                            <span
                              key={hex}
                              className="h-3 w-3 rounded-full border border-border"
                              style={{ background: hex }}
                            />
                          ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete ${brand.name}`}
                      className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-red-600 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(brand.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selected && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-display text-lg">{selected.name}</h3>
              {selected.websiteUrl && (
                <a
                  href={selected.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-brand hover:underline"
                >
                  {selected.websiteUrl.replace(/^https?:\/\//, "")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/50">
                  Audience
                </span>
                <br />
                {selected.audience || "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/50">
                  Tone
                </span>
                <br />
                {selected.toneOfVoice || "—"}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
