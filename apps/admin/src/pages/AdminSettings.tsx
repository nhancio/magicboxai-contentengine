import { AlertTriangle, Check, Database, KeyRound, Settings2, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Badge } from "@shared/components/ui/badge";
import { db } from "@shared/lib/firebase";

export default function AdminSettings() {
  const firebaseConnected = Boolean(db);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-purple-500/10 p-2.5">
          <Settings2 className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Operations</h1>
          <p className="text-sm text-white/50">Read-only deployment and security status</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-purple-400" />
            Firebase client
          </CardTitle>
          <CardDescription>Configuration detected by this admin build</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm text-white/70">Connection configuration</span>
          {firebaseConnected ? (
            <Badge variant="success" className="gap-1">
              <Check className="h-3 w-3" /> Configured
            </Badge>
          ) : (
            <Badge className="gap-1 border-yellow-500/30 bg-yellow-500/10 text-yellow-300">
              <AlertTriangle className="h-3 w-3" /> Missing
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-purple-400" />
            Configuration policy
          </CardTitle>
          <CardDescription>Admin UI controls stay disabled until server-backed mutations exist</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-white/60">
          <p>
            Runtime limits, allowed origins, maintenance state, and retention settings are managed
            through reviewed deployment configuration—not browser-only form fields.
          </p>
          <p>
            API keys and webhook secrets belong in Google Secret Manager and must never be displayed
            or edited in this client application.
          </p>
        </CardContent>
      </Card>

      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-amber-300">
            <KeyRound className="h-4 w-4" /> Privileged changes
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-white/60">
          Password resets, log deletion, role changes, and data resets require audited server
          endpoints with recent authentication. No placeholder button in this screen performs those actions.
        </CardContent>
      </Card>
    </div>
  );
}
