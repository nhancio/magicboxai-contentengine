import { useState } from "react";
import {
  Settings2,
  Shield,
  Globe,
  Database,
  AlertTriangle,
  Check,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@shared/components/ui/card";
import { Input } from "@shared/components/ui/input";
import { Label } from "@shared/components/ui/label";
import { Button } from "@shared/components/ui/button";
import { Badge } from "@shared/components/ui/badge";
import { Separator } from "@shared/components/ui/separator";
import { Textarea } from "@shared/components/ui/textarea";
import { toast } from "sonner";
import { db } from "@shared/lib/firebase";

export default function AdminSettings() {
  // General settings
  const [siteName, setSiteName] = useState("MagicBox AI");
  const [siteDescription, setSiteDescription] = useState(
    "AI-powered avatar and ad generation platform"
  );
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Security
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // API Configuration
  const [rateLimit, setRateLimit] = useState("100");
  const [maxFileSize, setMaxFileSize] = useState("10");
  const [allowedOrigins, setAllowedOrigins] = useState(
    "http://localhost:3000\nhttps://magicboxai.app"
  );

  function handleSaveGeneral() {
    toast.success("General settings saved successfully");
  }

  function handleUpdatePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password updated successfully");
  }

  function handleSaveApiConfig() {
    toast.success("API configuration saved successfully");
  }

  function handleClearLogs() {
    if (!confirm("Are you sure you want to clear all API logs? This action cannot be undone.")) return;
    toast.success("All logs cleared successfully");
  }

  function handleResetDemo() {
    if (!confirm("Are you sure you want to reset all demo data? This action cannot be undone.")) return;
    toast.success("Demo data has been reset");
  }

  const firebaseConnected = !!db;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-purple-500/10">
          <Settings2 className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display">Settings</h1>
          <p className="text-white/50 text-sm">
            Manage your admin panel configuration
          </p>
        </div>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="w-4 h-4 text-purple-400" />
            General Settings
          </CardTitle>
          <CardDescription>Basic platform configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="siteName">Site Name</Label>
            <Input
              id="siteName"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="MagicBox AI"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="siteDesc">Site Description</Label>
            <Textarea
              id="siteDesc"
              value={siteDescription}
              onChange={(e) => setSiteDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Maintenance Mode</Label>
              <p className="text-xs text-white/40 mt-0.5">
                Temporarily disable access to the platform
              </p>
            </div>
            <button
              role="switch"
              aria-checked={maintenanceMode}
              onClick={() => setMaintenanceMode(!maintenanceMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                maintenanceMode ? "bg-purple-600" : "bg-white/10"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  maintenanceMode ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button onClick={handleSaveGeneral}>Save Changes</Button>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4 text-purple-400" />
            Security
          </CardTitle>
          <CardDescription>Update your admin credentials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPw">Current Password</Label>
            <Input
              id="currentPw"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newPw">New Password</Label>
              <Input
                id="newPw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPw">Confirm Password</Label>
              <Input
                id="confirmPw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
            </div>
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button onClick={handleUpdatePassword}>Update Password</Button>
          </div>
        </CardContent>
      </Card>

      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="w-4 h-4 text-purple-400" />
            API Configuration
          </CardTitle>
          <CardDescription>
            Configure rate limits and access controls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rateLimit">Rate Limit (req/min)</Label>
              <Input
                id="rateLimit"
                type="number"
                value={rateLimit}
                onChange={(e) => setRateLimit(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxFile">Max File Size (MB)</Label>
              <Input
                id="maxFile"
                type="number"
                value={maxFileSize}
                onChange={(e) => setMaxFileSize(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="origins">Allowed Origins</Label>
            <Textarea
              id="origins"
              value={allowedOrigins}
              onChange={(e) => setAllowedOrigins(e.target.value)}
              rows={3}
              placeholder="One origin per line"
            />
            <p className="text-xs text-white/30">
              Enter one origin per line
            </p>
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button onClick={handleSaveApiConfig}>Save Configuration</Button>
          </div>
        </CardContent>
      </Card>

      {/* Firebase */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="w-4 h-4 text-purple-400" />
            Firebase
          </CardTitle>
          <CardDescription>Database connection status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/70">Connection Status</span>
            {firebaseConnected ? (
              <Badge variant="success" className="gap-1">
                <Check className="w-3 h-3" />
                Connected
              </Badge>
            ) : (
              <Badge className="border-yellow-500/30 bg-yellow-500/10 text-yellow-300 gap-1">
                <AlertTriangle className="w-3 h-3" />
                Demo Mode
              </Badge>
            )}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/70">Project ID</span>
            <span className="text-sm font-mono text-white/50">
              {firebaseConnected ? "magicbox-ai" : "N/A (demo)"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-400">
            <AlertTriangle className="w-4 h-4" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions. Proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-red-500/10 bg-red-500/5">
            <div>
              <p className="text-sm font-medium text-white">Clear All Logs</p>
              <p className="text-xs text-white/40 mt-0.5">
                Permanently delete all API request logs
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleClearLogs}>
              Clear Logs
            </Button>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg border border-red-500/10 bg-red-500/5">
            <div>
              <p className="text-sm font-medium text-white">Reset Demo Data</p>
              <p className="text-xs text-white/40 mt-0.5">
                Reset all data to default demo state
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleResetDemo}>
              Reset Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
