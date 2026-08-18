import React, { useState, useEffect } from "react";
import { useAuth } from "@shared/lib/auth";
import { toast } from "sonner";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { isConvexConfigured } from "../lib/convex";
import { Button } from "@shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Label } from "@shared/components/ui/label";
import { Input } from "@shared/components/ui/input";
import { Badge } from "@shared/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shared/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/components/ui/tabs";
import { cn } from "@shared/lib/utils";
import { Link, useSearchParams } from "react-router-dom";
import { captureEvent } from "@shared/lib/analytics";
import {
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
  MessageCircle,
  Link2,
  Check,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  Zap,
  Info,
  Clock,
  Layers,
  ShoppingBag,
  List,
  MousePointerClick,
  FileText,
  AlertCircle,
  RefreshCw,
  Sliders,
  Send,
  Building2,
  Lock,
  ArrowRight,
  Globe,
  Radio,
} from "lucide-react";

/** Platform icons & brand colors */
const PLATFORM_ICON: Record<string, any> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  youtube: Youtube,
  whatsapp: MessageCircle,
};

const PLATFORM_BRAND: Record<string, string> = {
  instagram: "linear-gradient(45deg,#F58529,#DD2A7B,#8134AF,#515BD4)",
  youtube: "#FF0000",
  linkedin: "#0A66C2",
  facebook: "#1877F2",
  whatsapp: "#25D366",
};

/** Feature flag check: VITE_WHATSAPP_V2_ENABLED or localStorage toggle */
export function isWhatsAppV2Active(): boolean {
  if (typeof window === "undefined") return true;
  const envVal = import.meta.env.VITE_WHATSAPP_V2_ENABLED;
  if (envVal === "false" || envVal === "0") return false;
  const localVal = localStorage.getItem("magicbox_whatsapp_v2");
  if (localVal === "false") return false;
  return true;
}

export function GoogleConnectorTile({ email }: { email?: string | null }) {
  return (
    <div
      className="relative flex flex-col items-center justify-between rounded-xl border border-border bg-card p-3 shadow-sm"
      title="Google workspace login"
    >
      <div className="relative mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-secondary"
          title="Connected"
        />
      </div>
      <span className="w-full truncate text-[11px] font-medium text-foreground text-center">Google</span>
    </div>
  );
}

/**
 * WhatsApp V2 Modal: Onboarding, Sandbox, Meta Cloud API Test Number & Capabilities
 */
export function WhatsAppV2Modal({
  open,
  onOpenChange,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}) {
  const { user } = useAuth();
  const connectUrl = useAction(api.social.connectUrl);
  const connectTest = useMutation(api.social.connectWhatsAppTestAccount as any);

  const [activeTab, setActiveTab] = useState<"sandbox" | "metatest" | "embedded" | "capabilities">("sandbox");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Meta Developer Sandbox inputs
  const [phoneNumberId, setPhoneNumberId] = useState("104829104928102");
  const [wabaId, setWabaId] = useState("108492019482019");
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState("+1 555 019 9901");
  const [verifiedName, setVerifiedName] = useState("MagicBox Dev Test Number");
  const [accessToken, setAccessToken] = useState("");

  // Capabilities Explorer state
  const [interactiveType, setInteractiveType] = useState<"quick_reply" | "cta" | "list" | "catalog" | "flow" | "template">("quick_reply");

  // 1-Click Instant Virtual Sandbox
  const handleConnectVirtualSandbox = async () => {
    setIsSubmitting(true);
    try {
      await connectTest({
        mode: "sandbox",
        phoneNumberId: `sandbox_pn_${Date.now()}`,
        wabaId: `sandbox_waba_${Date.now()}`,
        displayPhoneNumber: "+1 555 019 9900",
        verifiedName: "MagicBox AI Sandbox (Virtual)",
        accessToken: `sandbox_token_${Date.now()}`,
      });
      toast.success("Connected WhatsApp Virtual Sandbox! Ready for instant test broadcasts.");
      onOpenChange(false);
      onConnected?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to connect virtual sandbox");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Meta Developer Sandbox Connection
  const handleConnectMetaTestNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumberId.trim()) {
      toast.error("Please enter your Meta Phone Number ID");
      return;
    }
    setIsSubmitting(true);
    try {
      await connectTest({
        mode: "meta_test",
        phoneNumberId: phoneNumberId.trim(),
        wabaId: wabaId.trim() || undefined,
        displayPhoneNumber: displayPhoneNumber.trim() || "+1 555 019 9901",
        verifiedName: verifiedName.trim() || "Meta Cloud API Test Number",
        accessToken: accessToken.trim() || undefined,
      });
      toast.success("Meta Test Number connected successfully!");
      onOpenChange(false);
      onConnected?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to connect Meta Test Number");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Meta OAuth / Embedded Signup
  const handleMetaOAuthConnect = async () => {
    setIsSubmitting(true);
    try {
      const { url } = await connectUrl({
        provider: "whatsapp",
        returnTo: "/settings?tab=integrations",
        returnOrigin: window.location.origin,
        loginHint: user?.email ?? undefined,
      });
      captureEvent("social_channel_connect_started", { provider: "whatsapp", method: "oauth" });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message || "Could not launch Meta Facebook Login");
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border border-border/80 bg-card text-foreground shadow-2xl">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-card/95 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#25D366]">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-bold">WhatsApp Business Connection</DialogTitle>
                <Badge className="bg-[#25D366]/20 text-[#25D366] border-[#25D366]/30 text-[10px] font-mono">
                  Cloud API V2
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Connect a live WABA number, Meta test number, or 1-click virtual sandbox.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-muted/60 p-1 mb-6">
              <TabsTrigger value="sandbox" className="text-xs flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                Virtual Sandbox
              </TabsTrigger>
              <TabsTrigger value="metatest" className="text-xs flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
                Meta Test Number
              </TabsTrigger>
              <TabsTrigger value="embedded" className="text-xs flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-blue-400" />
                Real WABA (OAuth)
              </TabsTrigger>
              <TabsTrigger value="capabilities" className="text-xs flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-purple-400" />
                API Capabilities
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: 1-Click Virtual Sandbox */}
            <TabsContent value="sandbox" className="space-y-4 animate-in fade-in-50">
              <div className="rounded-xl border border-brand/20 bg-brand/[0.04] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-brand font-semibold">
                    <Zap className="h-5 w-5 text-amber-400 fill-amber-400/20" />
                    Instant WhatsApp Automation Sandbox
                  </div>
                  <Badge variant="outline" className="text-[11px] border-amber-500/30 text-amber-400 bg-amber-500/10">
                    Zero Setup · Instant
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Start designing, previewing, and testing WhatsApp automations, interactive buttons, list messages, and marketing templates immediately without needing a Meta Developer App or buying a new phone number.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="rounded-lg bg-card/80 p-3 border border-border text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-mono">Sandbox Number</p>
                    <p className="text-xs font-semibold text-foreground mt-0.5">+1 555 019 9900</p>
                  </div>
                  <div className="rounded-lg bg-card/80 p-3 border border-border text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-mono">Simulated Delivery</p>
                    <p className="text-xs font-semibold text-emerald-400 mt-0.5">Instant 100% Mock Ack</p>
                  </div>
                  <div className="rounded-lg bg-card/80 p-3 border border-border text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-mono">Supported Formats</p>
                    <p className="text-xs font-semibold text-foreground mt-0.5">Text, Media, Interactive</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConnectVirtualSandbox}
                  disabled={isSubmitting}
                  className="bg-[#25D366] hover:bg-[#20ba59] text-zinc-950 font-semibold"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting Sandbox...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4 fill-zinc-950" />
                      Connect Virtual Sandbox (1-Click)
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* TAB 2: Meta Cloud API Test Number */}
            <TabsContent value="metatest" className="space-y-4 animate-in fade-in-50">
              <form onSubmit={handleConnectMetaTestNumber} className="space-y-4">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 text-xs text-muted-foreground space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                    <Info className="h-4 w-4" />
                    How to get your Meta Cloud API Test Number (Free):
                  </div>
                  <p>
                    1. Go to{" "}
                    <a
                      href="https://developers.facebook.com/apps/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground underline inline-flex items-center gap-0.5"
                    >
                      Meta Developer Console <ExternalLink className="h-3 w-3 inline" />
                    </a>{" "}
                    → select your App → <strong>WhatsApp</strong> → <strong>API Setup</strong>.
                  </p>
                  <p>2. Copy your <strong>Phone Number ID</strong> and <strong>WhatsApp Business Account ID</strong>.</p>
                  <p>3. Add your personal phone number under <em>&quot;To&quot;</em> recipient list to receive real test messages on your device.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Meta Phone Number ID *</Label>
                    <Input
                      placeholder="e.g. 104829104928102"
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                      required
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">WhatsApp Business Account ID (WABA)</Label>
                    <Input
                      placeholder="e.g. 108492019482019"
                      value={wabaId}
                      onChange={(e) => setWabaId(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Display Phone Number</Label>
                    <Input
                      placeholder="+1 555 019 9901"
                      value={displayPhoneNumber}
                      onChange={(e) => setDisplayPhoneNumber(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Verified Name / Label</Label>
                    <Input
                      placeholder="MagicBox Dev Sandbox"
                      value={verifiedName}
                      onChange={(e) => setVerifiedName(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium">
                      User / System User Access Token <span className="text-muted-foreground">(Optional for live test send)</span>
                    </Label>
                    <Input
                      type="password"
                      placeholder="EAAG... (Temporary or Permanent System User Token)"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-[#25D366] hover:bg-[#20ba59] text-zinc-950 font-semibold"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Connect Meta Test Number
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* TAB 3: Production Real WABA (OAuth & Embedded Signup) */}
            <TabsContent value="embedded" className="space-y-4 animate-in fade-in-50">
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-5 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-blue-400">
                  <Building2 className="h-5 w-5" />
                  Meta Embedded Signup &amp; Official WABA Onboarding
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Connect your real, physical business phone number to Meta WhatsApp Cloud API via Facebook Login OAuth.
                </p>

                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-mono shrink-0">1</div>
                    <p><strong>Clean Phone Number Requirement:</strong> The phone number must NOT be currently registered on the WhatsApp consumer or WhatsApp Business mobile app (delete the account in app settings first to migrate to Cloud API).</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-mono shrink-0">2</div>
                    <p><strong>SMS / Voice OTP:</strong> Meta will send a 6-digit OTP code to verify number ownership during the popup dialog.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-mono shrink-0">3</div>
                    <p><strong>Meta Business Verification:</strong> Unverified businesses start in a Tier 1 trial (250-1,000 unique conversations/24h). Completing Business Verification unlocks Tier 2 (10,000/day) and beyond.</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleMetaOAuthConnect}
                  disabled={isSubmitting}
                  className="bg-[#1877F2] hover:bg-[#166fe5] text-white font-semibold"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opening Meta OAuth...
                    </>
                  ) : (
                    <>
                      <Facebook className="mr-2 h-4 w-4 fill-white" />
                      Login with Facebook (WhatsApp Scopes)
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* TAB 4: API Capabilities & Automation Deep-Dive */}
            <TabsContent value="capabilities" className="space-y-5 animate-in fade-in-50">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left side selector */}
                <div className="lg:col-span-5 space-y-2">
                  <p className="text-[11px] font-mono uppercase text-muted-foreground tracking-wider mb-2">
                    Select Interactive API Capability
                  </p>
                  {[
                    { id: "quick_reply", label: "Quick Reply Buttons", sub: "Up to 3 fast action chips", icon: MousePointerClick },
                    { id: "cta", label: "Call-To-Action (CTA)", sub: "Website URL & phone call", icon: ExternalLink },
                    { id: "list", label: "Interactive List Menu", sub: "Up to 10 structured items", icon: List },
                    { id: "catalog", label: "Product Catalog Carousel", sub: "Single & Multi-product cards", icon: ShoppingBag },
                    { id: "flow", label: "WhatsApp Flows", sub: "Native in-chat forms & surveys", icon: Layers },
                    { id: "template", label: "Media Broadcast Template", sub: "Approved A2P {{1}} {{2}} marketing", icon: FileText },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = interactiveType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setInteractiveType(item.id as any)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                          isSelected
                            ? "border-[#25D366] bg-[#25D366]/10 text-foreground"
                            : "border-border bg-card hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <div className={cn("p-2 rounded-lg", isSelected ? "bg-[#25D366]/20 text-[#25D366]" : "bg-muted text-muted-foreground")}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground">{item.label}</p>
                          <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Right side live simulation bubble */}
                <div className="lg:col-span-7 rounded-2xl border border-border bg-zinc-950 p-4 relative overflow-hidden flex flex-col justify-between shadow-inner">
                  {/* WhatsApp chat header mockup */}
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <Avatar className="h-9 w-9 border border-emerald-500/40">
                          <AvatarImage src="/magicbox.jpeg" />
                          <AvatarFallback className="bg-emerald-600 text-[10px] text-white">MB</AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 flex items-center justify-center text-[8px] text-black font-bold">
                          ✓
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-white">MagicBox Official</span>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 fill-emerald-400/20" />
                        </div>
                        <span className="text-[10px] text-zinc-400">Official Business Account (OBA)</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-300">
                      24h Active
                    </Badge>
                  </div>

                  {/* Chat bubble body */}
                  <div className="space-y-3 my-auto py-2">
                    <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-zinc-900 border border-zinc-800 p-3.5 text-zinc-100 text-xs shadow-md space-y-2">
                      {interactiveType === "quick_reply" && (
                        <>
                          <p>Welcome to MagicBox AI! How can our automated assistant help you grow your brand today?</p>
                          <div className="pt-2 flex flex-col gap-1.5">
                            <div className="rounded-lg bg-zinc-800/90 py-1.5 px-3 text-center text-[11px] font-medium text-emerald-400 hover:bg-zinc-800 border border-zinc-700/60 cursor-pointer">
                              🛒 Browse Video Templates
                            </div>
                            <div className="rounded-lg bg-zinc-800/90 py-1.5 px-3 text-center text-[11px] font-medium text-emerald-400 hover:bg-zinc-800 border border-zinc-700/60 cursor-pointer">
                              ⚡ Schedule AI Automation
                            </div>
                            <div className="rounded-lg bg-zinc-800/90 py-1.5 px-3 text-center text-[11px] font-medium text-emerald-400 hover:bg-zinc-800 border border-zinc-700/60 cursor-pointer">
                              💬 Chat with Support
                            </div>
                          </div>
                        </>
                      )}

                      {interactiveType === "cta" && (
                        <>
                          <div className="h-28 w-full rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 font-mono text-[10px] border border-zinc-700/50">
                            [Image: Summer Campaign Reel 4K]
                          </div>
                          <p className="font-semibold text-white">Flash Sale: 50% Off MagicBox Pro!</p>
                          <p className="text-zinc-300 text-[11px]">Unlock photorealistic avatars, multi-channel auto-publishing, and Maya approval copilot.</p>
                          <div className="pt-2 border-t border-zinc-800/80 flex flex-col gap-1.5">
                            <div className="rounded-lg bg-zinc-800 py-1.5 px-3 text-center text-[11px] font-medium text-blue-400 flex items-center justify-center gap-1.5">
                              <ExternalLink className="h-3 w-3" /> Visit Website
                            </div>
                            <div className="rounded-lg bg-zinc-800 py-1.5 px-3 text-center text-[11px] font-medium text-blue-400 flex items-center justify-center gap-1.5">
                              <Smartphone className="h-3 w-3" /> Call Sales Advisor
                            </div>
                          </div>
                        </>
                      )}

                      {interactiveType === "list" && (
                        <>
                          <p className="font-semibold text-white">Select a Service Category</p>
                          <p className="text-[11px] text-zinc-300">Tap below to view our full menu of automated marketing options (up to 10 choices).</p>
                          <div className="pt-2">
                            <div className="rounded-lg bg-emerald-600/20 text-emerald-400 py-2 px-3 text-center text-xs font-semibold border border-emerald-500/30 flex items-center justify-center gap-2 cursor-pointer">
                              <List className="h-4 w-4" /> View Options Menu (10 items)
                            </div>
                          </div>
                        </>
                      )}

                      {interactiveType === "catalog" && (
                        <>
                          <p className="font-semibold text-white">Explore MagicBox Product Catalog</p>
                          <div className="flex gap-2 overflow-x-auto py-2">
                            <div className="w-36 shrink-0 rounded-lg bg-zinc-800 p-2 border border-zinc-700 text-center">
                              <div className="h-16 rounded bg-zinc-700/60 mb-1 flex items-center justify-center text-[9px] text-zinc-400 font-mono">Avatar Reel</div>
                              <p className="text-[10px] font-bold text-white truncate">AI Video Suite</p>
                              <p className="text-[10px] text-emerald-400 font-mono">$49 / mo</p>
                              <button className="mt-1.5 w-full rounded bg-emerald-600 py-1 text-[9px] font-bold text-white">Order Now</button>
                            </div>
                            <div className="w-36 shrink-0 rounded-lg bg-zinc-800 p-2 border border-zinc-700 text-center">
                              <div className="h-16 rounded bg-zinc-700/60 mb-1 flex items-center justify-center text-[9px] text-zinc-400 font-mono">Brand Kit AI</div>
                              <p className="text-[10px] font-bold text-white truncate">Brand Copilot</p>
                              <p className="text-[10px] text-emerald-400 font-mono">$29 / mo</p>
                              <button className="mt-1.5 w-full rounded bg-emerald-600 py-1 text-[9px] font-bold text-white">Order Now</button>
                            </div>
                          </div>
                        </>
                      )}

                      {interactiveType === "flow" && (
                        <>
                          <p className="font-semibold text-white">Book Your 1-on-1 Strategy Call</p>
                          <p className="text-[11px] text-zinc-300">Fill out this quick in-chat native form to reserve your onboarding slot directly inside WhatsApp.</p>
                          <div className="pt-2">
                            <div className="rounded-lg bg-purple-600/20 text-purple-300 py-2 px-3 text-center text-xs font-semibold border border-purple-500/30 flex items-center justify-center gap-2 cursor-pointer">
                              <Layers className="h-4 w-4" /> Open In-Chat Form (Flow)
                            </div>
                          </div>
                        </>
                      )}

                      {interactiveType === "template" && (
                        <>
                          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Template: marketing_lead_nurture</div>
                          <p className="text-zinc-200">
                            Hi <span className="text-emerald-400 font-mono font-bold">&#123;&#123;1&#125;&#125;</span>! Your brand report for <span className="text-emerald-400 font-mono font-bold">&#123;&#123;2&#125;&#125;</span> is ready with 15 optimized social videos.
                          </p>
                          <div className="text-[10px] text-zinc-500 pt-1">Reply STOP to unsubscribe.</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Messaging Windows & Rate Limits Footer */}
                  <div className="border-t border-zinc-800/80 pt-3 text-[10px] text-zinc-400 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-amber-400" />
                      24h Session Window Active
                    </span>
                    <span className="flex items-center gap-1 font-mono text-emerald-400">
                      Tier 1: 1,000 msgs/day
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end pt-4 border-t border-border">
                <Button variant="default" onClick={() => onOpenChange(false)}>
                  Close Explorer
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Main Integrations & Channels Hub Component
 */
export default function Integrations() {
  const { user } = useAuth();
  const catalogue = useQuery(api.social.catalogue, {});
  const accounts = useQuery(api.social.accounts, {});
  const connectUrl = useAction(api.social.connectUrl);
  const disconnect = useMutation(api.social.disconnect);

  const [busy, setBusy] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);

  const launchPlatforms = new Set([
    "instagram",
    "linkedin",
    "youtube",
    "facebook",
    "whatsapp",
  ]);

  const connected = (accounts ?? []).filter(
    (a: any) => a.status === "active" || a.status === "expired",
  );

  const connectable = (catalogue ?? [])
    .filter((p: any) => launchPlatforms.has(p.id))
    .filter((p: any) => {
      const active = connected.some(
        (a: any) => a.platform === p.id && a.status === "active",
      );
      return !active;
    });

  const handleConnect = async (provider: string) => {
    if (provider === "whatsapp") {
      setWhatsAppModalOpen(true);
      return;
    }
    setBusy(provider);
    try {
      const { url } = await connectUrl({
        provider,
        returnTo: "/settings?tab=integrations",
        returnOrigin: window.location.origin,
        loginHint: user?.email ?? undefined,
      });
      captureEvent("social_channel_connect_started", { provider });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message || `Could not connect ${provider}`);
      setBusy(null);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!accountId || disconnectingId) return;
    setDisconnectingId(accountId);
    try {
      await disconnect({ accountId: accountId as any });
      toast.success("Channel disconnected");
    } catch (e: any) {
      toast.error(e?.message || "Could not disconnect channel");
    } finally {
      setDisconnectingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Integrations &amp; Channels</h2>
            <Badge variant="outline" className="text-xs border-brand/30 text-brand bg-brand/10">
              Cloud API Ready
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your publishing channels, WhatsApp Business automations, and social pipelines in one place.
          </p>
        </div>
        <Button
          onClick={() => setWhatsAppModalOpen(true)}
          className="bg-[#25D366] hover:bg-[#20ba59] text-zinc-950 font-semibold shadow-md shrink-0"
        >
          <MessageCircle className="mr-2 h-4 w-4 fill-zinc-950" />
          WhatsApp V2 Hub
        </Button>
      </div>

      {/* Connected Channels Grid */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider font-mono">
          Connected Channels ({connected.length + 1})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <GoogleConnectorTile email={user?.email} />

          {connected.map((account: any) => {
            const Icon = PLATFORM_ICON[account.platform] ?? Link2;
            const isWhatsApp = account.platform === "whatsapp";
            const brandColor = PLATFORM_BRAND[account.platform] ?? "#6366f1";
            const handle = account.username || account.displayName || account.platform;
            const isBusyDisc = disconnectingId === account._id;

            return (
              <div
                key={account._id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5 shadow-sm hover:border-brand/30 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                    style={{ background: brandColor }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {account.displayName || account.platform}
                      </p>
                      {isWhatsApp && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate font-mono">{handle}</p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isBusyDisc}
                  onClick={() => handleDisconnect(account._id)}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                  title="Disconnect Channel"
                >
                  {isBusyDisc ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connect More Channels Section */}
      {connectable.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-border">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider font-mono">
            Available Channels to Connect
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {connectable.map((provider: any) => {
              const Icon = PLATFORM_ICON[provider.id] ?? Plus;
              const isBusy = busy === provider.id;
              const isWhatsApp = provider.id === "whatsapp";

              return (
                <Button
                  key={provider.id}
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => handleConnect(provider.id)}
                  className={cn(
                    "h-auto py-3 px-4 justify-start border-border bg-card/60 hover:bg-card hover:border-brand/40 transition-all",
                    isWhatsApp && "border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/[0.02]",
                  )}
                >
                  {isBusy ? (
                    <Loader2 className="mr-2.5 h-4 w-4 animate-spin shrink-0" />
                  ) : (
                    <Icon className={cn("mr-2.5 h-4 w-4 shrink-0", isWhatsApp ? "text-[#25D366]" : "text-brand")} />
                  )}
                  <div className="text-left min-w-0 flex-1">
                    <div className="text-xs font-semibold text-foreground truncate">
                      Connect {provider.displayName}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {isWhatsApp ? "Cloud API / Sandbox" : "OAuth Publishing"}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* WhatsApp V2 Capabilities Spotlight Banner */}
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 via-zinc-900 to-zinc-950 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#25D366] animate-pulse" />
            <span className="text-xs font-mono font-semibold uppercase text-emerald-400 tracking-wider">
              WhatsApp Automation Capabilities
            </span>
          </div>
          <h4 className="text-base font-bold text-white">
            Interactive Messages, Product Catalogs, In-Chat Flows &amp; Broadcasts
          </h4>
          <p className="text-xs text-zinc-400 max-w-xl">
            Support for Quick Reply buttons, Call-to-Action URLs, List menus, Multi-Product catalogs, native forms, and 24-hour customer service window automation.
          </p>
        </div>
        <Button
          onClick={() => setWhatsAppModalOpen(true)}
          variant="outline"
          className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 shrink-0 text-xs font-semibold"
        >
          <Sliders className="mr-2 h-3.5 w-3.5" />
          Open Capabilities Hub
        </Button>
      </div>

      {/* Modal instance */}
      <WhatsAppV2Modal
        open={whatsAppModalOpen}
        onOpenChange={setWhatsAppModalOpen}
      />
    </div>
  );
}
