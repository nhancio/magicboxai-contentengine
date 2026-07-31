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
import { Link } from "react-router-dom";
import { trialClock } from "../lib/credits";
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
  Flame,
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
        returnTo: "/settings",
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

        {/* Buy Warmed-Up Accounts Tile */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toast.info("Buy warmed up accounts feature coming soon! Pre-warmed aged accounts with clean reputation.")}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              toast.info("Buy warmed up accounts feature coming soon! Pre-warmed aged accounts with clean reputation.");
            }
          }}
          className="group relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-1.5 text-center transition-all hover:border-amber-500 hover:bg-amber-500/10 cursor-pointer"
          title="Buy pre-warmed aged social accounts with clean reputation (Coming Soon)"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Flame className="h-5 w-5" />
          </div>
          <span className="w-full truncate text-[10px] font-semibold text-foreground">
            Buy Accounts
          </span>
          <span className="inline-flex items-center rounded-full bg-amber-500/20 px-1.5 py-0.2 font-mono text-[8px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Soon
          </span>
        </div>
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
          <Button
            variant="outline"
            size="sm"
            className="justify-start border-dashed border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            onClick={() => toast.info("Buy warmed up accounts feature coming soon!")}
          >
            <Flame className="mr-2 h-4 w-4 text-amber-500" />
            Buy Warmed Up Accounts — Soon
          </Button>
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
  const [defaultPlatform, setDefaultPlatform] = useState("instagram");
  const [defaultStyle, setDefaultStyle] = useState("professional");
  const [language, setLanguage] = useState("en");
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(false);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const credits = useQuery(api.credits.balance, isConvexConfigured ? {} : "skip");
  const claimTrial = useMutation(api.credits.claimTrial);
  const clock = trialClock(credits);

  useEffect(() => {
    if (!isConvexConfigured || !credits?.needsTrialClaim) return;
    claimTrial({}).catch(() => undefined);
  }, [credits?.needsTrialClaim, claimTrial]);

  // Surface the OAuth round-trip result and clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const social = params.get("social");
    if (!social) return;
    if (social === "connected") {
      toast.success(`${params.get("provider") ?? "Channel"} connected`);
    } else if (social === "error") {
      const rawReason = params.get("reason");
      const cleanReason = rawReason?.includes("no_facebook_pages")
        ? "Facebook connection failed: You must own or manage at least one Facebook Page under your account."
        : rawReason?.replace(/^Error:\s*/, "").replace(/Uncaught\s+BadBodyError:\s*/, "") || "Could not connect channel";
      toast.error(cleanReason);
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  const iCredits = credits?.needsTrialClaim ? "…" : (credits?.iCredits ?? "—");
  const vCredits = credits?.needsTrialClaim ? "…" : (credits?.vCredits ?? "—");
  const creditsFrozen = !!clock?.expired && !credits?.hasPaidPlan;

  return (
    <div className="w-full animate-fade-in space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 0% 0%, rgb(var(--brand) / 0.12), transparent 55%), radial-gradient(ellipse 50% 60% at 100% 100%, rgb(23 22 20 / 0.04), transparent 50%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--border) / 0.7) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--border) / 0.7) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage: "linear-gradient(to bottom, black, transparent)",
          }}
        />
        <div className="relative flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-7">
          <div>
            <span className="eyebrow">
              <SettingsIcon className="h-3.5 w-3.5" />
              Account
            </span>
            <h2 className="mt-2 font-display text-3xl text-foreground md:text-4xl">Settings</h2>
            <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
              Profile, preferences, and the channels you publish to.
            </p>
          </div>
        </div>
      </div>

      {/* Credits & plan — prominent, on top */}
      {isConvexConfigured && (
        <Card className="glass-card overflow-hidden">
          <CardContent className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Balances + trial */}
            <div className="flex flex-1 flex-wrap items-center gap-x-8 gap-y-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Your credits</p>
                  <p className="text-[11px] text-muted-foreground">Spent as you create</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className={cn(creditsFrozen && "opacity-60")}>
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-brand" />
                    <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                      i-credits
                    </p>
                  </div>
                  <p className="mt-0.5 font-display text-3xl tabular-nums text-foreground">
                    {iCredits}
                  </p>
                  <p className="text-[11px] text-muted-foreground">1 = text / image post</p>
                </div>
                <div className="h-12 w-px bg-border" />
                <div className={cn(creditsFrozen && "opacity-60")}>
                  <div className="flex items-center gap-1.5">
                    <Clapperboard className="h-3.5 w-3.5 text-foreground/70" />
                    <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                      v-credits
                    </p>
                  </div>
                  <p className="mt-0.5 font-display text-3xl tabular-nums text-foreground">
                    {vCredits}
                  </p>
                  <p className="text-[11px] text-muted-foreground">1 = 1 second of video</p>
                </div>
              </div>

              {clock && !credits?.hasPaidPlan && (
                <div className="min-w-[150px] flex-1 sm:max-w-[220px]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono uppercase tracking-widest text-muted-foreground">
                      Free trial
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-medium",
                        clock.expired ? "text-destructive" : "text-brand",
                      )}
                    >
                      <Clock className="h-3 w-3" />
                      {clock.expired ? "Ended" : `${clock.daysLeft}d left`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-brand transition-[width] duration-700"
                      style={{ width: `${Math.max(4, (clock.expired ? 1 : clock.progress) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {clock.expired
                      ? "Trial credits are frozen"
                      : clock.endsOnLabel
                        ? `Ends ${clock.endsOnLabel}`
                        : ""}
                  </p>
                </div>
              )}
            </div>

            {/* Offer + upgrade */}
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
              {credits?.hasPaidPlan ? (
                <div className="rounded-lg border border-brand/25 bg-brand/[0.07] px-4 py-3 text-center">
                  <p className="text-[11px] font-mono uppercase tracking-widest text-brand">
                    Plan active
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Credits never expire</p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-brand/25 bg-brand/[0.07] px-4 py-2.5">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-brand">
                      <Sparkles className="h-3.5 w-3.5" /> Launch offer · Save 20%
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Pro from <span className="font-medium text-foreground">$23/mo</span> billed
                      annually
                    </p>
                  </div>
                  <Button asChild className="bg-brand hover:bg-brand/90">
                    <Link to="/pricing?billing=annual">
                      <Sparkles className="mr-1.5 h-4 w-4" />
                      Buy premium
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile + preferences & notifications */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start">
        <Card className="glass-card overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <Avatar className="h-14 w-14 border-2 border-background shadow-md ring-1 ring-border sm:h-16 sm:w-16">
                    <AvatarImage src={user?.photoURL ?? undefined} />
                    <AvatarFallback className="bg-brand/10 text-lg text-brand">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-foreground text-background ring-2 ring-card">
                    <User className="h-2.5 w-2.5" />
                  </span>
                </div>
                <div className="min-w-0 space-y-0.5">
                  <h3 className="truncate font-display text-xl text-foreground">
                    {user?.displayName ?? "User"}
                  </h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {user?.email ?? "No email"}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 h-8 text-xs"
                onClick={() =>
                  toast.info("Profile editing coming soon! Your profile is synced with Google.")
                }
              >
                <Pencil className="mr-1.5 h-3 w-3" />
                Edit Profile
              </Button>
            </div>

            <div className="border-t border-border px-4 py-4 sm:px-5">
              <div className="mb-2 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-brand" />
                <p className="text-sm font-medium text-foreground">Connectors</p>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Sign-in and publishing channels in one place.
              </p>
              {isConvexConfigured ? (
                <ConvexChannels compact />
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                    <GoogleConnectorTile email={user?.email} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Channel connect needs <code className="font-mono">VITE_CONVEX_URL</code>.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:px-5">
              <Button
                size="sm"
                variant="outline"
                className="justify-start h-8 text-xs"
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
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download summary
              </Button>

              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="justify-start h-8 text-xs border border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Request deletion
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
                  <DialogFooter className="gap-2 sm:gap-0">
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
                        window.location.href = `mailto:support@magicboxai.in?subject=${subject}&body=${body}`;
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
          </CardContent>
        </Card>

        {/* Preferences & Notifications column */}
        <Card className="glass-card">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="flex items-center gap-2 text-foreground text-base">
              <Palette className="h-4.5 w-4.5 text-brand" />
              Preferences
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Defaults for platforms, style, and appearance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-foreground/80">Default Platform</Label>
                <Select value={defaultPlatform} onValueChange={setDefaultPlatform}>
                  <SelectTrigger className="h-9 text-xs border-border bg-secondary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-foreground/80">Default Style</Label>
                <Select value={defaultStyle} onValueChange={setDefaultStyle}>
                  <SelectTrigger className="h-9 text-xs border-border bg-secondary">
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
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs text-foreground/80">
                  <Globe className="h-3.5 w-3.5" />
                  Language
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="h-9 text-xs border-border bg-secondary">
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
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/60 p-3">
              <div className="flex items-center gap-2.5">
                <Moon className="h-4.5 w-4.5 text-brand shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Theme</p>
                  <p className="text-[11px] text-muted-foreground">
                    Light mode is currently active
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand">
                <Palette className="h-3 w-3" />
                Light
              </div>
            </div>

            {/* Notifications section inside the same card */}
            <div className="border-t border-border pt-4 space-y-3">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Bell className="h-4 w-4 text-brand" />
                  Notifications
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Choose what notifications you want to receive.
                </p>
              </div>

              <div className="space-y-2">
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
                    className="flex items-center justify-between rounded-lg border border-border bg-secondary/60 p-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.checked}
                      onClick={() => item.onChange(!item.checked)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                        item.checked ? "bg-brand" : "bg-accent"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-sm ring-0 transition duration-200 ${
                          item.checked ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
