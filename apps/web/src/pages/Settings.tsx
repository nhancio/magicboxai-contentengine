import { useEffect, useState } from "react";
import { useAuth } from "@shared/lib/auth";
import { toast } from "sonner";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { isConvexConfigured } from "../lib/convex";
import { Button } from "@shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Label } from "@shared/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@shared/components/ui/dialog";
import { cn } from "@shared/lib/utils";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { DEFAULT_TRIAL_I, DEFAULT_TRIAL_V, trialClock } from "../lib/credits";
import { captureEvent } from "@shared/lib/analytics";
import {
  Settings as SettingsIcon,
  User,
  Palette,
  Bell,
  Download,
  Trash2,
  Moon,
  Globe,
  Mail,
  Smartphone,
  FileBarChart,
  Instagram,
  Linkedin,
  Loader2,
  Pencil,
  Twitter,
  Youtube,
  Facebook,
  MessageCircle,
  Link2,
  Sparkles,
  Clock,
  X,
  Plus,
  Image as ImageIcon,
  Clapperboard,
} from "lucide-react";

const PLATFORM_ICON: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  youtube: Youtube,
  twitter: Twitter,
  reddit: MessageCircle,
  whatsapp: MessageCircle,
};

/** Real platform brand colours for the connected-channel tiles. */
const PLATFORM_BRAND: Record<string, string> = {
  instagram: "linear-gradient(45deg,#F58529,#DD2A7B,#8134AF,#515BD4)",
  youtube: "#FF0000",
  linkedin: "#0A66C2",
  facebook: "#1877F2",
  twitter: "#000000",
  whatsapp: "#25D366",
  reddit: "#FF4500",
};

type ChannelAccount = {
  platform?: string;
  username?: string;
  displayName?: string;
  externalId?: string;
};

function channelHandle(account: ChannelAccount) {
  return (account.username || account.displayName || "")
    .toString()
    .trim()
    .replace(/^@/, "");
}

/** https profile URL — on phones these usually hand off into the installed app. */
function webProfileUrl(account: ChannelAccount): string | null {
  const platform = (account.platform ?? "").toLowerCase();
  const handle = channelHandle(account);
  const externalId = (account.externalId ?? "").toString().trim();

  switch (platform) {
    case "instagram":
      return handle ? `https://www.instagram.com/${encodeURIComponent(handle)}/` : null;
    case "youtube": {
      if (externalId && /^UC[\w-]{20,}$/.test(externalId)) {
        return `https://www.youtube.com/channel/${externalId}`;
      }
      if (handle) {
        if (/^UC[\w-]{20,}$/.test(handle)) {
          return `https://www.youtube.com/channel/${handle}`;
        }
        return `https://www.youtube.com/@${encodeURIComponent(handle)}`;
      }
      return null;
    }
    case "linkedin": {
      if (handle && !handle.includes("@") && !handle.startsWith("urn:")) {
        const slug = handle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        if (slug) return `https://www.linkedin.com/in/${slug}`;
      }
      return "https://www.linkedin.com/feed/";
    }
    case "facebook":
      if (externalId) return `https://www.facebook.com/${externalId}`;
      return handle ? `https://www.facebook.com/${encodeURIComponent(handle)}` : null;
    case "whatsapp": {
      // Click-to-chat with the business number — "open the bot's chat". Works
      // for a REAL connected number; Meta's SANDBOX test number can't be opened
      // this way (WhatsApp reports "isn't on WhatsApp"), which is a Meta limit.
      const digits = (handle || externalId).replace(/[^\d]/g, "");
      return digits ? `https://wa.me/${digits}` : "https://www.whatsapp.com/";
    }
    case "twitter":
      return handle ? `https://x.com/${encodeURIComponent(handle)}` : null;
    case "reddit":
      return handle ? `https://www.reddit.com/user/${encodeURIComponent(handle)}` : null;
    default:
      return null;
  }
}

/** Native app scheme — used first on mobile so the social app opens directly. */
function appDeepLink(account: ChannelAccount): string | null {
  const platform = (account.platform ?? "").toLowerCase();
  const handle = channelHandle(account);
  const externalId = (account.externalId ?? "").toString().trim();

  switch (platform) {
    case "instagram":
      return handle ? `instagram://user?username=${encodeURIComponent(handle)}` : null;
    case "youtube":
      if (externalId) return `vnd.youtube://channel/${externalId}`;
      if (handle) return `youtube://www.youtube.com/@${encodeURIComponent(handle)}`;
      return null;
    case "linkedin": {
      const personId = externalId.replace(/^urn:li:person:/, "");
      if (personId && personId !== externalId) {
        return `linkedin://profile/${personId}`;
      }
      if (handle) {
        const slug = handle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        if (slug) return `linkedin://in/${slug}`;
      }
      return "linkedin://";
    }
    case "facebook":
      return externalId
        ? `fb://page/${externalId}`
        : handle
          ? `fb://profile/${encodeURIComponent(handle)}`
          : null;
    case "whatsapp": {
      // Open the chat with the business number in the WhatsApp app (real
      // numbers only; the sandbox test number can't be opened).
      const digits = (handle || externalId).replace(/[^\d]/g, "");
      return digits ? `whatsapp://send?phone=${digits}` : "whatsapp://";
    }
    case "twitter":
      return handle ? `twitter://user?screen_name=${encodeURIComponent(handle)}` : null;
    default:
      return null;
  }
}

function isMobileClient() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/** Open the account inside Instagram / YouTube / LinkedIn / etc. (app when possible). */
function openChannelProfile(account: ChannelAccount) {
  const web = webProfileUrl(account);
  const deep = appDeepLink(account);
  if (!web && !deep) return;

  if (isMobileClient() && deep) {
    const started = Date.now();
    // Hand off to the native app first…
    window.location.href = deep;
    // …and fall back to the https profile if the app didn't take over.
    window.setTimeout(() => {
      if (document.hidden || Date.now() - started > 1600) return;
      if (web) window.open(web, "_blank", "noopener,noreferrer");
    }, 900);
    return;
  }

  if (web) window.open(web, "_blank", "noopener,noreferrer");
}

function GoogleConnectorTile({ email }: { email?: string | null }) {
  return (
    <div
      className="group relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary p-2 text-center"
      title={email ? `Signed in as ${email}` : "Google account"}
    >
      <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-border">
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-secondary"
          title="Connected"
        />
      </div>
      <span className="w-full truncate text-[11px] font-medium text-foreground">Google</span>
    </div>
  );
}

/**
 * Channel connect/disconnect wired to the CONVEX backend (the one the new
 * publish engine reads). The legacy Firebase block below is the fallback when
 * Convex isn't configured — this is the path that actually lets posts publish.
 */
function convexErrorMessage(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Could not disconnect";
  // Convex wraps as: [CONVEX M(social:disconnect)] [Request ID…] Server Error\nUncaught Error: …
  const uncaught = raw.match(/Uncaught Error:\s*(.+)$/m);
  if (uncaught?.[1]) return uncaught[1].trim().slice(0, 140);
  return raw.replace(/^Error:\s*/, "").slice(0, 140);
}

function ConvexChannels({ compact }: { compact?: boolean }) {
  const { user } = useAuth();
  const catalogue = useQuery(api.social.catalogue, {});
  const accounts = useQuery(api.social.accounts, {});
  const connectUrl = useAction(api.social.connectUrl);
  const disconnect = useMutation(api.social.disconnect);
  const [busy, setBusy] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [showConnectPicker, setShowConnectPicker] = useState(false);
  // Live Meta + Google channels. Deferred (twitter/reddit) stay in catalogue but
  // only surface if we intentionally add them here later.
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

  async function handleConnect(provider: string) {
    setBusy(provider);
    try {
      const { url, redirectUri } = await connectUrl({
        provider,
        returnTo: "/settings?tab=integrations",
        returnOrigin: window.location.origin,
        loginHint: user?.email ?? undefined,
      });
      // Guard: if this ever points at Firebase, stop — that causes the Google
      // "Go to cloudfunctions.net" unverified-app screen.
      if (redirectUri.includes("cloudfunctions.net")) {
        toast.error("OAuth misconfigured (Firebase callback). Use Convex.");
        setBusy(null);
        return;
      }
      captureEvent("social_channel_connect_started", { provider });
      window.location.href = url;
    } catch (e) {
      toast.error(convexErrorMessage(e));
      setBusy(null);
    }
  }

  async function handleDisconnect(accountId: string) {
    if (!accountId || disconnectingId) return;
    setDisconnectingId(accountId);
    try {
      await disconnect({ accountId: accountId as any });
      toast.success("Channel disconnected");
    } catch (e) {
      console.error("[settings] disconnect failed", e);
      toast.error(convexErrorMessage(e));
    } finally {
      setDisconnectingId(null);
    }
  }

  return (
    <div>
      <div
        className={cn(
          "mb-3 grid gap-2.5",
          compact
            ? "grid-cols-3 sm:grid-cols-4"
            : "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8",
        )}
      >
        <GoogleConnectorTile email={user?.email} />

        {connected.map((account: any) => {
          const Icon = PLATFORM_ICON[account.platform] ?? Link2;
          const isActive = account.status === "active";
          const raw = (account.username || account.displayName || "").toString().trim();
          const handle = raw ? (raw.startsWith("@") ? raw : `@${raw}`) : account.platform;
          const canOpen = Boolean(webProfileUrl(account) || appDeepLink(account));
          const busyDisc = disconnectingId === account._id;
          return (
            <div
              key={account._id}
              role={canOpen ? "link" : undefined}
              tabIndex={canOpen ? 0 : undefined}
              onClick={() => {
                if (canOpen) openChannelProfile(account);
              }}
              onKeyDown={(ev) => {
                if (!canOpen) return;
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  openChannelProfile(account);
                }
              }}
              className={cn(
                "group relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary p-2 text-center transition-colors",
                canOpen && "cursor-pointer hover:border-brand/40 hover:bg-secondary/80",
              )}
              title={canOpen ? `Open ${handle} on ${account.platform}` : handle}
            >
              <button
                type="button"
                aria-label={`Disconnect ${account.platform}`}
                disabled={busyDisc}
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  void handleDisconnect(String(account._id));
                }}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
              >
                {busyDisc ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </button>
              <div
                className="relative flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
                style={{ background: PLATFORM_BRAND[account.platform] ?? "#6b7280" }}
              >
                <Icon className="h-5 w-5" />
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-secondary",
                    isActive ? "bg-emerald-500" : "bg-amber-500",
                  )}
                  title={isActive ? "Connected" : "Reconnect needed"}
                />
              </div>
              <span className="w-full truncate text-[11px] font-medium text-foreground">
                {handle}
              </span>
            </div>
          );
        })}

        {/* + tile — connect another channel */}
        {connectable.length > 0 && (
          <button
            type="button"
            onClick={() => setShowConnectPicker((v) => !v)}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed p-2 text-center transition-colors",
              showConnectPicker
                ? "border-brand bg-brand/5 text-brand"
                : "border-border text-muted-foreground hover:border-brand/50 hover:bg-secondary hover:text-foreground",
            )}
            title="Connect a new channel"
            aria-expanded={showConnectPicker}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-current/20 bg-background">
              <Plus className="h-5 w-5" />
            </div>
            <span className="w-full truncate text-[11px] font-medium">Add</span>
          </button>
        )}
      </div>

      {(showConnectPicker || connected.length === 0) && connectable.length > 0 && (
        <div className="mb-2 grid gap-2 sm:grid-cols-2">
          {connectable.map((p: any) => {
            const Icon = PLATFORM_ICON[p.id] ?? Link2;
            const expired = connected.some(
              (a: any) => a.platform === p.id && a.status === "expired",
            );
            return (
              <Button
                key={p.id}
                variant="outline"
                size="sm"
                className="justify-start"
                disabled={!p.available || busy !== null}
                title={p.available ? undefined : p.reason}
                onClick={() => handleConnect(p.id)}
              >
                {busy === p.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="mr-2 h-4 w-4" />
                )}
                {!p.available
                  ? `${p.displayName} — soon`
                  : expired
                    ? `Reconnect ${p.displayName}`
                    : `Connect ${p.displayName}`}
              </Button>
            );
          })}
        </div>
      )}

      {!compact && (
        <p className="mt-1 text-xs text-muted-foreground">
          Tap + to connect Instagram, LinkedIn, YouTube, Facebook, or WhatsApp.
        </p>
      )}
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const resolveTab = (params: URLSearchParams) => {
    const raw = (params.get("tab") || params.get("section") || "").toLowerCase();
    if (raw === "connections" || raw === "channels" || raw === "integrations") return "integrations";
    if (raw === "credits" || raw === "account" || raw === "preferences" || raw === "notifications") return raw;
    return "account";
  };

  const [activeTab, setActiveTab] = useState(() => resolveTab(searchParams));

  useEffect(() => {
    const target = resolveTab(searchParams);
    setActiveTab(target);
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tabId);
      return next;
    }, { replace: true });
  };
  
  const [defaultPlatform, setDefaultPlatform] = useState("instagram");
  const [defaultStyle, setDefaultStyle] = useState("professional");
  const [language, setLanguage] = useState("en");
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(false);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const credits = useQuery(api.credits.balance, isConvexConfigured ? {} : "skip");
  const claimTrial = useMutation(api.credits.claimTrial);
  const resetTrial = useMutation(api.credits.resetTrial);
  const [resettingTrial, setResettingTrial] = useState(false);
  const clock = trialClock(credits);
  const canRefreshTrial = !!(
    credits?.canRefreshTrial ||
    (user?.email &&
      ["compilelater@gmail.com", "nithindidigam@nhancio.com"].includes(
        user.email.toLowerCase(),
      ))
  );

  useEffect(() => {
    if (!isConvexConfigured || !user) return;
    if (credits?.needsTrialClaim) {
      claimTrial({}).catch(() => undefined);
    }
  }, [isConvexConfigured, user, credits?.needsTrialClaim, claimTrial]);

  // Surface the OAuth round-trip result and clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const social = params.get("social");
    if (!social) return;
    if (social === "connected") {
      toast.success(`${params.get("provider") ?? "Channel"} connected`);
      setActiveTab("integrations");
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
      setActiveTab("integrations");
    }
    window.history.replaceState({}, "", window.location.pathname + "?tab=integrations");
  }, []);

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  const loadingCredits = isConvexConfigured && credits === undefined;
  const iCredits = loadingCredits
    ? "…"
    : typeof credits?.iCredits === "number"
      ? credits.iCredits
      : (credits?.freeTrial?.i ?? DEFAULT_TRIAL_I);
  const vCredits = loadingCredits
    ? "…"
    : typeof credits?.vCredits === "number"
      ? credits.vCredits
      : (credits?.freeTrial?.v ?? DEFAULT_TRIAL_V);
  const creditsFrozen = !!clock?.expired && !credits?.hasPaidPlan;

  const tabs = [
    { id: "account", label: "Account", icon: User },
    { id: "credits", label: "AI Credits", icon: Sparkles },
    { id: "integrations", label: "Integrations", icon: Link2 },
    { id: "preferences", label: "Preferences", icon: Palette },
    { id: "notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex h-full max-h-[85vh] w-full max-w-[1000px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:flex-row">
        
        {/* Close Button */}
        <button
          onClick={() => navigate("/")}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-secondary/80 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          title="Close Settings"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Sidebar */}
        <div className="w-full shrink-0 border-b border-border bg-secondary/30 p-4 md:w-64 md:border-b-0 md:border-r md:p-6 flex flex-col">
          <div className="mb-6 hidden md:block">
            <h2 className="text-[13px] font-semibold text-muted-foreground px-3 uppercase tracking-wider">Settings</h2>
          </div>
          <nav className="flex flex-row overflow-x-auto md:flex-col gap-1 hide-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
                    activeTab === tab.id
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="mx-auto max-w-2xl">
            {activeTab === "account" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="border-b border-border pb-5">
                  <h3 className="text-xl font-semibold text-foreground">Account</h3>
                  <p className="text-sm text-muted-foreground mt-1">Manage your profile and personal details.</p>
                </div>
                
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border-2 border-background shadow-md ring-1 ring-border">
                      <AvatarImage src={user?.photoURL ?? undefined} />
                      <AvatarFallback className="bg-brand/10 text-lg text-brand">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <h4 className="font-display text-lg text-foreground">
                        {user?.displayName ?? "User"}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {user?.email ?? "No email"}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info("Profile editing coming soon! Your profile is synced with Google.")}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit Profile
                  </Button>
                </div>

                <div className="pt-6 space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">Account Actions</h4>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="outline"
                      className="justify-start flex-1"
                      onClick={() => {
                        const data = {
                          email: user?.email,
                          displayName: user?.displayName,
                          exportedAt: new Date().toISOString(),
                        };
                        const blob = new Blob([JSON.stringify(data, null, 2)], {
                          type: "application/json",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "magicbox-account-summary.json";
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success("Account summary downloaded");
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download Summary
                    </Button>

                    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="justify-start flex-1 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Request Deletion
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="border-border bg-card">
                        <DialogHeader>
                          <DialogTitle className="text-foreground">Request account deletion</DialogTitle>
                          <DialogDescription className="text-muted-foreground">
                            Deletion is handled by support while the automated deletion workflow is being
                            completed. We will verify your identity, help resolve any active subscription,
                            and confirm the data covered before deletion. This button does not delete or
                            sign you out immediately.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2 sm:gap-0 mt-4">
                          <Button
                            variant="ghost"
                            onClick={() => setDeleteDialogOpen(false)}
                            className="text-muted-foreground"
                          >
                            Cancel
                          </Button>
                          <Button
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                              const subject = encodeURIComponent("MagicBox account deletion request");
                              const body = encodeURIComponent(
                                `Please start an account deletion request for ${user?.email ?? "my account"}.`,
                              );
                              window.location.href = `mailto:hello@nhancio.com?subject=${subject}&body=${body}`;
                              setDeleteDialogOpen(false);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Contact support
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "credits" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="border-b border-border pb-5">
                  <h3 className="text-xl font-semibold text-foreground">AI Credits</h3>
                  <p className="text-sm text-muted-foreground mt-1">View your usage and upgrade your plan.</p>
                </div>
                
                {isConvexConfigured ? (
                  <div className="flex flex-col gap-8 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className={cn("rounded-xl border border-border bg-secondary/50 p-4", creditsFrozen && "opacity-60")}>
                        <div className="flex items-center gap-2 mb-2">
                          <ImageIcon className="h-4 w-4 text-brand" />
                          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">i-credits</p>
                        </div>
                        <p className="font-display text-4xl tabular-nums text-foreground">{iCredits}</p>
                        <p className="text-xs text-muted-foreground mt-1">1 = text / image post</p>
                      </div>
                      
                      <div className={cn("rounded-xl border border-border bg-secondary/50 p-4", creditsFrozen && "opacity-60")}>
                        <div className="flex items-center gap-2 mb-2">
                          <Clapperboard className="h-4 w-4 text-foreground/70" />
                          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">v-credits</p>
                        </div>
                        <p className="font-display text-4xl tabular-nums text-foreground">{vCredits}</p>
                        <p className="text-xs text-muted-foreground mt-1">1 = 1 second of video</p>
                      </div>
                    </div>

                    {clock && !credits?.hasPaidPlan && (
                      <div className="rounded-xl border border-border p-4 bg-background">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="font-mono uppercase tracking-widest text-muted-foreground">
                            Free trial
                          </span>
                          <span className={cn("inline-flex items-center gap-1 font-medium", clock.expired ? "text-destructive" : "text-brand")}>
                            <Clock className="h-3.5 w-3.5" />
                            {clock.expired ? "Ended" : `${clock.daysLeft}d left`}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-brand transition-[width] duration-700"
                            style={{ width: `${Math.max(4, (clock.expired ? 1 : clock.progress) * 100)}%` }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            {clock.expired
                              ? "Trial credits are frozen"
                              : clock.endsOnLabel
                                ? `Ends ${clock.endsOnLabel}`
                                : ""}
                          </p>
                          {canRefreshTrial && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={resettingTrial}
                              onClick={async () => {
                                setResettingTrial(true);
                                try {
                                  await resetTrial({});
                                  toast.success("Free trial refreshed! 7 days and 50 i-credits / 100 v-credits granted.");
                                } catch (e) {
                                  toast.error(`Failed to refresh trial: ${String(e)}`);
                                } finally {
                                  setResettingTrial(false);
                                }
                              }}
                              className="h-7 text-xs border-brand/40 hover:bg-brand/10 hover:text-brand"
                            >
                              {resettingTrial ? "Refreshing…" : "Refresh 7-day trial"}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 pt-6 border-t border-border">
                      {credits?.hasPaidPlan ? (
                        <div className="rounded-xl border border-brand/25 bg-brand/[0.07] p-5 text-center">
                          <p className="text-sm font-mono uppercase tracking-widest text-brand mb-1">
                            Plan active
                          </p>
                          <p className="text-sm text-muted-foreground">Your credits never expire.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between rounded-xl border border-brand/25 bg-brand/[0.07] p-5">
                          <div>
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-brand">
                              <Sparkles className="h-4 w-4" /> Launch offer · Save 20%
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Pro from <span className="font-medium text-foreground">$23/mo</span> billed annually
                            </p>
                          </div>
                          <Button asChild className="bg-brand hover:bg-brand/90 w-full sm:w-auto">
                            <Link to="/pricing?billing=annual">
                              <Sparkles className="mr-1.5 h-4 w-4" />
                              Buy premium
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Credit balance requires VITE_CONVEX_URL configuration.</p>
                )}
              </div>
            )}

            {activeTab === "integrations" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="border-b border-border pb-5">
                  <h3 className="text-xl font-semibold text-foreground">Integrations</h3>
                  <p className="text-sm text-muted-foreground mt-1">Sign-in and publishing channels in one place.</p>
                </div>
                
                <div className="pt-2">
                  {isConvexConfigured ? (
                    <ConvexChannels />
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                        <GoogleConnectorTile email={user?.email} />
                      </div>
                      <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg border border-border">
                        Channel connect needs <code className="font-mono text-foreground">VITE_CONVEX_URL</code> to function properly.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "preferences" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="border-b border-border pb-5">
                  <h3 className="text-xl font-semibold text-foreground">Preferences</h3>
                  <p className="text-sm text-muted-foreground mt-1">Defaults for platforms, style, and appearance.</p>
                </div>
                
                <div className="pt-2 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-sm text-foreground">Default Platform</Label>
                      <Select value={defaultPlatform} onValueChange={setDefaultPlatform}>
                        <SelectTrigger className="w-full bg-secondary">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="instagram">Instagram</SelectItem>
                          <SelectItem value="linkedin">LinkedIn</SelectItem>
                          <SelectItem value="youtube">YouTube</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">The primary channel selected when creating new content.</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-foreground">Default Style</Label>
                      <Select value={defaultStyle} onValueChange={setDefaultStyle}>
                        <SelectTrigger className="w-full bg-secondary">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="playful">Playful</SelectItem>
                          <SelectItem value="bold">Bold</SelectItem>
                          <SelectItem value="minimal">Minimal</SelectItem>
                          <SelectItem value="luxury">Luxury</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">The default tone for generated captions.</p>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-border pt-5">
                    <Label className="flex items-center gap-1.5 text-sm text-foreground">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      Language
                    </Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="w-full max-w-sm bg-secondary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="ja">Japanese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/60 p-4 mt-6">
                    <div className="flex items-center gap-3">
                      <Moon className="h-5 w-5 text-brand shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Theme</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Light mode is currently active
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand">
                      <Palette className="h-3.5 w-3.5" />
                      Light
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="border-b border-border pb-5">
                  <h3 className="text-xl font-semibold text-foreground">Notifications</h3>
                  <p className="text-sm text-muted-foreground mt-1">Choose what notifications you want to receive.</p>
                </div>
                
                <div className="pt-2 space-y-3">
                  {[
                    {
                      id: "email",
                      label: "Email Notifications",
                      description: "Receive updates about your content via email",
                      icon: Mail,
                      checked: emailNotifs,
                      onChange: setEmailNotifs,
                    },
                    {
                      id: "push",
                      label: "Push Notifications",
                      description: "Get push notifications in your browser",
                      icon: Smartphone,
                      checked: pushNotifs,
                      onChange: setPushNotifs,
                    },
                    {
                      id: "weekly",
                      label: "Weekly Report",
                      description: "Receive a weekly summary of your analytics",
                      icon: FileBarChart,
                      checked: weeklyReport,
                      onChange: setWeeklyReport,
                    },
                  ].map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:bg-secondary/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                          <item.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.checked}
                        onClick={() => item.onChange(!item.checked)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                          item.checked ? "bg-brand" : "bg-secondary"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                            item.checked ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
