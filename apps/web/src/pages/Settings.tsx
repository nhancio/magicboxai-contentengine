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
import { Badge } from "@shared/components/ui/badge";
import { cn } from "@shared/lib/utils";
import {
  Settings as SettingsIcon,
  User,
  Palette,
  Bell,
  Shield,
  Download,
  Trash2,
  Moon,
  Globe,
  Mail,
  Smartphone,
  FileBarChart,
  Check,
  Instagram,
  Linkedin,
  Loader2,
  Pencil,
  Twitter,
  Youtube,
  Facebook,
  MessageCircle,
  Link2,
} from "lucide-react";

const PLATFORM_ICON: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  youtube: Youtube,
  twitter: Twitter,
  reddit: MessageCircle,
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

function ConvexChannels() {
  const { user } = useAuth();
  const catalogue = useQuery(api.social.catalogue, {});
  const accounts = useQuery(api.social.accounts, {});
  const connectUrl = useAction(api.social.connectUrl);
  const disconnect = useMutation(api.social.disconnect);
  const [busy, setBusy] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const connected = (accounts ?? []).filter(
    (a: any) => a.status === "active" || a.status === "expired",
  );

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
      {connected.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {connected.map((account: any) => {
            const Icon = PLATFORM_ICON[account.platform] ?? Link2;
            const isActive = account.status === "active";
            const raw = (account.username || account.displayName || "").toString().trim();
            const handle = raw ? (raw.startsWith("@") ? raw : `@${raw}`) : "";
            const initials = (account.displayName || account.username || "?")
              .toString()
              .slice(0, 2)
              .toUpperCase();
            const canOpen = Boolean(webProfileUrl(account) || appDeepLink(account));
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
                  "flex items-center justify-between rounded-lg border border-border bg-secondary p-4 transition-colors",
                  canOpen && "cursor-pointer hover:border-brand/40 hover:bg-secondary/80",
                )}
                title={canOpen ? `Open in ${account.platform}` : undefined}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarImage src={account.avatarUrl} alt="" />
                    <AvatarFallback className="bg-accent text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 text-left">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{account.displayName || account.platform}</span>
                    </p>
                    <p className="truncate text-xs capitalize text-muted-foreground">
                      {account.platform} · {handle}
                      {canOpen ? " · Open channel" : ""}
                    </p>
                  </div>
                </div>
                <div className="ml-2 flex shrink-0 items-center gap-2">
                  {isActive ? (
                    <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
                      <Check className="mr-1 h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-700">
                      Reconnect
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={disconnectingId === account._id}
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      void handleDisconnect(String(account._id));
                    }}
                  >
                    {disconnectingId === account._id ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Disconnect
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {(catalogue ?? [])
          // Hide Connect for platforms already linked — they appear in the list above
          // with Disconnect. Reconnect only when status is expired.
          .filter((p: any) => {
            const active = connected.some(
              (a: any) => a.platform === p.id && a.status === "active",
            );
            return !active;
          })
          .map((p: any) => {
            const Icon = PLATFORM_ICON[p.id] ?? Link2;
            const expired = connected.some(
              (a: any) => a.platform === p.id && a.status === "expired",
            );
            return (
              <Button
                key={p.id}
                variant="outline"
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

      <p className="mt-2 text-xs text-muted-foreground">
        Instagram requires a Business/Creator account linked to a Facebook Page. YouTube connects
        via Google. X (Twitter) and Reddit are coming soon (paid API access pending).
      </p>
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
      toast.error(params.get("reason") || "Could not connect channel");
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

  return (
    <div className="w-full animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="eyebrow">Account</span>
          <h2 className="mt-2 flex items-center gap-3 font-display text-3xl text-foreground md:text-4xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
              <SettingsIcon className="h-5 w-5" />
            </div>
            Settings
          </h2>
          <p className="mt-2 text-muted-foreground">
            Manage your account, preferences, and notifications.
          </p>
        </div>
      </div>

      {/* Profile + Preferences */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="glass-card h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <User className="h-5 w-5 text-brand" />
              Profile
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your personal information and account details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <Avatar className="h-20 w-20 border border-border">
                  <AvatarImage src={user?.photoURL ?? undefined} />
                  <AvatarFallback className="bg-brand/10 text-xl text-brand">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-foreground">
                    {user?.displayName ?? "User"}
                  </h3>
                  <p className="text-sm text-muted-foreground">{user?.email ?? "No email"}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  toast.info("Profile editing coming soon! Your profile is synced with Google.")
                }
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit Profile
              </Button>
            </div>

            {isConvexConfigured && (
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-5">
                <div className="rounded-lg border border-border bg-secondary/50 px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    i-credits
                  </p>
                  <p className="mt-1 font-display text-2xl tabular-nums text-foreground">
                    {credits?.needsTrialClaim ? "…" : (credits?.iCredits ?? "—")}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    1 = text / image post
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/50 px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    v-credits
                  </p>
                  <p className="mt-1 font-display text-2xl tabular-nums text-foreground">
                    {credits?.needsTrialClaim ? "…" : (credits?.vCredits ?? "—")}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    1 = 1 second of video
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Palette className="h-5 w-5 text-brand" />
              Preferences
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Customize your default settings and appearance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-foreground/80">Default Platform</Label>
                <Select value={defaultPlatform} onValueChange={setDefaultPlatform}>
                  <SelectTrigger className="border-border bg-secondary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground/80">Default Style</Label>
                <Select value={defaultStyle} onValueChange={setDefaultStyle}>
                  <SelectTrigger className="border-border bg-secondary">
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

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-foreground/80">
                  <Globe className="h-4 w-4" />
                  Language
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="border-border bg-secondary">
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

            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary p-4">
              <div className="flex items-center gap-3">
                <Moon className="h-5 w-5 text-brand" />
                <div>
                  <p className="text-sm font-medium text-foreground">Theme</p>
                  <p className="text-xs text-muted-foreground">
                    Light mode is currently the only option
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand">
                <Palette className="h-3.5 w-3.5" />
                Light
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications + Sign-in / actions */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="glass-card h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Bell className="h-5 w-5 text-brand" />
              Notifications
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Choose what notifications you want to receive.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                className="flex items-center justify-between rounded-lg border border-border bg-secondary p-4"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.checked}
                  onClick={() => item.onChange(!item.checked)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    item.checked ? "bg-brand" : "bg-accent"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-sm ring-0 transition duration-200 ${
                      item.checked ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="glass-card h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Shield className="h-5 w-5 text-brand" />
              Sign-in & data
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              How you sign in and account-level actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label className="mb-3 block text-foreground/80">Sign-in</Label>
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
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
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Google</p>
                    <p className="text-xs text-muted-foreground">{user?.email ?? "Connected"}</p>
                  </div>
                </div>
                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
                  <Check className="mr-1 h-3 w-3" />
                  Connected
                </Badge>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
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
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                Download account summary
              </Button>

              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="border border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Request account deletion
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
      </div>

      {/* Channels — full width */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Link2 className="h-5 w-5 text-brand" />
            Connected channels
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Link Instagram, LinkedIn, YouTube, and more so Maya and Studio can publish.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isConvexConfigured ? (
            <ConvexChannels />
          ) : (
            <p className="text-sm text-muted-foreground">
              Channel connect needs <code className="font-mono">VITE_CONVEX_URL</code>. Restart the
              web app after setting it.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
