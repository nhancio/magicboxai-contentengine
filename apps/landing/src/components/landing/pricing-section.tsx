import { useState } from "react";
import { ArrowRight, CalendarDays, Check, Headphones, Sparkles } from "lucide-react";
import { BOOKING_URL, appLoginUrl, guestCheckoutUrl } from "@/lib/config";
import { captureEvent } from "@shared/lib/analytics";

type Plan = {
  name: string;
  description: string;
  price: { monthly: number | null; annual: number | null; annualTotal?: number };
  features: string[];
  cta: string;
  href: string;
  popular?: boolean;
  custom?: boolean;
  /** Paid plans go straight to Dodo guest checkout — no sign-in required first. */
  planId?: "pro" | "max";
};

const plans: Plan[] = [
  {
    name: "Free",
    description: "Start creating, no card required",
    price: { monthly: 0, annual: 0 },
    features: [
      "Create and save content drafts",
      "Explore brand and content tools",
      "Preview the automation workflow",
      "Publishing requires a paid plan",
    ],
    cta: "Start free",
    href: appLoginUrl(),
  },
  {
    name: "Pro",
    description: "Great for solo founders testing the waters",
    price: { monthly: 29, annual: 23, annualTotal: 276 },
    features: [
      "60 scheduled posts/month",
      "Brand-aware captions and images",
      "Instagram, LinkedIn, and YouTube",
      "Approval and recurring schedules",
      "Email support",
    ],
    cta: "Get started",
    href: appLoginUrl("/pricing"),
    planId: "pro",
    popular: true,
  },
  {
    name: "Max",
    description: "For high-volume teams",
    price: { monthly: 149, annual: 118, annualTotal: 1416 },
    features: [
      "300 scheduled posts/month",
      "Everything in Pro",
      "Higher-volume scheduling",
      "More monthly publishing capacity",
      "Email support",
    ],
    cta: "Get started",
    href: appLoginUrl("/pricing"),
    planId: "max",
  },
  {
    name: "Custom",
    description: "For teams with needs beyond the current plans",
    price: { monthly: null, annual: null },
    features: [
      "Discuss current product fit",
      "Plan a supported workflow",
      "Request launch support",
    ],
    cta: "Contact support",
    href: BOOKING_URL,
    custom: true,
  },
];

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <section id="pricing" className="relative py-32 lg:py-40 border-t border-foreground/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="max-w-3xl mb-16">
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase block mb-6">Pricing</span>
          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl tracking-tight text-foreground mb-6">
            Simple, transparent
            <br />
            <span className="text-stroke">pricing</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl">
            Start free and scale as you grow. No hidden fees, no per-post surprises.
          </p>
        </div>

        <div className="flex items-center gap-4 mb-14">
          <span className={`text-sm transition-colors ${!isAnnual ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
          <button
            type="button"
            onClick={() => setIsAnnual(!isAnnual)}
            aria-label={`Switch to ${isAnnual ? "monthly" : "annual"} billing`}
            aria-pressed={isAnnual}
            className="relative w-14 h-7 bg-foreground/10 rounded-full p-1 transition-colors hover:bg-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <div className={`w-5 h-5 bg-brand rounded-full transition-transform duration-300 ${isAnnual ? "translate-x-7" : "translate-x-0"}`} />
          </button>
          <span className={`text-sm transition-colors ${isAnnual ? "text-foreground" : "text-muted-foreground"}`}>Annual</span>
          {isAnnual && <span className="ml-2 px-2 py-1 bg-brand text-brand-foreground text-xs font-mono">Save 21%</span>}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-foreground/10">
          {plans.map((plan, idx) => (
            <div
              key={plan.name}
              className="group/card relative p-8 bg-background flex flex-col border-2 border-transparent transition-all duration-300 hover:border-brand hover:lg:-my-4 hover:lg:py-12"
            >
              <div className="mb-6">
                <span className="font-mono text-xs text-muted-foreground">{String(idx + 1).padStart(2, "0")}</span>
                <h3 className="font-display text-2xl text-foreground mt-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              </div>
              <div className="mb-6 pb-6 border-b border-foreground/10">
                {plan.price.monthly !== null ? (
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-4xl lg:text-5xl text-foreground">${isAnnual ? plan.price.annual : plan.price.monthly}</span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                ) : (
                  <span className="font-display text-3xl text-foreground">Custom</span>
                )}
                {isAnnual && plan.price.annualTotal && (
                  <p className="mt-2 text-xs text-muted-foreground">${plan.price.annualTotal} billed annually</p>
                )}
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-4 h-4 mt-0.5 shrink-0 text-foreground transition-colors duration-300 group-hover/card:text-brand" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <a
                href={
                  plan.planId
                    ? guestCheckoutUrl(plan.planId, isAnnual ? "annual" : "monthly")
                    : plan.href
                }
                target={plan.custom ? "_blank" : undefined}
                rel={plan.custom ? "noopener noreferrer" : undefined}
                onClick={() => captureEvent("pricing_cta_clicked", { plan: plan.name.toLowerCase(), billing: isAnnual ? "annual" : "monthly" })}
                className="w-full py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all group border border-foreground/20 text-foreground group-hover/card:bg-brand group-hover/card:text-brand-foreground group-hover/card:border-brand"
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          ))}
        </div>

        <div className="mt-14">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-foreground/10 bg-secondary/70 px-6 py-6 sm:px-8 lg:px-10">
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-72 opacity-60"
              aria-hidden="true"
              style={{
                background:
                  "radial-gradient(circle at 70% 50%, rgb(var(--brand) / 0.14), transparent 66%)",
              }}
            />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-4xl">
                <span className="mb-3 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-brand">
                  <Sparkles className="h-3.5 w-3.5" />
                  Managed service
                </span>
                <p className="text-base leading-relaxed text-foreground sm:text-lg">
                  Want more scale? We run an agency service where we manage everything for you{" "}
                  <span className="font-medium text-brand">
                    — buying accounts, warming, and done-for-you posting.
                  </span>
                </p>
              </div>

              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  captureEvent("pricing_cta_clicked", {
                    plan: "managed-service",
                    billing: "custom",
                  })
                }
                className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-foreground/20 bg-background px-6 text-sm font-medium text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                Enquire here
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10px] text-muted-foreground sm:text-xs">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Free plan
            </span>
            <span className="hidden text-foreground/20 sm:inline" aria-hidden="true">•</span>
            <span>1 i-credit per image or post · 1 v-credit per second of video</span>
            <span className="hidden text-foreground/20 sm:inline" aria-hidden="true">•</span>
            <span className="inline-flex items-center gap-1.5">
              <Headphones className="h-3.5 w-3.5" />
              24/7 support
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}
