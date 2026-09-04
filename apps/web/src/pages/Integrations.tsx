import React, { useState, useEffect } from "react";
import { useAuth } from "@shared/lib/auth";
import { toast } from "sonner";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { isConvexConfigured } from "../lib/convex";
import { deleteSocialAccount, deleteSocialAccountsForPlatform } from "@shared/lib/automations";
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
import { cn } from "@shared/lib/utils";
import { Link, useSearchParams } from "react-router-dom";
import { captureEvent } from "@shared/lib/analytics";
import { ComingSoonChannelModal } from "../components/channels/ComingSoonChannelModal";
import {
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
  MessageCircle,
  Twitter,
  Video,
  Link2,
  Check,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  ShieldCheck,
  Info,
  Clock,
  ShoppingBag,
  List,
  MousePointerClick,
  FileText,
  AlertCircle,
  RefreshCw,
  Sliders,
  Send,
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
  twitter: Twitter,
  x: Twitter,
  tiktok: Video,
  whatsapp: MessageCircle,
};

const PLATFORM_BRAND: Record<string, string> = {
  instagram: "linear-gradient(45deg,#F58529,#DD2A7B,#8134AF,#515BD4)",
  youtube: "#FF0000",
  linkedin: "#0A66C2",
  facebook: "#1877F2",
  twitter: "#000000",
  x: "#000000",
  tiktok: "#000000",
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
 * WhatsApp Cloud API connection via Meta Embedded Signup (Facebook Login).
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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      // New tab, so the app keeps its state; the callback posts back to this
      // window and closes itself. Popup blocked → fall back to this tab.
      const tab = window.open(url, "_blank", "noopener,noreferrer");
      if (!tab || tab.closed) {
        window.location.href = url;
        return;
      }
      toast.info("Finish authorizing WhatsApp in the new tab.");
      onOpenChange(false);
      setIsSubmitting(false);
    } catch (e: any) {
      toast.error(e?.message || "Could not launch Meta Facebook Login");
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 border border-border/80 bg-card text-foreground shadow-2xl">
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
                Connect your business phone number to WhatsApp Cloud API with Facebook Login.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <div className="h-5 w-5 shrink-0 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-mono">1</div>
              <p>
                <strong>Clean phone number:</strong> the number must not be registered on the WhatsApp
                consumer or Business app — delete that account first to migrate it to Cloud API.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-5 w-5 shrink-0 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-mono">2</div>
              <p>
                <strong>OTP verification:</strong> Meta sends a 6-digit code to the number inside the
                Facebook popup.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-5 w-5 shrink-0 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-mono">3</div>
              <p>
                <strong>Sending limits:</strong> unverified businesses start at 250–1,000 conversations /
                24h. Meta Business Verification raises it.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
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
                  Opening Meta login...
                </>
              ) : (
                <>
                  <Facebook className="mr-2 h-4 w-4 fill-white" />
                  Continue with Facebook
                </>
              )}
            </Button>
          </div>
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
  const [comingSoonPlatform, setComingSoonPlatform] = useState<string | null>(null);

  const launchPlatforms = new Set([
    "instagram",
    "linkedin",
    "youtube",
    "facebook",
    "tiktok",
    "twitter",
    "whatsapp",
  ]);

  const connected = (accounts ?? []).filter(
    (a: any) => a.status === "active" || a.status === "expired",
  );

  const connectable = (catalogue ?? [])
    .filter((p: any) => launchPlatforms.has(p.id))
    .filter((p: any) => {
      const active = connected.some(
        (a: any) => (a.platform === p.id || (p.id === "twitter" && a.platform === "x")) && a.status === "active",
      );
      return !active;
    });

  const handleConnect = async (provider: string) => {
    if (provider === "tiktok" || provider === "twitter" || provider === "x" || provider === "whatsapp") {
      setComingSoonPlatform(provider);
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
      const newTab = window.open(url, "_blank");
      if (!newTab || newTab.closed || typeof newTab.closed === "undefined") {
        window.location.href = url;
      } else {
        toast.info(`Connecting ${provider}... Complete authorization in the new tab.`);
        setBusy(null);
      }
    } catch (e: any) {
      toast.error(e?.message || `Could not connect ${provider}`);
      setBusy(null);
    }
  };

  const handleDisconnect = async (accountId: string, platform?: string) => {
    if (!accountId || disconnectingId) return;
    setDisconnectingId(accountId);
    try {
      await disconnect({ accountId: accountId as any });
      if (user?.uid) {
        if (platform) {
          await deleteSocialAccountsForPlatform(user.uid, platform).catch(() => {});
        }
        await deleteSocialAccount(accountId).catch(() => {});
      }
      toast.success("Channel disconnected and sessions logged out");
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
                  onClick={() => handleDisconnect(account._id, account.platform)}
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
              const isComingSoon = !provider.available || provider.id === "tiktok" || provider.id === "twitter" || provider.id === "x" || provider.id === "whatsapp";

              return (
                <Button
                  key={provider.id}
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => handleConnect(provider.id)}
                  className={cn(
                    "h-auto py-3 px-4 justify-between border-border bg-card/60 hover:bg-card hover:border-brand/40 transition-all text-left",
                    isWhatsApp && "border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/[0.02]",
                  )}
                >
                  <div className="flex items-center min-w-0 mr-2">
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
                        {isWhatsApp ? "Cloud API / Sandbox" : isComingSoon ? "In Development" : "OAuth Publishing"}
                      </div>
                    </div>
                  </div>
                  {isComingSoon && (
                    <span className="rounded bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider shrink-0">
                      Soon
                    </span>
                  )}
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

      {/* Modal instances */}
      <WhatsAppV2Modal
        open={whatsAppModalOpen}
        onOpenChange={setWhatsAppModalOpen}
      />

      <ComingSoonChannelModal
        open={comingSoonPlatform !== null}
        onOpenChange={(isOpen) => !isOpen && setComingSoonPlatform(null)}
        platform={comingSoonPlatform}
        onConnectActivePlatform={(p) => {
          setComingSoonPlatform(null);
          void handleConnect(p);
        }}
      />
    </div>
  );
}
