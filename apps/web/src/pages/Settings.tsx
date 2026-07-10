import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@shared/lib/auth";
import { toast } from "sonner";
import type { SocialAccount } from "@shared/types";
import { getSocialAccounts } from "@shared/lib/automations";
import { syncSocialAccounts } from "@shared/lib/suite";
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
  RefreshCw,
  Twitter,
} from "lucide-react";

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [defaultPlatform, setDefaultPlatform] = useState("instagram");
  const [isDeleting, setIsDeleting] = useState(false);
  const [defaultStyle, setDefaultStyle] = useState("professional");
  const [language, setLanguage] = useState("en");
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(false);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [syncingAccounts, setSyncingAccounts] = useState(false);

  useEffect(() => {
    if (!user) return;
    getSocialAccounts(user.uid).then(setSocialAccounts).catch(() => {});
  }, [user]);

  const handleSyncAccounts = async () => {
    if (!user) return;
    setSyncingAccounts(true);
    try {
      const result = await syncSocialAccounts({});
      setSocialAccounts(await getSocialAccounts(user.uid));
      toast.success(
        result.dryRun
          ? `Synced ${result.synced} channels (sandbox mode)`
          : `Synced ${result.synced} channels`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setSyncingAccounts(false);
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
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25">
            <SettingsIcon className="h-5 w-5 text-white" />
          </div>
          <span className="text-gradient">Settings</span>
        </h2>
        <p className="mt-2 text-white/60">Manage your account, preferences, and notifications.</p>
      </div>

      {/* Profile Section */}
      <Card className="glass-card border-white/[0.06] bg-transparent">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="h-5 w-5 text-purple-400" />
            Profile
          </CardTitle>
          <CardDescription className="text-white/50">
            Your personal information and account details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            <Avatar className="h-20 w-20 border-2 border-purple-500/30">
              <AvatarImage src={user?.photoURL ?? undefined} />
              <AvatarFallback className="text-xl bg-purple-600/20 text-purple-300">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <h3 className="text-lg font-semibold text-white">
                {user?.displayName ?? "User"}
              </h3>
              <p className="text-sm text-white/50">{user?.email ?? "No email"}</p>
              <Button
                size="sm"
                onClick={() => toast.info("Profile editing coming soon! Your profile is synced with Google.")}
                className="mt-2 bg-white/[0.06] border border-white/[0.1] text-white/80 hover:bg-white/[0.1]"
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit Profile
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="bg-white/[0.06]" />

      {/* Preferences Section */}
      <Card className="glass-card border-white/[0.06] bg-transparent">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Palette className="h-5 w-5 text-purple-400" />
            Preferences
          </CardTitle>
          <CardDescription className="text-white/50">
            Customize your default settings and appearance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-white/80">Default Platform</Label>
              <Select value={defaultPlatform} onValueChange={setDefaultPlatform}>
                <SelectTrigger className="bg-white/[0.03] border-white/[0.06]">
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
              <Label className="text-white/80">Default Style</Label>
              <Select value={defaultStyle} onValueChange={setDefaultStyle}>
                <SelectTrigger className="bg-white/[0.03] border-white/[0.06]">
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

          <div className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
            <div className="flex items-center gap-3">
              <Moon className="h-5 w-5 text-purple-400" />
              <div>
                <p className="text-sm font-medium text-white">Theme</p>
                <p className="text-xs text-white/40">Dark mode is currently the only option</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-purple-600/20 px-3 py-1.5 text-xs font-medium text-purple-300 border border-purple-500/30">
              <Moon className="h-3.5 w-3.5" />
              Dark
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-white/80 flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Language
            </Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="bg-white/[0.03] border-white/[0.06] sm:w-1/2">
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

      <Separator className="bg-white/[0.06]" />

      {/* Notifications Section */}
      <Card className="glass-card border-white/[0.06] bg-transparent">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="h-5 w-5 text-purple-400" />
            Notifications
          </CardTitle>
          <CardDescription className="text-white/50">
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
              className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.06] p-4"
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-white/40" />
                <div>
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-xs text-white/40">{item.description}</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={item.checked}
                onClick={() => item.onChange(!item.checked)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  item.checked ? "bg-purple-600" : "bg-white/10"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ${
                    item.checked ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator className="bg-white/[0.06]" />

      {/* Account Section */}
      <Card className="glass-card border-white/[0.06] bg-transparent">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-400" />
            Account
          </CardTitle>
          <CardDescription className="text-white/50">
            Manage connected accounts and account actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Connected social channels */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <Label className="text-white/80">Connected channels</Label>
              <Button
                variant="outline"
                size="sm"
                disabled={syncingAccounts}
                onClick={handleSyncAccounts}
                className="border-white/10 bg-white/[0.04] text-white/70"
              >
                {syncingAccounts ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Sync
              </Button>
            </div>
            {socialAccounts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-white/40">
                No social channels synced yet. Channels are linked by our team during
                enterprise onboarding — hit Sync to pull them in.
              </div>
            ) : (
              <div className="mb-4 space-y-2">
                {socialAccounts.map((account) => {
                  const Icon =
                    account.platform === "instagram"
                      ? Instagram
                      : account.platform === "twitter"
                        ? Twitter
                        : Linkedin;
                  return (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06]">
                          <Icon className="h-5 w-5 text-white/70" />
                        </div>
                        <div>
                          <p className="text-sm font-medium capitalize text-white">
                            {account.platform === "twitter" ? "Twitter / X" : account.platform}
                          </p>
                          <p className="text-xs text-white/40">
                            @{account.username || account.displayName}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <Check className="mr-1 h-3 w-3" />
                        Connected
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sign-in account */}
          <div>
            <Label className="text-white/80 mb-3 block">Sign-in</Label>
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
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
                  <p className="text-sm font-medium text-white">Google</p>
                  <p className="text-xs text-white/40">{user?.email ?? "Connected"}</p>
                </div>
              </div>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
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
                a.download = "magicboxai-data.json";
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Data exported successfully!");
              }}
              className="bg-white/[0.06] border border-white/[0.1] text-white/80 hover:bg-white/[0.1]"
            >
              <Download className="mr-2 h-4 w-4" />
              Export Data
            </Button>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Account
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-900 border-white/[0.06]">
                <DialogHeader>
                  <DialogTitle className="text-white">Delete Account</DialogTitle>
                  <DialogDescription className="text-white/50">
                    This action is permanent and cannot be undone. All your data, including avatars,
                    ads, and settings will be permanently deleted.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="ghost"
                    onClick={() => setDeleteDialogOpen(false)}
                    className="text-white/60"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white"
                    disabled={isDeleting}
                    onClick={async () => {
                      setIsDeleting(true);
                      try {
                        await signOut();
                        setDeleteDialogOpen(false);
                        navigate("/login");
                        toast.success("Account deletion requested. Your data will be removed.");
                      } catch {
                        toast.error("Failed to process request. Please contact support.");
                      } finally {
                        setIsDeleting(false);
                      }
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isDeleting ? "Deleting..." : "Delete My Account"}
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
