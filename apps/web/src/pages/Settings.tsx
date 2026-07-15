import { useEffect, useState } from "react";
import { useAuth } from "@shared/lib/auth";
import { toast } from "sonner";
import type { SocialAccount } from "@shared/types";
import { getSocialAccounts } from "@shared/lib/automations";
import { connectSocial, disconnectSocialAccount } from "@shared/lib/suite";
import { Button } from "@shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Label } from "@shared/components/ui/label";
import { Separator } from "@shared/components/ui/separator";
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
} from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const [defaultPlatform, setDefaultPlatform] = useState("instagram");
  const [defaultStyle, setDefaultStyle] = useState("professional");
  const [language, setLanguage] = useState("en");
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(false);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [connecting, setConnecting] = useState<"instagram" | "linkedin" | "youtube" | null>(null);

  useEffect(() => {
    if (!user) return;
    getSocialAccounts(user.uid).then(setSocialAccounts).catch(() => {});
  }, [user]);

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

  const handleConnect = async (provider: "instagram" | "linkedin" | "youtube") => {
    setConnecting(provider);
    try {
      await connectSocial(provider); // redirects the tab
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start connection");
      setConnecting(null);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!user) return;
    try {
      await disconnectSocialAccount({ accountId });
      setSocialAccounts(await getSocialAccounts(user.uid));
      toast.success("Channel disconnected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect");
    }
  };

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* Header */}
      <div>
        <span className="eyebrow">Account</span>
        <h2 className="mt-2 text-3xl md:text-4xl font-display text-foreground flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
            <SettingsIcon className="h-5 w-5" />
          </div>
          Settings
        </h2>
        <p className="mt-2 text-muted-foreground">Manage your account, preferences, and notifications.</p>
      </div>

      {/* Profile Section */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <User className="h-5 w-5 text-brand" />
            Profile
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Your personal information and account details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            <Avatar className="h-20 w-20 border border-border">
              <AvatarImage src={user?.photoURL ?? undefined} />
              <AvatarFallback className="text-xl bg-brand/10 text-brand">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                {user?.displayName ?? "User"}
              </h3>
              <p className="text-sm text-muted-foreground">{user?.email ?? "No email"}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.info("Profile editing coming soon! Your profile is synced with Google.")}
                className="mt-2"
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit Profile
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="bg-border" />

      {/* Preferences Section */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Palette className="h-5 w-5 text-brand" />
            Preferences
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Customize your default settings and appearance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-foreground/80">Default Platform</Label>
              <Select value={defaultPlatform} onValueChange={setDefaultPlatform}>
                <SelectTrigger className="bg-secondary border-border">
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
                <SelectTrigger className="bg-secondary border-border">
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
          </div>

          <div className="flex items-center justify-between rounded-lg bg-secondary border border-border p-4">
            <div className="flex items-center gap-3">
              <Moon className="h-5 w-5 text-brand" />
              <div>
                <p className="text-sm font-medium text-foreground">Theme</p>
                <p className="text-xs text-muted-foreground">Light mode is currently the only option</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand border border-brand/20">
              <Palette className="h-3.5 w-3.5" />
              Light
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground/80 flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Language
            </Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="bg-secondary border-border sm:w-1/2">
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
        </CardContent>
      </Card>

      <Separator className="bg-border" />

      {/* Notifications Section */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
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
              className="flex items-center justify-between rounded-lg bg-secondary border border-border p-4"
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

      <Separator className="bg-border" />

      {/* Account Section */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand" />
            Account
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Manage connected accounts and account actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Connected social channels */}
          <div>
            <Label className="text-foreground/80 mb-3 block">Connected channels</Label>

            {socialAccounts.length > 0 && (
              <div className="mb-4 space-y-2">
                {socialAccounts.map((account) => {
                  const Icon =
                    account.platform === "instagram"
                      ? Instagram
                      : account.platform === "twitter"
                        ? Twitter
                        : account.platform === "youtube"
                          ? Youtube
                          : Linkedin;
                  return (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-secondary p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                          <Icon className="h-5 w-5 text-foreground/70" />
                        </div>
                        <div>
                          <p className="text-sm font-medium capitalize text-foreground">
                            {account.platform === "twitter" ? "Twitter / X" : account.platform}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            @{account.username || account.displayName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                          <Check className="mr-1 h-3 w-3" />
                          Connected
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDisconnect(account.id)}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Connect new channels */}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="justify-start"
                disabled={connecting !== null}
                onClick={() => handleConnect("instagram")}
              >
                {connecting === "instagram" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Instagram className="mr-2 h-4 w-4" />
                )}
                Connect Instagram
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                disabled={connecting !== null}
                onClick={() => handleConnect("linkedin")}
              >
                {connecting === "linkedin" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Linkedin className="mr-2 h-4 w-4" />
                )}
                Connect LinkedIn
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                disabled={connecting !== null}
                onClick={() => handleConnect("youtube")}
              >
                {connecting === "youtube" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Youtube className="mr-2 h-4 w-4" />
                )}
                Connect YouTube
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Instagram requires a Business or Creator account linked to a Facebook Page. YouTube
              connects via your Google account. X / Twitter is coming soon.
            </p>
          </div>

          {/* Sign-in account */}
          <div>
            <Label className="text-foreground/80 mb-3 block">Sign-in</Label>
            <div className="rounded-lg bg-secondary border border-border p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
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
              <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                <Check className="mr-1 h-3 w-3" />
                Connected
              </Badge>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => {
                const data = {
                  email: user?.email,
                  displayName: user?.displayName,
                  exportedAt: new Date().toISOString(),
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
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
              <DialogContent className="bg-card border-border">
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
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    onClick={() => {
                      const subject = encodeURIComponent("MagicBox account deletion request");
                      const body = encodeURIComponent(
                        `Please start an account deletion request for ${user?.email ?? "my account"}.`
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
  );
}
