import { Link } from "react-router-dom";
import { BarChart3, Clock3, Link2, ShieldCheck } from "lucide-react";
import { Button } from "@shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/card";

export default function Analytics() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <div>
        <span className="eyebrow">Reporting</span>
        <h2 className="mt-2 flex items-center gap-3 text-3xl font-display text-foreground md:text-4xl">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
            <BarChart3 className="h-5 w-5" />
          </span>
          Analytics
        </h2>
        <p className="mt-2 text-muted-foreground">
          Provider-backed performance reporting is not connected yet. MagicBox will never show
          sample engagement numbers as if they belonged to your account.
        </p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>What is available today</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Link2,
              title: "Channel connections",
              body: "Connect Instagram, LinkedIn, or YouTube and manage publishing access.",
            },
            {
              icon: Clock3,
              title: "Publishing history",
              body: "Review scheduled, posted, and failed items in your Library and Calendar.",
            },
            {
              icon: ShieldCheck,
              title: "Verified metrics next",
              body: "Reach and engagement will appear only after provider APIs and reconciliation are tested.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-border bg-secondary/40 p-4">
              <item.icon className="mb-3 h-5 w-5 text-brand" />
              <h3 className="font-medium text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button asChild>
        <Link to="/settings">Manage channel connections</Link>
      </Button>
    </div>
  );
}
