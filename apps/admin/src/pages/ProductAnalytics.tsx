import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  MousePointerClick,
  Route,
  ShieldCheck,
} from "lucide-react";
import {
  PRODUCT_FUNNELS,
  TRACKED_PRODUCT_ACTIONS,
} from "@shared/lib/analytics";
import { Button } from "@shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/card";

const posthogProjectUrl =
  import.meta.env.VITE_POSTHOG_PROJECT_URL || "https://us.posthog.com";

const surfaces = ["Authentication", "Onboarding", "Navigation", "Maya"] as const;

export default function ProductAnalytics() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-purple-500/10 p-2.5">
            <BarChart3 className="h-5 w-5 text-purple-300" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Product analytics</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-white/50">
              The measurement plan for login, onboarding choices, left-side module access,
              and Maya activation.
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0 bg-purple-600 hover:bg-purple-500">
          <a href={posthogProjectUrl} target="_blank" rel="noopener noreferrer">
            Open PostHog
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-emerald-500/20 bg-emerald-500/[0.05]">
          <CardContent className="p-5">
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            <p className="mt-4 text-sm font-semibold text-white">Instrumentation ready</p>
            <p className="mt-1 text-xs leading-5 text-white/45">
              Named events, pseudonymous user identity, pageviews, and safe property
              filtering are implemented in the customer app.
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/[0.05]">
          <CardContent className="p-5">
            <AlertTriangle className="h-5 w-5 text-amber-300" />
            <p className="mt-4 text-sm font-semibold text-white">Production key required</p>
            <p className="mt-1 text-xs leading-5 text-white/45">
              Event ingestion remains off until <code>VITE_POSTHOG_KEY</code> is added to
              the web project&apos;s production environment and the app is redeployed.
            </p>
          </CardContent>
        </Card>
        <Card className="border-sky-500/20 bg-sky-500/[0.05]">
          <CardContent className="p-5">
            <ShieldCheck className="h-5 w-5 text-sky-300" />
            <p className="mt-4 text-sm font-semibold text-white">Consent and privacy</p>
            <p className="mt-1 text-xs leading-5 text-white/45">
              Tracking starts only after consent. Event properties reject content, URLs,
              credentials, names, and email addresses.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Route className="h-4 w-4 text-purple-300" />
            Conversion funnels to create in PostHog
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {PRODUCT_FUNNELS.map((funnel) => (
            <div
              key={funnel.name}
              className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
            >
              <p className="text-sm font-semibold text-white">{funnel.name}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {funnel.events.map((event, index) => (
                  <div key={event} className="contents">
                    <code className="rounded-md border border-white/10 bg-zinc-950 px-2 py-1 text-[11px] text-purple-200">
                      {event}
                    </code>
                    {index < funnel.events.length - 1 && (
                      <ArrowRight className="h-3.5 w-3.5 text-white/25" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MousePointerClick className="h-4 w-4 text-purple-300" />
            Tracked user actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {surfaces.map((surface) => {
            const actions = TRACKED_PRODUCT_ACTIONS.filter(
              (action) => action.surface === surface,
            );
            return (
              <section key={surface}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  {surface}
                </p>
                <div className="divide-y divide-white/[0.07] overflow-hidden rounded-xl border border-white/10">
                  {actions.map((action) => (
                    <div
                      key={action.event}
                      className="grid gap-2 bg-white/[0.02] px-4 py-3 sm:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.5fr)] sm:items-center"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{action.label}</p>
                        <code className="text-[11px] text-purple-300">{action.event}</code>
                      </div>
                      <p className="text-xs leading-5 text-white/45">{action.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </CardContent>
      </Card>

      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
        <p className="text-sm font-semibold text-white">Where each number lives</p>
        <div className="mt-3 grid gap-3 text-xs leading-5 text-white/50 md:grid-cols-3">
          <p>
            <span className="font-semibold text-white/80">Metrics:</span> PostHog →
            Product analytics → Trends or a saved Dashboard.
          </p>
          <p>
            <span className="font-semibold text-white/80">Activity:</span> PostHog →
            Activity for the event stream, or People for one pseudonymous user journey.
          </p>
          <p>
            <span className="font-semibold text-white/80">Conversion:</span> PostHog →
            Product analytics → New insight → Funnel, using the sequences above.
          </p>
        </div>
      </div>
    </div>
  );
}
